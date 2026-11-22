import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { haptic } from '@/lib/haptics'

const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-6 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-rani text-on-rani shadow-md shadow-rani/25 hover:bg-rani-deep',
        secondary: 'border-2 border-indigo-royal bg-surface text-indigo-royal hover:bg-surface-2',
        success: 'bg-emerald-deep text-on-emerald shadow-md',
        danger: 'border-2 border-danger bg-surface text-danger hover:bg-surface-2',
        ghost: 'text-indigo-royal hover:bg-surface-2',
      },
      size: {
        md: 'min-h-12 px-4 text-lg',
        lg: 'min-h-14 px-5 text-xl',
        icon: 'size-12',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'lg' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ className, variant, size, block, asChild, onClick, type = 'button', ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      onClick={(e) => {
        haptic('tap')
        onClick?.(e as never)
      }}
      {...props}
    />
  )
}
