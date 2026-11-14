import { blueprintTopic, blueprintDomain } from '../content/blueprint'
import { dependentsOf, OBJECTIVES, objectiveById } from '../content/objectives'
import type { LearningObjective } from '../content/types'
import type { LearnerGoal, NavigatorRecord } from './record'
import { objectiveStatus, type ObjectiveStatus } from './status'

/**
 * The rules-first recommendation engine. Every recommendation carries the rule that produced it,
 * in words a learner can read, and the list is ordered by rule tier so faculty can audit it.
 *
 * Tiers, in the order the vision gives them:
 *   1. confirmed gaps (needs-focus);
 *   2. prerequisites holding back another objective;
 *   3. due retention checks;
 *   4. unassessed objectives, breadth-first across topics;
 *   5. objectives still exploring, to get a second observation.
 * Within a tier, safety-critical objectives come first, then blueprint weight, then the catalogue
 * order. The learner's goal reorders the middle tiers: knowledge maintenance puts reviews first;
 * fellowship development puts prerequisites first.
 */
export type ReasonKind = 'gap' | 'prerequisite' | 'review' | 'unassessed' | 'exploring'

export const REASON_LABELS: Readonly<Record<ReasonKind, string>> = {
  gap: 'Confirmed gap',
  prerequisite: 'Prerequisite',
  review: 'Review due',
  unassessed: 'Not yet assessed',
  exploring: 'Needs another look',
}

export interface Recommendation {
  readonly objective: LearningObjective
  readonly status: ObjectiveStatus
  readonly reason: ReasonKind
  /** One sentence the learner reads: why this, now. */
  readonly rationale: string
  readonly minutes: number
  readonly safetyCritical: boolean
  /** The lab mode this recommendation opens. */
  readonly mode: 'repair' | 'review'
}

const TIER_ORDER: Readonly<Record<LearnerGoal, readonly ReasonKind[]>> = {
  board: ['gap', 'prerequisite', 'review', 'unassessed', 'exploring'],
  fellowship: ['prerequisite', 'gap', 'review', 'unassessed', 'exploring'],
  maintenance: ['review', 'gap', 'prerequisite', 'unassessed', 'exploring'],
}

function domainWeight(objective: LearningObjective): number {
  return blueprintDomain(blueprintTopic(objective.topicId).domainId).weightPercent
}

function catalogueIndex(objective: LearningObjective): number {
  return OBJECTIVES.indexOf(objective)
}

function heldBack(objective: LearningObjective, record: NavigatorRecord, now: string): string[] {
  return dependentsOf(objective.id)
    .filter((dependent) => {
      const status = objectiveStatus(record, dependent.id, now).status
      return status === 'needs-focus' || status === 'exploring'
    })
    .map((dependent) => dependent.title)
}

function misconceptionLabel(objective: LearningObjective, id: string | null): string | null {
  if (!id) return null
  return objective.misconceptions.find((entry) => entry.id === id)?.label ?? null
}

export function buildRecommendations(
  record: NavigatorRecord,
  now: string,
): readonly Recommendation[] {
  const goal: LearnerGoal = record.profile?.goal ?? 'board'
  const candidates: Recommendation[] = []
  const assessedTopics = new Map<string, number>()

  for (const objective of OBJECTIVES) {
    const summary = objectiveStatus(record, objective.id, now)
    if (summary.status !== 'not-assessed') {
      assessedTopics.set(objective.topicId, (assessedTopics.get(objective.topicId) ?? 0) + 1)
    }
  }

  for (const objective of OBJECTIVES) {
    const summary = objectiveStatus(record, objective.id, now)
    const { status } = summary
    const dependents = heldBack(objective, record, now)

    if (status === 'needs-focus') {
      const wrongModel = misconceptionLabel(objective, summary.recurringMisconceptionId)
      candidates.push({
        objective,
        status,
        reason: 'gap',
        rationale: wrongModel
          ? `You have repeated the same error: "${wrongModel}" Repair that idea, then show it holds in a new scenario.`
          : 'Your recent attempts here were missed. Repair the idea, then show it holds in a new scenario.',
        minutes: objective.estimatedMinutes,
        safetyCritical: objective.safetyCritical,
        mode: 'repair',
      })
      continue
    }

    if (dependents.length > 0 && (status === 'not-assessed' || status === 'exploring')) {
      candidates.push({
        objective,
        status,
        reason: 'prerequisite',
        rationale: `This idea underpins "${dependents[0]}"${dependents.length > 1 ? ` and ${dependents.length - 1} more` : ''}. Settling it first makes the harder objective easier.`,
        minutes: objective.estimatedMinutes,
        safetyCritical: objective.safetyCritical,
        mode: 'repair',
      })
      continue
    }

    if (status === 'review-due') {
      candidates.push({
        objective,
        status,
        reason: 'review',
        rationale:
          'You demonstrated this earlier. A short check in a different task shows whether it has stayed with you.',
        minutes: 3,
        safetyCritical: objective.safetyCritical,
        mode: 'review',
      })
      continue
    }

    if (status === 'not-assessed') {
      const topic = blueprintTopic(objective.topicId)
      const covered = assessedTopics.get(objective.topicId) ?? 0
      candidates.push({
        objective,
        status,
        reason: 'unassessed',
        rationale:
          covered === 0
            ? `Nothing in "${topic.title}" has been assessed yet. This is where the map is blank, not where it is weak.`
            : `No evidence yet on this objective${objective.safetyCritical ? ', and the decision it covers is safety-critical' : ''}.`,
        minutes: objective.estimatedMinutes,
        safetyCritical: objective.safetyCritical,
        mode: 'repair',
      })
      continue
    }

    if (status === 'exploring') {
      candidates.push({
        objective,
        status,
        reason: 'exploring',
        rationale:
          'The evidence here is mixed or thin. One more task settles whether this is demonstrated or needs focus.',
        minutes: objective.estimatedMinutes,
        safetyCritical: objective.safetyCritical,
        mode: 'repair',
      })
    }
  }

  const tiers = TIER_ORDER[goal]
  return candidates.sort((a, b) => {
    const tier = tiers.indexOf(a.reason) - tiers.indexOf(b.reason)
    if (tier !== 0) return tier
    if (a.safetyCritical !== b.safetyCritical) return a.safetyCritical ? -1 : 1
    if (a.reason === 'unassessed') {
      // Breadth first: a topic with nothing assessed before a topic with some.
      const aCovered = assessedTopics.get(a.objective.topicId) ?? 0
      const bCovered = assessedTopics.get(b.objective.topicId) ?? 0
      if (aCovered !== bCovered) return aCovered - bCovered
    }
    const weight = domainWeight(b.objective) - domainWeight(a.objective)
    if (weight !== 0) return weight
    return catalogueIndex(a.objective) - catalogueIndex(b.objective)
  })
}

/** The recommendations that fit a session, greedily, in order. Always at least one. */
export function planSession(
  recommendations: readonly Recommendation[],
  minutes: number,
): readonly Recommendation[] {
  const plan: Recommendation[] = []
  let remaining = minutes
  for (const recommendation of recommendations) {
    if (plan.length === 0 || recommendation.minutes <= remaining) {
      plan.push(recommendation)
      remaining -= recommendation.minutes
    }
    if (remaining <= 0) break
  }
  return plan
}

/** The recommendation for one objective, if the engine has one; otherwise a learner-chosen entry. */
export function recommendationFor(
  record: NavigatorRecord,
  objectiveId: string,
  now: string,
): Recommendation {
  const found = buildRecommendations(record, now).find(
    (entry) => entry.objective.id === objectiveId,
  )
  if (found) return found
  const objective = objectiveById(objectiveId)
  return {
    objective,
    status: objectiveStatus(record, objectiveId, now).status,
    reason: 'exploring',
    rationale: 'You chose this objective yourself. The lab runs the same way.',
    minutes: objective.estimatedMinutes,
    safetyCritical: objective.safetyCritical,
    mode: 'repair',
  }
}
