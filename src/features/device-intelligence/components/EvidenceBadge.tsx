import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Evidence-state badges for the D1 surfaces (vertical-slice-spec §6.3, relationship-taxonomy
 * evidence display model). Each badge names ONE axis and carries its meaning as text — the
 * axes are deliberately not collapsed into a single "verified" mark, and color is never the
 * only signal.
 */

export type EvidenceState =
  | 'verified_source_fact'
  | 'candidate_fact'
  | 'unknown'
  | 'authored_selectable'
  | 'authored_non_selectable'
  | 'unreviewed_proposal'
  | 'demo_stand_in'
  | 'draft_procedure'
  | 'unresolved_statement'
  | 'historical_context'

const STATE_STYLES: Record<EvidenceState, string> = {
  verified_source_fact:
    'border-emerald-600/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  candidate_fact: 'border-amber-600/50 bg-amber-500/10 text-amber-900 dark:text-amber-200',
  unknown: 'border-border bg-muted text-muted-foreground',
  authored_selectable: 'border-sky-600/50 bg-sky-500/10 text-sky-900 dark:text-sky-200',
  authored_non_selectable: 'border-border bg-muted/60 text-foreground/80',
  unreviewed_proposal:
    'border-fuchsia-600/50 bg-fuchsia-500/10 text-fuchsia-900 dark:text-fuchsia-200',
  demo_stand_in: 'border-violet-600/50 bg-violet-500/10 text-violet-900 dark:text-violet-200',
  draft_procedure: 'border-amber-600/60 bg-amber-500/10 text-amber-900 dark:text-amber-200',
  unresolved_statement: 'border-rose-600/50 bg-rose-500/10 text-rose-900 dark:text-rose-200',
  historical_context: 'border-border bg-muted/60 text-muted-foreground',
}

export function EvidenceBadge({
  state,
  children,
  title,
}: {
  state: EvidenceState
  children: ReactNode
  title?: string
}) {
  return (
    <span
      title={title}
      data-evidence-state={state}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4',
        STATE_STYLES[state],
      )}
    >
      {children}
    </span>
  )
}

/** A term/value row that renders an honest placeholder instead of dropping missing data. */
export function FactRow({
  term,
  value,
  missingLabel,
  mono = false,
}: {
  term: string
  value: string | number | null | undefined
  missingLabel: string
  mono?: boolean
}) {
  const present = value !== null && value !== undefined && value !== ''
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/50 py-2 last:border-0 sm:flex-row sm:gap-4">
      <dt className="text-sm text-muted-foreground sm:w-56 sm:shrink-0">{term}</dt>
      <dd
        className={cn(
          'text-sm',
          present ? 'text-foreground' : 'italic text-muted-foreground',
          mono && present ? 'font-mono text-xs' : undefined,
        )}
      >
        {present ? String(value) : missingLabel}
      </dd>
    </div>
  )
}
