import { mkdir, mkdtemp, readFile, rename, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  REQUIRED_CONSTRAINTS,
  REQUIRED_EVENT_TYPES,
  REQUIRED_JOURNAL_POLICIES,
  REQUIRED_RLS_TABLES,
  SCHEMA_SECURITY_COLUMN_PRIVILEGES,
  SCHEMA_SECURITY_COLUMN_ROLES,
  SCHEMA_SECURITY_FUNCTION_NAMES,
  REQUIRED_TRIGGERS,
  schemaSecurityDefinitionIdentitySha256,
} from './gold-import-compensation-rehearsal-evidence'
import {
  assertAggregateOnlyTestState,
  assertExclusiveOutputPath,
  assertLocalDatabaseHealthy,
  assertLocalDatabaseContainer,
  assertReadOnlySnapshotSql,
  assertRepositoryGuard,
  assertSerializedAggregateOrdering,
  auditPostMigration,
  buildAuditArtifacts,
  buildBackupExecutionReceipt,
  buildDevelopmentDatabaseSeed,
  buildDevelopmentPlanningState,
  buildPreMigrationBackup,
  buildReadOnlyContractHashSql,
  buildReadOnlySnapshotSql,
  canonicalJson,
  DEFAULT_LOCAL_DATABASE_CONTAINER,
  developmentPlanningStateSha256,
  derivePreMigrationBaselineIdentity,
  EXPECTED_PROTECTED_NON_CONSTRAINT_INDEXES,
  IMPORT_COMPENSATION_MIGRATION_SHA256,
  loadAndVerifyBackup,
  loadAndVerifyBackupFixtureForTest,
  LOCAL_DATABASE_PORT,
  LOCAL_SUPABASE_PROJECT_ID,
  resolveLocalDockerTarget,
  resolveEffectiveReview,
  sanitizeOperationalEnvironment,
  sealCanonicalArtifacts,
  SERIALIZED_AGGREGATE_ORDERING_CONTRACTS,
  sha256,
  sha256ContractCanonical,
  type CommandRunner,
  type RawDatabaseSnapshot,
  writeCanonicalPackage,
} from './gold-import-compensation-migration-operations'
import { runAuditGoldImportCompensationMigration } from './audit-gold-import-compensation-migration'
import { runPrepareGoldImportCompensationMigration } from './prepare-gold-import-compensation-migration'

const IDS = {
  batch: '00000000-0000-4000-8000-000000000001',
  batchEvent: '00000000-0000-4000-8000-000000000000',
  item: '00000000-0000-4000-8000-000000000002',
  review: '00000000-0000-4000-8000-000000000003',
  restore: '00000000-0000-4000-8000-000000000004',
  event: '00000000-0000-4000-8000-000000000005',
} as const

function baseSamplingReport() {
  return {
    broadTopicsRepresented: ['basic-bronchoscopy'],
    broadTopicsUnavailable: ['peripheral-navigation'],
    candidateCount: 2,
    countsByAbstractAvailability: { has_abstract: 1, no_abstract: 1 },
    countsByDeterministicBand: { high: 1, intermediate: 1, low: 0 },
    countsByJournal: { 'Fixture Journal': 2 },
    countsBySourceTier: { core: 1, discovery_only: 0, multiple: 1 },
    countsByStratum: {
      ambiguous_boundary: 0,
      challenging_metadata: 0,
      discovery_only: 0,
      likely_non_ip: 1,
      strong_likely_ip: 1,
    },
    countsByYearBand: { '2000_2009': 0, '2010_2019': 0, '2020_present': 2 },
    developmentCount: 1,
    excludedCandidateCount: 0,
    exclusionSources: [],
    kind: 'gold_standard',
    name: 'gold-set-v1',
    originalCandidateCount: 2,
    reportVersion: '1.3.0',
    requestedSize: 2,
    samplingAlgorithmVersion: 'stratified-v2',
    samplingSeed: 20260808,
    selectedCount: 2,
    testCount: 1,
    warnings: [],
  }
}

function baseReview() {
  return {
    id: IDS.review,
    item_id: IDS.item,
    revision: 1,
    supersedes_review_id: null,
    reviewer_user_id: null,
    reviewer_email: 'development-reviewer@example.test',
    relevance_label: 'include_core',
    metadata_sufficiency: 'adequate_abstract',
    reviewer_confidence: 'high',
    topic_ids: ['basic-bronchoscopy'],
    technology_tags: [],
    clinical_purposes: ['diagnosis'],
    disease_tags: [],
    study_design: 'review-article',
    publication_status: 'full-article',
    categorization_from_full_text: false,
    notes: 'Development-only review.',
    used_supplemental_metadata: false,
    review_seconds: 30,
    is_blinded: true,
    started_at: '2026-08-01T00:00:00.000Z',
    completed_at: '2026-08-01T00:00:30.000Z',
    created_at: '2026-08-01T00:00:30.000Z',
  }
}

function preMigrationSnapshot(): RawDatabaseSnapshot {
  return {
    snapshotSchemaVersion: 'gold-import-compensation-db-snapshot/1.0.0',
    database: {
      databaseName: 'postgres',
      serverVersionNum: '170006',
      readOnlyTransaction: true,
    },
    migrationLedger: [],
    scope: {
      datasetSplit: 'development',
      batch: {
        id: IDS.batch,
        name: 'gold-set-v1',
        kind: 'gold_standard',
        status: 'active',
        taxonomy_version: '2.0.0',
        label_schema_version: '2.0.0',
        requested_size: 2,
        test_percent: 50,
      },
    },
    developmentItems: [
      {
        item: {
          id: IDS.item,
          batch_id: IDS.batch,
          pmid: '12345678',
          dataset_split: 'development',
          display_order: 1,
          review_status: 'completed',
          current_review_id: IDS.review,
          supplemental_metadata_revealed_at: null,
          automated_signals_revealed_at: null,
          started_at: '2026-08-01T00:00:00.000Z',
          completed_at: '2026-08-01T00:00:30.000Z',
        },
        reviews: [baseReview()],
        events: [
          {
            id: IDS.event,
            batch_id: IDS.batch,
            item_id: IDS.item,
            actor_user_id: null,
            actor_email: 'development-reviewer@example.test',
            event_type: 'review_completed',
            before_value: null,
            after_value: { revision: 1 },
            created_at: '2026-08-01T00:00:30.000Z',
          },
        ],
      },
    ],
    developmentSeed: {
      literatureArticles: [{ pmid: '12345678', title: 'Development article' }],
      batches: [
        {
          id: IDS.batch,
          name: 'gold-set-v1',
          kind: 'gold_standard',
          status: 'active',
          taxonomy_version: '2.0.0',
          label_schema_version: '2.0.0',
          requested_size: 2,
          sampling_seed: 20260808,
          sampling_report: baseSamplingReport(),
          test_percent: 50,
        },
      ],
      items: [
        {
          id: IDS.item,
          batch_id: IDS.batch,
          pmid: '12345678',
          dataset_split: 'development',
          display_order: 1,
          review_status: 'completed',
          current_review_id: IDS.review,
          supplemental_metadata_revealed_at: null,
          automated_signals_revealed_at: null,
          started_at: '2026-08-01T00:00:00.000Z',
          completed_at: '2026-08-01T00:00:30.000Z',
        },
      ],
      reviews: [baseReview()],
      drafts: [],
      events: [
        {
          id: IDS.batchEvent,
          batch_id: IDS.batch,
          item_id: null,
          actor_user_id: null,
          actor_email: 'development-reviewer@example.test',
          event_type: 'batch_created',
          before_value: null,
          after_value: {
            kind: 'gold_standard',
            name: 'gold-set-v1',
            requested_size: 2,
            sampling_seed: 20260808,
          },
          created_at: '2026-08-01T00:00:00.000Z',
        },
        {
          id: IDS.event,
          batch_id: IDS.batch,
          item_id: IDS.item,
          actor_user_id: null,
          actor_email: 'development-reviewer@example.test',
          event_type: 'review_completed',
          before_value: null,
          after_value: { revision: 1 },
          created_at: '2026-08-01T00:00:30.000Z',
        },
      ],
    },
    testAggregate: {
      itemCount: 1,
      pendingCount: 1,
      startedCount: 0,
      currentPointerCount: 0,
      draftCount: 0,
      reviewCount: 0,
      eventCount: 0,
      locked: true,
    },
    schema: {
      tables: REQUIRED_RLS_TABLES.slice(2).map((table_name) => ({
        table_name,
        relation_kind: 'r',
        rls_enabled: true,
        force_rls: false,
        owner: 'supabase_admin',
        acl: null,
      })),
      columns: [],
      columnPrivileges: [],
      functions: [],
      constraints: [],
      indexes: [],
      triggers: [],
      policies: [],
      tablePrivileges: [],
      schemaCreatePrivileges: [],
      columnAclEntries: [],
      supportedEventTypes: REQUIRED_EVENT_TYPES.filter(
        (event) =>
          !event.startsWith('import') &&
          !['review_compensated', 'review_imported', 'review_voided'].includes(event),
      ),
    },
  }
}

function constraintDefinition(name: string) {
  const fragments: Record<string, string> = {
    literature_gold_review_operations_sha_check:
      'CHECK (artifact_sha256 plan_sha256 authorization_sha256 pre_physical_state_sha256 pre_effective_state_sha256)',
    literature_gold_review_operations_counts_check:
      'CHECK (planned_action_count planned_apply_count planned_noop_count applied_action_count noop_action_count)',
    literature_gold_review_operations_terminal_check:
      "CHECK (status = 'started' OR status = 'completed' OR status = 'failed' OR error_sqlstate IS NOT NULL)",
    literature_gold_review_operation_actions_shape_check:
      'CHECK (import_initial import_revision import_noop compensate_restore compensate_void compensate_noop)',
    literature_gold_review_operation_actions_result_check:
      "CHECK (action_status = 'planned' OR action_status = 'applied' OR action_status = 'noop' OR action_status = 'failed')",
    literature_gold_set_reviews_revision_contract_check:
      "CHECK (revision_kind = 'standard' OR revision_kind = 'import' OR revision_kind = 'compensation' OR effective_source_review_id IS NOT NULL)",
    literature_gold_set_events_type_check:
      'CHECK (import_completed import_compensation_started review_compensated review_voided import_compensation_completed import_compensation_failed)',
  }
  return fragments[name] ?? 'CHECK (true)'
}

function indexDefinition(name: string, tableName: string) {
  const definitions: Record<string, string> = {
    literature_gold_review_operations_one_live_compensation_idx:
      "CREATE UNIQUE INDEX x ON public.literature_gold_review_operations (target_import_operation_id) WHERE operation_kind = 'compensation' AND status = ANY (ARRAY['started', 'completed'])",
    literature_gold_set_events_operation_sequence_idx:
      'CREATE UNIQUE INDEX x ON public.literature_gold_set_events (operation_id, operation_event_sequence) WHERE operation_id IS NOT NULL',
    literature_gold_set_reviews_one_child_idx:
      'CREATE UNIQUE INDEX x ON public.literature_gold_set_reviews (supersedes_review_id) WHERE supersedes_review_id IS NOT NULL',
    literature_gold_set_reviews_one_operation_action_idx:
      'CREATE UNIQUE INDEX x ON public.literature_gold_set_reviews (operation_action_id) WHERE operation_action_id IS NOT NULL',
  }
  return definitions[name] ?? `CREATE INDEX ${name} ON public.${tableName} (id)`
}

function postMigrationSchema() {
  const roles = ['public', 'anon', 'authenticated', 'service_role']
  const privileges = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
  const tables = REQUIRED_RLS_TABLES.map((table_name) => ({
    table_name,
    relation_kind: 'r',
    rls_enabled: true,
    force_rls: false,
    owner: 'supabase_admin',
    acl: null,
  }))
  const columns = [
    'revision_kind',
    'lifecycle_state',
    'operation_action_id',
    'compensates_review_id',
    'effective_source_review_id',
  ].map((column_name, ordinal_position) => ({
    table_name: 'literature_gold_set_reviews',
    column_name,
    ordinal_position: ordinal_position + 1,
    data_type: column_name.endsWith('_id') ? 'uuid' : 'text',
    udt_name: column_name.endsWith('_id') ? 'uuid' : 'text',
    is_nullable: 'YES',
    column_default: null,
  }))
  const columnPrivileges = columns.flatMap(({ table_name, column_name }) =>
    SCHEMA_SECURITY_COLUMN_ROLES.flatMap((role_name) =>
      SCHEMA_SECURITY_COLUMN_PRIVILEGES.map((privilege_name) => ({
        table_name,
        column_name,
        role_name,
        privilege_name,
        granted: false,
      })),
    ),
  )
  const tablePrivileges = REQUIRED_RLS_TABLES.flatMap((table_name) =>
    roles.flatMap((role_name) =>
      privileges.map((privilege_name) => {
        const reviewOrEvent = [
          'literature_gold_set_reviews',
          'literature_gold_set_events',
        ].includes(table_name)
        const journal = [
          'literature_gold_review_operations',
          'literature_gold_review_operation_actions',
        ].includes(table_name)
        const granted =
          role_name === 'service_role' &&
          ((reviewOrEvent && ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(privilege_name)) ||
            (journal && privilege_name === 'SELECT'))
        return { table_name, role_name, privilege_name, granted }
      }),
    ),
  )
  const transition = (
    name: string,
    identity_arguments: string,
    definition = `CREATE FUNCTION ${name}() RETURNS jsonb SECURITY DEFINER SET search_path = pg_catalog, public, extensions`,
  ) => ({
    name,
    identity_arguments,
    result_type: 'jsonb',
    volatility: name.startsWith('reconcile') ? 's' : 'v',
    security_definer: true,
    owner: 'supabase_admin',
    search_path: 'pg_catalog, public, extensions',
    definition,
    acl: null,
    public_execute: false,
    anon_execute: false,
    authenticated_execute: false,
    service_role_execute: true,
  })
  return {
    tables,
    columns,
    columnPrivileges,
    functions: [
      transition(
        'apply_literature_gold_import_v1',
        'p_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
      ),
      transition(
        'compensate_literature_gold_import_v1',
        'p_operation_id uuid, p_target_import_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
      ),
      transition(
        'reconcile_literature_gold_review_operation_v1',
        'p_operation_id uuid, p_recovery_authorization_sha256 text, p_recovery_authorization jsonb',
      ),
      transition(
        'literature_gold_effective_state_hash_v1',
        'p_batch_id uuid, p_split text',
        "CREATE FUNCTION literature_gold_effective_state_hash_v1() RETURNS text AS $$ head.lifecycle_state = 'withdrawn'; coalesce(head.effective_source_review_id, head.id); $$ LANGUAGE sql",
      ),
      transition(
        'save_literature_gold_review_v1',
        'p_item_id uuid',
        'CREATE FUNCTION save_literature_gold_review_v1() RETURNS void AS $$ supersedes_review_id current_review_id $$ LANGUAGE sql',
      ),
    ],
    constraints: REQUIRED_CONSTRAINTS.map((name) => ({
      name,
      table_name: name.includes('events')
        ? 'literature_gold_set_events'
        : name.includes('actions')
          ? 'literature_gold_review_operation_actions'
          : name.includes('operations')
            ? 'literature_gold_review_operations'
            : 'literature_gold_set_reviews',
      definition: constraintDefinition(name),
      validated: true,
    })),
    indexes: EXPECTED_PROTECTED_NON_CONSTRAINT_INDEXES.map(({ name, tableName, unique }) => ({
      name,
      table_name: tableName,
      owner: 'supabase_admin',
      is_unique: unique,
      is_valid: true,
      constraint_backed: false,
      predicate: 'required predicate',
      definition: indexDefinition(name, tableName),
    })),
    triggers: REQUIRED_TRIGGERS.map((name) => ({
      name,
      table_name: name.includes('actions')
        ? 'literature_gold_review_operation_actions'
        : name.includes('operations')
          ? 'literature_gold_review_operations'
          : name.includes('events')
            ? 'literature_gold_set_events'
            : name.includes('item')
              ? 'literature_gold_set_items'
              : 'literature_gold_set_reviews',
      enable_mode: 'O',
      enabled: true,
      definition: `CREATE TRIGGER ${name}`,
    })),
    policies: REQUIRED_JOURNAL_POLICIES.map((name) => ({
      name,
      table_name: name.includes('actions')
        ? 'literature_gold_review_operation_actions'
        : 'literature_gold_review_operations',
      command: 'ALL',
      permissive: 'PERMISSIVE',
      roles: ['service_role'],
      using_expression: name.includes('actions')
        ? "dataset_split = 'development' AND literature_gold_review_operations.id IS NOT NULL"
        : "dataset_split = 'development'",
      with_check_expression: name.includes('actions')
        ? "dataset_split = 'development' AND literature_gold_review_operations.id IS NOT NULL"
        : "dataset_split = 'development'",
    })),
    tablePrivileges,
    schemaCreatePrivileges: ['public', 'extensions'].flatMap((schema_name) =>
      ['public', 'anon', 'authenticated'].map((role_name) => ({
        schema_name,
        owner: 'supabase_admin',
        role_name,
        granted: false,
      })),
    ),
    tableAclEntries: [],
    columnAclEntries: [],
    functionAclEntries: [],
    schemaAclEntries: [],
    supportedEventTypes: [...REQUIRED_EVENT_TYPES],
  }
}

function postMigrationSnapshot(): RawDatabaseSnapshot {
  const snapshot = preMigrationSnapshot()
  snapshot.migrationLedger = [
    {
      version: '20260808035633',
      name: 'add_literature_gold_import_compensation_contract',
    },
  ]
  snapshot.schema = postMigrationSchema()
  const development = snapshot.developmentItems[0] as {
    reviews: Array<Record<string, unknown>>
  }
  development.reviews[0] = {
    ...development.reviews[0],
    revision_kind: 'standard',
    lifecycle_state: 'effective',
    operation_action_id: null,
    compensates_review_id: null,
    effective_source_review_id: null,
    technology_tag_status: null,
    disease_tag_status: null,
    taxonomy_version: null,
    label_schema_version: null,
    enrichment_schema_version: null,
    enrichment_provenance: null,
  }
  return snapshot
}

function validLint() {
  const issue = (message: string) => ({ level: 'warning', message, sqlState: '00000' })
  const warning = 'routine is marked as IMMUTABLE, but expression is STABLE'
  return [
    {
      function: 'public.assert_literature_gold_jsonb_scalar_v1',
      issues: [issue(warning), issue(warning)],
    },
    { function: 'public.literature_gold_canonical_json_v1', issues: [issue(warning)] },
    { function: 'public.literature_gold_is_timestamptz_v1', issues: [issue(warning)] },
  ]
}

function preMigrationInput() {
  const snapshot = preMigrationSnapshot()
  const baseline = derivePreMigrationBaselineIdentity(snapshot)
  const backup = buildPreMigrationBackup({
    baseline,
    repository: { head: 'a'.repeat(40), originMain: 'a'.repeat(40) },
    snapshot,
  })
  const parsed = (name: string) =>
    JSON.parse(backup.artifacts.files.get(name) as string) as Record<string, unknown>
  return {
    backup,
    contractStateHashes: {
      developmentMembershipSha256: (
        backup.canonicalReceipt.databaseIdentity as Record<string, unknown>
      ).developmentMembershipSha256 as string,
      effectiveStateSha256: backup.effectiveStateSha256,
      physicalStateSha256: 'f'.repeat(64),
      readOnlyTransaction: true as const,
    },
    input: {
      batchAndTestLock: parsed('batch-and-test-lock.json'),
      developmentState: parsed('development-review-state.json'),
      manifestSha256: backup.artifacts.manifestSha256,
      migrationLedger: parsed('migration-ledger.json'),
      receipt: parsed('backup-receipt.json'),
      schemaInventory: parsed('schema-inventory.json'),
      stateAudits: parsed('state-audits.json'),
    },
    baseline,
  }
}

function auditMigratedSnapshot(snapshot: RawDatabaseSnapshot) {
  const { contractStateHashes, input } = preMigrationInput()
  return auditPostMigration({
    contractStateHashes,
    contractStateHashesBefore: contractStateHashes,
    testOnlyExpectedSchemaSecurityIdentitySha256: schemaSecurityDefinitionIdentitySha256({
      catalog: postMigrationSnapshot().schema,
    }),
    lint: validLint(),
    preMigration: input,
    repositoryCommitSha: 'a'.repeat(40),
    snapshot,
  })
}

async function writeFixtureBackup() {
  const { backup, baseline } = preMigrationInput()
  const parent = await mkdtemp(join(tmpdir(), 'gold-migration-backup-'))
  const outputDirectory = join(parent, 'backup')
  await writeCanonicalPackage({
    artifacts: backup.artifacts,
    executionReceipt: buildBackupExecutionReceipt({
      canonicalReceipt: backup.canonicalReceipt,
      container: DEFAULT_LOCAL_DATABASE_CONTAINER,
      executedAt: '2026-08-08T12:00:00.000Z',
      manifestSha256: backup.artifacts.manifestSha256,
      outputDirectory,
      repositoryRoot: '/repo',
    }),
    outputDirectory,
    outputRoot: parent,
  })
  return { backup, baseline, outputDirectory }
}

async function writeLegacyV1PlanningFixtureBackup(
  mutatePlanningState?: (planningState: Record<string, unknown>) => void,
) {
  const snapshot = preMigrationSnapshot()
  const sourceArrays = {
    topic_ids: ['peripheral-navigation', 'basic-bronchoscopy'],
    technology_tags: ['robotic-bronchoscopy', 'electromagnetic-navigation'],
    clinical_purposes: ['staging', 'diagnosis'],
    disease_tags: ['mesothelioma', 'lung-cancer'],
  }
  const developmentRow = snapshot.developmentItems[0] as Record<string, unknown>
  const developmentReview = (developmentRow.reviews as Array<Record<string, unknown>>)[0]
  const seedReview = (snapshot.developmentSeed.reviews as Array<Record<string, unknown>>)[0]
  for (const [field, values] of Object.entries(sourceArrays)) {
    developmentReview[field] = [...values]
    seedReview[field] = [...values]
  }
  const baseline = derivePreMigrationBaselineIdentity(snapshot)
  const backup = buildPreMigrationBackup({
    baseline,
    repository: { head: 'a'.repeat(40), originMain: 'a'.repeat(40) },
    snapshot,
  })
  const files = new Map(backup.artifacts.files)
  const canonicalPlanningState = JSON.parse(
    files.get('development-planning-state.json') as string,
  ) as Record<string, unknown>
  const legacyPlanningState = JSON.parse(canonicalJson(canonicalPlanningState)) as Record<
    string,
    unknown
  >
  const planningRows = legacyPlanningState.rows as Array<Record<string, unknown>>
  const legacyReview = planningRows[0].currentEffectiveReview as Record<string, unknown>
  legacyReview.topicIds = [...sourceArrays.topic_ids]
  legacyReview.technologyTags = [...sourceArrays.technology_tags]
  legacyReview.clinicalPurposes = [...sourceArrays.clinical_purposes]
  legacyReview.diseaseTags = [...sourceArrays.disease_tags]
  mutatePlanningState?.(legacyPlanningState)
  files.set('development-planning-state.json', canonicalJson(legacyPlanningState))
  const artifacts = sealCanonicalArtifacts(files)
  const parent = await mkdtemp(join(tmpdir(), 'gold-migration-legacy-backup-'))
  const outputDirectory = join(parent, 'backup')
  await writeCanonicalPackage({
    artifacts,
    executionReceipt: buildBackupExecutionReceipt({
      canonicalReceipt: backup.canonicalReceipt,
      container: DEFAULT_LOCAL_DATABASE_CONTAINER,
      executedAt: '2026-08-08T12:00:00.000Z',
      manifestSha256: artifacts.manifestSha256,
      outputDirectory,
      repositoryRoot: '/repo',
    }),
    outputDirectory,
    outputRoot: parent,
  })
  return {
    artifacts,
    baseline,
    canonicalPlanningState,
    legacyPlanningState,
    outputDirectory,
  }
}

describe('gold import-compensation migration operations', () => {
  it('seals caller-supplied canonical artifacts with a sorted complete manifest', () => {
    const artifacts = sealCanonicalArtifacts(
      new Map([
        ['zeta.json', canonicalJson({ value: 2 })],
        ['alpha.json', canonicalJson({ value: 1 })],
      ]),
    )
    expect([...artifacts.files.keys()]).toEqual(['alpha.json', 'zeta.json'])
    expect(artifacts.manifest).toBe(
      `${sha256(canonicalJson({ value: 1 }))}  alpha.json\n${sha256(
        canonicalJson({ value: 2 }),
      )}  zeta.json\n`,
    )
    expect(artifacts.manifestSha256).toBe(sha256(artifacts.manifest))
    expect(() =>
      sealCanonicalArtifacts(new Map([['checksum-manifest.sha256', 'reserved\n']])),
    ).toThrow('unsafe or reserved')
  })

  it('documents and requires the trusted pre-migration backup manifest argument', async () => {
    await expect(runAuditGoldImportCompensationMigration(['--help'])).resolves.toMatchObject({
      help: expect.stringContaining('--pre-migration-backup-manifest-sha256'),
    })
    await expect(
      runAuditGoldImportCompensationMigration([
        '--pre-migration-backup',
        '/tmp/backup',
        '--output',
        '/tmp/audit',
      ]),
    ).rejects.toThrow(/pre-migration-backup-manifest-sha256/iu)
  })

  it('requires an explicit approved backup root for both read-only operational CLIs', async () => {
    await expect(runPrepareGoldImportCompensationMigration(['--help'])).resolves.toMatchObject({
      help: expect.stringContaining('--backup-root <existing-directory>'),
    })
    await expect(runAuditGoldImportCompensationMigration(['--help'])).resolves.toMatchObject({
      help: expect.stringContaining('--backup-root <existing-directory>'),
    })
    await expect(
      runPrepareGoldImportCompensationMigration(['--output', '/tmp/backup']),
    ).rejects.toThrow(/--backup-root/iu)
    await expect(
      runAuditGoldImportCompensationMigration([
        '--pre-migration-backup',
        '/tmp/backup',
        '--pre-migration-backup-manifest-sha256',
        'a'.repeat(64),
        '--output',
        '/tmp/audit',
      ]),
    ).rejects.toThrow(/--backup-root/iu)
  })

  it.each([
    ['worktree', { gitDir: '/repo/.git/worktrees/codex', commonDir: '/repo/.git' }],
    ['branch', { branch: 'codex/task' }],
    ['dirty', { trackedStatus: ' M package.json' }],
    ['origin mismatch', { head: 'b'.repeat(40) }],
  ])('rejects the %s repository guard', (_label, override) => {
    expect(() =>
      assertRepositoryGuard({
        branch: 'main',
        commonDir: '/repo/.git',
        gitDir: '/repo/.git',
        head: 'a'.repeat(40),
        originMain: 'a'.repeat(40),
        trackedStatus: '',
        ...override,
      }),
    ).toThrow()
  })

  it('enforces the fixed local-only database container', () => {
    expect(() => assertLocalDatabaseContainer(DEFAULT_LOCAL_DATABASE_CONTAINER)).not.toThrow()
    expect(() => assertLocalDatabaseContainer('remote-postgres')).toThrow(/local-only/iu)
  })

  it('sanitizes operational environment and pins a local Docker context before inspection', async () => {
    const observed: Array<{ arguments_: string[]; environment?: NodeJS.ProcessEnv }> = []
    const runCommand: CommandRunner = async (_command, arguments_, options) => {
      observed.push({ arguments_, environment: options?.env })
      if (arguments_.join(' ') === 'context show') return { stdout: 'desktop-linux\n', stderr: '' }
      if (arguments_[0] === 'context' && arguments_[1] === 'inspect') {
        return { stdout: '"unix:///Users/test/.docker/run/docker.sock"\n', stderr: '' }
      }
      return {
        stdout: `/${DEFAULT_LOCAL_DATABASE_CONTAINER}|true|${LOCAL_DATABASE_PORT}|${LOCAL_SUPABASE_PROJECT_ID}\n`,
        stderr: '',
      }
    }
    const environment = {
      PATH: '/bin',
      SUPABASE_ACCESS_TOKEN: 'secret',
      PGPASSWORD: 'secret',
    }
    expect(sanitizeOperationalEnvironment(environment)).toEqual({ PATH: '/bin' })
    const target = await resolveLocalDockerTarget({ environment, runCommand })
    await assertLocalDatabaseHealthy(DEFAULT_LOCAL_DATABASE_CONTAINER, runCommand, target)
    expect(target).toMatchObject({
      context: 'desktop-linux',
      endpoint: 'unix:///Users/test/.docker/run/docker.sock',
    })
    expect(observed.at(-1)?.arguments_).toEqual(
      expect.arrayContaining(['--context', 'desktop-linux', 'inspect']),
    )
    expect(observed.every(({ environment: value }) => !value?.SUPABASE_ACCESS_TOKEN)).toBe(true)
    expect(observed.every(({ environment: value }) => !value?.PGPASSWORD)).toBe(true)
  })

  it('rejects remote Docker and database target overrides or contexts', async () => {
    const unusedRunner: CommandRunner = async () => {
      throw new Error('runner should not execute')
    }
    await expect(
      resolveLocalDockerTarget({
        environment: { DOCKER_HOST: 'tcp://remote.example:2376' },
        runCommand: unusedRunner,
      }),
    ).rejects.toThrow(/non-local/iu)
    await expect(
      resolveLocalDockerTarget({
        environment: { DATABASE_URL: 'postgres://remote.example/postgres' },
        runCommand: unusedRunner,
      }),
    ).rejects.toThrow(/override/iu)
    const remoteContextRunner: CommandRunner = async (_command, arguments_) =>
      arguments_[1] === 'show'
        ? { stdout: 'remote-context\n', stderr: '' }
        : { stdout: '"ssh://operator@remote.example"\n', stderr: '' }
    await expect(
      resolveLocalDockerTarget({ environment: {}, runCommand: remoteContextRunner }),
    ).rejects.toThrow(/non-local/iu)
  })

  it('uses a read-only transaction and direct development membership without data mutation', () => {
    const sql = buildReadOnlySnapshotSql('gold-set-v1')
    expect(() => assertReadOnlySnapshotSql(sql)).not.toThrow()
    expect(sql).toContain("where item.dataset_split = 'development'")
    expect(sql).toContain("test_item.dataset_split = 'test'")
    expect(sql).toContain('has_schema_privilege')
    expect(sql).toContain('as constraint_backed')
    expect(sql).not.toMatch(/\b(?:insert|update|delete)\s+(?:into|from|public\.)/iu)
    expect(() => assertReadOnlySnapshotSql('begin read only; delete from x; rollback;')).toThrow(
      /mutation/iu,
    )
    const hashesSql = buildReadOnlyContractHashSql()
    expect(() => assertReadOnlySnapshotSql(hashesSql)).not.toThrow()
    expect(hashesSql).toContain('literature_gold_effective_state_hash_v1')
    expect(hashesSql).toContain('literature_gold_physical_state_hash_v1')
  })

  it('requires aggregate-level ordering for every serialized SQL aggregate contract', () => {
    const sql = buildReadOnlySnapshotSql('gold-set-v1')
    expect(() => assertSerializedAggregateOrdering(sql)).not.toThrow()
    expect(Object.keys(SERIALIZED_AGGREGATE_ORDERING_CONTRACTS)).toEqual(
      expect.arrayContaining([
        'developmentItems',
        'developmentArticles',
        'developmentDrafts',
        'developmentEvents',
        'itemReviews',
        'itemEvents',
        'schemaFunctions',
        'schemaPrivileges',
      ]),
    )
    for (const aggregate of [
      'json_agg',
      'jsonb_agg',
      'array_agg',
      'string_agg',
      'json_object_agg',
      'jsonb_object_agg',
    ]) {
      expect(() =>
        assertSerializedAggregateOrdering(
          `select ${aggregate}(value) from (select value from source order by id) ordered_source`,
        ),
      ).toThrow(/aggregate-level ORDER BY/iu)
    }
    expect(() =>
      assertSerializedAggregateOrdering('select jsonb_agg(value order by id asc) from source'),
    ).not.toThrow()
    expect(() =>
      assertSerializedAggregateOrdering(
        'create function f() returns jsonb language sql as $$ select jsonb_agg(value) from source $$',
      ),
    ).toThrow(/aggregate-level ORDER BY/iu)
  })

  it('keeps the contract migration and disposable verification SQL aggregate-ordered', async () => {
    for (const path of [
      'supabase/migrations/20260808035633_add_literature_gold_import_compensation_contract.sql',
      'supabase/verification/20260808035633_verify_literature_gold_import_compensation_contract.sql',
    ]) {
      const sql = await readFile(join(process.cwd(), path), 'utf8')
      expect(() => assertSerializedAggregateOrdering(sql)).not.toThrow()
    }
  })

  it('pins the exact migration-touched function and function-ACL catalog scope', () => {
    const sql = buildReadOnlySnapshotSql('gold-set-v1')
    expect(sql).not.toMatch(/proc\.proname\s+like/iu)
    expect(SCHEMA_SECURITY_FUNCTION_NAMES).toHaveLength(24)
    for (const functionName of SCHEMA_SECURITY_FUNCTION_NAMES) {
      expect(sql).toContain(`('${functionName}')`)
    }
    expect(sql).toContain(
      'join schema_security_functions as requested on requested.name = proc.proname',
    )
  })

  it('keeps constraint-trigger catalog rows exclusively in the trigger survey', () => {
    const sql = buildReadOnlySnapshotSql('gold-set-v1')
    expect(sql).toContain("where constraint_record.contype <> 't'")
    expect(sql).toContain('from pg_catalog.pg_trigger as trigger_record')
  })

  it('uses a NULL-safe one-dimensional column ACL input for every aclexplode survey', () => {
    const sql = buildReadOnlySnapshotSql('gold-set-v1')
    expect(sql).not.toMatch(/aclexplode\s*\(\s*coalesce\s*\(\s*attribute\.attacl\s*,\s*array\[\]/iu)
    expect(
      sql.match(
        /case when cardinality\(attribute\.attacl\) > 0 then attribute\.attacl\s+else null::pg_catalog\.aclitem\[\] end/giu,
      ),
    ).toHaveLength(2)
  })

  it('canonicalizes randomized source-row order before hashing backup and planning artifacts', () => {
    const ordered = preMigrationSnapshot()
    const secondReview = {
      ...baseReview(),
      id: IDS.restore,
      revision: 2,
      supersedes_review_id: IDS.review,
      created_at: '2026-08-01T00:01:00.000Z',
      completed_at: '2026-08-01T00:01:00.000Z',
    }
    const developmentRow = ordered.developmentItems[0] as {
      item: Record<string, unknown>
      reviews: Array<Record<string, unknown>>
    }
    developmentRow.item.current_review_id = IDS.restore
    developmentRow.reviews.push(secondReview)
    const seed = ordered.developmentSeed
    ;(seed.items as Array<Record<string, unknown>>)[0].current_review_id = IDS.restore
    ;(seed.reviews as Array<Record<string, unknown>>).push(secondReview)

    const baseline = derivePreMigrationBaselineIdentity(ordered)
    const build = (snapshot: RawDatabaseSnapshot) =>
      buildPreMigrationBackup({
        baseline,
        repository: { head: 'a'.repeat(40), originMain: 'a'.repeat(40) },
        snapshot,
      })
    const first = build(ordered)
    const shuffle = (values: unknown[], seed: number) => {
      let state = seed >>> 0
      for (let index = values.length - 1; index > 0; index -= 1) {
        state = (state * 1_664_525 + 1_013_904_223) >>> 0
        const target = state % (index + 1)
        ;[values[index], values[target]] = [values[target], values[index]]
      }
    }
    for (const seedValue of [1, 7, 19, 41, 73, 101, 211, 997]) {
      const shuffled = JSON.parse(JSON.stringify(ordered)) as RawDatabaseSnapshot
      shuffle(shuffled.developmentItems, seedValue)
      for (const row of shuffled.developmentItems as Array<Record<string, unknown>>) {
        shuffle(row.reviews as unknown[], seedValue + 1)
        shuffle(row.events as unknown[], seedValue + 2)
      }
      for (const [offset, key] of [
        'literatureArticles',
        'batches',
        'items',
        'reviews',
        'drafts',
        'events',
      ].entries()) {
        shuffle(shuffled.developmentSeed[key] as unknown[], seedValue + offset + 3)
      }
      shuffle(shuffled.migrationLedger, seedValue + 11)
      for (const [offset, value] of Object.values(shuffled.schema).entries()) {
        if (Array.isArray(value)) shuffle(value, seedValue + offset + 13)
      }

      const candidate = build(shuffled)
      expect(candidate.artifacts.manifest).toBe(first.artifacts.manifest)
      expect(candidate.artifacts.manifestSha256).toBe(first.artifacts.manifestSha256)
      expect([...candidate.artifacts.files.entries()]).toEqual([...first.artifacts.files.entries()])
      expect(canonicalJson(buildDevelopmentPlanningState(shuffled))).toBe(
        canonicalJson(buildDevelopmentPlanningState(ordered)),
      )
      expect(developmentPlanningStateSha256(shuffled)).toBe(developmentPlanningStateSha256(ordered))
    }
  })

  it('rejects output collisions, traversal outside approved roots, and symlink traversal', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gold-migration-output-'))
    const localData = join(root, 'local-data')
    await mkdir(localData)
    const collision = join(localData, 'collision')
    await mkdir(collision)
    await expect(
      assertExclusiveOutputPath({ backupRoot: localData, cwd: root, output: collision }),
    ).rejects.toThrow(/collision/iu)
    await expect(
      assertExclusiveOutputPath({
        backupRoot: localData,
        cwd: root,
        output: join(root, 'elsewhere', 'output'),
      }),
    ).rejects.toThrow(/outside/iu)
    const outside = join(root, 'outside')
    await mkdir(outside)
    const link = join(localData, 'link')
    await symlink(outside, link)
    await expect(
      assertExclusiveOutputPath({ backupRoot: localData, cwd: root, output: join(link, 'output') }),
    ).rejects.toThrow(/outside|symlink/iu)
    const inside = join(localData, 'inside')
    await mkdir(inside)
    const insideLink = join(localData, 'inside-link')
    await symlink(inside, insideLink)
    await expect(
      assertExclusiveOutputPath({
        backupRoot: localData,
        cwd: root,
        output: join(insideLink, 'output'),
      }),
    ).rejects.toThrow(/symlink/iu)

    const separatelyApprovedRoot = join(root, 'approved')
    await mkdir(separatelyApprovedRoot)
    await expect(
      assertExclusiveOutputPath({
        backupRoot: separatelyApprovedRoot,
        cwd: root,
        output: join(localData, 'must-not-fall-back'),
      }),
    ).rejects.toThrow(/outside the explicit backup root/iu)
    await expect(
      assertExclusiveOutputPath({
        backupRoot: separatelyApprovedRoot,
        cwd: root,
        output: `${separatelyApprovedRoot}/child/../traversal`,
      }),
    ).rejects.toThrow(/parent-directory traversal/iu)
  })

  it('creates deterministic canonical backup artifacts scoped to development only', () => {
    const first = preMigrationInput().backup
    const second = preMigrationInput().backup
    expect(first.artifacts.manifest).toBe(second.artifacts.manifest)
    expect(first.artifacts.manifestSha256).toBe(second.artifacts.manifestSha256)
    const serialized = [...first.artifacts.files.values()].join('\n')
    expect(serialized).toContain('12345678')
    expect(serialized).not.toContain('held-out')
    expect(first.canonicalReceipt).toMatchObject({
      mode: 'read_only_dry_run',
      migration: { sha256: IMPORT_COMPENSATION_MIGRATION_SHA256, appliedByThisCommand: false },
      safety: {
        databaseMutationCount: 0,
        heldOutIdentitiesAccessed: false,
        importExecuted: false,
        compensationExecuted: false,
      },
    })
  })

  it('loads only a trusted exact canonical backup set and writes private permissions', async () => {
    const { backup, baseline, outputDirectory } = await writeFixtureBackup()
    await expect(
      loadAndVerifyBackupFixtureForTest(outputDirectory, backup.artifacts.manifestSha256, baseline),
    ).resolves.toMatchObject({
      manifestSha256: backup.artifacts.manifestSha256,
      receipt: { kind: 'pre_migration_backup', mode: 'read_only_dry_run' },
    })
    await expect(
      loadAndVerifyBackup(outputDirectory, backup.artifacts.manifestSha256),
    ).rejects.toThrow(/pinned baseline/iu)
    expect((await stat(outputDirectory)).mode & 0o777).toBe(0o700)
    expect((await stat(join(outputDirectory, 'backup-receipt.json'))).mode & 0o777).toBe(0o600)
    await expect(
      loadAndVerifyBackupFixtureForTest(outputDirectory, 'f'.repeat(64), baseline),
    ).rejects.toThrow(/trusted argument/iu)
    await writeFile(join(outputDirectory, 'unexpected.json'), '{}\n', { mode: 0o600 })
    await expect(
      loadAndVerifyBackupFixtureForTest(outputDirectory, backup.artifacts.manifestSha256, baseline),
    ).rejects.toThrow(/exact expected filename set/iu)
  })

  it('accepts the exact sealed V1 raw-order planning projection and exposes canonical state', async () => {
    const fixture = await writeLegacyV1PlanningFixtureBackup()
    const planningPath = join(fixture.outputDirectory, 'development-planning-state.json')
    const manifestPath = join(fixture.outputDirectory, 'checksum-manifest.sha256')
    const sourcePlanningBytes = await readFile(planningPath, 'utf8')
    const sourceManifestBytes = await readFile(manifestPath, 'utf8')

    const loaded = await loadAndVerifyBackupFixtureForTest(
      fixture.outputDirectory,
      fixture.artifacts.manifestSha256,
      fixture.baseline,
    )

    expect(JSON.parse(sourcePlanningBytes)).toEqual(fixture.legacyPlanningState)
    expect(fixture.legacyPlanningState).not.toEqual(fixture.canonicalPlanningState)
    expect(loaded.planningState).toEqual(fixture.canonicalPlanningState)
    expect(await readFile(planningPath, 'utf8')).toBe(sourcePlanningBytes)
    expect(await readFile(manifestPath, 'utf8')).toBe(sourceManifestBytes)
  })

  it('rejects a manifest-authenticated V1 planning artifact that is neither exact representation', async () => {
    const fixture = await writeLegacyV1PlanningFixtureBackup((planningState) => {
      const planningRows = planningState.rows as Array<Record<string, unknown>>
      const review = planningRows[0].currentEffectiveReview as Record<string, unknown>
      review.notes = 'Arbitrary planning-only tamper.'
    })

    await expect(
      loadAndVerifyBackupFixtureForTest(
        fixture.outputDirectory,
        fixture.artifacts.manifestSha256,
        fixture.baseline,
      ),
    ).rejects.toThrow(/Development planning state failed canonical cross-check/iu)
  })

  it('recomputes backup hashes and rejects internally inconsistent canonical artifacts', async () => {
    const { baseline, outputDirectory } = await writeFixtureBackup()
    const statePath = join(outputDirectory, 'state-audits.json')
    const state = JSON.parse(await readFile(statePath, 'utf8')) as Record<string, unknown>
    state.effectiveStateSha256 = 'f'.repeat(64)
    const stateBytes = canonicalJson(state)
    await writeFile(statePath, stateBytes)
    const manifestPath = join(outputDirectory, 'checksum-manifest.sha256')
    const manifest = await readFile(manifestPath, 'utf8')
    const updatedManifest = manifest.replace(
      /^[a-f0-9]{64}  state-audits\.json$/mu,
      `${sha256(stateBytes)}  state-audits.json`,
    )
    await writeFile(manifestPath, updatedManifest)
    await expect(
      loadAndVerifyBackupFixtureForTest(outputDirectory, sha256(updatedManifest), baseline),
    ).rejects.toThrow(/State audits failed canonical cross-check/iu)
  })

  it('rejects a manifest-listed file replaced by an out-of-directory symlink', async () => {
    const { backup, baseline, outputDirectory } = await writeFixtureBackup()
    const statePath = join(outputDirectory, 'state-audits.json')
    const outsidePath = join(outputDirectory, '..', 'outside-state-audits.json')
    await rename(statePath, outsidePath)
    await symlink(outsidePath, statePath)
    await expect(
      loadAndVerifyBackupFixtureForTest(outputDirectory, backup.artifacts.manifestSha256, baseline),
    ).rejects.toThrow(/confined regular non-symlink/iu)
  })

  it('rejects unexpected development membership drift', () => {
    const snapshot = preMigrationSnapshot()
    expect(() =>
      buildPreMigrationBackup({
        baseline: derivePreMigrationBaselineIdentity(snapshot),
        expectedDevelopmentCount: 630,
        repository: { head: 'a'.repeat(40), originMain: 'a'.repeat(40) },
        snapshot,
      }),
    ).toThrow(/membership drift/iu)
  })

  it('rejects any legacy schema or migration-ledger baseline drift', () => {
    const original = preMigrationSnapshot()
    const baseline = derivePreMigrationBaselineIdentity(original)
    const schemaDrift = preMigrationSnapshot()
    ;(schemaDrift.schema.columns as unknown[]).push({
      table_name: 'literature_gold_set_reviews',
      column_name: 'unexpected_column',
    })
    expect(() =>
      buildPreMigrationBackup({
        baseline,
        repository: { head: 'a'.repeat(40), originMain: 'a'.repeat(40) },
        snapshot: schemaDrift,
      }),
    ).toThrow(/(?:schema.*baseline drift|pre-migration security drift)/iu)

    const ledgerDrift = preMigrationSnapshot()
    ledgerDrift.migrationLedger.push({ version: '20260807000000', name: 'unexpected_migration' })
    expect(() =>
      buildPreMigrationBackup({
        baseline,
        repository: { head: 'a'.repeat(40), originMain: 'a'.repeat(40) },
        snapshot: ledgerDrift,
      }),
    ).toThrow(/ledger.*baseline drift/iu)
  })

  it('preserves the pinned legacy inventory while refusing query-only pre-security drift', () => {
    const snapshot = preMigrationSnapshot()
    const baseline = derivePreMigrationBaselineIdentity(snapshot)
    const legacyShape = JSON.parse(JSON.stringify(snapshot)) as RawDatabaseSnapshot
    const legacySchema = legacyShape.schema as Record<string, unknown>
    delete legacySchema.columnAclEntries
    delete legacySchema.columnPrivileges
    for (const table of legacySchema.tables as Array<Record<string, unknown>>) {
      delete table.force_rls
    }
    expect(derivePreMigrationBaselineIdentity(legacyShape)).toEqual(baseline)
    expect(() =>
      buildPreMigrationBackup({
        baseline,
        repository: { head: 'a'.repeat(40), originMain: 'a'.repeat(40) },
        snapshot,
      }),
    ).not.toThrow()
    expect(() =>
      buildPreMigrationBackup({
        baseline,
        repository: { head: 'a'.repeat(40), originMain: 'a'.repeat(40) },
        snapshot: legacyShape,
      }),
    ).toThrow(/pre-migration security drift/iu)
  })

  it.each(['forced RLS', 'column grant'])(
    'refuses query-only pre-migration %s in backup and audit',
    (mutation) => {
      const { input, baseline } = preMigrationInput()
      const snapshot = preMigrationSnapshot()
      const schema = snapshot.schema as {
        columnAclEntries: Array<Record<string, unknown>>
        tables: Array<Record<string, unknown>>
      }
      if (mutation === 'forced RLS') {
        const reviews = schema.tables.find(
          (table) => table.table_name === 'literature_gold_set_reviews',
        )
        if (reviews) reviews.force_rls = true
      } else {
        schema.columnAclEntries.push({
          schema_name: 'public',
          table_name: 'literature_gold_set_reviews',
          column_name: 'id',
          grantee: 'anon',
          grantor: 'supabase_admin',
          privilege_type: 'UPDATE',
          is_grantable: false,
        })
      }
      expect(() =>
        buildPreMigrationBackup({
          baseline,
          repository: { head: 'a'.repeat(40), originMain: 'a'.repeat(40) },
          snapshot,
        }),
      ).toThrow(/pre-migration security drift/iu)

      const audit = auditPostMigration({
        preMigration: input,
        repositoryCommitSha: 'a'.repeat(40),
        snapshot,
      })
      expect(audit.report.status).toBe('blocked')
      expect(canonicalJson(audit.report)).toMatch(/pre-migration security drift/iu)
    },
  )

  it('rejects any identity-shaped held-out aggregate field', () => {
    expect(() =>
      assertAggregateOnlyTestState({ itemCount: 1, locked: true, pmids: ['secret'] }),
    ).toThrow(/held-out/iu)
  })

  it('resolves ordinary, restored, and withdrawn effective review heads', () => {
    const ordinary = baseReview()
    const imported = {
      ...ordinary,
      id: IDS.restore,
      revision: 2,
      supersedes_review_id: ordinary.id,
      revision_kind: 'import',
      lifecycle_state: 'effective',
    }
    const restored = {
      ...ordinary,
      id: '00000000-0000-4000-8000-000000000006',
      revision: 3,
      supersedes_review_id: imported.id,
      revision_kind: 'compensation',
      lifecycle_state: 'effective',
      effective_source_review_id: ordinary.id,
    }
    expect(resolveEffectiveReview([ordinary])).toMatchObject({ id: ordinary.id })
    expect(resolveEffectiveReview([ordinary, imported, restored])).toMatchObject({
      id: ordinary.id,
    })
    expect(
      resolveEffectiveReview([
        ordinary,
        imported,
        { ...restored, lifecycle_state: 'withdrawn', effective_source_review_id: null },
      ]),
    ).toBeNull()
  })

  it('emits package-compatible development planning state without held-out rows', () => {
    expect(buildDevelopmentPlanningState(preMigrationSnapshot())).toEqual({
      schemaVersion: 'gold-import-compensation-development-planning-state/1.0.0',
      datasetSplit: 'development',
      rows: [
        expect.objectContaining({
          sequence: 1,
          displayOrder: 1,
          itemId: IDS.item,
          pmid: '12345678',
          datasetSplit: 'development',
          currentReviewId: IDS.review,
          effectiveReviewId: IDS.review,
          currentRevision: 1,
        }),
      ],
    })
  })

  it('canonicalizes planning clinical arrays without mutating the database snapshot', () => {
    const snapshot = preMigrationSnapshot()
    const developmentRow = snapshot.developmentItems[0] as Record<string, unknown>
    const review = (developmentRow.reviews as Array<Record<string, unknown>>)[0]
    const sourceArrays = {
      topic_ids: ['peripheral-navigation', 'basic-bronchoscopy'],
      technology_tags: ['robotic-bronchoscopy', 'electromagnetic-navigation'],
      clinical_purposes: ['staging', 'diagnosis'],
      disease_tags: ['mesothelioma', 'lung-cancer'],
    }
    Object.assign(review, sourceArrays)

    const planningState = buildDevelopmentPlanningState(snapshot)

    expect(planningState.rows[0].currentEffectiveReview).toMatchObject({
      topicIds: ['basic-bronchoscopy', 'peripheral-navigation'],
      technologyTags: ['electromagnetic-navigation', 'robotic-bronchoscopy'],
      clinicalPurposes: ['diagnosis', 'staging'],
      diseaseTags: ['lung-cancer', 'mesothelioma'],
    })
    expect(review).toMatchObject(sourceArrays)

    const reordered = JSON.parse(JSON.stringify(snapshot)) as RawDatabaseSnapshot
    const reorderedRow = reordered.developmentItems[0] as Record<string, unknown>
    const reorderedReview = (reorderedRow.reviews as Array<Record<string, unknown>>)[0]
    for (const field of Object.keys(sourceArrays)) {
      reorderedReview[field] = [...(reorderedReview[field] as string[])].reverse()
    }
    expect(canonicalJson(buildDevelopmentPlanningState(reordered))).toBe(
      canonicalJson(planningState),
    )
    expect(developmentPlanningStateSha256(reordered)).toBe(developmentPlanningStateSha256(snapshot))
  })

  it('emits a full-row development database seed and rejects cross-split rows', () => {
    const seed = buildDevelopmentDatabaseSeed(preMigrationSnapshot())
    expect(seed).toMatchObject({
      schemaVersion: 'gold-import-compensation-development-seed/v1',
      datasetSplit: 'development',
      heldOutIdentitiesIncluded: false,
      batchId: IDS.batch,
      tables: {
        literature_articles: [{ pmid: '12345678' }],
        literature_gold_set_items: [{ dataset_split: 'development' }],
        literature_gold_set_reviews: [{ item_id: IDS.item }],
      },
    })
    const contaminated = preMigrationSnapshot()
    ;(contaminated.developmentSeed.items as Array<Record<string, unknown>>)[0].dataset_split =
      'test'
    expect(() => buildDevelopmentDatabaseSeed(contaminated)).toThrow(/held-out/iu)
  })

  it.each([
    { reviewIds: ['secret'] },
    { heldOutIdentities: [{ value: 'secret' }] },
    { testItems: ['secret'] },
    { rows: [{ pmid: 'secret' }] },
  ])('rejects batch-event camelCase, plural, and generic identity containers', (payload) => {
    const snapshot = preMigrationSnapshot()
    const batchEvent = (snapshot.developmentSeed.events as Array<Record<string, unknown>>).find(
      (event) => event.item_id === null,
    )
    if (batchEvent) batchEvent.after_value = payload
    expect(() => buildDevelopmentDatabaseSeed(snapshot)).toThrow(/approved aggregate keys/iu)
  })

  it('allows only the current aggregate batch_created payload shape', () => {
    const seed = buildDevelopmentDatabaseSeed(preMigrationSnapshot())
    expect(seed.tables.literature_gold_set_events).toContainEqual(
      expect.objectContaining({
        item_id: null,
        event_type: 'batch_created',
        before_value: null,
        after_value: {
          kind: 'gold_standard',
          name: 'gold-set-v1',
          requested_size: 2,
          sampling_seed: 20260808,
        },
      }),
    )
  })

  it.each([
    { field: 'event_type', value: 'test_split_unlocked' },
    { field: 'before_value', value: { status: 'pending' } },
    { field: 'heldOutIdentities', value: ['secret'] },
    {
      field: 'after_value',
      value: {
        kind: 'gold_standard',
        name: 'gold-set-v1',
        requested_size: 2,
        sampling_seed: 20260808,
        testItemCount: 1,
      },
    },
    {
      field: 'after_value',
      value: {
        kind: 'gold_standard',
        name: 'gold-set-v1',
        requested_size: 2,
        sampling_seed: 7,
      },
    },
  ])('rejects unknown or mismatched batch-event shape: $field', ({ field, value }) => {
    const snapshot = preMigrationSnapshot()
    const batchEvent = (snapshot.developmentSeed.events as Array<Record<string, unknown>>).find(
      (event) => event.item_id === null,
    )
    if (batchEvent) batchEvent[field] = value
    expect(() => buildDevelopmentDatabaseSeed(snapshot)).toThrow(/batch|approved/iu)
  })

  it.each(['items', 'pmids', 'reviewIds', 'rows'])(
    'rejects sampling-report identity container %s',
    (key) => {
      const snapshot = preMigrationSnapshot()
      const batch = (snapshot.developmentSeed.batches as Array<Record<string, unknown>>)[0]
      const report = batch.sampling_report as Record<string, unknown>
      report[key] = ['secret']
      expect(() => buildDevelopmentDatabaseSeed(snapshot)).toThrow(/approved aggregate keys/iu)
    },
  )

  it('rejects PMID-shaped dynamic sampling-report count keys', () => {
    const snapshot = preMigrationSnapshot()
    const batch = (snapshot.developmentSeed.batches as Array<Record<string, unknown>>)[0]
    const report = batch.sampling_report as Record<string, unknown>
    report.countsByJournal = { '12345678': 2 }
    expect(() => buildDevelopmentDatabaseSeed(snapshot)).toThrow(/PMID-shaped/iu)
  })

  it('rejects raw exclusion-source PMID arrays instead of accepting the stored aggregate projection', () => {
    const snapshot = preMigrationSnapshot()
    const batch = (snapshot.developmentSeed.batches as Array<Record<string, unknown>>)[0]
    const report = batch.sampling_report as Record<string, unknown>
    report.exclusionSources = [
      {
        batchNames: [],
        corpusPresentCount: 0,
        eligibleCount: 0,
        excludedCount: 0,
        path: null,
        pmids: ['12345678'],
        sha256: null,
        sourceType: 'pmid_manifest',
        suppliedCount: 1,
      },
    ]
    expect(() => buildDevelopmentDatabaseSeed(snapshot)).toThrow(/approved aggregate keys/iu)
  })

  it('reports not_yet_migrated without lint, planning rows, import, or compensation', () => {
    const { input } = preMigrationInput()
    const audit = auditPostMigration({
      preMigration: input,
      repositoryCommitSha: 'a'.repeat(40),
      snapshot: preMigrationSnapshot(),
    })
    expect(audit.report).toMatchObject({
      status: 'not_yet_migrated',
      readinessStatus: 'not_yet_migrated',
      migration: { applied: false, ledgerOccurrences: 0 },
      database: {
        developmentPlanningStateSha256: null,
        readOnlyAudit: true,
        heldOutIdentitiesAccessed: false,
        stateFresh: true,
      },
      comparisons: { schemaChangedAsExpected: false },
      checks: {
        importExecuted: false,
        compensationExecuted: false,
        databaseMutationCount: 0,
      },
    })
    expect(audit.report).not.toHaveProperty('planningRows')
    const artifacts = buildAuditArtifacts({ audit, snapshot: preMigrationSnapshot() })
    expect([...artifacts.files.keys()].sort()).toEqual([
      'migration-audit.json',
      'migration-audit.md',
    ])
    expect(artifacts.manifest).not.toContain('development-planning-state.json')

    const database = audit.report.database as Record<string, unknown>
    const misleadingAudit = {
      ...audit,
      report: {
        ...audit.report,
        database: { ...database, developmentPlanningStateSha256: 'f'.repeat(64) },
      },
    }
    expect(() =>
      buildAuditArtifacts({ audit: misleadingAudit, snapshot: preMigrationSnapshot() }),
    ).toThrow(/non-ready audit/iu)
  })

  it('does not allow a production audit caller to self-authorize schema drift', () => {
    const originalNodeEnvironment = process.env.NODE_ENV
    Reflect.set(process.env, 'NODE_ENV', 'production')
    try {
      const { input } = preMigrationInput()
      expect(() =>
        auditPostMigration({
          preMigration: input,
          repositoryCommitSha: 'a'.repeat(40),
          snapshot: preMigrationSnapshot(),
          testOnlyExpectedSchemaSecurityIdentitySha256: 'f'.repeat(64),
        }),
      ).toThrow(/test-only/iu)
    } finally {
      Reflect.set(process.env, 'NODE_ENV', originalNodeEnvironment)
    }
  })

  it('blocks an expected migration version recorded under the wrong name', () => {
    const { input } = preMigrationInput()
    const snapshot = postMigrationSnapshot()
    snapshot.migrationLedger = [{ version: '20260808035633', name: 'wrong_migration_name' }]
    const audit = auditPostMigration({
      preMigration: input,
      repositoryCommitSha: 'a'.repeat(40),
      snapshot,
    })
    expect(audit.report).toMatchObject({
      status: 'blocked',
      migration: { applied: false, ledgerOccurrences: 0 },
    })
  })

  it('passes migrated schema, RLS, ACL, state-preservation, and exact lint checks', () => {
    const audit = auditMigratedSnapshot(postMigrationSnapshot())
    expect(audit.report).toMatchObject({
      status: 'ready',
      readinessStatus: 'ready',
      migration: { applied: true, ledgerOccurrences: 1 },
      comparisons: {
        effectiveStatePreserved: true,
        priorPhysicalStatePreserved: true,
        reviewMutationCount: 0,
        pointerMutationCount: 0,
        aggregateTestLockStateUnchanged: true,
      },
      database: {
        currentPhysicalStateSha256: 'f'.repeat(64),
        currentPointersAreLatestHeads: true,
        developmentPlanningStateSha256: developmentPlanningStateSha256(postMigrationSnapshot()),
        revisionChainsLinear: true,
        testSplitLocked: true,
      },
      checks: { failures: [] },
    })
  })

  it('blocks an unexpected policy on any protected table', () => {
    const snapshot = postMigrationSnapshot()
    const schema = snapshot.schema as { policies: Array<Record<string, unknown>> }
    schema.policies.push({
      name: 'unexpected_protected_policy',
      table_name: 'literature_gold_set_items',
      command: 'ALL',
      permissive: 'PERMISSIVE',
      roles: ['service_role'],
      using_expression: "dataset_split = 'development'",
      with_check_expression: "dataset_split = 'development'",
    })

    const audit = auditMigratedSnapshot(snapshot)
    expect(audit.report.status).toBe('blocked')
    expect(canonicalJson(audit.report)).toMatch(/journal RLS policy set changed/iu)
  })

  it('blocks an unexpected non-constraint index on any protected table', () => {
    const snapshot = postMigrationSnapshot()
    const schema = snapshot.schema as { indexes: Array<Record<string, unknown>> }
    schema.indexes.push({
      name: 'unexpected_protected_index',
      table_name: 'literature_gold_set_items',
      owner: 'supabase_admin',
      is_unique: true,
      is_valid: true,
      constraint_backed: false,
      predicate: null,
      definition:
        'CREATE UNIQUE INDEX unexpected_protected_index ON public.literature_gold_set_items (id)',
    })

    const audit = auditMigratedSnapshot(snapshot)
    expect(audit.report.status).toBe('blocked')
    expect(canonicalJson(audit.report)).toMatch(/required unique index set changed/iu)
  })

  it('blocks a missing legacy non-constraint index', () => {
    const snapshot = postMigrationSnapshot()
    const schema = snapshot.schema as { indexes: Array<Record<string, unknown>> }
    schema.indexes = schema.indexes.filter(
      (entry) => entry.name !== 'literature_gold_set_items_pmid_idx',
    )

    const audit = auditMigratedSnapshot(snapshot)
    expect(audit.report.status).toBe('blocked')
    expect(canonicalJson(audit.report)).toMatch(
      /__missing_expected_index__:literature_gold_set_items_pmid_idx/iu,
    )
  })

  it('blocks an altered legacy non-constraint index', () => {
    const snapshot = postMigrationSnapshot()
    const schema = snapshot.schema as { indexes: Array<Record<string, unknown>> }
    const legacyIndex = schema.indexes.find(
      (entry) => entry.name === 'literature_gold_set_items_split_idx',
    )
    if (legacyIndex) legacyIndex.is_valid = false

    const audit = auditMigratedSnapshot(snapshot)
    expect(audit.report.status).toBe('blocked')
    expect(canonicalJson(audit.report)).toMatch(/literature_gold_set_items_split_idx/iu)
  })

  it('binds the ready audit, emitted planning state, and canonical manifest together', () => {
    const { contractStateHashes, input } = preMigrationInput()
    const snapshot = postMigrationSnapshot()
    const audit = auditPostMigration({
      contractStateHashes,
      contractStateHashesBefore: contractStateHashes,
      testOnlyExpectedSchemaSecurityIdentitySha256: schemaSecurityDefinitionIdentitySha256({
        catalog: postMigrationSnapshot().schema,
      }),
      lint: validLint(),
      preMigration: input,
      repositoryCommitSha: 'a'.repeat(40),
      snapshot,
    })
    const artifacts = buildAuditArtifacts({ audit, snapshot })
    const planningBytes = artifacts.files.get('development-planning-state.json')
    const auditBytes = artifacts.files.get('migration-audit.json')
    expect(planningBytes).toBeDefined()
    expect(auditBytes).toBeDefined()
    const parsedPlanning = JSON.parse(planningBytes as string) as unknown
    const semanticPlanningSha256 = sha256ContractCanonical(parsedPlanning)
    const database = audit.report.database as Record<string, unknown>
    expect(database.developmentPlanningStateSha256).toBe(semanticPlanningSha256)
    expect(semanticPlanningSha256).toBe(developmentPlanningStateSha256(snapshot))
    expect(planningBytes).toBe(canonicalJson(parsedPlanning))
    expect(artifacts.manifest).toContain(
      `${sha256(planningBytes as string)}  development-planning-state.json\n`,
    )
    expect(artifacts.manifest).toContain(`${sha256(auditBytes as string)}  migration-audit.json\n`)
    expect(artifacts.manifestSha256).toBe(sha256(artifacts.manifest))

    const planning = parsedPlanning as { rows: Array<Record<string, unknown>> }
    const tamperedPlanning = {
      ...(parsedPlanning as Record<string, unknown>),
      rows: planning.rows.map((row, index) => (index === 0 ? { ...row, pmid: '87654321' } : row)),
    }
    expect(sha256ContractCanonical(tamperedPlanning)).not.toBe(semanticPlanningSha256)
    expect(artifacts.manifest).not.toContain(
      `${sha256(canonicalJson(tamperedPlanning))}  development-planning-state.json\n`,
    )

    const mismatchedAudit = {
      ...audit,
      report: {
        ...audit.report,
        database: { ...database, developmentPlanningStateSha256: 'f'.repeat(64) },
      },
    }
    expect(() => buildAuditArtifacts({ audit: mismatchedAudit, snapshot })).toThrow(
      /planning-state binding/iu,
    )
  })

  it('counts review and pointer deletions symmetrically', () => {
    const { contractStateHashes, input } = preMigrationInput()
    const snapshot = postMigrationSnapshot()
    snapshot.developmentItems = []
    const audit = auditPostMigration({
      contractStateHashes,
      contractStateHashesBefore: contractStateHashes,
      testOnlyExpectedSchemaSecurityIdentitySha256: schemaSecurityDefinitionIdentitySha256({
        catalog: postMigrationSnapshot().schema,
      }),
      lint: validLint(),
      preMigration: input,
      repositoryCommitSha: 'a'.repeat(40),
      snapshot,
    })
    expect(audit.report).toMatchObject({
      status: 'blocked',
      comparisons: { reviewMutationCount: 1, pointerMutationCount: 1 },
    })
  })

  it('blocks physical state changes across the fresh-snapshot hash bracket', () => {
    const { contractStateHashes, input } = preMigrationInput()
    const audit = auditPostMigration({
      contractStateHashes,
      contractStateHashesBefore: {
        ...contractStateHashes,
        physicalStateSha256: 'e'.repeat(64),
      },
      testOnlyExpectedSchemaSecurityIdentitySha256: schemaSecurityDefinitionIdentitySha256({
        catalog: postMigrationSnapshot().schema,
      }),
      lint: validLint(),
      preMigration: input,
      repositoryCommitSha: 'a'.repeat(40),
      snapshot: postMigrationSnapshot(),
    })
    expect(audit.report).toMatchObject({ status: 'blocked', database: { stateFresh: false } })
    expect(canonicalJson(audit.report)).toMatch(/physical state changed during the audit/iu)
  })

  it('blocks migrated drift when RLS or immutable-review ACLs are unsafe', () => {
    const { contractStateHashes, input } = preMigrationInput()
    const snapshot = postMigrationSnapshot()
    const schema = snapshot.schema as {
      functions: Array<Record<string, unknown>>
      tables: Array<Record<string, unknown>>
      tablePrivileges: Array<Record<string, unknown>>
    }
    const reviews = schema.tables.find(
      (table) => table.table_name === 'literature_gold_set_reviews',
    )
    if (reviews) reviews.rls_enabled = false
    const publicInsert = schema.tablePrivileges.find(
      (entry) =>
        entry.table_name === 'literature_gold_set_reviews' &&
        entry.role_name === 'public' &&
        entry.privilege_name === 'INSERT',
    )
    if (publicInsert) publicInsert.granted = true
    const journalTrigger = schema.tablePrivileges.find(
      (entry) =>
        entry.table_name === 'literature_gold_review_operations' &&
        entry.role_name === 'service_role' &&
        entry.privilege_name === 'TRIGGER',
    )
    if (journalTrigger) journalTrigger.granted = true
    const importFunction = schema.functions.find(
      (entry) => entry.name === 'apply_literature_gold_import_v1',
    )
    if (importFunction) importFunction.volatility = 's'
    const audit = auditPostMigration({
      contractStateHashes,
      contractStateHashesBefore: contractStateHashes,
      testOnlyExpectedSchemaSecurityIdentitySha256: schemaSecurityDefinitionIdentitySha256({
        catalog: postMigrationSnapshot().schema,
      }),
      lint: validLint(),
      preMigration: input,
      repositoryCommitSha: 'a'.repeat(40),
      snapshot,
    })
    expect(audit.report.status).toBe('blocked')
    expect(canonicalJson(audit.report)).toMatch(/RLS is not enabled/iu)
    expect(canonicalJson(audit.report)).toMatch(/Prohibited journal privilege/iu)
    expect(canonicalJson(audit.report)).toMatch(/RPC execution contract mismatch/iu)
  })

  it.each(['forced RLS', 'effective column grant'])(
    'blocks post-migration %s through the exact schema/security identity',
    (mutation) => {
      const snapshot = postMigrationSnapshot()
      const schema = snapshot.schema as {
        columnPrivileges: Array<Record<string, unknown>>
        tables: Array<Record<string, unknown>>
      }
      if (mutation === 'forced RLS') {
        const reviews = schema.tables.find(
          (table) => table.table_name === 'literature_gold_set_reviews',
        )
        if (reviews) reviews.force_rls = true
      } else {
        const grant = schema.columnPrivileges.find(
          (entry) =>
            entry.table_name === 'literature_gold_set_reviews' &&
            entry.column_name === 'operation_action_id' &&
            entry.role_name === 'anon' &&
            entry.privilege_name === 'UPDATE',
        )
        if (grant) grant.granted = true
      }
      const audit = auditMigratedSnapshot(snapshot)
      expect(audit.report.status).toBe('blocked')
      expect(canonicalJson(audit.report)).toMatch(/definition identity mismatch/iu)
    },
  )
})
