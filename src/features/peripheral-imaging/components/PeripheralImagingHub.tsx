import { Clock3, ListTree, ScanSearch, type LucideIcon } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { CHAIN_STOPS } from '../content/imagingChain'
import {
  imagingCompositionLine,
  imagingPathwayComposition,
  imagingSectionLinkTarget,
} from '../content/pathwayResolver'
import { peripheralImagingPathway, peripheralImagingPathwaySections } from '../content/pathway'
import { PERIPHERAL_IMAGING_ASSESS_HREF, PERIPHERAL_IMAGING_PRACTICE_HREF } from '../content/routes'
import { LESSONS, OBJECTIVES } from '../data/lessons'
import { DECISION_GUIDE, GLOSSARY, MODALITIES } from '../data/resources'
import { REVIEWED_ON, SOURCES } from '../data/sources'
import { ImagingContinueCta, ImagingStoredPathwayAccordion } from './hub/ImagingPathwayAccordion'
import { ReconstructionComparison } from './stage/ReconstructionComparison'
import styles from './peripheral-imaging-hub.module.css'

/**
 * The module front door: one primary call to action resolved through the pathway resolver, one
 * map browsed in place, every count derived from the registry at render. The draft's objectives,
 * imaging guide, glossary and references stay, as anchored sections under the map.
 */
const facts = (): readonly { icon: LucideIcon; value: string; label: string }[] => {
  const composition = imagingPathwayComposition()
  const labs = LESSONS.filter((lesson) => lesson.lab).length
  return [
    { icon: ListTree, value: `${composition.total}`, label: 'sections, in one order' },
    { icon: Clock3, value: `${composition.minutes} min`, label: 'of guided work, start to finish' },
    { icon: ScanSearch, value: `${labs}`, label: 'sections worked on the imaging suite' },
  ]
}

export function PeripheralImagingHub() {
  const sectionById = new Map(
    peripheralImagingPathwaySections.map((section) => [section.id, section] as const),
  )
  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-7 rounded-3xl border bg-card p-6 shadow-sm lg:grid-cols-[1.35fr_0.65fr] lg:p-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            A practical course for the bronch suite
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            See the target. Understand the image.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Every section runs on one imaging suite. Ask what an image can establish, walk the six
            stops from the X-ray tube to the decision, meet the five things you can change, then
            take each technology as a different way of using the same chain: a single view, a
            limited sweep, a full orbit, an overlay, and the people and numbers around the beam.
            Sections are ordered as a recommendation, not a gate.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <ImagingContinueCta />
            <Link
              href={PERIPHERAL_IMAGING_ASSESS_HREF}
              className="inline-flex min-h-11 items-center rounded-xl border px-5 py-3 text-sm font-semibold"
            >
              The capstone
            </Link>
          </div>
          <p className={`${styles.composition} mt-4`} data-pathway-composition>
            {imagingCompositionLine()}
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

      <section aria-labelledby="imaging-map-heading">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">The pathway</p>
        <h2 id="imaging-map-heading" className="mt-2 text-2xl font-bold">
          {peripheralImagingPathway.arcSentence}
        </h2>
        <div className="mt-5">
          <ImagingStoredPathwayAccordion id="imaging-pathway-map" />
        </div>
      </section>

      <section
        className="grid gap-5 rounded-3xl border bg-card p-6 shadow-sm lg:grid-cols-2 lg:p-8"
        aria-labelledby="imaging-before-heading"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Before you start
          </p>
          <h2 id="imaging-before-heading" className="mt-2 text-2xl font-bold">
            Who this is for, and what it does not claim
          </h2>
        </div>
        <dl className="grid gap-4 text-sm leading-6">
          <div>
            <dt className="font-semibold">Who this is for</dt>
            <dd className="text-muted-foreground">
              Pulmonary and interventional pulmonology fellows, bronchoscopists and imaging team
              members. Basic chest CT anatomy and familiarity with bronchoscopy are assumed.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Where to begin</dt>
            <dd className="text-muted-foreground">
              At the first section — {peripheralImagingPathway.sections[0]?.title}. Everything later
              assumes you can say which question an image is being asked to answer.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">The chain every section stands on</dt>
            <dd className="text-muted-foreground">
              {CHAIN_STOPS.map((stop) => stop.title.toLowerCase()).join(' → ')}. One stop is lit in
              every section; the technologies differ in how they use it.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">What finishing a section means</dt>
            <dd className="text-muted-foreground">
              It records on this device that you worked through the material, with your first
              decisions kept as you made them. It makes no claim about clinical readiness, and it
              does not stand in for supervised C-arm operation, radiation credentialing or biopsy
              training.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">What the models leave out</dt>
            <dd className="text-muted-foreground">
              The suite combines CT-derived anatomy with authored targets, instruments and values.
              Nothing in it predicts patient dose, safe tool placement, diagnostic yield or the
              behaviour of a particular device. Follow current device instructions and local
              protocols.
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="imaging-outcomes-heading">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          What you will be able to decide
        </p>
        <h2 id="imaging-outcomes-heading" className="mt-2 text-2xl font-bold">
          One procedure. Different information.
        </h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {OBJECTIVES.map((objective, index) => (
            <li key={objective.id} className="rounded-2xl border bg-card p-5">
              <span className="text-xs font-bold text-primary">0{index + 1}</span>
              <p className="mt-2 font-semibold">{objective.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {objective.description}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="imaging-landscape-heading">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          The information landscape
        </p>
        <h2 id="imaging-landscape-heading" className="mt-2 text-2xl font-bold">
          Choose the question before the technology.
        </h2>
        <ul className="mt-5 grid gap-4 md:grid-cols-3">
          {MODALITIES.map((modality) => (
            <li key={modality.name} className="rounded-2xl border bg-card p-5 text-sm leading-6">
              <p className="font-semibold">{modality.name}</p>
              <p className="mt-1 text-muted-foreground">{modality.information}</p>
              <p className="mt-2 text-muted-foreground">
                <strong>Limit.</strong> {modality.limit}
              </p>
              <Link
                href={imagingSectionLinkTarget(modality.lesson)}
                className="mt-3 inline-block font-semibold text-primary"
              >
                {sectionById.get(modality.lesson)?.title ?? 'Open the section'} →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="guide"
        aria-labelledby="imaging-guide-heading"
        className="rounded-3xl border bg-card p-6 shadow-sm lg:p-8"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          The imaging guide
        </p>
        <h2 id="imaging-guide-heading" className="mt-2 text-2xl font-bold">
          What you see, the question to ask, the first move
        </h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">Finding</th>
                <th className="py-2 pr-4">Question</th>
                <th className="py-2 pr-4">First move</th>
                <th className="py-2">Section</th>
              </tr>
            </thead>
            <tbody>
              {DECISION_GUIDE.map((row) => (
                <tr key={row.finding} className="border-t align-top">
                  <td className="py-3 pr-4 font-medium">{row.finding}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{row.question}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{row.action}</td>
                  <td className="py-3">
                    <Link
                      href={imagingSectionLinkTarget(row.lesson)}
                      className="font-semibold text-primary"
                    >
                      {sectionById.get(row.lesson)?.shortTitle ?? row.lesson}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        id="reconstruction"
        aria-labelledby="imaging-reconstruction-heading"
        className="rounded-3xl border bg-card p-6 shadow-sm lg:p-8"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          How a reconstruction is made
        </p>
        <h2 id="imaging-reconstruction-heading" className="mt-2 text-2xl font-bold">
          A sweep and an orbit do not return the same thing
        </h2>
        <div className="mt-5">
          <ReconstructionComparison />
        </div>
      </section>

      <section id="glossary" aria-labelledby="imaging-glossary-heading">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Glossary</p>
        <h2 id="imaging-glossary-heading" className="mt-2 text-2xl font-bold">
          One term per concept
        </h2>
        <dl className="mt-5 grid gap-3 md:grid-cols-2">
          {GLOSSARY.map(([term, definition]) => (
            <div key={term} className="rounded-2xl border bg-card p-4 text-sm leading-6">
              <dt className="font-semibold">{term}</dt>
              <dd className="mt-1 text-muted-foreground">{definition}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        id="references"
        aria-labelledby="imaging-references-heading"
        className="rounded-3xl border bg-card p-6 shadow-sm lg:p-8"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          References · checked {REVIEWED_ON}
        </p>
        <h2 id="imaging-references-heading" className="mt-2 text-2xl font-bold">
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
                <span className="font-semibold">{source.title}</span> {source.authors}{' '}
                {source.publication} {source.year}.{' '}
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-semibold text-primary"
                >
                  Open
                </a>
              </p>
              <p className="mt-1 text-muted-foreground">
                <strong>{source.kind}.</strong> Supports: {source.supports} <strong>Limit.</strong>{' '}
                {source.limitation}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-sm text-muted-foreground">
          Teaching models for download:{' '}
          <a href="/peripheral-imaging/sampling-window.glb" className="font-semibold text-primary">
            the sampling-window geometry
          </a>{' '}
          and{' '}
          <a href="/peripheral-imaging/anatomy/thorax.glb" className="font-semibold text-primary">
            the CT-derived thorax
          </a>
          . Provenance and limits are recorded with the assets.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Practice cases arrive in a later round; the eight-case capstone waits on the{' '}
          <Link href={PERIPHERAL_IMAGING_ASSESS_HREF} className="font-semibold text-primary">
            Assess page
          </Link>{' '}
          once every section is worked through, and the{' '}
          <Link href={PERIPHERAL_IMAGING_PRACTICE_HREF} className="font-semibold text-primary">
            Practice page
          </Link>{' '}
          says what it holds today.
        </p>
      </section>
    </div>
  )
}
