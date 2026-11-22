import { AnimatePresence, motion } from 'motion/react'
import { useId } from 'react'
import { cn } from '@/lib/cn'

// Original Rajasthani motifs, hand-drawn as SVG. Colour comes from
// `currentColor` (set with text-*), so they follow the theme.

type P = { className?: string }

export const ARCH_PATH =
  'M136 448V240c0-36 14-52 32-62 2-28 24-46 48-48 8-22 24-32 40-50 16 18 32 28 40 50 24 2 46 20 48 48 18 10 32 26 32 62v208z'

/** Jharokha (palace window) arch crest, used atop cards and headers. */
export function JharokhaArch({ className }: P) {
  return (
    <svg viewBox="120 64 272 200" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="10" strokeLinejoin="round">
      <path d={ARCH_PATH} />
      <path d={ARCH_PATH} strokeWidth="4" transform="translate(256 300) scale(.82) translate(-256 -300)" />
    </svg>
  )
}

/** A row of gota-patti leaves, repeated as a border. */
export function GotaBorder({ className }: P) {
  const id = useId()
  return (
    <svg className={cn('block w-full', className)} aria-hidden preserveAspectRatio="none">
      <defs>
        <pattern id={id} width="24" height="12" patternUnits="userSpaceOnUse">
          <path d="M2 6C6 1 12 1 12 6C12 11 6 11 2 6Z" fill="currentColor" />
          <path d="M22 6C18 1 12 1 12 6C12 11 18 11 22 6Z" fill="currentColor" opacity=".55" />
          <circle cx="12" cy="6" r="1.4" fill="var(--rani)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/** Leheriya wave strip divider. */
export function LeheriyaDivider({ className }: P) {
  return <div aria-hidden className={cn('leheriya h-2 w-full rounded-full opacity-80', className)} />
}

export function Paisley({ className }: P) {
  return (
    <svg viewBox="0 0 120 160" className={className} aria-hidden>
      <path
        d="M70 152C30 150 8 118 14 84 20 50 52 30 78 40 100 48 106 76 90 90 78 100 60 94 62 80 64 70 76 70 78 78"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M70 152C100 150 116 126 112 96" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <g fill="var(--rani)">
        <circle cx="38" cy="96" r="5" />
        <circle cx="46" cy="120" r="4" />
        <circle cx="66" cy="132" r="4" />
        <circle cx="86" cy="124" r="3.5" />
      </g>
      <path d="M40 70c6-10 18-16 28-14" fill="none" stroke="var(--marigold)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function PeacockFeather({ className }: P) {
  return (
    <svg viewBox="0 0 100 200" className={className} aria-hidden>
      <path d="M50 196C50 150 52 110 50 60" stroke="var(--gold-deep)" strokeWidth="3" fill="none" strokeLinecap="round" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i} stroke="var(--emerald)" strokeWidth="2" opacity={0.7}>
          <path d={`M50 ${180 - i * 18}L${22 + i * 2} ${160 - i * 20}`} />
          <path d={`M50 ${180 - i * 18}L${78 - i * 2} ${160 - i * 20}`} />
        </g>
      ))}
      <ellipse cx="50" cy="48" rx="34" ry="44" fill="var(--emerald)" />
      <ellipse cx="50" cy="52" rx="22" ry="30" fill="var(--marigold)" />
      <ellipse cx="50" cy="56" rx="14" ry="19" fill="var(--indigo)" />
      <ellipse cx="50" cy="60" rx="7" ry="9" fill="#0b1240" />
    </svg>
  )
}

/** Decorated Rajasthani elephant, for empty states. */
export function Elephant({ className }: P) {
  return (
    <svg viewBox="0 0 220 160" className={className} aria-hidden>
      <g fill="currentColor">
        <path d="M40 120C30 120 26 100 34 84 44 60 74 46 110 46c40 0 66 16 72 44 4 18 0 30-6 34H40Z" />
        <rect x="54" y="112" width="20" height="40" rx="6" />
        <rect x="84" y="112" width="20" height="40" rx="6" />
        <rect x="128" y="112" width="20" height="40" rx="6" />
        <rect x="156" y="112" width="20" height="40" rx="6" />
        <path d="M170 70c18 0 30 12 30 30 0 16-4 30-12 40-4 5-12 2-10-4 4-12 6-22 4-32-2-10-10-14-16-14Z" />
        <path d="M26 92c-10 4-16 14-14 24" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </g>
      {/* jhool (ceremonial cloth) */}
      <path d="M70 52h80c6 0 10 6 8 12l-10 46H74L62 64c-2-6 2-12 8-12Z" fill="var(--rani)" />
      <path d="M74 110h74l-6 12H80Z" fill="var(--gold)" />
      <g fill="var(--marigold)">
        {[84, 100, 116, 132].map((x) => (
          <circle key={x} cx={x} cy="80" r="5" />
        ))}
      </g>
      <circle cx="176" cy="84" r="4" fill="var(--ivory)" />
      <path d="M150 60c10-4 22-2 28 8" fill="none" stroke="var(--gold)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

/** Confetti of marigold petals, e.g. when a bill is marked paid. */
export function MarigoldBurst({ show, onDone }: { show: boolean; onDone?: () => void }) {
  const petals = Array.from({ length: 28 }, (_, i) => {
    const angle = (i / 28) * Math.PI * 2
    const dist = 120 + ((i * 37) % 90)
    return { i, x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 60, rot: (i * 53) % 360, gold: i % 3 === 0 }
  })
  return (
    <AnimatePresence onExitComplete={onDone}>
      {show && (
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center" aria-hidden>
          {petals.map((p) => (
            <motion.svg
              key={p.i}
              viewBox="0 0 20 28"
              className="absolute size-5"
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
              animate={{ x: p.x, y: p.y + 220, opacity: 0, rotate: p.rot + 360, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6, ease: [0.2, 0.7, 0.4, 1] }}
            >
              <path d="M10 1C17 8 17 20 10 27 3 20 3 8 10 1Z" fill={p.gold ? 'var(--gold)' : 'var(--marigold)'} />
            </motion.svg>
          ))}
        </div>
      )}
    </AnimatePresence>
  )
}
