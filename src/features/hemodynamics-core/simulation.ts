import type {
  CirculationCompartmentId,
  CirculationCompartmentState,
  CirculationParameters,
  HemodynamicMeasurements,
  MechanicalSupportEffect,
} from './types'

export const HEMODYNAMIC_FIXED_STEP_SECONDS = 0.02
export const HEMODYNAMIC_ENGINE_HZ = 50

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function timeVaryingVentricularElastance(
  timeSeconds: number,
  heartRateBpm: number,
  contractility: number,
  ventricle: 'left' | 'right',
): number {
  const cycleSeconds = 60 / Math.max(25, heartRateBpm)
  const phase = (((timeSeconds % cycleSeconds) + cycleSeconds) % cycleSeconds) / cycleSeconds
  const activation = phase < 0.42 ? Math.sin((phase / 0.42) * Math.PI) ** 2 : 0
  const minimum = ventricle === 'left' ? 0.06 : 0.025
  const maximum = (ventricle === 'left' ? 2.1 : 0.55) * clamp(contractility, 0.2, 2)
  return minimum + (maximum - minimum) * activation
}

export function createInitialCirculationCompartments(
  parameters: CirculationParameters,
  measurements: HemodynamicMeasurements,
): CirculationCompartmentState {
  const fraction = parameters.circulatingVolumeFraction
  return {
    systemicArterialVolumeMl: 700 * fraction,
    systemicVenousVolumeMl: 2500 * fraction,
    pulmonaryArterialVolumeMl: 300 * fraction,
    pulmonaryVenousVolumeMl: 600 * fraction,
    leftVentricularVolumeMl: 120,
    rightVentricularVolumeMl: 140,
    systemicArterialPressureMmHg: measurements.mapMmHg,
    systemicVenousPressureMmHg: measurements.rapMmHg,
    pulmonaryArterialPressureMmHg: measurements.meanPapMmHg,
    pulmonaryVenousPressureMmHg: measurements.pawpMmHg ?? measurements.papDiastolicMmHg,
    leftVentricularPressureMmHg: measurements.pawpMmHg ?? 8,
    rightVentricularPressureMmHg: measurements.rapMmHg,
    systemicFlowLMin: measurements.cardiacOutputLMin,
    pulmonaryFlowLMin: measurements.cardiacOutputLMin,
  }
}

export function totalCirculatingVolumeMl(compartments: CirculationCompartmentState): number {
  return (
    compartments.systemicArterialVolumeMl +
    compartments.systemicVenousVolumeMl +
    compartments.pulmonaryArterialVolumeMl +
    compartments.pulmonaryVenousVolumeMl +
    compartments.leftVentricularVolumeMl +
    compartments.rightVentricularVolumeMl
  )
}

const volumeKeyByCompartment: Record<
  CirculationCompartmentId,
  keyof Pick<
    CirculationCompartmentState,
    | 'systemicArterialVolumeMl'
    | 'systemicVenousVolumeMl'
    | 'pulmonaryArterialVolumeMl'
    | 'pulmonaryVenousVolumeMl'
    | 'leftVentricularVolumeMl'
    | 'rightVentricularVolumeMl'
  >
> = {
  'systemic-arterial': 'systemicArterialVolumeMl',
  'systemic-venous': 'systemicVenousVolumeMl',
  'pulmonary-arterial': 'pulmonaryArterialVolumeMl',
  'pulmonary-venous': 'pulmonaryVenousVolumeMl',
  'left-ventricular': 'leftVentricularVolumeMl',
  'right-ventricular': 'rightVentricularVolumeMl',
}

export function advanceWindkesselCompartments(
  compartments: CirculationCompartmentState,
  parameters: CirculationParameters,
  measurements: HemodynamicMeasurements,
  timeSeconds: number,
  stepSeconds = HEMODYNAMIC_FIXED_STEP_SECONDS,
  supportEffect?: MechanicalSupportEffect,
): CirculationCompartmentState {
  const leftElastance = timeVaryingVentricularElastance(
    timeSeconds,
    parameters.heartRateBpm,
    parameters.leftVentricularContractility,
    'left',
  )
  const rightElastance = timeVaryingVentricularElastance(
    timeSeconds,
    parameters.heartRateBpm,
    parameters.rightVentricularContractility,
    'right',
  )
  const leftPressure = Math.max(
    0,
    leftElastance * Math.max(0, compartments.leftVentricularVolumeMl - 20),
  )
  const rightPressure = Math.max(
    0,
    rightElastance * Math.max(0, compartments.rightVentricularVolumeMl - 15),
  )
  const valveResistance = 0.35
  const mitralFlow = clamp(
    (compartments.pulmonaryVenousPressureMmHg - leftPressure) / valveResistance,
    0,
    20,
  )
  const leftOutflowResistance =
    valveResistance * clamp(supportEffect?.leftOutflowResistanceMultiplier ?? 1, 0.35, 2.5)
  const leftOutflow = clamp(
    (leftPressure -
      compartments.systemicArterialPressureMmHg -
      (supportEffect?.nativeAfterloadDeltaMmHg ?? 0)) /
      leftOutflowResistance,
    0,
    20,
  )
  const systemicResistanceMmHgPerLMin = parameters.systemicVascularResistanceDynSecCm5 / 80
  const systemicFlow = clamp(
    (compartments.systemicArterialPressureMmHg - compartments.systemicVenousPressureMmHg) /
      Math.max(1, systemicResistanceMmHgPerLMin),
    0,
    20,
  )
  const tricuspidFlow = clamp(
    (compartments.systemicVenousPressureMmHg - rightPressure) / valveResistance,
    0,
    20,
  )
  const rightOutflow = clamp(
    (rightPressure - compartments.pulmonaryArterialPressureMmHg) / valveResistance,
    0,
    20,
  )
  const pulmonaryFlow = clamp(
    (compartments.pulmonaryArterialPressureMmHg - compartments.pulmonaryVenousPressureMmHg) /
      Math.max(0.4, parameters.pulmonaryVascularResistanceWU),
    0,
    20,
  )
  const flowToVolume = (flowLMin: number) => (flowLMin * 1000 * stepSeconds) / 60
  const volumes = {
    systemicArterialVolumeMl:
      compartments.systemicArterialVolumeMl + flowToVolume(leftOutflow - systemicFlow),
    systemicVenousVolumeMl:
      compartments.systemicVenousVolumeMl + flowToVolume(systemicFlow - tricuspidFlow),
    pulmonaryArterialVolumeMl:
      compartments.pulmonaryArterialVolumeMl + flowToVolume(rightOutflow - pulmonaryFlow),
    pulmonaryVenousVolumeMl:
      compartments.pulmonaryVenousVolumeMl + flowToVolume(pulmonaryFlow - mitralFlow),
    leftVentricularVolumeMl:
      compartments.leftVentricularVolumeMl + flowToVolume(mitralFlow - leftOutflow),
    rightVentricularVolumeMl:
      compartments.rightVentricularVolumeMl + flowToVolume(tricuspidFlow - rightOutflow),
  }

  for (const transfer of supportEffect?.transfers ?? []) {
    const boundedFlow = clamp(transfer.flowLMin, 0, 12)
    const transferVolume = flowToVolume(boundedFlow)
    const from = volumeKeyByCompartment[transfer.from]
    const to = volumeKeyByCompartment[transfer.to]
    volumes[from] -= transferVolume
    volumes[to] += transferVolume
  }

  const desiredTotalVolume = 4100 * parameters.circulatingVolumeFraction + 260
  const currentTotalVolume = Object.values(volumes).reduce((sum, value) => sum + value, 0)
  volumes.systemicVenousVolumeMl +=
    (desiredTotalVolume - currentTotalVolume) * clamp(stepSeconds / 5, 0, 1)

  volumes.systemicArterialVolumeMl = clamp(volumes.systemicArterialVolumeMl, 150, 1500)
  volumes.systemicVenousVolumeMl = clamp(volumes.systemicVenousVolumeMl, 500, 4200)
  volumes.pulmonaryArterialVolumeMl = clamp(volumes.pulmonaryArterialVolumeMl, 80, 800)
  volumes.pulmonaryVenousVolumeMl = clamp(volumes.pulmonaryVenousVolumeMl, 120, 1300)
  volumes.leftVentricularVolumeMl = clamp(volumes.leftVentricularVolumeMl, 25, 260)
  volumes.rightVentricularVolumeMl = clamp(volumes.rightVentricularVolumeMl, 25, 300)

  // Compartment safety bounds can otherwise create or remove volume. Reconcile
  // their small numerical remainder through the compliant venous reservoir.
  const boundedTotalVolume = Object.values(volumes).reduce((sum, value) => sum + value, 0)
  volumes.systemicVenousVolumeMl = clamp(
    volumes.systemicVenousVolumeMl + desiredTotalVolume - boundedTotalVolume,
    500,
    4200,
  )

  const fraction = parameters.circulatingVolumeFraction
  const systemicArterialPressureMmHg = clamp(
    measurements.mapMmHg +
      (volumes.systemicArterialVolumeMl - 700 * fraction) /
        Math.max(
          0.4,
          parameters.systemicArterialComplianceMlMmHg *
            clamp(supportEffect?.systemicArterialComplianceMultiplier ?? 1, 0.35, 2.5),
        ),
    15,
    240,
  )
  const systemicVenousPressureMmHg = clamp(
    measurements.rapMmHg +
      (volumes.systemicVenousVolumeMl - 2500 * fraction) /
        Math.max(25, parameters.venousComplianceMlMmHg),
    -3,
    40,
  )
  const pulmonaryArterialPressureMmHg = clamp(
    measurements.meanPapMmHg +
      (volumes.pulmonaryArterialVolumeMl - 300 * fraction) /
        Math.max(0.6, parameters.pulmonaryArterialComplianceMlMmHg),
    4,
    100,
  )
  const pulmonaryVenousPressureMmHg = clamp(
    (measurements.pawpMmHg ?? measurements.papDiastolicMmHg) +
      (volumes.pulmonaryVenousVolumeMl - 600 * fraction) /
        Math.max(12, parameters.venousComplianceMlMmHg * 0.45),
    0,
    50,
  )

  return {
    ...volumes,
    systemicArterialPressureMmHg,
    systemicVenousPressureMmHg,
    pulmonaryArterialPressureMmHg,
    pulmonaryVenousPressureMmHg,
    leftVentricularPressureMmHg: leftPressure,
    rightVentricularPressureMmHg: rightPressure,
    systemicFlowLMin: systemicFlow,
    pulmonaryFlowLMin: pulmonaryFlow,
  }
}
