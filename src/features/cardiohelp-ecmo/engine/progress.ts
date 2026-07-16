import type { ProgressV1, ScenarioDefinition } from './types'

export const CARDIOHELP_PROGRESS_STORAGE_KEY = 'cardiohelp-ecmo-progress-v1'
export const CARDIOHELP_PROGRESS_VERSION = 1 as const

const validStations: readonly ProgressV1['lastStation'][] = [
  'orientation',
  'flow-pressure',
  'sweep',
  'troubleshooting',
  'assessment',
]

export function createDefaultProgress(): ProgressV1 {
  return {
    version: CARDIOHELP_PROGRESS_VERSION,
    lastStation: 'orientation',
    completedLabs: [],
    scenarioAttempts: {},
    bestScores: {},
    criticalErrorStatus: {},
    mastery: false,
  }
}

function parseNonnegativeIntegerRecord(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const parsed: Record<string, number> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) return null
    parsed[key] = raw
  }
  return parsed
}

function parseScoreRecord(value: unknown): Record<string, number> | null {
  const parsed = parseNonnegativeIntegerRecord(value)
  if (!parsed || Object.values(parsed).some((score) => score > 100)) return null
  return parsed
}

function parseBooleanRecord(value: unknown): Record<string, boolean> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const parsed: Record<string, boolean> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw !== 'boolean') return null
    parsed[key] = raw
  }
  return parsed
}

export function parseProgress(serialized: string | null | undefined): ProgressV1 | null {
  if (!serialized) return null
  try {
    const raw: unknown = JSON.parse(serialized)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const candidate = raw as Partial<ProgressV1>
    if (candidate.version !== CARDIOHELP_PROGRESS_VERSION) return null
    if (!validStations.includes(candidate.lastStation as ProgressV1['lastStation'])) return null
    if (!Array.isArray(candidate.completedLabs)) return null
    if (candidate.completedLabs.some((id) => typeof id !== 'string')) return null
    const scenarioAttempts = parseNonnegativeIntegerRecord(candidate.scenarioAttempts)
    const bestScores = parseScoreRecord(candidate.bestScores)
    const criticalErrorStatus = parseBooleanRecord(candidate.criticalErrorStatus)
    if (!scenarioAttempts || !bestScores || !criticalErrorStatus) return null
    if (typeof candidate.mastery !== 'boolean') return null

    return {
      version: CARDIOHELP_PROGRESS_VERSION,
      lastStation: candidate.lastStation as ProgressV1['lastStation'],
      completedLabs: [...new Set(candidate.completedLabs)],
      scenarioAttempts,
      bestScores,
      criticalErrorStatus,
      mastery: candidate.mastery,
    }
  } catch {
    return null
  }
}

export function readProgress(): ProgressV1 {
  if (typeof window === 'undefined') return createDefaultProgress()
  try {
    return (
      parseProgress(window.localStorage.getItem(CARDIOHELP_PROGRESS_STORAGE_KEY)) ??
      createDefaultProgress()
    )
  } catch {
    return createDefaultProgress()
  }
}

export function writeProgress(progress: ProgressV1): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CARDIOHELP_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Progress is optional and must never interrupt the simulator.
  }
}

export function setLastStation(
  progress: ProgressV1,
  station: ScenarioDefinition['stationId'],
): ProgressV1 {
  return { ...progress, lastStation: station }
}

export function recordScenarioResult(
  progress: ProgressV1,
  result: { scenarioId: string; score: number; criticalError: boolean; completed: boolean },
): ProgressV1 {
  const score = Math.max(0, Math.min(100, Math.round(result.score)))
  const previouslyMasteredSafely =
    (progress.bestScores[result.scenarioId] ?? 0) >= 80 &&
    progress.criticalErrorStatus[result.scenarioId] === false
  const safelyMasteredNow = score >= 80 && !result.criticalError
  const completedLabs = result.completed
    ? [...new Set([...progress.completedLabs, result.scenarioId])]
    : [...progress.completedLabs]
  return {
    ...progress,
    completedLabs,
    scenarioAttempts: {
      ...progress.scenarioAttempts,
      [result.scenarioId]: (progress.scenarioAttempts[result.scenarioId] ?? 0) + 1,
    },
    bestScores: {
      ...progress.bestScores,
      [result.scenarioId]: Math.max(progress.bestScores[result.scenarioId] ?? 0, score),
    },
    criticalErrorStatus: {
      ...progress.criticalErrorStatus,
      [result.scenarioId]: safelyMasteredNow
        ? false
        : previouslyMasteredSafely
          ? false
          : result.criticalError,
    },
  }
}

export function calculateMastery(
  progress: ProgressV1,
  requiredScenarioIds: readonly string[],
): boolean {
  return requiredScenarioIds.every(
    (id) => (progress.bestScores[id] ?? 0) >= 80 && progress.criticalErrorStatus[id] !== true,
  )
}

export function withMastery(
  progress: ProgressV1,
  requiredScenarioIds: readonly string[],
): ProgressV1 {
  return { ...progress, mastery: calculateMastery(progress, requiredScenarioIds) }
}
