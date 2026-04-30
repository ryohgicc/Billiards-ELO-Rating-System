import { describe, expect, it } from "vitest";

import { buildLeaderInsight } from "@/lib/leader-insight";
import type { RankingEntry } from "@/lib/types";

function createEntry(overrides: Partial<RankingEntry>): RankingEntry {
  return {
    player: {
      id: "p1",
      name: "Alice",
      createdAt: "2026-04-27T10:00:00.000Z",
      isActive: true,
    },
    rank: 1,
    rating: 1000,
    wins: 0,
    losses: 0,
    winRate: 0,
    lastMatchAt: undefined,
    ...overrides,
  };
}

describe("buildLeaderInsight", () => {
  it("summarizes a strong leader with rating gain and lead over second place", () => {
    const insight = buildLeaderInsight([
      createEntry({ rating: 1042, wins: 4, losses: 1, winRate: 0.8 }),
      createEntry({
        player: {
          id: "p2",
          name: "Bob",
          createdAt: "2026-04-27T10:01:00.000Z",
          isActive: true,
        },
        rank: 2,
        rating: 1018,
      }),
    ]);

    expect(insight).toEqual({
      ratingGain: 42,
      leadOverSecond: 24,
      headline: "控制力强势",
      subline: "领先第二名 24 分",
      dominancePercent: 70,
    });
  });

  it("invites challengers when there is no second-place player", () => {
    const insight = buildLeaderInsight([createEntry({ rating: 1008, wins: 1, losses: 0 })]);

    expect(insight.subline).toBe("等待挑战者");
    expect(insight.leadOverSecond).toBeNull();
  });
});
