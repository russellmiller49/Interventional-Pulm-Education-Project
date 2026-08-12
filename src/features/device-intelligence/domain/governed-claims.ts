import { z } from 'zod'

import { stableSnapshotHash, stableStringify } from '@/features/preference-cards/domain/stable-hash'

/**
 * A read-only governance contract for claims that might eventually feed governed authoring.
 *
 * This module deliberately has no loader, route, persistence adapter, release writer, or runtime
 * consumer. It describes the evidence and review record a future adapter would have to present
 * before a claim could cross a lifecycle gate. In particular, a research candidate is data for a
 * review queue, never runtime product data.
 */

export const GOVERNED_CLAIM_FORMAT_VERSION = '1.0' as const
export const GOVERNED_CLAIM_HASH_VERSION = 'device-intelligence-governed-claim/1' as const
export const GOVERNED_CLAIM_IMPACT_REPORT_VERSION =
  'device-intelligence-governed-claim-impact/1' as const

export const governedClaimLifecycleStates = [
  'research_candidate',
  'physician_review_required',
  'approved_for_governed_authoring',
  'published_in_forward_release',
  'superseded',
  'historical_retained',
] as const

export const governedClaimTypes = [
  'identity',
  'manufacturer_specification',
  'regulatory_status',
  'compatibility',
  'clinical_role_mapping',
  'procedure_requirement',
  'setup_instruction',
  'evidence_limitation',
] as const

const governedStatesRequiringApproval = new Set<GovernedClaimLifecycleState>([
  'approved_for_governed_authoring',
  'published_in_forward_release',
  'superseded',
  'historical_retained',
])
const publishedOrHistoricalStates = new Set<GovernedClaimLifecycleState>([
  'published_in_forward_release',
  'superseded',
  'historical_retained',
])

const forbiddenGenericClaimTypePattern = /equival|substitut|interchange|alternative[_ -]?product/iu
const nonBlankStringSchema = z.string().trim().min(1)
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u)
const instantSchema = z.string().datetime({ offset: true })

export const personReferenceSchema = z
  .object({
    personId: nonBlankStringSchema,
    displayName: nonBlankStringSchema,
  })
  .strict()

export const physicianOwnerSchema = personReferenceSchema
  .extend({
    qualification: z.literal('physician'),
  })
  .strict()

export const claimTargetsSchema = z
  .object({
    affectedProductIds: z.array(nonBlankStringSchema),
    affectedRoleCodes: z.array(nonBlankStringSchema),
    affectedProcedureCodes: z.array(nonBlankStringSchema),
  })
  .strict()

export const claimScopeSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('exact_model'),
      productId: nonBlankStringSchema,
      manufacturer: nonBlankStringSchema,
      modelName: nonBlankStringSchema,
      catalogNumber: nonBlankStringSchema.nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('reviewed_family'),
      productFamilyVersionId: nonBlankStringSchema,
      manufacturer: nonBlankStringSchema,
      familyName: nonBlankStringSchema,
      /** Explicit frozen membership; never a label-derived predicate. */
      memberProductIds: z.array(nonBlankStringSchema).min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('non_product'),
      rationale: nonBlankStringSchema,
    })
    .strict(),
])

export const jurisdictionSchema = z
  .object({
    code: nonBlankStringSchema,
    label: nonBlankStringSchema,
    level: z.enum(['manufacturer_global', 'country', 'region', 'institution']),
  })
  .strict()

export const evidenceApplicabilitySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('exact_model'), productId: nonBlankStringSchema }).strict(),
  z
    .object({
      kind: z.literal('family_evidence'),
      productFamilyVersionId: nonBlankStringSchema,
      /**
       * Null is a legitimate research state. It becomes blocking if this evidence is used to
       * approve an exact-model claim.
       */
      qualification: z
        .object({
          qualifiedProductIds: z.array(nonBlankStringSchema).min(1),
          basis: nonBlankStringSchema,
          reviewedBy: personReferenceSchema,
          reviewedAt: instantSchema,
        })
        .strict()
        .nullable(),
    })
    .strict(),
  z.object({ kind: z.literal('role'), roleCode: nonBlankStringSchema }).strict(),
  z.object({ kind: z.literal('procedure'), procedureCode: nonBlankStringSchema }).strict(),
])

export const claimEvidenceSchema = z
  .object({
    evidenceId: nonBlankStringSchema,
    sourceIdentity: z
      .object({
        sourceId: nonBlankStringSchema,
        publisher: nonBlankStringSchema,
        title: nonBlankStringSchema,
        documentIdentifier: nonBlankStringSchema,
        sourceUrl: z.string().url().nullable(),
      })
      .strict(),
    sourceRevision: z
      .object({
        revisionId: nonBlankStringSchema,
        issuedAt: instantSchema,
        accessedAt: instantSchema,
      })
      .strict(),
    jurisdiction: jurisdictionSchema,
    locator: nonBlankStringSchema,
    sourceType: z.enum([
      'manufacturer_labeling',
      'manufacturer_ifu',
      'manufacturer_manual',
      'regulator_record',
      'regulator_guidance',
      'peer_reviewed_literature',
      'professional_society_guidance',
      'internal_review_record',
    ]),
    evidenceClass: z.enum(['primary', 'secondary', 'contextual']),
    decisionUse: z.enum(['primary_claim_support', 'corroborating', 'context_only', 'conflicting']),
    applicability: evidenceApplicabilitySchema,
  })
  .strict()

export const evidenceConflictSchema = z
  .object({
    conflictId: nonBlankStringSchema,
    evidenceIds: z.array(nonBlankStringSchema).min(2),
    summary: nonBlankStringSchema,
    status: z.enum(['unresolved', 'resolved_for_claim']),
    resolutionRationale: nonBlankStringSchema.nullable(),
    resolvedByReviewId: nonBlankStringSchema.nullable(),
  })
  .strict()

export const claimStalenessPolicySchema = z
  .object({
    thresholdDays: z.number().int().positive(),
    basis: z.enum(['latest_primary_evidence_revision', 'latest_physician_approval']),
    rationale: nonBlankStringSchema,
  })
  .strict()

export const claimReviewSchema = z
  .object({
    reviewId: nonBlankStringSchema,
    claimId: nonBlankStringSchema,
    claimContentHash: sha256Schema,
    evidenceSetHash: sha256Schema,
    physicianOwnerId: nonBlankStringSchema.nullable(),
    reviewer: personReferenceSchema.extend({
      reviewerRole: z.enum([
        'physician',
        'clinical_sme',
        'evidence_reviewer',
        'governance_reviewer',
      ]),
    }),
    reviewedAt: instantSchema,
    decision: z.enum(['approved', 'changes_required', 'rejected']),
    rationale: nonBlankStringSchema,
  })
  .strict()

export const releaseImpactAssessmentSchema = z
  .object({
    sequence: z.number().int().positive(),
    assessmentId: nonBlankStringSchema,
    releaseBundleId: nonBlankStringSchema,
    relationship: z.enum([
      'potentially_affected',
      'planned_forward_release',
      'published_forward_release',
      'historical_reference',
    ]),
    impact: z.enum(['content_change_required', 'review_only', 'no_runtime_change']),
    assessedAt: instantSchema,
    assessedBy: personReferenceSchema,
    rationale: nonBlankStringSchema,
  })
  .strict()

export const implementationRecordSchema = z
  .object({
    sequence: z.number().int().positive(),
    status: z.enum([
      'not_started',
      'governed_authoring_ready',
      'implemented_in_draft',
      'verified_in_forward_release',
      'historical_only',
    ]),
    recordedAt: instantSchema,
    recordedBy: personReferenceSchema,
    releaseBundleId: nonBlankStringSchema.nullable(),
    artifactPaths: z.array(nonBlankStringSchema),
    rationale: nonBlankStringSchema,
  })
  .strict()

export const historicalRetentionSchema = z
  .object({
    policy: z.literal('append_only_indefinite'),
    retainedAt: instantSchema.nullable(),
    retainedBy: personReferenceSchema.nullable(),
    rationale: nonBlankStringSchema,
  })
  .strict()

export const governedClaimTransitionSchema = z
  .object({
    sequence: z.number().int().positive(),
    transitionId: nonBlankStringSchema,
    claimId: nonBlankStringSchema,
    fromState: z.enum(governedClaimLifecycleStates).nullable(),
    toState: z.enum(governedClaimLifecycleStates),
    occurredAt: instantSchema,
    actor: personReferenceSchema,
    rationale: nonBlankStringSchema,
    claimContentHash: sha256Schema,
    evidenceSetHash: sha256Schema,
    releaseBundleId: nonBlankStringSchema.nullable(),
    supersedingClaimId: nonBlankStringSchema.nullable(),
  })
  .strict()

export const governedClaimSchema = z
  .object({
    formatVersion: z.literal(GOVERNED_CLAIM_FORMAT_VERSION),
    claimId: nonBlankStringSchema,
    claimStatement: nonBlankStringSchema,
    claimType: z.enum(governedClaimTypes),
    targets: claimTargetsSchema,
    scope: claimScopeSchema,
    evidence: z.array(claimEvidenceSchema),
    evidenceConflicts: z.array(evidenceConflictSchema),
    stalenessPolicy: claimStalenessPolicySchema,
    physicianOwner: physicianOwnerSchema.nullable(),
    reviews: z.array(claimReviewSchema),
    affectedReleaseAssessments: z.array(releaseImpactAssessmentSchema),
    implementationHistory: z.array(implementationRecordSchema).min(1),
    supersedesClaimIds: z.array(nonBlankStringSchema),
    supersedingClaimId: nonBlankStringSchema.nullable(),
    historicalRetention: historicalRetentionSchema,
    claimContentHash: sha256Schema,
    evidenceSetHash: sha256Schema,
    lifecycleState: z.enum(governedClaimLifecycleStates),
    transitions: z.array(governedClaimTransitionSchema).min(1),
  })
  .strict()

export const governedClaimLedgerSchema = z
  .object({
    formatVersion: z.literal(GOVERNED_CLAIM_FORMAT_VERSION),
    claims: z.array(governedClaimSchema),
  })
  .strict()

export type PersonReference = z.infer<typeof personReferenceSchema>
export type PhysicianOwner = z.infer<typeof physicianOwnerSchema>
export type ClaimTargets = z.infer<typeof claimTargetsSchema>
export type ClaimScope = z.infer<typeof claimScopeSchema>
export type ClaimEvidence = z.infer<typeof claimEvidenceSchema>
export type EvidenceConflict = z.infer<typeof evidenceConflictSchema>
export type ClaimStalenessPolicy = z.infer<typeof claimStalenessPolicySchema>
export type ClaimReview = z.infer<typeof claimReviewSchema>
export type ReleaseImpactAssessment = z.infer<typeof releaseImpactAssessmentSchema>
export type ImplementationRecord = z.infer<typeof implementationRecordSchema>
export type HistoricalRetention = z.infer<typeof historicalRetentionSchema>
export type GovernedClaimTransition = z.infer<typeof governedClaimTransitionSchema>
export type GovernedClaim = z.infer<typeof governedClaimSchema>
export type GovernedClaimLedger = z.infer<typeof governedClaimLedgerSchema>
export type GovernedClaimLifecycleState = (typeof governedClaimLifecycleStates)[number]
export type GovernedClaimType = (typeof governedClaimTypes)[number]

const nextLifecycleState: Readonly<
  Record<GovernedClaimLifecycleState, GovernedClaimLifecycleState | null>
> = {
  research_candidate: 'physician_review_required',
  physician_review_required: 'approved_for_governed_authoring',
  approved_for_governed_authoring: 'published_in_forward_release',
  published_in_forward_release: 'superseded',
  superseded: 'historical_retained',
  historical_retained: null,
}

const implementationStatusOrder: ReadonlyArray<ImplementationRecord['status']> = [
  'not_started',
  'governed_authoring_ready',
  'implemented_in_draft',
  'verified_in_forward_release',
  'historical_only',
]

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function canonicalPerson(person: PersonReference): PersonReference {
  return { personId: person.personId, displayName: person.displayName }
}

function canonicalScope(scope: ClaimScope): ClaimScope {
  if (scope.kind !== 'reviewed_family') return scope
  return { ...scope, memberProductIds: sortedUnique(scope.memberProductIds) }
}

function canonicalEvidence(evidence: readonly ClaimEvidence[]): ClaimEvidence[] {
  return [...evidence]
    .map((entry) =>
      entry.applicability.kind === 'family_evidence' && entry.applicability.qualification
        ? {
            ...entry,
            applicability: {
              ...entry.applicability,
              qualification: {
                ...entry.applicability.qualification,
                qualifiedProductIds: sortedUnique(
                  entry.applicability.qualification.qualifiedProductIds,
                ),
              },
            },
          }
        : entry,
    )
    .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId))
}

export function governedClaimContentHash(input: {
  claimId: string
  claimStatement: string
  claimType: GovernedClaimType
  targets: ClaimTargets
  scope: ClaimScope
  supersedesClaimIds: readonly string[]
  stalenessPolicy: ClaimStalenessPolicy
  historicalRetention: Pick<HistoricalRetention, 'policy' | 'rationale'>
}): string {
  return stableSnapshotHash({
    v: GOVERNED_CLAIM_HASH_VERSION,
    kind: 'governed-claim-content',
    payload: {
      claimId: input.claimId,
      claimStatement: input.claimStatement,
      claimType: input.claimType,
      targets: {
        affectedProductIds: sortedUnique(input.targets.affectedProductIds),
        affectedRoleCodes: sortedUnique(input.targets.affectedRoleCodes),
        affectedProcedureCodes: sortedUnique(input.targets.affectedProcedureCodes),
      },
      scope: canonicalScope(input.scope),
      supersedesClaimIds: sortedUnique(input.supersedesClaimIds),
      stalenessPolicy: input.stalenessPolicy,
      historicalRetention: {
        policy: input.historicalRetention.policy,
        rationale: input.historicalRetention.rationale,
      },
    },
  })
}

function canonicalConflicts(conflicts: readonly EvidenceConflict[]): EvidenceConflict[] {
  return [...conflicts]
    .map((conflict) => ({ ...conflict, evidenceIds: sortedUnique(conflict.evidenceIds) }))
    .sort((left, right) => left.conflictId.localeCompare(right.conflictId))
}

export function governedClaimEvidenceSetHash(
  evidence: readonly ClaimEvidence[],
  evidenceConflicts: readonly EvidenceConflict[] = [],
): string {
  return stableSnapshotHash({
    v: GOVERNED_CLAIM_HASH_VERSION,
    kind: 'governed-claim-evidence-set',
    payload: {
      evidence: canonicalEvidence(evidence),
      evidenceConflicts: canonicalConflicts(evidenceConflicts),
    },
  })
}

export interface CreateResearchCandidateInput {
  claimId: string
  claimStatement: string
  claimType: GovernedClaimType
  targets: ClaimTargets
  scope: ClaimScope
  evidence: ClaimEvidence[]
  evidenceConflicts: EvidenceConflict[]
  stalenessPolicy: ClaimStalenessPolicy
  physicianOwner: PhysicianOwner | null
  affectedReleaseAssessments?: ReleaseImpactAssessment[]
  supersedesClaimIds?: string[]
  historicalRetentionRationale: string
  createdAt: string
  createdBy: PersonReference
  creationRationale: string
}

/** Create a normalized fictional/research record; this does not make it runtime eligible. */
export function createResearchCandidate(input: CreateResearchCandidateInput): GovernedClaim {
  const targets: ClaimTargets = {
    affectedProductIds: sortedUnique(input.targets.affectedProductIds),
    affectedRoleCodes: sortedUnique(input.targets.affectedRoleCodes),
    affectedProcedureCodes: sortedUnique(input.targets.affectedProcedureCodes),
  }
  const scope = canonicalScope(input.scope)
  const evidence = canonicalEvidence(input.evidence)
  const evidenceConflicts = canonicalConflicts(input.evidenceConflicts)
  const supersedesClaimIds = sortedUnique(input.supersedesClaimIds ?? [])
  const historicalRetention: HistoricalRetention = {
    policy: 'append_only_indefinite',
    retainedAt: null,
    retainedBy: null,
    rationale: input.historicalRetentionRationale,
  }
  const claimContentHash = governedClaimContentHash({
    claimId: input.claimId,
    claimStatement: input.claimStatement,
    claimType: input.claimType,
    targets,
    scope,
    supersedesClaimIds,
    stalenessPolicy: input.stalenessPolicy,
    historicalRetention,
  })
  const evidenceSetHash = governedClaimEvidenceSetHash(evidence, evidenceConflicts)
  const candidate: GovernedClaim = {
    formatVersion: GOVERNED_CLAIM_FORMAT_VERSION,
    claimId: input.claimId,
    claimStatement: input.claimStatement,
    claimType: input.claimType,
    targets,
    scope,
    evidence,
    evidenceConflicts,
    stalenessPolicy: input.stalenessPolicy,
    physicianOwner: input.physicianOwner,
    reviews: [],
    affectedReleaseAssessments: [...(input.affectedReleaseAssessments ?? [])].sort(
      (left, right) => left.sequence - right.sequence,
    ),
    implementationHistory: [
      {
        sequence: 1,
        status: 'not_started',
        recordedAt: input.createdAt,
        recordedBy: canonicalPerson(input.createdBy),
        releaseBundleId: null,
        artifactPaths: [],
        rationale: 'Research candidate only; no governed implementation has started.',
      },
    ],
    supersedesClaimIds,
    supersedingClaimId: null,
    historicalRetention,
    claimContentHash,
    evidenceSetHash,
    lifecycleState: 'research_candidate',
    transitions: [
      {
        sequence: 1,
        transitionId: `${input.claimId}:transition:1`,
        claimId: input.claimId,
        fromState: null,
        toState: 'research_candidate',
        occurredAt: input.createdAt,
        actor: canonicalPerson(input.createdBy),
        rationale: input.creationRationale,
        claimContentHash,
        evidenceSetHash,
        releaseBundleId: null,
        supersedingClaimId: null,
      },
    ],
  }
  return governedClaimSchema.parse(candidate)
}

export interface GovernanceValidationMessage {
  code: GovernanceValidationCode
  severity: 'blocking' | 'warning'
  claimId: string
  message: string
}

export type GovernanceValidationCode =
  | 'claim_schema_invalid'
  | 'generic_equivalence_or_substitution_claim_type'
  | 'claim_content_hash_mismatch'
  | 'evidence_set_hash_mismatch'
  | 'claim_target_missing'
  | 'claim_target_duplicate'
  | 'claim_scope_target_mismatch'
  | 'evidence_id_duplicate'
  | 'evidence_conflict_id_duplicate'
  | 'source_revision_missing'
  | 'source_revision_temporal_invalid'
  | 'evidence_conflict_reference_missing'
  | 'evidence_conflict_reference_duplicate'
  | 'resolved_conflict_without_disposition'
  | 'resolved_conflict_review_missing'
  | 'approved_with_unresolved_evidence_conflict'
  | 'approved_without_named_physician_owner'
  | 'governed_state_without_evidence'
  | 'approval_signoff_missing'
  | 'approval_signoff_binding_mismatch'
  | 'model_approval_from_unqualified_family_evidence'
  | 'compatibility_approval_without_primary_evidence'
  | 'transition_history_invalid'
  | 'transition_binding_mismatch'
  | 'review_id_duplicate'
  | 'release_assessment_history_invalid'
  | 'release_assessment_id_duplicate'
  | 'implementation_history_invalid'
  | 'history_timestamp_invalid'
  | 'published_without_forward_release_evidence'
  | 'silent_supersession'
  | 'historical_retention_missing'
  | 'claim_id_mutated'
  | 'claim_content_mutated_in_place'
  | 'source_revision_loss'
  | 'append_only_history_rewritten'
  | 'historical_deletion_forbidden'
  | 'claim_duplicate'
  | 'superseding_claim_missing'
  | 'superseding_claim_not_published'
  | 'supersession_backlink_missing'
  | 'supersession_cycle'

function message(
  code: GovernanceValidationCode,
  claimId: string,
  text: string,
  severity: GovernanceValidationMessage['severity'] = 'blocking',
): GovernanceValidationMessage {
  return { code, severity, claimId, message: text }
}

function sortMessages(messages: GovernanceValidationMessage[]): GovernanceValidationMessage[] {
  return messages.sort(
    (left, right) =>
      left.claimId.localeCompare(right.claimId) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  )
}

function rawClaimId(input: unknown): string {
  if (input && typeof input === 'object' && 'claimId' in input) {
    const value = (input as { claimId?: unknown }).claimId
    if (typeof value === 'string' && value.trim()) return value
  }
  return '<unknown-claim>'
}

function preSchemaMessages(input: unknown): GovernanceValidationMessage[] {
  if (!input || typeof input !== 'object') return []
  const record = input as Record<string, unknown>
  const claimId = rawClaimId(input)
  const messages: GovernanceValidationMessage[] = []
  if (
    typeof record.claimType === 'string' &&
    forbiddenGenericClaimTypePattern.test(record.claimType)
  ) {
    messages.push(
      message(
        'generic_equivalence_or_substitution_claim_type',
        claimId,
        `Claim type "${record.claimType}" is forbidden. Equivalence, substitution, interchangeability, and alternative-product decisions require a separately designed governed contract; a generic claim cannot approve them.`,
      ),
    )
  }
  if (Array.isArray(record.evidence)) {
    for (const rawEvidence of record.evidence) {
      if (!rawEvidence || typeof rawEvidence !== 'object') continue
      const revision = (rawEvidence as Record<string, unknown>).sourceRevision
      if (
        !revision ||
        typeof revision !== 'object' ||
        typeof (revision as Record<string, unknown>).revisionId !== 'string' ||
        !(revision as Record<string, unknown>).revisionId
      ) {
        messages.push(
          message(
            'source_revision_missing',
            claimId,
            'Every evidence source must retain an explicit source revision; an absent revision cannot be treated as current.',
          ),
        )
      }
    }
  }
  return messages
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicate = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value)
    seen.add(value)
  }
  return [...duplicate].sort()
}

function scopeSupportsExactModel(evidence: ClaimEvidence, productId: string): boolean {
  if (evidence.applicability.kind === 'exact_model') {
    return evidence.applicability.productId === productId
  }
  if (evidence.applicability.kind !== 'family_evidence') return false
  const qualification = evidence.applicability.qualification
  return qualification !== null && qualification.qualifiedProductIds.includes(productId)
}

function primaryEvidenceCoversReviewedFamily(
  evidence: readonly ClaimEvidence[],
  scope: Extract<ClaimScope, { kind: 'reviewed_family' }>,
): boolean {
  const primarySupport = evidence.filter((entry) => entry.decisionUse === 'primary_claim_support')
  const familyQualification = primarySupport.some((entry) => {
    if (
      entry.applicability.kind !== 'family_evidence' ||
      entry.applicability.productFamilyVersionId !== scope.productFamilyVersionId ||
      !entry.applicability.qualification
    ) {
      return false
    }
    const qualified = new Set(entry.applicability.qualification.qualifiedProductIds)
    return scope.memberProductIds.every((productId) => qualified.has(productId))
  })
  if (familyQualification) return true
  const exactModels = new Set(
    primarySupport.flatMap((entry) =>
      entry.applicability.kind === 'exact_model' ? [entry.applicability.productId] : [],
    ),
  )
  return scope.memberProductIds.every((productId) => exactModels.has(productId))
}

function primaryEvidenceCoversClaimScope(claim: GovernedClaim): boolean {
  const primary = claim.evidence.filter(
    (entry) => entry.evidenceClass === 'primary' && entry.decisionUse === 'primary_claim_support',
  )
  if (claim.scope.kind === 'exact_model') {
    const exactModelProductId = claim.scope.productId
    return primary.some((entry) => scopeSupportsExactModel(entry, exactModelProductId))
  }
  if (claim.scope.kind === 'reviewed_family') {
    return primaryEvidenceCoversReviewedFamily(primary, claim.scope)
  }
  return primary.some(
    (entry) =>
      (entry.applicability.kind === 'role' &&
        claim.targets.affectedRoleCodes.includes(entry.applicability.roleCode)) ||
      (entry.applicability.kind === 'procedure' &&
        claim.targets.affectedProcedureCodes.includes(entry.applicability.procedureCode)),
  )
}

function validateTransitionHistory(claim: GovernedClaim): GovernanceValidationMessage[] {
  const messages: GovernanceValidationMessage[] = []
  let expectedFrom: GovernedClaimLifecycleState | null = null
  for (const [index, transition] of claim.transitions.entries()) {
    const expectedTo =
      expectedFrom === null ? 'research_candidate' : nextLifecycleState[expectedFrom]
    if (
      transition.sequence !== index + 1 ||
      transition.claimId !== claim.claimId ||
      transition.fromState !== expectedFrom ||
      transition.toState !== expectedTo
    ) {
      messages.push(
        message(
          'transition_history_invalid',
          claim.claimId,
          `Transition ${transition.transitionId} is not the next append-only lifecycle step at sequence ${index + 1}.`,
        ),
      )
    }
    if (
      transition.claimContentHash !== claim.claimContentHash ||
      transition.evidenceSetHash !== claim.evidenceSetHash
    ) {
      messages.push(
        message(
          'transition_binding_mismatch',
          claim.claimId,
          `Transition ${transition.transitionId} is not bound to this exact claim content and evidence set.`,
        ),
      )
    }
    expectedFrom = transition.toState
  }
  if (expectedFrom !== claim.lifecycleState) {
    messages.push(
      message(
        'transition_history_invalid',
        claim.claimId,
        `Lifecycle state ${claim.lifecycleState} does not equal the final transition state ${expectedFrom ?? 'none'}.`,
      ),
    )
  }
  return messages
}

function validateSequentialHistory(
  claimId: string,
  history: readonly { sequence: number }[],
  code: 'release_assessment_history_invalid' | 'implementation_history_invalid',
  label: string,
): GovernanceValidationMessage[] {
  const messages: GovernanceValidationMessage[] = []
  for (const [index, entry] of history.entries()) {
    if (entry.sequence !== index + 1) {
      messages.push(
        message(
          code,
          claimId,
          `${label} sequence must be contiguous and append-only; entry ${index + 1} records ${entry.sequence}.`,
        ),
      )
    }
  }
  return messages
}

function validateTimestampOrder<Entry>(
  claimId: string,
  entries: readonly Entry[],
  instant: (entry: Entry) => string,
  label: string,
): GovernanceValidationMessage[] {
  const messages: GovernanceValidationMessage[] = []
  let previous = Number.NEGATIVE_INFINITY
  for (const [index, entry] of entries.entries()) {
    const current = Date.parse(instant(entry))
    if (current < previous) {
      messages.push(
        message(
          'history_timestamp_invalid',
          claimId,
          `${label} timestamp at sequence ${index + 1} precedes the retained prior entry.`,
        ),
      )
    }
    previous = current
  }
  return messages
}

function latestImplementation(claim: GovernedClaim): ImplementationRecord {
  return claim.implementationHistory[claim.implementationHistory.length - 1]
}

function validateTypedClaim(claim: GovernedClaim): GovernanceValidationMessage[] {
  const messages: GovernanceValidationMessage[] = []
  const expectedContentHash = governedClaimContentHash(claim)
  const expectedEvidenceHash = governedClaimEvidenceSetHash(claim.evidence, claim.evidenceConflicts)
  if (expectedContentHash !== claim.claimContentHash) {
    messages.push(
      message(
        'claim_content_hash_mismatch',
        claim.claimId,
        `Claim content no longer hashes to its recorded identity (${claim.claimContentHash} → ${expectedContentHash}). Publish a new claim id instead of editing signed content.`,
      ),
    )
  }
  if (expectedEvidenceHash !== claim.evidenceSetHash) {
    messages.push(
      message(
        'evidence_set_hash_mismatch',
        claim.claimId,
        `Evidence no longer hashes to its recorded set (${claim.evidenceSetHash} → ${expectedEvidenceHash}). A revised evidence set requires a new review-bound claim record.`,
      ),
    )
  }

  const allTargets = [
    ...claim.targets.affectedProductIds,
    ...claim.targets.affectedRoleCodes,
    ...claim.targets.affectedProcedureCodes,
  ]
  if (allTargets.length === 0) {
    messages.push(
      message(
        'claim_target_missing',
        claim.claimId,
        'A governed claim must name at least one affected product, role, or procedure.',
      ),
    )
  }
  for (const [label, values] of [
    ['product', claim.targets.affectedProductIds],
    ['role', claim.targets.affectedRoleCodes],
    ['procedure', claim.targets.affectedProcedureCodes],
  ] as const) {
    const duplicate = duplicates(values)
    if (duplicate.length > 0) {
      messages.push(
        message(
          'claim_target_duplicate',
          claim.claimId,
          `Affected ${label} targets contain duplicate identities: ${duplicate.join(', ')}.`,
        ),
      )
    }
  }

  if (
    (claim.scope.kind === 'exact_model' &&
      stableStringify(sortedUnique(claim.targets.affectedProductIds)) !==
        stableStringify([claim.scope.productId])) ||
    (claim.scope.kind === 'reviewed_family' &&
      stableStringify(sortedUnique(claim.targets.affectedProductIds)) !==
        stableStringify(sortedUnique(claim.scope.memberProductIds))) ||
    (claim.scope.kind === 'non_product' && claim.targets.affectedProductIds.length > 0)
  ) {
    messages.push(
      message(
        'claim_scope_target_mismatch',
        claim.claimId,
        'The exact-model/family scope and affected product identities disagree. Product scope is explicit and must never be inferred from labels.',
      ),
    )
  }

  const evidenceIds = claim.evidence.map((entry) => entry.evidenceId)
  const duplicateEvidenceIds = duplicates(evidenceIds)
  if (duplicateEvidenceIds.length > 0) {
    messages.push(
      message(
        'evidence_id_duplicate',
        claim.claimId,
        `Evidence ids must be unique: ${duplicateEvidenceIds.join(', ')}.`,
      ),
    )
  }
  const evidenceIdSet = new Set(evidenceIds)
  for (const evidence of claim.evidence) {
    if (
      Date.parse(evidence.sourceRevision.issuedAt) > Date.parse(evidence.sourceRevision.accessedAt)
    ) {
      messages.push(
        message(
          'source_revision_temporal_invalid',
          claim.claimId,
          `Evidence ${evidence.evidenceId} records an access instant before the source revision was issued.`,
        ),
      )
    }
  }
  const duplicateConflictIds = duplicates(
    claim.evidenceConflicts.map((conflict) => conflict.conflictId),
  )
  if (duplicateConflictIds.length > 0) {
    messages.push(
      message(
        'evidence_conflict_id_duplicate',
        claim.claimId,
        `Evidence conflict ids must be unique: ${duplicateConflictIds.join(', ')}.`,
      ),
    )
  }
  for (const conflict of claim.evidenceConflicts) {
    if (sortedUnique(conflict.evidenceIds).length < 2) {
      messages.push(
        message(
          'evidence_conflict_reference_duplicate',
          claim.claimId,
          `Conflict ${conflict.conflictId} must name at least two distinct evidence records.`,
        ),
      )
    }
    const missing = conflict.evidenceIds.filter((evidenceId) => !evidenceIdSet.has(evidenceId))
    if (missing.length > 0) {
      messages.push(
        message(
          'evidence_conflict_reference_missing',
          claim.claimId,
          `Conflict ${conflict.conflictId} references evidence not retained by the claim: ${missing.join(', ')}.`,
        ),
      )
    }
    if (
      conflict.status === 'resolved_for_claim' &&
      (!conflict.resolutionRationale || !conflict.resolvedByReviewId)
    ) {
      messages.push(
        message(
          'resolved_conflict_without_disposition',
          claim.claimId,
          `Conflict ${conflict.conflictId} is marked resolved without both a rationale and binding review id.`,
        ),
      )
    }
    if (
      conflict.status === 'resolved_for_claim' &&
      conflict.resolvedByReviewId &&
      !claim.reviews.some(
        (review) =>
          review.reviewId === conflict.resolvedByReviewId && review.decision === 'approved',
      )
    ) {
      messages.push(
        message(
          'resolved_conflict_review_missing',
          claim.claimId,
          `Conflict ${conflict.conflictId} names no retained approving review ${conflict.resolvedByReviewId}.`,
        ),
      )
    }
  }

  messages.push(...validateTransitionHistory(claim))
  messages.push(
    ...validateTimestampOrder(
      claim.claimId,
      claim.transitions,
      (entry) => entry.occurredAt,
      'Lifecycle transition',
    ),
  )
  const duplicateReviewIds = duplicates(claim.reviews.map((review) => review.reviewId))
  if (duplicateReviewIds.length > 0) {
    messages.push(
      message(
        'review_id_duplicate',
        claim.claimId,
        `Review ids must be unique: ${duplicateReviewIds.join(', ')}.`,
      ),
    )
  }
  messages.push(
    ...validateTimestampOrder(claim.claimId, claim.reviews, (entry) => entry.reviewedAt, 'Review'),
  )
  const duplicateAssessmentIds = duplicates(
    claim.affectedReleaseAssessments.map((assessment) => assessment.assessmentId),
  )
  if (duplicateAssessmentIds.length > 0) {
    messages.push(
      message(
        'release_assessment_id_duplicate',
        claim.claimId,
        `Release-impact assessment ids must be unique: ${duplicateAssessmentIds.join(', ')}.`,
      ),
    )
  }
  messages.push(
    ...validateSequentialHistory(
      claim.claimId,
      claim.affectedReleaseAssessments,
      'release_assessment_history_invalid',
      'Affected-release assessment',
    ),
  )
  messages.push(
    ...validateTimestampOrder(
      claim.claimId,
      claim.affectedReleaseAssessments,
      (entry) => entry.assessedAt,
      'Affected-release assessment',
    ),
  )
  messages.push(
    ...validateSequentialHistory(
      claim.claimId,
      claim.implementationHistory,
      'implementation_history_invalid',
      'Implementation history',
    ),
  )
  messages.push(
    ...validateTimestampOrder(
      claim.claimId,
      claim.implementationHistory,
      (entry) => entry.recordedAt,
      'Implementation history',
    ),
  )
  for (const [index, entry] of claim.implementationHistory.entries()) {
    const previous =
      index === 0
        ? -1
        : implementationStatusOrder.indexOf(claim.implementationHistory[index - 1].status)
    const current = implementationStatusOrder.indexOf(entry.status)
    if ((index === 0 && entry.status !== 'not_started') || current !== previous + 1) {
      messages.push(
        message(
          'implementation_history_invalid',
          claim.claimId,
          `Implementation status ${entry.status} is not the next append-only status at sequence ${entry.sequence}.`,
        ),
      )
    }
  }

  const requiresApproval = governedStatesRequiringApproval.has(claim.lifecycleState)
  if (requiresApproval) {
    if (!claim.physicianOwner?.displayName.trim()) {
      messages.push(
        message(
          'approved_without_named_physician_owner',
          claim.claimId,
          `${claim.lifecycleState} requires a named physician owner; an id or role placeholder is not a clinical owner.`,
        ),
      )
    }
    if (claim.evidence.length === 0) {
      messages.push(
        message(
          'governed_state_without_evidence',
          claim.claimId,
          `${claim.lifecycleState} cannot be adopted or published without retained evidence.`,
        ),
      )
    }
    const physicianApprovals = claim.reviews.filter(
      (review) => review.decision === 'approved' && review.reviewer.reviewerRole === 'physician',
    )
    const boundApproval = physicianApprovals.find(
      (review) =>
        review.claimId === claim.claimId &&
        review.claimContentHash === claim.claimContentHash &&
        review.evidenceSetHash === claim.evidenceSetHash &&
        review.physicianOwnerId === claim.physicianOwner?.personId,
    )
    if (physicianApprovals.length === 0) {
      messages.push(
        message(
          'approval_signoff_missing',
          claim.claimId,
          `${claim.lifecycleState} requires an approving physician review with a rationale.`,
        ),
      )
    } else if (!boundApproval) {
      messages.push(
        message(
          'approval_signoff_binding_mismatch',
          claim.claimId,
          'The approving physician review does not bind this exact claim id, content hash, and evidence-set hash.',
        ),
      )
    }
    const approvalTransition = claim.transitions.find(
      (transition) => transition.toState === 'approved_for_governed_authoring',
    )
    if (
      boundApproval &&
      approvalTransition &&
      Date.parse(boundApproval.reviewedAt) > Date.parse(approvalTransition.occurredAt)
    ) {
      messages.push(
        message(
          'history_timestamp_invalid',
          claim.claimId,
          'The bound physician approval is dated after the lifecycle transition that claims it was approved.',
        ),
      )
    }
    if (claim.evidenceConflicts.some((conflict) => conflict.status === 'unresolved')) {
      messages.push(
        message(
          'approved_with_unresolved_evidence_conflict',
          claim.claimId,
          'Unresolved evidence conflicts remain visible and block governed approval.',
        ),
      )
    }
    if (claim.scope.kind === 'exact_model') {
      const exactModelProductId = claim.scope.productId
      const primarySupport = claim.evidence.filter(
        (evidence) => evidence.decisionUse === 'primary_claim_support',
      )
      if (
        primarySupport.length === 0 ||
        primarySupport.some((evidence) => !scopeSupportsExactModel(evidence, exactModelProductId))
      ) {
        messages.push(
          message(
            'model_approval_from_unqualified_family_evidence',
            claim.claimId,
            `Exact-model approval for ${claim.scope.productId} requires primary-support evidence scoped to that model or family evidence with an explicit reviewer-qualified member list containing it.`,
          ),
        )
      }
    }
    if (
      claim.scope.kind === 'reviewed_family' &&
      !primaryEvidenceCoversReviewedFamily(claim.evidence, claim.scope)
    ) {
      messages.push(
        message(
          'model_approval_from_unqualified_family_evidence',
          claim.claimId,
          `Reviewed-family approval for ${claim.scope.productFamilyVersionId} requires primary-support evidence qualified for every retained member model.`,
        ),
      )
    }
    if (claim.claimType === 'compatibility' && !primaryEvidenceCoversClaimScope(claim)) {
      messages.push(
        message(
          'compatibility_approval_without_primary_evidence',
          claim.claimId,
          'Compatibility approval requires explicit primary evidence used as primary claim support and applicable to the approved scope.',
        ),
      )
    }
  }

  if (
    claim.lifecycleState === 'published_in_forward_release' ||
    claim.lifecycleState === 'superseded' ||
    claim.lifecycleState === 'historical_retained'
  ) {
    const publication = claim.transitions.find(
      (transition) => transition.toState === 'published_in_forward_release',
    )
    const publicationRelease = publication?.releaseBundleId
    const publishedAssessment = claim.affectedReleaseAssessments.find(
      (assessment) =>
        assessment.releaseBundleId === publicationRelease &&
        assessment.relationship === 'published_forward_release',
    )
    const verifiedImplementation = claim.implementationHistory.find(
      (entry) =>
        entry.status === 'verified_in_forward_release' &&
        entry.releaseBundleId === publicationRelease,
    )
    const implementation = latestImplementation(claim)
    const hasVerifiedImplementation =
      implementation.status === 'verified_in_forward_release' ||
      implementation.status === 'historical_only'
    if (
      !publicationRelease ||
      !publishedAssessment ||
      !verifiedImplementation ||
      !hasVerifiedImplementation ||
      (implementation.status === 'verified_in_forward_release' &&
        implementation.releaseBundleId !== publicationRelease)
    ) {
      messages.push(
        message(
          'published_without_forward_release_evidence',
          claim.claimId,
          'Published status requires the exact forward release on the transition, a matching published-release impact assessment, and verified implementation history.',
        ),
      )
    }
    if (
      publication &&
      ((publishedAssessment &&
        Date.parse(publishedAssessment.assessedAt) > Date.parse(publication.occurredAt)) ||
        (verifiedImplementation &&
          Date.parse(verifiedImplementation.recordedAt) > Date.parse(publication.occurredAt)))
    ) {
      messages.push(
        message(
          'history_timestamp_invalid',
          claim.claimId,
          'The forward-release impact assessment and verified implementation must precede the publication transition they support.',
        ),
      )
    }
  }

  if (claim.lifecycleState === 'superseded' || claim.lifecycleState === 'historical_retained') {
    const supersession = claim.transitions.find((transition) => transition.toState === 'superseded')
    if (
      !claim.supersedingClaimId ||
      supersession?.supersedingClaimId !== claim.supersedingClaimId
    ) {
      messages.push(
        message(
          'silent_supersession',
          claim.claimId,
          'A superseded claim must name its superseding claim both on the record and on the signed transition.',
        ),
      )
    }
  } else if (claim.supersedingClaimId !== null) {
    messages.push(
      message(
        'silent_supersession',
        claim.claimId,
        'A claim cannot name a superseding claim until the append-only lifecycle reaches superseded.',
      ),
    )
  }

  if (
    claim.lifecycleState === 'historical_retained' &&
    (!claim.historicalRetention.retainedAt || !claim.historicalRetention.retainedBy)
  ) {
    messages.push(
      message(
        'historical_retention_missing',
        claim.claimId,
        'Historical-retained status requires a retention instant, actor, and rationale while preserving the complete prior record.',
      ),
    )
  }

  return messages
}

/** Runtime shape plus cross-field governance validation. No validation result mutates data. */
export function validateGovernedClaim(input: unknown): GovernanceValidationMessage[] {
  const messages = preSchemaMessages(input)
  const parsed = governedClaimSchema.safeParse(input)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      messages.push(
        message(
          'claim_schema_invalid',
          rawClaimId(input),
          `${issue.path.join('.') || '<root>'}: ${issue.message}`,
        ),
      )
    }
    return sortMessages(messages)
  }
  messages.push(...validateTypedClaim(parsed.data))
  return sortMessages(messages)
}

function hasBlockingMessages(claim: unknown): boolean {
  return validateGovernedClaim(claim).some((entry) => entry.severity === 'blocking')
}

function assertValidClaim(claim: GovernedClaim, operation: string): GovernedClaim {
  const messages = validateGovernedClaim(claim).filter((entry) => entry.severity === 'blocking')
  if (messages.length > 0) {
    throw new Error(
      `${operation} refused for ${claim.claimId}: ${messages.map((entry) => entry.code).join(', ')}`,
    )
  }
  return claim
}

export interface AppendClaimReviewInput {
  reviewId: string
  reviewer: ClaimReview['reviewer']
  reviewedAt: string
  decision: ClaimReview['decision']
  rationale: string
}

/** Stamp a review onto the exact content and evidence hashes; callers cannot supply the binding. */
export function appendClaimReview(
  claim: GovernedClaim,
  input: AppendClaimReviewInput,
): GovernedClaim {
  governedClaimSchema.parse(claim)
  if (claim.lifecycleState !== 'physician_review_required') {
    throw new Error(
      `Review ${input.reviewId} refused: claim ${claim.claimId} is ${claim.lifecycleState}, not physician_review_required.`,
    )
  }
  if (claim.reviews.some((review) => review.reviewId === input.reviewId)) {
    throw new Error(`Review id ${input.reviewId} is already retained.`)
  }
  return governedClaimSchema.parse({
    ...claim,
    reviews: [
      ...claim.reviews,
      {
        reviewId: input.reviewId,
        claimId: claim.claimId,
        claimContentHash: claim.claimContentHash,
        evidenceSetHash: claim.evidenceSetHash,
        physicianOwnerId: claim.physicianOwner?.personId ?? null,
        reviewer: {
          personId: input.reviewer.personId,
          displayName: input.reviewer.displayName,
          reviewerRole: input.reviewer.reviewerRole,
        },
        reviewedAt: input.reviewedAt,
        decision: input.decision,
        rationale: input.rationale,
      },
    ],
  })
}

export interface AppendReleaseImpactInput extends Omit<
  ReleaseImpactAssessment,
  'sequence' | 'assessmentId'
> {
  assessmentId?: string
}

export function appendReleaseImpactAssessment(
  claim: GovernedClaim,
  input: AppendReleaseImpactInput,
): GovernedClaim {
  governedClaimSchema.parse(claim)
  const sequence = claim.affectedReleaseAssessments.length + 1
  return governedClaimSchema.parse({
    ...claim,
    affectedReleaseAssessments: [
      ...claim.affectedReleaseAssessments,
      {
        ...input,
        assessedBy: canonicalPerson(input.assessedBy),
        sequence,
        assessmentId: input.assessmentId ?? `${claim.claimId}:release-impact:${sequence}`,
      },
    ],
  })
}

export type AppendImplementationInput = Omit<ImplementationRecord, 'sequence'>

export function appendImplementationStatus(
  claim: GovernedClaim,
  input: AppendImplementationInput,
): GovernedClaim {
  governedClaimSchema.parse(claim)
  const current = latestImplementation(claim)
  const expected = implementationStatusOrder[implementationStatusOrder.indexOf(current.status) + 1]
  if (input.status !== expected) {
    throw new Error(
      `Implementation status ${input.status} refused for ${claim.claimId}; the next append-only status is ${expected ?? 'none'}.`,
    )
  }
  return governedClaimSchema.parse({
    ...claim,
    implementationHistory: [
      ...claim.implementationHistory,
      {
        ...input,
        recordedBy: canonicalPerson(input.recordedBy),
        sequence: claim.implementationHistory.length + 1,
      },
    ],
  })
}

export interface TransitionGovernedClaimInput {
  toState: GovernedClaimLifecycleState
  occurredAt: string
  actor: PersonReference
  rationale: string
  releaseBundleId?: string
  supersedingClaimId?: string
}

/**
 * Append exactly one lifecycle transition. Approval/publication gates validate the resulting
 * record, so missing owner, evidence, signoff, release impact, or implementation evidence fails
 * before a new state can be returned.
 */
export function transitionGovernedClaim(
  claim: GovernedClaim,
  input: TransitionGovernedClaimInput,
): GovernedClaim {
  governedClaimSchema.parse(claim)
  const expected = nextLifecycleState[claim.lifecycleState]
  if (input.toState !== expected) {
    throw new Error(
      `Transition ${claim.lifecycleState} → ${input.toState} refused; the next append-only state is ${expected ?? 'none'}.`,
    )
  }
  if (input.toState === 'published_in_forward_release' && !input.releaseBundleId) {
    throw new Error('Publishing a claim requires the exact forward release bundle id.')
  }
  if (input.toState === 'superseded' && !input.supersedingClaimId) {
    throw new Error(
      'Superseding a claim requires the new claim id; silent supersession is forbidden.',
    )
  }

  const sequence = claim.transitions.length + 1
  const next: GovernedClaim = {
    ...claim,
    lifecycleState: input.toState,
    supersedingClaimId:
      input.toState === 'superseded'
        ? (input.supersedingClaimId ?? null)
        : claim.supersedingClaimId,
    historicalRetention:
      input.toState === 'historical_retained'
        ? {
            ...claim.historicalRetention,
            retainedAt: input.occurredAt,
            retainedBy: canonicalPerson(input.actor),
          }
        : claim.historicalRetention,
    transitions: [
      ...claim.transitions,
      {
        sequence,
        transitionId: `${claim.claimId}:transition:${sequence}`,
        claimId: claim.claimId,
        fromState: claim.lifecycleState,
        toState: input.toState,
        occurredAt: input.occurredAt,
        actor: canonicalPerson(input.actor),
        rationale: input.rationale,
        claimContentHash: claim.claimContentHash,
        evidenceSetHash: claim.evidenceSetHash,
        releaseBundleId:
          input.toState === 'published_in_forward_release' ? (input.releaseBundleId ?? null) : null,
        supersedingClaimId:
          input.toState === 'superseded' ? (input.supersedingClaimId ?? null) : null,
      },
    ],
  }
  return assertValidClaim(governedClaimSchema.parse(next), `Transition to ${input.toState}`)
}

function historyIsPrefix(before: readonly unknown[], after: readonly unknown[]): boolean {
  return (
    before.length <= after.length &&
    before.every((entry, index) => stableStringify(entry) === stableStringify(after[index]))
  )
}

/**
 * Compare two snapshots as an append-only mutation boundary. A null next record is an attempted
 * historical deletion. Existing source identity/revision and every history prefix are immutable.
 */
export function validateGovernedClaimMutation(
  previousInput: unknown,
  nextInput: unknown | null,
): GovernanceValidationMessage[] {
  const previous = governedClaimSchema.safeParse(previousInput)
  const claimId = rawClaimId(previousInput)
  if (nextInput === null) {
    return [
      message(
        'historical_deletion_forbidden',
        claimId,
        'A governed claim may be superseded and retained, never deleted from its historical ledger.',
      ),
    ]
  }
  const next = governedClaimSchema.safeParse(nextInput)
  const messages = [...validateGovernedClaim(nextInput)]
  if (!previous.success || !next.success) return sortMessages(messages)

  if (previous.data.claimId !== next.data.claimId) {
    messages.push(
      message(
        'claim_id_mutated',
        previous.data.claimId,
        `Claim id changed in place (${previous.data.claimId} → ${next.data.claimId}); a new claim needs a new retained record.`,
      ),
    )
  }
  if (previous.data.claimContentHash !== next.data.claimContentHash) {
    messages.push(
      message(
        'claim_content_mutated_in_place',
        previous.data.claimId,
        'Signed claim content changed in place. Create a new claim that explicitly supersedes this one.',
      ),
    )
  }

  const nextEvidenceById = new Map(
    next.data.evidence.map((evidence) => [evidence.evidenceId, evidence]),
  )
  for (const evidence of previous.data.evidence) {
    const retained = nextEvidenceById.get(evidence.evidenceId)
    if (
      !retained ||
      stableStringify(retained.sourceIdentity) !== stableStringify(evidence.sourceIdentity) ||
      stableStringify(retained.sourceRevision) !== stableStringify(evidence.sourceRevision)
    ) {
      messages.push(
        message(
          'source_revision_loss',
          previous.data.claimId,
          `Evidence ${evidence.evidenceId} lost or changed its retained source identity/revision. A source revision creates a new review-bound claim; it does not rewrite the old one.`,
        ),
      )
    }
  }

  for (const [label, before, after] of [
    ['transition', previous.data.transitions, next.data.transitions],
    ['review', previous.data.reviews, next.data.reviews],
    [
      'affected-release assessment',
      previous.data.affectedReleaseAssessments,
      next.data.affectedReleaseAssessments,
    ],
    ['implementation', previous.data.implementationHistory, next.data.implementationHistory],
  ] as const) {
    if (!historyIsPrefix(before, after)) {
      messages.push(
        message(
          'append_only_history_rewritten',
          previous.data.claimId,
          `The ${label} history was removed, reordered, or rewritten instead of appended.`,
        ),
      )
    }
  }
  if (
    previous.data.historicalRetention.retainedAt &&
    stableStringify(previous.data.historicalRetention) !==
      stableStringify(next.data.historicalRetention)
  ) {
    messages.push(
      message(
        'historical_deletion_forbidden',
        previous.data.claimId,
        'A historical-retention record cannot be cleared or rewritten.',
      ),
    )
  }
  return sortMessages(messages)
}

export interface ValidateGovernedClaimLedgerOptions {
  baselineLedger?: GovernedClaimLedger
}

export function validateGovernedClaimLedger(
  input: unknown,
  options: ValidateGovernedClaimLedgerOptions = {},
): GovernanceValidationMessage[] {
  const parsed = governedClaimLedgerSchema.safeParse(input)
  if (!parsed.success) {
    return sortMessages(
      parsed.error.issues.map((issue) =>
        message(
          'claim_schema_invalid',
          '<ledger>',
          `${issue.path.join('.') || '<root>'}: ${issue.message}`,
        ),
      ),
    )
  }
  const messages = parsed.data.claims.flatMap((claim) => validateGovernedClaim(claim))
  const byId = new Map<string, GovernedClaim>()
  for (const claim of parsed.data.claims) {
    if (byId.has(claim.claimId)) {
      messages.push(
        message(
          'claim_duplicate',
          claim.claimId,
          `Claim ${claim.claimId} appears more than once; an id must name one immutable record.`,
        ),
      )
    } else {
      byId.set(claim.claimId, claim)
    }
  }

  for (const claim of parsed.data.claims) {
    if (claim.supersedingClaimId) {
      const superseding = byId.get(claim.supersedingClaimId)
      if (!superseding) {
        messages.push(
          message(
            'superseding_claim_missing',
            claim.claimId,
            `Superseding claim ${claim.supersedingClaimId} is not retained in this ledger.`,
          ),
        )
      } else if (!publishedOrHistoricalStates.has(superseding.lifecycleState)) {
        messages.push(
          message(
            'superseding_claim_not_published',
            claim.claimId,
            `Superseding claim ${claim.supersedingClaimId} is ${superseding.lifecycleState}; an existing published claim cannot be superseded until its named successor is published in a forward release.`,
          ),
        )
      } else if (!superseding.supersedesClaimIds.includes(claim.claimId)) {
        messages.push(
          message(
            'supersession_backlink_missing',
            claim.claimId,
            `Claim ${claim.supersedingClaimId} does not explicitly name ${claim.claimId} in its supersedesClaimIds.`,
          ),
        )
      }
    }
    for (const predecessorId of claim.supersedesClaimIds) {
      const predecessor = byId.get(predecessorId)
      if (!predecessor) {
        messages.push(
          message(
            'superseding_claim_missing',
            claim.claimId,
            `Claim ${claim.claimId} says it supersedes ${predecessorId}, but that historical claim is not retained.`,
          ),
        )
      } else if (predecessor.supersedingClaimId !== claim.claimId) {
        messages.push(
          message(
            'supersession_backlink_missing',
            claim.claimId,
            `Claim ${predecessorId} does not explicitly name ${claim.claimId} as its superseding claim.`,
          ),
        )
      }
    }
    const visited = new Set<string>([claim.claimId])
    let cursor = claim.supersedingClaimId
    while (cursor) {
      if (visited.has(cursor)) {
        messages.push(
          message(
            'supersession_cycle',
            claim.claimId,
            `Supersession chain for ${claim.claimId} contains a cycle at ${cursor}.`,
          ),
        )
        break
      }
      visited.add(cursor)
      cursor = byId.get(cursor)?.supersedingClaimId ?? null
    }
  }

  if (options.baselineLedger) {
    const nextById = byId
    for (const previous of options.baselineLedger.claims) {
      const next = nextById.get(previous.claimId)
      if (!next) {
        messages.push(
          message(
            'historical_deletion_forbidden',
            previous.claimId,
            `Claim ${previous.claimId} existed in the baseline ledger and was deleted. Superseded records remain reconstructable.`,
          ),
        )
      } else {
        messages.push(...validateGovernedClaimMutation(previous, next))
      }
    }
  }
  return sortMessages(messages)
}

export type ClaimStalenessAssessment =
  | {
      state: 'unknown'
      asOf: string
      basis: ClaimStalenessPolicy['basis']
      thresholdDays: number
      anchorAt: null
      staleAfter: null
    }
  | {
      state: 'current' | 'stale'
      asOf: string
      basis: ClaimStalenessPolicy['basis']
      thresholdDays: number
      anchorAt: string
      staleAfter: string
    }

function parseInstant(value: string, label: string): number {
  const parsed = instantSchema.safeParse(value)
  if (!parsed.success) throw new Error(`${label} must be an ISO-8601 instant with an offset.`)
  return Date.parse(parsed.data)
}

export function assessGovernedClaimStaleness(
  claim: GovernedClaim,
  asOf: string,
): ClaimStalenessAssessment {
  governedClaimSchema.parse(claim)
  const asOfMs = parseInstant(asOf, 'asOf')
  const anchors =
    claim.stalenessPolicy.basis === 'latest_physician_approval'
      ? claim.reviews
          .filter(
            (review) =>
              review.decision === 'approved' &&
              review.reviewer.reviewerRole === 'physician' &&
              review.claimId === claim.claimId &&
              review.claimContentHash === claim.claimContentHash &&
              review.evidenceSetHash === claim.evidenceSetHash &&
              review.physicianOwnerId === claim.physicianOwner?.personId,
          )
          .map((review) => review.reviewedAt)
      : claim.evidence
          .filter(
            (evidence) =>
              evidence.evidenceClass === 'primary' &&
              evidence.decisionUse === 'primary_claim_support',
          )
          .map((evidence) => evidence.sourceRevision.issuedAt)
  if (anchors.length === 0) {
    return {
      state: 'unknown',
      asOf,
      basis: claim.stalenessPolicy.basis,
      thresholdDays: claim.stalenessPolicy.thresholdDays,
      anchorAt: null,
      staleAfter: null,
    }
  }
  const anchorMs = Math.max(...anchors.map((value) => parseInstant(value, 'staleness anchor')))
  const staleAfterMs = anchorMs + claim.stalenessPolicy.thresholdDays * 24 * 60 * 60 * 1000
  return {
    state: asOfMs >= staleAfterMs ? 'stale' : 'current',
    asOf,
    basis: claim.stalenessPolicy.basis,
    thresholdDays: claim.stalenessPolicy.thresholdDays,
    anchorAt: new Date(anchorMs).toISOString(),
    staleAfter: new Date(staleAfterMs).toISOString(),
  }
}

export type RuntimeIngestionAssessment =
  | { eligible: true; code: 'published_current_and_verified' }
  | {
      eligible: false
      code:
        | 'research_candidate_not_runtime_eligible'
        | 'claim_not_published'
        | 'governance_validation_failed'
        | 'staleness_not_current'
        | 'forward_release_not_verified'
    }

/** Pure fail-closed guard for a future adapter. This checkpoint supplies no such adapter. */
export function assessRuntimeIngestionEligibility(
  claim: GovernedClaim,
  asOf: string,
): RuntimeIngestionAssessment {
  if (claim.lifecycleState === 'research_candidate') {
    return { eligible: false, code: 'research_candidate_not_runtime_eligible' }
  }
  if (claim.lifecycleState !== 'published_in_forward_release') {
    return { eligible: false, code: 'claim_not_published' }
  }
  if (hasBlockingMessages(claim)) {
    return { eligible: false, code: 'governance_validation_failed' }
  }
  if (assessGovernedClaimStaleness(claim, asOf).state !== 'current') {
    return { eligible: false, code: 'staleness_not_current' }
  }
  if (latestImplementation(claim).status !== 'verified_in_forward_release') {
    return { eligible: false, code: 'forward_release_not_verified' }
  }
  return { eligible: true, code: 'published_current_and_verified' }
}

export interface GovernedClaimImpactReport {
  reportVersion: typeof GOVERNED_CLAIM_IMPACT_REPORT_VERSION
  claimId: string
  claimContentHash: string
  evidenceSetHash: string
  lifecycleState: GovernedClaimLifecycleState
  asOf: string
  targets: ClaimTargets
  scope: ClaimScope
  evidence: {
    count: number
    primarySupportEvidenceIds: string[]
    unresolvedConflictIds: string[]
  }
  staleness: ClaimStalenessAssessment
  affectedReleaseAssessments: ReleaseImpactAssessment[]
  implementationStatus: ImplementationRecord
  supersession: {
    supersedesClaimIds: string[]
    supersedingClaimId: string | null
  }
  historicalRetention: HistoricalRetention
  blockingValidationCodes: GovernanceValidationCode[]
  reportHash: string
}

/** Deterministic, descriptive impact only: no score, recommendation, or release mutation. */
export function buildGovernedClaimImpactReport(
  claim: GovernedClaim,
  asOf: string,
): GovernedClaimImpactReport {
  governedClaimSchema.parse(claim)
  const payload = {
    reportVersion: GOVERNED_CLAIM_IMPACT_REPORT_VERSION,
    claimId: claim.claimId,
    claimContentHash: claim.claimContentHash,
    evidenceSetHash: claim.evidenceSetHash,
    lifecycleState: claim.lifecycleState,
    asOf,
    targets: {
      affectedProductIds: sortedUnique(claim.targets.affectedProductIds),
      affectedRoleCodes: sortedUnique(claim.targets.affectedRoleCodes),
      affectedProcedureCodes: sortedUnique(claim.targets.affectedProcedureCodes),
    },
    scope: canonicalScope(claim.scope),
    evidence: {
      count: claim.evidence.length,
      primarySupportEvidenceIds: claim.evidence
        .filter((entry) => entry.decisionUse === 'primary_claim_support')
        .map((entry) => entry.evidenceId)
        .sort(),
      unresolvedConflictIds: claim.evidenceConflicts
        .filter((entry) => entry.status === 'unresolved')
        .map((entry) => entry.conflictId)
        .sort(),
    },
    staleness: assessGovernedClaimStaleness(claim, asOf),
    affectedReleaseAssessments: [...claim.affectedReleaseAssessments].sort(
      (left, right) =>
        left.releaseBundleId.localeCompare(right.releaseBundleId) || left.sequence - right.sequence,
    ),
    implementationStatus: latestImplementation(claim),
    supersession: {
      supersedesClaimIds: sortedUnique(claim.supersedesClaimIds),
      supersedingClaimId: claim.supersedingClaimId,
    },
    historicalRetention: claim.historicalRetention,
    blockingValidationCodes: sortedUnique(
      validateGovernedClaim(claim)
        .filter((entry) => entry.severity === 'blocking')
        .map((entry) => entry.code),
    ) as GovernanceValidationCode[],
  }
  return {
    ...payload,
    reportHash: stableSnapshotHash({
      v: GOVERNED_CLAIM_IMPACT_REPORT_VERSION,
      kind: 'governed-claim-impact-report',
      payload,
    }),
  }
}
