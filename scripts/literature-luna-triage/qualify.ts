import { STAGE_A_CONTRACT_VERSION } from '../../src/features/literature/classifier/stage-a-contract'
import { UNIVERSAL_PACKET_SCHEMA_VERSION } from '../../src/features/literature/classifier/packet-contract'
import { COORDINATOR_RISK_LEXICON_VERSION } from '../../src/features/literature/classifier/risk-lexicon'
import { canonicalJson, checksumBody, sha256 } from '../literature-production-ingest/canonical'
import {
  LUNA_COST_ESTIMATOR_VERSION,
  LUNA_EVALUATION_VERSION,
  LUNA_FREEZE_RECEIPT_VERSION,
  LUNA_LOCKED_SANITY_COHORT_SIZE,
  LUNA_MINIMUM_EXCLUDE_YIELD,
  LUNA_QUALIFICATION_VERSION,
} from './constants'
import type { EvaluationReport } from './evaluation'
import { outputSchemaSha256, reasonVocabularySha256, type FreezeReceipt } from './freeze'
import { sortedIdentityDigest } from './split'

/**
 * The Stage-A qualification gate: shadow-routing authorization, not clinical validation.
 *
 * Qualification runs from one thing only — the exact frozen locked-sanity-200 evaluation — and
 * an `EvaluationReport` may never self-declare it. The gate therefore takes a checksum-bound
 * `QualificationEvidence` object that names the calibration version, the frozen surfaces, the
 * consumed locked-run marker, the evaluated cohort identity, and the evaluation artifact's own
 * digest. Every one of those is re-derived or re-compared here; anything undersized, wrong
 * cohort, unbound, drifted, or already observed refuses outright rather than reporting a
 * result.
 *
 * All eight criteria are then evaluated over that locked run; every one must pass before Stage
 * A may shadow-route anything. The criteria are asymmetric on purpose: perfection is demanded
 * on the relevant side (zero core, zero adjacent, zero relevant routing errors, 100% bucket
 * precision) while the negative side needs only a minimum useful yield.
 */

export const LUNA_QUALIFICATION_EVIDENCE_VERSION = 'literature-luna-qualification-evidence/1.0.0'

export const LUNA_LOCKED_SANITY_COHORT_LABEL = 'locked-sanity-200'

export class QualificationEvidenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QualificationEvidenceError'
  }
}

/** The create-once marker written when the locked cohort ran. One per calibration version. */
export interface LockedRunMarker {
  readonly calibrationVersion: string
  readonly operationId: string
  readonly startedAt: string
}

/**
 * Checksum-bound evidence that one pristine locked run happened under one frozen calibration
 * surface, over exactly the frozen 200 identities, and produced exactly this evaluation.
 */
export interface QualificationEvidence {
  readonly evidenceVersion: string
  readonly qualificationVersion: string
  readonly calibrationVersion: string
  readonly operationId: string
  readonly cohortLabel: string
  readonly selectedCount: number
  /** Digest of the identities actually evaluated, derived at the coordinator boundary. */
  readonly cohortIdentitySha256: string
  /** The frozen split's locked-sanity identity digest. Must equal the evaluated cohort's. */
  readonly splitLockedSanityIdentitySha256: string
  readonly splitManifestSha256: string
  readonly freezeReceipt: FreezeReceipt
  readonly lockedRunMarker: LockedRunMarker
  readonly lockedRunMarkerSha256: string
  /** `sha256(canonicalJson(evaluationReport))` recorded when the evaluation was written. */
  readonly evaluationReportSha256: string
  readonly evidenceSha256: string
}

export type QualificationEvidenceInputs = Omit<
  QualificationEvidence,
  'evidenceVersion' | 'qualificationVersion' | 'lockedRunMarkerSha256' | 'evidenceSha256'
>

export function lockedRunMarkerSha256(marker: LockedRunMarker): string {
  return sha256(canonicalJson(marker))
}

export function evaluationReportSha256(report: EvaluationReport): string {
  return sha256(canonicalJson(report))
}

/**
 * Derive the evaluated cohort's identity digest, refusing a duplicated, missing, or extra
 * identity before a digest exists. The formula is the split manifest's, so an exact match is
 * exact set equality with the frozen 200.
 */
export function lockedSanityCohortIdentitySha256(pmids: readonly string[]): string {
  const unique = new Set(pmids)
  if (unique.size !== pmids.length) {
    throw new QualificationEvidenceError(
      'The locked cohort contains a duplicate identity; refusing to qualify.',
    )
  }
  if (pmids.length !== LUNA_LOCKED_SANITY_COHORT_SIZE) {
    throw new QualificationEvidenceError(
      `The locked cohort holds ${pmids.length} identities, not exactly ` +
        `${LUNA_LOCKED_SANITY_COHORT_SIZE}; refusing to qualify.`,
    )
  }
  return sortedIdentityDigest(pmids)
}

export function buildQualificationEvidence(
  inputs: QualificationEvidenceInputs,
): QualificationEvidence {
  const body = {
    evidenceVersion: LUNA_QUALIFICATION_EVIDENCE_VERSION,
    qualificationVersion: LUNA_QUALIFICATION_VERSION,
    calibrationVersion: inputs.calibrationVersion,
    operationId: inputs.operationId,
    cohortLabel: inputs.cohortLabel,
    selectedCount: inputs.selectedCount,
    cohortIdentitySha256: inputs.cohortIdentitySha256,
    splitLockedSanityIdentitySha256: inputs.splitLockedSanityIdentitySha256,
    splitManifestSha256: inputs.splitManifestSha256,
    freezeReceipt: inputs.freezeReceipt,
    lockedRunMarker: inputs.lockedRunMarker,
    lockedRunMarkerSha256: lockedRunMarkerSha256(inputs.lockedRunMarker),
    evaluationReportSha256: inputs.evaluationReportSha256,
  }
  return {
    ...body,
    evidenceSha256: checksumBody({ ...body, evidenceSha256: '' }, 'evidenceSha256'),
  }
}

export interface QualificationCriterion {
  readonly id: string
  readonly description: string
  readonly pass: boolean
  readonly detail: string
}

export interface QualificationReport {
  readonly version: string
  readonly cohortLabel: string
  readonly calibrationVersion: string
  readonly evidenceSha256: string
  readonly lockedRunMarkerSha256: string
  readonly qualified: boolean
  readonly criteria: readonly QualificationCriterion[]
}

export interface QualificationInputs {
  /** The checksum-bound evidence. Without it there is no qualification, only an evaluation. */
  readonly evidence: QualificationEvidence
  readonly evaluation: EvaluationReport
  /** Count of physician systematic-miss flags recorded against this cohort so far. */
  readonly systematicMissFlagCount: number
  /** True when every locked-cohort high-confidence negative is present in the review queue. */
  readonly reviewInterfaceCoversAllHighConfidenceNegatives: boolean
  /**
   * Locked-run markers already consumed by a previous qualification. A pristine run is spent
   * once; re-qualifying from it needs a new calibration version and an owner decision.
   */
  readonly observedRunMarkerSha256s: readonly string[]
}

function refuse(message: string): never {
  throw new QualificationEvidenceError(message)
}

/** Re-derive and re-compare every binding in the evidence before any criterion is scored. */
function assertQualificationEvidence(inputs: QualificationInputs): void {
  const { evidence, evaluation } = inputs
  if (!evidence || typeof evidence !== 'object') refuse('Qualification requires bound evidence.')
  if (evidence.evidenceVersion !== LUNA_QUALIFICATION_EVIDENCE_VERSION) {
    refuse('The qualification evidence is from another evidence version.')
  }
  if (evidence.qualificationVersion !== LUNA_QUALIFICATION_VERSION) {
    refuse('The qualification evidence names another qualification version.')
  }
  if (checksumBody({ ...evidence }, 'evidenceSha256') !== evidence.evidenceSha256) {
    refuse('The qualification evidence checksum does not bind its own contents.')
  }

  if (
    evidence.cohortLabel !== LUNA_LOCKED_SANITY_COHORT_LABEL ||
    evaluation.cohortLabel !== LUNA_LOCKED_SANITY_COHORT_LABEL
  ) {
    refuse(
      `Qualification is defined only for the frozen ${LUNA_LOCKED_SANITY_COHORT_LABEL} cohort; ` +
        `this evaluation is labelled ${evaluation.cohortLabel}.`,
    )
  }
  if (
    evidence.selectedCount !== LUNA_LOCKED_SANITY_COHORT_SIZE ||
    evaluation.denominators.selected !== LUNA_LOCKED_SANITY_COHORT_SIZE
  ) {
    refuse(
      `Qualification requires exactly ${LUNA_LOCKED_SANITY_COHORT_SIZE} selected records; this ` +
        `evaluation selected ${evaluation.denominators.selected}.`,
    )
  }
  if (evidence.cohortIdentitySha256 !== evidence.splitLockedSanityIdentitySha256) {
    refuse(
      'The evaluated cohort identities are not exactly the frozen locked-sanity identities; ' +
        'refusing to qualify.',
    )
  }
  if (!/^[0-9a-f]{64}$/u.test(evidence.cohortIdentitySha256)) {
    refuse('The locked cohort identity digest is malformed.')
  }

  const receipt = evidence.freezeReceipt
  if (!receipt || typeof receipt !== 'object') refuse('Qualification requires a freeze receipt.')
  if (receipt.receiptVersion !== LUNA_FREEZE_RECEIPT_VERSION) {
    refuse('The freeze receipt is from another receipt version.')
  }
  if (checksumBody({ ...receipt }, 'receiptSha256') !== receipt.receiptSha256) {
    refuse('The freeze receipt checksum does not bind its own contents.')
  }
  if (receipt.calibrationVersion !== evidence.calibrationVersion) {
    refuse('The freeze receipt names a different calibration version.')
  }
  if (receipt.splitManifestSha256 !== evidence.splitManifestSha256) {
    refuse('The freeze receipt names a different split manifest.')
  }
  for (const [label, frozen, current] of [
    ['output-schema hash', receipt.outputSchemaSha256, outputSchemaSha256()],
    ['reason-vocabulary hash', receipt.reasonVocabularySha256, reasonVocabularySha256()],
    ['stage-a contract version', receipt.stageAContractVersion, STAGE_A_CONTRACT_VERSION],
    ['packet-schema version', receipt.packetSchemaVersion, UNIVERSAL_PACKET_SCHEMA_VERSION],
    ['risk-lexicon version', receipt.riskLexiconVersion, COORDINATOR_RISK_LEXICON_VERSION],
    ['evaluation version', receipt.evaluationVersion, LUNA_EVALUATION_VERSION],
    ['cost-estimator version', receipt.costEstimatorVersion, LUNA_COST_ESTIMATOR_VERSION],
  ] as const) {
    if (frozen !== current) {
      refuse(`The frozen ${label} no longer matches what would run; freeze a new calibration.`)
    }
  }
  if (evaluation.version !== receipt.evaluationVersion) {
    refuse('The evaluation artifact was produced by another evaluation version.')
  }
  if (!/^[0-9a-f]{64}$/u.test(receipt.promptSha256)) {
    refuse('The frozen prompt hash is malformed.')
  }

  const marker = evidence.lockedRunMarker
  if (!marker || typeof marker !== 'object') refuse('Qualification requires a locked-run marker.')
  if (lockedRunMarkerSha256(marker) !== evidence.lockedRunMarkerSha256) {
    refuse('The locked-run marker digest does not bind the marker; refusing to qualify.')
  }
  if (marker.calibrationVersion !== evidence.calibrationVersion) {
    refuse('The locked-run marker belongs to another calibration version.')
  }
  if (marker.operationId !== evidence.operationId) {
    refuse('The locked-run marker belongs to another operation.')
  }
  if (inputs.observedRunMarkerSha256s.includes(evidence.lockedRunMarkerSha256)) {
    refuse(
      'This locked run was already observed; a spent pristine run cannot be relabelled or ' +
        'rerun without a new calibration version and an explicit owner decision.',
    )
  }

  if (evaluationReportSha256(evaluation) !== evidence.evaluationReportSha256) {
    refuse('The evaluation artifact changed after the run; refusing to qualify.')
  }
  if (!evaluation.truthAvailable || !evaluation.negativeBucket || !evaluation.falseExclusions) {
    throw new Error('Qualification requires a truth-scored evaluation of the locked cohort.')
  }
}

export function buildQualificationReport(inputs: QualificationInputs): QualificationReport {
  assertQualificationEvidence(inputs)
  const { evaluation } = inputs
  const bucket = evaluation.negativeBucket as NonNullable<EvaluationReport['negativeBucket']>
  const falseExclusions = evaluation.falseExclusions as NonNullable<
    EvaluationReport['falseExclusions']
  >
  const byProfile = falseExclusions.routingFalseExclusionsByEvidenceProfile
  const yieldRate = evaluation.routedExcludeYieldAllExcludes

  const criteria: QualificationCriterion[] = [
    {
      id: 'no_include_core_in_bucket',
      description: 'Zero include_core records in high-confidence obvious_irrelevant.',
      pass: bucket.includeCoreCount === 0,
      detail: `include_core in bucket: ${bucket.includeCoreCount}`,
    },
    {
      id: 'no_include_adjacent_in_bucket',
      description: 'Zero include_adjacent records in high-confidence obvious_irrelevant.',
      pass: bucket.includeAdjacentCount === 0,
      detail: `include_adjacent in bucket: ${bucket.includeAdjacentCount}`,
    },
    {
      id: 'no_relevant_routing_errors_either_profile',
      description:
        'Zero physician-relevant false-negative routing errors in both evidence profiles.',
      pass: byProfile.metadata_with_abstract === 0 && byProfile.metadata_without_abstract === 0,
      detail:
        `with_abstract: ${byProfile.metadata_with_abstract}, ` +
        `without_abstract: ${byProfile.metadata_without_abstract}`,
    },
    {
      id: 'bucket_precision_100',
      description: '100% observed precision of the high-confidence obvious-negative bucket.',
      pass: bucket.count === 0 || bucket.observedPrecisionBucket === 1,
      detail:
        bucket.count === 0
          ? 'bucket empty (vacuously precise; yield criterion will fail)'
          : `observed precision: ${bucket.observedPrecisionBucket}`,
    },
    {
      id: 'exclude_yield_minimum',
      description:
        `At least ${LUNA_MINIMUM_EXCLUDE_YIELD * 100}% of physician-reviewed excludes enter ` +
        'the deprioritization pool.',
      pass: yieldRate !== null && yieldRate >= LUNA_MINIMUM_EXCLUDE_YIELD,
      detail: `routed exclude yield: ${yieldRate ?? 'null'}`,
    },
    {
      id: 'no_systematic_category_miss',
      description:
        'No systematic category miss: no relevant record in the pool within any subgroup and ' +
        'no physician systematic-miss flag.',
      pass:
        inputs.systematicMissFlagCount === 0 &&
        falseExclusions.routingFalseExclusions === 0 &&
        bucket.lowRiskIncludeCoreCount === 0 &&
        bucket.lowRiskIncludeAdjacentCount === 0,
      detail:
        `systematic-miss flags: ${inputs.systematicMissFlagCount}; relevant records in ` +
        `pool: ${falseExclusions.routingFalseExclusions}`,
    },
    {
      id: 'complete_denominator_accounting',
      description: 'Complete denominator accounting over the locked cohort.',
      pass:
        evaluation.reconciliation.attemptedPlusNoAttemptEqualsSelected &&
        evaluation.reconciliation.terminalStatesSumToSelected &&
        evaluation.reconciliation.attemptedStatesSumToAttempted,
      detail: `reconciliation: ${JSON.stringify(evaluation.reconciliation)}`,
    },
    {
      id: 'review_interface_coverage',
      description:
        'Every high-confidence negative in the locked cohort is available in the ' +
        'physician-review interface.',
      pass: inputs.reviewInterfaceCoversAllHighConfidenceNegatives,
      detail: inputs.reviewInterfaceCoversAllHighConfidenceNegatives
        ? 'review queue covers the bucket'
        : 'review queue is missing bucket records',
    },
  ]
  return {
    version: LUNA_QUALIFICATION_VERSION,
    cohortLabel: evaluation.cohortLabel,
    calibrationVersion: inputs.evidence.calibrationVersion,
    evidenceSha256: inputs.evidence.evidenceSha256,
    lockedRunMarkerSha256: inputs.evidence.lockedRunMarkerSha256,
    qualified: criteria.every((criterion) => criterion.pass),
    criteria,
  }
}
