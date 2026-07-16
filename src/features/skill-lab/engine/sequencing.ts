/**
 * Pure grading for the step-sequencing drill.
 *
 * `scoreSequence` compares a learner's ordering (an array of step ids) against
 * the authored correct order and reports how many positions match, the first
 * position that is wrong, and whether the attempt passes (every position
 * correct). No React, no I/O — unit-tested in isolation.
 */

import type { SequenceScore } from './types'

/**
 * Grade an ordering against the correct order.
 *
 * Both arrays are expected to contain the same set of ids; `correctPositions`
 * counts index-for-index matches, so a single early insertion that shifts the
 * rest is correctly penalized as multiple misplacements. `total` is the length
 * of the authored correct order, so a short/long learner order still grades
 * against the real target. A pass requires every authored position to match.
 */
export function scoreSequence(order: string[], correctOrder: string[]): SequenceScore {
  const total = correctOrder.length

  let correctPositions = 0
  let firstErrorIndex: number | null = null

  for (let index = 0; index < total; index += 1) {
    if (order[index] === correctOrder[index]) {
      correctPositions += 1
    } else if (firstErrorIndex === null) {
      firstErrorIndex = index
    }
  }

  // Extra trailing entries in the learner order (longer than the target) count
  // as a placement error even though the loop above stops at `total`.
  if (firstErrorIndex === null && order.length !== total) {
    firstErrorIndex = total
  }

  return {
    correctPositions,
    total,
    firstErrorIndex,
    passed: correctPositions === total && order.length === total,
  }
}
