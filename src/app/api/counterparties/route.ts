import { NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { obligations } from '@/db/schema'
import { isNotNull, sql } from 'drizzle-orm'
import { requireRole } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

// Returns the distinct counterparties currently in use, with the count of
// obligations attached to each. Used by the create/edit form autocomplete and
// by the categories page "By counterparty" panel.
export async function GET() {
  const { error } = await requireRole('viewer')
  if (error) return error

  try {
    await dbReady
    const rows = await db
      .select({
        counterparty: obligations.counterparty,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(obligations)
      .where(isNotNull(obligations.counterparty))
      .groupBy(obligations.counterparty)

    const result = rows
      .filter(r => (r.counterparty ?? '').trim() !== '')
      .map(r => ({ name: r.counterparty as string, count: Number(r.count) }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ counterparties: result })
  } catch (err) {
    console.error('Counterparties list error:', err)
    return NextResponse.json({ error: 'Failed to fetch counterparties' }, { status: 500 })
  }
}
