import type { CrrtFoundationTask } from './content/foundationLessons'
import { baxterCrrtLearnerCases } from './content/learnerRegistry'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningSessionState,
  type CrrtLearningSessionAction,
} from './engine/learningSession'
import {
  selectPrismaxPilotCaseOperationsDisplay,
  selectPrismaxPilotOperationsDisplay,
  type PrismaxPilotInterfaceAction,
} from './engine/deviceAdapters/prismax'
import { calculateWholePatientNetBalanceMl } from './engine/fluidModel'

export type CrrtLearnRunId = NonNullable<CrrtFoundationTask['run']>
export type CrrtLearnOperation = NonNullable<CrrtFoundationTask['operation']>
export interface CrrtOperationalRun {
  readonly id: CrrtLearnRunId
  readonly session: CrrtLearningSessionState
  /** Immutable engine sessions at real events; these never drive a second simulation. */
  readonly snapshots: readonly CrrtLearningSessionState[]
}
export const crrtLearnRunLabels: Record<CrrtLearnRunId, string> = {
  workflow: 'CVVHD setup reference · CRRT-04',
  delivery: 'Delivery and fluid record · CRRT-04',
  access: 'Access interruption case · CRRT-13',
  fluid: 'Net-removal case · CRRT-10',
}
/** CRRT-04's immutable idle fixture has structural zero flows. A blank setup draft
 * must use the native setup projection until a reviewed prescription is applied. */
export function selectCrrtOperationalDisplay(run: CrrtOperationalRun) {
  return run.id === 'workflow' && !run.session.interfaceState.committedPrescription
    ? selectPrismaxPilotOperationsDisplay(run.session.interfaceState)
    : selectPrismaxPilotCaseOperationsDisplay(run.session.interfaceState, run.session.simulation)
}
export const crrtReferenceSetupActions: readonly PrismaxPilotInterfaceAction[] = [
  { type: 'SELECT_NEW_PATIENT' },
  { type: 'COMPLETE_SETUP_STEP', stepId: 'patient' },
  { type: 'SELECT_CVVHD' },
  { type: 'COMPLETE_SETUP_STEP', stepId: 'therapy' },
  { type: 'SET_PRESCRIPTION_VALUE', field: 'bloodFlowMlMin', value: 120 },
  { type: 'SET_PRESCRIPTION_VALUE', field: 'dialysateFlowMlHour', value: 1800 },
  { type: 'SET_PRESCRIPTION_VALUE', field: 'patientFluidRemovalMlHour', value: 100 },
  { type: 'COMMIT_PRESCRIPTION' },
  { type: 'COMPLETE_SETUP_STEP', stepId: 'prescription' },
  { type: 'COMPLETE_SETUP_STEP', stepId: 'sets' },
  { type: 'COMPLETE_SETUP_STEP', stepId: 'fluids' },
  { type: 'START_PRIME' },
  { type: 'COMPLETE_PRIME' },
  { type: 'COMPLETE_SETUP_STEP', stepId: 'prime' },
  { type: 'COMPLETE_SETUP_STEP', stepId: 'review' },
  { type: 'COMPLETE_SETUP_STEP', stepId: 'connect-patient' },
  { type: 'START_TREATMENT' },
]
export function createCrrtOperationalRun(id: CrrtLearnRunId): CrrtOperationalRun {
  const caseId = id === 'access' ? 'CRRT-13' : id === 'fluid' ? 'CRRT-10' : 'CRRT-04'
  let session = createCrrtLearningSession({
    caseDefinition: baxterCrrtLearnerCases.find((c) => c.id === caseId)!,
    experience: 'practice',
    roleLens: 'integrated',
    attempt: 1,
  })
  if (id === 'delivery') {
    for (const action of crrtReferenceSetupActions)
      session = crrtLearningSessionReducer(session, { type: 'DEVICE_ACTION', action })
  }
  return { id, session, snapshots: [session] }
}

/** Stop at the next authored event even if a caller requests a longer observation. */
export function crrtBoundedObservationSeconds(
  session: CrrtLearningSessionState,
  requested: number,
): number {
  if (!Number.isFinite(requested) || requested <= 0) return 0
  const now = session.simulation.simulationTimeSeconds
  const next = session.simulation.scenario.eventQueue
    .filter((event) => event.scheduledAtSeconds > now)
    .reduce((at, event) => Math.min(at, event.scheduledAtSeconds), Infinity)
  return Math.min(requested, next - now)
}
interface OperationalCommand {
  readonly id: string
  readonly label: string
  readonly explanation: string
  readonly action: CrrtLearningSessionAction
}
/** The UI and reducer share this next-action predicate. No arbitrary case/device actions enter Learn. */
export function nextCrrtOperationalCommand(
  run: CrrtOperationalRun,
  operation?: CrrtLearnOperation,
): OperationalCommand | null {
  const s = run.session
  const now = s.simulation.simulationTimeSeconds
  const done = (id: string) => s.performedInterventionIds.includes(id)
  const perform = (id: string, label: string, explanation: string): OperationalCommand => ({
    id,
    label,
    explanation,
    action: { type: 'PERFORM_INTERVENTION', interventionId: id },
  })
  const observe = (until: number, label: string, explanation: string): OperationalCommand => ({
    id: `observe-${until}`,
    label,
    explanation,
    action: { type: 'ADVANCE_TIME', seconds: crrtBoundedObservationSeconds(s, until - now) },
  })
  if (run.id === 'workflow' && operation === 'normal' && now < 900)
    return observe(
      900,
      'Record 15 minutes',
      'The clock advances only when you request this observation.',
    )
  if (run.id === 'delivery' && operation === 'delivery-timeline' && now < 14400) {
    const until = Math.min(14400, (Math.floor(now / 3600) + 1) * 3600)
    return observe(
      until,
      `Record to ${until / 3600} hours`,
      'Stop at each hourly observation and any earlier scheduled event. The 2-hour pause and 3-hour resumption are authored case events.',
    )
  }
  if (run.id === 'access') {
    if (operation === 'alarm-arrival') {
      if (!done('crrt13-assess-patient-device'))
        return perform(
          'crrt13-assess-patient-device',
          'Review patient and device assessment',
          'Record the case assessment before advancing to the alert.',
        )
      if (!done('crrt13-advance-to-pattern'))
        return perform(
          'crrt13-advance-to-pattern',
          'Advance to the 30-minute event',
          'This existing case action ends exactly at the access event, with no jump beyond the first alert.',
        )
    }
    if (operation === 'alarm-repair') {
      const alarm = s.simulation.alarms.find(
        (a) => a.cause === 'access-obstruction' && a.acknowledgedAtSeconds === undefined,
      )
      if (alarm)
        return {
          id: 'acknowledge-access',
          label: 'Acknowledge the access alert',
          explanation:
            'Acknowledgement records that the alert was seen. It does not change the cause, pump state or delivered volume.',
          action: { type: 'ACKNOWLEDGE_ALARM', alarmId: alarm.id },
        }
      if (!done('crrt13-inspect-access-path'))
        return perform(
          'crrt13-inspect-access-path',
          'Inspect the modeled access path',
          'Use the authored inspection before selecting a mechanical correction.',
        )
      if (!done('crrt13-pause-treatment'))
        return perform(
          'crrt13-pause-treatment',
          'Pause this case',
          'This deliberate case action stops both modeled pumps. It is not an automatic device alarm response.',
        )
      if (now < 2400)
        return observe(
          2400,
          'Record 10 minutes paused',
          'Read what stops and what continues in the delivery and patient-fluid record.',
        )
      if (!done('crrt13-reposition-access'))
        return perform(
          'crrt13-reposition-access',
          'Apply the case access-position correction',
          'The existing case action reduces access resistance and clears its modeled fault. Treatment stays paused until the permitted resume action.',
        )
    }
    if (operation === 'alarm-verify') {
      if (!done('crrt13-resume-treatment'))
        return perform(
          'crrt13-resume-treatment',
          'Resume this corrected case',
          'The original case requires a pause and access correction before this action. It does not authorize clinical resumption in other situations.',
        )
      if (now < 3000)
        return observe(
          3000,
          'Record 10 minutes after resumption',
          'Compare actual new delivery and pressure at restored blood flow, retaining the earlier downtime.',
        )
      if (!done('crrt13-confirm-restored-delivery'))
        return perform(
          'crrt13-confirm-restored-delivery',
          'Review restored delivery in this case',
          'Record your review of the displayed pressure, pump state and accumulated delivery. Bedside patient reassessment is still required in clinical care.',
        )
    }
  }
  if (run.id === 'fluid') {
    if (operation === 'net-change') {
      if (!done('crrt10-assess-tolerance'))
        return perform(
          'crrt10-assess-tolerance',
          'Review patient tolerance',
          'Review the case context before choosing a net-removal change.',
        )
      if (!done('crrt10-review-fluid-ledger'))
        return perform(
          'crrt10-review-fluid-ledger',
          'Review external intake and output',
          'Include all patient fluid rates; the machine setting alone is not the balance.',
        )
      if (!done('crrt10-cautious-pfr-adjustment'))
        return perform(
          'crrt10-cautious-pfr-adjustment',
          'Apply the case net-removal adjustment',
          'This applies the existing 350 mL/h case choice. Blood flow and dialysate remain fixed. No time advances with this action.',
        )
    }
    if (operation === 'net-observe' && now < 1800)
      return observe(
        1800,
        'Record 30 minutes',
        'Observe this bounded interval before the next authored external-fluid change at 1 hour.',
      )
  }
  return null
}

export function crrtOperationalTaskComplete(
  run: CrrtOperationalRun | undefined,
  operation?: CrrtLearnOperation,
): boolean {
  if (!operation || operation === 'hardware' || operation === 'missing-chart') return true
  if (!run) return false
  const s = run.session
  const now = s.simulation.simulationTimeSeconds
  const done = (id: string) => s.performedInterventionIds.includes(id)
  switch (operation) {
    case 'setup':
      return (
        run.id === 'workflow' &&
        s.simulation.device.deliveryState === 'running' &&
        s.interfaceState.primeState === 'complete'
      )
    case 'normal':
      return run.id === 'workflow' && now >= 900
    case 'alarm-arrival':
      return run.id === 'access' && done('crrt13-advance-to-pattern')
    case 'alarm-repair':
      return (
        run.id === 'access' &&
        now >= 2400 &&
        done('crrt13-reposition-access') &&
        s.simulation.device.deliveryState === 'paused' &&
        s.simulation.alarmHistory.some(
          (a) => a.cause === 'access-obstruction' && a.acknowledgedAtSeconds !== undefined,
        )
      )
    case 'alarm-verify':
      return (
        run.id === 'access' &&
        now >= 3000 &&
        done('crrt13-confirm-restored-delivery') &&
        s.simulation.device.deliveryState === 'running'
      )
    case 'delivery-timeline':
    case 'balance':
      return run.id === 'delivery' && now >= 14400
    case 'net-change':
      return run.id === 'fluid' && done('crrt10-cautious-pfr-adjustment')
    case 'net-observe':
      return run.id === 'fluid' && now >= 1800
  }
}
export type CrrtOperationalAction =
  | { type: 'command'; id: string }
  | { type: 'device'; action: PrismaxPilotInterfaceAction }
export function crrtOperationalRunReducer(
  run: CrrtOperationalRun,
  operation: CrrtLearnOperation | undefined,
  action: CrrtOperationalAction,
): CrrtOperationalRun {
  let next: CrrtLearningSessionAction
  if (action.type === 'device') {
    if (
      run.id !== 'workflow' ||
      operation !== 'setup' ||
      run.session.simulation.device.deliveryState === 'running' ||
      !crrtReferenceSetupActions.some((allowed) => allowed.type === action.action.type)
    )
      return run
    next = { type: 'DEVICE_ACTION', action: action.action }
  } else {
    const command = nextCrrtOperationalCommand(run, operation)
    if (!command || command.id !== action.id) return run
    next = command.action
  }
  const session = crrtLearningSessionReducer(run.session, next)
  return session === run.session ? run : { ...run, session, snapshots: [...run.snapshots, session] }
}

export function crrtRecordedFluidChart(session: CrrtLearningSessionState, missingUrine = false) {
  const display = selectPrismaxPilotCaseOperationsDisplay(
    session.interfaceState,
    session.simulation,
  )
  const ledger = session.simulation.deliveredTherapy.fluidLedger
  const externalInputMl =
    ledger.maintenanceInputMl +
    ledger.medicationCarrierInputMl +
    ledger.nutritionInputMl +
    ledger.bloodProductInputMl +
    ledger.bolusInputMl +
    ledger.otherInputMl
  const urineMl = missingUrine ? null : ledger.urineOutputMl
  const otherOutputMl = ledger.drainOutputMl + ledger.otherOutputMl
  const removalMl = display.cumulativeFluid.cumulativeMachinePatientFluidRemovalMl
  const balanceMl =
    urineMl === null || display.cumulativeFluid.resolution !== 'available'
      ? null
      : calculateWholePatientNetBalanceMl(ledger)
  return {
    externalInputMl,
    urineMl,
    otherOutputMl,
    removalMl,
    additionalDeviceGainMl: ledger.unintendedDeviceNetGainMl,
    balanceMl,
    withheldReason: missingUrine
      ? 'Urine output is missing from this chart copy.'
      : display.cumulativeFluid.withheldReason,
  }
}
export function crrtRecordedDeliveryIntervals(run: CrrtOperationalRun) {
  let previous = run.snapshots[0]
  return run.snapshots.flatMap((current) => {
    if (current.simulation.simulationTimeSeconds <= previous.simulation.simulationTimeSeconds) {
      previous = current
      return []
    }
    const before = previous
    previous = current
    const from = before.simulation.deliveredTherapy
    const to = current.simulation.deliveredTherapy
    const a = crrtRecordedFluidChart(before)
    const b = crrtRecordedFluidChart(current)
    return [
      {
        startSeconds: before.simulation.simulationTimeSeconds,
        endSeconds: current.simulation.simulationTimeSeconds,
        effluentMl: to.cumulativeActualEffluentMl - from.cumulativeActualEffluentMl,
        removalMl: a.removalMl === null || b.removalMl === null ? null : b.removalMl - a.removalMl,
        downtimeSeconds: to.cumulativeDowntimeSeconds - from.cumulativeDowntimeSeconds,
        externalInputMl: b.externalInputMl - a.externalInputMl,
        externalOutputMl:
          a.urineMl === null || b.urineMl === null
            ? null
            : b.urineMl + b.otherOutputMl - a.urineMl - a.otherOutputMl,
        endState: current.simulation.device.deliveryState,
      },
    ]
  })
}
export function crrtOperationalEvidenceInputs(
  run: CrrtOperationalRun,
): Readonly<Record<string, number>> {
  const s = run.session.simulation
  const f = s.circuit.flows
  const chart = crrtRecordedFluidChart(run.session)
  return {
    eventSequence: run.session.timeline.length,
    simulationSeconds: s.simulationTimeSeconds,
    chartingWindowSeconds: s.deliveredTherapy.chartingWindowSeconds,
    downtimeSeconds: s.deliveredTherapy.cumulativeDowntimeSeconds,
    actualEffluentMl: s.deliveredTherapy.cumulativeActualEffluentMl,
    ...(f
      ? {
          bloodFlowMlMin: f.bloodFlowMlMin,
          dialysateMlHour: f.dialysateFlowMlHour,
          removalMlHour: f.patientFluidRemovalMlHour,
        }
      : {}),
    ...(chart.balanceMl !== null ? { balanceMl: chart.balanceMl } : {}),
  }
}
export function crrtValidBalanceResponse(raw: string): number | null {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim())) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}
