import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { calculateDueDate, formatDueDateForDb } from './templates'

describe('calculateDueDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Anchor "today" to mid-year so both past and future anchors in the
    // current year are easy to construct.
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('fixed-date', () => {
    it('picks the current-year date if it\'s still in the future', () => {
      const d = calculateDueDate({ type: 'fixed-date', month: 12, day: 15 })
      expect(d.getFullYear()).toBe(2026)
      expect(d.getMonth()).toBe(11) // December
      expect(d.getDate()).toBe(15)
    })

    it('rolls forward to next year if the current-year date has passed', () => {
      const d = calculateDueDate({ type: 'fixed-date', month: 3, day: 1 })
      expect(d.getFullYear()).toBe(2027)
      expect(d.getMonth()).toBe(2) // March
      expect(d.getDate()).toBe(1)
    })
  })

  describe('days-from-now', () => {
    it('adds the given number of days to today', () => {
      const d = calculateDueDate({ type: 'days-from-now', days: 30 })
      const today = new Date('2026-06-15T12:00:00Z')
      const delta = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      expect(delta).toBe(30)
    })

    it('handles zero-day offsets', () => {
      const d = calculateDueDate({ type: 'days-from-now', days: 0 })
      expect(d.toDateString()).toBe(new Date().toDateString())
    })
  })

  describe('quarterly', () => {
    it('targets end of Q3 when today is mid-June (Q3 ends Sep 30)', () => {
      const d = calculateDueDate({ type: 'quarterly', quarter: 3, daysAfterQuarterEnd: 0 })
      expect(d.getFullYear()).toBe(2026)
      expect(d.getMonth()).toBe(8) // September (0-indexed)
      expect(d.getDate()).toBe(30)
    })

    it('rolls to next year when the target quarter has passed', () => {
      // Q1 2026 ends Mar 31 — today is June, so roll to Q1 2027.
      const d = calculateDueDate({ type: 'quarterly', quarter: 1, daysAfterQuarterEnd: 0 })
      expect(d.getFullYear()).toBe(2027)
      expect(d.getMonth()).toBe(2) // March
      expect(d.getDate()).toBe(31)
    })

    it('applies daysAfterQuarterEnd offset', () => {
      // Q3 2026 ends Sep 30; +30 days = Oct 30.
      const d = calculateDueDate({ type: 'quarterly', quarter: 3, daysAfterQuarterEnd: 30 })
      expect(d.getMonth()).toBe(9) // October
      expect(d.getDate()).toBe(30)
    })
  })

  describe('monthly', () => {
    it('picks the target day in the current month if it\'s still in the future', () => {
      const d = calculateDueDate({ type: 'monthly', dayOfMonth: 20 })
      expect(d.getMonth()).toBe(5) // June
      expect(d.getDate()).toBe(20)
    })

    it('rolls forward to next month if the target day has passed', () => {
      const d = calculateDueDate({ type: 'monthly', dayOfMonth: 5 })
      expect(d.getMonth()).toBe(6) // July
      expect(d.getDate()).toBe(5)
    })
  })

  describe('default / unknown type', () => {
    it('falls back to today for unknown types', () => {
      const d = calculateDueDate({ type: 'something-else' as any })
      expect(d.toDateString()).toBe(new Date().toDateString())
    })
  })
})

describe('formatDueDateForDb', () => {
  it('formats Date as ISO YYYY-MM-DD', () => {
    expect(formatDueDateForDb(new Date('2026-04-23T00:00:00Z'))).toBe('2026-04-23')
  })

  it('truncates time component', () => {
    expect(formatDueDateForDb(new Date('2026-12-31T23:45:12Z'))).toBe('2026-12-31')
  })
})
