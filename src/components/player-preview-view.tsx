"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { useSearchParams } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PlayerPhotoFrame } from "@/components/player-photo-frame";
import { useAppState } from "@/lib/app-state";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";

export function PlayerPreviewView() {
  const { state, profilesByPlayerId, isLoaded } = useAppState();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const deferredSearch = useDeferredValue(search);
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const preferredPlayerId = searchParams.get("player") ?? "";
  const sortedPlayers = [...state.players].sort((left, right) => {
    const leftProfile = profilesByPlayerId[left.id];
    const rightProfile = profilesByPlayerId[right.id];
    const valueGap =
      (rightProfile?.marketValue.amountUsd ?? 0) - (leftProfile?.marketValue.amountUsd ?? 0);

    if (valueGap !== 0) {
      return valueGap;
    }

    return (rightProfile?.rating ?? 0) - (leftProfile?.rating ?? 0);
  });
  const filteredPlayers = sortedPlayers.filter((player) =>
    normalizedSearch ? player.name.toLowerCase().includes(normalizedSearch) : true,
  );
  const activePlayerId = filteredPlayers.some((player) => player.id === selectedPlayerId)
    ? selectedPlayerId
    : filteredPlayers.some((player) => player.id === preferredPlayerId)
      ? preferredPlayerId
      : filteredPlayers[0]?.id ?? "";
  const selectedPlayer = filteredPlayers.find((player) => player.id === activePlayerId) ?? filteredPlayers[0];
  const selectedProfile = selectedPlayer ? profilesByPlayerId[selectedPlayer.id] : null;

  if (!isLoaded) {
    return <section className="panel">正在读取球员预览数据...</section>;
  }

  if (state.players.length === 0) {
    return (
      <section className="panel">
        <EmptyState
          title="还没有可预览的球员"
          description="先去球员管理新增球员，再录几场比赛，预览页就会开始长内容。"
        />
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Scout Board</p>
            <h2>球探面板</h2>
          </div>
          <span className="section-note">{filteredPlayers.length} 位可查看</span>
        </div>

        <label className="field preview-search">
          <span>搜索球员</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="输入球员名字"
            value={search}
          />
        </label>

        {filteredPlayers.length === 0 ? (
          <EmptyState
            title="没找到匹配球员"
            description="换个关键词试试，或者先去球员管理新增对应球员。"
          />
        ) : (
          <div className="preview-workbench">
            <aside className="preview-roster">
              {filteredPlayers.map((player) => {
                const profile = profilesByPlayerId[player.id];
                const isSelected = player.id === selectedPlayer?.id;
                const trend = profile?.recentForm.trend.join("") || "暂无";

                return (
                  <button
                    key={player.id}
                    className={
                      isSelected
                        ? "preview-roster__item preview-roster__item--active"
                        : "preview-roster__item"
                    }
                    onClick={() => setSelectedPlayerId(player.id)}
                    type="button"
                  >
                    <div className="preview-roster__top">
                      <strong>{player.name}</strong>
                      <span>{profile ? formatCurrency(profile.marketValue.amountUsd) : "$0"}</span>
                    </div>
                    <p>{profile?.title?.label ?? "尚未命名"}</p>
                    <small>
                      近况 {profile?.recentForm.wins ?? 0} 胜 {profile?.recentForm.losses ?? 0} 负 ·{" "}
                      {trend}
                    </small>
                  </button>
                );
              })}
            </aside>

            {selectedPlayer && selectedProfile ? (
              <section className="preview-detail">
                <div className="preview-detail__hero">
                  <div>
                    <p className="eyebrow">Preview Card</p>
                    <h3>{selectedPlayer.name}</h3>
                    <PlayerPhotoFrame
                      photo={selectedProfile.featuredPhoto}
                      photoCount={selectedProfile.photoCount}
                      playerId={selectedPlayer.id}
                      playerName={selectedPlayer.name}
                    />
                    <div className="badge-list">
                      {selectedProfile.title ? (
                        <span
                          className={
                            selectedProfile.title.category === "legend"
                              ? "title-pill title-pill--legend"
                              : "title-pill title-pill--fun"
                          }
                        >
                          {selectedProfile.title.label}
                        </span>
                      ) : null}
                      {selectedProfile.aiModel ? <span className="section-note">AI 当前称号</span> : null}
                      <span
                        className={
                          selectedPlayer.isActive ? "status-pill status-pill--active" : "status-pill"
                        }
                      >
                        {selectedPlayer.isActive ? "启用中" : "已停用"}
                      </span>
                    </div>
                    <p className="player-row__note">
                      {selectedProfile.title?.reason ?? "先打几场比赛，让系统给出更完整的判断。"}
                    </p>
                    {selectedProfile.photoCount > 1 ? (
                      <div className="preview-photo-strip">
                        {selectedProfile.photos.map((photo) => (
                          <img
                            key={photo.id}
                            alt={`${selectedPlayer.name} 的历史照片`}
                            className={
                              selectedProfile.featuredPhoto?.id === photo.id
                                ? "preview-photo-strip__thumb preview-photo-strip__thumb--active"
                                : "preview-photo-strip__thumb"
                            }
                            loading="lazy"
                            src={photo.imageData}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="preview-value-card">
                    <span>{selectedProfile.aiModel ? "AI 当前估值" : "当前估值"}</span>
                    <strong>{formatCurrency(selectedProfile.marketValue.amountUsd)}</strong>
                    <p>{selectedProfile.marketValue.tier}</p>
                    {selectedProfile.aiModel ? <small>模型：{selectedProfile.aiModel}</small> : null}
                  </div>
                </div>

                <div className="preview-stat-grid">
                  <article className="preview-stat-card">
                    <span>ELO</span>
                    <strong>{selectedProfile.rating}</strong>
                    <p>最近比赛：{formatDateTime(selectedProfile.lastMatchAt)}</p>
                  </article>
                  <article className="preview-stat-card">
                    <span>总战绩</span>
                    <strong>
                      {selectedProfile.wins}-{selectedProfile.losses}
                    </strong>
                    <p>胜率 {formatPercent(selectedProfile.winRate)}</p>
                  </article>
                  <article className="preview-stat-card">
                    <span>最近 5 场</span>
                    <strong>
                      {selectedProfile.recentForm.wins} 胜 {selectedProfile.recentForm.losses} 负
                    </strong>
                    <p>{selectedProfile.recentForm.trend.join(" · ") || "暂无记录"}</p>
                  </article>
                  <article className="preview-stat-card">
                    <span>连串纪录</span>
                    <strong>
                      {selectedProfile.bestWinStreak} / {selectedProfile.worstLossStreak}
                    </strong>
                    <p>最长连胜 / 最长连败</p>
                  </article>
                </div>

                <div className="preview-columns">
                  <section className="preview-panel">
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">Achievements</p>
                        <h3>成就与称号</h3>
                      </div>
                      <span className="section-note">
                        {selectedProfile.achievements.length} 个成就
                      </span>
                    </div>
                    {selectedProfile.unlockedTitles.length > 0 ? (
                      <div className="preview-title-list">
                        {selectedProfile.unlockedTitles.map((title) => (
                          <article key={title.key} className="preview-title-card">
                            <strong>{title.label}</strong>
                            <span>{title.category === "legend" ? "传奇向" : "整活向"}</span>
                            <p>{title.reason}</p>
                          </article>
                        ))}
                      </div>
                    ) : null}
                    {selectedProfile.achievements.length > 0 ? (
                      <div className="preview-achievement-list">
                        {selectedProfile.achievements.map((achievement) => (
                          <article key={achievement.key} className="preview-achievement-card">
                            <div className="preview-achievement-card__top">
                              <strong>{achievement.label}</strong>
                              <span>{achievement.value}</span>
                            </div>
                            <p>{achievement.detail}</p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="algorithm-note">目前还没打出明确成就，先继续上桌。</p>
                    )}
                  </section>

                  <section className="preview-panel">
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">Market Price</p>
                        <h3>{selectedProfile.aiModel ? "AI 评价与身价" : "身价评估"}</h3>
                      </div>
                    </div>
                    <p className="algorithm-note">{selectedProfile.evaluation}</p>
                    <div className="preview-factor-list">
                      {selectedProfile.marketValue.factors.map((factor) => (
                        <article key={factor} className="preview-factor-card">
                          {factor}
                        </article>
                      ))}
                    </div>
                    <p className="player-row__note">
                      <Link href="/players">去球员管理继续上传照片</Link>
                    </p>
                    <p className="player-row__note">
                      AI 素材：{selectedProfile.aiHooks.join(" · ") || "当前素材不足"}
                    </p>
                  </section>
                </div>

                <section className="preview-panel">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Head to Head</p>
                      <h3>对阵分析</h3>
                    </div>
                    <span className="section-note">{selectedProfile.opponentSummaries.length} 位对手</span>
                  </div>

                  {selectedProfile.opponentSummaries.length > 0 ? (
                    <div className="preview-opponent-grid">
                      {selectedProfile.opponentSummaries.map((summary) => (
                        <article key={summary.opponentId} className="preview-opponent-card">
                          <div className="preview-opponent-card__top">
                            <div>
                              <strong>{summary.opponentName}</strong>
                              <p>
                                {summary.wins} 胜 {summary.losses} 负 · 共 {summary.totalMatches} 场
                              </p>
                            </div>
                            <span
                              className={
                                summary.winRate >= 0.5
                                  ? "title-pill title-pill--legend"
                                  : "title-pill title-pill--fun"
                              }
                            >
                              {formatPercent(summary.winRate)}
                            </span>
                          </div>
                          <div className="preview-opponent-card__bar" aria-hidden="true">
                            <span style={{ width: `${Math.round(summary.winRate * 100)}%` }} />
                          </div>
                          <small>最近交手：{formatDateTime(summary.lastMatchAt)}</small>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="algorithm-note">还没有形成对阵样本。</p>
                  )}
                </section>

                <section className="preview-panel">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Full History</p>
                      <h3>完整比赛记录</h3>
                    </div>
                    <span className="section-note">{selectedProfile.matchHistory.length} 场</span>
                  </div>

                  {selectedProfile.matchHistory.length > 0 ? (
                    <div className="preview-match-list">
                      {selectedProfile.matchHistory.map((match) => (
                        <article key={`history-${match.id}`} className="preview-match-card">
                          <div className="preview-match-card__top">
                            <div>
                              <strong>
                                {match.result === "W" ? "胜" : "负"} {match.opponentName}
                              </strong>
                              <p>{match.scoreline}</p>
                            </div>
                            <div className="preview-match-card__meta">
                              <span
                                className={
                                  match.result === "W"
                                    ? "title-pill title-pill--legend"
                                    : "title-pill title-pill--fun"
                                }
                              >
                                {match.result === "W" ? `+${match.ratingDelta}` : match.ratingDelta}
                              </span>
                              <small>{formatDateTime(match.createdAt)}</small>
                            </div>
                          </div>
                          {match.moments.length > 0 ? (
                            <div className="badge-list">
                              {match.moments.map((moment) => (
                                <span
                                  key={`history-${match.id}-${moment}`}
                                  className={
                                    match.result === "W" ? "badge badge--glory" : "badge badge--chaos"
                                  }
                                >
                                  {moment}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {match.note ? <p>{match.note}</p> : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="algorithm-note">还没有完整战绩可展示。</p>
                  )}
                </section>
              </section>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
