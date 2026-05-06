import {
  assertMatchMomentKeys,
  assertMatchNote,
  normalizeMatchMomentKeys,
  normalizeMatchNote,
} from "@/lib/match-moments";
import {
  MAX_PLAYER_PHOTO_DATA_URL_LENGTH,
  MAX_PLAYER_PHOTOS_PER_PLAYER,
  MAX_PLAYER_PHOTOS_PER_UPLOAD,
  isPlayerPhotoDataUrl,
  normalizePlayerPhotoImageData,
  normalizePlayerPhotoRole,
} from "@/lib/player-photos";
import type {
  AiModelConfig,
  AppState,
  MatchAiReview,
  MatchRecord,
  Player,
  PlayerAiProfile,
  PlayerPhoto,
} from "@/lib/types";

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

function isPlayerPhoto(value: unknown): value is PlayerPhoto {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.playerId === "string" &&
    typeof value.imageData === "string" &&
    isPlayerPhotoDataUrl(value.imageData) &&
    typeof value.createdAt === "string" &&
    (value.role === "default" || value.role === "victory" || value.role === "defeat")
  );
}

function isPlayerAiProfile(value: unknown): value is PlayerAiProfile {
  return (
    isRecord(value) &&
    typeof value.playerId === "string" &&
    typeof value.titleLabel === "string" &&
    (value.titleCategory === "legend" || value.titleCategory === "fun") &&
    typeof value.titleReason === "string" &&
    typeof value.evaluation === "string" &&
    typeof value.marketValueUsd === "number" &&
    Number.isFinite(value.marketValueUsd) &&
    value.marketValueUsd > 0 &&
    typeof value.updatedAt === "string" &&
    typeof value.model === "string"
  );
}

function isMatchAiReview(value: unknown): value is MatchAiReview {
  return (
    isRecord(value) &&
    typeof value.matchId === "string" &&
    typeof value.review === "string" &&
    typeof value.winnerEvaluation === "string" &&
    typeof value.loserEvaluation === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.model === "string"
  );
}

function isAiModelConfig(value: unknown): value is AiModelConfig {
  return (
    isRecord(value) &&
    typeof value.model === "string" &&
    typeof value.isEnabled === "boolean" &&
    typeof value.failureCount === "number" &&
    Number.isInteger(value.failureCount) &&
    value.failureCount >= 0 &&
    typeof value.lastError === "string" &&
    (value.lastTriedAt === undefined || typeof value.lastTriedAt === "string") &&
    (value.lastSucceededAt === undefined || typeof value.lastSucceededAt === "string") &&
    typeof value.createdAt === "string"
  );
}

function normalizeImportedMatchRecord(value: unknown): MatchRecord | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.winnerId !== "string" ||
    typeof value.loserId !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    winnerId: value.winnerId,
    loserId: value.loserId,
    createdAt: value.createdAt,
    winnerMoments: normalizeMatchMomentKeys(value.winnerMoments, "winner"),
    loserMoments: normalizeMatchMomentKeys(value.loserMoments, "loser"),
    winnerNote: normalizeMatchNote(value.winnerNote),
    loserNote: normalizeMatchNote(value.loserNote),
  };
}

function normalizeImportedPlayerPhoto(value: unknown): PlayerPhoto | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.playerId !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    return null;
  }

  const imageData = normalizePlayerPhotoImageData(value.imageData);

  if (!imageData) {
    return null;
  }

  return {
    id: value.id,
    playerId: value.playerId,
    imageData,
    createdAt: value.createdAt,
    role: normalizePlayerPhotoRole(value.role),
  };
}

function normalizeImportedPlayerAiProfile(value: unknown): PlayerAiProfile | null {
  if (
    !isRecord(value) ||
    typeof value.playerId !== "string" ||
    typeof value.titleLabel !== "string" ||
    (value.titleCategory !== "legend" && value.titleCategory !== "fun") ||
    typeof value.titleReason !== "string" ||
    typeof value.evaluation !== "string" ||
    typeof value.updatedAt !== "string" ||
    typeof value.model !== "string"
  ) {
    return null;
  }

  const marketValueUsd = Number(value.marketValueUsd);

  if (!Number.isFinite(marketValueUsd) || marketValueUsd <= 0) {
    return null;
  }

  return {
    playerId: value.playerId,
    titleLabel: value.titleLabel.trim(),
    titleCategory: value.titleCategory,
    titleReason: value.titleReason.trim(),
    evaluation: value.evaluation.trim(),
    marketValueUsd: Math.round(marketValueUsd),
    updatedAt: value.updatedAt,
    model: value.model.trim(),
  };
}

function normalizeImportedMatchAiReview(value: unknown): MatchAiReview | null {
  if (
    !isRecord(value) ||
    typeof value.matchId !== "string" ||
    typeof value.review !== "string" ||
    typeof value.updatedAt !== "string" ||
    typeof value.model !== "string"
  ) {
    return null;
  }

  return {
    matchId: value.matchId,
    review: value.review.trim(),
    winnerEvaluation:
      typeof value.winnerEvaluation === "string" ? value.winnerEvaluation.trim() : "",
    loserEvaluation:
      typeof value.loserEvaluation === "string" ? value.loserEvaluation.trim() : "",
    updatedAt: value.updatedAt,
    model: value.model.trim(),
  };
}

function normalizeImportedAiModelConfig(value: unknown): AiModelConfig | null {
  if (
    !isRecord(value) ||
    typeof value.model !== "string" ||
    typeof value.isEnabled !== "boolean" ||
    typeof value.createdAt !== "string"
  ) {
    return null;
  }

  const failureCount = Number(value.failureCount ?? 0);

  if (!Number.isInteger(failureCount) || failureCount < 0) {
    return null;
  }

  return {
    model: value.model.trim(),
    isEnabled: value.isEnabled,
    failureCount,
    lastError: typeof value.lastError === "string" ? value.lastError.trim() : "",
    lastTriedAt: typeof value.lastTriedAt === "string" ? value.lastTriedAt : undefined,
    lastSucceededAt: typeof value.lastSucceededAt === "string" ? value.lastSucceededAt : undefined,
    createdAt: value.createdAt,
  };
}

export function validatePlayerName(name: string, players: Player[], excludedPlayerId?: string) {
  const normalized = name.trim();

  if (!normalized) {
    throw new Error("球员名称不能为空");
  }

  if (
    players.some(
      (player) =>
        player.id !== excludedPlayerId &&
        player.name.toLowerCase() === normalized.toLowerCase(),
    )
  ) {
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

export function validateMatchDetails(value: {
  winnerMoments?: unknown;
  loserMoments?: unknown;
  winnerNote?: unknown;
  loserNote?: unknown;
}) {
  return {
    winnerMoments: assertMatchMomentKeys(value.winnerMoments, "winner"),
    loserMoments: assertMatchMomentKeys(value.loserMoments, "loser"),
    winnerNote: assertMatchNote(value.winnerNote, "胜者备注"),
    loserNote: assertMatchNote(value.loserNote, "负者备注"),
  };
}

export function validatePlayerPhotoPayload(value: { images?: unknown; role?: unknown }, existingCount = 0) {
  if (!Array.isArray(value.images) || value.images.length === 0) {
    throw new Error("请选择至少一张照片");
  }

  if (value.images.length > MAX_PLAYER_PHOTOS_PER_UPLOAD) {
    throw new Error(`单次最多上传 ${MAX_PLAYER_PHOTOS_PER_UPLOAD} 张照片`);
  }

  if (existingCount + value.images.length > MAX_PLAYER_PHOTOS_PER_PLAYER) {
    throw new Error(`每位球员最多保留 ${MAX_PLAYER_PHOTOS_PER_PLAYER} 张照片`);
  }

  const role = normalizePlayerPhotoRole(value.role);
  const images = value.images.map((image, index) => {
    if (typeof image !== "string" || !isPlayerPhotoDataUrl(image.trim())) {
      throw new Error(`第 ${index + 1} 张照片格式不正确`);
    }

    const normalized = image.trim();

    if (normalized.length > MAX_PLAYER_PHOTO_DATA_URL_LENGTH) {
      throw new Error(`第 ${index + 1} 张照片过大`);
    }

    return normalized;
  });

  return {
    images,
    role,
  };
}

export function validateAiModelList(value: { models?: unknown }) {
  if (!Array.isArray(value.models)) {
    throw new Error("模型列表格式不正确");
  }

  const normalizedModels = value.models
    .map((model) => (typeof model === "string" ? model.trim() : ""))
    .filter(Boolean);

  if (normalizedModels.length === 0) {
    throw new Error("至少保留一个可用模型");
  }

  const uniqueModels = [...new Set(normalizedModels)];

  if (uniqueModels.some((model) => model.length > 120)) {
    throw new Error("模型名称过长");
  }

  return uniqueModels;
}

export function assertImportStateShape(value: unknown): AppState {
  if (!isRecord(value)) {
    throw new Error("导入文件格式不正确");
  }

  const { players, matches, photos, aiProfiles, aiReviews, aiModels, settings } = value;
  const normalizedMatches = Array.isArray(matches)
    ? matches.map(normalizeImportedMatchRecord)
    : null;
  const normalizedPhotos =
    photos == null
      ? []
      : Array.isArray(photos)
        ? photos.map(normalizeImportedPlayerPhoto)
        : null;
  const normalizedAiProfiles =
    aiProfiles == null
      ? []
      : Array.isArray(aiProfiles)
        ? aiProfiles.map(normalizeImportedPlayerAiProfile)
        : null;
  const normalizedAiReviews =
    aiReviews == null
      ? []
      : Array.isArray(aiReviews)
        ? aiReviews.map(normalizeImportedMatchAiReview)
        : null;
  const normalizedAiModels =
    aiModels == null
      ? []
      : Array.isArray(aiModels)
        ? aiModels.map(normalizeImportedAiModelConfig)
        : null;

  if (
    !Array.isArray(players) ||
    !players.every(isPlayer) ||
    !normalizedMatches ||
    normalizedMatches.some((match) => !match) ||
    !normalizedPhotos ||
    normalizedPhotos.some((photo) => !photo) ||
    !normalizedAiProfiles ||
    normalizedAiProfiles.some((profile) => !profile) ||
    !normalizedAiReviews ||
    normalizedAiReviews.some((review) => !review) ||
    !normalizedAiModels ||
    normalizedAiModels.some((model) => !model) ||
    !isRecord(settings) ||
    typeof settings.title !== "string" ||
    typeof settings.kFactor !== "number"
  ) {
    throw new Error("导入文件格式不正确");
  }

  const matchesWithMetadata = normalizedMatches.filter(
    (match): match is MatchRecord => Boolean(match),
  );
  const photosWithMetadata = normalizedPhotos.filter((photo): photo is PlayerPhoto => Boolean(photo));
  const aiProfilesWithMetadata = normalizedAiProfiles.filter(
    (profile): profile is PlayerAiProfile => Boolean(profile),
  );
  const aiReviewsWithMetadata = normalizedAiReviews.filter(
    (review): review is MatchAiReview => Boolean(review),
  );
  const aiModelsWithMetadata = normalizedAiModels.filter(
    (model): model is AiModelConfig => Boolean(model),
  );

  if (!photosWithMetadata.every(isPlayerPhoto)) {
    throw new Error("导入文件格式不正确");
  }

  if (
    !aiProfilesWithMetadata.every(isPlayerAiProfile) ||
    !aiReviewsWithMetadata.every(isMatchAiReview) ||
    !aiModelsWithMetadata.every(isAiModelConfig)
  ) {
    throw new Error("导入文件格式不正确");
  }

  return {
    players,
    matches: matchesWithMetadata,
    photos: photosWithMetadata,
    aiProfiles: aiProfilesWithMetadata,
    aiReviews: aiReviewsWithMetadata,
    aiModels: aiModelsWithMetadata,
    settings: {
      title: settings.title,
      kFactor: settings.kFactor,
    },
  };
}
