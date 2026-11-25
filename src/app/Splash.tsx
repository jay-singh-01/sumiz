import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS } from '@/data/schemas'

/*
 * Opening splash (≈4.5 s): the logo draws itself — the jharokha arch is traced
 * in gold and fills with rani pink, the needle slides in, the thread stitches
 * through it and the gota-patti leaf pops — then the shop name, sub-line and
 * tagline rise in while a leheriya strip fills like a progress bar.
 *
 * The app loads underneath, so the wait costs nothing. Shown once per app
 * launch (not on every PIN unlock). A tap skips it.
 */

export const SPLASH_MS = 4500
const SHOWN_KEY = 'gd.splashShown'
const BRAND_KEY = 'gd.brand'
const ARCH =
  'M136 448V240c0-36 14-52 32-62 2-28 24-46 48-48 8-22 24-32 40-50 16 18 32 28 40 50 24 2 46 20 48 48 18 10 32 26 32 62v208z'

function brand() {
  try {
    const b = JSON.parse(localStorage.getItem(BRAND_KEY) || '{}')
    return {
      shopName: b.shopName || DEFAULT_SETTINGS.shopName,
      subLine: b.subLine ?? DEFAULT_SETTINGS.subLine,
      tagline: b.tagline ?? DEFAULT_SETTINGS.tagline,
    }
  } catch {
    return { shopName: DEFAULT_SETTINGS.shopName, subLine: DEFAULT_SETTINGS.subLine, tagline: DEFAULT_SETTINGS.tagline }
  }
}

function alreadyShown(): boolean {
  try {
    return sessionStorage.getItem(SHOWN_KEY) === '1'
  } catch {
    return false
  }
}

export function Splash() {
  const [visible, setVisible] = useState(() => !alreadyShown())
  const [b] = useState(brand)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!visible) return
    try {
      sessionStorage.setItem(SHOWN_KEY, '1')
    } catch {
      // Shown again next time; harmless.
    }
    const timer = setTimeout(() => setVisible(false), SPLASH_MS)
    return () => clearTimeout(timer)
  }, [visible])

  // With reduced motion: no movement, just a calm fade.
  const draw = (delay: number, duration: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 0.2, duration: 0.6 } }
      : { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { delay, duration, ease: 'easeInOut' as const } }
  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 0.4, duration: 0.6 } }
      : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay, type: 'spring' as const, stiffness: 120, damping: 16 } }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          role="img"
          aria-label={`${b.shopName} — ${b.tagline}`}
          onClick={() => setVisible(false)}
          className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center overflow-hidden px-6 text-center"
          style={{ background: 'radial-gradient(120% 90% at 50% 35%, #fffaf0 0%, #fff1d6 55%, #fde2b8 100%)' }}
          exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.5, ease: 'easeIn' } }}
        >
          {/* bandhani dots, slowly drifting */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 12px 12px, #d6125b 2px, transparent 2.5px), radial-gradient(circle at 6px 12px, #d6125b 1.4px, transparent 1.9px), radial-gradient(circle at 18px 12px, #d6125b 1.4px, transparent 1.9px), radial-gradient(circle at 12px 6px, #d6125b 1.4px, transparent 1.9px), radial-gradient(circle at 12px 18px, #d6125b 1.4px, transparent 1.9px), radial-gradient(circle at 36px 36px, #f59e0b 2px, transparent 2.5px)',
              backgroundSize: '48px 48px',
            }}
            animate={reduce ? undefined : { backgroundPosition: ['0px 0px', '48px 24px'] }}
            transition={{ duration: 6, ease: 'linear', repeat: Infinity }}
          />
          {/* soft golden glow behind the logo */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute size-[28rem] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(243,210,122,0.55) 0%, rgba(243,210,122,0) 65%)' }}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.6, ease: 'easeOut' }}
          />

          <svg viewBox="110 60 292 400" className="relative h-56 w-auto sm:h-64" aria-hidden>
            <defs>
              <linearGradient id="sp-rani" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#E0115F" />
                <stop offset="1" stopColor="#9E0D44" />
              </linearGradient>
              <linearGradient id="sp-gold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#F3D27A" />
                <stop offset=".5" stopColor="#C9971C" />
                <stop offset="1" stopColor="#8A6408" />
              </linearGradient>
            </defs>
            {/* arch fill fades in after the outline is drawn */}
            <motion.path d={ARCH} fill="url(#sp-rani)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0.2 : 1.0, duration: 0.6 }} />
            <motion.path d={ARCH} fill="none" stroke="url(#sp-gold)" strokeWidth={14} strokeLinejoin="round" {...draw(0.15, 1.1)} />
            <motion.path
              d={ARCH}
              fill="none"
              stroke="#FFF4DE"
              strokeWidth={3}
              transform="translate(256 300) scale(.86) translate(-256 -300)"
              {...draw(0.9, 0.8)}
              style={{ opacity: 0.8 }}
            />
            {/* bandhani dots inside the arch */}
            {[
              [184, 400, 1.5],
              [330, 250, 1.6],
              [196, 220, 1.7],
            ].map(([x, y, delay]) => (
              <motion.g
                key={`${x}`}
                fill="#FFF4DE"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 0.6, scale: 1 }}
                transition={{ delay: reduce ? 0.3 : delay, type: 'spring', stiffness: 260, damping: 14 }}
                style={{ transformOrigin: `${x}px ${y}px` }}
              >
                <circle cx={x} cy={y} r="5" />
                <circle cx={x - 11} cy={y} r="3" />
                <circle cx={x + 11} cy={y} r="3" />
                <circle cx={x} cy={y - 11} r="3" />
                <circle cx={x} cy={y + 11} r="3" />
              </motion.g>
            ))}
            <g transform="rotate(32 256 300)">
              {/* needle slides down into place */}
              <motion.g
                initial={reduce ? { opacity: 0 } : { y: -140, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={reduce ? { delay: 0.3, duration: 0.6 } : { delay: 1.2, type: 'spring', stiffness: 90, damping: 14 }}
              >
                <path d="M256 180C246 180 246 200 248 214L253 418L256 446L259 418L264 214C266 200 266 180 256 180Z" fill="#FFF4DE" stroke="url(#sp-gold)" strokeWidth={3} />
                <ellipse cx="256" cy="204" rx="3.5" ry="13" fill="#9E0D44" />
              </motion.g>
              {/* thread stitches through the eye */}
              <motion.path
                d="M256 196C312 196 334 252 306 292C286 322 236 316 222 352"
                fill="none"
                stroke="#F59E0B"
                strokeWidth={9}
                strokeLinecap="round"
                {...draw(1.75, 0.8)}
              />
              {/* gota-patti leaf pops */}
              <motion.g
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: reduce ? 0.4 : 2.45, type: 'spring', stiffness: 300, damping: 12 }}
                style={{ transformOrigin: '222px 352px' }}
              >
                <path d="M222 352C246 378 226 418 186 430C174 398 190 360 222 352Z" fill="url(#sp-gold)" stroke="#FFF4DE" strokeWidth={2} />
                <path d="M220 358C210 382 200 404 188 424" fill="none" stroke="#FFF4DE" strokeWidth={2.5} strokeLinecap="round" />
              </motion.g>
            </g>
          </svg>

          <motion.h1 className="relative mt-4 font-display text-5xl text-rani sm:text-6xl" {...rise(2.2)}>
            {b.shopName}
          </motion.h1>
          {b.subLine && (
            <motion.p className="relative mt-1 text-xl font-semibold text-indigo-royal" {...rise(2.55)}>
              {b.subLine}
            </motion.p>
          )}
          {b.tagline && (
            <motion.p className="relative mt-2 text-lg text-gold-deep italic" {...rise(2.9)}>
              “{b.tagline}”
            </motion.p>
          )}

          {/* leheriya progress strip */}
          <div className="relative mt-10 h-2 w-48 overflow-hidden rounded-full bg-white/60" aria-hidden>
            <motion.div
              className="leheriya h-full rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: SPLASH_MS / 1000 - 0.3, ease: 'easeInOut' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
