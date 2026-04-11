# Agent API Access + Compliance Tracker Skill — Design Spec

**Date:** 2026-04-10
**Status:** Draft for review
**Scope:** Allow authorized AI agents (both Claude Code sessions and external automations) to read and manage compliance obligations via the REST API using bearer tokens scoped to service-account "agents," and package a Claude skill that teaches an agent how to use the API.

## Goal

Enable AI agents to perform the same operations a human editor or admin can perform in the compliance tracker (read, create, update, complete, delete obligations; query audit history; manage users/agents), authenticated via dedicated service-account tokens separate from human user sessions. Ship a skill document that teaches Claude Code agents how to discover and use the API.

## Non-goals

- Per-endpoint or per-resource fine-grained scoping. Agents use the same `viewer/editor/admin` role hierarchy as humans.
- OAuth client credentials flow. Plain bearer tokens are sufficient for a single-tenant tool.
- Rate limiting, usage analytics beyond `last_used_at`, or request metrics dashboards.
- Zero-downtime token rotation (multiple active tokens per agent). Regenerate + restart is acceptable at this scale.
- An MCP server. The agent talks to plain HTTP endpoints.
- Merging agents with users in a single table. Identity concepts stay separate.

## Architecture

Two independent pieces that ship together:

1. **Agent authentication layer** added to the existing API. A bearer token in the `Authorization` header is checked in middleware **before** the NextAuth session check. Valid tokens attach an agent actor to the request; invalid tokens return 401 immediately without falling through to session auth. Agents inherit the same role hierarchy (`viewer`, `editor`, `admin`) and the same `requireRole()` checks as human users.

2. **Compliance Tracker skill file** — a markdown document with YAML frontmatter that teaches Claude Code agents how to authenticate against the API and perform core operations. Distributed via the repo; users copy it into their `.claude/skills/` directory for use in other projects.

## Data model

One new table, `agents`, separate from `users`:

```ts
export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),                // ulid
  name: text('name').notNull(),               // e.g. "SlackBot", "AuditAgent"
  description: text('description'),           // one-line summary of purpose
  role: text('role').notNull(),               // 'viewer' | 'editor' | 'admin'
  tokenHash: text('token_hash').notNull(),    // sha256 hex of the raw token
  tokenPrefix: text('token_prefix').notNull(), // first ~15 chars for display
  createdBy: text('created_by').notNull(),    // admin email who created it
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),    // ISO timestamp, default now + 1 year
  lastUsedAt: text('last_used_at'),           // updated fire-and-forget on each verified call
  revokedAt: text('revoked_at'),              // soft-delete marker
})
```

**Index:** `(token_hash)` for O(1) verification lookups. `(revoked_at, expires_at)` optional if list queries get slow.

### Token format

Plain text: `ct_live_<44 random base62 characters>` — e.g. `ct_live_2kL8mPqR7sXv...`.

- Prefix `ct_live_` identifies it as a compliance-tracker production token.
- 44 chars of base62 = ~262 bits of entropy.
- Stored at rest only as SHA-256 hash in `tokenHash`. Never reversible.
- First 15 chars of the raw token (`ct_live_2kL8mPq`) stored in `tokenPrefix` for display purposes so the admin UI can show a partial token identifier without reconstructing the full value.

### Token storage guarantees

- Raw token is shown **exactly once**, at the moment of creation or regeneration, in a modal with a copy button and the warning `"Copy this token now. It will never be shown again."`
- After the modal closes, only the hash remains in the database.
- Lost tokens cannot be recovered — the admin regenerates.

## Authentication flow

### `src/lib/agent-auth.ts` (new)

```ts
export type AgentActor = {
  type: 'agent'
  agentId: string
  name: string
  role: 'viewer' | 'editor' | 'admin'
}

export async function verifyAgentToken(token: string): Promise<AgentActor | null>
```

Implementation:

1. Reject immediately if `!token.startsWith('ct_live_')`.
2. Compute SHA-256 hash of the raw token.
3. Query `agents` where `token_hash = ? AND revoked_at IS NULL AND expires_at > now()`.
4. If found, update `last_used_at` without blocking (fire-and-forget promise, errors logged).
5. Return `{ type: 'agent', agentId, name, role }`.
6. If not found, return `null`.

### Middleware integration (`src/middleware.ts`)

Updated flow:

```
1. Request arrives
2. If Authorization: Bearer <token> header present:
   a. Call verifyAgentToken(token)
   b. If valid → attach agent actor, allow through
   c. If invalid → return 401 IMMEDIATELY (do not fall through to session)
3. Otherwise → existing NextAuth session check
4. Role enforcement (viewer restrictions, mutation blocks) works identically for agent or human actors
```

**Design rule:** If the `Authorization` header is present but the token is invalid, the request is rejected even if the caller also has a valid session cookie. Mixing header and cookie auth is a common source of security bugs; this rule eliminates that class of error.

### `getActor()` update (`src/lib/actor.ts`)

The existing `Actor` type gains `agent` as a new `source`:

```ts
export type Actor = {
  email: string                                 // for agents, e.g. "agent:SlackBot"
  source: 'sso' | 'cron' | 'dev' | 'system' | 'agent'
}
```

New resolution order in `getActor(req)`:

1. **Agent bearer token** (via `verifyAgentToken`) — returns `{ email: `agent:${name}`, source: 'agent' }`.
2. NextAuth session — unchanged.
3. Cron secret — unchanged.
4. Dev fallback — unchanged.
5. System fallback — unchanged.

### `requireRole` integration

No changes. It already reads the role off `getActor()`'s return value; agents and humans look identical at that layer.

## Audit log integration

Zero changes to the existing audit infrastructure. Agents flow through `getActor()` → `logEvent()` just like humans, and audit rows naturally record:

- `actor`: `"agent:SlackBot"` (prefixed to distinguish from user emails)
- `actorSource`: `"agent"` (new enum value)
- `entityType`, `entityId`, `diff`, `metadata`: same as for humans
- Agent-specific metadata (`agentId`) captured on `agent.*` events for traceability

Three new event types are added to `AuditEventType`:

- `agent.created`
- `agent.regenerated`
- `agent.revoked`

## API routes for agent management

Following the existing `/api/users` pattern. All admin-only.

| Route | Method | Purpose | Request body | Response |
|---|---|---|---|---|
| `/api/agents` | `GET` | List all agents (no tokens, no hashes) | — | `{ agents: [...] }` |
| `/api/agents` | `POST` | Create agent and return raw token once | `{ name, description?, role, expiresInDays? }` | `{ id, token, expiresAt }` |
| `/api/agents/[id]` | `PUT` | Regenerate token, return new raw token once | `{}` (empty — just triggers regen) | `{ token, expiresAt }` |
| `/api/agents/[id]` | `DELETE` | Revoke (soft-delete) the agent | — | `{ success: true }` |

Each mutation writes to the audit log via `logEvent` with the appropriate `agent.*` event type, a diff where applicable, and `metadata: { agentId, name }`.

## Admin UI for managing agents

**New page: `/settings/agents`** — parallel to `/settings/users`, admin-only.

Layout matches the existing dense dark-mode style. Table columns:

| Column | Content |
|---|---|
| Name | Agent display name |
| Description | One-line summary |
| Role | Badge: viewer / editor / admin |
| Token | Prefix only: `ct_live_2kL8mPq...` |
| Created by | Admin email |
| Expires | Relative time, red if expired or expiring within 30 days |
| Last used | Relative time or "never" |
| Actions | Regenerate, Revoke |

### Create-agent flow

1. Click **"New Agent"** → modal opens
2. Fields: Name (required), Description (optional), Role (select), Expiry (select: 30 / 90 / 180 / 365 days, default 365)
3. Submit → `POST /api/agents` → modal displays raw token in a read-only, copyable field with warning: **"Copy this token now. It will never be shown again."**
4. User copies, clicks Close. Modal dismisses, table refreshes.

### Regenerate flow

1. Click **Regenerate** on a row → confirmation dialog: "Regenerating invalidates the existing token immediately. Continue?"
2. Confirm → `PUT /api/agents/[id]` → modal displays new raw token (same as create modal)
3. Old token stops working immediately on the next verification call.

### Revoke flow

1. Click **Revoke** → confirmation dialog: "This will permanently disable this agent. Revoked agents cannot be restored. Continue?"
2. Confirm → `DELETE /api/agents/[id]` → sets `revoked_at`. Row remains visible with a strikethrough; audit references still resolve to the name.

### Settings navigation

The existing `/settings/users` page and the new `/settings/agents` page share a tab bar at the top: **Users | Agents**. The sidebar **Settings** entry (admin-only) continues to link to `/settings/users` as the default.

## The Compliance Tracker skill

**Location:** `docs/skills/compliance-tracker/SKILL.md` — committed to the repo so it versions alongside the code.

**Format:** Markdown with YAML frontmatter per the Claude skill standard.

**Full content:**

```markdown
---
name: compliance-tracker
description: Use this skill when the user asks to read, list, create, update, complete, or delete compliance obligations in the company's compliance tracker, or to query audit history, categories, templates, or analytics. Requires a COMPLIANCE_TRACKER_TOKEN environment variable to be set.
---

# Compliance Tracker

The compliance-tracker app at https://compliance-tracker-alturki.vercel.app
tracks compliance obligations for the company. This skill lets you read and
manage obligations via the REST API.

## Authentication

All requests require a bearer token in the Authorization header.
Read the token from the COMPLIANCE_TRACKER_TOKEN environment variable.
If the variable is not set, tell the user: "I need a compliance-tracker
API token. An admin can create one at Settings → Agents."

Example:
    curl -H "Authorization: Bearer $COMPLIANCE_TRACKER_TOKEN" \
      https://compliance-tracker-alturki.vercel.app/api/obligations

## What you can do

Your capabilities depend on the agent role assigned to your token:
- viewer: read-only access to obligations, categories, analytics, audit log
- editor: everything viewer can, plus create, update, complete, delete
- admin: everything editor can, plus manage users and agents

If an API call returns 403, your role does not permit that action.
Tell the user which action was denied and suggest asking an admin for
a higher-privileged token.

## Core workflows

### List obligations
    GET /api/obligations?category=tax&status=overdue
    Returns: array of obligations with id, title, category, frequency,
    nextDueDate, owner, riskLevel, status.

### Get a single obligation
    GET /api/obligations/{id}
    Returns: full obligation plus completions[] history.

### Create an obligation (editor)
    POST /api/obligations
    Body: { title, category, frequency, nextDueDate, owner, riskLevel, ... }
    Returns: { id }

### Update an obligation (editor)
    PUT /api/obligations/{id}
    Body: any subset of the fields above.
    Returns: { success: true }

### Mark obligation complete (editor)
    POST /api/obligations/{id}/complete
    Body: { completedBy, completedDate, notes?, evidenceUrls? }
    Returns: { id, success: true, evidenceUrls }
    If autoRecur is true, the obligation's nextDueDate auto-advances.

### Delete an obligation (editor)
    DELETE /api/obligations/{id}
    Returns: { success: true }

### Bulk operations (editor)
    POST /api/obligations/bulk  — update-owner, update-risk, mark-complete
    DELETE /api/obligations     — Body: { ids: [...] } (max 100)

### Query the audit log (editor)
    GET /api/audit?entity={id}&type=obligation.updated&limit=50
    Returns: { events: [...], nextCursor }

### Analytics (viewer)
    GET /api/stats               — counts by status, category, risk
    GET /api/analytics           — trends, compliance score, risk exposure

## Conventions

- Dates: always ISO-8601 (YYYY-MM-DD for date-only, full ISO for timestamps)
- IDs: ULIDs (26 chars, alphanumeric)
- Categories: tax, investor, equity, state, federal, contract, insurance,
  benefits, governance, vendor
- Frequencies: annual, quarterly, monthly, weekly, one-time, event-triggered
- Risk levels: critical, high, medium, low
- Roles (for users/agents): viewer, editor, admin

## Safety

- Never call DELETE without confirming with the user first.
- Never call bulk operations (update-all, delete-all) without showing the
  user which obligations will be affected and getting explicit confirmation.
- When completing an obligation, always ask for the completedBy field —
  do not invent it. If the user didn't specify, ask them.
- When in doubt, list first (GET) then mutate. Don't assume state.
```

### Skill distribution

- **Inside this repo:** Claude Code sessions running in `compliance-tracker` discover the skill automatically.
- **Outside this repo:** The user copies `docs/skills/compliance-tracker/SKILL.md` into their project's `.claude/skills/compliance-tracker/SKILL.md`. Same file, different location.
- **Token distribution:** Admin creates agent via `/settings/agents`, copies token once, sets `COMPLIANCE_TRACKER_TOKEN=ct_live_...` in the agent's environment (shell export, `.env` file, CI secrets, etc.).

### README update

Add a brief **"AI Agent Access"** section to the top-level README explaining how to get a token and where the skill lives. One paragraph.

## Testing

### Unit tests

- `generateToken()` — format (prefix, length, character set), entropy (no duplicates across many calls).
- `hashToken()` — deterministic, same input yields same hash, different inputs yield different hashes.
- `verifyAgentToken()` — every branch: wrong prefix, invalid hash, valid-but-expired, valid-but-revoked, valid and active.

### Integration tests

- `GET /api/obligations` with valid viewer token → 200.
- `GET /api/obligations` with invalid token → 401.
- `GET /api/obligations` with expired token → 401.
- `GET /api/obligations` with revoked token → 401.
- `POST /api/obligations` with viewer token → 403.
- `POST /api/obligations` with editor token → 201.
- `POST /api/obligations` with both a valid token header AND a valid session cookie → 201 (token wins).
- `POST /api/obligations` with an **invalid** token header AND a valid session cookie → 401 (token rejects, does not fall through).
- Audit log row for an agent action has `actor: "agent:<name>"` and `actorSource: "agent"`.
- `POST /api/agents` as admin creates an agent and returns a raw token.
- `POST /api/agents` as editor → 403.
- `PUT /api/agents/[id]` regenerates the token; the old token no longer validates.
- `DELETE /api/agents/[id]` revokes; subsequent API calls with that token return 401.

### Smoke test post-deploy

1. Sign in as admin, navigate to `/settings/agents`.
2. Create a test agent with role `viewer`. Copy the token.
3. `curl -H "Authorization: Bearer $TOKEN" .../api/obligations` → 200 JSON.
4. `curl -X POST ...` with the same viewer token → 403.
5. Regenerate the token via the UI. `curl` with the old token → 401. `curl` with the new token → 200.
6. Revoke the agent. `curl` with the new token → 401.

## Migration and deployment

- Add `agents` table to `src/db/schema.ts`.
- Add `CREATE TABLE IF NOT EXISTS agents (...)` and the `token_hash` index to the in-memory init in `src/db/index.ts`.
- Create the table on Turso via `turso db shell`.
- No data backfill required. Agents are created from scratch via the UI.

## Risks and open questions

- **Token prefix namespace.** `ct_live_` leaves room for `ct_test_` later if we add a sandbox environment. If we never do, the prefix is harmless overhead — still better than introducing a breaking change later.
- **`last_used_at` write amplification.** Every API call by an agent triggers an UPDATE. For a single-tenant tool with a handful of agents this is trivial, but if volume grows this could become the hottest query in the system. Mitigation if it ever matters: debounce (only update if `last_used_at` is more than N minutes old), or log usage to the audit table instead and compute last-used on read.
- **Revoked agent rows accumulate.** Soft deletes never get cleaned up. Acceptable because they provide audit-log traceability. If the list grows unwieldy, add a "show revoked" filter to the settings page.
- **Token leakage exposure.** A leaked token grants full access at the agent's role until the token is manually revoked. Default 1-year expiry caps the blast radius. No automatic anomaly detection; rely on audit log review if suspicious activity is noticed.
- **Skill file drift.** The skill describes the API as it exists on the day it's written. If API contracts change, the skill must be updated in the same PR. A CI check that verifies skill examples against the current OpenAPI schema would prevent drift, but that's a follow-up.

## Dependencies

- **No new npm packages.** SHA-256 hashing is built into Node's `crypto` module. Random token generation uses `crypto.randomBytes`.

## Out of scope (deliberate YAGNI)

- Per-endpoint scope control for agents (use roles instead).
- Token usage analytics beyond `last_used_at`.
- OAuth client credentials flow.
- Multi-token rotation per agent.
- MCP server implementation.
- Rate limiting per agent.
- Automatic token rotation schedules.
- Webhook subscriptions for agents (no push, only pull).
