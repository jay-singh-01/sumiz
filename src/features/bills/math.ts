/*
 * Bill arithmetic. Amounts are stored and shown in rupees (numbers with at
 * most 2 decimals) but every calculation runs in integer paise, so floating
 * point can never put a stray paisa on a bill.
 */

export interface AddOnInput {
  name?: string
  /** Rate per piece, multiplied by the line quantity. */
  rate: number
}

export interface BillLineInput {
  name?: string
  qty: number
  rate: number
  addOns?: AddOnInput[]
}

export interface Discount {
  type: 'flat' | 'percent'
  value: number
}

export interface BillInput {
  lines: BillLineInput[]
  discount?: Discount
  /** Round the grand total to the nearest rupee. */
  roundOff?: boolean
  /** Advance taken when the order was placed. */
  advance?: number
  /** Further payments applied to this bill. */
  payments?: number[]
}

export interface BillTotals {
  lineTotals: number[]
  subtotal: number
  discount: number
  roundOff: number
  total: number
  paid: number
  /** Positive = customer owes; negative = customer has credit. */
  balance: number
  status: 'unpaid' | 'partial' | 'paid'
}

const toPaise = (rupees: number): number => {
  if (!Number.isFinite(rupees)) throw new Error(`Invalid amount: ${rupees}`)
  return Math.round(rupees * 100)
}
const toRupees = (paise: number): number => paise / 100

function nonNegative(label: string, n: number) {
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a non-negative number, got ${n}`)
}

export function lineTotal(line: BillLineInput): number {
  nonNegative('qty', line.qty)
  nonNegative('rate', line.rate)
  const perPiece = toPaise(line.rate) + (line.addOns ?? []).reduce((sum, a) => (nonNegative('add-on rate', a.rate), sum + toPaise(a.rate)), 0)
  return Math.round(perPiece * line.qty)
}

export function computeBill(input: BillInput): BillTotals {
  const linePaise = input.lines.map(lineTotal)
  const subtotal = linePaise.reduce((a, b) => a + b, 0)

  let discount = 0
  if (input.discount && input.discount.value > 0) {
    nonNegative('discount', input.discount.value)
    discount =
      input.discount.type === 'percent'
        ? Math.round((subtotal * Math.min(input.discount.value, 100)) / 100)
        : toPaise(input.discount.value)
    discount = Math.min(discount, subtotal) // never a negative bill
  }

  const beforeRound = subtotal - discount
  const total = input.roundOff ? Math.round(beforeRound / 100) * 100 : beforeRound
  const roundOff = total - beforeRound

  const payments = [input.advance ?? 0, ...(input.payments ?? [])]
  payments.forEach((p) => nonNegative('payment', p))
  const paid = payments.reduce((sum, p) => sum + toPaise(p), 0)
  const balance = total - paid

  return {
    lineTotals: linePaise.map(toRupees),
    subtotal: toRupees(subtotal),
    discount: toRupees(discount),
    roundOff: toRupees(roundOff),
    total: toRupees(total),
    paid: toRupees(paid),
    balance: toRupees(balance),
    status: paid === 0 && total > 0 ? 'unpaid' : balance > 0 ? 'partial' : 'paid',
  }
}
