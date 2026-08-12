import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import {
  PROTECTED_V2_APPLICATION_REPORT_SCHEMA_VERSION,
  collectProtectedV2PostApplicationAudit,
  finalizeProtectedV2ApplicationReceipt,
  loadProtectedV2ApplicationIntentPackage,
  parseProtectedV2OperatorArguments,
  runProtectedV2Operator,
  sealProtectedV2ApplicationIntent,
  verifyProtectedV2PreapplicationBackup,
  type ProtectedV2DatabaseEvidence,
  type ProtectedV2LoadedIntentPackage,
  type ProtectedV2OperatorArguments,
  type ProtectedV2OperatorDependencies,
  type ProtectedV2RepositoryEvidence,
  type ProtectedV2SealedIntentPackage,
} from './apply-protected-gold-import-contract-v2'
import { GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2 } from './gold-import-note-disposition-gate-v2'
import { reconciliationIdentitySha256 } from './gold-import-compensation-contract-reconciliation'
import {
  DEFAULT_LOCAL_DATABASE_CONTAINER,
  LOCAL_DATABASE_PORT,
  LOCAL_SUPABASE_PROJECT_ID,
  canonicalJson,
  type CommandRunner,
} from './gold-import-compensation-migration-operations'
import {
  PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD,
  PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL,
  PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL_IDENTITY_SHA256,
  PROTECTED_V2_EXPECTED_INVARIANT_IDENTITY_SHA256,
  validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile,
} from './gold-import-contract-v2-catalog-audit'
import {
  committedProtectedV2CatalogExpectedArtifactForValidatedProfile,
  expectedObservedAuditIdentityFromArtifact,
} from './gold-import-contract-v2-catalog-expectations'
import {
  PROTECTED_V2_APPLICATION_INTENT_SCHEMA_VERSION,
  PROTECTED_V2_BACKUP_DUPLICATE_MARKER_DIRECTORY,
  PROTECTED_V2_BACKUP_RECEIPT_SCHEMA_VERSION,
  buildProtectedV2ApplicationExecutionReceipt,
  buildProtectedV2ApplicationIntent,
  buildProtectedV2ApplicationResult,
  buildProtectedV2BackupExecutionReceipt,
  buildProtectedV2BackupDuplicateMarker,
  buildProtectedV2PostApplicationAudit,
  parseProtectedV2BackupExecutionReceipt,
  type ProtectedV2ApplicationExecutionReceipt,
  type ProtectedV2ApplicationResult,
} from './protected-gold-import-contract-v2-evidence'
import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
  PROTECTED_V2_AUTHORIZED_CAPABILITY,
  PROTECTED_V2_BACKUP_TRUST_MODEL,
  PROTECTED_V2_CONFIRMATION,
  PROTECTED_V2_FORBIDDEN_CAPABILITIES,
  PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION,
  buildProtectedV2Authorization,
  validateProtectedV2Authorization,
  type ProtectedV2AuthorizationContext,
  type ProtectedV2BackupBinding,
} from './protected-gold-import-contract-v2'
import {
  buildProtectedV2OperatorBundle,
  type ValidatedProtectedV2OperatorBundle,
} from './protected-gold-import-contract-v2-recovery-bundle'
import {
  buildProtectedV2ExpectedCatalogBinding,
  buildProtectedV2RuntimeBundleBinding,
  parseProtectedV2RuntimeBundleBinding,
} from './protected-gold-import-contract-v2-bindings'
import {
  LITERATURE_GOLD_V2_OPERATION_SCHEMA_ONLY_EXCLUSIONS,
  LITERATURE_GOLD_V2_REVIEW_SCHEMA_ONLY_EXCLUSIONS,
  type LiteratureGoldV2SchemaNeutralHistoryEvidence,
} from './literature-gold-v2-schema-neutral-history'
import { LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY } from './literature-gold-v2-schema-only-transition'
import { PROTECTED_V2_TRANSITION_DATABASE_EVIDENCE_SCHEMA_VERSION } from './protected-gold-import-contract-v2-transition-evidence'

const HEAD = '1111111111111111111111111111111111111111'
const NOW = new Date('2026-08-09T20:00:00.000Z')
let BASELINE_OPERATOR_BUNDLE: ValidatedProtectedV2OperatorBundle

const LOCAL_EXPECTED_CATALOG = buildProtectedV2ExpectedCatalogBinding(
  'local_supabase_postgres_owner_v1',
  'local',
)
const LOCAL_EXPECTED_AUDIT = validateProtectedV2CompleteCatalogAuditIdentityForExpectedProfile(
  expectedObservedAuditIdentityFromArtifact(
    committedProtectedV2CatalogExpectedArtifactForValidatedProfile(
      'local_supabase_postgres_owner_v1',
      'local',
    ),
  ),
  'local_supabase_postgres_owner_v1',
  'local',
)

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function history(phase: 'before_v2' | 'after_v2'): LiteratureGoldV2SchemaNeutralHistoryEvidence {
  const authority = LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY
  const unsigned: Omit<LiteratureGoldV2SchemaNeutralHistoryEvidence, 'bindingSha256'> = {
    batchId: authority.batchId,
    componentIdentities: { ...authority.historyComponentIdentities },
    counts: { ...authority.counts },
    datasetSplit: 'development',
    expectedPostV1PhysicalStateSha256: authority.post.physicalStateSha256V1,
    phase,
    physicalStateSha256V1:
      phase === 'before_v2'
        ? authority.pre.physicalStateSha256V1
        : authority.post.physicalStateSha256V1,
    schemaDerivedFields: {
      operationFields: LITERATURE_GOLD_V2_OPERATION_SCHEMA_ONLY_EXCLUSIONS,
      operationRowCount: authority.counts.operations,
      operationValuesSha256:
        phase === 'before_v2'
          ? authority.pre.schemaDerivedOperationValuesSha256
          : authority.postSchemaDerivedOperationValuesSha256,
      reviewFields: LITERATURE_GOLD_V2_REVIEW_SCHEMA_ONLY_EXCLUSIONS,
      reviewRowCount: authority.counts.reviews,
      reviewValuesSha256:
        phase === 'before_v2'
          ? authority.pre.schemaDerivedReviewValuesSha256
          : authority.postSchemaDerivedReviewValuesSha256,
    },
    schemaNeutralHistorySha256: authority.post.schemaNeutralHistorySha256,
    schemaVersion: 'literature-gold-schema-neutral-physical-history-evidence/1.0.0',
  }
  return { ...unsigned, bindingSha256: sha256(canonicalJson(unsigned)) }
}

function repository(head = HEAD): ProtectedV2RepositoryEvidence {
  const operatorBundle = JSON.parse(
    JSON.stringify(BASELINE_OPERATOR_BUNDLE),
  ) as ValidatedProtectedV2OperatorBundle
  return {
    branch: 'main',
    head,
    operatorBundle,
    operatorBundleBinding: buildProtectedV2RuntimeBundleBinding(operatorBundle),
    originMain: head,
    statusCleanIncludingUntracked: true,
  }
}

function rehashOperatorBundle(repositoryEvidence: ProtectedV2RepositoryEvidence): void {
  const { aggregateSha256: _aggregateSha256, ...content } = repositoryEvidence.operatorBundle
  void _aggregateSha256
  repositoryEvidence.operatorBundle.aggregateSha256 = sha256(canonicalJson(content))
  repositoryEvidence.operatorBundleBinding = buildProtectedV2RuntimeBundleBinding(
    repositoryEvidence.operatorBundle,
  )
}

function database(applied = false): ProtectedV2DatabaseEvidence {
  const authority = LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY
  return {
    actionCount: 0,
    batchId: authority.batchId,
    compensationCount: 0,
    completeCatalogAudit: applied ? LOCAL_EXPECTED_AUDIT : null,
    developmentMembershipSha256: authority.post.developmentMembershipSha256,
    developmentPlanningStateSha256: authority.post.planningStateSha256,
    effectiveStateSha256: authority.post.effectiveStateSha256V1,
    effectiveStateSha256V2: applied ? authority.post.effectiveStateSha256V2 : null,
    eventStateSha256: authority.post.eventStateSha256,
    history: history(applied ? 'after_v2' : 'before_v2'),
    importCount: 0,
    ledgerEntries: [
      {
        name: PROTECTED_GOLD_IMPORT_CONTRACT_V1.migrationName,
        version: PROTECTED_GOLD_IMPORT_CONTRACT_V1.version,
      },
      ...(applied
        ? [
            {
              name: PROTECTED_GOLD_IMPORT_CONTRACT_V2.migrationName,
              version: PROTECTED_GOLD_IMPORT_CONTRACT_V2.version,
            },
          ]
        : []),
    ],
    operationCount: 0,
    physicalStateSha256: applied
      ? authority.post.physicalStateSha256V1
      : authority.pre.physicalStateSha256V1,
    physicalStateSha256V2: applied ? authority.post.physicalStateSha256V2 : null,
    pointerStateSha256: authority.post.pointerStateSha256,
    readOnlyBracketMatches: true,
    revealStateSha256: authority.post.revealStateSha256,
    reviewStateSha256: authority.post.reviewStateSha256,
    schemaVersion: PROTECTED_V2_TRANSITION_DATABASE_EVIDENCE_SCHEMA_VERSION,
    v1Occurrence: 1,
    v2Occurrence: applied ? 1 : 0,
  }
}

function backup(directory: string, identity: 'a' | 'b'): ProtectedV2BackupBinding {
  return {
    backupInstanceId: identity.repeat(64),
    backupRoot: '/backup',
    canonicalManifestSha256: '9'.repeat(64),
    directory,
    executedAt: NOW.toISOString(),
    executionNonce: (identity === 'a' ? '1' : '2').repeat(64),
    executionReceiptSha256: (identity === 'a' ? 'c' : 'd').repeat(64),
  }
}

function context(): ProtectedV2AuthorizationContext {
  return {
    backups: [backup('/backup/one', 'a'), backup('/backup/two', 'b')],
    database: {
      container: DEFAULT_LOCAL_DATABASE_CONTAINER,
      ...GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2,
      port: LOCAL_DATABASE_PORT,
      projectId: LOCAL_SUPABASE_PROJECT_ID,
      target: 'local',
      v1Occurrence: 1,
      v2Occurrence: 0,
    },
    migration: PROTECTED_GOLD_IMPORT_CONTRACT_V2,
    expectedPostApplicationAudit: {
      auditMethod: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD,
      auditModel: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL,
      auditModelIdentitySha256: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_MODEL_IDENTITY_SHA256,
      environmentInvariantIdentitySha256: PROTECTED_V2_EXPECTED_INVARIANT_IDENTITY_SHA256,
      expectedCatalog: LOCAL_EXPECTED_CATALOG,
      verifier: PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
      verifierExecuted: false,
    },
    repository: repository(),
    backupTrustModel: PROTECTED_V2_BACKUP_TRUST_MODEL,
    separateCaptureAttestation: PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION,
    safety: { heldOutIdentitiesAccessed: false, remoteDatabaseAccessed: false },
  }
}

function postApplicationAudit(after = database(true), repositoryCommitSha = HEAD) {
  return buildProtectedV2PostApplicationAudit({
    auditMethod: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD,
    auditedAt: NOW.toISOString(),
    catalogAudit: LOCAL_EXPECTED_AUDIT,
    databaseEvidenceSha256: sha256(canonicalJson(after)),
    migration: PROTECTED_GOLD_IMPORT_CONTRACT_V2,
    expectedCatalog: LOCAL_EXPECTED_CATALOG,
    readOnly: true,
    repeatableRead: true,
    repositoryCommitSha,
    verifier: PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
    verifierExecuted: false,
  })
}

interface Scenario {
  applied: boolean
  backupVerificationTimes: string[]
  completed?: {
    executionReceipt: ProtectedV2ApplicationExecutionReceipt
    result: ProtectedV2ApplicationResult
  }
  counters: {
    apply: number
    audit: number
    beforeMigration: number
    finalize: number
    seal: number
    stage: number
  }
  events: string[]
  fail?:
    | 'finalize'
    | 'lost_ack'
    | 'migration_absent'
    | 'output'
    | 'post_inspection'
    | 'pre_migration'
    | 'stage_before_mutation'
  intentPackage?: ProtectedV2SealedIntentPackage
  now: Date
}

function scenario(fail?: Scenario['fail']): Scenario {
  return {
    applied: false,
    backupVerificationTimes: [],
    counters: { apply: 0, audit: 0, beforeMigration: 0, finalize: 0, seal: 0, stage: 0 },
    events: [],
    fail,
    now: NOW,
  }
}

function operatorDependencies(state: Scenario): ProtectedV2OperatorDependencies {
  return {
    applyMigration: async () => {
      state.events.push('apply')
      state.counters.apply += 1
      if (state.fail === 'migration_absent') throw new Error('migration command failed absent')
      state.applied = true
      if (state.fail === 'lost_ack') throw new Error('migration acknowledgement lost')
    },
    beforeMigrationApplication: async () => {
      state.events.push('before_migration')
      state.counters.beforeMigration += 1
      if (state.fail === 'pre_migration') throw new Error('stopped before migration')
    },
    finalizeReceipt: async (input) => {
      state.events.push('finalize')
      state.counters.finalize += 1
      if (state.fail === 'finalize') throw new Error('final receipt write failed')
      const result = buildProtectedV2ApplicationResult({
        after: input.after,
        backupInstances: input.intentPackage.intent.backupInstances,
        before: input.intentPackage.intent.before,
        beforeCaptures: input.intentPackage.intent.beforeCaptures,
        intentCommitIsAncestor: input.intentCommitIsAncestor,
        intentRepositoryHead: input.intentPackage.intent.repository.head,
        migrationApplicationCallCount: input.migrationApplicationCallCount,
        operatorAuthorizationSha256: input.intentPackage.intent.authorizationSha256,
        originalIntentSha256: input.intentPackage.intentSha256,
        operatorBundleSha256: input.intentPackage.intent.operatorBundle.aggregateSha256,
        postApplicationAudit: input.postApplicationAudit,
        receiptReconciled: input.receiptReconciled,
        reconciliationReason: input.reconciliationReason,
        repository: input.repository,
      })
      const resultBytes = canonicalJson(result)
      const executionReceipt = buildProtectedV2ApplicationExecutionReceipt(
        {
          auditMethod: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD,
          backupCaptureIds: input.intentPackage.intent.backupInstances.map(
            ({ backupInstanceId }) => backupInstanceId,
          ) as [string, string],
          backupTrustModel: PROTECTED_V2_BACKUP_TRUST_MODEL,
          canonicalManifestSha256: 'a'.repeat(64),
          compensationAuthorized: false,
          executedAt: NOW.toISOString(),
          expectedCatalog: input.postApplicationAudit.expectedCatalog,
          heldOutIdentitiesAccessed: false,
          importAuthorized: false,
          intentCommitIsAncestor: input.intentCommitIsAncestor,
          intentRepositoryHead: input.intentPackage.intent.repository.head,
          migrationApplied: true,
          migrationApplicationCallCount: input.migrationApplicationCallCount,
          migrationId: PROTECTED_GOLD_IMPORT_CONTRACT_V2.id,
          migrationReexecuted: false,
          migrationSha256: PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256,
          operatorAuthorizationSha256: input.intentPackage.intent.authorizationSha256,
          operatorBundleSha256: input.intentPackage.intent.operatorBundle.aggregateSha256,
          operatorBundleBinding: input.repository.operatorBundleBinding,
          operatorBundleUnchanged: true,
          originalIntentSha256: input.intentPackage.intentSha256,
          outputDirectory: input.intentPackage.outputDirectory,
          postApplicationAuditSha256: input.postApplicationAudit.auditIdentitySha256,
          postApplicationCatalogAuditIdentitySha256:
            input.postApplicationAudit.catalogAudit.fullAuditIdentitySha256,
          postApplicationComponentIdentities:
            input.postApplicationAudit.catalogAudit.componentIdentities,
          receiptReconciled: input.receiptReconciled,
          reconciliationReason: input.reconciliationReason,
          remoteDatabaseAccessed: false,
          recoveryRepositoryHead: input.repository.head,
          repositoryCommitSha: input.repository.head,
          resultSha256: sha256(resultBytes),
          separateCaptureAttestation: PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION,
          verifierExecuted: false,
          verifierSourceSha256: PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER.sha256,
        },
        { operatorBundle: input.repository.operatorBundle },
      )
      state.completed = { executionReceipt, result }
      return {
        manifestSha256: executionReceipt.canonicalManifestSha256,
        outputDirectory: input.intentPackage.outputDirectory,
        receiptSha256: sha256(canonicalJson(executionReceipt)),
      }
    },
    inspectDatabase: async (expected) => {
      if (expected === 'v2_absent') {
        if (state.applied) throw new Error('expected V2 absent')
        return database(false)
      }
      state.events.push('inspect_applied')
      if (state.fail === 'post_inspection') throw new Error('post-application inspection failed')
      if (!state.applied) throw new Error('expected exact applied V2')
      return database(true)
    },
    inspectRepository: async () => repository(),
    isRepositoryCommitAncestor: async () => true,
    loadIntentPackage: async () => {
      if (!state.intentPackage) throw new Error('sealed intent absent')
      return {
        ...state.intentPackage,
        ...(state.completed ? { completed: state.completed } : {}),
      } satisfies ProtectedV2LoadedIntentPackage
    },
    now: () => state.now,
    sealIntent: async ({
      authorization,
      before,
      beforeCaptures,
      output,
      repository: repositoryEvidence,
    }) => {
      state.events.push('seal')
      if (state.fail === 'output') throw new Error('application intent creation failed')
      state.counters.seal += 1
      const intent = buildProtectedV2ApplicationIntent({
        authorization,
        before,
        beforeCaptures,
        outputDirectory: output,
        repository: repositoryEvidence,
      })
      state.intentPackage = {
        intent,
        intentManifestSha256: 'e'.repeat(64),
        intentSha256: sha256(canonicalJson(intent)),
        outputDirectory: output,
      }
      return state.intentPackage
    },
    stageProtectedMigration: async () => {
      state.events.push('stage')
      if (state.fail === 'stage_before_mutation') throw new Error('staging stopped before write')
      state.counters.stage += 1
    },
    verifyBackup: async ({ directory, now }) => {
      state.backupVerificationTimes.push(now.toISOString())
      return {
        binding: directory.endsWith('one') ? backup(directory, 'a') : backup(directory, 'b'),
        database: clone(database(false)),
      }
    },
    verifyPostApplication: async ({ after, repository: repositoryEvidence }) => {
      state.events.push('audit')
      state.counters.audit += 1
      return postApplicationAudit(after, repositoryEvidence.head)
    },
  }
}

function commitArguments(): ProtectedV2OperatorArguments {
  return {
    backups: ['/backup/one', '/backup/two'],
    confirmation: PROTECTED_V2_CONFIRMATION,
    mode: 'commit',
    operator: 'operator',
    output: '/local/receipt',
    separateCaptureAttestation: PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION,
    target: 'local',
  }
}

function reconciliationArguments(): ProtectedV2OperatorArguments {
  return {
    mode: 'reconcile_applied_receipt',
    operator: 'operator',
    output: '/local/receipt',
    reconciliationReason: 'migration committed but acknowledgement was lost',
    target: 'local',
  }
}

async function createBackupFixture(input: { name: string; nonceCharacter: string; root: string }) {
  const directory = resolve(input.root, input.name)
  await mkdir(directory)
  const ledgerBytes = canonicalJson({
    protectedV2: { classification: 'v2_absent', occurrence: 0 },
  })
  const files = new Map<string, string>([
    [
      'development-database-seed.json',
      canonicalJson({ datasetSplit: 'development', heldOutIdentitiesIncluded: false }),
    ],
    [
      'pre-application-report.json',
      canonicalJson({
        schemaVersion: 'gold-import-contract-v2-preapplication-report/2.0.0',
        repository: repository(),
        expectedCatalog: LOCAL_EXPECTED_CATALOG,
        operatorBundleBinding: repository().operatorBundleBinding,
        migration: {
          v1: { occurrence: 1, sha256: PROTECTED_GOLD_IMPORT_CONTRACT_V1.sha256 },
          v2: { occurrence: 0, sha256: PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256 },
        },
        database: { current: GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2 },
        ordinaryLocalStartPlan: {
          firstStartProtectedV2Visible: false,
          migrationUpProtectedV2Visible: false,
          protectedMigrationApplicationPlanned: false,
          protectedMigrationState: 'v2_absent_unarmed',
          protectedV2AuthorizationPresent: false,
        },
        safety: {
          heldOutIdentitiesAccessed: false,
          realLocalDatabaseMutationCount: 0,
          remoteDatabaseAccessed: false,
        },
      }),
    ],
    ['pre-application-report.md', '# Read-only pre-application backup\n'],
    ['protected-migration-ledger.json', ledgerBytes],
    [
      'state-hashes.json',
      canonicalJson({
        schemaVersion: 'literature-gold-protected-v2-state-backup/2.0.0',
        ...GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2,
        databaseEvidence: database(false),
      }),
    ],
  ])
  const manifest = [...files]
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([name, bytes]) => `${sha256(bytes)}  ${name}\n`)
    .join('')
  await Promise.all([
    ...[...files].map(([name, bytes]) => writeFile(resolve(directory, name), bytes, 'utf8')),
    writeFile(resolve(directory, 'checksum-manifest.sha256'), manifest, 'utf8'),
  ])
  const backupRoot = await realpath(input.root)
  const outputDirectory = await realpath(directory)
  const receipt = buildProtectedV2BackupExecutionReceipt(
    {
      backupRoot,
      canonicalManifestSha256: sha256(manifest),
      database: {
        batchId: database().batchId,
        datasetSplit: 'development',
        ...GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2,
      },
      executedAt: NOW.toISOString(),
      executionNonce: input.nonceCharacter.repeat(64),
      expectedCatalog: LOCAL_EXPECTED_CATALOG,
      migrationLedger: {
        sha256: sha256(ledgerBytes),
        v1: { ...PROTECTED_GOLD_IMPORT_CONTRACT_V1, occurrence: 1 },
        v2: { ...PROTECTED_GOLD_IMPORT_CONTRACT_V2, occurrence: 0 },
      },
      outputDirectory,
      operatorBundleBinding: repository().operatorBundleBinding,
      repositoryCommitSha: HEAD,
      safety: {
        databaseMutationCount: 0,
        heldOutIdentitiesAccessed: false,
        remoteDatabaseAccessed: false,
      },
      schemaVersion: PROTECTED_V2_BACKUP_RECEIPT_SCHEMA_VERSION,
    },
    { operatorBundle: repository().operatorBundle },
  )
  const receiptBytes = canonicalJson(receipt)
  await writeFile(resolve(directory, 'execution-receipt.json'), receiptBytes, 'utf8')
  const markerDirectory = resolve(backupRoot, PROTECTED_V2_BACKUP_DUPLICATE_MARKER_DIRECTORY)
  await mkdir(markerDirectory, { recursive: true })
  const marker = buildProtectedV2BackupDuplicateMarker(receipt, sha256(receiptBytes))
  await writeFile(
    resolve(markerDirectory, `${receipt.backupInstanceId}.json`),
    canonicalJson(marker),
    'utf8',
  )
  return { directory, manifest, receipt }
}

describe('protected V2 migration operator recovery boundary', () => {
  const cleanupDirectories: string[] = []

  beforeAll(async () => {
    BASELINE_OPERATOR_BUNDLE = await buildProtectedV2OperatorBundle({ cwd: process.cwd() })
  })

  afterEach(async () => {
    await Promise.all(
      cleanupDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
    )
  })

  it('parses dry-run, commit, and non-replaying reconciliation as disjoint modes', () => {
    expect(
      parseProtectedV2OperatorArguments([
        '--target',
        'local',
        '--operator',
        'operator',
        '--backup',
        '/one',
        '--backup',
        '/two',
      ]).mode,
    ).toBe('dry_run_read_only')
    expect(
      parseProtectedV2OperatorArguments([
        '--target',
        'local',
        '--operator',
        'operator',
        '--backup',
        '/one',
        '--backup',
        '/two',
        '--confirmation',
        PROTECTED_V2_CONFIRMATION,
        '--separate-capture-attestation',
        PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION,
        '--output',
        '/receipt',
        '--commit',
      ]).mode,
    ).toBe('commit')
    for (const attestationArguments of [
      [],
      ['--separate-capture-attestation', 'I made some backups'],
    ]) {
      expect(() =>
        parseProtectedV2OperatorArguments([
          '--target',
          'local',
          '--operator',
          'operator',
          '--backup',
          '/one',
          '--backup',
          '/two',
          '--confirmation',
          PROTECTED_V2_CONFIRMATION,
          '--output',
          '/receipt',
          '--commit',
          ...attestationArguments,
        ]),
      ).toThrow('--commit requires --separate-capture-attestation')
    }
    expect(
      parseProtectedV2OperatorArguments([
        '--target',
        'local',
        '--operator',
        'operator',
        '--output',
        '/receipt',
        '--reconciliation-reason',
        'lost acknowledgement',
        '--reconcile-applied-receipt',
      ]),
    ).toMatchObject({
      mode: 'reconcile_applied_receipt',
      reconciliationReason: 'lost acknowledgement',
    })
    expect(() =>
      parseProtectedV2OperatorArguments([
        '--target',
        'remote',
        '--operator',
        'operator',
        '--backup',
        '/one',
        '--backup',
        '/two',
      ]),
    ).toThrow('target must be exactly local')
    expect(() =>
      parseProtectedV2OperatorArguments([
        '--target',
        'local',
        '--operator',
        'operator',
        '--output',
        '/receipt',
        '--backup',
        '/one',
        '--reconciliation-reason',
        'lost acknowledgement',
        '--reconcile-applied-receipt',
      ]),
    ).toThrow('forbids --commit, --confirmation, --backup, and --separate-capture-attestation')
  })

  it('freezes exact bindings and rejects a self-rehashed unsafe runtime root', () => {
    const expectedCatalog = buildProtectedV2ExpectedCatalogBinding(
      'local_supabase_postgres_owner_v1',
      'local',
    )
    const runtimeBinding = buildProtectedV2RuntimeBundleBinding(BASELINE_OPERATOR_BUNDLE)
    expect(Object.isFrozen(expectedCatalog)).toBe(true)
    expect(Object.isFrozen(expectedCatalog.componentIdentities)).toBe(true)
    expect(Object.isFrozen(runtimeBinding)).toBe(true)
    expect(Object.isFrozen(runtimeBinding.finalRoots)).toBe(true)
    expect(() => runtimeBinding.finalRoots.push('escape')).toThrow()

    const unsafe = JSON.parse(JSON.stringify(runtimeBinding)) as typeof runtimeBinding
    unsafe.finalRoots = ['../../escape']
    const { bindingSha256: _bindingSha256, ...content } = unsafe
    void _bindingSha256
    unsafe.bindingSha256 = sha256(canonicalJson(content))
    expect(() => parseProtectedV2RuntimeBundleBinding(unsafe)).toThrow()
  })

  it('performs no intent, staging, migration, audit, or receipt write in dry-run mode', async () => {
    const state = scenario()
    const result = await runProtectedV2Operator(
      {
        backups: ['/backup/one', '/backup/two'],
        mode: 'dry_run_read_only',
        operator: 'operator',
        target: 'local',
      },
      operatorDependencies(state),
    )
    expect(result).toMatchObject({ databaseMutationCount: 0, mode: 'dry_run_read_only' })
    expect(state.counters).toEqual({
      apply: 0,
      audit: 0,
      beforeMigration: 0,
      finalize: 0,
      seal: 0,
      stage: 0,
    })
  })

  it('seals intent before staging and binds the read-only post-application audit before finalizing', async () => {
    const state = scenario()
    const result = await runProtectedV2Operator(commitArguments(), operatorDependencies(state))
    expect(result).toMatchObject({
      migrationApplicationCallCount: 1,
      migrationReexecuted: false,
      mode: 'committed_protected_v2_migration',
    })
    expect(state.events).toEqual([
      'seal',
      'stage',
      'before_migration',
      'apply',
      'inspect_applied',
      'audit',
      'finalize',
    ])
    expect(state.intentPackage?.intent).toMatchObject({
      schemaVersion: PROTECTED_V2_APPLICATION_INTENT_SCHEMA_VERSION,
      state: 'application_intent_sealed',
      safety: { finalReceiptComplete: false, migrationApplied: false },
    })
    expect(state.completed?.result.postApplicationAudit.verifier).toEqual(
      PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
    )
  })

  it('seals the already bracketed complete catalog without a second database query', async () => {
    const statements: string[] = []
    const runCommand: CommandRunner = async (command, _arguments, options) => {
      expect(command).toBe('docker')
      statements.push(options?.stdin ?? '')
      return { stderr: '', stdout: '{}\n' }
    }
    const after = database(true)
    await expect(
      collectProtectedV2PostApplicationAudit({
        after,
        dockerTarget: {
          context: null,
          dockerArguments: [],
          endpoint: 'unix:///var/run/docker.sock',
          environment: { NODE_ENV: 'test' },
        },
        now: NOW,
        repository: repository(),
        runCommand,
      }),
    ).resolves.toMatchObject({
      catalogAudit: LOCAL_EXPECTED_AUDIT,
      readOnly: true,
      repeatableRead: true,
    })
    expect(statements).toHaveLength(0)
  })

  it.each([
    ['output', { apply: 0, seal: 0, stage: 0 }],
    ['stage_before_mutation', { apply: 0, seal: 1, stage: 0 }],
    ['pre_migration', { apply: 0, seal: 1, stage: 1 }],
  ] as const)('fails safely at %s before any migration call', async (failure, expected) => {
    const state = scenario(failure)
    await expect(
      runProtectedV2Operator(commitArguments(), operatorDependencies(state)),
    ).rejects.toThrow()
    expect(state.counters.apply).toBe(expected.apply)
    expect(state.counters.seal).toBe(expected.seal)
    expect(state.counters.stage).toBe(expected.stage)
  })

  it('preserves intent and never retries when migration reports failure with an absent ledger', async () => {
    const state = scenario('migration_absent')
    await expect(
      runProtectedV2Operator(commitArguments(), operatorDependencies(state)),
    ).rejects.toThrow('migration command failed absent')
    expect(state.intentPackage).toBeDefined()
    expect(state.applied).toBe(false)
    expect(state.counters.apply).toBe(1)
    expect(state.counters.finalize).toBe(0)
  })

  it('recovers a committed/lost-ack migration with zero reconciliation migration calls', async () => {
    const state = scenario('lost_ack')
    const dependencies = operatorDependencies(state)
    await expect(runProtectedV2Operator(commitArguments(), dependencies)).rejects.toThrow(
      'acknowledgement lost',
    )
    expect(state.applied).toBe(true)
    expect(state.counters.apply).toBe(1)
    state.fail = undefined
    state.backupVerificationTimes = []
    state.now = new Date(NOW.getTime() + 24 * 60 * 60 * 1000)
    const result = await runProtectedV2Operator(reconciliationArguments(), dependencies)
    expect(result).toMatchObject({
      databaseMutationCount: 0,
      migrationApplicationCallCount: 0,
      migrationReexecuted: false,
      mode: 'reconciled_applied_receipt',
    })
    expect(state.counters.apply).toBe(1)
    expect(state.backupVerificationTimes).toEqual([NOW.toISOString(), NOW.toISOString()])
    expect(state.completed?.result).toMatchObject({
      migrationApplicationCallCount: 0,
      migrationReexecuted: false,
      receiptReconciled: true,
      reconciliationReason: 'migration committed but acknowledgement was lost',
    })
    expect(state.completed?.executionReceipt).toMatchObject({
      migrationApplicationCallCount: 0,
      migrationReexecuted: false,
      receiptReconciled: true,
    })
  })

  it('recovers from a clean current-main documentation-only descendant with an unchanged operator bundle', async () => {
    const descendant = '3'.repeat(40)
    const state = scenario('lost_ack')
    let currentRepository = repository()
    const dependencies = operatorDependencies(state)
    dependencies.inspectRepository = async () => currentRepository
    dependencies.isRepositoryCommitAncestor = async (ancestor, current) =>
      ancestor === HEAD && current === descendant
    await expect(runProtectedV2Operator(commitArguments(), dependencies)).rejects.toThrow(
      'acknowledgement lost',
    )
    currentRepository = repository(descendant)
    state.fail = undefined
    await expect(
      runProtectedV2Operator(reconciliationArguments(), dependencies),
    ).resolves.toMatchObject({ mode: 'reconciled_applied_receipt' })
    expect(state.completed?.result).toMatchObject({
      intentCommitIsAncestor: true,
      intentRepositoryHead: HEAD,
      operatorBundleUnchanged: true,
      recoveryRepositoryHead: descendant,
    })
    expect(state.counters.apply).toBe(1)
  })

  it.each([
    'scripts/literature/apply-protected-gold-import-contract-v2.ts',
    'package-lock.json',
    'tsconfig.json',
    'supabase/config.toml',
    'scripts/literature/contracts/protected-v2-complete-catalog/local_supabase_postgres_owner_v1.json',
    'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
    'supabase/verification/20260809231651_verify_literature_gold_import_compensation_contract_v2.sql',
  ])('rejects descendant reconciliation after protected bundle drift in %s', async (path) => {
    const state = scenario('lost_ack')
    let currentRepository = repository()
    const dependencies = operatorDependencies(state)
    dependencies.inspectRepository = async () => currentRepository
    await expect(runProtectedV2Operator(commitArguments(), dependencies)).rejects.toThrow()
    const drifted = JSON.parse(
      JSON.stringify(repository('2'.repeat(40))),
    ) as ProtectedV2RepositoryEvidence
    const file = drifted.operatorBundle.files.find((entry) => entry.path === path)
    if (!file) throw new Error(`Test fixture omitted protected path ${path}.`)
    file.sha256 = '0'.repeat(64)
    rehashOperatorBundle(drifted)
    currentRepository = drifted
    state.fail = undefined
    await expect(runProtectedV2Operator(reconciliationArguments(), dependencies)).rejects.toThrow()
    expect(state.counters.apply).toBe(1)
    expect(state.counters.finalize).toBe(0)
  })

  it.each([
    ['divergent branch', false],
    ['absent or unreachable intent commit', false],
  ])('rejects %s before any reconciliation database inspection', async (_label, isAncestor) => {
    const state = scenario('lost_ack')
    let currentRepository = repository()
    const dependencies = operatorDependencies(state)
    dependencies.inspectRepository = async () => currentRepository
    dependencies.isRepositoryCommitAncestor = async () => isAncestor
    await expect(runProtectedV2Operator(commitArguments(), dependencies)).rejects.toThrow()
    currentRepository = repository('2'.repeat(40))
    state.fail = undefined
    await expect(runProtectedV2Operator(reconciliationArguments(), dependencies)).rejects.toThrow(
      'recovery rule failed',
    )
    expect(state.counters.audit).toBe(0)
    expect(state.counters.apply).toBe(1)
  })

  it.each(['post_inspection', 'finalize'] as const)(
    'preserves intent after %s failure and later reconciles without migration',
    async (failure) => {
      const state = scenario(failure)
      const dependencies = operatorDependencies(state)
      await expect(runProtectedV2Operator(commitArguments(), dependencies)).rejects.toThrow()
      expect(state.intentPackage).toBeDefined()
      expect(state.applied).toBe(true)
      expect(state.counters.apply).toBe(1)
      state.fail = undefined
      await expect(
        runProtectedV2Operator(reconciliationArguments(), dependencies),
      ).resolves.toMatchObject({ mode: 'reconciled_applied_receipt' })
      expect(state.counters.apply).toBe(1)
    },
  )

  it('hard-fails reconciliation on an absent ledger without staging or migration', async () => {
    const state = scenario()
    const authorization = buildProtectedV2Authorization({
      confirmation: PROTECTED_V2_CONFIRMATION,
      context: context(),
      operator: 'operator',
      requestedAt: NOW.toISOString(),
    })
    const intent = buildProtectedV2ApplicationIntent({
      authorization,
      before: database(false),
      beforeCaptures: [database(false), database(false)],
      outputDirectory: '/local/receipt',
      repository: repository(),
    })
    state.intentPackage = {
      intent,
      intentManifestSha256: 'e'.repeat(64),
      intentSha256: sha256(canonicalJson(intent)),
      outputDirectory: '/local/receipt',
    }
    await expect(
      runProtectedV2Operator(reconciliationArguments(), operatorDependencies(state)),
    ).rejects.toThrow('expected exact applied V2')
    expect(state.counters.apply).toBe(0)
    expect(state.counters.stage).toBe(0)
  })

  it('verifies a completed reconciliation idempotently without rewriting or applying', async () => {
    const state = scenario('lost_ack')
    const dependencies = operatorDependencies(state)
    await expect(runProtectedV2Operator(commitArguments(), dependencies)).rejects.toThrow()
    state.fail = undefined
    await runProtectedV2Operator(reconciliationArguments(), dependencies)
    const finalizedCount = state.counters.finalize
    const appliedCount = state.counters.apply
    await expect(
      runProtectedV2Operator(reconciliationArguments(), dependencies),
    ).resolves.toMatchObject({ mode: 'already_complete_verified' })
    expect(state.counters.finalize).toBe(finalizedCount)
    expect(state.counters.apply).toBe(appliedCount)
  })

  it.each(['repository', 'state', 'backup'] as const)(
    'invalidates authorization after %s drift',
    (drift) => {
      const original = context()
      const authorization = buildProtectedV2Authorization({
        confirmation: PROTECTED_V2_CONFIRMATION,
        context: original,
        operator: 'operator',
        requestedAt: NOW.toISOString(),
      })
      const current = JSON.parse(JSON.stringify(original)) as ProtectedV2AuthorizationContext
      if (drift === 'repository') {
        current.repository.head = '2222222222222222222222222222222222222222'
        current.repository.originMain = current.repository.head
      } else if (drift === 'state') {
        current.database.effectiveStateSha256 = '3'.repeat(64)
      } else {
        current.backups[0].backupInstanceId = '4'.repeat(64)
      }
      expect(() => validateProtectedV2Authorization(authorization, current)).toThrow('stale')
    },
  )

  it('rejects cross-profile expected-catalog authorization in a known local context', () => {
    const crossProfile = context()
    crossProfile.expectedPostApplicationAudit.expectedCatalog =
      buildProtectedV2ExpectedCatalogBinding('supabase_admin_owner_v1', 'disposable')
    expect(() =>
      buildProtectedV2Authorization({
        confirmation: PROTECTED_V2_CONFIRMATION,
        context: crossProfile,
        operator: 'operator',
        requestedAt: NOW.toISOString(),
      }),
    ).toThrow('exact local_supabase_postgres_owner_v1/local contract')
  })

  it('rejects an arbitrary self-consistent catalog audit in the known local context', () => {
    const { fullAuditIdentitySha256: _fullAuditIdentitySha256, ...arbitraryContent } = JSON.parse(
      JSON.stringify(LOCAL_EXPECTED_AUDIT),
    ) as typeof LOCAL_EXPECTED_AUDIT
    void _fullAuditIdentitySha256
    const componentName = Object.keys(
      arbitraryContent.componentIdentities,
    )[0] as keyof typeof arbitraryContent.componentIdentities
    arbitraryContent.componentIdentities[componentName] = 'f'.repeat(64)
    const arbitraryAudit = {
      ...arbitraryContent,
      fullAuditIdentitySha256: reconciliationIdentitySha256(arbitraryContent),
    }
    expect(() =>
      buildProtectedV2PostApplicationAudit({
        auditMethod: PROTECTED_V2_COMPLETE_CATALOG_AUDIT_METHOD,
        auditedAt: NOW.toISOString(),
        catalogAudit: arbitraryAudit,
        databaseEvidenceSha256: 'a'.repeat(64),
        expectedCatalog: LOCAL_EXPECTED_CATALOG,
        migration: PROTECTED_GOLD_IMPORT_CONTRACT_V2,
        readOnly: true,
        repeatableRead: true,
        repositoryCommitSha: HEAD,
        verifier: PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
        verifierExecuted: false,
      }),
    ).toThrow('does not match expected local_supabase_postgres_owner_v1/local context')
  })

  it('pins migration-only scope and separately executed redundant capture instances', () => {
    const authorization = buildProtectedV2Authorization({
      confirmation: PROTECTED_V2_CONFIRMATION,
      context: context(),
      operator: 'operator',
      requestedAt: NOW.toISOString(),
    })
    expect(authorization.authorizedCapability).toBe(PROTECTED_V2_AUTHORIZED_CAPABILITY)
    expect(authorization.forbiddenCapabilities).toEqual(PROTECTED_V2_FORBIDDEN_CAPABILITIES)
    expect(authorization.context.backups[0].backupInstanceId).not.toBe(
      authorization.context.backups[1].backupInstanceId,
    )
    expect(PROTECTED_V2_APPLICATION_REPORT_SCHEMA_VERSION).toBe(
      'literature-gold-protected-v2-application-result/3.0.0',
    )

    const identicalReceiptContext = context()
    identicalReceiptContext.backups[1].executionReceiptSha256 =
      identicalReceiptContext.backups[0].executionReceiptSha256
    expect(() =>
      buildProtectedV2Authorization({
        confirmation: PROTECTED_V2_CONFIRMATION,
        context: identicalReceiptContext,
        operator: 'operator',
        requestedAt: NOW.toISOString(),
      }),
    ).toThrow('separately executed')

    const identicalInstanceContext = context()
    identicalInstanceContext.backups[1].backupInstanceId =
      identicalInstanceContext.backups[0].backupInstanceId
    expect(() =>
      buildProtectedV2Authorization({
        confirmation: PROTECTED_V2_CONFIRMATION,
        context: identicalInstanceContext,
        operator: 'operator',
        requestedAt: NOW.toISOString(),
      }),
    ).toThrow('separately executed')

    const identicalNonceContext = context()
    identicalNonceContext.backups[1].executionNonce =
      identicalNonceContext.backups[0].executionNonce
    expect(() =>
      buildProtectedV2Authorization({
        confirmation: PROTECTED_V2_CONFIRMATION,
        context: identicalNonceContext,
        operator: 'operator',
        requestedAt: NOW.toISOString(),
      }),
    ).toThrow('separately executed')

    const wrongAttestationContext = context()
    ;(
      wrongAttestationContext as { separateCaptureAttestation: string }
    ).separateCaptureAttestation = 'wrong attestation'
    expect(() =>
      buildProtectedV2Authorization({
        confirmation: PROTECTED_V2_CONFIRMATION,
        context: wrongAttestationContext,
        operator: 'operator',
        requestedAt: NOW.toISOString(),
      }),
    ).toThrow('exact trusted-operator capture model and attestation')
  })

  it('accepts two separate redundant captures with identical data manifests but distinct instances', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'protected-v2-backups-'))
    cleanupDirectories.push(root)
    const first = await createBackupFixture({ name: 'one', nonceCharacter: 'a', root })
    const second = await createBackupFixture({ name: 'two', nonceCharacter: 'b', root })
    const verified = await Promise.all(
      [first.directory, second.directory].map((directory) =>
        verifyProtectedV2PreapplicationBackup({
          database: database(),
          directory,
          now: NOW,
          repository: repository(),
        }),
      ),
    )
    expect(verified[0]?.binding.canonicalManifestSha256).toBe(
      verified[1]?.binding.canonicalManifestSha256,
    )
    expect(verified[0]?.binding.backupInstanceId).not.toBe(verified[1]?.binding.backupInstanceId)
    expect(verified[0]?.binding.executionReceiptSha256).not.toBe(
      verified[1]?.binding.executionReceiptSha256,
    )
  })

  it('rejects a capture whose local duplicate-detection marker is missing', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'protected-v2-missing-marker-'))
    cleanupDirectories.push(root)
    const fixture = await createBackupFixture({ name: 'one', nonceCharacter: 'a', root })
    await rm(
      resolve(
        await realpath(root),
        PROTECTED_V2_BACKUP_DUPLICATE_MARKER_DIRECTORY,
        `${fixture.receipt.backupInstanceId}.json`,
      ),
    )
    await expect(
      verifyProtectedV2PreapplicationBackup({
        database: database(),
        directory: fixture.directory,
        now: NOW,
        repository: repository(),
      }),
    ).rejects.toThrow()
  })

  it.each([
    ['wrong manifest', 'checksum-manifest.sha256', 'corrupted manifest'],
    ['ledger drift', 'protected-migration-ledger.json', '{}'],
    ['unexpected file', 'unexpected.txt', 'unexpected'],
  ])('rejects accidental capture defect: %s', async (_label, filename, bytes) => {
    const root = await mkdtemp(resolve(tmpdir(), 'protected-v2-capture-defect-'))
    cleanupDirectories.push(root)
    const fixture = await createBackupFixture({ name: 'one', nonceCharacter: 'a', root })
    await writeFile(resolve(fixture.directory, filename), bytes, 'utf8')
    await expect(
      verifyProtectedV2PreapplicationBackup({
        database: database(),
        directory: fixture.directory,
        now: NOW,
        repository: repository(),
      }),
    ).rejects.toThrow()
  })

  it('rejects same-directory paths and realpath aliases', async () => {
    expect(() =>
      parseProtectedV2OperatorArguments([
        '--target',
        'local',
        '--operator',
        'operator',
        '--backup',
        '/same',
        '--backup',
        '/same',
      ]),
    ).toThrow('two distinct')
    const root = await mkdtemp(resolve(tmpdir(), 'protected-v2-alias-'))
    cleanupDirectories.push(root)
    const fixture = await createBackupFixture({ name: 'one', nonceCharacter: 'a', root })
    const alias = resolve(root, 'alias')
    await symlink(fixture.directory, alias)
    await expect(
      verifyProtectedV2PreapplicationBackup({
        database: database(),
        directory: alias,
        now: NOW,
        repository: repository(),
      }),
    ).rejects.toThrow('real directory')
  })

  it('rejects a copied backup directory retaining the original receipt', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'protected-v2-copy-'))
    cleanupDirectories.push(root)
    const fixture = await createBackupFixture({ name: 'one', nonceCharacter: 'a', root })
    const copied = resolve(root, 'copied')
    await cp(fixture.directory, copied, { recursive: true })
    await expect(
      verifyProtectedV2PreapplicationBackup({
        database: database(),
        directory: copied,
        now: NOW,
        repository: repository(),
      }),
    ).rejects.toThrow('outputDirectory does not match its realpath')
  })

  it('rejects outputDirectory editing with a stale instance identity', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'protected-v2-edit-'))
    cleanupDirectories.push(root)
    const fixture = await createBackupFixture({ name: 'one', nonceCharacter: 'a', root })
    const receiptPath = resolve(fixture.directory, 'execution-receipt.json')
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8')) as Record<string, unknown>
    receipt.outputDirectory = `${fixture.directory}-edited`
    await writeFile(receiptPath, canonicalJson(receipt), 'utf8')
    await expect(
      verifyProtectedV2PreapplicationBackup({
        database: database(),
        directory: fixture.directory,
        now: NOW,
        repository: repository(),
      }),
    ).rejects.toThrow('instance identity or receipt checksum is invalid')
  })

  it('accepts an honestly recomputed copy when the trusted operator also recomputes its local duplicate marker', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'protected-v2-recomputed-'))
    cleanupDirectories.push(root)
    const fixture = await createBackupFixture({ name: 'one', nonceCharacter: 'a', root })
    const copied = resolve(root, 'copied')
    await cp(fixture.directory, copied, { recursive: true })
    const original = parseProtectedV2BackupExecutionReceipt(
      await readFile(resolve(copied, 'execution-receipt.json'), 'utf8'),
    )
    const projection = { ...original } as Record<string, unknown>
    delete projection.backupInstanceId
    delete projection.contentSha256
    const recomputed = buildProtectedV2BackupExecutionReceipt(
      {
        ...(projection as unknown as Parameters<typeof buildProtectedV2BackupExecutionReceipt>[0]),
        outputDirectory: await realpath(copied),
      },
      { operatorBundle: repository().operatorBundle },
    )
    const recomputedBytes = canonicalJson(recomputed)
    await writeFile(resolve(copied, 'execution-receipt.json'), recomputedBytes, 'utf8')
    const markerDirectory = resolve(
      await realpath(root),
      PROTECTED_V2_BACKUP_DUPLICATE_MARKER_DIRECTORY,
    )
    const marker = buildProtectedV2BackupDuplicateMarker(recomputed, sha256(recomputedBytes))
    await writeFile(
      resolve(markerDirectory, `${recomputed.backupInstanceId}.json`),
      canonicalJson(marker),
      'utf8',
    )
    await expect(
      verifyProtectedV2PreapplicationBackup({
        database: database(),
        directory: copied,
        now: NOW,
        repository: repository(),
      }),
    ).resolves.toMatchObject({ binding: { backupInstanceId: recomputed.backupInstanceId } })
    expect(PROTECTED_V2_BACKUP_TRUST_MODEL).toBe('trusted-local-operator-redundant-captures/1.0.0')
    expect(PROTECTED_V2_SEPARATE_CAPTURE_ATTESTATION).toBe(
      'I ATTEST THESE ARE TWO SEPARATE READ-ONLY BACKUP CAPTURES',
    )
  })

  it('still rejects stale backup age and current state drift', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'protected-v2-stale-'))
    cleanupDirectories.push(root)
    const fixture = await createBackupFixture({ name: 'one', nonceCharacter: 'a', root })
    await expect(
      verifyProtectedV2PreapplicationBackup({
        database: database(),
        directory: fixture.directory,
        now: new Date(NOW.getTime() + 3 * 60 * 60 * 1000),
        repository: repository(),
      }),
    ).rejects.toThrow('stale or unsafe')
    const drifted = database()
    drifted.effectiveStateSha256 = '3'.repeat(64)
    await expect(
      verifyProtectedV2PreapplicationBackup({
        database: drifted,
        directory: fixture.directory,
        now: NOW,
        repository: repository(),
      }),
    ).rejects.toThrow()
    await expect(
      verifyProtectedV2PreapplicationBackup({
        database: database(),
        directory: fixture.directory,
        now: NOW,
        repository: repository('2'.repeat(40)),
      }),
    ).rejects.toThrow()
  })

  it('preserves immutable intent bytes while atomically adding a finalized subpackage', async () => {
    const cwd = await realpath(await mkdtemp(resolve(tmpdir(), 'protected-v2-intent-')))
    cleanupDirectories.push(cwd)
    const authorization = buildProtectedV2Authorization({
      confirmation: PROTECTED_V2_CONFIRMATION,
      context: context(),
      operator: 'operator',
      requestedAt: NOW.toISOString(),
    })
    const output = resolve(
      cwd,
      'local-data/literature/protected-v2-application-receipts/application-one',
    )
    const sealed = await sealProtectedV2ApplicationIntent({
      authorization,
      before: database(false),
      beforeCaptures: [database(false), database(false)],
      cwd,
      output,
      repository: repository(),
    })
    const originalBytes = await readFile(resolve(output, 'application-intent.json'), 'utf8')
    expect(
      (await loadProtectedV2ApplicationIntentPackage({ cwd, output })).completed,
    ).toBeUndefined()
    await finalizeProtectedV2ApplicationReceipt({
      after: database(true),
      cwd,
      intentCommitIsAncestor: true,
      intentPackage: sealed,
      migrationApplicationCallCount: 1,
      now: NOW,
      postApplicationAudit: postApplicationAudit(),
      receiptReconciled: false,
      reconciliationReason: null,
      repository: repository(),
    })
    const loaded = await loadProtectedV2ApplicationIntentPackage({ cwd, output })
    expect(await readFile(resolve(output, 'application-intent.json'), 'utf8')).toBe(originalBytes)
    expect(loaded.completed?.result).toMatchObject({
      migrationApplied: true,
      receiptReconciled: false,
      safety: { compensationAuthorized: false, importAuthorized: false },
    })
  })
})
