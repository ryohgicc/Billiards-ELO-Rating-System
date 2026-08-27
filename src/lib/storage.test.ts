import { beforeEach, describe, expect, it } from "vitest";

import {
  createEmptyState,
  exportMatchRecordsCsv,
  exportReservationOrderCsv,
  exportState,
  importState,
  loadState,
  saveState,
} from "@/lib/storage";
import type { AppState } from "@/lib/types";

function createStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

describe("storage helpers", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: createStorageMock(),
      configurable: true,
    });
    window.localStorage.clear();
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
          winnerMoments: ["clearance_runout"],
          loserMoments: ["scratch_black_8"],
          winnerNote: "开球后一路收完",
          loserNote: "黑八翻车",
        },
      ],
      photos: [
        {
          id: "photo-1",
          playerId: "p1",
          imageData: "data:image/png;base64,abc123",
          createdAt: "2026-04-27T10:05:00.000Z",
          role: "default",
        },
      ],
      aiProfiles: [
        {
          playerId: "p1",
          titleLabel: "火力全开",
          titleCategory: "legend",
          titleReason: "连胜势头凶猛。",
          evaluation: "状态灼热，球房里最像大热门的那一个。",
          marketValueUsd: 12600,
          updatedAt: "2026-04-27T11:05:00.000Z",
          model: "gpt-5.4-mini",
        },
      ],
      aiReviews: [
        {
          matchId: "m1",
          review: "Alice 这一局像是把 Bob 直接打进了片尾字幕。",
          winnerEvaluation: "Alice 这一局越打越像今晚的主角。",
          loserEvaluation: "Bob 后半段心态先于黑八一起掉线了。",
          updatedAt: "2026-04-27T11:05:00.000Z",
          model: "gpt-5.4-mini",
        },
      ],
      aiModels: [
        {
          model: "free-gpt-4o-mini",
          isEnabled: true,
          failureCount: 0,
          lastError: "",
          lastTriedAt: "2026-04-27T11:05:00.000Z",
          lastSucceededAt: "2026-04-27T11:05:00.000Z",
          createdAt: "2026-04-27T10:00:00.000Z",
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

  it("exports monthly match records as CSV with rating details", () => {
    const state: AppState = {
      ...createEmptyState(),
      players: [
        {
          id: "p1",
          name: "Alice",
          createdAt: "2026-04-01T10:00:00.000Z",
          isActive: true,
        },
        {
          id: "p2",
          name: "Bob, Jr.",
          createdAt: "2026-04-01T10:00:00.000Z",
          isActive: true,
        },
      ],
      matches: [
        {
          id: "m1",
          winnerId: "p1",
          loserId: "p2",
          createdAt: "2026-04-27T11:00:00.000Z",
          winnerMoments: ["clearance_runout"],
          loserMoments: ["scratch_black_8"],
          winnerNote: "开球后一路收完",
          loserNote: '输在"黑八"',
        },
        {
          id: "m2",
          winnerId: "p2",
          loserId: "p1",
          createdAt: "2026-05-01T11:00:00.000Z",
          winnerMoments: [],
          loserMoments: [],
          winnerNote: "",
          loserNote: "",
        },
      ],
    };

    const csv = exportMatchRecordsCsv(state, "2026-04");

    expect(csv).toContain("序号,比赛ID,比赛时间,月份,胜者,负者");
    expect(csv).toContain("1,m1,2026-04-27T11:00:00.000Z,2026-04,Alice,\"Bob, Jr.\",+75,-75");
    expect(csv).toContain("一杆清台,误进黑八,开球后一路收完,\"输在\"\"黑八\"\"\"");
    expect(csv).not.toContain("m2");
  });

  it("exports reservation history as CSV with daily order details", () => {
    const state: AppState = {
      ...createEmptyState(),
      players: [
        {
          id: "p1",
          name: "Alice",
          createdAt: "2026-04-01T10:00:00.000Z",
          isActive: true,
        },
        {
          id: "p2",
          name: "Bob",
          createdAt: "2026-04-01T10:00:00.000Z",
          isActive: true,
        },
      ],
    };

    const csv = exportReservationOrderCsv(state, "2026-04-27");

    expect(csv).toContain("日期,日期标签,名次,球员ID,球员,创建时间,抽签种子,哈希输入,随机签号,随机数");
    expect(csv).toContain("2026-04-27,2026年4月27日,1,p1,Alice,2026-04-01T10:00:00.000Z");
    expect(csv).toContain("2026-04-27,2026年4月27日,2,p2,Bob,2026-04-01T10:00:00.000Z");
  });
});
