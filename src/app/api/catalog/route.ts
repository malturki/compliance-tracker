import { NextRequest, NextResponse } from 'next/server'
import { dbReady } from '@/db'
import { listCatalogItems, CATALOG_TAG_LABELS } from '@/data/recommended-additions'
import { requireRole } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { error: authError } = await requireRole('editor', req)
  if (authError) return authError

  await dbReady
  return NextResponse.json({
    items: listCatalogItems(),
    tagLabels: CATALOG_TAG_LABELS,
  })
}
