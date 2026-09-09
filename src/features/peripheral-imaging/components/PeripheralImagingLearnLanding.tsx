'use client'

import { peripheralImagingPathway } from '../content/pathway'
import { imagingCompositionLine } from '../content/pathwayResolver'
import { ImagingContinueCta, ImagingStoredPathwayAccordion } from './hub/ImagingPathwayAccordion'
import styles from './peripheral-imaging-hub.module.css'

/** The Learn landing: the arc sentence, the one door, the one map. */
export function PeripheralImagingLearnLanding({
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
      <h1 className="text-3xl font-bold tracking-tight">{peripheralImagingPathway.arcSentence}</h1>
      <div className="flex flex-wrap items-center gap-3">
        <ImagingContinueCta />
      </div>
      <p className={styles.composition} data-pathway-composition>
        {imagingCompositionLine()}
      </p>
      <ImagingStoredPathwayAccordion id="imaging-learn-map" />
    </div>
  )
}
