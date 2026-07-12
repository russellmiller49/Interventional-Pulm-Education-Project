'use client'

import { useMemo, useState } from 'react'

import { mechanicalJobs, stentPlanModel } from '../../content/clinicalDecisionFramework'

export function MechanicalJobBuilder() {
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])

  const selectedJobs = useMemo(
    () => mechanicalJobs.filter((job) => selectedJobIds.includes(job.id)),
    [selectedJobIds],
  )

  return (
    <section
      className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6"
      aria-labelledby="job-builder-title"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
        Decision framework
      </p>
      <h3 id="job-builder-title" className="mt-2 text-2xl font-bold tracking-tight">
        Define the mechanical job before choosing an architecture
      </h3>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
        Select the jobs the device would need to perform. A device name is not itself a treatment
        goal, and more than one job may be present.
      </p>

      <fieldset className="mt-5 grid gap-3 md:grid-cols-2">
        <legend className="sr-only">Mechanical jobs under consideration</legend>
        {mechanicalJobs.map((job) => {
          const checked = selectedJobIds.includes(job.id)
          return (
            <label
              key={job.id}
              className="flex cursor-pointer gap-3 rounded-2xl border bg-background p-4 hover:border-cyan-500/50 focus-within:ring-2 focus-within:ring-cyan-500"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  setSelectedJobIds((current) =>
                    checked ? current.filter((id) => id !== job.id) : [...current, job.id],
                  )
                }
                className="mt-1 h-4 w-4 accent-cyan-600"
              />
              <span>
                <span className="block text-sm font-semibold text-foreground">{job.label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {job.prompt}
                </span>
              </span>
            </label>
          )
        })}
      </fieldset>

      <div
        className="mt-5 rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4"
        aria-live="polite"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-800 dark:text-cyan-200">
          Structured job statement
        </p>
        {selectedJobs.length > 0 ? (
          <p className="mt-2 text-sm leading-6 text-foreground">
            The proposed device must {selectedJobs.map((job) => job.label.toLowerCase()).join('; ')}
            . The plan still needs a target airway, required distal pathways, landing zones, time
            horizon, and removal strategy.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Select at least one job, then state where it must be accomplished and what must remain
            patent.
          </p>
        )}
      </div>

      <ol
        className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Complete stent plan model"
      >
        {stentPlanModel.map((part, index) => (
          <li key={part} className="rounded-xl border bg-muted/20 p-3 text-sm">
            <span className="mr-2 font-semibold text-cyan-700 dark:text-cyan-200">
              {index + 1}.
            </span>
            {part}
          </li>
        ))}
      </ol>
    </section>
  )
}
