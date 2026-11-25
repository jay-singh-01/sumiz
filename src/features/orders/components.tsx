import { AlertTriangle, ArrowRight, Flame } from 'lucide-react'
import { Link } from 'react-router'
import type { Stored } from '@/data/types'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { fromISODate, toISODate } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import { haptic } from '@/lib/haptics'
import { isDueToday, isOverdue, nextStatus } from './logic'
import type { Order, OrderStatus } from './schema'

export const STATUS_STYLE: Record<OrderStatus, string> = {
  received: 'bg-surface-2 text-ink border border-line',
  cutting: 'bg-marigold text-on-marigold',
  stitching: 'bg-indigo-royal text-on-indigo',
  trial: 'bg-saffron text-on-marigold',
  ready: 'bg-emerald-deep text-on-emerald',
  delivered: 'bg-line text-ink',
  cancelled: 'bg-danger text-on-danger',
}

export const STATUS_ICON: Record<OrderStatus, string> = {
  received: '📥',
  cutting: '✂️',
  stitching: '🪡',
  trial: '👗',
  ready: '✅',
  delivered: '🎁',
  cancelled: '✖️',
}

export function StatusChip({ status, className }: { status: OrderStatus; className?: string }) {
  const { t } = useI18n()
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap', STATUS_STYLE[status], className)}>
      <span aria-hidden>{STATUS_ICON[status]}</span> {t(`status_${status}`)}
    </span>
  )
}

export function DueLabel({ order, today }: { order: Pick<Order, 'status' | 'deliveryDate'>; today: string }) {
  const { t } = useI18n()
  if (isOverdue(order, today))
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-danger">
        <AlertTriangle className="size-4" /> {t('ord_overdue')} · {formatDate(fromISODate(order.deliveryDate))}
      </span>
    )
  if (isDueToday(order, today)) return <span className="font-semibold text-gold-deep">⏰ {t('ord_dueToday')}</span>
  return <span className="text-ink-muted">{t('ord_dueOn', { date: formatDate(fromISODate(order.deliveryDate)) })}</span>
}

/** "ब्लाउज़ ×2, लहंगा" */
export function itemsSummary(order: Pick<Order, 'items'>, max = 3): string {
  const parts = order.items.map((i) => (i.qty > 1 ? `${i.garmentName} ×${i.qty}` : i.garmentName))
  return parts.length > max ? `${parts.slice(0, max).join(', ')} +${parts.length - max}` : parts.join(', ')
}

export const todayISO = () => toISODate(new Date())

export function OrderCard({
  order,
  today,
  onAdvance,
  compact,
}: {
  order: Stored<Order>
  today: string
  /** When given, shows a button to move the order to its next status. */
  onAdvance?: (o: Stored<Order>) => void
  compact?: boolean
}) {
  const { t } = useI18n()
  const next = nextStatus(order.status)
  return (
    <div
      className={cn(
        'rounded-2xl border bg-surface shadow-sm',
        isOverdue(order, today) ? 'border-danger/60' : 'border-line',
        order.urgent && order.status !== 'delivered' && 'ring-2 ring-saffron/50',
      )}
    >
      <Link to={`/orders/${order.id}`} className="block p-3 active:bg-surface-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-xl font-semibold">{order.customerName}</div>
            <div className="money text-sm text-ink-muted">{order.orderNumber}</div>
          </div>
          {!compact && <StatusChip status={order.status} />}
        </div>
        <div className="mt-1 truncate">{itemsSummary(order)}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 text-base">
          <DueLabel order={order} today={today} />
          {order.urgent && order.status !== 'delivered' && (
            <span className="inline-flex items-center gap-1 font-semibold text-saffron">
              <Flame className="size-4" /> {t('ord_urgentBadge')}
            </span>
          )}
        </div>
      </Link>
      {onAdvance && next && (
        <button
          type="button"
          onClick={() => {
            haptic('success')
            onAdvance(order)
          }}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-b-2xl border-t border-line font-semibold text-indigo-royal active:bg-surface-2"
        >
          {t('ord_moveTo', { status: t(`status_${next}`) })} <ArrowRight className="size-5" />
        </button>
      )}
    </div>
  )
}
