import { useEffect, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { CloudOff, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react'
import { getConflictTick, getPendingCount, isFlushingLeftovers, listConflicts, subscribeOutbox } from '@/data/outbox'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { deriveSyncState } from './syncState'

function useOnline(): boolean {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener('online', l)
      window.addEventListener('offline', l)
      return () => {
        window.removeEventListener('online', l)
        window.removeEventListener('offline', l)
      }
    },
    () => navigator.onLine,
  )
}

function useConflictCount(): number {
  const tick = useSyncExternalStore(subscribeOutbox, getConflictTick)
  const [count, setCount] = useState(0)
  useEffect(() => {
    let alive = true
    void listConflicts().then((c) => alive && setCount(c.length))
    return () => {
      alive = false
    }
  }, [tick])
  return count
}

/** Always-visible "is my data safe?" badge. */
export function SyncIndicator({ compact }: { compact?: boolean }) {
  const { t } = useI18n()
  const online = useOnline()
  const pending = useSyncExternalStore(subscribeOutbox, getPendingCount)
  const flushing = useSyncExternalStore(subscribeOutbox, isFlushingLeftovers)
  const conflicts = useConflictCount()
  const state = deriveSyncState(online, pending, flushing)

  const view = {
    saved: { icon: <CheckCircle2 />, text: t('syncSaved'), cls: 'bg-emerald-deep text-on-emerald' },
    syncing: {
      icon: <RefreshCw className="animate-spin" />,
      text: pending > 0 ? t('syncSyncingN', { n: pending }) : t('syncSyncing'),
      cls: 'bg-indigo-royal text-on-indigo',
    },
    offline: { icon: <CloudOff />, text: t('syncOffline'), cls: 'bg-marigold text-on-marigold' },
  }[state]

  return (
    <div className="flex items-center gap-2">
      <span
        role="status"
        aria-live="polite"
        title={view.text}
        className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold [&_svg]:size-4', view.cls)}
      >
        {view.icon}
        <span className={cn(compact && 'sr-only sm:not-sr-only')}>{view.text}</span>
      </span>
      {conflicts > 0 && (
        <Link
          to="/settings#conflicts"
          className="inline-flex min-h-9 items-center gap-1 rounded-full bg-danger px-3 text-sm font-semibold text-on-danger [&_svg]:size-4"
        >
          <AlertTriangle /> {conflicts}
        </Link>
      )}
    </div>
  )
}
