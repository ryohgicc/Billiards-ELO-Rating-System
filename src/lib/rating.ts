import { DEFAULT_K_FACTOR, DEFAULT_RATING } from "@/lib/constants";
import type {
  MatchRecord,
  MatchTimelineEntry,
  Player,
  PlayerStats,
  RankingEntry,
  RankingMovement,
} from "@/lib/types";

function getExpectedScore(playerRating: number, opponentRating: number) {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
}

const SINGLE_MATCH_CAP = 160;
const EVEN_MATCH_WINNER_DELTA = 30;
const HEAVY_FAVORITE_WINNER_FLOOR = 15;
const FAVORITE_DECAY_PER_RATING_POINT = 0.0375;
const FAVORITE_LOSER_MIN_PENALTY = 5;
const FAVORITE_LOSER_MAX_PENALTY = 30;
const UPSET_GAP_THRESHOLD = 200;
const HEAVY_UPSET_GAP_THRESHOLD = 400;
const UPSET_WINNER_FLOOR = 50;
const HEAVY_UPSET_WINNER_FLOOR = 80;
const UPSET_LOSER_PENALTY_FLOOR = 25;
const HEAVY_UPSET_LOSER_PENALTY_FLOOR = 40;
const UPSET_WINNER_MULTIPLIER_CAP = 0.75;
const UPSET_WINNER_MULTIPLIER_SCALE = 0.6;
const UPSET_LOSER_MULTIPLIER_CAP = 1.0;
const UPSET_LOSER_MULTIPLIER_SCALE = 0.75;
const UPSET_MULTIPLIER_EXPONENT = 1.15;
const UPSET_LOSER_RELATIVE_CAP = 1.15;

export function calculateMatchDelta(
  winnerRating: number,
  loserRating: number,
  kFactor = DEFAULT_K_FACTOR,
) {
  const winnerLoserGap = winnerRating - loserRating;
  const winnerExpected = getExpectedScore(winnerRating, loserRating);
  const loserExpected = 1 - winnerExpected;

  let rawWinner: number;
  let rawLoser: number;

  if (winnerLoserGap >= 0) {
    // 强者赢或同分：胜方加分按线性衰减，败方扣分用标准 Elo 但收缩到温和惩罚区间
    const decayed = EVEN_MATCH_WINNER_DELTA - winnerLoserGap * FAVORITE_DECAY_PER_RATING_POINT;
    rawWinner = Math.max(HEAVY_FAVORITE_WINNER_FLOOR, decayed);

    const symmetricLoser = -kFactor * loserExpected;
    rawLoser = Math.max(
      -FAVORITE_LOSER_MAX_PENALTY,
      Math.min(-FAVORITE_LOSER_MIN_PENALTY, symmetricLoser),
    );
  } else {
    // 爆冷：胜方按上调倍率获得高额奖励，败方按上调倍率被加重惩罚
    const upsetGap = -winnerLoserGap;
    const normalizedGap = upsetGap / HEAVY_UPSET_GAP_THRESHOLD;
    const upsetCurve = Math.pow(normalizedGap, UPSET_MULTIPLIER_EXPONENT);

    const winnerMultiplier =
      1 + Math.min(UPSET_WINNER_MULTIPLIER_CAP, UPSET_WINNER_MULTIPLIER_SCALE * upsetCurve);
    const loserPenaltyMultiplier =
      1 + Math.min(UPSET_LOSER_MULTIPLIER_CAP, UPSET_LOSER_MULTIPLIER_SCALE * upsetCurve);

    rawWinner = kFactor * (1 - winnerExpected) * winnerMultiplier;
    rawLoser = -kFactor * loserExpected * loserPenaltyMultiplier;

    if (upsetGap >= HEAVY_UPSET_GAP_THRESHOLD) {
      rawWinner = Math.max(HEAVY_UPSET_WINNER_FLOOR, rawWinner);
      rawLoser = Math.min(-HEAVY_UPSET_LOSER_PENALTY_FLOOR, rawLoser);
    } else if (upsetGap >= UPSET_GAP_THRESHOLD) {
      rawWinner = Math.max(UPSET_WINNER_FLOOR, rawWinner);
      rawLoser = Math.min(-UPSET_LOSER_PENALTY_FLOOR, rawLoser);
    }

    // 守恒约束：败方扣分最多比胜方加分高 15%，避免爆冷败方惩罚远超胜方奖励
    rawLoser = Math.max(-rawWinner * UPSET_LOSER_RELATIVE_CAP, rawLoser);
  }

  const cappedWinner = Math.min(SINGLE_MATCH_CAP, Math.max(1, rawWinner));
  const cappedLoser = Math.max(-SINGLE_MATCH_CAP, Math.min(0, rawLoser));

  return {
    winnerDelta: Math.round(cappedWinner),
    loserDelta: Math.round(cappedLoser),
  };
}

function createInitialStats(players: Player[]) {
  return players.reduce<Record<string, PlayerStats>>((accumulator, player) => {
    accumulator[player.id] = {
      player,
      rating: DEFAULT_RATING,
      wins: 0,
      losses: 0,
      currentWinStreak: 0,
      currentLossStreak: 0,
      bestWinStreak: 0,
      worstLossStreak: 0,
      lastMatchAt: undefined,
    };

    return accumulator;
  }, {});
}

export function replayMatches(
  players: Player[],
  matches: MatchRecord[],
  kFactor = DEFAULT_K_FACTOR,
) {
  const stats = createInitialStats(players);
  const sortedMatches = [...matches].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );

  for (const match of sortedMatches) {
    const winner = stats[match.winnerId];
    const loser = stats[match.loserId];

    if (!winner || !loser) {
      continue;
    }

    const delta = calculateMatchDelta(winner.rating, loser.rating, kFactor);

    winner.rating += delta.winnerDelta;
    winner.wins += 1;
    winner.currentWinStreak += 1;
    winner.currentLossStreak = 0;
    winner.bestWinStreak = Math.max(winner.bestWinStreak, winner.currentWinStreak);
    winner.lastMatchAt = match.createdAt;

    loser.rating += delta.loserDelta;
    loser.losses += 1;
    loser.currentLossStreak += 1;
    loser.currentWinStreak = 0;
    loser.worstLossStreak = Math.max(loser.worstLossStreak, loser.currentLossStreak);
    loser.lastMatchAt = match.createdAt;
  }

  return stats;
}

export function buildRankings(
  players: Player[],
  matches: MatchRecord[],
  kFactor = DEFAULT_K_FACTOR,
): RankingEntry[] {
  const stats = Object.values(replayMatches(players, matches, kFactor))
    .filter((entry) => entry.player.isActive)
    .map((entry) => {
      const total = entry.wins + entry.losses;
      const winRate = total === 0 ? 0 : entry.wins / total;

      return {
        ...entry,
        winRate,
        rank: 0,
      };
    })
    .sort((left, right) => {
      if (right.rating !== left.rating) {
        return right.rating - left.rating;
      }

      if (right.winRate !== left.winRate) {
        return right.winRate - left.winRate;
      }

      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }

      return left.player.createdAt.localeCompare(right.player.createdAt);
    });

  return stats.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

function getLocalDateKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function buildRankingsThroughLocalDay(
  players: Player[],
  matches: MatchRecord[],
  dateKey: string,
  kFactor = DEFAULT_K_FACTOR,
): RankingEntry[] {
  return buildRankings(
    players.filter((player) => getLocalDateKey(player.createdAt) <= dateKey),
    matches.filter((match) => getLocalDateKey(match.createdAt) <= dateKey),
    kFactor,
  );
}

export type PlayerRankDayCounts = {
  topDays: number;
  bottomDays: number;
};

export function buildPlayerRankDayCounts(
  players: Player[],
  matches: MatchRecord[],
  kFactor = DEFAULT_K_FACTOR,
): Record<string, PlayerRankDayCounts> {
  const counts = players.reduce<Record<string, PlayerRankDayCounts>>((accumulator, player) => {
    accumulator[player.id] = {
      topDays: 0,
      bottomDays: 0,
    };

    return accumulator;
  }, {});
  const matchDateKeys = [...new Set(matches.map((match) => getLocalDateKey(match.createdAt)))].sort();

  for (const dateKey of matchDateKeys) {
    const rankings = buildRankingsThroughLocalDay(players, matches, dateKey, kFactor);
    const topPlayerId = rankings[0]?.player.id;
    const bottomPlayerId = rankings.at(-1)?.player.id;

    if (topPlayerId && counts[topPlayerId]) {
      counts[topPlayerId].topDays += 1;
    }

    if (bottomPlayerId && counts[bottomPlayerId]) {
      counts[bottomPlayerId].bottomDays += 1;
    }
  }

  return counts;
}

export function buildRankingMovements(
  currentRankings: Array<Pick<RankingEntry, "player" | "rank">>,
  previousRankings: Array<Pick<RankingEntry, "player" | "rank">> | null,
): Record<string, RankingMovement> {
  const previousRanks = new Map(
    previousRankings?.map((entry) => [entry.player.id, entry.rank]) ?? [],
  );

  return currentRankings.reduce<Record<string, RankingMovement>>((movements, entry) => {
    const previousRank = previousRanks.get(entry.player.id);

    if (!previousRankings) {
      movements[entry.player.id] = { status: "same", places: 0 };
      return movements;
    }

    if (previousRank === undefined) {
      movements[entry.player.id] = { status: "new", places: 0 };
      return movements;
    }

    const places = previousRank - entry.rank;

    if (places > 0) {
      movements[entry.player.id] = { status: "up", places };
    } else if (places < 0) {
      movements[entry.player.id] = { status: "down", places: Math.abs(places) };
    } else {
      movements[entry.player.id] = { status: "same", places: 0 };
    }

    return movements;
  }, {});
}

export function getPreviousRankingDateKey(
  dailyGroups: Array<{ dateKey: string }>,
  selectedViewKey: string,
) {
  const selectedIndex = selectedViewKey === "overall"
    ? 0
    : dailyGroups.findIndex((group) => group.dateKey === selectedViewKey);

  if (selectedIndex < 0) {
    return null;
  }

  return dailyGroups[selectedIndex + 1]?.dateKey ?? null;
}

export function buildMatchTimeline(
  players: Player[],
  matches: MatchRecord[],
  kFactor = DEFAULT_K_FACTOR,
): MatchTimelineEntry[] {
  const stats = createInitialStats(players);
  const playerMap = Object.fromEntries(players.map((player) => [player.id, player]));

  return [...matches]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((match) => {
      const winner = stats[match.winnerId];
      const loser = stats[match.loserId];
      const winnerPlayer = playerMap[match.winnerId];
      const loserPlayer = playerMap[match.loserId];

      if (!winner || !loser || !winnerPlayer || !loserPlayer) {
        return null;
      }

      const delta = calculateMatchDelta(winner.rating, loser.rating, kFactor);
      const entry: MatchTimelineEntry = {
        ...match,
        winnerName: winnerPlayer.name,
        loserName: loserPlayer.name,
        winnerDelta: delta.winnerDelta,
        loserDelta: delta.loserDelta,
        winnerRatingAfter: winner.rating + delta.winnerDelta,
        loserRatingAfter: loser.rating + delta.loserDelta,
      };

      winner.rating += delta.winnerDelta;
      winner.wins += 1;
      winner.currentWinStreak += 1;
      winner.currentLossStreak = 0;
      winner.bestWinStreak = Math.max(winner.bestWinStreak, winner.currentWinStreak);
      winner.lastMatchAt = match.createdAt;
      loser.rating += delta.loserDelta;
      loser.losses += 1;
      loser.currentLossStreak += 1;
      loser.currentWinStreak = 0;
      loser.worstLossStreak = Math.max(loser.worstLossStreak, loser.currentLossStreak);
      loser.lastMatchAt = match.createdAt;

      return entry;
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .reverse();
}
