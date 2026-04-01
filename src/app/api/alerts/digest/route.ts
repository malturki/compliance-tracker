import { NextRequest, NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { obligations } from '@/db/schema'
import { sql } from 'drizzle-orm'
import nodemailer from 'nodemailer'
import { generateDigestEmail } from '@/lib/email-templates'

/**
 * Generate and send weekly digest report
 */
export async function POST(request: NextRequest) {
  try {
    await dbReady
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const oneWeekFromNow = new Date(today)
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7)

    const twoWeeksFromNow = new Date(today)
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14)

    // Get all active obligations
    const allObligations = await db
      .select()
      .from(obligations)
      .where(sql`${obligations.status} IN ('current', 'upcoming', 'overdue')`)

    // Categorize obligations
    const overdue: Array<any> = []
    const dueThisWeek: Array<any> = []
    const dueNextWeek: Array<any> = []

    for (const obligation of allObligations) {
      const dueDate = new Date(obligation.nextDueDate)
      dueDate.setHours(0, 0, 0, 0)

      if (dueDate < today) {
        overdue.push({
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
        })
      } else if (dueDate <= oneWeekFromNow) {
        dueThisWeek.push({
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
        })
      } else if (dueDate <= twoWeeksFromNow) {
        dueNextWeek.push({
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
        })
      }
    }

    // Sort by due date (earliest first)
    const sortByDueDate = (a: any, b: any) =>
      new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()
    overdue.sort(sortByDueDate)
    dueThisWeek.sort(sortByDueDate)
    dueNextWeek.sort(sortByDueDate)

    // Generate period string
    const periodEnd = new Date(today)
    periodEnd.setDate(periodEnd.getDate() + 6)
    const period = `${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

    // Generate email
    const { subject, html, text } = generateDigestEmail({
      overdue,
      dueThisWeek,
      dueNextWeek,
      period,
    })

    // Send email
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

    const recipientEmail = process.env.ALERT_EMAIL_TO || process.env.SMTP_USER

    if (!recipientEmail) {
      return NextResponse.json(
        { error: 'No recipient email configured (ALERT_EMAIL_TO or SMTP_USER)' },
        { status: 400 }
      )
    }

    await transporter.sendMail({
      from: process.env.ALERT_EMAIL_FROM || process.env.SMTP_USER || 'noreply@compliance-tracker.com',
      to: recipientEmail,
      subject,
      text,
      html,
    })

    return NextResponse.json({
      success: true,
      digest: {
        period,
        overdue: overdue.length,
        dueThisWeek: dueThisWeek.length,
        dueNextWeek: dueNextWeek.length,
        recipient: recipientEmail,
      },
    })
  } catch (error) {
    console.error('Digest generation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate digest',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
