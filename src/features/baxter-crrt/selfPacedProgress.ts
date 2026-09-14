import {
  isBaxterCrrtLearnerLessonId,
  type BaxterCrrtLearnLessonId,
} from './content/learnerRegistry'
import { baxterCrrtPracticeCaseIds } from './content/curriculum'
import { crrtLearnTasks } from './content/learnTasks'
import {
  BAXTER_CRRT_PROGRESS_STORAGE_KEY,
  createDefaultProgress,
  type BaxterCrrtProgressStorage,
} from './engine/progress'

export type CrrtLearningLocation =
  | { section: 'learn'; id: string; taskId?: string }
  | { section: 'practice'; id: string }
  | { section: 'assess'; id: 'MASTERY-PRISMAX-01' }

export interface CrrtSelfPacedProgress {
  readonly visitedLessonIds: readonly string[]
  readonly visitedCaseIds: readonly string[]
  readonly lastLocation?: CrrtLearningLocation
  readonly updatedAt?: string
}

const empty = (): CrrtSelfPacedProgress => ({ visitedLessonIds: [], visitedCaseIds: [] })
const isCase = (id: unknown): id is string =>
  typeof id === 'string' && (baxterCrrtPracticeCaseIds as readonly string[]).includes(id)
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export function validCrrtLearningLocation(value: unknown): value is CrrtLearningLocation {
  if (!isRecord(value) || typeof value.id !== 'string') return false
  if (value.section === 'practice') return isCase(value.id)
  if (value.section === 'assess') return value.id === 'MASTERY-PRISMAX-01'
  if (value.section !== 'learn' || !isBaxterCrrtLearnerLessonId(value.id)) return false
  return (
    value.taskId === undefined ||
    crrtLearnTasks[value.id as BaxterCrrtLearnLessonId]?.some(
      (task) => task.id === value.taskId,
    ) === true
  )
}

export function parseCrrtSelfPacedProgress(value: unknown): CrrtSelfPacedProgress {
  if (!isRecord(value)) return empty()
  const lessons = Array.isArray(value.visitedLessonIds) ? value.visitedLessonIds : []
  const cases = Array.isArray(value.visitedCaseIds) ? value.visitedCaseIds : []
  return {
    visitedLessonIds: [
      ...new Set(
        lessons.filter(
          (id): id is string => typeof id === 'string' && isBaxterCrrtLearnerLessonId(id),
        ),
      ),
    ],
    visitedCaseIds: [...new Set(cases.filter(isCase))],
    ...(typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt))
      ? { updatedAt: value.updatedAt }
      : {}),
    ...(validCrrtLearningLocation(value.lastLocation) ? { lastLocation: value.lastLocation } : {}),
  }
}

function browserStorage(): BaxterCrrtProgressStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function readCrrtSelfPacedProgress(
  storage: Pick<BaxterCrrtProgressStorage, 'getItem'> | null = browserStorage(),
): CrrtSelfPacedProgress {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY) ?? 'null')
    return isRecord(raw) && raw.version === 3 ? parseCrrtSelfPacedProgress(raw.selfPaced) : empty()
  } catch {
    return empty()
  }
}

/** Extend the existing local store. Never canonicalize, migrate or modify legacy records. */
export function recordCrrtVisit(
  location: CrrtLearningLocation,
  storage: BaxterCrrtProgressStorage | null = browserStorage(),
): boolean {
  if (!storage || !validCrrtLearningLocation(location)) return false
  try {
    const serialized = storage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)
    const raw: unknown = serialized === null ? createDefaultProgress() : JSON.parse(serialized)
    // An unreadable or unsupported historical record must remain untouched.
    if (!isRecord(raw) || raw.version !== 3) return false
    const current = parseCrrtSelfPacedProgress(raw.selfPaced)
    const selfPaced: CrrtSelfPacedProgress = {
      visitedLessonIds:
        location.section === 'learn'
          ? [...new Set([...current.visitedLessonIds, location.id])]
          : current.visitedLessonIds,
      visitedCaseIds:
        location.section === 'practice'
          ? [...new Set([...current.visitedCaseIds, location.id])]
          : current.visitedCaseIds,
      lastLocation: location,
      updatedAt: new Date().toISOString(),
    }
    storage.setItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY, JSON.stringify({ ...raw, selfPaced }))
    return true
  } catch {
    return false
  }
}
