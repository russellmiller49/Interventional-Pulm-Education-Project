'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, Circle, LocateFixed, SlidersHorizontal } from 'lucide-react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { useCriticalCareActivityAnalytics } from '@/features/learning-module/activity'
import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { nextPathwaySection } from '@/features/learning-module/curriculum/types'
import { mechanicalVentilationNavBase } from '@/features/learning-module/moduleRoutes'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import { ContextStrip, type ContextStripItem } from '@/features/learning-module/stage/ContextStrip'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { NowCard, type NowCardModel } from '@/features/learning-module/stage/NowCard'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { SectionsDrawer } from '@/features/learning-module/stage/SectionsDrawer'
import { StageLayout } from '@/features/learning-module/stage/StageLayout'
import { STAGE_PHASE_LABELS } from '@/features/learning-module/stage/stageModel'
import { StageSourcesFooter } from '@/features/learning-module/stage/StageSourcesFooter'
import { StageSourcesScope } from '@/features/learning-module/stage/StageSourcesScope'
import { StageTeachingScope } from '@/features/learning-module/stage/StageTeachingScope'
import { StepList } from '@/features/learning-module/stage/StepList'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'
import { useRouter } from '@/i18n/navigation'

import { breathStop, breathStopIds, type BreathStopId } from '../../content/breathSpine'
import { getVentilatorDeviceProfile } from '../../content/deviceProfiles'
import { ventilationExperimentByUnit, type LabGoal } from '../../content/learningExperiments'
import { ventilationPracticePairing } from '../../content/sectionSpecs'
import { ventilationChoiceIndex } from '../../content/stageItems'
import { ventilationStageLesson, type VentilationStageStep } from '../../content/stageLessons'
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

const CHOICE_IDS = ['a', 'b', 'c'] as const

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
}: {
  readonly unitId: string
  readonly locale?: string
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
    />
  )
}

function VentilationStageSession({
  unitId,
  locale,
  saved,
  save,
  storageAvailable,
}: {
  readonly unitId: string
  readonly locale: string
  readonly saved?: LabCheckpoint
  readonly save: (record: LabCheckpoint) => void
  readonly storageAvailable: boolean
}) {
  const router = useRouter()
  const lesson = useMemo(() => ventilationStageLesson(unitId), [unitId])
  const experiment = ventilationExperimentByUnit.get(unitId)!
  const [device] = useState<VentilatorDeviceId>(() => saved?.device ?? readDevicePreference())
  const { session, engine, lab } = useVentilationLabSession({ unitId, device, saved, save })
  const pathway = criticalCareLearningPathway('mechanical-ventilation')
  const nextSection = nextPathwaySection(pathway, unitId)

  /* ---------------------------------------------------------------- *
   * View state
   * ---------------------------------------------------------------- */
  const [walkStopIndex, setWalkStopIndex] = useState(0)
  const [walkDone, setWalkDone] = useState(false)
  const [pendingChoice, setPendingChoice] = useState<Record<string, string>>({})
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
  const confirmThrough = useCallback((index: number) => {
    setConfirmed((current) => Math.max(current, index))
    setViewIndex(null)
    setReview(null)
    setSpotlight(null)
  }, [])

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
  const resetViewState = useCallback(() => {
    setConfirmed(-1)
    setViewIndex(null)
    setReview(null)
    setWalkStopIndex(0)
    setWalkDone(false)
    setReadConfirmed(false)
    setPendingChoice({})
    setSortDraft({})
    setSpotlight(null)
    completionRecorded.current = false
  }, [])

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
  const watch =
    interaction.kind === 'observe'
      ? interaction.watch
      : interaction.kind === 'simulator-task'
        ? experiment.rounds[interaction.round].watch
        : interaction.kind === 'explain'
          ? experiment.rounds[interaction.round].watch
          : []
  const controlsEnabled = session.phase !== 'predict'
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
    setSpotlight((current) => ({
      stepId: activeStep.id,
      key: firstUnmetGoalKey,
      count: current?.stepId === activeStep.id ? current.count + 1 : 1,
    }))
  }

  /* ---------------------------------------------------------------- *
   * The Now card
   * ---------------------------------------------------------------- */
  const stepPosition = `Step ${activeStep.ordinal} of ${lesson.steps.length} · ${STAGE_PHASE_LABELS[activeStep.phase]}`
  const previousStep = activeIndex > 0 ? lesson.steps[activeIndex - 1] : undefined
  const canGoBack = previousStep !== undefined && performedIds.has(previousStep.id) && !finished
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
            body: 'Your answer is marked on the breath map, with the stop that fits this patient.',
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
            disabledReason: 'Choose a stop on the breath map to enable this.',
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
              status: 'Done. The patient is receiving the change.',
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
              'Waiting for the change on the ventilator. This step is done once the patient is receiving it.',
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
            : 'Waiting for the change on the ventilator.',
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
    if (lookingBack) return <StepRecap step={activeStep} session={session} />
    switch (interaction.kind) {
      case 'walk': {
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
            <ul>
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
            />
          )
        }
        const selected = pendingChoice[activeStep.id] ?? null
        return (
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
      case 'explain': {
        const stepEvidence = evidenceFor(activeStep)
        const committedId =
          stepEvidence.prediction !== undefined ? CHOICE_IDS[stepEvidence.prediction] : null
        const item = lesson.steps.find(
          (s) => s.interaction.kind === 'prediction' && s.interaction.round === interaction.round,
        )?.interaction
        const chosen =
          committedId && item?.kind === 'prediction'
            ? item.item.choices.find((c) => c.id === committedId)
            : undefined
        return (
          <>
            {chosen ? (
              <p
                className={stageStyles.taskInstruction}
                data-explain-recap
                data-verdict-outcome={chosen.plausibility === 'best' ? 'correct' : 'not-correct'}
              >
                <strong>{chosen.plausibility === 'best' ? 'Correct.' : 'Not correct.'}</strong> You
                predicted: {chosen.label}.
              </p>
            ) : null}
            {stepEvidence.baseline && stepEvidence.response ? (
              <BeforeAfter
                before={stepEvidence.baseline}
                after={stepEvidence.response}
                metrics={experiment.rounds[interaction.round].watch}
              />
            ) : null}
            <p className={stageStyles.taskInstruction} data-round-explanation>
              {experiment.rounds[interaction.round].explanation}
            </p>
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
    <VentilationSimulatorPane
      session={session}
      engine={engine}
      controlsEnabled={controlsEnabled && !lookingBack}
      lockedReason={
        session.phase === 'predict'
          ? 'The settings are locked while you decide. Commit your prediction to take the controls.'
          : undefined
      }
      onResetPatient={() => lab({ type: 'RESET' })}
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
      bedsideAvailable={interaction.kind !== 'locate' || locationCommitted}
    />
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
        <NowCard model={nowModel}>{nowBody}</NowCard>
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
      <StepList
        lesson={lesson}
        currentIndex={activeIndex}
        furthestPerformedIndex={progress.furthestPerformedIndex}
        performedStepIds={performedIds}
        predictionCommitted={predictionCommitted}
        reviewIndex={review}
        recapFor={(index) => recapLines(lesson.steps[index], session)}
        onSelect={selectStepRow}
      />
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
    >
      <StageSourcesScope>
        <StageLayout
          stageId={activeStep.id}
          label="Guided mechanical ventilation section"
          module="mechanical-ventilation"
          workspaceLabel="Ventilation lesson workspace: simulator, teaching, and steps"
          header={header}
          contextStrip={
            <ContextStrip items={contextItems} alarm={alarm} badge="Simulated values" />
          }
          simulator={simulator}
          teaching={teaching}
          task={task}
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

function BeforeAfter({
  before,
  after,
  metrics,
}: {
  readonly before: NonNullable<LabEvidence['baseline']>
  readonly after: NonNullable<LabEvidence['response']>
  readonly metrics: readonly (keyof typeof labMetricLabels)[]
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
              <td data-direction={direction}>
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
