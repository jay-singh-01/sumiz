import { Phone, UserPlus, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSession } from '@/auth/AuthGate'
import { useIsManager } from '@/app/useShop'
import { Button } from '@/components/ui/button'
import { ArchCard, Card } from '@/components/ui/card'
import { TextField } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page'
import { toast } from '@/components/ui/toast'
import { useCollection } from '@/data/hooks'
import type { Stored } from '@/data/types'
import { createRecord } from '@/data/write'
import { isOpen } from '@/features/orders/logic'
import type { Order } from '@/features/orders/schema'
import { useI18n } from '@/i18n'
import { toISODate } from '@/lib/dates'
import { formatINR } from '@/lib/format'
import { telLink } from '@/lib/whatsapp'
import { expenseSchema, karigarSchema, type Expense, type Karigar } from './schemas'

/** Pieces handled by a karigar: delivered orders count as work done. */
export function karigarStats(k: Stored<Karigar>, orders: Stored<Order>[], expenses: Stored<Expense>[]) {
  const mine = orders.filter((o) => o.karigarId === k.id)
  const open = mine.filter(isOpen).length
  const donePieces = mine.filter((o) => o.status === 'delivered').reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0)
  const earned = Math.round(donePieces * k.ratePerPiece * 100) / 100
  const paid = expenses.filter((e) => e.karigarId === k.id).reduce((s, e) => s + Math.round(e.amount * 100), 0) / 100
  return { open, donePieces, earned, paid, due: Math.round((earned - paid) * 100) / 100 }
}

export function KarigarsPage() {
  const { t } = useI18n()
  const { shopId, ctx } = useSession()
  const isManager = useIsManager()
  const karigars = useCollection<Karigar>(shopId, 'karigars')
  const orders = useCollection<Order>(shopId, 'orders')
  const expenses = useCollection<Expense>(shopId, 'expenses')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [rate, setRate] = useState('')
  const [payFor, setPayFor] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')

  const rows = useMemo(
    () => (karigars ?? []).filter((k) => k.active).map((k) => ({ k, s: karigarStats(k, orders ?? [], expenses ?? []) })),
    [karigars, orders, expenses],
  )

  const add = () => {
    const parsed = karigarSchema.safeParse({ name, phone, ratePerPiece: Number(rate) || 0, active: true, notes: '' })
    if (!parsed.success) return toast({ message: `⚠️ ${t('required')}` })
    createRecord(ctx, 'karigars', karigarSchema, parsed.data, { label: parsed.data.name })
    toast({ message: t('kar_saved') })
    setName('')
    setPhone('')
    setRate('')
  }

  const pay = (k: Stored<Karigar>) => {
    const v = Number(payAmount)
    if (!Number.isFinite(v) || v <= 0) return toast({ message: `⚠️ ${t('pay_invalid')}` })
    createRecord(
      ctx,
      'expenses',
      expenseSchema,
      { category: 'karigar', amount: Math.round(v * 100) / 100, date: toISODate(new Date()), note: k.name, karigarId: k.id },
      { label: `${k.name} · ₹${v}` },
    )
    toast({ message: t('saved') })
    setPayFor(null)
    setPayAmount('')
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('kar_title')} back="/more" />
      {rows.length === 0 && <Card className="text-lg text-ink-muted">{t('kar_none')}</Card>}
      {rows.map(({ k, s }) => (
        <ArchCard key={k.id} title={k.name} action={k.phone ? <Button asChild variant="ghost" size="icon"><a href={telLink(k.phone) ?? undefined} aria-label={t('call')}><Phone /></a></Button> : undefined}>
          <div className="grid grid-cols-2 gap-2 text-lg sm:grid-cols-4">
            <div>
              <div className="text-sm text-ink-muted">{t('kar_rate')}</div>
              <div className="money font-bold">{formatINR(k.ratePerPiece)}</div>
            </div>
            <div>
              <div className="text-sm text-ink-muted">{t('kar_open', { n: '' }).trim()}</div>
              <div className="money font-bold">{s.open}</div>
            </div>
            <div>
              <div className="text-sm text-ink-muted">{t('kar_earned')}</div>
              <div className="money font-bold">{formatINR(s.earned)}</div>
            </div>
            <div>
              <div className="text-sm text-ink-muted">{t('kar_due')}</div>
              <div className={`money font-bold ${s.due > 0 ? 'text-rani' : 'text-emerald-deep'}`}>{formatINR(Math.max(0, s.due))}</div>
            </div>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {t('kar_paid')}: {formatINR(s.paid)} · {s.donePieces} {t('sum_mixPieces')}
          </p>
          {payFor === k.id ? (
            <div className="mt-3 flex items-end gap-2">
              <div className="flex-1">
                <TextField label={t('exp_amount')} type="number" inputMode="decimal" min={0} className="money" value={payAmount} autoFocus onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <Button variant="success" onClick={() => pay(k)}>
                {t('save')}
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="md"
              className="mt-3"
              onClick={() => {
                setPayFor(k.id)
                setPayAmount(s.due > 0 ? String(s.due) : '')
              }}
            >
              <Wallet /> {t('kar_pay')}
            </Button>
          )}
        </ArchCard>
      ))}
      {isManager ? (
        <ArchCard title={t('kar_add')} icon={<UserPlus />}>
          <div className="flex flex-col gap-3">
            <TextField label={t('cust_name')} value={name} onChange={(e) => setName(e.target.value)} />
            <TextField label={t('cust_phone')} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <TextField label={t('kar_rate')} type="number" inputMode="decimal" min={0} value={rate} onChange={(e) => setRate(e.target.value)} />
            <Button onClick={add}>{t('save')}</Button>
          </div>
        </ArchCard>
      ) : (
        <p className="text-ink-muted">{t('onlyManagers')}</p>
      )}
    </div>
  )
}
