import { ulid } from 'ulid'
import { db } from '@/db'
import { auditLog } from '@/db/schema'
import type { Actor } from './actor'
import { enqueueAuditClaim } from './fast-audit/claims'

export type AuditEventType =
  | 'obligation.created'
  | 'obligation.updated'
  | 'obligation.deleted'
  | 'obligation.completed'
  | 'obligation.bulk_updated'
  | 'obligation.sub_created'
  | 'obligation.parent_rollup_complete'
  | 'template.applied'
  | 'playbook.applied'
  | 'alert.sent'
  | 'user.role_changed'
  | 'agent.created'
  | 'agent.regenerated'
  | 'agent.revoked'

export type AuditEntityType = 'obligation' | 'template' | 'playbook' | 'alert' | 'user' | 'agent'

export type LogEventInput = {
  type: AuditEventType
  actor: Actor
  entityType: AuditEntityType
  entityId?: string | null
  summary: string
  diff?: Record<string, [unknown, unknown]> | null
  metadata?: Record<string, unknown> | null
}

export async function logEvent(event: LogEventInput): Promise<void> {
  try {
    const id = ulid()
    const ts = new Date().toISOString()
    await db.insert(auditLog).values({
      id,
      ts,
      eventType: event.type,
      actor: event.actor.email,
      actorSource: event.actor.source,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      summary: event.summary,
      diff: event.diff ? JSON.stringify(event.diff) : null,
      metadata: event.metadata ? JSON.stringify(event.metadata) : null,
    })
    try {
      await enqueueAuditClaim({ auditId: id, event, timestamp: ts })
    } catch (err) {
      console.error('[audit] enqueueAuditClaim failed', err)
    }
  } catch (err) {
    // Never break a user-facing mutation because the audit write failed.
    console.error('[audit] logEvent failed', err)
  }
}
