import { ChevronDown, Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useSession } from '@/auth/AuthGate'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { TextAreaField, TextField } from '@/components/ui/field'
import { Chip, PageHeader } from '@/components/ui/page'
import { toast } from '@/components/ui/toast'
import { useCollection } from '@/data/hooks'
import type { Stored } from '@/data/types'
import { createRecord, softDeleteRecord, updateRecord } from '@/data/write'
import { useI18n } from '@/i18n'
import type { StringKey } from '@/i18n/strings'
import { useDraft } from '@/lib/useDraft'
import { CUSTOMER_TAGS, customerSchema, EMPTY_CUSTOMER, normalizePhone, type Customer } from './schema'

type Errors = Partial<Record<keyof Customer, string>>

export function CustomerFormPage() {
  const { id } = useParams()
  const { shopId } = useSession()
  const customers = useCollection<Customer>(shopId, 'customers')
  if (customers === undefined) return null
  const existing = id ? customers.find((c) => c.id === id) : undefined
  if (id && !existing) return <PageHeader title="…" back="/customers" />
  // Remount when switching between customers so drafts don't mix.
  return <CustomerForm key={id ?? 'new'} existing={existing} all={customers} />
}

function CustomerForm({ existing, all }: { existing?: Stored<Customer>; all: Stored<Customer>[] }) {
  const { t } = useI18n()
  const { ctx } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const initial: Customer = existing
    ? { ...EMPTY_CUSTOMER, ...existing }
    : { ...EMPTY_CUSTOMER, name: params.get('name') ?? '' }
  const draft = useDraft<Customer>(`customer:${existing?.id ?? 'new'}`, initial)
  const c = draft.value
  const [errors, setErrors] = useState<Errors>({})
  const [more, setMore] = useState(!!existing && !!(existing.address || existing.altPhone || existing.notes || existing.tags?.length))

  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => draft.setValue((prev) => ({ ...prev, [k]: v }))

  const areas = useMemo(() => [...new Set(all.map((x) => x.area).filter(Boolean))].sort(), [all])
  const phone = normalizePhone(c.phone)
  const duplicate = phone.length === 10 ? all.find((x) => x.id !== existing?.id && x.phone === phone) : undefined

  const save = () => {
    const parsed = customerSchema.safeParse(c)
    if (!parsed.success) {
      const errs: Errors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Customer
        errs[key] = t((issue.message === 'invalidPhone' ? 'invalidPhone' : 'required') as StringKey)
      }
      setErrors(errs)
      if (errs.altPhone) setMore(true)
      return
    }
    const data = parsed.data
    if (existing) {
      const before = Object.fromEntries(Object.keys(data).map((k) => [k, existing[k as keyof Customer] ?? EMPTY_CUSTOMER[k as keyof Customer]])) as Customer
      updateRecord(ctx, 'customers', customerSchema, existing, data, { label: data.name })
      draft.clear()
      toast({
        message: t('cust_saved', { name: data.name }),
        undo: () => updateRecord(ctx, 'customers', customerSchema, { ...existing, ...data, version: existing.version + 1 }, before, { label: data.name }),
      })
      navigate(`/customers/${existing.id}`, { replace: true })
    } else {
      const { id } = createRecord(ctx, 'customers', customerSchema, data, { label: data.name })
      draft.clear()
      toast({
        message: t('cust_saved', { name: data.name }),
        undo: () => softDeleteRecord(ctx, 'customers', { id, ...data, version: 1, createdAt: null, createdBy: ctx.uid, updatedAt: null, updatedBy: ctx.uid, isDeleted: false }, { label: data.name }),
      })
      navigate(`/customers/${id}`, { replace: true })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={existing ? t('cust_editTitle') : t('cust_new')} back={existing ? `/customers/${existing.id}` : '/customers'} />

      {draft.restored && (
        <Card className="flex flex-wrap items-center gap-3 border-marigold bg-marigold/15">
          <span className="flex-1 text-lg">📝 {t('draftRestored')}</span>
          <Button
            variant="ghost"
            size="md"
            onClick={() => draft.reset(initial)}
          >
            {t('discardDraft')}
          </Button>
        </Card>
      )}

      <Card className="flex flex-col gap-4">
        <TextField label={t('cust_name')} value={c.name} error={errors.name} autoComplete="off" onChange={(e) => set('name', e.target.value)} />
        <TextField
          label={t('cust_phone')}
          value={c.phone}
          error={errors.phone}
          inputMode="tel"
          autoComplete="off"
          placeholder="98290 12345"
          onChange={(e) => set('phone', e.target.value)}
        />
        {duplicate && (
          <p role="alert" className="-mt-2 rounded-xl bg-marigold/20 p-3 text-lg">
            ⚠️ {t('cust_dupPhone', { name: duplicate.name })}{' '}
            <Link to={`/customers/${duplicate.id}`} className="font-semibold text-indigo-royal underline">
              {t('openExisting')}
            </Link>
          </p>
        )}
        <TextField label={t('cust_area')} value={c.area} list="gd-areas" autoComplete="off" onChange={(e) => set('area', e.target.value)} />
        <datalist id="gd-areas">
          {areas.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>

        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          aria-expanded={more}
          className="flex min-h-12 items-center gap-2 text-lg font-semibold text-indigo-royal"
        >
          <ChevronDown className={`size-6 transition ${more ? 'rotate-180' : ''}`} /> {t('moreDetails')}
        </button>

        {more && (
          <div className="flex flex-col gap-4">
            <TextField label={t('cust_altPhone')} value={c.altPhone} error={errors.altPhone} inputMode="tel" onChange={(e) => set('altPhone', e.target.value)} />
            <TextAreaField label={t('cust_address')} value={c.address} onChange={(e) => set('address', e.target.value)} />
            <div className="flex flex-col gap-2">
              <span className="text-lg font-semibold">{t('cust_tags')}</span>
              <div className="flex flex-wrap gap-2">
                {CUSTOMER_TAGS.map((tag) => (
                  <Chip
                    key={tag}
                    selected={c.tags.includes(tag)}
                    onClick={() => set('tags', c.tags.includes(tag) ? c.tags.filter((x) => x !== tag) : [...c.tags, tag])}
                  >
                    {t(`tag_${tag}`)}
                  </Chip>
                ))}
              </div>
            </div>
            <TextField label={t('cust_referredBy')} value={c.referredBy} onChange={(e) => set('referredBy', e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label={t('cust_birthday')} type="date" value={c.birthday} onChange={(e) => set('birthday', e.target.value)} />
              <TextField label={t('cust_anniversary')} type="date" value={c.anniversary} onChange={(e) => set('anniversary', e.target.value)} />
            </div>
            <TextAreaField label={t('cust_notes')} value={c.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        )}
      </Card>

      <Button block onClick={save}>
        <Save /> {t('save')}
      </Button>
    </div>
  )
}
