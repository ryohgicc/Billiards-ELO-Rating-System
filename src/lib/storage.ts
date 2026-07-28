import { DEFAULT_SETTINGS, STORAGE_KEY } from "@/lib/constants";
import type { AppState } from "@/lib/types";
import { formatMatchMomentLabel } from "@/lib/match-moments";
import { buildMatchTimeline, getLocalMonthKey } from "@/lib/rating";
import { assertImportStateShape } from "@/lib/validation";

export function createEmptyState(): AppState {
  return {
    players: [],
    matches: [],
    photos: [],
    aiProfiles: [],
    aiReviews: [],
    aiModels: [],
    settings: DEFAULT_SETTINGS,
  };
}

export function loadState(): AppState {
  if (typeof window === "undefined") {
    return createEmptyState();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return createEmptyState();
  }

  try {
    return assertImportStateShape(JSON.parse(raw));
  } catch {
    return createEmptyState();
  }
}

export function saveState(state: AppState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportState(state: AppState) {
  return JSON.stringify(state, null, 2);
}

function escapeCsvCell(value: string | number) {
  const serialized = String(value);

  if (!/[",\n\r]/.test(serialized)) {
    return serialized;
  }

  return `"${serialized.replaceAll("\"", "\"\"")}"`;
}

function formatSignedValue(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

export function exportMatchRecordsCsv(state: AppState, monthKey?: string) {
  const rows = buildMatchTimeline(state.players, state.matches, state.settings.kFactor)
    .filter((match) => !monthKey || getLocalMonthKey(match.createdAt) === monthKey)
    .reverse()
    .map((match, index) => [
      index + 1,
      match.id,
      match.createdAt,
      getLocalMonthKey(match.createdAt),
      match.winnerName,
      match.loserName,
      formatSignedValue(match.winnerDelta),
      formatSignedValue(match.loserDelta),
      match.winnerRatingAfter,
      match.loserRatingAfter,
      match.streakBreakerBonus,
      match.winStreakBonus,
      match.winnerMoments.map(formatMatchMomentLabel).join(" / "),
      match.loserMoments.map(formatMatchMomentLabel).join(" / "),
      match.winnerNote,
      match.loserNote,
    ]);
  const header = [
    "序号",
    "比赛ID",
    "比赛时间",
    "月份",
    "胜者",
    "负者",
    "胜者积分变化",
    "负者积分变化",
    "胜者赛后积分",
    "负者赛后积分",
    "终结连胜奖励",
    "连胜延续奖励",
    "胜者瞬间",
    "负者瞬间",
    "胜者备注",
    "负者备注",
  ];

  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function importState(payload: string) {
  try {
    const parsed = JSON.parse(payload);
    return assertImportStateShape(parsed);
  } catch {
    throw new Error("导入文件格式不正确");
  }
}
