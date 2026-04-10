import { ulid } from 'ulid'
import { db } from '@/db'
import { auditLog } from '@/db/schema'
import type { Actor } from './actor'

export type AuditEventType =
  | 'obligation.created'
  | 'obligation.updated'
  | 'obligation.deleted'
  | 'obligation.completed'
  | 'obligation.bulk_updated'
  | 'template.applied'
  | 'alert.sent'
  | 'user.role_changed'

export type AuditEntityType = 'obligation' | 'template' | 'alert' | 'user'

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
    await db.insert(auditLog).values({
      id: ulid(),
      ts: new Date().toISOString(),
      eventType: event.type,
      actor: event.actor.email,
      actorSource: event.actor.source,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      summary: event.summary,
      diff: event.diff ? JSON.stringify(event.diff) : null,
      metadata: event.metadata ? JSON.stringify(event.metadata) : null,
    })
  } catch (err) {
    // Never break a user-facing mutation because the audit write failed.
    console.error('[audit] logEvent failed', err)
  }
}
