import type { RuntimeCrrtCase } from './content/schema'
import type {
  CrrtLearningSessionState,
  CrrtLearningTimelineDetail,
  CrrtLearningTimelineEntry,
} from './engine/learningSession'
import { selectCrrtBloodFlowState } from './engine/circuitDelivery'
import { hasCrrtRunActivity } from './engine/learningSession'
import type { ActiveAlarm, CrrtEngineFaultId } from './engine/types'

/**
 * The actual record of one current session: what the learner did, what the
 * engine applied or refused, what it recorded, and which modeled cause is still
 * active at the end of the run.
 *
 * Nothing here is derived from the authored worked narrative, and nothing is
 * persisted or scored. An event that carried no values is reported as carrying
 * no values; it is never reconstructed from the final prescription.
 */
export interface CrrtActualRunAction {
  readonly sequence: number
  readonly atSeconds: number
  readonly label: string
  readonly reference: string | null
  readonly outcome: 'applied' | 'refused' | 'not-recorded'
  readonly details: readonly CrrtLearningTimelineDetail[]
  /**
   * What to say about values. Null means the event type carries no parameter at
   * all, so there is nothing to claim either way.
   */
  readonly valueNote: string | null
}

export interface CrrtActualObservation {
  readonly label: string
  readonly value: string
}

export interface CrrtSafetyReviewEntry {
  readonly actionId: string
  readonly actionLabel: string
  readonly explanation: string
  readonly criticalErrorLabel: string | null
  readonly criticalErrorExplanation: string | null
  readonly sourceIds: readonly string[]
}

export interface CrrtUnresolvedCause {
  readonly faultId: CrrtEngineFaultId
  readonly label: string
  readonly alarmLabel: string | null
  readonly acknowledged: boolean
}

/**
 * Where this run's simulated minutes came from.
 *
 * The clock moves in exactly two ways: the learner advances it, or a case action
 * the learner performed carries its own authored observation interval
 * (`simulation.advanceTimeSeconds`). Authored timed events fire *during* an
 * advance and add no time of their own. Two paths that reached different clocks
 * are not comparable, and the safe arm of a tolerance case reaches a later clock
 * than the no-action arm precisely because its action carries an interval — so
 * the split has to be visible rather than inferred.
 *
 * `reconciled` is a conservation check on that claim, not a caveat: it is false
 * only if some other mechanism moved the clock.
 */
export interface CrrtRunTimeAccounting {
  readonly totalElapsedSeconds: number
  readonly advancedByLearnerSeconds: number
  readonly advancedByCaseActionsSeconds: number
  readonly reconciled: boolean
  /** Actions performed in this run that carried their own observation interval. */
  readonly intervalActions: readonly CrrtRunIntervalAction[]
}

export interface CrrtRunIntervalAction {
  readonly actionId: string
  readonly label: string
  readonly atSeconds: number
  readonly advanceSeconds: number
}

/**
 * Delivery interruptions, kept separate from elapsed time and from downtime.
 *
 * A pause and a resume recorded at the same simulated timestamp genuinely
 * accumulate no downtime, because no simulated time passed between them. That
 * is the engine's accounting, not an omission: downtime accrues while the clock
 * moves and delivery is not running. Nothing here charges time to a choice.
 */
export interface CrrtDeliveryInterruptionRecord {
  readonly pauseCount: number
  readonly resumeCount: number
  readonly downtimeSeconds: number
  readonly treatmentTimeSeconds: number
  readonly deliveryState: string
  /** True when a pause and resume happened without the clock moving between them. */
  readonly pausedWithoutElapsedTime: boolean
}

/**
 * The two bounded patient indices the engine actually advances, and the explicit
 * statement that blood pressure is not one of them.
 *
 * `engine/patientModel.ts` advances an abstract tolerance-stress index, draws
 * down an intravascular reserve and carries the fluid-overload total. It never
 * writes mean arterial pressure, heart rate or vasopressor support — those stay
 * at the supplied case values for the whole run. Showing the indices is what
 * lets a learner tell a safer path from a harmful one at the same clock; naming
 * the held blood pressure is what stops a static number from reading as
 * tolerance.
 */
export interface CrrtModelIndexObservation {
  readonly label: string
  readonly value: string
  readonly note: string
}

export interface CrrtActualRunReview {
  readonly hasRun: boolean
  /** Describes what the learner did on this page. It never asserts safe or successful care. */
  readonly statusLabel: string
  readonly statusDetail: string
  readonly actions: readonly CrrtActualRunAction[]
  readonly observations: readonly CrrtActualObservation[]
  readonly reassessmentLabels: readonly string[]
  readonly unsafeActionsPerformed: readonly CrrtSafetyReviewEntry[]
  readonly unresolvedCauses: readonly CrrtUnresolvedCause[]
  readonly elapsedSeconds: number
  readonly timeAccounting: CrrtRunTimeAccounting
  readonly interruptions: CrrtDeliveryInterruptionRecord
  readonly modelIndices: readonly CrrtModelIndexObservation[]
  /** Patient signals this exercise holds at their supplied value for the whole run. */
  readonly heldPatientSignals: readonly CrrtActualObservation[]
}

export const CRRT_TIME_ACCOUNTING_CAPTION =
  'Simulated minutes come from the time you advanced plus the observation interval carried by the case actions you performed. Two runs can only be compared at the same elapsed time.' as const

export const CRRT_INTERRUPTION_CAPTION =
  'Pausing and resuming is recorded separately from elapsed time and from downtime. Downtime accrues only while the clock moves and delivery is not running, so a pause and resume at the same timestamp add none.' as const

export const CRRT_MODEL_INDEX_CAPTION =
  'These are bounded model indices, not measurements. They are the signals this exercise actually advances, so they are what separates one path from another at the same elapsed time.' as const

export const CRRT_HELD_PATIENT_SIGNAL_CAPTION =
  'This exercise models no blood-pressure or vasopressor response to treatment. These stay at the value the case supplied for the whole run, so an unchanged number here is not evidence that a change was tolerated.' as const

const timelineEventLabels: Readonly<Record<CrrtLearningTimelineEntry['type'], string>> =
  Object.freeze({
    'prediction-committed': 'Recorded a plan for this case',
    'intervention-performed': 'Case action',
    'device-action': 'Console action',
    'alarm-acknowledged': 'Acknowledged an alert',
    'time-advanced': 'Advanced simulated time',
    'hint-used': 'Opened a hint',
    'reassessment-committed': 'Recorded a reassessment',
    'debrief-revealed': 'Ended the run and opened the debrief',
  })

const deviceActionLabels: Readonly<Record<string, string>> = Object.freeze({
  SELECT_NEW_PATIENT: 'Started a new patient on the console',
  SELECT_CVVHD: 'Selected the CVVHD therapy',
  SET_PRESCRIPTION_VALUE: 'Entered a prescription value',
  COMMIT_PRESCRIPTION: 'Committed the prescription',
  START_PRIME: 'Started priming',
  COMPLETE_PRIME: 'Completed priming',
  COMPLETE_SETUP_STEP: 'Completed a setup step',
  START_TREATMENT: 'Started treatment',
  OPEN_STOP_DIALOG: 'Opened the stop dialog',
  CLOSE_STOP_DIALOG: 'Closed the stop dialog',
  END_TREATMENT: 'Ended treatment',
})

const faultLabels: Readonly<Record<CrrtEngineFaultId, string>> = Object.freeze({
  'access-obstruction': 'Access-line obstruction',
  'access-disconnection': 'Access-line disconnection',
  'return-obstruction': 'Return-line obstruction',
  'return-disconnection': 'Return-line disconnection',
  'filter-fouling': 'Filter fouling',
  'effluent-obstruction': 'Effluent-line obstruction',
  'air-detected': 'Air detected in the circuit',
  'blood-leak-detected': 'Blood leak detected',
  'supply-bag-empty': 'Empty supply bag',
  'effluent-bag-full': 'Full effluent bag',
  'scale-open': 'Open scale',
  'fluid-gain-loss': 'Fluid gain or loss discrepancy',
  'power-interruption': 'Power interruption',
})

/** Event types that can carry a parameter value; the rest never do. */
const valueBearingEventTypes = new Set<CrrtLearningTimelineEntry['type']>([
  'intervention-performed',
  'device-action',
  'time-advanced',
])

export function formatCrrtRunClock(seconds: number): string {
  if (seconds === 0) return '0 min'
  if (seconds % 3_600 === 0) return `${seconds / 3_600} hr`
  if (seconds % 60 === 0) return `${seconds / 60} min`
  return `${seconds} sec`
}

function humanizeAlarmCode(code: string): string {
  return code
    .toLowerCase()
    .split('_')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

function actionLabel(definition: RuntimeCrrtCase, entry: CrrtLearningTimelineEntry): string {
  if (entry.type === 'intervention-performed') {
    const intervention = definition.interventions.find(({ id }) => id === entry.referenceId)
    return intervention?.label ?? timelineEventLabels[entry.type]
  }
  if (entry.type === 'device-action' && entry.referenceId) {
    return deviceActionLabels[entry.referenceId] ?? timelineEventLabels[entry.type]
  }
  if (entry.type === 'time-advanced') {
    const seconds = Number(entry.referenceId)
    return Number.isFinite(seconds)
      ? `Advanced simulated time by ${formatCrrtRunClock(seconds)}`
      : timelineEventLabels[entry.type]
  }
  if (entry.type === 'hint-used') {
    const hint = definition.hintLadder.find(({ id }) => id === entry.referenceId)
    return hint ? `Opened hint ${hint.sequence}` : timelineEventLabels[entry.type]
  }
  if (entry.type === 'alarm-acknowledged') {
    return 'Acknowledged an alert'
  }
  return timelineEventLabels[entry.type]
}

function formatNumber(value: number | null | undefined, digits: number, unit: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not recorded'
  return `${value.toFixed(digits)} ${unit}`
}

/**
 * The observation interval an authored action carries, read from the action's own
 * `simulation.advanceTimeSeconds` effects. This is the interval the engine
 * actually applies. The content model also carries a separate `latencySeconds`
 * field that nothing consumes, so it is deliberately not read here: reporting it
 * would claim an interval the run never takes.
 */
export function crrtActionObservationIntervalSeconds(
  intervention: RuntimeCrrtCase['interventions'][number],
): number {
  return intervention.effects.reduce(
    (total, effect) =>
      effect.target === 'simulation.advanceTimeSeconds' && effect.valueType === 'number'
        ? total + effect.value
        : total,
    0,
  )
}

function selectTimeAccounting(session: CrrtLearningSessionState): CrrtRunTimeAccounting {
  const interventionById = new Map(
    session.caseDefinition.interventions.map((intervention) => [intervention.id, intervention]),
  )
  let advancedByLearnerSeconds = 0
  const intervalActions: CrrtRunIntervalAction[] = []
  for (const entry of session.timeline) {
    if (entry.outcome === 'refused') continue
    if (entry.type === 'time-advanced') {
      const seconds = Number(entry.referenceId)
      if (Number.isFinite(seconds)) advancedByLearnerSeconds += seconds
      continue
    }
    if (entry.type !== 'intervention-performed' || entry.referenceId === null) continue
    const intervention = interventionById.get(entry.referenceId)
    if (!intervention) continue
    const advanceSeconds = crrtActionObservationIntervalSeconds(intervention)
    if (advanceSeconds > 0) {
      intervalActions.push({
        actionId: intervention.id,
        label: intervention.label,
        atSeconds: entry.atSeconds,
        advanceSeconds,
      })
    }
  }
  const advancedByCaseActionsSeconds = intervalActions.reduce(
    (total, action) => total + action.advanceSeconds,
    0,
  )
  const totalElapsedSeconds = session.simulation.simulationTimeSeconds
  return Object.freeze({
    totalElapsedSeconds,
    advancedByLearnerSeconds,
    advancedByCaseActionsSeconds,
    reconciled:
      Math.abs(totalElapsedSeconds - (advancedByLearnerSeconds + advancedByCaseActionsSeconds)) <
      1e-6,
    intervalActions: Object.freeze(intervalActions),
  })
}

const pausingDeliveryStates = new Set(['paused', 'ended', 'idle'])

/**
 * Counts delivery-state changes the learner actually caused in this run, from the
 * authored effects of the actions they performed and their own console actions.
 * It does not read the engine's final state back as a history.
 */
function selectInterruptions(session: CrrtLearningSessionState): CrrtDeliveryInterruptionRecord {
  const interventionById = new Map(
    session.caseDefinition.interventions.map((intervention) => [intervention.id, intervention]),
  )
  let pauseCount = 0
  let resumeCount = 0
  let pausedWithoutElapsedTime = false
  let pausedAtSeconds: number | null = null
  for (const entry of session.timeline) {
    if (entry.outcome === 'refused') continue
    let target: string | null = null
    if (entry.type === 'intervention-performed' && entry.referenceId !== null) {
      const intervention = interventionById.get(entry.referenceId)
      const deliveryEffect = intervention?.effects.find(
        (effect) => effect.target === 'device.deliveryState' && effect.valueType === 'enum',
      )
      target = deliveryEffect && deliveryEffect.valueType === 'enum' ? deliveryEffect.value : null
    } else if (entry.type === 'device-action' && entry.referenceId === 'END_TREATMENT') {
      target = 'ended'
    } else if (entry.type === 'device-action' && entry.referenceId === 'START_TREATMENT') {
      target = 'running'
    }
    if (target === null) continue
    if (pausingDeliveryStates.has(target)) {
      pauseCount += 1
      pausedAtSeconds = entry.atSeconds
      continue
    }
    if (target === 'running') {
      if (pausedAtSeconds !== null) {
        resumeCount += 1
        if (pausedAtSeconds === entry.atSeconds) pausedWithoutElapsedTime = true
        pausedAtSeconds = null
      }
    }
  }
  return Object.freeze({
    pauseCount,
    resumeCount,
    downtimeSeconds: session.simulation.deliveredTherapy.cumulativeDowntimeSeconds,
    treatmentTimeSeconds: session.simulation.deliveredTherapy.treatmentTimeSeconds,
    deliveryState: session.simulation.device.deliveryState,
    pausedWithoutElapsedTime,
  })
}

function selectModelIndices(
  session: CrrtLearningSessionState,
): readonly CrrtModelIndexObservation[] {
  const patient = session.simulation.patient
  if (patient.status !== 'configured') return []
  return Object.freeze([
    {
      label: 'Tolerance-stress index',
      value: patient.hemodynamicStressIndex.toFixed(2),
      note: 'A bounded 0-1 model index. It rises while machine removal outruns the supplied refill capacity and the reserve is exhausted, and recovers only while removal no longer outruns it. It is not a blood pressure, a lactate, or a shock score.',
    },
    {
      label: 'Intravascular reserve remaining',
      value: `${Math.round(patient.intravascularReserveMl)} mL of ${Math.round(patient.initialIntravascularReserveMl)} mL supplied`,
      note: 'A bounded model buffer that is drawn down and never refilled during a run. A path that still has reserve did not spend it, rather than having recovered it.',
    },
    {
      label: 'Total fluid overload carried',
      value: `${Math.round(patient.totalFluidOverloadMl)} mL`,
      note: "The supplied starting overload plus this run's whole-patient balance. It is an accounting total, not an assessed volume status.",
    },
  ])
}

function selectHeldPatientSignals(
  session: CrrtLearningSessionState,
): readonly CrrtActualObservation[] {
  const patient = session.simulation.patient
  if (patient.status !== 'configured') return []
  return Object.freeze([
    {
      label: 'Mean arterial pressure (supplied, held)',
      value: `${Math.round(patient.meanArterialPressureMmHg)} mmHg`,
    },
    {
      label: 'Heart rate (supplied, held)',
      value: `${Math.round(patient.heartRatePerMinute)} /min`,
    },
    {
      label: 'Vasopressor support index (supplied, held)',
      value: patient.vasopressorSupportIndex.toFixed(2),
    },
  ])
}

export function selectCrrtActualRunReview(session: CrrtLearningSessionState): CrrtActualRunReview {
  const definition = session.caseDefinition
  const simulation = session.simulation
  const hasRun = hasCrrtRunActivity(session)
  const bloodFlow = selectCrrtBloodFlowState(simulation)

  const actions = session.timeline.map((entry) => {
    const details = entry.details ?? []
    return {
      sequence: entry.sequence,
      atSeconds: entry.atSeconds,
      label: actionLabel(definition, entry),
      reference: entry.referenceId,
      outcome: entry.outcome ?? ('not-recorded' as const),
      details,
      valueNote:
        details.length > 0
          ? details.map((detail) => `${detail.label}: ${detail.value}`).join(' · ')
          : valueBearingEventTypes.has(entry.type)
            ? // The event could have carried a value and did not. Say so rather
              // than reconstructing one from the final prescription.
              'Values were not recorded with this event.'
            : null,
    }
  })

  const performed = new Set(
    session.timeline
      .filter((entry) => entry.type === 'intervention-performed' && entry.outcome !== 'refused')
      .map((entry) => entry.referenceId),
  )
  const criticalErrorById = new Map(definition.criticalErrors.map((error) => [error.id, error]))
  const unsafeActionsPerformed = definition.unsafeActions
    .filter((unsafeAction) => performed.has(unsafeAction.actionId))
    .map((unsafeAction) => {
      const criticalError = unsafeAction.criticalErrorId
        ? (criticalErrorById.get(unsafeAction.criticalErrorId) ?? null)
        : null
      return {
        actionId: unsafeAction.actionId,
        actionLabel:
          definition.interventions.find(({ id }) => id === unsafeAction.actionId)?.label ??
          unsafeAction.actionId,
        explanation: unsafeAction.explanation,
        criticalErrorLabel: criticalError?.label ?? null,
        criticalErrorExplanation: criticalError?.explanation ?? null,
        sourceIds: [...unsafeAction.sourceIds],
      }
    })

  const alarmByCause = new Map<CrrtEngineFaultId, ActiveAlarm>()
  for (const alarm of simulation.alarms) {
    if (alarm.active) alarmByCause.set(alarm.cause, alarm)
  }
  const unresolvedCauses = simulation.scenario.activeFaults.map((faultId) => {
    const alarm = alarmByCause.get(faultId)
    return {
      faultId,
      label: faultLabels[faultId],
      alarmLabel: alarm ? humanizeAlarmCode(alarm.code) : null,
      acknowledged: alarm?.acknowledgedAtSeconds !== undefined,
    }
  })

  const observations: CrrtActualObservation[] = [
    {
      label: 'Simulated time elapsed in this run',
      value: formatCrrtRunClock(simulation.simulationTimeSeconds),
    },
    {
      label: 'Prescribed effluent dose',
      value: formatNumber(simulation.deliveredTherapy.prescribedEffluentDoseMlKgHour, 1, 'mL/kg/h'),
    },
    {
      label: 'Delivered dose',
      value: formatNumber(simulation.deliveredTherapy.deliveredDoseMlKgHour, 1, 'mL/kg/h'),
    },
    {
      label: 'Whole-patient fluid balance',
      value: formatNumber(simulation.deliveredTherapy.cumulativeWholePatientBalanceMl, 0, 'mL'),
    },
    {
      label: 'Treatment downtime recorded',
      value: formatCrrtRunClock(simulation.deliveredTherapy.cumulativeDowntimeSeconds),
    },
    {
      label: 'Blood flow set',
      value: bloodFlow.setMlMin === null ? 'Not set' : `${Math.round(bloodFlow.setMlMin)} mL/min`,
    },
    {
      label: 'Blood flow through the circuit at the end of this run',
      value:
        bloodFlow.actualMlMin === null ? 'Not set' : `${Math.round(bloodFlow.actualMlMin)} mL/min`,
    },
    {
      label: 'Access pressure now',
      value: formatNumber(simulation.circuit.pressures.accessPressureMmHg, 0, 'mmHg'),
    },
  ]

  const reassessmentLabels = session.reassessment.committed
    ? session.reassessment.optionIds.map(
        (id) => definition.reassessmentOptions.find((option) => option.id === id)?.label ?? id,
      )
    : []

  const appliedActionCount = actions.filter(
    (action) =>
      action.outcome === 'applied' &&
      (action.reference !== null || action.label.startsWith('Advanced')),
  ).length

  return {
    hasRun,
    statusLabel: hasRun
      ? `Debrief opened · ${appliedActionCount} recorded ${appliedActionCount === 1 ? 'event' : 'events'} in this run`
      : 'Debrief opened · no run performed',
    statusDetail: hasRun
      ? 'This lists what this session recorded. It is not a judgement that the care was safe, complete, or successful.'
      : 'You have not performed a case action or advanced simulated time, so there is nothing from this run to review. The explanation below is the authored example.',
    actions,
    observations,
    reassessmentLabels,
    unsafeActionsPerformed,
    unresolvedCauses,
    elapsedSeconds: simulation.simulationTimeSeconds,
    timeAccounting: selectTimeAccounting(session),
    interruptions: selectInterruptions(session),
    modelIndices: selectModelIndices(session),
    heldPatientSignals: selectHeldPatientSignals(session),
  }
}
