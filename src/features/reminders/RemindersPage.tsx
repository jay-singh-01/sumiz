import { CheckCircle2, MessageCircle, SkipForward } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useSession } from '@/auth/AuthGate'
import { Button } from '@/components/ui/button'
import { ArchCard, Card } from '@/components/ui/card'
import { Chip, PageHeader, Tabs } from '@/components/ui/page'
import { toast } from '@/components/ui/toast'
import { useCollection } from '@/data/hooks'
import { Elephant } from '@/design/motifs'
import { billPaid, daysBetween, oldestDueDate } from '@/features/bills/ledger'
import { useLedger } from '@/features/bills/useLedger'
import type { Customer } from '@/features/customers/schema'
import { orderTotal } from '@/features/orders/logic'
import type { Order } from '@/features/orders/schema'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { fromISODate, toISODate } from '@/lib/dates'
import { formatDate, formatINR } from '@/lib/format'
import { haptic } from '@/lib/haptics'
import { useReminders, type ReminderTarget } from './useReminders'

type Tab = 'dues' | 'ready' | 'trial'
const THRESHOLDS = [0, 15, 30, 60]

interface Row {
  key: string
  target: ReminderTarget
  title: string
  detail: string
  link: string
}

function relative(ms: number | undefined, lang: 'hi' | 'en', now: number) {
  if (!ms) return null
  const days = Math.floor((now - ms) / 86_400_000)
  if (days <= 0) return lang === 'hi' ? 'आज' : 'today'
  return lang === 'hi' ? `${days} दिन पहले` : `${days} days ago`
}

export function RemindersPage() {
  const { t, lang } = useI18n()
  const { shopId } = useSession()
  const customers = useCollection<Customer>(shopId, 'customers')
  const orders = useCollection<Order>(shopId, 'orders')
  const { bills, payments, balances } = useLedger()
  const { send, message, lastSent } = useReminders()
  const [tab, setTab] = useState<Tab>('dues')
  const [minDays, setMinDays] = useState(15)
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [cursor, setCursor] = useState(0)
  const [now] = useState(() => Date.now())
  const today = toISODate(new Date(now))
  const tomorrow = toISODate(new Date(now + 86_400_000))

  const rows = useMemo<Row[]>(() => {
    if (!customers || !orders || !bills || !payments) return []
    const byId = new Map(customers.map((c) => [c.id, c]))
    if (tab === 'dues') {
      return [...balances]
        .filter(([, bal]) => bal > 0)
        .map(([id, bal]) => {
          const c = byId.get(id)
          const since = oldestDueDate(id, bills, payments)
          const age = since ? daysBetween(since, today) : 0
          return { c, bal, age, id }
        })
        .filter((x) => x.c && x.age >= minDays)
        .sort((a, b) => b.age - a.age || b.bal - a.bal)
        .map(({ c, bal, age, id }) => ({
          key: `dues:${id}`,
          target: { customerId: id, customerName: c!.name, phone: c!.phone, type: 'paymentDue' as const, amount: bal },
          title: c!.name,
          detail: `${formatINR(bal)} · ${age > 0 ? t('rem_daysOld', { n: age }) : t('rem_dueToday')}`,
          link: `/customers/${id}?tab=money`,
        }))
    }
    if (tab === 'ready') {
      return orders
        .filter((o) => o.status === 'ready')
        .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))
        .map((o) => {
          const bill = bills.find((b) => b.orderId === o.id)
          const due = bill
            ? bill.total - billPaid(bill, payments)
            : orderTotal(o) - payments.filter((p) => p.orderId === o.id).reduce((s, p) => s + p.amount, 0)
          return {
            key: `ready:${o.id}`,
            target: {
              customerId: o.customerId,
              customerName: o.customerName,
              phone: o.customerPhone,
              type: 'ready' as const,
              amount: Math.max(0, Math.round(due * 100) / 100),
              orderNumber: o.orderNumber,
              orderId: o.id,
              billId: bill?.id ?? null,
            },
            title: o.customerName,
            detail: `${o.orderNumber}${due > 0 ? ` · ${t('ord_balance')} ${formatINR(due)}` : ''}`,
            link: `/orders/${o.id}`,
          }
        })
    }
    return orders
      .filter((o) => ['received', 'cutting', 'stitching', 'trial'].includes(o.status) && (o.trialDate === today || o.trialDate === tomorrow))
      .sort((a, b) => a.trialDate.localeCompare(b.trialDate))
      .map((o) => ({
        key: `trial:${o.id}`,
        target: {
          customerId: o.customerId,
          customerName: o.customerName,
          phone: o.customerPhone,
          type: 'trial' as const,
          orderNumber: o.orderNumber,
          date: formatDate(fromISODate(o.trialDate)),
          orderId: o.id,
        },
        title: o.customerName,
        detail: `${o.orderNumber} · ${o.trialDate === today ? t('rem_today') : t('rem_tomorrow')}`,
        link: `/orders/${o.id}`,
      }))
  }, [tab, customers, orders, bills, payments, balances, minDays, today, tomorrow, t])

  const pending = rows.filter((r) => !sent.has(r.key))
  const current = pending[Math.min(cursor, Math.max(0, pending.length - 1))]

  const doSend = (r: Row) => {
    haptic('tap')
    if (!send(r.target)) return toast({ message: `⚠️ ${t('rem_noPhone')}` })
    setSent((s) => new Set(s).add(r.key))
  }

  const empty = { dues: t('rem_noneDues'), ready: t('rem_noneReady'), trial: t('rem_noneTrial') }[tab]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('rem_title')} subtitle={rows.length ? t('rem_count', { n: rows.length }) : undefined} back="/" />

      <Tabs<Tab>
        value={tab}
        onChange={(v) => {
          setTab(v)
          setCursor(0)
        }}
        items={[
          { value: 'dues', label: t('rem_dues') },
          { value: 'ready', label: t('rem_ready') },
          { value: 'trial', label: t('rem_trial') },
        ]}
      />

      {tab === 'dues' && (
        <div className="flex flex-col gap-2">
          <span className="text-lg font-semibold">{t('rem_olderThan')}</span>
          <div className="flex flex-wrap gap-2">
            {THRESHOLDS.map((n) => (
              <Chip key={n} selected={minDays === n} onClick={() => setMinDays(n)}>
                {n === 0 ? t('rem_all') : t('rem_days', { n })}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <Card className="flex items-center gap-4 text-lg text-ink-muted">
          <Elephant className="h-14 w-20 shrink-0 text-indigo-royal/80" /> {empty}
        </Card>
      ) : (
        <>
          {current && (
            <ArchCard title={current.title} icon={<MessageCircle />} className="border-2 border-emerald-deep">
              <p className="mb-1 text-ink-muted">{current.detail}</p>
              <p className="mb-2 text-sm text-ink-muted">
                {(() => {
                  const ago = relative(lastSent.get(`${current.target.customerId}:${current.target.type}`), lang, now)
                  return ago ? t('rem_last', { ago }) : t('rem_never')
                })()}
              </p>
              <p className="rounded-xl bg-surface-2 p-3 text-lg whitespace-pre-line">{message(current.target)}</p>
              <p className="mt-2 text-sm text-ink-muted">{t('rem_help')}</p>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <Button variant="success" onClick={() => doSend(current)}>
                  <MessageCircle /> {t('rem_send')}
                </Button>
                <Button variant="secondary" onClick={() => setCursor((c) => (c + 1) % Math.max(1, pending.length))} aria-label={t('rem_next')}>
                  <SkipForward /> {t('rem_next')}
                </Button>
              </div>
            </ArchCard>
          )}

          <ul className="flex flex-col gap-2">
            {rows.map((r) => {
              const done = sent.has(r.key)
              const ago = relative(lastSent.get(`${r.target.customerId}:${r.target.type}`), lang, now)
              return (
                <li key={r.key} className={cn('flex items-center gap-3 rounded-2xl border border-line bg-surface p-3', done && 'opacity-60', r.key === current?.key && 'ring-2 ring-emerald-deep')}>
                  <Link to={r.link} className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-semibold">{r.title}</span>
                    <span className="money block text-ink-muted">{r.detail}</span>
                    <span className="block text-sm text-ink-muted">{ago ? t('rem_last', { ago }) : t('rem_never')}</span>
                  </Link>
                  {done ? (
                    <span className="flex items-center gap-1 font-semibold text-emerald-deep">
                      <CheckCircle2 className="size-5" /> {t('rem_sent')}
                    </span>
                  ) : (
                    <Button variant="success" size="icon" aria-label={t('rem_send')} onClick={() => doSend(r)}>
                      <MessageCircle />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
