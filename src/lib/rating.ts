import { DEFAULT_K_FACTOR, DEFAULT_RATING } from "@/lib/constants";
import type {
  MatchRecord,
  MatchTimelineEntry,
  MonthlyPlayerRating,
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
export const CALIBRATION_GAME_COUNT = 5;
export const CALIBRATION_K_FACTOR = 150;
export const FORMAL_K_FACTOR = 100;
export const HIDDEN_RATING_WEIGHTS = [0.5, 0.3, 0.2] as const;

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

export function calculateStreakBreakerBonus(defenderWinStreak: number, winnerKFactor: number) {
  if (defenderWinStreak < 3) {
    return 0;
  }

  return Math.round(winnerKFactor * 0.05 * (defenderWinStreak - 2));
}

export function calculateWinStreakBonus(winnerWinStreakBefore: number, winnerKFactor: number) {
  if (winnerWinStreakBefore < 2) {
    return 0;
  }

  return Math.round(winnerKFactor * 0.03 * (winnerWinStreakBefore - 1));
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

function createInitialMonthlyStats(
  players: Player[],
  seedHiddenRatings: Record<string, number>,
  monthKey: string,
) {
  return players.reduce<Record<string, MonthlyPlayerRating>>((accumulator, player) => {
    const seedHiddenRating = seedHiddenRatings[player.id] ?? DEFAULT_RATING;

    accumulator[player.id] = {
      player,
      monthKey,
      seedHiddenRating,
      calibratedRating: seedHiddenRating,
      calibrationMatches: 0,
      formalStartRating: null,
      isCalibrated: false,
      formalRatingDelta: 0,
      rating: seedHiddenRating,
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

function getVisibleRating(entry: MonthlyPlayerRating) {
  return entry.isCalibrated ? entry.rating : entry.calibratedRating;
}

function calculateCalibrationDelta(playerRating: number, opponentRating: number, actualScore: 0 | 1) {
  return roundRatingDelta(
    CALIBRATION_K_FACTOR * (actualScore - getExpectedScore(playerRating, opponentRating)),
  );
}

function finalizeCalibration(entry: MonthlyPlayerRating) {
  if (entry.isCalibrated || entry.calibrationMatches < CALIBRATION_GAME_COUNT) {
    return;
  }

  entry.formalStartRating = Math.round(
    entry.seedHiddenRating * 0.4 + entry.calibratedRating * 0.6,
  );
  entry.rating = entry.formalStartRating;
  entry.isCalibrated = true;
}

function getWeightedHiddenSeed(monthEndRatings: number[]) {
  let weightedTotal = 0;
  let totalWeight = 0;

  for (let index = 0; index < HIDDEN_RATING_WEIGHTS.length; index += 1) {
    const rating = monthEndRatings[monthEndRatings.length - 1 - index];

    if (rating === undefined) {
      continue;
    }

    const weight = HIDDEN_RATING_WEIGHTS[index];
    weightedTotal += rating * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weightedTotal / totalWeight) : DEFAULT_RATING;
}

function updateStreaks(winner: PlayerStats, loser: PlayerStats, createdAt: string) {
  winner.wins += 1;
  winner.currentWinStreak += 1;
  winner.currentLossStreak = 0;
  winner.bestWinStreak = Math.max(winner.bestWinStreak, winner.currentWinStreak);
  winner.lastMatchAt = createdAt;

  loser.losses += 1;
  loser.currentLossStreak += 1;
  loser.currentWinStreak = 0;
  loser.worstLossStreak = Math.max(loser.worstLossStreak, loser.currentLossStreak);
  loser.lastMatchAt = createdAt;
}

function applyMonthlyMatch(
  winner: MonthlyPlayerRating,
  loser: MonthlyPlayerRating,
  createdAt: string,
) {
  const winnerWasCalibrated = winner.isCalibrated;
  const loserWasCalibrated = loser.isCalibrated;
  const winnerRatingBefore = getVisibleRating(winner);
  const loserRatingBefore = getVisibleRating(loser);

  if (!winnerWasCalibrated) {
    const winnerCalibrationDelta = calculateCalibrationDelta(
      winnerRatingBefore,
      loserRatingBefore,
      1,
    );

    winner.calibratedRating += winnerCalibrationDelta;
    winner.calibrationMatches += 1;
  }

  if (!loserWasCalibrated) {
    const loserCalibrationDelta = calculateCalibrationDelta(
      loserRatingBefore,
      winnerRatingBefore,
      0,
    );

    loser.calibratedRating += loserCalibrationDelta;
    loser.calibrationMatches += 1;
  }

  finalizeCalibration(winner);
  finalizeCalibration(loser);

  if (winnerWasCalibrated) {
    const delta = calculateMatchDelta(winnerRatingBefore, loserRatingBefore, FORMAL_K_FACTOR);
    const streakBreakerBonus = calculateStreakBreakerBonus(
      loser.currentWinStreak,
      FORMAL_K_FACTOR,
    );
    const winStreakBonus = calculateWinStreakBonus(winner.currentWinStreak, FORMAL_K_FACTOR);
    const winnerDelta = delta.winnerDelta + streakBreakerBonus + winStreakBonus;

    winner.rating += winnerDelta;
    winner.formalRatingDelta += winnerDelta;
  }

  if (loserWasCalibrated) {
    const delta = calculateMatchDelta(winnerRatingBefore, loserRatingBefore, FORMAL_K_FACTOR);

    loser.rating += delta.loserDelta;
    loser.formalRatingDelta += delta.loserDelta;
  }

  updateStreaks(winner, loser, createdAt);
}

function buildMonthlyRatingState(
  players: Player[],
  matches: MatchRecord[],
) {
  const sortedMatches = [...matches].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
  const monthKeys = [...new Set(sortedMatches.map((match) => getLocalMonthKey(match.createdAt)))].sort();
  const monthEndRatingHistory = players.reduce<Record<string, number[]>>((accumulator, player) => {
    accumulator[player.id] = [];
    return accumulator;
  }, {});
  const monthlyStatsByMonth: Record<string, Record<string, MonthlyPlayerRating>> = {};

  for (const monthKey of monthKeys) {
    const seedHiddenRatings = players.reduce<Record<string, number>>((accumulator, player) => {
      accumulator[player.id] = getWeightedHiddenSeed(monthEndRatingHistory[player.id] ?? []);
      return accumulator;
    }, {});
    const stats = createInitialMonthlyStats(players, seedHiddenRatings, monthKey);

    for (const match of sortedMatches.filter((entry) => getLocalMonthKey(entry.createdAt) === monthKey)) {
      const winner = stats[match.winnerId];
      const loser = stats[match.loserId];

      if (!winner || !loser) {
        continue;
      }

      applyMonthlyMatch(winner, loser, match.createdAt);
    }

    monthlyStatsByMonth[monthKey] = stats;

    for (const player of players) {
      const entry = stats[player.id];

      if (entry && entry.wins + entry.losses > 0) {
        monthEndRatingHistory[player.id].push(getVisibleRating(entry));
      }
    }
  }

  return monthlyStatsByMonth;
}

export function buildMonthlyPlayerRatings(
  players: Player[],
  matches: MatchRecord[],
) {
  return buildMonthlyRatingState(players, matches);
}

export function getMonthlyPlayerRating(
  players: Player[],
  matches: MatchRecord[],
  monthKey: string,
) {
  return buildMonthlyRatingState(players, matches)[monthKey] ?? createInitialMonthlyStats(
    players,
    players.reduce<Record<string, number>>((accumulator, player) => {
      accumulator[player.id] = DEFAULT_RATING;
      return accumulator;
    }, {}),
    monthKey,
  );
}

export function replayMatches(
  players: Player[],
  matches: MatchRecord[],
  kFactor = DEFAULT_K_FACTOR,
) {
  void kFactor;

  if (matches.length === 0) {
    return createInitialStats(players);
  }

  const monthKey = getLocalMonthKey(
    [...matches].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0].createdAt,
  );
  const monthlyStats = getMonthlyPlayerRating(players, matches, monthKey);

  return players.reduce<Record<string, PlayerStats>>((accumulator, player) => {
    const entry = monthlyStats[player.id];

    accumulator[player.id] = {
      player,
      rating: entry ? getVisibleRating(entry) : DEFAULT_RATING,
      wins: entry?.wins ?? 0,
      losses: entry?.losses ?? 0,
      currentWinStreak: entry?.currentWinStreak ?? 0,
      currentLossStreak: entry?.currentLossStreak ?? 0,
      bestWinStreak: entry?.bestWinStreak ?? 0,
      worstLossStreak: entry?.worstLossStreak ?? 0,
      lastMatchAt: entry?.lastMatchAt,
    };

    return accumulator;
  }, {});
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

export function getCurrentLocalMonthKey(date = new Date()) {
  return getLocalMonthKey(date.toISOString());
}

export function buildRankingsForMonth(
  players: Player[],
  matches: MatchRecord[],
  monthKey: string,
  kFactor = DEFAULT_K_FACTOR,
) {
  void kFactor;

  const monthlyStats = getMonthlyPlayerRating(players, matches, monthKey);

  return Object.values(monthlyStats)
    .filter((entry) => entry.player.isActive)
    .map((entry) => {
      const total = entry.wins + entry.losses;
      const winRate = total === 0 ? 0 : entry.wins / total;

      return {
        player: entry.player,
        rating: getVisibleRating(entry),
        wins: entry.wins,
        losses: entry.losses,
        currentWinStreak: entry.currentWinStreak,
        currentLossStreak: entry.currentLossStreak,
        bestWinStreak: entry.bestWinStreak,
        worstLossStreak: entry.worstLossStreak,
        lastMatchAt: entry.lastMatchAt,
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
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

export function buildRankingsThroughLocalDay(
  players: Player[],
  matches: MatchRecord[],
  dateKey: string,
  kFactor = DEFAULT_K_FACTOR,
): RankingEntry[] {
  void kFactor;

  return buildRankingsForMonth(
    players,
    matches.filter((match) => getLocalDateKey(match.createdAt) <= dateKey),
    dateKey.slice(0, 7),
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
  void kFactor;

  let activeMonthKey = "";
  let stats = createInitialMonthlyStats(
    players,
    players.reduce<Record<string, number>>((accumulator, player) => {
      accumulator[player.id] = DEFAULT_RATING;
      return accumulator;
    }, {}),
    "",
  );
  const monthEndRatingHistory = players.reduce<Record<string, number[]>>((accumulator, player) => {
    accumulator[player.id] = [];
    return accumulator;
  }, {});
  const playerMap = Object.fromEntries(players.map((player) => [player.id, player]));
  const sortedMatches = [...matches].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  function closeActiveMonth() {
    if (!activeMonthKey) {
      return;
    }

    for (const player of players) {
      const entry = stats[player.id];

      if (entry && entry.wins + entry.losses > 0) {
        monthEndRatingHistory[player.id].push(getVisibleRating(entry));
      }
    }
  }

  const timeline = sortedMatches
    .map((match) => {
      const monthKey = getLocalMonthKey(match.createdAt);

      if (monthKey !== activeMonthKey) {
        closeActiveMonth();
        const seedHiddenRatings = players.reduce<Record<string, number>>((accumulator, player) => {
          accumulator[player.id] = getWeightedHiddenSeed(monthEndRatingHistory[player.id] ?? []);
          return accumulator;
        }, {});

        stats = createInitialMonthlyStats(players, seedHiddenRatings, monthKey);
        activeMonthKey = monthKey;
      }

      const winner = stats[match.winnerId];
      const loser = stats[match.loserId];
      const winnerPlayer = playerMap[match.winnerId];
      const loserPlayer = playerMap[match.loserId];

      if (!winner || !loser || !winnerPlayer || !loserPlayer) {
        return null;
      }

      const winnerWasCalibrated = winner.isCalibrated;
      const loserWasCalibrated = loser.isCalibrated;
      const winnerRatingBefore = getVisibleRating(winner);
      const loserRatingBefore = getVisibleRating(loser);
      let winnerDelta = 0;
      let loserDelta = 0;
      let streakBreakerBonus = 0;
      let winStreakBonus = 0;

      if (winnerWasCalibrated) {
        const delta = calculateMatchDelta(winnerRatingBefore, loserRatingBefore, FORMAL_K_FACTOR);
        streakBreakerBonus = calculateStreakBreakerBonus(
          loser.currentWinStreak,
          FORMAL_K_FACTOR,
        );
        winStreakBonus = calculateWinStreakBonus(winner.currentWinStreak, FORMAL_K_FACTOR);
        winnerDelta = delta.winnerDelta + streakBreakerBonus + winStreakBonus;
      } else {
        winnerDelta = calculateCalibrationDelta(winnerRatingBefore, loserRatingBefore, 1);
      }

      if (loserWasCalibrated) {
        loserDelta = calculateMatchDelta(
          winnerRatingBefore,
          loserRatingBefore,
          FORMAL_K_FACTOR,
        ).loserDelta;
      } else {
        loserDelta = calculateCalibrationDelta(loserRatingBefore, winnerRatingBefore, 0);
      }

      const winnerRatingAfter = winnerWasCalibrated
        ? winner.rating + winnerDelta
        : winner.calibratedRating + winnerDelta;
      const loserRatingAfter = loserWasCalibrated
        ? loser.rating + loserDelta
        : loser.calibratedRating + loserDelta;
      const entry: MatchTimelineEntry = {
        ...match,
        winnerName: winnerPlayer.name,
        loserName: loserPlayer.name,
        winnerDelta,
        loserDelta,
        streakBreakerBonus,
        winStreakBonus,
        winnerRatingAfter,
        loserRatingAfter,
      };

      applyMonthlyMatch(winner, loser, match.createdAt);

      return entry;
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  closeActiveMonth();

  return timeline.reverse();
}
