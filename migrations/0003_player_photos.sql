CREATE TABLE IF NOT EXISTS player_photos (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  image_data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_player_photos_player_id ON player_photos(player_id);
CREATE INDEX IF NOT EXISTS idx_player_photos_created_at ON player_photos(created_at);
