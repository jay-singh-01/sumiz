import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { as, auditedWrite, auditEntry, createMeta, makeEnv, SHOP, seedDoc, seedShop, updateMeta } from './helpers.ts'

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

describe('shop bootstrap', () => {
  function bootstrap(uid: string, shopId: string, opts: { ownerUid?: string; role?: string; skipAudit?: boolean } = {}) {
    const db = as(env, uid)
    const b = writeBatch(db)
    b.set(doc(db, `shops/${shopId}`), { name: 'गोटा & धागा', ownerUid: opts.ownerUid ?? uid, ...createMeta(uid) })
    b.set(doc(db, `shops/${shopId}/users/${uid}`), { name: 'सुमित्रा', email: `${uid}@gmail.com`, role: opts.role ?? 'owner', ...createMeta(uid) })
    b.set(doc(db, `userShops/${uid}`), { shopId })
    if (!opts.skipAudit) {
      b.set(doc(db, `shops/${shopId}/auditLogs/shops_${shopId}_v1`), auditEntry(uid, 'create', 'shops', shopId))
      b.set(doc(db, `shops/${shopId}/auditLogs/users_${uid}_v1`), auditEntry(uid, 'create', 'users', uid))
    }
    return b.commit()
  }

  it('lets a new user create a shop and become its owner', async () => {
    await assertSucceeds(bootstrap('sumitra', 'newshop'))
    await assertSucceeds(getDoc(doc(as(env, 'sumitra'), 'shops/newshop')))
  })

  it('requires audit entries', async () => {
    await assertFails(bootstrap('sumitra', 'newshop', { skipAudit: true }))
  })

  it('cannot create a shop on behalf of someone else', async () => {
    await assertFails(bootstrap('sumitra', 'newshop', { ownerUid: 'other' }))
  })

  it('cannot hijack an existing shop by claiming owner', async () => {
    const db = as(env, 'stranger')
    const b = writeBatch(db)
    b.set(doc(db, `shops/${SHOP}/users/stranger`), { name: 'x', role: 'owner', ...createMeta('stranger') })
    b.set(doc(db, `shops/${SHOP}/auditLogs/users_stranger_v1`), auditEntry('stranger', 'create', 'users', 'stranger'))
    await assertFails(b.commit())
  })
})

describe('invites', () => {
  const invite = (role = 'helper', isDeleted = false) => ({ shopId: SHOP, role, isDeleted })

  function join(uid: string, email: string, role: string) {
    const db = as(env, uid, { email })
    const b = writeBatch(db)
    b.set(doc(db, `shops/${SHOP}/users/${uid}`), { name: uid, email, role, ...createMeta(uid) })
    b.set(doc(db, `userShops/${uid}`), { shopId: SHOP })
    b.set(doc(db, `shops/${SHOP}/auditLogs/users_${uid}_v1`), auditEntry(uid, 'create', 'users', uid))
    return b.commit()
  }

  it('managers can invite, helpers cannot', async () => {
    const data = { ...invite(), ...createMeta('admin') }
    await assertSucceeds(
      auditedWrite(as(env, 'admin'), { uid: 'admin', coll: 'invites', id: 'beta@gmail.com', version: 1, data, action: 'create', path: 'invites/beta@gmail.com' }),
    )
    await assertFails(
      auditedWrite(as(env, 'helper'), {
        uid: 'helper', coll: 'invites', id: 'gamma@gmail.com', version: 1, action: 'create', path: 'invites/gamma@gmail.com',
        data: { ...invite(), ...createMeta('helper') },
      }),
    )
  })

  it('nobody can invite an owner', async () => {
    await assertFails(
      auditedWrite(as(env, 'owner'), {
        uid: 'owner', coll: 'invites', id: 'beta@gmail.com', version: 1, action: 'create', path: 'invites/beta@gmail.com',
        data: { ...invite('owner'), ...createMeta('owner') },
      }),
    )
  })

  it('the invited email can join with the invited role', async () => {
    await seedDoc(env, 'invites/beta@gmail.com', invite('admin'))
    await assertSucceeds(join('beta', 'Beta@gmail.com', 'admin'))
  })

  it('a different email cannot use the invite', async () => {
    await seedDoc(env, 'invites/beta@gmail.com', invite())
    await assertFails(join('mallory', 'mallory@gmail.com', 'helper'))
  })

  it('the invited user cannot upgrade their role', async () => {
    await seedDoc(env, 'invites/beta@gmail.com', invite('helper'))
    await assertFails(join('beta', 'beta@gmail.com', 'admin'))
  })

  it('a withdrawn invite cannot be used', async () => {
    await seedDoc(env, 'invites/beta@gmail.com', invite('helper', true))
    await assertFails(join('beta', 'beta@gmail.com', 'helper'))
  })
})

describe('roles', () => {
  const roleChange = (actor: string, target: string, role: string) =>
    auditedWrite(as(env, actor), {
      uid: actor, coll: 'users', id: target, version: 2, merge: true, action: 'update',
      data: { role, ...updateMeta(actor, 2) },
    })

  it('helpers cannot promote themselves', async () => {
    await assertFails(roleChange('helper', 'helper', 'admin'))
  })

  it('admins can change a helper’s role', async () => {
    await assertSucceeds(roleChange('admin', 'helper', 'admin'))
  })

  it('nobody can mint a second owner or demote the owner', async () => {
    await assertFails(roleChange('admin', 'helper', 'owner'))
    await assertFails(roleChange('admin', 'owner', 'helper'))
  })

  it('users can change their own PIN', async () => {
    await assertSucceeds(
      auditedWrite(as(env, 'helper'), {
        uid: 'helper', coll: 'users', id: 'helper', version: 2, merge: true, action: 'update',
        data: { pinHash: 'abc', pinSalt: 'def', ...updateMeta('helper', 2) },
      }),
    )
  })

  it('users cannot edit another user’s PIN unless manager', async () => {
    await assertFails(
      auditedWrite(as(env, 'helper'), {
        uid: 'helper', coll: 'users', id: 'admin', version: 2, merge: true, action: 'update',
        data: { pinHash: 'abc', ...updateMeta('helper', 2) },
      }),
    )
  })

  it('a removed (soft-deleted) user loses access', async () => {
    await auditedWrite(as(env, 'owner'), {
      uid: 'owner', coll: 'users', id: 'helper', version: 2, merge: true, action: 'delete',
      data: { isDeleted: true, deletedBy: 'owner', deletedAt: serverTimestamp(), ...updateMeta('owner', 2) },
    })
    await assertFails(getDoc(doc(as(env, 'helper'), `shops/${SHOP}/customers/c1`)))
  })
})

describe('sign out of all devices', () => {
  it('lets a user revoke their own sessions with the server time only', async () => {
    await assertSucceeds(
      auditedWrite(as(env, 'owner'), {
        uid: 'owner', coll: 'users', id: 'owner', version: 2, merge: true, action: 'update',
        data: { revokedBefore: serverTimestamp(), ...updateMeta('owner', 2) },
      }),
    )
    await assertFails(
      auditedWrite(as(env, 'admin'), {
        uid: 'admin', coll: 'users', id: 'admin', version: 2, merge: true, action: 'update',
        data: { revokedBefore: Timestamp.fromMillis(Date.now() + 86_400_000), ...updateMeta('admin', 2) },
      }),
    )
  })

  it('locks out sessions that signed in before the revocation', async () => {
    await seedDoc(env, `shops/${SHOP}/users/owner`, {
      name: 'owner', role: 'owner', version: 2, createdBy: 'owner', updatedBy: 'owner',
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(), isDeleted: false,
      revokedBefore: Timestamp.fromMillis(Date.now() - 1000),
    })
    const oldSession = as(env, 'owner', { authTime: Math.floor(Date.now() / 1000) - 3600 })
    const newSession = as(env, 'owner', { authTime: Math.floor(Date.now() / 1000) + 1 })
    await assertFails(getDoc(doc(oldSession, `shops/${SHOP}/customers/c1`)))
    await assertSucceeds(getDoc(doc(newSession, `shops/${SHOP}/customers/c1`)))
  })
})

describe('userShops pointer', () => {
  it('can point only at a shop you belong to', async () => {
    const helper = as(env, 'helper')
    const b1 = writeBatch(helper)
    b1.set(doc(helper, 'userShops/helper'), { shopId: SHOP })
    await assertSucceeds(b1.commit())

    const stranger = as(env, 'stranger')
    const b2 = writeBatch(stranger)
    b2.set(doc(stranger, 'userShops/stranger'), { shopId: SHOP })
    await assertFails(b2.commit())
  })

  it('is private to its user', async () => {
    await seedDoc(env, 'userShops/helper', { shopId: SHOP })
    await assertFails(getDoc(doc(as(env, 'owner'), 'userShops/helper')))
  })
})
