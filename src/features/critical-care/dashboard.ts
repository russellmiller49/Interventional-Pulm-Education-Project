import {
  criticalCareActivities,
  criticalCareActivityById,
} from '@/features/critical-care/content/activities'
import { criticalCareCatalogActivityHref } from '@/features/critical-care/content/activityRoutes'
import {
  criticalCareModuleCatalog,
  type CriticalCareCatalogModuleDefinition,
  type CriticalCareCatalogModuleId,
} from '@/features/critical-care/content/modules'
import {
  criticalCarePathways,
  type CriticalCarePathwayDefinition,
} from '@/features/critical-care/content/pathways'
import {
  isCriticalCareActivityPubliclyCataloged,
  isCriticalCareModulePubliclyCataloged,
  presentCriticalCareActivityPublicly,
  sanitizeCriticalCareActivityForPublicCatalog,
} from '@/features/critical-care/content/publicVisibility'
import { getCriticalCareRecommendations } from '@/features/critical-care/progress/recommendation'
import type { CriticalCareProgressReadResult } from '@/features/critical-care/progress/types'
import {
  resolveCriticalCareResumePointer,
  type CriticalCareActivityDefinition,
  type CriticalCareActivityProgress,
  type ResolvedCriticalCareResume,
} from '@/features/learning-module/activity'

import { LEGACY_PROGRESS_EPOCH } from './progress/types'

const publicCatalogActivities = criticalCareActivities.filter(
  isCriticalCareActivityPubliclyCataloged,
)
const publicCatalogModules = criticalCareModuleCatalog.filter((module) =>
  isCriticalCareModulePubliclyCataloged(module.id),
)

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
  readonly module: CriticalCareCatalogModuleDefinition
  readonly state: CriticalCareDashboardProgressState
  readonly completedActivities: number
  readonly startedActivities: number
  readonly totalActivities: number
  readonly percentComplete: number
}

export interface CriticalCarePathwayModuleMilestone {
  readonly module: CriticalCareCatalogModuleDefinition
  readonly state: CriticalCareDashboardProgressState
  readonly completedActivities: number
  readonly totalActivities: number
}

export interface CriticalCarePathwayProgressSummary {
  readonly pathway: CriticalCarePathwayDefinition
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

export function criticalCareActivityHref(activity: CriticalCareActivityDefinition): string {
  return criticalCareCatalogActivityHref(activity)
}

export function summarizeCriticalCareModules(
  progress: readonly CriticalCareActivityProgress[],
): readonly CriticalCareModuleProgressSummary[] {
  const progressById = new Map(progress.map((item) => [item.activityId, item]))
  return publicCatalogModules.map((module) => {
    const activities = publicCatalogActivities.filter((activity) => activity.moduleId === module.id)
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

export function summarizeCriticalCarePathways(
  progress: readonly CriticalCareActivityProgress[],
): readonly CriticalCarePathwayProgressSummary[] {
  const progressById = new Map(progress.map((item) => [item.activityId, item]))
  return criticalCarePathways.map((pathway) => {
    const activities = publicCatalogActivities.filter((activity) =>
      activity.pathwayIds.includes(pathway.id),
    )
    const milestones = pathway.moduleIds.flatMap((moduleId) => {
      const moduleDefinition = publicCatalogModules.find((item) => item.id === moduleId)
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
  progress: readonly CriticalCareActivityProgress[],
): readonly CriticalCareDashboardActivityLink[] {
  return progress
    .filter(
      (item) =>
        item.updatedAt !== LEGACY_PROGRESS_EPOCH &&
        Number.isFinite(Date.parse(item.updatedAt)) &&
        criticalCareActivityById.has(item.activityId),
    )
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, 3)
    .flatMap((item) => {
      const activity = criticalCareActivityById.get(item.activityId)
      if (!activity || !isCriticalCareActivityPubliclyCataloged(activity)) return []
      const presentation = presentCriticalCareActivityPublicly(activity)
      return activity
        ? [
            {
              activity: sanitizeCriticalCareActivityForPublicCatalog(activity),
              href: presentation.href,
              progress: item,
            },
          ]
        : []
    })
}

function recommendedActivity(
  readResult: CriticalCareProgressReadResult,
  resume: ResolvedCriticalCareResume | null,
): CriticalCareDashboardActivityLink | null {
  const recommendations = getCriticalCareRecommendations(
    publicCatalogActivities,
    readResult.envelope,
    {
      allowedReviewStatuses: ['released', 'sme-review'],
      limit: 100,
    },
  )
  const recommendation =
    recommendations.find((item) => item.activity.id !== resume?.activity.id) ?? recommendations[0]
  return recommendation
    ? {
        activity: sanitizeCriticalCareActivityForPublicCatalog(recommendation.activity),
        href: presentCriticalCareActivityPublicly(recommendation.activity).href,
        ...(recommendation.progress ? { progress: recommendation.progress } : {}),
      }
    : null
}

export function deriveCriticalCareDashboard(
  readResult: CriticalCareProgressReadResult,
): CriticalCareDashboardModel {
  const resolvedResume = readResult.envelope.resume
    ? resolveCriticalCareResumePointer(readResult.envelope.resume, publicCatalogActivities)
    : null
  const resume = resolvedResume
    ? {
        ...resolvedResume,
        activity: sanitizeCriticalCareActivityForPublicCatalog(resolvedResume.activity),
        href: presentCriticalCareActivityPublicly(resolvedResume.activity).href,
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
    recommendation: recommendedActivity(readResult, resume),
    recent: recentActivities(readResult.envelope.activities),
    modules: summarizeCriticalCareModules(readResult.envelope.activities),
    pathways: summarizeCriticalCarePathways(readResult.envelope.activities),
    issueCount: readResult.notices.length,
  }
}

export function moduleProgressForPathway(
  pathwayId: string,
  progress: readonly CriticalCareActivityProgress[],
): readonly CriticalCarePathwayModuleMilestone[] {
  return (
    summarizeCriticalCarePathways(progress).find((item) => item.pathway.id === pathwayId)
      ?.milestones ?? []
  )
}

export function criticalCareModuleTitle(moduleId: string): string {
  if (moduleId === 'critical-care') return 'Unified critical-care progress'
  const moduleDefinition = criticalCareModuleCatalog.find(
    (candidate) => candidate.id === (moduleId as CriticalCareCatalogModuleId),
  )
  if (moduleDefinition && !isCriticalCareModulePubliclyCataloged(moduleDefinition.id)) {
    return 'Restricted module'
  }
  return moduleDefinition?.title ?? moduleId
}
