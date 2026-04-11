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
GET /api/obligations?counterparty=IRS
\`\`\`

Returns: array of obligations with id, title, category, frequency,
nextDueDate, owner, riskLevel, status, counterparty, jurisdiction, entity.

Filters: \`category\`, \`status\`, \`risk_level\`, \`owner\`, \`counterparty\`, \`search\`.

### List counterparties

\`\`\`
GET /api/counterparties
\`\`\`

Returns: \`{ counterparties: [{ name, count }, ...] }\` — distinct counterparty
values currently in use, with the number of obligations attached to each.
Use this to discover the canonical name for a counterparty before filtering
or before setting one on a new/existing obligation (avoids creating
"AWS" and "Amazon Web Services" as duplicates).

### Get a single obligation

\`\`\`
GET /api/obligations/{id}
\`\`\`

Returns: full obligation plus completions[] history.

### Create an obligation (editor)

\`\`\`
POST /api/obligations
Body: {
  title, category, frequency, nextDueDate, owner, riskLevel,
  counterparty?,  // external party — see "Counterparty" below
  jurisdiction?,  // geographic scope (e.g. "Delaware", "California")
  description?, subcategory?, notes?, amount?, alertDays?, autoRecur?
}
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

## Counterparty, jurisdiction, and entity

Three related fields describe the parties to an obligation. Don't conflate them:

- **\`entity\`** — the *internal* party. Always \`Pi Squared Inc.\` Don't change it.
- **\`counterparty\`** — the *external* party the obligation is owed to. Examples:
  - Tax/regulatory: \`IRS\`, \`SEC\`, \`FinCEN\`, \`California Franchise Tax Board\`,
    \`Delaware Division of Corporations\`, \`Texas Workforce Commission\`
  - Vendors: \`Amazon Web Services\`, \`Cloudflare\`, \`GitHub\`, \`Slack\`
  - Investors/banks: \`Venture Partners LP\`, \`Silicon Valley Bank\`
  - Insurance: \`Berkley Regional Insurance Co.\`
  - Truly internal obligations (board meetings, internal audits, policy
    reviews) should leave counterparty as \`null\`.
- **\`jurisdiction\`** — the *geographic scope* (\`Delaware\`, \`California\`,
  \`Federal\`). The same jurisdiction can have many counterparties.

**Before setting counterparty on a new or existing obligation**, call
\`GET /api/counterparties\` to see the canonical names already in use. Use
the existing name verbatim (don't invent variants like "AWS" if "Amazon Web
Services" already exists).

To set or change counterparty on an existing obligation, use the standard PUT:

\`\`\`
PUT /api/obligations/{id}
Body: { "counterparty": "Amazon Web Services" }   // or null to clear
\`\`\`

Counterparty changes are recorded in the audit log diff (old → new).

## Safety

- **Never call DELETE without confirming with the user first.**
- **Never call bulk operations** (update-all, delete-all) without showing
  the user which obligations will be affected and getting explicit confirmation.
- When completing an obligation, always ask for the \`completedBy\` field —
  do not invent it. If the user didn't specify, ask them.
- When in doubt, list first (GET) then mutate. Don't assume state.
`
