import {
  deriveDeterministicSeed,
  nextSeededFraction,
} from '@/features/baxter-crrt/engine/seededRandom'

const ICU_NONZERO_SEED = 0x7f4a7c15

export function deriveIcuSeed(...parts: readonly (string | number)[]): number {
  return deriveDeterministicSeed('icu-simulation', ...parts)
}

export function normalizeIcuSeed(seed: number): number {
  if (!Number.isFinite(seed)) return ICU_NONZERO_SEED
  const normalized = Math.trunc(seed) >>> 0
  return normalized === 0 ? ICU_NONZERO_SEED : normalized
}

export function nextIcuRandom(state: number): { value: number; nextState: number } {
  return nextSeededFraction(normalizeIcuSeed(state))
}

export function deterministicJitterSeconds(
  seed: number,
  eventId: string,
  interval: { minimum: number; maximum: number } | null,
): number {
  if (!interval) return 0
  const eventSeed = deriveIcuSeed(seed, eventId)
  const random = nextIcuRandom(eventSeed).value
  return interval.minimum + random * (interval.maximum - interval.minimum)
}
