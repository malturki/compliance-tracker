import { NextResponse } from 'next/server'
import { db } from '@/db'
import { obligations, completions } from '@/db/schema'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import sgMail from '@sendgrid/mail'
import { buildDigestEmail } from '@/lib/email-templates'
import {
  differenceInDays,
  parseISO,
  startOfDay,
  startOfWeek,
  endOfWeek,
  subWeeks,
  addDays,
  format,
} from 'date-fns'

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const FROM_EMAIL = process.env.ALERT_EMAIL_FROM || 'noreply@compliance.app'
const DIGEST_EMAIL = process.env.ALERT_EMAIL_TO || process.env.ALERT_EMAIL_FROM

export async function POST(request: Request) {
  try {
    // Verify SendGrid is configured
    if (!process.env.SENDGRID_API_KEY) {
      return NextResponse.json(
        { error: 'SendGrid API key not configured' },
        { status: 500 }
      )
    }

    if (!DIGEST_EMAIL) {
      return NextResponse.json(
        { error: 'Digest email recipient not configured' },
        { status: 500 }
      )
    }

    const today = startOfDay(new Date())
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }) // Monday
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
    const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })
    const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })
    const thirtyDaysFromNow = addDays(today, 30)

    // Fetch all active obligations
    const allObligations = await db
      .select()
      .from(obligations)
      .where(eq(obligations.status, 'current'))

    // Categorize obligations
    const overdue: Array<{
      id: string
      title: string
      category: string
      owner: string
      assignee: string | null
      riskLevel: string
      nextDueDate: string
      amount?: number | null
      jurisdiction?: string | null
      daysOverdue: number
    }> = []

    const dueThisWeek: typeof overdue = []
    const comingUp: typeof overdue = []

    for (const obligation of allObligations) {
      const nextDueDate = startOfDay(parseISO(obligation.nextDueDate))
      const daysUntilDue = differenceInDays(nextDueDate, today)

      const item = {
        id: obligation.id,
        title: obligation.title,
        category: obligation.category,
        owner: obligation.owner,
        assignee: obligation.assignee,
        riskLevel: obligation.riskLevel,
        nextDueDate: obligation.nextDueDate,
        amount: obligation.amount,
        jurisdiction: obligation.jurisdiction,
        daysOverdue: Math.abs(daysUntilDue),
      }

      if (daysUntilDue < 0) {
        overdue.push(item)
      } else if (nextDueDate >= weekStart && nextDueDate <= weekEnd) {
        dueThisWeek.push(item)
      } else if (nextDueDate > weekEnd && nextDueDate <= thirtyDaysFromNow) {
        comingUp.push(item)
      }
    }

    // Sort by priority
    overdue.sort((a, b) => b.daysOverdue - a.daysOverdue) // Most overdue first
    dueThisWeek.sort(
      (a, b) => parseISO(a.nextDueDate).getTime() - parseISO(b.nextDueDate).getTime()
    ) // Earliest first
    comingUp.sort(
      (a, b) => parseISO(a.nextDueDate).getTime() - parseISO(b.nextDueDate).getTime()
    )

    // Fetch completed obligations from last week
    const completedLastWeek = await db
      .select({
        obligationTitle: obligations.title,
        completedDate: completions.completedDate,
        completedBy: completions.completedBy,
      })
      .from(completions)
      .innerJoin(obligations, eq(completions.obligationId, obligations.id))
      .where(
        and(
          gte(completions.completedDate, lastWeekStart.toISOString()),
          lte(completions.completedDate, lastWeekEnd.toISOString())
        )
      )
      .orderBy(desc(completions.completedDate))

    const completedData = completedLastWeek.map((c) => ({
      title: c.obligationTitle,
      completedDate: c.completedDate,
      completedBy: c.completedBy,
    }))

    // Build digest email
    const emailHtml = buildDigestEmail({
      overdue,
      dueThisWeek,
      comingUp,
      completedLastWeek: completedData,
      weekStart: weekStart.toISOString(),
      appUrl: APP_URL,
    })

    const msg = {
      to: DIGEST_EMAIL,
      from: FROM_EMAIL,
      subject: `Compliance Digest - Week of ${format(weekStart, 'MMM d, yyyy')}`,
      html: emailHtml,
    }

    await sgMail.send(msg)

    return NextResponse.json({
      success: true,
      digest: {
        weekStart: weekStart.toISOString(),
        overdue: overdue.length,
        dueThisWeek: dueThisWeek.length,
        comingUp: comingUp.length,
        completedLastWeek: completedData.length,
      },
      sentTo: DIGEST_EMAIL,
    })
  } catch (error) {
    console.error('Error sending digest:', error)
    return NextResponse.json(
      {
        error: 'Failed to send digest email',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
