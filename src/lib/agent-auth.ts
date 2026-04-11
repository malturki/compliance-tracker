import { db } from '@/db'
import { agents } from '@/db/schema'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { hashToken, TOKEN_PREFIX } from './token-utils'

export type AgentActor = {
  type: 'agent'
  agentId: string
  name: string
  role: 'viewer' | 'editor' | 'admin'
}

export async function verifyAgentToken(token: string): Promise<AgentActor | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null

  const hash = hashToken(token)
  const nowIso = new Date().toISOString()

  const rows = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.tokenHash, hash),
        isNull(agents.revokedAt),
        gt(agents.expiresAt, nowIso),
      ),
    )
    .limit(1)

  if (rows.length === 0) return null
  const agent = rows[0]

  // Fire-and-forget last_used_at update
  db.update(agents)
    .set({ lastUsedAt: nowIso })
    .where(eq(agents.id, agent.id))
    .catch(err => console.error('[agent-auth] failed to update lastUsedAt', err))

  return {
    type: 'agent',
    agentId: agent.id,
    name: agent.name,
    role: agent.role as 'viewer' | 'editor' | 'admin',
  }
}
