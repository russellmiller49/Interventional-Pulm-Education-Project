import { AlertTriangle, CheckCircle2, CircleSlash } from 'lucide-react'

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
  foundation_ready_filtered: 'ok',
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
  /**
   * Localized label for the specific reason line, e.g. `t('capability.reason')`.
   *
   * When supplied, the capability's own `message` is shown beneath the per-state description. The
   * state sentence is generic by construction — `not_configured` covers unset, partial, wrong
   * project, and wrong credential class alike — so without this an operator is told *that* the
   * database is unconfigured but never *which* of those it is.
   */
  reasonLabel?: string
  className?: string
}

export function LiteratureCapabilityNotice({
  capability,
  title,
  description,
  projectLabel,
  reasonLabel,
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
        <div className="min-w-0 space-y-1">
          <p className="font-semibold">{title}</p>
          <p className="leading-6 text-muted-foreground">{description}</p>
          {reasonLabel && capability.message && capability.message !== description ? (
            <p className="break-words leading-6 text-muted-foreground [overflow-wrap:anywhere]">
              <span className="font-medium">{reasonLabel}:</span> {capability.message}
            </p>
          ) : null}
          {capability.projectRef ? (
            <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {projectLabel}: <code>{capability.projectRef}</code>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
