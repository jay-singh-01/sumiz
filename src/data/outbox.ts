import { createStore, del, entries, set } from 'idb-keyval'
import { doc, getDocFromServer, waitForPendingWrites, type Firestore } from 'firebase/firestore'
import type { AuditAction } from './types'

/*
 * Safety net under Firestore's own offline queue.
 *
 * Firestore applies writes to the local cache instantly and syncs later. If the
 * server later *rejects* a write (e.g. another device edited the same record
 * first, so the version check in firestore.rules fails), Firestore silently
 * rolls the local change back. That would lose work. So every write is also
 * recorded here; when the server acknowledges it the entry is removed, and if
 * it's rejected, it's moved to the conflicts store for review instead of being
 * dropped. Entries left over from a previous session (app killed while offline)
 * are verified against the server on the next start.
 */

export interface OutboxEntry {
  key: string
  shopId: string
  uid: string
  coll: string
  id: string
  action: AuditAction
  auditDocId: string
  data: unknown
  queuedAt: number
}

export interface ConflictEntry extends OutboxEntry {
  error: string
  failedAt: number
}

const outboxStore = createStore('gd-outbox', 'entries')
const conflictStore = createStore('gd-conflicts', 'entries')

let pending = 0
let conflictTick = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export const getPendingCount = () => pending
export const getConflictTick = () => conflictTick

// Writes queued in an earlier session (app closed while offline) live in
// Firestore's own queue; we can't count them, but we know when they're flushed.
let flushingLeftovers = false
export const isFlushingLeftovers = () => flushingLeftovers

export function watchLeftoverWrites(db: Firestore): void {
  void entries(outboxStore).then((list) => {
    if (list.length === 0) return
    flushingLeftovers = true
    emit()
    void waitForPendingWrites(db).finally(() => {
      flushingLeftovers = false
      emit()
    })
  })
}

/** JSON-safe copy for IndexedDB (drops Firestore sentinels' internals, keeps the user's data). */
function snapshot(data: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(data ?? null))
  } catch {
    return String(data)
  }
}

async function moveToConflicts(entry: OutboxEntry, error: string) {
  await set(entry.key, { ...entry, error, failedAt: Date.now() } satisfies ConflictEntry, conflictStore)
  await del(entry.key, outboxStore)
  conflictTick++
  emit()
}

/** Record a write and watch its server acknowledgement. Never throws. */
export function trackCommit(entry: Omit<OutboxEntry, 'queuedAt' | 'data'> & { data: unknown }, commit: Promise<void>): void {
  const full: OutboxEntry = { ...entry, data: snapshot(entry.data), queuedAt: Date.now() }
  const saved = set(full.key, full, outboxStore).catch(() => undefined)
  pending++
  emit()
  commit
    .then(
      async () => {
        await saved
        await del(full.key, outboxStore)
      },
      async (err: unknown) => {
        await saved
        const code = (err as { code?: string })?.code ?? String(err)
        console.error('Write rejected by server; kept in conflicts', full, err)
        await moveToConflicts(full, code)
      },
    )
    .catch((err) => console.error('Outbox bookkeeping failed', err))
    .finally(() => {
      pending--
      emit()
    })
}

/**
 * Verify writes left over from a previous session. Waits until Firestore has
 * flushed its own queue (i.e. we're online), then checks each write's audit
 * entry on the server: present → it landed; missing → it was rejected.
 */
export async function reconcileOutbox(db: Firestore): Promise<void> {
  const leftovers = (await entries<string, OutboxEntry>(outboxStore)).map(([, e]) => e)
  if (leftovers.length === 0) return
  await waitForPendingWrites(db)
  for (const entry of leftovers) {
    try {
      const audit = await getDocFromServer(doc(db, `shops/${entry.shopId}/auditLogs/${entry.auditDocId}`))
      if (audit.exists() && audit.get('actorUid') === entry.uid) {
        await del(entry.key, outboxStore)
      } else {
        await moveToConflicts(entry, 'not-applied')
      }
    } catch (err) {
      // Offline again or transient error: try on the next start.
      console.warn('Outbox reconcile deferred', err)
      return
    }
  }
}

export async function listConflicts(): Promise<ConflictEntry[]> {
  return (await entries<string, ConflictEntry>(conflictStore)).map(([, e]) => e).sort((a, b) => b.failedAt - a.failedAt)
}

export async function dismissConflict(key: string): Promise<void> {
  await del(key, conflictStore)
  conflictTick++
  emit()
}
