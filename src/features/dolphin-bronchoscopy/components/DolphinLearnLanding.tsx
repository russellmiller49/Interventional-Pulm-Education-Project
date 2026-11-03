'use client'

import { dolphinPathway } from '../content/pathway'
import { dolphinCompositionLine } from '../content/pathwayResolver'
import {
  DolphinContinueCta,
  DolphinProgressNotes,
  DolphinStartAtFirstSectionLink,
  DolphinStoredPathwayAccordion,
} from './hub/DolphinPathwayAccordion'
import styles from './dolphin-hub.module.css'

/** The Learn landing: the arc sentence, the one door, the one map. Every section is open. */
export function DolphinLearnLanding({ unknownSection }: { readonly unknownSection?: string }) {
  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-10 sm:px-6 lg:px-8">
      {unknownSection ? (
        <p
          className="rounded-2xl border p-4 text-sm"
          role="status"
          data-unknown-section={unknownSection}
        >
          That section is not open yet. Every open section is listed below.
        </p>
      ) : null}
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Learn</p>
      <h1 className="text-3xl font-bold tracking-tight">{dolphinPathway.arcSentence}</h1>
      <p data-learn-lede>
        Each section asks one question, has you commit to an answer, gives you something to do with
        the airway or the plan, and then explains. Sections that drive the scope load the dolphin
        airway from CT in the middle panel.
      </p>
      <p>
        Every section is open, in any order. This device keeps where you were, the sections you have
        opened, and the sections you mark reviewed or save for later — never your answers. A section
        you return to starts from its first step.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <DolphinContinueCta />
        <DolphinStartAtFirstSectionLink />
      </div>
      <DolphinProgressNotes className="grid gap-3" />
      <p className={styles.composition} data-pathway-composition>
        {dolphinCompositionLine()}
      </p>
      <DolphinStoredPathwayAccordion id="dolphin-learn-map" />
    </div>
  )
}
