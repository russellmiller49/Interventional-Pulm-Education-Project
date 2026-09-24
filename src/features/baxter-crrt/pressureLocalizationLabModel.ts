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
      return 'The obstruction is at the access catheter. Increased resistance before the blood pump makes access pressure more negative.'
    case 'access-line':
      return 'The obstruction is on the extracorporeal access line. Increased resistance before the blood pump makes access pressure more negative.'
    case 'filter':
      return 'The obstruction is within the filter. Increased filter resistance changes filter pressure and the pressure drop across the filter.'
    case 'return-line':
      return 'The obstruction is on the extracorporeal return line. Increased resistance after the filter raises return-side pressure.'
    case 'effluent-line':
      return 'This illustrative fixture imposes a higher effluent-pressure input to demonstrate the TMP relationship. Obstruction location relative to the sensor and pump, and pump regulation, are not modeled; no universal obstruction direction follows.'
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
      `${labelForFault(fault)} at ${labelForSite(site)} is not included in this exercise.`,
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
      'Only the selected circuit location changes. Compare the direction of all six pressure signals; alarm behavior and automatic device actions are not part of this lab.',
  })
}

/* ------------------------------------------------------------------ *
 * Per-signal comparison (CRRT-FELLOW-04, F-23)
 * ------------------------------------------------------------------ */

export type PressureSignalComparisonOutcome = 'matches' | 'does-not-match' | 'no-prediction'

export interface PressureSignalComparison {
  readonly id: PressureLocalizationSignal
  readonly label: string
  readonly predicted: QualitativePressureDirection | null
  readonly observed: QualitativePressureDirection
  readonly outcome: PressureSignalComparisonOutcome
  readonly baselineMmHg: number
  readonly revealedMmHg: number
  /** Why this signal moved or held, computed from this pattern's own readings. */
  readonly explanation: string
}

/** A change in mmHg as a learner reads it: “+20 mmHg”, “0 mmHg”, “−30 mmHg”. */
function signedChange(value: number): string {
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return '0 mmHg'
  const magnitude = Math.abs(rounded).toLocaleString('en-US', { maximumFractionDigits: 1 })
  return `${rounded > 0 ? '+' : '−'}${magnitude} mmHg`
}

function reading(value: number): string {
  const rounded = Math.round(value * 10) / 10
  const magnitude = Math.abs(rounded).toLocaleString('en-US', { maximumFractionDigits: 1 })
  return `${rounded < 0 ? '−' : ''}${magnitude}`
}

function movement(baseline: number, revealed: number, direction: QualitativePressureDirection) {
  if (direction === 'unchanged') return `stayed at ${reading(baseline)} mmHg`
  const verb = direction === 'higher' ? 'rose' : 'fell'
  const note = direction === 'lower' && revealed < 0 ? ' (more negative)' : ''
  return `${verb} from ${reading(baseline)} to ${reading(revealed)} mmHg${note}`
}

/**
 * The explanation for one signal, derived from the readings of the pattern being shown, so it
 * stays true for every supported site. TMP and filter pressure drop are explained from their
 * own arithmetic: TMP = (filter + return) ÷ 2 − effluent − 18, and drop = filter − return − 25.
 * Both constants cancel out of a before/after change, so they never decide a direction here.
 */
export function explainPressureSignal(
  result: SyntheticPressureLocalizationResult,
  signalId: PressureLocalizationSignal,
): string {
  const b = result.baseline
  const r = result.revealed
  const delta = {
    access: r.accessPressureMmHg - b.accessPressureMmHg,
    filter: r.filterPressureMmHg - b.filterPressureMmHg,
    return: r.returnPressureMmHg - b.returnPressureMmHg,
    effluent: r.effluentPressureMmHg - b.effluentPressureMmHg,
    lossAcrossFilter:
      r.filterPressureMmHg - r.returnPressureMmHg - (b.filterPressureMmHg - b.returnPressureMmHg),
  }
  const signal = result.signals.find((candidate) => candidate.id === signalId)
  if (!signal) throw new Error(`Unknown pressure signal: ${signalId}`)
  const moved = movement(signal.baselineMmHg, signal.revealedMmHg, signal.direction)

  switch (signalId) {
    case 'access':
      return delta.access === 0
        ? `Access pressure is measured between the patient and the blood pump, and in this model it moves only when resistance before the pump changes. Nothing before the pump changed in this pattern, so it ${moved}.`
        : `Access pressure is measured between the patient and the blood pump. Resistance before the pump changed in this pattern, so the pump draws against it and access pressure ${moved}.`
    case 'return':
      return delta.return === 0
        ? `Return pressure is measured on the return line after the filter and moves with resistance between that site and the patient. Nothing on that side changed here, so it ${moved}.`
        : `Return pressure is measured on the return line after the filter. Resistance between that site and the patient changed here, so return pressure ${moved}.`
    case 'filter':
      return `Filter pressure is measured at the filter inlet, so it carries the return-side pressure plus the pressure lost across the filter. Return changed by ${signedChange(delta.return)} and the loss across the filter by ${signedChange(delta.lossAcrossFilter)}, so filter pressure ${moved}.`
    case 'effluent':
      return delta.effluent === 0
        ? `Effluent pressure is measured on the fluid side. Nothing on the effluent path changed here, so it ${moved}.`
        : `Effluent pressure is measured on the fluid side. This pattern imposes a changed effluent reading, so it ${moved}; where an obstruction sits relative to the sensor and pump is not modeled.`
    case 'tmp': {
      const averageChange = (delta.filter + delta.return) / 2
      return `TMP is calculated, not measured: (filter + return) ÷ 2 − effluent − 18. Filter changed by ${signedChange(delta.filter)} and return by ${signedChange(delta.return)}, so their average changed by ${signedChange(averageChange)}; effluent, which is subtracted, changed by ${signedChange(delta.effluent)}. TMP therefore ${moved}. The −18 mmHg term is the same before and after.`
    }
    case 'filter-drop':
      return `Filter pressure drop is calculated: filter − return, with this simulation’s −25 mmHg correction. Filter changed by ${signedChange(delta.filter)} and return by ${signedChange(delta.return)}, so their difference changed by ${signedChange(delta.filter - delta.return)} and the drop ${moved}. The −25 mmHg correction is the same before and after.`
  }
}

/**
 * Each of the six predictions beside the observed direction and its explanation. With no
 * committed prediction (reveal-first), every signal still gets its explanation. There is no
 * total, count or score: each signal is compared on its own.
 */
export function comparePressureLocalizationPrediction(
  result: SyntheticPressureLocalizationResult,
  prediction: PressureLocalizationPrediction | null,
): readonly PressureSignalComparison[] {
  return result.signals.map((signal) => {
    const predicted = prediction ? prediction[signal.id] : null
    return Object.freeze({
      id: signal.id,
      label: signal.label,
      predicted,
      observed: signal.direction,
      outcome:
        predicted === null
          ? ('no-prediction' as const)
          : predicted === signal.direction
            ? ('matches' as const)
            : ('does-not-match' as const),
      baselineMmHg: signal.baselineMmHg,
      revealedMmHg: signal.revealedMmHg,
      explanation: explainPressureSignal(result, signal.id),
    })
  })
}
