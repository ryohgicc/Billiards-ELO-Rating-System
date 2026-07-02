"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { ResultPhotoStage } from "@/components/result-photo-stage";
import { DEFAULT_K_FACTOR } from "@/lib/constants";
import { useAppState } from "@/lib/app-state";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";
import {
  buildMonthlyRankingSnapshots,
  getCurrentLocalMonthKey,
  getLocalMonthKey,
} from "@/lib/rating";
import { buildPlayerProfiles } from "@/lib/player-honors";

export function PlayerPreviewView() {
  const { state, profilesByPlayerId, isLoaded } = useAppState();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedMonthKey, setSelectedMonthKey] = useState(getCurrentLocalMonthKey());
  const deferredSearch = useDeferredValue(search);
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const preferredPlayerId = searchParams.get("player") ?? "";
  
  // 构建月份选项
  const monthlySnapshots = buildMonthlyRankingSnapshots(
    state.players,
    state.matches,
    DEFAULT_K_FACTOR,
  );
  const currentMonthKey = getCurrentLocalMonthKey();
  const monthOptions = [
    {
      monthKey: currentMonthKey,
      monthLabel: "本月",
      snapshotDateKey: "",
    },
    ...monthlySnapshots.filter((snapshot) => snapshot.monthKey !== currentMonthKey),
  ];

  // 根据选择的月份过滤比赛
  const selectedMonthMatches = useMemo(() => {
    return state.matches.filter(
      (match) => getLocalMonthKey(match.createdAt) === selectedMonthKey,
    );
  }, [state.matches, selectedMonthKey]);

  // 计算总战绩（所有月份）
  const totalProfilesByPlayerId = profilesByPlayerId;

  // 计算当月战绩
  const monthlyProfilesByPlayerId = useMemo(() => {
    if (selectedMonthKey === currentMonthKey) {
      return profilesByPlayerId;
    }
    return buildPlayerProfiles(
      state.players,
      selectedMonthMatches,
      state.photos,
      DEFAULT_K_FACTOR,
    );
  }, [selectedMonthKey, currentMonthKey, profilesByPlayerId, state.players, selectedMonthMatches, state.photos]);
  const sortedPlayers = [...state.players].sort((left, right) => {
    const leftProfile = totalProfilesByPlayerId[left.id];
    const rightProfile = totalProfilesByPlayerId[right.id];
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
  const totalProfile = selectedPlayer ? totalProfilesByPlayerId[selectedPlayer.id] : null;
  const monthlyProfile = selectedPlayer ? monthlyProfilesByPlayerId[selectedPlayer.id] : null;

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
                const profile = totalProfilesByPlayerId[player.id];
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

            {selectedPlayer && monthlyProfile && totalProfile ? (
              <section className="preview-detail">
                <div className="preview-detail__hero">
                  <div>
                    <p className="eyebrow">Preview Card</p>
                    <h3>{selectedPlayer.name}</h3>
                    <ResultPhotoStage
                      photos={totalProfile.photos}
                      playerId={selectedPlayer.id}
                      playerName={selectedPlayer.name}
                    />
                    <div className="badge-list">
                      {totalProfile.title ? (
                        <span
                          className={
                            totalProfile.title.category === "legend"
                              ? "title-pill title-pill--legend"
                              : "title-pill title-pill--fun"
                          }
                        >
                          {totalProfile.title.label}
                        </span>
                      ) : null}
                      {totalProfile.aiModel ? <span className="section-note">AI 当前称号</span> : null}
                      <span
                        className={
                          selectedPlayer.isActive ? "status-pill status-pill--active" : "status-pill"
                        }
                      >
                        {selectedPlayer.isActive ? "启用中" : "已停用"}
                      </span>
                    </div>
                    <p className="player-row__note">
                      {totalProfile.title?.reason ?? "先打几场比赛，让系统给出更完整的判断。"}
                    </p>
                  </div>
                  <div className="preview-value-card">
                    <span>{totalProfile.aiModel ? "AI 当前估值" : "当前估值"}</span>
                    <strong>{formatCurrency(totalProfile.marketValue.amountUsd)}</strong>
                    <p>{totalProfile.marketValue.tier}</p>
                    {totalProfile.aiModel ? <small>模型：{totalProfile.aiModel}</small> : null}
                  </div>
                </div>

                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Season Stats</p>
                    <h3>赛季数据</h3>
                  </div>
                  <span className="section-note">
                    {selectedMonthKey === currentMonthKey
                      ? "本月赛季"
                      : `${monthOptions.find((m) => m.monthKey === selectedMonthKey)?.monthLabel ?? selectedMonthKey} 归档`}
                  </span>
                </div>

                <div className="date-switcher" aria-label="按月份查看球员数据">
                  {monthOptions.map((group) => (
                    <button
                      key={group.monthKey}
                      aria-pressed={group.monthKey === selectedMonthKey}
                      className={
                        group.monthKey === selectedMonthKey
                          ? "date-switcher__button date-switcher__button--active"
                          : "date-switcher__button"
                      }
                      onClick={() => setSelectedMonthKey(group.monthKey)}
                      type="button"
                    >
                      <span>{group.monthLabel}</span>
                      <strong>
                        {group.snapshotDateKey ? `保留至 ${group.snapshotDateKey}` : "当前"}
                      </strong>
                    </button>
                  ))}
                </div>

                <div className="preview-stat-grid">
                  <article className="preview-stat-card">
                    <span>ELO</span>
                    <strong>{monthlyProfile.rating}</strong>
                    <p>最近比赛：{formatDateTime(monthlyProfile.lastMatchAt)}</p>
                  </article>
                  <article className="preview-stat-card">
                    <span>当月战绩</span>
                    <strong>
                      {monthlyProfile.wins}-{monthlyProfile.losses}
                    </strong>
                    <p>胜率 {formatPercent(monthlyProfile.winRate)}</p>
                  </article>
                  <article className="preview-stat-card">
                    <span>总战绩</span>
                    <strong>
                      {totalProfile.wins}-{totalProfile.losses}
                    </strong>
                    <p>总胜率 {formatPercent(totalProfile.winRate)}</p>
                  </article>
                  <article className="preview-stat-card">
                    <span>连串纪录</span>
                    <strong>
                      {monthlyProfile.bestWinStreak} / {monthlyProfile.worstLossStreak}
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
                        {monthlyProfile.achievements.length} 个成就
                      </span>
                    </div>
                    {monthlyProfile.unlockedTitles.length > 0 ? (
                      <div className="preview-title-list">
                        {monthlyProfile.unlockedTitles.map((title) => (
                          <article key={title.key} className="preview-title-card">
                            <strong>{title.label}</strong>
                            <span>{title.category === "legend" ? "传奇向" : "整活向"}</span>
                            <p>{title.reason}</p>
                          </article>
                        ))}
                      </div>
                    ) : null}
                    {monthlyProfile.achievements.length > 0 ? (
                      <div className="preview-achievement-list">
                        {monthlyProfile.achievements.map((achievement) => (
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
                        <h3>{totalProfile.aiModel ? "AI 评价与身价" : "身价评估"}</h3>
                      </div>
                    </div>
                    <p className="algorithm-note">{totalProfile.evaluation}</p>
                    <div className="preview-factor-list">
                      {totalProfile.marketValue.factors.map((factor) => (
                        <article key={factor} className="preview-factor-card">
                          {factor}
                        </article>
                      ))}
                    </div>
                    <p className="player-row__note">
                      <Link href="/players">去球员管理继续上传照片</Link>
                    </p>
                    <p className="player-row__note">
                      AI 素材：{totalProfile.aiHooks.join(" · ") || "当前素材不足"}
                    </p>
                  </section>
                </div>

                <section className="preview-panel">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Head to Head</p>
                      <h3>对阵分析</h3>
                    </div>
                    <span className="section-note">{monthlyProfile.opponentSummaries.length} 位对手</span>
                  </div>

                  {monthlyProfile.opponentSummaries.length > 0 ? (
                    <div className="preview-opponent-grid">
                      {monthlyProfile.opponentSummaries.map((summary) => (
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
                    <span className="section-note">{monthlyProfile.matchHistory.length} 场</span>
                  </div>

                  {monthlyProfile.matchHistory.length > 0 ? (
                    <div className="preview-match-list">
                      {monthlyProfile.matchHistory.map((match) => (
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
