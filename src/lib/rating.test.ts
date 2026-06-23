import { describe, expect, it } from "vitest";

import {
  buildMonthlyRankingSnapshots,
  buildMatchTimeline,
  buildPlayerRankDayCounts,
  buildRankingMovements,
  buildRankings,
  buildRankingsForMonth,
  buildRankingsThroughLocalDay,
  calculatePlayerRatingDelta,
  calculateMatchDelta,
  calculateStreakBreakerBonus,
  calculateWinStreakBonus,
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
    expect(getEffectiveKFactor(NEW_PLAYER_GAME_THRESHOLD)).toBe(100);
    expect(getEffectiveKFactor(STABLE_PLAYER_GAME_THRESHOLD - 1)).toBe(100);
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
  it("calculates softened loss penalties from the loser's rating gap and K factor", () => {
    const weakLosesToStrong = calculatePlayerRatingDelta({
      playerRating: 1500,
      opponentRating: 1900,
      playerKFactor: 100,
      actualScore: 0,
    });
    const strongLosesToWeak = calculatePlayerRatingDelta({
      playerRating: 1900,
      opponentRating: 1500,
      playerKFactor: 100,
      actualScore: 0,
    });

    // 弱输强：分差 -400，multiplier ≈ 0.32，扣分 ≈ -3
    expect(weakLosesToStrong).toBe(-3);
    // 强输弱：分差 +400，multiplier ≈ 0.68，扣分 ≈ -62
    expect(strongLosesToWeak).toBe(-62);
  });

  it("uses standard Elo winner gains and gap-scaled loss penalties in an even match", () => {
    const result = calculateMatchDelta(1500, 1500, { winnerKFactor: 100, loserKFactor: 100 });

    expect(result.winnerDelta).toBe(50);
    // 同分对局：multiplier = 0.5，扣分 = -25
    expect(result.loserDelta).toBe(-25);
    expect(result.winnerDelta + result.loserDelta).toBe(25);
  });

  it("scales both sides by their own K values", () => {
    const result = calculateMatchDelta(1500, 1500, { winnerKFactor: 150, loserKFactor: 50 });

    expect(result.winnerDelta).toBe(75);
    expect(result.loserDelta).toBe(-13);
  });

  it("gives favorites smaller gains and underdogs larger gains from the same Elo curve, with gap-scaled loser penalties", () => {
    const favoriteWin = calculateMatchDelta(1900, 1500, { winnerKFactor: 100, loserKFactor: 100 });
    const upsetWin = calculateMatchDelta(1500, 1900, { winnerKFactor: 100, loserKFactor: 100 });

    expect(favoriteWin.winnerDelta).toBe(9);
    expect(favoriteWin.loserDelta).toBe(-3); // 弱输强：扣分少 (multiplier ≈ 0.32)
    expect(upsetWin.winnerDelta).toBe(91);
    expect(upsetWin.loserDelta).toBe(-62); // 强输弱：扣分多 (multiplier ≈ 0.68)
    expect(Math.abs(favoriteWin.loserDelta)).toBeLessThan(Math.abs(upsetWin.loserDelta));
  });

  it("does not cap a single match when a very high K player wins a huge upset", () => {
    const result = calculateMatchDelta(1000, 2400, { winnerKFactor: 200, loserKFactor: 200 });

    expect(result.winnerDelta).toBeGreaterThan(160);
    expect(result.loserDelta).toBeLessThan(-80);
    expect(Math.abs(result.loserDelta)).toBeLessThan(result.winnerDelta);
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

  it("returns integer winner gains and loser losses without single-match caps", () => {
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
      expect(result.winnerDelta).toBeGreaterThanOrEqual(0);
      expect(result.loserDelta).toBeLessThanOrEqual(0);
    }
  });

  it("accepts a single numeric kFactor argument for backward compatibility", () => {
    const numeric = calculateMatchDelta(1500, 1500, 60);
    const opts = calculateMatchDelta(1500, 1500, { winnerKFactor: 60, loserKFactor: 60 });

    expect(numeric).toEqual(opts);
  });
});

describe("calculateStreakBreakerBonus", () => {
  it("starts at 3 defender wins, scales by the winner K factor, and has no cap", () => {
    expect(calculateStreakBreakerBonus(2, 100)).toBe(0);
    expect(calculateStreakBreakerBonus(3, 100)).toBe(5);
    expect(calculateStreakBreakerBonus(5, 100)).toBe(15);
    expect(calculateStreakBreakerBonus(10, 150)).toBe(60);
  });
});

describe("calculateWinStreakBonus", () => {
  it("starts when the winner reaches 3 wins, scales by the winner K factor, and has no cap", () => {
    expect(calculateWinStreakBonus(0, 100)).toBe(0);
    expect(calculateWinStreakBonus(1, 100)).toBe(0);
    expect(calculateWinStreakBonus(2, 100)).toBe(3);
    expect(calculateWinStreakBonus(4, 100)).toBe(9);
    expect(calculateWinStreakBonus(9, 100)).toBe(24);
    expect(calculateWinStreakBonus(2, 150)).toBe(5);
    expect(calculateWinStreakBonus(2, 50)).toBe(2);
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

    // m1: p1(1000) 胜 p2(1000), K=150, 同分 => p1: +75, p2: -37 (系数 0.50)
    // m2: p2(963) 胜 p1(1075), K=150 => p2: +98, p1: -55 (系数 0.556)
    expect(result.p1.rating).toBe(1020);
    expect(result.p2.rating).toBe(1061);
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

    // 移除 m2 后：m1 (p1 胜 p2)，m3 (p2 胜 p3)
    expect(withoutMiddle.p1.rating).toBe(1075);
    expect(withoutMiddle.p2.rating).toBe(1045);
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

  it("adds a K-scaled bonus only to the challenger when ending a 3+ win streak", () => {
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
        winnerId: "p1",
        loserId: "p2",
        createdAt: "2026-04-27T11:20:00.000Z",
      }),
      createMatch({
        id: "m4",
        winnerId: "p3",
        loserId: "p1",
        createdAt: "2026-04-27T11:30:00.000Z",
      }),
    ];

    const timeline = buildMatchTimeline(players, matches);
    const streakBreaker = timeline.find((entry) => entry.id === "m4");
    const beforeFinal = replayMatches(players, matches.slice(0, -1));
    const baseDelta = calculateMatchDelta(beforeFinal.p3.rating, beforeFinal.p1.rating, {
      winnerKFactor: getEffectiveKFactor(beforeFinal.p3.wins + beforeFinal.p3.losses),
      loserKFactor: getEffectiveKFactor(beforeFinal.p1.wins + beforeFinal.p1.losses),
    });

    expect(streakBreaker?.streakBreakerBonus).toBe(8);
    expect(streakBreaker?.winStreakBonus).toBe(0);
    expect(streakBreaker?.winnerDelta).toBe(baseDelta.winnerDelta + 8);
    expect(streakBreaker?.loserDelta).toBe(baseDelta.loserDelta);
    expect(streakBreaker?.winnerRatingAfter).toBe(
      beforeFinal.p3.rating + streakBreaker!.winnerDelta,
    );
    expect(streakBreaker?.loserRatingAfter).toBe(beforeFinal.p1.rating + baseDelta.loserDelta);

    const result = replayMatches(players, matches);

    expect(result.p3.rating).toBe(streakBreaker?.winnerRatingAfter);
    expect(result.p1.rating).toBe(streakBreaker?.loserRatingAfter);
  });

  it("adds a K-scaled bonus only to the winner when extending their own 3+ win streak", () => {
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
        winnerId: "p1",
        loserId: "p2",
        createdAt: "2026-04-27T11:20:00.000Z",
      }),
    ];

    const timeline = buildMatchTimeline(players, matches);
    const streakExtension = timeline.find((entry) => entry.id === "m3");
    const beforeFinal = replayMatches(players, matches.slice(0, -1));
    const baseDelta = calculateMatchDelta(beforeFinal.p1.rating, beforeFinal.p2.rating, {
      winnerKFactor: getEffectiveKFactor(beforeFinal.p1.wins + beforeFinal.p1.losses),
      loserKFactor: getEffectiveKFactor(beforeFinal.p2.wins + beforeFinal.p2.losses),
    });

    expect(streakExtension?.winStreakBonus).toBe(5);
    expect(streakExtension?.winnerDelta).toBe(baseDelta.winnerDelta + 5);
    expect(streakExtension?.loserDelta).toBe(baseDelta.loserDelta);

    const result = replayMatches(players, matches);

    expect(result.p1.rating).toBe(streakExtension?.winnerRatingAfter);
    expect(result.p2.rating).toBe(streakExtension?.loserRatingAfter);
  });

  it("stacks win-streak and streak-breaker bonuses without extra loser penalties", () => {
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
        winnerId: "p1",
        loserId: "p2",
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
      createMatch({
        id: "m6",
        winnerId: "p3",
        loserId: "p1",
        createdAt: "2026-04-27T11:50:00.000Z",
      }),
    ];

    const timeline = buildMatchTimeline(players, matches);
    const stackedBonusMatch = timeline.find((entry) => entry.id === "m6");
    const beforeFinal = replayMatches(players, matches.slice(0, -1));
    const baseDelta = calculateMatchDelta(beforeFinal.p3.rating, beforeFinal.p1.rating, {
      winnerKFactor: getEffectiveKFactor(beforeFinal.p3.wins + beforeFinal.p3.losses),
      loserKFactor: getEffectiveKFactor(beforeFinal.p1.wins + beforeFinal.p1.losses),
    });

    const winStreakBonus = calculateWinStreakBonus(
      beforeFinal.p3.currentWinStreak,
      getEffectiveKFactor(beforeFinal.p3.wins + beforeFinal.p3.losses),
    );

    expect(stackedBonusMatch?.winStreakBonus).toBe(winStreakBonus);
    expect(stackedBonusMatch?.streakBreakerBonus).toBe(8);
    expect(stackedBonusMatch?.winnerDelta).toBe(baseDelta.winnerDelta + winStreakBonus + 8);
    expect(stackedBonusMatch?.loserDelta).toBe(baseDelta.loserDelta);
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
    expect(snapshot[0].rating).toBe(1075);
    expect(snapshot[1].rating).toBe(962);
  });

  it("includes all active players in a monthly day snapshot", () => {
    const futurePlayer: Player = {
      id: "p4",
      name: "Dana",
      createdAt: "2026-04-28T10:00:00.000Z",
      isActive: true,
    };

    const snapshot = buildRankingsThroughLocalDay([...players, futurePlayer], [], "2026-04-27");

    expect(snapshot.map((entry) => entry.player.id)).toEqual(["p1", "p2", "p3", "p4"]);
  });
});

describe("monthly season rankings", () => {
  it("resets ratings and records between natural months", () => {
    const matches: MatchRecord[] = [
      createMatch({
        id: "m1",
        winnerId: "p1",
        loserId: "p2",
        createdAt: "2026-04-30T11:00:00.000Z",
      }),
      createMatch({
        id: "m2",
        winnerId: "p2",
        loserId: "p1",
        createdAt: "2026-05-01T11:00:00.000Z",
      }),
    ];

    const april = buildRankingsForMonth(players.slice(0, 2), matches, "2026-04");
    const may = buildRankingsForMonth(players.slice(0, 2), matches, "2026-05");

    expect(april.map((entry) => [entry.player.id, entry.rating, entry.wins, entry.losses])).toEqual([
      ["p1", 1075, 1, 0],
      ["p2", 962, 0, 1],
    ]);
    expect(may.map((entry) => [entry.player.id, entry.rating, entry.wins, entry.losses])).toEqual([
      ["p2", 1075, 1, 0],
      ["p1", 962, 0, 1],
    ]);
  });

  it("includes active players with no monthly matches at 1000", () => {
    const rankings = buildRankingsForMonth(players, [], "2026-05");

    expect(rankings.map((entry) => [entry.player.id, entry.rating, entry.wins, entry.losses])).toEqual([
      ["p1", 1000, 0, 0],
      ["p2", 1000, 0, 0],
      ["p3", 1000, 0, 0],
    ]);
  });

  it("keeps month-end snapshots on the last match day of each month", () => {
    const matches: MatchRecord[] = [
      createMatch({
        id: "m1",
        winnerId: "p1",
        loserId: "p2",
        createdAt: "2026-04-15T11:00:00.000Z",
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
        createdAt: "2026-05-03T11:00:00.000Z",
      }),
    ];

    const snapshots = buildMonthlyRankingSnapshots(players, matches);

    expect(snapshots.map((snapshot) => [snapshot.monthKey, snapshot.snapshotDateKey])).toEqual([
      ["2026-05", "2026-05-03"],
      ["2026-04", "2026-04-28"],
    ]);
    // 2026-04 月末: m1 后 p2(963), m2 后 p1(1020), p2(1061)
    expect(snapshots[1].rankings.map((entry) => [entry.player.id, entry.rating])).toEqual([
      ["p2", 1061],
      ["p1", 1020],
      ["p3", 1000],
    ]);
  });

  it("resets match timeline deltas at month boundaries while keeping full history", () => {
    const matches: MatchRecord[] = [
      createMatch({
        id: "m1",
        winnerId: "p1",
        loserId: "p2",
        createdAt: "2026-04-30T11:00:00.000Z",
      }),
      createMatch({
        id: "m2",
        winnerId: "p2",
        loserId: "p1",
        createdAt: "2026-05-01T11:00:00.000Z",
      }),
    ];

    const timeline = buildMatchTimeline(players.slice(0, 2), matches);

    expect(timeline.map((entry) => [entry.id, entry.winnerDelta, entry.loserDelta])).toEqual([
      ["m2", 75, -38],
      ["m1", 75, -38],
    ]);
    expect(timeline[0].winnerRatingAfter).toBe(1075);
    expect(timeline[0].loserRatingAfter).toBe(962);
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
      p1: { topDays: 1, bottomDays: 0 },
      p2: { topDays: 1, bottomDays: 2 },
      p3: { topDays: 1, bottomDays: 1 },
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
