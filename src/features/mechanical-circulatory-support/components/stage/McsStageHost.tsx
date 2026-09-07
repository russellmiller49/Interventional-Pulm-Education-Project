'use client'

import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, SlidersHorizontal } from 'lucide-react'

import { recordCriticalCareActivitySelection } from '@/features/critical-care/progress/selection'
import { useCriticalCareActivityAnalytics } from '@/features/learning-module/activity'
import { ChoiceReasoningFeedback } from '@/features/learning-module/components/ChoiceReasoningFeedback'
import { nextPathwaySection } from '@/features/learning-module/curriculum/types'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import { ContextStrip, type ContextStripItem } from '@/features/learning-module/stage/ContextStrip'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { NowCard, type NowCardModel } from '@/features/learning-module/stage/NowCard'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { SectionsDrawer } from '@/features/learning-module/stage/SectionsDrawer'
import { StageLayout } from '@/features/learning-module/stage/StageLayout'
import {
  STAGE_PHASE_LABELS,
  canEnterStep,
  type StagePhase,
} from '@/features/learning-module/stage/stageModel'
import { StageSourcesFooter } from '@/features/learning-module/stage/StageSourcesFooter'
import { StageSourcesScope } from '@/features/learning-module/stage/StageSourcesScope'
import { StageTeachingScope } from '@/features/learning-module/stage/StageTeachingScope'
import { StepList } from '@/features/learning-module/stage/StepList'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'
import { recordSiteModuleEvent } from '@/lib/analytics'
import { useRouter } from '@/i18n/navigation'

import { MCS_ANALYTICS_MODULE_ID } from '../../content/release'
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
import {
  createInitialMcsState,
  mcsProgressPercent,
  mcsReducer,
  readMcsProgress,
  recordMcsLessonComplete,
  writeMcsProgress,
} from '../../engine'
import type { McsAction, McsDerivedMetrics, McsSimulationState } from '../../engine/types'
import type {
  CirculationMapAnswer,
  CirculationMapEmphasis,
} from '../circulation-map/CirculationMap'
import { McsModuleFrame } from '../McsModuleFrame'
import { McsSimulatorPane } from './McsSimulatorPane'
import { McsSourceList } from './McsSourceList'
import { McsStoryProblems } from './McsStoryProblems'
import { McsTeachingColumn } from './McsTeachingColumn'
import styles from './mcs-stage.module.css'

/**
 * One section of the mechanical-circulatory-support pathway on the lesson stage.
 *
 * The session is the module's own reducer, mounted once for the section and fed by every pane:
 * the contract's starting state on entry, the controls on the Act step, the transfer patient on
 * entry to the last step. The six phases of the contract are the six steps of the stage's one
 * progression. Exactly one thing is persisted, and only when the transfer answer is committed and
 * its required work done: this section's id, marking it worked. Opening, reading, navigating and
 * predicting write nothing.
 *
 * Commitment is the sole reveal authority: derived from the committed prediction and from nothing
 * else — not the step, not the URL, not stored progress.
 */

const LOOKING_BACK =
  'You are looking back at an earlier step; nothing you have worked through is lost.'

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
  readonly index: number
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
  let state = createInitialMcsState('learn', lesson.startingDevice)
  for (const action of lesson.contract.startingActions) state = mcsReducer(state, action)
  return state
}

export function McsStageHost({
  sectionId,
  initialPhase = 'recognize',
  locale = 'en',
}: {
  readonly sectionId: string
  /** The phase the URL asked for. Nothing about it is persisted. */
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

  const [state, dispatch] = useReducer(mcsReducer, lesson, initialSession)
  const [progression, setProgression] = useState<Progression>(() => ({
    index: mount.index,
    furthestPerformed: mount.index - 1,
    furthestEntered: mount.index,
    performedIds: lesson.steps.slice(0, mount.index).map((step) => step.id),
    review: null,
    walkStopIndex: 0,
    choiceByStepId: {},
    committedByStepId: {},
    sortByStepId: {},
    sortCommittedStepIds: [],
    beforeMetrics: null,
    surfacesByStepId: {},
    expandedTeachingStepId: null,
    transferLoaded: false,
  }))
  const [helpOpen, setHelpOpen] = useState(false)
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const nowFocusRef = useRef<HTMLDivElement>(null)

  const activeIndex = Math.min(progression.index, lesson.steps.length - 1)
  const activeStep = lesson.steps[activeIndex]
  const performedIds = useMemo(() => new Set(progression.performedIds), [progression.performedIds])
  const stepPerformed = performedIds.has(activeStep.id)
  const isLastStep = activeIndex === lesson.steps.length - 1
  const predictionStep = lesson.steps[lesson.predictionStepIndex]
  const predictionCommitted =
    predictionStep !== undefined && progression.committedByStepId[predictionStep.id] !== undefined
  const lookingBack = activeIndex < progression.furthestEntered
  const selectedChoiceId = progression.choiceByStepId[activeStep.id] ?? null
  const committedChoiceId = progression.committedByStepId[activeStep.id] ?? null

  const lifecycleAnalytics = useCriticalCareActivityAnalytics({
    moduleId: 'mechanical-circulatory-support',
    activityId: lesson.lifecycleActivityId,
    mode: 'guided',
    phase: activeStep.phase,
    enabled: true,
  })

  /* ---------------------------------------------------------------- *
   * The session clock, the resume pointer, the URL
   * ---------------------------------------------------------------- */

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const intervalMs = reducedMotion ? 500 : 250
    const timer = window.setInterval(
      () => dispatch({ type: 'TICK', seconds: intervalMs / 1000 }),
      intervalMs,
    )
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      recordCriticalCareActivitySelection(window.localStorage, {
        activityId: lesson.lifecycleActivityId,
        mode: 'guided',
        query: { lesson: sectionId },
        payloadVersion: 'mcs-selection-v1',
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [lesson.lifecycleActivityId, sectionId])

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

  function enterStep(index: number, performedNow: readonly string[]) {
    const nextStep = lesson.steps[index]
    if (!nextStep) return
    /*
     * The transfer patient loads when the transfer step is first entered. It is a different
     * patient with a different loading, so nothing in the section's own state is carried into it.
     */
    if (nextStep.interaction.kind === 'transfer' && !progression.transferLoaded) {
      dispatch({ type: 'OPEN_STUDIO', device: lesson.transfer.setupDevice })
      for (const action of lesson.transfer.setupActions) dispatch(action)
      // The build is not the learner's work: a transfer patient set up with the very control the
      // learner is then asked to move would otherwise arrive with that work already recorded.
      dispatch({ type: 'CLEAR_ACTION_LOG' })
    }
    setProgression((current) => ({
      ...current,
      index,
      review: null,
      performedIds: performedNow,
      furthestEntered: Math.max(current.furthestEntered, index),
      furthestPerformed: Math.max(current.furthestPerformed, index - 1),
      transferLoaded: current.transferLoaded || nextStep.interaction.kind === 'transfer',
      // Entering Act freezes the readings the observation is compared against.
      beforeMetrics:
        nextStep.interaction.kind === 'action' && current.beforeMetrics === null
          ? state.metrics
          : current.beforeMetrics,
    }))
  }

  function advance() {
    const performedNow = recordPerformed(activeStep.id)
    const next = activeIndex + 1
    if (next >= lesson.steps.length) {
      setProgression((current) => ({
        ...current,
        performedIds: performedNow,
        furthestPerformed: Math.max(current.furthestPerformed, activeIndex),
      }))
      return
    }
    if (!canEnterStep(lesson, next, activeIndex, predictionCommitted)) return
    enterStep(next, performedNow)
  }

  function commitChoice() {
    if (!selectedChoiceId || stepPerformed) return
    const kind = activeStep.interaction.kind
    if (kind !== 'identify' && kind !== 'prediction' && kind !== 'transfer') return
    const performedNow = recordPerformed(activeStep.id)
    setProgression((current) => ({
      ...current,
      committedByStepId: { ...current.committedByStepId, [activeStep.id]: selectedChoiceId },
      performedIds: performedNow,
      furthestPerformed: Math.max(current.furthestPerformed, activeIndex),
    }))
    if (kind === 'prediction') lifecycleAnalytics.recordPredictionSubmitted()
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

  function selectStepRow(index: number) {
    setProgression((current) => {
      if (index === current.index) return current
      if (!current.performedIds.includes(lesson.steps[index]?.id ?? '')) return current
      return { ...current, review: current.review === index ? null : index }
    })
  }

  /**
   * Back to a step already worked, on the learner's own request. The performed set is carried
   * through untouched, so the section does not lose its progress; the simulation is left as it
   * is, because on this stage every step reads the live circulation.
   */
  function goToStep(index: number) {
    const target = lesson.steps[index]
    if (!target || index === progression.index) return
    if (!performedIds.has(target.id)) return
    enterStep(index, progression.performedIds)
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
   * Completion: the one thing persisted
   * ---------------------------------------------------------------- */

  const transferCommitted = transferStep
    ? progression.committedByStepId[transferStep.id] !== undefined
    : false
  const transferWorkDone = lesson.transfer.requiredActionIds.every((id) =>
    state.actionIds.includes(id),
  )
  const sectionWorkedThrough = transferCommitted && transferWorkDone
  const completionRecorded = useRef(false)
  useEffect(() => {
    if (!sectionWorkedThrough || completionRecorded.current) return
    completionRecorded.current = true
    const current = readMcsProgress()
    const device = lesson.contract.startingDevice
    const next = current.completedLessonIds.includes(sectionId)
      ? current
      : recordMcsLessonComplete(current, sectionId, device)
    writeMcsProgress(next)
    lifecycleAnalytics.recordTransferCompleted()
    lifecycleAnalytics.recordGoalMet()
    lifecycleAnalytics.recordActivityCompleted()
    recordSiteModuleEvent({
      eventType: 'section_completed',
      moduleId: MCS_ANALYTICS_MODULE_ID,
      section: 'learn',
      percentComplete: mcsProgressPercent(next),
      eventPayload: { deviceTrack: device, station: sectionId, completion: 'complete' },
    })
  }, [lesson.contract.startingDevice, lifecycleAnalytics, sectionId, sectionWorkedThrough])

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
    setProgression((current) => ({ ...current, walkStopIndex: current.walkStopIndex + 1 }))
  }

  /* ---------------------------------------------------------------- *
   * The map: what is lit, and whether it is the answer surface
   * ---------------------------------------------------------------- */

  const mapTargets = mcsMapAnswerTargets(sectionId)
  const identifyOnMap =
    activeStep.interaction.kind === 'identify' &&
    activeStep.interaction.onMap &&
    mapTargets !== null
  const identifyCommitted = committedChoiceId !== null
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
            setProgression((current) => ({
              ...current,
              choiceByStepId: { ...current.choiceByStepId, [activeStep.id]: optionId },
            })),
        }
      : null

  const litStopIds: readonly McsSpineStopId[] =
    walking && walkStop ? [walkStop.id] : activeStep.stopIds
  const emphasis: CirculationMapEmphasis | null = (() => {
    // While a place is the question, nothing on the map is lit: a lit stop is a hint.
    if (identifyOnMap && !identifyCommitted) return null
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
  const previousStep = activeIndex > 0 ? lesson.steps[activeIndex - 1] : undefined
  const canGoBack = previousStep !== undefined && performedIds.has(previousStep.id)
  const withLookingBack = (own: string) => (lookingBack ? `${own} ${LOOKING_BACK}` : own)

  const continueAction = {
    label: 'Continue',
    onActivate: advance,
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
    const { interaction } = activeStep
    switch (interaction.kind) {
      case 'walk':
        return stepPerformed
          ? {
              ...base,
              status: withLookingBack('Walked.'),
              primary: isLastStep ? undefined : continueAction,
            }
          : {
              ...base,
              primary: {
                label: walkIsLast ? 'Continue' : 'Next stop',
                onActivate: nextWalkStop,
                icon: <ArrowRight aria-hidden="true" />,
              },
            }
      case 'identify':
        return stepPerformed
          ? { ...base, status: withLookingBack('Answered.'), primary: continueAction }
          : {
              ...base,
              primary: {
                label: activeStep.actionLabel,
                onActivate: commitChoice,
                disabled: selectedChoiceId === null,
                disabledReason: 'Choose one option to enable this.',
                icon: <SlidersHorizontal aria-hidden="true" />,
              },
            }
      case 'prediction':
        return stepPerformed
          ? { ...base, status: withLookingBack('Committed.') }
          : {
              ...base,
              primary: {
                label: activeStep.actionLabel,
                onActivate: commitChoice,
                disabled: selectedChoiceId === null,
                disabledReason: 'Choose one option to enable this.',
                icon: <SlidersHorizontal aria-hidden="true" />,
              },
            }
      case 'action': {
        const satisfied = interaction.isSatisfied(state)
        return stepPerformed
          ? { ...base, status: withLookingBack('Done.'), primary: continueAction }
          : {
              ...base,
              status: satisfied
                ? interaction.mode === 'inspect-only'
                  ? 'Done. Each of the readings has been opened.'
                  : 'Done. The circulation holds the change you were asked for.'
                : interaction.mode === 'inspect-only'
                  ? 'Done once each of the readings has been opened.'
                  : 'Done once the circulation reaches the state you were asked for.',
              primary: {
                ...continueAction,
                disabled: !satisfied,
                disabledReason:
                  interaction.mode === 'inspect-only'
                    ? 'Open each reading to enable this.'
                    : 'Make the change on the controls to enable this.',
              },
            }
      }
      case 'observe':
        return stepPerformed
          ? { ...base, status: withLookingBack('Read.'), primary: continueAction }
          : { ...base, primary: continueAction }
      case 'explain': {
        const sort = interaction.sort
        if (sort && !progression.sortCommittedStepIds.includes(activeStep.id)) {
          const answers = progression.sortByStepId[activeStep.id] ?? {}
          const unanswered = sort.candidates.filter((candidate) => !answers[candidate.id]).length
          return {
            ...base,
            primary: {
              label: 'Commit these answers',
              onActivate: commitSort,
              disabled: unanswered > 0,
              disabledReason:
                unanswered === 1
                  ? 'One item still needs a place.'
                  : `${unanswered} items still need a place.`,
              icon: <SlidersHorizontal aria-hidden="true" />,
            },
          }
        }
        return stepPerformed
          ? { ...base, status: withLookingBack('Read.'), primary: continueAction }
          : { ...base, primary: continueAction }
      }
      case 'transfer':
        if (sectionWorkedThrough) {
          return { ...base, status: withLookingBack('Done. This section has been worked through.') }
        }
        if (transferCommitted) {
          return {
            ...base,
            status:
              'Answered. Now do the work in the new patient: the section is worked through once it is done.',
          }
        }
        return {
          ...base,
          primary: {
            label: activeStep.actionLabel,
            onActivate: commitChoice,
            disabled: selectedChoiceId === null,
            disabledReason: 'Choose one option to enable this.',
            icon: <SlidersHorizontal aria-hidden="true" />,
          },
        }
      default:
        return { ...base, primary: continueAction }
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
                  explanation={interaction.item.explanation}
                  evidenceIds={interaction.item.evidenceIds}
                />
                <p className={styles.reasoning} data-prediction-reasoning>
                  {interaction.reasoning}
                </p>
                <button
                  type="button"
                  className={shellStyles.nowPrimary}
                  onClick={advance}
                  data-verdict-continue
                >
                  Continue
                </button>
              </div>
            ) : null}
          </>
        )
      }
      case 'action': {
        const target = interaction.targetControl
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
                  ? 'Use the control below.'
                  : `Open the controls beside the monitor; it is the highlighted one.`}
              </p>
            ) : null}
            {guidedActionButtons(
              interaction.allowedActions.map((id) => mcsLearnControls[id].actionId),
              interaction.targetControl,
            )}
            {state.responseMessage ? (
              <p className={styles.response} role="status" aria-live="polite" data-response-message>
                {state.responseMessage}
              </p>
            ) : null}
          </div>
        )
      }
      case 'observe':
        return (
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
                const before = progression.beforeMetrics?.[signal.key] ?? null
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
        )
      case 'explain': {
        const sort = interaction.sort
        if (!sort) return null
        const answers = progression.sortByStepId[activeStep.id] ?? {}
        const revealed = progression.sortCommittedStepIds.includes(activeStep.id)
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
                      <strong data-sort-outcome-label>{right ? 'Correct.' : 'Not correct.'}</strong>{' '}
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
                  explanation={transfer.item.explanation}
                  evidenceIds={transfer.item.evidenceIds}
                />
              </div>
            ) : null}
            <div className={styles.transferWork} data-transfer-work data-met={transferWorkDone}>
              <p>
                <strong>Then work it in the new patient.</strong> {transfer.requiredActionLabel}
              </p>
              {guidedActionButtons(transfer.requiredActionIds)}
              {needsControls ? (
                <p>Open the controls beside the monitor; the one to use is highlighted.</p>
              ) : null}
              <p role="status" aria-live="polite" data-transfer-work-status>
                {transferWorkDone ? 'Done in the new patient.' : 'Not yet done in the new patient.'}
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
  const flowAccountWithheld = lesson.spec.withholdsFlowAccountUntilCommit && !predictionCommitted
  const contextItems: ContextStripItem[] = [
    { label: 'Mechanism', value: mechanismLabel(state) },
    { label: 'Setting', value: settingLabel(state) },
    {
      label: 'Displayed flow',
      value: flowAccountWithheld ? 'covered until you commit' : displayedFlowLabel(state),
    },
    { label: 'Mean pressure', value: `${state.metrics.mapMmHg} mm Hg` },
  ]
  const alarm = activeAlarm
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
      state={state}
      dispatch={dispatch}
      predictionCommitted={predictionCommitted}
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
    !predictionCommitted && (activeStep.phase === 'recognize' || activeStep.phase === 'predict')
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
        value={{ phase: activeStep.phase, predictionCommitted, stepId: activeStep.id }}
      >
        <McsTeachingColumn
          lesson={lesson}
          step={activeStep}
          state={state}
          predictionCommitted={predictionCommitted}
          flowAccountWithheld={flowAccountWithheld}
          beforeMetrics={progression.beforeMetrics}
          walkStop={walkStop}
          litStopIds={identifyOnMap && !identifyCommitted ? [] : litStopIds}
        />
      </StageTeachingScope>
    </div>
  )

  const stories = mcsStageStories(sectionId)
  const stageSources = useMemo(() => mcsStageSources(sectionId), [sectionId])

  const task = (
    <>
      <div ref={nowFocusRef} tabIndex={-1} data-now-focus>
        <NowCard model={nowModel}>{nowBody}</NowCard>
      </div>
      {predictionCommitted &&
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
      <StepList
        lesson={lesson}
        currentIndex={activeIndex}
        furthestPerformedIndex={progression.furthestPerformed}
        performedStepIds={performedIds}
        predictionCommitted={predictionCommitted}
        reviewIndex={progression.review}
        recapFor={(index) => {
          const step = lesson.steps[index]
          if (!step) return []
          const committed = progression.committedByStepId[step.id]
          if (step.interaction.kind === 'identify') {
            const option = step.interaction.options.find((candidate) => candidate.id === committed)
            return option ? [`You chose: ${option.label}`] : []
          }
          if (step.interaction.kind === 'prediction') {
            const choice = step.interaction.item.choices.find(
              (candidate) => candidate.id === committed,
            )
            return choice ? [`You chose: ${choice.label}`] : []
          }
          if (step.interaction.kind === 'transfer') {
            const choice = step.interaction.transfer.item.choices.find(
              (candidate) => candidate.id === committed,
            )
            return choice ? [`You chose: ${choice.label}`] : []
          }
          if (step.interaction.kind === 'walk') return ['Walked every stop of the loop.']
          return []
        }}
        onSelect={selectStepRow}
      />
      {predictionCommitted ? null : (
        <p className={shellStyles.nowStatus} data-phase-lock-note>
          The later steps unlock when you commit your prediction.
        </p>
      )}
      {sectionWorkedThrough ? (
        <section
          className={stageStyles.completion}
          role="status"
          aria-live="polite"
          data-stage-completion
        >
          <h3>Section worked through</h3>
          <p>
            This records that you worked the section, not that you are ready to operate these
            devices. Continue to the next section to keep building on it.
          </p>
          <div className={stageStyles.completionActions}>
            {nextSection ? (
              <button
                type="button"
                className={shellStyles.nowPrimary}
                onClick={() => goToSection(nextSection.id)}
              >
                Continue to next section: {nextSection.title}
                <ArrowRight aria-hidden="true" />
              </button>
            ) : null}
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
        lifecycleAnalytics.recordHintUsed()
      }}
      onRestart={onRestart}
      restartLabel="Restart section"
      saveAndExitHref={mechanicalCirculatorySupportNavBase}
      resumedNote={
        mount.clamped
          ? `This section takes a prediction before its later steps, so it opened at the predict step with a clean state. The ${requestedPhase} step unlocks when you commit.`
          : mount.index > 0
            ? `Opened at the ${requestedPhase} step with a clean state. Earlier choices were not restored.`
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
      <p>{activeStep.instruction}</p>
      {activeStep.rationale && predictionCommitted ? <p>{activeStep.rationale}</p> : null}
    </HelpDialog>
  )

  return (
    <McsModuleFrame
      locale={locale}
      activeHref={`${mechanicalCirculatorySupportNavBase}/learn`}
      activityMode
    >
      <StageSourcesScope>
        <div className={styles.stage} data-mcs-stage data-section-id={sectionId}>
          <StageLayout
            stageId={activeStep.id}
            label="Mechanical circulatory support section"
            module="mechanical-circulatory-support"
            workspaceLabel="Mechanical circulatory support lesson workspace: simulator, teaching, and steps"
            header={header}
            contextStrip={
              <ContextStrip items={contextItems} alarm={alarm} badge="Simulated values" />
            }
            simulator={simulator}
            teaching={teaching}
            task={task}
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
                  claimsVisible={predictionCommitted}
                >
                  <McsSourceList
                    sourceIds={stageSources.sourceIds}
                    claimsVisible={predictionCommitted}
                  />
                </StageSourcesFooter>
              </>
            }
            overlay={helpDialog}
          />
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
