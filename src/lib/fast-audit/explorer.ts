export function getFastExplorerTxUrl(network: string | null, txId: string | null) {
  if (!txId || txId.startsWith('dryrun:')) return null
  const configuredBase = process.env.FAST_AUDIT_EXPLORER_URL?.replace(/\/+$/, '')
  const defaultBase = network === 'mainnet' || network === 'fast-mainnet'
    ? 'https://explorer.fast.xyz'
    : 'https://testnet.explorer.fast.xyz'
  return `${configuredBase ?? defaultBase}/tx/${encodeURIComponent(txId)}`
}
