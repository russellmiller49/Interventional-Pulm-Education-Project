export const criticalCareActivityKinds = [
  'micro-lesson',
  'interactive-lab',
  'guided-case',
  'practice-case',
  'assessment',
  'sandbox',
  'reference',
] as const

export type CriticalCareActivityKind = (typeof criticalCareActivityKinds)[number]

export const criticalCareActivityModes = ['guided', 'practice', 'challenge'] as const

export type CriticalCareActivityMode = (typeof criticalCareActivityModes)[number]

export const criticalCareActivityPhases = [
  'recognize',
  'predict',
  'act',
  'observe',
  'explain',
  'transfer',
] as const

export type CriticalCareActivityPhase = (typeof criticalCareActivityPhases)[number]

export const criticalCareActivityStatuses = [
  'not-started',
  'in-progress',
  'completed',
  'mastered',
] as const

export type CriticalCareActivityStatus = (typeof criticalCareActivityStatuses)[number]

export const criticalCareDifficulties = ['foundation', 'intermediate', 'advanced'] as const

export type CriticalCareDifficulty = (typeof criticalCareDifficulties)[number]

/**
 * Where an activity sits in its module's teaching arc. Distinct from `difficulty`, which
 * describes how hard the activity is; a stage describes what kind of work it asks for.
 * Authoring metadata only — never written to the progress envelope.
 */
export const criticalCareCurriculumStages = [
  'orientation', // why this exists, what it can and cannot do
  'foundation', // the causal model and the normal state
  'mechanism', // one manipulated variable, observed response
  'application', // full workspace, a dominant mechanism, coaching visible
  'integration', // several mechanisms interacting; the capstone
] as const

export type CriticalCareCurriculumStage = (typeof criticalCareCurriculumStages)[number]

export const criticalCareCurriculumStageRank: Readonly<
  Record<CriticalCareCurriculumStage, number>
> = Object.freeze(
  Object.fromEntries(criticalCareCurriculumStages.map((stage, index) => [stage, index])) as Record<
    CriticalCareCurriculumStage,
    number
  >,
)

export const criticalCareReviewStatuses = ['draft', 'sme-review', 'released'] as const

export type CriticalCareReviewStatus = (typeof criticalCareReviewStatuses)[number]

export const criticalCareCreditPolicies = [
  'non-credit',
  'completion-only',
  'competency-eligible',
] as const

export type CriticalCareCreditPolicy = (typeof criticalCareCreditPolicies)[number]

export const criticalCareCompletionEvidenceAuthorities = [
  'none',
  'validated-interaction',
  'reviewed-engine-score',
  'reviewed-item-set',
  'authored-performance-predicate',
] as const

export type CriticalCareCompletionEvidenceAuthority =
  (typeof criticalCareCompletionEvidenceAuthorities)[number]

export interface CriticalCareActivityDefinition {
  readonly id: string
  readonly moduleId: string
  readonly title: string
  readonly description: string
  readonly kind: CriticalCareActivityKind
  readonly supportedModes: readonly CriticalCareActivityMode[]
  readonly pathname: string
  readonly query?: Readonly<Record<string, string>>
  readonly pathwayIds: readonly string[]
  readonly competencyIds: readonly string[]
  readonly prerequisiteActivityIds: readonly string[]
  /** Authoring metadata only; never written to the progress envelope. */
  readonly teachesConceptIds: readonly string[]
  /** Authoring metadata only; drives optional just-in-time refreshers. */
  readonly assumedConceptIds: readonly string[]
  readonly estimatedMinutes: number
  readonly difficulty: CriticalCareDifficulty
  /** Authoring metadata only; the teaching arc position. Never persisted. */
  readonly curriculumStage: CriticalCareCurriculumStage
  /** Authored ordinal within (moduleId, curriculumStage). Never persisted. */
  readonly stageOrder: number
  readonly completionRuleId: string
  readonly masteryRuleId?: string
  readonly assetIds: readonly string[]
  readonly reviewStatus: CriticalCareReviewStatus
  readonly evidenceIds: readonly string[]
  readonly contentVersion: string
  readonly creditPolicy: CriticalCareCreditPolicy
  readonly completionEvidenceAuthority: CriticalCareCompletionEvidenceAuthority
}

export interface CriticalCareActivityProgress {
  readonly activityId: string
  readonly status: CriticalCareActivityStatus
  readonly currentPhase?: CriticalCareActivityPhase
  readonly mode?: CriticalCareActivityMode
  readonly bestScore?: number
  readonly attempts: number
  readonly hintCount?: number
  readonly tricky?: boolean
  readonly competencyEvidenceIds: readonly string[]
  readonly updatedAt: string
}

export interface CriticalCareResumePointer {
  readonly activityId: string
  readonly pathname: string
  readonly query?: Readonly<Record<string, string>>
  readonly mode: CriticalCareActivityMode
  readonly phase: CriticalCareActivityPhase
  readonly scenarioId?: string
  readonly deviceId?: string
  readonly checkpointId?: string
  readonly payloadVersion: string
  readonly updatedAt: string
}

export interface CriticalCareProgressEnvelope {
  readonly version: 1
  readonly activities: readonly CriticalCareActivityProgress[]
  readonly resume?: CriticalCareResumePointer
  readonly updatedAt: string
}
