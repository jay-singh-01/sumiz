import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { GotaBorder, JharokhaArch } from '@/design/motifs'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-sm', className)} {...props} />
}

/** Section card with a jharokha-arch crest and gota-patti edge. */
export function ArchCard({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-sm', className)}>
      <JharokhaArch className="pointer-events-none absolute -top-3 left-1/2 h-10 w-24 -translate-x-1/2 text-gold opacity-60" />
      <header className="flex items-center gap-2 px-4 pt-5 pb-2">
        {icon && <span className="text-rani [&_svg]:size-6">{icon}</span>}
        <h2 className="flex-1 text-xl">{title}</h2>
        {action}
      </header>
      <GotaBorder className="mx-4 h-3 text-gold" />
      <div className="p-4 pt-3">{children}</div>
    </section>
  )
}
