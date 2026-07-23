import type {
  CriticalCareActivityProgress,
  CriticalCareProgressEnvelope,
  CriticalCareResumePointer,
} from '@/features/learning-module/activity'

export const LEGACY_PROGRESS_EPOCH = '1970-01-01T00:00:00.000Z' as const
export const CRITICAL_CARE_INTEGRATED_OUTCOMES_STORAGE_KEY =
  'critical-care-integrated-outcomes-v1' as const
export const CRITICAL_CARE_INTEGRATED_OUTCOMES_VERSION = 1 as const
export const CRITICAL_CARE_INTEGRATED_OUTCOMES_MAX_COURSES = 6 as const

export type CriticalCareProgressSourceStatus = 'empty' | 'valid' | 'corrupt' | 'incompatible'

export type CriticalCareProgressSourceIssue =
  | 'storage-read-failed'
  | 'invalid-json'
  | 'invalid-shape'
  | 'unsupported-version'
  | 'engine-version-mismatch'
  | 'content-version-mismatch'
  | 'checkpoint-version-mismatch'
  | 'catalog-target-mismatch'

export interface CriticalCareReadableStorage {
  getItem(key: string): string | null
}

export interface CriticalCareProgressSourceReport {
  readonly moduleId: string
  readonly storageKey: string
  readonly status: CriticalCareProgressSourceStatus
  readonly issue?: CriticalCareProgressSourceIssue
  readonly detectedVersion?: string
}

export interface CriticalCareLegacyProgressResult {
  readonly moduleId: string
  readonly status: CriticalCareProgressSourceStatus
  readonly sources: readonly CriticalCareProgressSourceReport[]
  readonly activities: readonly CriticalCareActivityProgress[]
  readonly resume?: CriticalCareResumePointer
}

export interface CriticalCareIntegratedCaseOutcomeSummary {
  readonly completedCourseCount: number
  readonly latestCompletedAt?: string
}

export interface CriticalCareProgressReadResult {
  readonly envelope: CriticalCareProgressEnvelope
  readonly normalizedSource: CriticalCareProgressSourceReport
  readonly legacySources: readonly CriticalCareLegacyProgressResult[]
  readonly notices: readonly CriticalCareProgressSourceReport[]
  /** Coarse aggregate only; scenario identity and simulator state never cross the public boundary. */
  readonly integratedCaseOutcomes?: CriticalCareIntegratedCaseOutcomeSummary
}
