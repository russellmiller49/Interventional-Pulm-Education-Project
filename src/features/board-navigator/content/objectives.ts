import { blueprintTopic, type DomainId, type TopicId } from './blueprint'
import { AIRWAY_OBJECTIVES } from './labs/airway'
import { PLEURAL_OBJECTIVES } from './labs/pleural'
import { STAGING_OBJECTIVES } from './labs/staging'
import { THERAPEUTIC_OBJECTIVES } from './labs/therapeutics'
import type { LearningObjective, Task } from './types'

/**
 * The objective catalogue: the pilot's objectives in the order the pilot areas are named in the
 * vision (mediastinal staging, pleural disease, airway obstruction and stents, therapeutic
 * modalities). Lookups throw on an unknown id so a typo fails a test, never a learner.
 */
export const OBJECTIVES: readonly LearningObjective[] = [
  ...STAGING_OBJECTIVES,
  ...PLEURAL_OBJECTIVES,
  ...AIRWAY_OBJECTIVES,
  ...THERAPEUTIC_OBJECTIVES,
]

const byId = new Map(OBJECTIVES.map((objective) => [objective.id, objective]))

export function isObjectiveId(id: string): boolean {
  return byId.has(id)
}

export function objectiveById(id: string): LearningObjective {
  const objective = byId.get(id)
  if (!objective) throw new Error(`board-navigator: no objective "${id}"`)
  return objective
}

export function findObjective(id: string | null | undefined): LearningObjective | null {
  return id ? (byId.get(id) ?? null) : null
}

export function objectivesInTopic(topicId: TopicId): readonly LearningObjective[] {
  return OBJECTIVES.filter(
    (objective) =>
      objective.topicId === topicId || objective.secondaryTopicIds?.includes(topicId) === true,
  )
}

/** The objectives whose primary topic sits in a domain. */
export function objectivesInDomain(domainId: DomainId): readonly LearningObjective[] {
  return OBJECTIVES.filter((objective) => blueprintTopic(objective.topicId).domainId === domainId)
}

/** The objectives that list this one as a prerequisite. */
export function dependentsOf(objectiveId: string): readonly LearningObjective[] {
  return OBJECTIVES.filter((objective) => objective.prerequisites.includes(objectiveId))
}

/** Every task an objective can put in front of a learner, in lab order. */
export function tasksOf(objective: LearningObjective): readonly Task[] {
  const tasks: Task[] = [objective.lab.diagnose]
  if (objective.lab.repair.manipulate) tasks.push(objective.lab.repair.manipulate)
  tasks.push(objective.lab.verify)
  return tasks
}

export function misconceptionOf(objective: LearningObjective, misconceptionId: string) {
  return objective.misconceptions.find((entry) => entry.id === misconceptionId) ?? null
}
