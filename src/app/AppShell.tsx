import { AnimatePresence, motion } from 'motion/react'
import { BarChart3, Home, Palette, Scissors, Settings as SettingsIcon, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, useLocation, useOutlet } from 'react-router'
import logoUrl from '@/assets/logo.svg'
import { Toaster } from '@/components/ui/toast'
import { LeheriyaDivider } from '@/design/motifs'
import { useI18n } from '@/i18n'
import type { StringKey } from '@/i18n/strings'
import { cn } from '@/lib/cn'
import { SyncIndicator } from './SyncIndicator'
import { useIsManager, useSettings } from './useShop'

interface NavItem {
  to: string
  label: StringKey
  icon: ReactNode
  mobile?: boolean
  managerOnly?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'nav_home', icon: <Home />, mobile: true },
  { to: '/customers', label: 'nav_customers', icon: <Users />, mobile: true },
  { to: '/orders', label: 'nav_orders', icon: <Scissors />, mobile: true },
  { to: '/summary', label: 'nav_summary', icon: <BarChart3 /> },
  { to: '/settings', label: 'nav_settings', icon: <SettingsIcon />, mobile: true },
  { to: '/design', label: 'nav_design', icon: <Palette />, managerOnly: true },
]

function Brand({ compact }: { compact?: boolean }) {
  const { settings } = useSettings()
  return (
    <div className="flex min-w-0 items-center gap-2">
      <img src={settings.logoUrl ?? logoUrl} alt="" className={compact ? 'size-10' : 'size-14'} />
      <div className="min-w-0">
        <div className={cn('truncate font-display leading-tight text-rani', compact ? 'text-xl' : 'text-2xl')}>{settings.shopName}</div>
        {!compact && <div className="truncate text-sm text-ink-muted">{settings.subLine}</div>}
      </div>
    </div>
  )
}

/** Page transition wrapper: keeps the outgoing page mounted while it fades. */
function AnimatedOutlet() {
  const location = useLocation()
  const outlet = useOutlet()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  )
}

export function AppShell() {
  const { t, lang, setLang } = useI18n()
  const isManager = useIsManager()
  const items = NAV.filter((n) => !n.managerOnly || isManager)

  return (
    <div className="min-h-svh md:grid md:grid-cols-[17rem_1fr]">
      {/* Sidebar: tablet & desktop */}
      <aside className="sticky top-0 hidden h-svh flex-col gap-4 border-r border-line bg-surface p-4 md:flex">
        <Brand />
        <LeheriyaDivider />
        <nav className="flex flex-col gap-1">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-h-12 items-center gap-3 rounded-xl px-3 text-lg font-semibold [&_svg]:size-6',
                  isActive ? 'bg-rani text-on-rani' : 'text-indigo-royal hover:bg-surface-2',
                )
              }
            >
              {n.icon}
              {t(n.label)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <SyncIndicator />
          <button
            type="button"
            onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}
            className="min-h-12 rounded-xl border-2 border-gold font-semibold text-indigo-royal"
          >
            {lang === 'hi' ? 'English' : 'हिंदी'}
          </button>
        </div>
      </aside>

      <div className="flex min-h-svh flex-col">
        {/* Top bar: phone */}
        <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur md:hidden">
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="min-w-0 flex-1">
              <Brand compact />
            </div>
            <SyncIndicator compact />
          </div>
          <LeheriyaDivider className="h-1 rounded-none" />
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-10">
          <AnimatedOutlet />
        </main>

        {/* Bottom nav: phone. Always visible, icons always labelled. */}
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface/95 backdrop-blur md:hidden">
          {items
            .filter((n) => n.mobile)
            .map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-16 flex-col items-center justify-center gap-0.5 text-[15px] font-semibold [&_svg]:size-7',
                    isActive ? 'text-rani' : 'text-ink-muted',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cn('rounded-full px-4 py-0.5 transition', isActive && 'bg-rani/10')}>{n.icon}</span>
                    {t(n.label)}
                  </>
                )}
              </NavLink>
            ))}
        </nav>
      </div>
      <Toaster />
    </div>
  )
}
