'use client'

import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { ArrowRight, SlidersHorizontal } from 'lucide-react'

import { HeldDisagreement } from '@/features/critical-care/components/teaching/EvidenceRenderers'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { criticalCareSourceConflictById } from '@/features/critical-care/content/sourceConflicts'
import { useCriticalCareActivityAnalytics } from '@/features/learning-module/activity'
import { ChoiceReasoningFeedback } from '@/features/learning-module/components/ChoiceReasoningFeedback'
import { nextPathwaySection } from '@/features/learning-module/curriculum/types'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'
import { useRouter } from '@/i18n/navigation'

import { orderChoices } from '../../content/choiceOrder'
import { ecmoMapAnswerTargets } from '../../content/mapAnswerTargets'
import { ecmoFoundationStageSources } from '../../content/stageSources'
import { deriveEcmoCircuitPresentation } from '../../content/circuitPresentation'
import {
  ecmoCircuitWalkStopsForSection,
  ecmoWalkStopSceneLabelIds,
  ecmoWalkStopSegmentIds,
  type EcmoCircuitWalkStop,
  type EcmoWalkComparisonBeat,
} from '../../content/circuitWalk'
import { ecmoDeliveryComponentById } from '../../content/deliveryAttribution'
import { ecmoFoundationSectionById } from '../../content/foundationLessons'
import {
  ecmoFoundationInitialVariant,
  ecmoFoundationLessonRuntime,
  ecmoFoundationPrimaryVariant,
  ecmoFoundationVariant,
  ecmoFoundationVariants,
  type EcmoFoundationGuidedAction,
  type EcmoInteractiveFoundationSectionId,
} from '../../content/foundationLessonRuntime'
import { ecmoSectionSpecById } from '../../content/sectionSpecs'
import { ecmoStoryProblemsFor } from '../../content/storyProblems'
import { persistTopicVisit } from '../../engine/progress'
import type { SupportMode } from '../../engine/types'
import {
  createEcmoFoundationSessionState,
  ecmoFoundationRestoreAction,
  ecmoFoundationSessionReducer,
  createFoundationVariantState,
  ecmoFoundationSnapshot,
  type EcmoFoundationComparisonPlan,
} from '../../session/foundationSession'
import type { CircuitMapAnswerProps } from '../circuit-map/CircuitMapAnswerFieldset'
import { CardiohelpConsole } from '../CardiohelpConsole'
import { CardiohelpModuleFrame } from '../CardiohelpModuleFrame'
import { EcmoSourceList } from '../evidence/EcmoSourceList'
import { EcmoStageSources } from '../shell/EcmoStageSources'
import { FitWidthSurface } from '../FitWidthSurface'
import { EcmoContextStrip, type EcmoContextStripLine } from '../shell/EcmoContextStrip'
import { EcmoHelpDialog } from '../shell/EcmoHelpDialog'
import { EcmoOptionalExplanation } from '../shell/EcmoOptionalExplanation'
import { EcmoNowCard, type NowCardModel } from '../shell/EcmoNowCard'
import { EcmoLookInLine } from '../shell/EcmoLookInLine'
import { EcmoOtherAnswers, ECMO_VERDICT_FRAMES } from '../shell/EcmoOtherAnswers'
import { EcmoSectionHeader } from '../shell/EcmoSectionHeader'
import { EcmoSimulatorSurfaces } from '../shell/EcmoSimulatorSurfaces'
import { EcmoTrackToggle } from '../shell/EcmoTrackToggle'
import shellStyles from '../shell/EcmoActivityShell.module.css'
import { EcmoFoundationTeachingPanel } from '../teaching/EcmoFoundationTeachingPanel'
import {
  CircuitPressureIdentity,
  PART_MEASUREMENT_IDENTITY,
  styles as teachingStyles,
} from '../teaching/shared'
import { FoundationComparison } from '../teaching/FoundationComparison'
import { type FoundationPressureSite } from '../teaching/CircuitFlowPathPanel'
import { ecmoSensorSite, ecmoGasPathSegmentIds } from '../../content/circuitSegments'
import { buildFoundationStageLesson } from './adapters/foundationStageAdapter'
import { FoundationStoryProblems } from './FoundationStoryProblems'
import { SectionsDrawer } from './SectionsDrawer'
import { StageLayout } from './StageLayout'
import { ActivityContent } from './ActivityContent'
import { ecmoTaskPresentation } from './activityPresentation'
import {
  baselineGroups,
  baselineGroupLabels,
  foundationPresentationSections,
} from './foundationPresentationSections'
import { scrollTaskPaneToTop } from './scrollTaskPaneToTop'
import { StageSourcesScope } from './StageSourcesScope'
import { StageTeachingScope } from './StageTeachingScope'
import { StepList } from './StepList'
import { type StagePhase, type StageSurfaceId } from './stageModel'
import styles from './EcmoLessonStage.module.css'

/**
 * A foundation section on the lesson stage.
 *
 * The session is the foundation reducer, mounted once, fed by every pane: a fault-free reference
 * circuit or an existing case loaded as a non-scored teaching preview, restored atomically. The six
 * authored phases organize the task outline. Only the visited topic and current location persist.
 * Answers and model runs stay in this session; a link or refresh opens a fresh teaching model.
 * Learners may reveal teaching, repeat an optional response, or leave any step without earning
 * a performed action.
 */

const FIXED_PATHWAY_COPY: Readonly<Record<SupportMode, string>> = {
  vv: 'VV pathway · this section teaches series physiology and always runs on the VV reference circuit.',
  va: 'VA pathway · this section teaches parallel circulation and always runs on the VA reference circuit.',
}

const COMBINED_BASELINE_PRESENTATION = {
  kind: 'guided-device',
  console: true,
  surfaces: ['monitor'],
} as const

const DEVICE_BOUNDARY_SHORT =
  'Console follows the U.S. CARDIOHELP Instructions for Use, Revision 2.3 (January 2025). The VV and VA teaching is not limited to the U.S. labeled indication or duration.'

const DEVICE_BOUNDARY_FULL =
  'The simulated console follows the U.S. CARDIOHELP System Instructions for Use, Revision 2.3, January 2025. The VV and VA clinical teaching reflects contemporary ECMO practice and is not limited to the U.S. labeled indication or duration. This independent educational module does not replace current manufacturer instructions, local protocol, or supervised competency validation.'

const LOOKING_BACK =
  'You are looking back at an earlier step; nothing you have worked through is lost.'

interface Progression {
  readonly sectionReviewed: boolean
  readonly index: number
  readonly furthestPerformed: number
  readonly performedIds: readonly string[]
  readonly committedPredictionId: string | null
  readonly committedTransferId: string | null
  readonly storyCommittedByStepId: Readonly<Record<string, string>>
  readonly choiceByStepId: Readonly<Record<string, string>>
  /** Attribution steps: which component the learner assigned to each candidate change. */
  readonly attributionByStepId: Readonly<Record<string, Readonly<Record<string, string>>>>
  readonly review: number | null
  /**
   * The furthest step the learner has ever entered, which is not the same as the furthest performed:
   * entering a step does not perform it. This is what decides whether they are looking back.
   */
  readonly furthestEntered: number
  readonly surfacesByStepId: Readonly<Record<string, readonly StageSurfaceId[]>>
  /** The step whose teaching column the learner chose to see in full before committing. */
  readonly expandedTeachingStepId: string | null
}

export function FoundationStageHost({
  sectionId,
  supportMode,
  initialPhase = 'recognize',
  locale = 'en',
}: {
  readonly sectionId: EcmoInteractiveFoundationSectionId
  readonly supportMode: SupportMode
  /** The phase the URL asked for. Nothing about it is persisted. */
  readonly initialPhase?: StagePhase
  readonly locale?: string
}) {
  const runtime = ecmoFoundationLessonRuntime(sectionId)
  const resolvedMode = runtime.supportMode ?? supportMode
  const [restartCount, setRestartCount] = useState(0)
  return (
    <FoundationStageSession
      key={`${sectionId}:${resolvedMode}:${initialPhase}:${restartCount}`}
      sectionId={sectionId}
      supportMode={resolvedMode}
      requestedPhase={initialPhase}
      locale={locale}
      onRestart={() => setRestartCount((count) => count + 1)}
    />
  )
}

function FoundationStageSession({
  sectionId,
  supportMode,
  requestedPhase,
  locale,
  onRestart,
}: {
  readonly sectionId: EcmoInteractiveFoundationSectionId
  readonly supportMode: SupportMode
  readonly requestedPhase: StagePhase
  readonly locale: string
  readonly onRestart: () => void
}) {
  const router = useRouter()
  const runtime = ecmoFoundationLessonRuntime(sectionId)
  const section = ecmoFoundationSectionById.get(sectionId)
  const lesson = useMemo(
    () => buildFoundationStageLesson(sectionId, supportMode),
    [sectionId, supportMode],
  )
  const focusedFoundation = Boolean(lesson.steps[0]?.foundationTask)
  // These teaching sequences restart at their first task on refresh/deep links. No demonstration,
  // answer, or performed step is reconstructed from a URL or historical completion record.
  const mount = { index: 0, clamped: requestedPhase !== 'recognize' }
  const mountPhase = lesson.steps[mount.index]?.phase ?? 'recognize'
  const variants = ecmoFoundationVariants(runtime, supportMode)
  const primaryVariant = ecmoFoundationPrimaryVariant(runtime, supportMode)
  const initialVariant = ecmoFoundationInitialVariant(runtime, supportMode, mountPhase)
  const trackIsFixed = runtime.supportMode !== undefined

  const [session, dispatch] = useReducer(ecmoFoundationSessionReducer, initialVariant, (variant) =>
    createEcmoFoundationSessionState(
      focusedFoundation ? { ...variant, holdsClock: true } : variant,
    ),
  )
  const [progression, setProgression] = useState<Progression>(() => ({
    sectionReviewed: false,
    index: mount.index,
    furthestPerformed: -1,
    performedIds: [],
    committedPredictionId: null,
    committedTransferId: null,
    storyCommittedByStepId: {},
    choiceByStepId: {},
    attributionByStepId: {},
    review: null,
    furthestEntered: mount.index,
    surfacesByStepId: {},
    expandedTeachingStepId: null,
  }))
  const walkStops = ecmoCircuitWalkStopsForSection(sectionId)
  const [activeWalkStop, setActiveWalkStop] = useState<EcmoCircuitWalkStop | null>(
    walkStops[0] ?? null,
  )
  const [activeComparisonId, setActiveComparisonId] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const nowFocusRef = useRef<HTMLDivElement>(null)
  const teachingRef = useRef<HTMLDivElement>(null)
  const [baselineGroupIndex, setBaselineGroupIndex] = useState(0)
  const [pressureSite, setPressureSite] = useState<FoundationPressureSite>('pVen')

  const activeIndex = Math.min(progression.index, lesson.steps.length - 1)
  const activeStep = lesson.steps[activeIndex]
  const mappedPresentation = ecmoTaskPresentation(lesson, activeStep)
  const normalReading =
    (sectionId === 'vv-normal-state' || sectionId === 'va-normal-state') &&
    activeStep.phase === 'recognize'
  const readingGroups = baselineGroups[supportMode]
  const baselineGroup = normalReading ? readingGroups[baselineGroupIndex] : undefined
  const presentation =
    normalReading && baselineGroup === 'all' ? COMBINED_BASELINE_PRESENTATION : mappedPresentation
  const performedIds = useMemo(() => new Set(progression.performedIds), [progression.performedIds])
  const foundationTask = activeStep.foundationTask
  const focusedStory = foundationTask?.storyProblemId
    ? ecmoStoryProblemsFor(sectionId).find((story) => story.id === foundationTask.storyProblemId)
    : undefined
  const storyCommittedId = progression.storyCommittedByStepId[activeStep.id]
  const comparisonStep = foundationTask?.comparisonOf
    ? lesson.steps.find((step) => step.id === `${sectionId}-${foundationTask.comparisonOf}`)
    : foundationTask?.actionId
      ? activeStep
      : undefined
  const comparisonPlan = comparisonStep ? comparisonPlanFor(comparisonStep) : undefined
  const savedComparison = comparisonPlan ? session.comparisons[comparisonPlan.taskId] : undefined
  const comparisonReady =
    !foundationTask?.actionId || savedComparison?.actionId === foundationTask.actionId
  const stepPerformed = performedIds.has(activeStep.id) && comparisonReady
  const focusedMapQuestion =
    (activeStep.interaction.kind === 'prediction' ||
      activeStep.interaction.kind === 'transfer-item') &&
    ecmoMapAnswerTargets(activeStep.interaction.item.id) !== null
  const isLastStep = activeIndex === lesson.steps.length - 1
  const predictionCommitted = progression.committedPredictionId !== null
  const finished = progression.committedTransferId !== null || progression.sectionReviewed
  const sectionSpec = ecmoSectionSpecById.get(sectionId)
  const pathway = criticalCareLearningPathway('cardiohelp-ecmo', supportMode)
  const nextSection = nextPathwaySection(pathway, sectionId)
  const conflict = section?.heldDisagreementId
    ? criticalCareSourceConflictById.get(section.heldDisagreementId)
    : undefined

  const lifecycleAnalytics = useCriticalCareActivityAnalytics({
    moduleId: 'cardiohelp-ecmo',
    activityId: lesson.lifecycleActivityId,
    mode: 'guided',
    phase: activeStep.phase,
    enabled: false,
  })

  useEffect(() => {
    persistTopicVisit({ section: 'learn', scenarioId: sectionId, supportMode })
  }, [sectionId, supportMode])

  const running = session.clockRunning
  useEffect(() => {
    if (!running) return undefined
    const timer = setInterval(
      () => dispatch({ type: 'SIMULATION', action: { type: 'STEP' } }),
      1000,
    )
    return () => clearInterval(timer)
  }, [running])

  useEffect(() => {
    nowFocusRef.current?.focus({ preventScroll: true })
    scrollTaskPaneToTop(nowFocusRef.current)
  }, [activeStep.id, baselineGroup])

  useEffect(() => {
    if (!foundationTask || presentation) return
    const frame = requestAnimationFrame(() => {
      const target = teachingRef.current?.querySelector<HTMLElement>(
        `[data-active-foundation-block="${foundationTask.block}"]`,
      )
      if (!target) return
      // Scroll only the teaching pane, once on entry, never on a simulation update.
      for (let pane = target.parentElement; pane; pane = pane.parentElement) {
        const overflow = window.getComputedStyle(pane).overflowY
        if (
          (overflow === 'auto' || overflow === 'scroll') &&
          pane.scrollHeight > pane.clientHeight
        ) {
          pane.scrollTop +=
            target.getBoundingClientRect().top - pane.getBoundingClientRect().top - 48
          break
        }
      }
      if (activeStep.lookIn?.pane === 'teaching') {
        const heading = target.querySelector<HTMLElement>('h3')
        if (heading) {
          heading.tabIndex = -1
          heading.focus({ preventScroll: true })
        }
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [activeStep.id, activeStep.lookIn?.pane, foundationTask, presentation])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('phase', activeStep.phase)
    window.history.replaceState(window.history.state, '', url)
  }, [activeStep.phase])

  /* ---------------------------------------------------------------- *
   * Bounded actions and the walk
   * ---------------------------------------------------------------- */

  function comparisonPlanFor(
    step: (typeof lesson.steps)[number],
  ): EcmoFoundationComparisonPlan | undefined {
    const actionId = step.foundationTask?.actionId
    const guided = runtime.guidedActions.find((action) => action.id === actionId)
    const resultVariant = guided?.variantId
      ? ecmoFoundationVariant(runtime, supportMode, guided.variantId)
      : undefined
    if (!guided || !resultVariant) return undefined
    return { taskId: step.id, baselineVariant: primaryVariant, resultVariant, guided }
  }

  function runFocusedComparison(plan: EcmoFoundationComparisonPlan) {
    dispatch({ type: 'RUN_COMPARISON', plan })
    requestAnimationFrame(() => {
      const result = nowFocusRef.current?.querySelector<HTMLElement>('[data-foundation-comparison]')
      if (!result) return
      for (let pane = result.parentElement; pane; pane = pane.parentElement) {
        const overflow = window.getComputedStyle(pane).overflowY
        if (
          (overflow === 'auto' || overflow === 'scroll') &&
          pane.scrollHeight > pane.clientHeight
        ) {
          pane.scrollTop +=
            result.getBoundingClientRect().top - pane.getBoundingClientRect().top - 48
          break
        }
      }
      const heading = result.querySelector<HTMLElement>('h3')
      if (heading) {
        heading.tabIndex = -1
        heading.focus({ preventScroll: true })
      }
    })
  }

  function resetFocusedComparison(plan: EcmoFoundationComparisonPlan) {
    dispatch({ type: 'OPEN_COMPARISON', plan, reset: true })
    setProgression((current) => ({
      ...current,
      performedIds: current.performedIds.filter((id) => id !== plan.taskId),
    }))
    requestAnimationFrame(() => scrollTaskPaneToTop(nowFocusRef.current))
  }

  function runGuidedAction(guided: EcmoFoundationGuidedAction) {
    if (guided.kind === 'restore-and-apply') {
      const variant = guided.variantId
        ? ecmoFoundationVariant(runtime, supportMode, guided.variantId)
        : undefined
      if (!variant) return
      dispatch(ecmoFoundationRestoreAction(variant, guided))
      return
    }
    if (guided.kind === 'advance') {
      dispatch({ type: 'ADVANCE', seconds: guided.settleSeconds, id: guided.id })
      return
    }
    dispatch(
      guided.capturesSnapshot
        ? { type: 'CAPTURE_SNAPSHOT', id: guided.id }
        : { type: 'RECORD_INTERACTION', id: guided.id },
    )
  }

  function runComparisonBeat(beat: EcmoWalkComparisonBeat) {
    const guided = runtime.guidedActions.find((action) => action.id === beat.guidedActionId)
    if (!guided) return
    setActiveComparisonId(beat.id)
    runGuidedAction(guided)
  }

  const displayWalkStop = foundationTask?.walkStopId
    ? (walkStops.find((stop) => stop.id === foundationTask.walkStopId) ?? null)
    : focusedFoundation && foundationTask?.block !== 'blood-path'
      ? null
      : activeWalkStop
  const emphasisSceneLabelIds = displayWalkStop
    ? ecmoWalkStopSceneLabelIds(displayWalkStop, supportMode)
    : null
  const circuitPresentation =
    foundationTask?.block === 'pressure-sites'
      ? deriveEcmoCircuitPresentation(session.simulation, {
          kind: 'foundation-walk-stop',
          stopId: `pressure-${pressureSite}`,
          segmentIds: [ecmoSensorSite(pressureSite).segmentId],
          sensorSiteIds: [pressureSite, ...ecmoSensorSite(pressureSite).derivedFromSiteIds],
        })
      : foundationTask?.block === 'gas-path'
        ? deriveEcmoCircuitPresentation(session.simulation, {
            kind: 'foundation-walk-stop',
            stopId: 'gas-path',
            segmentIds: ecmoGasPathSegmentIds,
            sensorSiteIds: [],
          })
        : displayWalkStop
          ? deriveEcmoCircuitPresentation(session.simulation, {
              kind: 'foundation-walk-stop',
              stopId: displayWalkStop.id,
              segmentIds: ecmoWalkStopSegmentIds(displayWalkStop),
              sensorSiteIds:
                focusedFoundation || predictionCommitted ? displayWalkStop.sensorSiteIds : [],
            })
          : null
  // The map opens on the step's authored view, once per step entry; the walk sections author the
  // pressure-zone map so the marked stop is on screen without a tab click.
  const circuitViewPreference = activeStep.circuitView
    ? { view: activeStep.circuitView, stepId: activeStep.id }
    : null

  /* ---------------------------------------------------------------- *
   * Progression
   * ---------------------------------------------------------------- */

  function enterStep(index: number, performedNow: readonly string[]) {
    const nextStep = lesson.steps[index]
    if (!nextStep) return
    const comparisonOwner = nextStep.foundationTask?.comparisonOf
      ? lesson.steps.find(
          (step) => step.id === `${sectionId}-${nextStep.foundationTask?.comparisonOf}`,
        )
      : nextStep
    const plan = comparisonOwner ? comparisonPlanFor(comparisonOwner) : undefined
    if (plan) dispatch({ type: 'OPEN_COMPARISON', plan })
    if (nextStep.entryVariantId) {
      const variant = ecmoFoundationVariant(runtime, supportMode, nextStep.entryVariantId)
      if (variant) dispatch(ecmoFoundationRestoreAction(variant))
    }
    setProgression((current) => ({
      ...current,
      index,
      review: null,
      performedIds: performedNow,
      furthestEntered: Math.max(current.furthestEntered, index),
      furthestPerformed: Math.max(current.furthestPerformed, index - 1),
    }))
  }

  function recordPerformed(stepId: string): readonly string[] {
    return progression.performedIds.includes(stepId)
      ? progression.performedIds
      : [...progression.performedIds, stepId]
  }

  const walkingBloodPath = Boolean(presentation && foundationTask?.block === 'blood-path')
  const walkIndex = walkStops.findIndex((stop) => stop.id === activeWalkStop?.id)

  function advance() {
    if (normalReading && baselineGroupIndex < readingGroups.length - 1) {
      setBaselineGroupIndex(baselineGroupIndex + 1)
      return
    }
    if (walkingBloodPath && walkIndex < walkStops.length - 1) {
      setActiveWalkStop(walkStops[walkIndex + 1])
      return
    }
    // Guard the actual Continue handler, not just its button. A reset invalidates this task's
    // comparison, even if its step had previously been marked performed.
    if (!comparisonReady) return
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
    enterStep(next, performedNow)
  }

  function skipStep() {
    if (isLastStep) setProgression((current) => ({ ...current, sectionReviewed: true }))
    else enterStep(activeIndex + 1, progression.performedIds)
  }

  function retryQuestion() {
    setProgression((current) => ({
      ...current,
      sectionReviewed: false,
      performedIds: current.performedIds.filter((id) => id !== activeStep.id),
      committedPredictionId:
        activeStep.interaction.kind === 'prediction' ? null : current.committedPredictionId,
      committedTransferId:
        activeStep.interaction.kind === 'transfer-item' ? null : current.committedTransferId,
      storyCommittedByStepId: { ...current.storyCommittedByStepId, [activeStep.id]: '' },
      choiceByStepId: { ...current.choiceByStepId, [activeStep.id]: '' },
      attributionByStepId: { ...current.attributionByStepId, [activeStep.id]: {} },
    }))
  }

  const selectedChoiceId = progression.choiceByStepId[activeStep.id] ?? null

  /**
   * Commit the whole set of attributions at once.
   *
   * One commitment for the set rather than one per row, so the learner reasons across all of them
   * before any of them is marked — two of the candidates act on the same component by different
   * routes, and revealing the first would give away the second.
   */
  function commitAttribution() {
    if (activeStep.interaction.kind !== 'attribution' || stepPerformed) return
    const answers = progression.attributionByStepId[activeStep.id] ?? {}
    const complete = activeStep.interaction.attribution.candidates.every(
      (candidate) => answers[candidate.id],
    )
    if (!complete) return
    const performedNow = recordPerformed(activeStep.id)
    setProgression((current) => ({
      ...current,
      performedIds: performedNow,
      furthestPerformed: Math.max(current.furthestPerformed, activeIndex),
    }))
  }

  function commitPrediction() {
    if (activeStep.interaction.kind !== 'prediction' || !selectedChoiceId || stepPerformed) return
    const performedNow = recordPerformed(activeStep.id)
    setProgression((current) => ({
      ...current,
      committedPredictionId: selectedChoiceId,
      performedIds: performedNow,
      furthestPerformed: Math.max(current.furthestPerformed, activeIndex),
    }))
    lifecycleAnalytics.recordPredictionSubmitted()
  }

  function commitTransfer() {
    if (activeStep.interaction.kind !== 'transfer-item' || !selectedChoiceId || stepPerformed)
      return
    const performedNow = recordPerformed(activeStep.id)
    setProgression((current) => ({
      ...current,
      committedTransferId: selectedChoiceId,
      performedIds: performedNow,
      furthestPerformed: Math.max(current.furthestPerformed, activeIndex),
    }))
    lifecycleAnalytics.recordTransferCompleted()
    lifecycleAnalytics.recordActivityCompleted()
  }

  /**
   * Selecting a row in the step list reviews it in place, and changes nothing else.
   *
   * Deliberately not navigation. Entering a step loads the state that step's copy is written
   * against — `phase-restoration` pins that — so a row that teleported would silently discard an
   * evolved case the learner had built with the bounded actions. The way back is the Now card's
   * Back control, which steps one at a time and says what it is doing.
   */
  function selectStepRow(index: number) {
    goToStep(index)
  }

  /**
   * Back to a step already worked, on the learner's own request.
   *
   * An owner review in September 2026 found learners restarting a whole section to revisit one
   * step, because the step list only ever expanded a recap and nothing offered a way back. This is
   * that way back: the performed set is carried through untouched, so the section does not lose its
   * progress, and the step is entered exactly as it is entered going forward — including reloading
   * the state its copy assumes, because a step read against someone else's state is a step whose
   * copy is no longer true.
   */
  function goToStep(index: number) {
    const target = lesson.steps[index]
    if (!target || index === progression.index) return
    enterStep(index, progression.performedIds)
  }

  function toggleSurface(surface: StageSurfaceId, open: boolean) {
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
      pathname: `${cardiohelpEcmoNavBase}/learn`,
      query: { lesson: targetId, track: supportMode },
    })
  }

  const openSurfaces = useMemo(
    () =>
      new Set<StageSurfaceId>(progression.surfacesByStepId[activeStep.id] ?? activeStep.surfaces),
    [activeStep.id, activeStep.surfaces, progression.surfacesByStepId],
  )
  const activeVariant =
    variants.find((variant) => variant.id === session.variantId) ?? primaryVariant

  /* ---------------------------------------------------------------- *
   * The Now card
   * ---------------------------------------------------------------- */

  const stepPosition = `Task ${activeStep.ordinal} of ${lesson.steps.length}`

  /*
   * Where this step's work is done, said in the same words the pane carries.
   *
   * One line, under the instruction, on every step. It exists because a learner review in September
   * 2026 found four steps on which the only way to know which of three panes was meant was to try
   * them: "I'm guessing I should read the middle panel, but not sure." `StageLayout` prints the
   * matching caption on the pane itself, and `foundationLessonRuntime` refuses at import to author a
   * phase without a location, so the two cannot drift apart.
   */
  const lookInLine =
    !presentation && activeStep.lookIn ? <EcmoLookInLine location={activeStep.lookIn} /> : undefined
  const previousStep = activeIndex > 0 ? lesson.steps[activeIndex - 1] : undefined
  const canGoBack = previousStep !== undefined
  const lookingBack = activeIndex < progression.furthestEntered
  /** A step's own status line, with the looking-back reassurance appended when it applies. */
  const withLookingBack = (own: string) => (lookingBack ? `${own} ${LOOKING_BACK}` : own)

  const nowModel: NowCardModel = (() => {
    /*
     * The way back, offered on every step after the first.
     *
     * The previous step is performed by construction — a learner only reaches step N by working
     * step N-1, and a lesson mounted at a later phase marks the steps before it performed — so this
     * is always a real destination rather than a control that sometimes does nothing.
     */
    const base = {
      kicker: stepPosition,
      heading: activeStep.title,
      body: activeStep.instruction,
      where: presentation ? undefined : lookInLine,
      why: activeStep.rationale,
      primaryBeforeContent: Boolean(
        comparisonPlan && !savedComparison && (!focusedStory || storyCommittedId),
      ),
      ...(canGoBack && previousStep
        ? {
            back: {
              label: `Back to ${previousStep.title}`,
              onActivate: () => goToStep(activeIndex - 1),
            },
          }
        : {}),
      ...(lookingBack ? { status: LOOKING_BACK } : {}),
    }
    if (normalReading)
      return {
        ...base,
        body: `Read ${baselineGroupLabels[baselineGroup ?? 'all'].toLowerCase()} against this modeled run's own reference. These values are not universal treatment targets.`,
        kicker: `${stepPosition} · Signal group ${baselineGroupIndex + 1} of ${readingGroups.length}`,
        ...(baselineGroupIndex > 0
          ? {
              back: {
                label: 'Back to the previous signal group',
                onActivate: () => setBaselineGroupIndex(baselineGroupIndex - 1),
              },
            }
          : {}),
        primary: {
          label:
            baselineGroupIndex < readingGroups.length - 1
              ? `Continue to ${baselineGroupLabels[readingGroups[baselineGroupIndex + 1]]}`
              : 'Continue',
          onActivate: advance,
        },
      }
    if (walkingBloodPath)
      return {
        ...base,
        ...(walkIndex > 0
          ? {
              back: {
                label: 'Back along the blood path',
                onActivate: () => setActiveWalkStop(walkStops[walkIndex - 1]),
              },
            }
          : {}),
        primary: {
          label:
            walkIndex < walkStops.length - 1
              ? 'Follow blood to the next stop'
              : 'Continue to the gas path',
          onActivate: advance,
        },
      }
    if (focusedStory && !storyCommittedId && !savedComparison)
      return {
        ...base,
        primary: {
          label: 'Submit answer',
          disabled: !selectedChoiceId,
          disabledReason: 'Choose an option before running the story comparison.',
          onActivate: () => {
            if (!selectedChoiceId || progression.storyCommittedByStepId[activeStep.id]) return
            setProgression((current) => ({
              ...current,
              storyCommittedByStepId: {
                ...current.storyCommittedByStepId,
                [activeStep.id]: selectedChoiceId,
              },
            }))
          },
        },
      }
    switch (activeStep.interaction.kind) {
      case 'attribution': {
        const answers = progression.attributionByStepId[activeStep.id] ?? {}
        const unanswered = activeStep.interaction.attribution.candidates.filter(
          (candidate) => !answers[candidate.id],
        ).length
        return stepPerformed
          ? {
              ...base,
              status: withLookingBack('Answers recorded.'),
              primary: isLastStep
                ? undefined
                : {
                    label: 'Continue',
                    onActivate: advance,
                    icon: <ArrowRight aria-hidden="true" />,
                  },
            }
          : {
              ...base,
              primary: {
                label: activeStep.actionLabel,
                onActivate: commitAttribution,
                disabled: unanswered > 0,
                disabledReason:
                  unanswered === 1
                    ? 'One change still needs a component.'
                    : `${unanswered} changes still need a component.`,
                icon: <SlidersHorizontal aria-hidden="true" />,
              },
            }
      }
      case 'prediction':
        if (focusedMapQuestion) return base
        return stepPerformed
          ? { ...base, status: withLookingBack('Committed.') }
          : {
              ...base,
              primary: {
                label: activeStep.actionLabel,
                onActivate: commitPrediction,
                disabled: selectedChoiceId === null,
                disabledReason: 'Choose one option to enable this.',
                icon: <SlidersHorizontal aria-hidden="true" />,
              },
            }
      case 'transfer-item':
        if (focusedMapQuestion) return base
        return stepPerformed
          ? { ...base, status: withLookingBack('This section is available to review at any time.') }
          : {
              ...base,
              primary: {
                label: activeStep.actionLabel,
                onActivate: commitTransfer,
                disabled: selectedChoiceId === null,
                disabledReason: 'Choose one option to enable this.',
                icon: <SlidersHorizontal aria-hidden="true" />,
              },
            }
      case 'bounded-actions':
        if (comparisonPlan && foundationTask?.actionId)
          return {
            ...base,
            status: savedComparison
              ? 'Comparison saved. Review Before / After / Change, then continue.'
              : 'Run the guided comparison before continuing.',
            primary: savedComparison
              ? { label: 'Continue', onActivate: advance }
              : {
                  label: comparisonPlan.guided.label,
                  onActivate: () => runFocusedComparison(comparisonPlan),
                },
          }
        return { ...base, primary: { label: activeStep.actionLabel, onActivate: advance } }
      default:
        return stepPerformed && isLastStep
          ? { ...base, status: withLookingBack('Done.') }
          : {
              ...base,
              primary: {
                label: activeStep.actionLabel,
                onActivate: advance,
                icon: <ArrowRight aria-hidden="true" />,
              },
            }
    }
  })()

  /*
   * The prediction, when it is a question about a place.
   *
   * `content/mapAnswerTargets` says which items are answered on the circuit: every choice has to be
   * somewhere on the drawing, or the item keeps its list. When one qualifies the radio group moves
   * out of this pane and onto the map as numbered pins, and the map also carries the question and submission control for the introductory tasks.
   */
  const mapAnswerItem =
    activeStep.interaction.kind === 'prediction' || activeStep.interaction.kind === 'transfer-item'
      ? activeStep.interaction.item
      : null
  const mapAnswerTargets = mapAnswerItem ? ecmoMapAnswerTargets(mapAnswerItem.id) : null
  const mapAnswer: CircuitMapAnswerProps | null =
    mapAnswerItem && mapAnswerTargets
      ? {
          item: mapAnswerItem,
          targets: mapAnswerTargets,
          selectedChoiceId: selectedChoiceId ?? null,
          committedChoiceId:
            activeStep.interaction.kind === 'prediction'
              ? progression.committedPredictionId
              : progression.committedTransferId,
          correctChoiceIds: mapAnswerItem.correctChoiceIds,
          name: `ecmo-foundation-${activeStep.id}`,
          ...(focusedMapQuestion
            ? {
                inlineActions: (
                  <div className={styles.mapQuestionActions} data-map-question-actions>
                    {!stepPerformed && selectedChoiceId ? (
                      <p data-map-answer-chosen>
                        Your answer:{' '}
                        {
                          mapAnswerItem.choices.find((choice) => choice.id === selectedChoiceId)
                            ?.label
                        }
                      </p>
                    ) : null}
                    {!stepPerformed ? (
                      <>
                        <button
                          type="button"
                          className={shellStyles.nowPrimary}
                          disabled={!selectedChoiceId}
                          onClick={
                            activeStep.interaction.kind === 'prediction'
                              ? commitPrediction
                              : commitTransfer
                          }
                        >
                          Submit answer
                        </button>
                        {!selectedChoiceId ? (
                          <p>Choose a numbered place to enable Submit answer.</p>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div data-verdict>
                          <ChoiceReasoningFeedback
                            choice={
                              mapAnswerItem.choices.find(
                                (choice) => choice.id === selectedChoiceId,
                              )!
                            }
                            outcome="stated"
                            frames={ECMO_VERDICT_FRAMES}
                            explanation={mapAnswerItem.explanation}
                            evidenceIds={mapAnswerItem.evidenceIds}
                          />
                          <EcmoOtherAnswers
                            item={mapAnswerItem}
                            committedChoiceId={selectedChoiceId!}
                          />
                        </div>
                        {activeStep.interaction.kind === 'prediction' ? (
                          <button
                            type="button"
                            className={shellStyles.nowPrimary}
                            onClick={advance}
                          >
                            Continue
                          </button>
                        ) : nextSection ? (
                          <div data-stage-completion>
                            <p>Section reviewed.</p>
                            <button
                              type="button"
                              className={shellStyles.nowPrimary}
                              onClick={() => goToSection(nextSection.id)}
                            >
                              Continue to {nextSection.title}
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                ),
              }
            : {}),
          onSelect: (choiceId) =>
            setProgression((current) => ({
              ...current,
              choiceByStepId: { ...current.choiceByStepId, [activeStep.id]: choiceId },
            })),
        }
      : null
  /*
   * Which pane a compact viewport opens on for this step.
   *
   * A map-answered step's only answer control is the set of places on the circuit map, in the
   * simulator pane, and at a compact width exactly one pane is on screen — so that step has to open
   * there whatever its authored location says. Everything else follows the location the Now card
   * prints, so the pane the learner is sent to is the pane they are shown.
   */
  const compactPane = mapAnswer
    ? 'tertiary'
    : activeStep.lookIn?.pane === 'teaching'
      ? 'secondary'
      : activeStep.lookIn?.pane === 'simulator'
        ? 'tertiary'
        : 'primary'

  function choiceFieldset(
    item: {
      readonly id: string
      readonly stem: string
      readonly choices: readonly { id: string; label: string }[]
    },
    legendId: string,
    disabled = stepPerformed,
  ) {
    return (
      <fieldset
        className={styles.choiceList}
        disabled={disabled}
        aria-labelledby={legendId}
        data-prediction-choices
      >
        <legend id={legendId}>{item.stem}</legend>
        {orderChoices(item.id, item.choices).map((choice) => (
          <label
            key={choice.id}
            className={styles.choice}
            data-selected={selectedChoiceId === choice.id}
          >
            <input
              type="radio"
              name={`ecmo-foundation-${activeStep.id}`}
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

  /*
   * Every applicable teaching step can load its authored state. Transfer needs it too: the VV capstone's
   * transfer answer is "load the re-drainage preview and read it", which cannot happen if the
   * actions vanish when the transfer item appears.
   *
   * Open on Act and on Observe, folded elsewhere. Observe was folded until a learner review in
   * September 2026: four sections tell the learner at that step to compare a value "after each
   * action" or "in both states", and the buttons those sentences mean were behind a closed
   * disclosure on a step where the console is not operable either.
   *
   * On the Act step this whole block is handed to the Now card as its interaction body rather than
   * rendered after it, which is what the card's own contract has always said should happen with it.
   * Before that it sat below the card, in the same flat outlined box as a radio option, beside a
   * bright "Continue" that advanced the step without any action having been run — so the only
   * control that looked like a control was the one that skipped the work.
   */
  const boundedActions =
    !focusedFoundation && activeStep.phase !== 'recognize' && activeStep.phase !== 'predict' ? (
      <details
        className={styles.boundedActionsPanel}
        open={activeStep.phase === 'act' || activeStep.phase === 'observe'}
        data-bounded-actions
      >
        <summary>Actions you can take</summary>
        <div className={styles.boundedActions}>
          {runtime.guidedActions.map((guided) => (
            <button
              key={guided.id}
              type="button"
              className={styles.boundedAction}
              data-guided-action={guided.id}
              data-guided-action-kind={guided.kind}
              onClick={() => runGuidedAction(guided)}
            >
              <span className="font-semibold">{guided.label}</span>
              <small>{guided.description}</small>
            </button>
          ))}
          {session.interactionsSinceRestore.length > 0 ? (
            <div data-interaction-evidence>
              <p className={shellStyles.kicker}>Looked at since this circuit was loaded</p>
              <ul className="mt-1 grid gap-1">
                {session.interactionsSinceRestore.map((id) => (
                  <li key={id} data-interaction={id}>
                    {runtime.guidedActions.find((guided) => guided.id === id)?.label ?? id}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </details>
    ) : null

  const nowBody = (() => {
    const { interaction } = activeStep
    if (focusedMapQuestion) return null
    if (focusedStory) {
      const choice = focusedStory.item.choices.find(
        (candidate) => candidate.id === storyCommittedId,
      )
      return (
        <>
          {choiceFieldset(focusedStory.item, 'story-prediction-heading', Boolean(choice))}
          {choice ? (
            <ChoiceReasoningFeedback
              choice={choice}
              outcome="stated"
              frames={ECMO_VERDICT_FRAMES}
              explanation={focusedStory.item.explanation}
              evidenceIds={focusedStory.item.evidenceIds}
            />
          ) : null}
        </>
      )
    }
    if (interaction.kind === 'attribution') {
      const { attribution } = interaction
      const answers = progression.attributionByStepId[activeStep.id] ?? {}
      const revealed = stepPerformed
      return (
        <div className={styles.attribution} data-attribution>
          <p className={styles.attributionPrompt}>{attribution.prompt}</p>
          {attribution.candidates.map((candidate) => {
            const chosen = answers[candidate.id]
            const right = chosen === candidate.componentId
            const actual = ecmoDeliveryComponentById(candidate.componentId)
            const selectId = `attribution-${candidate.id}`
            return (
              <div
                key={candidate.id}
                className={styles.attributionRow}
                data-attribution-candidate={candidate.id}
                data-attribution-outcome={
                  revealed ? (right ? 'correct' : 'not-correct') : undefined
                }
              >
                <label htmlFor={selectId}>{candidate.label}</label>
                <select
                  id={selectId}
                  value={chosen ?? ''}
                  disabled={revealed}
                  onChange={(event) =>
                    setProgression((current) => ({
                      ...current,
                      attributionByStepId: {
                        ...current.attributionByStepId,
                        [activeStep.id]: {
                          ...(current.attributionByStepId[activeStep.id] ?? {}),
                          [candidate.id]: event.target.value,
                        },
                      },
                    }))
                  }
                >
                  <option value="">Choose a component…</option>
                  {attribution.components.map((component) => (
                    <option key={component.id} value={component.id}>
                      {component.label}
                    </option>
                  ))}
                </select>
                {revealed ? (
                  <p className={styles.attributionVerdict}>
                    <strong data-attribution-outcome-label>
                      {right ? 'Correct.' : 'Not correct.'}
                    </strong>{' '}
                    {right ? '' : `This acts on ${actual?.label.toLowerCase()}. `}
                    {candidate.rationale}
                  </p>
                ) : null}
              </div>
            )
          })}
          {revealed ? (
            <div className={styles.attributionComponents} data-attribution-components>
              {attribution.components.map((component) => (
                <p key={component.id}>
                  <strong>{component.label}.</strong> {component.definition}
                </p>
              ))}
            </div>
          ) : null}
          <EcmoSourceList
            compact
            evidenceIds={attribution.sourceIds}
            claims={attribution.claims}
            title="Sources"
            headingLevel={4}
          />
        </div>
      )
    }
    if (interaction.kind === 'bounded-actions') return focusedFoundation ? null : boundedActions
    if (interaction.kind === 'prediction' || interaction.kind === 'transfer-item') {
      const { item } = interaction
      const committedId =
        interaction.kind === 'prediction'
          ? progression.committedPredictionId
          : progression.committedTransferId
      const committedChoice = item.choices.find((choice) => choice.id === committedId)
      return (
        <>
          {mapAnswer && focusedMapQuestion ? null : mapAnswer ? (
            <div className={styles.mapAnswerPrompt} data-map-answer-prompt>
              <p id="prediction-heading" className={styles.mapAnswerStem}>
                {item.stem}
              </p>
              <p>
                Choose the place on the circuit map in the Simulator panel. Four places are numbered
                on the drawing, and the same numbers label the choices.
              </p>
              {selectedChoiceId ? (
                <p data-map-answer-chosen>
                  <strong>You have chosen:</strong>{' '}
                  {item.choices.find((choice) => choice.id === selectedChoiceId)?.label}
                </p>
              ) : null}
            </div>
          ) : (
            choiceFieldset(
              item,
              interaction.kind === 'prediction' ? 'prediction-heading' : 'transfer-heading',
            )
          )}
          {committedChoice ? (
            <div className="grid gap-3" data-verdict>
              <ChoiceReasoningFeedback
                choice={committedChoice}
                outcome="stated"
                frames={ECMO_VERDICT_FRAMES}
                explanation={item.explanation}
                evidenceIds={item.evidenceIds}
              />
              {/*
                Why the other answers do not fit.

                Five foundation sections tell the learner, one pane to the left, to "commit a
                prediction, then read why the other answers do not fit" — and this card showed only
                the chosen option's rationale, so there was nothing to read. The drill half of the
                same pathway has offered exactly this disclosure all along; the shared card the
                foundations render does not, and is four other modules' as well. So the foundations
                render it themselves, in the wording their own instruction already uses.
              */}
              <EcmoOtherAnswers item={item} committedChoiceId={committedChoice.id} />
              {interaction.kind === 'prediction' && !focusedMapQuestion ? (
                <button type="button" className={shellStyles.nowPrimary} onClick={advance}>
                  Continue
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )
    }
    return null
  })()

  /* ---------------------------------------------------------------- *
   * Panes
   * ---------------------------------------------------------------- */

  const simulation = session.simulation
  const activeAlarm = simulation.alarms.find((alarm) => alarm.active && alarm.source === 'device')
  const contextLine: EcmoContextStripLine = {
    mode: supportMode.toUpperCase(),
    flow: simulation.circuit.flowSensorConnected
      ? `${simulation.circuit.bloodFlow.toFixed(2)} L/min`
      : '-- · flow sensor disconnected',
    rpm: `${simulation.device.rpmSetpoint} RPM`,
    sweep: `${simulation.gas.sweepLpm.toFixed(1)} L/min`,
    alarm: activeAlarm
      ? { priority: activeAlarm.priority, text: activeAlarm.message }
      : { priority: 'none', text: 'No active device alarm' },
  }

  const stateCard = (
    <div className={styles.stateCard} data-active-state-variant={activeVariant.id}>
      <p className={shellStyles.kicker}>Model reference for this task</p>
      <p className="font-semibold">{activeVariant.label}</p>
      {running ? null : (
        <p data-clock-held>
          {focusedFoundation
            ? 'The clock is held. Each guided comparison advances through its stated modeled interval.'
            : 'The clock is held here, so the circuit stays as it is until you start it.'}
        </p>
      )}
      {activeVariant.modelBoundary ? (
        <p data-variant-boundary>{activeVariant.modelBoundary}</p>
      ) : null}
      {focusedFoundation ? (
        <p>
          Observation-only display. Use the enabled guided controls beside this display; each
          comparison starts from the reference and holds its result.
        </p>
      ) : (
        <div className={styles.stateControls}>
          <button
            type="button"
            className={shellStyles.nowSecondary}
            data-clock-running={running}
            onClick={() => dispatch({ type: 'SET_CLOCK_RUNNING', running: !running })}
          >
            {running ? 'Pause the circuit' : 'Let the circuit run on'}
          </button>
          <button
            type="button"
            className={shellStyles.nowSecondary}
            data-restore-primary
            onClick={() => dispatch(ecmoFoundationRestoreAction(primaryVariant))}
          >
            Restore {primaryVariant.label}
          </button>
        </div>
      )}
    </div>
  )

  const consoleNode = (
    <>
      {focusedFoundation ? (
        <p className={styles.boundaryNote} data-observation-only>
          Observation-only CARDIOHELP display · use the guided controls for this task.
        </p>
      ) : null}
      <FitWidthSurface mode={presentation ? 'actual' : 'fit'} label="CARDIOHELP console">
        <CardiohelpConsole
          state={simulation}
          dispatch={(action) => dispatch({ type: 'SIMULATION', action })}
          controlsEnabled={false}
        />
      </FitWidthSurface>
      {focusedFoundation ? <CircuitPressureIdentity /> : null}
    </>
  )

  /*
   * Every source this lesson cites, for the footer that cites them all in one place.
   * Derived from the content registries rather than reported by the panes at render, so the
   * set cannot go stale behind a surface that quietly starts citing something new — see
   * `content/stageSources.ts` and the rendered check in `stage-sources.test.ts`.
   */
  const stageSources = useMemo(() => ecmoFoundationStageSources(sectionId), [sectionId])

  const simulator = (
    <>
      <EcmoSimulatorSurfaces
        console={presentation && !presentation.console ? null : consoleNode}
        surfaceIds={presentation?.surfaces}
        safety={focusedFoundation ? stateCard : null}
        state={simulation}
        dispatch={(action) => dispatch({ type: 'SIMULATION', action })}
        controlsEnabled={false}
        emphasisSceneLabelIds={emphasisSceneLabelIds}
        circuitPresentation={circuitPresentation}
        mapAnswer={mapAnswer}
        circuitMeasurementNote={focusedFoundation ? PART_MEASUREMENT_IDENTITY : undefined}
        // Keep the existing whole-map frame; highlighting follows the active teaching task.
        circuitAutoScroll={false}
        circuitFit="pane"
        circuitViewPreference={circuitViewPreference}
        locationDisclosure="full"
        openSurfaces={openSurfaces}
        onToggleSurface={toggleSurface}
      />
    </>
  )

  const prose = activeStep.teaching.prose
  /*
   * Per-step reveal of the teaching column.
   *
   * A foundation panel is written as a whole lesson — the walk, the comparisons, the definitions,
   * the boundaries. Read all at once on the first step it is a wall (the R4 baseline measured a
   * teaching pane holding twelve screens of it). Each task selects its relevant blocks; the full
   * teaching remains available without an answer.
   */
  const teachingPreview = false
  const teachingExpanded = teachingPreview && progression.expandedTeachingStepId === activeStep.id
  const narrative =
    section && prose !== 'none' ? (
      <section className={teachingStyles.section} aria-labelledby="lesson-narrative-heading">
        <h3 id="lesson-narrative-heading" className={teachingStyles.heading}>
          Lesson narrative
        </h3>
        <p className="mt-2">{section.summary}</p>
        {prose === 'full' ? (
          <>
            <div className="mt-3 grid gap-3" data-lesson-paragraphs>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            {section.bullets ? (
              <ul className="mt-3 grid gap-2" data-lesson-bullets>
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="rounded-xl border px-3 py-2">
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3 text-muted-foreground">{DEVICE_BOUNDARY_FULL}</p>
          </>
        ) : null}
        {/*
          The narrative's own source list used to sit here, at every prose level. An owner
          review moved every stage list into one folded block in the footer, so this pane
          carries the lesson and the footer carries what it rests on.
        */}
      </section>
    ) : null

  const teaching = (
    <div
      className={styles.teachingColumn}
      ref={teachingRef}
      data-focused-foundation={focusedFoundation || undefined}
      data-pane="teaching"
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
        value={{
          phase: activeStep.phase,
          predictionCommitted,
          stepId: activeStep.id,
          foundationBlock: foundationTask?.block,
          focusedPresentation: Boolean(presentation),
          teachingSections: foundationPresentationSections[sectionId]?.[activeStep.phase]?.filter(
            (id) =>
              !normalReading ||
              baselineGroupIndex === 0 ||
              (id !== 'vv-topology-heading' && id !== 'va-topology-heading'),
          ),
          baselineGroup,
          foundationNavigation:
            !presentation &&
            foundationTask &&
            activeStep.lookIn?.pane === 'teaching' &&
            activeStep.interaction.kind === 'read'
              ? {
                  instruction: activeStep.instruction,
                  nextTitle: lesson.steps[activeIndex + 1]?.title ?? 'the next step',
                  onContinue: advance,
                }
              : undefined,
        }}
      >
        {/*
          At Explain the narrative comes first.

          The Explain step's instruction is "review the lesson narrative", and the narrative was
          rendered after the whole teaching panel — roughly the tenth block down a pane that scrolls
          on its own and is never scrolled for the learner, under a first line reading "Circuit walk
          · stop N of 6". A learner review in September 2026: "it tells me to read the lesson
          narrative, which I'm guessing is the middle panel, although it's not labeled 'lesson
          narrative' it's labeled 'circuit walk'." At every other step the narrative is a summary or
          absent, and the panel is what the step is about, so the order only flips where the step
          asks for the narrative by name.
        */}
        {prose === 'full' ? narrative : null}
        {foundationTask?.block === 'application' ||
        (presentation &&
          !focusedFoundation &&
          activeStep.phase === 'predict' &&
          foundationPresentationSections[sectionId]) ? (
          <section className={teachingStyles.section} data-independent-application>
            <h3 className={teachingStyles.heading}>Apply what you learned</h3>
            <p className="mt-3">
              This is a separate teaching case. Read its stated findings; the reference circuit is
              not the case. Try an optional answer or open the explanation directly.
            </p>
            <p className="mt-2">
              Use Back to review earlier teaching. Earlier answers and completed comparisons remain
              saved in this session.
            </p>
          </section>
        ) : (
          <EcmoFoundationTeachingPanel
            sectionId={sectionId}
            state={simulation}
            snapshot={session.snapshot}
            pressureSite={pressureSite}
            onPressureSiteChange={setPressureSite}
            walk={{
              activeStopId: foundationTask?.walkStopId ?? activeWalkStop?.id,
              onStopChange: setActiveWalkStop,
              navigationInTask: Boolean(presentation),
              onRunComparison: runComparisonBeat,
              activeComparisonId,
              pastPrediction: focusedFoundation || predictionCommitted,
            }}
          />
        )}
        {prose === 'full' ? null : narrative}
        {conflict && prose === 'full' ? (
          <HeldDisagreement conflict={conflict} headingLevel={3} />
        ) : null}
      </StageTeachingScope>
    </div>
  )

  const storyProblems = ecmoStoryProblemsFor(sectionId)
  const task = (
    <>
      <div ref={nowFocusRef} tabIndex={-1} data-now-focus data-active-phase={activeStep.phase}>
        <EcmoNowCard model={nowModel}>
          <ActivityContent
            presentation={presentation}
            teaching={teaching}
            visual={
              presentation && (presentation.console || presentation.surfaces.length > 0)
                ? simulator
                : null
            }
          >
            {nowBody}
            {comparisonPlan ? (
              <>
                <p data-active-state-variant={activeVariant.id}>{activeVariant.label}</p>
                <p data-teaching-run-note>
                  Teaching comparison: the Run button restores and advances the model. It is not a
                  CARDIOHELP hardware control.
                </p>
                <FoundationComparison
                  baseline={ecmoFoundationSnapshot(
                    createFoundationVariantState(comparisonPlan.baselineVariant),
                  )}
                  comparison={savedComparison}
                  actionId={comparisonPlan.guided.id}
                  supportMode={supportMode}
                />
                {savedComparison && foundationTask?.actionId ? (
                  <div className={styles.comparisonControls}>
                    <button
                      type="button"
                      className={shellStyles.nowSecondary}
                      onClick={() => runFocusedComparison(comparisonPlan)}
                    >
                      Repeat this comparison
                    </button>
                    <button
                      type="button"
                      className={shellStyles.nowSecondary}
                      onClick={() => resetFocusedComparison(comparisonPlan)}
                    >
                      Reset this comparison
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
            {focusedStory && comparisonPlan && !savedComparison ? (
              <button
                type="button"
                className={shellStyles.nowSecondary}
                onClick={() => runFocusedComparison(comparisonPlan)}
              >
                Run comparison without answering
              </button>
            ) : null}
            <EcmoOptionalExplanation
              key={activeStep.id}
              onContinue={skipStep}
              onRetry={retryQuestion}
            >
              {mapAnswerItem ? (
                <>
                  <p>{mapAnswerItem.explanation}</p>
                  <ul>
                    {mapAnswerItem.choices.map((choice) => (
                      <li key={choice.id}>
                        <strong>{choice.label}</strong> {choice.rationale}
                      </li>
                    ))}
                  </ul>
                </>
              ) : focusedStory ? (
                <p>{focusedStory.item.explanation}</p>
              ) : activeStep.interaction.kind === 'attribution' ? (
                <ul>
                  {activeStep.interaction.attribution.candidates.map((candidate) => (
                    <li key={candidate.id}>
                      <strong>{candidate.label}</strong> {candidate.rationale}
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <p>{activeStep.rationale ?? activeStep.instruction}</p>
                  <p>
                    Use the teaching and source material on this page. Only running a comparison
                    produces its Before / After result; moving on does not run it.
                  </p>
                </>
              )}
            </EcmoOptionalExplanation>
          </ActivityContent>
        </EcmoNowCard>
      </div>
      {!focusedFoundation ? stateCard : null}
      {/* On the Act step the card carries these; rendering them here too would duplicate every id. */}
      {activeStep.interaction.kind === 'bounded-actions' ? null : boundedActions}
      {!focusedFoundation &&
      (activeStep.phase === 'observe' || activeStep.phase === 'explain') &&
      storyProblems.length > 0 ? (
        <FoundationStoryProblems
          stories={storyProblems}
          state={session.simulation}
          ranActionIds={session.interactionsSinceRestore}
          onRun={(guidedActionId) => {
            const guided = runtime.guidedActions.find((action) => action.id === guidedActionId)
            if (guided) runGuidedAction(guided)
          }}
        />
      ) : null}
      {activeIndex === 0 && sectionSpec ? (
        <details className={styles.objectives} data-stage-objectives>
          <summary>What this section is for</summary>
          <p>{sectionSpec.objective}</p>
          <p>
            <strong>One new idea:</strong> {sectionSpec.newConcept}
          </p>
        </details>
      ) : null}
      <details open={!presentation} data-task-history>
        <summary>Tasks in this section</summary>
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
            if (
              step.interaction.kind === 'prediction' ||
              step.interaction.kind === 'transfer-item'
            ) {
              const choiceId = progression.choiceByStepId[step.id]
              const choice = step.interaction.item.choices.find((item) => item.id === choiceId)
              return choice ? [`You chose: ${choice.label}`] : ['Committed.']
            }
            return []
          }}
          onSelect={selectStepRow}
        />
      </details>
      {finished && (!focusedMapQuestion || progression.sectionReviewed) ? (
        <section
          className={styles.completion}
          role="status"
          aria-live="polite"
          data-stage-completion
        >
          <h3>Section reviewed</h3>
          <p>Continue to the next section to keep building on this.</p>
          {nextSection ? (
            <div className={styles.completionActions}>
              <button
                type="button"
                className={shellStyles.nowPrimary}
                onClick={() => goToSection(nextSection.id)}
              >
                Continue to next section: {nextSection.title}
                <ArrowRight aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  )

  const header = (
    <EcmoSectionHeader
      breadcrumb={{ href: cardiohelpEcmoNavBase, label: 'ECMO Management' }}
      kicker={`${focusedFoundation ? 'Shared foundations · ' : ''}${supportMode.toUpperCase()} track · Section ${lesson.index + 1} of ${lesson.total} · ${lesson.minutes} min`}
      title={lesson.title}
      meta={trackIsFixed ? [FIXED_PATHWAY_COPY[supportMode]] : undefined}
      sectionsControl={
        <SectionsDrawer
          pathway={pathway}
          activeSectionId={sectionId}
          position={`${lesson.index + 1} of ${lesson.total}`}
          onSelect={goToSection}
        />
      }
      trackToggle={
        trackIsFixed ? undefined : (
          <EcmoTrackToggle
            supportMode={supportMode}
            onSelect={(mode) =>
              router.push({
                pathname: `${cardiohelpEcmoNavBase}/learn`,
                query: { lesson: sectionId, track: mode },
              })
            }
          />
        )
      }
      helpRef={helpButtonRef}
      onHelp={() => setHelpOpen(true)}
      onRestart={onRestart}
      restartLabel="Restart section"
      onSaveAndExit={() => router.push(cardiohelpEcmoNavBase)}
      resumedNote={
        focusedFoundation && mount.clamped
          ? 'This section restarted at its first teaching task. Answers and demonstrations are not restored by a link or refresh; historical completion is kept.'
          : mount.clamped
            ? `This section reopened at its first task with a fresh teaching state. Choose any task from the outline. Earlier choices, snapshots, and actions were not restored.`
            : mount.index > 0
              ? `Opened at the ${requestedPhase} step with a clean teaching state. Earlier choices, snapshots, and actions were not restored.`
              : undefined
      }
    />
  )

  const helpDialog = (
    <EcmoHelpDialog
      open={helpOpen}
      onClose={() => setHelpOpen(false)}
      returnFocusTo={helpButtonRef}
    >
      <p className={shellStyles.kicker}>{stepPosition}</p>
      <p>
        <strong>{activeStep.title}</strong>
      </p>
      <p>{activeStep.instruction}</p>
      {lookInLine ? <p>{lookInLine}</p> : null}
      {activeStep.rationale ? <p>{activeStep.rationale}</p> : null}
    </EcmoHelpDialog>
  )

  return (
    <CardiohelpModuleFrame
      locale={locale}
      activeHref={`${cardiohelpEcmoNavBase}/learn`}
      activityMode
    >
      <StageSourcesScope>
        <StageLayout
          presentation={presentation}
          stageId={activeStep.id}
          label={`${supportMode.toUpperCase()} foundation section`}
          supportMode={supportMode}
          fixedPathway={trackIsFixed ? supportMode : undefined}
          header={header}
          contextStrip={
            presentation?.kind === 'concept' ||
            presentation?.kind === 'comparison-lab' ? undefined : (
              <EcmoContextStrip line={contextLine} badge="Simulated values" />
            )
          }
          simulator={simulator}
          teaching={teaching}
          task={task}
          compactPane={compactPane}
          footer={
            <>
              <p className={styles.boundaryNote} data-device-boundary>
                {DEVICE_BOUNDARY_SHORT}
              </p>
              <p className={styles.footerLine}>
                Professional education only. Not a clinical device or a patient-specific guide;
                every value is simulated. Follow current manufacturer instructions and local
                protocol.
              </p>
              <EcmoStageSources
                sources={stageSources}
                label="Sources for this section"
                claimsVisible
              />
            </>
          }
          overlay={helpDialog}
        />
      </StageSourcesScope>
    </CardiohelpModuleFrame>
  )
}
