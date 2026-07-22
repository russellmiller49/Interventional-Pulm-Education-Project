export function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, value))
}

export function roundTo(value: number, places = 2): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

export function moveTowardExp(
  value: number,
  target: number,
  deltaSeconds: number,
  timeConstantSeconds: number,
): number {
  const fraction = 1 - Math.exp(-Math.max(0, deltaSeconds) / Math.max(0.001, timeConstantSeconds))
  return value + (target - value) * fraction
}

export function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

export function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort()
}
