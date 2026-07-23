import type { Route } from 'next'
import { Activity, ArrowRight, Gauge, ShieldCheck, Wind, type LucideIcon } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { mechanicalVentilationLessons, ventilatorDeviceProfiles } from '../content'

const outcomes = [
  'Read the patient, pressure, flow, volume, effort, gas exchange, and alarms as one physiologic system.',
  'Predict a mechanism and response before changing ventilator or whole-patient therapy.',
  'Use the preserved deterministic engine to act, observe, reassess, and explain consequences.',
] as const

const overviewStats: readonly { icon: LucideIcon; value: string; label: string }[] = [
  { icon: Activity, value: '15', label: 'preserved scored cases' },
  {
    icon: Wind,
    value: String(ventilatorDeviceProfiles.length),
    label: 'source-bound console profiles',
  },
  {
    icon: Gauge,
    value: String(mechanicalVentilationLessons.length),
    label: 'focused guided lessons',
  },
  { icon: ShieldCheck, value: '80%', label: 'existing mastery threshold, with no critical error' },
]

export function MechanicalVentilationOverviewV2() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <section className="grid gap-7 rounded-3xl border bg-card p-6 shadow-sm lg:grid-cols-[1.35fr_0.65fr] lg:p-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Recognize → predict → act → observe → explain → transfer
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            Reason from the patient and signals before touching the console.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Build one skill at a time, then enter a clean case with one console fixed for the
            attempt. Device choice, learning support, case selection, and the live workspace are
            deliberately separated.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={'/mechanical-ventilation/learn' as Route}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Start focused learning <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href={'/mechanical-ventilation/practice' as Route}
              className="inline-flex min-h-11 items-center rounded-xl border px-5 py-3 text-sm font-semibold"
            >
              Set up a practice case
            </Link>
          </div>
        </div>
        <dl className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1">
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

      <section aria-labelledby="ventilation-outcomes-heading">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Learning outcomes
        </p>
        <h2 id="ventilation-outcomes-heading" className="mt-2 text-2xl font-bold">
          Interpret, test, and reassess
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

      <section
        className="rounded-3xl border bg-card p-6 lg:p-8"
        aria-labelledby="device-setup-heading"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Case setup</p>
        <h2 id="device-setup-heading" className="mt-2 text-2xl font-bold">
          One console, one clean attempt
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Your preferred training console is saved in the existing ventilation progress record. Once
          a case starts, that console stays fixed. To change consoles, exit to setup; the case
          restarts at time zero while completed-case progress and best scores remain intact.
        </p>
        <Link
          href={'/mechanical-ventilation/assess' as Route}
          className="mt-5 inline-flex min-h-11 items-center rounded-xl border px-5 py-3 text-sm font-semibold"
        >
          Open the masked assessment
        </Link>
      </section>
    </main>
  )
}
