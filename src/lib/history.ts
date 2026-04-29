type EntryWithDate = {
  createdAt: string;
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
