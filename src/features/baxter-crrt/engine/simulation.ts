import { reconcileEngineAlarms } from './alarms'
import { getCrrtDeviceCalculationAdapter } from './deviceAdapters/calculations'
import { advanceFilterProgression } from './filterModel'
import {
  advanceBagCollection,
  advanceFluidLedger,
  calculateWholePatientNetBalanceMl,
} from './fluidModel'
import { advancePatientFluidTolerance } from './patientModel'
import { canEnterRunningState } from './readiness'
import { calculateSyntheticBloodCircuitPressures } from './pressureModel'
import { advanceSolutePools } from './soluteModel'
import {
  crrtSoluteIds,
  type ConfiguredAccessState,
  type CrrtDeviceState,
  type CrrtEngineFaultId,
  type CrrtScheduledEvent,
  type CrrtScheduledEventAction,
  type CrrtSimulationState,
  type CrrtSoluteId,
  type DowntimeReason,
  type InterventionRecord,
  type PressureModelParameters,
  type TrendSample,
} from './types'

export const CRRT_CANONICAL_STEP_SECONDS = 60
export const CRRT_TREND_INTERVAL_SECONDS = 300
export const CRRT_MAX_TREND_SAMPLES = 288
export const CRRT_MAX_INTERVENTION_RECORDS = 200
export const CRRT_VOLUME_EQUIVALENCE_TOLERANCE_ML = 0.000001
export const CRRT_MODEL_EQUIVALENCE_TOLERANCE = 0.000000001

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function validateAdvanceSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new RangeError('Time advance must be finite and nonnegative.')
  }
  return seconds
}

export function deviceStateForDeliveryState(
  previous: CrrtDeviceState,
  deliveryState: CrrtDeviceState['deliveryState'],
): CrrtDeviceState {
  if (deliveryState === 'running') {
    return {
      ...previous,
      deliveryState,
      bloodPumpRunning: true,
      fluidPumpsRunning: true,
      patientConnected: true,
      returnClampClosed: false,
    }
  }
  if (deliveryState === 'paused') {
    return {
      ...previous,
      deliveryState,
      bloodPumpRunning: false,
      fluidPumpsRunning: false,
    }
  }
  return {
    ...previous,
    deliveryState,
    bloodPumpRunning: false,
    fluidPumpsRunning: false,
    patientConnected: false,
    returnClampClosed: true,
  }
}

function withFault(
  state: CrrtSimulationState,
  fault: CrrtEngineFaultId,
  active: boolean,
): CrrtSimulationState {
  if (!active && !state.scenario.activeFaults.includes(fault)) return state
  const activeFaults = active
    ? [...new Set([...state.scenario.activeFaults, fault])]
    : state.scenario.activeFaults.filter((candidate) => candidate !== fault)
  let access = state.access
  if (access.status === 'configured') {
    if (fault === 'access-disconnection') access = { ...access, accessConnected: !active }
    if (fault === 'return-disconnection') access = { ...access, returnConnected: !active }
  }
  return {
    ...state,
    access,
    circuit: {
      ...state.circuit,
      airDetected: fault === 'air-detected' ? active : state.circuit.airDetected,
      bloodLeakDetected: fault === 'blood-leak-detected' ? active : state.circuit.bloodLeakDetected,
    },
    scenario: { ...state.scenario, activeFaults },
  }
}

export function appendIntervention(
  state: CrrtSimulationState,
  type: InterventionRecord['type'],
  source: InterventionRecord['source'],
): CrrtSimulationState {
  const record: InterventionRecord = {
    id: `${source}:${type}:${state.simulationTimeSeconds}:${state.nextInterventionSequence}`,
    type,
    atSeconds: state.simulationTimeSeconds,
    source,
  }
  return {
    ...state,
    interventions: [...state.interventions, record].slice(-CRRT_MAX_INTERVENTION_RECORDS),
    nextInterventionSequence: state.nextInterventionSequence + 1,
  }
}

export function applyScheduledEventAction(
  state: CrrtSimulationState,
  action: CrrtScheduledEventAction,
): CrrtSimulationState {
  if (action.type === 'SET_FAULT') return withFault(state, action.fault, action.active)
  if (action.type === 'SET_EXTERNAL_FLUID_RATE') {
    if (!Number.isFinite(action.rateMlHour) || action.rateMlHour < 0) {
      throw new RangeError('External fluid rates must be finite and nonnegative.')
    }
    return {
      ...state,
      scenario: {
        ...state.scenario,
        externalFluidRates: {
          ...state.scenario.externalFluidRates,
          [action.field]: action.rateMlHour,
        },
      },
    }
  }
  if (action.type === 'SET_ACCESS_RESISTANCE') {
    if (state.access.status !== 'configured') return state
    if (!Number.isFinite(action.resistanceMmHgPerMlMin) || action.resistanceMmHgPerMlMin < 0) {
      throw new RangeError('Access resistance must be finite and nonnegative.')
    }
    return {
      ...state,
      access: { ...state.access, accessResistanceMmHgPerMlMin: action.resistanceMmHgPerMlMin },
    }
  }
  if (action.type === 'SET_RETURN_RESISTANCE') {
    if (state.access.status !== 'configured') return state
    if (!Number.isFinite(action.resistanceMmHgPerMlMin) || action.resistanceMmHgPerMlMin < 0) {
      throw new RangeError('Return resistance must be finite and nonnegative.')
    }
    return {
      ...state,
      access: { ...state.access, returnResistanceMmHgPerMlMin: action.resistanceMmHgPerMlMin },
    }
  }
  if (action.type === 'SET_FILTER_RISK') {
    if (
      !Number.isFinite(action.procoagulantBurdenFraction) ||
      !Number.isFinite(action.lowEffectiveBloodFlowFraction) ||
      action.procoagulantBurdenFraction < 0 ||
      action.procoagulantBurdenFraction > 1 ||
      action.lowEffectiveBloodFlowFraction < 0 ||
      action.lowEffectiveBloodFlowFraction > 1
    ) {
      throw new RangeError('Filter-risk fractions must be between zero and one.')
    }
    return {
      ...state,
      circuit: {
        ...state.circuit,
        filter: {
          ...state.circuit.filter,
          procoagulantBurdenFraction: action.procoagulantBurdenFraction,
          lowEffectiveBloodFlowFraction: action.lowEffectiveBloodFlowFraction,
        },
      },
    }
  }
  if (action.type === 'SET_DELIVERY_STATE') {
    if (action.deliveryState === 'running' && !canEnterRunningState(state)) return state
    return { ...state, device: deviceStateForDeliveryState(state.device, action.deliveryState) }
  }
  if (action.type === 'SET_OBSERVED_EFFLUENT_PRESSURE') {
    if (!Number.isFinite(action.pressureMmHg)) {
      throw new RangeError('Observed effluent pressure must be finite.')
    }
    const pressure = state.scenario.modelConfiguration.pressure
    if (!pressure) return state
    return {
      ...state,
      scenario: {
        ...state.scenario,
        modelConfiguration: {
          ...state.scenario.modelConfiguration,
          pressure: { ...pressure, observedEffluentPressureMmHg: action.pressureMmHg },
        },
      },
    }
  }
  return assertNever(action)
}

function applyDueEvents(state: CrrtSimulationState): CrrtSimulationState {
  const due = state.scenario.eventQueue.filter(
    (event) =>
      event.scheduledAtSeconds <= state.simulationTimeSeconds + Number.EPSILON &&
      !state.scenario.appliedEventIds.includes(event.id),
  )
  if (due.length === 0) return state

  let next = state
  for (const event of due) {
    next = applyScheduledEventAction(next, event.action)
    next = appendIntervention(next, event.action.type, 'engine-event')
    next = {
      ...next,
      scenario: {
        ...next.scenario,
        appliedEventIds: [...next.scenario.appliedEventIds, event.id],
      },
    }
  }
  const recomputed = recomputeCrrtDerivedState(next)
  return recomputed.trends.at(-1)?.timeSeconds === recomputed.simulationTimeSeconds
    ? appendTrendIfDue(recomputed)
    : recomputed
}

function nextPendingEvent(state: CrrtSimulationState): CrrtScheduledEvent | undefined {
  return state.scenario.eventQueue.find(
    (event) =>
      event.scheduledAtSeconds > state.simulationTimeSeconds + Number.EPSILON &&
      !state.scenario.appliedEventIds.includes(event.id),
  )
}

function downtimeReason(state: CrrtSimulationState): DowntimeReason | null {
  if (state.device.deliveryState === 'idle') return 'not-started'
  if (state.device.deliveryState === 'paused') return 'paused'
  if (state.device.deliveryState === 'ended') return 'other'
  if (
    !state.device.patientConnected ||
    state.access.status !== 'configured' ||
    !state.access.accessConnected ||
    !state.access.returnConnected ||
    state.scenario.activeFaults.includes('access-disconnection') ||
    state.scenario.activeFaults.includes('return-disconnection')
  ) {
    return 'access'
  }
  return null
}

function accessDysfunctionFraction(access: ConfiguredAccessState): number {
  return clamp01(
    Math.max(
      access.accessConnected && access.returnConnected ? 0 : 1,
      access.recirculationFraction,
      access.partialThrombusFraction,
      access.accessKinked || access.returnKinked ? 1 : 0,
      access.positionResistanceMultiplier - 1,
    ),
  )
}

function derivePressures(
  state: CrrtSimulationState,
  parameters: PressureModelParameters | null,
): CrrtSimulationState {
  if (!parameters || state.access.status !== 'configured') {
    return {
      ...state,
      circuit: {
        ...state.circuit,
        pressures: {
          inputConvention: 'raw-sensor',
          accessPressureMmHg: null,
          filterPressureMmHg: null,
          returnPressureMmHg: null,
          effluentPressureMmHg: null,
          prismaxTransmembranePressureMmHg: null,
          prismaxFilterPressureDropMmHg: null,
        },
      },
    }
  }

  const accessMultiplier =
    state.access.positionResistanceMultiplier *
    (state.access.accessKinked ? parameters.accessKinkResistanceMultiplier : 1) *
    (1 +
      parameters.partialThrombusResistanceGainAtFullBurden * state.access.partialThrombusFraction)
  const returnMultiplier = state.access.returnKinked ? parameters.returnKinkResistanceMultiplier : 1
  const filterResistance =
    parameters.filterResistanceMmHgPerMlMin +
    parameters.foulingResistanceGainMmHgPerMlMinAtFullBurden *
      state.circuit.filter.foulingBurdenFraction +
    parameters.clotResistanceGainMmHgPerMlMinAtFullBurden * state.circuit.filter.clotBurdenFraction
  const raw = calculateSyntheticBloodCircuitPressures({
    bloodFlowMlPerMinute:
      state.device.bloodPumpRunning && state.access.accessConnected && state.access.returnConnected
        ? state.circuit.flows.bloodFlowMlMin
        : 0,
    accessReferencePressureMmHg: parameters.accessReferencePressureMmHg,
    returnReferencePressureMmHg: parameters.returnReferencePressureMmHg,
    accessResistanceMmHgPerMlPerMinute:
      state.access.accessResistanceMmHgPerMlMin * accessMultiplier,
    filterResistanceMmHgPerMlPerMinute: filterResistance,
    returnResistanceMmHgPerMlPerMinute:
      state.access.returnResistanceMmHgPerMlMin * returnMultiplier,
  })
  const accessPressureMmHg = state.access.accessConnected
    ? raw.accessPressureMmHg
    : parameters.disconnectedAccessPressureMmHg
  const returnPressureMmHg = state.access.returnConnected
    ? raw.returnPressureMmHg
    : parameters.disconnectedReturnPressureMmHg
  const filterPressureMmHg = raw.filterPressureMmHg
  const effluentPressureMmHg = parameters.observedEffluentPressureMmHg
  const displayPressures = getCrrtDeviceCalculationAdapter(
    state.deviceId,
  ).calculateDisplayedPressures({
    rawFilterPressureMmHg: filterPressureMmHg,
    rawReturnPressureMmHg: returnPressureMmHg,
    rawEffluentPressureMmHg: effluentPressureMmHg,
  })

  return {
    ...state,
    circuit: {
      ...state.circuit,
      pressures: {
        inputConvention: 'raw-sensor',
        accessPressureMmHg,
        filterPressureMmHg,
        returnPressureMmHg,
        effluentPressureMmHg,
        prismaxTransmembranePressureMmHg: displayPressures.transmembranePressureMmHg,
        prismaxFilterPressureDropMmHg: displayPressures.displayedFilterPressureDropMmHg,
      },
    },
  }
}

function appendTrendIfDue(state: CrrtSimulationState): CrrtSimulationState {
  const quotient = state.simulationTimeSeconds / CRRT_TREND_INTERVAL_SECONDS
  if (Math.abs(quotient - Math.round(quotient)) > 1e-9) return state
  const soluteConcentrationsPerLiter: Partial<Record<CrrtSoluteId, number>> = {}
  if (state.patient.status === 'configured') {
    for (const id of crrtSoluteIds) {
      const pool = state.patient.solutes[id]
      if (pool) soluteConcentrationsPerLiter[id] = pool.concentrationPerLiter
    }
  }
  const sample: TrendSample = {
    timeSeconds: state.simulationTimeSeconds,
    prescribedEffluentDoseMlKgHour: state.deliveredTherapy.prescribedEffluentDoseMlKgHour,
    deliveredDoseMlKgHour: state.deliveredTherapy.deliveredDoseMlKgHour,
    cumulativeActualEffluentMl: state.deliveredTherapy.cumulativeActualEffluentMl,
    cumulativeMachinePatientFluidRemovalMl:
      state.deliveredTherapy.cumulativeMachinePatientFluidRemovalMl,
    cumulativeWholePatientBalanceMl: state.deliveredTherapy.cumulativeWholePatientBalanceMl,
    accessPressureMmHg: state.circuit.pressures.accessPressureMmHg,
    filterPressureMmHg: state.circuit.pressures.filterPressureMmHg,
    returnPressureMmHg: state.circuit.pressures.returnPressureMmHg,
    transmembranePressureMmHg: state.circuit.pressures.prismaxTransmembranePressureMmHg,
    foulingBurdenFraction: state.circuit.filter.foulingBurdenFraction,
    clotBurdenFraction: state.circuit.filter.clotBurdenFraction,
    hemodynamicStressIndex:
      state.patient.status === 'configured' ? state.patient.hemodynamicStressIndex : null,
    soluteConcentrationsPerLiter,
  }
  const trends =
    state.trends.at(-1)?.timeSeconds === state.simulationTimeSeconds
      ? [...state.trends.slice(0, -1), sample]
      : [...state.trends, sample]
  return { ...state, trends: trends.slice(-CRRT_MAX_TREND_SAMPLES) }
}

function advanceContinuous(
  state: CrrtSimulationState,
  durationSeconds: number,
): CrrtSimulationState {
  if (durationSeconds === 0 || state.scenario.status !== 'loaded') {
    return { ...state, simulationTimeSeconds: state.simulationTimeSeconds + durationSeconds }
  }
  const prescription = state.prescription
  const patient = state.patient
  const calculations = getCrrtDeviceCalculationAdapter(state.deviceId)
  const baseDowntimeReason = downtimeReason(state)
  const deliveryRequested = baseDowntimeReason === null && prescription.status === 'configured'
  const flows = prescription.status === 'configured' ? prescription.flows : state.circuit.flows
  const targetEffluentMlHour =
    prescription.status === 'configured'
      ? calculations.calculateEffluentPumpTargetMlPerHour(flows)
      : 0

  const bagResult = advanceBagCollection(
    state.circuit.bags,
    flows,
    targetEffluentMlHour,
    durationSeconds,
    deliveryRequested,
  )
  const deliveryFraction = deliveryRequested ? bagResult.deliveryFraction : 0
  const actualEffluentMl = bagResult.actualPumpVolumeByTermMl.effluent
  const actualPfrRateMlHour = flows.patientFluidRemovalMlHour * deliveryFraction
  const nextLedger = advanceFluidLedger(
    state.deliveredTherapy.fluidLedger,
    state.scenario.externalFluidRates,
    actualPfrRateMlHour,
    state.scenario.unintendedDeviceNetGainRateMlHour,
    durationSeconds,
  )
  const previousWholeBalance = calculateWholePatientNetBalanceMl(state.deliveredTherapy.fluidLedger)
  const nextWholeBalance = calculateWholePatientNetBalanceMl(nextLedger)
  const chartingActive =
    state.device.deliveryState === 'running' || state.device.deliveryState === 'paused'
  const chartingWindowSeconds =
    state.deliveredTherapy.chartingWindowSeconds + (chartingActive ? durationSeconds : 0)
  const cumulativeActualEffluentMl =
    state.deliveredTherapy.cumulativeActualEffluentMl + actualEffluentMl
  const deliveredDoseMlKgHour =
    patient.status === 'configured' && chartingWindowSeconds > 0
      ? calculations.calculateEffluentDoseMlPerKgHour(
          cumulativeActualEffluentMl / (chartingWindowSeconds / 3600),
          patient.bodyWeightKg,
        )
      : null
  const partialBagDowntimeSeconds = deliveryRequested ? durationSeconds * (1 - deliveryFraction) : 0
  const downtimeIncrement = !chartingActive
    ? 0
    : baseDowntimeReason
      ? durationSeconds
      : partialBagDowntimeSeconds
  const downtimeSecondsByReason = { ...state.deliveredTherapy.downtimeSecondsByReason }
  if (baseDowntimeReason && chartingActive) {
    downtimeSecondsByReason[baseDowntimeReason] += durationSeconds
  } else if (chartingActive && partialBagDowntimeSeconds > 0) {
    downtimeSecondsByReason['bag-scale'] += partialBagDowntimeSeconds
  }

  let nextPatient = patient
  if (patient.status === 'configured') {
    const configuredFilterInletFraction =
      state.scenario.modelConfiguration.filterInletConcentrationFraction
    const filterInletFraction = configuredFilterInletFraction ?? 1
    nextPatient = {
      ...advancePatientFluidTolerance(
        patient,
        actualPfrRateMlHour,
        nextWholeBalance - previousWholeBalance,
        state.scenario.modelConfiguration.hemodynamic,
        durationSeconds,
      ),
      solutes: advanceSolutePools(
        patient.solutes,
        deliveryRequested && configuredFilterInletFraction !== null
          ? targetEffluentMlHour * deliveryFraction
          : 0,
        filterInletFraction,
        durationSeconds,
      ),
    }
  }

  let nextFilter = state.circuit.filter
  const filterParameters = state.scenario.modelConfiguration.filter
  const filtrationFraction = state.scenario.modelConfiguration.filtrationFraction
  if (
    filterParameters &&
    filtrationFraction !== null &&
    patient.status === 'configured' &&
    state.access.status === 'configured'
  ) {
    nextFilter = advanceFilterProgression(
      state.circuit.filter,
      {
        filtrationFraction,
        bloodFlowInterruptionFraction: 1 - deliveryFraction,
        lowEffectiveBloodFlowFraction: state.circuit.filter.lowEffectiveBloodFlowFraction,
        accessDysfunctionFraction: accessDysfunctionFraction(state.access),
        hematocritFraction: patient.hematocritFraction,
        procoagulantBurdenFraction: state.circuit.filter.procoagulantBurdenFraction,
        anticoagulation: prescription.anticoagulation,
      },
      filterParameters,
      durationSeconds,
    ).filter
  }

  let next: CrrtSimulationState = {
    ...state,
    simulationTimeSeconds: state.simulationTimeSeconds + durationSeconds,
    patient: nextPatient,
    circuit: {
      ...state.circuit,
      flows,
      bags: bagResult.bags,
      filter: nextFilter,
    },
    deliveredTherapy: {
      ...state.deliveredTherapy,
      cumulativeActualEffluentMl,
      deliveredDoseMlKgHour,
      chartingWindowSeconds,
      cumulativeDowntimeSeconds:
        state.deliveredTherapy.cumulativeDowntimeSeconds + downtimeIncrement,
      downtimeSecondsByReason,
      cumulativeMachinePatientFluidRemovalMl: nextLedger.machinePatientFluidRemovalMl,
      cumulativeWholePatientBalanceMl: nextWholeBalance,
      fluidLedger: nextLedger,
      filtrationFraction,
      treatmentTimeSeconds:
        state.deliveredTherapy.treatmentTimeSeconds + durationSeconds * deliveryFraction,
      setTimeSeconds: state.deliveredTherapy.setTimeSeconds + durationSeconds,
    },
  }
  next = derivePressures(next, next.scenario.modelConfiguration.pressure)
  next = reconcileEngineAlarms(next)
  return appendTrendIfDue(next)
}

export function advanceCrrtSimulation(
  state: CrrtSimulationState,
  requestedSeconds: number,
): CrrtSimulationState {
  let remainingSeconds = validateAdvanceSeconds(requestedSeconds)
  let next = applyDueEvents(state)

  while (remainingSeconds > Number.EPSILON) {
    const event = nextPendingEvent(next)
    const secondsUntilEvent = event
      ? Math.max(0, event.scheduledAtSeconds - next.simulationTimeSeconds)
      : Number.POSITIVE_INFINITY
    const nextTrendBoundary =
      (Math.floor(next.simulationTimeSeconds / CRRT_TREND_INTERVAL_SECONDS) + 1) *
      CRRT_TREND_INTERVAL_SECONDS
    const secondsUntilTrend = Math.max(0, nextTrendBoundary - next.simulationTimeSeconds)
    const stepSeconds = Math.min(
      CRRT_CANONICAL_STEP_SECONDS,
      remainingSeconds,
      secondsUntilEvent || Number.POSITIVE_INFINITY,
      secondsUntilTrend || Number.POSITIVE_INFINITY,
    )
    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0) {
      throw new Error('Unable to advance the CRRT simulation clock.')
    }
    next = advanceContinuous(next, stepSeconds)
    remainingSeconds = Math.max(0, remainingSeconds - stepSeconds)
    next = applyDueEvents(next)
  }

  return next
}

export function recomputeCrrtDerivedState(state: CrrtSimulationState): CrrtSimulationState {
  return reconcileEngineAlarms(derivePressures(state, state.scenario.modelConfiguration.pressure))
}

function assertNever(value: never): never {
  throw new Error(`Unhandled CRRT engine value: ${JSON.stringify(value)}`)
}
