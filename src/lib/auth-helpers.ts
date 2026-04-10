import { auth } from './auth'
import { NextResponse } from 'next/server'

export type Role = 'viewer' | 'editor' | 'admin'

const ROLE_HIERARCHY: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export function checkRole(userRole: string, minRole: Role): void {
  const level = ROLE_HIERARCHY[userRole as Role]
  const required = ROLE_HIERARCHY[minRole]
  if (level === undefined || level < required) {
    throw new ForbiddenError()
  }
}

export async function requireAuth() {
  const session = await auth()
  if (!session?.user?.email) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { session, error: null }
}

export async function requireRole(minRole: Role) {
  const { session, error } = await requireAuth()
  if (error) return { session: null, error }

  try {
    checkRole(session!.user.role, minRole)
    return { session: session!, error: null }
  } catch {
    return { session: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
}
