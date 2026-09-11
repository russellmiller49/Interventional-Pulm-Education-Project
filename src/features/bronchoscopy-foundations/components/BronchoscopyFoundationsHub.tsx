import { Clock3, ListTree, ScanSearch, type LucideIcon } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { SCOPE_CONTROL_PANEL } from '../content/controlPanel'
import {
  BRONCH_ARC_SENTENCE,
  BRONCH_SECTION_IDS,
  bronchPathwaySections,
  bronchSection,
} from '../content/pathway'
import { bronchCompositionLine, bronchPathwayComposition } from '../content/pathwayResolver'
import { BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF } from '../content/routes'
import { BRONCH_PHASES } from '../content/sectionIds'
import { SPINE_STOPS } from '../content/spine'
import { SOURCES } from '../data/sources'
import { BronchContinueCta, BronchStoredPathwayAccordion } from './hub/BronchPathwayAccordion'
import styles from './bronchoscopy-foundations-hub.module.css'

/**
 * The module front door: one primary call to action resolved through the pathway resolver, one
 * map browsed in place, every count derived from the registry at render. No hero yet — there is
 * no picture of the airway model to draw — so the door leads straight to the map. The boundary,
 * the spine, the five controls and the sources sit as anchored sections under it.
 */
const facts = (): readonly { icon: LucideIcon; value: string; label: string }[] => {
  const composition = bronchPathwayComposition()
  const simulated = BRONCH_SECTION_IDS.filter((id) => bronchSection(id).act.kind === 'scope-lab')
  return [
    { icon: ListTree, value: `${composition.total}`, label: 'sections, in one order' },
    { icon: Clock3, value: `${composition.minutes} min`, label: 'of guided work, start to finish' },
    { icon: ScanSearch, value: `${simulated.length}`, label: 'sections worked on the simulator' },
  ]
}

export function BronchoscopyFoundationsHub() {
  const phaseTitles = BRONCH_PHASES.map((phase) => phase.title.toLowerCase())
  const firstSection = bronchPathwaySections[0]
  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-7 rounded-3xl border bg-card p-6 shadow-sm lg:grid-cols-[1.35fr_0.65fr] lg:p-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            A guided course in flexible bronchoscopy
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            Know where you are. Claim only what you saw.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Every section runs on one airway model, in the order a procedure runs —{' '}
            {phaseTitles.join(', ')}. Sections are ordered as a recommendation, not a gate.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <BronchContinueCta />
            <Link
              href={BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF}
              className="inline-flex min-h-11 items-center rounded-xl border px-5 py-3 text-sm font-semibold"
            >
              The capstone
            </Link>
          </div>
          <p className={`${styles.composition} mt-4`} data-pathway-composition>
            {bronchCompositionLine()}
          </p>
        </div>
        <dl className="grid content-start gap-3">
          {facts().map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-2xl border bg-muted/30 p-4">
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="size-4 text-primary" aria-hidden="true" /> {label}
              </dt>
              <dd className="mt-1 text-2xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="bronch-map-heading">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">The pathway</p>
        <h2 id="bronch-map-heading" className="mt-2 text-2xl font-bold">
          {BRONCH_ARC_SENTENCE}
        </h2>
        <div className="mt-5">
          <BronchStoredPathwayAccordion id="bronch-pathway-map" />
        </div>
      </section>

      <section
        className="grid gap-5 rounded-3xl border bg-card p-6 shadow-sm lg:grid-cols-2 lg:p-8"
        aria-labelledby="bronch-before-heading"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Before you start
          </p>
          <h2 id="bronch-before-heading" className="mt-2 text-2xl font-bold">
            Who this is for, and what it does not claim
          </h2>
        </div>
        <dl className="grid gap-4 text-sm leading-6">
          <div>
            <dt className="font-semibold">Who this is for</dt>
            <dd className="text-muted-foreground">
              Physicians beginning bronchoscopy training, and the nurses, technologists and
              anesthesia colleagues who support them. No prior bronchoscopy is assumed.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Where to begin</dt>
            <dd className="text-muted-foreground">
              At the first section — {firstSection?.title}. Everything later assumes you can say
              whose airway you are working in and what the procedure is for.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">The airway spine</dt>
            <dd className="text-muted-foreground">
              {SPINE_STOPS.map((stop) => stop.title).join(' → ')}. Every airway term is introduced
              at its stop, and the map in the Simulator panel lights one stop at a time.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">The five controls</dt>
            <dd className="text-muted-foreground">{SCOPE_CONTROL_PANEL.sentence}</dd>
          </div>
          <div>
            <dt className="font-semibold">What finishing a section means</dt>
            <dd className="text-muted-foreground">
              It records on this device that you worked through the activities, with your first
              decisions kept as you made them. It makes no claim about clinical readiness or hand
              skill, and it does not stand in for supervised procedures.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">What the models leave out</dt>
            <dd className="text-muted-foreground">
              One de-identified teaching anatomy, with an authored larynx, tube and accessory
              geometry and scripted physiology. Nothing in it predicts a patient. Follow current
              device instructions and local policy.
            </dd>
          </div>
        </dl>
      </section>

      <section
        id="sources"
        aria-labelledby="bronch-sources-heading"
        className="rounded-3xl border bg-card p-6 shadow-sm lg:p-8"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Sources · reviewed
        </p>
        <h2 id="bronch-sources-heading" className="mt-2 text-2xl font-bold">
          What each source supports, and where it stops
        </h2>
        <ol className="mt-5 grid gap-3 text-sm leading-6">
          {SOURCES.map((source, index) => (
            <li
              key={source.id}
              className="rounded-2xl border bg-muted/20 p-4"
              data-source-id={source.id}
            >
              <p>
                <span className="mr-2 text-xs font-bold text-primary">{index + 1}</span>
                <span className="font-semibold">{source.title}</span>
                {source.byline ? ` ${source.byline}` : ''}
                {source.year ? ` ${source.year}.` : ''}{' '}
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-semibold text-primary"
                  >
                    Open
                  </a>
                ) : null}
              </p>
              <p className="mt-1 text-muted-foreground">
                <strong>{source.kindLabel}.</strong>
                {source.usedFor ? ` Used for: ${source.usedFor}` : ''}{' '}
                {source.limitation ? (
                  <>
                    <strong>Limit.</strong> {source.limitation}
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
