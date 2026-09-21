'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, Circle, LocateFixed } from 'lucide-react'

import {
  useCriticalCareActivityAnalytics,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity'
import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { nextPathwaySection } from '@/features/learning-module/curriculum/types'
import { icuHemodynamicsNavBase } from '@/features/learning-module/moduleRoutes'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import {
  NowCard,
  type NowCardAction,
  type NowCardModel,
} from '@/features/learning-module/stage/NowCard'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { SectionsDrawer } from '@/features/learning-module/stage/SectionsDrawer'
import { StageSourcesFooter } from '@/features/learning-module/stage/StageSourcesFooter'
import { StageSourcesScope } from '@/features/learning-module/stage/StageSourcesScope'
import { StageTeachingScope } from '@/features/learning-module/stage/StageTeachingScope'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'
import { useRouter } from '@/i18n/navigation'

import {
  pawpPlausibilityCommitment,
  pawpRecoveryCommitment,
  pawpRecoveryOutcomes,
} from '../../content/pawpCaptureSequence'
import { hemodynamicsPathway } from '../../content/pathwayResolver'
import { hemodynamicCaseById } from '../../content/cases'
import { isOffMapTarget } from '../../content/mapAnswerTargets'
import { unidentifiedTraceDescription } from '../../content/introductoryTeaching'
import { waveformAtlasById } from '../../content/waveformAtlas'
import { routeStop, routeStopNumber, type RouteStopId } from '../../content/routeSpine'
import { hemodynamicsPracticePairing } from '../../content/sectionSpecs'
import { hemodynamicsStageLesson, type HemodynamicsStageStep } from '../../content/stageLessons'
import { hemodynamicsStageSources } from '../../content/stageSources'
import {
  updateSelfPacedRecord,
  withSectionReviewed,
  withSectionVisited,
} from '../../engine/selfPacedProgress'
import {
  catheterTransitionAllowed,
  catheterTransitionHold,
  paReturnEpisodeKey,
  paWaveformReturned,
} from '../../engine/catheterSafety'
import { catheterFlushBlocked } from '../../engine/pressureObservation'
import {
  DYNAMIC_RESPONSE_CLASSIFIED_CHECK,
  LEVEL_TOLERANCE_CM,
  PA_RETURN_CHECK,
  stageGoalLabel,
  stageGoalMet,
  stageWatchLabels,
  stageWatchValue,
  type StageWatch,
} from '../../engine/stageRuntime'
import type { CatheterPosition, HemodynamicSimulationState } from '../../engine/types'
import { CARDIAC_OUTPUT_PROVENANCE_CHOICES } from '../CardiacOutputMethodModel'
import { CardiacOutputDisagreementLab } from '../CardiacOutputDisagreementLab'
import {
  DerivedEpisodeWorkbench,
  DerivedProvenanceDrill,
  DerivedTransferComparison,
} from '../DerivedHemodynamicsWorkbench'
import { IcuHemodynamicsModuleFrameV2 } from '../IcuHemodynamicsModuleFrameV2'
import {
  catheterMapCaption,
  positionWords,
  type CatheterMapAnswer,
} from '../catheter-map/CatheterMap'
import { useHemodynamicsSelfPacedRecord } from '../useHemodynamicsSelfPacedRecord'
import { HemodynamicsExplanation, HemodynamicsQuestionBlock } from './HemodynamicsQuestion'
import { HemodynamicsSimulatorPane } from './HemodynamicsSimulatorPane'
import { HemodynamicsSourceList } from './HemodynamicsSourceList'
import { HemodynamicsStoryProblems } from './HemodynamicsStoryProblems'
import { HemodynamicsTeachingColumn } from './HemodynamicsTeachingColumn'
import { QuestionSortControl } from './QuestionSortControl'
import { quickControlId } from './StageDocks'
import { AtrialComponentActivity } from './AtrialComponentActivity'
import { emptyRecognitionRecord } from '../WaveformRecognitionDrill'
import { WaveformAtlasFigure } from '../WaveformAtlasFigure'
import {
  deriveStageProgress,
  emptyCommitments,
  entryStateFor,
  simulationWorkPerformed,
  stepAnswered,
  WEDGE_PLAUSIBILITY_KEY,
  WEDGE_RETURN_KEY,
  type StageCommitments,
} from './stageProgress'
import { useHemodynamicsStageSession } from './useHemodynamicsStageSession'
import styles from './hemodynamics-stage.module.css'
import flowStyles from './hemodynamics-flow.module.css'
import { HemodynamicsTaskDrafts } from './HemodynamicsTaskDrafts'
import { FlowPrerequisite, flowReadingParts, flowReadingTitle } from './FlowPrerequisite'
import { hemodynamicsTaskPresentation } from '../../content/taskPresentation'

/**
 * One section of the hemodynamics pathway on the lesson stage.
 *
 * The engine is the authority on the hands-on work: a step's goals are predicates over its state.
 * The host owns what the learner answered and where they are — the choices they checked, the
 * explanations they opened, the step they are looking at — and the Now card that makes every step
 * one thing. Nothing about an answer is persisted; a reload starts the section at its first step,
 * and the only thing written is the self-paced record (sections opened, sections marked reviewed).
 *
 * Self-paced (HD-01): every step can be reached and left without an answer, a correct answer or its
 * simulated actions. Questions are optional, with a hint and an explanation that opens before any
 * answer; Try again clears an answer. Moving past a step never performs it — only goals the learner
 * met on the simulator count, and a skipped step takes no before/after snapshot. What stays enforced
 * is the simulation's own safety: while the balloon is up the learner cannot leave the step, go back,
 * restart or change sections until it is down.
 */
export function HemodynamicsStageHost({
  sectionId,
  locale = 'en',
}: {
  readonly sectionId: string
  readonly locale?: string
}) {
  const [restartCount, setRestartCount] = useState(0)
  return (
    <HemodynamicsStageSession
      key={`${sectionId}:${restartCount}`}
      sectionId={sectionId}
      locale={locale}
      onRestart={() => setRestartCount((count) => count + 1)}
    />
  )
}

const POSITION_CHOICES: readonly { readonly id: CatheterPosition; readonly label: string }[] = [
  { id: 'ra', label: 'The right atrium' },
  { id: 'rv', label: 'The right ventricle' },
  { id: 'pa', label: 'The pulmonary artery' },
]

const STOP_FOR_POSITION: Readonly<Record<CatheterPosition, RouteStopId | null>> = {
  introducer: null,
  ra: 'ra',
  rv: 'rv',
  pa: 'pa',
  wedge: 'wedge',
}

/**
 * The verdict's title, for the items that ask for a decision rather than a read.
 *
 * The shared card's titles were written for signal-recognition items — "That read holds", "That
 * mechanism predicts a different pattern" — and most of this module's items are reads. Its
 * management decisions are not: which move comes first, which sequence, whether to accept a curve.
 * Under those, "that mechanism predicts a different pattern" heads a verdict about a move, so the
 * decision-shaped items carry their own titles. An unsafe choice keeps the card's own words.
 */
const DECISION_FRAMES = {
  best: 'That is the move to make first',
  'reasonable-but-incomplete': 'Defensible, but it leaves a step out',
  'incorrect-mechanism': 'That move answers a different problem',
} as const

/** Transfer items whose stem asks for a move rather than a read; the type says only "transfer". */
const DECISION_SHAPED_TRANSFERS: ReadonlySet<string> = new Set([
  'hd-capstone-transfer-1',
  'hd-advance-transfer-1',
  'pac-pawp-transfer-1',
  'pac-td-transfer-1',
])

/**
 * Titles for the items whose own explanation contradicts the shared card's default sentence.
 *
 * "That mechanism predicts a different pattern" is true of most wrong answers here: a wrong
 * mechanism usually does predict something else on the screen. §1 Task 2 is the exception the
 * report caught (L1-03) — its whole teaching point is that a failing heart, vasodilation and a low
 * volume can all produce the same displayed number, so a header saying the mechanism predicts a
 * different pattern says the opposite of the body underneath it. The stem, the options, their
 * rationales and the key are untouched; only this one sentence is written for this one item.
 */
const ITEM_FRAMES: Readonly<
  Record<string, Partial<Record<ClinicalLearningItem['choices'][number]['plausibility'], string>>>
> = {
  'hd-why-predict-1': {
    'incorrect-mechanism': 'That cause cannot be picked out from this number',
  },
}

function verdictFrames(item: ClinicalLearningItem) {
  const specific = ITEM_FRAMES[item.id]
  if (specific) return specific
  return item.itemType === 'management-decision' || DECISION_SHAPED_TRANSFERS.has(item.id)
    ? DECISION_FRAMES
    : undefined
}

const POSITION_WORDS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'] as const
const COUNT_WORDS = ['one', 'two', 'three', 'four', 'five', 'six'] as const

/**
 * Where a walk stands, in words rather than as a second counter.
 *
 * The walk card names its stop by the number the catheter map prints on it, and a "Stop 1 of 4"
 * beside a card headed "Stop 2 · Right atrium" is two numberings for one place on one screen. So
 * the walk's position is said in words, and the only number on the card is the map's.
 */
function walkPositionWords(index: number, total: number): string {
  if (total <= 1) return 'The only stop in this walk.'
  const position = index >= total - 1 ? 'Last' : (POSITION_WORDS[index] ?? `Stop ${index + 1}`)
  const count = COUNT_WORDS[total - 1] ?? String(total)
  return `${position} of ${count} stops in this walk.`
}

function withoutKey<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const next = { ...record }
  delete next[key]
  return next
}

function toggled(list: readonly string[], key: string): readonly string[] {
  return list.includes(key) ? list.filter((entry) => entry !== key) : [...list, key]
}

function snapshotRound(step: HemodynamicsStageStep): number | null {
  if (step.interaction.kind === 'simulator-task') return step.interaction.round
  if (step.interaction.kind === 'observe') return 0
  return null
}

function HemodynamicsStageSession({
  sectionId,
  locale,
  onRestart,
}: {
  readonly sectionId: string
  readonly locale: string
  readonly onRestart: () => void
}) {
  const router = useRouter()
  const lesson = useMemo(() => hemodynamicsStageLesson(sectionId), [sectionId])
  const { state, dispatch, load } = useHemodynamicsStageSession(lesson.runtime.initial)
  const nextSection = nextPathwaySection(hemodynamicsPathway, sectionId)
  const pairing = hemodynamicsPracticePairing(sectionId)
  const stageSources = useMemo(() => hemodynamicsStageSources(lesson.sectionId), [lesson.sectionId])
  const { record } = useHemodynamicsSelfPacedRecord()

  /* ---------------------------------------------------------------- *
   * Answers, movement and view state
   * ---------------------------------------------------------------- */
  const [commitments, setCommitments] = useState<StageCommitments>(emptyCommitments)
  const [pendingChoice, setPendingChoice] = useState<Record<string, string>>({})
  const [hintsOpen, setHintsOpen] = useState<readonly string[]>([])
  const [explanationsOpen, setExplanationsOpen] = useState<readonly string[]>([])
  const [sortDraft, setSortDraft] = useState<Record<string, string>>({})
  const [walkStopIndex, setWalkStopIndex] = useState(0)
  const [viewIndex, setViewIndex] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [spotlight, setSpotlight] = useState<{ stepId: string; key: string; count: number } | null>(
    null,
  )
  const [snapshots, setSnapshots] = useState<Record<string, HemodynamicSimulationState>>({})
  const [recognitionRecord, setRecognitionRecord] = useState(emptyRecognitionRecord)
  const [confirmedPlaces, setConfirmedPlaces] = useState<Set<string>>(() => new Set())
  const [placeNote, setPlaceNote] = useState<string | null>(null)
  const [placeSelection, setPlaceSelection] = useState<string | null>(null)
  // In-session feedback state for the derived-hemodynamics drills. Nothing here gates a step.
  const [derivedSeparated, setDerivedSeparated] = useState(false)
  const [derivedDisagreementPreserved, setDerivedDisagreementPreserved] = useState(false)
  const [derivedThresholdResolved, setDerivedThresholdResolved] = useState(false)
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const nowFocusRef = useRef<HTMLDivElement>(null)
  const focusedTask = useRef<string | null>(null)

  const progress = deriveStageProgress(lesson, commitments)
  const liveIndex = progress.liveIndex
  const activeIndex = Math.max(0, Math.min(viewIndex ?? liveIndex, lesson.steps.length - 1))
  const activeStep = lesson.steps[activeIndex]
  const lookingBack = viewIndex !== null && viewIndex < liveIndex
  const isLastStep = activeIndex === lesson.steps.length - 1
  const performedIds = progress.performedIds
  const finished = commitments.finished
  const interaction = activeStep.interaction
  const presentation = hemodynamicsTaskPresentation(lesson.sectionId, activeStep)
  /*
   * One rule, consulted by every route out of a step (HD-PRE-REVIEW-01 / report L5-07).
   *
   * `catheterTransitionHold` reads both balloon flags and an in-flight transition together, so
   * Continue, Finish, the task list, Back, the section links, Restart and Save & exit can no longer
   * disagree about whether the simulation may be left. `held` replaces the old `balloonActive`,
   * which several of those routes did not consult at all.
   */
  const hold = catheterTransitionHold(state)
  const held = hold !== null
  const readingParts = flowReadingParts(sectionId, interaction.kind, activeStep.ordinal)
  const [readingPositions, setReadingPositions] = useState<Record<string, number>>({})
  const readingIndex = readingPositions[activeStep.id] ?? 0
  const readingPart = lookingBack ? undefined : readingParts[readingIndex]
  const [taskBaselines, setTaskBaselines] = useState<Record<string, HemodynamicSimulationState>>({})
  const performedNow = simulationWorkPerformed(
    activeStep,
    state,
    commitments,
    taskBaselines[activeStep.id],
  )
  const reviewed = record.reviewedSectionIds.includes(lesson.sectionId)

  // Lifecycle analytics keep their automatic open/visible/phase events. HD-01 removed every call that
  // reported an answer, a hint, a completion or a mastery; nothing here sends a learner's responses.
  useCriticalCareActivityAnalytics({
    moduleId: 'icu-hemodynamics',
    activityId: lesson.lifecycleActivityId,
    mode: 'guided',
    phase: activeStep.phase,
  })

  useEffect(() => {
    const key = `${activeStep.id}:${readingPart ?? ''}`
    const previous = focusedTask.current
    focusedTask.current = key
    if (previous === null) return
    nowFocusRef.current?.focus({ preventScroll: true })
    nowFocusRef.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
  }, [activeStep.id, readingPart])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    // A new section can mount before Next's history update is visible to this effect.
    // Retaining the old activity query here would navigate straight back to that section.
    url.searchParams.set('activity', lesson.sectionId)
    url.searchParams.set('phase', activeStep.phase)
    window.history.replaceState(window.history.state, '', url)
  }, [activeStep.phase, lesson.sectionId])

  useEffect(() => {
    updateSelfPacedRecord((current) => withSectionVisited(current, lesson.sectionId))
  }, [lesson.sectionId])

  /* ---------------------------------------------------------------- *
   * Questions
   * ---------------------------------------------------------------- */
  const hintFor = (step: HemodynamicsStageStep) =>
    `One idea from this section: ${lesson.spec.newConcept}${step.rationale ? ` ${step.rationale}` : ''}`

  function checkChoice(key: string) {
    const choiceId = pendingChoice[key]
    if (!choiceId) return
    setCommitments((current) => ({
      ...current,
      choices: { ...current.choices, [key]: choiceId },
    }))
  }

  function tryAgain(key: string) {
    setCommitments((current) => ({ ...current, choices: withoutKey(current.choices, key) }))
    setPendingChoice((current) => withoutKey(current, key))
  }

  function toggleExplanation(key: string) {
    setExplanationsOpen((current) => toggled(current, key))
    setCommitments((current) =>
      current.explanationsShown.includes(key)
        ? current
        : { ...current, explanationsShown: [...current.explanationsShown, key] },
    )
  }

  function questionProps(key: string, step: HemodynamicsStageStep) {
    return {
      name: `hd-question-${key}`,
      selectedId: pendingChoice[key] ?? null,
      onSelect: (choiceId: string) =>
        setPendingChoice((current) => ({ ...current, [key]: choiceId })),
      checkedId: commitments.choices[key],
      onCheck: () => checkChoice(key),
      onTryAgain: () => tryAgain(key),
      explanationOpen: explanationsOpen.includes(key),
      onToggleExplanation: () => toggleExplanation(key),
      hintOpen: hintsOpen.includes(key),
      onToggleHint: () => setHintsOpen((current) => toggled(current, key)),
      hint: hintFor(step),
    }
  }

  function commitSort() {
    if (interaction.kind !== 'sort') return
    const placed = Object.fromEntries(
      interaction.sort.rows.flatMap((row) =>
        sortDraft[row.id] ? [[row.id, sortDraft[row.id]]] : [],
      ),
    )
    if (Object.keys(placed).length === 0) return
    setCommitments((current) => ({ ...current, sort: placed }))
  }

  /* ---------------------------------------------------------------- *
   * Movement
   * ---------------------------------------------------------------- */
  const openStep = useCallback(
    (index: number, entry: HemodynamicSimulationState | null, mode: 'forward' | 'reenter') => {
      const step = lesson.steps[index]
      if (!step) return
      if (entry) load(entry)
      const opened = entry ?? state
      setTaskBaselines((current) =>
        mode === 'reenter' || !current[step.id] ? { ...current, [step.id]: opened } : current,
      )
      const round = snapshotRound(step)
      if (round !== null) {
        setSnapshots((current) => {
          const beforeKey = `before:${round}`
          if (mode === 'forward' && current[beforeKey]) return current
          const next = { ...current, [beforeKey]: opened }
          if (mode === 'reenter') delete next[`after:${round}`]
          return next
        })
      }
    },
    [lesson.steps, load, state],
  )

  /** Move past a step — performing it only if the learner's own simulation work on it is done. */
  const continuePast = useCallback(
    (index: number) => {
      // The same eligibility rule the banner, the task list and Finish use. Reading only
      // `balloonInflated` here let a section be left mid-float (report L5-07).
      if (!catheterTransitionAllowed(state)) return
      const step = lesson.steps[index]
      if (!step) return
      const performed = simulationWorkPerformed(step, state, commitments, taskBaselines[step.id])
      setCommitments((current) => ({
        ...current,
        confirmed: Math.max(current.confirmed, index),
        performedIds:
          performed && !current.performedIds.includes(step.id)
            ? [...current.performedIds, step.id]
            : current.performedIds,
      }))
      setViewIndex(null)
      setSpotlight(null)
      setPlaceNote(null)
      const round = snapshotRound(step)
      // A skipped step takes no "after" snapshot, so nothing reads an untouched state as a result.
      if (performed && round !== null) {
        setSnapshots((current) => ({ ...current, [`after:${round}`]: state }))
      }
      const next = index + 1
      if (next < lesson.steps.length) {
        openStep(next, lesson.steps[next].entryState?.() ?? null, 'forward')
      }
    },
    [commitments, lesson.steps, openStep, state, taskBaselines],
  )

  /** Open any step live: later ones are reached without doing the steps between; earlier ones restart. */
  function moveTo(target: number) {
    if (held) return
    const index = Math.max(0, Math.min(target, lesson.steps.length - 1))
    if (index === liveIndex && viewIndex === null) return
    const entry = entryStateFor(lesson, index, liveIndex)
    setCommitments((current) => ({ ...current, confirmed: index - 1 }))
    setViewIndex(null)
    setSpotlight(null)
    setPlaceNote(null)
    openStep(index, entry, index > liveIndex ? 'forward' : 'reenter')
  }

  function goBack() {
    if (held || activeIndex <= 0) return
    setViewIndex(activeIndex - 1)
  }

  function returnToLive() {
    setViewIndex(null)
  }

  function goToSection(nextId: string) {
    if (held || nextId === sectionId) return
    // Changing sections intentionally starts that section's safe session. A document navigation
    // avoids racing query-only Next transitions against the current session's phase history.
    window.location.assign(
      `/${locale}${icuHemodynamicsNavBase}/learn?activity=${encodeURIComponent(nextId)}`,
    )
  }

  function finish() {
    if (!catheterTransitionAllowed(state)) return
    const performed = simulationWorkPerformed(
      activeStep,
      state,
      commitments,
      taskBaselines[activeStep.id],
    )
    setCommitments((current) => ({
      ...current,
      confirmed: Math.max(current.confirmed, activeIndex),
      performedIds:
        performed && !current.performedIds.includes(activeStep.id)
          ? [...current.performedIds, activeStep.id]
          : current.performedIds,
      finished: true,
    }))
    setViewIndex(null)
    updateSelfPacedRecord((current) => withSectionReviewed(current, lesson.sectionId, true))
  }

  /* ---------------------------------------------------------------- *
   * The walk, the map, and confirming a place
   * ---------------------------------------------------------------- */
  const walkStop: RouteStopId | null =
    interaction.kind === 'walk' && !commitments.walkDone
      ? (interaction.stops[walkStopIndex] ?? null)
      : null
  const walkPosition: CatheterPosition | null =
    interaction.kind === 'walk' ? (interaction.positions[walkStopIndex] ?? null) : null

  useEffect(() => {
    if (interaction.kind !== 'walk' || commitments.walkDone || lookingBack) return
    if (!walkPosition || state.catheter.position === walkPosition) return
    dispatch({ type: 'SET_CATHETER_POSITION', position: walkPosition })
    // The walk moves the tip to each stop so the monitor shows the tracing that stop writes.
  }, [
    commitments.walkDone,
    dispatch,
    interaction.kind,
    lookingBack,
    state.catheter.position,
    walkPosition,
  ])

  const locationItem =
    interaction.kind === 'prediction' && interaction.mapTargets ? interaction : null
  const locationAnswered = locationItem ? commitments.choices[activeStep.id] !== undefined : false
  const locationShown = locationItem ? commitments.explanationsShown.includes(activeStep.id) : false
  const locationRevealed = locationAnswered || locationShown

  const keyedStops = (): readonly RouteStopId[] => {
    if (!locationItem) return []
    const keyed = locationItem.mapTargets!.find(
      (target) => target.choiceId === locationItem.item.correctChoiceIds[0],
    )
    return keyed && !isOffMapTarget(keyed) ? [keyed.stopId] : []
  }

  const stops: readonly RouteStopId[] = walkStop
    ? [walkStop]
    : locationItem
      ? locationRevealed
        ? keyedStops()
        : []
      : activeStep.stops

  const mapCaption = walkStop
    ? `You are here: ${routeStop(walkStop).title.toLowerCase()}. ${walkPositionWords(walkStopIndex, interaction.kind === 'walk' ? interaction.stops.length : 0)}`
    : locationItem && !locationRevealed
      ? 'Where is the tip? Choose a place below.'
      : interaction.kind === 'simulator-task' &&
          lesson.sectionId === 'catheter-advancement' &&
          interaction.round === 0
        ? 'Confirm each place as the tracing settles there.'
        : catheterMapCaption(stops)

  const tipVisible =
    (activeStep.chamberLabel === 'shown' || locationRevealed) &&
    activeStep.surface !== 'recognition'

  /*
   * Confirming a place, and saying what happened where it was said.
   *
   * The response was rendered in the Now card while the pins are in the simulator pane, so a
   * mismatched or premature confirmation looked like nothing at all (report L5-02). It is rendered
   * at the control now, and the row the learner pressed stays selected, so a second press on the
   * same row has an answer on screen rather than needing a second event to produce one. Nothing is
   * counted: the response describes the tracing at that moment and clears when the tip moves.
   */
  const confirmPlaceOnMap = (choiceId: string) => {
    const position = choiceId as CatheterPosition
    setPlaceSelection(choiceId)
    if (state.catheter.position === position && state.catheter.targetPosition === null) {
      dispatch({ type: 'VALIDATE_SIGNAL', check: `waveform-confirmed-${position}` })
      setConfirmedPlaces((current) => new Set([...current, choiceId]))
      setPlaceNote(`Confirmed: ${positionWords(position)}.`)
    } else {
      setPlaceNote(
        state.catheter.targetPosition !== null
          ? 'The tip is still moving. Wait for the tracing to settle, then confirm.'
          : 'The tracing on the monitor does not match that place. Look at the shape again.',
      )
    }
  }

  /*
   * What a confirmation and its response belong to, adjusted during render rather than in an
   * effect so the same render already shows the right thing.
   *
   * A response belongs to the tracing it was given about, so it clears when the tip moves. A
   * confirmation belongs to the task it was made in: the badges used to carry into the next task,
   * so a later step opened with places already marked confirmed (report L5-06, Figure 28).
   */
  const placeKey = `${state.catheter.position}:${state.catheter.targetPosition ?? ''}`
  const [placeTaskId, setPlaceTaskId] = useState(activeStep.id)
  const [placeObservation, setPlaceObservation] = useState(placeKey)
  if (placeTaskId !== activeStep.id) {
    setPlaceTaskId(activeStep.id)
    setConfirmedPlaces(new Set())
    setPlaceNote(null)
    setPlaceSelection(null)
  }
  if (placeObservation !== placeKey) {
    setPlaceObservation(placeKey)
    setPlaceNote(null)
    setPlaceSelection(null)
  }

  const mapAnswer: CatheterMapAnswer | undefined = locationItem
    ? {
        legend: locationItem.item.stem,
        name: `hd-locate-${activeStep.id}`,
        choices: orderChoices(locationItem.item.id, locationItem.item.choices).map((choice) => ({
          id: choice.id,
          label: choice.label,
        })),
        targets: Object.fromEntries(
          locationItem.mapTargets!.map((target) => [
            target.choiceId,
            isOffMapTarget(target) ? null : target.stopId,
          ]),
        ),
        selectedChoiceId: locationAnswered
          ? commitments.choices[activeStep.id]
          : (pendingChoice[activeStep.id] ?? null),
        onSelect: (choiceId) =>
          setPendingChoice((current) => ({ ...current, [activeStep.id]: choiceId })),
        disabled: locationAnswered,
        revealed: locationAnswered
          ? { keyedChoiceId: locationItem.item.correctChoiceIds[0] }
          : undefined,
      }
    : interaction.kind === 'simulator-task' &&
        lesson.sectionId === 'catheter-advancement' &&
        !lookingBack
      ? {
          legend: 'Which place is the tip at now?',
          name: `hd-confirm-${activeStep.id}`,
          choices: POSITION_CHOICES,
          targets: Object.fromEntries(
            POSITION_CHOICES.map((choice) => [choice.id, STOP_FOR_POSITION[choice.id]]),
          ),
          selectedChoiceId: placeSelection,
          onSelect: confirmPlaceOnMap,
          disabled: performedNow,
          confirmed: confirmedPlaces,
          hint: 'After each move, wait for the tracing to settle, then confirm the place it says. A place is confirmed only when the tracing matches it.',
          note: placeNote,
        }
      : undefined

  /* ---------------------------------------------------------------- *
   * Goals, spotlight
   * ---------------------------------------------------------------- */
  const goals =
    interaction.kind === 'simulator-task' || interaction.kind === 'observe' ? interaction.goals : []
  const goalsMetNow = goals.map((goal) => stageGoalMet(goal, state))
  const firstUnmetKey = (() => {
    const unmet = goals.find((goal) => !stageGoalMet(goal, state))
    if (!unmet) return null
    switch (unmet.type) {
      case 'level':
        return 'level'
      case 'zeroed':
        return 'zero'
      case 'position':
        return 'advance'
      case 'wedge-stored':
        return state.catheter.balloonInflated ? 'cursor' : 'inflate'
      case 'balloon-down':
        return 'deflate'
      case 'series':
      case 'trials-reviewed':
        return 'inject'
      case 'frozen':
        return 'freeze'
      case 'check':
        return unmet.id.startsWith('waveform-confirmed')
          ? 'advance'
          : unmet.id === 'fast-flush'
            ? 'flush'
            : unmet.id === 'dynamic-response-corrected'
              ? 'repair'
              : 'flush'
      /*
       * Which control is next for a case milestone.
       *
       * These three cover several operations each, so "the control" depends on where the run has
       * got to — and, for the line, on whether the catheter is allowing a flush at all. Pointing
       * at a disabled Flush while the tip sits in an occluding position is the same defect the
       * capstone's stated order had (report L9-02): the control that moves the run on is the one
       * that unblocks it.
       */
      case 'intervention':
        if (unmet.id === 'reposition-catheter') {
          return state.catheter.balloonInflated ? 'deflate' : 'withdraw'
        }
        if (unmet.id === 'repeat-valid-thermodilution') {
          return catheterFlushBlocked(state, 'pulmonary-artery') ? 'withdraw' : 'inject'
        }
        if (Math.abs(state.measurementSystem.transducerLevelCm) > LEVEL_TOLERANCE_CM) return 'level'
        if (!state.measurementSystem.zeroed) return 'zero'
        if (catheterFlushBlocked(state, 'pulmonary-artery')) return 'withdraw'
        return state.signalValidationChecks.includes(DYNAMIC_RESPONSE_CLASSIFIED_CHECK)
          ? 'repair'
          : 'flush'
      default:
        return null
    }
  })()

  useEffect(() => {
    if (!spotlight || spotlight.stepId !== activeStep.id) return
    const timer = window.setTimeout(() => {
      const control = document.getElementById(quickControlId(spotlight.key))
      if (!control) return
      // The capstone groups its docks in disclosures, and a control inside a closed one cannot take
      // focus: "Show me where" quietly did nothing there. Open the disclosures on the way down.
      for (
        let group = control.closest('details');
        group;
        group = group.parentElement?.closest('details') ?? null
      ) {
        group.open = true
      }
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
  const stepPosition = `Task ${activeStep.ordinal} of ${lesson.steps.length}`
  const canGoBack = activeIndex > 0 && !held
  const showWhereAction =
    firstUnmetKey && !performedNow && !lookingBack
      ? {
          label: spotlight?.stepId === activeStep.id ? 'Highlight it again' : 'Show me where',
          onActivate: showWhere,
          icon: <LocateFixed aria-hidden="true" />,
        }
      : undefined
  const moveOn = (label: string): NowCardAction =>
    isLastStep
      ? {
          label: interaction.kind === 'explain' ? activeStep.actionLabel : 'Finish the section',
          onActivate: finish,
          icon: <ArrowRight aria-hidden="true" />,
        }
      : {
          label,
          onActivate: () => continuePast(activeIndex),
          icon: <ArrowRight aria-hidden="true" />,
        }
  const optionalTaskStatus =
    'These actions are optional. Continuing without them records nothing about them.'

  const nowModel: NowCardModel = (() => {
    const base: NowCardModel = {
      kicker: stepPosition,
      heading: activeStep.title,
      body: activeStep.instruction,
      why: activeStep.rationale,
      ...(canGoBack
        ? {
            back: {
              label: 'Back to previous task',
              onActivate: goBack,
            },
          }
        : {}),
    }
    if (readingPart)
      return {
        ...base,
        kicker: `${stepPosition} · Introduction ${readingIndex + 1} of ${readingParts.length}`,
        heading: flowReadingTitle(readingPart),
        body: 'Follow the observation and its source inputs before applying the method.',
        primary: {
          label:
            readingIndex < readingParts.length - 1
              ? 'Continue introduction'
              : 'Apply this to the task',
          onActivate: () =>
            setReadingPositions((current) => ({ ...current, [activeStep.id]: readingIndex + 1 })),
        },
      }
    if (lookingBack) {
      const canRedo =
        (interaction.kind === 'simulator-task' ||
          interaction.kind === 'observe' ||
          interaction.kind === 'walk') &&
        !performedIds.has(activeStep.id)
      return {
        ...base,
        status:
          'Reviewing an earlier step. The monitor shows the current live state, not a historical snapshot. Controls are paused; answers you checked in this visit are kept.',
        primary: {
          label: `Return to step ${liveIndex + 1}`,
          onActivate: returnToLive,
          icon: <ArrowRight aria-hidden="true" />,
        },
        ...(canRedo
          ? { secondary: { label: 'Do this task now', onActivate: () => moveTo(activeIndex) } }
          : {}),
      }
    }
    if (finished && isLastStep) {
      return {
        ...base,
        status: reviewed
          ? 'Section finished and marked reviewed on this device.'
          : 'Section finished.',
      }
    }
    switch (interaction.kind) {
      case 'read':
        return { ...base, primary: moveOn(activeStep.actionLabel) }
      case 'walk': {
        if (commitments.walkDone) {
          return { ...base, status: 'Every stop visited.', primary: moveOn('Continue') }
        }
        const last = walkStopIndex >= interaction.stops.length - 1
        return {
          ...base,
          status: walkPositionWords(walkStopIndex, interaction.stops.length),
          primary: {
            label: last ? 'Finish the walk' : 'Next stop',
            onActivate: () => {
              if (last) setCommitments((current) => ({ ...current, walkDone: true }))
              else setWalkStopIndex((index) => index + 1)
            },
            icon: <ArrowRight aria-hidden="true" />,
          },
          ...(walkStopIndex > 0
            ? {
                secondary: {
                  label: 'Previous stop',
                  onActivate: () => setWalkStopIndex((index) => Math.max(0, index - 1)),
                },
              }
            : {}),
        }
      }
      case 'prediction': {
        if (commitments.choices[activeStep.id] !== undefined) {
          return { ...base, primary: moveOn('Continue') }
        }
        return {
          ...base,
          status: activeStep.questionTraceId
            ? 'The question is the authored tracing and vignette on this card. Its labels appear when you check an answer or open the explanation.'
            : 'Optional question. Check an answer, open the explanation, or continue without answering.',
          primary: moveOn('Continue without answering'),
        }
      }
      case 'sort':
        return commitments.sort || commitments.sortShown
          ? { ...base, primary: moveOn('Continue') }
          : {
              ...base,
              status:
                'Optional sort. Place any rows and check them, open the worked sort, or continue without sorting.',
              primary: moveOn('Continue without sorting'),
            }
      case 'simulator-task':
        return performedNow
          ? {
              ...base,
              status: 'Done. The actions on this step are recorded for this visit.',
              primary: moveOn('Continue'),
            }
          : {
              ...base,
              status: optionalTaskStatus,
              primary: moveOn('Continue without these actions'),
              secondary: showWhereAction,
            }
      case 'observe':
        if (goals.length === 0) {
          return {
            ...base,
            status: 'Read the observation below. Any question on it is optional.',
            primary: moveOn(activeStep.actionLabel),
          }
        }
        return performedNow
          ? { ...base, status: 'Done.', primary: moveOn(activeStep.actionLabel) }
          : {
              ...base,
              status: `${optionalTaskStatus} The questions below are optional too.`,
              primary: moveOn('Continue without these actions'),
              secondary: showWhereAction,
            }
      case 'explain':
        return { ...base, primary: moveOn(activeStep.actionLabel) }
      case 'recognition-practice':
        return {
          ...base,
          status:
            'Optional practice. Try, show or compare tracings for as long as it is useful, then continue.',
          primary: moveOn('Continue'),
        }
      case 'component-identification':
        return {
          ...base,
          status:
            'Optional practice. Check a component, show it, switch numbering, or move on at any point.',
          primary: moveOn('Continue'),
        }
      case 'provenance-drill':
      case 'derived-workbench':
      case 'derived-transfer':
      case 'disagreement':
        return {
          ...base,
          status:
            'Optional practice. Check your reasoning or open it directly, then continue when ready.',
          primary: moveOn('Continue'),
        }
      default:
        return base
    }
  })()

  /* ---------------------------------------------------------------- *
   * The Now card's body
   * ---------------------------------------------------------------- */
  const traceEntry = activeStep.questionTraceId
    ? waveformAtlasById.get(activeStep.questionTraceId)
    : undefined
  const traceRevealed =
    interaction.kind !== 'prediction' ||
    commitments.choices[activeStep.id] !== undefined ||
    commitments.explanationsShown.includes(activeStep.id)
  const questionFigure = traceEntry ? (
    <WaveformAtlasFigure
      entry={
        traceRevealed
          ? traceEntry
          : {
              ...traceEntry,
              label: 'Right-atrial question trace',
              normalRange: null,
              insertionDepth: null,
            }
      }
      annotated={traceRevealed}
      ecgLandmarks
      readable
      figureDescription={
        traceRevealed
          ? undefined
          : `${unidentifiedTraceDescription(traceEntry)} Axis 0–${traceEntry.scaleMaxMmHg} mmHg. Mechanism labels appear when you check an answer or open the explanation.`
      }
    />
  ) : null

  const predictionBody = (step: HemodynamicsStageStep) => {
    if (step.interaction.kind !== 'prediction') return null
    const item = step.interaction.item
    const chosen = item.choices.find((choice) => choice.id === pendingChoice[step.id])
    return (
      <HemodynamicsQuestionBlock
        item={item}
        {...questionProps(step.id, step)}
        frames={verdictFrames(item)}
        choicesElsewhere={
          step.interaction.mapTargets ? (
            <p className={stageStyles.taskInstruction} data-map-answer-note>
              Choose a place on the catheter map above.
              {chosen ? ` Chosen: ${chosen.label}.` : ''}
            </p>
          ) : undefined
        }
      />
    )
  }

  const nowBody: ReactNode = (() => {
    if (lookingBack) {
      if (interaction.kind === 'prediction') return predictionBody(activeStep)
      return (
        <StepRecap
          step={activeStep}
          commitments={commitments}
          performed={performedIds.has(activeStep.id)}
          state={state}
        />
      )
    }
    switch (interaction.kind) {
      case 'walk': {
        if (commitments.walkDone || !walkStop) return null
        const stop = routeStop(walkStop)
        return (
          <section className={styles.walk} data-walk-stop={stop.id} aria-label={stop.title}>
            <p className={styles.kicker}>
              Stop {routeStopNumber(stop.id)} · {stop.title}
            </p>
            <p className={styles.analogy}>{stop.analogy}</p>
            <dl>
              <div>
                <dt>On the monitor</dt>
                <dd>{stop.monitorLabel}.</dd>
              </div>
              <div>
                <dt>{activeStep.surface === 'line' ? 'Try this' : 'Later activity'}</dt>
                <dd>
                  {stop.wiggle.change} {stop.wiggle.watch}
                  {activeStep.surface !== 'line'
                    ? ' These controls become available in the procedural lessons.'
                    : ''}
                </dd>
              </div>
            </dl>
            {/*
              The short list, with the label that says what kind of list it is. It rendered as
              four bare lines with the marker reset away, under a definition list, so it read as
              more prose. The label is authored per stop, because the five lists are not all the
              same kind of thing.
            */}
            <p
              className={styles.kicker}
              id={`${activeStep.id}-walk-checklist`}
              data-walk-checklist-label
            >
              {stop.checklistLabel}
            </p>
            <ul aria-labelledby={`${activeStep.id}-walk-checklist`} data-walk-checklist>
              {stop.checklist.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <button
              type="button"
              className={shellStyles.nowSecondary}
              data-skip-task
              disabled={held}
              onClick={() => continuePast(activeIndex)}
            >
              Continue without finishing the walk
            </button>
          </section>
        )
      }
      case 'prediction':
        return predictionBody(activeStep)
      case 'derived-workbench':
        return (
          <ul className={stageStyles.taskList} data-step-goals-optional aria-label="Things to try">
            {[
              'Name every input one calculation depends on',
              'Withhold a value for the input that makes it unreadable',
              'Keep the values that input does not touch',
              'Trace a flow-dependent value to the method that produced it',
              'Keep a two-method disagreement without averaging it',
              'Read a boundary inside its context, not as a universal number',
            ].map((label) => (
              <li key={label}>
                <Circle aria-hidden="true" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        )
      case 'sort': {
        const checked = commitments.sort !== null
        const placed = interaction.sort.rows.filter((row) => sortDraft[row.id]).length
        return (
          <>
            <QuestionSortControl
              sort={interaction.sort}
              draft={sortDraft}
              committed={commitments.sort}
              shown={commitments.sortShown && !checked}
              onChange={(rowId, originId) =>
                setSortDraft((current) => ({ ...current, [rowId]: originId }))
              }
            />
            <div className={stageStyles.completionActions} data-question-actions>
              {checked ? (
                <button
                  type="button"
                  className={shellStyles.nowSecondary}
                  data-question-try-again
                  onClick={() => setCommitments((current) => ({ ...current, sort: null }))}
                >
                  Try again
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={shellStyles.nowSecondary}
                    data-question-check
                    disabled={placed === 0}
                    onClick={commitSort}
                  >
                    Check placements
                  </button>
                  <button
                    type="button"
                    className={shellStyles.nowSecondary}
                    data-question-explanation-toggle
                    aria-expanded={commitments.sortShown}
                    onClick={() =>
                      setCommitments((current) => ({ ...current, sortShown: !current.sortShown }))
                    }
                  >
                    {commitments.sortShown ? 'Hide the worked sort' : 'Show the worked sort'}
                  </button>
                </>
              )}
            </div>
          </>
        )
      }
      case 'simulator-task':
      case 'observe': {
        const wedgeQuestions = interaction.kind === 'observe' ? interaction.commitments : []
        const provenance = interaction.kind === 'observe' && interaction.provenance
        return (
          <>
            {goals.length > 0 ? (
              <ul className={stageStyles.taskList} data-step-goals aria-label="What to do">
                {goals.map((goal, index) => (
                  <li key={`${goal.type}-${index}`} data-met={goalsMetNow[index]}>
                    {goalsMetNow[index] ? (
                      <Check aria-hidden="true" />
                    ) : (
                      <Circle aria-hidden="true" />
                    )}
                    <span>{stageGoalLabel(goal)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {interaction.kind === 'observe' && lesson.runtime.comparison === 'ventricle-artery' ? (
              <VentricleArtery state={state} />
            ) : null}
            {wedgeQuestions.includes('plausibility') ? (
              <section
                className={styles.commitment}
                data-commitment={`${activeStep.id}:${WEDGE_PLAUSIBILITY_KEY}`}
                aria-label="Is the stored value plausible?"
              >
                <p className={styles.kicker}>Is the stored value plausible?</p>
                <HemodynamicsQuestionBlock
                  item={pawpPlausibilityCommitment}
                  {...questionProps(`${activeStep.id}:${WEDGE_PLAUSIBILITY_KEY}`, activeStep)}
                  frames={verdictFrames(pawpPlausibilityCommitment)}
                />
              </section>
            ) : null}
            {goals.some((goal) => goal.type === 'reassessed') ? (
              <div className={styles.returnCheck} data-reassess>
                <p>
                  <strong>Reassess.</strong> Read the corrected pressures and the series against a
                  patient who has not changed, as one set, before anything on the screen is believed
                  again.
                </p>
                <button
                  type="button"
                  className={shellStyles.nowSecondary}
                  disabled={state.reassessed}
                  onClick={() => dispatch({ type: 'REASSESS' })}
                >
                  {state.reassessed ? 'Reassessed' : 'Reassess the screen against the patient'}
                </button>
              </div>
            ) : null}
            {interaction.kind === 'simulator-task' &&
            goals.some((goal) => goal.type === 'check' && goal.id === PA_RETURN_CHECK) ? (
              <ReturnCheck
                state={state}
                onObserved={(episode) =>
                  dispatch({ type: 'VALIDATE_SIGNAL', check: `${PA_RETURN_CHECK}:${episode}` })
                }
              />
            ) : null}
            {wedgeQuestions.includes('return') ? (
              <>
                <ReturnCheck
                  state={state}
                  onObserved={(episode) =>
                    dispatch({ type: 'VALIDATE_SIGNAL', check: `${PA_RETURN_CHECK}:${episode}` })
                  }
                />
                <section
                  className={styles.commitment}
                  data-commitment={`${activeStep.id}:${WEDGE_RETURN_KEY}`}
                  aria-label="And if it had not come back?"
                >
                  <p className={styles.kicker}>And if it had not come back?</p>
                  <HemodynamicsQuestionBlock
                    item={pawpRecoveryCommitment}
                    {...questionProps(`${activeStep.id}:${WEDGE_RETURN_KEY}`, activeStep)}
                    frames={verdictFrames(pawpRecoveryCommitment)}
                  />
                </section>
              </>
            ) : null}
            {provenance ? (
              <ProvenanceQuestion
                onResolved={() =>
                  setCommitments((current) =>
                    current.provenanceResolved ? current : { ...current, provenanceResolved: true },
                  )
                }
              />
            ) : null}
          </>
        )
      }
      case 'explain': {
        const round = interaction.round
        const predictionStep = lesson.steps.find(
          (s) => s.interaction.kind === 'prediction' && s.interaction.round === round,
        )
        const predictionItem =
          predictionStep && predictionStep.interaction.kind === 'prediction'
            ? predictionStep.interaction.item
            : undefined
        const chosenId = predictionStep ? commitments.choices[predictionStep.id] : undefined
        const before = snapshots[`before:${round}`]
        const after = snapshots[`after:${round}`]
        return (
          <>
            {/*
              The prediction's reasoning, again, in full: the verdict when the learner answered,
              and the explanation when they moved on without answering. Several Explain
              instructions begin "Read the reasoning", so the reasoning comes first either way.
            */}
            {predictionItem ? (
              <div data-explain-recap={chosenId ? 'answered' : 'not-answered'}>
                {chosenId ? (
                  <AnswerVerdict
                    item={predictionItem}
                    choiceId={chosenId}
                    outcome="stated"
                    timing="immediate-after-commit"
                    theme="dark"
                    frames={verdictFrames(predictionItem)}
                  />
                ) : (
                  <HemodynamicsExplanation
                    item={predictionItem}
                    heading="The reasoning"
                    note="The question earlier in this section was not answered. Here is its reasoning; nothing is recorded."
                  />
                )}
              </div>
            ) : null}
            {lesson.runtime.comparison === 'ventricle-artery' ? (
              <VentricleArtery state={state} />
            ) : before && after && lesson.runtime.watch.length > 0 ? (
              <>
                {lesson.sectionId === 'pressure-system' ? (
                  <p className={styles.dockNote}>
                    These snapshots show PAC pressure estimates from the loaded fault and after
                    correction. The live monitor reads the latest displayed cardiac cycle and can
                    vary with respiration.
                  </p>
                ) : null}
                <BeforeAfter before={before} after={after} watch={lesson.runtime.watch} />
              </>
            ) : lesson.runtime.watch.length > 0 ? (
              <p className={styles.dockNote} data-before-after-absent>
                There is no before-and-after table here because the hands-on step for this part was
                not done in this visit. Nothing was changed on the simulator to compare.
              </p>
            ) : null}
            {round === 0 ? <HemodynamicsStoryProblems sectionId={lesson.sectionId} /> : null}
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
  /*
   * Whether the docks can be operated, and the line on the simulator that says why not. Only looking
   * back pauses them; an unanswered question never does (HD-01). The monitor's own alarm
   * acknowledgement and the balloon's deflate stay live throughout.
   */
  const controlsEnabled = !lookingBack
  const pausedReason = lookingBack
    ? 'The controls are paused while you look back at an earlier step. Return to the live step to take them.'
    : undefined
  // A question may keep its own case-specific reasoning folded until the learner checks an answer or
  // opens the explanation. Nothing else — no other step, source or teaching block — waits on it.
  const revealOpen =
    interaction.kind !== 'prediction' ||
    commitments.choices[activeStep.id] !== undefined ||
    commitments.explanationsShown.includes(activeStep.id)

  const extraSurface: ReactNode = (() => {
    switch (interaction.kind) {
      case 'component-identification':
        return (
          <AtrialComponentActivity
            key={activeStep.id}
            selections={{
              guided: commitments.componentSelections[`${activeStep.id}:guided`],
              independent: commitments.componentSelections[`${activeStep.id}:independent`],
            }}
            onChange={(numbering, selections) =>
              setCommitments((current) => ({
                ...current,
                componentSelections: {
                  ...current.componentSelections,
                  [`${activeStep.id}:${numbering}`]: selections,
                },
              }))
            }
            enabled={controlsEnabled}
          />
        )
      case 'provenance-drill':
        return (
          <div className={styles.surfaceCard} data-surface="provenance-drill">
            <DerivedProvenanceDrill
              separated={derivedSeparated}
              onSeparated={() => setDerivedSeparated(true)}
            />
          </div>
        )
      case 'derived-workbench':
        return (
          <div className={styles.surfaceCard} data-surface="derived-workbench">
            <DerivedEpisodeWorkbench
              focused
              dispatch={dispatch}
              checks={state.signalValidationChecks}
              disagreementPreserved={derivedDisagreementPreserved}
              onDisagreementPreserved={() => setDerivedDisagreementPreserved(true)}
              thresholdContextResolved={derivedThresholdResolved}
              onThresholdContextResolved={() => setDerivedThresholdResolved(true)}
            />
          </div>
        )
      case 'derived-transfer':
        return (
          <div className={styles.surfaceCard} data-surface="derived-transfer">
            <DerivedTransferComparison />
          </div>
        )
      case 'disagreement':
        return (
          <div className={styles.surfaceCard} data-surface="disagreement">
            <CardiacOutputDisagreementLab progressive />
          </div>
        )
      default:
        return null
    }
  })()

  const simulator = (
    <HemodynamicsSimulatorPane
      stepKey={activeStep.id}
      state={state}
      dispatch={dispatch}
      surface={activeStep.surface}
      anatomy={activeStep.anatomy}
      flushLine={activeStep.flushLine}
      controlsEnabled={controlsEnabled}
      pausedReason={pausedReason}
      chamberLabel={tipVisible ? 'shown' : 'withheld'}
      stops={stops}
      mapCaption={mapCaption}
      mapAnswer={mapAnswer}
      tipVisible={tipVisible}
      requireFreshObservation={lesson.sectionId === 'pressure-system'}
      recognitionRecord={recognitionRecord}
      onRecognitionRecord={setRecognitionRecord}
      referenceLabel={
        lesson.sectionId === 'why-measure'
          ? 'Separate reference patient · the text vignette is the question'
          : undefined
      }
      presentation={presentation}
      baseline={taskBaselines[activeStep.id]}
      onResetDemonstration={
        activeStep.entryState && interaction.kind === 'read' && !lookingBack
          ? () => load(activeStep.entryState!())
          : undefined
      }
    >
      {extraSurface ? (
        <fieldset className={flowStyles.surfaceFieldset} disabled={!controlsEnabled}>
          {extraSurface}
        </fieldset>
      ) : null}
    </HemodynamicsSimulatorPane>
  )

  const teaching = (
    <StageTeachingScope
      value={{
        phase: activeStep.phase,
        predictionCommitted: revealOpen,
        stepId: activeStep.id,
      }}
    >
      <HemodynamicsTeachingColumn
        lesson={lesson}
        step={activeStep}
        stops={walkStop ? [walkStop] : activeStep.stops}
        provenanceResolved={commitments.provenanceResolved}
        state={state}
        flow
      />
    </StageTeachingScope>
  )

  const completionLead =
    pairing.kind === 'mechanism-match'
      ? 'Apply it to the paired case in Practice, starting fresh, or continue to the next section.'
      : 'A case in this part of the pathway is ready in Practice whenever it is useful.'

  const task = (
    <>
      <div ref={nowFocusRef} tabIndex={-1} data-now-focus>
        <NowCard
          model={
            hold && nowModel.primary
              ? {
                  ...nowModel,
                  primary: {
                    ...nowModel.primary,
                    disabled: true,
                    disabledReason: `${hold.state} ${hold.recovery}`,
                  },
                }
              : nowModel
          }
        >
          <div className={flowStyles.taskContent} data-flow-reading={readingPart}>
            {readingPart ? (
              <FlowPrerequisite key={readingPart} part={readingPart} state={state} />
            ) : (
              <>
                {presentation.kind === 'case' && activeIndex === 0 ? (
                  <section className={flowStyles.caseBrief} aria-label="Patient brief">
                    <h3>Patient brief</h3>
                    <p>{hemodynamicCaseById.get('HD-08')!.presentation}</p>
                    <p>
                      Review the available pressure signals and acquisition records before selecting
                      a measurement or intervention. Values are simulated; unmeasured physiology is
                      not an observed finding.
                    </p>
                  </section>
                ) : null}
                {teaching}
                {simulator}
                {questionFigure}
                {nowBody}
              </>
            )}
          </div>
        </NowCard>
      </div>
      {activeIndex === 0 ? (
        <p className={styles.dockNote}>
          Reload or Restart section returns to the first step. The sections you opened or marked
          reviewed stay on this device; answers, actions and the live patient are not saved.
        </p>
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
        <summary>Tasks in this section · open any task</summary>
        <ol data-step-list>
          {lesson.steps.map((step, index) => {
            const rowState =
              index === activeIndex
                ? 'current'
                : performedIds.has(step.id)
                  ? 'done'
                  : stepAnswered(step, commitments)
                    ? 'answered'
                    : index <= commitments.confirmed
                      ? 'passed'
                      : 'upcoming'
            const suffix =
              rowState === 'done'
                ? ' · done'
                : rowState === 'answered'
                  ? ' · answered'
                  : rowState === 'passed'
                    ? ' · moved on'
                    : ''
            return (
              <li key={step.id} data-step-state={rowState}>
                <button
                  type="button"
                  aria-current={index === activeIndex ? 'step' : undefined}
                  disabled={held || index === activeIndex}
                  onClick={() => {
                    if (index < liveIndex) setViewIndex(index)
                    else if (index === liveIndex) returnToLive()
                    else moveTo(index)
                  }}
                >
                  {step.ordinal}. {step.title}
                  {suffix}
                </button>
              </li>
            )
          })}
        </ol>
      </details>
      {finished ? (
        <section
          className={stageStyles.completion}
          role="status"
          aria-live="polite"
          data-stage-completion
        >
          <h3>Section finished</h3>
          <p>{completionLead}</p>
          <p data-reviewed-state={reviewed ? 'reviewed' : 'not-reviewed'}>
            {reviewed
              ? 'Marked reviewed on this device. Nothing about your answers is saved.'
              : 'Not marked reviewed.'}{' '}
            <button
              type="button"
              className={shellStyles.nowSecondary}
              data-reviewed-toggle
              onClick={() =>
                updateSelfPacedRecord((current) =>
                  withSectionReviewed(current, lesson.sectionId, !reviewed),
                )
              }
            >
              {reviewed ? 'Undo: not reviewed yet' : 'Mark as reviewed'}
            </button>
          </p>
          {pairing.kind === 'next-in-unit' ? (
            <p data-practice-pairing-note>It applies a different mechanism from this section.</p>
          ) : null}
          <div className={stageStyles.completionActions}>
            <button
              type="button"
              className={shellStyles.nowPrimary}
              data-practice-pairing={pairing.kind}
              disabled={held}
              onClick={() =>
                router.push({
                  pathname: `${icuHemodynamicsNavBase}/practice`,
                  query: {
                    case: pairing.caseId,
                    ...(nextSection ? { nextLearn: nextSection.id } : {}),
                  },
                })
              }
            >
              {pairing.kind === 'mechanism-match'
                ? `Apply this in Practice: ${pairing.title}`
                : `A case in this part of the pathway: ${pairing.title}`}
              <ArrowRight aria-hidden="true" />
            </button>
            {nextSection ? (
              <button
                type="button"
                className={shellStyles.nowSecondary}
                onClick={() => goToSection(nextSection.id)}
              >
                Continue to the next section: {nextSection.title}
              </button>
            ) : (
              <button
                type="button"
                className={shellStyles.nowSecondary}
                onClick={() => router.push(`${icuHemodynamicsNavBase}/assess`)}
              >
                Open the applied case
              </button>
            )}
          </div>
        </section>
      ) : null}
    </>
  )

  const header = (
    <SectionHeader
      breadcrumb={held ? undefined : { href: icuHemodynamicsNavBase, label: 'ICU Hemodynamics' }}
      kicker={`Section ${lesson.index + 1} of ${lesson.total} · ${lesson.minutes} min`}
      title={lesson.title}
      sectionsControl={
        <SectionsDrawer
          pathway={hemodynamicsPathway}
          activeSectionId={sectionId}
          position={`${lesson.index + 1} of ${lesson.total}`}
          label="ICU hemodynamics pathway"
          onSelect={goToSection}
        />
      }
      helpRef={helpButtonRef}
      onHelp={() => setHelpOpen(true)}
      onRestart={onRestart}
      restartLabel={held ? 'Abandon this simulation and restart the section' : 'Restart section'}
      saveAndExitHref={held ? undefined : icuHemodynamicsNavBase}
    />
  )

  const helpDialog = (
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
      {showWhereAction ? (
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
    <IcuHemodynamicsModuleFrameV2
      locale={locale}
      activeHref={`${icuHemodynamicsNavBase}/learn`}
      activityMode
      documentFlow
    >
      <HemodynamicsTaskDrafts taskId={activeStep.id}>
        <StageSourcesScope>
          <div
            className={`${shellStyles.shell} ${flowStyles.flow}`}
            data-lesson-shell
            data-stage={activeStep.id}
            data-presentation={presentation.kind}
            aria-label="Guided ICU hemodynamics section"
          >
            <header className={shellStyles.header}>{header}</header>
            {hold ? (
              <aside className={flowStyles.safety} role="status" data-catheter-hold={hold.reason}>
                <p data-catheter-hold-state>
                  <strong>{hold.state}</strong>{' '}
                  <span>
                    Moving on, changing section and Save &amp; exit wait for it, because none of
                    them would end it. Restarting the section is offered as an abandon instead.
                  </span>
                </p>
                <p data-catheter-hold-recovery>{hold.recovery}</p>
                <div className={stageStyles.completionActions}>
                  {hold.controlKey ? (
                    <button
                      type="button"
                      className={shellStyles.nowSecondary}
                      data-catheter-hold-locate
                      onClick={() =>
                        setSpotlight((current) => ({
                          stepId: activeStep.id,
                          key: hold.controlKey!,
                          count: current?.stepId === activeStep.id ? current.count + 1 : 1,
                        }))
                      }
                    >
                      <LocateFixed aria-hidden="true" /> Show me that control
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={shellStyles.nowSecondary}
                    data-catheter-hold-abandon
                    onClick={onRestart}
                  >
                    Abandon this simulation and restart the section
                  </button>
                </div>
                <p data-catheter-hold-abandon-note>
                  Abandoning resets this section&apos;s simulated patient and clears what you
                  answered here. It is not a float, a confirmed artery, a deflation you performed or
                  a completed skill, and it records none of those. The sections you have opened or
                  marked reviewed are untouched.
                </p>
              </aside>
            ) : null}
            <div className={flowStyles.activity}>{task}</div>
            <footer className={flowStyles.references}>
              <p>
                Professional education only. All values are simulated. Follow current manufacturer
                instructions and local protocol.
              </p>
              <StageSourcesFooter
                count={stageSources.evidenceIds.length}
                label="Sources for this section"
                claimsVisible={revealOpen}
              >
                <HemodynamicsSourceList records={stageSources.records} claimsVisible={revealOpen} />
              </StageSourcesFooter>
            </footer>
            {helpDialog}
          </div>
        </StageSourcesScope>
      </HemodynamicsTaskDrafts>
    </IcuHemodynamicsModuleFrameV2>
  )
}

/* ------------------------------------------------------------------ *
 * Pieces
 * ------------------------------------------------------------------ */

/**
 * The last step of a wedge: say, yourself, whether the artery came back.
 *
 * Before HD-PRE-REVIEW-01 this offered one button, "The artery is back", enabled from the moment
 * the tip was in a confirmed artery — which is before any balloon has gone up. The step the module
 * calls the one that gets skipped was therefore a click-through, and a click taken in an earlier
 * task satisfied a later wedge (report L6-05, Figure 32).
 *
 * Three things changed and nothing else. The control belongs to the occlusion that has just been
 * released, so it says so until there is one. Both answers are offered, because "it has not come
 * back" is the answer the sequence exists to be able to give. And an answer is checked against what
 * the simulation is actually showing rather than accepted as proof: only an observation the current
 * tracing supports records the check, a mistaken reading gets the reason and another look, and the
 * persistent-occlusion branch shows the authored response for that outcome — which stops, does not
 * flush or manipulate, and escalates. No complication is injected, no attempt is counted, and the
 * outcomes and the recovery question below stay readable whatever is answered.
 */
function ReturnCheck({
  state,
  onObserved,
}: {
  readonly state: HemodynamicSimulationState
  readonly onObserved: (episode: string) => void
}) {
  const [answer, setAnswer] = useState<'returned' | 'not-returned' | null>(null)
  const episode = paReturnEpisodeKey(state)
  const returned = paWaveformReturned(state)
  const confirmed =
    episode !== null && state.signalValidationChecks.includes(`${PA_RETURN_CHECK}:${episode}`)
  const persistent = pawpRecoveryOutcomes.find((outcome) => !outcome.paWaveformReturned)!

  function answered(choice: 'returned' | 'not-returned') {
    setAnswer(choice)
    if (episode !== null && choice === 'returned' && returned) onObserved(episode)
  }

  return (
    <div className={styles.returnCheck} data-return-check data-return-episode={episode ?? 'none'}>
      <p>
        <strong>Has the pulmonary-artery tracing come back?</strong> Look at the monitor: the notch,
        the diastolic run-off, the pulsatility.
      </p>
      {episode === null ? (
        <p className={styles.dockNote} data-return-unavailable>
          {state.catheter.balloonInflated
            ? 'The balloon is still up. This question is about the tracing after it comes down.'
            : 'Nothing to answer yet: this question is about the tracing after an occlusion in this task has been released.'}
        </p>
      ) : (
        <div className={stageStyles.completionActions}>
          <button
            type="button"
            className={shellStyles.nowSecondary}
            data-return-answer="returned"
            aria-pressed={answer === 'returned'}
            onClick={() => answered('returned')}
          >
            {confirmed ? 'The artery is back — recorded' : 'The artery is back'}
          </button>
          <button
            type="button"
            className={shellStyles.nowSecondary}
            data-return-answer="not-returned"
            aria-pressed={answer === 'not-returned'}
            onClick={() => answered('not-returned')}
          >
            It has not come back
          </button>
        </div>
      )}
      {answer !== null && episode !== null ? (
        <p
          role="status"
          data-return-response={returned === (answer === 'returned') ? 'agrees' : 'differs'}
        >
          {answer === 'returned'
            ? returned
              ? 'Recorded for this occlusion: pulsatility and the notch are back on the monitor, and the occlusion has ended at the vessel.'
              : `Not recorded — the tracing does not support that yet. ${whyNotReturned(state)} Look again, and answer when the monitor agrees with you.`
            : returned
              ? 'Look again: the tracing on the monitor has its systolic pulse, its diastolic run-off and its dicrotic notch back, which is the artery returning. Nothing is recorded either way.'
              : `${persistent.whatItMeans} ${persistent.requiredResponse}`}
        </p>
      ) : null}
    </div>
  )
}

/** Why the current tracing is not yet the artery returning, in the simulation's own terms. */
function whyNotReturned(state: HemodynamicSimulationState): string {
  const catheter = state.catheter
  if (catheter.balloonInflated) return 'The balloon is still inflated.'
  if (catheter.forcedSafetyRecovery)
    return 'This simulation released the balloon itself at its own cutoff, so the release was not yours and the recovery is still to be established.'
  if (catheter.targetPosition !== null) return 'The tip is still moving.'
  if (catheter.position !== 'pa')
    return `The tip is not in the pulmonary artery; it is at ${positionWords(catheter.position)}.`
  return 'The simulation does not show the artery back.'
}

/**
 * Which Fick result was measured: an optional question with its reasoning available before any
 * answer. Checking an answer or opening the reasoning opens the method model beside it; neither
 * requires the best-supported reading, and nothing is kept once the step changes.
 */
function ProvenanceQuestion({ onResolved }: { readonly onResolved: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [checked, setChecked] = useState<string | null>(null)
  const [shown, setShown] = useState(false)
  const choice = CARDIAC_OUTPUT_PROVENANCE_CHOICES.find((candidate) => candidate.id === checked)
  const best = CARDIAC_OUTPUT_PROVENANCE_CHOICES.find((candidate) => candidate.isDefensible)!
  return (
    <section
      className={styles.commitment}
      data-commitment="provenance"
      aria-label="Which result was measured?"
    >
      <p className={styles.kicker}>Which result was measured?</p>
      <fieldset
        className={stageStyles.choiceList}
        data-prediction-choices
        disabled={checked !== null}
      >
        <legend>
          Two Fick results are on record for the same patient in the same hour. One had oxygen
          uptake measured by expired-gas analysis over the sampling interval; the other used a
          substituted figure. Which statement describes them?
        </legend>
        {orderChoices('hd-provenance', CARDIAC_OUTPUT_PROVENANCE_CHOICES).map((candidate) => (
          <label
            key={candidate.id}
            className={stageStyles.choice}
            data-selected={selected === candidate.id}
          >
            <input
              type="radio"
              name="hd-provenance"
              value={candidate.id}
              checked={(checked ?? selected) === candidate.id}
              onChange={() => setSelected(candidate.id)}
            />
            <span>{candidate.label}</span>
          </label>
        ))}
      </fieldset>
      {choice ? (
        <p
          className={stageStyles.taskInstruction}
          data-provenance-outcome={choice.isDefensible ? 'correct' : 'not-correct'}
          role="status"
        >
          <strong>{choice.isDefensible ? 'Correct.' : 'Not correct.'}</strong> {choice.why}
          {choice.isDefensible ? '' : ` ${best.why}`}
        </p>
      ) : shown ? (
        <p className={stageStyles.taskInstruction} data-provenance-outcome="shown" role="status">
          <strong>Shown without an answer.</strong> {best.label} {best.why}
        </p>
      ) : null}
      <div className={stageStyles.completionActions} data-question-actions>
        {checked ? (
          <button
            type="button"
            className={shellStyles.nowSecondary}
            data-question-try-again
            onClick={() => {
              setChecked(null)
              setSelected(null)
            }}
          >
            Try again
          </button>
        ) : (
          <>
            <button
              type="button"
              className={shellStyles.nowSecondary}
              data-question-check
              disabled={!selected}
              onClick={() => {
                if (!selected) return
                setChecked(selected)
                onResolved()
              }}
            >
              Check this reading
            </button>
            <button
              type="button"
              className={shellStyles.nowSecondary}
              data-question-explanation-toggle
              aria-expanded={shown}
              onClick={() => {
                setShown((current) => !current)
                onResolved()
              }}
            >
              {shown ? 'Hide the reasoning' : 'Show the reasoning'}
            </button>
          </>
        )}
      </div>
    </section>
  )
}

/**
 * The ventricle and the artery, side by side: the same peak, a floor that steps up, and a notch
 * that appears — read from the engine, which models no systolic gradient across the pulmonic
 * valve unless there is one.
 */
function VentricleArtery({ state }: { readonly state: HemodynamicSimulationState }) {
  const m = state.measurements
  const rows: readonly { readonly label: string; readonly rv: string; readonly pa: string }[] = [
    { label: 'Systolic peak (mmHg)', rv: String(m.rvSystolicMmHg), pa: String(m.papSystolicMmHg) },
    {
      label: 'Diastolic floor (mmHg)',
      rv: String(m.rvDiastolicMmHg),
      pa: String(m.papDiastolicMmHg),
    },
    { label: 'Notch on the way down', rv: 'none', pa: 'present' },
    { label: 'Diastole', rv: 'dips low, then climbs', pa: 'runs off, never to the floor' },
  ]
  return (
    <table className={stageStyles.compareTable} data-ventricle-artery>
      <caption className={shellStyles.kicker}>The ventricle and the artery, side by side</caption>
      <thead>
        <tr>
          <th scope="col">Reading</th>
          <th scope="col">Right ventricle</th>
          <th scope="col">Pulmonary artery</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>{row.rv}</td>
            <td data-direction={row.rv === row.pa ? 'same' : 'changed'}>{row.pa}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function BeforeAfter({
  before,
  after,
  watch,
}: {
  readonly before: HemodynamicSimulationState
  readonly after: HemodynamicSimulationState
  readonly watch: readonly StageWatch[]
}) {
  return (
    <table className={stageStyles.compareTable} data-before-after>
      <caption className={shellStyles.kicker}>What actually changed</caption>
      <thead>
        <tr>
          <th scope="col">Reading</th>
          <th scope="col">Before</th>
          <th scope="col">After</th>
        </tr>
      </thead>
      <tbody>
        {watch.map((key) => {
          const meta = stageWatchLabels[key]
          const b = stageWatchValue(key, before)
          const a = stageWatchValue(key, after)
          const numeric = typeof a === 'number' && typeof b === 'number'
          const direction = numeric
            ? Math.abs(a - b) < 0.5 * 10 ** -meta.digits
              ? 'same'
              : a > b
                ? 'up'
                : 'down'
            : a === b
              ? 'same'
              : 'changed'
          const format = (value: number | string | null) =>
            value === null ? '—' : typeof value === 'number' ? value.toFixed(meta.digits) : value
          return (
            <tr key={key}>
              <th scope="row">
                {meta.label}
                {meta.unit ? ` (${meta.unit})` : ''}
              </th>
              <td>{format(b)}</td>
              <td data-direction={direction}>{format(a)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/**
 * What an earlier step holds, said honestly: the actions only if the learner performed them, and a
 * plain line when they moved on without doing so. A check mark is never drawn for work not done.
 */
function recapLines(
  step: HemodynamicsStageStep,
  commitments: StageCommitments,
  performed: boolean,
  state: HemodynamicSimulationState,
): readonly { readonly text: string; readonly met: boolean }[] {
  switch (step.interaction.kind) {
    case 'walk':
      return performed
        ? step.interaction.stops.map((stopId) => ({ text: routeStop(stopId).title, met: true }))
        : [{ text: 'Moved on without finishing the walk.', met: false }]
    case 'sort':
      return commitments.sort
        ? [{ text: `${Object.keys(commitments.sort).length} questions placed.`, met: true }]
        : [{ text: 'Not sorted.', met: false }]
    case 'simulator-task':
    case 'observe':
      return performed
        ? step.interaction.goals.map((goal) => ({ text: stageGoalLabel(goal), met: true }))
        : [
            {
              text: 'Moved on without doing these actions. Nothing was recorded for them.',
              met: false,
            },
          ]
    case 'explain':
      return [{ text: `The tip: ${positionWords(state.catheter.position)}.`, met: false }]
    default:
      return (step.expectedResponse ?? []).map((text) => ({ text, met: false }))
  }
}

function StepRecap({
  step,
  commitments,
  performed,
  state,
}: {
  readonly step: HemodynamicsStageStep
  readonly commitments: StageCommitments
  readonly performed: boolean
  readonly state: HemodynamicSimulationState
}) {
  const lines = recapLines(step, commitments, performed, state)
  if (lines.length === 0) return null
  return (
    <ul className={stageStyles.taskList} data-step-review>
      {lines.map((line) => (
        <li key={line.text} data-met={line.met}>
          {line.met ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
          <span>{line.text}</span>
        </li>
      ))}
    </ul>
  )
}
