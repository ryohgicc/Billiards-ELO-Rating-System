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

function roundRatingDelta(delta: number) {
  return delta < 0 ? -Math.round(Math.abs(delta)) : Math.round(delta);
}

export const NEW_PLAYER_K_FACTOR = 150;
export const STABLE_PLAYER_K_FACTOR = 50;
export const NEW_PLAYER_GAME_THRESHOLD = 10;
export const STABLE_PLAYER_GAME_THRESHOLD = 30;

/**
 * 根据分差计算败者扣分系数。
 * 
 * 设计理念：
 * - 弱者输给强者 → 扣分少（系数小，如 0.1）
 * - 强者输给弱者 → 扣分多（系数大，如 0.9）
 * - 实力相当 → 扣分适中（系数 0.5）
 * 
 * @param loserRating 败者赛前积分
 * @param winnerRating 胜者赛前积分
 * @returns 扣分系数，范围约为 [0.1, 0.9]
 */
export function getLossPenaltyMultiplier(loserRating: number, winnerRating: number): number {
  const gap = loserRating - winnerRating; // 正值 = 败者原本更强，负值 = 败者原本更弱
  
  // 使用 sigmoid 曲线：gap 越负（弱输强）系数越小，gap 越正（强输弱）系数越大
  // 中心值 0.5（实力相当），范围约 [0.1, 0.9]
  // 400 分差时系数变化约 ±0.35
  const scaleFactor = 400; // 控制曲线陡峭度
  const sigmoid = 1 / (1 + Math.exp(-gap / scaleFactor));
  
  // 映射到 [0.1, 0.9] 区间
  const minMultiplier = 0.1;
  const maxMultiplier = 0.9;
  return minMultiplier + sigmoid * (maxMultiplier - minMultiplier);
}

/**
 * 根据球员赛前已完成的比赛总场数返回分段 K 值。借鉴 FIDE 国际象棋分级 K 因子思路：
 * 新人变化大、稳定老手变化小，以减少偶发结果对长期段位的扰动。
 */
export function getEffectiveKFactor(
  totalMatchesBefore: number,
  baseKFactor = DEFAULT_K_FACTOR,
) {
  if (totalMatchesBefore < NEW_PLAYER_GAME_THRESHOLD) {
    return NEW_PLAYER_K_FACTOR;
  }
  if (totalMatchesBefore >= STABLE_PLAYER_GAME_THRESHOLD) {
    return STABLE_PLAYER_K_FACTOR;
  }
  return baseKFactor;
}

export type MatchDeltaOptions = {
  winnerKFactor?: number;
  loserKFactor?: number;
};

export type PlayerRatingDeltaOptions = {
  playerRating: number;
  opponentRating: number;
  playerKFactor: number;
  actualScore: 0 | 1;
};

export function calculatePlayerRatingDelta({
  playerRating,
  opponentRating,
  playerKFactor,
  actualScore,
}: PlayerRatingDeltaOptions) {
  const expectedScore = getExpectedScore(playerRating, opponentRating);
  
  let multiplier = 1;
  if (actualScore === 0) {
    // 败者：根据分差动态计算扣分系数
    multiplier = getLossPenaltyMultiplier(playerRating, opponentRating);
  }

  return roundRatingDelta(playerKFactor * (actualScore - expectedScore) * multiplier);
}

export function calculateMatchDelta(
  winnerRating: number,
  loserRating: number,
  kFactorOrOptions: number | MatchDeltaOptions = DEFAULT_K_FACTOR,
) {
  const winnerKFactor =
    typeof kFactorOrOptions === "number"
      ? kFactorOrOptions
      : kFactorOrOptions.winnerKFactor ?? DEFAULT_K_FACTOR;
  const loserKFactor =
    typeof kFactorOrOptions === "number"
      ? kFactorOrOptions
      : kFactorOrOptions.loserKFactor ?? DEFAULT_K_FACTOR;

  return {
    winnerDelta: calculatePlayerRatingDelta({
      playerRating: winnerRating,
      opponentRating: loserRating,
      playerKFactor: winnerKFactor,
      actualScore: 1,
    }),
    loserDelta: calculatePlayerRatingDelta({
      playerRating: loserRating,
      opponentRating: winnerRating,
      playerKFactor: loserKFactor,
      actualScore: 0,
    }),
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

    const winnerKFactor = getEffectiveKFactor(winner.wins + winner.losses, kFactor);
    const loserKFactor = getEffectiveKFactor(loser.wins + loser.losses, kFactor);
    const delta = calculateMatchDelta(winner.rating, loser.rating, {
      winnerKFactor,
      loserKFactor,
    });

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

export function getLocalDateKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getLocalMonthKey(value: string) {
  return getLocalDateKey(value).slice(0, 7);
}

function filterMatchesForMonth(matches: MatchRecord[], monthKey: string) {
  return matches.filter((match) => getLocalMonthKey(match.createdAt) === monthKey);
}

export function getCurrentLocalMonthKey(date = new Date()) {
  return getLocalMonthKey(date.toISOString());
}

export function buildRankingsForMonth(
  players: Player[],
  matches: MatchRecord[],
  monthKey: string,
  kFactor = DEFAULT_K_FACTOR,
) {
  return buildRankings(players, filterMatchesForMonth(matches, monthKey), kFactor);
}

export function buildRankingsThroughLocalDay(
  players: Player[],
  matches: MatchRecord[],
  dateKey: string,
  kFactor = DEFAULT_K_FACTOR,
): RankingEntry[] {
  const monthKey = dateKey.slice(0, 7);

  return buildRankings(
    players,
    matches.filter(
      (match) => getLocalMonthKey(match.createdAt) === monthKey && getLocalDateKey(match.createdAt) <= dateKey,
    ),
    kFactor,
  );
}

export type MonthlyRankingSnapshot = {
  monthKey: string;
  monthLabel: string;
  snapshotDateKey: string;
  rankings: RankingEntry[];
};

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  return `${year}年${Number(month)}月`;
}

export function buildMonthlyRankingSnapshots(
  players: Player[],
  matches: MatchRecord[],
  kFactor = DEFAULT_K_FACTOR,
): MonthlyRankingSnapshot[] {
  const snapshotsByMonth = new Map<string, string>();

  for (const match of matches) {
    const monthKey = getLocalMonthKey(match.createdAt);
    const dateKey = getLocalDateKey(match.createdAt);
    const previous = snapshotsByMonth.get(monthKey);

    if (!previous || dateKey > previous) {
      snapshotsByMonth.set(monthKey, dateKey);
    }
  }

  return [...snapshotsByMonth.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([monthKey, snapshotDateKey]) => ({
      monthKey,
      monthLabel: formatMonthLabel(monthKey),
      snapshotDateKey,
      rankings: buildRankingsThroughLocalDay(players, matches, snapshotDateKey, kFactor),
    }));
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
  let stats = createInitialStats(players);
  let activeMonthKey = "";
  const playerMap = Object.fromEntries(players.map((player) => [player.id, player]));

  return [...matches]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((match) => {
      const monthKey = getLocalMonthKey(match.createdAt);

      if (monthKey !== activeMonthKey) {
        stats = createInitialStats(players);
        activeMonthKey = monthKey;
      }

      const winner = stats[match.winnerId];
      const loser = stats[match.loserId];
      const winnerPlayer = playerMap[match.winnerId];
      const loserPlayer = playerMap[match.loserId];

      if (!winner || !loser || !winnerPlayer || !loserPlayer) {
        return null;
      }

      const winnerKFactor = getEffectiveKFactor(winner.wins + winner.losses, kFactor);
      const loserKFactor = getEffectiveKFactor(loser.wins + loser.losses, kFactor);
      const delta = calculateMatchDelta(winner.rating, loser.rating, {
        winnerKFactor,
        loserKFactor,
      });
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
