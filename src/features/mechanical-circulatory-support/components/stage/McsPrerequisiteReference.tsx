'use client'
import { useState } from 'react'
import { mcsComparisonPathways } from '../teaching/selectors'
import { McsCirculationSketch } from './McsPathwayTour'
import styles from './mcs-flow.module.css'

const references: Readonly<Record<string, readonly { title: string; text: string }[]>> = {
  'iabp-efficacy-limits': [
    {
      title: 'From timing to patient response',
      text: 'First establish the relationship between inflation, valve closure and the next ejection. Then assess flow and filling alongside pressure. Technically satisfactory counterpulsation does not establish adequate patient perfusion. The upcoming RV-contractility control changes an experimental condition; it is not a therapy.',
    },
  ],
  'impella-suction-purge-rv': [
    {
      title: 'Upstream filling and RV delivery',
      text: 'The left pump draws from the LV. Blood must arrive through the right heart and lungs before it can enter that pump. Filling pressures, pump estimates and modeled LV volume answer different questions; one low-flow display does not determine the cause.',
    },
    {
      title: 'Right-sided support and serial flow',
      text: `${mcsComparisonPathways.impellaRight.source} → ${mcsComparisonPathways.impellaRight.destination}. ${mcsComparisonPathways.impellaRight.relationshipLabel}. Keep the right-pump estimate separate from the left-pump estimate and effective systemic flow.`,
    },
    {
      title: 'Suction: inspect more than the setting',
      text: 'Distinguish patient filling and upstream delivery, pump position, and device problems. A performance-level increase or a fluid bolus is not a universal response. In the application you will compare actual observations after enabling the represented right-sided pathway, then reassess a different preload state.',
    },
    {
      title: 'Purge and hemolysis: reference scope',
      text: 'The section retains source-backed purge and hemolysis context in its explanation and references. Mechanism Studio includes a purge-state selector. There is no interactive purge-management lesson here. Use current device-specific instructions and the responsible team; no purge solution, pressure target, line manipulation or diagnostic shortcut is taught.',
    },
  ],
}
export function mcsHasPrerequisiteReference(sectionId: string) {
  return Boolean(references[sectionId])
}

/** Reference pages are not task IDs, scored work, engine actions or persisted completion. */
export function McsPrerequisiteReference({
  sectionId,
  onContinue,
}: {
  sectionId: string
  onContinue: () => void
}) {
  const [index, setIndex] = useState(0)
  const pages = references[sectionId]
  if (!pages) return null
  const page = pages[index]
  return (
    <section className={styles.tour} data-prerequisite-reference>
      <p>
        Reference · {index + 1} of {pages.length} · optional reading
      </p>
      <h2>{page.title}</h2>
      <p>{page.text}</p>
      {index === 0 ? (
        <McsCirculationSketch device={sectionId === 'iabp-efficacy-limits' ? 'iabp' : 'impella'} />
      ) : null}
      <p>
        This conceptual reference does not display the upcoming patient’s diagnosis or model
        settings.
      </p>
      <button type="button" onClick={onContinue}>
        Continue to the model
      </button>
      <button
        type="button"
        onClick={() => (index < pages.length - 1 ? setIndex(index + 1) : onContinue())}
      >
        {index < pages.length - 1 ? 'Next reference' : 'Begin the patient example'}
      </button>
    </section>
  )
}
