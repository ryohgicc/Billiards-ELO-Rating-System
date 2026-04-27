import { describe, expect, it } from "vitest";

import {
  assertImportStateShape,
  validateMatchPlayers,
  validatePlayerName,
} from "@/lib/validation";
import type { AppState, Player } from "@/lib/types";

const players: Player[] = [
  {
    id: "p1",
    name: "Alice",
    createdAt: "2026-04-27T10:00:00.000Z",
    isActive: true,
  },
  {
    id: "p2",
    name: "Bob",
    createdAt: "2026-04-27T10:01:00.000Z",
    isActive: false,
  },
];

describe("validatePlayerName", () => {
  it("trims valid names", () => {
    expect(validatePlayerName("  Alice  ", [])).toBe("Alice");
  });

  it("rejects duplicate names", () => {
    expect(() => validatePlayerName("Alice", players)).toThrowError("球员名称已存在");
  });
});

describe("validateMatchPlayers", () => {
  it("rejects self matches", () => {
    expect(() => validateMatchPlayers("p1", "p1", players)).toThrowError("不能录入同一位球员之间的比赛");
  });

  it("rejects inactive players", () => {
    expect(() => validateMatchPlayers("p1", "p2", players)).toThrowError("只能为启用中的球员录入比赛");
  });
});

describe("assertImportStateShape", () => {
  it("accepts a complete state object", () => {
    const state: AppState = {
      players: [],
      matches: [],
      settings: {
        title: "本地榜单",
        kFactor: 32,
      },
    };

    expect(assertImportStateShape(state)).toEqual(state);
  });

  it("throws for malformed state", () => {
    expect(() => assertImportStateShape({ nope: true })).toThrowError("导入文件格式不正确");
  });
});
