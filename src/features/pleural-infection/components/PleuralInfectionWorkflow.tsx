'use client'

import { useMemo, useState } from 'react'

import { infectionCases } from '../scenarios/infectionCases'
import { antibioticDuration, classifyParapneumonic } from '../engine/staging'
import { bleedingRisk, evaluateLyticChoice, type LyticChoice } from '../engine/lytics'

export function PleuralInfectionWorkflow() {
  const [caseId, setCaseId] = useState(infectionCases[0]?.id ?? '')
  const [choice, setChoice] = useState<LyticChoice>('alteplase10Dnase5')
  const clinicalCase = useMemo(
    () => infectionCases.find((item) => item.id === caseId) ?? infectionCases[0],
    [caseId],
  )

  if (!clinicalCase) {
    return null
  }

  const classification = classifyParapneumonic(clinicalCase.input)
  const lytic = evaluateLyticChoice(choice)
  const bleed = bleedingRisk(clinicalCase.anticoagulated)

  return (
    <section className="container grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <aside className="h-fit space-y-4 rounded-lg border border-border/80 bg-card p-5 shadow-sm lg:sticky lg:top-20">
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Infection case
          <select
            value={caseId}
            onChange={(event) => setCaseId(event.target.value)}
            className="min-h-11 rounded-lg border border-input bg-background px-3"
          >
            {infectionCases.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Adjunct choice
          <select
            value={choice}
            onChange={(event) => setChoice(event.target.value as LyticChoice)}
            className="min-h-11 rounded-lg border border-input bg-background px-3"
          >
            <option value="alteplase10Dnase5">tPA + DNase</option>
            <option value="alteplaseOnly">tPA only</option>
            <option value="dnaseOnly">DNase only</option>
            <option value="salineIrrigation">Saline irrigation</option>
            <option value="placebo">Drainage alone</option>
          </select>
        </label>
      </aside>

      <div className="space-y-6">
        <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
              {classification.stage}
            </span>
            <h2 className="text-xl font-semibold text-foreground">Stage classifier</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{classification.action}</p>
          <ul className="mt-4 grid gap-2">
            {classification.reasons.map((reason) => (
              <li
                key={reason}
                className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground"
              >
                {reason}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm font-medium text-foreground">
            Antibiotic duration frame: {antibioticDuration(classification.stage)}
          </p>
        </article>

        <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">Lytics and irrigation trainer</h2>
          <div className="mt-4 rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-semibold text-foreground">{lytic.label}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{lytic.effect}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{lytic.caution}</p>
          </div>
          <div className="mt-4 rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-semibold text-foreground">
              Bleeding overlay: {bleed.percent.toFixed(1)}%
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{bleed.note}</p>
          </div>
        </article>

        <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">Escalation chain</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {['Tube', 'Flush/reimage', 'tPA + DNase', 'Irrigation option', 'VATS/surgery'].map(
              (step) => (
                <div key={step} className="rounded-lg border border-border bg-background p-3">
                  <p className="text-sm font-semibold text-foreground">{step}</p>
                </div>
              ),
            )}
          </div>
        </article>
      </div>
    </section>
  )
}
