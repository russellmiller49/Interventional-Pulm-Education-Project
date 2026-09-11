import {
  readCriticalCareProgress,
  writeCriticalCareProgress,
  upsertCriticalCareActivityProgress,
} from '@/features/learning-module/activity/progress'
import type { CriticalCareProgressEnvelope } from '@/features/learning-module/activity/types'
import { BASE_PATH, LESSONS, VERSION } from '../content/lessons'
import type { Exercise } from '../content/types'
import { scoreResponse, type Response } from './session'

export const PREFIX = `branch-tracing.${VERSION}`
export function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
export const readProgress = () => readCriticalCareProgress(browserStorage())
export function completedLessons(envelope: CriticalCareProgressEnvelope) {
  return LESSONS.filter((l) =>
    envelope.activities.some(
      (a) => a.activityId === `${PREFIX}.learn.${l.id}` && a.status === 'completed',
    ),
  ).map((l) => l.id)
}
export function recordFirst(
  envelope: CriticalCareProgressEnvelope,
  key: string,
  exercise: Exercise,
  response: Response,
) {
  const scores = scoreResponse(exercise, response)
  let next = envelope
  for (const domain of ['connectivity', 'viewpoint'] as const) {
    const activityId = `${PREFIX}.${key}.${domain}.first`
    if (next.activities.some((a) => a.activityId === activityId)) continue
    next = upsertCriticalCareActivityProgress(next, {
      activityId,
      status: 'completed',
      attempts: 1,
      bestScore:
        domain === 'connectivity'
          ? scores.connectivity * 100
          : Math.round((scores.viewpoint / scores.viewpointTotal) * 100),
      hintCount: response.hints,
      competencyEvidenceIds: [],
      updatedAt: new Date().toISOString(),
    })
  }
  return next
}
export function saveFirst(key: string, exercise: Exercise, response: Response) {
  return writeCriticalCareProgress(
    browserStorage(),
    recordFirst(readProgress(), key, exercise, response),
  )
}
export function saveBranchFirst(
  key: string,
  exercise: Exercise,
  response: { branchId: string; hints: number },
) {
  const activityId = `${PREFIX}.${key}.connectivity.first`
  const current = readProgress()
  if (current.activities.some((a) => a.activityId === activityId)) return true
  return writeCriticalCareProgress(
    browserStorage(),
    upsertCriticalCareActivityProgress(current, {
      activityId,
      status: 'completed',
      attempts: 1,
      bestScore: Number(response.branchId === exercise.targetId) * 100,
      hintCount: response.hints,
      competencyEvidenceIds: [],
      updatedAt: new Date().toISOString(),
    }),
  )
}
export function saveVisit(id: string, complete = false) {
  const now = new Date().toISOString(),
    activityId = `${PREFIX}.learn.${id}`
  return writeCriticalCareProgress(
    browserStorage(),
    upsertCriticalCareActivityProgress(
      readProgress(),
      {
        activityId,
        status: complete ? 'completed' : 'in-progress',
        attempts: 0,
        competencyEvidenceIds: [],
        updatedAt: now,
      },
      {
        activityId,
        pathname: `${BASE_PATH}/learn`,
        query: { lesson: id },
        mode: 'guided',
        phase: 'recognize',
        payloadVersion: VERSION,
        updatedAt: now,
      },
    ),
  )
}
export function progressVersionChanged(envelope: CriticalCareProgressEnvelope) {
  return envelope.activities.some(
    (a) => a.activityId.startsWith('branch-tracing.') && !a.activityId.startsWith(`${PREFIX}.`),
  )
}

/** CT responses record participation and assistance, never unreviewed clinical scores. */
export function saveCtAttempt(key: string, hints: number) {
  const activityId = `${PREFIX}.${key}.trace.first`
  const current = readProgress()
  if (current.activities.some((a) => a.activityId === activityId)) return true
  return writeCriticalCareProgress(
    browserStorage(),
    upsertCriticalCareActivityProgress(current, {
      activityId,
      status: 'completed',
      attempts: 1,
      hintCount: hints,
      competencyEvidenceIds: [],
      updatedAt: new Date().toISOString(),
    }),
  )
}
