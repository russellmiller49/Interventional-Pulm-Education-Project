export interface CirculationParameters {
  heartRateBpm: number
  respiratoryRateBpm: number
  bodySurfaceAreaM2: number
  referenceCardiacOutputLMin: number
  circulatingVolumeFraction: number
  stressedVenousVolumeMl: number
  venousComplianceMlMmHg: number
  systemicVascularResistanceDynSecCm5: number
  pulmonaryVascularResistanceWU: number
  systemicArterialComplianceMlMmHg: number
  pulmonaryArterialComplianceMlMmHg: number
  leftVentricularContractility: number
  rightVentricularContractility: number
  leftVentricularCompliance: number
  rightVentricularCompliance: number
  rightAtrialPressureSetPointMmHg: number
  leftAtrialPressureSetPointMmHg: number
  pericardialPressureMmHg: number
  peepCmH2O: number
  pleuralPressureSwingMmHg: number
  arterialOxygenSaturationPercent: number
  mixedVenousOxygenSaturationPercent: number
  tricuspidRegurgitationSeverity: number
  shuntFraction: number
  rhythmRegularity: number
  spontaneousBreathingFraction: number
  fluidResponsiveness: number
}

export interface CirculationCompartmentState {
  systemicArterialVolumeMl: number
  systemicVenousVolumeMl: number
  pulmonaryArterialVolumeMl: number
  pulmonaryVenousVolumeMl: number
  leftVentricularVolumeMl: number
  rightVentricularVolumeMl: number
  systemicArterialPressureMmHg: number
  systemicVenousPressureMmHg: number
  pulmonaryArterialPressureMmHg: number
  pulmonaryVenousPressureMmHg: number
  leftVentricularPressureMmHg: number
  rightVentricularPressureMmHg: number
  systemicFlowLMin: number
  pulmonaryFlowLMin: number
}

export interface HemodynamicMeasurements {
  heartRateBpm: number
  spo2Percent: number
  artSystolicMmHg: number
  artDiastolicMmHg: number
  mapMmHg: number
  rapMmHg: number
  rvSystolicMmHg: number
  rvDiastolicMmHg: number
  papSystolicMmHg: number
  papDiastolicMmHg: number
  meanPapMmHg: number
  pawpMmHg: number | null
  cardiacOutputLMin: number
  cardiacIndexLMinM2: number
  svo2Percent: number
  pulsePressureMaxMmHg: number
  pulsePressureMinMmHg: number
}

export type CirculationCompartmentId =
  | 'systemic-arterial'
  | 'systemic-venous'
  | 'pulmonary-arterial'
  | 'pulmonary-venous'
  | 'left-ventricular'
  | 'right-ventricular'

export interface CompartmentTransfer {
  from: CirculationCompartmentId
  to: CirculationCompartmentId
  flowLMin: number
}

export interface MechanicalSupportAlarmSignal {
  id: string
  active: boolean
  priority: 'advisory' | 'warning' | 'critical'
}

/**
 * A device-neutral effect supplied to the circulation solver for one fixed step.
 * Transfers are volume-conserving; modifiers alter pressure/flow relationships only.
 */
export interface MechanicalSupportEffect {
  transfers: readonly CompartmentTransfer[]
  leftOutflowResistanceMultiplier?: number
  systemicArterialComplianceMultiplier?: number
  nativeAfterloadDeltaMmHg?: number
  nativeFlowLMin?: number
  deviceFlowLMin: number
  recirculatingFlowLMin: number
  effectiveSystemicFlowLMin: number
  displaySignals?: Readonly<Record<string, number | string | boolean | null>>
  alarms?: readonly MechanicalSupportAlarmSignal[]
}
