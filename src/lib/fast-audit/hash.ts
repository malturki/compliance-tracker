import { createHash } from 'crypto'
import { canonicalize } from './canonical'

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex')
}

export function sha256Urn(input: string | Buffer): string {
  return `sha256:${sha256Hex(input)}`
}

export function hashCanonical(value: unknown): string {
  return sha256Urn(canonicalize(value))
}

export function hashText(value: string | null | undefined): string | null {
  if (value == null || value === '') return null
  return sha256Urn(value)
}

