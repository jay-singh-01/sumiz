/*
 * Customer ledger. A balance is ALWAYS derived from bills minus payments, so it
 * can never drift from the records. All arithmetic in integer paise.
 */

export interface LedgerBill {
  id: string
  customerId: string
  orderId: string | null
  billNumber: string
  billDate: string
  total: number
  isDeleted?: boolean
}

export interface LedgerPayment {
  id: string
  customerId: string
  orderId: string | null
  billId: string | null
  amount: number
  date: string
  kind: 'advance' | 'payment' | 'opening'
  mode: string
  isDeleted?: boolean
}

export interface LedgerEntry {
  date: string
  kind: 'bill' | 'payment' | 'advance' | 'opening'
  ref: string
  id: string
  /** Positive: customer owes more (bill / opening balance). Negative: money received. */
  amount: number
  /** Running balance after this entry. */
  balance: number
}

const p = (r: number) => Math.round(r * 100)
const r = (paise: number) => paise / 100
const live = <T extends { isDeleted?: boolean }>(xs: T[]) => xs.filter((x) => !x.isDeleted)

/**
 * Opening balances are entered as payments of kind "opening" whose amount is
 * what the customer OWES from the old diary, so they add to the balance.
 */
function signedPaise(pay: LedgerPayment): number {
  return pay.kind === 'opening' ? p(pay.amount) : -p(pay.amount)
}

export function customerBalance(customerId: string, bills: LedgerBill[], payments: LedgerPayment[]): number {
  let paise = 0
  for (const b of live(bills)) if (b.customerId === customerId) paise += p(b.total)
  for (const pay of live(payments)) if (pay.customerId === customerId) paise += signedPaise(pay)
  return r(paise)
}

/** Balance per customer id, for lists, dues and reports. */
export function allBalances(bills: LedgerBill[], payments: LedgerPayment[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const b of live(bills)) m.set(b.customerId, (m.get(b.customerId) ?? 0) + p(b.total))
  for (const pay of live(payments)) m.set(pay.customerId, (m.get(pay.customerId) ?? 0) + signedPaise(pay))
  return new Map([...m].map(([k, v]) => [k, r(v)]))
}

/** Total money owed to the shop (credits are not netted against other customers' dues). */
export function totalDues(balances: Map<string, number>): number {
  let paise = 0
  for (const v of balances.values()) if (v > 0) paise += p(v)
  return r(paise)
}

/** Money received against one bill: payments on the bill plus advances on its order. */
export function billPaid(bill: Pick<LedgerBill, 'id' | 'orderId'>, payments: LedgerPayment[]): number {
  let paise = 0
  for (const pay of live(payments)) {
    if (pay.kind === 'opening') continue
    if (pay.billId === bill.id || (bill.orderId && pay.orderId === bill.orderId && !pay.billId)) paise += p(pay.amount)
  }
  return r(paise)
}

/** Date-wise statement with a running balance. Same-day: bills before payments. */
export function ledgerEntries(customerId: string, bills: LedgerBill[], payments: LedgerPayment[]): LedgerEntry[] {
  const rows: Omit<LedgerEntry, 'balance'>[] = [
    ...live(bills)
      .filter((b) => b.customerId === customerId)
      .map((b) => ({ date: b.billDate, kind: 'bill' as const, ref: b.billNumber, id: b.id, amount: b.total })),
    ...live(payments)
      .filter((x) => x.customerId === customerId)
      .map((x) => ({
        date: x.date,
        kind: x.kind === 'payment' ? ('payment' as const) : x.kind,
        ref: x.mode,
        id: x.id,
        amount: r(signedPaise(x)),
      })),
  ]
  const order = { opening: 0, bill: 1, advance: 2, payment: 3 }
  rows.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind])
  let running = 0
  return rows.map((row) => {
    running += p(row.amount)
    return { ...row, balance: r(running) }
  })
}

/** Days since a date (for dues ageing). */
export function daysBetween(fromISO: string, toISO: string): number {
  const [y1, m1, d1] = fromISO.split('-').map(Number)
  const [y2, m2, d2] = toISO.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/**
 * Date of the oldest money still owed, applying the customer's payments to
 * their oldest bills first (FIFO). null when nothing is owed. Used for dues
 * ageing ("31–60 days") and payment reminders.
 */
export function oldestDueDate(customerId: string, bills: LedgerBill[], payments: LedgerPayment[]): string | null {
  return allOldestDueDates(
    bills.filter((b) => b.customerId === customerId),
    payments.filter((x) => x.customerId === customerId),
  ).get(customerId) ?? null
}

/** oldestDueDate for every customer in one pass (lists and reports over thousands of bills). */
export function allOldestDueDates(bills: LedgerBill[], payments: LedgerPayment[]): Map<string, string> {
  const debits = new Map<string, { date: string; paise: number }[]>()
  const credits = new Map<string, number>()
  const addDebit = (id: string, date: string, paise: number) => {
    const list = debits.get(id)
    if (list) list.push({ date, paise })
    else debits.set(id, [{ date, paise }])
  }
  for (const b of live(bills)) addDebit(b.customerId, b.billDate, p(b.total))
  for (const x of live(payments)) {
    if (x.kind === 'opening') addDebit(x.customerId, x.date, p(x.amount))
    else credits.set(x.customerId, (credits.get(x.customerId) ?? 0) + p(x.amount))
  }
  const out = new Map<string, string>()
  for (const [id, list] of debits) {
    list.sort((a, b) => a.date.localeCompare(b.date))
    let credit = credits.get(id) ?? 0
    for (const d of list) {
      if (credit >= d.paise) {
        credit -= d.paise
        continue
      }
      out.set(id, d.date)
      break
    }
  }
  return out
}
