import { Settings, BellRing, BookOpenCheck, CalendarDays, HardHat, HelpCircle, History, Package, PartyPopper, Receipt, ShieldCheck, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useFeatures, type Feature } from '@/app/features'
import { useIsManager } from '@/app/useShop'
import { PageHeader } from '@/components/ui/page'
import { useI18n } from '@/i18n'
import type { StringKey } from '@/i18n/strings'
import { startTour } from './Tour'
import { TOURS } from './tours'

interface Tile {
  to: string
  label: StringKey
  icon: ReactNode
  feature?: Feature
  managerOnly?: boolean
}

const TILES: Tile[] = [
  { to: '/settings', label: 'nav_settings', icon: <Settings /> },
  { to: '/calendar', label: 'cal_title', icon: <CalendarDays />, feature: 'calendar' },
  { to: '/reminders', label: 'rem_title', icon: <BellRing /> },
  { to: '/reminders?tab=greeting', label: 'gr_title', icon: <PartyPopper />, feature: 'greetings' },
  { to: '/expenses', label: 'exp_title', icon: <Receipt />, feature: 'expenses' },
  { to: '/karigars', label: 'kar_title', icon: <HardHat />, feature: 'karigars' },
  { to: '/materials', label: 'mat_title', icon: <Package />, feature: 'materials' },
  { to: '/migration', label: 'mig_title', icon: <BookOpenCheck />, feature: 'migration', managerOnly: true },
  { to: '/backup', label: 'bk_title', icon: <ShieldCheck /> },
  { to: '/recycle', label: 'rb_title', icon: <Trash2 /> },
  { to: '/audit', label: 'au_title', icon: <History /> },
]

/** One place for everything beyond the four big home buttons. */
export function MorePage() {
  const { t } = useI18n()
  const on = useFeatures()
  const navigate = useNavigate()
  const isManager = useIsManager()
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('nav_more')} subtitle={t('more_help')} back="/" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TILES.filter((x) => (!x.feature || on(x.feature)) && (!x.managerOnly || isManager)).map((x) => (
          <Link
            key={x.to}
            to={x.to}
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-line bg-surface p-3 text-center text-lg font-semibold text-indigo-royal shadow-sm active:border-rani [&_svg]:size-8 [&_svg]:text-rani"
          >
            {x.icon}
            {t(x.label)}
          </Link>
        ))}
        {on('help') && (
          <button
            type="button"
            onClick={() => {
              navigate('/')
              setTimeout(() => startTour(TOURS[0].steps), 400)
            }}
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-marigold bg-marigold/10 p-3 text-center text-lg font-semibold text-indigo-royal [&_svg]:size-8 [&_svg]:text-gold-deep"
          >
            <HelpCircle />
            {t('help_tour')}
          </button>
        )}
      </div>
      {on('help') && <p className="text-center text-ink-muted">{t('help_intro')}</p>}
    </div>
  )
}
