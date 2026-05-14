import { describe, expect, it } from "vitest";

import {
  buildRankingMovements,
  buildRankings,
  buildRankingsThroughLocalDay,
  calculateMatchDelta,
  getPreviousRankingDateKey,
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

function createMatch(match: Omit<MatchRecord, "winnerMoments" | "loserMoments" | "winnerNote" | "loserNote">): MatchRecord {
  return {
    ...match,
    winnerMoments: [],
    loserMoments: [],
    winnerNote: "",
    loserNote: "",
  };
}

describe("calculateMatchDelta", () => {
  it("gives the winner and loser equal opposite rating changes", () => {
    const result = calculateMatchDelta(1000, 1000);

    expect(result.winnerDelta).toBe(30);
    expect(result.loserDelta).toBe(-30);
    expect(result.winnerDelta + result.loserDelta).toBe(0);
  });

  it("rewards an upset more aggressively than an expected win", () => {
    const favoriteWin = calculateMatchDelta(1200, 1000);
    const underdogWin = calculateMatchDelta(1000, 1200);
    const largerUpset = calculateMatchDelta(1000, 1400);
    const heavyFavoriteWin = calculateMatchDelta(1400, 1000);

    expect(favoriteWin.winnerDelta).toBe(14);
    expect(underdogWin.winnerDelta).toBe(61);
    expect(largerUpset.winnerDelta).toBe(95);
    expect(heavyFavoriteWin.winnerDelta).toBe(5);
    expect(favoriteWin.winnerDelta).toBeLessThan(underdogWin.winnerDelta);
    expect(underdogWin.winnerDelta + underdogWin.loserDelta).toBe(0);
    expect(largerUpset.winnerDelta + largerUpset.loserDelta).toBe(0);
  });
});

describe("replayMatches", () => {
  it("starts new players at 1000 and accumulates match history in order", () => {
    const matches: MatchRecord[] = [
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
        createdAt: "2026-04-27T11:05:00.000Z",
      }),
    ];

    const result = replayMatches(players.slice(0, 2), matches);

    expect(result.p1.rating).toBe(992);
    expect(result.p2.rating).toBe(1008);
    expect(result.p1.wins).toBe(1);
    expect(result.p1.losses).toBe(1);
    expect(result.p1.bestWinStreak).toBe(1);
    expect(result.p1.worstLossStreak).toBe(1);
    expect(result.p2.wins).toBe(1);
    expect(result.p2.losses).toBe(1);
  });

  it("rebuilds ratings consistently after a match is removed", () => {
    const matches: MatchRecord[] = [
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
        winnerId: "p2",
        loserId: "p3",
        createdAt: "2026-04-27T11:20:00.000Z",
      }),
    ];

    const withoutMiddle = replayMatches(players, matches.filter((match) => match.id !== "m2"));

    expect(withoutMiddle.p1.rating).toBe(1030);
    expect(withoutMiddle.p2.rating).toBe(1004);
    expect(withoutMiddle.p3.rating).toBe(966);
  });

  it("tracks longest win and loss streaks per player", () => {
    const matches: MatchRecord[] = [
      createMatch({
        id: "m1",
        winnerId: "p1",
        loserId: "p2",
        createdAt: "2026-04-27T11:00:00.000Z",
      }),
      createMatch({
        id: "m2",
        winnerId: "p1",
        loserId: "p3",
        createdAt: "2026-04-27T11:10:00.000Z",
      }),
      createMatch({
        id: "m3",
        winnerId: "p3",
        loserId: "p1",
        createdAt: "2026-04-27T11:20:00.000Z",
      }),
      createMatch({
        id: "m4",
        winnerId: "p3",
        loserId: "p2",
        createdAt: "2026-04-27T11:30:00.000Z",
      }),
      createMatch({
        id: "m5",
        winnerId: "p3",
        loserId: "p2",
        createdAt: "2026-04-27T11:40:00.000Z",
      }),
    ];

    const result = replayMatches(players, matches);

    expect(result.p1.bestWinStreak).toBe(2);
    expect(result.p1.worstLossStreak).toBe(1);
    expect(result.p2.worstLossStreak).toBe(3);
    expect(result.p3.bestWinStreak).toBe(3);
  });
});

describe("buildRankings", () => {
  it("sorts by rating, then win rate, then wins, then creation order", () => {
    const matches: MatchRecord[] = [
      createMatch({
        id: "m1",
        winnerId: "p1",
        loserId: "p2",
        createdAt: "2026-04-27T11:00:00.000Z",
      }),
      createMatch({
        id: "m2",
        winnerId: "p1",
        loserId: "p3",
        createdAt: "2026-04-27T11:10:00.000Z",
      }),
      createMatch({
        id: "m3",
        winnerId: "p2",
        loserId: "p3",
        createdAt: "2026-04-27T11:20:00.000Z",
      }),
    ];

    const rankings = buildRankings(players, matches);

    expect(rankings.map((entry) => entry.player.id)).toEqual(["p1", "p2", "p3"]);
    expect(rankings[0].rank).toBe(1);
    expect(rankings[0].winRate).toBe(1);
    expect(rankings[2].losses).toBe(2);
  });
});

describe("buildRankingsThroughLocalDay", () => {
  it("builds a ranking snapshot through the end of the selected local day", () => {
    const matches: MatchRecord[] = [
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
        createdAt: "2026-04-28T11:00:00.000Z",
      }),
    ];

    const snapshot = buildRankingsThroughLocalDay(players.slice(0, 2), matches, "2026-04-27");

    expect(snapshot.map((entry) => entry.player.id)).toEqual(["p1", "p2"]);
    expect(snapshot[0].rating).toBe(1030);
    expect(snapshot[1].rating).toBe(970);
  });

  it("excludes players created after the selected local day", () => {
    const futurePlayer: Player = {
      id: "p4",
      name: "Dana",
      createdAt: "2026-04-28T10:00:00.000Z",
      isActive: true,
    };

    const snapshot = buildRankingsThroughLocalDay([...players, futurePlayer], [], "2026-04-27");

    expect(snapshot.map((entry) => entry.player.id)).toEqual(["p1", "p2", "p3"]);
  });
});

describe("buildRankingMovements", () => {
  it("reports rank gains, drops, unchanged ranks, and new entries", () => {
    const previous = [
      { player: players[0], rank: 3 },
      { player: players[1], rank: 1 },
      { player: players[2], rank: 2 },
    ];
    const current = [
      { player: players[0], rank: 1 },
      { player: players[1], rank: 4 },
      { player: players[2], rank: 2 },
      {
        player: {
          id: "p4",
          name: "Dana",
          createdAt: "2026-04-29T10:00:00.000Z",
          isActive: true,
        },
        rank: 3,
      },
    ];

    const movements = buildRankingMovements(current, previous);

    expect(movements).toEqual({
      p1: { status: "up", places: 2 },
      p2: { status: "down", places: 3 },
      p3: { status: "same", places: 0 },
      p4: { status: "new", places: 0 },
    });
  });

  it("returns unchanged movements when there is no comparison snapshot", () => {
    const movements = buildRankingMovements([{ player: players[0], rank: 1 }], null);

    expect(movements).toEqual({
      p1: { status: "same", places: 0 },
    });
  });
});

describe("getPreviousRankingDateKey", () => {
  it("uses the previous match day instead of filling empty natural days", () => {
    const groups = [
      { dateKey: "2026-05-13" },
      { dateKey: "2026-05-11" },
      { dateKey: "2026-05-09" },
    ];

    expect(getPreviousRankingDateKey(groups, "2026-05-13")).toBe("2026-05-11");
    expect(getPreviousRankingDateKey(groups, "2026-05-11")).toBe("2026-05-09");
    expect(getPreviousRankingDateKey(groups, "2026-05-09")).toBeNull();
    expect(getPreviousRankingDateKey(groups, "overall")).toBe("2026-05-11");
  });
});
