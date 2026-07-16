/**
 * Unit helpers for the CRRT engine.
 *
 * Function names state both input and output units so callers cannot silently
 * mix device blood-flow settings in mL/min with CRRT fluid flows in mL/h.
 */

export const MINUTES_PER_HOUR = 60
export const MILLILITERS_PER_LITER = 1_000

export function assertFiniteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`)
  }

  return value
}

export function assertNonNegativeNumber(value: number, label: string): number {
  assertFiniteNumber(value, label)

  if (value < 0) {
    throw new RangeError(`${label} must be zero or greater`)
  }

  return value
}

export function assertPositiveNumber(value: number, label: string): number {
  assertFiniteNumber(value, label)

  if (value <= 0) {
    throw new RangeError(`${label} must be greater than zero`)
  }

  return value
}

export function millilitersPerMinuteToMillilitersPerHour(millilitersPerMinute: number): number {
  return assertNonNegativeNumber(millilitersPerMinute, 'millilitersPerMinute') * MINUTES_PER_HOUR
}

export function millilitersPerHourToMillilitersPerMinute(millilitersPerHour: number): number {
  return assertNonNegativeNumber(millilitersPerHour, 'millilitersPerHour') / MINUTES_PER_HOUR
}

export function litersToMilliliters(liters: number): number {
  return assertNonNegativeNumber(liters, 'liters') * MILLILITERS_PER_LITER
}

export function millilitersToLiters(milliliters: number): number {
  return assertNonNegativeNumber(milliliters, 'milliliters') / MILLILITERS_PER_LITER
}

export function integrateMillilitersPerHourForHours(
  rateMillilitersPerHour: number,
  durationHours: number,
): number {
  const rate = assertNonNegativeNumber(rateMillilitersPerHour, 'rateMillilitersPerHour')
  const duration = assertNonNegativeNumber(durationHours, 'durationHours')

  return assertFiniteNumber(rate * duration, 'integratedVolumeMilliliters')
}
