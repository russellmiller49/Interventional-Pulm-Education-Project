import { AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

import type { ReadinessState } from '../domain/types'

interface ReadinessBadgeProps {
  state: ReadinessState
  label: string
  className?: string
}
export function ReadinessBadge({ state, label, className }: ReadinessBadgeProps) {
  const Icon =
    state === 'blocked'
      ? AlertOctagon
      : state === 'complete_with_warnings'
        ? AlertTriangle
        : CheckCircle2
  return (
    <Badge
      variant={state === 'blocked' ? 'destructive' : state === 'complete' ? 'success' : 'info'}
      size="lg"
      className={cn('gap-1.5 normal-case tracking-normal', className)}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      {label}
    </Badge>
  )
}
