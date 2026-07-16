import { assertFiniteNumber, assertNonNegativeNumber, assertPositiveNumber } from './units'

export const PRISMAX_EFFLUENT_TARGET_SOURCE_ID = 'MATH-PM-001'
export const PRISMAX_FILTRATION_FRACTION_SOURCE_ID = 'MATH-PM-003'
export const PRISMAX_PLASMA_FLOW_SOURCE_ID = 'MATH-PM-005'
export const PRISMAX_PATIENT_FLUID_REMOVED_SOURCE_ID = 'FLUID-PM-002'
export const PRISMAX_EFFLUENT_DOSE_SOURCE_ID = 'DOSE-PM-001'

/** AW8035 manual p219 / PDF p220; pending device-display value, never an engine default. */
export const PRISMAX_PENDING_PLASMA_WATER_FRACTION = 0.95

export interface SourceConflictGate {
  readonly conflictId: 'CONFLICT-001' | 'CONFLICT-002'
  readonly sourceRecordId: 'MATH-PM-004' | 'MATH-PM-006'
  readonly symbol: 'Qufpost' | 'Qpre'
  readonly enabled: false
  readonly reason: string
}

export const PRISMAX_POST_FILTER_ULTRAFILTRATION_GATE: SourceConflictGate = Object.freeze({
  conflictId: 'CONFLICT-001',
  sourceRecordId: 'MATH-PM-004',
  symbol: 'Qufpost',
  enabled: false,
  reason: 'The printed sign conflicts with the adjacent filtration-fraction numerator.',
})

export const PRISMAX_PRE_INFUSION_FLOW_GATE: SourceConflictGate = Object.freeze({
  conflictId: 'CONFLICT-002',
  sourceRecordId: 'MATH-PM-006',
  symbol: 'Qpre',
  enabled: false,
  reason: 'The printed expression is visually and dimensionally ambiguous.',
})

export interface PrismaxEffluentPumpTargetInput {
  readonly patientFluidRemovalMlPerHour: number
  readonly preBloodPumpMlPerHour: number
  readonly totalReplacementMlPerHour: number
  readonly dialysateMlPerHour: number
  readonly syringeMlPerHour: number
  readonly makeupMlPerHour: number
}

/**
 * PrisMax effluent-pump target in mL/h.
 * Source: MATH-PM-001, AW8035 manual p217 / PDF p218.
 */
export function calculatePrismaxEffluentPumpTargetMlPerHour(
  input: PrismaxEffluentPumpTargetInput,
): number {
  const patientFluidRemoval = assertNonNegativeNumber(
    input.patientFluidRemovalMlPerHour,
    'patientFluidRemovalMlPerHour',
  )
  const preBloodPump = assertNonNegativeNumber(input.preBloodPumpMlPerHour, 'preBloodPumpMlPerHour')
  const totalReplacement = assertNonNegativeNumber(
    input.totalReplacementMlPerHour,
    'totalReplacementMlPerHour',
  )
  const dialysate = assertNonNegativeNumber(input.dialysateMlPerHour, 'dialysateMlPerHour')
  const syringe = assertNonNegativeNumber(input.syringeMlPerHour, 'syringeMlPerHour')
  const makeup = assertNonNegativeNumber(input.makeupMlPerHour, 'makeupMlPerHour')

  return assertFiniteNumber(
    patientFluidRemoval + preBloodPump + totalReplacement + dialysate + syringe + makeup,
    'prismaxEffluentPumpTargetMlPerHour',
  )
}

/**
 * Device-displayed effluent dose in mL/kg/h. This function supplies no
 * clinical target range and makes no claim about delivered dose after downtime.
 * Source: DOSE-PM-001, AW8035 manual p220 / PDF p221.
 */
export function calculateEffluentDoseMlPerKgHour(
  effluentFlowMlPerHour: number,
  simulatedWeightKg: number,
): number {
  const effluentFlow = assertNonNegativeNumber(effluentFlowMlPerHour, 'effluentFlowMlPerHour')
  const weight = assertPositiveNumber(simulatedWeightKg, 'simulatedWeightKg')

  return assertFiniteNumber(effluentFlow / weight, 'effluentDoseMlPerKgHour')
}

export interface PrismaxPatientFluidRemovedInput {
  readonly effluentVolumeMl: number
  readonly preBloodPumpVolumeMl: number
  readonly dialysateVolumeMl: number
  readonly replacementVolumeMl: number
  readonly syringeVolumeMl: number
}

/**
 * Machine patient-fluid-removed volume in mL. A negative result is retained
 * rather than clamped because it represents net device-associated gain.
 * Source: FLUID-PM-002, AW8035 manual p219 / PDF p220.
 */
export function calculatePrismaxPatientFluidRemovedMl(
  input: PrismaxPatientFluidRemovedInput,
): number {
  const effluent = assertNonNegativeNumber(input.effluentVolumeMl, 'effluentVolumeMl')
  const preBloodPump = assertNonNegativeNumber(input.preBloodPumpVolumeMl, 'preBloodPumpVolumeMl')
  const dialysate = assertNonNegativeNumber(input.dialysateVolumeMl, 'dialysateVolumeMl')
  const replacement = assertNonNegativeNumber(input.replacementVolumeMl, 'replacementVolumeMl')
  const syringe = assertNonNegativeNumber(input.syringeVolumeMl, 'syringeVolumeMl')

  return assertFiniteNumber(
    effluent - preBloodPump - dialysate - replacement - syringe,
    'prismaxPatientFluidRemovedMl',
  )
}

/**
 * Plasma flow in mL/h. The caller must convert the device blood-flow setting
 * from mL/min before calling this function.
 * Source: MATH-PM-003/005, AW8035 manual p218 / PDF p219.
 */
export function calculatePlasmaFlowMlPerHour(
  bloodFlowMlPerHour: number,
  hematocritPercent: number,
): number {
  const bloodFlow = assertNonNegativeNumber(bloodFlowMlPerHour, 'bloodFlowMlPerHour')
  const hematocrit = assertFiniteNumber(hematocritPercent, 'hematocritPercent')

  if (hematocrit < 0 || hematocrit >= 100) {
    throw new RangeError('hematocritPercent must be at least zero and less than 100')
  }

  return assertFiniteNumber((1 - hematocrit / 100) * bloodFlow, 'plasmaFlowMlPerHour')
}

export interface PrismaxTotalPredilutionInput {
  readonly preBloodPumpMlPerHour: number
  readonly preFilterReplacementMlPerHour: number
  readonly totalReplacementMlPerHour: number
}

/**
 * Returns the printed total-predilution ratio as a fraction rather than
 * silently treating the ratio as percentage points.
 * Source: MATH-PM-003, AW8035 manual p218 / PDF p219.
 */
export function calculatePrismaxTotalPredilutionFraction(
  input: PrismaxTotalPredilutionInput,
): number {
  const preBloodPump = assertNonNegativeNumber(input.preBloodPumpMlPerHour, 'preBloodPumpMlPerHour')
  const preFilterReplacement = assertNonNegativeNumber(
    input.preFilterReplacementMlPerHour,
    'preFilterReplacementMlPerHour',
  )
  const totalReplacement = assertNonNegativeNumber(
    input.totalReplacementMlPerHour,
    'totalReplacementMlPerHour',
  )

  if (preFilterReplacement > totalReplacement) {
    throw new RangeError('preFilterReplacementMlPerHour must not exceed totalReplacementMlPerHour')
  }

  const denominator = preBloodPump + totalReplacement
  assertPositiveNumber(denominator, 'totalPredilutionDenominatorMlPerHour')

  return assertFiniteNumber(
    (preBloodPump + preFilterReplacement) / denominator,
    'prismaxTotalPredilutionFraction',
  )
}

export interface PrismaxFiltrationFractionBloodInput {
  readonly postFilterReplacementMlPerHour: number
  readonly patientFluidRemovalMlPerHour: number
  readonly syringeMlPerHour: number
  readonly plasmaFlowMlPerHour: number
  /** Explicit input because CONFLICT-002 prevents deriving Qpre. */
  readonly preInfusionFlowMlPerHour: number
}

/**
 * PrisMax FF Blood display in percentage points. The function intentionally
 * requires explicit Qpre and does not call the disabled CONFLICT-002 formula.
 * Source: MATH-PM-003, AW8035 manual p218 / PDF p219.
 */
export function calculatePrismaxFiltrationFractionBloodPercent(
  input: PrismaxFiltrationFractionBloodInput,
): number {
  const postFilterReplacement = assertNonNegativeNumber(
    input.postFilterReplacementMlPerHour,
    'postFilterReplacementMlPerHour',
  )
  const patientFluidRemoval = assertNonNegativeNumber(
    input.patientFluidRemovalMlPerHour,
    'patientFluidRemovalMlPerHour',
  )
  const syringe = assertNonNegativeNumber(input.syringeMlPerHour, 'syringeMlPerHour')
  const plasmaFlow = assertNonNegativeNumber(input.plasmaFlowMlPerHour, 'plasmaFlowMlPerHour')
  const preInfusionFlow = assertNonNegativeNumber(
    input.preInfusionFlowMlPerHour,
    'preInfusionFlowMlPerHour',
  )
  const denominator = plasmaFlow + preInfusionFlow
  assertPositiveNumber(denominator, 'filtrationFractionBloodDenominatorMlPerHour')

  return assertFiniteNumber(
    (100 * (postFilterReplacement + patientFluidRemoval + syringe)) / denominator,
    'prismaxFiltrationFractionBloodPercent',
  )
}

export interface PrismaxFiltrationFractionPlasmaInput {
  readonly effluentFlowMlPerHour: number
  readonly plasmaFlowMlPerHour: number
  /** Explicit input because CONFLICT-002 prevents deriving Qpre. */
  readonly preInfusionFlowMlPerHour: number
  /** Explicit pending profile input; no plasma-water fraction is assumed by the engine. */
  readonly plasmaWaterFraction: number
}

/**
 * PrisMax FF Plasma display in percentage points. The device-specific 0.95
 * factor is source-backed and is not a clinical threshold.
 * Source: MATH-PM-003/005, AW8035 manual pp218-219 / PDF pp219-220.
 */
export function calculatePrismaxFiltrationFractionPlasmaPercent(
  input: PrismaxFiltrationFractionPlasmaInput,
): number {
  const effluentFlow = assertNonNegativeNumber(input.effluentFlowMlPerHour, 'effluentFlowMlPerHour')
  const plasmaFlow = assertNonNegativeNumber(input.plasmaFlowMlPerHour, 'plasmaFlowMlPerHour')
  const preInfusionFlow = assertNonNegativeNumber(
    input.preInfusionFlowMlPerHour,
    'preInfusionFlowMlPerHour',
  )
  const plasmaWaterFraction = assertFiniteNumber(input.plasmaWaterFraction, 'plasmaWaterFraction')
  if (plasmaWaterFraction <= 0 || plasmaWaterFraction > 1) {
    throw new RangeError('plasmaWaterFraction must be greater than zero and at most one')
  }
  const denominator = plasmaFlow * plasmaWaterFraction + preInfusionFlow
  assertPositiveNumber(denominator, 'filtrationFractionPlasmaDenominatorMlPerHour')

  return assertFiniteNumber(
    (100 * effluentFlow) / denominator,
    'prismaxFiltrationFractionPlasmaPercent',
  )
}
