import {
  canActivateCrrtRecord,
  pendingReviewRequirements,
  requiredCrrtReviewerDomainsForArtifacts,
  type CrrtActivationRecord,
} from './activation'
import { CRRT_RAPID_DRILL_ARTIFACT_IDS } from './artifactRegistry'
import type { CrrtEngineFaultId } from '../engine/types'
import { BAXTER_CRRT_PHASE_7_CONTENT_VERSION } from './versions'

export const CRRT_RAPID_DRILL_IDS = CRRT_RAPID_DRILL_ARTIFACT_IDS

export type CrrtRapidDrillId = (typeof CRRT_RAPID_DRILL_IDS)[number]

export interface CrrtRapidDrillManifest extends CrrtActivationRecord {
  readonly id: CrrtRapidDrillId
  readonly contentVersion: typeof BAXTER_CRRT_PHASE_7_CONTENT_VERSION
  readonly title: string
  readonly engineFaultIds: readonly CrrtEngineFaultId[]
  readonly sourceRecordIds: readonly string[]
  readonly reviewQuestion: string
  readonly reviewerPreviewAvailable: boolean
  readonly runnable: false
  readonly scoringAvailable: false
  readonly analyticsAvailable: false
  readonly progressPersistenceAvailable: false
  readonly competencyAvailable: false
}

interface DrillSeed {
  readonly id: CrrtRapidDrillId
  readonly title: string
  readonly engineFaultIds: readonly CrrtEngineFaultId[]
  readonly sourceRecordIds: readonly string[]
  readonly reviewQuestion: string
  readonly blockingInputs: readonly string[]
  readonly reviewerPreviewAvailable: boolean
  readonly policyBlocked?: boolean
}

const drillSeeds: readonly DrillSeed[] = [
  {
    id: 'DRILL-AIR',
    title: 'Air detection',
    engineFaultIds: ['air-detected'],
    sourceRecordIds: ['DEV-PM-008', 'SAFETY-006', 'SYNTH-DRILL-AIR-001'],
    reviewQuestion:
      'What exact cause-first action, escalation, and reassessment sequence is approved?',
    blockingInputs: [
      'Map the exact target-device alarm, priority, reaction, and correction workflow.',
    ],
    reviewerPreviewAvailable: true,
  },
  {
    id: 'DRILL-BLOOD-LEAK',
    title: 'Blood-leak detection',
    engineFaultIds: ['blood-leak-detected'],
    sourceRecordIds: ['DEV-PM-008', 'SAFETY-006', 'SYNTH-DRILL-BLOOD-LEAK-001'],
    reviewQuestion: 'What exact device response and supervised escalation sequence is approved?',
    blockingInputs: [
      'Map the exact target-device alarm, priority, reaction, and correction workflow.',
    ],
    reviewerPreviewAvailable: true,
  },
  {
    id: 'DRILL-GAIN-LOSS',
    title: 'Fluid gain or loss',
    engineFaultIds: ['fluid-gain-loss'],
    sourceRecordIds: ['DEV-PM-012', 'SAFETY-007', 'SYNTH-DRILL-GAIN-LOSS-001'],
    reviewQuestion: 'Which checks distinguish a machine fluid event from whole-patient balance?',
    blockingInputs: ['Review target-configuration fluid-accuracy and escalation behavior.'],
    reviewerPreviewAvailable: true,
  },
  {
    id: 'DRILL-BAG-SCALE',
    title: 'Bag or scale error',
    engineFaultIds: ['supply-bag-empty', 'effluent-bag-full', 'scale-open'],
    sourceRecordIds: ['DEV-PM-013', 'SAFETY-007', 'SAFETY-013', 'SYNTH-DRILL-BAG-SCALE-001'],
    reviewQuestion: 'What exact bag, line, scale, and restart verification sequence is approved?',
    blockingInputs: ['Supply the exact local bag, line, scale, and solution configuration.'],
    reviewerPreviewAvailable: true,
  },
  {
    id: 'DRILL-POWER',
    title: 'Power interruption',
    engineFaultIds: ['power-interruption'],
    sourceRecordIds: ['DEV-PM-008', 'SAFETY-010', 'SYNTH-DRILL-POWER-001'],
    reviewQuestion:
      'What device-state, circuit, and escalation checks are required before continuation?',
    blockingInputs: ['Map the exact target-device interruption and recovery workflow.'],
    reviewerPreviewAvailable: true,
  },
  {
    id: 'DRILL-WRONG-SOLUTION',
    title: 'Wrong solution',
    engineFaultIds: [],
    sourceRecordIds: ['SAFETY-005'],
    reviewQuestion: 'Which local solution/set combinations and mismatch responses are approved?',
    blockingInputs: ['Supply the reviewed local solution and compatible-set registry.'],
    reviewerPreviewAvailable: false,
    policyBlocked: true,
  },
  {
    id: 'DRILL-BLOOD-RETURN',
    title: 'Blood-return decision',
    engineFaultIds: [],
    sourceRecordIds: ['SAFETY-003'],
    reviewQuestion: 'Which stop/end and blood-return decisions are permitted by local policy?',
    blockingInputs: [
      'Supply reviewed local blood-return, clotting, stop/end, and escalation policy.',
    ],
    reviewerPreviewAvailable: false,
    policyBlocked: true,
  },
] as const

export const baxterCrrtRapidDrillManifest: readonly CrrtRapidDrillManifest[] = Object.freeze(
  drillSeeds.map((seed) => {
    const domains = requiredCrrtReviewerDomainsForArtifacts([seed.id])
    if (domains === null) throw new Error(`Unknown CRRT activation artifact: ${seed.id}`)
    return Object.freeze({
      ...seed,
      contentVersion: BAXTER_CRRT_PHASE_7_CONTENT_VERSION,
      exactCandidateIdentity: null,
      candidateManifestSha256: null,
      expectedFindingsLedgerSha256: null,
      expectedAuthorizationScopeSha256: null,
      expectedReviewScopeSha256ByDomain: null,
      expectedPilotAcceptanceReference: null,
      expectedPhase8StablePrismaxPrerequisite: null,
      reviewScope: 'prismax' as const,
      activationAuthorization: null,
      activationState: seed.policyBlocked
        ? ('policy-blocked' as const)
        : ('draft-reviewer-only' as const),
      reviewStatus: 'pending' as const,
      requiredReviews: pendingReviewRequirements(domains),
      blockingInputs: Object.freeze([...seed.blockingInputs]),
      sourceRecordIds: Object.freeze([...seed.sourceRecordIds]),
      engineFaultIds: Object.freeze([...seed.engineFaultIds]),
      runnable: false as const,
      scoringAvailable: false as const,
      analyticsAvailable: false as const,
      progressPersistenceAvailable: false as const,
      competencyAvailable: false as const,
    })
  }),
)

if (
  baxterCrrtRapidDrillManifest.length !== CRRT_RAPID_DRILL_IDS.length ||
  new Set(baxterCrrtRapidDrillManifest.map((drill) => drill.id)).size !==
    CRRT_RAPID_DRILL_IDS.length
) {
  throw new Error('CRRT rapid-drill manifest must contain every stable drill ID exactly once.')
}
if (baxterCrrtRapidDrillManifest.some((drill) => canActivateCrrtRecord(drill))) {
  throw new Error('An unreviewed CRRT rapid drill cannot be learner-active.')
}
