'use client'

import { useState } from 'react'

const indicationBenefitDomains = [
  {
    id: 'attributable-symptoms',
    label: 'Attributable symptoms and response',
    prompt:
      'Connect the airway finding and its treatment to symptoms or patient-experienced benefit.',
  },
  {
    id: 'morphology-after-treatment',
    label: 'Morphology after treatable obstruction',
    prompt:
      'Distinguish intrinsic, extrinsic, mixed, and dynamic disease after the initial intervention.',
  },
  {
    id: 'distal-airway-patency',
    label: 'Distal-airway patency',
    prompt: 'Identify the distal pathways and important branch orifices that must remain open.',
  },
  {
    id: 'viable-distal-lung',
    label: 'Potentially functional distal lung',
    prompt:
      'Decide whether restoring or preserving the airway can support meaningful downstream function.',
  },
  {
    id: 'treatment-trajectory',
    label: 'Treatment trajectory and time horizon',
    prompt:
      'Anticipate how tumor-directed or definitive therapy may change the airway and device need.',
  },
  {
    id: 'patient-goals',
    label: 'Patient goals and intended benefit',
    prompt:
      'State what the intervention is expected to improve and how that benefit will be reassessed.',
  },
] as const

export function IndicationBenefitChecklist({
  completed = false,
  onComplete,
}: {
  completed?: boolean
  onComplete?: () => void
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [committed, setCommitted] = useState(completed)

  return (
    <section
      className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6"
      aria-labelledby="indication-benefit-title"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
        Downstream benefit check
      </p>
      <h3 id="indication-benefit-title" className="mt-2 text-2xl font-bold tracking-tight">
        Inspect whether a device can deliver a meaningful clinical benefit
      </h3>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
        Confirm every domain before finalizing the indication. Severe narrowing alone does not
        establish that a stent has a useful remaining job.
      </p>
      <fieldset className="mt-5 grid gap-3 md:grid-cols-2">
        <legend className="sr-only">Required indication and benefit domains</legend>
        {indicationBenefitDomains.map((domain) => {
          const selected = selectedIds.includes(domain.id)
          return (
            <label
              key={domain.id}
              className="flex cursor-pointer gap-3 rounded-2xl border bg-background p-4 hover:border-cyan-500/50 focus-within:ring-2 focus-within:ring-cyan-500"
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() =>
                  setSelectedIds((current) =>
                    selected
                      ? current.filter((candidate) => candidate !== domain.id)
                      : [...current, domain.id],
                  )
                }
                className="mt-1 accent-cyan-600"
              />
              <span>
                <span className="block text-sm font-semibold">{domain.label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {domain.prompt}
                </span>
              </span>
            </label>
          )
        })}
      </fieldset>
      <button
        type="button"
        onClick={() => {
          if (completed || committed || selectedIds.length !== indicationBenefitDomains.length)
            return
          setCommitted(true)
          onComplete?.()
        }}
        disabled={completed || committed || selectedIds.length !== indicationBenefitDomains.length}
        className="mt-5 min-h-11 rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {completed || committed ? 'Benefit assessment recorded' : 'Record benefit assessment'}
      </button>
    </section>
  )
}
