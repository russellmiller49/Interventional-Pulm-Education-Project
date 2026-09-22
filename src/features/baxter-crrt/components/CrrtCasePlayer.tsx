'use client'

import {
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronRight,
  Clock3,
  Lightbulb,
  MessageSquareText,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { useRef, useState, type Dispatch, type KeyboardEvent } from 'react'

import type { CriticalCareActivityPhase } from '@/features/learning-module/activity'
import { ActivityStepper } from '@/features/learning-module/components/ActivityStepper'

import { selectCrrtCaseEvidence } from '../caseEvidence'
import { getCrrtWorkedCaseExample } from '../content/workedCaseExamples'
import { selectCrrtConsoleControls } from '../engine/consoleControls'
import { selectSecondsUntilNextScheduledEvent } from '../engine/selectors'
import { selectCrrtPrescriptionRecord } from '../engine/setupWorkflow'
import { selectPrismaxPilotCaseOperationsDisplay } from '../engine/deviceAdapters/prismax'
import type {
  CrrtLearningSessionAction,
  CrrtLearningSessionState,
  CrrtReasoningPhase,
} from '../engine/learningSession'
import { hasCrrtRunActivity } from '../engine/learningSession'
import type { CrrtRoleLens } from '../engine/types'
import {
  crrtActionObservationIntervalSeconds,
  CRRT_HELD_PATIENT_SIGNAL_CAPTION,
  CRRT_INTERRUPTION_CAPTION,
  CRRT_MODEL_INDEX_CAPTION,
  CRRT_TIME_ACCOUNTING_CAPTION,
  formatCrrtRunClock,
  selectCrrtActualRunReview,
} from '../actualRunReview'
import {
  CRRT_LAB_TEACHING_SCOPE,
  CRRT_SUPPLIED_BASELINE_CAPTION,
  CRRT_UNMODELED_LAB_CAPTION,
  formatCrrtSuppliedLabValue,
  selectCrrtLabEvidence,
} from '../labEvidence'
import { selectCrrtWorkedRetiredIds } from '../workedCaseModel'
import { PrismaxPilotInterface, type PrismaxPilotCaseContext } from './PrismaxPilotInterface'
import { CrrtCaseEvidenceScope } from './CrrtCaseEvidenceScope'
import { CrrtWorkedCaseGuide, CrrtWorkedRunComparison } from './CrrtWorkedCaseExample'
import styles from './crrt-case-player.module.css'

const reasoningStages = [
  { id: 'brief', label: 'Brief', detail: 'Read + Define', phases: ['read', 'define'] },
  { id: 'plan', label: 'Plan', detail: 'Worked example', phases: ['select', 'predict'] },
  { id: 'run', label: 'Run', detail: 'Act + Observe', phases: ['run'] },
  {
    id: 'debrief',
    label: 'Debrief',
    detail: 'Reassess + Reflect',
    phases: ['reassess', 'reflect'],
  },
] as const satisfies readonly {
  readonly id: string
  readonly label: string
  readonly detail: string
  readonly phases: readonly CrrtReasoningPhase[]
}[]

const semanticPhaseByCrrtPhase: Readonly<Record<CrrtReasoningPhase, CriticalCareActivityPhase>> = {
  read: 'recognize',
  define: 'recognize',
  select: 'predict',
  predict: 'predict',
  run: 'act',
  reassess: 'observe',
  reflect: 'explain',
}

const roleLabels: Readonly<Record<CrrtRoleLens, string>> = {
  integrated: 'Integrated',
  operator: 'Operator',
  prescriber: 'Prescriber',
}

const simulationTimeAdvanceOptions = [
  { seconds: 60, label: '+1 min' },
  { seconds: 300, label: '+5 min' },
  { seconds: 900, label: '+15 min' },
  { seconds: 1_800, label: '+30 min' },
  { seconds: 3_600, label: '+1 hr' },
  { seconds: 21_600, label: '+6 hr' },
] as const

export type CrrtMobileSurface = 'case' | 'machine' | 'patient' | 'debrief'

interface CrrtCasePlayerProps {
  readonly session: CrrtLearningSessionState
  readonly dispatch: Dispatch<CrrtLearningSessionAction>
  readonly onRoleChange: (roleLens: CrrtRoleLens) => void
  readonly onReset: () => void
  /** Prefixes every authored DOM ID so multiple workflow instances can coexist. */
  readonly idNamespace?: string
  /** Standalone players retain the shared phase display; shell wrappers render it in ActivityShell. */
  readonly showSharedStepper?: boolean
}

export function CrrtReasoningRibbon({ session }: { session: CrrtLearningSessionState }) {
  const current = session.reasoningPhase
  const currentIndex = reasoningStages.findIndex(({ phases }) =>
    phases.some((phase) => phase === current),
  )

  return (
    <nav className={styles.reasoningRibbon} aria-label="CRRT case stages">
      <span>Case guide</span>
      <ol>
        {reasoningStages.map(({ id, label, detail }, index) => (
          <li
            key={id}
            data-status={index === currentIndex ? 'current' : 'available'}
            aria-current={index === currentIndex ? 'step' : undefined}
          >
            <i>{index + 1}</i>
            <span>
              <strong>{label}</strong>
              <small>{detail}</small>
            </span>
            {index < reasoningStages.length - 1 ? <ChevronRight aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>
    </nav>
  )
}

function selectedLabel(
  options: readonly { readonly id: string; readonly label: string }[],
  id: string,
): string {
  return options.find((option) => option.id === id)?.label ?? id
}

function formatSimulationTime(seconds: number): string {
  if (seconds === 0) return '0 min'
  if (seconds % 3_600 === 0) return `${seconds / 3_600} hr`
  if (seconds % 60 === 0) return `${seconds / 60} min`
  return `${seconds} sec`
}

function formatTrendValue(value: number | null | undefined, unit: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable'
  const rounded = Math.round(value * 100) / 100
  return `${rounded} ${unit}`
}

function toggleId(current: readonly string[], id: string): string[] {
  return current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
}

const mobileSurfaces: readonly { readonly id: CrrtMobileSurface; readonly label: string }[] = [
  { id: 'case', label: 'Case' },
  { id: 'machine', label: 'Machine + circuit' },
  { id: 'patient', label: 'Patient & trends' },
  { id: 'debrief', label: 'Debrief' },
]

export function CrrtCasePlayer(props: CrrtCasePlayerProps) {
  const { session } = props
  // The role lens is presentational. Keying on it would remount the player and
  // discard the run's local state, which is the defect X-08 describes.
  const playerKey = [session.caseDefinition.id, session.experience, session.attempt].join(':')
  return <CrrtCasePlayerContent key={playerKey} {...props} />
}

function CrrtCasePlayerContent({
  session,
  dispatch,
  onRoleChange,
  onReset,
  idNamespace,
  showSharedStepper = true,
}: CrrtCasePlayerProps) {
  const definition = session.caseDefinition
  // Worked cases retire generic options from the learner surface; their records stay for history.
  const workedExample = getCrrtWorkedCaseExample(definition.id)
  const retiredIds = selectCrrtWorkedRetiredIds(definition, workedExample)
  const visibleInterventions = definition.interventions.filter(
    ({ id }) => !retiredIds.interventionIds.has(id),
  )
  const visibleReassessmentOptions = definition.reassessmentOptions.filter(
    ({ id }) => !retiredIds.reassessmentOptionIds.has(id),
  )
  const scopedId = (id: string) => (idNamespace ? `${idNamespace}-${id}` : id)
  const experienceLabel = session.experience === 'practice' ? 'Practice' : 'Challenge'
  const visibleCaseTitle = definition.title
  const machineControlsEnabled = !session.debriefRevealed
  const consoleControls = selectCrrtConsoleControls(session)
  const prismaxCaseContext: PrismaxPilotCaseContext = {
    caseId: definition.id,
    title: visibleCaseTitle,
    pathway: session.experience,
  }
  const [actualReassessmentIds, setActualReassessmentIds] = useState<readonly string[]>([])
  const [mobileSurface, setMobileSurface] = useState<CrrtMobileSurface>('case')
  const [exampleVisible, setExampleVisible] = useState(false)
  const mobileTabRefs = useRef<Partial<Record<CrrtMobileSurface, HTMLButtonElement>>>({})
  const debrief = session.debriefRevealed ? definition.debrief : null
  const usedHintSet = new Set(session.usedHintIds)
  const performedSet = new Set(session.performedInterventionIds)
  const hasRun = hasCrrtRunActivity(session)
  const runReview = selectCrrtActualRunReview(session)
  const prescriptionRecord = selectCrrtPrescriptionRecord(session)
  const caseEvidence = selectCrrtCaseEvidence(definition)
  const labEvidence = selectCrrtLabEvidence(session)
  const firstTrend = session.simulation.trends[0]
  const latestTrend = session.simulation.trends.at(-1)
  const trendEvidenceRows =
    firstTrend && latestTrend
      ? [
          {
            label: 'Prescribed effluent dose',
            first: formatTrendValue(firstTrend.prescribedEffluentDoseMlKgHour, 'mL/kg/h'),
            latest: formatTrendValue(latestTrend.prescribedEffluentDoseMlKgHour, 'mL/kg/h'),
          },
          {
            label: 'Delivered dose',
            first: formatTrendValue(firstTrend.deliveredDoseMlKgHour, 'mL/kg/h'),
            latest: formatTrendValue(latestTrend.deliveredDoseMlKgHour, 'mL/kg/h'),
          },
          {
            label: 'Whole-patient balance',
            first: formatTrendValue(firstTrend.cumulativeWholePatientBalanceMl, 'mL'),
            latest: formatTrendValue(latestTrend.cumulativeWholePatientBalanceMl, 'mL'),
          },
          {
            label: 'Access pressure',
            first: formatTrendValue(firstTrend.accessPressureMmHg, 'mmHg'),
            latest: formatTrendValue(latestTrend.accessPressureMmHg, 'mmHg'),
          },
          {
            label: 'Filter pressure',
            first: formatTrendValue(firstTrend.filterPressureMmHg, 'mmHg'),
            latest: formatTrendValue(latestTrend.filterPressureMmHg, 'mmHg'),
          },
          {
            label: 'Return pressure',
            first: formatTrendValue(firstTrend.returnPressureMmHg, 'mmHg'),
            latest: formatTrendValue(latestTrend.returnPressureMmHg, 'mmHg'),
          },
          {
            label: 'Transmembrane pressure',
            first: formatTrendValue(firstTrend.transmembranePressureMmHg, 'mmHg'),
            latest: formatTrendValue(latestTrend.transmembranePressureMmHg, 'mmHg'),
          },
          // Solute concentrations are deliberately absent from this table.
          // They are advanced by delivered clearance alone, so they are not a
          // measured laboratory trend; the supplied baseline and the explicit
          // not-modeled statement below carry that evidence honestly.
        ]
      : []
  const nextHint = definition.hintLadder
    .slice()
    .sort((left, right) => left.sequence - right.sequence)
    .find((hint) => !usedHintSet.has(hint.id))
  const canReassess = hasRun && !session.reassessment.committed && !session.debriefRevealed
  const secondsUntilNextScheduledEvent = selectSecondsUntilNextScheduledEvent(session.simulation)
  function performIntervention(interventionId: string) {
    dispatch({ type: 'PERFORM_INTERVENTION', interventionId })
  }
  function commitReassessment() {
    if (actualReassessmentIds.length === 0 || !canReassess) return
    dispatch({ type: 'COMMIT_REASSESSMENT', optionIds: actualReassessmentIds })
  }
  function revealDebrief() {
    dispatch({ type: 'REVEAL_DEBRIEF' })
  }

  function openPhase(phase: CriticalCareActivityPhase) {
    const destination: Readonly<
      Record<
        CriticalCareActivityPhase,
        { readonly surface: CrrtMobileSurface; readonly targetId: string }
      >
    > = {
      recognize: { surface: 'case', targetId: scopedId('crrt-case-findings') },
      predict: { surface: 'case', targetId: scopedId('crrt-prediction-heading') },
      act: { surface: 'case', targetId: scopedId('crrt-actions-heading') },
      observe: {
        surface: 'patient',
        targetId: scopedId('baxter-crrt-mobile-panel-patient'),
      },
      explain: { surface: 'debrief', targetId: scopedId('crrt-debrief-heading') },
      transfer: { surface: 'debrief', targetId: scopedId('crrt-transfer-question') },
    }
    const next = destination[phase]
    setMobileSurface(next.surface)
    const target = document.getElementById(next.targetId)
    target?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }

  function moveSurfaceFocus(
    event: KeyboardEvent<HTMLButtonElement>,
    currentSurface: CrrtMobileSurface,
  ) {
    const currentIndex = mobileSurfaces.findIndex(({ id }) => id === currentSurface)
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % mobileSurfaces.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + mobileSurfaces.length) % mobileSurfaces.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = mobileSurfaces.length - 1
    }
    if (nextIndex === null) return
    event.preventDefault()
    const nextSurface = mobileSurfaces[nextIndex].id
    setMobileSurface(nextSurface)
    mobileTabRefs.current[nextSurface]?.focus()
  }

  return (
    <div className={styles.learningWorkflow}>
      <CrrtReasoningRibbon session={session} />
      {showSharedStepper ? (
        <ActivityStepper
          completedPhases={[]}
          currentPhase={
            session.reasoningPhase === 'reflect' && session.debriefRevealed
              ? 'transfer'
              : semanticPhaseByCrrtPhase[session.reasoningPhase]
          }
          ariaLabel="CRRT shared activity phases"
          onPhaseSelect={openPhase}
        />
      ) : null}
      <div className={styles.mobileSurfaceTabs} role="tablist" aria-label="CRRT case surfaces">
        {mobileSurfaces.map((surface) => (
          <button
            key={surface.id}
            id={scopedId(`baxter-crrt-mobile-tab-${surface.id}`)}
            ref={(node) => {
              if (node) mobileTabRefs.current[surface.id] = node
            }}
            type="button"
            role="tab"
            aria-selected={mobileSurface === surface.id}
            aria-controls={scopedId(`baxter-crrt-mobile-panel-${surface.id}`)}
            tabIndex={mobileSurface === surface.id ? 0 : -1}
            onClick={() => setMobileSurface(surface.id)}
            onKeyDown={(event) => moveSurfaceFocus(event, surface.id)}
          >
            {surface.label}
          </button>
        ))}
      </div>
      <div
        id={scopedId('baxter-crrt-mobile-panel-case')}
        className={styles.caseWorkflow}
        role="tabpanel"
        aria-labelledby={scopedId('baxter-crrt-mobile-tab-case')}
        data-mobile-active={mobileSurface === 'case'}
        data-testid="crrt-case-workflow"
      >
        <div className={styles.contextControls}>
          <div className={styles.roleToggle} role="group" aria-label="View case through role lens">
            <span>View as:</span>
            {definition.roleLenses.map((roleLens) => (
              <button
                key={roleLens}
                type="button"
                aria-pressed={session.roleLens === roleLens}
                onClick={() => onRoleChange(roleLens)}
              >
                {roleLabels[roleLens]}
              </button>
            ))}
          </div>
          <button type="button" className={styles.resetButton} onClick={onReset}>
            <RefreshCcw aria-hidden="true" /> Reset case
          </button>
        </div>

        <header className={styles.caseHeader}>
          <div>
            <span>Clinical case · {experienceLabel}</span>
            <h3>{visibleCaseTitle}</h3>
          </div>
          <strong>
            {session.debriefRevealed
              ? 'Run ended'
              : hasRun
                ? 'Simulation in progress'
                : 'Case ready to explore'}
          </strong>
        </header>

        <div className={styles.syntheticNotice} role="note">
          <ShieldAlert aria-hidden="true" />
          <p>
            <strong>Simulated clinical case.</strong> Patient values, treatment responses, and
            comparisons are for education only—not bedside targets or local protocols.
          </p>
        </div>

        <section
          className={styles.findingsSection}
          aria-labelledby={scopedId('crrt-case-findings')}
        >
          <div className={styles.workflowHeading}>
            <BrainCircuit aria-hidden="true" />
            <div>
              <span>Read</span>
              <h4 id={scopedId('crrt-case-findings')}>
                Patient, access, circuit, and delivered treatment
              </h4>
            </div>
          </div>
          <p>{definition.patientDescription}</p>
          <details>
            <summary>What this case covers</summary>
            <ul>
              {definition.learningObjectives.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </ul>
          </details>
          <ul>
            {definition.visibleFindings.map((finding) => (
              <li key={finding}>{finding}</li>
            ))}
          </ul>
        </section>

        {caseEvidence ? (
          <CrrtCaseEvidenceScope evidence={caseEvidence} scopedId={scopedId} />
        ) : null}

        {workedExample ? (
          <CrrtWorkedCaseGuide session={session} example={workedExample} scopedId={scopedId} />
        ) : (
          <section
            className={styles.predictionSection}
            aria-labelledby={scopedId('crrt-prediction-heading')}
          >
            <div className={styles.workflowHeading}>
              <BrainCircuit aria-hidden="true" />
              <div>
                <span>Clinical context</span>
                <h4 id={scopedId('crrt-prediction-heading')}>Understand this case</h4>
              </div>
            </div>
            <p>
              {selectedLabel(
                definition.goalOptions,
                definition.hiddenMechanism.correctGoalOptionId,
              )}
            </p>
            <p>
              Explore the controls, review a worked plan, or continue to another case at any time.
            </p>
            <button
              type="button"
              className={styles.commitButton}
              onClick={() => setExampleVisible((visible) => !visible)}
            >
              {exampleVisible ? 'Hide worked plan' : 'Explain this case'}
            </button>
            {exampleVisible ? (
              <section aria-label="Worked example">
                <h5>Worked plan · example only</h5>
                <p>{definition.hiddenMechanism.summary}</p>
                <ol>
                  {definition.hiddenMechanism.causalChain.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <h5>What to reassess</h5>
                <ul>
                  {definition.requiredReassessmentIds.map((id) => (
                    <li key={id}>{selectedLabel(definition.reassessmentOptions, id)}</li>
                  ))}
                </ul>
                <p>
                  Viewing this plan records no answer, intervention, or observation. Clinical and
                  device review remains pending.
                </p>
              </section>
            ) : null}
          </section>
        )}

        <section
          className={styles.actionSection}
          aria-labelledby={scopedId('crrt-actions-heading')}
        >
          <div className={styles.workflowHeading}>
            <ArrowRight aria-hidden="true" />
            <div>
              <span>Act</span>
              <h4 id={scopedId('crrt-actions-heading')}>Choose and sequence clinical actions</h4>
            </div>
          </div>

          <div className={styles.actionList}>
            {visibleInterventions.map((intervention) => {
              const performed = performedSet.has(intervention.id)
              const missingPrerequisite = intervention.prerequisites.find(
                (id) => !performedSet.has(id),
              )
              const disabled =
                session.debriefRevealed ||
                Boolean(missingPrerequisite) ||
                (performed && !intervention.repeatable)
              const showActionResponse = performed
              const observationIntervalSeconds = crrtActionObservationIntervalSeconds(intervention)
              return (
                <article key={intervention.id} data-performed={performed}>
                  <div>
                    <span>{intervention.category}</span>
                    <strong>{intervention.label}</strong>
                    <p>{intervention.description}</p>
                    {observationIntervalSeconds > 0 ? (
                      <small>
                        Performing this advances the simulated clock by{' '}
                        {formatCrrtRunClock(observationIntervalSeconds)} — its authored observation
                        interval. Compare it with another path at the same elapsed time, not at the
                        same number of clicks.
                      </small>
                    ) : null}
                    {missingPrerequisite ? (
                      <small>
                        Requires{' '}
                        {definition.interventions.find((item) => item.id === missingPrerequisite)
                          ?.label ?? missingPrerequisite}
                        .
                      </small>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => performIntervention(intervention.id)}
                  >
                    {performed ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
                    {performed ? 'Completed' : 'Perform'}
                  </button>
                  {showActionResponse ? (
                    <p className={styles.actionResponse}>{intervention.response}</p>
                  ) : null}
                </article>
              )
            })}
          </div>

          <div className={styles.timeControls} role="group" aria-label="Advance simulated time">
            <div>
              <Clock3 aria-hidden="true" />
              <span>
                <strong>{Math.round(session.simulation.simulationTimeSeconds / 60)} min</strong>
                Observe immediate machine changes and later patient and treatment-delivery trends.
              </span>
            </div>
            {simulationTimeAdvanceOptions.map((option) => (
              <button
                key={option.seconds}
                type="button"
                disabled={session.debriefRevealed}
                onClick={() => dispatch({ type: 'ADVANCE_TIME', seconds: option.seconds })}
              >
                {option.label}
              </button>
            ))}
            {secondsUntilNextScheduledEvent !== null ? (
              <button
                type="button"
                className={styles.nextEventButton}
                disabled={session.debriefRevealed}
                onClick={() =>
                  dispatch({ type: 'ADVANCE_TIME', seconds: secondsUntilNextScheduledEvent })
                }
              >
                Advance to next scheduled event
              </button>
            ) : null}
          </div>
        </section>

        {
          <section className={styles.hintSection} aria-labelledby={scopedId('crrt-hint-heading')}>
            <div className={styles.workflowHeading}>
              <Lightbulb aria-hidden="true" />
              <div>
                <span>Hint ladder</span>
                <h4 id={scopedId('crrt-hint-heading')}>Optional teaching support</h4>
              </div>
            </div>
            {session.usedHintIds.length > 0 ? (
              <ol className={styles.usedHints}>
                {definition.hintLadder
                  .filter((hint) => usedHintSet.has(hint.id))
                  .sort((left, right) => left.sequence - right.sequence)
                  .map((hint) => (
                    <li key={hint.id}>{hint.text}</li>
                  ))}
              </ol>
            ) : (
              <p>No hints revealed.</p>
            )}
            <button
              type="button"
              disabled={!nextHint || session.debriefRevealed}
              onClick={() => {
                dispatch({ type: 'USE_HINT' })
              }}
            >
              <Lightbulb aria-hidden="true" />
              {nextHint ? `Reveal hint ${nextHint.sequence}` : 'All hints used'}
            </button>
            <small>Hints are optional teaching support.</small>
          </section>
        }

        <section
          className={styles.reassessmentSection}
          aria-labelledby={scopedId('crrt-reassess-heading')}
        >
          <div className={styles.workflowHeading}>
            <MessageSquareText aria-hidden="true" />
            <div>
              <span>Reassess</span>
              <h4 id={scopedId('crrt-reassess-heading')}>Review the observed response</h4>
            </div>
          </div>
          {!hasRun ? (
            <p>No run observations yet. Explore the simulation or review the worked plan.</p>
          ) : null}
          {session.reassessment.committed ? (
            <p className={styles.completedNotice}>
              <Check aria-hidden="true" /> Reassessment recorded for this run.
            </p>
          ) : (
            <fieldset disabled={!canReassess}>
              <legend>Select every reassessment you actually completed</legend>
              {visibleReassessmentOptions.map((option) => (
                <label key={option.id}>
                  <input
                    checked={actualReassessmentIds.includes(option.id)}
                    type="checkbox"
                    onChange={() =>
                      setActualReassessmentIds(toggleId(actualReassessmentIds, option.id))
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
              <button
                type="button"
                disabled={actualReassessmentIds.length === 0}
                onClick={commitReassessment}
              >
                Commit reassessment
              </button>
            </fieldset>
          )}
        </section>

        {session.criticalErrorIds.length > 0 ? (
          <div className={styles.criticalBanner} role="alert">
            <ShieldAlert aria-hidden="true" />
            <div>
              <strong>Simulation safety notice</strong>
              {session.criticalErrorIds.map((id) => (
                <p key={id}>{selectedLabel(definition.criticalErrors, id)}</p>
              ))}
              <p>
                Review the associated action and device warning. These case rules remain pending
                clinical review.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <section
        id={scopedId('baxter-crrt-mobile-panel-machine')}
        className={`${styles.surfaceSummary} ${styles.machineSurface}`}
        role="tabpanel"
        aria-labelledby={scopedId('baxter-crrt-mobile-tab-machine')}
        data-mobile-active={mobileSurface === 'machine'}
      >
        <div className={styles.machineSurfaceHeading}>
          <div>
            <span>Interactive equipment station</span>
            <h4>PrisMax machine and circuit</h4>
          </div>
          <strong data-available={machineControlsEnabled}>
            {machineControlsEnabled ? 'Machine actions available' : 'Run ended'}
          </strong>
        </div>
        <p className={styles.machineSurfaceIntro}>
          Explore the layout, circuit, setup, and Operations controls at any time. Machine, circuit,
          and patient views update together. The worked plan is available on the Case tab.
        </p>
        <PrismaxPilotInterface
          state={session.interfaceState}
          dispatch={(action) => dispatch({ type: 'DEVICE_ACTION', action })}
          controlsEnabled={machineControlsEnabled}
          controlsUnavailableReason={session.debriefRevealed ? 'debrief' : undefined}
          consoleControls={consoleControls}
          operationsDisplay={selectPrismaxPilotCaseOperationsDisplay(
            session.interfaceState,
            session.simulation,
          )}
          prescriptionRecord={prescriptionRecord}
          caseContext={prismaxCaseContext}
          onPerformCaseAction={performIntervention}
          onReset={onReset}
        />
        <div className={styles.circuitSummary} aria-label="Circuit and fluid state">
          <h5>Circuit and fluid state</h5>
          <dl>
            <div>
              <dt>Modality</dt>
              <dd>{session.simulation.circuit.modality ?? 'Unavailable'}</dd>
            </div>
            <div>
              <dt>Connected bags</dt>
              <dd>{session.simulation.circuit.bags.length}</dd>
            </div>
            <div>
              <dt>Access pressure</dt>
              <dd>{formatTrendValue(latestTrend?.accessPressureMmHg, 'mmHg')}</dd>
            </div>
            <div>
              <dt>Filter pressure</dt>
              <dd>{formatTrendValue(latestTrend?.filterPressureMmHg, 'mmHg')}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section
        id={scopedId('baxter-crrt-mobile-panel-patient')}
        className={styles.surfaceSummary}
        role="tabpanel"
        aria-labelledby={scopedId('baxter-crrt-mobile-tab-patient')}
        data-mobile-active={mobileSurface === 'patient'}
      >
        <h4>Patient and delivered-therapy state</h4>
        <dl>
          <div>
            <dt>Delivered dose</dt>
            <dd>{formatTrendValue(latestTrend?.deliveredDoseMlKgHour, 'mL/kg/h')}</dd>
          </div>
          <div>
            <dt>Whole-patient balance</dt>
            <dd>{formatTrendValue(latestTrend?.cumulativeWholePatientBalanceMl, 'mL')}</dd>
          </div>
          <div>
            <dt>Downtime</dt>
            <dd>
              {formatSimulationTime(session.simulation.deliveredTherapy.cumulativeDowntimeSeconds)}
            </dd>
          </div>
          <div>
            <dt>Reassessment</dt>
            <dd>{session.reassessment.committed ? 'Recorded for this run' : 'Not recorded'}</dd>
          </div>
        </dl>
      </section>

      <section
        id={scopedId('baxter-crrt-mobile-panel-debrief')}
        className={styles.debriefSection}
        role="tabpanel"
        aria-labelledby={scopedId('baxter-crrt-mobile-tab-debrief')}
        data-mobile-active={mobileSurface === 'debrief'}
      >
        <div className={styles.workflowHeading}>
          <Sparkles aria-hidden="true" />
          <div>
            <span>Reflect</span>
            <h4 id={scopedId('crrt-debrief-heading')}>Causal debrief</h4>
          </div>
        </div>

        {!session.debriefRevealed ? (
          <>
            {!session.reassessment.committed ? (
              <p>
                Review the explanation at any time. Ending this run preserves only the actions and
                observations you actually made in this session. Reset case opens a new run.
              </p>
            ) : null}
            <button type="button" className={styles.commitButton} onClick={revealDebrief}>
              End run and review debrief <ArrowRight aria-hidden="true" />
            </button>
          </>
        ) : debrief ? (
          <div className={styles.debriefBody}>
            <section className={styles.scoreCard} aria-label="Debrief status">
              <div>
                <span>Causal debrief</span>
                <strong>{runReview.statusLabel}</strong>
                <small>{runReview.statusDetail}</small>
              </div>
            </section>

            <section aria-labelledby={scopedId('crrt-supplied-teaching-path')}>
              <h5 id={scopedId('crrt-supplied-teaching-path')}>
                Supplied teaching path · worked example
              </h5>
              <p>
                This is the authored explanation for this case. It describes the example, not what
                you did in this run.
              </p>
              <p className={styles.debriefSummary}>{debrief.summary}</p>
            </section>

            <section
              className={styles.attemptEvidence}
              aria-labelledby={scopedId('crrt-actual-attempt-evidence')}
            >
              <h5 id={scopedId('crrt-actual-attempt-evidence')}>What you did in this run</h5>
              {runReview.actions.length === 0 ? (
                <p>No action, console entry, or time advance was recorded in this run.</p>
              ) : (
                <ol className={styles.attemptTimeline}>
                  {runReview.actions.map((entry) => (
                    <li key={entry.sequence}>
                      <time>{formatSimulationTime(entry.atSeconds)}</time>
                      <span>
                        {entry.label}
                        {entry.outcome === 'refused' ? ' · not applied' : ''}
                      </span>
                      {entry.valueNote ? <small>{entry.valueNote}</small> : null}
                    </li>
                  ))}
                </ol>
              )}

              <h6>Actual reassessment</h6>
              <p>
                {runReview.reassessmentLabels.length > 0
                  ? runReview.reassessmentLabels.join('; ')
                  : 'Not recorded. The recommended reassessment below is the authored answer, not something you entered.'}
              </p>

              <h6>Where this run&rsquo;s simulated time came from</h6>
              <dl className={styles.attemptEvidenceGrid}>
                <div>
                  <dt>Total simulated time elapsed</dt>
                  <dd>{formatCrrtRunClock(runReview.timeAccounting.totalElapsedSeconds)}</dd>
                </div>
                <div>
                  <dt>Advanced by you</dt>
                  <dd>{formatCrrtRunClock(runReview.timeAccounting.advancedByLearnerSeconds)}</dd>
                </div>
                <div>
                  <dt>Carried by the case actions you performed</dt>
                  <dd>
                    {formatCrrtRunClock(runReview.timeAccounting.advancedByCaseActionsSeconds)}
                  </dd>
                </div>
              </dl>
              {runReview.timeAccounting.intervalActions.length > 0 ? (
                <ul>
                  {runReview.timeAccounting.intervalActions.map((action) => (
                    <li key={`${action.actionId}-${action.atSeconds}`}>
                      {action.label} carried its own {formatCrrtRunClock(action.advanceSeconds)}{' '}
                      observation interval, so the clock moved when you performed it.
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className={styles.debriefCaption}>{CRRT_TIME_ACCOUNTING_CAPTION}</p>

              <h6>Pausing, elapsed time, and downtime</h6>
              <dl className={styles.attemptEvidenceGrid}>
                <div>
                  <dt>Delivery pauses or stops you recorded</dt>
                  <dd>{runReview.interruptions.pauseCount}</dd>
                </div>
                <div>
                  <dt>Resumptions you recorded</dt>
                  <dd>{runReview.interruptions.resumeCount}</dd>
                </div>
                <div>
                  <dt>Downtime accumulated</dt>
                  <dd>{formatCrrtRunClock(runReview.interruptions.downtimeSeconds)}</dd>
                </div>
                <div>
                  <dt>Time delivery was running</dt>
                  <dd>
                    {formatCrrtRunClock(Math.round(runReview.interruptions.treatmentTimeSeconds))}
                  </dd>
                </div>
              </dl>
              <p className={styles.debriefCaption}>
                {CRRT_INTERRUPTION_CAPTION}
                {runReview.interruptions.pausedWithoutElapsedTime
                  ? ' In this run you paused and resumed at the same simulated timestamp, so no downtime was charged and delivered dose is unchanged. Advance simulated time while delivery is paused if you want to see what an interruption costs.'
                  : ''}
              </p>

              <h6>What this run recorded</h6>
              <dl className={styles.attemptEvidenceGrid}>
                {runReview.observations.map((observation) => (
                  <div key={observation.label}>
                    <dt>{observation.label}</dt>
                    <dd>{observation.value}</dd>
                  </div>
                ))}
              </dl>

              {runReview.modelIndices.length > 0 ? (
                <>
                  <h6>Bounded model indices this run advanced</h6>
                  <dl className={styles.attemptEvidenceGrid}>
                    {runReview.modelIndices.map((index) => (
                      <div key={index.label}>
                        <dt>{index.label}</dt>
                        <dd>
                          {index.value}
                          <small>{index.note}</small>
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className={styles.debriefCaption}>{CRRT_MODEL_INDEX_CAPTION}</p>
                </>
              ) : null}

              {runReview.heldPatientSignals.length > 0 ? (
                <>
                  <h6>Patient signals this exercise holds at the supplied value</h6>
                  <dl className={styles.attemptEvidenceGrid}>
                    {runReview.heldPatientSignals.map((signal) => (
                      <div key={signal.label}>
                        <dt>{signal.label}</dt>
                        <dd>{signal.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className={styles.debriefCaption}>{CRRT_HELD_PATIENT_SIGNAL_CAPTION}</p>
                </>
              ) : null}

              <h6>Sampled pressure, dose, and fluid evidence</h6>
              {firstTrend && latestTrend ? (
                <div
                  className={styles.trendEvidenceRegion}
                  role="region"
                  aria-label="Session sampled trends; horizontally scrollable"
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Signal</th>
                        <th scope="col">First · {formatSimulationTime(firstTrend.timeSeconds)}</th>
                        <th scope="col">
                          Latest · {formatSimulationTime(latestTrend.timeSeconds)}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendEvidenceRows.map((row) => (
                        <tr key={row.label}>
                          <th scope="row">{row.label}</th>
                          <td>{row.first}</td>
                          <td>{row.latest}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No five-minute trend sample was recorded before debrief.</p>
              )}
            </section>

            <section aria-labelledby={scopedId('crrt-actual-safety-review')}>
              <h5 id={scopedId('crrt-actual-safety-review')}>Safety review of this run</h5>
              {runReview.unsafeActionsPerformed.length === 0 ? (
                <p>
                  This run recorded none of the actions this case flags as unsafe. That is a record
                  of what you did, not a judgement that the run was clinically adequate.
                </p>
              ) : (
                <ul className={styles.unsafeActionList}>
                  {runReview.unsafeActionsPerformed.map((entry) => (
                    <li key={entry.actionId}>
                      <strong>{entry.actionLabel}</strong>
                      <p>{entry.explanation}</p>
                      {entry.criticalErrorLabel ? (
                        <p>
                          <em>{entry.criticalErrorLabel}:</em> {entry.criticalErrorExplanation}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              <h6>Modeled cause at the end of this run</h6>
              {runReview.unresolvedCauses.length === 0 ? (
                <p>No simulated fault was still active when the run ended.</p>
              ) : (
                <ul>
                  {runReview.unresolvedCauses.map((cause) => (
                    <li key={cause.faultId}>
                      <strong>{cause.label}</strong> is still active
                      {cause.alarmLabel ? ` with the ${cause.alarmLabel} alert showing` : ''}.
                      {cause.acknowledged
                        ? ' This run recorded an acknowledgement of that alert.'
                        : ''}{' '}
                      Seeing or acknowledging an alert does not correct its cause; the simulated
                      cause stays in place until it is corrected.
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby={scopedId('crrt-lab-evidence')}>
              <h5 id={scopedId('crrt-lab-evidence')}>Laboratory values in this case</h5>
              <p>{CRRT_SUPPLIED_BASELINE_CAPTION}</p>
              <dl className={styles.attemptEvidenceGrid}>
                {labEvidence.suppliedBaseline.map((entry) => (
                  <div key={entry.id}>
                    <dt>{entry.label}</dt>
                    <dd>{formatCrrtSuppliedLabValue(entry)}</dd>
                  </div>
                ))}
              </dl>
              {labEvidence.unmodeledGroups.length > 0 ? (
                <>
                  <h6>Not modeled in this exercise</h6>
                  <p>{CRRT_UNMODELED_LAB_CAPTION}</p>
                  <ul>
                    {labEvidence.unmodeledGroups.map((group) => (
                      <li key={group.key}>
                        <strong>{group.soluteLabels.join(', ')}</strong> — this exercise has no
                        reviewed specification for {group.missingInputText}, so it cannot represent
                        how these values would move during treatment.
                      </li>
                    ))}
                  </ul>
                  <p>{CRRT_LAB_TEACHING_SCOPE}</p>
                </>
              ) : null}
            </section>

            {workedExample ? (
              <CrrtWorkedRunComparison
                session={session}
                example={workedExample}
                heading="Expected and observed in this case"
              />
            ) : null}

            {session.performedInterventionIds.length > 0 ? (
              <section aria-labelledby={scopedId('crrt-deferred-action-feedback')}>
                <h5 id={scopedId('crrt-deferred-action-feedback')}>
                  Action teaching notes from this run
                </h5>
                <ul>
                  {session.performedInterventionIds.map((interventionId, index) => {
                    const intervention = definition.interventions.find(
                      ({ id }) => id === interventionId,
                    )
                    return intervention ? (
                      <li key={`${interventionId}-${index}`}>
                        <strong>{intervention.label}:</strong> {intervention.response}
                      </li>
                    ) : null
                  })}
                </ul>
              </section>
            ) : null}

            <p>{debrief.trendReview}</p>
            <p>{debrief.machineNavigationPoint}</p>
            <ol className={styles.causalChain}>
              {debrief.causalChain.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            <blockquote id={scopedId('crrt-transfer-question')}>
              {debrief.transferQuestion}
            </blockquote>
          </div>
        ) : null}
      </section>
    </div>
  )
}
