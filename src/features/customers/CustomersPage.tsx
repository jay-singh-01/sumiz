import { motion } from 'motion/react'
import { MapPin, Phone, Search, UserPlus, X } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useSession } from '@/auth/AuthGate'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Avatar, PageHeader } from '@/components/ui/page'
import { Skeleton } from '@/components/ui/skeleton'
import { useCollection } from '@/data/hooks'
import type { Stored } from '@/data/types'
import { Elephant } from '@/design/motifs'
import { useI18n } from '@/i18n'
import { formatPhone } from '@/lib/whatsapp'
import { BalanceText } from '@/features/bills/LedgerTab'
import { useLedger } from '@/features/bills/useLedger'
import type { Customer } from './schema'
import { searchCustomers } from './search'

const PAGE = 50

export const byRecent = (a: Stored<unknown>, b: Stored<unknown>) => (b.updatedAt?.toMillis() ?? Infinity) - (a.updatedAt?.toMillis() ?? Infinity)

export function TagChips({ tags }: { tags: string[] }) {
  const { t } = useI18n()
  if (!tags.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full bg-marigold/25 px-2 py-0.5 text-sm font-semibold text-ink">
          {['regular', 'vip', 'wedding'].includes(tag) ? t(`tag_${tag}` as 'tag_vip') : tag}
        </span>
      ))}
    </div>
  )
}

export function CustomersPage() {
  const { t } = useI18n()
  const { shopId } = useSession()
  const customers = useCollection<Customer>(shopId, 'customers')
  const { balances } = useLedger()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const deferred = useDeferredValue(q)
  const [limit, setLimit] = useState(PAGE)

  const results = useMemo(() => searchCustomers([...(customers ?? [])].sort(byRecent), deferred), [customers, deferred])

  const setQuery = (v: string) => {
    setLimit(PAGE)
    setParams(v ? { q: v } : {}, { replace: true })
  }

  return (
    <div>
      <PageHeader
        title={t('nav_customers')}
        subtitle={customers ? t('cust_count', { n: customers.length }) : undefined}
      />

      <div className="sticky top-[4.6rem] z-20 -mx-4 mb-4 bg-ivory/95 px-4 pb-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0">
        <div className="relative" data-tour="customer-search">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('cust_search')}
            aria-label={t('cust_search')}
            className="min-h-14 w-full rounded-2xl border-2 border-line bg-surface pr-14 pl-13 text-xl focus:border-rani focus:outline-none"
          />
          {q && (
            <button
              type="button"
              aria-label="clear"
              onClick={() => setQuery('')}
              className="absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-ink-muted"
            >
              <X className="size-6" />
            </button>
          )}
        </div>
        <Button asChild block className="mt-3" data-tour="customer-add">
          <Link to={`/customers/new${q ? `?name=${encodeURIComponent(q)}` : ''}`}>
            <UserPlus /> {t('cust_add')}
          </Link>
        </Button>
      </div>

      {customers === undefined ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <Elephant className="h-24 w-36 text-indigo-royal/80" />
          <p className="text-xl">{q ? t('cust_noMatch', { q }) : t('cust_none')}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {results.slice(0, limit).map((c, i) => (
            <motion.li key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.02 }}>
              <Link
                to={`/customers/${c.id}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm active:bg-surface-2"
              >
                <Avatar name={c.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xl font-semibold">{c.name}</div>
                  <div className="flex flex-wrap gap-x-3 text-ink-muted">
                    {c.phone && (
                      <span className="money inline-flex items-center gap-1">
                        <Phone className="size-4" />
                        {formatPhone(c.phone)}
                      </span>
                    )}
                    {c.area && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-4" />
                        {c.area}
                      </span>
                    )}
                  </div>
                  <TagChips tags={c.tags ?? []} />
                </div>
                {(balances.get(c.id) ?? 0) > 0 && <BalanceText balance={balances.get(c.id)!} className="text-lg" />}
              </Link>
            </motion.li>
          ))}
          {results.length > limit && (
            <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
              {t('cust_showMore')} ({results.length - limit})
            </Button>
          )}
        </ul>
      )}
    </div>
  )
}
