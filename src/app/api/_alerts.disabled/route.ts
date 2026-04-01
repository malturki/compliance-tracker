import { NextResponse } from 'next/server'
import { db } from '@/db'
import { obligations } from '@/db/schema'
import { eq, and, lte, isNull } from 'drizzle-orm'
import sgMail from '@sendgrid/mail'
import { buildAlertEmail } from '@/lib/email-templates'
import { differenceInDays, parseISO, startOfDay } from 'date-fns'

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const FROM_EMAIL = process.env.ALERT_EMAIL_FROM || 'noreply@compliance.app'

export async function POST(request: Request) {
  try {
    // Verify SendGrid is configured
    if (!process.env.SENDGRID_API_KEY) {
      return NextResponse.json(
        { error: 'SendGrid API key not configured' },
        { status: 500 }
      )
    }

    const today = startOfDay(new Date())

    // Fetch all active obligations
    const allObligations = await db
      .select()
      .from(obligations)
      .where(and(eq(obligations.status, 'current'), isNull(obligations.lastCompletedDate)))

    const alertsSent: Array<{ obligationId: string; email: string; daysUntilDue: number }> = []
    const errors: Array<{ obligationId: string; error: string }> = []

    for (const obligation of allObligations) {
      try {
        const nextDueDate = startOfDay(parseISO(obligation.nextDueDate))
        const daysUntilDue = differenceInDays(nextDueDate, today)

        // Parse alertDays
        let alertDays: number[] = []
        try {
          alertDays = JSON.parse(obligation.alertDays || '[]')
        } catch {
          alertDays = []
        }

        // Check if we should send an alert today
        const shouldAlert = alertDays.includes(daysUntilDue)

        if (!shouldAlert) {
          continue // Skip this obligation
        }

        // Check if we already sent an alert recently (within last 23 hours to avoid duplicates)
        if (obligation.lastAlertSent) {
          const lastAlertDate = parseISO(obligation.lastAlertSent)
          const hoursSinceLastAlert = (today.getTime() - lastAlertDate.getTime()) / (1000 * 60 * 60)
          if (hoursSinceLastAlert < 23) {
            continue // Already sent alert today
          }
        }

        // Determine recipient email
        const recipientEmail = obligation.assigneeEmail || obligation.ownerEmail || process.env.ALERT_EMAIL_TO

        if (!recipientEmail) {
          errors.push({
            obligationId: obligation.id,
            error: 'No recipient email configured',
          })
          continue
        }

        // Build and send email
        const emailHtml = buildAlertEmail({
          obligation: {
            id: obligation.id,
            title: obligation.title,
            category: obligation.category,
            owner: obligation.owner,
            assignee: obligation.assignee,
            riskLevel: obligation.riskLevel,
            nextDueDate: obligation.nextDueDate,
            amount: obligation.amount,
            jurisdiction: obligation.jurisdiction,
          },
          daysUntilDue,
          appUrl: APP_URL,
        })

        const msg = {
          to: recipientEmail,
          from: FROM_EMAIL,
          subject: daysUntilDue < 0
            ? `OVERDUE: ${obligation.title}`
            : `Compliance Alert: ${obligation.title} - Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`,
          html: emailHtml,
        }

        await sgMail.send(msg)

        // Update lastAlertSent
        await db
          .update(obligations)
          .set({
            lastAlertSent: today.toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(obligations.id, obligation.id))

        alertsSent.push({
          obligationId: obligation.id,
          email: recipientEmail,
          daysUntilDue,
        })
      } catch (error) {
        console.error(`Error sending alert for obligation ${obligation.id}:`, error)
        errors.push({
          obligationId: obligation.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      alertsSent: alertsSent.length,
      errors: errors.length,
      details: {
        sent: alertsSent,
        errors,
      },
    })
  } catch (error) {
    console.error('Error in alert check:', error)
    return NextResponse.json(
      {
        error: 'Failed to check and send alerts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
