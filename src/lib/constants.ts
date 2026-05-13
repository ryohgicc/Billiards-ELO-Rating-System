import type { AppSettings } from "@/lib/types";

export const DEFAULT_RATING = 1000;
export const DEFAULT_K_FACTOR = 60;
export const STORAGE_KEY = "billiards-scoreboard-state";

export const DEFAULT_SETTINGS: AppSettings = {
  title: "台球积分榜",
  kFactor: DEFAULT_K_FACTOR,
};
