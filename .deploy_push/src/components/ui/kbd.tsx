import * as React from 'react'

import { cn } from '@/lib/cn'

type KbdProps = React.HTMLAttributes<HTMLElement>

export function Kbd({ className, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-border/70 bg-muted px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  )
}
