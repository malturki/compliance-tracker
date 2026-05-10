import { and, eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db, dbReady } from '@/db'
import { auditClaims } from '@/db/schema'
import { canonicalize } from './canonical'
import { getPublishableClaimById, getPublishableClaims, markStuckSubmittingAsFailed } from './claims'
import { sha256Urn } from './hash'

export type FastAuditPublishMode = 'disabled' | 'dry-run' | 'testnet'

type PublishResult = {
  txId: string
  sender: string
  certificate?: unknown
}

type FastSignerResponse = {
  transaction: unknown
  signature: unknown
  sender?: string
  txId?: string
}

type FastSubmitterResponse = {
  txId?: string
  transactionId?: string
  transaction_hash?: unknown
  certificateHash?: string
  hash?: unknown
  sender?: string
  certificate?: unknown
  result?: unknown
}

type FastPrivateKeyExport = {
  ok?: boolean
  data?: {
    privateKey?: string
    fastAddress?: string
  }
  privateKey?: string
}

function getMode(): FastAuditPublishMode {
  const raw = process.env.FAST_AUDIT_CLAIMS_MODE
  if (raw === 'disabled' || raw === 'testnet' || raw === 'dry-run') return raw
  return 'dry-run'
}

async function publishDryRun(payloadJson: string): Promise<PublishResult> {
  return {
    txId: `dryrun:${sha256Urn(payloadJson).slice('sha256:'.length)}`,
    sender: process.env.FAST_AUDIT_SENDER || 'dry-run',
    certificate: {
      mode: 'dry-run',
      claimType: 'ExternalClaim',
      archival: true,
    },
  }
}

function bytesFromUtf8(value: string): number[] {
  return Array.from(Buffer.from(value, 'utf8'))
}

function normalizeHash(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.every(item => Number.isInteger(item))) {
    return `0x${Buffer.from(value).toString('hex')}`
  }
  return null
}

function extractTxId(data: unknown): string | null {
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : {}
  const result = record.result && typeof record.result === 'object'
    ? record.result as Record<string, unknown>
    : record
  const success = result.Success && typeof result.Success === 'object'
    ? result.Success as Record<string, unknown>
    : result

  return (
    normalizeHash(success.txId) ??
    normalizeHash(success.transactionId) ??
    normalizeHash(success.transaction_hash) ??
    normalizeHash(success.certificateHash) ??
    normalizeHash(success.hash) ??
    normalizeHash(record.txId) ??
    normalizeHash(record.transaction_hash)
  )
}

async function postJson(url: string, body: unknown, token?: string): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(`Fast request failed (${res.status}): ${JSON.stringify(data)}`)
  }
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(`Fast RPC error: ${JSON.stringify((data as { error: unknown }).error)}`)
  }
  return data
}

async function publishViaSubmitter(payloadJson: string): Promise<PublishResult> {
  const submitterUrl = process.env.FAST_AUDIT_SUBMITTER_URL
  const sender = process.env.FAST_AUDIT_SENDER
  if (!submitterUrl) throw new Error('FAST_AUDIT_SUBMITTER_URL is required')

  const data = await postJson(submitterUrl, {
    network: process.env.FAST_AUDIT_NETWORK || 'testnet',
    sender,
    payloadJson,
    payloadHash: sha256Urn(payloadJson),
    claimDataEncoding: 'utf8-json',
    claimData: bytesFromUtf8(payloadJson),
  }, process.env.FAST_AUDIT_API_TOKEN) as FastSubmitterResponse

  const txId = extractTxId(data) ?? extractTxId(data.result) ?? data.txId ?? data.transactionId
  if (!txId) {
    throw new Error(`Fast submitter response did not include a transaction id: ${JSON.stringify(data)}`)
  }

  return {
    txId,
    sender: data.sender ?? sender ?? 'fast-submitter',
    certificate: data.certificate ?? data.result ?? data,
  }
}

async function readLocalPrivateKey(): Promise<string | null> {
  if (process.env.FAST_AUDIT_PRIVATE_KEY) return process.env.FAST_AUDIT_PRIVATE_KEY.trim()

  const file = process.env.FAST_AUDIT_PRIVATE_KEY_FILE
  if (!file) return null

  const { readFile } = await import('fs/promises')
  const raw = (await readFile(file, 'utf8')).trim()
  if (!raw.startsWith('{')) return raw

  const parsed = JSON.parse(raw) as FastPrivateKeyExport
  const privateKey = parsed.data?.privateKey ?? parsed.privateKey
  if (!privateKey) throw new Error(`FAST_AUDIT_PRIVATE_KEY_FILE did not contain a privateKey field: ${file}`)
  return privateKey.trim()
}

function getFastNetworkName() {
  return process.env.FAST_AUDIT_NETWORK || 'testnet'
}

function getFastNetworkId(): 'fast:testnet' | 'fast:mainnet' | 'fast:localnet' | 'fast:devnet' {
  const raw = process.env.FAST_AUDIT_NETWORK_ID
  if (raw === 'fast:mainnet' || raw === 'fast:localnet' || raw === 'fast:devnet' || raw === 'fast:testnet') {
    return raw
  }
  return getFastNetworkName() === 'mainnet' ? 'fast:mainnet' : 'fast:testnet'
}

function shouldRequestArchivalTransaction() {
  return process.env.FAST_AUDIT_ARCHIVAL === 'true'
}

function getFastFeeToken(defaultTokenId?: string): string | null {
  const raw = process.env.FAST_AUDIT_FEE_TOKEN?.trim()
  if (raw) {
    if (raw === 'native' || raw === 'none' || raw === 'null') return null
    return raw
  }
  return defaultTokenId ?? null
}

async function publishWithLocalSdk(payloadJson: string, privateKey: string): Promise<PublishResult> {
  const [
    { FastProvider, Signer, TransactionBuilder },
    networks,
  ] = await Promise.all([
    import('@fastxyz/sdk'),
    import('@fastxyz/sdk/networks'),
  ])

  const networkName = getFastNetworkName()
  const network =
    networkName === 'mainnet'
      ? networks.mainnet
      : networkName === 'testnet' || networkName === 'fast-testnet'
        ? networks.testnet
        : {
          url: process.env.FAST_AUDIT_RPC_URL || networkName,
          networkId: getFastNetworkId(),
          defaultToken: undefined,
        }

  const signer = new Signer(privateKey)
  const provider = new FastProvider(network)
  const publicKey = await signer.getPublicKey()
  const sender = await signer.getFastAddress()
  const account = await provider.getAccountInfo({ address: publicKey })
  const claimData = bytesFromUtf8(payloadJson)
  const claim = {
    verifierCommittee: [publicKey],
    verifierQuorum: 1,
    claimData,
  }
  const { bcsSchema } = await import('@fastxyz/schema')
  const verifierSignature = await signer.signTypedData(bcsSchema.ExternalClaimBody, {
    verifier_committee: [publicKey],
    verifier_quorum: 1,
    claim_data: claimData,
  })
  const envelope = await new TransactionBuilder({
    networkId: network.networkId ?? getFastNetworkId(),
    signer,
    nonce: account.nextNonce,
    archival: shouldRequestArchivalTransaction(),
    feeToken: getFastFeeToken(network.defaultToken?.tokenId),
  }).addExternalClaim({
    claim,
    signatures: [
      {
        verifierAddr: publicKey,
        sig: verifierSignature,
      },
    ],
  }).sign()

  const result = await provider.submitTransaction(envelope)
  const txId = extractTxId(result)
  if (!txId) {
    throw new Error(`Fast SDK response did not include a transaction id: ${JSON.stringify(result)}`)
  }

  return {
    txId,
    sender,
    certificate: result,
  }
}

async function publishTestnet(payloadJson: string): Promise<PublishResult> {
  const endpoint = process.env.FAST_AUDIT_RPC_URL
  const signerUrl = process.env.FAST_AUDIT_SIGNER_URL
  const submitterUrl = process.env.FAST_AUDIT_SUBMITTER_URL
  const token = process.env.FAST_AUDIT_API_TOKEN
  const sender = process.env.FAST_AUDIT_SENDER
  const privateKey = await readLocalPrivateKey()
  if (privateKey) return publishWithLocalSdk(payloadJson, privateKey)
  if (submitterUrl) return publishViaSubmitter(payloadJson)
  if (!endpoint) throw new Error('FAST_AUDIT_RPC_URL is required for testnet publishing')
  if (!signerUrl) throw new Error('FAST_AUDIT_SIGNER_URL is required for testnet publishing')
  if (!sender) throw new Error('FAST_AUDIT_SENDER is required for testnet publishing')

  const signed = await postJson(signerUrl, {
    network: process.env.FAST_AUDIT_NETWORK || 'testnet',
    sender,
    claimType: 'ExternalClaim',
    claimDataEncoding: 'utf8-json',
    claimData: bytesFromUtf8(payloadJson),
    payloadJson,
    payloadHash: sha256Urn(payloadJson),
    archival: true,
  }, token) as FastSignerResponse

  if (!signed.transaction || !signed.signature) {
    throw new Error(`Fast signer response must include transaction and signature: ${JSON.stringify(signed)}`)
  }

  const body = {
    jsonrpc: '2.0',
    id: randomUUID(),
    method: process.env.FAST_AUDIT_RPC_METHOD || 'set_proxy_submitTransaction',
    params: {
      transaction: signed.transaction,
      signature: signed.signature,
    },
  }

  const data = await postJson(endpoint, body, token)
  const txId = signed.txId ?? extractTxId(data)
  if (!txId) {
    throw new Error(`Fast RPC response did not include a transaction id: ${JSON.stringify(data)}`)
  }

  return {
    txId,
    sender: signed.sender ?? sender,
    certificate: data,
  }
}

async function publishPayload(payloadJson: string): Promise<PublishResult | null> {
  const mode = getMode()
  if (mode === 'disabled') return null
  if (mode === 'testnet') return publishTestnet(payloadJson)
  return publishDryRun(payloadJson)
}

type PublishableClaim = typeof auditClaims.$inferSelect

async function claimForPublishing(claim: PublishableClaim): Promise<boolean> {
  const now = new Date().toISOString()
  const result = await db
    .update(auditClaims)
    .set({
      status: 'submitting',
      attempts: claim.attempts + 1,
      updatedAt: now,
      lastError: null,
    })
    .where(and(
      eq(auditClaims.id, claim.id),
      inArray(auditClaims.status, ['pending', 'failed']),
    ))
    .returning({ id: auditClaims.id })
  return result.length === 1
}

async function publishClaim(claim: PublishableClaim): Promise<{ confirmed: boolean; failed: boolean; skipped: boolean; error?: string }> {
  const claimed = await claimForPublishing(claim)
  if (!claimed) return { confirmed: false, failed: false, skipped: true }

  try {
    const result = await publishPayload(claim.payloadJson)
    if (!result) {
      await db.update(auditClaims).set({
        status: 'skipped',
        updatedAt: new Date().toISOString(),
        lastError: 'FAST_AUDIT_CLAIMS_MODE=disabled',
      }).where(eq(auditClaims.id, claim.id))
      return { confirmed: false, failed: false, skipped: true }
    }

    const finishedAt = new Date().toISOString()
    await db.update(auditClaims).set({
      status: 'confirmed',
      fastSender: result.sender,
      fastTxId: result.txId,
      fastCertificate: result.certificate ? canonicalize(result.certificate) : null,
      submittedAt: finishedAt,
      confirmedAt: finishedAt,
      updatedAt: finishedAt,
    }).where(eq(auditClaims.id, claim.id))
    return { confirmed: true, failed: false, skipped: false }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Fast publish error'
    await db.update(auditClaims).set({
      status: 'failed',
      lastError: message,
      updatedAt: new Date().toISOString(),
    }).where(eq(auditClaims.id, claim.id))
    return { confirmed: false, failed: true, skipped: false, error: `${claim.auditLogId}: ${message}` }
  }
}

export async function publishAuditClaimById(id: string) {
  await dbReady
  const mode = getMode()
  if (mode === 'disabled') {
    return { mode, attempted: 0, confirmed: 0, failed: 0, skipped: 0, errors: [] as string[] }
  }

  const claim = await getPublishableClaimById(id)
  if (!claim) {
    return { mode, attempted: 0, confirmed: 0, failed: 0, skipped: 0, errors: [] as string[] }
  }

  const result = await publishClaim(claim)
  return {
    mode,
    attempted: result.skipped ? 0 : 1,
    confirmed: result.confirmed ? 1 : 0,
    failed: result.failed ? 1 : 0,
    skipped: result.skipped ? 1 : 0,
    errors: result.error ? [result.error] : [] as string[],
  }
}

export async function publishAuditClaims(limit = 25) {
  await dbReady
  await markStuckSubmittingAsFailed()
  const mode = getMode()
  if (mode === 'disabled') {
    return { mode, attempted: 0, confirmed: 0, failed: 0, skipped: 0, errors: [] as string[] }
  }

  const claims = await getPublishableClaims(limit)
  let confirmed = 0
  let failed = 0
  let skipped = 0
  const errors: string[] = []

  for (const claim of claims) {
    const result = await publishClaim(claim)
    if (result.confirmed) confirmed++
    if (result.failed) failed++
    if (result.skipped) skipped++
    if (result.error) errors.push(result.error)
  }

  return {
    mode,
    attempted: claims.length,
    confirmed,
    failed,
    skipped,
    errors,
  }
}
