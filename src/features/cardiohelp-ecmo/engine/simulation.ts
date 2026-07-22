import { cardiohelpScenarioById, cardiohelpScenarios } from '../content/scenarios'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import type {
  AlarmEvent,
  AlarmPriority,
  CircuitState,
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

export const defaultCircuitState: CircuitState = {
  bloodFlow: 4,
  pVen: -34,
  pInt: 250,
  pArt: 190,
  pAux: null,
  deltaP: 60,
  tVen: 36.5,
  tArt: 36.8,
  svo2: 68,
  hemoglobin: 10.2,
  hematocrit: 31,
  preOxygenatorSaturation: 68,
  postOxygenatorSaturation: 99,
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

function calculatePressures(state: EcmoSimulationState, flow: number, rpm: number) {
  let pVen = -25 - flow * 2.4
  let pArt = 125 + flow * 16
  let pInt = pArt + 50 + flow * 2.5

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
    pArt = 285 + flow * 10
    pInt = pArt + 58
  }
  if (hasFault(state, 'oxygenator-resistance')) {
    pArt = 165 + flow * 8
    pInt = pArt + 110 + flow * 8
  }
  if (state.circuit.drainageClampClosed && state.device.pumpRunning && rpm > 0) {
    pVen = -350
  }
  if (state.circuit.returnClampClosed && state.device.pumpRunning && rpm > 0) {
    pArt = 620
    pInt = 690
  }

  return {
    pVen: round(clamp(pVen, -500, 900), 0),
    pInt: round(clamp(pInt, -500, 900), 0),
    pArt: round(clamp(pArt, -500, 900), 0),
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

function patientTargets(state: EcmoSimulationState, flow: number) {
  const gasAvailable = state.gas.sourceConnected && state.gas.sweepLpm > 0
  const recirculationFraction = hasFault(state, 'recirculation') ? 0.48 : 0.08
  const effectiveFlow = flow * (1 - recirculationFraction)
  const oxygenatorContribution = gasAvailable ? effectiveFlow * state.gas.fio2 : 0
  let targetSpo2 = 82 + oxygenatorContribution * 4
  let targetPaCO2 = gasAvailable ? 76 - state.gas.sweepLpm * 7.5 : 90

  if (hasFault(state, 'acute-hypercapnia'))
    targetPaCO2 = gasAvailable ? 78 - state.gas.sweepLpm * 8 : 94
  if (hasFault(state, 'compensated-hypercapnia')) {
    targetPaCO2 = state.gas.sweepLpm === 0 ? 64 : 72 - state.gas.sweepLpm * 4
  }
  if (hasFault(state, 'recirculation')) targetSpo2 -= 6
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
  let circuit: CircuitState = {
    ...state.circuit,
    ...pressures,
    bloodFlow: flow,
    backflowSeconds,
    deltaP: round(pressures.pInt - pressures.pArt, 0),
    drainageChatter:
      (hasFault(state, 'preload-limited') ||
        hasFault(state, 'hemorrhagic-hypovolemia') ||
        hasFault(state, 'tension-pneumothorax') ||
        hasFault(state, 'tamponade')) &&
      pressures.pVen < -75,
    preOxygenatorSaturation: hasFault(state, 'recirculation')
      ? round(clamp(state.patient.spo2 - 2, 40, 99.9), 1)
      : round(clamp(state.patient.spo2 - 25, 40, 99.9), 1),
    postOxygenatorSaturation: hasFault(state, 'oxygenator-resistance')
      ? 88
      : state.gas.sourceConnected
        ? round(96 + state.gas.fio2 * 3, 1)
        : 72,
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

  const patient = derivePatient({ ...state, device, circuit }, flow)
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
