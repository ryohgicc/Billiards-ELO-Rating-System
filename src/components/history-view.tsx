"use client";

import { EmptyState } from "@/components/empty-state";
import { formatDateTime } from "@/lib/format";
import { useAppState } from "@/lib/app-state";

export function HistoryView() {
  const { timeline, removeMatch, isLoaded } = useAppState();

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

      <div className="history-list">
        {timeline.map((entry) => (
          <article key={entry.id} className="history-card">
            <div>
              <div className="history-card__title">
                <h3>
                  {entry.winnerName} 胜 {entry.loserName}
                </h3>
                <span>{formatDateTime(entry.createdAt)}</span>
              </div>
              <p>
                积分变化：{entry.winnerName} +{entry.winnerDelta} / {entry.loserName}{" "}
                {entry.loserDelta}
              </p>
              <p>
                当前落点：{entry.winnerRatingAfter} vs {entry.loserRatingAfter}
              </p>
            </div>
            <button
              className="button button--danger"
              onClick={() => {
                if (window.confirm("删除后会重算积分，确定继续吗？")) {
                  removeMatch(entry.id);
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
  );
}
