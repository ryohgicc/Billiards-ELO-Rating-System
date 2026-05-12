import { DEFAULT_K_FACTOR, DEFAULT_RATING } from "@/lib/constants";
import { MATCH_MOMENT_OPTIONS, formatMatchMomentLabel } from "@/lib/match-moments";
import { pickFeaturedPhoto } from "@/lib/player-photos";
import { buildMatchTimeline, replayMatches } from "@/lib/rating";
import type {
  MatchMomentKey,
  MatchRecord,
  MatchTimelineEntry,
  Player,
  PlayerAchievement,
  PlayerAiProfile,
  PlayerMarketValue,
  PlayerOpponentSummary,
  PlayerPhoto,
  PlayerPhotoRole,
  PlayerProfile,
  PlayerRecentForm,
  PlayerRecentMatch,
  PlayerTitle,
} from "@/lib/types";

type MomentCountMap = Record<MatchMomentKey, number>;

type TitleContext = {
  player: Player;
  wins: number;
  losses: number;
  rating: number;
  totalMatches: number;
  winRate: number;
  ratingGain: number;
  currentWinStreak: number;
  currentLossStreak: number;
  bestWinStreak: number;
  worstLossStreak: number;
  momentCounts: MomentCountMap;
};

type TitleCandidate = PlayerTitle & {
  score: number;
};

type TitleRule = {
  key: string;
  label: string;
  category: PlayerTitle["category"];
  score: (context: TitleContext) => number;
  reason: (context: TitleContext) => string;
};

const MOMENT_KEYS: MatchMomentKey[] = MATCH_MOMENT_OPTIONS.map((option) => option.key);

const TITLE_RULES: TitleRule[] = [
  {
    key: "rocket_mode",
    label: "火箭附体",
    category: "legend",
    score: (context) => {
      if (context.totalMatches < 5 || context.currentWinStreak < 3 || context.winRate < 0.65) {
        return 0;
      }

      return (
        118 +
        context.currentWinStreak * 6 +
        context.bestWinStreak * 4 +
        context.momentCounts.clearance_runout * 5
      );
    },
    reason: (context) =>
      `当前 ${context.currentWinStreak} 连胜，胜率 ${formatWinRate(context.winRate)}。`,
  },
  {
    key: "zhao_surge",
    label: "赵心童暴走中",
    category: "legend",
    score: (context) => {
      if (
        context.totalMatches < 4 ||
        (context.bestWinStreak < 4 &&
          context.momentCounts.win_by_5 < 1 &&
          context.momentCounts.clearance_runout < 2)
      ) {
        return 0;
      }

      return (
        112 +
        context.bestWinStreak * 5 +
        context.momentCounts.win_by_5 * 8 +
        context.momentCounts.clearance_runout * 6
      );
    },
    reason: (context) =>
      `最长 ${context.bestWinStreak} 连胜，大比分压制 ${context.momentCounts.win_by_5} 场。`,
  },
  {
    key: "ding_control",
    label: "丁俊晖式控场",
    category: "legend",
    score: (context) => {
      if (
        context.totalMatches < 4 ||
        context.winRate < 0.58 ||
        (context.momentCounts.shutout < 1 &&
          context.momentCounts.win_by_3 + context.momentCounts.win_by_5 < 2)
      ) {
        return 0;
      }

      return (
        106 +
        context.momentCounts.shutout * 9 +
        (context.momentCounts.win_by_3 + context.momentCounts.win_by_5) * 5 +
        context.wins
      );
    },
    reason: (context) =>
      `零封 ${context.momentCounts.shutout} 次，大比分拿下 ${
        context.momentCounts.win_by_3 + context.momentCounts.win_by_5
      } 场。`,
  },
  {
    key: "black8_curse",
    label: "黑八冤种",
    category: "fun",
    score: (context) => {
      if (context.momentCounts.scratch_black_8 < 1) {
        return 0;
      }

      return 92 + context.momentCounts.scratch_black_8 * 14;
    },
    reason: (context) => `误进黑八 ${context.momentCounts.scratch_black_8} 次，节目效果过剩。`,
  },
  {
    key: "hundred_misses",
    label: "百杆不进球",
    category: "fun",
    score: (context) => {
      if (context.totalMatches < 4 || context.winRate > 0.35) {
        return 0;
      }

      return 88 + context.losses * 3 + context.worstLossStreak * 6;
    },
    reason: (context) =>
      `目前 ${context.losses} 负，最长 ${context.worstLossStreak} 连败，先把手感找回来。`,
  },
  {
    key: "background_board",
    label: "背景板专家",
    category: "fun",
    score: (context) => {
      const lossGap = context.losses - context.wins;

      if (lossGap < 4) {
        return 0;
      }

      return 78 + lossGap * 4;
    },
    reason: (context) => `${context.losses} 负 ${context.wins} 胜，先别再给别人做海报。`,
  },
];

function createEmptyMomentCounts(): MomentCountMap {
  return MOMENT_KEYS.reduce<MomentCountMap>((accumulator, key) => {
    accumulator[key] = 0;
    return accumulator;
  }, {} as MomentCountMap);
}

function formatWinRate(value: number) {
  return `${Math.round(value * 100)}%`;
}

function buildAchievements(context: TitleContext): PlayerAchievement[] {
  const achievements: PlayerAchievement[] = [];

  if (context.momentCounts.clearance_runout > 0) {
    achievements.push({
      key: "clearance_artist",
      label: "清台艺术家",
      detail: `一杆清台 ${context.momentCounts.clearance_runout} 次`,
      value: context.momentCounts.clearance_runout,
      tone: "glory",
    });
  }

  if (context.momentCounts.shutout > 0) {
    achievements.push({
      key: "wall_master",
      label: "铜墙铁壁",
      detail: `零封对手 ${context.momentCounts.shutout} 次`,
      value: context.momentCounts.shutout,
      tone: "glory",
    });
  }

  const heavyWinCount = context.momentCounts.win_by_3 + context.momentCounts.win_by_5;
  if (heavyWinCount > 0) {
    achievements.push({
      key: "heavy_hitter",
      label: "重炮压制",
      detail: `大比分拿下 ${heavyWinCount} 场`,
      value: heavyWinCount,
      tone: "glory",
    });
  }

  if (context.momentCounts.comeback_win > 0) {
    achievements.push({
      key: "comeback_master",
      label: "逆转专家",
      detail: `逆转翻盘 ${context.momentCounts.comeback_win} 次`,
      value: context.momentCounts.comeback_win,
      tone: "glory",
    });
  }

  if (context.bestWinStreak >= 3) {
    achievements.push({
      key: "streak_engine",
      label: "连胜引擎",
      detail: `最长连胜 ${context.bestWinStreak} 场`,
      value: context.bestWinStreak,
      tone: "glory",
    });
  }

  if (context.momentCounts.scratch_black_8 > 0) {
    achievements.push({
      key: "black8_showtime",
      label: "黑八惊魂",
      detail: `误进黑八 ${context.momentCounts.scratch_black_8} 次`,
      value: context.momentCounts.scratch_black_8,
      tone: "chaos",
    });
  }

  if (context.worstLossStreak >= 3) {
    achievements.push({
      key: "pressure_arc",
      label: "抗压修行",
      detail: `最长连败 ${context.worstLossStreak} 场`,
      value: context.worstLossStreak,
      tone: "chaos",
    });
  }

  return achievements.sort((left, right) => {
    if (right.value !== left.value) {
      return right.value - left.value;
    }

    return left.label.localeCompare(right.label, "zh-Hans-CN");
  });
}

function buildTitleCandidates(context: TitleContext) {
  return TITLE_RULES.map((rule) => {
    const score = rule.score(context);

    if (!score) {
      return null;
    }

    return {
      key: rule.key,
      label: rule.label,
      category: rule.category,
      reason: rule.reason(context),
      score,
    } as TitleCandidate;
  })
    .filter((candidate): candidate is TitleCandidate => Boolean(candidate))
    .sort((left, right) => right.score - left.score);
}

function buildFallbackTitle(context: TitleContext): PlayerTitle | null {
  if (context.totalMatches === 0) {
    return null;
  }

  if (context.wins > context.losses) {
    return {
      key: "cue_room_heating",
      label: "球房手感升温中",
      category: "fun",
      reason: `${context.wins} 胜 ${context.losses} 负，状态正在热起来。`,
    };
  }

  if (context.losses > context.wins) {
    return {
      key: "practice_monk",
      label: "练杆修行僧",
      category: "fun",
      reason: `${context.losses} 负 ${context.wins} 胜，先把低谷熬过去。`,
    };
  }

  return {
    key: "steady_regular",
    label: "球房常驻民",
    category: "fun",
    reason: `${context.totalMatches} 场对局打完，记录已经开张。`,
  };
}

function buildNotableMoments(momentCounts: MomentCountMap) {
  return Object.entries(momentCounts)
    .filter((entry): entry is [MatchMomentKey, number] => entry[1] > 0)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return (
        MATCH_MOMENT_OPTIONS.find((option) => option.key === right[0])!.aiWeight -
        MATCH_MOMENT_OPTIONS.find((option) => option.key === left[0])!.aiWeight
      );
    })
    .slice(0, 4)
    .map(([key, count]) => `${formatMatchMomentLabel(key)} x${count}`);
}

function buildAiHooks(
  context: TitleContext,
  title: PlayerTitle | null,
  notableMoments: string[],
  achievements: PlayerAchievement[],
  notes: string[],
) {
  const hooks = [
    title ? `当前称号：${title.label}` : null,
    context.bestWinStreak > 0 ? `最长连胜 ${context.bestWinStreak} 场` : null,
    context.worstLossStreak > 0 ? `最长连败 ${context.worstLossStreak} 场` : null,
    ...notableMoments,
    ...achievements.slice(0, 2).map((achievement) => achievement.detail),
    ...notes.slice(-2),
  ].filter((value): value is string => Boolean(value));

  return [...new Set(hooks)].slice(0, 6);
}

function buildMatchHistory(playerId: string, timeline: MatchTimelineEntry[]): PlayerRecentMatch[] {
  return timeline
    .filter((entry) => entry.winnerId === playerId || entry.loserId === playerId)
    .map((entry) => {
      const isWinner = entry.winnerId === playerId;

      return {
        id: entry.id,
        createdAt: entry.createdAt,
        result: isWinner ? "W" : "L",
        opponentName: isWinner ? entry.loserName : entry.winnerName,
        ratingDelta: isWinner ? entry.winnerDelta : entry.loserDelta,
        scoreline: `${entry.winnerName} 胜 ${entry.loserName}`,
        moments: (isWinner ? entry.winnerMoments : entry.loserMoments).map(formatMatchMomentLabel),
        note: isWinner ? entry.winnerNote : entry.loserNote,
      };
    });
}

function buildOpponentSummaries(
  playerId: string,
  timeline: MatchTimelineEntry[],
): PlayerOpponentSummary[] {
  const summariesByOpponentId = new Map<string, PlayerOpponentSummary>();

  for (const entry of timeline) {
    const isWinner = entry.winnerId === playerId;
    const isLoser = entry.loserId === playerId;

    if (!isWinner && !isLoser) {
      continue;
    }

    const opponentId = isWinner ? entry.loserId : entry.winnerId;
    const summary = summariesByOpponentId.get(opponentId) ?? {
      opponentId,
      opponentName: isWinner ? entry.loserName : entry.winnerName,
      wins: 0,
      losses: 0,
      totalMatches: 0,
      winRate: 0,
      lastMatchAt: entry.createdAt,
    };

    if (isWinner) {
      summary.wins += 1;
    } else {
      summary.losses += 1;
    }

    summary.totalMatches += 1;
    summary.winRate = summary.wins / summary.totalMatches;

    if (entry.createdAt > summary.lastMatchAt) {
      summary.lastMatchAt = entry.createdAt;
    }

    summariesByOpponentId.set(opponentId, summary);
  }

  return [...summariesByOpponentId.values()].sort((left, right) => {
    if (right.totalMatches !== left.totalMatches) {
      return right.totalMatches - left.totalMatches;
    }

    if (right.winRate !== left.winRate) {
      return right.winRate - left.winRate;
    }

    return right.lastMatchAt.localeCompare(left.lastMatchAt);
  });
}

function buildRecentForm(recentMatches: PlayerRecentMatch[]): PlayerRecentForm {
  return recentMatches.reduce<PlayerRecentForm>(
    (accumulator, match) => {
      if (match.result === "W") {
        accumulator.wins += 1;
      } else {
        accumulator.losses += 1;
      }

      accumulator.trend.push(match.result);
      return accumulator;
    },
    {
      wins: 0,
      losses: 0,
      trend: [],
    },
  );
}

function findLatestMatchRole(playerId: string, timeline: MatchTimelineEntry[]): PlayerPhotoRole {
  const latestMatch = timeline.find(
    (entry) => entry.winnerId === playerId || entry.loserId === playerId,
  );

  if (!latestMatch) {
    return "default";
  }

  return latestMatch.winnerId === playerId ? "victory" : "defeat";
}

function pickResultAwareFeaturedPhoto(
  photos: PlayerPhoto[],
  latestMatchRole: PlayerPhotoRole,
  seed: string,
) {
  const resultPhotos = photos.filter((photo) => photo.role === latestMatchRole);

  if (resultPhotos.length > 0) {
    return pickFeaturedPhoto(resultPhotos, seed);
  }

  const defaultPhotos = photos.filter((photo) => photo.role === "default");

  if (defaultPhotos.length > 0) {
    return pickFeaturedPhoto(defaultPhotos, seed);
  }

  return pickFeaturedPhoto(photos, seed);
}

function roundMarketValue(value: number) {
  return Math.round(value / 50) * 50;
}

export function getMarketTier(amountUsd: number) {
  if (amountUsd >= 18000) {
    return "桌边传说价";
  }

  if (amountUsd >= 12000) {
    return "巡回赛热股";
  }

  if (amountUsd >= 7000) {
    return "球房头牌价";
  }

  if (amountUsd >= 3500) {
    return "稳定主力价";
  }

  return "练习生底价";
}

function buildMarketSummary(
  amountUsd: number,
  context: TitleContext,
  recentForm: PlayerRecentForm,
  title: PlayerTitle | null,
) {
  if (amountUsd >= 18000) {
    return `${title?.label ?? "这位选手"}已经不是来打球的，是来拉升球房资产净值的。`;
  }

  if (amountUsd >= 12000) {
    return `近况 ${recentForm.wins} 胜 ${recentForm.losses} 负，已经进入“谁都想约他”的区间。`;
  }

  if (context.currentLossStreak >= 3) {
    return "价格还没崩，但市场情绪明显开始看空。";
  }

  if (context.totalMatches === 0) {
    return "还没正式开盘，先按潜力股试挂。";
  }

  return `账面表现稳定，属于球房里随时能出手的流通资产。`;
}

function buildMarketValue(
  context: TitleContext,
  title: PlayerTitle | null,
  recentForm: PlayerRecentForm,
): PlayerMarketValue {
  const ratingComponent = Math.round(
    context.ratingGain * (context.ratingGain >= 0 ? 32 : 20),
  );
  const volumeComponent = Math.min(context.totalMatches, 30) * 180;
  const winRateComponent =
    context.totalMatches < 3 ? 0 : Math.round((context.winRate - 0.5) * 5000);
  const streakComponent =
    context.bestWinStreak * 420 +
    context.currentWinStreak * 260 -
    context.worstLossStreak * 180 -
    context.currentLossStreak * 220;
  const momentComponent =
    context.momentCounts.clearance_runout * 900 +
    context.momentCounts.shutout * 650 +
    context.momentCounts.win_by_3 * 380 +
    context.momentCounts.win_by_5 * 720 +
    context.momentCounts.comeback_win * 500 +
    context.momentCounts.hill_hill_finish * 520 -
    context.momentCounts.scratch_black_8 * 650 -
    context.momentCounts.double_scratch * 220 -
    context.momentCounts.hill_hill_meltdown * 450;
  const recentComponent = (recentForm.wins - recentForm.losses) * 240;
  const titleComponent = title?.category === "legend" ? 950 : title ? 320 : 0;
  const amountUsd = Math.max(
    500,
    roundMarketValue(
      1200 +
        ratingComponent +
        volumeComponent +
        winRateComponent +
        streakComponent +
        momentComponent +
        recentComponent +
        titleComponent,
    ),
  );

  return {
    amountUsd,
    tier: getMarketTier(amountUsd),
    summary: buildMarketSummary(amountUsd, context, recentForm, title),
    factors: [
      `ELO ${context.rating}，较初始 ${context.ratingGain >= 0 ? "+" : ""}${context.ratingGain}`,
      `近 5 场 ${recentForm.wins} 胜 ${recentForm.losses} 负`,
      `最长连胜 ${context.bestWinStreak} 场，最长连败 ${context.worstLossStreak} 场`,
      `一杆清台 ${context.momentCounts.clearance_runout} 次，零封 ${context.momentCounts.shutout} 次`,
      `误进黑八 ${context.momentCounts.scratch_black_8} 次，决胜局断电 ${context.momentCounts.hill_hill_meltdown} 次`,
    ],
  };
}

export function buildPlayerProfiles(
  players: Player[],
  matches: MatchRecord[],
  photos: PlayerPhoto[] = [],
  kFactor = DEFAULT_K_FACTOR,
  photoSeed = "default-photo-seed",
): Record<string, PlayerProfile> {
  const stats = replayMatches(players, matches, kFactor);
  const timeline = buildMatchTimeline(players, matches, kFactor);
  const photosByPlayerId = players.reduce<Record<string, PlayerPhoto[]>>((accumulator, player) => {
    accumulator[player.id] = photos
      .filter((photo) => photo.playerId === player.id)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    return accumulator;
  }, {});
  const momentCountsByPlayer = Object.fromEntries(
    players.map((player) => [player.id, createEmptyMomentCounts()]),
  ) as Record<string, MomentCountMap>;
  const notesByPlayer = Object.fromEntries(
    players.map((player) => [player.id, [] as string[]]),
  ) as Record<string, string[]>;

  for (const match of [...matches].sort((left, right) => left.createdAt.localeCompare(right.createdAt))) {
    const winnerCounts = momentCountsByPlayer[match.winnerId];
    const loserCounts = momentCountsByPlayer[match.loserId];

    if (winnerCounts) {
      for (const key of match.winnerMoments) {
        winnerCounts[key] += 1;
      }

      if (match.winnerNote) {
        notesByPlayer[match.winnerId].push(`胜局注脚：${match.winnerNote}`);
      }
    }

    if (loserCounts) {
      for (const key of match.loserMoments) {
        loserCounts[key] += 1;
      }

      if (match.loserNote) {
        notesByPlayer[match.loserId].push(`败局注脚：${match.loserNote}`);
      }
    }
  }

  return players.reduce<Record<string, PlayerProfile>>((accumulator, player) => {
    const stat = stats[player.id];
    const totalMatches = (stat?.wins ?? 0) + (stat?.losses ?? 0);
    const winRate = totalMatches === 0 ? 0 : (stat?.wins ?? 0) / totalMatches;
    const context: TitleContext = {
      player,
      wins: stat?.wins ?? 0,
      losses: stat?.losses ?? 0,
      rating: stat?.rating ?? DEFAULT_RATING,
      totalMatches,
      winRate,
      ratingGain: (stat?.rating ?? DEFAULT_RATING) - DEFAULT_RATING,
      currentWinStreak: stat?.currentWinStreak ?? 0,
      currentLossStreak: stat?.currentLossStreak ?? 0,
      bestWinStreak: stat?.bestWinStreak ?? 0,
      worstLossStreak: stat?.worstLossStreak ?? 0,
      momentCounts: momentCountsByPlayer[player.id] ?? createEmptyMomentCounts(),
    };
    const titleCandidates = buildTitleCandidates(context);
    const fallbackTitle = buildFallbackTitle(context);
    const unlockedTitles =
      titleCandidates.length > 0 ? titleCandidates : fallbackTitle ? [fallbackTitle] : [];
    const title = unlockedTitles[0] ?? null;
    const achievements = buildAchievements(context);
    const matchHistory = buildMatchHistory(player.id, timeline);
    const recentMatches = matchHistory.slice(0, 5);
    const recentForm = buildRecentForm(recentMatches);
    const opponentSummaries = buildOpponentSummaries(player.id, timeline);
    const notableMoments = buildNotableMoments(context.momentCounts);
    const marketValue = buildMarketValue(context, title, recentForm);
    const playerPhotos = photosByPlayerId[player.id] ?? [];
    const latestMatchRole = findLatestMatchRole(player.id, timeline);
    const featuredPhoto = pickResultAwareFeaturedPhoto(
      playerPhotos,
      latestMatchRole,
      `${photoSeed}:${player.id}:${playerPhotos.length}`,
    );

    accumulator[player.id] = {
      playerId: player.id,
      title,
      unlockedTitles: unlockedTitles.map(({ key, label, category, reason }) => ({
        key,
        label,
        category,
        reason,
      })),
      achievements,
      photos: playerPhotos,
      featuredPhoto,
      photoCount: playerPhotos.length,
      rating: context.rating,
      wins: context.wins,
      losses: context.losses,
      totalMatches: context.totalMatches,
      winRate: context.winRate,
      lastMatchAt: stat?.lastMatchAt,
      bestWinStreak: context.bestWinStreak,
      worstLossStreak: context.worstLossStreak,
      currentWinStreak: context.currentWinStreak,
      currentLossStreak: context.currentLossStreak,
      recentForm,
      recentMatches,
      matchHistory,
      opponentSummaries,
      evaluation: marketValue.summary,
      marketValue,
      titleSource: "rules",
      marketValueSource: "rules",
      aiModel: null,
      notableMoments,
      aiHooks: buildAiHooks(
        context,
        title,
        notableMoments,
        achievements,
        notesByPlayer[player.id] ?? [],
      ),
    };

    return accumulator;
  }, {});
}

function isAiProfileFresh(aiProfile: PlayerAiProfile, lastMatchAt?: string) {
  if (!lastMatchAt) {
    return true;
  }

  return aiProfile.updatedAt >= lastMatchAt;
}

function normalizeAiMarketValue(value: number) {
  return Math.max(500, roundMarketValue(value));
}

export function mergeAiProfilesIntoPlayerProfiles(
  profilesByPlayerId: Record<string, PlayerProfile>,
  aiProfiles: PlayerAiProfile[] = [],
) {
  const mergedProfiles = { ...profilesByPlayerId };

  for (const aiProfile of aiProfiles) {
    const profile = mergedProfiles[aiProfile.playerId];

    if (!profile || !isAiProfileFresh(aiProfile, profile.lastMatchAt)) {
      continue;
    }

    const amountUsd = normalizeAiMarketValue(aiProfile.marketValueUsd);
    const titleLabel = aiProfile.titleLabel.trim() || profile.title?.label || "AI 未命名";
    const titleReason = aiProfile.titleReason.trim() || profile.title?.reason || profile.evaluation;
    const evaluation = aiProfile.evaluation.trim() || profile.evaluation;
    const aiTitle: PlayerTitle = {
      key: `ai-${profile.playerId}`,
      label: titleLabel,
      category: aiProfile.titleCategory,
      reason: titleReason,
    };

    mergedProfiles[aiProfile.playerId] = {
      ...profile,
      title: aiTitle,
      titleSource: "ai",
      unlockedTitles: [
        aiTitle,
        ...profile.unlockedTitles.filter((title) => title.label !== aiTitle.label),
      ].slice(0, 6),
      evaluation,
      marketValue: {
        amountUsd,
        tier: getMarketTier(amountUsd),
        summary: evaluation,
        factors: [`AI 重估模型：${aiProfile.model}`, ...profile.marketValue.factors].slice(0, 6),
      },
      marketValueSource: "ai",
      aiModel: aiProfile.model,
      aiHooks: [
        ...new Set(
          [
            `AI称号：${aiTitle.label}`,
            `AI身价：$${amountUsd}`,
            `AI评价：${evaluation}`,
            ...profile.aiHooks,
          ].filter((value): value is string => Boolean(value)),
        ),
      ].slice(0, 6),
    };
  }

  return mergedProfiles;
}
