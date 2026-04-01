import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Vercel Cron endpoint for weekly digest emails
 * Configured in vercel.json to run every Monday at 8:00 AM UTC
 */
export async function GET(request: Request) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (process.env.CRON_SECRET && authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Call the digest API internally
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const digestResponse = await fetch(`${baseUrl}/api/alerts/digest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const digestData = await digestResponse.json()

    if (!digestResponse.ok) {
      throw new Error(`Digest API failed: ${JSON.stringify(digestData)}`)
    }

    console.log('Weekly digest sent:', digestData)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      digest: digestData,
    })
  } catch (error) {
    console.error('Weekly digest cron job error:', error)
    return NextResponse.json(
      {
        error: 'Weekly digest cron job failed',
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
