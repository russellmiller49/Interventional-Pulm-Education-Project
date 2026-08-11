import { createHash } from 'node:crypto'

import { z } from 'zod'

import {
  canonicalJson,
  sha256Canonical,
} from '../../src/features/literature/gold-set/import-compensation'
import {
  bindCompensationAuthorizationV2,
  bindCompensationPlanV2,
  bindImportAuthorizationV2,
  bindImportPlanV2,
  bindRecoveryAuthorizationV2,
  parseCompensationReceiptV2,
  parseImportReceiptV2,
  type ImportActionV2,
  type ImportPlanV2,
} from '../../src/features/literature/gold-set/import-compensation-v2'
import {
  deriveExpectedPostImportEffectiveStateSha256V2,
  derivePackagePlanningRowsV2,
  deterministicPackageUuidV2,
  developmentPlanningStateV2Schema,
  generateGoldImportCompensationPackageV2,
  verifyGeneratedGoldImportCompensationPackageV2,
  type GenerateGoldImportCompensationPackageV2Sources,
  type GeneratedGoldImportCompensationPackageV2,
} from './generate-gold-import-compensation-package-v2'
import {
  GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2,
  validateGoldImportNoteDispositionGateV2,
} from './gold-import-note-disposition-gate-v2'
import {
  buildInternalDisposableMigrationReceiptGate,
  requireIssuedGoldImportCompensationV2MigrationReceiptGateForBinding,
  type GoldImportCompensationV2MigrationReceiptGate,
} from './gold-import-compensation-v2-migration-receipt-gate'
import {
  GOLD_IMPORT_EXISTING_HEAD_COHORT_SHA256_V4,
  GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256_V4,
  validateGoldImportSourceAuthorizationSetV4ForImport,
} from './gold-import-source-authorization-v4'
import { parseFinalizedGoldImportArtifact } from './gold-import-compensation-compatibility'
import {
  buildContractInvariantIdentity,
  buildDeploymentProfileIdentity,
  type EnrichedRpcMetadata,
} from './gold-import-compensation-contract-reconciliation'
import {
  buildContractDiagnosticsSql,
  parseContractDiagnosticsOutput,
} from './gold-import-compensation-contract-diagnostics'
import { buildSchemaSecurityDefinitionIdentity } from './gold-import-compensation-rehearsal-evidence'
import {
  collectProtectedV2CompleteCatalogAudit,
  enrichedV2TransitionMetadata,
  type ProtectedV2CompleteCatalogAuditIdentity,
  v2SecurityIntrospectionSql,
} from './gold-import-contract-v2-catalog-audit'
import { buildProtectedV2ExpectedCatalogBinding } from './protected-gold-import-contract-v2-bindings'
export { renderOwnerFirstFunctionRawAclV2 } from './gold-import-contract-v2-catalog-audit'
import {
  GOLD_IMPORT_V2_READY_STATE_IDENTITIES,
  validateReadyGoldImportCompensationV2Audit,
  type GoldImportCompensationV2ReadyAudit,
} from './audit-gold-import-compensation-v2'
import type {
  V2DisposableDatabaseContext,
  V2ExactPackageDatabaseEvidence,
  V2ExactPackageDatabaseExecutor,
} from './rehearse-gold-import-compensation-db-v2'

const NOTE_OVERLAY_PMIDS = new Set(['36879724', '39281191'])
const SHA256_PATTERN = /^[a-f0-9]{64}$/u

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

function deepFreezeCanonicalValue<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreezeCanonicalValue(child)
    }
    Object.freeze(value)
  }
  return value
}

function canonicalDetachedClone<T>(value: T): T {
  return deepFreezeCanonicalValue(JSON.parse(canonicalJson(value)) as T)
}

function sqlLiteral(value: string): string {
  const tag = `$v2_exact_${sha256(value).slice(0, 16)}$`
  if (value.includes(tag)) throw new Error('Exact V2 SQL delimiter collision.')
  return `${tag}${value}${tag}`
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return value as Record<string, unknown>
}

const bootstrapStateSchema = z
  .object({
    currentPointersAreLatestHeads: z.literal(true),
    effectiveStateSha256: z.string().regex(SHA256_PATTERN),
    membershipSha256: z.string().regex(SHA256_PATTERN),
    physicalStateSha256: z.string().regex(SHA256_PATTERN),
    revisionChainsLinear: z.literal(true),
    testSplitLocked: z.literal(true),
    v1Occurrence: z.literal(1),
    v2Occurrence: z.literal(1),
  })
  .strict()

async function collectBootstrapState(context: V2DisposableDatabaseContext) {
  const batch = sqlLiteral(context.batchId)
  return bootstrapStateSchema.parse(
    await context.queryJson(`begin transaction isolation level repeatable read read only;
    set local statement_timeout = '120s';
    with ranked_reviews as (
      select review.item_id, review.id, review.revision, review.supersedes_review_id,
        row_number() over (partition by review.item_id order by review.revision, review.id) as ordinal,
        lag(review.id) over (partition by review.item_id order by review.revision, review.id) as prior_id
      from public.literature_gold_set_reviews review
      join public.literature_gold_set_items item on item.id = review.item_id
      where item.batch_id = ${batch}::uuid and item.dataset_split = 'development'
    ), latest_reviews as (
      select distinct on (review.item_id) review.item_id, review.id
      from public.literature_gold_set_reviews review
      join public.literature_gold_set_items item on item.id = review.item_id
      where item.batch_id = ${batch}::uuid and item.dataset_split = 'development'
      order by review.item_id, review.revision desc, review.id desc
    )
    select pg_catalog.jsonb_build_object(
      'currentPointersAreLatestHeads', not exists (
        select 1 from public.literature_gold_set_items item
        left join latest_reviews latest on latest.item_id = item.id
        where item.batch_id = ${batch}::uuid and item.dataset_split = 'development'
          and item.current_review_id is distinct from latest.id
      ),
      'effectiveStateSha256', public.literature_gold_effective_state_hash_v2(
        ${batch}::uuid, 'development'),
      'membershipSha256', public.literature_gold_development_membership_hash_v1(${batch}::uuid),
      'physicalStateSha256', public.literature_gold_physical_state_hash_v2(
        ${batch}::uuid, 'development'),
      'revisionChainsLinear', not exists (
        select 1 from ranked_reviews
        where revision <> ordinal or supersedes_review_id is distinct from prior_id
      ),
      'testSplitLocked', (select batch.test_unlocked_at is null
        and batch.test_unlocked_by_user_id is null
        and batch.test_unlocked_by_email is null
        and batch.test_unlock_reason is null
        from public.literature_gold_set_batches batch where batch.id = ${batch}::uuid),
      'v1Occurrence', (select count(*)::integer from supabase_migrations.schema_migrations
        where version = '20260808035633'
          and name = 'add_literature_gold_import_compensation_contract'),
      'v2Occurrence', (select count(*)::integer from supabase_migrations.schema_migrations
        where version = '20260809231651'
          and name = 'add_literature_gold_import_compensation_contract_v2')
    );
    rollback;`),
  )
}

function assertAcceptedUpgradeBoundary(context: V2DisposableDatabaseContext): void {
  if (context.migrationPath !== 'upgrade') return
  const upgrade = context.schemaOnlyUpgrade
  if (!upgrade) throw new Error('Upgrade bootstrap lacks its pre/post V2 schema-only bracket.')
  const before = record(upgrade.before, 'upgrade schema-only before snapshot')
  if (
    before.effectiveStateSha256V1 !==
      GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.effectiveStateSha256 ||
    before.physicalStateSha256V1 !== GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.physicalStateSha256 ||
    before.membershipSha256 !==
      GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentMembershipSha256 ||
    before.planningStateSha256 !==
      GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentPlanningStateSha256
  ) {
    throw new Error(
      'Upgrade bootstrap pre-V2 effective/physical/membership/planning identities are not the accepted V1 state.',
    )
  }
}

export interface V2ExactPackageBootstrapSources {
  developmentPlanningState: unknown
  repositoryCommitSha: string
  sources: GenerateGoldImportCompensationPackageV2Sources
}

function exactPackageFilesEqual(
  left: ReadonlyMap<string, Buffer>,
  right: ReadonlyMap<string, Buffer>,
): boolean {
  return (
    left.size === right.size &&
    [...left.entries()].every(([name, bytes]) => bytes.equals(right.get(name) ?? Buffer.alloc(0)))
  )
}

export function assertExactGeneratedPackageReferenceV2(
  reference: Pick<GeneratedGoldImportCompensationPackageV2, 'files' | 'manifestSha256'>,
  candidate: Pick<GeneratedGoldImportCompensationPackageV2, 'files' | 'manifestSha256'>,
): void {
  if (
    reference.manifestSha256 !== candidate.manifestSha256 ||
    !exactPackageFilesEqual(reference.files, candidate.files)
  ) {
    throw new Error('Repeated disposable paths produced different exact V2 packages.')
  }
}

export function assertMigrationEquivalentPostV2SeedIdentity(
  upgradedV1SeedAfterV2: unknown,
  candidatePostV2Seed: unknown,
): void {
  if (canonicalJson(upgradedV1SeedAfterV2) !== canonicalJson(candidatePostV2Seed)) {
    throw new Error(
      'Disposable post-V2 seed is not schema/clinical-state identical to the upgraded V1 seed after V2.',
    )
  }
}

async function buildDisposableReadyAuditAndPackage(input: {
  context: V2DisposableDatabaseContext
  migrationReceiptGate?: GoldImportCompensationV2MigrationReceiptGate
  sources: V2ExactPackageBootstrapSources
  state: z.infer<typeof bootstrapStateSchema>
}): Promise<{
  audit: GoldImportCompensationV2ReadyAudit
  completeCatalogAudit: ProtectedV2CompleteCatalogAuditIdentity
  migrationReceiptGate: GoldImportCompensationV2MigrationReceiptGate
  package: GeneratedGoldImportCompensationPackageV2
}> {
  const { context, sources, state } = input
  if (
    state.membershipSha256 !==
      GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentMembershipSha256 ||
    sha256Canonical(sources.developmentPlanningState) !==
      GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentPlanningStateSha256 ||
    sha256(Buffer.from(sources.sources.migrationBytes)) !== context.migrationSha256
  ) {
    throw new Error('Disposable bootstrap state, planning snapshot, or V2 migration bytes drifted.')
  }
  if (!/^[a-f0-9]{40}$/u.test(sources.repositoryCommitSha)) {
    throw new Error('Disposable bootstrap repository commit identity is malformed.')
  }

  const planningState = developmentPlanningStateV2Schema.parse(sources.developmentPlanningState)
  const artifact = parseFinalizedGoldImportArtifact(sources.sources.finalArtifactBytes, {
    expectedArtifactSha256: GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256_V4,
  })
  const planningByItem = new Map(planningState.rows.map((row) => [row.itemId, row]))
  const noteCurrentRows = artifact.rows
    .filter(({ identity }) => NOTE_OVERLAY_PMIDS.has(identity.pmid))
    .map(({ identity }) => {
      const row = planningByItem.get(identity.itemId)
      if (!row?.currentEffectiveReview || !row.currentReviewId || !row.currentRevision) {
        throw new Error(`Disposable bootstrap note PMID ${identity.pmid} lacks its exact head.`)
      }
      return {
        currentNote: row.currentEffectiveReview.notes,
        currentReviewId: row.currentReviewId,
        currentRevision: row.currentRevision,
        itemId: row.itemId,
        masterRowId: identity.masterRowId,
        pmid: row.pmid,
      }
    })
  if (noteCurrentRows.length !== NOTE_OVERLAY_PMIDS.size) {
    throw new Error('Disposable bootstrap did not bind both amended-note heads.')
  }
  const noteCurrentState = {
    currentEffectiveStateSha256: GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.effectiveStateSha256,
    currentPhysicalStateSha256: GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.physicalStateSha256,
    currentPointersAreLatestHeads: state.currentPointersAreLatestHeads,
    developmentPlanningStateSha256:
      GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentPlanningStateSha256,
    revisionChainsLinear: state.revisionChainsLinear,
    rows: noteCurrentRows,
  }
  const noteAudit = validateGoldImportNoteDispositionGateV2({
    audit: sources.sources.noteDispositionAudit,
    currentState: noteCurrentState,
    evidence: sources.sources,
  })
  const planningRows = derivePackagePlanningRowsV2({
    artifactRows: artifact.rows,
    noteAudit,
    planningState,
  })
  const expectedPostImportEffectiveStateSha256 =
    deriveExpectedPostImportEffectiveStateSha256V2(planningRows)

  const diagnosticsResult = await context.psql(
    `\\pset tuples_only on\n\\pset format unaligned\n${buildContractDiagnosticsSql()}`,
  )
  const diagnostics = parseContractDiagnosticsOutput(diagnosticsResult.stdout)
  const completeCatalogAudit = await collectProtectedV2CompleteCatalogAudit({
    context,
    profile: 'disposable_clone',
  })
  const securityIntrospection = await context.queryJson(
    `begin transaction isolation level repeatable read read only;\nset local statement_timeout = '120s';\n${v2SecurityIntrospectionSql()}\nrollback;`,
  )
  const schemaSecurityDefinitionIdentity =
    buildSchemaSecurityDefinitionIdentity(securityIntrospection)
  const rpcMetadata: EnrichedRpcMetadata[] = [
    ...diagnostics.functions,
    ...enrichedV2TransitionMetadata(schemaSecurityDefinitionIdentity),
  ]
  const deploymentProfileEvidence = {
    profileId: 'supabase_admin_owner_v1' as const,
    roleInventory: diagnostics.roles,
    target: 'disposable' as const,
  }
  const environmentInvariantIdentity = buildContractInvariantIdentity(
    schemaSecurityDefinitionIdentity,
    rpcMetadata,
  )
  const environmentProfileIdentity = buildDeploymentProfileIdentity(
    schemaSecurityDefinitionIdentity,
    rpcMetadata,
    deploymentProfileEvidence,
  )
  const transitionRpcs = rpcMetadata.filter(
    ({ name }) => name.endsWith('_v1') || name.endsWith('_v2'),
  )
  const ownerAclReady = transitionRpcs.every(
    ({ effectiveExecute, owner }) =>
      owner === 'supabase_admin' &&
      !effectiveExecute.PUBLIC &&
      !effectiveExecute.anon &&
      !effectiveExecute.authenticated &&
      effectiveExecute.service_role,
  )
  const safeSearchPathsReady = transitionRpcs.every(
    ({ searchPath }) =>
      searchPath.matchesExpected && searchPath.actual === 'pg_catalog, public, extensions',
  )
  const appendOnlyProtectionsReady = [
    'enforce_literature_gold_operation_contract_v2',
    'enforce_literature_gold_review_contract_v2',
  ].every((name) =>
    schemaSecurityDefinitionIdentity.records.some(
      ({ objectName, objectType }) => objectType === 'trigger' && objectName === name,
    ),
  )
  if (
    !ownerAclReady ||
    !safeSearchPathsReady ||
    !appendOnlyProtectionsReady ||
    transitionRpcs.length !== 6
  ) {
    throw new Error('Disposable V2 contract audit did not establish its exact security boundary.')
  }

  const audit = validateReadyGoldImportCompensationV2Audit({
    completeCatalogAudit,
    contractAudit: {
      appendOnlyProtectionsReady,
      deploymentProfileEvidence,
      environmentInvariantIdentity,
      environmentInvariantIdentitySha256: sha256Canonical(environmentInvariantIdentity),
      environmentProfileIdentity,
      environmentProfileIdentitySha256: sha256Canonical(environmentProfileIdentity),
      ownerAclReady,
      rpcBoundaryReady: true,
      rpcMetadata,
      safeSearchPathsReady,
      schemaSecurityDefinitionIdentity,
    },
    contractVersion: 'gold-review-import-compensation/2.0.0',
    database: {
      batchId: context.batchId,
      developmentMembershipSha256: state.membershipSha256,
      developmentPlanningStateSha256:
        GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.developmentPlanningStateSha256,
      effectiveStateSha256: GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2.effectiveStateSha256,
      physicalStateSha256: GOLD_IMPORT_V2_READY_STATE_IDENTITIES.physicalStateSha256,
    },
    exactExistingHeadCohort: {
      cohortSha256: GOLD_IMPORT_EXISTING_HEAD_COHORT_SHA256_V4,
      headCount: 9,
    },
    expectedPostImportEffectiveStateSha256,
    expectedCatalog: buildProtectedV2ExpectedCatalogBinding(
      'supabase_admin_owner_v1',
      'disposable',
    ),
    migration: {
      id: '20260809231651_add_literature_gold_import_compensation_contract_v2',
      sha256: context.migrationSha256,
      v1Occurrence: state.v1Occurrence,
      v2Occurrence: state.v2Occurrence,
    },
    repositoryCommitSha: sources.repositoryCommitSha,
    safety: {
      heldOutIdentitiesAccessed: false,
      readOnly: true,
      remoteAccess: false,
      remoteWritesAllowed: false,
      repeatableRead: true,
    },
    schemaVersion: 'gold-import-compensation-v2-package-audit/1.0.0',
    stateIntegrity: {
      currentPointersAreLatestHeads: state.currentPointersAreLatestHeads,
      revisionChainsLinear: state.revisionChainsLinear,
    },
    stateMutationEvidence: {
      effectiveStateChanged: false,
      itemRevealTimestampMutationCount: 0,
      pointerMutationCount: 0,
      reviewRowMutationCount: 0,
    },
    target: 'disposable_clone',
    testSplitLocked: state.testSplitLocked,
    v2PreImportState: {
      effectiveStateSha256: state.effectiveStateSha256,
      physicalStateSha256: state.physicalStateSha256,
    },
  })
  const migrationReceiptGate =
    input.migrationReceiptGate ?? buildInternalDisposableMigrationReceiptGate(audit)
  const generateInput = {
    audit,
    developmentPlanningState: sources.developmentPlanningState,
    migrationReceiptGate,
    sources: sources.sources,
  }
  const independentlyDerivedPackage = verifyGeneratedGoldImportCompensationPackageV2(
    generateGoldImportCompensationPackageV2(generateInput),
  )
  const package_ = verifyGeneratedGoldImportCompensationPackageV2(
    generateGoldImportCompensationPackageV2(generateInput),
  )
  assertExactGeneratedPackageReferenceV2(independentlyDerivedPackage, package_)
  const sourceAuthorizationSetBytes = package_.files.get('source-authorization-set-v4.json')
  if (!sourceAuthorizationSetBytes) {
    throw new Error('Generated V2 package omitted its canonical V4 source authorization set.')
  }
  validateGoldImportSourceAuthorizationSetV4ForImport({
    amendedAuthorization: sources.sources.amendedAuthorizationBytes,
    auditTarget: audit.target,
    completeCatalogAudit: audit.completeCatalogAudit,
    currentState: noteCurrentState,
    developmentPlanningState: sources.developmentPlanningState,
    environmentInvariantIdentitySha256: audit.contractAudit.environmentInvariantIdentitySha256,
    environmentProfileIdentitySha256: audit.contractAudit.environmentProfileIdentitySha256,
    expectedCatalog: audit.expectedCatalog,
    finalizedArtifact: sources.sources.finalArtifactBytes,
    independentlyDerivedPlan: independentlyDerivedPackage.importPlan,
    migration: sources.sources.migrationBytes,
    noteDispositionAudit: sources.sources.noteDispositionAudit,
    noteDispositionEvidence: sources.sources,
    plan: package_.importPlan,
    signedProtocolAuthorization: sources.sources.signedProtocolAuthorizationBytes,
    sourceAuthorizationSet: sourceAuthorizationSetBytes,
  })
  return { audit, completeCatalogAudit, migrationReceiptGate, package: package_ }
}

export interface BootstrappedExactPackageExecutorV2 {
  executor: V2ExactPackageDatabaseExecutor
  generatedPackageCount(): number
  referenceAudit(): GoldImportCompensationV2ReadyAudit
  referenceCompleteCatalogAudit(): ProtectedV2CompleteCatalogAuditIdentity
  referencePackage(): GeneratedGoldImportCompensationPackageV2
}

/**
 * The first upgraded disposable execution is the audit/package bootstrap. Every
 * later path re-collects the audit and regenerates the package from source,
 * requiring exact audit and package bytes before any import RPC is reached.
 */
export function createBootstrappedExactPackageDatabaseExecutorV2(input: {
  onGenerated?: (input: {
    audit: GoldImportCompensationV2ReadyAudit
    completeCatalogAudit: ProtectedV2CompleteCatalogAuditIdentity
    package: GeneratedGoldImportCompensationPackageV2
    path: V2DisposableDatabaseContext['migrationPath']
  }) => Promise<void> | void
  readSources: () => Promise<V2ExactPackageBootstrapSources>
}): BootstrappedExactPackageExecutorV2 {
  let referenceAudit: GoldImportCompensationV2ReadyAudit | undefined
  let referenceCompleteCatalogAudit: ProtectedV2CompleteCatalogAuditIdentity | undefined
  let referenceMigrationReceiptGate: GoldImportCompensationV2MigrationReceiptGate | undefined
  let referencePackage: GeneratedGoldImportCompensationPackageV2 | undefined
  let referencePostV2SeedIdentity: unknown
  let generatedPackageCount = 0
  return {
    executor: {
      async execute(context) {
        const state = await collectBootstrapState(context)
        if (!referencePackage && context.migrationPath !== 'upgrade') {
          throw new Error('The exact V2 package must bootstrap from the V1-seeded upgrade path.')
        }
        assertAcceptedUpgradeBoundary(context)
        const postV2SeedIdentity = canonicalDetachedClone({
          clinicalAndSchemaSnapshot: context.postV2SeedSnapshot,
          v2StateAndIntegrity: state,
        })
        if (referencePostV2SeedIdentity) {
          assertMigrationEquivalentPostV2SeedIdentity(
            referencePostV2SeedIdentity,
            postV2SeedIdentity,
          )
        }
        referencePostV2SeedIdentity ??= postV2SeedIdentity
        // This callback is intentionally after the V2 occurrence/state probe.
        const sources = await input.readSources()
        const generated = await buildDisposableReadyAuditAndPackage({
          context,
          migrationReceiptGate: referenceMigrationReceiptGate,
          sources,
          state,
        })
        const privateAudit = canonicalDetachedClone(generated.audit)
        const privateCompleteCatalogAudit = canonicalDetachedClone(generated.completeCatalogAudit)
        const privatePackage = verifyGeneratedGoldImportCompensationPackageV2(generated.package)
        if (referenceAudit && canonicalJson(referenceAudit) !== canonicalJson(privateAudit)) {
          throw new Error('Repeated disposable paths produced different V2 ready audits.')
        }
        if (
          referenceCompleteCatalogAudit &&
          canonicalJson(referenceCompleteCatalogAudit) !==
            canonicalJson(privateCompleteCatalogAudit)
        ) {
          throw new Error('Repeated disposable paths produced different complete catalog audits.')
        }
        if (referencePackage) {
          assertExactGeneratedPackageReferenceV2(referencePackage, privatePackage)
        }
        if (
          referenceMigrationReceiptGate &&
          canonicalJson(referenceMigrationReceiptGate) !==
            canonicalJson(generated.migrationReceiptGate)
        ) {
          throw new Error('Repeated disposable paths produced different migration receipt proofs.')
        }
        referenceAudit ??= privateAudit
        referenceCompleteCatalogAudit ??= privateCompleteCatalogAudit
        referenceMigrationReceiptGate ??= generated.migrationReceiptGate
        referencePackage ??= privatePackage
        generatedPackageCount += 1
        await input.onGenerated?.({
          audit: canonicalDetachedClone(privateAudit),
          completeCatalogAudit: canonicalDetachedClone(privateCompleteCatalogAudit),
          package: verifyGeneratedGoldImportCompensationPackageV2(privatePackage),
          path: context.migrationPath,
        })
        return createExactPackageDatabaseExecutorV2(privatePackage).execute({
          ...context,
          migrationReceiptGate: generated.migrationReceiptGate,
        })
      },
    },
    generatedPackageCount: () => generatedPackageCount,
    referenceAudit: () => {
      if (!referenceAudit) throw new Error('The V2 ready audit has not been bootstrapped.')
      return canonicalDetachedClone(referenceAudit)
    },
    referenceCompleteCatalogAudit: () => {
      if (!referenceCompleteCatalogAudit) {
        throw new Error('The V2 complete catalog audit has not been bootstrapped.')
      }
      return canonicalDetachedClone(referenceCompleteCatalogAudit)
    },
    referencePackage: () => {
      if (!referencePackage) throw new Error('The exact V2 package has not been bootstrapped.')
      return verifyGeneratedGoldImportCompensationPackageV2(referencePackage)
    },
  }
}

function importRpcCall(
  plan: ImportPlanV2,
  authorization: ReturnType<typeof bindImportAuthorizationV2>,
): string {
  return `public.apply_literature_gold_import_v2(${[
    `${sqlLiteral(plan.operationId)}::uuid`,
    `${sqlLiteral(plan.binding.idempotencyKey)}::text`,
    `${sqlLiteral(plan.batchId)}::uuid`,
    `${sqlLiteral(plan.sourceArtifactSha256)}::text`,
    `${sqlLiteral(plan.binding.contentSha256)}::text`,
    `${sqlLiteral(canonicalJson(plan))}::jsonb`,
    `${sqlLiteral(authorization.binding.contentSha256)}::text`,
    `${sqlLiteral(canonicalJson(authorization))}::jsonb`,
    'null::uuid',
    `${sqlLiteral('disposable-v2-rehearsal@example.invalid')}::text`,
  ].join(', ')})`
}

function compensationRpcCall(
  plan: ReturnType<typeof bindCompensationPlanV2>,
  authorization: ReturnType<typeof bindCompensationAuthorizationV2>,
): string {
  return `public.compensate_literature_gold_import_v2(${[
    `${sqlLiteral(plan.operationId)}::uuid`,
    `${sqlLiteral(plan.targetImportOperationId)}::uuid`,
    `${sqlLiteral(plan.binding.idempotencyKey)}::text`,
    `${sqlLiteral(plan.batchId)}::uuid`,
    `${sqlLiteral(plan.sourceArtifactSha256)}::text`,
    `${sqlLiteral(plan.binding.contentSha256)}::text`,
    `${sqlLiteral(canonicalJson(plan))}::jsonb`,
    `${sqlLiteral(authorization.binding.contentSha256)}::text`,
    `${sqlLiteral(canonicalJson(authorization))}::jsonb`,
    'null::uuid',
    `${sqlLiteral('disposable-v2-rehearsal@example.invalid')}::text`,
  ].join(', ')})`
}

function recoveryRpcCall(
  operationId: string,
  authorization: ReturnType<typeof bindRecoveryAuthorizationV2>,
): string {
  return `public.reconcile_literature_gold_review_operation_v2(
    ${sqlLiteral(operationId)}::uuid,
    ${sqlLiteral(authorization.binding.contentSha256)}::text,
    ${sqlLiteral(canonicalJson(authorization))}::jsonb
  )`
}

function bindDisposableImportAuthorization(plan: ImportPlanV2) {
  return bindImportAuthorizationV2({
    authorizedAt: '2030-01-01T00:00:00.000Z',
    authorizedBy: 'disposable-v2-rehearsal@example.invalid',
    authorizationId: deterministicPackageUuidV2(
      plan.operationId,
      'disposable-import-authorization',
    ),
    authorizationNote: 'Disposable fixed-image V2 import rehearsal authorization only.',
    authorized: true,
    batchId: plan.batchId,
    booleanNormalizationLedgerSha256: plan.booleanNormalizationLedgerSha256,
    contractVersion: plan.contractVersion,
    expectedEffectiveStateSha256: plan.expectedEffectiveStateSha256,
    expectedPhysicalStateSha256: plan.expectedPhysicalStateSha256,
    expectedPostEffectiveStateSha256: plan.expectedPostEffectiveStateSha256,
    idempotencyKey: plan.binding.idempotencyKey,
    kind: 'import_authorization',
    migrationId: plan.executionContext.migrationId,
    noteDispositionAuditSha256: plan.noteDispositionAuditSha256,
    operationId: plan.operationId,
    orderedSetNormalizationLedgerSha256: plan.orderedSetNormalizationLedgerSha256,
    planSha256: plan.binding.contentSha256,
    remoteWritesAllowed: false,
    repositoryCommitSha: plan.executionContext.repositoryCommitSha,
    sourceArtifactSha256: plan.sourceArtifactSha256,
    sourceAuthorizationSetSha256: plan.sourceAuthorizationSetSha256,
    targetDatabase: 'local',
  })
}

export function v2StateSql(batchId: string, receiptOperationId?: string): string {
  const batch = sqlLiteral(batchId)
  const receiptBarrier = receiptOperationId
    ? `\nwhere receipt.value ->> 'operationId' = ${sqlLiteral(receiptOperationId)}`
    : ''
  return `select pg_catalog.jsonb_build_object(
    'effective', public.literature_gold_effective_state_hash_v2(${batch}::uuid, 'development'),
    'physical', public.literature_gold_physical_state_hash_v2(${batch}::uuid, 'development'),
    'membership', public.literature_gold_development_membership_hash_v1(${batch}::uuid),
    'reviewCount', (select count(*)::integer
      from public.literature_gold_set_reviews review
      join public.literature_gold_set_items item on item.id = review.item_id
      where item.batch_id = ${batch}::uuid and item.dataset_split = 'development'),
    'clinicalEventCount', (select count(*)::integer
      from public.literature_gold_set_events event
      left join public.literature_gold_set_items item on item.id = event.item_id
      where event.batch_id = ${batch}::uuid
        and (event.item_id is null or item.dataset_split = 'development')
        and event.event_type not in (
          'import_started', 'import_failed', 'import_completed',
          'import_compensation_started', 'import_compensation_failed',
          'import_compensation_completed'
        )),
    'clinicalEventRowsSha256', public.literature_gold_jsonb_sha256_v1(coalesce((select jsonb_agg(
      to_jsonb(event) order by event.created_at, event.id)
      from public.literature_gold_set_events event
      left join public.literature_gold_set_items item on item.id = event.item_id
      where event.batch_id = ${batch}::uuid
        and (event.item_id is null or item.dataset_split = 'development')
        and event.event_type not in (
          'import_started', 'import_failed', 'import_completed',
          'import_compensation_started', 'import_compensation_failed',
          'import_compensation_completed'
        )), '[]'::jsonb)),
    'clinicalActionResultCount', (select count(*)::integer
      from public.literature_gold_review_operation_actions action
      join public.literature_gold_review_operations operation on operation.id = action.operation_id
      where operation.batch_id = ${batch}::uuid and action.result_review_id is not null),
    'pointerSha256', public.literature_gold_jsonb_sha256_v1(coalesce((select jsonb_agg(
      jsonb_build_object('itemId', item.id, 'currentReviewId', item.current_review_id)
      order by item.display_order, item.id)
      from public.literature_gold_set_items item
      where item.batch_id = ${batch}::uuid and item.dataset_split = 'development'), '[]'::jsonb)),
    'revealSha256', public.literature_gold_jsonb_sha256_v1(coalesce((select jsonb_agg(
      jsonb_build_object(
        'itemId', item.id,
        'automated', item.automated_signals_revealed_at,
        'supplemental', item.supplemental_metadata_revealed_at
      ) order by item.display_order, item.id)
      from public.literature_gold_set_items item
      where item.batch_id = ${batch}::uuid and item.dataset_split = 'development'), '[]'::jsonb)),
    'reviewRowsSha256', public.literature_gold_jsonb_sha256_v1(coalesce((select jsonb_agg(
      to_jsonb(review) order by item.display_order, review.revision, review.id)
      from public.literature_gold_set_reviews review
      join public.literature_gold_set_items item on item.id = review.item_id
      where item.batch_id = ${batch}::uuid and item.dataset_split = 'development'), '[]'::jsonb))
  )${receiptBarrier};`
}

const stateSchema = z
  .object({
    clinicalActionResultCount: z.number().int().nonnegative(),
    clinicalEventCount: z.number().int().nonnegative(),
    clinicalEventRowsSha256: z.string().regex(SHA256_PATTERN),
    effective: z.string().regex(SHA256_PATTERN),
    membership: z.string().regex(SHA256_PATTERN),
    physical: z.string().regex(SHA256_PATTERN),
    pointerSha256: z.string().regex(SHA256_PATTERN),
    revealSha256: z.string().regex(SHA256_PATTERN),
    reviewCount: z.number().int().nonnegative(),
    reviewRowsSha256: z.string().regex(SHA256_PATTERN),
  })
  .strict()

type V2State = z.infer<typeof stateSchema>

function observedStateHashes(state: V2State) {
  return {
    effectiveStateSha256: state.effective,
    physicalStateSha256: state.physical,
  }
}

function clinicalStateEqual(left: V2State, right: V2State): boolean {
  const withoutPhysical = ({ physical, ...state }: V2State) => {
    void physical
    return state
  }
  return canonicalJson(withoutPhysical(left)) === canonicalJson(withoutPhysical(right))
}

function cloneFaultPlan(
  plan: ImportPlanV2,
  label: string,
  faultAfterAction: number,
  expectedPhysicalStateSha256 = plan.expectedPhysicalStateSha256,
): ImportPlanV2 {
  const operationId = deterministicPackageUuidV2(plan.operationId, 'fault-probe', label)
  const actions = plan.actions.map((action) => {
    const actionId = deterministicPackageUuidV2(operationId, action.actionId, 'action')
    if (action.action === 'import_noop') return { ...action, actionId }
    const importedReviewId = deterministicPackageUuidV2(operationId, action.importedReviewId)
    return {
      ...action,
      actionId,
      expectedEffectiveReviewIdAfter: importedReviewId,
      expectedHeadReviewIdAfter: importedReviewId,
      importedReviewId,
    }
  }) as ImportActionV2[]
  const { binding, ...content } = plan
  void binding
  return bindImportPlanV2({
    ...content,
    actions,
    expectedPhysicalStateSha256,
    faultAfterAction,
    operationId,
  })
}

function parseTransactionJson(result: string): unknown {
  const candidates = result
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{') && line.endsWith('}'))
  if (candidates.length !== 1) {
    throw new Error('V2 fault transaction did not emit exactly one JSON evidence row.')
  }
  return JSON.parse(candidates[0] as string) as unknown
}

function faultEvidence(before: V2State, after: V2State, journalSealed: boolean) {
  if (!clinicalStateEqual(before, after)) {
    throw new Error('V2 fault probe left a partial clinical mutation.')
  }
  const evidence = {
    actionMutationCount:
      before.clinicalActionResultCount === after.clinicalActionResultCount ? 0 : 1,
    eventMutationCount:
      before.clinicalEventCount === after.clinicalEventCount &&
      before.clinicalEventRowsSha256 === after.clinicalEventRowsSha256
        ? 0
        : 1,
    failedJournalSealed: journalSealed,
    pointerMutationCount: before.pointerSha256 === after.pointerSha256 ? 0 : 1,
    revealTimestampMutationCount: before.revealSha256 === after.revealSha256 ? 0 : 1,
    reviewMutationCount:
      before.reviewCount === after.reviewCount && before.reviewRowsSha256 === after.reviewRowsSha256
        ? 0
        : 1,
  }
  if (
    evidence.actionMutationCount !== 0 ||
    evidence.eventMutationCount !== 0 ||
    evidence.pointerMutationCount !== 0 ||
    evidence.revealTimestampMutationCount !== 0 ||
    evidence.reviewMutationCount !== 0
  ) {
    throw new Error('V2 fault evidence measured a committed clinical mutation.')
  }
  return evidence
}

async function runControlledFaultProbe(
  context: V2DisposableDatabaseContext,
  basePlan: ImportPlanV2,
  label: string,
  faultAfterAction: number,
) {
  const before = stateSchema.parse(await context.queryJson(v2StateSql(basePlan.batchId)))
  const plan = cloneFaultPlan(basePlan, label, faultAfterAction)
  const authorization = bindDisposableImportAuthorization(plan)
  const call = importRpcCall(plan, authorization)
  const result = await context.psql(controlledFaultTransactionSql(call, plan))
  const parsed = z
    .object({
      journalSealed: z.literal(true),
      receipt: z.unknown(),
      state: stateSchema,
    })
    .strict()
    .parse(parseTransactionJson(result.stdout))
  const receipt = parseImportReceiptV2(parsed.receipt)
  if (receipt.outcome !== 'failed') throw new Error('Controlled V2 fault did not seal failure.')
  return faultEvidence(before, parsed.state, parsed.journalSealed)
}

export function controlledFaultTransactionSql(
  call: string,
  plan: Pick<ImportPlanV2, 'batchId' | 'operationId'>,
): string {
  return `begin;
set local role service_role;
create temporary table v2_controlled_fault_receipt (
  value jsonb not null
) on commit drop;
insert into pg_temp.v2_controlled_fault_receipt (value)
select ${call};
select pg_catalog.jsonb_build_object(
  'receipt', receipt.value,
  'journalSealed', exists (
    select 1 from public.literature_gold_review_operations operation
    where operation.id = ${sqlLiteral(plan.operationId)}::uuid
      and operation.id = (receipt.value ->> 'operationId')::uuid
      and operation.status = 'failed'
      and operation.error_sqlstate = 'P7799'
      and operation.post_physical_state_sha256 is not null
      and operation.post_effective_state_sha256 is not null
  ),
  'state', (${v2StateSql(plan.batchId, plan.operationId).replace(/;$/u, '')})
)
from pg_temp.v2_controlled_fault_receipt receipt;
rollback;`
}

async function runBeforeActionFaultProbe(
  context: V2DisposableDatabaseContext,
  basePlan: ImportPlanV2,
) {
  const before = stateSchema.parse(await context.queryJson(v2StateSql(basePlan.batchId)))
  const plan = cloneFaultPlan(basePlan, 'before-action-1', 1, '0'.repeat(64))
  const authorization = bindDisposableImportAuthorization(plan)
  const call = importRpcCall(plan, authorization)
  const result = await context.psql(`begin;
set local role service_role;
do $before_action_fault$
declare rejected boolean := false;
begin
  begin
    perform ${call};
  exception when sqlstate 'P7725' then
    rejected := true;
  end;
  if not rejected then
    raise exception 'expected pre-action V2 state rejection';
  end if;
end;
$before_action_fault$;
select pg_catalog.jsonb_build_object(
  'journalSealed', exists (
    select 1 from public.literature_gold_review_operations operation
    where operation.id = ${sqlLiteral(plan.operationId)}::uuid
  ),
  'state', (${v2StateSql(basePlan.batchId).replace(/;$/u, '')})
);
rollback;`)
  const parsed = z
    .object({ journalSealed: z.literal(false), state: stateSchema })
    .strict()
    .parse(parseTransactionJson(result.stdout))
  return faultEvidence(before, parsed.state, parsed.journalSealed)
}

const databaseCohortRowSchema = z
  .object({
    automatedSignalsRevealedAt: z.string().nullable(),
    categorizationFromFullText: z.boolean(),
    clinicalPurposeCount: z.number().int().nonnegative(),
    diseaseStatus: z.string().nullable(),
    diseaseTagCount: z.number().int().nonnegative(),
    fullTextUsed: z.boolean(),
    isBlinded: z.boolean(),
    itemId: z.string().uuid(),
    noteSha256: z.string().regex(SHA256_PATTERN),
    operationContractVersion: z.string().nullable(),
    publicationStatus: z.string().nullable(),
    reviewId: z.string().uuid(),
    studyDesign: z.string().nullable(),
    supplementalMetadataRevealedAt: z.string().nullable(),
    technologyStatus: z.string().nullable(),
    technologyTagCount: z.number().int().nonnegative(),
    topicCount: z.number().int().nonnegative(),
    usedSupplementalMetadata: z.boolean(),
  })
  .strict()

async function buildProductionCohortEvidence(
  context: V2DisposableDatabaseContext,
  plan: ImportPlanV2,
) {
  const expected = plan.actions.map((action) => ({
    itemId: action.itemId,
    reviewId:
      action.action === 'import_noop' ? action.expectedEffectiveReviewId : action.importedReviewId,
    sequence: action.sequence,
  }))
  if (expected.some(({ reviewId }) => reviewId === null)) {
    throw new Error('A production V2 no-op lacks an effective V2 review to authenticate.')
  }
  const rows = z
    .array(databaseCohortRowSchema)
    .length(plan.actions.length)
    .parse(
      await context.queryJson(`with expected as (
        select * from pg_catalog.jsonb_to_recordset(${sqlLiteral(canonicalJson(expected))}::jsonb)
          as supplied("itemId" uuid, "reviewId" uuid, sequence integer)
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'automatedSignalsRevealedAt', item.automated_signals_revealed_at,
        'categorizationFromFullText', review.categorization_from_full_text,
        'clinicalPurposeCount', cardinality(review.clinical_purposes),
        'diseaseStatus', review.disease_tag_status,
        'diseaseTagCount', cardinality(review.disease_tags),
        'fullTextUsed', review.full_text_used,
        'isBlinded', review.is_blinded,
        'itemId', review.item_id,
        'noteSha256', encode(extensions.digest(convert_to(review.notes, 'UTF8'), 'sha256'), 'hex'),
        'operationContractVersion', review.operation_contract_version,
        'publicationStatus', review.publication_status,
        'reviewId', review.id,
        'studyDesign', review.study_design,
        'supplementalMetadataRevealedAt', item.supplemental_metadata_revealed_at,
        'technologyStatus', review.technology_tag_status,
        'technologyTagCount', cardinality(review.technology_tags),
        'topicCount', cardinality(review.topic_ids),
        'usedSupplementalMetadata', review.used_supplemental_metadata
      ) order by expected.sequence), '[]'::jsonb)
      from expected
      join public.literature_gold_set_reviews review on review.id = expected."reviewId"
        and review.item_id = expected."itemId"
      join public.literature_gold_set_items item on item.id = review.item_id;`),
    )
  return {
    noteDispositionAuditSha256: plan.noteDispositionAuditSha256,
    rows: plan.actions.map((action, index) => {
      const row = rows[index]
      if (!row || row.itemId !== action.itemId) {
        throw new Error(`V2 production database row ${index + 1} is missing or reordered.`)
      }
      const review = action.action === 'import_noop' ? action.candidateReview : action.review
      if (row.operationContractVersion !== plan.contractVersion) {
        throw new Error('Production review did not persist the explicit V2 contract version.')
      }
      return {
        action: action.action,
        actionIdentitySha256: sha256(action.actionId),
        automatedSignalsRevealedAtAfter: row.automatedSignalsRevealedAt,
        automatedSignalsRevealedAtBefore: action.preImportItemState.automatedSignalsRevealedAt,
        categorizationFromFullText: row.categorizationFromFullText,
        clinicalPurposeCount: row.clinicalPurposeCount,
        diseaseStatus: row.diseaseStatus,
        diseaseTagCount: row.diseaseTagCount,
        fullTextUsed: row.fullTextUsed,
        importedReviewPersisted: action.action !== 'import_noop',
        isBlinded: row.isBlinded,
        noteDisposition: NOTE_OVERLAY_PMIDS.has(action.pmid)
          ? ('amended_authorized_rationale' as const)
          : ('finalized_v3' as const),
        noteSha256: row.noteSha256,
        publicationStatus: row.publicationStatus,
        relevanceLabel: review.relevanceLabel,
        requiredNoteSha256: sha256(review.notes),
        studyDesign: row.studyDesign,
        supplementalMetadataRevealedAtAfter: row.supplementalMetadataRevealedAt,
        supplementalMetadataRevealedAtBefore:
          action.preImportItemState.supplementalMetadataRevealedAt,
        technologyStatus: row.technologyStatus,
        technologyTagCount: row.technologyTagCount,
        topicCount: row.topicCount,
        usedSupplementalMetadataAfter: row.usedSupplementalMetadata,
        usedSupplementalMetadataBefore:
          action.action === 'import_initial'
            ? null
            : action.preImportItemState.supplementalMetadataRevealedAt !== null,
      }
    }),
  }
}

function bindDisposableCompensation(
  package_: GeneratedGoldImportCompensationPackageV2,
  importReceipt: ReturnType<typeof parseImportReceiptV2>,
) {
  const template = package_.compensationTemplate
  const importPlan = package_.importPlan
  const plan = bindCompensationPlanV2({
    actions: template.actions,
    batchId: template.batchId,
    booleanNormalizationLedgerSha256: template.evidence.booleanNormalizationLedgerSha256,
    contractVersion: template.contractVersion,
    counts: template.counts,
    executionContext: importPlan.executionContext,
    expectedEffectiveStateSha256: importReceipt.afterEffectiveStateSha256,
    expectedPhysicalStateSha256: importReceipt.afterPhysicalStateSha256,
    expectedPostEffectiveStateSha256: template.expectedPostEffectiveStateSha256,
    importPlanSha256: template.importPlanSha256,
    importReceiptSha256: importReceipt.binding.contentSha256,
    kind: 'compensation',
    noteDispositionAuditSha256: template.evidence.noteDispositionAuditSha256,
    operationId: template.operationId,
    orderedSetNormalizationLedgerSha256: template.evidence.orderedSetNormalizationLedgerSha256,
    scope: importPlan.scope,
    sourceArtifactSha256: importPlan.sourceArtifactSha256,
    sourceAuthorizationSetSha256: template.evidence.sourceAuthorizationSetSha256,
    targetImportOperationId: template.targetImportOperationId,
  })
  const authorization = bindCompensationAuthorizationV2({
    authorizedAt: '2030-01-01T00:00:02.000Z',
    authorizedBy: 'disposable-v2-rehearsal@example.invalid',
    authorizationId: deterministicPackageUuidV2(
      plan.operationId,
      'disposable-compensation-authorization',
    ),
    authorizationNote: 'Disposable fixed-image V2 compensation rehearsal authorization only.',
    authorized: true,
    batchId: plan.batchId,
    booleanNormalizationLedgerSha256: plan.booleanNormalizationLedgerSha256,
    contractVersion: plan.contractVersion,
    expectedEffectiveStateSha256: plan.expectedEffectiveStateSha256,
    expectedPhysicalStateSha256: plan.expectedPhysicalStateSha256,
    expectedPostEffectiveStateSha256: plan.expectedPostEffectiveStateSha256,
    idempotencyKey: plan.binding.idempotencyKey,
    importReceiptSha256: plan.importReceiptSha256,
    kind: 'compensation_authorization',
    migrationId: plan.executionContext.migrationId,
    noteDispositionAuditSha256: plan.noteDispositionAuditSha256,
    operationId: plan.operationId,
    orderedSetNormalizationLedgerSha256: plan.orderedSetNormalizationLedgerSha256,
    planSha256: plan.binding.contentSha256,
    remoteWritesAllowed: false,
    repositoryCommitSha: plan.executionContext.repositoryCommitSha,
    sourceArtifactSha256: plan.sourceArtifactSha256,
    sourceAuthorizationSetSha256: plan.sourceAuthorizationSetSha256,
    targetDatabase: 'local',
    targetImportOperationId: plan.targetImportOperationId,
  })
  return { authorization, plan }
}

async function verifyCompensationPayloadCopies(
  context: V2DisposableDatabaseContext,
  package_: GeneratedGoldImportCompensationPackageV2,
) {
  const actions = package_.compensationTemplate.actions
  const expected = actions.map((action) => ({
    compensationReviewId: action.compensationReviewId,
    effectiveSourceReviewId: action.effectiveSourceReviewId,
    importedReviewId: action.importedReviewId,
    kind: action.action,
    sequence: action.sequence,
  }))
  return z
    .object({ exactPayloadCopy: z.literal(true), mappingCount: z.literal(actions.length) })
    .strict()
    .parse(
      await context.queryJson(`with expected as (
        select * from pg_catalog.jsonb_to_recordset(${sqlLiteral(canonicalJson(expected))}::jsonb)
          as supplied(
            "compensationReviewId" uuid,
            "effectiveSourceReviewId" uuid,
            "importedReviewId" uuid,
            kind text,
            sequence integer
          )
      ), compared as (
        select expected.*,
          case when expected.kind = 'compensate_noop' then true
          else (
            public.literature_gold_review_clinical_projection_v2(
              expected."compensationReviewId"
            ) - 'operationContractVersion'
          ) = (
            public.literature_gold_review_clinical_projection_v2(
              case when expected.kind = 'compensate_restore'
                then expected."effectiveSourceReviewId"
                else expected."importedReviewId" end
            ) - 'operationContractVersion'
          ) end as exact_copy
        from expected
      )
      select pg_catalog.jsonb_build_object(
        'mappingCount', count(*)::integer,
        'exactPayloadCopy', coalesce(bool_and(exact_copy), false)
      ) from compared;`),
    )
}

export function createExactPackageDatabaseExecutorV2(
  package_: GeneratedGoldImportCompensationPackageV2,
): V2ExactPackageDatabaseExecutor {
  const privatePackage = verifyGeneratedGoldImportCompensationPackageV2(package_)
  return {
    async execute(context): Promise<V2ExactPackageDatabaseEvidence> {
      const sourceAuthorization = privatePackage.sourceAuthorizationSet
      const liveMigrationReceiptGate =
        requireIssuedGoldImportCompensationV2MigrationReceiptGateForBinding(
          context.migrationReceiptGate,
          {
            auditTarget: sourceAuthorization.auditTarget,
            batchId: sourceAuthorization.currentDatabase.batchId,
            completeCatalogAuditIdentitySha256:
              sourceAuthorization.completeCatalogAudit.fullAuditIdentitySha256,
            developmentMembershipSha256:
              sourceAuthorization.currentDatabase.developmentMembershipSha256,
            developmentPlanningStateSha256:
              sourceAuthorization.currentDatabase.developmentPlanningStateSha256,
            expectedCatalogBindingSha256: sourceAuthorization.expectedCatalog.bindingSha256,
            migrationId: sourceAuthorization.migration.id,
            migrationSha256: sourceAuthorization.migration.sha256,
            preImportEffectiveStateSha256:
              sourceAuthorization.v2PreImportState.effectiveStateSha256,
            preImportPhysicalStateSha256: sourceAuthorization.v2PreImportState.physicalStateSha256,
            v1Occurrence: 1,
            v2Occurrence: 1,
          },
        )
      if (
        liveMigrationReceiptGate.auditTarget !== 'disposable_clone' ||
        liveMigrationReceiptGate.kind !== 'disposable_rehearsal' ||
        liveMigrationReceiptGate.productionUseAllowed !== false ||
        canonicalJson(liveMigrationReceiptGate) !==
          canonicalJson(privatePackage.migrationReceiptGate)
      ) {
        throw new Error('Exact disposable V2 executor lacks its canonical non-production proof.')
      }
      const plan = privatePackage.importPlan
      if (
        context.batchId !== plan.batchId ||
        context.migrationSha256 !== privatePackage.verifiedBindings.migrationSha256
      ) {
        throw new Error('Exact V2 package does not match the seeded disposable target.')
      }
      const preImport = stateSchema.parse(await context.queryJson(v2StateSql(plan.batchId)))
      if (
        preImport.effective !== plan.expectedEffectiveStateSha256 ||
        preImport.physical !== plan.expectedPhysicalStateSha256 ||
        preImport.membership !== plan.scope.developmentMembershipSha256
      ) {
        throw new Error('Disposable V2 seed hashes do not match the exact generated package.')
      }

      const atomicity = {
        beforeAction1: await runBeforeActionFaultProbe(context, plan),
        midOperation: await runControlledFaultProbe(
          context,
          plan,
          'mid-operation',
          Math.ceil(plan.actions.length / 2),
        ),
        finalAction: await runControlledFaultProbe(
          context,
          plan,
          'final-action',
          plan.actions.length,
        ),
      }

      const authorization = bindDisposableImportAuthorization(plan)
      const imported = parseImportReceiptV2(
        await context.queryJson(
          `set role service_role; select ${importRpcCall(plan, authorization)};`,
        ),
      )
      if (imported.outcome !== 'committed' || imported.response !== 'applied') {
        throw new Error('Exact V2 import did not commit once.')
      }
      const postImportState = stateSchema.parse(await context.queryJson(v2StateSql(plan.batchId)))
      if (postImportState.effective !== plan.expectedPostEffectiveStateSha256) {
        throw new Error('Exact V2 import did not produce the generator-derived effective state.')
      }
      const recovery = bindRecoveryAuthorizationV2({
        authorizedAt: '2030-01-01T00:00:01.000Z',
        authorizedBy: 'disposable-v2-rehearsal@example.invalid',
        authorizationId: deterministicPackageUuidV2(plan.operationId, 'lost-ack-recovery'),
        authorizationNote: 'Read-only lost-ack reconciliation in the disposable V2 rehearsal.',
        authorized: true,
        batchId: plan.batchId,
        contractVersion: plan.contractVersion,
        kind: 'recovery_authorization',
        migrationId: plan.executionContext.migrationId,
        observedEffectiveStateSha256: imported.afterEffectiveStateSha256,
        observedPhysicalStateSha256: imported.afterPhysicalStateSha256,
        permitsMutation: false,
        recoveryAction: 'resolve_ambiguous_import',
        remoteWritesAllowed: false,
        repositoryCommitSha: plan.executionContext.repositoryCommitSha,
        targetDatabase: 'local',
        targetIdempotencyKey: plan.binding.idempotencyKey,
        targetOperationId: plan.operationId,
        targetPlanSha256: plan.binding.contentSha256,
      })
      const reconciled = parseImportReceiptV2(
        await context.queryJson(
          `set role service_role; select ${recoveryRpcCall(plan.operationId, recovery)};`,
        ),
      )
      const postReconcileState = stateSchema.parse(
        await context.queryJson(v2StateSql(plan.batchId)),
      )
      const replayed = parseImportReceiptV2(
        await context.queryJson(
          `set role service_role; select ${importRpcCall(plan, authorization)};`,
        ),
      )
      const postReplayState = stateSchema.parse(await context.queryJson(v2StateSql(plan.batchId)))
      if (
        reconciled.response !== 'idempotent_replay' ||
        replayed.response !== 'idempotent_replay' ||
        reconciled.binding.contentSha256 !== imported.binding.contentSha256 ||
        replayed.binding.contentSha256 !== imported.binding.contentSha256 ||
        canonicalJson(postImportState) !== canonicalJson(postReconcileState) ||
        canonicalJson(postImportState) !== canonicalJson(postReplayState)
      ) {
        throw new Error('V2 lost-ack reconciliation or exact replay mutated committed state.')
      }

      const productionCohort = await buildProductionCohortEvidence(context, plan)
      const { authorization: compensationAuthorization, plan: compensationPlan } =
        bindDisposableCompensation(privatePackage, imported)
      const compensation = parseCompensationReceiptV2(
        await context.queryJson(
          `set role service_role; select ${compensationRpcCall(
            compensationPlan,
            compensationAuthorization,
          )};`,
        ),
      )
      const postCompensation = stateSchema.parse(await context.queryJson(v2StateSql(plan.batchId)))
      const compensationReplay = parseCompensationReceiptV2(
        await context.queryJson(
          `set role service_role; select ${compensationRpcCall(
            compensationPlan,
            compensationAuthorization,
          )};`,
        ),
      )
      const postCompensationReplay = stateSchema.parse(
        await context.queryJson(v2StateSql(plan.batchId)),
      )
      const payloadCopies = await verifyCompensationPayloadCopies(context, privatePackage)
      if (
        compensation.outcome !== 'committed' ||
        compensationReplay.response !== 'idempotent_replay' ||
        compensation.binding.contentSha256 !== compensationReplay.binding.contentSha256 ||
        postCompensation.effective !== preImport.effective ||
        postCompensation.physical === preImport.physical ||
        postCompensation.physical === postImportState.physical ||
        canonicalJson(postCompensation) !== canonicalJson(postCompensationReplay)
      ) {
        throw new Error(
          'V2 compensation was not idempotent, append-only, and effectively restoring.',
        )
      }
      return {
        operationScenarios: {
          atomicity,
          compensation: {
            actionMappingCount: payloadCopies.mappingCount,
            appendOnly: true,
            effectiveStateRestored: true,
            exactPayloadCopy: payloadCopies.exactPayloadCopy,
            physicalHistoryExtended: true,
          },
          idempotency: { mutationCount: 0, sameReceipt: true },
          lostAcknowledgement: {
            mutationCount: 0,
            readOnlyReconcile: true,
            sameReceipt: true,
          },
          receiptsAndState: {
            receipts: {
              compensationApplied: compensation,
              compensationReplayed: compensationReplay,
              importApplied: imported,
              importReconciled: reconciled,
              importReplayed: replayed,
            },
            state: {
              postCompensation: observedStateHashes(postCompensation),
              postCompensationReplay: observedStateHashes(postCompensationReplay),
              postImport: observedStateHashes(postImportState),
              postImportReplay: observedStateHashes(postReplayState),
              postLostAcknowledgementReconcile: observedStateHashes(postReconcileState),
              preImport: observedStateHashes(preImport),
            },
          },
        },
        productionCohort,
      }
    },
  }
}
