import { z } from 'zod'
import { format } from '@/i18n/format'

export const REMINDER_TYPES = ['paymentDue', 'ready', 'trial', 'greeting'] as const
export type ReminderType = (typeof REMINDER_TYPES)[number]

/** Placeholders a template may use. */
export const PLACEHOLDERS = ['{name}', '{amount}', '{num}', '{date}', '{upi}', '{shop}'] as const

/** Polite Hindi defaults; editable in Settings. */
export const DEFAULT_TEMPLATES: Record<ReminderType, string> = {
  paymentDue: 'नमस्ते {name} जी 🙏 आपका ₹{amount} बकाया है। कृपया सुविधानुसार भुगतान करें। UPI: {upi} — {shop}',
  ready: 'नमस्ते {name} जी 🙏 आपके कपड़े तैयार हैं (ऑर्डर {num})। जब सुविधा हो, ले जाएँ। बाकी: ₹{amount} — {shop}',
  trial: 'नमस्ते {name} जी 🙏 {date} को आपका ट्रायल है (ऑर्डर {num})। कृपया समय पर आएँ। — {shop}',
  greeting: 'नमस्ते {name} जी 🙏 {shop} की ओर से आपको और आपके परिवार को ढेर सारी शुभकामनाएँ! 🌼',
}

export const templatesSchema = z.object({
  paymentDue: z.string().trim().min(1).max(600),
  ready: z.string().trim().min(1).max(600),
  trial: z.string().trim().min(1).max(600),
  greeting: z.string().trim().min(1).max(600),
})
export type Templates = z.infer<typeof templatesSchema>

export interface ReminderVars {
  name: string
  amount?: string
  num?: string
  date?: string
  upi?: string
  shop: string
}

/**
 * Fills a template. Parts about UPI are dropped when the shop has no UPI ID,
 * and parts about the amount when nothing is due, so the message never shows
 * "UPI: " or "₹0" awkwardly.
 */
export function buildMessage(template: string, vars: ReminderVars): string {
  let t = template
  if (!vars.upi) t = t.replace(/\s*UPI:\s*\{upi\}\s*/g, ' ')
  if (!vars.amount || vars.amount === '0') t = t.replace(/\s*(बाकी|Due|Balance):\s*₹\{amount\}\s*/gi, ' ')
  return format(t, { ...vars, amount: vars.amount ?? '', num: vars.num ?? '', date: vars.date ?? '', upi: vars.upi ?? '' })
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+—/g, ' —')
    .trim()
}
