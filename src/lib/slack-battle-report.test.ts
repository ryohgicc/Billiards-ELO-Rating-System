import { describe, expect, it } from "vitest";

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
});
