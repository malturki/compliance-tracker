# Compliance Tracker

A Next.js app for tracking company compliance obligations.

## Environment Variables

Required environment variables:

- `TURSO_DATABASE_URL` - Your Turso database URL (e.g., `libsql://[your-db].turso.io`)
- `TURSO_AUTH_TOKEN` - Your Turso auth token

Get these by creating a free Turso account at https://turso.tech

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env.local` and add your Turso credentials
4. Run the seed script: `npm run seed`
5. Start the dev server: `npm run dev`

## Deployment

This app is designed for serverless deployment (Vercel, Netlify, etc.) and uses Turso as a hosted database.

## Fast Audit Claims

Every `audit_log` event is also queued as a privacy-preserving Fast audit claim.
The claim payload stores event metadata and SHA-256 commitments, not raw actor
emails, summaries, diffs, notes, or evidence URLs. Local audit rows remain the
readable source of truth.

Before enabling real Fast testnet publishing, apply:

```
scripts/migrate-2026-05-08-fast-audit-claims.sql
```

Modes:

- `FAST_AUDIT_CLAIMS_MODE=disabled` - do not enqueue or publish claims.
- `FAST_AUDIT_CLAIMS_MODE=dry-run` - default; confirms claims locally with dry-run receipts.
- `FAST_AUDIT_CLAIMS_MODE=testnet` - submit signed `ExternalClaim` transactions to Fast testnet.

Testnet publishing uses one of two integration styles:

- `FAST_AUDIT_PRIVATE_KEY` or `FAST_AUDIT_PRIVATE_KEY_FILE` - use the official
  `@fastxyz/sdk` locally to sign and submit `ExternalClaim` transactions.
- `FAST_AUDIT_SUBMITTER_URL` - a signing/submission service that receives the
  canonical claim payload and returns a Fast tx id/certificate.
- `FAST_AUDIT_SIGNER_URL` + `FAST_AUDIT_RPC_URL` - a signer returns a documented
  Fast `transaction` and `signature`; the app submits them to the proxy using
  `FAST_AUDIT_RPC_METHOD` (default: `set_proxy_submitTransaction`).

All styles use `FAST_AUDIT_SENDER` and optional `FAST_AUDIT_API_TOKEN`. Direct
SDK signing defaults to non-archival transactions because Fast testnet currently
rejects archival submissions; set `FAST_AUDIT_ARCHIVAL=true` only on networks
that support it. SDK signing pays fees with the network default token
(`testUSDC` on testnet, `fastUSD` on mainnet); set `FAST_AUDIT_FEE_TOKEN` to a
token id for custom networks or to `native` for native-token fees. The cron
route `/api/cron/publish-audit-claims` publishes pending claims and is protected
by `CRON_SECRET`.

## AI Agent Access

AI agents (Claude Code sessions, automation scripts, bots) can read and
manage obligations via the REST API using bearer tokens.

**Create a token:** Sign in as an admin, go to **Settings → Agents**, click
**New Agent**, pick a role (viewer / editor / admin), and copy the token
that's shown once.

**Hosted skill:** The skill file is served at a public, agent-discoverable URL
so you don't have to copy any files. Point your agent at:

```
https://compliance-tracker-alturki.vercel.app/.well-known/compliance-tracker-skill
```

Export the token as `COMPLIANCE_TRACKER_TOKEN` and tell your agent to read
the URL above. It will fetch the latest skill content and start managing
obligations.

**Local copy:** If you prefer to ship the skill with your project, copy
`docs/skills/compliance-tracker/SKILL.md` into your Claude Code project at
`.claude/skills/compliance-tracker/SKILL.md`. The canonical source of truth
is `src/lib/compliance-tracker-skill.ts` — keep the two in sync when
editing.

**Raw API:** See the skill file for the full endpoint reference.
