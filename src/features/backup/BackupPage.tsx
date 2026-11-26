import { CloudDownload, FileJson, FileSpreadsheet, History, Loader2, RotateCcw, Share2, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { useSession } from '@/auth/AuthGate'
import { useIsManager, useSettings } from '@/app/useShop'
import { Button } from '@/components/ui/button'
import { ArchCard, Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Chip, PageHeader } from '@/components/ui/page'
import { toast } from '@/components/ui/toast'
import { parseBackup, planRestore, RESTORABLE, type Backup, type RestoreMode } from '@/data/backup'
import { applyRestore, collectBackup, currentState, lastBackupAt, markBackedUp, readBackupFile } from '@/data/backupActions'
import { download, safeFileName, shareFile } from '@/features/bills/exporter'
import { downloadWorkbook, type Sheet } from '@/features/reports/excel'
import { useI18n } from '@/i18n'
import type { StringKey } from '@/i18n/strings'
import { formatDate } from '@/lib/format'

const COLL_LABEL: Record<string, StringKey> = {
  customers: 'nav_customers',
  orders: 'nav_orders',
  bills: 'bill',
  payments: 'pay_title',
  measurements: 'tab_measurements',
  reminders: 'rem_title',
  garmentTypes: 'master_garments',
  addOns: 'master_addons',
  settings: 'settingsTitle',
  counters: 'orderPrefix',
}

/** A spreadsheet view of the main records, for reading the backup in Excel. */
function backupSheets(b: Backup): Sheet[] {
  const col = (name: string) => (b.collections as Record<string, Record<string, unknown>[] | undefined>)[name] ?? []
  const live = (rows: Record<string, unknown>[]) => rows.filter((r) => !r.isDeleted)
  const str = (v: unknown) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))
  return [
    {
      name: 'Customers',
      header: ['Name', 'Phone', 'Alt phone', 'Area', 'Address', 'Tags', 'Notes'],
      rows: live(col('customers')).map((c) => [str(c.name), str(c.phone), str(c.altPhone), str(c.area), str(c.address), ((c.tags as string[]) ?? []).join(', '), str(c.notes)]),
      widths: [22, 14, 14, 16, 30, 16, 30],
    },
    {
      name: 'Orders',
      header: ['Order', 'Date', 'Customer', 'Items', 'Status', 'Delivery'],
      rows: live(col('orders')).map((o) => [
        str(o.orderNumber),
        str(o.orderDate),
        str(o.customerName),
        ((o.items as { garmentName: string; qty: number; rate: number }[]) ?? []).map((i) => `${i.garmentName}×${i.qty} @${i.rate}`).join(', '),
        str(o.status),
        str(o.deliveryDate),
      ]),
      widths: [18, 12, 20, 40, 12, 12],
    },
    {
      name: 'Bills',
      header: ['Bill', 'Date', 'Customer', 'Total', 'Version'],
      rows: live(col('bills')).map((x) => [str(x.billNumber), str(x.billDate), str(x.customerName), Number(x.total) || 0, Number(x.revision) || 1]),
      widths: [18, 12, 20, 12, 8],
    },
    {
      name: 'Payments',
      header: ['Date', 'Customer', 'Amount', 'Mode', 'Kind', 'Note'],
      rows: live(col('payments')).map((x) => [str(x.date), str(x.customerName), Number(x.amount) || 0, str(x.mode), str(x.kind), str(x.note)]),
      widths: [12, 20, 12, 8, 10, 24],
    },
    {
      name: 'Measurements',
      header: ['Customer id', 'Garment', 'Taken on', 'Values', 'Notes'],
      rows: live(col('measurements')).map((m) => [
        str(m.customerId),
        str(m.garmentName),
        str(m.takenOn),
        Object.entries((m.values as Record<string, string>) ?? {})
          .map(([k, v]) => `${k}: ${v}`)
          .join(', '),
        str(m.notes),
      ]),
      widths: [22, 18, 12, 60, 24],
    },
  ]
}

export function BackupPage() {
  const { t } = useI18n()
  const { ctx, shopId } = useSession()
  const { settings } = useSettings()
  const isManager = useIsManager()
  const [busy, setBusy] = useState<null | 'json' | 'excel' | 'share'>(null)
  const [last, setLast] = useState(lastBackupAt)

  const take = async (kind: 'json' | 'excel' | 'share') => {
    const fileBase = `${settings.shopName}-backup-${new Date().toISOString().slice(0, 10)}`
    setBusy(kind)
    try {
      const backup = await collectBackup(ctx)
      if (kind === 'excel') {
        await downloadWorkbook(fileBase, backupSheets(backup))
      } else {
        const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
        const name = `${safeFileName(fileBase)}.json`
        if (kind === 'share' && (await shareFile(blob, name, `${settings.shopName} — backup`)) !== 'unsupported') {
          // shared to Drive / WhatsApp
        } else download(blob, name)
      }
      markBackedUp(ctx, kind)
      setLast(Date.now())
      toast({ message: t('bk_done') })
    } catch (err) {
      console.error('Backup failed', err)
      toast({ message: `⚠️ ${String((err as Error)?.message ?? err)}` })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('bk_title')} back="/settings" />

      <ArchCard title={t('bk_download')} icon={<CloudDownload />}>
        <p className="mb-1 text-lg">{t('bk_downloadHelp')}</p>
        <p className="mb-3 text-ink-muted">{last ? t('bk_last', { when: formatDate(new Date(last)) }) : t('bk_never')}</p>
        <div className="flex flex-col gap-2">
          <Button block disabled={!!busy} onClick={() => void take('share')}>
            {busy === 'share' ? <Loader2 className="animate-spin" /> : <Share2 />} {t('bk_share')}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={!!busy} onClick={() => void take('json')}>
              {busy === 'json' ? <Loader2 className="animate-spin" /> : <FileJson />} {t('bk_json')}
            </Button>
            <Button variant="secondary" disabled={!!busy} onClick={() => void take('excel')}>
              {busy === 'excel' ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} {t('bk_excel')}
            </Button>
          </div>
        </div>
        <p className="mt-3 text-sm text-ink-muted">🌙 {t('bk_nightly')}</p>
      </ArchCard>

      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="secondary">
          <Link to="/recycle">
            <Trash2 /> {t('rb_title')}
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/audit">
            <History /> {t('au_title')}
          </Link>
        </Button>
      </div>

      {isManager && <RestoreCard shopId={shopId} />}
    </div>
  )
}

function RestoreCard({ shopId }: { shopId: string }) {
  const { t } = useI18n()
  const { ctx } = useSession()
  const input = useRef<HTMLInputElement>(null)
  const [backup, setBackup] = useState<Backup | null>(null)
  const [current, setCurrent] = useState<Awaited<ReturnType<typeof currentState>> | null>(null)
  const [mode, setMode] = useState<RestoreMode>('missing')
  const [error, setError] = useState<string>()
  const [confirm, setConfirm] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)

  const plan = backup && current ? planRestore(backup, current as never, mode) : null

  const pick = async (file: File) => {
    setError(undefined)
    setBackup(null)
    try {
      const b = parseBackup(await readBackupFile(file))
      if (b.shopId !== shopId) return setError(t('bk_otherShop'))
      setCurrent(await currentState(shopId, RESTORABLE))
      setBackup(b)
    } catch {
      setError(t('bk_badFile'))
    }
  }

  const apply = async () => {
    if (!plan || !current) return
    setProgress(0)
    try {
      await applyRestore(ctx, plan.items, current as never, setProgress)
      toast({ message: t('bk_applied', { n: plan.items.length }) })
      setCurrent(await currentState(shopId, RESTORABLE))
    } catch (err) {
      console.error('Restore failed', err)
      toast({ message: `⚠️ ${String((err as Error)?.message ?? err)}` })
    } finally {
      setProgress(null)
    }
  }

  return (
    <ArchCard title={t('bk_restore')} icon={<RotateCcw />}>
      <p className="mb-3 text-lg">{t('bk_restoreHelp')}</p>
      <input
        ref={input}
        type="file"
        accept=".json,.gz,application/json,application/gzip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void pick(f)
          e.target.value = ''
        }}
      />
      <Button variant="secondary" block onClick={() => input.current?.click()}>
        <Upload /> {t('bk_pick')}
      </Button>
      {error && (
        <p role="alert" className="mt-2 font-semibold text-danger">
          ⚠️ {error}
        </p>
      )}

      {backup && plan && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="font-semibold">
            {t('bk_from', { source: t(`bk_src_${backup.source}`), date: formatDate(new Date(backup.exportedAt)) })}
          </p>
          <div className="flex flex-col gap-2">
            <Chip selected={mode === 'missing'} onClick={() => setMode('missing')}>
              {t('bk_modeMissing')}
            </Chip>
            <Chip selected={mode === 'overwrite'} onClick={() => setMode('overwrite')}>
              {t('bk_modeOverwrite')}
            </Chip>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-gold text-indigo-royal">
                  <th className="py-1 pr-2" />
                  <th className="py-1 pr-2 text-right">{t('bk_create')}</th>
                  <th className="py-1 pr-2 text-right">{t('bk_undelete')}</th>
                  <th className="py-1 pr-2 text-right">{t('bk_overwrite')}</th>
                  <th className="py-1 pr-2 text-right">{t('bk_unchanged')}</th>
                  <th className="py-1 text-right">{t('bk_keptNewer')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(plan.summary).map(([coll, s]) => (
                  <tr key={coll} className="border-b border-line">
                    <td className="py-1 pr-2 font-semibold">{COLL_LABEL[coll] ? t(COLL_LABEL[coll]) : coll}</td>
                    <td className="money py-1 pr-2 text-right">{s.create || ''}</td>
                    <td className="money py-1 pr-2 text-right">{s.undelete || ''}</td>
                    <td className="money py-1 pr-2 text-right">{s.overwrite || ''}</td>
                    <td className="money py-1 pr-2 text-right text-ink-muted">{s.unchanged || ''}</td>
                    <td className="money py-1 text-right text-ink-muted">{s.keptNewer || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.items.length === 0 ? (
            <Card className="text-lg text-emerald-deep">{t('bk_nothing')}</Card>
          ) : progress !== null ? (
            <p className="flex items-center gap-2 text-lg">
              <Loader2 className="animate-spin" /> {t('bk_applying', { done: progress, n: plan.items.length })}
            </p>
          ) : (
            <Button variant="danger" block onClick={() => setConfirm(true)}>
              <RotateCcw /> {t('bk_apply', { n: plan.items.length })}
            </Button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('bk_applyConfirm', { n: plan?.items.length ?? 0 })}
        body={t('bk_applyBody')}
        onConfirm={() => void apply()}
      />
    </ArchCard>
  )
}
