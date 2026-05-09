import { afterEach, describe, expect, it, vi } from "vitest";

import { generateAiMatchInsights } from "./ai";
import type { MatchRecord, Player, PlayerProfile } from "../src/lib/types";

const generatedAt = "2026-05-07T09:00:00.000Z";

function buildPlayer(id: string, name: string): Player {
  return {
    id,
    name,
    createdAt: generatedAt,
    isActive: true,
  };
}

function buildProfile(playerId: string): PlayerProfile {
  return {
    playerId,
    title: null,
    titleSource: "rules",
    unlockedTitles: [],
    achievements: [],
    photos: [],
    featuredPhoto: null,
    photoCount: 0,
    rating: 1500,
    wins: 1,
    losses: 0,
    totalMatches: 1,
    winRate: 1,
    bestWinStreak: 1,
    worstLossStreak: 0,
    currentWinStreak: 1,
    currentLossStreak: 0,
    recentForm: { wins: 1, losses: 0, trend: ["W"] },
    recentMatches: [],
    evaluation: "手感在线。",
    marketValue: {
      amountUsd: 1500,
      tier: "新星",
      summary: "值得观察。",
      factors: [],
    },
    marketValueSource: "rules",
    aiModel: null,
    notableMoments: [],
    aiHooks: [],
  };
}

function buildDelayedResponse(signal: AbortSignal) {
  return new Promise<Response>((resolve, reject) => {
    const abort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));

    if (signal.aborted) {
      abort();
      return;
    }

    signal.addEventListener("abort", abort, { once: true });

    setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    winner_profile: {
                      title_label: "准星队长",
                      title_category: "legend",
                      title_reason: "关键球稳得住。",
                      evaluation: "赢得不花，但够硬。",
                      market_value_usd: 2200,
                    },
                    loser_profile: {
                      title_label: "遗憾大师",
                      title_category: "fun",
                      title_reason: "机会来过，手没跟上。",
                      evaluation: "输在最后一口气。",
                      market_value_usd: 1200,
                    },
                    match_review: "这场球胜者像有导航，负者像在找停车位。",
                  }),
                },
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    }, 13_000);
  });
}

describe("generateAiMatchInsights", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("allows slower OpenAI-compatible models to finish", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((_, init) =>
      buildDelayedResponse(init?.signal as AbortSignal),
    );

    const winner = buildPlayer("winner", "小明");
    const loser = buildPlayer("loser", "小王");
    const match: MatchRecord = {
      id: "match-1",
      winnerId: winner.id,
      loserId: loser.id,
      createdAt: generatedAt,
      winnerMoments: [],
      loserMoments: [],
      winnerNote: "",
      loserNote: "",
    };

    const resultPromise = generateAiMatchInsights({
      apiKey: "test-key",
      apiUrl: "https://example.com/v1",
      model: "mimo-v2.5-pro",
      generatedAt,
      match,
      winner: { player: winner, profile: buildProfile(winner.id) },
      loser: { player: loser, profile: buildProfile(loser.id) },
    });

    await vi.advanceTimersByTimeAsync(13_000);

    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toMatchObject({
      response_format: {
        type: "json_object",
      },
      max_completion_tokens: 2_000,
      thinking: {
        type: "disabled",
      },
    });
    await expect(resultPromise).resolves.toMatchObject({
      matchReview: {
        matchId: match.id,
        model: "mimo-v2.5-pro",
      },
      winnerProfile: {
        playerId: winner.id,
        titleLabel: "准星队长",
      },
    });
  });

  it("accepts common JSON aliases from OpenAI-compatible gateways", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    winner: {
                      title: "准星队长",
                      category: "legend",
                      reason: "关键球稳得住。",
                      comment: "赢得不花，但够硬。",
                      marketValue: "$2200",
                    },
                    loser: {
                      label: "遗憾大师",
                      titleCategory: "fun",
                      titleReason: "机会来过，手没跟上。",
                      summary: "输在最后一口气。",
                      value_usd: 1200,
                    },
                    review: "这场球胜者像有导航，负者像在找停车位。",
                  }),
                },
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    const winner = buildPlayer("winner", "小明");
    const loser = buildPlayer("loser", "小王");

    const result = await generateAiMatchInsights({
      apiKey: "test-key",
      apiUrl: "https://example.com/v1",
      model: "mimo-v2.5-pro",
      generatedAt,
      match: {
        id: "match-1",
        winnerId: winner.id,
        loserId: loser.id,
        createdAt: generatedAt,
        winnerMoments: [],
        loserMoments: [],
        winnerNote: "",
        loserNote: "",
      },
      winner: { player: winner, profile: buildProfile(winner.id) },
      loser: { player: loser, profile: buildProfile(loser.id) },
    });

    expect(result).toMatchObject({
      winnerProfile: {
        titleLabel: "准星队长",
        titleCategory: "legend",
        marketValueUsd: 2200,
      },
      loserProfile: {
        titleLabel: "遗憾大师",
        titleCategory: "fun",
      },
      matchReview: {
        review: "这场球胜者像有导航，负者像在找停车位。",
      },
    });
  });

  it("retries malformed AI output up to ten model calls", async () => {
    const validPayload = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              winner_profile: {
                title_label: "准星队长",
                title_category: "legend",
                title_reason: "关键球稳得住。",
                evaluation: "赢得不花，但够硬。",
                market_value_usd: 2200,
              },
              loser_profile: {
                title_label: "遗憾大师",
                title_category: "fun",
                title_reason: "机会来过，手没跟上。",
                evaluation: "输在最后一口气。",
                market_value_usd: 1200,
              },
              match_review: "这场球胜者像有导航，负者像在找停车位。",
            }),
          },
        },
      ],
    };
    const malformedPayload = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              note: "格式不对",
            }),
          },
        },
      ],
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify(fetchSpy.mock.calls.length <= 9 ? malformedPayload : validPayload),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    const winner = buildPlayer("winner", "小明");
    const loser = buildPlayer("loser", "小王");

    const result = await generateAiMatchInsights({
      apiKey: "test-key",
      apiUrl: "https://example.com/v1",
      model: "mimo-v2.5-pro",
      generatedAt,
      match: {
        id: "match-1",
        winnerId: winner.id,
        loserId: loser.id,
        createdAt: generatedAt,
        winnerMoments: [],
        loserMoments: [],
        winnerNote: "",
        loserNote: "",
      },
      winner: { player: winner, profile: buildProfile(winner.id) },
      loser: { player: loser, profile: buildProfile(loser.id) },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(10);
    expect(result.matchReview.review).toBe("这场球胜者像有导航，负者像在找停车位。");
  });
});
