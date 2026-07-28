import { publicIcuScenarioManifestById } from '@/features/icu-simulation/content/publicScenarioManifest'
import {
  ICU_SIMULATION_PROGRESS_STORAGE_KEY,
  ICU_SIMULATION_PROGRESS_VERSION,
  ICU_SIMULATION_SESSION_STORAGE_KEY,
  ICU_SYNTHETIC_SESSION_VERSION,
  parseIcuProgress,
  parseIcuSyntheticSession,
  type IcuSimulationProgressV1,
  type IcuSyntheticSessionV1,
} from '@/features/icu-simulation/engine/persistence'
import {
  ICU_CONTENT_VERSION,
  ICU_ENGINE_VERSION,
  type IcuScenarioFamily,
  type IcuSimulationMode,
} from '@/features/icu-simulation/engine/types'
import type {
  CriticalCareActivityDefinition,
  CriticalCareActivityPhase,
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
  makeLegacyResumePointer,
  mergeProjectedActivities,
  parseStoredJson,
  projectActivityProgress,
  readStoredValue,
  sourceReport,
  versionLabel,
} from '../utils'

const MODULE_ID = 'icu-simulation'
const ACTIVITY_PREFIX = 'icu'

interface ParsedIcuProgressSource {
  readonly report: CriticalCareProgressSourceReport
  readonly progress?: IcuSimulationProgressV1
}

interface ParsedIcuSessionSource {
  readonly report: CriticalCareProgressSourceReport
  readonly session?: IcuSyntheticSessionV1
}

function parseIcuProgressSource(
  storage: CriticalCareReadableStorage | null,
): ParsedIcuProgressSource {
  const read = readStoredValue(storage, MODULE_ID, ICU_SIMULATION_PROGRESS_STORAGE_KEY)
  if (read.report.status !== 'valid' || read.raw === null) return { report: read.report }
  const json = parseStoredJson(read.raw)
  if (!json.ok) return { report: sourceReport(read, 'corrupt', { issue: json.issue }) }
  if (!isRecord(json.value)) {
    return { report: sourceReport(read, 'corrupt', { issue: 'invalid-shape' }) }
  }
  const detectedVersion = versionLabel(json.value.version)
  if (json.value.version !== ICU_SIMULATION_PROGRESS_VERSION) {
    return {
      report: sourceReport(read, detectedVersion ? 'incompatible' : 'corrupt', {
        issue: detectedVersion ? 'unsupported-version' : 'invalid-shape',
        ...(detectedVersion ? { detectedVersion } : {}),
      }),
    }
  }
  if (json.value.engineVersion !== ICU_ENGINE_VERSION) {
    return {
      report: sourceReport(read, 'incompatible', {
        issue: 'engine-version-mismatch',
        detectedVersion,
      }),
    }
  }
  if (json.value.contentVersion !== ICU_CONTENT_VERSION) {
    return {
      report: sourceReport(read, 'incompatible', {
        issue: 'content-version-mismatch',
        detectedVersion,
      }),
    }
  }
  const progress = parseIcuProgress(read.raw)
  return progress
    ? { report: sourceReport(read, 'valid', { detectedVersion }), progress }
    : {
        report: sourceReport(read, 'corrupt', {
          issue: 'invalid-shape',
          ...(detectedVersion ? { detectedVersion } : {}),
        }),
      }
}

function parseIcuSessionSource(
  storage: CriticalCareReadableStorage | null,
): ParsedIcuSessionSource {
  const read = readStoredValue(storage, MODULE_ID, ICU_SIMULATION_SESSION_STORAGE_KEY)
  if (read.report.status !== 'valid' || read.raw === null) return { report: read.report }
  const json = parseStoredJson(read.raw)
  if (!json.ok) return { report: sourceReport(read, 'corrupt', { issue: json.issue }) }
  if (!isRecord(json.value)) {
    return { report: sourceReport(read, 'corrupt', { issue: 'invalid-shape' }) }
  }
  const detectedVersion = versionLabel(json.value.version)
  if (json.value.version !== ICU_SYNTHETIC_SESSION_VERSION) {
    return {
      report: sourceReport(read, detectedVersion ? 'incompatible' : 'corrupt', {
        issue: detectedVersion ? 'unsupported-version' : 'invalid-shape',
        ...(detectedVersion ? { detectedVersion } : {}),
      }),
    }
  }
  if (!isRecord(json.value.replay)) {
    return {
      report: sourceReport(read, 'corrupt', {
        issue: 'invalid-shape',
        ...(detectedVersion ? { detectedVersion } : {}),
      }),
    }
  }
  if (json.value.replay.engineVersion !== ICU_ENGINE_VERSION) {
    return {
      report: sourceReport(read, 'incompatible', {
        issue: 'engine-version-mismatch',
        detectedVersion,
      }),
    }
  }
  if (json.value.replay.contentVersion !== ICU_CONTENT_VERSION) {
    return {
      report: sourceReport(read, 'incompatible', {
        issue: 'content-version-mismatch',
        detectedVersion,
      }),
    }
  }
  const session = parseIcuSyntheticSession(read.raw)
  if (!session) {
    return {
      report: sourceReport(read, 'corrupt', {
        issue: 'invalid-shape',
        ...(detectedVersion ? { detectedVersion } : {}),
      }),
    }
  }
  const scenario = publicIcuScenarioManifestById.get(session.replay.scenarioId)
  if (!scenario || scenario.version !== session.replay.scenarioVersion) {
    return {
      report: sourceReport(read, 'incompatible', {
        issue: 'checkpoint-version-mismatch',
        ...(detectedVersion ? { detectedVersion } : {}),
      }),
    }
  }
  return { report: sourceReport(read, 'valid', { detectedVersion }), session }
}

function sectionForMode(mode: IcuSimulationMode): 'practice' | 'assess' | null {
  if (mode === 'practice') return 'practice'
  if (mode === 'assess') return 'assess'
  return null
}

function sessionPhase(session: IcuSyntheticSessionV1): CriticalCareActivityPhase {
  const commands = session.replay.commands
  if (commands.length === 0) return 'recognize'
  return commands.at(-1)?.command.type === 'session.complete' ? 'explain' : 'act'
}

function projectIcuProgress(
  progress: IcuSimulationProgressV1 | undefined,
  session: IcuSyntheticSessionV1 | undefined,
  activities: readonly CriticalCareActivityDefinition[],
): CriticalCareLegacyProgressResult['activities'] {
  const projections: Array<CriticalCareActivityProgress | null> = []
  if (progress) {
    const scenarioIds = new Set([
      ...Object.keys(progress.attempts),
      ...progress.completedScenarioIds,
      ...progress.masteredScenarioIds,
      ...Object.keys(progress.bestSafeScores),
    ])
    for (const rawScenarioId of scenarioIds) {
      const scenarioId = rawScenarioId as IcuScenarioFamily
      const mastered = progress.masteredScenarioIds.includes(scenarioId)
      const completed = progress.completedScenarioIds.includes(scenarioId)
      const section =
        mastered || (progress.lastScenarioId === scenarioId && progress.lastMode === 'assess')
          ? 'assess'
          : 'practice'
      const attempts = progress.attempts[scenarioId] ?? 0
      const bestScore = progress.bestSafeScores[scenarioId]
      if (!mastered && !completed && attempts === 0 && bestScore === undefined) continue
      const activity = findCatalogActivity(activities, ACTIVITY_PREFIX, section, scenarioId)
      projections.push(
        projectActivityProgress(activity, {
          status: mastered ? 'mastered' : completed ? 'completed' : 'in-progress',
          ...(progress.lastScenarioId === scenarioId ? { currentPhase: 'recognize' as const } : {}),
          mode: section === 'assess' ? 'challenge' : 'practice',
          attempts,
          ...(bestScore === undefined ? {} : { bestScore }),
          competencyEvidenceIds: mastered || completed ? activity?.competencyIds : [],
        }),
      )
    }
  }

  if (session) {
    const section = sectionForMode(session.replay.mode)
    if (section) {
      const scenarioId = session.replay.scenarioId as IcuScenarioFamily
      projections.push(
        projectActivityProgress(
          findCatalogActivity(activities, ACTIVITY_PREFIX, section, scenarioId),
          {
            status: 'in-progress',
            currentPhase: sessionPhase(session),
            mode: section === 'assess' ? 'challenge' : 'practice',
            attempts: progress?.attempts[scenarioId] ?? 0,
            ...(progress?.bestSafeScores[scenarioId] === undefined
              ? {}
              : { bestScore: progress.bestSafeScores[scenarioId] }),
          },
        ),
      )
    }
  }
  return mergeProjectedActivities(projections)
}

function progressResume(
  progress: IcuSimulationProgressV1 | undefined,
  activities: readonly CriticalCareActivityDefinition[],
) {
  if (!progress) return undefined
  const section = sectionForMode(progress.lastMode)
  if (!section) return undefined
  return makeLegacyResumePointer(
    findCatalogActivity(activities, ACTIVITY_PREFIX, section, progress.lastScenarioId),
    {
      mode: section === 'assess' ? 'challenge' : 'practice',
      phase: 'recognize',
      payloadVersion: 'icu-simulation-progress-v1',
      scenarioId: progress.lastScenarioId,
    },
  )
}

function sessionResume(
  session: IcuSyntheticSessionV1 | undefined,
  activities: readonly CriticalCareActivityDefinition[],
) {
  if (!session) return undefined
  const section = sectionForMode(session.replay.mode)
  if (!section) return undefined
  return makeLegacyResumePointer(
    findCatalogActivity(activities, ACTIVITY_PREFIX, section, session.replay.scenarioId),
    {
      mode: section === 'assess' ? 'challenge' : 'practice',
      phase: sessionPhase(session),
      payloadVersion: 'icu-simulation-session-v1',
      scenarioId: session.replay.scenarioId,
    },
  )
}

export function readIcuSimulationLegacyProgress(
  storage: CriticalCareReadableStorage | null,
  activities: readonly CriticalCareActivityDefinition[],
): CriticalCareLegacyProgressResult {
  const progress = parseIcuProgressSource(storage)
  const session = parseIcuSessionSource(storage)
  const sources = [progress.report, session.report]
  const resume =
    sessionResume(session.session, activities) ?? progressResume(progress.progress, activities)
  return legacyAdapterResult(
    MODULE_ID,
    sources,
    projectIcuProgress(progress.progress, session.session, activities),
    resume,
  )
}
