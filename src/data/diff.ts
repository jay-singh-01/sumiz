import type { FieldChange } from './types'

// Bookkeeping fields are recorded by the audit entry itself, not as changes.
const IGNORED_KEYS = new Set(['id', 'version', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'deletedBy'])

/** Order-independent serialisation so {a,b} and {b,a} compare equal. Timestamps compare by millis. */
function stable(value: unknown): string {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return `ts:${(value as { toMillis(): number }).toMillis()}`
  }
  if (value instanceof Date) return `ts:${value.getTime()}`
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  const entries = Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
  return `{${entries.join(',')}}`
}

/**
 * Field-level before → after diff for the audit log.
 * `before` null means a create: every field is recorded with `from: null`.
 * Only keys present in `after` are compared, matching Firestore update semantics.
 */
export function diffFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {}
  for (const key of Object.keys(after)) {
    if (IGNORED_KEYS.has(key)) continue
    const to = after[key] ?? null
    const from = before ? (before[key] ?? null) : null
    if (before && stable(from) === stable(to)) continue
    if (!before && to === null) continue
    changes[key] = { from, to }
  }
  return changes
}
