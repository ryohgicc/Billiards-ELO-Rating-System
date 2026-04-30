"use client";

import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { formatDateTime } from "@/lib/format";
import { groupEntriesByLocalDay, summarizeDailyRatingMovement } from "@/lib/history";
import { useAppState } from "@/lib/app-state";

export function HistoryView() {
  const { timeline, removeMatch, isLoaded } = useAppState();
  const dailyGroups = groupEntriesByLocalDay(timeline);
  const [selectedDateKey, setSelectedDateKey] = useState(dailyGroups[0]?.dateKey ?? "");
  const selectedGroup = dailyGroups.find((group) => group.dateKey === selectedDateKey) ?? dailyGroups[0];
  const dailyMovement = summarizeDailyRatingMovement(selectedGroup?.entries ?? []);

  if (!isLoaded) {
    return <section className="panel">正在读取比赛历史...</section>;
  }

  if (timeline.length === 0) {
    return (
      <section className="panel">
        <EmptyState
          title="还没有比赛记录"
          description="录入第一场胜负之后，这里会保留完整历史，并支持删除误录。"
        />
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">History</p>
          <h2>比赛历史</h2>
        </div>
        <span className="section-note">删除后会自动重算全部积分</span>
      </div>

      <div className="date-switcher" aria-label="按日期查看比赛历史">
        {dailyGroups.map((group) => (
          <button
            key={group.dateKey}
            aria-pressed={group.dateKey === selectedGroup?.dateKey}
            className={
              group.dateKey === selectedGroup?.dateKey
                ? "date-switcher__button date-switcher__button--active"
                : "date-switcher__button"
            }
            onClick={() => setSelectedDateKey(group.dateKey)}
            type="button"
          >
            <span>{group.dateLabel}</span>
            <strong>{group.entries.length} 场</strong>
          </button>
        ))}
      </div>

      <div className="daily-movement">
        <div className="daily-movement__item daily-movement__item--gain">
          <span>上升第一</span>
          <strong>{dailyMovement.topGain?.playerName ?? "暂无"}</strong>
          <p>{dailyMovement.topGain ? `+${dailyMovement.topGain.delta}` : "0"}</p>
        </div>
        <div className="daily-movement__item daily-movement__item--drop">
          <span>下降第一</span>
          <strong>{dailyMovement.topDrop?.playerName ?? "暂无"}</strong>
          <p>{dailyMovement.topDrop?.delta ?? 0}</p>
        </div>
      </div>

      {selectedGroup ? (
        <div className="history-day-list">
          <section className="history-day">
            <div className="history-day__heading">
              <h3>{selectedGroup.dateLabel}</h3>
              <span className="section-note">{selectedGroup.entries.length} 场</span>
            </div>

            <div className="history-list">
              {selectedGroup.entries.map((entry) => (
                <article key={entry.id} className="history-card">
                  <div>
                    <div className="history-card__title">
                      <h3>
                        {entry.winnerName} 胜 {entry.loserName}
                      </h3>
                      <span>{formatDateTime(entry.createdAt)}</span>
                    </div>
                    <p>
                      积分变化：{entry.winnerName} +{entry.winnerDelta} /{" "}
                      {entry.loserName} {entry.loserDelta}
                    </p>
                    <p>
                      当前落点：{entry.winnerRatingAfter} vs {entry.loserRatingAfter}
                    </p>
                  </div>
                  <button
                    className="button button--danger"
                    onClick={() => {
                      if (window.confirm("删除后会重算积分，确定继续吗？")) {
                        removeMatch(entry.id).catch((error) => {
                          window.alert(error instanceof Error ? error.message : "删除比赛失败");
                        });
                      }
                    }}
                    type="button"
                  >
                    删除
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
