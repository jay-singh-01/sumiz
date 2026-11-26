import { useReducedMotion } from 'motion/react'
import { BarChart3, BellRing, CalendarRange, FileSpreadsheet, FileText, Loader2, Table2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router'
import { useSession } from '@/auth/AuthGate'
import { useIsManager, useSettings } from '@/app/useShop'
import { Button } from '@/components/ui/button'
import { ArchCard, Card } from '@/components/ui/card'
import { inputClass, TextField } from '@/components/ui/field'
import { Chip, PageHeader, Tabs } from '@/components/ui/page'
import { toast } from '@/components/ui/toast'
import { useCollection } from '@/data/hooks'
import { download, nodeToPng, pngToPagedPdf, safeFileName } from '@/features/bills/exporter'
import { useLedger } from '@/features/bills/useLedger'
import type { Customer } from '@/features/customers/schema'
import type { GarmentType } from '@/features/master/schema'
import { StatusChip } from '@/features/orders/components'
import { orderTotal } from '@/features/orders/logic'
import type { Order } from '@/features/orders/schema'
import { PAYMENT_MODES } from '@/features/payments/schema'
import { useI18n } from '@/i18n'
import type { StringKey } from '@/i18n/strings'
import { cn } from '@/lib/cn'
import { fromISODate, toISODate } from '@/lib/dates'
import { formatDate, formatINR, formatNumber } from '@/lib/format'
import { AgeingChart, CalendarHeat, HBarChart, TrendChart } from './charts'
import { useFeatures } from '@/app/features'
import { karigarStats } from '@/features/extras/KarigarsPage'
import type { Expense, Karigar } from '@/features/extras/schemas'
import { downloadWorkbook } from './excel'
import {
  AGE_BUCKETS,
  applyFilters,
  dayEnd,
  duesAgeing,
  garmentMix,
  kpis,
  monthlyTrend,
  ordersPerDay,
  pipelineCounts,
  presetRange,
  topCustomers,
  type Preset,
  type Range,
} from './metrics'

/** Animated count-up for headline numbers (skipped with reduced motion). */
function useCountUp(target: number, ms = 700) {
  const reduce = useReducedMotion()
  const [value, setValue] = useState(target)
  const from = useRef(0)
  useEffect(() => {
    if (reduce) return
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms)
      const eased = 1 - (1 - k) ** 3
      setValue(a + (target - a) * eased)
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms, reduce])
  return reduce ? target : value
}

function Kpi({ label, value, format, tone = 'ink', hint }: { label: string; value: number | null; format: (v: number) => string; tone?: 'ink' | 'rani' | 'emerald'; hint?: string }) {
  const shown = useCountUp(value ?? 0)
  return (
    <Card className="flex flex-col gap-1 p-3">
      <span className="text-base text-ink-muted">{label}</span>
      {/* Hero figure: body face, proportional digits (per dataviz guidance). */}
      <span className={cn('text-3xl font-bold', tone === 'rani' && 'text-rani', tone === 'emerald' && 'text-emerald-deep')}>
        {value === null ? '—' : format(Math.round(shown * 100) / 100)}
      </span>
      {hint && <span className="text-sm text-ink-muted">{hint}</span>}
    </Card>
  )
}

/** Chart card with a table view (values never live only in a tooltip). */
function ChartCard({ title, icon, table, children, action }: { title: string; icon?: ReactNode; table: { header: string[]; rows: (string | number)[][] }; children: ReactNode; action?: ReactNode }) {
  const { t } = useI18n()
  const [asTable, setAsTable] = useState(false)
  return (
    <ArchCard
      title={title}
      icon={icon}
      action={
        <div className="flex items-center gap-1">
          {action}
          <Button variant="ghost" size="md" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            {asTable ? <BarChart3 /> : <Table2 />} <span className="sr-only sm:not-sr-only">{asTable ? t('sum_chart') : t('sum_table')}</span>
          </Button>
        </div>
      }
    >
      {asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-gold text-indigo-royal">
                {table.header.map((h) => (
                  <th key={h} className="py-1 pr-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-b border-line">
                  {r.map((c, j) => (
                    <td key={j} className={cn('money py-1 pr-3', j > 0 && 'text-right')}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </ArchCard>
  )
}

export function SummaryPage() {
  const { t, lang } = useI18n()
  const isManager = useIsManager()
  const { shopId } = useSession()
  const { settings } = useSettings()
  const customers = useCollection<Customer>(shopId, 'customers')
  const orders = useCollection<Order>(shopId, 'orders')
  const garments = useCollection<GarmentType>(shopId, 'garmentTypes')
  const { bills, payments, balances, dues } = useLedger()
  const on = useFeatures()
  const expenses = useCollection<Expense>(shopId, 'expenses')
  const karigars = useCollection<Karigar>(shopId, 'karigars')
  const [now] = useState(() => new Date())
  const today = toISODate(now)

  const [preset, setPreset] = useState<Preset>('month')
  const [custom, setCustom] = useState<Range>(() => presetRange('month', now))
  const [garmentTypeId, setGarment] = useState('')
  const [area, setArea] = useState('')
  const [mode, setMode] = useState('')
  const [mixBy, setMixBy] = useState<'revenue' | 'pieces'>('revenue')
  const [topBy, setTopBy] = useState<'byRevenue' | 'byOrders' | 'byDues'>('byRevenue')
  const [ageSel, setAgeSel] = useState<number | null>(null)
  const [busy, setBusy] = useState<null | 'pdf' | 'excel'>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  const range = preset === 'custom' ? custom : presetRange(preset, now)
  const ready = customers && orders && bills && payments

  const m = useMemo(() => {
    if (!ready) return null
    const data = { orders, bills, payments, customers }
    const f = applyFilters(data, { range, garmentTypeId: garmentTypeId || undefined, area: area || undefined, mode: mode || undefined })
    // Heatmap: last 6 months on phones is handled by the chart; data covers 12.
    const heatFrom = toISODate(new Date(now.getFullYear(), now.getMonth() - 11, 1))
    return {
      f,
      k: kpis({ orders, customers }, f, range),
      trend: monthlyTrend(garmentTypeId || area ? f.bills : bills, mode || area ? f.payments : payments, now, 12),
      mix: garmentMix(f.orders, 7, lang === 'hi' ? 'अन्य' : 'Other'),
      ageing: duesAgeing(balances, bills, payments, today),
      top: topCustomers(f, balances),
      pipeline: pipelineCounts(orders),
      heat: ordersPerDay(orders, { from: heatFrom, to: today }),
      heatFrom,
      day: dayEnd({ orders, payments }, dues, today),
    }
  }, [ready, orders, bills, payments, customers, range.from, range.to, garmentTypeId, area, mode, balances, dues, today, now, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isManager) return <Navigate to="/" replace />
  if (!m || !customers || !orders) return null

  const nameOf = new Map(customers.map((c) => [c.id, c.name]))
  const areas = [...new Set(customers.map((c) => (c.area ?? '').trim()).filter(Boolean))].sort()
  const rangeLabel = `${formatDate(fromISODate(range.from))} – ${formatDate(fromISODate(range.to))}`
  const ageLabel = (b: string) => t('sum_ageingDays', { range: b })
  const monthName = (ym: string) =>
    new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'short', year: 'numeric' }).format(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)) - 1, 1))

  const exportPdf = async () => {
    const node = reportRef.current
    if (!node) return
    setBusy('pdf')
    try {
      const png = await nodeToPng(node, 2)
      download(await pngToPagedPdf(png, node), `${safeFileName(`${settings.shopName}-${t('nav_summary')}-${range.from}-${range.to}`)}.pdf`)
      toast({ message: t('sum_exported') })
    } catch (err) {
      console.error('PDF export failed', err)
      toast({ message: `⚠️ ${String((err as Error)?.message ?? err)}` })
    } finally {
      setBusy(null)
    }
  }

  const exportExcel = async () => {
    setBusy('excel')
    try {
      await downloadWorkbook(`${settings.shopName}-${t('nav_summary')}-${range.from}-${range.to}`, [
        {
          name: t('nav_summary'),
          header: [t('sum_period'), rangeLabel],
          rows: [
            [t('sum_billed'), m.k.billed],
            [t('sum_collected'), m.k.collected],
            [t('sum_outstanding'), dues],
            [t('sum_orders'), m.k.orders],
            [t('sum_avgOrder'), m.k.avgOrderValue],
            [t('sum_inProgress'), m.k.inProgress],
            [t('sum_delivered'), m.k.delivered],
            [t('sum_newCustomers'), m.k.newCustomers],
            [t('sum_onTime'), m.k.onTimePct === null ? null : `${m.k.onTimePct}%`],
          ],
          widths: [24, 24],
        },
        { name: t('sum_trend').slice(0, 31), header: [t('sum_month_col'), t('sum_billed'), t('sum_collected')], rows: m.trend.map((r) => [monthName(r.month), r.billed, r.collected]), widths: [16, 14, 14] },
        { name: t('sum_mix').slice(0, 31), header: [t('sum_garment'), t('sum_mixPieces'), t('sum_mixRevenue')], rows: m.mix.map((r) => [r.name, r.pieces, r.revenue]), widths: [24, 10, 14] },
        {
          name: t('sum_ageing').slice(0, 31),
          header: [t('sum_customer'), t('cust_phone'), t('sum_amount'), t('sum_days'), t('sum_ageing')],
          rows: m.ageing.flatMap((b) => b.customers.map((c) => [nameOf.get(c.customerId) ?? '', customers.find((x) => x.id === c.customerId)?.phone ?? '', c.amount, c.days, b.label])),
          widths: [24, 14, 12, 8, 10],
        },
        {
          name: t('nav_orders'),
          header: [t('ord_view'), t('ord_orderDate'), t('sum_customer'), t('ord_items'), t('ord_total'), t('ord_changeStatus'), t('ord_deliveryDate')],
          rows: m.f.orders.map((o) => [o.orderNumber, formatDate(fromISODate(o.orderDate)), o.customerName, o.items.map((i) => `${i.garmentName}×${i.qty}`).join(', '), orderTotal(o), t(`status_${o.status}` as StringKey), formatDate(fromISODate(o.deliveryDate))]),
          widths: [18, 12, 20, 30, 10, 12, 12],
        },
        {
          name: t('bill'),
          header: [t('bill'), t('bill_date'), t('sum_customer'), t('ord_total')],
          rows: m.f.bills.map((b) => [b.billNumber, formatDate(fromISODate(b.billDate)), nameOf.get(b.customerId) ?? '', b.total]),
          widths: [18, 12, 20, 12],
        },
        {
          name: t('pay_title'),
          header: [t('pay_date'), t('sum_customer'), t('sum_amount'), t('pay_mode')],
          rows: m.f.payments.map((x) => [formatDate(fromISODate(x.date)), nameOf.get(x.customerId) ?? '', x.amount, t(`mode_${x.mode}` as StringKey)]),
          widths: [12, 20, 12, 10],
        },
      ])
      toast({ message: t('sum_exported') })
    } catch (err) {
      console.error('Excel export failed', err)
      toast({ message: `⚠️ ${String((err as Error)?.message ?? err)}` })
    } finally {
      setBusy(null)
    }
  }

  const spent = (expenses ?? []).filter((e) => e.date >= range.from && e.date <= range.to).reduce((s, e) => s + Math.round(e.amount * 100), 0) / 100
  const byArea = [...customers.reduce((acc, c) => acc.set(c.area?.trim() || '—', (acc.get(c.area?.trim() || '—') ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }))
  const karigarRows = (karigars ?? []).filter((k) => k.active).map((k) => ({ k, s: karigarStats(k, orders, expenses ?? []) }))

  const topRows = m.top[topBy]
  const topFmt = (v: number) => (topBy === 'byOrders' ? formatNumber(v) : formatINR(v))
  const maxPipe = Math.max(1, ...m.pipeline.map((x) => x.count))
  const selectedBucket = ageSel === null ? null : m.ageing[ageSel]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('nav_summary')}
        subtitle={rangeLabel}
        back="/"
        action={
          <div className="flex gap-1">
            <Button variant="secondary" size="md" disabled={!!busy} onClick={() => void exportExcel()}>
              {busy === 'excel' ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} <span className="sr-only sm:not-sr-only">{t('sum_excel')}</span>
            </Button>
            <Button variant="secondary" size="md" disabled={!!busy} onClick={() => void exportPdf()}>
              {busy === 'pdf' ? <Loader2 className="animate-spin" /> : <FileText />} <span className="sr-only sm:not-sr-only">{t('sum_pdf')}</span>
            </Button>
          </div>
        }
      />

      {/* One filter bar above all charts. */}
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {(['today', 'week', 'month', 'fy', 'custom'] as Preset[]).map((p) => (
            <Chip key={p} selected={preset === p} onClick={() => setPreset(p)}>
              {p === 'custom' && <CalendarRange className="mr-1 inline size-5" />}
              {t(`sum_${p}` as StringKey)}
            </Chip>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t('sum_from')} type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} />
            <TextField label={t('sum_to')} type="date" value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="font-semibold">{t('sum_garment')}</span>
            <select className={inputClass} value={garmentTypeId} onChange={(e) => setGarment(e.target.value)}>
              <option value="">{t('sum_any')}</option>
              {garments?.map((g) => (
                <option key={g.id} value={g.id}>
                  {lang === 'hi' ? g.nameHi : g.nameEn}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">{t('sum_area')}</span>
            <select className={inputClass} value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">{t('sum_any')}</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">{t('sum_mode')}</span>
            <select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="">{t('sum_any')}</option>
              {PAYMENT_MODES.map((x) => (
                <option key={x} value={x}>
                  {t(`mode_${x}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <div ref={reportRef} className="flex flex-col gap-4 bg-ivory">
        <Card className="border-2 border-gold bg-surface-2 text-lg font-semibold">
          🌙{' '}
          {t('sum_dayEnd', {
            collected: formatINR(m.day.collected).replace('₹', ''),
            delivered: m.day.delivered,
            newOrders: m.day.newOrders,
            dues: formatINR(m.day.dues).replace('₹', ''),
          })}
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label={t('sum_billed')} value={m.k.billed} format={formatINR} />
          <Kpi label={t('sum_collected')} value={m.k.collected} format={formatINR} tone="emerald" />
          <Kpi label={t('sum_outstanding')} value={dues} format={formatINR} tone="rani" />
          <Kpi label={t('sum_avgOrder')} value={m.k.avgOrderValue} format={formatINR} hint={`${m.k.orders} ${t('sum_orders')}`} />
          <Kpi label={t('sum_inProgress')} value={m.k.inProgress} format={formatNumber} />
          <Kpi label={t('sum_delivered')} value={m.k.delivered} format={formatNumber} />
          <Kpi label={t('sum_newCustomers')} value={m.k.newCustomers} format={formatNumber} />
          {on('expenses') && <Kpi label={t('sum_expenses')} value={spent} format={formatINR} />}
          {on('expenses') && <Kpi label={t('sum_profit')} value={m.k.collected - spent} format={formatINR} tone={m.k.collected - spent >= 0 ? 'emerald' : 'rani'} hint={t('sum_profitHelp')} />}
          <Kpi label={t('sum_onTime')} value={m.k.onTimePct} format={(v) => `${Math.round(v)}%`} tone={m.k.onTimePct !== null && m.k.onTimePct < 70 ? 'rani' : 'emerald'} />
        </div>

        <ChartCard
          title={t('sum_trend')}
          table={{ header: [t('sum_month_col'), t('sum_billed'), t('sum_collected')], rows: m.trend.map((r) => [monthName(r.month), formatINR(r.billed), formatINR(r.collected)]) }}
        >
          <TrendChart data={m.trend} labels={[t('sum_billed'), t('sum_collected')]} lang={lang} />
        </ChartCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title={t('sum_mix')}
            table={{ header: [t('sum_garment'), t('sum_mixPieces'), t('sum_mixRevenue')], rows: m.mix.map((r) => [r.name, formatNumber(r.pieces), formatINR(r.revenue)]) }}
          >
            <div className="mb-2 flex gap-2">
              <Chip selected={mixBy === 'revenue'} onClick={() => setMixBy('revenue')}>
                {t('sum_mixRevenue')}
              </Chip>
              <Chip selected={mixBy === 'pieces'} onClick={() => setMixBy('pieces')}>
                {t('sum_mixPieces')}
              </Chip>
            </div>
            {m.mix.length === 0 ? (
              <p className="text-ink-muted">{t('sum_none')}</p>
            ) : (
              <HBarChart
                rows={[...m.mix].sort((a, b) => Number(!!a.other) - Number(!!b.other) || (mixBy === 'revenue' ? b.revenue - a.revenue : b.pieces - a.pieces)).map((r) => ({ name: r.name, value: mixBy === 'revenue' ? r.revenue : r.pieces }))}
                format={mixBy === 'revenue' ? formatINR : formatNumber}
              />
            )}
          </ChartCard>

          <ChartCard
            title={t('sum_ageing')}
            table={{ header: [t('sum_days'), t('sum_amount'), t('rem_count', { n: '' }).trim()], rows: m.ageing.map((b) => [ageLabel(b.label), formatINR(b.amount), b.customers.length]) }}
          >
            <AgeingChart buckets={m.ageing} labelFor={ageLabel} selected={ageSel} onPick={(i) => setAgeSel((s) => (s === i ? null : i))} />
            {selectedBucket && (
              <div className="mt-2 flex flex-col gap-2">
                <ul className="flex flex-col">
                  {selectedBucket.customers.map((c) => (
                    <li key={c.customerId} className="flex justify-between border-b border-line py-1">
                      <Link to={`/customers/${c.customerId}?tab=money`} className="font-semibold text-indigo-royal underline">
                        {nameOf.get(c.customerId)}
                      </Link>
                      <span className="money">
                        {formatINR(c.amount)} · {c.days} {t('sum_days')}
                      </span>
                    </li>
                  ))}
                </ul>
                {selectedBucket.customers.length > 0 && (
                  <Button asChild variant="success" size="md">
                    <Link to="/reminders">
                      <BellRing /> {t('sum_remindAll')}
                    </Link>
                  </Button>
                )}
              </div>
            )}
            <p className="mt-1 text-sm text-ink-muted">{AGE_BUCKETS.map((b, i) => `${ageLabel(b)}: ${formatINR(m.ageing[i].amount)}`).join(' · ')}</p>
          </ChartCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ArchCard title={t('sum_pipeline')}>
            <ul className="flex flex-col gap-2">
              {m.pipeline.map((p) => (
                <li key={p.status} className="flex items-center gap-3">
                  <span className="w-28 shrink-0">
                    <StatusChip status={p.status} />
                  </span>
                  <span className="h-6 flex-1 rounded-r bg-surface-2">
                    <span className="block h-full rounded-r bg-[var(--series-2)]" style={{ width: `${(p.count / maxPipe) * 100}%`, minWidth: p.count ? 4 : 0 }} />
                  </span>
                  <span className="w-8 text-right font-bold">{p.count}</span>
                </li>
              ))}
            </ul>
          </ArchCard>

          <ArchCard title={t('sum_top')}>
            <Tabs
              value={topBy}
              onChange={setTopBy}
              items={[
                { value: 'byRevenue', label: t('sum_topRevenue') },
                { value: 'byOrders', label: t('sum_topOrders') },
                { value: 'byDues', label: t('sum_topDues') },
              ]}
            />
            {topRows.length === 0 ? (
              <p className="mt-3 text-ink-muted">{t('sum_none')}</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-2">
                {topRows.map((row, i) => (
                  <li key={row.customerId} className="flex items-center gap-2">
                    <span className="w-6 text-ink-muted">{i + 1}.</span>
                    <Link to={`/customers/${row.customerId}`} className="min-w-0 flex-1 truncate font-semibold text-indigo-royal underline">
                      {nameOf.get(row.customerId) ?? '—'}
                    </Link>
                    <span className="money font-bold">{topFmt(row.value)}</span>
                  </li>
                ))}
              </ol>
            )}
          </ArchCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title={t('sum_areas')} table={{ header: [t('sum_area'), t('nav_customers')], rows: byArea.map((r) => [r.name, r.value]) }}>
            {byArea.length ? <HBarChart rows={byArea} format={formatNumber} /> : <p className="text-ink-muted">{t('sum_none')}</p>}
          </ChartCard>
          {on('karigars') && karigarRows.length > 0 && (
            <ArchCard title={t('sum_karigars')}>
              <ul className="flex flex-col gap-2">
                {karigarRows.map(({ k, s }) => (
                  <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-1">
                    <span className="font-semibold">{k.name}</span>
                    <span className="money text-ink-muted">
                      {t('kar_open', { n: s.open })} · {t('kar_earned')} {formatINR(s.earned)} · {t('kar_due')} {formatINR(Math.max(0, s.due))}
                    </span>
                  </li>
                ))}
              </ul>
            </ArchCard>
          )}
        </div>

        <ChartCard
          title={t('sum_heatmap')}
          table={{ header: [t('pay_date'), t('sum_orders')], rows: [...m.heat].reverse().slice(0, 60).map(([d, n]) => [formatDate(fromISODate(d)), n]) }}
        >
          <CalendarHeat days={m.heat} range={[m.heatFrom, today]} unit={(n) => t('sum_ordersDay', { n })} />
        </ChartCard>
      </div>
    </div>
  )
}
