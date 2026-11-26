import { motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Check, Minus, Plus, Ruler, Save, Search, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useSession } from '@/auth/AuthGate'
import { useIsManager, useSettings } from '@/app/useShop'
import { useFeatures } from '@/app/features'
import { VoiceButton } from '@/features/extras/VoiceButton'
import { Button } from '@/components/ui/button'
import { ArchCard, Card } from '@/components/ui/card'
import { inputClass, TextAreaField, TextField } from '@/components/ui/field'
import { Avatar, Chip, PageHeader } from '@/components/ui/page'
import { SwitchRow } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import { useCollection, useDoc } from '@/data/hooks'
import type { Stored } from '@/data/types'
import { createRecord } from '@/data/write'
import { customerSchema, EMPTY_CUSTOMER, normalizePhone, type Customer } from '@/features/customers/schema'
import { searchCustomers } from '@/features/customers/search'
import type { AddOn, GarmentType } from '@/features/master/schema'
import type { Measurement } from '@/features/measurements/schema'
import { PAYMENT_MODES, type PaymentMode } from '@/features/payments/schema'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { agoLabel, fromISODate, toISODate } from '@/lib/dates'
import { formatINR } from '@/lib/format'
import { haptic } from '@/lib/haptics'
import { useDraft } from '@/lib/useDraft'
import { createOrder, ensureDeviceLetter, getDeviceLetter, updateOrder } from './actions'
import { defaultDeliveryDate, itemTotal, orderTotal } from './logic'
import type { DeviceCounter, Order, OrderItem } from './schema'

interface Draft {
  step: 1 | 2 | 3
  customerId: string
  items: OrderItem[]
  orderDate: string
  trialDate: string
  deliveryDate: string
  /** Once she picks a date herself we stop auto-suggesting one. */
  deliveryTouched: boolean
  urgent: boolean
  notes: string
  advance: string
  mode: PaymentMode
}

const latestMeasurement = (all: Stored<Measurement>[], customerId: string, garmentId: string) =>
  all
    .filter((m) => m.customerId === customerId && m.garmentTypeId === garmentId)
    .sort((a, b) => b.takenOn.localeCompare(a.takenOn) || (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))[0]

export function OrderWizardPage() {
  const { id } = useParams()
  const { shopId } = useSession()
  const orders = useCollection<Order>(shopId, 'orders')
  if (id && orders === undefined) return null
  const existing = id ? orders?.find((o) => o.id === id) : undefined
  if (id && !existing) return <PageHeader title="…" back="/orders" />
  return <OrderWizard key={id ?? 'new'} existing={existing} />
}

function OrderWizard({ existing }: { existing?: Stored<Order> }) {
  const { t, lang } = useI18n()
  const { shopId, ctx } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { settings } = useSettings()
  const customers = useCollection<Customer>(shopId, 'customers')
  const garments = useCollection<GarmentType>(shopId, 'garmentTypes')
  const addOns = useCollection<AddOn>(shopId, 'addOns')
  const measurements = useCollection<Measurement>(shopId, 'measurements')

  const [letter, setLetter] = useState<string | null>(() => getDeviceLetter(shopId))
  const counter = useDoc<DeviceCounter>(`shops/${shopId}/counters/device-${letter ?? '_'}`)
  useEffect(() => {
    if (!existing && !letter) void ensureDeviceLetter(ctx).then(setLetter).catch(() => undefined)
  }, [existing, letter, ctx])

  const [initial] = useState<Draft>(() => {
    const today = toISODate(new Date())
    if (existing) {
      return {
        step: 2,
        customerId: existing.customerId,
        items: existing.items,
        orderDate: existing.orderDate,
        trialDate: existing.trialDate,
        deliveryDate: existing.deliveryDate,
        deliveryTouched: true,
        urgent: existing.urgent,
        notes: existing.notes,
        advance: '',
        mode: 'cash',
      }
    }
    const preset = params.get('customer') ?? ''
    return {
      step: preset ? 2 : 1,
      customerId: preset,
      items: [],
      orderDate: today,
      trialDate: '',
      deliveryDate: today,
      deliveryTouched: false,
      urgent: false,
      notes: '',
      advance: '',
      mode: 'cash',
    }
  })
  const draft = useDraft<Draft>(existing ? `order:${existing.id}` : 'order:new', initial)
  const d = draft.value
  const set = (patch: Partial<Draft>) => draft.setValue((prev) => ({ ...prev, ...patch }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const customer = customers?.find((c) => c.id === d.customerId)
  const on = useFeatures()
  const allOrders = useCollection<Order>(shopId, 'orders')
  // Every 10th order from the same customer: suggest a small loyalty discount.
  const loyaltyN = (() => {
    const n = (allOrders ?? []).filter((o) => o.customerId === d.customerId && o.status !== 'cancelled').length + 1
    return n >= 10 && n % 10 === 0 ? n : 0
  })()
  const total = orderTotal({ items: d.items })
  const advance = Math.max(0, Number(d.advance) || 0)

  // Suggest a delivery date from the slowest garment until she sets one.
  const suggestDelivery = (items: OrderItem[], orderDate = d.orderDate) => {
    const days = items.map((i) => garments?.find((g) => g.id === i.garmentTypeId)?.defaultDeliveryDays ?? 7)
    return toISODate(defaultDeliveryDate(fromISODate(orderDate), days))
  }
  const setItems = (items: OrderItem[]) => set({ items, ...(d.deliveryTouched ? {} : { deliveryDate: suggestDelivery(items) }) })

  const addItem = (g: Stored<GarmentType>) => {
    haptic('tap')
    const m = measurements ? latestMeasurement(measurements, d.customerId, g.id) : undefined
    setItems([
      ...d.items,
      {
        garmentTypeId: g.id,
        garmentName: g.nameHi,
        qty: 1,
        rate: g.defaultRate,
        addOns: [],
        fabricByCustomer: true,
        fabricNotes: '',
        notes: '',
        measurementId: m?.id ?? null,
        measurementTakenOn: m?.takenOn ?? null,
        measurements: m?.values ?? {},
        designPhotoUrl: null,
      },
    ])
  }
  // Items added before measurements existed pick up the latest ones (e.g. after "नाप लें").
  const withMeasurements = (items: OrderItem[]) =>
    items.map((it) => {
      if (it.measurementId || !measurements) return it
      const m = latestMeasurement(measurements, d.customerId, it.garmentTypeId)
      return m ? { ...it, measurementId: m.id, measurementTakenOn: m.takenOn, measurements: m.values } : it
    })

  const patchItem = (i: number, patch: Partial<OrderItem>) => setItems(d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)))

  const save = () => {
    if (!customer) return set({ step: 1 })
    if (d.items.length === 0) return setError(t('ord_noItems'))
    setSaving(true)
    const fields = {
      items: withMeasurements(d.items),
      orderDate: d.orderDate,
      trialDate: d.trialDate,
      deliveryDate: d.deliveryDate,
      urgent: d.urgent,
      notes: d.notes,
    }
    if (existing) {
      updateOrder(ctx, existing, fields)
      draft.clear()
      toast({ message: t('saved') })
      navigate(`/orders/${existing.id}`, { replace: true })
      return
    }
    if (!counter) {
      setSaving(false)
      return setError(t('ord_noLetter'))
    }
    const { id, orderNumber } = createOrder(
      ctx,
      counter,
      settings.orderPrefix,
      { ...fields, customerId: customer.id, customerName: customer.name, customerPhone: customer.phone, karigarId: null },
      advance > 0 ? { amount: advance, mode: d.mode } : null,
    )
    draft.clear()
    toast({ message: t('ord_saved', { num: orderNumber }) })
    navigate(`/orders/${id}?created=1`, { replace: true })
  }

  const stepTitle = { 1: t('ord_step1'), 2: t('ord_step2'), 3: t('ord_step3') }[d.step]

  return (
    <div className="flex flex-col gap-4 pb-28">
      <PageHeader
        title={existing ? t('ord_editTitle') : t('home_newOrder')}
        subtitle={existing ? existing.orderNumber : `${t('ord_step', { n: d.step })} · ${stepTitle}`}
        back={existing ? `/orders/${existing.id}` : true}
      />

      {!existing && (
        <div className="flex gap-2" aria-hidden data-tour="wizard-steps">
          {[1, 2, 3].map((n) => (
            <div key={n} className={cn('h-2 flex-1 rounded-full transition', n <= d.step ? 'bg-rani' : 'bg-line')} />
          ))}
        </div>
      )}

      {draft.restored && (
        <Card className="flex flex-wrap items-center gap-3 border-marigold bg-marigold/15">
          <span className="flex-1 text-lg">📝 {t('draftRestored')}</span>
          <Button variant="ghost" size="md" onClick={() => draft.reset(initial)}>
            {t('discardDraft')}
          </Button>
        </Card>
      )}

      {customer && d.step > 1 && (
        <Card className="flex items-center gap-3">
          <Avatar name={customer.name} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xl font-semibold">{customer.name}</div>
            <div className="money text-ink-muted">{customer.phone}</div>
          </div>
          {!existing && (
            <Button variant="ghost" size="md" onClick={() => set({ step: 1 })}>
              {t('edit')}
            </Button>
          )}
        </Card>
      )}
      {customer && d.step > 1 && !existing && on('loyalty') && loyaltyN > 0 && (
        <p className="rounded-xl border-2 border-marigold bg-marigold/15 p-3 text-lg font-semibold">🎁 {t('loy_note', { n: loyaltyN })}</p>
      )}

      <motion.div key={d.step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
        {d.step === 1 && (
          <CustomerStep
            customers={customers ?? []}
            onPick={(c) => {
              haptic('tap')
              set({ customerId: c.id, step: 2 })
            }}
          />
        )}

        {d.step === 2 && (
          <div className="flex flex-col gap-4">
            {d.items.map((item, i) => (
              <ItemCard
                key={i}
                item={withMeasurements([item])[0]}
                garment={garments?.find((g) => g.id === item.garmentTypeId)}
                addOns={addOns ?? []}
                customerId={d.customerId}
                lang={lang}
                onChange={(patch) => patchItem(i, patch)}
                onRemove={() => setItems(d.items.filter((_, j) => j !== i))}
              />
            ))}
            <GarmentPicker garments={garments ?? []} onPick={addItem} compact={d.items.length > 0} />
          </div>
        )}

        {d.step === 3 && (
          <div className="flex flex-col gap-4">
            <Card className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label={t('ord_orderDate')}
                  type="date"
                  value={d.orderDate}
                  onChange={(e) => {
                    const orderDate = e.target.value || d.orderDate
                    set({ orderDate, ...(d.deliveryTouched ? {} : { deliveryDate: suggestDelivery(d.items, orderDate) }) })
                  }}
                />
                <TextField
                  label={t('ord_deliveryDate')}
                  type="date"
                  value={d.deliveryDate}
                  min={d.orderDate}
                  onChange={(e) => set({ deliveryDate: e.target.value || d.deliveryDate, deliveryTouched: true })}
                />
              </div>
              <TextField label={t('ord_trialDate')} type="date" value={d.trialDate} min={d.orderDate} onChange={(e) => set({ trialDate: e.target.value })} />
              <SwitchRow label={`🔥 ${t('ord_urgent')}`} checked={d.urgent} onCheckedChange={(v) => set({ urgent: v })} />
              <TextAreaField label={t('cust_notes')} value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
              <VoiceButton className="self-start" onText={(x) => set({ notes: d.notes ? d.notes + ' ' + x : x })} />
            </Card>

            {!existing && (
              <Card className="flex flex-col gap-3">
                <TextField
                  label={t('ord_advance')}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  className="money text-2xl"
                  value={d.advance}
                  placeholder="0"
                  onChange={(e) => set({ advance: e.target.value })}
                />
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_MODES.map((m) => (
                    <Chip key={m} selected={d.mode === m} onClick={() => set({ mode: m })}>
                      {t(`mode_${m}`)}
                    </Chip>
                  ))}
                </div>
              </Card>
            )}

            <Card className="flex flex-col gap-1 border-2 border-gold text-lg">
              <div className="flex justify-between">
                <span>{t('ord_total')}</span>
                <span className="money font-bold">{formatINR(total)}</span>
              </div>
              {!existing && advance > 0 && (
                <div className="flex justify-between text-emerald-deep">
                  <span>{t('ord_advancePaid')}</span>
                  <span className="money">− {formatINR(advance)}</span>
                </div>
              )}
              {!existing && (
                <div className="mt-1 flex justify-between rounded-xl bg-rani px-3 py-2 text-on-rani">
                  <span>{t('ord_balance')}</span>
                  <span className="money text-2xl font-bold">{formatINR(Math.max(0, total - advance))}</span>
                </div>
              )}
            </Card>
          </div>
        )}
      </motion.div>

      {error && (
        <p role="alert" className="text-lg font-semibold text-danger">
          ⚠️ {error}
        </p>
      )}

      {/* Sticky footer: running total + next/save, always in thumb reach. */}
      {d.step > 1 && (
        <div className="pb-safe fixed inset-x-0 bottom-[4.5rem] z-20 border-t border-line bg-surface/95 px-4 pt-2 backdrop-blur md:bottom-0 md:left-[17rem]">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            {!existing && (
              <Button variant="secondary" size="lg" aria-label={t('back')} onClick={() => set({ step: (d.step - 1) as 1 | 2 })}>
                <ArrowLeft />
              </Button>
            )}
            <div className="min-w-0 flex-1" data-tour="wizard-total">
              <div className="text-sm text-ink-muted">{t('ord_total')}</div>
              <div className="money text-2xl font-bold text-rani">{formatINR(total)}</div>
            </div>
            {d.step === 2 && !existing ? (
              <Button
                disabled={d.items.length === 0}
                onClick={() => {
                  setError(undefined)
                  set({ step: 3 })
                }}
              >
                {t('ord_next')} <ArrowRight />
              </Button>
            ) : d.step === 2 && existing ? (
              <Button onClick={() => set({ step: 3 })}>
                {t('ord_next')} <ArrowRight />
              </Button>
            ) : (
              <Button variant="success" disabled={saving || d.items.length === 0} onClick={save}>
                <Save /> {existing ? t('save') : t('ord_save')}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function CustomerStep({ customers, onPick }: { customers: Stored<Customer>[]; onPick: (c: { id: string }) => void }) {
  const { t } = useI18n()
  const { ctx } = useSession()
  const [q, setQ] = useState('')
  const results = useMemo(
    () => searchCustomers([...customers].sort((a, b) => (b.updatedAt?.toMillis() ?? Infinity) - (a.updatedAt?.toMillis() ?? Infinity)), q).slice(0, 8),
    [customers, q],
  )
  const [adding, setAdding] = useState(false)
  const digits = q.replace(/\D/g, '')
  const isPhone = digits.length >= 6 && digits.length === q.replace(/[\s+-]/g, '').length
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string>()

  const quickAdd = () => {
    const parsed = customerSchema.safeParse({ ...EMPTY_CUSTOMER, name, phone })
    if (!parsed.success) {
      setError(parsed.error.issues.some((i) => i.message === 'invalidPhone') ? t('invalidPhone') : t('required'))
      return
    }
    const { id } = createRecord(ctx, 'customers', customerSchema, parsed.data, { label: parsed.data.name })
    onPick({ id })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-ink-muted" />
        <input
          type="search"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('ord_pickCustomer')}
          aria-label={t('ord_pickCustomer')}
          className="min-h-14 w-full rounded-2xl border-2 border-line bg-surface pl-13 text-xl focus:border-rani focus:outline-none"
        />
      </div>
      <ul className="flex flex-col gap-2">
        {results.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c)}
              className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left shadow-sm active:border-rani"
            >
              <Avatar name={c.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xl font-semibold">{c.name}</span>
                <span className="money block text-ink-muted">
                  {c.phone} {c.area && `· ${c.area}`}
                </span>
              </span>
              <ArrowRight className="size-6 text-ink-muted" />
            </button>
          </li>
        ))}
      </ul>
      {!adding ? (
        <Button
          variant="secondary"
          block
          onClick={() => {
            setAdding(true)
            setName(isPhone ? '' : q)
            setPhone(isPhone ? q : '')
          }}
        >
          <UserPlus /> {t('ord_quickAdd')}
        </Button>
      ) : (
        <Card className="flex flex-col gap-3">
          <TextField label={t('cust_name')} value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          <TextField label={t('cust_phone')} value={phone} inputMode="tel" onChange={(e) => setPhone(e.target.value)} />
          {error && <p className="font-semibold text-danger">⚠️ {error}</p>}
          {normalizePhone(phone).length === 10 && customers.some((c) => c.phone === normalizePhone(phone)) && (
            <p className="rounded-xl bg-marigold/20 p-2">⚠️ {t('cust_dupPhone', { name: customers.find((c) => c.phone === normalizePhone(phone))!.name })}</p>
          )}
          <Button onClick={quickAdd}>
            <Check /> {t('save')}
          </Button>
        </Card>
      )}
    </div>
  )
}

function GarmentPicker({ garments, onPick, compact }: { garments: Stored<GarmentType>[]; onPick: (g: Stored<GarmentType>) => void; compact: boolean }) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState(!compact)
  const list = garments.filter((g) => g.active).sort((a, b) => a.sortOrder - b.sortOrder)
  if (!open)
    return (
      <Button variant="secondary" block onClick={() => setOpen(true)}>
        <Plus /> {t('ord_addItem')}
      </Button>
    )
  return (
    <ArchCard title={t('ord_addItem')}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {list.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => {
              onPick(g)
              setOpen(false)
            }}
            className="flex min-h-20 flex-col items-center justify-center rounded-2xl border-2 border-line bg-surface p-2 text-center active:border-rani"
          >
            <span className="text-2xl">{g.icon}</span>
            <span className="leading-tight font-semibold">{lang === 'hi' ? g.nameHi : g.nameEn}</span>
            <span className="money text-sm text-ink-muted">{formatINR(g.defaultRate)}</span>
          </button>
        ))}
      </div>
    </ArchCard>
  )
}

function ItemCard({
  item,
  garment,
  addOns,
  customerId,
  lang,
  onChange,
  onRemove,
}: {
  item: OrderItem
  garment?: Stored<GarmentType>
  addOns: Stored<AddOn>[]
  customerId: string
  lang: 'hi' | 'en'
  onChange: (patch: Partial<OrderItem>) => void
  onRemove: () => void
}) {
  const { t } = useI18n()
  const canEditRates = useIsManager()
  const name = garment ? (lang === 'hi' ? garment.nameHi : garment.nameEn) : item.garmentName
  const activeAddOns = addOns.filter((a) => a.active || item.addOns.some((x) => x.addOnId === a.id)).sort((a, b) => a.sortOrder - b.sortOrder)

  const toggleAddOn = (a: Stored<AddOn>) => {
    const has = item.addOns.some((x) => x.addOnId === a.id)
    onChange({ addOns: has ? item.addOns.filter((x) => x.addOnId !== a.id) : [...item.addOns, { addOnId: a.id, name: a.nameHi, rate: a.defaultRate }] })
  }

  return (
    <ArchCard
      title={`${garment?.icon ?? '🧵'} ${name}`}
      action={
        <Button variant="ghost" size="icon" aria-label={t('remove')} onClick={onRemove}>
          <Trash2 />
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold">{t('ord_qty')}</span>
            <div className="flex items-center gap-1">
              <Button variant="secondary" size="icon" aria-label="−" onClick={() => onChange({ qty: Math.max(1, item.qty - 1) })}>
                <Minus />
              </Button>
              <span className="money w-12 text-center text-2xl font-bold">{item.qty}</span>
              <Button variant="secondary" size="icon" aria-label="+" onClick={() => onChange({ qty: Math.min(100, item.qty + 1) })}>
                <Plus />
              </Button>
            </div>
          </div>
          <TextField
            label={t('rate')}
            type="number"
            inputMode="decimal"
            min={0}
            className="money text-2xl"
            value={item.rate}
            disabled={!canEditRates}
            hint={canEditRates ? undefined : t('helper_rateLocked')}
            onChange={(e) => onChange({ rate: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>

        {activeAddOns.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-lg font-semibold">{t('ord_addOns')}</span>
            <div className="flex flex-wrap gap-2">
              {activeAddOns.map((a) => (
                <Chip key={a.id} selected={item.addOns.some((x) => x.addOnId === a.id)} onClick={() => toggleAddOn(a)}>
                  {lang === 'hi' ? a.nameHi : a.nameEn}
                </Chip>
              ))}
            </div>
            {item.addOns.map((a, j) => (
              <label key={a.addOnId} className="flex items-center gap-3">
                <span className="flex-1 text-lg">+ {a.name}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  aria-label={`${a.name} ${t('rate')}`}
                  disabled={!canEditRates}
                  className={cn(inputClass, "money w-32 shrink-0 text-right")}
                  value={a.rate}
                  onChange={(e) => onChange({ addOns: item.addOns.map((x, k) => (k === j ? { ...x, rate: Math.max(0, Number(e.target.value) || 0) } : x)) })}
                />
              </label>
            ))}
          </div>
        )}

        <SwitchRow label={t('ord_fabric')} checked={item.fabricByCustomer} onCheckedChange={(v) => onChange({ fabricByCustomer: v })} />
        <TextField label={t('ord_fabricNotes')} value={item.fabricNotes} onChange={(e) => onChange({ fabricNotes: e.target.value })} />
        <TextAreaField label={t('ord_itemNotes')} value={item.notes} onChange={(e) => onChange({ notes: e.target.value })} />

        <div className="flex items-center gap-2 rounded-xl bg-surface-2 p-3">
          <Ruler className="size-5 shrink-0 text-gold-deep" />
          <span className="flex-1">{item.measurementTakenOn ? t('ord_measUsing', { ago: agoLabel(item.measurementTakenOn, lang) }) : t('ord_measNone')}</span>
          {!item.measurementTakenOn && (
            <Link to={`/customers/${customerId}/measure?garment=${item.garmentTypeId}`} className="font-semibold text-indigo-royal underline">
              {t('ord_takeMeasure')}
            </Link>
          )}
        </div>

        <div className="flex justify-between border-t border-line pt-2 text-lg">
          <span>{t('ord_total')}</span>
          <span className="money font-bold">{formatINR(itemTotal(item))}</span>
        </div>
      </div>
    </ArchCard>
  )
}
