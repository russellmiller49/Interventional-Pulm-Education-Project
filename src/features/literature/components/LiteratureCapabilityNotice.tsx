import { AlertTriangle, CheckCircle2, CircleSlash, Info } from 'lucide-react'

import { cn } from '@/lib/cn'
import type {
  LiteratureCapability,
  LiteratureCapabilityState,
} from '@/features/literature/server/runtime-capability'

/**
 * The one place a Literature surface states what it could and could not read.
 *
 * It is deliberately a banner rather than an error toast: during the production bring-up the
 * interesting states are not failures at all. "Foundation ready and empty" is a correct, expected
 * milestone, and an operator who has just applied the migration needs to see it confirmed rather
 * than see nothing.
 */

type Tone = 'ok' | 'info' | 'warn'

const TONE_BY_STATE: Record<LiteratureCapabilityState, Tone> = {
  foundation_ready_populated: 'ok',
  foundation_ready_empty: 'ok',
  gold_workflow_unavailable: 'info',
  write_capability_withheld: 'info',
  not_observed: 'info',
  not_configured: 'warn',
  foundation_missing: 'warn',
  temporarily_unavailable: 'warn',
}

const ICON_BY_TONE = {
  ok: CheckCircle2,
  info: CircleSlash,
  warn: AlertTriangle,
} as const

const CLASS_BY_TONE = {
  ok: 'border-emerald-500/40 bg-emerald-500/10',
  info: 'border-border/70 bg-muted/40',
  warn: 'border-amber-500/40 bg-amber-500/10',
} as const

export interface LiteratureCapabilityNoticeProps {
  capability: LiteratureCapability
  /** Localized heading, e.g. `t('capability.bannerTitle')`. */
  title: string
  /** Localized explanation for `capability.state`. */
  description: string
  /** Localized label for the project line, e.g. `t('capability.projectLabel')`. */
  projectLabel: string
  className?: string
}

export function LiteratureCapabilityNotice({
  capability,
  title,
  description,
  projectLabel,
  className,
}: LiteratureCapabilityNoticeProps) {
  const tone = TONE_BY_STATE[capability.state]
  const Icon = ICON_BY_TONE[tone]

  return (
    <section
      role="status"
      aria-label={title}
      data-capability-state={capability.state}
      className={cn('rounded-2xl border p-4 text-sm', CLASS_BY_TONE[tone], className)}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-semibold">{title}</p>
          <p className="leading-6 text-muted-foreground">{description}</p>
          {capability.projectRef ? (
            <p className="text-xs text-muted-foreground">
              {projectLabel}: <code>{capability.projectRef}</code>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
