'use client'

import type { ScenarioDefinition } from '../../engine/types'
import { styles as teachingStyles } from '../teaching/shared'
import type { StageStep } from './stageModel'

/**
 * Explain, from data, for every drill.
 *
 * Six drills carry an authored live teaching panel whose post-commitment blocks are their Explain.
 * The other fourteen used to show a card saying no panel had been written. This renders what every
 * scenario already carries — its diagnosis, causal chain, the response that fits and its safety
 * notes — once the prediction is committed and the step has moved past it. Before commitment it
 * says what to read and nothing about why, so the pane beside the question cannot answer it.
 */
export function DrillStepTeaching({
  scenario,
  step,
  predictionCommitted,
  hasAuthoredPanel,
}: {
  readonly scenario: ScenarioDefinition | undefined
  readonly step: StageStep
  readonly predictionCommitted: boolean
  readonly hasAuthoredPanel: boolean
}) {
  if (!scenario) return null

  if (!predictionCommitted || step.phase === 'recognize' || step.phase === 'predict') {
    if (hasAuthoredPanel) return null
    return (
      <section
        className={teachingStyles.section}
        aria-labelledby="drill-reading-note-heading"
        data-drill-reading-note
      >
        <h3 id="drill-reading-note-heading" className={teachingStyles.heading}>
          Read before you decide
        </h3>
        <p className="mt-2">
          Use the surfaces this step opened and compare the readings the instruction names. What
          explains the pattern, the response that fits it, and the reflex to avoid are held here
          until you have committed a prediction.
        </p>
      </section>
    )
  }

  if (hasAuthoredPanel) return null

  return (
    <div className="grid gap-4" data-drill-explain={scenario.id}>
      <section className={teachingStyles.section} aria-labelledby="drill-explain-heading">
        <h3 id="drill-explain-heading" className={teachingStyles.heading}>
          What explains it
        </h3>
        <p className="mt-2 font-semibold">{scenario.debrief.diagnosis}</p>
        <ol className="mt-3 grid gap-2 pl-5">
          {scenario.debrief.causalChain.map((link) => (
            <li key={link}>{link}</li>
          ))}
        </ol>
      </section>
      <section className={teachingStyles.section} aria-labelledby="drill-response-heading">
        <h3 id="drill-response-heading" className={teachingStyles.heading}>
          The response that fits
        </h3>
        <ol className="mt-2 grid gap-2 pl-5">
          {scenario.debrief.correctWorkflow.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>
      {scenario.debrief.safetyNotes.length > 0 ? (
        <section className={teachingStyles.section} aria-labelledby="drill-safety-heading">
          <h3 id="drill-safety-heading" className={teachingStyles.heading}>
            Safety notes
          </h3>
          <ul className="mt-2 grid gap-2 pl-5">
            {scenario.debrief.safetyNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
