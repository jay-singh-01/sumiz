import { computeBill } from '@/features/bills/math'
import { OPEN_STATUSES, PIPELINE, type Order, type OrderItem, type OrderStatus } from './schema'

/** The next step in the pipeline, or null at the end / when cancelled. */
export function nextStatus(s: OrderStatus): OrderStatus | null {
  const i = PIPELINE.indexOf(s)
  return i === -1 || i === PIPELINE.length - 1 ? null : PIPELINE[i + 1]
}

export const isOpen = (o: Pick<Order, 'status'>) => OPEN_STATUSES.includes(o.status)

/** Promised date has passed and the clothes haven't gone home yet. */
export function isOverdue(o: Pick<Order, 'status' | 'deliveryDate'>, todayISO: string): boolean {
  return isOpen(o) && o.deliveryDate < todayISO
}

export function isDueToday(o: Pick<Order, 'status' | 'deliveryDate'>, todayISO: string): boolean {
  return isOpen(o) && o.deliveryDate === todayISO
}

/** Item and order totals (rate + add-ons, × qty) using the paise-exact bill math. */
export function itemTotal(item: Pick<OrderItem, 'qty' | 'rate' | 'addOns'>): number {
  return computeBill({ lines: [{ qty: item.qty, rate: item.rate, addOns: item.addOns }] }).total
}

export function orderTotal(o: Pick<Order, 'items'>): number {
  return computeBill({ lines: o.items.map((i) => ({ qty: i.qty, rate: i.rate, addOns: i.addOns })) }).total
}

/** Delivery date default: order date + the slowest item's usual days. */
export function defaultDeliveryDate(orderDate: Date, days: number[]): Date {
  const d = new Date(orderDate)
  d.setDate(d.getDate() + Math.max(0, ...days))
  return d
}

/** Sort for work lists: urgent first, then soonest delivery, then order number. */
export function byUrgency<T extends Pick<Order, 'urgent' | 'deliveryDate' | 'orderNumber'>>(a: T, b: T): number {
  return Number(b.urgent) - Number(a.urgent) || a.deliveryDate.localeCompare(b.deliveryDate) || a.orderNumber.localeCompare(b.orderNumber)
}
