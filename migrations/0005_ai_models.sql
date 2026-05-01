CREATE TABLE IF NOT EXISTS ai_models (
  model TEXT PRIMARY KEY,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  last_tried_at TEXT,
  last_succeeded_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_models_enabled_last_tried
  ON ai_models(is_enabled, last_tried_at);
