import type { Language } from '@/data/types'

/** Local calendar date as YYYY-MM-DD (not UTC: an evening entry must not land on tomorrow). */
export function toISODate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Whole calendar months between two dates (never negative). */
export function monthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  if (to.getDate() < from.getDate()) months--
  return Math.max(0, months)
}

/** "आज" / "5 दिन पहले" / "3 महीने पहले" / "1 साल पहले". */
export function agoLabel(iso: string, lang: Language, now: Date = new Date()): string {
  const then = fromISODate(iso)
  const days = Math.round((fromISODate(toISODate(now)).getTime() - then.getTime()) / 86_400_000)
  const months = monthsBetween(then, now)
  const hi = lang === 'hi'
  if (days <= 0) return hi ? 'आज' : 'today'
  if (days === 1) return hi ? 'कल' : 'yesterday'
  if (months < 1) return hi ? `${days} दिन पहले` : `${days} days ago`
  if (months < 12) return hi ? `${months} महीने पहले` : months === 1 ? '1 month ago' : `${months} months ago`
  const years = Math.floor(months / 12)
  return hi ? `${years} साल पहले` : years === 1 ? '1 year ago' : `${years} years ago`
}
