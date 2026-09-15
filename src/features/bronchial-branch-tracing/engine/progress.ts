import { readCriticalCareProgress } from '@/features/learning-module/activity/progress'
import type { CriticalCareProgressEnvelope } from '@/features/learning-module/activity/types'
import { LESSONS, ORIENTATION_CONTRACT, VERSION } from '../content/lessons'
import { browserStorage } from './selfPacedProgress'

/**
 * Legacy participation records, read-only since BBT-01 (self-paced conversion).
 *
 * Earlier versions wrote lesson visits and completions, first-attempt branch scores, trace
 * participation with hint counts and orientation-check results into the shared
 * `critical-care-activity-progress-v1` envelope under `branch-tracing.<version>.*`. The course no
 * longer writes that envelope, and no route, recommendation or learner-facing text reads these
 * records. The pure readers below keep the bytes interpretable. The self-paced record in
 * `selfPacedProgress.ts` is separate and is never derived from them.
 */
export const PREFIX = `branch-tracing.${VERSION}`
export const readLegacyProgress = () => readCriticalCareProgress(browserStorage())

export function completedLessons(envelope: CriticalCareProgressEnvelope) {
  return LESSONS.filter((l) =>
    envelope.activities.some(
      (a) =>
        a.activityId ===
          `${PREFIX}.learn.${l.id}${l.id === 'orientation' ? `.${ORIENTATION_CONTRACT}` : ''}` &&
        a.status === 'completed',
    ),
  ).map((l) => l.id)
}
export function progressVersionChanged(envelope: CriticalCareProgressEnvelope) {
  return envelope.activities.some(
    (a) => a.activityId.startsWith('branch-tracing.') && !a.activityId.startsWith(`${PREFIX}.`),
  )
}
export function hasHistoricalOrientation(envelope: CriticalCareProgressEnvelope) {
  return envelope.activities.some(
    (a) => a.activityId === `${PREFIX}.learn.orientation` && a.status === 'completed',
  )
}
