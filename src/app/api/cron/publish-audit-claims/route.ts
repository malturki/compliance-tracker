import { NextRequest, NextResponse } from 'next/server'
import { enqueueMissingAuditClaims } from '@/lib/fast-audit/claims'
import { publishAuditClaims } from '@/lib/fast-audit/publisher'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const rawLimit = Number(searchParams.get('limit') ?? '25')
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 25, 1), 100)

    const backfill = await enqueueMissingAuditClaims(limit)
    const published = await publishAuditClaims(limit)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      backfill,
      published,
    })
  } catch (error) {
    console.error('Cron publish-audit-claims error:', error)
    return NextResponse.json(
      {
        error: 'Cron job failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}

