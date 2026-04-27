"use client";

import { FormEvent, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { useAppState } from "@/lib/app-state";

export function MatchesView() {
  const { activePlayers, addMatch, isLoaded } = useAppState();
  const [winnerId, setWinnerId] = useState("");
  const [loserId, setLoserId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const winnerOptions = activePlayers.filter((player) => player.id !== loserId);
  const loserOptions = activePlayers.filter((player) => player.id !== winnerId);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const result = addMatch(winnerId, loserId);
      setSuccess(
        `${result.winnerName} 记一胜，积分 +${result.winnerDelta}；${result.loserName} 积分 ${result.loserDelta}。`,
      );
      setWinnerId("");
      setLoserId("");
      setError("");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "录入比赛时发生未知错误",
      );
      setSuccess("");
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">New Match</p>
          <h2>录入一场比赛</h2>
        </div>
        <span className="section-note">只记录胜负，不记比分</span>
      </div>

      {!isLoaded ? <p>正在读取本地比赛数据...</p> : null}

      {isLoaded && activePlayers.length < 2 ? (
        <EmptyState
          title="至少需要两位启用中的球员"
          description="去球员管理页先创建球员，或把已停用的球员重新启用。"
        />
      ) : (
        <form className="form-grid form-grid--match" onSubmit={handleSubmit}>
          <label className="field">
            <span>胜者</span>
            <select value={winnerId} onChange={(event) => setWinnerId(event.target.value)}>
              <option value="">请选择胜者</option>
              {winnerOptions.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>负者</span>
            <select value={loserId} onChange={(event) => setLoserId(event.target.value)}>
              <option value="">请选择负者</option>
              {loserOptions.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>

          <button className="button button--primary" type="submit">
            提交胜负结果
          </button>
        </form>
      )}

      {error ? <p className="feedback feedback--error">{error}</p> : null}
      {success ? <p className="feedback feedback--success">{success}</p> : null}
    </section>
  );
}
