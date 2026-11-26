import { BellRing, Camera, Percent, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '@/auth/AuthGate'
import { useDisplayPrefs } from '@/app/display'
import { FEATURES, useFeatures, type Feature } from '@/app/features'
import { useIsManager, useSettings } from '@/app/useShop'
import { Button } from '@/components/ui/button'
import { ArchCard } from '@/components/ui/card'
import { TextField } from '@/components/ui/field'
import { SwitchRow } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import { settingsSchema, type Settings } from '@/data/schemas'
import type { Stored } from '@/data/types'
import { updateRecord } from '@/data/write'
import { useI18n } from '@/i18n'
import type { StringKey } from '@/i18n/strings'

/** Night mode (per device) + the evening notification permission. */
export function DeviceExtras() {
  const { t } = useI18n()
  const on = useFeatures()
  const [prefs, setPrefs] = useDisplayPrefs()
  const [perm, setPerm] = useState(() => (typeof Notification === 'undefined' ? 'denied' : Notification.permission))
  return (
    <>
      <SwitchRow label={`🌙 ${t('darkMode')}`} hint={t('darkModeHint')} checked={prefs.theme === 'dark'} onCheckedChange={(v) => setPrefs({ theme: v ? 'dark' : 'light' })} />
      {on('dailyNotification') && typeof Notification !== 'undefined' && (
        <div className="mt-2">
          {perm === 'granted' ? (
            <p className="flex items-center gap-2 text-emerald-deep">
              <BellRing className="size-5" /> {t('notif_on')}
            </p>
          ) : perm === 'denied' ? (
            <p className="text-ink-muted">{t('notif_denied')}</p>
          ) : (
            <Button variant="secondary" size="md" onClick={() => void Notification.requestPermission().then(setPerm)}>
              <BellRing /> {t('notif_enable')}
            </Button>
          )}
        </div>
      )}
    </>
  )
}

/** Shop-wide switches (owner/admin): extra features, GST, photo service. */
export function ExtrasSettings() {
  const { settings, doc } = useSettings()
  // Wait for the saved settings: the form's fields start from them.
  if (doc === undefined) return null
  return <ExtrasForm key={doc?.version ?? 0} settings={settings} doc={doc} />
}

function ExtrasForm({ settings, doc }: { settings: Settings; doc: Stored<Settings> | null }) {
  const { t } = useI18n()
  const { ctx } = useSession()
  const isManager = useIsManager()
  const [gst, setGst] = useState(settings.gst ?? { enabled: false, gstin: '', rate: 5 })
  const [cloud, setCloud] = useState(settings.cloudinary ?? { cloudName: '', uploadPreset: '' })

  const save = (patch: Partial<Settings>) => {
    if (!doc) return
    updateRecord(ctx, 'settings', settingsSchema, doc, patch, { label: settings.shopName })
    toast({ message: t('saved') })
  }
  const toggle = (f: Feature, v: boolean) => save({ features: { ...(settings.features ?? {}), [f]: v } })

  return (
    <>
      <ArchCard title={t('feat_title')} icon={<Sparkles />}>
        <p className="mb-2 text-ink-muted">{isManager ? t('feat_help') : t('onlyManagers')}</p>
        {FEATURES.map((f) => (
          <SwitchRow key={f} label={t(`feat_${f}` as StringKey)} checked={settings.features?.[f] ?? true} disabled={!isManager || !doc} onCheckedChange={(v) => toggle(f, v)} />
        ))}
      </ArchCard>

      {isManager && (
        <ArchCard title={t('gst_title')} icon={<Percent />}>
          <SwitchRow label={t('gst_enable')} hint={t('gst_help')} checked={gst.enabled} onCheckedChange={(v) => setGst((g) => ({ ...g, enabled: v }))} />
          {gst.enabled && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <TextField label={t('gst_number')} value={gst.gstin} maxLength={15} autoCapitalize="characters" onChange={(e) => setGst((g) => ({ ...g, gstin: e.target.value.toUpperCase() }))} />
              <TextField label={t('gst_rate')} type="number" inputMode="decimal" min={0} max={28} value={gst.rate} onChange={(e) => setGst((g) => ({ ...g, rate: Math.min(28, Math.max(0, Number(e.target.value) || 0)) }))} />
            </div>
          )}
          <Button block className="mt-3" disabled={!doc} onClick={() => save({ gst })}>
            {t('save')}
          </Button>
        </ArchCard>
      )}

      {isManager && (
        <ArchCard title={t('photo_title')} icon={<Camera />}>
          <p className="mb-2 text-ink-muted">{t('photo_help')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label={t('photo_cloud')} value={cloud.cloudName} autoCapitalize="none" onChange={(e) => setCloud((c) => ({ ...c, cloudName: e.target.value.trim() }))} />
            <TextField label={t('photo_preset')} value={cloud.uploadPreset} autoCapitalize="none" onChange={(e) => setCloud((c) => ({ ...c, uploadPreset: e.target.value.trim() }))} />
          </div>
          <Button block className="mt-3" disabled={!doc} onClick={() => save({ cloudinary: cloud })}>
            {t('save')}
          </Button>
        </ArchCard>
      )}
    </>
  )
}
