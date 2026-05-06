CREATE TABLE IF NOT EXISTS player_ai_profiles (
  player_id TEXT PRIMARY KEY,
  title_label TEXT NOT NULL,
  title_category TEXT NOT NULL,
  title_reason TEXT NOT NULL,
  evaluation TEXT NOT NULL,
  market_value_usd INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  model TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_player_ai_profiles_updated_at
  ON player_ai_profiles(updated_at);

CREATE TABLE IF NOT EXISTS match_ai_reviews (
  match_id TEXT PRIMARY KEY,
  review TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  model TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_match_ai_reviews_updated_at
  ON match_ai_reviews(updated_at);
