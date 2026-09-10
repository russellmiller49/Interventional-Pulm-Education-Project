'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, Circle, LocateFixed } from 'lucide-react'

import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { nextPathwaySection } from '@/features/learning-module/curriculum/types'
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
} from '@/features/learning-module/stage/stageModel'
import { StageSourcesFooter } from '@/features/learning-module/stage/StageSourcesFooter'
import { StageSourcesScope } from '@/features/learning-module/stage/StageSourcesScope'
import { StageTeachingScope } from '@/features/learning-module/stage/StageTeachingScope'
import { StepList } from '@/features/learning-module/stage/StepList'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'
import { Link, useRouter } from '@/i18n/navigation'

import { imagingCaseById } from '../../content/cases'
import { microCasesForSection } from '../../content/microCases'
import { isOffChainTarget } from '../../content/chainAnswerTargets'
import { chainCaption, chainStop, type ChainStopId } from '../../content/imagingChain'
import { peripheralImagingPathway } from '../../content/pathway'
import { imagingSectionLinkTarget } from '../../content/pathwayResolver'
import {
  PERIPHERAL_IMAGING_ASSESS_HREF,
  PERIPHERAL_IMAGING_LEARN_HREF,
  PERIPHERAL_IMAGING_NAV_BASE,
  imagingCaseLinkTarget,
} from '../../content/routes'
import {
  imagingStageLesson,
  type ImagingStageLesson,
  type ImagingStageStep,
} from '../../content/stageLessons'
import { questionIdOf } from '../../content/stageItems'
import { imagingStageSources } from '../../content/stageSources'
import { labGoalMet, type LabGoal } from '../../engine/labGoalEvaluation'
import {
  formatReadout,
  LAB_METRICS,
  type LabMetricId,
  type LabReadouts,
  type LabState,
} from '../../engine/labMetrics'
import {
  readImagingRecord,
  withFirstAttempt,
  withSectionCompleted,
  withSectionVisited,
  writeImagingRecord,
} from '../../engine/learnProgress'
import { deriveStageProgress, stepWorkDone } from '../../engine/stageSession'
import { PeripheralImagingModuleFrame } from '../PeripheralImagingModuleFrame'
import { ImagingSuitePane } from '../suite/ImagingSuitePane'
import {
  controlElementId,
  type ChainAnswer,
  type SuiteMode,
  type SuiteViewSpec,
} from '../suite/types'
import { ChainWalkCard, walkPositionWords } from './ChainWalkCard'
import { ImagingSortControl } from './ImagingSortControl'
import { ImagingSourceList } from './ImagingSourceList'
import { ImagingTeachingColumn } from './ImagingTeachingColumn'
import { useImagingStageSession } from './useImagingStageSession'
import styles from './imaging-stage.module.css'

/**
 * One section of the peripheral-imaging pathway on the lesson stage.
 *
 * The lab is the authority on the hands-on work: a step's goals are predicates over its values and
 * history. The host owns the commitments — which choice was committed, which set was placed,
 * which stop of the walk is current — and the view around them: the step the learner is looking
 * at when it is not the live one, the choice not yet committed, whether help is open, and the Now
 * card that makes every step one thing. Nothing about a commitment is persisted; a reload starts
 * the section at its first step, and the only things written are the first attempts and the
 * completion record.
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

/*
 * Steps, Teaching, Simulator — left to right — each pane captioned with its name and what it is
 * for, and the simulator kept the widest of the three. The four critical-care adopters pass the
 * same four values; sibling modules must not disagree about the first thing a learner sees.
 */
const PANE_ORDER = ['steps', 'teaching', 'simulator'] as const
const PANE_CAPTIONS = {
  steps: 'what to do',
  teaching: 'what to read',
  simulator: 'the imaging suite, its controls and the image-formation map',
} as const
const PANE_WIDTH_FRACTIONS = { primary: 0.26, secondary: 0.29 } as const
const PANE_MINIMUMS = { primary: 300, secondary: 280, tertiary: 340 } as const

const DECISION_FRAMES = {
  best: 'That is the move to make first',
  'reasonable-but-incomplete': 'Defensible, but it leaves a step out',
  'incorrect-mechanism': 'That move answers a different problem',
} as const

function verdictFrames(item: ClinicalLearningItem) {
  return item.itemType === 'management-decision' ? DECISION_FRAMES : undefined
}

const MODE_WORDS: Readonly<Record<SuiteMode, string>> = {
  projection: '2D fluoroscopy',
  signal: '2D fluoroscopy',
  field: '2D fluoroscopy',
  time: 'pulsed fluoroscopy',
  dts: 'digital tomosynthesis',
  'dts-prior': 'digital tomosynthesis',
  cbct: 'cone-beam CT',
  sampling: 'multiplanar review',
  rebus: 'radial EBUS',
  navigation: 'navigation and registration',
  augmented: 'augmented fluoroscopy',
  staff: 'staff protection',
  dose: 'dose metrics',
  room: 'the suite at rest',
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

function ImagingStageSession({
  sectionId,
  locale,
  onRestart,
}: {
  readonly sectionId: string
  readonly locale: string
  readonly onRestart: () => void
}) {
  const router = useRouter()
  const lesson = useMemo(
    () => imagingStageLesson(sectionId as ImagingStageLesson['sectionId']),
    [sectionId],
  )
  const { session, dispatch } = useImagingStageSession(lesson)
  const nextSection = nextPathwaySection(peripheralImagingPathway, sectionId)
  const stageSources = useMemo(() => imagingStageSources(lesson.sectionId), [lesson.sectionId])

  const [pendingChoice, setPendingChoice] = useState<Record<string, string>>({})
  const [sortDraft, setSortDraft] = useState<Record<string, string>>({})
  const [viewIndex, setViewIndex] = useState<number | null>(null)
  const [review, setReview] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [spotlight, setSpotlight] = useState<{ stepId: string; key: string; count: number } | null>(
    null,
  )
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const nowFocusRef = useRef<HTMLDivElement>(null)

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
    writeImagingRecord(withSectionVisited(readImagingRecord(), lesson.sectionId))
  }, [lesson.sectionId])

  const completionRecorded = useRef(false)
  useEffect(() => {
    if (!finished || completionRecorded.current) return
    completionRecorded.current = true
    writeImagingRecord(withSectionCompleted(readImagingRecord(), lesson.sectionId))
  }, [finished, lesson.sectionId])

  /* The readouts before the hands-on work, for the "what changed" table. */
  const snapshotKey = (step: ImagingStageStep) =>
    step.interaction.kind === 'observe' ? 'observe' : 'act'
  useEffect(() => {
    if (lookingBack) return
    const step = lesson.steps[liveIndex]
    if (!step || !session.lab) return
    if (
      step.interaction.kind !== 'lab-task' &&
      step.interaction.kind !== 'observe' &&
      step.interaction.kind !== 'walk'
    )
      return
    const key = `before:${snapshotKey(step)}`
    if (session.snapshots[key]) return
    dispatch({ type: 'SNAPSHOT', key })
  }, [dispatch, lesson.steps, liveIndex, lookingBack, session.lab, session.snapshots])

  /* ---------------------------------------------------------------- *
   * Progression
   * ---------------------------------------------------------------- */
  const confirmThrough = useCallback(
    (index: number) => {
      const step = lesson.steps[index]
      if (
        step &&
        (step.interaction.kind === 'lab-task' ||
          step.interaction.kind === 'observe' ||
          step.interaction.kind === 'walk')
      ) {
        dispatch({ type: 'SNAPSHOT', key: `after:${snapshotKey(step)}` })
      }
      dispatch({ type: 'CONFIRM_THROUGH', index })
      setViewIndex(null)
      setReview(null)
      setSpotlight(null)
    },
    [dispatch, lesson.steps],
  )

  function commitChoice(step: ImagingStageStep) {
    if (step.interaction.kind !== 'prediction') return
    const choiceId = pendingChoice[step.id]
    if (!choiceId) return
    dispatch({ type: 'COMMIT_CHOICE', stepId: step.id, choiceId })
    const key = `${lesson.sectionId}:${questionIdOf(step.interaction.item.id)}`
    writeImagingRecord(withFirstAttempt(readImagingRecord(), key, choiceId))
    setViewIndex(null)
  }

  function commitSort(step: ImagingStageStep) {
    if (step.interaction.kind !== 'sort') return
    if (step.interaction.sort.rows.some((row) => !sortDraft[row.id])) return
    dispatch({ type: 'COMMIT_SORT', stepId: step.id, answers: { ...sortDraft } })
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
    router.push({ pathname: PERIPHERAL_IMAGING_LEARN_HREF, query: { section: nextId } })
  }

  function finish() {
    dispatch({ type: 'CONFIRM_THROUGH', index: activeIndex })
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

  const litStop: ChainStopId | null = walkStop ?? (chainItem ? keyedStop : activeStep.suite.litStop)
  const litStops: readonly ChainStopId[] = walkStop
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
            ? 'Choose the component where the problem arises, then commit on the card in the Steps panel.'
            : undefined,
      }
    : undefined

  const suiteView: SuiteViewSpec = {
    ...activeStep.suite,
    litStop,
    stopSentence: chainCaption(litStop),
    chainAnswer: chainItem !== null,
  }

  const compactPane: StagePaneId = chainItem
    ? 'simulator'
    : compactPaneForLocation(activeStep.lookIn)

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
  const lookInLine = <LookInLine location={activeStep.lookIn} />
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
          'Done. You are looking back at an earlier step. The suite is where you left it, and nothing you have worked through is lost.',
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
          return workDone
            ? {
                ...base,
                status: 'Every component visited, and the C-arm moved once.',
                primary: continueAction,
              }
            : {
                ...base,
                status: 'Every component visited. This step is done when every item below is met.',
                secondary: showWhereAction,
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
        }
      }
      case 'prediction': {
        const committed = commitments.choices[activeStep.id] !== undefined
        if (committed) return { ...base, primary: isLastStep ? finishAction : continueAction }
        return {
          ...base,
          status:
            interaction.round === 0
              ? 'The suite keeps its scene while you decide. The controls unlock once you commit.'
              : undefined,
          primary: {
            label: activeStep.actionLabel,
            onActivate: () => commitChoice(activeStep),
            disabled: !pendingChoice[activeStep.id],
            disabledReason: interaction.chainTargets
              ? 'Choose a component on the image-formation map to enable this.'
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
      case 'lab-task':
        if (workDone)
          return { ...base, status: 'Done. The change is on the suite.', primary: continueAction }
        return {
          ...base,
          status:
            'Waiting for the work on the suite. This step is done when every item below is met.',
          secondary: showWhereAction,
        }
      case 'observe':
        if (workDone) return { ...base, status: 'Done.', primary: continueAction }
        return { ...base, status: 'Waiting for the work on the suite.', secondary: showWhereAction }
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
      const committedId =
        interaction.kind === 'prediction' ? commitments.choices[activeStep.id] : undefined
      if (interaction.kind === 'prediction' && committedId) {
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
      return <StepRecap lesson={lesson} step={activeStep} index={activeIndex} session={session} />
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
        if (interaction.chainTargets) {
          const chosen = interaction.item.choices.find(
            (choice) => choice.id === pendingChoice[activeStep.id],
          )
          return (
            <p className={stageStyles.taskInstruction} data-chain-answer-note>
              Answer on the image-formation map beneath the scene: choose the stop.
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
        )
      }
      case 'sort':
        return (
          <ImagingSortControl
            sort={interaction.sort}
            draft={sortDraft}
            committed={commitments.sorts[activeStep.id] ?? null}
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
  const deciding =
    interaction.kind === 'prediction' && commitments.choices[activeStep.id] === undefined
  // The suite's controls open only once the prediction is committed: not on the read before it,
  // not while it is open. Playing with the lab first would show the mechanism the prediction asks
  // about.
  const beforePrediction = !predictionCommitted && activeIndex <= lesson.predictionStepIndex
  const controlsEnabled = !deciding && !beforePrediction && !lookingBack
  const lockedReason = deciding
    ? 'The controls are locked while you decide. Commit your answer to take them.'
    : beforePrediction
      ? 'The controls open once you have committed the prediction on the next step.'
      : undefined
  const pausedReason =
    !deciding && !beforePrediction && lookingBack
      ? 'The controls are paused while you look back at an earlier step. Return to the live step to take them.'
      : undefined

  const contextItems: readonly ContextStripItem[] = [
    { label: 'Suite', value: MODE_WORDS[suiteView.mode] },
    {
      // The component name only: the image-formation caption in the Simulator panel is the one
      // place its number is printed, so this strip does not add another "N of M" to the screen.
      label: 'Image formation',
      value: litStop ? chainStop(litStop).title : 'not named on this step',
    },
    {
      label: 'Controls',
      value: !lesson.lesson.lab
        ? 'none in this section'
        : controlsEnabled
          ? 'open'
          : deciding
            ? 'locked while you decide'
            : beforePrediction
              ? 'locked until you commit'
              : 'paused',
    },
  ]

  const simulator = (
    <ImagingSuitePane
      view={suiteView}
      lab={session.lab ?? EMPTY_LAB}
      onLabChange={(patch) => dispatch({ type: 'LAB_CHANGE', patch })}
      onLabReset={() => dispatch({ type: 'LAB_RESET' })}
      controlsEnabled={controlsEnabled}
      lockedReason={lockedReason}
      pausedReason={pausedReason}
      goals={goals.map((goal, index) => ({ goal, met: goalsMetNow[index] }))}
      chainCaption={suiteView.stopSentence}
      chainAnswer={chainAnswer}
      spotlightKey={spotlight?.stepId === activeStep.id ? spotlight.key : undefined}
    />
  )

  const teaching = (
    <StageTeachingScope
      value={{ phase: activeStep.phase, predictionCommitted, stepId: activeStep.id }}
    >
      <ImagingTeachingColumn lesson={lesson} stops={litStops} />
    </StageTeachingScope>
  )

  const completion =
    finished && isLastStep ? (
      <CompletionCard lesson={lesson} nextSectionId={nextSection?.id ?? null} />
    ) : null

  const task = (
    <div className={stageStyles.taskColumn}>
      <div ref={nowFocusRef} tabIndex={-1} data-now-focus>
        <NowCard model={nowModel}>{nowBody}</NowCard>
      </div>
      {completion}
      <StepList
        lesson={lesson}
        currentIndex={activeIndex}
        furthestPerformedIndex={progress.furthestPerformedIndex}
        performedStepIds={performedIds}
        predictionCommitted={predictionCommitted}
        reviewIndex={review}
        recapFor={(index) => recapLines(lesson, lesson.steps[index], index, session)}
        onSelect={selectStepRow}
      />
    </div>
  )

  const header = (
    <SectionHeader
      breadcrumb={{ href: PERIPHERAL_IMAGING_NAV_BASE, label: 'Peripheral bronchoscopy imaging' }}
      kicker={`Section ${lesson.index + 1} of ${lesson.total} · ${lesson.minutes} min`}
      title={lesson.title}
      sectionsControl={
        <SectionsDrawer
          pathway={peripheralImagingPathway}
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
      saveAndExitHref={PERIPHERAL_IMAGING_NAV_BASE}
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
    <PeripheralImagingModuleFrame
      locale={locale}
      activeHref={PERIPHERAL_IMAGING_LEARN_HREF}
      activityMode
    >
      <StageSourcesScope>
        <StageLayout
          stageId={activeStep.id}
          label="Guided peripheral imaging section"
          module="peripheral-imaging"
          workspaceLabel="Imaging lesson workspace: steps, teaching, and simulator"
          header={header}
          contextStrip={<ContextStrip items={contextItems} badge="Authored teaching model" />}
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
                every image, target, tool and number is an authored teaching model. Follow current
                device instructions, local protocols and medical-physics judgment.
              </p>
              <StageSourcesFooter
                count={stageSources.evidenceIds.length}
                label="Sources for this section"
                claimsVisible={predictionCommitted}
              >
                <ImagingSourceList
                  records={stageSources.records}
                  claimsVisible={predictionCommitted}
                />
              </StageSourcesFooter>
            </>
          }
          overlay={helpDialog}
        />
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
 * What changed: the readouts at the start of the Act, after the change the Act asked for, and —
 * when the section had an Observe step — after the reading. Three columns, because an Observe
 * step often brings the suite back to where it started (the projection section returns to the
 * overlap), and a two-column table would then say nothing had changed.
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
      return label ? [`Committed: ${label}`] : []
    }
    case 'sort': {
      const answers = commitments.sorts[step.id]
      if (!answers) return []
      const held = step.interaction.sort.rows.filter((row) => answers[row.id] === row.origin).length
      return [`Placed the set: ${held} of ${step.interaction.sort.rows.length} held.`]
    }
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
}: {
  readonly lesson: ImagingStageLesson
  readonly step: ImagingStageStep
  readonly index: number
  readonly session: ReturnType<typeof useImagingStageSession>['session']
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
}: {
  readonly lesson: ImagingStageLesson
  readonly nextSectionId: string | null
}) {
  const capstoneCase = lesson.spec.capstoneCaseId
    ? imagingCaseById.get(lesson.spec.capstoneCaseId)
    : undefined
  // The plan's pairing rule: a section's completion card points at its own practice case, so the
  // next thing to do after a mechanism is to use it somewhere else.
  const practiceCase = microCasesForSection(lesson.sectionId)[0]
  return (
    <section
      className={styles.completion}
      data-section-completion
      aria-label="Section worked through"
    >
      <p className={styles.kicker}>Worked through</p>
      <p>
        This section is on your record. Nothing here is a mark; the first decisions you made are
        kept as you made them.
      </p>
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
            href={imagingCaseLinkTarget(practiceCase.id)}
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
            href={imagingSectionLinkTarget(nextSectionId)}
            data-next-section={nextSectionId}
          >
            Continue to the next section
          </Link>
        ) : (
          <Link
            className={shellStyles.nowPrimary}
            href={PERIPHERAL_IMAGING_ASSESS_HREF}
            data-next-section="assess"
          >
            Go to the capstone
          </Link>
        )}
        <Link className={shellStyles.nowSecondary} href={PERIPHERAL_IMAGING_NAV_BASE}>
          Back to the overview
        </Link>
      </div>
    </section>
  )
}
