import { isIndianMobile, normalizePhone } from '@/features/customers/schema'

/** wa.me click-to-chat link, optionally with a pre-filled message. null if the number isn't a valid Indian mobile. */
export function whatsappLink(phone: string, message?: string): string | null {
  const d = normalizePhone(phone)
  if (!isIndianMobile(d)) return null
  return `https://wa.me/91${d}${message ? `?text=${encodeURIComponent(message)}` : ''}`
}

export function telLink(phone: string): string | null {
  const d = normalizePhone(phone)
  return d.length >= 10 ? `tel:+91${d.slice(-10)}` : null
}

/** "9829012345" → "98290 12345" for display. */
export function formatPhone(phone: string): string {
  const d = normalizePhone(phone)
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : phone
}
