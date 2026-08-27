"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Hash, TimerReset } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { useAppState } from "@/lib/app-state";
import {
  buildReservationOrderHistory,
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
  const { activePlayers, isLoaded } = useAppState();
  const [now, setNow] = useState(() => new Date());
  const [dateSeed, setDateSeed] = useState(() => getLocalDateKey());
  const [selectedDateKey, setSelectedDateKey] = useState(dateSeed);

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
      setSelectedDateKey(getLocalDateKey(nextNow));
    }, calculateMillisecondsUntilNextLocalMidnight(currentNow));

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dateSeed]);

  const reservationHistory = useMemo(
    () => buildReservationOrderHistory(activePlayers, dateSeed),
    [activePlayers, dateSeed],
  );
  const selectedDay = reservationHistory.find((day) => day.dateKey === selectedDateKey);
  const visibleDay = selectedDay ?? reservationHistory[0];
  const reservationOrder = visibleDay?.entries ?? [];
  const millisecondsUntilRefresh = calculateMillisecondsUntilNextLocalMidnight(now);

  return (
    <div className="stack">
      <section className="panel reservation-hero">
        <div className="reservation-hero__copy">
          <p className="eyebrow">Reservation Draw</p>
          <h2>每日排序</h2>
          <p>
            每天 0 点用当天日期和启用球员名单重新随机排序。同一天内顺序保持稳定，
            不参考战绩或活跃度，并会避免同一球员连续进入前二或后二。
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
            <strong>{reservationHistory[0]?.entries.length ?? 0}</strong>
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
            <h2>每日排序</h2>
          </div>
          <span className="section-note">{visibleDay?.dateLabel ?? "仅启用球员参与"}</span>
        </div>

        {!isLoaded ? <p>正在读取云端球员数据...</p> : null}
        {isLoaded && reservationHistory.length === 0 ? (
          <EmptyState
            title="还没有可预约球员"
            description="先在球员管理里新增并启用球员，每日排序会在每天 0 点自动生成。"
          />
        ) : null}

        {reservationHistory.length > 0 ? (
          <div className="date-switcher reservation-history" aria-label="查看每日排序历史">
            {reservationHistory.map((day) => (
              <button
                className={`date-switcher__button${
                  day.dateKey === visibleDay?.dateKey ? " date-switcher__button--active" : ""
                }`}
                key={day.dateKey}
                onClick={() => setSelectedDateKey(day.dateKey)}
                type="button"
              >
                <span>{day.dateKey === dateSeed ? "今天" : "历史"}</span>
                <strong>{day.dateLabel}</strong>
              </button>
            ))}
          </div>
        ) : null}

        {reservationOrder.length > 0 ? (
          <div className="reservation-list" aria-label="每日排序名单">
            {reservationOrder.map((entry) => (
              <article className="reservation-card" key={entry.player.id}>
                <span className="reservation-card__order">#{entry.order}</span>
                <div>
                  <h3>{entry.player.name}</h3>
                  <p>随机签号 {entry.drawNumberLabel}</p>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Transparent Algorithm</p>
            <h2>每日排序说明</h2>
          </div>
        </div>

        <div className="algorithm-copy">
          <p>
            每天 0 点页面会重新生成当天排序：先取当时所有启用中的球员，再为每个人生成一个当天随机签号。
            基础签号越小越靠前，随后系统会参考前一天结果，避免同一球员连续进入前二或后二。
          </p>
          <p>
            每天的日期种子是浏览器本地日期，格式为 <code>YYYY-MM-DD</code>。参与名单只包含当前启用中的球员。
          </p>
          <p>
            每位球员的输入为 <code>日期|球员ID|创建时间</code>，再计算
            <code> FNV-1a 32-bit hash</code> 得到当天随机签号。因为日期每天都会变化，同一批球员每天都会重新洗牌。
          </p>
          <p>
            系统按随机签号从小到大排列；极少数签号完全相同时，只用球员创建时间和球员 ID 作为稳定兜底。
            页面打开时会计算距离下一个本地 0 点的时间，到点后自动切换新一天的日期种子并刷新顺序。
          </p>
        </div>
      </section>
    </div>
  );
}
