import type { ButtonHTMLAttributes, ReactNode } from 'react'
import logoUrl from '@/assets/logo.svg'
import { Button } from '@/components/ui/button'
import { LeheriyaDivider } from '@/design/motifs'
import { useI18n } from '@/i18n'

export { inputClass } from '@/components/ui/field'

// Layout for the pre-login screens (sign-in, setup, PIN).

export function Screen({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  const { t, lang, setLang } = useI18n()
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-4 py-6">
      <header className="mb-4 flex items-center gap-3">
        <img src={logoUrl} alt="" className="size-12" />
        <span className="flex-1 font-display text-2xl text-rani">{t('appName')}</span>
        <Button variant="secondary" size="md" className="border-gold" onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}>
          {lang === 'hi' ? 'English' : 'हिंदी'}
        </Button>
      </header>
      <LeheriyaDivider className="mb-6" />
      <h1 className="text-3xl">{title}</h1>
      {help && <p className="mt-2 text-lg text-ink-muted">{help}</p>}
      <div className="mt-6 flex flex-1 flex-col gap-4">{children}</div>
    </main>
  )
}

export function BigButton({
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  return <Button variant={variant} block {...props} />
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-lg font-semibold">{label}</span>
      {children}
      {hint && !error && <span className="text-base text-ink-muted">{hint}</span>}
      {error && (
        <span role="alert" className="text-base font-semibold text-danger">
          ⚠️ {error}
        </span>
      )}
    </label>
  )
}

export function FullScreenMessage({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center text-xl text-indigo-royal">
      <img src={logoUrl} alt="" className="size-20 animate-pulse" />
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
  const key = 'h-16 rounded-2xl bg-surface text-3xl font-semibold shadow money active:bg-marigold/30 disabled:opacity-50'
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-4" aria-label={`${value.length}/4`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`size-5 rounded-full border-2 border-rani ${i < value.length ? 'bg-rani' : 'bg-transparent'}`} />
        ))}
      </div>
      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
          <button key={k} type="button" disabled={disabled} onClick={() => press(k)} className={key}>
            {k}
          </button>
        ))}
        <span />
        <button type="button" disabled={disabled} onClick={() => press('0')} className={key}>
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
