import { useCallback, useSyncExternalStore } from 'react'

// Per-device display preferences (not synced: a big-text phone and a laptop
// can differ). index.html applies them before first paint.

export interface DisplayPrefs {
  largeText: boolean
  theme: 'light' | 'dark'
}

const KEY = 'gd.display'
const DEFAULTS: DisplayPrefs = { largeText: false, theme: 'light' }

function load(): DisplayPrefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return DEFAULTS
  }
}

let prefs = load()
const listeners = new Set<() => void>()

function apply(p: DisplayPrefs) {
  document.documentElement.classList.toggle('text-large', p.largeText)
  if (p.theme === 'dark') document.documentElement.dataset.theme = 'dark'
  else delete document.documentElement.dataset.theme
}

export function useDisplayPrefs(): [DisplayPrefs, (patch: Partial<DisplayPrefs>) => void] {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => prefs,
  )
  const update = useCallback((patch: Partial<DisplayPrefs>) => {
    prefs = { ...prefs, ...patch }
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {
      // Not persisted.
    }
    apply(prefs)
    listeners.forEach((l) => l())
  }, [])
  return [value, update]
}
