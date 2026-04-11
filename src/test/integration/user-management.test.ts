import { describe, it, expect, beforeEach } from 'vitest'
import { db, dbReady } from '@/db'
import { users, auditLog } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { resetDb, mockSession, mkReq, insertUser } from '../integration-helpers'
import { GET as listUsers } from '@/app/api/users/route'
import { PUT as updateUserRole } from '@/app/api/users/[id]/route'

describe('User management', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
  })

  it('admin GET /api/users returns seeded users', async () => {
    mockSession({ email: 'admin@test.com', role: 'admin' })
    await insertUser('u1@test.com', 'admin')
    await insertUser('u2@test.com', 'editor')
    await insertUser('u3@test.com', 'viewer')

    const res = await listUsers()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.users).toHaveLength(3)
    const emails = body.users.map((u: any) => u.email).sort()
    expect(emails).toEqual(['u1@test.com', 'u2@test.com', 'u3@test.com'])
  })

  it('editor GET /api/users → 200', async () => {
    mockSession({ email: 'editor@test.com', role: 'editor' })
    await insertUser('u1@test.com', 'admin')
    const res = await listUsers()
    expect(res.status).toBe(200)
  })

  it('viewer GET /api/users → 200', async () => {
    mockSession({ email: 'viewer@test.com', role: 'viewer' })
    await insertUser('u1@test.com', 'admin')
    const res = await listUsers()
    expect(res.status).toBe(200)
  })

  it('admin PUT /api/users/[id] updates role and writes audit event', async () => {
    mockSession({ email: 'admin@test.com', role: 'admin' })
    // Need at least two admins so the target can be safely demoted
    await insertUser('keep-admin@test.com', 'admin')
    const target = await insertUser('target@test.com', 'admin')

    const req = mkReq(`http://localhost/api/users/${target.id}`, {
      method: 'PUT',
      body: { role: 'editor' },
    })
    const res = await updateUserRole(req, { params: { id: target.id } })
    expect(res.status).toBe(200)

    const rows = await db.select().from(users).where(eq(users.id, target.id))
    expect(rows[0].role).toBe('editor')

    const events = await db.select().from(auditLog).where(eq(auditLog.eventType, 'user.role_changed'))
    const forThis = events.filter(e => e.entityId === target.id)
    expect(forThis).toHaveLength(1)
    const diff = JSON.parse(forThis[0].diff || '{}')
    expect(diff.role).toEqual(['admin', 'editor'])
    expect(forThis[0].actorSource).toBe('sso')
  })

  it('last-admin protection: demoting the only admin → 400', async () => {
    mockSession({ email: 'admin@test.com', role: 'admin' })
    const solo = await insertUser('solo-admin@test.com', 'admin')

    const req = mkReq(`http://localhost/api/users/${solo.id}`, {
      method: 'PUT',
      body: { role: 'editor' },
    })
    const res = await updateUserRole(req, { params: { id: solo.id } })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/last admin/i)

    // Role unchanged
    const rows = await db.select().from(users).where(eq(users.id, solo.id))
    expect(rows[0].role).toBe('admin')
  })

  it('with 2 admins, demoting one succeeds', async () => {
    mockSession({ email: 'admin@test.com', role: 'admin' })
    const a1 = await insertUser('a1@test.com', 'admin')
    const a2 = await insertUser('a2@test.com', 'admin')

    const req = mkReq(`http://localhost/api/users/${a2.id}`, {
      method: 'PUT',
      body: { role: 'viewer' },
    })
    const res = await updateUserRole(req, { params: { id: a2.id } })
    expect(res.status).toBe(200)

    const rows = await db.select().from(users).where(eq(users.id, a2.id))
    expect(rows[0].role).toBe('viewer')
    // a1 still admin
    const a1Rows = await db.select().from(users).where(eq(users.id, a1.id))
    expect(a1Rows[0].role).toBe('admin')
  })

  it('non-admin PUT /api/users/[id] → 403', async () => {
    // Create the target while still admin so it exists
    mockSession({ email: 'admin@test.com', role: 'admin' })
    const target = await insertUser('target@test.com', 'viewer')

    mockSession({ email: 'editor@test.com', role: 'editor' })
    const req = mkReq(`http://localhost/api/users/${target.id}`, {
      method: 'PUT',
      body: { role: 'editor' },
    })
    const res = await updateUserRole(req, { params: { id: target.id } })
    expect(res.status).toBe(403)

    // Role unchanged
    const rows = await db.select().from(users).where(eq(users.id, target.id))
    expect(rows[0].role).toBe('viewer')
  })

  it('viewer PUT /api/users/[id] → 403', async () => {
    mockSession({ email: 'admin@test.com', role: 'admin' })
    const target = await insertUser('target@test.com', 'viewer')

    mockSession({ email: 'viewer@test.com', role: 'viewer' })
    const req = mkReq(`http://localhost/api/users/${target.id}`, {
      method: 'PUT',
      body: { role: 'editor' },
    })
    const res = await updateUserRole(req, { params: { id: target.id } })
    expect(res.status).toBe(403)

    const rows = await db.select().from(users).where(eq(users.id, target.id))
    expect(rows[0].role).toBe('viewer')
  })

  it('unauthenticated PUT /api/users/[id] → 401', async () => {
    mockSession({ email: 'admin@test.com', role: 'admin' })
    const target = await insertUser('target@test.com', 'viewer')

    mockSession(null)
    const req = mkReq(`http://localhost/api/users/${target.id}`, {
      method: 'PUT',
      body: { role: 'editor' },
    })
    const res = await updateUserRole(req, { params: { id: target.id } })
    expect(res.status).toBe(401)
  })

  it('admin PUT with invalid role → 400, role unchanged', async () => {
    mockSession({ email: 'admin@test.com', role: 'admin' })
    const target = await insertUser('target@test.com', 'viewer')

    const req = mkReq(`http://localhost/api/users/${target.id}`, {
      method: 'PUT',
      body: { role: 'superadmin' },
    })
    const res = await updateUserRole(req, { params: { id: target.id } })
    expect(res.status).toBe(400)

    const rows = await db.select().from(users).where(eq(users.id, target.id))
    expect(rows[0].role).toBe('viewer')
  })

  it('admin PUT with missing role → 400', async () => {
    mockSession({ email: 'admin@test.com', role: 'admin' })
    const target = await insertUser('target@test.com', 'viewer')

    const req = mkReq(`http://localhost/api/users/${target.id}`, {
      method: 'PUT',
      body: {},
    })
    const res = await updateUserRole(req, { params: { id: target.id } })
    expect(res.status).toBe(400)
  })

  it('admin PUT non-existent user → 404', async () => {
    mockSession({ email: 'admin@test.com', role: 'admin' })
    const req = mkReq('http://localhost/api/users/nonexistent', {
      method: 'PUT',
      body: { role: 'editor' },
    })
    const res = await updateUserRole(req, { params: { id: 'nonexistent' } })
    expect(res.status).toBe(404)
  })

  it('admin PUT with same role is a no-op (200) and writes no audit event', async () => {
    mockSession({ email: 'admin@test.com', role: 'admin' })
    const target = await insertUser('target@test.com', 'editor')

    const req = mkReq(`http://localhost/api/users/${target.id}`, {
      method: 'PUT',
      body: { role: 'editor' },
    })
    const res = await updateUserRole(req, { params: { id: target.id } })
    expect(res.status).toBe(200)

    const events = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.eventType, 'user.role_changed'))
    expect(events.filter(e => e.entityId === target.id)).toHaveLength(0)
  })
})
