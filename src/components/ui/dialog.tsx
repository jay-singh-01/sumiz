import { Dialog as D } from 'radix-ui'
import type { ReactNode } from 'react'
import { useI18n } from '@/i18n'
import { Button } from './button'

/**
 * Plain-language yes/no confirmation. Big buttons, no hidden gestures:
 * tapping outside or pressing back simply cancels.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  body?: ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
}) {
  const { t } = useI18n()
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
        <D.Content className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-[var(--radius-card)] border-2 border-gold bg-surface p-5 shadow-2xl sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
          <D.Title className="font-display text-2xl text-indigo-royal">{title}</D.Title>
          {body && <D.Description className="mt-2 text-lg text-ink">{body}</D.Description>}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button
              variant={danger ? 'danger' : 'primary'}
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
            >
              {confirmLabel ?? t('yes')}
            </Button>
            <D.Close asChild>
              <Button variant="secondary">{t('no')}</Button>
            </D.Close>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
