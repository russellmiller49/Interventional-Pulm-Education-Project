import { MILLILITERS_PER_LITER } from '../engine/units'

/**
 * Mass-concentration units, in one place (CRRT-FELLOW-04, F-24).
 *
 * Cases author creatinine, phosphate, magnesium and total calcium in mg/dL, the unit a US
 * learner reads on a laboratory report. The engine's solute pools carry mass per liter (mg/L),
 * so the normalizer converts once on the way in. Both directions are derived here from the
 * dimensions themselves — a liter is 1,000 mL and a deciliter is 100 mL, so a liter holds 10
 * deciliters — instead of a bare `* 10` or `/ 10` repeated where a value happens to be shown.
 *
 * Conversion changes the unit a number is written in, never the quantity. It supplies no
 * clinical value, and it does not turn a model marker into a measured analyte: the small-solute
 * (urea) marker is in mmol/L and stays a marker, not a BUN result.
 */
export const MILLILITERS_PER_DECILITER = 100
export const DECILITERS_PER_LITER = MILLILITERS_PER_LITER / MILLILITERS_PER_DECILITER

/** The unit every learner-facing mass concentration in this module is written in. */
export const CRRT_LEARNER_MASS_CONCENTRATION_UNIT = 'mg/dL' as const

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`)
  return value
}

/** mg/dL × (dL per L) = mg/L. */
export function milligramsPerDeciliterToMilligramsPerLiter(milligramsPerDeciliter: number): number {
  return finite(milligramsPerDeciliter, 'milligramsPerDeciliter') * DECILITERS_PER_LITER
}

/** mg/L ÷ (dL per L) = mg/dL. */
export function milligramsPerLiterToMilligramsPerDeciliter(milligramsPerLiter: number): number {
  return finite(milligramsPerLiter, 'milligramsPerLiter') / DECILITERS_PER_LITER
}

/**
 * A mass concentration as a learner reads it. A missing value stays missing — it is never
 * converted into a zero — and the result always names its unit.
 */
export function learnerMassConcentrationFromMilligramsPerLiter(milligramsPerLiter: number | null): {
  readonly value: number | null
  readonly unit: typeof CRRT_LEARNER_MASS_CONCENTRATION_UNIT
} {
  return {
    value:
      milligramsPerLiter === null
        ? null
        : milligramsPerLiterToMilligramsPerDeciliter(milligramsPerLiter),
    unit: CRRT_LEARNER_MASS_CONCENTRATION_UNIT,
  }
}
