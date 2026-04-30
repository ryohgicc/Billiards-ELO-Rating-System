import { describe, expect, it } from "vitest";

import { groupEntriesByLocalDay, summarizeDailyRatingMovement } from "@/lib/history";

describe("groupEntriesByLocalDay", () => {
  it("groups entries by local calendar day and keeps their existing order", () => {
    const groups = groupEntriesByLocalDay([
      { id: "m3", createdAt: "2026-04-28T11:00:00.000Z" },
      { id: "m2", createdAt: "2026-04-27T12:00:00.000Z" },
      { id: "m1", createdAt: "2026-04-27T10:00:00.000Z" },
    ]);

    expect(groups).toEqual([
      {
        dateKey: "2026-04-28",
        dateLabel: "2026年4月28日",
        entries: [{ id: "m3", createdAt: "2026-04-28T11:00:00.000Z" }],
      },
      {
        dateKey: "2026-04-27",
        dateLabel: "2026年4月27日",
        entries: [
          { id: "m2", createdAt: "2026-04-27T12:00:00.000Z" },
          { id: "m1", createdAt: "2026-04-27T10:00:00.000Z" },
        ],
      },
    ]);
  });
});

describe("summarizeDailyRatingMovement", () => {
  it("returns the players with the largest daily rating gain and drop", () => {
    const summary = summarizeDailyRatingMovement([
      {
        winnerName: "Alice",
        loserName: "Bob",
        winnerDelta: 16,
        loserDelta: -16,
      },
      {
        winnerName: "Alice",
        loserName: "Chen",
        winnerDelta: 14,
        loserDelta: -14,
      },
      {
        winnerName: "Bob",
        loserName: "Chen",
        winnerDelta: 18,
        loserDelta: -18,
      },
    ]);

    expect(summary).toEqual({
      topGain: {
        playerName: "Alice",
        delta: 30,
      },
      topDrop: {
        playerName: "Chen",
        delta: -32,
      },
    });
  });

  it("returns null leaders for an empty day", () => {
    expect(summarizeDailyRatingMovement([])).toEqual({
      topGain: null,
      topDrop: null,
    });
  });
});
