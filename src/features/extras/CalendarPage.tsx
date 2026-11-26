import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSession } from '@/auth/AuthGate'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page'
import { useCollection } from '@/data/hooks'
import { OrderCard, todayISO } from '@/features/orders/components'
import { isOpen } from '@/features/orders/logic'
import type { Order } from '@/features/orders/schema'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { toISODate } from '@/lib/dates'

/** Month view of deliveries (rani dot) and trials (indigo dot) for open orders. */
export function CalendarPage() {
  const { t, lang } = useI18n()
  const { shopId } = useSession()
  const orders = useCollection<Order>(shopId, 'orders')
  const today = todayISO()
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState(today)

  const byDay = useMemo(() => {
    const m = new Map<string, { deliveries: number; trials: number }>()
    for (const o of orders ?? []) {
      if (!isOpen(o)) continue
      const d = m.get(o.deliveryDate) ?? { deliveries: 0, trials: 0 }
      d.deliveries++
      m.set(o.deliveryDate, d)
      if (o.trialDate) {
        const tr = m.get(o.trialDate) ?? { deliveries: 0, trials: 0 }
        tr.trials++
        m.set(o.trialDate, tr)
      }
    }
    return m
  }, [orders])

  const cells = useMemo(() => {
    const first = (month.getDay() + 6) % 7 // Monday-first
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    return [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => toISODate(new Date(month.getFullYear(), month.getMonth(), i + 1)))]
  }, [month])

  const dayOrders = (orders ?? []).filter((o) => isOpen(o) && (o.deliveryDate === selected || o.trialDate === selected))
  const monthTitle = new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric' }).format(month)
  const weekdays = lang === 'hi' ? ['सो', 'मं', 'बु', 'गु', 'शु', 'श', 'र'] : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('cal_title')} back="/more" />
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label={t('cal_prev')} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <ChevronLeft />
          </Button>
          <h2 className="flex-1 text-center text-2xl">{monthTitle}</h2>
          <Button variant="ghost" size="icon" aria-label={t('cal_next')} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdays.map((w) => (
            <div key={w} className="text-sm font-semibold text-ink-muted">
              {w}
            </div>
          ))}
          {cells.map((iso, i) =>
            iso === null ? (
              <div key={`b${i}`} />
            ) : (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                aria-pressed={selected === iso}
                aria-label={iso}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center rounded-xl text-lg',
                  selected === iso ? 'bg-rani text-on-rani' : iso === today ? 'border-2 border-rani' : 'bg-surface-2',
                )}
              >
                <span className="money font-semibold">{Number(iso.slice(8))}</span>
                <span className="flex gap-0.5">
                  {byDay.get(iso)?.deliveries ? <span className={cn('size-2 rounded-full', selected === iso ? 'bg-on-rani' : 'bg-rani')} /> : null}
                  {byDay.get(iso)?.trials ? <span className={cn('size-2 rounded-full', selected === iso ? 'bg-on-rani' : 'bg-indigo-royal')} /> : null}
                </span>
              </button>
            ),
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-ink-muted">
          <span className="flex items-center gap-1">
            <span className="size-3 rounded-full bg-rani" /> {t('cal_deliveries')}
          </span>
          <span className="flex items-center gap-1">
            <span className="size-3 rounded-full bg-indigo-royal" /> {t('cal_trials')}
          </span>
          <Button
            variant="ghost"
            size="md"
            className="ml-auto"
            onClick={() => {
              const d = new Date()
              setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
              setSelected(today)
            }}
          >
            {t('cal_todayBtn')}
          </Button>
        </div>
      </Card>
      {dayOrders.length === 0 ? (
        <Card className="text-lg text-ink-muted">{t('cal_none')}</Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {dayOrders.map((o) => (
            <li key={o.id}>
              {o.trialDate === selected && <span className="mb-1 inline-block rounded-full bg-indigo-royal px-3 py-0.5 text-sm font-semibold text-on-indigo">{t('cal_trials')}</span>}
              <OrderCard order={o} today={today} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
