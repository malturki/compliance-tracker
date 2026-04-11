import { randomBytes, createHash } from 'crypto'

export const TOKEN_PREFIX = 'ct_live_'
const BODY_LENGTH = 44
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export function generateToken(): string {
  const bytes = randomBytes(BODY_LENGTH)
  let body = ''
  for (let i = 0; i < BODY_LENGTH; i++) {
    body += BASE62[bytes[i] % BASE62.length]
  }
  return TOKEN_PREFIX + body
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
