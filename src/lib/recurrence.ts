/**
 * Frequency partitioning helpers for the recurrence-tabs feature
 * (docs/superpowers/specs/2026-04-25-recurrence-tabs-design.md).
 *
 * The two sets are exhaustive over `Frequency` and disjoint:
 *   recurring  = annual | quarterly | monthly | weekly
 *   one-time   = one-time | event-triggered
 */

import type { Frequency } from './types'

export const RECURRING_FREQUENCIES = new Set<Frequency>([
  'annual',
  'quarterly',
  'monthly',
  'weekly',
])

export const ONETIME_FREQUENCIES = new Set<Frequency>([
  'one-time',
  'event-triggered',
])

export function isRecurringFrequency(f: Frequency | string): boolean {
  return RECURRING_FREQUENCIES.has(f as Frequency)
}

export function isOneTimeFrequency(f: Frequency | string): boolean {
  return ONETIME_FREQUENCIES.has(f as Frequency)
}

export type RecurrenceTab = 'all' | 'recurring' | 'onetime'

/** Parse a possibly-invalid `?tab=` value, falling back to `'all'`. */
export function parseRecurrenceTab(raw: string | null | undefined): RecurrenceTab {
  if (raw === 'recurring' || raw === 'onetime') return raw
  return 'all'
}

/**
 * Cadence sub-filter inside the Recurring tab. `'all'` means "no sub-filter
 * applied — show every recurring obligation regardless of cadence."
 */
export type RecurrenceCadence = 'all' | 'annual' | 'quarterly' | 'monthly' | 'weekly'

const VALID_CADENCES: ReadonlyArray<RecurrenceCadence> = [
  'all',
  'annual',
  'quarterly',
  'monthly',
  'weekly',
]

/** Parse a possibly-invalid `?cadence=` value, falling back to `'all'`. */
export function parseRecurrenceCadence(raw: string | null | undefined): RecurrenceCadence {
  if (raw && (VALID_CADENCES as readonly string[]).includes(raw)) {
    return raw as RecurrenceCadence
  }
  return 'all'
}
