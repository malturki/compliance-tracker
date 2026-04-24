import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { dbReady } from '@/db'
import { listPlaybooks, applyPlaybook, PlaybookError } from '@/lib/playbooks'
import { requireRole } from '@/lib/auth-helpers'
import { getActor } from '@/lib/actor'
import { formatZodError } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const applySchema = z.object({
  playbookId: z.string().min(1),
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  counterparty: z.string().trim().max(200).optional(),
  ownerOverrides: z.record(z.string(), z.string().trim().min(1)).optional(),
})

export async function GET(req: NextRequest) {
  const { error: authError } = await requireRole('editor', req)
  if (authError) return authError

  await dbReady
  const list = listPlaybooks().map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    icon: p.icon,
    anchorDateStrategy: p.anchorDateStrategy,
    recurrence: p.recurrence ?? null,
    requiresCounterparty: p.requiresCounterparty,
    stepCount: p.steps.length,
  }))
  return NextResponse.json({ playbooks: list })
}

export async function POST(req: NextRequest) {
  const { error: authError } = await requireRole('editor', req)
  if (authError) return authError

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = applySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 })
  }

  await dbReady
  const actor = await getActor(req)

  try {
    const result = await applyPlaybook(parsed.data, actor)
    return NextResponse.json(
      {
        parent: result.parent,
        children: result.children,
      },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof PlaybookError) {
      const status = err.code === 'not_found' ? 404 : 400
      return NextResponse.json({ error: err.message }, { status })
    }
    console.error('[api/playbooks] apply failed', err)
    return NextResponse.json({ error: 'Failed to apply playbook' }, { status: 500 })
  }
}
