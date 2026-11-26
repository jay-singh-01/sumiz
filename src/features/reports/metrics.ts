/*
 * Business-summary metrics, computed from the local cache (no server reads).
 * Pure functions over plain records so every number on the dashboard is
 * unit-tested. Money in integer paise internally.
 */
import { billPaid, daysBetween, oldestDueDate, type LedgerBill, type LedgerPayment } from '@/features/bills/ledger'
import { itemTotal, orderTotal } from '@/features/orders/logic'
import { OPEN_STATUSES, PIPELINE, type Order, type OrderStatus } from '@/features/orders/schema'
import { financialYear } from '@/lib/format'
import { fromISODate, toISODate } from '@/lib/dates'

export type Preset = 'today' | 'week' | 'month' | 'fy' | 'custom'
export interface Range {
  from: string
  to: string
}

const p = (r: number) => Math.round(r * 100)
const r = (paise: number) => paise / 100
const inRange = (iso: string, range: Range) => iso >= range.from && iso <= range.to

/** Date range for a preset. Week starts Monday; FY starts 1 April. */
export function presetRange(preset: Exclude<Preset, 'custom'>, today: Date): Range {
  const to = toISODate(today)
  if (preset === 'today') return { from: to, to }
  if (preset === 'week') {
    const d = new Date(today)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return { from: toISODate(d), to }
  }
  if (preset === 'month') return { from: toISODate(new Date(today.getFullYear(), today.getMonth(), 1)), to }
  const startYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
  return { from: toISODate(new Date(startYear, 3, 1)), to }
}

export interface Filters {
  range: Range
  garmentTypeId?: string
  area?: string
  mode?: string
}

type O = Pick<Order, 'customerId' | 'orderDate' | 'deliveryDate' | 'status' | 'statusHistory' | 'items' | 'urgent'> & { id: string; isDeleted?: boolean }
type B = LedgerBill
type P = LedgerPayment & { mode: string }
type C = { id: string; area?: string; name: string; createdAt?: { toMillis(): number } | null; isDeleted?: boolean }

const live = <T extends { isDeleted?: boolean }>(xs: T[]) => xs.filter((x) => !x.isDeleted)

/** Applies the global filter bar to orders, bills and payments. */
export function applyFilters<TO extends O, TB extends B, TP extends P>(
  data: { orders: TO[]; bills: TB[]; payments: TP[]; customers: C[] },
  f: Filters,
): { orders: TO[]; bills: TB[]; payments: TP[] } {
  const areaOf = new Map(data.customers.map((c) => [c.id, (c.area ?? '').trim()]))
  const areaOk = (customerId: string) => !f.area || areaOf.get(customerId) === f.area
  const orders = live(data.orders).filter(
    (o) => o.status !== 'cancelled' && inRange(o.orderDate, f.range) && areaOk(o.customerId) && (!f.garmentTypeId || o.items.some((i) => i.garmentTypeId === f.garmentTypeId)),
  )
  const orderIds = new Set(orders.map((o) => o.id))
  const bills = live(data.bills).filter((b) => inRange(b.billDate, f.range) && areaOk(b.customerId) && (!f.garmentTypeId || (b.orderId !== null && orderIds.has(b.orderId))))
  const payments = live(data.payments).filter(
    (x) => x.kind !== 'opening' && inRange(x.date, f.range) && areaOk(x.customerId) && (!f.mode || x.mode === f.mode),
  )
  return { orders, bills, payments }
}

/** When an order reached "delivered" (local date), if it did. */
export function deliveredOn(o: Pick<Order, 'statusHistory'>): string | null {
  const h = [...o.statusHistory].reverse().find((x) => x.status === 'delivered')
  return h ? toISODate(new Date(h.at)) : null
}

export interface Kpis {
  billed: number
  collected: number
  orders: number
  avgOrderValue: number
  inProgress: number
  delivered: number
  newCustomers: number
  onTimePct: number | null
}

export function kpis(all: { orders: O[]; customers: C[] }, filtered: { orders: O[]; bills: B[]; payments: P[] }, range: Range): Kpis {
  const billed = filtered.bills.reduce((s, b) => s + p(b.total), 0)
  const collected = filtered.payments.reduce((s, x) => s + p(x.amount), 0)
  const orderValues = filtered.orders.map((o) => p(orderTotal(o)))
  const delivered = live(all.orders).filter((o) => {
    const d = deliveredOn(o)
    return d !== null && inRange(d, range)
  })
  const onTime = delivered.filter((o) => deliveredOn(o)! <= o.deliveryDate).length
  const fromMs = fromISODate(range.from).getTime()
  const toMs = fromISODate(range.to).getTime() + 86_400_000
  return {
    billed: r(billed),
    collected: r(collected),
    orders: filtered.orders.length,
    // Whole rupees: an average with paise reads as false precision.
    avgOrderValue: orderValues.length ? Math.round(orderValues.reduce((a, b) => a + b, 0) / orderValues.length / 100) : 0,
    inProgress: live(all.orders).filter((o) => OPEN_STATUSES.includes(o.status)).length,
    delivered: delivered.length,
    newCustomers: live(all.customers).filter((c) => {
      const t = c.createdAt?.toMillis()
      return t !== undefined && t >= fromMs && t < toMs
    }).length,
    onTimePct: delivered.length ? Math.round((onTime / delivered.length) * 100) : null,
  }
}

/** Billed vs collected per month for the last `months` months ending at `end`. */
export function monthlyTrend(bills: B[], payments: P[], end: Date, months = 12) {
  const keys: string[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const billed = new Map(keys.map((k) => [k, 0]))
  const collected = new Map(keys.map((k) => [k, 0]))
  for (const b of live(bills)) {
    const k = b.billDate.slice(0, 7)
    if (billed.has(k)) billed.set(k, billed.get(k)! + p(b.total))
  }
  for (const x of live(payments)) {
    if (x.kind === 'opening') continue
    const k = x.date.slice(0, 7)
    if (collected.has(k)) collected.set(k, collected.get(k)! + p(x.amount))
  }
  return keys.map((month) => ({ month, billed: r(billed.get(month)!), collected: r(collected.get(month)!) }))
}

/** Pieces and revenue per garment, top `top` plus "Other". */
export function garmentMix(orders: O[], top = 7, otherLabel = 'अन्य') {
  const m = new Map<string, { name: string; pieces: number; revenue: number; other?: boolean }>()
  for (const o of orders)
    for (const i of o.items) {
      const cur = m.get(i.garmentTypeId) ?? { name: i.garmentName, pieces: 0, revenue: 0 }
      cur.pieces += i.qty
      cur.revenue += p(itemTotal(i))
      m.set(i.garmentTypeId, cur)
    }
  const rows = [...m.values()].sort((a, b) => b.revenue - a.revenue || b.pieces - a.pieces)
  const head = rows.slice(0, top)
  const tail = rows.slice(top)
  if (tail.length) head.push({ other: true, name: otherLabel, pieces: tail.reduce((s, x) => s + x.pieces, 0), revenue: tail.reduce((s, x) => s + x.revenue, 0) })
  return head.map((x) => ({ ...x, revenue: r(x.revenue) }))
}

export const AGE_BUCKETS = ['0–30', '31–60', '61–90', '90+'] as const

export function ageBucket(days: number): (typeof AGE_BUCKETS)[number] {
  return days <= 30 ? '0–30' : days <= 60 ? '31–60' : days <= 90 ? '61–90' : '90+'
}

/** Outstanding dues by age of the oldest unpaid money (FIFO), with the customers in each bucket. */
export function duesAgeing(balances: Map<string, number>, bills: B[], payments: P[], todayISO: string) {
  const buckets = AGE_BUCKETS.map((label) => ({ label, amount: 0, customers: [] as { customerId: string; amount: number; days: number }[] }))
  for (const [customerId, bal] of balances) {
    if (bal <= 0) continue
    const since = oldestDueDate(customerId, bills, payments) ?? todayISO
    const days = Math.max(0, daysBetween(since, todayISO))
    const b = buckets[AGE_BUCKETS.indexOf(ageBucket(days))]
    b.amount += p(bal)
    b.customers.push({ customerId, amount: bal, days })
  }
  return buckets.map((b) => ({ ...b, amount: r(b.amount), customers: b.customers.sort((x, y) => y.days - x.days) }))
}

/** Top customers in the period by billed amount and by order count, plus biggest dues overall. */
export function topCustomers(filtered: { orders: O[]; bills: B[] }, balances: Map<string, number>, n = 5) {
  const billed = new Map<string, number>()
  for (const b of filtered.bills) billed.set(b.customerId, (billed.get(b.customerId) ?? 0) + p(b.total))
  const count = new Map<string, number>()
  for (const o of filtered.orders) count.set(o.customerId, (count.get(o.customerId) ?? 0) + 1)
  const sortDesc = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n)
  return {
    byRevenue: sortDesc(billed).map(([customerId, v]) => ({ customerId, value: r(v) })),
    byOrders: sortDesc(count).map(([customerId, value]) => ({ customerId, value })),
    byDues: [...balances]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([customerId, value]) => ({ customerId, value })),
  }
}

/** Open orders per pipeline stage right now. */
export function pipelineCounts(orders: O[]): { status: OrderStatus; count: number }[] {
  const open = live(orders)
  return PIPELINE.filter((s) => s !== 'delivered').map((status) => ({ status, count: open.filter((o) => o.status === status).length }))
}

/** Orders taken per calendar day (for the busy-season heatmap). */
export function ordersPerDay(orders: O[], range: Range): [string, number][] {
  const m = new Map<string, number>()
  for (const o of live(orders)) if (o.status !== 'cancelled' && inRange(o.orderDate, range)) m.set(o.orderDate, (m.get(o.orderDate) ?? 0) + 1)
  return [...m].sort((a, b) => a[0].localeCompare(b[0]))
}

/** "आज ₹X आए, Y ऑर्डर दिए, Z बाकी" */
export function dayEnd(all: { orders: O[]; payments: P[] }, dues: number, todayISO: string) {
  const collected = live(all.payments)
    .filter((x) => x.kind !== 'opening' && x.date === todayISO)
    .reduce((s, x) => s + p(x.amount), 0)
  return {
    collected: r(collected),
    delivered: live(all.orders).filter((o) => deliveredOn(o) === todayISO).length,
    newOrders: live(all.orders).filter((o) => o.orderDate === todayISO && o.status !== 'cancelled').length,
    dues,
  }
}

/** Amount still due on one bill (for exports). */
export const billDue = (b: B, payments: P[]) => Math.max(0, r(p(b.total) - p(billPaid(b, payments))))

export const fyLabel = (d: Date) => financialYear(d)
