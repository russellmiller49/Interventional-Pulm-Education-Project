import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

import { assertKnownArguments, hasFlag, parseCliArguments, stringArgument } from './lib/cli'

export const SCENARIO_EVIDENCE_MARKER = 'PR84_SCENARIO_EVIDENCE_JSON:'
export const SCENARIO_EVIDENCE_SCHEMA_VERSION = 'pr84-scenario-evidence/v1'
export const LINT_INTROSPECTION_SCHEMA_VERSION = 'pr84-lint-introspection/v1'
export const REHEARSAL_MANIFEST_SCHEMA_VERSION = 'pr84-rehearsal-manifest/v1'
export const EXECUTION_RECEIPT_SCHEMA_VERSION = 'pr84-execution-receipt/v1'
export const SCHEMA_SECURITY_DEFINITION_IDENTITY_SCHEMA_VERSION =
  'gold-import-compensation-schema-security-definition-identity/1.0.0'

/** Fixed-image PostgreSQL 17 semantic identity; regenerated only through the disposable harness. */
export const POST_MIGRATION_SCHEMA_SECURITY_IDENTITY_SHA256 =
  'b5c6a6050b2c17c60c28fa400c6957103277e51e8b54425c290f43c92a447471'

export interface SchemaSecurityDefinitionRecord {
  definitionSha256: string
  normalizedDefinition: string
  objectIdentity: string
  objectName: string
  objectType: string
  owner: string | null
  parentObjectName: string | null
  relevantRoles: string[]
  schemaName: string
  state: Record<string, unknown>
}

export interface SchemaSecurityDefinitionIdentity {
  records: SchemaSecurityDefinitionRecord[]
  schemaVersion: typeof SCHEMA_SECURITY_DEFINITION_IDENTITY_SCHEMA_VERSION
}

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

/**
 * Exact public-function catalog touched by the compensation migration, including the three legacy
 * functions whose definitions/ACLs it patches dynamically. Snapshot and disposable rehearsal SQL
 * must both derive their function and function-ACL scopes from this list.
 */
export const SCHEMA_SECURITY_FUNCTION_NAMES = [
  'apply_literature_gold_import_v1',
  'assert_literature_gold_jsonb_object_v1',
  'assert_literature_gold_jsonb_scalar_v1',
  'assert_literature_gold_review_chain_head_v1',
  'check_literature_gold_review_chain_head',
  'compensate_literature_gold_import_v1',
  'get_literature_gold_review_item_v1',
  'guard_literature_gold_review_action_mutation',
  'guard_literature_gold_review_chain_insert',
  'guard_literature_gold_review_operation_mutation',
  'literature_gold_canonical_json_v1',
  'literature_gold_development_membership_hash_v1',
  'literature_gold_effective_state_hash_v1',
  'literature_gold_is_timestamptz_v1',
  'literature_gold_jsonb_sha256_v1',
  'literature_gold_physical_state_hash_v1',
  'literature_gold_review_clinical_projection_v1',
  'literature_gold_review_operation_receipt_v1',
  'literature_gold_review_operation_result_v1',
  'reconcile_literature_gold_review_operation_v1',
  'save_literature_gold_review_v1',
  'update_literature_gold_item_v1',
  'validate_literature_gold_import_review_payload_v1',
  'validate_literature_gold_operation_event',
] as const

export const REQUIRED_JOURNAL_TABLES = [
  'literature_gold_review_operation_actions',
  'literature_gold_review_operations',
] as const

export const REQUIRED_JOURNAL_ROLES = ['public', 'anon', 'authenticated', 'service_role'] as const

export const SCHEMA_SECURITY_COLUMN_ROLES = [
  'public',
  'anon',
  'authenticated',
  'service_role',
] as const
export const SCHEMA_SECURITY_COLUMN_PRIVILEGES = [
  'SELECT',
  'INSERT',
  'UPDATE',
  'REFERENCES',
] as const

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
  'literature_gold_set_batches_frozen_state_check',
  'literature_gold_set_batches_kind_check',
  'literature_gold_set_batches_name_check',
  'literature_gold_set_batches_name_key',
  'literature_gold_set_batches_pkey',
  'literature_gold_set_batches_report_check',
  'literature_gold_set_batches_requested_size_check',
  'literature_gold_set_batches_sampling_seed_check',
  'literature_gold_set_batches_status_check',
  'literature_gold_set_batches_test_percent_check',
  'literature_gold_set_batches_test_unlock_check',
  'literature_gold_set_events_after_check',
  'literature_gold_set_events_batch_id_fkey',
  'literature_gold_set_events_before_check',
  'literature_gold_set_events_item_id_fkey',
  'literature_gold_set_events_operation_action_fk',
  'literature_gold_set_events_operation_fk',
  'literature_gold_set_events_operation_shape_check',
  'literature_gold_set_events_pkey',
  'literature_gold_set_events_type_check',
  'literature_gold_set_items_batch_id_display_order_key',
  'literature_gold_set_items_batch_id_fkey',
  'literature_gold_set_items_batch_id_pmid_key',
  'literature_gold_set_items_completion_check',
  'literature_gold_set_items_current_review_fk',
  'literature_gold_set_items_dataset_split_check',
  'literature_gold_set_items_display_order_check',
  'literature_gold_set_items_pkey',
  'literature_gold_set_items_pmid_fkey',
  'literature_gold_set_items_review_status_check',
  'literature_gold_set_items_sampling_metadata_check',
  'literature_gold_set_items_sampling_reason_check',
  'literature_gold_set_items_stratum_check',
  'literature_gold_set_review_drafts_confidence_check',
  'literature_gold_set_review_drafts_item_id_fkey',
  'literature_gold_set_review_drafts_metadata_check',
  'literature_gold_set_review_drafts_notes_check',
  'literature_gold_set_review_drafts_pkey',
  'literature_gold_set_review_drafts_relevance_check',
  'literature_gold_set_review_drafts_seconds_check',
  'literature_gold_set_reviews_compensates_fk',
  'literature_gold_set_reviews_confidence_check',
  'literature_gold_set_reviews_effective_source_fk',
  'literature_gold_set_reviews_enrichment_status_check',
  'literature_gold_set_reviews_enrichment_versions_check',
  'literature_gold_set_reviews_full_text_categorization_check',
  'literature_gold_set_reviews_id_item_id_key',
  'literature_gold_set_reviews_included_labels_check',
  'literature_gold_set_reviews_item_id_fkey',
  'literature_gold_set_reviews_item_id_revision_key',
  'literature_gold_set_reviews_lifecycle_state_check',
  'literature_gold_set_reviews_metadata_check',
  'literature_gold_set_reviews_notes_check',
  'literature_gold_set_reviews_operation_action_fk',
  'literature_gold_set_reviews_pkey',
  'literature_gold_set_reviews_relevance_check',
  'literature_gold_set_reviews_revision_check',
  'literature_gold_set_reviews_revision_contract_check',
  'literature_gold_set_reviews_revision_kind_check',
  'literature_gold_set_reviews_seconds_check',
  'literature_gold_set_reviews_supersedes_fk',
  'literature_gold_set_reviews_time_check',
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
  'audit_literature_gold_test_unlock_transition',
  'check_literature_gold_chain_head_after_item',
  'check_literature_gold_chain_head_after_review',
  'guard_literature_gold_review_chain_insert',
  'guard_literature_gold_review_operation_actions',
  'guard_literature_gold_review_operations',
  'guard_literature_gold_test_unlock_transition',
  'prevent_literature_gold_set_events_mutation',
  'prevent_literature_gold_set_reviews_mutation',
  'protect_frozen_literature_gold_set_batches',
  'protect_frozen_literature_gold_set_items',
  'protect_frozen_literature_gold_set_review_drafts',
  'protect_frozen_literature_gold_set_reviews',
  'protect_literature_gold_set_composition',
  'protect_locked_literature_gold_test_drafts',
  'protect_locked_literature_gold_test_items',
  'protect_locked_literature_gold_test_reviews',
  'set_literature_gold_set_batches_updated_at',
  'set_literature_gold_set_items_updated_at',
  'set_literature_gold_set_review_drafts_updated_at',
  'validate_literature_gold_batch_created_event',
  'validate_literature_gold_operation_event',
] as const

export const REQUIRED_UNIQUE_INDEX_TABLES = {
  literature_gold_review_operations_one_live_compensation_idx: 'literature_gold_review_operations',
  literature_gold_set_events_operation_sequence_idx: 'literature_gold_set_events',
  literature_gold_set_reviews_one_child_idx: 'literature_gold_set_reviews',
  literature_gold_set_reviews_one_operation_action_idx: 'literature_gold_set_reviews',
} as const satisfies Readonly<Record<(typeof REQUIRED_UNIQUE_INDEXES)[number], string>>

export const REQUIRED_JOURNAL_POLICY_TABLES = {
  literature_gold_review_operation_actions_service_policy:
    'literature_gold_review_operation_actions',
  literature_gold_review_operations_service_policy: 'literature_gold_review_operations',
} as const satisfies Readonly<Record<(typeof REQUIRED_JOURNAL_POLICIES)[number], string>>

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

/** Canonical D/E catalog tuple ordering shared by builders and persisted-artifact validation. */
export function compareSchemaSecurityDefinitionRecords(
  left: SchemaSecurityDefinitionRecord,
  right: SchemaSecurityDefinitionRecord,
): number {
  return (
    compareCodeUnits(left.schemaName, right.schemaName) ||
    compareCodeUnits(left.objectType, right.objectType) ||
    compareCodeUnits(left.objectName, right.objectName) ||
    compareCodeUnits(left.objectIdentity, right.objectIdentity)
  )
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be a JSON object.`)
  return value
}

function requireExactObjectKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actualKeys = Object.keys(value).sort(compareCodeUnits)
  const expectedKeys = [...expected].sort(compareCodeUnits)
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(`${label} has unexpected or missing keys.`)
  }
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

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/**
 * Normalize catalog SQL without changing quoted identifiers, literals, or dollar-quoted function
 * bodies. This deliberately normalizes less rather than risk erasing a semantic distinction.
 */
export function normalizePostgresDefinition(definition: string): string {
  const output: string[] = []
  let index = 0
  let pendingWhitespace = false
  const appendWhitespace = () => {
    if (pendingWhitespace && output.length > 0 && output.at(-1) !== ' ') output.push(' ')
    pendingWhitespace = false
  }
  while (index < definition.length) {
    const character = definition[index]
    if (/\s/u.test(character)) {
      pendingWhitespace = true
      index += 1
      continue
    }
    appendWhitespace()
    if (character === "'" || character === '"') {
      const quote = character
      let end = index + 1
      while (end < definition.length) {
        if (definition[end] === quote && definition[end + 1] === quote) {
          end += 2
          continue
        }
        if (definition[end] === quote) {
          end += 1
          break
        }
        end += 1
      }
      output.push(definition.slice(index, end))
      index = end
      continue
    }
    if (character === '$') {
      const delimiter = definition.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/u)?.[0]
      if (delimiter) {
        const closing = definition.indexOf(delimiter, index + delimiter.length)
        const end = closing < 0 ? definition.length : closing + delimiter.length
        output.push(definition.slice(index, end))
        index = end
        continue
      }
    }
    output.push(character)
    index += 1
  }
  return output.join('').trim()
}

function catalogField(
  row: Record<string, unknown>,
  snakeCase: string,
  camelCase = snakeCase.replaceAll(/_([a-z])/gu, (_match, letter: string) => letter.toUpperCase()),
) {
  return row[snakeCase] ?? row[camelCase]
}

function optionalCatalogString(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null
  return requireNonemptyString(value, label)
}

function requireCatalogText(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`)
  return value
}

function optionalCatalogText(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null
  return requireCatalogText(value, label)
}

function requireCatalogBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean.`)
  return value
}

function requireCatalogArray(value: unknown, label: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value.map((entry, index) => requireRecord(entry, `${label}[${index}]`))
}

function sortedCatalogStrings(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  const strings = value.map((entry, index) => requireNonemptyString(entry, `${label}[${index}]`))
  if (new Set(strings).size !== strings.length) throw new Error(`${label} contains duplicates.`)
  return strings.sort(compareCodeUnits)
}

/**
 * Build the exact, deterministic catalog identity shared by audit, package, and rehearsal. Input is
 * the `catalog` object returned by operational/fixed-image introspection, or a wrapper containing it.
 */
export function buildSchemaSecurityDefinitionIdentity(
  value: unknown,
): SchemaSecurityDefinitionIdentity {
  const wrapper = requireRecord(value, 'schema/security introspection')
  const catalog = requireRecord(wrapper.catalog ?? wrapper, 'schema/security catalog')
  const records: SchemaSecurityDefinitionRecord[] = []
  const tableOwners = new Map<string, string>()
  const functionOwners = new Map<string, string>()
  const schemaOwners = new Map<string, string>()
  const functionAclEntries = requireCatalogArray(
    catalog.functionAclEntries,
    'catalog.functionAclEntries',
  )
  const columnAclEntries = requireCatalogArray(catalog.columnAclEntries, 'catalog.columnAclEntries')
  const columnPrivileges = requireCatalogArray(catalog.columnPrivileges, 'catalog.columnPrivileges')
  const knownColumns = new Set<string>()
  const inheritedTableOwner = (tableName: string, label: string) => {
    const owner = tableOwners.get(tableName)
    if (!owner) throw new Error(`${label} references unknown table owner for ${tableName}.`)
    return owner
  }
  const effectiveColumnPrivilegeState = (tableName: string, columnName: string, label: string) => {
    const matching = columnPrivileges
      .filter(
        (row) =>
          catalogField(row, 'table_name') === tableName &&
          catalogField(row, 'column_name') === columnName,
      )
      .map((row, index) => ({
        roleName: requireNonemptyString(
          catalogField(row, 'role_name'),
          `${label}.columnPrivileges[${index}].role_name`,
        ),
        privilegeName: requireNonemptyString(
          catalogField(row, 'privilege_name'),
          `${label}.columnPrivileges[${index}].privilege_name`,
        ),
        granted: requireCatalogBoolean(row.granted, `${label}.columnPrivileges[${index}].granted`),
      }))
    const expectedKeys = SCHEMA_SECURITY_COLUMN_ROLES.flatMap((roleName) =>
      SCHEMA_SECURITY_COLUMN_PRIVILEGES.map((privilegeName) => `${roleName}:${privilegeName}`),
    ).sort(compareCodeUnits)
    const actualKeys = matching
      .map(({ roleName, privilegeName }) => `${roleName}:${privilegeName}`)
      .sort(compareCodeUnits)
    if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
      throw new Error(`${label} must contain the exact protected role/column-privilege matrix.`)
    }
    return matching.sort((left, right) =>
      compareCodeUnits(
        `${left.roleName}:${left.privilegeName}`,
        `${right.roleName}:${right.privilegeName}`,
      ),
    )
  }
  const add = (input: {
    definition: string
    objectIdentity: string
    objectName: string
    objectType: string
    owner?: string | null
    parentObjectName?: string | null
    relevantRoles?: string[]
    schemaName?: string
    state: Record<string, unknown>
  }) => {
    const normalizedDefinition = normalizePostgresDefinition(input.definition)
    if (!normalizedDefinition) throw new Error(`${input.objectIdentity} has an empty definition.`)
    const relevantRoles = [...new Set(input.relevantRoles ?? [])].sort(compareCodeUnits)
    records.push({
      schemaName: input.schemaName ?? 'public',
      objectType: input.objectType,
      objectName: input.objectName,
      objectIdentity: input.objectIdentity,
      owner: input.owner ?? null,
      parentObjectName: input.parentObjectName ?? null,
      relevantRoles,
      normalizedDefinition,
      definitionSha256: sha256(normalizedDefinition),
      state: sortCanonical(input.state) as Record<string, unknown>,
    })
  }

  for (const [index, row] of requireCatalogArray(catalog.tables, 'catalog.tables').entries()) {
    const tableName = requireNonemptyString(
      catalogField(row, 'table_name'),
      `catalog.tables[${index}].table_name`,
    )
    const owner = requireNonemptyString(row.owner, `catalog.tables[${index}].owner`)
    const relationKind = requireNonemptyString(
      catalogField(row, 'relation_kind'),
      `catalog.tables[${index}].relation_kind`,
    )
    const rlsEnabled = requireCatalogBoolean(
      catalogField(row, 'rls_enabled'),
      `catalog.tables[${index}].rls_enabled`,
    )
    const forceRls = requireCatalogBoolean(
      catalogField(row, 'force_rls'),
      `catalog.tables[${index}].force_rls`,
    )
    tableOwners.set(tableName, owner)
    add({
      objectType: 'table',
      objectName: tableName,
      objectIdentity: `public.table.${tableName}`,
      owner,
      definition: `relation_kind=${relationKind};owner=${owner};rls_enabled=${String(rlsEnabled)};force_rls=${String(forceRls)}`,
      state: { forceRls, owner, relationKind, rlsEnabled },
    })
  }

  for (const [index, row] of requireCatalogArray(catalog.columns, 'catalog.columns').entries()) {
    const tableName = requireNonemptyString(
      catalogField(row, 'table_name'),
      `catalog.columns[${index}].table_name`,
    )
    const columnName = requireNonemptyString(
      catalogField(row, 'column_name'),
      `catalog.columns[${index}].column_name`,
    )
    const ordinalPosition = requireNonnegativeInteger(
      catalogField(row, 'ordinal_position'),
      `catalog.columns[${index}].ordinal_position`,
    )
    const dataType = requireNonemptyString(
      catalogField(row, 'data_type'),
      `catalog.columns[${index}].data_type`,
    )
    const udtName = requireNonemptyString(
      catalogField(row, 'udt_name'),
      `catalog.columns[${index}].udt_name`,
    )
    const isNullable = requireNonemptyString(
      catalogField(row, 'is_nullable'),
      `catalog.columns[${index}].is_nullable`,
    )
    const columnDefault = optionalCatalogString(
      catalogField(row, 'column_default'),
      `catalog.columns[${index}].column_default`,
    )
    const normalizedDefault = columnDefault ? normalizePostgresDefinition(columnDefault) : null
    const effectivePrivileges = effectiveColumnPrivilegeState(
      tableName,
      columnName,
      `catalog.columns[${index}]`,
    )
    knownColumns.add(`${tableName}\0${columnName}`)
    const state = {
      dataType,
      udtName,
      isNullable,
      ordinalPosition,
      columnDefault: normalizedDefault,
      effectivePrivileges,
    }
    add({
      objectType: 'column',
      objectName: columnName,
      objectIdentity: `public.table.${tableName}.column.${columnName}`,
      parentObjectName: tableName,
      owner: inheritedTableOwner(tableName, `catalog.columns[${index}]`),
      relevantRoles: [...SCHEMA_SECURITY_COLUMN_ROLES],
      definition: JSON.stringify(sortCanonical(state)),
      state,
    })
  }

  for (const [index, row] of columnPrivileges.entries()) {
    const tableName = requireNonemptyString(
      catalogField(row, 'table_name'),
      `catalog.columnPrivileges[${index}].table_name`,
    )
    const columnName = requireNonemptyString(
      catalogField(row, 'column_name'),
      `catalog.columnPrivileges[${index}].column_name`,
    )
    if (!knownColumns.has(`${tableName}\0${columnName}`)) {
      throw new Error(
        `catalog.columnPrivileges[${index}] references unknown protected column ${tableName}.${columnName}.`,
      )
    }
  }

  for (const [index, row] of requireCatalogArray(
    catalog.functions,
    'catalog.functions',
  ).entries()) {
    const name = requireNonemptyString(row.name, `catalog.functions[${index}].name`)
    const identityArguments = requireCatalogText(
      catalogField(row, 'identity_arguments'),
      `catalog.functions[${index}].identity_arguments`,
    )
    const definition = requireNonemptyString(
      row.definition,
      `catalog.functions[${index}].definition`,
    )
    const owner = requireNonemptyString(row.owner, `catalog.functions[${index}].owner`)
    const relevantRoles = functionAclEntries
      .filter(
        (acl) =>
          catalogField(acl, 'object_name') === name &&
          catalogField(acl, 'identity_arguments') === identityArguments,
      )
      .map((acl, aclIndex) =>
        requireNonemptyString(acl.grantee, `catalog.functionAclEntries[${aclIndex}].grantee`),
      )
    const state = {
      identityArguments,
      resultType: requireNonemptyString(
        catalogField(row, 'result_type'),
        `catalog.functions[${index}].result_type`,
      ),
      volatility: requireNonemptyString(row.volatility, `catalog.functions[${index}].volatility`),
      securityDefiner: requireCatalogBoolean(
        catalogField(row, 'security_definer'),
        `catalog.functions[${index}].security_definer`,
      ),
      owner,
      searchPath: optionalCatalogText(
        catalogField(row, 'search_path'),
        `catalog.functions[${index}].search_path`,
      ),
    }
    add({
      objectType: 'function',
      objectName: name,
      objectIdentity: `public.function.${name}(${identityArguments})`,
      owner,
      relevantRoles,
      definition,
      state,
    })
    functionOwners.set(`${name}(${identityArguments})`, owner)
  }

  for (const [index, row] of requireCatalogArray(
    catalog.constraints,
    'catalog.constraints',
  ).entries()) {
    const name = requireNonemptyString(row.name, `catalog.constraints[${index}].name`)
    const tableName = requireNonemptyString(
      catalogField(row, 'table_name'),
      `catalog.constraints[${index}].table_name`,
    )
    add({
      objectType: 'constraint',
      objectName: name,
      objectIdentity: `public.table.${tableName}.constraint.${name}`,
      parentObjectName: tableName,
      owner: inheritedTableOwner(tableName, `catalog.constraints[${index}]`),
      definition: requireNonemptyString(row.definition, `catalog.constraints[${index}].definition`),
      state: {
        validated: requireCatalogBoolean(row.validated, `catalog.constraints[${index}].validated`),
      },
    })
  }

  for (const [index, row] of requireCatalogArray(catalog.indexes, 'catalog.indexes').entries()) {
    const name = requireNonemptyString(row.name, `catalog.indexes[${index}].name`)
    const tableName = requireNonemptyString(
      catalogField(row, 'table_name'),
      `catalog.indexes[${index}].table_name`,
    )
    const predicate = optionalCatalogString(row.predicate, `catalog.indexes[${index}].predicate`)
    const owner = requireNonemptyString(row.owner, `catalog.indexes[${index}].owner`)
    add({
      objectType: 'index',
      objectName: name,
      objectIdentity: `public.table.${tableName}.index.${name}`,
      parentObjectName: tableName,
      owner,
      definition: requireNonemptyString(row.definition, `catalog.indexes[${index}].definition`),
      state: {
        constraintBacked: requireCatalogBoolean(
          catalogField(row, 'constraint_backed'),
          `catalog.indexes[${index}].constraint_backed`,
        ),
        predicate: predicate ? normalizePostgresDefinition(predicate) : null,
        unique: requireCatalogBoolean(
          catalogField(row, 'is_unique'),
          `catalog.indexes[${index}].is_unique`,
        ),
        valid: requireCatalogBoolean(
          catalogField(row, 'is_valid'),
          `catalog.indexes[${index}].is_valid`,
        ),
      },
    })
  }

  for (const [index, row] of requireCatalogArray(catalog.triggers, 'catalog.triggers').entries()) {
    const name = requireNonemptyString(row.name, `catalog.triggers[${index}].name`)
    const tableName = requireNonemptyString(
      catalogField(row, 'table_name'),
      `catalog.triggers[${index}].table_name`,
    )
    add({
      objectType: 'trigger',
      objectName: name,
      objectIdentity: `public.table.${tableName}.trigger.${name}`,
      parentObjectName: tableName,
      owner: inheritedTableOwner(tableName, `catalog.triggers[${index}]`),
      definition: requireNonemptyString(row.definition, `catalog.triggers[${index}].definition`),
      state: {
        enableMode: requireNonemptyString(
          catalogField(row, 'enable_mode'),
          `catalog.triggers[${index}].enable_mode`,
        ),
        enabled: requireCatalogBoolean(row.enabled, `catalog.triggers[${index}].enabled`),
      },
    })
  }

  for (const [index, row] of requireCatalogArray(catalog.policies, 'catalog.policies').entries()) {
    const name = requireNonemptyString(row.name, `catalog.policies[${index}].name`)
    const tableName = requireNonemptyString(
      catalogField(row, 'table_name'),
      `catalog.policies[${index}].table_name`,
    )
    const roles = sortedCatalogStrings(row.roles, `catalog.policies[${index}].roles`)
    const command = requireNonemptyString(row.command, `catalog.policies[${index}].command`)
    const permissive = requireNonemptyString(
      row.permissive,
      `catalog.policies[${index}].permissive`,
    )
    const usingExpression = optionalCatalogString(
      catalogField(row, 'using_expression'),
      `catalog.policies[${index}].using_expression`,
    )
    const withCheckExpression = optionalCatalogString(
      catalogField(row, 'with_check_expression'),
      `catalog.policies[${index}].with_check_expression`,
    )
    const state = {
      command,
      permissive,
      roles,
      usingExpression: usingExpression ? normalizePostgresDefinition(usingExpression) : null,
      withCheckExpression: withCheckExpression
        ? normalizePostgresDefinition(withCheckExpression)
        : null,
    }
    add({
      objectType: 'policy',
      objectName: name,
      objectIdentity: `public.table.${tableName}.policy.${name}`,
      parentObjectName: tableName,
      owner: inheritedTableOwner(tableName, `catalog.policies[${index}]`),
      relevantRoles: roles,
      definition: JSON.stringify(sortCanonical(state)),
      state,
    })
  }

  for (const [index, row] of requireCatalogArray(
    catalog.tablePrivileges,
    'catalog.tablePrivileges',
  ).entries()) {
    const tableName = requireNonemptyString(
      catalogField(row, 'table_name'),
      `catalog.tablePrivileges[${index}].table_name`,
    )
    const roleName = requireNonemptyString(
      catalogField(row, 'role_name'),
      `catalog.tablePrivileges[${index}].role_name`,
    )
    const privilegeName = requireNonemptyString(
      catalogField(row, 'privilege_name'),
      `catalog.tablePrivileges[${index}].privilege_name`,
    )
    const granted = requireCatalogBoolean(row.granted, `catalog.tablePrivileges[${index}].granted`)
    add({
      objectType: 'effective_table_privilege',
      objectName: `${roleName}:${privilegeName}`,
      objectIdentity: `public.table.${tableName}.effective_privilege.${roleName}.${privilegeName}`,
      parentObjectName: tableName,
      owner: inheritedTableOwner(tableName, `catalog.tablePrivileges[${index}]`),
      relevantRoles: [roleName],
      definition: `role=${roleName};privilege=${privilegeName};granted=${String(granted)}`,
      state: { granted, privilegeName, roleName },
    })
  }

  for (const [index, row] of requireCatalogArray(
    catalog.schemaCreatePrivileges,
    'catalog.schemaCreatePrivileges',
  ).entries()) {
    const schemaName = requireNonemptyString(
      catalogField(row, 'schema_name'),
      `catalog.schemaCreatePrivileges[${index}].schema_name`,
    )
    const roleName = requireNonemptyString(
      catalogField(row, 'role_name'),
      `catalog.schemaCreatePrivileges[${index}].role_name`,
    )
    const owner = requireNonemptyString(row.owner, `catalog.schemaCreatePrivileges[${index}].owner`)
    const granted = requireCatalogBoolean(
      row.granted,
      `catalog.schemaCreatePrivileges[${index}].granted`,
    )
    schemaOwners.set(schemaName, owner)
    add({
      schemaName,
      objectType: 'effective_schema_create_privilege',
      objectName: roleName,
      objectIdentity: `${schemaName}.effective_create_privilege.${roleName}`,
      owner,
      relevantRoles: [roleName],
      definition: `owner=${owner};role=${roleName};create=${String(granted)}`,
      state: { granted, owner, roleName },
    })
  }

  for (const [catalogKey, objectType] of [
    ['tableAclEntries', 'table_acl'],
    ['functionAclEntries', 'function_acl'],
    ['schemaAclEntries', 'schema_acl'],
  ] as const) {
    for (const [index, row] of requireCatalogArray(
      catalog[catalogKey],
      `catalog.${catalogKey}`,
    ).entries()) {
      const schemaName = requireNonemptyString(
        catalogField(row, 'schema_name'),
        `catalog.${catalogKey}[${index}].schema_name`,
      )
      const objectName = requireNonemptyString(
        catalogField(row, 'object_name'),
        `catalog.${catalogKey}[${index}].object_name`,
      )
      const objectArguments = optionalCatalogText(
        catalogField(row, 'identity_arguments'),
        `catalog.${catalogKey}[${index}].identity_arguments`,
      )
      const grantee = requireNonemptyString(row.grantee, `catalog.${catalogKey}[${index}].grantee`)
      const grantor = requireNonemptyString(row.grantor, `catalog.${catalogKey}[${index}].grantor`)
      const privilegeType = requireNonemptyString(
        catalogField(row, 'privilege_type'),
        `catalog.${catalogKey}[${index}].privilege_type`,
      )
      const isGrantable = requireCatalogBoolean(
        catalogField(row, 'is_grantable'),
        `catalog.${catalogKey}[${index}].is_grantable`,
      )
      const qualifiedObject =
        objectArguments === null ? objectName : `${objectName}(${objectArguments})`
      const identity = `${schemaName}.${objectType}.${qualifiedObject}.${grantee}.${privilegeType}.${grantor}`
      const owner =
        objectType === 'table_acl'
          ? inheritedTableOwner(objectName, `catalog.${catalogKey}[${index}]`)
          : objectType === 'function_acl'
            ? functionOwners.get(`${objectName}(${objectArguments ?? ''})`)
            : schemaOwners.get(schemaName)
      if (!owner) throw new Error(`catalog.${catalogKey}[${index}] has no bound object owner.`)
      add({
        schemaName,
        objectType,
        objectName,
        objectIdentity: identity,
        owner,
        relevantRoles: [grantee, grantor],
        definition: `object=${qualifiedObject};grantee=${grantee};grantor=${grantor};privilege=${privilegeType};grantable=${String(isGrantable)}`,
        state: { grantee, grantor, identityArguments: objectArguments, isGrantable, privilegeType },
      })
    }
  }

  for (const [index, row] of columnAclEntries.entries()) {
    const schemaName = requireNonemptyString(
      catalogField(row, 'schema_name'),
      `catalog.columnAclEntries[${index}].schema_name`,
    )
    const tableName = requireNonemptyString(
      catalogField(row, 'table_name'),
      `catalog.columnAclEntries[${index}].table_name`,
    )
    const columnName = requireNonemptyString(
      catalogField(row, 'column_name'),
      `catalog.columnAclEntries[${index}].column_name`,
    )
    if (schemaName !== 'public' || !knownColumns.has(`${tableName}\0${columnName}`)) {
      throw new Error(
        `catalog.columnAclEntries[${index}] references unknown protected column ${schemaName}.${tableName}.${columnName}.`,
      )
    }
    const grantee = requireNonemptyString(row.grantee, `catalog.columnAclEntries[${index}].grantee`)
    const grantor = requireNonemptyString(row.grantor, `catalog.columnAclEntries[${index}].grantor`)
    const privilegeType = requireNonemptyString(
      catalogField(row, 'privilege_type'),
      `catalog.columnAclEntries[${index}].privilege_type`,
    )
    if (
      !SCHEMA_SECURITY_COLUMN_PRIVILEGES.includes(
        privilegeType as (typeof SCHEMA_SECURITY_COLUMN_PRIVILEGES)[number],
      )
    ) {
      throw new Error(
        `catalog.columnAclEntries[${index}] has unsupported privilege ${privilegeType}.`,
      )
    }
    const isGrantable = requireCatalogBoolean(
      catalogField(row, 'is_grantable'),
      `catalog.columnAclEntries[${index}].is_grantable`,
    )
    add({
      schemaName,
      objectType: 'column_acl',
      objectName: columnName,
      objectIdentity: `${schemaName}.table.${tableName}.column.${columnName}.acl.${grantee}.${privilegeType}.${grantor}`,
      owner: inheritedTableOwner(tableName, `catalog.columnAclEntries[${index}]`),
      parentObjectName: tableName,
      relevantRoles: [grantee, grantor],
      definition: `table=${tableName};column=${columnName};grantee=${grantee};grantor=${grantor};privilege=${privilegeType};grantable=${String(isGrantable)}`,
      state: { grantee, grantor, isGrantable, privilegeType, tableName },
    })
  }

  const eventTypes = sortedCatalogStrings(
    catalog.supportedEventTypes,
    'catalog.supportedEventTypes',
  )
  add({
    objectType: 'event_vocabulary',
    objectName: 'literature_gold_set_events.event_type',
    objectIdentity: 'public.table.literature_gold_set_events.event_vocabulary',
    parentObjectName: 'literature_gold_set_events',
    owner: inheritedTableOwner('literature_gold_set_events', 'catalog.supportedEventTypes'),
    definition: JSON.stringify(eventTypes),
    state: { eventTypes },
  })

  records.sort(compareSchemaSecurityDefinitionRecords)
  const seenObjectIdentities = new Set<string>()
  const duplicate = records.find((record) => {
    if (seenObjectIdentities.has(record.objectIdentity)) return true
    seenObjectIdentities.add(record.objectIdentity)
    return false
  })
  if (duplicate)
    throw new Error(`Duplicate schema/security object identity: ${duplicate.objectIdentity}.`)
  return { schemaVersion: SCHEMA_SECURITY_DEFINITION_IDENTITY_SCHEMA_VERSION, records }
}

/** Validate and canonically sort a persisted schema/security-definition identity artifact. */
export function validateSchemaSecurityDefinitionIdentity(
  value: unknown,
  options: { expectedSchemaSecurityIdentitySha256?: string } = {},
): SchemaSecurityDefinitionIdentity {
  const identity = requireRecord(value, 'schema/security definition identity')
  requireExactObjectKeys(
    identity,
    ['schemaVersion', 'records'],
    'schema/security definition identity',
  )
  if (identity.schemaVersion !== SCHEMA_SECURITY_DEFINITION_IDENTITY_SCHEMA_VERSION) {
    throw new Error(
      `Unexpected schema/security definition identity schemaVersion: ${String(identity.schemaVersion)}.`,
    )
  }
  if (!Array.isArray(identity.records) || identity.records.length === 0) {
    throw new Error('schema/security definition identity.records must be a nonempty array.')
  }
  const records = identity.records.map((value_, index): SchemaSecurityDefinitionRecord => {
    const label = `schema/security definition identity.records[${index}]`
    const record = requireRecord(value_, label)
    requireExactObjectKeys(
      record,
      [
        'schemaName',
        'objectType',
        'objectName',
        'objectIdentity',
        'owner',
        'parentObjectName',
        'relevantRoles',
        'normalizedDefinition',
        'definitionSha256',
        'state',
      ],
      label,
    )
    const normalizedDefinition = requireNonemptyString(
      record.normalizedDefinition,
      `${label}.normalizedDefinition`,
    )
    if (normalizePostgresDefinition(normalizedDefinition) !== normalizedDefinition) {
      throw new Error(`${label}.normalizedDefinition is not canonical.`)
    }
    const definitionSha256 = requireSha256(record.definitionSha256, `${label}.definitionSha256`)
    if (definitionSha256 !== sha256(normalizedDefinition)) {
      throw new Error(`${label}.definitionSha256 does not match normalizedDefinition.`)
    }
    const parentObjectName =
      record.parentObjectName === null
        ? null
        : requireNonemptyString(record.parentObjectName, `${label}.parentObjectName`)
    const owner =
      record.owner === null ? null : requireNonemptyString(record.owner, `${label}.owner`)
    const relevantRoles = sortedCatalogStrings(record.relevantRoles, `${label}.relevantRoles`)
    const state = sortCanonical(requireRecord(record.state, `${label}.state`))
    return {
      schemaName: requireNonemptyString(record.schemaName, `${label}.schemaName`),
      objectType: requireNonemptyString(record.objectType, `${label}.objectType`),
      objectName: requireNonemptyString(record.objectName, `${label}.objectName`),
      objectIdentity: requireNonemptyString(record.objectIdentity, `${label}.objectIdentity`),
      owner,
      parentObjectName,
      relevantRoles,
      normalizedDefinition,
      definitionSha256,
      state: state as Record<string, unknown>,
    }
  })
  records.sort(compareSchemaSecurityDefinitionRecords)
  const seenObjectIdentities = new Set<string>()
  const duplicate = records.find((record) => {
    if (seenObjectIdentities.has(record.objectIdentity)) return true
    seenObjectIdentities.add(record.objectIdentity)
    return false
  })
  if (duplicate) {
    throw new Error(`Duplicate schema/security object identity: ${duplicate.objectIdentity}.`)
  }
  const validated: SchemaSecurityDefinitionIdentity = {
    schemaVersion: SCHEMA_SECURITY_DEFINITION_IDENTITY_SCHEMA_VERSION,
    records,
  }
  if (options.expectedSchemaSecurityIdentitySha256 !== undefined) {
    const expected = requireSha256(
      options.expectedSchemaSecurityIdentitySha256,
      'expected schema/security identity',
    )
    const actual = sha256(JSON.stringify(sortCanonical(validated)))
    if (actual !== expected) {
      throw new Error(
        `Schema/security definition identity mismatch: expected ${expected}, received ${actual}.`,
      )
    }
  }
  return validated
}

/** SHA-256 of minified recursively sorted-key JSON with record order normalized semantically. */
export function schemaSecurityDefinitionIdentitySha256(value: unknown): string {
  const identity =
    isRecord(value) && value.schemaVersion === SCHEMA_SECURITY_DEFINITION_IDENTITY_SCHEMA_VERSION
      ? validateSchemaSecurityDefinitionIdentity(value)
      : buildSchemaSecurityDefinitionIdentity(value)
  return sha256(JSON.stringify(sortCanonical(identity)))
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

export function validateSecurityIntrospection(
  value: unknown,
  options: { expectedSchemaSecurityIdentitySha256?: string } = {},
) {
  const report = requireRecord(value, 'security introspection')
  if (!Array.isArray(report.rls)) throw new Error('security introspection.rls must be an array.')
  const rls = report.rls.map((rowValue, index) => {
    const row = requireRecord(rowValue, `rls[${index}]`)
    const tableName = requireNonemptyString(row.tableName, `rls[${index}].tableName`)
    if (row.rlsEnabled !== true) throw new Error(`RLS is not enabled on public.${tableName}.`)
    const rlsForced = requireCatalogBoolean(row.rlsForced, `rls[${index}].rlsForced`)
    return { tableName, rlsEnabled: true, rlsForced }
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
    const resultType = requireNonemptyString(row.resultType, `functions[${index}].resultType`)
    const volatility = requireNonemptyString(row.volatility, `functions[${index}].volatility`)
    const definition = requireNonemptyString(row.definition, `functions[${index}].definition`)
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
      resultType,
      volatility,
      definition,
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
    for (const privilege of [
      'select',
      'insert',
      'update',
      'delete',
      'truncate',
      'references',
      'trigger',
    ] as const) {
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
      references: false,
      trigger: false,
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
  requireExactNames(constraints, REQUIRED_CONSTRAINTS, 'protected constraint set')
  if (!Array.isArray(report.constraintDefinitions)) {
    throw new Error('security introspection.constraintDefinitions must be an array.')
  }
  const constraintDefinitions = report.constraintDefinitions.map((rowValue, index) => {
    const row = requireRecord(rowValue, `constraintDefinitions[${index}]`)
    if (row.validated !== true) {
      throw new Error(`Constraint ${String(row.name)} is not validated.`)
    }
    return {
      name: requireNonemptyString(row.name, `constraintDefinitions[${index}].name`),
      tableName: requireNonemptyString(row.tableName, `constraintDefinitions[${index}].tableName`),
      definition: requireNonemptyString(
        row.definition,
        `constraintDefinitions[${index}].definition`,
      ),
      validated: true,
    }
  })
  requireExactNames(
    constraintDefinitions.map(({ name }) => name),
    REQUIRED_CONSTRAINTS,
    'protected constraint definition set',
  )
  for (const constraint of REQUIRED_CONSTRAINTS) {
    const catalogEntry = constraintDefinitions.find(({ name }) => name === constraint)
    if (!catalogEntry) {
      throw new Error(`Required constraint definition is missing: ${constraint}.`)
    }
    for (const fragment of REQUIRED_CONSTRAINT_DEFINITION_FRAGMENTS[constraint] ?? []) {
      if (!catalogEntry.definition.includes(fragment)) {
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
      constraintBacked: row.constraintBacked === true,
    }
  })
  requireExactNames(
    uniqueIndexes.map(({ name }) => name),
    REQUIRED_UNIQUE_INDEXES,
    'required unique index set',
  )
  for (const indexName of REQUIRED_UNIQUE_INDEXES) {
    const catalogEntry = uniqueIndexes.find(({ name }) => name === indexName)
    if (catalogEntry?.tableName !== REQUIRED_UNIQUE_INDEX_TABLES[indexName]) {
      throw new Error(
        `Unique index ${indexName} is bound to ${catalogEntry?.tableName ?? 'no table'}; expected ${REQUIRED_UNIQUE_INDEX_TABLES[indexName]}.`,
      )
    }
  }

  if (!Array.isArray(report.journalPolicies)) {
    throw new Error('security introspection.journalPolicies must be an array.')
  }
  const journalPolicies = report.journalPolicies.map((rowValue, index) => {
    const row = requireRecord(rowValue, `journalPolicies[${index}]`)
    const name = requireNonemptyString(row.name, `journalPolicies[${index}].name`)
    const tableName = requireNonemptyString(row.tableName, `journalPolicies[${index}].tableName`)
    const command = requireNonemptyString(row.command, `journalPolicies[${index}].command`)
    const permissive = requireNonemptyString(row.permissive, `journalPolicies[${index}].permissive`)
    const using = requireNonemptyString(row.using, `journalPolicies[${index}].using`)
    const withCheck = requireNonemptyString(row.withCheck, `journalPolicies[${index}].withCheck`)
    if (command !== 'ALL') throw new Error(`Journal RLS policy ${name} is not FOR ALL.`)
    if (permissive !== 'PERMISSIVE') {
      throw new Error(`Journal RLS policy ${name} is not PERMISSIVE.`)
    }
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
    return { name, tableName, command, permissive, roles: ['service_role'], using, withCheck }
  })
  requireExactNames(
    journalPolicies.map(({ name }) => name),
    REQUIRED_JOURNAL_POLICIES,
    'journal RLS policy set',
  )
  for (const policyName of REQUIRED_JOURNAL_POLICIES) {
    const catalogEntry = journalPolicies.find(({ name }) => name === policyName)
    if (catalogEntry?.tableName !== REQUIRED_JOURNAL_POLICY_TABLES[policyName]) {
      throw new Error(
        `Journal RLS policy ${policyName} is bound to ${catalogEntry?.tableName ?? 'no table'}; expected ${REQUIRED_JOURNAL_POLICY_TABLES[policyName]}.`,
      )
    }
  }
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
          definition: requireNonemptyString(row.definition, `triggers[${index}].definition`),
        }
      })
    : []
  requireExactNames(
    triggers.map(({ name }) => name),
    REQUIRED_TRIGGERS,
    'protected trigger set',
  )
  const eventTypes = Array.isArray(report.supportedEventTypes)
    ? report.supportedEventTypes.map((entry, index) =>
        requireNonemptyString(entry, `supportedEventTypes[${index}]`),
      )
    : []
  requireExactNames(eventTypes, REQUIRED_EVENT_TYPES, 'supported event type set')

  const schemaSecurityDefinitionIdentity = buildSchemaSecurityDefinitionIdentity(report)
  const schemaSecurityIdentitySha256 = schemaSecurityDefinitionIdentitySha256(
    schemaSecurityDefinitionIdentity,
  )
  if (options.expectedSchemaSecurityIdentitySha256 !== undefined) {
    const expected = requireSha256(
      options.expectedSchemaSecurityIdentitySha256,
      'expected schema/security identity',
    )
    if (schemaSecurityIdentitySha256 !== expected) {
      throw new Error(
        `Schema/security definition identity mismatch: expected ${expected}, received ${schemaSecurityIdentitySha256}.`,
      )
    }
  }

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
    schemaSecurityDefinitionIdentity,
    schemaSecurityIdentitySha256,
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
