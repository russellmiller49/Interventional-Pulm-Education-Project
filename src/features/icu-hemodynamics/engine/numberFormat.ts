/**
 * `toFixed` for a number a learner reads.
 *
 * `(-0.3).toFixed(0)` is `"-0"` and `(-0.04).toFixed(1)` is `"-0.0"`: a rounded zero that keeps the
 * sign of the value it was rounded from. A right-ventricular diastolic pressure and a levelled
 * venous pressure both sit close enough to zero to print that, and "-0 mmHg" reads as a pressure
 * below zero (report P-07). The rounding is unchanged; only a zero's sign is dropped.
 */
export function fixedWithoutNegativeZero(value: number, digits = 0): string {
  const text = value.toFixed(digits)
  return Number(text) === 0 ? text.replace(/^-/, '') : text
}
