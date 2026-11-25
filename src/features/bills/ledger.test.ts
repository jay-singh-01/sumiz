import { describe, expect, it } from 'vitest'
import { allBalances, billPaid, customerBalance, daysBetween, ledgerEntries, totalDues, type LedgerBill, type LedgerPayment } from './ledger'

const bill = (id: string, customerId: string, total: number, billDate: string, orderId: string | null = null, extra: Partial<LedgerBill> = {}): LedgerBill => ({
  id,
  customerId,
  orderId,
  billNumber: `GD/26-27/A${id}`,
  billDate,
  total,
  ...extra,
})
const pay = (id: string, customerId: string, amount: number, date: string, extra: Partial<LedgerPayment> = {}): LedgerPayment => ({
  id,
  customerId,
  orderId: null,
  billId: null,
  amount,
  date,
  kind: 'payment',
  mode: 'cash',
  ...extra,
})

describe('customer balance', () => {
  const bills = [bill('1', 'reena', 2400, '2026-11-10', 'o1'), bill('2', 'reena', 850.5, '2026-11-20'), bill('3', 'sunita', 600, '2026-11-12')]
  const payments = [
    pay('p1', 'reena', 1000, '2026-11-05', { kind: 'advance', orderId: 'o1' }),
    pay('p2', 'reena', 1400, '2026-11-15', { billId: '1' }),
    pay('p3', 'sunita', 600, '2026-11-12', { mode: 'upi' }),
  ]

  it('is bills minus payments', () => {
    expect(customerBalance('reena', bills, payments)).toBe(850.5)
    expect(customerBalance('sunita', bills, payments)).toBe(0)
  })

  it('treats an advance before the bill as credit', () => {
    expect(customerBalance('reena', [], payments)).toBe(-2400)
  })

  it('adds opening balances from the old diary', () => {
    expect(customerBalance('kamla', [], [pay('o', 'kamla', 1200, '2026-04-01', { kind: 'opening' })])).toBe(1200)
  })

  it('ignores soft-deleted records', () => {
    expect(customerBalance('reena', [...bills, bill('9', 'reena', 99999, '2026-11-21', null, { isDeleted: true })], payments)).toBe(850.5)
    expect(customerBalance('reena', bills, [...payments, pay('x', 'reena', 850.5, '2026-11-22', { isDeleted: true })])).toBe(850.5)
  })

  it('computes all balances and total dues without netting credits', () => {
    const b = allBalances([...bills, bill('4', 'kamla', 300, '2026-11-01')], [...payments, pay('p4', 'geeta', 500, '2026-11-01')])
    expect(b.get('reena')).toBe(850.5)
    expect(b.get('geeta')).toBe(-500)
    expect(totalDues(b)).toBe(1150.5)
  })

  it('has no floating-point drift', () => {
    const many = Array.from({ length: 10 }, (_, i) => bill(String(i), 'c', 0.1, '2026-11-01'))
    expect(customerBalance('c', many, [])).toBe(1)
  })
})

describe('billPaid', () => {
  it('counts payments on the bill and advances on its order', () => {
    const payments = [
      pay('a', 'r', 1000, '2026-11-05', { kind: 'advance', orderId: 'o1' }),
      pay('b', 'r', 500, '2026-11-15', { billId: 'b1' }),
      pay('c', 'r', 999, '2026-11-15', { billId: 'other' }),
    ]
    expect(billPaid({ id: 'b1', orderId: 'o1' }, payments)).toBe(1500)
  })
})

describe('ledgerEntries', () => {
  it('runs a date-wise balance with bills before payments on the same day', () => {
    const entries = ledgerEntries(
      'r',
      [bill('1', 'r', 2400, '2026-11-10')],
      [pay('a', 'r', 1000, '2026-11-05', { kind: 'advance' }), pay('b', 'r', 1400, '2026-11-10')],
    )
    expect(entries.map((e) => [e.kind, e.amount, e.balance])).toEqual([
      ['advance', -1000, -1000],
      ['bill', 2400, 1400],
      ['payment', -1400, 0],
    ])
  })
})

describe('daysBetween', () => {
  it('counts calendar days', () => {
    expect(daysBetween('2026-11-01', '2026-11-25')).toBe(24)
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1)
  })
})
