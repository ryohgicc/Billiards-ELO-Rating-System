import { DEFAULT_K_FACTOR, DEFAULT_RATING } from "@/lib/constants";
import type {
  MatchRecord,
  MatchTimelineEntry,
  Player,
  PlayerStats,
  RankingEntry,
} from "@/lib/types";

function getExpectedScore(playerRating: number, opponentRating: number) {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
}

export function calculateMatchDelta(
  winnerRating: number,
  loserRating: number,
  kFactor = DEFAULT_K_FACTOR,
) {
  const winnerExpectedScore = getExpectedScore(winnerRating, loserRating);
  const baseDelta = kFactor * (1 - winnerExpectedScore);
  const upsetGap = Math.max(0, loserRating - winnerRating);
  const upsetMultiplier = 1 + Math.min(1.2, 0.75 * (upsetGap / 400) ** 1.15);
  const winnerDelta = Math.round(Math.min(160, Math.max(5, baseDelta * upsetMultiplier)));

  return {
    winnerDelta,
    loserDelta: -winnerDelta,
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
