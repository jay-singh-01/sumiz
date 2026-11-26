import { RotateCcw } from 'lucide-react'
import { useMemo } from 'react'
import { useSession } from '@/auth/AuthGate'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page'
import { toast } from '@/components/ui/toast'
import type { AuditedCollection } from '@/data/collections'
import { useCollection } from '@/data/hooks'
import type { ShopUser } from '@/data/schemas'
import type { Stored } from '@/data/types'
import { restoreRecord } from '@/data/write'
import { Elephant } from '@/design/motifs'
import { useI18n } from '@/i18n'
import type { StringKey } from '@/i18n/strings'
import { formatDate, formatINR } from '@/lib/format'

type Any = Stored<Record<string, unknown>>

const KINDS: { coll: AuditedCollection; label: StringKey; title: (d: Any) => string }[] = [
  { coll: 'customers', label: 'nav_customers', title: (d) => String(d.name ?? '') },
  { coll: 'orders', label: 'nav_orders', title: (d) => `${d.orderNumber} · ${d.customerName}` },
  { coll: 'bills', label: 'bill', title: (d) => `${d.billNumber} · ${d.customerName} · ${formatINR(Number(d.total) || 0)}` },
  { coll: 'payments', label: 'pay_title', title: (d) => `${d.customerName} · ${formatINR(Number(d.amount) || 0)} · ${d.date}` },
  { coll: 'measurements', label: 'tab_measurements', title: (d) => `${d.garmentName} · ${d.takenOn}` },
  { coll: 'reminders', label: 'rem_title', title: (d) => `${d.customerName}` },
]

export function RecycleBinPage() {
  const { t } = useI18n()
  const { shopId, ctx } = useSession()
  const users = useCollection<ShopUser>(shopId, 'users', { includeDeleted: true })
  const opts = { includeDeleted: true }
  const customers = useCollection<Record<string, unknown>>(shopId, 'customers', opts)
  const orders = useCollection<Record<string, unknown>>(shopId, 'orders', opts)
  const bills = useCollection<Record<string, unknown>>(shopId, 'bills', opts)
  const payments = useCollection<Record<string, unknown>>(shopId, 'payments', opts)
  const measurements = useCollection<Record<string, unknown>>(shopId, 'measurements', opts)
  const reminders = useCollection<Record<string, unknown>>(shopId, 'reminders', opts)

  const deleted = useMemo(() => {
    const rows: Record<string, Any[] | undefined> = { customers, orders, bills, payments, measurements, reminders }
    return KINDS.flatMap((k) => (rows[k.coll] ?? []).filter((d) => d.isDeleted).map((d) => ({ kind: k, doc: d })))
      .sort((a, b) => (b.doc.deletedAt?.toMillis() ?? 0) - (a.doc.deletedAt?.toMillis() ?? 0))
  }, [customers, orders, bills, payments, measurements, reminders])
  const nameOf = (uid?: string) => users?.find((u) => u.id === uid)?.name ?? '—'

  const restore = (coll: AuditedCollection, d: Any, title: string) => {
    restoreRecord(ctx, coll, d, { label: title })
    toast({ message: t('rb_restored', { name: title }) })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('rb_title')} subtitle={t('rb_help')} back="/backup" />
      {deleted.length === 0 ? (
        <Card className="flex items-center gap-4 text-lg text-ink-muted">
          <Elephant className="h-14 w-20 shrink-0 text-indigo-royal/80" /> {t('rb_empty')}
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {deleted.map(({ kind, doc }) => {
            const title = kind.title(doc)
            return (
              <li key={`${kind.coll}/${doc.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gold-deep">{t(kind.label)}</div>
                  <div className="truncate text-lg font-semibold">{title}</div>
                  <div className="text-sm text-ink-muted">
                    {t('rb_deletedBy', { name: nameOf(doc.deletedBy), date: doc.deletedAt ? formatDate(doc.deletedAt.toDate()) : '—' })}
                  </div>
                </div>
                <Button variant="success" size="md" onClick={() => restore(kind.coll, doc, title)}>
                  <RotateCcw /> {t('rb_restore')}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
