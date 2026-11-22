import { Switch as S } from 'radix-ui'
import { useId } from 'react'
import { haptic } from '@/lib/haptics'

/** Labelled on/off switch; the whole row is the touch target. */
export function SwitchRow({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string
  hint?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex min-h-14 items-center gap-3">
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="block text-lg font-semibold">{label}</span>
        {hint && <span className="block text-base text-ink-muted">{hint}</span>}
      </label>
      <S.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => {
          haptic('tap')
          onCheckedChange(v)
        }}
        className="relative h-9 w-16 shrink-0 rounded-full bg-line transition data-[state=checked]:bg-emerald-deep disabled:opacity-50"
      >
        <S.Thumb className="block size-7 translate-x-1 rounded-full bg-white shadow transition data-[state=checked]:translate-x-8" />
      </S.Root>
    </div>
  )
}
