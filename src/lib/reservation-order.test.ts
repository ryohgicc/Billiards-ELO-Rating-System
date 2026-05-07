import { describe, expect, it } from "vitest";

import {
  buildReservationOrder,
  getLocalDateKey,
  getNextLocalMidnight,
} from "@/lib/reservation-order";
import type { Player } from "@/lib/types";

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
    isActive: true,
  },
  {
    id: "p3",
    name: "Cara",
    createdAt: "2026-04-27T10:02:00.000Z",
    isActive: true,
  },
  {
    id: "p4",
    name: "Dino",
    createdAt: "2026-04-27T10:03:00.000Z",
    isActive: false,
  },
];

describe("buildReservationOrder", () => {
  it("returns a stable order for the same local day and players", () => {
    const firstOrder = buildReservationOrder(players, "2026-05-07");
    const secondOrder = buildReservationOrder([...players].reverse(), "2026-05-07");

    expect(secondOrder).toEqual(firstOrder);
    expect(firstOrder.map((entry) => entry.order)).toEqual([1, 2, 3]);
    expect(firstOrder.map((entry) => entry.player.id)).toEqual(["p3", "p1", "p2"]);
    expect(firstOrder.map((entry) => entry.drawNumberLabel)).toEqual([
      "B20E3DB3",
      "E5BAD664",
      "FF187D75",
    ]);
    expect(firstOrder.every((entry) => entry.dateSeed === "2026-05-07")).toBe(true);
  });

  it("uses the local day seed so a new day can produce a different order", () => {
    const todayOrder = buildReservationOrder(players, "2026-05-07");
    const tomorrowOrder = buildReservationOrder(players, "2026-05-08");

    expect(tomorrowOrder.map((entry) => entry.player.id)).not.toEqual(
      todayOrder.map((entry) => entry.player.id),
    );
  });

  it("excludes inactive players from the appointment order", () => {
    const order = buildReservationOrder(players, "2026-05-07");

    expect(order.map((entry) => entry.player.id)).not.toContain("p4");
  });

  it("falls back to creation time and id when draw numbers tie", () => {
    const tiedPlayers: Player[] = [
      {
        id: "later",
        name: "Later",
        createdAt: "2026-04-27T10:03:00.000Z",
        isActive: true,
      },
      {
        id: "alpha",
        name: "Alpha",
        createdAt: "2026-04-27T10:00:00.000Z",
        isActive: true,
      },
      {
        id: "beta",
        name: "Beta",
        createdAt: "2026-04-27T10:00:00.000Z",
        isActive: true,
      },
    ];

    const order = buildReservationOrder(tiedPlayers, "2026-05-07", () => 100);

    expect(order.map((entry) => entry.player.id)).toEqual(["alpha", "beta", "later"]);
  });
});

describe("local date helpers", () => {
  it("formats a local date key", () => {
    expect(getLocalDateKey(new Date(2026, 4, 7, 23, 59, 59))).toBe("2026-05-07");
  });

  it("returns the next local midnight", () => {
    const nextMidnight = getNextLocalMidnight(new Date(2026, 4, 7, 23, 59, 59));

    expect(nextMidnight.getFullYear()).toBe(2026);
    expect(nextMidnight.getMonth()).toBe(4);
    expect(nextMidnight.getDate()).toBe(8);
    expect(nextMidnight.getHours()).toBe(0);
    expect(nextMidnight.getMinutes()).toBe(0);
    expect(nextMidnight.getSeconds()).toBe(0);
    expect(nextMidnight.getMilliseconds()).toBe(0);
  });
});
