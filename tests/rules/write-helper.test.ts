// Integration test: the app's REAL write helpers (src/data/write.ts,
// src/auth/session.ts) against the emulator and the real rules. Proves the
// client produces exactly the writes firestore.rules accepts.
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import type { User } from 'firebase/auth'
import { doc, getDoc, type Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { as, makeEnv } from './helpers.ts'

const holder = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/lib/firebase', () => ({
  get db() {
    return holder.db
  },
  auth: {},
  googleProvider: {},
}))

let env: RulesTestEnvironment
let db: Firestore
let write: typeof import('@/data/write')
let session: typeof import('@/auth/session')
let outbox: typeof import('@/data/outbox')

const customerSchema = z.object({ name: z.string().min(1), phone: z.string() })
const user = { uid: 'sumitra', email: 'sumitra@gmail.com', displayName: 'सुमित्रा' } as User

beforeAll(async () => {
  env = await makeEnv()
  await env.clearFirestore()
  db = as(env, 'sumitra')
  holder.db = db
  write = await import('@/data/write')
  session = await import('@/auth/session')
  outbox = await import('@/data/outbox')
})
afterAll(async () => {
  await env?.cleanup()
})

async function read(path: string) {
  const snap = await getDoc(doc(db, path))
  return { id: snap.id, ...snap.data() } as Record<string, unknown> & { id: string; version: number; isDeleted: boolean }
}

describe('real write helpers vs real rules', () => {
  let shopId: string
  const ctx = () => ({ shopId, uid: 'sumitra', actorName: 'सुमित्रा' })

  it('bootstraps a shop with owner membership and settings', async () => {
    shopId = session.createShop(user, { shopName: 'गोटा & धागा', ownerName: 'सुमित्रा', upiId: 'sumitra@okaxis', language: 'hi' })
    await vi.waitFor(async () => expect((await read(`shops/${shopId}/settings/main`)).upiId).toBe('sumitra@okaxis'), { timeout: 10000 })
    expect((await read(`shops/${shopId}/users/sumitra`)).role).toBe('owner')
    expect((await read(`userShops/sumitra`)).shopId).toBe(shopId)
  })

  it('seeds the Rajasthani garment list and add-ons on first run', async () => {
    await vi.waitFor(async () => expect((await read(`shops/${shopId}/garmentTypes/blouse-simple`)).nameHi).toBe('ब्लाउज़ (सादा)'), { timeout: 10000 })
    expect((await read(`shops/${shopId}/addOns/gota-patti`)).defaultRate).toBe(400)
    expect((await read(`shops/${shopId}/auditLogs/garmentTypes_rajputi-poshak_v1`)).action).toBe('create')
  })

  it('creates, updates, soft-deletes and restores with an audit trail', async () => {
    const { id, committed } = write.createRecord(ctx(), 'customers', customerSchema, { name: 'रीना', phone: '9800000000' }, { label: 'रीना' })
    await committed
    let c = await read(`shops/${shopId}/customers/${id}`)
    expect(c.version).toBe(1)

    await write.updateRecord(ctx(), 'customers', customerSchema, c as never, { phone: '9811111111' }, { label: 'रीना' }).committed
    const audit = await read(`shops/${shopId}/auditLogs/customers_${id}_v2`)
    expect(audit.action).toBe('update')
    expect(audit.changes).toEqual({ phone: { from: '9800000000', to: '9811111111' } })
    expect(audit.entityLabel).toBe('रीना')

    c = await read(`shops/${shopId}/customers/${id}`)
    await write.softDeleteRecord(ctx(), 'customers', c as never).committed
    c = await read(`shops/${shopId}/customers/${id}`)
    expect(c.isDeleted).toBe(true)
    expect(c.deletedBy).toBe('sumitra')

    await write.restoreRecord(ctx(), 'customers', c as never).committed
    c = await read(`shops/${shopId}/customers/${id}`)
    expect(c.isDeleted).toBe(false)
    expect(c.version).toBe(4)
  })

  it('rejects invalid data before it reaches Firestore', () => {
    expect(() => write.createRecord(ctx(), 'customers', customerSchema, { name: '', phone: '' })).toThrow()
  })

  it('keeps a stale edit from a second device in conflicts instead of losing it', async () => {
    const { id, committed } = write.createRecord(ctx(), 'customers', customerSchema, { name: 'सुनीता', phone: '1' })
    await committed
    const v1 = await read(`shops/${shopId}/customers/${id}`)

    await write.updateRecord(ctx(), 'customers', customerSchema, v1 as never, { phone: '2' }).committed
    // Second device still holds v1 and edits it.
    const stale = write.updateRecord(ctx(), 'customers', customerSchema, v1 as never, { phone: '3' })
    await expect(stale.committed).rejects.toThrow()

    await vi.waitFor(async () => {
      const conflicts = await outbox.listConflicts()
      expect(conflicts.some((c: { id: string; data: unknown }) => c.id === id && (c.data as { phone?: string }).phone === '3')).toBe(true)
    })
    expect((await read(`shops/${shopId}/customers/${id}`)).phone).toBe('2')
  })

  it('never writes the PIN hash into the audit log', async () => {
    const me = await read(`shops/${shopId}/users/sumitra`)
    await session.savePin(ctx(), me as never, '2580')
    await vi.waitFor(async () => expect((await read(`shops/${shopId}/users/sumitra`)).pinHash).toBeTruthy())
    const audit = await read(`shops/${shopId}/auditLogs/users_sumitra_v2`)
    expect(audit.changes).toEqual({ pinHash: { from: null, to: '•••' }, pinSalt: { from: null, to: '•••' } })
  })

  it('logs session events', async () => {
    const { id, committed } = write.logEvent(ctx(), 'login')
    await committed
    expect((await read(`shops/${shopId}/auditLogs/${id}`)).device).toBeTypeOf('string')
  })
})
