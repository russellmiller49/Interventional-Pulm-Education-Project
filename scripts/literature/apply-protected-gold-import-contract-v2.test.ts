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
import {
  DEFAULT_LOCAL_DATABASE_CONTAINER,
  LOCAL_DATABASE_PORT,
  LOCAL_SUPABASE_PROJECT_ID,
  canonicalJson,
  type CommandRunner,
} from './gold-import-compensation-migration-operations'
import {
  REQUIRED_TRANSITION_RPCS_V1,
  REQUIRED_TRANSITION_RPCS_V2,
  REQUIRED_V2_SEMANTIC_FUNCTIONS,
} from './gold-import-compensation-rehearsal-evidence-v2'
import {
  PROTECTED_V2_APPLICATION_INTENT_SCHEMA_VERSION,
  PROTECTED_V2_BACKUP_INSTANCE_WITNESS_DIRECTORY,
  PROTECTED_V2_BACKUP_RECEIPT_SCHEMA_VERSION,
  buildProtectedV2ApplicationExecutionReceipt,
  buildProtectedV2ApplicationIntent,
  buildProtectedV2ApplicationResult,
  buildProtectedV2BackupExecutionReceipt,
  buildProtectedV2BackupInstanceWitness,
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
  PROTECTED_V2_CONFIRMATION,
  PROTECTED_V2_FORBIDDEN_CAPABILITIES,
  buildProtectedV2Authorization,
  validateProtectedV2Authorization,
  type ProtectedV2AuthorizationContext,
  type ProtectedV2BackupBinding,
} from './protected-gold-import-contract-v2'
import {
  V2_SEMANTIC_FUNCTION_CONTRACTS,
  V2_SEMANTIC_FUNCTION_RAW_DEFINITION_SHA256,
} from './rehearse-gold-import-compensation-db-v2'

const HEAD = '1111111111111111111111111111111111111111'
const NOW = new Date('2026-08-09T20:00:00.000Z')
const ROW_IDENTITIES = {
  pointerStateSha256: '4'.repeat(64),
  revealStateSha256: '5'.repeat(64),
  reviewStateSha256: '6'.repeat(64),
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function repository(head = HEAD): ProtectedV2RepositoryEvidence {
  return {
    branch: 'main',
    head,
    originMain: head,
    statusCleanIncludingUntracked: true,
  }
}

function database(applied = false): ProtectedV2DatabaseEvidence {
  return {
    actionCount: 0,
    batchId: '10000000-0000-4000-8000-000000000001',
    compensationCount: 0,
    ...GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2,
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
    ...ROW_IDENTITIES,
    readOnlyBracketMatches: true,
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
    repository: repository(),
    safety: { heldOutIdentitiesAccessed: false, remoteDatabaseAccessed: false },
  }
}

function postApplicationAudit(after = database(true)) {
  return buildProtectedV2PostApplicationAudit({
    auditedAt: NOW.toISOString(),
    databaseEvidenceSha256: sha256(canonicalJson(after)),
    migration: PROTECTED_GOLD_IMPORT_CONTRACT_V2,
    readOnly: true,
    repeatableRead: true,
    repositoryCommitSha: HEAD,
    rpcMetadataSha256: '7'.repeat(64),
    semanticFunctionMetadataSha256: '8'.repeat(64),
    triggerMetadataSha256: '9'.repeat(64),
    verifier: PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
  })
}

function rpcMetadataFixture() {
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
      owner: 'postgres',
      publicExecute: false,
      resultType: 'jsonb',
      searchPath: 'pg_catalog, public, extensions',
      securityDefiner: true,
      serviceRoleExecute: true,
      volatility: name.startsWith('reconcile_') ? 's' : 'v',
    })),
  }
}

function semanticMetadataFixture() {
  return {
    functions: REQUIRED_V2_SEMANTIC_FUNCTIONS.map((name) => ({
      anonExecute: false,
      authenticatedExecute: false,
      ...V2_SEMANTIC_FUNCTION_CONTRACTS[name],
      name,
      owner: 'postgres',
      publicExecute: false,
      rawDefinitionSha256: V2_SEMANTIC_FUNCTION_RAW_DEFINITION_SHA256[name],
    })),
  }
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
        before: input.intentPackage.intent.before,
        migrationApplicationCallCount: input.migrationApplicationCallCount,
        operatorAuthorizationSha256: input.intentPackage.intent.authorizationSha256,
        originalIntentSha256: input.intentPackage.intentSha256,
        postApplicationAudit: input.postApplicationAudit,
        receiptReconciled: input.receiptReconciled,
        reconciliationReason: input.reconciliationReason,
        repository: input.repository,
      })
      const resultBytes = canonicalJson(result)
      const executionReceipt = buildProtectedV2ApplicationExecutionReceipt({
        canonicalManifestSha256: 'a'.repeat(64),
        compensationAuthorized: false,
        executedAt: NOW.toISOString(),
        heldOutIdentitiesAccessed: false,
        importAuthorized: false,
        migrationApplied: true,
        migrationApplicationCallCount: input.migrationApplicationCallCount,
        migrationId: PROTECTED_GOLD_IMPORT_CONTRACT_V2.id,
        migrationReexecuted: false,
        migrationSha256: PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256,
        operatorAuthorizationSha256: input.intentPackage.intent.authorizationSha256,
        originalIntentSha256: input.intentPackage.intentSha256,
        outputDirectory: input.intentPackage.outputDirectory,
        postApplicationAuditSha256: input.postApplicationAudit.auditIdentitySha256,
        receiptReconciled: input.receiptReconciled,
        reconciliationReason: input.reconciliationReason,
        remoteDatabaseAccessed: false,
        repositoryCommitSha: HEAD,
        resultSha256: sha256(resultBytes),
      })
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
    loadIntentPackage: async () => {
      if (!state.intentPackage) throw new Error('sealed intent absent')
      return {
        ...state.intentPackage,
        ...(state.completed ? { completed: state.completed } : {}),
      } satisfies ProtectedV2LoadedIntentPackage
    },
    now: () => state.now,
    sealIntent: async ({ authorization, before, output, repository: repositoryEvidence }) => {
      state.events.push('seal')
      if (state.fail === 'output') throw new Error('application intent creation failed')
      state.counters.seal += 1
      const intent = buildProtectedV2ApplicationIntent({
        authorization,
        before,
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
      return directory.endsWith('one') ? backup(directory, 'a') : backup(directory, 'b')
    },
    verifyPostApplication: async ({ after }) => {
      state.events.push('audit')
      state.counters.audit += 1
      return postApplicationAudit(after)
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
        schemaVersion: 'gold-import-contract-v2-preapplication-report/1.0.0',
        repository: repository(),
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
    ['state-hashes.json', canonicalJson(GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2)],
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
  const receipt = buildProtectedV2BackupExecutionReceipt({
    backupRoot,
    canonicalManifestSha256: sha256(manifest),
    database: {
      batchId: database().batchId,
      datasetSplit: 'development',
      ...GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2,
    },
    executedAt: NOW.toISOString(),
    executionNonce: input.nonceCharacter.repeat(64),
    migrationLedger: {
      sha256: sha256(ledgerBytes),
      v1: { ...PROTECTED_GOLD_IMPORT_CONTRACT_V1, occurrence: 1 },
      v2: { ...PROTECTED_GOLD_IMPORT_CONTRACT_V2, occurrence: 0 },
    },
    outputDirectory,
    repositoryCommitSha: HEAD,
    safety: {
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      remoteDatabaseAccessed: false,
    },
    schemaVersion: PROTECTED_V2_BACKUP_RECEIPT_SCHEMA_VERSION,
  })
  const receiptBytes = canonicalJson(receipt)
  await writeFile(resolve(directory, 'execution-receipt.json'), receiptBytes, 'utf8')
  const witnessDirectory = resolve(backupRoot, PROTECTED_V2_BACKUP_INSTANCE_WITNESS_DIRECTORY)
  await mkdir(witnessDirectory, { recursive: true })
  const witness = buildProtectedV2BackupInstanceWitness(receipt, sha256(receiptBytes))
  await writeFile(
    resolve(witnessDirectory, `${receipt.backupInstanceId}.json`),
    canonicalJson(witness),
    'utf8',
  )
  return { directory, manifest, receipt }
}

describe('protected V2 migration operator recovery boundary', () => {
  const cleanupDirectories: string[] = []

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
        '--output',
        '/receipt',
        '--commit',
      ]).mode,
    ).toBe('commit')
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
    ).toThrow('forbids --commit, --confirmation, and --backup')
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

  it('collects the committed post-application contract audit only through read-only repeatable-read queries', async () => {
    const outputs = [
      rpcMetadataFixture(),
      semanticMetadataFixture(),
      {
        isolation: 'repeatable read',
        readOnly: true,
        triggers: [
          {
            enabled: 'O',
            function: 'enforce_literature_gold_operation_contract_v2',
            name: 'enforce_literature_gold_operation_contract_v2',
            table: 'literature_gold_review_operations',
          },
          {
            enabled: 'O',
            function: 'enforce_literature_gold_review_contract_v2',
            name: 'enforce_literature_gold_review_contract_v2',
            table: 'literature_gold_set_reviews',
          },
        ],
      },
    ]
    const statements: string[] = []
    let outputIndex = 0
    const runCommand: CommandRunner = async (command, _arguments, options) => {
      expect(command).toBe('docker')
      statements.push(options?.stdin ?? '')
      return { stderr: '', stdout: `${JSON.stringify(outputs[outputIndex++])}\n` }
    }
    const after = database(true)
    const audit = await collectProtectedV2PostApplicationAudit({
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
    })
    expect(statements).toHaveLength(3)
    for (const statement of statements) {
      expect(statement).toMatch(/^begin transaction isolation level repeatable read read only;/u)
      expect(statement).toMatch(/rollback;$/u)
      expect(statement).not.toContain('migration up')
    }
    expect(audit).toMatchObject({
      databaseEvidenceSha256: sha256(canonicalJson(after)),
      readOnly: true,
      repeatableRead: true,
      verifier: PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
    })
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

  it('pins migration-only scope and independent backup instances', () => {
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
      'literature-gold-protected-v2-application-result/1.0.0',
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
    ).toThrow('independently executed')

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
    ).toThrow('independently executed')
  })

  it('accepts two independent backups with identical data manifests but distinct instances', async () => {
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
    expect(verified[0]?.canonicalManifestSha256).toBe(verified[1]?.canonicalManifestSha256)
    expect(verified[0]?.backupInstanceId).not.toBe(verified[1]?.backupInstanceId)
    expect(verified[0]?.executionReceiptSha256).not.toBe(verified[1]?.executionReceiptSha256)
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

  it('rejects a recomputed copied receipt without a genuine diagnostic witness', async () => {
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
    const recomputed = buildProtectedV2BackupExecutionReceipt({
      ...(projection as unknown as Parameters<typeof buildProtectedV2BackupExecutionReceipt>[0]),
      outputDirectory: await realpath(copied),
    })
    await writeFile(resolve(copied, 'execution-receipt.json'), canonicalJson(recomputed), 'utf8')
    await expect(
      verifyProtectedV2PreapplicationBackup({
        database: database(),
        directory: copied,
        now: NOW,
        repository: repository(),
      }),
    ).rejects.toThrow()
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
