// In-app help center content. Each topic is a self-contained unit with
// a TL;DR (shown by default) and longer details (expandable). Role-scoped
// so viewers only see a subset.

export type HelpRole = 'viewer' | 'editor' | 'admin'

export type HelpTopic = {
  slug: string
  title: string
  category: 'Getting Started' | 'Using the App' | 'Administration'
  minRole: HelpRole
  tldr: string
  details: string // markdown-lite (paragraphs separated by blank lines)
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    category: 'Getting Started',
    minRole: 'viewer',
    tldr: 'The compliance tracker keeps track of obligations your company has to meet — tax filings, vendor contracts, insurance renewals, investor reports, and so on. Each obligation has a due date, a risk level, and an owner. Your role determines what you can do.',
    details: `Pi Squared Inc.'s compliance tracker helps you see at a glance what's due, what's overdue, and who's responsible. It replaces scattered spreadsheets and calendar invites with a single source of truth.

**Roles determine what you see:**

- **Viewer** — Read-only access to the Overview and Dashboard. You can see compliance status at a glance but cannot create or edit obligations.
- **Editor** — Everything a viewer can do, plus creating, editing, completing, and deleting obligations. Can apply templates and run bulk operations.
- **Admin** — Everything an editor can do, plus managing users, creating agents (service accounts for AI/automation), and configuring the system.

**Signing in:** The app is restricted to accounts from \`@fast.xyz\` and \`@pi2labs.org\`. Sign in with your company Google account. The first person to sign in becomes the admin automatically; everyone after that starts as a viewer and needs to be promoted by an admin.

**Keyboard shortcuts:** Press \`Cmd+K\` (or \`Ctrl+K\`) anywhere to open a searchable command palette. Press \`?\` to see all available shortcuts.`,
  },
  {
    slug: 'reading-overview',
    title: 'Reading the Overview page',
    category: 'Getting Started',
    minRole: 'viewer',
    tldr: 'The Overview page shows four top-line numbers (total, overdue, due soon, this month) and a category breakdown. Editors and admins also see lists of overdue and upcoming obligations.',
    details: `The Overview page (\`/\`) is the landing page after sign-in. It's designed to answer "is anything on fire right now?" in about two seconds.

**Stats row (top):**

- **Total** — every non-completed obligation being tracked, across all categories.
- **Overdue** — obligations whose due date has passed. This is red for a reason. If this number is non-zero, something needs attention today.
- **Due Soon** — due within the next seven days. Still safe, but schedule the work now.
- **This Month** — everything coming due in the current calendar month.

**By Category (right side):** a horizontal bar chart showing how many obligations each category has (tax, investor, equity, state, etc.). If any category has overdue items, the count is highlighted in red. Clicking a category filters the Obligations page to that category.

**Obligation tables (editors and admins only):** Below the stats, you'll see three tables — Overdue, Due Within 7 Days, and Rest of Month. Click any row to open the detail panel with full history. Viewers see only the stats and category breakdown for a quieter experience.`,
  },
  {
    slug: 'compliance-status',
    title: 'Understanding compliance status',
    category: 'Getting Started',
    minRole: 'viewer',
    tldr: 'Obligations have four possible statuses: overdue (past due), upcoming (due within 7 days), current (on track), and completed (done forever, for one-time items).',
    details: `Status is computed automatically from the due date, the last completion date, and the frequency — you never set it manually.

- **Overdue** (red) — \`nextDueDate\` has passed and the obligation hasn't been completed for this period. Action needed.
- **Upcoming** (amber) — due within the next seven days, or due today. Start working on it.
- **Current** (slate) — due more than seven days away, or already completed for this period. Nothing to do right now.
- **Completed** (emerald) — only used for **one-time** and **event-triggered** obligations that have been completed. These are done forever and will never flip back to overdue.

**Why "current" vs "completed":** A recurring obligation (annual tax filing, monthly invoice review) is always "current" between periods — it's done for now but will come due again. A one-time obligation (specific filing, one-off renewal) is "completed" once done — no next period exists.

**Auto-recurrence:** Recurring obligations with \`autoRecur\` enabled automatically advance their \`nextDueDate\` when completed. An annual filing completed today jumps forward one year; a quarterly filing jumps forward three months. Without \`autoRecur\`, the date stays put and you update it manually when the next period begins.`,
  },
  {
    slug: 'keyboard-shortcuts',
    title: 'Keyboard shortcuts',
    category: 'Getting Started',
    minRole: 'viewer',
    tldr: 'Cmd+K opens the command palette. ? shows a shortcuts cheat sheet. Esc closes modals.',
    details: `The app is designed to be usable without leaving the keyboard once you know the shortcuts.

**Global shortcuts:**

- \`Cmd+K\` / \`Ctrl+K\` — Open the command palette. Fuzzy-search obligations by title and jump to any page or pre-filtered view ("Overdue obligations", "Due within 7 days"). The single most useful shortcut.
- \`?\` — Open the keyboard shortcuts cheat sheet. The help you're reading now.
- \`Esc\` — Close any open modal, dialog, or the command palette.

**Command palette tips:**

- Press \`Cmd+K\`, start typing an obligation title — fuzzy matching finds it.
- Use it to jump to pages without clicking through the sidebar.
- Use it for quick filters like "Overdue" — skip the filter UI.
- The palette is role-aware — viewers only see pages and filters their role can access.`,
  },
  {
    slug: 'faq',
    title: 'FAQ',
    category: 'Getting Started',
    minRole: 'viewer',
    tldr: 'Common questions: why can\'t I see certain pages, what happens to the audit trail, how to report a bug.',
    details: `**Why can't I see the Obligations / Calendar / Templates pages?**

You're a viewer. Those pages are restricted to editors and admins. If you need access, ask an admin to promote you at Settings → Users.

**Why don't I see owner names on the Dashboard?**

Owner performance is also restricted. The intent is to keep operational detail out of the viewer experience — viewers see the summary and trends, not the "who's falling behind" table.

**What happens if I accidentally delete an obligation?**

Delete is a hard delete — the obligation is removed from the database. However, the audit log keeps a full snapshot of the deleted obligation in the \`obligation.deleted\` event's metadata, so it can be manually restored by an admin with database access if necessary. Still: always prefer marking complete over deleting.

**How do I report a bug?**

Mention it to an admin or file an issue in the repository. When reporting, include what you did, what you expected, and what happened instead. Screenshots help.

**Is my data private?**

The app is restricted to \`@fast.xyz\` and \`@pi2labs.org\` accounts. No one outside these domains can sign in. Evidence files uploaded with completions are stored in Vercel Blob storage and are only accessible via the app.`,
  },
  {
    slug: 'counterparties',
    title: 'Counterparties',
    category: 'Using the App',
    minRole: 'viewer',
    tldr: 'Counterparty is the external party an obligation is owed to (AWS, California FTB, Republic Registered Agent). Set it on each obligation to filter and group by who you actually owe.',
    details: `Counterparty is the **other party** to an obligation — the entity you pay, file with, report to, or renew with. It is distinct from \`entity\` (which is always Pi Squared Inc.) and from \`jurisdiction\` (which is the geographic scope, e.g., "California"). The same jurisdiction can have many counterparties (Franchise Tax Board, Secretary of State, EDD).

**Examples:**

- An AWS monthly invoice → counterparty: \`Amazon Web Services\`
- Delaware Franchise Tax → counterparty: \`Delaware Division of Corporations\`
- D&O insurance renewal → counterparty: \`Berkley Regional Insurance Co.\`
- Annual stockholder consent → counterparty empty (internal only)

**Why it's useful:**

- **Filter by counterparty** on the Obligations page to see "everything we owe to AWS" or "everything filed with the SEC."
- **By-counterparty panel** on the Categories page rolls up totals, overdue counts, and the next deadline per counterparty — useful for renewal-season planning and contract reviews.
- **Audit trail** records every counterparty change with old → new in the diff, so you can answer "when did we move from Berkley to Hartford?"

**Setting it:**

- On create: pick from the autocomplete suggestions (existing counterparties in your DB) or type a new name. Free text — no canonical list.
- On edit: editors and admins can change the counterparty via the API. The audit log will record the change.
- Optional: leave blank for purely internal obligations (board consents, internal cleanups).

**Naming conventions:**

Use the canonical legal name when possible (\`Amazon Web Services\` not \`AWS\`, \`California Franchise Tax Board\` not \`CA FTB\`). The autocomplete will surface existing variants so you don't accidentally create \`AWS\` and \`Amazon Web Services\` as two separate counterparties.`,
  },
  {
    slug: 'creating-obligations',
    title: 'Creating an obligation',
    category: 'Using the App',
    minRole: 'editor',
    tldr: 'Go to Obligations, click "Add Obligation", fill in title / category / frequency / due date / owner / risk level. Pick autoRecur if the obligation repeats and should auto-advance on completion.',
    details: `**Required fields:**

- **Title** — short, specific. "Delaware Franchise Tax" not "Tax filing."
- **Category** — one of: tax, investor, equity, state, federal, contract, insurance, benefits, governance, vendor. Used for filtering and category breakdown.
- **Frequency** — annual, quarterly, monthly, weekly, one-time, event-triggered. Determines recurrence behavior.
- **Next Due Date** — ISO date (YYYY-MM-DD). When the obligation needs to be completed.
- **Owner** — dropdown of authenticated users. The person responsible.
- **Risk Level** — critical, high, medium, low. Affects visual indicators and dashboard breakdown.

**Optional fields:**

- **Description** — free text.
- **Counterparty** — the external party the obligation is owed to (e.g. \`Amazon Web Services\`, \`California FTB\`). See the Counterparties topic for why this matters.
- **Jurisdiction** — for legal/tax obligations, which state or country.
- **Amount** — dollar amount if relevant (e.g., annual fee).
- **Subcategory** — free text for finer grouping.
- **Notes** — anything else worth remembering.
- **Auto-recur** — checkbox. When enabled, completing this obligation automatically advances \`nextDueDate\` to the next period. Only meaningful for recurring frequencies (ignored for one-time and event-triggered).

**Alert days:** A list of integers representing "alert me N days before due." For example, \`[30, 14, 7]\` sends three reminders. These trigger the email alert cron job.

**Entity:** Defaults to "Pi Squared Inc." You normally don't change this.`,
  },
  {
    slug: 'marking-complete',
    title: 'Marking obligations complete',
    category: 'Using the App',
    minRole: 'editor',
    tldr: 'Open an obligation, scroll to "Mark complete", enter your name and the completion date, optionally attach evidence files, then confirm. Recurring obligations advance automatically if autoRecur is on.',
    details: `**The completion flow:**

1. Open an obligation (click a row in the Obligations list, or use \`Cmd+K\` to search).
2. Scroll to the "Mark complete" section in the detail panel.
3. Enter your name in "Completed by" (required). This gets recorded on the completion and in the audit log.
4. Set the completion date. Defaults to today but you can backdate if needed.
5. (Optional) Add notes — why it was done, reference numbers, stakeholders involved.
6. (Optional) Upload evidence files — PDFs, images, receipts. These are stored in Vercel Blob and linked to the completion.
7. Click "Confirm Complete."

**What happens next depends on the frequency:**

- **One-time** or **event-triggered** → status becomes \`completed\` and the obligation is done forever. It won't flip back to overdue when the original due date passes.
- **Recurring with autoRecur on** → \`nextDueDate\` auto-advances to the next period (annual → next year, quarterly → +3 months, monthly → +1 month, weekly → +7 days). Status becomes \`current\` until the new due date approaches.
- **Recurring without autoRecur** → \`lastCompletedDate\` is recorded but \`nextDueDate\` stays the same. You'll need to update it manually when the next period begins.

**The audit log** records an \`obligation.completed\` event with the completion ID, evidence count, and who completed it. You can see this history by opening the obligation detail panel and expanding the "History" section.`,
  },
  {
    slug: 'bulk-operations',
    title: 'Bulk operations',
    category: 'Using the App',
    minRole: 'editor',
    tldr: 'Select multiple obligations by clicking their checkboxes, then use the action bar at the top to complete, edit owner/risk, or delete them in one action. Bulk delete requires typing "DELETE" to confirm.',
    details: `**Selecting obligations:**

On the Obligations page, each row has a checkbox on the left. Click to select. Click the header checkbox to select all visible obligations. Selection is per-page — filters narrow the list first, then you select from what's visible.

**Actions available when items are selected:**

- **Mark Complete** — opens a dialog asking for a single \`completedBy\` name and completion date. All selected obligations get a completion record and advance (if autoRecur). Useful for end-of-month cleanup.
- **Edit** — change owner or risk level on all selected obligations at once. Dropdown-based, no free-text errors.
- **Delete** — removes all selected obligations. **Requires typing "DELETE"** in the confirmation dialog. This is a hard delete — the obligations are gone, although snapshots are kept in the audit log for forensic recovery.

**What the audit log records:**

Bulk operations write a **single** \`obligation.bulk_updated\` or \`obligation.deleted\` event with the list of affected IDs in metadata — not one event per obligation. This keeps the activity feed clean and makes it easy to spot "someone did a bulk thing at 3pm."

**Limits:** Bulk delete is capped at 100 obligations per request. For larger cleanups, do multiple batches.`,
  },
  {
    slug: 'templates',
    title: 'Using templates',
    category: 'Using the App',
    minRole: 'editor',
    tldr: 'Templates are collections of pre-configured obligations for common scenarios (Delaware C-Corp, Federal Payroll Tax, etc.). Applying a template creates all its obligations at once, optionally customized with owner and due date offsets.',
    details: `**When to use templates:**

- Setting up compliance tracking for a new entity from scratch.
- Adding a batch of related obligations (e.g., "all the SEC filings" or "quarterly tax deadlines") without entering each one manually.
- Standardizing obligations across subsidiaries that share the same requirements.

**Available templates:**

The Templates page (\`/templates\`) shows all available templates with descriptions and counts. Each template has a category and a list of pre-configured obligations with titles, frequencies, risk levels, and suggested due dates.

**Applying a template:**

1. Click a template to see its obligations.
2. (Optional) Customize: set a default owner for all obligations, select/deselect individual obligations, adjust the base date if the template uses relative dates.
3. Click "Apply."
4. All selected obligations are created at once and appear in the Obligations list.
5. The audit log records a \`template.applied\` event with the template ID and the IDs of the created obligations.

**After applying:** Treat the created obligations like any others — edit, complete, delete individually. Applying a template doesn't link the obligations back to the template afterwards. Changes to the template itself don't retroactively update obligations.`,
  },
  {
    slug: 'audit-trail',
    title: 'Audit trail',
    category: 'Using the App',
    minRole: 'editor',
    tldr: 'The Activity page (/activity) shows every action taken on every obligation: who did what, when, and what changed. Filter by event type, actor, or specific entity. Supports keyset pagination for older events.',
    details: `**What gets logged:**

- \`obligation.created\` — a new obligation was added.
- \`obligation.updated\` — fields changed. The \`diff\` column shows old and new values for tracked fields (title, due date, owner, risk level, category, notes, assignee, alert days, auto-recur).
- \`obligation.deleted\` — an obligation was removed. The full snapshot is kept in metadata.
- \`obligation.completed\` — marked complete. Metadata includes \`completionId\`, \`evidenceCount\`, and who completed it.
- \`obligation.bulk_updated\` — one event per bulk operation covering all affected obligations.
- \`template.applied\` — a template was applied; metadata lists all created obligation IDs.
- \`alert.sent\` — an email alert was sent by the cron job.
- \`user.role_changed\` — an admin promoted or demoted another user.
- \`agent.created\` / \`agent.regenerated\` / \`agent.revoked\` — agent token lifecycle events.

**Who's "who":** The \`actor\` column shows the email of the person who made the change (e.g., \`musab@fast.xyz\`), \`cron\` for automated cron jobs, or \`agent:AgentName\` for API calls made by service accounts.

**Finding things:**

- Use URL query params: \`/activity?type=obligation.updated\`, \`/activity?actor=someone@fast.xyz\`, \`/activity?entity=<obligation-id>\`.
- Pagination: if there are more than 50 events matching your filter, "Load older events →" appears at the bottom and uses a cursor to step back through history.
- The per-obligation history is also available inline: open an obligation, expand the "History" section, and see all events for that specific obligation.`,
  },
  {
    slug: 'managing-users',
    title: 'Managing users',
    category: 'Administration',
    minRole: 'admin',
    tldr: 'Go to Settings → Users to see all authenticated users. Change roles via dropdown. Demotions ask for confirmation. The last admin cannot be demoted.',
    details: `**The user list:**

Settings → Users shows every person who has ever signed in. Users are auto-created on their first successful Google sign-in — you don't invite them manually. If someone from the allowed domain (\`@fast.xyz\` or \`@pi2labs.org\`) signs in, they're added automatically as a viewer.

**Changing roles:**

Click the role dropdown on any user row. Pick the new role. Demoting someone (lowering privilege, e.g., admin → editor) prompts for confirmation with a warning about immediate access loss. Promoting someone applies immediately with a toast.

**Last-admin protection:**

You cannot demote yourself if you're the only admin. The UI will show an error and the API will return 400. This prevents accidental lockouts. If you need to transfer admin control, promote the new admin first, then demote yourself.

**Role effect timing:**

- **Immediate** — middleware and API checks consult the database on every request, so role changes take effect on the next request a user makes.
- **JWT session** — the role embedded in the user's session cookie is refreshed on every token refresh (set to every page navigation). In practice, role changes are visible within seconds.

**Removing a user:**

There's no "delete user" button today — if someone leaves the company, their Google sign-in will still work as long as their domain account exists. The safest practice is to demote them to viewer and then remove their Google account at the workspace level.`,
  },
  {
    slug: 'creating-agents',
    title: 'Creating agents for API access',
    category: 'Administration',
    minRole: 'admin',
    tldr: 'Go to Settings → Agents, click "New Agent", pick a name and role, and copy the token shown once. The token authenticates API requests. Give the token and the skill URL to an AI agent or automation bot and it can manage obligations programmatically.',
    details: `**What agents are:** Service accounts with their own bearer tokens, separate from human user sessions. Used to give AI agents (Claude Code, automation scripts, bots) programmatic access to the API without using a person's account.

**The skill URL** (always visible at the top of Settings → Agents):

\`https://compliance-tracker-alturki.vercel.app/.well-known/compliance-tracker-skill\`

This is a public, no-auth markdown document that describes the API to AI agents. Every agent you create uses the same URL — only the bearer token is per-agent. The URL is shown in a copy-able bar at the top of the Settings → Agents page so you don't have to dig through a modal to find it.

**Creating an agent:**

1. Settings → Agents → New Agent.
2. Pick a name ("SlackBot", "NightlyAuditor"), description, role (viewer/editor/admin — same hierarchy as users), and expiry (30/90/180/365 days, default 365).
3. Click Create.
4. The token is shown **exactly once** in a modal. Copy it immediately — you cannot retrieve it later.
5. The modal also shows a ready-to-paste shell export command and a prompt you can give to an AI agent to self-configure.

**Giving an agent the token:**

The simplest flow for Claude Code:

1. Copy the export command from the modal and run it in your shell:
   \`export COMPLIANCE_TRACKER_TOKEN=ct_live_...\`
2. Copy the agent prompt from the modal. It says:
   *"Fetch the Compliance Tracker skill at https://compliance-tracker-alturki.vercel.app/.well-known/compliance-tracker-skill and follow its instructions. The API token is in the COMPLIANCE_TRACKER_TOKEN environment variable."*
3. Paste that prompt into your Claude Code session.
4. The agent fetches the skill (a markdown document that describes the API) and uses the token to make authenticated requests.

**Rotating or revoking tokens:**

- **Regenerate** — creates a new token and immediately invalidates the old one. Useful if you suspect a token was leaked.
- **Revoke** — soft-deletes the agent. All future API calls with its token return 401. Revoked agents stay in the list with a strikethrough so audit log references still resolve to a name.

**Audit trail for agents:** Every API call made with an agent token shows up in the audit log with the actor \`agent:<name>\` and \`actorSource: agent\`. You can filter the activity feed to see exactly what each agent did.`,
  },
  {
    slug: 'setup',
    title: 'Initial setup and configuration',
    category: 'Administration',
    minRole: 'admin',
    tldr: 'The app needs: Turso database, Google OAuth credentials, NEXTAUTH_SECRET, the allowed domain(s), and (optional) SMTP for email alerts. See the repo README for the detailed env var list.',
    details: `**Required environment variables (Vercel production):**

- \`TURSO_DATABASE_URL\` — \`https://...\` URL for the Turso database (use https, not libsql — prevents URL parsing issues in the libsql client).
- \`TURSO_AUTH_TOKEN\` — Turso database auth token.
- \`NEXTAUTH_SECRET\` — random 32+ byte string for signing session JWTs. Generate with \`openssl rand -base64 32\`.
- \`NEXTAUTH_URL\` — the canonical production URL (e.g., \`https://compliance-tracker-alturki.vercel.app\`).
- \`GOOGLE_CLIENT_ID\` — from Google Cloud Console OAuth client.
- \`GOOGLE_CLIENT_SECRET\` — matching secret.
- \`GOOGLE_ALLOWED_DOMAIN\` — comma-separated list of allowed domains (e.g., \`fast.xyz,pi2labs.org\`).

**Optional environment variables:**

- \`SMTP_HOST\`, \`SMTP_PORT\`, \`SMTP_USER\`, \`SMTP_PASS\`, \`SMTP_SECURE\` — email alert delivery.
- \`CRON_SECRET\` — shared secret for the cron job endpoints.
- \`ALERT_EMAIL_FROM\`, \`ALERT_EMAIL_TO\` — email sender and default recipient.

**Google OAuth setup:**

1. Go to Google Cloud Console → APIs & Services → Credentials.
2. Create an OAuth 2.0 Client ID (Web application type).
3. Add authorized redirect URI: \`https://compliance-tracker-alturki.vercel.app/api/auth/callback/google\`.
4. Copy the client ID and secret into Vercel env vars.

**Setting env vars on Vercel via CLI:**

Use \`printf\` not \`echo\` to avoid trailing newlines, which cause \`TypeError: Invalid URL\` errors:

\`\`\`bash
printf '%s' 'your-secret-value' | vercel env add NEXTAUTH_SECRET production
\`\`\`

**Deployment protection:**

Vercel Deployment Protection is disabled for production so agents can reach the API. The app's own Google auth + bearer token system handles all access control. Preview deployments remain gated.

**Schema migrations:**

The app uses Drizzle ORM. To add a new column or table, update \`src/db/schema.ts\`, add the \`CREATE TABLE\` or \`ALTER TABLE\` statement to the Turso shell (\`turso db shell compliance-tracker "..."\`), and add the same statement to \`src/db/index.ts\` and \`src/test-setup.ts\` so tests and dev environments get the updated schema.`,
  },
]

export function visibleTopicsForRole(role: HelpRole): HelpTopic[] {
  const level = { viewer: 0, editor: 1, admin: 2 }
  const userLevel = level[role]
  return HELP_TOPICS.filter(t => userLevel >= level[t.minRole])
}
