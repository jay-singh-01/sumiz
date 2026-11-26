import { useMemo } from 'react'
import { useSession } from '@/auth/AuthGate'
import { useSettings } from '@/app/useShop'
import { useCollection } from '@/data/hooks'
import { createRecord } from '@/data/write'
import { useI18n } from '@/i18n'
import { formatINR } from '@/lib/format'
import { whatsappLink } from '@/lib/whatsapp'
import { reminderSchema, type Reminder } from './schema'
import { buildMessage, DEFAULT_TEMPLATES, type ReminderType, type ReminderVars } from './templates'

export interface ReminderTarget {
  customerId: string
  customerName: string
  phone: string
  type: ReminderType
  amount?: number
  orderNumber?: string
  date?: string
  orderId?: string | null
  billId?: string | null
  /** Custom template (e.g. a festival greeting) instead of the shop's template for this type. */
  text?: string
}

/**
 * Builds reminder messages from the shop's templates, opens WhatsApp with the
 * message ready, and logs every reminder sent.
 */
export function useReminders() {
  const { shopId, ctx } = useSession()
  const { settings } = useSettings()
  const { lang } = useI18n()
  const log = useCollection<Reminder>(shopId, 'reminders')

  const lastSent = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of log ?? []) {
      // Not yet synced (no server time): it was just sent, so it's the newest.
      const at = r.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER
      const key = `${r.customerId}:${r.type}`
      if (at > (m.get(key) ?? 0)) m.set(key, at)
    }
    return m
  }, [log])

  const templates = { ...DEFAULT_TEMPLATES, ...(settings.templates ?? {}) }

  const message = (target: ReminderTarget) => {
    const vars: ReminderVars = {
      name: target.customerName,
      amount: target.amount !== undefined ? formatINR(target.amount).replace('₹', '') : undefined,
      num: target.orderNumber,
      date: target.date,
      upi: settings.upiId || undefined,
      shop: settings.shopName,
    }
    return buildMessage(target.text ?? templates[target.type], vars)
  }

  /** Opens the chat and records the reminder. Returns false if the number can't be messaged. */
  const send = (target: ReminderTarget): boolean => {
    const text = message(target)
    const link = whatsappLink(target.phone, text)
    if (!link) return false
    window.open(link, '_blank', 'noopener')
    createRecord(
      ctx,
      'reminders',
      reminderSchema,
      {
        customerId: target.customerId,
        customerName: target.customerName,
        type: target.type,
        message: text,
        channel: 'whatsapp',
        orderId: target.orderId ?? null,
        billId: target.billId ?? null,
        amount: target.amount ?? null,
      },
      { label: `${target.customerName} · ${target.type}` },
    )
    return true
  }

  return { message, send, lastSent, lang, log }
}
