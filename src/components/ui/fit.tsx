import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Shrinks a fixed-width document (the bill) to fit the screen width, without
 * changing the document itself, so exports stay full resolution.
 */
export function FitToWidth({ children, className }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState<number>()

  useLayoutEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const update = () => {
      const s = Math.min(1, o.clientWidth / i.offsetWidth)
      setScale(s)
      setHeight(i.offsetHeight * s)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(o)
    ro.observe(i)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={outer} className={className} style={{ height }}>
      <div ref={inner} className="fit-scale w-fit origin-top-left" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}
