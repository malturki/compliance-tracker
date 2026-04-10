import { NextRequest, NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { obligations } from '@/db/schema'
import { sql, lt } from 'drizzle-orm'
import nodemailer from 'nodemailer'
import { generateAlertEmail } from '@/lib/email-templates'
import { getActor } from '@/lib/actor'
import { logEvent } from '@/lib/audit'
import { requireRole } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

/**
 * Check for obligations that need alerts sent
 * Checks alertDays array and sends emails if within alert window
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireRole('admin')
    if (authError) return authError

    await dbReady
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get all obligations that are current or upcoming (not completed)
    const allObligations = await db
      .select()
      .from(obligations)
      .where(sql`${obligations.status} IN ('current', 'upcoming', 'overdue')`)

    const alertsSent: Array<{ id: string; title: string; daysUntilDue: number }> = []
    const errors: Array<{ id: string; error: string }> = []

    // Create email transporter
    const transporter = nodemailer.createTransport({
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

    for (const obligation of allObligations) {
      try {
        const dueDate = new Date(obligation.nextDueDate)
        dueDate.setHours(0, 0, 0, 0)

        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        // Parse alert days
        let alertDays: number[] = []
        try {
          alertDays = JSON.parse(obligation.alertDays || '[]')
        } catch {
          alertDays = []
        }

        // Check if we should send alert today
        const shouldAlert = alertDays.includes(daysUntilDue)

        if (!shouldAlert) {
          continue
        }

        // Check if alert already sent today
        const lastAlertDate = obligation.lastAlertSent ? new Date(obligation.lastAlertSent) : null
        if (lastAlertDate) {
          lastAlertDate.setHours(0, 0, 0, 0)
          if (lastAlertDate.getTime() === today.getTime()) {
            // Already sent today
            continue
          }
        }

        // Determine recipient
        const recipientEmail =
          obligation.assigneeEmail ||
          obligation.ownerEmail ||
          process.env.ALERT_EMAIL_TO ||
          process.env.SMTP_USER

        if (!recipientEmail) {
          errors.push({ id: obligation.id, error: 'No recipient email configured' })
          continue
        }

        // Generate email
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

        // Send email
        await transporter.sendMail({
          from: process.env.ALERT_EMAIL_FROM || process.env.SMTP_USER || 'noreply@compliance-tracker.com',
          to: recipientEmail,
          subject,
          text,
          html,
        })

        const alertActor = await getActor(request)
        await logEvent({
          type: 'alert.sent',
          actor: alertActor,
          entityType: 'alert',
          entityId: obligation.id,
          summary: `Sent alert for "${obligation.title}" to ${recipientEmail}`,
          metadata: { obligationId: obligation.id, recipient: recipientEmail, channel: 'email', daysUntilDue },
        })

        // Update lastAlertSent
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

    return NextResponse.json({
      success: true,
      alertsSent: alertsSent.length,
      details: alertsSent,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Alert check error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process alerts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
