import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'

import {
  POST_MIGRATION_SCHEMA_SECURITY_IDENTITY_SHA256,
  REQUIRED_UNIQUE_INDEXES,
  SCHEMA_SECURITY_COLUMN_PRIVILEGES,
  SCHEMA_SECURITY_COLUMN_ROLES,
  SCHEMA_SECURITY_FUNCTION_NAMES,
  buildSchemaSecurityDefinitionIdentity,
  schemaSecurityDefinitionIdentitySha256,
  validateSecurityIntrospection,
  validateSupabaseLint,
  type SchemaSecurityDefinitionIdentity,
} from './gold-import-compensation-rehearsal-evidence'
import {
  assertExclusiveOutputDirectoryIdentity,
  createExclusiveOutputDirectory,
  writeExclusiveOutputFiles,
} from './lib/exclusive-output'

export const IMPORT_COMPENSATION_MIGRATION_ID =
  '20260808035633_add_literature_gold_import_compensation_contract'
export const IMPORT_COMPENSATION_MIGRATION_FILE = `${IMPORT_COMPENSATION_MIGRATION_ID}.sql`
export const IMPORT_COMPENSATION_MIGRATION_SHA256 =
  'e846ef70a7b484460682a7ff61d579d3d6fdae3400805fa5395adc0464244528'
export const DEFAULT_LOCAL_DATABASE_CONTAINER = 'supabase_db_ip-literature-local'
export const LOCAL_SUPABASE_PROJECT_ID = 'ip-literature-local'
export const LOCAL_DATABASE_PORT = '55322'
export const DEFAULT_BATCH_NAME = 'gold-set-v1'
export const BACKUP_SCHEMA_VERSION = 'gold-import-compensation-pre-migration-backup/1.0.0'
export const AUDIT_SCHEMA_VERSION = 'gold-import-compensation-migration-audit/1.0.0'
export const PRE_MIGRATION_SCHEMA_INVENTORY_SHA256 =
  'd75d9b579d0e0e1ce338e6972ec2c74d97da157c122174693705a0ef2c34d857'
export const PRE_MIGRATION_LEDGER_ARTIFACT_SHA256 =
  'e7a6ef124bb6804bcfa8eb95f409ce56deb4763f1893395cf99a2924d2774180'

const SCHEMA_SECURITY_FUNCTION_VALUES_SQL = SCHEMA_SECURITY_FUNCTION_NAMES.map(
  (name) => `(${sqlLiteral(name)})`,
).join(',\n      ')
const SCHEMA_SECURITY_COLUMN_ROLE_VALUES_SQL = SCHEMA_SECURITY_COLUMN_ROLES.map(
  (role) => `(${sqlLiteral(role)})`,
).join(', ')
const SCHEMA_SECURITY_COLUMN_PRIVILEGE_VALUES_SQL = SCHEMA_SECURITY_COLUMN_PRIVILEGES.map(
  (privilege) => `(${sqlLiteral(privilege)})`,
).join(', ')

/**
 * Canonical serialized-array ordering contracts. Every matching SQL aggregate is also enforced by
 * assertSerializedAggregateOrdering; these names document the semantic keys used by consumers.
 */
export const SERIALIZED_AGGREGATE_ORDERING_CONTRACTS = {
  batchRows: ['batch_id ASC'],
  developmentArticles: ['display_order ASC NULLS LAST', 'item_id ASC', 'pmid ASC'],
  developmentDrafts: ['display_order ASC NULLS LAST', 'item_id ASC'],
  developmentEvents: ['created_at ASC NULLS LAST', 'event_id ASC'],
  developmentItems: ['display_order ASC NULLS LAST', 'item_id ASC'],
  developmentReviews: [
    'display_order ASC NULLS LAST',
    'item_id ASC',
    'revision ASC NULLS LAST',
    'review_id ASC',
  ],
  itemEvents: ['created_at ASC NULLS LAST', 'event_id ASC'],
  itemReviews: ['revision ASC NULLS LAST', 'review_id ASC'],
  migrationLedger: ['version ASC', 'name ASC'],
  schemaAclEntries: [
    'schema_name ASC',
    'object_name ASC',
    'grantee ASC',
    'privilege_type ASC',
    'grantor ASC',
  ],
  schemaColumns: ['table_name ASC', 'ordinal_position ASC', 'column_name ASC'],
  schemaColumnAclEntries: [
    'schema_name ASC',
    'table_name ASC',
    'column_name ASC',
    'grantee ASC',
    'privilege_type ASC',
    'grantor ASC',
  ],
  schemaColumnPrivileges: [
    'table_name ASC',
    'column_name ASC',
    'role_name ASC',
    'privilege_name ASC',
  ],
  schemaConstraints: ['table_name ASC', 'name ASC'],
  schemaCreatePrivileges: ['schema_name ASC', 'role_name ASC'],
  schemaEventVocabulary: ['event_type ASC'],
  schemaFunctionAclEntries: [
    'schema_name ASC',
    'object_name ASC',
    'identity_arguments ASC',
    'grantee ASC',
    'privilege_type ASC',
    'grantor ASC',
  ],
  schemaFunctions: ['name ASC', 'identity_arguments ASC'],
  schemaIndexes: ['table_name ASC', 'name ASC'],
  schemaPolicies: ['table_name ASC', 'name ASC'],
  schemaPrivileges: ['table_name ASC', 'role_name ASC', 'privilege_name ASC'],
  schemaTableAclEntries: [
    'schema_name ASC',
    'object_name ASC',
    'grantee ASC',
    'privilege_type ASC',
    'grantor ASC',
  ],
  schemaTables: ['table_name ASC'],
  schemaTriggers: ['table_name ASC', 'name ASC'],
} as const

export const AUTHORITATIVE_SOURCE_IDENTITIES = {
  finalV3DevelopmentArtifactSha256:
    '961c19f4ea1c6a82e061369fd33d927e804360f10781729f8049073a4b6d0f59',
  signedProtocolAuthorizationSha256:
    '784d13736ff0fbf69bd8ad55c8bf55b293c4cc2051b980a3488a980f120c5dd3',
  amendedTwoRowAuthorizationSha256:
    'b95fc9785ee355b810981c051db62307e868110e06ffb1a83c09c8eff52bf89a',
  supersededV2ImportPlanSha256: '8a9833b77f00fd50e33c3c08d6db3f8196a06770a4bbd9b1986869bb04d6ad00',
  supersededV2PackageManifestSha256:
    '3339b8dab99d088e399d46fba0037b9b98e2097b69ae532dfb7842f401dcf3eb',
  supersededV2RowPlanSha256: '52f2797168e7a665b6e8bf24363fbba9c4449126aa83f0e95c1fc650c19a19f3',
  supersededV2ExecutorSha256: '14c38c93447bcc5795945ad846af3b8456a13bec147bc1b7d530ff41ad16314a',
  supersededPointerRewindPlanSha256:
    '516c40d84354072a79c1aebcc02ced8a287c79ce2dfb59dd93d046226ab2a647',
  readOnlyCompensationMappingSha256:
    '39b1fff91763d4f8cb7f494d24d5790ce3c5668c5104ef0ab263ea6c67e1eba1',
} as const

const SNAPSHOT_MARKER = 'IP_GOLD_MIGRATION_SNAPSHOT_JSON:'
const CONTRACT_HASH_MARKER = 'IP_GOLD_CONTRACT_HASH_JSON:'
const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const BATCH_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,79}$/u
const DOCKER_CONTEXT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u
const OPERATIONAL_ENVIRONMENT_PATTERN = /^(?:DOCKER|CONTAINER|SUPABASE|PG|POSTGRES|DATABASE_|DB_)/iu
const REMOTE_TARGET_ENVIRONMENT_KEYS = [
  'DATABASE_URL',
  'DB_URL',
  'PGDATABASE',
  'PGHOST',
  'PGPORT',
  'PGSERVICE',
  'PGSERVICEFILE',
  'POSTGRES_URL',
  'POSTGRES_URL_NON_POOLING',
  'SUPABASE_DB_URL',
  'SUPABASE_PROJECT_ID',
  'SUPABASE_PROJECT_REF',
] as const
const BACKUP_CANONICAL_FILES = [
  'backup-receipt.json',
  'batch-and-test-lock.json',
  'development-database-seed.json',
  'development-planning-state.json',
  'development-review-state.json',
  'migration-ledger.json',
  'repository-database-identities.json',
  'schema-inventory.json',
  'source-identities.json',
  'state-audits.json',
] as const
const BACKUP_DIRECTORY_FILES = [
  ...BACKUP_CANONICAL_FILES,
  'checksum-manifest.sha256',
  'execution-receipt.json',
] as const
const CONTRACT_TABLES = [
  'literature_gold_review_operation_actions',
  'literature_gold_review_operations',
  'literature_gold_set_batches',
  'literature_gold_set_events',
  'literature_gold_set_items',
  'literature_gold_set_review_drafts',
  'literature_gold_set_reviews',
] as const
export const EXPECTED_PROTECTED_NON_CONSTRAINT_INDEXES = [
  {
    name: 'literature_gold_review_operation_actions_item_idx',
    tableName: 'literature_gold_review_operation_actions',
    unique: false,
  },
  {
    name: 'literature_gold_review_operation_actions_source_idx',
    tableName: 'literature_gold_review_operation_actions',
    unique: false,
  },
  {
    name: 'literature_gold_review_operations_batch_started_idx',
    tableName: 'literature_gold_review_operations',
    unique: false,
  },
  {
    name: 'literature_gold_review_operations_one_live_compensation_idx',
    tableName: 'literature_gold_review_operations',
    unique: true,
  },
  {
    name: 'literature_gold_set_events_batch_created_idx',
    tableName: 'literature_gold_set_events',
    unique: false,
  },
  {
    name: 'literature_gold_set_events_item_created_idx',
    tableName: 'literature_gold_set_events',
    unique: false,
  },
  {
    name: 'literature_gold_set_events_one_test_unlock_idx',
    tableName: 'literature_gold_set_events',
    unique: true,
  },
  {
    name: 'literature_gold_set_events_operation_action_idx',
    tableName: 'literature_gold_set_events',
    unique: false,
  },
  {
    name: 'literature_gold_set_events_operation_sequence_idx',
    tableName: 'literature_gold_set_events',
    unique: true,
  },
  {
    name: 'literature_gold_set_items_batch_status_order_idx',
    tableName: 'literature_gold_set_items',
    unique: false,
  },
  {
    name: 'literature_gold_set_items_pmid_idx',
    tableName: 'literature_gold_set_items',
    unique: false,
  },
  {
    name: 'literature_gold_set_items_split_idx',
    tableName: 'literature_gold_set_items',
    unique: false,
  },
  {
    name: 'literature_gold_set_items_unresolved_idx',
    tableName: 'literature_gold_set_items',
    unique: false,
  },
  {
    name: 'literature_gold_set_reviews_item_completed_idx',
    tableName: 'literature_gold_set_reviews',
    unique: false,
  },
  {
    name: 'literature_gold_set_reviews_one_child_idx',
    tableName: 'literature_gold_set_reviews',
    unique: true,
  },
  {
    name: 'literature_gold_set_reviews_one_operation_action_idx',
    tableName: 'literature_gold_set_reviews',
    unique: true,
  },
] as const
const REQUIRED_TRANSITION_SIGNATURES = {
  apply_literature_gold_import_v1:
    'p_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
  compensate_literature_gold_import_v1:
    'p_operation_id uuid, p_target_import_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
  reconcile_literature_gold_review_operation_v1:
    'p_operation_id uuid, p_recovery_authorization_sha256 text, p_recovery_authorization jsonb',
} as const

export interface CommandResult {
  stdout: string
  stderr: string
}

export type OperationalEnvironment = Readonly<Record<string, string | undefined>>

export type CommandRunner = (
  command: string,
  arguments_: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv; stdin?: string },
) => Promise<CommandResult>

export interface LocalDockerTarget {
  context: string | null
  dockerArguments: string[]
  endpoint: string
  environment: NodeJS.ProcessEnv
}

export interface PreMigrationBaselineIdentity {
  migrationLedgerArtifactSha256: string
  schemaInventorySha256: string
}

export interface RepositoryGuardState {
  branch: string
  commonDir: string
  gitDir: string
  head: string
  originMain: string
  trackedStatus: string
}

export interface RawDatabaseSnapshot extends Record<string, unknown> {
  database: Record<string, unknown>
  migrationLedger: unknown[]
  schema: Record<string, unknown>
  scope: Record<string, unknown>
  developmentItems: unknown[]
  developmentSeed: Record<string, unknown>
  testAggregate: Record<string, unknown>
}

export interface CanonicalArtifacts {
  files: ReadonlyMap<string, string>
  manifest: string
  manifestSha256: string
}

export interface ContractStateHashes {
  developmentMembershipSha256: string
  effectiveStateSha256: string
  physicalStateSha256: string
  readOnlyTransaction: true
}

export interface PreMigrationBackupResult {
  artifacts: CanonicalArtifacts
  canonicalReceipt: Record<string, unknown>
  effectiveStateSha256: string
  physicalStateSha256: string
  reviewRowsSha256: string
}

export interface AuditResult {
  report: Record<string, unknown>
  markdown: string
  schemaSecurityDefinitionIdentity: SchemaSecurityDefinitionIdentity | null
  schemaSecurityIdentitySha256: string
}

export interface LoadedPreMigrationBackup {
  batchAndTestLock: Record<string, unknown>
  developmentSeed: Record<string, unknown>
  developmentState: Record<string, unknown>
  manifestSha256: string
  migrationLedger: Record<string, unknown>
  planningState: Record<string, unknown>
  receipt: Record<string, unknown>
  schemaInventory: Record<string, unknown>
  stateAudits: Record<string, unknown>
}

function compareCodeUnits(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be a JSON object.`)
  return value
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a nonempty string.`)
  }
  return value
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean.`)
  return value
}

function requireInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be an integer.`)
  return value as number
}

function sortedCanonicalValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical JSON rejects non-finite numbers.')
    return value
  }
  if (Array.isArray(value)) return value.map(sortedCanonicalValue)
  if (!isRecord(value)) throw new Error(`Canonical JSON rejects ${typeof value}.`)
  return Object.fromEntries(
    Object.keys(value)
      .sort(compareCodeUnits)
      .map((key) => {
        if (value[key] === undefined) throw new Error(`Canonical JSON rejects undefined at ${key}.`)
        return [key, sortedCanonicalValue(value[key])]
      }),
  )
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(sortedCanonicalValue(value), null, 2)}\n`
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function sha256Canonical(value: unknown) {
  return sha256(canonicalJson(value))
}

/** SHA-256 of recursively sorted-key, minified JSON; arrays retain their supplied order. */
export function sha256ContractCanonical(value: unknown) {
  return sha256(JSON.stringify(sortedCanonicalValue(value)))
}

export const defaultCommandRunner: CommandRunner = (command, arguments_, options = {}) =>
  new Promise<CommandResult>((resolvePromise, rejectPromise) => {
    const child = spawn(command, arguments_, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr })
        return
      }
      rejectPromise(
        new Error(
          `${command} ${arguments_.join(' ')} failed with exit code ${code ?? 'unknown'}: ${stderr.trim() || '(no diagnostic)'}`,
        ),
      )
    })
    child.stdin.end(options.stdin)
  })

async function runGit(
  cwd: string,
  arguments_: string[],
  runCommand: CommandRunner,
): Promise<string> {
  const result = await runCommand('git', arguments_, { cwd })
  return result.stdout.trim()
}

export async function inspectRepositoryGuardState(
  cwd: string,
  runCommand: CommandRunner = defaultCommandRunner,
): Promise<RepositoryGuardState> {
  const [gitDir, commonDir, branch, trackedStatus, head, originMain] = await Promise.all([
    runGit(cwd, ['rev-parse', '--absolute-git-dir'], runCommand),
    runGit(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir'], runCommand),
    runGit(cwd, ['branch', '--show-current'], runCommand),
    runGit(cwd, ['status', '--porcelain=v1', '--untracked-files=no'], runCommand),
    runGit(cwd, ['rev-parse', 'HEAD'], runCommand),
    runGit(cwd, ['rev-parse', 'origin/main'], runCommand),
  ])
  return { branch, commonDir, gitDir, head, originMain, trackedStatus }
}

export function assertRepositoryGuard(state: RepositoryGuardState): void {
  if (resolve(state.gitDir) !== resolve(state.commonDir)) {
    throw new Error('Primary-checkout guard failed: agent worktrees are not operational targets.')
  }
  if (state.branch !== 'main')
    throw new Error('Branch guard failed: operational tooling requires main.')
  if (state.trackedStatus !== '') {
    throw new Error('Tracked-worktree guard failed: the primary checkout must be clean.')
  }
  if (!/^[a-f0-9]{40}$/u.test(state.head) || state.head !== state.originMain) {
    throw new Error('origin/main guard failed: HEAD must exactly equal origin/main.')
  }
}

export function assertLocalDatabaseContainer(container: string): void {
  if (container !== DEFAULT_LOCAL_DATABASE_CONTAINER) {
    throw new Error('Local-only target guard rejected the database container argument.')
  }
}

export function sanitizeOperationalEnvironment(
  environment: OperationalEnvironment = process.env,
): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(environment).filter(([name]) => !OPERATIONAL_ENVIRONMENT_PATTERN.test(name)),
  ) as NodeJS.ProcessEnv
}

function assertNoRemoteTargetEnvironment(environment: OperationalEnvironment) {
  const forbidden = Object.entries(environment).find(
    ([name, value]) =>
      REMOTE_TARGET_ENVIRONMENT_KEYS.includes(
        name.toUpperCase() as (typeof REMOTE_TARGET_ENVIRONMENT_KEYS)[number],
      ) &&
      typeof value === 'string' &&
      value !== '',
  )
  if (forbidden) {
    throw new Error(`Database target environment override is forbidden: ${forbidden[0]}.`)
  }
  if (environment.DOCKER_TLS_VERIFY || environment.DOCKER_CERT_PATH) {
    throw new Error('Docker TLS endpoint overrides are forbidden for local operations.')
  }
  if (environment.DOCKER_HOST && environment.DOCKER_CONTEXT) {
    throw new Error('Ambiguous Docker host/context overrides are forbidden.')
  }
}

export function assertLocalDockerEndpoint(endpoint: string): void {
  if (
    !endpoint ||
    endpoint.includes('\n') ||
    endpoint.includes('\r') ||
    (!endpoint.startsWith('unix:///') && !endpoint.startsWith('npipe://'))
  ) {
    throw new Error('Docker endpoint guard rejected a non-local endpoint.')
  }
}

function operationalEnvironmentForDockerTarget(target: LocalDockerTarget) {
  const environment = { ...target.environment }
  if (target.context) environment.DOCKER_CONTEXT = target.context
  else environment.DOCKER_HOST = target.endpoint
  return environment
}

export async function resolveLocalDockerTarget(
  input: {
    environment?: OperationalEnvironment
    runCommand?: CommandRunner
  } = {},
): Promise<LocalDockerTarget> {
  const sourceEnvironment = input.environment ?? process.env
  const runCommand = input.runCommand ?? defaultCommandRunner
  assertNoRemoteTargetEnvironment(sourceEnvironment)
  const environment = sanitizeOperationalEnvironment(sourceEnvironment)
  const hostOverride = sourceEnvironment.DOCKER_HOST
  if (hostOverride) {
    assertLocalDockerEndpoint(hostOverride)
    return {
      context: null,
      dockerArguments: ['--host', hostOverride],
      endpoint: hostOverride,
      environment,
    }
  }

  const contextOverride = sourceEnvironment.DOCKER_CONTEXT
  const context =
    contextOverride ??
    (
      await runCommand('docker', ['context', 'show'], {
        env: environment,
      })
    ).stdout.trim()
  if (!DOCKER_CONTEXT_PATTERN.test(context)) {
    throw new Error('Docker context guard rejected an invalid context name.')
  }
  const inspected = await runCommand(
    'docker',
    ['context', 'inspect', context, '--format', '{{json .Endpoints.docker.Host}}'],
    { env: environment },
  )
  let endpoint: unknown
  try {
    endpoint = JSON.parse(inspected.stdout.trim()) as unknown
  } catch {
    throw new Error('Docker context endpoint could not be resolved safely.')
  }
  if (typeof endpoint !== 'string') {
    throw new Error('Docker context endpoint was not a string.')
  }
  assertLocalDockerEndpoint(endpoint)
  return {
    context,
    dockerArguments: ['--context', context],
    endpoint,
    environment,
  }
}

export async function assertLocalDatabaseHealthy(
  container: string,
  runCommand: CommandRunner = defaultCommandRunner,
  dockerTarget?: LocalDockerTarget,
): Promise<void> {
  assertLocalDatabaseContainer(container)
  const target = dockerTarget ?? (await resolveLocalDockerTarget({ runCommand }))
  const result = await runCommand(
    'docker',
    [
      ...target.dockerArguments,
      'inspect',
      '--format',
      '{{.Name}}|{{.State.Running}}|{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}|{{index .Config.Labels "com.supabase.cli.project"}}',
      container,
    ],
    { env: operationalEnvironmentForDockerTarget(target) },
  )
  if (
    result.stdout.trim() !==
    `/${container}|true|${LOCAL_DATABASE_PORT}|${LOCAL_SUPABASE_PROJECT_ID}`
  ) {
    throw new Error(
      'Local database health guard failed: expected the pinned Supabase project container and port.',
    )
  }
}

export async function assertMigrationFileIdentity(repositoryRoot: string): Promise<string> {
  const bytes = await readFile(
    resolve(repositoryRoot, 'supabase/migrations', IMPORT_COMPENSATION_MIGRATION_FILE),
  )
  const actual = sha256(bytes)
  if (actual !== IMPORT_COMPENSATION_MIGRATION_SHA256) {
    throw new Error(
      `Migration checksum mismatch: expected ${IMPORT_COMPENSATION_MIGRATION_SHA256}, received ${actual}.`,
    )
  }
  return actual
}

function isWithin(parent: string, child: string): boolean {
  const pathFromParent = relative(parent, child)
  return pathFromParent !== '' && pathFromParent !== '..' && !pathFromParent.startsWith(`..${sep}`)
}

async function pathExists(path: string) {
  return lstat(path)
    .then(() => true)
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return false
      throw error
    })
}

function containsParentTraversal(path: string): boolean {
  return path.split(/[\\/]+/u).includes('..')
}

export async function assertExclusiveOutputPath(input: {
  backupRoot: string
  cwd: string
  output: string
}): Promise<string> {
  if (containsParentTraversal(input.backupRoot) || containsParentTraversal(input.output)) {
    throw new Error('Output paths must not contain parent-directory traversal.')
  }
  const output = resolve(input.cwd, input.output)
  if (await pathExists(output)) throw new Error('Output collision: the output path already exists.')

  const approvedRoot = resolve(input.cwd, input.backupRoot)
  const rootStat = await lstat(approvedRoot)
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error('Explicit backup root must be an existing non-symlink directory.')
  }
  if (!isWithin(approvedRoot, output)) {
    throw new Error('Output path is outside the explicit backup root.')
  }
  const resolvedRoot = await realpath(approvedRoot)
  let current = approvedRoot
  for (const component of relative(approvedRoot, output).split(sep)) {
    current = resolve(current, component)
    if (!(await pathExists(current))) break
    const stat = await lstat(current)
    if (stat.isSymbolicLink()) {
      throw new Error('Symlink traversal is forbidden in output paths.')
    }
    const resolvedCurrent = await realpath(current)
    if (resolvedCurrent !== resolvedRoot && !isWithin(resolvedRoot, resolvedCurrent)) {
      throw new Error('Output path escapes its approved root.')
    }
  }
  return output
}

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

export function buildReadOnlySnapshotSql(batchName = DEFAULT_BATCH_NAME): string {
  if (!BATCH_NAME_PATTERN.test(batchName)) throw new Error('Invalid gold-set batch name.')
  const tableValues = CONTRACT_TABLES.map((table) => `(${sqlLiteral(table)})`).join(',\n      ')
  return String.raw`
begin transaction isolation level repeatable read read only;
set local statement_timeout = '120s';
with
selected_batch as (
  select batch.* from public.literature_gold_set_batches as batch
  where batch.name = ${sqlLiteral(batchName)}
),
contract_tables(table_name) as (
  values ${tableValues}
),
schema_security_functions(name) as (
  values ${SCHEMA_SECURITY_FUNCTION_VALUES_SQL}
),
schema_tables as (
  select requested.table_name,
    class.relkind as relation_kind,
    class.relrowsecurity as rls_enabled,
    class.relforcerowsecurity as force_rls,
    owner.rolname as owner,
    class.relacl::text as acl
  from contract_tables as requested
  left join pg_catalog.pg_namespace as namespace on namespace.nspname = 'public'
  left join pg_catalog.pg_class as class
    on class.relname = requested.table_name and class.relnamespace = namespace.oid
  left join pg_catalog.pg_roles as owner on owner.oid = class.relowner
),
schema_columns as (
  select columns.table_name, columns.ordinal_position, columns.column_name,
    columns.data_type, columns.udt_name, columns.is_nullable, columns.column_default
  from information_schema.columns as columns
  where columns.table_schema = 'public'
    and columns.table_name in (select table_name from contract_tables)
),
schema_functions as (
  select proc.proname as name,
    pg_catalog.pg_get_function_identity_arguments(proc.oid) as identity_arguments,
    pg_catalog.pg_get_function_result(proc.oid) as result_type,
    proc.provolatile as volatility,
    proc.prosecdef as security_definer,
    owner.rolname as owner,
    coalesce((
      select pg_catalog.regexp_replace(setting, '^search_path=', '')
      from unnest(coalesce(proc.proconfig, array[]::text[])) setting
      where setting like 'search_path=%' limit 1
    ), '') as search_path,
    pg_catalog.pg_get_functiondef(proc.oid) as definition,
    proc.proacl::text as acl,
    exists (select 1 from pg_catalog.aclexplode(coalesce(
      proc.proacl, pg_catalog.acldefault('f', proc.proowner)
    )) acl where acl.grantee = 0 and acl.privilege_type = 'EXECUTE') as public_execute,
    pg_catalog.has_function_privilege('anon', proc.oid, 'EXECUTE') as anon_execute,
    pg_catalog.has_function_privilege('authenticated', proc.oid, 'EXECUTE') as authenticated_execute,
    pg_catalog.has_function_privilege('service_role', proc.oid, 'EXECUTE') as service_role_execute
  from pg_catalog.pg_proc as proc
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = proc.pronamespace and namespace.nspname = 'public'
  join pg_catalog.pg_roles as owner on owner.oid = proc.proowner
  join schema_security_functions as requested on requested.name = proc.proname
),
table_acl_entries as (
  select 'public'::text as schema_name, class.relname as object_name,
    coalesce(grantee.rolname, 'PUBLIC') as grantee, grantor.rolname as grantor,
    acl.privilege_type, acl.is_grantable
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = class.relnamespace and namespace.nspname = 'public'
  cross join lateral pg_catalog.aclexplode(coalesce(
    class.relacl, pg_catalog.acldefault('r', class.relowner)
  )) as acl
  left join pg_catalog.pg_roles as grantee on grantee.oid = acl.grantee
  join pg_catalog.pg_roles as grantor on grantor.oid = acl.grantor
  where class.relname in (select table_name from contract_tables)
),
column_acl_entries as (
  select 'public'::text as schema_name, class.relname as table_name,
    attribute.attname as column_name,
    coalesce(grantee.rolname, 'PUBLIC') as grantee, grantor.rolname as grantor,
    acl.privilege_type, acl.is_grantable
  from pg_catalog.pg_attribute as attribute
  join pg_catalog.pg_class as class on class.oid = attribute.attrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = class.relnamespace and namespace.nspname = 'public'
  cross join lateral pg_catalog.aclexplode(
    case when cardinality(attribute.attacl) > 0 then attribute.attacl
      else null::pg_catalog.aclitem[] end
  ) as acl
  left join pg_catalog.pg_roles as grantee on grantee.oid = acl.grantee
  join pg_catalog.pg_roles as grantor on grantor.oid = acl.grantor
  where attribute.attnum > 0 and not attribute.attisdropped
    and class.relname in (select table_name from contract_tables)
),
function_acl_entries as (
  select 'public'::text as schema_name, proc.proname as object_name,
    pg_catalog.pg_get_function_identity_arguments(proc.oid) as identity_arguments,
    coalesce(grantee.rolname, 'PUBLIC') as grantee, grantor.rolname as grantor,
    acl.privilege_type, acl.is_grantable
  from pg_catalog.pg_proc as proc
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = proc.pronamespace and namespace.nspname = 'public'
  cross join lateral pg_catalog.aclexplode(coalesce(
    proc.proacl, pg_catalog.acldefault('f', proc.proowner)
  )) as acl
  left join pg_catalog.pg_roles as grantee on grantee.oid = acl.grantee
  join pg_catalog.pg_roles as grantor on grantor.oid = acl.grantor
  join schema_security_functions as requested on requested.name = proc.proname
),
schema_constraints as (
  select class.relname as table_name, constraint_record.conname as name,
    pg_catalog.pg_get_constraintdef(constraint_record.oid) as definition,
    constraint_record.convalidated as validated
  from pg_catalog.pg_constraint as constraint_record
  join pg_catalog.pg_class as class on class.oid = constraint_record.conrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = class.relnamespace and namespace.nspname = 'public'
  where constraint_record.contype <> 't'
    and class.relname in (select table_name from contract_tables)
),
schema_indexes as (
  select table_class.relname as table_name, index_class.relname as name,
    index_owner.rolname as owner,
    index_record.indisunique as is_unique, index_record.indisvalid as is_valid,
    exists (
      select 1 from pg_catalog.pg_constraint as constraint_index
      where constraint_index.conindid = index_record.indexrelid
    ) as constraint_backed,
    pg_catalog.pg_get_expr(index_record.indpred, index_record.indrelid) as predicate,
    pg_catalog.pg_get_indexdef(index_record.indexrelid) as definition
  from pg_catalog.pg_index as index_record
  join pg_catalog.pg_class as index_class on index_class.oid = index_record.indexrelid
  join pg_catalog.pg_roles as index_owner on index_owner.oid = index_class.relowner
  join pg_catalog.pg_class as table_class on table_class.oid = index_record.indrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = table_class.relnamespace and namespace.nspname = 'public'
  where table_class.relname in (select table_name from contract_tables)
),
schema_triggers as (
  select class.relname as table_name, trigger_record.tgname as name,
    trigger_record.tgenabled as enable_mode,
    trigger_record.tgenabled in ('O', 'A') as enabled,
    pg_catalog.pg_get_triggerdef(trigger_record.oid) as definition
  from pg_catalog.pg_trigger as trigger_record
  join pg_catalog.pg_class as class on class.oid = trigger_record.tgrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = class.relnamespace and namespace.nspname = 'public'
  where not trigger_record.tgisinternal
    and class.relname in (select table_name from contract_tables)
),
schema_policies as (
  select policy.tablename as table_name, policy.policyname as name,
    policy.cmd as command, policy.permissive,
    array(select role::text from unnest(policy.roles) role order by role::text) as roles,
    policy.qual as using_expression,
    policy.with_check as with_check_expression
  from pg_catalog.pg_policies as policy
  where policy.schemaname = 'public'
    and policy.tablename in (select table_name from contract_tables)
),
roles(role_name) as (values ('public'), ('anon'), ('authenticated'), ('service_role')),
privileges(privilege_name) as (
  values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
),
table_privileges as (
  select requested.table_name, roles.role_name, privileges.privilege_name,
    case
      when class.oid is null then false
      when roles.role_name = 'public' then exists (
        select 1 from pg_catalog.aclexplode(coalesce(
          class.relacl, pg_catalog.acldefault('r', class.relowner)
        )) acl where acl.grantee = 0 and acl.privilege_type = privileges.privilege_name
      )
      else coalesce(pg_catalog.has_table_privilege(
        roles.role_name, class.oid, privileges.privilege_name
      ), false)
    end as granted
  from contract_tables requested
  cross join roles cross join privileges
  left join pg_catalog.pg_namespace as namespace on namespace.nspname = 'public'
  left join pg_catalog.pg_class as class
    on class.relname = requested.table_name and class.relnamespace = namespace.oid
),
column_roles(role_name) as (values ${SCHEMA_SECURITY_COLUMN_ROLE_VALUES_SQL}),
column_privilege_names(privilege_name) as (
  values ${SCHEMA_SECURITY_COLUMN_PRIVILEGE_VALUES_SQL}
),
column_privileges as (
  select class.relname as table_name, attribute.attname as column_name,
    column_roles.role_name, column_privilege_names.privilege_name,
    case
      when column_roles.role_name = 'public' then
        exists (
          select 1 from pg_catalog.aclexplode(coalesce(
            class.relacl, pg_catalog.acldefault('r', class.relowner)
          )) as table_acl
          where table_acl.grantee = 0
            and table_acl.privilege_type = column_privilege_names.privilege_name
        ) or exists (
          select 1 from pg_catalog.aclexplode(
            case when cardinality(attribute.attacl) > 0 then attribute.attacl
              else null::pg_catalog.aclitem[] end
          ) as column_acl
          where column_acl.grantee = 0
            and column_acl.privilege_type = column_privilege_names.privilege_name
        )
      else coalesce(pg_catalog.has_column_privilege(
        column_roles.role_name, class.oid, attribute.attnum,
        column_privilege_names.privilege_name
      ), false)
    end as granted
  from pg_catalog.pg_attribute as attribute
  join pg_catalog.pg_class as class on class.oid = attribute.attrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = class.relnamespace and namespace.nspname = 'public'
  cross join column_roles
  cross join column_privilege_names
  where attribute.attnum > 0 and not attribute.attisdropped
    and class.relname in (select table_name from contract_tables)
),
required_schemas(schema_name) as (values ('public'), ('extensions')),
schema_roles(role_name) as (values ('public'), ('anon'), ('authenticated')),
schema_create_privileges as (
  select required.schema_name, owner.rolname as owner, roles.role_name,
    case when roles.role_name = 'public' then exists (
      select 1 from pg_catalog.aclexplode(coalesce(
        namespace.nspacl, pg_catalog.acldefault('n', namespace.nspowner)
      )) acl where acl.grantee = 0 and acl.privilege_type = 'CREATE'
    ) else pg_catalog.has_schema_privilege(roles.role_name, namespace.oid, 'CREATE')
    end as granted
  from required_schemas required
  cross join schema_roles roles
  join pg_catalog.pg_namespace namespace on namespace.nspname = required.schema_name
  join pg_catalog.pg_roles owner on owner.oid = namespace.nspowner
),
schema_acl_entries as (
  select namespace.nspname as schema_name, namespace.nspname as object_name,
    coalesce(grantee.rolname, 'PUBLIC') as grantee, grantor.rolname as grantor,
    acl.privilege_type, acl.is_grantable
  from pg_catalog.pg_namespace namespace
  cross join lateral pg_catalog.aclexplode(coalesce(
    namespace.nspacl, pg_catalog.acldefault('n', namespace.nspowner)
  )) as acl
  left join pg_catalog.pg_roles as grantee on grantee.oid = acl.grantee
  join pg_catalog.pg_roles as grantor on grantor.oid = acl.grantor
  where namespace.nspname in (select schema_name from required_schemas)
),
event_types as (
  select distinct extracted.value[1] as event_type
  from pg_catalog.pg_constraint constraint_record
  cross join lateral pg_catalog.regexp_matches(
    pg_catalog.pg_get_constraintdef(constraint_record.oid),
    '''([a-z][a-z0-9_]*)''', 'g'
  ) as extracted(value)
  where constraint_record.conname = 'literature_gold_set_events_type_check'
),
development_items as (
  select jsonb_build_object(
    'item', to_jsonb(item),
    'reviews', coalesce((select jsonb_agg(to_jsonb(review)
      order by review.revision asc nulls last, review.id asc)
      from public.literature_gold_set_reviews review where review.item_id = item.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(event)
      order by event.created_at asc nulls last, event.id asc)
      from public.literature_gold_set_events event where event.item_id = item.id), '[]'::jsonb)
  ) as value, item.display_order, item.id as item_id
  from selected_batch batch
  join public.literature_gold_set_items item on item.batch_id = batch.id
  where item.dataset_split = 'development'
),
development_articles as (
  select to_jsonb(article) as value, item.display_order, item.id as item_id, item.pmid
  from selected_batch batch
  join public.literature_gold_set_items item
    on item.batch_id = batch.id and item.dataset_split = 'development'
  join public.literature_articles article on article.pmid = item.pmid
),
development_drafts as (
  select to_jsonb(draft) as value, item.display_order, item.id as item_id
  from selected_batch batch
  join public.literature_gold_set_items item
    on item.batch_id = batch.id and item.dataset_split = 'development'
  join public.literature_gold_set_review_drafts draft on draft.item_id = item.id
),
development_events as (
  select to_jsonb(event) as value, event.created_at, event.id as event_id
  from selected_batch batch
  join public.literature_gold_set_events event on event.batch_id = batch.id
  left join public.literature_gold_set_items item on item.id = event.item_id
  where event.item_id is null or item.dataset_split = 'development'
),
test_aggregate as (
  select jsonb_build_object(
    'itemCount', count(item.id)::integer,
    'pendingCount', count(item.id) filter (where item.review_status = 'pending')::integer,
    'startedCount', count(item.id) filter (where item.started_at is not null)::integer,
    'currentPointerCount', count(item.current_review_id)::integer,
    'draftCount', (select count(*)::integer from public.literature_gold_set_review_drafts draft
      join public.literature_gold_set_items test_item on test_item.id = draft.item_id
      where test_item.batch_id = batch.id and test_item.dataset_split = 'test'),
    'reviewCount', (select count(*)::integer from public.literature_gold_set_reviews review
      join public.literature_gold_set_items test_item on test_item.id = review.item_id
      where test_item.batch_id = batch.id and test_item.dataset_split = 'test'),
    'eventCount', (select count(*)::integer from public.literature_gold_set_events event
      join public.literature_gold_set_items test_item on test_item.id = event.item_id
      where test_item.batch_id = batch.id and test_item.dataset_split = 'test'),
    'locked', bool_and((to_jsonb(batch) ->> 'test_unlocked_at') is null)
  ) as value
  from selected_batch batch
  left join public.literature_gold_set_items item
    on item.batch_id = batch.id and item.dataset_split = 'test'
  group by batch.id
)
select ${sqlLiteral(SNAPSHOT_MARKER)} || jsonb_build_object(
  'snapshotSchemaVersion', 'gold-import-compensation-db-snapshot/1.0.0',
  'database', jsonb_build_object(
    'databaseName', current_database(),
    'serverVersionNum', current_setting('server_version_num'),
    'readOnlyTransaction', current_setting('transaction_read_only')::boolean
  ),
  'migrationLedger', coalesce((
    select jsonb_agg(jsonb_build_object(
      'version', to_jsonb(migration) ->> 'version',
      'name', to_jsonb(migration) ->> 'name'
    ) order by to_jsonb(migration) ->> 'version', to_jsonb(migration) ->> 'name')
    from supabase_migrations.schema_migrations migration
  ), '[]'::jsonb),
  'scope', jsonb_build_object(
    'datasetSplit', 'development',
    'batch', (select to_jsonb(batch) from selected_batch batch)
  ),
  'developmentItems', coalesce((select jsonb_agg(value
    order by display_order asc nulls last, item_id asc) from development_items), '[]'::jsonb),
  'developmentSeed', jsonb_build_object(
    'literatureArticles', coalesce((select jsonb_agg(value
      order by display_order asc nulls last, item_id asc, pmid asc)
      from development_articles), '[]'::jsonb),
    'batches', coalesce((select jsonb_agg(to_jsonb(batch) order by batch.id asc)
      from selected_batch batch), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(to_jsonb(item)
      order by item.display_order asc nulls last, item.id asc)
      from selected_batch batch join public.literature_gold_set_items item on item.batch_id = batch.id
      where item.dataset_split = 'development'), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(to_jsonb(review)
      order by item.display_order asc nulls last, item.id asc,
        review.revision asc nulls last, review.id asc)
      from selected_batch batch
      join public.literature_gold_set_items item
        on item.batch_id = batch.id and item.dataset_split = 'development'
      join public.literature_gold_set_reviews review on review.item_id = item.id), '[]'::jsonb),
    'drafts', coalesce((select jsonb_agg(value
      order by display_order asc nulls last, item_id asc) from development_drafts), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(value
      order by created_at asc nulls last, event_id asc) from development_events), '[]'::jsonb)
  ),
  'testAggregate', coalesce((select value from test_aggregate), '{}'::jsonb),
  'schema', jsonb_build_object(
    'tables', coalesce((select jsonb_agg(to_jsonb(row) order by row.table_name asc)
      from schema_tables row), '[]'::jsonb),
    'columns', coalesce((select jsonb_agg(to_jsonb(row)
      order by row.table_name asc, row.ordinal_position asc nulls last, row.column_name asc)
      from schema_columns row), '[]'::jsonb),
    'columnPrivileges', coalesce((select jsonb_agg(to_jsonb(row)
      order by row.table_name asc, row.column_name asc,
        row.role_name asc, row.privilege_name asc)
      from column_privileges row), '[]'::jsonb),
    'functions', coalesce((select jsonb_agg(to_jsonb(row)
      order by row.name asc, row.identity_arguments asc)
      from schema_functions row), '[]'::jsonb),
    'constraints', coalesce((select jsonb_agg(to_jsonb(row)
      order by row.table_name asc, row.name asc) from schema_constraints row), '[]'::jsonb),
    'indexes', coalesce((select jsonb_agg(to_jsonb(row)
      order by row.table_name asc, row.name asc) from schema_indexes row), '[]'::jsonb),
    'triggers', coalesce((select jsonb_agg(to_jsonb(row)
      order by row.table_name asc, row.name asc) from schema_triggers row), '[]'::jsonb),
    'policies', coalesce((select jsonb_agg(to_jsonb(row)
      order by row.table_name asc, row.name asc) from schema_policies row), '[]'::jsonb),
    'tablePrivileges', coalesce((select jsonb_agg(to_jsonb(row)
      order by row.table_name, row.role_name, row.privilege_name) from table_privileges row), '[]'::jsonb),
    'schemaCreatePrivileges', coalesce((select jsonb_agg(to_jsonb(row)
      order by row.schema_name, row.role_name) from schema_create_privileges row), '[]'::jsonb),
    'tableAclEntries', coalesce((select jsonb_agg(to_jsonb(row)
      order by row.schema_name asc, row.object_name asc, row.grantee asc,
        row.privilege_type asc, row.grantor asc) from table_acl_entries row), '[]'::jsonb),
    'columnAclEntries', coalesce((select jsonb_agg(to_jsonb(row)
      order by row.schema_name asc, row.table_name asc, row.column_name asc,
        row.grantee asc, row.privilege_type asc, row.grantor asc, row.is_grantable asc)
      from column_acl_entries row), '[]'::jsonb),
    'functionAclEntries', coalesce((select jsonb_agg(to_jsonb(row)
      order by row.schema_name asc, row.object_name asc, row.identity_arguments asc,
        row.grantee asc, row.privilege_type asc, row.grantor asc)
      from function_acl_entries row), '[]'::jsonb),
    'schemaAclEntries', coalesce((select jsonb_agg(to_jsonb(row)
      order by row.schema_name asc, row.object_name asc, row.grantee asc,
        row.privilege_type asc, row.grantor asc) from schema_acl_entries row), '[]'::jsonb),
    'supportedEventTypes', coalesce((select jsonb_agg(event_type order by event_type) from event_types), '[]'::jsonb)
  )
)::text;
rollback;
`.trim()
}

function stripSqlCommentsAndLiterals(sql: string) {
  return sql
    .replaceAll(/--[^\n]*/gu, '')
    .replaceAll(/\/\*[\s\S]*?\*\//gu, '')
    .replaceAll(/'(?:''|[^'])*'/gu, "''")
}

const SERIALIZED_AGGREGATE_PATTERN =
  /\b(json_agg|jsonb_agg|array_agg|string_agg|json_object_agg|jsonb_object_agg)\s*\(/giu

/** Preserve SQL structure while hiding quoted/comment content from static ordering inspection. */
function maskSqlQuotedContent(sql: string): string {
  const output = [...sql]
  let index = 0
  const blank = (start: number, end: number) => {
    for (let offset = start; offset < end; offset += 1) {
      if (output[offset] !== '\n' && output[offset] !== '\r') output[offset] = ' '
    }
  }
  while (index < sql.length) {
    if (sql.startsWith('--', index)) {
      const end = sql.indexOf('\n', index + 2)
      const stop = end < 0 ? sql.length : end
      blank(index, stop)
      index = stop
      continue
    }
    if (sql.startsWith('/*', index)) {
      const end = sql.indexOf('*/', index + 2)
      const stop = end < 0 ? sql.length : end + 2
      blank(index, stop)
      index = stop
      continue
    }
    const character = sql[index]
    if (character === "'" || character === '"') {
      const quote = character
      let end = index + 1
      while (end < sql.length) {
        if (sql[end] === quote && sql[end + 1] === quote) {
          end += 2
          continue
        }
        if (sql[end] === quote) {
          end += 1
          break
        }
        end += 1
      }
      blank(index, end)
      index = end
      continue
    }
    if (character === '$') {
      const delimiter = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/u)?.[0]
      if (delimiter) {
        // Dollar quotes delimit executable SQL/PLpgSQL function bodies in migrations. Hide only
        // the delimiter itself so aggregate queries inside those bodies remain release-gated.
        blank(index, index + delimiter.length)
        index += delimiter.length
        continue
      }
    }
    index += 1
  }
  return output.join('')
}

function aggregateHasTopLevelOrderBy(maskedSql: string, openParenthesis: number): boolean {
  let depth = 0
  let index = openParenthesis + 1
  const tokens: string[] = []
  while (index < maskedSql.length) {
    const character = maskedSql[index]
    if (character === '(') {
      depth += 1
      index += 1
      continue
    }
    if (character === ')') {
      if (depth === 0) break
      depth -= 1
      index += 1
      continue
    }
    if (depth === 0 && /[A-Za-z_]/u.test(character)) {
      let end = index + 1
      while (end < maskedSql.length && /[A-Za-z0-9_$]/u.test(maskedSql[end])) end += 1
      tokens.push(maskedSql.slice(index, end).toLowerCase())
      index = end
      continue
    }
    index += 1
  }
  return tokens.some((token, tokenIndex) => token === 'order' && tokens[tokenIndex + 1] === 'by')
}

/**
 * Fail closed when a serialized aggregate relies on input, CTE, subquery, index, or plan order.
 * ORDER BY must occur at aggregate-argument depth, not merely in a source subquery.
 */
export function assertSerializedAggregateOrdering(sql: string): void {
  const maskedSql = maskSqlQuotedContent(sql)
  for (const match of maskedSql.matchAll(SERIALIZED_AGGREGATE_PATTERN)) {
    const openParenthesis = (match.index ?? 0) + match[0].lastIndexOf('(')
    if (!aggregateHasTopLevelOrderBy(maskedSql, openParenthesis)) {
      throw new Error(`${match[1]} serialized aggregate lacks aggregate-level ORDER BY.`)
    }
  }
  if (/\brow_to_json\s*\(\s*\(\s*select\b/iu.test(maskedSql)) {
    throw new Error(
      'row_to_json over a row-producing subquery requires an explicit reviewed order.',
    )
  }
}

export function assertReadOnlySnapshotSql(sql: string): void {
  assertSerializedAggregateOrdering(sql)
  const inspected = stripSqlCommentsAndLiterals(sql)
  if (!/\bbegin\b[^;]*\bread only\b/iu.test(inspected)) {
    throw new Error('Snapshot SQL must open an explicit read-only transaction.')
  }
  if (
    /\b(insert|update|delete|truncate|alter|create|drop|grant|revoke|call|do|copy)\b/iu.test(
      inspected,
    )
  ) {
    throw new Error('Snapshot SQL contains a database-mutation statement.')
  }
}

export function parseSnapshotOutput(output: string): RawDatabaseSnapshot {
  const lines = output.split(/\r?\n/u).filter((line) => line.startsWith(SNAPSHOT_MARKER))
  if (lines.length !== 1) throw new Error('Database snapshot marker was missing or duplicated.')
  let parsed: unknown
  try {
    parsed = JSON.parse(lines[0].slice(SNAPSHOT_MARKER.length)) as unknown
  } catch (error) {
    throw new Error(
      `Database snapshot JSON was invalid: ${error instanceof Error ? error.message : String(error)}.`,
    )
  }
  const snapshot = requireRecord(parsed, 'database snapshot')
  const database = requireRecord(snapshot.database, 'database snapshot.database')
  if (database.readOnlyTransaction !== true) {
    throw new Error('Database did not attest a read-only snapshot transaction.')
  }
  const scope = requireRecord(snapshot.scope, 'database snapshot.scope')
  if (scope.datasetSplit !== 'development') {
    throw new Error('Database snapshot was not restricted to development membership.')
  }
  requireRecord(scope.batch, 'database snapshot.scope.batch')
  return snapshot as RawDatabaseSnapshot
}

export async function collectReadOnlyDatabaseSnapshot(input: {
  batchName?: string
  container?: string
  dockerTarget?: LocalDockerTarget
  runCommand?: CommandRunner
}): Promise<RawDatabaseSnapshot> {
  const container = input.container ?? DEFAULT_LOCAL_DATABASE_CONTAINER
  const runCommand = input.runCommand ?? defaultCommandRunner
  assertLocalDatabaseContainer(container)
  const target = input.dockerTarget ?? (await resolveLocalDockerTarget({ runCommand }))
  const sql = buildReadOnlySnapshotSql(input.batchName)
  assertReadOnlySnapshotSql(sql)
  const result = await runCommand(
    'docker',
    [
      ...target.dockerArguments,
      'exec',
      '--interactive',
      container,
      'psql',
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--username',
      'postgres',
      '--dbname',
      'postgres',
      '--tuples-only',
      '--no-align',
      '--quiet',
    ],
    { env: operationalEnvironmentForDockerTarget(target), stdin: sql },
  )
  return parseSnapshotOutput(result.stdout)
}

export function buildReadOnlyContractHashSql(batchName = DEFAULT_BATCH_NAME): string {
  if (!BATCH_NAME_PATTERN.test(batchName)) throw new Error('Invalid gold-set batch name.')
  return String.raw`
begin transaction isolation level repeatable read read only;
set local statement_timeout = '120s';
select ${sqlLiteral(CONTRACT_HASH_MARKER)} || jsonb_build_object(
  'readOnlyTransaction', current_setting('transaction_read_only')::boolean,
  'developmentMembershipSha256', public.literature_gold_development_membership_hash_v1(batch.id),
  'effectiveStateSha256', public.literature_gold_effective_state_hash_v1(batch.id, 'development'),
  'physicalStateSha256', public.literature_gold_physical_state_hash_v1(batch.id, 'development')
)::text
from public.literature_gold_set_batches batch
where batch.name = ${sqlLiteral(batchName)};
rollback;
`.trim()
}

export async function collectReadOnlyContractStateHashes(input: {
  batchName?: string
  container?: string
  dockerTarget?: LocalDockerTarget
  runCommand?: CommandRunner
}): Promise<ContractStateHashes> {
  const container = input.container ?? DEFAULT_LOCAL_DATABASE_CONTAINER
  const runCommand = input.runCommand ?? defaultCommandRunner
  assertLocalDatabaseContainer(container)
  const target = input.dockerTarget ?? (await resolveLocalDockerTarget({ runCommand }))
  const sql = buildReadOnlyContractHashSql(input.batchName)
  assertReadOnlySnapshotSql(sql)
  const result = await runCommand(
    'docker',
    [
      ...target.dockerArguments,
      'exec',
      '--interactive',
      container,
      'psql',
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--username',
      'postgres',
      '--dbname',
      'postgres',
      '--tuples-only',
      '--no-align',
      '--quiet',
    ],
    { env: operationalEnvironmentForDockerTarget(target), stdin: sql },
  )
  const lines = result.stdout
    .split(/\r?\n/u)
    .filter((line) => line.startsWith(CONTRACT_HASH_MARKER))
  if (lines.length !== 1) throw new Error('Contract state-hash marker was missing or duplicated.')
  const parsed = requireRecord(
    JSON.parse(lines[0].slice(CONTRACT_HASH_MARKER.length)) as unknown,
    'contract hashes',
  )
  for (const key of [
    'developmentMembershipSha256',
    'effectiveStateSha256',
    'physicalStateSha256',
  ]) {
    if (typeof parsed[key] !== 'string' || !SHA256_PATTERN.test(parsed[key])) {
      throw new Error(`Contract ${key} is not a SHA-256 digest.`)
    }
  }
  if (parsed.readOnlyTransaction !== true) {
    throw new Error('Contract hashes were not queried in a read-only transaction.')
  }
  return parsed as unknown as ContractStateHashes
}

function mapObjectArray(value: unknown, label: string) {
  return requireArray(value, label).map((entry, index) =>
    requireRecord(entry, `${label}[${index}]`),
  )
}

function snakeOrCamel(record: Record<string, unknown>, snake: string, camel: string) {
  return record[snake] ?? record[camel]
}

const CLINICAL_FIELDS = [
  'relevance_label',
  'metadata_sufficiency',
  'reviewer_confidence',
  'topic_ids',
  'technology_tags',
  'technology_tag_status',
  'clinical_purposes',
  'disease_tags',
  'disease_tag_status',
  'study_design',
  'publication_status',
  'categorization_from_full_text',
  'notes',
  'used_supplemental_metadata',
  'review_seconds',
  'taxonomy_version',
  'label_schema_version',
  'enrichment_schema_version',
  'enrichment_provenance',
  'is_blinded',
] as const

function sortedStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => String(entry)).sort(compareCodeUnits) : []
}

function contractClinicalProjection(review: Record<string, unknown>) {
  return {
    relevanceLabel: review.relevance_label ?? null,
    metadataSufficiency: review.metadata_sufficiency ?? null,
    reviewerConfidence: review.reviewer_confidence ?? null,
    topicIds: sortedStringArray(review.topic_ids),
    technologyTags: sortedStringArray(review.technology_tags),
    technologyTagStatus: review.technology_tag_status ?? null,
    clinicalPurposes: sortedStringArray(review.clinical_purposes),
    diseaseTags: sortedStringArray(review.disease_tags),
    diseaseTagStatus: review.disease_tag_status ?? null,
    studyDesign: review.study_design ?? null,
    publicationStatus: review.publication_status ?? null,
    categorizationFromFullText: review.categorization_from_full_text ?? false,
    notes: review.notes ?? '',
    usedSupplementalMetadata: review.used_supplemental_metadata ?? false,
    reviewSeconds: review.review_seconds ?? 0,
    taxonomyVersion: review.taxonomy_version ?? null,
    labelSchemaVersion: review.label_schema_version ?? null,
    enrichmentSchemaVersion: review.enrichment_schema_version ?? null,
    enrichmentProvenance: review.enrichment_provenance ?? null,
    isBlinded: review.is_blinded ?? null,
  }
}

function reviewPayloadProjection(review: Record<string, unknown>) {
  return {
    relevanceLabel: review.relevance_label ?? null,
    metadataSufficiency: review.metadata_sufficiency ?? null,
    reviewerConfidence: review.reviewer_confidence ?? null,
    topicIds: sortedStringArray(review.topic_ids),
    technologyTags: sortedStringArray(review.technology_tags),
    technologyTagStatus: review.technology_tag_status ?? null,
    clinicalPurposes: sortedStringArray(review.clinical_purposes),
    diseaseTags: sortedStringArray(review.disease_tags),
    diseaseTagStatus: review.disease_tag_status ?? null,
    studyDesign: review.study_design ?? null,
    publicationStatus: review.publication_status ?? null,
    categorizationFromFullText: review.categorization_from_full_text ?? false,
    notes: review.notes ?? '',
    usedSupplementalMetadata: review.used_supplemental_metadata ?? false,
    reviewSeconds: review.review_seconds ?? 0,
    taxonomyVersion: review.taxonomy_version ?? null,
    labelSchemaVersion: review.label_schema_version ?? null,
    enrichmentSchemaVersion: review.enrichment_schema_version ?? null,
    enrichmentProvenance: review.enrichment_provenance ?? null,
    reviewerUserId: review.reviewer_user_id ?? null,
    reviewerEmail: review.reviewer_email ?? null,
    isBlinded: review.is_blinded ?? null,
    startedAt: review.started_at ?? null,
    completedAt: review.completed_at ?? null,
    createdAt: review.created_at ?? null,
  }
}

export function resolveEffectiveReview(
  reviewsInput: readonly Record<string, unknown>[],
): Record<string, unknown> | null {
  const reviews = [...reviewsInput].sort(
    (left, right) =>
      requireInteger(left.revision, 'review.revision') -
        requireInteger(right.revision, 'review.revision') ||
      compareCodeUnits(requireString(left.id, 'review.id'), requireString(right.id, 'review.id')),
  )
  const head = reviews.at(-1)
  if (!head) return null
  const lifecycle = snakeOrCamel(head, 'lifecycle_state', 'lifecycleState') ?? 'effective'
  if (lifecycle === 'withdrawn') return null
  if (lifecycle !== 'effective')
    throw new Error(`Unsupported review lifecycle: ${String(lifecycle)}.`)
  const sourceId = snakeOrCamel(head, 'effective_source_review_id', 'effectiveSourceReviewId')
  if (sourceId === null || sourceId === undefined) return head
  const source = reviews.find((review) => review.id === sourceId)
  if (!source) throw new Error('Compensation effective source is absent from the review history.')
  return source
}

function projectDevelopmentState(snapshot: RawDatabaseSnapshot) {
  const rows = mapObjectArray(snapshot.developmentItems, 'developmentItems')
  return rows
    .map((row, index) => {
      const item = requireRecord(row.item, `developmentItems[${index}].item`)
      if (item.dataset_split !== 'development') {
        throw new Error('Held-out membership entered a development review-history row.')
      }
      const reviews = mapObjectArray(row.reviews, `developmentItems[${index}].reviews`).sort(
        (left, right) =>
          requireInteger(left.revision, 'review.revision') -
            requireInteger(right.revision, 'review.revision') ||
          compareCodeUnits(
            requireString(left.id, 'review.id'),
            requireString(right.id, 'review.id'),
          ),
      )
      const events = mapObjectArray(row.events, `developmentItems[${index}].events`).sort(
        (left, right) =>
          compareCodeUnits(
            String(left.created_at ?? '\uffff'),
            String(right.created_at ?? '\uffff'),
          ) ||
          compareCodeUnits(requireString(left.id, 'event.id'), requireString(right.id, 'event.id')),
      )
      return { item, reviews, events }
    })
    .sort(
      (left, right) =>
        requireInteger(left.item.display_order, 'item.display_order') -
          requireInteger(right.item.display_order, 'item.display_order') ||
        compareCodeUnits(
          requireString(left.item.id, 'item.id'),
          requireString(right.item.id, 'item.id'),
        ),
    )
}

export function buildDevelopmentPlanningState(snapshot: RawDatabaseSnapshot) {
  return {
    schemaVersion: 'gold-import-compensation-development-planning-state/1.0.0',
    datasetSplit: 'development',
    rows: projectDevelopmentState(snapshot).map(({ item, reviews }, index) => {
      const ordered = [...reviews].sort(
        (left, right) =>
          requireInteger(left.revision, 'review.revision') -
            requireInteger(right.revision, 'review.revision') ||
          compareCodeUnits(
            requireString(left.id, 'review.id'),
            requireString(right.id, 'review.id'),
          ),
      )
      const head = ordered.at(-1) ?? null
      const effective = resolveEffectiveReview(ordered)
      return {
        sequence: index + 1,
        displayOrder: item.display_order,
        itemId: item.id,
        pmid: item.pmid,
        datasetSplit: 'development',
        currentReviewId: item.current_review_id ?? null,
        effectiveReviewId: effective?.id ?? null,
        currentRevision: head?.revision ?? null,
        itemState: {
          reviewStatus: item.review_status,
          startedAt: item.started_at ?? null,
          completedAt: item.completed_at ?? null,
          supplementalMetadataRevealedAt: item.supplemental_metadata_revealed_at ?? null,
          automatedSignalsRevealedAt: item.automated_signals_revealed_at ?? null,
        },
        currentEffectiveReview: effective ? reviewPayloadProjection(effective) : null,
      }
    }),
  }
}

/** Snapshot-side convenience; artifact consumers hash parsed planning JSON directly. */
export function developmentPlanningStateSha256(snapshot: RawDatabaseSnapshot) {
  return sha256ContractCanonical(buildDevelopmentPlanningState(snapshot))
}

function effectiveStateProjection(developmentState: ReturnType<typeof projectDevelopmentState>) {
  return {
    projectionVersion: 'literature-gold-effective-state-v1',
    datasetSplit: 'development',
    items: developmentState
      .map(({ item, reviews }) => {
        const effectiveReview = resolveEffectiveReview(reviews)
        return {
          sortItemId: item.id,
          value: {
            pmid: item.pmid,
            reviewStatus: item.review_status,
            review: effectiveReview ? contractClinicalProjection(effectiveReview) : null,
          },
        }
      })
      .sort((left, right) => {
        const leftPmid = String(left.value.pmid)
        const rightPmid = String(right.value.pmid)
        return (
          leftPmid.length - rightPmid.length ||
          compareCodeUnits(leftPmid, rightPmid) ||
          compareCodeUnits(String(left.sortItemId), String(right.sortItemId))
        )
      })
      .map(({ value }) => value),
  }
}

function developmentMembershipProjection(
  developmentState: ReturnType<typeof projectDevelopmentState>,
) {
  return {
    projectionVersion: 'literature-gold-development-membership-v1',
    datasetSplit: 'development',
    items: developmentState
      .map(({ item }) => ({ itemId: item.id, pmid: item.pmid }))
      .sort((left, right) => compareCodeUnits(String(left.itemId), String(right.itemId))),
  }
}

const LEGACY_ITEM_FIELDS = [
  'id',
  'batch_id',
  'pmid',
  'dataset_split',
  'display_order',
  'review_status',
  'current_review_id',
  'supplemental_metadata_revealed_at',
  'automated_signals_revealed_at',
  'started_at',
  'completed_at',
] as const
const LEGACY_REVIEW_FIELDS = [
  'id',
  'item_id',
  'revision',
  'supersedes_review_id',
  'reviewer_user_id',
  'reviewer_email',
  ...CLINICAL_FIELDS.filter(
    (field) =>
      ![
        'technology_tag_status',
        'disease_tag_status',
        'taxonomy_version',
        'label_schema_version',
        'enrichment_schema_version',
        'enrichment_provenance',
      ].includes(field),
  ),
  'started_at',
  'completed_at',
  'created_at',
] as const
const LEGACY_EVENT_FIELDS = [
  'id',
  'batch_id',
  'item_id',
  'actor_user_id',
  'actor_email',
  'event_type',
  'before_value',
  'after_value',
  'created_at',
] as const

function selectFields(record: Record<string, unknown>, fields: readonly string[]) {
  return Object.fromEntries(fields.map((field) => [field, record[field] ?? null]))
}

function physicalStateProjection(developmentState: ReturnType<typeof projectDevelopmentState>) {
  return {
    projectionVersion: 'literature-gold-preexisting-physical-audit-state-v1',
    datasetSplit: 'development',
    items: developmentState.map(({ item, reviews, events }) => ({
      item: selectFields(item, LEGACY_ITEM_FIELDS),
      reviews: reviews.map((review) => selectFields(review, LEGACY_REVIEW_FIELDS)),
      events: events.map((event) => selectFields(event, LEGACY_EVENT_FIELDS)),
    })),
  }
}

function legacyReviewRowsProjection(developmentState: ReturnType<typeof projectDevelopmentState>) {
  return developmentState.map(({ item, reviews }) => ({
    itemId: item.id,
    reviews: reviews.map((review) => selectFields(review, LEGACY_REVIEW_FIELDS)),
  }))
}

function buildRevisionChainAudit(developmentState: ReturnType<typeof projectDevelopmentState>) {
  const failures: Array<Record<string, unknown>> = []
  for (const { item, reviews } of developmentState) {
    const ordered = [...reviews].sort(
      (left, right) =>
        requireInteger(left.revision, 'review.revision') -
          requireInteger(right.revision, 'review.revision') ||
        compareCodeUnits(requireString(left.id, 'review.id'), requireString(right.id, 'review.id')),
    )
    ordered.forEach((review, index) => {
      const expectedRevision = index + 1
      if (review.revision !== expectedRevision) {
        failures.push({ itemId: item.id, kind: 'non_contiguous_revision', expectedRevision })
      }
      const expectedParent = index === 0 ? null : ordered[index - 1]?.id
      if ((review.supersedes_review_id ?? null) !== expectedParent) {
        failures.push({
          itemId: item.id,
          kind: 'invalid_supersedes_link',
          revision: review.revision,
        })
      }
    })
    if ((item.current_review_id ?? null) !== (ordered.at(-1)?.id ?? null)) {
      failures.push({ itemId: item.id, kind: 'current_pointer_not_latest_head' })
    }
  }
  return {
    auditedItemCount: developmentState.length,
    failureCount: failures.length,
    failures,
    revisionChainsLinear: failures.every(
      ({ kind }) => kind !== 'non_contiguous_revision' && kind !== 'invalid_supersedes_link',
    ),
    currentPointersAreLatestHeads: failures.every(
      ({ kind }) => kind !== 'current_pointer_not_latest_head',
    ),
  }
}

function schemaInventory(snapshot: RawDatabaseSnapshot) {
  const rawSchema = requireRecord(snapshot.schema, 'snapshot.schema')
  const inventorySchema = { ...rawSchema }
  // Exact ACL rows feed the post-migration definition identity without perturbing the separately
  // pinned legacy pre-migration schema-inventory contract.
  delete inventorySchema.tableAclEntries
  delete inventorySchema.columnAclEntries
  delete inventorySchema.columnPrivileges
  delete inventorySchema.functionAclEntries
  delete inventorySchema.schemaAclEntries
  const contractMigrationApplied = snapshot.migrationLedger.some((entry) => {
    const row = requireRecord(entry, 'snapshot.migrationLedger entry')
    return (
      row.version === '20260808035633' &&
      row.name === 'add_literature_gold_import_compensation_contract'
    )
  })
  const functions = mapObjectArray(rawSchema.functions, 'snapshot.schema.functions')
    // The successful real pre-migration baseline predates the expanded exact post-contract scope.
    // Preserve that legacy receipt identity while the raw snapshot still captures all 24 names for
    // post-migration definition/ACL validation.
    .filter(
      (functionRecord) =>
        contractMigrationApplied ||
        String(functionRecord.name ?? '').startsWith('literature_gold_') ||
        [
          'apply_literature_gold_import_v1',
          'compensate_literature_gold_import_v1',
          'reconcile_literature_gold_review_operation_v1',
          'save_literature_gold_review_v1',
        ].includes(String(functionRecord.name ?? '')),
    )
    .map((functionRecord): Record<string, unknown> => {
      const definition = requireString(functionRecord.definition, 'function.definition')
      return { ...functionRecord, definitionSha256: sha256(definition) }
    })
    .sort(
      (left, right) =>
        compareCodeUnits(String(left.name ?? ''), String(right.name ?? '')) ||
        compareCodeUnits(
          String(left.identity_arguments ?? ''),
          String(right.identity_arguments ?? ''),
        ),
    )
  const indexes = mapObjectArray(rawSchema.indexes, 'snapshot.schema.indexes')
    .map((indexRecord) => {
      const inventoryIndex = { ...indexRecord }
      // Query-only catalog classification must not perturb the pinned canonical schema identity.
      delete inventoryIndex.constraint_backed
      delete inventoryIndex.owner
      return inventoryIndex
    })
    .sort(
      (left, right) =>
        compareCodeUnits(String(left.name ?? ''), String(right.name ?? '')) ||
        compareCodeUnits(String(left.table_name ?? ''), String(right.table_name ?? '')),
    )
  const sortRecords = (value: unknown, label: string, keys: readonly string[]) =>
    mapObjectArray(value, label).sort((left, right) => {
      for (const key of keys) {
        const leftValue = left[key]
        const rightValue = right[key]
        const result =
          typeof leftValue === 'number' && typeof rightValue === 'number'
            ? leftValue - rightValue
            : compareCodeUnits(String(leftValue ?? ''), String(rightValue ?? ''))
        if (result !== 0) return result
      }
      return 0
    })
  return {
    ...inventorySchema,
    tables: sortRecords(rawSchema.tables, 'snapshot.schema.tables', ['table_name']).map((table) => {
      const legacyTable = { ...table }
      delete legacyTable.force_rls
      return legacyTable
    }),
    columns: sortRecords(rawSchema.columns, 'snapshot.schema.columns', [
      'table_name',
      'ordinal_position',
      'column_name',
    ]),
    functions,
    constraints: sortRecords(rawSchema.constraints, 'snapshot.schema.constraints', [
      'name',
      'table_name',
    ]),
    indexes,
    triggers: sortRecords(rawSchema.triggers, 'snapshot.schema.triggers', ['name', 'table_name']),
    policies: sortRecords(rawSchema.policies, 'snapshot.schema.policies', [
      'name',
      'table_name',
    ]).map((policy) => ({
      ...policy,
      roles: Array.isArray(policy.roles)
        ? [...policy.roles].map(String).sort(compareCodeUnits)
        : policy.roles,
    })),
    tablePrivileges: sortRecords(rawSchema.tablePrivileges, 'snapshot.schema.tablePrivileges', [
      'table_name',
      'role_name',
      'privilege_name',
    ]),
    schemaCreatePrivileges: sortRecords(
      rawSchema.schemaCreatePrivileges,
      'snapshot.schema.schemaCreatePrivileges',
      ['schema_name', 'role_name'],
    ),
    supportedEventTypes: requireArray(
      rawSchema.supportedEventTypes,
      'snapshot.schema.supportedEventTypes',
    )
      .map(String)
      .sort(compareCodeUnits),
  } as Record<string, unknown>
}

/**
 * These query-only fields are intentionally omitted from the historical pre-migration inventory
 * hash. Bind them before accepting that legacy identity: the pre-contract database had no forced
 * RLS or explicit column ACLs, so every effective column grant must exactly inherit its table grant.
 */
function assertPreMigrationQueryOnlySecurityState(snapshot: RawDatabaseSnapshot): void {
  const schema = requireRecord(snapshot.schema, 'snapshot.schema')
  const tables = mapObjectArray(schema.tables, 'snapshot.schema.tables')
  for (const [index, table] of tables.entries()) {
    if (table.relation_kind === null || table.relation_kind === undefined) continue
    if (table.force_rls !== false) {
      throw new Error(
        `Pre-migration security drift: snapshot.schema.tables[${index}] must have force_rls=false.`,
      )
    }
  }

  const columnAclEntries = mapObjectArray(
    schema.columnAclEntries,
    'snapshot.schema.columnAclEntries',
  )
  if (columnAclEntries.length !== 0) {
    throw new Error('Pre-migration security drift: explicit protected-column ACLs are forbidden.')
  }

  const columns = mapObjectArray(schema.columns, 'snapshot.schema.columns')
  const columnPrivileges = mapObjectArray(
    schema.columnPrivileges,
    'snapshot.schema.columnPrivileges',
  )
  const tablePrivileges = mapObjectArray(schema.tablePrivileges, 'snapshot.schema.tablePrivileges')
  const expectedKeys = new Set(
    columns.flatMap((column) => {
      const tableName = requireString(column.table_name, 'pre-migration column table_name')
      const columnName = requireString(column.column_name, 'pre-migration column column_name')
      return SCHEMA_SECURITY_COLUMN_ROLES.flatMap((roleName) =>
        SCHEMA_SECURITY_COLUMN_PRIVILEGES.map(
          (privilegeName) => `${tableName}\0${columnName}\0${roleName}\0${privilegeName}`,
        ),
      )
    }),
  )
  const observedKeys = new Set<string>()
  for (const [index, row] of columnPrivileges.entries()) {
    const tableName = requireString(
      row.table_name,
      `snapshot.schema.columnPrivileges[${index}].table_name`,
    )
    const columnName = requireString(
      row.column_name,
      `snapshot.schema.columnPrivileges[${index}].column_name`,
    )
    const roleName = requireString(
      row.role_name,
      `snapshot.schema.columnPrivileges[${index}].role_name`,
    )
    const privilegeName = requireString(
      row.privilege_name,
      `snapshot.schema.columnPrivileges[${index}].privilege_name`,
    )
    const key = `${tableName}\0${columnName}\0${roleName}\0${privilegeName}`
    if (!expectedKeys.has(key) || observedKeys.has(key)) {
      throw new Error(
        'Pre-migration security drift: effective protected-column privilege matrix changed.',
      )
    }
    observedKeys.add(key)
    const granted = requireBoolean(
      row.granted,
      `snapshot.schema.columnPrivileges[${index}].granted`,
    )
    const inherited = tablePrivileges.filter(
      (entry) =>
        entry.table_name === tableName &&
        entry.role_name === roleName &&
        entry.privilege_name === privilegeName,
    )
    if (
      inherited.length !== 1 ||
      requireBoolean(inherited[0]?.granted, 'pre-migration inherited table privilege') !== granted
    ) {
      throw new Error(
        'Pre-migration security drift: effective column privilege does not match table ACL state.',
      )
    }
  }
  if (observedKeys.size !== expectedKeys.size) {
    throw new Error(
      'Pre-migration security drift: effective protected-column privilege matrix is incomplete.',
    )
  }
}

export function assertAggregateOnlyTestState(value: unknown): void {
  const aggregate = requireRecord(value, 'testAggregate')
  const forbiddenKeys = Object.keys(aggregate).filter((key) =>
    /(^|_)(?:id|ids|pmid|pmids|title|titles|article|articles|review_id|item_id)($|_)/iu.test(key),
  )
  if (forbiddenKeys.length > 0) {
    throw new Error(`Held-out identity fields are forbidden: ${forbiddenKeys.join(', ')}.`)
  }
  for (const [key, entry] of Object.entries(aggregate)) {
    if (typeof entry !== 'number' && typeof entry !== 'boolean' && entry !== null) {
      throw new Error(`Test aggregate ${key} is not aggregate-only.`)
    }
  }
}

function assertExactRecordKeys(
  record: Record<string, unknown>,
  expectedKeys: readonly string[],
  label: string,
) {
  const actual = Object.keys(record).sort(compareCodeUnits)
  const expected = [...expectedKeys].sort(compareCodeUnits)
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`${label} must contain exactly the approved aggregate keys.`)
  }
}

function requireNonnegativeInteger(value: unknown, label: string) {
  const result = requireInteger(value, label)
  if (result < 0) throw new Error(`${label} must be nonnegative.`)
  return result
}

function requireStringArray(value: unknown, label: string) {
  return requireArray(value, label).map((entry, index) =>
    requireString(entry, `${label}[${index}]`),
  )
}

function validateCountMap(
  value: unknown,
  label: string,
  selectedCount: number,
  expectedKeys?: readonly string[],
) {
  const record = requireRecord(value, label)
  if (expectedKeys) assertExactRecordKeys(record, expectedKeys, label)
  if (!expectedKeys && Object.keys(record).some((key) => /^[0-9]{1,12}$/u.test(key))) {
    throw new Error(`${label} contains a PMID-shaped dynamic key.`)
  }
  const total = Object.entries(record).reduce(
    (sum, [key, count]) => sum + requireNonnegativeInteger(count, `${label}.${key}`),
    0,
  )
  if (total !== selectedCount) throw new Error(`${label} counts do not sum to selectedCount.`)
}

function validateAggregateSamplingReport(batch: Record<string, unknown>) {
  const report = requireRecord(batch.sampling_report, 'development seed batch sampling_report')
  assertExactRecordKeys(
    report,
    [
      'broadTopicsRepresented',
      'broadTopicsUnavailable',
      'candidateCount',
      'countsByAbstractAvailability',
      'countsByDeterministicBand',
      'countsByJournal',
      'countsBySourceTier',
      'countsByStratum',
      'countsByYearBand',
      'developmentCount',
      'excludedCandidateCount',
      'exclusionSources',
      'kind',
      'name',
      'originalCandidateCount',
      'reportVersion',
      'requestedSize',
      'samplingAlgorithmVersion',
      'samplingSeed',
      'selectedCount',
      'testCount',
      'warnings',
    ],
    'development seed batch sampling_report',
  )
  const selectedCount = requireNonnegativeInteger(report.selectedCount, 'sampling selectedCount')
  const developmentCount = requireNonnegativeInteger(
    report.developmentCount,
    'sampling developmentCount',
  )
  const testCount = requireNonnegativeInteger(report.testCount, 'sampling testCount')
  const candidateCount = requireNonnegativeInteger(report.candidateCount, 'sampling candidateCount')
  const originalCandidateCount = requireNonnegativeInteger(
    report.originalCandidateCount,
    'sampling originalCandidateCount',
  )
  const excludedCandidateCount = requireNonnegativeInteger(
    report.excludedCandidateCount,
    'sampling excludedCandidateCount',
  )
  const requestedSize = requireNonnegativeInteger(report.requestedSize, 'sampling requestedSize')
  requireInteger(report.samplingSeed, 'sampling samplingSeed')
  for (const [key, expected] of [
    ['kind', batch.kind],
    ['name', batch.name],
    ['requestedSize', batch.requested_size],
    ['samplingSeed', batch.sampling_seed],
  ] as const) {
    if (report[key] !== expected)
      throw new Error(`Sampling report ${key} does not match its batch.`)
  }
  requireString(report.reportVersion, 'sampling reportVersion')
  requireString(report.samplingAlgorithmVersion, 'sampling samplingAlgorithmVersion')
  if (
    requestedSize !== selectedCount ||
    developmentCount + testCount !== selectedCount ||
    originalCandidateCount - excludedCandidateCount !== candidateCount
  ) {
    throw new Error('Sampling report aggregate totals are inconsistent.')
  }
  for (const [key, expectedKeys] of [
    ['countsByAbstractAvailability', ['has_abstract', 'no_abstract']],
    ['countsByDeterministicBand', ['high', 'intermediate', 'low']],
    ['countsBySourceTier', ['core', 'discovery_only', 'multiple']],
    [
      'countsByStratum',
      [
        'ambiguous_boundary',
        'challenging_metadata',
        'discovery_only',
        'likely_non_ip',
        'strong_likely_ip',
      ],
    ],
    ['countsByYearBand', ['2000_2009', '2010_2019', '2020_present']],
  ] as const) {
    validateCountMap(report[key], `sampling ${key}`, selectedCount, expectedKeys)
  }
  validateCountMap(report.countsByJournal, 'sampling countsByJournal', selectedCount)
  const topics = [
    ...requireStringArray(report.broadTopicsRepresented, 'sampling broadTopicsRepresented'),
    ...requireStringArray(report.broadTopicsUnavailable, 'sampling broadTopicsUnavailable'),
  ]
  if (
    new Set(topics).size !== topics.length ||
    topics.some((topic) => !/^[a-z0-9][a-z0-9-]*$/u.test(topic))
  ) {
    throw new Error('Sampling broad-topic aggregates are invalid.')
  }
  requireStringArray(report.warnings, 'sampling warnings')
  const exclusionSources = mapObjectArray(report.exclusionSources, 'sampling exclusionSources')
  let excludedSourceTotal = 0
  for (const [index, source] of exclusionSources.entries()) {
    const label = `sampling exclusionSources[${index}]`
    assertExactRecordKeys(
      source,
      [
        'batchNames',
        'corpusPresentCount',
        'eligibleCount',
        'excludedCount',
        'path',
        'sha256',
        'sourceType',
        'suppliedCount',
      ],
      label,
    )
    requireStringArray(source.batchNames, `${label}.batchNames`)
    for (const countKey of [
      'corpusPresentCount',
      'eligibleCount',
      'excludedCount',
      'suppliedCount',
    ]) {
      requireNonnegativeInteger(source[countKey], `${label}.${countKey}`)
    }
    excludedSourceTotal += requireNonnegativeInteger(source.excludedCount, `${label}.excludedCount`)
    if (source.path !== null) requireString(source.path, `${label}.path`)
    if (source.sha256 !== null) {
      const sourceSha256 = requireString(source.sha256, `${label}.sha256`)
      if (!SHA256_PATTERN.test(sourceSha256)) throw new Error(`${label}.sha256 is invalid.`)
    }
    if (!['pmid_manifest', 'prior_automatic_batches'].includes(String(source.sourceType))) {
      throw new Error(`${label}.sourceType is not approved.`)
    }
  }
  if (excludedSourceTotal !== excludedCandidateCount) {
    throw new Error('Sampling exclusion-source counts are inconsistent.')
  }
}

function validateBatchLevelSeedEvent(
  event: Record<string, unknown>,
  batch: Record<string, unknown>,
) {
  assertExactRecordKeys(
    event,
    [
      'actor_email',
      'actor_user_id',
      'after_value',
      'batch_id',
      'before_value',
      'created_at',
      'event_type',
      'id',
      'item_id',
    ],
    'batch-level event',
  )
  if (event.event_type !== 'batch_created' || event.before_value !== null) {
    throw new Error('Development seed contains an unapproved batch-level event shape.')
  }
  const after = requireRecord(event.after_value, 'batch_created after_value')
  assertExactRecordKeys(
    after,
    ['kind', 'name', 'requested_size', 'sampling_seed'],
    'batch_created after_value',
  )
  for (const key of ['kind', 'name', 'requested_size', 'sampling_seed']) {
    if (after[key] !== batch[key]) {
      throw new Error(`batch_created ${key} does not match its batch.`)
    }
  }
}

export function buildDevelopmentDatabaseSeed(snapshot: RawDatabaseSnapshot) {
  const raw = requireRecord(snapshot.developmentSeed, 'snapshot.developmentSeed')
  const articles = mapObjectArray(raw.literatureArticles, 'developmentSeed.literatureArticles')
  const batches = mapObjectArray(raw.batches, 'developmentSeed.batches').sort((left, right) =>
    compareCodeUnits(requireString(left.id, 'batch.id'), requireString(right.id, 'batch.id')),
  )
  const items = mapObjectArray(raw.items, 'developmentSeed.items').sort(
    (left, right) =>
      requireInteger(left.display_order, 'item.display_order') -
        requireInteger(right.display_order, 'item.display_order') ||
      compareCodeUnits(requireString(left.id, 'item.id'), requireString(right.id, 'item.id')),
  )
  const reviews = mapObjectArray(raw.reviews, 'developmentSeed.reviews')
  const drafts = mapObjectArray(raw.drafts, 'developmentSeed.drafts')
  const events = mapObjectArray(raw.events, 'developmentSeed.events')
  if (batches.length !== 1) throw new Error('Development seed must contain exactly one batch row.')
  const batch = batches[0]
  validateAggregateSamplingReport(batch)
  const batchId = requireString(batch.id, 'development seed batch id')
  const itemIds = new Set(
    items.map((item) => {
      if (item.dataset_split !== 'development') {
        throw new Error('Held-out item entered the development database seed.')
      }
      if (item.batch_id !== batchId) {
        throw new Error('A development seed item belongs to the wrong batch.')
      }
      return requireString(item.id, 'development seed item id')
    }),
  )
  if (itemIds.size !== items.length)
    throw new Error('Development seed contains duplicate item IDs.')
  const pmids = new Set(items.map((item) => requireString(item.pmid, 'development seed PMID')))
  if (pmids.size !== items.length) throw new Error('Development seed contains duplicate PMIDs.')
  if (
    articles.some(
      (article) => !pmids.has(requireString(article.pmid, 'development article PMID')),
    ) ||
    articles.length !== pmids.size ||
    new Set(articles.map((article) => String(article.pmid))).size !== pmids.size
  ) {
    throw new Error('Development articles do not exactly cover development membership.')
  }
  for (const [label, rows] of [
    ['review', reviews],
    ['draft', drafts],
  ] as const) {
    if (
      rows.some((row) => !itemIds.has(requireString(row.item_id, `development ${label} item_id`)))
    ) {
      throw new Error(`A ${label} outside development membership entered the seed.`)
    }
  }
  const batchEvents: Record<string, unknown>[] = []
  for (const event of events) {
    if (event.batch_id !== batchId) {
      throw new Error('A development seed event belongs to the wrong batch.')
    }
    if (event.item_id !== null && !itemIds.has(requireString(event.item_id, 'event.item_id'))) {
      throw new Error('A held-out item event entered the development seed.')
    }
    if (event.item_id === null) batchEvents.push(event)
  }
  if (batchEvents.length !== 1) {
    throw new Error('Development seed must contain exactly one approved batch-level event.')
  }
  validateBatchLevelSeedEvent(batchEvents[0], batch)
  const itemSortKey = new Map(
    items.map((item) => [
      requireString(item.id, 'development seed item id'),
      {
        displayOrder: requireInteger(item.display_order, 'development seed display_order'),
        itemId: requireString(item.id, 'development seed item id'),
      },
    ]),
  )
  const compareByItem = (left: Record<string, unknown>, right: Record<string, unknown>) => {
    const leftKey = itemSortKey.get(requireString(left.item_id, 'development row item_id'))
    const rightKey = itemSortKey.get(requireString(right.item_id, 'development row item_id'))
    if (!leftKey || !rightKey) throw new Error('Development seed row has an unknown item.')
    return (
      leftKey.displayOrder - rightKey.displayOrder ||
      compareCodeUnits(leftKey.itemId, rightKey.itemId)
    )
  }
  const sortedArticles = [...articles].sort((left, right) => {
    const leftItem = items.find((item) => item.pmid === left.pmid)
    const rightItem = items.find((item) => item.pmid === right.pmid)
    if (!leftItem || !rightItem) throw new Error('Development article is missing its item.')
    return (
      requireInteger(leftItem.display_order, 'article item display_order') -
        requireInteger(rightItem.display_order, 'article item display_order') ||
      compareCodeUnits(
        requireString(leftItem.id, 'article item id'),
        requireString(rightItem.id, 'article item id'),
      ) ||
      compareCodeUnits(
        requireString(left.pmid, 'article PMID'),
        requireString(right.pmid, 'article PMID'),
      )
    )
  })
  const sortedReviews = [...reviews].sort(
    (left, right) =>
      compareByItem(left, right) ||
      requireInteger(left.revision, 'review.revision') -
        requireInteger(right.revision, 'review.revision') ||
      compareCodeUnits(requireString(left.id, 'review.id'), requireString(right.id, 'review.id')),
  )
  const sortedDrafts = [...drafts].sort(
    (left, right) =>
      compareByItem(left, right) ||
      compareCodeUnits(String(left.id ?? left.item_id), String(right.id ?? right.item_id)),
  )
  const sortedEvents = [...events].sort(
    (left, right) =>
      compareCodeUnits(String(left.created_at ?? '\uffff'), String(right.created_at ?? '\uffff')) ||
      compareCodeUnits(requireString(left.id, 'event.id'), requireString(right.id, 'event.id')),
  )
  return {
    schemaVersion: 'gold-import-compensation-development-seed/v1',
    datasetSplit: 'development',
    heldOutIdentitiesIncluded: false,
    batchId,
    tables: {
      literature_articles: sortedArticles,
      literature_gold_set_batches: batches,
      literature_gold_set_items: items,
      literature_gold_set_reviews: sortedReviews,
      literature_gold_set_review_drafts: sortedDrafts,
      literature_gold_set_events: sortedEvents,
    },
  }
}

function canonicalArtifactMap(records: Readonly<Record<string, unknown>>) {
  return new Map(Object.entries(records).map(([name, value]) => [name, canonicalJson(value)]))
}

function sealArtifacts(filesInput: ReadonlyMap<string, string>): CanonicalArtifacts {
  const files = new Map(
    [...filesInput.entries()].sort(([left], [right]) => compareCodeUnits(left, right)),
  )
  const manifest = [...files.entries()]
    .map(([name, bytes]) => `${sha256(bytes)}  ${name}\n`)
    .join('')
  return { files, manifest, manifestSha256: sha256(manifest) }
}

/** Seal already-canonical UTF-8 artifacts into the shared sorted checksum-manifest format. */
export function sealCanonicalArtifacts(
  filesInput: ReadonlyMap<string, string>,
): CanonicalArtifacts {
  for (const [name, bytes] of filesInput) {
    if (!name || name.includes('/') || name.includes('\\') || name === 'checksum-manifest.sha256') {
      throw new Error(`Canonical artifact name is unsafe or reserved: ${name || '<empty>'}.`)
    }
    if (!bytes.endsWith('\n') || bytes.endsWith('\n\n')) {
      throw new Error(`Canonical artifact ${name} must have exactly one final newline.`)
    }
  }
  return sealArtifacts(filesInput)
}

function migrationLedgerArtifact(snapshot: RawDatabaseSnapshot) {
  return {
    expectedMigrationId: IMPORT_COMPENSATION_MIGRATION_ID,
    expectedMigrationSha256: IMPORT_COMPENSATION_MIGRATION_SHA256,
    entries: [...snapshot.migrationLedger].sort((left, right) => {
      const leftRecord = requireRecord(left, 'migration ledger entry')
      const rightRecord = requireRecord(right, 'migration ledger entry')
      return (
        compareCodeUnits(String(leftRecord.version ?? ''), String(rightRecord.version ?? '')) ||
        compareCodeUnits(String(leftRecord.name ?? ''), String(rightRecord.name ?? ''))
      )
    }),
  }
}

export function derivePreMigrationBaselineIdentity(
  snapshot: RawDatabaseSnapshot,
): PreMigrationBaselineIdentity {
  return {
    migrationLedgerArtifactSha256: sha256Canonical(migrationLedgerArtifact(snapshot)),
    schemaInventorySha256: sha256Canonical(schemaInventory(snapshot)),
  }
}

export function buildPreMigrationBackup(input: {
  baseline?: PreMigrationBaselineIdentity
  expectedDevelopmentCount?: number
  repository: { head: string; originMain: string }
  snapshot: RawDatabaseSnapshot
}): PreMigrationBackupResult {
  const database = requireRecord(input.snapshot.database, 'snapshot.database')
  if (database.readOnlyTransaction !== true) throw new Error('Backup snapshot was not read-only.')
  const scope = requireRecord(input.snapshot.scope, 'snapshot.scope')
  const batch = requireRecord(scope.batch, 'snapshot.scope.batch')
  const ledgerState = inspectMigrationLedger(input.snapshot.migrationLedger)
  if (ledgerState.versionOccurrences !== 0) {
    throw new Error('Pre-migration backup refused: the contract migration is already recorded.')
  }
  assertAggregateOnlyTestState(input.snapshot.testAggregate)
  const developmentState = projectDevelopmentState(input.snapshot)
  if (
    input.expectedDevelopmentCount !== undefined &&
    developmentState.length !== input.expectedDevelopmentCount
  ) {
    throw new Error(
      `Development membership drift: expected ${input.expectedDevelopmentCount}, received ${developmentState.length}.`,
    )
  }
  const effectiveProjection = effectiveStateProjection(developmentState)
  const physicalProjection = physicalStateProjection(developmentState)
  const revisionAudit = buildRevisionChainAudit(developmentState)
  if (revisionAudit.failureCount > 0)
    throw new Error('Unexpected pre-migration revision-chain drift.')
  assertPreMigrationQueryOnlySecurityState(input.snapshot)
  const inventory = schemaInventory(input.snapshot)
  const ledgerArtifact = migrationLedgerArtifact(input.snapshot)
  const actualBaseline = derivePreMigrationBaselineIdentity(input.snapshot)
  const expectedBaseline = input.baseline ?? {
    migrationLedgerArtifactSha256: PRE_MIGRATION_LEDGER_ARTIFACT_SHA256,
    schemaInventorySha256: PRE_MIGRATION_SCHEMA_INVENTORY_SHA256,
  }
  if (
    actualBaseline.migrationLedgerArtifactSha256 !== expectedBaseline.migrationLedgerArtifactSha256
  ) {
    throw new Error('Pre-migration backup refused migration-ledger baseline drift.')
  }
  if (actualBaseline.schemaInventorySha256 !== expectedBaseline.schemaInventorySha256) {
    throw new Error('Pre-migration backup refused legacy schema/security baseline drift.')
  }
  const inventoryTables = mapObjectArray(inventory.tables, 'schema inventory tables')
  if (
    inventoryTables.some(
      (table) =>
        ['literature_gold_review_operations', 'literature_gold_review_operation_actions'].includes(
          String(table.table_name),
        ) && table.relation_kind !== null,
    )
  ) {
    throw new Error('Pre-migration backup refused unexpected operation-schema drift.')
  }
  const inventoryFunctions = mapObjectArray(inventory.functions, 'schema inventory functions')
  const inventoryColumns = mapObjectArray(inventory.columns, 'schema inventory columns')
  if (
    inventoryFunctions.some((entry) =>
      Object.hasOwn(REQUIRED_TRANSITION_SIGNATURES, String(entry.name)),
    ) ||
    inventoryColumns.some(
      (entry) =>
        entry.table_name === 'literature_gold_set_reviews' &&
        ['revision_kind', 'lifecycle_state', 'operation_action_id'].includes(
          String(entry.column_name),
        ),
    )
  ) {
    throw new Error('Pre-migration backup refused partially installed contract schema.')
  }
  const effectiveStateSha256 = sha256ContractCanonical(effectiveProjection)
  const physicalStateSha256 = sha256Canonical(physicalProjection)
  const reviewRowsSha256 = sha256Canonical(legacyReviewRowsProjection(developmentState))
  const schemaSecurityIdentitySha256 = sha256Canonical(inventory)
  const migrationLedgerSha256 = sha256Canonical(ledgerArtifact)
  const databaseIdentity = {
    databaseName: database.databaseName,
    serverVersionNum: database.serverVersionNum,
    batchId: batch.id,
    batchName: batch.name,
    datasetSplit: 'development',
    developmentMembershipSha256: sha256ContractCanonical(
      developmentMembershipProjection(developmentState),
    ),
  }
  const sourceIdentities = {
    ...AUTHORITATIVE_SOURCE_IDENTITIES,
    contractVersion: 'gold-review-import-compensation/1.0.0',
    disposition: 'V3 sources authoritative; V2 execution package superseded',
  }
  const stateAudit = {
    effectiveStateSha256,
    physicalStateSha256,
    reviewRowsSha256,
    revisionChainAudit: revisionAudit,
  }
  const canonicalReceipt: Record<string, unknown> = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    kind: 'pre_migration_backup',
    mode: 'read_only_dry_run',
    repositoryCommitSha: input.repository.head,
    originMainSha: input.repository.originMain,
    migration: {
      id: IMPORT_COMPENSATION_MIGRATION_ID,
      sha256: IMPORT_COMPENSATION_MIGRATION_SHA256,
      appliedByThisCommand: false,
    },
    databaseIdentity,
    identities: sourceIdentities,
    hashes: {
      effectiveStateSha256,
      migrationLedgerSha256,
      physicalStateSha256,
      reviewRowsSha256,
      schemaSecurityIdentitySha256,
    },
    safety: {
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      remoteDatabaseAccessed: false,
      importExecuted: false,
      compensationExecuted: false,
    },
  }
  const files = canonicalArtifactMap({
    'backup-receipt.json': canonicalReceipt,
    'batch-and-test-lock.json': {
      batch: selectFields(batch, [
        'id',
        'name',
        'kind',
        'status',
        'taxonomy_version',
        'label_schema_version',
        'requested_size',
        'test_percent',
      ]),
      testAggregate: input.snapshot.testAggregate,
    },
    'development-review-state.json': {
      datasetSplit: 'development',
      items: developmentState,
    },
    'development-planning-state.json': buildDevelopmentPlanningState(input.snapshot),
    'development-database-seed.json': buildDevelopmentDatabaseSeed(input.snapshot),
    'migration-ledger.json': ledgerArtifact,
    'repository-database-identities.json': {
      repository: input.repository,
      database: databaseIdentity,
    },
    'schema-inventory.json': inventory,
    'source-identities.json': sourceIdentities,
    'state-audits.json': stateAudit,
  })
  return {
    artifacts: sealArtifacts(files),
    canonicalReceipt,
    effectiveStateSha256,
    physicalStateSha256,
    reviewRowsSha256,
  }
}

export function buildAuditArtifacts(input: {
  audit: AuditResult
  snapshot: RawDatabaseSnapshot
}): CanonicalArtifacts {
  const database = requireRecord(input.audit.report.database, 'audit database')
  const reportedPlanningSha256 = database.developmentPlanningStateSha256
  const files = new Map<string, string>([
    ['migration-audit.json', canonicalJson(input.audit.report)],
    ['migration-audit.md', input.audit.markdown],
  ])
  if (input.audit.schemaSecurityDefinitionIdentity) {
    const actualIdentitySha256 = schemaSecurityDefinitionIdentitySha256(
      input.audit.schemaSecurityDefinitionIdentity,
    )
    if (actualIdentitySha256 !== input.audit.schemaSecurityIdentitySha256) {
      throw new Error('Audit schema/security definition identity binding is inconsistent.')
    }
    files.set(
      'schema-security-definition-identity.json',
      canonicalJson(input.audit.schemaSecurityDefinitionIdentity),
    )
  }
  if (input.audit.report.status === 'ready') {
    const actualPlanningSha256 = developmentPlanningStateSha256(input.snapshot)
    if (reportedPlanningSha256 !== actualPlanningSha256) {
      throw new Error('Ready audit planning-state binding does not match the audited snapshot.')
    }
    files.set(
      'development-planning-state.json',
      canonicalJson(buildDevelopmentPlanningState(input.snapshot)),
    )
  } else if (reportedPlanningSha256 !== null) {
    throw new Error('A non-ready audit cannot claim a development planning-state binding.')
  }
  return sealArtifacts(files)
}

export function buildBackupExecutionReceipt(input: {
  canonicalReceipt: Record<string, unknown>
  container: string
  executedAt: string
  manifestSha256: string
  outputDirectory: string
  repositoryRoot: string
}) {
  assertLocalDatabaseContainer(input.container)
  if (!SHA256_PATTERN.test(input.manifestSha256)) {
    throw new Error('Canonical backup manifest identity is invalid.')
  }
  const receipt = input.canonicalReceipt
  const migration = requireRecord(receipt.migration, 'backup receipt migration')
  const databaseIdentity = requireRecord(
    receipt.databaseIdentity,
    'backup receipt database identity',
  )
  const identities = requireRecord(receipt.identities, 'backup receipt identities')
  const safety = requireRecord(receipt.safety, 'backup receipt safety')
  return {
    schemaVersion: 'gold-import-compensation-backup-execution/1.0.0',
    kind: 'pre_migration_backup_execution',
    executedAt: input.executedAt,
    outputDirectory: input.outputDirectory,
    repositoryRoot: input.repositoryRoot,
    mode: 'read_only_dry_run',
    canonicalManifestSha256: input.manifestSha256,
    repository: {
      commitSha: receipt.repositoryCommitSha,
      originMainSha: receipt.originMainSha,
    },
    database: {
      container: input.container,
      projectId: LOCAL_SUPABASE_PROJECT_ID,
      port: LOCAL_DATABASE_PORT,
      batchId: databaseIdentity.batchId,
      batchName: databaseIdentity.batchName,
      datasetSplit: 'development',
      readOnly: true,
    },
    migration: {
      id: migration.id,
      sha256: migration.sha256,
      applied: false,
    },
    sourceIdentities: identities,
    safety,
  }
}

export async function writeCanonicalPackage(input: {
  artifacts: CanonicalArtifacts
  executionReceipt: Record<string, unknown>
  outputDirectory: string
  outputRoot: string
}): Promise<void> {
  const identity = await createExclusiveOutputDirectory({
    outputDirectory: input.outputDirectory,
    outputRoot: input.outputRoot,
  })
  writeExclusiveOutputFiles(identity, [
    ...[...input.artifacts.files].map(([name, bytes]) => ({
      name,
      bytes: Buffer.from(bytes, 'utf8'),
    })),
    {
      name: 'checksum-manifest.sha256',
      bytes: Buffer.from(input.artifacts.manifest, 'utf8'),
    },
    {
      name: 'execution-receipt.json',
      bytes: Buffer.from(canonicalJson(input.executionReceipt), 'utf8'),
    },
  ])
  await assertExclusiveOutputDirectoryIdentity(identity)
}

function assertCanonicalEqual(actual: unknown, expected: unknown, label: string) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`${label} failed canonical cross-check.`)
  }
}

function parseCanonicalJson(bytes: string, label: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(bytes) as unknown
  } catch (error) {
    throw new Error(
      `${label} contains invalid JSON: ${error instanceof Error ? error.message : String(error)}.`,
    )
  }
  if (canonicalJson(parsed) !== bytes) throw new Error(`${label} bytes are not canonical JSON.`)
  return parsed
}

function sortedRecordsById(records: readonly Record<string, unknown>[]) {
  return [...records].sort((left, right) =>
    compareCodeUnits(requireString(left.id, 'row id'), requireString(right.id, 'row id')),
  )
}

function validateLoadedBackup(input: {
  baseline: PreMigrationBaselineIdentity
  executionReceipt: Record<string, unknown>
  files: ReadonlyMap<string, unknown>
  manifestSha256: string
}): LoadedPreMigrationBackup {
  const parsed = (name: (typeof BACKUP_CANONICAL_FILES)[number]) => {
    const value = input.files.get(name)
    if (value === undefined) throw new Error(`Backup manifest is missing ${name}.`)
    return value
  }
  const receipt = requireRecord(parsed('backup-receipt.json'), 'backup receipt')
  const batchAndTestLock = requireRecord(parsed('batch-and-test-lock.json'), 'batch and test lock')
  const developmentState = requireRecord(
    parsed('development-review-state.json'),
    'development review state',
  )
  const planningState = requireRecord(
    parsed('development-planning-state.json'),
    'development planning state',
  )
  const developmentSeed = requireRecord(
    parsed('development-database-seed.json'),
    'development database seed',
  )
  const migrationLedger = requireRecord(parsed('migration-ledger.json'), 'migration ledger')
  const repositoryDatabaseIdentities = requireRecord(
    parsed('repository-database-identities.json'),
    'repository/database identities',
  )
  const schema = requireRecord(parsed('schema-inventory.json'), 'schema inventory')
  const sourceIdentities = requireRecord(parsed('source-identities.json'), 'source identities')
  const stateAudits = requireRecord(parsed('state-audits.json'), 'state audits')

  if (developmentState.datasetSplit !== 'development') {
    throw new Error('Backup development review state has the wrong dataset split.')
  }
  const developmentRows = mapObjectArray(developmentState.items, 'backup development items')
  assertCanonicalEqual(
    developmentState,
    { datasetSplit: 'development', items: developmentRows },
    'Development review state',
  )
  const projectedState = projectDevelopmentState({
    developmentItems: developmentRows,
  } as RawDatabaseSnapshot)
  const effectiveStateSha256 = sha256ContractCanonical(effectiveStateProjection(projectedState))
  const physicalStateSha256 = sha256Canonical(physicalStateProjection(projectedState))
  const reviewRowsSha256 = sha256Canonical(legacyReviewRowsProjection(projectedState))
  const developmentMembershipSha256 = sha256ContractCanonical(
    developmentMembershipProjection(projectedState),
  )
  const revisionChainAudit = buildRevisionChainAudit(projectedState)
  if (revisionChainAudit.failureCount !== 0) {
    throw new Error('Backup development review state contains revision-chain drift.')
  }
  assertCanonicalEqual(
    stateAudits,
    {
      effectiveStateSha256,
      physicalStateSha256,
      reviewRowsSha256,
      revisionChainAudit,
    },
    'State audits',
  )
  assertCanonicalEqual(
    planningState,
    buildDevelopmentPlanningState({ developmentItems: developmentRows } as RawDatabaseSnapshot),
    'Development planning state',
  )

  const seedTables = requireRecord(developmentSeed.tables, 'development seed tables')
  const seedSnapshot = {
    developmentSeed: {
      literatureArticles: seedTables.literature_articles,
      batches: seedTables.literature_gold_set_batches,
      items: seedTables.literature_gold_set_items,
      reviews: seedTables.literature_gold_set_reviews,
      drafts: seedTables.literature_gold_set_review_drafts,
      events: seedTables.literature_gold_set_events,
    },
  } as unknown as RawDatabaseSnapshot
  assertCanonicalEqual(
    developmentSeed,
    buildDevelopmentDatabaseSeed(seedSnapshot),
    'Development database seed',
  )
  const seedItems = mapObjectArray(
    seedTables.literature_gold_set_items,
    'seed literature_gold_set_items',
  )
  const seedReviews = mapObjectArray(
    seedTables.literature_gold_set_reviews,
    'seed literature_gold_set_reviews',
  )
  const seedEvents = mapObjectArray(
    seedTables.literature_gold_set_events,
    'seed literature_gold_set_events',
  )
  assertCanonicalEqual(
    seedItems,
    projectedState.map(({ item }) => item),
    'Seed/review-state development items',
  )
  assertCanonicalEqual(
    sortedRecordsById(seedReviews),
    sortedRecordsById(projectedState.flatMap(({ reviews }) => reviews)),
    'Seed/review-state review histories',
  )
  assertCanonicalEqual(
    sortedRecordsById(seedEvents.filter((event) => event.item_id !== null)),
    sortedRecordsById(projectedState.flatMap(({ events }) => events)),
    'Seed/review-state item events',
  )

  const ledgerEntries = requireArray(migrationLedger.entries, 'migration ledger entries')
  assertCanonicalEqual(
    migrationLedger,
    {
      expectedMigrationId: IMPORT_COMPENSATION_MIGRATION_ID,
      expectedMigrationSha256: IMPORT_COMPENSATION_MIGRATION_SHA256,
      entries: ledgerEntries,
    },
    'Migration ledger',
  )
  if (inspectMigrationLedger(ledgerEntries).versionOccurrences !== 0) {
    throw new Error('Pre-migration backup ledger contains the target migration version.')
  }
  const migrationLedgerSha256 = sha256Canonical(migrationLedger)
  const schemaSecurityIdentitySha256 = sha256Canonical(schema)
  if (migrationLedgerSha256 !== input.baseline.migrationLedgerArtifactSha256) {
    throw new Error('Backup migration ledger does not match the pinned baseline.')
  }
  if (schemaSecurityIdentitySha256 !== input.baseline.schemaInventorySha256) {
    throw new Error('Backup schema inventory does not match the pinned baseline.')
  }

  const expectedSourceIdentities = {
    ...AUTHORITATIVE_SOURCE_IDENTITIES,
    contractVersion: 'gold-review-import-compensation/1.0.0',
    disposition: 'V3 sources authoritative; V2 execution package superseded',
  }
  assertCanonicalEqual(sourceIdentities, expectedSourceIdentities, 'Source identities')
  const repository = requireRecord(repositoryDatabaseIdentities.repository, 'repository identity')
  const databaseIdentity = requireRecord(repositoryDatabaseIdentities.database, 'database identity')
  const head = requireString(repository.head, 'repository head')
  const originMain = requireString(repository.originMain, 'repository origin/main')
  if (!/^[a-f0-9]{40}$/u.test(head) || head !== originMain) {
    throw new Error('Backup repository identity is not a clean origin/main commit identity.')
  }
  const batch = requireRecord(batchAndTestLock.batch, 'backup batch')
  const testAggregate = requireRecord(batchAndTestLock.testAggregate, 'backup test aggregate')
  assertAggregateOnlyTestState(testAggregate)
  const batchId = requireString(batch.id, 'backup batch id')
  const batchName = requireString(batch.name, 'backup batch name')
  const expectedDatabaseIdentity = {
    databaseName: requireString(databaseIdentity.databaseName, 'backup database name'),
    serverVersionNum: requireString(databaseIdentity.serverVersionNum, 'backup server version'),
    batchId,
    batchName,
    datasetSplit: 'development',
    developmentMembershipSha256,
  }
  if (expectedDatabaseIdentity.databaseName !== 'postgres') {
    throw new Error('Backup database identity is not the pinned local postgres database.')
  }
  if (!expectedDatabaseIdentity.serverVersionNum.startsWith('17')) {
    throw new Error('Backup database identity is not PostgreSQL 17.')
  }
  assertCanonicalEqual(databaseIdentity, expectedDatabaseIdentity, 'Database identity')
  assertCanonicalEqual(
    repositoryDatabaseIdentities,
    { repository: { head, originMain }, database: expectedDatabaseIdentity },
    'Repository/database identities',
  )
  const seedBatches = mapObjectArray(
    seedTables.literature_gold_set_batches,
    'seed literature_gold_set_batches',
  )
  if (seedBatches.length !== 1) throw new Error('Backup seed must contain exactly one batch.')
  assertCanonicalEqual(
    batch,
    selectFields(seedBatches[0], [
      'id',
      'name',
      'kind',
      'status',
      'taxonomy_version',
      'label_schema_version',
      'requested_size',
      'test_percent',
    ]),
    'Backup batch identity',
  )
  assertCanonicalEqual(batchAndTestLock, { batch, testAggregate }, 'Batch and test lock')

  const expectedReceipt = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    kind: 'pre_migration_backup',
    mode: 'read_only_dry_run',
    repositoryCommitSha: head,
    originMainSha: originMain,
    migration: {
      id: IMPORT_COMPENSATION_MIGRATION_ID,
      sha256: IMPORT_COMPENSATION_MIGRATION_SHA256,
      appliedByThisCommand: false,
    },
    databaseIdentity: expectedDatabaseIdentity,
    identities: expectedSourceIdentities,
    hashes: {
      effectiveStateSha256,
      migrationLedgerSha256,
      physicalStateSha256,
      reviewRowsSha256,
      schemaSecurityIdentitySha256,
    },
    safety: {
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      remoteDatabaseAccessed: false,
      importExecuted: false,
      compensationExecuted: false,
    },
  }
  assertCanonicalEqual(receipt, expectedReceipt, 'Backup receipt')

  const execution = input.executionReceipt
  const executedAt = requireString(execution.executedAt, 'backup execution timestamp')
  if (new Date(executedAt).toISOString() !== executedAt) {
    throw new Error('Backup execution timestamp is not canonical ISO-8601.')
  }
  const expectedExecution = buildBackupExecutionReceipt({
    canonicalReceipt: receipt,
    container: DEFAULT_LOCAL_DATABASE_CONTAINER,
    executedAt,
    manifestSha256: input.manifestSha256,
    outputDirectory: requireString(execution.outputDirectory, 'backup execution output directory'),
    repositoryRoot: requireString(execution.repositoryRoot, 'backup execution repository root'),
  })
  assertCanonicalEqual(execution, expectedExecution, 'Backup execution receipt')

  return {
    batchAndTestLock,
    developmentSeed,
    developmentState,
    manifestSha256: input.manifestSha256,
    migrationLedger,
    planningState,
    receipt,
    schemaInventory: schema,
    stateAudits,
  }
}

async function loadAndVerifyBackupWithBaseline(
  directory: string,
  expectedManifestSha256: string,
  baseline: PreMigrationBaselineIdentity,
): Promise<LoadedPreMigrationBackup> {
  if (!SHA256_PATTERN.test(expectedManifestSha256)) {
    throw new Error('Pre-migration backup manifest SHA-256 argument is invalid.')
  }
  const directoryStat = await lstat(directory)
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new Error('Pre-migration backup must be a non-symlink directory.')
  }
  const canonicalDirectory = await realpath(directory)
  const directoryEntries = await readdir(directory, { withFileTypes: true })
  const actualNames = directoryEntries.map((entry) => entry.name).sort(compareCodeUnits)
  const expectedNames = [...BACKUP_DIRECTORY_FILES].sort(compareCodeUnits)
  if (canonicalJson(actualNames) !== canonicalJson(expectedNames)) {
    throw new Error('Backup directory does not contain the exact expected filename set.')
  }
  const readRegularFile = async (name: string) => {
    const path = resolve(directory, name)
    const pathFromDirectory = relative(canonicalDirectory, await realpath(path))
    const stat = await lstat(path)
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      pathFromDirectory !== name ||
      pathFromDirectory.includes(sep)
    ) {
      throw new Error(`Backup file ${name} is not a confined regular non-symlink file.`)
    }
    return readFile(path, 'utf8')
  }

  const manifest = await readRegularFile('checksum-manifest.sha256')
  const manifestSha256 = sha256(manifest)
  if (manifestSha256 !== expectedManifestSha256) {
    throw new Error('Pre-migration backup manifest SHA-256 does not match the trusted argument.')
  }
  const expectedCanonicalNames = new Set<string>(BACKUP_CANONICAL_FILES)
  const manifestNames = new Set<string>()
  const rawFiles = new Map<string, string>()
  for (const line of manifest.split('\n').filter(Boolean)) {
    const match = line.match(/^([a-f0-9]{64})  ([a-z0-9-]+\.json)$/u)
    if (!match) throw new Error('Backup manifest contains an invalid entry.')
    const [, expected, name] = match
    if (!expectedCanonicalNames.has(name) || manifestNames.has(name)) {
      throw new Error('Backup manifest contains a duplicate or unexpected filename.')
    }
    manifestNames.add(name)
    const bytes = await readRegularFile(name)
    if (sha256(bytes) !== expected) throw new Error(`Backup checksum mismatch for ${name}.`)
    rawFiles.set(name, bytes)
  }
  if (
    manifestNames.size !== expectedCanonicalNames.size ||
    [...expectedCanonicalNames].some((name) => !manifestNames.has(name))
  ) {
    throw new Error('Backup manifest does not contain the exact canonical filename set.')
  }
  if (sealArtifacts(rawFiles).manifest !== manifest) {
    throw new Error('Backup manifest bytes are not canonical or deterministically ordered.')
  }
  const parsedFiles = new Map(
    [...rawFiles.entries()].map(([name, bytes]) => [name, parseCanonicalJson(bytes, name)]),
  )
  const executionBytes = await readRegularFile('execution-receipt.json')
  const executionReceipt = requireRecord(
    parseCanonicalJson(executionBytes, 'execution-receipt.json'),
    'execution receipt',
  )
  return validateLoadedBackup({
    baseline,
    executionReceipt,
    files: parsedFiles,
    manifestSha256,
  })
}

/** Operational loader: the trusted manifest digest is required and baseline overrides are forbidden. */
export function loadAndVerifyBackup(
  directory: string,
  expectedManifestSha256: string,
): Promise<LoadedPreMigrationBackup> {
  return loadAndVerifyBackupWithBaseline(directory, expectedManifestSha256, {
    migrationLedgerArtifactSha256: PRE_MIGRATION_LEDGER_ARTIFACT_SHA256,
    schemaInventorySha256: PRE_MIGRATION_SCHEMA_INVENTORY_SHA256,
  })
}

/** Fixture-only baseline injection; operational callers must use loadAndVerifyBackup. */
export function loadAndVerifyBackupFixtureForTest(
  directory: string,
  expectedManifestSha256: string,
  baseline: PreMigrationBaselineIdentity,
): Promise<LoadedPreMigrationBackup> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Fixture baseline injection is restricted to the test environment.')
  }
  return loadAndVerifyBackupWithBaseline(directory, expectedManifestSha256, baseline)
}

function inspectMigrationLedger(ledger: unknown[]) {
  let exactOccurrences = 0
  let versionOccurrences = 0
  let wrongNameOccurrences = 0
  for (const entry of ledger) {
    const record = requireRecord(entry, 'migration ledger entry')
    const version = String(record.version ?? '')
    const name = String(record.name ?? '')
    if (version !== '20260808035633') continue
    versionOccurrences += 1
    if (name === 'add_literature_gold_import_compensation_contract') exactOccurrences += 1
    else wrongNameOccurrences += 1
  }
  return { exactOccurrences, versionOccurrences, wrongNameOccurrences }
}

function protectedIndexSecuritySurvey(
  indexes: Record<string, unknown>[],
  constraints: Record<string, unknown>[],
) {
  const constraintNames = new Set(constraints.map((entry) => String(entry.name)))
  const catalogIndexes = indexes.filter((entry, index) => {
    const constraintBacked =
      entry.constraint_backed === undefined
        ? constraintNames.has(String(entry.name))
        : requireBoolean(entry.constraint_backed, `schema.indexes[${index}].constraint_backed`)
    return !constraintBacked
  })
  const matchesExpectedIndex = (
    entry: Record<string, unknown>,
    expected: (typeof EXPECTED_PROTECTED_NON_CONSTRAINT_INDEXES)[number],
  ) =>
    entry.name === expected.name &&
    entry.table_name === expected.tableName &&
    entry.is_unique === expected.unique &&
    entry.is_valid === true
  const detailedIndexes = catalogIndexes.filter((entry) =>
    REQUIRED_UNIQUE_INDEXES.includes(
      String(entry.name) as (typeof REQUIRED_UNIQUE_INDEXES)[number],
    ),
  )
  const driftIndexes = catalogIndexes.filter(
    (entry) =>
      !EXPECTED_PROTECTED_NON_CONSTRAINT_INDEXES.some((expected) =>
        matchesExpectedIndex(entry, expected),
      ),
  )
  const missingIndexes = EXPECTED_PROTECTED_NON_CONSTRAINT_INDEXES.filter(
    (expected) => !catalogIndexes.some((entry) => matchesExpectedIndex(entry, expected)),
  ).map((expected) => ({
    name: `__missing_expected_index__:${expected.name}`,
    table_name: expected.tableName,
    is_unique: expected.unique,
    is_valid: false,
    predicate: null,
    definition: `MISSING EXPECTED INDEX ${expected.name}`,
  }))

  return [...detailedIndexes, ...driftIndexes, ...missingIndexes].map((entry) => ({
    name: entry.name,
    tableName: entry.table_name,
    unique: entry.is_unique,
    valid: entry.is_valid,
    constraintBacked: false,
    predicate: entry.predicate,
    definition: entry.definition,
  }))
}

function toSecurityIntrospection(schema: Record<string, unknown>) {
  const tables = mapObjectArray(schema.tables, 'schema.tables')
  const functions = mapObjectArray(schema.functions, 'schema.functions')
  const constraints = mapObjectArray(schema.constraints, 'schema.constraints')
  const indexes = mapObjectArray(schema.indexes, 'schema.indexes')
  const triggers = mapObjectArray(schema.triggers, 'schema.triggers')
  const policies = mapObjectArray(schema.policies, 'schema.policies')
  const tablePrivileges = mapObjectArray(schema.tablePrivileges, 'schema.tablePrivileges')
  const schemaCreatePrivileges = mapObjectArray(
    schema.schemaCreatePrivileges,
    'schema.schemaCreatePrivileges',
  )
  const granted = (table: string, role: string, privilege: string) =>
    tablePrivileges.find(
      (entry) =>
        entry.table_name === table &&
        entry.role_name === role &&
        entry.privilege_name === privilege,
    )?.granted === true
  const privilegeObject = (table: string) => ({
    publicInsert: granted(table, 'public', 'INSERT'),
    publicUpdate: granted(table, 'public', 'UPDATE'),
    publicDelete: granted(table, 'public', 'DELETE'),
    publicTruncate: granted(table, 'public', 'TRUNCATE'),
    publicReferences: granted(table, 'public', 'REFERENCES'),
    publicTrigger: granted(table, 'public', 'TRIGGER'),
    anonInsert: granted(table, 'anon', 'INSERT'),
    anonUpdate: granted(table, 'anon', 'UPDATE'),
    anonDelete: granted(table, 'anon', 'DELETE'),
    anonTruncate: granted(table, 'anon', 'TRUNCATE'),
    anonReferences: granted(table, 'anon', 'REFERENCES'),
    anonTrigger: granted(table, 'anon', 'TRIGGER'),
    authenticatedInsert: granted(table, 'authenticated', 'INSERT'),
    authenticatedUpdate: granted(table, 'authenticated', 'UPDATE'),
    authenticatedDelete: granted(table, 'authenticated', 'DELETE'),
    authenticatedTruncate: granted(table, 'authenticated', 'TRUNCATE'),
    authenticatedReferences: granted(table, 'authenticated', 'REFERENCES'),
    authenticatedTrigger: granted(table, 'authenticated', 'TRIGGER'),
    serviceRoleSelect: granted(table, 'service_role', 'SELECT'),
    serviceRoleInsert: granted(table, 'service_role', 'INSERT'),
    serviceRoleUpdate: granted(table, 'service_role', 'UPDATE'),
    serviceRoleDelete: granted(table, 'service_role', 'DELETE'),
    serviceRoleTruncate: granted(table, 'service_role', 'TRUNCATE'),
    serviceRoleReferences: granted(table, 'service_role', 'REFERENCES'),
    serviceRoleTrigger: granted(table, 'service_role', 'TRIGGER'),
  })
  return {
    rls: tables.map((table) => ({
      tableName: table.table_name,
      rlsEnabled: table.rls_enabled,
      rlsForced: table.force_rls,
    })),
    functions: functions
      .filter((entry) => Object.hasOwn(REQUIRED_TRANSITION_SIGNATURES, String(entry.name)))
      .map((entry) => ({
        name: entry.name,
        identityArguments: entry.identity_arguments,
        resultType: entry.result_type,
        volatility: entry.volatility,
        owner: entry.owner,
        securityDefiner: entry.security_definer,
        searchPath: entry.search_path,
        definition: entry.definition,
        publicExecute: entry.public_execute,
        anonExecute: entry.anon_execute,
        authenticatedExecute: entry.authenticated_execute,
        serviceRoleExecute: entry.service_role_execute,
      })),
    reviewPrivileges: privilegeObject('literature_gold_set_reviews'),
    eventPrivileges: privilegeObject('literature_gold_set_events'),
    journalPrivileges: [
      'literature_gold_review_operation_actions',
      'literature_gold_review_operations',
    ].flatMap((tableName) =>
      ['public', 'anon', 'authenticated', 'service_role'].map((role) => ({
        tableName,
        role,
        select: granted(tableName, role, 'SELECT'),
        insert: granted(tableName, role, 'INSERT'),
        update: granted(tableName, role, 'UPDATE'),
        delete: granted(tableName, role, 'DELETE'),
        truncate: granted(tableName, role, 'TRUNCATE'),
        references: granted(tableName, role, 'REFERENCES'),
        trigger: granted(tableName, role, 'TRIGGER'),
      })),
    ),
    schemaCreatePrivileges: schemaCreatePrivileges.map((entry) => ({
      schemaName: entry.schema_name,
      owner: entry.owner,
      role: entry.role_name,
      create: entry.granted,
    })),
    constraints: constraints.map((entry) => entry.name),
    constraintDefinitions: constraints.map((entry) => ({
      name: entry.name,
      tableName: entry.table_name,
      definition: entry.definition,
      validated: entry.validated,
    })),
    uniqueIndexes: protectedIndexSecuritySurvey(indexes, constraints),
    journalPolicies: policies.map((entry) => ({
      name: entry.name,
      tableName: entry.table_name,
      command: entry.command,
      permissive: entry.permissive,
      roles: entry.roles,
      using: entry.using_expression,
      withCheck: entry.with_check_expression,
    })),
    triggers: triggers.map((entry) => ({
      name: entry.name,
      tableName: entry.table_name,
      enableMode: entry.enable_mode,
      enabled: entry.enabled,
      definition: entry.definition,
    })),
    supportedEventTypes: schema.supportedEventTypes,
    catalog: {
      tables,
      columns: mapObjectArray(schema.columns, 'schema.columns'),
      columnPrivileges: mapObjectArray(schema.columnPrivileges, 'schema.columnPrivileges'),
      functions,
      constraints,
      indexes,
      triggers,
      policies,
      tablePrivileges,
      schemaCreatePrivileges,
      tableAclEntries: mapObjectArray(schema.tableAclEntries, 'schema.tableAclEntries'),
      columnAclEntries: mapObjectArray(schema.columnAclEntries, 'schema.columnAclEntries'),
      functionAclEntries: mapObjectArray(schema.functionAclEntries, 'schema.functionAclEntries'),
      schemaAclEntries: mapObjectArray(schema.schemaAclEntries, 'schema.schemaAclEntries'),
      supportedEventTypes: schema.supportedEventTypes,
    },
  }
}

/**
 * Build the complete schema/security definition inventory from a read-only
 * snapshot without applying the legacy owner-specific readiness validator.
 * Post-migration reconciliation uses this to classify an exact inventory
 * before selecting a fail-closed deployment profile.
 */
export function buildSchemaSecurityDefinitionIdentityFromSnapshot(
  snapshot: RawDatabaseSnapshot,
): SchemaSecurityDefinitionIdentity {
  return buildSchemaSecurityDefinitionIdentity(
    toSecurityIntrospection(requireRecord(snapshot.schema, 'snapshot.schema')),
  )
}

function pointerMutationCount(
  beforeItems: ReturnType<typeof projectDevelopmentState>,
  afterItems: ReturnType<typeof projectDevelopmentState>,
) {
  const before = new Map(
    beforeItems.map(({ item }) => [String(item.id), item.current_review_id ?? null]),
  )
  const after = new Map(
    afterItems.map(({ item }) => [String(item.id), item.current_review_id ?? null]),
  )
  return new Set([...before.keys(), ...after.keys()]).size === 0
    ? 0
    : [...new Set([...before.keys(), ...after.keys()])].filter(
        (itemId) =>
          !before.has(itemId) || !after.has(itemId) || before.get(itemId) !== after.get(itemId),
      ).length
}

function reviewMutationCount(
  beforeItems: ReturnType<typeof projectDevelopmentState>,
  afterItems: ReturnType<typeof projectDevelopmentState>,
) {
  const indexed = (items: ReturnType<typeof projectDevelopmentState>, label: string) => {
    const records = new Map<string, string>()
    for (const { reviews } of items) {
      for (const review of reviews) {
        const id = requireString(review.id, `${label} review id`)
        if (records.has(id)) throw new Error(`${label} contains duplicate review IDs.`)
        records.set(id, canonicalJson(selectFields(review, LEGACY_REVIEW_FIELDS)))
      }
    }
    return records
  }
  const before = indexed(beforeItems, 'pre-migration state')
  const after = indexed(afterItems, 'post-migration state')
  return [...new Set([...before.keys(), ...after.keys()])].filter(
    (reviewId) =>
      !before.has(reviewId) || !after.has(reviewId) || before.get(reviewId) !== after.get(reviewId),
  ).length
}

function auditMarkdown(report: Record<string, unknown>) {
  const migration = requireRecord(report.migration, 'audit.migration')
  const database = requireRecord(report.database, 'audit.database')
  return `# Gold import-compensation migration audit

- Status: \`${String(report.status)}\`
- Readiness: \`${String(report.readinessStatus)}\`
- Migration applied: \`${String(migration.applied)}\`
- Migration ledger occurrences: \`${String(migration.ledgerOccurrences)}\`
- Database mutation count: \`0\`
- Development effective state: \`${String(database.currentEffectiveStateSha256)}\`
- Development physical/audit state: \`${String(database.currentPhysicalStateSha256)}\`
- Held-out identities accessed: \`false\`
- Import executed: \`false\`
- Compensation executed: \`false\`
`
}

export function auditPostMigration(input: {
  contractStateHashes?: ContractStateHashes
  contractStateHashesBefore?: ContractStateHashes
  testOnlyExpectedSchemaSecurityIdentitySha256?: string
  lint?: unknown
  preMigration: {
    batchAndTestLock: Record<string, unknown>
    developmentState: Record<string, unknown>
    manifestSha256?: string
    migrationLedger: Record<string, unknown>
    receipt: Record<string, unknown>
    schemaInventory: Record<string, unknown>
    stateAudits: Record<string, unknown>
  }
  repositoryCommitSha: string
  snapshot: RawDatabaseSnapshot
}): AuditResult {
  if (
    input.testOnlyExpectedSchemaSecurityIdentitySha256 !== undefined &&
    process.env.NODE_ENV !== 'test'
  ) {
    throw new Error(
      'The schema/security identity override is test-only; production audits use the code-pinned identity.',
    )
  }
  const expectedSchemaSecurityIdentitySha256 =
    input.testOnlyExpectedSchemaSecurityIdentitySha256 ??
    POST_MIGRATION_SCHEMA_SECURITY_IDENTITY_SHA256
  assertAggregateOnlyTestState(input.snapshot.testAggregate)
  const postItems = projectDevelopmentState(input.snapshot)
  const projectedPostEffectiveSha256 = sha256ContractCanonical(effectiveStateProjection(postItems))
  const postLegacyPhysicalSha256 = sha256Canonical(physicalStateProjection(postItems))
  const projectedMembershipSha256 = sha256ContractCanonical(
    developmentMembershipProjection(postItems),
  )
  const postRevisionAudit = buildRevisionChainAudit(postItems)
  const preItems = mapObjectArray(
    input.preMigration.developmentState.items,
    'preMigration.items',
  ).map((entry, index) => ({
    item: requireRecord(entry.item, `preMigration.items[${index}].item`),
    reviews: mapObjectArray(entry.reviews, `preMigration.items[${index}].reviews`),
    events: mapObjectArray(entry.events, `preMigration.items[${index}].events`),
  }))
  const preEffectiveSha256 = requireString(
    input.preMigration.stateAudits.effectiveStateSha256,
    'pre effective hash',
  )
  const prePhysicalSha256 = requireString(
    input.preMigration.stateAudits.physicalStateSha256,
    'pre physical hash',
  )
  const migrationLedgerState = inspectMigrationLedger(input.snapshot.migrationLedger)
  const migrationOccurrences = migrationLedgerState.exactOccurrences
  const schema = schemaInventory(input.snapshot)
  const tables = mapObjectArray(schema.tables, 'schema.tables')
  const operationTablesPresent = [
    'literature_gold_review_operations',
    'literature_gold_review_operation_actions',
  ].some((name) => tables.some((entry) => entry.table_name === name && entry.relation_kind === 'r'))
  const functions = mapObjectArray(schema.functions, 'schema.functions')
  const operationFunctionsPresent = Object.keys(REQUIRED_TRANSITION_SIGNATURES).some((name) =>
    functions.some((entry) => entry.name === name),
  )
  const migrationApplied =
    migrationLedgerState.versionOccurrences === 1 && migrationOccurrences === 1
  const partialSchema = operationTablesPresent || operationFunctionsPresent
  let status: 'blocked' | 'not_yet_migrated' | 'ready'
  const failures: string[] = []
  let security: unknown = null
  let lint: unknown = null
  let schemaSecurityDefinitionIdentity: SchemaSecurityDefinitionIdentity | null = null
  let postSchemaSecurityIdentitySha256: string | null = null
  let preMigrationQueryOnlySecurityStateSafe = true

  const preReceiptHashes = requireRecord(
    input.preMigration.receipt.hashes,
    'pre-migration receipt hashes',
  )
  const preSchemaSecurityIdentitySha256 = requireString(
    preReceiptHashes.schemaSecurityIdentitySha256,
    'pre-migration schema/security identity',
  )
  const currentSchemaSecurityIdentitySha256 = sha256Canonical(schema)
  const preLedgerEntries = requireArray(
    input.preMigration.migrationLedger.entries,
    'pre-migration ledger entries',
  )
  const postPriorLedgerEntries = input.snapshot.migrationLedger.filter((entry) => {
    const record = requireRecord(entry, 'post-migration ledger entry')
    return String(record.version ?? '') !== '20260808035633'
  })
  const priorLedgerRowsUnchanged =
    canonicalJson(preLedgerEntries) === canonicalJson(postPriorLedgerEntries)

  if (!migrationApplied) {
    try {
      assertPreMigrationQueryOnlySecurityState(input.snapshot)
    } catch (error) {
      preMigrationQueryOnlySecurityStateSafe = false
      failures.push(error instanceof Error ? error.message : String(error))
    }
    if (
      migrationLedgerState.versionOccurrences > 0 ||
      partialSchema ||
      !preMigrationQueryOnlySecurityStateSafe ||
      currentSchemaSecurityIdentitySha256 !== preSchemaSecurityIdentitySha256 ||
      !priorLedgerRowsUnchanged
    ) {
      status = 'blocked'
      failures.push(
        'Migration ledger/schema drift: the contract is partially or multiply installed.',
      )
    } else {
      status = 'not_yet_migrated'
    }
  } else {
    status = 'ready'
    if (
      !input.preMigration.manifestSha256 ||
      !SHA256_PATTERN.test(input.preMigration.manifestSha256)
    ) {
      failures.push('Checksum-bound pre-migration backup manifest identity is required.')
    }
    try {
      const securityIntrospection = toSecurityIntrospection(
        requireRecord(input.snapshot.schema, 'snapshot.schema'),
      )
      schemaSecurityDefinitionIdentity =
        buildSchemaSecurityDefinitionIdentity(securityIntrospection)
      postSchemaSecurityIdentitySha256 = schemaSecurityDefinitionIdentitySha256(
        schemaSecurityDefinitionIdentity,
      )
      security = validateSecurityIntrospection(securityIntrospection, {
        expectedSchemaSecurityIdentitySha256,
      })
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error))
    }
    for (const [name, expectedSignature] of Object.entries(REQUIRED_TRANSITION_SIGNATURES)) {
      const overloads = functions.filter((entry) => entry.name === name)
      const functionRecord = overloads[0]
      const expectedVolatility = name.startsWith('reconcile_') ? 's' : 'v'
      if (overloads.length !== 1 || functionRecord?.identity_arguments !== expectedSignature) {
        failures.push(`RPC signature mismatch for ${name}.`)
      }
      if (
        functionRecord?.result_type !== 'jsonb' ||
        functionRecord.volatility !== expectedVolatility ||
        functionRecord.security_definer !== true ||
        functionRecord.owner !== 'supabase_admin' ||
        functionRecord.search_path !== 'pg_catalog, public, extensions'
      ) {
        failures.push(`RPC execution contract mismatch for ${name}.`)
      }
    }
    const tablePrivileges = mapObjectArray(schema.tablePrivileges, 'schema.tablePrivileges')
    for (const tableName of [
      'literature_gold_review_operation_actions',
      'literature_gold_review_operations',
    ]) {
      for (const roleName of ['public', 'anon', 'authenticated', 'service_role']) {
        for (const privilegeName of ['REFERENCES', 'TRIGGER']) {
          if (
            tablePrivileges.some(
              (entry) =>
                entry.table_name === tableName &&
                entry.role_name === roleName &&
                entry.privilege_name === privilegeName &&
                entry.granted === true,
            )
          ) {
            failures.push(
              `Prohibited journal privilege: ${tableName} ${roleName} ${privilegeName}.`,
            )
          }
        }
      }
    }
    const columns = mapObjectArray(schema.columns, 'schema.columns')
    for (const columnName of [
      'revision_kind',
      'lifecycle_state',
      'operation_action_id',
      'compensates_review_id',
      'effective_source_review_id',
    ]) {
      if (
        !columns.some(
          (entry) =>
            entry.table_name === 'literature_gold_set_reviews' && entry.column_name === columnName,
        )
      ) {
        failures.push(`Required review lifecycle column is missing: ${columnName}.`)
      }
    }
    const effectiveFunction = functions.find(
      (entry) => entry.name === 'literature_gold_effective_state_hash_v1',
    )
    const effectiveDefinition = String(effectiveFunction?.definition ?? '')
    if (
      !effectiveDefinition.includes("head.lifecycle_state = 'withdrawn'") ||
      !effectiveDefinition.includes('coalesce(head.effective_source_review_id, head.id)')
    ) {
      failures.push('Effective-review resolution does not cover restored and withdrawn heads.')
    }
    const ordinaryReviewFunction = functions.find(
      (entry) => entry.name === 'save_literature_gold_review_v1',
    )
    const ordinaryReviewDefinition = String(ordinaryReviewFunction?.definition ?? '')
    if (
      !ordinaryReviewDefinition.includes('supersedes_review_id') ||
      !ordinaryReviewDefinition.includes('current_review_id')
    ) {
      failures.push('Standard uncompensated review behavior is not chain-head compatible.')
    }
    if (input.lint === undefined) {
      failures.push('Supabase lint evidence is required after migration.')
    } else {
      try {
        lint = validateSupabaseLint(input.lint)
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error))
      }
    }
    if (!input.contractStateHashes) {
      failures.push('Actual contract state hashes are required after migration.')
    } else {
      if (input.contractStateHashes.effectiveStateSha256 !== projectedPostEffectiveSha256) {
        failures.push('Database and runtime effective-state hashes disagree.')
      }
      if (input.contractStateHashes.developmentMembershipSha256 !== projectedMembershipSha256) {
        failures.push('Database and runtime development-membership hashes disagree.')
      }
    }
    if (!input.contractStateHashesBefore) {
      failures.push('A pre-snapshot contract state-hash bracket is required after migration.')
    } else if (
      !input.contractStateHashes ||
      input.contractStateHashesBefore.developmentMembershipSha256 !==
        input.contractStateHashes.developmentMembershipSha256 ||
      input.contractStateHashesBefore.effectiveStateSha256 !==
        input.contractStateHashes.effectiveStateSha256 ||
      input.contractStateHashesBefore.physicalStateSha256 !==
        input.contractStateHashes.physicalStateSha256
    ) {
      failures.push('Contract membership/effective/physical state changed during the audit.')
    }
    if (!priorLedgerRowsUnchanged) {
      failures.push('Preexisting migration-ledger rows changed.')
    }
    if (failures.length > 0) status = 'blocked'
  }

  const reviewChanges = reviewMutationCount(preItems, postItems)
  const pointerChanges = pointerMutationCount(preItems, postItems)
  const preTestAggregate = requireRecord(
    input.preMigration.batchAndTestLock.testAggregate,
    'pre test aggregate',
  )
  const testAggregateUnchanged =
    canonicalJson(preTestAggregate) === canonicalJson(input.snapshot.testAggregate)
  if (migrationApplied) {
    if (input.contractStateHashes?.effectiveStateSha256 !== preEffectiveSha256) {
      failures.push('Effective review state changed.')
    }
    if (postLegacyPhysicalSha256 !== prePhysicalSha256) {
      failures.push('Prior physical/audit rows changed.')
    }
    if (reviewChanges !== 0) failures.push('Prior review histories changed.')
    if (pointerChanges !== 0) failures.push('Current-review pointers changed.')
    if (!testAggregateUnchanged) failures.push('Aggregate test-lock state changed.')
    if (
      !postRevisionAudit.revisionChainsLinear ||
      !postRevisionAudit.currentPointersAreLatestHeads
    ) {
      failures.push('Revision-chain/current-head invariant failed.')
    }
    if (failures.length > 0) status = 'blocked'
  }

  const schemaSecurityIdentitySha256 =
    migrationApplied && postSchemaSecurityIdentitySha256
      ? postSchemaSecurityIdentitySha256
      : currentSchemaSecurityIdentitySha256
  const scope = requireRecord(input.snapshot.scope, 'snapshot.scope')
  const batch = requireRecord(scope.batch, 'snapshot.scope.batch')
  const currentEffectiveStateSha256 =
    input.contractStateHashes?.effectiveStateSha256 ?? projectedPostEffectiveSha256
  const currentPhysicalStateSha256 =
    input.contractStateHashes?.physicalStateSha256 ?? postLegacyPhysicalSha256
  const developmentMembershipSha256 =
    input.contractStateHashes?.developmentMembershipSha256 ?? projectedMembershipSha256
  const developmentPlanningSha256 =
    status === 'ready' ? developmentPlanningStateSha256(input.snapshot) : null
  const database = {
    batchId: batch.id,
    currentEffectiveStateSha256,
    currentPhysicalStateSha256,
    currentPointersAreLatestHeads: postRevisionAudit.currentPointersAreLatestHeads,
    developmentMembershipSha256,
    developmentPlanningStateSha256: developmentPlanningSha256,
    heldOutIdentitiesAccessed: false,
    readOnlyAudit: true,
    remoteWritesAllowed: false,
    repositoryCommitSha: input.repositoryCommitSha,
    preMigrationBackupManifestSha256: input.preMigration.manifestSha256 ?? null,
    revisionChainsLinear: postRevisionAudit.revisionChainsLinear,
    schemaSecurityIdentitySha256,
    stateFresh: migrationApplied
      ? input.contractStateHashesBefore !== undefined &&
        input.contractStateHashes !== undefined &&
        input.contractStateHashes.effectiveStateSha256 === projectedPostEffectiveSha256 &&
        input.contractStateHashes.developmentMembershipSha256 === projectedMembershipSha256 &&
        input.contractStateHashesBefore.effectiveStateSha256 ===
          input.contractStateHashes.effectiveStateSha256 &&
        input.contractStateHashesBefore.developmentMembershipSha256 ===
          input.contractStateHashes.developmentMembershipSha256 &&
        input.contractStateHashesBefore.physicalStateSha256 ===
          input.contractStateHashes.physicalStateSha256
      : currentSchemaSecurityIdentitySha256 === preSchemaSecurityIdentitySha256 &&
        priorLedgerRowsUnchanged &&
        preMigrationQueryOnlySecurityStateSafe,
    targetDatabase: 'local',
    testSplitLocked: requireBoolean(input.snapshot.testAggregate.locked, 'testAggregate.locked'),
  }
  const report: Record<string, unknown> = {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    status,
    readinessStatus: status,
    migration: {
      applied: migrationApplied,
      id: IMPORT_COMPENSATION_MIGRATION_ID,
      ledgerOccurrences: migrationOccurrences,
      sha256: IMPORT_COMPENSATION_MIGRATION_SHA256,
    },
    database,
    comparisons: {
      preEffectiveStateSha256: preEffectiveSha256,
      postEffectiveStateSha256: currentEffectiveStateSha256,
      effectiveStatePreserved: preEffectiveSha256 === currentEffectiveStateSha256,
      preexistingPhysicalStateBeforeSha256: prePhysicalSha256,
      preexistingPhysicalStateAfterSha256: postLegacyPhysicalSha256,
      priorPhysicalStatePreserved: prePhysicalSha256 === postLegacyPhysicalSha256,
      postContractPhysicalStateSha256: currentPhysicalStateSha256,
      preSchemaSecurityIdentitySha256,
      postSchemaSecurityIdentitySha256: schemaSecurityIdentitySha256,
      schemaChangedAsExpected:
        migrationApplied &&
        postSchemaSecurityIdentitySha256 === expectedSchemaSecurityIdentitySha256,
      reviewMutationCount: reviewChanges,
      pointerMutationCount: pointerChanges,
      priorMigrationLedgerRowsUnchanged: priorLedgerRowsUnchanged,
      aggregateTestLockStateUnchanged: testAggregateUnchanged,
    },
    checks: {
      failures,
      security,
      schemaSecurityDefinitionIdentity,
      expectedSchemaSecurityIdentitySha256: migrationApplied
        ? expectedSchemaSecurityIdentitySha256
        : null,
      lint,
      behavioralProbe: 'none_on_real_batch_static_contract_and_snapshot_only',
      importExecuted: false,
      compensationExecuted: false,
      databaseMutationCount: 0,
    },
  }
  return {
    report,
    markdown: auditMarkdown(report),
    schemaSecurityDefinitionIdentity,
    schemaSecurityIdentitySha256,
  }
}

export async function runLocalSupabaseLint(input: {
  cwd: string
  dockerTarget?: LocalDockerTarget
  runCommand?: CommandRunner
}): Promise<unknown> {
  const runCommand = input.runCommand ?? defaultCommandRunner
  const target = input.dockerTarget ?? (await resolveLocalDockerTarget({ runCommand }))
  const workdir = resolve(input.cwd, 'local-data/literature/supabase-local')
  const result = await runCommand(
    'npx',
    [
      '--no-install',
      'supabase',
      '--workdir',
      workdir,
      'db',
      'lint',
      '--local',
      '--schema',
      'public',
      '--level',
      'warning',
      '--fail-on',
      'none',
      '--output',
      'json',
    ],
    { cwd: input.cwd, env: operationalEnvironmentForDockerTarget(target) },
  )
  try {
    return JSON.parse(result.stdout) as unknown
  } catch (error) {
    throw new Error(
      `Supabase lint did not return JSON: ${error instanceof Error ? error.message : String(error)}.`,
    )
  }
}

export function validateSha256Argument(actual: string, expected: string, label: string) {
  if (!SHA256_PATTERN.test(actual) || actual !== expected) {
    throw new Error(`${label} must equal the authoritative SHA-256 ${expected}.`)
  }
}
