'use client'

import { useReducer, useState } from 'react'

import {
  baxterCrrtReviewerRapidDrills,
  CRRT_CAUSE_FIRST_STEPS,
  CRRT_REVIEWER_RAPID_DRILL_IDS,
  createCrrtRapidDrillReviewState,
  getCrrtReviewerRapidDrill,
  reduceCrrtRapidDrillReview,
  type CrrtReviewerRapidDrillId,
} from '../content'
import styles from './crrt-rapid-drill-review.module.css'

const REVIEW_HEADING_ID = 'baxter-crrt-rapid-drill-review-heading'
const REVIEW_BOUNDARY_ID = 'baxter-crrt-rapid-drill-review-boundary'

function isReviewerRapidDrillId(value: string): value is CrrtReviewerRapidDrillId {
  return CRRT_REVIEWER_RAPID_DRILL_IDS.some((drillId) => drillId === value)
}

export function CrrtRapidDrillReview() {
  const [state, dispatch] = useReducer(
    reduceCrrtRapidDrillReview,
    undefined,
    createCrrtRapidDrillReviewState,
  )
  const [draftPredictionOptionId, setDraftPredictionOptionId] = useState('')
  const drill = getCrrtReviewerRapidDrill(state.drillId)
  const selectedPrediction = drill.predictionOptions.find(
    (option) => option.id === state.predictionOptionId,
  )
  const candidatePrediction = drill.predictionOptions.find(
    (option) => option.id === drill.candidateCauseOptionId,
  )
  const nextStepIndex = state.completedStepIds.length

  function selectDrill(value: string) {
    if (!isReviewerRapidDrillId(value)) return
    setDraftPredictionOptionId('')
    dispatch({ type: 'SELECT_DRILL', drillId: value })
  }

  function commitPrediction() {
    if (!draftPredictionOptionId) return
    dispatch({ type: 'COMMIT_PREDICTION', optionId: draftPredictionOptionId })
  }

  function resetPreview() {
    setDraftPredictionOptionId('')
    dispatch({ type: 'RESET' })
  }

  return (
    <section
      className={styles.review}
      aria-labelledby={REVIEW_HEADING_ID}
      data-testid="crrt-rapid-drill-review"
      data-reviewer-only="false"
      data-review-status="pending"
      data-learner-runnable="true"
      data-scoring="cause-first"
      data-analytics="allowlisted"
      data-progress-write="learner-mode-only"
      data-persistence="learner-mode-only"
      data-competency="none"
      data-correction-verification={state.correctionVerified ? 'reviewed' : 'not-reviewed'}
    >
      <header className={styles.header}>
        <div>
          <span>Cause-first safety drills</span>
          <h2 id={REVIEW_HEADING_ID}>Rapid drills</h2>
        </div>
        <strong>5 runnable drills</strong>
      </header>

      <div className={styles.boundary} role="note" aria-labelledby={REVIEW_BOUNDARY_ID}>
        <p>
          <strong id={REVIEW_BOUNDARY_ID}>Educational cause-first practice.</strong> These simulated
          drills teach assessment, inspection, verification, reassessment, and escalation. They do
          not supply local alarm thresholds, correction procedures, restart rules, or
          blood-disposition instructions. Device instructions, local policy, and clinical judgment
          remain authoritative.
        </p>
      </div>

      <div className={styles.selector}>
        <label htmlFor="baxter-crrt-rapid-drill-candidate">Rapid drill</label>
        <select
          id="baxter-crrt-rapid-drill-candidate"
          value={state.drillId}
          onChange={(event) => selectDrill(event.target.value)}
        >
          {baxterCrrtReviewerRapidDrills.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.id} · {candidate.title}
            </option>
          ))}
        </select>
      </div>

      <fieldset className={styles.prediction} disabled={state.faultRevealed}>
        <legend>Predict the likely cause before the case signal is revealed</legend>
        <p>{drill.predictionPrompt}</p>
        <div className={styles.options}>
          {drill.predictionOptions.map((option) => (
            <label key={option.id}>
              <input
                type="radio"
                name="baxter-crrt-rapid-drill-prediction"
                value={option.id}
                checked={draftPredictionOptionId === option.id}
                onChange={(event) => setDraftPredictionOptionId(event.target.value)}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={!draftPredictionOptionId || state.faultRevealed}
          onClick={commitPrediction}
        >
          Submit prediction
        </button>
      </fieldset>

      {!state.faultRevealed ? (
        <p className={styles.hiddenState} role="status">
          Submit a prediction to reveal the case signal and response sequence.
        </p>
      ) : (
        <>
          <section className={styles.signal} aria-labelledby="baxter-crrt-case-signal-heading">
            <h3 id="baxter-crrt-case-signal-heading">Case signal</h3>
            <p>{drill.openingSignal}</p>
            <dl>
              <div>
                <dt>Your prediction</dt>
                <dd>{selectedPrediction?.label}</dd>
              </div>
              <div>
                <dt>Recommended first response</dt>
                <dd>{candidatePrediction?.label}</dd>
              </div>
            </dl>
            <p className={styles.deviceBoundary}>{drill.deviceResponseBoundary}</p>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={state.acknowledged}
              onClick={() => dispatch({ type: 'ACKNOWLEDGE_SIGNAL' })}
            >
              {state.acknowledged ? 'Signal acknowledged' : 'Acknowledge signal'}
            </button>
            {state.acknowledged ? (
              <p className={styles.acknowledgement} role="status">
                Signal acknowledged. Acknowledgement does not correct the cause or authorize
                continuation.
              </p>
            ) : null}
          </section>

          <section
            className={styles.sequence}
            aria-labelledby="baxter-crrt-cause-first-sequence-heading"
          >
            <div className={styles.sequenceHeader}>
              <div>
                <span>Cause-first sequence</span>
                <h3 id="baxter-crrt-cause-first-sequence-heading">
                  Complete each safety step in order
                </h3>
              </div>
              <strong>
                {state.completedStepIds.length}/{CRRT_CAUSE_FIRST_STEPS.length} complete
              </strong>
            </div>

            <ol>
              {CRRT_CAUSE_FIRST_STEPS.map((step, index) => {
                const completed = index < nextStepIndex
                const current = index === nextStepIndex
                return (
                  <li
                    key={step.id}
                    data-step-status={completed ? 'complete' : current ? 'current' : 'locked'}
                  >
                    <div>
                      <strong>{step.label}</strong>
                      <p>{step.reviewerBoundary}</p>
                      {step.id === 'inspect-corresponding-domain' ? (
                        <small>Inspection domain: {drill.inspectionDomain}.</small>
                      ) : null}
                      {step.id === 'verify-cause-corrected' ? (
                        <small>{drill.correctionBoundary}</small>
                      ) : null}
                      {step.id === 'reassess-delivery-and-patient' ? (
                        <small>Reassessment domain: {drill.reassessmentDomain}.</small>
                      ) : null}
                    </div>
                    {completed ? (
                      <span className={styles.reviewed}>Complete</span>
                    ) : (
                      <button
                        type="button"
                        disabled={!current}
                        onClick={() => dispatch({ type: 'COMPLETE_NEXT_STEP' })}
                      >
                        {current ? `Complete: ${step.label}` : `Locked: ${step.label}`}
                      </button>
                    )}
                  </li>
                )
              })}
            </ol>
          </section>
        </>
      )}

      <div className={styles.footer}>
        <p aria-live="polite">
          {state.faultRevealed
            ? `${state.completedStepIds.length} of ${CRRT_CAUSE_FIRST_STEPS.length} steps complete. Outcome: ${state.outcome}. Correction ${state.correctionVerified ? 'verified' : 'not yet verified'}.`
            : 'No rapid-drill action has been recorded.'}
        </p>
        <button type="button" onClick={resetPreview}>
          Reset drill
        </button>
      </div>
    </section>
  )
}
