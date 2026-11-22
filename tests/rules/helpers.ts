import { readFileSync } from 'node:fs'
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore'

export const SHOP = 'shop1'

export async function makeEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: 'demo-gota-dhaaga',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
}

const nowSec = () => Math.floor(Date.now() / 1000)

/** Firestore client signed in as `uid` (Google account with verified email). */
export function as(env: RulesTestEnvironment, uid: string, opts: { email?: string; authTime?: number } = {}) {
  return env
    .authenticatedContext(uid, {
      email: opts.email ?? `${uid}@gmail.com`,
      email_verified: true,
      auth_time: opts.authTime ?? nowSec(),
    })
    .firestore() as unknown as Firestore
}

const seedMeta = (by: string, version = 1) => ({
  version,
  createdBy: by,
  updatedBy: by,
  createdAt: Timestamp.fromMillis(Date.now() - 60_000),
  updatedAt: Timestamp.fromMillis(Date.now() - 60_000),
  isDeleted: false,
})

/** Seeds a shop owned by "owner" with an "admin" and a "helper", bypassing rules. */
export async function seedShop(env: RulesTestEnvironment) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, `shops/${SHOP}`), { name: 'गोटा & धागा', ownerUid: 'owner', ...seedMeta('owner') })
    for (const [u, role] of [['owner', 'owner'], ['admin', 'admin'], ['helper', 'helper']] as const) {
      await setDoc(doc(db, `shops/${SHOP}/users/${u}`), { name: u, email: `${u}@gmail.com`, role, ...seedMeta('owner') })
    }
    await setDoc(doc(db, `shops/${SHOP}/customers/c1`), { name: 'रीना', phone: '9800000000', ...seedMeta('owner') })
  })
}

export async function seedDoc(env: RulesTestEnvironment, path: string, data: DocumentData) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data)
  })
}

export const createMeta = (uid: string) => ({
  version: 1,
  createdBy: uid,
  updatedBy: uid,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  isDeleted: false,
})

export const updateMeta = (uid: string, version: number) => ({
  version,
  updatedBy: uid,
  updatedAt: serverTimestamp(),
})

export const auditEntry = (uid: string, action: string, entityType: string, entityId: string) => ({
  actorUid: uid,
  actorName: uid,
  at: serverTimestamp(),
  device: 'test',
  action,
  entityType,
  entityId,
})

/**
 * Mirrors the app's write helper: business write + audit entry in one batch.
 * `merge` true for updates.
 */
export function auditedWrite(
  db: Firestore,
  opts: {
    uid: string
    shopId?: string
    coll: string
    id: string
    version: number
    data: DocumentData
    action: string
    merge?: boolean
    path?: string
    skipAudit?: boolean
  },
) {
  const shopId = opts.shopId ?? SHOP
  const batch = writeBatch(db)
  const ref = doc(db, opts.path ?? `shops/${shopId}/${opts.coll}/${opts.id}`)
  batch.set(ref, opts.data, { merge: opts.merge ?? false })
  if (!opts.skipAudit) {
    batch.set(
      doc(db, `shops/${shopId}/auditLogs/${opts.coll}_${opts.id}_v${opts.version}`),
      auditEntry(opts.uid, opts.action, opts.coll, opts.id),
    )
  }
  return batch.commit()
}
