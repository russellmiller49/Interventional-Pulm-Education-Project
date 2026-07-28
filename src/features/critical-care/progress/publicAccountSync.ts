import {
  upsertCriticalCareActivityProgress,
  withCriticalCareResumePointer,
} from '@/features/learning-module/activity/progress'
import type {
  CriticalCareActivityDefinition,
  CriticalCareProgressEnvelope,
} from '@/features/learning-module/activity/types'
import { z } from 'zod'

export const CRITICAL_CARE_PUBLIC_ACCOUNT_SYNC_OWNERSHIP_KEY =
  'critical-care-account-sync-ownership-v1'

const syncSections = ['learn', 'practice', 'assess'] as const
type SyncSection = (typeof syncSections)[number]

const stableModuleIdSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-z0-9][a-z0-9-]*$/)

const coarseModuleSchema = z
  .object({
    moduleId: stableModuleIdSchema,
    percentComplete: z.number().int().min(0).max(100),
    completedSections: z.array(z.enum(syncSections)).max(3),
    completed: z.boolean(),
  })
  .strict()

const coarseBatchSchema = z
  .object({ schemaVersion: z.literal(1), modules: z.array(coarseModuleSchema).min(1).max(6) })
  .strict()

const accountModuleSchema = z
  .object({
    moduleId: stableModuleIdSchema,
    percentComplete: z.number().int().min(0).max(100),
    completedSections: z.array(z.enum(syncSections)).max(3),
    completedAt: z.string().datetime().nullable(),
    lastVisitedAt: z.string().datetime(),
  })
  .strict()

const accountProgressSchema = z
  .object({
    schemaVersion: z.literal(1),
    accountId: z.string().min(1).max(128),
    modules: z.array(accountModuleSchema).max(6),
  })
  .strict()

const ownershipSchema = z
  .object({ version: z.literal(1), accountId: z.string().min(1).max(128) })
  .strict()

export type PublicCriticalCareCoarseProgressBatch = z.infer<typeof coarseBatchSchema>
export type PublicCriticalCareCoarseAccountProgress = z.infer<typeof accountProgressSchema>

interface SyncOwnershipStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export type PublicCriticalCareAccountSyncOwnership = 'claimed' | 'owned' | 'blocked'

function activitySection(activity: CriticalCareActivityDefinition): SyncSection | null {
  const section = activity.id.split(':')[1]
  return syncSections.find((candidate) => candidate === section) ?? null
}

function isComplete(status: string): boolean {
  return status === 'completed' || status === 'mastered'
}

function allowedModuleIds(
  activities: readonly CriticalCareActivityDefinition[],
): ReadonlySet<string> {
  return new Set(activities.map((activity) => activity.moduleId))
}

export function claimPublicCriticalCareAccountSyncOwnership(
  storage: SyncOwnershipStorage | null,
  accountId: string,
): PublicCriticalCareAccountSyncOwnership {
  if (!storage || !accountId || accountId.length > 128) return 'blocked'
  try {
    const serialized = storage.getItem(CRITICAL_CARE_PUBLIC_ACCOUNT_SYNC_OWNERSHIP_KEY)
    if (serialized === null) {
      storage.setItem(
        CRITICAL_CARE_PUBLIC_ACCOUNT_SYNC_OWNERSHIP_KEY,
        JSON.stringify({ version: 1, accountId }),
      )
      return 'claimed'
    }
    const parsed = ownershipSchema.safeParse(JSON.parse(serialized))
    if (!parsed.success) return 'blocked'
    return parsed.data.accountId === accountId ? 'owned' : 'blocked'
  } catch {
    return 'blocked'
  }
}

export function projectPublicCriticalCareCoarseProgress(
  envelope: CriticalCareProgressEnvelope,
  activities: readonly CriticalCareActivityDefinition[],
): PublicCriticalCareCoarseProgressBatch | null {
  const definitionsById = new Map(activities.map((activity) => [activity.id, activity]))
  const progressById = new Map(
    envelope.activities.map((progress) => [progress.activityId, progress]),
  )
  const modules = [...allowedModuleIds(activities)].flatMap((moduleId) => {
    const moduleDefinitions = activities.filter((activity) => activity.moduleId === moduleId)
    const started = envelope.activities.some(
      (progress) =>
        progress.status !== 'not-started' &&
        definitionsById.get(progress.activityId)?.moduleId === moduleId,
    )
    if (!started || moduleDefinitions.length === 0) return []

    const completedCount = moduleDefinitions.filter((activity) =>
      isComplete(progressById.get(activity.id)?.status ?? 'not-started'),
    ).length
    const percentComplete = Math.round((completedCount / moduleDefinitions.length) * 100)
    const completedSections = syncSections.filter((section) => {
      const sectionDefinitions = moduleDefinitions.filter(
        (activity) => activitySection(activity) === section,
      )
      return (
        sectionDefinitions.length > 0 &&
        sectionDefinitions.every((activity) =>
          isComplete(progressById.get(activity.id)?.status ?? 'not-started'),
        )
      )
    })
    return [{ moduleId, percentComplete, completedSections, completed: percentComplete === 100 }]
  })

  return modules.length > 0
    ? (coarseBatchSchema.parse({
        schemaVersion: 1,
        modules,
      }) as PublicCriticalCareCoarseProgressBatch)
    : null
}

export function hydratePublicCriticalCareCoarseProgress(
  envelope: CriticalCareProgressEnvelope,
  accountProgress: PublicCriticalCareCoarseAccountProgress,
  activities: readonly CriticalCareActivityDefinition[],
): CriticalCareProgressEnvelope {
  const parsed = accountProgressSchema.safeParse(accountProgress)
  if (!parsed.success) return envelope
  const allowed = allowedModuleIds(activities)

  let hydrated = envelope
  for (const moduleProgress of parsed.data.modules) {
    if (!allowed.has(moduleProgress.moduleId)) continue
    for (const section of moduleProgress.completedSections) {
      const definitions = activities.filter(
        (activity) =>
          activity.moduleId === moduleProgress.moduleId && activitySection(activity) === section,
      )
      for (const activity of definitions) {
        hydrated = upsertCriticalCareActivityProgress(hydrated, {
          activityId: activity.id,
          status: 'completed',
          attempts: 0,
          competencyEvidenceIds: [],
          updatedAt: moduleProgress.lastVisitedAt,
        })
      }
    }
  }
  return hydrated
}

/**
 * Reconciles a catalog-scoped hydration into the latest generic envelope. Records and resume
 * pointers owned by another catalog subset remain opaque but intact.
 */
export function mergeCriticalCareSubsetProgress(
  fullEnvelope: CriticalCareProgressEnvelope,
  subsetEnvelope: CriticalCareProgressEnvelope,
): CriticalCareProgressEnvelope {
  let merged = fullEnvelope
  for (const activity of subsetEnvelope.activities) {
    merged = upsertCriticalCareActivityProgress(merged, activity)
  }
  return subsetEnvelope.resume
    ? withCriticalCareResumePointer(merged, subsetEnvelope.resume)
    : merged
}

export async function getPublicCriticalCareCoarseProgress(
  expectedAccountId: string,
  activities: readonly CriticalCareActivityDefinition[],
  fetcher: typeof fetch = fetch,
): Promise<PublicCriticalCareCoarseAccountProgress | null> {
  try {
    const response = await fetcher('/api/critical-care/progress', {
      cache: 'no-store',
      credentials: 'same-origin',
      method: 'GET',
    })
    if (!response.ok) return null
    const parsed = accountProgressSchema.safeParse(await response.json())
    if (!parsed.success || parsed.data.accountId !== expectedAccountId) return null
    const allowed = allowedModuleIds(activities)
    return {
      ...parsed.data,
      modules: parsed.data.modules.filter((module) => allowed.has(module.moduleId)),
    }
  } catch {
    return null
  }
}

export async function postPublicCriticalCareCoarseProgress(
  batch: PublicCriticalCareCoarseProgressBatch,
  expectedAccountId: string,
  activities: readonly CriticalCareActivityDefinition[],
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const parsed = coarseBatchSchema.safeParse(batch)
  const allowed = allowedModuleIds(activities)
  if (
    !parsed.success ||
    !expectedAccountId ||
    expectedAccountId.length > 128 ||
    parsed.data.modules.some((module) => !allowed.has(module.moduleId))
  ) {
    return false
  }

  try {
    const response = await fetcher('/api/critical-care/progress', {
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-Critical-Care-Sync-Account': expectedAccountId,
      },
      keepalive: true,
      method: 'POST',
    })
    return response.ok
  } catch {
    return false
  }
}
