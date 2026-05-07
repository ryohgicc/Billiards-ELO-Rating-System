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

export function buildReservationOrder(
  players: Player[],
  dateSeed = getLocalDateKey(),
  hashFunction: HashFunction = fnv1a32,
): ReservationOrderEntry[] {
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
    })
    .map((entry, index) => ({
      ...entry,
      order: index + 1,
    }));
}
