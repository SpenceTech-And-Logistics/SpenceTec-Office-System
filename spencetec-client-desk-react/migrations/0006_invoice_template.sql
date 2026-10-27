-- v4.4: invoice template matching SpenceTec's own invoices (INV-001 to INV-005).
-- Only fills settings that are still empty or at the old defaults, so nothing you've changed is overwritten.
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('invoicePad', '3'),
  ('invoiceStart', '6'),
  ('depositPct', '75'),
  ('terms', 'A {deposit}% deposit of the agreed fee is payable before work begins. The remaining {balance}% is due on completion. Monthly website updates are optional and billed separately at the agreed monthly rate.');
UPDATE settings SET value = 'INV-' WHERE key = 'invoicePrefix' AND value IN ('SPT-', '');
UPDATE settings SET value = 'P.O. Box 7183-00200, Nairobi' WHERE key = 'address' AND value IN ('', 'Nairobi, Kenya');
UPDATE settings SET value = '0746548656' WHERE key = 'phone' AND value = '';
UPDATE settings SET value = 'spencetechandlogistics@gmail.com' WHERE key = 'email' AND value = '';
UPDATE settings SET value = 'M-Pesa: 0746548656 (David Njagih)
Bank: Family Bank
Account name: David Spencer Ndwigah Njagih
Account / reference number: 046000043669' WHERE key = 'payInstructions' AND value = '';
