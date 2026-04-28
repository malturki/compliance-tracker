/**
 * Pure-function tests for src/lib/utils.ts. These helpers power status
 * chips, date rendering, risk tints, and recurrence math across every
 * page — regressions here ripple widely. No DB, no mocks.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  computeStatus,
  getRiskColor,
  getStatusColor,
  formatDate,
  getDaysUntil,
  getCategoryLabel,
  computeNextDueDate,
  cn,
} from './utils'

describe('cn', () => {
  it('merges class names and dedupes conflicting Tailwind utilities', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
    expect(cn('p-2', { 'font-bold': true, 'italic': false })).toBe('p-2 font-bold')
  })
})

describe('computeStatus', () => {
  // Freeze "today" so status math is deterministic regardless of wall clock.
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "overdue" when due date is in the past and not completed', () => {
    expect(computeStatus('2026-06-01')).toBe('overdue')
  })

  it('returns "upcoming" when due date is today', () => {
    expect(computeStatus('2026-06-15')).toBe('upcoming')
  })

  it('returns "upcoming" when due date is within 7 days', () => {
    expect(computeStatus('2026-06-20')).toBe('upcoming')
    expect(computeStatus('2026-06-22')).toBe('upcoming') // 7 days out
  })

  it('returns "current" when due date is more than 7 days out', () => {
    expect(computeStatus('2026-06-25')).toBe('current') // 10 days out
    expect(computeStatus('2027-01-01')).toBe('current')
  })

  it('returns "completed" for one-time obligations once lastCompletedDate is set', () => {
    expect(computeStatus('2026-06-01', '2026-06-01', 'one-time')).toBe('completed')
    // Even if the due date has passed — terminal completion is sticky.
    expect(computeStatus('2024-01-01', '2024-01-01', 'one-time')).toBe('completed')
  })

  it('returns "completed" for event-triggered obligations once lastCompletedDate is set', () => {
    expect(computeStatus('2026-06-01', '2026-06-01', 'event-triggered')).toBe('completed')
  })

  it('returns "current" for recurring obligations completed for the current period', () => {
    // Annual filed on its due date; new period not yet due.
    expect(computeStatus('2026-06-20', '2026-06-20', 'annual')).toBe('current')
  })

  it('flips recurring obligations back to overdue after the due date passes even if recently completed', () => {
    // Completed in May, due was June 1, and today is June 15.
    expect(computeStatus('2026-06-01', '2026-05-01', 'annual')).toBe('overdue')
  })
})

describe('getRiskColor', () => {
  it('returns distinct classes per level', () => {
    const classes = [
      getRiskColor('critical'),
      getRiskColor('high'),
      getRiskColor('medium'),
      getRiskColor('low'),
    ]
    expect(new Set(classes).size).toBe(4)
  })

  it('uses danger/warning/steel/success tokens', () => {
    expect(getRiskColor('critical')).toContain('text-danger')
    expect(getRiskColor('high')).toContain('text-warning')
    expect(getRiskColor('medium')).toContain('text-steel')
    expect(getRiskColor('low')).toContain('text-success')
  })
})

describe('getStatusColor', () => {
  it('covers all Status values including blocked', () => {
    expect(getStatusColor('overdue')).toContain('text-danger')
    expect(getStatusColor('upcoming')).toContain('text-warning')
    expect(getStatusColor('current')).toContain('text-graphite')
    expect(getStatusColor('completed')).toContain('text-success')
    expect(getStatusColor('blocked')).toContain('text-steel')
  })

  it('falls back for unknown/not-applicable values', () => {
    expect(getStatusColor('unknown')).toContain('text-steel')
    expect(getStatusColor('not-applicable')).toContain('text-steel')
  })
})

describe('formatDate', () => {
  it('formats ISO dates as "MMM d, yyyy"', () => {
    expect(formatDate('2026-04-23')).toMatch(/Apr 23, 2026/)
    expect(formatDate('2026-12-01')).toMatch(/Dec 1, 2026/)
  })
})

describe('getDaysUntil', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0 for today', () => {
    expect(getDaysUntil('2026-06-15')).toBe(0)
  })

  it('returns a positive count for future dates', () => {
    expect(getDaysUntil('2026-06-20')).toBe(5)
    expect(getDaysUntil('2026-07-15')).toBe(30)
  })

  it('returns a negative count for past dates', () => {
    expect(getDaysUntil('2026-06-10')).toBe(-5)
  })
})

describe('getCategoryLabel', () => {
  it('returns the human label for every known category', () => {
    expect(getCategoryLabel('tax')).toBe('Tax')
    expect(getCategoryLabel('investor')).toBe('Investor')
    expect(getCategoryLabel('equity')).toBe('Equity')
    expect(getCategoryLabel('state')).toBe('State')
    expect(getCategoryLabel('federal')).toBe('Federal')
    expect(getCategoryLabel('contract')).toBe('Contract')
    expect(getCategoryLabel('insurance')).toBe('Insurance')
    expect(getCategoryLabel('benefits')).toBe('Benefits')
    expect(getCategoryLabel('governance')).toBe('Governance')
    expect(getCategoryLabel('vendor')).toBe('Vendor')
  })

  it('falls back to the raw value for unknown categories', () => {
    expect(getCategoryLabel('something-new')).toBe('something-new')
  })
})

describe('computeNextDueDate', () => {
  it('advances annual obligations by one year', () => {
    expect(computeNextDueDate('2026-03-15', 'annual')).toBe('2027-03-15')
  })

  it('advances semi-annual obligations by six months', () => {
    expect(computeNextDueDate('2026-03-15', 'semi-annual')).toBe('2026-09-15')
  })

  it('advances quarterly obligations by three months', () => {
    expect(computeNextDueDate('2026-03-15', 'quarterly')).toBe('2026-06-15')
  })

  it('advances bi-monthly obligations by two months', () => {
    expect(computeNextDueDate('2026-03-15', 'bi-monthly')).toBe('2026-05-15')
  })

  it('advances monthly obligations by one month', () => {
    expect(computeNextDueDate('2026-03-15', 'monthly')).toBe('2026-04-15')
  })

  it('advances weekly obligations by seven days', () => {
    expect(computeNextDueDate('2026-03-15', 'weekly')).toBe('2026-03-22')
  })

  it('falls back to yearly advance for unknown frequencies (defensive default)', () => {
    expect(computeNextDueDate('2026-03-15', 'unknown-cadence' as any)).toBe('2027-03-15')
  })

  it('handles month rollover correctly', () => {
    // Feb 29 on a leap year → advancing a year lands on Feb 28 (non-leap 2027).
    expect(computeNextDueDate('2028-02-29', 'annual')).toBe('2029-03-01')
  })
})
