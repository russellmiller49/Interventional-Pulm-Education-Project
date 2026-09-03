'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, LocateFixed, Play, SlidersHorizontal } from 'lucide-react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { nextPathwaySection } from '@/features/learning-module/curriculum/types'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'
import { useRouter } from '@/i18n/navigation'

import { orderChoices } from '../../content/choiceOrder'
import { isEcmoFoundationSectionId } from '../../content/foundationLessons'
import { ecmoSectionSpecById } from '../../content/sectionSpecs'
import type { GuidedControlId, GuidedLessonDefinition } from '../../engine/types'
import {
  useEcmoSessionCore,
  type EcmoSessionLoadContext,
  type EcmoSessionLoadReason,
} from '../../session/useEcmoSessionCore'
import { CardiohelpConsole } from '../CardiohelpConsole'
import { CardiohelpModuleFrame } from '../CardiohelpModuleFrame'
import { FitWidthSurface } from '../FitWidthSurface'
import { EcmoSourceList } from '../evidence/EcmoSourceList'
import { EcmoContextStrip, type EcmoContextStripLine } from '../shell/EcmoContextStrip'
import { EcmoHelpDialog } from '../shell/EcmoHelpDialog'
import { EcmoNowCard, type NowCardModel } from '../shell/EcmoNowCard'
import { EcmoSectionHeader } from '../shell/EcmoSectionHeader'
import { EcmoSimulatorSurfaces } from '../shell/EcmoSimulatorSurfaces'
import { EcmoTrackToggle } from '../shell/EcmoTrackToggle'
import shellStyles from '../shell/EcmoActivityShell.module.css'
import { useAlarmAudio } from '../useAlarmAudio'
import { buildDrillStageLesson } from './adapters/drillStageAdapter'
import { DrillTeachingColumn } from './DrillTeachingColumn'
import { panelControlIds, resolveGuidedSimulatorTask, targetLabels } from './drillControlResolver'
import { SectionsDrawer } from './SectionsDrawer'
import { StageLayout } from './StageLayout'
import { StepList } from './StepList'
import {
  STAGE_PHASES,
  STAGE_PHASE_LABELS,
  canEnterStep,
  type StageLesson,
  type StagePhase,
  type StageSurfaceId,
} from './stageModel'
import styles from './EcmoLessonStage.module.css'

/**
 * A guided drill on the lesson stage.
 *
 * The session is the same `useEcmoSessionCore` the workbench used, so hydration, persistence, the
 * clock, analytics and the loaders are unchanged. What this host owns is the progression — which
 * step is current, which have been performed, the committed choice — and the view state that hangs
 * off it: which surfaces are open, which control is spotlighted, whether help is open. Every step
 * change rewrites the Now card, the open surfaces and the guided focus, so a click on the
 * progression always changes the screen.
 */

interface Progression {
  readonly index: number
  readonly furthestPerformed: number
  readonly performedIds: readonly string[]
  /** The phase a URL asked for when the mount could not honour it. */
  readonly clampedFrom: StagePhase | null
  readonly choiceByStepId: Readonly<Record<string, string>>
  readonly review: number | null
  /** Surfaces the learner opened or closed on a step, keyed by step id; absent = the step's own. */
  readonly surfacesByStepId: Readonly<Record<string, readonly StageSurfaceId[]>>
  /** The spotlighted control and how many times it was asked for, valid for one step only. */
  readonly help: {
    readonly stepId: string
    readonly controlId: GuidedControlId
    readonly count: number
  } | null
}

const INITIAL_PROGRESSION: Progression = {
  index: 0,
  furthestPerformed: -1,
  performedIds: [],
  clampedFrom: null,
  choiceByStepId: {},
  review: null,
  surfacesByStepId: {},
  help: null,
}

function parsePhase(value: string | null): StagePhase {
  return (STAGE_PHASES as readonly string[]).includes(value ?? '')
    ? (value as StagePhase)
    : 'recognize'
}

function surfaceForControl(controlId: GuidedControlId): StageSurfaceId | null {
  switch (controlId) {
    case 'cardiohelp-circuit-panel':
    case 'cardiohelp-circuit-check':
    case 'cardiohelp-clamp-drainage':
    case 'cardiohelp-clamp-return':
    case 'cardiohelp-resume-support':
      return 'circuit'
    case 'cardiohelp-gas-panel':
    case 'cardiohelp-sweep-control':
    case 'cardiohelp-fio2-control':
    case 'cardiohelp-restore-gas-source':
      return 'gas'
    case 'cardiohelp-patient-monitor':
      return 'monitor'
    case 'cardiohelp-trend-panel':
      return 'trends'
    default:
      return null
  }
}

function predictionPerformed(lesson: StageLesson, performedIds: readonly string[]): boolean {
  if (lesson.predictionStepIndex < 0) return true
  const step = lesson.steps[lesson.predictionStepIndex]
  return step ? performedIds.includes(step.id) : true
}

export function DrillStageHost({ locale = 'en' }: { readonly locale?: string }) {
  const router = useRouter()
  const [progression, setProgression] = useState<Progression>(INITIAL_PROGRESSION)
  const [helpOpen, setHelpOpen] = useState(false)
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const nowHeadingRef = useRef<HTMLDivElement>(null)
  const completionRecorded = useRef<string | null>(null)

  const onLearnLessonLoaded = useCallback(
    (
      lesson: GuidedLessonDefinition,
      reason: EcmoSessionLoadReason,
      context: EcmoSessionLoadContext,
    ) => {
      // A drill always opens on its first step. Commitment is never persisted, so a URL into a
      // later phase cannot be honoured; the note beside the title says which phase was asked for.
      const requested = reason === 'hydrate' ? parsePhase(context.requestedPhase) : 'recognize'
      setProgression({
        ...INITIAL_PROGRESSION,
        clampedFrom: requested === 'recognize' ? null : requested,
      })
      completionRecorded.current = null
      setHelpOpen(false)
    },
    [],
  )

  const core = useEcmoSessionCore({ section: 'learn', onLearnLessonLoaded })
  const { state, dispatch, hydrated, learnLesson, supportMode, setSemanticPhase } = core
  useAlarmAudio(state)

  const lesson = useMemo(
    () => buildDrillStageLesson(learnLesson, learnLesson.supportMode),
    [learnLesson],
  )
  const pathway = criticalCareLearningPathway('cardiohelp-ecmo', supportMode)
  const nextSection = nextPathwaySection(pathway, lesson.sectionId)
  const sectionSpec = ecmoSectionSpecById.get(lesson.sectionId)

  const activeIndex = Math.min(progression.index, lesson.steps.length - 1)
  const activeStep = lesson.steps[activeIndex]
  const isLastStep = activeIndex === lesson.steps.length - 1

  const simulatorTask =
    activeStep.interaction.kind === 'simulator-task' ||
    activeStep.interaction.kind === 'transfer-scenario'
      ? resolveGuidedSimulatorTask(activeStep.interaction.actions, state)
      : null
  /*
   * A recognised control task is performed the moment the simulator reaches the requested state.
   * That is read off the engine rather than copied into state, so nothing has to watch for it;
   * moving on records it, and the step list shows it as done from the same predicate.
   */
  const autoPerformed = simulatorTask?.satisfied === true
  const recordedIds = progression.performedIds
  const performedIds = useMemo(
    () => new Set(autoPerformed ? [...recordedIds, activeStep.id] : recordedIds),
    [activeStep.id, autoPerformed, recordedIds],
  )
  const stepPerformed = performedIds.has(activeStep.id)
  const furthestPerformed = stepPerformed
    ? Math.max(progression.furthestPerformed, activeIndex)
    : progression.furthestPerformed
  const predictionCommitted = predictionPerformed(lesson, [...performedIds])
  const finished = isLastStep && stepPerformed

  const helpControlId: GuidedControlId | null =
    simulatorTask?.controlId ??
    (activeStep.focusTarget ? panelControlIds[activeStep.focusTarget] : null)
  const help = progression.help?.stepId === activeStep.id ? progression.help : null
  const guidedControlId = help?.controlId ?? null
  const openSurfaces = useMemo(
    () =>
      new Set<StageSurfaceId>(progression.surfacesByStepId[activeStep.id] ?? activeStep.surfaces),
    [activeStep.id, activeStep.surfaces, progression.surfacesByStepId],
  )
  const circuitViewPreference = activeStep.circuitView
    ? { view: activeStep.circuitView, stepId: activeStep.id }
    : null

  /* ---------------------------------------------------------------- *
   * Progression
   * ---------------------------------------------------------------- */

  /** Enter a step: load a transfer case if it carries one, then move. */
  const enterStep = useCallback(
    (index: number, performedNow: readonly string[]) => {
      const nextStep = lesson.steps[index]
      if (!nextStep) return
      if (nextStep.interaction.kind === 'transfer-scenario') {
        dispatch({
          type: 'LOAD_SCENARIO',
          scenarioId: nextStep.interaction.scenarioId,
          mode: 'guided',
        })
        for (const action of nextStep.interaction.setupActions) dispatch(action)
      }
      setSemanticPhase(nextStep.phase)
      setProgression((current) => ({
        ...current,
        index,
        review: null,
        performedIds: performedNow,
        furthestPerformed: Math.max(
          current.furthestPerformed,
          performedNow.includes(lesson.steps[current.index]?.id ?? '') ? current.index : -1,
        ),
      }))
    },
    [dispatch, lesson, setSemanticPhase],
  )

  const recordPerformed = useCallback(
    (stepId: string): readonly string[] =>
      recordedIds.includes(stepId) ? recordedIds : [...recordedIds, stepId],
    [recordedIds],
  )

  const completeActiveStep = useCallback(() => {
    const performedNow = recordPerformed(activeStep.id)
    setProgression((current) => ({
      ...current,
      performedIds: performedNow,
      furthestPerformed: Math.max(current.furthestPerformed, activeIndex),
      help: null,
    }))
  }, [activeIndex, activeStep.id, recordPerformed])

  const advance = useCallback(() => {
    const performedNow = stepPerformed ? recordPerformed(activeStep.id) : recordedIds
    const next = activeIndex + 1
    const furthest = stepPerformed ? Math.max(furthestPerformed, activeIndex) : furthestPerformed
    if (!canEnterStep(lesson, next, furthest, predictionPerformed(lesson, performedNow))) return
    enterStep(next, performedNow)
  }, [
    activeIndex,
    activeStep.id,
    enterStep,
    furthestPerformed,
    lesson,
    recordPerformed,
    recordedIds,
    stepPerformed,
  ])

  const performStep = useCallback(() => {
    if (stepPerformed) return
    const { interaction } = activeStep
    if (
      interaction.kind === 'simulator-task' ||
      interaction.kind === 'model-advance' ||
      interaction.kind === 'transfer-scenario'
    ) {
      for (const action of interaction.actions) dispatch(action)
    }
    completeActiveStep()
  }, [activeStep, completeActiveStep, dispatch, stepPerformed])

  const commitPrediction = useCallback(() => {
    if (activeStep.interaction.kind !== 'prediction' || stepPerformed) return
    const choiceId = progression.choiceByStepId[activeStep.id]
    if (!choiceId) return
    const commitment = activeStep.interaction.commitments?.[choiceId]
    if (commitment) {
      dispatch({
        type: 'COMMIT_PREDICTION',
        goalId: commitment.goalId,
        control: commitment.control,
        direction: commitment.direction,
      })
    }
    completeActiveStep()
  }, [activeStep, completeActiveStep, dispatch, progression.choiceByStepId, stepPerformed])

  const readAndAdvance = useCallback(() => {
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
  }, [activeIndex, activeStep.id, enterStep, lesson.steps.length, recordPerformed])

  // Finishing the last step is what records the drill as worked — once per load.
  useEffect(() => {
    if (!finished || completionRecorded.current === lesson.scenarioId) return
    completionRecorded.current = lesson.scenarioId
    core.completeLearnLesson(lesson.scenarioId)
  }, [core, finished, lesson.scenarioId])

  /* ---------------------------------------------------------------- *
   * Step entry: focus, the URL phase, and the spotlight
   * ---------------------------------------------------------------- */

  useEffect(() => {
    nowHeadingRef.current?.focus({ preventScroll: true })
  }, [activeStep.id])

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('phase', activeStep.phase)
    window.history.replaceState(window.history.state, '', url)
  }, [activeStep.phase, hydrated, lesson.scenarioId])

  const helpCount = help?.count ?? 0
  useEffect(() => {
    if (helpCount === 0 || !guidedControlId) return
    const timer = window.setTimeout(() => {
      const control = document.getElementById(guidedControlId)
      if (!control) return
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      control.focus({ preventScroll: true })
      control.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [guidedControlId, helpCount])

  function showWhere() {
    if (!helpControlId) return
    const surface = surfaceForControl(helpControlId)
    const stepId = activeStep.id
    setProgression((current) => {
      const opened = new Set(current.surfacesByStepId[stepId] ?? activeStep.surfaces)
      if (surface) opened.add(surface)
      const previous = current.help?.stepId === stepId ? current.help.count : 0
      return {
        ...current,
        surfacesByStepId: { ...current.surfacesByStepId, [stepId]: [...opened] },
        help: { stepId, controlId: helpControlId, count: previous + 1 },
      }
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

  function goToSection(sectionId: string) {
    if (sectionId === lesson.sectionId) return
    if (isEcmoFoundationSectionId(sectionId)) {
      router.push({
        pathname: `${cardiohelpEcmoNavBase}/learn`,
        query: { lesson: sectionId, track: supportMode },
      })
      return
    }
    core.loadLearnScenario(sectionId)
  }

  function selectStepRow(index: number) {
    setProgression((current) => {
      if (index === current.index) return current
      if (!current.performedIds.includes(lesson.steps[index]?.id ?? '')) return current
      return { ...current, review: current.review === index ? null : index }
    })
  }

  /* ---------------------------------------------------------------- *
   * The Now card
   * ---------------------------------------------------------------- */

  const selectedChoiceId = progression.choiceByStepId[activeStep.id] ?? null
  const stepPosition = `Step ${activeStep.ordinal} of ${lesson.steps.length} · ${STAGE_PHASE_LABELS[activeStep.phase]}`
  const showWhereAction =
    helpControlId && !stepPerformed
      ? {
          label: helpCount > 0 ? 'Highlight it again' : 'Show me where',
          onActivate: showWhere,
          icon: <LocateFixed aria-hidden="true" />,
        }
      : undefined

  const nowModel: NowCardModel = (() => {
    const base = {
      kicker: stepPosition,
      heading: activeStep.title,
      body: activeStep.instruction,
      why: activeStep.rationale,
    }
    if (finished) {
      return { ...base, status: 'Done. This section has been worked through.' }
    }
    if (stepPerformed) {
      return {
        ...base,
        status: 'Done.',
        primary: isLastStep
          ? undefined
          : { label: 'Next step', onActivate: advance, icon: <ArrowRight aria-hidden="true" /> },
      }
    }
    switch (activeStep.interaction.kind) {
      case 'read':
        return {
          ...base,
          primary: { label: activeStep.actionLabel, onActivate: readAndAdvance },
        }
      case 'model-advance':
        return {
          ...base,
          status: 'Simulation update — no console action.',
          primary: {
            label: activeStep.actionLabel,
            onActivate: performStep,
            icon: <Play aria-hidden="true" />,
          },
        }
      case 'prediction':
        return {
          ...base,
          primary: {
            label: activeStep.actionLabel,
            onActivate: commitPrediction,
            disabled: selectedChoiceId === null,
            disabledReason: 'Choose one option to enable this.',
            icon: <SlidersHorizontal aria-hidden="true" />,
          },
        }
      case 'simulator-task':
      case 'transfer-scenario':
        if (simulatorTask) {
          return {
            ...base,
            status: `Waiting for: ${activeStep.actionLabel}. This step completes when the simulator reaches the requested state.`,
            secondary: showWhereAction,
          }
        }
        return {
          ...base,
          status: activeStep.focusTarget
            ? `Focus: ${targetLabels[activeStep.focusTarget]}`
            : undefined,
          primary: {
            label: activeStep.actionLabel,
            onActivate: performStep,
            icon: <SlidersHorizontal aria-hidden="true" />,
          },
          secondary: showWhereAction,
        }
      default:
        return base
    }
  })()

  const nowBody = (() => {
    if (activeStep.interaction.kind === 'prediction') {
      const { item } = activeStep.interaction
      if (stepPerformed && selectedChoiceId) {
        return (
          <>
            <AnswerVerdict
              item={item}
              choiceId={selectedChoiceId}
              timing="immediate-after-commit"
              theme="dark"
              onContinue={isLastStep ? undefined : advance}
            />
            <div data-verdict-evidence>
              <EcmoSourceList
                compact
                surface="shell"
                evidenceIds={item.evidenceIds}
                title="Sources"
              />
            </div>
          </>
        )
      }
      return (
        <fieldset className={styles.choiceList} disabled={stepPerformed} data-prediction-choices>
          <legend>{item.stem}</legend>
          {orderChoices(item.id, item.choices).map((choice) => (
            <label
              key={choice.id}
              className={styles.choice}
              data-selected={selectedChoiceId === choice.id}
            >
              <input
                type="radio"
                name={`ecmo-prediction-${activeStep.id}`}
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
    if (simulatorTask && !stepPerformed) {
      return (
        <p className={styles.taskInstruction} data-simulator-task role="status" aria-live="polite">
          <strong>Do this on the simulator.</strong> {simulatorTask.instruction}
        </p>
      )
    }
    return null
  })()

  /* ---------------------------------------------------------------- *
   * Panes
   * ---------------------------------------------------------------- */

  const activeAlarm = state.alarms.find((alarm) => alarm.active && alarm.source === 'device')
  const contextLine: EcmoContextStripLine = {
    mode: supportMode.toUpperCase(),
    flow: `${state.circuit.bloodFlow.toFixed(2)} L/min`,
    rpm: `${state.device.rpmSetpoint} RPM`,
    sweep: `${state.gas.sweepLpm.toFixed(1)} L/min`,
    alarm: activeAlarm
      ? { priority: activeAlarm.priority, text: activeAlarm.message }
      : { priority: 'none', text: 'No active device alarm' },
  }

  const consoleNode = (
    <FitWidthSurface label="CARDIOHELP console, scaled to fit the width of this panel">
      <CardiohelpConsole
        state={state}
        dispatch={dispatch}
        controlsEnabled
        guidedTarget={activeStep.focusTarget}
        guidedControlId={guidedControlId}
        initiationTargets={null}
      />
    </FitWidthSurface>
  )

  const simulator = (
    <EcmoSimulatorSurfaces
      console={consoleNode}
      state={state}
      dispatch={dispatch}
      controlsEnabled
      guidedTarget={activeStep.focusTarget}
      guidedControlId={guidedControlId}
      circuitViewPreference={circuitViewPreference}
      openSurfaces={openSurfaces}
      onToggleSurface={toggleSurface}
      onSaveForLater={() => router.push(cardiohelpEcmoNavBase)}
    />
  )

  const teaching = (
    <DrillTeachingColumn
      state={state}
      step={activeStep}
      predictionCommitted={predictionCommitted}
    />
  )

  const task = (
    <>
      <div ref={nowHeadingRef} tabIndex={-1} data-now-focus>
        <EcmoNowCard model={nowModel}>{nowBody}</EcmoNowCard>
      </div>
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
        furthestPerformedIndex={furthestPerformed}
        performedStepIds={performedIds}
        predictionCommitted={predictionCommitted}
        reviewIndex={progression.review}
        recapFor={(index) => {
          const step = lesson.steps[index]
          if (!step) return []
          if (step.interaction.kind === 'prediction') {
            const choiceId = progression.choiceByStepId[step.id]
            const choice = step.interaction.item.choices.find((item) => item.id === choiceId)
            return choice ? [`You chose: ${choice.label}`] : ['Prediction committed.']
          }
          return step.expectedResponse ?? []
        }}
        onSelect={selectStepRow}
      />
      {finished ? (
        <section
          className={styles.completion}
          role="status"
          aria-live="polite"
          data-stage-completion
        >
          <h3>Section worked through</h3>
          <p>
            {lesson.practicePairing
              ? 'The reasoning has been demonstrated. Apply it to the paired clinical case in Practice from a clean state with fewer cues.'
              : 'The reasoning has been demonstrated. Continue to the next section to keep building the track.'}
          </p>
          <div className={styles.completionActions}>
            {lesson.practicePairing ? (
              <button
                type="button"
                className={shellStyles.nowPrimary}
                onClick={() =>
                  router.push({
                    pathname: `${cardiohelpEcmoNavBase}/practice`,
                    query: { case: lesson.practicePairing?.caseId ?? '', track: supportMode },
                  })
                }
              >
                Apply this in Practice: {lesson.practicePairing.title}
                <ArrowRight aria-hidden="true" />
              </button>
            ) : null}
            {nextSection ? (
              <button
                type="button"
                className={shellStyles.nowSecondary}
                onClick={() => goToSection(nextSection.id)}
              >
                Continue to next section: {nextSection.title}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  )

  const header = (
    <EcmoSectionHeader
      breadcrumb={{ href: cardiohelpEcmoNavBase, label: 'ECMO Management' }}
      kicker={`${supportMode.toUpperCase()} track · Section ${lesson.index + 1} of ${lesson.total} · ${lesson.minutes} min`}
      title={lesson.title}
      sectionsControl={
        <SectionsDrawer
          pathway={pathway}
          activeSectionId={lesson.sectionId}
          position={`${lesson.index + 1} of ${lesson.total}`}
          onSelect={goToSection}
        />
      }
      trackToggle={<EcmoTrackToggle supportMode={supportMode} onSelect={core.selectTrack} />}
      helpRef={helpButtonRef}
      onHelp={() => setHelpOpen(true)}
      onRestart={core.resetActivity}
      restartLabel="Restart section"
      onSaveAndExit={core.saveAndExit}
      resumedNote={
        progression.clampedFrom
          ? `This section takes a prediction before its later steps, so it opened at its first step. The ${progression.clampedFrom} phase is reached by working forward; nothing earlier was restored.`
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
      {simulatorTask && !stepPerformed ? <p>{simulatorTask.instruction}</p> : null}
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
        label={`Guided CARDIOHELP ${supportMode.toUpperCase()} lesson`}
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
