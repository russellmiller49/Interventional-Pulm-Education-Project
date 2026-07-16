import type { CaseOutcome, StationId } from './types'

export const HAMILTON_C6_PROGRESS_STORAGE_KEY = 'hamilton-c6-ventilation-progress-v1'
export const HAMILTON_C6_PROGRESS_VERSION = 1 as const

export interface HamiltonC6ProgressV1 {
  version: 1
  lastStation: StationId
  completedCases: readonly string[]
  attempts: Readonly<Record<string, number>>
  bestScores: Readonly<Record<string, number>>
  criticalErrorStatus: Readonly<Record<string, boolean>>
}

const stationIds: readonly StationId[] = [
  'lung-protection-demand',
  'effort-triggering',
  'obstructive-mechanics',
  'pressure-support-timing',
  'deterioration-whole-patient',
]

export function createDefaultProgress(): HamiltonC6ProgressV1 {
  return {
    version: HAMILTON_C6_PROGRESS_VERSION,
    lastStation: 'lung-protection-demand',
    completedCases: [],
    attempts: {},
    bestScores: {},
    criticalErrorStatus: {},
  }
}

function nonnegativeIntegerRecord(value: unknown, maximum?: number): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const parsed: Record<string, number> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 0) return null
    if (maximum !== undefined && item > maximum) return null
    parsed[key] = item
  }
  return parsed
}

function booleanRecord(value: unknown): Record<string, boolean> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const parsed: Record<string, boolean> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'boolean') return null
    parsed[key] = item
  }
  return parsed
}

export function parseProgress(serialized: string | null | undefined): HamiltonC6ProgressV1 | null {
  if (!serialized) return null
  try {
    const raw: unknown = JSON.parse(serialized)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const candidate = raw as Partial<HamiltonC6ProgressV1>
    if (candidate.version !== HAMILTON_C6_PROGRESS_VERSION) return null
    if (!stationIds.includes(candidate.lastStation as StationId)) return null
    if (!Array.isArray(candidate.completedCases)) return null
    if (candidate.completedCases.some((caseId) => typeof caseId !== 'string')) return null
    const attempts = nonnegativeIntegerRecord(candidate.attempts)
    const bestScores = nonnegativeIntegerRecord(candidate.bestScores, 100)
    const criticalErrorStatus = booleanRecord(candidate.criticalErrorStatus)
    if (!attempts || !bestScores || !criticalErrorStatus) return null
    return {
      version: HAMILTON_C6_PROGRESS_VERSION,
      lastStation: candidate.lastStation as StationId,
      completedCases: [...new Set(candidate.completedCases)],
      attempts,
      bestScores,
      criticalErrorStatus,
    }
  } catch {
    return null
  }
}

export function readProgress(): HamiltonC6ProgressV1 {
  if (typeof window === 'undefined') return createDefaultProgress()
  try {
    return (
      parseProgress(window.localStorage.getItem(HAMILTON_C6_PROGRESS_STORAGE_KEY)) ??
      createDefaultProgress()
    )
  } catch {
    return createDefaultProgress()
  }
}

export function writeProgress(progress: HamiltonC6ProgressV1): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(HAMILTON_C6_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Optional progress must never interrupt the simulator.
  }
}

export function setLastStation(
  progress: HamiltonC6ProgressV1,
  lastStation: StationId,
): HamiltonC6ProgressV1 {
  return { ...progress, lastStation }
}

export function recordCaseResult(
  progress: HamiltonC6ProgressV1,
  result: { caseId: string; outcome: CaseOutcome },
): HamiltonC6ProgressV1 {
  const score = Math.round(Math.max(0, Math.min(100, result.outcome.score)))
  const previouslySafe =
    (progress.bestScores[result.caseId] ?? 0) >= 80 &&
    progress.criticalErrorStatus[result.caseId] === false
  const safelyMastered = score >= 80 && result.outcome.criticalErrors.length === 0
  return {
    ...progress,
    completedCases: [...new Set([...progress.completedCases, result.caseId])],
    attempts: {
      ...progress.attempts,
      [result.caseId]: (progress.attempts[result.caseId] ?? 0) + 1,
    },
    bestScores: {
      ...progress.bestScores,
      [result.caseId]: Math.max(progress.bestScores[result.caseId] ?? 0, score),
    },
    criticalErrorStatus: {
      ...progress.criticalErrorStatus,
      [result.caseId]: safelyMastered
        ? false
        : previouslySafe
          ? false
          : result.outcome.criticalErrors.length > 0,
    },
  }
}

export function hasCaseMastery(progress: HamiltonC6ProgressV1, caseId: string): boolean {
  return (progress.bestScores[caseId] ?? 0) >= 80 && progress.criticalErrorStatus[caseId] === false
}
