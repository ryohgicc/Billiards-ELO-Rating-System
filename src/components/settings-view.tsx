"use client";

import { ChangeEvent, useRef, useState } from "react";

import { ADMIN_TOKEN_STORAGE_KEY } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { exportMatchRecordsCsv, exportState } from "@/lib/storage";
import { useAppState } from "@/lib/app-state";
import { getLocalMonthKey } from "@/lib/rating";

function TitleEditor({
  currentTitle,
  onSave,
}: {
  currentTitle: string;
  onSave: (title: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(currentTitle);

  return (
    <div className="form-grid">
      <label className="field">
        <span>标题</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <button
        className="button button--primary"
        onClick={() => {
          onSave(title).catch(() => {
            // Error state is handled by the parent settings view.
          });
        }}
        type="button"
      >
        保存标题
      </button>
    </div>
  );
}

export function SettingsView() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    state,
    updateTitle,
    updateAdminToken,
    replaceAiModels,
    resetAiModel,
    replaceStateFromImport,
    clearAllData,
  } = useAppState();
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [adminToken, setAdminToken] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "";
  });
  const [aiModelsInput, setAiModelsInput] = useState("");
  const [isEditingAiModels, setIsEditingAiModels] = useState(false);
  const persistedAiModelsInput = state.aiModels.map((entry) => entry.model).join("\n");
  const availableMatchMonths = [...new Set(state.matches.map((match) => getLocalMonthKey(match.createdAt)))].sort(
    (left, right) => right.localeCompare(left),
  );
  const [selectedMatchExportMonth, setSelectedMatchExportMonth] = useState(
    availableMatchMonths[0] ?? "",
  );
  const activeMatchExportMonth = availableMatchMonths.includes(selectedMatchExportMonth)
    ? selectedMatchExportMonth
    : availableMatchMonths[0] ?? "";

  function normalizeAiModelInput(raw: string) {
    return raw
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function handleExport() {
    downloadTextFile(exportState(state), "billiards-score-data.json", "application/json");
    setFeedback("已导出当前数据 JSON。");
    setError("");
  }

  function downloadTextFile(content: string, fileName: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleMatchRecordExport(monthKey?: string) {
    downloadTextFile(
      exportMatchRecordsCsv(state, monthKey),
      monthKey
        ? `billiards-match-records-${monthKey}.csv`
        : "billiards-match-records-all.csv",
      "text/csv;charset=utf-8",
    );
    setFeedback(monthKey ? `已导出 ${monthKey} 对战记录 CSV。` : "已导出全部对战记录 CSV。");
    setError("");
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const payload = await file.text();
      await replaceStateFromImport(payload);
      setFeedback("数据已导入云端。");
      setError("");
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "导入失败");
      setFeedback("");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>站点标题</h2>
          </div>
          <span className="section-note">K 值固定为 {state.settings.kFactor}</span>
        </div>

        <div className="form-grid">
          <TitleEditor
            key={state.settings.title}
            currentTitle={state.settings.title}
            onSave={async (nextTitle) => {
              try {
                await updateTitle(nextTitle);
                setFeedback("标题已更新。");
                setError("");
              } catch (updateError) {
                setError(updateError instanceof Error ? updateError.message : "标题更新失败");
                setFeedback("");
              }
            }}
          />
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Access Control</p>
            <h2>管理员口令</h2>
          </div>
          <span className="section-note">用于写接口鉴权</span>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Bearer Token</span>
            <input
              autoComplete="off"
              onChange={(event) => {
                const nextToken = event.target.value;
                setAdminToken(nextToken);
                updateAdminToken(nextToken);
              }}
              placeholder="部署到 Worker 的管理员口令"
              value={adminToken}
            />
          </label>
        </div>
        <p className="algorithm-note">
          保存后，当前浏览器会在写入 `/api/*` 请求时自动带上 `Authorization` 头。
        </p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">AI Routing</p>
            <h2>AI Key 与模型池</h2>
          </div>
          <span className="section-note">{state.aiModels.length} 个模型记录</span>
        </div>

        <div className="algorithm-copy">
          <p>
            本地开发把 `OPENAI_API_KEY` 和 `OPENAI_API_URL=https://aihubmix.com/v1` 写进
            `.dev.vars`。你如果习惯写 `OPEN_AI_URL`，现在也兼容。
          </p>
          <p>
            生产环境建议用 `wrangler secret put OPENAI_API_KEY`，`OPENAI_API_URL` 可配成普通变量或 secret。
            模型名单不走环境变量，直接存在数据库里；Worker 会按名单轮询，某个模型调用失败就自动停用。
          </p>
        </div>

        <label className="field">
          <span>模型列表</span>
          <textarea
            onChange={(event) => {
              setAiModelsInput(event.target.value);
              setIsEditingAiModels(true);
            }}
            placeholder={"例如：\nfree-gpt-4o-mini\nfree-gemini-2.0-flash\nfree-deepseek-v3"}
            rows={6}
            value={isEditingAiModels ? aiModelsInput : persistedAiModelsInput}
          />
        </label>
        <div className="button-row">
          <button
            className="button button--primary"
            onClick={() => {
              replaceAiModels(
                normalizeAiModelInput(isEditingAiModels ? aiModelsInput : persistedAiModelsInput),
              )
                .then(() => {
                  setAiModelsInput("");
                  setIsEditingAiModels(false);
                  setFeedback("AI 模型池已更新。");
                  setError("");
                })
                .catch((updateError) => {
                  setError(updateError instanceof Error ? updateError.message : "模型池更新失败");
                  setFeedback("");
                });
            }}
            type="button"
          >
            保存模型池
          </button>
        </div>

        {state.aiModels.length > 0 ? (
          <div className="preview-factor-list">
            {state.aiModels.map((entry) => (
              <article key={entry.model} className="preview-factor-card">
                <strong>{entry.model}</strong>
                <p>
                  状态：{entry.isEnabled ? "可用" : "已停用"} · 失败 {entry.failureCount} 次
                </p>
                <p>
                  上次尝试：{formatDateTime(entry.lastTriedAt)} · 上次成功：{formatDateTime(entry.lastSucceededAt)}
                </p>
                {entry.lastError ? <p>最近错误：{entry.lastError}</p> : null}
                {!entry.isEnabled ? (
                  <button
                    className="button"
                    onClick={() => {
                      resetAiModel(entry.model)
                        .then(() => {
                          setFeedback(`模型 ${entry.model} 已重新启用。`);
                          setError("");
                        })
                        .catch((resetError) => {
                          setError(resetError instanceof Error ? resetError.message : "重新启用模型失败");
                          setFeedback("");
                        });
                    }}
                    type="button"
                  >
                    重新启用
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="algorithm-note">当前还没配置 AI 模型池，录比赛时不会生成 AI 画像和锐评。</p>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Backup</p>
            <h2>导出与导入</h2>
          </div>
          <span className="section-note">推荐定期备份</span>
        </div>

        <div className="button-row">
          <button className="button button--primary" onClick={handleExport} type="button">
            导出 JSON
          </button>
          <button
            className="button"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            导入 JSON
          </button>
          <input
            ref={fileInputRef}
            accept="application/json"
            className="sr-only"
            onChange={handleImport}
            type="file"
          />
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Match Records</p>
            <h2>对战记录导出</h2>
          </div>
          <span className="section-note">{state.matches.length} 场历史比赛</span>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>月份</span>
            <select
              disabled={availableMatchMonths.length === 0}
              onChange={(event) => setSelectedMatchExportMonth(event.target.value)}
              value={activeMatchExportMonth}
            >
              {availableMatchMonths.length > 0 ? (
                availableMatchMonths.map((monthKey) => (
                  <option key={monthKey} value={monthKey}>
                    {monthKey}
                  </option>
                ))
              ) : (
                <option value="">暂无比赛记录</option>
              )}
            </select>
          </label>
          <div className="button-row button-row--end">
            <button
              className="button button--primary"
              disabled={!activeMatchExportMonth}
              onClick={() => handleMatchRecordExport(activeMatchExportMonth)}
              type="button"
            >
              导出所选月份
            </button>
            <button
              className="button"
              disabled={state.matches.length === 0}
              onClick={() => handleMatchRecordExport()}
              type="button"
            >
              导出全部历史
            </button>
          </div>
        </div>
      </section>

      <section className="panel panel--danger">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Danger Zone</p>
            <h2>清空本地数据</h2>
          </div>
        </div>
        <p className="danger-copy">
          这会删除云端数据库中的球员、比赛和标题设置。建议先导出 JSON 再执行。
        </p>
        <button
          className="button button--danger"
          onClick={() => {
            if (window.confirm("确定要清空所有本地数据吗？")) {
              clearAllData()
                .then(() => {
                  setFeedback("云端数据已清空。");
                  setError("");
                })
                .catch((clearError) => {
                  setError(clearError instanceof Error ? clearError.message : "清空数据失败");
                  setFeedback("");
                });
            }
          }}
          type="button"
        >
          清空数据
        </button>
      </section>

      {error ? <p className="feedback feedback--error">{error}</p> : null}
      {feedback ? <p className="feedback feedback--success">{feedback}</p> : null}
    </div>
  );
}
