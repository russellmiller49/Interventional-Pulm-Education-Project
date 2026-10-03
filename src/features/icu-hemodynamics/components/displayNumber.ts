/** Round for presentation without displaying negative zero; acquired values stay untouched. */
export function displayNumber(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const rounded = value.toFixed(digits)
  return Number(rounded) === 0 ? (0).toFixed(digits) : rounded
}
