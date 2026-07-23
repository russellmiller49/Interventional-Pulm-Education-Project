import {
  CARDIOHELP_PROGRESS_STORAGE_KEY,
  CARDIOHELP_PROGRESS_VERSION,
  parseProgress,
} from '@/features/cardiohelp-ecmo/engine/progress'
import type { ProgressV2 } from '@/features/cardiohelp-ecmo/engine/types'
import type { CriticalCareActivityDefinition } from '@/features/learning-module/activity'

import type {
  CriticalCareLegacyProgressResult,
  CriticalCareProgressSourceReport,
  CriticalCareReadableStorage,
} from '../types'
import {
  activityModeForSection,
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

const MODULE_ID = 'cardiohelp-ecmo'
const ACTIVITY_PREFIX = 'ecmo'

interface ParsedEcmoSource {
  readonly report: CriticalCareProgressSourceReport
  readonly progress?: ProgressV2
}

function parseEcmoSource(storage: CriticalCareReadableStorage | null): ParsedEcmoSource {
  const read = readStoredValue(storage, MODULE_ID, CARDIOHELP_PROGRESS_STORAGE_KEY)
  if (read.report.status !== 'valid' || read.raw === null) return { report: read.report }
  const json = parseStoredJson(read.raw)
  if (!json.ok) return { report: sourceReport(read, 'corrupt', { issue: json.issue }) }
  if (!isRecord(json.value)) {
    return { report: sourceReport(read, 'corrupt', { issue: 'invalid-shape' }) }
  }
  const detectedVersion = versionLabel(json.value.version)
  if (json.value.version !== 1 && json.value.version !== CARDIOHELP_PROGRESS_VERSION) {
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

function activityForEcmoSource(
  activities: readonly CriticalCareActivityDefinition[],
  sourceId: string,
): {
  readonly activity: CriticalCareActivityDefinition
  readonly section: 'practice' | 'assess'
} | null {
  const assess = findCatalogActivity(activities, ACTIVITY_PREFIX, 'assess', sourceId)
  if (assess) return { activity: assess, section: 'assess' }
  const practice = findCatalogActivity(activities, ACTIVITY_PREFIX, 'practice', sourceId)
  return practice ? { activity: practice, section: 'practice' } : null
}

function projectEcmoProgress(
  progress: ProgressV2,
  activities: readonly CriticalCareActivityDefinition[],
): CriticalCareLegacyProgressResult['activities'] {
  const projected = progress.completedLearnLessonIds.map((scenarioId) =>
    projectActivityProgress(findCatalogActivity(activities, ACTIVITY_PREFIX, 'learn', scenarioId), {
      status: 'completed',
      ...(progress.lastVisited?.section === 'learn' &&
      progress.lastVisited.scenarioId === scenarioId
        ? { currentPhase: 'recognize' as const }
        : {}),
      mode: 'guided',
      attempts: 0,
    }),
  )

  const scenarioIds = new Set([
    ...progress.completedLabs,
    ...Object.keys(progress.scenarioAttempts),
    ...Object.keys(progress.bestScores),
    ...Object.keys(progress.criticalErrorStatus),
    ...(progress.lastVisited && progress.lastVisited.section !== 'learn'
      ? [progress.lastVisited.scenarioId]
      : []),
  ])
  for (const scenarioId of scenarioIds) {
    const resolved = activityForEcmoSource(activities, scenarioId)
    if (!resolved) continue
    const attempts = progress.scenarioAttempts[scenarioId] ?? 0
    const bestScore = progress.bestScores[scenarioId]
    const mastered =
      bestScore !== undefined &&
      bestScore >= 80 &&
      progress.criticalErrorStatus[scenarioId] === false
    const completed = progress.completedLabs.includes(scenarioId)
    const isLast =
      progress.lastVisited?.section === resolved.section &&
      progress.lastVisited.scenarioId === scenarioId
    if (!mastered && !completed && attempts === 0 && bestScore === undefined && !isLast) continue
    projected.push(
      projectActivityProgress(resolved.activity, {
        status: mastered ? 'mastered' : completed ? 'completed' : 'in-progress',
        ...(isLast ? { currentPhase: 'recognize' as const } : {}),
        mode: activityModeForSection(resolved.section),
        attempts,
        ...(bestScore === undefined ? {} : { bestScore }),
      }),
    )
  }
  return mergeProjectedActivities(projected)
}

export function readEcmoLegacyProgress(
  storage: CriticalCareReadableStorage | null,
  activities: readonly CriticalCareActivityDefinition[],
): CriticalCareLegacyProgressResult {
  const parsed = parseEcmoSource(storage)
  if (!parsed.progress) return legacyAdapterResult(MODULE_ID, [parsed.report], [])
  const progress = parsed.progress
  const lastVisited = progress.lastVisited
  const resumeActivity = lastVisited
    ? findCatalogActivity(activities, ACTIVITY_PREFIX, lastVisited.section, lastVisited.scenarioId)
    : undefined
  const resume = lastVisited
    ? makeLegacyResumePointer(resumeActivity, {
        mode: activityModeForSection(lastVisited.section),
        phase: 'recognize',
        payloadVersion: 'cardiohelp-ecmo-progress-v2',
        scenarioId: lastVisited.scenarioId,
      })
    : undefined
  return legacyAdapterResult(
    MODULE_ID,
    [parsed.report],
    projectEcmoProgress(progress, activities),
    resume,
  )
}
