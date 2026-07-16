import { assertFiniteNumber, assertNonNegativeNumber } from './units'

export const PRISMAX_TMP_SOURCE_ID = 'MATH-PM-002'
export const PRISMAX_FILTER_PRESSURE_DROP_SOURCE_ID = 'DEV-PM-010'

/** Exact AW8035 device-display offset; not an alarm or clinical threshold. */
export const PRISMAX_TMP_HYDROSTATIC_OFFSET_MMHG = -18
/** Exact AW8035 device-display offset; not an alarm or clinical threshold. */
export const PRISMAX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG = -25

export interface PrismaxTmpInput {
  readonly rawFilterPressureMmHg: number
  readonly rawReturnPressureMmHg: number
  readonly rawEffluentPressureMmHg: number
}

/**
 * PrisMax displayed TMP in mmHg from raw monitored pressures.
 * Source: MATH-PM-002, AW8035 manual p217 / PDF p218.
 */
export function calculatePrismaxTmpMmHg(input: PrismaxTmpInput): number {
  const filter = assertFiniteNumber(input.rawFilterPressureMmHg, 'rawFilterPressureMmHg')
  const returnPressure = assertFiniteNumber(input.rawReturnPressureMmHg, 'rawReturnPressureMmHg')
  const effluent = assertFiniteNumber(input.rawEffluentPressureMmHg, 'rawEffluentPressureMmHg')

  return assertFiniteNumber(
    (filter + returnPressure) / 2 - effluent + PRISMAX_TMP_HYDROSTATIC_OFFSET_MMHG,
    'prismaxTmpMmHg',
  )
}

export interface PrismaxFilterPressureDrop {
  readonly rawPressureDropMmHg: number
  readonly displayedPressureDropMmHg: number
}

/**
 * PrisMax filter pressure drop in mmHg. Both raw and corrected display values
 * are returned so downstream code cannot accidentally apply the -25 offset twice.
 * Source: DEV-PM-010, AW8035 manual pp201-202 / PDF pp202-203.
 */
export function calculatePrismaxFilterPressureDropMmHg(
  rawFilterPressureMmHg: number,
  rawReturnPressureMmHg: number,
): PrismaxFilterPressureDrop {
  const filter = assertFiniteNumber(rawFilterPressureMmHg, 'rawFilterPressureMmHg')
  const returnPressure = assertFiniteNumber(rawReturnPressureMmHg, 'rawReturnPressureMmHg')
  const rawPressureDrop = assertFiniteNumber(filter - returnPressure, 'rawPressureDropMmHg')

  return {
    rawPressureDropMmHg: rawPressureDrop,
    displayedPressureDropMmHg: assertFiniteNumber(
      rawPressureDrop + PRISMAX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG,
      'displayedPressureDropMmHg',
    ),
  }
}

export interface SyntheticBloodCircuitPressureParameters {
  readonly bloodFlowMlPerMinute: number
  readonly accessReferencePressureMmHg: number
  readonly returnReferencePressureMmHg: number
  readonly accessResistanceMmHgPerMlPerMinute: number
  readonly filterResistanceMmHgPerMlPerMinute: number
  readonly returnResistanceMmHgPerMlPerMinute: number
}

export interface SyntheticBloodCircuitPressures {
  readonly accessPressureMmHg: number
  readonly filterPressureMmHg: number
  readonly returnPressureMmHg: number
}

/**
 * Parametric educational pressure model. Every reference pressure and
 * resistance is supplied by the caller; this module provides no calibration,
 * normal range, or alarm threshold.
 *
 * Resistance units are mmHg per (mL/min). The model makes central-venous
 * access pressure fall with access resistance, return pressure rise with
 * downstream resistance, and filter pressure exceed return pressure by the
 * filter pressure drop.
 */
export function calculateSyntheticBloodCircuitPressures(
  parameters: SyntheticBloodCircuitPressureParameters,
): SyntheticBloodCircuitPressures {
  const bloodFlow = assertNonNegativeNumber(parameters.bloodFlowMlPerMinute, 'bloodFlowMlPerMinute')
  const accessReference = assertFiniteNumber(
    parameters.accessReferencePressureMmHg,
    'accessReferencePressureMmHg',
  )
  const returnReference = assertFiniteNumber(
    parameters.returnReferencePressureMmHg,
    'returnReferencePressureMmHg',
  )
  const accessResistance = assertNonNegativeNumber(
    parameters.accessResistanceMmHgPerMlPerMinute,
    'accessResistanceMmHgPerMlPerMinute',
  )
  const filterResistance = assertNonNegativeNumber(
    parameters.filterResistanceMmHgPerMlPerMinute,
    'filterResistanceMmHgPerMlPerMinute',
  )
  const returnResistance = assertNonNegativeNumber(
    parameters.returnResistanceMmHgPerMlPerMinute,
    'returnResistanceMmHgPerMlPerMinute',
  )

  const accessPressure = assertFiniteNumber(
    accessReference - bloodFlow * accessResistance,
    'accessPressureMmHg',
  )
  const returnPressure = assertFiniteNumber(
    returnReference + bloodFlow * returnResistance,
    'returnPressureMmHg',
  )
  const filterPressure = assertFiniteNumber(
    returnPressure + bloodFlow * filterResistance,
    'filterPressureMmHg',
  )

  return {
    accessPressureMmHg: accessPressure,
    filterPressureMmHg: filterPressure,
    returnPressureMmHg: returnPressure,
  }
}
