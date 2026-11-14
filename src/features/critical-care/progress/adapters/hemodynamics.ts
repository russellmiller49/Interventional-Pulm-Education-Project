import type { CriticalCareActivityDefinition } from '@/features/learning-module/activity'
import {
  ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_PROGRESS_VERSION,
  migrateIcuHemodynamicsProgressV1,
  parseIcuHemodynamicsProgress,
  type IcuHemodynamicsProgressV2,
} from '@/features/icu-hemodynamics/engine/progress'
import {
  ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY,
  parseSelfPacedRecord,
  type IcuHemodynamicsSelfPacedRecord,
} from '@/features/icu-hemodynamics/engine/selfPacedProgress'
import { z } from 'zod'

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
// The former Assess page opens the applied case; the catalog keeps it as the module's one assess row.
const APPLIED_CASE_SOURCE_ID = 'masked-seeded'
const SELF_PACED_PAYLOAD_VERSION = 'icu-hemodynamics-self-paced-v1'
const resumeTimestampSchema = z.string().datetime({ offset: true })

interface ParsedSelfPacedSource {
  readonly report: CriticalCareProgressSourceReport
  readonly record?: IcuHemodynamicsSelfPacedRecord
}

interface ParsedHemodynamicsSource {
  readonly report: CriticalCareProgressSourceReport
  readonly progress?: IcuHemodynamicsProgressV2
}

function parseSelfPacedSource(storage: CriticalCareReadableStorage | null): ParsedSelfPacedSource {
  const read = readStoredValue(storage, MODULE_ID, ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY)
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
  const record = parseSelfPacedRecord(read.raw)
  return record
    ? { report: sourceReport(read, 'valid', { detectedVersion }), record }
    : {
        report: sourceReport(read, 'corrupt', {
          issue: 'invalid-shape',
          ...(detectedVersion ? { detectedVersion } : {}),
        }),
      }
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

/**
 * Every section opened or marked reviewed, and every case opened, as a started activity: no
 * attempts, score, phase or completion. A reviewed mark is the learner's own note, not completion
 * evidence (`engine/selfPacedProgress`), and the catalog gives these activities no completion
 * authority, so a reviewed section reaches the shared record as started.
 *
 * `openedCaseIds` does not say which variant was opened, so each projects as its Practice case;
 * only the current location can say the applied case was opened.
 */
function projectSelfPacedRecord(
  record: IcuHemodynamicsSelfPacedRecord,
  activities: readonly CriticalCareActivityDefinition[],
): CriticalCareLegacyProgressResult['activities'] {
  const visit = (section: 'learn' | 'practice' | 'assess', sourceId: string) =>
    projectActivityProgress(findCatalogActivity(activities, ACTIVITY_PREFIX, section, sourceId), {
      status: 'in-progress',
      mode: section === 'assess' ? 'challenge' : 'guided',
      attempts: 0,
    })
  return mergeProjectedActivities([
    ...[...record.visitedSectionIds, ...record.reviewedSectionIds].map((id) => visit('learn', id)),
    ...record.openedCaseIds.map((id) => visit('practice', id)),
    ...(record.location?.kind === 'case' && record.location.mode === 'applied'
      ? [visit('assess', APPLIED_CASE_SOURCE_ID)]
      : []),
  ])
}

/**
 * Resume from the record's location. The record keeps no step, answer or patient state — a section
 * reopens at its first step and a case starts fresh — so every pointer enters at `recognize`.
 */
function selfPacedResume(
  record: IcuHemodynamicsSelfPacedRecord,
  activities: readonly CriticalCareActivityDefinition[],
): CriticalCareLegacyProgressResult['resume'] {
  const location = record.location
  if (!location) return undefined
  const pointer =
    location.kind === 'section'
      ? makeLegacyResumePointer(
          findCatalogActivity(activities, ACTIVITY_PREFIX, 'learn', location.sectionId),
          { mode: 'guided', phase: 'recognize', payloadVersion: SELF_PACED_PAYLOAD_VERSION },
        )
      : makeLegacyResumePointer(
          location.mode === 'applied'
            ? findCatalogActivity(activities, ACTIVITY_PREFIX, 'assess', APPLIED_CASE_SOURCE_ID)
            : findCatalogActivity(activities, ACTIVITY_PREFIX, 'practice', location.caseId),
          {
            mode: location.mode === 'applied' ? 'challenge' : 'guided',
            phase: 'recognize',
            payloadVersion: SELF_PACED_PAYLOAD_VERSION,
            scenarioId: location.caseId,
          },
        )
  // The shared pointer takes only an offset ISO timestamp; anything else keeps the epoch.
  return pointer && resumeTimestampSchema.safeParse(record.updatedAt).success
    ? { ...pointer, updatedAt: record.updatedAt }
    : pointer
}

/**
 * The self-paced record (HD-01) is the module's current progress: sections opened and marked
 * reviewed, cases opened and the last location, projected as ungraded visits and a Resume pointer.
 *
 * The case ledger (v2) and its v1 predecessor remain the fallback reading on a device without a
 * self-paced record: still parsed and reported, never written, and inert in every reader —
 * `isCurrentProgressActivity` and `isCurrentProgressResume` admit only the self-paced shapes — so a
 * historical attempt or score cannot become current progress.
 */
export function readHemodynamicsLegacyProgress(
  storage: CriticalCareReadableStorage | null,
  activities: readonly CriticalCareActivityDefinition[],
): CriticalCareLegacyProgressResult {
  const selfPaced = parseSelfPacedSource(storage)
  const current = parseCurrentSource(storage)
  const legacy = parseLegacySource(storage)
  const sources = [selfPaced.report, current.report, legacy.report]
  if (selfPaced.record) {
    return legacyAdapterResult(
      MODULE_ID,
      sources,
      projectSelfPacedRecord(selfPaced.record, activities),
      selfPacedResume(selfPaced.record, activities),
    )
  }

  const progress = current.progress ?? legacy.progress
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
