export type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | CanonicalValue[]
  | { [key: string]: CanonicalValue }

function normalize(value: unknown): CanonicalValue {
  if (value === undefined) return null
  if (value === null) return null
  if (typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) return value.map(normalize)
  if (typeof value === 'object') {
    const input = value as Record<string, unknown>
    const output: Record<string, CanonicalValue> = {}
    for (const key of Object.keys(input).sort()) {
      output[key] = normalize(input[key])
    }
    return output
  }
  return String(value)
}

export function canonicalize(value: unknown): string {
  return JSON.stringify(normalize(value))
}

