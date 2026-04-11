// Uses Web Crypto API so this module works in both Node and Edge runtimes.
// Next.js middleware runs in Edge by default, which does not support Node's
// 'crypto' module. Web Crypto is available in both environments.

export const TOKEN_PREFIX = 'ct_live_'
const BODY_LENGTH = 44
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export function generateToken(): string {
  const bytes = new Uint8Array(BODY_LENGTH)
  crypto.getRandomValues(bytes)
  let body = ''
  for (let i = 0; i < BODY_LENGTH; i++) {
    body += BASE62[bytes[i] % BASE62.length]
  }
  return TOKEN_PREFIX + body
}

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
