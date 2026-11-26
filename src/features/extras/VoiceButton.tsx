import { Mic, MicOff } from 'lucide-react'
import { useRef, useState } from 'react'
import { useFeatures } from '@/app/features'
import { toast } from '@/components/ui/toast'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'
import { haptic } from '@/lib/haptics'

/* Voice typing via the browser's Web Speech API (Chrome on Android supports hi-IN). */

interface Recognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

const Ctor = (): (new () => Recognition) | undefined =>
  (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition

export function VoiceButton({ onText, className }: { onText: (text: string) => void; className?: string }) {
  const { t, lang } = useI18n()
  const on = useFeatures()
  const [listening, setListening] = useState(false)
  const rec = useRef<Recognition | null>(null)
  if (!on('voice')) return null

  const toggle = () => {
    const R = Ctor()
    if (!R) return toast({ message: `⚠️ ${t('voice_unsupported')}` })
    if (listening) return rec.current?.stop()
    const r = new R()
    r.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
    r.interimResults = false
    r.maxAlternatives = 1
    r.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript?.trim()
      if (text) onText(text)
    }
    r.onerror = (e) => {
      if (e.error !== 'aborted' && e.error !== 'no-speech') toast({ message: `⚠️ ${t('voice_unsupported')}` })
    }
    r.onend = () => setListening(false)
    rec.current = r
    haptic('tap')
    setListening(true)
    r.start()
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? t('voice_listening') : t('voice_start')}
      aria-pressed={listening}
      className={cn(
        'flex min-h-12 shrink-0 items-center gap-1 rounded-xl border-2 px-3 font-semibold',
        listening ? 'animate-pulse border-rani bg-rani text-on-rani' : 'border-line bg-surface text-indigo-royal',
        className,
      )}
    >
      {listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
      <span className="text-sm">{listening ? t('voice_listening') : t('voice_start')}</span>
    </button>
  )
}
