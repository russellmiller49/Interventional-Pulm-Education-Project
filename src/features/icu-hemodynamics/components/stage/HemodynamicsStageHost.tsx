'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, Circle, LocateFixed } from 'lucide-react'

import { useCriticalCareActivityAnalytics } from '@/features/learning-module/activity'
import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { nextPathwaySection } from '@/features/learning-module/curriculum/types'
import { icuHemodynamicsNavBase } from '@/features/learning-module/moduleRoutes'
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

import {
  pawpPlausibilityCommitment,
  pawpRecoveryCommitment,
} from '../../content/pawpCaptureSequence'
import { hemodynamicsPathway } from '../../content/pathwayResolver'
import { isOffMapTarget } from '../../content/mapAnswerTargets'
import { routeStop, type RouteStopId } from '../../content/routeSpine'
import { hemodynamicsPracticePairing } from '../../content/sectionSpecs'
import { hemodynamicsStageLesson, type HemodynamicsStageStep } from '../../content/stageLessons'
import { hemodynamicsStageSources } from '../../content/stageSources'
import {
  readLearnRecord,
  withSectionCompleted,
  withSectionVisited,
  writeLearnRecord,
} from '../../engine/learnProgress'
import {
  PA_RETURN_CHECK,
  stageGoalLabel,
  stageGoalMet,
  stageWatchLabels,
  stageWatchValue,
  type StageWatch,
} from '../../engine/stageRuntime'
import { derivedHemodynamicsSectionCompletion } from '../../engine/derivedEvaluation'
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
import { HemodynamicsSimulatorPane } from './HemodynamicsSimulatorPane'
import { HemodynamicsSourceList } from './HemodynamicsSourceList'
import { HemodynamicsStoryProblems } from './HemodynamicsStoryProblems'
import { HemodynamicsTeachingColumn } from './HemodynamicsTeachingColumn'
import { QuestionSortControl } from './QuestionSortControl'
import { quickControlId } from './StageDocks'
import {
  deriveStageProgress,
  emptyCommitments,
  stepWorkDone,
  WEDGE_PLAUSIBILITY_KEY,
  WEDGE_RETURN_KEY,
  type StageCommitments,
} from './stageProgress'
import { useHemodynamicsStageSession } from './useHemodynamicsStageSession'
import styles from './hemodynamics-stage.module.css'

/**
 * One section of the hemodynamics pathway on the lesson stage.
 *
 * The engine is the authority on the hands-on work: a step's goals are predicates over its state.
 * The host owns the commitments — which choice was committed, which set was sorted, which stop of
 * the walk is current — and the view around them: the step the learner is looking at when it is
 * not the live one, the choice not yet committed, whether help is open, and the Now card that
 * makes every step one thing. Nothing about a commitment is persisted; a reload starts the
 * section at its first step, and the only thing written is the completion record.
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

  /* ---------------------------------------------------------------- *
   * Commitments and view state
   * ---------------------------------------------------------------- */
  const [commitments, setCommitments] = useState<StageCommitments>(emptyCommitments)
  const [pendingChoice, setPendingChoice] = useState<Record<string, string>>({})
  const [sortDraft, setSortDraft] = useState<Record<string, string>>({})
  const [walkStopIndex, setWalkStopIndex] = useState(0)
  const [viewIndex, setViewIndex] = useState<number | null>(null)
  const [review, setReview] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [spotlight, setSpotlight] = useState<{ stepId: string; key: string; count: number } | null>(
    null,
  )
  const [snapshots, setSnapshots] = useState<Record<string, HemodynamicSimulationState>>({})
  const [confirmedPlaces, setConfirmedPlaces] = useState<Set<string>>(() => new Set())
  const [placeNote, setPlaceNote] = useState<string | null>(null)
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const nowFocusRef = useRef<HTMLDivElement>(null)

  const progress = deriveStageProgress(lesson, state, commitments)
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
  const workDone = stepWorkDone(activeStep, activeIndex, state, commitments)

  const analytics = useCriticalCareActivityAnalytics({
    moduleId: 'icu-hemodynamics',
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

  useEffect(() => {
    writeLearnRecord(withSectionVisited(readLearnRecord(), lesson.sectionId))
  }, [lesson.sectionId])

  const completionRecorded = useRef(false)
  useEffect(() => {
    if (!finished || completionRecorded.current) return
    completionRecorded.current = true
    writeLearnRecord(withSectionCompleted(readLearnRecord(), lesson.sectionId))
    analytics.recordActivityCompleted()
  }, [analytics, finished, lesson.sectionId])

  /* ---------------------------------------------------------------- *
   * Progression
   * ---------------------------------------------------------------- */
  const enterForward = useCallback(
    (index: number) => {
      const step = lesson.steps[index]
      if (!step) return
      if (step.entryState) load(step.entryState())
      if (step.interaction.kind === 'simulator-task' || step.interaction.kind === 'observe') {
        setSnapshots((current) =>
          current[
            `before:${step.interaction.kind === 'simulator-task' ? step.interaction.round : 0}`
          ]
            ? current
            : {
                ...current,
                [`before:${step.interaction.kind === 'simulator-task' ? step.interaction.round : 0}`]:
                  step.entryState ? step.entryState() : state,
              },
        )
      }
    },
    [lesson.steps, load, state],
  )

  const confirmThrough = useCallback(
    (index: number) => {
      setCommitments((current) => ({
        ...current,
        confirmed: Math.max(current.confirmed, index),
        performedIds: [
          ...current.performedIds,
          ...lesson.steps
            .slice(0, index + 1)
            .map((step) => step.id)
            .filter((id) => !current.performedIds.includes(id)),
        ],
      }))
      setViewIndex(null)
      setReview(null)
      setSpotlight(null)
      setPlaceNote(null)
      const step = lesson.steps[index]
      if (
        step &&
        (step.interaction.kind === 'simulator-task' || step.interaction.kind === 'observe')
      ) {
        const round = step.interaction.kind === 'simulator-task' ? step.interaction.round : 0
        setSnapshots((current) => ({ ...current, [`after:${round}`]: state }))
      }
      enterForward(index + 1)
    },
    [enterForward, lesson.steps, state],
  )

  function commitChoice(step: HemodynamicsStageStep, key = step.id) {
    const choiceId = pendingChoice[key]
    if (!choiceId) return
    setCommitments((current) => ({ ...current, choices: { ...current.choices, [key]: choiceId } }))
    if (step.interaction.kind === 'prediction') {
      analytics.recordPredictionSubmitted()
      if (step.interaction.round === 1) analytics.recordTransferCompleted()
    }
    setViewIndex(null)
  }

  function commitSort(step: HemodynamicsStageStep) {
    if (step.interaction.kind !== 'sort') return
    if (step.interaction.sort.rows.some((row) => !sortDraft[row.id])) return
    setCommitments((current) => ({ ...current, sort: { ...sortDraft } }))
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

  function goToSection(nextId: string) {
    if (nextId === sectionId) return
    router.push({ pathname: `${icuHemodynamicsNavBase}/learn`, query: { activity: nextId } })
  }

  function finish() {
    setCommitments((current) => ({
      ...current,
      confirmed: Math.max(current.confirmed, activeIndex),
      performedIds: [
        ...current.performedIds,
        ...lesson.steps
          .slice(0, activeIndex + 1)
          .map((step) => step.id)
          .filter((id) => !current.performedIds.includes(id)),
      ],
      finished: true,
    }))
    analytics.recordDebriefViewed()
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
  const locationCommitted = locationItem ? commitments.choices[activeStep.id] !== undefined : false

  const stops: readonly RouteStopId[] = walkStop
    ? [walkStop]
    : locationItem
      ? locationCommitted
        ? (() => {
            const keyed = locationItem.mapTargets!.find(
              (target) => target.choiceId === locationItem.item.correctChoiceIds[0],
            )
            return keyed && !isOffMapTarget(keyed) ? [keyed.stopId] : []
          })()
        : []
      : activeStep.stops

  const mapCaption = walkStop
    ? `You are here: ${routeStop(walkStop).title.toLowerCase()}. Stop ${walkStopIndex + 1} of ${interaction.kind === 'walk' ? interaction.stops.length : 0}.`
    : locationItem && !locationCommitted
      ? 'Where is the tip? Choose a place below.'
      : interaction.kind === 'simulator-task' &&
          lesson.sectionId === 'catheter-advancement' &&
          interaction.round === 0
        ? 'Confirm each place as the tracing settles there.'
        : catheterMapCaption(stops)

  const tipVisible = activeStep.chamberLabel === 'shown'

  const confirmPlaceOnMap = (choiceId: string) => {
    const position = choiceId as CatheterPosition
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
        selectedChoiceId: locationCommitted
          ? commitments.choices[activeStep.id]
          : (pendingChoice[activeStep.id] ?? null),
        onSelect: (choiceId) =>
          setPendingChoice((current) => ({ ...current, [activeStep.id]: choiceId })),
        disabled: locationCommitted || lookingBack,
        revealed: locationCommitted
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
          selectedChoiceId: null,
          onSelect: confirmPlaceOnMap,
          disabled: workDone,
          confirmed: confirmedPlaces,
          hint: 'After each move, wait for the tracing to settle, then confirm the place it says. A place is confirmed only when the tracing matches it.',
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
      case 'intervention':
        return unmet.id === 'reposition-catheter'
          ? 'deflate'
          : unmet.id === 'repeat-valid-thermodilution'
            ? 'inject'
            : 'level'
      default:
        return null
    }
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
  const stepPosition = `Step ${activeStep.ordinal} of ${lesson.steps.length} · ${STAGE_PHASE_LABELS[activeStep.phase]}`
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
          primary: { label: activeStep.actionLabel, onActivate: () => confirmThrough(activeIndex) },
        }
      case 'walk': {
        if (commitments.walkDone) {
          return { ...base, status: 'Every stop visited.', primary: continueAction }
        }
        const last = walkStopIndex >= interaction.stops.length - 1
        return {
          ...base,
          status: `Stop ${walkStopIndex + 1} of ${interaction.stops.length}.`,
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
        const committed = commitments.choices[activeStep.id] !== undefined
        if (committed) {
          return {
            ...base,
            primary: isLastStep
              ? {
                  label: 'Finish the section',
                  onActivate: finish,
                  icon: <ArrowRight aria-hidden="true" />,
                }
              : continueAction,
          }
        }
        return {
          ...base,
          status:
            interaction.round === 0
              ? 'The monitor keeps running while you decide. The controls unlock once you commit.'
              : undefined,
          primary: {
            label: activeStep.actionLabel,
            onActivate: () => commitChoice(activeStep),
            disabled: !pendingChoice[activeStep.id],
            disabledReason: interaction.mapTargets
              ? 'Choose a place on the catheter map to enable this.'
              : 'Choose one option to enable this.',
          },
        }
      }
      case 'sort': {
        if (commitments.sort) return { ...base, primary: continueAction }
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
      case 'simulator-task':
        if (workDone) {
          return { ...base, status: 'Done. The change is on the monitor.', primary: continueAction }
        }
        return {
          ...base,
          status:
            'Waiting for the work on the monitor. This step is done when every item below is met.',
          secondary: showWhereAction,
        }
      case 'observe':
        if (workDone) {
          return {
            ...base,
            status: 'Done.',
            primary: { ...continueAction, label: activeStep.actionLabel },
          }
        }
        return {
          ...base,
          status:
            goals.length > 0 && !goalsMetNow.every(Boolean)
              ? 'Waiting for the work on the monitor.'
              : 'Commit to each question below.',
          secondary: showWhereAction,
        }
      case 'explain':
        return {
          ...base,
          primary: isLastStep
            ? {
                label: activeStep.actionLabel,
                onActivate: finish,
                icon: <ArrowRight aria-hidden="true" />,
              }
            : {
                label: activeStep.actionLabel,
                onActivate: () => confirmThrough(activeIndex),
                icon: <ArrowRight aria-hidden="true" />,
              },
        }
      case 'provenance-drill':
      case 'derived-workbench':
      case 'derived-transfer':
      case 'disagreement':
        if (workDone) return { ...base, status: 'Done.', primary: continueAction }
        return {
          ...base,
          status:
            'Work through the surface beneath the monitor; this step is done when it says so.',
        }
      default:
        return base
    }
  })()

  /* ---------------------------------------------------------------- *
   * The Now card's body
   * ---------------------------------------------------------------- */
  const nowBody: ReactNode = (() => {
    if (lookingBack)
      return <StepRecap step={activeStep} lesson={lesson} commitments={commitments} state={state} />
    switch (interaction.kind) {
      case 'walk': {
        if (commitments.walkDone || !walkStop) return null
        const stop = routeStop(walkStop)
        return (
          <section className={styles.walk} data-walk-stop={stop.id} aria-label={stop.title}>
            <p className={styles.kicker}>
              Stop {stop.ordinal} · {stop.title}
            </p>
            <p className={styles.analogy}>{stop.analogy}</p>
            <dl>
              <div>
                <dt>On the monitor</dt>
                <dd>{stop.monitorLabel}.</dd>
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
      case 'prediction': {
        const committedId = commitments.choices[activeStep.id]
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
        if (interaction.mapTargets) {
          const chosen = interaction.item.choices.find((c) => c.id === pendingChoice[activeStep.id])
          return (
            <p className={stageStyles.taskInstruction} data-map-answer-note>
              Answer on the catheter map beneath the monitor: choose the place.
              {chosen ? ` Chosen: ${chosen.label}.` : ''}
            </p>
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
                  name={`hd-prediction-${activeStep.id}`}
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
      case 'derived-workbench': {
        const completion = derivedHemodynamicsSectionCompletion({
          signalValidationChecks: state.signalValidationChecks,
          measuredCalculatedSeparated: commitments.derivedSeparated,
          disagreementPreservedWithoutAveraging: commitments.derivedDisagreementPreserved,
          thresholdContextResolved: commitments.derivedThresholdResolved,
        })
        const rows: readonly { readonly label: string; readonly met: boolean }[] = [
          {
            label: 'Name every input one calculation depends on',
            met: completion.dependencyChainValidated,
          },
          {
            label: 'Withhold a value for the input that makes it unreadable',
            met: completion.withheldForValidity,
          },
          {
            label: 'Keep the values that input does not touch',
            met: completion.selectiveInvalidationPreserved,
          },
          {
            label: 'Trace a flow-dependent value to the method that produced it',
            met: completion.flowMethodTraced,
          },
          {
            label: 'Keep a two-method disagreement without averaging it',
            met: completion.disagreementPreservedWithoutAveraging,
          },
          {
            label: 'Read a boundary inside its context, not as a universal number',
            met: completion.thresholdContextResolved,
          },
        ]
        return (
          <ul className={stageStyles.taskList} data-step-goals aria-label="What to do">
            {rows.map((row) => (
              <li key={row.label} data-met={row.met}>
                {row.met ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
                <span>{row.label}</span>
              </li>
            ))}
          </ul>
        )
      }
      case 'sort':
        return (
          <QuestionSortControl
            sort={interaction.sort}
            draft={sortDraft}
            committed={commitments.sort}
            onChange={(rowId, originId) =>
              setSortDraft((current) => ({ ...current, [rowId]: originId }))
            }
          />
        )
      case 'simulator-task':
      case 'observe': {
        const wedgeCommitments = interaction.kind === 'observe' ? interaction.commitments : []
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
            {placeNote ? (
              <p className={stageStyles.taskInstruction} role="status" data-place-note>
                {placeNote}
              </p>
            ) : null}
            {interaction.kind === 'observe' && lesson.runtime.comparison === 'ventricle-artery' ? (
              <VentricleArtery state={state} />
            ) : null}
            {wedgeCommitments.includes('plausibility') ? (
              <CommitmentBlock
                title="Is the stored value plausible?"
                item={pawpPlausibilityCommitment}
                stepKey={`${activeStep.id}:${WEDGE_PLAUSIBILITY_KEY}`}
                pendingChoice={pendingChoice}
                setPendingChoice={setPendingChoice}
                committedId={commitments.choices[`${activeStep.id}:${WEDGE_PLAUSIBILITY_KEY}`]}
                onCommit={() =>
                  commitChoice(activeStep, `${activeStep.id}:${WEDGE_PLAUSIBILITY_KEY}`)
                }
                disabled={lookingBack}
              />
            ) : null}
            {goals.some((goal) => goal.type === 'reassessed') ? (
              <div className={styles.returnCheck} data-reassess>
                <p>
                  <strong>Reassess.</strong> Read the corrected pressures, the series and the
                  bedside picture together, as one set, before anything on the screen is believed
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
                onConfirm={() => dispatch({ type: 'VALIDATE_SIGNAL', check: PA_RETURN_CHECK })}
              />
            ) : null}
            {wedgeCommitments.includes('return') ? (
              <>
                <div className={styles.returnCheck} data-return-check>
                  <p>
                    <strong>Has the pulmonary-artery tracing come back?</strong> Look at the
                    monitor: the notch, the diastolic run-off, the pulsatility.
                  </p>
                  <button
                    type="button"
                    className={shellStyles.nowSecondary}
                    disabled={
                      state.signalValidationChecks.includes(PA_RETURN_CHECK) ||
                      state.catheter.position !== 'pa' ||
                      state.catheter.balloonInflated ||
                      state.catheter.forcedSafetyRecovery
                    }
                    onClick={() => dispatch({ type: 'VALIDATE_SIGNAL', check: PA_RETURN_CHECK })}
                  >
                    {state.signalValidationChecks.includes(PA_RETURN_CHECK)
                      ? 'The artery is back — confirmed'
                      : 'The artery is back'}
                  </button>
                </div>
                <CommitmentBlock
                  title="And if it had not come back?"
                  item={pawpRecoveryCommitment}
                  stepKey={`${activeStep.id}:${WEDGE_RETURN_KEY}`}
                  pendingChoice={pendingChoice}
                  setPendingChoice={setPendingChoice}
                  committedId={commitments.choices[`${activeStep.id}:${WEDGE_RETURN_KEY}`]}
                  onCommit={() => commitChoice(activeStep, `${activeStep.id}:${WEDGE_RETURN_KEY}`)}
                  disabled={lookingBack}
                />
              </>
            ) : null}
            {provenance ? (
              <ProvenanceCommitment
                resolved={commitments.provenanceResolved}
                onResolved={() =>
                  setCommitments((current) => ({ ...current, provenanceResolved: true }))
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
        const chosen =
          predictionStep && predictionStep.interaction.kind === 'prediction'
            ? predictionStep.interaction.item.choices.find(
                (c) => c.id === commitments.choices[predictionStep.id],
              )
            : undefined
        const before = snapshots[`before:${round}`]
        const after = snapshots[`after:${round}`]
        return (
          <>
            {chosen ? (
              <p
                className={stageStyles.taskInstruction}
                data-explain-recap
                data-verdict-outcome={chosen.plausibility === 'best' ? 'correct' : 'not-correct'}
              >
                <strong>{chosen.plausibility === 'best' ? 'Correct.' : 'Not correct.'}</strong> You
                predicted: {chosen.label}
              </p>
            ) : null}
            {lesson.runtime.comparison === 'ventricle-artery' ? (
              <VentricleArtery state={state} />
            ) : before && after && lesson.runtime.watch.length > 0 ? (
              <BeforeAfter before={before} after={after} watch={lesson.runtime.watch} />
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
  const contextItems: readonly ContextStripItem[] = [
    {
      label: 'Level',
      value: `${state.measurementSystem.transducerLevelCm > 0 ? '+' : ''}${state.measurementSystem.transducerLevelCm} cm`,
    },
    { label: 'Zero', value: state.measurementSystem.zeroed ? 'set' : 'not set' },
    { label: 'Scale', value: `0–${state.pressureScaleMmHg}` },
    {
      label: 'Tip',
      value: tipVisible ? positionWords(state.catheter.position) : 'not named on this step',
    },
    { label: 'Balloon', value: state.catheter.balloonInflated ? 'up' : 'down' },
  ]

  const controlsEnabled =
    !(interaction.kind === 'prediction' && commitments.choices[activeStep.id] === undefined) &&
    !lookingBack
  const lockedReason =
    interaction.kind === 'prediction' && commitments.choices[activeStep.id] === undefined
      ? 'The controls are locked while you decide. Commit your answer to take them.'
      : undefined

  const extraSurface: ReactNode = (() => {
    switch (interaction.kind) {
      case 'provenance-drill':
        return (
          <div className={styles.surfaceCard} data-surface="provenance-drill">
            <DerivedProvenanceDrill
              separated={commitments.derivedSeparated}
              onSeparated={() =>
                setCommitments((current) => ({ ...current, derivedSeparated: true }))
              }
            />
          </div>
        )
      case 'derived-workbench':
        return (
          <div className={styles.surfaceCard} data-surface="derived-workbench">
            <DerivedEpisodeWorkbench
              dispatch={dispatch}
              checks={state.signalValidationChecks}
              disagreementPreserved={commitments.derivedDisagreementPreserved}
              onDisagreementPreserved={() =>
                setCommitments((current) => ({ ...current, derivedDisagreementPreserved: true }))
              }
              thresholdContextResolved={commitments.derivedThresholdResolved}
              onThresholdContextResolved={() =>
                setCommitments((current) => ({ ...current, derivedThresholdResolved: true }))
              }
            />
          </div>
        )
      case 'derived-transfer':
        return (
          <div className={styles.surfaceCard} data-surface="derived-transfer">
            <DerivedTransferComparison />
            {!commitments.derivedTransferDone ? (
              <button
                type="button"
                className={shellStyles.nowSecondary}
                onClick={() =>
                  setCommitments((current) => ({ ...current, derivedTransferDone: true }))
                }
              >
                I have chosen and read the comparison
              </button>
            ) : null}
          </div>
        )
      case 'disagreement':
        return (
          <div className={styles.surfaceCard} data-surface="disagreement">
            <CardiacOutputDisagreementLab
              onDisagreementResolved={() =>
                setCommitments((current) => ({ ...current, disagreementResolved: true }))
              }
            />
          </div>
        )
      default:
        return null
    }
  })()

  const simulator = (
    <HemodynamicsSimulatorPane
      state={state}
      dispatch={dispatch}
      surface={activeStep.surface}
      flushLine={activeStep.flushLine}
      controlsEnabled={controlsEnabled}
      lockedReason={lockedReason}
      chamberLabel={activeStep.chamberLabel}
      stops={stops}
      mapCaption={mapCaption}
      mapAnswer={mapAnswer}
      tipVisible={tipVisible}
    >
      {extraSurface}
    </HemodynamicsSimulatorPane>
  )

  const teaching = (
    <StageTeachingScope
      value={{ phase: activeStep.phase, predictionCommitted, stepId: activeStep.id }}
    >
      <HemodynamicsTeachingColumn
        lesson={lesson}
        step={activeStep}
        stops={walkStop ? [walkStop] : activeStep.stops}
        provenanceResolved={commitments.provenanceResolved}
      />
    </StageTeachingScope>
  )

  const completionLead =
    pairing.kind === 'mechanism-match'
      ? 'The reasoning has been worked through. Apply it to the paired case in Practice, starting fresh with less prompting.'
      : 'The reasoning has been worked through. A case in this part of the pathway is ready in Practice.'

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
        recapFor={(index) => recapLines(lesson.steps[index], commitments, state)}
        onSelect={selectStepRow}
      />
      {finished ? (
        <section
          className={stageStyles.completion}
          role="status"
          aria-live="polite"
          data-stage-completion
        >
          <h3>Section worked through</h3>
          <p>{completionLead}</p>
          {pairing.kind === 'next-in-unit' ? (
            <p data-practice-pairing-note>It applies a different mechanism from this section.</p>
          ) : null}
          <div className={stageStyles.completionActions}>
            <button
              type="button"
              className={shellStyles.nowPrimary}
              data-practice-pairing={pairing.kind}
              onClick={() =>
                router.push({
                  pathname: `${icuHemodynamicsNavBase}/practice`,
                  query: { case: pairing.caseId },
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
                Go to the challenge
              </button>
            )}
          </div>
        </section>
      ) : null}
    </>
  )

  const header = (
    <SectionHeader
      breadcrumb={{ href: icuHemodynamicsNavBase, label: 'ICU Hemodynamics' }}
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
      restartLabel="Restart section"
      saveAndExitHref={icuHemodynamicsNavBase}
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
    >
      <StageSourcesScope>
        <StageLayout
          stageId={activeStep.id}
          label="Guided ICU hemodynamics section"
          module="icu-hemodynamics"
          workspaceLabel="Hemodynamics lesson workspace: monitor, teaching, and steps"
          header={header}
          contextStrip={<ContextStrip items={contextItems} badge="Simulated values" />}
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
                <HemodynamicsSourceList
                  records={stageSources.records}
                  claimsVisible={predictionCommitted}
                />
              </StageSourcesFooter>
            </>
          }
          overlay={helpDialog}
        />
      </StageSourcesScope>
    </IcuHemodynamicsModuleFrameV2>
  )
}

/* ------------------------------------------------------------------ *
 * Pieces
 * ------------------------------------------------------------------ */

function CommitmentBlock({
  title,
  item,
  stepKey,
  pendingChoice,
  setPendingChoice,
  committedId,
  onCommit,
  disabled,
}: {
  readonly title: string
  readonly item: Parameters<typeof AnswerVerdict>[0]['item']
  readonly stepKey: string
  readonly pendingChoice: Record<string, string>
  readonly setPendingChoice: (
    update: (current: Record<string, string>) => Record<string, string>,
  ) => void
  readonly committedId: string | undefined
  readonly onCommit: () => void
  readonly disabled: boolean
}) {
  const selected = pendingChoice[stepKey] ?? null
  return (
    <section className={styles.commitment} data-commitment={stepKey} aria-label={title}>
      <p className={styles.kicker}>{title}</p>
      {committedId ? (
        <AnswerVerdict
          item={item}
          choiceId={committedId}
          outcome="stated"
          timing="immediate-after-commit"
          theme="dark"
        />
      ) : (
        <>
          <fieldset className={stageStyles.choiceList} data-prediction-choices disabled={disabled}>
            <legend>{item.stem}</legend>
            {orderChoices(item.id, item.choices).map((choice) => (
              <label
                key={choice.id}
                className={stageStyles.choice}
                data-selected={selected === choice.id}
              >
                <input
                  type="radio"
                  name={`hd-commit-${stepKey}`}
                  value={choice.id}
                  checked={selected === choice.id}
                  onChange={() =>
                    setPendingChoice((current) => ({ ...current, [stepKey]: choice.id }))
                  }
                />
                <span>{choice.label}</span>
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            className={shellStyles.nowSecondary}
            disabled={!selected || disabled}
            onClick={onCommit}
          >
            Commit this answer
          </button>
        </>
      )}
    </section>
  )
}

function ReturnCheck({
  state,
  onConfirm,
}: {
  readonly state: HemodynamicSimulationState
  readonly onConfirm: () => void
}) {
  const confirmed = state.signalValidationChecks.includes(PA_RETURN_CHECK)
  return (
    <div className={styles.returnCheck} data-return-check>
      <p>
        <strong>Has the pulmonary-artery tracing come back?</strong> Look at the monitor: the notch,
        the diastolic run-off, the pulsatility.
      </p>
      <button
        type="button"
        className={shellStyles.nowSecondary}
        disabled={
          confirmed ||
          state.catheter.position !== 'pa' ||
          state.catheter.balloonInflated ||
          state.catheter.forcedSafetyRecovery
        }
        onClick={onConfirm}
      >
        {confirmed ? 'The artery is back — confirmed' : 'The artery is back'}
      </button>
    </div>
  )
}

function ProvenanceCommitment({
  resolved,
  onResolved,
}: {
  readonly resolved: boolean
  readonly onResolved: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [committed, setCommitted] = useState<string | null>(null)
  const choice = CARDIAC_OUTPUT_PROVENANCE_CHOICES.find((candidate) => candidate.id === committed)
  return (
    <section
      className={styles.commitment}
      data-commitment="provenance"
      aria-label="Which result was measured?"
    >
      <p className={styles.kicker}>Which result was measured?</p>
      <fieldset className={stageStyles.choiceList} data-prediction-choices disabled={resolved}>
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
              checked={selected === candidate.id}
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
        </p>
      ) : null}
      {!resolved ? (
        <button
          type="button"
          className={shellStyles.nowSecondary}
          disabled={!selected}
          onClick={() => {
            if (!selected) return
            setCommitted(selected)
            const candidate = CARDIAC_OUTPUT_PROVENANCE_CHOICES.find((c) => c.id === selected)
            if (candidate?.isDefensible) onResolved()
          }}
        >
          {committed ? 'Commit again' : 'Commit this answer'}
        </button>
      ) : null}
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

function recapLines(
  step: HemodynamicsStageStep | undefined,
  commitments: StageCommitments,
  state: HemodynamicSimulationState,
): readonly string[] {
  if (!step) return []
  switch (step.interaction.kind) {
    case 'prediction': {
      const choice = step.interaction.item.choices.find(
        (c) => c.id === commitments.choices[step.id],
      )
      return choice ? [`You chose: ${choice.label}`] : ['Answer recorded.']
    }
    case 'walk':
      return step.interaction.stops.map((stopId) => routeStop(stopId).title)
    case 'sort':
      return commitments.sort
        ? [`${Object.keys(commitments.sort).length} questions placed.`]
        : ['Placed.']
    case 'simulator-task':
      return step.interaction.goals.map(stageGoalLabel)
    case 'observe':
      return [
        ...step.interaction.goals.map(stageGoalLabel),
        ...(step.interaction.commitments.length > 0 ? ['Committed to the questions.'] : []),
      ]
    case 'explain':
      return [`The tip: ${positionWords(state.catheter.position)}.`]
    default:
      return step.expectedResponse ?? []
  }
}

function StepRecap({
  step,
  lesson,
  commitments,
  state,
}: {
  readonly step: HemodynamicsStageStep
  readonly lesson: ReturnType<typeof hemodynamicsStageLesson>
  readonly commitments: StageCommitments
  readonly state: HemodynamicSimulationState
}) {
  void lesson
  const lines = recapLines(step, commitments, state)
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
