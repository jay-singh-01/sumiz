/*
 * Backup file format, shared by the in-app download, the nightly GitHub
 * Actions export (scripts/backup) and the restore screen, so any backup can be
 * restored from the app.
 *
 *   { format: "gota-dhaaga-backup", version: 1, shopId, exportedAt, source,
 *     collections: { customers: [{ id, ...fields }], orders: [...], ... } }
 *
 * Firestore Timestamps are stored as { "__ts": <milliseconds> }.
 */
import { z } from 'zod'

export const BACKUP_FORMAT = 'gota-dhaaga-backup'
export const BACKUP_VERSION = 1

/** Everything a backup contains. */
export const BACKUP_COLLECTIONS = [
  'customers',
  'measurements',
  'orders',
  'bills',
  'payments',
  'reminders',
  'expenses',
  'karigars',
  'garmentTypes',
  'addOns',
  'settings',
  'counters',
  'users',
  'auditLogs',
] as const

/** What a restore may write back. Users and the audit log are never overwritten. */
export const RESTORABLE = BACKUP_COLLECTIONS.filter((c) => c !== 'users' && c !== 'auditLogs')

/** Never overwritten from a backup: rolling a device counter back could reissue order numbers. */
export const CREATE_ONLY = new Set(['counters'])

/** Fields never written into a backup file. */
const SECRET_FIELDS = new Set(['pinHash', 'pinSalt'])

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json }

interface TimestampLike {
  toMillis(): number
}
const isTimestamp = (v: unknown): v is TimestampLike => typeof v === 'object' && v !== null && typeof (v as TimestampLike).toMillis === 'function'

/** Firestore value → JSON (Timestamps become { __ts }). */
export function toJson(value: unknown): Json {
  if (value === undefined || value === null) return null
  if (isTimestamp(value)) return { __ts: value.toMillis() }
  if (value instanceof Date) return { __ts: value.getTime() }
  if (Array.isArray(value)) return value.map(toJson)
  if (typeof value === 'object') {
    const out: Record<string, Json> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!SECRET_FIELDS.has(k)) out[k] = toJson(v)
    }
    return out
  }
  return value as Json
}

/** JSON → plain values, converting { __ts } with the given Timestamp factory. */
export function fromJson<T>(value: Json, makeTs: (ms: number) => T): unknown {
  if (Array.isArray(value)) return value.map((v) => fromJson(v, makeTs))
  if (value && typeof value === 'object') {
    const keys = Object.keys(value)
    if (keys.length === 1 && keys[0] === '__ts' && typeof value.__ts === 'number') return makeTs(value.__ts)
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromJson(v, makeTs)]))
  }
  return value
}

export interface BackupDoc {
  id: string
  [field: string]: Json
}

export interface Backup {
  format: typeof BACKUP_FORMAT
  version: number
  shopId: string
  exportedAt: string
  source: 'app' | 'nightly'
  collections: Partial<Record<(typeof BACKUP_COLLECTIONS)[number], BackupDoc[]>>
}

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1).max(BACKUP_VERSION),
  shopId: z.string().min(1),
  exportedAt: z.string(),
  source: z.enum(['app', 'nightly']),
  collections: z.record(z.string(), z.array(z.looseObject({ id: z.string().min(1) }))),
})

export function buildBackup(shopId: string, source: Backup['source'], data: Partial<Record<string, { id: string; [k: string]: unknown }[]>>, now = new Date()): Backup {
  const collections: Backup['collections'] = {}
  for (const name of BACKUP_COLLECTIONS) {
    const docs = data[name]
    if (docs) collections[name] = docs.map(({ id, ...rest }) => ({ id, ...(toJson(rest) as Record<string, Json>) }))
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, shopId, exportedAt: now.toISOString(), source, collections }
}

/** Parses and validates a backup file's text. Throws a readable error. */
export function parseBackup(text: string): Backup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('not-json')
  }
  const r = backupSchema.safeParse(raw)
  if (!r.success) throw new Error('not-backup')
  return r.data as Backup
}

export type RestoreMode = 'missing' | 'overwrite'

export interface PlanItem {
  coll: string
  id: string
  action: 'create' | 'undelete' | 'overwrite'
  data: BackupDoc
}

export interface RestorePlan {
  items: PlanItem[]
  summary: Record<string, { create: number; undelete: number; overwrite: number; unchanged: number; keptNewer: number }>
}

interface CurrentDoc {
  id: string
  version?: number
  isDeleted?: boolean
  [k: string]: unknown
}

const META = new Set(['version', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'isDeleted', 'deletedAt', 'deletedBy', 'restoredFrom'])
function sameContent(a: Record<string, Json>, b: Record<string, Json>): boolean {
  const strip = (o: Record<string, Json>) => Object.keys(o).filter((k) => !META.has(k) && k !== 'id').sort()
  const ka = strip(a)
  const kb = strip(b)
  if (ka.join() !== kb.join()) return false
  return ka.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]))
}

/**
 * Dry run: what a restore would do, without writing anything.
 *  - "missing": bring back records that are gone or deleted; touch nothing else.
 *  - "overwrite": additionally put changed records back to their backup state.
 * Records created after the backup are never touched in either mode.
 */
export function planRestore(backup: Backup, current: Record<string, CurrentDoc[]>, mode: RestoreMode): RestorePlan {
  const items: PlanItem[] = []
  const summary: RestorePlan['summary'] = {}
  for (const coll of RESTORABLE) {
    const docs = backup.collections[coll] ?? []
    const now = new Map((current[coll] ?? []).map((d) => [d.id, d]))
    const s = { create: 0, undelete: 0, overwrite: 0, unchanged: 0, keptNewer: 0 }
    for (const d of docs) {
      if (d.isDeleted === true) continue // deleted in the backup: nothing to bring back
      const cur = now.get(d.id)
      if (!cur) {
        items.push({ coll, id: d.id, action: 'create', data: d })
        s.create++
      } else if (cur.isDeleted) {
        items.push({ coll, id: d.id, action: 'undelete', data: d })
        s.undelete++
      } else if (sameContent(toJson(cur) as Record<string, Json>, d)) {
        s.unchanged++
      } else if (mode === 'overwrite' && !CREATE_ONLY.has(coll)) {
        items.push({ coll, id: d.id, action: 'overwrite', data: d })
        s.overwrite++
      } else {
        s.keptNewer++
      }
    }
    if (docs.length) summary[coll] = s
  }
  return { items, summary }
}
