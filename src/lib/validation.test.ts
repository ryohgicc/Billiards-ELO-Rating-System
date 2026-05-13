import { describe, expect, it } from "vitest";

import {
  assertImportStateShape,
  validateAiModelList,
  validateMatchDetails,
  validateMatchPlayers,
  validatePlayerPhotoPayload,
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

  it("allows an unchanged player name when excluding that player", () => {
    expect(validatePlayerName("  Alice  ", players, "p1")).toBe("Alice");
  });

  it("rejects names already used by a different player", () => {
    expect(() => validatePlayerName("Bob", players, "p1")).toThrowError("球员名称已存在");
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

describe("validateMatchDetails", () => {
  it("accepts structured moments and notes", () => {
    expect(
      validateMatchDetails({
        winnerMoments: ["clearance_runout", "shutout"],
        loserMoments: ["scratch_black_8"],
        winnerNote: " 一杆收完 ",
        loserNote: " 黑八没顶住 ",
      }),
    ).toEqual({
      winnerMoments: ["clearance_runout", "shutout"],
      loserMoments: ["scratch_black_8"],
      winnerNote: "一杆收完",
      loserNote: "黑八没顶住",
    });
  });

  it("rejects incompatible moment tags", () => {
    expect(() =>
      validateMatchDetails({
        winnerMoments: ["scratch_black_8"],
      }),
    ).toThrowError("所选精彩瞬间不适用于当前一方");
  });
});

describe("assertImportStateShape", () => {
  it("accepts a complete state object", () => {
    const state: AppState = {
      players: [],
      matches: [],
      photos: [],
      aiProfiles: [],
      aiReviews: [],
      aiModels: [],
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

  it("fills in missing match metadata for legacy imports", () => {
    expect(
      assertImportStateShape({
        players: [],
        matches: [
          {
            id: "m1",
            winnerId: "p1",
            loserId: "p2",
            createdAt: "2026-04-27T11:00:00.000Z",
          },
        ],
        settings: {
          title: "兼容老数据",
          kFactor: 32,
        },
      }),
    ).toEqual({
      players: [],
      matches: [
        {
          id: "m1",
          winnerId: "p1",
          loserId: "p2",
          createdAt: "2026-04-27T11:00:00.000Z",
          winnerMoments: [],
          loserMoments: [],
          winnerNote: "",
          loserNote: "",
        },
      ],
      photos: [],
      aiProfiles: [],
      aiReviews: [],
      aiModels: [],
      settings: {
        title: "兼容老数据",
        kFactor: 32,
      },
    });
  });

  it("accepts imported ai profile snapshots and match reviews", () => {
    expect(
      assertImportStateShape({
        players: [],
        matches: [],
        photos: [],
        aiProfiles: [
          {
            playerId: "p1",
            titleLabel: "台面判官",
            titleCategory: "legend",
            titleReason: "最近收台收得很稳。",
            evaluation: "状态在线，台面控制力明显上了一个档次。",
            marketValueUsd: 9800,
            updatedAt: "2026-04-27T12:00:00.000Z",
            model: "gpt-5.4-mini",
          },
        ],
        aiReviews: [
          {
            matchId: "m1",
            review: "这一局像是在给对手上心理公开课。",
            winnerEvaluation: "胜者今天控台感很足，越打越像收官的人。",
            loserEvaluation: "败者节奏断得太早，后程基本在追场面。",
            updatedAt: "2026-04-27T12:00:00.000Z",
            model: "gpt-5.4-mini",
          },
        ],
        aiModels: [
          {
            model: "free-gpt-4o-mini",
            isEnabled: true,
            failureCount: 0,
            lastError: "",
            lastTriedAt: "2026-04-27T12:00:00.000Z",
            lastSucceededAt: "2026-04-27T12:00:00.000Z",
            createdAt: "2026-04-27T11:30:00.000Z",
          },
        ],
        settings: {
          title: "AI 榜单",
          kFactor: 32,
        },
      }),
    ).toEqual({
      players: [],
      matches: [],
      photos: [],
      aiProfiles: [
        {
          playerId: "p1",
          titleLabel: "台面判官",
          titleCategory: "legend",
          titleReason: "最近收台收得很稳。",
          evaluation: "状态在线，台面控制力明显上了一个档次。",
          marketValueUsd: 9800,
          updatedAt: "2026-04-27T12:00:00.000Z",
          model: "gpt-5.4-mini",
        },
      ],
      aiReviews: [
        {
          matchId: "m1",
          review: "这一局像是在给对手上心理公开课。",
          winnerEvaluation: "胜者今天控台感很足，越打越像收官的人。",
          loserEvaluation: "败者节奏断得太早，后程基本在追场面。",
          updatedAt: "2026-04-27T12:00:00.000Z",
          model: "gpt-5.4-mini",
        },
      ],
      aiModels: [
        {
          model: "free-gpt-4o-mini",
          isEnabled: true,
          failureCount: 0,
          lastError: "",
          lastTriedAt: "2026-04-27T12:00:00.000Z",
          lastSucceededAt: "2026-04-27T12:00:00.000Z",
          createdAt: "2026-04-27T11:30:00.000Z",
        },
      ],
      settings: {
        title: "AI 榜单",
        kFactor: 32,
      },
    });
  });

  it("keeps legacy ai reviews compatible when player evaluations are missing", () => {
    expect(
      assertImportStateShape({
        players: [],
        matches: [],
        photos: [],
        aiProfiles: [],
        aiReviews: [
          {
            matchId: "m1",
            review: "老记录里只有一条总评。",
            updatedAt: "2026-04-27T12:00:00.000Z",
            model: "gpt-5.4-mini",
          },
        ],
        aiModels: [],
        settings: {
          title: "兼容老 AI 记录",
          kFactor: 32,
        },
      }),
    ).toEqual({
      players: [],
      matches: [],
      photos: [],
      aiProfiles: [],
      aiReviews: [
        {
          matchId: "m1",
          review: "老记录里只有一条总评。",
          winnerEvaluation: "",
          loserEvaluation: "",
          updatedAt: "2026-04-27T12:00:00.000Z",
          model: "gpt-5.4-mini",
        },
      ],
      aiModels: [],
      settings: {
        title: "兼容老 AI 记录",
        kFactor: 32,
      },
    });
  });
});

describe("validatePlayerPhotoPayload", () => {
  it("accepts data url images", () => {
    expect(
      validatePlayerPhotoPayload({
        images: ["data:image/jpeg;base64,abc", "data:image/png;base64,def"],
      }),
    ).toEqual({
      images: ["data:image/jpeg;base64,abc", "data:image/png;base64,def"],
      role: "default",
    });
  });

  it("accepts victory and defeat photo roles", () => {
    expect(
      validatePlayerPhotoPayload({
        images: ["data:image/jpeg;base64,abc"],
        role: "victory",
      }),
    ).toEqual({
      images: ["data:image/jpeg;base64,abc"],
      role: "victory",
    });
  });

  it("rejects more than one victory or defeat photo per upload", () => {
    expect(() =>
      validatePlayerPhotoPayload({
        images: ["data:image/jpeg;base64,abc", "data:image/jpeg;base64,def"],
        role: "victory",
      }),
    ).toThrowError("胜利图片每次只能上传 1 张");

    expect(() =>
      validatePlayerPhotoPayload({
        images: ["data:image/jpeg;base64,abc", "data:image/jpeg;base64,def"],
        role: "defeat",
      }),
    ).toThrowError("失败图片每次只能上传 1 张");
  });

  it("rejects invalid images", () => {
    expect(() =>
      validatePlayerPhotoPayload({
        images: ["https://example.com/a.png"],
      }),
    ).toThrowError("第 1 张照片格式不正确");
  });
});

describe("validateAiModelList", () => {
  it("accepts newline or comma separated model names after normalization", () => {
    expect(
      validateAiModelList({
        models: [" free-gpt-4o-mini ", "free-gemini-2.0-flash", "free-gpt-4o-mini"],
      }),
    ).toEqual(["free-gpt-4o-mini", "free-gemini-2.0-flash"]);
  });

  it("rejects empty model lists", () => {
    expect(() => validateAiModelList({ models: [] })).toThrowError("至少保留一个可用模型");
  });
});
