"use client";

import { Medal, Trophy } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { formatDateTime, formatPercent } from "@/lib/format";
import { useAppState } from "@/lib/app-state";

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

export function RankingsView() {
  const { rankings, state, isLoaded } = useAppState();

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
        <div>
          <p className="eyebrow">当前榜首</p>
          <h2>{rankings[0].player.name}</h2>
        </div>
        <div className="spotlight__meta">
          <span>{rankings[0].rating} 分</span>
          <span>{rankings[0].wins} 胜</span>
          <span>{rankings[0].losses} 负</span>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Live Ranking</p>
            <h2>积分排行榜</h2>
          </div>
          <span className="section-note">K 值 {state.settings.kFactor}</span>
        </div>

        <div className="ranking-list ranking-list--mobile">
          {rankings.map((entry) => (
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
              {rankings.map((entry) => (
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
