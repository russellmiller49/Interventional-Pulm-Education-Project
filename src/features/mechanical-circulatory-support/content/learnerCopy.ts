import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import { mcsSources } from './sources'

/**
 * Phrasings that turn a contextual value into a universal instruction.
 *
 * Mirrored from `critical-care/test-support/teachingPanelContract.tsx`, which cannot be imported by
 * content because it calls jest's `expect`; the sibling ECMO module keeps the same mirror and holds
 * the two to each other by reading that file's source. Every pattern needs a digit, so copy that
 * carries no number cannot match one — the check is kept anyway, so a registry that later admits a
 * sourced number still cannot phrase it as a target.
 */
export const mcsUniversalTargetPatterns: readonly RegExp[] = [
  /\btarget of\s*\d/i,
  /\bshould (always )?be (above|below|over|under|greater than|less than)\s*\d/i,
  /\bkeep\b[^.]{0,32}\b(above|below|over|under)\s*\d/i,
  /\bnormal is\s*\d/i,
  /\bnormal range is\s*\d/i,
  /\baim for\s*\d/i,
]

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
 * No digit — a learner leaves with a direction and a comparison, never a number; the sourced
 * numbers this module carries live in the value guides with their provenance beside them. No term
 * from the reviewed learner-copy list. No phrasing that reads as a universal bedside target.
 * Returned as messages rather than thrown so a registry validator can gather everything at once.
 */
export function mcsLearnerCopyErrors(
  where: string,
  value: string,
  options: McsLearnerCopyOptions = {},
): readonly string[] {
  const errors: string[] = []
  if (value.trim().length === 0) errors.push(`${where}: empty learner copy`)
  if (/\d/.test(value)) errors.push(`${where}: a number appears in learner-facing copy`)

  const flagged = flaggedLearnerCopyTerms(value)
  if (flagged.length > 0) {
    const reason = options.learnerCopyOverrideReason?.toLowerCase() ?? ''
    const unexcused = flagged.filter((term) => reason.length === 0 || !reason.includes(term))
    if (unexcused.length > 0) {
      errors.push(`${where}: learner copy contains reviewed terms: ${unexcused.join(', ')}`)
    }
  }

  for (const pattern of mcsUniversalTargetPatterns) {
    if (pattern.test(value))
      errors.push(`${where}: reads as a universal target (${pattern.source})`)
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
