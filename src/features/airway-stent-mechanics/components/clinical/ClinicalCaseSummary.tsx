import { CheckCircle2, ScanSearch } from 'lucide-react'

import type { StentClinicalCase } from '../../engine/learningLabTypes'

export function ClinicalCaseSummary({
  active,
  caseData,
  completed = false,
  onSelect,
}: {
  active: boolean
  caseData: StentClinicalCase
  completed?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={
        active
          ? 'w-full rounded-2xl border border-cyan-500/60 bg-cyan-500/10 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500'
          : 'w-full rounded-2xl border bg-card p-4 text-left hover:border-cyan-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500'
      }
    >
      <span className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">
        <span>
          {caseData.decisions.length} decision{caseData.decisions.length === 1 ? '' : 's'} ·{' '}
          {caseData.requiredForLesson === false ? 'optional contrast' : 'required'}
        </span>
        {completed ? (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Completed
          </span>
        ) : null}
      </span>
      <span className="mt-2 block text-sm font-semibold leading-5">{caseData.title}</span>
      {caseData.physicsLens ? (
        <span className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ScanSearch className="h-3.5 w-3.5" aria-hidden />
          Optional physics lens available
        </span>
      ) : null}
    </button>
  )
}
