import { describe, it, expect, beforeEach } from 'vitest'
import { dbReady } from '@/db'
import { resetDb, mockSession, mkReq, insertObligation } from '../integration-helpers'
import { GET as today } from '@/app/api/today/route'
import { addDaysISO, toIsoDay } from '@/lib/today'

const TODAY_ISO = toIsoDay(new Date())
const YESTERDAY = addDaysISO(TODAY_ISO, -1)
const TOMORROW = addDaysISO(TODAY_ISO, 1)
const SEVEN = addDaysISO(TODAY_ISO, 7)
const EIGHT = addDaysISO(TODAY_ISO, 8)
const THIRTY = addDaysISO(TODAY_ISO, 30)
const THIRTY_ONE = addDaysISO(TODAY_ISO, 31)

describe('GET /api/today', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
    mockSession({ email: 'editor@test.com', role: 'editor' })
  })

  it('buckets obligations across overdue / today / thisWeek / comingUp', async () => {
    await insertObligation({ title: 'overdue', nextDueDate: YESTERDAY, status: 'overdue' })
    await insertObligation({ title: 'due today', nextDueDate: TODAY_ISO })
    await insertObligation({ title: 'tomorrow', nextDueDate: TOMORROW })
    await insertObligation({ title: 'in 7d', nextDueDate: SEVEN })
    await insertObligation({ title: 'in 8d', nextDueDate: EIGHT })
    await insertObligation({ title: 'in 30d', nextDueDate: THIRTY })
    await insertObligation({ title: 'in 31d', nextDueDate: THIRTY_ONE })

    const res = await today(mkReq('http://localhost/api/today'))
    expect(res.status).toBe(200)
    const body = await res.json()

    const titles = (g: any) => [...g.mine, ...g.others].map((r: any) => r.title)
    expect(titles(body.overdue)).toEqual(['overdue'])
    expect(titles(body.today)).toEqual(['due today'])
    expect(titles(body.thisWeek).sort()).toEqual(['in 7d', 'tomorrow'])
    expect(titles(body.comingUp).sort()).toEqual(['in 30d', 'in 8d'])
    // 31-day-out item is excluded entirely.
    expect(body.summary.overdue).toBe(1)
    expect(body.summary.today).toBe(1)
    expect(body.summary.thisWeek).toBe(2)
    expect(body.summary.comingUp).toBe(2)
  })

  it('excludes status="completed" rows from every bucket', async () => {
    // The route filters at the DB layer (status != completed). Insert one
    // completed row dated today and confirm it doesn't show up.
    await insertObligation({ title: 'pending', nextDueDate: TODAY_ISO })
    await insertObligation({ title: 'done', nextDueDate: TODAY_ISO, status: 'completed' })

    const res = await today(mkReq('http://localhost/api/today'))
    const body = await res.json()
    const titles = (g: any) => [...g.mine, ...g.others].map((r: any) => r.title)
    expect(titles(body.today)).toEqual(['pending'])
  })

  it('includes status="blocked" rows in the appropriate bucket', async () => {
    await insertObligation({
      title: 'stuck',
      nextDueDate: YESTERDAY,
      status: 'blocked',
      blockerReason: 'Awaiting board signoff',
    })
    const res = await today(mkReq('http://localhost/api/today'))
    const body = await res.json()
    const titles = (g: any) => [...g.mine, ...g.others].map((r: any) => r.title)
    expect(titles(body.overdue)).toContain('stuck')
  })

  it('partitions mine vs others by session email match', async () => {
    await insertObligation({ title: 'mine-by-email', nextDueDate: TODAY_ISO, owner: 'editor@test.com' })
    await insertObligation({ title: 'theirs', nextDueDate: TODAY_ISO, owner: 'CFO' })
    const res = await today(mkReq('http://localhost/api/today'))
    const body = await res.json()
    expect(body.today.mine.map((r: any) => r.title)).toEqual(['mine-by-email'])
    expect(body.today.others.map((r: any) => r.title)).toEqual(['theirs'])
  })

  it('viewer sees flat list (mine always empty)', async () => {
    mockSession({ email: 'viewer@test.com', role: 'viewer' })
    await insertObligation({ title: 'a', nextDueDate: TODAY_ISO, owner: 'viewer@test.com' })
    await insertObligation({ title: 'b', nextDueDate: TODAY_ISO, owner: 'CFO' })
    const res = await today(mkReq('http://localhost/api/today'))
    const body = await res.json()
    expect(body.today.mine).toHaveLength(0)
    expect(body.today.others.map((r: any) => r.title).sort()).toEqual(['a', 'b'])
  })

  it('sub-obligations are included independently of their parent', async () => {
    const parentId = await insertObligation({ title: 'parent', nextDueDate: TOMORROW })
    await insertObligation({
      title: 'sub-step',
      nextDueDate: TODAY_ISO,
      parentId,
      sequence: 0,
    })
    const res = await today(mkReq('http://localhost/api/today'))
    const body = await res.json()
    const titles = (g: any) => [...g.mine, ...g.others].map((r: any) => r.title)
    expect(titles(body.today)).toContain('sub-step')
    expect(titles(body.thisWeek)).toContain('parent')
  })

  it('sorts within bucket: critical risk before lower risk', async () => {
    await insertObligation({ title: 'low', nextDueDate: TODAY_ISO, riskLevel: 'low' })
    await insertObligation({ title: 'crit', nextDueDate: TODAY_ISO, riskLevel: 'critical' })
    await insertObligation({ title: 'med', nextDueDate: TODAY_ISO, riskLevel: 'medium' })
    const res = await today(mkReq('http://localhost/api/today'))
    const body = await res.json()
    const titles = [...body.today.mine, ...body.today.others].map((r: any) => r.title)
    expect(titles).toEqual(['crit', 'med', 'low'])
  })

  it('summary equals mine + others count for each bucket', async () => {
    await insertObligation({ title: 'm', nextDueDate: TODAY_ISO, owner: 'editor@test.com' })
    await insertObligation({ title: 'o', nextDueDate: TODAY_ISO, owner: 'CFO' })
    await insertObligation({ title: 'w', nextDueDate: TOMORROW })
    const res = await today(mkReq('http://localhost/api/today'))
    const body = await res.json()
    expect(body.summary.today).toBe(body.today.mine.length + body.today.others.length)
    expect(body.summary.thisWeek).toBe(body.thisWeek.mine.length + body.thisWeek.others.length)
  })
})
