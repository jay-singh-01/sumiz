import { collection, doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import type { AuditedCollection } from './collections'
import type { Stored } from './types'

/*
 * Screens read ONLY from the local cache (`source: 'cache'`): no billed reads,
 * instant offline. The cache is kept fresh by delta sync (sync.ts), and local
 * writes show up immediately. `undefined` = still loading.
 */

export function useCollection<T>(
  shopId: string,
  coll: AuditedCollection,
  opts: { includeDeleted?: boolean } = {},
): Stored<T>[] | undefined {
  const [rows, setRows] = useState<Stored<T>[] | undefined>(undefined)
  const includeDeleted = !!opts.includeDeleted
  useEffect(
    () =>
      onSnapshot(
        collection(db, 'shops', shopId, coll),
        { source: 'cache' },
        (snap) =>
          setRows(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as T) }) as Stored<T>)
              .filter((d) => includeDeleted || !d.isDeleted),
          ),
        (err) => console.error(`useCollection(${coll})`, err),
      ),
    [shopId, coll, includeDeleted],
  )
  return rows
}

/** null = doesn't exist (yet). */
export function useDoc<T>(path: string): Stored<T> | null | undefined {
  const [row, setRow] = useState<Stored<T> | null | undefined>(undefined)
  useEffect(
    () =>
      onSnapshot(
        doc(db, path),
        { source: 'cache' },
        (snap) => setRow(snap.exists() ? ({ id: snap.id, ...(snap.data({ serverTimestamps: 'estimate' }) as T) } as Stored<T>) : null),
        (err) => console.error(`useDoc(${path})`, err),
      ),
    [path],
  )
  return row
}
