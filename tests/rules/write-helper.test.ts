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

// Browser globals the app relies on, absent or partial in Node.
const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, String(v)),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
})
Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true })

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

  it('claims a device letter and numbers orders atomically with the advance', async () => {
    const actions = await import('@/features/orders/actions')
    const letter = await actions.ensureDeviceLetter(ctx())
    expect(letter).toBe('A')

    const customer = write.createRecord(ctx(), 'customers', customerSchema, { name: 'रीना', phone: '9800000000' })
    await customer.committed
    const item = {
      garmentTypeId: 'blouse-simple', garmentName: 'ब्लाउज़ (सादा)', qty: 1, rate: 350, addOns: [],
      fabricByCustomer: true, fabricNotes: '', notes: '', measurementId: null, measurementTakenOn: null,
      measurements: {}, designPhotoUrl: null,
    }
    const draft = {
      customerId: customer.id, customerName: 'रीना', customerPhone: '9800000000', items: [item],
      orderDate: '2026-11-25', trialDate: '', deliveryDate: '2026-11-30', urgent: false, karigarId: null, notes: '',
    }

    const counter1 = await read(`shops/${shopId}/counters/device-A`)
    const first = actions.createOrder(ctx(), counter1 as never, 'GD', draft, { amount: 200, mode: 'upi' })
    const counter2 = await read(`shops/${shopId}/counters/device-A`)
    const second = actions.createOrder(ctx(), counter2 as never, 'GD', draft, null)
    expect(first.orderNumber).toMatch(/^GD\/\d{2}-\d{2}\/A001$/)
    expect(second.orderNumber).toMatch(/^GD\/\d{2}-\d{2}\/A002$/)

    await vi.waitFor(async () => expect((await read(`shops/${shopId}/orders/${second.id}`)).status).toBe('received'), { timeout: 10000 })
    expect((await read(`shops/${shopId}/counters/device-A`)).seq).toBe(2)
    expect(outboxConflictsFor(await outbox.listConflicts(), first.id)).toBe(false)

    // The advance is a real payment record linked to the order.
    const { getDocs, query, collection, where } = await import('firebase/firestore')
    const pays = await getDocs(query(collection(db, `shops/${shopId}/payments`), where('orderId', '==', first.id)))
    expect(pays.docs.map((d) => d.get('amount'))).toEqual([200])

    // Status change keeps a history entry.
    const o = await read(`shops/${shopId}/orders/${first.id}`)
    await actions.changeStatus(ctx(), o as never, 'cutting').committed
    const after = await read(`shops/${shopId}/orders/${first.id}`)
    expect(after.status).toBe('cutting')
    expect((after.statusHistory as { status: string }[]).map((h) => h.status)).toEqual(['received', 'cutting'])
  })

  it('bills an order, keeps revisions, and settles it with a payment', async () => {
    const bills = await import('@/features/bills/actions')
    const ledger = await import('@/features/bills/ledger')
    const { getDocs, collection, query, where } = await import('firebase/firestore')
    const orders = await getDocs(query(collection(db, `shops/${shopId}/orders`), where('orderNumber', '>=', '')))
    const order = orders.docs.map((d) => ({ id: d.id, ...d.data() }) as never as { id: string; orderNumber: string; customerId: string; items: unknown[] }).find((o) => o.orderNumber.endsWith('A001'))!

    const id = bills.createBillForOrder(ctx(), order as never, {
      billDate: '2026-11-26',
      lines: bills.linesFromOrder(order as never),
      discount: { type: 'flat', value: 0 },
      roundOff: true,
      notes: '',
    })
    await vi.waitFor(async () => expect((await read(`shops/${shopId}/bills/${id}`)).total).toBe(350), { timeout: 10000 })
    const v1 = await read(`shops/${shopId}/bills/${id}`)
    expect(v1.billNumber).toBe(order.orderNumber)

    await bills.reviseBill(ctx(), v1 as never, {
      billDate: '2026-11-26',
      lines: [{ name: 'ब्लाउज़ (सादा)', qty: 1, rate: 400, addOns: [] }],
      discount: { type: 'flat', value: 50 },
      roundOff: true,
      notes: '',
    }).committed
    const v2 = await read(`shops/${shopId}/bills/${id}`)
    expect(v2.total).toBe(350)
    expect(v2.revision).toBe(2)
    expect((v2.revisions as { revision: number; total: number }[]).map((r) => [r.revision, r.total])).toEqual([[1, 350]])

    // Advance (200, from the order) + payment (150) settles the bill.
    await bills.recordPayment(ctx(), {
      customerId: order.customerId, customerName: 'रीना', orderId: null, billId: id, amount: 150,
      mode: 'cash', date: '2026-11-27', kind: 'payment', note: '',
    }).committed
    const allPays = (await getDocs(collection(db, `shops/${shopId}/payments`))).docs.map((d) => ({ id: d.id, ...d.data() }))
    const allBills = (await getDocs(collection(db, `shops/${shopId}/bills`))).docs.map((d) => ({ id: d.id, ...d.data() }))
    expect(ledger.billPaid({ id, orderId: order.id }, allPays as never)).toBe(350)
    expect(ledger.customerBalance(order.customerId, allBills as never, allPays as never)).toBe(0)
  })

  it('restores from a backup (recreate, undelete, overwrite) through the real rules', async () => {
    const { writeBatch } = await import('firebase/firestore')
    const c = write.createRecord(ctx(), 'customers', customerSchema, { name: 'पुराना नाम', phone: '9000000001' })
    await c.committed
    const v1 = await read(`shops/${shopId}/customers/${c.id}`)

    // Overwrite an existing record back to its backed-up fields.
    const b1 = writeBatch(db)
    const s1 = write.stageRestore(b1, ctx(), 'customers', c.id, { name: 'बैकअप वाला नाम', phone: '9000000001' }, v1 as never, 'x')
    await write.commitTracked(b1, ctx(), s1)
    const after = await read(`shops/${shopId}/customers/${c.id}`)
    expect(after.name).toBe('बैकअप वाला नाम')
    expect(after.version).toBe(2)
    expect((await read(`shops/${shopId}/auditLogs/customers_${c.id}_v2`)).action).toBe('restoreBackup')

    // Recreate a record that no longer exists at all.
    const b2 = writeBatch(db)
    const s2 = write.stageRestore(b2, ctx(), 'customers', 'restored-1', { name: 'वापस आई', phone: '' }, null, 'x')
    await write.commitTracked(b2, ctx(), s2)
    expect((await read(`shops/${shopId}/customers/restored-1`)).version).toBe(1)
  })

  it('a second device gets a different letter', async () => {
    localStorage.removeItem(`gd.device.${shopId}`)
    const actions = await import('@/features/orders/actions')
    expect(await actions.ensureDeviceLetter(ctx())).toBe('B')
  })

  it('logs session events', async () => {
    const { id, committed } = write.logEvent(ctx(), 'login')
    await committed
    expect((await read(`shops/${shopId}/auditLogs/${id}`)).device).toBeTypeOf('string')
  })
})

function outboxConflictsFor(list: { id: string }[], id: string): boolean {
  return list.some((c) => c.id === id)
}
