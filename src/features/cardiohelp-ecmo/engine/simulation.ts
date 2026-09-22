import { cardiohelpScenarioById, cardiohelpScenarios } from '../content/scenarios'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import { ecmoReferenceProfiles, type EcmoReferenceProfileId } from '../content/referenceProfiles'
import { OXYGEN_CARRIED_PER_GRAM_HEMOGLOBIN } from '../content/oxygenDeliveryArithmetic'
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
  PatientFieldAnchor,
  PatientState,
  RateLimitedPatientField,
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

/**
 * How sharply effective flow gives way as the circuit is asked for more than the case opened with.
 *
 * The share is not authored directly. What is authored is the flow left after re-drainage, as a
 * power of the flow demanded:
 *
 *   effective(Q) = effective(Q₀) · (Q₀ / Q)^(exponent − 1)
 *
 * so the share follows as `1 − effective(Q)/Q`. At an exponent of 1 this would say speed buys you
 * nothing; above 1 it says the stronger and clinically recognised thing — that pulling harder on a
 * circuit already re-draining its own return recruits more of that return than it recruits systemic
 * venous blood, so the support reaching the patient falls.
 *
 * Chosen in this form rather than as a subtracted penalty because the bound is then structural. The
 * share approaches 1 only as demanded flow approaches infinity and effective flow approaches zero
 * without reaching it, so no ceiling has to be imposed on the fraction. An imposed ceiling was the
 * first form of this model and it was wrong: once the fraction pinned at its maximum, effective flow
 * became a fixed multiple of demanded flow and started rising with speed again — the exact defect
 * this model exists to remove, reappearing at the top of the range for any case authored at a low
 * enough opening speed.
 *
 * Evidence boundary: bounded-educational-model. A teaching coefficient, not a measured entrainment
 * ratio, and not a number to carry to a bedside circuit.
 */
const RECIRCULATION_DEMAND_EXPONENT = 2

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
 * A reference circuit carries no prediction: showing a teaching model never invents an answer.
 */
function createReferenceRuntime(profileId: string): ScenarioRuntime {
  return {
    activityStarted: false,
    historySerial: 1,
    scenarioId: profileId,
    family: 'orientation',
    baselineRpmSetpoint:
      ecmoReferenceProfiles[profileId as EcmoReferenceProfileId].inputs.rpmSetpoint,
    // A reference circuit carries no drainage-limited fault, so it never needs a capacity.
    drainageCapacityLpm: null,
    // The circuit is there to be read, not acted on toward a scored goal.
    phase: 'act',
    activeFaults: [],
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
    clinical: null,
  }
}

function createScenarioRuntime(definition: ScenarioDefinition): ScenarioRuntime {
  return {
    activityStarted: false,
    historySerial: 1,
    scenarioId: definition.id,
    family: definition.family,
    baselineRpmSetpoint:
      definition.initialState.device?.rpmSetpoint ?? defaultDeviceState.rpmSetpoint,
    // Captured at load beside the opening speed, and never moved by anything the learner does.
    drainageCapacityLpm: definition.drainageCapacityLpm ?? null,
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
    sweepStoppedAt:
      (definition.initialState.gas?.sweepLpm ?? defaultGasState.sweepLpm) === 0 ? 0 : null,
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

  // No seeded sample. `defaultCircuitState.readouts` is a placeholder taken from a flowing circuit
  // so the shape is complete before the first derivation; recording it would write a reference
  // circuit's pressures into t=0 of a scenario that starts with the pump stopped. The derivation
  // below writes the first sample from state that has actually been computed.
  return settleLoadedState(
    { ...base, trends: [] },
    {
      patientFields: Object.keys(definition.initialState.patient ?? {}),
      postOxygenatorSaturation:
        definition.initialState.circuit?.postOxygenatorSaturation !== undefined,
    },
    // The cases that present an authored patient: the clinical Practice cases and the two
    // integrated cases. Learn drills and reference circuits are teaching previews of the engine's
    // own relationships and carry no ownership record.
    definition.clinicalCase || definition.challengeBrief
      ? definition.expectation.correctiveFault
      : null,
  )
}

/**
 * The one derivation a freshly loaded state receives (ECMO-FELLOW-02).
 *
 * Three rules, applied in order, and nothing else:
 *
 * 1. **Loading is not a second of the clock.** The patient is exactly what the case authored at
 *    t = 0. It used to be advanced one rate-limited step by this derivation, so a brief reading
 *    MAP 46, CVP 20 and pulse pressure 6 opened on a monitor reading 45, 21 and 8.
 * 2. **A value nobody authored starts where the model puts it.** A patient field the scenario does
 *    not author used to inherit the VV default patient and drift from there — PaCO₂ 42 → 46 in the
 *    first three seconds of every case, and a VA case opening on the VV default's pulse pressure 35,
 *    native output 4.5 and saturations of 93. There is no authored value to preserve, so the field
 *    starts at the model's own target for the opening state and has nothing to drift from. Same for
 *    the membrane outlet saturation. In VV the patient's saturation and its two regional readings are
 *    one quantity, and in VA the headline saturation is the right-arm reading, so an authored value
 *    for one seeds the other rather than being settled independently.
 * 3. **A clinical case owns what it authored.** Its authored rate-limited values are recorded as
 *    anchors (see `resolvePatientTargets`), so the generic relationships move them only by what
 *    changes after load.
 */
function settleLoadedState(
  base: EcmoSimulationState,
  authored: {
    readonly patientFields: readonly string[]
    readonly postOxygenatorSaturation: boolean
  },
  presentingFault: FaultId | null,
): EcmoSimulationState {
  const authoredFields = new Set(authored.patientFields)
  const aliases: Partial<Record<RateLimitedPatientField, RateLimitedPatientField>> =
    base.supportMode === 'vv'
      ? { rightRadialSpo2: 'spo2', femoralArterialSpo2: 'spo2' }
      : { spo2: 'rightRadialSpo2', rightRadialSpo2: 'spo2' }
  const seeded: Partial<PatientState> = {}
  for (const [field, source] of Object.entries(aliases) as [
    RateLimitedPatientField,
    RateLimitedPatientField,
  ][]) {
    if (!authoredFields.has(field) && authoredFields.has(source)) {
      seeded[field] = base.patient[source]
      authoredFields.add(field)
    }
  }
  const loaded = deriveSimulation(
    { ...base, patient: { ...base.patient, ...seeded } },
    { advancePatient: false, atLoad: true },
  )

  const loadGeneric = genericPatientTargets(loaded, loaded.circuit.bloodFlow)
  const loadStory = faultPatientTargets(loaded.supportMode, loaded.scenario.activeFaults)
  const settledPatient: Partial<PatientState> = {}
  for (const field of RATE_LIMITED_PATIENT_FIELDS) {
    // A field an active fault's story is moving keeps its default: the story moves it from there.
    // The gas case's saturation "initially remains near baseline" and falls later; the tension
    // case's urine output falls with the shock. Settling those would erase the story.
    if (authoredFields.has(field) || loadStory[field] !== undefined) continue
    settledPatient[field] = round(loadGeneric[field], PATIENT_FIELD_DYNAMICS[field].places)
  }
  const patient = { ...loaded.patient, ...settledPatient }
  // Respiratory rate follows work of breathing only when the scenario did not author a rate. An
  // authored "high" work of breathing beside the default patient's rate of 18 is a combination no
  // case described (the VA hypercapnia drill's stem reads 32).
  if (!authoredFields.has('respiratoryRate')) {
    patient.respiratoryRate = RESPIRATORY_RATE_BY_WORK_OF_BREATHING[patient.workOfBreathing]
  }
  // pH is arithmetic on bicarbonate and PaCO₂. A scenario that authors pH and PaCO₂ but not
  // bicarbonate implies the bicarbonate that makes its own pH true; without it the first tick
  // recomputed the authored pH from the default bicarbonate — upward, on a patient getting worse.
  if (authoredFields.has('pH') && !authoredFields.has('bicarbonate')) {
    patient.bicarbonate = round(0.03 * patient.paCO2 * 10 ** (patient.pH - 6.1), 2)
  } else if (!authoredFields.has('pH')) {
    patient.pH = round(
      clamp(6.1 + Math.log10(patient.bicarbonate / (0.03 * Math.max(patient.paCO2, 1))), 6.8, 7.7),
      2,
    )
  }
  let settled: EcmoSimulationState = deriveSimulation(
    { ...loaded, patient },
    { advancePatient: false, atLoad: true },
  )
  settled = {
    ...settled,
    scenario: {
      ...settled.scenario,
      bicarbonateSource: authoredFields.has('bicarbonate')
        ? 'case-supplied'
        : authoredFields.has('pH')
          ? 'calculated'
          : 'model-default',
    },
  }
  if (!authored.postOxygenatorSaturation) {
    const postOxygenatorSaturation = round(
      derivePostOxygenatorTarget(settled, settled.patient.systemicVenousSaturationEstimate),
      1,
    )
    settled = deriveSimulation(
      { ...settled, circuit: { ...settled.circuit, postOxygenatorSaturation } },
      { advancePatient: false, atLoad: true },
    )
  }

  if (!presentingFault || !hasFault(settled, presentingFault)) return settled
  const generic = genericPatientTargets(settled, settled.circuit.bloodFlow)
  /*
   * A case that opens with support interrupted — the pump not turning, or no sweep gas reaching the
   * membrane — has authored the moment of interruption, and the loss of support is an event the
   * model does represent. There the patient may still move toward the model's no-support value, if
   * that is worse: the VV air case's saturation is "84% and falling off support", the gas case's
   * CO₂ is still accumulating. Nowhere does an untreated patient drift toward a better value, and
   * where support is running the authored values simply hold: a case whose brief says the values
   * sit where the team wants them no longer climbs away from them on its own.
   */
  const supportInterrupted =
    !settled.device.pumpRunning ||
    settled.circuit.bloodFlow <= 0 ||
    !(settled.gas.sourceConnected && settled.gas.sweepLpm > 0)
  const anchors: Partial<Record<RateLimitedPatientField, PatientFieldAnchor>> = {}
  for (const field of RATE_LIMITED_PATIENT_FIELDS) {
    if (!authoredFields.has(field)) continue
    const authoredValue = settled.patient[field]
    const better = supportInterrupted ? PATIENT_FIELD_DYNAMICS[field].better : undefined
    const level =
      better === 'higher'
        ? Math.min(authoredValue, generic[field])
        : better === 'lower'
          ? Math.max(authoredValue, generic[field])
          : authoredValue
    anchors[field] = {
      level,
      reference: generic[field],
      source: 'case-authored',
      setAt: settled.simulationTime,
    }
  }
  const postOxygenator = authored.postOxygenatorSaturation
    ? {
        level: settled.circuit.postOxygenatorSaturation,
        reference: derivePostOxygenatorTarget(
          settled,
          settled.patient.systemicVenousSaturationEstimate,
        ),
      }
    : undefined
  return {
    ...settled,
    scenario: {
      ...settled.scenario,
      patientOwnership: { presentingFault, anchors, ...(postOxygenator ? { postOxygenator } : {}) },
    },
  }
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

  // No seeded sample, for the same reason as `createInitialSimulationState`: the first trend frame
  // is written by the derivation below, from pressures this profile actually produced rather than
  // from the placeholder readouts on `defaultCircuitState`.
  return settleLoadedState(
    { ...base, trends: [] },
    { patientFields: Object.keys(profile.inputs.patient), postOxygenatorSaturation: false },
    null,
  )
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
  //
  // Each block is keyed on its own channel. The four channels share one `pressuresModeled` flag
  // today, so this is behaviour-identical; keying pInt and pArt off pVen's status was a coupling
  // waiting to mislead the first time a channel could go unavailable on its own.
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
  }

  if (circuit.readouts.pInt.status === 'valid') {
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
  }

  if (circuit.readouts.pArt.status === 'valid') {
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
    // The reading, not the fault: this line reaches the console status bar before the gas-path
    // drills' prediction, where "Gas source interrupted" was the answer stated as an alarm.
    descriptors.push({
      code: 'GAS_SOURCE',
      message: 'Sweep gas delivered below set flow',
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

/**
 * The faults that model a circuit asking for more venous drainage than the patient can supply.
 *
 * They differ in why drainage is short — volume, a collapsing vessel or cannula, obstructive
 * physiology holding venous return out of the chest — but they share the shape that matters: past
 * some flow the circuit cannot get more, and pulling harder makes the suction worse rather than the
 * support better. That shape is what the module teaches, so it is modelled once.
 *
 * Evidence boundary: bounded-educational-model. These are teaching quantities and not thresholds.
 */
export const DRAINAGE_CAPACITY_LPM = Object.freeze({
  'preload-limited': 3.5,
  'hemorrhagic-hypovolemia': 3.3,
  'tension-pneumothorax': 3.1,
  tamponade: 3.1,
} as const)

const DRAINAGE_LIMITED_FAULTS = Object.keys(DRAINAGE_CAPACITY_LPM) as readonly (
  | 'preload-limited'
  | 'hemorrhagic-hypovolemia'
  | 'tension-pneumothorax'
  | 'tamponade'
)[]

/**
 * How the circuit behaves past its drainage capacity.
 *
 * `collapsePerExcessLpm` is the whole correction. The model used to multiply the pump curve by a
 * constant, which left flow — and, through it, the modelled patient's saturation — rising with every
 * extra revolution while the reducer charged a critical error for exactly that. Delivered flow now
 * *falls* as demand climbs past what the drainage can give, so the display and the safety guard
 * finally say the same thing.
 *
 * `minimumFraction` is a floor rather than a physiological claim: it keeps the relationship bounded
 * at speeds no authored case reaches.
 */
const DRAINAGE_COLLAPSE = Object.freeze({
  collapsePerExcessLpm: 0.35,
  minimumFraction: 0.55,
  /** Suction per L/min of unmet demand, by fault. */
  suctionMmHgPerExcessLpm: Object.freeze({
    'preload-limited': 42,
    'hemorrhagic-hypovolemia': 75,
    'tension-pneumothorax': 79,
    tamponade: 79,
  } as const),
  /** Drainage pressure at the capacity point, by fault. */
  suctionBaseMmHg: Object.freeze({
    'preload-limited': -35,
    'hemorrhagic-hypovolemia': -45,
    'tension-pneumothorax': -65,
    tamponade: -65,
  } as const),
})

interface DrainageLimitation {
  readonly fault: (typeof DRAINAGE_LIMITED_FAULTS)[number]
  readonly capacityLpm: number
  readonly demandedLpm: number
  /** How much more the pump is asking for than the drainage can give. Zero when within capacity. */
  readonly excessLpm: number
  readonly limited: boolean
}

/**
 * The drainage limitation in force at a given speed, or `null` when no such fault is active.
 *
 * The capacity comes from the case when the case authored one, and otherwise from the fault. Where
 * more than one such fault is active the tightest capacity wins, because the circuit is limited by
 * whichever constraint binds first.
 */
export function resolveDrainageLimitation(
  state: EcmoSimulationState,
  rpm: number,
): DrainageLimitation | null {
  let tightest: DrainageLimitation | null = null
  for (const fault of DRAINAGE_LIMITED_FAULTS) {
    if (!hasFault(state, fault)) continue
    const capacityLpm = state.scenario.drainageCapacityLpm ?? DRAINAGE_CAPACITY_LPM[fault]
    if (tightest && tightest.capacityLpm <= capacityLpm) continue
    const demandedLpm = calculateNominalCardiohelpBloodFlowLMin(rpm)
    const excessLpm = Math.max(0, demandedLpm - capacityLpm)
    tightest = { fault, capacityLpm, demandedLpm, excessLpm, limited: excessLpm > 0 }
  }
  return tightest
}

/** Flow actually delivered against a drainage limitation. Never rises once demand passes capacity. */
function drainageLimitedFlow(limitation: DrainageLimitation): number {
  if (!limitation.limited) return limitation.demandedLpm
  const collapsed =
    limitation.capacityLpm - DRAINAGE_COLLAPSE.collapsePerExcessLpm * limitation.excessLpm
  return Math.max(collapsed, limitation.capacityLpm * DRAINAGE_COLLAPSE.minimumFraction)
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
  const drainage = resolveDrainageLimitation(state, rpm)
  if (drainage) {
    flow = drainageLimitedFlow(drainage)
    // Instability is a consequence of being past capacity, not of the fault existing. Within the
    // drainage the circuit can supply there is nothing intermittently drawing shut, so there is
    // nothing for the flow to swing about.
    if (drainage.limited) flow += state.simulationTime % 4 < 2 ? -0.3 : 0.12
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
  // A clamped line is a modelled state with a real, teachable pressure response — but only while
  // the pump is turning against it. `calculatePressures` applies the clamp overrides under exactly
  // that condition, so once the pump stops the equations fall back to the zero-flow intercepts of a
  // flowing circuit. Reporting those as valid because a clamp happens to be closed would mean
  // closing a clamp could turn an unmodeled pressure into a modeled one, which it cannot.
  const pumpTurning = device.pumpRunning && !device.zeroFlowActive && device.rpmSetpoint > 0
  if ((state.circuit.drainageClampClosed || state.circuit.returnClampClosed) && pumpTurning) {
    return true
  }
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

  /*
   * Suction is driven by unmet demand, not by the raw speed.
   *
   * The previous form keyed off `rpm - 2700`, a constant with no relationship to what this
   * particular patient can drain. Reading it off the shortfall instead is what makes the whole
   * pattern move together: past capacity the pump pulls harder, pVen falls further, the line
   * judders, and delivered flow drops — and backing the speed off relieves all four at once.
   */
  const drainage = resolveDrainageLimitation(state, rpm)
  if (drainage) {
    pVen =
      DRAINAGE_COLLAPSE.suctionBaseMmHg[drainage.fault] -
      DRAINAGE_COLLAPSE.suctionMmHgPerExcessLpm[drainage.fault] * drainage.excessLpm
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

/**
 * The device's protective interlock. Deliberately reads the raw model pressures, not the readouts.
 *
 * This is not a display: nothing here is shown to a learner, so the rule that an uninterpretable
 * channel must not be rendered does not apply. The restart branch below is the load-bearing case —
 * it is only ever evaluated on a stopped circuit, where every channel is by definition unmodeled,
 * so gating it on readout status would latch the pump off permanently and make every pressure stop
 * unrecoverable.
 *
 * Known consequence, left as-is because changing it is engine behaviour rather than display
 * truthfulness: with learner-adjusted limits the first two branches can hold the pump off using
 * intercepts the alarm surface has (correctly) suppressed, so the learner sees a stopped pump and
 * `--` on every pressure with no alarm saying why.
 */
function applyPressureIntervention(
  state: EcmoSimulationState,
  device: DeviceState,
  circuit: CircuitState,
  clockAdvanced: boolean,
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
  // The protective stop above acts on any recomputation, as it always has on the clamp path: a
  // circuit asked for more than the interlock allows stops in the second it is asked. The speed trim
  // and the automatic restart below are per-second processes and step with the clock
  // (ECMO-FELLOW-02), so a setpoint change is a request the model acts on at the next second — the
  // orientation tours' settling step depends on exactly that.
  if ((belowBy > 0 || aboveBy > 0) && device.pumpRunning) {
    return clockAdvanced
      ? { ...device, rpmSetpoint: clamp(device.rpmSetpoint - 75, 0, 5000) }
      : device
  }
  if (
    clockAdvanced &&
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

/**
 * Why the pump is not turning, read from the state that stopped it.
 *
 * C3-1 in the September 2026 walkthrough: escalating the speed on the tension-pneumothorax case
 * left a console reading 4,000 rpm beside 0.00 L/min, four dashed pressure channels and "No active
 * alarm". Every one of those is correct on its own. `applyPressureIntervention` stopped the pump
 * and deliberately did not zero the speed the learner had asked for; with no flow the pressure
 * equations have nothing to report, so the channels go unavailable; and the pressure alarms are
 * keyed on a reporting channel, so they clear with it. What was missing was anyone saying that the
 * model had stopped the pump, which left the speed on screen reading like a rotating one.
 *
 * This is a selector, not a new interlock: it re-reads the conditions the interlock already
 * evaluates and puts them into a sentence. It names the model's own protection event as the
 * model's, invents no CARDIOHELP alarm code or priority, and prints no pressure number — the
 * channels are unavailable precisely because this model has no value it can stand behind there.
 */
export type PumpStopCause =
  | 'running'
  | 'support-not-started'
  | 'bubble-intervention'
  | 'pressure-protection'
  | 'zero-flow-control'
  | 'speed-at-zero'
  | 'clamped'
  | 'stopped'

export interface PumpStopExplanation {
  readonly cause: PumpStopCause
  readonly running: boolean
  /** Short label for a status chip. */
  readonly label: string
  /** The learner-facing sentence. Empty while the pump is turning. */
  readonly detail: string
}

export function resolvePumpStopExplanation(state: EcmoSimulationState): PumpStopExplanation {
  const { device, circuit } = state
  if (device.pumpRunning && !device.zeroFlowActive && device.rpmSetpoint > 0) {
    return { cause: 'running', running: true, label: 'Pump running', detail: '' }
  }
  const clinical = state.scenario.clinical
  if (clinical && clinical.supportStatus !== 'on-ecmo') {
    return {
      cause: 'support-not-started',
      running: false,
      label: 'Support not started',
      detail:
        'Support has not been started in this case, so the speed shown is the setting the console is holding rather than a speed the pump is turning at.',
    }
  }
  if (circuit.arterialBubbleDetected && circuit.bubbleResetRequired) {
    return {
      cause: 'bubble-intervention',
      running: false,
      label: 'Stopped by the bubble intervention',
      detail:
        'The simulated bubble intervention has stopped the pump. The speed shown is the setting the console is holding, not a speed the pump is turning at.',
    }
  }
  if (device.zeroFlowActive) {
    return {
      cause: 'zero-flow-control',
      running: false,
      label: 'Zero-flow control active',
      detail:
        'The zero-flow control is active, so no forward flow is produced. The speed shown is the setting the console is holding.',
    }
  }
  if (device.rpmSetpoint <= 0) {
    return {
      cause: 'speed-at-zero',
      running: false,
      label: 'Speed at zero',
      detail: 'The speed setting is zero, so there is no forward flow to report.',
    }
  }
  if (!device.pumpRunning && device.pressureInterventionEnabled && !device.globalOverride) {
    const belowBy = device.limits.pVenAlarmLow - circuit.pVen
    const aboveInt = circuit.pInt - device.limits.pIntAlarmHigh
    const aboveArt = circuit.pArt - device.limits.pArtAlarmHigh
    const channel =
      belowBy > 10
        ? 'drainage (pVen)'
        : aboveInt > 10
          ? 'pre-oxygenator (pInt)'
          : aboveArt > 10
            ? 'return (pArt)'
            : null
    if (channel) {
      return {
        cause: 'pressure-protection',
        running: false,
        label: "Stopped by this model's pressure protection",
        detail: `This simulation's pressure interlock has stopped the pump: the modeled ${channel} pressure went past its alarm limit. The speed shown is the setting the console is holding, not a speed the pump is turning at. Pressure values calculated before the stop can remain visible until the next model update. The stopped-pump channels then read as unavailable; the retained values are not new pressure measurements. What a CARDIOHELP itself does in this state, and with what alarm, is outside what this module represents.`,
      }
    }
  }
  if (circuit.drainageClampClosed || circuit.returnClampClosed) {
    return {
      cause: 'clamped',
      running: false,
      label: 'Circuit clamped',
      detail:
        'A near-patient clamp is closed, so there is no forward flow. The speed shown is the setting the console is holding.',
    }
  }
  return {
    cause: 'stopped',
    running: false,
    label: 'Pump stopped',
    detail:
      'The pump is stopped in this model. The speed shown is the setting the console is holding, not a speed the pump is turning at.',
  }
}

export function deriveRecirculationFraction(state: EcmoSimulationState): number {
  // VA return is arterial, so drained blood is not in series with it and the VV recirculation
  // mechanism does not apply.
  if (state.supportMode === 'va') return 0
  if (!hasFault(state, 'recirculation')) return RECIRCULATION_FRACTION.baseline

  // Established recirculation is a relationship between the cannulae, so the case authors its
  // starting share. What the learner controls is how hard the circuit pulls against it.
  const baselineRpm = state.scenario.baselineRpmSetpoint
  const rpm = state.device.rpmSetpoint
  if (!Number.isFinite(rpm) || rpm <= baselineRpm) return RECIRCULATION_FRACTION.established

  // Nominal, rpm-derived flow on both sides rather than the circuit's computed flow: the fraction is
  // an input to the flow calculation's consumers, and reading the output back in would make the
  // relationship circular.
  const baselineFlow = calculateNominalCardiohelpBloodFlowLMin(baselineRpm)
  const demandedFlow = calculateNominalCardiohelpBloodFlowLMin(rpm)
  if (baselineFlow <= 0 || demandedFlow <= 0) return RECIRCULATION_FRACTION.established

  // Author the flow left after re-drainage, then solve the share back out of it, so the teaching
  // claim — speed cannot buy effective support here — is what the arithmetic enforces rather than
  // something asserted beside it.
  const baselineEffectiveFlow = baselineFlow * (1 - RECIRCULATION_FRACTION.established)
  const effectiveFlow =
    baselineEffectiveFlow * (baselineFlow / demandedFlow) ** (RECIRCULATION_DEMAND_EXPONENT - 1)

  // No upper clamp is needed or wanted. `effectiveFlow` is strictly positive and strictly falling in
  // demanded flow, so the share is strictly below 1 and strictly rising, for every opening speed and
  // every reachable rpm. Never below the authored share either: slowing the pump does not undo a
  // cannula relationship, and letting it read as a fix would compete with the correction the case
  // teaches.
  return Math.max(RECIRCULATION_FRACTION.established, 1 - effectiveFlow / demandedFlow)
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
    OXYGEN_CARRIED_PER_GRAM_HEMOGLOBIN *
    state.circuit.hemoglobin *
    Math.max(systemicFlowLpm, 0.2) *
    10
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

/**
 * How each rate-limited patient field moves: the most it may change in one modeled second, the
 * precision it is held at, and — for the fields where "worse" has one meaning in this model —
 * which direction is the better one.
 *
 * The rates are the engine's existing ones, gathered into one table rather than re-typed at each
 * call site. `better` is used for one decision only: once a clinical case's presenting problem is
 * corrected, the case's authored values on directional fields hand back to the model (see
 * `patientAnchorApplies`). Pulse pressure, native output and CVP have no single better direction
 * here — a narrow pulse pressure is the tamponade finding, a wide one the recovering ventricle — so
 * they carry none.
 *
 * Evidence boundary: bounded-educational-model. Model step sizes, not physiological rate constants.
 */
export const PATIENT_FIELD_DYNAMICS: Readonly<
  Record<
    RateLimitedPatientField,
    {
      readonly maxChangePerSecond: number
      readonly places: number
      readonly better?: 'higher' | 'lower'
      readonly range?: { readonly low: number; readonly high: number }
    }
  >
> = Object.freeze({
  paCO2: { maxChangePerSecond: 1.4, places: 1, better: 'lower', range: { low: 20, high: 100 } },
  spo2: { maxChangePerSecond: 0.7, places: 1, better: 'higher', range: { low: 65, high: 100 } },
  rightRadialSpo2: {
    maxChangePerSecond: 0.7,
    places: 1,
    better: 'higher',
    range: { low: 65, high: 100 },
  },
  femoralArterialSpo2: {
    maxChangePerSecond: 0.7,
    places: 1,
    better: 'higher',
    range: { low: 65, high: 100 },
  },
  nativeCardiacOutputLpm: { maxChangePerSecond: 0.15, places: 1 },
  pulsePressure: { maxChangePerSecond: 2, places: 0 },
  meanArterialPressure: { maxChangePerSecond: 1.2, places: 0, better: 'higher' },
  centralVenousPressure: { maxChangePerSecond: 0.8, places: 0 },
  lactate: { maxChangePerSecond: 0.12, places: 1, better: 'lower' },
  urineOutputMlHr: { maxChangePerSecond: 2, places: 0, better: 'higher' },
  airwayPressure: { maxChangePerSecond: 1, places: 0, better: 'lower' },
  distalLimbNirs: { maxChangePerSecond: 1.5, places: 0, better: 'higher' },
})

export const RATE_LIMITED_PATIENT_FIELDS = Object.freeze(
  Object.keys(PATIENT_FIELD_DYNAMICS) as RateLimitedPatientField[],
)

type PatientTargetMap = Record<RateLimitedPatientField, number>

/**
 * The engine's generic relationships: what a patient on this circuit, with these gas settings and
 * these circuit faults, reads when nothing about the patient's own story is overriding it.
 *
 * Includes the relationships a circuit fault acts through (recirculation and a resisted membrane
 * reduce the circuit's oxygen contribution; the hypercapnia drills change how PaCO₂ follows sweep;
 * differential hypoxemia sets the right-arm level the VA model reads). Excludes the story targets in
 * `faultPatientTargets`. Numbers are the engine's existing ones, unchanged.
 */
export function genericPatientTargets(state: EcmoSimulationState, flow: number): PatientTargetMap {
  const gasAvailable = state.gas.sourceConnected && state.gas.sweepLpm > 0
  const recirculationAdjustedFlow = deriveRecirculationAdjustedCircuitFlow(
    flow,
    deriveRecirculationFraction(state),
  )
  const oxygenatorContribution = gasAvailable ? recirculationAdjustedFlow * state.gas.fio2 : 0
  let spo2 = 82 + oxygenatorContribution * 4
  let paCO2 = gasAvailable ? 76 - state.gas.sweepLpm * 7.5 : 90
  if (hasFault(state, 'acute-hypercapnia')) paCO2 = gasAvailable ? 78 - state.gas.sweepLpm * 8 : 94
  if (hasFault(state, 'compensated-hypercapnia')) {
    paCO2 = state.gas.sweepLpm === 0 ? 64 : 72 - state.gas.sweepLpm * 4
  }
  // Recirculation reaches arterial saturation through effective flow above, and only there.
  if (hasFault(state, 'oxygenator-resistance')) spo2 -= 8

  const va = state.supportMode === 'va'
  const rightRadialSpo2 = va
    ? hasFault(state, 'differential-hypoxemia')
      ? 82
      : gasAvailable
        ? 96
        : 80
    : spo2
  const femoralArterialSpo2 = va ? (gasAvailable ? 98.5 : 78) : spo2
  return {
    paCO2,
    spo2: va ? rightRadialSpo2 : spo2,
    rightRadialSpo2,
    femoralArterialSpo2,
    nativeCardiacOutputLpm: va ? 2.4 : 4.5,
    pulsePressure: va ? 18 : 35,
    meanArterialPressure: va
      ? clamp(55 + flow * 4, 60, 80)
      : // VV has no generic MAP relationship: MAP stays where it is unless a story target moves it.
        state.patient.meanArterialPressure,
    centralVenousPressure: 8,
    lactate: 1.8,
    urineOutputMlHr: 50,
    airwayPressure: 24,
    distalLimbNirs: 68,
  }
}

/**
 * The story targets: where an untreated fault takes the patient.
 *
 * Deterioration endpoints (a bleeding patient's MAP, a tension pneumothorax's CVP and airway
 * pressure, the shock faults' lactate and urine output, an unstarted circuit's gas exchange) and the
 * two faults that fix a value outright (LV loading's pulsatility, the ischemic limb's NIRS). Keyed
 * on the support mode and the active faults only, so `faultPatientTargets(mode, [fault])` also
 * answers which fields a single fault owns. Precedence where two faults target one field is the
 * engine's existing precedence. Numbers are the engine's existing ones, unchanged.
 */
export function faultPatientTargets(
  supportMode: EcmoSimulationState['supportMode'],
  activeFaults: readonly FaultId[],
): Partial<PatientTargetMap> {
  const has = (fault: FaultId) => activeFaults.includes(fault)
  const va = supportMode === 'va'
  const targets: Partial<PatientTargetMap> = {}
  if (!va && has('gas-source-interruption')) {
    targets.spo2 = 82
    targets.rightRadialSpo2 = 82
    targets.femoralArterialSpo2 = 82
  }
  if (has('ecmo-not-initiated')) {
    const saturation = va ? 82 : 74
    targets.spo2 = saturation
    targets.rightRadialSpo2 = saturation
    targets.femoralArterialSpo2 = saturation
    targets.paCO2 = va ? 58 : 76
  }
  if (va && has('lv-loading')) {
    targets.nativeCardiacOutputLpm = 0.8
    targets.pulsePressure = 5
  }
  // Mean arterial pressure: the last applicable fault wins, as it always has.
  if (has('hemorrhagic-hypovolemia')) targets.meanArterialPressure = 46
  if (has('tension-pneumothorax')) targets.meanArterialPressure = 42
  if (has('tamponade')) targets.meanArterialPressure = 40
  if (has('vasoplegia')) targets.meanArterialPressure = 48
  if (has('ecmo-not-initiated')) targets.meanArterialPressure = va ? 38 : 68
  // Central venous pressure: the first applicable fault wins, as it always has.
  if (has('hemorrhagic-hypovolemia')) targets.centralVenousPressure = 2
  else if (has('tension-pneumothorax')) targets.centralVenousPressure = 20
  else if (has('tamponade')) targets.centralVenousPressure = 22
  const shock =
    has('hemorrhagic-hypovolemia') ||
    has('tension-pneumothorax') ||
    has('tamponade') ||
    has('vasoplegia') ||
    (has('ecmo-not-initiated') && va)
  if (shock) {
    targets.lactate = 8
    targets.urineOutputMlHr = 8
  }
  if (has('tension-pneumothorax')) targets.airwayPressure = 40
  if (has('distal-limb-ischemia')) targets.distalLimbNirs = 28
  return targets
}

/** Where a field's target came from, in the words the causal manifest uses. */
export type PatientTargetOwner =
  | 'generic-model'
  | 'fault-story'
  | 'case-authored'
  | 'intervention-held'

export interface ResolvedPatientTargets {
  readonly targets: PatientTargetMap
  readonly owners: Readonly<Record<RateLimitedPatientField, PatientTargetOwner>>
}

/**
 * Whether a clinical case's anchor on this field still holds.
 *
 * Anchors hold while the case's presenting problem is active — including a recognition-only
 * problem, which this engine keeps active after it is recognised. Once the presenting problem is
 * corrected, the anchors on directional fields hand back to the model, because the case's authored
 * abnormal values there (a low saturation, a low MAP, a high lactate) belong to the problem that was
 * just treated; and so does any anchor on a field the presenting problem's own story targets. What
 * remains held is the patient's background that the model has no relationship for — a recovered
 * ventricle's native output and pulse pressure, a tamponade's narrow pulse pressure.
 */
export function patientAnchorApplies(
  state: EcmoSimulationState,
  field: RateLimitedPatientField,
): boolean {
  const ownership = state.scenario.patientOwnership
  if (!ownership?.anchors[field]) return false
  if (hasFault(state, ownership.presentingFault)) return true
  if (PATIENT_FIELD_DYNAMICS[field].better) return false
  return faultPatientTargets(state.supportMode, [ownership.presentingFault])[field] === undefined
}

/**
 * The target every rate-limited patient field moves toward this second, and who owns it.
 *
 * One precedence rule for every field, in this order:
 *
 * 1. A newly active fault's story target (`fault-story`) can move a field despite an older held
 *    intervention. Otherwise a non-temporizing intervention holds what it bought against faults
 *    already present when it landed (`intervention-held`); only a temporizing patch fades back
 *    toward the original story.
 * 2. A clinical case's anchor (`case-authored` or `intervention-held`): the held level, moved only by
 *    the change in the generic target since the level was set. A learner who raises the pump speed
 *    against recirculation still watches saturation fall; a case left alone no longer drifts toward
 *    a generic patient it was never describing.
 * 3. Otherwise the generic relationship (`generic-model`).
 *
 * Scenarios without a clinical case carry no anchors, so for every Learn drill, reference circuit
 * and integrated case this reduces exactly to "story target, else generic target" — the engine's
 * behaviour before this function existed.
 */
export function resolvePatientTargets(
  state: EcmoSimulationState,
  flow: number,
): ResolvedPatientTargets {
  const generic = genericPatientTargets(state, flow)
  const story = faultPatientTargets(state.supportMode, state.scenario.activeFaults)
  const targets = {} as PatientTargetMap
  const owners = {} as Record<RateLimitedPatientField, PatientTargetOwner>
  for (const field of RATE_LIMITED_PATIENT_FIELDS) {
    const anchor = patientAnchorApplies(state, field)
      ? state.scenario.patientOwnership?.anchors[field]
      : undefined
    const storyTarget = story[field]
    const newFaultStoryTarget =
      anchor?.source === 'intervention'
        ? faultPatientTargets(
            state.supportMode,
            state.scenario.activeFaults.filter(
              (fault) => !anchor.activeFaultsAtSet?.includes(fault),
            ),
          )[field]
        : undefined
    let target: number
    if (newFaultStoryTarget !== undefined) {
      target = newFaultStoryTarget
      owners[field] = 'fault-story'
    } else if (storyTarget !== undefined) {
      if (anchor?.source === 'intervention') {
        target = anchor.level
        owners[field] = 'intervention-held'
      } else {
        target = storyTarget
        owners[field] = 'fault-story'
      }
    } else if (anchor) {
      target = anchor.level + (generic[field] - anchor.reference)
      owners[field] = anchor.source === 'intervention' ? 'intervention-held' : 'case-authored'
    } else {
      target = generic[field]
      owners[field] = 'generic-model'
    }
    const range = PATIENT_FIELD_DYNAMICS[field].range
    targets[field] = range ? clamp(target, range.low, range.high) : target
  }
  return { targets, owners }
}

/**
 * Work of breathing, for the one relationship this model has for it: a VV patient who has been off
 * sweep for twenty modeled seconds starts to breathe harder. Timed from when the sweep stopped, not
 * from the case clock. Everywhere else the authored value stands — the model couples neither
 * respiratory rate nor work of breathing to PaCO₂, pH or oxygenation, and says so where it matters.
 */
function deriveWorkOfBreathing(
  state: EcmoSimulationState,
  paCO2: number,
): PatientState['workOfBreathing'] {
  const stoppedAt = state.scenario.sweepStoppedAt
  const offSweepSeconds =
    state.gas.sweepLpm === 0 && stoppedAt !== undefined && stoppedAt !== null
      ? state.simulationTime - stoppedAt
      : null
  if (state.supportMode === 'vv' && offSweepSeconds !== null && offSweepSeconds >= 20) {
    return paCO2 > 55 ? 'high' : 'moderate'
  }
  return state.patient.workOfBreathing
}

const RESPIRATORY_RATE_BY_WORK_OF_BREATHING: Readonly<
  Record<PatientState['workOfBreathing'], number>
> = Object.freeze({ high: 32, moderate: 24, low: 18 })

function derivePatient(
  state: EcmoSimulationState,
  flow: number,
  landedFields: ReadonlySet<string>,
): PatientState {
  const { targets } = resolvePatientTargets(state, flow)
  const moved = {} as PatientTargetMap
  for (const field of RATE_LIMITED_PATIENT_FIELDS) {
    const dynamics = PATIENT_FIELD_DYNAMICS[field]
    // A patch that landed this second is what this second shows; it starts moving on the next.
    moved[field] = landedFields.has(field)
      ? state.patient[field]
      : round(
          moveToward(state.patient[field], targets[field], dynamics.maxChangePerSecond),
          dynamics.places,
        )
  }
  const pH = round(
    clamp(
      6.1 + Math.log10(state.patient.bicarbonate / (0.03 * Math.max(moved.paCO2, 1))),
      6.8,
      7.7,
    ),
    2,
  )
  const workOfBreathing = deriveWorkOfBreathing(state, moved.paCO2)
  const lvLoading = state.supportMode === 'va' && hasFault(state, 'lv-loading')

  return {
    ...state.patient,
    ...moved,
    pH,
    workOfBreathing,
    // Respiratory rate follows work of breathing only when work of breathing changes. An authored
    // rate stands until then; it used to be snapped to 18/24/32 on the first tick of every case.
    respiratoryRate:
      workOfBreathing === state.patient.workOfBreathing
        ? state.patient.respiratoryRate
        : RESPIRATORY_RATE_BY_WORK_OF_BREATHING[workOfBreathing],
    aorticValveOpening: state.supportMode === 'va' ? !lvLoading : true,
    pulmonaryCongestion: state.supportMode === 'va' ? (lvLoading ? 'marked' : 'mild') : 'none',
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
  }
}

/**
 * The saturation blood leaves the membrane at, once it has had time to settle (B6-007). With sweep
 * flowing the oxygen fraction sets it; with no sweep it leaves at the saturation it arrived with; a
 * resisted membrane is authored at 88. Approached at a bounded rate while the clock advances.
 */
export function derivePostOxygenatorTarget(
  state: EcmoSimulationState,
  systemicVenousSaturationEstimate: number,
): number {
  const gasDelivered = state.gas.sourceConnected && state.gas.sweepLpm > 0
  return hasFault(state, 'oxygenator-resistance')
    ? 88
    : gasDelivered
      ? round(96 + state.gas.fio2 * 3, 1)
      : systemicVenousSaturationEstimate
}

export interface DeriveSimulationOptions {
  /**
   * Whether the patient (and the membrane's outlet saturation) may move in this derivation.
   *
   * True when the clock advanced. False for action-time recomputation — a clamp, a correction, a
   * resumption — where the circuit must be recomputed but nothing about the patient may change at an
   * unchanged simulation time (B6-012).
   */
  readonly advancePatient?: boolean
  /**
   * Patient fields an authored patch set at the start of this second. They show the patched value
   * for this second and start moving on the next, so a patch is never eroded before it is seen.
   */
  readonly landedPatientFields?: ReadonlySet<string>
  /**
   * The one derivation a freshly built state receives. The patient is not advanced — loading a case
   * is not a second of the clock — but the latent venous-saturation estimate, which is arithmetic on
   * the loaded state rather than a physiological change, is computed so it does not start stale.
   */
  readonly atLoad?: boolean
}

export function deriveSimulation(
  state: EcmoSimulationState,
  derivationOptions: DeriveSimulationOptions = {},
): EcmoSimulationState {
  const options = { advancePatient: true, ...derivationOptions }
  const isNewClockSample = state.simulationTime > (state.trends.at(-1)?.time ?? -1)
  /*
   * Whether this derivation is a second of the clock, as opposed to a recomputation at an unchanged
   * time — loading a case, or a control, clamp or correction applied at the current second.
   *
   * Everything that is a per-second process runs only here: the patient, the membrane outlet, the
   * battery draining, haemoglobin drifting, the LPM loop trimming the speed, the backflow counter and
   * the interlock's speed trim. Before ECMO-FELLOW-02 the battery, haemoglobin and LPM loop ran on
   * every derivation, so the one derivation at load and every action-time recomputation spent a
   * second of battery and moved haemoglobin without any time passing.
   */
  const clockAdvanced = options.advancePatient && isNewClockSample
  let device = clockAdvanced ? applyLpmControl(state) : state.device
  const clinicalSupportInactive =
    state.scenario.clinical !== null && state.scenario.clinical.supportStatus !== 'on-ecmo'
  if (clinicalSupportInactive) device = { ...device, pumpRunning: false }

  if (device.pumpMode === 'lpm' && !state.circuit.flowSensorConnected) {
    device = { ...device, pumpMode: 'rpm', displayedSetpoint: device.rpmSetpoint }
  }

  if (clockAdvanced && device.powerSource === 'battery') {
    device = { ...device, batteryPercent: round(clamp(device.batteryPercent - 0.35, 0, 100), 1) }
  }

  let flow = calculateBloodFlow({ ...state, device }, device.rpmSetpoint)
  const backflowSeconds =
    device.zeroFlowActive && state.circuit.backflowSeconds >= 6
      ? state.circuit.backflowSeconds
      : flow < -0.1
        ? state.circuit.backflowSeconds + (clockAdvanced ? 1 : 0)
        : 0
  if (backflowSeconds >= 6 && !device.zeroFlowActive && !device.globalOverride) {
    device = { ...device, zeroFlowActive: true }
    flow = 0
  }
  const pressures = calculatePressures(state, flow, device.zeroFlowActive ? 0 : device.rpmSetpoint)
  const pressuresModeled = pressuresAreModeled(state, device, flow)
  // The locally-updated device, not `state.device`: the fraction now reads the speed setpoint, and
  // LPM mode rewrites that setpoint earlier in this same derivation.
  const recirculationFraction = deriveRecirculationFraction({ ...state, device })
  const recirculationAdjustedCircuitFlowLpm = deriveRecirculationAdjustedCircuitFlow(
    flow,
    recirculationFraction,
  )
  const systemicVenousSaturationEstimate = deriveSystemicVenousSaturationEstimate(
    state,
    recirculationAdjustedCircuitFlowLpm,
  )
  /*
   * B6-007. Blood leaves the membrane at the saturation the gas side can give it: with sweep
   * flowing, the oxygen fraction sets it; with no sweep — source off or set to zero — no oxygen is
   * added, so it leaves at the saturation it arrived with (a conservation statement inside the
   * bounded model, not a clinical endpoint). It is state, approached at a bounded rate while the
   * clock advances, so an action at an unchanged time cannot move it (B6-012), and so a value that
   * used to sit at 99 while the patient desaturated now falls with the trial that removed the gas.
   */
  const ownership = state.scenario.patientOwnership
  const modelPostOxygenatorTarget = derivePostOxygenatorTarget(
    state,
    systemicVenousSaturationEstimate,
  )
  // An authored membrane-outlet saturation holds like any other authored value while the presenting
  // problem stands, moving only by what changes after load.
  const postOxygenatorTarget =
    ownership?.postOxygenator && hasFault(state, ownership.presentingFault)
      ? clamp(
          ownership.postOxygenator.level +
            (modelPostOxygenatorTarget - ownership.postOxygenator.reference),
          0,
          100,
        )
      : modelPostOxygenatorTarget
  const postOxygenatorSaturation = clockAdvanced
    ? round(moveToward(state.circuit.postOxygenatorSaturation, postOxygenatorTarget, 2), 1)
    : state.circuit.postOxygenatorSaturation
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
    // Juddering is the bedside sign of a vessel or cannula being intermittently drawn shut, so it
    // belongs to being past the drainage capacity rather than to a pressure number on its own.
    drainageChatter:
      (resolveDrainageLimitation(state, device.rpmSetpoint)?.limited ?? false) &&
      pressures.pVen < -75,
    preOxygenatorSaturation: venousLineSaturation,
    postOxygenatorSaturation,
    hemoglobin: clockAdvanced
      ? round(
          moveToward(
            state.circuit.hemoglobin,
            hasFault(state, 'hemorrhagic-hypovolemia') ? 6 : Math.max(9, state.circuit.hemoglobin),
            hasFault(state, 'hemorrhagic-hypovolemia') ? 0.12 : 0.05,
          ),
          1,
        )
      : state.circuit.hemoglobin,
  }

  const deviceBeforeProtection = device
  device = applyPressureIntervention(state, device, circuit, clockAdvanced)
  /*
   * The model's protective stop, recorded as an event of the model's.
   *
   * Without this the only trace of a pressure stop was the pump quietly reading stopped, and by the
   * next second the alarm that announced it had cleared with the channel it was keyed to — so the
   * debrief's own timeline showed a speed change and no consequence (C3-1). It is `system` rather
   * than `alarm`, because it is this simulation's interlock and not a CARDIOHELP alarm event.
   */
  const protectionStoppedPump = deviceBeforeProtection.pumpRunning && !device.pumpRunning
  if (clinicalSupportInactive) device = { ...device, pumpRunning: false }
  if (!device.pumpRunning && flow !== 0) {
    flow = 0
    circuit = { ...circuit, bloodFlow: 0 }
  }

  // B6-012: at an unchanged clock the patient is exactly what it was. Only a tick may move it —
  // including the load, which used to advance every patient one second at t = 0 (ECMO-FELLOW-02).
  const patient: PatientState = clockAdvanced
    ? {
        ...derivePatient(
          { ...state, device, circuit },
          flow,
          options.landedPatientFields ?? new Set<string>(),
        ),
        // Latent, estimated, and kept on the patient rather than the circuit so it can never be
        // mistaken for the console's venous-probe reading.
        systemicVenousSaturationEstimate: round(systemicVenousSaturationEstimate, 1),
      }
    : options.atLoad
      ? {
          ...state.patient,
          systemicVenousSaturationEstimate: round(systemicVenousSaturationEstimate, 1),
        }
      : state.patient
  const intermediate: EcmoSimulationState = {
    ...state,
    scenario: protectionStoppedPump
      ? {
          ...state.scenario,
          historySerial: (state.scenario.historySerial ?? state.history.length) + 1,
        }
      : state.scenario,
    device,
    circuit,
    patient,
    history: protectionStoppedPump
      ? [
          ...state.history,
          {
            id: `system-${state.simulationTime}-${state.scenario.historySerial ?? state.history.length}`,
            time: state.simulationTime,
            kind: 'system' as const,
            label:
              "This simulation's pressure interlock stopped the pump. The speed setting was left where it was; it is not a speed the pump is turning at.",
          },
        ].slice(-MAX_HISTORY_ENTRIES)
      : state.history,
  }
  const reconciled = reconcileAlarms(intermediate)
  const trend: TrendSample = {
    time: intermediate.simulationTime,
    flow: circuit.bloodFlow,
    pVen: circuit.readouts.pVen.displayed,
    pInt: circuit.readouts.pInt.displayed,
    pArt: circuit.readouts.pArt.displayed,
    deltaP: circuit.readouts.deltaP.displayed,
    paCO2: patient.paCO2,
    spo2: state.supportMode === 'va' ? patient.rightRadialSpo2 : patient.spo2,
    map: patient.meanArterialPressure,
    lactate: patient.lactate,
  }

  // One sample per second of the clock: a recomputation at the same time replaces the last sample
  // rather than plotting two points at one instant.
  const trends = isNewClockSample ? [...state.trends, trend] : [...state.trends.slice(0, -1), trend]
  return {
    ...intermediate,
    ...reconciled,
    trends: trends.slice(-MAX_TREND_SAMPLES),
  }
}
