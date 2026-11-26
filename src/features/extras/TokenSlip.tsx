import { Loader2, Ticket } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import logoUrl from '@/assets/logo.svg'
import { useFeatures } from '@/app/features'
import { useSettings } from '@/app/useShop'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import type { Stored } from '@/data/types'
import { dataUrlToBlob, download, nodeToPng, safeFileName, shareFile } from '@/features/bills/exporter'
import { itemsSummary } from '@/features/orders/components'
import { orderTotal } from '@/features/orders/logic'
import type { Order } from '@/features/orders/schema'
import { useI18n } from '@/i18n'
import { fromISODate } from '@/lib/dates'
import { formatDate, formatINR } from '@/lib/format'
import { whatsappLink } from '@/lib/whatsapp'

/** Small receipt for the customer: order number, items, dates, advance. Shared as an image. */
export function TokenSlipButton({ order, paid }: { order: Stored<Order>; paid: number }) {
  const { t } = useI18n()
  const on = useFeatures()
  const { settings } = useSettings()
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [qr, setQr] = useState<string>()

  useEffect(() => {
    let alive = true
    void import('qrcode').then((QR) => QR.toDataURL(order.orderNumber, { margin: 1, width: 200 })).then((u) => alive && setQr(u))
    return () => {
      alive = false
    }
  }, [order.orderNumber])

  if (!on('tokenSlip')) return null
  const total = orderTotal(order)

  const share = async () => {
    const node = ref.current?.firstElementChild as HTMLElement | null
    if (!node) return
    setBusy(true)
    try {
      const blob = dataUrlToBlob(await nodeToPng(node))
      const name = `${safeFileName(`${settings.shopName}-${order.orderNumber}-slip`)}.png`
      const text = `${t('slip_title')} ${order.orderNumber} — ${settings.shopName}`
      if ((await shareFile(blob, name, text)) === 'unsupported') {
        download(blob, name)
        const wa = whatsappLink(order.customerPhone, text)
        if (wa) window.open(wa, '_blank', 'noopener')
        toast({ message: t('bill_downloaded') })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="secondary" block onClick={() => void share()} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Ticket />} {t('slip_share')}
      </Button>
      {/* Off-screen slip, captured as an image. */}
      <div ref={ref} aria-hidden className="pointer-events-none fixed top-0 -left-[9999px]">
        <div className="theme-light w-[320px] rounded-2xl border-[3px] border-[#c9971c] bg-[#fffdf7] p-4 text-[14px] text-ink" style={{ fontFamily: 'Mukta, sans-serif' }}>
          <div className="flex items-center gap-2 border-b-2 border-dashed border-[#e6c46a] pb-2">
            <img src={settings.logoUrl ?? logoUrl} alt="" className="size-10" />
            <div>
              <div className="text-xl text-rani" style={{ fontFamily: '"Rozha One", serif' }}>
                {settings.shopName}
              </div>
              {settings.phone && <div className="text-xs text-ink-muted">📞 {settings.phone}</div>}
            </div>
          </div>
          <div className="mt-2 flex items-start justify-between gap-2">
            <div>
              <div className="text-ink-muted">{t('slip_title')}</div>
              <div className="money text-xl font-bold">{order.orderNumber}</div>
              <div className="mt-1 font-semibold">{order.customerName}</div>
              <div className="text-ink-muted">{itemsSummary(order, 4)}</div>
            </div>
            {qr && <img src={qr} alt="" className="size-20" />}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-[#fdf0dc] p-2">
            <span>{t('ord_orderDate')}</span>
            <span className="money text-right">{formatDate(fromISODate(order.orderDate))}</span>
            {order.trialDate && (
              <>
                <span>{t('cal_trials')}</span>
                <span className="money text-right">{formatDate(fromISODate(order.trialDate))}</span>
              </>
            )}
            <span className="font-bold">{t('ord_deliveryDate')}</span>
            <span className="money text-right font-bold">{formatDate(fromISODate(order.deliveryDate))}</span>
            <span>{t('ord_total')}</span>
            <span className="money text-right">{formatINR(total)}</span>
            <span>{t('ord_advancePaid')}</span>
            <span className="money text-right">{formatINR(paid)}</span>
            <span className="font-bold text-rani">{t('ord_balance')}</span>
            <span className="money text-right font-bold text-rani">{formatINR(Math.max(0, total - paid))}</span>
          </div>
          <p className="mt-2 text-center text-xs text-ink-muted">{t('slip_keep')}</p>
        </div>
      </div>
    </>
  )
}
