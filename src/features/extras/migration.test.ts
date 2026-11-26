import { describe, expect, it } from 'vitest'
import { parseAmount, parseCsv, rowsFromTable, SAMPLE_CSV, validateRows } from './migration'

describe('parseCsv', () => {
  it('handles quotes, commas inside quotes, CRLF and a BOM', () => {
    expect(parseCsv('﻿a,"b, c","say ""hi"""\r\n1,2,3\r\n\r\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '2', '3'],
    ])
  })
})

describe('rowsFromTable', () => {
  it('skips a Hindi or English header row', () => {
    expect(rowsFromTable(parseCsv(SAMPLE_CSV))).toHaveLength(2)
    expect(rowsFromTable([['Name', 'Phone'], ['Reena', '9829012345']])[0].name).toBe('Reena')
  })
  it('keeps the first row when it is data', () => {
    expect(rowsFromTable([['रीना', '9829012345', 'x', '100']])).toHaveLength(1)
  })
})

describe('parseAmount', () => {
  it.each([
    ['₹1,250.50', 1250.5],
    ['850', 850],
    ['', 0],
    ['Rs. 99', 99],
  ])('%s → %d', (raw, n) => {
    expect(parseAmount(raw)).toBe(n)
  })
  it('rejects text', () => {
    expect(parseAmount('पाँच सौ')).toBeNaN()
  })
})

describe('validateRows', () => {
  it('accepts good rows and reports problems by line', () => {
    const { valid, problems } = validateRows(
      [
        { name: 'सुनीता', phone: '98290 12345', area: 'शास्त्री नगर', balance: '850' },
        { name: '', phone: '9000000000', area: '', balance: '' },
        { name: 'गलत फ़ोन', phone: '12345', area: '', balance: '' },
        { name: 'दोबारा', phone: '9829012345', area: '', balance: '' },
        { name: 'पहले से', phone: '9414098765', area: '', balance: '' },
        { name: 'बकाया गलत', phone: '', area: '', balance: 'abc' },
        { name: '', phone: '', area: '', balance: '' },
        { name: 'बिना फ़ोन', phone: '', area: '', balance: '₹300' },
      ],
      new Set(['9414098765']),
      2,
    )
    expect(valid.map((v) => [v.line, v.customer.name, v.customer.phone, v.balance])).toEqual([
      [2, 'सुनीता', '9829012345', 850],
      [9, 'बिना फ़ोन', '', 300],
    ])
    expect(problems).toEqual([
      { line: 3, problem: 'required' },
      { line: 4, problem: 'invalidPhone' },
      { line: 5, problem: 'duplicate' },
      { line: 6, problem: 'duplicate' },
      { line: 7, problem: 'badAmount' },
    ])
  })
})
