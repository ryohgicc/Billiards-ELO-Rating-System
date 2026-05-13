"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { ResultPhotoStage } from "@/components/result-photo-stage";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { preparePlayerPhotoPayload } from "@/lib/player-photos";
import { useAppState } from "@/lib/app-state";
import type { PlayerPhotoRole } from "@/lib/types";

export function PlayersView() {
  const {
    state,
    createPlayer,
    togglePlayer,
    updatePlayerName,
    addPlayerPhotos,
    isLoaded,
    profilesByPlayerId,
  } =
    useAppState();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [editingPlayerId, setEditingPlayerId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [uploadingPhotoTarget, setUploadingPhotoTarget] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await createPlayer(name);
      setName("");
      setError("");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "创建球员时发生未知错误",
      );
    }
  }

  async function handleRenameSubmit(playerId: string) {
    try {
      await updatePlayerName(playerId, editingName);
      setEditingPlayerId("");
      setEditingName("");
      setError("");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "更新球员名称失败",
      );
    }
  }

  async function handlePhotoUpload(
    playerId: string,
    role: PlayerPhotoRole,
    files: FileList | null,
  ) {
    if (!files || files.length === 0) {
      return;
    }

    const uploadTarget = `${playerId}:${role}`;

    try {
      setUploadingPhotoTarget(uploadTarget);
      const images = await preparePlayerPhotoPayload(files);
      await addPlayerPhotos(playerId, images, role);
      setError("");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "上传球员照片失败",
      );
    } finally {
      setUploadingPhotoTarget("");
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
          {state.players.map((player) => {
            const isEditing = editingPlayerId === player.id;
            const profile = profilesByPlayerId[player.id];
            const currentTrend =
              (profile?.currentWinStreak ?? 0) > 0
                ? `当前 ${profile?.currentWinStreak} 连胜`
                : (profile?.currentLossStreak ?? 0) > 0
                  ? `当前 ${profile?.currentLossStreak} 连败`
                  : "当前暂无连串";

            return (
              <article key={player.id} className="player-row">
                {profile ? (
                  <div className="player-row__media">
                    <ResultPhotoStage
                      onPhotoUpload={handlePhotoUpload}
                      photos={profile.photos}
                      playerId={player.id}
                      playerName={player.name}
                      profileHref={`/preview?player=${encodeURIComponent(player.id)}`}
                      uploadingPhotoTarget={uploadingPhotoTarget}
                    />
                  </div>
                ) : null}
                <div className="player-row__content">
                  {isEditing ? (
                    <label className="field player-row__edit-field">
                      <span>球员名称</span>
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleRenameSubmit(player.id).catch((renameError) => {
                              setError(
                                renameError instanceof Error
                                  ? renameError.message
                                  : "更新球员名称失败",
                              );
                            });
                          }

                          if (event.key === "Escape") {
                            setEditingPlayerId("");
                            setEditingName("");
                            setError("");
                          }
                        }}
                      />
                    </label>
                  ) : (
                    <div className="player-row__title">
                      <h3>
                        <Link href={`/preview?player=${encodeURIComponent(player.id)}`}>
                          {player.name}
                        </Link>
                      </h3>
                      {profile?.title ? (
                        <span
                          className={
                            profile.title.category === "legend"
                              ? "title-pill title-pill--legend"
                              : "title-pill title-pill--fun"
                          }
                        >
                          {profile.title.label}
                        </span>
                      ) : null}
                      {profile?.aiModel ? <span className="section-note">AI 重估中台词已生效</span> : null}
                      <span
                        className={
                          player.isActive ? "status-pill status-pill--active" : "status-pill"
                        }
                      >
                        {player.isActive ? "启用中" : "已停用"}
                      </span>
                    </div>
                  )}
                  <p>创建时间：{formatDateTime(player.createdAt)}</p>
                  {profile ? (
                    <>
                      <div className="player-row__meta">
                        <span>身价 {profile ? formatCurrency(profile.marketValue.amountUsd) : "$0"}</span>
                        <span>图片 {profile.photoCount} 张</span>
                        <span>{currentTrend}</span>
                        <span>最长连胜 {profile.bestWinStreak}</span>
                        <span>最长连败 {profile.worstLossStreak}</span>
                      </div>
                      {profile.title ? (
                        <p className="player-row__note">称号说明：{profile.title.reason}</p>
                      ) : null}
                      <p className="player-row__note">
                        {profile.aiModel ? "AI 评价" : "估值判断"}：{profile.evaluation}
                      </p>
                      {profile.aiModel ? (
                        <p className="player-row__note">AI 模型：{profile.aiModel}</p>
                      ) : null}
                      {profile.achievements.length > 0 ? (
                        <div className="badge-list">
                          {profile.achievements.slice(0, 4).map((achievement) => (
                            <span
                              key={achievement.key}
                              className={
                                achievement.tone === "glory"
                                  ? "badge badge--glory"
                                  : "badge badge--chaos"
                              }
                              title={achievement.detail}
                            >
                              {achievement.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {profile.aiHooks.length > 0 ? (
                        <p className="player-row__note">AI 素材：{profile.aiHooks.join(" · ")}</p>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <div className="player-row__actions">
                  {isEditing ? (
                    <>
                      <button
                        className="button button--primary"
                        onClick={() => {
                          handleRenameSubmit(player.id).catch((renameError) => {
                            setError(
                              renameError instanceof Error
                                ? renameError.message
                                : "更新球员名称失败",
                            );
                          });
                        }}
                        type="button"
                      >
                        保存
                      </button>
                      <button
                        className="button"
                        onClick={() => {
                          setEditingPlayerId("");
                          setEditingName("");
                          setError("");
                        }}
                        type="button"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="button"
                        onClick={() => {
                          setEditingPlayerId(player.id);
                          setEditingName(player.name);
                          setError("");
                        }}
                        type="button"
                      >
                        修改名称
                      </button>
                      <button
                        className="button"
                        onClick={() => {
                          togglePlayer(player.id).catch((toggleError) => {
                            setError(
                              toggleError instanceof Error
                                ? toggleError.message
                                : "更新球员状态失败",
                            );
                          });
                        }}
                        type="button"
                      >
                        {player.isActive ? "停用" : "重新启用"}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
