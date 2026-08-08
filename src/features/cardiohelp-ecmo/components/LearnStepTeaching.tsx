'use client'

import { useMemo } from 'react'
import { BookOpenCheck, CheckCircle2 } from 'lucide-react'

import type { EcmoSimulationState, GuidedWalkthroughStep } from '../engine'
import { formatChannelGroup, formatChannelReadout } from './channelReadout'
import styles from './cardiohelp-ecmo.module.css'

/**
 * The teaching half of a guided drill step, separated from the guided actions.
 *
 * These three blocks used to live inside `LearnLessonPlayer`, between the stepper and the action
 * buttons. That put the explanation of a step, the live reading of the circuit, and the control the
 * learner has to operate into one column, so the surface a learner reads and the surface a learner
 * acts through were the same scroll region and competed for it. B3 splits them: this renders into
 * the workspace's teaching pane beside the live drill panel, and `LearnLessonPlayer` keeps only what
 * the learner does.
 *
 * Nothing here is authored anew — the copy is the step's own `rationale` and `expectedResponse`, and
 * every number is read through the channel readouts so a stopped circuit's equation intercepts are
 * never printed as though the console had measured them.
 */

export interface LearnStepStatus {
  readonly step: GuidedWalkthroughStep
  readonly stepIndex: number
  readonly stepCount: number
  /** Whether the learner has completed this step's action or commitment. */
  readonly performed: boolean
  readonly lessonFinished: boolean
}

export function LearnStepTeaching({
  state,
  status,
}: {
  readonly state: EcmoSimulationState
  readonly status: LearnStepStatus
}) {
  const { step, performed } = status
  const snapshot = useMemo(
    () => ({
      time: state.simulationTime,
      flow: state.circuit.bloodFlow.toFixed(2),
      // Formatted from the engine readouts, so a stopped circuit's intercepts never appear here as
      // though the console had measured them.
      pVen: formatChannelReadout('pVen', state.circuit.readouts.pVen, 'mmHg'),
      // With an empty unit this tile printed two bare numbers, so the only pressures in the snapshot
      // that carried no unit were the two the learner is asked to compare.
      pIntPArt: formatChannelGroup(
        [state.circuit.readouts.pInt, state.circuit.readouts.pArt],
        'mmHg',
      ),
      sweep: state.gas.sweepLpm.toFixed(1),
      spo2: state.patient.spo2.toFixed(1),
      paCO2: state.patient.paCO2.toFixed(1),
      rightRadialSpo2: state.patient.rightRadialSpo2.toFixed(1),
      femoralArterialSpo2: state.patient.femoralArterialSpo2.toFixed(1),
    }),
    [state],
  )

  return (
    <section
      className={styles.learnStepTeaching}
      aria-label="Teaching for the current lesson step"
      data-learn-step-teaching={step.id}
    >
      <div className={styles.guidedSnapshot} aria-label="Current simulated values">
        <span>
          <small>Clock</small>
          <strong>{snapshot.time}s</strong>
        </span>
        <span>
          <small>Flow</small>
          <strong>{snapshot.flow} L/min</strong>
        </span>
        <span data-readout-status={snapshot.pVen.status}>
          <small>pVen</small>
          <strong aria-hidden="true">{snapshot.pVen.valueText}</strong>
          <span className="sr-only">{snapshot.pVen.screenReaderText}</span>
        </span>
        <span>
          <small>pInt / pArt</small>
          <strong>{snapshot.pIntPArt.text}</strong>
        </span>
        <span>
          <small>Sweep</small>
          <strong>{snapshot.sweep} L/min</strong>
        </span>
        {state.supportMode === 'va' ? (
          <span>
            <small>Right arm / femoral SpO₂</small>
            <strong>
              {snapshot.rightRadialSpo2}% / {snapshot.femoralArterialSpo2}%
            </strong>
          </span>
        ) : (
          <span>
            <small>SpO₂ / PaCO₂</small>
            <strong>
              {snapshot.spo2}% / {snapshot.paCO2}
            </strong>
          </span>
        )}
      </div>

      <div className={styles.guidedWhy}>
        <BookOpenCheck aria-hidden="true" />
        <div>
          <strong>Why this step matters</strong>
          <p>{step.rationale}</p>
        </div>
      </div>

      {/*
        A prediction step is answered rather than performed, and its `expectedResponse` is empty by
        design — previewing the response would be the answer. So the completed-step block belongs to
        action steps only, and the verdict remains the only thing a committed prediction produces.
      */}
      {performed && !step.predictionScenarioId ? (
        <div className={styles.guidedExpectedResponse} role="status">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <strong>Step complete—now verify what changed</strong>
            {step.expectedResponse.length ? (
              <ul>
                {step.expectedResponse.map((response) => (
                  <li key={response}>{response}</li>
                ))}
              </ul>
            ) : (
              <p>No control change was required for this observation step.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
