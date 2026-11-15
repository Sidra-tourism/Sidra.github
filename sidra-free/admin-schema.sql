-- Apply to the dedicated SIDRA D1 after creating the base enquiry schema.
CREATE TABLE IF NOT EXISTS sidra_enquiry_audit (
  id TEXT PRIMARY KEY,
  enquiry_id TEXT NOT NULL REFERENCES sidra_enquiries(id),
  actor_email TEXT NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS sidra_enquiry_audit_enquiry ON sidra_enquiry_audit(enquiry_id, created_at DESC);