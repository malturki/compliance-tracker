-- Phase 0 migration for agentic obligations (docs/superpowers/plans/2026-04-23-agentic-obligations.md)
--
-- Applied against Turso production BEFORE the Phase 0 deploy goes live.
-- Local dev and test DBs pick up these columns via the DDL in src/db/index.ts,
-- src/db/seed.ts, src/test-setup.ts, and src/test/integration-helpers.ts.
--
-- All columns are nullable with no default backfill required. Re-running is safe
-- on a clean prod DB but libsql/SQLite does not support IF NOT EXISTS on ALTER
-- TABLE ADD COLUMN — if you need to re-run, check the schema first with
-- PRAGMA table_info('obligations') and only add the missing columns.
--
-- Run:
--   turso db shell <db-name> < scripts/migrate-2026-04-23-agentic.sql

-- obligations: sub-obligation tree + blocker state + next-action hint
ALTER TABLE obligations ADD COLUMN parent_id TEXT REFERENCES obligations(id);
ALTER TABLE obligations ADD COLUMN sequence INTEGER;
ALTER TABLE obligations ADD COLUMN blocker_reason TEXT;
ALTER TABLE obligations ADD COLUMN next_recommended_action TEXT;
CREATE INDEX IF NOT EXISTS idx_obligations_parent_id ON obligations(parent_id);

-- completions: evidence packet fields
ALTER TABLE completions ADD COLUMN approved_by TEXT;
ALTER TABLE completions ADD COLUMN approved_date TEXT;
ALTER TABLE completions ADD COLUMN verification_status TEXT DEFAULT 'unverified';
ALTER TABLE completions ADD COLUMN summary TEXT;
ALTER TABLE completions ADD COLUMN evidence_urls TEXT;
