import { Plus, Search, X } from 'lucide-react'
import { useDeferredValue, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useSession } from '@/auth/AuthGate'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip, PageHeader } from '@/components/ui/page'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { useCollection } from '@/data/hooks'
import type { Stored } from '@/data/types'
import { Paisley } from '@/design/motifs'
import { matchScore } from '@/features/customers/search'
import { useI18n } from '@/i18n'
import { changeStatus } from './actions'
import { OrderCard, StatusChip, todayISO } from './components'
import { byUrgency, isOpen, nextStatus } from './logic'
import { OPEN_STATUSES, type Order } from './schema'

type Filter = 'open' | 'ready' | 'delivered' | 'all'

export function useAdvanceOrder() {
  const { t } = useI18n()
  const { ctx } = useSession()
  return (o: Stored<Order>) => {
    const next = nextStatus(o.status)
    if (!next) return
    changeStatus(ctx, o, next)
    toast({
      message: t('ord_statusChanged', { num: o.orderNumber, status: t(`status_${next}`) }),
      undo: () => changeStatus(ctx, { ...o, status: next, version: o.version + 1, statusHistory: [...o.statusHistory] }, o.status),
    })
  }
}

export function OrdersPage() {
  const { t } = useI18n()
  const { shopId } = useSession()
  const orders = useCollection<Order>(shopId, 'orders')
  const [params, setParams] = useSearchParams()
  const filter = (params.get('f') as Filter) || 'open'
  const q = params.get('q') ?? ''
  const deferred = useDeferredValue(q)
  const today = todayISO()
  const advance = useAdvanceOrder()

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const list = useMemo(() => {
    let rows = orders ?? []
    if (filter === 'open') rows = rows.filter(isOpen)
    else if (filter === 'ready') rows = rows.filter((o) => o.status === 'ready')
    else if (filter === 'delivered') rows = rows.filter((o) => o.status === 'delivered')
    const query = deferred.trim()
    if (query) {
      const ql = query.toLowerCase()
      rows = rows.filter(
        (o) => o.orderNumber.toLowerCase().includes(ql) || matchScore({ name: o.customerName, phone: o.customerPhone }, query) !== null,
      )
    }
    return filter === 'delivered' || filter === 'all'
      ? [...rows].sort((a, b) => b.orderDate.localeCompare(a.orderDate) || b.orderNumber.localeCompare(a.orderNumber))
      : [...rows].sort(byUrgency)
  }, [orders, filter, deferred])

  const counts = useMemo(() => {
    const all = orders ?? []
    return { open: all.filter(isOpen).length, ready: all.filter((o) => o.status === 'ready').length }
  }, [orders])

  return (
    <div>
      <PageHeader title={t('nav_orders')} subtitle={orders ? t('ord_count', { n: counts.open }) + ` · ${t('ord_filter_open')}` : undefined} />

      <Button asChild block className="mb-3">
        <Link to="/orders/new">
          <Plus /> {t('home_newOrder')}
        </Link>
      </Button>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-ink-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => set('q', e.target.value)}
          placeholder={t('ord_searchHint')}
          aria-label={t('ord_searchHint')}
          className="min-h-14 w-full rounded-2xl border-2 border-line bg-surface pr-14 pl-13 text-xl focus:border-rani focus:outline-none"
        />
        {q && (
          <button type="button" aria-label="clear" onClick={() => set('q', '')} className="absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center text-ink-muted">
            <X className="size-6" />
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['open', 'ready', 'delivered', 'all'] as Filter[]).map((f) => (
          <Chip key={f} selected={filter === f} onClick={() => set('f', f === 'open' ? '' : f)}>
            {t(`ord_filter_${f}`)}
            {f === 'open' && ` (${counts.open})`}
            {f === 'ready' && ` (${counts.ready})`}
          </Chip>
        ))}
      </div>

      {orders === undefined ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card className="flex items-center gap-4 text-lg text-ink-muted">
          <Paisley className="h-16 w-12 shrink-0 text-gold" /> {t('ord_none')}
        </Card>
      ) : filter === 'open' && !deferred ? (
        <>
          {/* Phone: one list. Tablet/desktop: kanban board by status. */}
          <ul className="flex flex-col gap-3 md:hidden">
            {list.map((o) => (
              <li key={o.id}>
                <OrderCard order={o} today={today} onAdvance={advance} />
              </li>
            ))}
          </ul>
          <div className="hidden gap-3 overflow-x-auto pb-4 md:grid md:grid-cols-[repeat(5,minmax(13rem,1fr))]">
            {OPEN_STATUSES.map((s) => {
              const col = list.filter((o) => o.status === s)
              return (
                <section key={s} className="flex min-w-0 flex-col gap-2 rounded-2xl bg-surface-2 p-2">
                  <header className="flex items-center justify-between px-1">
                    <StatusChip status={s} />
                    <span className="money font-semibold text-ink-muted">{col.length}</span>
                  </header>
                  {col.map((o) => (
                    <OrderCard key={o.id} order={o} today={today} onAdvance={advance} compact />
                  ))}
                </section>
              )
            })}
          </div>
        </>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((o) => (
            <li key={o.id}>
              <OrderCard order={o} today={today} onAdvance={isOpen(o) ? advance : undefined} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
