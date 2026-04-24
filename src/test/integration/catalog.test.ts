import { describe, it, expect, beforeEach } from 'vitest'
import { db, dbReady } from '@/db'
import { obligations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { resetDb, mockSession, mkReq } from '../integration-helpers'
import { GET as listCatalog } from '@/app/api/catalog/route'
import { POST as createObligation } from '@/app/api/obligations/route'
import { listCatalogItems } from '@/data/recommended-additions'

describe('Catalog — recommended additions', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
    mockSession({ email: 'editor@test.com', role: 'editor' })
  })

  it('GET /api/catalog returns items + tagLabels', async () => {
    const res = await listCatalog(mkReq('http://localhost/api/catalog'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items.length).toBeGreaterThan(20)
    expect(typeof body.tagLabels).toBe('object')
    expect(body.tagLabels['crypto']).toBeDefined()
  })

  it('every catalog item has a valid category, frequency, risk level', () => {
    const validCategories = new Set([
      'tax', 'investor', 'equity', 'state', 'federal',
      'contract', 'insurance', 'benefits', 'governance', 'vendor',
    ])
    const validFrequencies = new Set(['annual', 'quarterly', 'monthly', 'weekly', 'one-time', 'event-triggered'])
    const validRisks = new Set(['critical', 'high', 'medium', 'low'])
    const items = listCatalogItems()
    for (const item of items) {
      expect(validCategories.has(item.category), `${item.id}: category ${item.category}`).toBe(true)
      expect(validFrequencies.has(item.frequency), `${item.id}: frequency ${item.frequency}`).toBe(true)
      expect(validRisks.has(item.defaultRiskLevel), `${item.id}: risk ${item.defaultRiskLevel}`).toBe(true)
      expect(item.title.length).toBeGreaterThan(0)
      expect(item.whyItMatters.length).toBeGreaterThan(10)
      expect(item.consequenceOfMissing.length).toBeGreaterThan(5)
      expect(item.tags.length).toBeGreaterThan(0)
    }
  })

  it('catalog item ids are unique', () => {
    const items = listCatalogItems()
    const ids = items.map(i => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('catalog covers all major tags (state-securities, tax, privacy, ip, crypto)', () => {
    const items = listCatalogItems()
    const tags = new Set(items.flatMap(i => i.tags))
    for (const required of ['state-securities', 'tax', 'privacy', 'ip', 'crypto', 'governance', 'employment']) {
      expect(tags.has(required as any), `missing tag: ${required}`).toBe(true)
    }
  })

  it('trademark maintenance items are marked maturity="future"', () => {
    const items = listCatalogItems()
    const tmItems = items.filter(i => i.id.startsWith('trademark-'))
    expect(tmItems.length).toBeGreaterThan(0)
    // Section 8/15 + renewal must be future-only; application itself is also future (per plan).
    for (const tm of tmItems) {
      expect(tm.maturity).toBe('future')
    }
  })

  it('adding a catalog item via POST /api/obligations creates a valid obligation', async () => {
    // Pick a known-now item with a clear shape.
    const items = listCatalogItems()
    const src = items.find(i => i.id === 'ca-soi-biennial')!
    expect(src).toBeTruthy()

    const req = mkReq('http://localhost/api/obligations', {
      method: 'POST',
      body: {
        title: src.title,
        description: src.whyItMatters,
        category: src.category,
        frequency: src.frequency,
        nextDueDate: '2027-04-01',
        owner: src.suggestedOwner,
        riskLevel: src.defaultRiskLevel,
        alertDays: [7, 1],
        entity: 'Pi Squared Inc.',
        counterparty: src.defaultCounterparty,
        jurisdiction: src.defaultJurisdiction,
        amount: src.defaultAmount,
        autoRecur: true,
      },
    })
    const res = await createObligation(req)
    expect(res.status).toBe(201)
    const created = await res.json()
    expect(typeof created.id).toBe('string')

    const [row] = await db.select().from(obligations).where(eq(obligations.id, created.id))
    expect(row.title).toBe(src.title)
    expect(row.category).toBe(src.category)
    expect(row.counterparty).toBe(src.defaultCounterparty)
    expect(row.owner).toBe(src.suggestedOwner)
    expect(row.jurisdiction).toBe('California')
  })
})
