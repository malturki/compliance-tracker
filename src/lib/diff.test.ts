import { describe, it, expect } from 'vitest'
import { diffFields } from './diff'

describe('diffFields', () => {
  const tracked = ['title', 'owner', 'riskLevel'] as const

  it('returns empty object when nothing changed', () => {
    const row = { title: 'A', owner: 'X', riskLevel: 'low', notes: 'hi' }
    expect(diffFields(row, row, tracked)).toEqual({})
  })

  it('returns only fields that actually changed', () => {
    const before = { title: 'A', owner: 'X', riskLevel: 'low', notes: 'hi' }
    const after = { title: 'A', owner: 'Y', riskLevel: 'high', notes: 'hi' }
    expect(diffFields(before, after, tracked)).toEqual({
      owner: ['X', 'Y'],
      riskLevel: ['low', 'high'],
    })
  })

  it('ignores fields not in the tracked list', () => {
    const before = { title: 'A', owner: 'X', riskLevel: 'low', notes: 'hi' }
    const after = { title: 'A', owner: 'X', riskLevel: 'low', notes: 'bye' }
    expect(diffFields(before, after, tracked)).toEqual({})
  })

  it('handles null/undefined transitions', () => {
    const before = { title: 'A', owner: null as any, riskLevel: 'low' }
    const after = { title: 'A', owner: 'Y', riskLevel: 'low' }
    expect(diffFields(before, after, tracked)).toEqual({ owner: [null, 'Y'] })
  })
})
