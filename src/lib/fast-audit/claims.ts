import { asc, desc, eq, inArray, notInArray } from 'drizzle-orm'
import { ulid } from 'ulid'
import { db, dbReady } from '@/db'
import { auditClaims, auditLog } from '@/db/schema'
import type { LogEventInput } from '@/lib/audit'
import { canonicalize } from './canonical'
import { hashCanonical, hashText } from './hash'

export type AuditClaimStatus = 'pending' | 'submitting' | 'confirmed' | 'failed' | 'skipped'

export type AuditClaimPayload = {
  version: 1
  app: 'compliance-tracker'
  network: string
  claimType: 'fast.external_claim'
  auditId: string
  eventType: string
  entityType: string
  entityId: string | null
  actorHash: string
  actorSource: string
  timestamp: string
  summaryHash: string
  diffHash: string | null
  metadataHash: string | null
  previousEventHash: string | null
  eventHash: string
}

type AuditRow = typeof auditLog.$inferSelect

export function getFastAuditNetwork() {
  return process.env.FAST_AUDIT_NETWORK || 'fast-testnet'
}

export function shouldEnqueueAuditClaims() {
  return process.env.FAST_AUDIT_CLAIMS_MODE !== 'disabled'
}

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function buildPayloadCore(params: {
  auditId: string
  event: LogEventInput
  timestamp: string
  previousEventHash: string | null
}): Omit<AuditClaimPayload, 'eventHash'> {
  return {
    version: 1,
    app: 'compliance-tracker',
    network: getFastAuditNetwork(),
    claimType: 'fast.external_claim',
    auditId: params.auditId,
    eventType: params.event.type,
    entityType: params.event.entityType,
    entityId: params.event.entityId ?? null,
    actorHash: hashCanonical({
      actor: params.event.actor.email.trim().toLowerCase(),
      source: params.event.actor.source,
    }),
    actorSource: params.event.actor.source,
    timestamp: params.timestamp,
    summaryHash: hashText(params.event.summary)!,
    diffHash: params.event.diff ? hashCanonical(params.event.diff) : null,
    metadataHash: params.event.metadata ? hashCanonical(params.event.metadata) : null,
    previousEventHash: params.previousEventHash,
  }
}

function payloadFromAuditRow(row: AuditRow, previousEventHash: string | null): AuditClaimPayload {
  const event = {
    type: row.eventType,
    actor: { email: row.actor, source: row.actorSource },
    entityType: row.entityType,
    entityId: row.entityId,
    summary: row.summary,
    diff: parseJsonObject(row.diff),
    metadata: parseJsonObject(row.metadata),
  } as LogEventInput
  const core = buildPayloadCore({
    auditId: row.id,
    event,
    timestamp: row.ts,
    previousEventHash,
  })
  return { ...core, eventHash: hashCanonical(core) }
}

export async function latestAuditClaimHash(): Promise<string | null> {
  await dbReady
  const rows = await db
    .select({ eventHash: auditClaims.eventHash })
    .from(auditClaims)
    .orderBy(desc(auditClaims.createdAt), desc(auditClaims.id))
    .limit(1)
  return rows[0]?.eventHash ?? null
}

export async function enqueueAuditClaim(params: {
  auditId: string
  event: LogEventInput
  timestamp: string
}): Promise<void> {
  if (!shouldEnqueueAuditClaims()) return

  const previousEventHash = await latestAuditClaimHash()
  const core = buildPayloadCore({ ...params, previousEventHash })
  const payload: AuditClaimPayload = { ...core, eventHash: hashCanonical(core) }
  const payloadJson = canonicalize(payload)
  const now = new Date().toISOString()

  await db.insert(auditClaims).values({
    id: ulid(),
    auditLogId: params.auditId,
    status: 'pending',
    fastNetwork: payload.network,
    payloadJson,
    payloadHash: hashText(payloadJson)!,
    eventHash: payload.eventHash,
    previousEventHash,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  })
}

export async function enqueueMissingAuditClaims(limit = 100): Promise<{ enqueued: number }> {
  await dbReady
  if (!shouldEnqueueAuditClaims()) return { enqueued: 0 }

  const existing = await db.select({ auditLogId: auditClaims.auditLogId }).from(auditClaims)
  const existingIds = existing.map(row => row.auditLogId)
  const rows = await db
    .select()
    .from(auditLog)
    .where(existingIds.length > 0 ? notInArray(auditLog.id, existingIds) : undefined)
    .orderBy(asc(auditLog.ts), asc(auditLog.id))
    .limit(limit)

  let enqueued = 0
  for (const row of rows) {
    const previousEventHash = await latestAuditClaimHash()
    const payload = payloadFromAuditRow(row, previousEventHash)
    const payloadJson = canonicalize(payload)
    const now = new Date().toISOString()
    await db.insert(auditClaims).values({
      id: ulid(),
      auditLogId: row.id,
      status: 'pending',
      fastNetwork: payload.network,
      payloadJson,
      payloadHash: hashText(payloadJson)!,
      eventHash: payload.eventHash,
      previousEventHash,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    })
    enqueued++
  }

  return { enqueued }
}

export async function markStuckSubmittingAsFailed() {
  await db
    .update(auditClaims)
    .set({
      status: 'failed',
      lastError: 'Recovered stale submitting claim',
      updatedAt: new Date().toISOString(),
    })
    .where(eq(auditClaims.status, 'submitting'))
}

export async function getPublishableClaims(limit: number) {
  await dbReady
  return db
    .select()
    .from(auditClaims)
    .where(inArray(auditClaims.status, ['pending', 'failed']))
    .orderBy(auditClaims.createdAt, auditClaims.id)
    .limit(limit)
}
