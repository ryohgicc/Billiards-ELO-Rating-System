"use client";

import { Dispatch, FormEvent, SetStateAction, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import {
  MAX_MATCH_NOTE_LENGTH,
  formatMatchMomentLabel,
  getMatchMomentOptions,
} from "@/lib/match-moments";
import { useAppState } from "@/lib/app-state";
import type { MatchMomentKey, MatchSide } from "@/lib/types";

const MUTUALLY_EXCLUSIVE_MOMENTS: Partial<Record<MatchMomentKey, MatchMomentKey>> = {
  win_by_3: "win_by_5",
  win_by_5: "win_by_3",
};

type MomentPickerProps = {
  title: string;
  side: MatchSide;
  selected: MatchMomentKey[];
  onToggle: (key: MatchMomentKey) => void;
};

function MomentPicker({ title, side, selected, onToggle }: MomentPickerProps) {
  const options = getMatchMomentOptions(side);

  return (
    <fieldset className="moment-picker">
      <legend>{title}</legend>
      <div className="moment-picker__options">
        {options.map((option) => {
          const isActive = selected.includes(option.key);

          return (
            <button
              key={option.key}
              aria-pressed={isActive}
              className={isActive ? "tag-toggle tag-toggle--active" : "tag-toggle"}
              onClick={() => onToggle(option.key)}
              type="button"
            >
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function MatchesView() {
  const { activePlayers, addMatch, isLoaded } = useAppState();
  const [winnerId, setWinnerId] = useState("");
  const [loserId, setLoserId] = useState("");
  const [winnerMoments, setWinnerMoments] = useState<MatchMomentKey[]>([]);
  const [loserMoments, setLoserMoments] = useState<MatchMomentKey[]>([]);
  const [winnerNote, setWinnerNote] = useState("");
  const [loserNote, setLoserNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const winnerOptions = activePlayers.filter((player) => player.id !== loserId);
  const loserOptions = activePlayers.filter((player) => player.id !== winnerId);

  function toggleMoment(
    nextKey: MatchMomentKey,
    setValue: Dispatch<SetStateAction<MatchMomentKey[]>>,
  ) {
    setValue((previous) =>
      previous.includes(nextKey)
        ? previous.filter((key) => key !== nextKey)
        : [
            ...previous.filter((key) => key !== MUTUALLY_EXCLUSIVE_MOMENTS[nextKey]),
            nextKey,
          ],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const result = await addMatch({
        winnerId,
        loserId,
        winnerMoments,
        loserMoments,
        winnerNote,
        loserNote,
      });
      const winnerSummary = result.winnerMoments.map(formatMatchMomentLabel).join("、");
      const loserSummary = result.loserMoments.map(formatMatchMomentLabel).join("、");
      const highlightSummary = [
        winnerSummary ? `胜者标签：${winnerSummary}` : "",
        loserSummary ? `负者标签：${loserSummary}` : "",
      ]
        .filter(Boolean)
        .join("；");

      setSuccess(
        `${result.winnerName} 记一胜，积分 +${result.winnerDelta}；${result.loserName} 积分 ${result.loserDelta}${
          highlightSummary ? `；${highlightSummary}` : ""
        }${
          result.aiReview
            ? `；AI 锐评：${result.aiReview}`
            : result.aiReviewPending
              ? "；AI 锐评后台生成中，稍后会自动刷新"
              : "；AI 锐评暂未生成"
        }。`,
      );
      setWinnerId("");
      setLoserId("");
      setWinnerMoments([]);
      setLoserMoments([]);
      setWinnerNote("");
      setLoserNote("");
      setError("");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "录入比赛时发生未知错误",
      );
      setSuccess("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">New Match</p>
          <h2>录入一场比赛</h2>
        </div>
        <span className="section-note">胜负 + 精彩瞬间 + AI 素材</span>
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

          <MomentPicker
            title="胜者精彩瞬间"
            side="winner"
            selected={winnerMoments}
            onToggle={(key) => toggleMoment(key, setWinnerMoments)}
          />

          <MomentPicker
            title="负者精彩瞬间"
            side="loser"
            selected={loserMoments}
            onToggle={(key) => toggleMoment(key, setLoserMoments)}
          />

          <label className="field field--full">
            <span>胜者备注</span>
            <textarea
              maxLength={MAX_MATCH_NOTE_LENGTH}
              onChange={(event) => setWinnerNote(event.target.value)}
              placeholder="比如：开球后一路清完，黑八定袋非常硬。"
              rows={3}
              value={winnerNote}
            />
          </label>

          <label className="field field--full">
            <span>负者备注</span>
            <textarea
              maxLength={MAX_MATCH_NOTE_LENGTH}
              onChange={(event) => setLoserNote(event.target.value)}
              placeholder="比如：决胜局误进黑八，整个人站在原地沉默了三秒。"
              rows={3}
              value={loserNote}
            />
          </label>

          <button
            className="button button--primary"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "正在提交..." : "提交胜负结果"}
          </button>
        </form>
      )}

      {error ? <p className="feedback feedback--error">{error}</p> : null}
      {isSubmitting ? (
        <p className="feedback feedback--pending">
          比赛结果先入库，AI 称号和锐评会在后台继续生成。
        </p>
      ) : null}
      {success ? <p className="feedback feedback--success">{success}</p> : null}
    </section>
  );
}
