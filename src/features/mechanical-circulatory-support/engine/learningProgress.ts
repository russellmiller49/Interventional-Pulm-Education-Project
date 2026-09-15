import type { McsDeviceKind, McsModuleSection } from './types'
import { mcsLessons } from '../content/lessons'
import { allMcsScenarios } from '../content/scenarios'

// Reuse the existing local envelope. Historical fields are never updated or interpreted as visits.
export const MCS_LOCAL_PROGRESS_KEY = 'interventionalpulm:mcs-progress:v1'
export interface McsLearningProgress {
  readonly visitedLessonIds: readonly string[]
  readonly visitedCaseIds: readonly string[]
  readonly lastActivityId: string | null
  readonly lastSection: McsModuleSection
  readonly lastDevice: McsDeviceKind
  readonly lastPhase: string
  /** Timestamp of the current location only, for ordering the shared Continue target. */
  readonly locationUpdatedAt: string | null
}

export function emptyMcsLearningProgress(): McsLearningProgress {
  return {
    visitedLessonIds: [],
    visitedCaseIds: [],
    lastActivityId: null,
    lastSection: 'learn',
    lastDevice: 'iabp',
    lastPhase: 'recognize',
    locationUpdatedAt: null,
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function parseMcsLearningProgress(value: unknown): McsLearningProgress {
  if (!record(value)) return emptyMcsLearningProgress()
  const lessonIds = mcsLessons.map((lesson) => lesson.id)
  const caseIds = allMcsScenarios.map((scenario) => scenario.id)
  const known = (items: unknown, ids: readonly string[]) =>
    Array.isArray(items) ? [...new Set(items.filter((id): id is string => ids.includes(id)))] : []
  return {
    locationUpdatedAt:
      typeof value.locationUpdatedAt === 'string' &&
      Number.isFinite(Date.parse(value.locationUpdatedAt)) &&
      new Date(value.locationUpdatedAt).toISOString() === value.locationUpdatedAt
        ? value.locationUpdatedAt
        : null,
    visitedLessonIds: known(value.visitedLessonIds, lessonIds),
    visitedCaseIds: known(value.visitedCaseIds, caseIds),
    lastActivityId:
      typeof value.lastActivityId === 'string' &&
      [...lessonIds, ...caseIds].includes(value.lastActivityId)
        ? value.lastActivityId
        : null,
    lastSection:
      value.lastSection === 'practice' || value.lastSection === 'assess'
        ? value.lastSection
        : 'learn',
    lastDevice:
      value.lastDevice === 'impella' || value.lastDevice === 'lvad' ? value.lastDevice : 'iabp',
    lastPhase:
      typeof value.lastPhase === 'string' &&
      ['recognize', 'predict', 'act', 'observe', 'explain', 'transfer'].includes(value.lastPhase)
        ? value.lastPhase
        : 'recognize',
  }
}

export function readMcsLearningProgress(): McsLearningProgress {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(MCS_LOCAL_PROGRESS_KEY) ?? 'null')
    return record(raw) && raw.version === 1
      ? parseMcsLearningProgress(raw.selfPaced)
      : emptyMcsLearningProgress()
  } catch {
    return emptyMcsLearningProgress()
  }
}

/** Location and visits only; no answers, help use, action history, success, grades or attempt counts. */
export function recordMcsVisit(
  id: string,
  section: McsModuleSection,
  device: McsDeviceKind,
  phase = 'recognize',
): boolean {
  try {
    const raw: unknown = JSON.parse(
      window.localStorage.getItem(MCS_LOCAL_PROGRESS_KEY) ?? '{"version":1}',
    )
    // Unknown/corrupt envelopes are left intact, even when that means resume cannot be saved.
    if (!record(raw) || raw.version !== 1) return false
    const previous = parseMcsLearningProgress(raw.selfPaced)
    const next = parseMcsLearningProgress({
      ...previous,
      visitedLessonIds:
        section === 'learn' ? [...previous.visitedLessonIds, id] : previous.visitedLessonIds,
      visitedCaseIds:
        section !== 'learn' ? [...previous.visitedCaseIds, id] : previous.visitedCaseIds,
      lastActivityId: id,
      lastSection: section,
      lastDevice: device,
      lastPhase: phase,
      locationUpdatedAt: new Date().toISOString(),
    })
    if (!next.lastActivityId) return false
    window.localStorage.setItem(MCS_LOCAL_PROGRESS_KEY, JSON.stringify({ ...raw, selfPaced: next }))
    return true
  } catch {
    return false
  }
}
