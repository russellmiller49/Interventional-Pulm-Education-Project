import { cn } from '@/lib/cn'

import { STATUS_LABELS, type ObjectiveStatus } from '../engine/status'

/**
 * One colour per status, and a dashed outline for "not yet assessed" so an empty tile never reads
 * as a weak one. The classes are repeated on the map tiles through `statusTone`.
 */
export const statusTone: Readonly<Record<ObjectiveStatus, string>> = {
  'not-assessed': 'border-dashed border-border/80 bg-muted/40 text-muted-foreground',
  exploring: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  'needs-focus': 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300',
  demonstrated: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  'review-due': 'border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-300',
}

export function StatusBadge({
  status,
  className,
}: {
  readonly status: ObjectiveStatus
  readonly className?: string
}) {
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        statusTone[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
