import { ChevronDown, Download, FileText, Image as ImageIcon, Loader2, Pencil, Printer, Wallet } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useSettings } from '@/app/useShop'
import { Button } from '@/components/ui/button'
import { ArchCard, Card } from '@/components/ui/card'
import { FitToWidth } from '@/components/ui/fit'
import { Chip, PageHeader } from '@/components/ui/page'
import { toast } from '@/components/ui/toast'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { fromISODate } from '@/lib/dates'
import { formatDate, formatINR } from '@/lib/format'
import { whatsappLink } from '@/lib/whatsapp'
import { BillPreview, type BillView } from './BillPreview'
import { dataUrlToBlob, download, nodeToPng, pngToPdf, safeFileName, shareFile } from './exporter'
import { billPaid } from './ledger'
import { computeBill } from './math'
import type { Bill } from './schema'
import { upiLink, upiQrDataUrl } from './upi'
import { useLedger } from './useLedger'

type Busy = null | 'image' | 'pdf' | 'a4'

export const STATUS_CHIP = {
  unpaid: 'bg-rani text-on-rani',
  partial: 'bg-marigold text-on-marigold',
  paid: 'bg-emerald-deep text-on-emerald',
} as const

export function BillPage() {
  const { id = '' } = useParams()
  const { t } = useI18n()
  const { bills, payments } = useLedger()
  const { settings } = useSettings()
  const [layout, setLayout] = useState<'mobile' | 'a4'>('mobile')
  const [busy, setBusy] = useState<Busy>(null)
  const [showRevisions, setShowRevisions] = useState(false)
  const [viewRevision, setViewRevision] = useState<number | null>(null)
  const [qrFor, setQrFor] = useState<{ link: string; url: string } | null>(null)
  const docRef = useRef<HTMLDivElement>(null)

  const bill = bills?.find((b) => b.id === id)
  const paid = useMemo(() => (bill ? billPaid(bill, payments ?? []) : 0), [bill, payments])
  const totals = bill ? computeBill({ lines: bill.lines, discount: bill.discount, roundOff: bill.roundOff, taxPercent: bill.gstPercent, payments: [paid] }) : null
  const due = totals ? Math.max(0, totals.balance) : 0

  // UPI QR with the amount still due pre-filled.
  const link = bill && settings.upiId ? upiLink({ vpa: settings.upiId, payee: settings.shopName, amount: due, note: bill.billNumber }) : null
  useEffect(() => {
    if (!link) return
    let alive = true
    void upiQrDataUrl(link).then((url) => alive && setQrFor({ link, url }))
    return () => {
      alive = false
    }
  }, [link])
  // Only show a QR that matches the current amount due.
  const qr = link && qrFor?.link === link ? qrFor.url : undefined

  if (!bills) return null
  if (!bill || !totals) return <PageHeader title={t('bill_none')} back="/" />

  const shown: Pick<Bill, 'lines' | 'discount' | 'roundOff' | 'billDate'> & { revision: number } =
    viewRevision === null ? bill : (bill.revisions.find((r) => r.revision === viewRevision) ?? bill)

  const view: BillView = {
    number: bill.billNumber,
    date: fromISODate(shown.billDate),
    customer: { name: bill.customerName, phone: bill.customerPhone },
    orderNumber: bill.orderId ? bill.billNumber : undefined,
    lines: shown.lines,
    discount: shown.discount,
    roundOff: shown.roundOff,
    payments: viewRevision === null && paid > 0 ? [paid] : [],
    taxPercent: bill.gstPercent,
    gstin: bill.gstin,
    revision: shown.revision,
    notes: viewRevision === null ? bill.notes : undefined,
  }

  const message = t('bill_shareMsg', {
    name: bill.customerName,
    num: bill.billNumber,
    total: formatINR(totals.total).replace('₹', ''),
    due: formatINR(due).replace('₹', ''),
    upi: settings.upiId ? t('bill_upiLine', { upi: settings.upiId }) : '',
    shop: settings.shopName,
  })
  const fileBase = safeFileName(`${settings.shopName}-${bill.billNumber}`)

  const exportAs = async (kind: Exclude<Busy, null>) => {
    const node = docRef.current?.querySelector('article') as HTMLElement | null
    if (!node) return
    setBusy(kind)
    try {
      const png = await nodeToPng(node)
      const blob = kind === 'image' ? dataUrlToBlob(png) : await pngToPdf(png, node, kind === 'a4' ? 'a4' : 'fit')
      const name = `${fileBase}.${kind === 'image' ? 'png' : 'pdf'}`
      const result = await shareFile(blob, name, message)
      if (result === 'unsupported') {
        // Desktop / older phones: save the file and open the chat with the message.
        download(blob, name)
        const wa = whatsappLink(bill.customerPhone, message)
        if (wa) window.open(wa, '_blank', 'noopener')
        toast({ message: t('bill_downloaded') })
      }
    } catch (err) {
      console.error('Bill export failed', err)
      toast({ message: '⚠️ ' + String((err as Error).message ?? err) })
    } finally {
      setBusy(null)
    }
  }

  const isA4 = layout === 'a4'

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={bill.customerName}
        subtitle={
          <span className="money">
            {t('bill')} {bill.billNumber}
          </span>
        }
        back={bill.orderId ? `/orders/${bill.orderId}` : `/customers/${bill.customerId}`}
        action={<span className={cn('rounded-full px-3 py-1 font-semibold', STATUS_CHIP[totals.status])}>{t(`bill_status_${totals.status}`)}</span>}
      />

      <Card className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-sm text-ink-muted">{t('ord_total')}</div>
          <div className="money text-xl font-bold">{formatINR(totals.total)}</div>
        </div>
        <div>
          <div className="text-sm text-ink-muted">{t('bill_received')}</div>
          <div className="money text-xl font-bold text-emerald-deep">{formatINR(paid)}</div>
        </div>
        <div>
          <div className="text-sm text-ink-muted">{t('ord_balance')}</div>
          <div className={cn('money text-xl font-bold', due > 0 ? 'text-rani' : 'text-emerald-deep')}>{formatINR(due)}</div>
        </div>
      </Card>

      {due > 0 && (
        <Button asChild variant="success" block data-tour="bill-pay">
          <Link to={`/payments/new?customer=${bill.customerId}&bill=${bill.id}`}>
            <Wallet /> {t('pay_title')}
          </Link>
        </Button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button data-tour="bill-share" variant="primary" disabled={!!busy} onClick={() => void exportAs('image')}>
          {busy === 'image' ? <Loader2 className="animate-spin" /> : <ImageIcon />} {t('bill_shareImage')}
        </Button>
        <Button variant="secondary" disabled={!!busy} onClick={() => void exportAs(isA4 ? 'a4' : 'pdf')}>
          {busy === 'pdf' || busy === 'a4' ? <Loader2 className="animate-spin" /> : <FileText />} {t('bill_sharePdf')}
        </Button>
        <Button variant="secondary" size="md" onClick={() => window.print()}>
          <Printer /> {t('bill_print')}
        </Button>
        <Button asChild variant="secondary" size="md">
          <Link to={`/bills/${bill.id}/edit`}>
            <Pencil /> {t('bill_edit')}
          </Link>
        </Button>
      </div>
      {busy && <p className="text-center text-ink-muted">{t('bill_preparing')}</p>}
      {!settings.upiId && <p className="rounded-xl bg-marigold/15 p-3">ℹ️ {t('bill_noUpi')}</p>}

      <div className="flex gap-2">
        <Chip selected={!isA4} onClick={() => setLayout('mobile')}>
          📱 WhatsApp
        </Chip>
        <Chip selected={isA4} onClick={() => setLayout('a4')}>
          <Download className="inline size-5" /> {t('bill_a4')}
        </Chip>
      </div>

      <div ref={docRef} className="print-area rounded-xl bg-surface-2 p-2">
        <FitToWidth key={layout} className="mx-auto">
          <div className="shadow-2xl">
            <BillPreview bill={view} shop={settings} layout={layout} upiQr={viewRevision === null ? qr : undefined} />
          </div>
        </FitToWidth>
      </div>

      {bill.revisions.length > 0 && (
        <ArchCard title={t('bill_revisions', { n: bill.revisions.length })}>
          <button
            type="button"
            onClick={() => setShowRevisions((s) => !s)}
            aria-expanded={showRevisions}
            className="flex min-h-12 items-center gap-2 font-semibold text-indigo-royal"
          >
            <ChevronDown className={cn('size-5 transition', showRevisions && 'rotate-180')} /> {t('bill_revisions', { n: bill.revisions.length })}
          </button>
          {showRevisions && (
            <div className="flex flex-wrap gap-2">
              <Chip selected={viewRevision === null} onClick={() => setViewRevision(null)}>
                {t('bill_current')} · {formatINR(bill.total)}
              </Chip>
              {[...bill.revisions].reverse().map((r) => (
                <Chip key={r.revision} selected={viewRevision === r.revision} onClick={() => setViewRevision(r.revision)}>
                  {t('bill_revision', { n: r.revision })} · {formatINR(r.total)}
                </Chip>
              ))}
            </div>
          )}
          {viewRevision !== null && (
            <p className="mt-2 text-ink-muted">
              {(() => {
                const r = bill.revisions.find((x) => x.revision === viewRevision)
                return r ? `${formatDate(new Date(r.savedAt))} · ${t('ord_by', { name: r.savedBy })}` : ''
              })()}
            </p>
          )}
        </ArchCard>
      )}
    </div>
  )
}
