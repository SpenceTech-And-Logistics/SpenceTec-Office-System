-- v4: three roles (owner, secretary, sales), invoices, client files, company settings.

-- Roles. Existing members become secretaries (same access they had before).
CREATE TABLE users_new (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'sales' CHECK (role IN ('owner','secretary','sales')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO users_new (email, name, role, created_at)
  SELECT email, name, CASE WHEN role = 'owner' THEN 'owner' ELSE 'secretary' END, created_at FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Invoices. Line items, VAT, payments received and the bill-to snapshot live in `data` (JSON).
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','void')),
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT NOT NULL DEFAULT ''
);
CREATE INDEX invoices_client ON invoices(client_id);

-- Client photos, CVs and documents (stored in D1, max ~1.9 MB each).
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('photo','cv','doc')),
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL DEFAULT ''
);
CREATE INDEX files_client ON files(client_id);

-- Company details used on invoices.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO settings (key, value) VALUES
  ('company', 'SpenceTec and Logistics Limited'),
  ('address', 'Nairobi, Kenya'),
  ('email', ''),
  ('phone', ''),
  ('kraPin', ''),
  ('invoicePrefix', 'SPT-'),
  ('vatRate', '16'),
  ('payInstructions', ''),
  ('footer', 'Thank you for your business.');
