import type { TopicId } from './blueprint'
import type { ConceptTag } from './concepts'
import type { NavigatorSourceId } from './sources'

/**
 * The atomic unit is a learning objective, not a topic percentage or a question. Each objective
 * carries its blueprint mapping, prerequisites, documented misconceptions, the resources that
 * teach it, and one repair lab: a diagnostic task, the repair, and a verification task of a
 * different kind, so a repeat of the same prompt is never the proof that the idea transferred.
 */
export type TaskKind = 'choice' | 'predict' | 'sequence' | 'sort' | 'hotspot'

export interface TaskBase {
  readonly id: string
  readonly kind: TaskKind
  /** The clinical decision, as a vignette. Never names the answer. */
  readonly stem: string
  /** Shown on request, without penalty. Narrows the field; does not hand over the answer. */
  readonly hint: string
  /** One line that links the task back to the idea, shown after commitment. */
  readonly teachingPoint: string
  readonly sourceIds: readonly NavigatorSourceId[]
}

export interface ChoiceOption {
  readonly id: string
  readonly label: string
  /** Why this option is or is not the answer. Written to repair the specific wrong model. */
  readonly rationale: string
  /** The documented misconception this option represents, when it represents one. */
  readonly misconceptionId?: string
}

export interface ChoiceTask extends TaskBase {
  readonly kind: 'choice'
  readonly options: readonly ChoiceOption[]
  readonly answerId: string
}

/** A manipulation: hold the scenario, change one thing, predict what follows. */
export interface PredictTask extends TaskBase {
  readonly kind: 'predict'
  /** The situation before the change. */
  readonly baseline: string
  /** The one thing that changes. */
  readonly change: string
  readonly options: readonly ChoiceOption[]
  readonly answerId: string
}

export interface SequenceStep {
  readonly id: string
  readonly label: string
}

export interface SequenceTask extends TaskBase {
  readonly kind: 'sequence'
  /** The steps, in a scrambled authored order. */
  readonly steps: readonly SequenceStep[]
  /** Step ids in the right order. */
  readonly order: readonly string[]
  readonly rationale: string
  /** A step that lands too early reveals this misconception. */
  readonly earlyMisconceptions?: Readonly<Record<string, string>>
}

export interface SortBucket {
  readonly id: string
  readonly label: string
}

export interface SortItem {
  readonly id: string
  readonly label: string
  readonly bucketId: string
  readonly rationale: string
  readonly misconceptionId?: string
}

export interface SortTask extends TaskBase {
  readonly kind: 'sort'
  readonly buckets: readonly SortBucket[]
  readonly items: readonly SortItem[]
}

export type HotspotFigureId = 'station-schematic'

export interface HotspotTask extends TaskBase {
  readonly kind: 'hotspot'
  readonly figure: HotspotFigureId
  readonly answerRegionId: string
  readonly rationale: string
  /** A wrong region reveals this misconception. */
  readonly regionMisconceptions?: Readonly<Record<string, string>>
}

export type Task = ChoiceTask | PredictTask | SequenceTask | SortTask | HotspotTask

export interface Misconception {
  readonly id: string
  /** The wrong model, in the learner's words. */
  readonly label: string
  /** The corrected reasoning. */
  readonly repair: string
}

export type ResourceKind = 'module' | 'chapter' | 'simulator' | 'external'

export interface LearningResource {
  readonly label: string
  readonly href: string
  readonly kind: ResourceKind
  readonly note?: string
}

export interface RepairStep {
  /** The governing principle, one or two sentences. */
  readonly principle: string
  /** The explanation, a few short paragraphs. */
  readonly explanation: readonly string[]
  /** The conceptual distinction the learner leaves with, named. */
  readonly distinction: string
  /** An optional manipulation: change one variable, predict the effect. */
  readonly manipulate?: PredictTask
}

export interface ObjectiveLab {
  readonly diagnose: Task
  readonly repair: RepairStep
  readonly verify: Task
}

/** Project metadata on an objective. Never rendered to the learner. */
export interface ObjectiveProvenance {
  readonly contentVersion: string
  readonly authoredOn: string
  readonly reviewer: string | null
  readonly lastReviewedOn: string | null
}

export interface LearningObjective {
  readonly id: string
  readonly topicId: TopicId
  readonly secondaryTopicIds?: readonly TopicId[]
  readonly title: string
  /** The plain-language competency statement: what the learner can do. */
  readonly competency: string
  readonly whatToKnow: readonly string[]
  readonly prerequisites: readonly string[]
  readonly concepts: readonly ConceptTag[]
  /** A wrong answer here could harm a patient; weighted up in recommendations. */
  readonly safetyCritical: boolean
  readonly misconceptions: readonly Misconception[]
  readonly resources: readonly LearningResource[]
  readonly sourceIds: readonly NavigatorSourceId[]
  readonly estimatedMinutes: number
  readonly lab: ObjectiveLab
  readonly provenance: ObjectiveProvenance
}

export const PILOT_PROVENANCE: ObjectiveProvenance = {
  contentVersion: '2026.11-pilot',
  authoredOn: '2026-11-04',
  reviewer: null,
  lastReviewedOn: null,
}
