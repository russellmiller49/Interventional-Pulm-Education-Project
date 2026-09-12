'use client'

import { BRONCH_ARC_SENTENCE } from '../content/pathway'
import { bronchCompositionLine } from '../content/pathwayResolver'
import { BronchContinueCta, BronchStoredPathwayAccordion } from './hub/BronchPathwayAccordion'
import styles from './bronchoscopy-foundations-hub.module.css'

/** The Learn landing: the arc sentence, the one door, the one map. */
export function BronchoscopyFoundationsLearnLanding({
  unknownSection,
}: {
  readonly unknownSection?: string
}) {
  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-10 sm:px-6 lg:px-8">
      {unknownSection ? (
        <p
          className="rounded-2xl border p-4 text-sm"
          role="status"
          data-unknown-section={unknownSection}
        >
          That section is not on the pathway. Every section is listed below.
        </p>
      ) : null}
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Learn</p>
      <h1 className="text-3xl font-bold tracking-tight">{BRONCH_ARC_SENTENCE}</h1>
      <div className="flex flex-wrap items-center gap-3">
        <BronchContinueCta />
      </div>
      <p className={styles.composition} data-pathway-composition>
        {bronchCompositionLine()}
      </p>
      <BronchStoredPathwayAccordion id="bronch-learn-map" />
    </div>
  )
}
