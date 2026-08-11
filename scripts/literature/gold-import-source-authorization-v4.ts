import { createHash } from 'node:crypto'

import { z } from 'zod'

import {
  GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
  GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
  parseImportPlanV2,
  type ImportPlanV2,
} from '../../src/features/literature/gold-set/import-compensation-v2'
import {
  canonicalJson,
  sha256Canonical,
} from '../../src/features/literature/gold-set/import-compensation'
import {
  finalizedArtifactBooleanNormalizationSchema,
  finalizedArtifactListNormalizationSchema,
  compatibilityDevelopmentPlanningStateSchema,
  existingHeadCohortSha256,
  parseFinalizedGoldImportArtifact,
} from './gold-import-compensation-compatibility'
import {
  buildGoldImportFieldLineageReport,
  buildGoldImportForwardRepairRequirements,
  goldImportFieldLineageSha256,
  goldImportForwardRepairRequirementsSha256,
} from './gold-import-contract-field-lineage'
import {
  GOLD_IMPORT_AMENDED_AUTHORIZATION_EXACT_TEXT_SHA256_V2,
  GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2,
  GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SHA256_V2,
  validateGoldImportNoteDispositionGateV2,
  type NoteDispositionCurrentStateV2,
  type NoteDispositionEvidenceBytesV2,
} from './gold-import-note-disposition-gate-v2'
import {
  GOLD_IMPORT_AUTHORIZATION_MANIFEST_SHA256,
  GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_MANIFEST_SHA256,
  GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_SHA256,
  GOLD_IMPORT_AUTHORIZATION_MAPPING_SHA256,
} from './gold-import-note-disposition'
import {
  validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile,
  type ProtectedV2CompleteCatalogAuditIdentity,
} from './gold-import-contract-v2-catalog-audit'
import {
  validateProtectedV2ExpectedCatalogBinding,
  type ProtectedV2ExpectedCatalogBinding,
} from './protected-gold-import-contract-v2-bindings'

export const GOLD_IMPORT_SOURCE_AUTHORIZATION_SET_VERSION_V4 = 4 as const
export const GOLD_IMPORT_SOURCE_AUTHORIZATION_SET_SCHEMA_VERSION_V4 =
  'gold-import-source-authorization-set/4.0.0' as const
export const GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256_V4 =
  '961c19f4ea1c6a82e061369fd33d927e804360f10781729f8049073a4b6d0f59' as const
export const GOLD_IMPORT_SIGNED_PROTOCOL_AUTHORIZATION_SHA256_V4 =
  '784d13736ff0fbf69bd8ad55c8bf55b293c4cc2051b980a3488a980f120c5dd3' as const
export const GOLD_IMPORT_AMENDED_TWO_ROW_AUTHORIZATION_SHA256_V4 =
  'b95fc9785ee355b810981c051db62307e868110e06ffb1a83c09c8eff52bf89a' as const
export const GOLD_IMPORT_FIELD_LINEAGE_SHA256_V4 =
  'b8c520ad08f77a2f3398a748e54790b94c5d8e52ec49ac69d72f452a4ddca019' as const
export const GOLD_IMPORT_FORWARD_REPAIR_REQUIREMENTS_SHA256_V4 =
  '0c1d74bbc079aabe11358c4d2396045c8aab1f88150f04e304c7a409cf607b0b' as const
export const GOLD_IMPORT_EXISTING_HEAD_COHORT_SHA256_V4 =
  'a307279c4313de4d515952bc5bfffa22cef74929205aa60298ef638970b337c0' as const

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u)
const uuidSchema = z.string().uuid()

const actionCountsSchema = z
  .object({
    initial: z.number().int().nonnegative(),
    inserts: z.number().int().nonnegative(),
    noops: z.number().int().nonnegative(),
    revisions: z.number().int().nonnegative(),
    total: z.number().int().positive(),
  })
  .strict()

export const goldImportSourceAuthorizationSetV4Schema = z
  .object({
    actionCounts: actionCountsSchema,
    auditTarget: z.enum(['disposable_clone', 'local']),
    amendedTwoRowAuthorizationSha256: z.literal(
      GOLD_IMPORT_AMENDED_TWO_ROW_AUTHORIZATION_SHA256_V4,
    ),
    booleanNormalizationLedger: z.array(finalizedArtifactBooleanNormalizationSchema).nonempty(),
    booleanNormalizationLedgerSha256: sha256Schema,
    contractAudit: z
      .object({
        environmentInvariantIdentitySha256: sha256Schema,
        environmentProfileIdentitySha256: sha256Schema,
        invariantReady: z.literal(true),
        profileReady: z.literal(true),
      })
      .strict(),
    completeCatalogAudit: z.unknown(),
    contractVersion: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2),
    currentDatabase: z
      .object({
        batchId: uuidSchema,
        developmentMembershipSha256: z.literal(
          GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentMembershipSha256,
        ),
        developmentPlanningStateSha256: z.literal(
          GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentPlanningStateSha256,
        ),
        effectiveStateSha256: z.literal(
          GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.effectiveStateSha256,
        ),
        physicalStateSha256: z.literal(GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.physicalStateSha256),
      })
      .strict(),
    exactExistingHeadCohort: z
      .object({
        cohortSha256: z.literal(GOLD_IMPORT_EXISTING_HEAD_COHORT_SHA256_V4),
        headCount: z.literal(9),
      })
      .strict(),
    expectedCatalog: z.unknown(),
    fieldLineageSha256: z.literal(GOLD_IMPORT_FIELD_LINEAGE_SHA256_V4),
    finalArtifactSha256: z.literal(GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256_V4),
    forwardRepairRequirementsSha256: z.literal(GOLD_IMPORT_FORWARD_REPAIR_REQUIREMENTS_SHA256_V4),
    kind: z.literal('gold_import_source_authorization_set'),
    migration: z
      .object({
        id: z.literal(GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2),
        sha256: sha256Schema,
      })
      .strict(),
    noteDispositionEvidence: z
      .object({
        amendedAuthorizationExactTextSha256: z.literal(
          GOLD_IMPORT_AMENDED_AUTHORIZATION_EXACT_TEXT_SHA256_V2,
        ),
        authorizationManifestSha256: z.literal(GOLD_IMPORT_AUTHORIZATION_MANIFEST_SHA256),
        authorizationMappingCorrectionManifestSha256: z.literal(
          GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_MANIFEST_SHA256,
        ),
        authorizationMappingCorrectionSha256: z.literal(
          GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_SHA256,
        ),
        authorizationMappingSha256: z.literal(GOLD_IMPORT_AUTHORIZATION_MAPPING_SHA256),
      })
      .strict(),
    noteDispositionAuditSha256: z.literal(GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SHA256_V2),
    orderedSetNormalizationLedger: z.array(finalizedArtifactListNormalizationSchema),
    orderedSetNormalizationLedgerSha256: sha256Schema,
    schemaVersion: z.literal(GOLD_IMPORT_SOURCE_AUTHORIZATION_SET_SCHEMA_VERSION_V4),
    scope: z
      .object({
        datasetSplit: z.literal('development'),
        developmentOnly: z.literal(true),
        heldOutIdentitiesAccessed: z.literal(false),
        remoteWritesAllowed: z.literal(false),
        targetDatabase: z.literal('local'),
      })
      .strict(),
    signedProtocolAuthorizationSha256: z.literal(
      GOLD_IMPORT_SIGNED_PROTOCOL_AUTHORIZATION_SHA256_V4,
    ),
    sourceDecisionsChanged: z.literal(false),
    v2PreImportState: z
      .object({
        effectiveStateSha256: sha256Schema,
        physicalStateSha256: sha256Schema,
      })
      .strict(),
    version: z.literal(GOLD_IMPORT_SOURCE_AUTHORIZATION_SET_VERSION_V4),
  })
  .strict()

type ParsedGoldImportSourceAuthorizationSetV4 = z.infer<
  typeof goldImportSourceAuthorizationSetV4Schema
>
export type GoldImportSourceAuthorizationSetV4 = Omit<
  ParsedGoldImportSourceAuthorizationSetV4,
  'completeCatalogAudit' | 'expectedCatalog'
> & {
  completeCatalogAudit: ProtectedV2CompleteCatalogAuditIdentity
  expectedCatalog: ProtectedV2ExpectedCatalogBinding
}

export interface BuildGoldImportSourceAuthorizationSetV4Input {
  actionCounts: z.input<typeof actionCountsSchema>
  auditTarget: 'disposable_clone' | 'local'
  batchId: string
  booleanNormalizationLedger: z.input<typeof finalizedArtifactBooleanNormalizationSchema>[]
  completeCatalogAudit: ProtectedV2CompleteCatalogAuditIdentity
  environmentInvariantIdentitySha256: string
  environmentProfileIdentitySha256: string
  existingHeadCohortSha256: string
  expectedCatalog: ProtectedV2ExpectedCatalogBinding
  migrationSha256: string
  orderedSetNormalizationLedger: z.input<typeof finalizedArtifactListNormalizationSchema>[]
  v2PreImportEffectiveStateSha256: string
  v2PreImportPhysicalStateSha256: string
}

function assertActionCounts(counts: z.infer<typeof actionCountsSchema>): void {
  if (
    counts.initial + counts.revisions + counts.noops !== counts.total ||
    counts.initial + counts.revisions !== counts.inserts
  ) {
    throw new Error('V4 source authorization action counts are not a complete dynamic partition.')
  }
}

function assertCanonicalIdentityDocuments(): void {
  const fieldLineage = buildGoldImportFieldLineageReport()
  const forwardRepair = buildGoldImportForwardRepairRequirements({
    noteDisposition: 'already_authorized',
    noteDispositionEvidenceSha256: GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SHA256_V2,
  })
  if (
    goldImportFieldLineageSha256(fieldLineage) !== GOLD_IMPORT_FIELD_LINEAGE_SHA256_V4 ||
    goldImportForwardRepairRequirementsSha256(forwardRepair) !==
      GOLD_IMPORT_FORWARD_REPAIR_REQUIREMENTS_SHA256_V4
  ) {
    throw new Error('V4 source authorization field-lineage or forward-repair identity drifted.')
  }
}

export function buildGoldImportSourceAuthorizationSetV4(
  input: BuildGoldImportSourceAuthorizationSetV4Input,
): GoldImportSourceAuthorizationSetV4 {
  assertCanonicalIdentityDocuments()
  if (input.existingHeadCohortSha256 !== GOLD_IMPORT_EXISTING_HEAD_COHORT_SHA256_V4) {
    throw new Error('V4 source authorization exact nine-head cohort identity drifted.')
  }
  const expectedContext =
    input.auditTarget === 'disposable_clone'
      ? ({ profileId: 'supabase_admin_owner_v1', target: 'disposable' } as const)
      : ({ profileId: 'local_supabase_postgres_owner_v1', target: 'local' } as const)
  const expectedCatalog = validateProtectedV2ExpectedCatalogBinding(
    input.expectedCatalog,
    expectedContext.profileId,
    expectedContext.target,
  )
  const completeCatalogAudit = validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile(
    input.completeCatalogAudit,
    expectedContext.profileId,
    expectedContext.target,
  )
  const booleanNormalizationLedger = input.booleanNormalizationLedger.map((entry) =>
    finalizedArtifactBooleanNormalizationSchema.parse(entry),
  )
  const orderedSetNormalizationLedger = input.orderedSetNormalizationLedger.map((entry) =>
    finalizedArtifactListNormalizationSchema.parse(entry),
  )
  return validateGoldImportSourceAuthorizationSetV4({
    actionCounts: input.actionCounts,
    auditTarget: input.auditTarget,
    amendedTwoRowAuthorizationSha256: GOLD_IMPORT_AMENDED_TWO_ROW_AUTHORIZATION_SHA256_V4,
    booleanNormalizationLedger,
    booleanNormalizationLedgerSha256: sha256Canonical(booleanNormalizationLedger),
    contractAudit: {
      environmentInvariantIdentitySha256: input.environmentInvariantIdentitySha256,
      environmentProfileIdentitySha256: input.environmentProfileIdentitySha256,
      invariantReady: true,
      profileReady: true,
    },
    completeCatalogAudit,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    currentDatabase: {
      batchId: input.batchId,
      ...GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2,
    },
    exactExistingHeadCohort: {
      cohortSha256: input.existingHeadCohortSha256,
      headCount: 9,
    },
    expectedCatalog,
    fieldLineageSha256: GOLD_IMPORT_FIELD_LINEAGE_SHA256_V4,
    finalArtifactSha256: GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256_V4,
    forwardRepairRequirementsSha256: GOLD_IMPORT_FORWARD_REPAIR_REQUIREMENTS_SHA256_V4,
    kind: 'gold_import_source_authorization_set',
    migration: {
      id: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
      sha256: input.migrationSha256,
    },
    noteDispositionEvidence: {
      amendedAuthorizationExactTextSha256: GOLD_IMPORT_AMENDED_AUTHORIZATION_EXACT_TEXT_SHA256_V2,
      authorizationManifestSha256: GOLD_IMPORT_AUTHORIZATION_MANIFEST_SHA256,
      authorizationMappingCorrectionManifestSha256:
        GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_MANIFEST_SHA256,
      authorizationMappingCorrectionSha256: GOLD_IMPORT_AUTHORIZATION_MAPPING_CORRECTION_SHA256,
      authorizationMappingSha256: GOLD_IMPORT_AUTHORIZATION_MAPPING_SHA256,
    },
    noteDispositionAuditSha256: GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SHA256_V2,
    orderedSetNormalizationLedger,
    orderedSetNormalizationLedgerSha256: sha256Canonical(orderedSetNormalizationLedger),
    schemaVersion: GOLD_IMPORT_SOURCE_AUTHORIZATION_SET_SCHEMA_VERSION_V4,
    scope: {
      datasetSplit: 'development',
      developmentOnly: true,
      heldOutIdentitiesAccessed: false,
      remoteWritesAllowed: false,
      targetDatabase: 'local',
    },
    signedProtocolAuthorizationSha256: GOLD_IMPORT_SIGNED_PROTOCOL_AUTHORIZATION_SHA256_V4,
    sourceDecisionsChanged: false,
    v2PreImportState: {
      effectiveStateSha256: input.v2PreImportEffectiveStateSha256,
      physicalStateSha256: input.v2PreImportPhysicalStateSha256,
    },
    version: 4,
  })
}

export function validateGoldImportSourceAuthorizationSetV4(
  input: unknown,
): GoldImportSourceAuthorizationSetV4 {
  const parsed = goldImportSourceAuthorizationSetV4Schema.parse(input)
  const expectedContext =
    parsed.auditTarget === 'disposable_clone'
      ? ({ profileId: 'supabase_admin_owner_v1', target: 'disposable' } as const)
      : ({ profileId: 'local_supabase_postgres_owner_v1', target: 'local' } as const)
  const expectedCatalog = validateProtectedV2ExpectedCatalogBinding(
    parsed.expectedCatalog,
    expectedContext.profileId,
    expectedContext.target,
  )
  const completeCatalogAudit = validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile(
    parsed.completeCatalogAudit,
    expectedContext.profileId,
    expectedContext.target,
  )
  const authorization: GoldImportSourceAuthorizationSetV4 = {
    ...parsed,
    completeCatalogAudit,
    expectedCatalog,
  }
  assertCanonicalIdentityDocuments()
  assertActionCounts(authorization.actionCounts)
  if (
    authorization.booleanNormalizationLedgerSha256 !==
      sha256Canonical(authorization.booleanNormalizationLedger) ||
    authorization.orderedSetNormalizationLedgerSha256 !==
      sha256Canonical(authorization.orderedSetNormalizationLedger) ||
    authorization.contractAudit.environmentInvariantIdentitySha256 !==
      expectedCatalog.environmentInvariantIdentitySha256 ||
    authorization.contractAudit.environmentProfileIdentitySha256 !==
      expectedCatalog.expectedDeploymentProfileIdentitySha256 ||
    completeCatalogAudit.fullAuditIdentitySha256 !== expectedCatalog.fullAuditIdentitySha256 ||
    completeCatalogAudit.fullEnvironmentInventoryIdentitySha256 !==
      expectedCatalog.fullEnvironmentInventoryIdentitySha256 ||
    canonicalJson(completeCatalogAudit.componentIdentities) !==
      canonicalJson(expectedCatalog.componentIdentities)
  ) {
    throw new Error('V4 source authorization normalization-ledger checksum mismatch.')
  }
  const booleanKeys = new Set<string>()
  for (const entry of authorization.booleanNormalizationLedger) {
    if (entry.sourceArtifactSha256 !== authorization.finalArtifactSha256) {
      throw new Error('V4 boolean normalization is bound to a different finalized artifact.')
    }
    const key = `${entry.sourceIdentity.itemId}:${entry.column}`
    if (booleanKeys.has(key)) throw new Error('V4 boolean normalization contains a duplicate.')
    booleanKeys.add(key)
  }
  const orderedSetKeys = new Set<string>()
  for (const entry of authorization.orderedSetNormalizationLedger) {
    if (entry.sourceArtifactSha256 !== authorization.finalArtifactSha256) {
      throw new Error('V4 ordered-set normalization is bound to a different finalized artifact.')
    }
    const key = `${entry.sourceIdentity.itemId}:${entry.column}`
    if (orderedSetKeys.has(key)) {
      throw new Error('V4 ordered-set normalization contains a duplicate.')
    }
    orderedSetKeys.add(key)
  }
  return authorization
}

export function canonicalGoldImportSourceAuthorizationSetV4Bytes(
  input: GoldImportSourceAuthorizationSetV4,
): Buffer {
  const authorization = validateGoldImportSourceAuthorizationSetV4(input)
  return Buffer.from(
    `${JSON.stringify(JSON.parse(canonicalJson(authorization)), null, 2)}\n`,
    'utf8',
  )
}

export function parseCanonicalGoldImportSourceAuthorizationSetV4Bytes(
  input: Uint8Array,
): GoldImportSourceAuthorizationSetV4 {
  const bytes = Buffer.from(input)
  let parsed: unknown
  try {
    parsed = JSON.parse(bytes.toString('utf8')) as unknown
  } catch {
    throw new Error('V4 source authorization set is not valid UTF-8 JSON.')
  }
  const authorization = validateGoldImportSourceAuthorizationSetV4(parsed)
  if (!bytes.equals(canonicalGoldImportSourceAuthorizationSetV4Bytes(authorization))) {
    throw new Error('V4 source authorization set is not the strict canonical JSON artifact.')
  }
  return authorization
}

function sha256Bytes(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

export interface ValidateGoldImportSourceAuthorizationSetV4ForImportInput {
  amendedAuthorization: Uint8Array
  auditTarget: 'disposable_clone' | 'local'
  completeCatalogAudit: ProtectedV2CompleteCatalogAuditIdentity
  currentState: NoteDispositionCurrentStateV2
  developmentPlanningState: unknown
  environmentInvariantIdentitySha256: string
  environmentProfileIdentitySha256: string
  expectedCatalog: ProtectedV2ExpectedCatalogBinding
  finalizedArtifact: Uint8Array
  independentlyDerivedPlan: unknown
  migration: Uint8Array
  noteDispositionAudit: unknown
  noteDispositionEvidence: NoteDispositionEvidenceBytesV2
  plan: unknown
  signedProtocolAuthorization: Uint8Array
  sourceAuthorizationSet: Uint8Array
}

/**
 * Bind an executable plan to the independently regenerated source/planning
 * candidate. Comparing counts or evidence hashes is insufficient because a
 * rebound plan could otherwise change a review payload while preserving both.
 */
export function assertExactIndependentlyDerivedImportPlanV4(input: {
  independentlyDerivedPlan: unknown
  plan: unknown
}): ImportPlanV2 {
  const plan = parseImportPlanV2(input.plan)
  const independentlyDerivedPlan = parseImportPlanV2(input.independentlyDerivedPlan)
  if (canonicalJson(plan) !== canonicalJson(independentlyDerivedPlan)) {
    throw new Error(
      'V4 runtime import plan differs from the independently derived source/planning candidate.',
    )
  }
  return plan
}

/**
 * Final file-only runtime trust boundary. The caller must regenerate
 * independentlyDerivedPlan from the authenticated artifact, planning state,
 * and note gate before calling this function and before constructing a
 * database client.
 */
export function validateGoldImportSourceAuthorizationSetV4ForImport(
  input: ValidateGoldImportSourceAuthorizationSetV4ForImportInput,
): { authorization: GoldImportSourceAuthorizationSetV4; plan: ImportPlanV2 } {
  const authorization = parseCanonicalGoldImportSourceAuthorizationSetV4Bytes(
    input.sourceAuthorizationSet,
  )
  const expectedContext =
    input.auditTarget === 'disposable_clone'
      ? ({ profileId: 'supabase_admin_owner_v1', target: 'disposable' } as const)
      : ({ profileId: 'local_supabase_postgres_owner_v1', target: 'local' } as const)
  const expectedCatalog = validateProtectedV2ExpectedCatalogBinding(
    input.expectedCatalog,
    expectedContext.profileId,
    expectedContext.target,
  )
  const completeCatalogAudit = validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile(
    input.completeCatalogAudit,
    expectedContext.profileId,
    expectedContext.target,
  )
  const plan = assertExactIndependentlyDerivedImportPlanV4({
    independentlyDerivedPlan: input.independentlyDerivedPlan,
    plan: input.plan,
  })
  const artifact = parseFinalizedGoldImportArtifact(input.finalizedArtifact, {
    expectedArtifactSha256: GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256_V4,
  })
  validateGoldImportNoteDispositionGateV2({
    audit: input.noteDispositionAudit,
    currentState: input.currentState,
    evidence: input.noteDispositionEvidence,
  })
  const planningState = compatibilityDevelopmentPlanningStateSchema.parse(
    input.developmentPlanningState,
  )
  if (
    sha256Canonical(input.developmentPlanningState) !==
    authorization.currentDatabase.developmentPlanningStateSha256
  ) {
    throw new Error('V4 runtime planning-state identity drifted.')
  }
  const existingHeads = planningState.rows.filter((row) => row.currentReviewId !== null)
  if (existingHeads.length !== authorization.exactExistingHeadCohort.headCount) {
    throw new Error('V4 runtime existing-head count drifted.')
  }
  const rederivedExistingHeadCohortSha256 = existingHeadCohortSha256(
    existingHeads,
    new Map(artifact.rows.map((row) => [row.identity.itemId, row])),
  )
  const planCounts = {
    initial: plan.counts.initial,
    inserts: plan.counts.inserts,
    noops: plan.counts.noops,
    revisions: plan.counts.revisions,
    total: plan.counts.total,
  }
  if (
    sha256Bytes(input.signedProtocolAuthorization) !==
      authorization.signedProtocolAuthorizationSha256 ||
    sha256Bytes(input.amendedAuthorization) !== authorization.amendedTwoRowAuthorizationSha256 ||
    sha256Bytes(input.migration) !== authorization.migration.sha256 ||
    authorization.auditTarget !== input.auditTarget ||
    canonicalJson(authorization.expectedCatalog) !== canonicalJson(expectedCatalog) ||
    canonicalJson(authorization.completeCatalogAudit) !== canonicalJson(completeCatalogAudit) ||
    canonicalJson(artifact.booleanNormalizations) !==
      canonicalJson(authorization.booleanNormalizationLedger) ||
    canonicalJson(artifact.listNormalizations) !==
      canonicalJson(authorization.orderedSetNormalizationLedger) ||
    canonicalJson(planCounts) !== canonicalJson(authorization.actionCounts) ||
    rederivedExistingHeadCohortSha256 !== authorization.exactExistingHeadCohort.cohortSha256 ||
    input.environmentInvariantIdentitySha256 !==
      authorization.contractAudit.environmentInvariantIdentitySha256 ||
    input.environmentProfileIdentitySha256 !==
      authorization.contractAudit.environmentProfileIdentitySha256 ||
    plan.batchId !== authorization.currentDatabase.batchId ||
    plan.scope.developmentMembershipSha256 !==
      authorization.currentDatabase.developmentMembershipSha256 ||
    plan.expectedEffectiveStateSha256 !== authorization.v2PreImportState.effectiveStateSha256 ||
    plan.expectedPhysicalStateSha256 !== authorization.v2PreImportState.physicalStateSha256 ||
    plan.sourceArtifactSha256 !== authorization.finalArtifactSha256 ||
    plan.sourceAuthorizationSetSha256 !== sha256Bytes(input.sourceAuthorizationSet) ||
    plan.noteDispositionAuditSha256 !== authorization.noteDispositionAuditSha256 ||
    plan.booleanNormalizationLedgerSha256 !== authorization.booleanNormalizationLedgerSha256 ||
    plan.orderedSetNormalizationLedgerSha256 !== authorization.orderedSetNormalizationLedgerSha256
  ) {
    throw new Error('V4 source authorization is stale or inconsistent with the V2 runtime inputs.')
  }
  return { authorization, plan }
}
