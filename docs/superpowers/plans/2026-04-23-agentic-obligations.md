# Agentic Obligations Implementation Plan

**Goal:** Evolve the compliance tracker from a passive registry into an **active obligations and controls layer**. Ship in three phases that each leave the product more useful than they found it: (0) schema foundation for evidence packets + sub-obligations, (1) a playbook engine with one real playbook (generic **Quarterly Investor Report**) wired end-to-end, (2) a recommended-additions catalog that closes compliance-surface gaps for a Delaware C-corp with a crypto-adjacent product.

**Architecture:** Three phases, each independently shippable and mergeable to `main`. Phase 0 is pure schema + data; no behavior changes yet. Phase 1 makes every obligation capable of being a workflow tree via `parent_id`, and ships the first real tree. Phase 2 adds a browsable catalog of additions curated for Pi Squared's profile. Everything is shippable without LLMs or email ingestion — those are explicitly **deferred** to a later phase.

**Tech stack:** Next.js 14 App Router, libsql/Drizzle (Turso in prod, file-based SQLite in test, in-memory for dev), NextAuth v5 with Google + agent bearer tokens, Tailwind. No new dependencies in Phase 0–2. Playbooks and catalog content live as code (TypeScript modules) — DB-persisted playbook definitions are out of scope.

**Constraint:** 279 integration tests must stay green. Schema changes must land in the 5 canonical places per `CLAUDE.md` and include a Turso `ALTER TABLE` migration script.

---

## What's explicitly out of scope

- Email ingestion inbox (originally feature "D"). Deferred.
- LLM classification / drafting / extraction. Deferred to a separate feature.
- Google Drive integration. Rejected — user's existing agents already cover doc-submission flows.
- Cross-tree obligation dependencies (X blocks Y). Parent/child sub-obligations are enough for the first playbook. Revisit in a later phase if blockers become real.
- Event-triggered workflows (e.g., "a round closed → create pro-rata notice"). Tier 3 in the brainstorm; park until recurring-cadence playbooks are proven.
- Commitments graph, risk rollups, trust surface. Later phases.

---

## Pre-work

Read these before starting Phase 0:

| File | Why |
| --- | --- |
| `CLAUDE.md` § *Current repo gotchas* | The "5-place schema change" rule + Turso `ALTER TABLE` requirement |
| `src/db/schema.ts` | Current `obligations`, `completions`, `auditLog` shape |
| `src/data/templates.ts` | Existing template/relative-due-date pattern that playbooks extend |
| `src/app/obligations/page.tsx` | Detail panel + completion sheet — Phase 1 extends these |
| `src/lib/audit-helpers.ts` + `src/lib/audit.ts` | Pattern for logging changes; new sub-obligation events follow this |
| `src/test/integration-helpers.ts` | Fixture/DDL pattern — Phase 0 adds columns here in lockstep with `schema.ts` |

---

## Phase 0 — schema foundation (~1–2 weeks)

**Goal:** Lay the groundwork for sub-obligations, evidence packets, and blocker states. No new UI, no new behavior — just a better shape for later phases to build on. Ship this as one self-contained PR.

### File inventory

| Path | Change |
| --- | --- |
| `src/db/schema.ts` | Add columns to `obligations` + `completions`. |
| `src/db/index.ts` | Mirror DDL in the in-memory init block and the seed `INSERT`. |
| `src/db/seed.ts` | Mirror DDL in the file-backed seeder. |
| `src/test-setup.ts` | Mirror DDL for Vitest. |
| `src/test/integration-helpers.ts` | Mirror DDL for integration fixtures. |
| `scripts/migrate-2026-04-23-agentic.sql` | New — hand-run `ALTER TABLE` migration for Turso prod. |
| `src/lib/types.ts` | Expand `Obligation` with the new fields; add `EvidencePacket` type. |
| `src/lib/validation.ts` | Validation for the new fields; status accepts `"blocked"`. |
| `src/lib/audit-helpers.ts` | `auditedUpdate` picks up the new fields in diffs. |
| `src/test/integration/evidence-packet.test.ts` | New — CRUD for evidence-packet fields on a completion. |
| `src/test/integration/sub-obligations.test.ts` | New — creating sub-obligations, listing children, parent rollup. |

### Schema changes

**`obligations` table** — four new nullable columns, no backfill required:

```sql
ALTER TABLE obligations ADD COLUMN parent_id TEXT REFERENCES obligations(id);
ALTER TABLE obligations ADD COLUMN sequence INTEGER;           -- order among siblings under a parent
ALTER TABLE obligations ADD COLUMN blocker_reason TEXT;        -- free-text explanation when status='blocked'
ALTER TABLE obligations ADD COLUMN next_recommended_action TEXT;  -- what the owner should do next
CREATE INDEX idx_obligations_parent_id ON obligations(parent_id);
```

Existing `status` column already accepts free text; we start storing `"blocked"` as an allowed value. No enum migration needed, but `computeStatus` in `src/lib/utils.ts` and the status color maps get a `"blocked"` arm (Phase 1 UI wires the visuals).

**`completions` table** — evidence packet fields:

```sql
ALTER TABLE completions ADD COLUMN approved_by TEXT;
ALTER TABLE completions ADD COLUMN approved_date TEXT;
ALTER TABLE completions ADD COLUMN verification_status TEXT DEFAULT 'unverified';  -- unverified | self-verified | approved | audited
ALTER TABLE completions ADD COLUMN summary TEXT;           -- structured completion summary, replaces "notes" for new packets
ALTER TABLE completions ADD COLUMN evidence_urls TEXT;     -- JSON array; evidenceUrl stays for back-compat (reads return both)
```

Rationale on the last column: `evidence_url` (singular) stays in place and still populated for single-file completions. `evidence_urls` (JSON array) is additive. API responses expose both; writers populate both consistently. Over time, reads switch to `evidence_urls` and the singular becomes a legacy field — but that cleanup is not in this phase.

### Tasks

1. **Update `src/db/schema.ts`.** Add the six new columns (four on `obligations`, five on `completions`). Add the `parent_id` index via a raw-SQL statement alongside the Drizzle declaration.

2. **Mirror DDL in four more files.** `src/db/index.ts` (in-memory init + seed INSERT), `src/db/seed.ts`, `src/test-setup.ts`, `src/test/integration-helpers.ts`. Every `CREATE TABLE` block gets the new columns. Every existing `INSERT` stays valid because all new columns are nullable.

3. **Write `scripts/migrate-2026-04-23-agentic.sql`.** The `ALTER TABLE` statements above, with a header comment explaining the one-shot nature. This is hand-run against Turso prod before the PR merges — it does not run in CI.

4. **Expand types.** In `src/lib/types.ts`:
   - `Obligation` gains `parentId?: string | null`, `sequence?: number | null`, `blockerReason?: string | null`, `nextRecommendedAction?: string | null`.
   - New `Status` value: `'blocked'`.
   - New `EvidencePacket` type describing the completion fields collectively (used in Phase 1 UI).

5. **Update validation.** In `src/lib/validation.ts`:
   - `parent_id` must reference an existing obligation (foreign key) and must not be self.
   - `sequence` is a non-negative integer when set.
   - `blocker_reason` is required when `status === 'blocked'`; empty otherwise.
   - `approved_date` must not precede `completed_date`.
   - `verification_status` is one of the four allowed values.

6. **Update `auditedUpdate`.** The diff serializer in `src/lib/audit-helpers.ts` needs to include the new fields so audit entries capture them. No structural change — just add them to the field list.

7. **Write two integration test files.**
   - `src/test/integration/evidence-packet.test.ts`: POST completion with all new fields → GET returns them; approver/approvedDate consistency; verificationStatus rejected if invalid.
   - `src/test/integration/sub-obligations.test.ts`: Create obligation A, create B with `parent_id=A.id`, list children of A returns B; attempt to set `parent_id` to self → 400; attempt to set `parent_id` to nonexistent id → 400.

8. **Run the full suite.** `npm run build`; `npx vitest --run`. Expected: build clean, 279 existing tests + ~8–12 new tests all passing.

9. **Commit + push.** Single commit on a feature branch. Merge to `main`. Apply the migration SQL against Turso prod before the deploy goes live.

### Acceptance

- `npm run build` succeeds.
- All existing and new tests pass.
- `scripts/migrate-2026-04-23-agentic.sql` runs cleanly against a fresh copy of the prod schema.
- Existing obligations API responses unchanged from the client's perspective unless new fields are explicitly requested.

---

## Phase 1 — playbook engine + first playbook (~2–3 weeks)

**Goal:** A playbook is a reusable workflow definition. Applying one creates a parent obligation with a tree of sub-obligations, each with its own owner, deadline, and evidence requirement. Ship the engine plus **one real playbook — the generic Quarterly Investor Report** — as the reference implementation. Counterparty (which investor this report is for), anchor date, and any per-step owner overrides are supplied at **apply time**, not baked into the playbook definition. By end of phase, the user can go to `/playbooks`, pick "Quarterly Investor Report," fill in "[Real Investor Name]" + anchor date in the Apply dialog, and see five linked obligations appear with correct dates.

### File inventory

| Path | Change |
| --- | --- |
| `src/data/playbooks.ts` | New — shape definition + VP LP quarterly playbook. |
| `src/lib/playbooks.ts` | New — engine that applies a playbook to produce an obligation tree. |
| `src/app/api/playbooks/route.ts` | New — `GET` list, `POST` apply. |
| `src/app/api/playbooks/[id]/route.ts` | New — `GET` single-playbook detail. |
| `src/app/playbooks/page.tsx` | New — browse + apply UI (lives alongside `/templates`). |
| `src/app/obligations/page.tsx` | Update detail panel to render sub-obligation tree + blocker UX + next-recommended-action. |
| `src/components/obligations/sub-obligation-tree.tsx` | New — indented tree with status pills, inline evidence links, per-child completion button. |
| `src/components/obligations/evidence-packet-card.tsx` | New — renders the full evidence packet on a completion (approver, verification status, evidence URLs). |
| `src/app/api/obligations/[id]/sub-obligations/route.ts` | New — `GET` children, `POST` add one, scoped by role. |
| `src/test/integration/playbooks.test.ts` | New — applying playbook creates parent + N children with correct dates and owners. |
| `src/test/integration/role-enforcement.test.ts` | Extend — new playbook + sub-obligation routes exercised in the role matrix. |

### Playbook shape

Playbooks reuse the relative-due-date pattern from `templates.ts` but add sub-obligation nesting and per-step evidence requirements. Definitions live as code — they're static and versioned with the codebase, not user-editable yet.

Counterparty-specific data (which investor, which vendor, which jurisdiction) is **not** stored in the playbook. It's captured by the Apply dialog and injected into obligations at creation time. This keeps a single playbook reusable across every counterparty of the same shape.

```ts
// src/data/playbooks.ts (sketch)
export interface PlaybookStep {
  slug: string                    // stable identifier within this playbook
  title: string                   // rendered as the sub-obligation title; supports {{counterparty}}
  description?: string
  defaultOwner: string            // role label, e.g., "CFO"; overridable per-step at apply time
  offsetDaysFromAnchor: number    // negative = before anchor, positive = after
  riskLevel: RiskLevel
  evidenceRequired: boolean       // true = cannot complete without evidenceUrls
  alertDays?: number[]
  notes?: string
}

export interface Playbook {
  id: string                      // stable slug, e.g. "quarterly-investor-report"
  name: string
  description: string
  category: Category
  icon: string
  anchorDateStrategy: 'end-of-quarter' | 'provided-at-apply'
  recurrence?: 'quarterly' | 'annual' | 'monthly' | null
  requiresCounterparty: boolean   // if true, Apply dialog requires a counterparty string
  parentTemplate: {
    title: string                 // supports {{quarter}}, {{year}}, {{counterparty}} placeholders
    description?: string
    jurisdiction?: string
    amount?: number
  }
  steps: PlaybookStep[]
}

export interface ApplyPlaybookInput {
  playbookId: string
  anchorDate: string              // ISO date
  counterparty?: string           // required when playbook.requiresCounterparty
  ownerOverrides?: Record<string, string>   // step slug → owner name (overrides defaultOwner)
}
```

### The first playbook

```ts
{
  id: 'quarterly-investor-report',
  name: 'Quarterly Investor Report',
  description: 'Prepare and send a quarterly report to an investor: collect financials, draft narrative, review, send, archive.',
  category: 'investor',
  icon: '📊',
  anchorDateStrategy: 'end-of-quarter',
  recurrence: 'quarterly',
  requiresCounterparty: true,
  parentTemplate: {
    title: '{{counterparty}} — {{quarter}} {{year}} Quarterly Report',
    description: 'Quarterly financials + narrative delivered to {{counterparty}}.',
  },
  steps: [
    { slug: 'collect-financials', title: 'Collect quarterly financials', defaultOwner: 'CFO',
      offsetDaysFromAnchor: -21, riskLevel: 'high', evidenceRequired: true, alertDays: [7, 3, 1] },
    { slug: 'draft-narrative',   title: 'Draft narrative update',       defaultOwner: 'CEO',
      offsetDaysFromAnchor: -14, riskLevel: 'medium', evidenceRequired: true, alertDays: [5, 2] },
    { slug: 'internal-review',   title: 'Internal review + sign-off',    defaultOwner: 'CEO',
      offsetDaysFromAnchor: -7,  riskLevel: 'medium', evidenceRequired: false, alertDays: [2, 1] },
    { slug: 'send-to-investor',  title: 'Send report to {{counterparty}}', defaultOwner: 'CEO',
      offsetDaysFromAnchor: 0,   riskLevel: 'critical', evidenceRequired: true, alertDays: [1, 0] },
    { slug: 'archive',           title: 'Archive & reconcile',           defaultOwner: 'CFO',
      offsetDaysFromAnchor: 3,   riskLevel: 'low', evidenceRequired: false },
  ],
}
```

### Tasks

1. **Write `src/data/playbooks.ts`.** The types above plus the `quarterly-investor-report` playbook. Add one more placeholder playbook (empty array of steps) for the D&O insurance renewal so the catalog has >1 row — full implementation is Phase 2 or later.

2. **Write `src/lib/playbooks.ts`.** Core engine with two functions:
   - `listPlaybooks(): Playbook[]` — read-only list.
   - `applyPlaybook(input: ApplyPlaybookInput & { appliedBy: string; creatorEmail?: string })` — returns `{ parent: Obligation, children: Obligation[] }`. Validates `counterparty` is present when `playbook.requiresCounterparty`. Computes each child's `next_due_date` from anchor + offset. Applies `ownerOverrides[stepSlug]` if present, else uses `defaultOwner`. Resolves `{{quarter}}`, `{{year}}`, `{{counterparty}}` placeholders in parent and step titles. Writes all rows in a single transaction with `parent_id` wired, emits one audit event per created obligation plus a `playbook.applied` summary event.

3. **API routes.**
   - `GET /api/playbooks` — list available playbooks. `editor` and above.
   - `GET /api/playbooks/[id]` — detail with steps expanded. `editor` and above.
   - `POST /api/playbooks` — body matches `ApplyPlaybookInput`: `{ playbookId, anchorDate, counterparty?, ownerOverrides? }`. Applies the playbook. `editor` and above. Returns the created parent + children. Audit event recorded. Rejects with 400 if `counterparty` is missing for a playbook that requires one.
   - `GET /api/obligations/[id]/sub-obligations` — list children of a given obligation. Inherits the parent's read permissions.

4. **Playbook browse page: `src/app/playbooks/page.tsx`.** Copy the visual pattern from `/templates`: card grid, preview modal with step list, "Apply" button. Applying opens a dialog with these fields:
   - **Counterparty** (required when `playbook.requiresCounterparty`) — text input with autocomplete sourced from `GET /api/counterparties` (existing endpoint). Shows the preview title updating live as the user types, so they see e.g. `"Acme Capital LP — Q2 2026 Quarterly Report"` before committing.
   - **Anchor date** — defaults to end-of-current-quarter for `end-of-quarter` strategy; free date picker for `provided-at-apply`.
   - **Owner overrides** — collapsed by default; expanding shows each step with its `defaultOwner` pre-filled and editable, so the user can swap `"CFO"` → `"Alex Jones"` without modifying the playbook.
   - Submit POSTs to `/api/playbooks`, then redirects to `/obligations?id=<parentId>` with a success toast.

5. **Upgrade the obligations detail panel.** When the selected obligation has `sub_obligations.length > 0`, show the sub-obligation tree below the header. When the obligation has a `parent_id`, show a breadcrumb "Part of: [Parent Title]" at the top. When `status === 'blocked'`, render `blocker_reason` in a danger-tinted callout. When `next_recommended_action` is set, render it as a single-line "Next: {text}" hint above the completion button.

6. **`<SubObligationTree>` component.** Indented list (mobile: stacked, md+: nested with vertical guides). Each child row shows: status pill, title, owner, relative due (`3d`, `+2d`), a small chevron to expand its own evidence packet. Editor+ can mark a child complete inline (opens the existing completion sheet, scoped to the child).

7. **`<EvidencePacketCard>` component.** Replaces the current completion summary block. Renders: completedBy, completedDate, approvedBy (if any) + approvedDate, verificationStatus as a badge, summary text, a list of evidence URLs with type icons (pdf, image, other). Links are actual anchors.

8. **Completion flow upgrade.** The existing completion dialog (current "Mark Complete" sheet) gains the new fields: an "Approver" selector (autocomplete from users), a "Verification" dropdown (`unverified` | `self-verified` | `approved`), a "Summary" textarea, multi-file evidence upload (already supported via `FileUpload`). Writes populate both `evidence_url` (first file) and `evidence_urls` (JSON array of all files). If the obligation's step has `evidenceRequired: true`, the form blocks submit until at least one file is attached.

9. **Parent rollup status.** When all children of a parent reach `status === 'completed'`, parent auto-advances to `completed` via a post-completion hook in the complete-route handler. If a child goes `blocked`, parent does not auto-block — explicit action required. Log both as audit events.

10. **Integration tests.**
    - `playbooks.test.ts`: list returns the `quarterly-investor-report` playbook; applying with a counterparty creates 1 parent + 5 children with correct dates (stub "today" via injectable clock); applying without a counterparty returns 400; anchor strategy `end-of-quarter` resolves correctly across Q1/Q2/Q3/Q4; owner-overrides correctly swap the assigned owner; title placeholders (`{{counterparty}}`, `{{quarter}}`, `{{year}}`) render into obligation titles; audit log has 6 create events + 1 apply summary.
    - `sub-obligations.test.ts` (from Phase 0): extended with "marking last child complete auto-completes parent" and "marking one child blocked does not auto-block parent."
    - Extend `role-enforcement.test.ts`: viewer → 403 on `POST /api/playbooks`; editor → 200; admin → 200.

11. **Role gating.** `/playbooks` page hidden for `viewer` in the sidebar and command palette. `POST /api/playbooks` requires `editor`. `POST /api/obligations/[id]/sub-obligations` requires `editor`.

12. **Mobile check.** Sub-obligation tree tested at 375px — indentation collapses to left-side stripes instead of nested padding so items remain readable.

13. **Build + test + commit + push.** One feature branch, multiple commits is fine (schema-touching commit, engine commit, UI commit, playbook-data commit), merge fast-forward.

### Acceptance

- Applying the `quarterly-investor-report` playbook with anchor `2026-06-30` and counterparty `"Acme Capital LP"` produces 1 parent titled `"Acme Capital LP — Q2 2026 Quarterly Report"` + 5 children with due dates `2026-06-09, 2026-06-16, 2026-06-23, 2026-06-30, 2026-07-03`.
- Applying the same playbook twice with different counterparties in the same quarter produces two independent obligation trees — no cross-pollination.
- The parent obligation page shows the tree with each child's status, and completing all children moves the parent to `completed` automatically.
- Role matrix in `role-enforcement.test.ts` passes for every new route.
- 279 existing tests + ~15 new tests green.

---

## Phase 2 — recommended-additions catalog (~1 week)

**Goal:** A curated, browsable list of standard-startup obligations that aren't yet in the DB. One-click "add with my defaults." Covers the gaps identified in brainstorming: state securities (Blue Sky), state filings (CA SOI, foreign qualification), tax (Section 174, unclaimed property), employment (OSHA 300, ACA 1094/1095), privacy (DPAs, CCPA response), IP (trademark application + maintenance as future items), and crypto (smart contract audit cycle, bug bounty SLA, Howey refresh).

### File inventory

| Path | Change |
| --- | --- |
| `src/data/recommended-additions.ts` | New — ~40 items curated for the Pi Squared profile. |
| `src/app/catalog/page.tsx` | New — browse UI with category filter + search. |
| `src/app/api/catalog/route.ts` | New — `GET` list (no-op mutations; adds go through `POST /api/obligations`). |
| `src/components/layout/sidebar.tsx` | Add "Catalog" nav entry (`minRole: editor`). |
| `src/components/command-palette.tsx` | Catalog items searchable from the palette. |
| `src/test/integration/catalog.test.ts` | New — list shape; adding an item creates a real obligation with the defaults. |

### Data shape

```ts
// src/data/recommended-additions.ts (sketch)
export interface RecommendedItem {
  id: string                      // stable slug
  title: string
  category: Category
  frequency: Frequency
  defaultJurisdiction?: string
  defaultCounterparty?: string
  suggestedOwner: string          // role-like, e.g., "CFO"
  defaultRiskLevel: RiskLevel
  relativeDueDate?: RelativeDueDate  // optional — many items are event-triggered
  whyItMatters: string            // one-paragraph explainer rendered on the card
  consequenceOfMissing: string    // short line about penalties / risk
  applicabilityHint: string       // "If 50+ FTE", "If you register a trademark", etc.
  tags: ('state-securities' | 'privacy' | 'ip' | 'crypto' | 'employment' | 'tax' | 'governance')[]
  maturity: 'now' | 'future'      // "future" items are reminders for later, not immediate adds
}
```

### Content plan (the ~40 items)

Grouped here to make reviewing content easier; each will have the fields above in code.

**State securities (now):**
- Blue Sky notice filing (Delaware, California, New York, Illinois, Texas — one per state with Form D subscribers)
- Rule 506(d) bad-actor re-certification (annual)

**Governance (now):**
- California Statement of Information (biennial)
- Foreign qualification renewal (per state — CA, IL, TX, TN)
- Registered agent renewal (Delaware + foreign-qualified states)
- Board meeting cadence (quarterly)
- Stock issuance board consent (event-triggered — one row per issuance)

**Tax (now):**
- Section 174 R&D capitalization review (annual)
- State unclaimed property / escheat (annual, per state)
- Form 1099-MISC (annual)
- Form 5472 (annual, if foreign shareholders — tagged conditional)
- State sales tax nexus review (annual)

**Employment (now):**
- OSHA Form 300 log + 300A posting (annual, if 10+ employees)
- ACA 1094/1095 filings (annual, if 50+ FTE — conditional)
- SPD/SBC distribution (annual)
- State paid sick/family leave review (annual, multi-state)

**Privacy (now):**
- Privacy policy review (annual or on material change)
- Vendor DPA tracking (per-vendor, annual renewal)
- State privacy law response readiness (CCPA/CPRA, VCDPA, CPA, CTDPA, UCPA — one row per applicable state)
- Data retention schedule review (annual)

**IP (future + now):**
- Trademark application (now — one row per planned mark, marked `maturity: 'future'`)
- Trademark Section 8/15 declaration (Y5-6, future — auto-create on registration)
- Trademark renewal (Y10, future)
- Domain renewal (annual — critical)
- Open-source license audit (annual)

**Crypto (now, Pi Squared-specific):**
- Smart contract audit cycle (annual or per major release)
- Bug bounty / disclosure SLA (standing)
- Howey / legal opinion refresh (annual or on material product change)
- Token transfer restriction tracking (standing, if any restricted holders)
- Validator operational obligations (standing, if running infra)

### Tasks

1. **Write `src/data/recommended-additions.ts`** with the types above and the ~40 curated items. Exact counts don't matter; quality of the `whyItMatters` + `consequenceOfMissing` text does.

2. **`GET /api/catalog` route** — returns the static list with no filtering (filtering happens client-side; list is small). Readable by any authenticated user; the Add action still requires `editor`.

3. **`src/app/catalog/page.tsx`**. Three-column layout on desktop, single-column on mobile. Left: tag filters (multi-select). Right: list of cards. Each card: title, applicability hint as a small chip, category badge, why-it-matters paragraph, "Add to tracker" button. Clicking Add opens a confirmation with the default fields pre-filled; editable before final confirm. On confirm, `POST /api/obligations` with the defaults, toast success, link to the created obligation. Items with `maturity: 'future'` render with a dimmed card + "Add later" caption and no Add button (they're reminders, not immediate adds).

4. **Sidebar + command palette integration.** Add "Catalog" as a new nav entry under `/catalog` with `minRole: 'editor'`. Palette surfaces catalog items as a new group under a "Recommended" heading when the query matches their title, tag, or category. Selecting a catalog item jumps to `/catalog?highlight=<id>`.

5. **Integration test.** `catalog.test.ts`: `GET /api/catalog` returns the expected count and shape; adding a known item by calling the obligations API with a catalog item's defaults produces a valid obligation that passes existing validation.

6. **Build + test + commit + push.** Standard flow.

### Acceptance

- A new user on the production app can navigate to `/catalog`, filter by `privacy`, see the CCPA/GDPR items with clear explainers, and add them as real obligations in under a minute.
- Items marked `maturity: 'future'` don't appear as actionable adds but remain discoverable.
- Tests green.

---

## Cross-cutting concerns

### Audit log entries

- Phase 0 adds no new event types.
- Phase 1 adds `playbook.applied` (metadata: `playbookId`, `parentObligationId`, `childCount`), `obligation.sub_created`, `obligation.parent_rollup_complete`.
- Phase 2 adds `obligation.created_from_catalog` (metadata: `catalogItemId`).

### Role enforcement

Every new route goes into `src/test/integration/role-enforcement.test.ts` with rows for `viewer`, `editor`, `admin`, and `agent-with-editor-role`. No exceptions.

### Mobile

- Sub-obligation tree collapses indentation to a left-border stripe on `<md` breakpoints.
- Catalog page stacks cards vertically on `<md`.
- Playbook preview modal uses `max-h-[85vh] overflow-y-auto` and same responsive classes as the templates preview.

### Evidence file size

Raise the `validateFile` default in `src/lib/blob.ts` from `10` to `25` MB so board packets and financial PDFs don't need per-call overrides. Update the allowed-types list if any real-world evidence types fall outside the current set (pdf, images, office docs, text) once we hit that friction in practice — not pre-emptively.

### Audit log diffs

`auditedUpdate` in `src/lib/audit-helpers.ts` needs to know the new fields so they appear in diffs. Add them to the serialized field list in Phase 0 at the same time as the schema change.

### Dev / prod parity

- Phase 0 migration SQL (`scripts/migrate-2026-04-23-agentic.sql`) is hand-run against Turso prod before the Phase 0 deploy. Local dev regenerates DB from `seed.ts` (already has the new columns).
- Phases 1 + 2 need no further DB migrations.

---

## Build order recommendation

Land phases sequentially on `main`, each as its own PR (or direct push if sufficiently small):

1. Phase 0 schema → PR, merge, apply Turso migration, deploy.
2. Phase 1 playbook engine + VP LP playbook → PR, merge, deploy. Use the app for one real quarterly cycle before moving on.
3. Phase 2 catalog → PR, merge, deploy.

Do not batch Phase 1 + Phase 2. Phase 1 is where most of the thinking happens and the engine needs to be proved against real use before we layer catalog content on top.

---

## Kill criteria

If, after Phase 1 is live, the VP LP playbook isn't materially improving how you actually prepare and send the quarterly report — if it feels like more ceremony for the same work — stop. Don't layer Phase 2. The thesis that "playbook engines beat flat obligations" has to earn its place against your real weekly experience, not against the market analysis.

---

## Resolved decisions

- **First playbook is generic, not investor-specific.** `quarterly-investor-report` takes counterparty at apply time so Pi Squared (and any future customer) can reuse it across every investor. Anchor strategy defaults to end-of-quarter; customize per-apply via the Apply dialog.
- **Evidence size cap raised to 25MB** in Phase 0 alongside the schema work (one-line change in `src/lib/blob.ts`).
- **Default owners are role labels** (`"CFO"`, `"CEO"`) set in the playbook definition. The Apply dialog surfaces these as editable per-step inputs so the user swaps to a real name without touching the playbook file.

The plan is executable as written.
