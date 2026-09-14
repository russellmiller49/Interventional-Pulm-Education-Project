'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, Circle, LocateFixed } from 'lucide-react'

import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { nextPathwaySection } from '@/features/learning-module/curriculum/types'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import type { NowCardAction } from '@/features/learning-module/stage/NowCard'
import { STAGE_PHASE_LABELS } from '@/features/learning-module/stage/stageModel'
import { StageSourcesFooter } from '@/features/learning-module/stage/StageSourcesFooter'
import { StageSourcesScope } from '@/features/learning-module/stage/StageSourcesScope'
import { StageTeachingScope } from '@/features/learning-module/stage/StageTeachingScope'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'
import { Link } from '@/i18n/navigation'

import { imagingCaseById } from '../../content/cases'
import { microCasesForSection } from '../../content/microCases'
import { isOffChainTarget } from '../../content/chainAnswerTargets'
import { chainCaption, type ChainStopId } from '../../content/imagingChain'
import { peripheralImagingPathway } from '../../content/pathway'
import { imagingSectionLinkTarget } from '../../content/pathwayResolver'
import {
  PERIPHERAL_IMAGING_INTEGRATED_CASES_HREF,
  PERIPHERAL_IMAGING_LEARN_HREF,
  imagingCaseLinkTarget,
  integratedCaseLinkTarget,
} from '../../content/routes'
import {
  imagingStageLesson,
  type ImagingStageLesson,
  type ImagingStageStep,
} from '../../content/stageLessons'
import { imagingStageSources } from '../../content/stageSources'
import { independentValues } from '../../content/teachingExamples'
import { labGoalMet, type LabGoal } from '../../engine/labGoalEvaluation'
import {
  formatReadout,
  LAB_METRICS,
  type LabMetricId,
  type LabReadouts,
  type LabState,
} from '../../engine/labMetrics'
import {
  markImagingSectionReviewed,
  recordImagingLocation,
  setImagingSectionReviewLater,
} from '../../engine/selfPacedProgress'
import { deriveStageProgress, stepWorkDone } from '../../engine/stageSession'
import { ImagingExplanation } from '../ImagingExplanation'
import { PeripheralImagingModuleFrame } from '../PeripheralImagingModuleFrame'
import { ImagingSuitePane } from '../suite/ImagingSuitePane'
import {
  controlElementId,
  type ChainAnswer,
  type SuiteViewMemory,
  type SuiteViewSpec,
} from '../suite/types'
import { useImagingProgress } from '../useImagingProgress'
import { ChainWalkCard, walkPositionWords } from './ChainWalkCard'
import { ImagingActivityShell, type ImagingNowModel } from './ImagingActivityShell'
import { ImagingSortControl } from './ImagingSortControl'
import { ImagingSourceList } from './ImagingSourceList'
import { ImagingTeachingColumn } from './ImagingTeachingColumn'
import { LessonDemonstration } from './LessonDemonstration'
import { IndependentImagePanels, hasIndependentImagePanel } from './TeachingPanels'
import { useImagingStageSession } from './useImagingStageSession'
import styles from './imaging-stage.module.css'

/**
 * One section of the peripheral-imaging pathway on the lesson stage, at the learner's pace.
 *
 * The lab is the authority on the hands-on work: a step's goals are predicates over its values and
 * history. The host owns the commitments — which answer was checked, which set was placed, which
 * stop of the walk is current — and the view around them: the step the learner is looking back at,
 * the choice not yet checked, which explanations are open, whether help is open, and the Now card
 * that makes every step one thing.
 *
 * Self-paced (PI-01). Every step can be left: Continue when its work is done, or skip it, which
 * moves the learner on without performing it, answering it, capturing anything or taking a readout.
 * Every check can show its explanation before an answer. Real model constraints stay: a lab step
 * counts as done only when its goals are met on a loaded image, and a check's example image stays
 * fixed while it is being read. Nothing about an answer is saved. The section writes only that it
 * was opened and, when the learner finishes it, that they marked it reviewed.
 */
export function ImagingStageHost({
  sectionId,
  locale = 'en',
}: {
  readonly sectionId: string
  readonly locale?: string
}) {
  const [restartCount, setRestartCount] = useState(0)
  return (
    <ImagingStageSession
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
const METRIC_CONTROL: Readonly<Partial<Record<LabMetricId, string>>> = {
  separationMm: 'orbit',
  depthMm: 'depth',
  irradiatedAreaPct: 'field',
  masPerSecond: 'width',
  interFrameTravelMm: 'speed',
  centered: 'offsetX',
  ready: 'target',
  captured: 'captured',
  windowIntersects: 'tipX',
  contourStale: 'shift',
  inverseSquareRatio: 'distance',
  kapGyCm2: 'area',
}

const EVENT_CONTROL: Readonly<Record<string, string>> = {
  'overlap-seen': 'orbit',
  'separation-seen': 'orbit',
  'plane-tool-visited': 'plane',
  'plane-lesion-visited': 'plane',
  'plane-deeper-visited': 'plane',
  'moved-after-capture': 'offsetX',
  'window-slices-visited': 'slicesTarget',
  'slab-compared': 'slab',
  'contour-captured': 'capture',
  'contour-recaptured': 'capture',
  'ray-cleared': 'orbit',
}

function goalControlKey(goal: LabGoal): string | null {
  switch (goal.type) {
    case 'value':
    case 'flag':
      return goal.key
    case 'metric':
      return METRIC_CONTROL[goal.metric] ?? null
    case 'event':
      return goal.id.startsWith('touched-')
        ? goal.id.slice('touched-'.length)
        : (EVENT_CONTROL[goal.id] ?? null)
    default:
      return null
  }
}

const EMPTY_LAB: LabState = { values: {}, events: [] }

function isLabStep(step: ImagingStageStep): boolean {
  return (
    step.interaction.kind === 'lab-task' ||
    step.interaction.kind === 'observe' ||
    step.interaction.kind === 'walk'
  )
}

function ImagingStageSession({
  sectionId,
  locale,
  onRestart,
}: {
  readonly sectionId: string
  readonly locale: string
  readonly onRestart: () => void
}) {
  const lesson = useMemo(
    () => imagingStageLesson(sectionId as ImagingStageLesson['sectionId']),
    [sectionId],
  )
  const { session, dispatch } = useImagingStageSession(lesson)
  const nextSection = nextPathwaySection(peripheralImagingPathway, sectionId)
  const stageSources = useMemo(() => imagingStageSources(lesson.sectionId), [lesson.sectionId])
  const { progress: courseProgress } = useImagingProgress()
  const savedForReview = courseProgress.reviewLaterSectionIds.includes(lesson.sectionId)

  const [pendingChoice, setPendingChoice] = useState<Record<string, string>>({})
  const [sortDraft, setSortDraft] = useState<Record<string, string>>({})
  const [explanationsOpen, setExplanationsOpen] = useState<Record<string, boolean>>({})
  const [viewIndex, setViewIndex] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [spotlight, setSpotlight] = useState<{ stepId: string; key: string; count: number } | null>(
    null,
  )
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const nowFocusRef = useRef<HTMLDivElement>(null)

  const [independentDisplay, setIndependentDisplay] = useState<
    Record<string, Record<string, number | boolean | string>>
  >({})
  const demonstrationMemories = useRef<Record<string, { current: SuiteViewMemory }>>({})
  const learnerViewMemory = useRef<SuiteViewMemory>({})
  const [representation, setRepresentation] = useState<{ stepId: string; ready: boolean } | null>(
    null,
  )
  const { commitments } = session
  const progress = deriveStageProgress(lesson, session)
  const heldIndex = progress.liveIndex
  const activeIndex = Math.max(0, Math.min(viewIndex ?? heldIndex, lesson.steps.length - 1))
  const activeStep = lesson.steps[activeIndex]
  const activity = activeStep.activity
  const lookingBack = viewIndex !== null && viewIndex < heldIndex
  const isLastStep = activeIndex === lesson.steps.length - 1
  const performedIds = progress.performedIds
  const predictionCommitted = progress.predictionCommitted
  const finished = commitments.finished
  const interaction = activeStep.interaction
  const imageReady = representation?.stepId === activeStep.id && representation.ready
  const onRepresentationReady = useCallback(
    (ready: boolean) =>
      setRepresentation((previous) =>
        previous?.stepId === activeStep.id && previous.ready === ready
          ? previous
          : { stepId: activeStep.id, ready },
      ),
    [activeStep.id],
  )
  /** A check with no answer yet. Its example image is held fixed; its explanation opens on request. */
  const checkPending =
    interaction.kind === 'prediction' && commitments.choices[activeStep.id] === undefined
  const explanationOpen = explanationsOpen[activeStep.id] === true
  const needsImage =
    interaction.kind === 'lab-task' || interaction.kind === 'observe' || interaction.kind === 'walk'
  const workDone =
    stepWorkDone(lesson, activeStep, activeIndex, session) && (!needsImage || !!imageReady)

  const previousActivity = useRef(activeStep.id)
  useEffect(() => {
    nowFocusRef.current?.focus({ preventScroll: true })
    if (previousActivity.current !== activeStep.id)
      nowFocusRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    previousActivity.current = activeStep.id
  }, [activeStep.id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('phase', activeStep.phase)
    window.history.replaceState(window.history.state, '', url)
  }, [activeStep.phase])

  // A location fact, not a completion: the learner opened this section.
  useEffect(() => {
    recordImagingLocation({ kind: 'section', id: lesson.sectionId })
  }, [lesson.sectionId])

  // Finishing is the learner's own "reviewed" mark. It says nothing about answers or skipped steps.
  const reviewRecorded = useRef(false)
  useEffect(() => {
    if (!finished || reviewRecorded.current) return
    reviewRecorded.current = true
    markImagingSectionReviewed(lesson.sectionId)
  }, [finished, lesson.sectionId])

  /* The readouts before the hands-on work, for the "what changed" table. */
  const snapshotKey = (step: ImagingStageStep) =>
    step.interaction.kind === 'observe' ? 'observe' : 'act'
  useEffect(() => {
    if (lookingBack) return
    const step = lesson.steps[heldIndex]
    if (!step || !session.lab || !isLabStep(step)) return
    const key = `before:${snapshotKey(step)}`
    if (session.snapshots[key]) return
    dispatch({ type: 'SNAPSHOT', key })
  }, [dispatch, heldIndex, lesson.steps, lookingBack, session.lab, session.snapshots])

  /* ---------------------------------------------------------------- *
   * Progression
   * ---------------------------------------------------------------- */
  /** Continue past a step whose work is done: the "after" readouts are real, so take them. */
  const continuePast = useCallback(
    (index: number) => {
      const step = lesson.steps[index]
      if (step && isLabStep(step)) dispatch({ type: 'SNAPSHOT', key: `after:${snapshotKey(step)}` })
      dispatch({ type: 'CONTINUE_PAST', index })
      setViewIndex(null)
      setSpotlight(null)
    },
    [dispatch, lesson.steps],
  )

  /** Move past a step without its work: no readouts, no answer, nothing performed. */
  const skipPast = useCallback(
    (index: number) => {
      dispatch({ type: 'SKIP_PAST', index })
      setViewIndex(null)
      setSpotlight(null)
    },
    [dispatch],
  )

  function toggleExplanation(stepId: string) {
    setExplanationsOpen((current) => ({ ...current, [stepId]: !current[stepId] }))
  }

  function commitChoice(step: ImagingStageStep) {
    if (step.interaction.kind !== 'prediction') return
    const choiceId = pendingChoice[step.id]
    if (!choiceId) return
    dispatch({ type: 'COMMIT_CHOICE', stepId: step.id, choiceId })
    setViewIndex(null)
  }

  function commitSort(step: ImagingStageStep) {
    if (step.interaction.kind !== 'sort') return
    if (step.interaction.sort.rows.some((row) => !sortDraft[row.id])) return
    dispatch({ type: 'COMMIT_SORT', stepId: step.id, answers: { ...sortDraft } })
  }

  function goBack() {
    const target = activeIndex - 1
    if (target < 0) return
    setViewIndex(target)
  }

  function returnToLive() {
    setViewIndex(null)
  }

  function selectStepRow(index: number) {
    if (index < 0 || index >= heldIndex) return
    setViewIndex(index)
  }

  function finish() {
    dispatch({ type: 'CONTINUE_PAST', index: activeIndex })
    dispatch({ type: 'FINISH' })
  }

  function finishWithoutAnswer() {
    dispatch({ type: 'SKIP_PAST', index: activeIndex })
    dispatch({ type: 'FINISH' })
  }

  /* ---------------------------------------------------------------- *
   * The walk, the chain, and the answer on it
   * ---------------------------------------------------------------- */
  const walkStop: ChainStopId | null =
    interaction.kind === 'walk' && !commitments.walkDone
      ? (interaction.stops[commitments.walkStop] ?? null)
      : null

  const chainItem =
    interaction.kind === 'prediction' && interaction.chainTargets ? interaction : null
  const chainCommittedId = chainItem ? commitments.choices[activeStep.id] : undefined
  const keyedStop: ChainStopId | null = (() => {
    if (!chainItem || chainCommittedId === undefined) return null
    const keyed = chainItem.chainTargets!.find(
      (target) => target.choiceId === chainItem.item.correctChoiceIds[0],
    )
    return keyed && !isOffChainTarget(keyed) ? keyed.stopId : null
  })()

  const litStop: ChainStopId | null = checkPending
    ? null
    : (walkStop ?? (chainItem ? keyedStop : activeStep.suite.litStop))
  const litStops: readonly ChainStopId[] = checkPending
    ? []
    : walkStop
      ? [walkStop]
      : chainItem
        ? keyedStop
          ? [keyedStop]
          : []
        : activeStep.stops

  const chainAnswer: ChainAnswer | undefined = chainItem
    ? {
        name: `imaging-chain-${activeStep.id}`,
        legend: chainItem.item.stem,
        choices: orderChoices(chainItem.item.id, chainItem.item.choices).map((choice) => {
          const target = chainItem.chainTargets!.find(
            (candidate) => candidate.choiceId === choice.id,
          )
          return {
            id: choice.id,
            label: choice.label,
            stop: target && !isOffChainTarget(target) ? target.stopId : null,
          }
        }),
        selectedChoiceId: chainCommittedId ?? pendingChoice[activeStep.id] ?? null,
        committedChoiceId: chainCommittedId ?? null,
        correctChoiceIds:
          chainCommittedId !== undefined ? chainItem.item.correctChoiceIds : undefined,
        onSelect: (choiceId) =>
          setPendingChoice((current) => ({ ...current, [activeStep.id]: choiceId })),
        disabled: chainCommittedId !== undefined || lookingBack,
        hint:
          chainCommittedId === undefined
            ? 'Choose the component where the problem arises, then check your interpretation.'
            : undefined,
      }
    : undefined

  const suiteView: SuiteViewSpec = {
    ...activeStep.suite,
    litStop,
    stopSentence: chainCaption(litStop),
    chainAnswer: chainItem !== null,
  }

  /* ---------------------------------------------------------------- *
   * Goals, spotlight
   * ---------------------------------------------------------------- */
  const goalInteraction =
    interaction.kind === 'lab-task' || interaction.kind === 'observe' || interaction.kind === 'walk'
      ? interaction
      : null
  const goals = goalInteraction ? goalInteraction.goals : []
  const goalsMetNow = goals.map((goal) =>
    session.lab && goalInteraction
      ? labGoalMet(goal, session.lab, goalInteraction.lab, lesson.sectionId)
      : false,
  )
  const firstUnmetKey = (() => {
    const index = goalsMetNow.findIndex((met) => !met)
    if (index < 0) return null
    return goalControlKey(goals[index])
  })()

  useEffect(() => {
    if (!spotlight || spotlight.stepId !== activeStep.id) return
    const timer = window.setTimeout(() => {
      const control = document.getElementById(controlElementId(spotlight.key))
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
  const canGoBack = previousStep !== undefined && !finished
  const showWhereAction =
    firstUnmetKey && !workDone && !lookingBack
      ? {
          label: spotlight?.stepId === activeStep.id ? 'Highlight it again' : 'Show me where',
          onActivate: showWhere,
          icon: <LocateFixed aria-hidden="true" />,
        }
      : undefined
  const continueAction = {
    label:
      lesson.steps[activeIndex + 1]?.activity.task === 'check'
        ? 'Interpret a changed example'
        : lesson.steps[activeIndex + 1]?.activity.task === 'observe'
          ? 'Compare the images'
          : 'Continue',
    onActivate: () => continuePast(activeIndex),
    icon: <ArrowRight aria-hidden="true" />,
  }
  const finishAction = {
    label: 'Finish the section',
    onActivate: finish,
    icon: <ArrowRight aria-hidden="true" />,
  }
  const skipStep = (label: string): NowCardAction => ({
    label,
    onActivate: () => skipPast(activeIndex),
  })

  const nowModel: ImagingNowModel = (() => {
    const base: ImagingNowModel = {
      kicker: stepPosition,
      heading: activeStep.title,
      body: activeStep.instruction,
      why: activeStep.rationale,
      ...(canGoBack
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
        status: performedIds.has(activeStep.id)
          ? 'Done. You are looking back at an earlier step. The suite is where you left it, and nothing you have worked through is lost.'
          : 'You moved past this step without completing it. You are looking back; the suite is where you left it.',
        primary: {
          label: `Return to step ${heldIndex + 1}`,
          onActivate: returnToLive,
          icon: <ArrowRight aria-hidden="true" />,
        },
      }
    }
    if (finished && isLastStep) {
      return { ...base, status: 'Done. You marked this section reviewed.' }
    }
    switch (interaction.kind) {
      case 'read': {
        const waitingForImage = activity.visual === 'suite' && !imageReady
        return {
          ...base,
          primary: {
            label: activeStep.actionLabel,
            onActivate: () => continuePast(activeIndex),
            disabled: waitingForImage,
            disabledReason:
              'The demonstration image must load. Teaching text remains available; retry the view, or continue without the image.',
          },
          ...(waitingForImage ? { skip: skipStep('Continue without the image') } : {}),
        }
      }
      case 'walk': {
        if (commitments.walkDone) {
          return workDone
            ? {
                ...base,
                status: 'Every component visited, and the C-arm moved once.',
                primary: continueAction,
              }
            : {
                ...base,
                status:
                  'Every component visited. This step is done when every item below is met, or you can skip it.',
                secondary: showWhereAction,
                skip: skipStep('Skip this step'),
              }
        }
        const last = commitments.walkStop >= interaction.stops.length - 1
        return {
          ...base,
          status: walkPositionWords(commitments.walkStop, interaction.stops.length),
          primary: {
            label: last ? 'Finish the walk' : 'Next component',
            onActivate: () => dispatch({ type: 'WALK_NEXT', stopCount: interaction.stops.length }),
            icon: <ArrowRight aria-hidden="true" />,
          },
          skip: skipStep('Skip the walk'),
        }
      }
      case 'prediction': {
        const committed = commitments.choices[activeStep.id] !== undefined
        if (committed)
          return {
            ...base,
            primary: isLastStep ? finishAction : continueAction,
            secondary: {
              label: 'Try this question again',
              onActivate: () => {
                dispatch({ type: 'RETRY_CHOICE', stepId: activeStep.id })
                setPendingChoice((current) => ({ ...current, [activeStep.id]: '' }))
              },
            },
          }
        return {
          ...base,
          status: explanationOpen
            ? 'The explanation is open. You can still choose an interpretation and check it, or continue without answering.'
            : 'Choose an interpretation and check it, show the explanation first, or continue without answering.',
          primary: {
            label: activeStep.actionLabel,
            onActivate: () => commitChoice(activeStep),
            disabled:
              !pendingChoice[activeStep.id] ||
              (interaction.round === 0 &&
                activity.visual !== 'case' &&
                !!lesson.lesson.lab &&
                !imageReady),
            disabledReason: interaction.chainTargets
              ? 'Choose a component on the image-formation map to enable this.'
              : 'Choose one option to enable this.',
          },
          secondary: {
            label: explanationOpen ? 'Hide the explanation' : 'Show the explanation',
            onActivate: () => toggleExplanation(activeStep.id),
            expanded: explanationOpen,
          },
          skip: isLastStep
            ? { label: 'Finish without answering', onActivate: finishWithoutAnswer }
            : skipStep('Continue without answering'),
        }
      }
      case 'sort': {
        if (commitments.sorts[activeStep.id]) return { ...base, primary: continueAction }
        const remaining = interaction.sort.rows.filter((row) => !sortDraft[row.id]).length
        return {
          ...base,
          status:
            remaining > 0
              ? `${remaining} of ${interaction.sort.rows.length} still to place. You can show the matches, or continue without matching.`
              : 'Every statement is placed. Check the matches, or continue without checking.',
          primary: {
            label: activeStep.actionLabel,
            onActivate: () => commitSort(activeStep),
            disabled: remaining > 0,
            disabledReason: `${remaining} of ${interaction.sort.rows.length} still to place.`,
          },
          secondary: {
            label: explanationOpen ? 'Hide the matches' : 'Show the matches',
            onActivate: () => toggleExplanation(activeStep.id),
            expanded: explanationOpen,
          },
          skip: skipStep('Continue without matching'),
        }
      }
      case 'lab-task':
        if (workDone)
          return {
            ...base,
            status: 'The required observations are complete. Review the image, then continue.',
            primary: continueAction,
          }
        return {
          ...base,
          status: !imageReady
            ? 'The required image is unavailable or loading. Retry the view; text explanations remain available, and you can skip this step.'
            : 'Compare the image as you make the changes listed below, or skip this step.',
          secondary: showWhereAction,
          skip: skipStep('Skip this step'),
        }
      case 'observe': {
        if (workDone) return { ...base, status: 'Done.', primary: continueAction }
        // Every listed item can read as met by the untouched starting state; the comparison still
        // needs a change to compare.
        const nothingChangedYet = !!imageReady && goals.length > 0 && goalsMetNow.every(Boolean)
        return {
          ...base,
          status: nothingChangedYet
            ? 'This comparison starts from the change in the step before. Go back to make it, change the view here, or skip this step.'
            : 'Complete the listed comparison to continue, or skip this step.',
          secondary: showWhereAction,
          skip: skipStep('Skip this step'),
        }
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
    <ul className={stageStyles.taskList} data-step-goals aria-label="What to do">
      {goals.map((goal, index) => (
        <li key={goal.label} data-met={goalsMetNow[index]}>
          {goalsMetNow[index] ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
          <span>{goal.label}</span>
        </li>
      ))}
    </ul>
  )

  const nowBody: ReactNode = (() => {
    if (lookingBack) {
      if (interaction.kind === 'prediction') {
        const committedId = commitments.choices[activeStep.id]
        if (committedId) {
          return (
            <AnswerVerdict
              item={interaction.item}
              choiceId={committedId}
              outcome="stated"
              timing="immediate-after-commit"
              theme="dark"
              frames={verdictFrames(interaction.item)}
            />
          )
        }
        return (
          <UnansweredCheck
            item={interaction.item}
            open={explanationOpen}
            onToggle={() => toggleExplanation(activeStep.id)}
            message="You moved past this check without answering it."
          />
        )
      }
      return (
        <StepRecap
          lesson={lesson}
          step={activeStep}
          index={activeIndex}
          session={session}
          performed={performedIds.has(activeStep.id)}
        />
      )
    }
    switch (interaction.kind) {
      case 'walk':
        if (commitments.walkDone) return goalList
        return walkStop ? <ChainWalkCard stopId={walkStop} stepId={activeStep.id} /> : null
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
              frames={verdictFrames(interaction.item)}
            />
          )
        }
        const explanation = explanationOpen ? (
          <ImagingExplanation
            item={interaction.item}
            note="Shown without an answer. You can still choose an interpretation and check it."
          />
        ) : null
        if (interaction.chainTargets) {
          const chosen = interaction.item.choices.find(
            (choice) => choice.id === pendingChoice[activeStep.id],
          )
          return (
            <>
              <p className={stageStyles.taskInstruction} data-chain-answer-note>
                Answer on the image-formation map beneath the scene: choose the stop.
                {chosen ? ` Chosen: ${chosen.label}.` : ''}
              </p>
              {explanation}
            </>
          )
        }
        const selected = pendingChoice[activeStep.id] ?? null
        return (
          <>
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
                    name={`imaging-prediction-${activeStep.id}`}
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
            {explanation}
          </>
        )
      }
      case 'sort':
        return (
          <ImagingSortControl
            sort={interaction.sort}
            draft={sortDraft}
            committed={commitments.sorts[activeStep.id] ?? null}
            revealed={explanationOpen}
            onChange={(rowId, originId) =>
              setSortDraft((current) => ({ ...current, [rowId]: originId }))
            }
          />
        )
      case 'lab-task':
      case 'observe':
        return goalList
      case 'explain': {
        const predictionStep = lesson.steps[lesson.predictionStepIndex]
        const predictionItem =
          predictionStep?.interaction.kind === 'prediction'
            ? predictionStep.interaction.item
            : undefined
        const chosenId = predictionStep ? commitments.choices[predictionStep.id] : undefined
        const before = session.snapshots['before:act']
        const after = session.snapshots['after:act']
        const afterObserve = session.snapshots['after:observe']
        const watch =
          lesson.spec.act.kind === 'sort' ? [] : lesson.lesson.lab ? watchFor(lesson) : []
        return (
          <>
            {predictionItem && chosenId ? (
              <div data-explain-recap>
                <AnswerVerdict
                  item={predictionItem}
                  choiceId={chosenId}
                  outcome="stated"
                  timing="immediate-after-commit"
                  theme="dark"
                  frames={verdictFrames(predictionItem)}
                />
              </div>
            ) : predictionItem && predictionStep ? (
              <div data-explain-recap data-explain-unanswered>
                <UnansweredCheck
                  item={predictionItem}
                  open={explanationsOpen[predictionStep.id] === true}
                  onToggle={() => toggleExplanation(predictionStep.id)}
                  message="You continued past the interpretation check without answering it."
                />
              </div>
            ) : null}
            {before && after && watch.length > 0 ? (
              <BeforeAfter
                before={before}
                after={after}
                afterObserve={afterObserve}
                watch={watch}
              />
            ) : null}
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
  // Demonstrations own their state; guided work uses the session. Check examples stay fixed.
  const beforePrediction = interaction.kind === 'read'
  const browsingIndependent =
    interaction.kind === 'prediction' &&
    interaction.round === 0 &&
    ['sampling', 'dts', 'dts-prior'].includes(suiteView.mode)
  const controlsEnabled =
    (!checkPending || browsingIndependent) && !beforePrediction && !lookingBack
  const lockedReason = checkPending
    ? 'This example stays fixed so the question and the image match.'
    : beforePrediction
      ? 'The worked demonstration uses separate state. The guided task starts from its own baseline.'
      : undefined
  const pausedReason =
    !checkPending && !beforePrediction && lookingBack
      ? 'The controls are paused while you look back at an earlier step. Return to the live step to take them.'
      : undefined

  const exampleValues =
    interaction.kind === 'prediction'
      ? independentValues(lesson.sectionId, interaction.round)
      : null
  const panelQuestion =
    interaction.kind === 'prediction' &&
    interaction.round === 0 &&
    hasIndependentImagePanel(lesson.sectionId)
  const independentImage = interaction.kind === 'prediction'
  const imageView = browsingIndependent
    ? {
        ...suiteView,
        controls:
          suiteView.mode === 'sampling' ? ['axial', 'coronal', 'sagittal', 'slab'] : ['plane'],
      }
    : suiteView
  const captureGroup = activity.captureGroup ?? activity.id
  const demoMemory = (demonstrationMemories.current[captureGroup] ??= { current: {} })
  const simulator =
    interaction.kind === 'read' ? (
      <LessonDemonstration
        key={activity.id}
        sectionId={lesson.sectionId}
        activity={activity}
        savedViewMemory={demoMemory}
        onRepresentationReady={onRepresentationReady}
      />
    ) : activity.visual === 'case' ? null : (
      <div className={styles.demonstration}>
        {panelQuestion ? (
          <IndependentImagePanels
            sectionId={lesson.sectionId}
            onRepresentationReady={onRepresentationReady}
          />
        ) : (
          <ImagingSuitePane
            key={independentImage ? activeStep.id : 'learner'}
            viewMemory={independentImage ? undefined : learnerViewMemory}
            presentation={activity.presentation}
            independent={independentImage}
            onRepresentationReady={onRepresentationReady}
            view={imageView}
            lab={
              independentImage
                ? {
                    values: {
                      ...(exampleValues ?? session.lab?.values),
                      ...independentDisplay[activeStep.id],
                    },
                    events: [],
                  }
                : (session.lab ?? EMPTY_LAB)
            }
            onLabChange={(patch) => {
              if (independentImage) {
                const allowed =
                  suiteView.mode === 'sampling'
                    ? ['axial', 'coronal', 'sagittal', 'slab']
                    : ['plane']
                const displayPatch = Object.fromEntries(
                  Object.entries(patch).filter(([key]) => allowed.includes(key)),
                )
                setIndependentDisplay((current) => ({
                  ...current,
                  [activeStep.id]: { ...current[activeStep.id], ...displayPatch },
                }))
              } else dispatch({ type: 'LAB_CHANGE', patch })
            }}
            onLabReset={() => {
              if (independentImage)
                setIndependentDisplay((current) => ({ ...current, [activeStep.id]: {} }))
              else {
                learnerViewMemory.current = {}
                dispatch({ type: 'LAB_RESET' })
              }
            }}
            controlsEnabled={controlsEnabled}
            lockedReason={lockedReason}
            pausedReason={pausedReason}
            goals={[]}
            chainCaption={suiteView.stopSentence}
            chainAnswer={chainAnswer}
            spotlightKey={spotlight?.stepId === activeStep.id ? spotlight.key : undefined}
          />
        )}
      </div>
    )

  const teaching = (
    <StageTeachingScope
      value={{ phase: activeStep.phase, predictionCommitted, stepId: activeStep.id }}
    >
      <ImagingTeachingColumn
        lesson={lesson}
        activity={activity}
        stops={litStops}
        checking={checkPending}
      />
    </StageTeachingScope>
  )

  const completion = finished && isLastStep ? <CompletionCard lesson={lesson} /> : null

  const helpDialog = (
    <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} returnFocusTo={helpButtonRef}>
      <p>
        <strong>{activeStep.title}.</strong> {activeStep.instruction}
      </p>
      <p>
        Any step can be skipped, and any check can show its explanation before you answer. Answers
        are not saved; they only change the feedback on this page.
      </p>
      <p>
        This device keeps the sections you open, where you were, and the sections you mark reviewed
        or save for later. Leaving or reloading starts a section from its first step; demonstration
        settings are not saved.
      </p>
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
    <PeripheralImagingModuleFrame
      locale={locale}
      activeHref={PERIPHERAL_IMAGING_LEARN_HREF}
      activityMode
    >
      <StageSourcesScope>
        <ImagingActivityShell
          lesson={lesson}
          index={activeIndex}
          liveIndex={heldIndex}
          model={nowModel}
          headingRef={nowFocusRef}
          visual={simulator}
          teaching={teaching}
          response={nowBody}
          onReview={selectStepRow}
          performedIds={performedIds}
          onHelp={() => setHelpOpen(true)}
          helpRef={helpButtonRef}
          onRestart={onRestart}
          reviewLater={savedForReview}
          onToggleReviewLater={() =>
            setImagingSectionReviewLater(lesson.sectionId, !savedForReview)
          }
          finished={finished && isLastStep}
          nextHref={
            nextSection
              ? imagingSectionLinkTarget(nextSection.id)
              : PERIPHERAL_IMAGING_INTEGRATED_CASES_HREF
          }
          nextTitle={
            nextSection ? `Continue to ${nextSection.title}` : 'Go to the integrated cases'
          }
          references={
            <StageSourcesFooter
              count={stageSources.evidenceIds.length}
              label="Sources for this section"
              claimsVisible
            >
              <ImagingSourceList records={stageSources.records} claimsVisible />
            </StageSourcesFooter>
          }
        >
          {completion}
          {helpDialog}
        </ImagingActivityShell>
      </StageSourcesScope>
    </PeripheralImagingModuleFrame>
  )
}

/* ------------------------------------------------------------------ *
 * Pieces
 * ------------------------------------------------------------------ */

function watchFor(lesson: ImagingStageLesson): readonly LabMetricId[] {
  const observe = lesson.steps.find((step) => step.interaction.kind === 'observe')
  if (observe && observe.interaction.kind === 'observe') return observe.interaction.readouts
  return lesson.steps[0].suite.readouts ?? []
}

/**
 * A check the learner has not answered: says so, and offers the explanation. Opening it answers
 * nothing and records nothing.
 */
function UnansweredCheck({
  item,
  open,
  onToggle,
  message,
}: {
  readonly item: ClinicalLearningItem
  readonly open: boolean
  readonly onToggle: () => void
  readonly message: string
}) {
  return (
    <div className="grid gap-3" data-unanswered-check>
      <p className={stageStyles.taskInstruction}>{message}</p>
      <div>
        <button
          type="button"
          className={shellStyles.nowSecondary}
          aria-expanded={open}
          onClick={onToggle}
          data-show-explanation
        >
          {open ? 'Hide the explanation' : 'Show the explanation'}
        </button>
      </div>
      {open ? <ImagingExplanation item={item} note="Shown without an answer." /> : null}
    </div>
  )
}

/**
 * What changed: the readouts at the start of the Act, after the change the Act asked for, and —
 * when the section had an Observe step — after the reading. Three columns, because an Observe
 * step often brings the suite back to where it started (the projection section returns to the
 * overlap), and a two-column table would then say nothing had changed. The "after" readouts are
 * taken only when the learner continued with the step's work done, so a skipped step leaves the
 * table out rather than showing an unchanged state as the result of a change.
 */
function BeforeAfter({
  before,
  after,
  afterObserve,
  watch,
}: {
  readonly before: LabReadouts
  readonly after: LabReadouts
  readonly afterObserve?: LabReadouts
  readonly watch: readonly LabMetricId[]
}) {
  return (
    <table className={styles.beforeAfter} data-before-after>
      <caption className={styles.kicker}>What changed</caption>
      <thead>
        <tr>
          <th scope="col">Readout</th>
          <th scope="col">At the start</th>
          <th scope="col">After the change</th>
          {afterObserve ? <th scope="col">After the reading</th> : null}
        </tr>
      </thead>
      <tbody>
        {watch.map((metric) => (
          <tr key={metric} data-watch={metric}>
            <th scope="row">{LAB_METRICS[metric].label}</th>
            <td>{formatReadout(metric, before[metric])}</td>
            <td>{formatReadout(metric, after[metric])}</td>
            {afterObserve ? <td>{formatReadout(metric, afterObserve[metric])}</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function recapLines(
  lesson: ImagingStageLesson,
  step: ImagingStageStep,
  index: number,
  session: ReturnType<typeof useImagingStageSession>['session'],
): readonly string[] {
  const { commitments } = session
  switch (step.interaction.kind) {
    case 'prediction': {
      const chosen = commitments.choices[step.id]
      const label = step.interaction.item.choices.find((choice) => choice.id === chosen)?.label
      return label ? [`Your answer: ${label}`] : []
    }
    case 'sort':
      return commitments.sorts[step.id] ? ['Placed every statement and checked the matches.'] : []
    case 'walk':
      return commitments.walkDone ? ['Every component visited.'] : []
    case 'lab-task':
    case 'observe': {
      const { goals: stepGoals, lab } = step.interaction
      return stepGoals
        .filter(
          (goal) => session.lab !== null && labGoalMet(goal, session.lab, lab, lesson.sectionId),
        )
        .map((goal) => goal.label)
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
  performed,
}: {
  readonly lesson: ImagingStageLesson
  readonly step: ImagingStageStep
  readonly index: number
  readonly session: ReturnType<typeof useImagingStageSession>['session']
  readonly performed: boolean
}) {
  if (!performed) {
    return (
      <ul className={stageStyles.taskList} data-step-review data-step-skipped>
        <li data-met="false">
          <Circle aria-hidden="true" />
          <span>You moved past this step without completing it.</span>
        </li>
      </ul>
    )
  }
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

function CompletionCard({ lesson }: { readonly lesson: ImagingStageLesson }) {
  const integratedCase = lesson.spec.capstoneCaseId
    ? imagingCaseById.get(lesson.spec.capstoneCaseId)
    : undefined
  // The plan's pairing rule: a section's completion card points at its own practice case, so the
  // next thing to do after a mechanism is to use it somewhere else.
  const practiceCase = microCasesForSection(lesson.sectionId)[0]
  return (
    <section className={styles.completion} data-section-completion aria-label="Section reviewed">
      <p className={styles.kicker}>Section reviewed</p>
      <p>
        You marked this section reviewed on this device. It is a note for finding your place, not a
        mark: answers and skipped steps are not recorded, and every section stays open.
      </p>
      {integratedCase ? (
        <p>
          This idea returns in the integrated case{' '}
          <Link
            className={styles.completionLink}
            href={integratedCaseLinkTarget(integratedCase.id)}
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
            href={imagingCaseLinkTarget(practiceCase.id)}
            data-paired-practice-case={practiceCase.id}
          >
            {practiceCase.presentationTitle}
          </Link>
          .
        </p>
      ) : null}
    </section>
  )
}
