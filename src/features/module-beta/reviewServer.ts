import { betaRollout } from './rollout'
import type { BetaModule } from './catalog'

/** Server-side helpers for overall reviews. Kept apart from the frame's client bundle. */
export const reviewsUnavailable = 'Overall reviews are not open yet. Your answers have been kept.'

/** The module's own prompts, from its hub card. An educator answers each of these. */
export function modulePrompts(id: BetaModule['id']): readonly string[] {
  return betaRollout[id].note?.lookFor ?? []
}

/** Count rows by a key, for "N detailed reports" beside each review. */
export function countBy<T>(rows: readonly T[], key: (row: T) => string) {
  const counts: Record<string, number> = {}
  for (const row of rows) counts[key(row)] = (counts[key(row)] ?? 0) + 1
  return counts
}
