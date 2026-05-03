import { db, dbReady } from '@/db'
import { obligations } from '@/db/schema'
import { sql } from 'drizzle-orm'
import nodemailer from 'nodemailer'
import { generateAlertEmail, generateDigestEmail } from '@/lib/email-templates'
import { logEvent } from '@/lib/audit'
import type { Actor } from '@/lib/actor'

type AlertResult = {
  success: true
  alertsSent: number
  details: Array<{ id: string; title: string; daysUntilDue: number }>
  errors?: Array<{ id: string; error: string }>
}

type DigestResult = {
  success: true
  digest: {
    period: string
    overdue: number
    dueThisWeek: number
    dueNextWeek: number
    recipient: string
  }
}

function buildTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  })
}

function activeStatusSql() {
  return sql`${obligations.status} IN ('current', 'upcoming', 'overdue')`
}

export async function processDueAlerts(actor: Actor): Promise<AlertResult> {
  await dbReady
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const allObligations = await db.select().from(obligations).where(activeStatusSql())
  const alertsSent: AlertResult['details'] = []
  const errors: Array<{ id: string; error: string }> = []
  const transporter = buildTransporter()

  for (const obligation of allObligations) {
    try {
      const dueDate = new Date(obligation.nextDueDate)
      dueDate.setHours(0, 0, 0, 0)

      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      let alertDays: number[] = []
      try {
        alertDays = JSON.parse(obligation.alertDays || '[]')
      } catch {
        alertDays = []
      }

      if (!alertDays.includes(daysUntilDue)) continue

      const lastAlertDate = obligation.lastAlertSent ? new Date(obligation.lastAlertSent) : null
      if (lastAlertDate) {
        lastAlertDate.setHours(0, 0, 0, 0)
        if (lastAlertDate.getTime() === today.getTime()) continue
      }

      const recipientEmail =
        obligation.assigneeEmail ||
        obligation.ownerEmail ||
        process.env.ALERT_EMAIL_TO ||
        process.env.SMTP_USER

      if (!recipientEmail) {
        errors.push({ id: obligation.id, error: 'No recipient email configured' })
        continue
      }

      const { subject, html, text } = generateAlertEmail({
        obligation: {
          id: obligation.id,
          title: obligation.title,
          category: obligation.category,
          nextDueDate: obligation.nextDueDate,
          owner: obligation.owner,
          ownerEmail: obligation.ownerEmail,
          assignee: obligation.assignee,
          assigneeEmail: obligation.assigneeEmail,
          riskLevel: obligation.riskLevel,
          status: obligation.status,
          notes: obligation.notes,
        },
        daysUntilDue,
      })

      await transporter.sendMail({
        from: process.env.ALERT_EMAIL_FROM || process.env.SMTP_USER || 'noreply@compliance-tracker.com',
        to: recipientEmail,
        subject,
        text,
        html,
      })

      await logEvent({
        type: 'alert.sent',
        actor,
        entityType: 'alert',
        entityId: obligation.id,
        summary: `Sent alert for "${obligation.title}" to ${recipientEmail}`,
        metadata: { obligationId: obligation.id, recipient: recipientEmail, channel: 'email', daysUntilDue },
      })

      await db
        .update(obligations)
        .set({ lastAlertSent: today.toISOString() })
        .where(sql`${obligations.id} = ${obligation.id}`)

      alertsSent.push({ id: obligation.id, title: obligation.title, daysUntilDue })
    } catch (error) {
      errors.push({
        id: obligation.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return {
    success: true,
    alertsSent: alertsSent.length,
    details: alertsSent,
    errors: errors.length > 0 ? errors : undefined,
  }
}

type DigestObligation = {
  id: string
  title: string
  category: string
  nextDueDate: string
  owner: string
  ownerEmail: string | null
  assignee: string | null
  assigneeEmail: string | null
  riskLevel: string
  status: string
  notes: string | null
}

function digestObligation(obligation: typeof obligations.$inferSelect): DigestObligation {
  return {
    id: obligation.id,
    title: obligation.title,
    category: obligation.category,
    nextDueDate: obligation.nextDueDate,
    owner: obligation.owner,
    ownerEmail: obligation.ownerEmail,
    assignee: obligation.assignee,
    assigneeEmail: obligation.assigneeEmail,
    riskLevel: obligation.riskLevel,
    status: obligation.status,
    notes: obligation.notes,
  }
}

export async function sendWeeklyDigest(): Promise<DigestResult> {
  await dbReady
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const oneWeekFromNow = new Date(today)
  oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7)

  const twoWeeksFromNow = new Date(today)
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14)

  const allObligations = await db.select().from(obligations).where(activeStatusSql())

  const overdue: DigestObligation[] = []
  const dueThisWeek: DigestObligation[] = []
  const dueNextWeek: DigestObligation[] = []

  for (const obligation of allObligations) {
    const dueDate = new Date(obligation.nextDueDate)
    dueDate.setHours(0, 0, 0, 0)

    if (dueDate < today) {
      overdue.push(digestObligation(obligation))
    } else if (dueDate <= oneWeekFromNow) {
      dueThisWeek.push(digestObligation(obligation))
    } else if (dueDate <= twoWeeksFromNow) {
      dueNextWeek.push(digestObligation(obligation))
    }
  }

  const sortByDueDate = (a: DigestObligation, b: DigestObligation) =>
    new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()
  overdue.sort(sortByDueDate)
  dueThisWeek.sort(sortByDueDate)
  dueNextWeek.sort(sortByDueDate)

  const periodEnd = new Date(today)
  periodEnd.setDate(periodEnd.getDate() + 6)
  const period = `${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  const { subject, html, text } = generateDigestEmail({
    overdue,
    dueThisWeek,
    dueNextWeek,
    period,
  })

  const recipientEmail = process.env.ALERT_EMAIL_TO || process.env.SMTP_USER
  if (!recipientEmail) {
    throw new Error('No recipient email configured (ALERT_EMAIL_TO or SMTP_USER)')
  }

  await buildTransporter().sendMail({
    from: process.env.ALERT_EMAIL_FROM || process.env.SMTP_USER || 'noreply@compliance-tracker.com',
    to: recipientEmail,
    subject,
    text,
    html,
  })

  return {
    success: true,
    digest: {
      period,
      overdue: overdue.length,
      dueThisWeek: dueThisWeek.length,
      dueNextWeek: dueNextWeek.length,
      recipient: recipientEmail,
    },
  }
}
