import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Elephant } from '@/design/motifs'
import { useI18n } from '@/i18n'
import type { StringKey } from '@/i18n/strings'

/** Placeholder for screens built in later phases. */
export function ComingSoon({ title, phase }: { title: StringKey; phase: number }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl">{t(title)}</h1>
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Elephant className="h-28 w-40 text-indigo-royal/80" />
        <p className="text-xl font-semibold">{t('comingSoon')}</p>
        <p className="text-ink-muted">{t('comingSoonPhase', { n: phase })}</p>
        <Button asChild variant="secondary" size="md">
          <Link to="/">
            <ArrowLeft /> {t('back')}
          </Link>
        </Button>
      </Card>
    </div>
  )
}
