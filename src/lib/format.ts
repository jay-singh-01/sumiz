const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const inrPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

/** ₹1,25,000 — Indian digit grouping, paise shown only when present. */
export function formatINR(amount: number): string {
  return Number.isInteger(amount) ? inrWhole.format(amount) : inrPaise.format(amount)
}

/** 1,25,000 — Indian digit grouping without the currency symbol. */
export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

/** Short Indian money for chart axes: ₹950, ₹12K, ₹1.2L, ₹3.4Cr. */
export function formatINRCompact(amount: number): string {
  const a = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  const trim = (n: number) => String(Math.round(n * 10) / 10)
  if (a >= 1e7) return `${sign}₹${trim(a / 1e7)}Cr`
  if (a >= 1e5) return `${sign}₹${trim(a / 1e5)}L`
  if (a >= 1e3) return `${sign}₹${trim(a / 1e3)}K`
  return `${sign}₹${Math.round(a)}`
}

/** DD/MM/YYYY in the device's local time zone. */
export function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${date.getFullYear()}`
}

/** Indian financial year label for a date, e.g. 15/05/2026 → "26-27". FY starts 1 April. */
export function financialYear(date: Date): string {
  const start = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
  const yy = (n: number) => String(n % 100).padStart(2, '0')
  return `${yy(start)}-${yy(start + 1)}`
}
