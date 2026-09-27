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
  authoredConcernForUnfavourableAction,
  feedbackForHemodynamicAction,
  feedbackTimingForHemodynamicAction,
  hemodynamicPreparationGuidance,
  HEMODYNAMIC_CLINICAL_THRESHOLDS,
  hemodynamicCaseById,
  hemodynamicsSourceById,
  hemodynamicTeachingArtifactByCaseId,
  isHemodynamicPreparationOnly,
  preparationFeedbackForHemodynamicAction,
} from '../content'
import {
  HEMODYNAMICS_CLINICAL_REVIEW_LINE,
  hemodynamicsSourceSummary,
} from '../content/sourceReviewMetadata'
import {
  createInitialHemodynamicState,
  icuHemodynamicsReducer,
  type HemodynamicAction,
  type HemodynamicInterventionDefinition,
  type HemodynamicSimulationState,
} from '../engine'
import {
  acceptedFlowSeries,
  describeObservedSystemState,
  flowAroundAction,
  observedSystemState,
  type AcquiredFlow,
  type ObservedSystemState,
} from '../engine/decisionRecord'
import { modelOnlyHorizonSeconds, modelOnlyMatchedComparison } from '../engine/matchedComparison'
import {
  physiologicalEpisodeWords,
  thermodilutionSeriesView,
} from '../engine/measurementProvenance'
import {
  absorbedInterventionNarration,
  interventionHasModeledEffect,
  latentPhysiologicalEstimates,
} from '../engine/simulation'
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

/**
 * An action the case accepted, with the state immediately before it (HD-PRE-REVIEW-02).
 *
 * Kept so the response to it can be read at a matched time: what the monitor showed and what had
 * been acquired just before, against what it shows now — and, labelled as the model's own values,
 * what this model does at the same moment with and without the action.
 */
interface CaseActionRecord {
  readonly id: string
  readonly intervention: HemodynamicInterventionDefinition
  readonly atSeconds: number
  readonly before: HemodynamicSimulationState
}

/** One acquired series, said with the conditions it was acquired under. */
function flowWords(flow: AcquiredFlow): string {
  return `${flow.cardiacOutputLMin.toFixed(1)} L/min (CI ${flow.cardiacIndexLMinM2.toFixed(1)}), acquired ${physiologicalEpisodeWords(flow.episode)}`
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
  const [actionRecords, setActionRecords] = useState<readonly CaseActionRecord[]>([])
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
                sourceLabel: `${hemodynamicsSourceSummary(source)} Intended use: ${source.intendedUse} ${HEMODYNAMICS_CLINICAL_REVIEW_LINE}`,
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

  /*
   * The system state a decision is recorded against: what was on the screen or had been acquired.
   *
   * This used to format `state.measurements`, which is the model's own derivation and always holds
   * a cardiac index whether or not a cardiac output was ever measured. See `observedSystemState`
   * (report P-10). The snapshot is taken at the event and kept, so a later measurement never
   * appears in an earlier row.
   */
  function traceSystemState(): string {
    return describeObservedSystemState(observedSystemState(state))
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

  /*
   * A request, and then what the engine did with it.
   *
   * The narration used to be written before the dispatch: every non-interrupt action was recorded
   * as "Applied …" and carried the authored feedback, which for three HD-08 actions describes
   * completed effects. The reducer refuses those three by design — the case's milestones come from
   * the real pressure-system, catheter and thermodilution controls — so the panel said the chain
   * had been re-levelled while the header still read ZERO REQUIRED (report P-09, Figure 45).
   *
   * The refusal stays. What changed is that the host now reduces the action itself, asks the
   * resulting state whether anything was accepted, and only then decides what to say. Nothing here
   * zeroes, moves, acquires or clears anything to make a description come true.
   */
  function applyIntervention(interventionId: string) {
    const selected = definition.interventions.find((item) => item.id === interventionId)
    if (!selected) return

    const hardInterrupt = definition.safetyCriticalErrorIds.includes(selected.id)
    const preparationOnly = !hardInterrupt && isHemodynamicPreparationOnly(definition, selected)
    const authoredTiming = feedbackTimingForHemodynamicAction(selected, hardInterrupt)
    // Holding feedback is the learner's choice, offered on the applied case; safety interrupts ignore it.
    // A refused request is answered at once whatever the setting: it is the answer to a press, not
    // a teaching verdict on a modeled response.
    const timing = hardInterrupt || preparationOnly || !holdFeedback ? authoredTiming : 'debrief'
    // Reduce it, then read the result. A dispatch is a request; only the engine says what happened.
    // A safety interrupt is never reduced: the pre-action state is preserved.
    const next = hardInterrupt
      ? state
      : icuHemodynamicsReducer(state, {
          type: 'APPLY_INTERVENTION',
          intervention: selected,
        })
    const accepted = next.activeEffects.length > state.activeEffects.length
    // HD-PRE-REVIEW-02 sanity repair (blocker 2): accepted, but the model's bounds absorb its whole
    // effect — no new physiological episode. The authored "what happened" describes a change the
    // model did not make, so it is replaced by what did happen; the teaching around it is kept.
    const absorbed =
      accepted &&
      interventionHasModeledEffect(selected) &&
      next.physiologicalEpisode.index === state.physiologicalEpisode.index
    const authoredFeedback = preparationOnly
      ? preparationFeedbackForHemodynamicAction(selected)
      : feedbackForHemodynamicAction(definition, selected, hardInterrupt)
    feedbackSequence.current += 1
    const event: ScenarioFeedbackEvent = {
      id: `${caseId}-feedback-${feedbackSequence.current}`,
      actionId: selected.id,
      actionLabel: selected.label,
      timeSeconds: state.timeSeconds,
      timing,
      hardInterrupt,
      feedback: absorbed
        ? { ...authoredFeedback, whatHappened: absorbedInterventionNarration(selected) }
        : authoredFeedback,
    }
    setFeedbackEvents((current) => [...current, event])

    if (hardInterrupt) {
      recordDecision(
        `Considered ${selected.label}; the safety interrupt preserved the pre-action state.`,
      )
      setRevealedFeedbackIds((current) => [...new Set([...current, event.id])])
      setActiveHardInterruptId(event.id)
      setMessage(
        'Stopping here—the modeled action could cause immediate harm in this phenotype. The pre-action state is preserved.',
      )
      return
    }

    recordDecision(
      absorbed
        ? `Applied ${selected.label}; it had no further modeled effect — every quantity it acts on was already at the limit this simulation allows.`
        : accepted
          ? `Applied ${selected.label}.`
          : `Requested ${selected.label}; this case did not perform it from the action list.`,
    )
    if (!baseline) setBaseline(state)
    if (accepted) {
      setActionRecords((current) => [
        ...current,
        {
          id: `${caseId}-action-${feedbackSequence.current}`,
          intervention: selected,
          atSeconds: state.timeSeconds,
          before: state,
        },
      ])
    }
    setState(next)
    if (!accepted && next.responseMessage && next.responseMessage !== state.responseMessage) {
      setMessage(next.responseMessage)
    }
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
    // A reset is a new run of the case: the reducer gives it a new session identity, so nothing
    // acquired before the reset can be read as this run's measurement.
    setState((current) =>
      icuHemodynamicsReducer(current, {
        type: 'RESET_CASE',
        definition,
        mode: 'practice',
        seed: seededCaseNumber(caseId, mode),
      }),
    )
    setActionRecords([])
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
  // The accepted series for the conditions now; a series from before a modeled intervention is not
  // carried forward as the current value (report P-05).
  const seriesView = thermodilutionSeriesView(state)
  const average = seriesView.current.averageLMin
  const observedNow = observedSystemState(state)
  const legRaise = [...actionRecords]
    .reverse()
    .find((record) => record.intervention.id === 'passive-leg-raise')
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
          {visibleInterventions.map((item) => {
            // On HD-08 these three name a skill the engine will not grant from a card. The card
            // says where the control is rather than implying it does the work (report P-09).
            const guidance = isHemodynamicPreparationOnly(definition, item)
              ? hemodynamicPreparationGuidance(item.id)
              : undefined
            return (
              <button
                key={item.id}
                type="button"
                data-intervention={item.id}
                data-preparation-only={guidance ? 'true' : undefined}
                disabled={state.completedInterventionIds.includes(item.id) && !item.repeatable}
                className="min-h-11 rounded-xl border p-3 text-left text-sm disabled:opacity-50"
                onClick={() => applyIntervention(item.id)}
              >
                <strong className="block">{item.shortLabel}</strong>
                <span className="text-xs text-muted-foreground">{item.description}</span>
                {guidance ? (
                  <span className="mt-1 block text-xs text-muted-foreground">{guidance}</span>
                ) : null}
              </button>
            )
          })}
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
          <div className="flex justify-between gap-3">
            <dt>MAP (monitor, last beat)</dt>
            <dd>{metricValue(observedNow.arterialMean.displayedMmHg)} mmHg</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Cardiac index</dt>
            <dd data-observe-cardiac-index>
              {average !== null
                ? `${metricValue(average / state.parameters.bodySurfaceAreaM2, 1)} L/min/m²`
                : observedNow.earlierFlow
                  ? `Not acquired under the current conditions (the last series was acquired ${physiologicalEpisodeWords(observedNow.earlierFlow.episode)})`
                  : 'Not acquired'}
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
        {legRaise ? <LegRaiseModelOnly record={legRaise} state={state} /> : null}
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
            <p data-model-time>
              Model time: the clock on the monitor counts simulation seconds. Responses here are
              compressed, and their timing is not a clinical time course.
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
              <CaseRunSummary
                definition={definition}
                state={state}
                baseline={baseline}
                decisionTrace={decisionTrace}
                actionRecords={actionRecords}
              />
              <ScenarioTeachingDebrief
                allowRevealWithoutFrame
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
                          citation: hemodynamicsSourceSummary(source),
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
                <BeforeAndCurrent
                  before={observedSystemState(baseline)}
                  now={observedNow}
                  elapsedSeconds={state.timeSeconds - baseline.timeSeconds}
                />
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

/**
 * What this run actually did, said before the authored expert path is compared with it.
 *
 * Two findings meet here. The debrief listed the learner's actions and then the expert path
 * without ever saying that the definitive step in the expert path had not been taken, and left the
 * learner to notice that a rising mean arterial pressure had not been accompanied by any measured
 * flow (report A-02, Figure 46). And every case opens on an unzeroed line, which the debrief
 * mentioned only as grey text on each trace row (report P-11).
 *
 * So this says both, from the run's own record: which of the case's authored definitive actions
 * the engine accepted, what the pressure evidence is worth given the state of the line, and — when
 * a pressure rose — that no flow measurement exists in this run to say whether perfusion followed.
 * It adds no score, no pass mark and no gate; the unzeroed line is described as a limit on one
 * kind of evidence, not as a reason treatment should have waited. It is HD-local data rendered
 * beside the shared debrief rather than a change to it.
 */
/**
 * The before-and-now table in the response step (HD-PRE-REVIEW-02).
 *
 * Both columns are what a learner could have had: the monitor's printed MAP at each moment, and the
 * accepted thermodilution series for the conditions at each moment. It used to print the model's
 * own MAP estimate and a pooled average; a series from before a modeled intervention is now shown
 * with its conditions and is never the "current" value.
 */
function BeforeAndCurrent({
  before,
  now,
  elapsedSeconds,
}: {
  readonly before: ObservedSystemState
  readonly now: ObservedSystemState
  readonly elapsedSeconds: number
}) {
  return (
    <section className={flowStyles.comparison} aria-label="Retained case observations">
      <h2>Before action and current response</h2>
      <p>
        Recorded just before your first recorded frame or action, and now,{' '}
        {elapsedSeconds.toFixed(0)} model seconds later. MAP is the monitor’s last beat at each
        moment. Each thermodilution value is the series acquired under the conditions named; two
        series are compared as two, never averaged.
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
            <th>MAP (mmHg, monitor)</th>
            <td>{metricValue(before.arterialMean.displayedMmHg)}</td>
            <td>{metricValue(now.arterialMean.displayedMmHg)}</td>
          </tr>
          <tr>
            <th>Accepted thermodilution CO</th>
            <td data-before-flow>{before.flow ? flowWords(before.flow) : 'Not acquired'}</td>
            <td data-current-flow>
              {now.flow
                ? flowWords(now.flow)
                : now.earlierFlow
                  ? 'Not acquired under the current conditions'
                  : 'Not acquired'}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}

/**
 * The leg raise's flow response, as the model has it (report P-04).
 *
 * The monitor has no continuous flow channel, so a learner who performed a leg raise saw no flow
 * response unless they acquired a thermodilution series while it lasted. The model's own flow does
 * respond, and this shows it — as a model-only teaching value, labelled so, never recorded in the
 * decision trace, and never called a cardiac output, stroke volume or VTI measurement.
 */
function LegRaiseModelOnly({
  record,
  state,
}: {
  readonly record: CaseActionRecord
  readonly state: HemodynamicSimulationState
}) {
  const atStart = latentPhysiologicalEstimates(record.before).cardiacOutputLMin
  const now = latentPhysiologicalEstimates(state).cardiacOutputLMin
  const elapsed = state.timeSeconds - record.atSeconds
  return (
    <details className="rounded-xl border p-3 text-sm leading-6" data-model-only-flow>
      <summary>Model-only flow during the leg raise — not a measurement</summary>
      <p>
        The simulation’s internal cardiac output, which no channel on this monitor displays:{' '}
        {atStart.toFixed(2)} L/min when the leg raise began, {now.toFixed(2)} L/min now,{' '}
        {elapsed.toFixed(0)} model seconds later.
      </p>
      <p>
        This is the model’s own value, shown for teaching. It is not a cardiac-output, stroke-volume
        or VTI measurement, and it is not recorded in your decision trace. A measured response needs
        a thermodilution series acquired while the leg raise lasts; a series from before it cannot
        show one.
      </p>
    </details>
  )
}

function CaseRunSummary({
  definition,
  state,
  baseline,
  decisionTrace,
  actionRecords,
}: {
  readonly definition: ReturnType<typeof hemodynamicCaseById.get> & object
  readonly state: HemodynamicSimulationState
  readonly baseline: HemodynamicSimulationState | null
  readonly decisionTrace: readonly ScenarioDecisionTraceEntry[]
  readonly actionRecords: readonly CaseActionRecord[]
}) {
  const definitive = definition.interventions.filter((item) => item.category === 'definitive')
  const observed = observedSystemState(state)
  const before = baseline ? observedSystemState(baseline) : null
  const mapChange =
    before === null ? null : observed.arterialMean.displayedMmHg - before.arterialMean.displayedMmHg

  return (
    <section
      className="grid gap-3 rounded-2xl border border-white/15 p-4 text-sm leading-6"
      aria-label="What this run did"
      data-case-run-summary
    >
      <h3 className="text-lg font-bold text-white">What this run did</h3>
      {definitive.length > 0 ? (
        <ul className="grid gap-1" data-definitive-actions>
          {definitive.map((item) => {
            const performed = state.completedInterventionIds.includes(item.id)
            return (
              <li key={item.id} data-definitive-action={item.id} data-performed={performed}>
                <strong>{item.shortLabel}:</strong>{' '}
                {performed
                  ? 'performed in this run.'
                  : 'not performed in this run. It is the definitive step on the authored path below; nothing in this run substitutes for it.'}
              </li>
            )
          })}
        </ul>
      ) : null}
      <p data-signal-validity>
        {observed.zeroed
          ? `The pressure chain was zeroed in this run, with the transducer ${Math.abs(observed.transducerLevelCm).toFixed(0)} cm from the reference at the end.`
          : 'Every invasive pressure in this run was read on a line that was never zeroed. That limits what those pressures establish — a number and a trend in it — and it does not make the patient in front of you unreadable, or mean that time-critical treatment should have waited for the zero.'}
      </p>
      {mapChange !== null ? (
        <p data-pressure-versus-flow>
          {Math.abs(mapChange) < 0.5
            ? 'Displayed MAP has not moved over this run.'
            : `Displayed MAP moved ${mapChange > 0 ? 'up' : 'down'} by ${Math.abs(mapChange).toFixed(0)} mmHg over this run.`}{' '}
          {flowSentence(state)}
        </p>
      ) : null}
      <LegRaiseSummary definition={definition} state={state} actionRecords={actionRecords} />
      <UnfavourableActions definition={definition} state={state} actionRecords={actionRecords} />
      <p className="text-xs opacity-80" data-model-time>
        Model time is compressed: the seconds on the monitor are simulation seconds, and no response
        here is a clinical time course.
      </p>
      <p className="text-xs opacity-80">
        This is a record of what happened in this run on this device. It is not a judgement of
        competence, and the only thing kept is that you opened the case. {decisionTrace.length}{' '}
        decision
        {decisionTrace.length === 1 ? '' : 's'} recorded.
      </p>
    </section>
  )
}

/*
 * HD-PRE-REVIEW-02 sanity repair (blocker 3). This used to compare only the record before the first
 * action with the record at the end. When neither held a *current* series it said no series had
 * been acquired at all — even with an accepted post-fluid series on file, withheld from "now" only
 * because a later action had changed the conditions. It now reads every accepted series the run
 * holds, each with the conditions it was acquired under, and keeps "none under the final
 * conditions" apart from "none ever".
 */
function flowSentence(state: HemodynamicSimulationState): string {
  const series = acceptedFlowSeries(state)
  if (series.length === 0) {
    return 'No accepted thermodilution series was acquired, so this run holds no flow measurement to say whether perfusion moved with it. A higher displayed pressure on its own is not documented improvement, and not documented resolution of a mechanism.'
  }
  const current = series.find((item) => item.current)?.flow ?? null
  const earlier = series.filter((item) => !item.current).map((item) => item.flow)
  if (current === null) {
    const listed =
      earlier.length === 1
        ? `An accepted thermodilution series was acquired ${physiologicalEpisodeWords(earlier[0].episode)}: ${earlier[0].cardiacOutputLMin.toFixed(1)} L/min (CI ${earlier[0].cardiacIndexLMinM2.toFixed(1)}), from ${earlier[0].trialCount} curves.`
        : `Accepted thermodilution series were acquired under ${earlier.length} earlier sets of conditions, each kept separate and never averaged: ${earlier.map(flowWords).join('; ')}.`
    return `${listed} The modeled physiology has changed since — the conditions at the end of the run are those ${physiologicalEpisodeWords(state.physiologicalEpisode)} — and no series was acquired under them, so this run holds no measurement of flow under the final conditions, and none of whether flow changed after ${earlier.length === 1 ? 'that series' : 'the last of those series'} was acquired. ${earlier.length === 1 ? 'It stays a measurement' : 'They stay measurements'} of the earlier conditions. The pressure alone does not establish flow.`
  }
  if (earlier.length === 0) {
    return `The accepted thermodilution series here (${current.trialCount} curves, ${physiologicalEpisodeWords(current.episode)}) has no earlier counterpart in this run to compare it with.`
  }
  const previous = earlier[earlier.length - 1]
  const change =
    (current.cardiacOutputUnroundedLMin - previous.cardiacOutputUnroundedLMin) /
    state.parameters.bodySurfaceAreaM2
  return `Accepted series under ${series.length} different sets of conditions: ${series.map((item) => flowWords(item.flow)).join(', then ')}. From the one acquired ${physiologicalEpisodeWords(previous.episode)} to the one under the final conditions, cardiac index changed by ${change >= 0 ? '+' : '−'}${Math.abs(change).toFixed(2)} L/min/m². They are compared as separate series, never averaged. Read them with the pressure; the pressure alone does not establish flow.`
}

/**
 * What this run measured around a leg raise (report P-04). The authored expert path reads "flow
 * rises during passive leg raise"; this says whether this run acquired anything that could show it.
 */
function LegRaiseSummary({
  definition,
  state,
  actionRecords,
}: {
  readonly definition: ReturnType<typeof hemodynamicCaseById.get> & object
  readonly state: HemodynamicSimulationState
  readonly actionRecords: readonly CaseActionRecord[]
}) {
  const record = actionRecords.find(
    (candidate) => candidate.intervention.id === 'passive-leg-raise',
  )
  const comparison = useMemo(
    () =>
      record
        ? modelOnlyMatchedComparison(
            record.before,
            record.intervention,
            modelOnlyHorizonSeconds(record.intervention),
          )
        : null,
    [record],
  )
  if (!definition.interventions.some((item) => item.id === 'passive-leg-raise')) return null
  if (!record || !comparison) {
    return (
      <p data-leg-raise-summary="not-performed">
        Leg raise: not performed in this run, so there is no leg-raise response to read.
      </p>
    )
  }
  // Which series belongs to the leg raise's own conditions comes from the series' acquisition
  // identity (HD-PRE-REVIEW-02 sanity repair, blocker 3), the same rule the other debrief rows use.
  const around = flowAroundAction(state, {
    interventionId: record.intervention.id,
    atSeconds: record.atSeconds,
    episodeBefore: record.before.physiologicalEpisode.index,
  })
  const noMeasuredResponse =
    'The monitor has no continuous flow channel, so this run holds no measured flow response to the leg raise. The expert path below describes one; this run did not measure it.'
  return (
    <div className="grid gap-2" data-leg-raise-summary="performed">
      <p>
        <strong>Leg raise at {record.atSeconds.toFixed(0)} model seconds.</strong>{' '}
        {around.kind === 'under-its-conditions'
          ? `A thermodilution series was acquired while its modeled effect was building: ${around.after.cardiacOutputLMin.toFixed(1)} L/min from ${around.after.trialCount} curves. That is the measured response in this run.`
          : around.kind === 'no-modeled-change'
            ? 'It changed nothing in the model: every quantity it acts on was already at the limit this simulation allows, so there was no response to measure.'
            : around.kind === 'only-after-a-later-change'
              ? `No series was acquired while its modeled effect was building. The first series after it (${flowWords(around.firstAfter)}) came only after a later change in the modeled physiology, so it is not the leg-raise response. ${noMeasuredResponse}`
              : `No thermodilution series was acquired while it lasted. ${noMeasuredResponse}`}
      </p>
      <ModelOnlyTable comparison={comparison} label="the leg raise" />
    </div>
  )
}

/**
 * Choices the case lists as unfavourable, named against the learner's own run (report P-08).
 *
 * It quotes the case's own authored reason, says what this run displayed and acquired afterwards,
 * and states what the model cannot show. It adds no verdict, no deterioration, and no score; a MAP
 * that rose afterwards is described as exactly that.
 */
function UnfavourableActions({
  definition,
  state,
  actionRecords,
}: {
  readonly definition: ReturnType<typeof hemodynamicCaseById.get> & object
  readonly state: HemodynamicSimulationState
  readonly actionRecords: readonly CaseActionRecord[]
}) {
  // The records are immutable snapshots held in state, so this runs once per recorded action rather
  // than on every tick of the running case.
  const comparisons = useMemo(
    () =>
      actionRecords
        .filter((record) => definition.unsafeInterventionIds.includes(record.intervention.id))
        .map((record) => ({
          record,
          comparison: modelOnlyMatchedComparison(
            record.before,
            record.intervention,
            modelOnlyHorizonSeconds(record.intervention),
          ),
        })),
    [actionRecords, definition],
  )
  if (comparisons.length === 0) return null
  const now = observedSystemState(state)
  return (
    <div className="grid gap-3" data-unfavourable-actions>
      <h4 className="font-bold text-white">Choices this case lists as unfavourable</h4>
      {comparisons.map(({ record, comparison }) => {
        const concern = authoredConcernForUnfavourableAction(definition, record.intervention.id)
        const atAction = observedSystemState(record.before)
        const flowAround = flowAroundAction(state, {
          interventionId: record.intervention.id,
          atSeconds: record.atSeconds,
          episodeBefore: record.before.physiologicalEpisode.index,
        })
        return (
          <div
            key={record.id}
            className="grid gap-2"
            data-unfavourable-action={record.intervention.id}
          >
            <p>
              <strong>
                {record.intervention.label}, at {record.atSeconds.toFixed(0)} model seconds.
              </strong>{' '}
              This case lists it among its unfavourable choices.{' '}
              {concern
                ? `The case’s own reasoning: “${concern}”`
                : 'Its authored reasoning adds nothing further about this choice.'}
            </p>
            <p>
              Afterwards in this run: the monitor’s MAP read {atAction.arterialMean.displayedMmHg}{' '}
              mmHg just before it and {now.arterialMean.displayedMmHg} mmHg now.{' '}
              {flowAfterActionSentence(state, record.intervention, flowAround)} A higher displayed
              MAP afterwards is not by itself benefit, and not by itself a sign the choice was
              sound.
            </p>
            {record.intervention.id === 'fluid-250' ? (
              <p>
                What this model can and cannot show: it moves flow and filling pressures with a
                volume step, but it does not model oxygenation or lung water, so SpO₂ does not
                change with fluid here. An unchanged SpO₂ is not evidence that the fluid was
                harmless.
              </p>
            ) : null}
            <ModelOnlyTable comparison={comparison} label={record.intervention.shortLabel} />
          </div>
        )
      })}
    </div>
  )
}

/**
 * What this run measured of flow after one action, from the series' own acquisition identity
 * (HD-PRE-REVIEW-02 sanity repair, blocker 3). A series from before the action is never offered as
 * its effect, and a series acquired only after a later change is not read as this action's alone.
 */
function flowAfterActionSentence(
  state: HemodynamicSimulationState,
  intervention: HemodynamicInterventionDefinition,
  around: ReturnType<typeof flowAroundAction>,
): string {
  const beforeWords = around.before
    ? ` The series acquired before it (${flowWords(around.before)}) describes the conditions before this choice, not its effect.`
    : ''
  switch (around.kind) {
    case 'no-modeled-change':
      return interventionHasModeledEffect(intervention)
        ? 'It changed nothing in the model: every quantity it acts on was already at the limit this simulation allows, so there was no change in flow for a series to measure.'
        : 'It has no modeled effect on the patient’s physiology, so there was no change in flow for a series to measure.'
    case 'none-after':
      return around.before
        ? `No thermodilution series was acquired after it.${beforeWords} So this run holds no measurement of whether flow changed.`
        : 'No thermodilution series was acquired after it, so this run holds no measurement of whether flow changed.'
    case 'only-after-a-later-change':
      return `No series was acquired under the conditions it created. The first accepted series after it (${flowWords(around.firstAfter)}) came only after a later change in the modeled physiology, so it cannot be read as this choice’s effect alone.${beforeWords}`
    case 'under-its-conditions':
      return `Flow was acquired after it, under the conditions it created: ${flowWords(around.after)}.${
        around.afterIsCurrent
          ? ''
          : ` That series is now historical: the modeled physiology has changed since — the conditions now are those ${physiologicalEpisodeWords(state.physiologicalEpisode)} — and ${
              around.current
                ? `the series under them is ${flowWords(around.current)}`
                : 'no series has been acquired under them, so current flow is not measured'
            }.`
      }`
    default:
      return ''
  }
}

function ModelOnlyTable({
  comparison,
  label,
}: {
  readonly comparison: ReturnType<typeof modelOnlyMatchedComparison>
  readonly label: string
}) {
  const rows: readonly (readonly [
    string,
    (value: typeof comparison.withAction) => number,
    number,
  ])[] = [
    ['Mean arterial pressure (mmHg)', (value) => value.meanArterialMmHg, 0],
    ['Cardiac output (L/min)', (value) => value.cardiacOutputLMin, 2],
    ['Right atrial pressure (mmHg)', (value) => value.rightAtrialMmHg, 1],
    ['Occlusion-pressure estimate (mmHg)', (value) => value.pawpMmHg, 1],
    ['PA diastolic pressure (mmHg)', (value) => value.paDiastolicMmHg, 1],
    ['SpO₂', (value) => value.spo2Percent, 0],
  ]
  return (
    <details className="rounded-xl border border-white/15 p-3" data-model-only-comparison>
      <summary>
        Model-only comparison: {comparison.horizonSeconds} model seconds after {label}, with and
        without it
      </summary>
      <p className="text-xs opacity-80">
        The simulation’s internal physiological values, free of this run’s measurement-system error
        and run from the same starting state to the same model time — not anything the monitor
        displayed or you acquired. They show what this model does, not what a patient would do; its
        response coefficients are not clinically validated, and model seconds are compressed.
      </p>
      <table className="w-full text-left text-xs">
        <thead>
          <tr>
            <th scope="col">Model value</th>
            <th scope="col">At the action</th>
            <th scope="col">Without it</th>
            <th scope="col">With it</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, read, digits]) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              <td>{read(comparison.atAction).toFixed(digits)}</td>
              <td>{read(comparison.withoutAction).toFixed(digits)}</td>
              <td>{read(comparison.withAction).toFixed(digits)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
