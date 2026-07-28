import { criticalCareActivities } from '@/features/critical-care/content/activities'
import {
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
  CRITICAL_CARE_PROGRESS_VERSION,
  criticalCareProgressEnvelopeSchema,
  newestValidCriticalCareResume,
  parseSerializedCriticalCareProgress,
  resolveCriticalCareResumePointer,
  type CriticalCareActivityDefinition,
  type CriticalCareProgressEnvelope,
  type CriticalCareResumePointer,
  type ResolvedCriticalCareResume,
} from '@/features/learning-module/activity'

import { readCrrtLegacyProgress } from './adapters/crrt'
import { readEcmoLegacyProgress } from './adapters/ecmo'
import { readHemodynamicsLegacyProgress } from './adapters/hemodynamics'
import { readIcuSimulationLegacyProgress } from './adapters/icuSimulation'
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
  enforceProgressCollectionAuthority,
  isRecord,
  mergeProjectedActivities,
  parseStoredJson,
  readStoredValue,
  sourceReport,
  versionLabel,
} from './utils'

export * from './adapters/crrt'
export * from './adapters/ecmo'
export * from './adapters/hemodynamics'
export * from './adapters/icuSimulation'
export * from './adapters/mcs'
export * from './adapters/ventilation'
export * from './integrated'
export * from './recommendation'
export * from './selection'
export * from './types'

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

export function readCriticalCareLegacyProgress(
  storage: CriticalCareReadableStorage | null,
  activities: readonly CriticalCareActivityDefinition[] = criticalCareActivities,
): readonly CriticalCareLegacyProgressResult[] {
  return [
    readHemodynamicsLegacyProgress(storage, activities),
    readVentilationLegacyProgress(storage, activities),
    readMcsLegacyProgress(storage, activities),
    readEcmoLegacyProgress(storage, activities),
    readCrrtLegacyProgress(storage, activities),
    readIcuSimulationLegacyProgress(storage, activities),
  ]
}

export function mergeCriticalCareProgress(
  normalized: CriticalCareProgressEnvelope | undefined,
  legacy: readonly CriticalCareLegacyProgressResult[],
  activities: readonly CriticalCareActivityDefinition[] = criticalCareActivities,
): CriticalCareProgressEnvelope {
  // Legacy stores remain authoritative evidence of completion/mastery during the
  // compatibility window. Merge them before normalized records so V2 can keep
  // its newer phase/mode metadata without allowing a page-open write to
  // downgrade an older completed or mastered result.
  const mergedByStrength = mergeProjectedActivities([
    ...enforceProgressCollectionAuthority(
      activities,
      legacy.flatMap((result) => result.activities),
    ),
    ...enforceProgressCollectionAuthority(activities, normalized?.activities ?? []),
  ])
  const activityOrder = [
    ...(normalized?.activities.map((activity) => activity.activityId) ?? []),
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

export function readMergedCriticalCareProgress(
  storage: CriticalCareReadableStorage | null = browserStorage(),
  activities: readonly CriticalCareActivityDefinition[] = criticalCareActivities,
): CriticalCareProgressReadResult {
  const normalized = readNormalizedSource(storage)
  const legacySources = readCriticalCareLegacyProgress(storage, activities)
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
    envelope: mergeCriticalCareProgress(normalized.envelope, legacySources, activities),
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

export function getCriticalCareResumeTarget(
  storage: CriticalCareReadableStorage | null = browserStorage(),
  activities: readonly CriticalCareActivityDefinition[] = criticalCareActivities,
): ResolvedCriticalCareResume | null {
  const pointer = readMergedCriticalCareProgress(storage, activities).envelope.resume
  return pointer ? resolveCriticalCareResumePointer(pointer, activities) : null
}
