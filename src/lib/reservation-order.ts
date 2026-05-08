import type { Player } from "@/lib/types";

export type ReservationOrderEntry = {
  order: number;
  player: Player;
  drawNumber: number;
  drawNumberLabel: string;
  dateSeed: string;
  hashInput: string;
};

type HashFunction = (input: string) => number;

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
) {
  return players
    .filter((player) => player.isActive)
    .map((player) => {
      const hashInput = buildHashInput(player, dateSeed);
      const drawNumber = hashFunction(hashInput) >>> 0;

      return {
        player,
        drawNumber,
        drawNumberLabel: formatDrawNumber(drawNumber),
        dateSeed,
        hashInput,
      };
    })
    .sort((left, right) => {
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
): ReservationOrderEntry[] {
  const firstDateSeed = findFirstLocalDateSeed(players);

  if (!firstDateSeed || compareDateSeeds(dateSeed, firstDateSeed) <= 0) {
    return buildRawReservationOrder(players, dateSeed, hashFunction).map((entry, index) => ({
      ...entry,
      order: index + 1,
    }));
  }

  let previousEntries: ReturnType<typeof buildRawReservationOrder> = [];
  let currentDate = parseLocalDateKey(firstDateSeed);

  while (compareDateSeeds(getLocalDateKey(currentDate), dateSeed) <= 0) {
    const currentDateSeed = getLocalDateKey(currentDate);
    const rawEntries = buildRawReservationOrder(players, currentDateSeed, hashFunction);
    const adjustedEntries = avoidRepeatedTopTwo(rawEntries, previousEntries);

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
