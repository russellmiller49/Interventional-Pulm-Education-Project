import {
  canActivateCrrtRecord,
  pendingReviewRequirements,
  requiredCrrtReviewerDomainsForArtifacts,
  type CrrtActivationRecord,
} from './activation'
import { CRRT_INSTRUCTIONAL_TOOL_ARTIFACT_IDS } from './artifactRegistry'
import { BAXTER_CRRT_PHASE_7_CONTENT_VERSION } from './versions'

export const CRRT_INSTRUCTIONAL_TOOL_IDS = CRRT_INSTRUCTIONAL_TOOL_ARTIFACT_IDS

export type CrrtInstructionalToolId = (typeof CRRT_INSTRUCTIONAL_TOOL_IDS)[number]

export interface CrrtInstructionalToolManifest extends CrrtActivationRecord {
  readonly id: CrrtInstructionalToolId
  readonly contentVersion: typeof BAXTER_CRRT_PHASE_7_CONTENT_VERSION
  readonly title: string
  readonly purpose: string
  readonly sourceRecordIds: readonly string[]
  readonly reviewerRuntimeAvailable: boolean
  readonly learnerAvailable: false
  readonly scoringAvailable: false
  readonly progressPersistenceAvailable: false
}

interface ToolSeed {
  readonly id: CrrtInstructionalToolId
  readonly title: string
  readonly purpose: string
  readonly sourceRecordIds: readonly string[]
  readonly reviewerRuntimeAvailable: boolean
  readonly blockingInputs: readonly string[]
  readonly protocolBlocked?: boolean
}

const seeds: readonly ToolSeed[] = [
  {
    id: 'LAB-TRANSPORT',
    title: 'Transport Mechanism Lab',
    purpose:
      'Explore diffusion, convection, ultrafiltration, adsorption, flow direction, molecule class, and qualitative modality effluent relationships.',
    sourceRecordIds: ['REVIEW-CKRT-CORE-2025', 'GUID-RRT-ICU-2026', 'SYNTH-LAB-TRANSPORT-001'],
    reviewerRuntimeAvailable: true,
    blockingInputs: [
      'Review every qualitative mechanism statement and the unitless teaching abstraction.',
    ],
  },
  {
    id: 'LAB-PRESCRIPTION',
    title: 'Full Prescription Workbench',
    purpose:
      'Separate source-backed device calculations from unavailable clinical targets, solution profiles, protocols, and disputed terms.',
    sourceRecordIds: [
      'MATH-PM-001',
      'MATH-PM-003',
      'MATH-PM-004',
      'MATH-PM-005',
      'MATH-PM-006',
      'DOSE-PM-001',
      'FLUID-PM-002',
      'SYNTH-LAB-PRESCRIPTION-001',
    ],
    reviewerRuntimeAvailable: true,
    blockingInputs: [
      'Keep disputed calculations unavailable and supply the exact local solution/set registry before activation.',
    ],
  },
  {
    id: 'LAB-PREPOST-DILUTION',
    title: 'Pre- versus post-dilution experiment',
    purpose:
      'Teach qualitative dilution, clearance, filtration-fraction, and filter-burden tradeoffs without declaring one universal best split.',
    sourceRecordIds: [
      'REVIEW-CKRT-CORE-2025',
      'GUID-RRT-ICU-2026',
      'MATH-PM-003',
      'MATH-PM-004',
      'MATH-PM-005',
      'MATH-PM-006',
      'SYNTH-LAB-PREPOST-001',
    ],
    reviewerRuntimeAvailable: true,
    blockingInputs: [
      'Review the qualitative abstraction and resolve disputed quantitative calculations before any device-value claim.',
    ],
  },
  {
    id: 'LAB-PRESSURE-LOCALIZATION',
    title: 'Pressure Localization Lab',
    purpose:
      'Predict a synthetic pressure pattern before revealing a placed obstruction; disconnection patterns remain visibly unavailable pending device review.',
    sourceRecordIds: ['DEV-PM-009', 'DEV-PM-010', 'MATH-PM-002', 'SYNTH-LAB-PRESSURE-001'],
    reviewerRuntimeAvailable: true,
    blockingInputs: [
      'Review each generic obstruction pattern and supply device-reviewed disconnection mappings; exact alarms, thresholds, automatic reactions, and correction sequences remain unavailable.',
    ],
  },
  {
    id: 'LAB-FLUID-LEDGER',
    title: 'Fluid Balance Ledger',
    purpose:
      'Reconcile synthetic external inputs, non-machine outputs, machine patient-fluid removal, and whole-patient balance.',
    sourceRecordIds: [
      'FLUID-PM-001',
      'FLUID-PM-002',
      'WHITE-2024',
      'GONEUTRAL-2024',
      'SYNTH-LAB-FLUID-001',
    ],
    reviewerRuntimeAvailable: true,
    blockingInputs: [
      'Review the accounting labels and confirm that no removal target or recommendation is implied.',
    ],
  },
  {
    id: 'LAB-CITRATE-DASHBOARD',
    title: 'Citrate-Calcium Dashboard scaffold',
    purpose:
      'Materialize linked monitoring-domain placeholders without dosing, targets, adjustments, or escalation logic.',
    sourceRecordIds: ['PROTO-001', 'SAFETY-012'],
    reviewerRuntimeAvailable: true,
    protocolBlocked: true,
    blockingInputs: [
      'Supply and approve a complete versioned local citrate/calcium protocol before any actionable behavior.',
    ],
  },
]

export const baxterCrrtInstructionalToolManifest: readonly CrrtInstructionalToolManifest[] =
  Object.freeze(
    seeds.map((seed) => {
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
        activationState: seed.protocolBlocked
          ? ('protocol-blocked' as const)
          : seed.reviewerRuntimeAvailable
            ? ('draft-reviewer-only' as const)
            : ('manifest-only' as const),
        reviewStatus: 'pending' as const,
        requiredReviews: pendingReviewRequirements(domains),
        blockingInputs: Object.freeze([...seed.blockingInputs]),
        sourceRecordIds: Object.freeze([...seed.sourceRecordIds]),
        learnerAvailable: false as const,
        scoringAvailable: false as const,
        progressPersistenceAvailable: false as const,
      })
    }),
  )

if (
  baxterCrrtInstructionalToolManifest.length !== CRRT_INSTRUCTIONAL_TOOL_IDS.length ||
  new Set(baxterCrrtInstructionalToolManifest.map((tool) => tool.id)).size !==
    CRRT_INSTRUCTIONAL_TOOL_IDS.length
) {
  throw new Error(
    'CRRT instructional-tool manifest must contain every stable tool ID exactly once.',
  )
}
if (baxterCrrtInstructionalToolManifest.some((tool) => canActivateCrrtRecord(tool))) {
  throw new Error('An unreviewed CRRT instructional tool cannot be learner-active.')
}
