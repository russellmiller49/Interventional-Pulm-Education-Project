import {
  createInitialIcuCrrtState,
  createInitialIcuEcmoState,
  createInitialIcuMcsState,
  createInitialIcuVentilatorState,
  icuCrrtAdapter,
  icuEcmoAdapter,
  icuMcsAdapter,
  icuVentilatorAdapter,
} from './adapters'
import { actionIdsForIcuCommand, applyCareIntervention, commandPermitted } from './commands'
import { clamp, roundTo, uniqueSorted } from './math'
import {
  advanceIcuHemodynamics,
  advanceIcuSlowPhysiology,
  createIcuCirculationCompartments,
  deriveIcuCirculationParameters,
  reconcileCompartmentVolume,
} from './physiology'
import {
  deriveIcuSeed,
  deterministicJitterSeconds,
  nextIcuRandom,
  normalizeIcuSeed,
} from './random'
import { createEmptyIcuOutcome, scoreIcuSimulation } from './scoring'
import {
  ICU_CONTENT_VERSION,
  ICU_ENGINE_VERSION,
  ICU_MAX_DIAGNOSIS_COMMITMENTS,
  ICU_MAX_EVENT_HISTORY,
  ICU_MAX_REPLAY_COMMANDS,
  ICU_MAX_TREND_SAMPLES,
  type IcuCommand,
  type IcuDeviceAlarm,
  type IcuDeviceStates,
  type IcuEventRecord,
  type IcuObservation,
  type IcuPatientSnapshot,
  type IcuPatientState,
  type IcuScenarioDefinition,
  type IcuSimulationMode,
  type IcuSimulationState,
  type IcuTherapyEffect,
  type IcuTrendSample,
} from './types'

export interface CreateIcuSimulationOptions {
  mode?: IcuSimulationMode
  seed?: number
}

function clonePatient(patient: IcuPatientState): IcuPatientState {
  return {
    ...patient,
    drivers: { ...patient.drivers },
    hemodynamics: { ...patient.hemodynamics },
    respiratory: { ...patient.respiratory },
    renal: { ...patient.renal },
    hematology: { ...patient.hematology },
    perfusion: { ...patient.perfusion },
    medications: { ...patient.medications },
  }
}

function createDevices(scenario: IcuScenarioDefinition): IcuDeviceStates {
  const defaults: IcuDeviceStates = {
    ventilator: createInitialIcuVentilatorState(),
    ecmo: createInitialIcuEcmoState(),
    mcs: createInitialIcuMcsState(),
    crrt: createInitialIcuCrrtState(),
  }
  const devices: IcuDeviceStates = {
    ventilator: { ...defaults.ventilator, ...scenario.initialDevices?.ventilator },
    ecmo: { ...defaults.ecmo, ...scenario.initialDevices?.ecmo },
    mcs: { ...defaults.mcs, ...scenario.initialDevices?.mcs },
    crrt: { ...defaults.crrt, ...scenario.initialDevices?.crrt },
  }
  const configured = (
    [
      ['ventilator', devices.ventilator.status],
      ['ecmo', devices.ecmo.status],
      ['mcs', devices.mcs.status],
      ['crrt', devices.crrt.status],
    ] as const
  )
    .filter(([, status]) => status !== 'off')
    .map(([therapy]) => therapy)
  if (configured.some((therapy) => !scenario.capabilities.therapies.includes(therapy)))
    throw new Error('Initial device configuration is not authorized by scenario capabilities.')
  if (devices.ecmo.status !== 'off' && !scenario.capabilities.ecmoModes.includes(devices.ecmo.mode))
    throw new Error('Initial ECMO mode is not authorized by scenario capabilities.')
  if (
    devices.mcs.status !== 'off' &&
    (devices.mcs.device === 'none' ||
      !scenario.capabilities.mcsDevices.includes(devices.mcs.device))
  )
    throw new Error('Initial MCS device is not authorized by scenario capabilities.')
  if (devices.ecmo.status === 'running' && devices.mcs.status === 'running')
    throw new Error('Concurrent initial ECMO and MCS are unsupported in v1.')
  return devices
}

function monitorValues(patient: IcuPatientState): Readonly<Record<string, number>> {
  return {
    heartRateBpm: patient.hemodynamics.heartRateBpm,
    systolicMmHg: patient.hemodynamics.systolicMmHg,
    diastolicMmHg: patient.hemodynamics.diastolicMmHg,
    mapMmHg: patient.hemodynamics.mapMmHg,
    spo2Percent: patient.respiratory.spo2Percent,
    respiratoryRatePerMin: patient.respiratory.spontaneousRatePerMin,
    temperatureC: patient.perfusion.temperatureC,
  }
}

function initialObservation(patient: IcuPatientState): IcuObservation {
  return {
    id: 'continuous-monitor:0',
    assessmentId: 'continuous-monitor',
    observedAtSeconds: 0,
    availableAtSeconds: 0,
    values: monitorValues(patient),
  }
}

export function createIcuTrendSample(
  state: Pick<IcuSimulationState, 'clock' | 'patient' | 'devices'>,
): IcuTrendSample {
  const patient = state.patient
  return {
    elapsedSeconds: state.clock.elapsedSeconds,
    mapMmHg: patient.hemodynamics.mapMmHg,
    cardiacOutputLMin: patient.hemodynamics.effectiveSystemicFlowLMin,
    spo2Percent: patient.respiratory.spo2Percent,
    paCO2MmHg: patient.respiratory.paCO2MmHg,
    pH: patient.respiratory.pH,
    lactateMmolL: patient.perfusion.lactateMmolL,
    hemoglobinGdl: patient.hematology.hemoglobinGdl,
    potassiumMmolL: patient.renal.potassiumMmolL,
    creatinineMgDl: patient.renal.creatinineMgDl,
    urineOutputMlHour: patient.renal.urineOutputMlHour,
    netFluidBalanceMl: roundTo(
      patient.hematology.cumulativeCrystalloidMl +
        patient.hematology.cumulativeBloodProductMl -
        patient.hematology.cumulativeBloodLossMl -
        patient.renal.cumulativeUrineMl -
        patient.renal.cumulativeCrrtRemovalMl,
      1,
    ),
    ecmoFlowLMin: state.devices.ecmo.bloodFlowLMin,
    mcsFlowLMin: state.devices.mcs.deviceFlowLMin,
    crrtRemovalMlHour:
      state.devices.crrt.status === 'running' ? state.devices.crrt.patientFluidRemovalMlHour : 0,
  }
}

export function createIcuSimulation(
  scenario: IcuScenarioDefinition,
  options: CreateIcuSimulationOptions = {},
): IcuSimulationState {
  const mode = options.mode ?? 'practice'
  if (!scenario.allowedModes.includes(mode)) {
    throw new Error(`Scenario ${scenario.id} does not support ${mode} mode.`)
  }
  const seed = normalizeIcuSeed(options.seed ?? deriveIcuSeed(scenario.id, mode))
  const patient = clonePatient(scenario.initialPatient)
  const devices = createDevices(scenario)
  const circulation = createIcuCirculationCompartments(patient, devices)
  const emptyOutcome = createEmptyIcuOutcome()
  const base: IcuSimulationState = {
    version: 1,
    engineVersion: ICU_ENGINE_VERSION,
    contentVersion: ICU_CONTENT_VERSION,
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    scenarioFamily: scenario.family,
    mode,
    phase: 'active',
    seed,
    randomState: seed,
    clock: {
      elapsedSeconds: 0,
      speed: 1,
      paused: false,
      hemodynamicAccumulatorSeconds: 0,
      slowAccumulatorSeconds: 0,
      nextTrendAtSeconds: 60,
    },
    patient,
    circulationParameters: circulation.parameters,
    compartments: circulation.compartments,
    devices,
    diagnosis: {
      committed: false,
      classification: null,
      committedAtSeconds: null,
      commitments: [],
    },
    observations: [initialObservation(patient)],
    alarms: [],
    trends: [],
    history: [
      {
        id: `system:0:${scenario.id}`,
        elapsedSeconds: 0,
        kind: 'system',
        code: 'scenario-loaded',
        label: 'Synthetic ICU scenario loaded',
      },
    ],
    performedActionIds: [],
    actionHistory: [],
    completedScheduledEventIds: [],
    reassessedDomains: [],
    outcome: emptyOutcome,
    replay: {
      version: 1,
      engineVersion: ICU_ENGINE_VERSION,
      contentVersion: ICU_CONTENT_VERSION,
      scenarioId: scenario.id,
      scenarioVersion: scenario.version,
      mode,
      seed,
      commands: [],
    },
  }
  const trends = [createIcuTrendSample(base)]
  return { ...base, trends }
}

function makeSnapshot(state: IcuSimulationState): IcuPatientSnapshot {
  return {
    elapsedSeconds: state.clock.elapsedSeconds,
    patient: state.patient,
    circulationParameters: state.circulationParameters,
    compartments: state.compartments,
    devices: state.devices,
  }
}

function patientAlarmDescriptors(
  state: IcuSimulationState,
): readonly Omit<
  IcuDeviceAlarm,
  'startedAtSeconds' | 'acknowledgedAtSeconds' | 'correctedAtSeconds'
>[] {
  const descriptors: Omit<
    IcuDeviceAlarm,
    'startedAtSeconds' | 'acknowledgedAtSeconds' | 'correctedAtSeconds'
  >[] = []
  const add = (code: string, message: string, priority: IcuDeviceAlarm['priority']) =>
    descriptors.push({
      id: `patient:${code}`,
      subsystem: 'patient',
      code,
      message,
      priority,
      mappingReviewStatus: 'pending',
      active: true,
    })
  if (state.patient.hemodynamics.mapMmHg < 55)
    add('HYPOTENSION', 'Mean arterial pressure is critically low', 'critical')
  else if (state.patient.hemodynamics.mapMmHg < 65)
    add('LOW_MAP', 'Mean arterial pressure is low', 'warning')
  if (state.patient.respiratory.spo2Percent < 85)
    add('HYPOXEMIA', 'Oxygen saturation is critically low', 'critical')
  else if (state.patient.respiratory.spo2Percent < 90)
    add('LOW_SPO2', 'Oxygen saturation is low', 'warning')
  if (state.patient.perfusion.lactateMmolL >= 6)
    add('HIGH_LACTATE', 'Lactate remains markedly elevated', 'warning')
  if (state.patient.renal.potassiumMmolL >= 6)
    add('HYPERKALEMIA', 'Potassium is critically elevated', 'critical')
  if (state.patient.hematology.hemoglobinGdl < 6)
    add('LOW_HEMOGLOBIN', 'Hemoglobin is critically low', 'critical')
  return descriptors
}

export function mergeIcuAlarmDescriptors(
  previous: readonly IcuDeviceAlarm[],
  descriptors: readonly Omit<
    IcuDeviceAlarm,
    'startedAtSeconds' | 'acknowledgedAtSeconds' | 'correctedAtSeconds'
  >[],
  now: number,
): readonly IcuDeviceAlarm[] {
  const previousById = new Map(previous.map((alarm) => [alarm.id, alarm]))
  const activeIds = new Set(descriptors.map((descriptor) => descriptor.id))
  const active = descriptors.map((descriptor) => {
    const old = previousById.get(descriptor.id)
    return {
      ...descriptor,
      active: true,
      startedAtSeconds: old?.active ? old.startedAtSeconds : now,
      acknowledgedAtSeconds: old?.active ? old.acknowledgedAtSeconds : null,
      correctedAtSeconds: null,
    }
  })
  const corrected = previous
    .filter((alarm) => alarm.active && !activeIds.has(alarm.id))
    .map((alarm) => ({ ...alarm, active: false, correctedAtSeconds: now }))
  const inactive = previous.filter((alarm) => !alarm.active && !activeIds.has(alarm.id))
  return [...active, ...corrected, ...inactive].slice(0, 128)
}

function eventTimeSeconds(
  state: IcuSimulationState,
  event: IcuScenarioDefinition['scheduledEvents'][number],
): number {
  return Math.max(
    0,
    event.atSeconds + deterministicJitterSeconds(state.seed, event.id, event.jitterSeconds),
  )
}

function applyDueScenarioEvents(
  state: IcuSimulationState,
  scenario: IcuScenarioDefinition,
): IcuSimulationState {
  let patient = state.patient
  const completed = [...state.completedScheduledEventIds]
  const records: IcuEventRecord[] = []
  for (const event of scenario.scheduledEvents) {
    if (completed.includes(event.id) || state.clock.elapsedSeconds < eventTimeSeconds(state, event))
      continue
    completed.push(event.id)
    if (event.effect.kind === 'bleeding-rate') {
      patient = {
        ...patient,
        drivers: { ...patient.drivers, bleedingRateMlHour: event.effect.rateMlHour },
      }
    } else {
      const current = patient.drivers[event.effect.driver]
      const unconstrained = current + event.effect.delta
      const nextValue =
        event.effect.driver === 'tamponadePressureMmHg'
          ? clamp(unconstrained, 0, 35)
          : event.effect.driver === 'bleedingRateMlHour'
            ? clamp(unconstrained, 0, 5_000)
            : clamp(unconstrained, 0, 1)
      patient = {
        ...patient,
        drivers: { ...patient.drivers, [event.effect.driver]: nextValue },
      }
    }
    records.push({
      id: `scenario:${event.id}`,
      elapsedSeconds: state.clock.elapsedSeconds,
      kind: 'scenario',
      code: event.id,
      label: event.label,
    })
  }
  if (!records.length) return state
  return {
    ...state,
    patient,
    completedScheduledEventIds: completed,
    history: [...state.history, ...records].slice(-ICU_MAX_EVENT_HISTORY),
  }
}

function advanceOneSecond(
  state: IcuSimulationState,
  scenario: IcuScenarioDefinition,
): IcuSimulationState {
  const snapshot = makeSnapshot(state)
  const ventilator = icuVentilatorAdapter.step(state.devices.ventilator, snapshot, 1)
  const ecmo = icuEcmoAdapter.step(state.devices.ecmo, snapshot, 1)
  const mcs = icuMcsAdapter.step(state.devices.mcs, snapshot, 1)
  const slowAccumulator = state.clock.slowAccumulatorSeconds + 1
  const crrt = icuCrrtAdapter.step(
    state.devices.crrt,
    snapshot,
    slowAccumulator >= 60 ? slowAccumulator : 0,
  )
  const devices: IcuDeviceStates = {
    ventilator: ventilator.state,
    ecmo: ecmo.state,
    mcs: mcs.state,
    crrt: crrt.state,
  }
  const effects: readonly IcuTherapyEffect[] = [
    ...ventilator.effects,
    ...ecmo.effects,
    ...mcs.effects,
    ...crrt.effects,
  ]
  const hemodynamics = advanceIcuHemodynamics(
    state.patient,
    devices,
    state.compartments,
    effects,
    state.clock.elapsedSeconds,
    1,
  )
  const patient = advanceIcuSlowPhysiology(hemodynamics.patient, devices, effects, 1)
  const compartments = reconcileCompartmentVolume(hemodynamics.compartments, patient)
  const elapsedSeconds = state.clock.elapsedSeconds + 1
  let next: IcuSimulationState = {
    ...state,
    clock: {
      ...state.clock,
      elapsedSeconds,
      hemodynamicAccumulatorSeconds: 0,
      slowAccumulatorSeconds: slowAccumulator >= 60 ? 0 : slowAccumulator,
    },
    patient,
    circulationParameters: hemodynamics.parameters,
    compartments,
    devices,
  }
  next = applyDueScenarioEvents(next, scenario)
  const descriptors = [
    ...ventilator.alarms,
    ...ecmo.alarms,
    ...mcs.alarms,
    ...crrt.alarms,
    ...patientAlarmDescriptors(next),
  ]
  next = {
    ...next,
    alarms: mergeIcuAlarmDescriptors(state.alarms, descriptors, elapsedSeconds),
  }

  if (elapsedSeconds >= state.clock.nextTrendAtSeconds) {
    const trend = createIcuTrendSample(next)
    next = {
      ...next,
      clock: { ...next.clock, nextTrendAtSeconds: state.clock.nextTrendAtSeconds + 60 },
      trends: [...next.trends, trend].slice(-ICU_MAX_TREND_SAMPLES),
      observations: [
        ...next.observations,
        {
          id: `continuous-monitor:${elapsedSeconds}`,
          assessmentId: 'continuous-monitor' as const,
          observedAtSeconds: elapsedSeconds,
          availableAtSeconds: elapsedSeconds,
          values: monitorValues(next.patient),
        },
      ].slice(-ICU_MAX_TREND_SAMPLES),
    }
  }
  return { ...next, outcome: scoreIcuSimulation(next, scenario) }
}

export function advanceIcuSimulation(
  state: IcuSimulationState,
  scenario: IcuScenarioDefinition,
  seconds: number,
): IcuSimulationState {
  if (state.scenarioId !== scenario.id || state.scenarioVersion !== scenario.version)
    throw new Error('Scenario version does not match simulation state.')
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 86_400)
    throw new RangeError('Advance duration must be a safe integer from 0 through 86400 seconds.')
  if (state.phase === 'debrief' || seconds === 0) return state
  let next = state
  for (let second = 0; second < seconds; second += 1) {
    next = advanceOneSecond(next, scenario)
  }
  return next
}

function assessmentObservation(
  state: IcuSimulationState,
  command: Extract<IcuCommand, { type: 'assessment.order' }>,
): { observation: IcuObservation; randomState: number } {
  const patient = state.patient
  const random = nextIcuRandom(state.randomState)
  const noise = (random.value - 0.5) * 0.04
  const withNoise = (value: number) => roundTo(value * (1 + noise), 2)
  let values: Readonly<Record<string, number | string | boolean | null>>
  let delaySeconds = 0
  if (command.assessmentId === 'abg') {
    delaySeconds = 60
    values = {
      paO2MmHg: withNoise(patient.respiratory.paO2MmHg),
      paCO2MmHg: withNoise(patient.respiratory.paCO2MmHg),
      pH: roundTo(patient.respiratory.pH + noise * 0.05, 3),
      bicarbonateMmolL: withNoise(patient.respiratory.bicarbonateMmolL),
    }
  } else if (command.assessmentId === 'core-labs') {
    delaySeconds = 120
    values = {
      hemoglobinGdl: withNoise(patient.hematology.hemoglobinGdl),
      plateletCountK: withNoise(patient.hematology.plateletCountK),
      creatinineMgDl: withNoise(patient.renal.creatinineMgDl),
      bunMgDl: withNoise(patient.renal.bunMgDl),
      potassiumMmolL: withNoise(patient.renal.potassiumMmolL),
    }
  } else if (command.assessmentId === 'lactate') {
    delaySeconds = 90
    values = { lactateMmolL: withNoise(patient.perfusion.lactateMmolL) }
  } else if (command.assessmentId === 'coagulation') {
    delaySeconds = 120
    values = {
      inr: withNoise(patient.hematology.inr),
      plateletCountK: withNoise(patient.hematology.plateletCountK),
    }
  } else if (command.assessmentId === 'focused-echo') {
    values = {
      lvContractility: patient.hemodynamics.leftVentricularContractility,
      rvContractility: patient.hemodynamics.rightVentricularContractility,
      pericardialPressureSignal: patient.hemodynamics.pericardialPressureMmHg,
      rvPressureLoad: patient.hemodynamics.pulmonaryVascularResistanceWU,
    }
  } else if (command.assessmentId === 'pac') {
    values = {
      rapMmHg: withNoise(patient.hemodynamics.rapMmHg),
      meanPapMmHg: withNoise(patient.hemodynamics.meanPapMmHg),
      pawpMmHg: withNoise(patient.hemodynamics.pawpMmHg),
      cardiacOutputLMin: withNoise(patient.hemodynamics.effectiveSystemicFlowLMin),
      systemicVascularResistanceDynSecCm5: withNoise(
        patient.hemodynamics.systemicVascularResistanceDynSecCm5,
      ),
    }
  } else if (command.assessmentId === 'bedside-exam') {
    values = {
      capillaryRefillSeconds: patient.perfusion.capillaryRefillSeconds,
      mottlingScore: patient.perfusion.mottlingScore,
      jugularVenousPressureMmHg: patient.hemodynamics.rapMmHg,
      urineOutputMlHour: patient.renal.urineOutputMlHour,
    }
  } else {
    delaySeconds = 120
    values = {
      bilateralOpacityBurden: roundTo(patient.drivers.lungInjurySeverity, 2),
      pulmonaryCongestionSignal: roundTo(patient.hemodynamics.pawpMmHg / 30, 2),
    }
  }
  const now = state.clock.elapsedSeconds
  return {
    observation: {
      id: `${command.assessmentId}:${now}:${state.observations.length}`,
      assessmentId: command.assessmentId,
      observedAtSeconds: now,
      availableAtSeconds: now + delaySeconds,
      values,
    },
    randomState: random.nextState,
  }
}

function recordReplayCommand(state: IcuSimulationState, command: IcuCommand): IcuSimulationState {
  if (state.replay.commands.length >= ICU_MAX_REPLAY_COMMANDS) {
    throw new Error('Replay command limit reached; complete or restart the synthetic session.')
  }
  const sequence = state.replay.commands.length
  return {
    ...state,
    replay: {
      ...state.replay,
      commands: [
        ...state.replay.commands,
        { sequence, issuedAtSeconds: state.clock.elapsedSeconds, command },
      ],
    },
  }
}

function commandRecord(
  state: IcuSimulationState,
  command: IcuCommand,
  permitted: boolean,
): IcuEventRecord {
  const kind: IcuEventRecord['kind'] =
    command.type === 'assessment.order'
      ? 'assessment'
      : command.type === 'patient.reassess'
        ? 'reassessment'
        : command.type === 'care.perform'
          ? 'care'
          : command.type === 'alarm.acknowledge'
            ? 'alarm'
            : command.type.startsWith('therapy.')
              ? 'therapy'
              : 'system'
  const label = (() => {
    if (!permitted) return 'Action unavailable in this scenario or state'
    if (command.type === 'assessment.order')
      return `Order ${command.assessmentId.replaceAll('-', ' ')}`
    if (command.type === 'diagnosis.commit')
      return `Commit working classification: ${command.classification.replaceAll('-', ' ')}`
    if (command.type === 'therapy.prepare')
      return `Prepare ${command.configuration ?? command.therapy}`
    if (command.type === 'therapy.start') return `Start ${command.therapy}`
    if (command.type === 'therapy.stop') return `Stop ${command.therapy}`
    if (command.type === 'therapy.adjust')
      return `Adjust ${command.therapy} ${command.control} to ${String(command.value)}`
    if (command.type === 'care.perform')
      return `Perform ${command.interventionId.replaceAll('-', ' ')}`
    if (command.type === 'patient.reassess') return `Reassess ${command.domains.join(', ')}`
    if (command.type === 'alarm.acknowledge') return 'Acknowledge active alarm'
    if (command.type === 'sandbox.adjust')
      return `Adjust sandbox ${command.driver} to ${command.value}`
    if (command.type === 'time.advance') return `Advance simulation ${command.seconds} seconds`
    return 'Complete scenario and open debrief'
  })()
  return {
    id: `command:${state.replay.commands.length}:${state.clock.elapsedSeconds}`,
    elapsedSeconds: state.clock.elapsedSeconds,
    kind,
    code: permitted ? command.type : `${command.type}:rejected`,
    label,
  }
}

function hasPostInterventionInterval(state: IcuSimulationState): boolean {
  const intervention = [...state.replay.commands]
    .reverse()
    .find(
      ({ command }) =>
        command.type === 'therapy.start' ||
        command.type === 'therapy.adjust' ||
        command.type === 'care.perform',
    )
  return intervention ? state.clock.elapsedSeconds - intervention.issuedAtSeconds >= 60 : false
}

export function applyIcuCommand(
  state: IcuSimulationState,
  scenario: IcuScenarioDefinition,
  command: IcuCommand,
): IcuSimulationState {
  if (state.scenarioId !== scenario.id || state.scenarioVersion !== scenario.version)
    throw new Error('Scenario version does not match simulation state.')
  const attemptedActionIds = actionIdsForIcuCommand(command, state)
  const permitted = commandPermitted(state, scenario, command)
  const newCriticalErrors = scenario.criticalErrors
    .filter((error) => attemptedActionIds.includes(error.actionId))
    .map((error) => error.id)
  let next = recordReplayCommand(state, command)
  next = {
    ...next,
    history: [...next.history, commandRecord(state, command, permitted)].slice(
      -ICU_MAX_EVENT_HISTORY,
    ),
    outcome: {
      ...next.outcome,
      criticalErrorIds: uniqueSorted([...next.outcome.criticalErrorIds, ...newCriticalErrors]),
    },
  }
  if (!permitted) return { ...next, outcome: scoreIcuSimulation(next, scenario) }

  if (command.type === 'time.advance') {
    return advanceIcuSimulation(next, scenario, command.seconds)
  }

  const snapshot = makeSnapshot(next)
  const devices: IcuDeviceStates = {
    ventilator: icuVentilatorAdapter.reduce(next.devices.ventilator, command, snapshot),
    ecmo: icuEcmoAdapter.reduce(next.devices.ecmo, command, snapshot),
    mcs: icuMcsAdapter.reduce(next.devices.mcs, command, snapshot),
    crrt: icuCrrtAdapter.reduce(next.devices.crrt, command, snapshot),
  }
  let patient = next.patient
  let observations = next.observations
  let randomState = next.randomState
  let diagnosis = next.diagnosis
  let reassessedDomains = next.reassessedDomains
  let alarms = next.alarms
  let creditedActionIds = [...attemptedActionIds]

  if (command.type === 'care.perform')
    patient = applyCareIntervention(patient, command.interventionId)
  if (command.type === 'assessment.order') {
    const result = assessmentObservation(next, command)
    observations = [...observations, result.observation].slice(-ICU_MAX_TREND_SAMPLES)
    randomState = result.randomState
  }
  if (command.type === 'diagnosis.commit') {
    const commitment = {
      sequence: diagnosis.commitments.length,
      classification: command.classification,
      committedAtSeconds: next.clock.elapsedSeconds,
    }
    diagnosis = {
      committed: true,
      classification: command.classification,
      committedAtSeconds: next.clock.elapsedSeconds,
      commitments: [...diagnosis.commitments, commitment].slice(-ICU_MAX_DIAGNOSIS_COMMITMENTS),
    }
  }
  if (command.type === 'sandbox.adjust') {
    patient = {
      ...patient,
      drivers: { ...patient.drivers, [command.driver]: command.value },
    }
  }
  if (command.type === 'patient.reassess') {
    if (!hasPostInterventionInterval(state)) creditedActionIds = []
    reassessedDomains = uniqueSorted([
      ...reassessedDomains,
      ...command.domains,
    ]) as IcuSimulationState['reassessedDomains']
  }
  if (command.type === 'alarm.acknowledge') {
    alarms = alarms.map((alarm) =>
      alarm.id === command.alarmId
        ? { ...alarm, acknowledgedAtSeconds: next.clock.elapsedSeconds }
        : alarm,
    )
  }
  if (
    command.type === 'therapy.adjust' &&
    JSON.stringify(devices[command.therapy]) === JSON.stringify(next.devices[command.therapy])
  )
    creditedActionIds = []
  if (command.type === 'therapy.start' && devices[command.therapy].status !== 'running')
    creditedActionIds = []
  if (command.type === 'care.perform' && JSON.stringify(patient) === JSON.stringify(next.patient))
    creditedActionIds = []
  let performedActionIds = uniqueSorted([...next.performedActionIds, ...creditedActionIds])
  let actionHistory = [
    ...next.actionHistory,
    ...creditedActionIds.map((actionId) => ({
      actionId,
      sequence: next.replay.commands.length - 1,
      elapsedSeconds: next.clock.elapsedSeconds,
    })),
  ].slice(-ICU_MAX_REPLAY_COMMANDS * 2)
  let compartments = next.compartments
  let circulationParameters = next.circulationParameters
  if (command.type === 'care.perform' || command.type === 'sandbox.adjust') {
    compartments = reconcileCompartmentVolume(compartments, patient)
    circulationParameters = deriveIcuCirculationParameters(patient, devices)
  }
  let phase = next.phase
  let completed = next.outcome.completed
  if (command.type === 'session.complete') {
    completed = true
    phase = 'debrief'
    const classificationForScore =
      next.mode === 'assess'
        ? (diagnosis.commitments[0]?.classification ?? null)
        : diagnosis.classification
    if (classificationForScore === scenario.expectedClassification) {
      performedActionIds = uniqueSorted([...performedActionIds, 'diagnosis:correct'])
      actionHistory = [
        ...actionHistory,
        {
          actionId: 'diagnosis:correct',
          sequence: next.replay.commands.length - 1,
          elapsedSeconds: next.clock.elapsedSeconds,
        },
      ]
    }
  }
  next = {
    ...next,
    patient,
    devices,
    compartments,
    circulationParameters,
    diagnosis,
    observations,
    randomState,
    reassessedDomains,
    alarms,
    performedActionIds,
    actionHistory,
    phase,
  }
  return { ...next, outcome: scoreIcuSimulation(next, scenario, completed) }
}
