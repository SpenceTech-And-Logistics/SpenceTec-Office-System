-- v4.3: online status and an activity log.
ALTER TABLE users ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0;   -- last real activity (unix seconds)
ALTER TABLE users ADD COLUMN last_signin_at INTEGER NOT NULL DEFAULT 0;

-- Who did what, and when. Kept for 180 days.
CREATE TABLE activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,                     -- unix seconds
  email TEXT NOT NULL,                     -- who (email or sales-rep username)
  kind TEXT NOT NULL,                      -- auth | client | invoice | file | team | settings
  action TEXT NOT NULL,                    -- short code, e.g. signin, stage, invoice_paid
  target TEXT NOT NULL DEFAULT '',         -- client or invoice id, or person, when there is one
  target_name TEXT NOT NULL DEFAULT '',    -- readable name at the time
  summary TEXT NOT NULL                    -- sentence shown on the Activity page
);
CREATE INDEX activity_at ON activity(at);
CREATE INDEX activity_email ON activity(email, at);
CREATE INDEX activity_target ON activity(target, at);
