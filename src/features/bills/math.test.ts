import { describe, expect, it } from 'vitest'
import { computeBill, lineTotal } from './math'

describe('lineTotal', () => {
  it('multiplies rate and add-ons by quantity', () => {
    expect(lineTotal({ qty: 2, rate: 450, addOns: [{ rate: 150 }, { rate: 50 }] })).toBe(130000) // paise
  })

  it('rejects negative or invalid numbers', () => {
    expect(() => lineTotal({ qty: -1, rate: 100 })).toThrow()
    expect(() => lineTotal({ qty: 1, rate: Number.NaN })).toThrow()
    expect(() => lineTotal({ qty: 1, rate: 100, addOns: [{ rate: -5 }] })).toThrow()
  })
})

describe('computeBill', () => {
  const lines = [
    { name: 'ब्लाउज़', qty: 1, rate: 650, addOns: [{ name: 'अस्तर', rate: 100 }] },
    { name: 'लहंगा', qty: 1, rate: 1800 },
  ]

  it('adds up lines', () => {
    const b = computeBill({ lines })
    expect(b.lineTotals).toEqual([750, 1800])
    expect(b.subtotal).toBe(2550)
    expect(b.total).toBe(2550)
    expect(b.balance).toBe(2550)
    expect(b.status).toBe('unpaid')
  })

  it('applies a flat discount', () => {
    expect(computeBill({ lines, discount: { type: 'flat', value: 50 } }).total).toBe(2500)
  })

  it('applies a percent discount and rounds off', () => {
    const b = computeBill({ lines, discount: { type: 'percent', value: 7 }, roundOff: true })
    expect(b.discount).toBe(178.5)
    expect(b.total).toBe(2372) // 2371.50 → 2372
    expect(b.roundOff).toBe(0.5)
  })

  it('never lets a discount make the bill negative', () => {
    expect(computeBill({ lines, discount: { type: 'flat', value: 99999 } }).total).toBe(0)
    expect(computeBill({ lines, discount: { type: 'percent', value: 150 } }).total).toBe(0)
  })

  it('subtracts advance and later payments', () => {
    const b = computeBill({ lines, advance: 500, payments: [1000] })
    expect(b.paid).toBe(1500)
    expect(b.balance).toBe(1050)
    expect(b.status).toBe('partial')
  })

  it('marks paid when settled and shows credit when overpaid', () => {
    expect(computeBill({ lines, advance: 2550 }).status).toBe('paid')
    const over = computeBill({ lines, advance: 3000 })
    expect(over.balance).toBe(-450)
    expect(over.status).toBe('paid')
  })

  it('adds GST after discount and before round-off', () => {
    const b = computeBill({ lines, discount: { type: 'flat', value: 50 }, taxPercent: 5, roundOff: true })
    expect(b.tax).toBe(125) // 5% of 2500
    expect(b.total).toBe(2625)
    expect(computeBill({ lines, taxPercent: 0 }).tax).toBe(0)
  })

  it('avoids floating-point drift', () => {
    const b = computeBill({ lines: [{ qty: 3, rate: 0.1 }, { qty: 1, rate: 0.2 }] })
    expect(b.total).toBe(0.5)
  })
})

describe('splitGst', () => {
  it('splits into halves that add back exactly', async () => {
    const { splitGst } = await import('./math')
    expect(splitGst(125)).toEqual({ cgst: 62.5, sgst: 62.5 })
    expect(splitGst(0.03)).toEqual({ cgst: 0.01, sgst: 0.02 })
  })
})
