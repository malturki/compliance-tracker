import { NextRequest, NextResponse } from 'next/server'

/**
 * Weekly cron job to send digest report
 * Protected by CRON_SECRET
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Call the digest API internally
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/alerts/digest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'Digest generation failed',
          details: data,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: data,
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
