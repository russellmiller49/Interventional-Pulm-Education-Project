import type { CriticalCareActivityDefinition } from '@/features/learning-module/activity'
import type { McsProgressV1 } from '@/features/mechanical-circulatory-support/engine/progress'

import type {
  CriticalCareLegacyProgressResult,
  CriticalCareProgressSourceReport,
  CriticalCareReadableStorage,
} from '../types'
import {
  activityModeForSection,
  findCatalogActivity,
  isRecord,
  isStableLegacyId,
  legacyAdapterResult,
  makeLegacyResumePointer,
  mergeProjectedActivities,
  parseStoredJson,
  projectActivityProgress,
  readStoredValue,
  sourceReport,
  versionLabel,
} from '../utils'

const MODULE_ID = 'mechanical-circulatory-support'
const ACTIVITY_PREFIX = 'mcs'

// The legacy MCS store intentionally keeps this constant private. The adapter
// mirrors the established value for read compatibility and never writes it.
export const MCS_PROGRESS_STORAGE_KEY = 'interventionalpulm:mcs-progress:v1' as const

interface ParsedMcsSource {
  readonly report: CriticalCareProgressSourceReport
  readonly progress?: McsProgressV1
}

function parseStringList(value: unknown): readonly string[] | null {
  if (value === undefined) return []
  if (
    !Array.isArray(value) ||
    value.length > 512 ||
    value.some((item) => !isStableLegacyId(item))
  ) {
    return null
  }
  return [...new Set(value as string[])]
}

function parseScoreRecord(value: unknown): Readonly<Record<string, number>> | null {
  if (value === undefined) return {}
  if (!isRecord(value) || Object.keys(value).length > 512) return null
  const parsed: Record<string, number> = {}
  for (const [id, score] of Object.entries(value)) {
    if (
      !isStableLegacyId(id) ||
      typeof score !== 'number' ||
      !Number.isInteger(score) ||
      score < 0 ||
      score > 100
    ) {
      return null
    }
    parsed[id] = score
  }
  return parsed
}

function parseBooleanRecord(value: unknown): Readonly<Record<string, boolean>> | null {
  if (value === undefined) return {}
  if (!isRecord(value) || Object.keys(value).length > 512) return null
  const parsed: Record<string, boolean> = {}
  for (const [id, status] of Object.entries(value)) {
    if (!isStableLegacyId(id) || typeof status !== 'boolean') return null
    parsed[id] = status
  }
  return parsed
}

function safeParseMcsProgress(value: unknown): McsProgressV1 | null {
  if (!isRecord(value) || value.version !== 1) return null
  const completedLessonIds = parseStringList(value.completedLessonIds)
  const completedCaseIds = parseStringList(value.completedCaseIds)
  const masteredCaseIds = parseStringList(value.masteredCaseIds)
  const completedCapstoneIds = parseStringList(value.completedCapstoneIds)
  const bestScores = parseScoreRecord(value.bestScores)
  const criticalErrorStatus = parseBooleanRecord(value.criticalErrorStatus)
  if (
    !completedLessonIds ||
    !completedCaseIds ||
    !masteredCaseIds ||
    !completedCapstoneIds ||
    !bestScores ||
    !criticalErrorStatus
  ) {
    return null
  }
  if (
    value.lastDevice !== undefined &&
    value.lastDevice !== 'iabp' &&
    value.lastDevice !== 'impella' &&
    value.lastDevice !== 'lvad'
  ) {
    return null
  }
  if (
    value.lastSection !== undefined &&
    value.lastSection !== 'learn' &&
    value.lastSection !== 'practice' &&
    value.lastSection !== 'assess'
  ) {
    return null
  }
  if (
    value.lastActivityId !== undefined &&
    value.lastActivityId !== null &&
    !isStableLegacyId(value.lastActivityId)
  ) {
    return null
  }
  return {
    version: 1,
    completedLessonIds,
    completedCaseIds,
    masteredCaseIds,
    completedCapstoneIds,
    bestScores,
    criticalErrorStatus,
    lastDevice: value.lastDevice ?? 'iabp',
    lastSection: value.lastSection ?? 'learn',
    lastActivityId: value.lastActivityId ?? null,
  }
}

function parseMcsSource(storage: CriticalCareReadableStorage | null): ParsedMcsSource {
  const read = readStoredValue(storage, MODULE_ID, MCS_PROGRESS_STORAGE_KEY)
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
  const progress = safeParseMcsProgress(json.value)
  return progress
    ? { report: sourceReport(read, 'valid', { detectedVersion }), progress }
    : {
        report: sourceReport(read, 'corrupt', {
          issue: 'invalid-shape',
          ...(detectedVersion ? { detectedVersion } : {}),
        }),
      }
}

function projectMcsProgress(
  progress: McsProgressV1,
  activities: readonly CriticalCareActivityDefinition[],
): CriticalCareLegacyProgressResult['activities'] {
  const sourceIds = new Set([
    ...progress.completedLessonIds,
    ...progress.completedCaseIds,
    ...progress.masteredCaseIds,
    ...progress.completedCapstoneIds,
    ...Object.keys(progress.bestScores),
    ...(progress.lastActivityId ? [progress.lastActivityId] : []),
  ])
  return mergeProjectedActivities(
    [...sourceIds].map((sourceId) => {
      const section = findCatalogActivity(activities, ACTIVITY_PREFIX, 'learn', sourceId)
        ? 'learn'
        : findCatalogActivity(activities, ACTIVITY_PREFIX, 'assess', sourceId)
          ? 'assess'
          : 'practice'
      const activity = findCatalogActivity(activities, ACTIVITY_PREFIX, section, sourceId)
      const mastered =
        progress.masteredCaseIds.includes(sourceId) ||
        progress.completedCapstoneIds.includes(sourceId)
      const completed =
        progress.completedLessonIds.includes(sourceId) ||
        progress.completedCaseIds.includes(sourceId)
      const inProgress =
        progress.lastActivityId === sourceId || progress.bestScores[sourceId] !== undefined
      if (!mastered && !completed && !inProgress) return null
      return projectActivityProgress(activity, {
        status: mastered ? 'mastered' : completed ? 'completed' : 'in-progress',
        ...(progress.lastActivityId === sourceId ? { currentPhase: 'recognize' as const } : {}),
        mode: activityModeForSection(section),
        ...(progress.bestScores[sourceId] === undefined
          ? {}
          : { bestScore: progress.bestScores[sourceId] }),
        // The V1 store never recorded attempt counts. Keep zero rather than
        // manufacturing an exact count from completion.
        attempts: 0,
      })
    }),
  )
}

export function readMcsLegacyProgress(
  storage: CriticalCareReadableStorage | null,
  activities: readonly CriticalCareActivityDefinition[],
): CriticalCareLegacyProgressResult {
  const parsed = parseMcsSource(storage)
  if (!parsed.progress) return legacyAdapterResult(MODULE_ID, [parsed.report], [])
  const progress = parsed.progress
  const resumeActivity = progress.lastActivityId
    ? findCatalogActivity(
        activities,
        ACTIVITY_PREFIX,
        progress.lastSection,
        progress.lastActivityId,
      )
    : undefined
  const resume = makeLegacyResumePointer(resumeActivity, {
    mode: activityModeForSection(progress.lastSection),
    phase: 'recognize',
    payloadVersion: 'mcs-progress-v1',
    ...(progress.lastActivityId ? { scenarioId: progress.lastActivityId } : {}),
    deviceId: progress.lastDevice,
  })
  return legacyAdapterResult(
    MODULE_ID,
    [parsed.report],
    projectMcsProgress(progress, activities),
    resume,
  )
}
