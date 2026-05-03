import { NextRequest, NextResponse } from 'next/server'
import { sendWeeklyDigest } from '@/lib/alerts'

/**
 * Weekly cron job to send digest report
 * Protected by CRON_SECRET
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: await sendWeeklyDigest(),
    })
  } catch (error) {
    console.error('Cron weekly-digest error:', error)
    return NextResponse.json(
      {
        error: 'Cron job failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request)
}
