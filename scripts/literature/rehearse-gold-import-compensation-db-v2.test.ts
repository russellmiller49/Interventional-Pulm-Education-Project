import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

import {
  HISTORICAL_LITERATURE_MIGRATIONS,
  REQUIRED_V2_SEMANTIC_FUNCTIONS,
  V2_CANONICAL_EVIDENCE_SCHEMA_VERSION,
} from './gold-import-compensation-rehearsal-evidence-v2'
import {
  DEVELOPMENT_DATABASE_SEED_SCHEMA_VERSION,
  DISPOSABLE_POSTGRES_IMAGE,
  type DevelopmentDatabaseSeed,
  type DisposableContainerCleanupOutcome,
} from './rehearse-exact-gold-import-compensation-package-v1'
import {
  V2_REHEARSAL_MIGRATIONS,
  V2_RPC_METADATA_SQL,
  V2_SEMANTIC_FUNCTION_CONTRACTS,
  V2_SEMANTIC_FUNCTION_METADATA_SQL,
  V2_SEMANTIC_FUNCTION_RAW_DEFINITION_SHA256,
  assertDeterministicV2RehearsalRuns,
  buildV2MigrationPathPlan,
  collectProjectedFreshProtectedV2BeforeEvidence,
  parseV2MigrationPath,
  postgresOwnerProjectionSql,
  protectedV2CompleteCatalogOwnerProjectionSql,
  renderPostV2CompatibleDevelopmentSeedSqlV2,
  resolveV2LocalDockerEndpoint,
  executeV2DisposablePath,
  v2DevelopmentPlanningSnapshotSql,
  v2SchemaOnlySnapshotSql,
  validateV2SemanticFunctionMetadata,
  type V2DisposablePathResult,
} from './rehearse-gold-import-compensation-db-v2'
import { LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY } from './literature-gold-v2-schema-only-transition'
import { PROTECTED_V2_TRANSITION_SNAPSHOT_SCHEMA_VERSION } from './protected-gold-import-contract-v2-transition-evidence'
import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
} from './protected-gold-import-contract-v2-source-identities'
import {
  V2_CANONICAL_SEMANTIC_FUNCTION_CONTRACTS,
  V2_CANONICAL_SEMANTIC_FUNCTION_RAW_DEFINITION_SHA256,
} from './gold-import-compensation-v2-semantic-function-identities'
import type { DisposableRuntime } from './rehearse-exact-gold-import-compensation-package-v1'

const MIGRATION_V1 = '20260808035633_add_literature_gold_import_compensation_contract.sql'
const MIGRATION_V2 = '20260809231651_add_literature_gold_import_compensation_contract_v2.sql'

function cleanup(): DisposableContainerCleanupOutcome {
  return {
    absenceChecks: [
      { identifier: 'owned-container', kind: 'exact_name', present: false },
      { identifier: 'a'.repeat(64), kind: 'container_id', present: false },
    ],
    absenceVerification: 'verified_absent',
    attempted: true,
    containerId: 'a'.repeat(64),
    containerName: 'owned-container',
    errors: [],
    outcome: 'removed_and_verified_absent',
    removalCommandSucceeded: true,
  }
}

function pathResult(bytes = Buffer.from('{"passed":true}\n')): V2DisposablePathResult {
  return {
    canonicalArtifacts: new Map([
      ['canonical-manifest.sha256', Buffer.from(`${'a'.repeat(64)}  evidence.json\n`)],
      ['evidence.json', bytes],
    ]),
    cleanup: cleanup(),
    evidenceAuthority: 'canonical_delivery_evidence',
    migrationPath: 'fresh',
    migrationSha256: 'b'.repeat(64),
    rawReceipt: {},
    schemaOnlyTransition: {} as V2DisposablePathResult['schemaOnlyTransition'],
  }
}

describe('V2 rehearsal delivery/probe API separation', () => {
  it('rejects an unbound production execution before any Docker runtime is reached', async () => {
    await expect(
      executeV2DisposablePath({
        exactPackageExecutor: { execute: async () => ({}) as never },
        migrationPath: 'fresh',
        seed: {} as DevelopmentDatabaseSeed,
      } as never),
    ).rejects.toThrow('requires exact A/B authorization bindings')
  })

  it('limits the transient catalog-probe API to its definition and drift-matrix caller', () => {
    const symbol = ['executeV2Disposable', 'CatalogProbePath'].join('')
    const paths = execFileSync('git', ['grep', '-l', symbol, '--', 'scripts/literature/*.ts'], {
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter((path) => path && !path.endsWith('.test.ts'))
      .sort()
    expect(paths).toEqual([
      'scripts/literature/rehearse-gold-import-compensation-db-v2.ts',
      'scripts/literature/rehearse-gold-import-contract-v2-catalog-drift-matrix.ts',
    ])
  })

  it('limits the expectation-proposal API to its definition and maintainer generator caller', () => {
    const symbol = ['executeV2Disposable', 'CatalogExpectationProposalPath'].join('')
    const paths = execFileSync('git', ['grep', '-l', symbol, '--', 'scripts/literature/*.ts'], {
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter((path) => path && !path.endsWith('.test.ts'))
      .sort()
    expect(paths).toEqual([
      'scripts/literature/generate-gold-import-contract-v2-catalog-expectations.ts',
      'scripts/literature/rehearse-gold-import-compensation-db-v2.ts',
    ])
  })
})

interface SemanticMetadataFixtureFunction {
  anonExecute: boolean
  authenticatedExecute: boolean
  identityArguments: string
  name: string
  owner: string
  publicExecute: boolean
  rawDefinitionSha256: string
  resultType: string
  searchPath: string
  securityDefiner: boolean
  serviceRoleExecute: boolean
  volatility: string
}

function semanticMetadata(owner: 'postgres' | 'supabase_admin'): {
  functions: SemanticMetadataFixtureFunction[]
} {
  return {
    functions: REQUIRED_V2_SEMANTIC_FUNCTIONS.map((name) => ({
      anonExecute: false,
      authenticatedExecute: false,
      ...V2_SEMANTIC_FUNCTION_CONTRACTS[name],
      name,
      owner,
      publicExecute: false,
      rawDefinitionSha256: V2_SEMANTIC_FUNCTION_RAW_DEFINITION_SHA256[name],
    })),
  }
}

function preV1SeedFixture(): DevelopmentDatabaseSeed {
  const batchId = '00000000-0000-4000-8000-000000000001'
  const itemId = '00000000-0000-4000-8000-000000000002'
  const reviewId = '00000000-0000-4000-8000-000000000003'
  return {
    batchId,
    datasetSplit: 'development',
    heldOutIdentitiesIncluded: false,
    schemaVersion: DEVELOPMENT_DATABASE_SEED_SCHEMA_VERSION,
    tables: {
      literature_articles: [{ pmid: '1' }],
      literature_gold_set_batches: [{ id: batchId }],
      literature_gold_set_events: [
        {
          batch_id: batchId,
          event_type: 'review_completed',
          id: '00000000-0000-4000-8000-000000000004',
          item_id: itemId,
        },
      ],
      literature_gold_set_items: [
        {
          batch_id: batchId,
          current_review_id: reviewId,
          dataset_split: 'development',
          id: itemId,
          pmid: '1',
        },
      ],
      literature_gold_set_review_drafts: [],
      literature_gold_set_reviews: [
        { id: reviewId, item_id: itemId, revision: 1, supersedes_review_id: null },
      ],
    },
  }
}

function postV2TransitionSnapshotFixture(): Record<string, unknown> {
  const batchId = LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.batchId
  const itemId = '00000000-0000-4000-8000-000000000002'
  const reviewId = '00000000-0000-4000-8000-000000000003'
  return {
    actionCount: 0,
    batchId,
    compensationCount: 0,
    developmentMembershipSha256: '1'.repeat(64),
    effectiveStateSha256V1: '2'.repeat(64),
    effectiveStateSha256V2: '3'.repeat(64),
    historyRows: {
      actions: [],
      batchId,
      batches: [{ id: batchId, name: 'gold-set-v1' }],
      datasetSplit: 'development',
      drafts: [],
      events: [],
      items: [
        {
          automated_signals_revealed_at: null,
          batch_id: batchId,
          completed_at: null,
          current_review_id: reviewId,
          dataset_split: 'development',
          display_order: 1,
          id: itemId,
          pmid: '1',
          review_status: 'completed',
          started_at: null,
          supplemental_metadata_revealed_at: null,
        },
      ],
      operations: [],
      reviews: [
        {
          effective_source_review_id: null,
          full_text_used: null,
          id: reviewId,
          item_id: itemId,
          lifecycle_state: 'effective',
          operation_contract_version: null,
          operation_contract_version_code: 1,
          revision: 1,
          revision_kind: 'standard',
        },
      ],
    },
    importCount: 0,
    ledgerEntries: [
      {
        name: PROTECTED_GOLD_IMPORT_CONTRACT_V1.migrationName,
        version: PROTECTED_GOLD_IMPORT_CONTRACT_V1.version,
      },
      {
        name: PROTECTED_GOLD_IMPORT_CONTRACT_V2.migrationName,
        version: PROTECTED_GOLD_IMPORT_CONTRACT_V2.version,
      },
    ],
    operationCount: 0,
    phase: 'after_v2',
    physicalStateSha256V1: '4'.repeat(64),
    physicalStateSha256V2: '5'.repeat(64),
    readOnlyTransaction: true,
    schemaVersion: PROTECTED_V2_TRANSITION_SNAPSHOT_SCHEMA_VERSION,
  }
}

describe('V2 disposable database rehearsal runner', () => {
  test('keeps full-schema fresh projection distinct from the true V1-to-V2 upgrade', () => {
    expect(parseV2MigrationPath('fresh')).toBe('fresh')
    expect(parseV2MigrationPath('upgrade')).toBe('upgrade')
    expect(() => parseV2MigrationPath('both')).toThrow('fresh or upgrade')
    expect(() => parseV2MigrationPath(undefined)).toThrow('fresh or upgrade')

    const fresh = buildV2MigrationPathPlan('fresh')
    const upgrade = buildV2MigrationPathPlan('upgrade')
    expect(fresh.migrationsBeforeSeed).toEqual(V2_REHEARSAL_MIGRATIONS)
    expect(fresh.migrationsToReachV1AfterSeed).toEqual([])
    expect(fresh.migrationsFromV1ToV2).toEqual([])
    expect(fresh.requiresAcceptedV1UpgradeBracket).toBe(false)
    expect(fresh.seedMode).toBe('migration_equivalent_post_v2_projection')
    expect(upgrade.migrationsBeforeSeed).toEqual(HISTORICAL_LITERATURE_MIGRATIONS)
    expect(upgrade.migrationsBeforeSeed).not.toContain(MIGRATION_V1)
    expect(upgrade.migrationsBeforeSeed).not.toContain(MIGRATION_V2)
    expect(upgrade.migrationsToReachV1AfterSeed).toEqual([MIGRATION_V1])
    expect(upgrade.migrationsFromV1ToV2).toEqual([MIGRATION_V2])
    expect(upgrade.requiresAcceptedV1UpgradeBracket).toBe(true)
    expect(upgrade.seedMode).toBe('exact_pre_v1')
    expect(V2_REHEARSAL_MIGRATIONS.filter((name) => name === MIGRATION_V1)).toHaveLength(1)
    expect(V2_REHEARSAL_MIGRATIONS.filter((name) => name === MIGRATION_V2)).toHaveLength(1)
  })

  test('renders only explicit migration-equivalent V1/V2 values for a fresh seed', () => {
    const seed = preV1SeedFixture()
    const sql = renderPostV2CompatibleDevelopmentSeedSqlV2(seed)
    expect(renderPostV2CompatibleDevelopmentSeedSqlV2(seed)).toBe(sql)
    expect(sql).toContain("set local session_replication_role = 'replica'")
    expect(sql).toContain("'standard'::text")
    expect(sql).toContain("'effective'::text")
    expect(sql).toContain('null::boolean')
    expect(sql).toContain('1::smallint')
    expect(sql).toContain('"operation_event_sequence"')
    expect(sql).toContain("attribute.attgenerated = ''")
    const reviewInsert = sql
      .split('\n')
      .find((line) => line.startsWith('insert into public.literature_gold_set_reviews'))
    expect(reviewInsert).toContain('"operation_contract_version_code"')
    expect(reviewInsert).not.toContain('"operation_contract_version",')

    const suppliedMigrationColumn = JSON.parse(JSON.stringify(seed)) as DevelopmentDatabaseSeed
    suppliedMigrationColumn.tables.literature_gold_set_reviews[0]!.revision_kind = 'standard'
    expect(() => renderPostV2CompatibleDevelopmentSeedSqlV2(suppliedMigrationColumn)).toThrow(
      'supplied a migration-derived column',
    )

    const inconsistentRows = JSON.parse(JSON.stringify(seed)) as DevelopmentDatabaseSeed
    inconsistentRows.tables.literature_gold_set_reviews.push({
      id: '00000000-0000-4000-8000-000000000005',
      item_id: seed.tables.literature_gold_set_items[0]!.id,
      revision: 2,
    })
    expect(() => renderPostV2CompatibleDevelopmentSeedSqlV2(inconsistentRows)).toThrow(
      'do not share one exact column set',
    )
  })

  test('uses the same pinned Supabase PostgreSQL image as the hardened V1 runner', () => {
    expect(DISPOSABLE_POSTGRES_IMAGE).toBe(
      'public.ecr.aws/supabase/postgres:17.6.1.104@sha256:5deba92e50cd17bfacf8603834d317cdf3bfc1c016ec8293991997fa3b55fa3d',
    )
  })

  test('refuses remote or ambiguous Docker routing before container creation', async () => {
    const commands: string[][] = []
    const runtime = (environment: Record<string, string | undefined>, endpoint: string) =>
      ({
        command: async (_command: string, arguments_: string[]) => {
          commands.push(arguments_)
          if (arguments_[0] === 'context' && arguments_[1] === 'show') {
            return { stderr: '', stdout: 'desktop-linux\n' }
          }
          return { stderr: '', stdout: `${JSON.stringify(endpoint)}\n` }
        },
        environment,
        now: () => '2030-01-01T00:00:00.000Z',
      }) satisfies DisposableRuntime

    await expect(
      resolveV2LocalDockerEndpoint(
        runtime({ DOCKER_CONTEXT: 'remote', DOCKER_HOST: 'unix:///local/docker.sock' }, ''),
      ),
    ).rejects.toThrow('Ambiguous Docker')
    expect(commands).toEqual([])

    await expect(
      resolveV2LocalDockerEndpoint(runtime({}, 'tcp://remote.example.invalid:2376')),
    ).rejects.toThrow('requires a local Docker socket')
    expect(commands.some((arguments_) => arguments_[0] === 'run')).toBe(false)

    await expect(
      resolveV2LocalDockerEndpoint(runtime({}, 'unix:///var/run/docker.sock')),
    ).resolves.toEqual({
      context: 'desktop-linux',
      endpoint: 'unix:///var/run/docker.sock',
    })
  })

  test('brackets all protected V1 state with ordered, V2-column-independent projections', () => {
    const sql = v2SchemaOnlySnapshotSql('00000000-0000-4000-8000-000000000001')
    for (const field of [
      'effectiveStateSha256V1',
      'physicalStateSha256V1',
      'membershipSha256',
      'reviewRowsSha256',
      'pointerStateSha256',
      'automatedRevealStateSha256',
      'supplementalRevealStateSha256',
    ]) {
      expect(sql).toContain(`'${field}'`)
    }
    expect(sql).toContain("- 'operation_contract_version_code'")
    expect(sql).toContain('order by review.item_id, review.revision, review.id')
    expect(sql).toContain('order by item.display_order, item.id')
    expect(sql).toContain("dataset_split = 'development'")
    expect(sql).not.toContain("dataset_split = 'test'")
    expect(() => v2SchemaOnlySnapshotSql('not-a-uuid')).toThrow('Invalid development batch ID')

    const planningSql = v2DevelopmentPlanningSnapshotSql('00000000-0000-4000-8000-000000000001')
    expect(planningSql).toContain("'developmentItems'")
    expect(planningSql).toContain('order by item.display_order, item.id')
    expect(planningSql).toContain('order by review.revision, review.id')
    expect(planningSql).toContain('order by event.created_at, event.id')
    expect(planningSql).toContain("dataset_split = 'development'")
    expect(planningSql).not.toContain("dataset_split = 'test'")
    expect(() => v2DevelopmentPlanningSnapshotSql('not-a-uuid')).toThrow(
      'Invalid development batch ID',
    )
  })

  test('introspects the exact V1/V2 transition ACLs and all V2 semantic functions', () => {
    for (const name of [
      'apply_literature_gold_import_v1',
      'compensate_literature_gold_import_v1',
      'reconcile_literature_gold_review_operation_v1',
      'apply_literature_gold_import_v2',
      'compensate_literature_gold_import_v2',
      'reconcile_literature_gold_review_operation_v2',
    ]) {
      expect(V2_RPC_METADATA_SQL).toContain(`('${name}')`)
    }
    for (const name of REQUIRED_V2_SEMANTIC_FUNCTIONS) {
      expect(V2_SEMANTIC_FUNCTION_METADATA_SQL).toContain(`('${name}')`)
    }
    expect(V2_RPC_METADATA_SQL).toContain("pg_catalog.has_function_privilege('anon'")
    expect(V2_RPC_METADATA_SQL).toMatch(/pg_catalog\.has_function_privilege\(\s*'authenticated'/u)
    expect(V2_RPC_METADATA_SQL).toContain("pg_catalog.has_function_privilege('service_role'")
  })

  test.each(['supabase_admin', 'postgres'] as const)(
    'accepts only safe V2 helper owner/search-path/security metadata for %s',
    (owner) => {
      expect(validateV2SemanticFunctionMetadata(semanticMetadata(owner), owner)).toHaveLength(13)
      const unsafe = semanticMetadata(owner)
      unsafe.functions[3] = { ...unsafe.functions[3], searchPath: 'public' }
      expect(() => validateV2SemanticFunctionMetadata(unsafe, owner)).toThrow(
        'Unsafe or changed metadata',
      )

      const missingReceipt = semanticMetadata(owner)
      missingReceipt.functions = missingReceipt.functions.filter(
        ({ name }) => name !== 'literature_gold_review_operation_receipt_v2',
      )
      expect(() => validateV2SemanticFunctionMetadata(missingReceipt, owner)).toThrow(
        'function set changed',
      )

      const unsafeAcl = semanticMetadata(owner)
      unsafeAcl.functions[0] = { ...unsafeAcl.functions[0], authenticatedExecute: true }
      expect(() => validateV2SemanticFunctionMetadata(unsafeAcl, owner)).toThrow(
        'Unsafe or changed metadata',
      )

      const changedBody = semanticMetadata(owner)
      changedBody.functions[0] = {
        ...changedBody.functions[0],
        rawDefinitionSha256: '0'.repeat(64),
      }
      expect(() => validateV2SemanticFunctionMetadata(changedBody, owner)).toThrow(
        'Unsafe or changed metadata',
      )
    },
  )

  test('keeps canonical backup verifier identities equal to the disposable runner identities', () => {
    expect(V2_CANONICAL_SEMANTIC_FUNCTION_RAW_DEFINITION_SHA256).toEqual(
      V2_SEMANTIC_FUNCTION_RAW_DEFINITION_SHA256,
    )
    for (const name of REQUIRED_V2_SEMANTIC_FUNCTIONS) {
      const { identityArguments: _identityArguments, ...runnerContract } =
        V2_SEMANTIC_FUNCTION_CONTRACTS[name]
      void _identityArguments
      expect(V2_CANONICAL_SEMANTIC_FUNCTION_CONTRACTS[name]).toEqual(runnerContract)
    }
  })

  test('authenticates the supported postgres owner profile inside a rolled-back catalog projection', () => {
    const sql = postgresOwnerProjectionSql(V2_RPC_METADATA_SQL)
    expect(sql).toMatch(/^begin;/u)
    expect(sql).toContain(
      'alter function public.apply_literature_gold_import_v2(uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text) owner to postgres;',
    )
    expect(sql).toContain(
      'alter function public.reconcile_literature_gold_review_operation_v1(uuid, text, jsonb) owner to postgres;',
    )
    for (const name of REQUIRED_V2_SEMANTIC_FUNCTIONS) {
      expect(sql).toContain(`alter function public.${name}(`)
    }
    expect(sql).toMatch(/rollback;$/u)
    expect(() =>
      postgresOwnerProjectionSql('alter function public.forbidden() owner to postgres;'),
    ).toThrow('fixed read-only introspection')
  })

  test('projects and exactly restores every complete-catalog owner in the disposable database', () => {
    const local = protectedV2CompleteCatalogOwnerProjectionSql('postgres')
    const restored = protectedV2CompleteCatalogOwnerProjectionSql('supabase_admin')
    expect(local).toContain("pg_catalog.format('alter table public.%I owner to postgres'")
    expect(local).toContain("pg_catalog.format('alter function %s owner to postgres'")
    expect(restored).toContain("pg_catalog.format('alter table public.%I owner to supabase_admin'")
    expect(restored).toContain("pg_catalog.format('alter function %s owner to supabase_admin'")
    expect(restored).toContain(
      "pg_catalog.format('revoke all privileges on table public.%I from postgres'",
    )
    expect(restored).toContain(
      "pg_catalog.format('revoke all privileges on function %s from postgres'",
    )
    expect(local).not.toContain('revoke all privileges')
    expect(local).toContain("('literature_gold_review_operations')")
    expect(local).toContain("('literature_gold_physical_state_hash_v2')")
    expect(local).toMatch(/^do \$protected_v2_transition_owner_projection\$/u)
    expect(restored).toMatch(/\$protected_v2_transition_owner_projection\$;$/u)
  })

  test('rebuilds a full pre-V2 fresh-path capture from two identical read-only raw snapshots', async () => {
    const snapshot = postV2TransitionSnapshotFixture()
    const queryJson = jest.fn().mockResolvedValue(snapshot)
    const evidence = await collectProjectedFreshProtectedV2BeforeEvidence(queryJson)

    expect(queryJson).toHaveBeenCalledTimes(2)
    expect(evidence).toMatchObject({
      batchId: LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.batchId,
      completeCatalogAudit: null,
      effectiveStateSha256V2: null,
      physicalStateSha256V2: null,
      readOnlyBracketMatches: true,
      v1Occurrence: 1,
      v2Occurrence: 0,
    })
    expect(evidence.history.phase).toBe('before_v2')
    expect(evidence.history.schemaDerivedFields.operationRowCount).toBe(0)
    expect(evidence.history.schemaDerivedFields.reviewRowCount).toBe(1)
    expect(evidence.physicalStateSha256).toBe(evidence.history.physicalStateSha256V1)

    const drifted = { ...snapshot, actionCount: 1 }
    const driftQuery = jest.fn().mockResolvedValueOnce(snapshot).mockResolvedValueOnce(drifted)
    await expect(collectProjectedFreshProtectedV2BeforeEvidence(driftQuery)).rejects.toThrow(
      'changed across its read-only bracket',
    )
  })

  test('routes both canonical paths through one shared full-evidence transition validator', async () => {
    const source = await readFile(
      'scripts/literature/rehearse-gold-import-compensation-db-v2.ts',
      'utf8',
    )
    expect(source.match(/validateProtectedV2SchemaOnlyDatabaseTransition\(\{/gu)).toHaveLength(1)
    expect(source).toContain("phase: 'before_v2'")
    expect(source).toContain('collectProjectedFreshProtectedV2BeforeEvidence(queryJson)')
    expect(source).toContain("profile: 'local'")
    expect(source).toContain('beforeCaptures: protectedBeforeCaptures')
    expect(source).toContain('schemaOnlyTransition: protectedSchemaOnlyTransition')
    expect(source.indexOf('validateProtectedV2SchemaOnlyDatabaseTransition({')).toBeLessThan(
      source.indexOf('const packageEvidence = await input.exactPackageExecutor.execute({'),
    )
  })

  test('requires byte-identical canonical evidence from repeated disposable runs', () => {
    const first = pathResult()
    const second = pathResult()
    expect(assertDeterministicV2RehearsalRuns(first, second).canonicalArtifacts).toBe(
      first.canonicalArtifacts,
    )
    const drifted = pathResult(Buffer.from('{"passed":false}\n'))
    expect(() => assertDeterministicV2RehearsalRuns(first, drifted)).toThrow(
      'different canonical artifacts',
    )
    expect(() =>
      assertDeterministicV2RehearsalRuns(first, { ...second, migrationPath: 'upgrade' }),
    ).toThrow('different migration paths')
  })

  test('exposes no caller database, host, URL, SQL, remote, or held-out selector', async () => {
    const source = await readFile(
      'scripts/literature/rehearse-gold-import-compensation-db-v2.ts',
      'utf8',
    )
    expect(source).not.toContain("'db-url'")
    expect(source).not.toContain("'database-url'")
    expect(source).not.toContain("'target'")
    expect(source).not.toContain("'remote'")
    expect(source).not.toContain('process.argv')
    expect(source).not.toContain('callerSql')
    expect(source).toContain("'127.0.0.1::5432'")
    expect(source).toContain("const PROTECTED_REAL_LOCAL_DATABASE_PORT = '55322'")
  })

  test('keeps the canonical evidence version explicitly V2', () => {
    expect(V2_CANONICAL_EVIDENCE_SCHEMA_VERSION).toBe(
      'gold-import-compensation-disposable-rehearsal-canonical/2.1.0',
    )
  })
})
