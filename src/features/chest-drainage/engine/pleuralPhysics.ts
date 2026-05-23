import {
  DEFAULT_VISCOSITY_FACTOR,
  DRY_SUCTION_RESPONSE_LAG,
  MAX_COLLECTION_VOLUME_ML,
  MAX_DRY_SUCTION_CM_H2O,
  MIN_DRY_SUCTION_SOURCE_FLOW_LPM,
  SOURCE_FLOW_TO_SUCTION_CM_H2O,
  TUBE_CONDUCTANCE_CONSTANT,
} from './constants'
import type { PhysiologySummary, SimulationState, TrendPoint } from './types'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function frenchToOuterDiameterMm(frenchSize: number): number {
  return frenchSize / 3
}

export function estimateInternalRadiusCm(frenchSize: number): number {
  const outerDiameterMm = frenchToOuterDiameterMm(frenchSize)
  const estimatedInternalDiameterMm = outerDiameterMm * 0.72

  return estimatedInternalDiameterMm / 20
}

export function calculateTubeConductance(
  state: SimulationState,
  viscosityFactor = DEFAULT_VISCOSITY_FACTOR,
): number {
  if (state.tube.clamped || state.tube.kinked || !state.tube.sideHolesInChest) {
    return 0
  }

  const radiusCm = estimateInternalRadiusCm(state.tube.frenchSize)
  const loopPenalty = state.tube.dependentLoop ? 0.65 : 1
  const patency = clamp(state.tube.patency, 0, 1)

  return (
    TUBE_CONDUCTANCE_CONSTANT *
    radiusCm ** 4 *
    patency *
    loopPenalty *
    (1 / Math.max(viscosityFactor, 0.2))
  )
}

export function calculateWaterSealResistance(waterSealDepthCm: number): number {
  return 1 + clamp(waterSealDepthCm, 0, 8) / 2
}

export function calculateEffectiveWetSuction(
  suctionControlDepthCm: number,
  sourceSuctionFlowLpm: number,
): number {
  const sourceCapacity = clamp(sourceSuctionFlowLpm * SOURCE_FLOW_TO_SUCTION_CM_H2O, 0, 60)

  return -Math.min(Math.abs(suctionControlDepthCm), sourceCapacity)
}

export function calculateEffectiveDrySuction(
  targetSuctionCmH2O: number,
  sourceSuctionFlowLpm: number,
  responseLag = DRY_SUCTION_RESPONSE_LAG,
): number {
  const target = clamp(Math.abs(targetSuctionCmH2O), 0, MAX_DRY_SUCTION_CM_H2O)
  const sourceAdequacy = clamp(sourceSuctionFlowLpm / MIN_DRY_SUCTION_SOURCE_FLOW_LPM, 0, 1)

  return -target * sourceAdequacy * clamp(responseLag, 0, 1)
}

export function calculateEffectiveSuction(state: SimulationState): number {
  if (state.systemType === 'threeBottleWetSuction' || state.systemType === 'integratedWetSuction') {
    return calculateEffectiveWetSuction(
      state.device.suctionSettingCmH2O,
      state.device.sourceSuctionFlowLpm,
    )
  }

  if (
    state.systemType === 'integratedDrySuction' ||
    state.systemType === 'drySealDrySuction' ||
    state.systemType === 'digitalDrainage'
  ) {
    return calculateEffectiveDrySuction(
      state.device.suctionSettingCmH2O,
      state.device.sourceSuctionFlowLpm,
    )
  }

  return 0
}

export function calculateExpiratoryAirExit(state: SimulationState): number {
  const conductance = calculateTubeConductance(state)
  const pressureAboveSeal = Math.max(
    state.patient.pleuralPressureCmH2O - state.device.waterSealDepthCm,
    0,
  )

  return pressureAboveSeal * conductance * 42
}

export function estimateDigitalAirLeakMlMin(state: SimulationState): number {
  if (state.tube.clamped || state.tube.kinked || !state.tube.sideHolesInChest) {
    return 0
  }

  const conductance = calculateTubeConductance(state)
  const effectiveSuction = Math.abs(calculateEffectiveSuction(state))
  const leakDrive = state.patient.airLeakSeverity * 115
  const pressureDrive = calculateExpiratoryAirExit(state)
  const suctionDrive = Math.max(effectiveSuction - state.device.waterSealDepthCm, 0) * 1.6
  const coughSpike = state.patient.cough ? 55 : 0

  return Math.round((leakDrive + pressureDrive + suctionDrive + coughSpike) * conductance)
}

export function calculateDrainageFlowMlPerHr(state: SimulationState): number {
  if (state.tube.clamped || state.tube.kinked || state.device.canisterFull) {
    return 0
  }

  const patency = clamp(state.tube.patency, 0, 1)
  const heightEffect = clamp(state.device.heightBelowChestCm / 60, 0.25, 1.2)
  const suctionEffect = 1 + Math.abs(calculateEffectiveSuction(state)) / 80
  const loopPenalty = state.tube.dependentLoop ? 0.5 : 1
  const uprightPenalty = state.device.upright ? 1 : 0.25

  return Math.round(
    state.patient.fluidProductionMlPerHr *
      patency *
      heightEffect *
      suctionEffect *
      loopPenalty *
      uprightPenalty,
  )
}

export function getAirLeakMeterLevel(state: SimulationState): number {
  const leak = estimateDigitalAirLeakMlMin(state)

  if (leak <= 0) {
    return 0
  }

  return clamp(Math.ceil(leak / 22), 1, 5)
}

export function getFluidCollectionPercent(collectionVolumeMl: number): number {
  return clamp((collectionVolumeMl / MAX_COLLECTION_VOLUME_ML) * 100, 0, 100)
}

export function getPatientPressureFloatCmH2O(state: SimulationState): number {
  const ventilationSwing = state.patient.ventilation === 'positivePressure' ? 0.8 : -0.6
  const suctionOffset = calculateEffectiveSuction(state) / 22
  const coughOffset = state.patient.cough ? 0.7 : 0

  return Number(
    clamp(
      state.patient.pleuralPressureCmH2O / 4 + ventilationSwing + suctionOffset + coughOffset,
      -2,
      2,
    ).toFixed(1),
  )
}

export function calculateReExpansionRisk(state: SimulationState): number {
  const highNegativePressure = clamp(Math.abs(calculateEffectiveSuction(state)) / 40, 0, 1)
  const chronicCollapse = clamp(state.patient.chronicCollapse, 0, 1)
  const rapidExpansion = clamp(state.patient.rapidExpansion, 0, 1)

  return Number(
    clamp(
      chronicCollapse * 0.38 + rapidExpansion * 0.34 + highNegativePressure * 0.28,
      0,
      1,
    ).toFixed(2),
  )
}

export function usesDrySuctionIndicator(state: SimulationState): boolean {
  return (
    state.systemType === 'integratedDrySuction' ||
    state.systemType === 'drySealDrySuction' ||
    state.systemType === 'digitalDrainage'
  )
}

export function isDrySuctionSourceFlowAdequate(sourceSuctionFlowLpm: number): boolean {
  return sourceSuctionFlowLpm >= MIN_DRY_SUCTION_SOURCE_FLOW_LPM
}

export function isSuctionIndicatorPresent(state: SimulationState): boolean {
  if (!usesDrySuctionIndicator(state)) {
    return false
  }

  return isDrySuctionSourceFlowAdequate(state.device.sourceSuctionFlowLpm)
}

export function summarizePhysiology(state: SimulationState): PhysiologySummary {
  const effectiveSuctionCmH2O = calculateEffectiveSuction(state)
  const warnings: string[] = []

  if (state.tube.clamped && state.patient.airLeakSeverity > 0.2) {
    warnings.push('Tube is clamped while the modeled patient still has an active air leak.')
  }
  if (state.device.waterSealDepthCm < 1) {
    warnings.push(
      'Water seal depth is below the teaching fill range; one-way seal may be unreliable.',
    )
  }
  if (!state.device.upright) {
    warnings.push(
      'Drainage unit is not upright; chamber readings and seal integrity may be compromised.',
    )
  }
  if (usesDrySuctionIndicator(state) && !isSuctionIndicatorPresent(state)) {
    warnings.push(
      `Source suction is below the modeled dry-suction source threshold of ${MIN_DRY_SUCTION_SOURCE_FLOW_LPM} L/min.`,
    )
  }
  if (state.tube.dependentLoop) {
    warnings.push('Dependent loop is modeled; fluid drainage is slowed.')
  }

  return {
    tubeConductance: Number(calculateTubeConductance(state).toFixed(2)),
    effectiveSuctionCmH2O: Number(effectiveSuctionCmH2O.toFixed(1)),
    expiratoryAirExitMlMin: Number(calculateExpiratoryAirExit(state).toFixed(1)),
    digitalAirLeakMlMin: estimateDigitalAirLeakMlMin(state),
    drainageFlowMlPerHr: calculateDrainageFlowMlPerHr(state),
    airLeakMeterLevel: getAirLeakMeterLevel(state),
    fluidCollectionPercent: getFluidCollectionPercent(state.device.collectionVolumeMl),
    patientPressureFloatCmH2O: getPatientPressureFloatCmH2O(state),
    reExpansionRisk: calculateReExpansionRisk(state),
    suctionIndicatorPresent: isSuctionIndicatorPresent(state),
    warnings,
  }
}

export function buildTrendSeries(state: SimulationState, points = 18): TrendPoint[] {
  const leak = estimateDigitalAirLeakMlMin(state)
  const pressure = calculateEffectiveSuction(state)
  const drainage = calculateDrainageFlowMlPerHr(state)

  return Array.from({ length: points }, (_, index) => {
    const taper = 1 - index / Math.max(points * 1.8, 1)
    const respiratoryWave = Math.sin(index * 0.85) * 4
    const coughSpike = state.patient.cough && index === Math.floor(points * 0.55) ? 38 : 0

    return {
      minute: index * 5,
      airLeakMlMin: Math.max(0, Math.round(leak * taper + respiratoryWave + coughSpike)),
      pressureCmH2O: Number((pressure + Math.sin(index * 0.72) * 1.2).toFixed(1)),
      fluidMl: Math.round(state.device.collectionVolumeMl + (drainage / 12) * index),
    }
  })
}
