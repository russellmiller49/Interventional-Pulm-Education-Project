import * as React from 'react'

import { cn } from '@/lib/cn'

interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  align?: 'left' | 'center'
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  align = 'left',
  className,
  ...props
}: SectionHeaderProps) {
  const alignment = align === 'center' ? 'items-center text-center' : 'items-start text-left'

  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
      {...props}
    >
      <div className={cn('flex flex-col gap-2', alignment)}>
        {eyebrow ? (
          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            {eyebrow}
          </span>
        ) : null}
        <div className="space-y-2">
          <h2 className={cn('text-3xl font-semibold tracking-tight text-foreground', alignment)}>
            {title}
          </h2>
          {description ? (
            <p className={cn('max-w-2xl text-sm text-muted-foreground', align === 'center' ? 'mx-auto' : '')}>
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </div>
  )
}
