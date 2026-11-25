import { ChevronDown, IndianRupee, MapPin, MessageCircle, Pencil, Phone, Plus, Ruler, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useSession } from '@/auth/AuthGate'
import { Button } from '@/components/ui/button'
import { ArchCard, Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Avatar, PageHeader, Tabs } from '@/components/ui/page'
import { toast } from '@/components/ui/toast'
import { useCollection } from '@/data/hooks'
import type { Stored } from '@/data/types'
import { restoreRecord, softDeleteRecord } from '@/data/write'
import { Paisley } from '@/design/motifs'
import { BalanceText, LedgerTab } from '@/features/bills/LedgerTab'
import { useLedger } from '@/features/bills/useLedger'
import type { GarmentType } from '@/features/master/schema'
import type { Measurement } from '@/features/measurements/schema'
import { OrderCard, todayISO } from '@/features/orders/components'
import type { Order } from '@/features/orders/schema'
import { useI18n } from '@/i18n'
import { agoLabel } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import { fromISODate } from '@/lib/dates'
import { cn } from '@/lib/cn'
import { formatPhone, telLink, whatsappLink } from '@/lib/whatsapp'
import { TagChips } from './CustomersPage'
import type { Customer } from './schema'

type Tab = 'measurements' | 'orders' | 'money'

// Icon above label so all three fit on a 360px phone.
const ACTION = 'min-h-16 flex-col gap-0.5 px-1 text-base'

export function CustomerProfilePage() {
  const { id = '' } = useParams()
  const { t } = useI18n()
  const { shopId, ctx } = useSession()
  const navigate = useNavigate()
  const customers = useCollection<Customer>(shopId, 'customers')
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => (params.get('tab') as Tab) || 'measurements')
  const { balances } = useLedger()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (customers === undefined) return null
  const c = customers.find((x) => x.id === id)
  if (!c) return <PageHeader title={t('cust_notFound')} back="/customers" />

  const wa = whatsappLink(c.phone)
  const tel = telLink(c.phone)

  const remove = () => {
    softDeleteRecord(ctx, 'customers', c, { label: c.name })
    toast({
      message: t('cust_deleted', { name: c.name }),
      undo: () =>
        restoreRecord(ctx, 'customers', { ...c, version: c.version + 1, isDeleted: true }, { label: c.name }),
    })
    navigate('/customers', { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="" back="/customers" />
      <Card className="-mt-6 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={c.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl break-words">{c.name}</h1>
            {c.phone && <div className="money text-lg">{formatPhone(c.phone)}</div>}
            {c.area && (
              <div className="flex items-center gap-1 text-ink-muted">
                <MapPin className="size-4" /> {c.area}
              </div>
            )}
            <TagChips tags={c.tags ?? []} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button asChild variant="success" size="md" className={cn(ACTION, !wa && 'pointer-events-none opacity-40')}>
            <a href={wa ?? undefined} target="_blank" rel="noreferrer">
              <MessageCircle /> {t('whatsapp')}
            </a>
          </Button>
          <Button asChild variant="secondary" size="md" className={cn(ACTION, !tel && 'pointer-events-none opacity-40')}>
            <a href={tel ?? undefined}>
              <Phone /> {t('call')}
            </a>
          </Button>
          <Button asChild variant="secondary" size="md" className={ACTION}>
            <Link to={`/customers/${c.id}/edit`}>
              <Pencil /> {t('edit')}
            </Link>
          </Button>
        </div>
        {/* Derived from bills − payments in Phase 6. */}
        <button type="button" onClick={() => setTab('money')} className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-left">
          <span className="flex items-center gap-2 text-lg">
            <IndianRupee className="size-5 text-rani" /> {t('balance_label')}
          </span>
          <BalanceText balance={balances.get(c.id) ?? 0} className="text-2xl" />
        </button>
        {(c.address || c.notes || c.referredBy || c.birthday || c.anniversary) && (
          <dl className="grid gap-1 text-lg">
            {c.address && <Detail label={t('cust_address')} value={c.address} />}
            {c.referredBy && <Detail label={t('cust_referredBy')} value={c.referredBy} />}
            {c.birthday && <Detail label={t('cust_birthday')} value={formatDate(fromISODate(c.birthday))} />}
            {c.anniversary && <Detail label={t('cust_anniversary')} value={formatDate(fromISODate(c.anniversary))} />}
            {c.notes && <Detail label={t('cust_notes')} value={c.notes} />}
          </dl>
        )}
      </Card>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'measurements', label: t('tab_measurements') },
          { value: 'orders', label: t('tab_orders') },
          { value: 'money', label: t('tab_money') },
        ]}
      />

      {tab === 'measurements' && <MeasurementsTab customerId={c.id} />}
      {tab === 'orders' && <OrdersTab customerId={c.id} />}
      {tab === 'money' && <LedgerTab customer={c} />}

      <Button variant="danger" block className="mt-6" onClick={() => setConfirmDelete(true)}>
        <Trash2 /> {t('cust_delete')}
      </Button>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('cust_deleteConfirm', { name: c.name })}
        body={t('cust_deleteBody')}
        confirmLabel={t('yes')}
        danger
        onConfirm={remove}
      />
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-ink-muted">{label}:</dt>
      <dd className="break-words whitespace-pre-line">{value}</dd>
    </div>
  )
}

/** Latest measurement per garment, with full history behind a toggle. */
function MeasurementsTab({ customerId }: { customerId: string }) {
  const { t, lang } = useI18n()
  const { shopId } = useSession()
  const all = useCollection<Measurement>(shopId, 'measurements')
  const garments = useCollection<GarmentType>(shopId, 'garmentTypes', { includeDeleted: true })

  const groups = useMemo(() => {
    const mine = (all ?? []).filter((m) => m.customerId === customerId)
    const byGarment = new Map<string, Stored<Measurement>[]>()
    for (const m of mine) byGarment.set(m.garmentTypeId, [...(byGarment.get(m.garmentTypeId) ?? []), m])
    return [...byGarment.entries()]
      .map(([gid, list]) => ({
        garmentId: gid,
        list: list.sort((a, b) => b.takenOn.localeCompare(a.takenOn) || (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)),
      }))
      .sort((a, b) => b.list[0].takenOn.localeCompare(a.list[0].takenOn))
  }, [all, customerId])

  return (
    <div className="flex flex-col gap-4">
      <Button asChild block>
        <Link to={`/customers/${customerId}/measure`}>
          <Ruler /> {t('meas_new')}
        </Link>
      </Button>
      {groups.length === 0 && (
        <Card className="flex items-center gap-4 text-lg text-ink-muted">
          <Paisley className="h-16 w-12 shrink-0 text-gold" /> {t('meas_none')}
        </Card>
      )}
      {groups.map(({ garmentId, list }) => {
        const g = garments?.find((x) => x.id === garmentId)
        return (
          <MeasurementCard
            key={garmentId}
            customerId={customerId}
            garmentId={garmentId}
            garment={g}
            list={list}
            lang={lang}
          />
        )
      })}
    </div>
  )
}

function MeasurementCard({
  customerId,
  garmentId,
  garment,
  list,
  lang,
}: {
  customerId: string
  garmentId: string
  garment?: Stored<GarmentType>
  list: Stored<Measurement>[]
  lang: 'hi' | 'en'
}) {
  const { t } = useI18n()
  const [showHistory, setShowHistory] = useState(false)
  const latest = list[0]
  const name = garment ? (lang === 'hi' ? garment.nameHi : garment.nameEn) : latest.garmentName

  return (
    <ArchCard
      title={`${garment?.icon ?? '🧵'} ${name}`}
      action={
        <Button asChild variant="ghost" size="md">
          <Link to={`/customers/${customerId}/measure?garment=${garmentId}`}>
            <Ruler /> {t('meas_new').split(' ')[0]}
          </Link>
        </Button>
      }
    >
      <p className="mb-2 font-semibold text-gold-deep">{t('meas_lastTaken', { ago: agoLabel(latest.takenOn, lang) })}</p>
      <ValuesGrid m={latest} garment={garment} lang={lang} />
      {list.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            aria-expanded={showHistory}
            className="mt-3 flex min-h-12 items-center gap-2 font-semibold text-indigo-royal"
          >
            <ChevronDown className={`size-5 transition ${showHistory ? 'rotate-180' : ''}`} /> {t('meas_history', { n: list.length - 1 })}
          </button>
          {showHistory &&
            list.slice(1).map((m) => (
              <div key={m.id} className="mt-2 rounded-xl bg-surface-2 p-3">
                <p className="mb-1 text-ink-muted">
                  {formatDate(fromISODate(m.takenOn))} · {agoLabel(m.takenOn, lang)}
                </p>
                <ValuesGrid m={m} garment={garment} lang={lang} />
              </div>
            ))}
        </>
      )}
    </ArchCard>
  )
}

function ValuesGrid({ m, garment, lang }: { m: Measurement; garment?: GarmentType; lang: 'hi' | 'en' }) {
  const labelFor = (key: string) => {
    const f = garment?.measurementFields.find((x) => x.key === key)
    return f ? (lang === 'hi' ? f.labelHi : f.labelEn) : key
  }
  // Template order first, then any extra keys (fields since removed from the template).
  const order = garment?.measurementFields.map((f) => f.key) ?? []
  const keys = Object.keys(m.values)
    .filter((k) => m.values[k])
    .sort((a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999))
  return (
    <div>
      {keys.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {keys.map((k) => (
            <div key={k} className="flex justify-between gap-2 border-b border-line py-1">
              <dt className="text-ink-muted">{labelFor(k)}</dt>
              <dd className="money text-lg font-bold">{m.values[k]}</dd>
            </div>
          ))}
        </dl>
      )}
      {m.notes && <p className="mt-2 whitespace-pre-line">📝 {m.notes}</p>}
    </div>
  )
}

function OrdersTab({ customerId }: { customerId: string }) {
  const { t } = useI18n()
  const { shopId } = useSession()
  const orders = useCollection<Order>(shopId, 'orders')
  const mine = (orders ?? []).filter((o) => o.customerId === customerId).sort((a, b) => b.orderDate.localeCompare(a.orderDate) || b.orderNumber.localeCompare(a.orderNumber))
  const today = todayISO()
  return (
    <div className="flex flex-col gap-3">
      <Button asChild block>
        <Link to={`/orders/new?customer=${customerId}`}>
          <Plus /> {t('ord_newFor')}
        </Link>
      </Button>
      {mine.length === 0 && <Card className="text-center text-lg text-ink-muted">{t('ord_none')}</Card>}
      {mine.map((o) => (
        <OrderCard key={o.id} order={o} today={today} />
      ))}
    </div>
  )
}
