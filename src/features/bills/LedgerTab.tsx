import { BellRing, FileText, Loader2, Receipt, Trash2, Wallet } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import logoUrl from '@/assets/logo.svg'
import { useSession } from '@/auth/AuthGate'
import { useSettings } from '@/app/useShop'
import { Button } from '@/components/ui/button'
import { ArchCard, Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import type { Stored } from '@/data/types'
import { restoreRecord, softDeleteRecord } from '@/data/write'
import type { Customer } from '@/features/customers/schema'
import type { Payment } from '@/features/payments/schema'
import { useReminders } from '@/features/reminders/useReminders'
import { useI18n } from '@/i18n'
import type { StringKey } from '@/i18n/strings'
import { cn } from '@/lib/cn'
import { fromISODate } from '@/lib/dates'
import { formatDate, formatINR } from '@/lib/format'
import { whatsappLink } from '@/lib/whatsapp'
import { STATUS_CHIP } from './BillPage'
import { download, nodeToPng, pngToPdf, safeFileName, shareFile } from './exporter'
import { billPaid, ledgerEntries, type LedgerEntry } from './ledger'
import { computeBill } from './math'
import { useLedger } from './useLedger'

const KIND_LABEL: Record<LedgerEntry['kind'], StringKey> = {
  bill: 'led_bill',
  payment: 'led_payment',
  advance: 'led_advance',
  opening: 'led_opening',
}

export function BalanceText({ balance, className }: { balance: number; className?: string }) {
  const { t } = useI18n()
  if (balance > 0) return <span className={cn('money font-bold text-rani', className)}>{formatINR(balance)}</span>
  if (balance < 0)
    return (
      <span className={cn('money font-bold text-emerald-deep', className)} title={t('led_credit')}>
        +{formatINR(-balance)}
      </span>
    )
  return <span className={cn('font-semibold text-emerald-deep', className)}>✓ {t('led_settled')}</span>
}

export function LedgerTab({ customer }: { customer: Stored<Customer> }) {
  const { t, lang } = useI18n()
  const { ctx } = useSession()
  const { settings } = useSettings()
  const { bills, payments, balances } = useLedger()
  const [busy, setBusy] = useState(false)
  const [toDelete, setToDelete] = useState<Stored<Payment> | null>(null)
  const statementRef = useRef<HTMLDivElement>(null)
  const reminders = useReminders()
  const [today] = useState(() => new Date())

  const mineBills = useMemo(
    () => (bills ?? []).filter((b) => b.customerId === customer.id).sort((a, b) => b.billDate.localeCompare(a.billDate)),
    [bills, customer.id],
  )
  const entries = useMemo(() => ledgerEntries(customer.id, bills ?? [], payments ?? []), [bills, payments, customer.id])
  const balance = balances.get(customer.id) ?? 0

  const shareStatement = async () => {
    const node = statementRef.current?.firstElementChild as HTMLElement | null
    if (!node) return
    setBusy(true)
    try {
      const png = await nodeToPng(node)
      const blob = await pngToPdf(png, node, 'fit')
      const name = `${safeFileName(`${settings.shopName}-${customer.name}`)}.pdf`
      const text = `${t('led_statement')} — ${customer.name}: ${t('led_balance')} ${formatINR(Math.max(0, balance))} — ${settings.shopName}`
      if ((await shareFile(blob, name, text)) === 'unsupported') {
        download(blob, name)
        const wa = whatsappLink(customer.phone, text)
        if (wa) window.open(wa, '_blank', 'noopener')
        toast({ message: t('bill_downloaded') })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  const removePayment = (p: Stored<Payment>) => {
    softDeleteRecord(ctx, 'payments', p, { label: `${p.customerName} · ₹${p.amount}` })
    toast({
      message: t('cust_deleted', { name: formatINR(p.amount) }),
      undo: () => restoreRecord(ctx, 'payments', { ...p, version: p.version + 1, isDeleted: true }, { label: p.customerName }),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col items-center gap-1 py-5 text-center">
        <span className="text-lg text-ink-muted">{balance >= 0 ? t('led_balance') : t('led_credit')}</span>
        <BalanceText balance={balance} className="text-4xl" />
      </Card>

      {balance > 0 && (
        <Button
          variant="secondary"
          block
          onClick={() => {
            if (!reminders.send({ customerId: customer.id, customerName: customer.name, phone: customer.phone, type: 'paymentDue', amount: balance }))
              toast({ message: `⚠️ ${t('rem_noPhone')}` })
          }}
        >
          <BellRing /> {t('rem_payment')}
        </Button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="success">
          <Link to={`/payments/new?customer=${customer.id}`}>
            <Wallet /> {t('pay_title')}
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to={`/bills/new?customer=${customer.id}`}>
            <Receipt /> {t('bill_new')}
          </Link>
        </Button>
      </div>

      <ArchCard title={t('bill')} icon={<Receipt />}>
        {mineBills.length === 0 ? (
          <p className="text-ink-muted">{t('bill_none')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {mineBills.map((b) => {
              const paid = billPaid(b, payments ?? [])
              const status = computeBill({ lines: b.lines, discount: b.discount, roundOff: b.roundOff, taxPercent: b.gstPercent, payments: [paid] }).status
              return (
                <li key={b.id}>
                  <Link to={`/bills/${b.id}`} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 active:bg-line">
                    <span className="min-w-0 flex-1">
                      <span className="money block font-semibold">{b.billNumber}</span>
                      <span className="money block text-ink-muted">{formatDate(fromISODate(b.billDate))}</span>
                    </span>
                    <span className="money font-bold">{formatINR(b.total)}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-sm font-semibold', STATUS_CHIP[status])}>{t(`bill_status_${status}`)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </ArchCard>

      <ArchCard
        title={t('led_statement')}
        action={
          entries.length > 0 && (
            <Button variant="ghost" size="md" disabled={busy} onClick={() => void shareStatement()}>
              {busy ? <Loader2 className="animate-spin" /> : <FileText />} PDF
            </Button>
          )
        }
      >
        {entries.length === 0 ? (
          <p className="text-ink-muted">{t('led_none')}</p>
        ) : (
          <ul className="flex flex-col">
            {[...entries].reverse().map((e) => {
              const pay = e.kind !== 'bill' ? payments?.find((p) => p.id === e.id) : undefined
              return (
                <li key={`${e.kind}-${e.id}`} className="flex items-center gap-2 border-b border-line py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {t(KIND_LABEL[e.kind])} {e.kind === 'bill' ? <span className="money">{e.ref}</span> : <span className="text-ink-muted">· {t(`mode_${e.ref}` as StringKey)}</span>}
                    </span>
                    <span className="money block text-sm text-ink-muted">{formatDate(fromISODate(e.date))}</span>
                  </span>
                  <span className={cn('money font-bold', e.amount > 0 ? 'text-ink' : 'text-emerald-deep')}>
                    {e.amount > 0 ? '' : '− '}
                    {formatINR(Math.abs(e.amount))}
                  </span>
                  <span className="money w-24 text-right text-sm text-ink-muted">{formatINR(e.balance)}</span>
                  {pay && (
                    <button type="button" aria-label={t('remove')} onClick={() => setToDelete(pay)} className="grid size-11 place-items-center text-ink-muted">
                      <Trash2 className="size-5" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </ArchCard>

      {/* Off-screen statement document, captured for the PDF. */}
      <div ref={statementRef} aria-hidden className="pointer-events-none fixed top-0 -left-[9999px]">
        <article className="theme-light w-[400px] bg-[#fffdf7] p-5 text-[14px] text-ink" style={{ fontFamily: 'Mukta, sans-serif' }}>
          <header className="flex items-center gap-3 border-b-2 border-[#c9971c] pb-3">
            <img src={settings.logoUrl ?? logoUrl} alt="" className="size-12" />
            <div>
              <div className="text-2xl text-rani" style={{ fontFamily: '"Rozha One", serif' }}>
                {settings.shopName}
              </div>
              <div className="text-ink-muted">{settings.subLine}</div>
            </div>
          </header>
          <h2 className="mt-3 text-xl text-indigo-royal" style={{ fontFamily: '"Rozha One", serif' }}>
            {t('led_statement')}
          </h2>
          <p className="font-semibold">
            {customer.name} {customer.phone && <span className="money font-normal text-ink-muted">· {customer.phone}</span>}
          </p>
          <p className="text-ink-muted">{t('led_upto', { date: formatDate(today) })}</p>
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr className="border-b border-[#c9971c] text-left text-indigo-royal">
                <th className="py-1">{t('pay_date')}</th>
                <th className="py-1">{lang === 'hi' ? 'विवरण' : 'Details'}</th>
                <th className="py-1 text-right">₹</th>
                <th className="py-1 text-right">{t('led_runningBal')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={`${e.kind}-${e.id}`} className="border-b border-[#ead9bf]">
                  <td className="money py-1">{formatDate(fromISODate(e.date))}</td>
                  <td className="py-1">
                    {t(KIND_LABEL[e.kind])} {e.kind === 'bill' && <span className="money">{e.ref}</span>}
                  </td>
                  <td className="money py-1 text-right">{(e.amount > 0 ? '' : '− ') + formatINR(Math.abs(e.amount))}</td>
                  <td className="money py-1 text-right">{formatINR(e.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={cn('mt-3 rounded-xl px-3 py-2 text-center text-white', balance > 0 ? 'bg-rani' : 'bg-emerald-deep')}>
            <div className="text-sm">{balance > 0 ? t('led_balance') : balance < 0 ? t('led_credit') : t('led_settled')}</div>
            <div className="money text-2xl font-bold">{formatINR(Math.abs(balance))}</div>
          </div>
          {settings.upiId && balance > 0 && <p className="mt-2 text-center text-ink-muted">UPI: {settings.upiId}</p>}
          <p className="mt-3 text-center text-rani" style={{ fontFamily: '"Rozha One", serif' }}>
            {settings.billFooter}
          </p>
        </article>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t('pay_delete')}
        body={toDelete ? `${formatINR(toDelete.amount)} · ${formatDate(fromISODate(toDelete.date))} — ${t('pay_deleteBody')}` : ''}
        danger
        onConfirm={() => toDelete && removePayment(toDelete)}
      />
    </div>
  )
}
