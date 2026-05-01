/**
 * Today-view grouping logic — pure, no I/O.
 *
 * Buckets a list of obligations into Overdue / Today / This week / Coming up,
 * and within each bucket partitions into "mine" (where the current session
 * user is the owner) vs "others." Used by GET /api/today and tested in
 * src/lib/today.test.ts.
 *
 * Spec: docs/superpowers/specs/2026-05-01-today-view-design.md
 */

import type { Obligation, RiskLevel, Status } from './types'

export type ObligationWithStatus = Obligation & { computedStatus: Status }

/**
 * `today` and `next_due_date` are compared as ISO YYYY-MM-DD strings, which
 * sorts correctly lexicographically. We intentionally avoid Date math at the
 * boundary so timezone weirdness can't sneak in: an obligation due "2026-05-01"
 * is "today" iff the server's local-day starts at "2026-05-01".
 */
export type TodayBucket = 'overdue' | 'today' | 'thisWeek' | 'comingUp' | null

const RISK_RANK: Record<RiskLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

/** Server's local-day as YYYY-MM-DD. Pure: no Date.now() — caller passes "now". */
export function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Add `days` to an ISO YYYY-MM-DD string and return the new ISO date. */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Classify a single obligation against a "today" anchor. Completed rows
 * always return null; everything else maps to one of the four buckets, or
 * null when the due date is more than 30 days out.
 */
export function bucketForObligation(
  o: { nextDueDate: string; status: Status },
  todayIso: string,
): TodayBucket {
  if (o.status === 'completed') return null
  const due = o.nextDueDate
  if (due < todayIso) return 'overdue'
  if (due === todayIso) return 'today'
  const weekEnd = addDaysISO(todayIso, 7)
  if (due <= weekEnd) return 'thisWeek'
  const monthEnd = addDaysISO(todayIso, 30)
  if (due <= monthEnd) return 'comingUp'
  return null
}

/** Comparator that sorts critical first, then by due date ascending. */
export function compareForToday(
  a: { riskLevel: RiskLevel; nextDueDate: string },
  b: { riskLevel: RiskLevel; nextDueDate: string },
): number {
  const r = (RISK_RANK[a.riskLevel] ?? 99) - (RISK_RANK[b.riskLevel] ?? 99)
  if (r !== 0) return r
  return a.nextDueDate.localeCompare(b.nextDueDate)
}

/** True when the obligation's owner field matches the session user. */
export function isOwnedBy(
  o: { owner: string; ownerEmail?: string | null },
  sessionEmail: string | null | undefined,
  sessionName: string | null | undefined,
): boolean {
  if (!sessionEmail && !sessionName) return false
  const owner = (o.owner ?? '').trim().toLowerCase()
  if (!owner) return false
  if (sessionEmail && owner === sessionEmail.trim().toLowerCase()) return true
  if (sessionName && owner === sessionName.trim().toLowerCase()) return true
  // Many seed rows store role names ("CEO", "CFO", "Finance"). Treat those as
  // unowned-by-anyone-specific for the partition; they fall into "others."
  return false
}

export interface TodayBucketGroup<T> {
  mine: T[]
  others: T[]
}

export interface TodayResult<T> {
  summary: {
    overdue: number
    today: number
    thisWeek: number
    comingUp: number
  }
  overdue: TodayBucketGroup<T>
  today: TodayBucketGroup<T>
  thisWeek: TodayBucketGroup<T>
  comingUp: TodayBucketGroup<T>
}

export interface GroupOptions {
  todayIso: string
  sessionEmail?: string | null
  sessionName?: string | null
  /**
   * When true, the result has every obligation in `others` and `mine` is empty.
   * Used for viewer sessions where the mine/others split has no meaning.
   */
  flatten?: boolean
}

/**
 * Group a flat list of obligations into the Today-view shape.
 * Pure function: same inputs → same outputs.
 */
export function groupForToday<
  T extends { nextDueDate: string; status: Status; owner: string; ownerEmail?: string | null; riskLevel: RiskLevel },
>(items: readonly T[], opts: GroupOptions): TodayResult<T> {
  const overdue: TodayBucketGroup<T> = { mine: [], others: [] }
  const today: TodayBucketGroup<T> = { mine: [], others: [] }
  const thisWeek: TodayBucketGroup<T> = { mine: [], others: [] }
  const comingUp: TodayBucketGroup<T> = { mine: [], others: [] }
  const buckets: Record<Exclude<TodayBucket, null>, TodayBucketGroup<T>> = {
    overdue,
    today,
    thisWeek,
    comingUp,
  }

  for (const item of items) {
    const bucket = bucketForObligation(item, opts.todayIso)
    if (!bucket) continue
    if (!opts.flatten && isOwnedBy(item, opts.sessionEmail, opts.sessionName)) {
      buckets[bucket].mine.push(item)
    } else {
      buckets[bucket].others.push(item)
    }
  }

  // Sort each sub-array
  for (const b of [overdue, today, thisWeek, comingUp]) {
    b.mine.sort(compareForToday)
    b.others.sort(compareForToday)
  }

  return {
    summary: {
      overdue: overdue.mine.length + overdue.others.length,
      today: today.mine.length + today.others.length,
      thisWeek: thisWeek.mine.length + thisWeek.others.length,
      comingUp: comingUp.mine.length + comingUp.others.length,
    },
    overdue,
    today,
    thisWeek,
    comingUp,
  }
}
