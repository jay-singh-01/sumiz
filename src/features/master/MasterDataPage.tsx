import { ArrowDown, ArrowUp, Plus, Save, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { useSession } from '@/auth/AuthGate'
import { useIsManager } from '@/app/useShop'
import { Button } from '@/components/ui/button'
import { ArchCard, Card } from '@/components/ui/card'
import { inputClass, TextField } from '@/components/ui/field'
import { PageHeader, Tabs } from '@/components/ui/page'
import { Skeleton } from '@/components/ui/skeleton'
import { SwitchRow } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import { useCollection } from '@/data/hooks'
import type { Stored } from '@/data/types'
import { createRecord, updateRecord } from '@/data/write'
import { PeacockFeather } from '@/design/motifs'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { formatINR } from '@/lib/format'
import {
  addOnSchema,
  fieldKey,
  garmentCategorySchema,
  garmentTypeSchema,
  type AddOn,
  type GarmentType,
  type MeasurementField,
} from './schema'
import { seedMasterData } from './seed'

type Tab = 'garments' | 'addons'

const bySort = (a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder

export function MasterDataPage() {
  const { t, lang } = useI18n()
  const { shopId, ctx } = useSession()
  const isManager = useIsManager()
  const garments = useCollection<GarmentType>(shopId, 'garmentTypes')
  const addOns = useCollection<AddOn>(shopId, 'addOns')
  const [tab, setTab] = useState<Tab>('garments')

  if (!isManager) return <Navigate to="/" replace />
  const loading = garments === undefined || addOns === undefined
  const empty = !loading && garments.length === 0 && addOns.length === 0

  const toggle = <T extends GarmentType | AddOn>(coll: 'garmentTypes' | 'addOns', item: Stored<T>) => {
    const schema = coll === 'garmentTypes' ? garmentTypeSchema : addOnSchema
    updateRecord(ctx, coll, schema as never, item as never, { active: !item.active } as never, { label: item.nameHi })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('master')} subtitle={t('masterHelp')} back="/settings" />

      {empty && (
        <ArchCard title={t('master_seed')} icon={<Sparkles />}>
          <div className="flex items-center gap-4">
            <PeacockFeather className="h-20 w-10 shrink-0" />
            <p className="text-lg">{t('master_seedHelp')}</p>
          </div>
          <Button
            block
            className="mt-4"
            onClick={() => {
              seedMasterData(ctx)
              toast({ message: t('saved') })
            }}
          >
            <Sparkles /> {t('master_seed')}
          </Button>
        </ArchCard>
      )}

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'garments', label: `${t('master_garments')} (${garments?.length ?? 0})` },
          { value: 'addons', label: `${t('master_addons')} (${addOns?.length ?? 0})` },
        ]}
      />

      <Button asChild variant="secondary" block>
        <Link to={tab === 'garments' ? '/master/garments/new' : '/master/addons/new'}>
          <Plus /> {tab === 'garments' ? t('master_newGarment') : t('master_newAddon')}
        </Link>
      </Button>

      {loading && <Skeleton className="h-40" />}

      <ul className="flex flex-col gap-2">
        {tab === 'garments' &&
          garments?.sort(bySort).map((g) => (
            <Row
              key={g.id}
              to={`/master/garments/${g.id}`}
              icon={g.icon}
              title={lang === 'hi' ? g.nameHi : g.nameEn}
              meta={`${formatINR(g.defaultRate)} · ${t('daysN', { n: g.defaultDeliveryDays })} · ${g.measurementFields.length} ${t('fields')}`}
              active={g.active}
              onToggle={() => toggle('garmentTypes', g)}
            />
          ))}
        {tab === 'addons' &&
          addOns?.sort(bySort).map((a) => (
            <Row
              key={a.id}
              to={`/master/addons/${a.id}`}
              icon="✨"
              title={lang === 'hi' ? a.nameHi : a.nameEn}
              meta={formatINR(a.defaultRate)}
              active={a.active}
              onToggle={() => toggle('addOns', a)}
            />
          ))}
      </ul>
    </div>
  )
}

function Row({ to, icon, title, meta, active, onToggle }: { to: string; icon: string; title: string; meta: string; active: boolean; onToggle: () => void }) {
  const { t } = useI18n()
  return (
    <li className={cn('flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm', !active && 'opacity-60')}>
      <Link to={to} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-lg font-semibold">{title}</span>
          <span className="money block text-ink-muted">{meta}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        className={cn(
          'min-h-12 shrink-0 rounded-full px-4 font-semibold',
          active ? 'bg-emerald-deep text-on-emerald' : 'border-2 border-line text-ink-muted',
        )}
      >
        {active ? t('active') : t('inactive')}
      </button>
    </li>
  )
}

/* ---------------- Garment editor ---------------- */

const NEW_GARMENT: GarmentType = {
  nameHi: '',
  nameEn: '',
  category: 'women',
  defaultRate: 0,
  defaultDeliveryDays: 7,
  measurementFields: [],
  icon: '🧵',
  active: true,
  sortOrder: 1000,
}

export function GarmentEditorPage() {
  const { id } = useParams()
  const { shopId } = useSession()
  const isManager = useIsManager()
  const garments = useCollection<GarmentType>(shopId, 'garmentTypes', { includeDeleted: true })
  if (!isManager) return <Navigate to="/" replace />
  if (!garments) return null
  const existing = id && id !== 'new' ? garments.find((g) => g.id === id) : undefined
  return <GarmentEditor key={existing?.version ?? 'new'} existing={existing} nextSort={(Math.max(0, ...garments.map((g) => g.sortOrder)) || 0) + 10} />
}

function GarmentEditor({ existing, nextSort }: { existing?: Stored<GarmentType>; nextSort: number }) {
  const { t } = useI18n()
  const { ctx } = useSession()
  const navigate = useNavigate()
  const [g, setG] = useState<GarmentType>(existing ? garmentTypeSchema.parse(existing) : { ...NEW_GARMENT, sortOrder: nextSort })
  const [error, setError] = useState(false)
  const set = <K extends keyof GarmentType>(k: K, v: GarmentType[K]) => setG((p) => ({ ...p, [k]: v }))

  const setField = (i: number, patch: Partial<MeasurementField>) =>
    set('measurementFields', g.measurementFields.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  const move = (i: number, dir: -1 | 1) => {
    const list = [...g.measurementFields]
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    set('measurementFields', list)
  }

  const save = () => {
    // New fields get a key from their English label; existing keys never change (old measurements use them).
    const taken = g.measurementFields.filter((f) => f.key).map((f) => f.key)
    const fields = g.measurementFields.map((f) => {
      if (f.key) return f
      const key = fieldKey(f.labelEn || f.labelHi, taken)
      taken.push(key)
      return { ...f, key }
    })
    const parsed = garmentTypeSchema.safeParse({ ...g, nameEn: g.nameEn || g.nameHi, measurementFields: fields.map((f) => ({ ...f, labelEn: f.labelEn || f.labelHi })) })
    if (!parsed.success) return setError(true)
    if (existing) updateRecord(ctx, 'garmentTypes', garmentTypeSchema, existing, parsed.data, { label: parsed.data.nameHi })
    else createRecord(ctx, 'garmentTypes', garmentTypeSchema, parsed.data, { label: parsed.data.nameHi })
    toast({ message: t('saved') })
    navigate('/master', { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={existing ? `${g.icon} ${existing.nameHi}` : t('master_newGarment')} back="/master" />
      <Card className="flex flex-col gap-4">
        <TextField label={t('nameHi')} value={g.nameHi} error={error && !g.nameHi.trim() ? t('required') : undefined} onChange={(e) => set('nameHi', e.target.value)} />
        <TextField label={t('nameEn')} value={g.nameEn} onChange={(e) => set('nameEn', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t('rate')} type="number" inputMode="decimal" min={0} value={g.defaultRate} onChange={(e) => set('defaultRate', Math.max(0, Number(e.target.value)))} />
          <TextField label={t('deliveryDays')} type="number" inputMode="numeric" min={0} value={g.defaultDeliveryDays} onChange={(e) => set('defaultDeliveryDays', Math.max(0, Math.round(Number(e.target.value))))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-lg font-semibold">{t('category')}</span>
            <select className={inputClass} value={g.category} onChange={(e) => set('category', e.target.value as GarmentType['category'])}>
              {garmentCategorySchema.options.map((c) => (
                <option key={c} value={c}>
                  {t(`cat_${c}`)}
                </option>
              ))}
            </select>
          </label>
          <TextField label={t('icon')} value={g.icon} maxLength={8} onChange={(e) => set('icon', e.target.value)} />
        </div>
        <SwitchRow label={t('active')} hint={t('activeHelp')} checked={g.active} onCheckedChange={(v) => set('active', v)} />
      </Card>

      <ArchCard title={t('fields')}>
        <ul className="flex flex-col gap-3">
          {g.measurementFields.map((f, i) => (
            <li key={f.key || `new-${i}`} className="rounded-xl border border-line bg-surface-2 p-3">
              <div className="grid grid-cols-2 gap-2">
                <TextField label={t('nameHi')} value={f.labelHi} onChange={(e) => setField(i, { labelHi: e.target.value })} />
                <TextField label={t('nameEn')} value={f.labelEn} onChange={(e) => setField(i, { labelEn: e.target.value })} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select className={cn(inputClass, "w-auto flex-1")} aria-label={t('unit')} value={f.unit} onChange={(e) => setField(i, { unit: e.target.value as MeasurementField['unit'] })}>
                  <option value="inch">{t('unit_inch')}</option>
                  <option value="count">{t('unit_count')}</option>
                  <option value="text">{t('unit_text')}</option>
                </select>
                <Button variant="ghost" size="icon" aria-label={t('moveUp')} onClick={() => move(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button variant="ghost" size="icon" aria-label={t('moveDown')} onClick={() => move(i, 1)}>
                  <ArrowDown />
                </Button>
                <Button variant="ghost" size="icon" aria-label={t('remove')} onClick={() => set('measurementFields', g.measurementFields.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <Button
          variant="secondary"
          block
          className="mt-3"
          onClick={() => set('measurementFields', [...g.measurementFields, { key: '', labelHi: '', labelEn: '', unit: 'inch' }])}
        >
          <Plus /> {t('addField')}
        </Button>
      </ArchCard>

      <Button block onClick={save}>
        <Save /> {t('save')}
      </Button>
    </div>
  )
}

/* ---------------- Add-on editor ---------------- */

export function AddOnEditorPage() {
  const { id } = useParams()
  const { shopId } = useSession()
  const isManager = useIsManager()
  const addOns = useCollection<AddOn>(shopId, 'addOns', { includeDeleted: true })
  if (!isManager) return <Navigate to="/" replace />
  if (!addOns) return null
  const existing = id && id !== 'new' ? addOns.find((a) => a.id === id) : undefined
  return <AddOnEditor key={existing?.version ?? 'new'} existing={existing} nextSort={(Math.max(0, ...addOns.map((a) => a.sortOrder)) || 0) + 10} />
}

function AddOnEditor({ existing, nextSort }: { existing?: Stored<AddOn>; nextSort: number }) {
  const { t } = useI18n()
  const { ctx } = useSession()
  const navigate = useNavigate()
  const [a, setA] = useState<AddOn>(existing ? addOnSchema.parse(existing) : { nameHi: '', nameEn: '', defaultRate: 0, active: true, sortOrder: nextSort })
  const [error, setError] = useState(false)

  const save = () => {
    const parsed = addOnSchema.safeParse({ ...a, nameEn: a.nameEn || a.nameHi })
    if (!parsed.success) return setError(true)
    if (existing) updateRecord(ctx, 'addOns', addOnSchema, existing, parsed.data, { label: parsed.data.nameHi })
    else createRecord(ctx, 'addOns', addOnSchema, parsed.data, { label: parsed.data.nameHi })
    toast({ message: t('saved') })
    navigate('/master', { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={existing ? existing.nameHi : t('master_newAddon')} back="/master" />
      <Card className="flex flex-col gap-4">
        <TextField label={t('nameHi')} value={a.nameHi} error={error && !a.nameHi.trim() ? t('required') : undefined} onChange={(e) => setA({ ...a, nameHi: e.target.value })} />
        <TextField label={t('nameEn')} value={a.nameEn} onChange={(e) => setA({ ...a, nameEn: e.target.value })} />
        <TextField label={t('rate')} type="number" inputMode="decimal" min={0} value={a.defaultRate} onChange={(e) => setA({ ...a, defaultRate: Math.max(0, Number(e.target.value)) })} />
        <SwitchRow label={t('active')} hint={t('activeHelp')} checked={a.active} onCheckedChange={(v) => setA({ ...a, active: v })} />
      </Card>
      <Button block onClick={save}>
        <Save /> {t('save')}
      </Button>
    </div>
  )
}
