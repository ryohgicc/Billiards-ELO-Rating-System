"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Hash, TimerReset } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { useAppState } from "@/lib/app-state";
import {
  buildRecentActiveDayCounts,
  buildReservationOrder,
  calculateMillisecondsUntilNextLocalMidnight,
  getLocalDateKey,
} from "@/lib/reservation-order";

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function ReservationView() {
  const { activePlayers, isLoaded, state } = useAppState();
  const [now, setNow] = useState(() => new Date());
  const [dateSeed, setDateSeed] = useState(() => getLocalDateKey());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const currentNow = new Date();
    const timeoutId = window.setTimeout(() => {
      const nextNow = new Date();

      setNow(nextNow);
      setDateSeed(getLocalDateKey(nextNow));
    }, calculateMillisecondsUntilNextLocalMidnight(currentNow));

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dateSeed]);

  const recentActiveDayCountsByPlayerId = useMemo(
    () => buildRecentActiveDayCounts(state.matches, dateSeed),
    [dateSeed, state.matches],
  );
  const reservationOrder = useMemo(
    () =>
      buildReservationOrder(
        activePlayers,
        dateSeed,
        undefined,
        recentActiveDayCountsByPlayerId,
      ),
    [activePlayers, dateSeed, recentActiveDayCountsByPlayerId],
  );
  const millisecondsUntilRefresh = calculateMillisecondsUntilNextLocalMidnight(now);

  return (
    <div className="stack">
      <section className="panel reservation-hero">
        <div className="reservation-hero__copy">
          <p className="eyebrow">Reservation Draw</p>
          <h2>今日上场顺序</h2>
          <p>
            每天 0 点用当天日期和启用球员名单重新抽签。同一天内顺序保持稳定，
            方便大家提前确认排队节奏。
          </p>
        </div>
        <div className="reservation-hero__meta" aria-label="预约抽签状态">
          <span>
            <CalendarClock aria-hidden="true" size={18} />
            <strong>{dateSeed}</strong>
            今日日期
          </span>
          <span>
            <Hash aria-hidden="true" size={18} />
            <strong>{reservationOrder.length}</strong>
            参与球员
          </span>
          <span>
            <TimerReset aria-hidden="true" size={18} />
            <strong>{formatCountdown(millisecondsUntilRefresh)}</strong>
            距离刷新
          </span>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Queue</p>
            <h2>预约名单</h2>
          </div>
          <span className="section-note">仅启用球员参与</span>
        </div>

        {!isLoaded ? <p>正在读取云端球员数据...</p> : null}
        {isLoaded && reservationOrder.length === 0 ? (
          <EmptyState
            title="还没有可预约球员"
            description="先在球员管理里新增并启用球员，预约页会在每天 0 点自动生成顺序。"
          />
        ) : null}

        {reservationOrder.length > 0 ? (
          <>
            <div className="reservation-list">
              {reservationOrder.map((entry) => (
                <article className="reservation-card" key={entry.player.id}>
                  <span className="reservation-card__order">#{entry.order}</span>
                  <div>
                    <h3>{entry.player.name}</h3>
                    <p>
                      签号 {entry.drawNumberLabel} · 近 7 天活跃 {entry.recentActiveDayCount} 天
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <div className="table-wrap reservation-table-wrap">
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th>顺序</th>
                    <th>球员</th>
                    <th>公开签号</th>
                    <th>近 7 天</th>
                    <th>抽签种子</th>
                  </tr>
                </thead>
                <tbody>
                  {reservationOrder.map((entry) => (
                    <tr key={entry.player.id}>
                      <td>#{entry.order}</td>
                      <td>{entry.player.name}</td>
                      <td>
                        <code>{entry.drawNumberLabel}</code>
                      </td>
                      <td>{entry.recentActiveDayCount} 天</td>
                      <td>{entry.drawSeed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Transparent Algorithm</p>
            <h2>随机算法公开说明</h2>
          </div>
        </div>

        <div className="algorithm-copy">
          <p>
            每天的日期种子是浏览器本地日期，格式为 <code>YYYY-MM-DD</code>。参与名单只包含当前启用中的球员。
            如果当天需要重置，会在日期后追加公开重置盐值；例如 <code>2026-05-08|reset-3</code>。
          </p>
          <p>
            每位球员的抽签输入为 <code>日期|球员ID|球员名称|创建时间</code>，再计算
            <code> FNV-1a 32-bit hash</code> 得到公开签号：初始值 <code>2166136261</code>，
            每个字符先异或进 hash，再乘以 <code>16777619</code>，最后取 32 位无符号整数。
          </p>
          <p>
            排序会根据近 7 天活跃天数做小幅修正：同一天无论打几场，只要有比赛就算 1 个活跃日。
            近 7 天 0 个活跃日的球员默认排在所有非 0 天球员后面；非 0 天球员内部每 1 个活跃日会让排序值减少
            <code>10000000</code>。排序值越小越靠前，所以持续来打会略微优先，但签号随机性仍然保留。
          </p>
          <p>
            系统按签号从小到大排列；如果签号完全相同，就按球员创建时间升序，再按球员 ID 升序兜底。
            从第二天开始，昨天最终垫底 2 人会先获得优先排序；这些保护规则只对近 7 天非 0 活跃日球员生效。
            如果今天前 2 名仍和昨天最终前 2 名是同一组人，且至少有 3 位非 0 天球员，
            就把今天第 3 名提到第 2 名，确保前 2 名不会连续两天相同。
          </p>
          <p>
            如果当天只有 2 位启用球员，前 2 名无法避开重复，系统会保留原始签号顺序。
            页面打开时会计算距离下一个本地 0 点的时间，到点后自动切换新一天的日期种子并刷新顺序。
          </p>
        </div>
      </section>
    </div>
  );
}
