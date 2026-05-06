import { describe, expect, it } from "vitest";

import { buildPlayerProfiles, mergeAiProfilesIntoPlayerProfiles } from "@/lib/player-honors";
import type { MatchRecord, Player, PlayerAiProfile } from "@/lib/types";

const players: Player[] = [
  {
    id: "p1",
    name: "Alice",
    createdAt: "2026-04-27T10:00:00.000Z",
    isActive: true,
  },
  {
    id: "p2",
    name: "Bob",
    createdAt: "2026-04-27T10:01:00.000Z",
    isActive: true,
  },
  {
    id: "p3",
    name: "Cara",
    createdAt: "2026-04-27T10:02:00.000Z",
    isActive: true,
  },
];

function createMatch(match: Partial<MatchRecord> & Pick<MatchRecord, "id" | "winnerId" | "loserId" | "createdAt">): MatchRecord {
  return {
    winnerMoments: [],
    loserMoments: [],
    winnerNote: "",
    loserNote: "",
    ...match,
  };
}

describe("buildPlayerProfiles", () => {
  it("derives titles, streaks, and ai hooks from history", () => {
    const profiles = buildPlayerProfiles(players, [
      createMatch({
        id: "m1",
        winnerId: "p1",
        loserId: "p2",
        createdAt: "2026-04-27T11:00:00.000Z",
        winnerMoments: ["clearance_runout"],
        loserMoments: ["scratch_black_8"],
      }),
      createMatch({
        id: "m2",
        winnerId: "p1",
        loserId: "p3",
        createdAt: "2026-04-27T11:10:00.000Z",
        winnerMoments: ["shutout"],
      }),
      createMatch({
        id: "m3",
        winnerId: "p1",
        loserId: "p2",
        createdAt: "2026-04-27T11:20:00.000Z",
        winnerMoments: ["win_by_5"],
      }),
      createMatch({
        id: "m4",
        winnerId: "p1",
        loserId: "p3",
        createdAt: "2026-04-27T11:30:00.000Z",
        winnerMoments: ["comeback_win"],
        winnerNote: "追到决胜局再一杆收完",
      }),
      createMatch({
        id: "m5",
        winnerId: "p1",
        loserId: "p2",
        createdAt: "2026-04-27T11:40:00.000Z",
        winnerMoments: ["hill_hill_finish"],
      }),
    ]);

    expect(profiles.p1.title?.label).toBe("火箭附体");
    expect(profiles.p1.bestWinStreak).toBe(5);
    expect(profiles.p1.achievements.map((achievement) => achievement.label)).toContain(
      "清台艺术家",
    );
    expect(profiles.p1.aiHooks).toContain("最长连胜 5 场");
    expect(profiles.p1.recentForm).toEqual({
      wins: 5,
      losses: 0,
      trend: ["W", "W", "W", "W", "W"],
    });
    expect(profiles.p1.recentMatches[0]?.opponentName).toBe("Bob");
    expect(profiles.p1.recentMatches[0]?.moments).toContain("决胜局绝杀");
    expect(profiles.p1.marketValue.amountUsd).toBeGreaterThan(profiles.p2.marketValue.amountUsd);
    expect(profiles.p1.marketValue.amountUsd).toBeGreaterThanOrEqual(12000);
    expect(profiles.p1.marketValue.tier).toBe("巡回赛热股");

    expect(profiles.p2.title?.label).toBe("黑八冤种");
    expect(profiles.p2.worstLossStreak).toBe(3);
    expect(profiles.p2.notableMoments).toContain("误进黑八 x1");
    expect(profiles.p2.recentForm.losses).toBe(3);
    expect(profiles.p2.recentMatches[0]?.result).toBe("L");
  });

  it("prefers fresh ai profiles over rule-based titles and valuations", () => {
    const ruleProfiles = buildPlayerProfiles(players, [
      createMatch({
        id: "m1",
        winnerId: "p1",
        loserId: "p2",
        createdAt: "2026-04-27T11:00:00.000Z",
      }),
    ]);
    const aiProfiles: PlayerAiProfile[] = [
      {
        playerId: "p1",
        titleLabel: "球房判官",
        titleCategory: "legend",
        titleReason: "最近收台不手软。",
        evaluation: "手感和压迫感都在，已经进入被重点盯防的区间。",
        marketValueUsd: 15480,
        updatedAt: "2026-04-27T11:05:00.000Z",
        model: "gpt-5.4-mini",
      },
      {
        playerId: "p2",
        titleLabel: "过期旧称号",
        titleCategory: "fun",
        titleReason: "这是旧数据。",
        evaluation: "这是旧评价。",
        marketValueUsd: 8200,
        updatedAt: "2026-04-27T10:30:00.000Z",
        model: "gpt-5.4-mini",
      },
    ];

    const merged = mergeAiProfilesIntoPlayerProfiles(ruleProfiles, aiProfiles);

    expect(merged.p1.title?.label).toBe("球房判官");
    expect(merged.p1.titleSource).toBe("ai");
    expect(merged.p1.marketValue.amountUsd).toBe(15500);
    expect(merged.p1.marketValueSource).toBe("ai");
    expect(merged.p1.evaluation).toContain("重点盯防");
    expect(merged.p1.aiModel).toBe("gpt-5.4-mini");

    expect(merged.p2.titleSource).toBe("rules");
    expect(merged.p2.title?.label).not.toBe("过期旧称号");
  });
});
