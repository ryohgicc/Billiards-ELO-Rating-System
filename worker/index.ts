import { DEFAULT_SETTINGS } from "../src/lib/constants";
import { normalizeMatchMomentKeys, normalizeMatchNote } from "../src/lib/match-moments";
import { buildPlayerProfiles } from "../src/lib/player-honors";
import { normalizePlayerPhotoImageData, normalizePlayerPhotoRole } from "../src/lib/player-photos";
import type {
  AiModelConfig,
  AppState,
  MatchAiReview,
  MatchRecord,
  Player,
  PlayerAiProfile,
  PlayerPhoto,
} from "../src/lib/types";
import {
  assertImportStateShape,
  validateMatchDetails,
  validateMatchPlayers,
  validateAiModelList,
  validatePlayerPhotoPayload,
  validatePlayerName,
} from "../src/lib/validation";
import type { D1Database, D1PreparedStatement, ExecutionContext } from "@cloudflare/workers-types";
import { generateAiMatchInsights } from "./ai.js";

type Env = {
  DB: D1Database;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_API_URL?: string;
  OPEN_AI_URL?: string;
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
  winner_moments: string | null;
  loser_moments: string | null;
  winner_note: string | null;
  loser_note: string | null;
};

type PlayerPhotoRow = {
  id: string;
  player_id: string;
  image_data: string;
  created_at: string;
  role: string | null;
};

type PlayerAiProfileRow = {
  player_id: string;
  title_label: string;
  title_category: "legend" | "fun";
  title_reason: string;
  evaluation: string;
  market_value_usd: number;
  updated_at: string;
  model: string;
};

type MatchAiReviewRow = {
  match_id: string;
  review: string;
  winner_evaluation: string | null;
  loser_evaluation: string | null;
  updated_at: string;
  model: string;
};

type AiModelRow = {
  model: string;
  is_enabled: number;
  failure_count: number;
  last_error: string | null;
  last_tried_at: string | null;
  last_succeeded_at: string | null;
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
const AI_MODEL_RETRY_COOLDOWN_MS = 30 * 60 * 1000;
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
  const [playersResult, matchesResult, photosResult, aiProfilesResult, aiReviewsResult, aiModelsResult, settingsResult] =
    await Promise.all([
    db
      .prepare("SELECT id, name, created_at, is_active FROM players ORDER BY created_at ASC")
      .all<PlayerRow>(),
    db
      .prepare(
        "SELECT id, winner_id, loser_id, created_at, winner_moments, loser_moments, winner_note, loser_note FROM matches ORDER BY created_at ASC",
      )
      .all<MatchRow>(),
    db
      .prepare(
        "SELECT id, player_id, image_data, created_at, role FROM player_photos ORDER BY created_at ASC",
      )
      .all<PlayerPhotoRow>(),
    db
      .prepare(
        "SELECT player_id, title_label, title_category, title_reason, evaluation, market_value_usd, updated_at, model FROM player_ai_profiles ORDER BY updated_at DESC",
      )
      .all<PlayerAiProfileRow>(),
    db
      .prepare(
        "SELECT match_id, review, winner_evaluation, loser_evaluation, updated_at, model FROM match_ai_reviews ORDER BY updated_at DESC",
      )
      .all<MatchAiReviewRow>(),
    db
      .prepare(
        "SELECT model, is_enabled, failure_count, last_error, last_tried_at, last_succeeded_at, created_at FROM ai_models ORDER BY is_enabled DESC, COALESCE(last_tried_at, '') ASC, created_at ASC",
      )
      .all<AiModelRow>(),
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
    winnerMoments: normalizeMatchMomentKeys(parseStoredJsonArray(row.winner_moments), "winner"),
    loserMoments: normalizeMatchMomentKeys(parseStoredJsonArray(row.loser_moments), "loser"),
    winnerNote: normalizeMatchNote(row.winner_note),
    loserNote: normalizeMatchNote(row.loser_note),
  }));

  const photos: PlayerPhoto[] = (photosResult.results ?? []).map((row) => ({
    id: row.id,
    playerId: row.player_id,
    imageData: normalizePlayerPhotoImageData(row.image_data),
    createdAt: row.created_at,
    role: normalizePlayerPhotoRole(row.role),
  }));

  const aiProfiles: PlayerAiProfile[] = (aiProfilesResult.results ?? []).map((row) => ({
    playerId: row.player_id,
    titleLabel: row.title_label,
    titleCategory: row.title_category,
    titleReason: row.title_reason,
    evaluation: row.evaluation,
    marketValueUsd: row.market_value_usd,
    updatedAt: row.updated_at,
    model: row.model,
  }));

  const aiReviews: MatchAiReview[] = (aiReviewsResult.results ?? []).map((row) => ({
    matchId: row.match_id,
    review: row.review,
    winnerEvaluation: row.winner_evaluation ?? "",
    loserEvaluation: row.loser_evaluation ?? "",
    updatedAt: row.updated_at,
    model: row.model,
  }));

  const aiModels: AiModelConfig[] = (aiModelsResult.results ?? []).map((row) => ({
    model: row.model,
    isEnabled: row.is_enabled === 1,
    failureCount: row.failure_count,
    lastError: row.last_error ?? "",
    lastTriedAt: row.last_tried_at ?? undefined,
    lastSucceededAt: row.last_succeeded_at ?? undefined,
    createdAt: row.created_at,
  }));

  const settingsMap = Object.fromEntries(
    (settingsResult.results ?? []).map((row) => [row.key, row.value]),
  );

  return {
    players,
    matches,
    photos: photos.filter((photo) => Boolean(photo.imageData)),
    aiProfiles,
    aiReviews,
    aiModels,
    settings: {
      title: settingsMap.title || DEFAULT_SETTINGS.title,
      kFactor: Number(settingsMap.kFactor || DEFAULT_SETTINGS.kFactor),
    },
  };
}

function parseStoredJsonArray(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function stateCacheKey(request: Request) {
  const url = new URL(request.url);
  url.pathname = "/api/state";
  url.search = "";

  return new Request(url.toString(), { method: "GET" });
}

function stateCache() {
  return (caches as CacheStorage & { default?: Cache }).default;
}

async function cachedStateResponse(request: Request, env: Env, ctx: ExecutionContext) {
  const cache = stateCache();
  const cacheKey = stateCacheKey(request);

  if (cache) {
    try {
      const cached = await cache.match(cacheKey);

      if (cached) {
        return cached;
      }
    } catch (error) {
      console.warn("State cache read failed", error);
    }
  }

  const response = jsonResponse(await loadState(env.DB), {
    headers: STATE_CACHE_HEADERS,
  });

  if (cache) {
    ctx.waitUntil(
      cache.put(cacheKey, response.clone()).catch((error) => {
        console.warn("State cache write failed", error);
      }),
    );
  }

  return response;
}

async function clearStateCache(request: Request) {
  const cache = stateCache();

  if (!cache) {
    return;
  }

  try {
    await cache.delete(stateCacheKey(request));
  } catch (error) {
    console.warn("State cache delete failed", error);
  }
}

async function freshStateResponse(request: Request, env: Env, init?: ResponseInit) {
  await clearStateCache(request);
  return jsonResponse(await loadState(env.DB), init);
}

function getAiBaseUrl(env: Env) {
  return (env.OPENAI_API_URL || env.OPEN_AI_URL || "https://api.openai.com/v1").trim();
}

function buildPlayerAiProfileUpsertStatement(db: D1Database, profile: PlayerAiProfile) {
  return db
    .prepare(
      "INSERT INTO player_ai_profiles (player_id, title_label, title_category, title_reason, evaluation, market_value_usd, updated_at, model) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(player_id) DO UPDATE SET title_label = excluded.title_label, title_category = excluded.title_category, title_reason = excluded.title_reason, evaluation = excluded.evaluation, market_value_usd = excluded.market_value_usd, updated_at = excluded.updated_at, model = excluded.model",
    )
    .bind(
      profile.playerId,
      profile.titleLabel,
      profile.titleCategory,
      profile.titleReason,
      profile.evaluation,
      profile.marketValueUsd,
      profile.updatedAt,
      profile.model,
    );
}

function buildMatchAiReviewUpsertStatement(db: D1Database, review: MatchAiReview) {
  return db
    .prepare(
      "INSERT INTO match_ai_reviews (match_id, review, winner_evaluation, loser_evaluation, updated_at, model) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(match_id) DO UPDATE SET review = excluded.review, winner_evaluation = excluded.winner_evaluation, loser_evaluation = excluded.loser_evaluation, updated_at = excluded.updated_at, model = excluded.model",
    )
    .bind(
      review.matchId,
      review.review,
      review.winnerEvaluation,
      review.loserEvaluation,
      review.updatedAt,
      review.model,
    );
}

function buildAiModelUpsertStatement(db: D1Database, aiModel: AiModelConfig) {
  return db
    .prepare(
      "INSERT INTO ai_models (model, is_enabled, failure_count, last_error, last_tried_at, last_succeeded_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(model) DO UPDATE SET is_enabled = excluded.is_enabled, failure_count = excluded.failure_count, last_error = excluded.last_error, last_tried_at = excluded.last_tried_at, last_succeeded_at = excluded.last_succeeded_at, created_at = excluded.created_at",
    )
    .bind(
      aiModel.model,
      aiModel.isEnabled ? 1 : 0,
      aiModel.failureCount,
      aiModel.lastError,
      aiModel.lastTriedAt ?? null,
      aiModel.lastSucceededAt ?? null,
      aiModel.createdAt,
    );
}

function buildAiModelSuccessStatement(db: D1Database, model: string, attemptedAt: string) {
  return db
    .prepare(
      "UPDATE ai_models SET is_enabled = 1, last_error = '', last_tried_at = ?, last_succeeded_at = ? WHERE model = ?",
    )
    .bind(attemptedAt, attemptedAt, model);
}

function isPermanentAiModelError(errorMessage: string) {
  return (
    errorMessage.includes("Incorrect model ID") ||
    errorMessage.includes("do not have permission") ||
    errorMessage.includes("no longer available") ||
    errorMessage.includes("transitioned to a paid model")
  );
}

function hasRetryCooldownElapsed(lastTriedAt: string | undefined, generatedAt: string) {
  if (!lastTriedAt) {
    return true;
  }

  const lastAttemptAt = Date.parse(lastTriedAt);
  const currentAttemptAt = Date.parse(generatedAt);

  if (Number.isNaN(lastAttemptAt) || Number.isNaN(currentAttemptAt)) {
    return true;
  }

  return currentAttemptAt - lastAttemptAt >= AI_MODEL_RETRY_COOLDOWN_MS;
}

function orderAiModelsForAttempt(models: AiModelConfig[]) {
  return [...models].sort((left, right) => {
    if (left.failureCount !== right.failureCount) {
      return left.failureCount - right.failureCount;
    }

    const leftAttemptedAt = left.lastSucceededAt ?? left.lastTriedAt ?? "";
    const rightAttemptedAt = right.lastSucceededAt ?? right.lastTriedAt ?? "";

    if (leftAttemptedAt !== rightAttemptedAt) {
      return leftAttemptedAt.localeCompare(rightAttemptedAt);
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

function pickAiModelsForAttempt(state: AppState, env: Env, generatedAt: string) {
  const orderedModels = orderAiModelsForAttempt(state.aiModels);
  const enabledModels = orderedModels.filter((aiModel) => aiModel.isEnabled);

  if (enabledModels.length > 0) {
    return enabledModels;
  }

  const cooledDownDisabledModels = orderedModels.filter(
    (aiModel) =>
      !isPermanentAiModelError(aiModel.lastError) &&
      hasRetryCooldownElapsed(aiModel.lastTriedAt, generatedAt),
  );

  if (cooledDownDisabledModels.length > 0) {
    return cooledDownDisabledModels;
  }

  if (env.OPENAI_MODEL) {
    return [
      {
        model: env.OPENAI_MODEL,
        isEnabled: true,
        failureCount: 0,
        lastError: "",
        createdAt: generatedAt,
      },
    ];
  }

  return [];
}

function findPendingAiMatches(state: AppState) {
  const reviewedMatchIds = new Set(state.aiReviews.map((review) => review.matchId));

  return [...state.matches]
    .filter((match) => !reviewedMatchIds.has(match.id))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function refreshMatchAiArtifacts(match: MatchRecord, request: Request, env: Env) {
  if (!env.OPENAI_API_KEY) {
    return;
  }

  const state = await loadState(env.DB);
  const winner = state.players.find((player) => player.id === match.winnerId);
  const loser = state.players.find((player) => player.id === match.loserId);

  if (!winner || !loser) {
    return;
  }

  const profilesByPlayerId = buildPlayerProfiles(
    state.players,
    state.matches,
    state.photos,
    state.settings.kFactor,
    "worker-ai-refresh",
  );
  const winnerProfile = profilesByPlayerId[winner.id];
  const loserProfile = profilesByPlayerId[loser.id];

  if (!winnerProfile || !loserProfile) {
    return;
  }

  const generatedAt = new Date().toISOString();
  const activeModels = pickAiModelsForAttempt(state, env, generatedAt);

  if (activeModels.length === 0) {
    return;
  }
  let lastError = "";
  let didMutateAiState = false;

  for (const aiModel of activeModels) {
    try {
      const result = await generateAiMatchInsights({
        apiKey: env.OPENAI_API_KEY,
        apiUrl: getAiBaseUrl(env),
        model: aiModel.model,
        generatedAt,
        match,
        winner: {
          player: winner,
          profile: winnerProfile,
        },
        loser: {
          player: loser,
          profile: loserProfile,
        },
      });

      if (state.aiModels.some((entry) => entry.model === aiModel.model)) {
        await env.DB.batch([
          buildAiModelSuccessStatement(env.DB, aiModel.model, generatedAt),
          buildPlayerAiProfileUpsertStatement(env.DB, result.winnerProfile),
          buildPlayerAiProfileUpsertStatement(env.DB, result.loserProfile),
          buildMatchAiReviewUpsertStatement(env.DB, result.matchReview),
        ]);
      } else {
        await env.DB.batch([
          buildAiModelUpsertStatement(env.DB, {
            model: aiModel.model,
            isEnabled: true,
            failureCount: 0,
            lastError: "",
            lastTriedAt: generatedAt,
            lastSucceededAt: generatedAt,
            createdAt: generatedAt,
          }),
          buildPlayerAiProfileUpsertStatement(env.DB, result.winnerProfile),
          buildPlayerAiProfileUpsertStatement(env.DB, result.loserProfile),
          buildMatchAiReviewUpsertStatement(env.DB, result.matchReview),
        ]);
      }

      didMutateAiState = true;
      await clearStateCache(request);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "AI 模型调用失败";

      if (state.aiModels.some((entry) => entry.model === aiModel.model)) {
        await env.DB
          .prepare(
            "UPDATE ai_models SET is_enabled = 0, failure_count = failure_count + 1, last_error = ?, last_tried_at = ? WHERE model = ?",
          )
          .bind(lastError.slice(0, 240), generatedAt, aiModel.model)
          .run();
        didMutateAiState = true;
      }
    }
  }

  if (didMutateAiState) {
    await clearStateCache(request);
  }

  if (lastError) {
    console.error("All configured AI models failed:", lastError);
  }
}

async function refreshPendingAiArtifacts(request: Request, env: Env, limit = 1) {
  const state = await loadState(env.DB);
  const pendingMatches = findPendingAiMatches(state).slice(0, Math.max(1, limit));

  for (const match of pendingMatches) {
    await refreshMatchAiArtifacts(match, request, env);
  }
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

async function replaceAiModels(request: Request, env: Env) {
  const body = (await readJson(request)) as { models?: unknown };
  const models = validateAiModelList(body);
  const state = await loadState(env.DB);
  const existingByModel = new Map(state.aiModels.map((entry) => [entry.model, entry]));
  const now = new Date().toISOString();

  await env.DB.batch([
    env.DB.prepare("DELETE FROM ai_models"),
    ...models.map((model) => {
      const existing = existingByModel.get(model);

      return buildAiModelUpsertStatement(env.DB, {
        model,
        isEnabled: true,
        failureCount: existing?.failureCount ?? 0,
        lastError: "",
        lastTriedAt: existing?.lastTriedAt,
        lastSucceededAt: existing?.lastSucceededAt,
        createdAt: existing?.createdAt ?? now,
      });
    }),
  ]);

  return freshStateResponse(request, env);
}

async function resetAiModel(model: string, request: Request, env: Env) {
  const result = await env.DB
    .prepare(
      "UPDATE ai_models SET is_enabled = 1, last_error = '' WHERE model = ?",
    )
    .bind(model)
    .run();

  if (!result.meta.changes) {
    return errorResponse("模型不存在", 404);
  }

  return freshStateResponse(request, env);
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

async function createPlayerPhotos(playerId: string, request: Request, env: Env) {
  const body = (await readJson(request)) as {
    images?: unknown;
  };
  const state = await loadState(env.DB);

  if (!state.players.some((player) => player.id === playerId)) {
    return errorResponse("球员不存在", 404);
  }

  const photoPayload = validatePlayerPhotoPayload(
    body,
    state.photos.filter((photo) => photo.playerId === playerId).length,
  );
  const now = new Date().toISOString();

  await env.DB.batch(
    photoPayload.images.map((imageData, index) =>
      env.DB
        .prepare(
          "INSERT INTO player_photos (id, player_id, image_data, created_at, role) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(
          createId("photo"),
          playerId,
          imageData,
          new Date(Date.parse(now) + index).toISOString(),
          photoPayload.role,
        ),
    ),
  );

  return freshStateResponse(request, env, { status: 201 });
}

async function createMatch(request: Request, env: Env, ctx: ExecutionContext) {
  const body = (await readJson(request)) as {
    winnerId?: unknown;
    loserId?: unknown;
    winnerMoments?: unknown;
    loserMoments?: unknown;
    winnerNote?: unknown;
    loserNote?: unknown;
  };
  const state = await loadState(env.DB);
  const winnerId = String(body.winnerId ?? "");
  const loserId = String(body.loserId ?? "");
  const details = validateMatchDetails(body);
  const match: MatchRecord = {
    id: createId("match"),
    winnerId,
    loserId,
    createdAt: new Date().toISOString(),
    winnerMoments: details.winnerMoments,
    loserMoments: details.loserMoments,
    winnerNote: details.winnerNote,
    loserNote: details.loserNote,
  };

  validateMatchPlayers(winnerId, loserId, state.players);

  await env.DB
    .prepare(
      "INSERT INTO matches (id, winner_id, loser_id, created_at, winner_moments, loser_moments, winner_note, loser_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      match.id,
      match.winnerId,
      match.loserId,
      match.createdAt,
      JSON.stringify(match.winnerMoments),
      JSON.stringify(match.loserMoments),
      match.winnerNote,
      match.loserNote,
    )
    .run();

  ctx.waitUntil(
    refreshMatchAiArtifacts(match, request, env).catch((error) => {
      console.error("AI refresh failed after match creation:", error);
    }),
  );

  return freshStateResponse(request, env, { status: 201 });
}

async function backfillPendingAi(request: Request, env: Env) {
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") || "1");
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(1, Math.max(1, Math.floor(requestedLimit)))
    : 1;

  await refreshPendingAiArtifacts(request, env, limit);

  return freshStateResponse(request, env);
}

async function deleteMatch(matchId: string, request: Request, env: Env) {
  const match = await env.DB
    .prepare("SELECT winner_id, loser_id FROM matches WHERE id = ?")
    .bind(matchId)
    .first<{ winner_id: string; loser_id: string }>();

  if (!match) {
    return errorResponse("比赛记录不存在", 404);
  }

  await env.DB.batch([
    env.DB.prepare("DELETE FROM matches WHERE id = ?").bind(matchId),
    env.DB.prepare("DELETE FROM match_ai_reviews WHERE match_id = ?").bind(matchId),
    env.DB.prepare("DELETE FROM player_ai_profiles WHERE player_id = ?").bind(match.winner_id),
    env.DB.prepare("DELETE FROM player_ai_profiles WHERE player_id = ?").bind(match.loser_id),
  ]);

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
    env.DB.prepare("DELETE FROM match_ai_reviews"),
    env.DB.prepare("DELETE FROM player_ai_profiles"),
    env.DB.prepare("DELETE FROM ai_models"),
    env.DB.prepare("DELETE FROM player_photos"),
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
    ...state.photos.map((photo) =>
      env.DB
        .prepare("INSERT INTO player_photos (id, player_id, image_data, created_at, role) VALUES (?, ?, ?, ?, ?)")
        .bind(photo.id, photo.playerId, photo.imageData, photo.createdAt, photo.role),
    ),
    ...state.aiProfiles.map((profile) => buildPlayerAiProfileUpsertStatement(env.DB, profile)),
    ...state.aiReviews.map((review) => buildMatchAiReviewUpsertStatement(env.DB, review)),
    ...state.aiModels.map((aiModel) => buildAiModelUpsertStatement(env.DB, aiModel)),
    ...state.matches.map((match) =>
      env.DB
        .prepare(
          "INSERT INTO matches (id, winner_id, loser_id, created_at, winner_moments, loser_moments, winner_note, loser_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          match.id,
          match.winnerId,
          match.loserId,
          match.createdAt,
          JSON.stringify(match.winnerMoments),
          JSON.stringify(match.loserMoments),
          match.winnerNote,
          match.loserNote,
        ),
    ),
  ];

  await env.DB.batch(statements);

  return freshStateResponse(request, env);
}

async function clearState(request: Request, env: Env) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM matches"),
    env.DB.prepare("DELETE FROM match_ai_reviews"),
    env.DB.prepare("DELETE FROM player_ai_profiles"),
    env.DB.prepare("DELETE FROM ai_models"),
    env.DB.prepare("DELETE FROM player_photos"),
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

      if (url.pathname === "/api/ai-models" && request.method === "PUT") {
        return replaceAiModels(request, env);
      }

      if (url.pathname === "/api/ai/backfill" && request.method === "POST") {
        return backfillPendingAi(request, env);
      }

      const playerMatch = url.pathname.match(/^\/api\/players\/([^/]+)$/);
      if (playerMatch && request.method === "PATCH") {
        return togglePlayer(playerMatch[1], request, env);
      }

      if (playerMatch && request.method === "PUT") {
        return updatePlayerName(playerMatch[1], request, env);
      }

      const playerPhotoMatch = url.pathname.match(/^\/api\/players\/([^/]+)\/photos$/);
      if (playerPhotoMatch && request.method === "POST") {
        return createPlayerPhotos(playerPhotoMatch[1], request, env);
      }

      const aiModelMatch = url.pathname.match(/^\/api\/ai-models\/([^/]+)\/reset$/);
      if (aiModelMatch && request.method === "POST") {
        return resetAiModel(decodeURIComponent(aiModelMatch[1]), request, env);
      }

      if (url.pathname === "/api/matches" && request.method === "POST") {
        return createMatch(request, env, ctx);
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
