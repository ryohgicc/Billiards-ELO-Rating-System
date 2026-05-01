"use client";

import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { formatDateTime } from "@/lib/format";
import { groupEntriesByLocalDay, summarizeDailyRatingMovement } from "@/lib/history";
import { formatMatchMomentLabel } from "@/lib/match-moments";
import { useAppState } from "@/lib/app-state";

export function HistoryView() {
  const { timeline, removeMatch, isLoaded, state } = useAppState();
  const dailyGroups = groupEntriesByLocalDay(timeline);
  const [selectedDateKey, setSelectedDateKey] = useState(dailyGroups[0]?.dateKey ?? "");
  const selectedGroup = dailyGroups.find((group) => group.dateKey === selectedDateKey) ?? dailyGroups[0];
  const dailyMovement = summarizeDailyRatingMovement(selectedGroup?.entries ?? []);
  const aiReviewsByMatchId = Object.fromEntries(
    state.aiReviews.map((review) => [review.matchId, review]),
  );
  const latestPendingMatchId = [...state.matches]
    .filter((match) => !aiReviewsByMatchId[match.id])
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.id;

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
                    {entry.winnerMoments.length > 0 || entry.loserMoments.length > 0 ? (
                      <div className="badge-list">
                        {entry.winnerMoments.map((moment) => (
                          <span key={`${entry.id}-winner-${moment}`} className="badge badge--glory">
                            胜者 · {formatMatchMomentLabel(moment)}
                          </span>
                        ))}
                        {entry.loserMoments.map((moment) => (
                          <span key={`${entry.id}-loser-${moment}`} className="badge badge--chaos">
                            负者 · {formatMatchMomentLabel(moment)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {aiReviewsByMatchId[entry.id]?.review ? (
                      <>
                        <p className="history-card__review">
                          AI 锐评：{aiReviewsByMatchId[entry.id]?.review}
                        </p>
                        {aiReviewsByMatchId[entry.id]?.winnerEvaluation ? (
                          <p className="history-card__review">
                            胜者赛后评价：{aiReviewsByMatchId[entry.id]?.winnerEvaluation}
                          </p>
                        ) : null}
                        {aiReviewsByMatchId[entry.id]?.loserEvaluation ? (
                          <p className="history-card__review">
                            负者赛后评价：{aiReviewsByMatchId[entry.id]?.loserEvaluation}
                          </p>
                        ) : null}
                      </>
                    ) : entry.id === latestPendingMatchId ? (
                      <p className="history-card__review">AI 锐评与双方赛后评价生成中...</p>
                    ) : null}
                    {entry.winnerNote ? <p>胜者备注：{entry.winnerNote}</p> : null}
                    {entry.loserNote ? <p>负者备注：{entry.loserNote}</p> : null}
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
