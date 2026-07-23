import type { Route } from 'next'
import { ArrowRight, BookOpenCheck, Clock3, Waves } from 'lucide-react'

import { Link } from '@/i18n/navigation'

const guidedActivities = [
  {
    id: 'pac-signal-validation',
    title: 'PAC signal validation',
    minutes: 15,
    description:
      'Decide whether discordant values are usable, correct the measurement chain, and transfer the sequence to an artifact variant.',
  },
  {
    id: 'pressure-system',
    title: 'Level, zero, and dynamic response',
    minutes: 12,
    description: 'Establish a valid pressure system before interpreting invasive values.',
  },
  {
    id: 'catheter-advancement',
    title: 'Advance the PAC by waveform',
    minutes: 15,
    description: 'Progress through RA, RV, and PA while confirming each authored waveform.',
  },
  {
    id: 'waveform-interpretation',
    title: 'Interpret normal and abnormal waveforms',
    minutes: 18,
    description:
      'Identify each chamber by its diastolic contour, then read the wave components that carry a diagnosis — blunted y descents, tall c-v waves, and giant wedge v waves.',
  },
  {
    id: 'pawp-capture',
    title: 'Brief end-expiratory PAWP capture',
    minutes: 15,
    description: 'Capture, store, deflate, and confirm safe return of the PA waveform.',
  },
  {
    id: 'thermodilution-series',
    title: 'Thermodilution technique and curve review',
    minutes: 18,
    description: 'Standardize technique, reject poor curves, and form a valid accepted average.',
  },
  {
    id: 'derived-hemodynamics',
    title: 'Derived values and interpretation limits',
    minutes: 15,
    description: 'Review formulas and the explicit conditions that make a value uninterpretable.',
  },
] as const

export function IcuHemodynamicsLearnLandingV2() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Guided learning</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Learn the measurement sequence</h1>
      <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
        Focused activities use the same simulation engine as the practice cases, with explicit
        prediction, action, observation, explanation, and transfer checkpoints.
      </p>

      <ol className="mt-8 grid gap-4">
        {guidedActivities.map((activity, index) => (
          <li
            key={activity.id}
            className="grid gap-5 rounded-2xl border bg-card p-5 shadow-sm md:grid-cols-[auto_1fr_auto] md:items-center"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              {index === 0 ? (
                <Waves className="size-6" aria-hidden="true" />
              ) : (
                String(index + 1).padStart(2, '0')
              )}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="size-3.5" aria-hidden="true" /> {activity.minutes} minutes
                </span>
                <span className="inline-flex items-center gap-1">
                  <BookOpenCheck className="size-3.5" aria-hidden="true" /> Guided
                </span>
              </div>
              <h2 className="mt-2 text-lg font-bold">{activity.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{activity.description}</p>
            </div>
            <Link
              href={`/icu-hemodynamics/learn?activity=${activity.id}` as Route}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Start <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
    </main>
  )
}
