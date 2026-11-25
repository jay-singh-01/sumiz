import { writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Stored } from '@/data/types'
import { commitTracked, createRecord, stageCreate, stageUpdate, updateRecord, type WriteCtx } from '@/data/write'
import { formatOrderNumber, nextSequence } from '@/features/orders/numbering'
import { deviceCounterSchema, type DeviceCounter, type Order } from '@/features/orders/schema'
import { paymentSchema, type Payment } from '@/features/payments/schema'
import { computeBill } from './math'
import { billSchema, type Bill, type BillLine } from './schema'

export type BillDraft = Pick<Bill, 'billDate' | 'lines' | 'discount' | 'roundOff' | 'notes'>

export const totalOf = (d: Pick<Bill, 'lines' | 'discount' | 'roundOff'>) =>
  computeBill({ lines: d.lines, discount: d.discount, roundOff: d.roundOff }).total

/** Order items → bill lines (rates as agreed on the order; still editable). */
export function linesFromOrder(order: Pick<Order, 'items'>): BillLine[] {
  return order.items.map((i) => ({ name: i.garmentName, qty: i.qty, rate: i.rate, addOns: i.addOns.map((a) => ({ name: a.name, rate: a.rate })) }))
}

/** Bill for an order: shares the order's number. */
export function createBillForOrder(ctx: WriteCtx, order: Stored<Order>, draft: BillDraft): string {
  const data: Bill = {
    ...draft,
    billNumber: order.orderNumber,
    customerId: order.customerId,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    orderId: order.id,
    total: totalOf(draft),
    revision: 1,
    revisions: [],
  }
  return createRecord(ctx, 'bills', billSchema, data, { label: `${data.billNumber} · ${data.customerName}` }).id
}

/** Standalone bill (no order): takes the next number from this device's counter. */
export function createStandaloneBill(
  ctx: WriteCtx,
  counter: Stored<DeviceCounter>,
  prefix: string,
  customer: { id: string; name: string; phone: string },
  draft: BillDraft,
): string {
  const batch = writeBatch(db)
  const next = nextSequence(counter, new Date())
  const billNumber = formatOrderNumber(prefix, next.fy, counter.letter, next.seq)
  stageUpdate(batch, ctx, 'counters', deviceCounterSchema, counter, next, { label: billNumber })
  const data: Bill = {
    ...draft,
    billNumber,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    orderId: null,
    total: totalOf(draft),
    revision: 1,
    revisions: [],
  }
  const staged = stageCreate(batch, ctx, 'bills', billSchema, data, { label: `${billNumber} · ${customer.name}` })
  void commitTracked(batch, ctx, staged)
  return staged.id
}

/** Editing an issued bill: the old version is kept in `revisions`, viewable any time. */
export function reviseBill(ctx: WriteCtx, bill: Stored<Bill>, draft: BillDraft) {
  const snapshot = {
    revision: bill.revision,
    billDate: bill.billDate,
    lines: bill.lines,
    discount: bill.discount,
    roundOff: bill.roundOff,
    total: bill.total,
    savedAt: new Date().toISOString(),
    savedBy: ctx.actorName,
  }
  return updateRecord(
    ctx,
    'bills',
    billSchema,
    bill,
    { ...draft, total: totalOf(draft), revision: bill.revision + 1, revisions: [...bill.revisions, snapshot] },
    { label: `${bill.billNumber} · ${bill.customerName}` },
  )
}

export function recordPayment(ctx: WriteCtx, payment: Payment) {
  return createRecord(ctx, 'payments', paymentSchema, payment, {
    label: `${payment.customerName} · ₹${payment.amount}`,
  })
}
