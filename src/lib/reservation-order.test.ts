import { describe, expect, it } from "vitest";

import {
  buildReservationOrderHistory,
  buildReservationOrder,
  getLocalDateKey,
  getNextLocalMidnight,
  getReservationDrawSeed,
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
  it("returns a stable pure-random order for the same local day and players", () => {
    const firstOrder = buildReservationOrder(players, "2026-04-27");
    const secondOrder = buildReservationOrder([...players].reverse(), "2026-04-27");

    expect(secondOrder).toEqual(firstOrder);
    expect(firstOrder.map((entry) => entry.order)).toEqual([1, 2, 3]);
    expect(firstOrder.every((entry) => entry.dateSeed === "2026-04-27")).toBe(true);
    expect(firstOrder.every((entry) => entry.drawSeed === "2026-04-27")).toBe(true);
    expect(firstOrder.every((entry) => /^[0-9A-F]{8}$/.test(entry.drawNumberLabel))).toBe(true);
  });

  it("uses only the local day seed so a new day can produce a different order", () => {
    const todayOrder = buildReservationOrder(players, "2026-05-07");
    const tomorrowOrder = buildReservationOrder(players, "2026-05-08");

    expect(tomorrowOrder.map((entry) => entry.player.id)).not.toEqual(
      todayOrder.map((entry) => entry.player.id),
    );
  });

  it("applies a public reset salt only to the listed reset day", () => {
    expect(getReservationDrawSeed("2026-06-01")).toBe("2026-06-01|reset-6");
    expect(getReservationDrawSeed("2026-05-08")).toBe("2026-05-08");

    const resetDayOrder = buildReservationOrder(players, "2026-06-01");
    const normalDayOrder = buildReservationOrder(players, "2026-05-08");

    expect(resetDayOrder.every((entry) => entry.hashInput.startsWith("2026-06-01|reset-6|"))).toBe(
      true,
    );
    expect(normalDayOrder.every((entry) => entry.hashInput.startsWith("2026-05-08|"))).toBe(true);
    expect(normalDayOrder.every((entry) => !entry.hashInput.includes("reset"))).toBe(true);
  });

  it("excludes inactive players from the daily order", () => {
    const order = buildReservationOrder(players, "2026-05-07");

    expect(order.map((entry) => entry.player.id)).not.toContain("p4");
  });

  it("keeps the draw number stable when a player is renamed", () => {
    const originalOrder = buildReservationOrder(players, "2026-05-07");
    const renamedOrder = buildReservationOrder(
      players.map((player) =>
        player.id === "p1"
          ? {
              ...player,
              name: "Zed",
            }
          : player,
      ),
      "2026-05-07",
    );

    const originalEntry = originalOrder.find((entry) => entry.player.id === "p1");
    const renamedEntry = renamedOrder.find((entry) => entry.player.id === "p1");

    expect(renamedEntry?.drawNumber).toBe(originalEntry?.drawNumber);
    expect(renamedEntry?.drawNumberLabel).toBe(originalEntry?.drawNumberLabel);
    expect(renamedEntry?.hashInput).toBe(originalEntry?.hashInput);
  });

  it("sorts by draw number with creation time and id only as tie breakers", () => {
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

    const order = buildReservationOrder(tiedPlayers, "2026-04-27", () => 100);

    expect(order.map((entry) => entry.player.id)).toEqual(["alpha", "beta", "later"]);
  });

  it("does not adjust the order for activity, previous bottoms, repeated top two, or player names", () => {
    const fourPlayers: Player[] = [
      {
        id: "p1",
        name: "Alice",
        createdAt: "2026-05-07T10:00:00.000Z",
        isActive: true,
      },
      {
        id: "gjj-id",
        name: "gjj",
        createdAt: "2026-05-07T10:01:00.000Z",
        isActive: true,
      },
      {
        id: "p3",
        name: "Cara",
        createdAt: "2026-05-07T10:02:00.000Z",
        isActive: true,
      },
      {
        id: "p4",
        name: "Dino",
        createdAt: "2026-05-07T10:03:00.000Z",
        isActive: true,
      },
    ];
    const drawByPlayer = (input: string) => {
      if (input.includes("|p1|")) {
        return 10;
      }

      if (input.includes("|gjj-id|")) {
        return 20;
      }

      if (input.includes("|p3|")) {
        return 30;
      }

      return 40;
    };

    const order = buildReservationOrder(fourPlayers, "2026-05-08", drawByPlayer);

    expect(order.map((entry) => entry.player.id)).toEqual(["p1", "gjj-id", "p3", "p4"]);
    expect(order.slice(0, 2).map((entry) => entry.player.name)).toEqual(["Alice", "gjj"]);
  });
});

describe("buildReservationOrderHistory", () => {
  it("builds newest-first daily order snapshots from the first active player day through today", () => {
    const history = buildReservationOrderHistory(players, "2026-04-29");

    expect(history.map((day) => day.dateKey)).toEqual([
      "2026-04-29",
      "2026-04-28",
      "2026-04-27",
    ]);
    expect(history.map((day) => day.dateLabel)).toEqual([
      "2026年4月29日",
      "2026年4月28日",
      "2026年4月27日",
    ]);
    expect(history.every((day) => day.entries.length === 3)).toBe(true);
    expect(history[0].entries.every((entry) => entry.dateSeed === "2026-04-29")).toBe(true);
    expect(history[2].entries.every((entry) => entry.dateSeed === "2026-04-27")).toBe(true);
  });

  it("does not include active players before their creation day in historical snapshots", () => {
    const staggeredPlayers: Player[] = [
      players[0],
      {
        ...players[1],
        createdAt: "2026-04-29T10:01:00.000Z",
      },
    ];

    const history = buildReservationOrderHistory(staggeredPlayers, "2026-04-29");

    expect(history.find((day) => day.dateKey === "2026-04-29")?.entries).toHaveLength(2);
    expect(
      history.find((day) => day.dateKey === "2026-04-28")?.entries.map((entry) => entry.player.id),
    ).toEqual(["p1"]);
  });

  it("returns no history when there are no active players", () => {
    const history = buildReservationOrderHistory(
      players.map((player) => ({
        ...player,
        isActive: false,
      })),
      "2026-04-29",
    );

    expect(history).toEqual([]);
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
