import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useI18n } from '@/i18n'

// Minimal building blocks for the auth screens. Phase 3 replaces the styling
// with the full Rajasthani design system; sizes already follow the spec
// (≥48px touch targets, ≥17px text, icons paired with words).

export function Screen({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  const { t, lang, setLang } = useI18n()
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <span className="text-2xl font-bold text-rani">{t('appName')}</span>
        <button
          type="button"
          onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}
          className="min-h-12 rounded-full border-2 border-gold px-4 font-semibold text-indigo-royal"
        >
          {lang === 'hi' ? 'English' : 'हिंदी'}
        </button>
      </header>
      <h1 className="text-3xl font-bold text-indigo-royal">{title}</h1>
      {help && <p className="mt-2 text-lg text-ink/80">{help}</p>}
      <div className="mt-6 flex flex-1 flex-col gap-4">{children}</div>
    </main>
  )
}

export function BigButton({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const styles = {
    primary: 'bg-rani text-white shadow-md active:bg-rani/90',
    secondary: 'border-2 border-indigo-royal bg-white text-indigo-royal',
    danger: 'border-2 border-red-700 bg-white text-red-700',
  }[variant]
  return (
    <button
      type="button"
      {...props}
      className={`min-h-14 w-full rounded-2xl px-5 text-xl font-semibold transition disabled:opacity-50 ${styles} ${className}`}
    />
  )
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-lg font-semibold">{label}</span>
      {children}
      {hint && !error && <span className="text-base text-ink/70">{hint}</span>}
      {error && (
        <span role="alert" className="text-base font-semibold text-red-700">
          ⚠️ {error}
        </span>
      )}
    </label>
  )
}

export const inputClass =
  'min-h-14 rounded-xl border-2 border-ink/20 bg-white px-4 text-xl focus:border-rani focus:outline-none'

export function FullScreenMessage({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center px-4 text-center text-xl text-indigo-royal">
      {children}
    </main>
  )
}

/** Large on-screen keypad: easier than the phone keyboard for a 4-digit PIN. */
export function PinPad({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const { t } = useI18n()
  const press = (d: string) => {
    if (disabled || value.length >= 4) return
    navigator.vibrate?.(15)
    onChange(value + d)
  }
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-4" aria-label={`${value.length}/4`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`size-5 rounded-full border-2 border-rani ${i < value.length ? 'bg-rani' : 'bg-transparent'}`}
          />
        ))}
      </div>
      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => press(k)}
            className="h-16 rounded-2xl bg-white text-3xl font-semibold shadow tabular-nums active:bg-marigold/30"
          >
            {k}
          </button>
        ))}
        <span />
        <button
          type="button"
          disabled={disabled}
          onClick={() => press('0')}
          className="h-16 rounded-2xl bg-white text-3xl font-semibold shadow tabular-nums active:bg-marigold/30"
        >
          0
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(value.slice(0, -1))}
          className="h-16 rounded-2xl text-lg font-semibold text-indigo-royal"
        >
          ⌫ {t('delete')}
        </button>
      </div>
    </div>
  )
}
