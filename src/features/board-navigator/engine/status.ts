import type { Evidence, NavigatorRecord } from './record'
import { evidenceFor } from './record'
import { isReviewDue } from './schedule'

/**
 * Objective status, derived from evidence by explicit rules. The thresholds are pilot defaults,
 * not validated psychometrics; they are written here once so faculty can read and change them.
 *
 * - not-assessed: no observation at all. Visually distinct from weak performance.
 * - exploring: some evidence, not enough to call it either way.
 * - needs-focus: a repeated error pattern, or the most recent observations are misses.
 * - demonstrated: independent success on two different task kinds, at least one of them a
 *   verification or review, with the latest observation a success.
 * - review-due: demonstrated, and the scheduled retention check has come round.
 */
export type ObjectiveStatus =
  | 'not-assessed'
  | 'exploring'
  | 'needs-focus'
  | 'demonstrated'
  | 'review-due'

export const OBJECTIVE_STATUSES: readonly ObjectiveStatus[] = [
  'not-assessed',
  'exploring',
  'needs-focus',
  'demonstrated',
  'review-due',
]

export const STATUS_LABELS: Readonly<Record<ObjectiveStatus, string>> = {
  'not-assessed': 'Not yet assessed',
  exploring: 'Exploring',
  'needs-focus': 'Needs focus',
  demonstrated: 'Demonstrated',
  'review-due': 'Review due',
}

export const STATUS_DESCRIPTIONS: Readonly<Record<ObjectiveStatus, string>> = {
  'not-assessed': 'No direct evidence yet. This is not a low mark; it is an empty one.',
  exploring: 'Limited or mixed evidence. Another observation is needed.',
  'needs-focus': 'A repeated, identifiable error pattern or recent misses.',
  demonstrated: 'Independent success on more than one kind of task, including a transfer task.',
  'review-due': 'Demonstrated earlier; a retention check is due.',
}

export interface StatusSummary {
  readonly status: ObjectiveStatus
  readonly observations: number
  readonly independentSuccesses: number
  readonly misses: number
  readonly distinctSuccessKinds: number
  /** The misconception that recurred, when one did. */
  readonly recurringMisconceptionId: string | null
  readonly lastAt: string | null
}

export const RECURRING_MISS_THRESHOLD = 2

function isSuccess(entry: Evidence): boolean {
  return entry.outcome !== 'missed'
}

export function recurringMisconception(evidence: readonly Evidence[]): string | null {
  const counts = new Map<string, number>()
  for (const entry of evidence) {
    if (entry.outcome === 'missed' && entry.misconceptionId) {
      counts.set(entry.misconceptionId, (counts.get(entry.misconceptionId) ?? 0) + 1)
    }
  }
  let best: string | null = null
  let bestCount = 0
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id
      bestCount = count
    }
  }
  return bestCount >= RECURRING_MISS_THRESHOLD ? best : null
}

export function summarizeEvidence(evidence: readonly Evidence[]): Omit<StatusSummary, 'status'> {
  const independent = evidence.filter((entry) => entry.outcome === 'independent')
  const misses = evidence.filter((entry) => entry.outcome === 'missed')
  return {
    observations: evidence.length,
    independentSuccesses: independent.length,
    misses: misses.length,
    distinctSuccessKinds: new Set(independent.map((entry) => entry.taskKind)).size,
    recurringMisconceptionId: recurringMisconception(evidence),
    lastAt: evidence.length > 0 ? evidence[evidence.length - 1].at : null,
  }
}

/** Demonstrated: two independent successes of different kinds, one of them a verify or review, latest a success. */
export function isDemonstrated(evidence: readonly Evidence[]): boolean {
  if (evidence.length === 0) return false
  const latest = evidence[evidence.length - 1]
  if (!isSuccess(latest)) return false
  const independent = evidence.filter((entry) => entry.outcome === 'independent')
  const kinds = new Set(independent.map((entry) => entry.taskKind))
  const transferred = independent.some(
    (entry) => entry.phase === 'verify' || entry.phase === 'review',
  )
  return kinds.size >= 2 && transferred
}

export function deriveStatus(
  evidence: readonly Evidence[],
  review: NavigatorRecord['reviews'][string] | undefined,
  now: string,
): ObjectiveStatus {
  if (evidence.length === 0) return 'not-assessed'
  if (isDemonstrated(evidence)) {
    return isReviewDue(review, now) ? 'review-due' : 'demonstrated'
  }
  if (recurringMisconception(evidence)) return 'needs-focus'
  const recent = evidence.slice(-2)
  if (recent.length === 2 && recent.every((entry) => entry.outcome === 'missed')) {
    return 'needs-focus'
  }
  // A miss straight after a demonstrated run: the understanding did not hold.
  const latest = evidence[evidence.length - 1]
  if (latest.outcome === 'missed' && isDemonstrated(evidence.slice(0, -1))) return 'needs-focus'
  return 'exploring'
}

export function objectiveStatus(
  record: NavigatorRecord,
  objectiveId: string,
  now: string,
): StatusSummary {
  const evidence = evidenceFor(record, objectiveId)
  return {
    status: deriveStatus(evidence, record.reviews[objectiveId], now),
    ...summarizeEvidence(evidence),
  }
}

export function countByStatus(
  record: NavigatorRecord,
  objectiveIds: readonly string[],
  now: string,
): Readonly<Record<ObjectiveStatus, number>> {
  const counts: Record<ObjectiveStatus, number> = {
    'not-assessed': 0,
    exploring: 0,
    'needs-focus': 0,
    demonstrated: 0,
    'review-due': 0,
  }
  for (const id of objectiveIds) counts[objectiveStatus(record, id, now).status] += 1
  return counts
}
