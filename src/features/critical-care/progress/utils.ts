import type {
  CriticalCareActivityDefinition,
  CriticalCareActivityMode,
  CriticalCareActivityPhase,
  CriticalCareActivityProgress,
  CriticalCareActivityStatus,
  CriticalCareResumePointer,
} from '@/features/learning-module/activity'

import {
  LEGACY_PROGRESS_EPOCH,
  type CriticalCareLegacyProgressResult,
  type CriticalCareProgressSourceIssue,
  type CriticalCareProgressSourceReport,
  type CriticalCareProgressSourceStatus,
  type CriticalCareReadableStorage,
} from './types'

const MAX_NORMALIZED_COUNTER = 10_000

const statusRank: Readonly<Record<CriticalCareActivityStatus, number>> = {
  'not-started': 0,
  'in-progress': 1,
  completed: 2,
  mastered: 3,
}

export interface StoredValueRead {
  readonly raw: string | null
  readonly report: CriticalCareProgressSourceReport
}

export type StoredJsonRead =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly issue: 'invalid-json' }

export function readStoredValue(
  storage: CriticalCareReadableStorage | null,
  moduleId: string,
  storageKey: string,
): StoredValueRead {
  if (!storage) {
    return {
      raw: null,
      report: { moduleId, storageKey, status: 'empty' },
    }
  }
  try {
    const raw = storage.getItem(storageKey)
    return {
      raw,
      report: {
        moduleId,
        storageKey,
        status: raw === null ? 'empty' : 'valid',
      },
    }
  } catch {
    return {
      raw: null,
      report: {
        moduleId,
        storageKey,
        status: 'corrupt',
        issue: 'storage-read-failed',
      },
    }
  }
}

export function parseStoredJson(raw: string): StoredJsonRead {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown }
  } catch {
    return { ok: false, issue: 'invalid-json' }
  }
}

export function versionLabel(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return undefined
}

export function sourceReport(
  read: StoredValueRead,
  status: CriticalCareProgressSourceStatus,
  options: {
    readonly issue?: CriticalCareProgressSourceIssue
    readonly detectedVersion?: string
  } = {},
): CriticalCareProgressSourceReport {
  return {
    moduleId: read.report.moduleId,
    storageKey: read.report.storageKey,
    status,
    ...(options.issue ? { issue: options.issue } : {}),
    ...(options.detectedVersion ? { detectedVersion: options.detectedVersion } : {}),
  }
}

export function aggregateSourceStatus(
  sources: readonly CriticalCareProgressSourceReport[],
): CriticalCareProgressSourceStatus {
  if (sources.some((source) => source.status === 'valid')) return 'valid'
  if (sources.every((source) => source.status === 'empty')) return 'empty'
  if (sources.some((source) => source.status === 'incompatible')) return 'incompatible'
  return 'corrupt'
}

export function activityCatalogId(prefix: string, section: string, sourceId: string): string {
  return `${prefix}:${section}:${sourceId}`
}

export function findCatalogActivity(
  activities: readonly CriticalCareActivityDefinition[],
  prefix: string,
  section: string,
  sourceId: string,
): CriticalCareActivityDefinition | undefined {
  const id = activityCatalogId(prefix, section, sourceId)
  return activities.find((activity) => activity.id === id)
}

export function projectActivityProgress(
  activity: CriticalCareActivityDefinition | undefined,
  input: {
    readonly status: Exclude<CriticalCareActivityStatus, 'not-started'>
    readonly currentPhase?: CriticalCareActivityPhase
    readonly mode?: CriticalCareActivityMode
    readonly bestScore?: number
    readonly attempts?: number
    readonly hintCount?: number
    readonly competencyEvidenceIds?: readonly string[]
  },
): CriticalCareActivityProgress | null {
  if (!activity) return null
  return {
    activityId: activity.id,
    status: input.status,
    ...(input.currentPhase ? { currentPhase: input.currentPhase } : {}),
    ...(input.mode ? { mode: input.mode } : {}),
    ...(input.bestScore !== undefined
      ? { bestScore: Math.min(100, Math.max(0, Math.round(input.bestScore))) }
      : {}),
    attempts: boundedCounter(input.attempts ?? 0),
    ...(input.hintCount !== undefined ? { hintCount: boundedCounter(input.hintCount) } : {}),
    competencyEvidenceIds: [...new Set(input.competencyEvidenceIds ?? [])].slice(0, 100),
    updatedAt: LEGACY_PROGRESS_EPOCH,
  }
}

export function makeLegacyResumePointer(
  activity: CriticalCareActivityDefinition | undefined,
  input: {
    readonly mode: CriticalCareActivityMode
    readonly phase: CriticalCareActivityPhase
    readonly payloadVersion: string
    readonly query?: Readonly<Record<string, string>>
    readonly scenarioId?: string
    readonly deviceId?: string
    readonly checkpointId?: string
  },
): CriticalCareResumePointer | undefined {
  if (!activity || !activity.supportedModes.includes(input.mode)) return undefined
  return {
    activityId: activity.id,
    pathname: activity.pathname,
    ...((input.query ?? activity.query) ? { query: input.query ?? activity.query } : {}),
    mode: input.mode,
    phase: input.phase,
    ...(input.scenarioId ? { scenarioId: input.scenarioId } : {}),
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    ...(input.checkpointId ? { checkpointId: input.checkpointId } : {}),
    payloadVersion: input.payloadVersion,
    updatedAt: LEGACY_PROGRESS_EPOCH,
  }
}

export function mergeProjectedActivities(
  progressItems: readonly (CriticalCareActivityProgress | null | undefined)[],
): readonly CriticalCareActivityProgress[] {
  const merged = new Map<string, CriticalCareActivityProgress>()
  for (const incoming of progressItems) {
    if (!incoming) continue
    const existing = merged.get(incoming.activityId)
    if (!existing) {
      merged.set(incoming.activityId, incoming)
      continue
    }
    const bestStatus =
      statusRank[incoming.status] > statusRank[existing.status] ? incoming.status : existing.status
    const bestScore =
      existing.bestScore === undefined && incoming.bestScore === undefined
        ? undefined
        : Math.max(existing.bestScore ?? 0, incoming.bestScore ?? 0)
    const hintCount =
      existing.hintCount === undefined && incoming.hintCount === undefined
        ? undefined
        : Math.max(existing.hintCount ?? 0, incoming.hintCount ?? 0)
    merged.set(incoming.activityId, {
      ...existing,
      ...incoming,
      status: bestStatus,
      attempts: Math.max(existing.attempts, incoming.attempts),
      ...(bestScore === undefined ? {} : { bestScore }),
      ...(hintCount === undefined ? {} : { hintCount }),
      competencyEvidenceIds: [
        ...new Set([...existing.competencyEvidenceIds, ...incoming.competencyEvidenceIds]),
      ],
      updatedAt:
        incoming.updatedAt.localeCompare(existing.updatedAt) > 0
          ? incoming.updatedAt
          : existing.updatedAt,
    })
  }
  return [...merged.values()]
}

export function boundedCounter(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(MAX_NORMALIZED_COUNTER, Math.max(0, Math.trunc(value)))
}

export function sumBoundedCounters(values: readonly number[]): number {
  return boundedCounter(values.reduce((total, value) => total + boundedCounter(value), 0))
}

export function activityModeForSection(
  section: 'learn' | 'practice' | 'assess',
): CriticalCareActivityMode {
  if (section === 'learn') return 'guided'
  if (section === 'assess') return 'challenge'
  return 'practice'
}

export function legacyAdapterResult(
  moduleId: string,
  sources: readonly CriticalCareProgressSourceReport[],
  activities: readonly CriticalCareActivityProgress[],
  resume?: CriticalCareResumePointer,
): CriticalCareLegacyProgressResult {
  return {
    moduleId,
    status: aggregateSourceStatus(sources),
    sources,
    activities,
    ...(resume ? { resume } : {}),
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isStableLegacyId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 160 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)
  )
}
