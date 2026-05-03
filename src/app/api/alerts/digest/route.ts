import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-helpers'
import { sendWeeklyDigest } from '@/lib/alerts'

export const dynamic = 'force-dynamic'

/**
 * Generate and send weekly digest report
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireRole('admin', request)
    if (authError) return authError

    return NextResponse.json(await sendWeeklyDigest())
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
