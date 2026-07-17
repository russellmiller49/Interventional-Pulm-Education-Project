'use client'

import { ClipboardList, FileWarning, LockKeyhole, RotateCcw, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  baxterCrrtMasteryReviewPlanner,
  createBaxterCrrtMasteryCompositionPreview,
  type BaxterCrrtMasteryReviewCaseId,
} from '../content/masteryReviewPlanner'
import styles from './crrt-mastery-review-planner.module.css'

export function CrrtMasteryReviewPlanner() {
  const [selectedCaseIds, setSelectedCaseIds] = useState<readonly BaxterCrrtMasteryReviewCaseId[]>(
    [],
  )
  const preview = useMemo(
    () => createBaxterCrrtMasteryCompositionPreview(selectedCaseIds),
    [selectedCaseIds],
  )

  function toggleCase(caseId: BaxterCrrtMasteryReviewCaseId) {
    setSelectedCaseIds((current) =>
      current.includes(caseId)
        ? current.filter((candidateId) => candidateId !== caseId)
        : [...current, caseId],
    )
  }

  return (
    <section
      className={styles.planner}
      aria-labelledby="baxter-crrt-mastery-review-planner-heading"
      data-testid="crrt-mastery-review-planner"
      data-reviewer-only="true"
      data-review-status={baxterCrrtMasteryReviewPlanner.reviewStatus}
      data-rule-status={baxterCrrtMasteryReviewPlanner.ruleSetApprovalState}
      data-capstone-runtime="none"
      data-session-creation="none"
      data-scoring="none"
      data-analytics="none"
      data-progress-write="none"
      data-persistence="none"
      data-competency="none"
      data-learner-selection="none"
    >
      <header className={styles.header}>
        <div>
          <span>Phase 7 Mastery review</span>
          <h2 id="baxter-crrt-mastery-review-planner-heading">
            Reviewer-only capstone composition planner
          </h2>
        </div>
        <strong>
          <ClipboardList aria-hidden="true" /> Pending review
        </strong>
      </header>

      <div
        className={styles.boundary}
        role="note"
        aria-labelledby="baxter-crrt-mastery-review-planner-boundary-heading"
      >
        <FileWarning aria-hidden="true" />
        <p>
          <strong id="baxter-crrt-mastery-review-planner-boundary-heading">
            Composition preview—not a Mastery session.
          </strong>{' '}
          This planner only groups themes from pending reviewer cases. It creates no capstone
          runtime, score, attempt, analytics, progress, local storage, competency, or learner
          activity.
        </p>
      </div>

      <dl className={styles.metadata} aria-label="Mastery composition planner metadata">
        <div>
          <dt>Planner</dt>
          <dd>{baxterCrrtMasteryReviewPlanner.id}</dd>
        </div>
        <div>
          <dt>Audience</dt>
          <dd>Reviewer only</dd>
        </div>
        <div>
          <dt>Content version</dt>
          <dd>{baxterCrrtMasteryReviewPlanner.contentVersion}</dd>
        </div>
        <div>
          <dt>Capstone identity</dt>
          <dd>Not authored</dd>
        </div>
      </dl>

      <div className={styles.sourceNote} aria-label="Mastery planner source record">
        <ShieldCheck aria-hidden="true" />
        <div>
          <strong>Product-requirement source</strong>
          <p>{baxterCrrtMasteryReviewPlanner.sourceRecordIds.join(' · ')}</p>
          <small>
            This pending source records candidate design requirements; it does not approve a rule,
            score, critical error, or capstone.
          </small>
        </div>
      </div>

      <section
        className={styles.rules}
        aria-labelledby="baxter-crrt-mastery-candidate-rules-heading"
      >
        <div className={styles.sectionHeading}>
          <div>
            <span>Frozen requirements</span>
            <h3 id="baxter-crrt-mastery-candidate-rules-heading">Unapproved candidate rules</h3>
          </div>
          <small>{baxterCrrtMasteryReviewPlanner.candidateRules.length} rules</small>
        </div>
        <ul>
          {baxterCrrtMasteryReviewPlanner.candidateRules.map((rule) => (
            <li key={rule.id}>
              <div>
                <strong>{rule.label}</strong>
                <span>Unapproved candidate rule</span>
              </div>
              <p>{rule.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        className={styles.composer}
        aria-labelledby="baxter-crrt-mastery-composition-heading"
      >
        <div className={styles.sectionHeading}>
          <div>
            <span>Theme selection</span>
            <h3 id="baxter-crrt-mastery-composition-heading">Draft a multi-domain review brief</h3>
          </div>
          <small>Ephemeral UI state</small>
        </div>
        <p className={styles.intro}>
          Select source candidates from at least two primary problem domains. Their titles and
          runtime definitions remain review inputs only; they do not become Mastery case IDs.
        </p>

        <fieldset className={styles.caseFieldset}>
          <legend>Pending reviewer case themes</legend>
          <div className={styles.caseGrid}>
            {baxterCrrtMasteryReviewPlanner.candidateCases.map((candidate) => {
              const checked = selectedCaseIds.includes(candidate.caseId)
              return (
                <label key={candidate.caseId} className={styles.caseChoice}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCase(candidate.caseId)}
                  />
                  <span>
                    <strong>{candidate.caseId}</strong>
                    <b>{candidate.title}</b>
                    <small>{candidate.primaryProblemDomainLabel}</small>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <section
          className={styles.preview}
          aria-labelledby="baxter-crrt-mastery-composition-preview-heading"
          aria-live="polite"
        >
          <div className={styles.previewHeader}>
            <div>
              <span>Review brief preview</span>
              <h4 id="baxter-crrt-mastery-composition-preview-heading">
                {preview.selectedCaseCount} source candidate
                {preview.selectedCaseCount === 1 ? '' : 's'} · {preview.selectedProblemDomainCount}{' '}
                problem domain{preview.selectedProblemDomainCount === 1 ? '' : 's'}
              </h4>
            </div>
            {selectedCaseIds.length > 0 ? (
              <button type="button" onClick={() => setSelectedCaseIds([])}>
                <RotateCcw aria-hidden="true" /> Clear draft
              </button>
            ) : null}
          </div>

          {preview.minimumProblemDomainsRepresented ? (
            <p className={styles.minimumMet}>
              <ShieldCheck aria-hidden="true" /> The candidate minimum of{' '}
              {preview.minimumProblemDomainsCandidate} problem domains is represented for reviewer
              discussion only.
            </p>
          ) : (
            <p className={styles.minimumPending}>
              <LockKeyhole aria-hidden="true" /> Select themes from at least{' '}
              {preview.minimumProblemDomainsCandidate} primary problem domains. This will not unlock
              Mastery.
            </p>
          )}

          {preview.selectedCases.length > 0 ? (
            <ul className={styles.selectedList}>
              {preview.selectedCases.map((candidate) => (
                <li key={candidate.caseId}>
                  <strong>{candidate.caseId}</strong>
                  <span>{candidate.primaryProblemDomainLabel}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>No themes selected.</p>
          )}

          <p className={styles.runtimeBoundary}>
            No capstone runtime is created. A newly authored, independently reviewed integrated case
            is still required.
          </p>
        </section>
      </section>

      <section className={styles.blockers} aria-labelledby="baxter-crrt-mastery-blockers-heading">
        <div>
          <LockKeyhole aria-hidden="true" />
          <h3 id="baxter-crrt-mastery-blockers-heading">Activation remains locked</h3>
        </div>
        <ul>
          {baxterCrrtMasteryReviewPlanner.blockingInputs.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      </section>
    </section>
  )
}
