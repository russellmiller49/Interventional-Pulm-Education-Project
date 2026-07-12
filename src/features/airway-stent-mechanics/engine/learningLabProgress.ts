import { assessmentMasteryThreshold } from '../content/learningLabCopy'
import {
  STENT_LESSON_IDS,
  isStentLessonId,
  type StentLessonId,
  type StentProgressState,
  type StentProgressStorage,
} from './learningLabTypes'

export const STENT_PROGRESS_STORAGE_KEY = 'airway-stent-mechanics-progress-v1'
export const STENT_PROGRESS_VERSION = 1 as const

export function createDefaultStentProgress(): StentProgressState {
  return {
    version: STENT_PROGRESS_VERSION,
    lastLessonId: 'orient',
    completedLessonIds: [],
    assessment: {
      attempts: 0,
      lastScore: null,
      bestScore: null,
      mastery: false,
    },
  }
}

export const defaultStentProgress: Readonly<StentProgressState> = Object.freeze(
  createDefaultStentProgress(),
)

function isNullableScore(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6)
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
    if (!candidate.assessment || typeof candidate.assessment !== 'object') return null

    const completedLessonIds = [...new Set(candidate.completedLessonIds.filter(isStentLessonId))]
    const { attempts, lastScore, bestScore, mastery } = candidate.assessment

    if (typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 0) return null
    if (!isNullableScore(lastScore) || !isNullableScore(bestScore)) return null
    if (typeof mastery !== 'boolean') return null
    if (attempts === 0 && (lastScore !== null || bestScore !== null || mastery)) return null
    if (attempts > 0 && (lastScore === null || bestScore === null)) return null
    if (lastScore !== null && bestScore !== null && bestScore < lastScore) return null

    return {
      version: STENT_PROGRESS_VERSION,
      lastLessonId: candidate.lastLessonId,
      completedLessonIds,
      assessment: {
        attempts,
        lastScore,
        bestScore,
        mastery: bestScore !== null ? bestScore >= assessmentMasteryThreshold : mastery,
      },
    }
  } catch {
    return null
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
    return (
      parseStentProgress(storage.getItem(STENT_PROGRESS_STORAGE_KEY)) ??
      createDefaultStentProgress()
    )
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

export function resolveInitialLessonId(
  explicitLesson: string | null | undefined,
  progress?: Pick<StentProgressState, 'lastLessonId'> | null,
): StentLessonId {
  if (isStentLessonId(explicitLesson)) return explicitLesson
  if (progress && isStentLessonId(progress.lastLessonId)) return progress.lastLessonId
  return 'orient'
}

export function getExplicitLessonFromSearchParams(
  searchParams: Pick<URLSearchParams, 'get'> | null | undefined,
): StentLessonId | null {
  const lesson = searchParams?.get('lesson')
  return isStentLessonId(lesson) ? lesson : null
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
    assessment: { ...progress.assessment },
  }
}

export function recordAssessmentResult(
  progress: StentProgressState,
  score: number,
  total = 6,
): StentProgressState {
  if (!Number.isInteger(score) || !Number.isInteger(total) || total <= 0) {
    throw new Error('Assessment score and total must be integers, and total must be positive.')
  }
  if (score < 0 || score > total) {
    throw new Error('Assessment score must be between zero and the total.')
  }
  if (total !== 6) {
    throw new Error('The airway-stent integrated assessment contains exactly six items.')
  }

  const bestScore = Math.max(progress.assessment.bestScore ?? 0, score)
  const completedLessonIds = progress.completedLessonIds.includes('assessment')
    ? [...progress.completedLessonIds]
    : [...progress.completedLessonIds, 'assessment' as const]

  return {
    ...progress,
    lastLessonId: 'assessment',
    completedLessonIds,
    assessment: {
      attempts: progress.assessment.attempts + 1,
      lastScore: score,
      bestScore,
      mastery: bestScore >= assessmentMasteryThreshold,
    },
  }
}

export function isModuleComplete(progress: StentProgressState): boolean {
  return STENT_LESSON_IDS.every((lessonId) => progress.completedLessonIds.includes(lessonId))
}
