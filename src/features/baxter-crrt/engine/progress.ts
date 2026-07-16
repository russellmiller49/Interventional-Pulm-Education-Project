import { initialBaxterCrrtDeviceId, type BaxterCrrtDeviceId } from '../content/deviceProfiles'
import { CRRT_CONTENT_VERSION, CRRT_ENGINE_VERSION } from './initialState'
import { crrtRoleLenses, crrtStationIds, type CrrtRoleLens, type CrrtStationId } from './types'

export const BAXTER_CRRT_PROGRESS_STORAGE_KEY = 'baxter-crrt-progress-v1'
export const BAXTER_CRRT_PROGRESS_VERSION = 1 as const
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

export interface BaxterCrrtProgressV1 {
  readonly version: 1
  readonly lastDevice: BaxterCrrtDeviceId
  readonly lastRoleLens: BaxterCrrtRoleLens
  readonly completedLessonIds: readonly string[]
  readonly completedCaseIds: readonly string[]
  readonly attempts: Readonly<Record<string, number>>
  readonly bestScores: Readonly<Record<string, number>>
  readonly criticalErrorStatus: Readonly<Record<string, boolean>>
  readonly hintUse: Readonly<Record<string, number>>
  readonly lastStation: BaxterCrrtProgressStation
  readonly engineVersion: string
  readonly contentVersion: string
}

export interface BaxterCrrtProgressStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const validDeviceIds = new Set<BaxterCrrtDeviceId>([
  'prismax-aw8035-2xx',
  'prismaflex-g5036003-6xx',
])

const validRoleLenses = new Set<BaxterCrrtRoleLens>(crrtRoleLenses)

const validStations = new Set<BaxterCrrtProgressStation>(crrtStationIds)

function isValidDeviceId(value: unknown): value is BaxterCrrtDeviceId {
  return value === 'prismax-aw8035-2xx' || value === 'prismaflex-g5036003-6xx'
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

const stableIdPattern = /^[a-z0-9][a-z0-9._:-]*$/
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

function parseIdList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > BAXTER_CRRT_PROGRESS_MAX_IDS) return null
  if (value.some((id) => !isStableId(id))) return null
  return [...new Set(value as string[])].sort()
}

function parseNumberRecord(value: unknown, maximum: number): Record<string, number> | null {
  if (!isRecord(value)) return null
  const entries = Object.entries(value)
  if (entries.length > BAXTER_CRRT_PROGRESS_MAX_RECORD_ENTRIES) return null

  const parsed: Record<string, number> = {}
  for (const [id, raw] of entries.sort(([left], [right]) => left.localeCompare(right))) {
    if (!isCompositeKey(id)) return null
    if (!Number.isSafeInteger(raw) || (raw as number) < 0 || (raw as number) > maximum) {
      return null
    }
    parsed[id] = raw as number
  }
  return parsed
}

function parseBooleanRecord(value: unknown): Record<string, boolean> | null {
  if (!isRecord(value)) return null
  const entries = Object.entries(value)
  if (entries.length > BAXTER_CRRT_PROGRESS_MAX_RECORD_ENTRIES) return null

  const parsed: Record<string, boolean> = {}
  for (const [id, raw] of entries.sort(([left], [right]) => left.localeCompare(right))) {
    if (!isCompositeKey(id) || typeof raw !== 'boolean') return null
    parsed[id] = raw
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

export function createDefaultProgress(): BaxterCrrtProgressV1 {
  return {
    version: BAXTER_CRRT_PROGRESS_VERSION,
    lastDevice: initialBaxterCrrtDeviceId,
    lastRoleLens: 'integrated',
    completedLessonIds: [],
    completedCaseIds: [],
    attempts: {},
    bestScores: {},
    criticalErrorStatus: {},
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
export function canonicalizeProgress(value: unknown): BaxterCrrtProgressV1 | null {
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

  const completedLessonIds = parseIdList(value.completedLessonIds)
  const completedCaseIds = parseIdList(value.completedCaseIds)
  const attempts = parseNumberRecord(value.attempts, BAXTER_CRRT_PROGRESS_MAX_COUNTER)
  const bestScores = parseNumberRecord(value.bestScores, 100)
  const criticalErrorStatus = parseBooleanRecord(value.criticalErrorStatus)
  const hintUse = parseNumberRecord(value.hintUse, BAXTER_CRRT_PROGRESS_MAX_COUNTER)

  if (
    !completedLessonIds ||
    !completedCaseIds ||
    !attempts ||
    !bestScores ||
    !criticalErrorStatus ||
    !hintUse
  ) {
    return null
  }

  return {
    version: BAXTER_CRRT_PROGRESS_VERSION,
    lastDevice: value.lastDevice,
    lastRoleLens: value.lastRoleLens,
    completedLessonIds,
    completedCaseIds,
    attempts,
    bestScores,
    criticalErrorStatus,
    hintUse,
    lastStation: value.lastStation,
    engineVersion: value.engineVersion,
    contentVersion: value.contentVersion,
  }
}

export function parseProgress(serialized: string | null | undefined): BaxterCrrtProgressV1 | null {
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
  caseId: string,
): string {
  if (!validDeviceIds.has(device) || !validRoleLenses.has(roleLens) || !isStableId(caseId)) {
    throw new Error('Progress attempt keys require valid device, role, and case IDs.')
  }
  const key = `${device}:${roleLens}:${caseId}`
  if (!isCompositeKey(key)) throw new Error('Progress attempt key exceeds the storage boundary.')
  return key
}

export function setProgressContext(
  progress: BaxterCrrtProgressV1,
  context: {
    readonly device: BaxterCrrtDeviceId
    readonly roleLens: BaxterCrrtRoleLens
    readonly station: BaxterCrrtProgressStation
  },
): BaxterCrrtProgressV1 {
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
  progress: BaxterCrrtProgressV1,
  lessonId: string,
): BaxterCrrtProgressV1 {
  const canonical = canonicalizeProgress(progress)
  if (!canonical) throw new Error('Progress must use the current canonical version.')
  if (!isStableId(lessonId)) throw new Error('Lesson ID is invalid.')
  const completedLessonIds = [...new Set([...canonical.completedLessonIds, lessonId])].sort()
  if (completedLessonIds.length > BAXTER_CRRT_PROGRESS_MAX_IDS) {
    throw new Error('Completed lesson limit exceeded.')
  }
  return { ...canonical, completedLessonIds }
}

export function recordCaseResult(
  progress: BaxterCrrtProgressV1,
  result: {
    readonly caseId: string
    readonly device: BaxterCrrtDeviceId
    readonly roleLens: BaxterCrrtRoleLens
    readonly score: number
    readonly criticalError: boolean
    readonly hintCount: number
  },
): BaxterCrrtProgressV1 {
  const canonical = canonicalizeProgress(progress)
  if (!canonical) throw new Error('Progress must use the current canonical version.')
  if (!Number.isFinite(result.score)) throw new RangeError('Score must be finite.')
  if (typeof result.criticalError !== 'boolean') {
    throw new TypeError('Critical-error status must be boolean.')
  }
  if (!Number.isSafeInteger(result.hintCount) || result.hintCount < 0) {
    throw new RangeError('Hint count must be a nonnegative integer.')
  }
  const key = progressAttemptKey(result.device, result.roleLens, result.caseId)
  const score = Math.round(Math.min(100, Math.max(0, result.score)))
  const previousAttemptCount = canonical.attempts[key] ?? 0
  const previousHintCount = canonical.hintUse[key] ?? 0
  if (
    previousAttemptCount >= BAXTER_CRRT_PROGRESS_MAX_COUNTER ||
    previousHintCount + result.hintCount > BAXTER_CRRT_PROGRESS_MAX_COUNTER
  ) {
    throw new Error('Progress counter limit exceeded.')
  }
  const previouslySafe =
    (canonical.bestScores[key] ?? 0) >= 80 && canonical.criticalErrorStatus[key] === false
  const safelyMasteredNow = score >= 80 && !result.criticalError
  const completedCaseIds = [...new Set([...canonical.completedCaseIds, result.caseId])].sort()
  if (completedCaseIds.length > BAXTER_CRRT_PROGRESS_MAX_IDS) {
    throw new Error('Completed case limit exceeded.')
  }

  const updated: BaxterCrrtProgressV1 = {
    ...canonical,
    lastDevice: result.device,
    lastRoleLens: result.roleLens,
    completedCaseIds,
    attempts: { ...canonical.attempts, [key]: previousAttemptCount + 1 },
    bestScores: {
      ...canonical.bestScores,
      [key]: Math.max(canonical.bestScores[key] ?? 0, score),
    },
    criticalErrorStatus: {
      ...canonical.criticalErrorStatus,
      [key]: safelyMasteredNow ? false : previouslySafe ? false : result.criticalError,
    },
    hintUse: { ...canonical.hintUse, [key]: previousHintCount + result.hintCount },
  }
  const checked = canonicalizeProgress(updated)
  if (!checked) throw new Error('Progress result exceeds the canonical storage boundary.')
  return checked
}

export function readProgress(
  storage: BaxterCrrtProgressStorage | null = browserStorage(),
): BaxterCrrtProgressV1 {
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
  progress: BaxterCrrtProgressV1,
  storage: BaxterCrrtProgressStorage | null = browserStorage(),
): boolean {
  const serialized = serializeProgress(progress)
  if (!storage || !serialized) return false
  try {
    storage.setItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY, serialized)
    return true
  } catch {
    return false
  }
}
