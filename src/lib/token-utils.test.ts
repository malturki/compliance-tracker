import { describe, it, expect } from 'vitest'
import { generateToken, hashToken, TOKEN_PREFIX } from './token-utils'

describe('generateToken', () => {
  it('starts with the ct_live_ prefix', () => {
    const token = generateToken()
    expect(token.startsWith(TOKEN_PREFIX)).toBe(true)
  })

  it('produces tokens of consistent length', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a.length).toBe(b.length)
  })

  it('is 52 characters long total', () => {
    const token = generateToken()
    expect(token.length).toBe(52)
  })

  it('produces different values on each call', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()))
    expect(tokens.size).toBe(100)
  })

  it('uses only base62 characters after the prefix', () => {
    const token = generateToken()
    const body = token.slice(TOKEN_PREFIX.length)
    expect(body).toMatch(/^[0-9A-Za-z]+$/)
  })
})

describe('hashToken', () => {
  it('is deterministic', () => {
    const h1 = hashToken('ct_live_abcdef')
    const h2 = hashToken('ct_live_abcdef')
    expect(h1).toBe(h2)
  })

  it('produces different hashes for different inputs', () => {
    expect(hashToken('ct_live_a')).not.toBe(hashToken('ct_live_b'))
  })

  it('returns a hex string of 64 chars (sha256)', () => {
    const h = hashToken('ct_live_test')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })
})
