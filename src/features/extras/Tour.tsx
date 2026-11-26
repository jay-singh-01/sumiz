import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

/*
 * "दिखाओ कैसे" guided tour: highlights one element at a time (found by its
 * data-tour attribute) with a short Hindi explanation. No hidden gestures:
 * big Next / Skip buttons.
 */

export interface TourStep {
  target: string // data-tour value
  hi: string
  en: string
}

let steps: TourStep[] = []
let index = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
let snapshot = { steps, index }
const getSnapshot = () => snapshot
const set = (s: TourStep[], i: number) => {
  steps = s
  index = i
  snapshot = { steps, index }
  emit()
}

/** Starts a tour with the steps whose targets are on screen right now. */
export function startTour(all: TourStep[]) {
  const visible = all.filter((s) => document.querySelector(`[data-tour="${s.target}"]`))
  if (visible.length) set(visible, 0)
}

function useRect(target: string | undefined) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  useLayoutEffect(() => {
    if (!target) return
    const el = document.querySelector(`[data-tour="${target}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const update = () => setRect(el.getBoundingClientRect())
    const timer = setTimeout(update, 350) // after the smooth scroll
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [target])
  return rect
}

export function TourOverlay() {
  const { t, lang } = useI18n()
  const { steps: s, index: i } = useSyncExternalStore(subscribe, getSnapshot)
  const step = s[i]
  const rect = useRect(step?.target)
  useEffect(() => {
    if (!step) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && set([], 0)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])
  if (!step) return null

  const pad = 8
  const below = rect ? rect.bottom + 180 < window.innerHeight : true
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={t('help_title')}>
        {rect && (
          <motion.div
            className="pointer-events-none absolute rounded-2xl"
            initial={false}
            animate={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            style={{ boxShadow: '0 0 0 9999px rgba(20,10,20,.62), 0 0 0 4px var(--marigold)' }}
          />
        )}
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute inset-x-4 mx-auto max-w-md rounded-[var(--radius-card)] border-2 border-gold bg-surface p-4 shadow-2xl"
          style={rect ? (below ? { top: Math.min(rect.bottom + pad + 12, window.innerHeight - 200) } : { bottom: window.innerHeight - rect.top + pad + 12 }) : { bottom: 24 }}
        >
          <p className="text-xl leading-snug">{lang === 'hi' ? step.hi : step.en}</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="flex-1 text-ink-muted">
              {i + 1} / {s.length}
            </span>
            <Button variant="ghost" size="md" onClick={() => set([], 0)}>
              {t('help_skip')}
            </Button>
            <Button size="md" onClick={() => (i + 1 < s.length ? set(s, i + 1) : set([], 0))}>
              {i + 1 < s.length ? t('help_next') : t('help_done')}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
