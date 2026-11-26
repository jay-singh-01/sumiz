import { collection, getDocs, getDocsFromCache, orderBy, query, Timestamp, where, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { BACKUP_COLLECTIONS, buildBackup, fromJson, type Backup, type PlanItem } from './backup'
import type { AuditedCollection } from './collections'
import type { Meta } from './types'
import { commitTracked, logEvent, stageRestore, type WriteCtx } from './write'

const LAST_BACKUP_KEY = 'gd.lastBackup'

export function lastBackupAt(): number | null {
  try {
    return Number(localStorage.getItem(LAST_BACKUP_KEY)) || null
  } catch {
    return null
  }
}

/** Show the monthly "download a backup" banner after 30 days without one on this device. */
export function backupDue(now = Date.now()): boolean {
  const last = lastBackupAt()
  return last === null || now - last > 30 * 86_400_000
}

/**
 * Collects a full backup. Business records come from the local cache (free,
 * works offline). The audit log isn't cached, so the last 30 days are read
 * from the server when online; the nightly GitHub backup keeps the full log.
 */
export async function collectBackup(ctx: WriteCtx): Promise<Backup> {
  const data: Record<string, { id: string }[]> = {}
  for (const coll of BACKUP_COLLECTIONS) {
    if (coll === 'auditLogs') continue
    const snap = await getDocsFromCache(collection(db, 'shops', ctx.shopId, coll)).catch(() => null)
    data[coll] = snap ? snap.docs.map((d) => ({ id: d.id, ...d.data() })) : []
  }
  if (navigator.onLine) {
    const since = Timestamp.fromMillis(Date.now() - 30 * 86_400_000)
    const snap = await getDocs(query(collection(db, 'shops', ctx.shopId, 'auditLogs'), where('at', '>=', since), orderBy('at', 'desc'))).catch(() => null)
    if (snap) data.auditLogs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }
  return buildBackup(ctx.shopId, 'app', data)
}

export function markBackedUp(ctx: WriteCtx, note: string) {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()))
  } catch {
    // Banner will simply reappear.
  }
  logEvent(ctx, 'backup', { entityType: 'shop', entityId: ctx.shopId, note })
}

/** Current records (including deleted) per restorable collection, for the dry run. */
export async function currentState(shopId: string, colls: readonly string[]) {
  const out: Record<string, (Meta & { id: string; [k: string]: unknown })[]> = {}
  for (const coll of colls) {
    const snap = await getDocsFromCache(collection(db, 'shops', shopId, coll)).catch(() => null)
    out[coll] = snap ? snap.docs.map((d) => ({ id: d.id, ...(d.data() as Meta) })) : []
  }
  return out
}

const BATCH_ITEMS = 200 // 2 writes each (record + audit) under Firestore's 500 limit

/** Applies a dry-run plan. Every write is versioned and audited like any other. */
export async function applyRestore(ctx: WriteCtx, items: PlanItem[], current: Record<string, (Meta & { id: string })[]>, onProgress?: (done: number) => void) {
  const curMap = new Map(Object.entries(current).flatMap(([coll, docs]) => docs.map((d) => [`${coll}/${d.id}`, d] as const)))
  let done = 0
  for (let i = 0; i < items.length; i += BATCH_ITEMS) {
    const chunk = items.slice(i, i + BATCH_ITEMS)
    const batch = writeBatch(db)
    let last = null as ReturnType<typeof stageRestore> | null
    for (const it of chunk) {
      const { id: _id, version: _v, createdAt: _ca, createdBy: _cb, updatedAt: _ua, updatedBy: _ub, isDeleted: _d, deletedAt: _da, deletedBy: _db, ...fields } = fromJson(
        it.data,
        (ms) => Timestamp.fromMillis(ms),
      ) as Record<string, unknown>
      const cur = it.action === 'create' ? null : (curMap.get(`${it.coll}/${it.id}`) ?? null)
      const label = (fields.name ?? fields.customerName ?? fields.orderNumber ?? fields.billNumber ?? fields.nameHi ?? it.id) as string
      last = stageRestore(batch, ctx, it.coll as AuditedCollection, it.id, fields, cur, String(label))
    }
    if (last) await commitTracked(batch, ctx, last)
    done += chunk.length
    onProgress?.(done)
  }
  logEvent(ctx, 'restoreBackup', { entityType: 'shop', entityId: ctx.shopId, note: `${items.length} रिकॉर्ड` })
}

/** Reads a backup file; .gz files (nightly backups) are decompressed in the browser. */
export async function readBackupFile(file: File): Promise<string> {
  if (file.name.endsWith('.gz')) {
    const stream = file.stream().pipeThrough(new DecompressionStream('gzip'))
    return new Response(stream).text()
  }
  return file.text()
}
