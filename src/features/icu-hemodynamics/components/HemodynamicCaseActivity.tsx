'use client'

import type { Route } from 'next'
import { useEffect, useMemo, useRef, useState } from 'react'

import { criticalCareReferences } from '@/features/critical-care/content/references'
import { EvidenceDrawer } from '@/features/learning-module/components/EvidenceDrawer'
import { ReferenceDrawer } from '@/features/learning-module/components/ReferenceDrawer'
import { ScenarioFeedbackCard } from '@/features/learning-module/components/ScenarioFeedbackCard'
import { ScenarioTeachingDebrief } from '@/features/learning-module/components/ScenarioTeachingDebrief'
import { SimulationLaunchGate } from '@/features/learning-module/components/SimulationLaunchGate'
import {
  useCriticalCareActivityAnalytics,
  type CriticalCareActivityPhase,
} from '@/features/learning-module/activity'
import type {
  ScenarioDecisionTraceEntry,
  ScenarioFeedbackEvent,
} from '@/features/learning-module/scenarioFeedback'
import { Link, useRouter } from '@/i18n/navigation'

import {
  feedbackForHemodynamicAction,
  feedbackTimingForHemodynamicAction,
  HEMODYNAMIC_CLINICAL_THRESHOLDS,
  hemodynamicCaseById,
  hemodynamicsSourceById,
  hemodynamicTeachingArtifactByCaseId,
} from '../content'
import {
  createInitialHemodynamicState,
  icuHemodynamicsReducer,
  thermodilutionAcceptedAverage,
  type HemodynamicAction,
  type HemodynamicSimulationState,
} from '../engine'
import { updateSelfPacedRecord, withCaseOpened } from '../engine/selfPacedProgress'
import { IcuHemodynamicsModuleFrameV2 } from './IcuHemodynamicsModuleFrameV2'
import flowStyles from './stage/hemodynamics-flow.module.css'
import { HemodynamicNativeWorkspace } from './HemodynamicNativeWorkspace'

/**
 * `challenge` is the case opened from the former Assess page (`/assess?start=1`). The value is kept
 * so saved links, the authored seed and the activity identity stay stable; since HD-01 it is an
 * optional applied case with the same help and feedback as Practice.
 */
type CaseMode = 'practice' | 'challenge'

function seededCaseNumber(caseId: string, mode: CaseMode): number {
  const base = [...caseId].reduce((total, character) => total + character.charCodeAt(0), 0)
  return mode === 'challenge' ? base + 7000 : base + 3000
}

function metricValue(value: number | null, digits = 0): string {
  return value === null || !Number.isFinite(value) ? '—' : value.toFixed(digits)
}

function requireValue<T>(value: T | undefined, message: string): T {
  if (!value) throw new Error(message)
  return value
}

/**
 * The transfer question after a case: what explains a line that settles slowly after a position
 * change. Feedback for each option says why it does or does not account for the signal (HD-01 content
 * batch: the two other options used to share one "reasonable cue" message). Pending faculty review.
 */
const TRANSFER_OPTIONS = [
  {
    id: 'overdamped-after-position-change',
    label: 'An off-level, overdamped measurement chain that requires revalidation',
    feedback:
      'Best-supported interpretation. The off-level reference and the sluggish release identify a measurement-chain problem: re-level, then restore the dynamic response before reading pulse pressure.',
  },
  {
    id: 'true-afterload-change',
    label: 'A true acute rise in afterload; the pressure signal itself is already valid',
    feedback:
      'Not the best-supported reading. The fast-flush release tests the tubing and transducer, not the circulation, so a sluggish release points to the measurement chain whatever the patient is doing — and the transducer has moved with the patient. Revalidate the line before attributing the narrow pulse pressure to the patient.',
  },
  {
    id: 'respiratory-change',
    label: 'Respiratory variation alone, despite the abnormal fast-flush release',
    feedback:
      'Not the best-supported reading. Respiratory variation moves readings with the breath, but it does not explain a sluggish fast-flush release or a transducer that has moved off level. Revalidate the line first.',
  },
] as const

/**
 * One Practice case, or the applied case opened from the former Assess page.
 *
 * Self-paced (HD-01): every checkpoint opens at any point — a working frame is optional, actions do
 * not wait for it, and the debrief and the transfer variant open without a final reassessment. What
 * stays real is the simulation: interventions run through the reducer with its safety interrupts and
 * bundled-credit refusal, the modeled response needs model time, and the transfer is marked done only
 * when the line has actually been re-levelled and its flush response classified and corrected.
 * Nothing about a run is written: no attempts, scores, hints, mastery or resume checkpoints. The only
 * record is that the case was opened on this device.
 */
export function HemodynamicCaseActivity({
  caseId,
  mode,
  locale = 'en',
  nextLearn,
}: {
  readonly caseId: string
  readonly mode: CaseMode
  readonly locale?: string
  readonly nextLearn?: string
}) {
  const definition = requireValue(
    hemodynamicCaseById.get(caseId),
    `Unknown hemodynamics case: ${caseId}`,
  )
  const section = mode === 'challenge' ? 'assess' : 'practice'
  const activityId =
    mode === 'challenge' ? 'hemodynamics:assess:masked-seeded' : `hemodynamics:practice:${caseId}`
  const teachingArtifact = requireValue(
    hemodynamicTeachingArtifactByCaseId.get(caseId),
    `Missing hemodynamics teaching artifact: ${caseId}`,
  )

  const router = useRouter()
  const [state, setState] = useState(() =>
    createInitialHemodynamicState(definition, 'practice', seededCaseNumber(caseId, mode)),
  )
  const [phase, setPhase] = useState<CriticalCareActivityPhase>('recognize')
  const [hintVisible, setHintVisible] = useState(false)
  const [baseline, setBaseline] = useState<HemodynamicSimulationState | null>(null)
  const [transferComplete, setTransferComplete] = useState(false)
  const [transferStarted, setTransferStarted] = useState(false)
  const [transferChoiceId, setTransferChoiceId] = useState<string | null>(null)
  const [transferReasoningShown, setTransferReasoningShown] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [holdFeedback, setHoldFeedback] = useState(false)
  const [feedbackEvents, setFeedbackEvents] = useState<readonly ScenarioFeedbackEvent[]>([])
  const [revealedFeedbackIds, setRevealedFeedbackIds] = useState<readonly string[]>([])
  const [decisionTrace, setDecisionTrace] = useState<readonly ScenarioDecisionTraceEntry[]>([])
  const [activeHardInterruptId, setActiveHardInterruptId] = useState<string | null>(null)
  const traceSequence = useRef(0)
  const feedbackSequence = useRef(0)
  // Automatic open/visible/phase lifecycle events only; no answer, hint, safety or outcome events.
  useCriticalCareActivityAnalytics({
    moduleId: 'icu-hemodynamics',
    activityId,
    mode,
    phase,
  })
  const dispatch = (action: HemodynamicAction) => {
    setState((current) => icuHemodynamicsReducer(current, action))
  }
  const balloonActive = state.catheter.balloonInflated || state.catheter.floatBalloonInflated

  useEffect(() => {
    updateSelfPacedRecord((current) =>
      withCaseOpened(current, caseId, mode === 'challenge' ? 'applied' : 'practice'),
    )
  }, [caseId, mode])

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const intervalMs = reducedMotion ? 250 : 100
    const timer = window.setInterval(
      () =>
        setState((current) =>
          icuHemodynamicsReducer(current, { type: 'TICK', seconds: intervalMs / 1000 }),
        ),
      intervalMs,
    )
    return () => window.clearInterval(timer)
  }, [])

  const referenceEntries = useMemo(() => {
    const directlyRelated = criticalCareReferences.filter((reference) =>
      (reference.relatedActivityIds as readonly string[]).includes(activityId),
    )
    const records =
      directlyRelated.length > 0
        ? directlyRelated
        : criticalCareReferences.filter((reference) =>
            (reference.moduleIds as readonly string[]).includes('icu-hemodynamics'),
          )
    return records.map((reference) => ({
      id: reference.id,
      title: reference.title,
      summary: reference.summary,
      meta: reference.category.replaceAll('-', ' '),
    }))
  }, [activityId])

  const evidenceEntries = useMemo(
    () =>
      definition.sourceIds.flatMap((sourceId) => {
        const source = hemodynamicsSourceById.get(sourceId)
        return source
          ? [
              {
                id: source.id,
                title: source.title,
                sourceLabel: `${source.citation} · version ${source.version}. Intended use: ${source.intendedUse}`,
                limitation: source.limitation ?? 'Educational use only; not patient-specific.',
              },
            ]
          : []
      }),
    [definition.sourceIds],
  )

  const objectives: Record<CriticalCareActivityPhase, string> = {
    recognize: 'Read the patient and the available signals',
    predict: 'Interpret the findings and choose a priority',
    act: 'Choose an action and check the measurements',
    observe: 'Compare the response and reassess',
    explain: 'Review your reasoning and the modeled response',
    transfer: 'Revalidate the changed signal',
  }

  function checkpoint(nextPhase: CriticalCareActivityPhase) {
    setPhase(nextPhase)
    setHintVisible(false)
  }

  function selectPhase(nextPhase: CriticalCareActivityPhase) {
    if (balloonActive || nextPhase === phase) return
    if (nextPhase === 'transfer') {
      beginTransfer()
      return
    }
    checkpoint(nextPhase)
    setMessage(`Opened “${objectives[nextPhase]}”. Every checkpoint can be opened at any point.`)
  }

  function traceSystemState(): string {
    return `MAP ${metricValue(state.measurements.mapMmHg)} mmHg · cardiac index ${metricValue(
      state.measurements.cardiacIndexLMinM2,
      1,
    )} L/min/m² · RAP ${metricValue(state.measurements.rapMmHg)} mmHg · signal ${
      state.measurementSystem.zeroed ? 'zeroed' : 'not yet zeroed'
    }.`
  }

  function recordDecision(action: string) {
    traceSequence.current += 1
    const entry: ScenarioDecisionTraceEntry = {
      id: `${caseId}-trace-${traceSequence.current}`,
      timeSeconds: state.timeSeconds,
      action,
      systemState: traceSystemState(),
    }
    setDecisionTrace((current) => [...current, entry])
  }

  function recordWorkingFrame() {
    if (!baseline) setBaseline(state)
    const mechanism =
      definition.mechanismOptions.find((item) => item.id === state.selectedMechanismId)?.label ??
      'No mechanism selected'
    const priority =
      definition.priorityOptions.find((item) => item.id === state.selectedPriorityId)?.label ??
      'No priority selected'
    recordDecision(`Recorded frame: ${mechanism}. Immediate priority: ${priority}.`)
    dispatch({ type: 'COMMIT_PREDICTION' })
    checkpoint('act')
  }

  function applyIntervention(interventionId: string) {
    const selected = definition.interventions.find((item) => item.id === interventionId)
    if (!selected) return

    const hardInterrupt = definition.safetyCriticalErrorIds.includes(selected.id)
    const authoredTiming = feedbackTimingForHemodynamicAction(selected, hardInterrupt)
    // Holding feedback is the learner's choice, offered on the applied case; safety interrupts ignore it.
    const timing = hardInterrupt || !holdFeedback ? authoredTiming : 'debrief'
    feedbackSequence.current += 1
    const event: ScenarioFeedbackEvent = {
      id: `${caseId}-feedback-${feedbackSequence.current}`,
      actionId: selected.id,
      actionLabel: selected.label,
      timeSeconds: state.timeSeconds,
      timing,
      hardInterrupt,
      feedback: feedbackForHemodynamicAction(definition, selected, hardInterrupt),
    }
    setFeedbackEvents((current) => [...current, event])
    recordDecision(
      hardInterrupt
        ? `Considered ${selected.label}; the safety interrupt preserved the pre-action state.`
        : `Applied ${selected.label}.`,
    )

    if (hardInterrupt) {
      setRevealedFeedbackIds((current) => [...new Set([...current, event.id])])
      setActiveHardInterruptId(event.id)
      setMessage(
        'Stopping here—the modeled action could cause immediate harm in this phenotype. The pre-action state is preserved.',
      )
      return
    }

    if (!baseline) setBaseline(state)
    dispatch({ type: 'APPLY_INTERVENTION', intervention: selected })
    if (timing === 'immediate') {
      setRevealedFeedbackIds((current) => [...new Set([...current, event.id])])
    }
  }

  function observeModeledResponse() {
    if (balloonActive) return
    recordDecision('Paused to observe the modeled response before final reassessment.')
    setRevealedFeedbackIds((current) => [
      ...new Set([
        ...current,
        ...feedbackEvents
          .filter((event) => event.timing === 'after-consequence')
          .map((event) => event.id),
      ]),
    ])
    checkpoint('observe')
  }

  function completeReassessment() {
    if (balloonActive) return
    recordDecision('Recorded the final whole-patient reassessment and opened the debrief.')
    setState((current) => {
      const reassessed = icuHemodynamicsReducer(current, { type: 'REASSESS' })
      return icuHemodynamicsReducer(reassessed, { type: 'COMPLETE_CASE' })
    })
    checkpoint('explain')
  }

  function beginTransfer() {
    if (balloonActive) return
    if (transferStarted) {
      checkpoint('transfer')
      return
    }
    setTransferStarted(true)
    setState((current) => {
      const leveledVariant = icuHemodynamicsReducer(current, {
        type: 'SET_TRANSDUCER_LEVEL',
        levelCm: -5,
      })
      const dampedVariant = icuHemodynamicsReducer(leveledVariant, {
        type: 'SET_DAMPING',
        dampingRatio: 1.15,
      })
      return {
        ...icuHemodynamicsReducer(dampedVariant, {
          type: 'SET_ARTIFACT',
          artifact: 'overdamped',
        }),
        signalValidationChecks: current.signalValidationChecks.filter(
          (check) =>
            check !== 'fast-flush' &&
            check !== 'dynamic-response-classified' &&
            check !== 'dynamic-response-corrected',
        ),
      }
    })
    setTransferChoiceId(null)
    checkpoint('transfer')
  }

  const lineRevalidated =
    Math.abs(state.measurementSystem.transducerLevelCm) <=
      HEMODYNAMIC_CLINICAL_THRESHOLDS.signalValidation.transducerLevelToleranceCm &&
    state.signalValidationChecks.includes('fast-flush') &&
    state.signalValidationChecks.includes('dynamic-response-classified') &&
    state.signalValidationChecks.includes('dynamic-response-corrected') &&
    state.measurementSystem.artifact === 'none'

  function completeTransfer() {
    if (!transferStarted || !lineRevalidated) {
      setMessage(
        'The line is not revalidated yet: re-level the transducer, run and classify the fast-flush trace, and restore the response in the workspace.',
      )
      return
    }
    setTransferComplete(true)
    setMessage(
      'Line revalidated on the transfer variant: level, flush response classified and corrected.',
    )
  }

  function reset() {
    setState(createInitialHemodynamicState(definition, 'practice', seededCaseNumber(caseId, mode)))
    setPhase('recognize')
    setHintVisible(false)
    setBaseline(null)
    setTransferComplete(false)
    setTransferStarted(false)
    setTransferChoiceId(null)
    setTransferReasoningShown(false)
    setFeedbackEvents([])
    setRevealedFeedbackIds([])
    setDecisionTrace([])
    setActiveHardInterruptId(null)
    traceSequence.current = 0
    feedbackSequence.current = 0
    setMessage('Case reset to its original variation.')
  }

  function exitCase() {
    router.push(`/icu-hemodynamics/${section}` as Route)
  }

  const requiredCompleted = definition.requiredInterventionIds.filter((id) =>
    state.completedInterventionIds.includes(id),
  ).length
  const average = thermodilutionAcceptedAverage(state.thermodilutionTrials)
  const visibleInterventions = definition.interventions

  let taskControls = null
  if (phase === 'recognize') {
    taskControls = (
      <div className="grid gap-3">
        {mode === 'challenge' ? (
          <label className="flex min-h-11 items-start gap-3 rounded-xl border p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={holdFeedback}
              onChange={(event) => setHoldFeedback(event.target.checked)}
            />
            <span>
              <strong className="block">Hold teaching feedback until the debrief</strong>
              <span className="mt-1 block text-xs text-muted-foreground">
                Off by default: feedback appears as you act. Safety interrupts always appear, and
                the debrief can be opened at any point.
              </span>
            </span>
          </label>
        ) : null}
        <button
          type="button"
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          onClick={() => checkpoint('predict')}
        >
          Orient to the patient and signals
        </button>
      </div>
    )
  } else if (phase === 'predict' && state.predictionCommitted) {
    taskControls = (
      <div>
        <p>
          Recorded interpretation:{' '}
          {
            definition.mechanismOptions.find((option) => option.id === state.selectedMechanismId)
              ?.label
          }
          . Priority:{' '}
          {
            definition.priorityOptions.find((option) => option.id === state.selectedPriorityId)
              ?.label
          }
          .
        </p>
        <button type="button" onClick={() => checkpoint('act')}>
          Return to actions
        </button>
      </div>
    )
  } else if (phase === 'predict') {
    taskControls = (
      <div className="grid gap-3">
        <p className="text-sm leading-6">
          Recording a working frame is optional. It makes the comparison in the debrief more useful,
          and you can go to the actions without it.
        </p>
        <label className="grid gap-1 text-sm font-semibold">
          Suspected mechanism
          <select
            className="min-h-11 rounded-xl border bg-background px-3 font-normal"
            value={state.selectedMechanismId}
            onChange={(event) => dispatch({ type: 'SELECT_MECHANISM', id: event.target.value })}
          >
            <option value="">Choose a mechanism…</option>
            {definition.mechanismOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Immediate priority
          <select
            className="min-h-11 rounded-xl border bg-background px-3 font-normal"
            value={state.selectedPriorityId}
            onChange={(event) => dispatch({ type: 'SELECT_PRIORITY', id: event.target.value })}
          >
            <option value="">Choose a priority…</option>
            {definition.priorityOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!state.selectedMechanismId || !state.selectedPriorityId}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={recordWorkingFrame}
        >
          Record mechanism and priority
        </button>
        <button
          type="button"
          className="min-h-11 rounded-xl border px-4 py-2.5 text-sm font-semibold"
          onClick={() => checkpoint('act')}
        >
          Go to the actions without recording a frame
        </button>
      </div>
    )
  } else if (phase === 'act') {
    taskControls = (
      <div className="grid gap-3">
        <div className="grid gap-2 text-xs" aria-label="Signal-validation state">
          <p
            className="rounded-lg border p-2"
            data-complete={Math.abs(state.measurementSystem.transducerLevelCm) <= 1 || undefined}
          >
            Level: {state.measurementSystem.transducerLevelCm.toFixed(0)} cm from reference
          </p>
          <p
            className="rounded-lg border p-2"
            data-complete={state.measurementSystem.zeroed || undefined}
          >
            Atmospheric zero: {state.measurementSystem.zeroed ? 'complete' : 'required'}
          </p>
          <p
            className="rounded-lg border p-2"
            data-complete={
              state.signalValidationChecks.includes('dynamic-response-classified') || undefined
            }
          >
            Dynamic response:{' '}
            {state.signalValidationChecks.includes('dynamic-response-classified')
              ? 'classified'
              : 'not classified'}
          </p>
        </div>
        <div className="grid gap-2" aria-label="Bounded simulated interventions">
          {visibleInterventions.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={state.completedInterventionIds.includes(item.id) && !item.repeatable}
              className="min-h-11 rounded-xl border p-3 text-left text-sm disabled:opacity-50"
              onClick={() => applyIntervention(item.id)}
            >
              <strong className="block">{item.shortLabel}</strong>
              <span className="text-xs text-muted-foreground">{item.description}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={balloonActive}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={observeModeledResponse}
        >
          Observe the modeled response
        </button>
      </div>
    )
  } else if (phase === 'observe') {
    taskControls = (
      <div className="grid gap-3">
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <dt>MAP</dt>
            <dd>{metricValue(state.measurements.mapMmHg)} mmHg</dd>
          </div>
          <div className="flex justify-between">
            <dt>Cardiac index</dt>
            <dd>
              {average === null
                ? 'Not acquired'
                : `${metricValue(average / state.parameters.bodySurfaceAreaM2, 1)} L/min/m²`}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Modeled response</dt>
            <dd>
              {state.completedInterventionIds.length === 0
                ? 'No action taken yet'
                : requiredCompleted === definition.requiredInterventionIds.length
                  ? 'Ready to observe'
                  : 'Continue the action sequence'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Accepted CO</dt>
            <dd>{average === null ? 'Pending' : `${average.toFixed(1)} L/min`}</dd>
          </div>
        </dl>
        <button
          type="button"
          className="min-h-11 rounded-xl border px-4 py-2.5 text-sm font-semibold"
          onClick={() => dispatch({ type: 'TICK', seconds: 15 })}
        >
          Observe 15 model seconds
        </button>
        <button
          type="button"
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          onClick={completeReassessment}
        >
          Reassess and open the debrief
        </button>
      </div>
    )
  } else if (phase === 'explain') {
    taskControls = (
      <p className="rounded-xl border bg-muted p-3 text-sm leading-6">
        Compare your decisions with the authored expert trace. Writing down your working frame first
        is optional; the expert reasoning can also be opened directly.
      </p>
    )
  } else {
    const chosen = TRANSFER_OPTIONS.find((option) => option.id === transferChoiceId)
    taskControls = (
      <div className="grid gap-2">
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold">
            After a patient-position change, the release trace returns slowly with little
            oscillation and pulse pressure narrows. What best explains the new signal?
          </legend>
          {TRANSFER_OPTIONS.map((option) => (
            <label
              key={option.id}
              className="flex min-h-11 items-start gap-3 rounded-xl border p-3 text-sm"
            >
              <input
                type="radio"
                name="case-transfer-interpretation"
                checked={transferChoiceId === option.id}
                onChange={() => setTransferChoiceId(option.id)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        {chosen ? (
          <p
            role="status"
            className="rounded-xl border p-3 text-sm leading-6"
            data-transfer-feedback
          >
            {chosen.feedback}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {chosen ? (
            <button
              type="button"
              className="min-h-11 rounded-xl border px-4 py-2.5 text-sm font-semibold"
              onClick={() => setTransferChoiceId(null)}
            >
              Try again
            </button>
          ) : null}
          <button
            type="button"
            className="min-h-11 rounded-xl border px-4 py-2.5 text-sm font-semibold"
            aria-expanded={transferReasoningShown}
            onClick={() => setTransferReasoningShown((current) => !current)}
          >
            {transferReasoningShown ? 'Hide the reasoning' : 'Show the reasoning'}
          </button>
        </div>
        {transferReasoningShown ? (
          <ul
            className="grid gap-2 rounded-xl border p-3 text-sm leading-6"
            data-transfer-reasoning
          >
            {TRANSFER_OPTIONS.map((option) => (
              <li key={option.id}>
                <strong>{option.label}.</strong> {option.feedback}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="rounded-xl bg-muted p-3 text-xs leading-5">
          The question is optional. What revalidates the line is the work in the pressure-system
          workspace: re-level, run and classify the live fast-flush trace, then restore the
          response.
        </p>
        <button
          type="button"
          disabled={transferComplete || !lineRevalidated}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={completeTransfer}
        >
          Confirm the line is revalidated
        </button>
      </div>
    )
  }

  const inlineFeedbackEvents = feedbackEvents
    .filter((event) => revealedFeedbackIds.includes(event.id))
    .slice(-2)

  const feedback = (
    <>
      {inlineFeedbackEvents.map((event) => (
        <ScenarioFeedbackCard
          key={event.id}
          event={event}
          onRewind={
            event.id === activeHardInterruptId
              ? () => {
                  setActiveHardInterruptId(null)
                  setRevealedFeedbackIds((current) => current.filter((id) => id !== event.id))
                  setMessage(
                    'Returned to the unchanged pre-action state. Choose a different action when ready.',
                  )
                }
              : undefined
          }
        />
      ))}
    </>
  )
  const currentTask = (
    <section className={flowStyles.caseTask} aria-label="Current case task">
      <h2>{objectives[phase]}</h2>
      {taskControls}
      {hintVisible ? <p data-case-hint>{definition.guidedPrompt}</p> : null}
      {feedback}
    </section>
  )

  return (
    <IcuHemodynamicsModuleFrameV2
      locale={locale}
      activeHref={`/icu-hemodynamics/${section}`}
      activityMode
      documentFlow
    >
      <SimulationLaunchGate
        activityTitle={definition.title}
        minimumViewport="tablet"
        bandwidthClass="standard"
        estimatedSizeLabel="Under 2 MB after shared application assets"
        lightweightAlternativeHref={`/icu-hemodynamics/${section}`}
        onSaveForLater={exitCase}
        theme="dark"
      >
        <div
          className={flowStyles.caseFlow}
          data-case-flow
          data-phase={phase}
          data-feedback-mode={holdFeedback ? 'deferred' : 'immediate'}
        >
          <header>
            <Link href={`/icu-hemodynamics/${section}` as Route}>
              {mode === 'challenge' ? 'Applied case' : 'Practice'} · <span>{caseId}</span>
            </Link>
            <h1>{definition.title}</h1>
            <div className={flowStyles.caseActions}>
              <button
                type="button"
                aria-expanded={hintVisible}
                onClick={() => setHintVisible((current) => !current)}
              >
                {hintVisible ? 'Hide help' : 'Help'}
              </button>
              <button type="button" onClick={reset} disabled={balloonActive}>
                Reset case
              </button>
              <button type="button" onClick={exitCase} disabled={balloonActive}>
                Exit case
              </button>
              <ReferenceDrawer
                entries={referenceEntries}
                trigger={<button type="button">Reference</button>}
              />
              <EvidenceDrawer
                entries={evidenceEntries}
                trigger={<button type="button">Evidence</button>}
              />
            </div>
            <details>
              <summary>Case checkpoints · open any of them</summary>
              <nav aria-label="Case checkpoints">
                {(['recognize', 'predict', 'act', 'observe', 'explain', 'transfer'] as const).map(
                  (candidate) => (
                    <button
                      type="button"
                      key={candidate}
                      disabled={balloonActive}
                      aria-current={candidate === phase ? 'step' : undefined}
                      onClick={() => selectPhase(candidate)}
                    >
                      {objectives[candidate]}
                    </button>
                  ),
                )}
              </nav>
            </details>
          </header>
          <section className={flowStyles.caseBrief} aria-label="Patient brief">
            <h2>Patient brief</h2>
            <p>{definition.presentation}</p>
            <p>
              Adult ICU · simulated · HR {metricValue(state.measurements.heartRateBpm)} /min · PEEP{' '}
              {state.parameters.peepCmH2O} cm H₂O
            </p>
          </section>
          {state.catheter.balloonInflated ? (
            <aside className={flowStyles.safety} role="status">
              Balloon active: finish acquisition and recovery before leaving this task.
              <button type="button" onClick={() => dispatch({ type: 'DEFLATE_WEDGE' })}>
                Deflate balloon
              </button>
            </aside>
          ) : null}
          {phase === 'explain' ? (
            <section className={flowStyles.caseDebrief} aria-label="Case debrief">
              <h2>{objectives.explain}</h2>
              {taskControls}
              {!state.completed ? (
                <p data-debrief-before-reassessment>
                  The final reassessment has not been recorded. The decision trace shows what you
                  have done so far, and the case keeps its state if you return to it.
                </p>
              ) : null}
              <details data-expert-reasoning>
                <summary>Open the authored expert reasoning now</summary>
                <p>
                  An authored example of cue use and timing, not the only acceptable path. Opening
                  it records nothing.
                </p>
                <ol>
                  {teachingArtifact.expertTrace.map((step) => (
                    <li key={step.id}>
                      <strong>{step.moment}.</strong> Cue: {step.cue} Read: {step.reasoning}{' '}
                      Commitment: {step.commitment}
                    </li>
                  ))}
                </ol>
              </details>
              <ScenarioTeachingDebrief
                scenarioTitle={definition.title}
                decisionTrace={decisionTrace}
                expertTrace={teachingArtifact.expertTrace}
                feedbackEvents={feedbackEvents}
                conceptIds={teachingArtifact.conceptIds}
                evidence={definition.sourceIds.flatMap((sourceId) => {
                  const source = hemodynamicsSourceById.get(sourceId)
                  return source
                    ? [
                        {
                          id: source.id,
                          title: source.title,
                          citation: `${source.citation} · version ${source.version}`,
                        },
                      ]
                    : []
                })}
                onContinue={beginTransfer}
              />
              <div className={flowStyles.caseActions}>
                {!state.completed ? (
                  <button type="button" onClick={() => checkpoint('act')}>
                    Return to the case
                  </button>
                ) : null}
                <button type="button" onClick={beginTransfer} disabled={balloonActive}>
                  Open the signal-transfer variant
                </button>
              </div>
              <p>This debrief does not establish clinical competence.</p>
              <HemodynamicNativeWorkspace
                state={state}
                dispatch={dispatch}
                interactive={false}
                revealModel
              />
            </section>
          ) : (
            <>
              {phase === 'observe' && baseline ? (
                <section className={flowStyles.comparison} aria-label="Retained case observations">
                  <h2>Before action and current response</h2>
                  <p>
                    Recorded before your first recorded frame or action; current values reflect the
                    running model.
                  </p>
                  <table>
                    <thead>
                      <tr>
                        <th>Observation</th>
                        <th>Before action</th>
                        <th>Current</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th>MAP (mmHg)</th>
                        <td>{metricValue(baseline.measurements.mapMmHg)}</td>
                        <td>{metricValue(state.measurements.mapMmHg)}</td>
                      </tr>
                      <tr>
                        <th>Accepted thermodilution CO (L/min)</th>
                        <td>
                          {metricValue(
                            thermodilutionAcceptedAverage(baseline.thermodilutionTrials),
                            1,
                          )}
                        </td>
                        <td>{metricValue(average, 1)}</td>
                      </tr>
                    </tbody>
                  </table>
                </section>
              ) : null}
              <HemodynamicNativeWorkspace
                state={state}
                dispatch={dispatch}
                interactive={phase === 'act' || phase === 'transfer'}
                task={currentTask}
                pressureChallengeMode={
                  definition.id === 'HD-08' || phase === 'transfer' ? 'current-state' : 'selectable'
                }
              />
            </>
          )}
          {message ? <p role="status">{message}</p> : null}
          {transferComplete ? (
            <p role="status" data-transfer-complete>
              Transfer line revalidated in this visit. Nothing about the run is saved.{' '}
              <Link
                href={
                  nextLearn
                    ? { pathname: '/icu-hemodynamics/learn', query: { activity: nextLearn } }
                    : '/icu-hemodynamics/learn'
                }
              >
                Continue learning
              </Link>
            </p>
          ) : null}
        </div>
      </SimulationLaunchGate>
    </IcuHemodynamicsModuleFrameV2>
  )
}
