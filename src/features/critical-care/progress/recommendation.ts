import { enforceCriticalCareProgressAuthority } from '@/features/learning-module/activity/evidence'
import type {
  CriticalCareActivityDefinition,
  CriticalCareActivityProgress,
  CriticalCareProgressEnvelope,
  CriticalCareReviewStatus,
} from '@/features/learning-module/activity/types'

export type CriticalCareRecommendationReason = 'continue' | 'next-unblocked' | 'retry-for-mastery'

export interface CriticalCareRecommendationOptions {
  readonly preferredModuleIds?: readonly string[]
  readonly preferredPathwayIds?: readonly string[]
  readonly missedCompetencyIds?: readonly string[]
  readonly allowedReviewStatuses?: readonly CriticalCareReviewStatus[]
  readonly limit?: number
}

export interface CriticalCareActivityRecommendation {
  readonly activity: CriticalCareActivityDefinition
  readonly reason: CriticalCareRecommendationReason
  readonly progress?: CriticalCareActivityProgress
}

function progressByActivityId(
  activities: readonly CriticalCareActivityDefinition[],
  envelope: CriticalCareProgressEnvelope,
): ReadonlyMap<string, CriticalCareActivityProgress> {
  const activityById = new Map(activities.map((activity) => [activity.id, activity]))
  return new Map(
    envelope.activities.flatMap((progress) => {
      const activity = activityById.get(progress.activityId)
      return activity
        ? [[progress.activityId, enforceCriticalCareProgressAuthority(activity, progress)] as const]
        : []
    }),
  )
}

function recommendationReason(
  activity: CriticalCareActivityDefinition,
  progress: CriticalCareActivityProgress | undefined,
): CriticalCareRecommendationReason | null {
  if (progress?.status === 'in-progress') return 'continue'
  if (!progress || progress.status === 'not-started') return 'next-unblocked'
  if (progress.status === 'completed' && activity.masteryRuleId) return 'retry-for-mastery'
  return null
}

export function getCriticalCareRecommendations(
  activities: readonly CriticalCareActivityDefinition[],
  envelope: CriticalCareProgressEnvelope,
  options: CriticalCareRecommendationOptions = {},
): readonly CriticalCareActivityRecommendation[] {
  const progress = progressByActivityId(activities, envelope)
  const preferredModules = new Set(options.preferredModuleIds ?? [])
  const preferredPathways = new Set(options.preferredPathwayIds ?? [])
  const missedCompetencies = new Set(options.missedCompetencyIds ?? [])
  const allowedReviewStatuses = options.allowedReviewStatuses
    ? new Set(options.allowedReviewStatuses)
    : null

  const ranked = activities.flatMap((activity, catalogIndex) => {
    if (allowedReviewStatuses && !allowedReviewStatuses.has(activity.reviewStatus)) return []
    const activityProgress = progress.get(activity.id)
    const reason = recommendationReason(activity, activityProgress)
    if (!reason) return []

    const phaseRank = reason === 'continue' ? 0 : reason === 'next-unblocked' ? 1 : 2
    const missedMatchCount = activity.competencyIds.filter((id) =>
      missedCompetencies.has(id),
    ).length
    const preferredModule = preferredModules.has(activity.moduleId) ? 1 : 0
    const preferredPathway = activity.pathwayIds.some((id) => preferredPathways.has(id)) ? 1 : 0
    return [
      {
        recommendation: {
          activity,
          reason,
          ...(activityProgress ? { progress: activityProgress } : {}),
        } satisfies CriticalCareActivityRecommendation,
        phaseRank,
        missedMatchCount,
        preferredModule,
        preferredPathway,
        catalogIndex,
      },
    ]
  })

  ranked.sort(
    (left, right) =>
      left.phaseRank - right.phaseRank ||
      right.missedMatchCount - left.missedMatchCount ||
      right.preferredModule - left.preferredModule ||
      right.preferredPathway - left.preferredPathway ||
      left.catalogIndex - right.catalogIndex ||
      left.recommendation.activity.id.localeCompare(right.recommendation.activity.id),
  )

  const limit = Math.max(0, Math.min(100, Math.trunc(options.limit ?? 1)))
  return ranked.slice(0, limit).map((item) => item.recommendation)
}

export function getCriticalCareRecommendation(
  activities: readonly CriticalCareActivityDefinition[],
  envelope: CriticalCareProgressEnvelope,
  options: Omit<CriticalCareRecommendationOptions, 'limit'> = {},
): CriticalCareActivityRecommendation | null {
  return getCriticalCareRecommendations(activities, envelope, { ...options, limit: 1 })[0] ?? null
}
