-- Add Fast audit claim anchoring state.
-- Apply against Turso production before enabling FAST_AUDIT_CLAIMS_MODE=testnet.

CREATE TABLE IF NOT EXISTS audit_claims (
  id TEXT PRIMARY KEY,
  audit_log_id TEXT NOT NULL UNIQUE REFERENCES audit_log(id),
  status TEXT NOT NULL DEFAULT 'pending',
  fast_network TEXT NOT NULL,
  fast_sender TEXT,
  fast_tx_id TEXT,
  fast_certificate TEXT,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  event_hash TEXT NOT NULL,
  previous_event_hash TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  submitted_at TEXT,
  confirmed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_claims_status
  ON audit_claims(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_audit_claims_event_hash
  ON audit_claims(event_hash);

