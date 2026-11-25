import { MessageSquareText, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '@/auth/AuthGate'
import { useIsManager, useSettings } from '@/app/useShop'
import { Button } from '@/components/ui/button'
import { ArchCard } from '@/components/ui/card'
import { TextAreaField } from '@/components/ui/field'
import { toast } from '@/components/ui/toast'
import { settingsSchema } from '@/data/schemas'
import { updateRecord } from '@/data/write'
import { useI18n } from '@/i18n'
import { buildMessage, DEFAULT_TEMPLATES, PLACEHOLDERS, REMINDER_TYPES, templatesSchema, type Templates } from './templates'

/** Settings card for the WhatsApp reminder templates (owner/admin). */
export function TemplatesEditor() {
  const { settings, doc } = useSettings()
  // Remount when the stored version changes (edited on another device).
  return <Editor key={doc?.version ?? 0} initial={{ ...DEFAULT_TEMPLATES, ...(settings.templates ?? {}) }} />
}

function Editor({ initial }: { initial: Templates }) {
  const { t } = useI18n()
  const { ctx } = useSession()
  const { settings, doc } = useSettings()
  const isManager = useIsManager()
  const [draft, setDraft] = useState<Templates>(initial)
  const [error, setError] = useState(false)

  const example = (type: keyof Templates) =>
    buildMessage(draft[type], {
      name: 'रीना',
      amount: '850',
      num: `${settings.orderPrefix}/26-27/A042`,
      date: '27/11/2026',
      upi: settings.upiId || undefined,
      shop: settings.shopName,
    })

  const save = () => {
    if (!doc) return
    const parsed = templatesSchema.safeParse(draft)
    if (!parsed.success) return setError(true)
    setError(false)
    updateRecord(ctx, 'settings', settingsSchema, doc, { templates: parsed.data }, { label: t('tpl_title') })
    toast({ message: t('saved') })
  }

  return (
    <ArchCard title={t('tpl_title')} icon={<MessageSquareText />}>
      <p className="mb-1 text-ink-muted">{t('tpl_help')}</p>
      <p className="money mb-3 flex flex-wrap gap-1">
        {PLACEHOLDERS.map((p) => (
          <code key={p} className="rounded bg-surface-2 px-2 py-0.5">
            {p}
          </code>
        ))}
      </p>
      <div className="flex flex-col gap-5">
        {REMINDER_TYPES.map((type) => (
          <div key={type} className="flex flex-col gap-2">
            <TextAreaField
              label={t(`tpl_${type}`)}
              value={draft[type]}
              disabled={!isManager}
              error={error && !draft[type].trim() ? t('required') : undefined}
              onChange={(e) => setDraft((d) => ({ ...d, [type]: e.target.value }))}
            />
            <p className="rounded-xl bg-emerald-deep/10 p-3 text-base">
              <span className="font-semibold text-emerald-deep">{t('tpl_example')}: </span>
              {example(type)}
            </p>
            {isManager && draft[type] !== DEFAULT_TEMPLATES[type] && (
              <Button variant="ghost" size="md" className="self-start" onClick={() => setDraft((d) => ({ ...d, [type]: DEFAULT_TEMPLATES[type] }))}>
                <RotateCcw /> {t('tpl_reset')}
              </Button>
            )}
          </div>
        ))}
      </div>
      {isManager ? (
        <Button block className="mt-4" onClick={save} disabled={!doc}>
          {t('save')}
        </Button>
      ) : (
        <p className="mt-3 text-ink-muted">{t('onlyManagers')}</p>
      )}
    </ArchCard>
  )
}
