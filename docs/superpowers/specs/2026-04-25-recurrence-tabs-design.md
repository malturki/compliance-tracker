# Recurrence Tabs — Design Spec

**Date:** 2026-04-25
**Surface:** `/obligations`
**Goal:** Make the recurring vs non-recurring split a first-class affordance on the obligations page, and hide playbook sub-obligations from the main list (they belong to their parent's detail Sheet).

## Problem

The `/obligations` table is becoming noisy:
- Recurring items (Form 941 Q1-Q4, annual filings, monthly subscriptions) and non-recurring items (one-time tax assessments, event-triggered notices) live as siblings in one flat list, even though they have different operating cadences and review patterns.
- Phase 1 introduced playbook sub-obligations (parent_id set), which currently appear as separate rows next to their parents — a visual duplication of work that's already represented by the parent.

A user reviewing "what's coming up this quarter" benefits from seeing recurring obligations and one-time obligations as conceptually separate groups, without losing access to the unified view.

## Solution

A 3-tab strip above the existing filter bar on `/obligations`:

```
┌────────────────────────────────────────────────────────┐
│  All (47)   Recurring (33)   One-time (14)            │
├────────────────────────────────────────────────────────┤
│  [filters: Search | Category | Status | Risk | …]      │
├────────────────────────────────────────────────────────┤
│  [active filter chips, if any]                          │
├────────────────────────────────────────────────────────┤
│  [obligations table — same as today]                    │
└────────────────────────────────────────────────────────┘
```

- **All** — every top-level obligation (default, no behavior change for muscle memory).
- **Recurring** — obligations with `frequency` in `{annual, quarterly, monthly, weekly}`.
- **One-time** — obligations with `frequency` in `{one-time, event-triggered}`.

Each tab label includes a live count of obligations matching the current other filters.

**Sub-obligations are hidden from the main list everywhere.** Anywhere a `parentId` is set on an obligation, that row is excluded from `/obligations`. The parent represents the work; the children are reachable via the parent's detail Sheet (which already renders them as a sub-obligation tree from Phase 1). This applies to all three tabs.

### Default behavior

- First load defaults to **All** (preserves current muscle memory).
- Tab selection is reflected in the URL as `?tab=all|recurring|onetime`. Bookmarkable + back-button works.
- Switching tabs preserves all other filter state (search, category, status, risk, counterparty, sort).

### Counts

Counts update live with the other active filters:
- "All (N)" = top-level obligations matching active filters
- "Recurring (M)" = top-level recurring obligations matching active filters
- "One-time (P)" = top-level one-time/event-triggered obligations matching active filters
- M + P = N (always)

### Empty states

If a tab has zero items after filtering, show the existing "No obligations match these filters" empty state with the existing "Clear filters" action. Tab labels still show "(0)" so the user knows there's nothing in that bucket.

### Mobile

Tabs render as a horizontal strip; if labels with counts overflow, they horizontally scroll within the strip (keeps page-level overflow clean per the existing `overflow-x-clip` body rule). On 375px viewports, three tabs × ~110px = 330px, comfortably fits without scroll.

## Architecture

**Filtering happens client-side.** The `/api/obligations` route already returns flat arrays; filtering by `parentId == null` and by frequency-set is trivial in-page. No new endpoint, no schema change.

**One added URL param** (`tab`). Mirrors the pattern already in use for `category`, `status`, etc.

**One added data-derivation step.** The page computes:
1. `topLevelItems = items.filter(i => !i.parentId)`
2. `recurringItems = topLevelItems.filter(i => RECURRING_FREQUENCIES.has(i.frequency))`
3. `oneTimeItems = topLevelItems.filter(i => ONETIME_FREQUENCIES.has(i.frequency))`
4. The displayed list = (all/recurring/onetime) based on the active tab, intersected with the existing filter pipeline.

`RECURRING_FREQUENCIES` and `ONETIME_FREQUENCIES` are static `Set<Frequency>` constants.

## Components

### `<RecurrenceTabs>` (new, in `src/app/obligations/page.tsx`)

A tiny presentational component:

```tsx
<RecurrenceTabs
  active={activeTab}
  counts={{ all, recurring, onetime }}
  onChange={tab => setActiveTab(tab)}
/>
```

Renders three buttons styled like the existing tab patterns in `SettingsTabs` (border-bottom highlight on active). Lives in the obligations page file rather than as a shared component for now — promote to `src/components/ui/tab-strip.tsx` later if a third surface needs it.

### `ObligationsPageContent` (modified)

- New state: `activeTab: 'all' | 'recurring' | 'onetime'` (initialized from `searchParams.get('tab')`)
- Derived: `displayedItems` after tab + sub-obligation filter
- URL sync alongside existing filters

## Data flow

```
fetchItems()                       (no change)
  ↓
items: ObligationWithStatus[]      (no change — flat list including children)
  ↓
topLevelItems = items.filter(!parentId)   (NEW — sub-ob hidden everywhere)
  ↓
counts = { all, recurring, onetime }      (NEW)
  ↓
displayedItems = {
  all:       topLevelItems
  recurring: topLevelItems.filter(recurring frequency)
  onetime:   topLevelItems.filter(non-recurring frequency)
}[activeTab]
  ↓
[existing filter chips, sort, render pipeline unchanged]
```

## Error handling

Nothing new to handle. The fetch path, validation, and error toasts are unchanged. If `?tab=` has an invalid value, fall back to `'all'` silently.

## Testing

**Integration tests** (new in `src/test/integration/obligations-tabs.test.ts`):

1. Sub-obligations are excluded from `GET /api/obligations` results' default view in the page. *(Note: API still returns them; filtering is client-side. Test the data shape contracts the page relies on.)*
2. Filtering items by `parentId == null` correctly removes children.
3. `RECURRING_FREQUENCIES`/`ONETIME_FREQUENCIES` partition the 6 frequencies cleanly (no overlap, no gaps).

**Unit tests** (small, in `src/lib/recurrence.test.ts` if we extract the constants):

1. `isRecurringFrequency(freq)` returns correct boolean for each of the 6 values.

**No integration test for the actual UI component** — consistent with the project's existing posture (zero React component tests; manual verification is the convention per CLAUDE.md).

**Manual verification checklist:**
- [ ] All tab shows everything top-level (no sub-obligations as standalone rows)
- [ ] Recurring tab shows only annual/quarterly/monthly/weekly
- [ ] One-time tab shows only one-time/event-triggered
- [ ] Counts update when changing search/category/status/risk
- [ ] URL reflects `?tab=` and survives reload
- [ ] Bulk operations work within a single tab
- [ ] Mobile (375px) — tabs fit, no horizontal page scroll
- [ ] Sub-obligations from VP LP playbook still reachable via parent's detail Sheet

## Out of scope

- API changes (none needed)
- Sub-obligation rendering changes (already correct in Phase 1's parent detail Sheet)
- Bulk operations across tabs (within-tab only)
- Tab-specific column sets (every tab uses the same columns)
- Recurrence-tab-specific empty-state copy (using existing empty state)
- Persisting tab choice across sessions beyond the URL (the URL param is durable enough)

## Implementation notes

- Two new constants in `src/lib/recurrence.ts`:
  ```ts
  export const RECURRING_FREQUENCIES = new Set<Frequency>(['annual', 'quarterly', 'monthly', 'weekly'])
  export const ONETIME_FREQUENCIES = new Set<Frequency>(['one-time', 'event-triggered'])
  export function isRecurringFrequency(f: Frequency | string): boolean {
    return RECURRING_FREQUENCIES.has(f as Frequency)
  }
  ```
- The single `parentId == null` filter is applied at the top of the items pipeline so every downstream feature (counts, search, sort, chips, bulk) operates on the post-hide set.
- Tab counts are computed from the post-filter set (the user sees how many recurring items match their *current* category+search, not the full DB count) — that's the intended UX.

## Build order

1. Add `src/lib/recurrence.ts` with constants + helper + small unit test
2. Hide sub-obligations from the obligations list (single filter line in the page)
3. Add `<RecurrenceTabs>` component + state + URL sync
4. Wire counts
5. Build + test + commit + push + monitor deploy

Estimated effort: half a day. Single PR.
