import { describe, expect, it } from "vitest";

import {
  buildRecentActiveDayCounts,
  buildReservationOrder,
  getLocalDateKey,
  getNextLocalMidnight,
} from "@/lib/reservation-order";
import type { MatchRecord, Player } from "@/lib/types";

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

function createMatch(match: Omit<MatchRecord, "winnerMoments" | "loserMoments" | "winnerNote" | "loserNote">): MatchRecord {
  return {
    ...match,
    winnerMoments: [],
    loserMoments: [],
    winnerNote: "",
    loserNote: "",
  };
}

describe("buildReservationOrder", () => {
  it("returns a stable order for the same local day and players", () => {
    const firstOrder = buildReservationOrder(players, "2026-04-27");
    const secondOrder = buildReservationOrder([...players].reverse(), "2026-04-27");

    expect(secondOrder).toEqual(firstOrder);
    expect(firstOrder.map((entry) => entry.order)).toEqual([1, 2, 3]);
    expect(firstOrder.every((entry) => entry.dateSeed === "2026-04-27")).toBe(true);
    expect(firstOrder.every((entry) => /^[0-9A-F]{8}$/.test(entry.drawNumberLabel))).toBe(true);
  });

  it("uses the local day seed so a new day can produce a different order", () => {
    const todayOrder = buildReservationOrder(players, "2026-05-07");
    const tomorrowOrder = buildReservationOrder(players, "2026-05-08");

    expect(tomorrowOrder.map((entry) => entry.player.id)).not.toEqual(
      todayOrder.map((entry) => entry.player.id),
    );
  });

  it("uses a public reset seed for the reset day", () => {
    const order = buildReservationOrder(players, "2026-05-08");

    expect(order.every((entry) => entry.dateSeed === "2026-05-08")).toBe(true);
    expect(order.every((entry) => entry.drawSeed === "2026-05-08|reset-5")).toBe(true);
    expect(order.every((entry) => entry.hashInput.startsWith("2026-05-08|reset-5|"))).toBe(
      true,
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

    const order = buildReservationOrder(tiedPlayers, "2026-04-27", () => 100);

    expect(order.map((entry) => entry.player.id)).toEqual(["alpha", "beta", "later"]);
  });

  it("keeps today's top two from matching yesterday's top two when possible", () => {
    const threePlayers: Player[] = players.slice(0, 3).map((player) => ({
      ...player,
      createdAt: "2026-05-07T10:00:00.000Z",
    }));
    const repeatedTopTwoHash = (input: string) => {
      if (input.includes("|p1|")) {
        return 10;
      }

      if (input.includes("|p2|")) {
        return 20;
      }

      return 30;
    };

    const activeDayCounts = {
      p1: 1,
      p2: 1,
      p3: 1,
    };
    const yesterdayOrder = buildReservationOrder(
      threePlayers,
      "2026-05-07",
      repeatedTopTwoHash,
      activeDayCounts,
    );
    const todayOrder = buildReservationOrder(
      threePlayers,
      "2026-05-08",
      repeatedTopTwoHash,
      activeDayCounts,
    );

    expect(yesterdayOrder.map((entry) => entry.player.id)).toEqual(["p1", "p2", "p3"]);
    expect(todayOrder.map((entry) => entry.player.id)).toEqual(["p2", "p3", "p1"]);
    expect(todayOrder.slice(0, 2).map((entry) => entry.player.id)).not.toEqual(
      yesterdayOrder.slice(0, 2).map((entry) => entry.player.id),
    );
  });

  it("prioritizes yesterday's bottom two on the next day", () => {
    const fourPlayers: Player[] = [
      {
        id: "p1",
        name: "Alice",
        createdAt: "2026-05-07T10:00:00.000Z",
        isActive: true,
      },
      {
        id: "p2",
        name: "Bob",
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
    const stableHash = (input: string) => {
      if (input.includes("|p1|")) {
        return 10;
      }

      if (input.includes("|p2|")) {
        return 20;
      }

      if (input.includes("|p3|")) {
        return 30;
      }

      return 40;
    };

    const activeDayCounts = {
      p1: 1,
      p2: 1,
      p3: 1,
      p4: 1,
    };
    const yesterdayOrder = buildReservationOrder(
      fourPlayers,
      "2026-05-07",
      stableHash,
      activeDayCounts,
    );
    const todayOrder = buildReservationOrder(
      fourPlayers,
      "2026-05-08",
      stableHash,
      activeDayCounts,
    );

    expect(yesterdayOrder.map((entry) => entry.player.id)).toEqual(["p1", "p2", "p3", "p4"]);
    expect(todayOrder.map((entry) => entry.player.id)).toEqual(["p3", "p4", "p1", "p2"]);
  });

  it("gives a small ordering boost to players active across more recent days", () => {
    const weightedPlayers: Player[] = [
      {
        id: "quiet",
        name: "Quiet",
        createdAt: "2026-05-07T10:00:00.000Z",
        isActive: true,
      },
      {
        id: "regular",
        name: "Regular",
        createdAt: "2026-05-07T10:01:00.000Z",
        isActive: true,
      },
      {
        id: "anchor",
        name: "Anchor",
        createdAt: "2026-05-07T10:02:00.000Z",
        isActive: true,
      },
    ];
    const closeHash = (input: string) => {
      if (input.includes("|anchor|")) {
        return 70_000_000;
      }

      if (input.includes("|quiet|")) {
        return 100_000_000;
      }

      return 105_000_000;
    };

    const order = buildReservationOrder(weightedPlayers, "2026-05-07", closeHash, {
      quiet: 0,
      regular: 2,
      anchor: 0,
    });

    expect(order.map((entry) => entry.player.id)).toEqual(["regular", "anchor", "quiet"]);
    expect(order.find((entry) => entry.player.id === "regular")?.activeDayWeightDiscount).toBe(
      20_000_000,
    );
  });

  it("penalizes players with no recent active days more than lightly active players", () => {
    const weightedPlayers: Player[] = [
      {
        id: "newcomer",
        name: "Newcomer",
        createdAt: "2026-05-07T10:00:00.000Z",
        isActive: true,
      },
      {
        id: "one-match",
        name: "One Match",
        createdAt: "2026-05-07T10:01:00.000Z",
        isActive: true,
      },
      {
        id: "anchor",
        name: "Anchor",
        createdAt: "2026-05-07T10:02:00.000Z",
        isActive: true,
      },
    ];
    const closeHash = (input: string) => {
      if (input.includes("|anchor|")) {
        return 70_000_000;
      }

      if (input.includes("|newcomer|")) {
        return 90_000_000;
      }

      return 105_000_000;
    };

    const order = buildReservationOrder(weightedPlayers, "2026-05-07", closeHash, {
      newcomer: 0,
      "one-match": 1,
      anchor: 0,
    });

    expect(order.map((entry) => entry.player.id)).toEqual(["one-match", "anchor", "newcomer"]);
    expect(order.find((entry) => entry.player.id === "newcomer")?.zeroActiveDayPenalty).toBe(
      30_000_000,
    );
  });

  it("treats zero-active-day players as a soft penalty instead of a hard bottom", () => {
    const mixedPlayers: Player[] = [
      {
        id: "inactive-lucky",
        name: "Inactive Lucky",
        createdAt: "2026-05-07T10:00:00.000Z",
        isActive: true,
      },
      {
        id: "active-unlucky",
        name: "Active Unlucky",
        createdAt: "2026-05-07T10:01:00.000Z",
        isActive: true,
      },
      {
        id: "active-anchor",
        name: "Active Anchor",
        createdAt: "2026-05-07T10:02:00.000Z",
        isActive: true,
      },
    ];
    const wideHash = (input: string) => {
      if (input.includes("|inactive-lucky|")) {
        return 10;
      }

      if (input.includes("|active-anchor|")) {
        return 200;
      }

      return 4_000_000_000;
    };

    const order = buildReservationOrder(mixedPlayers, "2026-05-07", wideHash, {
      "inactive-lucky": 0,
      "active-unlucky": 1,
      "active-anchor": 1,
    });

    expect(order.map((entry) => entry.player.id)).toEqual([
      "active-anchor",
      "inactive-lucky",
      "active-unlucky",
    ]);
  });

  it("applies previous-bottom priority across the full enabled pool", () => {
    const mixedPlayers: Player[] = [
      {
        id: "p1",
        name: "Alice",
        createdAt: "2026-05-07T10:00:00.000Z",
        isActive: true,
      },
      {
        id: "p2",
        name: "Bob",
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
    const stableHash = (input: string) => {
      if (input.includes("|p1|")) {
        return 10;
      }

      if (input.includes("|p2|")) {
        return 20;
      }

      if (input.includes("|p3|")) {
        return 30;
      }

      return 40;
    };

    const todayOrder = buildReservationOrder(mixedPlayers, "2026-05-08", stableHash, {
      p1: 1,
      p2: 1,
      p3: 0,
      p4: 0,
    });

    expect(todayOrder.map((entry) => entry.player.id)).toEqual(["p3", "p4", "p1", "p2"]);
  });

  it("keeps gjj out of the May 8 top two", () => {
    const cooldownPlayers: Player[] = [
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
    ];
    const stableHash = (input: string) => {
      if (input.includes("|p1|")) {
        return 10;
      }

      if (input.includes("|gjj-id|")) {
        return 20;
      }

      return 30;
    };
    const activeDayCounts = {
      p1: 1,
      "gjj-id": 1,
      p3: 1,
    };
    const may8Order = buildReservationOrder(
      cooldownPlayers,
      "2026-05-08",
      stableHash,
      activeDayCounts,
    );

    expect(may8Order.slice(0, 2).map((entry) => entry.player.name)).not.toContain("gjj");
  });

  it("leaves two-player days unchanged because the top two cannot differ", () => {
    const twoPlayerOrder = buildReservationOrder(players.slice(0, 2), "2026-05-08", (input) => {
      if (input.includes("|p1|")) {
        return 10;
      }

      return 20;
    });

    expect(twoPlayerOrder.map((entry) => entry.player.id)).toEqual(["p1", "p2"]);
  });
});

describe("buildRecentActiveDayCounts", () => {
  it("counts multiple matches on the same day as one active day", () => {
    const counts = buildRecentActiveDayCounts(
      [
        createMatch({
          id: "m1",
          winnerId: "p1",
          loserId: "p2",
          createdAt: "2026-05-08T10:00:00.000Z",
        }),
        createMatch({
          id: "m2",
          winnerId: "p1",
          loserId: "p3",
          createdAt: "2026-05-08T12:00:00.000Z",
        }),
      ],
      "2026-05-08",
    );

    expect(counts.p1).toBe(1);
    expect(counts.p2).toBe(1);
    expect(counts.p3).toBe(1);
  });

  it("counts distinct active days inside the seven-day window", () => {
    const counts = buildRecentActiveDayCounts(
      [
        createMatch({
          id: "m1",
          winnerId: "p1",
          loserId: "p2",
          createdAt: "2026-05-02T10:00:00.000Z",
        }),
        createMatch({
          id: "m2",
          winnerId: "p1",
          loserId: "p3",
          createdAt: "2026-05-08T12:00:00.000Z",
        }),
      ],
      "2026-05-08",
    );

    expect(counts.p1).toBe(2);
    expect(counts.p2).toBe(1);
    expect(counts.p3).toBe(1);
  });

  it("ignores matches outside the seven-day window", () => {
    const counts = buildRecentActiveDayCounts(
      [
        createMatch({
          id: "old",
          winnerId: "p1",
          loserId: "p2",
          createdAt: "2026-05-01T12:00:00.000Z",
        }),
        createMatch({
          id: "recent",
          winnerId: "p1",
          loserId: "p3",
          createdAt: "2026-05-02T00:00:00.000Z",
        }),
      ],
      "2026-05-08",
    );

    expect(counts.p1).toBe(1);
    expect(counts.p2).toBeUndefined();
    expect(counts.p3).toBe(1);
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
