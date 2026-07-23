import {
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
  CRITICAL_CARE_PROGRESS_VERSION,
  parseSerializedCriticalCareProgress,
} from '@/features/learning-module/activity/progress'
import {
  newestValidCriticalCareResume,
  resolveCriticalCareResumePointer,
} from '@/features/learning-module/activity/resume'
import { criticalCareProgressEnvelopeSchema } from '@/features/learning-module/activity/schema'
import type {
  CriticalCareActivityDefinition,
  CriticalCareProgressEnvelope,
  CriticalCareResumePointer,
} from '@/features/learning-module/activity/types'

import { readCrrtLegacyProgress } from './adapters/crrt'
import { readHemodynamicsLegacyProgress } from './adapters/hemodynamics'
import { readMcsLegacyProgress } from './adapters/mcs'
import { readVentilationLegacyProgress } from './adapters/ventilation'
import {
  LEGACY_PROGRESS_EPOCH,
  type CriticalCareLegacyProgressResult,
  type CriticalCareProgressReadResult,
  type CriticalCareProgressSourceReport,
  type CriticalCareReadableStorage,
} from './types'
import {
  isRecord,
  mergeProjectedActivities,
  parseStoredJson,
  readStoredValue,
  sourceReport,
  versionLabel,
} from './utils'

interface ParsedNormalizedSource {
  readonly report: CriticalCareProgressSourceReport
  readonly envelope?: CriticalCareProgressEnvelope
}

function browserStorage(): CriticalCareReadableStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readNormalizedSource(storage: CriticalCareReadableStorage | null): ParsedNormalizedSource {
  const read = readStoredValue(storage, 'critical-care', CRITICAL_CARE_PROGRESS_STORAGE_KEY)
  if (read.report.status !== 'valid' || read.raw === null) return { report: read.report }
  const json = parseStoredJson(read.raw)
  if (!json.ok) return { report: sourceReport(read, 'corrupt', { issue: json.issue }) }
  if (!isRecord(json.value)) {
    return { report: sourceReport(read, 'corrupt', { issue: 'invalid-shape' }) }
  }
  const detectedVersion = versionLabel(json.value.version)
  if (json.value.version !== CRITICAL_CARE_PROGRESS_VERSION) {
    return {
      report: sourceReport(read, detectedVersion ? 'incompatible' : 'corrupt', {
        issue: detectedVersion ? 'unsupported-version' : 'invalid-shape',
        ...(detectedVersion ? { detectedVersion } : {}),
      }),
    }
  }
  const envelope = parseSerializedCriticalCareProgress(read.raw)
  return envelope
    ? { report: sourceReport(read, 'valid', { detectedVersion }), envelope }
    : {
        report: sourceReport(read, 'corrupt', {
          issue: 'invalid-shape',
          ...(detectedVersion ? { detectedVersion } : {}),
        }),
      }
}

function readPublicLegacyProgress(
  storage: CriticalCareReadableStorage | null,
  activities: readonly CriticalCareActivityDefinition[],
): readonly CriticalCareLegacyProgressResult[] {
  return [
    readHemodynamicsLegacyProgress(storage, activities),
    readVentilationLegacyProgress(storage, activities),
    readMcsLegacyProgress(storage, activities),
    readCrrtLegacyProgress(storage, activities),
  ]
}

function mergePublicProgress(
  normalized: CriticalCareProgressEnvelope | undefined,
  legacy: readonly CriticalCareLegacyProgressResult[],
  activities: readonly CriticalCareActivityDefinition[],
): CriticalCareProgressEnvelope {
  const publicActivityIds = new Set(activities.map((activity) => activity.id))
  const normalizedActivities = (normalized?.activities ?? []).filter((activity) =>
    publicActivityIds.has(activity.activityId),
  )
  const mergedByStrength = mergeProjectedActivities([
    ...legacy.flatMap((result) => result.activities),
    ...normalizedActivities,
  ])
  const activityOrder = [
    ...normalizedActivities.map((activity) => activity.activityId),
    ...legacy.flatMap((result) => result.activities.map((activity) => activity.activityId)),
  ]
  const mergedById = new Map(mergedByStrength.map((activity) => [activity.activityId, activity]))
  const mergedActivities = [...new Set(activityOrder)].flatMap((activityId) => {
    const activity = mergedById.get(activityId)
    return activity ? [activity] : []
  })
  const resumeCandidates: CriticalCareResumePointer[] = [
    ...(normalized?.resume ? [normalized.resume] : []),
    ...legacy.flatMap((result) => (result.resume ? [result.resume] : [])),
  ]
  const resolvedResume = newestValidCriticalCareResume(resumeCandidates, activities)
  const timestamps = [
    normalized?.updatedAt,
    ...mergedActivities.map((activity) => activity.updatedAt),
    resolvedResume?.pointer.updatedAt,
  ].filter((timestamp): timestamp is string => timestamp !== undefined)
  const updatedAt =
    timestamps.sort((left, right) => right.localeCompare(left))[0] ?? LEGACY_PROGRESS_EPOCH

  return criticalCareProgressEnvelopeSchema.parse({
    version: CRITICAL_CARE_PROGRESS_VERSION,
    activities: mergedActivities,
    ...(resolvedResume ? { resume: resolvedResume.pointer } : {}),
    updatedAt,
  }) as CriticalCareProgressEnvelope
}

export function readPublicCriticalCareProgress(
  activities: readonly CriticalCareActivityDefinition[],
  storage: CriticalCareReadableStorage | null = browserStorage(),
): CriticalCareProgressReadResult {
  const normalized = readNormalizedSource(storage)
  const legacySources = readPublicLegacyProgress(storage, activities)
  const reports = [normalized.report, ...legacySources.flatMap((source) => source.sources)]
  const normalizedResumeNotice =
    normalized.envelope?.resume &&
    !resolveCriticalCareResumePointer(normalized.envelope.resume, activities)
      ? {
          ...normalized.report,
          status: 'incompatible' as const,
          issue: 'catalog-target-mismatch' as const,
        }
      : undefined
  return {
    envelope: mergePublicProgress(normalized.envelope, legacySources, activities),
    normalizedSource: normalized.report,
    legacySources,
    notices: [
      ...reports.filter(
        (report) => report.status === 'corrupt' || report.status === 'incompatible',
      ),
      ...(normalizedResumeNotice ? [normalizedResumeNotice] : []),
    ],
  }
}
