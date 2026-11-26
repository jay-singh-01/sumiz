import { describe, expect, it } from 'vitest'
import { allBalances } from '@/features/bills/ledger'
import {
  ageBucket,
  applyFilters,
  dayEnd,
  deliveredOn,
  duesAgeing,
  garmentMix,
  kpis,
  monthlyTrend,
  ordersPerDay,
  pipelineCounts,
  presetRange,
  topCustomers,
} from './metrics'

const item = (garmentTypeId: string, garmentName: string, qty: number, rate: number) => ({
  garmentTypeId,
  garmentName,
  qty,
  rate,
  addOns: [],
  fabricByCustomer: true,
  fabricNotes: '',
  notes: '',
  measurementId: null,
  measurementTakenOn: null,
  measurements: {},
  designPhotoUrl: null,
})
const order = (id: string, customerId: string, orderDate: string, status: string, items: ReturnType<typeof item>[], extra: Record<string, unknown> = {}) =>
  ({ id, customerId, orderDate, deliveryDate: '2026-11-30', status, statusHistory: [], items, urgent: false, ...extra }) as never
const bill = (id: string, customerId: string, total: number, billDate: string, orderId: string | null = null) => ({ id, customerId, orderId, billNumber: id, billDate, total })
const pay = (id: string, customerId: string, amount: number, date: string, extra: Record<string, unknown> = {}) =>
  ({ id, customerId, orderId: null, billId: null, amount, date, kind: 'payment', mode: 'cash', ...extra }) as never

describe('presetRange', () => {
  const today = new Date(2026, 10, 26) // Thursday
  it('today, week (from Monday), month, FY', () => {
    expect(presetRange('today', today)).toEqual({ from: '2026-11-26', to: '2026-11-26' })
    expect(presetRange('week', today)).toEqual({ from: '2026-11-23', to: '2026-11-26' })
    expect(presetRange('month', today)).toEqual({ from: '2026-11-01', to: '2026-11-26' })
    expect(presetRange('fy', today)).toEqual({ from: '2026-04-01', to: '2026-11-26' })
    expect(presetRange('fy', new Date(2027, 1, 10))).toEqual({ from: '2026-04-01', to: '2027-02-10' })
  })
})

describe('filters and KPIs', () => {
  const customers = [
    { id: 'reena', name: 'रीना', area: 'शास्त्री नगर', createdAt: { toMillis: () => new Date(2026, 10, 5).getTime() } },
    { id: 'kamla', name: 'कमला', area: 'मालवीय नगर', createdAt: { toMillis: () => new Date(2026, 5, 5).getTime() } },
  ]
  const orders = [
    order('o1', 'reena', '2026-11-02', 'delivered', [item('blouse', 'ब्लाउज़', 2, 500)], {
      deliveryDate: '2026-11-10',
      statusHistory: [{ status: 'delivered', at: new Date(2026, 10, 9, 12).toISOString(), by: 's' }],
    }),
    order('o2', 'kamla', '2026-11-12', 'stitching', [item('lehenga', 'लहंगा', 1, 1500)]),
    order('o3', 'kamla', '2026-10-01', 'delivered', [item('kurti', 'कुर्ती', 1, 400)], {
      deliveryDate: '2026-11-01',
      statusHistory: [{ status: 'delivered', at: new Date(2026, 10, 3, 12).toISOString(), by: 's' }],
    }),
    order('o4', 'reena', '2026-11-20', 'cancelled', [item('kurti', 'कुर्ती', 1, 400)]),
  ]
  const bills = [bill('b1', 'reena', 1000, '2026-11-09', 'o1'), bill('b3', 'kamla', 400, '2026-11-03', 'o3')]
  const payments = [pay('p1', 'reena', 600, '2026-11-09', { mode: 'upi' }), pay('p2', 'kamla', 400, '2026-11-03'), pay('p0', 'kamla', 900, '2026-04-01', { kind: 'opening' })]
  const range = { from: '2026-11-01', to: '2026-11-30' }
  const data = { orders, bills, payments, customers }

  it('excludes cancelled orders and opening balances, and respects the range', () => {
    const f = applyFilters(data, { range })
    expect(f.orders.map((o: { id: string }) => o.id)).toEqual(['o1', 'o2'])
    expect(f.payments.map((x: { id: string }) => x.id)).toEqual(['p1', 'p2'])
  })

  it('filters by area, garment and payment mode', () => {
    expect(applyFilters(data, { range, area: 'मालवीय नगर' }).orders.map((o: { id: string }) => o.id)).toEqual(['o2'])
    expect(applyFilters(data, { range, garmentTypeId: 'blouse' }).bills.map((b) => b.id)).toEqual(['b1'])
    expect(applyFilters(data, { range, mode: 'upi' }).payments.map((x: { id: string }) => x.id)).toEqual(['p1'])
  })

  it('computes the headline figures', () => {
    const k = kpis({ orders, customers }, applyFilters(data, { range }), range)
    expect(k).toEqual({
      billed: 1400,
      collected: 1000,
      orders: 2,
      avgOrderValue: 1250,
      inProgress: 1,
      delivered: 2,
      newCustomers: 1,
      onTimePct: 50, // o1 on time, o3 late
    })
  })

  it('reads the delivered date from the status history', () => {
    expect(deliveredOn(orders[0])).toBe('2026-11-09')
    expect(deliveredOn(orders[1])).toBeNull()
  })

  it('ranks customers', () => {
    const t = topCustomers(applyFilters(data, { range }), allBalances(bills, payments))
    expect(t.byRevenue[0]).toEqual({ customerId: 'reena', value: 1000 })
    expect(t.byDues).toEqual([
      { customerId: 'kamla', value: 900 },
      { customerId: 'reena', value: 400 },
    ])
  })

  it('counts the open pipeline', () => {
    expect(pipelineCounts(orders).find((x) => x.status === 'stitching')?.count).toBe(1)
  })

  it('day-end summary', () => {
    expect(dayEnd({ orders, payments }, 1300, '2026-11-09')).toEqual({ collected: 600, delivered: 1, newOrders: 0, dues: 1300 })
  })

  it('orders per day ignores cancelled', () => {
    expect(ordersPerDay(orders, range)).toEqual([
      ['2026-11-02', 1],
      ['2026-11-12', 1],
    ])
  })
})

describe('monthlyTrend', () => {
  it('buckets billed and collected by month, oldest first', () => {
    const t = monthlyTrend([bill('b', 'c', 1000, '2026-10-15'), bill('c', 'c', 500, '2026-11-01')], [pay('p', 'c', 700, '2026-11-02')], new Date(2026, 10, 26), 3)
    expect(t).toEqual([
      { month: '2026-09', billed: 0, collected: 0 },
      { month: '2026-10', billed: 1000, collected: 0 },
      { month: '2026-11', billed: 500, collected: 700 },
    ])
  })
})

describe('garmentMix', () => {
  it('ranks by revenue and folds the tail into Other', () => {
    const orders = [order('a', 'c', '2026-11-01', 'received', [item('g1', 'A', 1, 100), item('g2', 'B', 3, 300), item('g3', 'C', 1, 50)])]
    expect(garmentMix(orders, 2, 'Other')).toEqual([
      { name: 'B', pieces: 3, revenue: 900 },
      { name: 'A', pieces: 1, revenue: 100 },
      { other: true, name: 'Other', pieces: 1, revenue: 50 },
    ])
  })
})

describe('duesAgeing', () => {
  it('buckets each customer by the age of their oldest unpaid money', () => {
    const bills = [bill('1', 'a', 500, '2026-11-20'), bill('2', 'b', 800, '2026-09-01'), bill('3', 'c', 300, '2026-07-01')]
    const balances = allBalances(bills, [])
    const ageing = duesAgeing(balances, bills, [], '2026-11-26')
    expect(ageing.map((b) => [b.label, b.amount])).toEqual([
      ['0–30', 500],
      ['31–60', 0],
      ['61–90', 800],
      ['90+', 300],
    ])
  })
  it('bucket edges', () => {
    expect([0, 30, 31, 60, 61, 90, 91].map(ageBucket)).toEqual(['0–30', '0–30', '31–60', '31–60', '61–90', '61–90', '90+'])
  })
})
