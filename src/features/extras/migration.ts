/*
 * Diary migration: turning rows (typed in, or from a CSV/Excel file) into
 * customers with an "opening balance" from the old paper diary.
 */
import { customerSchema, EMPTY_CUSTOMER, normalizePhone, type Customer } from '@/features/customers/schema'

export interface MigrationRow {
  name: string
  phone: string
  area: string
  balance: string
}

export interface ValidRow {
  line: number
  customer: Customer
  balance: number
}

export interface RowProblem {
  line: number
  problem: 'required' | 'invalidPhone' | 'duplicate' | 'badAmount'
}

/** Minimal RFC-4180 CSV parser: quotes, escaped quotes, commas/newlines inside quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''))
}

/** First row is a header if it doesn't look like data (no digits in the phone column). */
function looksLikeHeader(r: string[]): boolean {
  return /name|नाम/i.test(r[0] ?? '') || !/\d/.test(r[1] ?? '')
}

/** Cells → rows in the fixed column order: name, phone, area, balance. */
export function rowsFromTable(table: (string | number | null)[][]): MigrationRow[] {
  const cells = table.map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c).trim())))
  const body = cells.length && looksLikeHeader(cells[0]) ? cells.slice(1) : cells
  return body.map(([name = '', phone = '', area = '', balance = '']) => ({ name, phone, area, balance }))
}

/** "₹1,250.50" / "1250" / "" → number (empty = 0); NaN when unreadable. */
export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[₹,\s]/g, '').replace(/^Rs\.?/i, '')
  if (cleaned === '') return 0
  return /^\d+(\.\d{1,2})?$/.test(cleaned) ? Number(cleaned) : Number.NaN
}

export function validateRows(rows: MigrationRow[], existingPhones: Set<string>, firstLine = 1): { valid: ValidRow[]; problems: RowProblem[] } {
  const valid: ValidRow[] = []
  const problems: RowProblem[] = []
  const seen = new Set(existingPhones)
  rows.forEach((r, i) => {
    const line = firstLine + i
    if (!r.name.trim() && !r.phone.trim() && !r.balance.trim()) return // blank row
    const parsed = customerSchema.safeParse({ ...EMPTY_CUSTOMER, name: r.name, phone: r.phone, area: r.area })
    if (!parsed.success) {
      problems.push({ line, problem: parsed.error.issues.some((x) => x.message === 'invalidPhone') ? 'invalidPhone' : 'required' })
      return
    }
    const phone = normalizePhone(r.phone)
    if (phone && seen.has(phone)) {
      problems.push({ line, problem: 'duplicate' })
      return
    }
    const balance = parseAmount(r.balance)
    if (Number.isNaN(balance) || balance < 0) {
      problems.push({ line, problem: 'badAmount' })
      return
    }
    if (phone) seen.add(phone)
    valid.push({ line, customer: parsed.data, balance })
  })
  return { valid, problems }
}

export const SAMPLE_CSV = 'नाम,फ़ोन,मोहल्ला,पुराना बकाया\nसुनीता शर्मा,9829012345,शास्त्री नगर,850\nकमला जैन,,मालवीय नगर,0\n'
