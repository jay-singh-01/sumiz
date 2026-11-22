import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const inputClass =
  'min-h-14 w-full rounded-xl border-2 border-line bg-surface px-4 text-xl text-ink placeholder:text-ink-muted/70 focus:border-rani focus:outline-none disabled:opacity-60'

function Wrap({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-lg font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && <span className="text-base text-ink-muted">{hint}</span>}
      {error && (
        <span role="alert" className="text-base font-semibold text-danger">
          ⚠️ {error}
        </span>
      )}
    </div>
  )
}

export function TextField({
  label,
  hint,
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId()
  return (
    <Wrap id={id} label={label} hint={hint} error={error}>
      <input id={id} aria-invalid={!!error} className={cn(inputClass, error && 'border-danger', className)} {...props} />
    </Wrap>
  )
}

export function TextAreaField({
  label,
  hint,
  error,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string }) {
  const id = useId()
  return (
    <Wrap id={id} label={label} hint={hint} error={error}>
      <textarea id={id} rows={3} aria-invalid={!!error} className={cn(inputClass, 'py-3', error && 'border-danger', className)} {...props} />
    </Wrap>
  )
}
