type EntryWithDate = {
  createdAt: string;
};

type EntryWithRatingMovement = {
  winnerName: string;
  loserName: string;
  winnerDelta: number;
  loserDelta: number;
};

export type DailyRatingMovementLeader = {
  playerName: string;
  delta: number;
};

export function groupEntriesByLocalDay<Entry extends EntryWithDate>(entries: Entry[]) {
  const groups: Array<{
    dateKey: string;
    dateLabel: string;
    entries: Entry[];
  }> = [];

  const groupMap = new Map<string, (typeof groups)[number]>();

  for (const entry of entries) {
    const date = new Date(entry.createdAt);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dateLabel = `${year}年${month}月${day}日`;
    const existingGroup = groupMap.get(dateKey);

    if (existingGroup) {
      existingGroup.entries.push(entry);
      continue;
    }

    const nextGroup = {
      dateKey,
      dateLabel,
      entries: [entry],
    };

    groups.push(nextGroup);
    groupMap.set(dateKey, nextGroup);
  }

  return groups;
}

export function summarizeDailyRatingMovement<Entry extends EntryWithRatingMovement>(
  entries: Entry[],
) {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    totals.set(entry.winnerName, (totals.get(entry.winnerName) ?? 0) + entry.winnerDelta);
    totals.set(entry.loserName, (totals.get(entry.loserName) ?? 0) + entry.loserDelta);
  }

  let topGain: DailyRatingMovementLeader | null = null;
  let topDrop: DailyRatingMovementLeader | null = null;

  for (const [playerName, delta] of totals) {
    if (!topGain || delta > topGain.delta) {
      topGain = { playerName, delta };
    }

    if (!topDrop || delta < topDrop.delta) {
      topDrop = { playerName, delta };
    }
  }

  return {
    topGain,
    topDrop,
  };
}
