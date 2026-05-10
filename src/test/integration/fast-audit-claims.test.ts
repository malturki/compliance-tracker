import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, dbReady } from '@/db'
import { auditClaims, auditLog } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logEvent } from '@/lib/audit'
import { enqueueMissingAuditClaims } from '@/lib/fast-audit/claims'
import { publishAuditClaimById, publishAuditClaims } from '@/lib/fast-audit/publisher'
import { resetDb, mockSession, mkReq } from '../integration-helpers'
import { GET as publishClaimsCron, POST as postPublishClaimsCron } from '@/app/api/cron/publish-audit-claims/route'
import { GET as listClaims } from '@/app/api/audit/claims/route'

const fastSdkMock = vi.hoisted(() => {
  const publicKey = new Uint8Array(32).fill(7)
  const verifierSignature = new Uint8Array(64).fill(9)
  const calls = {
    privateKeys: [] as string[],
    providerOptions: [] as unknown[],
    accountInfoRequests: [] as unknown[],
    builderOptions: [] as unknown[],
    externalClaims: [] as unknown[],
    signedTypedData: [] as unknown[],
    submittedEnvelopes: [] as unknown[],
  }
  let submitResult: unknown = { Success: { hash: [222, 173, 190, 239] } }

  class Signer {
    constructor(privateKey: string) {
      calls.privateKeys.push(privateKey)
    }

    async getPublicKey() {
      return publicKey
    }

    async getFastAddress() {
      return 'fast1mocklocal'
    }

    async signTypedData(type: unknown, data: unknown) {
      calls.signedTypedData.push({ type, data })
      return verifierSignature
    }
  }

  class FastProvider {
    constructor(options: unknown) {
      calls.providerOptions.push(options)
    }

    async getAccountInfo(params: unknown) {
      calls.accountInfoRequests.push(params)
      return { nextNonce: BigInt(42) }
    }

    async submitTransaction(envelope: unknown) {
      calls.submittedEnvelopes.push(envelope)
      if (submitResult && typeof submitResult === 'object') {
        return { ...(submitResult as Record<string, unknown>), envelope }
      }
      return submitResult
    }
  }

  class TransactionBuilder {
    private readonly options: unknown
    private externalClaim: unknown

    constructor(options: unknown) {
      this.options = options
      calls.builderOptions.push(options)
    }

    addExternalClaim(params: unknown) {
      this.externalClaim = params
      calls.externalClaims.push(params)
      return this
    }

    async sign() {
      return { signed: true, options: this.options, externalClaim: this.externalClaim }
    }
  }

  return {
    calls,
    publicKey,
    verifierSignature,
    reset() {
      calls.privateKeys = []
      calls.providerOptions = []
      calls.accountInfoRequests = []
      calls.builderOptions = []
      calls.externalClaims = []
      calls.signedTypedData = []
      calls.submittedEnvelopes = []
      submitResult = { Success: { hash: [222, 173, 190, 239] } }
    },
    setSubmitResult(value: unknown) {
      submitResult = value
    },
    sdk: { Signer, FastProvider, TransactionBuilder },
    networks: {
      mainnet: {
        url: 'https://mainnet.fast.test/proxy-rest',
        networkId: 'fast:mainnet',
        defaultToken: { tokenId: '0xmainnetfee', symbol: 'fastUSD', decimals: 6 },
      },
      testnet: {
        url: 'https://testnet.fast.test/proxy-rest',
        networkId: 'fast:testnet',
        defaultToken: { tokenId: '0xtestnetfee', symbol: 'testUSDC', decimals: 6 },
      },
    },
    schema: { bcsSchema: { ExternalClaimBody: 'ExternalClaimBodySchema' } },
  }
})

vi.mock('@fastxyz/sdk', () => fastSdkMock.sdk)
vi.mock('@fastxyz/sdk/networks', () => fastSdkMock.networks)
vi.mock('@fastxyz/schema', () => fastSdkMock.schema)

async function waitForClaimStatus(status: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const claims = await db.select().from(auditClaims).where(eq(auditClaims.status, status))
    if (claims.length > 0) return claims
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  return db.select().from(auditClaims).where(eq(auditClaims.status, status))
}

describe('Fast audit claims', () => {
  const originalMode = process.env.FAST_AUDIT_CLAIMS_MODE
  const originalCronSecret = process.env.CRON_SECRET
  const originalRpcUrl = process.env.FAST_AUDIT_RPC_URL
  const originalSignerUrl = process.env.FAST_AUDIT_SIGNER_URL
  const originalSubmitterUrl = process.env.FAST_AUDIT_SUBMITTER_URL
  const originalSender = process.env.FAST_AUDIT_SENDER
  const originalPrivateKey = process.env.FAST_AUDIT_PRIVATE_KEY
  const originalPrivateKeyFile = process.env.FAST_AUDIT_PRIVATE_KEY_FILE
  const originalNetwork = process.env.FAST_AUDIT_NETWORK
  const originalNetworkId = process.env.FAST_AUDIT_NETWORK_ID
  const originalArchival = process.env.FAST_AUDIT_ARCHIVAL
  const originalFeeToken = process.env.FAST_AUDIT_FEE_TOKEN
  const originalApiToken = process.env.FAST_AUDIT_API_TOKEN

  beforeEach(async () => {
    await dbReady
    await resetDb()
    mockSession({ email: 'admin@test.com', role: 'admin' })
    process.env.FAST_AUDIT_CLAIMS_MODE = 'dry-run'
    delete process.env.FAST_AUDIT_RPC_URL
    delete process.env.FAST_AUDIT_SIGNER_URL
    delete process.env.FAST_AUDIT_SUBMITTER_URL
    delete process.env.FAST_AUDIT_SENDER
    delete process.env.FAST_AUDIT_PRIVATE_KEY
    delete process.env.FAST_AUDIT_PRIVATE_KEY_FILE
    delete process.env.FAST_AUDIT_NETWORK
    delete process.env.FAST_AUDIT_NETWORK_ID
    delete process.env.FAST_AUDIT_ARCHIVAL
    delete process.env.FAST_AUDIT_FEE_TOKEN
    delete process.env.FAST_AUDIT_API_TOKEN
    fastSdkMock.reset()
  })

  afterEach(() => {
    if (originalMode === undefined) delete process.env.FAST_AUDIT_CLAIMS_MODE
    else process.env.FAST_AUDIT_CLAIMS_MODE = originalMode
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalCronSecret
    if (originalRpcUrl === undefined) delete process.env.FAST_AUDIT_RPC_URL
    else process.env.FAST_AUDIT_RPC_URL = originalRpcUrl
    if (originalSignerUrl === undefined) delete process.env.FAST_AUDIT_SIGNER_URL
    else process.env.FAST_AUDIT_SIGNER_URL = originalSignerUrl
    if (originalSubmitterUrl === undefined) delete process.env.FAST_AUDIT_SUBMITTER_URL
    else process.env.FAST_AUDIT_SUBMITTER_URL = originalSubmitterUrl
    if (originalSender === undefined) delete process.env.FAST_AUDIT_SENDER
    else process.env.FAST_AUDIT_SENDER = originalSender
    if (originalPrivateKey === undefined) delete process.env.FAST_AUDIT_PRIVATE_KEY
    else process.env.FAST_AUDIT_PRIVATE_KEY = originalPrivateKey
    if (originalPrivateKeyFile === undefined) delete process.env.FAST_AUDIT_PRIVATE_KEY_FILE
    else process.env.FAST_AUDIT_PRIVATE_KEY_FILE = originalPrivateKeyFile
    if (originalNetwork === undefined) delete process.env.FAST_AUDIT_NETWORK
    else process.env.FAST_AUDIT_NETWORK = originalNetwork
    if (originalNetworkId === undefined) delete process.env.FAST_AUDIT_NETWORK_ID
    else process.env.FAST_AUDIT_NETWORK_ID = originalNetworkId
    if (originalArchival === undefined) delete process.env.FAST_AUDIT_ARCHIVAL
    else process.env.FAST_AUDIT_ARCHIVAL = originalArchival
    if (originalFeeToken === undefined) delete process.env.FAST_AUDIT_FEE_TOKEN
    else process.env.FAST_AUDIT_FEE_TOKEN = originalFeeToken
    if (originalApiToken === undefined) delete process.env.FAST_AUDIT_API_TOKEN
    else process.env.FAST_AUDIT_API_TOKEN = originalApiToken
    vi.restoreAllMocks()
  })

  it('publishes pending claims in dry-run mode and stores a receipt', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'disabled'
    await logEvent({
      type: 'obligation.created',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Created obligation',
    })

    process.env.FAST_AUDIT_CLAIMS_MODE = 'dry-run'
    expect(await enqueueMissingAuditClaims()).toEqual({ enqueued: 1 })

    const result = await publishAuditClaims()
    expect(result).toMatchObject({ mode: 'dry-run', attempted: 1, confirmed: 1, failed: 0 })

    const rows = await db.select().from(auditClaims)
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('confirmed')
    expect(rows[0].attempts).toBe(1)
    expect(rows[0].fastTxId).toMatch(/^dryrun:/)
    expect(rows[0].fastCertificate).toContain('ExternalClaim')

    const second = await publishAuditClaims()
    expect(second).toMatchObject({ attempted: 0, confirmed: 0, failed: 0 })
  })

  it('publishes a newly logged claim without waiting for the cron sweep', async () => {
    await logEvent({
      type: 'obligation.created',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Created obligation',
    })

    const [claim] = await waitForClaimStatus('confirmed')
    expect(claim.attempts).toBe(1)
    expect(claim.fastTxId).toMatch(/^dryrun:/)

    const sweep = await publishAuditClaims()
    expect(sweep).toMatchObject({ attempted: 0, confirmed: 0, failed: 0 })
  })

  it('does not publish the same claim again after id-specific publishing succeeds', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'disabled'
    await logEvent({
      type: 'obligation.created',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Created obligation',
    })

    process.env.FAST_AUDIT_CLAIMS_MODE = 'dry-run'
    await enqueueMissingAuditClaims()
    const [queued] = await db.select().from(auditClaims)

    const first = await publishAuditClaimById(queued.id)
    expect(first).toMatchObject({ attempted: 1, confirmed: 1, failed: 0, skipped: 0 })

    const second = await publishAuditClaimById(queued.id)
    expect(second).toMatchObject({ attempted: 0, confirmed: 0, failed: 0, skipped: 0 })

    const [claim] = await db.select().from(auditClaims).where(eq(auditClaims.id, queued.id))
    expect(claim.status).toBe('confirmed')
    expect(claim.attempts).toBe(1)
  })

  it('only lets one concurrent id-specific publisher claim a queued audit claim', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'disabled'
    await logEvent({
      type: 'obligation.created',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Created obligation',
    })

    process.env.FAST_AUDIT_CLAIMS_MODE = 'dry-run'
    await enqueueMissingAuditClaims()
    const [queued] = await db.select().from(auditClaims)

    const results = await Promise.all([
      publishAuditClaimById(queued.id),
      publishAuditClaimById(queued.id),
      publishAuditClaimById(queued.id),
    ])

    expect(results.filter(result => result.confirmed === 1)).toHaveLength(1)
    expect(results.filter(result => result.attempted === 0)).toHaveLength(2)

    const [claim] = await db.select().from(auditClaims).where(eq(auditClaims.id, queued.id))
    expect(claim.status).toBe('confirmed')
    expect(claim.attempts).toBe(1)
  })

  it('cron route enforces CRON_SECRET and publishes claims', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'disabled'
    await logEvent({
      type: 'agent.created',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'agent',
      entityId: 'agent_1',
      summary: 'Created agent',
    })

    process.env.FAST_AUDIT_CLAIMS_MODE = 'dry-run'
    process.env.CRON_SECRET = 'top-secret'
    const unauthorized = await publishClaimsCron(mkReq('http://localhost/api/cron/publish-audit-claims'))
    expect(unauthorized.status).toBe(401)

    const res = await publishClaimsCron(mkReq('http://localhost/api/cron/publish-audit-claims', {
      headers: { authorization: 'Bearer top-secret' },
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.backfill.enqueued).toBe(1)
    expect(body.published.confirmed).toBe(1)
  })

  it('cron route reports missing CRON_SECRET before publishing', async () => {
    await logEvent({
      type: 'agent.created',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'agent',
      entityId: 'agent_1',
      summary: 'Created agent',
    })

    delete process.env.CRON_SECRET
    const res = await publishClaimsCron(mkReq('http://localhost/api/cron/publish-audit-claims'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'CRON_SECRET is not configured' })

    const claims = await waitForClaimStatus('confirmed')
    expect(claims[0].status).toBe('confirmed')
  })

  it('cron POST publishes claims the same way as GET', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'disabled'
    await logEvent({
      type: 'agent.revoked',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'agent',
      entityId: 'agent_1',
      summary: 'Revoked agent',
    })

    process.env.FAST_AUDIT_CLAIMS_MODE = 'dry-run'
    process.env.CRON_SECRET = 'top-secret'
    const res = await postPublishClaimsCron(mkReq('http://localhost/api/cron/publish-audit-claims', {
      headers: { authorization: 'Bearer top-secret' },
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.backfill.enqueued).toBe(1)
    expect(body.published.confirmed).toBe(1)
  })

  it('cron route backfills audit rows that were missing queued claims', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'disabled'
    await logEvent({
      type: 'agent.created',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'agent',
      entityId: 'agent_1',
      summary: 'Created agent while disabled',
    })
    expect(await db.select().from(auditClaims)).toHaveLength(0)

    process.env.FAST_AUDIT_CLAIMS_MODE = 'dry-run'
    process.env.CRON_SECRET = 'top-secret'
    const res = await publishClaimsCron(mkReq('http://localhost/api/cron/publish-audit-claims', {
      headers: { authorization: 'Bearer top-secret' },
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.backfill.enqueued).toBe(1)
    expect(body.published.confirmed).toBe(1)
    const [claim] = await db.select().from(auditClaims)
    expect(claim.status).toBe('confirmed')
    expect(JSON.parse(claim.payloadJson).eventType).toBe('agent.created')
  })

  it('backfills corrupt or non-object audit JSON as null hashes instead of leaking raw data', async () => {
    await db.insert(auditLog).values([
      {
        id: 'audit_invalid_json',
        ts: '2026-05-08T00:00:00.000Z',
        eventType: 'obligation.updated',
        actor: 'admin@test.com',
        actorSource: 'sso',
        entityType: 'obligation',
        entityId: 'ob_1',
        summary: 'Updated with invalid json',
        diff: '{bad json',
        metadata: '["raw-array-value"]',
      },
    ])

    const result = await enqueueMissingAuditClaims()
    expect(result.enqueued).toBe(1)

    const [claim] = await db.select().from(auditClaims)
    const payload = JSON.parse(claim.payloadJson)
    expect(payload.diffHash).toBeNull()
    expect(payload.metadataHash).toBeNull()
    expect(claim.payloadJson).not.toContain('raw-array-value')
    expect(claim.payloadJson).not.toContain('bad json')
  })

  it('admin claims API lists payloads and certificates', async () => {
    await logEvent({
      type: 'obligation.deleted',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Deleted obligation',
    })
    await waitForClaimStatus('confirmed')

    const res = await listClaims(mkReq('http://localhost/api/audit/claims?status=confirmed'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.claims).toHaveLength(1)
    expect(body.claims[0].payloadJson.eventType).toBe('obligation.deleted')
    expect(body.claims[0].fastCertificate.mode).toBe('dry-run')

    mockSession({ email: 'viewer@test.com', role: 'viewer' })
    const forbidden = await listClaims(mkReq('http://localhost/api/audit/claims'))
    expect(forbidden.status).toBe(403)
  })

  it('records failed testnet publish attempts without losing the claim', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'testnet'
    delete process.env.FAST_AUDIT_RPC_URL
    await logEvent({
      type: 'user.role_changed',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'user',
      entityId: 'user_1',
      summary: 'Changed role',
    })

    await waitForClaimStatus('failed')
    const [claim] = await db.select().from(auditClaims).where(eq(auditClaims.status, 'failed'))
    expect(claim.attempts).toBe(1)
    expect(claim.lastError).toMatch(/FAST_AUDIT_RPC_URL/)
  })

  it('publishes through a submitter service and records returned certificates', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'testnet'
    process.env.FAST_AUDIT_SUBMITTER_URL = 'https://submitter.fastset.test/claims'
    process.env.FAST_AUDIT_SENDER = 'fast1sender'
    process.env.FAST_AUDIT_API_TOKEN = 'secret-token'

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      expect(init?.headers).toMatchObject({ authorization: 'Bearer secret-token' })
      const body = JSON.parse(String(init?.body))
      expect(body).toMatchObject({
        network: 'testnet',
        sender: 'fast1sender',
        claimDataEncoding: 'utf8-json',
      })
      expect(body.payloadHash).toMatch(/^sha256:/)
      expect(Array.isArray(body.claimData)).toBe(true)
      return Response.json({
        txId: '0xsubmitter',
        sender: 'fast1submitter',
        certificate: { accepted: true },
      })
    })

    await logEvent({
      type: 'obligation.completed',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Completed obligation',
    })

    await waitForClaimStatus('confirmed')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [claim] = await db.select().from(auditClaims).where(eq(auditClaims.status, 'confirmed'))
    expect(claim.fastTxId).toBe('0xsubmitter')
    expect(claim.fastSender).toBe('fast1submitter')
    expect(JSON.parse(claim.fastCertificate!)).toEqual({ accepted: true })
  })

  it('marks submitter responses without transaction ids as failed and retryable', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'testnet'
    process.env.FAST_AUDIT_SUBMITTER_URL = 'https://submitter.fastset.test/claims'

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ accepted: true }))

    await logEvent({
      type: 'obligation.created',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Created obligation',
    })

    await waitForClaimStatus('failed')
    let [claim] = await db.select().from(auditClaims).where(eq(auditClaims.status, 'failed'))
    expect(claim.attempts).toBe(1)
    expect(claim.lastError).toMatch(/did not include a transaction id/)

    const second = await publishAuditClaims()
    expect(second).toMatchObject({ attempted: 1, confirmed: 0, failed: 1 })
    ;[claim] = await db.select().from(auditClaims).where(eq(auditClaims.status, 'failed'))
    expect(claim.attempts).toBe(2)
  })

  it('uses submitter sender and certificate fallbacks when optional fields are omitted', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'testnet'
    process.env.FAST_AUDIT_SUBMITTER_URL = 'https://submitter.fastset.test/claims'

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
      result: {
        Success: {
          transaction_hash: [1, 2, 3],
        },
      },
    }))

    await logEvent({
      type: 'obligation.created',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Created obligation',
    })

    await waitForClaimStatus('confirmed')
    const [claim] = await db.select().from(auditClaims).where(eq(auditClaims.status, 'confirmed'))
    expect(claim.fastTxId).toBe('0x010203')
    expect(claim.fastSender).toBe('fast-submitter')
    expect(JSON.parse(claim.fastCertificate!)).toEqual({ Success: { transaction_hash: [1, 2, 3] } })
  })

  it('records HTTP and RPC errors from Fast signer/proxy calls', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'testnet'
    process.env.FAST_AUDIT_RPC_URL = 'https://proxy.fastset.test'
    process.env.FAST_AUDIT_SIGNER_URL = 'https://signer.fastset.test/sign'
    process.env.FAST_AUDIT_SENDER = 'fast1sender'

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ error: 'signer unavailable' }, { status: 503 }),
    )

    await logEvent({
      type: 'obligation.created',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Created obligation',
    })

    await waitForClaimStatus('failed')
    const [claim] = await db.select().from(auditClaims).where(eq(auditClaims.status, 'failed'))
    expect(claim.lastError).toContain('Fast request failed (503)')
  })

  it('records malformed signer responses as failed claims', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'testnet'
    process.env.FAST_AUDIT_RPC_URL = 'https://proxy.fastset.test'
    process.env.FAST_AUDIT_SIGNER_URL = 'https://signer.fastset.test/sign'
    process.env.FAST_AUDIT_SENDER = 'fast1sender'

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ transaction: { nonce: 1 } }))

    await logEvent({
      type: 'obligation.created',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Created obligation',
    })

    await waitForClaimStatus('failed')
    const [claim] = await db.select().from(auditClaims).where(eq(auditClaims.status, 'failed'))
    expect(claim.lastError).toMatch(/must include transaction and signature/)
  })

  it('records Fast RPC error payloads from proxy submission', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'testnet'
    process.env.FAST_AUDIT_RPC_URL = 'https://proxy.fastset.test'
    process.env.FAST_AUDIT_SIGNER_URL = 'https://signer.fastset.test/sign'
    process.env.FAST_AUDIT_SENDER = 'fast1sender'

    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      if (String(input) === process.env.FAST_AUDIT_SIGNER_URL) {
        return Response.json({
          transaction: { nonce: 1 },
          signature: { Signature: [1] },
        })
      }
      return Response.json({ error: { code: -32000, message: 'proxy rejected' } })
    })

    await logEvent({
      type: 'obligation.created',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Created obligation',
    })

    await waitForClaimStatus('failed')
    const [claim] = await db.select().from(auditClaims).where(eq(auditClaims.status, 'failed'))
    expect(claim.lastError).toContain('Fast RPC error')
    expect(claim.lastError).toContain('proxy rejected')
  })

  it('records proxy responses without transaction ids as failed claims', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'testnet'
    process.env.FAST_AUDIT_RPC_URL = 'https://proxy.fastset.test'
    process.env.FAST_AUDIT_SIGNER_URL = 'https://signer.fastset.test/sign'
    process.env.FAST_AUDIT_SENDER = 'fast1sender'

    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      if (String(input) === process.env.FAST_AUDIT_SIGNER_URL) {
        return Response.json({
          transaction: { nonce: 1 },
          signature: { Signature: [1] },
        })
      }
      return Response.json({ result: { Success: { accepted: true } } })
    })

    await logEvent({
      type: 'obligation.created',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Created obligation',
    })

    await waitForClaimStatus('failed')
    const [claim] = await db.select().from(auditClaims).where(eq(auditClaims.status, 'failed'))
    expect(claim.lastError).toMatch(/Fast RPC response did not include a transaction id/)
  })

  it('uses signer-provided transaction ids when proxy responses omit hashes', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'testnet'
    process.env.FAST_AUDIT_RPC_URL = 'https://proxy.fastset.test'
    process.env.FAST_AUDIT_SIGNER_URL = 'https://signer.fastset.test/sign'
    process.env.FAST_AUDIT_SENDER = 'fast1sender'

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input) === process.env.FAST_AUDIT_SIGNER_URL) {
        return Response.json({
          sender: 'fast1signed',
          txId: '0xsigned',
          transaction: { nonce: 1 },
          signature: { Signature: [1] },
        })
      }
      expect(JSON.parse(String(init?.body)).method).toBe('set_proxy_submitTransaction')
      return Response.json({ result: { Success: { accepted: true } } })
    })

    await logEvent({
      type: 'obligation.completed',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Completed obligation',
    })

    await waitForClaimStatus('confirmed')
    const [claim] = await db.select().from(auditClaims).where(eq(auditClaims.status, 'confirmed'))
    expect(claim.fastTxId).toBe('0xsigned')
    expect(claim.fastSender).toBe('fast1signed')
  })

  it('submits signed ExternalClaim transactions through the Fast proxy RPC shape', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'testnet'
    process.env.FAST_AUDIT_RPC_URL = 'https://proxy.fastset.test'
    process.env.FAST_AUDIT_SIGNER_URL = 'https://signer.fastset.test/sign'
    process.env.FAST_AUDIT_SENDER = 'fast1sender'

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      const body = JSON.parse(String(init?.body))
      if (url === process.env.FAST_AUDIT_SIGNER_URL) {
        expect(body).toMatchObject({
          sender: 'fast1sender',
          claimType: 'ExternalClaim',
          claimDataEncoding: 'utf8-json',
          archival: true,
        })
        expect(Array.isArray(body.claimData)).toBe(true)
        return Response.json({
          sender: 'fast1sender',
          transaction: {
            sender: [1],
            recipient: [2],
            nonce: 7,
            timestamp_nanos: 1,
            claim: { ExternalClaim: { claim: { claim_data: body.claimData }, signatures: [] } },
            archival: true,
          },
          signature: { Signature: [3] },
        })
      }

      expect(url).toBe(process.env.FAST_AUDIT_RPC_URL)
      expect(body.method).toBe('set_proxy_submitTransaction')
      expect(body.params).toEqual({
        transaction: expect.objectContaining({ nonce: 7 }),
        signature: { Signature: [3] },
      })
      return Response.json({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          Success: {
            envelope: body.params,
            hash: [10, 11, 12],
          },
        },
      })
    })

    await logEvent({
      type: 'obligation.completed',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Completed obligation',
    })

    await waitForClaimStatus('confirmed')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const [claim] = await db.select().from(auditClaims).where(eq(auditClaims.status, 'confirmed'))
    expect(claim.fastTxId).toBe('0x0a0b0c')
    expect(claim.fastSender).toBe('fast1sender')
    expect(claim.fastCertificate).toContain('Success')
  })

  it('signs and submits live claims with the official Fast SDK when a local private key is configured', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'testnet'
    process.env.FAST_AUDIT_PRIVATE_KEY = '0x' + '11'.repeat(32)

    await logEvent({
      type: 'obligation.completed',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Completed obligation',
    })

    await waitForClaimStatus('confirmed')

    expect(fastSdkMock.calls.privateKeys).toEqual(['0x' + '11'.repeat(32)])
    expect(fastSdkMock.calls.providerOptions).toEqual([fastSdkMock.networks.testnet])
    expect(fastSdkMock.calls.accountInfoRequests).toEqual([{ address: fastSdkMock.publicKey }])
    expect(fastSdkMock.calls.signedTypedData).toEqual([
      {
        type: 'ExternalClaimBodySchema',
        data: expect.objectContaining({
          verifier_committee: [fastSdkMock.publicKey],
          verifier_quorum: 1,
          claim_data: expect.any(Array),
        }),
      },
    ])
    expect(fastSdkMock.calls.externalClaims).toEqual([
      {
        claim: {
          verifierCommittee: [fastSdkMock.publicKey],
          verifierQuorum: 1,
          claimData: expect.any(Array),
        },
        signatures: [
          {
            verifierAddr: fastSdkMock.publicKey,
            sig: fastSdkMock.verifierSignature,
          },
        ],
      },
    ])
    expect(fastSdkMock.calls.builderOptions).toEqual([
      expect.objectContaining({
        networkId: 'fast:testnet',
        nonce: BigInt(42),
        archival: false,
        feeToken: '0xtestnetfee',
      }),
    ])

    const [claim] = await db.select().from(auditClaims).where(eq(auditClaims.status, 'confirmed'))
    expect(claim.fastTxId).toBe('0xdeadbeef')
    expect(claim.fastSender).toBe('fast1mocklocal')
  })

  it('reads local private keys from exported FAST CLI JSON and honors archival/network overrides', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'testnet'
    process.env.FAST_AUDIT_PRIVATE_KEY_FILE = '/tmp/fast-audit-test-key.json'
    process.env.FAST_AUDIT_NETWORK = 'https://custom.fast.test/proxy-rest'
    process.env.FAST_AUDIT_NETWORK_ID = 'fast:devnet'
    process.env.FAST_AUDIT_ARCHIVAL = 'true'
    process.env.FAST_AUDIT_FEE_TOKEN = '0xcustomfee'

    const { writeFile } = await import('fs/promises')
    await writeFile('/tmp/fast-audit-test-key.json', JSON.stringify({
      ok: true,
      data: { privateKey: '0x' + '22'.repeat(32), fastAddress: 'fast1file' },
    }))

    await logEvent({
      type: 'agent.revoked',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'agent',
      entityId: 'agent_1',
      summary: 'Revoked agent',
    })

    await waitForClaimStatus('confirmed')
    expect(fastSdkMock.calls.privateKeys).toEqual(['0x' + '22'.repeat(32)])
    expect(fastSdkMock.calls.providerOptions).toEqual([
      { url: 'https://custom.fast.test/proxy-rest', networkId: 'fast:devnet' },
    ])
    expect(fastSdkMock.calls.builderOptions).toEqual([
      expect.objectContaining({
        networkId: 'fast:devnet',
        archival: true,
        feeToken: '0xcustomfee',
      }),
    ])
  })

  it('reads raw local private key files and selects the mainnet SDK network', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'testnet'
    process.env.FAST_AUDIT_PRIVATE_KEY_FILE = '/tmp/fast-audit-raw-key.txt'
    process.env.FAST_AUDIT_NETWORK = 'mainnet'

    const { writeFile } = await import('fs/promises')
    await writeFile('/tmp/fast-audit-raw-key.txt', '0x' + '33'.repeat(32))

    await logEvent({
      type: 'agent.created',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'agent',
      entityId: 'agent_1',
      summary: 'Created agent',
    })

    await waitForClaimStatus('confirmed')
    expect(fastSdkMock.calls.privateKeys).toEqual(['0x' + '33'.repeat(32)])
    expect(fastSdkMock.calls.providerOptions).toEqual([fastSdkMock.networks.mainnet])
    expect(fastSdkMock.calls.builderOptions).toEqual([
      expect.objectContaining({ networkId: 'fast:mainnet', feeToken: '0xmainnetfee' }),
    ])
  })

  it('allows local SDK publishing to opt back into native fee payment', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'testnet'
    process.env.FAST_AUDIT_PRIVATE_KEY = '0x' + '55'.repeat(32)
    process.env.FAST_AUDIT_FEE_TOKEN = 'native'

    await logEvent({
      type: 'agent.created',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'agent',
      entityId: 'agent_1',
      summary: 'Created agent',
    })

    await waitForClaimStatus('confirmed')
    expect(fastSdkMock.calls.builderOptions).toEqual([
      expect.objectContaining({ networkId: 'fast:testnet', feeToken: null }),
    ])
  })

  it('fails local SDK publishing when exported private key JSON is malformed', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'testnet'
    process.env.FAST_AUDIT_PRIVATE_KEY_FILE = '/tmp/fast-audit-missing-key.json'

    const { writeFile } = await import('fs/promises')
    await writeFile('/tmp/fast-audit-missing-key.json', JSON.stringify({ ok: true, data: {} }))

    await logEvent({
      type: 'agent.created',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'agent',
      entityId: 'agent_1',
      summary: 'Created agent',
    })

    await waitForClaimStatus('failed')
    const [claim] = await db.select().from(auditClaims).where(eq(auditClaims.status, 'failed'))
    expect(claim.lastError).toMatch(/did not contain a privateKey field/)
  })

  it('fails local SDK publishing when the SDK returns no transaction id', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'testnet'
    process.env.FAST_AUDIT_PRIVATE_KEY = '0x' + '44'.repeat(32)
    fastSdkMock.setSubmitResult(null)

    await logEvent({
      type: 'obligation.completed',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Completed obligation',
    })

    await waitForClaimStatus('failed')
    const [claim] = await db.select().from(auditClaims).where(eq(auditClaims.status, 'failed'))
    expect(claim.lastError).toMatch(/Fast SDK response did not include a transaction id/)
  })

  it('recovers stale submitting claims before publishing', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'disabled'
    await logEvent({
      type: 'obligation.created',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Created obligation',
    })
    process.env.FAST_AUDIT_CLAIMS_MODE = 'dry-run'
    await enqueueMissingAuditClaims()
    const [queued] = await db.select().from(auditClaims)
    await db.update(auditClaims).set({
      status: 'submitting',
      updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    }).where(eq(auditClaims.id, queued.id))

    const result = await publishAuditClaims()
    expect(result).toMatchObject({ attempted: 1, confirmed: 1, failed: 0 })

    const [claim] = await db.select().from(auditClaims).where(eq(auditClaims.id, queued.id))
    expect(claim.status).toBe('confirmed')
    expect(claim.attempts).toBe(1)
  })

  it('does not recover fresh submitting claims that another publisher may still own', async () => {
    process.env.FAST_AUDIT_CLAIMS_MODE = 'disabled'
    await logEvent({
      type: 'obligation.created',
      actor: { email: 'admin@test.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Created obligation',
    })
    process.env.FAST_AUDIT_CLAIMS_MODE = 'dry-run'
    await enqueueMissingAuditClaims()
    const [queued] = await db.select().from(auditClaims)
    await db.update(auditClaims).set({
      status: 'submitting',
      updatedAt: new Date().toISOString(),
    }).where(eq(auditClaims.id, queued.id))

    const result = await publishAuditClaims()
    expect(result).toMatchObject({ attempted: 0, confirmed: 0, failed: 0 })

    const [claim] = await db.select().from(auditClaims).where(eq(auditClaims.id, queued.id))
    expect(claim.status).toBe('submitting')
    expect(claim.attempts).toBe(0)
  })
})
