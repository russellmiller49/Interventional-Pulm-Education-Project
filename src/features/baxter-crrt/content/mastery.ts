import {
  CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS,
  canActivateCrrtRecord,
  pendingReviewRequirements,
  type CrrtActivationRecord,
} from './activation'
import { BAXTER_CRRT_PHASE_7_CONTENT_VERSION } from './versions'

export interface BaxterCrrtMasteryManifest extends CrrtActivationRecord {
  readonly id: 'MASTERY-PRISMAX-01'
  readonly contentVersion: typeof BAXTER_CRRT_PHASE_7_CONTENT_VERSION
  readonly learnerTitleBeforeDebrief: 'Unseen PrisMax capstone'
  readonly revealingTitle: null
  readonly deviceId: 'prismax-aw8035-2xx'
  readonly minimumProblemDomains: 2
  readonly minimumScoreCandidate: 80
  readonly minimumScoreSourceId: 'BRIEF-MASTERY-001'
  readonly minimumScoreReviewer: null
  readonly hintsAllowed: false
  readonly cleanStateRequired: true
  readonly criticalErrorsAllowed: 0
  readonly reassessmentRequired: true
  readonly runtimeCaseIds: readonly []
}

export const baxterCrrtMasteryManifest: BaxterCrrtMasteryManifest = Object.freeze({
  id: 'MASTERY-PRISMAX-01',
  contentVersion: BAXTER_CRRT_PHASE_7_CONTENT_VERSION,
  exactCandidateIdentity: null,
  candidateManifestSha256: null,
  expectedFindingsLedgerSha256: null,
  expectedAuthorizationScopeSha256: null,
  expectedReviewScopeSha256ByDomain: null,
  expectedPilotAcceptanceReference: null,
  expectedPhase8StablePrismaxPrerequisite: null,
  reviewScope: 'prismax',
  activationAuthorization: null,
  learnerTitleBeforeDebrief: 'Unseen PrisMax capstone',
  revealingTitle: null,
  deviceId: 'prismax-aw8035-2xx',
  minimumProblemDomains: 2,
  minimumScoreCandidate: 80,
  minimumScoreSourceId: 'BRIEF-MASTERY-001',
  minimumScoreReviewer: null,
  hintsAllowed: false,
  cleanStateRequired: true,
  criticalErrorsAllowed: 0,
  reassessmentRequired: true,
  runtimeCaseIds: Object.freeze([] as const),
  activationState: 'manifest-only',
  reviewStatus: 'pending',
  requiredReviews: pendingReviewRequirements(CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS),
  blockingInputs: Object.freeze([
    'Author at least one independently reviewed, multi-hit capstone without a revealing title.',
    'Review accepted alternatives, candidate critical errors, scoring, and reassessment rules.',
    'Complete the exact PrisMax configuration and device review.',
    'Record all named exact-version reviewer dispositions.',
  ]),
})

export const baxterCrrtMasteryAvailable = canActivateCrrtRecord(baxterCrrtMasteryManifest)
