import { DEFAULT_SETTINGS } from "../src/lib/constants";
import type { AppState, MatchRecord, Player } from "../src/lib/types";
import { assertImportStateShape, validateMatchPlayers, validatePlayerName } from "../src/lib/validation";
import type { D1Database, D1PreparedStatement, ExecutionContext } from "@cloudflare/workers-types";

type Env = {
  DB: D1Database;
};

type PlayerRow = {
  id: string;
  name: string;
  created_at: string;
  is_active: number;
};

type MatchRow = {
  id: string;
  winner_id: string;
  loser_id: string;
  created_at: string;
};

type SettingRow = {
  key: string;
  value: string;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const STATE_CACHE_TTL_SECONDS = 10;
const STATE_CACHE_HEADERS = {
  "cache-control": `public, max-age=${STATE_CACHE_TTL_SECONDS}, s-maxage=${STATE_CACHE_TTL_SECONDS}`,
  "cdn-cache-control": `max-age=${STATE_CACHE_TTL_SECONDS}`,
  "cloudflare-cdn-cache-control": `max-age=${STATE_CACHE_TTL_SECONDS}`,
};

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...init?.headers,
    },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, { status });
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new Error("请求内容不是有效的 JSON");
  }
}

async function loadState(db: D1Database): Promise<AppState> {
  const [playersResult, matchesResult, settingsResult] = await Promise.all([
    db
      .prepare("SELECT id, name, created_at, is_active FROM players ORDER BY created_at ASC")
      .all<PlayerRow>(),
    db
      .prepare("SELECT id, winner_id, loser_id, created_at FROM matches ORDER BY created_at ASC")
      .all<MatchRow>(),
    db.prepare("SELECT key, value FROM settings").all<SettingRow>(),
  ]);

  const players: Player[] = (playersResult.results ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    isActive: row.is_active === 1,
  }));

  const matches: MatchRecord[] = (matchesResult.results ?? []).map((row) => ({
    id: row.id,
    winnerId: row.winner_id,
    loserId: row.loser_id,
    createdAt: row.created_at,
  }));

  const settingsMap = Object.fromEntries(
    (settingsResult.results ?? []).map((row) => [row.key, row.value]),
  );

  return {
    players,
    matches,
    settings: {
      title: settingsMap.title || DEFAULT_SETTINGS.title,
      kFactor: Number(settingsMap.kFactor || DEFAULT_SETTINGS.kFactor),
    },
  };
}

function stateCacheKey(request: Request) {
  const url = new URL(request.url);
  url.pathname = "/api/state";
  url.search = "";

  return new Request(url.toString(), { method: "GET" });
}

async function cachedStateResponse(request: Request, env: Env, ctx: ExecutionContext) {
  const cache = (caches as CacheStorage & { default: Cache }).default;
  const cacheKey = stateCacheKey(request);
  const cached = await cache.match(cacheKey);

  if (cached) {
    return cached;
  }

  const response = jsonResponse(await loadState(env.DB), {
    headers: STATE_CACHE_HEADERS,
  });

  ctx.waitUntil(cache.put(cacheKey, response.clone()));

  return response;
}

async function clearStateCache(request: Request) {
  await (caches as CacheStorage & { default: Cache }).default.delete(stateCacheKey(request));
}

async function freshStateResponse(request: Request, env: Env, init?: ResponseInit) {
  await clearStateCache(request);
  return jsonResponse(await loadState(env.DB), init);
}

async function createPlayer(request: Request, env: Env) {
  const body = await readJson(request);
  const state = await loadState(env.DB);
  const name = validatePlayerName(String((body as { name?: unknown }).name ?? ""), state.players);
  const player: Player = {
    id: createId("player"),
    name,
    createdAt: new Date().toISOString(),
    isActive: true,
  };

  await env.DB
    .prepare("INSERT INTO players (id, name, created_at, is_active) VALUES (?, ?, ?, 1)")
    .bind(player.id, player.name, player.createdAt)
    .run();

  return freshStateResponse(request, env, { status: 201 });
}

async function togglePlayer(playerId: string, request: Request, env: Env) {
  const result = await env.DB
    .prepare("UPDATE players SET is_active = CASE is_active WHEN 1 THEN 0 ELSE 1 END WHERE id = ?")
    .bind(playerId)
    .run();

  if (!result.meta.changes) {
    return errorResponse("球员不存在", 404);
  }

  return freshStateResponse(request, env);
}

async function updatePlayerName(playerId: string, request: Request, env: Env) {
  const body = await readJson(request);
  const state = await loadState(env.DB);
  const name = validatePlayerName(String((body as { name?: unknown }).name ?? ""), state.players, playerId);

  if (!state.players.some((player) => player.id === playerId)) {
    return errorResponse("球员不存在", 404);
  }

  await env.DB.prepare("UPDATE players SET name = ? WHERE id = ?").bind(name, playerId).run();

  return freshStateResponse(request, env);
}

async function createMatch(request: Request, env: Env) {
  const body = (await readJson(request)) as { winnerId?: unknown; loserId?: unknown };
  const state = await loadState(env.DB);
  const winnerId = String(body.winnerId ?? "");
  const loserId = String(body.loserId ?? "");

  validateMatchPlayers(winnerId, loserId, state.players);

  await env.DB
    .prepare("INSERT INTO matches (id, winner_id, loser_id, created_at) VALUES (?, ?, ?, ?)")
    .bind(createId("match"), winnerId, loserId, new Date().toISOString())
    .run();

  return freshStateResponse(request, env, { status: 201 });
}

async function deleteMatch(matchId: string, request: Request, env: Env) {
  const result = await env.DB.prepare("DELETE FROM matches WHERE id = ?").bind(matchId).run();

  if (!result.meta.changes) {
    return errorResponse("比赛记录不存在", 404);
  }

  return freshStateResponse(request, env);
}

async function updateSettings(request: Request, env: Env) {
  const body = (await readJson(request)) as { title?: unknown };
  const title = String(body.title ?? "").trim() || DEFAULT_SETTINGS.title;

  await env.DB
    .prepare("INSERT INTO settings (key, value) VALUES ('title', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(title)
    .run();

  return freshStateResponse(request, env);
}

async function replaceState(request: Request, env: Env) {
  const state = assertImportStateShape(await readJson(request));

  const statements: D1PreparedStatement[] = [
    env.DB.prepare("DELETE FROM matches"),
    env.DB.prepare("DELETE FROM players"),
    env.DB.prepare("DELETE FROM settings"),
    env.DB
      .prepare("INSERT INTO settings (key, value) VALUES (?, ?)")
      .bind("title", state.settings.title),
    env.DB
      .prepare("INSERT INTO settings (key, value) VALUES (?, ?)")
      .bind("kFactor", String(state.settings.kFactor)),
    ...state.players.map((player) =>
      env.DB
        .prepare("INSERT INTO players (id, name, created_at, is_active) VALUES (?, ?, ?, ?)")
        .bind(player.id, player.name, player.createdAt, player.isActive ? 1 : 0),
    ),
    ...state.matches.map((match) =>
      env.DB
        .prepare("INSERT INTO matches (id, winner_id, loser_id, created_at) VALUES (?, ?, ?, ?)")
        .bind(match.id, match.winnerId, match.loserId, match.createdAt),
    ),
  ];

  await env.DB.batch(statements);

  return freshStateResponse(request, env);
}

async function clearState(request: Request, env: Env) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM matches"),
    env.DB.prepare("DELETE FROM players"),
    env.DB.prepare("DELETE FROM settings"),
    env.DB
      .prepare("INSERT INTO settings (key, value) VALUES (?, ?)")
      .bind("title", DEFAULT_SETTINGS.title),
    env.DB
      .prepare("INSERT INTO settings (key, value) VALUES (?, ?)")
      .bind("kFactor", String(DEFAULT_SETTINGS.kFactor)),
  ]);

  return freshStateResponse(request, env);
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/state" && request.method === "GET") {
        return cachedStateResponse(request, env, ctx);
      }

      if (url.pathname === "/api/players" && request.method === "POST") {
        return createPlayer(request, env);
      }

      const playerMatch = url.pathname.match(/^\/api\/players\/([^/]+)$/);
      if (playerMatch && request.method === "PATCH") {
        return togglePlayer(playerMatch[1], request, env);
      }

      if (playerMatch && request.method === "PUT") {
        return updatePlayerName(playerMatch[1], request, env);
      }

      if (url.pathname === "/api/matches" && request.method === "POST") {
        return createMatch(request, env);
      }

      const matchMatch = url.pathname.match(/^\/api\/matches\/([^/]+)$/);
      if (matchMatch && request.method === "DELETE") {
        return deleteMatch(matchMatch[1], request, env);
      }

      if (url.pathname === "/api/settings" && request.method === "PUT") {
        return updateSettings(request, env);
      }

      if (url.pathname === "/api/state" && request.method === "PUT") {
        return replaceState(request, env);
      }

      if (url.pathname === "/api/state" && request.method === "DELETE") {
        return clearState(request, env);
      }

      return errorResponse("接口不存在", 404);
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : "服务器发生未知错误");
    }
  },
};

export default worker;
