import {
  collection,
  getCountFromServer,
  getDocsFromCache,
  onSnapshot,
  query,
  Timestamp,
  waitForPendingWrites,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AuditedCollection } from './collections'

/*
 * Delta sync — keeps reads far inside the free 50k/day quota.
 *
 * A plain listener on a whole collection gets re-billed for EVERY document
 * whenever it reconnects after >30 min offline (i.e. most app opens). Instead
 * each device listens only to documents updated since the newest server
 * timestamp it has already seen, and screens read the full collection from the
 * local cache (free). Soft deletes are just updates, so deletions sync too.
 */

const markerKey = (shopId: string, coll: string) => `gd.sync.${shopId}.${coll}`
// Overlap the boundary so writes sharing a timestamp are never skipped.
const OVERLAP_MS = 1000
// After this long hidden, restart listeners so their window moves forward.
const RESTART_AFTER_HIDDEN_MS = 25 * 60 * 1000

function readMarker(shopId: string, coll: string): number {
  try {
    return Number(localStorage.getItem(markerKey(shopId, coll))) || 0
  } catch {
    return 0
  }
}

function writeMarker(shopId: string, coll: string, millis: number) {
  try {
    localStorage.setItem(markerKey(shopId, coll), String(millis))
  } catch {
    // Storage blocked: we'll just sync a wider window next time.
  }
}

/** Newest server-confirmed updatedAt in a batch of docs (pending local writes have none yet). */
export function newestUpdate(docs: { updatedAt?: unknown }[], current: number): number {
  let max = current
  for (const d of docs) {
    const t = d.updatedAt
    if (t instanceof Timestamp && t.toMillis() > max) max = t.toMillis()
  }
  return max
}

export type SyncListener = (coll: AuditedCollection) => void

/** Retry delay after a listener error: 1s, 2s, 4s… capped at 60s. */
export function retryDelay(attempt: number): number {
  return Math.min(60_000, 1000 * 2 ** attempt)
}

export function startDeltaSync(shopId: string, collections: readonly AuditedCollection[], onChange: SyncListener): () => void {
  const unsubs = new Map<AuditedCollection, () => void>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let stopped = false
  let hiddenAt: number | null = null

  const listenOne = async (coll: AuditedCollection, attempt = 0) => {
    unsubs.get(coll)?.()
    let since = readMarker(shopId, coll)
    // If the browser wiped the cache but not localStorage, start over.
    if (since > 0) {
      const cached = await getDocsFromCache(collection(db, 'shops', shopId, coll)).catch(() => null)
      if (!cached || cached.empty) since = 0
    }
    if (stopped) return
    const q = query(
      collection(db, 'shops', shopId, coll),
      where('updatedAt', '>=', Timestamp.fromMillis(Math.max(0, since - OVERLAP_MS))),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        attempt = 0
        const newest = newestUpdate(
          snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => d.data({ serverTimestamps: 'none' })),
          since,
        )
        if (newest > since) {
          since = newest
          writeMarker(shopId, coll, newest)
        }
        if (!snap.metadata.fromCache || snap.docChanges().length > 0) onChange(coll)
      },
      async (err) => {
        // Typical cause: a brand-new membership that hasn't reached the server
        // yet (permission-denied), or a transient backend error. Never give up:
        // wait for our queued writes, back off, and listen again.
        console.warn(`Sync listener for ${coll} failed (attempt ${attempt + 1}), retrying`, err.code)
        await waitForPendingWrites(db).catch(() => undefined)
        if (stopped) return
        const timer = setTimeout(() => {
          timers.delete(timer)
          void listenOne(coll, attempt + 1)
        }, retryDelay(attempt))
        timers.add(timer)
      },
    )
    unsubs.set(coll, unsub)
  }

  const listenAll = () => collections.forEach((c) => void listenOne(c))

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
    } else if (hiddenAt !== null && Date.now() - hiddenAt > RESTART_AFTER_HIDDEN_MS) {
      hiddenAt = null
      listenAll()
    }
  }

  listenAll()
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    stopped = true
    document.removeEventListener('visibilitychange', onVisibility)
    timers.forEach(clearTimeout)
    unsubs.forEach((u) => u())
  }
}

/** Every document in a collection from the local cache (no billed reads). Excludes soft-deleted docs unless asked. */
export async function readAllFromCache<T>(shopId: string, coll: AuditedCollection, opts: { includeDeleted?: boolean } = {}) {
  const snap = await getDocsFromCache(collection(db, 'shops', shopId, coll))
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as T & { isDeleted?: boolean }) }))
    .filter((d) => opts.includeDeleted || !d.isDeleted)
}

/** Cheap server-side count (1 read per 1000 docs), for "is this device fully synced?" checks. */
export async function serverCount(shopId: string, coll: AuditedCollection): Promise<number> {
  const snap = await getCountFromServer(collection(db, 'shops', shopId, coll))
  return snap.data().count
}
