/** @jest-environment node */

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  assertLocalDockerEndpoint,
  buildCanonicalScenarioEvidence,
  canonicalJson,
  EXACT_MIXED_PACKAGE_COUNTS,
  extractSqlScenarioEvidence,
  parseRehearsalCliArguments,
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
  REQUIRED_UNIQUE_INDEXES,
  SCENARIO_EVIDENCE_MARKER,
  SCENARIO_EVIDENCE_SCHEMA_VERSION,
  sanitizeRehearsalChildEnvironment,
  validateSecurityIntrospection,
  validateSqlScenarioEvidence,
  validateSupabaseLint,
  type RawSqlScenarioEvidence,
  type ScenarioEvidenceRecord,
  type ScenarioStateEvidence,
} from './gold-import-compensation-rehearsal-evidence'

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex')
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
  return {
    rls: REQUIRED_RLS_TABLES.map((tableName) => ({ tableName, rlsEnabled: true })),
    functions: REQUIRED_TRANSITION_FUNCTIONS.map((name) => ({
      name,
      identityArguments: 'p_operation_id uuid',
      owner: 'supabase_admin',
      securityDefiner: true,
      searchPath: 'pg_catalog, public, extensions',
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
      tableName: 'synthetic_contract_table',
      definition: completeConstraintDefinition,
    })),
    uniqueIndexes: REQUIRED_UNIQUE_INDEXES.map((name) => ({
      name,
      tableName: 'synthetic_contract_table',
      unique: true,
      valid: true,
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
    })),
    supportedEventTypes: [...REQUIRED_EVENT_TYPES],
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
      'Required constraint is missing',
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
      'Required trigger is missing',
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

  it('commits lint and introspection to a fixed-image, auto-port, targetless runner', async () => {
    const runner = await readFile(
      resolve(process.cwd(), 'scripts/literature/rehearse-gold-import-compensation-db.ts'),
      'utf8',
    )
    expect(runner).toContain('public.ecr.aws/supabase/postgres:17.6.1.104')
    expect(runner).toContain("'127.0.0.1::5432'")
    expect(runner).toContain('runSupabaseLint(hostPort)')
    expect(runner).toContain('SECURITY_INTROSPECTION_SQL')
    expect(runner).toContain('inspectLocalDockerRuntime()')
    expect(runner).toContain('execution-receipt.json')
    expect(runner).not.toContain('process.env.DATABASE_URL')
  })
})
