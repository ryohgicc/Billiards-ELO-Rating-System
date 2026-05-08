import type { MatchRecord, Player } from "@/lib/types";

export type ReservationOrderEntry = {
  order: number;
  player: Player;
  drawNumber: number;
  drawNumberLabel: string;
  recentActiveDayCount: number;
  activeDayWeightDiscount: number;
  zeroActiveDayPenalty: number;
  weightedDrawNumber: number;
  dateSeed: string;
  drawSeed: string;
  hashInput: string;
};

type HashFunction = (input: string) => number;
type RecentActiveDayCountsByPlayerId = Record<string, number>;

const ACTIVE_DAY_WEIGHT_DISCOUNT = 10_000_000;
const RECENT_ACTIVE_DAY_WINDOW = 7;
const ZERO_ACTIVE_DAY_PENALTY = 30_000_000;
const RESERVATION_DAY_RESET_SALTS: Record<string, string> = {
  "2026-05-08": "reset-5",
};
const RESERVATION_TOP_TWO_EXCLUDED_PLAYER_NAMES: Record<string, string[]> = {
  "2026-05-08": ["gjj"],
};

function padNumber(value: number) {
  return value.toString().padStart(2, "0");
}

export function getLocalDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    padNumber(date.getMonth() + 1),
    padNumber(date.getDate()),
  ].join("-");
}

export function getNextLocalMidnight(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

export function calculateMillisecondsUntilNextLocalMidnight(date = new Date()) {
  return Math.max(0, getNextLocalMidnight(date).getTime() - date.getTime());
}

export function fnv1a32(input: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

export function getReservationDrawSeed(dateSeed: string) {
  const resetSalt = RESERVATION_DAY_RESET_SALTS[dateSeed];

  return resetSalt ? `${dateSeed}|${resetSalt}` : dateSeed;
}

function buildHashInput(player: Player, drawSeed: string) {
  return `${drawSeed}|${player.id}|${player.name}|${player.createdAt}`;
}

function formatDrawNumber(drawNumber: number) {
  return drawNumber.toString(16).toUpperCase().padStart(8, "0");
}

function parseLocalDateKey(dateSeed: string) {
  const [year = "0", month = "1", day = "1"] = dateSeed.split("-");

  return new Date(Number(year), Number(month) - 1, Number(day));
}

function addLocalDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function compareDateSeeds(left: string, right: string) {
  return left.localeCompare(right);
}

function hasSameTopTwo(left: Array<{ player: Player }>, right: Array<{ player: Player }>) {
  if (left.length < 2 || right.length < 2) {
    return false;
  }

  const rightTopTwoIds = new Set(right.slice(0, 2).map((entry) => entry.player.id));

  return left.slice(0, 2).every((entry) => rightTopTwoIds.has(entry.player.id));
}

export function buildRecentActiveDayCounts(
  matches: MatchRecord[],
  dateSeed: string,
): RecentActiveDayCountsByPlayerId {
  const windowEnd = parseLocalDateKey(dateSeed);
  const windowStartKey = getLocalDateKey(addLocalDays(windowEnd, -(RECENT_ACTIVE_DAY_WINDOW - 1)));
  const windowEndKey = getLocalDateKey(windowEnd);
  const activeDaysByPlayerId: Record<string, Set<string>> = {};

  for (const match of matches) {
    const matchDayKey = getLocalDateKey(new Date(match.createdAt));

    if (compareDateSeeds(matchDayKey, windowStartKey) < 0 || compareDateSeeds(matchDayKey, windowEndKey) > 0) {
      continue;
    }

    for (const playerId of [match.winnerId, match.loserId]) {
      activeDaysByPlayerId[playerId] ??= new Set<string>();
      activeDaysByPlayerId[playerId].add(matchDayKey);
    }
  }

  return Object.fromEntries(
    Object.entries(activeDaysByPlayerId).map(([playerId, activeDays]) => [
      playerId,
      activeDays.size,
    ]),
  );
}

function buildRawReservationOrder(
  players: Player[],
  dateSeed: string,
  hashFunction: HashFunction,
  recentActiveDayCountsByPlayerId: RecentActiveDayCountsByPlayerId,
) {
  return players
    .filter((player) => player.isActive)
    .map((player) => {
      const drawSeed = getReservationDrawSeed(dateSeed);
      const hashInput = buildHashInput(player, drawSeed);
      const drawNumber = hashFunction(hashInput) >>> 0;
      const recentActiveDayCount = Math.max(
        0,
        Math.floor(recentActiveDayCountsByPlayerId[player.id] ?? 0),
      );
      const activeDayWeightDiscount =
        Math.min(recentActiveDayCount, RECENT_ACTIVE_DAY_WINDOW) * ACTIVE_DAY_WEIGHT_DISCOUNT;
      const zeroActiveDayPenalty =
        recentActiveDayCount === 0 ? ZERO_ACTIVE_DAY_PENALTY : 0;
      const weightedDrawNumber = Math.max(
        0,
        drawNumber + zeroActiveDayPenalty - activeDayWeightDiscount,
      );

      return {
        player,
        drawNumber,
        drawNumberLabel: formatDrawNumber(drawNumber),
        recentActiveDayCount,
        activeDayWeightDiscount,
        zeroActiveDayPenalty,
        weightedDrawNumber,
        dateSeed,
        drawSeed,
        hashInput,
      };
    })
    .sort((left, right) => {
      if (left.weightedDrawNumber !== right.weightedDrawNumber) {
        return left.weightedDrawNumber - right.weightedDrawNumber;
      }

      if (left.drawNumber !== right.drawNumber) {
        return left.drawNumber - right.drawNumber;
      }

      const createdAtComparison = left.player.createdAt.localeCompare(right.player.createdAt);

      if (createdAtComparison !== 0) {
        return createdAtComparison;
      }

      return left.player.id.localeCompare(right.player.id);
    });
}

type RawReservationOrderEntry = ReturnType<typeof buildRawReservationOrder>[number];

function avoidRepeatedTopTwo(
  entries: RawReservationOrderEntry[],
  previousEntries: RawReservationOrderEntry[],
) {
  if (entries.length < 3 || !hasSameTopTwo(entries, previousEntries)) {
    return entries;
  }

  return [entries[0], entries[2], entries[1], ...entries.slice(3)];
}

function prioritizePreviousBottomTwo(
  entries: RawReservationOrderEntry[],
  previousEntries: RawReservationOrderEntry[],
) {
  if (entries.length < 3 || previousEntries.length < 3) {
    return entries;
  }

  const previousBottomIds = new Set(
    previousEntries.slice(-2).map((entry) => entry.player.id),
  );
  const priorityEntries = entries.filter((entry) => previousBottomIds.has(entry.player.id));

  if (priorityEntries.length === 0) {
    return entries;
  }

  const remainingEntries = entries.filter((entry) => !previousBottomIds.has(entry.player.id));

  return [...priorityEntries, ...remainingEntries];
}

function applyTopTwoExclusions(
  entries: RawReservationOrderEntry[],
  dateSeed: string,
) {
  const excludedPlayerNames = RESERVATION_TOP_TWO_EXCLUDED_PLAYER_NAMES[dateSeed];

  if (!excludedPlayerNames || entries.length < 3) {
    return entries;
  }

  const excludedNameSet = new Set(
    excludedPlayerNames.map((playerName) => playerName.trim().toLowerCase()),
  );
  const adjustedEntries = [...entries];

  for (let index = 0; index < Math.min(2, adjustedEntries.length); index += 1) {
    const entryName = adjustedEntries[index].player.name.trim().toLowerCase();

    if (!excludedNameSet.has(entryName)) {
      continue;
    }

    const replacementIndex = adjustedEntries.findIndex(
      (candidateEntry, candidateIndex) =>
        candidateIndex >= 2 &&
        !excludedNameSet.has(candidateEntry.player.name.trim().toLowerCase()),
    );

    if (replacementIndex === -1) {
      continue;
    }

    const [replacementEntry] = adjustedEntries.splice(replacementIndex, 1);
    adjustedEntries.splice(index, 0, replacementEntry);
  }

  return adjustedEntries;
}

function applyActivePlayerProtections(
  entries: ReturnType<typeof buildRawReservationOrder>,
  previousEntries: ReturnType<typeof buildRawReservationOrder>,
  dateSeed: string,
) {
  const priorityEntries = prioritizePreviousBottomTwo(entries, previousEntries);
  const repeatedTopTwoAdjustedEntries = avoidRepeatedTopTwo(priorityEntries, previousEntries);
  const adjustedEntries = applyTopTwoExclusions(repeatedTopTwoAdjustedEntries, dateSeed);

  return adjustedEntries;
}

function assignOrders(entries: ReturnType<typeof buildRawReservationOrder>) {
  return entries.map((entry, index) => ({
    ...entry,
    order: index + 1,
  }));
}

function findFirstLocalDateSeed(players: Player[]) {
  return players
    .filter((player) => player.isActive)
    .map((player) => getLocalDateKey(new Date(player.createdAt)))
    .sort()[0];
}

export function buildReservationOrder(
  players: Player[],
  dateSeed = getLocalDateKey(),
  hashFunction: HashFunction = fnv1a32,
  recentActiveDayCountsByPlayerId: RecentActiveDayCountsByPlayerId = {},
): ReservationOrderEntry[] {
  const firstDateSeed = findFirstLocalDateSeed(players);

  if (!firstDateSeed || compareDateSeeds(dateSeed, firstDateSeed) <= 0) {
    return assignOrders(
      applyActivePlayerProtections(
        buildRawReservationOrder(
          players,
          dateSeed,
          hashFunction,
          recentActiveDayCountsByPlayerId,
        ),
        [],
        dateSeed,
      ),
    );
  }

  let previousEntries: ReturnType<typeof buildRawReservationOrder> = [];
  let currentDate = parseLocalDateKey(firstDateSeed);

  while (compareDateSeeds(getLocalDateKey(currentDate), dateSeed) <= 0) {
    const currentDateSeed = getLocalDateKey(currentDate);
    const rawEntries = buildRawReservationOrder(
      players,
      currentDateSeed,
      hashFunction,
      recentActiveDayCountsByPlayerId,
    );
    const adjustedEntries = applyActivePlayerProtections(
      rawEntries,
      previousEntries,
      currentDateSeed,
    );

    if (currentDateSeed === dateSeed) {
      return assignOrders(adjustedEntries);
    }

    previousEntries = adjustedEntries;
    currentDate = addLocalDays(currentDate, 1);
  }

  return [];
}
