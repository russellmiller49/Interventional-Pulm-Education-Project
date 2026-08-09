/** @jest-environment node */

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  assertLocalDockerEndpoint,
  buildCanonicalScenarioEvidence,
  buildSchemaSecurityDefinitionIdentity,
  canonicalJson,
  compareSchemaSecurityDefinitionRecords,
  EXACT_MIXED_PACKAGE_COUNTS,
  extractSqlScenarioEvidence,
  parseRehearsalCliArguments,
  normalizePostgresDefinition,
  POST_MIGRATION_SCHEMA_SECURITY_IDENTITY_SHA256,
  REQUIRED_CONSTRAINTS,
  REQUIRED_EVENT_TYPES,
  REQUIRED_JOURNAL_ROLES,
  REQUIRED_JOURNAL_POLICIES,
  REQUIRED_JOURNAL_TABLES,
  REQUIRED_ORDINARY_ROLES,
  REQUIRED_RLS_TABLES,
  REQUIRED_SAFE_SEARCH_PATH_SCHEMAS,
  REQUIRED_SCENARIO_IDS,
  REQUIRED_TRANSITION_FUNCTIONS,
  REQUIRED_TRIGGERS,
  REQUIRED_UNIQUE_INDEX_TABLES,
  REQUIRED_UNIQUE_INDEXES,
  SCENARIO_EVIDENCE_MARKER,
  SCENARIO_EVIDENCE_SCHEMA_VERSION,
  SCHEMA_SECURITY_COLUMN_PRIVILEGES,
  SCHEMA_SECURITY_COLUMN_ROLES,
  schemaSecurityDefinitionIdentitySha256,
  sanitizeRehearsalChildEnvironment,
  validateSecurityIntrospection,
  validateSchemaSecurityDefinitionIdentity,
  validateSqlScenarioEvidence,
  validateSupabaseLint,
  type RawSqlScenarioEvidence,
  type ScenarioEvidenceRecord,
  type ScenarioStateEvidence,
} from './gold-import-compensation-rehearsal-evidence'
import { assertSerializedAggregateOrdering } from './gold-import-compensation-migration-operations'
import {
  SCHEMA_DEFINITION_MUTATION_PROBES,
  SECURITY_INTROSPECTION_SQL,
} from './rehearse-gold-import-compensation-db'

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function minifiedCanonicalJson(value: unknown) {
  return JSON.stringify(JSON.parse(canonicalJson(value)) as unknown)
}

function deterministicallyShuffle<T>(values: T[], seed = 0x5eed): T[] {
  let state = seed >>> 0
  for (let index = values.length - 1; index > 0; index -= 1) {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    const target = state % (index + 1)
    ;[values[index], values[target]] = [values[target] as T, values[index] as T]
  }
  return values
}

const FIXED_IMAGE_SCHEMA_IDENTITY_PATH = resolve(
  process.cwd(),
  'scripts/literature/fixtures/post-migration-schema-security-definition-identity.json',
)

async function loadFixedImageSchemaIdentity() {
  const bytes = await readFile(FIXED_IMAGE_SCHEMA_IDENTITY_PATH, 'utf8')
  return { bytes, value: JSON.parse(bytes) as unknown }
}

function uuid(value: string) {
  return `00000000-0000-4000-8000-${digest(value).slice(0, 12)}`
}

function state(label: string): ScenarioStateEvidence {
  return {
    reviewCount: 1,
    eventCount: 2,
    currentPointer: uuid(`synthetic-pointer-${label}`),
    maxRevision: 1,
    effectiveStateHash: digest(`effective-${label}`),
    physicalStateHash: digest(`physical-${label}`),
  }
}

function scenario(
  scenarioId: (typeof REQUIRED_SCENARIO_IDS)[number],
  index: number,
): ScenarioEvidenceRecord {
  const preState = state(`${index}-pre`)
  const postState = { ...preState }
  const record: ScenarioEvidenceRecord = {
    scenarioId,
    description: `Executed synthetic disposable scenario ${index + 1}.`,
    status: 'passed',
    databaseContractInvoked: true,
    rpcOrFunctionNames: ['apply_literature_gold_import_v1'],
    preState,
    expectedResult: { outcome: 'controlled' },
    actualResult: { outcome: 'controlled' },
    postState,
    assertions: [{ name: 'runtime assertion', passed: true, expected: true, actual: true }],
    sqlstateOrOutcome: 'committed',
    mutationCount: 0,
  }

  if (index === 2) {
    record.actualResult = {
      ...EXACT_MIXED_PACKAGE_COUNTS,
      eventCounts: { import_started: 1, review_imported: 624, import_completed: 1 },
      insertRevisionCounts: { revision1: 621, revision2: 3 },
      changedPointerCount: 624,
      unchangedNoopPointerCount: 6,
      finalMatchingHeadCount: 630,
      uniqueActionIdentities: 630,
      idempotentReplay: true,
    }
    record.expectedResult = structuredClone(record.actualResult)
    record.mutationCount = 624
  }
  if (index === 6) {
    record.preState = {
      ...preState,
      effectiveStateHash: digest('restored-effective'),
      physicalStateHash: digest('before-import-physical'),
    }
    record.postState = {
      ...postState,
      effectiveStateHash: digest('restored-effective'),
      physicalStateHash: digest('after-compensation-physical'),
    }
    record.mutationCount = 1
  }
  if (index === 3 || index === 8) {
    record.postState = {
      ...postState,
      eventCount: preState.eventCount + 2,
      physicalStateHash: digest(`sealed-failure-physical-${index}`),
    }
    record.actualResult = {
      outcome: 'failed',
      receiptAfterPhysicalStateSha256: record.postState.physicalStateHash,
      eventSequence:
        index === 3
          ? ['import_started', 'import_failed']
          : ['import_compensation_started', 'import_compensation_failed'],
      physicalAuditSealed: true,
      physicalAuditChanged: true,
      effectiveStateChanged: false,
    }
    record.expectedResult = structuredClone(record.actualResult)
  }
  if (index === 4) {
    record.actualResult = {
      clientObservedReceipt: false,
      databaseStatus: 'completed',
      automaticRetryPermitted: false,
      durableCommitObserved: true,
    }
    record.expectedResult = structuredClone(record.actualResult)
    record.mutationCount = 1
  }
  if (index === 10 || index === 11) {
    record.postState = {
      ...postState,
      reviewCount: preState.reviewCount + 1,
      maxRevision: preState.maxRevision + 1,
      currentPointer: uuid(`synthetic-ordinary-pointer-${index}`),
      effectiveStateHash: digest(`ordinary-effective-${index}`),
      physicalStateHash: digest(`ordinary-physical-${index}`),
    }
    record.expectedResult.reviewId = record.postState.currentPointer
    record.actualResult.reviewId = record.postState.currentPointer
    record.mutationCount = 1
  }
  return record
}

function validEvidence(): RawSqlScenarioEvidence {
  return {
    schemaVersion: SCENARIO_EVIDENCE_SCHEMA_VERSION,
    mixedPackageCounts: { ...EXACT_MIXED_PACKAGE_COUNTS },
    scenarios: REQUIRED_SCENARIO_IDS.map(scenario),
    allScenariosPassed: true,
  }
}

function lintIssue() {
  return {
    level: 'warning',
    message: 'routine is marked as IMMUTABLE, but expression is STABLE',
    statement: { lineNumber: '1', text: 'SQL statement' },
    hint: 'Recheck callers.',
    detail: 'Volatility classification differs.',
    sqlState: '00000',
  }
}

function validLint() {
  return [
    {
      function: 'public.literature_gold_canonical_json_v1',
      issues: [lintIssue()],
    },
    {
      function: 'public.literature_gold_is_timestamptz_v1',
      issues: [lintIssue()],
    },
    {
      function: 'public.assert_literature_gold_jsonb_scalar_v1',
      issues: [lintIssue(), lintIssue()],
    },
  ]
}

function validIntrospection() {
  const completeConstraintDefinition = [
    'CHECK',
    'artifact_sha256',
    'plan_sha256',
    'authorization_sha256',
    'pre_physical_state_sha256',
    'pre_effective_state_sha256',
    'planned_action_count',
    'planned_apply_count',
    'planned_noop_count',
    'applied_action_count',
    'noop_action_count',
    "status = 'started'",
    "status = 'completed'",
    "status = 'failed'",
    'error_sqlstate',
    'import_initial',
    'import_revision',
    'import_noop',
    'compensate_restore',
    'compensate_void',
    'compensate_noop',
    "action_status = 'planned'",
    "action_status = 'applied'",
    "action_status = 'noop'",
    "action_status = 'failed'",
    "revision_kind = 'standard'",
    "revision_kind = 'import'",
    "revision_kind = 'compensation'",
    'effective_source_review_id',
    'import_completed',
    'import_compensation_started',
    'review_compensated',
    'review_voided',
    'import_compensation_completed',
    'import_compensation_failed',
  ].join(' ')
  const tablePrivileges = REQUIRED_RLS_TABLES.flatMap((tableName) =>
    REQUIRED_JOURNAL_ROLES.flatMap((role) =>
      ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'].map(
        (privilegeName) => ({
          table_name: tableName,
          role_name: role,
          privilege_name: privilegeName,
          granted:
            role === 'service_role' &&
            ((['literature_gold_set_reviews', 'literature_gold_set_events'].includes(tableName) &&
              ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(privilegeName)) ||
              (REQUIRED_JOURNAL_TABLES.includes(
                tableName as (typeof REQUIRED_JOURNAL_TABLES)[number],
              ) &&
                privilegeName === 'SELECT')),
        }),
      ),
    ),
  )
  const report = {
    rls: REQUIRED_RLS_TABLES.map((tableName) => ({
      tableName,
      rlsEnabled: true,
      rlsForced: false,
    })),
    functions: REQUIRED_TRANSITION_FUNCTIONS.map((name) => ({
      name,
      identityArguments: 'p_operation_id uuid',
      owner: 'supabase_admin',
      securityDefiner: true,
      searchPath: 'pg_catalog, public, extensions',
      resultType: 'jsonb',
      volatility: name.startsWith('reconcile') ? 's' : 'v',
      definition: `CREATE FUNCTION ${name}(p_operation_id uuid) RETURNS jsonb SECURITY DEFINER SET search_path = pg_catalog, public, extensions`,
      publicExecute: false,
      anonExecute: false,
      authenticatedExecute: false,
      serviceRoleExecute: true,
    })),
    reviewPrivileges: {
      publicInsert: false,
      publicUpdate: false,
      publicDelete: false,
      publicTruncate: false,
      publicReferences: false,
      publicTrigger: false,
      anonInsert: false,
      anonUpdate: false,
      anonDelete: false,
      anonTruncate: false,
      anonReferences: false,
      anonTrigger: false,
      authenticatedInsert: false,
      authenticatedUpdate: false,
      authenticatedDelete: false,
      authenticatedTruncate: false,
      authenticatedReferences: false,
      authenticatedTrigger: false,
      serviceRoleSelect: true,
      serviceRoleInsert: true,
      serviceRoleUpdate: true,
      serviceRoleDelete: true,
      serviceRoleTruncate: false,
      serviceRoleReferences: false,
      serviceRoleTrigger: false,
    },
    eventPrivileges: {
      publicInsert: false,
      publicUpdate: false,
      publicDelete: false,
      publicTruncate: false,
      publicReferences: false,
      publicTrigger: false,
      anonInsert: false,
      anonUpdate: false,
      anonDelete: false,
      anonTruncate: false,
      anonReferences: false,
      anonTrigger: false,
      authenticatedInsert: false,
      authenticatedUpdate: false,
      authenticatedDelete: false,
      authenticatedTruncate: false,
      authenticatedReferences: false,
      authenticatedTrigger: false,
      serviceRoleSelect: true,
      serviceRoleInsert: true,
      serviceRoleUpdate: true,
      serviceRoleDelete: true,
      serviceRoleTruncate: false,
      serviceRoleReferences: false,
      serviceRoleTrigger: false,
    },
    journalPrivileges: REQUIRED_JOURNAL_TABLES.flatMap((tableName) =>
      REQUIRED_JOURNAL_ROLES.map((role) => ({
        tableName,
        role,
        select: role === 'service_role',
        insert: false,
        update: false,
        delete: false,
        truncate: false,
        references: false,
        trigger: false,
      })),
    ),
    schemaCreatePrivileges: REQUIRED_SAFE_SEARCH_PATH_SCHEMAS.flatMap((schemaName) =>
      REQUIRED_ORDINARY_ROLES.map((role) => ({
        schemaName,
        role,
        owner: 'supabase_admin',
        create: false,
      })),
    ),
    constraints: [...REQUIRED_CONSTRAINTS],
    constraintDefinitions: REQUIRED_CONSTRAINTS.map((name) => ({
      name,
      tableName: 'literature_gold_set_reviews',
      definition: completeConstraintDefinition,
      validated: true,
    })),
    uniqueIndexes: REQUIRED_UNIQUE_INDEXES.map((name) => ({
      name,
      tableName: REQUIRED_UNIQUE_INDEX_TABLES[name],
      unique: true,
      valid: true,
      constraintBacked: false,
      predicate:
        'operation_id IS NOT NULL supersedes_review_id IS NOT NULL operation_action_id IS NOT NULL',
      definition: [
        'CREATE UNIQUE INDEX',
        'target_import_operation_id',
        "operation_kind = 'compensation'",
        "status = ANY (ARRAY['started'",
        'operation_id',
        'operation_event_sequence',
        'operation_id IS NOT NULL',
        'supersedes_review_id',
        'supersedes_review_id IS NOT NULL',
        'operation_action_id',
        'operation_action_id IS NOT NULL',
      ].join(' '),
    })),
    journalPolicies: REQUIRED_JOURNAL_POLICIES.map((name) => ({
      name,
      tableName: name.includes('actions')
        ? 'literature_gold_review_operation_actions'
        : 'literature_gold_review_operations',
      command: 'ALL',
      permissive: 'PERMISSIVE',
      roles: ['service_role'],
      using: name.includes('actions')
        ? 'EXISTS public.literature_gold_review_operations development'
        : "dataset_split = 'development'",
      withCheck: name.includes('actions')
        ? 'EXISTS public.literature_gold_review_operations development'
        : "dataset_split = 'development'",
    })),
    triggers: REQUIRED_TRIGGERS.map((name) => ({
      name,
      tableName: 'literature_gold_set_reviews',
      enableMode: 'O',
      enabled: true,
      definition: `CREATE TRIGGER ${name} BEFORE INSERT ON public.literature_gold_set_reviews FOR EACH ROW EXECUTE FUNCTION ${name}()`,
    })),
    supportedEventTypes: [...REQUIRED_EVENT_TYPES],
  }
  return {
    ...report,
    catalog: {
      tables: REQUIRED_RLS_TABLES.map((table_name) => ({
        table_name,
        relation_kind: 'r',
        rls_enabled: true,
        force_rls: false,
        owner: 'supabase_admin',
      })),
      columns: [],
      columnPrivileges: [],
      functions: report.functions.map((entry) => ({
        name: entry.name,
        identity_arguments: entry.identityArguments,
        result_type: entry.resultType,
        volatility: entry.volatility,
        security_definer: entry.securityDefiner,
        owner: entry.owner,
        search_path: entry.searchPath,
        definition: entry.definition,
      })),
      constraints: report.constraintDefinitions.map((entry) => ({
        name: entry.name,
        table_name: entry.tableName,
        definition: entry.definition,
        validated: entry.validated,
      })),
      indexes: report.uniqueIndexes.map((entry) => ({
        name: entry.name,
        table_name: entry.tableName,
        owner: 'supabase_admin',
        is_unique: entry.unique,
        is_valid: entry.valid,
        constraint_backed: entry.constraintBacked,
        predicate: entry.predicate,
        definition: entry.definition,
      })),
      triggers: report.triggers.map((entry) => ({
        name: entry.name,
        table_name: entry.tableName,
        enable_mode: entry.enableMode,
        enabled: entry.enabled,
        definition: entry.definition,
      })),
      policies: report.journalPolicies.map((entry) => ({
        name: entry.name,
        table_name: entry.tableName,
        command: entry.command,
        permissive: entry.permissive,
        roles: entry.roles,
        using_expression: entry.using,
        with_check_expression: entry.withCheck,
      })),
      tablePrivileges,
      schemaCreatePrivileges: report.schemaCreatePrivileges.map((entry) => ({
        schema_name: entry.schemaName,
        role_name: entry.role,
        owner: entry.owner,
        granted: entry.create,
      })),
      tableAclEntries: [],
      columnAclEntries: [],
      functionAclEntries: [],
      schemaAclEntries: [],
      supportedEventTypes: [...REQUIRED_EVENT_TYPES],
    },
  }
}

function addSyntheticProtectedColumn(
  source: ReturnType<typeof validIntrospection>,
  options: { explicitGrant?: boolean; granted?: boolean } = {},
) {
  const catalog = source.catalog as unknown as {
    columnAclEntries: Array<Record<string, unknown>>
    columnPrivileges: Array<Record<string, unknown>>
    columns: Array<Record<string, unknown>>
  }
  const tableName = 'literature_gold_set_reviews'
  const columnName = 'synthetic_protected_column'
  catalog.columns.push({
    table_name: tableName,
    ordinal_position: 99,
    column_name: columnName,
    data_type: 'text',
    udt_name: 'text',
    is_nullable: 'YES',
    column_default: null,
  })
  catalog.columnPrivileges.push(
    ...SCHEMA_SECURITY_COLUMN_ROLES.flatMap((role_name) =>
      SCHEMA_SECURITY_COLUMN_PRIVILEGES.map((privilege_name) => ({
        table_name: tableName,
        column_name: columnName,
        role_name,
        privilege_name,
        granted: options.granted === true && role_name === 'anon' && privilege_name === 'UPDATE',
      })),
    ),
  )
  if (options.explicitGrant) {
    catalog.columnAclEntries.push({
      schema_name: 'public',
      table_name: tableName,
      column_name: columnName,
      grantee: 'anon',
      grantor: 'supabase_admin',
      privilege_type: 'UPDATE',
      is_grantable: false,
    })
  }
}

describe('gold import-compensation rehearsal evidence', () => {
  it('locks exactly 20 stable unique scenario IDs and exact mixed-package counts', () => {
    expect(REQUIRED_SCENARIO_IDS).toHaveLength(20)
    expect(new Set(REQUIRED_SCENARIO_IDS).size).toBe(20)
    expect(REQUIRED_SCENARIO_IDS).toEqual([
      'S01_initial_import_success',
      'S02_revision_import_success',
      'S03_exact_mixed_package',
      'S04_import_failure_before_commit',
      'S05_ambiguous_outcome',
      'S06_read_only_reconciliation',
      'S07_restore_compensation',
      'S08_void_compensation',
      'S09_compensation_failure_before_commit',
      'S10_compensation_idempotent_replay',
      'S11_standard_review_after_restore',
      'S12_standard_review_after_void',
      'S13_stale_before_state_rejected',
      'S14_stale_authorization_rejected',
      'S15_wrong_import_operation_id_rejected',
      'S16_wrong_compensation_operation_id_rejected',
      'S17_second_compensation_rejected',
      'S18_held_out_item_rejected',
      'S19_pointer_rewind_and_history_mutation_rejected',
      'S20_legacy_pointer_rewind_plan_rejected',
    ])
    expect(EXACT_MIXED_PACKAGE_COUNTS).toEqual({
      initialActions: 621,
      revisionActions: 3,
      noopActions: 6,
      totalActions: 630,
      insertedReviews: 624,
    })
  })

  it('requires the single SQL marker and parses its verifier-produced JSON', () => {
    const evidence = validEvidence()
    const output = `NOTICE: before\nNOTICE: ${SCENARIO_EVIDENCE_MARKER}${JSON.stringify(evidence)}\nROLLBACK\n`
    expect(validateSqlScenarioEvidence(extractSqlScenarioEvidence(output))).toEqual(evidence)
    expect(() => extractSqlScenarioEvidence('NOTICE: no marker')).toThrow(
      'did not emit scenario evidence',
    )
    expect(() => extractSqlScenarioEvidence(`${output}${output}`)).toThrow(
      'duplicate scenario evidence markers',
    )
  })

  it('fails missing, duplicate, failed, or evidence-free scenarios', () => {
    const missing = validEvidence()
    missing.scenarios.pop()
    expect(() => validateSqlScenarioEvidence(missing)).toThrow('exactly 20')

    const duplicate = validEvidence()
    duplicate.scenarios[19] = {
      ...duplicate.scenarios[19],
      scenarioId: duplicate.scenarios[18].scenarioId,
    }
    expect(() => validateSqlScenarioEvidence(duplicate)).toThrow('scenarioId must be')

    const failed = validEvidence()
    failed.scenarios[0] = { ...failed.scenarios[0], status: 'failed' as 'passed' }
    expect(() => validateSqlScenarioEvidence(failed)).toThrow('did not pass')

    const notInvoked = validEvidence()
    notInvoked.scenarios[0] = {
      ...notInvoked.scenarios[0],
      databaseContractInvoked: false as true,
    }
    expect(() => validateSqlScenarioEvidence(notInvoked)).toThrow(
      'lacks direct database-contract evidence',
    )

    const contradictoryResult = validEvidence()
    contradictoryResult.scenarios[0].actualResult.outcome = 'contradiction'
    expect(() => validateSqlScenarioEvidence(contradictoryResult)).toThrow(
      'expectedResult does not equal its runtime actualResult',
    )

    const contradictorySummary = validEvidence()
    contradictorySummary.allScenariosPassed = false as true
    expect(() => validateSqlScenarioEvidence(contradictorySummary)).toThrow(
      'did not affirm that all scenarios passed',
    )
  })

  it('requires pre/post state, passed assertions, and runtime-derived 621/3/6/624 counts', () => {
    const missingState = validEvidence()
    delete (missingState.scenarios[0] as unknown as Record<string, unknown>).preState
    expect(() => validateSqlScenarioEvidence(missingState)).toThrow(
      'preState must be a JSON object',
    )

    const failedAssertion = validEvidence()
    failedAssertion.scenarios[0].assertions[0] = {
      ...failedAssertion.scenarios[0].assertions[0],
      passed: false as true,
    }
    expect(() => validateSqlScenarioEvidence(failedAssertion)).toThrow('failed assertion')

    const wrongMixedRuntimeCount = validEvidence()
    wrongMixedRuntimeCount.scenarios[2].actualResult.insertedReviews = 623
    wrongMixedRuntimeCount.scenarios[2].expectedResult = structuredClone(
      wrongMixedRuntimeCount.scenarios[2].actualResult,
    )
    expect(() => validateSqlScenarioEvidence(wrongMixedRuntimeCount)).toThrow(
      'S03 actualResult.insertedReviews must be runtime-derived as 624',
    )

    const wrongEventDistribution = validEvidence()
    const wrongEventCounts = wrongEventDistribution.scenarios[2].actualResult.eventCounts as Record<
      string,
      unknown
    >
    wrongEventCounts.review_imported = 623
    wrongEventDistribution.scenarios[2].expectedResult = structuredClone(
      wrongEventDistribution.scenarios[2].actualResult,
    )
    expect(() => validateSqlScenarioEvidence(wrongEventDistribution)).toThrow(
      'S03 actualResult.eventCounts.review_imported must be runtime-derived as 624',
    )

    const sameTransactionAmbiguity = validEvidence()
    sameTransactionAmbiguity.scenarios[4].actualResult = {
      clientObservedReceipt: false,
      databaseStatus: 'completed',
      automaticRetryPermitted: false,
      durableCommitObserved: false,
    }
    sameTransactionAmbiguity.scenarios[4].expectedResult = structuredClone(
      sameTransactionAmbiguity.scenarios[4].actualResult,
    )
    sameTransactionAmbiguity.scenarios[4].mutationCount = 1
    expect(() => validateSqlScenarioEvidence(sameTransactionAmbiguity)).toThrow(
      'unacknowledged durable commit in a later transaction',
    )
  })

  it('enforces compensation restore, replay, second-compensation, and ordinary-review invariants', () => {
    const brokenRestore = validEvidence()
    brokenRestore.scenarios[6].postState.effectiveStateHash = digest('not-restored')
    expect(() => validateSqlScenarioEvidence(brokenRestore)).toThrow('effective-state restoration')

    const duplicateReplay = validEvidence()
    duplicateReplay.scenarios[9].postState.reviewCount += 1
    expect(() => validateSqlScenarioEvidence(duplicateReplay)).toThrow(
      'zero-mutation unchanged-state',
    )

    const secondCompensationMutation = validEvidence()
    secondCompensationMutation.scenarios[16].mutationCount = 1
    expect(() => validateSqlScenarioEvidence(secondCompensationMutation)).toThrow(
      'zero-mutation unchanged-state',
    )

    const forkedOrdinaryReview = validEvidence()
    forkedOrdinaryReview.scenarios[10].postState.maxRevision += 1
    expect(() => validateSqlScenarioEvidence(forkedOrdinaryReview)).toThrow(
      'one linear ordinary-review append',
    )

    const unsealedFailure = validEvidence()
    unsealedFailure.scenarios[3].actualResult.receiptAfterPhysicalStateSha256 = digest('wrong')
    unsealedFailure.scenarios[3].expectedResult = structuredClone(
      unsealedFailure.scenarios[3].actualResult,
    )
    expect(() => validateSqlScenarioEvidence(unsealedFailure)).toThrow(
      'sealed two-event audit receipt',
    )
  })

  it('normalizes volatile physical digests and UUIDs while retaining equality evidence', () => {
    const first = validateSqlScenarioEvidence(validEvidence())
    const uuidReplacements = new Map<string, string>()
    const replaceUuids = (entry: unknown): unknown => {
      if (
        typeof entry === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(entry)
      ) {
        const replacement =
          uuidReplacements.get(entry) ?? uuid(`fresh-run-${uuidReplacements.size}`)
        uuidReplacements.set(entry, replacement)
        return replacement
      }
      if (Array.isArray(entry)) return entry.map(replaceUuids)
      if (typeof entry === 'object' && entry !== null) {
        return Object.fromEntries(
          Object.entries(entry).map(([key, value]) => [key, replaceUuids(value)]),
        )
      }
      return entry
    }
    let second = replaceUuids(structuredClone(first)) as RawSqlScenarioEvidence
    const replacements = new Map<string, string>()
    for (const scenarioRecord of second.scenarios) {
      for (const stateName of ['preState', 'postState'] as const) {
        const old = scenarioRecord[stateName].physicalStateHash
        const replacement = replacements.get(old) ?? digest(`second-run-${replacements.size}`)
        replacements.set(old, replacement)
      }
    }
    const replacePhysicalHashes = (entry: unknown): unknown => {
      if (typeof entry === 'string' && replacements.has(entry)) return replacements.get(entry)
      if (Array.isArray(entry)) return entry.map(replacePhysicalHashes)
      if (typeof entry === 'object' && entry !== null) {
        return Object.fromEntries(
          Object.entries(entry).map(([key, value]) => [key, replacePhysicalHashes(value)]),
        )
      }
      return entry
    }
    second = replacePhysicalHashes(second) as RawSqlScenarioEvidence
    const migration = digest('migration')
    const verifier = digest('verifier')
    const firstCanonical = canonicalJson(buildCanonicalScenarioEvidence(first, migration, verifier))
    expect(firstCanonical).toBe(
      canonicalJson(buildCanonicalScenarioEvidence(second, migration, verifier)),
    )
    expect(first.scenarios[6].preState.physicalStateHash).toMatch(/^[a-f0-9]{64}$/u)
    expect(firstCanonical).not.toContain(first.scenarios[10].postState.currentPointer)
    expect(firstCanonical).toContain('uuid-equality-token-')
  })

  it('accepts only a required output directory and exposes no database-target selector', () => {
    expect(parseRehearsalCliArguments(['--output', 'fresh'], '/workspace')).toEqual({
      help: false,
      outputDirectory: '/workspace/fresh',
    })
    expect(parseRehearsalCliArguments(['--help'], '/workspace')).toEqual({ help: true })
    expect(() => parseRehearsalCliArguments([], '/workspace')).toThrow(
      '--output <fresh-directory> is required',
    )
    for (const option of ['--db-url', '--target', '--host', '--port', '--password']) {
      expect(() => parseRehearsalCliArguments([option, 'remote'], '/workspace')).toThrow(
        'Unknown option',
      )
    }
  })

  it('scrubs external Docker/database targets and permits only local Docker sockets', () => {
    const sanitized = sanitizeRehearsalChildEnvironment({
      PATH: '/safe/bin',
      DATABASE_URL: 'postgresql://remote.invalid/database',
      DOCKER_HOST: 'tcp://remote.invalid:2376',
      DOCKER_CONTEXT: 'remote-context',
      DOCKER_TLS_VERIFY: '1',
      DOCKER_CERT_PATH: '/remote/certs',
      DOCKER_CONFIG: '/remote/config',
      PGHOST: 'remote.invalid',
      PGHOSTADDR: '203.0.113.10',
      PGSERVICE: 'remote-service',
      PGSERVICEFILE: '/remote/pg_service.conf',
      PGSYSCONFDIR: '/remote/pg-config',
      SUPABASE_ACCESS_TOKEN: 'remote-token',
      SUPABASE_PROJECT_ID: 'remote-project',
      SUPABASE_URL: 'https://remote.invalid',
      POSTGRES_URL: 'postgresql://remote.invalid/database',
    })
    expect(sanitized).toEqual({ PATH: '/safe/bin' })
    expect(assertLocalDockerEndpoint('unix:///var/run/docker.sock')).toBe('unix-domain-socket')
    expect(assertLocalDockerEndpoint('npipe:////./pipe/docker_engine')).toBe('windows-named-pipe')
    for (const endpoint of [
      'tcp://127.0.0.1:2375',
      'tcp://remote.invalid:2376',
      'ssh://remote.invalid',
      'https://remote.invalid',
      '',
    ]) {
      expect(() => assertLocalDockerEndpoint(endpoint)).toThrow('requires a local Docker socket')
    }
  })

  it('requires exactly the known three Supabase volatility warnings and no errors', () => {
    expect(validateSupabaseLint(validLint())).toMatchObject({
      errors: [],
      warningCount: 3,
      rawIssueCount: 4,
      passed: true,
    })
    const extraWarning = validLint()
    extraWarning.push({ function: 'public.unexpected', issues: [lintIssue()] })
    expect(() => validateSupabaseLint(extraWarning)).toThrow('warning set changed unexpectedly')

    const error = validLint()
    error[0].issues[0].level = 'error'
    expect(() => validateSupabaseLint(error)).toThrow('Supabase db lint error')
  })

  it('builds an owner/role-explicit identity independent of catalog insertion order', () => {
    const source = validIntrospection()
    const identity = buildSchemaSecurityDefinitionIdentity(source)
    const expectedSha256 = schemaSecurityDefinitionIdentitySha256(identity)
    expect(identity.records.every((record) => record.owner !== null)).toBe(true)
    expect(
      identity.records.find((record) => record.objectType === 'policy')?.relevantRoles,
    ).toEqual(['service_role'])

    const shuffled = JSON.parse(JSON.stringify(source)) as ReturnType<typeof validIntrospection>
    for (const value of Object.values(shuffled.catalog)) {
      if (Array.isArray(value)) value.reverse()
    }
    for (const policy of shuffled.catalog.policies) policy.roles.reverse()
    expect(schemaSecurityDefinitionIdentitySha256(shuffled)).toBe(expectedSha256)

    const reorderedIdentity = JSON.parse(JSON.stringify(identity)) as typeof identity
    deterministicallyShuffle(reorderedIdentity.records)
    for (const record of reorderedIdentity.records) record.relevantRoles.reverse()
    expect(schemaSecurityDefinitionIdentitySha256(reorderedIdentity)).toBe(expectedSha256)
    const normalizedRecords = validateSchemaSecurityDefinitionIdentity(reorderedIdentity).records
    expect(normalizedRecords).toEqual(identity.records)
    expect(
      normalizedRecords.every(
        (record, index) =>
          index === 0 ||
          compareSchemaSecurityDefinitionRecords(
            normalizedRecords[index - 1] as typeof record,
            record,
          ) <= 0,
      ),
    ).toBe(true)
    expect(
      normalizedRecords.map(({ schemaName, objectType, objectName, objectIdentity }) => [
        schemaName,
        objectType,
        objectName,
        objectIdentity,
      ]),
    ).toEqual(
      [...normalizedRecords]
        .sort(compareSchemaSecurityDefinitionRecords)
        .map(({ schemaName, objectType, objectName, objectIdentity }) => [
          schemaName,
          objectType,
          objectName,
          objectIdentity,
        ]),
    )

    const tamperedIdentity = JSON.parse(JSON.stringify(identity)) as typeof identity
    tamperedIdentity.records[0].normalizedDefinition += ' substituted'
    expect(() => validateSchemaSecurityDefinitionIdentity(tamperedIdentity)).toThrow(
      /definitionSha256/iu,
    )
  })

  it('normalizes only unquoted formatting and supports zero-argument catalog functions', () => {
    expect(normalizePostgresDefinition('CHECK   ( value =  1 )')).toBe('CHECK ( value = 1 )')
    expect(normalizePostgresDefinition("CHECK (value = 'a  b')")).toContain("'a  b'")

    const source = validIntrospection()
    source.catalog.functions[0].identity_arguments = ''
    source.catalog.functions[0].search_path = ''
    expect(() => buildSchemaSecurityDefinitionIdentity(source)).not.toThrow()
  })

  it('binds forced-RLS state and the exact effective/explicit protected-column ACL state', () => {
    const baseline = validIntrospection()
    addSyntheticProtectedColumn(baseline)
    const baselineSha256 = schemaSecurityDefinitionIdentitySha256(baseline)
    const columnRecord = buildSchemaSecurityDefinitionIdentity(baseline).records.find((record) =>
      record.objectIdentity.endsWith('.column.synthetic_protected_column'),
    )
    expect(columnRecord?.relevantRoles).toEqual([...SCHEMA_SECURITY_COLUMN_ROLES].sort())
    expect(columnRecord?.state.effectivePrivileges).toHaveLength(
      SCHEMA_SECURITY_COLUMN_ROLES.length * SCHEMA_SECURITY_COLUMN_PRIVILEGES.length,
    )

    const forced = JSON.parse(JSON.stringify(baseline)) as ReturnType<typeof validIntrospection>
    const forcedTable = forced.catalog.tables.find(
      (table) => table.table_name === 'literature_gold_set_reviews',
    )
    const forcedRls = forced.rls.find((table) => table.tableName === 'literature_gold_set_reviews')
    if (forcedTable) forcedTable.force_rls = true
    if (forcedRls) forcedRls.rlsForced = true
    expect(() =>
      validateSecurityIntrospection(forced, {
        expectedSchemaSecurityIdentitySha256: baselineSha256,
      }),
    ).toThrow(/definition identity mismatch/iu)

    const granted = validIntrospection()
    addSyntheticProtectedColumn(granted, { explicitGrant: true, granted: true })
    const grantedIdentity = buildSchemaSecurityDefinitionIdentity(granted)
    expect(
      grantedIdentity.records.some(
        (record) =>
          record.objectType === 'column_acl' &&
          record.objectName === 'synthetic_protected_column' &&
          record.relevantRoles.includes('anon'),
      ),
    ).toBe(true)
    expect(schemaSecurityDefinitionIdentitySha256(granted)).not.toBe(baselineSha256)

    const grantedSha256 = schemaSecurityDefinitionIdentitySha256(granted)
    const revoked = JSON.parse(JSON.stringify(granted)) as ReturnType<typeof validIntrospection>
    const revokedCatalog = revoked.catalog as unknown as {
      columnAclEntries: Array<Record<string, unknown>>
      columnPrivileges: Array<Record<string, unknown>>
    }
    revokedCatalog.columnAclEntries = []
    const revokedGrant = revokedCatalog.columnPrivileges.find(
      (entry) => entry.role_name === 'anon' && entry.privilege_name === 'UPDATE',
    )
    if (revokedGrant) revokedGrant.granted = false
    expect(() =>
      validateSecurityIntrospection(revoked, {
        expectedSchemaSecurityIdentitySha256: grantedSha256,
      }),
    ).toThrow(/definition identity mismatch/iu)

    const incomplete = validIntrospection()
    addSyntheticProtectedColumn(incomplete)
    ;(incomplete.catalog as unknown as { columnPrivileges: unknown[] }).columnPrivileges.pop()
    expect(() => buildSchemaSecurityDefinitionIdentity(incomplete)).toThrow(
      /exact protected role\/column-privilege matrix/iu,
    )
  })

  it('pins the exact canonical fixed-image schema/security identity fixture', async () => {
    const { bytes, value } = await loadFixedImageSchemaIdentity()
    const validated = validateSchemaSecurityDefinitionIdentity(value, {
      expectedSchemaSecurityIdentitySha256: POST_MIGRATION_SCHEMA_SECURITY_IDENTITY_SHA256,
    })
    expect(validated.records).toHaveLength(763)
    expect(schemaSecurityDefinitionIdentitySha256(value)).toBe(
      POST_MIGRATION_SCHEMA_SECURITY_IDENTITY_SHA256,
    )
    expect(digest(bytes)).toBe('8f709d225f3087c77445b1453cffee994b9c8a8cfdbc004a798efbfff96ee20e')
    expect(digest(canonicalJson(value))).toBe(digest(bytes))

    const tableRecords = validated.records.filter((record) => record.objectType === 'table')
    const columnRecords = validated.records.filter((record) => record.objectType === 'column')
    const columnAclRecords = validated.records.filter(
      (record) => record.objectType === 'column_acl',
    )
    expect(tableRecords).toHaveLength(7)
    expect(tableRecords.every((record) => record.state.forceRls === false)).toBe(true)
    expect(columnRecords).toHaveLength(146)
    const expectedColumnPrivilegeKeys = SCHEMA_SECURITY_COLUMN_ROLES.flatMap((roleName) =>
      SCHEMA_SECURITY_COLUMN_PRIVILEGES.map((privilegeName) => `${roleName}:${privilegeName}`),
    ).sort()
    expect(
      columnRecords.every((record) => {
        if (!Array.isArray(record.state.effectivePrivileges)) return false
        const privileges = record.state.effectivePrivileges as Array<Record<string, unknown>>
        return (
          privileges.every((privilege) => typeof privilege.granted === 'boolean') &&
          JSON.stringify(
            privileges
              .map((privilege) => `${privilege.roleName}:${privilege.privilegeName}`)
              .sort(),
          ) === JSON.stringify(expectedColumnPrivilegeKeys)
        )
      }),
    ).toBe(true)
    expect(columnAclRecords).toHaveLength(0)
    expect(
      validated.records.every(
        (record, index) =>
          index === 0 ||
          compareSchemaSecurityDefinitionRecords(
            validated.records[index - 1] as typeof record,
            record,
          ) <= 0,
      ),
    ).toBe(true)
  })

  it.each([
    {
      label: 'FORCE ROW LEVEL SECURITY',
      mutate(identity: Awaited<ReturnType<typeof loadFixedImageSchemaIdentity>>['value']) {
        const validated = validateSchemaSecurityDefinitionIdentity(identity)
        const record = validated.records.find(
          (candidate) =>
            candidate.objectType === 'table' &&
            candidate.objectName === 'literature_gold_set_reviews',
        )
        if (!record) throw new Error('Fixed-image fixture lacks the review table record.')
        record.state = { ...record.state, forceRls: true }
        record.normalizedDefinition = record.normalizedDefinition.replace(
          'force_rls=false',
          'force_rls=true',
        )
        record.definitionSha256 = digest(record.normalizedDefinition)
        return validated
      },
    },
    {
      label: 'column GRANT',
      mutate(identity: Awaited<ReturnType<typeof loadFixedImageSchemaIdentity>>['value']) {
        const validated = validateSchemaSecurityDefinitionIdentity(identity)
        const record = validated.records.find(
          (candidate) =>
            candidate.objectIdentity ===
            'public.table.literature_gold_set_reviews.column.operation_action_id',
        )
        if (!record)
          throw new Error('Fixed-image fixture lacks the review operation-action column.')
        const effectivePrivileges = record.state.effectivePrivileges as Array<
          Record<string, unknown>
        >
        const privilege = effectivePrivileges.find(
          (entry) => entry.roleName === 'anon' && entry.privilegeName === 'UPDATE',
        )
        if (!privilege || privilege.granted !== false) {
          throw new Error('Fixed-image fixture lacks the expected revoked anon column privilege.')
        }
        privilege.granted = true
        record.normalizedDefinition = minifiedCanonicalJson(record.state)
        record.definitionSha256 = digest(record.normalizedDefinition)
        return validated
      },
    },
    {
      label: 'column REVOKE',
      mutate(identity: Awaited<ReturnType<typeof loadFixedImageSchemaIdentity>>['value']) {
        const validated = validateSchemaSecurityDefinitionIdentity(identity)
        const record = validated.records.find(
          (candidate) =>
            candidate.objectIdentity ===
            'public.table.literature_gold_set_reviews.column.operation_action_id',
        )
        if (!record)
          throw new Error('Fixed-image fixture lacks the review operation-action column.')
        const effectivePrivileges = record.state.effectivePrivileges as Array<
          Record<string, unknown>
        >
        const privilege = effectivePrivileges.find(
          (entry) => entry.roleName === 'service_role' && entry.privilegeName === 'UPDATE',
        )
        if (!privilege || privilege.granted !== true) {
          throw new Error('Fixed-image fixture lacks the expected service-role column privilege.')
        }
        privilege.granted = false
        record.normalizedDefinition = minifiedCanonicalJson(record.state)
        record.definitionSha256 = digest(record.normalizedDefinition)
        return validated
      },
    },
  ])('rejects fixture-bound $label substitution', async ({ mutate }) => {
    const { value } = await loadFixedImageSchemaIdentity()
    const mutated = mutate(JSON.parse(JSON.stringify(value)) as unknown)
    expect(() => validateSchemaSecurityDefinitionIdentity(mutated)).not.toThrow()
    expect(schemaSecurityDefinitionIdentitySha256(mutated)).not.toBe(
      POST_MIGRATION_SCHEMA_SECURITY_IDENTITY_SHA256,
    )
    expect(() =>
      validateSchemaSecurityDefinitionIdentity(mutated, {
        expectedSchemaSecurityIdentitySha256: POST_MIGRATION_SCHEMA_SECURITY_IDENTITY_SHA256,
      }),
    ).toThrow(/definition identity mismatch/iu)
  })

  it.each([
    [
      'weakened trigger predicate',
      'prevent_literature_gold_set_events_mutation',
      (definition: string) => definition.replace('BEFORE DELETE OR UPDATE', 'BEFORE DELETE'),
    ],
    [
      'changed constraint action',
      'literature_gold_review_operations_batch_id_fkey',
      (definition: string) => definition.replace('ON DELETE RESTRICT', 'ON DELETE CASCADE'),
    ],
    [
      'wrong index definition',
      'literature_gold_set_items_split_idx',
      (definition: string) => definition.replace('display_order)', 'review_status)'),
    ],
    [
      'broader journal policy role',
      'literature_gold_review_operation_actions_service_policy',
      (definition: string) =>
        definition.replace('"roles":["service_role"]', '"roles":["authenticated","service_role"]'),
    ],
  ] as const)(
    'rejects the fixed-image fixture after a same-name %s substitution',
    async (_label, objectName, mutateDefinition) => {
      const { value } = await loadFixedImageSchemaIdentity()
      const identity = validateSchemaSecurityDefinitionIdentity(value)
      const record = identity.records.find((candidate) => candidate.objectName === objectName)
      if (!record) throw new Error(`Fixed-image fixture lacks ${objectName}.`)
      const mutatedDefinition = mutateDefinition(record.normalizedDefinition)
      expect(mutatedDefinition).not.toBe(record.normalizedDefinition)
      record.normalizedDefinition = mutatedDefinition
      record.definitionSha256 = digest(mutatedDefinition)
      if (record.objectType === 'policy') {
        record.relevantRoles = ['authenticated', 'service_role']
        record.state = {
          ...record.state,
          roles: ['authenticated', 'service_role'],
        }
      }
      expect(() => validateSchemaSecurityDefinitionIdentity(identity)).not.toThrow()
      expect(schemaSecurityDefinitionIdentitySha256(identity)).not.toBe(
        POST_MIGRATION_SCHEMA_SECURITY_IDENTITY_SHA256,
      )
      expect(() =>
        validateSchemaSecurityDefinitionIdentity(identity, {
          expectedSchemaSecurityIdentitySha256: POST_MIGRATION_SCHEMA_SECURITY_IDENTITY_SHA256,
        }),
      ).toThrow(/definition identity mismatch/iu)
    },
  )

  it.each([
    ['constraint', 'definition', 'CHECK (substituted_column IS NOT NULL)'],
    ['trigger', 'definition', 'CREATE TRIGGER substituted_timing AFTER UPDATE ON public.x'],
    ['policy', 'using_expression', 'true'],
    ['index', 'definition', 'CREATE UNIQUE INDEX same_name ON public.x (wrong_column)'],
  ] as const)('rejects a same-name %s semantic substitution', (objectType, field, replacement) => {
    const source = validIntrospection()
    const expectedSha256 = schemaSecurityDefinitionIdentitySha256(source)
    const catalogKey = {
      constraint: 'constraints',
      trigger: 'triggers',
      policy: 'policies',
      index: 'indexes',
    }[objectType] as 'constraints' | 'triggers' | 'policies' | 'indexes'
    const rows = source.catalog[catalogKey] as Array<Record<string, unknown>>
    rows[0][field] = replacement
    expect(() =>
      validateSecurityIntrospection(source, {
        expectedSchemaSecurityIdentitySha256: expectedSha256,
      }),
    ).toThrow(/definition identity mismatch/iu)
  })

  it('fails unsafe RLS, grants, search paths, constraints, triggers, and event vocabularies', () => {
    expect(validateSecurityIntrospection(validIntrospection())).toMatchObject({ passed: true })

    const missingRls = validIntrospection()
    missingRls.rls[0].rlsEnabled = false
    expect(() => validateSecurityIntrospection(missingRls)).toThrow('RLS is not enabled')

    const publicRpc = validIntrospection()
    publicRpc.functions[0].publicExecute = true
    expect(() => validateSecurityIntrospection(publicRpc)).toThrow('ordinary-client EXECUTE grant')

    const wrongOwner = validIntrospection()
    wrongOwner.functions[0].owner = 'unexpected_owner'
    expect(() => validateSecurityIntrospection(wrongOwner)).toThrow('unexpected owner')

    const fabricatedEvent = validIntrospection()
    fabricatedEvent.eventPrivileges.anonInsert = true
    expect(() => validateSecurityIntrospection(fabricatedEvent)).toThrow(
      'Unexpected ordinary-client event privilege',
    )

    const unsafeEventPrivilege = validIntrospection()
    unsafeEventPrivilege.eventPrivileges.serviceRoleTrigger = true
    expect(() => validateSecurityIntrospection(unsafeEventPrivilege)).toThrow(
      'Expected service_role event privileges changed unexpectedly',
    )

    const journalDelete = validIntrospection()
    journalDelete.journalPrivileges[0].delete = true
    expect(() => validateSecurityIntrospection(journalDelete)).toThrow(
      'Unexpected journal privilege',
    )

    const journalReferences = validIntrospection()
    journalReferences.journalPrivileges[0].references = true
    expect(() => validateSecurityIntrospection(journalReferences)).toThrow(
      'Unexpected journal privilege',
    )

    const journalTrigger = validIntrospection()
    journalTrigger.journalPrivileges[0].trigger = true
    expect(() => validateSecurityIntrospection(journalTrigger)).toThrow(
      'Unexpected journal privilege',
    )

    const missingJournalSelect = validIntrospection()
    const serviceJournal = missingJournalSelect.journalPrivileges.find(
      ({ role }) => role === 'service_role',
    )
    if (!serviceJournal) throw new Error('test fixture lacks service journal privilege')
    serviceJournal.select = false
    expect(() => validateSecurityIntrospection(missingJournalSelect)).toThrow(
      'Unexpected journal privilege',
    )

    const widenedJournalPolicy = validIntrospection()
    widenedJournalPolicy.journalPolicies[0].roles.push('authenticated')
    expect(() => validateSecurityIntrospection(widenedJournalPolicy)).toThrow('unexpected roles')

    const writableSearchPath = validIntrospection()
    writableSearchPath.schemaCreatePrivileges[0].create = true
    expect(() => validateSecurityIntrospection(writableSearchPath)).toThrow(
      'Unsafe CREATE privilege',
    )

    const unsafePath = validIntrospection()
    unsafePath.functions[0].searchPath = 'public'
    expect(() => validateSecurityIntrospection(unsafePath)).toThrow('unsafe search_path')

    const missingConstraint = validIntrospection()
    missingConstraint.constraints.pop()
    expect(() => validateSecurityIntrospection(missingConstraint)).toThrow(
      'protected constraint set changed',
    )

    const weakenedConstraint = validIntrospection()
    const shaConstraint = weakenedConstraint.constraintDefinitions.find(
      ({ name }) => name === 'literature_gold_review_operations_sha_check',
    )
    if (!shaConstraint) throw new Error('test fixture lacks SHA constraint')
    shaConstraint.definition = 'CHECK (artifact_sha256 IS NOT NULL)'
    expect(() => validateSecurityIntrospection(weakenedConstraint)).toThrow(
      'missing required definition fragment',
    )

    const missingUniqueIndex = validIntrospection()
    missingUniqueIndex.uniqueIndexes.pop()
    expect(() => validateSecurityIntrospection(missingUniqueIndex)).toThrow(
      'required unique index set changed',
    )

    const missingTrigger = validIntrospection()
    missingTrigger.triggers.pop()
    expect(() => validateSecurityIntrospection(missingTrigger)).toThrow(
      'protected trigger set changed',
    )

    const replicaOnlyTrigger = validIntrospection()
    replicaOnlyTrigger.triggers[0].enableMode = 'R'
    replicaOnlyTrigger.triggers[0].enabled = false
    expect(() => validateSecurityIntrospection(replicaOnlyTrigger)).toThrow(
      'not enabled for origin sessions',
    )

    const missingEventImmutability = validIntrospection()
    missingEventImmutability.triggers = missingEventImmutability.triggers.filter(
      ({ name }) => name !== 'prevent_literature_gold_set_events_mutation',
    )
    expect(() => validateSecurityIntrospection(missingEventImmutability)).toThrow(
      'prevent_literature_gold_set_events_mutation',
    )

    const eventDrift = validIntrospection()
    eventDrift.supportedEventTypes.pop()
    expect(() => validateSecurityIntrospection(eventDrift)).toThrow(
      'supported event type set changed',
    )
  })

  it('fails closed on unexpected protected catalog entries', () => {
    const extraConstraint = validIntrospection()
    const constraints: string[] = extraConstraint.constraints
    const constraintDefinitions: Array<{
      name: string
      tableName: string
      definition: string
    }> = extraConstraint.constraintDefinitions
    constraints.push('unexpected_protected_constraint')
    constraintDefinitions.push({
      name: 'unexpected_protected_constraint',
      tableName: 'literature_gold_set_reviews',
      definition: 'CHECK (true)',
    })
    expect(() => validateSecurityIntrospection(extraConstraint)).toThrow(
      'protected constraint set changed',
    )

    const extraIndex = validIntrospection()
    const uniqueIndexes: Array<{
      name: string
      tableName: string
      unique: boolean
      valid: boolean
      predicate: string
      definition: string
    }> = extraIndex.uniqueIndexes
    uniqueIndexes.push({
      name: 'unexpected_protected_index',
      tableName: 'literature_gold_set_reviews',
      unique: true,
      valid: true,
      predicate: 'id IS NOT NULL',
      definition: 'CREATE UNIQUE INDEX unexpected_protected_index ON public.x (id)',
    })
    expect(() => validateSecurityIntrospection(extraIndex)).toThrow(
      'required unique index set changed',
    )

    const extraPolicy = validIntrospection()
    const journalPolicies: Array<{
      name: string
      tableName: string
      command: string
      permissive: string
      roles: string[]
      using: string
      withCheck: string
    }> = extraPolicy.journalPolicies
    journalPolicies.push({
      name: 'unexpected_journal_policy',
      tableName: 'literature_gold_review_operations',
      command: 'ALL',
      permissive: 'PERMISSIVE',
      roles: ['service_role'],
      using: "dataset_split = 'development'",
      withCheck: "dataset_split = 'development'",
    })
    expect(() => validateSecurityIntrospection(extraPolicy)).toThrow(
      'journal RLS policy set changed',
    )

    const extraEnabledTrigger = validIntrospection()
    const triggers: Array<{
      name: string
      tableName: string
      enableMode: string
      enabled: boolean
      definition: string
    }> = extraEnabledTrigger.triggers
    triggers.push({
      name: 'unexpected_enabled_trigger',
      tableName: 'literature_gold_set_reviews',
      enableMode: 'O',
      enabled: true,
      definition:
        'CREATE TRIGGER unexpected_enabled_trigger BEFORE INSERT ON public.literature_gold_set_reviews FOR EACH ROW EXECUTE FUNCTION unexpected_enabled_trigger()',
    })
    expect(() => validateSecurityIntrospection(extraEnabledTrigger)).toThrow(
      'protected trigger set changed',
    )
  })

  it('collects complete protected catalogs before applying exact allowlists', () => {
    expect(() => assertSerializedAggregateOrdering(SECURITY_INTROSPECTION_SQL)).not.toThrow()
    const sqlSection = (start: string, end: string) => {
      const startIndex = SECURITY_INTROSPECTION_SQL.indexOf(start)
      const endIndex = SECURITY_INTROSPECTION_SQL.indexOf(end, startIndex + start.length)
      expect(startIndex).toBeGreaterThanOrEqual(0)
      expect(endIndex).toBeGreaterThan(startIndex)
      return SECURITY_INTROSPECTION_SQL.slice(startIndex, endIndex)
    }

    const constraintCatalog = sqlSection('constraints as (', 'expected_indexes(')
    const indexCatalog = sqlSection('expected_indexes(', 'schema_policies as (')
    const policyCatalog = sqlSection('schema_policies as (', 'journal_policies as (')
    const triggerCatalog = sqlSection('triggers as (', 'event_types as (')

    for (const tableName of REQUIRED_RLS_TABLES) {
      expect(constraintCatalog).toContain(`'${tableName}'`)
      expect(indexCatalog).toContain(`'${tableName}'`)
      expect(triggerCatalog).toContain(`'${tableName}'`)
    }
    expect(policyCatalog).toContain('class.relname in (select table_name from contract_tables)')
    expect(indexCatalog).toContain('index_catalog_drift as (')
    expect(indexCatalog).toContain("'__missing_expected_index__:'")
    expect(indexCatalog).toContain('index_owner.rolname as owner')
    expect(policyCatalog).not.toContain('policy.policyname in')
    expect(SECURITY_INTROSPECTION_SQL).toContain('class.relforcerowsecurity as force_rls')
    expect(SECURITY_INTROSPECTION_SQL).toContain("'rlsForced', rls_forced")
    expect(SECURITY_INTROSPECTION_SQL).toContain('attribute.attacl')
    expect(SECURITY_INTROSPECTION_SQL).toContain('pg_catalog.has_column_privilege(')
    expect(SECURITY_INTROSPECTION_SQL).not.toMatch(
      /aclexplode\s*\(\s*coalesce\s*\(\s*attribute\.attacl\s*,\s*array\[\]/iu,
    )
    expect(
      SECURITY_INTROSPECTION_SQL.match(
        /case when cardinality\(attribute\.attacl\) > 0 then attribute\.attacl\s+else null::pg_catalog\.aclitem\[\] end/giu,
      ),
    ).toHaveLength(2)
    expect(SECURITY_INTROSPECTION_SQL).toContain("'columnPrivileges'")
    expect(SECURITY_INTROSPECTION_SQL).toContain("'columnAclEntries'")
    for (const role of SCHEMA_SECURITY_COLUMN_ROLES) {
      expect(SECURITY_INTROSPECTION_SQL).toContain(`('${role}')`)
    }
    for (const privilege of SCHEMA_SECURITY_COLUMN_PRIVILEGES) {
      expect(SECURITY_INTROSPECTION_SQL).toContain(`('${privilege}')`)
    }
    expect(SCHEMA_DEFINITION_MUTATION_PROBES.map(({ name }) => name)).toEqual([
      'weakened_same_name_trigger_predicate',
      'changed_same_name_foreign_key_action',
      'broadened_same_name_journal_policy',
      'wrong_same_name_unique_index_definition',
      'forced_rls_state_changed',
      'column_grant_broadened',
    ])
  })

  it('commits lint and introspection to a fixed-image, auto-port, targetless runner', async () => {
    const runner = await readFile(
      resolve(process.cwd(), 'scripts/literature/rehearse-gold-import-compensation-db.ts'),
      'utf8',
    )
    expect(runner).toContain('public.ecr.aws/supabase/postgres:17.6.1.104')
    expect(runner).toContain("'127.0.0.1::5432'")
    expect(runner).toContain('runSupabaseLint(hostPort)')
    expect(runner).toContain('SECURITY_INTROSPECTION_SQL')
    expect(runner).toContain('SCHEMA_SECURITY_FUNCTION_NAMES')
    expect(runner).toContain('inspectLocalDockerRuntime()')
    expect(runner).toContain('execution-receipt.json')
    expect(runner).not.toContain('process.env.DATABASE_URL')
  })
})
