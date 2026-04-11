/**
 * Compute a shallow `[oldValue, newValue]` diff between two objects, restricted
 * to a tracked-fields allowlist. Used by the audit log so updates record exactly
 * what changed without leaking unrelated bookkeeping fields like `updatedAt`.
 *
 * - Compares with strict `!==`, so reference equality on nested objects/arrays
 *   will appear as a "change" even if the contents are identical.
 * - `undefined` values are normalized to `null` in the output for stable JSON
 *   serialization.
 * - Returns an empty object if nothing in the allowlist changed; callers should
 *   skip writing an audit event in that case.
 */
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
