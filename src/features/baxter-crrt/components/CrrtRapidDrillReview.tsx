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
      data-reviewer-only="true"
      data-review-status="pending"
      data-learner-runnable="false"
      data-scoring="none"
      data-analytics="none"
      data-progress-write="none"
      data-persistence="none"
      data-competency="none"
      data-correction-verification={state.correctionVerified ? 'reviewed' : 'not-reviewed'}
    >
      <header className={styles.header}>
        <div>
          <span>Phase 7 safety review</span>
          <h2 id={REVIEW_HEADING_ID}>Reviewer-only rapid-drill previews</h2>
        </div>
        <strong>Pending review</strong>
      </header>

      <div className={styles.boundary} role="note" aria-labelledby={REVIEW_BOUNDARY_ID}>
        <p>
          <strong id={REVIEW_BOUNDARY_ID}>Non-actionable reviewer prototype.</strong> These
          synthetic previews test cause-first structure only. They provide no alarm threshold,
          device correction sequence, restart authorization, score, analytics, saved progress, or
          competency credit. The device manual, approved local policy, and clinical judgment remain
          authoritative.
        </p>
      </div>

      <div className={styles.selector}>
        <label htmlFor="baxter-crrt-rapid-drill-candidate">Rapid-drill reviewer candidate</label>
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

      <dl className={styles.metadata} aria-label="Current rapid-drill review metadata">
        <div>
          <dt>Candidate</dt>
          <dd>{drill.id}</dd>
        </div>
        <div>
          <dt>Audience</dt>
          <dd>Reviewer only</dd>
        </div>
        <div>
          <dt>Disposition</dt>
          <dd>{drill.reviewStatus}</dd>
        </div>
        <div>
          <dt>Learner runtime</dt>
          <dd>Locked</dd>
        </div>
      </dl>

      <div className={styles.sourceRecords}>
        <strong>Pending source records</strong>
        <p>{drill.sourceRecordIds.join(' · ')}</p>
        <small>
          Source linkage supports traceability; it does not approve the generic signal, sequence, or
          candidate framing.
        </small>
      </div>

      <fieldset className={styles.prediction} disabled={state.faultRevealed}>
        <legend>Commit a prediction before the synthetic signal is revealed</legend>
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
          Commit reviewer prediction
        </button>
      </fieldset>

      {!state.faultRevealed ? (
        <p className={styles.hiddenState} role="status">
          Prediction not committed. The synthetic signal and all review actions remain hidden.
        </p>
      ) : (
        <>
          <section className={styles.signal} aria-labelledby="baxter-crrt-synthetic-signal-heading">
            <h3 id="baxter-crrt-synthetic-signal-heading">Synthetic signal review</h3>
            <p>{drill.openingSignal}</p>
            <dl>
              <div>
                <dt>Committed prediction</dt>
                <dd>{selectedPrediction?.label}</dd>
              </div>
              <div>
                <dt>Candidate cause-first framing</dt>
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
              {state.acknowledged
                ? 'Signal acknowledged for review'
                : 'Acknowledge signal for review'}
            </button>
            {state.acknowledged ? (
              <p className={styles.acknowledgement} role="status">
                Signal acknowledged for review. Acknowledgement does not correct the cause or
                authorize continuation.
              </p>
            ) : null}
          </section>

          <section
            className={styles.sequence}
            aria-labelledby="baxter-crrt-cause-first-sequence-heading"
          >
            <div className={styles.sequenceHeader}>
              <div>
                <span>Cause-first review sequence</span>
                <h3 id="baxter-crrt-cause-first-sequence-heading">
                  Review each gate in the required order
                </h3>
              </div>
              <strong>
                {state.completedStepIds.length}/{CRRT_CAUSE_FIRST_STEPS.length} reviewed
              </strong>
            </div>

            <ol>
              {CRRT_CAUSE_FIRST_STEPS.map((step, index) => {
                const completed = index < nextStepIndex
                const current = index === nextStepIndex
                return (
                  <li
                    key={step.id}
                    data-step-status={completed ? 'reviewed' : current ? 'current' : 'locked'}
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
                      <span className={styles.reviewed}>Reviewed</span>
                    ) : (
                      <button
                        type="button"
                        disabled={!current}
                        onClick={() => dispatch({ type: 'COMPLETE_NEXT_STEP' })}
                      >
                        {current ? `Mark reviewed: ${step.label}` : `Locked: ${step.label}`}
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
            ? `${state.completedStepIds.length} of ${CRRT_CAUSE_FIRST_STEPS.length} review gates complete. Correction-verification gate ${state.correctionVerified ? 'reviewed' : 'not reviewed'}.`
            : 'No rapid-drill review action has been recorded.'}
        </p>
        <button type="button" onClick={resetPreview}>
          Reset drill preview
        </button>
      </div>
    </section>
  )
}
