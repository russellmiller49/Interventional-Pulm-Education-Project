import type { CriticalCareActivityDefinition } from '@/features/learning-module/activity'
import { mechanicalVentilationCaseById } from '@/features/mechanical-ventilation/content/runtimeCases'
import {
  LEGACY_HAMILTON_C6_PROGRESS_STORAGE_KEY,
  MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY,
  MECHANICAL_VENTILATION_PROGRESS_VERSION,
  migrateLegacyProgress,
  parseLegacyProgress,
  parseProgress,
  type MechanicalVentilationProgressV2,
} from '@/features/mechanical-ventilation/engine/progress'

import type {
  CriticalCareLegacyProgressResult,
  CriticalCareProgressSourceReport,
  CriticalCareReadableStorage,
} from '../types'
import {
  findCatalogActivity,
  isRecord,
  legacyAdapterResult,
  makeLegacyResumePointer,
  mergeProjectedActivities,
  parseStoredJson,
  projectActivityProgress,
  readStoredValue,
  sourceReport,
  sumBoundedCounters,
  versionLabel,
} from '../utils'

const MODULE_ID = 'mechanical-ventilation'
const ACTIVITY_PREFIX = 'ventilation'

interface ParsedVentilationSource {
  readonly report: CriticalCareProgressSourceReport
  readonly progress?: MechanicalVentilationProgressV2
}

function parseCurrentSource(storage: CriticalCareReadableStorage | null): ParsedVentilationSource {
  const read = readStoredValue(storage, MODULE_ID, MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY)
  if (read.report.status !== 'valid' || read.raw === null) return { report: read.report }
  const json = parseStoredJson(read.raw)
  if (!json.ok) return { report: sourceReport(read, 'corrupt', { issue: json.issue }) }
  if (!isRecord(json.value)) {
    return { report: sourceReport(read, 'corrupt', { issue: 'invalid-shape' }) }
  }
  const detectedVersion = versionLabel(json.value.version)
  if (json.value.version !== MECHANICAL_VENTILATION_PROGRESS_VERSION) {
    return {
      report: sourceReport(read, detectedVersion ? 'incompatible' : 'corrupt', {
        issue: detectedVersion ? 'unsupported-version' : 'invalid-shape',
        ...(detectedVersion ? { detectedVersion } : {}),
      }),
    }
  }
  const progress = parseProgress(read.raw)
  return progress
    ? { report: sourceReport(read, 'valid', { detectedVersion }), progress }
    : {
        report: sourceReport(read, 'corrupt', {
          issue: 'invalid-shape',
          ...(detectedVersion ? { detectedVersion } : {}),
        }),
      }
}

function parseLegacySource(storage: CriticalCareReadableStorage | null): ParsedVentilationSource {
  const read = readStoredValue(storage, MODULE_ID, LEGACY_HAMILTON_C6_PROGRESS_STORAGE_KEY)
  if (read.report.status !== 'valid' || read.raw === null) return { report: read.report }
  const json = parseStoredJson(read.raw)
  if (!json.ok) return { report: sourceReport(read, 'corrupt', { issue: json.issue }) }
  if (!isRecord(json.value)) {
    return { report: sourceReport(read, 'corrupt', { issue: 'invalid-shape' }) }
  }
  const detectedVersion = versionLabel(json.value.version)
  if (json.value.version !== 1) {
    return {
      report: sourceReport(read, detectedVersion ? 'incompatible' : 'corrupt', {
        issue: detectedVersion ? 'unsupported-version' : 'invalid-shape',
        ...(detectedVersion ? { detectedVersion } : {}),
      }),
    }
  }
  const legacy = parseLegacyProgress(read.raw)
  return legacy
    ? {
        report: sourceReport(read, 'valid', { detectedVersion }),
        progress: migrateLegacyProgress(legacy),
      }
    : {
        report: sourceReport(read, 'corrupt', {
          issue: 'invalid-shape',
          ...(detectedVersion ? { detectedVersion } : {}),
        }),
      }
}

function attemptsByCase(
  attemptsByDeviceCase: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  const grouped = new Map<string, number[]>()
  for (const [key, attempts] of Object.entries(attemptsByDeviceCase)) {
    const separator = key.indexOf(':')
    if (separator < 1 || separator === key.length - 1) continue
    const caseId = key.slice(separator + 1)
    const values = grouped.get(caseId) ?? []
    values.push(attempts)
    grouped.set(caseId, values)
  }
  return Object.fromEntries(
    [...grouped].map(([caseId, attempts]) => [caseId, sumBoundedCounters(attempts)]),
  )
}

function projectVentilationProgress(
  progress: MechanicalVentilationProgressV2,
  activities: readonly CriticalCareActivityDefinition[],
  resumeCaseId?: string,
): CriticalCareLegacyProgressResult['activities'] {
  const attempts = attemptsByCase(progress.attemptsByDeviceCase)
  const caseIds = new Set([
    ...Object.keys(attempts),
    ...progress.completedCases,
    ...Object.keys(progress.bestScores),
    ...Object.keys(progress.criticalErrorStatus),
  ])
  return mergeProjectedActivities(
    [...caseIds].map((caseId) => {
      const attemptCount = attempts[caseId] ?? 0
      const bestScore = progress.bestScores[caseId]
      const mastered =
        bestScore !== undefined && bestScore >= 80 && progress.criticalErrorStatus[caseId] === false
      const completed = progress.completedCases.includes(caseId)
      if (!mastered && !completed && attemptCount === 0 && bestScore === undefined) return null
      return projectActivityProgress(
        findCatalogActivity(activities, ACTIVITY_PREFIX, 'practice', caseId),
        {
          status: mastered ? 'mastered' : completed ? 'completed' : 'in-progress',
          ...(resumeCaseId === caseId ? { currentPhase: 'recognize' as const } : {}),
          mode: 'practice',
          attempts: attemptCount,
          ...(bestScore === undefined ? {} : { bestScore }),
        },
      )
    }),
  )
}

function unambiguousResumeCase(progress: MechanicalVentilationProgressV2): string | undefined {
  const attempts = attemptsByCase(progress.attemptsByDeviceCase)
  const touchedCaseIds = new Set([
    ...Object.keys(attempts),
    ...progress.completedCases,
    ...Object.keys(progress.bestScores),
  ])
  const candidates = [...touchedCaseIds].filter(
    (caseId) => mechanicalVentilationCaseById.get(caseId)?.stationId === progress.lastStation,
  )
  return candidates.length === 1 ? candidates[0] : undefined
}

export function readVentilationLegacyProgress(
  storage: CriticalCareReadableStorage | null,
  activities: readonly CriticalCareActivityDefinition[],
): CriticalCareLegacyProgressResult {
  const current = parseCurrentSource(storage)
  const legacy = parseLegacySource(storage)
  const progress = current.progress ?? legacy.progress
  const sources = [current.report, legacy.report]
  if (!progress) return legacyAdapterResult(MODULE_ID, sources, [])

  // The legacy DTO stores a station rather than an exact case. Resume only when
  // the evidence in that station identifies one unique case; otherwise a
  // recommendation can be shown without pretending it is an exact resume.
  const resumeCaseId = unambiguousResumeCase(progress)
  const resume = resumeCaseId
    ? makeLegacyResumePointer(
        findCatalogActivity(activities, ACTIVITY_PREFIX, 'practice', resumeCaseId),
        {
          mode: 'practice',
          phase: 'recognize',
          payloadVersion: 'mechanical-ventilation-progress-v2',
          query: {
            case: resumeCaseId,
            device: progress.lastDeviceId,
            mode: 'practice',
          },
          scenarioId: resumeCaseId,
          deviceId: progress.lastDeviceId,
        },
      )
    : undefined

  return legacyAdapterResult(
    MODULE_ID,
    sources,
    projectVentilationProgress(progress, activities, resumeCaseId),
    resume,
  )
}
