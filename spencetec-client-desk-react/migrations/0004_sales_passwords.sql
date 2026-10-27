-- v4.2: sales reps can sign in with a username and password instead of an email code.
-- For these accounts the users.email column holds the username (it never contains "@").
ALTER TABLE users ADD COLUMN login TEXT NOT NULL DEFAULT 'email';  -- 'email' or 'password'
ALTER TABLE users ADD COLUMN pw_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN pw_salt TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN must_change INTEGER NOT NULL DEFAULT 0; -- 1 = must choose a new password at next sign-in
ALTER TABLE users ADD COLUMN failed INTEGER NOT NULL DEFAULT 0;      -- wrong passwords in a row
ALTER TABLE users ADD COLUMN locked_until INTEGER NOT NULL DEFAULT 0;
