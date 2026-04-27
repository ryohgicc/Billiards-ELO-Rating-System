import { DEFAULT_SETTINGS, STORAGE_KEY } from "@/lib/constants";
import type { AppState } from "@/lib/types";
import { assertImportStateShape } from "@/lib/validation";

export function createEmptyState(): AppState {
  return {
    players: [],
    matches: [],
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

export function importState(payload: string) {
  try {
    const parsed = JSON.parse(payload);
    return assertImportStateShape(parsed);
  } catch {
    throw new Error("导入文件格式不正确");
  }
}
