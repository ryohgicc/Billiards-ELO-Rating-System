import type { Player } from "@/lib/types";

export type ReservationOrderEntry = {
  order: number;
  player: Player;
  drawNumber: number;
  drawNumberLabel: string;
  dateSeed: string;
  drawSeed: string;
  hashInput: string;
};

export type ReservationOrderDay = {
  dateKey: string;
  dateLabel: string;
  entries: ReservationOrderEntry[];
};

type HashFunction = (input: string) => number;

const FAIRNESS_ZONE_SIZE = 2;

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

// 公开重置盐值：仅对列出的日期生效，把盐值拼到当天种子后强制重算一次随机顺序。
// 不引入任何战绩/活跃度规律，只是换一个种子让当天结果重新洗牌。
const RESERVATION_DAY_RESET_SALTS: Record<string, string> = {
  "2026-06-01": "reset-6",
};

export function getReservationDrawSeed(dateSeed: string) {
  const resetSalt = RESERVATION_DAY_RESET_SALTS[dateSeed];

  return resetSalt ? `${dateSeed}|${resetSalt}` : dateSeed;
}

function buildHashInput(player: Player, drawSeed: string) {
  return `${drawSeed}|${player.id}|${player.createdAt}`;
}

function formatDrawNumber(drawNumber: number) {
  return drawNumber.toString(16).toUpperCase().padStart(8, "0");
}

function assignOrder(entries: ReservationOrderEntry[]) {
  return entries.map((entry, index) => ({
    ...entry,
    order: index + 1,
  }));
}

function getPreviousZoneIds(previousOrder: ReservationOrderEntry[], zone: "top" | "bottom") {
  const zoneSize = Math.min(FAIRNESS_ZONE_SIZE, Math.floor(previousOrder.length / 2));
  const zoneEntries =
    zone === "top" ? previousOrder.slice(0, zoneSize) : previousOrder.slice(-zoneSize);

  return new Set(zoneEntries.map((entry) => entry.player.id));
}

function applyConsecutiveZoneGuard(
  baseOrder: ReservationOrderEntry[],
  previousOrder?: ReservationOrderEntry[],
) {
  const zoneSize = Math.min(FAIRNESS_ZONE_SIZE, Math.floor(baseOrder.length / 2));

  if (!previousOrder || zoneSize < FAIRNESS_ZONE_SIZE) {
    return baseOrder;
  }

  const previousTopIds = getPreviousZoneIds(previousOrder, "top");
  const previousBottomIds = getPreviousZoneIds(previousOrder, "bottom");
  const topEntries = baseOrder.filter((entry) => !previousTopIds.has(entry.player.id)).slice(0, zoneSize);

  if (topEntries.length < zoneSize) {
    return baseOrder;
  }

  const topIds = new Set(topEntries.map((entry) => entry.player.id));
  const remainingAfterTop = baseOrder.filter((entry) => !topIds.has(entry.player.id));
  const bottomEntries = remainingAfterTop
    .filter((entry) => !previousBottomIds.has(entry.player.id))
    .slice(-zoneSize);

  if (bottomEntries.length < zoneSize) {
    return baseOrder;
  }

  const bottomIds = new Set(bottomEntries.map((entry) => entry.player.id));
  const middleEntries = remainingAfterTop.filter((entry) => !bottomIds.has(entry.player.id));

  return [...topEntries, ...middleEntries, ...bottomEntries];
}

function buildBaseReservationOrder(
  players: Player[],
  dateSeed = getLocalDateKey(),
  hashFunction: HashFunction = fnv1a32,
) {
  const drawSeed = getReservationDrawSeed(dateSeed);

  return players
    .filter((player) => player.isActive)
    .map((player) => {
      const hashInput = buildHashInput(player, drawSeed);
      const drawNumber = hashFunction(hashInput) >>> 0;

      return {
        player,
        drawNumber,
        drawNumberLabel: formatDrawNumber(drawNumber),
        dateSeed,
        drawSeed,
        hashInput,
        order: 0,
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

export function buildReservationOrder(
  players: Player[],
  dateSeed = getLocalDateKey(),
  hashFunction: HashFunction = fnv1a32,
  previousOrder?: ReservationOrderEntry[],
): ReservationOrderEntry[] {
  return assignOrder(applyConsecutiveZoneGuard(
    buildBaseReservationOrder(players, dateSeed, hashFunction),
    previousOrder,
  ));
}

function parseLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function formatDateLabel(dateKey: string) {
  const date = parseLocalDateKey(dateKey);

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function buildReservationOrderHistory(
  players: Player[],
  todayDateKey = getLocalDateKey(),
  hashFunction: HashFunction = fnv1a32,
): ReservationOrderDay[] {
  const activePlayers = players.filter((player) => player.isActive);

  if (activePlayers.length === 0) {
    return [];
  }

  const firstPlayerDateKey = activePlayers
    .map((player) => getLocalDateKey(new Date(player.createdAt)))
    .sort()[0];
  const firstDate = parseLocalDateKey(firstPlayerDateKey);
  const today = parseLocalDateKey(todayDateKey);
  const days: ReservationOrderDay[] = [];
  let nextDayOrder: ReservationOrderEntry[] | undefined;

  for (
    let cursor = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate());
    cursor.getTime() <= today.getTime();
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const dateKey = getLocalDateKey(cursor);
    const playersForDay = activePlayers.filter(
      (player) => getLocalDateKey(new Date(player.createdAt)) <= dateKey,
    );
    const entries = buildReservationOrder(playersForDay, dateKey, hashFunction, nextDayOrder);

    days.unshift({
      dateKey,
      dateLabel: formatDateLabel(dateKey),
      entries,
    });
    nextDayOrder = entries;
  }

  return days;
}
