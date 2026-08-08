import { resolve } from 'node:path'

import { assertKnownArguments, hasFlag, parseCliArguments, stringArgument } from './lib/cli'

export const SCENARIO_EVIDENCE_MARKER = 'PR84_SCENARIO_EVIDENCE_JSON:'
export const SCENARIO_EVIDENCE_SCHEMA_VERSION = 'pr84-scenario-evidence/v1'
export const LINT_INTROSPECTION_SCHEMA_VERSION = 'pr84-lint-introspection/v1'
export const REHEARSAL_MANIFEST_SCHEMA_VERSION = 'pr84-rehearsal-manifest/v1'
export const EXECUTION_RECEIPT_SCHEMA_VERSION = 'pr84-execution-receipt/v1'

export const REQUIRED_SCENARIO_IDS = [
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
] as const

export const EXACT_MIXED_PACKAGE_COUNTS = {
  initialActions: 621,
  revisionActions: 3,
  noopActions: 6,
  totalActions: 630,
  insertedReviews: 624,
} as const

export const REQUIRED_RLS_TABLES = [
  'literature_gold_review_operation_actions',
  'literature_gold_review_operations',
  'literature_gold_set_batches',
  'literature_gold_set_events',
  'literature_gold_set_items',
  'literature_gold_set_review_drafts',
  'literature_gold_set_reviews',
] as const

export const REQUIRED_TRANSITION_FUNCTIONS = [
  'apply_literature_gold_import_v1',
  'compensate_literature_gold_import_v1',
  'reconcile_literature_gold_review_operation_v1',
] as const

export const REQUIRED_JOURNAL_TABLES = [
  'literature_gold_review_operation_actions',
  'literature_gold_review_operations',
] as const

export const REQUIRED_JOURNAL_ROLES = ['public', 'anon', 'authenticated', 'service_role'] as const

export const REQUIRED_SAFE_SEARCH_PATH_SCHEMAS = ['public', 'extensions'] as const
export const REQUIRED_ORDINARY_ROLES = ['public', 'anon', 'authenticated'] as const

export const REQUIRED_CONSTRAINTS = [
  'literature_gold_review_operat_operation_kind_idempotency_ke_key',
  'literature_gold_review_operati_operation_id_action_sequence_key',
  'literature_gold_review_operatio_source_operation_action_id_fkey',
  'literature_gold_review_operatio_target_import_operation_id_fkey',
  'literature_gold_review_operation_ac_id_operation_id_item_id_key',
  'literature_gold_review_operation_actio_operation_id_item_id_key',
  'literature_gold_review_operation_actions_id_item_id_key',
  'literature_gold_review_operation_actions_id_operation_id_key',
  'literature_gold_review_operation_actions_item_id_fkey',
  'literature_gold_review_operation_actions_kind_check',
  'literature_gold_review_operation_actions_operation_id_fkey',
  'literature_gold_review_operation_actions_pkey',
  'literature_gold_review_operation_actions_pmid_check',
  'literature_gold_review_operation_actions_result_check',
  'literature_gold_review_operation_actions_sequence_check',
  'literature_gold_review_operation_actions_shape_check',
  'literature_gold_review_operation_actions_state_check',
  'literature_gold_review_operation_actions_status_check',
  'literature_gold_review_operations_actor_check',
  'literature_gold_review_operations_batch_id_fkey',
  'literature_gold_review_operations_counts_check',
  'literature_gold_review_operations_json_check',
  'literature_gold_review_operations_key_check',
  'literature_gold_review_operations_kind_check',
  'literature_gold_review_operations_pkey',
  'literature_gold_review_operations_sha_check',
  'literature_gold_review_operations_split_check',
  'literature_gold_review_operations_status_check',
  'literature_gold_review_operations_target_check',
  'literature_gold_review_operations_terminal_check',
  'literature_gold_set_events_operation_action_fk',
  'literature_gold_set_events_operation_fk',
  'literature_gold_set_events_operation_shape_check',
  'literature_gold_set_events_type_check',
  'literature_gold_set_reviews_compensates_fk',
  'literature_gold_set_reviews_effective_source_fk',
  'literature_gold_set_reviews_enrichment_status_check',
  'literature_gold_set_reviews_enrichment_versions_check',
  'literature_gold_set_reviews_lifecycle_state_check',
  'literature_gold_set_reviews_operation_action_fk',
  'literature_gold_set_reviews_revision_contract_check',
  'literature_gold_set_reviews_revision_kind_check',
  'literature_gold_set_reviews_supersedes_fk',
] as const

export const REQUIRED_UNIQUE_INDEXES = [
  'literature_gold_review_operations_one_live_compensation_idx',
  'literature_gold_set_events_operation_sequence_idx',
  'literature_gold_set_reviews_one_child_idx',
  'literature_gold_set_reviews_one_operation_action_idx',
] as const

export const REQUIRED_JOURNAL_POLICIES = [
  'literature_gold_review_operation_actions_service_policy',
  'literature_gold_review_operations_service_policy',
] as const

export const REQUIRED_TRIGGERS = [
  'check_literature_gold_chain_head_after_item',
  'check_literature_gold_chain_head_after_review',
  'guard_literature_gold_review_chain_insert',
  'guard_literature_gold_review_operation_actions',
  'guard_literature_gold_review_operations',
  'prevent_literature_gold_set_events_mutation',
  'prevent_literature_gold_set_reviews_mutation',
  'validate_literature_gold_operation_event',
] as const

export const REQUIRED_EVENT_TYPES = [
  'automated_signals_revealed',
  'batch_created',
  'batch_frozen',
  'draft_saved',
  'import_compensation_completed',
  'import_compensation_failed',
  'import_compensation_started',
  'import_completed',
  'import_failed',
  'import_started',
  'returned_later',
  'review_compensated',
  'review_completed',
  'review_imported',
  'review_resumed',
  'review_revised',
  'review_voided',
  'supplemental_metadata_revealed',
  'test_split_unlocked',
] as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const SAFE_SEARCH_PATHS = new Set([
  'pg_catalog',
  'pg_catalog, public',
  'pg_catalog, public, extensions',
])
const REQUIRED_CONSTRAINT_DEFINITION_FRAGMENTS: Readonly<Record<string, readonly string[]>> = {
  literature_gold_review_operations_sha_check: [
    'artifact_sha256',
    'plan_sha256',
    'authorization_sha256',
    'pre_physical_state_sha256',
    'pre_effective_state_sha256',
  ],
  literature_gold_review_operations_counts_check: [
    'planned_action_count',
    'planned_apply_count',
    'planned_noop_count',
    'applied_action_count',
    'noop_action_count',
  ],
  literature_gold_review_operations_terminal_check: [
    "status = 'started'",
    "status = 'completed'",
    "status = 'failed'",
    'error_sqlstate',
  ],
  literature_gold_review_operation_actions_shape_check: [
    'import_initial',
    'import_revision',
    'import_noop',
    'compensate_restore',
    'compensate_void',
    'compensate_noop',
  ],
  literature_gold_review_operation_actions_result_check: [
    "action_status = 'planned'",
    "action_status = 'applied'",
    "action_status = 'noop'",
    "action_status = 'failed'",
  ],
  literature_gold_set_reviews_revision_contract_check: [
    "revision_kind = 'standard'",
    "revision_kind = 'import'",
    "revision_kind = 'compensation'",
    'effective_source_review_id',
  ],
  literature_gold_set_events_type_check: [
    'import_completed',
    'import_compensation_started',
    'review_compensated',
    'review_voided',
    'import_compensation_completed',
    'import_compensation_failed',
  ],
}
const REQUIRED_INDEX_DEFINITION_FRAGMENTS: Readonly<Record<string, readonly string[]>> = {
  literature_gold_review_operations_one_live_compensation_idx: [
    'UNIQUE INDEX',
    'target_import_operation_id',
    "operation_kind = 'compensation'",
    "status = ANY (ARRAY['started'",
  ],
  literature_gold_set_events_operation_sequence_idx: [
    'UNIQUE INDEX',
    'operation_id',
    'operation_event_sequence',
    'operation_id IS NOT NULL',
  ],
  literature_gold_set_reviews_one_child_idx: [
    'UNIQUE INDEX',
    'supersedes_review_id',
    'supersedes_review_id IS NOT NULL',
  ],
  literature_gold_set_reviews_one_operation_action_idx: [
    'UNIQUE INDEX',
    'operation_action_id',
    'operation_action_id IS NOT NULL',
  ],
}

export interface RehearsalCliOptions {
  help: boolean
  outputDirectory?: string
}

const EXTERNAL_TARGET_ENVIRONMENT_KEYS = ['DATABASE_URL'] as const

export function sanitizeRehearsalChildEnvironment(
  source: Readonly<Record<string, string | undefined>>,
  overrides: Readonly<Record<string, string>> = {},
): NodeJS.ProcessEnv {
  const environment: Record<string, string | undefined> = { ...source }
  for (const key of EXTERNAL_TARGET_ENVIRONMENT_KEYS) delete environment[key]
  for (const key of Object.keys(environment)) {
    if (/^(?:DOCKER_|LITERATURE_SUPABASE_|PG|POSTGRES_|SUPABASE_)/u.test(key)) {
      delete environment[key]
    }
  }
  return { ...environment, ...overrides } as NodeJS.ProcessEnv
}

export function assertLocalDockerEndpoint(endpoint: string) {
  const normalized = endpoint.trim()
  if (/^unix:\/\/\/.+/u.test(normalized)) return 'unix-domain-socket' as const
  if (/^npipe:\/\/.+/u.test(normalized)) return 'windows-named-pipe' as const
  throw new Error(
    `Disposable rehearsal requires a local Docker socket; refusing endpoint ${normalized || '(empty)'}.`,
  )
}

export interface ScenarioStateEvidence {
  reviewCount: number
  eventCount: number
  currentPointer: string | null
  maxRevision: number
  effectiveStateHash: string
  physicalStateHash: string
  [key: string]: unknown
}

export interface ScenarioAssertionEvidence {
  name: string
  passed: true
  expected: unknown
  actual: unknown
}

export interface ScenarioEvidenceRecord {
  scenarioId: (typeof REQUIRED_SCENARIO_IDS)[number]
  description: string
  status: 'passed'
  databaseContractInvoked: true
  rpcOrFunctionNames: string[]
  preState: ScenarioStateEvidence
  expectedResult: Record<string, unknown>
  actualResult: Record<string, unknown>
  postState: ScenarioStateEvidence
  assertions: ScenarioAssertionEvidence[]
  sqlstateOrOutcome: string
  mutationCount: number
}

export interface RawSqlScenarioEvidence {
  schemaVersion: typeof SCENARIO_EVIDENCE_SCHEMA_VERSION
  mixedPackageCounts: typeof EXACT_MIXED_PACKAGE_COUNTS
  scenarios: ScenarioEvidenceRecord[]
  allScenariosPassed: true
}

interface LintWarning {
  function: string
  level: 'warning'
  message: string
  occurrences: number
  sqlState: '00000'
}

const EXPECTED_LINT_WARNINGS: readonly LintWarning[] = [
  {
    function: 'public.assert_literature_gold_jsonb_scalar_v1',
    level: 'warning',
    message: 'routine is marked as IMMUTABLE, but expression is STABLE',
    occurrences: 2,
    sqlState: '00000',
  },
  {
    function: 'public.literature_gold_canonical_json_v1',
    level: 'warning',
    message: 'routine is marked as IMMUTABLE, but expression is STABLE',
    occurrences: 1,
    sqlState: '00000',
  },
  {
    function: 'public.literature_gold_is_timestamptz_v1',
    level: 'warning',
    message: 'routine is marked as IMMUTABLE, but expression is STABLE',
    occurrences: 1,
    sqlState: '00000',
  },
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function compareCodeUnits(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be a JSON object.`)
  return value
}

function requireNonemptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a nonempty string.`)
  }
  return value
}

function requireNonnegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a nonnegative integer.`)
  }
  return value as number
}

function requireSha256(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest.`)
  }
  return value
}

function requireStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a nonempty array.`)
  }
  const strings = value.map((entry, index) => requireNonemptyString(entry, `${label}[${index}]`))
  if (new Set(strings).size !== strings.length) {
    throw new Error(`${label} must not contain duplicates.`)
  }
  return strings
}

function validateState(value: unknown, label: string): ScenarioStateEvidence {
  const state = requireRecord(value, label)
  requireNonnegativeInteger(state.reviewCount, `${label}.reviewCount`)
  requireNonnegativeInteger(state.eventCount, `${label}.eventCount`)
  requireNonnegativeInteger(state.maxRevision, `${label}.maxRevision`)
  if (state.currentPointer !== null) {
    requireNonemptyString(state.currentPointer, `${label}.currentPointer`)
  }
  requireSha256(state.effectiveStateHash, `${label}.effectiveStateHash`)
  requireSha256(state.physicalStateHash, `${label}.physicalStateHash`)
  return state as ScenarioStateEvidence
}

function validateScenario(value: unknown, index: number): ScenarioEvidenceRecord {
  const label = `scenarios[${index}]`
  const scenario = requireRecord(value, label)
  const expectedId = REQUIRED_SCENARIO_IDS[index]
  if (scenario.scenarioId !== expectedId) {
    throw new Error(`${label}.scenarioId must be ${expectedId ?? '(no additional scenario)'}.`)
  }
  requireNonemptyString(scenario.description, `${label}.description`)
  if (scenario.status !== 'passed') throw new Error(`${expectedId} did not pass.`)
  if (scenario.databaseContractInvoked !== true) {
    throw new Error(`${expectedId} lacks direct database-contract evidence.`)
  }
  requireStringArray(scenario.rpcOrFunctionNames, `${label}.rpcOrFunctionNames`)
  validateState(scenario.preState, `${label}.preState`)
  const expectedResult = requireRecord(scenario.expectedResult, `${label}.expectedResult`)
  const actualResult = requireRecord(scenario.actualResult, `${label}.actualResult`)
  if (canonicalJson(expectedResult) !== canonicalJson(actualResult)) {
    throw new Error(`${expectedId} expectedResult does not equal its runtime actualResult.`)
  }
  validateState(scenario.postState, `${label}.postState`)
  if (!Array.isArray(scenario.assertions) || scenario.assertions.length === 0) {
    throw new Error(`${expectedId} must contain at least one executed assertion.`)
  }
  scenario.assertions.forEach((assertionValue, assertionIndex) => {
    const assertionLabel = `${label}.assertions[${assertionIndex}]`
    const assertion = requireRecord(assertionValue, assertionLabel)
    requireNonemptyString(assertion.name, `${assertionLabel}.name`)
    if (assertion.passed !== true) {
      throw new Error(`${expectedId} contains a failed assertion: ${String(assertion.name)}.`)
    }
    if (!Object.hasOwn(assertion, 'expected') || !Object.hasOwn(assertion, 'actual')) {
      throw new Error(`${assertionLabel} must record expected and actual evidence.`)
    }
  })
  requireNonemptyString(scenario.sqlstateOrOutcome, `${label}.sqlstateOrOutcome`)
  requireNonnegativeInteger(scenario.mutationCount, `${label}.mutationCount`)
  return scenario as unknown as ScenarioEvidenceRecord
}

export function parseRehearsalCliArguments(
  argv: string[],
  workingDirectory = process.cwd(),
): RehearsalCliOptions {
  const arguments_ = parseCliArguments(argv)
  assertKnownArguments(arguments_, ['help', 'output'])
  const help = hasFlag(arguments_, 'help')
  if (arguments_.values.get('help')) throw new Error('--help does not accept a value.')
  if (arguments_.values.get('output')?.length && arguments_.values.get('output')?.length !== 1) {
    throw new Error('--output must be supplied exactly once.')
  }
  const output = stringArgument(arguments_, 'output')
  if (help) {
    if (output !== undefined) throw new Error('--help cannot be combined with --output.')
    return { help: true }
  }
  if (!output) throw new Error('--output <fresh-directory> is required.')
  return { help: false, outputDirectory: resolve(workingDirectory, output) }
}

export function extractSqlScenarioEvidence(output: string): unknown {
  const first = output.indexOf(SCENARIO_EVIDENCE_MARKER)
  if (first < 0) throw new Error('The SQL verifier did not emit scenario evidence.')
  const second = output.indexOf(SCENARIO_EVIDENCE_MARKER, first + SCENARIO_EVIDENCE_MARKER.length)
  if (second >= 0) throw new Error('The SQL verifier emitted duplicate scenario evidence markers.')
  const jsonStart = first + SCENARIO_EVIDENCE_MARKER.length
  const lineEnd = output.indexOf('\n', jsonStart)
  const json = output.slice(jsonStart, lineEnd < 0 ? output.length : lineEnd).trim()
  try {
    return JSON.parse(json) as unknown
  } catch (error) {
    throw new Error(
      `The SQL verifier emitted invalid scenario evidence JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export function validateSqlScenarioEvidence(value: unknown): RawSqlScenarioEvidence {
  const evidence = requireRecord(value, 'scenario evidence')
  if (evidence.schemaVersion !== SCENARIO_EVIDENCE_SCHEMA_VERSION) {
    throw new Error(
      `Unexpected scenario evidence schemaVersion: ${String(evidence.schemaVersion)}.`,
    )
  }
  if (evidence.allScenariosPassed !== true) {
    throw new Error('The SQL verifier did not affirm that all scenarios passed.')
  }
  const counts = requireRecord(evidence.mixedPackageCounts, 'mixedPackageCounts')
  for (const [key, expected] of Object.entries(EXACT_MIXED_PACKAGE_COUNTS)) {
    if (counts[key] !== expected) {
      throw new Error(
        `mixedPackageCounts.${key} must be ${expected}; received ${String(counts[key])}.`,
      )
    }
  }
  if (!Array.isArray(evidence.scenarios) || evidence.scenarios.length !== 20) {
    throw new Error(
      `Scenario evidence must contain exactly 20 entries; received ${Array.isArray(evidence.scenarios) ? evidence.scenarios.length : 'non-array'}.`,
    )
  }
  const scenarios = evidence.scenarios.map(validateScenario)
  const uniqueIds = new Set(scenarios.map(({ scenarioId }) => scenarioId))
  if (uniqueIds.size !== REQUIRED_SCENARIO_IDS.length) {
    throw new Error('Scenario evidence contains a duplicate or missing scenario ID.')
  }
  const mixedActual = scenarios[2]?.actualResult
  for (const [key, expected] of Object.entries(EXACT_MIXED_PACKAGE_COUNTS)) {
    if (mixedActual?.[key] !== expected) {
      throw new Error(`S03 actualResult.${key} must be runtime-derived as ${expected}.`)
    }
  }
  const eventCounts = requireRecord(mixedActual.eventCounts, 'S03 actualResult.eventCounts')
  const insertRevisionCounts = requireRecord(
    mixedActual.insertRevisionCounts,
    'S03 actualResult.insertRevisionCounts',
  )
  const exactMixedEvidence = [
    [eventCounts.import_started, 1, 'eventCounts.import_started'],
    [eventCounts.review_imported, 624, 'eventCounts.review_imported'],
    [eventCounts.import_completed, 1, 'eventCounts.import_completed'],
    [insertRevisionCounts.revision1, 621, 'insertRevisionCounts.revision1'],
    [insertRevisionCounts.revision2, 3, 'insertRevisionCounts.revision2'],
    [mixedActual.changedPointerCount, 624, 'changedPointerCount'],
    [mixedActual.unchangedNoopPointerCount, 6, 'unchangedNoopPointerCount'],
    [mixedActual.finalMatchingHeadCount, 630, 'finalMatchingHeadCount'],
    [mixedActual.uniqueActionIdentities, 630, 'uniqueActionIdentities'],
  ] as const
  for (const [actual, expected, label] of exactMixedEvidence) {
    if (actual !== expected) {
      throw new Error(`S03 actualResult.${label} must be runtime-derived as ${expected}.`)
    }
  }

  const ambiguous = scenarios[4]
  if (
    ambiguous.mutationCount !== 1 ||
    ambiguous.actualResult.clientObservedReceipt !== false ||
    ambiguous.actualResult.databaseStatus !== 'completed' ||
    ambiguous.actualResult.automaticRetryPermitted !== false ||
    ambiguous.actualResult.durableCommitObserved !== true
  ) {
    throw new Error(
      'S05 must prove an unacknowledged durable commit in a later transaction with automatic retry prohibited.',
    )
  }

  const restore = scenarios[6]
  if (
    restore.preState.effectiveStateHash !== restore.postState.effectiveStateHash ||
    restore.preState.physicalStateHash === restore.postState.physicalStateHash
  ) {
    throw new Error(
      'S07 must prove effective-state restoration and append-only physical-state difference.',
    )
  }

  const requireUnchangedState = (scenarioIndex: number) => {
    const scenario = scenarios[scenarioIndex]
    const fields = [
      'reviewCount',
      'eventCount',
      'currentPointer',
      'maxRevision',
      'effectiveStateHash',
      'physicalStateHash',
    ] as const
    if (
      scenario.mutationCount !== 0 ||
      fields.some((field) => scenario.preState[field] !== scenario.postState[field])
    ) {
      throw new Error(`${scenario.scenarioId} must prove a zero-mutation unchanged-state outcome.`)
    }
  }
  for (const scenarioIndex of [5, 9, 12, 13, 14, 15, 16, 17, 18, 19]) {
    requireUnchangedState(scenarioIndex)
  }

  for (const scenarioIndex of [10, 11]) {
    const scenario = scenarios[scenarioIndex]
    if (
      scenario.postState.reviewCount !== scenario.preState.reviewCount + 1 ||
      scenario.postState.maxRevision !== scenario.preState.maxRevision + 1 ||
      scenario.postState.currentPointer === null ||
      scenario.postState.currentPointer === scenario.preState.currentPointer
    ) {
      throw new Error(`${scenario.scenarioId} must prove one linear ordinary-review append.`)
    }
  }

  for (const scenarioIndex of [3, 8]) {
    const scenario = scenarios[scenarioIndex]
    const expectedEventSequence =
      scenarioIndex === 3
        ? ['import_started', 'import_failed']
        : ['import_compensation_started', 'import_compensation_failed']
    if (
      scenario.mutationCount !== 0 ||
      scenario.postState.reviewCount !== scenario.preState.reviewCount ||
      scenario.postState.currentPointer !== scenario.preState.currentPointer ||
      scenario.postState.maxRevision !== scenario.preState.maxRevision ||
      scenario.postState.effectiveStateHash !== scenario.preState.effectiveStateHash ||
      scenario.postState.eventCount !== scenario.preState.eventCount + 2 ||
      scenario.postState.physicalStateHash === scenario.preState.physicalStateHash ||
      scenario.actualResult.receiptAfterPhysicalStateSha256 !==
        scenario.postState.physicalStateHash ||
      canonicalJson(scenario.actualResult.eventSequence) !== canonicalJson(expectedEventSequence) ||
      scenario.actualResult.physicalAuditSealed !== true ||
      scenario.actualResult.physicalAuditChanged !== true ||
      scenario.actualResult.effectiveStateChanged !== false
    ) {
      throw new Error(
        `${scenario.scenarioId} must prove atomic review-state failure with a sealed two-event audit receipt.`,
      )
    }
  }
  return evidence as unknown as RawSqlScenarioEvidence
}

function normalizeVolatileRuntimeEvidence<T>(value: T): T {
  const rawToToken = new Map<string, string>()
  const uuidToToken = new Map<string, string>()
  if (isRecord(value) && Array.isArray(value.scenarios)) {
    for (const scenarioValue of value.scenarios) {
      if (!isRecord(scenarioValue)) continue
      for (const stateName of ['preState', 'postState']) {
        const state = scenarioValue[stateName]
        if (!isRecord(state) || typeof state.physicalStateHash !== 'string') continue
        if (!rawToToken.has(state.physicalStateHash)) {
          rawToToken.set(
            state.physicalStateHash,
            `physical-state-equality-token-${String(rawToToken.size + 1).padStart(3, '0')}`,
          )
        }
      }
    }
  }

  const collectUuids = (entry: unknown): void => {
    if (typeof entry === 'string' && UUID_PATTERN.test(entry)) {
      if (!uuidToToken.has(entry)) {
        uuidToToken.set(
          entry,
          `uuid-equality-token-${String(uuidToToken.size + 1).padStart(3, '0')}`,
        )
      }
      return
    }
    if (Array.isArray(entry)) {
      entry.forEach(collectUuids)
      return
    }
    if (isRecord(entry)) {
      Object.keys(entry)
        .sort()
        .forEach((childKey) => collectUuids(entry[childKey]))
    }
  }
  collectUuids(value)

  const visit = (entry: unknown, key?: string): unknown => {
    if (typeof entry === 'string' && rawToToken.has(entry)) {
      if (key?.toLowerCase().includes('effective') && key.toLowerCase().includes('hash')) {
        return entry
      }
      return rawToToken.get(entry)
    }
    if (typeof entry === 'string' && uuidToToken.has(entry)) return uuidToToken.get(entry)
    if (Array.isArray(entry)) return entry.map((child) => visit(child))
    if (isRecord(entry)) {
      return Object.fromEntries(
        Object.entries(entry).map(([childKey, child]) => [childKey, visit(child, childKey)]),
      )
    }
    return entry
  }
  return visit(value) as T
}

export function buildCanonicalScenarioEvidence(
  raw: RawSqlScenarioEvidence,
  migrationSha256: string,
  verifierSha256: string,
) {
  requireSha256(migrationSha256, 'migrationSha256')
  requireSha256(verifierSha256, 'verifierSha256')
  const normalized = normalizeVolatileRuntimeEvidence(raw)
  return {
    schemaVersion: SCENARIO_EVIDENCE_SCHEMA_VERSION,
    migrationSha256,
    verifierSha256,
    normalization: {
      physicalStateHashes:
        'Equality-preserving deterministic tokens; raw runtime hashes are retained only in execution-receipt.json.',
      runtimeUuids:
        'First-seen equality-preserving deterministic tokens; raw runtime UUIDs are retained only in execution-receipt.json.',
    },
    mixedPackageCounts: normalized.mixedPackageCounts,
    scenarios: normalized.scenarios,
    allScenariosPassed: normalized.allScenariosPassed,
  }
}

function sortCanonical(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new Error('Canonical JSON cannot contain a non-finite number.')
    return value
  }
  if (Array.isArray(value)) return value.map(sortCanonical)
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareCodeUnits)
        .map((key) => [key, sortCanonical(value[key])]),
    )
  }
  throw new Error(`Canonical JSON cannot contain ${typeof value}.`)
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(sortCanonical(value), null, 2)}\n`
}

export function validateSupabaseLint(value: unknown) {
  if (!Array.isArray(value)) throw new Error('Supabase db lint output must be a JSON array.')
  const warningMap = new Map<string, LintWarning>()
  let rawIssueCount = 0
  for (const [groupIndex, groupValue] of value.entries()) {
    const group = requireRecord(groupValue, `lint[${groupIndex}]`)
    const functionName = requireNonemptyString(group.function, `lint[${groupIndex}].function`)
    if (!Array.isArray(group.issues) || group.issues.length === 0) {
      throw new Error(`lint[${groupIndex}].issues must be a nonempty array.`)
    }
    for (const [issueIndex, issueValue] of group.issues.entries()) {
      rawIssueCount += 1
      const issue = requireRecord(issueValue, `lint[${groupIndex}].issues[${issueIndex}]`)
      const level = requireNonemptyString(issue.level, 'lint issue level')
      const message = requireNonemptyString(issue.message, 'lint issue message')
      const sqlState = requireNonemptyString(issue.sqlState, 'lint issue sqlState')
      if (level === 'error')
        throw new Error(`Supabase db lint error in ${functionName}: ${message}`)
      if (level !== 'warning') throw new Error(`Unexpected Supabase db lint level: ${level}.`)
      const key = `${functionName}\0${message}\0${sqlState}`
      const existing = warningMap.get(key)
      warningMap.set(key, {
        function: functionName,
        level: 'warning',
        message,
        occurrences: (existing?.occurrences ?? 0) + 1,
        sqlState: sqlState as '00000',
      })
    }
  }
  const warnings = [...warningMap.values()].sort((left, right) =>
    compareCodeUnits(left.function, right.function),
  )
  if (canonicalJson(warnings) !== canonicalJson(EXPECTED_LINT_WARNINGS)) {
    throw new Error(
      `Supabase db lint warning set changed unexpectedly: ${canonicalJson(warnings).trim()}`,
    )
  }
  return {
    command: 'supabase db lint --schema public --level warning --fail-on none --output json',
    errors: [],
    warnings,
    warningCount: warnings.length,
    rawIssueCount,
    passed: true,
  }
}

function requireExactNames(actual: string[], expected: readonly string[], label: string): void {
  const sortedActual = [...actual].sort()
  const sortedExpected = [...expected].sort()
  if (canonicalJson(sortedActual) !== canonicalJson(sortedExpected)) {
    throw new Error(
      `${label} changed: expected ${sortedExpected.join(', ')}; got ${sortedActual.join(', ')}.`,
    )
  }
}

export function validateSecurityIntrospection(value: unknown) {
  const report = requireRecord(value, 'security introspection')
  if (!Array.isArray(report.rls)) throw new Error('security introspection.rls must be an array.')
  const rls = report.rls.map((rowValue, index) => {
    const row = requireRecord(rowValue, `rls[${index}]`)
    const tableName = requireNonemptyString(row.tableName, `rls[${index}].tableName`)
    if (row.rlsEnabled !== true) throw new Error(`RLS is not enabled on public.${tableName}.`)
    return { tableName, rlsEnabled: true }
  })
  requireExactNames(
    rls.map(({ tableName }) => tableName),
    REQUIRED_RLS_TABLES,
    'RLS table set',
  )

  if (!Array.isArray(report.functions)) {
    throw new Error('security introspection.functions must be an array.')
  }
  const functions = report.functions.map((rowValue, index) => {
    const row = requireRecord(rowValue, `functions[${index}]`)
    const name = requireNonemptyString(row.name, `functions[${index}].name`)
    const identityArguments = requireNonemptyString(
      row.identityArguments,
      `functions[${index}].identityArguments`,
    )
    const owner = requireNonemptyString(row.owner, `functions[${index}].owner`)
    const searchPath = requireNonemptyString(row.searchPath, `functions[${index}].searchPath`)
    if (row.securityDefiner !== true) throw new Error(`${name} is not SECURITY DEFINER.`)
    if (owner !== 'supabase_admin') {
      throw new Error(`${name} has unexpected owner ${owner}; expected supabase_admin.`)
    }
    if (!SAFE_SEARCH_PATHS.has(searchPath))
      throw new Error(`${name} has unsafe search_path: ${searchPath}.`)
    if (
      row.publicExecute !== false ||
      row.anonExecute !== false ||
      row.authenticatedExecute !== false
    ) {
      throw new Error(`${name} has an unexpected ordinary-client EXECUTE grant.`)
    }
    if (row.serviceRoleExecute !== true) {
      throw new Error(`${name} is not executable by service_role.`)
    }
    return {
      name,
      identityArguments,
      owner,
      securityDefiner: true,
      searchPath,
      publicExecute: false,
      anonExecute: false,
      authenticatedExecute: false,
      serviceRoleExecute: true,
    }
  })
  requireExactNames(
    functions.map(({ name }) => name),
    REQUIRED_TRANSITION_FUNCTIONS,
    'transition function set',
  )

  const privileges = requireRecord(report.reviewPrivileges, 'reviewPrivileges')
  for (const key of [
    'publicInsert',
    'publicUpdate',
    'publicDelete',
    'publicTruncate',
    'publicReferences',
    'publicTrigger',
    'anonInsert',
    'anonUpdate',
    'anonDelete',
    'anonTruncate',
    'anonReferences',
    'anonTrigger',
    'authenticatedInsert',
    'authenticatedUpdate',
    'authenticatedDelete',
    'authenticatedTruncate',
    'authenticatedReferences',
    'authenticatedTrigger',
  ]) {
    if (privileges[key] !== false) throw new Error(`Unexpected immutable review privilege: ${key}.`)
  }
  if (
    privileges.serviceRoleSelect !== true ||
    privileges.serviceRoleInsert !== true ||
    privileges.serviceRoleUpdate !== true ||
    privileges.serviceRoleDelete !== true ||
    privileges.serviceRoleTruncate !== false ||
    privileges.serviceRoleReferences !== false ||
    privileges.serviceRoleTrigger !== false
  ) {
    throw new Error('Expected service_role review privileges changed unexpectedly.')
  }

  const eventPrivileges = requireRecord(report.eventPrivileges, 'eventPrivileges')
  for (const key of [
    'publicInsert',
    'publicUpdate',
    'publicDelete',
    'publicTruncate',
    'publicReferences',
    'publicTrigger',
    'anonInsert',
    'anonUpdate',
    'anonDelete',
    'anonTruncate',
    'anonReferences',
    'anonTrigger',
    'authenticatedInsert',
    'authenticatedUpdate',
    'authenticatedDelete',
    'authenticatedTruncate',
    'authenticatedReferences',
    'authenticatedTrigger',
  ]) {
    if (eventPrivileges[key] !== false) {
      throw new Error(`Unexpected ordinary-client event privilege: ${key}.`)
    }
  }
  if (
    eventPrivileges.serviceRoleSelect !== true ||
    eventPrivileges.serviceRoleInsert !== true ||
    eventPrivileges.serviceRoleUpdate !== true ||
    eventPrivileges.serviceRoleDelete !== true ||
    eventPrivileges.serviceRoleTruncate !== false ||
    eventPrivileges.serviceRoleReferences !== false ||
    eventPrivileges.serviceRoleTrigger !== false
  ) {
    throw new Error('Expected service_role event privileges changed unexpectedly.')
  }

  if (!Array.isArray(report.journalPrivileges)) {
    throw new Error('security introspection.journalPrivileges must be an array.')
  }
  const journalPrivileges = report.journalPrivileges.map((rowValue, index) => {
    const row = requireRecord(rowValue, `journalPrivileges[${index}]`)
    const tableName = requireNonemptyString(row.tableName, `journalPrivileges[${index}].tableName`)
    const role = requireNonemptyString(row.role, `journalPrivileges[${index}].role`)
    const expectedSelect = role === 'service_role'
    for (const privilege of ['select', 'insert', 'update', 'delete', 'truncate'] as const) {
      const expected = privilege === 'select' ? expectedSelect : false
      if (row[privilege] !== expected) {
        throw new Error(
          `Unexpected journal privilege public.${tableName} ${role} ${privilege}: ${String(row[privilege])}.`,
        )
      }
    }
    return {
      tableName,
      role,
      select: expectedSelect,
      insert: false,
      update: false,
      delete: false,
      truncate: false,
    }
  })
  requireExactNames(
    journalPrivileges.map(({ tableName, role }) => `${tableName}:${role}`),
    REQUIRED_JOURNAL_TABLES.flatMap((tableName) =>
      REQUIRED_JOURNAL_ROLES.map((role) => `${tableName}:${role}`),
    ),
    'journal privilege subject set',
  )

  if (!Array.isArray(report.schemaCreatePrivileges)) {
    throw new Error('security introspection.schemaCreatePrivileges must be an array.')
  }
  const schemaCreatePrivileges = report.schemaCreatePrivileges.map((rowValue, index) => {
    const row = requireRecord(rowValue, `schemaCreatePrivileges[${index}]`)
    const schemaName = requireNonemptyString(
      row.schemaName,
      `schemaCreatePrivileges[${index}].schemaName`,
    )
    const role = requireNonemptyString(row.role, `schemaCreatePrivileges[${index}].role`)
    const owner = requireNonemptyString(row.owner, `schemaCreatePrivileges[${index}].owner`)
    if (row.create !== false) {
      throw new Error(`Unsafe CREATE privilege on ${schemaName} for ${role}.`)
    }
    return { schemaName, role, owner, create: false }
  })
  requireExactNames(
    schemaCreatePrivileges.map(({ schemaName, role }) => `${schemaName}:${role}`),
    REQUIRED_SAFE_SEARCH_PATH_SCHEMAS.flatMap((schemaName) =>
      REQUIRED_ORDINARY_ROLES.map((role) => `${schemaName}:${role}`),
    ),
    'safe search_path schema/role set',
  )

  const constraints = Array.isArray(report.constraints)
    ? report.constraints.map((entry, index) =>
        requireNonemptyString(entry, `constraints[${index}]`),
      )
    : []
  for (const constraint of REQUIRED_CONSTRAINTS) {
    if (!constraints.includes(constraint))
      throw new Error(`Required constraint is missing: ${constraint}.`)
  }
  if (!Array.isArray(report.constraintDefinitions)) {
    throw new Error('security introspection.constraintDefinitions must be an array.')
  }
  const constraintDefinitions = report.constraintDefinitions.map((rowValue, index) => {
    const row = requireRecord(rowValue, `constraintDefinitions[${index}]`)
    return {
      name: requireNonemptyString(row.name, `constraintDefinitions[${index}].name`),
      tableName: requireNonemptyString(row.tableName, `constraintDefinitions[${index}].tableName`),
      definition: requireNonemptyString(
        row.definition,
        `constraintDefinitions[${index}].definition`,
      ),
    }
  })
  for (const constraint of REQUIRED_CONSTRAINTS) {
    const definition = constraintDefinitions.find(({ name }) => name === constraint)?.definition
    if (!definition) throw new Error(`Required constraint definition is missing: ${constraint}.`)
    for (const fragment of REQUIRED_CONSTRAINT_DEFINITION_FRAGMENTS[constraint] ?? []) {
      if (!definition.includes(fragment)) {
        throw new Error(
          `Constraint ${constraint} is missing required definition fragment: ${fragment}.`,
        )
      }
    }
  }

  if (!Array.isArray(report.uniqueIndexes)) {
    throw new Error('security introspection.uniqueIndexes must be an array.')
  }
  const uniqueIndexes = report.uniqueIndexes.map((rowValue, index) => {
    const row = requireRecord(rowValue, `uniqueIndexes[${index}]`)
    const name = requireNonemptyString(row.name, `uniqueIndexes[${index}].name`)
    const tableName = requireNonemptyString(row.tableName, `uniqueIndexes[${index}].tableName`)
    const definition = requireNonemptyString(row.definition, `uniqueIndexes[${index}].definition`)
    if (row.unique !== true || row.valid !== true) {
      throw new Error(`Required unique index is not unique and valid: ${name}.`)
    }
    for (const fragment of REQUIRED_INDEX_DEFINITION_FRAGMENTS[name] ?? []) {
      if (!definition.includes(fragment)) {
        throw new Error(
          `Unique index ${name} is missing required definition fragment: ${fragment}.`,
        )
      }
    }
    return {
      name,
      tableName,
      unique: true,
      valid: true,
      predicate:
        row.predicate === null ? null : requireNonemptyString(row.predicate, `${name}.predicate`),
      definition,
    }
  })
  requireExactNames(
    uniqueIndexes.map(({ name }) => name),
    REQUIRED_UNIQUE_INDEXES,
    'required unique index set',
  )

  if (!Array.isArray(report.journalPolicies)) {
    throw new Error('security introspection.journalPolicies must be an array.')
  }
  const journalPolicies = report.journalPolicies.map((rowValue, index) => {
    const row = requireRecord(rowValue, `journalPolicies[${index}]`)
    const name = requireNonemptyString(row.name, `journalPolicies[${index}].name`)
    const tableName = requireNonemptyString(row.tableName, `journalPolicies[${index}].tableName`)
    const command = requireNonemptyString(row.command, `journalPolicies[${index}].command`)
    const using = requireNonemptyString(row.using, `journalPolicies[${index}].using`)
    const withCheck = requireNonemptyString(row.withCheck, `journalPolicies[${index}].withCheck`)
    if (command !== 'ALL') throw new Error(`Journal RLS policy ${name} is not FOR ALL.`)
    if (!Array.isArray(row.roles) || row.roles.length !== 1 || row.roles[0] !== 'service_role') {
      throw new Error(`Journal RLS policy ${name} has unexpected roles.`)
    }
    if (!using.includes('development') || !withCheck.includes('development')) {
      throw new Error(`Journal RLS policy ${name} does not enforce development scope.`)
    }
    if (
      name === 'literature_gold_review_operation_actions_service_policy' &&
      (!using.includes('literature_gold_review_operations') ||
        !withCheck.includes('literature_gold_review_operations'))
    ) {
      throw new Error(`Journal action RLS policy ${name} does not bind operation ownership.`)
    }
    return { name, tableName, command, roles: ['service_role'], using, withCheck }
  })
  requireExactNames(
    journalPolicies.map(({ name }) => name),
    REQUIRED_JOURNAL_POLICIES,
    'journal RLS policy set',
  )
  const triggers = Array.isArray(report.triggers)
    ? report.triggers.map((rowValue, index) => {
        const row = requireRecord(rowValue, `triggers[${index}]`)
        const name = requireNonemptyString(row.name, `triggers[${index}].name`)
        const enableMode = requireNonemptyString(row.enableMode, `triggers[${index}].enableMode`)
        if (row.enabled !== true || !['O', 'A'].includes(enableMode)) {
          throw new Error(`Required trigger is not enabled for origin sessions: ${name}.`)
        }
        return {
          name,
          tableName: requireNonemptyString(row.tableName, `triggers[${index}].tableName`),
          enableMode,
          enabled: true,
        }
      })
    : []
  for (const trigger of REQUIRED_TRIGGERS) {
    if (!triggers.some(({ name }) => name === trigger))
      throw new Error(`Required trigger is missing: ${trigger}.`)
  }
  const eventTypes = Array.isArray(report.supportedEventTypes)
    ? report.supportedEventTypes.map((entry, index) =>
        requireNonemptyString(entry, `supportedEventTypes[${index}]`),
      )
    : []
  requireExactNames(eventTypes, REQUIRED_EVENT_TYPES, 'supported event type set')

  return {
    rls: [...rls].sort((left, right) => compareCodeUnits(left.tableName, right.tableName)),
    functions: [...functions].sort((left, right) => compareCodeUnits(left.name, right.name)),
    reviewPrivileges: privileges,
    eventPrivileges,
    journalPrivileges: [...journalPrivileges].sort((left, right) =>
      compareCodeUnits(`${left.tableName}:${left.role}`, `${right.tableName}:${right.role}`),
    ),
    schemaCreatePrivileges: [...schemaCreatePrivileges].sort((left, right) =>
      compareCodeUnits(`${left.schemaName}:${left.role}`, `${right.schemaName}:${right.role}`),
    ),
    constraints: [...constraints].sort(),
    constraintDefinitions: [...constraintDefinitions].sort((left, right) =>
      compareCodeUnits(left.name, right.name),
    ),
    uniqueIndexes: [...uniqueIndexes].sort((left, right) =>
      compareCodeUnits(left.name, right.name),
    ),
    journalPolicies: [...journalPolicies].sort((left, right) =>
      compareCodeUnits(left.name, right.name),
    ),
    triggers: [...triggers].sort((left, right) => compareCodeUnits(left.name, right.name)),
    supportedEventTypes: [...eventTypes].sort(),
    assertions: [
      { name: 'all required public tables have RLS enabled', passed: true },
      {
        name: 'transition functions use SECURITY DEFINER with fixed safe search_path',
        passed: true,
      },
      { name: 'ordinary clients and PUBLIC cannot execute transition functions', passed: true },
      { name: 'service_role can execute each approved transition function', passed: true },
      {
        name: 'operation journals expose exact service_role SELECT-only grants',
        passed: true,
      },
      {
        name: 'ordinary roles cannot create objects in security-definer search_path schemas',
        passed: true,
      },
      {
        name: 'review grants exclude truncate, references, and trigger while ordinary-client writes remain prohibited',
        passed: true,
      },
      {
        name: 'event grants exclude truncate, references, and trigger while ordinary-client writes remain prohibited',
        passed: true,
      },
      { name: 'journal RLS policies bind service_role to development operations', passed: true },
      { name: 'required lifecycle and operation constraints exist', passed: true },
      { name: 'required idempotency and linear-chain unique indexes are valid', passed: true },
      {
        name: 'required chain, journal, event, and immutability triggers are enabled',
        passed: true,
      },
      { name: 'the supported event vocabulary is exact', passed: true },
    ],
    passed: true,
  }
}
