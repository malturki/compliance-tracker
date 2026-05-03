import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db, dbReady } from '@/db'
import { obligations, auditLog } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { resetDb, mockSession, mkReq, insertObligation } from '../integration-helpers'
import { POST as processAlertsRoute } from '@/app/api/alerts/route'
import { POST as sendDigestRoute } from '@/app/api/alerts/digest/route'

const { sendMailMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: sendMailMock,
    })),
  },
}))

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

describe('Alert and digest routes', () => {
  let originalAlertTo: string | undefined
  let originalSmtpUser: string | undefined

  beforeEach(async () => {
    await dbReady
    await resetDb()
    mockSession({ email: 'admin@test.com', role: 'admin' })
    sendMailMock.mockReset()
    sendMailMock.mockResolvedValue({ messageId: 'test-message' })
    originalAlertTo = process.env.ALERT_EMAIL_TO
    originalSmtpUser = process.env.SMTP_USER
    process.env.ALERT_EMAIL_TO = 'ops@example.com'
    delete process.env.SMTP_USER
  })

  afterEach(() => {
    if (originalAlertTo === undefined) delete process.env.ALERT_EMAIL_TO
    else process.env.ALERT_EMAIL_TO = originalAlertTo
    if (originalSmtpUser === undefined) delete process.env.SMTP_USER
    else process.env.SMTP_USER = originalSmtpUser
  })

  it('sends due alerts, updates lastAlertSent, and logs an audit event', async () => {
    const id = await insertObligation({
      title: 'Seven day alert',
      nextDueDate: daysFromNow(7),
      alertDays: '[7]',
    })

    const res = await processAlertsRoute(mkReq('http://localhost/api/alerts', { method: 'POST' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alertsSent).toBe(1)
    expect(body.details[0].id).toBe(id)
    expect(sendMailMock).toHaveBeenCalledTimes(1)

    const rows = await db.select().from(obligations).where(eq(obligations.id, id))
    expect(rows[0].lastAlertSent).toBeTruthy()

    const events = await db.select().from(auditLog).where(eq(auditLog.eventType, 'alert.sent'))
    expect(events.filter(e => e.entityId === id)).toHaveLength(1)
  })

  it('reports due alert errors when no recipient is configured', async () => {
    delete process.env.ALERT_EMAIL_TO
    delete process.env.SMTP_USER
    const id = await insertObligation({
      title: 'No recipient alert',
      nextDueDate: daysFromNow(7),
      alertDays: '[7]',
    })

    const res = await processAlertsRoute(mkReq('http://localhost/api/alerts', { method: 'POST' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alertsSent).toBe(0)
    expect(body.errors).toEqual([{ id, error: 'No recipient email configured' }])
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('unauthenticated callers cannot process alerts', async () => {
    mockSession(null)
    const res = await processAlertsRoute(mkReq('http://localhost/api/alerts', { method: 'POST' }))
    expect(res.status).toBe(401)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('weekly digest sends one email with categorized obligations', async () => {
    await insertObligation({ title: 'Overdue', nextDueDate: daysFromNow(-1) })
    await insertObligation({ title: 'This week', nextDueDate: daysFromNow(2) })
    await insertObligation({ title: 'Next week', nextDueDate: daysFromNow(10) })

    const res = await sendDigestRoute(mkReq('http://localhost/api/alerts/digest', { method: 'POST' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.digest.overdue).toBe(1)
    expect(body.digest.dueThisWeek).toBe(1)
    expect(body.digest.dueNextWeek).toBe(1)
    expect(body.digest.recipient).toBe('ops@example.com')
    expect(sendMailMock).toHaveBeenCalledTimes(1)
  })

  it('weekly digest returns 500 when no recipient is configured', async () => {
    delete process.env.ALERT_EMAIL_TO
    delete process.env.SMTP_USER

    const res = await sendDigestRoute(mkReq('http://localhost/api/alerts/digest', { method: 'POST' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.details).toMatch(/no recipient email configured/i)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('unauthenticated callers cannot send the weekly digest', async () => {
    mockSession(null)
    const res = await sendDigestRoute(mkReq('http://localhost/api/alerts/digest', { method: 'POST' }))
    expect(res.status).toBe(401)
    expect(sendMailMock).not.toHaveBeenCalled()
  })
})
