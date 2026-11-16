-- Sidra Tourism ONLY. Cloudflare D1, never Time Logistics / IK database.
CREATE TABLE IF NOT EXISTS sidra_enquiries (
  id TEXT PRIMARY KEY,
  service TEXT NOT NULL CHECK (service IN ('flights','hotels','holidays','transfers','visas','insurance')),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT '',
  destination TEXT NOT NULL DEFAULT '',
  travel_date TEXT NOT NULL DEFAULT '',
  travelers INTEGER NOT NULL CHECK (travelers BETWEEN 1 AND 9),
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','reviewing','quoted','awaiting_customer','closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS sidra_enquiries_status_created ON sidra_enquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS sidra_enquiries_email_created ON sidra_enquiries(email, created_at DESC);
