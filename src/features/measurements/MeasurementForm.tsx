import { Copy, Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useSession } from '@/auth/AuthGate'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { inputClass, TextAreaField, TextField } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page'
import { toast } from '@/components/ui/toast'
import { useCollection } from '@/data/hooks'
import type { Stored } from '@/data/types'
import { createRecord, softDeleteRecord } from '@/data/write'
import type { Customer } from '@/features/customers/schema'
import type { GarmentType } from '@/features/master/schema'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { agoLabel, toISODate } from '@/lib/dates'
import { useDraft } from '@/lib/useDraft'
import { measurementSchema, type Measurement } from './schema'

export function MeasurementPage() {
  const { id: customerId = '' } = useParams()
  const [params] = useSearchParams()
  const garmentId = params.get('garment')
  const { t, lang } = useI18n()
  const { shopId } = useSession()
  const customers = useCollection<Customer>(shopId, 'customers')
  const garments = useCollection<GarmentType>(shopId, 'garmentTypes')
  const measurements = useCollection<Measurement>(shopId, 'measurements')

  const mine = useMemo(() => (measurements ?? []).filter((m) => m.customerId === customerId), [measurements, customerId])
  if (!customers || !garments || !measurements) return null
  const customer = customers.find((c) => c.id === customerId)
  if (!customer) return <PageHeader title={t('cust_notFound')} back="/customers" />

  const garment = garmentId ? garments.find((g) => g.id === garmentId) : undefined
  if (!garment) {
    // Step 1: choose the garment. Ones measured before come first.
    const measured = new Set(mine.map((m) => m.garmentTypeId))
    const list = garments
      .filter((g) => g.active)
      .sort((a, b) => Number(measured.has(b.id)) - Number(measured.has(a.id)) || a.sortOrder - b.sortOrder)
    return (
      <div>
        <PageHeader title={t('meas_pickGarment')} subtitle={customer.name} back={`/customers/${customerId}`} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {list.map((g) => (
            <Link
              key={g.id}
              to={`?garment=${g.id}`}
              className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-line bg-surface p-3 text-center shadow-sm active:border-rani"
            >
              <span className="text-3xl">{g.icon}</span>
              <span className="text-lg leading-tight font-semibold">{lang === 'hi' ? g.nameHi : g.nameEn}</span>
              {measured.has(g.id) && <span className="text-sm text-emerald-deep">✓</span>}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  const previous = mine
    .filter((m) => m.garmentTypeId === garment.id)
    .sort((a, b) => b.takenOn.localeCompare(a.takenOn) || (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))[0]

  return <MeasurementForm key={garment.id} customer={customer} garment={garment} previous={previous} />
}

function MeasurementForm({ customer, garment, previous }: { customer: Stored<Customer>; garment: Stored<GarmentType>; previous?: Stored<Measurement> }) {
  const { t, lang } = useI18n()
  const { ctx } = useSession()
  const navigate = useNavigate()
  const garmentName = lang === 'hi' ? garment.nameHi : garment.nameEn
  const [initial] = useState<Measurement>(() => ({
    customerId: customer.id,
    garmentTypeId: garment.id,
    garmentName: garment.nameHi,
    values: {},
    notes: '',
    takenOn: toISODate(new Date()),
    photoUrl: null,
  }))
  const draft = useDraft<Measurement>(`measure:${customer.id}:${garment.id}`, initial)
  const m = draft.value

  const setValue = (key: string, v: string) => draft.setValue((prev) => ({ ...prev, values: { ...prev.values, [key]: v } }))

  const copyLast = () => {
    if (!previous) return
    draft.setValue((prev) => ({ ...prev, values: { ...previous.values }, notes: prev.notes || previous.notes }))
  }

  const save = () => {
    const values = Object.fromEntries(Object.entries(m.values).filter(([, v]) => v.trim() !== ''))
    const data = measurementSchema.parse({ ...m, values })
    const label = `${customer.name} · ${garment.nameHi}`
    const { id } = createRecord(ctx, 'measurements', measurementSchema, data, { label })
    draft.clear()
    toast({
      message: t('meas_saved'),
      undo: () =>
        softDeleteRecord(ctx, 'measurements', { id, ...data, version: 1, createdAt: null, createdBy: ctx.uid, updatedAt: null, updatedBy: ctx.uid, isDeleted: false }, { label }),
    })
    navigate(`/customers/${customer.id}`, { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`${garment.icon} ${t('meas_title', { garment: garmentName })}`}
        subtitle={customer.name}
        back={`/customers/${customer.id}/measure`}
      />

      {draft.restored && (
        <Card className="flex flex-wrap items-center gap-3 border-marigold bg-marigold/15">
          <span className="flex-1 text-lg">📝 {t('draftRestored')}</span>
          <Button variant="ghost" size="md" onClick={() => draft.reset(initial)}>
            {t('discardDraft')}
          </Button>
        </Card>
      )}

      {previous && (
        <Button variant="secondary" block onClick={copyLast}>
          <Copy /> {t('meas_copyLast')} <span className="text-base font-normal">({agoLabel(previous.takenOn, lang)})</span>
        </Button>
      )}

      <Card className="flex flex-col gap-4">
        {garment.measurementFields.length === 0 && <p className="text-lg text-ink-muted">{t('meas_noFields')}</p>}
        <div className="grid grid-cols-2 gap-3">
          {garment.measurementFields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="text-lg leading-tight font-semibold">
                {lang === 'hi' ? f.labelHi : f.labelEn}
                {previous?.values[f.key] && <span className="block text-sm font-normal text-ink-muted">({previous.values[f.key]})</span>}
              </span>
              <div className="relative">
                <input
                  className={cn(inputClass, "money pr-14 text-2xl")}
                  inputMode={f.unit === 'text' ? 'text' : 'decimal'}
                  value={m.values[f.key] ?? ''}
                  onChange={(e) => setValue(f.key, e.target.value)}
                />
                {f.unit !== 'text' && (
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-muted">
                    {t(`unit_${f.unit}`)}
                  </span>
                )}
              </div>
            </label>
          ))}
        </div>
        <TextAreaField label={t('cust_notes')} value={m.notes} onChange={(e) => draft.setValue((p) => ({ ...p, notes: e.target.value }))} />
        <TextField label={t('meas_takenOn')} type="date" value={m.takenOn} onChange={(e) => draft.setValue((p) => ({ ...p, takenOn: e.target.value || p.takenOn }))} />
      </Card>

      <Button block onClick={save}>
        <Save /> {t('save')}
      </Button>
    </div>
  )
}
