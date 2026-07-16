'use client'

import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'

import { fitPlanningItems } from '../../content/clinicalDecisionFramework'

export function FitPlanningChecklist({
  completed = false,
  onComplete,
}: {
  completed?: boolean
  onComplete?: () => void
}) {
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  const [committed, setCommitted] = useState(completed)

  return (
    <section
      className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6"
      aria-labelledby="fit-plan-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
            Fit planning
          </p>
          <h3 id="fit-plan-title" className="mt-2 text-2xl font-bold tracking-tight">
            Inspect the whole airway–device relationship
          </h3>
        </div>
        <span
          className="rounded-full border bg-muted px-3 py-2 text-xs font-semibold"
          role="status"
        >
          {checkedIds.length} of {fitPlanningItems.length} considered
        </span>
      </div>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
        This checklist organizes questions; it does not calculate a diameter, length, or
        patient-specific fit recommendation.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {fitPlanningItems.map((item) => {
          const checked = checkedIds.includes(item.id)
          return (
            <label
              key={item.id}
              className="flex cursor-pointer gap-3 rounded-2xl border bg-background p-4 hover:border-cyan-500/50 focus-within:ring-2 focus-within:ring-cyan-500"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  setCheckedIds((current) =>
                    checked ? current.filter((id) => id !== item.id) : [...current, item.id],
                  )
                }
                className="sr-only"
              />
              <CheckCircle2
                className={
                  checked
                    ? 'mt-0.5 h-5 w-5 shrink-0 text-emerald-600'
                    : 'mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/35'
                }
                aria-hidden
              />
              <span>
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {item.prompt}
                </span>
              </span>
            </label>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => {
          if (completed || committed || checkedIds.length !== fitPlanningItems.length) return
          setCommitted(true)
          onComplete?.()
        }}
        disabled={completed || committed || checkedIds.length !== fitPlanningItems.length}
        className="mt-5 min-h-11 rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {completed || committed ? 'Whole-airway fit inspection recorded' : 'Record fit inspection'}
      </button>
    </section>
  )
}
