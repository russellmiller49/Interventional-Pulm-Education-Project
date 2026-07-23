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
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
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

import { boundedCounter } from './utils'

export interface CriticalCareIcuRefresher {
  readonly activity: CriticalCareActivityDefinition
  readonly href: string
}

export interface CriticalCareIcuRequirementStatus extends CriticalCareIcuPreparationRequirement {
  readonly completed: boolean
  readonly refreshers: readonly CriticalCareIcuRefresher[]
}

export interface CriticalCareIcuScenarioReadiness {
  readonly scenarioId: IcuScenarioFamily
  readonly pathwayIds: readonly CriticalCarePathwayId[]
  readonly requirements: readonly CriticalCareIcuRequirementStatus[]
  readonly completedRequirementCount: number
  readonly totalRequirementCount: number
  readonly percentReady: number
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

function isCompleted(progress: CriticalCareActivityProgress | undefined): boolean {
  return progress?.status === 'completed' || progress?.status === 'mastered'
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
      eligibleForAssess: false,
    }
  }

  const progress = progressByActivityId(envelope)
  const requirements = preparation.assessRequirements.map((requirement) => ({
    ...requirement,
    completed: requirement.anyOfActivityIds.some((activityId) =>
      isCompleted(progress.get(activityId)),
    ),
    refreshers: requirement.anyOfActivityIds.flatMap((activityId) => {
      const activity = criticalCareActivityById.get(activityId)
      return activity ? [{ activity, href: activityHref(activity) }] : []
    }),
  }))
  const completedRequirementCount = requirements.filter(
    (requirement) => requirement.completed,
  ).length
  const totalRequirementCount = requirements.length

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
    eligibleForAssess:
      totalRequirementCount > 0 && completedRequirementCount === totalRequirementCount,
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
    return score + (isCompleted(progress.get(activity.id)) ? 1 : 0)
  }, 0)
}

export function getCriticalCareIcuScenarioRecommendation(
  envelope: CriticalCareProgressEnvelope,
): CriticalCareIcuScenarioRecommendation {
  const progress = progressByActivityId(envelope)
  const hasFocusedCompletion = criticalCareActivities.some(
    (activity) => activity.moduleId !== 'icu-simulation' && isCompleted(progress.get(activity.id)),
  )

  const ranked = criticalCareIcuScenarioPreparation.map((preparation, catalogIndex) => {
    const readiness = getCriticalCareIcuScenarioReadiness(preparation.scenarioId, envelope)
    const assessmentProgress = progress.get(`icu:assess:${preparation.scenarioId}`)
    return {
      scenarioId: preparation.scenarioId,
      readiness,
      assessmentMastered: assessmentProgress?.status === 'mastered' ? 1 : 0,
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
      : recommendation.readiness.eligibleForAssess
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
        status: input.mode === 'assess' && input.mastered ? 'mastered' : 'completed',
        mode: input.mode === 'assess' ? 'challenge' : 'practice',
        bestScore: boundedScore(input.score),
        attempts: boundedCounter(input.attempts),
        competencyEvidenceIds: [...activity.competencyIds],
        updatedAt: now,
      }),
      activity.id,
    )
    return writeCriticalCareProgress(storage, next)
  } catch {
    return false
  }
}
