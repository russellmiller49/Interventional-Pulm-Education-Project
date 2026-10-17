'use client'

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { ArrowRight, Check } from 'lucide-react'

import { ChoiceReasoningFeedback } from '@/features/learning-module/components/ChoiceReasoningFeedback'
import { nextPathwaySection } from '@/features/learning-module/curriculum/types'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import type { ContextStripItem } from '@/features/learning-module/stage/ContextStrip'
import { FlowContent } from '@/features/learning-module/stage/FlowContent'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { NowCard, type NowCardModel } from '@/features/learning-module/stage/NowCard'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { SectionsDrawer } from '@/features/learning-module/stage/SectionsDrawer'
import type { StagePhase } from '@/features/learning-module/stage/stageModel'
import { StageSourcesFooter } from '@/features/learning-module/stage/StageSourcesFooter'
import { StageSourcesScope } from '@/features/learning-module/stage/StageSourcesScope'
import { StageTeachingScope } from '@/features/learning-module/stage/StageTeachingScope'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'
import { useRouter } from '@/i18n/navigation'

import { MCS_AF_TRIGGER_CONTAINMENT, mcsAfTriggerLimitApplies } from '../../content/afTriggerLimit'
import { mcsClaimChecksForSection } from '../../content/claimSourceMap'
import { mcsDeviceStatusLabel } from '../../content/deviceNaming'
import { mcsExplainReflection } from '../../content/explainReflections'

import { mcsStepHint } from '../../content/stepHints'
import { mcsLearnControls, type McsLearnControlId } from '../../content/learnControls'
import { mcsMapAnswerTargets } from '../../content/mapAnswerTargets'
import { mcsPathway } from '../../content/pathwayResolver'
import { mcsSpineStop, MCS_SUPPORT_SPINE, type McsSpineStopId } from '../../content/supportSpine'
import { mcsStageSources } from '../../content/stageSources'
import {
  buildMcsStageLesson,
  mcsMountStepIndex,
  mcsStageStories,
  type McsStageLesson,
  type McsStageSurfaceId,
} from '../../content/stageLessons'
import { createInitialMcsState, mcsReducer } from '../../engine'
import { recordMcsVisit } from '../../engine/learningProgress'
import { McsControls } from '../McsControls'
import { McsClaimSourceChecks } from '../McsClaimSourceChecks'
import { McsGlossary } from '../McsGlossary'
import type { McsAction, McsDerivedMetrics, McsSimulationState } from '../../engine/types'
import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import type {
  CirculationMapAnswer,
  CirculationMapEmphasis,
} from '../circulation-map/CirculationMap'
import { McsModuleFrame } from '../McsModuleFrame'
import { McsSimulatorPane } from './McsSimulatorPane'
import { McsSectionRecap } from './McsSectionRecap'
import { McsSourceList } from './McsSourceList'
import { McsStoryProblems } from './McsStoryProblems'
import { McsTeachingColumn } from './McsTeachingColumn'
import { McsTaskControls } from './McsTaskControls'
import { McsIntroTeaching } from './McsIntroTeaching'
import {
  McsCapturedResults,
  McsDeviceComparisonTable,
  McsFlowArithmetic,
  type McsComparisonRecords,
} from './McsCapturedResults'
import { advanceMcsSimulation } from '../../engine/model'
import {
  isMcsLearningActionPermitted,
  captureMcsDeviceComparison,
  mcsTeachingSetup,
  mcsObservedDirection,
  MCS_OBSERVATION_SECONDS,
} from '../../engine/learningSession'
import styles from './mcs-stage.module.css'
import flowStyles from './mcs-flow.module.css'
import { McsClockBar } from './McsClockBar'
import { McsPrerequisiteReference, mcsHasPrerequisiteReference } from './McsPrerequisiteReference'
import { McsTaskPresentation } from './McsTaskPresentation'
import { useWorkspaceLayout } from './useWorkspaceLayout'

/** MCS-local self-paced host. Answers and observations live only in this mounted session.
 * Navigation never manufactures a response, performed action, capture or achievement.
 * Historical grading records are read-only; only topic visits and location are saved.
 *
 * The section is laid out the way the ICU hemodynamics and mechanical ventilation sections are
 * (owner, 2026-10-15 and 2026-10-16): the text on the left — the task card with its teaching and
 * its question, then the section's purpose and task list — and the simulator on the right, each
 * scrolling on its own in a desktop workspace that does not scroll as a page. The task card's way
 * forward is pinned to the foot of the text pane. On a narrower window, or with enlarged text,
 * the two stack: text first, then the simulator.
 */

const LOOKING_BACK = 'An earlier task, as you left it. Return to the current task to go on.'

/*
 * The sentence after the outcome, in this module's own words.
 *
 * The shared card's defaults were written for signal-recognition items: "The cues support this
 * read", and for a partly-correct answer "One more cue changes the working frame", which is the
 * hemodynamics module's vocabulary. Every prediction here asks what the circulation will do, and
 * every transfer asks for a response — the best first response, the safest immediate response,
 * the reasoning that selects the next mechanism — so the card says which of those it is judging.
 * The stories are predictions too. The unsafe frame under a prediction says that acting on the
 * expectation is the harm, because after the learner-review round no prediction option is a move.
 */
const PREDICTION_FRAMES = {
  best: 'That is what the circulation does.',
  'reasonable-but-incomplete':
    'Defensible as far as it goes, and it leaves the limiting problem unnamed.',
  'incorrect-mechanism': 'That mechanism would move the readings differently.',
  unsafe: 'Stopping here — acting on that expectation could harm a real patient.',
} as const

const RESPONSE_FRAMES = {
  best: 'That is the response this pattern calls for.',
  'reasonable-but-incomplete': 'Defensible as far as it goes, and it leaves a step out.',
  'incorrect-mechanism': 'That response answers a different problem.',
} as const

export function mcsVerdictFrames(item: ClinicalLearningItem) {
  return item.itemType === 'transfer-case' || item.itemType === 'management-decision'
    ? RESPONSE_FRAMES
    : PREDICTION_FRAMES
}

const GUIDED_ACTION_IDS: Readonly<Record<string, McsAction>> = {
  'inspect:arterial': { type: 'INSPECT', id: 'arterial' },
  'inspect:preload': { type: 'INSPECT', id: 'preload' },
  'inspect:device': { type: 'INSPECT', id: 'device' },
  'team:escalate': { type: 'ESCALATE' },
  'device:select:iabp': { type: 'SELECT_DEVICE', device: 'iabp' },
  'device:select:impella': { type: 'SELECT_DEVICE', device: 'impella' },
  'device:select:lvad': { type: 'SELECT_DEVICE', device: 'lvad' },
}

interface Progression {
  readonly taskBaseline: McsSimulationState | null
  readonly capturedAfter: McsSimulationState | null
  readonly comparisons: McsComparisonRecords
  readonly snapshots: Readonly<
    Record<
      string,
      { readonly state: McsSimulationState; readonly before: McsSimulationState | null }
    >
  >
  readonly firstObservationByStepId: Readonly<Record<string, string>>
  readonly index: number
  readonly visitedStepIds: readonly string[]
  readonly furthestPerformed: number
  readonly furthestEntered: number
  readonly performedIds: readonly string[]
  readonly review: number | null
  readonly walkStopIndex: number
  readonly choiceByStepId: Readonly<Record<string, string>>
  readonly committedByStepId: Readonly<Record<string, string>>
  readonly sortByStepId: Readonly<Record<string, Readonly<Record<string, string>>>>
  readonly sortCommittedStepIds: readonly string[]
  readonly beforeMetrics: McsDerivedMetrics | null
  readonly surfacesByStepId: Readonly<Record<string, readonly McsStageSurfaceId[]>>
  readonly expandedTeachingStepId: string | null
  readonly transferLoaded: boolean
}

function initialSession(lesson: McsStageLesson): McsSimulationState {
  if (lesson.introductory)
    return mcsTeachingSetup(
      lesson.startingDevice,
      lesson.steps[0].setupOnEntry ?? lesson.contract.startingActions,
    )
  let state = createInitialMcsState('learn', lesson.startingDevice)
  for (const action of lesson.contract.startingActions) state = mcsReducer(state, action)
  return mcsReducer(state, { type: 'CLEAR_ACTION_LOG' })
}

type SessionAction = McsAction | { type: 'RESTORE_TEACHING_STATE'; state: McsSimulationState }
function sessionReducer(state: McsSimulationState, action: SessionAction) {
  return action.type === 'RESTORE_TEACHING_STATE' ? action.state : mcsReducer(state, action)
}

export function McsStageHost({
  sectionId,
  initialPhase = 'recognize',
  locale = 'en',
}: {
  readonly sectionId: string
  /** Saved location only; no prior answers or model actions are replayed. */
  readonly initialPhase?: StagePhase
  readonly locale?: string
}) {
  const [restartCount, setRestartCount] = useState(0)
  return (
    <McsStageSession
      key={`${sectionId}:${initialPhase}:${restartCount}`}
      sectionId={sectionId}
      requestedPhase={initialPhase}
      locale={locale}
      onRestart={() => setRestartCount((count) => count + 1)}
    />
  )
}

function McsStageSession({
  sectionId,
  requestedPhase,
  locale,
  onRestart,
}: {
  readonly sectionId: string
  readonly requestedPhase: StagePhase
  readonly locale: string
  readonly onRestart: () => void
}) {
  const router = useRouter()
  const lesson = useMemo(() => buildMcsStageLesson(sectionId), [sectionId])
  const mount = useMemo(() => mcsMountStepIndex(lesson, requestedPhase), [lesson, requestedPhase])
  const pathway = mcsPathway()
  const nextSection = nextPathwaySection(pathway, sectionId)

  const [referenceViewed, setReferenceViewed] = useState(
    requestedPhase !== 'recognize' || !mcsHasPrerequisiteReference(sectionId),
  )
  const [liveState, sendModel] = useReducer(sessionReducer, lesson, (definition) => {
    const step = definition.steps[mount.index]
    return step.interaction.kind === 'transfer'
      ? mcsTeachingSetup(definition.transfer.setupDevice, definition.transfer.setupActions)
      : step.setupOnEntry
        ? mcsTeachingSetup(definition.startingDevice, step.setupOnEntry)
        : initialSession(definition)
  })
  const [playbackRunning, setPlaybackRunning] = useState(!lesson.introductory)
  const [progression, setProgression] = useState<Progression>(() => ({
    taskBaseline: liveState,
    capturedAfter: null,
    comparisons: {},
    snapshots: {},
    firstObservationByStepId: {},
    index: mount.index,
    visitedStepIds: [lesson.steps[mount.index].id],
    furthestPerformed: -1,
    furthestEntered: mount.index,
    performedIds: [],
    review: null,
    walkStopIndex: 0,
    choiceByStepId: {},
    committedByStepId: {},
    sortByStepId: {},
    sortCommittedStepIds: [],
    beforeMetrics: null,
    surfacesByStepId: {},
    expandedTeachingStepId: null,
    transferLoaded: lesson.steps[mount.index].interaction.kind === 'transfer',
  }))
  const [monitorPreferences, setMonitorPreferences] = useState<Record<string, boolean>>({})
  const [helpOpen, setHelpOpen] = useState(false)
  const [hintOpen, setHintOpen] = useState(false)
  const [glossaryOpen, setGlossaryOpen] = useState(false)
  const [explorationOpen, setExplorationOpen] = useState(false)
  const [revealedStepIds, setRevealedStepIds] = useState<readonly string[]>([])
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const hintButtonRef = useRef<HTMLButtonElement>(null)
  const glossaryButtonRef = useRef<HTMLButtonElement>(null)
  const nowFocusRef = useRef<HTMLDivElement>(null)
  const focusedTask = useRef<string | null>(null)
  const workspace = useWorkspaceLayout()

  const activeIndex = Math.min(progression.index, lesson.steps.length - 1)
  const activeStep = lesson.steps[activeIndex]
  const unloadingExample = activeStep.presentation === 'unloading-comparison'
  const performedIds = useMemo(() => new Set(progression.performedIds), [progression.performedIds])
  const stepPerformed = performedIds.has(activeStep.id)
  const isLastStep = activeIndex === lesson.steps.length - 1
  const lookingBack = progression.review !== null
  const reviewSnapshot = lookingBack ? progression.snapshots[activeStep.id] : undefined
  const state = reviewSnapshot?.state ?? liveState
  const capturedBefore = reviewSnapshot ? reviewSnapshot.before : progression.taskBaseline
  const beforeMetrics = capturedBefore?.metrics ?? progression.beforeMetrics
  const selectedChoiceId = progression.choiceByStepId[activeStep.id] ?? null
  const committedChoiceId = progression.committedByStepId[activeStep.id] ?? null

  const allowedActionIds = lookingBack
    ? []
    : activeStep.interaction.kind === 'teaching'
      ? (activeStep.interaction.introduction.allowedControls ?? []).map(
          (id) => mcsLearnControls[id].actionId,
        )
      : activeStep.interaction.kind === 'action'
        ? activeStep.interaction.allowedActions.map((id) => mcsLearnControls[id].actionId)
        : activeStep.interaction.kind === 'transfer'
          ? lesson.transfer.requiredActionIds
          : []

  function dispatch(action: McsAction) {
    if (!isMcsLearningActionPermitted(liveState, action, allowedActionIds, lookingBack)) return
    if (
      lesson.introductory &&
      activeStep.interaction.kind === 'action' &&
      sectionId === 'mcs-foundations-mechanisms' &&
      action.type === 'SELECT_DEVICE'
    ) {
      const record = captureMcsDeviceComparison(liveState, action.device)
      sendModel({ type: 'RESTORE_TEACHING_STATE', state: record.state })
      setProgression((current) => ({
        ...current,
        comparisons: { ...current.comparisons, [action.device]: record },
        capturedAfter: record.state,
      }))
      setPlaybackRunning(false)
      return
    }
    if (lesson.introductory && action.type !== 'INSPECT' && action.type !== 'ESCALATE') {
      const base = progression.taskBaseline ?? liveState
      let next = advanceMcsSimulation(mcsReducer(base, action), MCS_OBSERVATION_SECONDS)
      if (activeStep.interaction.kind === 'transfer' && action.type === 'SELECT_DEVICE') {
        next = {
          ...mcsTeachingSetup(action.device, lesson.transfer.setupActions, liveState.seed),
          actionIds: [`device:select:${action.device}`],
        }
      }
      sendModel({ type: 'RESTORE_TEACHING_STATE', state: next })
      setProgression((current) => ({ ...current, capturedAfter: next }))
      setPlaybackRunning(false)
      return
    }
    sendModel(action)
    if (activeStep.interaction.kind === 'action' || activeStep.interaction.kind === 'transfer') {
      setProgression((current) => ({ ...current, capturedAfter: mcsReducer(liveState, action) }))
    }
  }

  function repeatExercise() {
    if (lookingBack || !progression.taskBaseline) return
    sendModel({
      type: 'RESTORE_TEACHING_STATE',
      state: mcsReducer(progression.taskBaseline, { type: 'CLEAR_ACTION_LOG' }),
    })
    setProgression((current) => ({ ...current, capturedAfter: null, comparisons: {} }))
    setPlaybackRunning(false)
  }

  /* ---------------------------------------------------------------- *
   * The session clock, the resume pointer, the URL
   * ---------------------------------------------------------------- */

  useEffect(() => {
    if (!playbackRunning || lookingBack || !referenceViewed) return
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const intervalMs = reducedMotion ? 500 : 250
    const timer = window.setInterval(
      () => sendModel({ type: 'TICK', seconds: intervalMs / 1000 }),
      intervalMs,
    )
    return () => window.clearInterval(timer)
  }, [playbackRunning, lookingBack, referenceViewed])

  useEffect(() => {
    recordMcsVisit(sectionId, 'learn', lesson.startingDevice, activeStep.phase)
  }, [sectionId, lesson.startingDevice, activeStep.phase])

  useEffect(() => {
    const key = `${activeStep.id}:${referenceViewed}`
    const previous = focusedTask.current
    focusedTask.current = key
    if (previous === null) return
    const node = nowFocusRef.current
    if (!node) return
    node.focus({ preventScroll: true })
    // The card's top, in whichever scroller holds it: the text pane in the desktop workspace, the
    // one pane below it, or the page. A learner who used the pinned Continue is at the card's foot.
    node.scrollIntoView?.({ block: 'start', behavior: 'instant' })
    // In the desktop workspace the simulator pane scrolls on its own; a new task starts at its top.
    const visualPane = node
      .closest('[data-flow-content]')
      ?.querySelector<HTMLElement>(':scope > [data-flow-visual]')
    if (visualPane) visualPane.scrollTop = 0
  }, [activeStep.id, referenceViewed])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('phase', activeStep.phase)
    window.history.replaceState(window.history.state, '', url)
  }, [activeStep.phase])

  const transferStep = lesson.steps.find((step) => step.interaction.kind === 'transfer')

  /* ---------------------------------------------------------------- *
   * Progression
   * ---------------------------------------------------------------- */

  function recordPerformed(stepId: string): readonly string[] {
    return progression.performedIds.includes(stepId)
      ? progression.performedIds
      : [...progression.performedIds, stepId]
  }

  function enterStep(index: number, performedNow: readonly string[], fresh = false) {
    const nextStep = lesson.steps[index]
    if (!nextStep) return
    let nextState = liveState
    const enteringTransfer =
      nextStep.interaction.kind === 'transfer' && (fresh || !progression.transferLoaded)
    if (enteringTransfer) {
      nextState = mcsTeachingSetup(
        lesson.transfer.setupDevice,
        lesson.transfer.setupActions,
        liveState.seed + 1,
      )
    } else if (fresh) {
      nextState = mcsTeachingSetup(
        lesson.startingDevice,
        nextStep.setupOnEntry ?? lesson.contract.startingActions,
        liveState.seed + 1,
      )
    } else if (nextStep.setupOnEntry !== undefined) {
      nextState = mcsTeachingSetup(lesson.startingDevice, nextStep.setupOnEntry, liveState.seed + 1)
    } else if (nextStep.interaction.kind === 'action') {
      nextState = mcsReducer(liveState, { type: 'CLEAR_ACTION_LOG' })
    }
    if (nextState !== liveState) sendModel({ type: 'RESTORE_TEACHING_STATE', state: nextState })
    if (lesson.introductory || nextStep.interaction.kind === 'observe') setPlaybackRunning(false)
    const newTask =
      fresh ||
      enteringTransfer ||
      nextStep.setupOnEntry !== undefined ||
      nextStep.interaction.kind === 'action'
    setProgression((current) => ({
      ...current,
      index,
      review: null,
      performedIds: performedNow,
      visitedStepIds: [...new Set([...current.visitedStepIds, nextStep.id])],
      snapshots: { ...current.snapshots, [activeStep.id]: { state, before: capturedBefore } },
      furthestEntered: Math.max(current.furthestEntered, index),
      transferLoaded: fresh ? enteringTransfer : current.transferLoaded || enteringTransfer,
      comparisons: fresh ? {} : current.comparisons,
      taskBaseline: newTask ? nextState : current.taskBaseline,
      capturedAfter: newTask
        ? null
        : nextStep.interaction.kind === 'observe' && current.capturedAfter
          ? nextState
          : current.capturedAfter,
      beforeMetrics:
        nextStep.interaction.kind === 'action' ? nextState.metrics : current.beforeMetrics,
    }))
  }

  function advance() {
    if (lookingBack) {
      setProgression((current) => ({
        ...current,
        index: current.review ?? current.index,
        review: null,
      }))
      return
    }
    const performedNow = progression.performedIds
    const next = activeIndex + 1
    if (next >= lesson.steps.length) {
      setProgression((current) => ({
        ...current,
        performedIds: performedNow,
        furthestPerformed: Math.max(current.furthestPerformed, activeIndex),
      }))
      return
    }
    enterStep(next, performedNow)
  }

  function commitChoice() {
    if (!selectedChoiceId || stepPerformed || lookingBack) return
    const kind = activeStep.interaction.kind
    if (kind !== 'identify' && kind !== 'prediction' && kind !== 'transfer' && kind !== 'observe')
      return
    const performedNow = recordPerformed(activeStep.id)
    setProgression((current) => ({
      ...current,
      committedByStepId: { ...current.committedByStepId, [activeStep.id]: selectedChoiceId },
      firstObservationByStepId:
        kind === 'observe' && !current.firstObservationByStepId[activeStep.id]
          ? { ...current.firstObservationByStepId, [activeStep.id]: selectedChoiceId }
          : current.firstObservationByStepId,
      performedIds: performedNow,
      furthestPerformed: Math.max(current.furthestPerformed, activeIndex),
    }))
  }

  function commitSort() {
    if (activeStep.interaction.kind !== 'explain' || !activeStep.interaction.sort) return
    if (progression.sortCommittedStepIds.includes(activeStep.id)) return
    const answers = progression.sortByStepId[activeStep.id] ?? {}
    const complete = activeStep.interaction.sort.candidates.every(
      (candidate) => answers[candidate.id],
    )
    if (!complete) return
    setProgression((current) => ({
      ...current,
      sortCommittedStepIds: [...current.sortCommittedStepIds, activeStep.id],
    }))
  }

  function goToStep(index: number) {
    const target = lesson.steps[index]
    if (!target || index === progression.index) return
    setReferenceViewed(true)
    if (index === progression.review) {
      setProgression((current) => ({ ...current, index, review: null }))
    } else if (progression.snapshots[target.id]) {
      setProgression((current) => ({
        ...current,
        index,
        review: current.review ?? current.index,
        snapshots: { ...current.snapshots, [activeStep.id]: { state, before: capturedBefore } },
      }))
    } else enterStep(index, progression.performedIds, index !== activeIndex + 1 || lookingBack)
  }

  function retryQuestion() {
    const retryIds = new Set([activeStep.id, `${activeStep.id}-observation`])
    setRevealedStepIds((ids) => ids.filter((id) => id !== activeStep.id))
    setProgression((current) => ({
      ...current,
      choiceByStepId: Object.fromEntries(
        Object.entries(current.choiceByStepId).filter(([id]) => !retryIds.has(id)),
      ),
      committedByStepId: Object.fromEntries(
        Object.entries(current.committedByStepId).filter(([id]) => !retryIds.has(id)),
      ),
      firstObservationByStepId: Object.fromEntries(
        Object.entries(current.firstObservationByStepId).filter(([id]) => !retryIds.has(id)),
      ),
      performedIds: current.performedIds.filter((id) => id !== activeStep.id),
      sortByStepId: Object.fromEntries(
        Object.entries(current.sortByStepId).filter(([id]) => id !== activeStep.id),
      ),
      sortCommittedStepIds: current.sortCommittedStepIds.filter((id) => id !== activeStep.id),
    }))
  }

  function toggleSurface(surface: McsStageSurfaceId, open: boolean) {
    const stepId = activeStep.id
    setProgression((current) => {
      const next = new Set(current.surfacesByStepId[stepId] ?? activeStep.surfaces)
      if (open) next.add(surface)
      else next.delete(surface)
      return { ...current, surfacesByStepId: { ...current.surfacesByStepId, [stepId]: [...next] } }
    })
  }

  function goToSection(targetId: string) {
    if (targetId === sectionId) return
    router.push({
      pathname: `${mechanicalCirculatorySupportNavBase}/learn`,
      query: { lesson: targetId },
    })
  }

  const openSurfaces = useMemo(
    () =>
      new Set<McsStageSurfaceId>(
        progression.surfacesByStepId[activeStep.id] ?? activeStep.surfaces,
      ),
    [activeStep.id, activeStep.surfaces, progression.surfacesByStepId],
  )

  /* ---------------------------------------------------------------- *
   * Optional exercise feedback; never persisted as completion
   * ---------------------------------------------------------------- */

  const transferCommitted = transferStep
    ? progression.committedByStepId[transferStep.id] !== undefined
    : false
  const transferActionsDone =
    lesson.transfer.requiredActionIds.every((id) => liveState.actionIds.includes(id)) &&
    (lesson.transfer.isWorkSatisfied?.(liveState) ?? true)
  const transferObservationId = `${transferStep?.id}-observation`
  const transferWorkDone =
    transferActionsDone &&
    (!lesson.transfer.observation ||
      progression.committedByStepId[transferObservationId] !== undefined)
  /* ---------------------------------------------------------------- *
   * The walk
   * ---------------------------------------------------------------- */

  const walking = activeStep.interaction.kind === 'walk'
  const walkStop = walking ? MCS_SUPPORT_SPINE.stops[progression.walkStopIndex] : undefined
  const walkIsLast = progression.walkStopIndex >= MCS_SUPPORT_SPINE.stops.length - 1

  function nextWalkStop() {
    if (walkIsLast) {
      advance()
      return
    }
    // Clamped: two clicks inside one frame used to push the index past the last stop, and the
    // card fell back to the step's title for a render.
    setProgression((current) => ({
      ...current,
      walkStopIndex: Math.min(current.walkStopIndex + 1, MCS_SUPPORT_SPINE.stops.length - 1),
    }))
  }

  /* ---------------------------------------------------------------- *
   * The map: what is lit, and whether it is the answer surface
   * ---------------------------------------------------------------- */

  const mapTargets = mcsMapAnswerTargets(sectionId)
  const identifyOnMap =
    activeStep.interaction.kind === 'identify' &&
    activeStep.interaction.onMap &&
    mapTargets !== null
  const mapAnswer: CirculationMapAnswer | null =
    identifyOnMap && activeStep.interaction.kind === 'identify' && mapTargets
      ? {
          prompt: activeStep.interaction.prompt,
          options: activeStep.interaction.options.map((option) => ({
            id: option.id,
            label: option.label,
            segmentIds:
              mapTargets.find((target) => target.optionId === option.id)?.segmentIds ?? [],
          })),
          selectedOptionId: selectedChoiceId,
          committedOptionId: committedChoiceId,
          correctOptionId:
            activeStep.interaction.options.find((option) => option.correct)?.id ?? '',
          name: `mcs-map-${activeStep.id}`,
          onSelect: (optionId) =>
            !lookingBack &&
            setProgression((current) => ({
              ...current,
              choiceByStepId: { ...current.choiceByStepId, [activeStep.id]: optionId },
            })),
        }
      : null

  const litStopIds: readonly McsSpineStopId[] =
    walking && walkStop ? [walkStop.id] : activeStep.stopIds
  const emphasis: CirculationMapEmphasis | null = (() => {
    // While a place is the question, nothing on the map is lit: a lit stop is a hint, and its
    // numbers would sit beside the answer pins' numbers.
    if (litStopIds.length === 0 || (identifyOnMap && committedChoiceId === null)) return null
    const stops = litStopIds.map((id) => mcsSpineStop(id))
    const segmentIds = stops.flatMap((stop) => stop.segmentIds)
    const names = stops.map((stop) => stop.plainName).join(' · ')
    if (walking) return { segmentIds, caption: `You are here: ${names}.`, tone: 'you-are-here' }
    /*
     * "This section stands at: A · B" named two places and marked neither, so a learner could not
     * tell which glow was which or where to start (F03). With more than one place, each is numbered
     * in the sentence and on the drawing beside its lit segment.
     */
    return stops.length > 1
      ? {
          segmentIds,
          caption: `This section uses ${stops.length} places on the loop, numbered on the map: ${stops
            .map((stop, index) => `${index + 1}. ${stop.plainName}`)
            .join('; ')}.`,
          tone: 'you-are-here',
          stops: stops.map((stop) => ({ name: stop.plainName, segmentIds: stop.segmentIds })),
        }
      : { segmentIds, caption: `This section stands at: ${names}.`, tone: 'you-are-here' }
  })()

  /* ---------------------------------------------------------------- *
   * The Now card
   * ---------------------------------------------------------------- */

  const stepPosition = `Task ${activeStep.ordinal} of ${lesson.steps.length}`
  const canGoBack = activeIndex > 0

  function handleContinue(event?: MouseEvent<HTMLButtonElement>) {
    // A native double-click is one navigation intent: the pinned button stays where it is while
    // the next task loads under it. Keyboard activation has detail zero.
    if (event && event.detail > 1) {
      event.currentTarget
        .closest('[data-critical-care-activity-shell]')
        ?.querySelector<HTMLElement>('[data-now-focus]')
        ?.focus({ preventScroll: true })
      return
    }
    if (!lookingBack && isLastStep) {
      if (nextSection) goToSection(nextSection.id)
      else router.push(`${mechanicalCirculatorySupportNavBase}/learn`)
    } else advance()
  }

  /*
   * One way forward, in the same place on every task: the foot of the card, pinned to the bottom
   * of the text pane while the card is taller than it (`NowCardModel.pinActions`, from the ECMO
   * tester's report that she could not find it). On the walk it moves one stop at a time; on the
   * last task it is the next section.
   */
  const continueAction = {
    label: lookingBack
      ? 'Return to current task'
      : walking && !walkIsLast
        ? 'Next stop'
        : isLastStep
          ? nextSection
            ? `Continue to the next section: ${nextSection.title}`
            : 'Back to the Learn page'
          : 'Continue',
    onActivate: lookingBack || !walking || walkIsLast ? handleContinue : nextWalkStop,
    icon: <ArrowRight aria-hidden="true" />,
  }

  function doTaskAgain() {
    retryQuestion()
    enterStep(
      activeIndex,
      progression.performedIds.filter((id) => id !== activeStep.id),
      true,
    )
  }

  const nowModel: NowCardModel = {
    kicker: stepPosition,
    heading:
      walking && walkStop
        ? `Stop ${walkStop.ordinal} of ${MCS_SUPPORT_SPINE.stops.length}: ${walkStop.plainName}`
        : activeStep.title,
    body: walking && walkStop ? walkStop.whereYouAre : activeStep.instruction,
    why: activeStep.rationale,
    pinActions: true,
    ...(canGoBack
      ? { back: { label: 'Back to previous task', onActivate: () => goToStep(activeIndex - 1) } }
      : {}),
    ...(lookingBack
      ? {
          status: LOOKING_BACK,
          secondary: { label: 'Do this task again', onActivate: doTaskAgain },
        }
      : {}),
    primary: continueAction,
  }

  /* ---------------------------------------------------------------- *
   * The Now card's body: the interaction
   * ---------------------------------------------------------------- */

  function choiceFieldset(
    stem: string,
    choices: readonly { readonly id: string; readonly label: string }[],
    orderKey: string,
    legendId: string,
    disabled: boolean,
  ) {
    return (
      <fieldset
        className={stageStyles.choiceList}
        disabled={disabled}
        aria-labelledby={legendId}
        data-prediction-choices
      >
        {/* The legend is the group's name for assistive technology; when the Now card's own body
            already says it, it is not repeated on screen. */}
        <legend
          id={legendId}
          className={stem === activeStep.instruction ? styles.visuallyHidden : undefined}
        >
          {stem}
        </legend>
        {orderChoices(orderKey, choices).map((choice) => (
          <label
            key={choice.id}
            className={stageStyles.choice}
            data-selected={selectedChoiceId === choice.id}
          >
            <input
              type="radio"
              name={`mcs-stage-${activeStep.id}`}
              value={choice.id}
              checked={selectedChoiceId === choice.id}
              onChange={() =>
                setProgression((current) => ({
                  ...current,
                  choiceByStepId: { ...current.choiceByStepId, [activeStep.id]: choice.id },
                }))
              }
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </fieldset>
    )
  }

  function guidedActionButtons(actionIds: readonly string[], highlightControl?: McsLearnControlId) {
    const controls = Object.values(mcsLearnControls).filter(
      (control) => actionIds.includes(control.actionId) && GUIDED_ACTION_IDS[control.actionId],
    )
    if (controls.length === 0) return null
    return (
      <div className={styles.guidedActions} data-guided-actions>
        {controls.map((control) => {
          const done = state.actionIds.includes(control.actionId)
          return (
            <button
              key={control.id}
              type="button"
              className={styles.guidedAction}
              data-mcs-control={control.id}
              data-mcs-control-highlighted={highlightControl === control.id || undefined}
              data-worked-through={done || undefined}
              disabled={!allowedActionIds.includes(control.actionId) || lookingBack}
              onClick={() => dispatch(GUIDED_ACTION_IDS[control.actionId])}
            >
              {done ? <Check aria-hidden="true" /> : null}
              <span>{control.label}</span>
            </button>
          )
        })}
      </div>
    )
  }

  const nowBody: ReactNode = (() => {
    const { interaction } = activeStep
    switch (interaction.kind) {
      case 'teaching':
        return (
          <div data-guided-introduction>
            {guidedActionButtons(allowedActionIds)}
            <McsTaskControls
              state={state}
              dispatch={dispatch}
              allowedActionIds={(interaction.introduction.allowedControls ?? []).map(
                (id) => mcsLearnControls[id].actionId,
              )}
              disabled={lookingBack}
            />
            {state.responseMessage && state.actionIds.length > 0 ? (
              <p role="status">{state.responseMessage}</p>
            ) : null}
          </div>
        )

      case 'walk':
        return walkStop ? (
          <p className={styles.walkHint} data-walk-progress>
            {walkStop.whatADeviceDoesHere}
          </p>
        ) : null
      case 'identify': {
        const committedOption = interaction.options.find(
          (option) => option.id === committedChoiceId,
        )
        const correctOption = interaction.options.find((option) => option.correct)
        return (
          <>
            {identifyOnMap ? (
              <div className={styles.mapAnswerPrompt} data-map-answer-prompt>
                <p id="identify-heading" className={styles.visuallyHidden}>
                  {interaction.prompt}
                </p>
                {selectedChoiceId ? (
                  <p data-map-answer-chosen>
                    <strong>You have chosen:</strong>{' '}
                    {interaction.options.find((option) => option.id === selectedChoiceId)?.label}
                  </p>
                ) : null}
              </div>
            ) : (
              choiceFieldset(
                interaction.prompt,
                interaction.options,
                activeStep.id,
                'identify-heading',
                stepPerformed,
              )
            )}
            {committedOption ? (
              <div
                className={styles.identifyFeedback}
                role="status"
                aria-live="polite"
                data-identify-feedback
                data-verdict-outcome={committedOption.correct ? 'correct' : 'not-correct'}
              >
                <p>
                  <strong data-verdict-outcome-label>
                    {committedOption.correct ? 'Correct.' : 'Not correct.'}
                  </strong>{' '}
                  {committedOption.feedback}
                </p>
                {!committedOption.correct && correctOption ? (
                  <p>
                    <strong>What holds:</strong> {correctOption.label}. {correctOption.feedback}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )
      }
      case 'prediction': {
        const committedChoice = interaction.item.choices.find(
          (choice) => choice.id === committedChoiceId,
        )
        return (
          <>
            {choiceFieldset(
              interaction.item.stem,
              interaction.item.choices,
              interaction.item.id,
              'prediction-heading',
              stepPerformed,
            )}
            {committedChoice ? (
              <div className="grid gap-3" data-verdict>
                <ChoiceReasoningFeedback
                  choice={committedChoice}
                  outcome="stated"
                  frames={mcsVerdictFrames(interaction.item)}
                  alternatives={interaction.item.choices}
                  explanation={interaction.item.explanation}
                  evidenceIds={interaction.item.evidenceIds}
                />
                <p className={styles.reasoning} data-prediction-reasoning>
                  {interaction.reasoning}
                </p>
              </div>
            ) : null}
          </>
        )
      }
      case 'action': {
        const target =
          sectionId !== 'mcs-foundations-mechanisms' && interaction.targetControl
            ? mcsLearnControls[interaction.targetControl]
            : undefined
        return (
          <div className={styles.actionBody} data-action-body data-action-mode={interaction.mode}>
            {interaction.mode === 'inspect-only' ? (
              <p data-inspect-only>{interaction.noActionExplanation}</p>
            ) : target ? (
              <p data-target-control={target.id}>
                <strong>{target.label}.</strong>{' '}
                {target.location === 'guided-actions'
                  ? 'Use the button below.'
                  : 'Use the highlighted control under Controls for this task.'}
              </p>
            ) : null}
            {guidedActionButtons(
              interaction.allowedActions.map((id) => mcsLearnControls[id].actionId),
              interaction.targetControl,
            )}
            {lesson.introductory && sectionId === 'mcs-foundations-mechanisms' ? (
              <McsDeviceComparisonTable records={progression.comparisons} />
            ) : null}
            {lesson.introductory && !lookingBack ? (
              <button type="button" onClick={repeatExercise} data-repeat-exercise>
                Start this exercise again
              </button>
            ) : null}
            {state.responseMessage ? (
              <p className={styles.response} role="status" aria-live="polite" data-response-message>
                {state.responseMessage}
              </p>
            ) : null}
          </div>
        )
      }
      case 'observe':
        if (!progression.capturedAfter && !Object.keys(progression.comparisons).length)
          return (
            <div data-no-observation>
              <p>
                Nothing was captured on the last task, so there is no before and after to compare
                yet. Go back to it, or read what the change does:
              </p>
              <h3>What the change does</h3>
              <p>{lesson.contract.teaching.howTheActionAffectsTheModel}</p>
              <p>{lesson.contract.teaching.flowAccountNote}</p>
            </div>
          )
        if (lesson.introductory) {
          const after = reviewSnapshot?.state ?? progression.capturedAfter ?? state
          const reference =
            sectionId === 'mcs-foundations-mechanisms'
              ? progression.comparisons.iabp?.state
              : capturedBefore
          const result =
            sectionId === 'mcs-foundations-mechanisms' ? progression.comparisons.lvad?.state : after
          const key =
            sectionId === 'iabp-timing-triggering'
              ? 'timingQualityPercent'
              : ['mcs-foundations-signals', 'mcs-foundations-mechanisms'].includes(sectionId)
                ? 'effectiveSystemicFlowLMin'
                : 'deviceFlowLMin'
          const label =
            sectionId === 'mcs-foundations-mechanisms'
              ? 'effective systemic flow, from the IABP run to the LVAD run,'
              : key === 'timingQualityPercent'
                ? 'timing synchrony'
                : key === 'effectiveSystemicFlowLMin'
                  ? 'effective systemic flow'
                  : 'the pump-flow estimate'
          const first = reference?.metrics[key]
          const last = result?.metrics[key]
          const expected =
            typeof first === 'number' && typeof last === 'number'
              ? mcsObservedDirection(
                  first,
                  last,
                  sectionId === 'mcs-foundations-mechanisms'
                    ? 2
                    : (interaction.signals.find((signal) => signal.key === key)?.digits ?? 1),
                )
              : null
          if (!expected)
            return (
              <p data-no-observation>
                The comparison needs both runs from the last task. Go back to it to run the one that
                is missing.
              </p>
            )
          return (
            <>
              {sectionId === 'mcs-foundations-mechanisms' ? (
                <McsDeviceComparisonTable records={progression.comparisons} />
              ) : (
                <McsCapturedResults
                  before={capturedBefore}
                  after={after}
                  signals={interaction.signals}
                  inspectOnly={lesson.contract.actionMode === 'inspect-only'}
                />
              )}
              {choiceFieldset(
                `In these results, how did ${label} change?`,
                ['increased', 'decreased', 'unchanged'].map((id) => ({
                  id,
                  label:
                    id === 'unchanged'
                      ? 'Unchanged within displayed precision'
                      : id === 'increased'
                        ? 'Increased'
                        : 'Decreased',
                })),
                activeStep.id,
                'observation-heading',
                committedChoiceId !== null || lookingBack,
              )}
              {committedChoiceId || revealedStepIds.includes(activeStep.id) ? (
                <p
                  role="status"
                  data-observation-feedback
                  data-correct={committedChoiceId === expected}
                >
                  <strong>
                    {committedChoiceId
                      ? committedChoiceId === expected
                        ? 'Correct.'
                        : 'Not correct.'
                      : 'Answer.'}
                  </strong>{' '}
                  {directionSentence(expected)}
                </p>
              ) : null}
            </>
          )
        }
        /*
         * The authored account first, the numbers second.
         *
         * The contract authors three sentences for what the learner had before the change and
         * three for what they have now, validated at import — and until the learner-review round
         * nothing rendered them: the step carried them and the card showed only the table. They
         * are the prose the numbers are read against, and on the second section they are the
         * three-mechanism account the numbers alone cannot carry.
         */
        return (
          <>
            <div className={styles.beforeAfter} data-before-after-labels>
              <div>
                <p className={styles.kicker} id="before-labels-heading">
                  Before the change
                </p>
                <ul aria-labelledby="before-labels-heading" data-before-labels>
                  {interaction.beforeLabels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className={styles.kicker} id="after-labels-heading">
                  After the change
                </p>
                <ul aria-labelledby="after-labels-heading" data-after-labels>
                  {interaction.afterLabels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </div>
            </div>
            <table className={stageStyles.compareTable} data-before-after>
              <caption className={styles.visuallyHidden}>
                Readings before and after the change
              </caption>
              <thead>
                <tr>
                  <th scope="col">Reading</th>
                  <th scope="col">Before</th>
                  <th scope="col">Now</th>
                </tr>
              </thead>
              <tbody>
                {interaction.signals.map((signal) => {
                  const before = beforeMetrics?.[signal.key] ?? null
                  const now = state.metrics[signal.key]
                  const format = (value: number | boolean | null) =>
                    value === null
                      ? 'not captured'
                      : typeof value === 'boolean'
                        ? value
                          ? 'yes'
                          : 'no'
                        : value.toFixed(signal.digits)
                  const direction =
                    typeof before === 'number' && typeof now === 'number'
                      ? now - before > 10 ** -signal.digits / 2
                        ? 'up'
                        : before - now > 10 ** -signal.digits / 2
                          ? 'down'
                          : 'flat'
                      : undefined
                  // The rows that moved are lit and the rest dimmed, so the eye goes to the change
                  // (the ECMO comparison tables, tester 2026-10-14).
                  const changed = direction === 'up' || direction === 'down'
                  return (
                    <tr
                      key={signal.key}
                      data-signal={signal.key}
                      data-level={signal.level}
                      data-changed={direction === undefined ? undefined : changed}
                    >
                      <th scope="row">
                        {signal.label}
                        {signal.unit ? <small> {signal.unit}</small> : null}
                      </th>
                      <td>{format(before)}</td>
                      <td data-direction={direction}>{format(now)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )
      case 'explain': {
        /*
         * The Explain question, as what it is: an optional reflection with a worked response.
         *
         * It used to be the card's instruction, with no way to answer it and no answer to compare
         * with — and on the section that carries the sort it sat above a task about something else
         * (F11, F15). The question is unchanged; it now stands under its own label, beneath the
         * step's real task, with a response that opens at once. No text box: nothing a learner
         * thinks here is typed, stored or sent.
         */
        const reflection = mcsExplainReflection(sectionId)
        const reflectionBlock = (
          <section className={styles.reflection} data-optional-reflection>
            <p className={styles.kicker}>Reflection</p>
            <p className={styles.stem} data-reflection-prompt>
              {reflection.promptOverride ?? interaction.prompt}
            </p>
            <details data-worked-response>
              <summary>Show a worked response</summary>
              {reflection.workedResponse.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {sectionId === 'mcs-foundations-mechanisms' ? (
                <McsFlowArithmetic records={progression.comparisons} />
              ) : null}
            </details>
          </section>
        )
        const sort = interaction.sort
        if (!sort) return reflectionBlock
        const answers = progression.sortByStepId[activeStep.id] ?? {}
        const revealed =
          progression.sortCommittedStepIds.includes(activeStep.id) ||
          revealedStepIds.includes(activeStep.id)
        return (
          <>
            <div className={styles.sort} data-control-panel-sort>
              <p className={styles.stem}>{sort.prompt}</p>
              {sort.candidates.map((candidate) => {
                const chosen = answers[candidate.id]
                const right = chosen === candidate.bin
                const selectId = `sort-${candidate.id}`
                return (
                  <div
                    key={candidate.id}
                    className={styles.sortRow}
                    data-sort-candidate={candidate.id}
                    data-sort-outcome={
                      revealed
                        ? chosen
                          ? right
                            ? 'correct'
                            : 'not-correct'
                          : 'example'
                        : undefined
                    }
                  >
                    <label htmlFor={selectId}>{candidate.label}</label>
                    <select
                      id={selectId}
                      className={styles.sortSelect}
                      value={chosen ?? ''}
                      disabled={revealed}
                      onChange={(event) =>
                        setProgression((current) => ({
                          ...current,
                          sortByStepId: {
                            ...current.sortByStepId,
                            [activeStep.id]: {
                              ...(current.sortByStepId[activeStep.id] ?? {}),
                              [candidate.id]: event.target.value,
                            },
                          },
                        }))
                      }
                    >
                      <option value="">Choose…</option>
                      {sort.bins.map((bin) => (
                        <option key={bin.id} value={bin.id}>
                          {bin.label}
                        </option>
                      ))}
                    </select>
                    {revealed ? (
                      <p className={styles.sortVerdict}>
                        <strong data-sort-outcome-label>
                          {chosen
                            ? right
                              ? 'Correct.'
                              : 'Not correct.'
                            : 'Example classification.'}
                        </strong>{' '}
                        {right
                          ? ''
                          : `${sort.bins.find((bin) => bin.id === candidate.bin)?.label}. `}
                        {candidate.rationale}
                      </p>
                    ) : null}
                  </div>
                )
              })}
              {revealed ? (
                <div className={styles.sortBins} data-sort-bins>
                  {sort.bins.map((bin) => (
                    <p key={bin.id}>
                      <strong>{bin.label}.</strong> {bin.definition}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
            {reflectionBlock}
          </>
        )
      }
      case 'transfer': {
        const { transfer } = interaction
        const committedChoice = transfer.item.choices.find(
          (choice) => choice.id === committedChoiceId,
        )
        const requiredControls = Object.values(mcsLearnControls).filter((control) =>
          transfer.requiredActionIds.includes(control.actionId),
        )
        const needsControls = requiredControls.some(
          (control) => !GUIDED_ACTION_IDS[control.actionId],
        )
        return (
          <>
            <dl className={styles.transferContext} data-transfer-context>
              {transfer.contextItems.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
            {choiceFieldset(
              transfer.item.stem,
              transfer.item.choices,
              transfer.item.id,
              'transfer-heading',
              transferCommitted,
            )}
            {committedChoice ? (
              <div className="grid gap-3" data-verdict>
                <ChoiceReasoningFeedback
                  choice={committedChoice}
                  outcome="stated"
                  frames={mcsVerdictFrames(transfer.item)}
                  alternatives={transfer.item.choices}
                  explanation={transfer.item.explanation}
                  evidenceIds={transfer.item.evidenceIds}
                />
              </div>
            ) : null}
            <div className={styles.transferWork} data-transfer-work data-met={transferWorkDone}>
              <p>
                <strong>On this patient:</strong> {transfer.requiredActionLabel}
              </p>
              {guidedActionButtons(transfer.requiredActionIds)}
              {needsControls ? (
                <p>Its control is highlighted under Controls for this task.</p>
              ) : null}
              {transfer.observation && transferActionsDone && progression.capturedAfter ? (
                <div data-transfer-observation>
                  <McsCapturedResults
                    before={capturedBefore}
                    after={reviewSnapshot?.state ?? progression.capturedAfter}
                    signals={[transfer.observation]}
                  />
                  <fieldset
                    disabled={
                      lookingBack || Boolean(progression.committedByStepId[transferObservationId])
                    }
                  >
                    <legend>
                      Compared with this patient’s starting readings, how did{' '}
                      {transfer.observation.label.toLowerCase()} change?
                    </legend>
                    {(['increased', 'decreased', 'unchanged'] as const).map((direction) => (
                      <label className={styles.choice} key={direction}>
                        <input
                          type="radio"
                          name={transferObservationId}
                          value={direction}
                          checked={progression.choiceByStepId[transferObservationId] === direction}
                          onChange={() =>
                            setProgression((current) => ({
                              ...current,
                              choiceByStepId: {
                                ...current.choiceByStepId,
                                [transferObservationId]: direction,
                              },
                            }))
                          }
                        />
                        {direction === 'unchanged'
                          ? 'Unchanged within displayed precision'
                          : direction === 'increased'
                            ? 'Increased'
                            : 'Decreased'}
                      </label>
                    ))}
                  </fieldset>
                  {progression.committedByStepId[transferObservationId] ? (
                    <p role="status" data-transfer-observation-feedback>
                      {progression.committedByStepId[transferObservationId] ===
                      mcsObservedDirection(
                        Number(capturedBefore?.metrics[transfer.observation.key]),
                        Number(progression.capturedAfter.metrics[transfer.observation.key]),
                        transfer.observation.digits,
                      )
                        ? 'Correct.'
                        : 'Not correct.'}{' '}
                      {directionSentence(
                        mcsObservedDirection(
                          Number(capturedBefore?.metrics[transfer.observation.key]),
                          Number(progression.capturedAfter.metrics[transfer.observation.key]),
                          transfer.observation.digits,
                        ),
                      )}
                    </p>
                  ) : !lookingBack && progression.choiceByStepId[transferObservationId] ? (
                    <button
                      type="button"
                      data-transfer-observation-check
                      onClick={() =>
                        setProgression((current) => ({
                          ...current,
                          committedByStepId: {
                            ...current.committedByStepId,
                            [transferObservationId]: current.choiceByStepId[transferObservationId],
                          },
                        }))
                      }
                    >
                      Check answer
                    </button>
                  ) : null}
                </div>
              ) : null}
              <p role="status" aria-live="polite" data-transfer-work-status>
                {transferWorkDone ? 'Done on this patient.' : ''}
              </p>
            </div>
          </>
        )
      }
      default:
        return null
    }
  })()

  /* ---------------------------------------------------------------- *
   * The simulator: one clock, then the map, the readings, the monitor and the controls
   * ---------------------------------------------------------------- */

  const activeAlarm =
    state.alarms.find((alarm) => alarm.active && alarm.priority === 'critical') ??
    state.alarms.find((alarm) => alarm.active)
  const teachingStep = activeStep.interaction.kind === 'teaching'
  const contextItems: ContextStripItem[] = [
    { label: 'Device · mechanism', value: mcsDeviceStatusLabel(state) },
    { label: 'Setting', value: settingLabel(state) },
    { label: 'Displayed flow', value: displayedFlowLabel(state) },
    { label: 'Mean pressure', value: `${state.metrics.mapMmHg} mm Hg` },
  ]
  /*
   * The clock bar may not say "No active alarm" on its own while the trigger rating is held.
   *
   * In atrial fibrillation the engine's trigger alarm is quiet on arterial pressure and on nothing
   * else, so the bar answered a switch to the warned-against source with an all-clear (F19). The
   * bar still reports every alarm the model raises; it just cannot report silence as the whole
   * story here.
   */
  const afTriggerLimitHeld = mcsAfTriggerLimitApplies(state)
  const alarm = activeAlarm
    ? { priority: alarmPriority(activeAlarm.priority), text: activeAlarm.label }
    : afTriggerLimitHeld
      ? { priority: 'medium' as const, text: MCS_AF_TRIGGER_CONTAINMENT.notAnAllClear }
      : { priority: 'none' as const, text: 'No active alarm' }

  const highlightControl: McsLearnControlId | undefined =
    activeStep.interaction.kind === 'action'
      ? activeStep.interaction.targetControl
      : activeStep.interaction.kind === 'transfer'
        ? transferHighlightControl(lesson)
        : undefined

  /*
   * Does the screen say "Look here" at the monitor? The teaching column prints the section's
   * pointer — "Look here: Arterial pressure trace", "Look here: Response trend" — on the loop walk
   * and on the Recognize and Predict steps of the four application sections, and for the five
   * sections whose primary surface is the monitor that pointer names a monitor region.
   */
  const monitorPointedAt =
    lesson.contract.primarySurface === 'monitor' &&
    activeStep.interaction.kind !== 'teaching' &&
    (walking ||
      (!lesson.introductory &&
        (activeStep.phase === 'recognize' || activeStep.phase === 'predict')))

  const clockBar = (
    <McsClockBar
      running={playbackRunning && !lookingBack}
      held={lookingBack}
      timeSeconds={state.timeSeconds}
      onToggle={() => setPlaybackRunning((running) => !running)}
      onStepCycle={() => {
        setPlaybackRunning(false)
        sendModel({ type: 'TICK', seconds: 60 / liveState.patient.heartRateBpm })
      }}
      items={contextItems}
      alarm={alarm}
    />
  )

  /*
   * A question about a place is asked over the map it is answered on (the ECMO map questions,
   * tester 2026-10-14): in the two panes the map is beside the card, and stacked it is a screen
   * below it, so the question goes with the pins.
   */
  const mapQuestion =
    identifyOnMap && activeStep.interaction.kind === 'identify' ? (
      <div className={flowStyles.mapQuestion} data-map-question-callout>
        <p className={flowStyles.mapQuestionKicker}>Answer on the map</p>
        <p className={flowStyles.mapQuestionStem}>{activeStep.interaction.prompt}</p>
      </div>
    ) : null

  const simulator = (
    <McsSimulatorPane
      lesson={lesson}
      presentation={activeStep.presentation}
      state={state}
      dispatch={dispatch}
      predictionCommitted={true}
      teachingAvailable={teachingStep || walking}
      allowedActionIds={teachingStep ? [] : allowedActionIds}
      focusedControls
      flowAccountWithheld={false}
      emphasis={emphasis}
      mapAnswer={mapAnswer}
      highlightControl={highlightControl}
      openSurfaces={openSurfaces}
      onToggleSurface={toggleSurface}
      mapPreference={activeStep.surfaces.includes('map') ? activeStep.id : null}
      monitorPointedAt={monitorPointedAt}
      monitorOpen={monitorPreferences[activeStep.id] ?? monitorPointedAt}
      onMonitorToggle={(open) => {
        setMonitorPreferences((previous) =>
          previous[activeStep.id] === open ? previous : { ...previous, [activeStep.id]: open },
        )
      }}
      stepKey={activeStep.id}
    />
  )

  /*
   * Every control the device has, for a learner who wants to try something the task did not ask
   * for. It sits with the simulator it changes, under the task's own controls, and mounts only when
   * opened: several of its labels name a section's answer.
   */
  const allControls = lookingBack ? null : (
    <section className={flowStyles.allControls} data-full-exploration>
      <button
        type="button"
        aria-expanded={explorationOpen}
        onClick={() => setExplorationOpen((open) => !open)}
      >
        All device controls
      </button>
      {explorationOpen ? (
        <>
          <p>Changes here apply to this patient and clear the results captured on this task.</p>
          <McsControls
            state={state}
            dispatch={(action) => {
              const next = mcsReducer(liveState, action)
              sendModel({ type: 'RESTORE_TEACHING_STATE', state: next })
              setProgression((current) => ({
                ...current,
                capturedAfter: null,
                comparisons: {},
              }))
            }}
          />
          <button
            type="button"
            onClick={() => {
              const observed = advanceMcsSimulation(liveState, MCS_OBSERVATION_SECONDS)
              sendModel({ type: 'RESTORE_TEACHING_STATE', state: observed })
              setProgression((current) => ({ ...current, capturedAfter: observed }))
              setPlaybackRunning(false)
            }}
          >
            Run {MCS_OBSERVATION_SECONDS} s and capture
          </button>
        </>
      ) : null}
    </section>
  )

  /*
   * The worked comparison of the unloading section is its own figure, read in the text; it has no
   * live patient, so it has no simulator beside it. Every other task does, on the right.
   */
  const visual = unloadingExample ? undefined : (
    <div className={flowStyles.visualPane} data-mcs-visual>
      {clockBar}
      {mapQuestion}
      {simulator}
      {allControls}
    </div>
  )

  /* ---------------------------------------------------------------- *
   * The text: the task card, then the section around it
   * ---------------------------------------------------------------- */

  const teaching = (
    <div className={styles.teachingColumn} data-teaching-column>
      <StageTeachingScope
        value={{ phase: activeStep.phase, predictionCommitted: true, stepId: activeStep.id }}
      >
        {activeStep.interaction.kind === 'teaching' ? (
          <McsIntroTeaching
            introduction={activeStep.interaction.introduction}
            state={state}
            before={capturedBefore}
          />
        ) : (
          <McsTeachingColumn
            lesson={lesson}
            step={activeStep}
            state={state}
            predictionCommitted={true}
            flowAccountWithheld={false}
            beforeMetrics={beforeMetrics}
            walkStop={walkStop}
            litStopIds={litStopIds}
          />
        )}
      </StageTeachingScope>
    </div>
  )

  const stories = mcsStageStories(sectionId)
  const stageSources = useMemo(() => mcsStageSources(sectionId), [sectionId])

  const question = activeStep.interaction
  const questionKind = ['identify', 'prediction', 'observe', 'transfer'].includes(question.kind)
  const canAnswer =
    questionKind && (question.kind !== 'observe' || Boolean(progression.capturedAfter))
  const showExplanation = revealedStepIds.includes(activeStep.id)
  const explanation =
    question.kind === 'identify'
      ? question.options.find((option) => option.correct)?.feedback
      : question.kind === 'prediction'
        ? question.item.explanation
        : question.kind === 'transfer'
          ? question.transfer.item.explanation
          : lesson.contract.teaching.howTheActionAffectsTheModel
  /*
   * The answer row: only the buttons that can act on this task, now (the ECMO tester's rule — a
   * control that cannot do anything is not drawn).
   *
   * Check answer appears once a choice is made. Show answer is offered on a question until it is
   * answered, and hides again; Try again appears once there is an answer to clear. Hint opens this
   * item's own nudge while the question is open. The way on is the card's pinned Continue, so
   * there is no separate Skip.
   */
  const hintKind =
    question.kind === 'explain'
      ? question.sort
        ? ('sort' as const)
        : undefined
      : question.kind === 'identify' ||
          question.kind === 'prediction' ||
          question.kind === 'action' ||
          question.kind === 'observe' ||
          question.kind === 'transfer'
        ? question.kind
        : undefined
  const sortCommitted = progression.sortCommittedStepIds.includes(activeStep.id)
  const answered = committedChoiceId !== null || sortCommitted
  const hint = hintKind && !answered ? mcsStepHint(sectionId, hintKind) : undefined
  const explanationOffered = canAnswer && question.kind !== 'observe' && !committedChoiceId
  const somethingToRetry =
    (question.kind === 'explain' && Boolean(question.sort) && showExplanation) ||
    committedChoiceId !== null ||
    sortCommitted ||
    progression.committedByStepId[`${activeStep.id}-observation`] !== undefined
  const sortComplete =
    question.kind === 'explain' && question.sort
      ? question.sort.candidates.every(
          (candidate) => (progression.sortByStepId[activeStep.id] ?? {})[candidate.id],
        )
      : false
  const answerButtons = lookingBack ? null : (
    <>
      {canAnswer && !committedChoiceId && selectedChoiceId ? (
        <button
          type="button"
          className={shellStyles.nowSecondary}
          data-question-check
          onClick={commitChoice}
        >
          Check answer
        </button>
      ) : null}
      {question.kind === 'explain' && question.sort && !showExplanation && !sortCommitted ? (
        <>
          {sortComplete ? (
            <button type="button" className={shellStyles.nowSecondary} onClick={commitSort}>
              Check the sort
            </button>
          ) : null}
          <button
            type="button"
            className={shellStyles.nowSecondary}
            onClick={() => setRevealedStepIds((ids) => [...new Set([...ids, activeStep.id])])}
          >
            Show the sort
          </button>
        </>
      ) : null}
      {hint ? (
        <button
          ref={hintButtonRef}
          type="button"
          className={shellStyles.nowSecondary}
          data-step-hint-trigger
          onClick={() => setHintOpen(true)}
        >
          Hint
        </button>
      ) : null}
      {explanationOffered ? (
        <button
          type="button"
          className={shellStyles.nowSecondary}
          aria-expanded={showExplanation}
          data-show-answer
          onClick={() =>
            setRevealedStepIds((ids) =>
              showExplanation
                ? ids.filter((id) => id !== activeStep.id)
                : [...new Set([...ids, activeStep.id])],
            )
          }
        >
          {showExplanation ? 'Hide answer' : 'Show answer'}
        </button>
      ) : null}
      {somethingToRetry ? (
        <button
          type="button"
          className={shellStyles.nowSecondary}
          onClick={retryQuestion}
          data-try-again
        >
          Try again
        </button>
      ) : null}
    </>
  )
  const answerRow =
    answerButtons && (canAnswer || question.kind === 'explain' || hint) ? (
      <div className={styles.optionalActions} data-answer-row>
        {answerButtons}
      </div>
    ) : null

  const sources = (
    <footer className={flowStyles.references}>
      <StageSourcesFooter
        count={stageSources.sourceIds.length}
        label="Sources for this section"
        claimsVisible={true}
      >
        <McsSourceList sourceIds={stageSources.sourceIds} claimsVisible={true} />
        <McsClaimSourceChecks claims={mcsClaimChecksForSection(sectionId)} context="this section" />
      </StageSourcesFooter>
    </footer>
  )

  const textColumn = (
    <>
      <div ref={nowFocusRef} tabIndex={-1} data-now-focus>
        <NowCard model={nowModel}>
          <div className={flowStyles.taskContent}>
            <McsTaskPresentation
              kind={activeStep.presentation}
              teaching={teaching}
              action={nowBody}
              explaining={
                activeStep.interaction.kind === 'explain' ||
                activeStep.interaction.kind === 'observe'
              }
              reference={teachingStep || walking}
            />
            {answerRow}
            {showExplanation && explanationOffered ? (
              <section className={styles.block} data-provided-explanation>
                <h3>Answer</h3>
                <p>{explanation}</p>
              </section>
            ) : null}
          </div>
        </NowCard>
      </div>
      {!lesson.introductory &&
      (activeStep.phase === 'observe' || activeStep.phase === 'explain') &&
      stories.length > 0 ? (
        <McsStoryProblems stories={stories} />
      ) : null}
      {activeIndex === 0 ? (
        <details className={stageStyles.objectives} data-stage-objectives>
          <summary>What this section is for</summary>
          <p>{lesson.spec.objective}</p>
          <p>
            <strong>One new idea:</strong> {lesson.spec.newConcept}
          </p>
        </details>
      ) : null}
      <details className={flowStyles.taskMap} data-task-map>
        <summary>Tasks in this section</summary>
        <ol data-step-list>
          {lesson.steps.map((step, index) => (
            <li
              key={step.id}
              data-step-state={
                index === activeIndex
                  ? 'current'
                  : progression.visitedStepIds.includes(step.id)
                    ? 'visited'
                    : 'open'
              }
            >
              <button
                type="button"
                aria-current={index === activeIndex ? 'step' : undefined}
                disabled={index === activeIndex}
                onClick={() => goToStep(index)}
              >
                {step.ordinal}. {step.title}
                {index !== activeIndex && progression.visitedStepIds.includes(step.id)
                  ? ' · visited'
                  : ''}
              </button>
            </li>
          ))}
        </ol>
      </details>
      {isLastStep ? <McsSectionRecap lesson={lesson} onRevisit={goToStep} /> : null}
      {isLastStep && lesson.practicePairing ? (
        <section className={stageStyles.completion} data-stage-completion>
          <h3>Take it to a patient case</h3>
          <div className={stageStyles.completionActions}>
            <button
              type="button"
              className={shellStyles.nowSecondary}
              data-practice-pairing={lesson.practicePairing.kind}
              onClick={() =>
                router.push({
                  pathname: `${mechanicalCirculatorySupportNavBase}/practice`,
                  query: { case: lesson.practicePairing?.caseId ?? '' },
                })
              }
            >
              {lesson.practicePairing.kind === 'mechanism-match'
                ? `Apply it in a case: ${lesson.practicePairing.title}`
                : `Next case in this unit (a different mechanism): ${lesson.practicePairing.title}`}
            </button>
          </div>
        </section>
      ) : null}
      {/*
       * The glossary, from inside the lesson (F42). It opens over the task and closes back to this
       * button: the task, its answers, the model and the scroll position are exactly as they were.
       */}
      <p className={flowStyles.sectionTools}>
        <button
          ref={glossaryButtonRef}
          type="button"
          className={shellStyles.nowSecondary}
          data-glossary-trigger
          onClick={() => setGlossaryOpen(true)}
        >
          Glossary
        </button>
      </p>
      {workspace ? sources : null}
    </>
  )

  const header = (
    <SectionHeader
      breadcrumb={{
        href: mechanicalCirculatorySupportNavBase,
        label: 'Mechanical Circulatory Support',
      }}
      kicker={`Section ${lesson.index + 1} of ${lesson.total} · ${lesson.minutes} min`}
      title={lesson.title}
      sectionsControl={
        <SectionsDrawer
          pathway={pathway}
          activeSectionId={sectionId}
          position={`${lesson.index + 1} of ${lesson.total}`}
          label="Mechanical circulatory support learning pathway"
          onSelect={goToSection}
        />
      }
      helpRef={helpButtonRef}
      onHelp={() => {
        setHelpOpen(true)
      }}
      onRestart={onRestart}
      restartLabel="Restart section"
      saveAndExitHref={mechanicalCirculatorySupportNavBase}
      resumedNote={
        mount.index > 0
          ? 'Reopened at the task you left, with the patient as it starts. Answers from last time are not kept.'
          : undefined
      }
    />
  )

  const dialogs = (
    <>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} returnFocusTo={helpButtonRef}>
        <p className={shellStyles.kicker}>{stepPosition}</p>
        <p>
          <strong>{activeStep.title}</strong>
        </p>
        <p>{activeStep.instruction}</p>
        {activeStep.rationale ? <p>{activeStep.rationale}</p> : null}
        <p>
          Every task in this section is optional: open any of them from Tasks in this section, and
          continue without answering or acting whenever you like.
        </p>
      </HelpDialog>
      <HelpDialog
        open={hintOpen && hint !== undefined}
        onClose={() => setHintOpen(false)}
        title="Hint"
        returnFocusTo={hintButtonRef}
      >
        <p className={shellStyles.kicker}>{stepPosition}</p>
        <p data-step-hint>{hint}</p>
      </HelpDialog>
      <HelpDialog
        open={glossaryOpen}
        onClose={() => setGlossaryOpen(false)}
        title="Glossary"
        returnFocusTo={glossaryButtonRef}
      >
        <McsGlossary />
      </HelpDialog>
    </>
  )

  return (
    <McsModuleFrame
      locale={locale}
      activeHref={`${mechanicalCirculatorySupportNavBase}/learn`}
      activityMode
    >
      <StageSourcesScope>
        <div className={styles.stage} data-mcs-stage data-section-id={sectionId}>
          <div
            className={`${shellStyles.shell} ${flowStyles.flow}`}
            data-lesson-shell
            data-critical-care-activity-shell="true"
            data-stage={activeStep.id}
            data-presentation={activeStep.presentation}
            data-mcs-task-flow
            aria-label="Mechanical circulatory support section"
          >
            <header className={shellStyles.header}>{header}</header>
            <div
              className={flowStyles.activity}
              data-single-column={referenceViewed && visual ? undefined : 'reading'}
            >
              {referenceViewed ? (
                <FlowContent kind={activeStep.presentation} teaching={textColumn} visual={visual} />
              ) : (
                <div className={flowStyles.reference} data-prerequisite-pane>
                  <McsPrerequisiteReference
                    sectionId={sectionId}
                    onContinue={() => setReferenceViewed(true)}
                  />
                </div>
              )}
            </div>
            {workspace && referenceViewed ? null : sources}
            {dialogs}
          </div>
        </div>
      </StageSourcesScope>
    </McsModuleFrame>
  )
}

/* -------------------------------------------------------------------- *
 * Context-strip derivations
 * -------------------------------------------------------------------- */

function settingLabel(state: McsSimulationState): string {
  if (state.device.kind === 'iabp') {
    return `1:${state.device.assistRatio} · ${state.device.triggerSource.toUpperCase()} trigger`
  }
  if (state.device.kind === 'lvad') return `${state.device.speedRpm} rpm`
  const { left, right } = state.device
  const parts: string[] = []
  if (left.enabled) parts.push(`${left.variant === '55' ? '5.5' : 'CP'} P${left.performanceLevel}`)
  if (right.enabled) parts.push(`RP P${right.performanceLevel}`)
  return parts.join(' · ') || 'no pump in place'
}

function displayedFlowLabel(state: McsSimulationState): string {
  if (state.device.kind === 'iabp') return 'none reported'
  if (state.device.kind === 'lvad')
    return `${(state.metrics.estimatedPumpFlowLMin ?? state.metrics.deviceFlowLMin).toFixed(1)} L/min`
  const { left, right } = state.device
  const parts: string[] = []
  if (left.enabled) parts.push(`left ${state.metrics.leftDeviceFlowLMin.toFixed(1)} L/min`)
  if (right.enabled) parts.push(`right ${state.metrics.rightDeviceFlowLMin.toFixed(1)} L/min`)
  return parts.join(' · ') || 'none reported'
}

/** The read-back answer as a sentence: "It increased.", or that it held within the shown precision. */
function directionSentence(direction: 'increased' | 'decreased' | 'unchanged'): string {
  return direction === 'unchanged'
    ? 'It did not change within the displayed precision.'
    : `It ${direction}.`
}

function alarmPriority(priority: 'advisory' | 'warning' | 'critical'): 'low' | 'medium' | 'high' {
  return priority === 'critical' ? 'high' : priority === 'warning' ? 'medium' : 'low'
}

/** The first required transfer action that is not a guided button, resolved back to its control. */
function transferHighlightControl(lesson: McsStageLesson): McsLearnControlId | undefined {
  for (const actionId of lesson.transfer.requiredActionIds) {
    if (GUIDED_ACTION_IDS[actionId]) continue
    const control = Object.values(mcsLearnControls).find(
      (candidate) => candidate.actionId === actionId,
    )
    if (control) return control.id
  }
  return undefined
}
