'use client'

import type { Route } from 'next'
import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { hemodynamicCases } from '../content'
import { createDefaultIcuHemodynamicsProgress, readIcuHemodynamicsProgress } from '../engine'

export function IcuHemodynamicsPracticeLandingV2() {
  const [progress, setProgress] = useState(createDefaultIcuHemodynamicsProgress)

  useEffect(() => {
    const timer = window.setTimeout(() => setProgress(readIcuHemodynamicsProgress()), 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Practice</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Eight preserved management cases</h1>
      <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
        Each case opens one focused simulation workspace. Watch the modeled consequence of each
        action, read mechanism-level feedback, then compare your reasoning with an authored expert
        trace.
      </p>
      <ol className="mt-8 grid gap-4 md:grid-cols-2">
        {hemodynamicCases.map((definition, index) => {
          const workedThrough =
            progress.completedCaseIds.includes(definition.id) ||
            progress.masteredCaseIds.includes(definition.id)
          return (
            <li key={definition.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-primary">
                    {String(index + 1).padStart(2, '0')} · {definition.id}
                  </span>
                  <h2 className="mt-2 text-lg font-bold">{definition.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {definition.presentation}
                  </p>
                </div>
                {workedThrough ? (
                  <CheckCircle2
                    className="size-5 shrink-0 text-emerald-600"
                    aria-label="Worked through"
                  />
                ) : null}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-muted-foreground">
                  {workedThrough ? 'Worked through' : definition.station.replaceAll('-', ' ')}
                </span>
                <Link
                  href={`/icu-hemodynamics/practice?case=${definition.id}` as Route}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Open case <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </li>
          )
        })}
      </ol>
    </main>
  )
}
