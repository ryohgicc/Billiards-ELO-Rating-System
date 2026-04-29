import { describe, expect, it } from "vitest";

import { groupEntriesByLocalDay } from "@/lib/history";

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
