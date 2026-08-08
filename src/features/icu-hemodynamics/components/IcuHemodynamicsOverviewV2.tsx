import type { Route } from 'next'
import { ArrowRight, Clock3, ListTree, Stethoscope, type LucideIcon } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { pathwayTotalMinutes } from '@/features/learning-module/curriculum/types'

import { firstPacLearningPathwaySectionId, pacLearningPathway } from '../content'

/**
 * The module front door, written for a first-year fellow who has not held a PAC.
 *
 * H0 moved the entry from "begin at the introducer" to "can I trust this pressure signal?" — the
 * order the pathway itself now follows. Every claim here is about what the learner will do, not
 * about what the simulation is made of.
 */

const startHref = `/icu-hemodynamics/learn?activity=${firstPacLearningPathwaySectionId}` as Route

const runway: readonly { step: string; detail: string }[] = [
  {
    step: 'Decide whether the pressure signal can be trusted',
    detail:
      'Level and zero the system, read the displayed scale and channel, and classify the fast-flush response before any number is interpreted.',
  },
  {
    step: 'Recognize the normal right-heart waveforms',
    detail:
      'Build a stable RA, RV, PA, and wedge reference — where each is measured, what it looks like, and how it sits against the ECG and the respiratory cycle.',
  },
  {
    step: 'Advance a simulated catheter by waveform',
    detail:
      'Work from the introducer to a confirmed PA tracing, confirming each transition from morphology rather than from insertion depth.',
  },
  {
    step: 'Capture a wedge, then measure output',
    detail:
      'Take a brief end-expiratory PAWP and confirm the PA waveform returns, then compare thermodilution with Fick and build a technically valid series.',
  },
  {
    step: 'Derive values, then integrate the whole screen',
    detail:
      'Trace every calculated value back to its source measurements, and finish with one discordant case that exercises the full validity check at once.',
  },
] as const

const orientationFacts: readonly { icon: LucideIcon; value: string; label: string }[] = [
  {
    icon: ListTree,
    value: `${pacLearningPathway.sections.length}`,
    label: 'sections, in a recommended order',
  },
  {
    icon: Clock3,
    value: `${pathwayTotalMinutes(pacLearningPathway)} min`,
    label: 'of guided work, start to finish',
  },
  {
    icon: Stethoscope,
    value: 'Adult ICU',
    label: 'simulated bedside throughout',
  },
]

const outcomes = [
  'Validate level, zero, dynamic response, catheter position, and thermodilution technique before interpretation.',
  'Build a physiologic mechanism from pressure, flow, perfusion, and congestion—not from one isolated number.',
  'Choose bounded management actions and reassess their modeled consequences and safety tradeoffs.',
] as const

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
            Start with one question—<strong>can I trust this pressure signal?</strong>—and only then
            move on to reading waveforms, advancing a simulated catheter, and using the numbers.
            Sections are ordered as a recommendation, not a gate: you can open any of them directly
            at any time.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={startHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Start here: can I trust this pressure signal?{' '}
              <ArrowRight className="size-4" aria-hidden="true" />
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
          {orientationFacts.map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-2xl border bg-muted/30 p-4">
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="size-4 text-primary" aria-hidden="true" /> {label}
              </dt>
              <dd className="mt-1 text-2xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
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
              At the first section — {pacLearningPathway.sections[0]?.title}. Everything later
              assumes you can already say whether the tracing in front of you is trustworthy.
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
              Interpreting signals: leveling and zeroing, classifying a fast-flush response,
              identifying chambers from morphology, judging when a value should not be interpreted
              at all, and reasoning from pressure and flow together.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Signal interpretation versus simulated procedure</dt>
            <dd className="text-muted-foreground">
              Most of this module is signal interpretation. Catheter advancement and wedge capture
              are <strong>simulated</strong> exercises in recognizing waveforms and knowing when to
              stop—they are not instruction in placing a catheter in a patient.
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

      <section aria-labelledby="hemodynamics-runway-heading">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          How the sections build
        </p>
        <h2 id="hemodynamics-runway-heading" className="mt-2 text-2xl font-bold">
          {pacLearningPathway.arcSentence}
        </h2>
        <ol className="mt-5 grid gap-3">
          {runway.map(({ step, detail }, index) => (
            <li
              key={step}
              className="grid gap-3 rounded-2xl border bg-card p-5 md:grid-cols-[auto_1fr]"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                {index + 1}
              </span>
              <div>
                <h3 className="text-base font-bold">{step}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
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
