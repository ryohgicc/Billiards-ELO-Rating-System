ALTER TABLE player_photos ADD COLUMN role TEXT NOT NULL DEFAULT 'default';

CREATE INDEX IF NOT EXISTS idx_player_photos_role ON player_photos(role);
