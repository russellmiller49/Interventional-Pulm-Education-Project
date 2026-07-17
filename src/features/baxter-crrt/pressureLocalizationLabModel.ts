import {
  calculatePrismaxFilterPressureDropMmHg,
  calculatePrismaxTmpMmHg,
  calculateSyntheticBloodCircuitPressures,
  type SyntheticBloodCircuitPressureParameters,
} from './engine/pressureModel'

export const pressureLocalizationCandidateSourceIds = Object.freeze([
  'DEV-PM-009',
  'DEV-PM-010',
  'MATH-PM-002',
  'SYNTH-LAB-PRESSURE-001',
] as const)

export const pressureLocalizationFaults = [
  { id: 'obstruction', label: 'Obstruction' },
  { id: 'disconnection', label: 'Disconnection' },
] as const

export type PressureLocalizationFault = (typeof pressureLocalizationFaults)[number]['id']

export const pressureLocalizationSites = [
  { id: 'access-catheter', label: 'Access catheter' },
  { id: 'access-line', label: 'Access line' },
  { id: 'filter', label: 'Filter' },
  { id: 'return-line', label: 'Return line' },
  { id: 'effluent-line', label: 'Effluent line' },
] as const

export type PressureLocalizationSite = (typeof pressureLocalizationSites)[number]['id']

export const pressureLocalizationSignals = [
  { id: 'access', label: 'Access pressure' },
  { id: 'filter', label: 'Filter pressure' },
  { id: 'return', label: 'Return pressure' },
  { id: 'effluent', label: 'Effluent pressure' },
  { id: 'tmp', label: 'TMP' },
  { id: 'filter-drop', label: 'Filter pressure drop' },
] as const

export type PressureLocalizationSignal = (typeof pressureLocalizationSignals)[number]['id']
export type QualitativePressureDirection = 'lower' | 'unchanged' | 'higher'

export type PressureLocalizationPrediction = Readonly<
  Record<PressureLocalizationSignal, QualitativePressureDirection>
>

export interface SyntheticPressureSnapshot {
  readonly accessPressureMmHg: number
  readonly filterPressureMmHg: number
  readonly returnPressureMmHg: number
  readonly effluentPressureMmHg: number
  readonly tmpMmHg: number
  readonly filterPressureDropMmHg: number
}

export interface SyntheticPressureSignalResult {
  readonly id: PressureLocalizationSignal
  readonly label: string
  readonly baselineMmHg: number
  readonly revealedMmHg: number
  readonly direction: QualitativePressureDirection
}

export interface SyntheticPressureLocalizationResult {
  readonly fault: PressureLocalizationFault
  readonly site: PressureLocalizationSite
  readonly faultLabel: string
  readonly siteLabel: string
  readonly baseline: SyntheticPressureSnapshot
  readonly revealed: SyntheticPressureSnapshot
  readonly signals: readonly SyntheticPressureSignalResult[]
  readonly locationExplanation: string
  readonly modelExplanation: string
}

const BASELINE_EFFLUENT_PRESSURE_MMHG = -20
const OBSTRUCTED_EFFLUENT_PRESSURE_MMHG = 10

const baselineBloodParameters: SyntheticBloodCircuitPressureParameters = Object.freeze({
  bloodFlowMlPerMinute: 100,
  accessReferencePressureMmHg: 5,
  returnReferencePressureMmHg: 10,
  accessResistanceMmHgPerMlPerMinute: 0.2,
  filterResistanceMmHgPerMlPerMinute: 0.3,
  returnResistanceMmHgPerMlPerMinute: 0.1,
})

function labelForFault(fault: PressureLocalizationFault): string {
  return pressureLocalizationFaults.find((candidate) => candidate.id === fault)?.label ?? fault
}

function labelForSite(site: PressureLocalizationSite): string {
  return pressureLocalizationSites.find((candidate) => candidate.id === site)?.label ?? site
}

function createSnapshot(
  parameters: SyntheticBloodCircuitPressureParameters,
  effluentPressureMmHg: number,
): SyntheticPressureSnapshot {
  const bloodPressures = calculateSyntheticBloodCircuitPressures(parameters)
  const accessPressureMmHg = bloodPressures.accessPressureMmHg
  const returnPressureMmHg = bloodPressures.returnPressureMmHg
  const filterPressureMmHg = bloodPressures.filterPressureMmHg
  const filterPressureDrop = calculatePrismaxFilterPressureDropMmHg(
    filterPressureMmHg,
    returnPressureMmHg,
  )

  return {
    accessPressureMmHg,
    filterPressureMmHg,
    returnPressureMmHg,
    effluentPressureMmHg,
    tmpMmHg: calculatePrismaxTmpMmHg({
      rawFilterPressureMmHg: filterPressureMmHg,
      rawReturnPressureMmHg: returnPressureMmHg,
      rawEffluentPressureMmHg: effluentPressureMmHg,
    }),
    filterPressureDropMmHg: filterPressureDrop.displayedPressureDropMmHg,
  }
}

function snapshotSignal(
  snapshot: SyntheticPressureSnapshot,
  signal: PressureLocalizationSignal,
): number {
  switch (signal) {
    case 'access':
      return snapshot.accessPressureMmHg
    case 'filter':
      return snapshot.filterPressureMmHg
    case 'return':
      return snapshot.returnPressureMmHg
    case 'effluent':
      return snapshot.effluentPressureMmHg
    case 'tmp':
      return snapshot.tmpMmHg
    case 'filter-drop':
      return snapshot.filterPressureDropMmHg
  }
}

function compareDirection(
  baselineMmHg: number,
  revealedMmHg: number,
): QualitativePressureDirection {
  if (revealedMmHg === baselineMmHg) return 'unchanged'
  return revealedMmHg > baselineMmHg ? 'higher' : 'lower'
}

function obstructionSnapshot(site: PressureLocalizationSite): SyntheticPressureSnapshot {
  const parameters = { ...baselineBloodParameters }
  let effluentPressureMmHg = BASELINE_EFFLUENT_PRESSURE_MMHG

  switch (site) {
    case 'access-catheter':
    case 'access-line':
      parameters.accessResistanceMmHgPerMlPerMinute = 0.4
      break
    case 'filter':
      parameters.filterResistanceMmHgPerMlPerMinute = 0.6
      break
    case 'return-line':
      parameters.returnResistanceMmHgPerMlPerMinute = 0.3
      break
    case 'effluent-line':
      effluentPressureMmHg = OBSTRUCTED_EFFLUENT_PRESSURE_MMHG
      break
  }

  return createSnapshot(parameters, effluentPressureMmHg)
}

function locationExplanation(site: PressureLocalizationSite): string {
  switch (site) {
    case 'access-catheter':
      return 'The marker is at the access catheter. This generic model represents its authored resistance change with the shared access-side term while retaining the catheter as a distinct inspection location.'
    case 'access-line':
      return 'The marker is on the extracorporeal access line. This generic model uses the same authored access-side resistance change as the catheter fixture, but the line remains a distinct teaching and inspection location.'
    case 'filter':
      return 'The marker is within the filter. The synthetic fixture changes only its filter-resistance term before recalculating the displayed pressure relationships.'
    case 'return-line':
      return 'The marker is on the extracorporeal return line. The synthetic fixture applies an authored resistance change to the return side.'
    case 'effluent-line':
      return 'The marker is on the effluent line. The synthetic fixture changes only the authored effluent-pressure input before recalculating TMP.'
  }
}

export function isPressureLocalizationCombinationSupported(
  fault: PressureLocalizationFault,
  site: PressureLocalizationSite,
): boolean {
  return (
    fault === 'obstruction' && pressureLocalizationSites.some((candidate) => candidate.id === site)
  )
}

/**
 * Produces one deterministic reviewer fixture from existing pressure math.
 * Constants are arbitrary synthetic operating points, not device limits,
 * clinical targets, alarm thresholds, or patient-specific values.
 */
export function createSyntheticPressureLocalizationResult(
  fault: PressureLocalizationFault,
  site: PressureLocalizationSite,
): SyntheticPressureLocalizationResult {
  if (!isPressureLocalizationCombinationSupported(fault, site)) {
    throw new Error(
      `${labelForFault(fault)} at ${labelForSite(site)} is unavailable pending source and device review.`,
    )
  }

  const baseline = createSnapshot(baselineBloodParameters, BASELINE_EFFLUENT_PRESSURE_MMHG)
  const revealed = obstructionSnapshot(site)
  const signals = pressureLocalizationSignals.map(({ id, label }) => {
    const baselineMmHg = snapshotSignal(baseline, id)
    const revealedMmHg = snapshotSignal(revealed, id)
    return Object.freeze({
      id,
      label,
      baselineMmHg,
      revealedMmHg,
      direction: compareDirection(baselineMmHg, revealedMmHg),
    })
  })

  return Object.freeze({
    fault,
    site,
    faultLabel: labelForFault(fault),
    siteLabel: labelForSite(site),
    baseline: Object.freeze(baseline),
    revealed: Object.freeze(revealed),
    signals: Object.freeze(signals),
    locationExplanation: locationExplanation(site),
    modelExplanation:
      'The fixture changes one authored resistance or effluent input and recalculates the six signals. It does not invoke an alarm or device action.',
  })
}
