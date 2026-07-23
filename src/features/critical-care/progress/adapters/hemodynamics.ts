import type { CriticalCareActivityDefinition } from '@/features/learning-module/activity'
import {
  ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_PROGRESS_VERSION,
  migrateIcuHemodynamicsProgressV1,
  parseIcuHemodynamicsProgress,
  type IcuHemodynamicsProgressV2,
} from '@/features/icu-hemodynamics/engine/progress'

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

const MODULE_ID = 'icu-hemodynamics'
const ACTIVITY_PREFIX = 'hemodynamics'
const PAC_SIGNAL_VALIDATION_SOURCE_ID = 'pac-signal-validation'

interface ParsedHemodynamicsSource {
  readonly report: CriticalCareProgressSourceReport
  readonly progress?: IcuHemodynamicsProgressV2
}

function parseCurrentSource(storage: CriticalCareReadableStorage | null): ParsedHemodynamicsSource {
  const read = readStoredValue(storage, MODULE_ID, ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY)
  if (read.report.status !== 'valid' || read.raw === null) return { report: read.report }
  const json = parseStoredJson(read.raw)
  if (!json.ok) return { report: sourceReport(read, 'corrupt', { issue: json.issue }) }
  if (!isRecord(json.value)) {
    return { report: sourceReport(read, 'corrupt', { issue: 'invalid-shape' }) }
  }
  const detectedVersion = versionLabel(json.value.version)
  if (json.value.version !== ICU_HEMODYNAMICS_PROGRESS_VERSION) {
    return {
      report: sourceReport(read, detectedVersion ? 'incompatible' : 'corrupt', {
        issue: detectedVersion ? 'unsupported-version' : 'invalid-shape',
        ...(detectedVersion ? { detectedVersion } : {}),
      }),
    }
  }
  const progress = parseIcuHemodynamicsProgress(read.raw)
  return progress
    ? {
        report: sourceReport(read, 'valid', { detectedVersion }),
        progress,
      }
    : {
        report: sourceReport(read, 'corrupt', {
          issue: 'invalid-shape',
          ...(detectedVersion ? { detectedVersion } : {}),
        }),
      }
}

function parseLegacySource(storage: CriticalCareReadableStorage | null): ParsedHemodynamicsSource {
  const read = readStoredValue(storage, MODULE_ID, ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY)
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
  const progress = migrateIcuHemodynamicsProgressV1(read.raw)
  return progress
    ? { report: sourceReport(read, 'valid', { detectedVersion }), progress }
    : {
        report: sourceReport(read, 'corrupt', {
          issue: 'invalid-shape',
          ...(detectedVersion ? { detectedVersion } : {}),
        }),
      }
}

function projectHemodynamicsProgress(
  progress: IcuHemodynamicsProgressV2,
  activities: readonly CriticalCareActivityDefinition[],
): CriticalCareLegacyProgressResult['activities'] {
  const caseIds = new Set([
    ...Object.keys(progress.attempts),
    ...progress.completedCaseIds,
    ...Object.keys(progress.bestScores),
    ...progress.masteredCaseIds,
  ])
  const projected = [...caseIds].map((caseId) => {
    const attempts = progress.attempts[caseId] ?? 0
    const bestScore = progress.bestScores[caseId]
    const mastered = progress.masteredCaseIds.includes(caseId)
    const completed = progress.completedCaseIds.includes(caseId)
    if (!mastered && !completed && attempts === 0 && bestScore === undefined) return null
    return projectActivityProgress(
      findCatalogActivity(activities, ACTIVITY_PREFIX, 'practice', caseId),
      {
        status: mastered ? 'mastered' : completed ? 'completed' : 'in-progress',
        ...(progress.lastWorkspace === 'cases' && progress.lastStation === caseId
          ? { currentPhase: 'recognize' as const }
          : {}),
        mode: 'practice',
        attempts,
        ...(bestScore === undefined ? {} : { bestScore }),
      },
    )
  })

  if (progress.lastWorkspace === 'pac-skills') {
    projected.push(
      projectActivityProgress(
        findCatalogActivity(activities, ACTIVITY_PREFIX, 'learn', PAC_SIGNAL_VALIDATION_SOURCE_ID),
        {
          status: 'in-progress',
          currentPhase: 'recognize',
          mode: 'guided',
          attempts: 0,
        },
      ),
    )
  } else if (!caseIds.has(progress.lastStation)) {
    projected.push(
      projectActivityProgress(
        findCatalogActivity(activities, ACTIVITY_PREFIX, 'practice', progress.lastStation),
        {
          status: 'in-progress',
          currentPhase: 'recognize',
          mode: 'practice',
          attempts: 0,
        },
      ),
    )
  }
  return mergeProjectedActivities(projected)
}

export function readHemodynamicsLegacyProgress(
  storage: CriticalCareReadableStorage | null,
  activities: readonly CriticalCareActivityDefinition[],
): CriticalCareLegacyProgressResult {
  const current = parseCurrentSource(storage)
  const legacy = parseLegacySource(storage)
  const progress = current.progress ?? legacy.progress
  const sources = [current.report, legacy.report]
  if (!progress) return legacyAdapterResult(MODULE_ID, sources, [])

  const resumeActivity =
    progress.lastWorkspace === 'pac-skills'
      ? findCatalogActivity(activities, ACTIVITY_PREFIX, 'learn', PAC_SIGNAL_VALIDATION_SOURCE_ID)
      : findCatalogActivity(activities, ACTIVITY_PREFIX, 'practice', progress.lastStation)
  const resume = makeLegacyResumePointer(resumeActivity, {
    mode: progress.lastWorkspace === 'pac-skills' ? 'guided' : 'practice',
    phase: 'recognize',
    payloadVersion: 'icu-hemodynamics-progress-v2',
    ...(progress.lastWorkspace === 'cases' ? { scenarioId: progress.lastStation } : {}),
  })

  return legacyAdapterResult(
    MODULE_ID,
    sources,
    projectHemodynamicsProgress(progress, activities),
    resume,
  )
}
