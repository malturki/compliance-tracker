// Canonical source for the Compliance Tracker agent skill.
//
// Served publicly at /.well-known/compliance-tracker-skill so agents can fetch
// the latest version by URL instead of copying the markdown into their config.
//
// A copy of this content is also committed at
// docs/skills/compliance-tracker/SKILL.md for source-of-truth visibility —
// keep the two in sync when editing.

export const COMPLIANCE_TRACKER_SKILL = `---
name: compliance-tracker
description: Use this skill when the user asks to read, list, create, update, complete, or delete compliance obligations in the company's compliance tracker, or to query audit history, categories, templates, or analytics. Requires a COMPLIANCE_TRACKER_TOKEN environment variable to be set.
---

# Compliance Tracker

The compliance-tracker app at https://compliance-tracker-alturki.vercel.app
tracks compliance obligations for the company. This skill lets you read and
manage obligations via the REST API.

**Canonical URL:** https://compliance-tracker-alturki.vercel.app/.well-known/compliance-tracker-skill

Fetch this URL at any time to get the latest version of this skill.

## Authentication

All requests require a bearer token in the Authorization header.
Read the token from the COMPLIANCE_TRACKER_TOKEN environment variable.
If the variable is not set, tell the user: "I need a compliance-tracker
API token. An admin can create one at Settings → Agents."

Example:

\`\`\`bash
curl -H "Authorization: Bearer $COMPLIANCE_TRACKER_TOKEN" \\
  https://compliance-tracker-alturki.vercel.app/api/obligations
\`\`\`

## What you can do

Your capabilities depend on the agent role assigned to your token:
- **viewer**: read-only access to obligations, categories, analytics, audit log
- **editor**: everything viewer can, plus create, update, complete, delete
- **admin**: everything editor can, plus manage users and agents

If an API call returns 403, your role does not permit that action.
Tell the user which action was denied and suggest asking an admin for
a higher-privileged token.

## Core workflows

### List obligations

\`\`\`
GET /api/obligations?category=tax&status=overdue
\`\`\`

Returns: array of obligations with id, title, category, frequency,
nextDueDate, owner, riskLevel, status.

### Get a single obligation

\`\`\`
GET /api/obligations/{id}
\`\`\`

Returns: full obligation plus completions[] history.

### Create an obligation (editor)

\`\`\`
POST /api/obligations
Body: { title, category, frequency, nextDueDate, owner, riskLevel, ... }
\`\`\`

Returns: \`{ id }\`

### Update an obligation (editor)

\`\`\`
PUT /api/obligations/{id}
Body: any subset of the fields above.
\`\`\`

Returns: \`{ success: true }\`

### Mark obligation complete (editor)

\`\`\`
POST /api/obligations/{id}/complete
Body: { completedBy, completedDate, notes?, evidenceUrls? }
\`\`\`

Returns: \`{ id, success: true, evidenceUrls }\`. If \`autoRecur\` is true
on the obligation, its \`nextDueDate\` automatically advances to the next
period.

### Delete an obligation (editor)

\`\`\`
DELETE /api/obligations/{id}
\`\`\`

Returns: \`{ success: true }\`

### Bulk operations (editor)

\`\`\`
POST /api/obligations/bulk   — update-owner, update-risk, mark-complete
DELETE /api/obligations      — Body: { ids: [...] } (max 100)
\`\`\`

### Query the audit log (editor)

\`\`\`
GET /api/audit?entity={id}&type=obligation.updated&limit=50
\`\`\`

Returns: \`{ events: [...], nextCursor }\`

### Analytics (viewer)

\`\`\`
GET /api/stats        — counts by status, category, risk
GET /api/analytics    — trends, compliance score, risk exposure
\`\`\`

## Conventions

- **Dates**: always ISO-8601 (YYYY-MM-DD for date-only, full ISO for timestamps)
- **IDs**: ULIDs (26 chars, alphanumeric)
- **Categories**: tax, investor, equity, state, federal, contract, insurance, benefits, governance, vendor
- **Frequencies**: annual, quarterly, monthly, weekly, one-time, event-triggered
- **Risk levels**: critical, high, medium, low
- **Roles** (for users/agents): viewer, editor, admin

## Safety

- **Never call DELETE without confirming with the user first.**
- **Never call bulk operations** (update-all, delete-all) without showing
  the user which obligations will be affected and getting explicit confirmation.
- When completing an obligation, always ask for the \`completedBy\` field —
  do not invent it. If the user didn't specify, ask them.
- When in doubt, list first (GET) then mutate. Don't assume state.
`
