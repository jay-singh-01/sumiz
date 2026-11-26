import { describe, expect, it } from 'vitest'
import { allBalances, oldestDueDate } from '@/features/bills/ledger'
import { searchCustomers } from '@/features/customers/search'
import { applyFilters, duesAgeing, garmentMix, kpis, monthlyTrend, ordersPerDay, pipelineCounts, presetRange, topCustomers } from './metrics'

// Several years of a busy shop: the summary and search must stay fast on a mid-range phone.
// Budgets are generous (CI machines vary); a phone is roughly 3-5x slower than a laptop.
const CUSTOMERS = 2_000
const ORDERS = 10_000
const STATUSES = ['received', 'cutting', 'stitching', 'ready', 'delivered']
const NAMES = ['सुनीता', 'कमला', 'गीता', 'शीला', 'राधा', 'मीना', 'पूजा', 'सरला']
const iso = (n: number) => new Date(Date.UTC(2023, 3, 1) + (n % 1300) * 86_400_000).toISOString().slice(0, 10)

const customers = Array.from({ length: CUSTOMERS }, (_, i) => ({
  id: `c${i}`,
  name: `${NAMES[i % NAMES.length]} ${i}`,
  phone: `98${String(10_000_000 + i).padStart(8, '0')}`,
  area: `area ${i % 30}`,
})) as never[]
const orders = Array.from({ length: ORDERS }, (_, i) => ({
  id: `o${i}`,
  customerId: `c${i % CUSTOMERS}`,
  orderDate: iso(i),
  deliveryDate: iso(i + 10),
  status: STATUSES[i % STATUSES.length],
  statusHistory: [],
  urgent: false,
  items: [{ garmentTypeId: `g${i % 21}`, garmentName: `कपड़ा ${i % 21}`, qty: 1 + (i % 3), rate: 450, addOns: [] }],
})) as never[]
const bills = Array.from({ length: ORDERS }, (_, i) => ({ id: `b${i}`, customerId: `c${i % CUSTOMERS}`, orderId: `o${i}`, billNumber: `B${i}`, billDate: iso(i + 2), total: 900 + (i % 7) * 150 }))
const payments = Array.from({ length: ORDERS * 1.5 }, (_, i) => ({
  id: `p${i}`,
  customerId: `c${i % CUSTOMERS}`,
  orderId: null,
  billId: null,
  amount: 600,
  date: iso(i + 3),
  kind: 'payment',
  mode: 'cash',
})) as never[]

const time = (fn: () => void) => {
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

describe(`scale: ${CUSTOMERS} customers, ${ORDERS} orders`, () => {
  it('builds the whole summary quickly', () => {
    const ms = time(() => {
      const range = presetRange('fy', new Date(2026, 10, 26))
      const f = applyFilters({ orders, bills, payments, customers }, { range })
      const balances = allBalances(bills, payments)
      kpis({ orders, customers }, f, range)
      monthlyTrend(f.bills, f.payments, new Date(2026, 10, 26))
      garmentMix(f.orders)
      duesAgeing(balances, bills, payments, '2026-11-26')
      topCustomers(f, balances)
      pipelineCounts(orders)
      ordersPerDay(f.orders, range)
    })
    expect(ms).toBeLessThan(1_500)
  })

  it('finds a customer by romanised name in a few milliseconds', () => {
    let hits: unknown[] = []
    const ms = time(() => {
      hits = searchCustomers(customers as never, 'sheela 13')
    })
    expect(hits.length).toBeGreaterThan(0)
    expect(ms).toBeLessThan(500)
  })

  it('works out dues age for one customer quickly', () => {
    const ms = time(() => oldestDueDate('c7', bills, payments))
    expect(ms).toBeLessThan(200)
  })
})
