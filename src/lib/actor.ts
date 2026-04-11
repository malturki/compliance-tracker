import { auth } from './auth'
import { verifyAgentToken } from './agent-auth'

export type Actor = {
  /** For humans: their email. For agents: `agent:<name>`. For cron/dev/system: a literal label. */
  email: string
  source: 'sso' | 'cron' | 'dev' | 'system' | 'agent'
}

/**
 * Resolve who is performing the current action, for the audit log.
 *
 * Resolution order (first match wins):
 *   1. Agent bearer token in `Authorization: Bearer <ct_live_…>` header
 *   2. NextAuth session (human signed in via Google)
 *   3. Cron secret in `Authorization: Bearer <CRON_SECRET>` header
 *   4. Dev fallback (only when `NODE_ENV !== 'production'`)
 *   5. `'system'` (last resort — should be rare in practice)
 *
 * Pass the request whenever you have one (API route handlers): without it,
 * agent-token and cron-secret paths cannot be checked, so an authenticated
 * agent will be misattributed as a session user — or, in cron tests, fall
 * through to the dev fallback. Pages and server components can omit it.
 */
export async function getActor(req?: Request): Promise<Actor> {
  // 1. Agent bearer token (checked first)
  if (req) {
    const authHeader = req.headers.get('authorization') ?? ''
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length)
      const agent = await verifyAgentToken(token)
      if (agent) {
        return { email: `agent:${agent.name}`, source: 'agent' }
      }
    }
  }

  // 2. NextAuth session
  const session = await auth()
  if (session?.user?.email) {
    return { email: session.user.email, source: 'sso' }
  }

  // 3. Cron secret
  if (req) {
    const authHeader = req.headers.get('authorization') ?? ''
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      return { email: 'cron', source: 'cron' }
    }
  }

  // 4. Dev fallback
  if (process.env.NODE_ENV !== 'production') {
    return { email: process.env.DEV_ACTOR ?? 'dev@local', source: 'dev' }
  }

  return { email: 'system', source: 'system' }
}
