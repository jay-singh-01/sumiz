import { ArrowRight, CalendarDays, CheckCircle2, MessageCircle, Pencil, Phone, Plus, RotateCcw, XCircle } from 'lucide-react'
import { Dialog as D } from 'radix-ui'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useSession } from '@/auth/AuthGate'
import { useSettings } from '@/app/useShop'
import { Button } from '@/components/ui/button'
import { ArchCard, Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page'
import { toast } from '@/components/ui/toast'
import { useCollection } from '@/data/hooks'
import { MarigoldBurst } from '@/design/motifs'
import type { GarmentType } from '@/features/master/schema'
import type { Payment } from '@/features/payments/schema'
import { useI18n } from '@/i18n'
import { format } from '@/i18n/format'
import { strings } from '@/i18n/strings'
import { cn } from '@/lib/cn'
import { agoLabel, fromISODate } from '@/lib/dates'
import { formatDate, formatINR } from '@/lib/format'
import { formatPhone, telLink, whatsappLink } from '@/lib/whatsapp'
import { changeStatus } from './actions'
import { DueLabel, STATUS_ICON, StatusChip, todayISO } from './components'
import { itemTotal, nextStatus, orderTotal } from './logic'
import { ORDER_STATUSES, PIPELINE, type Order, type OrderStatus } from './schema'

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const { t, lang } = useI18n()
  const { shopId, ctx } = useSession()
  const [params, setParams] = useSearchParams()
  const { settings } = useSettings()
  const orders = useCollection<Order>(shopId, 'orders')
  const payments = useCollection<Payment>(shopId, 'payments')
  const garments = useCollection<GarmentType>(shopId, 'garmentTypes', { includeDeleted: true })
  const [picker, setPicker] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [burst, setBurst] = useState(false)

  const order = orders?.find((o) => o.id === id)
  const paid = useMemo(() => (payments ?? []).filter((p) => p.orderId === id).reduce((s, p) => s + p.amount, 0), [payments, id])
  if (orders === undefined) return null
  if (!order) return <PageHeader title={t('ord_none')} back="/orders" />

  const total = orderTotal(order)
  const next = nextStatus(order.status)
  const created = params.get('created') === '1'
  const today = todayISO()

  const move = (status: OrderStatus) => {
    if (status === order.status) return
    changeStatus(ctx, order, status)
    if (status === 'delivered') {
      setBurst(true)
      setTimeout(() => setBurst(false), 1700)
    }
    toast({
      message: t('ord_statusChanged', { num: order.orderNumber, status: t(`status_${status}`) }),
      undo: () => changeStatus(ctx, { ...order, status, version: order.version + 1 }, order.status),
    })
  }

  // Confirmation message in the customer's language preference isn't known; use the app language.
  const confirmMsg = format(strings[lang].ord_confirmMsg, {
    name: order.customerName,
    num: order.orderNumber,
    total: formatINR(total).replace('₹', ''),
    advance: formatINR(paid).replace('₹', ''),
    date: formatDate(fromISODate(order.deliveryDate)),
    shop: settings.shopName,
  })
  const waConfirm = whatsappLink(order.customerPhone, confirmMsg)
  const waChat = whatsappLink(order.customerPhone)
  const tel = telLink(order.customerPhone)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={order.customerName} subtitle={<span className="money">{order.orderNumber}</span>} back="/orders" action={<StatusChip status={order.status} className="text-base" />} />

      {created && (
        <Card className="flex flex-col gap-3 border-2 border-emerald-deep bg-emerald-deep/10">
          <p className="flex items-center gap-2 text-xl font-semibold text-emerald-deep">
            <CheckCircle2 className="size-7" /> {t('ord_saved', { num: order.orderNumber })}
          </p>
          {waConfirm && (
            <Button asChild variant="success" block>
              <a href={waConfirm} target="_blank" rel="noreferrer">
                <MessageCircle /> {t('ord_whatsappConfirm')}
              </a>
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="md" onClick={() => setParams({}, { replace: true })}>
              {t('ord_view')}
            </Button>
            <Button asChild variant="secondary" size="md">
              <Link to="/orders/new">
                <Plus /> {t('ord_another')}
              </Link>
            </Button>
          </div>
        </Card>
      )}

      {/* Pipeline stepper + the one big next-step button. */}
      <Card className="flex flex-col gap-3">
        <ol className="flex items-center gap-1 overflow-x-auto pb-1" aria-label={t('ord_changeStatus')}>
          {PIPELINE.map((s, i) => {
            const reached = order.status !== 'cancelled' && PIPELINE.indexOf(order.status) >= i
            const current = s === order.status
            return (
              <li key={s} className="flex items-center gap-1">
                <span
                  className={cn(
                    'flex flex-col items-center rounded-xl px-2 py-1 text-center text-sm font-semibold whitespace-nowrap',
                    current ? 'bg-rani text-on-rani' : reached ? 'text-emerald-deep' : 'text-ink-muted',
                  )}
                >
                  <span className="text-xl" aria-hidden>
                    {STATUS_ICON[s]}
                  </span>
                  {t(`status_${s}`)}
                </span>
                {i < PIPELINE.length - 1 && <span className={cn('h-0.5 w-3 shrink-0', reached ? 'bg-emerald-deep' : 'bg-line')} />}
              </li>
            )
          })}
        </ol>
        {next && (
          <Button variant={next === 'delivered' ? 'success' : 'primary'} block onClick={() => move(next)}>
            {STATUS_ICON[next]} {t('ord_moveTo', { status: t(`status_${next}`) })} <ArrowRight />
          </Button>
        )}
        {order.status === 'cancelled' && (
          <Button variant="secondary" block onClick={() => move('received')}>
            <RotateCcw /> {t('ord_moveTo', { status: t('status_received') })}
          </Button>
        )}
        <Button variant="ghost" size="md" onClick={() => setPicker(true)}>
          {t('ord_changeStatus')}
        </Button>
      </Card>

      <Card className="grid grid-cols-3 gap-2">
        <Button asChild variant="success" size="md" className={cn('min-h-16 flex-col gap-0.5 px-1 text-base', !waChat && 'pointer-events-none opacity-40')}>
          <a href={waChat ?? undefined} target="_blank" rel="noreferrer">
            <MessageCircle /> {t('whatsapp')}
          </a>
        </Button>
        <Button asChild variant="secondary" size="md" className={cn('min-h-16 flex-col gap-0.5 px-1 text-base', !tel && 'pointer-events-none opacity-40')}>
          <a href={tel ?? undefined}>
            <Phone /> {t('call')}
          </a>
        </Button>
        <Button asChild variant="secondary" size="md" className="min-h-16 flex-col gap-0.5 px-1 text-base">
          <Link to={`/orders/${order.id}/edit`}>
            <Pencil /> {t('edit')}
          </Link>
        </Button>
      </Card>

      <ArchCard title={t('ord_dates')} icon={<CalendarDays />}>
        <div className="flex flex-col gap-1 text-lg">
          <div>
            {t('ord_orderDate')}: <span className="money font-semibold">{formatDate(fromISODate(order.orderDate))}</span>
          </div>
          {order.trialDate && <div>{t('ord_trialOn', { date: formatDate(fromISODate(order.trialDate)) })}</div>}
          <DueLabel order={order} today={today} />
          {order.urgent && <div className="font-semibold text-saffron">🔥 {t('ord_urgentBadge')}</div>}
          {order.customerPhone && (
            <Link to={`/customers/${order.customerId}`} className="mt-1 font-semibold text-indigo-royal underline">
              {order.customerName} · {formatPhone(order.customerPhone)}
            </Link>
          )}
          {order.notes && <p className="mt-1 whitespace-pre-line">📝 {order.notes}</p>}
        </div>
      </ArchCard>

      <ArchCard title={t('ord_items')}>
        <ul className="flex flex-col gap-4">
          {order.items.map((item, i) => {
            const g = garments?.find((x) => x.id === item.garmentTypeId)
            const labelFor = (k: string) => {
              const f = g?.measurementFields.find((x) => x.key === k)
              return f ? (lang === 'hi' ? f.labelHi : f.labelEn) : k
            }
            return (
              <li key={i} className="border-b border-line pb-3 last:border-0">
                <div className="flex justify-between gap-2 text-lg">
                  <span className="font-semibold">
                    {g?.icon} {item.garmentName} {item.qty > 1 && `×${item.qty}`}
                  </span>
                  <span className="money font-bold">{formatINR(itemTotal(item))}</span>
                </div>
                <div className="money text-ink-muted">
                  {formatINR(item.rate)}
                  {item.addOns.map((a) => ` + ${a.name} ${formatINR(a.rate)}`).join('')}
                </div>
                {item.fabricNotes && <div>🧵 {item.fabricNotes}</div>}
                {!item.fabricByCustomer && <div className="text-ink-muted">({t('ord_fabric')}: {t('no')})</div>}
                {item.notes && <div className="whitespace-pre-line">📝 {item.notes}</div>}
                {item.measurementTakenOn ? (
                  <div className="mt-2 rounded-xl bg-surface-2 p-2">
                    <div className="mb-1 text-sm font-semibold text-gold-deep">{t('ord_measUsing', { ago: agoLabel(item.measurementTakenOn, lang) })}</div>
                    <dl className="grid grid-cols-2 gap-x-3 sm:grid-cols-3">
                      {Object.entries(item.measurements).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2 border-b border-line py-0.5">
                          <dt className="text-ink-muted">{labelFor(k)}</dt>
                          <dd className="money font-bold">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : (
                  <Link to={`/customers/${order.customerId}/measure?garment=${item.garmentTypeId}`} className="mt-1 inline-block font-semibold text-indigo-royal underline">
                    📏 {t('ord_takeMeasure')}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
        <div className="mt-3 flex flex-col gap-1 border-t-2 border-gold pt-3 text-lg">
          <div className="flex justify-between">
            <span>{t('ord_total')}</span>
            <span className="money font-bold">{formatINR(total)}</span>
          </div>
          {paid > 0 && (
            <div className="flex justify-between text-emerald-deep">
              <span>{t('ord_advancePaid')}</span>
              <span className="money">− {formatINR(paid)}</span>
            </div>
          )}
          <div className="flex justify-between rounded-xl bg-rani px-3 py-2 text-on-rani">
            <span>{t('ord_balance')}</span>
            <span className="money text-2xl font-bold">{formatINR(Math.max(0, total - paid))}</span>
          </div>
        </div>
      </ArchCard>

      <ArchCard title={t('ord_history')}>
        <ol className="flex flex-col gap-1">
          {[...order.statusHistory].reverse().map((h, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <StatusChip status={h.status} />
              <span className="money text-ink-muted">
                {new Date(h.at).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {t('ord_by', { name: h.by })}
              </span>
            </li>
          ))}
        </ol>
      </ArchCard>

      {order.status !== 'cancelled' && order.status !== 'delivered' && (
        <Button variant="danger" block onClick={() => setConfirmCancel(true)}>
          <XCircle /> {t('ord_cancel')}
        </Button>
      )}

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t('ord_cancelConfirm', { num: order.orderNumber })}
        body={t('ord_cancelBody')}
        danger
        onConfirm={() => move('cancelled')}
      />

      <D.Root open={picker} onOpenChange={setPicker}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <D.Content className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-[var(--radius-card)] border-2 border-gold bg-surface p-4 shadow-2xl">
            <D.Title className="mb-3 font-display text-2xl text-indigo-royal">{t('ord_changeStatus')}</D.Title>
            <D.Description className="sr-only">{order.orderNumber}</D.Description>
            <div className="flex flex-col gap-2">
              {ORDER_STATUSES.map((s) => (
                <Button
                  key={s}
                  variant={s === order.status ? 'primary' : 'secondary'}
                  block
                  onClick={() => {
                    setPicker(false)
                    if (s === 'cancelled') setConfirmCancel(true)
                    else move(s)
                  }}
                >
                  {STATUS_ICON[s]} {t(`status_${s}`)}
                </Button>
              ))}
            </div>
          </D.Content>
        </D.Portal>
      </D.Root>
      <MarigoldBurst show={burst} />
    </div>
  )
}
