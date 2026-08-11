import { createHash } from 'node:crypto'

import {
  GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
  GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
  GOLD_REVIEW_IMPORT_COMPENSATION_V2_FUNCTION_IDENTITIES,
  GOLD_REVIEW_IMPORT_V2_RPC_NAMES,
  bindCompensationPlanV2,
  bindImportPlanV2,
  goldReviewPayloadV2Schema,
  sha256Canonical,
  type ImportPlanV2,
} from '../../src/features/literature/gold-set/import-compensation-v2'
import {
  GOLD_IMPORT_CONTRACT_V1_MIGRATION_PATH,
  GOLD_IMPORT_CONTRACT_V1_MIGRATION_SHA256,
  GOLD_IMPORT_CONTRACT_V2_CATALOG_DRIFT_MATRIX_SCHEMA_VERSION,
  GOLD_IMPORT_CONTRACT_V2_PRE_V1_BACKUP_MANIFEST_SHA256,
  type GoldImportContractV2BackupAuthorization,
  type RequiredEvidenceName,
} from './create-gold-import-contract-v2-forward-repair-backup'
import {
  buildContractInvariantIdentity,
  buildDeploymentProfileIdentity,
} from './gold-import-compensation-contract-reconciliation'
import {
  canonicalJson,
  sha256ContractCanonical,
} from './gold-import-compensation-migration-operations'
import {
  deriveDevelopmentSeedV2SchemaSnapshot,
  type DevelopmentDatabaseSeedScope,
} from './gold-import-compensation-development-seed'
import {
  EXACT_MIXED_PACKAGE_COUNTS,
  REQUIRED_SCENARIO_IDS,
  SCENARIO_EVIDENCE_SCHEMA_VERSION,
  buildCanonicalScenarioEvidence,
  type RawSqlScenarioEvidence,
  type ScenarioEvidenceRecord,
  type ScenarioStateEvidence,
} from './gold-import-compensation-rehearsal-evidence'
import {
  GOLD_IMPORT_COMPENSATION_MIGRATION_V2,
  NOTE_DISPOSITION_AUDIT_SHA256,
  REQUIRED_TRANSITION_RPCS_V1,
  REQUIRED_TRANSITION_RPCS_V2,
  buildCanonicalV2RehearsalArtifacts,
  validateV2RpcMetadata,
  type V2CanonicalAuthorizationBindings,
} from './gold-import-compensation-rehearsal-evidence-v2'
import {
  GOLD_IMPORT_COMPENSATION_PACKAGE_VERSION_V2,
  buildCompensationTemplateV2,
  deterministicPackageUuidV2,
} from './generate-gold-import-compensation-package-v2'
import {
  GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2,
  GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SHA256_V2,
} from './gold-import-note-disposition-gate-v2'
import {
  GOLD_IMPORT_EXISTING_HEAD_COHORT_SHA256_V4,
  GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256_V4,
  buildGoldImportSourceAuthorizationSetV4,
  canonicalGoldImportSourceAuthorizationSetV4Bytes,
} from './gold-import-source-authorization-v4'
import {
  GOLD_IMPORT_CONTRACT_V2_CAPTURE_ATTESTATION,
  GOLD_IMPORT_CONTRACT_V2_FULL_VALIDATION_CHECK_IDS,
  GOLD_IMPORT_CONTRACT_V2_PHASE10_EVIDENCE_NAMES,
  GOLD_IMPORT_CONTRACT_V2_TESTS_BUILD_CHECK_IDS,
  GOLD_IMPORT_CONTRACT_V2_TRUST_MODEL,
  buildGoldImportContractV2Phase10EvidenceSummary,
  serializeGoldImportContractV2Phase10EvidenceSummary,
  type GoldImportContractV2Phase10EvidenceContext,
  type GoldImportContractV2Phase10EvidenceName,
} from './gold-import-contract-v2-phase10-evidence'
import {
  committedProtectedV2CatalogExpectedArtifactForValidatedProfile,
  decodeProtectedV2CatalogExpectedInventories,
  expectedObservedAuditIdentityFromArtifact,
} from './gold-import-contract-v2-catalog-expectations'
import { validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile } from './gold-import-contract-v2-catalog-audit'
import { protectedV2ProductionCohortRowsFromImportPlan } from './gold-import-compensation-v2-cohort-identity'
import {
  V2_CANONICAL_SEMANTIC_FUNCTION_CONTRACTS,
  V2_CANONICAL_SEMANTIC_FUNCTION_RAW_DEFINITION_SHA256,
} from './gold-import-compensation-v2-semantic-function-identities'
import {
  buildProtectedV2ExpectedCatalogBinding,
  buildProtectedV2RuntimeBundleBinding,
} from './protected-gold-import-contract-v2-bindings'
import {
  PROTECTED_V2_BACKUP_RECEIPT_SCHEMA_VERSION,
  buildProtectedV2BackupExecutionReceipt,
} from './protected-gold-import-contract-v2-evidence'
import {
  buildProtectedV2OperatorBundle,
  type ProtectedV2OperatorBundle,
} from './protected-gold-import-contract-v2-recovery-bundle'
import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
} from './protected-gold-import-contract-v2'
import { PROTECTED_V2_CATALOG_DRIFT_PROBE_IDS } from './protected-gold-import-contract-v2-catalog-drift-identities'

const BATCH_ID = '10000000-0000-4000-8000-000000000001'
const TIME = '2026-08-10T12:00:00.000Z'
const SHA_AFTER_IMPORT = 'a'.repeat(64)
const SHA_AFTER_IMPORT_PHYSICAL = 'b'.repeat(64)
const SHA_AFTER_COMPENSATION_PHYSICAL = 'c'.repeat(64)
const V2_PRE_IMPORT_EFFECTIVE_STATE_SHA256 =
  'f79b825c70f0032642cd877ffa06238b6965dec479c6855105e45ee64bd01f4c'
const V2_PRE_IMPORT_PHYSICAL_STATE_SHA256 =
  'afce1a294fd5343a9127d86f6d210baabe8888ee9dc77b3ee3fcb3559d6741dd'
const EXACT_NOTE_DISPOSITION_AUDIT = {
  authorizationTemplateRequired: false,
  disposition: 'preserve_current_database_note',
  physicalHistoryEvidence: {
    currentPointersAreLatestHeads: true,
    revisionChainsLinear: true,
  },
  rows: [
    {
      amendedAuthorizationRationaleSha256:
        '7d8f4603076b3adc3e6aef85e22b362b1a000964a5b44cc566b3d1200b51e013',
      currentNote:
        'Bronchoscopy directly evaluated the structural tracheobronchial abnormality,\nand tracheoplasty was a central airway intervention. The case is relevant to\ninterventional airway practice but centers on a congenital vascular anomaly\nand surgical management rather than a bronchoscopic intervention; therefore it\nis adjacent rather than core.',
      currentNoteSha256: '7d8f4603076b3adc3e6aef85e22b362b1a000964a5b44cc566b3d1200b51e013',
      currentReviewId: 'c14d5fe8-958b-87e6-a381-4604b51277ba',
      currentRevision: 2,
      disposition: 'preserve_current_database_note',
      exactAuthorizedRationalePreserved: true,
      finalizedV3Note: 'bronchoscopic diagnosis',
      finalizedV3NoteSha256: 'db87ea402f4bcbfe52309f8a9dc9924ea7fa7d437efc3a6d4df99a525e15c3d1',
      itemId: '7f58c9cf-779f-42d8-a538-b3d39116495c',
      masterRowId: '4',
      pmid: '36879724',
    },
    {
      amendedAuthorizationRationaleSha256:
        'a7ac86081d020100990168edec59c85672b22a0fe966fe75f70bcc9248c1afc7',
      currentNote:
        'The prospective cohort is explicitly defined by referral for medical\nthoracoscopy, establishing a direct pleural-procedure relationship. The article\nprimarily evaluates etiologic characteristics of pleural effusions rather than\nthoracoscopy technique, yield, safety, or procedural outcomes; therefore it is\nadjacent rather than core.',
      currentNoteSha256: 'a7ac86081d020100990168edec59c85672b22a0fe966fe75f70bcc9248c1afc7',
      currentReviewId: 'd31ca926-4e1b-82cc-a39f-3c358b49a369',
      currentRevision: 2,
      disposition: 'preserve_current_database_note',
      exactAuthorizedRationalePreserved: true,
      finalizedV3Note: '',
      finalizedV3NoteSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      itemId: '13b9eb7f-fdc0-4b3f-af14-33b6e21e8956',
      masterRowId: '9',
      pmid: '39281191',
    },
  ],
  ruleVersion: 'amended-two-row-physician-rationale-exception/1.0.0',
  schemaVersion: 'gold-import-note-disposition-audit/1.0.0',
  sourceBindings: {
    amendedAuthorizationSha256: 'b95fc9785ee355b810981c051db62307e868110e06ffb1a83c09c8eff52bf89a',
    authorizationManifestSha256: '11d2232a2bc257a607d284f34ff6d2aa022a1e925249c3ce067258c137547a0e',
    authorizationMappingCorrectionManifestSha256:
      'f718fd854bb3c9257b5ff46748a04583110584166e63952c534d9a043c437ec0',
    authorizationMappingCorrectionSha256:
      '9f0bba6172ea1af4a6d4844365bb5aa8c63308bee67ab9df5c03d1937e8d429d',
    authorizationMappingSha256: '169808d89f094798ec1c55682dce047f4cb51de26cb1117639fc81f190250191',
    currentEffectiveStateSha256: GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.effectiveStateSha256,
    currentPhysicalStateSha256: GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.physicalStateSha256,
    developmentPlanningStateSha256:
      GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentPlanningStateSha256,
    finalizedV3ArtifactSha256: GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256_V4,
  },
  status: 'already_authorized',
} as const

const sha256Bytes = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex')

function uuid(namespace: number, index: number): string {
  const prefix = namespace.toString(16).padStart(8, '0')
  const suffix = index.toString(16).padStart(12, '0')
  return `${prefix}-0000-4000-8000-${suffix}`
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(canonicalJson(value), 'utf8')
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function parseJsonFiles(files: ReadonlyMap<string, Buffer>): unknown[] {
  return [...files]
    .filter(([name]) => name.endsWith('.json'))
    .map(([, bytes]) => JSON.parse(bytes.toString('utf8')) as unknown)
}

function manifestBytes(files: ReadonlyMap<string, Buffer>): Buffer {
  return Buffer.from(
    `${[...files]
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, bytes]) => `${sha256Bytes(bytes)}  ${name}`)
      .join('\n')}\n`,
    'utf8',
  )
}

function exactAudit(profileId: 'local_supabase_postgres_owner_v1' | 'supabase_admin_owner_v1') {
  const target = profileId === 'local_supabase_postgres_owner_v1' ? 'local' : 'disposable'
  const artifact = committedProtectedV2CatalogExpectedArtifactForValidatedProfile(profileId, target)
  return validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile(
    expectedObservedAuditIdentityFromArtifact(artifact),
    profileId,
    target,
  )
}

function exactReadyAudit(repositoryHead: string) {
  const profileId = 'supabase_admin_owner_v1' as const
  const target = 'disposable' as const
  const artifact = committedProtectedV2CatalogExpectedArtifactForValidatedProfile(profileId, target)
  const inventories = decodeProtectedV2CatalogExpectedInventories(artifact)
  const inventory = inventories.fullEnvironmentInventory as {
    deploymentProfile: Parameters<typeof buildDeploymentProfileIdentity>[2]
    rpcs: Parameters<typeof buildContractInvariantIdentity>[1]
    schemaSecurityDefinitionIdentity: Parameters<typeof buildContractInvariantIdentity>[0]
  }
  const invariant = buildContractInvariantIdentity(
    inventory.schemaSecurityDefinitionIdentity,
    inventory.rpcs,
  )
  const profile = buildDeploymentProfileIdentity(
    inventory.schemaSecurityDefinitionIdentity,
    inventory.rpcs,
    inventory.deploymentProfile,
  )
  return {
    completeCatalogAudit: exactAudit(profileId),
    contractAudit: {
      appendOnlyProtectionsReady: true,
      deploymentProfileEvidence: inventory.deploymentProfile,
      environmentInvariantIdentity: invariant,
      environmentInvariantIdentitySha256: sha256Canonical(invariant),
      environmentProfileIdentity: profile,
      environmentProfileIdentitySha256: sha256Canonical(profile),
      ownerAclReady: true,
      rpcMetadata: inventory.rpcs,
      rpcBoundaryReady: true,
      safeSearchPathsReady: true,
      schemaSecurityDefinitionIdentity: inventory.schemaSecurityDefinitionIdentity,
    },
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    database: { batchId: BATCH_ID, ...GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2 },
    exactExistingHeadCohort: {
      cohortSha256: GOLD_IMPORT_EXISTING_HEAD_COHORT_SHA256_V4,
      headCount: 9,
    },
    expectedCatalog: buildProtectedV2ExpectedCatalogBinding(profileId, target),
    expectedPostImportEffectiveStateSha256: SHA_AFTER_IMPORT,
    migration: {
      id: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
      sha256: artifact.migration.sha256,
      v1Occurrence: 1,
      v2Occurrence: 1,
    },
    repositoryCommitSha: repositoryHead,
    safety: {
      heldOutIdentitiesAccessed: false,
      readOnly: true,
      remoteAccess: false,
      remoteWritesAllowed: false,
      repeatableRead: true,
    },
    schemaVersion: 'gold-import-compensation-v2-package-audit/1.0.0' as const,
    stateIntegrity: { currentPointersAreLatestHeads: true, revisionChainsLinear: true },
    stateMutationEvidence: {
      effectiveStateChanged: false,
      itemRevealTimestampMutationCount: 0,
      pointerMutationCount: 0,
      reviewRowMutationCount: 0,
    },
    target: 'disposable_clone' as const,
    testSplitLocked: true,
    v2PreImportState: {
      effectiveStateSha256: V2_PRE_IMPORT_EFFECTIVE_STATE_SHA256,
      physicalStateSha256: V2_PRE_IMPORT_PHYSICAL_STATE_SHA256,
    },
  }
}

function review(index: number) {
  const excluded = index < 272
  return goldReviewPayloadV2Schema.parse({
    categorizationFromFullText: false,
    clinicalPurposes: excluded ? [] : ['diagnosis'],
    completedAt: TIME,
    createdAt: TIME,
    diseaseTagStatus: excluded ? null : 'not_applicable',
    diseaseTags: [],
    enrichmentProvenance: 'physician_confirmed_ai_enrichment',
    enrichmentSchemaVersion: '3.0.2',
    fullTextUsed: index < 50,
    isBlinded: false,
    labelSchemaVersion: '3.0.0',
    metadataSufficiency: 'adequate_abstract',
    notes: `Authorized fixture note ${index + 1}.`,
    publicationStatus: excluded ? null : 'full-article',
    relevanceLabel: excluded ? 'exclude' : 'include_core',
    reviewerConfidence: 'high',
    reviewerEmail: null,
    reviewerUserId: null,
    reviewSeconds: 0,
    startedAt: TIME,
    studyDesign: excluded ? null : 'retrospective-cohort',
    taxonomyVersion: '2.0.0',
    technologyTagStatus: excluded ? null : 'not_applicable',
    technologyTags: [],
    topicIds: excluded ? [] : ['basic-bronchoscopy'],
    usedSupplementalMetadata: false,
  })
}

function buildSourceAuthorizationAndPlan(repositoryHead: string) {
  const counts = { initial: 620, inserts: 630, noops: 0, revisions: 10, total: 630 }
  const expectedCatalog = buildProtectedV2ExpectedCatalogBinding(
    'supabase_admin_owner_v1',
    'disposable',
  )
  const completeCatalogAudit = exactAudit('supabase_admin_owner_v1')
  const sourceAuthorization = buildGoldImportSourceAuthorizationSetV4({
    actionCounts: counts,
    auditTarget: 'disposable_clone',
    batchId: BATCH_ID,
    booleanNormalizationLedger: [
      {
        canonicalLexeme: 'true',
        classification: 'deterministic_lexical_normalization',
        column: 'full_text_used',
        normalizationRuleVersion: 'finalized-v3-exact-boolean-lexeme/1.0.0',
        originalLexeme: 'True',
        semanticValue: true,
        sourceArtifactSha256: GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256_V4,
        sourceForm: 'legacy_title_case',
        sourceIdentity: {
          datasetSplit: 'development',
          itemId: uuid(2, 1),
          masterRowId: '1',
          pmid: '36879724',
        },
      },
    ],
    completeCatalogAudit,
    environmentInvariantIdentitySha256: expectedCatalog.environmentInvariantIdentitySha256,
    environmentProfileIdentitySha256: expectedCatalog.expectedDeploymentProfileIdentitySha256,
    existingHeadCohortSha256: GOLD_IMPORT_EXISTING_HEAD_COHORT_SHA256_V4,
    expectedCatalog,
    migrationSha256: expectedCatalog.migration.sha256,
    orderedSetNormalizationLedger: [],
    v2PreImportEffectiveStateSha256: V2_PRE_IMPORT_EFFECTIVE_STATE_SHA256,
    v2PreImportPhysicalStateSha256: V2_PRE_IMPORT_PHYSICAL_STATE_SHA256,
  })
  const sourceBytes = canonicalGoldImportSourceAuthorizationSetV4Bytes(sourceAuthorization)
  const sourceSha256 = sha256Bytes(sourceBytes)
  const operationId = uuid(5, 1)
  const actions = Array.from({ length: 630 }, (_value, index) => {
    const initial = index < 620
    const itemId = uuid(2, index + 1)
    const actionId = uuid(3, index + 1)
    const importedReviewId = uuid(4, index + 1)
    const target = review(index)
    const common = {
      actionId,
      datasetSplit: 'development' as const,
      expectedEffectiveReviewIdAfter: importedReviewId,
      expectedEventSequence: ['review_imported'] as ['review_imported'],
      expectedHeadReviewIdAfter: importedReviewId,
      importedReviewId,
      itemId,
      pmid: index === 0 ? '36879724' : index === 1 ? '39281191' : String(10_000_000 + index),
      preImportItemState: {
        automatedSignalsRevealedAt: null,
        completedAt: initial ? null : TIME,
        reviewStatus: initial ? ('pending' as const) : ('completed' as const),
        startedAt: initial ? null : TIME,
        supplementalMetadataRevealedAt: null,
      },
      review: target,
      reviewSha256: sha256Canonical(target),
      sequence: index + 1,
    }
    if (initial) {
      return {
        ...common,
        action: 'import_initial' as const,
        compensationAction: 'compensate_void' as const,
        expectedCurrentReviewId: null,
        expectedEffectiveReviewId: null,
        expectedRevision: 1 as const,
        expectedSupersedesReviewId: null,
      }
    }
    const previousReviewId = uuid(6, index + 1)
    return {
      ...common,
      action: 'import_revision' as const,
      compensationAction: 'compensate_restore' as const,
      expectedCurrentReviewId: previousReviewId,
      expectedEffectiveReviewId: previousReviewId,
      expectedRevision: 2,
      expectedSupersedesReviewId: previousReviewId,
    }
  })
  const plan = bindImportPlanV2({
    actions,
    batchId: BATCH_ID,
    booleanNormalizationLedgerSha256: sourceAuthorization.booleanNormalizationLedgerSha256,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    counts,
    executionContext: {
      compensationRpc: GOLD_REVIEW_IMPORT_V2_RPC_NAMES.compensation,
      developmentMembershipHash: 'literature_gold_development_membership_hash_v1',
      effectiveStateHash: GOLD_REVIEW_IMPORT_V2_RPC_NAMES.effectiveStateHash,
      importRpc: GOLD_REVIEW_IMPORT_V2_RPC_NAMES.import,
      migrationId: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
      physicalStateHash: GOLD_REVIEW_IMPORT_V2_RPC_NAMES.physicalStateHash,
      reconciliationRpc: GOLD_REVIEW_IMPORT_V2_RPC_NAMES.reconciliation,
      remoteWritesAllowed: false,
      repositoryCommitSha: repositoryHead,
      targetDatabase: 'local',
    },
    expectedEffectiveStateSha256: V2_PRE_IMPORT_EFFECTIVE_STATE_SHA256,
    expectedPhysicalStateSha256: V2_PRE_IMPORT_PHYSICAL_STATE_SHA256,
    expectedPostEffectiveStateSha256: SHA_AFTER_IMPORT,
    kind: 'import',
    noteDispositionAuditSha256: GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SHA256_V2,
    operationId,
    orderedSetNormalizationLedgerSha256: sourceAuthorization.orderedSetNormalizationLedgerSha256,
    scope: {
      datasetSplit: 'development',
      developmentMembershipSha256:
        GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentMembershipSha256,
      heldOutIdentitiesAccessed: false,
    },
    sourceArtifactSha256: GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256_V4,
    sourceAuthorizationSetSha256: sourceSha256,
  })
  return { plan, sourceAuthorization, sourceBytes }
}

function developmentSeed(): DevelopmentDatabaseSeedScope {
  const reviews = Array.from({ length: 11 }, (_value, index) => ({
    id: uuid(7, index + 1),
    item_id: uuid(2, index + 1),
    revision: 1,
    supersedes_review_id: null,
  }))
  return {
    batchId: BATCH_ID,
    datasetSplit: 'development',
    heldOutIdentitiesIncluded: false,
    schemaVersion: 'literature-gold-protected-v2-preapplication-development-backup/1.0.0',
    tables: {
      literature_articles: Array.from({ length: 630 }, (_value, index) => ({
        pmid: index === 0 ? '36879724' : index === 1 ? '39281191' : String(10_000_000 + index),
      })),
      literature_gold_set_batches: [{ id: BATCH_ID, name: 'gold-set-v1' }],
      literature_gold_set_events: [
        {
          after_value: {
            kind: 'literature_gold_set',
            name: 'gold-set-v1',
            requested_size: 630,
            sampling_seed: 'synthetic-forward-backup-fixture',
          },
          batch_id: BATCH_ID,
          before_value: null,
          created_at: TIME,
          event_type: 'batch_created',
          id: uuid(8, 1),
          item_id: null,
          operation_action_id: null,
          operation_event_sequence: null,
          operation_id: null,
        },
      ],
      literature_gold_set_items: Array.from({ length: 630 }, (_value, index) => ({
        automated_signals_revealed_at: null,
        batch_id: BATCH_ID,
        current_review_id: index < 11 ? uuid(7, index + 1) : null,
        dataset_split: 'development',
        display_order: index + 1,
        id: uuid(2, index + 1),
        pmid: index === 0 ? '36879724' : index === 1 ? '39281191' : String(10_000_000 + index),
        supplemental_metadata_revealed_at: null,
      })),
      literature_gold_set_review_drafts: [],
      literature_gold_set_reviews: reviews,
    },
  }
}

function realLocalMarkdown(authorization: GoldImportContractV2BackupAuthorization): string {
  return `# Gold import contract V2 real-local pre-application report

- Status: \`implementation_ready_real_local_migration_required\`
- V1 migration occurrence: \`1\`
- V2 migration occurrence: \`0\`
- Membership: \`${GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentMembershipSha256}\`
- Effective state: \`${GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.effectiveStateSha256}\`
- Physical state: \`${GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.physicalStateSha256}\`
- Planning state: \`${GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentPlanningStateSha256}\`
- Review-row mutations: \`0\`
- Pointer mutations: \`0\`
- Reveal-timestamp mutations: \`0\`
- Operations: \`0\`
- Actions: \`0\`
- Imports: \`0\`
- Compensations: \`0\`
- Held-out identities accessed: \`false\`
- Remote database accessed: \`false\`
- Ordinary local-start protected state: \`v2_absent_unarmed\`
- Protected V2 visible to first-start initialization: \`false\`
- Protected V2 visible to ordinary migration-up: \`false\`
- Expected catalog profile: \`${authorization.localExpectedCatalog.profileId}/${authorization.localExpectedCatalog.target}\`
- Expected catalog artifact content SHA-256: \`${authorization.localExpectedCatalog.artifact.contentSha256}\`
- Expected catalog artifact file SHA-256: \`${authorization.localExpectedCatalog.artifact.fileSha256}\`
- Protected runtime bundle SHA-256: \`${authorization.protectedRuntimeBundle.aggregateSha256}\`
- Protected tracked-file inventory SHA-256: \`${authorization.protectedRuntimeBundle.trackedFileInventorySha256}\`

The V2 migration remains unapplied to the real local database. Package execution therefore remains
blocked until a separately authorized migration-application session completes and re-audits it.
`
}

interface RealLocalFixture {
  backupInstanceIds: string[]
  captureManifestSha256s: string[]
  captureReceiptSha256s: string[]
  executionNonces: string[]
  files: Map<string, Buffer>
  outputDirectories: string[]
  preV2Snapshot: ReturnType<typeof deriveDevelopmentSeedV2SchemaSnapshot>
}

function buildRealLocalFixture(input: {
  authorization: GoldImportContractV2BackupAuthorization
  operatorBundle: ProtectedV2OperatorBundle
  repository: { branch: string; head: string; originMain: string }
}): RealLocalFixture {
  const seed = developmentSeed()
  const seedBytes = canonicalBytes(seed)
  const ledger = {
    entries: [
      {
        name: PROTECTED_GOLD_IMPORT_CONTRACT_V1.migrationName,
        version: PROTECTED_GOLD_IMPORT_CONTRACT_V1.version,
      },
    ],
    protectedV2: {
      classification: 'v2_absent',
      expected: PROTECTED_GOLD_IMPORT_CONTRACT_V2,
      occurrence: 0,
    },
    schemaVersion: 'literature-gold-protected-v2-ledger-backup/1.0.0',
  }
  const ledgerBytes = canonicalBytes(ledger)
  const state = {
    batchId: BATCH_ID,
    batchName: 'gold-set-v1',
    datasetSplit: 'development',
    ...GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2,
    schemaVersion: 'literature-gold-protected-v2-state-backup/1.0.0',
  }
  const stateBytes = canonicalBytes(state)
  const markdownBytes = Buffer.from(realLocalMarkdown(input.authorization), 'utf8')
  const report = {
    backup: {
      completeDevelopmentSnapshot: true,
      files: {
        'development-database-seed.json': sha256Bytes(seedBytes),
        'protected-migration-ledger.json': sha256Bytes(ledgerBytes),
        'state-hashes.json': sha256Bytes(stateBytes),
      },
      heldOutIdentitiesIncluded: false,
    },
    database: {
      batchId: BATCH_ID,
      batchName: 'gold-set-v1',
      current: GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2,
      mutations: {
        pointerMutationCount: 0,
        revealTimestampMutationCount: 0,
        reviewRowMutationCount: 0,
      },
      operations: {
        actionCount: 0,
        compensationCount: 0,
        importCount: 0,
        operationCount: 0,
        readOnlyTransaction: true,
      },
      readOnlyBracket: {
        after: {
          ...GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2,
          readOnlyTransaction: true,
        },
        before: {
          ...GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2,
          readOnlyTransaction: true,
        },
        matches: true,
      },
    },
    expectedCatalog: input.authorization.localExpectedCatalog,
    migration: {
      v1: {
        byteIdentical: true,
        id: '20260808035633_add_literature_gold_import_compensation_contract',
        occurrence: 1,
        sha256: GOLD_IMPORT_CONTRACT_V1_MIGRATION_SHA256,
      },
      v2: {
        appliedToRealLocal: false,
        id: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
        occurrence: 0,
        sha256: input.authorization.localExpectedCatalog.migration.sha256,
      },
    },
    operatorBundleBinding: input.authorization.protectedRuntimeBundle,
    ordinaryLocalStartPlan: {
      firstStartProtectedV2Visible: false,
      migrationUpProtectedV2Visible: false,
      protectedMigrationApplicationPlanned: false,
      protectedMigrationState: 'v2_absent_unarmed',
      protectedV2AuthorizationPresent: false,
    },
    readiness: {
      implementationAndDisposableRehearsalMayBeReady: true,
      realLocalMigrationApplicationSeparatelyAuthorized: false,
      realLocalPackageExecutionAuthorized: false,
      requiredNextStep: 'separately_authorized_real_local_v2_migration_application',
    },
    repository: input.repository,
    safety: {
      compensationExecuted: false,
      finalizedSourceArtifactRead: false,
      heldOutIdentitiesAccessed: false,
      importExecuted: false,
      realLocalDatabaseMutationCount: 0,
      remoteDatabaseAccessed: false,
      repeatableReadReadOnly: true,
      writeCapableApplicationClientConstructed: false,
    },
    schemaVersion: 'gold-import-contract-v2-preapplication-report/1.0.0',
    status: 'implementation_ready_real_local_migration_required',
  }
  const reportBytes = canonicalBytes(report)
  const canonicalFiles = new Map<string, Buffer>([
    ['development-database-seed.json', seedBytes],
    ['pre-application-report.json', reportBytes],
    ['pre-application-report.md', markdownBytes],
    ['protected-migration-ledger.json', ledgerBytes],
    ['state-hashes.json', stateBytes],
  ])
  const captureManifest = manifestBytes(canonicalFiles)
  const files = new Map<string, Buffer>()
  const backupInstanceIds: string[] = []
  const captureManifestSha256s: string[] = []
  const captureReceiptSha256s: string[] = []
  const executionNonces: string[] = []
  const outputDirectories: string[] = []
  for (const index of [1, 2]) {
    const prefix = `capture-${index}`
    const executionNonce = String(index).repeat(64)
    const outputDirectory = `/synthetic-read-only/capture-${index}`
    const receipt = buildProtectedV2BackupExecutionReceipt(
      {
        backupRoot: '/synthetic-read-only',
        canonicalManifestSha256: sha256Bytes(captureManifest),
        database: {
          batchId: BATCH_ID,
          datasetSplit: 'development',
          ...GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2,
        },
        executedAt: `2026-08-10T12:00:0${index}.000Z`,
        executionNonce,
        expectedCatalog: input.authorization.localExpectedCatalog,
        migrationLedger: {
          sha256: sha256Bytes(ledgerBytes),
          v1: { ...PROTECTED_GOLD_IMPORT_CONTRACT_V1, occurrence: 1 },
          v2: { ...PROTECTED_GOLD_IMPORT_CONTRACT_V2, occurrence: 0 },
        },
        operatorBundleBinding: input.authorization.protectedRuntimeBundle,
        outputDirectory,
        repositoryCommitSha: input.repository.head,
        safety: {
          databaseMutationCount: 0,
          heldOutIdentitiesAccessed: false,
          remoteDatabaseAccessed: false,
        },
        schemaVersion: PROTECTED_V2_BACKUP_RECEIPT_SCHEMA_VERSION,
      },
      { operatorBundle: input.operatorBundle },
    )
    const receiptBytes = Buffer.from(canonicalJson(receipt), 'utf8')
    for (const [name, bytes] of canonicalFiles) files.set(`${prefix}/${name}`, bytes)
    files.set(`${prefix}/checksum-manifest.sha256`, captureManifest)
    files.set(`${prefix}/execution-receipt.json`, receiptBytes)
    backupInstanceIds.push(receipt.backupInstanceId)
    captureManifestSha256s.push(sha256Bytes(captureManifest))
    captureReceiptSha256s.push(sha256Bytes(receiptBytes))
    executionNonces.push(executionNonce)
    outputDirectories.push(outputDirectory)
  }
  const preV2Snapshot = deriveDevelopmentSeedV2SchemaSnapshot({
    effectiveStateSha256V1: GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.effectiveStateSha256,
    membershipSha256: GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentMembershipSha256,
    physicalStateSha256V1: GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.physicalStateSha256,
    planningStateSha256: GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentPlanningStateSha256,
    seed,
    sha256Canonical: sha256ContractCanonical,
  })
  return {
    backupInstanceIds: backupInstanceIds.sort(),
    captureManifestSha256s: captureManifestSha256s.sort(),
    captureReceiptSha256s: captureReceiptSha256s.sort(),
    executionNonces: executionNonces.sort(),
    files,
    outputDirectories: outputDirectories.sort(),
    preV2Snapshot,
  }
}

function bindReceipt<T extends Record<string, unknown> & { response: string }>(content: T) {
  return {
    ...content,
    binding: {
      contentSha256: sha256Canonical(
        Object.fromEntries(Object.entries(content).filter(([key]) => key !== 'response')),
      ),
    },
  }
}

function buildOperationScenarios(plan: ImportPlanV2) {
  const template = buildCompensationTemplateV2(plan)
  const preImport = {
    effectiveStateSha256: plan.expectedEffectiveStateSha256,
    physicalStateSha256: plan.expectedPhysicalStateSha256,
  }
  const postImport = {
    effectiveStateSha256: plan.expectedPostEffectiveStateSha256,
    physicalStateSha256: SHA_AFTER_IMPORT_PHYSICAL,
  }
  const importContent = {
    actionCounts: plan.counts,
    afterEffectiveStateSha256: postImport.effectiveStateSha256,
    afterPhysicalStateSha256: postImport.physicalStateSha256,
    batchId: plan.batchId,
    beforeEffectiveStateSha256: preImport.effectiveStateSha256,
    beforePhysicalStateSha256: preImport.physicalStateSha256,
    booleanNormalizationLedgerSha256: plan.booleanNormalizationLedgerSha256,
    contractVersion: plan.contractVersion,
    counts: { applied: 630, noops: 0, planned: 630 },
    error: null,
    eventSequence: [
      'import_started',
      ...Array.from({ length: 630 }, () => 'review_imported' as const),
      'import_completed',
    ],
    idempotencyKey: plan.binding.idempotencyKey,
    kind: 'import_receipt' as const,
    migrationId: plan.executionContext.migrationId,
    noteDispositionAuditSha256: plan.noteDispositionAuditSha256,
    operationId: plan.operationId,
    orderedSetNormalizationLedgerSha256: plan.orderedSetNormalizationLedgerSha256,
    outcome: 'committed' as const,
    planSha256: plan.binding.contentSha256,
    response: 'applied' as const,
    sourceAuthorizationSetSha256: plan.sourceAuthorizationSetSha256,
  }
  const importApplied = bindReceipt(importContent)
  const compensationPlan = bindCompensationPlanV2({
    actions: template.actions,
    batchId: template.batchId,
    booleanNormalizationLedgerSha256: template.evidence.booleanNormalizationLedgerSha256,
    contractVersion: template.contractVersion,
    counts: template.counts,
    executionContext: plan.executionContext,
    expectedEffectiveStateSha256: postImport.effectiveStateSha256,
    expectedPhysicalStateSha256: postImport.physicalStateSha256,
    expectedPostEffectiveStateSha256: template.expectedPostEffectiveStateSha256,
    importPlanSha256: template.importPlanSha256,
    importReceiptSha256: importApplied.binding.contentSha256,
    kind: 'compensation',
    noteDispositionAuditSha256: template.evidence.noteDispositionAuditSha256,
    operationId: template.operationId,
    orderedSetNormalizationLedgerSha256: template.evidence.orderedSetNormalizationLedgerSha256,
    scope: plan.scope,
    sourceArtifactSha256: plan.sourceArtifactSha256,
    sourceAuthorizationSetSha256: template.evidence.sourceAuthorizationSetSha256,
    targetImportOperationId: template.targetImportOperationId,
  })
  const postCompensation = {
    effectiveStateSha256: preImport.effectiveStateSha256,
    physicalStateSha256: SHA_AFTER_COMPENSATION_PHYSICAL,
  }
  const compensationContent = {
    actionCounts: compensationPlan.counts,
    afterEffectiveStateSha256: postCompensation.effectiveStateSha256,
    afterPhysicalStateSha256: postCompensation.physicalStateSha256,
    batchId: compensationPlan.batchId,
    beforeEffectiveStateSha256: postImport.effectiveStateSha256,
    beforePhysicalStateSha256: postImport.physicalStateSha256,
    booleanNormalizationLedgerSha256: compensationPlan.booleanNormalizationLedgerSha256,
    contractVersion: compensationPlan.contractVersion,
    counts: { applied: 630, noops: 0, planned: 630 },
    error: null,
    eventSequence: [
      'import_compensation_started',
      ...compensationPlan.actions.map(({ action }) =>
        action === 'compensate_restore'
          ? ('review_compensated' as const)
          : ('review_voided' as const),
      ),
      'import_compensation_completed',
    ],
    idempotencyKey: compensationPlan.binding.idempotencyKey,
    kind: 'compensation_receipt' as const,
    migrationId: compensationPlan.executionContext.migrationId,
    noteDispositionAuditSha256: compensationPlan.noteDispositionAuditSha256,
    operationId: compensationPlan.operationId,
    orderedSetNormalizationLedgerSha256: compensationPlan.orderedSetNormalizationLedgerSha256,
    outcome: 'committed' as const,
    planSha256: compensationPlan.binding.contentSha256,
    response: 'applied' as const,
    sourceAuthorizationSetSha256: compensationPlan.sourceAuthorizationSetSha256,
    targetImportOperationId: compensationPlan.targetImportOperationId,
  }
  const compensationApplied = bindReceipt(compensationContent)
  const atomic = {
    actionMutationCount: 0,
    eventMutationCount: 0,
    failedJournalSealed: true,
    pointerMutationCount: 0,
    revealTimestampMutationCount: 0,
    reviewMutationCount: 0,
  }
  return {
    atomicity: {
      beforeAction1: { ...atomic, failedJournalSealed: false },
      finalAction: atomic,
      midOperation: atomic,
    },
    compensation: {
      actionMappingCount: 630,
      appendOnly: true,
      effectiveStateRestored: true,
      exactPayloadCopy: true,
      physicalHistoryExtended: true,
    },
    idempotency: { mutationCount: 0, sameReceipt: true },
    lostAcknowledgement: { mutationCount: 0, readOnlyReconcile: true, sameReceipt: true },
    receiptsAndState: {
      receipts: {
        compensationApplied,
        compensationReplayed: bindReceipt({
          ...compensationContent,
          response: 'idempotent_replay' as const,
        }),
        importApplied,
        importReconciled: bindReceipt({
          ...importContent,
          response: 'idempotent_replay' as const,
        }),
        importReplayed: bindReceipt({
          ...importContent,
          response: 'idempotent_replay' as const,
        }),
      },
      state: {
        postCompensation,
        postCompensationReplay: postCompensation,
        postImport,
        postImportReplay: postImport,
        postLostAcknowledgementReconcile: postImport,
        preImport,
      },
    },
  }
}

function buildExactPackage(input: {
  authorization: GoldImportContractV2BackupAuthorization
  plan: ImportPlanV2
  sourceAuthorization: ReturnType<typeof buildGoldImportSourceAuthorizationSetV4>
  sourceBytes: Buffer
}) {
  const files = new Map<string, Buffer>()
  const compensationTemplate = buildCompensationTemplateV2(input.plan)
  files.set(
    'ambiguous-outcome-reconciliation-v2.json',
    canonicalBytes({
      automaticRetryAllowed: false,
      contractVersion: input.plan.contractVersion,
      importOperationId: input.plan.operationId,
      importPlanSha256: input.plan.binding.contentSha256,
      kind: 'ambiguous_outcome_reconciliation',
      reconciliationRpc: GOLD_REVIEW_IMPORT_V2_RPC_NAMES.reconciliation,
      recoveryMutationsAllowed: false,
    }),
  )
  files.set('append-only-compensation-plan-template-v2.json', canonicalBytes(compensationTemplate))
  files.set(
    'boolean-normalization-ledger-v2.json',
    canonicalBytes({
      artifactSha256: input.sourceAuthorization.finalArtifactSha256,
      ledger: input.sourceAuthorization.booleanNormalizationLedger,
      ledgerSha256: input.sourceAuthorization.booleanNormalizationLedgerSha256,
      schemaVersion: 'gold-import-boolean-normalization-ledger/2.0.0',
    }),
  )
  files.set(
    'exact-catalog-binding-v2.json',
    canonicalBytes({
      auditTarget: 'disposable_clone',
      authorization: 'exact_committed_expected_state',
      completeCatalogAudit: input.sourceAuthorization.completeCatalogAudit,
      expectedCatalog: input.authorization.disposableExpectedCatalog,
      schemaVersion: 'gold-import-compensation-v2-exact-catalog-binding/1.0.0',
    }),
  )
  files.set('immutable-atomic-import-plan-v2.json', canonicalBytes(input.plan))
  files.set(
    'journal-template-v2.json',
    canonicalBytes({
      contractVersion: input.plan.contractVersion,
      importActionCount: input.plan.counts.total,
      importOperationId: input.plan.operationId,
      notExecuted: true,
      outcome: null,
      receipt: null,
    }),
  )
  if (
    sha256Canonical(EXACT_NOTE_DISPOSITION_AUDIT) !== GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SHA256_V2
  ) {
    throw new Error('Embedded exact note-disposition audit identity drifted.')
  }
  files.set(
    'note-disposition-proof-v2.json',
    canonicalBytes({
      audit: EXACT_NOTE_DISPOSITION_AUDIT,
      auditSha256: GOLD_IMPORT_NOTE_DISPOSITION_AUDIT_SHA256_V2,
      exactTwoRowGatePassed: true,
      schemaVersion: 'gold-import-note-disposition-proof/2.0.0',
    }),
  )
  files.set(
    'ordered-set-normalization-ledger-v2.json',
    canonicalBytes({
      artifactSha256: input.sourceAuthorization.finalArtifactSha256,
      ledger: input.sourceAuthorization.orderedSetNormalizationLedger,
      ledgerSha256: input.sourceAuthorization.orderedSetNormalizationLedgerSha256,
      schemaVersion: 'gold-import-ordered-set-normalization-ledger/2.0.0',
    }),
  )
  files.set(
    'proposed-commands-v2.txt',
    Buffer.from(
      'Generate only after the V2 migration audit is ready. Execute only with a separately completed operator authorization; never retry an ambiguous operation.\n',
      'utf8',
    ),
  )
  files.set(
    'receipt-template-v2.json',
    canonicalBytes({
      contractVersion: input.plan.contractVersion,
      evidence: {
        booleanNormalizationLedgerSha256: input.plan.booleanNormalizationLedgerSha256,
        noteDispositionAuditSha256: input.plan.noteDispositionAuditSha256,
        orderedSetNormalizationLedgerSha256: input.plan.orderedSetNormalizationLedgerSha256,
        sourceAuthorizationSetSha256: input.plan.sourceAuthorizationSetSha256,
      },
      migrationId: input.plan.executionContext.migrationId,
      notExecuted: true,
      operationId: input.plan.operationId,
      physicalHashes: 'database_observed_at_execution',
    }),
  )
  files.set('source-authorization-set-v4.json', input.sourceBytes)
  files.set(
    'state-hash-proof-v2.json',
    canonicalBytes({
      compensationRestoresPreImportEffectiveState: true,
      physicalHistoryAppendOnly: true,
      postCompensationEffectiveStateSha256: input.plan.expectedEffectiveStateSha256,
      postImportEffectiveStateSha256: input.plan.expectedPostEffectiveStateSha256,
      preImportEffectiveStateSha256: input.plan.expectedEffectiveStateSha256,
      preImportPhysicalStateSha256: input.plan.expectedPhysicalStateSha256,
      schemaVersion: 'gold-import-compensation-state-hash-proof/2.0.0',
    }),
  )
  files.set(
    'unsigned-import-operation-authorization-template-v2.json',
    canonicalBytes({
      authorizationId: null,
      authorizationNote: null,
      authorized: false,
      authorizedAt: null,
      authorizedBy: null,
      batchId: input.plan.batchId,
      binding: null,
      booleanNormalizationLedgerSha256: input.plan.booleanNormalizationLedgerSha256,
      contractVersion: input.plan.contractVersion,
      expectedEffectiveStateSha256: input.plan.expectedEffectiveStateSha256,
      expectedPhysicalStateSha256: input.plan.expectedPhysicalStateSha256,
      expectedPostEffectiveStateSha256: input.plan.expectedPostEffectiveStateSha256,
      idempotencyKey: input.plan.binding.idempotencyKey,
      kind: 'unsigned_import_authorization_template',
      migrationId: input.plan.executionContext.migrationId,
      noteDispositionAuditSha256: input.plan.noteDispositionAuditSha256,
      notExecutable: true,
      operationId: input.plan.operationId,
      orderedSetNormalizationLedgerSha256: input.plan.orderedSetNormalizationLedgerSha256,
      planSha256: input.plan.binding.contentSha256,
      readiness: 'separate_operator_authorization_required',
      remoteWritesAllowed: false,
      repositoryCommitSha: input.plan.executionContext.repositoryCommitSha,
      sourceArtifactSha256: input.plan.sourceArtifactSha256,
      sourceAuthorizationSetSha256: input.plan.sourceAuthorizationSetSha256,
      targetDatabase: 'local',
    }),
  )
  files.set(
    'unsigned-compensation-operation-authorization-template-v2.json',
    canonicalBytes({
      authorizationId: null,
      authorizationNote: null,
      authorized: false,
      authorizedAt: null,
      authorizedBy: null,
      batchId: compensationTemplate.batchId,
      binding: null,
      booleanNormalizationLedgerSha256: input.plan.booleanNormalizationLedgerSha256,
      contractVersion: input.plan.contractVersion,
      expectedEffectiveStateSha256: compensationTemplate.expectedEffectiveStateSha256,
      expectedPhysicalStateSha256: null,
      expectedPostEffectiveStateSha256: compensationTemplate.expectedPostEffectiveStateSha256,
      idempotencyKey: null,
      importReceiptSha256: null,
      kind: 'unsigned_compensation_authorization_template',
      migrationId: input.plan.executionContext.migrationId,
      noteDispositionAuditSha256: input.plan.noteDispositionAuditSha256,
      notExecutable: true,
      operationId: compensationTemplate.operationId,
      orderedSetNormalizationLedgerSha256: input.plan.orderedSetNormalizationLedgerSha256,
      planSha256: null,
      readiness: 'committed_import_receipt_and_separate_authorization_required',
      remoteWritesAllowed: false,
      repositoryCommitSha: input.plan.executionContext.repositoryCommitSha,
      sourceArtifactSha256: input.plan.sourceArtifactSha256,
      sourceAuthorizationSetSha256: input.plan.sourceAuthorizationSetSha256,
      targetDatabase: 'local',
      targetImportOperationId: input.plan.operationId,
    }),
  )
  const artifacts = Object.fromEntries(
    [...files]
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, bytes]) => [name, sha256Bytes(bytes)]),
  )
  const descriptor = {
    actionCounts: input.plan.counts,
    artifacts,
    auditTarget: 'disposable_clone',
    completeCatalogAuditIdentitySha256:
      input.sourceAuthorization.completeCatalogAudit.fullAuditIdentitySha256,
    contractVersion: input.plan.contractVersion,
    databaseAccess: 'none_file_only_authenticated_audit',
    expectedCatalogArtifactContentSha256:
      input.authorization.disposableExpectedCatalog.artifact.contentSha256,
    expectedCatalogArtifactFileSha256:
      input.authorization.disposableExpectedCatalog.artifact.fileSha256,
    expectedCatalogBindingSha256: input.authorization.disposableExpectedCatalog.bindingSha256,
    heldOutIdentitiesAccessed: false,
    importOperationId: input.plan.operationId,
    importPlanSha256: input.plan.binding.contentSha256,
    kind: 'gold_import_compensation_package',
    migration: {
      id: input.plan.executionContext.migrationId,
      sha256: input.sourceAuthorization.migration.sha256,
    },
    noteDispositionAuditSha256: input.plan.noteDispositionAuditSha256,
    packageVersion: GOLD_IMPORT_COMPENSATION_PACKAGE_VERSION_V2,
    remoteAccess: false,
    schemaVersion: 'gold-import-compensation-package-generator/2.0.0',
    sourceAuthorizationSetSha256: sha256Bytes(input.sourceBytes),
    sourceAuthorizationVersion: 4,
  }
  files.set('package-descriptor-v2.json', canonicalBytes(descriptor))
  files.set('checksum-manifest-v2.sha256', manifestBytes(files))
  return { compensationTemplate, descriptor, files }
}

function scenarioState(label: string): ScenarioStateEvidence {
  return {
    currentPointer: deterministicPackageUuidV2('scenario-state', label),
    effectiveStateHash: sha256Bytes(`effective-${label}`),
    eventCount: 2,
    maxRevision: 1,
    physicalStateHash: sha256Bytes(`physical-${label}`),
    reviewCount: 1,
  }
}

function v1Scenario(
  scenarioId: (typeof REQUIRED_SCENARIO_IDS)[number],
  index: number,
): ScenarioEvidenceRecord {
  const preState = scenarioState(`${index}-pre`)
  const postState = { ...preState }
  const record: ScenarioEvidenceRecord = {
    actualResult: { outcome: 'controlled' },
    assertions: [{ actual: true, expected: true, name: 'runtime assertion', passed: true }],
    databaseContractInvoked: true,
    description: `Synthetic disposable scenario ${index + 1}.`,
    expectedResult: { outcome: 'controlled' },
    mutationCount: 0,
    postState,
    preState,
    rpcOrFunctionNames: ['apply_literature_gold_import_v1'],
    scenarioId,
    sqlstateOrOutcome: 'committed',
    status: 'passed',
  }
  if (index === 2) {
    record.actualResult = {
      ...EXACT_MIXED_PACKAGE_COUNTS,
      changedPointerCount: 624,
      eventCounts: { import_completed: 1, import_started: 1, review_imported: 624 },
      finalMatchingHeadCount: 630,
      idempotentReplay: true,
      insertRevisionCounts: { revision1: 621, revision2: 3 },
      unchangedNoopPointerCount: 6,
      uniqueActionIdentities: 630,
    }
    record.expectedResult = jsonClone(record.actualResult)
    record.mutationCount = 624
  }
  if (index === 3 || index === 8) {
    record.postState = {
      ...postState,
      eventCount: preState.eventCount + 2,
      physicalStateHash: sha256Bytes(`sealed-failure-${index}`),
    }
    record.actualResult = {
      effectiveStateChanged: false,
      eventSequence:
        index === 3
          ? ['import_started', 'import_failed']
          : ['import_compensation_started', 'import_compensation_failed'],
      outcome: 'failed',
      physicalAuditChanged: true,
      physicalAuditSealed: true,
      receiptAfterPhysicalStateSha256: record.postState.physicalStateHash,
    }
    record.expectedResult = jsonClone(record.actualResult)
  }
  if (index === 4) {
    record.actualResult = {
      automaticRetryPermitted: false,
      clientObservedReceipt: false,
      databaseStatus: 'completed',
      durableCommitObserved: true,
    }
    record.expectedResult = jsonClone(record.actualResult)
    record.mutationCount = 1
  }
  if (index === 6) {
    record.preState = {
      ...preState,
      effectiveStateHash: sha256Bytes('restored-effective'),
      physicalStateHash: sha256Bytes('before-import-physical'),
    }
    record.postState = {
      ...postState,
      effectiveStateHash: sha256Bytes('restored-effective'),
      physicalStateHash: sha256Bytes('after-compensation-physical'),
    }
    record.mutationCount = 1
  }
  if (index === 10 || index === 11) {
    record.postState = {
      ...postState,
      currentPointer: deterministicPackageUuidV2('ordinary-pointer', index),
      effectiveStateHash: sha256Bytes(`ordinary-effective-${index}`),
      maxRevision: preState.maxRevision + 1,
      physicalStateHash: sha256Bytes(`ordinary-physical-${index}`),
      reviewCount: preState.reviewCount + 1,
    }
    record.actualResult.reviewId = record.postState.currentPointer
    record.expectedResult.reviewId = record.postState.currentPointer
    record.mutationCount = 1
  }
  return record
}

function v1VerifierEvidence(v1MigrationSha256: string, v1VerifierSha256: string) {
  const evidence: RawSqlScenarioEvidence = {
    allScenariosPassed: true,
    mixedPackageCounts: { ...EXACT_MIXED_PACKAGE_COUNTS },
    scenarios: REQUIRED_SCENARIO_IDS.map(v1Scenario),
    schemaVersion: SCENARIO_EVIDENCE_SCHEMA_VERSION,
  }
  return buildCanonicalScenarioEvidence(evidence, v1MigrationSha256, v1VerifierSha256)
}

function rpcMetadata(owner: 'postgres' | 'supabase_admin') {
  const applyArguments =
    'p_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text'
  const compensationArguments =
    'p_operation_id uuid, p_target_import_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text'
  return {
    functions: [...REQUIRED_TRANSITION_RPCS_V1, ...REQUIRED_TRANSITION_RPCS_V2].map((name) => ({
      anonExecute: false,
      authenticatedExecute: false,
      identityArguments: name.startsWith('apply_')
        ? applyArguments
        : name.startsWith('compensate_')
          ? compensationArguments
          : 'p_operation_id uuid, p_recovery_authorization_sha256 text, p_recovery_authorization jsonb',
      name,
      owner,
      publicExecute: false,
      resultType: 'jsonb',
      searchPath: 'pg_catalog, public, extensions',
      securityDefiner: true,
      serviceRoleExecute: true,
      volatility: name.startsWith('reconcile_') ? 's' : 'v',
    })),
  }
}

function semanticFunctions(owner: 'postgres' | 'supabase_admin') {
  return Object.keys(GOLD_REVIEW_IMPORT_COMPENSATION_V2_FUNCTION_IDENTITIES)
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((name) => {
      const typedName = name as keyof typeof GOLD_REVIEW_IMPORT_COMPENSATION_V2_FUNCTION_IDENTITIES
      const identity = GOLD_REVIEW_IMPORT_COMPENSATION_V2_FUNCTION_IDENTITIES[typedName]
      const contract = V2_CANONICAL_SEMANTIC_FUNCTION_CONTRACTS[typedName]
      return {
        anonExecute: false,
        authenticatedExecute: false,
        identityArguments: identity.identityArguments,
        name,
        owner,
        publicExecute: false,
        rawDefinitionSha256: V2_CANONICAL_SEMANTIC_FUNCTION_RAW_DEFINITION_SHA256[typedName],
        resultType: contract.resultType,
        searchPath: contract.searchPath,
        securityDefiner: contract.securityDefiner,
        serviceRoleExecute: contract.serviceRoleExecute,
        volatility: contract.volatility,
      }
    })
}

function verifierEvidence(input: {
  compensationReceiptSha256: string
  importReceiptSha256: string
  migrationPath: 'fresh' | 'upgrade'
  postV2Snapshot: ReturnType<typeof deriveDevelopmentSeedV2SchemaSnapshot>
  v1MigrationSha256: string
  v1VerifierSha256: string
}) {
  const ownerProfile = (owner: 'postgres' | 'supabase_admin') => ({
    ...(owner === 'postgres'
      ? { authenticatedByTransactionalCatalogProjection: true as const }
      : {}),
    rpcMetadata: validateV2RpcMetadata(rpcMetadata(owner), owner),
    semanticFunctions: semanticFunctions(owner),
  })
  return {
    ownerProfiles: {
      disposableSupabaseAdmin: ownerProfile('supabase_admin'),
      supportedLocalPostgresProjection: ownerProfile('postgres'),
      transactionalProjectionRollbackRestored: true,
    },
    postV2SeedProjection: {
      migrationEquivalentToUpgrade: true,
      seedMode:
        input.migrationPath === 'fresh'
          ? 'migration_equivalent_post_v2_projection'
          : 'exact_pre_v1',
      snapshot: input.postV2Snapshot,
    },
    v1: v1VerifierEvidence(input.v1MigrationSha256, input.v1VerifierSha256),
    v2: {
      allChecksPassed: true,
      contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
      fixtureScope: 'synthetic_small_fixture',
      migrationId: GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2,
      productionCohortCountsVerifiedElsewhere: true,
      scenarios: {
        atomicity: {
          failedJournalSealed: true,
          pointerMutationCount: 0,
          revealTimestampMutationCount: 0,
          reviewMutationCount: 0,
        },
        authorization_type_guards: {
          operationAuthorizationNumericAuthorizationNoteRejected: true,
          operationAuthorizationNumericAuthorizedAtRejected: true,
          recoveryAuthorizationNumericAuthorizationNoteRejected: true,
          recoveryAuthorizationNumericAuthorizedAtRejected: true,
        },
        determinism: {
          completeReceiptsIdentical: true,
          compensationReceiptSha256: input.compensationReceiptSha256,
          effectiveStateHashesIdentical: true,
          importReceiptSha256: input.importReceiptSha256,
          physicalStateHashesIdentical: true,
          savepointIsolatedSeededExecutionsCompared: 2,
          timelineAnchor: 'authorization.authorizedAt',
        },
        import_compensation: {
          compensationCommitted: true,
          effectiveStateRestored: true,
          exactPayloadCopy: true,
          fullTextUsed: true,
          idempotentReplay: true,
          importCommitted: true,
          isBlinded: false,
          readOnlyReconcile: true,
          revealTimestampsSynthesized: false,
        },
      },
      schemaVersion: 'gold-import-compensation-v2-verifier/1.0.0',
    },
  }
}

function bundleFileSha(operatorBundle: ProtectedV2OperatorBundle, path: string): string {
  const matches = operatorBundle.files.filter((entry) => entry.path === path)
  if (matches.length !== 1) throw new Error(`Fixture bundle omitted ${path}.`)
  return matches[0].sha256
}

function buildExecutionReceipt(input: {
  authorization: GoldImportContractV2BackupAuthorization
  completeCatalogAudit: ReturnType<typeof exactAudit>
  migrationSha256: string
}) {
  const run = (migrationPath: 'fresh' | 'upgrade', index: number) => {
    const containerId = `${migrationPath}-container-${index}`
    const containerName = `gold-import-v2-${migrationPath}-${index}`
    return {
      cleanup: {
        absenceChecks: [
          { identifier: containerId, kind: 'container_id', present: false },
          { identifier: containerName, kind: 'exact_name', present: false },
        ],
        absenceVerification: 'verified_absent',
        attempted: true,
        containerId,
        containerName,
        errors: [],
        outcome: 'removed_and_verified_absent',
        removalCommandSucceeded: true,
      },
      migrationPath,
      migrationSha256: input.migrationSha256,
      rawReceipt: {
        authorizationBindings: {
          authority: 'exact_committed_disposable_catalog_and_protected_runtime_bundle',
          completeCatalogAudit: input.completeCatalogAudit,
          expectedCatalog: input.authorization.disposableExpectedCatalog,
          operatorBundleBinding: input.authorization.protectedRuntimeBundle,
        },
        completedAt: `2026-08-10T13:0${index}:01.000Z`,
        databaseMutationOutsideDisposableTarget: false,
        disposableRuntime: {
          automaticallyAssignedPort: String(
            55_000 + index + (migrationPath === 'upgrade' ? 10 : 0),
          ),
          containerId,
          containerName,
          dockerContext: 'synthetic-test-context',
          dockerEndpoint: 'unix:///synthetic/docker.sock',
          host: '127.0.0.1',
          image:
            'public.ecr.aws/supabase/postgres:17.6.1.104@sha256:5deba92e50cd17bfacf8603834d317cdf3bfc1c016ec8293991997fa3b55fa3d',
        },
        heldOutIdentitiesAccessed: false,
        migrationLedger: { v1: 1, v2: 1 },
        migrationPath,
        realLocalDatabaseTouched: false,
        remoteDatabaseTouched: false,
        seedMode:
          migrationPath === 'fresh' ? 'migration_equivalent_post_v2_projection' : 'exact_pre_v1',
        startedAt: `2026-08-10T13:0${index}:00.000Z`,
      },
    }
  }
  return {
    authorizationBindings: {
      completeCatalogAudit: input.completeCatalogAudit,
      expectedCatalog: input.authorization.disposableExpectedCatalog,
      operatorBundleBinding: input.authorization.protectedRuntimeBundle,
    },
    bootstrapUpgradeRunIndex: 1,
    canonicalManifestExcludedVolatileReceipt: true,
    catalogDriftProbeCount: PROTECTED_V2_CATALOG_DRIFT_PROBE_IDS.length,
    fresh: [run('fresh', 1), run('fresh', 2)],
    localOwnerCatalogProjectionPassed: true,
    packageGenerationCount: 4,
    schemaVersion: 'gold-import-compensation-exact-package-rehearsal-execution/2.0.0',
    sourceReadCount: 4,
    upgrade: [run('upgrade', 1), run('upgrade', 2)],
  }
}

interface PackageRehearsalFixture {
  canonicalManifestSha256: string
  files: Map<string, Buffer>
  freshCanonicalName: string
  realCanonicalNames: readonly string[]
  upgradeCanonicalName: string
}

function buildPackageRehearsalFixture(input: {
  authorization: GoldImportContractV2BackupAuthorization
  operatorBundle: ProtectedV2OperatorBundle
  plan: ImportPlanV2
  realLocal: RealLocalFixture
  repository: { branch: string; head: string; originMain: string }
  sourceAuthorization: ReturnType<typeof buildGoldImportSourceAuthorizationSetV4>
  sourceBytes: Buffer
}): PackageRehearsalFixture {
  const completeCatalogAudit = exactAudit('supabase_admin_owner_v1')
  const localAudit = exactAudit('local_supabase_postgres_owner_v1')
  const readyAudit = exactReadyAudit(input.repository.head)
  const package_ = buildExactPackage({
    authorization: input.authorization,
    plan: input.plan,
    sourceAuthorization: input.sourceAuthorization,
    sourceBytes: input.sourceBytes,
  })
  const operationScenarios = buildOperationScenarios(input.plan)
  const preV2Snapshot = input.realLocal.preV2Snapshot
  const postV2Snapshot = {
    ...preV2Snapshot,
    physicalStateSha256V1: 'd'.repeat(64),
  }
  const migrationSha256 = bundleFileSha(
    input.operatorBundle,
    `supabase/migrations/${GOLD_IMPORT_COMPENSATION_MIGRATION_V2}.sql`,
  )
  const v1MigrationSha256 = bundleFileSha(
    input.operatorBundle,
    GOLD_IMPORT_CONTRACT_V1_MIGRATION_PATH,
  )
  const v1VerifierSha256 = bundleFileSha(
    input.operatorBundle,
    'supabase/verification/20260808035633_verify_literature_gold_import_compensation_contract.sql',
  )
  const importReceipt = operationScenarios.receiptsAndState.receipts.importApplied
  const compensationReceipt = operationScenarios.receiptsAndState.receipts.compensationApplied
  const authorizationBindings: V2CanonicalAuthorizationBindings = {
    completeCatalogAudit,
    expectedCatalog: input.authorization.disposableExpectedCatalog,
    operatorBundle: input.operatorBundle,
    operatorBundleBinding: input.authorization.protectedRuntimeBundle,
  }
  const productionCohort = {
    noteDispositionAuditSha256: NOTE_DISPOSITION_AUDIT_SHA256,
    rows: protectedV2ProductionCohortRowsFromImportPlan(input.plan),
  }
  const freshArtifacts = buildCanonicalV2RehearsalArtifacts({
    authorizationBindings,
    migrationPath: 'fresh',
    migrationSha256,
    operationScenarios,
    productionCohort,
    schemaOnlyUpgrade: null,
    verifierEvidence: verifierEvidence({
      compensationReceiptSha256: compensationReceipt.binding.contentSha256,
      importReceiptSha256: importReceipt.binding.contentSha256,
      migrationPath: 'fresh',
      postV2Snapshot,
      v1MigrationSha256,
      v1VerifierSha256,
    }),
  })
  const upgradeArtifacts = buildCanonicalV2RehearsalArtifacts({
    authorizationBindings,
    migrationPath: 'upgrade',
    migrationSha256,
    operationScenarios,
    productionCohort,
    schemaOnlyUpgrade: { after: postV2Snapshot, before: preV2Snapshot },
    verifierEvidence: verifierEvidence({
      compensationReceiptSha256: compensationReceipt.binding.contentSha256,
      importReceiptSha256: importReceipt.binding.contentSha256,
      migrationPath: 'upgrade',
      postV2Snapshot,
      v1MigrationSha256,
      v1VerifierSha256,
    }),
  })
  const freshBytes = freshArtifacts.get('v2-rehearsal-evidence.json')!
  const upgradeBytes = upgradeArtifacts.get('v2-rehearsal-evidence.json')!
  const driftMatrix = {
    exactReadyDisposable: completeCatalogAudit,
    localOwnerProjection: localAudit,
    probeCount: PROTECTED_V2_CATALOG_DRIFT_PROBE_IDS.length,
    probes: PROTECTED_V2_CATALOG_DRIFT_PROBE_IDS.map((id) => ({
      auditRejected: true,
      cleanupVerified: true,
      id,
    })),
    schemaVersion: GOLD_IMPORT_CONTRACT_V2_CATALOG_DRIFT_MATRIX_SCHEMA_VERSION,
  }
  const driftBytes = canonicalBytes(driftMatrix)
  const readyBytes = canonicalBytes(readyAudit)
  const packageManifest = package_.files.get('checksum-manifest-v2.sha256')!
  const report = {
    audit: {
      completeCatalogAuditIdentitySha256: completeCatalogAudit.fullAuditIdentitySha256,
      completeCatalogAuditModelIdentitySha256: completeCatalogAudit.auditModelIdentitySha256,
      environmentInvariantIdentitySha256:
        readyAudit.contractAudit.environmentInvariantIdentitySha256,
      environmentProfileIdentitySha256: readyAudit.contractAudit.environmentProfileIdentitySha256,
      sha256: sha256Bytes(readyBytes),
      source: 'first_v1_seeded_upgrade_disposable_context',
    },
    backup: {
      manifestSha256: GOLD_IMPORT_CONTRACT_V2_PRE_V1_BACKUP_MANIFEST_SHA256,
      v1StateAuthenticatedBeforeSourceRead: true,
    },
    catalogDriftMatrix: {
      localOwnerProjectionIdentitySha256: localAudit.fullAuditIdentitySha256,
      probeCount: PROTECTED_V2_CATALOG_DRIFT_PROBE_IDS.length,
      rejectedCount: PROTECTED_V2_CATALOG_DRIFT_PROBE_IDS.length,
      sha256: sha256Bytes(driftBytes),
    },
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    expectedCatalog: input.authorization.disposableExpectedCatalog,
    migration: { id: GOLD_IMPORT_COMPENSATION_MIGRATION_V2, sha256: migrationSha256 },
    package: {
      actionCounts: input.plan.counts,
      completeCatalogAuditIdentitySha256: completeCatalogAudit.fullAuditIdentitySha256,
      directory: 'exact-package-v2',
      expectedCatalogBindingSha256: input.authorization.disposableExpectedCatalog.bindingSha256,
      importPlanSha256: input.plan.binding.contentSha256,
      manifestSha256: sha256Bytes(packageManifest),
      sourceArtifactSha256: input.sourceAuthorization.finalArtifactSha256,
      sourceAuthorizationSetSha256: sha256Bytes(input.sourceBytes),
    },
    protectedRuntimeBundle: input.authorization.protectedRuntimeBundle,
    rehearsals: {
      bootstrap: {
        evidenceMatchesRepeatedUpgrade: true,
        migrationPath: 'upgrade',
        packageGeneratedInContext: true,
      },
      fresh: {
        canonicalEvidenceSha256: sha256Bytes(freshBytes),
        completeRuns: 2,
        deterministic: true,
        postV2ProjectedSeedMatchedUpgrade: true,
      },
      upgrade: {
        canonicalEvidenceSha256: sha256Bytes(upgradeBytes),
        completeRuns: 2,
        deterministic: true,
        preV1SeedLoadedAtHistoricalBoundary: true,
        schemaOnlyV1StateBracketed: true,
      },
    },
    repository: {
      branch: input.repository.branch,
      cleanTrackedAndUntrackedWorktree: true,
      headSha: input.repository.head,
      originMainIsAncestor: true,
    },
    safety: {
      allFourContainersRemovedAndVerifiedAbsent: true,
      callerDatabaseTargetAccepted: false,
      heldOutIdentitiesAccessed: false,
      realLocalDatabaseTouched: false,
      remoteDatabaseTouched: false,
      sourceReadOnlyAfterV2BootstrapProbe: true,
    },
    schemaVersion: 'gold-import-compensation-exact-package-rehearsal/2.0.0',
    status: 'passed',
  }
  const canonicalFiles = new Map<string, Buffer>([
    ['disposable-v2-catalog-drift-matrix.json', driftBytes],
    ['disposable-v2-complete-catalog-audit.json', canonicalBytes(completeCatalogAudit)],
    [
      'disposable-v2-exact-catalog-binding.json',
      canonicalBytes(input.authorization.disposableExpectedCatalog),
    ],
    ['disposable-v2-ready-audit.json', readyBytes],
    ['exact-package-rehearsal-report-v2.json', canonicalBytes(report)],
    ['fresh-v2-rehearsal-evidence.json', freshBytes],
    [
      'protected-v2-runtime-bundle-binding.json',
      canonicalBytes(input.authorization.protectedRuntimeBundle),
    ],
    ['upgrade-v2-rehearsal-evidence.json', upgradeBytes],
  ])
  const canonicalManifest = manifestBytes(canonicalFiles)
  const files = new Map<string, Buffer>()
  for (const [name, bytes] of package_.files) files.set(`exact-package-v2/${name}`, bytes)
  for (const [name, bytes] of canonicalFiles) files.set(name, bytes)
  files.set('canonical-manifest-v2.sha256', canonicalManifest)
  files.set(
    'execution-receipt-v2.json',
    canonicalBytes(
      buildExecutionReceipt({
        authorization: input.authorization,
        completeCatalogAudit,
        migrationSha256,
      }),
    ),
  )
  return {
    canonicalManifestSha256: sha256Bytes(canonicalManifest),
    files,
    freshCanonicalName: 'fresh-v2-rehearsal-evidence.json',
    realCanonicalNames: [...canonicalFiles.keys()],
    upgradeCanonicalName: 'upgrade-v2-rehearsal-evidence.json',
  }
}

function checks(ids: readonly string[]) {
  return ids.map((id) => ({ exitCode: 0, id, status: 'passed' }))
}

function buildPhase10Groups(input: {
  authorization: GoldImportContractV2BackupAuthorization
  packageCanonicalManifestSha256: string
  realLocal: RealLocalFixture
  repository: { branch: string; head: string; originMain: string }
}): Map<GoldImportContractV2Phase10EvidenceName, Map<string, Buffer>> {
  const context: GoldImportContractV2Phase10EvidenceContext = {
    authorization: {
      disposableExpectedCatalogBindingSha256:
        input.authorization.disposableExpectedCatalog.bindingSha256,
      localExpectedCatalogBindingSha256: input.authorization.localExpectedCatalog.bindingSha256,
      protectedRuntimeBundleBindingSha256: input.authorization.protectedRuntimeBundle.bindingSha256,
    },
    repository: input.repository,
  }
  const groups = new Map<GoldImportContractV2Phase10EvidenceName, Map<string, Buffer>>()
  const summaryDigest = (kind: GoldImportContractV2Phase10EvidenceName) =>
    sha256Bytes(groups.get(kind)!.get('evidence-summary.json')!)
  const build = (
    kind: GoldImportContractV2Phase10EvidenceName,
    files: Map<string, Buffer>,
    results: Record<string, unknown>,
  ) => {
    const summary = buildGoldImportContractV2Phase10EvidenceSummary({
      context,
      files,
      kind,
      results,
      sha256Bytes,
    })
    const completed = new Map(files)
    completed.set(
      'evidence-summary.json',
      Buffer.from(serializeGoldImportContractV2Phase10EvidenceSummary(summary), 'utf8'),
    )
    groups.set(kind, completed)
  }
  const report = (
    kind: GoldImportContractV2Phase10EvidenceName,
    name: string,
  ): Map<string, Buffer> =>
    new Map<string, Buffer>([
      [name, Buffer.from(`# ${kind}\n\nSynthetic regression result: passed.\n`, 'utf8')],
    ])

  let files: Map<string, Buffer> = report('tests-build-report', 'tests-build-report.md')
  build('tests-build-report', files, {
    checks: checks(GOLD_IMPORT_CONTRACT_V2_TESTS_BUILD_CHECK_IDS),
    reportSha256: sha256Bytes(files.get('tests-build-report.md')!),
    testCountChangesExplained: true,
  })

  files = report('critic-report', 'critic-report.md')
  build('critic-report', files, {
    confirmedFindingCount: 0,
    questionResults: Array.from({ length: 14 }, (_value, index) => ({
      id: index + 1,
      passed: true,
    })),
    reportSha256: sha256Bytes(files.get('critic-report.md')!),
    terminal: 'CRITIC PASS — NO CONFIRMED BLOCKER',
  })

  files = report('descendant-recovery-evidence', 'descendant-recovery-report.md')
  build('descendant-recovery-evidence', files, {
    currentHeadEqualsOriginMain: true,
    databaseV2Occurrence: 1,
    documentationOnlyDescendantReconciled: true,
    exactExpectedArtifactsPreserved: true,
    exactLocalCatalogPassed: true,
    expectedArtifactDriftRejected: true,
    fullProtectedBundlePreserved: true,
    historiesDivergent: false,
    intentCommitIsAncestor: true,
    migrationApplicationCallCount: 0,
    migrationReexecuted: false,
    migrationVerifierBytesPreserved: true,
    protectedSourceDriftRejected: true,
    reportSha256: sha256Bytes(files.get('descendant-recovery-report.md')!),
    schemaOnlyClinicalStateUnchanged: true,
    supabaseConfigDriftRejected: true,
    tsconfigDriftRejected: true,
  })

  files = report('same-user-recomputation-evidence', 'same-user-recomputation-report.md')
  build('same-user-recomputation-evidence', files, {
    captureManifestSha256s: input.realLocal.captureManifestSha256s,
    captureReceiptSha256s: input.realLocal.captureReceiptSha256s,
    honestRecomputationAccepted: true,
    maliciousSameUserOutOfScope: true,
    maliciousSameUserResistanceClaimed: false,
    namedRegressionPassed: true,
    reportSha256: sha256Bytes(files.get('same-user-recomputation-report.md')!),
    separateTrustRootClaimed: false,
  })

  files = report('sealed-intent-lost-ack-evidence', 'sealed-intent-lost-ack-report.md')
  const common = {
    authorization: context.authorization,
    repository: context.repository,
    scope: 'synthetic_regression',
    status: 'passed',
  }
  const intent = canonicalBytes({
    ...common,
    immutable: true,
    schemaVersion: 'gold-import-contract-v2-sealed-intent-regression/1.0.0',
    sealedBeforeStaging: true,
  })
  const result = canonicalBytes({
    ...common,
    compensationAuthorized: false,
    importAuthorized: false,
    intentSha256: sha256Bytes(intent),
    migrationApplicationCallCount: 0,
    migrationReexecuted: false,
    schemaVersion: 'gold-import-contract-v2-application-result-regression/1.0.0',
  })
  const receipt = canonicalBytes({
    ...common,
    applicationResultSha256: sha256Bytes(result),
    compensationAuthorized: false,
    importAuthorized: false,
    intentSha256: sha256Bytes(intent),
    lostAcknowledgementReconciledWithoutReplay: true,
    migrationApplicationCallCount: 0,
    migrationReexecuted: false,
    receiptResultCrossBound: true,
    schemaVersion: 'gold-import-contract-v2-final-receipt-regression/1.0.0',
  })
  files.set('sealed-intent-regression.json', intent)
  files.set('application-result-regression.json', result)
  files.set('final-receipt-regression.json', receipt)
  build('sealed-intent-lost-ack-evidence', files, {
    applicationResultSha256: sha256Bytes(result),
    backupCaptureCount: 2,
    backupInstanceIds: input.realLocal.backupInstanceIds,
    compensationAuthorized: false,
    finalReceiptSha256: sha256Bytes(receipt),
    importAuthorized: false,
    intentImmutable: true,
    intentSealedBeforeStaging: true,
    intentSha256: sha256Bytes(intent),
    lostAcknowledgementReconciledWithoutReplay: true,
    migrationApplicationCallCount: 0,
    migrationReexecuted: false,
    receiptResultCrossBound: true,
    reportSha256: sha256Bytes(files.get('sealed-intent-lost-ack-report.md')!),
  })

  files = report('trusted-operator-evidence', 'trusted-operator-report.md')
  build('trusted-operator-evidence', files, {
    attestation: GOLD_IMPORT_CONTRACT_V2_CAPTURE_ATTESTATION,
    backupInstanceIds: input.realLocal.backupInstanceIds,
    captureManifestSha256s: input.realLocal.captureManifestSha256s,
    captureReceiptSha256s: input.realLocal.captureReceiptSha256s,
    executionNonces: input.realLocal.executionNonces,
    outputDirectories: input.realLocal.outputDirectories,
    reportSha256: sha256Bytes(files.get('trusted-operator-report.md')!),
    sameTrustedOperator: true,
    separateTrustRoots: false,
    trustModel: GOLD_IMPORT_CONTRACT_V2_TRUST_MODEL,
  })

  files = report('full-validation-report', 'full-validation-report.md')
  build('full-validation-report', files, {
    checks: checks(GOLD_IMPORT_CONTRACT_V2_FULL_VALIDATION_CHECK_IDS),
    reportSha256: sha256Bytes(files.get('full-validation-report.md')!),
    testCountChangesExplained: true,
    testsBuildSummarySha256: summaryDigest('tests-build-report'),
  })

  files = report('merge-readiness-report', 'merge-readiness-report.md')
  build('merge-readiness-report', files, {
    branchClean: true,
    compensationAuthorized: false,
    criticSummarySha256: summaryDigest('critic-report'),
    deliveryPending: true,
    draft: true,
    fullValidationSummarySha256: summaryDigest('full-validation-report'),
    implementationReady: true,
    independentReviewRequired: true,
    importAuthorized: false,
    localV2MigrationApplied: false,
    mergeAuthorized: false,
    originMainAncestor: true,
    packageCanonicalManifestSha256: input.packageCanonicalManifestSha256,
    realLocalCaptureManifestSha256s: input.realLocal.captureManifestSha256s,
    realLocalMigrationSeparatelyRequired: true,
    reportSha256: sha256Bytes(files.get('merge-readiness-report.md')!),
    testsBuildSummarySha256: summaryDigest('tests-build-report'),
    unmerged: true,
  })

  const body = `# Prepared PR body

- PR state: \`open\`
- Draft: \`true\`
- Merged: \`false\`
- Base: \`main\`
- Final HEAD: \`${input.repository.head}\`
- Branch: \`${input.repository.branch}\`
- Expected post-push remote HEAD: \`${input.repository.head}\`
- Remote HEAD verification deferred until post-backup push: \`true\`
- Local expected-catalog binding SHA-256: \`${input.authorization.localExpectedCatalog.bindingSha256}\`
- Disposable expected-catalog binding SHA-256: \`${input.authorization.disposableExpectedCatalog.bindingSha256}\`
- Protected runtime bundle binding SHA-256: \`${input.authorization.protectedRuntimeBundle.bindingSha256}\`
- Critic summary SHA-256: \`${summaryDigest('critic-report')}\`
- Full validation summary SHA-256: \`${summaryDigest('full-validation-report')}\`
- Tests/build summary SHA-256: \`${summaryDigest('tests-build-report')}\`
- Merge-readiness summary SHA-256: \`${summaryDigest('merge-readiness-report')}\`
- Package canonical manifest SHA-256: \`${input.packageCanonicalManifestSha256}\`
- Real-local capture manifest SHA-256s: \`${input.realLocal.captureManifestSha256s.join(',')}\`
- Real-local capture receipt SHA-256s: \`${input.realLocal.captureReceiptSha256s.join(',')}\`
- V2 applied real-locally: \`false\`
- Real import executed: \`false\`
- Real compensation executed: \`false\`
`
  files = new Map([['final-pr-body.md', Buffer.from(body, 'utf8')]])
  build('final-pr-body', files, {
    bodySha256: sha256Bytes(files.get('final-pr-body.md')!),
    compensationAuthorized: false,
    criticSummarySha256: summaryDigest('critic-report'),
    fullValidationSummarySha256: summaryDigest('full-validation-report'),
    mergeAuthorized: false,
    mergeReadinessSummarySha256: summaryDigest('merge-readiness-report'),
    packageCanonicalManifestSha256: input.packageCanonicalManifestSha256,
    packageExecutionAuthorized: false,
    prFacts: {
      base: 'main',
      draft: true,
      expectedRemoteHeadSha: input.repository.head,
      headBranch: input.repository.branch,
      open: true,
      remoteHeadVerificationDeferred: true,
      unmerged: true,
    },
    realLocalCaptureManifestSha256s: input.realLocal.captureManifestSha256s,
    realLocalCaptureReceiptSha256s: input.realLocal.captureReceiptSha256s,
    terminalState: 'implementation_ready_real_local_v2_migration_separately_required',
    testsBuildSummarySha256: summaryDigest('tests-build-report'),
  })

  if (groups.size !== GOLD_IMPORT_CONTRACT_V2_PHASE10_EVIDENCE_NAMES.length) {
    throw new Error('Phase-10 fixture did not build every exact structured group.')
  }
  return groups
}

export interface ForwardBackupSemanticFixture {
  authorization: GoldImportContractV2BackupAuthorization
  documents: Map<RequiredEvidenceName, readonly unknown[]>
  fileNames: Map<RequiredEvidenceName, readonly string[]>
  files: Map<RequiredEvidenceName, ReadonlyMap<string, Buffer>>
  operatorBundle: ProtectedV2OperatorBundle
  repository: { branch: string; head: string; originMain: string }
}

export async function buildForwardBackupSemanticFixture(): Promise<ForwardBackupSemanticFixture> {
  const repository = {
    branch: 'codex/ip-literature-import-contract-v2-forward-repair-v1',
    head: 'a'.repeat(40),
    originMain: 'b'.repeat(40),
  }
  const operatorBundle = await buildProtectedV2OperatorBundle({ cwd: process.cwd() })
  const authorization: GoldImportContractV2BackupAuthorization = {
    disposableExpectedCatalog: buildProtectedV2ExpectedCatalogBinding(
      'supabase_admin_owner_v1',
      'disposable',
    ),
    localExpectedCatalog: buildProtectedV2ExpectedCatalogBinding(
      'local_supabase_postgres_owner_v1',
      'local',
    ),
    protectedRuntimeBundle: buildProtectedV2RuntimeBundleBinding(operatorBundle),
  }
  const realLocal = buildRealLocalFixture({ authorization, operatorBundle, repository })
  const { plan, sourceAuthorization, sourceBytes } = buildSourceAuthorizationAndPlan(
    repository.head,
  )
  const packageRehearsal = buildPackageRehearsalFixture({
    authorization,
    operatorBundle,
    plan,
    realLocal,
    repository,
    sourceAuthorization,
    sourceBytes,
  })
  const phase10 = buildPhase10Groups({
    authorization,
    packageCanonicalManifestSha256: packageRehearsal.canonicalManifestSha256,
    realLocal,
    repository,
  })
  const files = new Map<RequiredEvidenceName, ReadonlyMap<string, Buffer>>()
  const localArtifact = committedProtectedV2CatalogExpectedArtifactForValidatedProfile(
    'local_supabase_postgres_owner_v1',
    'local',
  )
  const disposableArtifact = committedProtectedV2CatalogExpectedArtifactForValidatedProfile(
    'supabase_admin_owner_v1',
    'disposable',
  )
  files.set(
    'catalog-expectations-and-ready-inventories',
    new Map([
      ['local-expected-catalog.json', canonicalBytes(localArtifact)],
      ['disposable-expected-catalog.json', canonicalBytes(disposableArtifact)],
      [
        'catalog-expectation-proposal-report.json',
        canonicalBytes({
          committedExpectationsExact: true,
          comparisons: {
            local_supabase_postgres_owner_v1: { passed: true },
            supabase_admin_owner_v1: { passed: true },
          },
          generator: {
            acceptedCallerDatabaseTarget: false,
            acceptedCallerDockerEndpoint: false,
            acceptedCallerSql: false,
            acceptedHeldOutInput: false,
            freshDisposableRunCount: 4,
            overwriteModeAvailable: false,
            profileRunCounts: {
              local_supabase_postgres_owner_v1: 2,
              supabase_admin_owner_v1: 2,
            },
            remoteAccess: false,
          },
          schemaVersion: 'literature-gold-protected-v2-catalog-expectation-proposal/1.0.0',
        }),
      ],
    ]),
  )
  files.set(
    'catalog-drift-matrix',
    new Map([
      [
        'catalog-drift-matrix.json',
        canonicalBytes({
          exactReadyDisposable: exactAudit('supabase_admin_owner_v1'),
          localOwnerProjection: exactAudit('local_supabase_postgres_owner_v1'),
          probeCount: PROTECTED_V2_CATALOG_DRIFT_PROBE_IDS.length,
          probes: PROTECTED_V2_CATALOG_DRIFT_PROBE_IDS.map((id) => ({
            auditRejected: true,
            cleanupVerified: true,
            id,
          })),
          schemaVersion: GOLD_IMPORT_CONTRACT_V2_CATALOG_DRIFT_MATRIX_SCHEMA_VERSION,
        }),
      ],
    ]),
  )
  files.set(
    'module-resolution-evidence',
    new Map([
      ['module-resolution-audit.json', canonicalBytes(operatorBundle.moduleResolutionAudit)],
    ]),
  )
  files.set(
    'protected-bundle-inventory',
    new Map([['protected-operator-bundle.json', canonicalBytes(operatorBundle)]]),
  )
  files.set(
    'runtime-input-evidence',
    new Map([['runtime-input-audit.json', canonicalBytes(operatorBundle.runtimeInputAudit)]]),
  )
  files.set('package-rehearsal-evidence', packageRehearsal.files)
  files.set('real-local-read-only-report', realLocal.files)
  for (const [kind, groupFiles] of phase10) files.set(kind, groupFiles)
  const documents = new Map<RequiredEvidenceName, readonly unknown[]>()
  const fileNames = new Map<RequiredEvidenceName, readonly string[]>()
  for (const [name, groupFiles] of files) {
    documents.set(name, parseJsonFiles(groupFiles))
    fileNames.set(name, [...groupFiles.keys()])
  }
  return { authorization, documents, fileNames, files, operatorBundle, repository }
}
