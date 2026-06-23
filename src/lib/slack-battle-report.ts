import { buildMatchTimeline } from "@/lib/rating";
import type { AppState, MatchMomentKey } from "@/lib/types";

export const BATTLE_REPORT_TIMEZONE = "Asia/Shanghai";

export type SlackBattleReportMatch = {
  id: string;
  createdAt: string;
  timeLabel: string;
  winnerId: string;
  winnerName: string;
  loserId: string;
  loserName: string;
  winnerDelta: number;
  loserDelta: number;
  winnerRatingAfter: number;
  loserRatingAfter: number;
  winnerMoments: MatchMomentKey[];
  loserMoments: MatchMomentKey[];
  winnerNote: string;
  loserNote: string;
};

export type SlackBattleReportRecord = {
  playerId: string;
  name: string;
  wins: number;
  losses: number;
  delta: number;
};

export type SlackBattleReport = {
  date: string;
  timezone: typeof BATTLE_REPORT_TIMEZONE;
  generatedAt: string;
  matchCount: number;
  message: string;
  matches: SlackBattleReportMatch[];
  records: SlackBattleReportRecord[];
};

type BuildSlackBattleReportOptions = {
  state: AppState;
  date: string;
  generatedAt?: Date;
};

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

function toShanghaiISOString(date: Date) {
  return new Date(date.getTime() + SHANGHAI_OFFSET_MS).toISOString().replace("Z", "+08:00");
}

function getShanghaiDateKey(value: string) {
  return toShanghaiISOString(new Date(value)).slice(0, 10);
}

function getShanghaiTimeLabel(value: string) {
  return toShanghaiISOString(new Date(value)).slice(11, 16);
}

function formatSignedDelta(delta: number) {
  return delta > 0 ? `+${delta}` : String(delta);
}

export function isValidBattleReportDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function buildMessage(date: string, matches: SlackBattleReportMatch[], records: SlackBattleReportRecord[]) {
  const lines = [`*今日战报（${date}）*`, `今日共 ${matches.length} 场`];

  if (matches.length === 0) {
    return [...lines, "", "今天还没有录入比赛。"].join("\n");
  }

  lines.push("", "*逐场结果*");
  matches.forEach((match, index) => {
    lines.push(
      `${index + 1}. ${match.timeLabel} ${match.winnerName} 胜 ${match.loserName} （${formatSignedDelta(match.winnerDelta)} / ${formatSignedDelta(match.loserDelta)}）`,
    );
  });

  lines.push("", "*今日胜负榜*");
  records.forEach((record, index) => {
    lines.push(
      `${index + 1}. ${record.name} ${record.wins}胜${record.losses}负，净积分 ${formatSignedDelta(record.delta)}`,
    );
  });

  return lines.join("\n");
}

function buildRecords(matches: SlackBattleReportMatch[]) {
  const recordsByPlayerId = new Map<string, SlackBattleReportRecord>();

  for (const match of matches) {
    const winner = recordsByPlayerId.get(match.winnerId) ?? {
      playerId: match.winnerId,
      name: match.winnerName,
      wins: 0,
      losses: 0,
      delta: 0,
    };
    winner.wins += 1;
    winner.delta += match.winnerDelta;
    recordsByPlayerId.set(match.winnerId, winner);

    const loser = recordsByPlayerId.get(match.loserId) ?? {
      playerId: match.loserId,
      name: match.loserName,
      wins: 0,
      losses: 0,
      delta: 0,
    };
    loser.losses += 1;
    loser.delta += match.loserDelta;
    recordsByPlayerId.set(match.loserId, loser);
  }

  return [...recordsByPlayerId.values()].sort((left, right) => {
    if (right.delta !== left.delta) {
      return right.delta - left.delta;
    }

    if (right.wins !== left.wins) {
      return right.wins - left.wins;
    }

    if (left.losses !== right.losses) {
      return left.losses - right.losses;
    }

    return left.name.localeCompare(right.name);
  });
}

export function buildSlackBattleReport({
  state,
  date,
  generatedAt = new Date(),
}: BuildSlackBattleReportOptions): SlackBattleReport {
  const matches = buildMatchTimeline(state.players, state.matches, state.settings.kFactor)
    .filter((entry) => getShanghaiDateKey(entry.createdAt) === date)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((entry): SlackBattleReportMatch => ({
      id: entry.id,
      createdAt: entry.createdAt,
      timeLabel: getShanghaiTimeLabel(entry.createdAt),
      winnerId: entry.winnerId,
      winnerName: entry.winnerName,
      loserId: entry.loserId,
      loserName: entry.loserName,
      winnerDelta: entry.winnerDelta,
      loserDelta: entry.loserDelta,
      winnerRatingAfter: entry.winnerRatingAfter,
      loserRatingAfter: entry.loserRatingAfter,
      winnerMoments: entry.winnerMoments,
      loserMoments: entry.loserMoments,
      winnerNote: entry.winnerNote,
      loserNote: entry.loserNote,
    }));
  const records = buildRecords(matches);

  return {
    date,
    timezone: BATTLE_REPORT_TIMEZONE,
    generatedAt: toShanghaiISOString(generatedAt),
    matchCount: matches.length,
    message: buildMessage(date, matches, records),
    matches,
    records,
  };
}
