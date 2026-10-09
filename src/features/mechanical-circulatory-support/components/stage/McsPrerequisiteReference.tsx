'use client'
import { useState } from 'react'
import { mcsComparisonPathways } from '../teaching/selectors'
import { McsCirculationSketch } from './McsPathwayTour'
import styles from './mcs-flow.module.css'

const references: Readonly<Record<string, readonly { title: string; text: string }[]>> = {
  'iabp-efficacy-limits': [
    {
      title: 'From timing to patient response',
      text: 'First check timing: inflation at the dicrotic notch, deflation just before the next upstroke. Then read flow and filling alongside pressure. A well-timed balloon is not proof of adequate perfusion. The RV-contractility control you are about to use changes the patient, not the treatment.',
    },
  ],
  'impella-suction-purge-rv': [
    {
      title: 'Upstream filling and RV delivery',
      text: 'The left pump draws from the LV. Blood must arrive through the right heart and lungs before it can enter that pump. A left pump cannot pump what the right heart does not deliver, so one low-flow display does not tell you the cause.',
    },
    {
      title: 'Right-sided support and serial flow',
      text: `${mcsComparisonPathways.impellaRight.source} → ${mcsComparisonPathways.impellaRight.destination}. ${mcsComparisonPathways.impellaRight.relationshipLabel}. Keep the right-pump estimate separate from the left-pump estimate and effective systemic flow.`,
    },
    {
      title: 'Suction: inspect more than the setting',
      text: 'Suction means the inlet is short of blood for the P-level in use. First moves (Impella instructions for use, p. 7.17): reduce the P-level by one or two levels; give volume if the patient is underfilled; check catheter position with echo; assess the right ventricle; then return to the previous level. In the application you will start right-sided support, compare what you observe, then reassess at a different preload.',
    },
    {
      title: 'Purge and hemolysis',
      text: 'The purge system runs fluid through the motor to keep blood out of it. A purge alarm is a problem in that system, not in blood flow, and it is not suction. Suction and malposition both cause hemolysis. Mechanism Studio has a purge-state selector.',
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
