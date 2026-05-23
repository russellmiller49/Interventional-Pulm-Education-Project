export type DrainageSystemType =
  | 'oneBottleWaterSeal'
  | 'twoBottleWaterSeal'
  | 'threeBottleWetSuction'
  | 'integratedWetSuction'
  | 'integratedDrySuction'
  | 'drySealDrySuction'
  | 'digitalDrainage'
  | 'heimlichValve'

export type VentilationMode = 'spontaneous' | 'positivePressure'

export interface SimulationState {
  systemType: DrainageSystemType
  patient: {
    ventilation: VentilationMode
    lungCompliance: number
    pleuralPressureCmH2O: number
    airLeakSeverity: number
    fluidProductionMlPerHr: number
    cough: boolean
    chronicCollapse: number
    rapidExpansion: number
  }
  tube: {
    frenchSize: number
    patency: number
    kinked: boolean
    clamped: boolean
    dependentLoop: boolean
    sideHolesInChest: boolean
  }
  device: {
    waterSealDepthCm: number
    suctionSettingCmH2O: number
    sourceSuctionFlowLpm: number
    collectionVolumeMl: number
    upright: boolean
    heightBelowChestCm: number
    canisterFull: boolean
    batteryPct?: number
  }
}

export interface TrendPoint {
  minute: number
  airLeakMlMin: number
  pressureCmH2O: number
  fluidMl: number
}

export interface PhysiologySummary {
  tubeConductance: number
  effectiveSuctionCmH2O: number
  expiratoryAirExitMlMin: number
  digitalAirLeakMlMin: number
  drainageFlowMlPerHr: number
  airLeakMeterLevel: number
  fluidCollectionPercent: number
  patientPressureFloatCmH2O: number
  reExpansionRisk: number
  suctionIndicatorPresent: boolean
  warnings: string[]
}
