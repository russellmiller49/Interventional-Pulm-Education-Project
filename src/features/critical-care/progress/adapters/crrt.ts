import {
  BAXTER_CRRT_CONTENT_VERSION,
  BAXTER_CRRT_ENGINE_VERSION,
  BAXTER_CRRT_PROGRESS_STORAGE_KEY,
  BAXTER_CRRT_PROGRESS_VERSION,
  parseProgress,
  type BaxterCrrtProgressV3,
} from '@/features/baxter-crrt/engine/progress'
import { baxterCrrtPracticeCaseIds } from '@/features/baxter-crrt/content/curriculum'
import type {
  CriticalCareActivityDefinition,
  CriticalCareActivityProgress,
} from '@/features/learning-module/activity'

import type {
  CriticalCareLegacyProgressResult,
  CriticalCareProgressSourceReport,
  CriticalCareReadableStorage,
} from '../types'
import {
  findCatalogActivity,
  isRecord,
  legacyAdapterResult,
  mergeProjectedActivities,
  parseStoredJson,
  projectActivityProgress,
  readStoredValue,
  sourceReport,
  sumBoundedCounters,
  versionLabel,
} from '../utils'

const MODULE_ID = 'baxter-crrt'
const ACTIVITY_PREFIX = 'crrt'

interface ParsedCrrtSource {
  readonly report: CriticalCareProgressSourceReport
  readonly progress?: BaxterCrrtProgressV3
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
  return progress
    ? { report: sourceReport(read, 'valid', { detectedVersion }), progress }
    : {
        report: sourceReport(read, 'corrupt', {
          issue: 'invalid-shape',
          ...(detectedVersion ? { detectedVersion } : {}),
        }),
      }
}

type CrrtLegacySection = 'learn' | 'practice' | 'assess'

interface AggregatedAttempt {
  readonly section: CrrtLegacySection
  readonly sourceId: string
  readonly attempts: number
  readonly bestScore?: number
  readonly hintCount?: number
}

const canonicalPracticeIdByLowercase = new Map(
  baxterCrrtPracticeCaseIds.map((caseId) => [caseId.toLowerCase(), caseId]),
)

function canonicalCrrtSourceId(section: CrrtLegacySection, sourceId: string): string {
  return section === 'practice'
    ? (canonicalPracticeIdByLowercase.get(sourceId.toLowerCase()) ?? sourceId)
    : sourceId
}

function aggregateAttempts(progress: BaxterCrrtProgressV3): readonly AggregatedAttempt[] {
  const groups = new Map<
    string,
    {
      section: CrrtLegacySection
      sourceId: string
      attempts: number[]
      scores: number[]
      hints: number[]
    }
  >()
  for (const [key, attempts] of Object.entries(progress.attempts)) {
    const parts = key.split(':')
    if (parts.length !== 4) continue
    const [, , pathway, sourceId] = parts
    const section: CrrtLegacySection =
      pathway === 'mastery' ? 'assess' : pathway === 'learn' ? 'learn' : 'practice'
    const canonicalSourceId = canonicalCrrtSourceId(section, sourceId)
    const groupKey = `${section}:${canonicalSourceId}`
    const group = groups.get(groupKey) ?? {
      section,
      sourceId: canonicalSourceId,
      attempts: [],
      scores: [],
      hints: [],
    }
    group.attempts.push(attempts)
    const score = progress.bestSafeScores[key]
    if (score !== undefined) group.scores.push(score)
    const hints = progress.hintUse[key]
    if (hints !== undefined) group.hints.push(hints)
    groups.set(groupKey, group)
  }
  return [...groups.values()].map((group) => ({
    section: group.section,
    sourceId: group.sourceId,
    attempts: sumBoundedCounters(group.attempts),
    ...(group.scores.length ? { bestScore: Math.max(...group.scores) } : {}),
    ...(group.hints.length ? { hintCount: sumBoundedCounters(group.hints) } : {}),
  }))
}

function projectCrrtProgress(
  progress: BaxterCrrtProgressV3,
  activities: readonly CriticalCareActivityDefinition[],
): CriticalCareLegacyProgressResult['activities'] {
  const aggregated = aggregateAttempts(progress)
  const attemptByActivity = new Map(
    aggregated.map((item) => [`${item.section}:${item.sourceId}`, item]),
  )
  const projections: Array<CriticalCareActivityProgress | null> = []

  const pushProjection = (
    section: CrrtLegacySection,
    sourceId: string,
    completed: boolean,
    mastered: boolean,
  ) => {
    const attempt = attemptByActivity.get(`${section}:${sourceId}`)
    if (!completed && !mastered && !attempt?.attempts && attempt?.bestScore === undefined) return
    projections.push(
      projectActivityProgress(findCatalogActivity(activities, ACTIVITY_PREFIX, section, sourceId), {
        status: mastered ? 'mastered' : completed ? 'completed' : 'in-progress',
        mode: section === 'learn' ? 'guided' : section === 'assess' ? 'challenge' : 'practice',
        attempts: attempt?.attempts ?? 0,
        ...(attempt?.bestScore === undefined ? {} : { bestScore: attempt.bestScore }),
        ...(attempt?.hintCount === undefined ? {} : { hintCount: attempt.hintCount }),
      }),
    )
  }

  const learnIds = new Set([
    ...progress.completedLessonIds,
    ...aggregated.filter((item) => item.section === 'learn').map((item) => item.sourceId),
  ])
  for (const sourceId of learnIds) {
    pushProjection('learn', sourceId, progress.completedLessonIds.includes(sourceId), false)
  }

  const practiceIds = new Set([
    ...progress.completedPracticeCaseIds.map((sourceId) =>
      canonicalCrrtSourceId('practice', sourceId),
    ),
    ...aggregated.filter((item) => item.section === 'practice').map((item) => item.sourceId),
  ])
  const completedPracticeIds = new Set(
    progress.completedPracticeCaseIds.map((sourceId) =>
      canonicalCrrtSourceId('practice', sourceId),
    ),
  )
  for (const sourceId of practiceIds) {
    pushProjection('practice', sourceId, completedPracticeIds.has(sourceId), false)
  }

  const assessIds = new Set([
    ...progress.completedMasteryCapstoneIds,
    ...aggregated.filter((item) => item.section === 'assess').map((item) => item.sourceId),
  ])
  for (const sourceId of assessIds) {
    // V3 only adds a capstone ID after its fail-closed mastery criteria pass.
    pushProjection(
      'assess',
      sourceId,
      false,
      progress.completedMasteryCapstoneIds.includes(sourceId),
    )
  }
  return mergeProjectedActivities(projections)
}

export function readCrrtLegacyProgress(
  storage: CriticalCareReadableStorage | null,
  activities: readonly CriticalCareActivityDefinition[],
): CriticalCareLegacyProgressResult {
  const parsed = parseCrrtSource(storage)
  if (!parsed.progress) return legacyAdapterResult(MODULE_ID, [parsed.report], [])
  // V3 remembers a station, device, and role lens but not one exact last
  // activity. Do not manufacture chronology or an unsafe resume target.
  return legacyAdapterResult(
    MODULE_ID,
    [parsed.report],
    projectCrrtProgress(parsed.progress, activities),
  )
}
