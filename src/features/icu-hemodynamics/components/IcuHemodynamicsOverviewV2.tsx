import type { Route } from 'next'
import { Activity, ArrowRight, BookOpen, Gauge, type LucideIcon } from 'lucide-react'

import { Link } from '@/i18n/navigation'

const outcomes = [
  'Validate level, zero, dynamic response, catheter position, and thermodilution technique before interpretation.',
  'Build a physiologic mechanism from pressure, flow, perfusion, and congestion—not from one isolated number.',
  'Choose bounded management actions and reassess their modeled consequences and safety tradeoffs.',
] as const

const overviewStats: readonly { icon: LucideIcon; value: string; label: string }[] = [
  { icon: Activity, value: '8', label: 'preserved management cases' },
  { icon: Gauge, value: '50 Hz', label: 'synchronized response model' },
  {
    icon: BookOpen,
    value: '5-part',
    label: 'action feedback with authored expert traces',
  },
]

export function IcuHemodynamicsOverviewV2() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-7 rounded-3xl border bg-card p-6 shadow-sm lg:grid-cols-[1.35fr_0.65fr] lg:p-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Read the signal before treating the number
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            Make the measurement chain part of the clinical reasoning.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Begin at the introducer in one continuous, sectioned PAC pathway. Move in order or jump
            among advancement, setup validation, waveform interpretation, wedge, cardiac output,
            derived hemodynamics, and the final integration capstone.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={'/icu-hemodynamics/learn?activity=catheter-advancement' as Route}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Start at the introducer <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href={'/icu-hemodynamics/practice' as Route}
              className="inline-flex min-h-11 items-center rounded-xl border px-5 py-3 text-sm font-semibold"
            >
              Open practice cases
            </Link>
          </div>
        </div>
        <dl className="grid content-start gap-3">
          {overviewStats.map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-2xl border bg-muted/30 p-4">
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="size-4 text-primary" aria-hidden="true" /> {label}
              </dt>
              <dd className="mt-1 text-2xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="hemodynamics-outcomes-heading">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Learning outcomes
        </p>
        <h2 id="hemodynamics-outcomes-heading" className="mt-2 text-2xl font-bold">
          Validate, interpret, act, and reassess
        </h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {outcomes.map((outcome, index) => (
            <li key={outcome} className="rounded-2xl border bg-card p-5">
              <span className="text-xs font-bold text-primary">0{index + 1}</span>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{outcome}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
