import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, getDocs, collection, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { as, auditedWrite, auditEntry, createMeta, makeEnv, SHOP, seedShop, updateMeta } from './helpers.ts'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await makeEnv()
})
afterAll(async () => {
  await env?.cleanup()
})
beforeEach(async () => {
  await env.clearFirestore()
  await seedShop(env)
})

describe('shop scoping', () => {
  it('lets members read their shop data', async () => {
    await assertSucceeds(getDoc(doc(as(env, 'helper'), `shops/${SHOP}/customers/c1`)))
    await assertSucceeds(getDocs(collection(as(env, 'owner'), `shops/${SHOP}/customers`)))
  })

  it('blocks outsiders and anonymous users', async () => {
    await assertFails(getDoc(doc(as(env, 'stranger'), `shops/${SHOP}/customers/c1`)))
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), `shops/${SHOP}/customers/c1`)))
  })

  it('blocks unknown collections', async () => {
    await assertFails(setDoc(doc(as(env, 'owner'), `shops/${SHOP}/secrets/x`), { a: 1 }))
  })
})

describe('audited creates', () => {
  const customer = (uid: string) => ({ name: 'सुनीता', phone: '9811111111', ...createMeta(uid) })

  it('accepts a create with its audit entry in the same batch', async () => {
    await assertSucceeds(
      auditedWrite(as(env, 'helper'), { uid: 'helper', coll: 'customers', id: 'c2', version: 1, data: customer('helper'), action: 'create' }),
    )
  })

  it('rejects a create without an audit entry', async () => {
    await assertFails(
      auditedWrite(as(env, 'helper'), { uid: 'helper', coll: 'customers', id: 'c2', version: 1, data: customer('helper'), action: 'create', skipAudit: true }),
    )
  })

  it('rejects a create that starts at the wrong version', async () => {
    await assertFails(
      auditedWrite(as(env, 'helper'), { uid: 'helper', coll: 'customers', id: 'c2', version: 1, data: { ...customer('helper'), version: 2 }, action: 'create' }),
    )
  })

  it('rejects forged authorship', async () => {
    await assertFails(
      auditedWrite(as(env, 'helper'), { uid: 'helper', coll: 'customers', id: 'c2', version: 1, data: customer('owner'), action: 'create' }),
    )
  })

  it('rejects a client-supplied createdAt', async () => {
    await assertFails(
      auditedWrite(as(env, 'helper'), {
        uid: 'helper', coll: 'customers', id: 'c2', version: 1, action: 'create',
        data: { ...customer('helper'), createdAt: new Date(2020, 0, 1) },
      }),
    )
  })
})

describe('versioned updates', () => {
  it('accepts version + 1 with an audit entry', async () => {
    await assertSucceeds(
      auditedWrite(as(env, 'owner'), {
        uid: 'owner', coll: 'customers', id: 'c1', version: 2, merge: true, action: 'update',
        data: { phone: '9822222222', ...updateMeta('owner', 2) },
      }),
    )
  })

  it('rejects a stale write from a second device (same version twice)', async () => {
    const db = as(env, 'owner')
    await assertSucceeds(
      auditedWrite(db, { uid: 'owner', coll: 'customers', id: 'c1', version: 2, merge: true, action: 'update', data: { phone: '1', ...updateMeta('owner', 2) } }),
    )
    await assertFails(
      auditedWrite(as(env, 'admin'), { uid: 'admin', coll: 'customers', id: 'c1', version: 2, merge: true, action: 'update', data: { phone: '2', ...updateMeta('admin', 2) } }),
    )
  })

  it('rejects skipping a version', async () => {
    await assertFails(
      auditedWrite(as(env, 'owner'), { uid: 'owner', coll: 'customers', id: 'c1', version: 3, merge: true, action: 'update', data: { phone: '1', ...updateMeta('owner', 3) } }),
    )
  })

  it('rejects rewriting creation metadata', async () => {
    await assertFails(
      auditedWrite(as(env, 'owner'), {
        uid: 'owner', coll: 'customers', id: 'c1', version: 2, merge: true, action: 'update',
        data: { createdBy: 'owner2', ...updateMeta('owner', 2) },
      }),
    )
  })

  it('rejects a plain update with no audit entry', async () => {
    await assertFails(updateDoc(doc(as(env, 'owner'), `shops/${SHOP}/customers/c1`), { phone: '1', ...updateMeta('owner', 2) }))
  })
})

describe('no hard deletes', () => {
  it('denies delete to everyone, even the owner', async () => {
    for (const u of ['owner', 'admin', 'helper']) {
      await assertFails(deleteDoc(doc(as(env, u), `shops/${SHOP}/customers/c1`)))
    }
  })

  it('allows a soft delete that records who and when', async () => {
    await assertSucceeds(
      auditedWrite(as(env, 'owner'), {
        uid: 'owner', coll: 'customers', id: 'c1', version: 2, merge: true, action: 'delete',
        data: { isDeleted: true, deletedBy: 'owner', deletedAt: serverTimestamp(), ...updateMeta('owner', 2) },
      }),
    )
  })

  it('rejects a soft delete with no deletedBy', async () => {
    await assertFails(
      auditedWrite(as(env, 'owner'), {
        uid: 'owner', coll: 'customers', id: 'c1', version: 2, merge: true, action: 'delete',
        data: { isDeleted: true, ...updateMeta('owner', 2) },
      }),
    )
  })

  it('allows restoring from the recycle bin', async () => {
    const db = as(env, 'owner')
    await auditedWrite(db, {
      uid: 'owner', coll: 'customers', id: 'c1', version: 2, merge: true, action: 'delete',
      data: { isDeleted: true, deletedBy: 'owner', deletedAt: serverTimestamp(), ...updateMeta('owner', 2) },
    })
    await assertSucceeds(
      auditedWrite(db, { uid: 'owner', coll: 'customers', id: 'c1', version: 3, merge: true, action: 'restore', data: { isDeleted: false, ...updateMeta('owner', 3) } }),
    )
  })
})

describe('append-only audit log', () => {
  const logPath = `shops/${SHOP}/auditLogs/evt1`

  it('allows members to append events', async () => {
    await assertSucceeds(setDoc(doc(as(env, 'helper'), logPath), auditEntry('helper', 'login', 'session', 'helper')))
  })

  it('denies update and delete of entries', async () => {
    const db = as(env, 'owner')
    await setDoc(doc(db, logPath), auditEntry('owner', 'login', 'session', 'owner'))
    await assertFails(updateDoc(doc(db, logPath), { note: 'tampered' }))
    await assertFails(deleteDoc(doc(db, logPath)))
  })

  it('denies entries written in someone else’s name', async () => {
    await assertFails(setDoc(doc(as(env, 'helper'), logPath), auditEntry('owner', 'login', 'session', 'owner')))
  })

  it('denies outsiders', async () => {
    await assertFails(setDoc(doc(as(env, 'stranger'), logPath), auditEntry('stranger', 'login', 'session', 'stranger')))
    await assertFails(getDoc(doc(as(env, 'stranger'), logPath)))
  })

  it('denies unexpected fields and actions', async () => {
    await assertFails(setDoc(doc(as(env, 'owner'), logPath), { ...auditEntry('owner', 'login', 'session', 'owner'), extra: 1 }))
    await assertFails(setDoc(doc(as(env, 'owner'), logPath), auditEntry('owner', 'nuke', 'session', 'owner')))
  })
})

describe('helper role limits', () => {
  const garment = (uid: string) => ({ nameHi: 'ब्लाउज़', nameEn: 'Blouse', defaultRate: 300, measurementFields: [], active: true, ...createMeta(uid) })

  it('helpers cannot create or edit rates', async () => {
    await assertFails(
      auditedWrite(as(env, 'helper'), { uid: 'helper', coll: 'garmentTypes', id: 'g1', version: 1, data: garment('helper'), action: 'create' }),
    )
  })

  it('owner and admin can', async () => {
    await assertSucceeds(
      auditedWrite(as(env, 'admin'), { uid: 'admin', coll: 'garmentTypes', id: 'g1', version: 1, data: garment('admin'), action: 'create' }),
    )
  })
})

describe('field validation', () => {
  const create = (coll: string, data: Record<string, unknown>) =>
    auditedWrite(as(env, 'owner'), { uid: 'owner', coll, id: 'x1', version: 1, data: { ...data, ...createMeta('owner') }, action: 'create' })

  it('requires a customer name', async () => {
    await assertFails(create('customers', { name: '', phone: '' }))
    await assertFails(create('customers', { phone: '9829012345' }))
    await assertSucceeds(create('customers', { name: 'रीना', phone: '9829012345', tags: ['vip'] }))
  })

  it('rejects wrongly-typed customer fields', async () => {
    await assertFails(create('customers', { name: 'रीना', phone: 9829012345 }))
    await assertFails(create('customers', { name: 'रीना', tags: 'vip' }))
  })

  it('validates measurements', async () => {
    await assertFails(create('measurements', { customerId: 'c1', garmentTypeId: 'g1', values: 'bad', takenOn: '2026-11-21' }))
    await assertSucceeds(create('measurements', { customerId: 'c1', garmentTypeId: 'g1', values: { bust: '34' }, takenOn: '2026-11-21' }))
  })

  it('rejects negative rates', async () => {
    await assertFails(create('garmentTypes', { nameHi: 'कुर्ती', defaultRate: -1, measurementFields: [], active: true }))
    await assertFails(create('addOns', { nameHi: 'अस्तर', defaultRate: -5, active: true }))
    await assertSucceeds(create('addOns', { nameHi: 'अस्तर', defaultRate: 120, active: true }))
  })

  it('validates updates too', async () => {
    await assertFails(
      auditedWrite(as(env, 'owner'), {
        uid: 'owner', coll: 'customers', id: 'c1', version: 2, merge: true, action: 'update',
        data: { name: '', ...updateMeta('owner', 2) },
      }),
    )
  })
})
