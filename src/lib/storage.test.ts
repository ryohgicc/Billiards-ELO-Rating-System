import { beforeEach, describe, expect, it } from "vitest";

import {
  createEmptyState,
  exportState,
  importState,
  loadState,
  saveState,
} from "@/lib/storage";
import type { AppState } from "@/lib/types";

describe("storage helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns an empty state when nothing has been saved", () => {
    const state = loadState();

    expect(state).toEqual(createEmptyState());
  });

  it("saves and loads a full app state", () => {
    const state: AppState = {
      players: [
        {
          id: "p1",
          name: "Alice",
          createdAt: "2026-04-27T10:00:00.000Z",
          isActive: true,
        },
      ],
      matches: [
        {
          id: "m1",
          winnerId: "p1",
          loserId: "p2",
          createdAt: "2026-04-27T11:00:00.000Z",
        },
      ],
      settings: {
        title: "周五台球榜",
        kFactor: 32,
      },
    };

    saveState(state);

    expect(loadState()).toEqual(state);
  });

  it("round-trips state through export and import", () => {
    const original = createEmptyState();
    original.players.push({
      id: "p1",
      name: "Alice",
      createdAt: "2026-04-27T10:00:00.000Z",
      isActive: true,
    });

    const payload = exportState(original);
    const restored = importState(payload);

    expect(restored).toEqual(original);
  });

  it("rejects invalid imported payloads", () => {
    expect(() => importState('{"players":"bad"}')).toThrowError("导入文件格式不正确");
  });
});
