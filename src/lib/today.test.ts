import { describe, it, expect } from 'vitest'
import {
  addDaysISO,
  bucketForObligation,
  compareForToday,
  isOwnedBy,
  groupForToday,
} from './today'
import type { RiskLevel, Status } from './types'

const TODAY = '2026-05-01'

function row(over: Partial<{
  id: string
  title: string
  nextDueDate: string
  status: Status
  riskLevel: RiskLevel
  owner: string
  ownerEmail: string | null
}>) {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    title: over.title ?? 'Test',
    nextDueDate: over.nextDueDate ?? TODAY,
    status: (over.status ?? 'current') as Status,
    riskLevel: (over.riskLevel ?? 'medium') as RiskLevel,
    owner: over.owner ?? 'Someone',
    ownerEmail: over.ownerEmail ?? null,
  }
}

describe('addDaysISO', () => {
  it('adds days', () => {
    expect(addDaysISO('2026-05-01', 7)).toBe('2026-05-08')
    expect(addDaysISO('2026-05-01', 0)).toBe('2026-05-01')
    expect(addDaysISO('2026-05-01', -1)).toBe('2026-04-30')
  })

  it('handles month + year boundaries', () => {
    expect(addDaysISO('2026-12-25', 7)).toBe('2027-01-01')
    expect(addDaysISO('2026-02-28', 1)).toBe('2026-03-01')
  })
})

describe('bucketForObligation', () => {
  const today = TODAY
  const tomorrow = '2026-05-02'
  const yesterday = '2026-04-30'
  const sevenDays = '2026-05-08'
  const eightDays = '2026-05-09'
  const thirtyDays = '2026-05-31'
  const thirtyOneDays = '2026-06-01'

  it('classifies overdue (past, not completed)', () => {
    expect(bucketForObligation({ nextDueDate: yesterday, status: 'overdue' }, today)).toBe('overdue')
  })

  it('classifies today (matches today)', () => {
    expect(bucketForObligation({ nextDueDate: today, status: 'upcoming' }, today)).toBe('today')
  })

  it('classifies thisWeek (today+1 through today+7)', () => {
    expect(bucketForObligation({ nextDueDate: tomorrow, status: 'current' }, today)).toBe('thisWeek')
    expect(bucketForObligation({ nextDueDate: sevenDays, status: 'current' }, today)).toBe('thisWeek')
  })

  it('classifies comingUp (today+8 through today+30)', () => {
    expect(bucketForObligation({ nextDueDate: eightDays, status: 'current' }, today)).toBe('comingUp')
    expect(bucketForObligation({ nextDueDate: thirtyDays, status: 'current' }, today)).toBe('comingUp')
  })

  it('returns null for items beyond 30 days', () => {
    expect(bucketForObligation({ nextDueDate: thirtyOneDays, status: 'current' }, today)).toBeNull()
  })

  it('always returns null for completed status, regardless of date', () => {
    expect(bucketForObligation({ nextDueDate: today, status: 'completed' }, today)).toBeNull()
    expect(bucketForObligation({ nextDueDate: yesterday, status: 'completed' }, today)).toBeNull()
  })

  it('includes blocked status in the appropriate bucket', () => {
    expect(bucketForObligation({ nextDueDate: yesterday, status: 'blocked' }, today)).toBe('overdue')
    expect(bucketForObligation({ nextDueDate: today, status: 'blocked' }, today)).toBe('today')
  })
})

describe('compareForToday', () => {
  it('puts critical before high before medium before low', () => {
    const items = [
      { riskLevel: 'low' as RiskLevel, nextDueDate: '2026-05-01' },
      { riskLevel: 'critical' as RiskLevel, nextDueDate: '2026-05-01' },
      { riskLevel: 'medium' as RiskLevel, nextDueDate: '2026-05-01' },
      { riskLevel: 'high' as RiskLevel, nextDueDate: '2026-05-01' },
    ]
    items.sort(compareForToday)
    expect(items.map(i => i.riskLevel)).toEqual(['critical', 'high', 'medium', 'low'])
  })

  it('breaks risk-level ties by ascending due date', () => {
    const items = [
      { riskLevel: 'high' as RiskLevel, nextDueDate: '2026-05-10' },
      { riskLevel: 'high' as RiskLevel, nextDueDate: '2026-05-02' },
      { riskLevel: 'high' as RiskLevel, nextDueDate: '2026-05-05' },
    ]
    items.sort(compareForToday)
    expect(items.map(i => i.nextDueDate)).toEqual(['2026-05-02', '2026-05-05', '2026-05-10'])
  })
})

describe('isOwnedBy', () => {
  it('matches by email (case-insensitive)', () => {
    expect(isOwnedBy({ owner: 'alice@pi2.network' }, 'ALICE@pi2.network', 'Alice')).toBe(true)
    expect(isOwnedBy({ owner: 'Alice@Pi2.NETWORK' }, 'alice@pi2.network', null)).toBe(true)
  })

  it('matches by display name', () => {
    expect(isOwnedBy({ owner: 'Musab Alturki' }, null, 'Musab Alturki')).toBe(true)
  })

  it('returns false when no session info', () => {
    expect(isOwnedBy({ owner: 'someone' }, null, null)).toBe(false)
  })

  it('returns false for role-name owners (CEO, CFO, etc.)', () => {
    expect(isOwnedBy({ owner: 'CFO' }, 'alice@pi2.network', 'Alice')).toBe(false)
  })

  it('returns false when owner is empty', () => {
    expect(isOwnedBy({ owner: '' }, 'alice@pi2.network', 'Alice')).toBe(false)
  })
})

describe('groupForToday', () => {
  it('partitions across the four buckets correctly', () => {
    const items = [
      row({ id: 'a', nextDueDate: '2026-04-25', status: 'overdue', riskLevel: 'high' }),
      row({ id: 'b', nextDueDate: '2026-05-01', status: 'upcoming', riskLevel: 'critical' }),
      row({ id: 'c', nextDueDate: '2026-05-04', status: 'current', riskLevel: 'medium' }),
      row({ id: 'd', nextDueDate: '2026-05-20', status: 'current', riskLevel: 'low' }),
      row({ id: 'e', nextDueDate: '2026-09-01', status: 'current' }),  // beyond 30d
      row({ id: 'f', nextDueDate: '2026-05-01', status: 'completed' }), // excluded
    ]
    const result = groupForToday(items, { todayIso: TODAY })
    expect(result.overdue.others.map(r => r.id)).toEqual(['a'])
    expect(result.today.others.map(r => r.id)).toEqual(['b'])
    expect(result.thisWeek.others.map(r => r.id)).toEqual(['c'])
    expect(result.comingUp.others.map(r => r.id)).toEqual(['d'])
    expect(result.summary).toEqual({ overdue: 1, today: 1, thisWeek: 1, comingUp: 1 })
  })

  it('partitions mine vs others by session email/name', () => {
    const items = [
      row({ id: 'mine', nextDueDate: TODAY, owner: 'alice@pi2.network' }),
      row({ id: 'theirs', nextDueDate: TODAY, owner: 'CFO' }),
    ]
    const result = groupForToday(items, {
      todayIso: TODAY,
      sessionEmail: 'alice@pi2.network',
      sessionName: 'Alice',
    })
    expect(result.today.mine.map(r => r.id)).toEqual(['mine'])
    expect(result.today.others.map(r => r.id)).toEqual(['theirs'])
  })

  it('flatten=true puts everything in others (viewer behavior)', () => {
    const items = [
      row({ id: '1', nextDueDate: TODAY, owner: 'alice@pi2.network' }),
      row({ id: '2', nextDueDate: TODAY, owner: 'bob@pi2.network' }),
    ]
    const result = groupForToday(items, {
      todayIso: TODAY,
      sessionEmail: 'alice@pi2.network',
      flatten: true,
    })
    expect(result.today.mine).toHaveLength(0)
    expect(result.today.others.map(r => r.id).sort()).toEqual(['1', '2'])
  })

  it('sorts by risk-then-date within each sub-list', () => {
    const items = [
      row({ id: 'late-low', nextDueDate: '2026-05-05', riskLevel: 'low' }),
      row({ id: 'early-low', nextDueDate: '2026-05-02', riskLevel: 'low' }),
      row({ id: 'early-crit', nextDueDate: '2026-05-02', riskLevel: 'critical' }),
    ]
    const result = groupForToday(items, { todayIso: TODAY })
    expect(result.thisWeek.others.map(r => r.id)).toEqual(['early-crit', 'early-low', 'late-low'])
  })

  it('summary equals mine.length + others.length per bucket', () => {
    const items = [
      row({ id: '1', nextDueDate: TODAY, owner: 'alice@pi2.network' }),
      row({ id: '2', nextDueDate: TODAY, owner: 'CFO' }),
      row({ id: '3', nextDueDate: '2026-05-03' }),
    ]
    const result = groupForToday(items, {
      todayIso: TODAY,
      sessionEmail: 'alice@pi2.network',
    })
    expect(result.summary.today).toBe(result.today.mine.length + result.today.others.length)
    expect(result.summary.thisWeek).toBe(result.thisWeek.mine.length + result.thisWeek.others.length)
  })
})
