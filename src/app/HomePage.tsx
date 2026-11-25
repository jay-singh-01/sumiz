import { motion } from 'motion/react'
import { BarChart3, CalendarCheck, Clock, IndianRupee, Plus, Users, Wallet } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useSession } from '@/auth/AuthGate'
import { ArchCard } from '@/components/ui/card'
import { Elephant, Paisley, PeacockFeather } from '@/design/motifs'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { formatINR } from '@/lib/format'
import { haptic } from '@/lib/haptics'
import { useCollection } from '@/data/hooks'
import type { Stored } from '@/data/types'
import { itemsSummary, StatusChip } from '@/features/orders/components'
import { byUrgency, isDueToday, isOverdue } from '@/features/orders/logic'
import type { Order } from '@/features/orders/schema'
import { useLedger } from '@/features/bills/useLedger'
import { toISODate } from '@/lib/dates'

function BigTile({ to, label, icon, className, delay }: { to: string; label: string; icon: ReactNode; className: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26, delay }}>
      <Link
        to={to}
        onClick={() => haptic('tap')}
        className={cn(
          'relative flex aspect-[5/4] flex-col items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-card)] p-3 text-center shadow-lg transition active:scale-[0.97] [&_svg]:size-12',
          className,
        )}
      >
        <span className="pointer-events-none absolute -right-6 -bottom-6 size-24 rounded-full bg-white/10" />
        <span className="pointer-events-none absolute -top-4 -left-4 size-16 rounded-full bg-white/10" />
        {icon}
        <span className="text-2xl font-bold leading-tight">{label}</span>
      </Link>
    </motion.div>
  )
}

function Empty({ art, text }: { art: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-4 py-2 text-lg text-ink-muted">
      <span className="shrink-0">{art}</span>
      {text}
    </div>
  )
}

/** Up to 5 orders as tappable rows, then "+N more" to the orders list. */
function OrderMiniList({ orders }: { orders: Stored<Order>[] }) {
  const { t } = useI18n()
  return (
    <ul className="flex flex-col gap-2">
      {orders.slice(0, 5).map((o) => (
        <li key={o.id}>
          <Link to={`/orders/${o.id}`} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 active:bg-line">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-semibold">
                {o.urgent && '🔥 '}
                {o.customerName}
              </span>
              <span className="block truncate text-ink-muted">{itemsSummary(o, 2)}</span>
            </span>
            <StatusChip status={o.status} />
          </Link>
        </li>
      ))}
      {orders.length > 5 && (
        <Link to="/orders" className="min-h-12 px-1 font-semibold text-indigo-royal underline">
          {t('ord_more', { n: orders.length - 5 })}
        </Link>
      )}
    </ul>
  )
}

export function HomePage() {
  const { t, lang } = useI18n()
  const { member, shopId } = useSession()
  const [now] = useState(() => new Date())
  const today = new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)
  const orders = useCollection<Order>(shopId, 'orders')
  const { dues, debtors } = useLedger()
  const todayIso = toISODate(now)
  const dueToday = useMemo(() => (orders ?? []).filter((o) => isDueToday(o, todayIso)).sort(byUrgency), [orders, todayIso])
  const overdue = useMemo(() => (orders ?? []).filter((o) => isOverdue(o, todayIso)).sort(byUrgency), [orders, todayIso])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl">{t('welcome', { name: member.name })} 🙏</h1>
        <p className="text-lg text-ink-muted">{today}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <BigTile to="/orders/new" label={t('home_newOrder')} icon={<Plus strokeWidth={2.5} />} className="bg-rani text-on-rani" delay={0} />
        <BigTile to="/customers" label={t('home_customers')} icon={<Users />} className="bg-indigo-royal text-on-indigo" delay={0.05} />
        <BigTile to="/payments/new" label={t('home_payment')} icon={<Wallet />} className="bg-emerald-deep text-on-emerald" delay={0.1} />
        <BigTile to="/summary" label={t('home_summary')} icon={<BarChart3 />} className="bg-marigold text-on-marigold" delay={0.15} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ArchCard title={`${t('home_todayDeliveries')}${dueToday.length ? ` (${dueToday.length})` : ''}`} icon={<CalendarCheck />}>
          {dueToday.length === 0 ? (
            <Empty art={<Elephant className="h-14 w-20 text-indigo-royal/80" />} text={t('empty_deliveries')} />
          ) : (
            <OrderMiniList orders={dueToday} />
          )}
        </ArchCard>
        <ArchCard
          title={`${t('home_overdue')}${overdue.length ? ` (${overdue.length})` : ''}`}
          icon={<Clock />}
          className={overdue.length ? 'border-2 border-danger/60' : ''}
        >
          {overdue.length === 0 ? (
            <Empty art={<Paisley className="h-14 w-11 text-gold" />} text={t('empty_overdue')} />
          ) : (
            <OrderMiniList orders={overdue} />
          )}
        </ArchCard>
        <ArchCard title={t('home_dues')} icon={<IndianRupee />}>
          <div className="flex items-center gap-4">
            <PeacockFeather className="h-16 w-8 shrink-0" />
            <div>
              <div className={`money text-3xl font-bold ${dues > 0 ? 'text-rani' : 'text-emerald-deep'}`}>{formatINR(dues)}</div>
              <div className="text-ink-muted">{dues > 0 ? t('dues_customers', { n: debtors }) : t('empty_dues')}</div>
            </div>
          </div>
        </ArchCard>
      </div>
    </div>
  )
}
