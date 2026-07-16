import type { CrrtScheduledEvent, CrrtScheduledEventDefinition } from './types'

const NONZERO_FALLBACK_SEED = 0x6d2b79f5

export function deriveDeterministicSeed(...parts: readonly (string | number)[]): number {
  const text = parts.join(':')
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const seed = hash >>> 0
  return seed === 0 ? NONZERO_FALLBACK_SEED : seed
}

export function nextSeededUint32(state: number): { value: number; nextState: number } {
  if (!Number.isInteger(state) || state < 0 || state > 0xffffffff) {
    throw new RangeError('Seed state must be an unsigned 32-bit integer.')
  }
  let next = state === 0 ? NONZERO_FALLBACK_SEED : state >>> 0
  next ^= next << 13
  next ^= next >>> 17
  next ^= next << 5
  next >>>= 0
  return { value: next, nextState: next }
}

export function nextSeededFraction(state: number): { value: number; nextState: number } {
  const next = nextSeededUint32(state)
  return { value: next.value / 0x100000000, nextState: next.nextState }
}

function scheduledTime(definition: CrrtScheduledEventDefinition, seed: number): number {
  if (!Number.isFinite(definition.atSeconds) || definition.atSeconds < 0) {
    throw new RangeError(`Event ${definition.id} must have a nonnegative finite time.`)
  }
  if (!definition.jitterSeconds) return definition.atSeconds

  const { minimum, maximum } = definition.jitterSeconds
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum) {
    throw new RangeError(`Event ${definition.id} has an invalid jitter interval.`)
  }
  const eventSeed = deriveDeterministicSeed(seed, definition.id)
  const random = nextSeededFraction(eventSeed).value
  const offset = minimum + random * (maximum - minimum)
  return Math.max(0, definition.atSeconds + offset)
}

/**
 * Builds a replayable queue. Jitter is permitted only when authored content
 * explicitly bounds it; it must never choose the correct clinical branch.
 */
export function buildSeededEventQueue(
  definitions: readonly CrrtScheduledEventDefinition[],
  seed: number,
): readonly CrrtScheduledEvent[] {
  const ids = new Set<string>()
  const queue = definitions.map((definition) => {
    if (!definition.id || ids.has(definition.id)) {
      throw new Error(`Scheduled event IDs must be nonempty and unique: ${definition.id}`)
    }
    ids.add(definition.id)
    return {
      ...definition,
      jitterSeconds: definition.jitterSeconds ? { ...definition.jitterSeconds } : null,
      action: { ...definition.action },
      sourceIds: [...definition.sourceIds],
      scheduledAtSeconds: scheduledTime(definition, seed),
    }
  })

  return queue.sort(
    (left, right) =>
      left.scheduledAtSeconds - right.scheduledAtSeconds || left.id.localeCompare(right.id),
  )
}
