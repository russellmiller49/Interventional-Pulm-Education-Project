/**
 * What a scope lab asks for, and whether the learner's drive has done it.
 *
 * The airway module reports every change of edge (`onLocationChange`); the stage session keeps the
 * ordered entries and the breathing cue's phase at each one. A goal reads only that history, so it
 * is pure and testable without a renderer. Skipping a step never adds an entry.
 */
export type BreathCuePhase = 'closed' | 'open'

export interface ScopeEntry {
  readonly abbr: string
  /** The breathing cue's phase when the scope entered this place; null when no cue was shown. */
  readonly cuePhase: BreathCuePhase | null
}

export interface ScopeHistory {
  /** Every change of place, in order. Consecutive repeats are collapsed. */
  readonly entries: readonly ScopeEntry[]
  readonly current: string | null
}

export type ScopeGoal =
  /** Get the tip into this place. */
  | { readonly kind: 'reach'; readonly abbr: string; readonly label: string }
  /** Reach these places in this order (others may come between). */
  | { readonly kind: 'reach-in-order'; readonly abbrs: readonly string[]; readonly label: string }
  /** Enter each of these places at least once, in any order. */
  | { readonly kind: 'visit-all'; readonly abbrs: readonly string[]; readonly label: string }
  /**
   * A place to stay out of. Met while the tip is not in it; entering it shows the hint, and
   * backing out meets the goal again. It never stands alone as a section's work.
   */
  | {
      readonly kind: 'avoid'
      readonly abbr: string
      readonly label: string
      readonly hint: string
    }
  /**
   * Wait at `abbr` and enter `thenAbbr` only while the cue is `open`. Entering on a closed cue
   * shows `hint` and does not meet the goal; the learner backs out and waits again.
   */
  | {
      readonly kind: 'hold-at'
      readonly abbr: string
      readonly thenAbbr: string
      readonly untilCue: 'glottis-open'
      readonly label: string
      readonly hint: string
    }

export const EMPTY_SCOPE_HISTORY: ScopeHistory = { entries: [], current: null }

export function withScopeEntry(
  history: ScopeHistory,
  abbr: string,
  cuePhase: BreathCuePhase | null,
): ScopeHistory {
  if (history.current === abbr) return history
  return { entries: [...history.entries, { abbr, cuePhase }], current: abbr }
}

export function visitedAbbrs(history: ScopeHistory): readonly string[] {
  return [...new Set(history.entries.map((entry) => entry.abbr))]
}

function reachedInOrder(history: ScopeHistory, abbrs: readonly string[]): boolean {
  let next = 0
  for (const entry of history.entries) {
    if (entry.abbr === abbrs[next]) next += 1
    if (next === abbrs.length) return true
  }
  return abbrs.length === 0
}

/** Entries of `thenAbbr` that came straight from `abbr`. */
function crossings(history: ScopeHistory, abbr: string, thenAbbr: string): readonly ScopeEntry[] {
  return history.entries.filter(
    (entry, index) => entry.abbr === thenAbbr && history.entries[index - 1]?.abbr === abbr,
  )
}

export function scopeGoalMet(goal: ScopeGoal, history: ScopeHistory): boolean {
  switch (goal.kind) {
    case 'reach':
      return history.entries.some((entry) => entry.abbr === goal.abbr)
    case 'reach-in-order':
      return reachedInOrder(history, goal.abbrs)
    case 'visit-all': {
      const visited = new Set(visitedAbbrs(history))
      return goal.abbrs.every((abbr) => visited.has(abbr))
    }
    case 'avoid':
      return history.current !== goal.abbr
    case 'hold-at':
      return crossings(history, goal.abbr, goal.thenAbbr).some((entry) => entry.cuePhase === 'open')
  }
}

/** A lab's work is done when every goal holds and at least one goal is more than an `avoid`. */
export function scopeGoalsMet(goals: readonly ScopeGoal[], history: ScopeHistory): boolean {
  return goals.some((goal) => goal.kind !== 'avoid') && goals.every((g) => scopeGoalMet(g, history))
}

/**
 * The hint the learner should read now, if any: the tip is in a place an `avoid` goal names, or it
 * has just crossed into a `hold-at` destination on a closed cue.
 */
export function scopeGoalHint(goals: readonly ScopeGoal[], history: ScopeHistory): string | null {
  for (const goal of goals) {
    if (goal.kind === 'avoid' && history.current === goal.abbr) return goal.hint
    if (goal.kind === 'hold-at') {
      const last = history.entries.at(-1)
      const before = history.entries.at(-2)
      if (
        last?.abbr === goal.thenAbbr &&
        before?.abbr === goal.abbr &&
        last.cuePhase === 'closed' &&
        !scopeGoalMet(goal, history)
      ) {
        return goal.hint
      }
    }
  }
  return null
}
