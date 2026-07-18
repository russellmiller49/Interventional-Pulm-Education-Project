import {
  BAXTER_CRRT_DEVICE_IDS,
  initialBaxterCrrtDeviceId,
  type BaxterCrrtDeviceId,
} from '../content/deviceProfiles'
import { isBaxterCrrtInstructionalToolId } from '../content/instructionalTools'
import {
  isBaxterCrrtLearnerLessonId,
  isBaxterCrrtLearnerProgressCaseId,
} from '../content/learnerRegistry'
import { isBaxterCrrtRapidDrillId } from '../content/rapidDrills'
import { CRRT_CONTENT_VERSION, CRRT_ENGINE_VERSION } from './initialState'
import { isCrrtMasteryCapstoneAvailable } from './outcomes'
import { crrtRoleLenses, crrtStationIds, type CrrtRoleLens, type CrrtStationId } from './types'

export const BAXTER_CRRT_PROGRESS_STORAGE_KEY = 'baxter-crrt-progress-v3'
export const BAXTER_CRRT_PROGRESS_VERSION = 3 as const
export const BAXTER_CRRT_ENGINE_VERSION = CRRT_ENGINE_VERSION
export const BAXTER_CRRT_CONTENT_VERSION = CRRT_CONTENT_VERSION

export const BAXTER_CRRT_PROGRESS_MAX_IDS = 256
export const BAXTER_CRRT_PROGRESS_MAX_RECORD_ENTRIES = 256
export const BAXTER_CRRT_PROGRESS_MAX_COUNTER = 10_000

const MAX_STABLE_ID_LENGTH = 128
const MAX_COMPOSITE_KEY_LENGTH = 256
const MAX_VERSION_ID_LENGTH = 64

export type BaxterCrrtRoleLens = CrrtRoleLens
export type BaxterCrrtProgressStation = CrrtStationId
export type BaxterCrrtProgressPathway = 'learn' | 'practice' | 'mastery'

export interface BaxterCrrtProgressV3 {
  readonly version: 3
  readonly lastDevice: BaxterCrrtDeviceId
  readonly lastRoleLens: BaxterCrrtRoleLens
  readonly completedLessonIds: readonly string[]
  readonly completedPracticeCaseIds: readonly string[]
  readonly completedMasteryCapstoneIds: readonly string[]
  readonly completedRapidDrillIds: readonly string[]
  readonly completedInstructionalToolIds: readonly string[]
  readonly attempts: Readonly<Record<string, number>>
  /** Best score from a non-critical attempt only; unsafe scores are never mixed in. */
  readonly bestSafeScores: Readonly<Record<string, number>>
  readonly criticalErrorAttempts: Readonly<Record<string, number>>
  readonly hintUse: Readonly<Record<string, number>>
  readonly lastStation: BaxterCrrtProgressStation
  readonly engineVersion: string
  readonly contentVersion: string
}

export interface BaxterCrrtProgressStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const validDeviceIds = new Set<BaxterCrrtDeviceId>(BAXTER_CRRT_DEVICE_IDS)

const validRoleLenses = new Set<BaxterCrrtRoleLens>(crrtRoleLenses)

const validStations = new Set<BaxterCrrtProgressStation>(crrtStationIds)
const validProgressPathways = new Set<BaxterCrrtProgressPathway>(['learn', 'practice', 'mastery'])

function isValidDeviceId(value: unknown): value is BaxterCrrtDeviceId {
  return BAXTER_CRRT_DEVICE_IDS.some((deviceId) => deviceId === value)
}

function isValidRoleLens(value: unknown): value is BaxterCrrtRoleLens {
  return value === 'prescriber' || value === 'operator' || value === 'integrated'
}

function isValidStation(value: unknown): value is BaxterCrrtProgressStation {
  return (
    value === 'orientation' ||
    value === 'define-goal' ||
    value === 'build-prescription' ||
    value === 'setup-start' ||
    value === 'monitor-dose-fluid' ||
    value === 'pressures-troubleshooting' ||
    value === 'anticoagulation-complications-liberation'
  )
}

const stableIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/
const versionIdPattern = /^[A-Za-z0-9][A-Za-z0-9._+:-]*$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isStableId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_STABLE_ID_LENGTH &&
    stableIdPattern.test(value)
  )
}

function isVersionId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_VERSION_ID_LENGTH &&
    versionIdPattern.test(value)
  )
}

function isCompositeKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_COMPOSITE_KEY_LENGTH &&
    stableIdPattern.test(value)
  )
}

function parseIdList(value: unknown, isAllowedId: (id: string) => boolean): string[] | null {
  if (!Array.isArray(value) || value.length > BAXTER_CRRT_PROGRESS_MAX_IDS) return null
  if (value.some((id) => !isStableId(id) || !isAllowedId(id))) return null
  return [...new Set(value as string[])].sort()
}

function isAllowedProgressIdentifier(pathway: BaxterCrrtProgressPathway, id: string): boolean {
  if (pathway === 'learn' || pathway === 'practice') {
    return isBaxterCrrtLearnerProgressCaseId(id)
  }
  return isCrrtMasteryCapstoneAvailable(id)
}

function isAllowedProgressCompositeKey(value: unknown): value is string {
  if (!isCompositeKey(value)) return false
  const [device, roleLens, pathway, id, ...remainder] = value.split(':')
  return (
    remainder.length === 0 &&
    isValidDeviceId(device) &&
    isValidRoleLens(roleLens) &&
    validProgressPathways.has(pathway as BaxterCrrtProgressPathway) &&
    isAllowedProgressIdentifier(pathway as BaxterCrrtProgressPathway, id)
  )
}

function parseNumberRecord(value: unknown, maximum: number): Record<string, number> | null {
  if (!isRecord(value)) return null
  const entries = Object.entries(value)
  if (entries.length > BAXTER_CRRT_PROGRESS_MAX_RECORD_ENTRIES) return null

  const parsed: Record<string, number> = {}
  for (const [id, raw] of entries.sort(([left], [right]) => left.localeCompare(right))) {
    if (!isAllowedProgressCompositeKey(id)) return null
    if (!Number.isSafeInteger(raw) || (raw as number) < 0 || (raw as number) > maximum) {
      return null
    }
    parsed[id] = raw as number
  }
  return parsed
}

function browserStorage(): BaxterCrrtProgressStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function createDefaultProgress(): BaxterCrrtProgressV3 {
  return {
    version: BAXTER_CRRT_PROGRESS_VERSION,
    lastDevice: initialBaxterCrrtDeviceId,
    lastRoleLens: 'integrated',
    completedLessonIds: [],
    completedPracticeCaseIds: [],
    completedMasteryCapstoneIds: [],
    completedRapidDrillIds: [],
    completedInstructionalToolIds: [],
    attempts: {},
    bestSafeScores: {},
    criticalErrorAttempts: {},
    hintUse: {},
    lastStation: 'orientation',
    engineVersion: BAXTER_CRRT_ENGINE_VERSION,
    contentVersion: BAXTER_CRRT_CONTENT_VERSION,
  }
}

/**
 * Projects unknown data onto the complete, non-PHI progress allowlist.
 * Unknown properties are intentionally discarded and invalid required fields fail closed.
 */
export function canonicalizeProgress(value: unknown): BaxterCrrtProgressV3 | null {
  if (!isRecord(value) || value.version !== BAXTER_CRRT_PROGRESS_VERSION) return null
  if (!isValidDeviceId(value.lastDevice)) return null
  if (!isValidRoleLens(value.lastRoleLens)) return null
  if (!isValidStation(value.lastStation)) return null
  if (!isVersionId(value.engineVersion) || !isVersionId(value.contentVersion)) return null
  if (
    value.engineVersion !== BAXTER_CRRT_ENGINE_VERSION ||
    value.contentVersion !== BAXTER_CRRT_CONTENT_VERSION
  ) {
    return null
  }

  const completedLessonIds = parseIdList(value.completedLessonIds, isBaxterCrrtLearnerLessonId)
  const completedPracticeCaseIds = parseIdList(
    value.completedPracticeCaseIds,
    isBaxterCrrtLearnerProgressCaseId,
  )
  const completedMasteryCapstoneIds = parseIdList(
    value.completedMasteryCapstoneIds,
    isCrrtMasteryCapstoneAvailable,
  )
  const completedRapidDrillIds = parseIdList(value.completedRapidDrillIds, isBaxterCrrtRapidDrillId)
  const completedInstructionalToolIds = parseIdList(
    value.completedInstructionalToolIds,
    isBaxterCrrtInstructionalToolId,
  )
  const attempts = parseNumberRecord(value.attempts, BAXTER_CRRT_PROGRESS_MAX_COUNTER)
  const bestSafeScores = parseNumberRecord(value.bestSafeScores, 100)
  const criticalErrorAttempts = parseNumberRecord(
    value.criticalErrorAttempts,
    BAXTER_CRRT_PROGRESS_MAX_COUNTER,
  )
  const hintUse = parseNumberRecord(value.hintUse, BAXTER_CRRT_PROGRESS_MAX_COUNTER)

  if (
    !completedLessonIds ||
    !completedPracticeCaseIds ||
    !completedMasteryCapstoneIds ||
    !completedRapidDrillIds ||
    !completedInstructionalToolIds ||
    !attempts ||
    !bestSafeScores ||
    !criticalErrorAttempts ||
    !hintUse
  ) {
    return null
  }

  const attemptKeys = new Set(Object.keys(attempts))
  if (
    [
      ...Object.keys(bestSafeScores),
      ...Object.keys(criticalErrorAttempts),
      ...Object.keys(hintUse),
    ].some((key) => !attemptKeys.has(key)) ||
    Object.entries(criticalErrorAttempts).some(([key, count]) => count > (attempts[key] ?? 0))
  ) {
    return null
  }

  return {
    version: BAXTER_CRRT_PROGRESS_VERSION,
    lastDevice: value.lastDevice,
    lastRoleLens: value.lastRoleLens,
    completedLessonIds,
    completedPracticeCaseIds,
    completedMasteryCapstoneIds,
    completedRapidDrillIds,
    completedInstructionalToolIds,
    attempts,
    bestSafeScores,
    criticalErrorAttempts,
    hintUse,
    lastStation: value.lastStation,
    engineVersion: value.engineVersion,
    contentVersion: value.contentVersion,
  }
}

export function parseProgress(serialized: string | null | undefined): BaxterCrrtProgressV3 | null {
  if (!serialized) return null
  try {
    return canonicalizeProgress(JSON.parse(serialized) as unknown)
  } catch {
    return null
  }
}

export function serializeProgress(value: unknown): string | null {
  const canonical = canonicalizeProgress(value)
  return canonical ? JSON.stringify(canonical) : null
}

export function progressAttemptKey(
  device: BaxterCrrtDeviceId,
  roleLens: BaxterCrrtRoleLens,
  pathway: BaxterCrrtProgressPathway,
  caseId: string,
): string {
  if (
    !validDeviceIds.has(device) ||
    !validRoleLenses.has(roleLens) ||
    !validProgressPathways.has(pathway) ||
    !isStableId(caseId) ||
    !isAllowedProgressIdentifier(pathway, caseId)
  ) {
    throw new Error('Progress attempt keys require valid device, role, pathway, and case IDs.')
  }
  const key = `${device}:${roleLens}:${pathway}:${caseId}`
  if (!isCompositeKey(key)) throw new Error('Progress attempt key exceeds the storage boundary.')
  return key
}

export function setProgressContext(
  progress: BaxterCrrtProgressV3,
  context: {
    readonly device: BaxterCrrtDeviceId
    readonly roleLens: BaxterCrrtRoleLens
    readonly station: BaxterCrrtProgressStation
  },
): BaxterCrrtProgressV3 {
  const canonical = canonicalizeProgress(progress)
  if (!canonical) throw new Error('Progress must use the current canonical version.')
  if (
    !validDeviceIds.has(context.device) ||
    !validRoleLenses.has(context.roleLens) ||
    !validStations.has(context.station)
  ) {
    throw new Error('Progress context contains an unsupported identifier.')
  }
  return {
    ...canonical,
    lastDevice: context.device,
    lastRoleLens: context.roleLens,
    lastStation: context.station,
  }
}

export function recordLessonCompletion(
  progress: BaxterCrrtProgressV3,
  lessonId: string,
): BaxterCrrtProgressV3 {
  const canonical = canonicalizeProgress(progress)
  if (!canonical) throw new Error('Progress must use the current canonical version.')
  if (!isStableId(lessonId) || !isBaxterCrrtLearnerLessonId(lessonId)) {
    throw new Error('Lesson progress is available only for a registered learner lesson.')
  }
  const completedLessonIds = [...new Set([...canonical.completedLessonIds, lessonId])].sort()
  if (completedLessonIds.length > BAXTER_CRRT_PROGRESS_MAX_IDS) {
    throw new Error('Completed lesson limit exceeded.')
  }
  return { ...canonical, completedLessonIds }
}

export function recordRapidDrillCompletion(
  progress: BaxterCrrtProgressV3,
  drillId: string,
): BaxterCrrtProgressV3 {
  const canonical = canonicalizeProgress(progress)
  if (!canonical) throw new Error('Progress must use the current canonical version.')
  if (!isBaxterCrrtRapidDrillId(drillId)) throw new Error('Unknown CRRT rapid drill.')
  return {
    ...canonical,
    completedRapidDrillIds: [...new Set([...canonical.completedRapidDrillIds, drillId])].sort(),
  }
}

export function recordInstructionalToolCompletion(
  progress: BaxterCrrtProgressV3,
  toolId: string,
): BaxterCrrtProgressV3 {
  const canonical = canonicalizeProgress(progress)
  if (!canonical) throw new Error('Progress must use the current canonical version.')
  if (!isBaxterCrrtInstructionalToolId(toolId)) {
    throw new Error('Unknown CRRT instructional tool.')
  }
  return {
    ...canonical,
    completedInstructionalToolIds: [
      ...new Set([...canonical.completedInstructionalToolIds, toolId]),
    ].sort(),
  }
}

export function recordCaseResult(
  progress: BaxterCrrtProgressV3,
  result: {
    readonly caseId: string
    readonly device: BaxterCrrtDeviceId
    readonly roleLens: BaxterCrrtRoleLens
    readonly pathway: 'practice' | 'mastery'
    readonly score: number
    readonly criticalError: boolean
    readonly hintCount: number
    readonly reassessmentCompleted: boolean
    readonly masteryCompleted: boolean
  },
): BaxterCrrtProgressV3 {
  const canonical = canonicalizeProgress(progress)
  if (!canonical) throw new Error('Progress must use the current canonical version.')
  if (!Number.isFinite(result.score)) throw new RangeError('Score must be finite.')
  if (typeof result.criticalError !== 'boolean') {
    throw new TypeError('Critical-error status must be boolean.')
  }
  if (
    typeof result.reassessmentCompleted !== 'boolean' ||
    typeof result.masteryCompleted !== 'boolean'
  ) {
    throw new TypeError('Reassessment and Mastery completion statuses must be boolean.')
  }
  if (!Number.isSafeInteger(result.hintCount) || result.hintCount < 0) {
    throw new RangeError('Hint count must be a nonnegative integer.')
  }
  if (result.pathway === 'practice' && result.masteryCompleted) {
    throw new Error('Practice results cannot complete Mastery.')
  }
  if (result.pathway === 'practice' && !isBaxterCrrtLearnerProgressCaseId(result.caseId)) {
    throw new Error('Practice progress is available only for a registered learner runtime case.')
  }
  if (result.pathway === 'mastery' && !isCrrtMasteryCapstoneAvailable(result.caseId)) {
    throw new Error('CRRT Mastery progress is available only for the registered v1 capstone.')
  }
  const score = Math.round(Math.min(100, Math.max(0, result.score)))
  const meetsMasteryCriteria =
    result.pathway === 'mastery' &&
    score >= 80 &&
    !result.criticalError &&
    result.hintCount === 0 &&
    result.reassessmentCompleted
  if (result.masteryCompleted && !meetsMasteryCriteria) {
    throw new Error('Mastery completion does not satisfy the fail-closed criteria.')
  }

  const key = progressAttemptKey(result.device, result.roleLens, result.pathway, result.caseId)
  const previousAttemptCount = canonical.attempts[key] ?? 0
  const previousHintCount = canonical.hintUse[key] ?? 0
  const previousCriticalErrorAttempts = canonical.criticalErrorAttempts[key] ?? 0
  if (
    previousAttemptCount >= BAXTER_CRRT_PROGRESS_MAX_COUNTER ||
    previousHintCount + result.hintCount > BAXTER_CRRT_PROGRESS_MAX_COUNTER ||
    previousCriticalErrorAttempts + (result.criticalError ? 1 : 0) >
      BAXTER_CRRT_PROGRESS_MAX_COUNTER
  ) {
    throw new Error('Progress counter limit exceeded.')
  }
  const completedPracticeCaseIds =
    result.pathway === 'practice'
      ? [...new Set([...canonical.completedPracticeCaseIds, result.caseId])].sort()
      : canonical.completedPracticeCaseIds
  const completedMasteryCapstoneIds = result.masteryCompleted
    ? [...new Set([...canonical.completedMasteryCapstoneIds, result.caseId])].sort()
    : canonical.completedMasteryCapstoneIds
  if (
    completedPracticeCaseIds.length > BAXTER_CRRT_PROGRESS_MAX_IDS ||
    completedMasteryCapstoneIds.length > BAXTER_CRRT_PROGRESS_MAX_IDS
  ) {
    throw new Error('Completed progress identifier limit exceeded.')
  }

  const updated: BaxterCrrtProgressV3 = {
    ...canonical,
    lastDevice: result.device,
    lastRoleLens: result.roleLens,
    completedPracticeCaseIds,
    completedMasteryCapstoneIds,
    attempts: { ...canonical.attempts, [key]: previousAttemptCount + 1 },
    bestSafeScores: result.criticalError
      ? canonical.bestSafeScores
      : {
          ...canonical.bestSafeScores,
          [key]: Math.max(canonical.bestSafeScores[key] ?? 0, score),
        },
    criticalErrorAttempts: {
      ...canonical.criticalErrorAttempts,
      [key]: previousCriticalErrorAttempts + (result.criticalError ? 1 : 0),
    },
    hintUse: { ...canonical.hintUse, [key]: previousHintCount + result.hintCount },
  }
  const checked = canonicalizeProgress(updated)
  if (!checked) throw new Error('Progress result exceeds the canonical storage boundary.')
  return checked
}

export function readProgress(
  storage: BaxterCrrtProgressStorage | null = browserStorage(),
): BaxterCrrtProgressV3 {
  if (!storage) return createDefaultProgress()
  try {
    return (
      parseProgress(storage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)) ?? createDefaultProgress()
    )
  } catch {
    return createDefaultProgress()
  }
}

export function writeProgress(
  progress: BaxterCrrtProgressV3,
  storage: BaxterCrrtProgressStorage | null = browserStorage(),
  sessionMode: 'learner' | 'review-preview' = 'learner',
): boolean {
  if (sessionMode === 'review-preview') return false
  const serialized = serializeProgress(progress)
  if (!storage || !serialized) return false
  try {
    storage.setItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY, serialized)
    return true
  } catch {
    return false
  }
}
