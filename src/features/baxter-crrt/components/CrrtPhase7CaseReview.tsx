'use client'

import { ClipboardCheck, FileWarning, ShieldCheck } from 'lucide-react'
import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from 'react'

import { baxterCrrtPhase7ReviewCases, type RuntimeCrrtCase } from '../content'
import { createCrrtLearningSession, crrtLearningSessionReducer, type CrrtRoleLens } from '../engine'
import {
  CrrtLearningWorkflow,
  CrrtReasoningRibbon,
  type CrrtMobileSurface,
} from './CrrtLearningWorkflow'
import styles from './crrt-phase7-case-review.module.css'

const REVIEW_ID_NAMESPACE = 'baxter-crrt-phase7-review'
const reviewCases = baxterCrrtPhase7ReviewCases.cases
const initialReviewCase = reviewCases[0]

const reviewSurfaces = [
  { id: 'case', label: 'Case and reasoning' },
  { id: 'debrief', label: 'Candidate debrief' },
] as const satisfies readonly {
  readonly id: Extract<CrrtMobileSurface, 'case' | 'debrief'>
  readonly label: string
}[]

function reviewWorkflowId(id: string): string {
  return `${REVIEW_ID_NAMESPACE}-${id}`
}

function createReviewerSession(
  caseDefinition: RuntimeCrrtCase,
  roleLens: CrrtRoleLens,
  attempt: number,
) {
  return createCrrtLearningSession({
    caseDefinition,
    experience: 'practice',
    roleLens,
    attempt,
    audience: 'reviewer',
  })
}

export function CrrtPhase7CaseReview() {
  const [session, dispatch] = useReducer(crrtLearningSessionReducer, undefined, () =>
    createReviewerSession(initialReviewCase, 'integrated', 1),
  )
  const [mobileSurface, setMobileSurface] = useState<CrrtMobileSurface>('case')
  const [workflowFocusRequest, setWorkflowFocusRequest] = useState(0)
  const workflowHeadingRef = useRef<HTMLHeadingElement>(null)
  const tabRefs = useRef<
    Partial<Record<Extract<CrrtMobileSurface, 'case' | 'debrief'>, HTMLButtonElement | null>>
  >({})

  useEffect(() => {
    if (workflowFocusRequest > 0) workflowHeadingRef.current?.focus()
  }, [workflowFocusRequest])

  function loadCase(caseDefinition: RuntimeCrrtCase, roleLens: CrrtRoleLens) {
    dispatch({
      type: 'LOAD_CASE',
      caseDefinition,
      experience: 'practice',
      roleLens,
      attempt: 1,
      audience: 'reviewer',
    })
    setMobileSurface('case')
    setWorkflowFocusRequest((request) => request + 1)
  }

  function handleCaseChange(caseId: string) {
    const caseDefinition = reviewCases.find((candidate) => candidate.id === caseId)
    if (!caseDefinition) return
    loadCase(caseDefinition, session.roleLens)
  }

  function handleRoleChange(roleLens: CrrtRoleLens) {
    loadCase(session.caseDefinition, roleLens)
  }

  function handleReset() {
    dispatch({ type: 'RESET', attempt: session.attempt + 1 })
    setMobileSurface('case')
    setWorkflowFocusRequest((request) => request + 1)
  }

  function selectAndFocusSurface(surface: Extract<CrrtMobileSurface, 'case' | 'debrief'>) {
    setMobileSurface(surface)
    tabRefs.current[surface]?.focus()
  }

  function handleSurfaceKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    surface: Extract<CrrtMobileSurface, 'case' | 'debrief'>,
  ) {
    const currentIndex = reviewSurfaces.findIndex((candidate) => candidate.id === surface)
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % reviewSurfaces.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + reviewSurfaces.length) % reviewSurfaces.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = reviewSurfaces.length - 1
    }
    if (nextIndex === null) return
    event.preventDefault()
    selectAndFocusSurface(reviewSurfaces[nextIndex].id)
  }

  return (
    <section
      className={styles.caseReview}
      aria-labelledby="baxter-crrt-phase7-case-review-heading"
      data-testid="crrt-phase7-case-review"
      data-reviewer-only="true"
      data-review-status="pending"
      data-runtime-audience={session.audience}
      data-scoring="candidate-preview-only"
      data-analytics="none"
      data-progress-write="none"
      data-persistence="none"
      data-competency="none"
      data-learner-selection="none"
    >
      <header className={styles.header}>
        <div>
          <span>Phase 7 candidate exercise</span>
          <h2
            ref={workflowHeadingRef}
            id="baxter-crrt-phase7-case-review-heading"
            tabIndex={-1}
            aria-label={`Reviewer-only interactive case runner. ${session.caseDefinition.id}. Attempt ${session.attempt}.`}
          >
            Reviewer-only interactive case runner
          </h2>
        </div>
        <strong>
          <ClipboardCheck aria-hidden="true" /> Pending review
        </strong>
      </header>

      <div
        className={styles.boundary}
        role="note"
        aria-labelledby="baxter-crrt-phase7-case-review-boundary-heading"
      >
        <FileWarning aria-hidden="true" />
        <p>
          <strong id="baxter-crrt-phase7-case-review-boundary-heading">
            Reviewer runtime—not a learner activity.
          </strong>{' '}
          Exercise the synthetic candidate and inspect its draft rubric. This isolated runner emits
          no analytics, writes no progress or local storage, grants no competency, and does not
          activate any case for learner selection.
        </p>
      </div>

      <dl className={styles.metadata} aria-label="Current review candidate metadata">
        <div>
          <dt>Candidate</dt>
          <dd>{session.caseDefinition.id}</dd>
        </div>
        <div>
          <dt>Audience</dt>
          <dd>Reviewer only</dd>
        </div>
        <div>
          <dt>Content version</dt>
          <dd>{session.caseDefinition.contentVersion}</dd>
        </div>
        <div>
          <dt>Disposition</dt>
          <dd>{session.caseDefinition.reviewStatus}</dd>
        </div>
      </dl>

      <div className={styles.sourceRecord} aria-label="Current candidate source records">
        <ShieldCheck aria-hidden="true" />
        <div>
          <strong>Candidate source records</strong>
          <p>{session.caseDefinition.sourceBasis.map((source) => source.id).join(' · ')}</p>
          <small>
            Source linkage supports review traceability; it does not approve the synthetic values,
            score, or critical-error candidate.
          </small>
        </div>
      </div>

      <CrrtReasoningRibbon session={session} />

      <div className={styles.mobileTabs} role="tablist" aria-label="Reviewer case surface">
        {reviewSurfaces.map((surface) => (
          <button
            key={surface.id}
            id={reviewWorkflowId(`baxter-crrt-mobile-tab-${surface.id}`)}
            ref={(node) => {
              tabRefs.current[surface.id] = node
            }}
            type="button"
            role="tab"
            aria-controls={reviewWorkflowId(`baxter-crrt-mobile-panel-${surface.id}`)}
            aria-selected={mobileSurface === surface.id}
            tabIndex={mobileSurface === surface.id ? 0 : -1}
            onClick={() => setMobileSurface(surface.id)}
            onKeyDown={(event) => handleSurfaceKeyDown(event, surface.id)}
          >
            {surface.label}
          </button>
        ))}
      </div>

      <div className={styles.workflow}>
        <CrrtLearningWorkflow
          key={`${session.caseDefinition.id}-${session.roleLens}-${session.attempt}`}
          session={session}
          dispatch={dispatch}
          availableCases={reviewCases}
          mobileSurface={mobileSurface}
          idNamespace={REVIEW_ID_NAMESPACE}
          onCaseChange={handleCaseChange}
          onRoleChange={handleRoleChange}
          onReset={handleReset}
          onDebriefRevealed={() => setMobileSurface('debrief')}
        />
      </div>
    </section>
  )
}
