import { afterEach, describe, expect, it, vi } from "vitest";

import worker from "./index";

Object.assign(globalThis, {
  caches: {
    default: {
      async delete() {
        return true;
      },
      async match() {
        return undefined;
      },
      async put() {},
    },
  },
});

type Row = Record<string, unknown>;

const basePlayers = [
  {
    id: "player-gjj",
    name: "gjj",
    created_at: "2026-06-01T00:00:00.000Z",
    is_active: 1,
  },
  {
    id: "player-ppz",
    name: "ppz",
    created_at: "2026-06-01T00:01:00.000Z",
    is_active: 1,
  },
];

function createDb(rowsByTable: Record<string, Row[]>) {
  const statements: { sql: string; values: unknown[] }[] = [];

  return {
    statements,
    prepare(sql: string) {
      return {
        values: [] as unknown[],
        bind(...values: unknown[]) {
          this.values = values;
          return this;
        },
        async all() {
          if (sql.includes("FROM players")) {
            return { results: rowsByTable.players ?? [] };
          }
          if (sql.includes("FROM matches")) {
            return { results: rowsByTable.matches ?? [] };
          }
          if (sql.includes("FROM player_photos")) {
            return { results: rowsByTable.player_photos ?? [] };
          }
          if (sql.includes("FROM player_ai_profiles")) {
            return { results: rowsByTable.player_ai_profiles ?? [] };
          }
          if (sql.includes("FROM match_ai_reviews")) {
            return { results: rowsByTable.match_ai_reviews ?? [] };
          }
          if (sql.includes("FROM ai_models")) {
            return { results: rowsByTable.ai_models ?? [] };
          }
          if (sql.includes("FROM settings")) {
            return { results: rowsByTable.settings ?? [] };
          }

          return { results: [] };
        },
        async first() {
          if (sql.includes("FROM matches") && sql.includes("WHERE id = ?")) {
            return (rowsByTable.matches ?? []).find((row) => row.id === this.values[0]) ?? null;
          }

          return null;
        },
        async run() {
          statements.push({ sql, values: this.values });
          return {};
        },
      };
    },
    async batch(preparedStatements: Array<{ run: () => Promise<unknown> }>) {
      await Promise.all(preparedStatements.map((statement) => statement.run()));
      return [];
    },
  };
}

function createCtx(): ExecutionContext {
  return {
    passThroughOnException() {},
    waitUntil() {},
    props: {},
  };
}

describe("worker state API", () => {
  it("normalizes legacy stored K factor to the fixed season K factor", async () => {
    const response = await worker.fetch(
      new Request("https://score.example.com/api/state"),
      {
        DB: createDb({
          players: basePlayers,
          settings: [{ key: "kFactor", value: "60" }],
        }),
      },
      createCtx(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings.kFactor).toBe(100);
  });
});

describe("worker Slack battle report API", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a daily battle report for Slack bots", async () => {
    const response = await worker.fetch(
      new Request("https://score.example.com/api/slack/battle-report?date=2026-06-23", {
        headers: {
          accept: "application/json",
        },
      }),
      {
        DB: createDb({
          players: [
            {
              id: "player-gjj",
              name: "gjj",
              created_at: "2026-06-01T00:00:00.000Z",
              is_active: 1,
            },
            {
              id: "player-cwj",
              name: "cwj",
              created_at: "2026-06-01T00:01:00.000Z",
              is_active: 1,
            },
          ],
          matches: [
            {
              id: "match-001",
              winner_id: "player-gjj",
              loser_id: "player-cwj",
              created_at: "2026-06-23T11:12:00.000Z",
              winner_moments: JSON.stringify(["clearance_runout"]),
              loser_moments: JSON.stringify([]),
              winner_note: "",
              loser_note: "",
            },
          ],
          settings: [{ key: "kFactor", value: "100" }],
        }),
      },
      createCtx(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      date: "2026-06-23",
      timezone: "Asia/Shanghai",
      matchCount: 1,
      matches: [
        expect.objectContaining({
          id: "match-001",
          timeLabel: "19:12",
          winnerName: "gjj",
          loserName: "cwj",
        }),
      ],
    });
    expect(body.message).toContain("*今日战报（2026-06-23）*");
  });

  it("defaults to the current Shanghai date when date is omitted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T03:30:00.000Z"));

    const response = await worker.fetch(
      new Request("https://score.example.com/api/slack/battle-report"),
      {
        DB: createDb({
          players: [
            {
              id: "player-gjj",
              name: "gjj",
              created_at: "2026-06-01T00:00:00.000Z",
              is_active: 1,
            },
            {
              id: "player-cwj",
              name: "cwj",
              created_at: "2026-06-01T00:01:00.000Z",
              is_active: 1,
            },
          ],
          matches: [
            {
              id: "match-001",
              winner_id: "player-gjj",
              loser_id: "player-cwj",
              created_at: "2026-06-23T11:12:00.000Z",
              winner_moments: JSON.stringify([]),
              loser_moments: JSON.stringify([]),
              winner_note: "",
              loser_note: "",
            },
          ],
          settings: [{ key: "kFactor", value: "100" }],
        }),
      },
      createCtx(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      date: "2026-06-23",
      timezone: "Asia/Shanghai",
      matchCount: 1,
    });
  });

  it("rejects malformed report dates", async () => {
    const response = await worker.fetch(
      new Request("https://score.example.com/api/slack/battle-report?date=2026-02-30"),
      { DB: createDb({}) },
      createCtx(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "date 必须是有效的 YYYY-MM-DD 日期" });
  });
});

describe("worker reservation order API", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the daily reservation order for bot integrations", async () => {
    const response = await worker.fetch(
      new Request("https://score.example.com/api/reservation-order?date=2026-06-30"),
      {
        DB: createDb({
          players: [
            {
              id: "player-df56bb1c-8f28-4668-b167-b47961e8b922",
              name: "jiale",
              created_at: "2026-05-07T11:11:43.512Z",
              is_active: 1,
            },
            {
              id: "player-disabled",
              name: "disabled",
              created_at: "2026-05-07T11:11:44.512Z",
              is_active: 0,
            },
          ],
          settings: [{ key: "kFactor", value: "100" }],
        }),
      },
      createCtx(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      dateSeed: "2026-06-30",
      drawSeed: "2026-06-30",
      timezone: "Asia/Shanghai",
      algorithm: "fnv1a32-v1",
      entries: [
        {
          order: 1,
          playerId: "player-df56bb1c-8f28-4668-b167-b47961e8b922",
          name: "jiale",
          drawNumber: expect.any(Number),
          drawNumberLabel: expect.stringMatching(/^[0-9A-F]{8}$/),
          slackUserId: "U09A9LMK1UG",
        },
      ],
    });
    expect(typeof body.generatedAt).toBe("string");
  });

  it("defaults reservation order to the current Shanghai date when date is omitted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T01:00:00.000Z"));

    const response = await worker.fetch(
      new Request("https://score.example.com/api/reservation-order"),
      {
        DB: createDb({
          players: [
            {
              id: "player-df56bb1c-8f28-4668-b167-b47961e8b922",
              name: "jiale",
              created_at: "2026-05-07T11:11:43.512Z",
              is_active: 1,
            },
          ],
          settings: [{ key: "kFactor", value: "100" }],
        }),
      },
      createCtx(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dateSeed).toBe("2026-06-30");
  });

  it("rejects malformed reservation order dates", async () => {
    const response = await worker.fetch(
      new Request("https://score.example.com/api/reservation-order?date=2026-02-30"),
      { DB: createDb({}) },
      createCtx(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "date 必须是有效的 YYYY-MM-DD 日期" });
  });
});

describe("worker match API", () => {
  it("updates a match and clears stale AI artifacts", async () => {
    const db = createDb({
      players: [
        {
          id: "player-gjj",
          name: "gjj",
          created_at: "2026-06-01T00:00:00.000Z",
          is_active: 1,
        },
        {
          id: "player-ppz",
          name: "ppz",
          created_at: "2026-06-01T00:01:00.000Z",
          is_active: 1,
        },
      ],
      matches: [
        {
          id: "match-001",
          winner_id: "player-gjj",
          loser_id: "player-ppz",
          created_at: "2026-06-23T08:02:00.000Z",
          winner_moments: JSON.stringify([]),
          loser_moments: JSON.stringify([]),
          winner_note: "",
          loser_note: "",
        },
      ],
      settings: [{ key: "kFactor", value: "100" }],
    });

    const response = await worker.fetch(
      new Request("https://score.example.com/api/matches/match-001", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          winnerId: "player-ppz",
          loserId: "player-gjj",
          winnerMoments: ["clearance_runout"],
          loserMoments: ["scratch_black_8"],
          winnerNote: "追回一局",
          loserNote: "黑八失手",
        }),
      }),
      { DB: db },
      createCtx(),
    );

    expect(response.status).toBe(200);
    expect(db.statements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sql: expect.stringContaining("UPDATE matches SET winner_id = ?"),
          values: [
            "player-ppz",
            "player-gjj",
            JSON.stringify(["clearance_runout"]),
            JSON.stringify(["scratch_black_8"]),
            "追回一局",
            "黑八失手",
            "match-001",
          ],
        }),
        expect.objectContaining({
          sql: "DELETE FROM match_ai_reviews WHERE match_id = ?",
          values: ["match-001"],
        }),
        expect.objectContaining({
          sql: "DELETE FROM player_ai_profiles WHERE player_id = ?",
          values: ["player-gjj"],
        }),
        expect.objectContaining({
          sql: "DELETE FROM player_ai_profiles WHERE player_id = ?",
          values: ["player-ppz"],
        }),
      ]),
    );
  });
});
