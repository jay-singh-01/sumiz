import { Minus, PackagePlus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '@/auth/AuthGate'
import { Button } from '@/components/ui/button'
import { ArchCard, Card } from '@/components/ui/card'
import { TextField } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page'
import { toast } from '@/components/ui/toast'
import { useCollection } from '@/data/hooks'
import type { Stored } from '@/data/types'
import { createRecord, updateRecord } from '@/data/write'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { isLow, materialSchema, type Material } from './schemas'

export function MaterialsPage() {
  const { t } = useI18n()
  const { shopId, ctx } = useSession()
  const materials = useCollection<Material>(shopId, 'materials')
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [min, setMin] = useState('')
  const [unit, setUnit] = useState('')

  const list = [...(materials ?? [])].filter((m) => m.active).sort((a, b) => Number(isLow(b)) - Number(isLow(a)) || a.name.localeCompare(b.name))

  const bump = (m: Stored<Material>, delta: number) => updateRecord(ctx, 'materials', materialSchema, m, { qty: Math.max(0, m.qty + delta) }, { label: m.name })

  const add = () => {
    const parsed = materialSchema.safeParse({ name, qty: Number(qty) || 0, minQty: Number(min) || 0, unit, active: true })
    if (!parsed.success) return toast({ message: `⚠️ ${t('required')}` })
    createRecord(ctx, 'materials', materialSchema, parsed.data, { label: parsed.data.name })
    toast({ message: t('saved') })
    setName('')
    setQty('')
    setMin('')
    setUnit('')
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('mat_title')} back="/more" />
      {list.length === 0 && <Card className="text-lg text-ink-muted">{t('mat_none')}</Card>}
      <ul className="flex flex-col gap-2">
        {list.map((m) => (
          <li key={m.id} className={cn('flex items-center gap-2 rounded-2xl border bg-surface p-3', isLow(m) ? 'border-2 border-danger' : 'border-line')}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold">{m.name}</div>
              <div className="text-sm text-ink-muted">
                {t('mat_min')}: {m.minQty} {m.unit}
                {isLow(m) && <span className="ml-2 rounded-full bg-danger px-2 py-0.5 font-semibold text-on-danger">⚠️ {t('mat_lowItem')}</span>}
              </div>
            </div>
            <Button variant="secondary" size="icon" aria-label="−" onClick={() => bump(m, -1)}>
              <Minus />
            </Button>
            <span className="money w-16 text-center text-xl font-bold">
              {m.qty}
              <span className="block text-xs font-normal text-ink-muted">{m.unit}</span>
            </span>
            <Button variant="secondary" size="icon" aria-label="+" onClick={() => bump(m, 1)}>
              <Plus />
            </Button>
          </li>
        ))}
      </ul>
      <ArchCard title={t('mat_add')} icon={<PackagePlus />}>
        <div className="flex flex-col gap-3">
          <TextField label={t('mat_name')} value={name} placeholder="धागा (लाल)" onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t('mat_qty')} type="number" inputMode="decimal" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
            <TextField label={t('mat_min')} type="number" inputMode="decimal" min={0} value={min} onChange={(e) => setMin(e.target.value)} />
          </div>
          <TextField label={t('mat_unit')} value={unit} onChange={(e) => setUnit(e.target.value)} />
          <Button onClick={add}>{t('save')}</Button>
        </div>
      </ArchCard>
    </div>
  )
}
