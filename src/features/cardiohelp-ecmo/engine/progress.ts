import type { LastVisitedActivity, ProgressV2, ScenarioDefinition, SupportMode } from './types'

// The storage key intentionally keeps its original name so that existing v1
// payloads are found and migrated instead of orphaned.
export const CARDIOHELP_PROGRESS_STORAGE_KEY = 'cardiohelp-ecmo-progress-v1'
export const CARDIOHELP_PROGRESS_VERSION = 2 as const

const validStations: readonly ProgressV2['lastStation'][] = [
  'orientation',
  'flow-pressure',
  'sweep',
  'troubleshooting',
  'assessment',
]

const validSections: readonly LastVisitedActivity['section'][] = ['learn', 'practice', 'assess']
const validSupportModes: readonly SupportMode[] = ['vv', 'va']

export function createDefaultProgress(): ProgressV2 {
  return {
    version: CARDIOHELP_PROGRESS_VERSION,
    lastStation: 'orientation',
    completedLabs: [],
    scenarioAttempts: {},
    bestScores: {},
    criticalErrorStatus: {},
    mastery: false,
    completedLearnLessonIds: [],
    lastLessonScenarioIdByMode: {},
    lastCaseScenarioIdByMode: {},
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

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  if (value.some((item) => typeof item !== 'string')) return null
  return [...new Set(value as string[])]
}

function parseScenarioIdByMode(value: unknown): Partial<Record<SupportMode, string>> | null {
  if (value === undefined) return {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const parsed: Partial<Record<SupportMode, string>> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!validSupportModes.includes(key as SupportMode)) return null
    if (typeof raw !== 'string') return null
    parsed[key as SupportMode] = raw
  }
  return parsed
}

function parseLastVisited(value: unknown): LastVisitedActivity | undefined | null {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Partial<LastVisitedActivity>
  if (!validSections.includes(candidate.section as LastVisitedActivity['section'])) return null
  if (typeof candidate.scenarioId !== 'string' || !candidate.scenarioId) return null
  if (!validSupportModes.includes(candidate.supportMode as SupportMode)) return null
  return {
    section: candidate.section as LastVisitedActivity['section'],
    scenarioId: candidate.scenarioId,
    supportMode: candidate.supportMode as SupportMode,
  }
}

interface SharedProgressFields {
  lastStation: ProgressV2['lastStation']
  completedLabs: string[]
  scenarioAttempts: Record<string, number>
  bestScores: Record<string, number>
  criticalErrorStatus: Record<string, boolean>
  mastery: boolean
}

function parseSharedFields(candidate: Record<string, unknown>): SharedProgressFields | null {
  if (!validStations.includes(candidate.lastStation as ProgressV2['lastStation'])) return null
  const completedLabs = parseStringArray(candidate.completedLabs)
  const scenarioAttempts = parseNonnegativeIntegerRecord(candidate.scenarioAttempts)
  const bestScores = parseScoreRecord(candidate.bestScores)
  const criticalErrorStatus = parseBooleanRecord(candidate.criticalErrorStatus)
  if (!completedLabs || !scenarioAttempts || !bestScores || !criticalErrorStatus) return null
  if (typeof candidate.mastery !== 'boolean') return null
  return {
    lastStation: candidate.lastStation as ProgressV2['lastStation'],
    completedLabs,
    scenarioAttempts,
    bestScores,
    criticalErrorStatus,
    mastery: candidate.mastery,
  }
}

export function parseProgress(serialized: string | null | undefined): ProgressV2 | null {
  if (!serialized) return null
  try {
    const raw: unknown = JSON.parse(serialized)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const candidate = raw as Record<string, unknown>
    const shared = parseSharedFields(candidate)
    if (!shared) return null

    if (candidate.version === 1) {
      // Upgrade a valid v1 payload in place; Practice history is preserved and
      // the Learn-side fields start empty.
      return {
        version: CARDIOHELP_PROGRESS_VERSION,
        ...shared,
        completedLearnLessonIds: [],
        lastLessonScenarioIdByMode: {},
        lastCaseScenarioIdByMode: {},
      }
    }

    if (candidate.version !== CARDIOHELP_PROGRESS_VERSION) return null
    const completedLearnLessonIds = parseStringArray(candidate.completedLearnLessonIds)
    const lastLessonScenarioIdByMode = parseScenarioIdByMode(candidate.lastLessonScenarioIdByMode)
    const lastCaseScenarioIdByMode = parseScenarioIdByMode(candidate.lastCaseScenarioIdByMode)
    const lastVisited = parseLastVisited(candidate.lastVisited)
    if (
      !completedLearnLessonIds ||
      !lastLessonScenarioIdByMode ||
      !lastCaseScenarioIdByMode ||
      lastVisited === null
    ) {
      return null
    }

    return {
      version: CARDIOHELP_PROGRESS_VERSION,
      ...shared,
      completedLearnLessonIds,
      lastLessonScenarioIdByMode,
      lastCaseScenarioIdByMode,
      ...(lastVisited ? { lastVisited } : {}),
    }
  } catch {
    return null
  }
}

export function readProgress(): ProgressV2 {
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

export function writeProgress(progress: ProgressV2): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CARDIOHELP_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Progress is optional and must never interrupt the simulator.
  }
}

export function setLastStation(
  progress: ProgressV2,
  station: ScenarioDefinition['stationId'],
): ProgressV2 {
  return { ...progress, lastStation: station }
}

export function recordLearnLessonCompleted(progress: ProgressV2, scenarioId: string): ProgressV2 {
  return {
    ...progress,
    completedLearnLessonIds: [...new Set([...progress.completedLearnLessonIds, scenarioId])],
  }
}

export function setLastVisited(progress: ProgressV2, visit: LastVisitedActivity): ProgressV2 {
  return { ...progress, lastVisited: visit }
}

export function setLastLessonForMode(
  progress: ProgressV2,
  supportMode: SupportMode,
  scenarioId: string,
): ProgressV2 {
  return {
    ...progress,
    lastLessonScenarioIdByMode: {
      ...progress.lastLessonScenarioIdByMode,
      [supportMode]: scenarioId,
    },
  }
}

export function setLastCaseForMode(
  progress: ProgressV2,
  supportMode: SupportMode,
  scenarioId: string,
): ProgressV2 {
  return {
    ...progress,
    lastCaseScenarioIdByMode: {
      ...progress.lastCaseScenarioIdByMode,
      [supportMode]: scenarioId,
    },
  }
}

export function recordScenarioResult(
  progress: ProgressV2,
  result: { scenarioId: string; score: number; criticalError: boolean; completed: boolean },
): ProgressV2 {
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
  progress: ProgressV2,
  requiredScenarioIds: readonly string[],
): boolean {
  return requiredScenarioIds.every(
    (id) => (progress.bestScores[id] ?? 0) >= 80 && progress.criticalErrorStatus[id] !== true,
  )
}

export function withMastery(
  progress: ProgressV2,
  requiredScenarioIds: readonly string[],
): ProgressV2 {
  return { ...progress, mastery: calculateMastery(progress, requiredScenarioIds) }
}
