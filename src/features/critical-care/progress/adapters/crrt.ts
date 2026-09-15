import {
  BAXTER_CRRT_CONTENT_VERSION,
  BAXTER_CRRT_ENGINE_VERSION,
  BAXTER_CRRT_PROGRESS_STORAGE_KEY,
  BAXTER_CRRT_PROGRESS_VERSION,
  parseProgress,
} from '@/features/baxter-crrt/engine/progress'
import {
  parseCrrtSelfPacedProgress,
  type CrrtSelfPacedProgress,
} from '@/features/baxter-crrt/selfPacedProgress'
import type { CriticalCareActivityDefinition } from '@/features/learning-module/activity'

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
  versionLabel,
} from '../utils'

const MODULE_ID = 'baxter-crrt'
const ACTIVITY_PREFIX = 'crrt'

interface ParsedCrrtSource {
  readonly report: CriticalCareProgressSourceReport
  readonly current?: CrrtSelfPacedProgress
}

function parseCrrtSource(storage: CriticalCareReadableStorage | null): ParsedCrrtSource {
  const read = readStoredValue(storage, MODULE_ID, BAXTER_CRRT_PROGRESS_STORAGE_KEY)
  if (read.report.status !== 'valid' || read.raw === null) return { report: read.report }
  const json = parseStoredJson(read.raw)
  if (!json.ok) return { report: sourceReport(read, 'corrupt', { issue: json.issue }) }
  if (!isRecord(json.value)) {
    return { report: sourceReport(read, 'corrupt', { issue: 'invalid-shape' }) }
  }
  const detectedVersion = versionLabel(json.value.version)
  if (json.value.version !== BAXTER_CRRT_PROGRESS_VERSION) {
    return {
      report: sourceReport(read, detectedVersion ? 'incompatible' : 'corrupt', {
        issue: detectedVersion ? 'unsupported-version' : 'invalid-shape',
        ...(detectedVersion ? { detectedVersion } : {}),
      }),
    }
  }
  if (json.value.engineVersion !== BAXTER_CRRT_ENGINE_VERSION) {
    return {
      report: sourceReport(read, 'incompatible', {
        issue: 'engine-version-mismatch',
        detectedVersion,
      }),
    }
  }
  if (json.value.contentVersion !== BAXTER_CRRT_CONTENT_VERSION) {
    return {
      report: sourceReport(read, 'incompatible', {
        issue: 'content-version-mismatch',
        detectedVersion,
      }),
    }
  }
  const progress = parseProgress(read.raw)
  const current = parseCrrtSelfPacedProgress(json.value.selfPaced)
  return progress
    ? { report: sourceReport(read, 'valid', { detectedVersion }), current }
    : {
        report: sourceReport(read, 'corrupt', {
          issue: 'invalid-shape',
          ...(detectedVersion ? { detectedVersion } : {}),
        }),
        current,
      }
}

/** Historical V3 grades are readable for diagnostics only, never current progress. */
export function readCrrtLegacyProgress(
  storage: CriticalCareReadableStorage | null,
  activities: readonly CriticalCareActivityDefinition[],
): CriticalCareLegacyProgressResult {
  const parsed = parseCrrtSource(storage)
  const current = parsed.current ?? parseCrrtSelfPacedProgress(undefined)
  const last = current.lastLocation
  const resume = last
    ? makeLegacyResumePointer(
        findCatalogActivity(activities, ACTIVITY_PREFIX, last.section, last.id),
        {
          mode:
            last.section === 'learn'
              ? 'guided'
              : last.section === 'assess'
                ? 'challenge'
                : 'practice',
          phase: 'recognize',
          payloadVersion: 'crrt-selection-v1',
          ...(last.section === 'learn'
            ? { query: { lesson: last.id } }
            : last.section === 'practice'
              ? { query: { case: last.id }, scenarioId: last.id }
              : {}),
          deviceId: 'prismax-aw8035-2xx',
        },
      )
    : undefined
  const visits = [
    ...current.visitedLessonIds.map((id) => ['learn', id] as const),
    ...current.visitedCaseIds.map((id) => ['practice', id] as const),
    ...(current.lastLocation?.section === 'assess'
      ? [['assess', current.lastLocation.id] as const]
      : []),
  ]
  return legacyAdapterResult(
    MODULE_ID,
    [parsed.report],
    mergeProjectedActivities(
      visits.map(([section, id]) =>
        projectActivityProgress(findCatalogActivity(activities, ACTIVITY_PREFIX, section, id), {
          status: 'in-progress',
          mode: section === 'learn' ? 'guided' : section === 'assess' ? 'challenge' : 'practice',
          attempts: 0,
        }),
      ),
    ),
    resume && current.updatedAt ? { ...resume, updatedAt: current.updatedAt } : undefined,
  )
}
