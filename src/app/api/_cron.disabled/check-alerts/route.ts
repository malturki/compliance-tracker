import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Vercel Cron endpoint for daily alert checks
 * Configured in vercel.json to run daily at 8:00 AM UTC
 */
export async function GET(request: Request) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (process.env.CRON_SECRET && authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Call the alerts API internally
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const alertsResponse = await fetch(`${baseUrl}/api/alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const alertsData = await alertsResponse.json()

    if (!alertsResponse.ok) {
      throw new Error(`Alerts API failed: ${JSON.stringify(alertsData)}`)
    }

    console.log('Daily alert check completed:', alertsData)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      alerts: alertsData,
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      {
        error: 'Cron job failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual testing
export async function POST(request: Request) {
  return GET(request)
}
