import { BAXTER_CRRT_CONTENT_VERSION } from './versions'

export interface BaxterCrrtMasteryManifest {
  readonly id: 'MASTERY-PRISMAX-01'
  readonly contentVersion: typeof BAXTER_CRRT_CONTENT_VERSION
  readonly learnerTitleBeforeDebrief: 'Masked PrisMax capstone'
  readonly revealingTitle: null
  readonly deviceId: 'prismax-aw8035-2xx'
  readonly minimumProblemDomains: 2
  readonly problemDomainIds: readonly [
    'pressure-trend-localization',
    'filter-delivery-history',
    'patient-and-circuit-reassessment',
  ]
  readonly minimumScore: 80
  readonly hintsAllowed: false
  readonly cleanStateRequired: true
  readonly criticalErrorsAllowed: 0
  readonly reassessmentRequired: true
  readonly runtimeCaseIds: readonly ['CRRT-16']
  readonly available: true
  readonly reviewStatus: 'pending'
  readonly sourceRecordIds: readonly string[]
}

/**
 * Historical grading manifest retained for compatibility with existing records and engine tests.
 * The public self-paced host uses only the stable ID and device identity. Thresholds and
 * restrictions here must not govern access, hints, current progress, or learner claims.
 */
export const baxterCrrtMasteryManifest: BaxterCrrtMasteryManifest = Object.freeze({
  id: 'MASTERY-PRISMAX-01',
  contentVersion: BAXTER_CRRT_CONTENT_VERSION,
  learnerTitleBeforeDebrief: 'Masked PrisMax capstone',
  revealingTitle: null,
  deviceId: 'prismax-aw8035-2xx',
  minimumProblemDomains: 2,
  problemDomainIds: Object.freeze([
    'pressure-trend-localization',
    'filter-delivery-history',
    'patient-and-circuit-reassessment',
  ] as const),
  minimumScore: 80,
  hintsAllowed: false,
  cleanStateRequired: true,
  criticalErrorsAllowed: 0,
  reassessmentRequired: true,
  runtimeCaseIds: Object.freeze(['CRRT-16'] as const),
  available: true,
  reviewStatus: 'pending',
  sourceRecordIds: Object.freeze([
    'DEV-PM-009',
    'DEV-PM-010',
    'REVIEW-CKRT-CORE-2025',
    'GUID-RRT-ICU-2026',
  ]),
})

export const baxterCrrtMasteryAvailable = true as const
