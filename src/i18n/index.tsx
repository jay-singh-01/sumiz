import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Language } from '@/data/types'
import { format } from './format'
import { strings, type StringKey } from './strings'

const STORAGE_KEY = 'gd.language'

function initialLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'hi'
  } catch {
    return 'hi'
  }
}

interface I18n {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: StringKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18n | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(initialLanguage)

  const setLang = useCallback((next: Language) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Not persisted; fine.
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo<I18n>(
    () => ({ lang, setLang, t: (key, vars) => format(strings[lang][key], vars) }),
    [lang, setLang],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside LanguageProvider')
  return ctx
}
