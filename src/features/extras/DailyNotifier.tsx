import { useEffect } from 'react'
import { useSession } from '@/auth/AuthGate'
import { useFeatures } from '@/app/features'
import { useSettings } from '@/app/useShop'
import { useCollection } from '@/data/hooks'
import { useLedger } from '@/features/bills/useLedger'
import type { Order } from '@/features/orders/schema'
import { dayEnd } from '@/features/reports/metrics'
import { useI18n } from '@/i18n'
import { toISODate } from '@/lib/dates'
import { formatINR } from '@/lib/format'

const KEY = 'gd.notifiedOn'

/**
 * Evening summary as a local notification: shown once a day the first time
 * the app is open after 7 pm (true background scheduling needs a push server,
 * which would break the ₹0 budget).
 */
export function DailyNotifier() {
  const { t } = useI18n()
  const on = useFeatures()
  const { shopId } = useSession()
  const { settings } = useSettings()
  const orders = useCollection<Order>(shopId, 'orders')
  const { payments, dues, loading } = useLedger()

  useEffect(() => {
    if (!on('dailyNotification') || loading || !orders || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const now = new Date()
    const today = toISODate(now)
    let last: string | null = null
    try {
      last = localStorage.getItem(KEY)
    } catch {
      return
    }
    if (now.getHours() < 19 || last === today) return
    const d = dayEnd({ orders, payments: payments ?? [] }, dues, today)
    const body = t('sum_dayEnd', { collected: formatINR(d.collected).replace('₹', ''), delivered: d.delivered, newOrders: d.newOrders, dues: formatINR(d.dues).replace('₹', '') })
    const title = t('notif_title', { shop: settings.shopName })
    const show = async () => {
      const reg = await navigator.serviceWorker?.getRegistration()
      if (reg) await reg.showNotification(title, { body, icon: '/pwa-192x192.png', badge: '/pwa-64x64.png', tag: 'day-end' })
      else new Notification(title, { body, icon: '/pwa-192x192.png' })
    }
    void show()
      .then(() => localStorage.setItem(KEY, today))
      .catch(() => undefined)
  }, [on, loading, orders, payments, dues, settings.shopName, t])

  return null
}
