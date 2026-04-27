import type { AppState, MatchRecord, Player } from "@/lib/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPlayer(value: unknown): value is Player {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.isActive === "boolean"
  );
}

function isMatchRecord(value: unknown): value is MatchRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.winnerId === "string" &&
    typeof value.loserId === "string" &&
    typeof value.createdAt === "string"
  );
}

export function validatePlayerName(name: string, players: Player[]) {
  const normalized = name.trim();

  if (!normalized) {
    throw new Error("球员名称不能为空");
  }

  if (players.some((player) => player.name.toLowerCase() === normalized.toLowerCase())) {
    throw new Error("球员名称已存在");
  }

  return normalized;
}

export function validateMatchPlayers(
  winnerId: string,
  loserId: string,
  players: Player[],
) {
  if (!winnerId || !loserId) {
    throw new Error("请选择胜者和负者");
  }

  if (winnerId === loserId) {
    throw new Error("不能录入同一位球员之间的比赛");
  }

  const winner = players.find((player) => player.id === winnerId);
  const loser = players.find((player) => player.id === loserId);

  if (!winner || !loser) {
    throw new Error("球员不存在");
  }

  if (!winner.isActive || !loser.isActive) {
    throw new Error("只能为启用中的球员录入比赛");
  }
}

export function assertImportStateShape(value: unknown): AppState {
  if (!isRecord(value)) {
    throw new Error("导入文件格式不正确");
  }

  const { players, matches, settings } = value;

  if (
    !Array.isArray(players) ||
    !players.every(isPlayer) ||
    !Array.isArray(matches) ||
    !matches.every(isMatchRecord) ||
    !isRecord(settings) ||
    typeof settings.title !== "string" ||
    typeof settings.kFactor !== "number"
  ) {
    throw new Error("导入文件格式不正确");
  }

  return {
    players,
    matches,
    settings: {
      title: settings.title,
      kFactor: settings.kFactor,
    },
  };
}
