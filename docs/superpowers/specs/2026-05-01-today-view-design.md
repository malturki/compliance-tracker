# "Today" View — Design Spec

**Date:** 2026-05-01
**Surface:** new `/today` route + new `GET /api/today` endpoint
**Goal:** Give users a single focused screen showing exactly what to act on right now — overdue items first, today's items, this week's items, and an expandable "coming up" list. The intended most-used view, modeled on the proven patterns from Things 3, Todoist, and Apple Reminders.

## Constraints

- Today is an **addition**. Overview at `/` stays exactly as it is — same content, same behavior, same nav presence.
- No schema changes. Today is a new endpoint that reads existing data.
- Reuse existing primitives: detail Sheet, completion form (with Phase-1 system-user select), risk/status badges, sidebar role-aware nav.
- Mobile-first by default; layout works on the iPhone-SE 375px baseline.

## Pre-work

| File | Why |
| --- | --- |
| `src/app/page.tsx` | Reference for the empty-state CTA pattern (lines 69-114) — Today reuses similar voice for the "nothing scheduled" case |
| `src/app/obligations/page.tsx` | Where the detail Sheet lives + how completion form pre-fills the current user (Phase 1 + recent completedBy work) |
| `src/lib/recurrence.ts` | Pattern for URL-param parsing helpers used elsewhere |
| `src/components/layout/sidebar.tsx` | Where the new "Today" nav entry goes |
| `CLAUDE.md` § *Auth and access control* | Viewer permissions; role-enforcement test pattern |

## Placement

- **Route:** `/today`. Lives under the same AppShell as everything else.
- **Sidebar:** new "Today" entry, **positioned first** (above Overview), `minRole: 'viewer'`. Icon: `ListTodo` from lucide-react.
- **Command palette:** new entry mirroring the sidebar, viewer+.
- **Default landing:** unchanged. `/` still goes to Overview. We don't auto-redirect — users get there by clicking the nav entry. Once they form the habit, the muscle memory is theirs.

## Layout

A single-column page with a sticky hero ribbon and four collapsible sections in urgency order:

```
[ Hero ribbon (sticky) ]
  3 overdue · 2 today · 5 this week · 12 coming up

▾ Overdue (3)
   ┌── My obligations (2)
   │   [▢] [CRIT] Delaware Franchise Tax           7d ago    you
   │   [▢] [HIGH] D&O Insurance Renewal            3d ago    you
   └── Owned by others (1) ▸     ← collapsed by default

▾ Today (2)
   ┌── My obligations (2)
   │   [▢] [CRIT] Send Q2 report — Acme Capital LP      today    you
   │   [▢] [HIGH] Form 941 Q2 filing                    today    you

▾ This week (5)
   …

▸ Coming up (12)             ← collapsed by default
```

### Per-row UI (one line)
- Inline checkbox — opens the existing completion Sheet pre-filled with the current user (uses the system-user `<Select>` shipped earlier).
- Risk badge (`CRITICAL`/`HIGH`/`MEDIUM`/`LOW`) — color-coded, matches existing risk color tokens.
- Title — single line, truncated with ellipsis. Sub-obligations get a leading "•" glyph indicating they're part of a workflow tree; clicking still opens the parent's detail Sheet.
- Relative date label (`7d ago`, `today`, `in 3d`).
- Owner — display name if available, else email.
- Click row body → opens detail Sheet (existing pattern).

### Section behavior
- **Overdue** and **Today** are expanded by default.
- **This week** is expanded by default if it has items.
- **Coming up** is collapsed by default — surface the count, hide the noise.
- Within each section, "My obligations" is expanded; "Owned by others" is collapsed by default.
- For viewers (who can't be obligation owners), the mine/others split is hidden — they see one flat list per section.

## Data — `GET /api/today`

A new authenticated endpoint that does the bucketing server-side. Cleaner than client-side, easier to test, easier to add caching later.

### Response shape

```ts
{
  summary: { overdue: number; today: number; thisWeek: number; comingUp: number },
  overdue:  { mine: ObligationWithStatus[]; others: ObligationWithStatus[] },
  today:    { mine: ObligationWithStatus[]; others: ObligationWithStatus[] },
  thisWeek: { mine: ObligationWithStatus[]; others: ObligationWithStatus[] },
  comingUp: { mine: ObligationWithStatus[]; others: ObligationWithStatus[] },
}
```

Each obligation row carries the same fields as `GET /api/obligations` plus the computed `status`. Sub-obligations (rows with `parent_id` set) are **included** — they're real action items.

### Bucket definitions

Where `today = startOfDay(serverNow)`:

| Bucket | Predicate |
| --- | --- |
| `overdue` | `next_due_date < today` AND `status ≠ 'completed'` |
| `today` | `next_due_date == today` AND `status ≠ 'completed'` |
| `thisWeek` | `today < next_due_date <= today + 7d` AND `status ≠ 'completed'` |
| `comingUp` | `today + 7d < next_due_date <= today + 30d` AND `status ≠ 'completed'` |

Rows with `status = 'completed'` are excluded everywhere. Rows with `status = 'blocked'` are **included** in the appropriate bucket (a blocked obligation is still pending action).

### Sort

Within each bucket, sort by:
1. `riskLevel` DESC (`critical → high → medium → low`)
2. `nextDueDate` ASC

### Mine vs others partition

- "Mine" = `obligation.owner` matches the session user's `name` OR `email` (case-insensitive). Fallback: empty `mine` if no session.
- "Others" = everything else.
- For viewers: `mine` is always empty; route returns the merged set in `others` (UI hides the split for viewers).

### Auth + role

- Bearer-authenticated agents: returns the same shape, partitioned by the agent's name (so `agent:slack-bot` sees its assigned items in `mine`).
- Sessions: viewer+, agent role doesn't matter beyond authentication.
- `GET /api/today` requires `viewer` role minimum.

## Components

| Path | Responsibility |
| --- | --- |
| `src/app/today/page.tsx` | Client component. Fetches `/api/today`, renders sections, handles refresh after completion. |
| `src/app/api/today/route.ts` | New GET route. Pulls obligations, calls the pure grouper, returns the response shape above. |
| `src/lib/today.ts` | Pure grouping logic + bucket boundaries + sort + mine/others partition. No I/O. Testable. |
| `src/components/today/today-section.tsx` | Collapsible section with mine/others sub-groups + per-row rendering. |
| `src/components/today/today-row.tsx` | Single-row card: checkbox · risk · title · date · owner. Clickable for detail Sheet. |
| `src/components/today/empty-state.tsx` | "All caught up" celebratory card when overdue+today are both empty. |

## Empty states

| Condition | Render |
| --- | --- |
| Overdue + Today both empty, but This Week or Coming Up has items | Inline "All caught up — nothing pressing today" card above This Week section. |
| Every bucket empty AND tracker has obligations | "Nothing scheduled in the next 30 days. View [Obligations](/obligations) for the full list." |
| Whole tracker empty (no obligations at all) | Soft hand-off: "No obligations are tracked yet. Visit [Templates](/templates) or [Catalog](/catalog) to add some." (only for `editor+`) |

## Mobile

- Single column always. Hero ribbon collapses to a 2×2 metric grid below `md`.
- Section headers stick within their own section so the user always knows the bucket.
- "Owned by others" stays collapsed on mobile.
- Per-row layout: title can wrap to a second line on very narrow viewports; risk badge + relative date stay on the right.

## Testing

### Integration: `src/test/integration/today.test.ts`

- Bucket boundaries: insert obligations dated `today-1d`, `today`, `today+1d`, `today+7d`, `today+8d`, `today+30d`, `today+31d` and confirm each lands in the right bucket (or no bucket for the +31 case).
- Status='completed' row excluded from all buckets.
- Status='blocked' row included in the appropriate bucket.
- Mine vs others split: insert two obligations, one owned by the session email, one by a different name; confirm partition.
- Viewer: `mine` always empty, all rows in `others`.
- Sub-obligations: a child of a parent obligation is included in its bucket independently of the parent.
- Sort: critical-priority row outranks high-priority row at the same date; same-priority rows sort by date ASC.
- Summary counts: equal sum of `mine.length + others.length` across each bucket.

### Unit: `src/lib/today.test.ts`

- Pure-function grouper: given a list of obligations + a "today" date + a session-email, produce expected buckets.
- Helpers: `isOverdue`, `isToday`, `isThisWeek`, `isComingUp`.

### Role enforcement (extends `role-enforcement.test.ts`)

- viewer: GET 200 (returns flat `others` only)
- editor: GET 200 (returns mine + others split)
- admin: GET 200 (same as editor)
- unauth: GET 401

## Out of scope

- Drag-and-drop reordering, "promote to today" pin (Things-style heart). Future enhancement if needed.
- Calendar week view — `/calendar` already covers that visualization.
- AI-suggested next actions — `next_recommended_action` field already exists; no new feature here.
- Caching the endpoint — keep it dynamic. Add caching later if it becomes hot.
- Defaulting `/` to redirect to `/today` — explicitly excluded per the user's amendment.
- Removing or changing anything on Overview, Dashboard, or any other existing surface.

## Build order

1. **Pure grouper + tests** — `src/lib/today.ts` + `src/lib/today.test.ts`. Pure logic, no I/O. Validates bucketing/sort/partition before anything else exists.
2. **API endpoint + integration tests** — `src/app/api/today/route.ts` + `src/test/integration/today.test.ts`. Server-side bucketing wired up, role-enforcement extended.
3. **Page + components** — `src/app/today/page.tsx`, `today-section.tsx`, `today-row.tsx`, `empty-state.tsx`. Wire the data, render the layout.
4. **Sidebar + command palette** — add the "Today" entry first in nav.
5. **Manual QA** — exercise the empty states, completion-from-row flow, mobile breakpoints, viewer experience, sub-obligation rendering.
6. **Build + tests + commit + push + monitor deploy.**

Estimated effort: 1 day, single PR.
