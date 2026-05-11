INSERT INTO settings (key, value)
VALUES ('kFactor', '70')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
