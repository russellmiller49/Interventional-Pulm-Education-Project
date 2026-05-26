'use client'

import { useMemo, useState } from 'react'

import { pneumothoraxCases } from '../scenarios/pneumothoraxCases'
import { evaluatePneumothoraxPathway } from '../engine/frameworks'

export function PneumothoraxPathway() {
  const [caseId, setCaseId] = useState(pneumothoraxCases[0]?.id ?? '')
  const clinicalCase = useMemo(
    () => pneumothoraxCases.find((item) => item.id === caseId) ?? pneumothoraxCases[0],
    [caseId],
  )

  if (!clinicalCase) {
    return null
  }

  const recommendation = evaluatePneumothoraxPathway(clinicalCase)

  return (
    <section className="container grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <aside className="h-fit rounded-lg border border-border/80 bg-card p-5 shadow-sm lg:sticky lg:top-20">
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Scenario
          <select
            value={caseId}
            onChange={(event) => setCaseId(event.target.value)}
            className="min-h-11 rounded-lg border border-input bg-background px-3"
          >
            {pneumothoraxCases.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-5 rounded-lg border border-border bg-background p-4 text-sm leading-6">
          <p className="font-semibold text-foreground">{clinicalCase.learningCue}</p>
          <dl className="mt-3 grid gap-2 text-muted-foreground">
            <Data label="Type" value={clinicalCase.type.toUpperCase()} />
            <Data label="Symptoms" value={clinicalCase.symptomBurden} />
            <Data label="PAL days" value={String(clinicalCase.persistentAirLeakDays)} />
          </dl>
        </div>
      </aside>

      <div className="space-y-6">
        <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              {recommendation.disposition}
            </span>
            <h2 className="text-xl font-semibold text-foreground">{clinicalCase.title}</h2>
          </div>
          <p className="mt-4 text-base leading-7 text-foreground">
            {recommendation.recommendation}
          </p>
          <ul className="mt-4 grid gap-2 text-sm leading-6 text-muted-foreground">
            {recommendation.rationale.map((item) => (
              <li key={item} className="rounded-lg border border-border bg-background p-3">
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">Escalation timeline</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Step title="Day 0" body="Assess stability, PSP/SSP, symptoms, and local pathway." />
            <Step
              title="Days 1-4"
              body="Reassess imaging, symptoms, tube position, and air leak trend."
            />
            <Step
              title="Day 5+"
              body="Persistent air leak enters specialist escalation territory."
            />
          </div>
        </article>

        <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">Recurrence prevention</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {recommendation.recurrencePrevention}
          </p>
        </article>
      </div>
    </section>
  )
}

function Data({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt>{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}

function Step({ body, title }: { body: string; title: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  )
}
