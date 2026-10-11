import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import { mcsSources } from './sources'

export interface McsLearnerCopyOptions {
  /**
   * A reviewed term used in its clinical sense rather than as software or scoring vocabulary, with
   * the reason on record. The reason must name every term it excuses, so an override written for
   * one word cannot quietly cover a second.
   */
  readonly learnerCopyOverrideReason?: string
}

/**
 * The rules every learner-facing string in the rebuild's registries is held to, in one place.
 *
 * Not empty, and no term from the reviewed learner-copy list. Numbers are welcome: a value a
 * decision depends on is taught, with its source in the module's numbers register
 * (`docs/teaching-first-rules.md`). Returned as messages rather than thrown so a registry
 * validator can gather everything at once.
 */
export function mcsLearnerCopyErrors(
  where: string,
  value: string,
  options: McsLearnerCopyOptions = {},
): readonly string[] {
  const errors: string[] = []
  if (value.trim().length === 0) errors.push(`${where}: empty learner copy`)

  const flagged = flaggedLearnerCopyTerms(value)
  if (flagged.length > 0) {
    const reason = options.learnerCopyOverrideReason?.toLowerCase() ?? ''
    const unexcused = flagged.filter((term) => reason.length === 0 || !reason.includes(term))
    if (unexcused.length > 0) {
      errors.push(`${where}: learner copy contains reviewed terms: ${unexcused.join(', ')}`)
    }
  }

  return errors
}

const registeredSourceIds = new Set(mcsSources.map((source) => source.id))

/** True when every id names a record in the module's source registry. */
export function mcsSourceIdsRegistered(ids: readonly string[]): boolean {
  return ids.every((id) => registeredSourceIds.has(id))
}

/** The sentence count of a run of learner copy, for the "at most two sentences" rules. */
export function mcsSentenceCount(value: string): number {
  return value
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.length > 0).length
}
