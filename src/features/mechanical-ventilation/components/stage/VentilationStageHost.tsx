'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, Circle, LocateFixed, SlidersHorizontal } from 'lucide-react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { useCriticalCareActivityAnalytics } from '@/features/learning-module/activity'
import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { nextPathwaySection } from '@/features/learning-module/curriculum/types'
import { mechanicalVentilationNavBase } from '@/features/learning-module/moduleRoutes'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import { ContextStrip, type ContextStripItem } from '@/features/learning-module/stage/ContextStrip'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { LookInLine } from '@/features/learning-module/stage/LookInLine'
import { NowCard, type NowCardModel } from '@/features/learning-module/stage/NowCard'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { SectionsDrawer } from '@/features/learning-module/stage/SectionsDrawer'
import { StageLayout, type StagePaneCaptions } from '@/features/learning-module/stage/StageLayout'
import { LessonShell } from '@/features/learning-module/stage/LessonShell'
import {
  STAGE_PHASE_LABELS,
  compactPaneForLocation,
  type StagePaneId,
} from '@/features/learning-module/stage/stageModel'
import { StageSourcesFooter } from '@/features/learning-module/stage/StageSourcesFooter'
import { StageSourcesScope } from '@/features/learning-module/stage/StageSourcesScope'
import { StageTeachingScope } from '@/features/learning-module/stage/StageTeachingScope'
import { StepList } from '@/features/learning-module/stage/StepList'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'
import { useRouter } from '@/i18n/navigation'

import {
  BREATH_STOP_CHECKLIST_LABEL,
  breathStop,
  breathStopIds,
  type BreathStopId,
} from '../../content/breathSpine'
import { getVentilatorDeviceProfile } from '../../content/deviceProfiles'
import { ventilationExperimentByUnit, type LabGoal } from '../../content/learningExperiments'
import { isFoundationUnit } from '../../content/foundations'
import { observationFor } from '../../engine/learningObservation'
import {
  completedBreath,
  breathStopIndex,
  waveformAxes,
  inspectionWindow,
} from '../../engine/teachingBreath'
import { CapturedBreath } from './CapturedBreath'
import { ventilationPracticePairing } from '../../content/sectionSpecs'
import { ventilationChoiceIndex } from '../../content/stageItems'
import {
  roundManeuver,
  ventilationStageLesson,
  type VentilationStageStep,
} from '../../content/stageLessons'
import { ventilationStageSources } from '../../content/stageSources'
import {
  labGoalMet,
  labMetricLabels,
  labReadyToCompare,
  type LabCheckpoint,
  type LabEvidence,
  type LabSession,
} from '../../engine/learningLab'
import type { VentilatorDeviceId } from '../../engine/types'
import { breathMapCaption, type BreathMapAnswer } from '../breath-map/BreathMap'
import { MechanicalVentilationModuleFrame } from '../MechanicalVentilationModuleFrame'
import { useVentilationLabProgress } from '../useVentilationLabProgress'
import { deriveStageProgress } from './stageProgress'
import {
  useVentilationLabSession,
  readDevicePreference,
  saveDevicePreference,
} from './useVentilationLabSession'
import { VentilationSimulatorPane, goalLabel, quickControlId } from './VentilationSimulatorPane'
import { VentilationSourceList } from './VentilationSourceList'
import { VentilationTeachingColumn } from './VentilationTeachingColumn'
import styles from './ventilation-stage.module.css'
import taskStyles from './task-flow.module.css'
import { VentilationTaskWorkspace } from './VentilationTaskWorkspace'
import { VentilationTaskWorkbench } from './VentilationTaskWorkbench'
import { VentilationPrerequisite } from './VentilationPrerequisite'
import { VentilationResponseTimeline } from './VentilationResponseTimeline'
import { RecordedBreathComparison } from './RecordedBreathComparison'

const CHOICE_IDS = ['a', 'b', 'c'] as const

/*
 * Steps, Teaching, Simulator — left to right — each pane captioned with its name and what it is
 * for, and the ventilator kept the widest of the three.
 *
 * A learner review of the ECMO module in September 2026 asked for the prompts and questions on the
 * left "for a more natural read", and reported guessing which of three unnamed panes each
 * instruction meant. ECMO took the swap, then hemodynamics, then mechanical circulatory support;
 * this module was the last of the four adopters still leading with its device, and four sibling
 * modules should not disagree about the first thing a learner sees. The console facsimile is never
 * scaled, so the fractions keep the simulator the widest pane whatever end of the row it sits at,
 * and the drag floors follow the content across the slots rather than staying with the slot
 * numbers. Every value here is the one the other three pass, byte for byte.
 *
 * This amends `mv-d2-standard-laptop-workspace.md` §2 and §7, whose recorded order — live
 * ventilator, teaching, learner action — had had no guard since PR #127 deleted the test §7 named
 * for it. See MVLR-OD-1 in the module's learner-review record.
 */
const PANE_ORDER = ['steps', 'teaching', 'simulator'] as const
const PANE_CAPTIONS: StagePaneCaptions = {
  simulator: 'the live ventilator, the quick controls and the breath map',
  teaching: 'what to read',
  steps: 'what to do',
}
const PANE_WIDTH_FRACTIONS = { primary: 0.26, secondary: 0.29 } as const
const PANE_MINIMUMS = { primary: 300, secondary: 280, tertiary: 340 } as const

/*
 * The verdict card's titles and explanation heading were written for signal reads — "That read
 * holds", "How to distinguish it". This module's rounds ask for a prediction of what a change will
 * do, and its Explain instruction promises "the explanation"; the card says both in those words.
 * The three location items are reads, and keep the card's own.
 */
const PREDICTION_VERDICT_FRAMES = {
  best: 'That prediction holds',
  'incorrect-mechanism': 'That mechanism predicts a different response',
} as const
const PREDICTION_EXPLANATION_HEADING = 'The explanation'

function InspectedBreath({ evidence }: { evidence: LabEvidence }) {
  if (!evidence.inspection) return null
  const samples = inspectionWindow(
    evidence.inspection.waveforms ?? [
      ...(evidence.baseline?.waveforms ?? []),
      ...(evidence.response?.waveforms ?? []),
    ],
    evidence.inspection,
  )
  return (
    <CapturedBreath
      label="Your captured interval for interpretation"
      samples={samples}
      whole={false}
      fixedIndex={samples.length - 1}
    />
  )
}

/**
 * One section of the ventilation pathway on the lesson stage.
 *
 * The lab session (`engine/learningLab.ts`) is the authority on where the learner is: its round,
 * phase, goals and commitments decide the live step, and a reload reconstructs the same patient,
 * paused, on the same step. What this host owns is the view around it — the step the learner is
 * looking at when it is not the live one (a verdict they have not yet moved on from, or an earlier
 * step they went back to), the choices not yet committed, the walk's current stop, which quick
 * control is spotlighted, whether help is open — and the Now card that makes every step one thing.
 */
export function VentilationStageHost({
  unitId,
  locale = 'en',
  renderer = 'task',
}: {
  readonly unitId: string
  readonly locale?: string
  /** Local rollback for review; both renderers use the same session and curriculum. */
  readonly renderer?: 'task' | 'legacy'
}) {
  const lab = useVentilationLabProgress()
  if (!lab.ready) {
    return (
      <MechanicalVentilationModuleFrame
        locale={locale}
        activeHref={`${mechanicalVentilationNavBase}/learn`}
        activityMode
      >
        <p className={shellStyles.meta} style={{ padding: '1rem' }} role="status">
          Restoring your place in this section…
        </p>
      </MechanicalVentilationModuleFrame>
    )
  }
  return (
    <VentilationStageSession
      key={unitId}
      unitId={unitId}
      locale={locale}
      saved={lab.progress.units[unitId]}
      save={lab.save}
      storageAvailable={lab.storageAvailable}
      taskFlow={renderer === 'task'}
    />
  )
}

function VentilationStageSession({
  unitId,
  locale,
  saved,
  save,
  storageAvailable,
  taskFlow,
}: {
  readonly unitId: string
  readonly locale: string
  readonly saved?: LabCheckpoint
  readonly save: (record: LabCheckpoint) => void
  readonly storageAvailable: boolean
  readonly taskFlow: boolean
}) {
  const router = useRouter()
  const lesson = useMemo(() => ventilationStageLesson(unitId), [unitId])
  const experiment = ventilationExperimentByUnit.get(unitId)!
  const foundation = isFoundationUnit(unitId)
  const [device] = useState<VentilatorDeviceId>(() => saved?.device ?? readDevicePreference())
  const { session, engine, lab } = useVentilationLabSession({ unitId, device, saved, save })
  const pathway = criticalCareLearningPathway('mechanical-ventilation')
  const nextSection = nextPathwaySection(pathway, unitId)

  /* ---------------------------------------------------------------- *
   * View state
   * ---------------------------------------------------------------- */
  const [walkStopIndex, setWalkStopIndex] = useState(0)
  const [walkDone, setWalkDone] = useState(false)
  const [exampleSeen, setExampleSeen] = useState(false)
  const [pendingChoice, setPendingChoice] = useState<Record<string, string>>({})
  const [observationDraft, setObservationDraft] = useState<Record<string, string>>({})
  const [sortDraft, setSortDraft] = useState<Record<string, 'set' | 'reported'>>({})
  const [review, setReview] = useState<number | null>(null)
  const [viewIndex, setViewIndex] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [spotlight, setSpotlight] = useState<{ stepId: string; key: string; count: number } | null>(
    null,
  )
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const nowFocusRef = useRef<HTMLDivElement>(null)

  const [readConfirmed, setReadConfirmed] = useState(() =>
    saved ? saved.phase !== 'explore' || saved.round > 0 : false,
  )
  const progress = deriveStageProgress(lesson, session, { walkComplete: walkDone, readConfirmed })
  /*
   * The learner sees step k only after continuing from k−1. Committing a prediction moves the lab
   * on, but the verdict has to be read before the next step replaces it; meeting a step's goals
   * marks it done, but the learner presses Continue. `confirmed` is the highest step the learner
   * has explicitly moved past; on mount it is everything before the live step, so a reload lands
   * on the live step and not at the beginning.
   */
  const [confirmed, setConfirmed] = useState(() => progress.liveIndex - 1)
  const liveIndex = progress.liveIndex
  const heldIndex = Math.min(liveIndex, confirmed + 1)
  const activeIndex = Math.max(0, Math.min(viewIndex ?? heldIndex, lesson.steps.length - 1))
  const activeStep = lesson.steps[activeIndex]
  const lookingBack = viewIndex !== null && viewIndex < heldIndex
  const isLastStep = activeIndex === lesson.steps.length - 1
  const stepPerformed = progress.performedIds.has(activeStep.id)
  const performedIds = progress.performedIds
  /*
   * What the step list may call done: everything before the step the learner is on, plus that step
   * when its own work is finished. The lab can be further ahead — a pause round's observation is
   * complete the instant its act is — but a row the learner has not reached is not done to them.
   */
  const shownPerformedIds = useMemo(
    () =>
      new Set(
        lesson.steps
          .filter(
            (step, index) =>
              index < heldIndex || (index === heldIndex && performedIds.has(step.id)),
          )
          .map((step) => step.id),
      ),
    [heldIndex, lesson.steps, performedIds],
  )
  const predictionCommitted = progress.predictionCommitted
  const finished = progress.finished
  const evidence: LabEvidence = session.evidence[session.round]
  const roundOf = (step: VentilationStageStep): 0 | 1 =>
    'round' in step.interaction ? step.interaction.round : 0
  const evidenceFor = (step: VentilationStageStep): LabEvidence => session.evidence[roundOf(step)]

  const analytics = useCriticalCareActivityAnalytics({
    moduleId: 'mechanical-ventilation',
    activityId: lesson.lifecycleActivityId,
    mode: 'guided',
    phase: activeStep.phase,
  })

  useEffect(() => {
    nowFocusRef.current?.focus({ preventScroll: true })
  }, [activeStep.id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('phase', activeStep.phase)
    window.history.replaceState(window.history.state, '', url)
  }, [activeStep.phase])

  const completionRecorded = useRef(false)
  useEffect(() => {
    if (!finished || completionRecorded.current) return
    completionRecorded.current = true
    analytics.recordActivityCompleted()
  }, [analytics, finished])

  /* ---------------------------------------------------------------- *
   * Progression
   * ---------------------------------------------------------------- */
  function confirmThrough(index: number) {
    setConfirmed((current) => Math.max(current, index))
    setViewIndex(null)
    setReview(null)
    setSpotlight(null)
  }

  const now = () => new Date().toISOString()

  function continueFromRecognize() {
    setReadConfirmed(true)
    if (session.phase === 'explore' && session.round === 0) lab({ type: 'PREDICT' })
    confirmThrough(activeIndex)
  }

  function commitPrediction(step: VentilationStageStep) {
    if (step.interaction.kind !== 'prediction') return
    const choiceId = pendingChoice[step.id]
    if (!choiceId) return
    lab({ type: 'COMMIT', choice: ventilationChoiceIndex(choiceId), confidence: 'unsure' })
    analytics.recordPredictionSubmitted()
    setViewIndex(null)
  }

  function commitLocation(step: VentilationStageStep) {
    if (step.interaction.kind !== 'locate') return
    const choiceId = pendingChoice[step.id]
    if (!choiceId) return
    lab({ type: 'LOCATE', choiceId })
    analytics.recordPredictionSubmitted()
  }

  function commitSort(step: VentilationStageStep) {
    if (step.interaction.kind !== 'sort') return
    const rows = step.interaction.sort.rows
    if (rows.some((row) => !sortDraft[row.id])) return
    lab({ type: 'SORT', answers: sortDraft })
  }

  function commitObservation() {
    const choice = observationDraft[activeStep.id]
    if (choice) lab({ type: 'INTERPRET', choice, now: now() })
  }

  function compare() {
    if (!labReadyToCompare(session)) return
    lab({ type: 'COMPARE' })
    analytics.recordGoalMet()
    confirmThrough(activeIndex)
  }

  function continueFromExplain(step: VentilationStageStep) {
    if (step.interaction.kind !== 'explain') return
    analytics.recordDebriefViewed()
    lab({ type: 'CONTINUE', now: now() })
    if (step.interaction.round === 0 && !lesson.steps.some((s) => s.interaction.kind === 'sort')) {
      // The transfer's prediction follows at once; its baseline is rebuilt as the step opens.
      lab({ type: 'PREDICT' })
    }
    if (step.interaction.round === 1) analytics.recordTransferCompleted()
    confirmThrough(activeIndex)
  }

  function continueFromSort() {
    lab({ type: 'PREDICT' })
    confirmThrough(activeIndex)
  }

  function goBack() {
    const target = activeIndex - 1
    if (target < 0 || !performedIds.has(lesson.steps[target].id)) return
    setViewIndex(target)
    setReview(null)
  }

  function returnToLive() {
    setViewIndex(null)
  }

  function selectStepRow(index: number) {
    if (index === activeIndex) return
    if (!performedIds.has(lesson.steps[index].id)) return
    setReview((current) => (current === index ? null : index))
  }

  function goToSection(sectionId: string) {
    if (sectionId === unitId) return
    router.push({
      pathname: `${mechanicalVentilationNavBase}/learn`,
      query: { activity: sectionId },
    })
  }

  /** Back to nothing: a fresh patient, no commitments, and the view state cleared with it. */
  function resetViewState() {
    setConfirmed(-1)
    setViewIndex(null)
    setReview(null)
    setWalkStopIndex(0)
    setWalkDone(false)
    setExampleSeen(false)
    setReadConfirmed(false)
    setPendingChoice({})
    setSortDraft({})
    setObservationDraft({})
    setSpotlight(null)
    completionRecorded.current = false
  }

  function restartSection() {
    lab({ type: 'RESTART' })
    resetViewState()
  }

  function selectDevice(next: VentilatorDeviceId) {
    saveDevicePreference(next)
    lab({ type: 'DEVICE', device: next })
    resetViewState()
  }

  /* ---------------------------------------------------------------- *
   * The current step's shape
   * ---------------------------------------------------------------- */
  const interaction = activeStep.interaction
  const showingPrerequisite =
    taskFlow &&
    !foundation &&
    activeStep.phase === 'recognize' &&
    (interaction.kind !== 'locate' || !exampleSeen)
  const protectPriorPatient =
    taskFlow &&
    unitId === 'high-peak-pressure-integration' &&
    session.round === 1 &&
    evidence.prediction === undefined
  const goals: readonly LabGoal[] =
    interaction.kind === 'simulator-task'
      ? interaction.goals
      : interaction.kind === 'observe'
        ? experiment.rounds[interaction.round].goals
        : []
  const goalsMet = goals.map((goal) => labGoalMet(goal, session))
  const round = experiment.rounds[session.round]
  const waited =
    session.readySince === null
      ? 0
      : Math.max(0, session.simulation.simulationTime - session.readySince)
  const ready = labReadyToCompare(session)
  const activeRound = 'round' in interaction ? experiment.rounds[interaction.round] : null
  const activeManeuver = activeRound ? roundManeuver(activeRound) : null
  const waitingStatus =
    activeManeuver === 'pause'
      ? 'Pause during the requested phase, or use the captured time cursor and Use this captured interval below. No timed click is required.'
      : activeManeuver === 'hold'
        ? 'Waiting for the hold. Use the measurement maneuver; it happens at the next breath boundary.'
        : 'Waiting for the change on the ventilator. This step is done once the patient is receiving it.'
  // The readings shown under the console: a change's before-and-after set; nothing for a pause.
  const watch =
    activeStep.guide?.watch ??
    (interaction.kind === 'explain' && activeManeuver !== 'pause'
      ? experiment.rounds[interaction.round].watch
      : [])
  /*
   * Whether the console and the quick controls can be operated, and the line on the simulator that
   * says why not. Both notes derive from the same two predicates that disable them, so the
   * simulator cannot go dead without saying so; the transport toolbar stays live in both states
   * and neither note claims otherwise. The note used to cover the locked prediction and not the
   * look-back, so Back met greyed controls and a caption reading "Commit your prediction first".
   */
  const deciding = session.phase === 'predict'
  const controlsEnabled = !deciding
  const lockedReason = deciding
    ? 'The settings are locked while you decide. Commit your prediction to take the controls.'
    : undefined
  const pausedReason =
    !deciding && lookingBack
      ? 'The console and the quick controls are paused while you look back at an earlier step. Return to the live step to take them.'
      : undefined
  const controlsNote = deciding
    ? 'Commit your prediction first.'
    : lookingBack
      ? 'Paused while you look back.'
      : goals.some((g) => g.type === 'mechanics')
        ? 'Simulated patient properties; keep ventilator settings fixed.'
        : 'Educational shortcuts to supported ventilator settings.'
  /*
   * Reset patient rebuilds this round's patient and clears the change, the hold, the intervention
   * and the timed observation the lab has recorded — the prediction stays. It is a control, so it
   * is paused with the others; and while a prediction is being decided it would only send the
   * learner back a step, so it waits.
   */
  const resetWouldErase = session.events.length > 0 || session.observedHolds.length > 0
  const resetDisabledReason = deciding
    ? 'Nothing to reset while you decide. Commit your prediction first.'
    : lookingBack
      ? 'Return to the live step to reset the patient.'
      : undefined
  const mechanicsVisible =
    unitId !== 'high-peak-pressure-integration' ||
    session.phase === 'compare' ||
    session.phase === 'complete'

  const walkStop: BreathStopId | null =
    interaction.kind === 'walk' && !walkDone ? (interaction.stops[walkStopIndex] ?? null) : null
  const locationCommitted = interaction.kind === 'locate' && evidence.location !== undefined
  /*
   * While a section is asking where on the breath the problem lives, the map lights nothing: the
   * section's own stops are the candidates, and marking them would hand over the answer. Once the
   * answer is committed the map lights the keyed stop, which is the verdict drawn.
   */
  const mapStops: readonly BreathStopId[] = walkStop
    ? [walkStop]
    : interaction.kind === 'locate'
      ? locationCommitted
        ? [interaction.targets[interaction.item.correctChoiceIds[0]]]
        : []
      : activeStep.stops
  const mapCaption = walkStop
    ? `You are here: ${breathStop(walkStop).title}. Stop ${walkStopIndex + 1} of ${interaction.kind === 'walk' ? interaction.stops.length : 4}.`
    : interaction.kind === 'locate' && !locationCommitted
      ? 'Where on this breath does the problem live? Choose a stop below.'
      : breathMapCaption(mapStops)
  const mapAnswer: BreathMapAnswer | undefined =
    interaction.kind === 'locate'
      ? {
          legend: interaction.item.stem,
          name: `mv-locate-${activeStep.id}`,
          choices: interaction.item.choices.map((choice) => ({
            id: choice.id,
            label: choice.label,
          })),
          targets: interaction.targets,
          selectedChoiceId: locationCommitted
            ? (evidence.location ?? null)
            : (pendingChoice[activeStep.id] ?? null),
          onSelect: (choiceId) =>
            setPendingChoice((current) => ({ ...current, [activeStep.id]: choiceId })),
          disabled: locationCommitted || lookingBack,
          revealed: locationCommitted
            ? { keyedChoiceId: interaction.item.correctChoiceIds[0] }
            : undefined,
        }
      : undefined

  const spotlightKey = spotlight?.stepId === activeStep.id ? spotlight.key : null
  const firstUnmetGoalKey = (() => {
    const unmet = goals.find((goal) => !labGoalMet(goal, session))
    if (!unmet) return null
    if (unmet.type === 'control' || unmet.type === 'mechanics') return unmet.key
    if (unmet.type === 'hold') return `hold-${unmet.hold}`
    if (unmet.type === 'intervention') return unmet.id
    return null
  })()

  useEffect(() => {
    if (!spotlight || spotlight.stepId !== activeStep.id) return
    const timer = window.setTimeout(() => {
      const control = document.getElementById(quickControlId(spotlight.key))
      if (!control) return
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      control.focus({ preventScroll: true })
      control.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [activeStep.id, spotlight])

  function showWhere() {
    if (!firstUnmetGoalKey) return
    const tab = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '[role=tablist][aria-label="Workspace panel views"] [role=tab]',
      ),
    ).find((button) => button.textContent === 'Simulator')
    tab?.click()
    setSpotlight((current) => ({
      stepId: activeStep.id,
      key: firstUnmetGoalKey,
      count: current?.stepId === activeStep.id ? current.count + 1 : 1,
    }))
  }

  /*
   * Which pane a one-pane compact viewport shows for this step — followed, not forced.
   *
   * The step's authored location, until the step's own work is done: then the next action is the
   * Now card's primary, so the view follows to the Steps pane. Looking back is read on the card
   * too. Without this the compact view opened on the simulator and stayed there, with the answer
   * choices in the pane it could not show.
   */
  const [teachingVisit, setTeachingVisit] = useState(0)
  useEffect(() => {
    if (taskFlow || !foundation || activeStep.lookIn.pane !== 'teaching') return
    if (teachingVisit > 0) {
      const tab = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          '[role=tablist][aria-label="Workspace panel views"] [role=tab]',
        ),
      ).find((button) => button.textContent === 'Teaching')
      tab?.click()
    }
    const target = document.getElementById('mv-foundation-teaching')
    target?.scrollIntoView?.({ block: 'start', behavior: 'auto' })
  }, [taskFlow, foundation, activeStep.id, activeStep.lookIn.pane, teachingVisit])
  useEffect(() => {
    if (foundation && lookingBack) engine({ type: 'SET_PAUSED', paused: true })
  }, [foundation, lookingBack, engine])

  const compactPane: StagePaneId =
    lookingBack || (stepPerformed && !finished)
      ? 'steps'
      : foundation && activeStep.phase === 'recognize'
        ? 'steps'
        : compactPaneForLocation(activeStep.lookIn, 'steps')

  /* ---------------------------------------------------------------- *
   * The Now card
   * ---------------------------------------------------------------- */
  const stepPosition = `Step ${activeStep.ordinal} of ${lesson.steps.length} · ${STAGE_PHASE_LABELS[activeStep.phase]}`
  /*
   * Where this step's work is done, in the words the pane captions carry. One line under the
   * instruction on every step, and again in the help dialog; the lesson builder refuses at import
   * to make a step without one, so the caption on the pane and the line on the card cannot drift.
   */
  const lookInLine = taskFlow ? (
    <>Inspect {activeStep.presentation.landmark}. Your response and Continue are below.</>
  ) : (
    <LookInLine location={activeStep.lookIn} />
  )
  const previousStep = activeIndex > 0 ? lesson.steps[activeIndex - 1] : undefined
  const canGoBack =
    previousStep !== undefined &&
    performedIds.has(previousStep.id) &&
    !finished &&
    !protectPriorPatient
  const showWhereAction =
    firstUnmetGoalKey && !stepPerformed && !lookingBack
      ? {
          label: spotlightKey ? 'Highlight it again' : 'Show me where',
          onActivate: showWhere,
          icon: <LocateFixed aria-hidden="true" />,
        }
      : undefined

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
              label: `Back to ${STAGE_PHASE_LABELS[previousStep.phase]}`,
              onActivate: goBack,
            },
          }
        : {}),
    }
    if (showingPrerequisite && interaction.kind === 'locate' && !lookingBack) {
      return {
        ...base,
        heading: 'Compare normal timing first',
        body: 'Study this separate worked reference before interpreting the current patient.',
        where: lookInLine,
        primary: { label: 'Continue to patient tracing', onActivate: () => setExampleSeen(true) },
      }
    }
    if (lookingBack) {
      return {
        ...base,
        status:
          'Done. You are looking back at an earlier step. The patient is where you left it, and nothing you have worked through is lost.',
        primary: {
          label: `Return to step ${heldIndex + 1}`,
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
          ...(foundation && !taskFlow
            ? {
                secondary: {
                  label: 'Show the worked reference',
                  onActivate: () => setTeachingVisit((v) => v + 1),
                },
              }
            : {}),
          primary: { label: activeStep.actionLabel, onActivate: continueFromRecognize },
        }
      case 'walk': {
        if (walkDone) {
          return {
            ...base,
            status: 'All four stops visited.',
            primary: {
              label: 'Continue',
              onActivate: continueFromRecognize,
              icon: <ArrowRight aria-hidden="true" />,
            },
          }
        }
        const last = walkStopIndex >= interaction.stops.length - 1
        return {
          ...base,
          status: `Stop ${walkStopIndex + 1} of ${interaction.stops.length}.`,
          primary: {
            label: last ? 'Finish the walk' : 'Next stop',
            onActivate: () => {
              if (last) setWalkDone(true)
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
      case 'locate':
        if (locationCommitted) {
          return {
            ...base,
            body: taskFlow
              ? 'Your interpretation is recorded. Read the explanation, then continue.'
              : 'Your answer is marked on the breath map, with the stop that fits this patient.',
            primary: {
              label: 'Continue',
              onActivate: continueFromRecognize,
              icon: <ArrowRight aria-hidden="true" />,
            },
          }
        }
        return {
          ...base,
          primary: {
            label: activeStep.actionLabel,
            onActivate: () => commitLocation(activeStep),
            disabled: !pendingChoice[activeStep.id],
            disabledReason: taskFlow
              ? 'Choose a location in the breath to enable this.'
              : 'Choose a stop on the breath map to enable this.',
            icon: <SlidersHorizontal aria-hidden="true" />,
          },
        }
      case 'prediction': {
        const committed = evidenceFor(activeStep).prediction !== undefined
        if (committed) {
          return {
            ...base,
            primary: {
              label: 'Continue',
              onActivate: () => confirmThrough(activeIndex),
              icon: <ArrowRight aria-hidden="true" />,
            },
          }
        }
        return {
          ...base,
          status:
            'The patient keeps running while you decide. The controls unlock once you commit.',
          primary: {
            label: activeStep.actionLabel,
            onActivate: () => commitPrediction(activeStep),
            disabled: !pendingChoice[activeStep.id],
            disabledReason: 'Choose one option to enable this.',
            icon: <SlidersHorizontal aria-hidden="true" />,
          },
        }
      }
      case 'simulator-task': {
        const allMet = goalsMet.every(Boolean)
        if (!interaction.withObservation) {
          if (allMet) {
            return {
              ...base,
              status:
                activeManeuver === 'pause'
                  ? 'Done. A breath interval is captured; phase identification is recorded separately.'
                  : activeManeuver === 'hold'
                    ? 'Done. The hold has been performed.'
                    : 'Done. The patient is receiving the change.',
              primary: {
                label: 'Continue',
                onActivate: () => confirmThrough(activeIndex),
                icon: <ArrowRight aria-hidden="true" />,
              },
            }
          }
          return {
            ...base,
            status: waitingStatus,
            secondary: showWhereAction,
          }
        }
        if (ready) {
          return {
            ...base,
            status: 'The interval has elapsed.',
            primary: {
              label: activeStep.actionLabel,
              onActivate: compare,
              icon: <ArrowRight aria-hidden="true" />,
            },
          }
        }
        return {
          ...base,
          status: allMet
            ? `Watching… ${Math.min(round.seconds, Math.floor(waited))} of ${round.seconds} simulated seconds.`
            : waitingStatus,
          secondary: showWhereAction,
        }
      }
      case 'observe':
        if (ready) {
          return {
            ...base,
            status: 'The interval has elapsed.',
            primary: {
              label: activeStep.actionLabel,
              onActivate: compare,
              icon: <ArrowRight aria-hidden="true" />,
            },
          }
        }
        return {
          ...base,
          status:
            round.seconds > 0
              ? `Watching… ${Math.min(round.seconds, Math.floor(waited))} of ${round.seconds} simulated seconds. ${session.simulation.paused ? 'The patient is paused — press Run.' : ''}`.trim()
              : 'Look at the readings, then compare.',
          primary:
            round.seconds > 0
              ? {
                  label: activeStep.actionLabel,
                  disabled: true,
                  disabledReason: 'Available once the interval has elapsed.',
                }
              : { label: activeStep.actionLabel, onActivate: compare },
        }
      case 'interpret': {
        const observed = evidenceFor(activeStep).observation
        return {
          ...base,
          primary: observed
            ? { label: 'Continue', onActivate: () => confirmThrough(activeIndex) }
            : {
                label: activeStep.actionLabel,
                onActivate: commitObservation,
                disabled: !observationDraft[activeStep.id],
                disabledReason: 'Choose the relationship supported by your captured run.',
              },
        }
      }
      case 'explain':
        return {
          ...base,
          primary: {
            label: activeStep.actionLabel,
            onActivate: () => continueFromExplain(activeStep),
            icon: <ArrowRight aria-hidden="true" />,
          },
        }
      case 'sort': {
        const committed = evidenceFor(activeStep).sort !== undefined
        if (committed) {
          return {
            ...base,
            primary: {
              label: 'Continue',
              onActivate: continueFromSort,
              icon: <ArrowRight aria-hidden="true" />,
            },
          }
        }
        const remaining = interaction.sort.rows.filter((row) => !sortDraft[row.id]).length
        return {
          ...base,
          primary: {
            label: activeStep.actionLabel,
            onActivate: () => commitSort(activeStep),
            disabled: remaining > 0,
            disabledReason: `${remaining} of ${interaction.sort.rows.length} still to sort.`,
          },
        }
      }
      default:
        return base
    }
  })()

  const nowBody: ReactNode = (() => {
    if (showingPrerequisite && !lookingBack) return null
    if (lookingBack) {
      /*
       * Looking back at a committed prediction shows the verdict again — the rationale, the
       * explanation and the other answers — rather than a one-line "You chose". The reasoning is
       * what a learner goes back for.
       */
      const stepEvidence = evidenceFor(activeStep)
      if (interaction.kind === 'prediction' && stepEvidence.prediction !== undefined) {
        return (
          <AnswerVerdict
            item={interaction.item}
            choiceId={CHOICE_IDS[stepEvidence.prediction]}
            outcome="stated"
            timing="immediate-after-commit"
            theme="dark"
            frames={PREDICTION_VERDICT_FRAMES}
            explanationHeading={PREDICTION_EXPLANATION_HEADING}
          />
        )
      }
      return <StepRecap step={activeStep} session={session} />
    }
    switch (interaction.kind) {
      case 'walk': {
        if (foundation)
          return (
            <p data-walk-stop={walkStop ?? 'complete'}>
              {walkStop
                ? `Inspect ${walkStop === 'trigger' ? 'the trigger that starts inspiration' : walkStop === 'cycling' ? 'cycling at the end of inspiration' : walkStop} on the captured reference. The phase marker and cursor move with this step.`
                : 'All four parts of the reference breath have been inspected.'}
            </p>
          )
        if (walkDone) return null
        const stop = walkStop ? breathStop(walkStop) : null
        if (!stop) return null
        return (
          <section className={styles.walk} data-walk-stop={stop.id} aria-label={stop.title}>
            <p className={styles.kicker}>Stop {stop.ordinal} of 4</p>
            <h3>{stop.title}</h3>
            <p className={styles.analogy}>{stop.analogy}</p>
            <dl>
              <div>
                <dt>Find it on the console</dt>
                <dd>{stop.consoleLabel}.</dd>
              </div>
              <div>
                <dt>Try this</dt>
                <dd>
                  {stop.wiggle.change} {stop.wiggle.watch}
                </dd>
              </div>
            </dl>
            {/*
              The short list, with the label that says what kind of list it is. It rendered as
              bare lines with the marker reset away, under a definition list whose two entries are
              labelled, so it read as more prose.
            */}
            <p
              className={styles.kicker}
              id={`${activeStep.id}-walk-checklist`}
              data-walk-checklist-label
            >
              {BREATH_STOP_CHECKLIST_LABEL}
            </p>
            <ul aria-labelledby={`${activeStep.id}-walk-checklist`} data-walk-checklist>
              {stop.checklist.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        )
      }
      case 'locate':
        if (locationCommitted && evidence.location) {
          return (
            <AnswerVerdict
              item={interaction.item}
              choiceId={evidence.location}
              outcome="stated"
              timing="immediate-after-commit"
              theme="dark"
            />
          )
        }
        if (taskFlow)
          return (
            <fieldset className={stageStyles.choiceList} data-location-choices>
              <legend>{interaction.item.stem}</legend>
              {orderChoices(interaction.item.id, interaction.item.choices).map((choice) => (
                <label key={choice.id} className={stageStyles.choice}>
                  <input
                    type="radio"
                    name={`mv-locate-${activeStep.id}`}
                    checked={pendingChoice[activeStep.id] === choice.id}
                    onChange={() =>
                      setPendingChoice((current) => ({ ...current, [activeStep.id]: choice.id }))
                    }
                  />
                  <span>{choice.label}</span>
                </label>
              ))}
            </fieldset>
          )
        return (
          <p className={stageStyles.taskInstruction} data-map-answer-note>
            Answer on the breath map below the console: choose the stop where the problem lives.
            {pendingChoice[activeStep.id]
              ? ` Chosen: ${interaction.item.choices.find((c) => c.id === pendingChoice[activeStep.id])?.label}.`
              : ''}
          </p>
        )
      case 'prediction': {
        const stepEvidence = evidenceFor(activeStep)
        const committedId =
          stepEvidence.prediction !== undefined ? CHOICE_IDS[stepEvidence.prediction] : null
        if (committedId) {
          return (
            <AnswerVerdict
              item={interaction.item}
              choiceId={committedId}
              outcome="stated"
              timing="immediate-after-commit"
              theme="dark"
              frames={PREDICTION_VERDICT_FRAMES}
              explanationHeading={PREDICTION_EXPLANATION_HEADING}
            />
          )
        }
        const selected = pendingChoice[activeStep.id] ?? null
        const questionSamples = stepEvidence.baseline?.waveforms ?? session.simulation.waveforms
        const questionBreath = completedBreath(questionSamples)
        return (
          <>
            {unitId === 'breathing-with-support' ? (
              <CapturedBreath
                label={`Captured complete breath · interval ${interaction.round === 0 ? 'A' : 'B'}`}
                samples={questionSamples}
                fixedIndex={breathStopIndex(
                  questionBreath,
                  interaction.round === 0 ? 'expiration' : 'inspiration',
                )}
              />
            ) : null}
            <fieldset className={stageStyles.choiceList} data-prediction-choices>
              <legend>{interaction.item.stem}</legend>
              {orderChoices(interaction.item.id, interaction.item.choices).map((choice) => (
                <label
                  key={choice.id}
                  className={stageStyles.choice}
                  data-selected={selected === choice.id}
                >
                  <input
                    type="radio"
                    name={`mv-prediction-${activeStep.id}`}
                    value={choice.id}
                    checked={selected === choice.id}
                    onChange={() =>
                      setPendingChoice((current) => ({ ...current, [activeStep.id]: choice.id }))
                    }
                  />
                  <span>{choice.label}</span>
                </label>
              ))}
            </fieldset>
          </>
        )
      }
      case 'simulator-task':
      case 'observe': {
        const showGoals = interaction.kind === 'simulator-task'
        const showProgress =
          interaction.kind === 'observe' ||
          (interaction.kind === 'simulator-task' && interaction.withObservation)
        return (
          <>
            {taskFlow && activeStep.guide ? (
              <div
                className={taskStyles.block}
                data-teaching-block="guide"
                data-maneuver={activeStep.guide.maneuver}
              >
                <p>{activeStep.guide.note}</p>
                <p>
                  <strong>What to inspect:</strong> {activeStep.guide.look}
                </p>
              </div>
            ) : null}
            {unitId === 'breathing-with-support' && showGoals && evidence.baseline ? (
              <CapturedBreath
                key={`inspection-${session.round}`}
                label="Captured baseline · inspect an interval without changing the patient"
                samples={evidence.baseline.waveforms}
                onInspect={(sample) => lab({ type: 'INSPECT', sampleTime: sample.time })}
              />
            ) : null}
            {unitId === 'breathing-with-support' && !showGoals ? (
              <InspectedBreath evidence={evidence} />
            ) : null}
            {showGoals ? (
              <ul className={stageStyles.taskList} data-step-goals aria-label="What to change">
                {goals.map((goal, index) => (
                  <li key={`${goal.type}-${index}`} data-met={goalsMet[index]}>
                    {goalsMet[index] ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
                    <span>{goalLabel(goal)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {showProgress && round.seconds > 0 && goalsMet.every(Boolean) ? (
              <div className={stageStyles.progress} data-observation-progress>
                <progress
                  max={round.seconds}
                  value={Math.min(round.seconds, waited)}
                  aria-label="Observation interval"
                />
                <p className={shellStyles.nowStatus}>
                  Watching{' '}
                  {watch.map((metric) => labMetricLabels[metric].label.toLowerCase()).join(', ')}.
                </p>
              </div>
            ) : null}
          </>
        )
      }
      case 'interpret': {
        const stepEvidence = evidenceFor(activeStep)
        const item = observationFor({ ...session, round: interaction.round })
        const observed = stepEvidence.observation
        const before = stepEvidence.baseline,
          after = stepEvidence.response
        const axes = waveformAxes([...(before?.waveforms ?? []), ...(after?.waveforms ?? [])])
        return (
          <div data-observation-task>
            {before && after && unitId !== 'breathing-with-support' ? (
              <>
                <BeforeAfter
                  before={before}
                  after={after}
                  metrics={experiment.rounds[interaction.round].watch}
                  revealDirection={Boolean(observed)}
                />
                <details open={unitId === 'waveform-anatomy'}>
                  <summary>Captured baseline and result waveforms</summary>
                  <div className={taskFlow ? taskStyles.comparison : undefined}>
                    <CapturedBreath
                      label="Captured baseline"
                      samples={before.waveforms}
                      axes={axes}
                      durationSeconds={Math.max(
                        ...[before, after].map((record) => {
                          const breath = completedBreath(record.waveforms)
                          return breath.length ? breath.at(-1)!.time - breath[0].time : 0
                        }),
                      )}
                    />
                    <CapturedBreath
                      label="Captured result"
                      samples={after.waveforms}
                      axes={axes}
                      durationSeconds={Math.max(
                        ...[before, after].map((record) => {
                          const breath = completedBreath(record.waveforms)
                          return breath.length ? breath.at(-1)!.time - breath[0].time : 0
                        }),
                      )}
                    />
                  </div>
                </details>
                {after.hold ? (
                  <CapturedBreath
                    label="Captured result: acquired inspiratory hold"
                    samples={after.hold.waveforms}
                    whole={false}
                  />
                ) : null}
              </>
            ) : null}
            {unitId === 'breathing-with-support' ? (
              <InspectedBreath evidence={stepEvidence} />
            ) : null}
            {after?.issues?.length ? (
              <p role="status">This comparison includes: {after.issues.join('; ')}.</p>
            ) : null}
            {!observed ? (
              <fieldset className={stageStyles.choiceList}>
                <legend>{item.prompt}</legend>
                {item.choices.map((choice) => (
                  <label className={stageStyles.choice} key={choice.id}>
                    <input
                      type="radio"
                      name={`observation-${activeStep.id}`}
                      checked={observationDraft[activeStep.id] === choice.id}
                      onChange={() =>
                        setObservationDraft((current) => ({
                          ...current,
                          [activeStep.id]: choice.id,
                        }))
                      }
                    />
                    {choice.label}
                  </label>
                ))}
              </fieldset>
            ) : (
              <p role="status" data-observation-feedback>
                <strong>
                  {observed.correct
                    ? 'Your observation matches this run.'
                    : 'Recheck the captured result.'}
                </strong>{' '}
                {item.feedback}
              </p>
            )}
            {after?.issues?.length || observed?.correct === false ? (
              <button
                type="button"
                className={styles.toolButton}
                onClick={() => {
                  lab({ type: 'RESET' })
                  setViewIndex(null)
                  setObservationDraft({})
                  setConfirmed(
                    lesson.steps.findIndex(
                      (s) =>
                        s.interaction.kind === 'simulator-task' &&
                        s.interaction.round === session.round,
                    ) - 1,
                  )
                }}
              >
                Repeat from a clean baseline
              </button>
            ) : null}
          </div>
        )
      }
      case 'explain': {
        const stepEvidence = evidenceFor(activeStep)
        const committedId =
          stepEvidence.prediction !== undefined ? CHOICE_IDS[stepEvidence.prediction] : null
        const item = lesson.steps.find(
          (s) => s.interaction.kind === 'prediction' && s.interaction.round === interaction.round,
        )?.interaction
        return (
          <>
            {/*
              The prediction's verdict, again, in full.

              The instruction says "Read the verdict on your prediction … then the explanation",
              and this step used to render one line — "Correct. You predicted: …" — with the
              rationale, the explanation and the other answers two steps back on a card the
              learner had left. The verdict is the reasoning, so it comes first, and the round's
              explanation is the paragraph under "The explanation" inside it rather than a second
              copy below.
            */}
            {committedId && item?.kind === 'prediction' ? (
              <div data-explain-recap>
                {foundation ? (
                  <p>
                    <strong>Intended mechanism and first prediction</strong> · Read your recorded
                    observation separately below.
                  </p>
                ) : null}
                <AnswerVerdict
                  item={item.item}
                  choiceId={committedId}
                  outcome="stated"
                  timing="immediate-after-commit"
                  theme="dark"
                  frames={PREDICTION_VERDICT_FRAMES}
                  explanationHeading={PREDICTION_EXPLANATION_HEADING}
                />
              </div>
            ) : null}
            {foundation && stepEvidence.observation ? (
              <p data-recorded-observation>
                {observationFor({ ...session, round: interaction.round }).feedback}
              </p>
            ) : null}
            {stepEvidence.response &&
            roundManeuver(experiment.rounds[interaction.round]) === 'pause' ? (
              <FrozenTraceReading
                response={stepEvidence.response}
                inspection={stepEvidence.inspection}
                peep={Number(
                  stepEvidence.response.inputs?.peepCmH2O ??
                    session.simulation.ventilator.settings.peepCmH2O,
                )}
              />
            ) : stepEvidence.baseline && stepEvidence.response ? (
              <BeforeAfter
                before={stepEvidence.baseline}
                after={stepEvidence.response}
                metrics={experiment.rounds[interaction.round].watch}
              />
            ) : null}
          </>
        )
      }
      case 'sort': {
        const committed = evidenceFor(activeStep).sort
        return (
          <div className={styles.sort} data-settings-sort>
            {interaction.sort.rows.map((row) => {
              const answer = committed?.[row.id] ?? sortDraft[row.id]
              const outcome = committed
                ? committed[row.id] === row.origin
                  ? 'correct'
                  : 'not-correct'
                : undefined
              return (
                <div
                  key={row.id}
                  className={styles.sortRow}
                  data-sort-row={row.id}
                  data-outcome={outcome}
                >
                  <label htmlFor={`mv-sort-${row.id}`}>{row.label}</label>
                  <select
                    id={`mv-sort-${row.id}`}
                    className={styles.sortSelect}
                    value={answer ?? ''}
                    disabled={committed !== undefined}
                    onChange={(event) =>
                      setSortDraft((current) => ({
                        ...current,
                        [row.id]: event.target.value as 'set' | 'reported',
                      }))
                    }
                  >
                    <option value="" disabled>
                      Choose…
                    </option>
                    <option value="set">{interaction.sort.origins.set}</option>
                    <option value="reported">{interaction.sort.origins.reported}</option>
                  </select>
                  {committed ? (
                    <p className={styles.sortVerdict} data-sort-verdict={outcome}>
                      <strong>{outcome === 'correct' ? 'Correct.' : 'Not correct.'}</strong>{' '}
                      {row.rationale}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        )
      }
      default:
        return null
    }
  })()

  /* ---------------------------------------------------------------- *
   * Panes
   * ---------------------------------------------------------------- */
  const settings = session.simulation.ventilator.settings
  const profile = getVentilatorDeviceProfile(session.device)
  const breathSize =
    settings.mode === 'volume-ac'
      ? `VT ${settings.vtMl} mL`
      : settings.mode === 'pressure-ac'
        ? `ΔP ${settings.deltaPControlCmH2O} cmH₂O`
        : `PS ${settings.pressureSupportCmH2O} cmH₂O`
  const rate = 'ratePerMin' in settings ? `${settings.ratePerMin}/min` : 'patient-set'
  const contextItems: readonly ContextStripItem[] = [
    { label: 'Mode', value: getModeLabel(settings.mode) },
    { label: 'Breath', value: breathSize },
    { label: 'Rate', value: rate },
    { label: 'PEEP', value: `${settings.peepCmH2O} cmH₂O` },
    { label: 'Oxygen', value: `${settings.oxygenPercent}%` },
  ]
  const activeAlarm = session.simulation.alarms.find((alarm) => alarm.active)
  const alarm = activeAlarm
    ? {
        priority: (activeAlarm.priority as 'low' | 'medium' | 'high') ?? 'medium',
        text: activeAlarm.message,
      }
    : { priority: 'none' as const, text: 'No active alarm' }

  const simulator = (
    <>
      {foundation ? (
        <div className={styles.compactTask}>
          <strong>{activeStep.title}</strong>
          <p>{activeStep.instruction}</p>
          <p>
            {interaction.kind === 'prediction' && pendingChoice[activeStep.id]
              ? `Selected answer: ${interaction.item.choices.find((c) => c.id === pendingChoice[activeStep.id])?.label}. `
              : ''}
            Return to Steps for your answer and Continue.
          </p>
        </div>
      ) : null}
      <VentilationSimulatorPane
        key={foundation ? `${session.device}:${session.round}` : undefined}
        session={session}
        engine={engine}
        controlsEnabled={controlsEnabled && !lookingBack}
        lockedReason={lockedReason}
        pausedReason={pausedReason}
        controlsNote={controlsNote}
        onResetPatient={() => {
          lab({ type: 'RESET' })
          setObservationDraft({})
        }}
        resetDisabledReason={resetDisabledReason}
        resetWouldErase={resetWouldErase}
        onSelectDevice={selectDevice}
        deviceLocked={predictionCommitted}
        watch={watch}
        goals={interaction.kind === 'simulator-task' || interaction.kind === 'observe' ? goals : []}
        mechanicsVisible={mechanicsVisible}
        exploring={interaction.kind === 'explain'}
        spotlightKey={spotlightKey}
        stops={mapStops}
        mapCaption={mapCaption}
        mapAnswer={mapAnswer}
        readOnly={foundation && lookingBack}
        bedsideAvailable={interaction.kind !== 'locate' || locationCommitted}
      />
    </>
  )

  const teaching = (
    <StageTeachingScope
      value={{ phase: activeStep.phase, predictionCommitted, stepId: activeStep.id }}
    >
      <VentilationTeachingColumn
        lesson={lesson}
        step={activeStep}
        state={session.simulation}
        predictionCommitted={predictionCommitted}
        stops={mapStops}
        onShowControl={firstUnmetGoalKey ? showWhere : undefined}
      />
    </StageTeachingScope>
  )

  const pairing = ventilationPracticePairing(unitId)
  const completionLead =
    pairing?.kind === 'mechanism-match'
      ? 'The reasoning has been worked through. Apply it to the paired clinical case in Practice, starting fresh with less prompting.'
      : pairing?.kind === 'next-in-unit'
        ? 'The reasoning has been worked through. A clinical case in this part of the pathway is ready in Practice.'
        : 'The reasoning has been worked through. Continue to the next section to keep building on this.'

  const task = (
    <>
      <div ref={nowFocusRef} tabIndex={-1} data-now-focus>
        <NowCard model={nowModel}>
          {taskFlow ? (
            <VentilationTaskWorkspace
              presentation={activeStep.presentation}
              instruction={
                showingPrerequisite ? (
                  <VentilationPrerequisite lesson={lesson} device={session.device} />
                ) : activeStep.presentation.surface === 'reference' ? (
                  teaching
                ) : undefined
              }
              workbench={
                activeStep.presentation.surface !== 'comparison' &&
                interaction.kind !== 'sort' &&
                !showingPrerequisite ? (
                  <VentilationTaskWorkbench
                    key={`${session.device}:${session.round}`}
                    session={session}
                    presentation={activeStep.presentation}
                    engine={engine}
                    goals={goals}
                    watch={activeRound?.watch ?? watch}
                    controlsEnabled={controlsEnabled && !lookingBack}
                    deviceLocked={predictionCommitted}
                    onSelectDevice={selectDevice}
                    onResetPatient={() => {
                      lab({ type: 'RESET' })
                      setObservationDraft({})
                    }}
                    lockedReason={lockedReason ?? pausedReason}
                    readOnly={lookingBack}
                    transportOnly={
                      activeStep.presentation.surface === 'reference' ||
                      unitId === 'breathing-with-support'
                    }
                  />
                ) : undefined
              }
              response={
                <>
                  {nowBody}
                  {interaction.kind === 'explain' ? (
                    <>
                      {!foundation &&
                      evidenceFor(activeStep).baseline &&
                      evidenceFor(activeStep).response ? (
                        <RecordedBreathComparison
                          evidence={evidenceFor(activeStep)}
                          effort={activeStep.presentation.effort}
                        />
                      ) : null}
                      {activeStep.presentation.kind === 'response-lab' && !lookingBack ? (
                        <VentilationResponseTimeline session={session} />
                      ) : null}
                      <details>
                        <summary>Review the mechanism and references</summary>
                        {teaching}
                      </details>
                    </>
                  ) : null}
                </>
              }
            />
          ) : (
            nowBody
          )}
        </NowCard>
      </div>
      {activeIndex === 0 ? (
        <details className={stageStyles.objectives} data-stage-objectives>
          <summary>What this section is for</summary>
          <p>{lesson.spec.objective}</p>
          <p>
            <strong>One new idea:</strong> {lesson.spec.newConcept}
          </p>
        </details>
      ) : null}
      {foundation && session.history?.length ? (
        <details className={styles.block} data-historical-learning>
          <summary>Earlier learning records ({session.history.length})</summary>
          <p>
            These records are historical. They do not supply observations for the revised tasks.
          </p>
          {session.history.map((entry, i) => (
            <p key={i}>
              {entry.reason}. Device: {entry.device}; round {entry.round + 1}; predictions{' '}
              {entry.evidence
                .map((e) =>
                  e.prediction === undefined ? 'not submitted' : String(e.prediction + 1),
                )
                .join(', ')}
              {entry.completedAt ? `; completed ${entry.completedAt}` : ''}
              {entry.holds?.length
                ? `; ${entry.holds.length} historical hold acquisitions retained`
                : ''}
              .
            </p>
          ))}
        </details>
      ) : null}
      {!protectPriorPatient ? (
        <details open={!taskFlow} data-task-map>
          <summary>Lesson map · {lesson.steps.length} tasks</summary>
          <StepList
            lesson={lesson}
            currentIndex={activeIndex}
            furthestPerformedIndex={progress.furthestPerformedIndex}
            performedStepIds={shownPerformedIds}
            predictionCommitted={predictionCommitted}
            reviewIndex={review}
            recapFor={(index) => recapLines(lesson.steps[index], session)}
            onSelect={selectStepRow}
          />
        </details>
      ) : null}
      {!storageAvailable ? (
        <p className={stageStyles.boundaryNote} role="status">
          This browser is not saving your place. The section still works; a reload starts it again.
        </p>
      ) : null}
      {finished ? (
        <section
          className={stageStyles.completion}
          role="status"
          aria-live="polite"
          data-stage-completion
        >
          <h3>Section worked through</h3>
          <p>{completionLead}</p>
          {pairing?.kind === 'next-in-unit' ? (
            <p data-practice-pairing-note>It applies a different mechanism from this section.</p>
          ) : null}
          <div className={stageStyles.completionActions}>
            {pairing ? (
              <button
                type="button"
                className={shellStyles.nowPrimary}
                data-practice-pairing={pairing.kind}
                onClick={() =>
                  router.push({
                    pathname: `${mechanicalVentilationNavBase}/practice`,
                    query: { case: pairing.caseId, device: session.device, mode: 'guided' },
                  })
                }
              >
                {pairing.kind === 'mechanism-match'
                  ? `Apply this in Practice: ${pairing.title}`
                  : `A case in this part of the pathway: ${pairing.title}`}
                <ArrowRight aria-hidden="true" />
              </button>
            ) : null}
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
                onClick={() => router.push(`${mechanicalVentilationNavBase}/assess`)}
              >
                Go to the knowledge check
              </button>
            )}
          </div>
        </section>
      ) : null}
    </>
  )

  const header = (
    <SectionHeader
      breadcrumb={{ href: mechanicalVentilationNavBase, label: 'Mechanical Ventilation' }}
      kicker={`Section ${lesson.index + 1} of ${lesson.total} · ${lesson.minutes} min · ${profile.shortName}`}
      title={lesson.title}
      sectionsControl={
        <SectionsDrawer
          pathway={pathway}
          activeSectionId={unitId}
          position={`${lesson.index + 1} of ${lesson.total}`}
          label="Mechanical ventilation pathway"
          onSelect={goToSection}
        />
      }
      helpRef={helpButtonRef}
      onHelp={() => setHelpOpen(true)}
      onRestart={restartSection}
      restartLabel="Restart section"
      saveAndExitHref={mechanicalVentilationNavBase}
    />
  )

  const stageSources = ventilationStageSources(unitId, session.device)

  const helpDialog = (
    <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} returnFocusTo={helpButtonRef}>
      <p className={shellStyles.kicker}>{stepPosition}</p>
      <p>
        <strong>{activeStep.title}</strong>
      </p>
      <p>{activeStep.instruction}</p>
      <p>{lookInLine}</p>
      {activeStep.rationale ? <p>{activeStep.rationale}</p> : null}
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
    <MechanicalVentilationModuleFrame
      locale={locale}
      activeHref={`${mechanicalVentilationNavBase}/learn`}
      activityMode
      taskFlow={taskFlow}
    >
      <StageSourcesScope>
        {taskFlow ? (
          <div className={taskStyles.flow} data-stage-frame>
            <LessonShell
              section="learn"
              stage={activeStep.id}
              label="Guided mechanical ventilation section"
              module="mechanical-ventilation"
              header={header}
              contextStrip={
                <ContextStrip items={contextItems} alarm={alarm} badge="Simulated values" />
              }
              footer={
                <>
                  <p className={shellStyles.footerLine}>
                    Professional education only. Not a clinical device or a patient-specific guide;
                    every value is simulated. Follow current manufacturer instructions and local
                    protocol.
                  </p>
                  <StageSourcesFooter
                    label="Sources for this section"
                    count={stageSources.evidenceIds.length}
                    claimsVisible={predictionCommitted && !protectPriorPatient}
                  >
                    <VentilationSourceList
                      records={stageSources.records}
                      claimsVisible={predictionCommitted && !protectPriorPatient}
                    />
                  </StageSourcesFooter>
                </>
              }
            >
              <div className={taskStyles.content}>{task}</div>
            </LessonShell>
            {helpDialog}
          </div>
        ) : (
          <StageLayout
            stageId={activeStep.id}
            label="Guided mechanical ventilation section"
            module="mechanical-ventilation"
            workspaceLabel="Ventilation lesson workspace: steps, teaching, and simulator"
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
                <p className={shellStyles.footerLine}>
                  Professional education only. Not a clinical device or a patient-specific guide;
                  every value is simulated. Follow current manufacturer instructions and local
                  protocol.
                </p>
                <StageSourcesFooter
                  count={stageSources.evidenceIds.length}
                  label="Sources for this section"
                  claimsVisible={predictionCommitted}
                >
                  <VentilationSourceList
                    records={stageSources.records}
                    claimsVisible={predictionCommitted}
                  />
                </StageSourcesFooter>
              </>
            }
            overlay={helpDialog}
          />
        )}
      </StageSourcesScope>
    </MechanicalVentilationModuleFrame>
  )
}

function getModeLabel(mode: string): string {
  switch (mode) {
    case 'volume-ac':
      return 'Volume control'
    case 'pressure-ac':
      return 'Pressure control'
    case 'pressure-support':
      return 'Pressure support'
    default:
      return mode
  }
}

function recapLines(
  step: VentilationStageStep | undefined,
  session: LabSession,
): readonly string[] {
  if (!step) return []
  const round = 'round' in step.interaction ? step.interaction.round : 0
  const evidence = session.evidence[round]
  switch (step.interaction.kind) {
    case 'prediction': {
      const index = evidence.prediction
      const choice = index === undefined ? undefined : step.interaction.item.choices[index]
      return choice ? [`You chose: ${choice.label}`] : ['Prediction recorded.']
    }
    case 'locate': {
      const choice = step.interaction.item.choices.find((c) => c.id === evidence.location)
      return choice ? [`You placed it: ${choice.label}`] : ['Answered on the breath map.']
    }
    case 'walk':
      return breathStopIds.map((id) => breathStop(id).title)
    case 'simulator-task':
      return step.interaction.goals.map(goalLabel)
    case 'observe':
      return ['Watched the response interval, then compared before and after.']
    case 'interpret': {
      const item = observationFor({ ...session, round })
      const choice = item.choices.find((c) => c.id === evidence.observation?.choice)
      return choice ? [`Your recorded observation: ${choice.label}`, item.feedback] : []
    }
    case 'sort':
      return evidence.sort ? [`${Object.keys(evidence.sort).length} values sorted.`] : ['Sorted.']
    default:
      return step.expectedResponse ?? []
  }
}

function StepRecap({
  step,
  session,
}: {
  readonly step: VentilationStageStep
  readonly session: LabSession
}) {
  const lines = recapLines(step, session)
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

/**
 * What the frozen traces showed, for a round whose action is a pause: the three traces at the
 * instant the display froze, each read against its own reference — flow against zero, volume
 * against where it was heading, pressure against the PEEP baseline. Read off the saved response
 * snapshot, whose last sample is the pause.
 */
function FrozenTraceReading({
  response,
  inspection,
  peep,
}: {
  readonly response: NonNullable<LabEvidence['response']>
  readonly inspection?: LabEvidence['inspection']
  readonly peep: number
}) {
  const samples = response.waveforms
  const last = inspection?.sample ?? samples.at(-1)
  const previous = inspection?.previous ?? samples.at(-2)
  if (!last) return null
  const flowWord =
    last.flowLMin < -0.5
      ? 'below zero — gas is leaving'
      : last.flowLMin > 0.5
        ? 'above zero — gas is going in'
        : 'at zero — nothing is moving'
  const volumeWord = previous
    ? last.volumeMl < previous.volumeMl - 0.5
      ? 'falling'
      : last.volumeMl > previous.volumeMl + 0.5
        ? 'rising'
        : 'level'
    : 'read at the pause'
  const pressureWord =
    Math.abs(last.pawCmH2O - peep) < 1.5
      ? 'at the PEEP baseline'
      : last.pawCmH2O > peep
        ? 'above the baseline'
        : 'below the baseline'
  return (
    <table className={stageStyles.compareTable} data-frozen-reading>
      <caption className={shellStyles.kicker}>What your captured interval showed</caption>
      <thead>
        <tr>
          <th scope="col">Trace</th>
          <th scope="col">At your selected interval</th>
          <th scope="col">Read as</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Flow (L/min)</th>
          <td>{last.flowLMin.toFixed(1)}</td>
          <td>{flowWord}</td>
        </tr>
        <tr>
          <th scope="row">Volume (mL)</th>
          <td>{last.volumeMl.toFixed(0)}</td>
          <td>{volumeWord}</td>
        </tr>
        <tr>
          <th scope="row">Pressure (cmH₂O)</th>
          <td>{last.pawCmH2O.toFixed(1)}</td>
          <td>{pressureWord}</td>
        </tr>
      </tbody>
    </table>
  )
}

function BeforeAfter({
  before,
  after,
  metrics,
  revealDirection = true,
}: {
  readonly revealDirection?: boolean
  readonly before: NonNullable<LabEvidence['baseline']>
  readonly after: NonNullable<LabEvidence['response']>
  readonly metrics: readonly (keyof typeof labMetricLabels)[]
}) {
  return (
    <table className={stageStyles.compareTable} data-before-after>
      <caption className={shellStyles.kicker}>
        Captured baseline → captured result
        {metrics.includes('plateau')
          ? ` · Baseline plateau: ${before.plateauSource ?? 'modeled'}; result plateau: ${after.plateauSource ?? 'modeled'}`
          : ''}
      </caption>
      <thead>
        <tr>
          <th scope="col">Reading</th>
          <th scope="col">Before</th>
          <th scope="col">After</th>
        </tr>
      </thead>
      <tbody>
        {metrics.map((metric) => {
          const digits = labMetricLabels[metric].digits
          const b = before.values[metric]
          const a = after.values[metric]
          const direction = Math.abs(a - b) < 0.5 * 10 ** -digits ? 'same' : a > b ? 'up' : 'down'
          return (
            <tr key={metric}>
              <th scope="row">
                {labMetricLabels[metric].label} ({labMetricLabels[metric].unit})
              </th>
              <td>
                {b.toFixed(digits)}
                {metric === 'plateau' && !before.plateauValid ? ' *' : ''}
              </td>
              <td data-direction={revealDirection ? direction : undefined}>
                {a.toFixed(digits)}
                {metric === 'plateau' && !after.plateauValid ? ' *' : ''}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
