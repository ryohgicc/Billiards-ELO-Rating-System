import { describe, expect, it } from "vitest";

import { DEFAULT_K_FACTOR } from "@/lib/constants";
import { buildMatchTimeline } from "@/lib/rating";
import { buildSlackBattleReport, isValidBattleReportDate } from "@/lib/slack-battle-report";
import type { AppState, MatchRecord, Player } from "@/lib/types";

const players: Player[] = [
  { id: "player-gjj", name: "gjj", createdAt: "2026-06-01T00:00:00.000Z", isActive: true },
  { id: "player-cwj", name: "cwj", createdAt: "2026-06-01T00:01:00.000Z", isActive: true },
  { id: "player-lybb", name: "lybb", createdAt: "2026-06-01T00:02:00.000Z", isActive: true },
  { id: "player-ppz", name: "ppz", createdAt: "2026-06-01T00:03:00.000Z", isActive: true },
];

function createMatch(match: MatchRecord): MatchRecord {
  return match;
}

function createState(matches: MatchRecord[]): AppState {
  return {
    players,
    matches,
    photos: [],
    aiProfiles: [],
    aiReviews: [],
    aiModels: [],
    settings: {
      title: "Billiards",
      kFactor: 100,
    },
  };
}

describe("isValidBattleReportDate", () => {
  it("accepts real YYYY-MM-DD dates only", () => {
    expect(isValidBattleReportDate("2026-06-23")).toBe(true);
    expect(isValidBattleReportDate("2026-6-23")).toBe(false);
    expect(isValidBattleReportDate("2026-02-30")).toBe(false);
  });
});

describe("buildSlackBattleReport", () => {
  it("returns a Slack-ready daily battle report with match details and records", () => {
    const report = buildSlackBattleReport({
      state: createState([
        createMatch({
          id: "match-previous",
          winnerId: "player-gjj",
          loserId: "player-cwj",
          createdAt: "2026-06-22T11:12:00.000Z",
          winnerMoments: [],
          loserMoments: [],
          winnerNote: "",
          loserNote: "",
        }),
        createMatch({
          id: "match-001",
          winnerId: "player-gjj",
          loserId: "player-cwj",
          createdAt: "2026-06-23T11:12:00.000Z",
          winnerMoments: ["clearance_runout"],
          loserMoments: [],
          winnerNote: "",
          loserNote: "",
        }),
        createMatch({
          id: "match-002",
          winnerId: "player-lybb",
          loserId: "player-ppz",
          createdAt: "2026-06-23T11:25:00.000Z",
          winnerMoments: [],
          loserMoments: ["scratch_black_8"],
          winnerNote: "",
          loserNote: "",
        }),
      ]),
      date: "2026-06-23",
      generatedAt: new Date("2026-06-23T03:30:00.000Z"),
    });

    expect(report).toMatchObject({
      date: "2026-06-23",
      timezone: "Asia/Shanghai",
      generatedAt: "2026-06-23T11:30:00.000+08:00",
      matchCount: 2,
    });
    expect(report.matches).toEqual([
      expect.objectContaining({
        id: "match-001",
        timeLabel: "19:12",
        winnerName: "gjj",
        loserName: "cwj",
        winnerMoments: ["clearance_runout"],
      }),
      expect.objectContaining({
        id: "match-002",
        timeLabel: "19:25",
        winnerName: "lybb",
        loserName: "ppz",
        loserMoments: ["scratch_black_8"],
      }),
    ]);
    expect(report.records).toEqual([
      expect.objectContaining({ playerId: "player-lybb", name: "lybb", wins: 1, losses: 0 }),
      expect.objectContaining({ playerId: "player-gjj", name: "gjj", wins: 1, losses: 0 }),
      expect.objectContaining({ playerId: "player-cwj", name: "cwj", wins: 0, losses: 1 }),
      expect.objectContaining({ playerId: "player-ppz", name: "ppz", wins: 0, losses: 1 }),
    ]);
    expect(report.message).toContain("*今日战报（2026-06-23）*");
    expect(report.message).toContain("今日共 2 场");
    expect(report.message).toContain("1. 19:12 gjj 胜 cwj");
    expect(report.message).toContain("*今日胜负榜*");
  });

  it("uses the same fixed season K factor as the history page instead of stale stored settings", () => {
    const matches = [
      ...Array.from({ length: 10 }, (_, index) =>
        createMatch({
          id: `warmup-cwj-${index}`,
          winnerId: "player-cwj",
          loserId: "player-gjj",
          createdAt: `2026-06-22T08:${String(index).padStart(2, "0")}:00.000Z`,
          winnerMoments: [],
          loserMoments: [],
          winnerNote: "",
          loserNote: "",
        }),
      ),
      ...Array.from({ length: 10 }, (_, index) =>
        createMatch({
          id: `warmup-ppz-${index}`,
          winnerId: "player-ppz",
          loserId: "player-lybb",
          createdAt: `2026-06-22T09:${String(index).padStart(2, "0")}:00.000Z`,
          winnerMoments: [],
          loserMoments: [],
          winnerNote: "",
          loserNote: "",
        }),
      ),
      createMatch({
        id: "match-001",
        winnerId: "player-cwj",
        loserId: "player-ppz",
        createdAt: "2026-06-23T10:08:18.976Z",
        winnerMoments: [],
        loserMoments: [],
        winnerNote: "",
        loserNote: "",
      }),
    ];
    const expectedMatch = buildMatchTimeline(players, matches, DEFAULT_K_FACTOR).find(
      (entry) => entry.id === "match-001",
    );
    const report = buildSlackBattleReport({
      state: {
        ...createState(matches),
        settings: {
          title: "Billiards",
          kFactor: 60,
        },
      },
      date: "2026-06-23",
      generatedAt: new Date("2026-06-23T03:30:00.000Z"),
    });

    expect(report.matches[0]).toMatchObject({
      winnerName: "cwj",
      loserName: "ppz",
      winnerDelta: expectedMatch?.winnerDelta,
      loserDelta: expectedMatch?.loserDelta,
    });
  });

  it("returns an empty report message when there are no matches that day", () => {
    const report = buildSlackBattleReport({
      state: createState([]),
      date: "2026-06-23",
      generatedAt: new Date("2026-06-23T03:30:00.000Z"),
    });

    expect(report.matchCount).toBe(0);
    expect(report.matches).toEqual([]);
    expect(report.records).toEqual([]);
    expect(report.message).toBe("*今日战报（2026-06-23）*\n今日共 0 场\n\n今天还没有录入比赛。");
  });

  it("includes streak breaker and win streak extension bonuses in match data and message", () => {
    const report = buildSlackBattleReport({
      state: createState([
        createMatch({
          id: "match-001",
          winnerId: "player-cwj",
          loserId: "player-gjj",
          createdAt: "2026-06-23T10:00:00.000Z",
          winnerMoments: [],
          loserMoments: [],
          winnerNote: "",
          loserNote: "",
        }),
        createMatch({
          id: "match-002",
          winnerId: "player-cwj",
          loserId: "player-lybb",
          createdAt: "2026-06-23T10:10:00.000Z",
          winnerMoments: [],
          loserMoments: [],
          winnerNote: "",
          loserNote: "",
        }),
        createMatch({
          id: "match-003",
          winnerId: "player-cwj",
          loserId: "player-ppz",
          createdAt: "2026-06-23T10:20:00.000Z",
          winnerMoments: [],
          loserMoments: [],
          winnerNote: "",
          loserNote: "",
        }),
        createMatch({
          id: "match-004",
          winnerId: "player-gjj",
          loserId: "player-cwj",
          createdAt: "2026-06-23T10:30:00.000Z",
          winnerMoments: [],
          loserMoments: [],
          winnerNote: "",
          loserNote: "",
        }),
      ]),
      date: "2026-06-23",
      generatedAt: new Date("2026-06-23T03:30:00.000Z"),
    });

    expect(report.matches[2]).toMatchObject({
      id: "match-003",
      winStreakBonus: 5,
      streakBreakerBonus: 0,
    });
    expect(report.matches[3]).toMatchObject({
      id: "match-004",
      streakBreakerBonus: 8,
      winStreakBonus: 0,
    });
    expect(report.message).toContain("连胜延续奖励 +5");
    expect(report.message).toContain("终结连胜奖励 +8");
  });
});
