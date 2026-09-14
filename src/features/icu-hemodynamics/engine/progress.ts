import type { HemodynamicWorkspace } from './types'

/**
 * The legacy case ledger — read-only.
 *
 * Before HD-01 every finished case wrote attempts, a best score and a mastery flag here, and reading
 * a version-one record silently rewrote it as version two. The module is self-paced now (September
 * 2026 owner decision): nothing in it writes this key any more, and nothing in it reads it either.
 * The parsers stay because the shared critical-care progress adapter still classifies what an older
 * session left on a device; whatever is stored is left byte-for-byte as it was. What a learner opens
 * now lives in `selfPacedProgress.ts`.
 */
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

/**
 * How a version-one record reads as version two — in memory only. The result is never written back;
 * a caller that needs the migrated view asks for it each time.
 */
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
