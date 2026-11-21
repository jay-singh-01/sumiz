import { describe, expect, it } from 'vitest'
import { financialYear, formatDate, formatINR, formatNumber } from './format'

describe('formatINR', () => {
  it('uses Indian lakh grouping', () => {
    expect(formatINR(125000)).toBe('₹1,25,000')
    expect(formatINR(10000000)).toBe('₹1,00,00,000')
  })

  it('shows paise only when present', () => {
    expect(formatINR(850)).toBe('₹850')
    expect(formatINR(850.5)).toBe('₹850.50')
  })

  it('handles zero and negatives', () => {
    expect(formatINR(0)).toBe('₹0')
    expect(formatINR(-1200)).toBe('-₹1,200')
  })
})

describe('formatNumber', () => {
  it('groups without a currency symbol', () => {
    expect(formatNumber(1234567)).toBe('12,34,567')
  })
})

describe('formatDate', () => {
  it('formats as DD/MM/YYYY', () => {
    expect(formatDate(new Date(2026, 10, 5))).toBe('05/11/2026')
  })
})

describe('financialYear', () => {
  it('starts the year on 1 April', () => {
    expect(financialYear(new Date(2026, 3, 1))).toBe('26-27')
    expect(financialYear(new Date(2027, 2, 31))).toBe('26-27')
    expect(financialYear(new Date(2026, 2, 31))).toBe('25-26')
  })

  it('wraps across centuries', () => {
    expect(financialYear(new Date(2099, 5, 1))).toBe('99-00')
  })
})
