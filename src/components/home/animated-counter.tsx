'use client'

import { useMemo } from 'react'

import { cn } from '@/lib/cn'

interface AnimatedCounterProps {
  value: number | null
  label: string
  description?: string
  prefix?: string
  suffix?: string
  className?: string
  fallbackLabel?: string
}

export function AnimatedCounter({
  value,
  label,
  description,
  prefix,
  suffix,
  className,
  fallbackLabel = '--',
}: AnimatedCounterProps) {
  const showFallback = value === null || value === undefined

  const formattedValue = useMemo(() => {
    if (value === null || value === undefined) {
      return fallbackLabel
    }

    return Intl.NumberFormat('en', {
      maximumFractionDigits: 0,
    }).format(value)
  }, [fallbackLabel, value])

  return (
    <div className={cn('space-y-2 rounded-xl border border-border/60 bg-card/70 p-6 shadow-sm', className)}>
      <div className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-4xl font-semibold tracking-tight">
        {showFallback ? (
          <span className="text-muted-foreground">{formattedValue}</span>
        ) : (
          <>
            {prefix}
            <span aria-live="polite">{formattedValue}</span>
            {suffix}
          </>
        )}
      </div>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  )
}
