'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, Circle, LocateFixed } from 'lucide-react'

import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { nextPathwaySection } from '@/features/learning-module/curriculum/types'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { type NowCardModel } from '@/features/learning-module/stage/NowCard'
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
import { bronchLearnRecordId } from '../../content/lessonVersions'
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
  readBronchRecord,
  withFirstAttempt,
  withSectionCompleted,
  withSectionVisited,
  withInspectionSnapshot,
  writeBronchRecord,
  type BronchSectionPerformance,
} from '../../engine/learnProgress'
import { NEUTRAL_LOCATION_CAPTION, scopeLocationCaption } from '../../engine/scope/scopeCaption'
import type { ScopeCase } from '../../engine/scope/scopeCase'
import { scopeGoalStatuses } from '../../engine/scope/scopeGoalEvaluation'
import { describeScopePerformance } from '../../engine/scope/scopeMetrics'
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
import styles from './bronch-stage.module.css'
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
 * the events since the step began. The host owns the commitments — which choice was committed,
 * which set was placed, which frame a scenario is on — and the view around them: the step the
 * learner is looking at when it is not the live one, the choice not yet committed, whether help is
 * open, and the Now card that makes every step one thing. Nothing about a commitment is
 * persisted; a reload starts the section at its first step, and the only things written are the
 * first attempts and the completion record, with how the scope was driven (A18).
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
  const [initialRecord] = useState(readBronchRecord)
  const recordRef = useRef(initialRecord)
  const lesson = useMemo(() => {
    const base = bronchStageLesson(sectionId as BronchStageLesson['sectionId'])
    return {
      ...base,
      steps: base.steps.map(
        (step): BronchStageStep =>
          step.course?.learnerRecord
            ? { ...step, interaction: { kind: 'report', report: inspectionReport(initialRecord) } }
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
  const saveRecord = useCallback((record: ReturnType<typeof readBronchRecord>) => {
    recordRef.current = record
    const failed = !writeBronchRecord(record)
    queueMicrotask(() => setStorageFailed(failed))
  }, [])
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const nowFocusRef = useRef<HTMLDivElement>(null)
  const completionRecorded = useRef(false)
  const previousFocusStep = useRef<string | null>(null)

  const { commitments } = session
  const progress = deriveStageProgress(lesson, session)
  const liveIndex = progress.liveIndex
  const heldIndex = Math.min(liveIndex, commitments.confirmed + 1)
  const activeIndex = Math.max(0, Math.min(viewIndex ?? heldIndex, lesson.steps.length - 1))
  const activeStep = lesson.steps[activeIndex]
  const lookingBack = viewIndex !== null && viewIndex < heldIndex
  const isLastStep = activeIndex === lesson.steps.length - 1
  const performedIds = progress.performedIds
  const predictionCommitted = progress.predictionCommitted
  const finished = commitments.finished
  const interaction = activeStep.interaction
  const workDone = stepWorkDone(lesson, activeStep, activeIndex, session)
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
    saveRecord(withSectionVisited(recordRef.current, lesson.sectionId))
  }, [lesson.sectionId, saveRecord])

  const performance = useMemo((): BronchSectionPerformance | null => {
    {
      const states = lesson.steps
        .filter((step) => step.interaction.kind === 'scope-task')
        .flatMap((step) => (session.scope[step.id] ? [session.scope[step.id]] : []))
      if (!states.length) return null
      return {
        inputModes: [...new Set(states.flatMap((state) => state.inputModes))],
        assistsUsed: [
          ...new Set(states.flatMap((state) => state.assistsUsed)),
          'guided-practice',
          ...(Object.values(pilotHints).some(Boolean) ? ['requested-hint'] : []),
        ],
        unaided: false,
      }
    }
  }, [lesson.steps, session.scope, pilotHints])

  useEffect(() => {
    if (!finished || completionRecorded.current) return
    completionRecorded.current = true
    let record = withSectionCompleted(recordRef.current, lesson.sectionId, performance)
    if (lesson.sectionId === 'systematic-survey') {
      const surveyStep = lesson.steps.find((step) => step.interaction.kind === 'scope-task')
      const state = surveyStep ? session.scope[surveyStep.id] : undefined
      if (state) record = withInspectionSnapshot(record, state.ledger)
    }
    saveRecord(record)
  }, [finished, lesson.sectionId, lesson.steps, session.scope, performance, saveRecord])

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

  function commitChoice(step: BronchStageStep) {
    if (step.interaction.kind !== 'prediction') return
    const choiceId = pendingChoice[step.id]
    if (!choiceId) return
    dispatch({ type: 'COMMIT_CHOICE', stepId: step.id, choiceId })
    const key = `${bronchLearnRecordId(lesson.sectionId)}:${step.interaction.stage.item.id}`
    saveRecord(
      withFirstAttempt(
        recordRef.current,
        key,
        choiceId,
        undefined,
        pilotHints[step.id] ? 'reviewed-teaching' : 'learn-after-teaching',
      ),
    )
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

  function goBack() {
    const target = activeIndex - 1
    if (target < 0 || !performedIds.has(lesson.steps[target].id)) return
    if (activeStep.activity === 'independent-check' && !workDone)
      setPilotHints((current) => ({ ...current, [activeStep.id]: true }))
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

  function retryPilotChoice() {
    dispatch({ type: 'RETRY_LEARN_CHOICE', stepId: activeStep.id })
    setPendingChoice((current) => ({ ...current, [activeStep.id]: '' }))
  }

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
            ? 'Choose the airway on the map, then submit your choice below.'
            : undefined,
      }
    : undefined

  const goalInteraction =
    interaction.kind === 'scope-task' || interaction.kind === 'observe' ? interaction : null
  const goals: readonly ScopeGoal[] = goalInteraction ? goalInteraction.goals : []
  const activeScopeState = session.scope[activeStep.id]
  const goalStatuses = activeScopeState
    ? scopeGoalStatuses(goals, activeScopeState)
    : goals.map((goal) => ({ goal, met: false }))
  const goalsMetNow = goalStatuses.map((status) => status.met)
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
  const canGoBack = previousStep !== undefined && performedIds.has(previousStep.id) && !finished
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
          'Done. You are looking back at an earlier step. Your current activity and earlier responses are preserved during this review.',
        primary: {
          label: 'Return to the current task',
          onActivate: returnToLive,
          icon: <ArrowRight aria-hidden="true" />,
        },
      }
    }
    if (finished && isLastStep) {
      return { ...base, status: 'Done. This section has been worked through.' }
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
            ...(activeStep.learn || activeStep.course
              ? { secondary: { label: 'Try this check again', onActivate: retryPilotChoice } }
              : {}),
          }
        return {
          ...base,
          status: false
            ? 'The Simulator panel keeps its view while you decide. Its controls unlock once you submit your prediction.'
            : undefined,
          primary: {
            label: activeStep.actionLabel,
            onActivate: () => commitChoice(activeStep),
            disabled: !pendingChoice[activeStep.id],
            disabledReason: interaction.stage.choiceAirways
              ? 'Choose an airway on the airway map to enable this.'
              : 'Choose one option to enable this.',
          },
        }
      }
      case 'sort': {
        if (commitments.sorts[activeStep.id]) return { ...base, primary: continueAction }
        const remaining = interaction.sort.rows.filter((row) => !sortDraft[row.id]).length
        return {
          ...base,
          primary: {
            label: activeStep.actionLabel,
            onActivate: () => commitSort(activeStep),
            disabled: remaining > 0,
            disabledReason: `${remaining} of ${interaction.sort.rows.length} still to place.`,
          },
        }
      }
      case 'identify': {
        if (commitments.identifies[activeStep.id]) return { ...base, primary: continueAction }
        const remaining = interaction.identify.rows.filter((row) => !identifyDraft[row.id]).length
        return {
          ...base,
          primary: {
            label: activeStep.actionLabel,
            onActivate: () => commitIdentify(activeStep),
            disabled: remaining > 0,
            disabledReason: `${remaining} of ${interaction.identify.rows.length} still to name.`,
          },
        }
      }
      case 'sequence':
        if (commitments.sequences[activeStep.id]) return { ...base, primary: continueAction }
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
            'Waiting for the accounting on this card. The step is done when the answer under the table holds.',
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
            'Waiting for the report on this card: every field needs a statement the evidence supports.',
        }
      case 'scenario':
        if (workDone)
          return { ...base, status: 'Done. Every frame decided.', primary: continueAction }
        return { ...base, status: 'Waiting for the decision on this card.' }
      case 'scope-task':
        if (activeStep.learn || hasDemonstration) {
          if (demonstration.state || !practicing)
            return {
              ...base,
              status: demonstration.state
                ? 'Demonstration only. These movements do not count toward your goals or record.'
                : 'The example is available before any answer. You can also start your own attempt.',
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
              ? (activeStep.learn?.success ?? 'Done. Every authored goal is met.')
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
                  disabledReason: 'Complete the movement or view goals before continuing.',
                },
            secondary: hasDemonstration
              ? { label: 'Replay the example', onActivate: demonstration.start }
              : { label: 'Reset this attempt', onActivate: beginPilotAttempt },
          }
        }
        if (workDone)
          return {
            ...base,
            status: 'Done. Every goal on this card is met.',
            primary: continueAction,
          }
        return {
          ...base,
          status: caseFailed
            ? 'The airway model could not be loaded. Reload the page to try again.'
            : !activeScopeState
              ? 'Loading the airway model…'
              : 'Use the scope controls to complete the goals. The goals check the resulting view and recorded actions.',
          primary: {
            ...continueAction,
            disabled: true,
            disabledReason: 'Complete the scope goals before continuing.',
          },
          secondary: showWhereAction,
        }
      case 'observe':
        if (workDone) return { ...base, status: 'Done.', primary: continueAction }
        return {
          ...base,
          status: !activeScopeState
            ? 'Loading the airway model…'
            : 'Complete the goals using the scope controls.',
          primary: {
            ...continueAction,
            disabled: true,
            disabledReason: 'Complete the observation goals before continuing.',
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
    <ul className={stageStyles.taskList} data-step-goals aria-label="The goals on this card">
      {goalStatuses.map(({ goal, met }) => (
        <li key={goal.id} data-goal={goal.id} data-met={met}>
          {met ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
          <span>{goal.label}</span>
        </li>
      ))}
    </ul>
  )

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
        {stage.localPolicyIds.length > 0 ? (
          <p className={styles.figureCaption} data-item-policies>
            Depends on local policy:{' '}
            {stage.localPolicyIds.map((id) => LOCAL_POLICY_BY_ID.get(id)?.title ?? id).join(', ')}.{' '}
            {LOCAL_POLICY_NOT_CONFIGURED}
          </p>
        ) : null}
      </>
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
          <BronchSortControl
            sort={interaction.sort}
            draft={sortDraft}
            committed={commitments.sorts[activeStep.id] ?? null}
            onChange={(rowId, originId) =>
              setSortDraft((current) => ({ ...current, [rowId]: originId }))
            }
          />
        )
      case 'identify':
        return (
          <BronchIdentifyControl
            identify={interaction.identify}
            draft={identifyDraft}
            committed={commitments.identifies[activeStep.id] ?? null}
            onChange={(rowId, choiceId) =>
              setIdentifyDraft((current) => ({ ...current, [rowId]: choiceId }))
            }
          />
        )
      case 'sequence':
        return (
          <BronchSequenceControl
            sequence={interaction.sequence}
            order={sequenceOrder(activeStep)}
            committed={commitments.sequences[activeStep.id] ?? null}
            onChange={(order) =>
              setSequenceDraft((current) => ({ ...current, [activeStep.id]: order }))
            }
          />
        )
      case 'ledger':
        return (
          <BronchLedgerControl
            ledger={interaction.ledger}
            commitment={ledgerCommitment(session, activeStep.id)}
            onEntry={(rowId, mg) =>
              dispatch({ type: 'LEDGER_ENTRY', stepId: activeStep.id, rowId, mg })
            }
            onTotal={(choiceId, plausibility) =>
              dispatch({ type: 'LEDGER_TOTAL', stepId: activeStep.id, choiceId, plausibility })
            }
          />
        )
      case 'report':
        return (
          <BronchReportControl
            report={interaction.report}
            commitment={reportCommitment(session, activeStep.id)}
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
        )
      case 'scenario':
        return (
          <BronchScenarioControl
            scenario={interaction.scenario}
            integrated
            baseline={
              lesson.section.blocks.find((block) => block.role === 'normal-reference')?.body
            }
            commitment={scenarioCommitment(session, activeStep.id)}
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
        const chosenId = predictionStep ? commitments.choices[predictionStep.id] : undefined
        return (
          <>
            {stage && chosenId ? <div data-explain-recap>{verdictFor(stage, chosenId)}</div> : null}
            {performance ? (
              <p className={stageStyles.taskInstruction} data-scope-performance>
                How the scope was driven on this section:{' '}
                {describeScopePerformanceWords(performance)}.
              </p>
            ) : null}
          </>
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
  // Controls belong to actual scope work. A pending independent response stays isolated.
  const scopeLive = interaction.kind === 'scope-task' || interaction.kind === 'observe'
  const controlsEnabled =
    !deciding && !lookingBack && !finished && scopeLive && !demonstration.state && practicing
  const lockedReason = demonstration.state
    ? 'Demonstration. Select Try with guidance to start with a fresh scope.'
    : !practicing
      ? 'Watch the example or select Try with guidance to use the controls.'
      : finished
        ? 'Lesson completed. Restart the section for new practice.'
        : deciding
          ? 'The controls are locked while you decide. Commit your answer to take them.'
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

  const teaching = (
    <StageTeachingScope
      value={{ phase: activeStep.phase, predictionCommitted, stepId: activeStep.id }}
    >
      <BronchCourseTeaching
        lesson={lesson}
        step={activeStep}
        hintShown={pilotHints[activeStep.id] === true}
      />
    </StageTeachingScope>
  )

  const completion =
    finished && isLastStep ? (
      <CompletionCard
        lesson={lesson}
        nextSectionId={nextSection && isBronchSectionId(nextSection.id) ? nextSection.id : null}
        performance={performance}
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
                local policy and supervising judgment. Reloading restarts an unfinished section;
                completed work and first responses remain on this device. An unfinished scope
                position is not saved.
              </p>
              <StageSourcesFooter
                count={stageSources.evidenceIds.length}
                label="Sources for this section"
                claimsVisible={!deciding}
              >
                <BronchSourceList records={stageSources.records} claimsVisible={!deciding} />
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

function describeScopePerformanceWords(performance: BronchSectionPerformance): string {
  if (performance.assistsUsed.includes('guided-practice'))
    return `${performance.inputModes.join(', ') || 'on-screen controls'} during guided screen-based learning, assisted by ${performance.assistsUsed.join(', ')}`
  return describeScopePerformance({
    inputModes: performance.inputModes as ScopeRuntimeState['inputModes'],
    assistsUsed: performance.assistsUsed as ScopeRuntimeState['assistsUsed'],
  })
}

function recapLines(
  lesson: BronchStageLesson,
  step: BronchStageStep,
  index: number,
  session: BronchStageSession,
): readonly string[] {
  const { commitments } = session
  switch (step.interaction.kind) {
    case 'prediction': {
      const chosen = commitments.choices[step.id]
      const label = step.interaction.stage.item.choices.find(
        (choice) => choice.id === chosen,
      )?.label
      return label ? [`Committed: ${label}`] : []
    }
    case 'sort': {
      const answers = commitments.sorts[step.id]
      if (!answers) return []
      const held = step.interaction.sort.rows.filter((row) => answers[row.id] === row.origin).length
      return [`Placed the set: ${held} of ${step.interaction.sort.rows.length} held.`]
    }
    case 'identify': {
      const answers = commitments.identifies[step.id]
      if (!answers) return []
      const held = step.interaction.identify.rows.filter(
        (row) => answers[row.id] === row.answerId,
      ).length
      return [`Named the views: ${held} of ${step.interaction.identify.rows.length} held.`]
    }
    case 'sequence': {
      const order = commitments.sequences[step.id]
      if (!order) return []
      const held = order.filter(
        (stepId, position) =>
          step.interaction.kind === 'sequence' &&
          step.interaction.sequence.steps[position]?.id === stepId,
      ).length
      return [`Ordered the steps: ${held} of ${order.length} in place.`]
    }
    case 'ledger':
      return ledgerCommitment(session, step.id).heldTotalChoiceId
        ? ['The statement the record allows.']
        : []
    case 'report': {
      const report = reportCommitment(session, step.id)
      const done = step.interaction.report.fields.filter((field) => report.chosen[field.id]).length
      return done
        ? [`Report fields supported: ${done} of ${step.interaction.report.fields.length}.`]
        : []
    }
    case 'scenario': {
      const scenario = scenarioCommitment(session, step.id)
      return scenario.done ? ['Every frame decided.'] : []
    }
    case 'scope-task':
    case 'observe': {
      const state = session.scope[step.id]
      if (!state) return []
      return scopeGoalStatuses(step.interaction.goals, state)
        .filter((status) => status.met)
        .map((status) => status.goal.label)
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
  performance,
}: {
  readonly lesson: BronchStageLesson
  readonly nextSectionId: BronchSectionId | null
  readonly performance: BronchSectionPerformance | null
}) {
  const capstoneCase = CAPSTONE_CASES.find((entry) => entry.pairedSectionId === lesson.sectionId)
  const practiceCase = microCasesForSection(lesson.sectionId)[0]
  const { section } = lesson
  return (
    <section
      className={styles.completion}
      data-section-completion
      aria-label="Section worked through"
    >
      <p className={styles.kicker}>Worked through</p>
      <p>
        This section is on your record as an activity completed. Nothing here is a mark; the first
        decisions you made are kept as you made them.
      </p>
      {performance ? (
        <p data-completion-performance>
          The scope was driven by {describeScopePerformanceWords(performance)}.
        </p>
      ) : null}
      {section.physicalSkillNote ? (
        <p data-completion-physical-skill>
          <strong>What the app cannot see.</strong> {section.physicalSkillNote}
        </p>
      ) : null}
      {capstoneCase ? (
        <p>
          This idea returns in the capstone as <strong>{capstoneCase.presentationTitle}</strong>.
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
            Go to the capstone
          </Link>
        )}
        <Link className={shellStyles.nowSecondary} href={BRONCHOSCOPY_FOUNDATIONS_NAV_BASE}>
          Back to the overview
        </Link>
      </div>
    </section>
  )
}
