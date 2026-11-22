import { createStore, del, get, set } from 'idb-keyval'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/*
 * Autosaves an in-progress form to IndexedDB, so a phone call, app switch or
 * crash never loses half-typed data. On the next visit the draft is restored.
 *
 * Rules that keep it safe:
 *  - a stored draft is restored only if the user hasn't started typing yet;
 *  - saving is debounced, but flushed immediately when the app goes to the
 *    background or the form closes (Android may kill a backgrounded app);
 *  - after clear()/reset() nothing is saved until the user edits again.
 */

const store = createStore('gd-drafts', 'drafts')
const SAVE_DELAY_MS = 400

export function useDraft<T>(key: string, initial: T): {
  value: T
  setValue: (next: T | ((prev: T) => T)) => void
  /** True when the form was restored from an unsaved draft. */
  restored: boolean
  /** Call after a successful save. */
  clear: () => void
  /** Throw the draft away and go back to `to`. */
  reset: (to: T) => void
} {
  const [value, setValueState] = useState<T>(initial)
  const [restored, setRestored] = useState(false)
  const dirty = useRef(false)
  const latest = useRef(value)
  useLayoutEffect(() => {
    latest.current = value
  }, [value])

  const flush = useCallback(() => {
    if (dirty.current) void set(key, latest.current, store).catch(() => undefined)
  }, [key])

  // Restore a stored draft, unless the user already started typing.
  useEffect(() => {
    let alive = true
    get<T>(key, store)
      .then((draft) => {
        if (alive && draft !== undefined && !dirty.current) {
          setValueState(draft)
          setRestored(true)
        }
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [key])

  // Debounced save after each edit.
  useEffect(() => {
    if (!dirty.current) return
    const timer = setTimeout(flush, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [value, flush])

  // Flush right away when backgrounded or unmounted.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [flush])

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    dirty.current = true
    setValueState(next)
  }, [])

  const clear = useCallback(() => {
    dirty.current = false
    setRestored(false)
    void del(key, store).catch(() => undefined)
  }, [key])

  const reset = useCallback(
    (to: T) => {
      dirty.current = false
      setValueState(to)
      setRestored(false)
      void del(key, store).catch(() => undefined)
    },
    [key],
  )

  return { value, setValue, restored, clear, reset }
}
