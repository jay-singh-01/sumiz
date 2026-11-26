import { describe, expect, it } from 'vitest'
import { sheetName } from './excel'

describe('sheetName', () => {
  it('removes characters Excel forbids and keeps 31 chars', () => {
    expect(sheetName('हर महीने: बिल बनाम मिले पैसे')).toBe('हर महीने बिल बनाम मिले पैसे')
    expect(sheetName('a/b\\c[d]e*f?g')).toBe('a b c d e f g')
    expect(sheetName('x'.repeat(40))).toHaveLength(31)
    expect(sheetName('::')).toBe('Sheet')
  })
})
