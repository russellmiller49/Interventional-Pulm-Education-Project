'use client'

import { useState } from 'react'
import {
  ChevronRight,
  ClipboardList,
  FileWarning,
  FlaskConical,
  Gauge,
  LockKeyhole,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react'

import {
  baxterCrrtCaseCatalog,
  baxterCrrtInstructionalToolManifest,
  baxterCrrtMasteryManifest,
  baxterCrrtRapidDrillManifest,
  type CrrtActivationState,
} from '../content'
import { CrrtPhase7InstructionalTools } from './CrrtPhase7InstructionalTools'
import { CrrtPhase7CaseReview } from './CrrtPhase7CaseReview'
import { CrrtMasteryReviewPlanner } from './CrrtMasteryReviewPlanner'
import { CrrtPhase7PrescriptionWorkbench } from './CrrtPrescriptionWorkbench'
import { CrrtPressureLocalizationLab } from './CrrtPressureLocalizationLab'
import { CrrtRapidDrillReview } from './CrrtRapidDrillReview'
import styles from './baxter-crrt.module.css'

const activationLabels: Readonly<Record<CrrtActivationState, string>> = Object.freeze({
  'protected-pilot-active': 'Protected pilot runtime',
  'manifest-only': 'Manifest only · review gated',
  'draft-reviewer-only': 'Reviewer-only draft',
  'protocol-blocked': 'Protocol blocked',
  'policy-blocked': 'Local policy blocked',
  'learner-active': 'Learner active',
})

const stations = [1, 2, 3, 4, 5, 6] as const

export function CrrtPhase7ReviewPanel() {
  const [reviewerCasesOpen, setReviewerCasesOpen] = useState(false)
  const [reviewerToolsOpen, setReviewerToolsOpen] = useState(false)
  const runtimeCount = baxterCrrtCaseCatalog.filter((entry) => entry.runtimeAvailable).length
  const reviewerCaseCount = baxterCrrtCaseCatalog.filter(
    (entry) => entry.reviewerRuntimeAvailable,
  ).length
  const reviewerToolCount = baxterCrrtInstructionalToolManifest.filter(
    (tool) => tool.reviewerRuntimeAvailable,
  ).length
  const protocolBlockedCount = baxterCrrtCaseCatalog.filter(
    (entry) => entry.activationState === 'protocol-blocked',
  ).length
  const reviewerDrillCount = baxterCrrtRapidDrillManifest.filter(
    (drill) => drill.reviewerPreviewAvailable,
  ).length

  return (
    <section className={styles.phase7Section} aria-labelledby="baxter-crrt-phase7-heading">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.kicker}>Phase 7 development registry</span>
          <h2 id="baxter-crrt-phase7-heading">Full PrisMax curriculum—mapped, not activated</h2>
        </div>
        <span className={styles.phase7DraftBadge}>
          <ClipboardList aria-hidden="true" /> Draft development authorized
        </span>
      </div>

      <div className={styles.phase7Boundary} role="note">
        <FileWarning aria-hidden="true" />
        <div>
          <strong>Authorization to build is not clinical or device approval.</strong>
          <p>
            The complete curriculum, instructional-tool, rapid-drill, and Mastery identifiers are
            enforced in code. Three protected pilot cases remain the entire learner runtime. Seven
            additional synthetic cases and selected tools can run only as pending reviewer
            candidates; they cannot enter learner selection, learner scoring, saved progress, or
            competency.
          </p>
        </div>
      </div>

      <dl className={styles.phase7Metrics}>
        <div>
          <dt>Curriculum registry</dt>
          <dd>{baxterCrrtCaseCatalog.length} / 18 cases</dd>
        </div>
        <div>
          <dt>Protected runtime</dt>
          <dd>{runtimeCount} pilot cases</dd>
        </div>
        <div>
          <dt>Reviewer candidates</dt>
          <dd>{reviewerCaseCount} cases · not learner-active</dd>
        </div>
        <div>
          <dt>Protocol blocked</dt>
          <dd>{protocolBlockedCount} cases</dd>
        </div>
        <div>
          <dt>Rapid drills</dt>
          <dd>
            {baxterCrrtRapidDrillManifest.length} mapped · {reviewerDrillCount} review previews · 0
            learner-active
          </dd>
        </div>
      </dl>

      <details
        className={styles.phase7ReviewerToolsDisclosure}
        data-reviewer-only="true"
        data-analytics="none"
        data-progress-write="none"
        data-scoring="candidate-preview-only"
        data-competency="none"
        onToggle={(event) => setReviewerCasesOpen(event.currentTarget.open)}
      >
        <summary
          aria-controls="baxter-crrt-phase7-reviewer-cases"
          onClick={() => setReviewerCasesOpen((current) => !current)}
        >
          <ChevronRight className={styles.phase7DisclosureIcon} aria-hidden="true" />
          <div>
            <span>Reviewer-only case candidates</span>
            <strong>{reviewerCaseCount} interactive synthetic cases · pending review</strong>
          </div>
          <small>
            <Stethoscope aria-hidden="true" /> No learner selection or saved result
          </small>
        </summary>
        <div id="baxter-crrt-phase7-reviewer-cases" className={styles.phase7ReviewerToolsContent}>
          {reviewerCasesOpen ? <CrrtPhase7CaseReview /> : null}
        </div>
      </details>

      <details
        className={styles.phase7ReviewerToolsDisclosure}
        data-reviewer-only="true"
        data-analytics="none"
        data-progress-write="none"
        data-scoring="none"
        data-competency="none"
        onToggle={(event) => setReviewerToolsOpen(event.currentTarget.open)}
      >
        <summary
          aria-controls="baxter-crrt-phase7-reviewer-tools"
          onClick={() => setReviewerToolsOpen((current) => !current)}
        >
          <ChevronRight className={styles.phase7DisclosureIcon} aria-hidden="true" />
          <div>
            <span>Reviewer-only instructional tools</span>
            <strong>{reviewerToolCount} bounded lab candidates · pending review</strong>
          </div>
          <small>
            <FlaskConical aria-hidden="true" /> No score, progress, or competency
          </small>
        </summary>
        <div id="baxter-crrt-phase7-reviewer-tools" className={styles.phase7ReviewerToolsContent}>
          {reviewerToolsOpen ? (
            <>
              <CrrtPhase7InstructionalTools />
              <CrrtPhase7PrescriptionWorkbench />
              <CrrtPressureLocalizationLab />
            </>
          ) : null}
        </div>
      </details>

      <details
        className={styles.phase7ReviewerToolsDisclosure}
        data-reviewer-only="true"
        data-analytics="none"
        data-progress-write="none"
        data-scoring="none"
        data-competency="none"
      >
        <summary aria-controls="baxter-crrt-phase7-reviewer-drills">
          <ChevronRight className={styles.phase7DisclosureIcon} aria-hidden="true" />
          <div>
            <span>Reviewer-only rapid-drill previews</span>
            <strong>{reviewerDrillCount} cause-first synthetic previews · pending review</strong>
          </div>
          <small>
            <ShieldCheck aria-hidden="true" /> Acknowledgement never means correction
          </small>
        </summary>
        <div id="baxter-crrt-phase7-reviewer-drills" className={styles.phase7ReviewerToolsContent}>
          <CrrtRapidDrillReview />
        </div>
      </details>

      <details
        className={styles.phase7ReviewerToolsDisclosure}
        data-reviewer-only="true"
        data-analytics="none"
        data-progress-write="none"
        data-scoring="none"
        data-competency="none"
      >
        <summary aria-controls="baxter-crrt-phase7-mastery-planner">
          <ChevronRight className={styles.phase7DisclosureIcon} aria-hidden="true" />
          <div>
            <span>Reviewer-only Mastery composition planner</span>
            <strong>Theme planner only · no capstone runtime or score</strong>
          </div>
          <small>
            <Gauge aria-hidden="true" /> Candidate rules remain unapproved
          </small>
        </summary>
        <div id="baxter-crrt-phase7-mastery-planner" className={styles.phase7ReviewerToolsContent}>
          <CrrtMasteryReviewPlanner />
        </div>
      </details>

      <div
        className={styles.phase7StationList}
        role="group"
        aria-label="Phase 7 curriculum stations"
      >
        {stations.map((station) => {
          const entries = baxterCrrtCaseCatalog.filter((entry) => entry.station === station)
          const summaryId = `baxter-crrt-phase7-station-${station}-summary`
          const caseGroupId = `baxter-crrt-phase7-station-${station}-cases`
          return (
            <details key={station} open={station === 1}>
              <summary id={summaryId} aria-controls={caseGroupId}>
                <ChevronRight className={styles.phase7DisclosureIcon} aria-hidden="true" />
                <span>Station {station}</span>
                <strong>{entries[0]?.stationLabel}</strong>
                <small>{entries.length} cases</small>
              </summary>
              <div
                id={caseGroupId}
                className={styles.phase7CaseGrid}
                role="group"
                aria-labelledby={summaryId}
              >
                {entries.map((entry) => (
                  <article key={entry.id} data-state={entry.activationState}>
                    <div>
                      <span>{entry.id}</span>
                      <em>{activationLabels[entry.activationState]}</em>
                    </div>
                    <h3>{entry.title}</h3>
                    <p>{entry.focus}</p>
                    <dl>
                      <div>
                        <dt>Sources</dt>
                        <dd>{entry.sourceRecordIds.join(', ')}</dd>
                      </div>
                      <div>
                        <dt>Review</dt>
                        <dd>
                          {entry.requiredReviews.length} domains · all {entry.reviewStatus}
                        </dd>
                      </div>
                    </dl>
                    {entry.blockingInputs.length > 0 ? (
                      <p className={styles.phase7Blocker}>
                        <LockKeyhole aria-hidden="true" /> {entry.blockingInputs.join(' ')}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </details>
          )
        })}
      </div>

      <div className={styles.phase7LowerGrid}>
        <section aria-labelledby="baxter-crrt-drills-heading">
          <div className={styles.phase7Subheading}>
            <ShieldCheck aria-hidden="true" />
            <div>
              <span>Rapid safety drills</span>
              <h3 id="baxter-crrt-drills-heading">Stable IDs, fail-closed activation</h3>
            </div>
          </div>
          <ul className={styles.phase7DrillList}>
            {baxterCrrtRapidDrillManifest.map((drill) => (
              <li key={drill.id}>
                <div>
                  <strong>{drill.title}</strong>
                  <small>{drill.id}</small>
                </div>
                <span>{activationLabels[drill.activationState]}</span>
                <p>{drill.reviewQuestion}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="baxter-crrt-mastery-heading">
          <div className={styles.phase7Subheading}>
            <Gauge aria-hidden="true" />
            <div>
              <span>Mastery capstone</span>
              <h3 id="baxter-crrt-mastery-heading">
                {baxterCrrtMasteryManifest.learnerTitleBeforeDebrief}
              </h3>
            </div>
          </div>
          <div className={styles.phase7MasteryCard}>
            <p>
              The engine rejects Mastery session creation, scoring, and persistence while the
              approved runtime/capstone registry is empty. No reviewed multi-hit runtime case
              exists.
            </p>
            <ul>
              <li>At least {baxterCrrtMasteryManifest.minimumProblemDomains} problem domains</li>
              <li>Candidate score ≥ {baxterCrrtMasteryManifest.minimumScoreCandidate}%</li>
              <li>No candidate critical error</li>
              <li>Required reassessment and clean state</li>
            </ul>
            <p className={styles.phase7Blocker}>
              <LockKeyhole aria-hidden="true" />{' '}
              {baxterCrrtMasteryManifest.blockingInputs.join(' ')}
            </p>
          </div>
        </section>
      </div>
    </section>
  )
}
