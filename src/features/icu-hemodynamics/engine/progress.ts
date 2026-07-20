import type { HemodynamicScoreBreakdown, HemodynamicWorkspace } from './types'

export const ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY = 'icu-hemodynamics-progress-v2'
export const ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY = 'icu-hemodynamics-progress-v1'
export const ICU_HEMODYNAMICS_PROGRESS_VERSION = 2 as const

export interface IcuHemodynamicsProgressV2 {
  version: 2
  lastStation: string
  lastWorkspace: HemodynamicWorkspace
  attempts: Readonly<Record<string, number>>
  completedCaseIds: readonly string[]
  bestScores: Readonly<Record<string, number>>
  masteredCaseIds: readonly string[]
}

interface IcuHemodynamicsProgressV1 {
  version: 1
  lastCaseId: string
  attempts: Readonly<Record<string, number>>
  bestScores: Readonly<Record<string, number>>
}

export function createDefaultIcuHemodynamicsProgress(): IcuHemodynamicsProgressV2 {
  return {
    version: ICU_HEMODYNAMICS_PROGRESS_VERSION,
    lastStation: 'HD-01',
    lastWorkspace: 'pac-skills',
    attempts: {},
    completedCaseIds: [],
    bestScores: {},
    masteredCaseIds: [],
  }
}

function numericRecord(value: unknown, maximum?: number): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const parsed: Record<string, number> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 0) return null
    if (maximum !== undefined && item > maximum) return null
    parsed[key] = item
  }
  return parsed
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null
  return [...new Set(value)]
}

export function parseIcuHemodynamicsProgress(
  serialized: string | null | undefined,
): IcuHemodynamicsProgressV2 | null {
  if (!serialized) return null
  try {
    const raw: unknown = JSON.parse(serialized)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const candidate = raw as Partial<IcuHemodynamicsProgressV2>
    if (
      candidate.version !== ICU_HEMODYNAMICS_PROGRESS_VERSION ||
      typeof candidate.lastStation !== 'string' ||
      (candidate.lastWorkspace !== 'pac-skills' && candidate.lastWorkspace !== 'cases')
    ) {
      return null
    }
    const attempts = numericRecord(candidate.attempts)
    const completedCaseIds = stringArray(candidate.completedCaseIds)
    const bestScores = numericRecord(candidate.bestScores, 100)
    const masteredCaseIds = stringArray(candidate.masteredCaseIds)
    if (!attempts || !completedCaseIds || !bestScores || !masteredCaseIds) return null
    return {
      version: ICU_HEMODYNAMICS_PROGRESS_VERSION,
      lastStation: candidate.lastStation,
      lastWorkspace: candidate.lastWorkspace,
      attempts,
      completedCaseIds,
      bestScores,
      masteredCaseIds,
    }
  } catch {
    return null
  }
}

export function migrateIcuHemodynamicsProgressV1(
  serialized: string | null | undefined,
): IcuHemodynamicsProgressV2 | null {
  if (!serialized) return null
  try {
    const raw = JSON.parse(serialized) as Partial<IcuHemodynamicsProgressV1>
    if (raw.version !== 1 || typeof raw.lastCaseId !== 'string') return null
    const attempts = numericRecord(raw.attempts)
    const bestScores = numericRecord(raw.bestScores, 100)
    if (!attempts || !bestScores) return null
    const completedCaseIds = Object.keys(attempts).filter((id) => attempts[id] > 0)
    return {
      version: ICU_HEMODYNAMICS_PROGRESS_VERSION,
      lastStation: raw.lastCaseId,
      lastWorkspace: 'cases',
      attempts,
      completedCaseIds,
      bestScores,
      masteredCaseIds: Object.keys(bestScores).filter((id) => bestScores[id] >= 80),
    }
  } catch {
    return null
  }
}

export function readIcuHemodynamicsProgress(): IcuHemodynamicsProgressV2 {
  if (typeof window === 'undefined') return createDefaultIcuHemodynamicsProgress()
  try {
    const current = parseIcuHemodynamicsProgress(
      window.localStorage.getItem(ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY),
    )
    if (current) return current
    const migrated = migrateIcuHemodynamicsProgressV1(
      window.localStorage.getItem(ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY),
    )
    if (!migrated) return createDefaultIcuHemodynamicsProgress()
    window.localStorage.setItem(ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY, JSON.stringify(migrated))
    return migrated
  } catch {
    return createDefaultIcuHemodynamicsProgress()
  }
}

export function writeIcuHemodynamicsProgress(progress: IcuHemodynamicsProgressV2): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Optional browser progress must never interrupt the lab.
  }
}

export function updateIcuHemodynamicsLocation(
  progress: IcuHemodynamicsProgressV2,
  lastStation: string,
  lastWorkspace: HemodynamicWorkspace,
): IcuHemodynamicsProgressV2 {
  return { ...progress, lastStation, lastWorkspace }
}

export function recordIcuHemodynamicsResult(
  progress: IcuHemodynamicsProgressV2,
  result: { caseId: string; score: HemodynamicScoreBreakdown; criticalErrorCount: number },
): IcuHemodynamicsProgressV2 {
  const score = Math.round(Math.min(100, Math.max(0, result.score.total)))
  const mastered = score >= 80 && result.criticalErrorCount === 0
  return {
    ...progress,
    attempts: {
      ...progress.attempts,
      [result.caseId]: (progress.attempts[result.caseId] ?? 0) + 1,
    },
    completedCaseIds: [...new Set([...progress.completedCaseIds, result.caseId])],
    bestScores: {
      ...progress.bestScores,
      [result.caseId]: Math.max(progress.bestScores[result.caseId] ?? 0, score),
    },
    masteredCaseIds: mastered
      ? [...new Set([...progress.masteredCaseIds, result.caseId])]
      : progress.masteredCaseIds,
  }
}

export function hasIcuHemodynamicsMastery(
  progress: IcuHemodynamicsProgressV2,
  caseId: string,
): boolean {
  return progress.masteredCaseIds.includes(caseId) && (progress.bestScores[caseId] ?? 0) >= 80
}
