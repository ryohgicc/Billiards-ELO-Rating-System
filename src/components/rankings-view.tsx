"use client";

import { Activity, Gauge, Medal, Trophy } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { formatDateTime, formatPercent } from "@/lib/format";
import { useAppState } from "@/lib/app-state";
import { groupEntriesByLocalDay } from "@/lib/history";
import { buildLeaderInsight } from "@/lib/leader-insight";
import { buildRankingsThroughLocalDay } from "@/lib/rating";

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

export function RankingsView() {
  const { rankings, state, timeline, isLoaded } = useAppState();
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
  const leader = visibleRankings[0];
  const leaderInsight = buildLeaderInsight(visibleRankings);

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
        <div className="spotlight__content">
          <div className="spotlight__identity">
            <span className="spotlight__rank">#1</span>
            <div>
              <p className="eyebrow">
                {selectedViewKey === "overall" ? "当前榜首" : "当日榜首"}
              </p>
              <h2>{leader.player.name}</h2>
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
          {visibleRankings.map((entry) => (
            <article
              key={entry.player.id}
              className={
                entry.rank <= 3
                  ? `ranking-card ranking-card--podium ranking-card--rank-${entry.rank}`
                  : "ranking-card"
              }
            >
              <div className="ranking-card__top">
                <span className="ranking-card__rank">#{entry.rank}</span>
                <div>
                  <div className="ranking-card__name">
                    <h3>{entry.player.name}</h3>
                    <PodiumBadge rank={entry.rank} />
                  </div>
                  <p>最近比赛：{formatDateTime(entry.lastMatchAt)}</p>
                </div>
                <strong>{entry.rating}</strong>
              </div>
              <div className="ranking-card__stats">
                <span>{entry.wins} 胜</span>
                <span>{entry.losses} 负</span>
                <span>胜率 {formatPercent(entry.winRate)}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="table-wrap">
          <table className="ranking-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>球员</th>
                <th>积分</th>
                <th>战绩</th>
                <th>胜率</th>
                <th>最近比赛</th>
              </tr>
            </thead>
            <tbody>
              {visibleRankings.map((entry) => (
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
                  <td>{entry.player.name}</td>
                  <td>{entry.rating}</td>
                  <td>
                    {entry.wins}-{entry.losses}
                  </td>
                  <td>{formatPercent(entry.winRate)}</td>
                  <td>{formatDateTime(entry.lastMatchAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
