import { Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useSession } from '@/auth/AuthGate'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { TextField } from '@/components/ui/field'
import { Avatar, Chip, PageHeader } from '@/components/ui/page'
import { toast } from '@/components/ui/toast'
import { useCollection } from '@/data/hooks'
import type { Stored } from '@/data/types'
import { softDeleteRecord } from '@/data/write'
import { MarigoldBurst } from '@/design/motifs'
import { recordPayment } from '@/features/bills/actions'
import { billPaid } from '@/features/bills/ledger'
import type { Bill } from '@/features/bills/schema'
import { useLedger } from '@/features/bills/useLedger'
import type { Customer } from '@/features/customers/schema'
import { CustomerStep } from '@/features/orders/OrderWizard'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { fromISODate, toISODate } from '@/lib/dates'
import { formatDate, formatINR } from '@/lib/format'
import { haptic } from '@/lib/haptics'
import { PAYMENT_MODES, type Payment, type PaymentMode } from './schema'

export function PaymentPage() {
  const { t } = useI18n()
  const { shopId, ctx } = useSession()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const customers = useCollection<Customer>(shopId, 'customers')
  const { bills, payments, balances, loading } = useLedger()
  const customerId = params.get('customer') ?? ''
  const customer = customers?.find((c) => c.id === customerId)

  // Bills with something still due, oldest first.
  const openBills = useMemo(
    () =>
      (bills ?? [])
        .filter((b) => b.customerId === customerId)
        .map((b) => ({ bill: b, due: Math.max(0, b.total - billPaid(b, payments ?? [])) }))
        .filter((x) => x.due > 0)
        .sort((a, b) => a.bill.billDate.localeCompare(b.bill.billDate)),
    [bills, payments, customerId],
  )
  const balance = balances.get(customerId) ?? 0

  // Wait for bills and payments too: the form picks its starting bill and amount from them once.
  if (!customers || loading) return null

  if (!customer) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t('pay_title')} subtitle={t('ord_step1')} back="/" />
        <CustomerStep customers={customers} onPick={(c) => setParams({ customer: c.id }, { replace: true })} />
      </div>
    )
  }

  return (
    <PaymentForm
      key={customer.id}
      customer={customer}
      openBills={openBills}
      balance={balance}
      presetBill={params.get('bill')}
      onDone={(settled) => {
        if (settled) toast({ message: t('pay_settled') })
        navigate(params.get('bill') ? `/bills/${params.get('bill')}` : `/customers/${customer.id}?tab=money`, { replace: true })
      }}
      ctx={ctx}
    />
  )
}

function PaymentForm({
  customer,
  openBills,
  balance,
  presetBill,
  onDone,
  ctx,
}: {
  customer: Stored<Customer>
  openBills: { bill: Stored<Bill>; due: number }[]
  balance: number
  presetBill: string | null
  onDone: (settled: boolean) => void
  ctx: ReturnType<typeof useSession>['ctx']
}) {
  const { t } = useI18n()
  const initialBill = presetBill && openBills.some((b) => b.bill.id === presetBill) ? presetBill : (openBills[0]?.bill.id ?? null)
  const [billId, setBillId] = useState<string | null>(initialBill)
  const target = billId ? openBills.find((b) => b.bill.id === billId) : undefined
  const suggested = target ? target.due : Math.max(0, balance)
  const [amount, setAmount] = useState(suggested > 0 ? String(suggested) : '')
  const [mode, setMode] = useState<PaymentMode>('cash')
  const [date, setDate] = useState(() => toISODate(new Date()))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  const [burst, setBurst] = useState(false)

  const save = () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return setError(t('pay_invalid'))
    const payment: Payment = {
      customerId: customer.id,
      customerName: customer.name,
      orderId: null,
      billId,
      amount: Math.round(value * 100) / 100,
      mode,
      date,
      kind: 'payment',
      note,
    }
    const { id } = recordPayment(ctx, payment)
    haptic('success')
    const settled = target ? payment.amount >= target.due : balance > 0 && payment.amount >= balance
    toast({
      message: t('pay_saved', { amount: formatINR(payment.amount).replace('₹', ''), name: customer.name }),
      undo: () =>
        softDeleteRecord(ctx, 'payments', { id, ...payment, version: 1, createdAt: null, createdBy: ctx.uid, updatedAt: null, updatedBy: ctx.uid, isDeleted: false }, { label: customer.name }),
    })
    if (settled) {
      setBurst(true)
      setTimeout(() => onDone(true), 1500)
    } else onDone(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('pay_title')} back={presetBill ? `/bills/${presetBill}` : `/customers/${customer.id}`} />

      <Card className="flex items-center gap-3">
        <Avatar name={customer.name} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-semibold">{customer.name}</div>
          <div className={cn('money text-lg font-semibold', balance > 0 ? 'text-rani' : 'text-emerald-deep')}>
            {balance > 0 ? `${t('led_balance')}: ${formatINR(balance)}` : balance < 0 ? `${t('led_credit')}: ${formatINR(-balance)}` : t('led_settled')}
          </div>
        </div>
      </Card>

      {openBills.length > 0 && (
        <Card className="flex flex-col gap-2">
          <span className="text-lg font-semibold">{t('pay_forBill')}</span>
          {openBills.map(({ bill, due }) => (
            <Chip
              key={bill.id}
              selected={billId === bill.id}
              onClick={() => {
                setBillId(bill.id)
                setAmount(String(due))
              }}
            >
              <span className="money">
                {bill.billNumber} · {formatDate(fromISODate(bill.billDate))} · {t('ord_balance')} {formatINR(due)}
              </span>
            </Chip>
          ))}
          <Chip
            selected={billId === null}
            onClick={() => {
              setBillId(null)
              setAmount(balance > 0 ? String(balance) : '')
            }}
          >
            {t('pay_onAccount')}
          </Chip>
        </Card>
      )}

      <Card className="flex flex-col gap-4">
        <TextField
          label={t('pay_amount')}
          type="number"
          inputMode="decimal"
          min={0}
          autoFocus
          className="money text-3xl"
          value={amount}
          error={error}
          hint={suggested > 0 ? t('pay_fullDue', { amount: formatINR(suggested) }) : undefined}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="flex flex-col gap-2">
          <span className="text-lg font-semibold">{t('pay_mode')}</span>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_MODES.map((m) => (
              <Chip key={m} selected={mode === m} onClick={() => setMode(m)}>
                {t(`mode_${m}`)}
              </Chip>
            ))}
          </div>
        </div>
        <TextField label={t('pay_date')} type="date" value={date} onChange={(e) => setDate(e.target.value || date)} />
        <TextField label={t('pay_note')} value={note} onChange={(e) => setNote(e.target.value)} />
      </Card>

      <Button variant="success" block onClick={save}>
        <Save /> {t('pay_save')}
      </Button>
      <MarigoldBurst show={burst} />
    </div>
  )
}
