import logoUrl from '@/assets/logo.svg'
import logoMonoUrl from '@/assets/logo-mono.svg'
import type { Settings } from '@/data/schemas'
import { cn } from '@/lib/cn'
import { formatDate, formatINR } from '@/lib/format'
import { computeBill, type BillInput } from './math'

/*
 * The bill: rendered as real HTML/CSS so the browser shapes Devanagari
 * correctly, then (Phase 6) captured to PNG/PDF with html-to-image + jsPDF.
 * Always light-themed (.theme-light) so it looks the same on every device.
 */

export interface BillView extends BillInput {
  number: string
  date: Date
  customer: { name: string; phone?: string }
  orderNumber?: string
  deliveryDate?: Date
}

const ARCH =
  'M136 448V240c0-36 14-52 32-62 2-28 24-46 48-48 8-22 24-32 40-50 16 18 32 28 40 50 24 2 46 20 48 48 18 10 32 26 32 62v208z'

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-4 py-0.5', strong && 'font-bold', muted && 'text-ink-muted')}>
      <span>{label}</span>
      <span className="money">{value}</span>
    </div>
  )
}

export function BillPreview({
  bill,
  shop,
  layout = 'mobile',
  upiQr,
}: {
  bill: BillView
  shop: Settings
  layout?: 'mobile' | 'a4'
  /** Data URL of the UPI QR (Phase 6). A placeholder is drawn if absent. */
  upiQr?: string
}) {
  const t = computeBill(bill)
  const a4 = layout === 'a4'

  return (
    <article
      className={cn(
        'theme-light relative overflow-hidden bg-[#fffdf7] text-ink',
        a4 ? 'w-[794px] min-h-[1123px] p-10 text-[15px]' : 'w-[400px] p-5 text-[14px]',
      )}
      style={{ fontFamily: 'Mukta, sans-serif' }}
    >
      {/* gold foil double border */}
      <div className="pointer-events-none absolute inset-2 rounded-xl border-[3px] border-[#c9971c]" />
      <div className="pointer-events-none absolute inset-[14px] rounded-lg border border-[#e6c46a]" />
      <div className="leheriya pointer-events-none absolute inset-x-[14px] top-[14px] h-1.5 opacity-80" />

      {/* jharokha header */}
      <header className="relative flex flex-col items-center pt-6 text-center">
        <svg viewBox="120 64 272 140" className={cn('absolute top-1 text-[#e6c46a]', a4 ? 'h-24' : 'h-[4.5rem]')} fill="none" stroke="currentColor" strokeWidth="5" aria-hidden>
          <path d={ARCH} />
        </svg>
        <img src={shop.logoUrl ?? logoUrl} alt="" className={cn('relative', a4 ? 'size-20' : 'size-14')} />
        <h1 className={cn('relative mt-1 font-display text-rani', a4 ? 'text-5xl' : 'text-3xl')} style={{ fontFamily: '"Rozha One", serif' }}>
          {shop.shopName}
        </h1>
        <p className="relative font-semibold text-indigo-royal">{shop.subLine}</p>
        <p className="relative mt-0.5 italic text-gold-deep">“{shop.tagline}”</p>
        {(shop.address || shop.phone) && (
          <p className="relative mt-1 text-ink-muted">
            {shop.address}
            {shop.address && shop.phone && ' · '}
            {shop.phone && `📞 ${shop.phone}`}
          </p>
        )}
      </header>

      <div className="relative mx-2 mt-4 flex items-end justify-between border-y-2 border-dashed border-[#e6c46a] py-2">
        <div>
          <div className="text-ink-muted">बिल / Bill</div>
          <div className="money text-lg font-bold">{bill.number}</div>
        </div>
        <div className="text-right">
          <div className="text-ink-muted">दिनांक / Date</div>
          <div className="money font-semibold">{formatDate(bill.date)}</div>
        </div>
      </div>

      <div className="relative mx-2 mt-3 rounded-lg bg-[#fdf0dc] px-3 py-2">
        <span className="text-ink-muted">ग्राहक / Customer: </span>
        <span className="font-bold">{bill.customer.name}</span>
        {bill.customer.phone && <span className="money text-ink-muted"> · {bill.customer.phone}</span>}
        {bill.orderNumber && <div className="money text-ink-muted">ऑर्डर / Order: {bill.orderNumber}</div>}
      </div>

      {/* items */}
      <table className="relative mx-2 mt-3 w-[calc(100%-1rem)] border-collapse">
        <thead>
          <tr className="border-b-2 border-[#c9971c] text-left text-indigo-royal">
            <th className="py-1 font-semibold">विवरण / Item</th>
            <th className="py-1 text-center font-semibold">नग</th>
            <th className="py-1 text-right font-semibold">दर</th>
            <th className="py-1 text-right font-semibold">राशि</th>
          </tr>
        </thead>
        <tbody>
          {bill.lines.map((line, i) => (
            <tr key={i} className="border-b border-[#ead9bf] align-top">
              <td className="py-1.5">
                <div className="font-semibold">{line.name}</div>
                {line.addOns?.map((a, j) => (
                  <div key={j} className="money text-ink-muted">
                    + {a.name} ({formatINR(a.rate)})
                  </div>
                ))}
              </td>
              <td className="money py-1.5 text-center">{line.qty}</td>
              <td className="money py-1.5 text-right">{formatINR(line.rate)}</td>
              <td className="money py-1.5 text-right font-semibold">{formatINR(t.lineTotals[i])}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* totals */}
      <div className="relative mx-2 mt-3 flex gap-4">
        <div className="flex shrink-0 flex-col items-center">
          {t.status === 'paid' ? (
            // Settled: the QR is no longer needed, so the PAID stamp takes its place.
            <div className={cn('flex -rotate-12 flex-col items-center justify-center rounded-2xl border-4 border-[#047857] text-[#047857]', a4 ? 'size-32' : 'size-24')}>
              <img src={logoMonoUrl} alt="" className="size-7 opacity-80" style={{ filter: 'invert(29%) sepia(86%) saturate(1200%) hue-rotate(140deg)' }} />
              <span className="text-xl leading-none font-bold tracking-widest">PAID</span>
              <span className="text-xs font-semibold">भुगतान हो गया</span>
            </div>
          ) : upiQr ? (
            <img src={upiQr} alt="UPI QR" className={a4 ? 'size-32' : 'size-24'} />
          ) : (
            <div className={cn('grid place-items-center rounded border-2 border-dashed border-[#c9971c] text-center text-xs text-ink-muted', a4 ? 'size-32' : 'size-24')}>
              UPI QR
            </div>
          )}
          {shop.upiId && t.status !== 'paid' && <div className="mt-1 text-xs text-ink-muted">{shop.upiId}</div>}
        </div>
        <div className="flex-1">
          <Row label="कुल / Subtotal" value={formatINR(t.subtotal)} />
          {t.discount > 0 && <Row label="छूट / Discount" value={`− ${formatINR(t.discount)}`} />}
          {t.roundOff !== 0 && <Row label="राउंड ऑफ़" value={formatINR(t.roundOff)} muted />}
          <Row label="कुल राशि / Total" value={formatINR(t.total)} strong />
          {t.paid > 0 && <Row label="जमा / Paid" value={`− ${formatINR(t.paid)}`} />}
          <div className={cn('mt-2 rounded-xl px-3 py-2 text-center', t.balance > 0 ? 'bg-rani text-white' : 'bg-emerald-deep text-white')}>
            <div className="text-sm">{t.balance > 0 ? 'बाकी / Balance due' : 'पूरा भुगतान / Fully paid'}</div>
            <div className={cn('money font-bold', a4 ? 'text-4xl' : 'text-3xl')}>{formatINR(Math.max(t.balance, 0))}</div>
          </div>
        </div>
      </div>

      <footer className="relative mt-5 pb-3 text-center">
        <div className="mx-auto mb-2 h-px w-2/3 bg-[#e6c46a]" />
        <p className="font-display text-lg text-rani" style={{ fontFamily: '"Rozha One", serif' }}>
          {shop.billFooter}
        </p>
      </footer>
    </article>
  )
}
