import type { Route } from 'next'

import { Link } from '@/i18n/navigation'

import { ecmoPathwayComposition } from '../content/pathwayResolver'
import { ecmoTrackIncrement } from '../content/trackIncrements'
import type { SupportMode } from '../engine/types'
import { EcmoContinueCta } from './EcmoContinueCta'
import { EcmoStoredPathwayAccordion } from './EcmoPathwayAccordion'

/**
 * The Learn landing: the same door and the same map as the hub.
 *
 * It used to render the shared `PathwayLanding` — seventeen cards in a grid under a long intro,
 * with its own copy of the counts. Now it is two sentences, the one Continue call to action the
 * hub also resolves, and the pathway accordion the hub also shows. CRRT keeps the shared landing.
 */
const trackLabel: Readonly<Record<SupportMode, string>> = {
  vv: 'VV · for failing lungs',
  va: 'VA · for a failing heart or circulation',
}

export function CardiohelpLearnLanding({ supportMode }: { readonly supportMode: SupportMode }) {
  const { total } = ecmoPathwayComposition(supportMode)
  const increment = ecmoTrackIncrement(supportMode)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <nav className="flex flex-wrap gap-2" aria-label="Choose support mode track">
        {(['vv', 'va'] as const).map((mode) => (
          <Link
            key={mode}
            href={`/cardiohelp-ecmo/learn?track=${mode}` as Route}
            aria-current={mode === supportMode ? 'page' : undefined}
            className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold aria-[current=page]:border-primary aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary"
          >
            {trackLabel[mode]}
          </Link>
        ))}
      </nav>
      <header className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {supportMode.toUpperCase()} track · one continuous pathway · {total} sections
        </p>
        <h1 className="text-2xl font-semibold">Learn</h1>
        <p className="max-w-3xl text-base leading-7">
          Every section is read on the same simulated circuit: first what the support stands in for
          and where each reading is taken, then one failure at a time, then the whole track in one
          case. Move in order, or open any section from the map below.
        </p>
        {increment ? (
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground" data-track-increment>
            {increment.sentence}
          </p>
        ) : null}
        <EcmoContinueCta supportMode={supportMode} />
      </header>
      <section aria-labelledby="learn-landing-map-heading">
        <h2 id="learn-landing-map-heading" className="text-lg font-semibold">
          {supportMode.toUpperCase()} pathway
        </h2>
        <EcmoStoredPathwayAccordion track={supportMode} id="learn-landing-pathway" />
      </section>
      <aside
        role="note"
        className="flex max-w-3xl gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-6"
      >
        <div>
          <p className="font-semibold">Educational model · draft</p>
          <p className="text-muted-foreground">
            Circuit responses are simplified teaching approximations. Where the source set
            disagrees, both positions are shown rather than reconciled, and neither is presented as
            a bedside threshold.
          </p>
        </div>
      </aside>
    </div>
  )
}
