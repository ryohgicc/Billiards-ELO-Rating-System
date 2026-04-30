import { DEFAULT_RATING } from "@/lib/constants";
import type { RankingEntry } from "@/lib/types";

export function buildLeaderInsight(rankings: RankingEntry[]) {
  const leader = rankings[0];
  const secondPlace = rankings[1];
  const ratingGain = leader ? leader.rating - DEFAULT_RATING : 0;
  const leadOverSecond = leader && secondPlace ? leader.rating - secondPlace.rating : null;
  const dominancePercent = Math.max(
    8,
    Math.min(100, Math.round(40 + Math.max(0, ratingGain) * 0.5 + (leadOverSecond ?? 0) * 0.375)),
  );

  let headline = "状态上行";

  if (leader && leader.winRate >= 0.8 && leader.wins >= 3) {
    headline = "控制力强势";
  } else if (leadOverSecond !== null && leadOverSecond >= 20) {
    headline = "建立安全距离";
  } else if (ratingGain <= 0) {
    headline = "榜位胶着";
  }

  return {
    ratingGain,
    leadOverSecond,
    headline,
    subline: leadOverSecond === null ? "等待挑战者" : `领先第二名 ${leadOverSecond} 分`,
    dominancePercent,
  };
}
