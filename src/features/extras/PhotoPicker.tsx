import { Camera, Loader2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useFeatures } from '@/app/features'
import { useSettings } from '@/app/useShop'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { useI18n } from '@/i18n'
import { cloudinaryProvider, compressImage, thumb } from './photos'

/**
 * Take or choose a photo, compress it, upload it, and hand back the URL.
 * Shows the current photo with a remove button.
 */
export function PhotoPicker({ url, folder, label, onChange }: { url: string | null; folder: string; label: string; onChange: (url: string | null) => void }) {
  const { t } = useI18n()
  const on = useFeatures()
  const { settings } = useSettings()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  if (!on('photos')) return null

  const cfg = settings.cloudinary
  const pick = async (file: File) => {
    if (!cfg?.cloudName || !cfg.uploadPreset) return toast({ message: `⚠️ ${t('photo_notConfigured')}` })
    if (!navigator.onLine) return toast({ message: `⚠️ ${t('photo_offline')}` })
    setBusy(true)
    try {
      const blob = await compressImage(file)
      onChange(await cloudinaryProvider(cfg.cloudName, cfg.uploadPreset).upload(blob, folder))
    } catch (err) {
      console.error('Photo upload failed', err)
      toast({ message: `⚠️ ${t('photo_failed')}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-lg font-semibold">{label}</span>
      {url && (
        <div className="relative w-fit">
          <a href={url} target="_blank" rel="noreferrer">
            <img src={thumb(url)} alt={label} className="max-h-48 rounded-xl border border-line object-contain" />
          </a>
          <button
            type="button"
            aria-label={t('photo_remove')}
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 grid size-10 place-items-center rounded-full bg-danger text-on-danger shadow"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void pick(f)
          e.target.value = ''
        }}
      />
      <Button variant="secondary" size="md" className="self-start" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="animate-spin" /> : <Camera />} {busy ? t('photo_uploading') : t('photo_add')}
      </Button>
    </div>
  )
}
