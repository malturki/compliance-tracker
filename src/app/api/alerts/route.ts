import { NextRequest, NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { requireRole } from '@/lib/auth-helpers'
import { processDueAlerts } from '@/lib/alerts'

export const dynamic = 'force-dynamic'

/**
 * Check for obligations that need alerts sent
 * Checks alertDays array and sends emails if within alert window
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireRole('admin', request)
    if (authError) return authError

    return NextResponse.json(await processDueAlerts(await getActor(request)))
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
