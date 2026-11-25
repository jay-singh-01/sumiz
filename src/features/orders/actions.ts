import { collection, getDocsFromServer, runTransaction, waitForPendingWrites, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { describeDevice } from '@/data/device'
import type { Stored } from '@/data/types'
import { commitTracked, recordRef, stageCreate, stageUpdate, updateRecord, type WriteCtx } from '@/data/write'
import { paymentSchema, type PaymentMode } from '@/features/payments/schema'
import { toISODate } from '@/lib/dates'
import { financialYear } from '@/lib/format'
import { formatOrderNumber, nextSequence, pickFreeLetter } from './numbering'
import { deviceCounterSchema, orderSchema, type DeviceCounter, type Order, type OrderStatus } from './schema'

const letterKey = (shopId: string) => `gd.device.${shopId}`

export function getDeviceLetter(shopId: string): string | null {
  try {
    return localStorage.getItem(letterKey(shopId))
  } catch {
    return null
  }
}

/**
 * Makes sure this device has its own order-number letter. Needs the internet
 * the first time (a transaction guarantees no two devices take the same
 * letter); afterwards it's remembered on the device. Returns null if offline
 * and not yet claimed.
 */
export async function ensureDeviceLetter(ctx: WriteCtx): Promise<string | null> {
  const known = getDeviceLetter(ctx.shopId)
  if (known) return known
  if (!navigator.onLine) return null
  // Right after first-run setup the new membership may still be on its way to
  // the server; reading before it lands would be refused.
  await waitForPendingWrites(db)
  const snap = await getDocsFromServer(collection(db, 'shops', ctx.shopId, 'counters'))
  const taken = snap.docs.filter((d) => d.id.startsWith('device-')).map((d) => d.get('letter') as string)
  for (let attempt = 0; attempt < 5; attempt++) {
    const letter = pickFreeLetter(taken)
    const id = `device-${letter}`
    try {
      await runTransaction(db, async (tx) => {
        const existing = await tx.get(recordRef(ctx, 'counters', id))
        if (existing.exists()) throw new Error('taken')
        const data: DeviceCounter = { letter, deviceLabel: `${ctx.actorName} · ${describeDevice()}`, claimedBy: ctx.uid, fy: financialYear(new Date()), seq: 0 }
        stageCreate(tx, ctx, 'counters', deviceCounterSchema, data, { id, label: `${letter} · ${data.deviceLabel}` })
      })
      try {
        localStorage.setItem(letterKey(ctx.shopId), letter)
      } catch {
        // Can't remember it: we'll claim a fresh letter next time, which is still safe.
      }
      return letter
    } catch (err) {
      if ((err as Error).message !== 'taken') throw err
      taken.push(letter) // another device got there first
    }
  }
  return null
}

export type NewOrder = Omit<Order, 'orderNumber' | 'status' | 'statusHistory'>

/**
 * Creates the order, bumps this device's counter and records the advance, all
 * in one atomic audited batch. Works offline.
 */
export function createOrder(
  ctx: WriteCtx,
  counter: Stored<DeviceCounter>,
  prefix: string,
  draft: NewOrder,
  advance: { amount: number; mode: PaymentMode } | null,
): { id: string; orderNumber: string } {
  const batch = writeBatch(db)
  const now = new Date()
  const next = nextSequence(counter, now)
  const orderNumber = formatOrderNumber(prefix, next.fy, counter.letter, next.seq)
  const label = `${orderNumber} · ${draft.customerName}`

  stageUpdate(batch, ctx, 'counters', deviceCounterSchema, counter, next, { label: orderNumber })
  const order: Order = {
    ...draft,
    orderNumber,
    status: 'received',
    statusHistory: [{ status: 'received', at: now.toISOString(), by: ctx.actorName }],
  }
  const staged = stageCreate(batch, ctx, 'orders', orderSchema, order, { label })
  if (advance && advance.amount > 0) {
    stageCreate(
      batch,
      ctx,
      'payments',
      paymentSchema,
      {
        customerId: draft.customerId,
        customerName: draft.customerName,
        orderId: staged.id,
        billId: null,
        amount: advance.amount,
        mode: advance.mode,
        date: toISODate(now),
        kind: 'advance',
        note: orderNumber,
      },
      { label: `${label} · advance` },
    )
  }
  void commitTracked(batch, ctx, staged)
  return { id: staged.id, orderNumber }
}

export function changeStatus(ctx: WriteCtx, order: Stored<Order>, status: OrderStatus) {
  return updateRecord(
    ctx,
    'orders',
    orderSchema,
    order,
    { status, statusHistory: [...order.statusHistory, { status, at: new Date().toISOString(), by: ctx.actorName }] },
    { label: `${order.orderNumber} · ${order.customerName}` },
  )
}

export function updateOrder(ctx: WriteCtx, order: Stored<Order>, patch: Partial<Order>) {
  return updateRecord(ctx, 'orders', orderSchema, order, patch, { label: `${order.orderNumber} · ${order.customerName}` })
}
