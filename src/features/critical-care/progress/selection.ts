import {
  criticalCareActivities,
  criticalCareActivityById,
} from '@/features/critical-care/content/activities'
import {
  readCriticalCareProgress,
  upsertCriticalCareActivityProgress,
  writeCriticalCareProgress,
  type CriticalCareActivityDefinition,
  type CriticalCareActivityMode,
  type CriticalCareActivityPhase,
  type CriticalCareStorageLike,
} from '@/features/learning-module/activity'

interface CriticalCareActivitySelection {
  readonly activityId: string
  readonly mode: CriticalCareActivityMode
  readonly phase?: CriticalCareActivityPhase
  readonly query?: Readonly<Record<string, string>>
  readonly scenarioId?: string
  readonly deviceId?: string
  readonly checkpointId?: string
  readonly payloadVersion: string
}

function queryMatchesCatalog(
  activity: CriticalCareActivityDefinition,
  query: Readonly<Record<string, string>> | undefined,
): boolean {
  return Object.entries(activity.query ?? {}).every(([key, value]) => query?.[key] === value)
}

/**
 * Records only an explicit activity selection. It does not grant completion,
 * mastery, attempts, scores, hints, or competency evidence.
 */
export function recordCriticalCareActivitySelection(
  storage: CriticalCareStorageLike | null,
  input: CriticalCareActivitySelection,
  now = new Date().toISOString(),
  activities: readonly CriticalCareActivityDefinition[] = criticalCareActivities,
): boolean {
  const activity =
    activities === criticalCareActivities
      ? criticalCareActivityById.get(input.activityId)
      : activities.find((candidate) => candidate.id === input.activityId)
  const query = input.query ?? activity?.query
  if (
    !storage ||
    !activity ||
    !activity.supportedModes.includes(input.mode) ||
    !queryMatchesCatalog(activity, query)
  ) {
    return false
  }

  try {
    const envelope = readCriticalCareProgress(storage)
    const existing = envelope.activities.find((item) => item.activityId === activity.id)
    const next = upsertCriticalCareActivityProgress(
      envelope,
      {
        activityId: activity.id,
        status: 'in-progress',
        currentPhase: input.phase ?? 'recognize',
        mode: input.mode,
        attempts: existing?.attempts ?? 0,
        competencyEvidenceIds: [],
        updatedAt: now,
      },
      {
        activityId: activity.id,
        pathname: activity.pathname,
        ...(query ? { query } : {}),
        mode: input.mode,
        phase: input.phase ?? 'recognize',
        ...(input.scenarioId ? { scenarioId: input.scenarioId } : {}),
        ...(input.deviceId ? { deviceId: input.deviceId } : {}),
        ...(input.checkpointId ? { checkpointId: input.checkpointId } : {}),
        payloadVersion: input.payloadVersion,
        updatedAt: now,
      },
    )
    return writeCriticalCareProgress(storage, next)
  } catch {
    return false
  }
}
