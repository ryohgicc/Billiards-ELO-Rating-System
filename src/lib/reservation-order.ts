import type { Player } from "@/lib/types";

export type ReservationOrderEntry = {
  order: number;
  player: Player;
  drawNumber: number;
  drawNumberLabel: string;
  matchCount: number;
  matchWeightDiscount: number;
  zeroMatchPenalty: number;
  weightedDrawNumber: number;
  dateSeed: string;
  hashInput: string;
};

type HashFunction = (input: string) => number;
type MatchCountsByPlayerId = Record<string, number>;

const MATCH_WEIGHT_DISCOUNT_PER_MATCH = 10_000_000;
const MAX_MATCH_WEIGHTED_MATCHES = 12;
const ZERO_MATCH_PENALTY = 30_000_000;

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

function buildHashInput(player: Player, dateSeed: string) {
  return `${dateSeed}|${player.id}|${player.name}|${player.createdAt}`;
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

function buildRawReservationOrder(
  players: Player[],
  dateSeed: string,
  hashFunction: HashFunction,
  matchCountsByPlayerId: MatchCountsByPlayerId,
) {
  return players
    .filter((player) => player.isActive)
    .map((player) => {
      const hashInput = buildHashInput(player, dateSeed);
      const drawNumber = hashFunction(hashInput) >>> 0;
      const matchCount = Math.max(0, Math.floor(matchCountsByPlayerId[player.id] ?? 0));
      const matchWeightDiscount =
        Math.min(matchCount, MAX_MATCH_WEIGHTED_MATCHES) * MATCH_WEIGHT_DISCOUNT_PER_MATCH;
      const zeroMatchPenalty = matchCount === 0 ? ZERO_MATCH_PENALTY : 0;
      const weightedDrawNumber = Math.max(
        0,
        drawNumber + zeroMatchPenalty - matchWeightDiscount,
      );

      return {
        player,
        drawNumber,
        drawNumberLabel: formatDrawNumber(drawNumber),
        matchCount,
        matchWeightDiscount,
        zeroMatchPenalty,
        weightedDrawNumber,
        dateSeed,
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

function avoidRepeatedTopTwo(
  entries: ReturnType<typeof buildRawReservationOrder>,
  previousEntries: ReturnType<typeof buildRawReservationOrder>,
) {
  if (entries.length < 3 || !hasSameTopTwo(entries, previousEntries)) {
    return entries;
  }

  return [entries[0], entries[2], entries[1], ...entries.slice(3)];
}

function prioritizePreviousBottomTwo(
  entries: ReturnType<typeof buildRawReservationOrder>,
  previousEntries: ReturnType<typeof buildRawReservationOrder>,
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
  matchCountsByPlayerId: MatchCountsByPlayerId = {},
): ReservationOrderEntry[] {
  const firstDateSeed = findFirstLocalDateSeed(players);

  if (!firstDateSeed || compareDateSeeds(dateSeed, firstDateSeed) <= 0) {
    return buildRawReservationOrder(players, dateSeed, hashFunction, matchCountsByPlayerId).map(
      (entry, index) => ({
        ...entry,
        order: index + 1,
      }),
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
      matchCountsByPlayerId,
    );
    const priorityEntries = prioritizePreviousBottomTwo(rawEntries, previousEntries);
    const adjustedEntries = avoidRepeatedTopTwo(priorityEntries, previousEntries);

    if (currentDateSeed === dateSeed) {
      return adjustedEntries.map((entry, index) => ({
        ...entry,
        order: index + 1,
      }));
    }

    previousEntries = adjustedEntries;
    currentDate = addLocalDays(currentDate, 1);
  }

  return [];
}
