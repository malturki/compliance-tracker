import { describe, it, expect } from 'vitest'
import {
  RECURRING_FREQUENCIES,
  ONETIME_FREQUENCIES,
  isRecurringFrequency,
  isOneTimeFrequency,
  parseRecurrenceTab,
} from './recurrence'

const ALL_FREQUENCIES = ['annual', 'quarterly', 'monthly', 'weekly', 'one-time', 'event-triggered'] as const

describe('recurrence partitioning', () => {
  it('every Frequency value belongs to exactly one set', () => {
    for (const f of ALL_FREQUENCIES) {
      const inRecurring = RECURRING_FREQUENCIES.has(f)
      const inOneTime = ONETIME_FREQUENCIES.has(f)
      expect(inRecurring !== inOneTime, `${f} must be in exactly one set`).toBe(true)
    }
  })

  it('the two sets together cover all 6 frequencies', () => {
    const union = new Set([...RECURRING_FREQUENCIES, ...ONETIME_FREQUENCIES])
    expect(union.size).toBe(6)
    for (const f of ALL_FREQUENCIES) {
      expect(union.has(f)).toBe(true)
    }
  })

  it('isRecurringFrequency classifies known values correctly', () => {
    expect(isRecurringFrequency('annual')).toBe(true)
    expect(isRecurringFrequency('quarterly')).toBe(true)
    expect(isRecurringFrequency('monthly')).toBe(true)
    expect(isRecurringFrequency('weekly')).toBe(true)
    expect(isRecurringFrequency('one-time')).toBe(false)
    expect(isRecurringFrequency('event-triggered')).toBe(false)
  })

  it('isOneTimeFrequency classifies known values correctly', () => {
    expect(isOneTimeFrequency('one-time')).toBe(true)
    expect(isOneTimeFrequency('event-triggered')).toBe(true)
    expect(isOneTimeFrequency('annual')).toBe(false)
  })

  it('isRecurringFrequency returns false for unknown strings', () => {
    expect(isRecurringFrequency('biennial' as any)).toBe(false)
    expect(isRecurringFrequency('' as any)).toBe(false)
  })
})

describe('parseRecurrenceTab', () => {
  it('passes through the two non-default values', () => {
    expect(parseRecurrenceTab('recurring')).toBe('recurring')
    expect(parseRecurrenceTab('onetime')).toBe('onetime')
  })

  it('returns "all" for the explicit "all" value', () => {
    expect(parseRecurrenceTab('all')).toBe('all')
  })

  it('falls back to "all" for any other value', () => {
    expect(parseRecurrenceTab('')).toBe('all')
    expect(parseRecurrenceTab(null)).toBe('all')
    expect(parseRecurrenceTab(undefined)).toBe('all')
    expect(parseRecurrenceTab('bogus')).toBe('all')
    expect(parseRecurrenceTab('Recurring')).toBe('all') // case-sensitive
  })
})
