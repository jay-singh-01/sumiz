import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSession } from '@/auth/AuthGate'
import { Button } from '@/components/ui/button'
import { ArchCard, Card } from '@/components/ui/card'
import { TextField } from '@/components/ui/field'
import { Chip, PageHeader } from '@/components/ui/page'
import { toast } from '@/components/ui/toast'
import { useCollection } from '@/data/hooks'
import { createRecord, restoreRecord, softDeleteRecord } from '@/data/write'
import { useI18n } from '@/i18n'
import { fromISODate, toISODate } from '@/lib/dates'
import { formatDate, formatINR } from '@/lib/format'
import { VoiceButton } from './VoiceButton'
import { EXPENSE_CATEGORIES, expenseSchema, type Expense, type Karigar } from './schemas'

export function ExpensesPage() {
  const { t } = useI18n()
  const { shopId, ctx } = useSession()
  const expenses = useCollection<Expense>(shopId, 'expenses')
  const karigars = useCollection<Karigar>(shopId, 'karigars')
  const [category, setCategory] = useState<Expense['category']>('thread')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => toISODate(new Date()))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()

  const thisMonth = date.slice(0, 7)
  const sorted = useMemo(() => [...(expenses ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [expenses])
  const monthTotal = sorted.filter((e) => e.date.startsWith(thisMonth)).reduce((s, e) => s + Math.round(e.amount * 100), 0) / 100

  const save = () => {
    const v = Number(amount)
    if (!Number.isFinite(v) || v <= 0) return setError(t('pay_invalid'))
    setError(undefined)
    const data: Expense = { category, amount: Math.round(v * 100) / 100, date, note, karigarId: null }
    const { id } = createRecord(ctx, 'expenses', expenseSchema, data, { label: `${t(`exp_cat_${category}`)} · ₹${data.amount}` })
    toast({
      message: t('exp_saved'),
      undo: () => softDeleteRecord(ctx, 'expenses', { id, ...data, version: 1, createdAt: null, createdBy: ctx.uid, updatedAt: null, updatedBy: ctx.uid, isDeleted: false }),
    })
    setAmount('')
    setNote('')
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('exp_title')} subtitle={`${t('exp_monthTotal')}: ${formatINR(monthTotal)}`} back="/more" />
      <ArchCard title={t('exp_add')} icon={<Plus />}>
        <div className="flex flex-col gap-3">
          <span className="text-lg font-semibold">{t('exp_category')}</span>
          <div className="flex flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((c) => (
              <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>
                {t(`exp_cat_${c}`)}
              </Chip>
            ))}
          </div>
          <TextField label={t('exp_amount')} type="number" inputMode="decimal" min={0} className="money text-2xl" value={amount} error={error} onChange={(e) => setAmount(e.target.value)} />
          <TextField label={t('pay_date')} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <TextField label={t('pay_note')} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <VoiceButton onText={(x) => setNote((n) => (n ? `${n} ${x}` : x))} />
          </div>
          <Button onClick={save}>{t('save')}</Button>
        </div>
      </ArchCard>
      {sorted.length === 0 ? (
        <Card className="text-lg text-ink-muted">{t('exp_none')}</Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((e) => (
            <li key={e.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {t(`exp_cat_${e.category}`)}
                  {e.karigarId && ` · ${karigars?.find((k) => k.id === e.karigarId)?.name ?? ''}`}
                </div>
                <div className="money text-sm text-ink-muted">
                  {formatDate(fromISODate(e.date))}
                  {e.note && ` · ${e.note}`}
                </div>
              </div>
              <span className="money text-lg font-bold">{formatINR(e.amount)}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('delete')}
                onClick={() => {
                  softDeleteRecord(ctx, 'expenses', e)
                  toast({ message: t('cust_deleted', { name: formatINR(e.amount) }), undo: () => restoreRecord(ctx, 'expenses', { ...e, version: e.version + 1, isDeleted: true }) })
                }}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
