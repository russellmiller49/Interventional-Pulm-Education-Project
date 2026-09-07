import type { Route } from 'next'
import { Clock3, ListTree, Stethoscope, type LucideIcon } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import {
  hemodynamicsCompositionLine,
  hemodynamicsPathway,
  hemodynamicsPathwayComposition,
} from '../content/pathwayResolver'
import {
  HemodynamicsContinueCta,
  HemodynamicsStoredPathwayAccordion,
} from './HemodynamicsPathwayAccordion'
import styles from './hemodynamics-hub.module.css'

/**
 * The module front door, written for a first-year fellow who has not held a catheter.
 *
 * One primary call to action, resolved through the same function every entry surface uses; one
 * map, the pathway accordion, browsed in place; every count derived from the registry at render.
 * The claims here are about what the learner will do, not about what the simulation is made of.
 */
const orientationFacts = (): readonly { icon: LucideIcon; value: string; label: string }[] => {
  const composition = hemodynamicsPathwayComposition()
  return [
    { icon: ListTree, value: `${composition.total}`, label: 'sections, in one order' },
    { icon: Clock3, value: `${composition.minutes} min`, label: 'of guided work, start to finish' },
    { icon: Stethoscope, value: 'Adult ICU', label: 'one monitored bed throughout' },
  ]
}

const outcomes = [
  'Decide whether a displayed pressure can be trusted before it is read: level, zero, scale and the flush response.',
  'Name the place a tracing comes from by its shape, and read the waves inside a confirmed place.',
  'Take a wedge, measure flow and trace every calculated number back to its inputs before interpreting it.',
] as const

export function IcuHemodynamicsOverviewV2() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-7 rounded-3xl border bg-card p-6 shadow-sm lg:grid-cols-[1.35fr_0.65fr] lg:p-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Read the signal before treating the number
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            Make the measurement part of the clinical reasoning.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Every section runs on one monitored bed. Ask why a line is placed at all, walk the line
            from the tip to the number, learn the four places the tip can sit, then take a wedge,
            measure flow and trace every calculated value back to its inputs. Sections are ordered
            as a recommendation, not a gate.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <HemodynamicsContinueCta />
            <Link
              href={'/icu-hemodynamics/practice' as Route}
              className="inline-flex min-h-11 items-center rounded-xl border px-5 py-3 text-sm font-semibold"
            >
              Open the cases
            </Link>
          </div>
          <p className={`${styles.composition} mt-4`} data-pathway-composition>
            {hemodynamicsCompositionLine()}
          </p>
        </div>
        <dl className="grid content-start gap-3">
          {orientationFacts().map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-2xl border bg-muted/30 p-4">
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="size-4 text-primary" aria-hidden="true" /> {label}
              </dt>
              <dd className="mt-1 text-2xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="hemodynamics-map-heading">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">The pathway</p>
        <h2 id="hemodynamics-map-heading" className="mt-2 text-2xl font-bold">
          {hemodynamicsPathway.arcSentence}
        </h2>
        <div className="mt-5">
          <HemodynamicsStoredPathwayAccordion id="hemodynamics-pathway-map" />
        </div>
      </section>

      <section
        className="grid gap-5 rounded-3xl border bg-card p-6 shadow-sm lg:grid-cols-2 lg:p-8"
        aria-labelledby="hemodynamics-before-you-start-heading"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Before you start
          </p>
          <h2 id="hemodynamics-before-you-start-heading" className="mt-2 text-2xl font-bold">
            Who this is for, and what it does not claim
          </h2>
        </div>
        <dl className="grid gap-4 text-sm leading-6">
          <div>
            <dt className="font-semibold">Where a first-year fellow should begin</dt>
            <dd className="text-muted-foreground">
              At the first section — {hemodynamicsPathway.sections[0]?.title} Everything later
              assumes you know what a number from inside the circulation can and cannot say.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">What is assumed beforehand</dt>
            <dd className="text-muted-foreground">
              Basic cardiac anatomy and the normal direction of blood through the right heart, how
              to read an ECG rhythm strip, and familiarity with an ICU bedside monitor. No prior
              pulmonary-artery catheter experience is assumed.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">What you will actually practice</dt>
            <dd className="text-muted-foreground">
              Interpreting signals on a running monitor: leveling and zeroing, reading a flush
              response, naming a place from its shape, judging when a value should not be read at
              all, and reasoning from pressure and flow together.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Signal interpretation versus simulated procedure</dt>
            <dd className="text-muted-foreground">
              Most of this module is signal interpretation. Advancing the catheter and taking a
              wedge are <strong>simulated</strong> exercises in recognizing waveforms and knowing
              when to stop — they are not instruction in placing a catheter in a patient.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">What finishing a section means</dt>
            <dd className="text-muted-foreground">
              It records on this device that you worked through the material. It does not make a
              claim about clinical readiness, and it does not qualify anyone to place or interpret a
              pulmonary-artery catheter without supervision and local protocol.
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="hemodynamics-outcomes-heading">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          What you will be able to do
        </p>
        <h2 id="hemodynamics-outcomes-heading" className="mt-2 text-2xl font-bold">
          Trust, name, measure, trace
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
    </div>
  )
}
