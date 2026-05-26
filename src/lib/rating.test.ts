import { describe, expect, it } from "vitest";

import {
  buildPlayerRankDayCounts,
  buildRankingMovements,
  buildRankings,
  buildRankingsThroughLocalDay,
  calculateMatchDelta,
  getEffectiveKFactor,
  getPreviousRankingDateKey,
  NEW_PLAYER_GAME_THRESHOLD,
  NEW_PLAYER_K_FACTOR,
  STABLE_PLAYER_GAME_THRESHOLD,
  STABLE_PLAYER_K_FACTOR,
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

describe("getEffectiveKFactor", () => {
  it("uses the new-player K when the player has fewer matches than the new threshold", () => {
    expect(getEffectiveKFactor(0)).toBe(NEW_PLAYER_K_FACTOR);
    expect(getEffectiveKFactor(NEW_PLAYER_GAME_THRESHOLD - 1)).toBe(NEW_PLAYER_K_FACTOR);
  });

  it("uses the base K when the player has reached the new threshold but is below the stable threshold", () => {
    expect(getEffectiveKFactor(NEW_PLAYER_GAME_THRESHOLD)).toBe(60);
    expect(getEffectiveKFactor(STABLE_PLAYER_GAME_THRESHOLD - 1)).toBe(60);
  });

  it("uses the stable-player K once the player has met the stable threshold", () => {
    expect(getEffectiveKFactor(STABLE_PLAYER_GAME_THRESHOLD)).toBe(STABLE_PLAYER_K_FACTOR);
    expect(getEffectiveKFactor(120)).toBe(STABLE_PLAYER_K_FACTOR);
  });

  it("respects an explicit base K factor for the middle band", () => {
    expect(getEffectiveKFactor(15, 50)).toBe(50);
  });
});

describe("calculateMatchDelta", () => {
  it("gives +25 to the winner and -15 to the loser when both sit at the base K in an even match", () => {
    const result = calculateMatchDelta(1500, 1500, { winnerKFactor: 60, loserKFactor: 60 });

    expect(result.winnerDelta).toBeGreaterThanOrEqual(15);
    expect(result.winnerDelta).toBeLessThanOrEqual(40);
    expect(result.loserDelta).toBeGreaterThanOrEqual(-25);
    expect(result.loserDelta).toBeLessThanOrEqual(-3);
    expect(result.winnerDelta).toBe(25);
    expect(result.loserDelta).toBe(-15);
    expect(result.winnerDelta + result.loserDelta).toBeGreaterThan(0);
  });

  it("scales the winner gain up for new players (K=80) and down for stable veterans (K=40) in even matches", () => {
    const newcomer = calculateMatchDelta(1500, 1500, { winnerKFactor: 80, loserKFactor: 80 });
    const baseline = calculateMatchDelta(1500, 1500, { winnerKFactor: 60, loserKFactor: 60 });
    const veteran = calculateMatchDelta(1500, 1500, { winnerKFactor: 40, loserKFactor: 40 });

    expect(newcomer.winnerDelta).toBeGreaterThan(baseline.winnerDelta);
    expect(veteran.winnerDelta).toBeLessThan(baseline.winnerDelta);
  });

  it("keeps a heavy favorite winner above the absolute floor and softens the loser penalty", () => {
    const heavyFavorite = calculateMatchDelta(1900, 1500, { winnerKFactor: 60, loserKFactor: 60 });

    expect(heavyFavorite.winnerDelta).toBeGreaterThanOrEqual(12);
    expect(heavyFavorite.winnerDelta).toBeLessThanOrEqual(40);
    expect(heavyFavorite.loserDelta).toBeGreaterThanOrEqual(-10);
    expect(heavyFavorite.loserDelta).toBeLessThanOrEqual(0);
    expect(heavyFavorite.winnerDelta + heavyFavorite.loserDelta).toBeGreaterThan(0);
  });

  it("rewards an upset winner above the upset floor and caps the gain at 160", () => {
    const upset = calculateMatchDelta(1300, 1500, { winnerKFactor: 60, loserKFactor: 60 });

    expect(upset.winnerDelta).toBeGreaterThanOrEqual(50);
    expect(upset.winnerDelta).toBeLessThanOrEqual(160);
    expect(upset.loserDelta).toBeLessThanOrEqual(-25);
  });

  it("punishes a heavy upset loser with at least -40 and stays within -160", () => {
    const heavyUpset = calculateMatchDelta(1100, 1500, { winnerKFactor: 60, loserKFactor: 60 });

    expect(heavyUpset.winnerDelta).toBeGreaterThanOrEqual(80);
    expect(heavyUpset.winnerDelta).toBeLessThanOrEqual(160);
    expect(heavyUpset.loserDelta).toBeGreaterThanOrEqual(-160);
    expect(heavyUpset.loserDelta).toBeLessThanOrEqual(-40);
  });

  it("keeps the winner gain monotonically non-increasing as the favorite gap grows at a fixed K", () => {
    const winnerRatings = [1500, 1600, 1700, 1800, 1900, 2000];
    const deltas = winnerRatings.map(
      (rating) =>
        calculateMatchDelta(rating, 1500, { winnerKFactor: 60, loserKFactor: 60 }).winnerDelta,
    );

    for (let index = 1; index < deltas.length; index += 1) {
      expect(deltas[index]).toBeLessThanOrEqual(deltas[index - 1]);
    }
  });

  it("keeps every match within the [-160, 160] caps with positive integer winner deltas", () => {
    const samples = [
      [1500, 1500],
      [2400, 1000],
      [1000, 2400],
      [1200, 1000],
      [1000, 1200],
    ] as const;

    for (const [winner, loser] of samples) {
      const result = calculateMatchDelta(winner, loser, {
        winnerKFactor: 60,
        loserKFactor: 60,
      });
      expect(Number.isInteger(result.winnerDelta)).toBe(true);
      expect(Number.isInteger(result.loserDelta)).toBe(true);
      expect(result.winnerDelta).toBeGreaterThan(0);
      expect(result.winnerDelta).toBeLessThanOrEqual(160);
      expect(result.loserDelta).toBeLessThanOrEqual(0);
      expect(result.loserDelta).toBeGreaterThanOrEqual(-160);
    }
  });

  it("accepts a single numeric kFactor argument for backward compatibility", () => {
    const numeric = calculateMatchDelta(1500, 1500, 60);
    const opts = calculateMatchDelta(1500, 1500, { winnerKFactor: 60, loserKFactor: 60 });

    expect(numeric).toEqual(opts);
  });
});

describe("replayMatches", () => {
  it("starts new players at 1000 with the new-player K and accumulates match history in order", () => {
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

    expect(result.p1.rating).toBe(985);
    expect(result.p2.rating).toBe(1030);
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

    expect(withoutMiddle.p1.rating).toBe(1033);
    expect(withoutMiddle.p2.rating).toBe(1025);
    expect(withoutMiddle.p3.rating).toBe(957);
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

  it("produces deterministic deltas and final ratings across repeated calls", () => {
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
        loserId: "p3",
        createdAt: "2026-04-27T11:10:00.000Z",
      }),
      createMatch({
        id: "m3",
        winnerId: "p1",
        loserId: "p3",
        createdAt: "2026-04-27T11:20:00.000Z",
      }),
    ];

    const firstRankings = buildRankings(players, matches);
    const secondRankings = buildRankings(players, matches);

    expect(firstRankings.map((entry) => entry.player.id)).toEqual(
      secondRankings.map((entry) => entry.player.id),
    );
    expect(firstRankings.map((entry) => entry.rating)).toEqual(
      secondRankings.map((entry) => entry.rating),
    );

    const firstStats = replayMatches(players, matches);
    const secondStats = replayMatches(players, matches);
    expect(firstStats.p1.rating).toBe(secondStats.p1.rating);
    expect(firstStats.p2.rating).toBe(secondStats.p2.rating);
    expect(firstStats.p3.rating).toBe(secondStats.p3.rating);
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
    expect(snapshot[0].rating).toBe(1033);
    expect(snapshot[1].rating).toBe(982);
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

describe("buildPlayerRankDayCounts", () => {
  it("counts top and bottom days from daily ranking snapshots", () => {
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
      createMatch({
        id: "m3",
        winnerId: "p3",
        loserId: "p2",
        createdAt: "2026-04-29T11:00:00.000Z",
      }),
    ];

    const counts = buildPlayerRankDayCounts(players, matches);

    expect(counts).toEqual({
      p1: { topDays: 1, bottomDays: 1 },
      p2: { topDays: 1, bottomDays: 2 },
      p3: { topDays: 1, bottomDays: 0 },
    });
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
