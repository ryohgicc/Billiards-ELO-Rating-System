import { describe, expect, it } from "vitest";

import {
  buildRankings,
  calculateMatchDelta,
  replayMatches,
} from "@/lib/rating";
import type { MatchRecord, Player } from "@/lib/types";

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

describe("calculateMatchDelta", () => {
  it("gives the winner and loser equal opposite rating changes", () => {
    const result = calculateMatchDelta(1000, 1000);

    expect(result.winnerDelta).toBe(16);
    expect(result.loserDelta).toBe(-16);
    expect(result.winnerDelta + result.loserDelta).toBe(0);
  });

  it("rewards an upset more than an expected win", () => {
    const favoriteWin = calculateMatchDelta(1200, 1000);
    const underdogWin = calculateMatchDelta(1000, 1200);

    expect(favoriteWin.winnerDelta).toBeLessThan(underdogWin.winnerDelta);
    expect(underdogWin.winnerDelta).toBeGreaterThan(20);
  });
});

describe("replayMatches", () => {
  it("starts new players at 1000 and accumulates match history in order", () => {
    const matches: MatchRecord[] = [
      {
        id: "m1",
        winnerId: "p1",
        loserId: "p2",
        createdAt: "2026-04-27T11:00:00.000Z",
      },
      {
        id: "m2",
        winnerId: "p2",
        loserId: "p1",
        createdAt: "2026-04-27T11:05:00.000Z",
      },
    ];

    const result = replayMatches(players.slice(0, 2), matches);

    expect(result.p1.rating).toBe(999);
    expect(result.p2.rating).toBe(1001);
    expect(result.p1.wins).toBe(1);
    expect(result.p1.losses).toBe(1);
    expect(result.p2.wins).toBe(1);
    expect(result.p2.losses).toBe(1);
  });

  it("rebuilds ratings consistently after a match is removed", () => {
    const matches: MatchRecord[] = [
      {
        id: "m1",
        winnerId: "p1",
        loserId: "p2",
        createdAt: "2026-04-27T11:00:00.000Z",
      },
      {
        id: "m2",
        winnerId: "p3",
        loserId: "p1",
        createdAt: "2026-04-27T11:10:00.000Z",
      },
      {
        id: "m3",
        winnerId: "p2",
        loserId: "p3",
        createdAt: "2026-04-27T11:20:00.000Z",
      },
    ];

    const withoutMiddle = replayMatches(players, matches.filter((match) => match.id !== "m2"));

    expect(withoutMiddle.p1.rating).toBe(1016);
    expect(withoutMiddle.p2.rating).toBe(1001);
    expect(withoutMiddle.p3.rating).toBe(983);
  });
});

describe("buildRankings", () => {
  it("sorts by rating, then win rate, then wins, then creation order", () => {
    const matches: MatchRecord[] = [
      {
        id: "m1",
        winnerId: "p1",
        loserId: "p2",
        createdAt: "2026-04-27T11:00:00.000Z",
      },
      {
        id: "m2",
        winnerId: "p1",
        loserId: "p3",
        createdAt: "2026-04-27T11:10:00.000Z",
      },
      {
        id: "m3",
        winnerId: "p2",
        loserId: "p3",
        createdAt: "2026-04-27T11:20:00.000Z",
      },
    ];

    const rankings = buildRankings(players, matches);

    expect(rankings.map((entry) => entry.player.id)).toEqual(["p1", "p2", "p3"]);
    expect(rankings[0].rank).toBe(1);
    expect(rankings[0].winRate).toBe(1);
    expect(rankings[2].losses).toBe(2);
  });
});
