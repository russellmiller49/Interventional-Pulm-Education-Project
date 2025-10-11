import { cva, type VariantProps } from 'class-variance-authority'
import { InfoCircledIcon, ExclamationTriangleIcon, CheckCircledIcon } from '@radix-ui/react-icons'
import * as React from 'react'

import { cn } from '@/lib/cn'

const calloutVariants = cva(
  'relative flex gap-3 rounded-2xl border px-4 py-4 text-sm leading-relaxed shadow-sm',
  {
    variants: {
      variant: {
        info: 'border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-100',
        success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
        warning: 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
)

const icons: Record<NonNullable<VariantProps<typeof calloutVariants>['variant']>, React.ReactNode> = {
  info: <InfoCircledIcon className="h-4 w-4 shrink-0" />,
  success: <CheckCircledIcon className="h-4 w-4 shrink-0" />,
  warning: <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />,
}

export interface CalloutProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof calloutVariants> {
  title?: React.ReactNode
}

export function Callout({ className, variant, title, children, ...props }: CalloutProps) {
  return (
    <div role="status" className={cn(calloutVariants({ variant }), className)} {...props}>
      <div className="mt-1 text-current">{icons[variant ?? 'info']}</div>
      <div className="space-y-1">
        {title ? <p className="text-sm font-semibold">{title}</p> : null}
        <div className="text-sm text-current/90">{children}</div>
      </div>
    </div>
  )
}
