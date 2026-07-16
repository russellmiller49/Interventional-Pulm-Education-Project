import {
  ventilatorDeviceIds,
  type CaseOutcome,
  type StationId,
  type VentilatorDeviceId,
} from './types'

export const MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY = 'mechanical-ventilation-progress-v2'
export const LEGACY_HAMILTON_C6_PROGRESS_STORAGE_KEY = 'hamilton-c6-ventilation-progress-v1'
export const MECHANICAL_VENTILATION_PROGRESS_VERSION = 2 as const

export interface MechanicalVentilationProgressV2 {
  version: 2
  lastStation: StationId
  lastDeviceId: VentilatorDeviceId
  completedCases: readonly string[]
  attemptsByDeviceCase: Readonly<Record<string, number>>
  bestScores: Readonly<Record<string, number>>
  criticalErrorStatus: Readonly<Record<string, boolean>>
}

interface LegacyHamiltonC6ProgressV1 {
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

export function deviceCaseAttemptKey(deviceId: VentilatorDeviceId, caseId: string): string {
  return `${deviceId}:${caseId}`
}

export function createDefaultProgress(): MechanicalVentilationProgressV2 {
  return {
    version: MECHANICAL_VENTILATION_PROGRESS_VERSION,
    lastStation: 'lung-protection-demand',
    lastDeviceId: 'hamilton-c6',
    completedCases: [],
    attemptsByDeviceCase: {},
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

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null
  return [...new Set(value)]
}

function validStation(value: unknown): value is StationId {
  return typeof value === 'string' && stationIds.includes(value as StationId)
}

function validDevice(value: unknown): value is VentilatorDeviceId {
  return typeof value === 'string' && ventilatorDeviceIds.includes(value as VentilatorDeviceId)
}

export function parseProgress(
  serialized: string | null | undefined,
): MechanicalVentilationProgressV2 | null {
  if (!serialized) return null
  try {
    const raw: unknown = JSON.parse(serialized)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const candidate = raw as Partial<MechanicalVentilationProgressV2>
    if (candidate.version !== MECHANICAL_VENTILATION_PROGRESS_VERSION) return null
    if (!validStation(candidate.lastStation) || !validDevice(candidate.lastDeviceId)) return null
    const completedCases = stringArray(candidate.completedCases)
    const attemptsByDeviceCase = nonnegativeIntegerRecord(candidate.attemptsByDeviceCase)
    const bestScores = nonnegativeIntegerRecord(candidate.bestScores, 100)
    const criticalErrorStatus = booleanRecord(candidate.criticalErrorStatus)
    if (!completedCases || !attemptsByDeviceCase || !bestScores || !criticalErrorStatus) {
      return null
    }
    return {
      version: MECHANICAL_VENTILATION_PROGRESS_VERSION,
      lastStation: candidate.lastStation,
      lastDeviceId: candidate.lastDeviceId,
      completedCases,
      attemptsByDeviceCase,
      bestScores,
      criticalErrorStatus,
    }
  } catch {
    return null
  }
}

export function parseLegacyProgress(
  serialized: string | null | undefined,
): LegacyHamiltonC6ProgressV1 | null {
  if (!serialized) return null
  try {
    const raw: unknown = JSON.parse(serialized)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const candidate = raw as Partial<LegacyHamiltonC6ProgressV1>
    if (candidate.version !== 1 || !validStation(candidate.lastStation)) return null
    const completedCases = stringArray(candidate.completedCases)
    const attempts = nonnegativeIntegerRecord(candidate.attempts)
    const bestScores = nonnegativeIntegerRecord(candidate.bestScores, 100)
    const criticalErrorStatus = booleanRecord(candidate.criticalErrorStatus)
    if (!completedCases || !attempts || !bestScores || !criticalErrorStatus) return null
    return {
      version: 1,
      lastStation: candidate.lastStation,
      completedCases,
      attempts,
      bestScores,
      criticalErrorStatus,
    }
  } catch {
    return null
  }
}

export function migrateLegacyProgress(
  legacy: LegacyHamiltonC6ProgressV1,
): MechanicalVentilationProgressV2 {
  return {
    version: MECHANICAL_VENTILATION_PROGRESS_VERSION,
    lastStation: legacy.lastStation,
    lastDeviceId: 'hamilton-c6',
    completedCases: legacy.completedCases,
    attemptsByDeviceCase: Object.fromEntries(
      Object.entries(legacy.attempts).map(([caseId, attempts]) => [
        deviceCaseAttemptKey('hamilton-c6', caseId),
        attempts,
      ]),
    ),
    bestScores: legacy.bestScores,
    criticalErrorStatus: legacy.criticalErrorStatus,
  }
}

export function readProgress(): MechanicalVentilationProgressV2 {
  if (typeof window === 'undefined') return createDefaultProgress()
  try {
    const current = parseProgress(
      window.localStorage.getItem(MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY),
    )
    if (current) return current
    const legacy = parseLegacyProgress(
      window.localStorage.getItem(LEGACY_HAMILTON_C6_PROGRESS_STORAGE_KEY),
    )
    if (!legacy) return createDefaultProgress()
    const migrated = migrateLegacyProgress(legacy)
    window.localStorage.setItem(
      MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY,
      JSON.stringify(migrated),
    )
    return migrated
  } catch {
    return createDefaultProgress()
  }
}

export function writeProgress(progress: MechanicalVentilationProgressV2): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY,
      JSON.stringify(progress),
    )
  } catch {
    // Optional progress must never interrupt the simulator.
  }
}

export function setLastStation(
  progress: MechanicalVentilationProgressV2,
  lastStation: StationId,
): MechanicalVentilationProgressV2 {
  return { ...progress, lastStation }
}

export function setLastDevice(
  progress: MechanicalVentilationProgressV2,
  lastDeviceId: VentilatorDeviceId,
): MechanicalVentilationProgressV2 {
  return { ...progress, lastDeviceId }
}

export function nextCaseAttempt(
  progress: MechanicalVentilationProgressV2,
  caseId: string,
  deviceId: VentilatorDeviceId,
): number {
  return (progress.attemptsByDeviceCase[deviceCaseAttemptKey(deviceId, caseId)] ?? 0) + 1
}

export function recordCaseResult(
  progress: MechanicalVentilationProgressV2,
  result: { caseId: string; deviceId: VentilatorDeviceId; outcome: CaseOutcome },
): MechanicalVentilationProgressV2 {
  const score = Math.round(Math.max(0, Math.min(100, result.outcome.score)))
  const previouslySafe =
    (progress.bestScores[result.caseId] ?? 0) >= 80 &&
    progress.criticalErrorStatus[result.caseId] === false
  const safelyMastered = score >= 80 && result.outcome.criticalErrors.length === 0
  const attemptKey = deviceCaseAttemptKey(result.deviceId, result.caseId)
  return {
    ...progress,
    completedCases: [...new Set([...progress.completedCases, result.caseId])],
    attemptsByDeviceCase: {
      ...progress.attemptsByDeviceCase,
      [attemptKey]: (progress.attemptsByDeviceCase[attemptKey] ?? 0) + 1,
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

export function hasCaseMastery(progress: MechanicalVentilationProgressV2, caseId: string): boolean {
  return (progress.bestScores[caseId] ?? 0) >= 80 && progress.criticalErrorStatus[caseId] === false
}
