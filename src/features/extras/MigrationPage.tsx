import { writeBatch } from 'firebase/firestore'
import { Download, FileUp, Plus, Save, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router'
import { useSession } from '@/auth/AuthGate'
import { useIsManager } from '@/app/useShop'
import { Button } from '@/components/ui/button'
import { ArchCard, Card } from '@/components/ui/card'
import { inputClass, TextField } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page'
import { toast } from '@/components/ui/toast'
import { useCollection } from '@/data/hooks'
import { commitTracked, stageCreate, type StagedWrite } from '@/data/write'
import { download } from '@/features/bills/exporter'
import { customerSchema, type Customer } from '@/features/customers/schema'
import { paymentSchema } from '@/features/payments/schema'
import { useI18n } from '@/i18n'
import type { StringKey } from '@/i18n/strings'
import { cn } from '@/lib/cn'
import { toISODate } from '@/lib/dates'
import { db } from '@/lib/firebase'
import { formatINR } from '@/lib/format'
import { useDraft } from '@/lib/useDraft'
import { parseCsv, rowsFromTable, SAMPLE_CSV, validateRows, type MigrationRow } from './migration'
import { VoiceButton } from './VoiceButton'

const EMPTY: MigrationRow = { name: '', phone: '', area: '', balance: '' }
const PROBLEM: Record<string, StringKey> = { required: 'required', invalidPhone: 'invalidPhone', duplicate: 'mig_dup', badAmount: 'mig_badAmount' }
const PER_BATCH = 120 // customer + audit + opening payment + audit = 4 writes each

/** Fast bulk entry of old diary records: customer + opening balance per row. */
export function MigrationPage() {
  const { t } = useI18n()
  const { shopId, ctx } = useSession()
  const customers = useCollection<Customer>(shopId, 'customers')
  const [initial] = useState<{ rows: MigrationRow[]; asOf: string }>(() => ({ rows: [EMPTY, EMPTY, EMPTY], asOf: toISODate(new Date()) }))
  const draft = useDraft('migration', initial)
  const { rows, asOf } = draft.value
  const file = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const isManager = useIsManager()

  const phones = useMemo(() => new Set((customers ?? []).map((c) => c.phone).filter(Boolean)), [customers])
  const check = useMemo(() => validateRows(rows, phones), [rows, phones])
  const problemOf = new Map(check.problems.map((p) => [p.line, p.problem]))
  const setRow = (i: number, patch: Partial<MigrationRow>) => draft.setValue((d) => ({ ...d, rows: d.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }))

  const importFile = async (f: File) => {
    let table: (string | number | null)[][]
    if (/\.xlsx?$/i.test(f.name)) {
      const { default: readXlsxFile } = await import('read-excel-file/browser')
      table = (await readXlsxFile(f)) as unknown as (string | number | null)[][]
    } else table = parseCsv(await f.text())
    const imported = rowsFromTable(table)
    draft.setValue((d) => ({ ...d, rows: [...d.rows.filter((r) => r.name || r.phone || r.balance), ...imported] }))
  }

  const saveAll = async () => {
    if (!check.valid.length) return
    setSaving(true)
    try {
      for (let i = 0; i < check.valid.length; i += PER_BATCH) {
        const batch = writeBatch(db)
        let last: StagedWrite | null = null
        for (const v of check.valid.slice(i, i + PER_BATCH)) {
          const c = stageCreate(batch, ctx, 'customers', customerSchema, v.customer, { label: v.customer.name })
          last = c
          if (v.balance > 0)
            last = stageCreate(
              batch,
              ctx,
              'payments',
              paymentSchema,
              { customerId: c.id, customerName: v.customer.name, orderId: null, billId: null, amount: v.balance, mode: 'other', date: asOf, kind: 'opening', note: 'डायरी से' },
              { label: `${v.customer.name} · पुराना बकाया ₹${v.balance}` },
            )
        }
        if (last) void commitTracked(batch, ctx, last)
      }
      toast({ message: t('mig_saved', { n: check.valid.length }) })
      draft.reset({ rows: [EMPTY, EMPTY, EMPTY], asOf })
    } finally {
      setSaving(false)
    }
  }

  if (!isManager) return <Navigate to="/more" replace />

  return (
    <div className="flex flex-col gap-4 pb-24">
      <PageHeader title={t('mig_title')} subtitle={t('mig_help')} back="/more" />
      <Card className="flex flex-col gap-3">
        <TextField label={t('mig_asOf')} type="date" value={asOf} onChange={(e) => e.target.value && draft.setValue((d) => ({ ...d, asOf: e.target.value }))} />
        <div className="flex flex-wrap gap-2">
          <input ref={file} type="file" accept=".csv,.xlsx,.xls,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = '' }} />
          <Button variant="secondary" size="md" onClick={() => file.current?.click()}>
            <FileUp /> {t('mig_import')}
          </Button>
          <Button variant="ghost" size="md" onClick={() => download(new Blob(['﻿' + SAMPLE_CSV], { type: 'text/csv' }), 'gota-dhaaga-diary-sample.csv')}>
            <Download /> {t('mig_template')}
          </Button>
        </div>
        <p className="text-sm text-ink-muted">{t('mig_importHelp')}</p>
      </Card>

      <p className={cn('text-lg font-semibold', check.problems.length ? 'text-danger' : 'text-emerald-deep')}>{t('mig_preview', { ok: check.valid.length, bad: check.problems.length })}</p>

      {rows.map((r, i) => {
        const problem = problemOf.get(i + 1)
        return (
          <ArchCard
            key={i}
            title={`${i + 1}. ${r.name || t('cust_name')}`}
            className={problem ? 'border-2 border-danger' : undefined}
            action={
              <Button variant="ghost" size="icon" aria-label={t('remove')} onClick={() => draft.setValue((d) => ({ ...d, rows: d.rows.filter((_, j) => j !== i) }))}>
                <Trash2 />
              </Button>
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-end gap-2">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="font-semibold">{t('cust_name')}</span>
                  <input className={inputClass} value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} />
                </label>
                <VoiceButton onText={(x) => setRow(i, { name: x })} />
              </div>
              <label className="flex flex-col gap-1">
                <span className="font-semibold">{t('cust_phone')}</span>
                <input className={inputClass} inputMode="tel" value={r.phone} onChange={(e) => setRow(i, { phone: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold">{t('cust_area')}</span>
                <input className={inputClass} value={r.area} onChange={(e) => setRow(i, { area: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold">{t('mig_oldBalance')}</span>
                <input className={cn(inputClass, 'money')} inputMode="decimal" value={r.balance} onChange={(e) => setRow(i, { balance: e.target.value })} />
              </label>
            </div>
            {problem && <p className="mt-2 font-semibold text-danger">⚠️ {t(PROBLEM[problem])}</p>}
          </ArchCard>
        )
      })}

      <Button variant="secondary" block onClick={() => draft.setValue((d) => ({ ...d, rows: [...d.rows, EMPTY] }))}>
        <Plus /> {t('mig_addRow')}
      </Button>

      <div className="pb-safe fixed inset-x-0 bottom-[4.5rem] z-20 border-t border-line bg-surface/95 px-4 pt-2 backdrop-blur md:bottom-0 md:left-[17rem]">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <span className="money flex-1 text-lg">{formatINR(check.valid.reduce((s, v) => s + v.balance, 0))}</span>
          <Button variant="success" disabled={saving || !check.valid.length} onClick={() => void saveAll()}>
            <Save /> {t('mig_saveAll', { n: check.valid.length })}
          </Button>
        </div>
      </div>
    </div>
  )
}
