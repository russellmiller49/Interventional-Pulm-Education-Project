import { cardiohelpScenarioById, cardiohelpScenarios } from '../content/scenarios'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import { resolveScenarioReassessment } from '../content/practiceSupport'
import {
  airIsCorrectedAndClear,
  patientIsolated,
  resolveBubbleResumption,
} from './bubbleResumption'
import {
  applyClinicalIntervention,
  attemptClinicalEcmoStart,
  markClinicalImproving,
} from './clinicalResponse'
import {
  clamp,
  createInitialSimulationState,
  deriveSimulation,
  genericPatientTargets,
  hasFault,
  injectFault,
  MAX_HISTORY_ENTRIES,
  resolveDrainageLimitation,
} from './simulation'
import type {
  EcmoObservation,
  EcmoSimulationState,
  FaultId,
  RateLimitedPatientField,
  ScenarioCredit,
  ScenarioDefinition,
  SimulationAction,
  PatientState,
} from './types'

const actionLabels: Partial<Record<SimulationAction['type'], string>> = {
  SET_RPM: 'Changed RPM setpoint',
  SET_FLOW_TARGET: 'Changed LPM setpoint',
  SET_SWEEP: 'Changed external sweep flow',
  SET_GAS_FIO2: 'Changed sweep-gas FiO2',
  RESTORE_GAS_SOURCE: 'Restored gas source',
  RESTORE_AC_POWER: 'Restored AC power',
  TOGGLE_ZERO_FLOW: 'Changed zero-flow state',
  TOGGLE_GLOBAL_OVERRIDE: 'Changed Global Override state',
  ACK_ALARM: 'Acknowledged alarm',
  RESET_BUBBLE: 'Attempted bubble reset',
  TOGGLE_CIRCUIT_CLAMP: 'Changed circuit clamp state',
  CORRECT_FAULT: 'Corrected scenario cause',
  PERFORM_CHECK: 'Performed circuit/device check',
  ROTARY_DELTA: 'Turned rotary control',
  SET_PUMP_MODE: 'Changed pump mode',
  SET_SCREEN: 'Changed touchscreen screen',
  PRESS_SAFETY: 'Pressed safety control',
  RELEASE_SAFETY: 'Released safety control',
  ADJUST_LIMIT: 'Adjusted parameter alarm limit',
  APPLY_CLINICAL_INTERVENTION: 'Applied clinical intervention',
  START_ECMO: 'Attempted ECMO initiation',
  REQUEST_HINT: 'Requested a scored clue',
  TOGGLE_TIMER: 'Changed timer state',
  RESET_TIMER: 'Reset timer',
}

function getDefinition(state: EcmoSimulationState): ScenarioDefinition {
  return (
    clinicalPracticeScenarioById.get(state.scenario.scenarioId) ??
    cardiohelpScenarioById.get(state.scenario.scenarioId) ??
    cardiohelpScenarios[0]
  )
}

function appendHistory(
  state: EcmoSimulationState,
  kind: 'action' | 'alarm' | 'fault' | 'system',
  label: string,
): EcmoSimulationState {
  return {
    ...state,
    history: [
      ...state.history,
      {
        id: `${kind}-${state.simulationTime}-${state.history.length}`,
        time: state.simulationTime,
        kind,
        label,
      },
    ].slice(-MAX_HISTORY_ENTRIES),
  }
}

function completedObjectiveIds(credit: ScenarioCredit): string[] {
  return Object.entries(credit)
    .filter(([, complete]) => complete)
    .map(([id]) => id)
}

function updateCredit(
  state: EcmoSimulationState,
  changes: Partial<ScenarioCredit>,
): EcmoSimulationState {
  const credit = { ...state.scenario.credit, ...changes }
  return {
    ...state,
    scenario: {
      ...state.scenario,
      credit,
      completedObjectiveIds: completedObjectiveIds(credit),
    },
  }
}

function addCriticalError(
  state: EcmoSimulationState,
  id: string,
  fallbackPoints: number,
): EcmoSimulationState {
  if (state.scenario.criticalErrors.includes(id)) return state
  const definition = getDefinition(state)
  const penalty = definition.unsafeActionPenalties.find((item) => item.id === id)
  return {
    ...state,
    scenario: {
      ...state.scenario,
      criticalErrors: [...state.scenario.criticalErrors, id],
      penalties: state.scenario.penalties + (penalty?.points ?? fallbackPoints),
    },
  }
}

function addPenalty(
  state: EcmoSimulationState,
  id: string,
  points: number,
  critical: boolean,
): EcmoSimulationState {
  if (critical) return addCriticalError(state, id, points)
  return {
    ...state,
    scenario: {
      ...state.scenario,
      penalties: state.scenario.penalties + points,
    },
  }
}

function applyClinicalInterventionAndResolve(
  state: EcmoSimulationState,
  definition: ScenarioDefinition,
  interventionId: string,
) {
  const result = applyClinicalIntervention(state, definition, interventionId)
  let next = result.state
  if (result.penalty) {
    next = addPenalty(next, result.penalty.id, result.penalty.points, result.penalty.critical)
  }
  if (result.resolutionReady) {
    next = next.scenario.activeFaults.includes(definition.expectation.correctiveFault)
      ? correctFault(next, definition.expectation.correctiveFault)
      : markClinicalImproving(next, definition)
    // Action time: the circuit is recomputed, the patient waits for the clock (B6-012).
    next = deriveSimulation(next, { advancePatient: false })
    next = recordExecution(next, { controlMatched: true, directionMatched: true })
  }
  return { state: next, result }
}

const clampSimulatorControls = {
  'clamp-drainage': { limb: 'drainage', closed: true },
  'clamp-return': { limb: 'return', closed: true },
  'unclamp-drainage': { limb: 'drainage', closed: false },
  'unclamp-return': { limb: 'return', closed: false },
} as const

type ClampSimulatorControl = keyof typeof clampSimulatorControls

function simulatorTargetMatches(
  value: number,
  targetValue: number,
  comparison: 'within' | 'at-least' | 'at-most',
  tolerance: number,
) {
  if (comparison === 'at-least') return value >= targetValue - tolerance
  if (comparison === 'at-most') return value <= targetValue + tolerance
  return Math.abs(value - targetValue) <= tolerance
}

function findMatchingSimulatorIntervention(
  state: EcmoSimulationState,
  definition: ScenarioDefinition,
  action: SimulationAction,
) {
  const clinicalCase = definition.clinicalCase
  const clinical = state.scenario.clinical
  if (!clinicalCase || !clinical) return null
  const appliedIds = new Set(clinical.appliedInterventions.map((record) => record.interventionId))

  return (
    clinicalCase.interventions.find((intervention) => {
      const requirement = intervention.simulatorAction
      if (!requirement || appliedIds.has(intervention.id)) return false
      if (requirement.control === 'restore-gas') return action.type === 'RESTORE_GAS_SOURCE'
      if (requirement.control === 'restore-power') return action.type === 'RESTORE_AC_POWER'
      if (requirement.control === 'resume-after-bubble') {
        return action.type === 'RESUME_SUPPORT_AFTER_BUBBLE'
      }
      if (requirement.control in clampSimulatorControls) {
        if (action.type !== 'TOGGLE_CIRCUIT_CLAMP') return false
        const spec = clampSimulatorControls[requirement.control as ClampSimulatorControl]
        const currentlyClosed =
          action.limb === 'drainage'
            ? state.circuit.drainageClampClosed
            : state.circuit.returnClampClosed
        const intendedClosed = action.closed ?? !currentlyClosed
        return action.limb === spec.limb && intendedClosed === spec.closed
      }

      const actionValue =
        requirement.control === 'rpm' && action.type === 'SET_RPM'
          ? action.rpm
          : requirement.control === 'sweep' && action.type === 'SET_SWEEP'
            ? action.sweep
            : requirement.control === 'gas-fio2' && action.type === 'SET_GAS_FIO2'
              ? action.fio2
              : null
      if (actionValue === null || requirement.targetValue === undefined) return false
      return simulatorTargetMatches(
        actionValue,
        requirement.targetValue,
        requirement.comparison ?? 'within',
        requirement.tolerance ?? 0,
      )
    }) ?? null
  )
}

/**
 * Faults whose authored "correction" is recognition and escalation, not treatment (B6-006).
 *
 * Reviewing the right arm against the groin, or recognising a loading left ventricle, earns the
 * case's cause credit and opens the reassessment — but it changes nothing about the patient. The
 * fault therefore stays active in the model: the right-radial saturation, its alarm, the pulse
 * pressure and the valve keep doing what the physiology does until a treatment this module does not
 * simulate is given. Naming a problem is not the same as fixing it, and the display must not say
 * otherwise.
 */
export const RECOGNITION_ONLY_FAULTS: readonly FaultId[] = ['differential-hypoxemia', 'lv-loading']

/** On reserve power with the mains loss still standing: the moment the transport lesson is about. */
function reducesSupportOnBattery(state: EcmoSimulationState): boolean {
  return state.device.powerSource === 'battery' && hasFault(state, 'ac-power-loss')
}

function markFaultCorrected(state: EcmoSimulationState, fault: FaultId): EcmoSimulationState {
  const correctedFaults = state.scenario.correctedFaults.includes(fault)
    ? state.scenario.correctedFaults
    : [...state.scenario.correctedFaults, fault]
  const preserveLatch = fault === 'arterial-bubble' || RECOGNITION_ONLY_FAULTS.includes(fault)
  const activeFaults = preserveLatch
    ? state.scenario.activeFaults
    : state.scenario.activeFaults.filter((active) => active !== fault)

  const credited = updateCredit(
    {
      ...state,
      scenario: {
        ...state.scenario,
        correctedFaults,
        activeFaults,
        phase: 'reassess',
        causeCorrectedAt: state.simulationTime,
      },
    },
    { cause: true },
  )
  const definition = getDefinition(credited)
  if (!definition.clinicalCase) return credited
  return markClinicalImproving(credited, definition, {
    // Recognition records the authored response but leaves the trajectory where the physiology is.
    trajectoryUnchanged: RECOGNITION_ONLY_FAULTS.includes(fault),
  })
}

function actionMatchesControl(
  definition: ScenarioDefinition,
  action: SimulationAction,
): { control: boolean; direction: boolean } {
  const expected = definition.expectation
  const stateIndependentMatches =
    (expected.control === 'inspect-circuit' &&
      (action.type === 'PERFORM_CHECK' ||
        (action.type === 'CORRECT_FAULT' && action.fault === expected.correctiveFault))) ||
    (expected.control === 'restore-gas' && action.type === 'RESTORE_GAS_SOURCE') ||
    (expected.control === 'restore-power' && action.type === 'RESTORE_AC_POWER') ||
    (expected.control === 'correct-cause' &&
      action.type === 'CORRECT_FAULT' &&
      action.fault === expected.correctiveFault) ||
    ((expected.control === 'assess-upper-body' || expected.control === 'assess-lv-loading') &&
      action.type === 'CORRECT_FAULT' &&
      action.fault === expected.correctiveFault) ||
    (expected.control === 'gas-fio2' && action.type === 'SET_GAS_FIO2') ||
    (expected.control === 'off-sweep-trial' && action.type === 'SET_SWEEP' && action.sweep === 0)

  if (stateIndependentMatches) return { control: true, direction: true }
  if (expected.control === 'rpm' && action.type === 'SET_RPM') {
    return { control: true, direction: true }
  }
  if (expected.control === 'sweep' && action.type === 'SET_SWEEP') {
    return { control: true, direction: true }
  }
  return { control: false, direction: false }
}

function applyControlCredit(
  previous: EcmoSimulationState,
  next: EcmoSimulationState,
  action: SimulationAction,
): EcmoSimulationState {
  const definition = getDefinition(previous)
  const baseMatch = actionMatchesControl(definition, action)
  if (!baseMatch.control) return next

  let direction = baseMatch.direction
  if (action.type === 'SET_RPM') {
    direction =
      (definition.expectation.direction === 'decrease' &&
        action.rpm < previous.device.rpmSetpoint) ||
      (definition.expectation.direction === 'increase' &&
        action.rpm > previous.device.rpmSetpoint) ||
      (definition.expectation.direction === 'hold' && action.rpm === previous.device.rpmSetpoint)
  }
  if (action.type === 'SET_SWEEP') {
    direction =
      (definition.expectation.direction === 'increase' && action.sweep > previous.gas.sweepLpm) ||
      (definition.expectation.direction === 'decrease' && action.sweep < previous.gas.sweepLpm) ||
      (definition.expectation.direction === 'hold' && action.sweep === previous.gas.sweepLpm) ||
      (definition.expectation.direction === 'off' && action.sweep === 0)
  }

  // B6-005: what the learner did is recorded as execution; the plan credit they committed stays.
  let credited = recordExecution(next, { controlMatched: true, directionMatched: direction })
  if (
    direction &&
    ((definition.expectation.control === 'sweep' && action.type === 'SET_SWEEP') ||
      (definition.expectation.control === 'off-sweep-trial' && action.type === 'SET_SWEEP'))
  ) {
    credited = markFaultCorrected(credited, definition.expectation.correctiveFault)
  }
  return credited
}

function recordExecution(
  state: EcmoSimulationState,
  changes: Partial<NonNullable<EcmoSimulationState['scenario']['execution']>>,
): EcmoSimulationState {
  const current = state.scenario.execution ?? { controlMatched: false, directionMatched: false }
  return {
    ...state,
    scenario: {
      ...state.scenario,
      execution: {
        controlMatched: current.controlMatched || Boolean(changes.controlMatched),
        directionMatched: current.directionMatched || Boolean(changes.directionMatched),
      },
    },
  }
}

function correctFault(state: EcmoSimulationState, fault: FaultId): EcmoSimulationState {
  if (!state.scenario.activeFaults.includes(fault)) return state

  let next = state
  if (fault === 'startup-inspection') {
    next = {
      ...next,
      device: { ...next.device, selfTest: 'passed' },
      circuit: { ...next.circuit, circuitInspected: true },
    }
  }
  if (fault === 'gas-source-interruption') {
    next = { ...next, gas: { ...next.gas, sourceConnected: true } }
  }
  if (fault === 'ac-power-loss') {
    next = { ...next, device: { ...next.device, powerSource: 'ac' } }
  }
  if (fault === 'flow-sensor-failure') {
    next = { ...next, circuit: { ...next.circuit, flowSensorConnected: true } }
  }
  if (fault === 'arterial-bubble') {
    next = { ...next, circuit: { ...next.circuit, arterialBubbleDetected: false } }
  }
  if (fault === 'ecmo-not-initiated') {
    next = { ...next, device: { ...next.device, pumpRunning: true } }
  }
  if (fault === 'hemorrhagic-hypovolemia') {
    next = queuePatientPatch(
      {
        ...next,
        circuit: {
          ...next.circuit,
          hemoglobin: Math.max(8.7, next.circuit.hemoglobin),
          hematocrit: Math.max(26, next.circuit.hematocrit),
        },
      },
      {
        meanArterialPressure: Math.max(65, next.patient.meanArterialPressure),
        centralVenousPressure: 7,
      },
    )
  }
  if (fault === 'tension-pneumothorax') {
    next = queuePatientPatch(next, {
      lungSliding: 'bilateral',
      airwayPressure: 25,
      centralVenousPressure: 10,
    })
  }
  if (fault === 'tamponade') {
    next = queuePatientPatch(next, { centralVenousPressure: 10, meanArterialPressure: 62 })
  }
  if (fault === 'vasoplegia') {
    next = queuePatientPatch(next, { meanArterialPressure: 65 })
  }
  if (fault === 'distal-limb-ischemia') {
    next = queuePatientPatch(next, { distalLimbPerfusion: 'normal', distalLimbNirs: 62 })
  }
  return markFaultCorrected(next, fault)
}

/**
 * An authored patient change earned by an action, held until the clock next advances (B6-012).
 *
 * The circuit and the device respond to a clamp or a correction at once — that is what the console
 * shows. The patient does not change in zero seconds, so the change waits for `advanceOneSecond`,
 * where it lands before the patient is derived for that second.
 */
export function queuePatientPatch(
  state: EcmoSimulationState,
  patch: Partial<PatientState>,
): EcmoSimulationState {
  return {
    ...state,
    scenario: {
      ...state.scenario,
      pendingPatientPatch: { ...state.scenario.pendingPatientPatch, ...patch },
    },
  }
}

function injectScheduledFaults(state: EcmoSimulationState): EcmoSimulationState {
  const definition = getDefinition(state)
  let next = state
  for (const timedFault of definition.timedFaults) {
    if (
      timedFault.atSecond <= next.simulationTime &&
      !next.scenario.injectedTimedFaultIds.includes(timedFault.id)
    ) {
      next = injectFault(next, timedFault.fault)
      next = {
        ...next,
        scenario: {
          ...next.scenario,
          injectedTimedFaultIds: [...next.scenario.injectedTimedFaultIds, timedFault.id],
        },
      }
    }
  }
  return next
}

/**
 * A clinical case holds a non-temporizing intervention's patient change where it landed.
 *
 * The level is recorded with the generic target at that moment as its reference, so what moves it
 * afterwards is only what changes afterwards. Scenarios without an ownership record — every Learn
 * drill, reference circuit and integrated case — are returned unchanged.
 */
function holdLandedInterventionFields(
  state: EcmoSimulationState,
  fields: readonly RateLimitedPatientField[],
): EcmoSimulationState {
  const ownership = state.scenario.patientOwnership
  if (!ownership || fields.length === 0) return state
  const generic = genericPatientTargets(state, state.circuit.bloodFlow)
  const anchors = { ...ownership.anchors }
  for (const field of fields) {
    anchors[field] = {
      level: state.patient[field],
      reference: generic[field],
      source: 'intervention',
      setAt: state.simulationTime,
    }
  }
  return {
    ...state,
    scenario: { ...state.scenario, patientOwnership: { ...ownership, anchors } },
  }
}

function advanceOneSecond(state: EcmoSimulationState): EcmoSimulationState {
  const nextTime = state.simulationTime + 1
  const lastActionTime =
    [...state.history].reverse().find((entry) => entry.kind === 'action')?.time ?? 0
  // Earned patient changes land now, with the second that carries them (B6-012).
  const pending = state.scenario.pendingPatientPatch
  const persistentFields = state.scenario.pendingPersistentPatientFields ?? []
  const landedPatientFields = new Set(Object.keys(pending ?? {}))
  const withPatch: EcmoSimulationState = pending
    ? holdLandedInterventionFields(
        {
          ...state,
          simulationTime: nextTime,
          patient: { ...state.patient, ...pending },
          scenario: {
            ...state.scenario,
            pendingPatientPatch: undefined,
            pendingPersistentPatientFields: undefined,
          },
        },
        persistentFields.filter((field) => landedPatientFields.has(field)),
      )
    : state
  const timeAdvanced: EcmoSimulationState = {
    ...withPatch,
    simulationTime: nextTime,
    device: {
      ...withPatch.device,
      locked: withPatch.device.locked || nextTime - lastActionTime >= 180,
      timers: withPatch.device.timers.map((timer, index) =>
        withPatch.device.timerRunning[index]
          ? index === 3
            ? Math.max(0, timer - 1)
            : timer + 1
          : timer,
      ),
    },
  }
  const derived = deriveSimulation(injectScheduledFaults(timeAdvanced), { landedPatientFields })
  const definition = getDefinition(derived)
  const clinical = derived.scenario.clinical
  const lastIntervention = clinical?.appliedInterventions.at(-1)
  if (
    clinical &&
    definition.clinicalCase &&
    derived.scenario.activeFaults.length > 0 &&
    lastIntervention?.effect === 'temporizing' &&
    derived.simulationTime - lastIntervention.time >= 3
  ) {
    return {
      ...derived,
      scenario: {
        ...derived.scenario,
        clinical: {
          ...clinical,
          trajectory: 'deteriorating',
          lastResponse: definition.clinicalCase.deteriorationResponse,
        },
      },
    }
  }
  return derived
}

function advance(state: EcmoSimulationState, seconds: number): EcmoSimulationState {
  let next = state
  const boundedSeconds = clamp(Math.floor(seconds), 1, 60)
  for (let index = 0; index < boundedSeconds; index += 1) next = advanceOneSecond(next)
  return next
}

/**
 * Control actions after which the circuit is recomputed at the unchanged simulation time.
 *
 * The clamp, resumption, initiation and resolution paths always recomputed the circuit where the
 * action landed. A console speed change, a sweep or gas change, a restored source or a correction did
 * not, so the console went on showing the old flow until the next tick — on a paused Practice clock,
 * indefinitely — and the circuit change a speed reduction made was folded into whatever the next
 * second did (S8-3). Recomputation never moves the patient: `deriveSimulation` advances the patient,
 * the battery, haemoglobin and the per-second controllers only on a second of the clock.
 */
const RECOMPUTED_AT_ACTION_TIME: ReadonlySet<SimulationAction['type']> = new Set([
  'SET_RPM',
  'SET_FLOW_TARGET',
  'SET_SWEEP',
  'SET_GAS_FIO2',
  'RESTORE_GAS_SOURCE',
  'RESTORE_AC_POWER',
  'TOGGLE_ZERO_FLOW',
  'TOGGLE_GLOBAL_OVERRIDE',
  'ADJUST_LIMIT',
  'CORRECT_FAULT',
  'PERFORM_CHECK',
  'APPLY_CLINICAL_INTERVENTION',
  'INJECT_FAULT',
])

/** The compact, immutable reading an action's observation pair is made of. */
export function observeSimulation(state: EcmoSimulationState): EcmoObservation {
  const va = state.supportMode === 'va'
  return {
    time: state.simulationTime,
    bloodFlow: state.circuit.bloodFlow,
    pumpRunning: state.device.pumpRunning,
    rpmSetpoint: state.device.rpmSetpoint,
    pVen: state.circuit.readouts.pVen.displayed,
    spo2: va ? state.patient.rightRadialSpo2 : state.patient.spo2,
    femoralArterialSpo2: va ? state.patient.femoralArterialSpo2 : null,
    paCO2: state.patient.paCO2,
    pH: state.patient.pH,
    meanArterialPressure: state.patient.meanArterialPressure,
    centralVenousPressure: state.patient.centralVenousPressure,
    lactate: state.patient.lactate,
  }
}

/**
 * Stamp every learner action this transition recorded with the state it was taken in and the state
 * it produced. Both are at the same simulation time; neither is ever recomputed. A record that
 * already carries a pair (the inner half of a delegated action, such as a rotary turn) keeps it.
 */
function attachActionObservations(
  previous: EcmoSimulationState,
  next: EcmoSimulationState,
): EcmoSimulationState {
  if (next === previous || next.simulationTime !== previous.simulationTime) return next
  const before = observeSimulation(previous)
  const after = observeSimulation(next)
  const priorHistoryIds = new Set(previous.history.map((entry) => entry.id))
  let changed = false
  const history = next.history.map((entry) => {
    if (entry.kind !== 'action' || entry.observation || priorHistoryIds.has(entry.id)) return entry
    changed = true
    return { ...entry, observation: { before, after } }
  })
  const previousCount = previous.scenario.clinical?.appliedInterventions.length ?? 0
  const clinical = next.scenario.clinical
  const appliedInterventions = clinical?.appliedInterventions.map((record, index) => {
    if (index < previousCount || record.observation) return record
    changed = true
    return { ...record, observation: { before, after } }
  })
  if (!changed) return next
  return {
    ...next,
    history,
    scenario:
      clinical && appliedInterventions
        ? { ...next.scenario, clinical: { ...clinical, appliedInterventions } }
        : next.scenario,
  }
}

/**
 * The one relationship this engine has for work of breathing is timed from when the sweep stopped,
 * so the reducer records that moment on every transition that turns the sweep off or back on.
 */
function trackSweepStop(
  previous: EcmoSimulationState,
  next: EcmoSimulationState,
): EcmoSimulationState {
  const stoppedAt = next.scenario.sweepStoppedAt ?? null
  if (next.gas.sweepLpm > 0) {
    return stoppedAt === null
      ? next
      : { ...next, scenario: { ...next.scenario, sweepStoppedAt: null } }
  }
  if (previous.gas.sweepLpm > 0 || stoppedAt === null) {
    return { ...next, scenario: { ...next.scenario, sweepStoppedAt: next.simulationTime } }
  }
  return next
}

export function ecmoSimulationReducer(
  state: EcmoSimulationState,
  action: SimulationAction,
): EcmoSimulationState {
  const reduced = reduceSimulationAction(state, action)
  if (action.type === 'LOAD_SCENARIO' || reduced === state) return reduced
  const tracked = trackSweepStop(state, reduced)
  const recomputed =
    RECOMPUTED_AT_ACTION_TIME.has(action.type) && tracked.simulationTime === state.simulationTime
      ? deriveSimulation(tracked, { advancePatient: false })
      : tracked
  return attachActionObservations(state, recomputed)
}

function reduceSimulationAction(
  state: EcmoSimulationState,
  action: SimulationAction,
): EcmoSimulationState {
  if (action.type === 'LOAD_SCENARIO') {
    return createInitialSimulationState(action.scenarioId, action.mode ?? state.simulationMode)
  }

  if (action.type === 'START_ACTIVITY') {
    // Entry does not change time, physiology, prediction, credit, or action history.
    return { ...state, scenario: { ...state.scenario, activityStarted: true, phase: 'act' } }
  }

  if (action.type === 'COMMIT_PREDICTION') {
    const definition = getDefinition(state)
    const goal = action.goalId === definition.expectation.goalId
    const control = action.control === definition.expectation.control
    const direction = action.direction === definition.expectation.direction
    return appendHistory(
      updateCredit(
        {
          ...state,
          scenario: {
            ...state.scenario,
            phase: 'act',
            activityStarted: true,
            prediction: { committed: true, ...action },
          },
        },
        { goal, control, direction },
      ),
      'action',
      'Committed prediction before action',
    )
  }

  switch (action.type) {
    /*
     * The model clock stops with the reveal (ECMO-FELLOW-02).
     *
     * Revealing the debrief changes only the phase. But a clock left running kept ticking
     * underneath it, so the patient readings, the trend buffer and every "until now" interval in the
     * debrief went on changing while the learner read an explanation of a run that had ended.
     */
    case 'TICK':
      return state.paused || state.scenario.phase === 'complete'
        ? state
        : advance(state, action.seconds ?? 1)
    case 'STEP':
      return state.scenario.phase === 'complete' ? state : advance(state, 1)
    case 'SET_PAUSED':
      return { ...state, paused: action.paused }
    case 'SET_SCREEN':
      return appendHistory(
        { ...state, device: { ...state.device, screen: action.screen } },
        'action',
        actionLabels.SET_SCREEN ?? '',
      )
    case 'TOGGLE_LOCK':
      return appendHistory(
        { ...state, device: { ...state.device, locked: !state.device.locked } },
        'action',
        state.device.locked ? 'Unlocked controls after hold' : 'Locked controls',
      )
    case 'SET_PUMP_MODE': {
      if (state.device.locked) return state
      const definition = getDefinition(state)
      const mode = action.mode === 'lpm' && !state.circuit.flowSensorConnected ? 'rpm' : action.mode
      const next = {
        ...state,
        device: { ...state.device, pumpMode: mode, displayedSetpoint: null },
      }
      return appendHistory(
        definition.assessmentPolicy?.preserveCircuitBloodFlow && mode !== state.device.pumpMode
          ? addCriticalError(next, 'capstone-flow-reduction', 50)
          : next,
        'action',
        actionLabels.SET_PUMP_MODE ?? '',
      )
    }
    case 'ROTARY_DELTA': {
      if (state.device.locked) return state
      if (state.device.pumpMode === 'rpm') {
        return ecmoSimulationReducer(state, {
          type: 'SET_RPM',
          rpm: clamp(state.device.rpmSetpoint + action.delta * 50, 0, 5000),
        })
      }
      return ecmoSimulationReducer(state, {
        type: 'SET_FLOW_TARGET',
        flow: clamp(state.device.lpmSetpoint + action.delta * 0.1, 0, 9.9),
      })
    }
    case 'SET_RPM': {
      if (state.device.locked) return state
      const definition = getDefinition(state)
      let next: EcmoSimulationState = {
        ...state,
        device: {
          ...state.device,
          rpmSetpoint: Math.round(clamp(action.rpm, 0, 5000)),
          displayedSetpoint: Math.round(clamp(action.rpm, 0, 5000)),
        },
      }
      const raisingSpeed = action.rpm > state.device.rpmSetpoint
      /*
       * Charged against the model's own drainage capacity, not against the direction alone.
       *
       * The guard used to fire on any increase while a drainage-limited fault was active, which
       * penalised a learner who had backed the pump well off and was bringing it back toward the
       * speed the circuit can actually support — an action the model itself treats as helpful. It
       * now fires when the new speed asks for more than the drainage can give, which is precisely
       * where the model stops delivering it, so the score and the display finally agree.
       */
      if (
        resolveDrainageLimitation({ ...state, device: next.device }, action.rpm)?.limited &&
        raisingSpeed
      ) {
        next = addCriticalError(next, 'rpm-during-collapse', 50)
      }
      // Same reflex, different mechanism. Pulling harder against established recirculation widens
      // the recirculating share rather than the support the patient receives, so it belongs in the
      // RPM-escalation guard family — but under its own name, because calling it drainage collapse
      // would teach the wrong cause.
      //
      // Gated on the case's own opening speed as well as on the direction of travel, because that
      // is exactly where the model starts charging for it. A learner who has backed the pump off
      // and is returning toward the speed the case opened at is not escalating, and scoring them as
      // though they were would punish an action the simulation itself treats as harmless.
      if (
        hasFault(state, 'recirculation') &&
        raisingSpeed &&
        action.rpm > state.scenario.baselineRpmSetpoint
      ) {
        next = addCriticalError(next, 'rpm-during-recirculation', 50)
      }
      if (
        definition.assessmentPolicy?.preserveCircuitBloodFlow &&
        action.rpm !== state.device.rpmSetpoint
      ) {
        next = addCriticalError(next, 'capstone-flow-reduction', 50)
      }
      // B6-004: reserve power buys time, not permission. Trading support for runtime on battery is
      // the reflex the transport lesson calls unsafe, so the model charges it rather than rewarding
      // the longer runtime.
      if (reducesSupportOnBattery(state) && action.rpm < state.device.rpmSetpoint) {
        next = addCriticalError(next, 'support-reduction-on-battery', 50)
      }
      const simulatorIntervention = findMatchingSimulatorIntervention(state, definition, action)
      if (simulatorIntervention) {
        next = applyClinicalInterventionAndResolve(next, definition, simulatorIntervention.id).state
      }
      return appendHistory(
        applyControlCredit(state, next, action),
        'action',
        actionLabels.SET_RPM ?? '',
      )
    }
    case 'SET_FLOW_TARGET': {
      if (state.device.locked || !state.circuit.flowSensorConnected) return state
      const definition = getDefinition(state)
      let next: EcmoSimulationState = {
        ...state,
        device: {
          ...state.device,
          lpmSetpoint: Math.round(clamp(action.flow, 0, 9.9) * 10) / 10,
          displayedSetpoint: action.flow,
        },
      }
      if (
        definition.assessmentPolicy?.preserveCircuitBloodFlow &&
        action.flow !== state.device.lpmSetpoint
      ) {
        next = addCriticalError(next, 'capstone-flow-reduction', 50)
      }
      if (reducesSupportOnBattery(state) && action.flow < state.device.lpmSetpoint) {
        next = addCriticalError(next, 'support-reduction-on-battery', 50)
      }
      return appendHistory(next, 'action', actionLabels.SET_FLOW_TARGET ?? '')
    }
    case 'SET_SWEEP': {
      const definition = getDefinition(state)
      const sweepLpm = clamp(action.sweep, 0, 15)
      let next = { ...state, gas: { ...state.gas, sweepLpm } }
      if (
        definition.assessmentPolicy?.prohibitSweepZeroWhileFlowing &&
        sweepLpm === 0 &&
        Math.abs(state.circuit.bloodFlow) > 0.05
      ) {
        next = addCriticalError(next, 'va-sweep-off', 50)
      }
      const simulatorIntervention = findMatchingSimulatorIntervention(state, definition, action)
      if (simulatorIntervention) {
        next = applyClinicalInterventionAndResolve(next, definition, simulatorIntervention.id).state
      }
      return appendHistory(
        applyControlCredit(state, next, action),
        'action',
        actionLabels.SET_SWEEP ?? '',
      )
    }
    case 'SET_GAS_FIO2': {
      const definition = getDefinition(state)
      let next = { ...state, gas: { ...state.gas, fio2: clamp(action.fio2, 0.21, 1) } }
      const simulatorIntervention = findMatchingSimulatorIntervention(state, definition, action)
      if (simulatorIntervention) {
        next = applyClinicalInterventionAndResolve(next, definition, simulatorIntervention.id).state
      }
      return appendHistory(
        applyControlCredit(state, next, action),
        'action',
        actionLabels.SET_GAS_FIO2 ?? '',
      )
    }
    case 'RESTORE_GAS_SOURCE': {
      const definition = getDefinition(state)
      const simulatorIntervention = findMatchingSimulatorIntervention(state, definition, action)
      const next = simulatorIntervention
        ? applyClinicalInterventionAndResolve(state, definition, simulatorIntervention.id).state
        : correctFault(
            { ...state, gas: { ...state.gas, sourceConnected: true } },
            'gas-source-interruption',
          )
      return appendHistory(
        applyControlCredit(state, next, action),
        'action',
        actionLabels.RESTORE_GAS_SOURCE ?? '',
      )
    }
    case 'RESTORE_AC_POWER': {
      const next = correctFault(
        { ...state, device: { ...state.device, powerSource: 'ac' } },
        'ac-power-loss',
      )
      return appendHistory(
        applyControlCredit(state, next, action),
        'action',
        actionLabels.RESTORE_AC_POWER ?? '',
      )
    }
    case 'PRESS_SAFETY':
      return appendHistory(
        {
          ...state,
          device: { ...state.device, safetyHeld: true },
        },
        'action',
        actionLabels.PRESS_SAFETY ?? '',
      )
    case 'RELEASE_SAFETY':
      return appendHistory(
        { ...state, device: { ...state.device, safetyHeld: false } },
        'action',
        actionLabels.RELEASE_SAFETY ?? '',
      )
    case 'ADJUST_LIMIT': {
      if (state.device.locked) return state
      const current = state.device.limits[action.parameter]
      const isPressure = action.parameter.startsWith('p')
      const candidate = clamp(current + action.delta, isPressure ? -500 : 0, isPressure ? 900 : 9.9)
      let adjusted = candidate
      if (action.parameter === 'pVenWarningLow')
        adjusted = Math.max(candidate, state.device.limits.pVenAlarmLow)
      if (action.parameter === 'pVenAlarmLow')
        adjusted = Math.min(candidate, state.device.limits.pVenWarningLow)
      if (action.parameter === 'pIntWarningHigh')
        adjusted = Math.min(candidate, state.device.limits.pIntAlarmHigh)
      if (action.parameter === 'pIntAlarmHigh')
        adjusted = Math.max(candidate, state.device.limits.pIntWarningHigh)
      if (action.parameter === 'pArtWarningHigh')
        adjusted = Math.min(candidate, state.device.limits.pArtAlarmHigh)
      if (action.parameter === 'pArtAlarmHigh')
        adjusted = Math.max(candidate, state.device.limits.pArtWarningHigh)
      if (action.parameter === 'flowLow')
        adjusted = Math.min(candidate, state.device.limits.flowHigh)
      if (action.parameter === 'flowHigh')
        adjusted = Math.max(candidate, state.device.limits.flowLow)
      return appendHistory(
        {
          ...state,
          device: {
            ...state.device,
            limits: { ...state.device.limits, [action.parameter]: adjusted },
          },
        },
        'action',
        `${actionLabels.ADJUST_LIMIT}: ${action.parameter}`,
      )
    }
    case 'TOGGLE_TIMER': {
      if (action.timerIndex < 0 || action.timerIndex >= state.device.timers.length) return state
      const timerRunning = [...state.device.timerRunning]
      timerRunning[action.timerIndex] = !timerRunning[action.timerIndex]
      return appendHistory(
        { ...state, device: { ...state.device, timerRunning } },
        'action',
        `${actionLabels.TOGGLE_TIMER}: ${action.timerIndex + 1}`,
      )
    }
    case 'RESET_TIMER': {
      if (action.timerIndex < 0 || action.timerIndex >= state.device.timers.length) return state
      const timers = [...state.device.timers]
      const timerRunning = [...state.device.timerRunning]
      timers[action.timerIndex] = action.timerIndex === 3 ? 600 : 0
      timerRunning[action.timerIndex] = false
      return appendHistory(
        { ...state, device: { ...state.device, timers, timerRunning } },
        'action',
        `${actionLabels.RESET_TIMER}: ${action.timerIndex + 1}`,
      )
    }
    case 'TOGGLE_ZERO_FLOW': {
      if (!state.device.safetyHeld) {
        return appendHistory(state, 'system', 'Zero flow requires Safety to be held')
      }
      const zeroFlowDefinition = getDefinition(state)
      if (reducesSupportOnBattery(state) && !state.device.zeroFlowActive) {
        return appendHistory(
          addCriticalError(
            { ...state, device: { ...state.device, zeroFlowActive: true, safetyHeld: false } },
            'support-reduction-on-battery',
            50,
          ),
          'action',
          actionLabels.TOGGLE_ZERO_FLOW ?? '',
        )
      }
      return appendHistory(
        zeroFlowDefinition.assessmentPolicy?.preserveCircuitBloodFlow &&
          !state.device.zeroFlowActive
          ? addCriticalError(
              {
                ...state,
                device: {
                  ...state.device,
                  zeroFlowActive: true,
                  safetyHeld: false,
                },
              },
              'capstone-flow-reduction',
              50,
            )
          : {
              ...state,
              device: {
                ...state.device,
                zeroFlowActive: !state.device.zeroFlowActive,
                safetyHeld: false,
              },
              circuit: state.device.zeroFlowActive
                ? { ...state.circuit, backflowSeconds: 0 }
                : state.circuit,
            },
        'action',
        actionLabels.TOGGLE_ZERO_FLOW ?? '',
      )
    }
    case 'TOGGLE_GLOBAL_OVERRIDE': {
      if (!state.device.safetyHeld) {
        return appendHistory(state, 'system', 'Global Override requires Safety to be held')
      }
      const changed = {
        ...state,
        device: {
          ...state.device,
          globalOverride: !state.device.globalOverride,
          safetyHeld: false,
        },
      }
      return appendHistory(
        addCriticalError(changed, 'global-override', 50),
        'action',
        actionLabels.TOGGLE_GLOBAL_OVERRIDE ?? '',
      )
    }
    case 'ACK_ALARM': {
      const selectedId = action.alarmId ?? state.alarms[0]?.id
      const next: EcmoSimulationState = {
        ...state,
        device: { ...state.device, alarmPausedUntil: state.simulationTime + 60 },
        alarms: state.alarms.map((alarm) =>
          alarm.id === selectedId ? { ...alarm, acknowledgedAt: state.simulationTime } : alarm,
        ),
        alarmHistory: state.alarmHistory.map((alarm) =>
          alarm.id === selectedId ? { ...alarm, acknowledgedAt: state.simulationTime } : alarm,
        ),
      }
      return appendHistory(next, 'action', actionLabels.ACK_ALARM ?? '')
    }
    case 'RESET_BUBBLE': {
      if (
        hasFault(state, 'arterial-bubble') &&
        !state.scenario.correctedFaults.includes('arterial-bubble')
      ) {
        return appendHistory(
          addCriticalError(state, 'premature-bubble-reset', 50),
          'action',
          'Bubble reset rejected: correct the cause first',
        )
      }
      const next = {
        ...state,
        device: { ...state.device, pumpRunning: true },
        circuit: {
          ...state.circuit,
          arterialBubbleDetected: false,
          bubbleResetRequired: false,
        },
        scenario: {
          ...state.scenario,
          activeFaults: state.scenario.activeFaults.filter((fault) => fault !== 'arterial-bubble'),
        },
      }
      return appendHistory(next, 'action', 'Bubble intervention reset after cause correction')
    }
    /**
     * Resume support after an air event, in one transition.
     *
     * The old lesson walked the learner out through open-drainage, open-return, reset — which put
     * the patient back on both limbs of a stopped centrifugal circuit before anything was turning.
     * Where clamp opening, pump restart and console reset fall relative to one another during
     * resumption is device- and program-specific, so this module stopped teaching an order. What it
     * teaches instead is the precondition: the source is corrected and the circuit is clear. This
     * bounded action stands in for the device- and program-specific resumption sequence; it does not
     * reproduce or teach that sequence, and completing it is not evidence that any real protocol was
     * followed.
     */
    case 'RESUME_SUPPORT_AFTER_BUBBLE': {
      /*
       * One contract, two readers.
       *
       * The eligibility decision lives in `resolveBubbleResumption` so the control the learner
       * presses and the reducer that performs the transition cannot disagree about what has to be
       * true — which is exactly how the clinical cases came to offer a live Resume button while air
       * was still in the circuit and a dead one the moment it was clear. The safety rules are
       * unchanged: both refusals below are the guards that were already here, and both still fire
       * on a direct dispatch that bypasses the control.
       */
      const eligibility = resolveBubbleResumption(state)
      if (eligibility.status === 'air-outstanding') {
        return appendHistory(
          addCriticalError(state, 'premature-bubble-reset', 50),
          'action',
          'Resume rejected: correct the air source and clear the circuit first',
        )
      }
      // B6-002: resumption is the act of bringing an isolated patient back. With neither clamp ever
      // closed there was no isolation to come back from, and the sequence was skipped.
      if (eligibility.status === 'never-isolated') {
        return appendHistory(
          addCriticalError(state, 'air-correction-before-isolation', 50),
          'action',
          'Resume rejected: the patient was never isolated from the air column',
        )
      }
      /*
       * A second press of a completed resumption is nothing, not a safety event.
       *
       * The isolation guard above reads "both limbs open" as "never isolated", which is also what a
       * circuit looks like once this action has already run: open limbs, pump turning, air retired.
       * So a double click used to charge a 50-point critical error for the act of clicking the
       * button twice. Neither refusal here changes any state, which is what makes the repeat safe
       * to swallow.
       */
      if (eligibility.status !== 'eligible') {
        return state
      }
      const resumed = deriveSimulation(
        {
          ...state,
          device: { ...state.device, pumpRunning: true },
          circuit: {
            ...state.circuit,
            arterialBubbleDetected: false,
            bubbleResetRequired: false,
            drainageClampClosed: false,
            returnClampClosed: false,
          },
        },
        { advancePatient: false },
      )
      /*
       * The clinical intervention resolves before the fault is retired, not after.
       *
       * In a clinical case this action is the last required intervention, and resolving it is what
       * records the corrective fault and the credit for it. `correctFault` returns early on a fault
       * that is no longer active, so retiring the fault first would silently cost the learner the
       * cause credit they had just earned.
       */
      const definition = getDefinition(state)
      const simulatorIntervention = findMatchingSimulatorIntervention(state, definition, action)
      const resolved = simulatorIntervention
        ? applyClinicalInterventionAndResolve(resumed, definition, simulatorIntervention.id).state
        : resumed
      const next = {
        ...resolved,
        scenario: {
          ...resolved.scenario,
          activeFaults: resolved.scenario.activeFaults.filter(
            (fault) => fault !== 'arterial-bubble',
          ),
        },
      }
      return appendHistory(
        next,
        'action',
        "Completed the simulation's protocol-governed resumption abstraction",
      )
    }
    case 'TOGGLE_CIRCUIT_CLAMP': {
      const clampKey = action.limb === 'drainage' ? 'drainageClampClosed' : 'returnClampClosed'
      const closing = action.closed ?? !state.circuit[clampKey]
      if (closing === state.circuit[clampKey]) return state
      const definition = getDefinition(state)
      const circuit = {
        ...state.circuit,
        [clampKey]: closing,
      }
      /*
       * The one state resumption may never render.
       *
       * Opening the last closed limb while the bubble latch still holds the pump would put the
       * patient back on both limbs of a circuit that is not moving blood — and a centrifugal head
       * is non-occlusive, so nothing holds a column in place.
       *
       * What happens, precisely: the transition is always refused, so the state is never reached.
       * It is additionally charged while air remains outstanding, because reaching for a clamp then
       * is the same unsafe act whether or not the model lets it land. Once the source is corrected
       * there is nothing unsafe about wanting to resume, so the learner is redirected to the bounded
       * resumption action with no further safety penalty.
       *
       * Scoped to the latch on purpose. Both limbs open with a stopped pump is the ordinary pre-use
       * state of every circuit in this module, and making it globally illegal would break startup.
       */
      if (
        !closing &&
        !circuit.drainageClampClosed &&
        !circuit.returnClampClosed &&
        state.circuit.bubbleResetRequired &&
        !state.device.pumpRunning
      ) {
        // Charged only while the air is still outstanding; after correction the refusal is a
        // redirection rather than a penalty. See the note above the guard for the full rule.
        const held = airIsCorrectedAndClear(state)
          ? state
          : addCriticalError(state, 'unsafe-unclamp-before-deair', 50)
        return appendHistory(
          held,
          'action',
          'Clamp held: resume support per the current IFU and your local protocol rather than opening the last limb onto a stopped pump',
        )
      }
      const canResumeAfterOpening =
        !closing &&
        !circuit.drainageClampClosed &&
        !circuit.returnClampClosed &&
        !circuit.bubbleResetRequired &&
        !state.device.zeroFlowActive &&
        state.device.rpmSetpoint > 0
      let next = deriveSimulation(
        {
          ...state,
          device: canResumeAfterOpening ? { ...state.device, pumpRunning: true } : state.device,
          circuit,
        },
        { advancePatient: false },
      )
      if (closing && definition.assessmentPolicy?.preserveCircuitBloodFlow) {
        next = addCriticalError(next, 'capstone-flow-reduction', 50)
      }
      // Opening a clamp is unsafe while circuit air is neither corrected (drill
      // CORRECT_FAULT path) nor cleared (clinical de-air patch clears the latch).
      if (
        !closing &&
        hasFault(state, 'arterial-bubble') &&
        !state.scenario.correctedFaults.includes('arterial-bubble') &&
        state.circuit.bubbleResetRequired
      ) {
        next = addCriticalError(next, 'unsafe-unclamp-before-deair', 50)
      }
      const simulatorIntervention = findMatchingSimulatorIntervention(state, definition, action)
      if (simulatorIntervention) {
        next = applyClinicalInterventionAndResolve(next, definition, simulatorIntervention.id).state
      }
      return appendHistory(
        next,
        'action',
        `${actionLabels.TOGGLE_CIRCUIT_CLAMP}: ${action.limb} ${closing ? 'closed' : 'open'}`,
      )
    }
    case 'CORRECT_FAULT': {
      // B6-002: the air source is corrected on a circuit the patient is off, or not at all. A
      // stopped pump is not isolation; both near-patient clamps are.
      if (
        action.fault === 'arterial-bubble' &&
        hasFault(state, 'arterial-bubble') &&
        !patientIsolated(state)
      ) {
        return appendHistory(
          addCriticalError(state, 'air-correction-before-isolation', 50),
          'action',
          'Air correction held: isolate the patient with both near-patient clamps first',
        )
      }
      const next = correctFault(state, action.fault)
      /*
       * What this action did, named for what the model represents.
       *
       * On a recognition-only fault the authored "correction" is verifying the pattern and
       * escalating: the fault stays active, the physiology keeps doing what it was doing, and no
       * treatment is represented. Recording that as "Corrected scenario cause" put a completed
       * treatment in the debrief's own timeline while the right-arm saturation on the monitor
       * beside it had not moved — IA-3 in the September 2026 walkthrough, on the VA integrated
       * case. The recognition is still recorded; it is recorded as recognition.
       */
      const recognitionOnly = RECOGNITION_ONLY_FAULTS.includes(action.fault)
      return appendHistory(
        applyControlCredit(state, next, action),
        'action',
        recognitionOnly
          ? `Recognised and escalated the scenario cause: ${action.fault}. This module represents recognition and escalation here, not a treatment, so the pattern persists.`
          : `${actionLabels.CORRECT_FAULT}: ${action.fault}`,
      )
    }
    case 'APPLY_CLINICAL_INTERVENTION': {
      const definition = getDefinition(state)
      const selected = definition.clinicalCase?.interventions.find(
        (intervention) => intervention.id === action.interventionId,
      )
      if (selected?.simulatorAction) {
        const clinical = state.scenario.clinical
        const next = clinical
          ? {
              ...state,
              scenario: {
                ...state.scenario,
                clinical: {
                  ...clinical,
                  lastResponse: `${selected.simulatorAction.instruction} This action must be completed on the simulator.`,
                },
              },
            }
          : state
        return appendHistory(
          next,
          'system',
          `Action held: use ${selected.simulatorAction.control} on the simulator`,
        )
      }
      // B6-002, clinical path: de-airing clears the detector and the latch through a patch. It is
      // refused, and charged, while the patient is still on either limb of the air column.
      const clearsAir =
        selected?.patch?.circuit?.arterialBubbleDetected === false ||
        selected?.patch?.circuit?.bubbleResetRequired === false
      if (clearsAir && state.circuit.arterialBubbleDetected && !patientIsolated(state)) {
        return appendHistory(
          addCriticalError(state, 'air-correction-before-isolation', 50),
          'action',
          'De-airing held: isolate the patient with both near-patient clamps first',
        )
      }
      const { state: next, result } = applyClinicalInterventionAndResolve(
        state,
        definition,
        action.interventionId,
      )
      /*
       * An attempt that was refused is not an application.
       *
       * `applyClinicalIntervention` returns `blocked` for an unknown card, one already completed,
       * and one whose authored prerequisites are outstanding — and in all three it changes nothing
       * but the response line. This branch logged every one of them as "Applied clinical
       * intervention: <label>", so the debrief's "What you did" carried actions the learner was
       * refused. The refused attempt is still recorded, because reaching for it is worth seeing;
       * it is recorded as what it was.
       */
      if (!result.intervention) {
        return appendHistory(
          next,
          'system',
          `${actionLabels.APPLY_CLINICAL_INTERVENTION}: unavailable`,
        )
      }
      if (result.blocked) {
        return appendHistory(next, 'system', `Attempted, not applied: ${result.intervention.label}`)
      }
      return appendHistory(
        next,
        'action',
        `${actionLabels.APPLY_CLINICAL_INTERVENTION}: ${result.intervention.label}`,
      )
    }
    case 'START_ECMO': {
      const definition = getDefinition(state)
      const result = attemptClinicalEcmoStart(state, definition)
      const next = result.started
        ? recordExecution(
            deriveSimulation(correctFault(result.state, definition.expectation.correctiveFault), {
              advancePatient: false,
            }),
            { controlMatched: true, directionMatched: true },
          )
        : result.state
      return appendHistory(
        next,
        'action',
        `${actionLabels.START_ECMO}: ${result.started ? 'support established' : result.message}`,
      )
    }
    case 'PERFORM_CHECK': {
      const definition = getDefinition(state)
      const fault = definition.expectation.correctiveFault
      const inspectedState: EcmoSimulationState = {
        ...state,
        circuit: { ...state.circuit, circuitInspected: true },
      }
      if (
        !definition.expectation.requiredCheckId ||
        action.checkId !== definition.expectation.requiredCheckId
      ) {
        return appendHistory(
          inspectedState,
          'action',
          `Tip-to-tip circuit and sensor inspection documented; the scenario cause remains active`,
        )
      }
      const next = correctFault(inspectedState, fault)
      return appendHistory(
        applyControlCredit(state, next, action),
        'action',
        `${actionLabels.PERFORM_CHECK}: ${action.checkId}`,
      )
    }
    case 'REQUEST_HINT': {
      const definition = getDefinition(state)
      const hint = definition.hints?.find((item) => item.id === action.hintId)
      if (!hint || state.scenario.usedHintIds.includes(action.hintId)) return state
      return appendHistory(
        {
          ...state,
          scenario: {
            ...state.scenario,
            usedHintIds: [...state.scenario.usedHintIds, action.hintId],
            hintPenalty: state.scenario.hintPenalty + hint.penalty,
            penalties: state.scenario.penalties + hint.penalty,
          },
        },
        'action',
        `${actionLabels.REQUEST_HINT}: ${hint.title}`,
      )
    }
    case 'COMMIT_REASSESSMENT': {
      const definition = getDefinition(state)
      const reassessment = resolveScenarioReassessment(definition)
      const answers = action.answers
      const hasAllDomains = [
        answers.deviceOptionId,
        answers.circuitOptionId,
        answers.patientOptionId,
      ].every(Boolean)
      const answersCorrect =
        answers.deviceOptionId === reassessment.device.correctOptionId &&
        answers.circuitOptionId === reassessment.circuit.correctOptionId &&
        answers.patientOptionId === reassessment.patient.correctOptionId
      const correctedAt = state.scenario.causeCorrectedAt
      const clinicalActionAt = state.scenario.clinical?.appliedInterventions.at(-1)?.time ?? null
      const acknowledgedAt = state.alarms.reduce<number | null>(
        (latest, alarm) =>
          alarm.acknowledgedAt === undefined
            ? latest
            : Math.max(latest ?? alarm.acknowledgedAt, alarm.acknowledgedAt),
        null,
      )
      const acknowledgementOnlyAttempt = correctedAt === null && acknowledgedAt !== null
      const observationAnchor = correctedAt ?? clinicalActionAt ?? acknowledgedAt
      const minimumObservationSeconds = definition.assessmentPolicy?.minimumObservationSeconds ?? 1
      const observedAfterAction =
        observationAnchor !== null &&
        state.simulationTime - observationAnchor >= minimumObservationSeconds
      const submissionReady = hasAllDomains
      const causeCorrected = state.scenario.correctedFaults.includes(
        definition.expectation.correctiveFault,
      )
      // B6-004: on the transport cases the response is read with support back at the speed the
      // case opened at — the case's own number, not an invented target.
      const supportRestored =
        !definition.assessmentPolicy?.requireBaselineSupportRestored ||
        state.device.rpmSetpoint >= state.scenario.baselineRpmSetpoint
      const valid =
        submissionReady &&
        causeCorrected &&
        answersCorrect &&
        observedAfterAction &&
        supportRestored
      const assessmentState =
        submissionReady && acknowledgementOnlyAttempt
          ? addCriticalError(state, 'ack-without-correction', 30)
          : state
      return appendHistory(
        updateCredit(
          {
            ...assessmentState,
            scenario: {
              ...assessmentState.scenario,
              reassessment: submissionReady ? answers : assessmentState.scenario.reassessment,
              phase: submissionReady ? 'debrief' : 'reassess',
            },
          },
          { reassessment: valid },
        ),
        'action',
        valid
          ? 'Committed reassessment'
          : submissionReady
            ? 'Committed reassessment; the response comparison will be shown in the debrief'
            : 'Choose one device, circuit/gas, and patient response before recording the reassessment',
      )
    }
    case 'REVEAL_DEBRIEF':
      return { ...state, scenario: { ...state.scenario, phase: 'complete' } }
    case 'TOGGLE_ALARM_AUDIO':
      return {
        ...state,
        device: { ...state.device, alarmAudioEnabled: !state.device.alarmAudioEnabled },
      }
    case 'INJECT_FAULT':
      return injectFault(state, action.fault)
    case 'DISCONNECT_FLOW_SENSOR':
      return deriveSimulation(injectFault(state, 'flow-sensor-failure'), { advancePatient: false })
    default:
      return state
  }
}

export interface ScenarioOutcome {
  score: number
  mastery: boolean
  totalPenalty: number
  hintPenalty: number
  maximumScoreAfterHints: number
  criticalErrors: readonly string[]
  completedObjectiveIds: readonly string[]
}

export function selectScenarioOutcome(state: EcmoSimulationState): ScenarioOutcome {
  const definition = getDefinition(state)
  const earned = definition.objectives.reduce((total, objective) => {
    if (objective.category === 'safety') return total
    return total + (state.scenario.credit[objective.category] ? objective.points : 0)
  }, 0)
  const score = clamp(earned - state.scenario.penalties, 0, 100)
  return {
    score,
    mastery: score >= 80 && state.scenario.criticalErrors.length === 0,
    totalPenalty: state.scenario.penalties,
    hintPenalty: state.scenario.hintPenalty,
    maximumScoreAfterHints: clamp(100 - state.scenario.hintPenalty, 0, 100),
    criticalErrors: state.scenario.criticalErrors,
    completedObjectiveIds: state.scenario.completedObjectiveIds,
  }
}

export function selectHighestPriorityAlarm(state: EcmoSimulationState) {
  return state.alarms[0] ?? null
}
