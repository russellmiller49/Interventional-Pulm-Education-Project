import { AlertTriangle, Info, Lightbulb } from 'lucide-react'

import { cn } from '@/lib/cn'

type CalloutType = 'info' | 'warning' | 'success'

const ICONS: Record<CalloutType, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  info: { icon: Info, label: 'Note' },
  warning: { icon: AlertTriangle, label: 'Caution' },
  success: { icon: Lightbulb, label: 'Pearl' },
}

interface CalloutProps {
  type?: CalloutType
  title?: string
  children: React.ReactNode
}

export function Callout({ type = 'info', title, children }: CalloutProps) {
  const Icon = ICONS[type].icon
  const label = title ?? ICONS[type].label

  return (
    <div
      className={cn(
        'not-prose relative flex gap-3 rounded-2xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground',
        type === 'warning' && 'border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-200',
        type === 'success' && 'border-emerald-500/60 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
      )}
    >
      <Icon className="mt-1 h-5 w-5 flex-shrink-0 text-foreground/80" aria-hidden />
      <div className="space-y-1">
        {label ? <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground/80">{label}</p> : null}
        <div className="space-y-2">{children}</div>
      </div>
    </div>
  )
}
