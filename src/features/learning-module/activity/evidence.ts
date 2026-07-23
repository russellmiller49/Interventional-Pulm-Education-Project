import type {
  CriticalCareActivityDefinition,
  CriticalCareActivityProgress,
  CriticalCareActivityStatus,
} from './types'

function hasCompletionEvidence(activity: CriticalCareActivityDefinition): boolean {
  return activity.completionEvidenceAuthority !== 'none'
}

export function authoritativeCriticalCareStatus(
  activity: CriticalCareActivityDefinition,
  requestedStatus: CriticalCareActivityStatus,
): CriticalCareActivityStatus {
  if (
    (requestedStatus === 'completed' || requestedStatus === 'mastered') &&
    !hasCompletionEvidence(activity)
  ) {
    return 'in-progress'
  }
  if (requestedStatus === 'mastered' && activity.reviewStatus === 'draft') {
    return 'completed'
  }
  return requestedStatus
}

export function authoritativeCriticalCareCompetencyEvidence(
  activity: CriticalCareActivityDefinition,
  requestedCompetencyIds: readonly string[],
): readonly string[] {
  if (
    activity.creditPolicy !== 'competency-eligible' ||
    activity.reviewStatus === 'draft' ||
    !hasCompletionEvidence(activity)
  ) {
    return []
  }
  const allowed = new Set(activity.competencyIds)
  return [...new Set(requestedCompetencyIds.filter((id) => allowed.has(id)))]
}

export function enforceCriticalCareProgressAuthority(
  activity: CriticalCareActivityDefinition,
  progress: CriticalCareActivityProgress,
): CriticalCareActivityProgress {
  const status = authoritativeCriticalCareStatus(activity, progress.status)
  const competencyEvidenceIds =
    status === 'completed' || status === 'mastered'
      ? authoritativeCriticalCareCompetencyEvidence(activity, progress.competencyEvidenceIds)
      : []
  return {
    ...progress,
    status,
    competencyEvidenceIds,
  }
}
