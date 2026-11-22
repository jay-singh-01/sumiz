import { describe, expect, it } from 'vitest'
import { agoLabel, fromISODate, monthsBetween, toISODate } from './dates'

describe('ISO dates', () => {
  it('uses the local calendar date', () => {
    expect(toISODate(new Date(2026, 10, 21, 23, 30))).toBe('2026-11-21')
  })
  it('round-trips', () => {
    expect(toISODate(fromISODate('2026-02-28'))).toBe('2026-02-28')
  })
})

describe('monthsBetween', () => {
  it('counts whole months only', () => {
    expect(monthsBetween(new Date(2026, 0, 15), new Date(2026, 3, 14))).toBe(2)
    expect(monthsBetween(new Date(2026, 0, 15), new Date(2026, 3, 15))).toBe(3)
    expect(monthsBetween(new Date(2026, 5, 1), new Date(2026, 0, 1))).toBe(0)
  })
})

describe('agoLabel', () => {
  const now = new Date(2026, 10, 21, 18)
  it.each([
    ['2026-11-21', 'आज', 'today'],
    ['2026-11-20', 'कल', 'yesterday'],
    ['2026-11-11', '10 दिन पहले', '10 days ago'],
    ['2026-08-10', '3 महीने पहले', '3 months ago'],
    ['2025-11-01', '1 साल पहले', '1 year ago'],
  ])('%s', (iso, hi, en) => {
    expect(agoLabel(iso, 'hi', now)).toBe(hi)
    expect(agoLabel(iso, 'en', now)).toBe(en)
  })
})
