export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  trackedFields: readonly (keyof T)[],
): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {}
  for (const key of trackedFields) {
    const b = before[key]
    const a = after[key]
    if (b !== a) {
      out[key as string] = [b ?? null, a ?? null]
    }
  }
  return out
}
