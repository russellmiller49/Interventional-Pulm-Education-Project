'use client'

import { useState } from 'react'

import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import type { ClinicalLearningItem } from '@/features/learning-module/activity'

import { pressureSystemValiditySteps } from '../content'
import type { HemodynamicSimulationState } from '../engine'
import styles from './icu-hemodynamics.module.css'

/**
 * The named validity sequence for the module's first section (H0/H1 requirement 3).
 *
 * The checks themselves already existed in this module; what did not exist was one ordered,
 * repeatable list a novice can run the same way every time, with an explicit last step that allows
 * "this should not be interpreted yet."
 *
 * Live markers come from the same state the lab controls drive, so the sequence reflects what the
 * learner has actually done rather than what they have read. Steps with no modeled control are
 * marked as read-and-judge rather than being shown as if they could be completed here — the module
 * has no scale control and no plumbing control, and pretending otherwise would be the same class of
 * defect this section teaches against.
 *
 * The commitment uses the shared `AnswerVerdict` unmodified, in Learn's `immediate-after-commit`
 * timing, and advances nothing.
 */

type StepStatus = 'done' | 'outstanding' | 'judge'

function stepStatus(stepId: string, state: HemodynamicSimulationState): StepStatus {
  const { measurementSystem, signalValidationChecks } = state
  switch (stepId) {
    case 'level':
      return Math.abs(measurementSystem.transducerLevelCm) <= 1 ? 'done' : 'outstanding'
    case 'zero':
      return measurementSystem.zeroed ? 'done' : 'outstanding'
    case 'dynamic-response':
      return signalValidationChecks.includes('dynamic-response-classified') ? 'done' : 'outstanding'
    default:
      return 'judge'
  }
}

const statusLabels: Readonly<Record<StepStatus, string>> = {
  done: 'Done here',
  outstanding: 'Still outstanding',
  judge: 'Read and judge',
}

export function PressureSystemValidityPanel({
  state,
  commitment,
}: {
  readonly state: HemodynamicSimulationState
  readonly commitment?: ClinicalLearningItem
}) {
  const [choiceId, setChoiceId] = useState<string | null>(null)
  const [committed, setCommitted] = useState(false)

  return (
    <section className={styles.validityPanel} aria-labelledby="validity-sequence-heading">
      <header>
        <span className={styles.paneEyebrow}>The same sequence, every time</span>
        <h2 id="validity-sequence-heading">Can I trust this pressure signal?</h2>
        <p className={styles.paneIntro}>
          Run these in order before any invasive pressure is interpreted. Three of them have
          controls in this station; the rest are things you read and judge. The last step is the one
          novices skip: deciding whether the number should be interpreted at all.
        </p>
      </header>

      <ol className={styles.validitySteps} aria-label="Pressure-system validity sequence">
        {pressureSystemValiditySteps.map((step, index) => {
          const status = stepStatus(step.id, state)
          return (
            <li key={step.id} className={styles.validityStep}>
              <div className={styles.validityStepHead}>
                <span className={styles.validityStepOrdinal}>{index + 1}</span>
                <h3>{step.shortLabel}</h3>
                <span className={styles.validityStatus} data-status={status}>
                  {statusLabels[status]}
                </span>
              </div>
              <p className={styles.validityQuestion}>{step.question}</p>
              <dl className={styles.validityFacets}>
                <div>
                  <dt>What you check: </dt>
                  <dd>{step.whatYouCheck}</dd>
                </div>
                <div>
                  <dt>What it establishes: </dt>
                  <dd>{step.whatItEstablishes}</dd>
                </div>
                <div>
                  <dt>What it does not: </dt>
                  <dd>{step.whatItDoesNotEstablish}</dd>
                </div>
                <div>
                  <dt>How it misleads: </dt>
                  <dd>{step.howItMisleads}</dd>
                </div>
              </dl>
            </li>
          )
        })}
      </ol>

      {commitment ? (
        <section
          className={styles.validityCommitment}
          aria-labelledby="validity-commitment-heading"
        >
          <span id="validity-commitment-heading" className={styles.paneEyebrow}>
            Commit before the reasoning is shown
          </span>
          <fieldset>
            <legend>{commitment.stem}</legend>
            {commitment.choices.map((choice) => (
              <label key={choice.id} className={styles.validityChoice}>
                <input
                  type="radio"
                  name="pressure-system-validity-commitment"
                  checked={choiceId === choice.id}
                  disabled={committed}
                  onChange={() => setChoiceId(choice.id)}
                />
                {choice.label}
              </label>
            ))}
          </fieldset>
          {committed && choiceId ? (
            <AnswerVerdict
              item={commitment}
              choiceId={choiceId}
              timing="immediate-after-commit"
              theme="light"
            />
          ) : (
            <button
              type="button"
              className={styles.paneButton}
              disabled={choiceId === null}
              onClick={() => setCommitted(true)}
            >
              Commit this reading
            </button>
          )}
        </section>
      ) : null}
    </section>
  )
}
