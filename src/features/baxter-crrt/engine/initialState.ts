import { initialBaxterCrrtDeviceId, prismaxDeviceProfile } from '../content/deviceProfiles'
import { BAXTER_CRRT_CONTENT_VERSION } from '../content/versions'
import { getCrrtDeviceCalculationAdapter } from './deviceAdapters/calculations'
import { getBaxterCrrtDeviceAdapter } from './deviceAdapters/registry'
import { emptyExternalFluidRates, emptyFluidLedgerTotals } from './fluidModel'
import { buildSeededEventQueue, deriveDeterministicSeed } from './seededRandom'
import type {
  CircuitState,
  CreateCrrtStateOptions,
  CrrtDeviceState,
  CrrtFlowRates,
  CrrtSimulationState,
  DeliveredTherapyState,
  DowntimeReason,
  EngineModelConfiguration,
  FilterState,
  ScenarioState,
} from './types'

export const CRRT_ENGINE_VERSION = '1.0.0'
export const CRRT_SCHEMA_VERSION = '2.0.0'
export const CRRT_CONTENT_VERSION = BAXTER_CRRT_CONTENT_VERSION
export const CRRT_PRISMAX_PROFILE_VERSION = prismaxDeviceProfile.profileVersion

export const zeroCrrtFlowRates: CrrtFlowRates = Object.freeze({
  bloodFlowMlMin: 0,
  dialysateFlowMlHour: 0,
  pbpFlowMlHour: 0,
  preReplacementFlowMlHour: 0,
  postReplacementFlowMlHour: 0,
  patientFluidRemovalMlHour: 0,
  syringeFlowMlHour: 0,
  makeupFlowMlHour: 0,
})

export const emptyEngineModelConfiguration: EngineModelConfiguration = Object.freeze({
  pressure: null,
  filter: null,
  hemodynamic: null,
  filterInletConcentrationFraction: null,
  filtrationFraction: null,
  reviewStatus: 'pending',
  sourceIds: [],
})

const emptyFilter: FilterState = Object.freeze({
  filterId: null,
  effectivePermeabilityFraction: 0,
  foulingBurdenFraction: 0,
  clotBurdenFraction: 0,
  bloodFlowInterruptionFraction: 0,
  lowEffectiveBloodFlowFraction: 0,
  procoagulantBurdenFraction: 0,
})

const emptyCircuit: CircuitState = Object.freeze({
  modality: null,
  flows: zeroCrrtFlowRates,
  anticoagulation: 'none',
  filter: emptyFilter,
  airDetected: false,
  bloodLeakDetected: false,
  bags: [],
  pressures: {
    inputConvention: 'raw-sensor' as const,
    accessPressureMmHg: null,
    filterPressureMmHg: null,
    returnPressureMmHg: null,
    effluentPressureMmHg: null,
    prismaxTransmembranePressureMmHg: null,
    prismaxFilterPressureDropMmHg: null,
  },
  citrate: {
    status: 'conceptual-direction-only' as const,
    linkedTrendDirections: {
      systemicIonizedCalcium: 'unknown' as const,
      totalCalciumRelationship: 'unknown' as const,
      acidBase: 'unknown' as const,
      circuitDelivery: 'unknown' as const,
    },
    safetyChecks: [
      'verify-sampling-and-timing',
      'verify-circuit-and-delivery-context',
      'verify-authorized-local-protocol-context',
    ] as const,
    reassessmentRequired: true as const,
    escalationBoundary: 'responsible-clinical-team-and-local-protocol' as const,
    reviewStatus: 'pending' as const,
    sourceIds: ['REVIEW-CKRT-CORE-2025'] as const,
  },
})

function createEmptyDevice(deviceId: CrrtSimulationState['deviceId']): CrrtDeviceState {
  return getBaxterCrrtDeviceAdapter(deviceId).createInitialDeviceState()
}

const emptyDowntime: Readonly<Record<DowntimeReason, number>> = Object.freeze({
  'not-started': 0,
  paused: 0,
  access: 0,
  alarm: 0,
  'bag-scale': 0,
  other: 0,
})

function createDeliveredTherapyState(
  options: CreateCrrtStateOptions,
  deviceId: CrrtSimulationState['deviceId'],
): DeliveredTherapyState {
  const fixture = options.fixture
  if (!fixture) {
    return {
      prescribedEffluentRateMlHour: null,
      prescribedEffluentDoseMlKgHour: null,
      cumulativeActualEffluentMl: 0,
      deliveredDoseMlKgHour: null,
      chartingWindowSeconds: 0,
      cumulativeDowntimeSeconds: 0,
      downtimeSecondsByReason: emptyDowntime,
      cumulativeMachinePatientFluidRemovalMl: 0,
      cumulativeWholePatientBalanceMl: 0,
      fluidLedger: emptyFluidLedgerTotals,
      filtrationFraction: null,
      treatmentTimeSeconds: 0,
      setTimeSeconds: 0,
    }
  }

  const calculations = getCrrtDeviceCalculationAdapter(deviceId)
  const prescribedEffluentRateMlHour = calculations.calculateEffluentPumpTargetMlPerHour(
    fixture.prescription.flows,
  )
  return {
    prescribedEffluentRateMlHour,
    prescribedEffluentDoseMlKgHour: calculations.calculateEffluentDoseMlPerKgHour(
      prescribedEffluentRateMlHour,
      fixture.patient.bodyWeightKg,
    ),
    cumulativeActualEffluentMl: 0,
    deliveredDoseMlKgHour: null,
    chartingWindowSeconds: 0,
    cumulativeDowntimeSeconds: 0,
    downtimeSecondsByReason: { ...emptyDowntime },
    cumulativeMachinePatientFluidRemovalMl: 0,
    cumulativeWholePatientBalanceMl: 0,
    fluidLedger: { ...emptyFluidLedgerTotals },
    filtrationFraction: null,
    treatmentTimeSeconds: 0,
    setTimeSeconds: 0,
  }
}

function cloneCircuit(options: CreateCrrtStateOptions): CircuitState {
  const fixture = options.fixture
  if (!fixture) return emptyCircuit
  return {
    ...emptyCircuit,
    modality: fixture.prescription.modality,
    flows: { ...fixture.prescription.flows },
    anticoagulation: fixture.prescription.anticoagulation,
    filter: { ...emptyFilter },
    bags: (fixture.bags ?? []).map((bag) => ({ ...bag, sourceIds: [...bag.sourceIds] })),
    pressures: { ...emptyCircuit.pressures },
    citrate: { ...emptyCircuit.citrate },
  }
}

function cloneScenario(options: CreateCrrtStateOptions, seed: number): ScenarioState {
  const fixture = options.fixture
  if (!fixture) {
    return {
      status: 'unloaded',
      fixtureId: null,
      reviewStatus: 'pending',
      activeFaults: [],
      eventQueue: [],
      appliedEventIds: [],
      externalFluidRates: { ...emptyExternalFluidRates },
      unintendedDeviceNetGainRateMlHour: 0,
      modelConfiguration: { ...emptyEngineModelConfiguration },
      sourceIds: [],
    }
  }
  return {
    status: 'loaded',
    fixtureId: fixture.id,
    reviewStatus: fixture.reviewStatus,
    activeFaults: [],
    eventQueue: buildSeededEventQueue(fixture.events, seed),
    appliedEventIds: [],
    externalFluidRates: { ...fixture.externalFluidRates },
    unintendedDeviceNetGainRateMlHour: fixture.unintendedDeviceNetGainRateMlHour,
    modelConfiguration: {
      ...fixture.modelConfiguration,
      pressure: fixture.modelConfiguration.pressure
        ? {
            ...fixture.modelConfiguration.pressure,
            sourceIds: [...fixture.modelConfiguration.pressure.sourceIds],
          }
        : null,
      filter: fixture.modelConfiguration.filter
        ? {
            ...fixture.modelConfiguration.filter,
            anticoagulationProtectionFraction: {
              ...fixture.modelConfiguration.filter.anticoagulationProtectionFraction,
            },
            sourceIds: [...fixture.modelConfiguration.filter.sourceIds],
          }
        : null,
      hemodynamic: fixture.modelConfiguration.hemodynamic
        ? {
            ...fixture.modelConfiguration.hemodynamic,
            sourceIds: [...fixture.modelConfiguration.hemodynamic.sourceIds],
          }
        : null,
      sourceIds: [...fixture.modelConfiguration.sourceIds],
    },
    sourceIds: [...fixture.sourceIds],
  }
}

export function createInitialCrrtSimulationState(
  options: CreateCrrtStateOptions = {},
): CrrtSimulationState {
  const experience = options.experience ?? 'orientation'
  const roleLens = options.roleLens ?? 'integrated'
  const attempt = options.attempt ?? 1
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new RangeError('Attempt must be a positive integer.')
  }
  const seed =
    options.seed ?? deriveDeterministicSeed(options.fixture?.id ?? 'unloaded', experience, attempt)
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('Seed must be an unsigned 32-bit integer.')
  }
  const deviceId = options.deviceId ?? initialBaxterCrrtDeviceId
  return {
    engineVersion: CRRT_ENGINE_VERSION,
    schemaVersion: CRRT_SCHEMA_VERSION,
    contentVersion: CRRT_CONTENT_VERSION,
    deviceProfileVersion: CRRT_PRISMAX_PROFILE_VERSION,
    protocolProfileVersion: null,
    simulationTimeSeconds: 0,
    seed,
    randomState: seed,
    nextAlarmSequence: 0,
    nextInterventionSequence: 0,
    experience,
    deviceId,
    roleLens,
    patient: options.fixture
      ? {
          ...options.fixture.patient,
          solutes: Object.fromEntries(
            Object.entries(options.fixture.patient.solutes).map(([id, pool]) => [
              id,
              pool ? { ...pool, sourceIds: [...pool.sourceIds] } : pool,
            ]),
          ),
          sourceIds: [...options.fixture.patient.sourceIds],
        }
      : { status: 'unconfigured', synthetic: true, reviewStatus: 'pending', sourceIds: [] },
    access: options.fixture
      ? { ...options.fixture.access, sourceIds: [...options.fixture.access.sourceIds] }
      : { status: 'unconfigured', reviewStatus: 'pending', sourceIds: [] },
    circuit: cloneCircuit(options),
    prescription: options.fixture
      ? {
          ...options.fixture.prescription,
          flows: { ...options.fixture.prescription.flows },
          sourceIds: [...options.fixture.prescription.sourceIds],
        }
      : {
          status: 'unconfigured',
          modality: null,
          flows: zeroCrrtFlowRates,
          anticoagulation: 'none',
          reviewStatus: 'pending',
          sourceIds: [],
        },
    device: createEmptyDevice(deviceId),
    deliveredTherapy: createDeliveredTherapyState(options, deviceId),
    scenario: cloneScenario(options, seed),
    alarms: [],
    alarmHistory: [],
    interventions: [],
    trends: [],
  }
}
