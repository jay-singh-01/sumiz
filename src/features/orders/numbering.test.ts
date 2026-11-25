import { describe, expect, it } from 'vitest'
import { DEVICE_LETTERS, formatOrderNumber, nextSequence, pickFreeLetter } from './numbering'

describe('order numbers', () => {
  it('formats with prefix, financial year, device letter and padded sequence', () => {
    expect(formatOrderNumber('GD', '26-27', 'A', 42)).toBe('GD/26-27/A042')
    expect(formatOrderNumber('GD', '26-27', 'B', 1234)).toBe('GD/26-27/B1234')
  })

  it('continues the sequence within a financial year', () => {
    expect(nextSequence({ fy: '26-27', seq: 41 }, new Date(2026, 10, 25))).toEqual({ fy: '26-27', seq: 42 })
  })

  it('restarts on 1 April', () => {
    expect(nextSequence({ fy: '26-27', seq: 380 }, new Date(2027, 3, 1))).toEqual({ fy: '27-28', seq: 1 })
    expect(nextSequence({ fy: '26-27', seq: 380 }, new Date(2027, 2, 31))).toEqual({ fy: '26-27', seq: 381 })
  })

  it('gives each device its own letter, skipping I and O', () => {
    expect(pickFreeLetter([])).toBe('A')
    expect(pickFreeLetter(['A', 'B'])).toBe('C')
    expect(pickFreeLetter(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])).toBe('J')
    expect(DEVICE_LETTERS).not.toContain('I')
    expect(DEVICE_LETTERS).not.toContain('O')
  })

  it('moves to two letters when singles run out', () => {
    expect(pickFreeLetter(DEVICE_LETTERS)).toBe('AA')
  })
})
