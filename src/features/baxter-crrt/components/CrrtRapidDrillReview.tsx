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

/**
 * What each authored disposition is called once it may be shown (F-07). The words carry the
 * verdict; a style is only a secondary cue.
 */
const dispositionWords = {
  safe: 'Accepted first response',
  'accepted-alternative': 'Also accepted',
  unsafe: 'Unsafe',
} as const

/**
 * Five worked safety examples, each with an optional try first (CRRT-FELLOW-04, F-07).
 *
 * The drill asks for a first response, so its heading asks for one — it used to say "Predict
 * the likely cause". Before a choice or a reveal the options show only what each response does;
 * the authored verdict for each ("Safe path…", "Accepted alternative…", "Unsafe because…") now
 * appears in the worked comparison after the learner checks a response or opens the example.
 * Nothing is hidden behind an answer: the worked example is one click away at any time. Options
 * keep their authored order and wording; no option is rewritten to look safer or more tempting,
 * and nothing is scored, counted or saved.
 */
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
  const acceptedFirst = drill.predictionOptions.find(
    (option) => option.id === drill.candidateCauseOptionId,
  )
  const alsoAccepted = drill.predictionOptions.find(
    (option) => option.id === drill.acceptedAlternativeOptionId,
  )
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
      data-scoring="none"
      data-analytics="none"
      data-progress-write="none"
      data-persistence="none"
      data-correction-verification={state.correctionVerified ? 'reviewed' : 'not-reviewed'}
    >
      <header className={styles.header}>
        <div>
          <span>Worked safety examples · optional try first</span>
          <h2 id={REVIEW_HEADING_ID}>Rapid drills</h2>
        </div>
        <strong>5 drills</strong>
      </header>

      <div className={styles.boundary} role="note" aria-labelledby={REVIEW_BOUNDARY_ID}>
        <p>
          <strong id={REVIEW_BOUNDARY_ID}>Educational cause-first practice.</strong> Each drill is a
          worked safety example. You can choose a first response and check it, or open the worked
          example straight away. They teach patient review, inspection, verification, reassessment,
          and escalation. They do not supply local alarm thresholds, correction procedures, restart
          rules, or blood-disposition instructions. Device instructions, local policy, and clinical
          judgment remain authoritative.
        </p>
      </div>

      <div className={styles.selector}>
        <label htmlFor="baxter-crrt-rapid-drill-candidate">Rapid drill</label>
        <select
          id="baxter-crrt-rapid-drill-candidate"
          value={state.drillId}
          onChange={(event) => selectDrill(event.target.value)}
        >
          {baxterCrrtReviewerRapidDrills.map((candidate, index) => (
            <option key={candidate.id} value={candidate.id}>
              Drill {index + 1} · {candidate.title}
            </option>
          ))}
        </select>
      </div>

      <fieldset className={styles.prediction} disabled={state.faultRevealed}>
        <legend>Optional try: choose a first response before the worked example</legend>
        <p>{drill.predictionPrompt}</p>
        <div className={styles.options}>
          {drill.predictionOptions.map((option) => (
            <label key={option.id} data-disposition-shown={state.faultRevealed || undefined}>
              <input
                type="radio"
                name="baxter-crrt-rapid-drill-prediction"
                value={option.id}
                checked={(state.predictionOptionId ?? draftPredictionOptionId) === option.id}
                onChange={(event) => setDraftPredictionOptionId(event.target.value)}
              />
              <span>
                <strong>{option.label}</strong>
                {state.faultRevealed ? (
                  <small data-disposition={option.disposition}>{option.description}</small>
                ) : null}
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
          Check this response
        </button>
      </fieldset>

      {!state.faultRevealed ? (
        <button type="button" onClick={() => dispatch({ type: 'REVEAL_EXAMPLE' })}>
          Show worked safety example
        </button>
      ) : null}
      {!state.faultRevealed ? (
        <p className={styles.hiddenState} role="status">
          Optional try: choose a response and check it, or open the worked safety example first.
        </p>
      ) : (
        <>
          <section className={styles.signal} aria-labelledby="baxter-crrt-case-signal-heading">
            <h3 id="baxter-crrt-case-signal-heading">Worked safety example</h3>
            <p>{drill.openingSignal}</p>
            <dl>
              <div>
                <dt>Your choice</dt>
                <dd data-chosen-disposition={selectedPrediction?.disposition ?? 'none'}>
                  {selectedPrediction ? (
                    <>
                      {selectedPrediction.label}
                      <strong className={styles.verdict}>
                        {' '}
                        — {dispositionWords[selectedPrediction.disposition]}
                      </strong>
                    </>
                  ) : (
                    'No response chosen'
                  )}
                </dd>
              </div>
              <div>
                <dt>Accepted first response</dt>
                <dd>{acceptedFirst?.label}</dd>
              </div>
              {alsoAccepted ? (
                <div>
                  <dt>Also accepted</dt>
                  <dd>{alsoAccepted.label}</dd>
                </div>
              ) : null}
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
                Signal acknowledged. Acknowledgement does not resolve the cause or authorize
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
                <h3 id="baxter-crrt-cause-first-sequence-heading">Review the safety sequence</h3>
              </div>
              <strong>
                {state.completedStepIds.length === 0
                  ? 'Ready to review'
                  : state.completedStepIds.length === CRRT_CAUSE_FIRST_STEPS.length
                    ? 'Sequence worked through'
                    : 'Continue with the next safety step'}
              </strong>
            </div>

            <ol>
              {CRRT_CAUSE_FIRST_STEPS.map((step) => {
                const completed = state.completedStepIds.includes(step.id)
                return (
                  <li key={step.id} data-step-status={completed ? 'complete' : 'available'}>
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
                        onClick={() => dispatch({ type: 'REVIEW_STEP', stepId: step.id })}
                      >
                        Review: {step.label}
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
            ? 'Worked example available. Reviewing steps does not verify cause correction or perform a device action.'
            : 'No rapid-drill action has been recorded.'}
        </p>
        <div className={styles.resetGroup}>
          <button
            type="button"
            onClick={resetPreview}
            aria-describedby="baxter-crrt-drill-reset-scope"
          >
            Reset this drill
          </button>
          <p id="baxter-crrt-drill-reset-scope" className={styles.resetScope}>
            Clears your choice, the worked example and the reviewed steps for this drill only.
            Nothing else changes, and nothing is saved.
          </p>
        </div>
      </div>
    </section>
  )
}
