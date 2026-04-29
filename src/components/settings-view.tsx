"use client";

import { ChangeEvent, useRef, useState } from "react";

import { exportState } from "@/lib/storage";
import { useAppState } from "@/lib/app-state";

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
  const { state, updateTitle, replaceStateFromImport, clearAllData } = useAppState();
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  function handleExport() {
    const blob = new Blob([exportState(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "billiards-score-data.json";
    link.click();
    URL.revokeObjectURL(url);
    setFeedback("已导出当前数据 JSON。");
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
