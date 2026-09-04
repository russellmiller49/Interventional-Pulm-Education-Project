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
import {
  ecmoCircuitWalkStopsForSection,
  ecmoWalkStopSceneLabelIds,
  type EcmoCircuitWalkStop,
  type EcmoWalkComparisonBeat,
} from '../../content/circuitWalk'
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
import { persistFoundationSectionCompleted } from '../../engine/progress'
import type { SupportMode } from '../../engine/types'
import {
  createEcmoFoundationSessionState,
  ecmoFoundationRestoreAction,
  ecmoFoundationSessionReducer,
} from '../../session/foundationSession'
import { CardiohelpConsole } from '../CardiohelpConsole'
import { CardiohelpModuleFrame } from '../CardiohelpModuleFrame'
import { EcmoSourceList } from '../evidence/EcmoSourceList'
import { FitWidthSurface } from '../FitWidthSurface'
import { EcmoContextStrip, type EcmoContextStripLine } from '../shell/EcmoContextStrip'
import { EcmoHelpDialog } from '../shell/EcmoHelpDialog'
import { EcmoNowCard, type NowCardModel } from '../shell/EcmoNowCard'
import { EcmoSectionHeader } from '../shell/EcmoSectionHeader'
import { EcmoSimulatorSurfaces } from '../shell/EcmoSimulatorSurfaces'
import { EcmoTrackToggle } from '../shell/EcmoTrackToggle'
import shellStyles from '../shell/EcmoActivityShell.module.css'
import { EcmoFoundationTeachingPanel } from '../teaching/EcmoFoundationTeachingPanel'
import { styles as teachingStyles } from '../teaching/shared'
import {
  buildFoundationStageLesson,
  foundationCircuitLocationDisclosure,
} from './adapters/foundationStageAdapter'
import { FoundationStoryProblems } from './FoundationStoryProblems'
import { SectionsDrawer } from './SectionsDrawer'
import { StageLayout } from './StageLayout'
import { StageTeachingScope } from './StageTeachingScope'
import { StepList } from './StepList'
import {
  STAGE_PHASE_LABELS,
  canEnterStep,
  mountStepIndex,
  type StagePhase,
  type StageSurfaceId,
} from './stageModel'
import styles from './EcmoLessonStage.module.css'

/**
 * A foundation section on the lesson stage.
 *
 * The session is the foundation reducer, mounted once, fed by every pane: a fault-free reference
 * circuit or an existing case loaded as a non-scored teaching preview, restored atomically. The six
 * authored phases become the six steps of the stage's one progression. Exactly one thing is
 * persisted, and only when the learner commits the transfer answer: this section's id, marking it
 * worked. Opening, reading, navigating, predicting and loading states write nothing.
 *
 * Commitment is the sole reveal authority: derived from the committed prediction choice and from
 * nothing else — not the step, not the URL, not the walk stop, not stored progress.
 */

const FIXED_PATHWAY_COPY: Readonly<Record<SupportMode, string>> = {
  vv: 'VV pathway · this section teaches series physiology and always runs on the VV reference circuit.',
  va: 'VA pathway · this section teaches parallel circulation and always runs on the VA reference circuit.',
}

const DEVICE_BOUNDARY_SHORT =
  'Console follows the U.S. CARDIOHELP Instructions for Use, Revision 2.3 (January 2025). The VV and VA teaching is not limited to the U.S. labeled indication or duration.'

const DEVICE_BOUNDARY_FULL =
  'The simulated console follows the U.S. CARDIOHELP System Instructions for Use, Revision 2.3, January 2025. The VV and VA clinical teaching reflects contemporary ECMO practice and is not limited to the U.S. labeled indication or duration. This independent educational module does not replace current manufacturer instructions, local protocol, or supervised competency validation.'

interface Progression {
  readonly index: number
  readonly furthestPerformed: number
  readonly performedIds: readonly string[]
  readonly committedPredictionId: string | null
  readonly committedTransferId: string | null
  readonly choiceByStepId: Readonly<Record<string, string>>
  readonly review: number | null
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
  const mount = useMemo(() => mountStepIndex(lesson, requestedPhase), [lesson, requestedPhase])
  const mountPhase = lesson.steps[mount.index]?.phase ?? 'recognize'
  const variants = ecmoFoundationVariants(runtime, supportMode)
  const primaryVariant = ecmoFoundationPrimaryVariant(runtime, supportMode)
  const initialVariant = ecmoFoundationInitialVariant(runtime, supportMode, mountPhase)
  const trackIsFixed = runtime.supportMode !== undefined

  const [session, dispatch] = useReducer(ecmoFoundationSessionReducer, initialVariant, (variant) =>
    createEcmoFoundationSessionState(variant),
  )
  const [progression, setProgression] = useState<Progression>(() => ({
    index: mount.index,
    furthestPerformed: mount.index - 1,
    performedIds: lesson.steps.slice(0, mount.index).map((step) => step.id),
    committedPredictionId: null,
    committedTransferId: null,
    choiceByStepId: {},
    review: null,
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

  const activeIndex = Math.min(progression.index, lesson.steps.length - 1)
  const activeStep = lesson.steps[activeIndex]
  const performedIds = useMemo(() => new Set(progression.performedIds), [progression.performedIds])
  const stepPerformed = performedIds.has(activeStep.id)
  const isLastStep = activeIndex === lesson.steps.length - 1
  const predictionCommitted = progression.committedPredictionId !== null
  const finished = progression.committedTransferId !== null
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
    enabled: true,
  })

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
  }, [activeStep.id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('phase', activeStep.phase)
    window.history.replaceState(window.history.state, '', url)
  }, [activeStep.phase])

  /* ---------------------------------------------------------------- *
   * Bounded actions and the walk
   * ---------------------------------------------------------------- */

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

  const emphasisSceneLabelIds = activeWalkStop
    ? ecmoWalkStopSceneLabelIds(activeWalkStop, supportMode)
    : null

  /* ---------------------------------------------------------------- *
   * Progression
   * ---------------------------------------------------------------- */

  function enterStep(index: number, performedNow: readonly string[]) {
    const nextStep = lesson.steps[index]
    if (!nextStep) return
    if (nextStep.entryVariantId) {
      const variant = ecmoFoundationVariant(runtime, supportMode, nextStep.entryVariantId)
      if (variant) dispatch(ecmoFoundationRestoreAction(variant))
    }
    setProgression((current) => ({
      ...current,
      index,
      review: null,
      performedIds: performedNow,
      furthestPerformed: Math.max(current.furthestPerformed, index - 1),
    }))
  }

  function recordPerformed(stepId: string): readonly string[] {
    return progression.performedIds.includes(stepId)
      ? progression.performedIds
      : [...progression.performedIds, stepId]
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

  const selectedChoiceId = progression.choiceByStepId[activeStep.id] ?? null

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
    // Committing the transfer answer is the one thing this section persists: the section is worked.
    persistFoundationSectionCompleted(sectionId)
    lifecycleAnalytics.recordTransferCompleted()
    lifecycleAnalytics.recordActivityCompleted()
  }

  function selectStepRow(index: number) {
    setProgression((current) => {
      if (index === current.index) return current
      if (!current.performedIds.includes(lesson.steps[index]?.id ?? '')) return current
      return { ...current, review: current.review === index ? null : index }
    })
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

  const stepPosition = `Step ${activeStep.ordinal} of ${lesson.steps.length} · ${STAGE_PHASE_LABELS[activeStep.phase]}`
  const nowModel: NowCardModel = (() => {
    const base = {
      kicker: stepPosition,
      heading: activeStep.title,
      body: activeStep.instruction,
      why: activeStep.rationale,
    }
    switch (activeStep.interaction.kind) {
      case 'prediction':
        return stepPerformed
          ? { ...base, status: 'Committed.' }
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
        return stepPerformed
          ? { ...base, status: 'Done. This section has been worked through.' }
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
      default:
        return stepPerformed && isLastStep
          ? { ...base, status: 'Done.' }
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

  function choiceFieldset(
    item: {
      readonly id: string
      readonly stem: string
      readonly choices: readonly { id: string; label: string }[]
    },
    legendId: string,
  ) {
    return (
      <fieldset
        className={styles.choiceList}
        disabled={stepPerformed}
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

  const nowBody = (() => {
    const { interaction } = activeStep
    if (interaction.kind === 'prediction' || interaction.kind === 'transfer-item') {
      const { item } = interaction
      const committedId =
        interaction.kind === 'prediction'
          ? progression.committedPredictionId
          : progression.committedTransferId
      const committedChoice = item.choices.find((choice) => choice.id === committedId)
      return (
        <>
          {choiceFieldset(
            item,
            interaction.kind === 'prediction' ? 'prediction-heading' : 'transfer-heading',
          )}
          {committedChoice ? (
            <div className="grid gap-3" data-verdict>
              <ChoiceReasoningFeedback
                choice={committedChoice}
                explanation={item.explanation}
                evidenceIds={item.evidenceIds}
              />
              {interaction.kind === 'prediction' ? (
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

  /*
   * Every step after the commitment can load a state. Transfer needs it too: the VV capstone's
   * transfer answer is "load the re-drainage preview and read it", which cannot happen if the
   * actions vanish when the transfer item appears. Open on the Act step, folded elsewhere.
   */
  const boundedActions =
    predictionCommitted && activeStep.phase !== 'recognize' && activeStep.phase !== 'predict' ? (
      <details
        className={styles.boundedActionsPanel}
        open={activeStep.interaction.kind === 'bounded-actions'}
        data-bounded-actions
      >
        <summary>Bounded actions</summary>
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
              <p className={shellStyles.kicker}>Looked at since this state was loaded</p>
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

  /* ---------------------------------------------------------------- *
   * Panes
   * ---------------------------------------------------------------- */

  const simulation = session.simulation
  const activeAlarm = simulation.alarms.find((alarm) => alarm.active && alarm.source === 'device')
  const contextLine: EcmoContextStripLine = {
    mode: supportMode.toUpperCase(),
    flow: `${simulation.circuit.bloodFlow.toFixed(2)} L/min`,
    rpm: `${simulation.device.rpmSetpoint} RPM`,
    sweep: `${simulation.gas.sweepLpm.toFixed(1)} L/min`,
    alarm: activeAlarm
      ? { priority: activeAlarm.priority, text: activeAlarm.message }
      : { priority: 'none', text: 'No active device alarm' },
  }

  const stateCard = (
    <div className={styles.stateCard} data-active-state-variant={activeVariant.id}>
      <p className={shellStyles.kicker}>State on screen</p>
      <p className="font-semibold">{activeVariant.label}</p>
      {running ? null : (
        <p data-clock-held>
          The clock is held here, so this state stays as it is until you start it.
        </p>
      )}
      {activeVariant.modelBoundary ? (
        <p data-variant-boundary>{activeVariant.modelBoundary}</p>
      ) : null}
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
    </div>
  )

  const consoleNode = (
    <FitWidthSurface label="CARDIOHELP console, scaled to fit the width of this panel">
      <CardiohelpConsole
        state={simulation}
        dispatch={(action) => dispatch({ type: 'SIMULATION', action })}
        controlsEnabled={false}
      />
    </FitWidthSurface>
  )

  const simulator = (
    <>
      <EcmoSimulatorSurfaces
        console={consoleNode}
        safety={stateCard}
        state={simulation}
        dispatch={(action) => dispatch({ type: 'SIMULATION', action })}
        controlsEnabled={false}
        emphasisSceneLabelIds={emphasisSceneLabelIds}
        locationDisclosure={foundationCircuitLocationDisclosure(sectionId, predictionCommitted)}
        openSurfaces={openSurfaces}
        onToggleSurface={toggleSurface}
      />
      <p className={styles.boundaryNote} data-device-boundary>
        {DEVICE_BOUNDARY_SHORT}
      </p>
    </>
  )

  const prose = activeStep.teaching.prose
  /*
   * Per-step reveal of the teaching column.
   *
   * A foundation panel is written as a whole lesson — the walk, the comparisons, the definitions,
   * the boundaries. Read all at once on the first step it is a wall (the R4 baseline measured a
   * teaching pane holding twelve screens of it). Until the prediction is committed only the first
   * block of the panel is shown, with one control that shows the rest; from the Act step on the
   * whole panel renders. The choice is per step and is not persisted.
   */
  const teachingPreview =
    !predictionCommitted && (activeStep.phase === 'recognize' || activeStep.phase === 'predict')
  const teachingExpanded = teachingPreview && progression.expandedTeachingStepId === activeStep.id
  const teaching = (
    <div
      className={styles.teachingColumn}
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
        value={{ phase: activeStep.phase, predictionCommitted, stepId: activeStep.id }}
      >
        <EcmoFoundationTeachingPanel
          sectionId={sectionId}
          state={simulation}
          snapshot={session.snapshot}
          walk={{
            activeStopId: activeWalkStop?.id,
            onStopChange: setActiveWalkStop,
            onRunComparison: runComparisonBeat,
            activeComparisonId,
            pastPrediction: predictionCommitted,
          }}
        />
        {section && prose !== 'none' ? (
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
            {/* Provenance sits with the narrative at every prose level, not only the full read. */}
            <div className="mt-2" data-lesson-sources>
              <EcmoSourceList compact evidenceIds={section.sourceIds} title="Sources" />
            </div>
          </section>
        ) : null}
        {conflict && prose === 'full' ? (
          <HeldDisagreement conflict={conflict} headingLevel={3} />
        ) : null}
      </StageTeachingScope>
    </div>
  )

  const storyProblems = ecmoStoryProblemsFor(sectionId)
  const task = (
    <>
      <div ref={nowFocusRef} tabIndex={-1} data-now-focus>
        <EcmoNowCard model={nowModel}>{nowBody}</EcmoNowCard>
      </div>
      {boundedActions}
      {predictionCommitted &&
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
          if (step.interaction.kind === 'prediction' || step.interaction.kind === 'transfer-item') {
            const choiceId = progression.choiceByStepId[step.id]
            const choice = step.interaction.item.choices.find((item) => item.id === choiceId)
            return choice ? [`You chose: ${choice.label}`] : ['Committed.']
          }
          return []
        }}
        onSelect={selectStepRow}
      />
      {predictionCommitted ? null : (
        <p className={shellStyles.nowStatus} data-phase-lock-note>
          The later steps unlock when you commit your prediction.
        </p>
      )}
      {finished ? (
        <section
          className={styles.completion}
          role="status"
          aria-live="polite"
          data-stage-completion
        >
          <h3>Section worked through</h3>
          <p>Continue to the next section to keep building the track.</p>
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
      kicker={`${supportMode.toUpperCase()} track · Section ${lesson.index + 1} of ${lesson.total} · ${lesson.minutes} min`}
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
        mount.clamped
          ? `This section takes a prediction before its later steps, so it opened at the predict step with a clean teaching state. The ${requestedPhase} step unlocks when you commit. Earlier choices, snapshots, and actions were not restored.`
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
      {activeStep.rationale ? <p>{activeStep.rationale}</p> : null}
    </EcmoHelpDialog>
  )

  return (
    <CardiohelpModuleFrame
      locale={locale}
      activeHref={`${cardiohelpEcmoNavBase}/learn`}
      activityMode
    >
      <StageLayout
        stageId={activeStep.id}
        label={`${supportMode.toUpperCase()} foundation section`}
        supportMode={supportMode}
        fixedPathway={trackIsFixed ? supportMode : undefined}
        header={header}
        contextStrip={<EcmoContextStrip line={contextLine} badge="Simulated values" />}
        simulator={simulator}
        teaching={teaching}
        task={task}
        footer={
          <p className={styles.footerLine}>
            Professional education only. Not a clinical device or a patient-specific guide; every
            value is simulated. Follow current manufacturer instructions and local protocol.
          </p>
        }
        overlay={helpDialog}
      />
    </CardiohelpModuleFrame>
  )
}
