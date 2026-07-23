import { criticalCareCatalogActivityHref } from './content/activityRoutes'
import type { CriticalCarePublicClientCatalog } from './content/publicCatalogTypes'
import { getCriticalCareRecommendations } from './progress/recommendation'
import { LEGACY_PROGRESS_EPOCH, type CriticalCareProgressReadResult } from './progress/types'
import {
  resolveCriticalCareResumePointer,
  type ResolvedCriticalCareResume,
} from '@/features/learning-module/activity/resume'
import type {
  CriticalCareActivityDefinition,
  CriticalCareActivityProgress,
} from '@/features/learning-module/activity/types'

export type CriticalCareDashboardAudienceState = 'new' | 'returning' | 'incompatible'
export type CriticalCareDashboardProgressState =
  | 'not-started'
  | 'in-progress'
  | 'completed'
  | 'mastered'

export interface CriticalCareDashboardActivityLink {
  readonly activity: CriticalCareActivityDefinition
  readonly href: string
  readonly progress?: CriticalCareActivityProgress
}

export interface CriticalCareModuleProgressSummary {
  readonly module: CriticalCarePublicClientCatalog['modules'][number]
  readonly state: CriticalCareDashboardProgressState
  readonly completedActivities: number
  readonly startedActivities: number
  readonly totalActivities: number
  readonly percentComplete: number
}

export interface CriticalCarePathwayModuleMilestone {
  readonly module: CriticalCarePublicClientCatalog['modules'][number]
  readonly state: CriticalCareDashboardProgressState
  readonly completedActivities: number
  readonly totalActivities: number
}

export interface CriticalCarePathwayProgressSummary {
  readonly pathway: CriticalCarePublicClientCatalog['pathways'][number]
  readonly state: CriticalCareDashboardProgressState
  readonly completedActivities: number
  readonly totalActivities: number
  readonly completedMilestones: number
  readonly totalMilestones: number
  readonly percentComplete: number
  readonly milestones: readonly CriticalCarePathwayModuleMilestone[]
}

export interface CriticalCareDashboardModel {
  readonly audienceState: CriticalCareDashboardAudienceState
  readonly resume: ResolvedCriticalCareResume | null
  readonly recommendation: CriticalCareDashboardActivityLink | null
  readonly recent: readonly CriticalCareDashboardActivityLink[]
  readonly modules: readonly CriticalCareModuleProgressSummary[]
  readonly pathways: readonly CriticalCarePathwayProgressSummary[]
  readonly issueCount: number
}

function isComplete(progress: CriticalCareActivityProgress | undefined): boolean {
  return progress?.status === 'completed' || progress?.status === 'mastered'
}

function progressState(
  activities: readonly CriticalCareActivityDefinition[],
  progressById: ReadonlyMap<string, CriticalCareActivityProgress>,
): CriticalCareDashboardProgressState {
  const activityProgress = activities
    .map((activity) => progressById.get(activity.id))
    .filter((progress): progress is CriticalCareActivityProgress => progress !== undefined)
  if (activityProgress.length === 0) return 'not-started'

  const completedCount = activities.filter((activity) =>
    isComplete(progressById.get(activity.id)),
  ).length
  if (completedCount < activities.length) return 'in-progress'

  const assessments = activities.filter((activity) => activity.kind === 'assessment')
  if (
    assessments.length > 0 &&
    assessments.every((activity) => progressById.get(activity.id)?.status === 'mastered')
  ) {
    return 'mastered'
  }
  return 'completed'
}

export function publicCriticalCareActivityHref(activity: CriticalCareActivityDefinition): string {
  return criticalCareCatalogActivityHref(activity)
}

export function summarizePublicCriticalCareModules(
  catalog: CriticalCarePublicClientCatalog,
  progress: readonly CriticalCareActivityProgress[],
): readonly CriticalCareModuleProgressSummary[] {
  const progressById = new Map(progress.map((item) => [item.activityId, item]))
  return catalog.modules.map((module) => {
    const activities = catalog.activities.filter((activity) => activity.moduleId === module.id)
    const startedActivities = activities.filter((activity) => progressById.has(activity.id)).length
    const completedActivities = activities.filter((activity) =>
      isComplete(progressById.get(activity.id)),
    ).length
    return {
      module,
      state: progressState(activities, progressById),
      completedActivities,
      startedActivities,
      totalActivities: activities.length,
      percentComplete:
        activities.length === 0 ? 0 : Math.round((completedActivities / activities.length) * 100),
    }
  })
}

export function summarizePublicCriticalCarePathways(
  catalog: CriticalCarePublicClientCatalog,
  progress: readonly CriticalCareActivityProgress[],
): readonly CriticalCarePathwayProgressSummary[] {
  const progressById = new Map(progress.map((item) => [item.activityId, item]))
  return catalog.pathways.map((pathway) => {
    const activities = catalog.activities.filter((activity) =>
      activity.pathwayIds.includes(pathway.id),
    )
    const milestones = pathway.moduleIds.flatMap((moduleId) => {
      const moduleDefinition = catalog.modules.find((item) => item.id === moduleId)
      if (!moduleDefinition) return []
      const milestoneActivities = activities.filter((activity) => activity.moduleId === moduleId)
      const completedActivities = milestoneActivities.filter((activity) =>
        isComplete(progressById.get(activity.id)),
      ).length
      return [
        {
          module: moduleDefinition,
          state: progressState(milestoneActivities, progressById),
          completedActivities,
          totalActivities: milestoneActivities.length,
        } satisfies CriticalCarePathwayModuleMilestone,
      ]
    })
    const completedActivities = activities.filter((activity) =>
      isComplete(progressById.get(activity.id)),
    ).length
    return {
      pathway,
      state: progressState(activities, progressById),
      completedActivities,
      totalActivities: activities.length,
      completedMilestones: milestones.filter(
        (milestone) => milestone.state === 'completed' || milestone.state === 'mastered',
      ).length,
      totalMilestones: milestones.length,
      percentComplete:
        activities.length === 0 ? 0 : Math.round((completedActivities / activities.length) * 100),
      milestones,
    }
  })
}

function recentActivities(
  catalog: CriticalCarePublicClientCatalog,
  progress: readonly CriticalCareActivityProgress[],
): readonly CriticalCareDashboardActivityLink[] {
  const activityById = new Map(catalog.activities.map((activity) => [activity.id, activity]))
  return progress
    .filter(
      (item) =>
        item.updatedAt !== LEGACY_PROGRESS_EPOCH &&
        Number.isFinite(Date.parse(item.updatedAt)) &&
        activityById.has(item.activityId),
    )
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, 3)
    .flatMap((item) => {
      const activity = activityById.get(item.activityId)
      return activity
        ? [{ activity, href: publicCriticalCareActivityHref(activity), progress: item }]
        : []
    })
}

function recommendedActivity(
  catalog: CriticalCarePublicClientCatalog,
  readResult: CriticalCareProgressReadResult,
  resume: ResolvedCriticalCareResume | null,
): CriticalCareDashboardActivityLink | null {
  const recommendations = getCriticalCareRecommendations(catalog.activities, readResult.envelope, {
    allowedReviewStatuses: ['released', 'sme-review'],
    limit: 100,
  })
  const recommendation =
    recommendations.find((item) => item.activity.id !== resume?.activity.id) ?? recommendations[0]
  return recommendation
    ? {
        activity: recommendation.activity,
        href: publicCriticalCareActivityHref(recommendation.activity),
        ...(recommendation.progress ? { progress: recommendation.progress } : {}),
      }
    : null
}

export function derivePublicCriticalCareDashboard(
  catalog: CriticalCarePublicClientCatalog,
  readResult: CriticalCareProgressReadResult,
): CriticalCareDashboardModel {
  const resolvedResume = readResult.envelope.resume
    ? resolveCriticalCareResumePointer(readResult.envelope.resume, catalog.activities)
    : null
  const resume = resolvedResume
    ? {
        ...resolvedResume,
        href: publicCriticalCareActivityHref(resolvedResume.activity),
        ...(resolvedResume.activity.kind === 'assessment'
          ? {
              pointer: {
                ...resolvedResume.pointer,
                query: undefined,
                scenarioId: undefined,
                deviceId: undefined,
              },
            }
          : {}),
      }
    : null
  const hasProgress = readResult.envelope.activities.length > 0 || resume !== null
  const audienceState: CriticalCareDashboardAudienceState = hasProgress
    ? 'returning'
    : readResult.notices.length > 0
      ? 'incompatible'
      : 'new'

  return {
    audienceState,
    resume,
    recommendation: recommendedActivity(catalog, readResult, resume),
    recent: recentActivities(catalog, readResult.envelope.activities),
    modules: summarizePublicCriticalCareModules(catalog, readResult.envelope.activities),
    pathways: summarizePublicCriticalCarePathways(catalog, readResult.envelope.activities),
    issueCount: readResult.notices.length,
  }
}

export function publicCriticalCareModuleTitle(
  catalog: CriticalCarePublicClientCatalog,
  moduleId: string,
): string {
  if (moduleId === 'critical-care') return 'Unified critical-care progress'
  return (
    catalog.modules.find((candidate) => candidate.id === moduleId)?.title ?? 'Restricted module'
  )
}
