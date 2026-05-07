import { formatMatchMomentLabel } from "../src/lib/match-moments";
import type {
  MatchAiReview,
  MatchRecord,
  Player,
  PlayerAiProfile,
  PlayerProfile,
} from "../src/lib/types";

const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
const DEFAULT_OPENAI_API_URL = "https://api.openai.com/v1";
const MIN_AI_MARKET_VALUE = 500;
const MAX_AI_MARKET_VALUE = 30000;
const AI_REQUEST_TIMEOUT_MS = 60000;
const PLAIN_JSON_OUTPUT_NOTICE =
  "禁止输出思考过程、<think> 标签、markdown 代码块或额外解释。只输出一个 JSON 对象。";

type PlayerBundle = {
  player: Player;
  profile: PlayerProfile;
};

type GenerateAiInsightsArgs = {
  apiKey: string;
  apiUrl?: string;
  model?: string;
  generatedAt: string;
  match: MatchRecord;
  winner: PlayerBundle;
  loser: PlayerBundle;
};

type OpenAiPlayerPayload = {
  title_label: string;
  title_category: "legend" | "fun";
  title_reason: string;
  evaluation: string;
  market_value_usd: number;
};

type OpenAiInsightsPayload = {
  winner_profile: OpenAiPlayerPayload;
  loser_profile: OpenAiPlayerPayload;
  match_review: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readTextContent(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if (isRecord(part) && typeof part.text === "string") {
        return part.text;
      }

      if (isRecord(part) && isRecord(part.text) && typeof part.text.value === "string") {
        return part.text.value;
      }

      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function stripModelThinkingArtifacts(value: string) {
  return value
    .replace(/<think[\s\S]*?<\/think>/gi, " ")
    .replace(/<\/?think>/gi, " ")
    .trim();
}

function sanitizeInlineText(value: string, fallback: string, maxLength: number) {
  const normalized = value.trim().replace(/\s+/g, " ").replace(/[\r\n]+/g, " ");
  return (normalized || fallback).slice(0, maxLength);
}

function normalizeAiMarketValue(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const rounded = Math.round(value / 50) * 50;
  return Math.min(MAX_AI_MARKET_VALUE, Math.max(MIN_AI_MARKET_VALUE, rounded));
}

function formatRecentMatches(player: Player, profile: PlayerProfile) {
  if (profile.recentMatches.length === 0) {
    return `${player.name} 最近还没有历史战绩。`;
  }

  return profile.recentMatches
    .slice(0, 3)
    .map((match) => {
      const momentSummary = match.moments.length > 0 ? `，瞬间 ${match.moments.join(" / ")}` : "";
      const noteSummary = match.note ? `，备注 ${match.note}` : "";
      return `${match.result} ${match.opponentName}（${match.ratingDelta >= 0 ? "+" : ""}${match.ratingDelta}）${momentSummary}${noteSummary}`;
    })
    .join("；");
}

function formatPlayerBundle(label: string, bundle: PlayerBundle) {
  const { player, profile } = bundle;
  const achievements = profile.achievements
    .slice(0, 3)
    .map((achievement) => `${achievement.label}(${achievement.value})`)
    .join("、");
  const moments = profile.notableMoments.join("、");
  const currentTitle = profile.title ? `${profile.title.label}：${profile.title.reason}` : "暂无称号";

  return [
    `${label}：${player.name}`,
    `ELO ${profile.rating}，总战绩 ${profile.wins} 胜 ${profile.losses} 负，胜率 ${Math.round(profile.winRate * 100)}%`,
    `当前连胜 ${profile.currentWinStreak}，当前连败 ${profile.currentLossStreak}，最长连胜 ${profile.bestWinStreak}，最长连败 ${profile.worstLossStreak}`,
    `当前规则称号：${currentTitle}`,
    `当前规则估值：$${profile.marketValue.amountUsd}（${profile.marketValue.tier}）`,
    `规则评价：${profile.evaluation}`,
    `显著成就：${achievements || "暂无"}`,
    `名场面：${moments || "暂无"}`,
    `最近三场：${formatRecentMatches(player, profile)}`,
  ].join("\n");
}

function formatMatchSummary(match: MatchRecord, winner: PlayerBundle, loser: PlayerBundle) {
  const winnerMoments = match.winnerMoments.map(formatMatchMomentLabel).join("、");
  const loserMoments = match.loserMoments.map(formatMatchMomentLabel).join("、");

  return [
    `最新比赛：${winner.player.name} 胜 ${loser.player.name}`,
    `胜者瞬间：${winnerMoments || "无"}`,
    `负者瞬间：${loserMoments || "无"}`,
    `胜者备注：${match.winnerNote || "无"}`,
    `负者备注：${match.loserNote || "无"}`,
  ].join("\n");
}

function buildPrompt(match: MatchRecord, winner: PlayerBundle, loser: PlayerBundle) {
  return [
    "请根据以下台球对局资料，重新给双方球员做赛后 AI 画像，并锐评这场比赛。",
    "要求：",
    "1. 只输出 JSON，不要解释。",
    "2. title_label 要短、狠、有梗，像脱口秀起的花名/外号，2 到 10 个汉字优先。",
    "3. title_category 只能是 legend 或 fun。",
    "4. title_reason 和 evaluation 都要是简体中文单句，幽默毒舌、一句扎心，可以玩梗调侃但不能人身攻击。",
    "5. market_value_usd 输出整数，50 的倍数，范围 500 到 30000。",
    "6. match_review 必须是一句简体中文赛后辣评，风格要像吐槽大会/脱口秀——损得精准、好笑、让人拍大腿，点名球员名字或比赛瞬间，可以夸张但不能编造比分。",
    "7. 整体基调：又毒又好笑，别端水，别客气，锐评就要有锐度。",
    "",
    formatPlayerBundle("胜者球员画像输入", winner),
    "",
    formatPlayerBundle("败者球员画像输入", loser),
    "",
    formatMatchSummary(match, winner, loser),
  ].join("\n");
}

function buildPlainJsonPrompt(match: MatchRecord, winner: PlayerBundle, loser: PlayerBundle) {
  return [PLAIN_JSON_OUTPUT_NOTICE, "", buildPrompt(match, winner, loser)].join("\n");
}

function extractJsonPayloadText(value: string) {
  const trimmed = stripModelThinkingArtifacts(value).trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function readOutputText(payload: unknown) {
  if (!isRecord(payload)) {
    throw new Error("模型返回格式不正确");
  }

  const choices = payload.choices;

  if (Array.isArray(choices) && choices.length > 0) {
    const firstChoice = choices[0];

    if (
      isRecord(firstChoice) &&
      isRecord(firstChoice.message)
    ) {
      const messageContent = readTextContent(firstChoice.message.content);

      if (messageContent) {
        return stripModelThinkingArtifacts(messageContent);
      }

      if (isRecord(firstChoice.message.parsed)) {
        return JSON.stringify(firstChoice.message.parsed);
      }
    }

    if (isRecord(firstChoice) && typeof firstChoice.text === "string" && firstChoice.text.trim()) {
      return stripModelThinkingArtifacts(firstChoice.text);
    }
  }

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return stripModelThinkingArtifacts(payload.output_text);
  }

  if (isRecord(payload.error) && typeof payload.error.message === "string") {
    throw new Error(payload.error.message);
  }

  throw new Error("模型没有返回可解析的文本结果");
}

function readRequiredStringFields(
  value: Record<string, unknown>,
  ...keys: string[]
) {
  for (const key of keys) {
    const candidate = value[key];

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  throw new Error("AI 结果结构不正确");
}

function readMarketValueField(value: Record<string, unknown>) {
  const marketValue =
    value.market_value_usd ??
    value.marketValueUsd ??
    value.market_value ??
    value.marketValue ??
    value.value_usd;

  if (typeof marketValue === "number" && Number.isFinite(marketValue)) {
    return marketValue;
  }

  if (typeof marketValue === "string" && Number.isFinite(Number(marketValue))) {
    return Number(marketValue);
  }

  if (typeof marketValue === "string") {
    const digits = marketValue.replace(/[^\d.-]+/g, "");

    if (digits && Number.isFinite(Number(digits))) {
      return Number(digits);
    }
  }

  return 1500;
}

function normalizeAiPlayerPayload(value: unknown): OpenAiPlayerPayload {
  if (!isRecord(value)) {
    throw new Error("AI 结果结构不正确");
  }

  const titleCategory =
    value.title_category === "legend" || value.title_category === "fun"
      ? value.title_category
      : value.titleCategory === "legend" || value.titleCategory === "fun"
        ? value.titleCategory
        : value.category === "legend" || value.category === "fun"
          ? value.category
        : "fun";

  return {
    title_label: readRequiredStringFields(
      value,
      "title_label",
      "titleLabel",
      "title",
      "label",
      "name",
      "称号",
      "外号",
    ),
    title_category: titleCategory,
    title_reason: readRequiredStringFields(
      value,
      "title_reason",
      "titleReason",
      "reason",
      "description",
      "原因",
      "理由",
    ),
    evaluation: readRequiredStringFields(
      value,
      "evaluation",
      "comment",
      "summary",
      "analysis",
      "review",
      "text",
      "评价",
    ),
    market_value_usd: Math.round(readMarketValueField(value)),
  };
}

function readOptionalStringField(value: unknown, ...keys: string[]) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (!isRecord(value)) {
    return "";
  }

  for (const key of keys) {
    const candidate = value[key];

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return "";
}

function readNestedRecord(value: unknown, ...keys: string[]) {
  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of keys) {
    const candidate = value[key];

    if (isRecord(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function buildFlatPlayerPayload(value: Record<string, unknown>, prefix: "winner" | "loser") {
  const snakePrefix = `${prefix}_`;
  const camelPrefix = prefix;
  const title =
    readOptionalStringField(value, `${snakePrefix}title_label`, `${camelPrefix}TitleLabel`) ||
    readOptionalStringField(value, `${snakePrefix}title`, `${camelPrefix}Title`);
  const reason =
    readOptionalStringField(value, `${snakePrefix}title_reason`, `${camelPrefix}TitleReason`) ||
    readOptionalStringField(value, `${snakePrefix}reason`, `${camelPrefix}Reason`);
  const evaluation =
    readOptionalStringField(value, `${snakePrefix}evaluation`, `${camelPrefix}Evaluation`) ||
    readOptionalStringField(value, `${snakePrefix}comment`, `${camelPrefix}Comment`);

  if (!title && !reason && !evaluation) {
    return undefined;
  }

  return {
    title_label: title || (prefix === "winner" ? "胜者开麦" : "败者沉默"),
    title_category: prefix === "winner" ? "legend" : "fun",
    title_reason: reason || evaluation || "这场表现值得被记一笔。",
    evaluation: evaluation || reason || "这场表现很有节目效果。",
    market_value_usd:
      value[`${snakePrefix}market_value_usd`] ??
      value[`${camelPrefix}MarketValueUsd`] ??
      value[`${snakePrefix}marketValue`] ??
      value[`${camelPrefix}MarketValue`] ??
      1500,
  };
}

function parseInsightsPayload(payloadText: string): OpenAiInsightsPayload {
  const parsed = JSON.parse(extractJsonPayloadText(payloadText)) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("AI 结果结构不正确");
  }

  const profiles = parsed.profiles ?? parsed.players ?? parsed.player_profiles;
  const profileList = Array.isArray(profiles) ? profiles : [];
  const nestedProfiles = readNestedRecord(parsed, "profiles", "players", "player_profiles");
  const winnerProfile =
    parsed.winner_profile ??
    parsed.winnerProfile ??
    parsed.winner ??
    parsed.winningPlayer ??
    parsed.winner_ai_profile ??
    parsed["胜者"] ??
    parsed["赢家"] ??
    readNestedRecord(nestedProfiles, "winner", "winner_profile", "胜者", "赢家") ??
    profileList[0] ??
    buildFlatPlayerPayload(parsed, "winner");
  const loserProfile =
    parsed.loser_profile ??
    parsed.loserProfile ??
    parsed.loser ??
    parsed.losingPlayer ??
    parsed.loser_ai_profile ??
    parsed["败者"] ??
    parsed["输家"] ??
    readNestedRecord(nestedProfiles, "loser", "loser_profile", "败者", "输家") ??
    profileList[1] ??
    buildFlatPlayerPayload(parsed, "loser");
  const matchReview =
    parsed.match_review ??
    parsed.matchReview ??
    parsed.review ??
    parsed.comment ??
    parsed.summary ??
    parsed["比赛锐评"] ??
    readOptionalStringField(parsed.match, "review", "comment", "summary", "text");

  if (
    typeof matchReview !== "string"
  ) {
    throw new Error("AI 结果结构不正确");
  }

  return {
    winner_profile: normalizeAiPlayerPayload(winnerProfile),
    loser_profile: normalizeAiPlayerPayload(loserProfile),
    match_review: matchReview,
  };
}

function buildAiProfile(
  playerId: string,
  payload: OpenAiPlayerPayload,
  fallbackProfile: PlayerProfile,
  updatedAt: string,
  model: string,
): PlayerAiProfile {
  return {
    playerId,
    titleLabel: sanitizeInlineText(
      payload.title_label,
      fallbackProfile.title?.label || "球房常驻民",
      16,
    ),
    titleCategory: payload.title_category,
    titleReason: sanitizeInlineText(
      payload.title_reason,
      fallbackProfile.title?.reason || fallbackProfile.evaluation,
      48,
    ),
    evaluation: sanitizeInlineText(payload.evaluation, fallbackProfile.evaluation, 100),
    marketValueUsd: normalizeAiMarketValue(
      payload.market_value_usd,
      fallbackProfile.marketValue.amountUsd,
    ),
    updatedAt,
    model,
  };
}

function isRetryableAiOutputError(error: unknown) {
  if (error instanceof SyntaxError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("AI 结果结构不正确") ||
    error.message.includes("模型没有返回可解析的文本结果") ||
    error.message.includes("response_format") ||
    error.message.includes("json_schema") ||
    error.message.includes("json_object") ||
    error.message.includes("Structured Outputs")
  );
}

async function requestAiPayloadText({
  apiKey,
  apiUrl,
  model,
  match,
  winner,
  loser,
  plainJsonOnly,
}: {
  apiKey: string;
  apiUrl: string;
  model: string;
  match: MatchRecord;
  winner: PlayerBundle;
  loser: PlayerBundle;
  plainJsonOnly: boolean;
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(`${apiUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: plainJsonOnly
              ? [
                  "你是一个毒舌台球评论员，风格像台球圈的吐槽大会——说话又损又好笑，评论要让人又气又笑拍大腿。",
                  "你必须直接输出可解析 JSON，不要解释，不要 markdown，不要思维过程。",
                ].join("")
              : "你是一个毒舌台球评论员，风格像台球圈的吐槽大会——说话又损又好笑，评论要让人又气又笑拍大腿。你要基于提供的资料做紧凑、具体、接地气的赛后画像。",
          },
          {
            role: "user",
            content: plainJsonOnly
              ? buildPlainJsonPrompt(match, winner, loser)
              : buildPrompt(match, winner, loser),
          },
        ],
        ...(plainJsonOnly
          ? {}
          : {
              response_format: {
                type: "json_object",
              },
            }),
        max_completion_tokens: 2000,
        thinking: {
          type: "disabled",
        },
        temperature: 1,
        top_p: 0.95,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`模型响应超时（${AI_REQUEST_TIMEOUT_MS}ms）`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string") {
      throw new Error(payload.error.message);
    }

    throw new Error(`模型请求失败，状态码 ${response.status}`);
  }

  return readOutputText(payload);
}

export async function generateAiMatchInsights({
  apiKey,
  apiUrl = DEFAULT_OPENAI_API_URL,
  model = DEFAULT_OPENAI_MODEL,
  generatedAt,
  match,
  winner,
  loser,
}: GenerateAiInsightsArgs): Promise<{
  winnerProfile: PlayerAiProfile;
  loserProfile: PlayerAiProfile;
  matchReview: MatchAiReview;
}> {
  const baseUrl = apiUrl.trim().replace(/\/+$/, "") || DEFAULT_OPENAI_API_URL;
  let parsed: OpenAiInsightsPayload | null = null;
  let lastError: unknown = null;

  for (const plainJsonOnly of [false, true]) {
    try {
      const payloadText = await requestAiPayloadText({
        apiKey,
        apiUrl: baseUrl,
        model,
        match,
        winner,
        loser,
        plainJsonOnly,
      });
      parsed = parseInsightsPayload(payloadText);
      break;
    } catch (error) {
      lastError = error;

      if (plainJsonOnly || !isRetryableAiOutputError(error)) {
        throw error;
      }
    }
  }

  if (!parsed) {
    throw lastError instanceof Error ? lastError : new Error("AI 结果结构不正确");
  }

  return {
    winnerProfile: buildAiProfile(
      winner.player.id,
      parsed.winner_profile,
      winner.profile,
      generatedAt,
      model,
    ),
    loserProfile: buildAiProfile(
      loser.player.id,
      parsed.loser_profile,
      loser.profile,
      generatedAt,
      model,
    ),
    matchReview: {
      matchId: match.id,
      review: sanitizeInlineText(parsed.match_review, "这场球打得，台呢看了都想自燃。", 100),
      winnerEvaluation: sanitizeInlineText(
        parsed.winner_profile.evaluation,
        winner.profile.evaluation,
        100,
      ),
      loserEvaluation: sanitizeInlineText(
        parsed.loser_profile.evaluation,
        loser.profile.evaluation,
        100,
      ),
      updatedAt: generatedAt,
      model,
    },
  };
}
