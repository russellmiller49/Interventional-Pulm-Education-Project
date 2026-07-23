import { criticalCareActivities } from '@/features/critical-care/content/activities'
import type {
  CriticalCareActivityDefinition,
  CriticalCareProgressEnvelope,
} from '@/features/learning-module/activity'
import { upsertCriticalCareActivityProgress } from '@/features/learning-module/activity'
import {
  criticalCareAccountSyncModuleIds,
  criticalCareAccountSyncSections,
  criticalCareCoarseAccountProgressSchema,
  criticalCareCoarseProgressBatchSchema,
  type CriticalCareAccountSyncModuleId,
  type CriticalCareAccountSyncSection,
  type CriticalCareCoarseAccountProgress,
  type CriticalCareCoarseProgressBatch,
} from '@/lib/critical-care-progress-sync'
import { z } from 'zod'

export const CRITICAL_CARE_ACCOUNT_SYNC_OWNERSHIP_KEY = 'critical-care-account-sync-ownership-v1'

const criticalCareAccountSyncOwnershipSchema = z
  .object({
    version: z.literal(1),
    accountId: z.string().min(1).max(128),
  })
  .strict()

interface SyncOwnershipStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export type CriticalCareAccountSyncOwnership = 'claimed' | 'owned' | 'blocked'

function activitySection(
  activity: CriticalCareActivityDefinition,
): CriticalCareAccountSyncSection | null {
  const section = activity.id.split(':')[1]
  return criticalCareAccountSyncSections.find((candidate) => candidate === section) ?? null
}

function isComplete(status: string): boolean {
  return status === 'completed' || status === 'mastered'
}

/**
 * The first signed-in learner explicitly claims existing anonymous progress.
 * A different account is then fail-closed, preventing a shared browser from
 * uploading the first learner's local module records to the second account.
 */
export function claimCriticalCareAccountSyncOwnership(
  storage: SyncOwnershipStorage | null,
  accountId: string,
): CriticalCareAccountSyncOwnership {
  if (!storage || !accountId || accountId.length > 128) return 'blocked'
  try {
    const serialized = storage.getItem(CRITICAL_CARE_ACCOUNT_SYNC_OWNERSHIP_KEY)
    if (serialized === null) {
      storage.setItem(
        CRITICAL_CARE_ACCOUNT_SYNC_OWNERSHIP_KEY,
        JSON.stringify({ version: 1, accountId }),
      )
      return 'claimed'
    }
    const parsed = criticalCareAccountSyncOwnershipSchema.safeParse(JSON.parse(serialized))
    if (!parsed.success) return 'blocked'
    return parsed.data.accountId === accountId ? 'owned' : 'blocked'
  } catch {
    return 'blocked'
  }
}

export function projectCriticalCareCoarseProgress(
  envelope: CriticalCareProgressEnvelope,
  activities: readonly CriticalCareActivityDefinition[] = criticalCareActivities,
  includeDraftModuleIds: readonly string[] = [],
): CriticalCareCoarseProgressBatch | null {
  const definitionsById = new Map(activities.map((activity) => [activity.id, activity]))
  const progressById = new Map(
    envelope.activities.map((progress) => [progress.activityId, progress]),
  )
  const modules = criticalCareAccountSyncModuleIds.flatMap((moduleId) => {
    const moduleDefinitions = activities.filter(
      (activity) =>
        activity.moduleId === moduleId &&
        (activity.reviewStatus !== 'draft' || includeDraftModuleIds.includes(moduleId)),
    )
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
    const completedSections = criticalCareAccountSyncSections.filter((section) => {
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

    return [
      {
        moduleId: moduleId as CriticalCareAccountSyncModuleId,
        percentComplete,
        completedSections,
        completed: percentComplete === 100,
      },
    ]
  })

  if (modules.length === 0) return null
  return criticalCareCoarseProgressBatchSchema.parse({ schemaVersion: 1, modules })
}

/**
 * Restore only identities justified by an explicitly completed server section.
 * A percentage by itself never guesses which partial activities were completed,
 * and coarse account data never manufactures mastery, attempts, scores, or replay.
 */
export function hydrateCriticalCareCoarseProgress(
  envelope: CriticalCareProgressEnvelope,
  accountProgress: CriticalCareCoarseAccountProgress,
  activities: readonly CriticalCareActivityDefinition[] = criticalCareActivities,
): CriticalCareProgressEnvelope {
  const parsed = criticalCareCoarseAccountProgressSchema.safeParse(accountProgress)
  if (!parsed.success) return envelope

  let hydrated = envelope
  for (const moduleProgress of parsed.data.modules) {
    for (const section of moduleProgress.completedSections) {
      const completedDefinitions = activities.filter(
        (activity) =>
          activity.moduleId === moduleProgress.moduleId && activitySection(activity) === section,
      )
      for (const activity of completedDefinitions) {
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

export async function getCriticalCareCoarseProgress(
  expectedAccountId: string,
  fetcher: typeof fetch = fetch,
): Promise<CriticalCareCoarseAccountProgress | null> {
  try {
    const response = await fetcher('/api/critical-care/progress', {
      cache: 'no-store',
      credentials: 'same-origin',
      method: 'GET',
    })
    if (!response.ok) return null
    const parsed = criticalCareCoarseAccountProgressSchema.safeParse(await response.json())
    if (!parsed.success || parsed.data.accountId !== expectedAccountId) return null
    return parsed.data
  } catch {
    return null
  }
}

export async function postCriticalCareCoarseProgress(
  batch: CriticalCareCoarseProgressBatch,
  expectedAccountId: string,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const parsed = criticalCareCoarseProgressBatchSchema.safeParse(batch)
  if (!parsed.success || !expectedAccountId || expectedAccountId.length > 128) return false

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
