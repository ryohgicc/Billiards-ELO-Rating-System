"use client";

import { Activity, ArrowDown, ArrowUp, Gauge, Medal, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { PlayerPhotoFrame } from "@/components/player-photo-frame";
import { DEFAULT_K_FACTOR } from "@/lib/constants";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";
import { useAppState } from "@/lib/app-state";
import { buildLeaderInsight } from "@/lib/leader-insight";
import { buildPlayerProfiles } from "@/lib/player-honors";
import {
  buildMonthlyRankingSnapshots,
  buildPlayerRankDayCounts,
  buildPreviousMonthlyRankings,
  buildRankingMovements,
  buildRankingsForMonth,
  getCurrentLocalMonthKey,
  getLocalDateKey,
  getLocalMonthKey,
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

function RankDayTags({ bottomDays, topDays }: { bottomDays: number; topDays: number }) {
  return (
    <span className="ranking-day-tags" title="按排行榜生效的日历日统计">
      <span className="ranking-day-tag ranking-day-tag--top">登顶 {topDays} 天</span>
      <span className="ranking-day-tag ranking-day-tag--bottom">垫底 {bottomDays} 天</span>
    </span>
  );
}

function CalibrationBadge({
  calibrationMatches,
  className = "",
}: {
  calibrationMatches: number;
  className?: string;
}) {
  if (calibrationMatches >= 5) {
    return null;
  }

  return (
    <span className={`title-pill title-pill--legend ranking-calibration-pill ${className}`.trim()}>
      定级中
    </span>
  );
}

export function RankingsView() {
  const { rankings, state, isLoaded, profilesByPlayerId } = useAppState();
  const currentMonthKey = getCurrentLocalMonthKey();
  const monthlySnapshots = buildMonthlyRankingSnapshots(
    state.players,
    state.matches,
    DEFAULT_K_FACTOR,
  );
  const [selectedViewKey, setSelectedViewKey] = useState(currentMonthKey);
  const selectedMonthKey = selectedViewKey;
  const selectedSnapshot = monthlySnapshots.find((snapshot) => snapshot.monthKey === selectedMonthKey);
  const visibleRankings =
    selectedMonthKey === currentMonthKey
      ? rankings
      : selectedSnapshot?.rankings ??
        buildRankingsForMonth(state.players, state.matches, selectedMonthKey, DEFAULT_K_FACTOR);
  const monthOptions = [
    {
      monthKey: currentMonthKey,
      monthLabel: "本月",
      snapshotDateKey: "",
      rankings,
    },
    ...monthlySnapshots.filter((snapshot) => snapshot.monthKey !== currentMonthKey),
  ];
  const selectedMonthMatches = state.matches.filter(
    (match) => getLocalMonthKey(match.createdAt) === selectedMonthKey,
  );
  const rankDayCountEndDateKey =
    selectedMonthKey === currentMonthKey
      ? getLocalDateKey(new Date().toISOString())
      : selectedSnapshot?.snapshotDateKey;
  const previousRankings = rankDayCountEndDateKey
    ? buildPreviousMonthlyRankings(
      state.players,
      state.matches,
      selectedMonthKey,
      rankDayCountEndDateKey,
      DEFAULT_K_FACTOR,
    )
    : null;
  const rankDayCounts = buildPlayerRankDayCounts(
    state.players,
    state.matches,
    selectedMonthKey,
    rankDayCountEndDateKey,
    DEFAULT_K_FACTOR,
  );
  const selectedProfilesByPlayerId = useMemo(() => {
    if (selectedMonthKey === currentMonthKey) {
      return profilesByPlayerId;
    }

    return buildPlayerProfiles(
      state.players,
      selectedMonthMatches,
      state.photos,
      DEFAULT_K_FACTOR,
    );
  }, [
    currentMonthKey,
    profilesByPlayerId,
    selectedMonthKey,
    selectedMonthMatches,
    state.photos,
    state.players,
  ]);
  const rankingMovements = buildRankingMovements(visibleRankings, previousRankings);
  const leader = visibleRankings[0];
  const leaderInsight = buildLeaderInsight(visibleRankings);
  const leaderProfile = leader ? selectedProfilesByPlayerId[leader.player.id] : null;

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
                {selectedMonthKey === currentMonthKey ? "本月榜首" : "月度归档榜首"}
              </p>
              <h2>
                <Link href={`/preview?player=${encodeURIComponent(leader.player.id)}`}>
                  {leader.player.name}
                </Link>
              </h2>
              <CalibrationBadge
                calibrationMatches={leaderProfile?.monthlyRating.calibrationMatches ?? 5}
                className="ranking-calibration-pill--spotlight"
              />
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
            {selectedMonthKey === currentMonthKey
              ? "本月赛季"
              : `${selectedSnapshot?.monthLabel ?? selectedMonthKey} 归档`}
            {" · K 值 "}
            {DEFAULT_K_FACTOR}
          </span>
        </div>

        <div className="date-switcher" aria-label="按月份查看积分排行榜">
          {monthOptions.map((group) => (
            <button
              key={group.monthKey}
              aria-pressed={group.monthKey === selectedMonthKey}
              className={
                group.monthKey === selectedMonthKey
                  ? "date-switcher__button date-switcher__button--active"
                  : "date-switcher__button"
              }
              onClick={() => setSelectedViewKey(group.monthKey)}
              type="button"
            >
              <span>{group.monthLabel}</span>
              <strong>
                {group.snapshotDateKey ? `保留至 ${group.snapshotDateKey}` : `${rankings.length} 人`}
              </strong>
            </button>
          ))}
        </div>

        <div className="ranking-list ranking-list--mobile">
          {visibleRankings.map((entry) => {
            const profile = selectedProfilesByPlayerId[entry.player.id];

            return (
              <article
                key={entry.player.id}
                className={[
                  entry.rank <= 3
                    ? `ranking-card ranking-card--podium ranking-card--rank-${entry.rank}`
                    : "ranking-card",
                  profile ? "ranking-card--with-photo" : "ranking-card--no-photo",
                ].join(" ")}
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
                    <CalibrationBadge calibrationMatches={profile?.monthlyRating.calibrationMatches ?? 5} />
                    {profile?.title ? (
                      <p className="ranking-card__title-note">{profile.title.label}</p>
                    ) : null}
                    <RankDayTags
                      bottomDays={rankDayCounts[entry.player.id]?.bottomDays ?? 0}
                      topDays={rankDayCounts[entry.player.id]?.topDays ?? 0}
                    />
                    <p className="ranking-card__meta-line">
                      最近比赛：{formatDateTime(entry.lastMatchAt)}
                    </p>
                  </div>
                  <strong className="ranking-card__rating">{entry.rating}</strong>
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
                const profile = selectedProfilesByPlayerId[entry.player.id];

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
                          <CalibrationBadge calibrationMatches={profile?.monthlyRating.calibrationMatches ?? 5} />
                          {profile?.title ? <small>{profile.title.label}</small> : null}
                          <RankDayTags
                            bottomDays={rankDayCounts[entry.player.id]?.bottomDays ?? 0}
                            topDays={rankDayCounts[entry.player.id]?.topDays ?? 0}
                          />
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
