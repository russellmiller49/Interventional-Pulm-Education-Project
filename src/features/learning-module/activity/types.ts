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

export const criticalCareReviewStatuses = ['draft', 'sme-review', 'released'] as const

export type CriticalCareReviewStatus = (typeof criticalCareReviewStatuses)[number]

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
  readonly estimatedMinutes: number
  readonly difficulty: CriticalCareDifficulty
  readonly completionRuleId: string
  readonly masteryRuleId?: string
  readonly assetIds: readonly string[]
  readonly reviewStatus: CriticalCareReviewStatus
  readonly evidenceIds: readonly string[]
}

export interface CriticalCareActivityProgress {
  readonly activityId: string
  readonly status: CriticalCareActivityStatus
  readonly currentPhase?: CriticalCareActivityPhase
  readonly mode?: CriticalCareActivityMode
  readonly bestScore?: number
  readonly attempts: number
  readonly hintCount?: number
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
