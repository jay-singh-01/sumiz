import { collection, getDocs, limit, orderBy, query, startAfter, Timestamp, where, type QueryDocumentSnapshot } from 'firebase/firestore'
import { History, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useSession } from '@/auth/AuthGate'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { inputClass, TextField } from '@/components/ui/field'
import { Chip, PageHeader } from '@/components/ui/page'
import { useCollection } from '@/data/hooks'
import type { ShopUser } from '@/data/schemas'
import type { AuditAction, AuditEntry } from '@/data/types'
import { Paisley } from '@/design/motifs'
import { useI18n } from '@/i18n'
import type { StringKey } from '@/i18n/strings'
import { fromISODate, toISODate } from '@/lib/dates'
import { db } from '@/lib/firebase'
import { describeAudit } from './describe'

type Group = 'all' | 'changes' | 'deletes' | 'logins' | 'backups'
const GROUPS: Record<Exclude<Group, 'all'>, AuditAction[]> = {
  changes: ['create', 'update'],
  deletes: ['delete', 'restore', 'restoreBackup'],
  logins: ['login', 'logout', 'signOutAll'],
  backups: ['backup', 'export'],
}
const GROUP_LABEL: Record<Group, StringKey> = { all: 'au_all', changes: 'au_changes', deletes: 'au_deletes', logins: 'au_logins', backups: 'au_backups' }
const PAGE = 50

type Row = AuditEntry & { id: string }

function linkFor(e: Row): string | null {
  if (e.action === 'delete' && e.entityType !== 'payments') return null
  if (e.entityType === 'customers') return `/customers/${e.entityId}`
  if (e.entityType === 'orders') return `/orders/${e.entityId}`
  if (e.entityType === 'bills') return `/bills/${e.entityId}`
  return null
}

export function AuditPage() {
  const { t, lang } = useI18n()
  const { shopId } = useSession()
  const users = useCollection<ShopUser>(shopId, 'users', { includeDeleted: true })
  const [from, setFrom] = useState(() => toISODate(new Date(Date.now() - 7 * 86_400_000)))
  const [to, setTo] = useState(() => toISODate(new Date()))
  const [group, setGroup] = useState<Group>('all')
  const [who, setWho] = useState('')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [offline, setOffline] = useState(false)

  // Server query: one time-ordered range (no composite index needed); the rest is filtered on the device.
  const load = useCallback(
    async (after: QueryDocumentSnapshot | null) => {
      setLoading(true)
      setOffline(false)
      try {
        const start = Timestamp.fromDate(fromISODate(from))
        const end = Timestamp.fromMillis(fromISODate(to).getTime() + 86_400_000 - 1)
        const base = [where('at', '>=', start), where('at', '<=', end), orderBy('at', 'desc'), limit(PAGE)] as const
        const q = after ? query(collection(db, 'shops', shopId, 'auditLogs'), ...base, startAfter(after)) : query(collection(db, 'shops', shopId, 'auditLogs'), ...base)
        const snap = await getDocs(q)
        const page = snap.docs.map((d) => ({ id: d.id, ...(d.data() as AuditEntry) }))
        setRows((r) => (after ? [...r, ...page] : page))
        setCursor(snap.docs[snap.docs.length - 1] ?? null)
        setHasMore(snap.docs.length === PAGE)
      } catch (err) {
        console.warn('Audit log unavailable', err)
        setOffline(true)
      } finally {
        setLoading(false)
      }
    },
    [shopId, from, to],
  )

  useEffect(() => {
    // Fetching on filter change is syncing with an external system (the server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(null)
  }, [load])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (group === 'all' || GROUPS[group].includes(r.action)) &&
        (!who || r.actorUid === who) &&
        (!q || (r.entityLabel ?? '').toLowerCase().includes(q) || r.entityId.toLowerCase().includes(q)),
    )
  }, [rows, group, who, search])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('au_title')} subtitle={t('au_help')} back="/backup" />

      <Card className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t('sum_from')} type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          <TextField label={t('sum_to')} type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(GROUP_LABEL) as Group[]).map((g) => (
            <Chip key={g} selected={group === g} onClick={() => setGroup(g)}>
              {t(GROUP_LABEL[g])}
            </Chip>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-semibold">{t('au_user')}</span>
            <select className={inputClass} value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">{t('au_all')}</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <TextField label={t('au_search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      {offline ? (
        <Card className="text-lg text-ink-muted">📶 {t('au_offline')}</Card>
      ) : shown.length === 0 && !loading ? (
        <Card className="flex items-center gap-4 text-lg text-ink-muted">
          <Paisley className="h-14 w-11 shrink-0 text-gold" /> {t('au_none')}
        </Card>
      ) : (
        <ol className="flex flex-col gap-2">
          {shown.map((r) => {
            const atMs = r.at?.toMillis() ?? null
            const text = describeAudit({ ...r, atMs }, lang)
            const href = linkFor(r)
            return (
              <li key={r.id} className="rounded-2xl border border-line bg-surface p-3">
                <div className="flex items-start gap-2">
                  <History className="mt-1 size-5 shrink-0 text-gold-deep" />
                  <div className="min-w-0 flex-1">
                    {href ? (
                      <Link to={href} className="text-lg text-indigo-royal underline">
                        {text}
                      </Link>
                    ) : (
                      <span className="text-lg">{text}</span>
                    )}
                    <div className="money text-sm text-ink-muted">
                      {atMs ? new Date(atMs).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''} · {r.device}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {loading && (
        <p className="flex items-center justify-center gap-2 text-ink-muted">
          <Loader2 className="animate-spin" />
        </p>
      )}
      {hasMore && !loading && (
        <Button variant="secondary" block onClick={() => void load(cursor)}>
          {t('au_more')}
        </Button>
      )}
    </div>
  )
}
