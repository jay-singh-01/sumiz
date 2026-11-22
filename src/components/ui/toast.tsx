import { AnimatePresence, motion } from 'motion/react'
import { useSyncExternalStore } from 'react'
import { CheckCircle2, Undo2 } from 'lucide-react'
import { useI18n } from '@/i18n'
import { haptic } from '@/lib/haptics'

/*
 * Toast with an optional 5-second "Undo" — shown after every save or delete.
 * Usage: toast({ message: 'ग्राहक सेव हुआ', undo: () => restoreRecord(...) })
 */

interface ToastItem {
  id: number
  message: string
  undo?: () => void
}

export const UNDO_WINDOW_MS = 5000

let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

export function toast(t: Omit<ToastItem, 'id'>): void {
  const id = nextId++
  items = [...items.slice(-2), { ...t, id }]
  emit()
  haptic('success')
  setTimeout(() => dismiss(id), UNDO_WINDOW_MS)
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function Toaster() {
  const { t } = useI18n()
  const list = useSyncExternalStore(subscribe, () => items)
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
      <AnimatePresence>
        {list.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="pointer-events-auto relative flex w-full max-w-md items-center gap-3 overflow-hidden rounded-2xl bg-indigo-royal px-4 py-3 text-on-indigo shadow-xl"
          >
            <CheckCircle2 className="size-6 shrink-0" />
            <span className="flex-1 text-lg">{item.message}</span>
            {item.undo && (
              <button
                type="button"
                onClick={() => {
                  item.undo?.()
                  dismiss(item.id)
                }}
                className="flex min-h-12 items-center gap-1 rounded-xl bg-marigold px-3 text-lg font-bold text-on-marigold"
              >
                <Undo2 className="size-5" /> {t('undo')}
              </button>
            )}
            <motion.span
              className="absolute bottom-0 left-0 h-1 bg-marigold"
              initial={{ width: '100%' }}
              animate={{ width: 0 }}
              transition={{ duration: UNDO_WINDOW_MS / 1000, ease: 'linear' }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
