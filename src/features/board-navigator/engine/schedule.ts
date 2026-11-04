import type { ReviewEntry } from './record'

/**
 * Spaced review: an expanding Leitner-style schedule. The intervals are a teaching convention
 * recorded in the numbers register (`review-intervals`), chosen for the pilot and tuned on data.
 * Retained → the next interval. Missed → back to the first interval, and the recommendation engine
 * routes the learner to the explanation rather than serving the same item again.
 */
export const REVIEW_INTERVAL_DAYS: readonly number[] = [3, 7, 14, 30]

const DAY_MS = 24 * 60 * 60 * 1000

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString()
}

/** The first review after an objective is demonstrated. */
export function scheduleFirstReview(now: string): ReviewEntry {
  return { stage: 0, dueAt: addDays(now, REVIEW_INTERVAL_DAYS[0]), lastAt: now }
}

/** The next review after a retention check. */
export function scheduleAfterReview(
  current: ReviewEntry | undefined,
  retained: boolean,
  now: string,
): ReviewEntry {
  if (!retained) return { stage: 0, dueAt: addDays(now, REVIEW_INTERVAL_DAYS[0]), lastAt: now }
  const stage = Math.min((current?.stage ?? 0) + 1, REVIEW_INTERVAL_DAYS.length - 1)
  return { stage, dueAt: addDays(now, REVIEW_INTERVAL_DAYS[stage]), lastAt: now }
}

export function isReviewDue(review: ReviewEntry | undefined, now: string): boolean {
  return review !== undefined && new Date(review.dueAt).getTime() <= new Date(now).getTime()
}

/** Whole days until a review is due; negative when overdue. */
export function daysUntil(review: ReviewEntry, now: string): number {
  return Math.ceil((new Date(review.dueAt).getTime() - new Date(now).getTime()) / DAY_MS)
}
