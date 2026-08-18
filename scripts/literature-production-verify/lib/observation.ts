/**
 * The one rule this whole package is built around: **a read that did not succeed never becomes a
 * number.**
 *
 * The failure mode being designed out is specific and easy to hit. A verification tool asks the
 * database "how many draft articles are publicly visible?", the RPC errors, the client returns
 * `null`, some `?? 0` on the way out turns that into zero, and the tool reports "0 draft records
 * are publicly visible — public exclusion verified". It has just certified the strongest possible
 * safety claim on the strength of a request that failed.
 *
 * So every value this package reads is an `Observation<T>`, a closed union with no default-valued
 * accessor anywhere in it. There is `valueOrNull`, which forces the caller to write an explicit
 * `null` branch, and there is deliberately no `valueOr(fallback)` — the API that would make the
 * bug spellable. A check handed a non-`observed` observation returns `indeterminate`; it cannot
 * return `pass`, because the pass branch is only reachable from inside `isObserved`.
 *
 * The four states are distinct because operators act on them differently:
 *
 *   - `observed`  — the read succeeded and the value is what the target said.
 *   - `unavailable` — the target truthfully reported that the capability is off. Not an error:
 *     the runtime reporting `dedicated_runtime_not_activated` is the correct answer, and in the
 *     not-configured scenario it is the *expected* answer.
 *   - `failed` — the read was attempted and broke. Never interpretable as absence or as zero.
 *   - `skipped` — the read was never attempted, because a prerequisite was missing (no credential,
 *     no attestation file, no application base URL).
 */

export interface ObservedValue<T> {
  readonly status: 'observed'
  readonly value: T
}

export interface UnavailableObservation {
  readonly status: 'unavailable'
  /** What the target said about why the capability is off. Operator-facing, never a credential. */
  readonly reason: string
}

export interface FailedObservation {
  readonly status: 'failed'
  /** A stable machine code, e.g. `http_500`, `postgrest_PGRST202`, `network_error`. */
  readonly code: string
  readonly detail: string
}

export interface SkippedObservation {
  readonly status: 'skipped'
  readonly reason: string
}

export type Observation<T> =
  | ObservedValue<T>
  | UnavailableObservation
  | FailedObservation
  | SkippedObservation

/** The states an observation can be in, as a value, for exhaustive reporting. */
export type ObservationStatus = Observation<unknown>['status']

export function observed<T>(value: T): Observation<T> {
  return { status: 'observed', value }
}

export function unavailable<T>(reason: string): Observation<T> {
  return { status: 'unavailable', reason }
}

export function failed<T>(code: string, detail: string): Observation<T> {
  return { status: 'failed', code, detail }
}

export function skipped<T>(reason: string): Observation<T> {
  return { status: 'skipped', reason }
}

/** The only narrowing gate. Every path that reads `.value` goes through this. */
export function isObserved<T>(observation: Observation<T>): observation is ObservedValue<T> {
  return observation.status === 'observed'
}

/**
 * The value, or `null`.
 *
 * `null` and not a caller-supplied fallback, on purpose: a caller who wants a number has to write
 * the `null` branch, and writing it makes the "what if this failed?" question unavoidable.
 */
export function valueOrNull<T>(observation: Observation<T>): T | null {
  return isObserved(observation) ? observation.value : null
}

/** One line describing a non-observed state, for a check's `detail`. */
export function describeObservation(observation: Observation<unknown>): string {
  switch (observation.status) {
    case 'observed': {
      return 'observed'
    }
    case 'unavailable': {
      return `unavailable: ${observation.reason}`
    }
    case 'failed': {
      return `read failed (${observation.code}): ${observation.detail}`
    }
    case 'skipped': {
      return `not attempted: ${observation.reason}`
    }
  }
}

/**
 * Map an observation without ever inventing one.
 *
 * A non-`observed` input passes through with its state and reason intact, so the reason an
 * operator eventually reads is the reason the read actually failed — not a generic message
 * manufactured three layers up.
 */
export function mapObservation<T, U>(
  observation: Observation<T>,
  transform: (value: T) => U,
): Observation<U> {
  return isObserved(observation) ? observed(transform(observation.value)) : observation
}

/**
 * Combine two observations. Non-`observed` wins, and `failed` wins over everything else, so a
 * derived value can never be more confident than the weakest read it came from.
 */
export function combineObservations<A, B, C>(
  first: Observation<A>,
  second: Observation<B>,
  transform: (a: A, b: B) => C,
): Observation<C> {
  if (first.status === 'failed') return first
  if (second.status === 'failed') return second
  if (!isObserved(first)) return first
  if (!isObserved(second)) return second
  return observed(transform(first.value, second.value))
}
