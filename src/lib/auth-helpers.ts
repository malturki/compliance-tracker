import { auth } from './auth'
import { verifyAgentToken } from './agent-auth'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import type { Role } from './types'

export type { Role }

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

/**
 * Read the Authorization header. Prefers the passed-in Request (for testability
 * and consistency with Next.js route handlers that receive the request). Falls
 * back to `headers()` from next/headers when no request is provided (for pages
 * or server components).
 */
async function readAuthHeader(req?: Request): Promise<string> {
  if (req) return req.headers.get('authorization') ?? ''
  try {
    const hdrs = await headers()
    return hdrs.get('authorization') ?? ''
  } catch {
    return ''
  }
}

async function resolveCaller(
  req?: Request,
): Promise<
  | { email: string; role: string; error: null }
  | { email: null; role: null; error: ReturnType<typeof NextResponse.json> }
> {
  // 1. Agent bearer token (checked first)
  const authHeader = await readAuthHeader(req)
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length)
    const agent = await verifyAgentToken(token)
    if (agent) {
      return { email: `agent:${agent.name}`, role: agent.role, error: null }
    }
    return {
      email: null,
      role: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  // 2. NextAuth session
  const session = await auth()
  if (!session?.user?.email) {
    return {
      email: null,
      role: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { email: session.user.email, role: session.user.role, error: null }
}

function fakeSession(email: string, role: string) {
  return {
    user: { id: 'agent', email, role, name: null, image: null },
    expires: '',
  } as any
}

export async function requireAuth(req?: Request) {
  const result = await resolveCaller(req)
  if (result.error) return { session: null, error: result.error }
  return { session: fakeSession(result.email, result.role), error: null }
}

export async function requireRole(minRole: Role, req?: Request) {
  const result = await resolveCaller(req)
  if (result.error) return { session: null, error: result.error }

  try {
    checkRole(result.role, minRole)
    return { session: fakeSession(result.email, result.role), error: null }
  } catch {
    return { session: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
}
