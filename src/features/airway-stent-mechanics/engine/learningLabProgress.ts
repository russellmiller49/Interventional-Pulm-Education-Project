import {
  STENT_LESSON_IDS,
  isLegacyStentLessonId,
  isStentLessonId,
  type LegacyStentLessonId,
  type LegacyStentProgressStateV1,
  type StentLessonId,
  type StentProgressState,
  type StentProgressStorage,
} from './learningLabTypes'

export const STENT_PROGRESS_STORAGE_KEY = 'airway-stent-clinical-progress-v2'
export const LEGACY_STENT_PROGRESS_STORAGE_KEY = 'airway-stent-mechanics-progress-v1'
export const STENT_PROGRESS_VERSION = 2 as const
export const ENGINEERING_DEEP_DIVE_ID = 'engineering-deep-dive'

const legacyLessonAliases: Readonly<Record<LegacyStentLessonId, StentLessonId>> = {
  orient: 'indication',
  architectures: 'architecture-choice',
  'force-lab': 'architecture-choice',
  'tissue-time': 'complications-surveillance',
  'evidence-decisions': 'complications-surveillance',
  assessment: 'assessment',
}

export interface ResolvedStentLessonRequest {
  lessonId: StentLessonId
  openEngineeringDeepDive: boolean
  usedLegacyAlias: boolean
}

export function createDefaultStentProgress(): StentProgressState {
  return {
    version: STENT_PROGRESS_VERSION,
    lastLessonId: 'indication',
    completedLessonIds: [],
    completedOptionalLabIds: [],
    assessment: {
      attempts: 0,
      lastScore: null,
      lastTotal: null,
      bestPercent: null,
      mastery: false,
    },
  }
}

export const defaultStentProgress: Readonly<StentProgressState> = Object.freeze(
  createDefaultStentProgress(),
)

function isNullableNonnegativeInteger(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0)
}

function isNullablePercent(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100)
  )
}

export function parseStentProgress(
  serialized: string | null | undefined,
): StentProgressState | null {
  if (!serialized) return null

  try {
    const parsed: unknown = JSON.parse(serialized)
    if (!parsed || typeof parsed !== 'object') return null

    const candidate = parsed as Partial<StentProgressState>
    if (candidate.version !== STENT_PROGRESS_VERSION) return null
    if (!isStentLessonId(candidate.lastLessonId)) return null
    if (!Array.isArray(candidate.completedLessonIds)) return null
    if (!Array.isArray(candidate.completedOptionalLabIds)) return null
    if (!candidate.assessment || typeof candidate.assessment !== 'object') return null

    const completedLessonIds = [...new Set(candidate.completedLessonIds.filter(isStentLessonId))]
    const completedOptionalLabIds = [
      ...new Set(
        candidate.completedOptionalLabIds.filter((id): id is string => typeof id === 'string'),
      ),
    ]
    const { attempts, lastScore, lastTotal, bestPercent, mastery } = candidate.assessment

    if (typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 0) return null
    if (!isNullableNonnegativeInteger(lastScore) || !isNullableNonnegativeInteger(lastTotal)) {
      return null
    }
    if (!isNullablePercent(bestPercent) || typeof mastery !== 'boolean') return null
    if (
      attempts === 0 &&
      (lastScore !== null || lastTotal !== null || bestPercent !== null || mastery)
    ) {
      return null
    }
    if (attempts > 0 && (lastScore === null || lastTotal === null || bestPercent === null)) {
      return null
    }
    if (lastTotal !== null && (lastTotal <= 0 || (lastScore ?? 0) > lastTotal)) return null

    return {
      version: STENT_PROGRESS_VERSION,
      lastLessonId: candidate.lastLessonId,
      completedLessonIds,
      completedOptionalLabIds,
      assessment: { attempts, lastScore, lastTotal, bestPercent, mastery },
      ...(candidate.migratedFromV1 === true ? { migratedFromV1: true } : {}),
    }
  } catch {
    return null
  }
}

export function parseLegacyStentProgress(
  serialized: string | null | undefined,
): LegacyStentProgressStateV1 | null {
  if (!serialized) return null
  try {
    const parsed: unknown = JSON.parse(serialized)
    if (!parsed || typeof parsed !== 'object') return null
    const candidate = parsed as Partial<LegacyStentProgressStateV1>
    if (candidate.version !== 1 || !isLegacyStentLessonId(candidate.lastLessonId)) return null
    if (!Array.isArray(candidate.completedLessonIds)) return null
    if (!candidate.assessment || typeof candidate.assessment !== 'object') return null
    const completedLessonIds = [
      ...new Set(candidate.completedLessonIds.filter(isLegacyStentLessonId)),
    ]
    const { attempts, lastScore, bestScore, mastery } = candidate.assessment
    if (typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 0) return null
    if (!isNullableNonnegativeInteger(lastScore) || !isNullableNonnegativeInteger(bestScore)) {
      return null
    }
    if (typeof mastery !== 'boolean') return null
    if (attempts === 0 && (lastScore !== null || bestScore !== null || mastery)) return null
    if (attempts > 0 && (lastScore === null || bestScore === null)) return null
    if (lastScore !== null && lastScore > 6) return null
    if (bestScore !== null && (bestScore > 6 || bestScore < (lastScore ?? 0))) return null

    return {
      version: 1,
      lastLessonId: candidate.lastLessonId,
      completedLessonIds,
      assessment: { attempts, lastScore, bestScore, mastery },
    }
  } catch {
    return null
  }
}

export function migrateLegacyStentProgress(legacy: LegacyStentProgressStateV1): StentProgressState {
  const completedLessonIds = new Set<StentLessonId>()
  for (const legacyId of legacy.completedLessonIds) {
    if (legacyId === 'assessment' || legacyId === 'force-lab') continue
    completedLessonIds.add(legacyLessonAliases[legacyId])
  }

  return {
    ...createDefaultStentProgress(),
    lastLessonId: legacyLessonAliases[legacy.lastLessonId],
    completedLessonIds: [...completedLessonIds],
    completedOptionalLabIds: legacy.completedLessonIds.includes('force-lab')
      ? [ENGINEERING_DEEP_DIVE_ID]
      : [],
    migratedFromV1: true,
  }
}

function browserLocalStorage(): StentProgressStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readStentProgress(
  storage: StentProgressStorage | null = browserLocalStorage(),
): StentProgressState {
  if (!storage) return createDefaultStentProgress()
  try {
    const current = parseStentProgress(storage.getItem(STENT_PROGRESS_STORAGE_KEY))
    if (current) return current

    const legacy = parseLegacyStentProgress(storage.getItem(LEGACY_STENT_PROGRESS_STORAGE_KEY))
    if (!legacy) return createDefaultStentProgress()
    const migrated = migrateLegacyStentProgress(legacy)
    storage.setItem(STENT_PROGRESS_STORAGE_KEY, JSON.stringify(migrated))
    return migrated
  } catch {
    return createDefaultStentProgress()
  }
}

export function writeStentProgress(
  progress: StentProgressState,
  storage: StentProgressStorage | null = browserLocalStorage(),
): boolean {
  if (!storage) return false
  try {
    storage.setItem(STENT_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
    return true
  } catch {
    return false
  }
}

export function resolveStentLessonRequest(
  requestedLesson: string | null | undefined,
): ResolvedStentLessonRequest | null {
  if (isStentLessonId(requestedLesson)) {
    return {
      lessonId: requestedLesson,
      openEngineeringDeepDive: false,
      usedLegacyAlias: false,
    }
  }
  if (isLegacyStentLessonId(requestedLesson)) {
    return {
      lessonId: legacyLessonAliases[requestedLesson],
      openEngineeringDeepDive: requestedLesson === 'force-lab',
      usedLegacyAlias: true,
    }
  }
  return null
}

export function resolveInitialLessonId(
  explicitLesson: string | null | undefined,
  progress?: Pick<StentProgressState, 'lastLessonId'> | null,
): StentLessonId {
  const resolved = resolveStentLessonRequest(explicitLesson)
  if (resolved) return resolved.lessonId
  if (progress && isStentLessonId(progress.lastLessonId)) return progress.lastLessonId
  return 'indication'
}

export function getExplicitLessonFromSearchParams(
  searchParams: Pick<URLSearchParams, 'get'> | null | undefined,
): StentLessonId | null {
  return resolveStentLessonRequest(searchParams?.get('lesson'))?.lessonId ?? null
}

export function markLessonCompleted(
  progress: StentProgressState,
  lessonId: StentLessonId,
): StentProgressState {
  const completedLessonIds = progress.completedLessonIds.includes(lessonId)
    ? [...progress.completedLessonIds]
    : [...progress.completedLessonIds, lessonId]

  return {
    ...progress,
    lastLessonId: lessonId,
    completedLessonIds,
    completedOptionalLabIds: [...progress.completedOptionalLabIds],
    assessment: { ...progress.assessment },
  }
}

export function markOptionalLabCompleted(
  progress: StentProgressState,
  labId: string,
): StentProgressState {
  return {
    ...progress,
    completedLessonIds: [...progress.completedLessonIds],
    completedOptionalLabIds: progress.completedOptionalLabIds.includes(labId)
      ? [...progress.completedOptionalLabIds]
      : [...progress.completedOptionalLabIds, labId],
    assessment: { ...progress.assessment },
  }
}

export function setLastLesson(
  progress: StentProgressState,
  lessonId: StentLessonId,
): StentProgressState {
  return {
    ...progress,
    lastLessonId: lessonId,
    completedLessonIds: [...progress.completedLessonIds],
    completedOptionalLabIds: [...progress.completedOptionalLabIds],
    assessment: { ...progress.assessment },
  }
}

export function recordAssessmentResult(
  progress: StentProgressState,
  score: number,
  total: number,
  masteryThreshold = Math.ceil(total * 0.8),
): StentProgressState {
  if (
    !Number.isInteger(score) ||
    !Number.isInteger(total) ||
    !Number.isInteger(masteryThreshold) ||
    total <= 0
  ) {
    throw new Error('Assessment score, total, and mastery threshold must be valid integers.')
  }
  if (score < 0 || score > total) {
    throw new Error('Assessment score must be between zero and the total.')
  }
  if (masteryThreshold < 1 || masteryThreshold > total) {
    throw new Error('Assessment mastery threshold must be between one and the total.')
  }

  const percent = (score / total) * 100
  const bestPercent = Math.max(progress.assessment.bestPercent ?? 0, percent)
  const completedLessonIds = progress.completedLessonIds.includes('assessment')
    ? [...progress.completedLessonIds]
    : [...progress.completedLessonIds, 'assessment' as const]

  return {
    ...progress,
    lastLessonId: 'assessment',
    completedLessonIds,
    completedOptionalLabIds: [...progress.completedOptionalLabIds],
    assessment: {
      attempts: progress.assessment.attempts + 1,
      lastScore: score,
      lastTotal: total,
      bestPercent,
      mastery: progress.assessment.mastery || score >= masteryThreshold,
    },
  }
}

export function isModuleComplete(progress: StentProgressState): boolean {
  return STENT_LESSON_IDS.every((lessonId) => progress.completedLessonIds.includes(lessonId))
}
