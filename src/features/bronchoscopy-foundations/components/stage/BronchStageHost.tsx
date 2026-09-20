'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, Circle, LocateFixed } from 'lucide-react'

import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { nextPathwaySection } from '@/features/learning-module/curriculum/types'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { type NowCardAction, type NowCardModel } from '@/features/learning-module/stage/NowCard'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { SectionsDrawer } from '@/features/learning-module/stage/SectionsDrawer'
import { StageSourcesFooter } from '@/features/learning-module/stage/StageSourcesFooter'
import { StageSourcesScope } from '@/features/learning-module/stage/StageSourcesScope'
import { StageTeachingScope } from '@/features/learning-module/stage/StageTeachingScope'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'
import { Link, useRouter } from '@/i18n/navigation'

import { ScopePane } from '../scope/ScopePane'
import {
  scopeControlId,
  type ScopeControlKey,
  type ScopeGoal,
  type ScopeGoalTest,
  type ScopeViewSpec,
  type TreeAnswer,
} from '../scope/types'
import { LOCAL_POLICY_BY_ID, LOCAL_POLICY_NOT_CONFIGURED } from '../../content/localPolicies'
import { microCasesForSection } from '../../content/microCases'
import { isBronchSectionId } from '../../content/sectionIds'
import { benchTargetObservation } from '../../engine/scope/scopeBenchTarget'
import {
  bronchSection,
  bronchoscopyFoundationsPathway,
  type BronchSectionId,
} from '../../content/pathway'
import { bronchSectionLinkTarget } from '../../content/pathwayResolver'
import {
  BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF,
  BRONCHOSCOPY_FOUNDATIONS_LEARN_HREF,
  BRONCHOSCOPY_FOUNDATIONS_NAV_BASE,
  bronchCaseLinkTarget,
} from '../../content/routes'
import { type BronchStageItem } from '../../content/stageItems'
import {
  bronchStageLesson,
  scopeViewOfStep,
  type BronchStageLesson,
  type BronchStageStep,
} from '../../content/stageLessons'
import { bronchStageSources } from '../../content/stageSources'
import { CAPSTONE_CASES } from '../../content/capstone'
import {
  availableSurveySnapshot,
  readBronchSelfPacedRecord,
  withReviewLater,
  withSectionOpened,
  withSectionReviewed,
  withSurveySnapshot,
  writeBronchSelfPacedRecord,
  type BronchSelfPacedRecord,
} from '../../engine/selfPacedProgress'
import { NEUTRAL_LOCATION_CAPTION, scopeLocationCaption } from '../../engine/scope/scopeCaption'
import type { ScopeCase } from '../../engine/scope/scopeCase'
import {
  scopeGoalClaim,
  scopeGoalsClaim,
  scopeGoalStatuses,
} from '../../engine/scope/scopeGoalEvaluation'
import type { ScopeRuntimeState } from '../../engine/scope/scopeRuntime'
import {
  deriveStageProgress,
  ledgerCommitment,
  reportCommitment,
  scenarioCommitment,
  stepWorkDone,
  type BronchStageSession,
} from '../../engine/stageSession'
import { BronchoscopyFoundationsModuleFrame } from '../BronchoscopyFoundationsModuleFrame'
import { useBronchoscopyFoundationsRecord } from '../useBronchoscopyFoundationsRecord'
import styles from './bronch-stage.module.css'
import { BronchExplanation } from './BronchExplanation'
import { BronchIdentifyControl } from './BronchIdentifyControl'
import { BronchLedgerControl } from './BronchLedgerControl'
import { BronchReportControl } from './BronchReportControl'
import { BronchScenarioControl } from './BronchScenarioControl'
import { BronchSequenceControl, initialSequenceOrder } from './BronchSequenceControl'
import { BronchSortControl } from './BronchSortControl'
import { BronchSourceList } from './BronchSourceList'
import { BronchCourseLayout } from './BronchCourseLayout'
import { BronchCourseTeaching } from './BronchCourseTeaching'
import { useScopeDemonstration } from './useScopeDemonstration'
import { MapWorkspace } from './MapWorkspace'
import { MediaWorkspace } from './MediaWorkspace'
import { MonitorPanel } from './MonitorPanel'
import { loadStageScopeCase } from './scopeCaseLoader'
import { useBronchStageSession } from './useBronchStageSession'
import { inspectionReport } from '../../engine/inspectionReport'

/**
 * One section of the Bronchoscopy Foundations pathway on the lesson stage.
 *
 * The pane engine is the authority on the scope: a step's goals are predicates over its state and
 * the events since the step began. The host owns this session's answers — which choice was
 * checked, which set was placed, which frame a scenario is on — and the view around them: the step
 * the learner is looking at when it is not the live one, the choice not yet checked, which
 * explanations are open, and the Now card that makes every step one thing.
 *
 * Self-paced contract (BF-01): every question and activity is optional. The learner can open an
 * explanation before answering, try again, go back to the teaching, or continue without answering
 * or completing — and moving on never records that anything was done. Nothing about answers,
 * attempts or assistance is persisted. The only writes are to the self-paced record: the section
 * opened, the reviewed mark when the learner finishes (with undo), a review-later mark, and the
 * lower-airway survey when the learner actually met its goals.
 */
export function BronchStageHost({
  sectionId,
  locale = 'en',
}: {
  readonly sectionId: string
  readonly locale?: string
}) {
  const [restartCount, setRestartCount] = useState(0)
  return (
    <BronchStageSessionView
      key={`${sectionId}:${restartCount}`}
      sectionId={sectionId}
      locale={locale}
      onRestart={() => setRestartCount((count) => count + 1)}
    />
  )
}

const DECISION_FRAMES = {
  best: 'That is the move to make first',
  'reasonable-but-incomplete': 'Defensible, but it leaves a step out',
  'incorrect-mechanism': 'That move answers a different problem',
} as const

function verdictFrames(item: ClinicalLearningItem) {
  return item.itemType === 'management-decision' ? DECISION_FRAMES : undefined
}

/** What the way on says for an activity that is not done; null where there is nothing to skip. */
function skipLabel(kind: BronchStageStep['interaction']['kind'], last: boolean): string | null {
  const verb = last ? 'Finish' : 'Continue'
  switch (kind) {
    case 'prediction':
      return `${verb} without answering`
    case 'sort':
    case 'identify':
    case 'sequence':
      return `${verb} without checking`
    case 'ledger':
    case 'report':
    case 'scenario':
    case 'scope-task':
    case 'observe':
      return `${verb} without completing`
    default:
      return null
  }
}

const EXPLANATION_NOTE = 'Opened without an answer. Nothing is recorded; you can still answer.'

/**
 * What a row of ticks on a scope card is a statement about (A4, A5).
 *
 * Most scope goals are written over the events of the attempt, so they stay met after the tip has
 * moved on: they record what was done, not what is on the screen now. Saying so keeps a completed
 * card from reading as approval of a view the model cannot judge — and the model genuinely cannot:
 * it counts contacts, lost views and positions, and measures nothing about the picture.
 */
const GOAL_BASIS: Readonly<Record<'history' | 'current' | 'mixed', string>> = {
  history: 'Each goal here records something that happened during this attempt.',
  current: 'Each goal here reads the state the scope is in now.',
  mixed:
    'Some goals here record what happened during this attempt; others read the state the scope is in now.',
}
const GOAL_MODEL_LIMIT =
  'The model counts contacts, lost views and where the tip is; it does not judge the picture on the screen.'

/** The done line on a scope card, bounded by what its goals actually establish. */
function scopeDoneStatus(goals: readonly ScopeGoal[], lead: string): string {
  const claim = scopeGoalsClaim(goals)
  if (claim === 'current') return lead
  return claim === 'history'
    ? `${lead} They record this attempt, not the view on the screen now.`
    : `${lead} Some of them record this attempt rather than the view on the screen now.`
}

/** The control to spotlight for a goal not yet met. */
function goalControlKey(test: ScopeGoalTest): ScopeControlKey | null {
  switch (test.type) {
    case 'all':
      for (const inner of test.tests) {
        const key = goalControlKey(inner)
        if (key) return key
      }
      return null
    case 'without':
      return null
    case 'event-sequence':
      return test.events.length ? eventControlKey(test.events[0]) : null
    case 'event':
      return eventControlKey(test.event)
    case 'location':
    case 'ledger-complete':
      return 'advance'
    case 'ledger':
      return 'declare'
    case 'metric':
      return test.metric === 'rotationDeg'
        ? 'rotate'
        : test.metric === 'deflectionDeg'
          ? 'deflect'
          : 'advance'
    default:
      return null
  }
}

function eventControlKey(event: string): ScopeControlKey | null {
  if (event.startsWith('control-used:')) {
    const control = event.slice('control-used:'.length)
    return control === 'insertion'
      ? 'advance'
      : control === 'rotation'
        ? 'rotate'
        : control === 'deflection'
          ? 'deflect'
          : control === 'suction'
            ? 'suction'
            : 'accessory'
  }
  if (event.startsWith('declared:')) return 'declare'
  if (event.startsWith('accessory'))
    return event === 'accessory-state-verified' ? 'verifyAccessory' : 'accessory'
  if (event === 'captured') return 'capture'
  if (event === 'acknowledged') return 'acknowledge'
  if (event === 'lens-cleared') return 'clearLens'
  if (event === 'hold-completed') return 'step'
  return 'advance'
}

function firstScopeStart(view: ScopeViewSpec): boolean {
  return view.start.kind === 'bench'
}

function BronchStageSessionView({
  sectionId,
  locale,
  onRestart,
}: {
  readonly sectionId: string
  readonly locale: string
  readonly onRestart: () => void
}) {
  const router = useRouter()
  const [initialRecord] = useState(readBronchSelfPacedRecord)
  const lesson = useMemo(() => {
    const base = bronchStageLesson(sectionId as BronchStageLesson['sectionId'])
    return {
      ...base,
      steps: base.steps.map(
        (step): BronchStageStep =>
          step.course?.learnerRecord
            ? {
                ...step,
                interaction: {
                  kind: 'report',
                  report: inspectionReport({
                    inspectionSnapshot: availableSurveySnapshot(initialRecord),
                  }),
                },
              }
            : step,
      ),
    }
  }, [sectionId, initialRecord])
  const { session, dispatch } = useBronchStageSession(lesson)
  const nextSection = nextPathwaySection(bronchoscopyFoundationsPathway, sectionId)
  const stageSources = useMemo(() => bronchStageSources(lesson.sectionId), [lesson.sectionId])

  const [pendingChoice, setPendingChoice] = useState<Record<string, string>>({})
  const [sortDraft, setSortDraft] = useState<Record<string, string>>({})
  const [identifyDraft, setIdentifyDraft] = useState<Record<string, string>>({})
  const [sequenceDraft, setSequenceDraft] = useState<Record<string, readonly string[]>>({})
  const [explanationShown, setExplanationShown] = useState<Record<string, boolean>>({})
  const [viewIndex, setViewIndex] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [spotlight, setSpotlight] = useState<{ stepId: string; key: string; count: number } | null>(
    null,
  )
  const [scopeCase, setScopeCase] = useState<ScopeCase | null>(null)
  const [caseFailed, setCaseFailed] = useState(false)
  const [caseLoadGeneration, setCaseLoadGeneration] = useState(0)
  const [pilotAttempts, setPilotAttempts] = useState<Record<string, boolean>>({})
  const [pilotHints, setPilotHints] = useState<Record<string, boolean>>({})
  const [storageFailed, setStorageFailed] = useState(false)
  const saveRecord = useCallback(
    (update: (record: BronchSelfPacedRecord) => BronchSelfPacedRecord) => {
      const current = readBronchSelfPacedRecord()
      const next = update(current)
      if (next === current) return
      const failed = !writeBronchSelfPacedRecord(next)
      queueMicrotask(() => setStorageFailed(failed))
    },
    [],
  )
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const nowFocusRef = useRef<HTMLDivElement>(null)
  const completionRecorded = useRef(false)
  const previousFocusStep = useRef<string | null>(null)

  const { commitments } = session
  const progress = deriveStageProgress(lesson, session)
  const liveIndex = progress.liveIndex
  const activeIndex = Math.max(0, Math.min(viewIndex ?? liveIndex, lesson.steps.length - 1))
  const activeStep = lesson.steps[activeIndex]
  const lookingBack = viewIndex !== null && viewIndex < liveIndex
  const isLastStep = activeIndex === lesson.steps.length - 1
  const predictionCommitted = progress.predictionCommitted
  const finished = commitments.finished
  const interaction = activeStep.interaction
  const workDone = stepWorkDone(lesson, activeStep, activeIndex, session)
  const explanationOpen = explanationShown[activeStep.id] === true
  const demonstration = useScopeDemonstration(activeStep, scopeCase)
  const hasDemonstration = !!(activeStep.learn?.demonstration ?? activeStep.course?.demonstration)
    ?.length
  const practicing = !hasDemonstration || pilotAttempts[activeStep.id] === true

  /* ---------------------------------------------------------------- *
   * The case and the scope states
   * ---------------------------------------------------------------- */
  const needsCase = lesson.steps.some(
    (step) => step.workspace.kind === 'scope' || step.workspace.kind === 'map',
  )
  const profile = useMemo(() => {
    for (const step of lesson.steps) {
      const view = scopeViewOfStep(step)
      if (view) return view.profile
    }
    return 'adult-teaching-combined-left-basal-v1' as const
  }, [lesson.steps])

  useEffect(() => {
    if (!needsCase) return
    let cancelled = false
    loadStageScopeCase(profile).then(
      (loaded) => {
        if (!cancelled) setScopeCase(loaded)
      },
      () => {
        if (!cancelled) setCaseFailed(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [needsCase, profile, caseLoadGeneration])

  // The current authored task owns its workspace; reviewing it preserves its existing state.
  const paneStep = activeStep
  const paneView = scopeViewOfStep(paneStep)
  const paneState: ScopeRuntimeState | undefined = session.scope[paneStep.id]

  useEffect(() => {
    if (!paneView || session.scope[paneStep.id]) return
    if (!scopeCase && !firstScopeStart(paneView)) return
    dispatch({ type: 'SCOPE_INIT', stepId: paneStep.id, view: paneView, scopeCase })
  }, [dispatch, paneStep.id, paneView, scopeCase, session.scope])

  useEffect(() => {
    nowFocusRef.current?.focus({ preventScroll: true })
    if (previousFocusStep.current !== null)
      nowFocusRef.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
    previousFocusStep.current = activeStep.id
  }, [activeStep.id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('phase', activeStep.phase)
    window.history.replaceState(window.history.state, '', url)
  }, [activeStep.phase])

  useEffect(() => {
    saveRecord((record) => withSectionOpened(record, lesson.sectionId))
  }, [lesson.sectionId, saveRecord])

  useEffect(() => {
    if (!finished || completionRecorded.current) return
    completionRecorded.current = true
    const surveyStep =
      lesson.sectionId === 'systematic-survey'
        ? lesson.steps.find((step) => step.interaction.kind === 'scope-task')
        : undefined
    // The survey is saved only when its goals were met on the learner's own controls.
    const surveyState =
      surveyStep && commitments.performedIds.includes(surveyStep.id)
        ? session.scope[surveyStep.id]
        : undefined
    saveRecord((record) => {
      const reviewed = withSectionReviewed(record, lesson.sectionId, true)
      return surveyState ? withSurveySnapshot(reviewed, surveyState.ledger) : reviewed
    })
  }, [
    finished,
    lesson.sectionId,
    lesson.steps,
    session.scope,
    commitments.performedIds,
    saveRecord,
  ])

  /* ---------------------------------------------------------------- *
   * Progression
   * ---------------------------------------------------------------- */
  const confirmThrough = useCallback(
    (index: number) => {
      dispatch({ type: 'CONFIRM_THROUGH', index })
      setViewIndex(null)
      setSpotlight(null)
    },
    [dispatch],
  )

  /** Moves on without doing the step; on the last step, finishes. Records nothing about the step. */
  function skipPast(index: number) {
    demonstration.stop()
    dispatch({ type: 'SKIP_PAST', index })
    if (index === lesson.steps.length - 1) dispatch({ type: 'FINISH' })
    setViewIndex(null)
    setSpotlight(null)
  }

  function commitChoice(step: BronchStageStep) {
    if (step.interaction.kind !== 'prediction') return
    const choiceId = pendingChoice[step.id]
    if (!choiceId) return
    dispatch({ type: 'COMMIT_CHOICE', stepId: step.id, choiceId })
    setViewIndex(null)
  }

  function commitSort(step: BronchStageStep) {
    if (step.interaction.kind !== 'sort') return
    if (step.interaction.sort.rows.some((row) => !sortDraft[row.id])) return
    dispatch({ type: 'COMMIT_SORT', stepId: step.id, answers: { ...sortDraft } })
  }

  function commitIdentify(step: BronchStageStep) {
    if (step.interaction.kind !== 'identify') return
    if (step.interaction.identify.rows.some((row) => !identifyDraft[row.id])) return
    dispatch({ type: 'COMMIT_IDENTIFY', stepId: step.id, answers: { ...identifyDraft } })
  }

  function sequenceOrder(step: BronchStageStep): readonly string[] {
    if (step.interaction.kind !== 'sequence') return []
    return sequenceDraft[step.id] ?? initialSequenceOrder(step.interaction.sequence)
  }

  function commitSequence(step: BronchStageStep) {
    if (step.interaction.kind !== 'sequence') return
    dispatch({ type: 'COMMIT_SEQUENCE', stepId: step.id, order: sequenceOrder(step) })
  }

  function retryStep(step: BronchStageStep) {
    dispatch({ type: 'RETRY_STEP', stepId: step.id })
    if (step.interaction.kind === 'prediction')
      setPendingChoice((current) => ({ ...current, [step.id]: '' }))
  }

  function toggleExplanation(stepId: string) {
    setExplanationShown((current) => ({ ...current, [stepId]: !current[stepId] }))
  }

  function goBack() {
    const target = activeIndex - 1
    if (target < 0 || target > commitments.confirmed) return
    setViewIndex(target)
  }

  function returnToLive() {
    setViewIndex(null)
  }

  function goToSection(nextId: string) {
    if (nextId === sectionId) return
    router.push({ pathname: BRONCHOSCOPY_FOUNDATIONS_LEARN_HREF, query: { section: nextId } })
  }

  function finish() {
    dispatch({ type: 'CONFIRM_THROUGH', index: activeIndex })
    dispatch({ type: 'FINISH' })
  }

  function beginPilotAttempt() {
    if (!paneView) return
    demonstration.stop()
    dispatch({ type: 'SCOPE_RESET', stepId: activeStep.id, view: paneView, scopeCase })
    setPilotAttempts((current) => ({ ...current, [activeStep.id]: true }))
  }

  /** The nearest earlier teaching the learner has already been through, for "Review the teaching". */
  const teachingIndex = (() => {
    for (let index = Math.min(activeIndex - 1, commitments.confirmed); index >= 0; index -= 1) {
      const step = lesson.steps[index]
      if (step.activity === 'teaching' || step.activity === 'debrief') return index
    }
    return -1
  })()

  /* ---------------------------------------------------------------- *
   * The answer on the map, the goals, the spotlight
   * ---------------------------------------------------------------- */
  const treeItem =
    interaction.kind === 'prediction' && interaction.stage.choiceAirways ? interaction : null
  const treeCommittedId = treeItem ? commitments.choices[activeStep.id] : undefined
  const treeAnswer: TreeAnswer | undefined = treeItem
    ? {
        name: `bronch-tree-${activeStep.id}`,
        legend: treeItem.stage.item.stem,
        choices: orderChoices(treeItem.stage.item.id, treeItem.stage.item.choices).map(
          (choice) => ({
            id: choice.id,
            label: choice.label,
            airway: treeItem.stage.choiceAirways?.[choice.id] ?? null,
          }),
        ),
        selectedChoiceId: treeCommittedId ?? pendingChoice[activeStep.id] ?? null,
        committedChoiceId: treeCommittedId ?? null,
        correctChoiceIds:
          treeCommittedId !== undefined ? treeItem.stage.item.correctChoiceIds : undefined,
        onSelect: (choiceId) =>
          setPendingChoice((current) => ({ ...current, [activeStep.id]: choiceId })),
        disabled: treeCommittedId !== undefined || lookingBack,
        hint:
          treeCommittedId === undefined
            ? 'Choose the airway on the map, then check your answer below.'
            : undefined,
      }
    : undefined

  const goalInteraction =
    interaction.kind === 'scope-task' || interaction.kind === 'observe' ? interaction : null
  const goals: readonly ScopeGoal[] = goalInteraction ? goalInteraction.goals : []
  const activeScopeState = session.scope[activeStep.id]
  const goalStatuses = activeScopeState
    ? scopeGoalStatuses(goals, activeScopeState)
    : goals.map((goal) => ({ goal, met: false, claim: scopeGoalClaim(goal.test) }))
  const goalsMetNow = goalStatuses.map((status) => status.met)
  /** Where the tip is now, so a met goal is never read as a statement about the present view. */
  const liveAirwayLine =
    goals.length > 0 && activeScopeState && activeScopeState.location.label !== null
      ? `The tip is in ${activeScopeState.location.fullLabel} now.`
      : null
  const firstUnmetKey = (() => {
    const index = goalsMetNow.findIndex((met) => !met)
    if (index < 0 || !goalInteraction || activeStep.learn) return null
    const key = goalControlKey(goals[index].test)
    return key && goalInteraction.view.controls.includes(key) ? key : null
  })()

  useEffect(() => {
    if (!spotlight || spotlight.stepId !== activeStep.id) return
    const timer = window.setTimeout(() => {
      const control = document.getElementById(scopeControlId(spotlight.key))
      if (!control) return
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      control.focus({ preventScroll: true })
      control.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [activeStep.id, spotlight])

  function showWhere() {
    if (!firstUnmetKey) return
    setSpotlight((current) => ({
      stepId: activeStep.id,
      key: firstUnmetKey,
      count: current?.stepId === activeStep.id ? current.count + 1 : 1,
    }))
  }

  /* ---------------------------------------------------------------- *
   * The Now card
   * ---------------------------------------------------------------- */
  const chunkIds = [...new Set(lesson.steps.map((step) => step.course?.id ?? step.id))]
  const stepPosition = `Part ${chunkIds.indexOf(activeStep.course!.id) + 1} of ${chunkIds.length} · ${activeStep.course!.title}`
  const lookInLine = undefined
  const previousStep = activeIndex > 0 ? lesson.steps[activeIndex - 1] : undefined
  const canGoBack =
    previousStep !== undefined && activeIndex - 1 <= commitments.confirmed && !finished
  const showWhereAction =
    firstUnmetKey && !workDone && !lookingBack
      ? {
          label: spotlight?.stepId === activeStep.id ? 'Highlight it again' : 'Show me where',
          onActivate: showWhere,
          icon: <LocateFixed aria-hidden="true" />,
        }
      : undefined
  const continueAction = {
    label: 'Continue',
    onActivate: () => confirmThrough(activeIndex),
    icon: <ArrowRight aria-hidden="true" />,
  }
  const finishAction = {
    label: 'Finish the section',
    onActivate: finish,
    icon: <ArrowRight aria-hidden="true" />,
  }
  const skipText = skipLabel(interaction.kind, isLastStep)
  const skipAction: NowCardAction | undefined =
    skipText && !workDone && !lookingBack && !finished
      ? { label: skipText, onActivate: () => skipPast(activeIndex) }
      : undefined
  const goalsReason =
    'Continue opens once the goals are met. You can also continue without completing them.'

  const nowModel: NowCardModel = (() => {
    const base: NowCardModel = {
      kicker: stepPosition,
      heading: activeStep.title,
      body: activeStep.instruction,
      where: lookInLine,
      why: activeStep.rationale,
      ...(canGoBack && previousStep
        ? {
            back: {
              label: 'Back',
              onActivate: goBack,
            },
          }
        : {}),
    }
    if (lookingBack) {
      return {
        ...base,
        status:
          'You are looking back at an earlier step. Your current activity and this session’s answers are kept while you review.',
        primary: {
          label: 'Return to the current task',
          onActivate: returnToLive,
          icon: <ArrowRight aria-hidden="true" />,
        },
      }
    }
    if (finished && isLastStep) {
      return { ...base, status: 'You have reached the end of this section.' }
    }
    switch (interaction.kind) {
      case 'read':
        return {
          ...base,
          primary: { label: activeStep.actionLabel, onActivate: () => confirmThrough(activeIndex) },
        }
      case 'prediction': {
        const committed = commitments.choices[activeStep.id] !== undefined
        if (committed)
          return {
            ...base,
            primary: isLastStep ? finishAction : continueAction,
            secondary: { label: 'Try this check again', onActivate: () => retryStep(activeStep) },
          }
        return {
          ...base,
          primary: {
            label: activeStep.actionLabel,
            onActivate: () => commitChoice(activeStep),
            disabled: !pendingChoice[activeStep.id],
            disabledReason: interaction.stage.choiceAirways
              ? 'Choose an airway on the airway map to check your answer.'
              : 'Choose one option to check your answer.',
          },
        }
      }
      case 'sort': {
        if (commitments.sorts[activeStep.id])
          return {
            ...base,
            primary: continueAction,
            secondary: { label: 'Try the set again', onActivate: () => retryStep(activeStep) },
          }
        const remaining = interaction.sort.rows.filter((row) => !sortDraft[row.id]).length
        return {
          ...base,
          primary: {
            label: activeStep.actionLabel,
            onActivate: () => commitSort(activeStep),
            disabled: remaining > 0,
            disabledReason: `${remaining} of ${interaction.sort.rows.length} still to place before checking.`,
          },
        }
      }
      case 'identify': {
        if (commitments.identifies[activeStep.id])
          return {
            ...base,
            primary: continueAction,
            secondary: { label: 'Try the names again', onActivate: () => retryStep(activeStep) },
          }
        const remaining = interaction.identify.rows.filter((row) => !identifyDraft[row.id]).length
        return {
          ...base,
          primary: {
            label: activeStep.actionLabel,
            onActivate: () => commitIdentify(activeStep),
            disabled: remaining > 0,
            disabledReason: `${remaining} of ${interaction.identify.rows.length} still to name before checking.`,
          },
        }
      }
      case 'sequence':
        if (commitments.sequences[activeStep.id])
          return {
            ...base,
            primary: continueAction,
            secondary: { label: 'Try the order again', onActivate: () => retryStep(activeStep) },
          }
        return {
          ...base,
          primary: { label: activeStep.actionLabel, onActivate: () => commitSequence(activeStep) },
        }
      case 'ledger':
        if (workDone)
          return {
            ...base,
            status: 'Done. The record allows that statement.',
            primary: continueAction,
          }
        return {
          ...base,
          status:
            'Work through the accounting on this card, open the worked arithmetic, or continue without completing it.',
        }
      case 'report':
        if (workDone)
          return {
            ...base,
            status: 'Done. Every field says only what the evidence supports.',
            primary: continueAction,
          }
        return {
          ...base,
          status:
            'Give each field a statement the evidence supports, open what it supports, or continue without completing the report.',
        }
      case 'scenario':
        if (workDone)
          return {
            ...base,
            status: 'Done. You worked the case to its end.',
            primary: continueAction,
          }
        return {
          ...base,
          status:
            'Decide on this card, open the reasoning for this observation, or continue without completing the case.',
        }
      case 'scope-task':
        if (activeStep.learn || hasDemonstration) {
          if (demonstration.state || !practicing)
            return {
              ...base,
              status: demonstration.state
                ? 'Demonstration only. These movements are the example, not your own attempt.'
                : 'The example is available before you try. You can also start your own attempt, or continue without it.',
              primary: demonstration.state
                ? demonstration.finished
                  ? { label: 'Try with guidance', onActivate: beginPilotAttempt }
                  : { label: 'Next demonstration movement', onActivate: demonstration.next }
                : { label: 'Watch the example', onActivate: demonstration.start },
              secondary: demonstration.finished
                ? { label: 'Replay the example', onActivate: demonstration.start }
                : { label: 'Try with guidance', onActivate: beginPilotAttempt },
            }
          return {
            ...base,
            status: workDone
              ? scopeDoneStatus(goals, activeStep.learn?.success ?? 'Done. Every goal is met.')
              : activeScopeState?.events.includes('bench-advanced-off-target')
                ? 'You advanced before centering the target. Reset this attempt, establish the aim, and keep it centered as you advance.'
                : 'Use the controls beside the views. The goal checks the resulting movement or view; reset starts a fresh attempt.',
            primary: workDone
              ? isLastStep
                ? finishAction
                : continueAction
              : {
                  ...continueAction,
                  disabled: true,
                  disabledReason: goalsReason,
                },
            secondary: hasDemonstration
              ? { label: 'Replay the example', onActivate: demonstration.start }
              : { label: 'Reset this attempt', onActivate: beginPilotAttempt },
          }
        }
        if (workDone)
          return {
            ...base,
            status: scopeDoneStatus(goals, 'Done. Every goal on this card is met.'),
            primary: isLastStep ? finishAction : continueAction,
          }
        return {
          ...base,
          status: caseFailed
            ? 'The airway model could not be loaded. Reload the page to try again.'
            : !activeScopeState
              ? 'Loading the airway model…'
              : 'Use the scope controls to meet the goals. The goals check the resulting view and your own actions.',
          primary: {
            ...continueAction,
            disabled: true,
            disabledReason: goalsReason,
          },
          secondary: showWhereAction,
        }
      case 'observe':
        if (workDone)
          return {
            ...base,
            status: scopeDoneStatus(goals, 'Done. Every goal on this card is met.'),
            primary: isLastStep ? finishAction : continueAction,
          }
        return {
          ...base,
          status: !activeScopeState
            ? 'Loading the airway model…'
            : 'Meet the goals using the scope controls.',
          primary: {
            ...continueAction,
            disabled: true,
            disabledReason: goalsReason,
          },
          secondary: showWhereAction,
        }
      case 'explain':
        return { ...base, primary: isLastStep ? finishAction : continueAction }
      default:
        return base
    }
  })()

  /* ---------------------------------------------------------------- *
   * The Now card's body
   * ---------------------------------------------------------------- */
  const goalList = (
    <>
      <ul className={stageStyles.taskList} data-step-goals aria-label="The goals on this card">
        {goalStatuses.map(({ goal, met, claim }) => (
          <li key={goal.id} data-goal={goal.id} data-met={met} data-goal-claim={claim}>
            {met ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
            <span>{goal.label}</span>
          </li>
        ))}
      </ul>
      {goals.length > 0 ? (
        <p className={styles.figureCaption} data-goal-basis={scopeGoalsClaim(goals)}>
          {GOAL_BASIS[scopeGoalsClaim(goals)]} {GOAL_MODEL_LIMIT}
          {liveAirwayLine ? ` ${liveAirwayLine}` : ''}
        </p>
      ) : null}
    </>
  )

  function policiesLine(stage: BronchStageItem) {
    return stage.localPolicyIds.length > 0 ? (
      <p className={styles.figureCaption} data-item-policies>
        Depends on local policy:{' '}
        {stage.localPolicyIds.map((id) => LOCAL_POLICY_BY_ID.get(id)?.title ?? id).join(', ')}.{' '}
        {LOCAL_POLICY_NOT_CONFIGURED}
      </p>
    ) : null
  }

  function verdictFor(stage: BronchStageItem, choiceId: string) {
    return (
      <>
        <AnswerVerdict
          item={stage.item}
          choiceId={choiceId}
          outcome="stated"
          timing="immediate-after-commit"
          theme="dark"
          frames={verdictFrames(stage.item)}
        />
        {policiesLine(stage)}
      </>
    )
  }

  function explanationToggle(step: BronchStageStep, label: string) {
    const open = explanationShown[step.id] === true
    return (
      <button
        type="button"
        className={shellStyles.nowSecondary}
        data-show-explanation
        aria-expanded={open}
        onClick={() => toggleExplanation(step.id)}
      >
        {open ? 'Hide the explanation' : label}
      </button>
    )
  }

  function predictionBody(step: BronchStageStep) {
    if (step.interaction.kind !== 'prediction') return null
    const { stage } = step.interaction
    const committedId = commitments.choices[step.id]
    if (committedId) return verdictFor(stage, committedId)
    const selected = pendingChoice[step.id] ?? null
    return (
      <>
        {stage.situation ? (
          <p className={stageStyles.taskInstruction} data-item-situation>
            {stage.situation}
          </p>
        ) : null}
        {stage.media ? <MediaWorkspaceInline stage={stage} /> : null}
        {stage.choiceAirways ? (
          <p className={stageStyles.taskInstruction} data-tree-answer-note>
            Choose the airway on the map.
            {selected
              ? ` Chosen: ${stage.item.choices.find((choice) => choice.id === selected)?.label ?? ''}.`
              : ''}
          </p>
        ) : (
          <fieldset className={stageStyles.choiceList} data-prediction-choices>
            <legend>{stage.item.stem}</legend>
            {orderChoices(stage.item.id, stage.item.choices).map((choice) => (
              <label
                key={choice.id}
                className={stageStyles.choice}
                data-selected={selected === choice.id}
              >
                <input
                  type="radio"
                  name={`bronch-prediction-${step.id}`}
                  value={choice.id}
                  checked={selected === choice.id}
                  onChange={() =>
                    setPendingChoice((current) => ({ ...current, [step.id]: choice.id }))
                  }
                />
                <span>{choice.label}</span>
              </label>
            ))}
          </fieldset>
        )}
        <div className={styles.pilotButtons} data-question-help>
          {explanationToggle(step, 'Show the explanation')}
          {teachingIndex >= 0 ? (
            <button
              type="button"
              className={shellStyles.nowSecondary}
              data-review-teaching
              onClick={() => setViewIndex(teachingIndex)}
            >
              Review the teaching
            </button>
          ) : null}
        </div>
        {explanationShown[step.id] ? (
          <>
            <BronchExplanation item={stage.item} note={EXPLANATION_NOTE} />
            {policiesLine(stage)}
          </>
        ) : null}
      </>
    )
  }

  const nowBody: ReactNode = (() => {
    if (lookingBack) {
      const committedId =
        interaction.kind === 'prediction' ? commitments.choices[activeStep.id] : undefined
      if (interaction.kind === 'prediction' && committedId)
        return verdictFor(interaction.stage, committedId)
      return <StepRecap lesson={lesson} step={activeStep} index={activeIndex} session={session} />
    }
    switch (interaction.kind) {
      case 'prediction':
        return predictionBody(activeStep)
      case 'sort':
        return (
          <>
            {!commitments.sorts[activeStep.id]
              ? explanationToggle(activeStep, 'Show the worked matches')
              : null}
            <BronchSortControl
              sort={interaction.sort}
              draft={sortDraft}
              committed={commitments.sorts[activeStep.id] ?? null}
              revealed={explanationOpen}
              onChange={(rowId, originId) =>
                setSortDraft((current) => ({ ...current, [rowId]: originId }))
              }
            />
          </>
        )
      case 'identify':
        return (
          <>
            {!commitments.identifies[activeStep.id]
              ? explanationToggle(activeStep, 'Show the names')
              : null}
            <BronchIdentifyControl
              identify={interaction.identify}
              draft={identifyDraft}
              committed={commitments.identifies[activeStep.id] ?? null}
              revealed={explanationOpen}
              onChange={(rowId, choiceId) =>
                setIdentifyDraft((current) => ({ ...current, [rowId]: choiceId }))
              }
            />
          </>
        )
      case 'sequence':
        return (
          <>
            {!commitments.sequences[activeStep.id]
              ? explanationToggle(activeStep, 'Show the worked order')
              : null}
            <BronchSequenceControl
              sequence={interaction.sequence}
              order={sequenceOrder(activeStep)}
              committed={commitments.sequences[activeStep.id] ?? null}
              revealed={explanationOpen}
              onChange={(order) =>
                setSequenceDraft((current) => ({ ...current, [activeStep.id]: order }))
              }
            />
          </>
        )
      case 'ledger':
        return (
          <>
            {!workDone ? explanationToggle(activeStep, 'Show the worked arithmetic') : null}
            <BronchLedgerControl
              ledger={interaction.ledger}
              commitment={ledgerCommitment(session, activeStep.id)}
              revealed={explanationOpen}
              onEntry={(rowId, mg) =>
                dispatch({ type: 'LEDGER_ENTRY', stepId: activeStep.id, rowId, mg })
              }
              onTotal={(choiceId, plausibility) =>
                dispatch({ type: 'LEDGER_TOTAL', stepId: activeStep.id, choiceId, plausibility })
              }
            />
          </>
        )
      case 'report':
        return (
          <>
            {!workDone ? explanationToggle(activeStep, 'Show what the evidence supports') : null}
            <BronchReportControl
              report={interaction.report}
              commitment={reportCommitment(session, activeStep.id)}
              revealed={explanationOpen}
              onOption={(fieldId, optionId, supported) =>
                dispatch({
                  type: 'REPORT_OPTION',
                  stepId: activeStep.id,
                  fieldId,
                  optionId,
                  supported,
                })
              }
            />
          </>
        )
      case 'scenario':
        return (
          <>
            {!workDone ? explanationToggle(activeStep, 'Show the reasoning') : null}
            <BronchScenarioControl
              scenario={interaction.scenario}
              integrated
              baseline={
                lesson.section.blocks.find((block) => block.role === 'normal-reference')?.body
              }
              commitment={scenarioCommitment(session, activeStep.id)}
              revealed={explanationOpen}
              onChoice={(frameId, choiceId, plausibility) =>
                dispatch({
                  type: 'SCENARIO_CHOICE',
                  stepId: activeStep.id,
                  frameId,
                  choiceId,
                  plausibility,
                  frameCount: interaction.scenario.frames.length,
                })
              }
            />
          </>
        )
      case 'scope-task':
      case 'observe':
        return (
          <>
            {demonstration.state ? (
              <p role="status" data-demonstration-caption>
                {demonstration.caption}
              </p>
            ) : (
              goalList
            )}
            {activeStep.learn?.support === 'transfer' && !workDone ? (
              <button
                type="button"
                className={shellStyles.nowSecondary}
                onClick={() => setPilotHints((current) => ({ ...current, [activeStep.id]: true }))}
              >
                Show a hint
              </button>
            ) : null}
          </>
        )
      case 'explain': {
        const predictionStep = lesson.steps[lesson.predictionStepIndex]
        const stage =
          predictionStep?.interaction.kind === 'prediction'
            ? predictionStep.interaction.stage
            : undefined
        if (!stage || !predictionStep) return null
        const chosenId = commitments.choices[predictionStep.id]
        return (
          <div data-explain-recap>
            {chosenId ? (
              verdictFor(stage, chosenId)
            ) : (
              <BronchExplanation
                item={stage.item}
                heading="The reasoning behind the earlier question"
                note="You continued without answering that question. Its reasoning is here to read."
              />
            )}
          </div>
        )
      }
      default:
        return null
    }
  })()

  /* ---------------------------------------------------------------- *
   * Current task workspace
   * ---------------------------------------------------------------- */
  const deciding =
    interaction.kind === 'prediction' && commitments.choices[activeStep.id] === undefined
  // Controls belong to actual scope work. A question step has no scope controls to use.
  const scopeLive = interaction.kind === 'scope-task' || interaction.kind === 'observe'
  const controlsEnabled =
    !deciding && !lookingBack && !finished && scopeLive && !demonstration.state && practicing
  const lockedReason = demonstration.state
    ? 'Demonstration. Select Try with guidance to start with a fresh scope.'
    : !practicing
      ? 'Watch the example or select Try with guidance to use the controls.'
      : finished
        ? 'You reached the end of this section. Restart the section to practice again.'
        : deciding
          ? 'The scope rests while this question is open. Its controls are used on the hands-on steps.'
          : !scopeLive && !lookingBack
            ? 'The scope rests on this step. Its controls open on the next hands-on step.'
            : undefined
  const pausedReason =
    !deciding && lookingBack
      ? 'The controls are paused while you look back at an earlier step. Return to the live step to take them.'
      : undefined

  const scenarioFrame =
    interaction.kind === 'scenario'
      ? interaction.scenario.frames[
          Math.min(
            scenarioCommitment(session, activeStep.id).frameIndex,
            interaction.scenario.frames.length - 1,
          )
        ]
      : undefined

  const locationCaption = treeItem
    ? NEUTRAL_LOCATION_CAPTION
    : paneState
      ? scopeLocationCaption(paneState)
      : NEUTRAL_LOCATION_CAPTION

  const simulator: ReactNode = (() => {
    {
      const chunk = activeStep.course!
      if (
        activeStep.activity === 'independent-check' &&
        interaction.kind === 'prediction' &&
        !treeItem
      )
        return null
      if (chunk.kind === 'teach' || chunk.kind === 'debrief') {
        if (chunk.visual !== 'section') return null
        if (activeStep.workspace.kind !== 'media') return null
      }
      if (chunk.kind === 'practice' && !scopeLive) return null
    }
    const workspace = activeStep.workspace
    if (scenarioFrame) {
      return (
        <MonitorPanel
          readings={scenarioFrame.readings}
          caption={interaction.kind === 'scenario' ? interaction.scenario.boundary : ''}
        />
      )
    }
    switch (workspace.kind) {
      case 'monitor':
        return <MonitorPanel readings={workspace.readings} caption={workspace.caption} />
      case 'media':
        return <MediaWorkspace media={workspace.media} caption={workspace.caption} />
      case 'map':
        return (
          <MapWorkspace
            map={scopeCase?.map ?? null}
            lit={treeItem ? [] : workspace.lit}
            caption={workspace.caption}
            locationCaption={NEUTRAL_LOCATION_CAPTION}
            treeAnswer={treeAnswer}
          />
        )
      case 'scope': {
        const view = paneView ?? workspace.view
        if (!paneState) {
          return (
            <p role="status" data-scope-loading={caseFailed ? 'failed' : 'loading'}>
              {caseFailed ? (
                <>
                  The airway model could not be loaded.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setCaseFailed(false)
                      setCaseLoadGeneration((value) => value + 1)
                    }}
                  >
                    Reload the airway model
                  </button>
                </>
              ) : (
                'Loading the airway model…'
              )}
            </p>
          )
        }
        const liveView: ScopeViewSpec = treeItem ? { ...view, litAirways: [] } : view
        const displayedState = demonstration.state ?? paneState
        const target = view.benchTarget
          ? benchTargetObservation(displayedState, view.benchTarget.point)
          : null
        return (
          <>
            {target ? (
              <p role="status" data-target-status>
                Gold target: {target.position}. Practice depth: {Math.round(displayedState.depthMm)}{' '}
                mm; band 12–16 mm. Authored exercise values.
              </p>
            ) : null}
            <ScopePane
              view={liveView}
              state={displayedState}
              map={scopeCase?.map ?? null}
              onCommand={(command, inputMode) => {
                if (!controlsEnabled) return
                dispatch({
                  type: 'SCOPE_COMMAND',
                  stepId: paneStep.id,
                  command,
                  inputMode,
                  view: liveView,
                  scopeCase,
                })
              }}
              onReset={() =>
                dispatch({ type: 'SCOPE_RESET', stepId: paneStep.id, view: liveView, scopeCase })
              }
              controlsEnabled={controlsEnabled}
              lockedReason={lockedReason}
              pausedReason={pausedReason}
              goals={!demonstration.state && activeStep.id === paneStep.id ? goalStatuses : []}
              caption={locationCaption}
              treeAnswer={treeAnswer}
              spotlightKey={
                spotlight?.stepId === activeStep.id ? (spotlight.key as ScopeControlKey) : undefined
              }
            />
          </>
        )
      }
      default:
        return null
    }
  })()

  // Teaching that follows the section's question opens once the learner answered it or moved past it.
  const teachingOpen =
    predictionCommitted ||
    (lesson.predictionStepIndex >= 0 && commitments.confirmed >= lesson.predictionStepIndex)

  const teaching = (
    <StageTeachingScope
      value={{ phase: activeStep.phase, predictionCommitted: teachingOpen, stepId: activeStep.id }}
    >
      <BronchCourseTeaching
        lesson={lesson}
        step={activeStep}
        hintShown={pilotHints[activeStep.id] === true}
      />
    </StageTeachingScope>
  )

  const movedPastTitles = [
    ...new Set(
      progress.movedPastIds.map((id) => lesson.steps.find((step) => step.id === id)?.title ?? id),
    ),
  ]

  const completion =
    finished && isLastStep ? (
      <CompletionCard
        lesson={lesson}
        nextSectionId={nextSection && isBronchSectionId(nextSection.id) ? nextSection.id : null}
        movedPast={movedPastTitles}
      />
    ) : null

  const header = (
    <SectionHeader
      breadcrumb={{ href: BRONCHOSCOPY_FOUNDATIONS_NAV_BASE, label: 'Bronchoscopy foundations' }}
      kicker={`Section ${lesson.index + 1} of ${lesson.total} · Estimated ${lesson.minutes} min`}
      title={lesson.title}
      sectionsControl={
        <SectionsDrawer
          pathway={bronchoscopyFoundationsPathway}
          activeSectionId={lesson.sectionId}
          position={`${lesson.index + 1} of ${lesson.total}`}
          label="Sections"
          onSelect={goToSection}
        />
      }
      helpRef={helpButtonRef}
      onHelp={() => setHelpOpen(true)}
      onRestart={onRestart}
      restartLabel="Restart section"
      saveAndExitHref={BRONCHOSCOPY_FOUNDATIONS_NAV_BASE}
    />
  )

  const helpDialog = (
    <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} returnFocusTo={helpButtonRef}>
      <p>
        <strong>{activeStep.title}.</strong> {activeStep.instruction}
      </p>
      {lookInLine}
      {activeStep.rationale ? <p>{activeStep.rationale}</p> : null}
      <p>
        Every question and activity here is optional. You can open the explanation before answering,
        try again, go back to the teaching, or continue without answering.
      </p>
      {firstUnmetKey && !workDone ? (
        <button
          type="button"
          className={shellStyles.nowSecondary}
          onClick={() => {
            setHelpOpen(false)
            showWhere()
          }}
        >
          <LocateFixed aria-hidden="true" /> Show me where
        </button>
      ) : null}
    </HelpDialog>
  )

  return (
    <BronchoscopyFoundationsModuleFrame
      locale={locale}
      activeHref={BRONCHOSCOPY_FOUNDATIONS_LEARN_HREF}
      activityMode
      courseMode
    >
      <StageSourcesScope>
        <BronchCourseLayout
          stepId={activeStep.id}
          presentation={activeStep.course!.presentation}
          activity={demonstration.state ? 'demonstration' : (activeStep.activity ?? 'teaching')}
          header={header}
          model={nowModel}
          skip={skipAction}
          teaching={teaching}
          workspace={simulator}
          response={nowBody}
          completion={completion}
          focusRef={nowFocusRef}
          storageFailed={storageFailed}
          overlay={helpDialog}
          footer={
            <>
              <p>
                Professional education for supervised learning. Follow current device instructions,
                local policy and supervising judgment. Reloading starts this section again from its
                first step: answers and scope positions are not saved. Where you left off and the
                sections you open or mark stay on this device.
              </p>
              <ReviewLaterToggle sectionId={lesson.sectionId} />
              <StageSourcesFooter
                count={stageSources.evidenceIds.length}
                label="Sources for this section"
                claimsVisible
              >
                <BronchSourceList records={stageSources.records} />
              </StageSourcesFooter>
            </>
          }
        />
      </StageSourcesScope>
    </BronchoscopyFoundationsModuleFrame>
  )
}

/* ------------------------------------------------------------------ *
 * Pieces
 * ------------------------------------------------------------------ */

/** A prediction's own still, inside the Now card rather than the Simulator panel. */
function MediaWorkspaceInline({ stage }: { readonly stage: BronchStageItem }) {
  if (!stage.media) return null
  return <MediaWorkspace media={[stage.media]} caption="The image this decision is about." />
}

/** The learner's own review-later mark for this section. */
function ReviewLaterToggle({ sectionId }: { readonly sectionId: BronchSectionId }) {
  const { record, hydrated } = useBronchoscopyFoundationsRecord()
  const on = record.reviewLaterSectionIds.includes(sectionId)
  return (
    <button
      type="button"
      className={shellStyles.nowSecondary}
      aria-pressed={on}
      disabled={!hydrated}
      data-review-later-toggle={on}
      onClick={() =>
        writeBronchSelfPacedRecord(withReviewLater(readBronchSelfPacedRecord(), sectionId, !on))
      }
    >
      Review this section later
    </button>
  )
}

function recapLines(
  lesson: BronchStageLesson,
  step: BronchStageStep,
  index: number,
  session: BronchStageSession,
): readonly string[] {
  const { commitments } = session
  const movedPast = index <= commitments.confirmed && !commitments.performedIds.includes(step.id)
  switch (step.interaction.kind) {
    case 'prediction': {
      const chosen = commitments.choices[step.id]
      const label = step.interaction.stage.item.choices.find(
        (choice) => choice.id === chosen,
      )?.label
      return label ? [`Answered: ${label}`] : movedPast ? ['Moved on without answering.'] : []
    }
    case 'sort':
      return commitments.sorts[step.id]
        ? ['Placed the set and read the reasoning.']
        : movedPast
          ? ['Moved on without placing the set.']
          : []
    case 'identify':
      return commitments.identifies[step.id]
        ? ['Named the views and read the reasoning.']
        : movedPast
          ? ['Moved on without naming the views.']
          : []
    case 'sequence':
      return commitments.sequences[step.id]
        ? ['Ordered the steps and read the reasoning.']
        : movedPast
          ? ['Moved on without ordering the steps.']
          : []
    case 'ledger':
      return ledgerCommitment(session, step.id).heldTotalChoiceId
        ? ['The statement the record allows.']
        : movedPast
          ? ['Moved on without completing the accounting.']
          : []
    case 'report': {
      const report = reportCommitment(session, step.id)
      const done = step.interaction.report.fields.filter((field) => report.chosen[field.id]).length
      return done
        ? [
            `Report fields filled from the evidence: ${done} of ${step.interaction.report.fields.length}.`,
          ]
        : movedPast
          ? ['Moved on without completing the report.']
          : []
    }
    case 'scenario': {
      const scenario = scenarioCommitment(session, step.id)
      return scenario.done
        ? ['Worked the case to its end.']
        : movedPast
          ? ['Moved on without completing the case.']
          : []
    }
    case 'scope-task':
    case 'observe': {
      const state = session.scope[step.id]
      const met = state
        ? scopeGoalStatuses(step.interaction.goals, state)
            .filter((status) => status.met)
            .map((status) => status.goal.label)
        : []
      return movedPast ? [...met, 'Moved on before every goal was met.'] : met
    }
    case 'read':
    case 'explain':
      return commitments.confirmed >= index ? ['Read.'] : []
    default:
      return []
  }
}

function StepRecap({
  lesson,
  step,
  index,
  session,
}: {
  readonly lesson: BronchStageLesson
  readonly step: BronchStageStep
  readonly index: number
  readonly session: BronchStageSession
}) {
  const lines = recapLines(lesson, step, index, session)
  if (lines.length === 0) return null
  return (
    <ul className={stageStyles.taskList} data-step-review>
      {lines.map((line) => (
        <li key={line} data-met="true">
          <Check aria-hidden="true" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  )
}

function CompletionCard({
  lesson,
  nextSectionId,
  movedPast,
}: {
  readonly lesson: BronchStageLesson
  readonly nextSectionId: BronchSectionId | null
  readonly movedPast: readonly string[]
}) {
  const { record, hydrated } = useBronchoscopyFoundationsRecord()
  const reviewed = record.reviewedSectionIds.includes(lesson.sectionId)
  const integratedCase = CAPSTONE_CASES.find((entry) => entry.pairedSectionId === lesson.sectionId)
  const practiceCase = microCasesForSection(lesson.sectionId)[0]
  const { section } = lesson
  return (
    <section
      className={styles.completion}
      data-section-completion
      data-reviewed={reviewed}
      aria-label="End of section"
    >
      <p className={styles.kicker}>End of section</p>
      <p data-completion-reviewed>
        {reviewed
          ? 'This section is marked reviewed on this device.'
          : 'This section is not marked reviewed.'}{' '}
        The mark is yours to change; it records nothing about your answers.{' '}
        <button
          type="button"
          className={styles.completionLink}
          data-toggle-reviewed
          disabled={!hydrated}
          onClick={() =>
            writeBronchSelfPacedRecord(
              withSectionReviewed(readBronchSelfPacedRecord(), lesson.sectionId, !reviewed),
            )
          }
        >
          {reviewed ? 'Undo: not reviewed yet' : 'Mark as reviewed'}
        </button>
      </p>
      {movedPast.length > 0 ? (
        <p data-completion-moved-past>
          You moved on without completing: {movedPast.join('; ')}. Restart the section whenever you
          want to try them.
        </p>
      ) : null}
      {section.physicalSkillNote ? (
        <p data-completion-physical-skill>
          <strong>What the app cannot see.</strong> {section.physicalSkillNote}
        </p>
      ) : null}
      <p data-completion-competence>
        Self-paced online learning does not establish procedural competence.
      </p>
      {integratedCase ? (
        <p>
          This idea also appears in the integrated case{' '}
          <Link
            className={styles.completionLink}
            href={`${BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF}#case-${integratedCase.id}`}
            data-paired-integrated-case={integratedCase.id}
          >
            {integratedCase.presentationTitle}
          </Link>
          .
        </p>
      ) : null}
      {practiceCase ? (
        <p>
          A short case uses this idea somewhere else:{' '}
          <Link
            className={styles.completionLink}
            href={bronchCaseLinkTarget(practiceCase.id)}
            data-paired-practice-case={practiceCase.id}
          >
            {practiceCase.presentationTitle}
          </Link>
          .
        </p>
      ) : null}
      <div className={styles.completionActions}>
        {nextSectionId ? (
          <Link
            className={shellStyles.nowPrimary}
            href={bronchSectionLinkTarget(nextSectionId)}
            data-next-section={nextSectionId}
          >
            {lesson.steps[0]?.learn
              ? `Next lesson: ${bronchSection(nextSectionId).title}`
              : 'Continue to the next section'}
          </Link>
        ) : (
          <Link
            className={shellStyles.nowPrimary}
            href={BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF}
            data-next-section="assess"
          >
            Try the integrated cases
          </Link>
        )}
        <Link className={shellStyles.nowSecondary} href={BRONCHOSCOPY_FOUNDATIONS_NAV_BASE}>
          Back to the overview
        </Link>
      </div>
    </section>
  )
}
