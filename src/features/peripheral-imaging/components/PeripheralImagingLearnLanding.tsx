'use client'

import { peripheralImagingPathway } from '../content/pathway'
import { imagingCompositionLine } from '../content/pathwayResolver'
import {
  ImagingContinueCta,
  ImagingProgressNotes,
  ImagingStartAtFirstSectionLink,
  ImagingStoredPathwayAccordion,
} from './hub/ImagingPathwayAccordion'
import styles from './peripheral-imaging-hub.module.css'

/** The Learn landing: the arc sentence, the one door, the one map. Every section is open. */
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
      <p>
        Learn to optimize fluoroscopy, interpret DTS and CBCT, and assess the biopsy tool’s
        relationship to a peripheral lung lesion.
      </p>
      <p>
        Every section is open, in any order. This device keeps where you were, the sections you have
        opened, and the sections you mark reviewed or save for later — never your answers. A section
        you return to starts from its first step.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <ImagingContinueCta />
        <ImagingStartAtFirstSectionLink />
      </div>
      <ImagingProgressNotes className="grid gap-3" />
      <p className={styles.composition} data-pathway-composition>
        {imagingCompositionLine()}
      </p>
      <details>
        <summary>Course outline · {peripheralImagingPathway.sections.length} sections</summary>
        <ImagingStoredPathwayAccordion id="imaging-learn-map" />
      </details>
    </div>
  )
}
