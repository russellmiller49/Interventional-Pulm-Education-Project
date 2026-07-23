import {
  criticalCareActivities,
  criticalCareActivityById,
} from '@/features/critical-care/content/activities'
import { criticalCareCatalogActivityHref } from '@/features/critical-care/content/activityRoutes'
import {
  criticalCareIcuScenarioPreparation,
  criticalCareIcuScenarioPreparationById,
  type CriticalCareIcuPreparationRequirement,
  type CriticalCarePathwayId,
} from '@/features/critical-care/content/pathways'
import { icuScenarioFamilies, type IcuScenarioFamily } from '@/features/icu-simulation/engine/types'
import {
  CRITICAL_CARE_PROGRESS_CHANGED_EVENT,
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
  authoritativeCriticalCareCompetencyEvidence,
  authoritativeCriticalCareStatus,
  createEmptyCriticalCareProgress,
  parseSerializedCriticalCareProgress,
  upsertCriticalCareActivityProgress,
  withoutCriticalCareResumePointer,
  writeCriticalCareProgress,
  type CriticalCareActivityDefinition,
  type CriticalCareActivityProgress,
  type CriticalCareProgressEnvelope,
  type CriticalCareStorageLike,
} from '@/features/learning-module/activity'

import {
  CRITICAL_CARE_INTEGRATED_OUTCOMES_MAX_COURSES,
  CRITICAL_CARE_INTEGRATED_OUTCOMES_STORAGE_KEY,
  CRITICAL_CARE_INTEGRATED_OUTCOMES_VERSION,
  type CriticalCareIntegratedCaseOutcomeSummary,
} from './types'
import { boundedCounter } from './utils'

export interface CriticalCareIcuRefresher {
  readonly activity: CriticalCareActivityDefinition
  readonly href: string
  /** Only released, competency-eligible activities can participate in a hard Assess gate. */
  readonly approvedForAssessGate: boolean
}

export interface CriticalCareIcuRequirementStatus extends CriticalCareIcuPreparationRequirement {
  /** Authoritative completion of a released or SME-reviewed preparation activity. */
  readonly completed: boolean
  /** True only when this group contains at least one released activity eligible for hard gating. */
  readonly countsForAssessGate: boolean
  /** Pending-review groups are advisory and therefore never hard-lock a course. */
  readonly assessGateSatisfied: boolean
  readonly refreshers: readonly CriticalCareIcuRefresher[]
}

export interface CriticalCareIcuScenarioReadiness {
  readonly scenarioId: IcuScenarioFamily
  readonly pathwayIds: readonly CriticalCarePathwayId[]
  readonly requirements: readonly CriticalCareIcuRequirementStatus[]
  readonly completedRequirementCount: number
  readonly totalRequirementCount: number
  readonly percentReady: number
  readonly approvedGateRequirementCount: number
  readonly satisfiedApprovedGateRequirementCount: number
  readonly gateStatus: 'preview-open' | 'approved'
  readonly eligibleForAssess: boolean
}

export interface CriticalCareIcuScenarioRecommendation {
  readonly scenarioId: IcuScenarioFamily
  readonly readiness: CriticalCareIcuScenarioReadiness
  readonly reason: 'foundation' | 'focused-alignment' | 'assess-ready'
}

export interface RecordCriticalCareIcuOutcomeInput {
  readonly scenarioId: IcuScenarioFamily
  readonly mode: 'practice' | 'assess'
  readonly score: number
  readonly mastered: boolean
  readonly attempts: number
  readonly now?: string
}

function isCompletedStatus(status: CriticalCareActivityProgress['status'] | undefined): boolean {
  return status === 'completed' || status === 'mastered'
}

function hasAuthoritativeCompletion(
  activity: CriticalCareActivityDefinition | undefined,
  progress: CriticalCareActivityProgress | undefined,
): boolean {
  if (!activity || !progress) return false
  return isCompletedStatus(authoritativeCriticalCareStatus(activity, progress.status))
}

function isReviewedPreparationActivity(
  activity: CriticalCareActivityDefinition | undefined,
): activity is CriticalCareActivityDefinition {
  return Boolean(
    activity &&
    activity.reviewStatus !== 'draft' &&
    activity.completionEvidenceAuthority !== 'none' &&
    activity.creditPolicy === 'competency-eligible',
  )
}

export function isCriticalCareIcuAssessGateActivityApproved(
  activity: CriticalCareActivityDefinition | undefined,
): activity is CriticalCareActivityDefinition {
  return Boolean(isReviewedPreparationActivity(activity) && activity.reviewStatus === 'released')
}

function activityHref(activity: CriticalCareActivityDefinition): string {
  return criticalCareCatalogActivityHref(activity)
}

function progressByActivityId(
  envelope: CriticalCareProgressEnvelope,
): ReadonlyMap<string, CriticalCareActivityProgress> {
  return new Map(envelope.activities.map((progress) => [progress.activityId, progress]))
}

export function isIcuScenarioFamily(value: string | undefined): value is IcuScenarioFamily {
  return Boolean(value && (icuScenarioFamilies as readonly string[]).includes(value))
}

export function getCriticalCareIcuScenarioReadiness(
  scenarioId: IcuScenarioFamily,
  envelope: CriticalCareProgressEnvelope,
): CriticalCareIcuScenarioReadiness {
  const preparation = criticalCareIcuScenarioPreparationById.get(scenarioId)
  if (!preparation) {
    return {
      scenarioId,
      pathwayIds: [],
      requirements: [],
      completedRequirementCount: 0,
      totalRequirementCount: 0,
      percentReady: 0,
      approvedGateRequirementCount: 0,
      satisfiedApprovedGateRequirementCount: 0,
      gateStatus: 'preview-open',
      eligibleForAssess: false,
    }
  }

  const progress = progressByActivityId(envelope)
  const requirements = preparation.assessRequirements.map((requirement) => {
    const reviewedActivities = requirement.anyOfActivityIds.flatMap((activityId) => {
      const activity = criticalCareActivityById.get(activityId)
      return isReviewedPreparationActivity(activity) ? [activity] : []
    })
    const approvedActivities = reviewedActivities.filter(
      isCriticalCareIcuAssessGateActivityApproved,
    )
    const completed = reviewedActivities.some((activity) =>
      hasAuthoritativeCompletion(activity, progress.get(activity.id)),
    )
    const countsForAssessGate = approvedActivities.length > 0
    const assessGateSatisfied =
      !countsForAssessGate ||
      approvedActivities.some((activity) =>
        hasAuthoritativeCompletion(activity, progress.get(activity.id)),
      )

    return {
      ...requirement,
      completed,
      countsForAssessGate,
      assessGateSatisfied,
      refreshers: requirement.anyOfActivityIds.flatMap((activityId) => {
        const activity = criticalCareActivityById.get(activityId)
        return activity
          ? [
              {
                activity,
                href: activityHref(activity),
                approvedForAssessGate: isCriticalCareIcuAssessGateActivityApproved(activity),
              },
            ]
          : []
      }),
    }
  })
  const completedRequirementCount = requirements.filter(
    (requirement) => requirement.completed,
  ).length
  const totalRequirementCount = requirements.length
  const approvedGateRequirementCount = requirements.filter(
    (requirement) => requirement.countsForAssessGate,
  ).length
  const satisfiedApprovedGateRequirementCount = requirements.filter(
    (requirement) => requirement.countsForAssessGate && requirement.assessGateSatisfied,
  ).length

  return {
    scenarioId,
    pathwayIds: preparation.pathwayIds,
    requirements,
    completedRequirementCount,
    totalRequirementCount,
    percentReady:
      totalRequirementCount === 0
        ? 0
        : Math.round((completedRequirementCount / totalRequirementCount) * 100),
    approvedGateRequirementCount,
    satisfiedApprovedGateRequirementCount,
    gateStatus: approvedGateRequirementCount > 0 ? 'approved' : 'preview-open',
    eligibleForAssess:
      totalRequirementCount > 0 &&
      requirements.every((requirement) => requirement.assessGateSatisfied),
  }
}

function pathwayAlignmentScore(
  pathwayIds: readonly CriticalCarePathwayId[],
  progress: ReadonlyMap<string, CriticalCareActivityProgress>,
): number {
  return criticalCareActivities.reduce((score, activity) => {
    if (activity.moduleId === 'icu-simulation') return score
    if (
      !activity.pathwayIds.some((pathwayId) =>
        pathwayIds.includes(pathwayId as CriticalCarePathwayId),
      )
    ) {
      return score
    }
    return score + (hasAuthoritativeCompletion(activity, progress.get(activity.id)) ? 1 : 0)
  }, 0)
}

export function getCriticalCareIcuScenarioRecommendation(
  envelope: CriticalCareProgressEnvelope,
): CriticalCareIcuScenarioRecommendation {
  const progress = progressByActivityId(envelope)
  const hasFocusedCompletion = criticalCareActivities.some(
    (activity) =>
      activity.moduleId !== 'icu-simulation' &&
      isReviewedPreparationActivity(activity) &&
      hasAuthoritativeCompletion(activity, progress.get(activity.id)),
  )

  const ranked = criticalCareIcuScenarioPreparation.map((preparation, catalogIndex) => {
    const readiness = getCriticalCareIcuScenarioReadiness(preparation.scenarioId, envelope)
    const assessmentActivityId = `icu:assess:${preparation.scenarioId}`
    const assessmentActivity = criticalCareActivityById.get(assessmentActivityId)
    const assessmentProgress = progress.get(assessmentActivityId)
    return {
      scenarioId: preparation.scenarioId,
      readiness,
      assessmentMastered:
        assessmentActivity &&
        authoritativeCriticalCareStatus(
          assessmentActivity,
          assessmentProgress?.status ?? 'not-started',
        ) === 'mastered'
          ? 1
          : 0,
      ratio:
        readiness.totalRequirementCount === 0
          ? 0
          : readiness.completedRequirementCount / readiness.totalRequirementCount,
      pathwayAlignment: pathwayAlignmentScore(preparation.pathwayIds, progress),
      catalogIndex,
    }
  })

  ranked.sort(
    (left, right) =>
      left.assessmentMastered - right.assessmentMastered ||
      right.ratio - left.ratio ||
      right.readiness.completedRequirementCount - left.readiness.completedRequirementCount ||
      right.pathwayAlignment - left.pathwayAlignment ||
      left.catalogIndex - right.catalogIndex,
  )

  const recommendation = ranked[0]
  if (!recommendation) {
    // The static catalog is validated in tests; this fallback keeps the API total if it is edited.
    const readiness = getCriticalCareIcuScenarioReadiness('septic-ards-aki', envelope)
    return { scenarioId: 'septic-ards-aki', readiness, reason: 'foundation' }
  }

  return {
    scenarioId: recommendation.scenarioId,
    readiness: recommendation.readiness,
    reason: !hasFocusedCompletion
      ? 'foundation'
      : recommendation.readiness.gateStatus === 'approved' &&
          recommendation.readiness.eligibleForAssess
        ? 'assess-ready'
        : 'focused-alignment',
  }
}

export function getCriticalCareEligibleIcuAssessmentScenarioIds(
  envelope: CriticalCareProgressEnvelope,
): readonly IcuScenarioFamily[] {
  return criticalCareIcuScenarioPreparation
    .filter(
      (preparation) =>
        getCriticalCareIcuScenarioReadiness(preparation.scenarioId, envelope).eligibleForAssess,
    )
    .map((preparation) => preparation.scenarioId)
}

function normalizedTimestamp(candidate: string | undefined): string {
  if (candidate && Number.isFinite(Date.parse(candidate))) return new Date(candidate).toISOString()
  return new Date().toISOString()
}

function boundedScore(score: number): number {
  if (!Number.isFinite(score)) return 0
  return Math.min(100, Math.max(0, Math.round(score)))
}

function summarizeAuthoritativeIcuOutcomes(
  envelope: CriticalCareProgressEnvelope,
): CriticalCareIntegratedCaseOutcomeSummary | undefined {
  const completed = envelope.activities.flatMap((progress) => {
    const activity = criticalCareActivityById.get(progress.activityId)
    if (
      activity?.moduleId !== 'icu-simulation' ||
      !isCompletedStatus(authoritativeCriticalCareStatus(activity, progress.status))
    ) {
      return []
    }
    return [
      {
        progress,
        courseId: activity.id.split(':').slice(2).join(':'),
      },
    ]
  })
  if (completed.length === 0) return undefined
  const latestCompletedAt = completed
    .map(({ progress }) => progress.updatedAt)
    .filter((timestamp) => Number.isFinite(Date.parse(timestamp)))
    .sort((left, right) => right.localeCompare(left))[0]
  return {
    completedCourseCount: Math.min(
      CRITICAL_CARE_INTEGRATED_OUTCOMES_MAX_COURSES,
      new Set(completed.map(({ courseId }) => courseId)).size,
    ),
    ...(latestCompletedAt ? { latestCompletedAt } : {}),
  }
}

function writePublicIcuOutcomeSummary(
  storage: CriticalCareStorageLike,
  envelope: CriticalCareProgressEnvelope,
): void {
  const summary = summarizeAuthoritativeIcuOutcomes(envelope)
  if (!summary) return
  try {
    storage.setItem(
      CRITICAL_CARE_INTEGRATED_OUTCOMES_STORAGE_KEY,
      JSON.stringify({
        version: CRITICAL_CARE_INTEGRATED_OUTCOMES_VERSION,
        ...summary,
      }),
    )
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(CRITICAL_CARE_PROGRESS_CHANGED_EVENT))
    }
  } catch {
    // The normalized outcome remains authoritative even when optional dashboard reporting fails.
  }
}

/**
 * Persist an ICU outcome through the normalized, coarse progress contract.
 *
 * The signature intentionally accepts only scenario identity, mode, score, mastery, attempts, and
 * time. Patient state, waveform samples, semantic commands, replay records, and focused-module raw
 * state cannot cross this adapter boundary.
 */
export function recordCriticalCareIcuOutcome(
  storage: CriticalCareStorageLike | null,
  input: RecordCriticalCareIcuOutcomeInput,
): boolean {
  if (!storage) return false
  const activity = criticalCareActivityById.get(`icu:${input.mode}:${input.scenarioId}`)
  if (!activity) return false

  let raw: string | null
  try {
    raw = storage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)
  } catch {
    return false
  }

  const now = normalizedTimestamp(input.now)
  const envelope =
    raw === null ? createEmptyCriticalCareProgress(now) : parseSerializedCriticalCareProgress(raw)
  // Preserve corrupt or future-version data rather than replacing it with a fresh envelope.
  if (!envelope) return false

  try {
    const next = withoutCriticalCareResumePointer(
      upsertCriticalCareActivityProgress(envelope, {
        activityId: activity.id,
        status: authoritativeCriticalCareStatus(
          activity,
          input.mode === 'assess' && input.mastered ? 'mastered' : 'completed',
        ),
        mode: input.mode === 'assess' ? 'challenge' : 'practice',
        bestScore: boundedScore(input.score),
        attempts: boundedCounter(input.attempts),
        competencyEvidenceIds: authoritativeCriticalCareCompetencyEvidence(
          activity,
          activity.competencyIds,
        ),
        updatedAt: now,
      }),
      activity.id,
    )
    const saved = writeCriticalCareProgress(storage, next)
    if (saved) writePublicIcuOutcomeSummary(storage, next)
    return saved
  } catch {
    return false
  }
}
