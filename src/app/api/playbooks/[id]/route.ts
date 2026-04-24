import { NextRequest, NextResponse } from 'next/server'
import { dbReady } from '@/db'
import { getPlaybook } from '@/lib/playbooks'
import { requireRole } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { error: authError } = await requireRole('editor', req)
  if (authError) return authError

  await dbReady
  const playbook = getPlaybook(params.id)
  if (!playbook) {
    return NextResponse.json({ error: 'Playbook not found' }, { status: 404 })
  }
  return NextResponse.json(playbook)
}
