import type { BronchSequence } from '../content/types'

/**
 * The order an ordering task is shown in (fellow walkthrough A7).
 *
 * The first display used to be the authored order rotated by a hash, so the worked order could be
 * read off the screen by moving the top steps to the bottom. The display is now a permutation
 * keyed by the sequence id, its step ids and a round number, and it is never the worked order or a
 * rotation of it.
 *
 * It is a function, not a random draw: the same sequence and round always give the same order, so a
 * re-render, a look back or a reload cannot rearrange what the learner is working on. The round
 * changes only when the learner asks — "Try the order again" or "Shuffle the steps again". The
 * canonical order stays the authored `steps` array; nothing here reads or changes it, and no step
 * id, key or critical-step mark depends on the round.
 */
function fnv1a(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), state | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** True when `order` is `authored` started somewhere else and read round (the identity included). */
export function isRotationOf(order: readonly string[], authored: readonly string[]): boolean {
  if (order.length !== authored.length) return false
  if (authored.length === 0) return true
  const start = order.indexOf(authored[0])
  if (start < 0) return false
  return authored.every((id, index) => order[(start + index) % order.length] === id)
}

function permutation(ids: readonly string[], seed: string): string[] {
  const next = [...ids]
  const random = mulberry32(fnv1a(seed))
  for (let index = next.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[next[index], next[other]] = [next[other], next[index]]
  }
  return next
}

const MAX_DRAWS = 32

/** The displayed order for a round. Round 0 is what the task opens with. */
export function sequenceOrderForRound(sequence: BronchSequence, round: number): readonly string[] {
  const authored = sequence.steps.map((step) => step.id)
  // Fewer than three steps have no order that is neither the worked one nor a rotation of it.
  if (authored.length < 3) return authored
  const previous: readonly string[] | null =
    round > 0 ? sequenceOrderForRound(sequence, round - 1) : null
  const key = `${sequence.id}|${authored.join(',')}|${round}`
  for (let draw = 0; draw < MAX_DRAWS; draw += 1) {
    const candidate = permutation(authored, `${key}|${draw}`)
    if (isRotationOf(candidate, authored)) continue
    if (previous && candidate.every((id, index) => previous[index] === id)) continue
    return candidate
  }
  // Unreachable for an authored sequence; a fixed non-rotation keeps the function total.
  const fallback = [...authored]
  ;[fallback[0], fallback[1]] = [fallback[1], fallback[0]]
  return fallback
}
