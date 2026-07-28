import { cardiohelpScenarioById, cardiohelpScenarios } from '../content/scenarios'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import { ecmoReferenceProfiles, type EcmoReferenceProfileId } from '../content/referenceProfiles'
import type {
  AlarmEvent,
  AlarmPriority,
  CircuitState,
  EcmoChannelReadout,
  EcmoPhysiologyModelInputs,
  DeviceState,
  EcmoSimulationState,
  FaultId,
  GasState,
  PatientState,
  ScenarioDefinition,
  ScenarioRuntime,
  TrendSample,
} from './types'

export const SIMULATION_VERSION = 1 as const
export const DEFAULT_SCENARIO_ID = cardiohelpScenarios[0].id
export const MAX_TREND_SAMPLES = 180
export const MAX_HISTORY_ENTRIES = 100

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function round(value: number, places = 1): number {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

function moveToward(value: number, target: number, maximumChange: number): number {
  if (Math.abs(target - value) <= maximumChange) return target
  return value + Math.sign(target - value) * maximumChange
}

export const defaultDeviceState: DeviceState = {
  poweredOn: true,
  selfTest: 'passed',
  screen: 'startup',
  locked: false,
  pumpMode: 'rpm',
  rpmSetpoint: 3200,
  lpmSetpoint: 4.2,
  displayedSetpoint: null,
  pumpRunning: true,
  zeroFlowActive: false,
  globalOverride: false,
  pressureInterventionEnabled: true,
  bubbleInterventionEnabled: true,
  alarmAudioEnabled: false,
  alarmPausedUntil: null,
  safetyHeld: false,
  powerSource: 'ac',
  batteryPercent: 100,
  limits: {
    pVenWarningLow: -100,
    pVenAlarmLow: -150,
    pIntWarningHigh: 400,
    pIntAlarmHigh: 500,
    pArtWarningHigh: 400,
    pArtAlarmHigh: 500,
    flowLow: 0,
    flowHigh: 8,
  },
  timers: [0, 0, 0, 600],
  timerRunning: [false, false, false, false],
}

/**
 * Recirculation is a property of where the cannulae sit and how hard the circuit is pulling, not a
 * consequence of the saturations it produces. The scenario therefore sets the fraction, and the
 * observable a bedside clinician actually reads — drainage saturation — is derived from it by
 * `deriveDrainageSaturation`. Doing it the other way round, as this module did until now, made the
 * sign appear without the quantity it is a sign of.
 *
 * Evidence boundary: bounded-educational-model. These are model constants, not measured values.
 */
export const RECIRCULATION_FRACTION = Object.freeze({
  baseline: 0.08,
  established: 0.48,
})

export const defaultCircuitState: CircuitState = {
  bloodFlow: 4,
  pVen: -34,
  pInt: 242,
  pArt: 210,
  pAux: null,
  deltaP: 32,
  tVen: 36.5,
  tArt: 36.8,
  hemoglobin: 10.2,
  hematocrit: 31,
  preOxygenatorSaturation: 70.5,
  postOxygenatorSaturation: 99,
  recirculationFraction: RECIRCULATION_FRACTION.baseline,
  recirculationAdjustedCircuitFlowLpm: 3.68,
  // Replaced on the first derivation; a plain seed so the shape is complete before deriveSimulation.
  readouts: {
    pVen: { status: 'valid', raw: -34, displayed: -34, reason: '' },
    pInt: { status: 'valid', raw: 242, displayed: 242, reason: '' },
    pArt: { status: 'valid', raw: 210, displayed: 210, reason: '' },
    deltaP: { status: 'valid', raw: 32, displayed: 32, reason: '' },
    venousLineSaturation: { status: 'valid', raw: 70.5, displayed: 70.5, reason: '' },
  },
  drainageChatter: false,
  flowSensorConnected: true,
  arterialBubbleDetected: false,
  bubbleResetRequired: false,
  circuitInspected: false,
  backflowSeconds: 0,
  drainageClampClosed: false,
  returnClampClosed: false,
}

export const defaultGasState: GasState = {
  sweepLpm: 4,
  fio2: 1,
  sourceConnected: true,
}

export const defaultPatientState: PatientState = {
  spo2: 93,
  rightRadialSpo2: 93,
  femoralArterialSpo2: 93,
  paCO2: 42,
  pH: 7.39,
  bicarbonate: 25,
  respiratoryRate: 18,
  workOfBreathing: 'low',
  meanArterialPressure: 72,
  heartRate: 92,
  pulsePressure: 35,
  aorticValveOpening: true,
  pulmonaryCongestion: 'none',
  nativeCardiacOutputLpm: 4.5,
  centralVenousPressure: 8,
  lactate: 1.8,
  urineOutputMlHr: 50,
  airwayPressure: 24,
  lungSliding: 'bilateral',
  temperature: 37,
  distalLimbPerfusion: 'normal',
  distalLimbNirs: 68,
  systemicVenousSaturationEstimate: 68,
}

/**
 * The scenario runtime a reference circuit carries: everything scored is empty and stays empty.
 * The prediction is marked committed so no surface offers a prediction step for a circuit that
 * poses no question.
 */
function createReferenceRuntime(profileId: string): ScenarioRuntime {
  return {
    scenarioId: profileId,
    family: 'orientation',
    // The circuit is there to be read, not acted on toward a scored goal.
    phase: 'act',
    activeFaults: [],
    correctedFaults: [],
    injectedTimedFaultIds: [],
    prediction: { committed: true, goalId: null, control: null, direction: null },
    reassessment: null,
    credit: { goal: false, control: false, direction: false, cause: false, reassessment: false },
    penalties: 0,
    hintPenalty: 0,
    usedHintIds: [],
    criticalErrors: [],
    completedObjectiveIds: [],
    attempts: 1,
    causeCorrectedAt: null,
    clinical: null,
  }
}

function createScenarioRuntime(definition: ScenarioDefinition): ScenarioRuntime {
  return {
    scenarioId: definition.id,
    family: definition.family,
    phase: 'predict',
    activeFaults: [...(definition.initialState.activeFaults ?? [])],
    correctedFaults: [],
    injectedTimedFaultIds: [],
    prediction: { committed: false, goalId: null, control: null, direction: null },
    reassessment: null,
    credit: { goal: false, control: false, direction: false, cause: false, reassessment: false },
    penalties: 0,
    hintPenalty: 0,
    usedHintIds: [],
    criticalErrors: [],
    completedObjectiveIds: [],
    attempts: 1,
    causeCorrectedAt: null,
    clinical: definition.clinicalCase
      ? {
          supportStatus: definition.clinicalCase.initialSupportStatus,
          trajectory: definition.clinicalCase.initialTrajectory,
          appliedInterventions: [],
          revealedFindings: [],
          lastResponse: null,
        }
      : null,
  }
}

function resolveSimulationDefinition(scenarioId: string): ScenarioDefinition {
  return (
    clinicalPracticeScenarioById.get(scenarioId) ??
    cardiohelpScenarioById.get(scenarioId) ??
    cardiohelpScenarios[0]
  )
}

function initialTrend(state: Omit<EcmoSimulationState, 'trends'>): TrendSample {
  return {
    time: state.simulationTime,
    flow: state.circuit.bloodFlow,
    pVen: state.circuit.pVen,
    pInt: state.circuit.pInt,
    pArt: state.circuit.pArt,
    deltaP: state.circuit.deltaP,
    paCO2: state.patient.paCO2,
    spo2: state.supportMode === 'va' ? state.patient.rightRadialSpo2 : state.patient.spo2,
    map: state.patient.meanArterialPressure,
    lactate: state.patient.lactate,
  }
}

export function createInitialSimulationState(
  scenarioId = DEFAULT_SCENARIO_ID,
  mode: EcmoSimulationState['simulationMode'] = 'guided',
): EcmoSimulationState {
  const definition = resolveSimulationDefinition(scenarioId)
  const base = {
    version: SIMULATION_VERSION,
    supportMode: definition.supportMode,
    simulationMode: mode,
    simulationTime: 0,
    paused: definition.initialState.paused ?? mode === 'guided',
    device: { ...defaultDeviceState, ...definition.initialState.device },
    circuit: { ...defaultCircuitState, ...definition.initialState.circuit },
    gas: { ...defaultGasState, ...definition.initialState.gas },
    patient: { ...defaultPatientState, ...definition.initialState.patient },
    modelInputs: { ...DEFAULT_ECMO_MODEL_INPUTS, ...definition.initialState.modelInputs },
    scenario: createScenarioRuntime(definition),
    alarms: [] as readonly AlarmEvent[],
    alarmHistory: [] as readonly AlarmEvent[],
    history: [
      {
        id: `system-0-${definition.id}`,
        time: 0,
        kind: 'system' as const,
        label: `Loaded ${definition.title}`,
      },
    ],
  }

  return deriveSimulation({ ...base, trends: [initialTrend(base)] })
}

/**
 * A running, fault-free circuit for the didactic Learn sections.
 *
 * Built from an authored reference profile rather than a scenario: no faults, no timed faults, no
 * objectives, no prediction, no scoring, and the pump running from the first frame. The profile
 * authors only inputs — RPM, sweep, support mode and patient state — so flow and the three
 * pressures are derived here exactly as they are anywhere else, and are then checked against the
 * profile's `expected` bounds by the dump harness and by tests.
 */
export function createReferenceSimulationState(
  profileId: EcmoReferenceProfileId,
): EcmoSimulationState {
  const profile = ecmoReferenceProfiles[profileId]
  const base = {
    version: SIMULATION_VERSION,
    supportMode: profile.supportMode,
    simulationMode: 'guided' as EcmoSimulationState['simulationMode'],
    simulationTime: 0,
    paused: false,
    device: {
      ...defaultDeviceState,
      rpmSetpoint: profile.inputs.rpmSetpoint,
      pumpRunning: true,
      pumpMode: 'rpm' as const,
      displayedSetpoint: profile.inputs.rpmSetpoint,
    },
    circuit: { ...defaultCircuitState },
    gas: { ...defaultGasState, ...profile.inputs.gas },
    patient: { ...defaultPatientState, ...profile.inputs.patient },
    modelInputs: { ...DEFAULT_ECMO_MODEL_INPUTS, ...profile.inputs.modelInputs },
    scenario: createReferenceRuntime(profile.id),
    alarms: [] as readonly AlarmEvent[],
    alarmHistory: [] as readonly AlarmEvent[],
    history: [
      {
        id: `system-0-${profile.id}`,
        time: 0,
        kind: 'system' as const,
        label: `Loaded ${profile.title}`,
      },
    ],
  }

  return deriveSimulation({ ...base, trends: [initialTrend(base)] })
}

export function hasFault(state: EcmoSimulationState, fault: FaultId): boolean {
  return state.scenario.activeFaults.includes(fault)
}

export function injectFault(state: EcmoSimulationState, fault: FaultId): EcmoSimulationState {
  if (hasFault(state, fault)) return state

  let device = state.device
  let circuit = state.circuit
  let gas = state.gas

  if (fault === 'gas-source-interruption') gas = { ...gas, sourceConnected: false }
  if (fault === 'ac-power-loss') device = { ...device, powerSource: 'battery' }
  if (fault === 'flow-sensor-failure') circuit = { ...circuit, flowSensorConnected: false }
  if (fault === 'arterial-bubble') {
    circuit = { ...circuit, arterialBubbleDetected: true, bubbleResetRequired: true }
    if (device.bubbleInterventionEnabled && !device.globalOverride) {
      device = { ...device, pumpRunning: false }
    }
  }

  return {
    ...state,
    device,
    circuit,
    gas,
    scenario: {
      ...state.scenario,
      activeFaults: [...state.scenario.activeFaults, fault],
    },
    history: [
      ...state.history,
      {
        id: `fault-${state.simulationTime}-${fault}`,
        time: state.simulationTime,
        kind: 'fault' as const,
        label: `Scenario event: ${fault}`,
      },
    ].slice(-MAX_HISTORY_ENTRIES),
  }
}

interface AlarmDescriptor {
  code: string
  message: string
  priority: AlarmPriority
  source: AlarmEvent['source']
  parameter?: string
}

const priorityRank: Record<AlarmPriority, number> = { low: 1, medium: 2, high: 3 }

function alarmDescriptors(state: EcmoSimulationState): AlarmDescriptor[] {
  const descriptors: AlarmDescriptor[] = []
  const { device, circuit, gas, patient } = state
  const pressureProtectionActive = device.pressureInterventionEnabled && !device.globalOverride

  if (circuit.arterialBubbleDetected && circuit.bubbleResetRequired) {
    const bubbleStopActive =
      device.bubbleInterventionEnabled && !device.globalOverride && !device.pumpRunning
    descriptors.push({
      code: 'ART_BUBBLE',
      message: bubbleStopActive
        ? 'Arterial bubble - pump stopped'
        : 'Arterial bubble detected - intervention bypassed',
      priority: device.bubbleInterventionEnabled && !device.globalOverride ? 'high' : 'low',
      source: 'device',
      parameter: 'Bubble',
    })
  }

  if (circuit.drainageClampClosed || circuit.returnClampClosed) {
    const closedLimbs = [
      circuit.drainageClampClosed ? 'drainage' : null,
      circuit.returnClampClosed ? 'return' : null,
    ].filter(Boolean)
    descriptors.push({
      code: 'CIRCUIT_CLAMP',
      message: `${closedLimbs.join(' and ')} circuit clamp${closedLimbs.length > 1 ? 's' : ''} closed - forward flow interrupted${device.pumpRunning ? ' with pump demand present' : ''}`,
      priority: device.pumpRunning ? 'high' : 'medium',
      source: 'device',
      parameter: 'Flow',
    })
  }

  if (!circuit.flowSensorConnected) {
    descriptors.push({
      code: 'FLOW_SENSOR',
      message: 'Flow signal unavailable - mode switched',
      priority: 'medium',
      source: 'device',
      parameter: 'Flow',
    })
  }

  if (
    (circuit.bloodFlow < -0.1 && circuit.backflowSeconds >= 1) ||
    (device.zeroFlowActive && circuit.backflowSeconds >= 6)
  ) {
    const sustainedBackflow = circuit.backflowSeconds >= 6
    const backflowProtectionActive = device.zeroFlowActive && circuit.backflowSeconds >= 6
    descriptors.push({
      code: 'BACKFLOW',
      message: backflowProtectionActive
        ? 'Backflow detected - zero-flow protection active'
        : sustainedBackflow && device.globalOverride
          ? 'Backflow persists - intervention bypassed by Global Override'
          : 'Backflow detected below -0.1 L/min',
      priority: sustainedBackflow ? 'high' : 'medium',
      source: 'device',
      parameter: 'Flow',
    })
  } else if (
    device.pumpRunning &&
    !device.zeroFlowActive &&
    circuit.bloodFlow < device.limits.flowLow
  ) {
    descriptors.push({
      code: 'FLOW_LOW',
      message: 'Blood flow below limit',
      priority: 'high',
      source: 'device',
      parameter: 'Flow',
    })
  }

  if (circuit.bloodFlow > device.limits.flowHigh) {
    descriptors.push({
      code: 'FLOW_HIGH',
      message: 'Blood flow above limit',
      priority: 'low',
      source: 'device',
      parameter: 'Flow',
    })
  }

  // A channel that is not reporting a supported value cannot breach a limit. Alarming on the
  // zero-flow intercept of a stopped circuit would be alarming on an artefact. Power, gas and
  // patient alarms below are unaffected — a stopped pump on battery must still alarm.
  if (circuit.readouts.pVen.status === 'valid') {
    if (circuit.pVen < device.limits.pVenAlarmLow - 10) {
      descriptors.push({
        code: 'PVEN_STOP',
        message: pressureProtectionActive
          ? 'pVen below intervention range - pump stopped'
          : 'pVen critically below limit - intervention bypassed',
        priority: pressureProtectionActive ? 'high' : 'low',
        source: 'device',
        parameter: 'pVen',
      })
    } else if (circuit.pVen < device.limits.pVenAlarmLow) {
      descriptors.push({
        code: 'PVEN_INTERVENTION',
        message: pressureProtectionActive
          ? 'pVen below alarm limit - RPM intervention'
          : 'pVen below alarm limit - intervention bypassed',
        priority: pressureProtectionActive ? 'medium' : 'low',
        source: 'device',
        parameter: 'pVen',
      })
    } else if (circuit.pVen < device.limits.pVenWarningLow) {
      descriptors.push({
        code: 'PVEN_WARNING',
        message: 'pVen below warning limit',
        priority: 'low',
        source: 'device',
        parameter: 'pVen',
      })
    }

    if (circuit.pInt > device.limits.pIntAlarmHigh + 10) {
      descriptors.push({
        code: 'PINT_STOP',
        message: pressureProtectionActive
          ? 'pInt above intervention range - pump stopped'
          : 'pInt critically above limit - intervention bypassed',
        priority: pressureProtectionActive ? 'high' : 'low',
        source: 'device',
        parameter: 'pInt',
      })
    } else if (circuit.pInt > device.limits.pIntAlarmHigh) {
      descriptors.push({
        code: 'PINT_INTERVENTION',
        message: pressureProtectionActive
          ? 'pInt above alarm limit - RPM intervention'
          : 'pInt above alarm limit - intervention bypassed',
        priority: pressureProtectionActive ? 'medium' : 'low',
        source: 'device',
        parameter: 'pInt',
      })
    } else if (circuit.pInt > device.limits.pIntWarningHigh) {
      descriptors.push({
        code: 'PINT_WARNING',
        message: 'pInt above warning limit',
        priority: 'low',
        source: 'device',
        parameter: 'pInt',
      })
    }

    if (circuit.pArt > device.limits.pArtAlarmHigh + 10) {
      descriptors.push({
        code: 'PART_STOP',
        message: pressureProtectionActive
          ? 'pArt above intervention range - pump stopped'
          : 'pArt critically above limit - intervention bypassed',
        priority: pressureProtectionActive ? 'high' : 'low',
        source: 'device',
        parameter: 'pArt',
      })
    } else if (circuit.pArt > device.limits.pArtAlarmHigh) {
      descriptors.push({
        code: 'PART_INTERVENTION',
        message: pressureProtectionActive
          ? 'pArt above alarm limit - RPM intervention'
          : 'pArt above alarm limit - intervention bypassed',
        priority: pressureProtectionActive ? 'medium' : 'low',
        source: 'device',
        parameter: 'pArt',
      })
    } else if (circuit.pArt > device.limits.pArtWarningHigh) {
      descriptors.push({
        code: 'PART_WARNING',
        message: 'pArt above warning limit',
        priority: 'low',
        source: 'device',
        parameter: 'pArt',
      })
    }
  }

  if (device.powerSource === 'battery') {
    descriptors.push({
      code: device.batteryPercent < 10 ? 'BATTERY_CRITICAL' : 'BATTERY_MODE',
      message:
        device.batteryPercent < 10
          ? 'Battery below 10% - restore power now'
          : device.batteryPercent < 20
            ? 'Battery below 20%'
            : 'Mains power unavailable - battery active',
      priority: device.batteryPercent < 10 ? 'high' : device.batteryPercent < 20 ? 'medium' : 'low',
      source: 'device',
      parameter: 'Power',
    })
  }

  if (!gas.sourceConnected) {
    descriptors.push({
      code: 'GAS_SOURCE',
      message: 'Gas source interrupted',
      priority: 'high',
      source: 'gas-panel',
      parameter: 'Sweep gas',
    })
  }

  if (patient.pH < 7.2) {
    descriptors.push({
      code: 'PATIENT_ACIDEMIA',
      message: 'Independent monitor: acidemia',
      priority: 'medium',
      source: 'patient-monitor',
      parameter: 'pH',
    })
  }

  if (state.supportMode === 'va' && patient.rightRadialSpo2 < 88) {
    descriptors.push({
      code: 'RIGHT_RADIAL_LOW',
      message: 'Independent monitor: right-arm oxygenation low',
      priority: 'high',
      source: 'patient-monitor',
      parameter: 'Right radial SpO2',
    })
  }

  return descriptors.sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority])
}

function reconcileAlarms(
  state: EcmoSimulationState,
): Pick<EcmoSimulationState, 'alarms' | 'alarmHistory'> {
  const descriptors = alarmDescriptors(state)
  const previousByCode = new Map(state.alarms.map((alarm) => [alarm.code, alarm]))
  const descriptorCodes = new Set(descriptors.map((descriptor) => descriptor.code))
  const nextAlarms = descriptors.map<AlarmEvent>((descriptor) => {
    const previous = previousByCode.get(descriptor.code)
    return previous
      ? { ...previous, ...descriptor, active: true }
      : {
          ...descriptor,
          id: `${descriptor.code}-${state.simulationTime}`,
          startedAt: state.simulationTime,
          active: true,
        }
  })

  const newlyStarted = nextAlarms.filter((alarm) => !previousByCode.has(alarm.code))
  let history = state.alarmHistory.map((event) =>
    event.active && !descriptorCodes.has(event.code)
      ? { ...event, active: false, resolvedAt: state.simulationTime }
      : event,
  )
  history = [...newlyStarted, ...history].slice(0, 6)

  return { alarms: nextAlarms, alarmHistory: history }
}

/**
 * Source-module nominal pump curve for adapter reuse. This deliberately omits
 * circuit faults and safety stops, which remain the responsibility of the
 * caller's device-local state.
 */
export function calculateNominalCardiohelpBloodFlowLMin(rpm: number): number {
  if (!Number.isFinite(rpm) || rpm <= 0) return 0
  if (rpm < 200) return -0.2
  return round(clamp(rpm / 790, 0, 9.9), 2)
}

function calculateBloodFlow(state: EcmoSimulationState, rpm: number): number {
  if (
    !state.device.pumpRunning ||
    state.device.zeroFlowActive ||
    state.circuit.drainageClampClosed ||
    state.circuit.returnClampClosed ||
    rpm <= 0
  )
    return 0
  // Preserve the source simulator's low-RPM backflow branch. Returning here is
  // clinically meaningful to its six-second protection timer; fault modifiers
  // must not attenuate this sentinel flow.
  if (rpm < 200) return calculateNominalCardiohelpBloodFlowLMin(rpm)
  let flow = calculateNominalCardiohelpBloodFlowLMin(rpm)
  if (hasFault(state, 'preload-limited') || hasFault(state, 'hemorrhagic-hypovolemia')) {
    const oscillation = state.simulationTime % 4 < 2 ? -0.3 : 0.12
    flow = flow * 0.68 + oscillation
  }
  if (hasFault(state, 'tension-pneumothorax') || hasFault(state, 'tamponade')) {
    const oscillation = state.simulationTime % 4 < 2 ? -0.24 : 0.08
    flow = flow * 0.65 + oscillation
  }
  if (hasFault(state, 'return-obstruction')) flow *= 0.7
  if (hasFault(state, 'oxygenator-resistance')) flow *= 0.76
  return round(clamp(flow, -9.99, 9.99), 2)
}

/**
 * Pressure drop across the membrane lung, per litre per minute of blood flow.
 *
 * Deliberately proportional to flow with no constant term: the gradient across an oxygenator is a
 * resistance times a flow, so at zero flow it must be zero. The previous form carried a fixed
 * +50 mmHg offset, which both survived a stopped pump and put the normal circuit at a delta-p near
 * 60 mmHg — high enough that the module's own authored return-obstruction text ("delta-p need not
 * rise substantially") contradicted what the engine produced.
 *
 * Evidence boundary: bounded-educational-model. A resistance coefficient, not a device claim.
 */
const MEMBRANE_RESISTANCE_MMHG_PER_LPM = Object.freeze({
  /** Reference circuit: about 31 mmHg at 4.05 L/min. */
  reference: 7.8,
  /** Fouled or thrombosed membrane: the same relationship with a much larger coefficient. */
  elevated: 46,
})

/**
 * The pressure display range the CARDIOHELP-i supports. Values outside it are among the cases the
 * IFU says display as dashes rather than as a number (Rev 2.3 §14.8, page 201).
 */
const PRESSURE_DISPLAY_RANGE_MMHG = Object.freeze({ low: -500, high: 900 })

/** SvO₂ display range the CARDIOHELP-i supports (Rev 2.3 §14.8, page 201: 40.0-99.9%). */
const VENOUS_SATURATION_DISPLAY_RANGE = Object.freeze({ low: 40, high: 99.9 })

/**
 * Whether the pressure equations describe the current state at all.
 *
 * Deliberately narrow: it says *this model* has nothing to offer, not that the physical device
 * would read nothing. A stopped pump on a primed circuit has genuine static pressures; this
 * simulation does not model them, and saying so is more honest than reporting the zero-flow
 * intercepts of equations written for a flowing circuit.
 */
function pressuresAreModeled(
  state: EcmoSimulationState,
  device: DeviceState,
  flow: number,
): boolean {
  // A clamped line is a modelled state with a real, teachable pressure response.
  if (state.circuit.drainageClampClosed || state.circuit.returnClampClosed) return true
  return device.pumpRunning && !device.zeroFlowActive && flow > 0
}

const UNMODELED_PRESSURE_REASON =
  'Pressure response is not modeled while the pump is stopped. This is a limitation of this educational simulation, not a statement about what the device would display.'

/**
 * Builds a channel readout, keeping the raw model value intact and deciding separately whether the
 * console may render it as a number.
 */
function channelReadout(
  raw: number,
  modeled: boolean,
  range: { low: number; high: number },
  unmodeledReason: string,
  outOfRangeReason: string,
): EcmoChannelReadout {
  if (!modeled) {
    return { status: 'simulation-unmodeled', raw, displayed: null, reason: unmodeledReason }
  }
  if (raw < range.low || raw > range.high) {
    // Not clamped to the boundary and shown as measured — that would be a fabricated reading.
    return { status: 'device-unavailable', raw, displayed: null, reason: outOfRangeReason }
  }
  return { status: 'valid', raw, displayed: raw, reason: '' }
}

function calculatePressures(state: EcmoSimulationState, flow: number, rpm: number) {
  let pVen = -25 - flow * 2.4
  let pArt = 146 + flow * 16
  let pInt = pArt + flow * MEMBRANE_RESISTANCE_MMHG_PER_LPM.reference

  if (hasFault(state, 'preload-limited')) {
    pVen = -35 - Math.max(0, rpm - 2700) * 0.052
  }
  if (hasFault(state, 'hemorrhagic-hypovolemia')) {
    pVen = -45 - Math.max(0, rpm - 2700) * 0.105
  }
  if (hasFault(state, 'tension-pneumothorax') || hasFault(state, 'tamponade')) {
    pVen = -65 - Math.max(0, rpm - 2700) * 0.15
  }
  if (hasFault(state, 'return-obstruction')) {
    // Obstruction sits downstream of the membrane, so both pressures rise together and the
    // gradient across the membrane keeps tracking flow. That is the sign that separates this from
    // an oxygenator problem, and the authored scenario text says so.
    pArt = 285 + flow * 10
    pInt = pArt + flow * MEMBRANE_RESISTANCE_MMHG_PER_LPM.reference
  }
  if (hasFault(state, 'oxygenator-resistance')) {
    // The membrane itself is the resistance, so the gradient rises out of proportion to flow.
    pArt = 165 + flow * 8
    pInt = pArt + flow * MEMBRANE_RESISTANCE_MMHG_PER_LPM.elevated
  }
  if (state.circuit.drainageClampClosed && state.device.pumpRunning && rpm > 0) {
    pVen = -350
  }
  if (state.circuit.returnClampClosed && state.device.pumpRunning && rpm > 0) {
    pArt = 620
    pInt = 690
  }

  // Deliberately NOT clamped to the console's display range. A value the device could not show is
  // a display-eligibility question, decided per channel in `readouts`; clamping it here and then
  // rendering it would turn a boundary artefact into an apparent measurement.
  return {
    pVen: round(pVen, 0),
    pInt: round(pInt, 0),
    pArt: round(pArt, 0),
  }
}

function applyLpmControl(state: EcmoSimulationState): DeviceState {
  if (state.device.pumpMode !== 'lpm' || !state.circuit.flowSensorConnected) return state.device
  const error = state.device.lpmSetpoint - state.circuit.bloodFlow
  return {
    ...state.device,
    rpmSetpoint: round(clamp(state.device.rpmSetpoint + error * 55, 0, 5000), 0),
  }
}

function applyPressureIntervention(
  state: EcmoSimulationState,
  device: DeviceState,
  circuit: CircuitState,
): DeviceState {
  if (!device.pressureInterventionEnabled || device.globalOverride) return device
  const belowBy = device.limits.pVenAlarmLow - circuit.pVen
  const aboveBy = Math.max(
    circuit.pInt - device.limits.pIntAlarmHigh,
    circuit.pArt - device.limits.pArtAlarmHigh,
  )

  if (belowBy > 10 || aboveBy > 10) {
    return { ...device, pumpRunning: false }
  }
  if ((belowBy > 0 || aboveBy > 0) && device.pumpRunning) {
    return { ...device, rpmSetpoint: clamp(device.rpmSetpoint - 75, 0, 5000) }
  }
  if (
    !circuit.bubbleResetRequired &&
    !device.zeroFlowActive &&
    !circuit.drainageClampClosed &&
    !circuit.returnClampClosed &&
    device.rpmSetpoint > 0 &&
    circuit.pVen >= device.limits.pVenAlarmLow &&
    circuit.pInt <= device.limits.pIntAlarmHigh &&
    circuit.pArt <= device.limits.pArtAlarmHigh
  ) {
    return { ...device, pumpRunning: true }
  }
  return device
}

export function deriveRecirculationFraction(state: EcmoSimulationState): number {
  // VA return is arterial, so drained blood is not in series with it and the VV recirculation
  // mechanism does not apply.
  if (state.supportMode === 'va') return 0
  return hasFault(state, 'recirculation')
    ? RECIRCULATION_FRACTION.established
    : RECIRCULATION_FRACTION.baseline
}

/**
 * Circuit flow left after the immediately re-drained fraction is removed.
 *
 * Not "effective systemic flow": in VA the recirculation term is zero, so this equals displayed
 * circuit flow and says nothing about total systemic perfusion, which native cardiac output also
 * contributes to.
 */
export function deriveRecirculationAdjustedCircuitFlow(
  bloodFlow: number,
  recirculationFraction: number,
): number {
  return Math.max(0, bloodFlow * (1 - recirculationFraction))
}

/** Default educational-model inputs. Reference profiles and scenarios may author over these. */
export const DEFAULT_ECMO_MODEL_INPUTS: EcmoPhysiologyModelInputs = Object.freeze({
  oxygenConsumptionMlMin: 150,
})

const HUFNER_CONSTANT_ML_PER_G = 1.34

/**
 * Systemic mixed venous saturation, estimated from the oxygen balance rather than held constant.
 *
 * This was a frozen 68 that never moved while being displayed as a live parameter on two console
 * screens. It is **latent and estimated**: the CARDIOHELP has no sensor for it, so it is never
 * clamped to any console display range, and it is deliberately not what the SvO₂ tile shows.
 */
export function deriveSystemicVenousSaturationEstimate(
  state: EcmoSimulationState,
  recirculationAdjustedCircuitFlowLpm: number,
): number {
  const arterialSaturation =
    state.supportMode === 'va' ? state.patient.femoralArterialSpo2 : state.patient.spo2
  // In VV the circuit returns to the venous side, so systemic flow is the native output alone. In
  // VA the return is arterial and adds to it.
  const systemicFlowLpm =
    state.supportMode === 'va'
      ? state.patient.nativeCardiacOutputLpm + recirculationAdjustedCircuitFlowLpm
      : state.patient.nativeCardiacOutputLpm
  const oxygenCarryingCapacity =
    HUFNER_CONSTANT_ML_PER_G * state.circuit.hemoglobin * Math.max(systemicFlowLpm, 0.2) * 10
  const consumption =
    state.modelInputs?.oxygenConsumptionMlMin ?? DEFAULT_ECMO_MODEL_INPUTS.oxygenConsumptionMlMin
  const extractedSaturationPoints = (consumption / oxygenCarryingCapacity) * 100
  // Bounded only by what a saturation can physically be. No console range is applied here: this
  // quantity is not a console reading.
  return clamp(arterialSaturation - extractedSaturationPoints, 0, 100)
}

/**
 * Drainage (pre-oxygenator) saturation as the mixture it physically is: systemic venous return
 * diluted by whatever fraction of freshly oxygenated blood is being pulled straight back in.
 *
 * Bounded as a saturation, not as a console reading — display eligibility is decided separately.
 */
export function deriveDrainageSaturation(
  systemicVenousSaturationEstimate: number,
  postOxygenatorSaturation: number,
  recirculationFraction: number,
): number {
  return clamp(
    systemicVenousSaturationEstimate +
      recirculationFraction * (postOxygenatorSaturation - systemicVenousSaturationEstimate),
    0,
    100,
  )
}

function patientTargets(state: EcmoSimulationState, flow: number) {
  const gasAvailable = state.gas.sourceConnected && state.gas.sweepLpm > 0
  const recirculationAdjustedFlow = deriveRecirculationAdjustedCircuitFlow(
    flow,
    deriveRecirculationFraction(state),
  )
  const oxygenatorContribution = gasAvailable ? recirculationAdjustedFlow * state.gas.fio2 : 0
  let targetSpo2 = 82 + oxygenatorContribution * 4
  let targetPaCO2 = gasAvailable ? 76 - state.gas.sweepLpm * 7.5 : 90

  if (hasFault(state, 'acute-hypercapnia'))
    targetPaCO2 = gasAvailable ? 78 - state.gas.sweepLpm * 8 : 94
  if (hasFault(state, 'compensated-hypercapnia')) {
    targetPaCO2 = state.gas.sweepLpm === 0 ? 64 : 72 - state.gas.sweepLpm * 4
  }
  // Recirculation reaches arterial saturation through effective flow above, and only there. It
  // used to be charged a second time here as a flat penalty, so the same fault was counted twice.
  if (hasFault(state, 'gas-source-interruption')) targetSpo2 = 82
  if (hasFault(state, 'oxygenator-resistance')) targetSpo2 -= 8
  if (hasFault(state, 'ecmo-not-initiated')) {
    targetSpo2 = state.supportMode === 'va' ? 82 : 74
    targetPaCO2 = state.supportMode === 'va' ? 58 : 76
  }

  let rightRadialSpo2 = targetSpo2
  let femoralArterialSpo2 = targetSpo2

  if (state.supportMode === 'va') {
    const supportNotStarted = hasFault(state, 'ecmo-not-initiated')
    femoralArterialSpo2 = supportNotStarted ? 82 : gasAvailable ? 98.5 : 78
    rightRadialSpo2 = supportNotStarted
      ? 82
      : hasFault(state, 'differential-hypoxemia')
        ? 82
        : gasAvailable
          ? 96
          : 80
    targetSpo2 = rightRadialSpo2
  }

  return {
    spo2: clamp(targetSpo2, 65, 100),
    rightRadialSpo2: clamp(rightRadialSpo2, 65, 100),
    femoralArterialSpo2: clamp(femoralArterialSpo2, 65, 100),
    paCO2: clamp(targetPaCO2, 20, 100),
  }
}

function derivePatient(state: EcmoSimulationState, flow: number): PatientState {
  const targets = patientTargets(state, flow)
  const paCO2 = round(moveToward(state.patient.paCO2, targets.paCO2, 1.4), 1)
  const spo2 = round(moveToward(state.patient.spo2, targets.spo2, 0.7), 1)
  const rightRadialSpo2 = round(
    moveToward(state.patient.rightRadialSpo2, targets.rightRadialSpo2, 0.7),
    1,
  )
  const femoralArterialSpo2 = round(
    moveToward(state.patient.femoralArterialSpo2, targets.femoralArterialSpo2, 0.7),
    1,
  )
  const pH = round(
    clamp(6.1 + Math.log10(state.patient.bicarbonate / (0.03 * Math.max(paCO2, 1))), 6.8, 7.7),
    2,
  )
  const workOfBreathing =
    state.supportMode === 'vv' && state.gas.sweepLpm === 0 && state.simulationTime >= 20
      ? paCO2 > 55
        ? 'high'
        : 'moderate'
      : state.patient.workOfBreathing
  const lvLoading = state.supportMode === 'va' && hasFault(state, 'lv-loading')
  const nativeCardiacOutputLpm = round(
    moveToward(
      state.patient.nativeCardiacOutputLpm,
      state.supportMode === 'va' ? (lvLoading ? 0.8 : 2.4) : 4.5,
      0.15,
    ),
    1,
  )
  const pulsePressure = round(
    moveToward(
      state.patient.pulsePressure,
      state.supportMode === 'va' ? (lvLoading ? 5 : 18) : 35,
      2,
    ),
    0,
  )
  let targetMap =
    state.supportMode === 'va' ? clamp(55 + flow * 4, 60, 80) : state.patient.meanArterialPressure
  if (hasFault(state, 'hemorrhagic-hypovolemia')) targetMap = 46
  if (hasFault(state, 'tension-pneumothorax')) targetMap = 42
  if (hasFault(state, 'tamponade')) targetMap = 40
  if (hasFault(state, 'vasoplegia')) targetMap = 48
  if (hasFault(state, 'ecmo-not-initiated')) targetMap = state.supportMode === 'va' ? 38 : 68
  const meanArterialPressure = round(
    moveToward(state.patient.meanArterialPressure, targetMap, 1.2),
    0,
  )
  const shockFault =
    hasFault(state, 'hemorrhagic-hypovolemia') ||
    hasFault(state, 'tension-pneumothorax') ||
    hasFault(state, 'tamponade') ||
    hasFault(state, 'vasoplegia') ||
    (hasFault(state, 'ecmo-not-initiated') && state.supportMode === 'va')
  const targetCvp = hasFault(state, 'hemorrhagic-hypovolemia')
    ? 2
    : hasFault(state, 'tension-pneumothorax')
      ? 20
      : hasFault(state, 'tamponade')
        ? 22
        : 8
  const targetLactate = shockFault ? 8 : 1.8
  const targetUrineOutput = shockFault ? 8 : 50

  return {
    ...state.patient,
    paCO2,
    spo2,
    rightRadialSpo2,
    femoralArterialSpo2,
    pH,
    workOfBreathing,
    respiratoryRate: workOfBreathing === 'high' ? 32 : workOfBreathing === 'moderate' ? 24 : 18,
    meanArterialPressure,
    pulsePressure,
    nativeCardiacOutputLpm,
    aorticValveOpening: state.supportMode === 'va' ? !lvLoading : true,
    pulmonaryCongestion: state.supportMode === 'va' ? (lvLoading ? 'marked' : 'mild') : 'none',
    centralVenousPressure: round(
      moveToward(state.patient.centralVenousPressure, targetCvp, 0.8),
      0,
    ),
    lactate: round(moveToward(state.patient.lactate, targetLactate, 0.12), 1),
    urineOutputMlHr: round(moveToward(state.patient.urineOutputMlHr, targetUrineOutput, 2), 0),
    airwayPressure: round(
      moveToward(
        state.patient.airwayPressure,
        hasFault(state, 'tension-pneumothorax') ? 40 : 24,
        1,
      ),
      0,
    ),
    lungSliding: hasFault(state, 'tension-pneumothorax')
      ? state.patient.lungSliding === 'absent-left'
        ? 'absent-left'
        : 'absent-right'
      : 'bilateral',
    distalLimbPerfusion: hasFault(state, 'distal-limb-ischemia')
      ? state.patient.distalLimbPerfusion === 'critical'
        ? 'critical'
        : 'threatened'
      : 'normal',
    distalLimbNirs: round(
      moveToward(
        state.patient.distalLimbNirs,
        hasFault(state, 'distal-limb-ischemia') ? 28 : 68,
        1.5,
      ),
      0,
    ),
  }
}

export function deriveSimulation(state: EcmoSimulationState): EcmoSimulationState {
  let device = applyLpmControl(state)
  const clinicalSupportInactive =
    state.scenario.clinical !== null && state.scenario.clinical.supportStatus !== 'on-ecmo'
  if (clinicalSupportInactive) device = { ...device, pumpRunning: false }

  if (device.pumpMode === 'lpm' && !state.circuit.flowSensorConnected) {
    device = { ...device, pumpMode: 'rpm', displayedSetpoint: device.rpmSetpoint }
  }

  if (device.powerSource === 'battery') {
    device = { ...device, batteryPercent: round(clamp(device.batteryPercent - 0.35, 0, 100), 1) }
  }

  let flow = calculateBloodFlow({ ...state, device }, device.rpmSetpoint)
  const isNewClockSample = state.simulationTime > (state.trends.at(-1)?.time ?? -1)
  const backflowSeconds =
    device.zeroFlowActive && state.circuit.backflowSeconds >= 6
      ? state.circuit.backflowSeconds
      : flow < -0.1
        ? state.circuit.backflowSeconds + (isNewClockSample ? 1 : 0)
        : 0
  if (backflowSeconds >= 6 && !device.zeroFlowActive && !device.globalOverride) {
    device = { ...device, zeroFlowActive: true }
    flow = 0
  }
  const pressures = calculatePressures(state, flow, device.zeroFlowActive ? 0 : device.rpmSetpoint)
  const pressuresModeled = pressuresAreModeled(state, device, flow)
  const recirculationFraction = deriveRecirculationFraction(state)
  const recirculationAdjustedCircuitFlowLpm = deriveRecirculationAdjustedCircuitFlow(
    flow,
    recirculationFraction,
  )
  const systemicVenousSaturationEstimate = deriveSystemicVenousSaturationEstimate(
    state,
    recirculationAdjustedCircuitFlowLpm,
  )
  const postOxygenatorSaturation = hasFault(state, 'oxygenator-resistance')
    ? 88
    : state.gas.sourceConnected
      ? round(96 + state.gas.fio2 * 3, 1)
      : 72
  const deltaP = round(pressures.pInt - pressures.pArt, 0)
  const venousLineSaturation = round(
    deriveDrainageSaturation(
      systemicVenousSaturationEstimate,
      postOxygenatorSaturation,
      recirculationFraction,
    ),
    1,
  )
  const pressureRangeReason =
    'Value is outside the pressure range this console displays, so it shows the unavailable indication instead.'
  let circuit: CircuitState = {
    ...state.circuit,
    ...pressures,
    bloodFlow: flow,
    backflowSeconds,
    deltaP,
    recirculationFraction: round(recirculationFraction, 3),
    recirculationAdjustedCircuitFlowLpm: round(recirculationAdjustedCircuitFlowLpm, 2),
    readouts: {
      pVen: channelReadout(
        pressures.pVen,
        pressuresModeled,
        PRESSURE_DISPLAY_RANGE_MMHG,
        UNMODELED_PRESSURE_REASON,
        pressureRangeReason,
      ),
      pInt: channelReadout(
        pressures.pInt,
        pressuresModeled,
        PRESSURE_DISPLAY_RANGE_MMHG,
        UNMODELED_PRESSURE_REASON,
        pressureRangeReason,
      ),
      pArt: channelReadout(
        pressures.pArt,
        pressuresModeled,
        PRESSURE_DISPLAY_RANGE_MMHG,
        UNMODELED_PRESSURE_REASON,
        pressureRangeReason,
      ),
      deltaP: channelReadout(
        deltaP,
        pressuresModeled,
        PRESSURE_DISPLAY_RANGE_MMHG,
        UNMODELED_PRESSURE_REASON,
        pressureRangeReason,
      ),
      venousLineSaturation: channelReadout(
        venousLineSaturation,
        true,
        VENOUS_SATURATION_DISPLAY_RANGE,
        '',
        'Venous saturation is outside the range this console displays, so it shows the unavailable indication instead.',
      ),
    },
    drainageChatter:
      (hasFault(state, 'preload-limited') ||
        hasFault(state, 'hemorrhagic-hypovolemia') ||
        hasFault(state, 'tension-pneumothorax') ||
        hasFault(state, 'tamponade')) &&
      pressures.pVen < -75,
    preOxygenatorSaturation: venousLineSaturation,
    postOxygenatorSaturation,
    hemoglobin: round(
      moveToward(
        state.circuit.hemoglobin,
        hasFault(state, 'hemorrhagic-hypovolemia') ? 6 : Math.max(9, state.circuit.hemoglobin),
        hasFault(state, 'hemorrhagic-hypovolemia') ? 0.12 : 0.05,
      ),
      1,
    ),
  }

  device = applyPressureIntervention(state, device, circuit)
  if (clinicalSupportInactive) device = { ...device, pumpRunning: false }
  if (!device.pumpRunning && flow !== 0) {
    flow = 0
    circuit = { ...circuit, bloodFlow: 0 }
  }

  const derived = derivePatient({ ...state, device, circuit }, flow)
  // Latent, estimated, and kept on the patient rather than the circuit so it can never be mistaken
  // for the console's venous-probe reading.
  const patient: PatientState = {
    ...derived,
    systemicVenousSaturationEstimate: round(systemicVenousSaturationEstimate, 1),
  }
  const intermediate: EcmoSimulationState = { ...state, device, circuit, patient }
  const reconciled = reconcileAlarms(intermediate)
  const trend: TrendSample = {
    time: intermediate.simulationTime,
    flow: circuit.bloodFlow,
    pVen: circuit.pVen,
    pInt: circuit.pInt,
    pArt: circuit.pArt,
    deltaP: circuit.deltaP,
    paCO2: patient.paCO2,
    spo2: state.supportMode === 'va' ? patient.rightRadialSpo2 : patient.spo2,
    map: patient.meanArterialPressure,
    lactate: patient.lactate,
  }

  return {
    ...intermediate,
    ...reconciled,
    trends: [...state.trends, trend].slice(-MAX_TREND_SAMPLES),
  }
}
