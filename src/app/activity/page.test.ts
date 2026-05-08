import { afterEach, describe, expect, it } from 'vitest'
import { getFastExplorerTxUrl } from '@/lib/fast-audit/explorer'

describe('getFastExplorerTxUrl', () => {
  afterEach(() => {
    delete process.env.FAST_AUDIT_EXPLORER_URL
  })

  it('builds testnet explorer links by default', () => {
    expect(getFastExplorerTxUrl('testnet', '0xabc123')).toBe(
      'https://testnet.explorer.fast.xyz/tx/0xabc123',
    )
  })

  it('builds mainnet explorer links for mainnet claims', () => {
    expect(getFastExplorerTxUrl('mainnet', '0xabc123')).toBe(
      'https://explorer.fast.xyz/tx/0xabc123',
    )
  })

  it('uses an explicitly configured explorer base URL', () => {
    process.env.FAST_AUDIT_EXPLORER_URL = 'https://explorer.example.test/'
    expect(getFastExplorerTxUrl('testnet', '0xabc123')).toBe(
      'https://explorer.example.test/tx/0xabc123',
    )
  })

  it('does not link dry-run or missing transaction ids', () => {
    expect(getFastExplorerTxUrl('testnet', 'dryrun:abc123')).toBeNull()
    expect(getFastExplorerTxUrl('testnet', null)).toBeNull()
  })
})
