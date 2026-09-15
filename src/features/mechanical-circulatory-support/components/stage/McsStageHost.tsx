'use client'

import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check } from 'lucide-react'

import { ChoiceReasoningFeedback } from '@/features/learning-module/components/ChoiceReasoningFeedback'
import { nextPathwaySection } from '@/features/learning-module/curriculum/types'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import { ContextStrip, type ContextStripItem } from '@/features/learning-module/stage/ContextStrip'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { LookInLine } from '@/features/learning-module/stage/LookInLine'
import { NowCard, type NowCardModel } from '@/features/learning-module/stage/NowCard'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { SectionsDrawer } from '@/features/learning-module/stage/SectionsDrawer'
import { StageLayout } from '@/features/learning-module/stage/StageLayout'
import {
  STAGE_PHASE_LABELS,
  compactPaneForLocation,
  type StagePaneId,
  type StagePhase,
} from '@/features/learning-module/stage/stageModel'
import { StageSourcesFooter } from '@/features/learning-module/stage/StageSourcesFooter'
import { StageSourcesScope } from '@/features/learning-module/stage/StageSourcesScope'
import { StageTeachingScope } from '@/features/learning-module/stage/StageTeachingScope'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'
import { useRouter } from '@/i18n/navigation'

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
import type { McsAction, McsDerivedMetrics, McsSimulationState } from '../../engine/types'
import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import type {
  CirculationMapAnswer,
  CirculationMapEmphasis,
} from '../circulation-map/CirculationMap'
import { McsModuleFrame } from '../McsModuleFrame'
import { McsSimulatorPane } from './McsSimulatorPane'
import { McsSourceList } from './McsSourceList'
import { McsStoryProblems } from './McsStoryProblems'
import { McsTeachingColumn } from './McsTeachingColumn'
import { McsTaskControls } from './McsTaskControls'
import { McsIntroTeaching } from './McsIntroTeaching'
import {
  McsCapturedResults,
  McsDeviceComparisonTable,
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
import { McsPrerequisiteReference, mcsHasPrerequisiteReference } from './McsPrerequisiteReference'
import { McsTaskPresentation } from './McsTaskPresentation'
import { MCS_TASK_PRESENTATIONS_ENABLED } from '../../content/taskPresentation'

/** MCS-local self-paced host. Answers and observations live only in this mounted session.
 * Navigation never manufactures a response, performed action, capture or achievement.
 * Historical grading records are read-only; only topic visits and location are saved.
 */

const LOOKING_BACK =
  'Review: captured state from this earlier task. The current patient is preserved; controls are locked. Return to the current task to continue.'

/*
 * Steps, Teaching, Simulator — left to right — each pane captioned with its name and what it is
 * for, and the simulator kept the widest of the three.
 *
 * The stage was adopted with the simulator first and the steps last, and with no visible pane
 * names at all. A learner review of the ECMO module in September 2026 asked for the prompts and
 * questions on the left "for a more natural read" and reported guessing which of three unnamed
 * panes each instruction meant; this module had the same shape, and one more cost: a compact
 * viewport opens on the first pane, which was the monitor while every answer control but two sat
 * in the pane it could not show. The monitor and the map are never scaled, so the fractions keep
 * the simulator the widest pane whatever end of the row it sits at. Recorded in the module's
 * learner-review record, which amends the flow-rebuild record's measured order.
 */
const PANE_ORDER = ['steps', 'teaching', 'simulator'] as const
const PANE_CAPTIONS = {
  steps: 'what to do',
  teaching: 'what to read',
  simulator: 'the monitor, the map and the controls',
} as const
const PANE_WIDTH_FRACTIONS = { primary: 0.26, secondary: 0.29 } as const
const PANE_MINIMUMS = { primary: 300, secondary: 280, tertiary: 340 } as const

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
    requestedPhase !== 'recognize' ||
      !MCS_TASK_PRESENTATIONS_ENABLED ||
      !mcsHasPrerequisiteReference(sectionId),
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
  const [helpOpen, setHelpOpen] = useState(false)
  const [explorationOpen, setExplorationOpen] = useState(false)
  const [revealedStepIds, setRevealedStepIds] = useState<readonly string[]>([])
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const nowFocusRef = useRef<HTMLDivElement>(null)

  const activeIndex = Math.min(progression.index, lesson.steps.length - 1)
  const activeStep = lesson.steps[activeIndex]
  const unloadingExample = activeStep.presentation === 'unloading-comparison'
  const performedIds = useMemo(() => new Set(progression.performedIds), [progression.performedIds])
  const stepPerformed = performedIds.has(activeStep.id)
  const isLastStep = activeIndex === lesson.steps.length - 1
  const predictionStep = lesson.steps[lesson.predictionStepIndex]
  const predictionCommitted =
    predictionStep !== undefined && progression.committedByStepId[predictionStep.id] !== undefined
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
    const node = nowFocusRef.current
    if (!node) return
    node.focus({ preventScroll: true })
    // A new step starts at the top of its pane, whatever the previous step left it scrolled to.
    node.closest<HTMLElement>('[role="region"]')?.scrollTo({ top: 0 })
  }, [activeStep.id])

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

  /*
   * Which pane a compact viewport opens on for this step.
   *
   * A map-answered identification's only answer control is the set of pins on the circulation
   * map, in the simulator pane, and at a compact width exactly one pane is on screen — so that
   * step opens there whatever its authored location says. Everything else follows the location
   * the Now card prints, so the pane the learner is sent to is the pane they are shown.
   */
  const compactPane: StagePaneId = identifyOnMap
    ? 'simulator'
    : compactPaneForLocation(activeStep.lookIn)

  const litStopIds: readonly McsSpineStopId[] =
    walking && walkStop ? [walkStop.id] : activeStep.stopIds
  const emphasis: CirculationMapEmphasis | null = (() => {
    // While a place is the question, nothing on the map is lit: a lit stop is a hint.
    if (litStopIds.length === 0) return null
    const stops = litStopIds.map((id) => mcsSpineStop(id))
    const segmentIds = stops.flatMap((stop) => stop.segmentIds)
    const names = stops.map((stop) => stop.plainName).join(' · ')
    return walking
      ? { segmentIds, caption: `You are here: ${names}.`, tone: 'you-are-here' }
      : { segmentIds, caption: `This section stands at: ${names}.`, tone: 'you-are-here' }
  })()

  /* ---------------------------------------------------------------- *
   * The Now card
   * ---------------------------------------------------------------- */

  const stepPosition = `Step ${activeStep.ordinal} of ${lesson.steps.length} · ${STAGE_PHASE_LABELS[activeStep.phase]}`
  /*
   * Where this step's work is done, said in the same words the pane caption carries.
   *
   * One line, under the instruction, on every step; the help dialog repeats it. The lessons
   * registry refuses at import to author a step without a location, so the caption on the pane
   * and the line on the card cannot drift apart.
   */
  const lookInLine = activeStep.lookIn ? <LookInLine location={activeStep.lookIn} /> : undefined
  const previousStep = activeIndex > 0 ? lesson.steps[activeIndex - 1] : undefined
  const canGoBack = previousStep !== undefined

  const continueAction = {
    label: lookingBack
      ? 'Return to current task'
      : isLastStep
        ? nextSection
          ? `Continue to next section: ${nextSection.title}`
          : 'Return to lesson map'
        : 'Continue',
    onActivate:
      !lookingBack && isLastStep
        ? () =>
            nextSection
              ? goToSection(nextSection.id)
              : router.push(`${mechanicalCirculatorySupportNavBase}/learn`)
        : advance,
    icon: <ArrowRight aria-hidden="true" />,
  }

  const nowModel: NowCardModel = (() => {
    const base = {
      kicker: stepPosition,
      heading:
        walking && walkStop
          ? `Stop ${walkStop.ordinal} of ${MCS_SUPPORT_SPINE.stops.length}: ${walkStop.plainName}`
          : activeStep.title,
      body: walking && walkStop ? walkStop.whereYouAre : activeStep.instruction,
      where: lookInLine,
      why: activeStep.rationale,
      ...(canGoBack && previousStep
        ? {
            back: {
              label: `Back to ${STAGE_PHASE_LABELS[previousStep.phase]}`,
              onActivate: () => goToStep(activeIndex - 1),
            },
          }
        : {}),
      ...(lookingBack ? { status: LOOKING_BACK } : {}),
    }
    return {
      ...base,
      status: lookingBack
        ? LOOKING_BACK
        : 'Optional activity · explanations and navigation are always available.',
      primary: continueAction,
    }
  })()

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
              <span>
                {control.label}
                {sectionId === 'mcs-foundations-mechanisms' &&
                activeStep.interaction.kind === 'action'
                  ? ' · observe and retain 8 s'
                  : ''}
              </span>
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
                <p>
                  Choose the place on the circulation map. The candidates are pinned on the drawing
                  and named under it.
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
                  : 'Use the highlighted control beside the current observations.'}
              </p>
            ) : null}
            {guidedActionButtons(
              interaction.allowedActions.map((id) => mcsLearnControls[id].actionId),
              interaction.targetControl,
            )}
            {lesson.introductory && sectionId === 'mcs-foundations-mechanisms' ? (
              <McsDeviceComparisonTable records={progression.comparisons} />
            ) : null}
            {lesson.introductory ? (
              <>
                <button type="button" onClick={repeatExercise} disabled={lookingBack}>
                  Reset this model exercise
                </button>
                <p className={styles.footnote}>
                  Restores the task baseline and clears this exercise’s actions and captures.
                  Earlier answers and topic visits are preserved. This is a model reset, not
                  clinical repositioning.
                </p>
              </>
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
                No observation was captured in this run. You can return to the action, read the
                expected response below, or continue.
              </p>
              <h3>Provided explanation</h3>
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
              ? 'modeled effective systemic flow from captured IABP to captured LVAD'
              : key === 'timingQualityPercent'
                ? 'timing synchrony'
                : key === 'effectiveSystemicFlowLMin'
                  ? 'modeled effective flow'
                  : 'pump-flow estimate'
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
                Both comparison runs are needed to interpret a change. Read the provided explanation
                or return to the model.
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
                `In these captured results, how did ${label} change?`,
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
                      : 'Observed direction.'}
                  </strong>{' '}
                  The captured quantity {expected}. This records an interpretation of modeled
                  results, not adequate patient perfusion.
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
                  Provided reference account
                </p>
                <ul aria-labelledby="before-labels-heading" data-before-labels>
                  {interaction.beforeLabels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className={styles.kicker} id="after-labels-heading">
                  Expected response account
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
                  return (
                    <tr key={signal.key} data-signal={signal.key} data-level={signal.level}>
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
        const sort = interaction.sort
        if (!sort) return null
        const answers = progression.sortByStepId[activeStep.id] ?? {}
        const revealed =
          progression.sortCommittedStepIds.includes(activeStep.id) ||
          revealedStepIds.includes(activeStep.id)
        return (
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
                  data-sort-outcome={revealed ? (right ? 'correct' : 'not-correct') : undefined}
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
                        {chosen ? (right ? 'Correct.' : 'Not correct.') : 'Example classification.'}
                      </strong>{' '}
                      {right ? '' : `${sort.bins.find((bin) => bin.id === candidate.bin)?.label}. `}
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
                <strong>Optional model exercise.</strong> {transfer.requiredActionLabel}
              </p>
              {guidedActionButtons(transfer.requiredActionIds)}
              {needsControls ? (
                <p>
                  The control to use is in the Controls, in the Simulator panel, and it is
                  highlighted.
                </p>
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
                      Compared with this transfer patient’s baseline, how did{' '}
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
                      The captured quantity{' '}
                      {mcsObservedDirection(
                        Number(capturedBefore?.metrics[transfer.observation.key]),
                        Number(progression.capturedAfter.metrics[transfer.observation.key]),
                        transfer.observation.digits,
                      )}
                      . This is a model observation, not a clinical device-selection or
                      trigger-source recommendation.
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={lookingBack || !progression.choiceByStepId[transferObservationId]}
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
                      Record transfer observation
                    </button>
                  )}
                </div>
              ) : null}
              <p role="status" aria-live="polite" data-transfer-work-status>
                {transferWorkDone
                  ? 'The suggested model exercise was performed in this run.'
                  : 'You can explore any controls or continue without performing the suggested exercise.'}
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
   * Panes
   * ---------------------------------------------------------------- */

  const activeAlarm =
    state.alarms.find((alarm) => alarm.active && alarm.priority === 'critical') ??
    state.alarms.find((alarm) => alarm.active)
  const teachingStep = activeStep.interaction.kind === 'teaching'
  const pendingTimingIdentification = false
  const flowAccountWithheld = false
  const contextItems: ContextStripItem[] = [
    { label: 'Mechanism', value: mechanismLabel(state) },
    { label: 'Setting', value: settingLabel(state) },
    {
      label: 'Displayed flow',
      value: flowAccountWithheld ? 'covered until you commit' : displayedFlowLabel(state),
    },
    { label: 'Mean pressure', value: `${state.metrics.mapMmHg} mm Hg` },
  ]
  const alarm = pendingTimingIdentification
    ? { priority: 'none' as const, text: 'Timing interpretation pending · support running' }
    : activeAlarm
      ? { priority: alarmPriority(activeAlarm.priority), text: activeAlarm.label }
      : { priority: 'none' as const, text: 'No active alarm' }

  const highlightControl: McsLearnControlId | undefined =
    activeStep.interaction.kind === 'action'
      ? activeStep.interaction.targetControl
      : activeStep.interaction.kind === 'transfer'
        ? transferHighlightControl(lesson)
        : undefined

  const simulator = (
    <McsSimulatorPane
      lesson={lesson}
      presentation={MCS_TASK_PRESENTATIONS_ENABLED ? activeStep.presentation : undefined}
      state={state}
      dispatch={dispatch}
      predictionCommitted={true}
      teachingAvailable={teachingStep || walking}
      timingIdentification={pendingTimingIdentification}
      allowedActionIds={teachingStep ? [] : allowedActionIds}
      focusedControls={MCS_TASK_PRESENTATIONS_ENABLED || lesson.introductory}
      flowAccountWithheld={flowAccountWithheld}
      emphasis={emphasis}
      mapAnswer={mapAnswer}
      highlightControl={highlightControl}
      openSurfaces={openSurfaces}
      onToggleSurface={toggleSurface}
      mapPreference={activeStep.surfaces.includes('map') ? activeStep.id : null}
    />
  )

  const teachingPreview =
    !MCS_TASK_PRESENTATIONS_ENABLED &&
    !lesson.introductory &&
    !predictionCommitted &&
    (activeStep.phase === 'recognize' || activeStep.phase === 'predict')
  const teachingExpanded = teachingPreview && progression.expandedTeachingStepId === activeStep.id
  const teaching = (
    <div
      className={styles.teachingColumn}
      data-teaching-column
      data-teaching-preview={teachingPreview && !teachingExpanded ? 'true' : undefined}
    >
      {teachingPreview ? (
        <button
          type="button"
          className={styles.teachingRevealToggle}
          aria-expanded={teachingExpanded}
          data-teaching-reveal
          onClick={() =>
            setProgression((current) => ({
              ...current,
              expandedTeachingStepId: teachingExpanded ? null : activeStep.id,
            }))
          }
        >
          {teachingExpanded
            ? 'Show only the first part of the teaching'
            : 'Show the rest of the teaching for this section'}
        </button>
      ) : null}
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
            flowAccountWithheld={flowAccountWithheld}
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
  const optionalActions = (
    <div className={styles.optionalActions}>
      {canAnswer && !committedChoiceId ? (
        <button type="button" disabled={!selectedChoiceId || lookingBack} onClick={commitChoice}>
          Compare answer
        </button>
      ) : null}
      {question.kind === 'explain' &&
      question.sort &&
      !progression.sortCommittedStepIds.includes(activeStep.id) ? (
        <button type="button" onClick={commitSort}>
          Compare classifications
        </button>
      ) : null}
      {walking && !walkIsLast ? (
        <button type="button" onClick={nextWalkStop}>
          Next stop
        </button>
      ) : null}
      <button type="button" onClick={() => setHelpOpen(true)}>
        Hint
      </button>
      <button
        type="button"
        onClick={() => setRevealedStepIds((ids) => [...new Set([...ids, activeStep.id])])}
      >
        Show explanation
      </button>
      {questionKind || question.kind === 'explain' ? (
        <button type="button" onClick={retryQuestion} disabled={lookingBack}>
          Try again
        </button>
      ) : null}
      {lookingBack ? (
        <button
          type="button"
          onClick={() => {
            retryQuestion()
            enterStep(
              activeIndex,
              progression.performedIds.filter((id) => id !== activeStep.id),
              true,
            )
          }}
        >
          Explore this task again
        </button>
      ) : null}
    </div>
  )

  const task = (
    <>
      <p className={styles.footnote} data-session-identity>
        {unloadingExample ? (
          'Provided model comparison · observation times are shown with each example.'
        ) : (
          <>
            {lookingBack
              ? 'Captured review'
              : progression.transferLoaded
                ? 'Transfer patient'
                : teachingStep
                  ? 'Guided reference'
                  : 'Current exercise'}{' '}
            · seed {state.seed} · {state.timeSeconds.toFixed(2)} simulated seconds.
          </>
        )}
      </p>
      <div ref={nowFocusRef} tabIndex={-1} data-now-focus>
        <NowCard
          model={
            MCS_TASK_PRESENTATIONS_ENABLED
              ? {
                  ...nowModel,
                  where: undefined,
                  body: nowModel.body
                    ?.replaceAll('in Teaching', 'below')
                    .replaceAll('in Steps', 'below')
                    .replaceAll(
                      'in the Teaching panel, under On the loop',
                      'beside the map, under On the loop',
                    )
                    .replaceAll('in the Simulator panel', 'beside the observations'),
                }
              : nowModel
          }
        >
          {MCS_TASK_PRESENTATIONS_ENABLED ? (
            <McsTaskPresentation
              kind={activeStep.presentation}
              teaching={teaching}
              visual={simulator}
              action={nowBody}
              explaining={
                activeStep.interaction.kind === 'explain' ||
                activeStep.interaction.kind === 'observe'
              }
              reference={teachingStep || walking}
            />
          ) : (
            nowBody
          )}
          {optionalActions}
          {showExplanation ? (
            <section className={styles.block} data-provided-explanation>
              <h3>Provided explanation</h3>
              <p>{explanation}</p>
              <p>Viewing this explanation does not submit an answer or run the model.</p>
            </section>
          ) : null}
        </NowCard>
      </div>
      {!unloadingExample ? (
        <>
          <section className={styles.block} data-full-exploration>
            <button
              type="button"
              aria-expanded={explorationOpen}
              onClick={() => setExplorationOpen((open) => !open)}
            >
              Explore all supported controls
            </button>
            {explorationOpen ? (
              <>
                <p>
                  Changes apply to the current simulated patient. These controls extend the
                  suggested exercise. Reset this section to restore its starting configuration;
                  current answers and captures then clear.
                </p>
                <fieldset disabled={lookingBack}>
                  <McsControls
                    state={state}
                    dispatch={(action) => {
                      if (lookingBack) return
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
                    Observe and capture 8 simulated seconds
                  </button>
                </fieldset>
                {lookingBack ? <p>{LOOKING_BACK}</p> : null}
              </>
            ) : null}
          </section>
          <details className={styles.block}>
            <summary>Display playback</summary>
            <button
              type="button"
              className={shellStyles.nowSecondary}
              disabled={lookingBack || pendingTimingIdentification}
              onClick={() => setPlaybackRunning((running) => !running)}
            >
              {playbackRunning ? 'Pause display playback' : 'Play display playback'}
            </button>
            <button
              type="button"
              disabled={lookingBack || pendingTimingIdentification}
              onClick={() => {
                setPlaybackRunning(false)
                sendModel({ type: 'TICK', seconds: 60 / liveState.patient.heartRateBpm })
              }}
            >
              Step one cardiac cycle
            </button>
            <p className={styles.footnote}>
              Playback changes the model clock; it does not stop device support. Captured
              comparisons stay fixed.
            </p>
          </details>
        </>
      ) : null}
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
      <details className={flowStyles.taskMap}>
        <summary>Task history and lesson map</summary>
        <ol aria-label="All lesson tasks">
          {lesson.steps.map((step, index) => (
            <li key={step.id}>
              <button
                type="button"
                aria-current={index === activeIndex ? 'step' : undefined}
                onClick={() => goToStep(index)}
              >
                {step.title}
              </button>
              {progression.visitedStepIds.includes(step.id) ? <span> · visited</span> : null}
            </li>
          ))}
        </ol>
      </details>
      {isLastStep ? (
        <section
          className={stageStyles.completion}
          role="status"
          aria-live="polite"
          data-stage-completion
        >
          <h3>More to explore</h3>
          <p>
            Continue to another topic or try a related case. Only your location and topic visit are
            saved; skipped exercises are not recorded as performed.
          </p>
          <div className={stageStyles.completionActions}>
            {lesson.practicePairing ? (
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
            ) : null}
          </div>
        </section>
      ) : null}
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
          ? `Opened at ${requestedPhase} with the authored starting model. Earlier answers, actions and observations were not restored.`
          : undefined
      }
    />
  )

  const helpDialog = (
    <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} returnFocusTo={helpButtonRef}>
      <p className={shellStyles.kicker}>{stepPosition}</p>
      <p>
        <strong>{activeStep.title}</strong>
      </p>
      <p>
        {MCS_TASK_PRESENTATIONS_ENABLED
          ? activeStep.instruction
              .replaceAll(
                'in the Teaching panel, under On the loop',
                'beside the map, under On the loop',
              )
              .replaceAll('in the Simulator panel', 'beside the observations')
          : activeStep.instruction}
      </p>
      {!MCS_TASK_PRESENTATIONS_ENABLED && lookInLine ? <p>{lookInLine}</p> : null}
      {activeStep.rationale ? <p>{activeStep.rationale}</p> : null}
    </HelpDialog>
  )

  return (
    <McsModuleFrame
      locale={locale}
      activeHref={`${mechanicalCirculatorySupportNavBase}/learn`}
      activityMode
      flowing={MCS_TASK_PRESENTATIONS_ENABLED}
    >
      <StageSourcesScope>
        <div className={styles.stage} data-mcs-stage data-section-id={sectionId}>
          {MCS_TASK_PRESENTATIONS_ENABLED ? (
            <div
              className={flowStyles.flow}
              data-critical-care-activity-shell
              data-stage={activeStep.id}
              data-mcs-task-flow
            >
              {header}
              {referenceViewed && !(teachingStep || walking) ? (
                <ContextStrip items={contextItems} alarm={alarm} badge="Simulated values" />
              ) : null}
              {referenceViewed ? (
                task
              ) : (
                <McsPrerequisiteReference
                  sectionId={sectionId}
                  onContinue={() => setReferenceViewed(true)}
                />
              )}
              <footer>
                <StageSourcesFooter
                  count={stageSources.sourceIds.length}
                  label="Sources for this section"
                  claimsVisible={true}
                >
                  <McsSourceList sourceIds={stageSources.sourceIds} claimsVisible={true} />
                </StageSourcesFooter>
              </footer>
              {helpDialog}
            </div>
          ) : (
            <StageLayout
              stageId={activeStep.id}
              label="Mechanical circulatory support section"
              module="mechanical-circulatory-support"
              workspaceLabel="Mechanical circulatory support lesson workspace: steps, teaching, and simulator"
              header={header}
              contextStrip={
                <ContextStrip items={contextItems} alarm={alarm} badge="Simulated values" />
              }
              simulator={simulator}
              teaching={teaching}
              task={task}
              paneOrder={PANE_ORDER}
              paneCaptions={PANE_CAPTIONS}
              defaultWidthFractions={PANE_WIDTH_FRACTIONS}
              paneMinimums={PANE_MINIMUMS}
              compactPane={compactPane}
              footer={
                <>
                  <p className={stageStyles.footerLine}>
                    Professional education only. Not a clinical device or a patient-specific guide;
                    every value is simulated. Follow current manufacturer instructions and local
                    protocol.
                  </p>
                  <StageSourcesFooter
                    count={stageSources.sourceIds.length}
                    label="Sources for this section"
                    claimsVisible={true}
                  >
                    <McsSourceList sourceIds={stageSources.sourceIds} claimsVisible={true} />
                  </StageSourcesFooter>
                </>
              }
              overlay={helpDialog}
            />
          )}
        </div>
      </StageSourcesScope>
    </McsModuleFrame>
  )
}

/* -------------------------------------------------------------------- *
 * Context-strip derivations
 * -------------------------------------------------------------------- */

function mechanismLabel(state: McsSimulationState): string {
  if (state.device.kind === 'iabp') return 'Counterpulsation'
  if (state.device.kind === 'lvad') return 'Durable pump'
  const { left, right } = state.device
  if (left.enabled && right.enabled) return 'Left and right pumps'
  if (right.enabled) return 'Right-sided pump'
  return 'Transvalvular pump'
}

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
  if (state.device.kind === 'lvad') return `${state.metrics.deviceFlowLMin.toFixed(1)} L/min`
  const { left, right } = state.device
  const parts: string[] = []
  if (left.enabled) parts.push(`left ${state.metrics.leftDeviceFlowLMin.toFixed(1)} L/min`)
  if (right.enabled) parts.push(`right ${state.metrics.rightDeviceFlowLMin.toFixed(1)} L/min`)
  return parts.join(' · ') || 'none reported'
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
