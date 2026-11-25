import { Minus, Plus, Save, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { useSession } from '@/auth/AuthGate'
import { useSettings } from '@/app/useShop'
import { Button } from '@/components/ui/button'
import { ArchCard, Card } from '@/components/ui/card'
import { inputClass, TextAreaField, TextField } from '@/components/ui/field'
import { Chip, PageHeader } from '@/components/ui/page'
import { SwitchRow } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import { useCollection, useDoc } from '@/data/hooks'
import type { Stored } from '@/data/types'
import type { Customer } from '@/features/customers/schema'
import { ensureDeviceLetter, getDeviceLetter } from '@/features/orders/actions'
import type { DeviceCounter, Order } from '@/features/orders/schema'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { toISODate } from '@/lib/dates'
import { formatINR } from '@/lib/format'
import { useDraft } from '@/lib/useDraft'
import { createBillForOrder, createStandaloneBill, linesFromOrder, reviseBill, type BillDraft } from './actions'
import { computeBill } from './math'
import { billLineSchema, type Bill, type BillLine } from './schema'

const EMPTY_LINE: BillLine = { name: '', qty: 1, rate: 0, addOns: [] }

export function BillEditorPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { shopId } = useSession()
  const bills = useCollection<Bill>(shopId, 'bills')
  const orders = useCollection<Order>(shopId, 'orders')
  const customers = useCollection<Customer>(shopId, 'customers')
  if (!bills || !orders || !customers) return null

  const orderId = params.get('order')
  const existing = id ? bills.find((b) => b.id === id) : undefined
  if (id && !existing) return <PageHeader title="…" back="/" />
  // One bill per order: open the existing one instead of making a duplicate.
  const billForOrder = orderId ? bills.find((b) => b.orderId === orderId) : undefined
  if (!existing && billForOrder) return <Navigate to={`/bills/${billForOrder.id}`} replace />

  const order = orderId ? orders.find((o) => o.id === orderId) : undefined
  const customerId = existing?.customerId ?? order?.customerId ?? params.get('customer') ?? ''
  const customer = customers.find((c) => c.id === customerId)
  if (!customer) return <PageHeader title="…" back="/" />
  return <BillEditor key={existing?.id ?? orderId ?? customerId} existing={existing} order={order} customer={customer} />
}

function BillEditor({ existing, order, customer }: { existing?: Stored<Bill>; order?: Stored<Order>; customer: Stored<Customer> }) {
  const { t } = useI18n()
  const { ctx, shopId } = useSession()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const [letter, setLetter] = useState<string | null>(() => getDeviceLetter(shopId))
  const counter = useDoc<DeviceCounter>(`shops/${shopId}/counters/device-${letter ?? '_'}`)
  const standalone = !existing && !order
  useEffect(() => {
    if (standalone && !letter) void ensureDeviceLetter(ctx).then(setLetter).catch(() => undefined)
  }, [standalone, letter, ctx])

  const [initial] = useState<BillDraft>(() =>
    existing
      ? { billDate: existing.billDate, lines: existing.lines, discount: existing.discount, roundOff: existing.roundOff, notes: existing.notes }
      : {
          billDate: toISODate(new Date()),
          lines: order ? linesFromOrder(order) : [EMPTY_LINE],
          discount: { type: 'flat', value: 0 },
          roundOff: true,
          notes: '',
        },
  )
  const draft = useDraft<BillDraft>(`bill:${existing?.id ?? order?.id ?? `new:${customer.id}`}`, initial)
  const d = draft.value
  const set = (patch: Partial<BillDraft>) => draft.setValue((p) => ({ ...p, ...patch }))
  const setLine = (i: number, patch: Partial<BillLine>) => set({ lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) })
  const [error, setError] = useState<string>()

  const totals = (() => {
    try {
      return computeBill({ lines: d.lines, discount: d.discount, roundOff: d.roundOff })
    } catch {
      return null
    }
  })()

  const save = () => {
    const bad = d.lines.findIndex((l) => !billLineSchema.safeParse(l).success)
    if (bad !== -1 || !totals) return setError(t('required'))
    setError(undefined)
    let id: string
    if (existing) {
      reviseBill(ctx, existing, d)
      id = existing.id
      toast({ message: t('bill_revised', { n: existing.revision + 1 }) })
    } else if (order) {
      id = createBillForOrder(ctx, order, d)
      toast({ message: t('bill_saved', { num: order.orderNumber }) })
    } else {
      if (!counter) return setError(t('ord_noLetter'))
      id = createStandaloneBill(ctx, counter, settings.orderPrefix, { id: customer.id, name: customer.name, phone: customer.phone }, d)
      toast({ message: t('saved') })
    }
    draft.clear()
    navigate(`/bills/${id}`, { replace: true })
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      <PageHeader
        title={existing ? t('bill_edit') : t('bill_new')}
        subtitle={`${customer.name}${existing ? ` · ${existing.billNumber}` : order ? ` · ${order.orderNumber}` : ''}`}
        back={existing ? `/bills/${existing.id}` : true}
      />
      {existing && <p className="rounded-xl bg-marigold/15 p-3 text-lg">ℹ️ {t('bill_editHelp')}</p>}
      {draft.restored && (
        <Card className="flex flex-wrap items-center gap-3 border-marigold bg-marigold/15">
          <span className="flex-1 text-lg">📝 {t('draftRestored')}</span>
          <Button variant="ghost" size="md" onClick={() => draft.reset(initial)}>
            {t('discardDraft')}
          </Button>
        </Card>
      )}

      <Card>
        <TextField label={t('bill_date')} type="date" value={d.billDate} onChange={(e) => set({ billDate: e.target.value || d.billDate })} />
      </Card>

      {d.lines.map((line, i) => (
        <ArchCard
          key={i}
          title={line.name || `${t('bill_item')} ${i + 1}`}
          action={
            d.lines.length > 1 && (
              <Button variant="ghost" size="icon" aria-label={t('remove')} onClick={() => set({ lines: d.lines.filter((_, j) => j !== i) })}>
                <Trash2 />
              </Button>
            )
          }
        >
          <div className="flex flex-col gap-3">
            <TextField label={t('bill_item')} value={line.name} error={error && !line.name.trim() ? t('required') : undefined} onChange={(e) => setLine(i, { name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-lg font-semibold">{t('ord_qty')}</span>
                <div className="flex items-center gap-1">
                  <Button variant="secondary" size="icon" aria-label="−" onClick={() => setLine(i, { qty: Math.max(1, line.qty - 1) })}>
                    <Minus />
                  </Button>
                  <span className="money w-12 text-center text-2xl font-bold">{line.qty}</span>
                  <Button variant="secondary" size="icon" aria-label="+" onClick={() => setLine(i, { qty: Math.min(100, line.qty + 1) })}>
                    <Plus />
                  </Button>
                </div>
              </div>
              <TextField label={t('rate')} type="number" inputMode="decimal" min={0} className="money text-2xl" value={line.rate} onChange={(e) => setLine(i, { rate: Math.max(0, Number(e.target.value) || 0) })} />
            </div>
            {line.addOns.map((a, j) => (
              <div key={j} className="flex items-center gap-2">
                <span className="text-lg">+</span>
                <input
                  aria-label={t('ord_addOns')}
                  className={cn(inputClass, 'min-w-0 flex-1')}
                  value={a.name}
                  onChange={(e) => setLine(i, { addOns: line.addOns.map((x, k) => (k === j ? { ...x, name: e.target.value } : x)) })}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  aria-label={t('rate')}
                  className={cn(inputClass, 'money w-28 shrink-0 text-right')}
                  value={a.rate}
                  onChange={(e) => setLine(i, { addOns: line.addOns.map((x, k) => (k === j ? { ...x, rate: Math.max(0, Number(e.target.value) || 0) } : x)) })}
                />
                <Button variant="ghost" size="icon" aria-label={t('remove')} onClick={() => setLine(i, { addOns: line.addOns.filter((_, k) => k !== j) })}>
                  <X />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="md" onClick={() => setLine(i, { addOns: [...line.addOns, { name: '', rate: 0 }] })}>
              <Plus /> {t('ord_addOns')}
            </Button>
            {totals && (
              <div className="flex justify-between border-t border-line pt-2 text-lg">
                <span>{t('ord_total')}</span>
                <span className="money font-bold">{formatINR(totals.lineTotals[i])}</span>
              </div>
            )}
          </div>
        </ArchCard>
      ))}

      <Button variant="secondary" block onClick={() => set({ lines: [...d.lines, EMPTY_LINE] })}>
        <Plus /> {t('bill_addLine')}
      </Button>

      <Card className="flex flex-col gap-3">
        <span className="text-lg font-semibold">{t('bill_discount')}</span>
        <div className="flex flex-wrap items-center gap-2">
          <Chip selected={d.discount.type === 'flat'} onClick={() => set({ discount: { ...d.discount, type: 'flat' } })}>
            {t('bill_discountFlat')}
          </Chip>
          <Chip selected={d.discount.type === 'percent'} onClick={() => set({ discount: { ...d.discount, type: 'percent' } })}>
            {t('bill_discountPercent')}
          </Chip>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            aria-label={t('bill_discount')}
            className={cn(inputClass, 'money w-32 text-right')}
            value={d.discount.value}
            onChange={(e) => set({ discount: { ...d.discount, value: Math.max(0, Number(e.target.value) || 0) } })}
          />
        </div>
        <SwitchRow label={t('bill_roundOff')} checked={d.roundOff} onCheckedChange={(v) => set({ roundOff: v })} />
        <TextAreaField label={t('cust_notes')} value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Card>

      {totals && (
        <Card className="flex flex-col gap-1 border-2 border-gold text-lg">
          <Row label={t('ord_total')} value={formatINR(totals.subtotal)} />
          {totals.discount > 0 && <Row label={t('bill_discount')} value={`− ${formatINR(totals.discount)}`} />}
          {totals.roundOff !== 0 && <Row label="राउंड ऑफ़" value={formatINR(totals.roundOff)} />}
        </Card>
      )}

      {error && (
        <p role="alert" className="text-lg font-semibold text-danger">
          ⚠️ {error}
        </p>
      )}

      <div className="pb-safe fixed inset-x-0 bottom-[4.5rem] z-20 border-t border-line bg-surface/95 px-4 pt-2 backdrop-blur md:bottom-0 md:left-[17rem]">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm text-ink-muted">{t('ord_total')}</div>
            <div className="money text-2xl font-bold text-rani">{totals ? formatINR(totals.total) : '—'}</div>
          </div>
          <Button variant="success" onClick={save}>
            <Save /> {t('bill_issue')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="money">{value}</span>
    </div>
  )
}
