"use client";

import { FormEvent, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { formatDateTime } from "@/lib/format";
import { useAppState } from "@/lib/app-state";

export function PlayersView() {
  const { state, createPlayer, togglePlayer, isLoaded } = useAppState();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      createPlayer(name);
      setName("");
      setError("");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "创建球员时发生未知错误",
      );
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Roster</p>
            <h2>新增球员</h2>
          </div>
          <span className="section-note">昵称全站唯一</span>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            <span>球员名称</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="比如：阿杰 / 小王 / Seven"
            />
          </label>
          <button className="button button--primary" type="submit">
            创建球员
          </button>
        </form>
        {error ? <p className="feedback feedback--error">{error}</p> : null}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Players</p>
            <h2>球员列表</h2>
          </div>
          <span className="section-note">{state.players.length} 位</span>
        </div>

        {!isLoaded ? <p>正在读取本地球员数据...</p> : null}
        {isLoaded && state.players.length === 0 ? (
          <EmptyState
            title="还没有球员"
            description="先添加至少两位球员，才能开始录入胜负关系并计算排名。"
          />
        ) : null}

        <div className="player-list">
          {state.players.map((player) => (
            <article key={player.id} className="player-row">
              <div>
                <div className="player-row__title">
                  <h3>{player.name}</h3>
                  <span
                    className={
                      player.isActive ? "status-pill status-pill--active" : "status-pill"
                    }
                  >
                    {player.isActive ? "启用中" : "已停用"}
                  </span>
                </div>
                <p>创建时间：{formatDateTime(player.createdAt)}</p>
              </div>
              <button className="button" onClick={() => togglePlayer(player.id)} type="button">
                {player.isActive ? "停用" : "重新启用"}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
