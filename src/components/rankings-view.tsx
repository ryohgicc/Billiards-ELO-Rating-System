"use client";

import { Activity, ArrowDown, ArrowUp, Gauge, Medal, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { PlayerPhotoFrame } from "@/components/player-photo-frame";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";
import { useAppState } from "@/lib/app-state";
import { groupEntriesByLocalDay } from "@/lib/history";
import { buildLeaderInsight } from "@/lib/leader-insight";
import {
  buildRankingMovements,
  buildRankingsThroughLocalDay,
  getPreviousRankingDateKey,
} from "@/lib/rating";
import type { RankingMovement } from "@/lib/types";

function getPodiumLabel(rank: number) {
  if (rank === 1) {
    return "冠军";
  }

  if (rank === 2) {
    return "亚军";
  }

  if (rank === 3) {
    return "季军";
  }

  return null;
}

function PodiumBadge({ rank }: { rank: number }) {
  const label = getPodiumLabel(rank);

  if (!label) {
    return null;
  }

  const Icon = rank === 1 ? Trophy : Medal;

  return (
    <span className={`ranking-podium-badge ranking-podium-badge--rank-${rank}`}>
      <Icon aria-hidden="true" size={15} strokeWidth={2.4} />
      {label}
    </span>
  );
}

function formatSignedValue(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function RankingMovementBadge({ movement }: { movement: RankingMovement }) {
  if (movement.status === "up") {
    return (
      <span
        className="ranking-movement ranking-movement--up"
        title={`较前一比赛日上升 ${movement.places} 名`}
      >
        <ArrowUp aria-hidden="true" size={13} strokeWidth={2.8} />
        {movement.places}
      </span>
    );
  }

  if (movement.status === "down") {
    return (
      <span
        className="ranking-movement ranking-movement--down"
        title={`较前一比赛日下降 ${movement.places} 名`}
      >
        <ArrowDown aria-hidden="true" size={13} strokeWidth={2.8} />
        {movement.places}
      </span>
    );
  }

  if (movement.status === "new") {
    return (
      <span className="ranking-movement ranking-movement--new" title="较前一比赛日新上榜">
        新
      </span>
    );
  }

  return (
    <span className="ranking-movement ranking-movement--same" title="较前一比赛日排名不变">
      -
    </span>
  );
}

export function RankingsView() {
  const { rankings, state, timeline, isLoaded, profilesByPlayerId } = useAppState();
  const dailyGroups = groupEntriesByLocalDay(timeline);
  const [selectedViewKey, setSelectedViewKey] = useState("overall");
  const selectedDateGroup = dailyGroups.find((group) => group.dateKey === selectedViewKey);
  const visibleRankings =
    selectedViewKey === "overall"
      ? rankings
      : buildRankingsThroughLocalDay(
          state.players,
          state.matches,
          selectedViewKey,
          state.settings.kFactor,
        );
  const previousDateKey = getPreviousRankingDateKey(dailyGroups, selectedViewKey);
  const previousRankings = previousDateKey
    ? buildRankingsThroughLocalDay(
        state.players,
        state.matches,
        previousDateKey,
        state.settings.kFactor,
      )
    : null;
  const rankingMovements = buildRankingMovements(visibleRankings, previousRankings);
  const leader = visibleRankings[0];
  const leaderInsight = buildLeaderInsight(visibleRankings);
  const leaderProfile = leader ? profilesByPlayerId[leader.player.id] : null;

  if (!isLoaded) {
    return <section className="panel">正在读取共享积分数据...</section>;
  }

  if (rankings.length === 0) {
    return (
      <section className="panel">
        <EmptyState
          title="还没有上榜球员"
          description="先去球员管理里创建两位球员，再录入一场比赛，排行榜就会自动出现。"
        />
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="panel spotlight">
        {leaderProfile ? (
          <PlayerPhotoFrame
            compact
            hideText
            href={`/preview?player=${encodeURIComponent(leader.player.id)}`}
            photo={leaderProfile.featuredPhoto}
            playerId={leader.player.id}
            playerName={leader.player.name}
          />
        ) : null}
        <div className="spotlight__content">
          <div className="spotlight__identity">
            <span className="spotlight__rank">#1</span>
            <div>
              <p className="eyebrow">
                {selectedViewKey === "overall" ? "当前榜首" : "当日榜首"}
              </p>
              <h2>
                <Link href={`/preview?player=${encodeURIComponent(leader.player.id)}`}>
                  {leader.player.name}
                </Link>
              </h2>
              {leaderProfile?.title ? (
                <span
                  className={
                    leaderProfile.title.category === "legend"
                      ? "title-pill title-pill--legend"
                      : "title-pill title-pill--fun"
                  }
                >
                  {leaderProfile.title.label}
                </span>
              ) : null}
            </div>
          </div>

          <div className="spotlight__brief">
            <span>{leaderInsight.headline}</span>
            <strong>{leaderInsight.subline}</strong>
          </div>

          <div className="spotlight__power">
            <div>
              <span>ELO POWER</span>
              <strong>{formatSignedValue(leaderInsight.ratingGain)}</strong>
            </div>
            <div className="spotlight__power-track" aria-hidden="true">
              <span style={{ width: `${leaderInsight.dominancePercent}%` }} />
            </div>
          </div>
        </div>

        <div className="spotlight__meta">
          <span>
            <Gauge aria-hidden="true" size={16} />
            <strong>{leader.rating}</strong>
            积分
          </span>
          <span>
            <Activity aria-hidden="true" size={16} />
            <strong>{formatSignedValue(leaderInsight.ratingGain)}</strong>
            净增
          </span>
          <span>
            <strong>
              {leader.wins}-{leader.losses}
            </strong>
            战绩
          </span>
          <span>
            <strong>{formatPercent(leader.winRate)}</strong>
            胜率
          </span>
          <span>
            <strong>
              {leaderInsight.leadOverSecond === null
                ? "待挑战"
                : `+${leaderInsight.leadOverSecond}`}
            </strong>
            领先
          </span>
          <span>
            <strong>{formatDateTime(leader.lastMatchAt)}</strong>
            最近比赛
          </span>
          <span>
            <strong>{leaderProfile ? formatCurrency(leaderProfile.marketValue.amountUsd) : "暂无"}</strong>
            身价
          </span>
        </div>
        <div className="spotlight__watermark" aria-hidden="true">
          #01
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Live Ranking</p>
            <h2>积分排行榜</h2>
          </div>
          <span className="section-note">
            {selectedDateGroup?.dateLabel ?? "总榜"} · K 值 {state.settings.kFactor}
          </span>
        </div>

        <div className="date-switcher" aria-label="按日期查看积分排行榜">
          <button
            aria-pressed={selectedViewKey === "overall"}
            className={
              selectedViewKey === "overall"
                ? "date-switcher__button date-switcher__button--active"
                : "date-switcher__button"
            }
            onClick={() => setSelectedViewKey("overall")}
            type="button"
          >
            <span>总榜</span>
            <strong>{rankings.length} 人</strong>
          </button>
          {dailyGroups.map((group) => (
            <button
              key={group.dateKey}
              aria-pressed={group.dateKey === selectedViewKey}
              className={
                group.dateKey === selectedViewKey
                  ? "date-switcher__button date-switcher__button--active"
                  : "date-switcher__button"
              }
              onClick={() => setSelectedViewKey(group.dateKey)}
              type="button"
            >
              <span>{group.dateLabel}</span>
              <strong>截至当天</strong>
            </button>
          ))}
        </div>

        <div className="ranking-list ranking-list--mobile">
          {visibleRankings.map((entry) => {
            const profile = profilesByPlayerId[entry.player.id];

            return (
              <article
                key={entry.player.id}
                className={
                  entry.rank <= 3
                    ? `ranking-card ranking-card--podium ranking-card--rank-${entry.rank}`
                    : "ranking-card"
                }
              >
                {profile ? (
                  <PlayerPhotoFrame
                    compact
                    hideText
                    href={`/preview?player=${encodeURIComponent(entry.player.id)}`}
                    photo={profile.featuredPhoto}
                    playerId={entry.player.id}
                    playerName={entry.player.name}
                  />
                ) : null}
                <div className="ranking-card__top">
                  <span className="ranking-card__rank">
                    #{entry.rank}
                    <RankingMovementBadge movement={rankingMovements[entry.player.id]} />
                  </span>
                  <div>
                    <div className="ranking-card__name">
                      <h3>
                        <Link href={`/preview?player=${encodeURIComponent(entry.player.id)}`}>
                          {entry.player.name}
                        </Link>
                      </h3>
                      <PodiumBadge rank={entry.rank} />
                    </div>
                    {profile?.title ? (
                      <p className="ranking-card__title-note">{profile.title.label}</p>
                    ) : null}
                    <p>最近比赛：{formatDateTime(entry.lastMatchAt)}</p>
                  </div>
                  <strong>{entry.rating}</strong>
                </div>
                <div className="ranking-card__stats">
                  <span>{entry.wins} 胜</span>
                  <span>{entry.losses} 负</span>
                  <span>胜率 {formatPercent(entry.winRate)}</span>
                  <span>最长连胜 {profile?.bestWinStreak ?? 0}</span>
                  <span>身价 {profile ? formatCurrency(profile.marketValue.amountUsd) : "暂无"}</span>
                </div>
              </article>
            );
          })}
        </div>

        <div className="table-wrap">
          <table className="ranking-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>较前日</th>
                <th>球员</th>
                <th>积分</th>
                <th>战绩</th>
                <th>胜率</th>
                <th>最近比赛</th>
              </tr>
            </thead>
            <tbody>
              {visibleRankings.map((entry) => {
                const profile = profilesByPlayerId[entry.player.id];

                return (
                  <tr
                    key={entry.player.id}
                    className={
                      entry.rank <= 3
                        ? `ranking-table__row ranking-table__row--rank-${entry.rank}`
                        : "ranking-table__row"
                    }
                  >
                    <td>
                      <span className="ranking-rank-cell">
                        #{entry.rank}
                        <PodiumBadge rank={entry.rank} />
                      </span>
                    </td>
                    <td>
                      <RankingMovementBadge movement={rankingMovements[entry.player.id]} />
                    </td>
                    <td>
                      <div className="ranking-table__player">
                        {profile ? (
                          <PlayerPhotoFrame
                            compact
                            hideText
                            href={`/preview?player=${encodeURIComponent(entry.player.id)}`}
                            photo={profile.featuredPhoto}
                            playerId={entry.player.id}
                            playerName={entry.player.name}
                          />
                        ) : null}
                        <div className="ranking-table__player-meta">
                          <Link href={`/preview?player=${encodeURIComponent(entry.player.id)}`}>
                            {entry.player.name}
                          </Link>
                          {profile?.title ? <small>{profile.title.label}</small> : null}
                        </div>
                      </div>
                    </td>
                    <td>{entry.rating}</td>
                    <td>
                      {entry.wins}-{entry.losses}
                    </td>
                    <td>{formatPercent(entry.winRate)}</td>
                    <td>{formatDateTime(entry.lastMatchAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
