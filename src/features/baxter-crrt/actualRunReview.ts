import type { RuntimeCrrtCase } from './content/schema'
import type {
  CrrtLearningSessionState,
  CrrtLearningTimelineDetail,
  CrrtLearningTimelineEntry,
} from './engine/learningSession'
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
}

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

export function selectCrrtActualRunReview(session: CrrtLearningSessionState): CrrtActualRunReview {
  const definition = session.caseDefinition
  const simulation = session.simulation
  const hasRun = hasCrrtRunActivity(session)

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
  }
}
