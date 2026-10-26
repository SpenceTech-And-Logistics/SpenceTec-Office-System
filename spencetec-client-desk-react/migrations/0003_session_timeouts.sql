-- v4.1: sign-in timeouts for secretaries and sales reps.
-- created_at: when they signed in (for the maximum session length).
-- last_seen: their last real activity (for the inactivity timeout). Background refreshes don't count.
ALTER TABLE sessions ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0;
UPDATE sessions SET created_at = CAST(strftime('%s','now') AS INTEGER), last_seen = CAST(strftime('%s','now') AS INTEGER);

-- Defaults the owner can change in Settings.
INSERT OR IGNORE INTO settings (key, value) VALUES ('idleMinutes', '30'), ('maxHours', '8');
