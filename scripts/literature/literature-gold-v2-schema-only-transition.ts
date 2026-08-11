import { createHash } from 'node:crypto'

import {
  LITERATURE_GOLD_V2_OPERATION_SCHEMA_ONLY_EXCLUSIONS,
  LITERATURE_GOLD_V2_REVIEW_SCHEMA_ONLY_EXCLUSIONS,
  validateLiteratureGoldV2SchemaNeutralHistoryEvidence,
  type LiteratureGoldV2SchemaNeutralHistoryEvidence,
} from './literature-gold-v2-schema-neutral-history'

export const LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_REASON_CODE =
  'schema_derived_v1_physical_projection_transition' as const
export const LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_PROOF_VERSION =
  'literature-gold-v2-schema-only-transition-proof/1.0.0' as const

export const LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY = {
  batchId: 'fff41ba3-811d-4d28-ba73-9302db3a942a',
  catalog: {
    auditIdentitySha256: '7d79b3449190502399510d4fa2e668d57f6db8babb84b8be0f7bf50d27e993ce',
    expectedCatalogBindingSha256:
      'cd2295c1c69fbefa5920c82c429f0ce10bcc6ac6d0b4714c479f108bf7b2f900',
    fullAuditIdentitySha256: 'd0a5d56bcc88b1cf7fa642d25d16c75031dc4a14b349229959389b0dbf0c5783',
    profileId: 'local_supabase_postgres_owner_v1',
  },
  counts: {
    actions: 0,
    batches: 1,
    drafts: 0,
    events: 59,
    items: 630,
    operations: 0,
    reviews: 11,
  },
  historyComponentIdentities: {
    actionRowsSha256: '37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570',
    batchRowsSha256: '238c83d2616dc58d99f13dfae285f5d43cfc95fc08643d7f3c0ea3f80d055168',
    draftRowsSha256: '37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570',
    eventRowsSha256: '7fa274b562b56b48bb0f4c7bd113640c0811616afa2024a44a806c73176fec93',
    itemRowsSha256: '785f755196235d7fe961dd605b52f6bbeffc900498ac68421a57d7bf8a38d370',
    operationRowsSha256: '37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570',
    pointerStateSha256: '1bcf10929984acf5c239166d405ee9f0ab1d946a800ae6e6f23e7ca1939fa1eb',
    revealStateSha256: '81729757e4adf76ee304fbd5956e54c5c54b805320223de12cf38b1897664779',
    reviewRowsSha256: '7e8297939763a92e170074a69256f21e5db4e6c684947697e7523b7ca81f194c',
  },
  post: {
    developmentMembershipSha256: '73367b254e7116db166dcd88372457d9ae1a9061aa58038c9900fbe21a17b46c',
    effectiveStateSha256V1: '8b4f46720b980ec5337edfa448f7d998ddfa6498ec32a8fce5a941589a746a23',
    effectiveStateSha256V2: 'f79b825c70f0032642cd877ffa06238b6965dec479c6855105e45ee64bd01f4c',
    eventStateSha256: '7fa274b562b56b48bb0f4c7bd113640c0811616afa2024a44a806c73176fec93',
    physicalStateSha256V1: 'dab46b9df0c32e5ac98558495988d07f2be7474a61ed1d85fb8af9b5e6bff5fb',
    physicalStateSha256V2: 'afce1a294fd5343a9127d86f6d210baabe8888ee9dc77b3ee3fcb3559d6741dd',
    planningStateSha256: '84743faccffca532d3fe6e03bd2d29a44f96790f0004c40ff0c9ed6bba881be5',
    pointerStateSha256: '5b0c8db42b8ae204e940d495a7411f64cb3290cf86bd9afb2710eae30884c567',
    revealStateSha256: '5c68b4af5b2d4b4630ce865e3dca5736d5d1544a80a8fe1be7d4580faa8948b5',
    reviewStateSha256: '7e8297939763a92e170074a69256f21e5db4e6c684947697e7523b7ca81f194c',
    schemaNeutralHistorySha256: '5469be890970ad79ccef977ff9db55f454edd6cc010b6394e20f4ce733e8cddb',
  },
  pre: {
    physicalStateSha256V1: '3986852c329bb66abf293d499655f2f278ae881801291756c9c1f75cc0351c70',
    schemaDerivedOperationValuesSha256:
      '37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570',
    schemaDerivedReviewValuesSha256:
      '0ddc427d1cf93ea7324285401bfa7268dc6f30d009849e69a46bd97ecac3343c',
  },
  postSchemaDerivedOperationValuesSha256:
    '37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570',
  postSchemaDerivedReviewValuesSha256:
    '8f06bf109378b753ac2a0e79b1e701fddb4e191f1b003b2a91a2bdea3a5a0ab6',
  sourceIdentities: {
    v1MigrationSha256: 'e846ef70a7b484460682a7ff61d579d3d6fdae3400805fa5395adc0464244528',
    v2MigrationSha256: '3f34934391b3c1ca3ff2ab96c103fe64f05fc29e7b2e0d8375dd6742401995b1',
    v2VerifierSha256: '2570f0885ed646247df7dd3e375b835c7591f2750bc190d63845191cd0426eeb',
  },
} as const

export const LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY = {
  authority: LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY,
  excludedSchemaDerivedFields: {
    literature_gold_review_operations: LITERATURE_GOLD_V2_OPERATION_SCHEMA_ONLY_EXCLUSIONS,
    literature_gold_set_reviews: LITERATURE_GOLD_V2_REVIEW_SCHEMA_ONLY_EXCLUSIONS,
  },
  reasonCode: LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_REASON_CODE,
  requiredInvariantIds: [
    'v1_occurs_once_before_and_after',
    'v2_transitions_zero_to_one',
    'migration_and_verifier_bytes_exact',
    'two_preapplication_captures_agree',
    'membership_effective_v1_planning_unchanged',
    'schema_neutral_full_history_unchanged',
    'review_note_chain_pointer_event_reveal_identities_unchanged',
    'schema_sensitive_v1_physical_equals_precomputed_schema_transition',
    'operation_action_import_compensation_counts_zero',
    'all_mutation_counts_zero',
    'source_authorization_unchanged',
    'v2_effective_and_physical_identities_exact',
    'complete_local_catalog_identity_exact',
  ],
  schemaVersion: 'literature-gold-v2-schema-only-transition-policy/1.0.0',
} as const

function sortedCanonicalValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Transition policy rejects non-finite numbers.')
    return value
  }
  if (Array.isArray(value)) return value.map(sortedCanonicalValue)
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Transition policy rejects ${typeof value}.`)
  }
  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, sortedCanonicalValue(record[key])]),
  )
}

function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(`${JSON.stringify(sortedCanonicalValue(value), null, 2)}\n`)
    .digest('hex')
}

const DERIVED_TRANSITION_POLICY_IDENTITY_SHA256 = sha256Canonical(
  LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY,
)

// This reviewed literal makes policy drift an explicit source change.
export const LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256 =
  '896e0d7d5f1d0161661b453ff1c5af1cebe34167483ce1e93ae734d64577fc31' as const

if (
  DERIVED_TRANSITION_POLICY_IDENTITY_SHA256 !==
  LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256
) {
  throw new Error(
    `Literature Gold V2 transition policy identity drifted: ${DERIVED_TRANSITION_POLICY_IDENTITY_SHA256}.`,
  )
}

export interface LiteratureGoldV2SchemaOnlyTransitionState {
  compensationCount: number
  developmentMembershipSha256: string
  effectiveStateSha256V1: string
  effectiveStateSha256V2: string | null
  eventStateSha256: string
  history: LiteratureGoldV2SchemaNeutralHistoryEvidence
  importCount: number
  physicalStateSha256V2: string | null
  planningStateSha256: string
  pointerStateSha256: string
  readOnlyBracketMatches: true
  revealStateSha256: string
  reviewStateSha256: string
  sourceAuthorizationSha256: string
  v1Occurrence: number
  v2Occurrence: number
}

export interface LiteratureGoldV2SchemaOnlyTransitionCatalogAudit {
  auditIdentitySha256: string
  completeExactMatch: true
  expectedCatalogBindingSha256: string
  fullAuditIdentitySha256: string
  profileId: string
}

export interface LiteratureGoldV2SchemaOnlyTransitionMutationCounts {
  actions: number
  events: number
  pointers: number
  reveals: number
  reviews: number
}

export interface LiteratureGoldV2SchemaOnlyTransitionInput {
  after: LiteratureGoldV2SchemaOnlyTransitionState
  beforeCaptures: readonly [
    LiteratureGoldV2SchemaOnlyTransitionState,
    LiteratureGoldV2SchemaOnlyTransitionState,
  ]
  catalogAudit: LiteratureGoldV2SchemaOnlyTransitionCatalogAudit
  mutationCounts: LiteratureGoldV2SchemaOnlyTransitionMutationCounts
  reasonCode: typeof LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_REASON_CODE
  sourceIdentities: {
    v1MigrationSha256: string
    v2MigrationSha256: string
    v2VerifierSha256: string
  }
}

export interface LiteratureGoldV2SchemaOnlyTransitionProof {
  accepted: true
  batchId: string
  migration: {
    v1MigrationSha256: string
    v1OccurrenceAfter: 1
    v1OccurrenceBefore: 1
    v2MigrationSha256: string
    v2OccurrenceAfter: 1
    v2OccurrenceBefore: 0
    v2VerifierSha256: string
  }
  physicalTransitionChanged: true
  post: {
    catalogAuditIdentitySha256: string
    effectiveStateSha256V2: string
    expectedSchemaDerivedPhysicalStateSha256V1: string
    physicalStateSha256V1: string
    physicalStateSha256V2: string
    schemaNeutralHistorySha256: string
  }
  pre: {
    physicalStateSha256V1: string
    schemaNeutralHistorySha256: string
  }
  reasonCode: typeof LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_REASON_CODE
  schemaVersion: typeof LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_PROOF_VERSION
  sourceAuthorizationSha256: string
  transitionPolicyIdentitySha256: typeof LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256
  zeroMutationEvidence: LiteratureGoldV2SchemaOnlyTransitionMutationCounts
}

function fail(message: string): never {
  throw new Error(`Literature Gold V2 schema-only transition rejected: ${message}`)
}

function equal(value: unknown, expected: unknown, label: string): void {
  if (value !== expected) fail(`${label} drifted.`)
}

function assertZero(value: unknown, label: string): void {
  if (value !== 0) fail(`${label} must be zero.`)
}

function stableState(state: LiteratureGoldV2SchemaOnlyTransitionState) {
  return sortedCanonicalValue(state)
}

/**
 * The sole policy entry point for operator, rehearsal, diagnostics, and
 * receipt recovery. No caller may reinterpret the V1 physical delta.
 */
export function validateLiteratureGoldV2SchemaOnlyTransition(
  input: LiteratureGoldV2SchemaOnlyTransitionInput,
): LiteratureGoldV2SchemaOnlyTransitionProof {
  if (input.reasonCode !== LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_REASON_CODE) {
    fail('reason code is not the reviewed schema-derived transition')
  }
  const [capture1, capture2] = input.beforeCaptures
  const before1History = validateLiteratureGoldV2SchemaNeutralHistoryEvidence(
    capture1.history,
    'before_v2',
  )
  const before2History = validateLiteratureGoldV2SchemaNeutralHistoryEvidence(
    capture2.history,
    'before_v2',
  )
  const afterHistory = validateLiteratureGoldV2SchemaNeutralHistoryEvidence(
    input.after.history,
    'after_v2',
  )
  if (JSON.stringify(stableState(capture1)) !== JSON.stringify(stableState(capture2))) {
    fail('the two exact pre-application captures do not agree')
  }
  equal(
    before2History.schemaNeutralHistorySha256,
    before1History.schemaNeutralHistorySha256,
    'second pre-capture schema-neutral history identity',
  )
  for (const [label, state, v2Occurrence] of [
    ['pre-application capture 1', capture1, 0],
    ['pre-application capture 2', capture2, 0],
    ['post-application state', input.after, 1],
  ] as const) {
    if (state.readOnlyBracketMatches !== true) fail(`${label} is not read-only bracketed`)
    equal(state.v1Occurrence, 1, `${label} V1 occurrence`)
    equal(state.v2Occurrence, v2Occurrence, `${label} V2 occurrence`)
    assertZero(state.importCount, `${label} import count`)
    assertZero(state.compensationCount, `${label} compensation count`)
    assertZero(state.history.counts.operations, `${label} operation count`)
    assertZero(state.history.counts.actions, `${label} action count`)
  }
  const authority = LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY
  equal(before1History.batchId, authority.batchId, 'batch identity')
  equal(afterHistory.batchId, authority.batchId, 'post batch identity')
  equal(before1History.counts.batches, authority.counts.batches, 'batch row count')
  equal(before1History.counts.items, authority.counts.items, 'item row count')
  equal(before1History.counts.reviews, authority.counts.reviews, 'review row count')
  equal(before1History.counts.drafts, authority.counts.drafts, 'draft row count')
  equal(before1History.counts.events, authority.counts.events, 'event row count')
  equal(before1History.counts.operations, authority.counts.operations, 'operation row count')
  equal(before1History.counts.actions, authority.counts.actions, 'action row count')
  equal(
    before1History.schemaNeutralHistorySha256,
    authority.post.schemaNeutralHistorySha256,
    'pre schema-neutral full-history identity',
  )
  equal(
    afterHistory.schemaNeutralHistorySha256,
    before1History.schemaNeutralHistorySha256,
    'schema-neutral full-history identity',
  )
  for (const key of Object.keys(before1History.componentIdentities) as Array<
    keyof typeof before1History.componentIdentities
  >) {
    equal(
      before1History.componentIdentities[key],
      authority.historyComponentIdentities[key],
      `authorized ${key} history identity`,
    )
    equal(
      afterHistory.componentIdentities[key],
      before1History.componentIdentities[key],
      `${key} history identity`,
    )
  }
  equal(
    before1History.schemaDerivedFields.operationValuesSha256,
    authority.pre.schemaDerivedOperationValuesSha256,
    'pre schema-derived operation-field identity',
  )
  equal(
    before1History.schemaDerivedFields.reviewValuesSha256,
    authority.pre.schemaDerivedReviewValuesSha256,
    'pre schema-derived review-field identity',
  )
  equal(
    afterHistory.schemaDerivedFields.operationValuesSha256,
    authority.postSchemaDerivedOperationValuesSha256,
    'post schema-derived operation-field identity',
  )
  equal(
    afterHistory.schemaDerivedFields.reviewValuesSha256,
    authority.postSchemaDerivedReviewValuesSha256,
    'post schema-derived review-field identity',
  )
  equal(
    before1History.physicalStateSha256V1,
    authority.pre.physicalStateSha256V1,
    'pre V1 physical identity',
  )
  equal(
    before1History.expectedPostV1PhysicalStateSha256,
    authority.post.physicalStateSha256V1,
    'precomputed schema-derived post V1 physical identity',
  )
  equal(
    afterHistory.expectedPostV1PhysicalStateSha256,
    before1History.expectedPostV1PhysicalStateSha256,
    'post schema-derived V1 physical prediction',
  )
  equal(
    afterHistory.physicalStateSha256V1,
    before1History.expectedPostV1PhysicalStateSha256,
    'post V1 physical identity',
  )
  if (before1History.physicalStateSha256V1 === afterHistory.physicalStateSha256V1) {
    fail('the incident V1 physical identity did not expose its required schema-derived delta')
  }
  const invariantKeys = [
    'developmentMembershipSha256',
    'effectiveStateSha256V1',
    'eventStateSha256',
    'planningStateSha256',
    'pointerStateSha256',
    'revealStateSha256',
    'reviewStateSha256',
    'sourceAuthorizationSha256',
  ] as const
  for (const key of invariantKeys) {
    equal(input.after[key], capture1[key], key)
  }
  for (const key of [
    'developmentMembershipSha256',
    'effectiveStateSha256V1',
    'eventStateSha256',
    'planningStateSha256',
    'pointerStateSha256',
    'revealStateSha256',
    'reviewStateSha256',
  ] as const) {
    equal(input.after[key], authority.post[key], `authorized ${key}`)
  }
  equal(
    input.after.effectiveStateSha256V2,
    authority.post.effectiveStateSha256V2,
    'post V2 effective identity',
  )
  equal(
    input.after.physicalStateSha256V2,
    authority.post.physicalStateSha256V2,
    'post V2 physical identity',
  )
  if (capture1.effectiveStateSha256V2 !== null || capture1.physicalStateSha256V2 !== null) {
    fail('pre-application state contains V2 state identities')
  }
  for (const key of Object.keys(input.mutationCounts) as Array<
    keyof LiteratureGoldV2SchemaOnlyTransitionMutationCounts
  >) {
    assertZero(input.mutationCounts[key], `${key} mutation count`)
  }
  equal(
    input.sourceIdentities.v1MigrationSha256,
    authority.sourceIdentities.v1MigrationSha256,
    'V1 migration identity',
  )
  equal(
    input.sourceIdentities.v2MigrationSha256,
    authority.sourceIdentities.v2MigrationSha256,
    'V2 migration identity',
  )
  equal(
    input.sourceIdentities.v2VerifierSha256,
    authority.sourceIdentities.v2VerifierSha256,
    'V2 verifier identity',
  )
  if (input.catalogAudit.completeExactMatch !== true)
    fail('catalog audit is not complete and exact')
  equal(input.catalogAudit.profileId, authority.catalog.profileId, 'catalog profile')
  equal(
    input.catalogAudit.expectedCatalogBindingSha256,
    authority.catalog.expectedCatalogBindingSha256,
    'expected catalog binding',
  )
  equal(
    input.catalogAudit.fullAuditIdentitySha256,
    authority.catalog.fullAuditIdentitySha256,
    'full catalog audit identity',
  )
  equal(
    input.catalogAudit.auditIdentitySha256,
    authority.catalog.auditIdentitySha256,
    'catalog evidence identity',
  )
  if (!/^[a-f0-9]{64}$/u.test(capture1.sourceAuthorizationSha256)) {
    fail('source authorization identity is malformed')
  }
  return {
    accepted: true,
    batchId: authority.batchId,
    migration: {
      v1MigrationSha256: input.sourceIdentities.v1MigrationSha256,
      v1OccurrenceAfter: 1,
      v1OccurrenceBefore: 1,
      v2MigrationSha256: input.sourceIdentities.v2MigrationSha256,
      v2OccurrenceAfter: 1,
      v2OccurrenceBefore: 0,
      v2VerifierSha256: input.sourceIdentities.v2VerifierSha256,
    },
    physicalTransitionChanged: true,
    post: {
      catalogAuditIdentitySha256: input.catalogAudit.auditIdentitySha256,
      effectiveStateSha256V2: input.after.effectiveStateSha256V2!,
      expectedSchemaDerivedPhysicalStateSha256V1: afterHistory.expectedPostV1PhysicalStateSha256,
      physicalStateSha256V1: afterHistory.physicalStateSha256V1,
      physicalStateSha256V2: input.after.physicalStateSha256V2!,
      schemaNeutralHistorySha256: afterHistory.schemaNeutralHistorySha256,
    },
    pre: {
      physicalStateSha256V1: before1History.physicalStateSha256V1,
      schemaNeutralHistorySha256: before1History.schemaNeutralHistorySha256,
    },
    reasonCode: LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_REASON_CODE,
    schemaVersion: LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_PROOF_VERSION,
    sourceAuthorizationSha256: capture1.sourceAuthorizationSha256,
    transitionPolicyIdentitySha256:
      LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256,
    zeroMutationEvidence: { ...input.mutationCounts },
  }
}
