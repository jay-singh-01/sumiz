import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { haptic } from '@/lib/haptics'

/** Page title with an always-visible labelled back button (no hidden gestures). */
export function PageHeader({ title, subtitle, back, action }: { title: ReactNode; subtitle?: ReactNode; back?: string | true; action?: ReactNode }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  return (
    <div className="mb-4 flex flex-col gap-2">
      {back && (
        <button
          type="button"
          onClick={() => {
            haptic('tap')
            if (back === true) navigate(-1)
            else navigate(back)
          }}
          className="-ml-2 flex min-h-12 w-fit items-center gap-1 rounded-xl px-2 text-lg font-semibold text-indigo-royal"
        >
          <ArrowLeft className="size-6" /> {t('back')}
        </button>
      )}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl break-words">{title}</h1>
          {subtitle && <div className="mt-0.5 text-lg text-ink-muted">{subtitle}</div>}
        </div>
        {action}
      </div>
    </div>
  )
}

/** Toggleable pill, e.g. customer tags. */
export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => {
        haptic('tap')
        onClick()
      }}
      className={cn(
        'min-h-12 rounded-full border-2 px-4 text-lg font-semibold transition',
        selected ? 'border-rani bg-rani text-on-rani' : 'border-line bg-surface text-ink',
      )}
    >
      {selected ? '✓ ' : ''}
      {children}
    </button>
  )
}

/** Segmented tabs with big targets. */
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div role="tablist" className="flex gap-1 rounded-2xl bg-surface-2 p-1">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          type="button"
          aria-selected={value === it.value}
          onClick={() => {
            haptic('tap')
            onChange(it.value)
          }}
          className={cn(
            'min-h-12 flex-1 rounded-xl px-3 text-lg font-semibold transition',
            value === it.value ? 'bg-surface text-rani shadow' : 'text-ink-muted',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

const AVATAR_COLORS = ['bg-rani text-on-rani', 'bg-indigo-royal text-on-indigo', 'bg-emerald-deep text-on-emerald', 'bg-marigold text-on-marigold']

export function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const first = [...name.trim()][0] ?? '?'
  // Keep a Devanagari letter whole with its matra (e.g. "सु").
  const initial = /[ऀ-ॿ]/.test(first) ? (name.trim().match(/^[ऀ-ॿ][ा-ॏंः]?/)?.[0] ?? first) : first.toUpperCase()
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-display',
        AVATAR_COLORS[h % AVATAR_COLORS.length],
        size === 'lg' ? 'size-20 text-4xl' : 'size-14 text-2xl',
      )}
    >
      {initial}
    </span>
  )
}
