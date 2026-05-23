import type { SimulationState } from './types'

export const MAX_COLLECTION_VOLUME_ML = 2100
export const MAX_DRY_SUCTION_CM_H2O = 40
export const MIN_DRY_SUCTION_SOURCE_FLOW_LPM = 16
export const MIN_DRY_SUCTION_SOURCE_VACUUM_MMHG = 80
export const SOURCE_FLOW_TO_SUCTION_CM_H2O = 2.4
export const DRY_SUCTION_RESPONSE_LAG = 0.92
export const TUBE_CONDUCTANCE_CONSTANT = 90
export const DEFAULT_VISCOSITY_FACTOR = 1
export const MIN_WATER_SEAL_CM = 0
export const TEACHING_WATER_SEAL_CM = 2

export const defaultSimulationState: SimulationState = {
  systemType: 'drySealDrySuction',
  patient: {
    ventilation: 'spontaneous',
    lungCompliance: 0.68,
    pleuralPressureCmH2O: 4,
    airLeakSeverity: 0.45,
    fluidProductionMlPerHr: 70,
    cough: false,
    chronicCollapse: 0.25,
    rapidExpansion: 0.35,
  },
  tube: {
    frenchSize: 24,
    patency: 0.86,
    kinked: false,
    clamped: false,
    dependentLoop: false,
    sideHolesInChest: true,
  },
  device: {
    waterSealDepthCm: TEACHING_WATER_SEAL_CM,
    suctionSettingCmH2O: -20,
    sourceSuctionFlowLpm: MIN_DRY_SUCTION_SOURCE_FLOW_LPM,
    collectionVolumeMl: 260,
    upright: true,
    heightBelowChestCm: 55,
    canisterFull: false,
    batteryPct: 86,
  },
}

export const systemTypeLabels: Record<SimulationState['systemType'], string> = {
  oneBottleWaterSeal: 'One-bottle water seal',
  twoBottleWaterSeal: 'Two-bottle water seal',
  threeBottleWetSuction: 'Three-bottle wet suction',
  integratedWetSuction: 'Integrated wet suction CDU',
  integratedDrySuction: 'Integrated dry suction CDU',
  drySealDrySuction: 'Dry seal / dry suction CDU',
  digitalDrainage: 'Digital drainage',
  heimlichValve: 'Ambulatory one-way valve',
}
