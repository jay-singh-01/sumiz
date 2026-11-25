import { describe, expect, it } from 'vitest'
import { toISODate } from '@/lib/dates'
import { byUrgency, defaultDeliveryDate, isDueToday, isOverdue, itemTotal, nextStatus, orderTotal } from './logic'

describe('status pipeline', () => {
  it('moves forward one step at a time', () => {
    expect(nextStatus('received')).toBe('cutting')
    expect(nextStatus('trial')).toBe('ready')
    expect(nextStatus('ready')).toBe('delivered')
  })
  it('stops at delivered and for cancelled', () => {
    expect(nextStatus('delivered')).toBeNull()
    expect(nextStatus('cancelled')).toBeNull()
  })
})

describe('due and overdue', () => {
  const today = '2026-11-25'
  it('flags open orders past their date', () => {
    expect(isOverdue({ status: 'stitching', deliveryDate: '2026-11-24' }, today)).toBe(true)
    expect(isOverdue({ status: 'ready', deliveryDate: '2026-11-20' }, today)).toBe(true)
  })
  it('never flags delivered or cancelled orders', () => {
    expect(isOverdue({ status: 'delivered', deliveryDate: '2026-11-01' }, today)).toBe(false)
    expect(isOverdue({ status: 'cancelled', deliveryDate: '2026-11-01' }, today)).toBe(false)
  })
  it('knows what is due today', () => {
    expect(isDueToday({ status: 'trial', deliveryDate: today }, today)).toBe(true)
    expect(isOverdue({ status: 'trial', deliveryDate: today }, today)).toBe(false)
  })
})

describe('totals', () => {
  const blouse = { qty: 2, rate: 650, addOns: [{ addOnId: 'lining', name: 'अस्तर', rate: 120 }] }
  it('multiplies rate and add-ons by quantity', () => {
    expect(itemTotal(blouse)).toBe(1540)
  })
  it('sums items', () => {
    expect(orderTotal({ items: [blouse, { qty: 1, rate: 1800, addOns: [] }] as never })).toBe(3340)
  })
})

describe('defaultDeliveryDate', () => {
  it('uses the slowest item', () => {
    expect(toISODate(defaultDeliveryDate(new Date(2026, 10, 25), [3, 10, 7]))).toBe('2026-12-05')
  })
  it('defaults to today with no items', () => {
    expect(toISODate(defaultDeliveryDate(new Date(2026, 10, 25), []))).toBe('2026-11-25')
  })
})

describe('byUrgency', () => {
  it('puts urgent first, then soonest delivery', () => {
    const list = [
      { urgent: false, deliveryDate: '2026-11-26', orderNumber: 'A003' },
      { urgent: true, deliveryDate: '2026-11-30', orderNumber: 'A002' },
      { urgent: false, deliveryDate: '2026-11-25', orderNumber: 'A001' },
    ]
    expect(list.sort(byUrgency).map((o) => o.orderNumber)).toEqual(['A002', 'A001', 'A003'])
  })
})
