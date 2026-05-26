import type { MatchMomentDefinition, MatchMomentKey, MatchSide } from "@/lib/types";

export const MAX_MATCH_MOMENTS_PER_SIDE = 6;
export const MAX_MATCH_NOTE_LENGTH = 120;

export const MATCH_MOMENT_OPTIONS: MatchMomentDefinition[] = [
  {
    key: "clearance_runout",
    label: "一杆清台",
    description: "从上手到清完，节奏没有断过。",
    roles: ["winner"],
    tone: "glory",
    aiWeight: 10,
  },
  {
    key: "shutout",
    label: "零封对手",
    description: "整场不给对面任何上头空间。",
    roles: ["winner"],
    tone: "glory",
    aiWeight: 9,
  },
  {
    key: "win_by_3",
    label: "胜对手3球",
    description: "赢得比较从容，至少拉开了 3 球。",
    roles: ["winner"],
    tone: "glory",
    aiWeight: 6,
  },
  {
    key: "win_by_5",
    label: "胜对手5球",
    description: "大比分压制，基本打成教学局。",
    roles: ["winner"],
    tone: "glory",
    aiWeight: 9,
  },
  {
    key: "comeback_win",
    label: "逆转翻盘",
    description: "落后局面下硬是翻了回来。",
    roles: ["winner"],
    tone: "glory",
    aiWeight: 8,
  },
  {
    key: "hill_hill_finish",
    label: "决胜局绝杀",
    description: "拖到最后一局，再一击收工。",
    roles: ["winner"],
    tone: "glory",
    aiWeight: 8,
  },
  {
    key: "scratch_black_8",
    label: "误进黑八",
    description: "黑八提前翻车，节目效果直接拉满。",
    roles: ["loser"],
    tone: "chaos",
    aiWeight: 9,
  },
  {
    key: "double_scratch",
    label: "连续白球失误",
    description: "白球反复进袋，气氛瞬间开始抽象。",
    roles: ["loser"],
    tone: "chaos",
    aiWeight: 6,
  },
  {
    key: "hill_hill_meltdown",
    label: "决胜局断电",
    description: "明明拖到了最后，还是在终点前掉线。",
    roles: ["loser"],
    tone: "chaos",
    aiWeight: 7,
  },
];

const MATCH_MOMENT_MAP = new Map<MatchMomentKey, MatchMomentDefinition>(
  MATCH_MOMENT_OPTIONS.map<[MatchMomentKey, MatchMomentDefinition]>((option) => [
    option.key,
    option,
  ]),
);

function uniqueMomentKeys(keys: MatchMomentKey[]) {
  return [...new Set(keys)];
}

export function isMatchMomentKey(value: string): value is MatchMomentKey {
  return MATCH_MOMENT_MAP.has(value as MatchMomentKey);
}

export function getMatchMomentDefinition(key: MatchMomentKey) {
  const definition = MATCH_MOMENT_MAP.get(key);

  if (!definition) {
    throw new Error(`未知比赛标签: ${key}`);
  }

  return definition;
}

export function getMatchMomentOptions(side: MatchSide) {
  return MATCH_MOMENT_OPTIONS.filter((option) => option.roles.includes(side));
}

export function formatMatchMomentLabel(key: MatchMomentKey) {
  return getMatchMomentDefinition(key).label;
}

export function formatMatchMomentPromptDetail(key: MatchMomentKey) {
  const definition = getMatchMomentDefinition(key);

  return `${definition.label}：${definition.description}`;
}

export function normalizeMatchMomentKeys(value: unknown, side: MatchSide) {
  if (!Array.isArray(value)) {
    return [];
  }

  const keys = value.filter((item): item is string => typeof item === "string");

  return uniqueMomentKeys(
    keys
      .filter(isMatchMomentKey)
      .filter((key) => getMatchMomentDefinition(key).roles.includes(side))
      .slice(0, MAX_MATCH_MOMENTS_PER_SIDE),
  );
}

export function assertMatchMomentKeys(value: unknown, side: MatchSide) {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("比赛精彩瞬间格式不正确");
  }

  if (value.length > MAX_MATCH_MOMENTS_PER_SIDE) {
    throw new Error(`单方最多记录 ${MAX_MATCH_MOMENTS_PER_SIDE} 个精彩瞬间`);
  }

  const keys = uniqueMomentKeys(
    value.map((item) => {
      if (typeof item !== "string" || !isMatchMomentKey(item)) {
        throw new Error("比赛精彩瞬间格式不正确");
      }

      if (!getMatchMomentDefinition(item).roles.includes(side)) {
        throw new Error("所选精彩瞬间不适用于当前一方");
      }

      return item;
    }),
  );

  if (keys.includes("win_by_3") && keys.includes("win_by_5")) {
    throw new Error("同一方不能同时记录 3 球胜利和 5 球胜利");
  }

  return keys;
}

export function normalizeMatchNote(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, MAX_MATCH_NOTE_LENGTH);
}

export function assertMatchNote(value: unknown, label: string) {
  if (value == null) {
    return "";
  }

  if (typeof value !== "string") {
    throw new Error(`${label}格式不正确`);
  }

  const normalized = value.trim();

  if (normalized.length > MAX_MATCH_NOTE_LENGTH) {
    throw new Error(`${label}不能超过 ${MAX_MATCH_NOTE_LENGTH} 个字`);
  }

  return normalized;
}
