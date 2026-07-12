import {
  STENT_LESSON_IDS,
  isLegacyStentLessonId,
  isStentLessonId,
  type LegacyStentLessonId,
  type LegacyStentProgressStateV1,
  type LegacyStentProgressStateV2,
  type StentAssessmentProgress,
  type StentCaseProgress,
  type StentLessonId,
  type StentProgressState,
  type StentProgressStorage,
} from './learningLabTypes'

export const STENT_PROGRESS_STORAGE_KEY = 'airway-stent-clinical-progress-v3'
export const PREVIOUS_STENT_PROGRESS_STORAGE_KEY = 'airway-stent-clinical-progress-v2'
export const LEGACY_STENT_PROGRESS_STORAGE_KEY = 'airway-stent-mechanics-progress-v1'
export const STENT_PROGRESS_VERSION = 3 as const
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
    lastCaseId: null,
    completedLessonIds: [],
    completedOptionalLabIds: [],
    caseProgress: {},
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

function parseAssessmentProgress(value: unknown): StentAssessmentProgress | null {
  if (!value || typeof value !== 'object') return null
  const { attempts, lastScore, lastTotal, bestPercent, mastery } =
    value as Partial<StentAssessmentProgress>

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

  return { attempts, lastScore, lastTotal, bestPercent, mastery }
}

function uniqueStrings(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  if (value.some((item) => typeof item !== 'string')) return null
  return [...new Set(value)]
}

function parseCaseProgress(value: unknown): Record<string, StentCaseProgress> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const parsed: Record<string, StentCaseProgress> = {}

  for (const [caseId, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const candidate = raw as Partial<StentCaseProgress>
    const committedDecisionIds = uniqueStrings(candidate.committedDecisionIds)
    const revisedDecisionIds = uniqueStrings(candidate.revisedDecisionIds)
    const completedInteractionIds = uniqueStrings(candidate.completedInteractionIds)
    const observationCommitmentIds = uniqueStrings(candidate.observationCommitmentIds ?? [])
    const complicationSelectionIds = uniqueStrings(candidate.complicationSelectionIds ?? [])
    const outcomeStateIds =
      candidate.outcomeStateIds === undefined ? [] : uniqueStrings(candidate.outcomeStateIds)
    const legacyOutcomeStateId = (raw as { outcomeStateId?: unknown }).outcomeStateId
    if (
      candidate.caseId !== caseId ||
      !committedDecisionIds ||
      !revisedDecisionIds ||
      !completedInteractionIds ||
      !observationCommitmentIds ||
      !complicationSelectionIds ||
      !outcomeStateIds ||
      (legacyOutcomeStateId !== undefined &&
        legacyOutcomeStateId !== null &&
        typeof legacyOutcomeStateId !== 'string') ||
      typeof candidate.surveillancePlanCommitted !== 'boolean' ||
      typeof candidate.complete !== 'boolean'
    ) {
      return null
    }
    parsed[caseId] = {
      caseId,
      committedDecisionIds,
      revisedDecisionIds,
      completedInteractionIds,
      observationCommitmentIds,
      complicationSelectionIds,
      outcomeStateIds: [
        ...new Set([
          ...outcomeStateIds,
          ...(typeof legacyOutcomeStateId === 'string' ? [legacyOutcomeStateId] : []),
        ]),
      ],
      surveillancePlanCommitted: candidate.surveillancePlanCommitted,
      complete: candidate.complete,
    }
  }

  return parsed
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
    if (
      candidate.lastCaseId !== undefined &&
      candidate.lastCaseId !== null &&
      typeof candidate.lastCaseId !== 'string'
    ) {
      return null
    }
    if (!Array.isArray(candidate.completedLessonIds)) return null
    if (!Array.isArray(candidate.completedOptionalLabIds)) return null
    const caseProgress = parseCaseProgress(candidate.caseProgress)
    const assessment = parseAssessmentProgress(candidate.assessment)
    if (!caseProgress || !assessment) return null

    const completedLessonIds = [...new Set(candidate.completedLessonIds.filter(isStentLessonId))]
    const completedOptionalLabIds = [
      ...new Set(
        candidate.completedOptionalLabIds.filter((id): id is string => typeof id === 'string'),
      ),
    ]
    return {
      version: STENT_PROGRESS_VERSION,
      lastLessonId: candidate.lastLessonId,
      lastCaseId: typeof candidate.lastCaseId === 'string' ? candidate.lastCaseId : null,
      completedLessonIds,
      completedOptionalLabIds,
      caseProgress,
      assessment,
      ...(candidate.migratedFromV1 === true ? { migratedFromV1: true } : {}),
      ...(candidate.migratedFromV2 === true ? { migratedFromV2: true } : {}),
    }
  } catch {
    return null
  }
}

export function parsePreviousStentProgress(
  serialized: string | null | undefined,
): LegacyStentProgressStateV2 | null {
  if (!serialized) return null
  try {
    const parsed: unknown = JSON.parse(serialized)
    if (!parsed || typeof parsed !== 'object') return null
    const candidate = parsed as Partial<LegacyStentProgressStateV2>
    if (candidate.version !== 2 || !isStentLessonId(candidate.lastLessonId)) return null
    if (!Array.isArray(candidate.completedLessonIds)) return null
    if (!Array.isArray(candidate.completedOptionalLabIds)) return null
    const assessment = parseAssessmentProgress(candidate.assessment)
    if (!assessment) return null

    return {
      version: 2,
      lastLessonId: candidate.lastLessonId,
      completedLessonIds: [...new Set(candidate.completedLessonIds.filter(isStentLessonId))],
      completedOptionalLabIds: [
        ...new Set(
          candidate.completedOptionalLabIds.filter((id): id is string => typeof id === 'string'),
        ),
      ],
      assessment,
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
  return {
    ...createDefaultStentProgress(),
    lastLessonId: legacyLessonAliases[legacy.lastLessonId],
    completedOptionalLabIds: legacy.completedLessonIds.includes('force-lab')
      ? [ENGINEERING_DEEP_DIVE_ID]
      : [],
    migratedFromV1: true,
  }
}

export function migratePreviousStentProgress(
  previous: LegacyStentProgressStateV2,
): StentProgressState {
  return {
    ...createDefaultStentProgress(),
    lastLessonId: previous.lastLessonId,
    completedOptionalLabIds: [...previous.completedOptionalLabIds],
    ...(previous.migratedFromV1 === true ? { migratedFromV1: true } : {}),
    migratedFromV2: true,
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

    const previous = parsePreviousStentProgress(
      storage.getItem(PREVIOUS_STENT_PROGRESS_STORAGE_KEY),
    )
    if (previous) {
      const migrated = migratePreviousStentProgress(previous)
      storage.setItem(STENT_PROGRESS_STORAGE_KEY, JSON.stringify(migrated))
      return migrated
    }

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

function cloneCaseProgressMap(
  caseProgress: Record<string, StentCaseProgress>,
): Record<string, StentCaseProgress> {
  return Object.fromEntries(
    Object.entries(caseProgress).map(([caseId, entry]) => [
      caseId,
      {
        ...entry,
        committedDecisionIds: [...entry.committedDecisionIds],
        revisedDecisionIds: [...entry.revisedDecisionIds],
        completedInteractionIds: [...entry.completedInteractionIds],
        observationCommitmentIds: [...entry.observationCommitmentIds],
        complicationSelectionIds: [...entry.complicationSelectionIds],
        outcomeStateIds: [...entry.outcomeStateIds],
      },
    ]),
  )
}

function createCaseProgress(caseId: string): StentCaseProgress {
  return {
    caseId,
    committedDecisionIds: [],
    revisedDecisionIds: [],
    completedInteractionIds: [],
    observationCommitmentIds: [],
    complicationSelectionIds: [],
    outcomeStateIds: [],
    surveillancePlanCommitted: false,
    complete: false,
  }
}

function updateCaseProgress(
  progress: StentProgressState,
  caseId: string,
  update: (current: StentCaseProgress) => StentCaseProgress,
): StentProgressState {
  const caseProgress = cloneCaseProgressMap(progress.caseProgress)
  caseProgress[caseId] = update(caseProgress[caseId] ?? createCaseProgress(caseId))
  return {
    ...progress,
    completedLessonIds: [...progress.completedLessonIds],
    completedOptionalLabIds: [...progress.completedOptionalLabIds],
    caseProgress,
    assessment: { ...progress.assessment },
  }
}

export function recordCaseDecision(
  progress: StentProgressState,
  caseId: string,
  decisionId: string,
  revised: boolean,
): StentProgressState {
  return updateCaseProgress(progress, caseId, (current) => ({
    ...current,
    committedDecisionIds: current.committedDecisionIds.includes(decisionId)
      ? [...current.committedDecisionIds]
      : [...current.committedDecisionIds, decisionId],
    revisedDecisionIds:
      revised && !current.revisedDecisionIds.includes(decisionId)
        ? [...current.revisedDecisionIds, decisionId]
        : [...current.revisedDecisionIds],
  }))
}

export function markCaseInteractionCompleted(
  progress: StentProgressState,
  caseId: string,
  interactionId: string,
): StentProgressState {
  return updateCaseProgress(progress, caseId, (current) => ({
    ...current,
    completedInteractionIds: current.completedInteractionIds.includes(interactionId)
      ? [...current.completedInteractionIds]
      : [...current.completedInteractionIds, interactionId],
  }))
}

export function recordCaseObservationCommitment(
  progress: StentProgressState,
  caseId: string,
  observationId: string,
): StentProgressState {
  return updateCaseProgress(progress, caseId, (current) => ({
    ...current,
    observationCommitmentIds: current.observationCommitmentIds.includes(observationId)
      ? [...current.observationCommitmentIds]
      : [...current.observationCommitmentIds, observationId],
  }))
}

export function setCaseComplicationSelections(
  progress: StentProgressState,
  caseId: string,
  complicationSelectionIds: readonly string[],
): StentProgressState {
  return updateCaseProgress(progress, caseId, (current) => ({
    ...current,
    complicationSelectionIds: [...new Set(complicationSelectionIds)],
  }))
}

export function setCaseOutcomeState(
  progress: StentProgressState,
  caseId: string,
  outcomeStateId: string,
): StentProgressState {
  return updateCaseProgress(progress, caseId, (current) => ({
    ...current,
    outcomeStateIds: current.outcomeStateIds.includes(outcomeStateId)
      ? [...current.outcomeStateIds]
      : [...current.outcomeStateIds, outcomeStateId],
  }))
}

export function markCaseSurveillanceCommitted(
  progress: StentProgressState,
  caseId: string,
): StentProgressState {
  return updateCaseProgress(progress, caseId, (current) => ({
    ...current,
    surveillancePlanCommitted: true,
  }))
}

export function markCaseCompleted(
  progress: StentProgressState,
  caseId: string,
): StentProgressState {
  return updateCaseProgress(progress, caseId, (current) => ({ ...current, complete: true }))
}

export function isCaseCompleted(progress: StentProgressState, caseId: string): boolean {
  return progress.caseProgress[caseId]?.complete === true
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
    caseProgress: cloneCaseProgressMap(progress.caseProgress),
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
    caseProgress: cloneCaseProgressMap(progress.caseProgress),
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
    caseProgress: cloneCaseProgressMap(progress.caseProgress),
    assessment: { ...progress.assessment },
  }
}

export function setLastCase(
  progress: StentProgressState,
  caseId: string | null,
): StentProgressState {
  return {
    ...progress,
    lastCaseId: caseId,
    completedLessonIds: [...progress.completedLessonIds],
    completedOptionalLabIds: [...progress.completedOptionalLabIds],
    caseProgress: cloneCaseProgressMap(progress.caseProgress),
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
  const mastery = progress.assessment.mastery || score >= masteryThreshold
  const completedLessonIds = mastery
    ? progress.completedLessonIds.includes('assessment')
      ? [...progress.completedLessonIds]
      : [...progress.completedLessonIds, 'assessment' as const]
    : progress.completedLessonIds.filter((lessonId) => lessonId !== 'assessment')

  return {
    ...progress,
    lastLessonId: 'assessment',
    completedLessonIds,
    completedOptionalLabIds: [...progress.completedOptionalLabIds],
    caseProgress: cloneCaseProgressMap(progress.caseProgress),
    assessment: {
      attempts: progress.assessment.attempts + 1,
      lastScore: score,
      lastTotal: total,
      bestPercent,
      mastery,
    },
  }
}

export function isModuleComplete(progress: StentProgressState): boolean {
  return (
    progress.assessment.mastery &&
    STENT_LESSON_IDS.every((lessonId) => progress.completedLessonIds.includes(lessonId))
  )
}
