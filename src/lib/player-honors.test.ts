import { describe, expect, it } from "vitest";

import { buildPlayerProfiles, mergeAiProfilesIntoPlayerProfiles } from "@/lib/player-honors";
import type { MatchRecord, Player, PlayerAiProfile, PlayerPhoto } from "@/lib/types";

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

  it("keeps full match history while summarizing opponent records", () => {
    const profiles = buildPlayerProfiles(players, [
      createMatch({
        id: "m1",
        winnerId: "p1",
        loserId: "p2",
        createdAt: "2026-04-27T11:00:00.000Z",
      }),
      createMatch({
        id: "m2",
        winnerId: "p3",
        loserId: "p1",
        createdAt: "2026-04-27T11:10:00.000Z",
      }),
      createMatch({
        id: "m3",
        winnerId: "p1",
        loserId: "p2",
        createdAt: "2026-04-27T11:20:00.000Z",
      }),
      createMatch({
        id: "m4",
        winnerId: "p2",
        loserId: "p1",
        createdAt: "2026-04-27T11:30:00.000Z",
      }),
      createMatch({
        id: "m5",
        winnerId: "p1",
        loserId: "p3",
        createdAt: "2026-04-27T11:40:00.000Z",
      }),
      createMatch({
        id: "m6",
        winnerId: "p1",
        loserId: "p2",
        createdAt: "2026-04-27T11:50:00.000Z",
      }),
    ]);

    expect(profiles.p1.matchHistory.map((match) => match.id)).toEqual([
      "m6",
      "m5",
      "m4",
      "m3",
      "m2",
      "m1",
    ]);
    expect(profiles.p1.recentMatches.map((match) => match.id)).toEqual([
      "m6",
      "m5",
      "m4",
      "m3",
      "m2",
    ]);
    expect(profiles.p1.recentForm).toEqual({
      wins: 3,
      losses: 2,
      trend: ["W", "W", "L", "W", "L"],
    });
    expect(profiles.p1.opponentSummaries).toEqual([
      {
        opponentId: "p2",
        opponentName: "Bob",
        wins: 3,
        losses: 1,
        totalMatches: 4,
        winRate: 0.75,
        lastMatchAt: "2026-04-27T11:50:00.000Z",
      },
      {
        opponentId: "p3",
        opponentName: "Cara",
        wins: 1,
        losses: 1,
        totalMatches: 2,
        winRate: 0.5,
        lastMatchAt: "2026-04-27T11:40:00.000Z",
      },
    ]);
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
    expect(merged.p1.aiHooks).not.toContain("AI称号：球房判官");
    expect(merged.p1.aiHooks).not.toContain("AI身价：$15500");
    expect(merged.p1.aiHooks).not.toContain(
      "AI评价：手感和压迫感都在，已经进入被重点盯防的区间。",
    );

    expect(merged.p2.titleSource).toBe("rules");
    expect(merged.p2.title?.label).not.toBe("过期旧称号");
  });

  it("uses the latest match result to pick victory or defeat photos", () => {
    const photos: PlayerPhoto[] = [
      {
        id: "p1-default",
        playerId: "p1",
        imageData: "data:image/jpeg;base64,default",
        createdAt: "2026-04-27T10:05:00.000Z",
        role: "default",
      },
      {
        id: "p1-victory",
        playerId: "p1",
        imageData: "data:image/jpeg;base64,victory",
        createdAt: "2026-04-27T10:06:00.000Z",
        role: "victory",
      },
      {
        id: "p1-defeat",
        playerId: "p1",
        imageData: "data:image/jpeg;base64,defeat",
        createdAt: "2026-04-27T10:07:00.000Z",
        role: "defeat",
      },
    ];

    const winningProfiles = buildPlayerProfiles(
      players,
      [
        createMatch({
          id: "m1",
          winnerId: "p1",
          loserId: "p2",
          createdAt: "2026-04-27T11:00:00.000Z",
        }),
      ],
      photos,
    );

    const losingProfiles = buildPlayerProfiles(
      players,
      [
        createMatch({
          id: "m1",
          winnerId: "p1",
          loserId: "p2",
          createdAt: "2026-04-27T11:00:00.000Z",
        }),
        createMatch({
          id: "m2",
          winnerId: "p2",
          loserId: "p1",
          createdAt: "2026-04-27T11:10:00.000Z",
        }),
      ],
      photos,
    );

    expect(winningProfiles.p1.featuredPhoto?.id).toBe("p1-victory");
    expect(losingProfiles.p1.featuredPhoto?.id).toBe("p1-defeat");
  });

  it("falls back to the only available role photo when the latest result role is missing", () => {
    const photos: PlayerPhoto[] = [
      {
        id: "p1-victory",
        playerId: "p1",
        imageData: "data:image/jpeg;base64,victory",
        createdAt: "2026-04-27T10:06:00.000Z",
        role: "victory",
      },
    ];

    const profiles = buildPlayerProfiles(
      players,
      [
        createMatch({
          id: "m1",
          winnerId: "p2",
          loserId: "p1",
          createdAt: "2026-04-27T11:00:00.000Z",
        }),
      ],
      photos,
    );

    expect(profiles.p1.featuredPhoto?.id).toBe("p1-victory");
  });

  it("does not use default photos as featured result photos", () => {
    const profiles = buildPlayerProfiles(
      players,
      [
        createMatch({
          id: "m1",
          winnerId: "p1",
          loserId: "p2",
          createdAt: "2026-04-27T11:00:00.000Z",
        }),
      ],
      [
        {
          id: "p1-default",
          playerId: "p1",
          imageData: "data:image/jpeg;base64,default",
          createdAt: "2026-04-27T10:05:00.000Z",
          role: "default",
        },
      ],
    );

    expect(profiles.p1.featuredPhoto).toBeNull();
  });
});
