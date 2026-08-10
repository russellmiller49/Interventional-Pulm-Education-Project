import { createHash } from 'node:crypto'

import {
  DEFAULT_LOCAL_DATABASE_CONTAINER,
  LOCAL_DATABASE_PORT,
  LOCAL_SUPABASE_PROJECT_ID,
  assertLocalDatabaseHealthy,
  defaultCommandRunner,
  resolveLocalDockerTarget,
  type CommandRunner,
  type LocalDockerTarget,
} from './gold-import-compensation-migration-operations'

export const PROTECTED_GOLD_IMPORT_CONTRACT_V2 = {
  filename: '20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
  id: '20260809231651_add_literature_gold_import_compensation_contract_v2',
  migrationName: 'add_literature_gold_import_compensation_contract_v2',
  sha256: '3f34934391b3c1ca3ff2ab96c103fe64f05fc29e7b2e0d8375dd6742401995b1',
  version: '20260809231651',
} as const

export const PROTECTED_GOLD_IMPORT_CONTRACT_V1 = {
  filename: '20260808035633_add_literature_gold_import_compensation_contract.sql',
  migrationName: 'add_literature_gold_import_compensation_contract',
  sha256: 'e846ef70a7b484460682a7ff61d579d3d6fdae3400805fa5395adc0464244528',
  version: '20260808035633',
} as const

export const PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER = {
  filename: '20260809231651_verify_literature_gold_import_compensation_contract_v2.sql',
  sha256: '2570f0885ed646247df7dd3e375b835c7591f2750bc190d63845191cd0426eeb',
} as const

export const PROTECTED_V2_CONFIRMATION =
  'APPLY PROTECTED LITERATURE GOLD IMPORT CONTRACT V2 EXACTLY ONCE' as const
export const PROTECTED_V2_AUTHORIZATION_SCHEMA_VERSION =
  'literature-gold-protected-v2-migration-authorization/1.0.0' as const
export const PROTECTED_V2_AUTHORIZED_CAPABILITY =
  'apply_protected_contract_v2_migration_exactly_once' as const
export const PROTECTED_V2_FORBIDDEN_CAPABILITIES = [
  'apply_literature_gold_import',
  'compensate_literature_gold_import',
] as const

export interface ProtectedMigrationLedgerEntry {
  name: string
  version: string
}

export type ProtectedV2LedgerClassification =
  | {
      kind: 'v2_absent'
      relevantEntries: readonly ProtectedMigrationLedgerEntry[]
    }
  | {
      kind: 'v2_applied_exactly_once'
      relevantEntries: readonly ProtectedMigrationLedgerEntry[]
    }
  | {
      kind: 'v2_drifted_or_ambiguous'
      reason: string
      relevantEntries: readonly ProtectedMigrationLedgerEntry[]
    }

export type ProtectedV2State =
  | {
      kind: 'v2_absent_unarmed'
      ledger: Extract<ProtectedV2LedgerClassification, { kind: 'v2_absent' }>
    }
  | {
      authorization: ProtectedV2OperatorAuthorization
      kind: 'v2_absent_explicitly_armed'
      ledger: Extract<ProtectedV2LedgerClassification, { kind: 'v2_absent' }>
    }
  | {
      kind: 'v2_applied_exactly_once'
      ledger: Extract<ProtectedV2LedgerClassification, { kind: 'v2_applied_exactly_once' }>
    }
  | {
      kind: 'v2_drifted_or_ambiguous'
      ledger: Extract<ProtectedV2LedgerClassification, { kind: 'v2_drifted_or_ambiguous' }>
    }

export interface ProtectedV2BackupBinding {
  backupInstanceId: string
  backupRoot: string
  canonicalManifestSha256: string
  directory: string
  executedAt: string
  executionReceiptSha256: string
}

export interface ProtectedV2AuthorizationContext {
  backups: readonly [ProtectedV2BackupBinding, ProtectedV2BackupBinding]
  database: {
    container: typeof DEFAULT_LOCAL_DATABASE_CONTAINER
    developmentMembershipSha256: string
    developmentPlanningStateSha256: string
    effectiveStateSha256: string
    physicalStateSha256: string
    port: typeof LOCAL_DATABASE_PORT
    projectId: typeof LOCAL_SUPABASE_PROJECT_ID
    target: 'local'
    v1Occurrence: 1
    v2Occurrence: 0
  }
  migration: typeof PROTECTED_GOLD_IMPORT_CONTRACT_V2
  repository: {
    branch: 'main'
    head: string
    originMain: string
    statusCleanIncludingUntracked: true
  }
  safety: {
    heldOutIdentitiesAccessed: false
    remoteDatabaseAccessed: false
  }
}

export interface ProtectedV2OperatorAuthorization {
  authorizedCapability: typeof PROTECTED_V2_AUTHORIZED_CAPABILITY
  confirmation: typeof PROTECTED_V2_CONFIRMATION
  context: ProtectedV2AuthorizationContext
  contentSha256: string
  forbiddenCapabilities: typeof PROTECTED_V2_FORBIDDEN_CAPABILITIES
  operator: string
  requestedAt: string
  schemaVersion: typeof PROTECTED_V2_AUTHORIZATION_SCHEMA_VERSION
}

const LEDGER_MARKER = 'LITERATURE_PROTECTED_V2_LEDGER_JSON:'
const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u

function compareCodeUnits(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical JSON rejects non-finite numbers.')
    return value
  }
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Canonical JSON rejects ${typeof value}.`)
  }
  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(record)
      .sort(compareCodeUnits)
      .map((key) => {
        if (record[key] === undefined)
          throw new Error(`Canonical JSON rejects undefined at ${key}.`)
        return [key, canonicalValue(record[key])]
      }),
  )
}

function canonicalJson(value: unknown) {
  return `${JSON.stringify(canonicalValue(value), null, 2)}\n`
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function assertSha256(value: string, label: string) {
  if (!SHA256_PATTERN.test(value)) throw new Error(`${label} must be a lowercase SHA-256.`)
}

function normalizedLedgerEntry(value: unknown, index: number): ProtectedMigrationLedgerEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Protected migration ledger row ${index} must be an object.`)
  }
  const row = value as Record<string, unknown>
  if (typeof row.version !== 'string' || typeof row.name !== 'string') {
    throw new Error(`Protected migration ledger row ${index} has malformed identity fields.`)
  }
  return { name: row.name, version: row.version }
}

export function classifyProtectedV2Ledger(
  entries: readonly ProtectedMigrationLedgerEntry[],
): ProtectedV2LedgerClassification {
  const relevantEntries = entries
    .filter(
      ({ name, version }) =>
        name === PROTECTED_GOLD_IMPORT_CONTRACT_V2.migrationName ||
        version === PROTECTED_GOLD_IMPORT_CONTRACT_V2.version,
    )
    .map(({ name, version }) => ({ name, version }))
    .sort(
      (left, right) =>
        compareCodeUnits(left.version, right.version) || compareCodeUnits(left.name, right.name),
    )
  if (relevantEntries.length === 0) return { kind: 'v2_absent', relevantEntries }
  if (
    relevantEntries.length === 1 &&
    relevantEntries[0]?.version === PROTECTED_GOLD_IMPORT_CONTRACT_V2.version &&
    relevantEntries[0]?.name === PROTECTED_GOLD_IMPORT_CONTRACT_V2.migrationName
  ) {
    return { kind: 'v2_applied_exactly_once', relevantEntries }
  }
  return {
    kind: 'v2_drifted_or_ambiguous',
    reason:
      'Protected V2 ledger identity is duplicated, has the wrong name/version pairing, or is otherwise ambiguous.',
    relevantEntries,
  }
}

export function classifyProtectedV2State(input: {
  authorization?: ProtectedV2OperatorAuthorization
  authorizationContext?: ProtectedV2AuthorizationContext
  ledgerEntries: readonly ProtectedMigrationLedgerEntry[]
}): ProtectedV2State {
  const ledger = classifyProtectedV2Ledger(input.ledgerEntries)
  if (ledger.kind === 'v2_drifted_or_ambiguous') {
    return { kind: 'v2_drifted_or_ambiguous', ledger }
  }
  if (ledger.kind === 'v2_applied_exactly_once') {
    if (input.authorization) {
      throw new Error('Protected V2 authorization is invalid after V2 has been applied.')
    }
    return { kind: 'v2_applied_exactly_once', ledger }
  }
  if (!input.authorization) return { kind: 'v2_absent_unarmed', ledger }
  if (!input.authorizationContext) {
    throw new Error('Protected V2 authorization requires a current authorization context.')
  }
  validateProtectedV2Authorization(input.authorization, input.authorizationContext)
  return { authorization: input.authorization, kind: 'v2_absent_explicitly_armed', ledger }
}

function assertAuthorizationContext(context: ProtectedV2AuthorizationContext) {
  if (
    context.repository.branch !== 'main' ||
    context.repository.head !== context.repository.originMain ||
    !COMMIT_PATTERN.test(context.repository.head) ||
    context.repository.statusCleanIncludingUntracked !== true
  ) {
    throw new Error('Protected V2 authorization requires clean primary main at exact origin/main.')
  }
  if (
    context.database.target !== 'local' ||
    context.database.projectId !== LOCAL_SUPABASE_PROJECT_ID ||
    context.database.container !== DEFAULT_LOCAL_DATABASE_CONTAINER ||
    context.database.port !== LOCAL_DATABASE_PORT
  ) {
    throw new Error('Protected V2 authorization rejected a non-pinned local database target.')
  }
  if (context.database.v1Occurrence !== 1 || context.database.v2Occurrence !== 0) {
    throw new Error('Protected V2 authorization requires V1 exactly once and V2 absent.')
  }
  for (const [key, value] of Object.entries({
    developmentMembershipSha256: context.database.developmentMembershipSha256,
    developmentPlanningStateSha256: context.database.developmentPlanningStateSha256,
    effectiveStateSha256: context.database.effectiveStateSha256,
    physicalStateSha256: context.database.physicalStateSha256,
  })) {
    assertSha256(value, `database.${key}`)
  }
  if (
    context.migration.filename !== PROTECTED_GOLD_IMPORT_CONTRACT_V2.filename ||
    context.migration.id !== PROTECTED_GOLD_IMPORT_CONTRACT_V2.id ||
    context.migration.version !== PROTECTED_GOLD_IMPORT_CONTRACT_V2.version ||
    context.migration.migrationName !== PROTECTED_GOLD_IMPORT_CONTRACT_V2.migrationName ||
    context.migration.sha256 !== PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256
  ) {
    throw new Error('Protected V2 authorization migration identity drifted.')
  }
  if (
    context.safety.heldOutIdentitiesAccessed !== false ||
    context.safety.remoteDatabaseAccessed !== false
  ) {
    throw new Error('Protected V2 authorization forbids held-out and remote access.')
  }
  if (
    context.backups.length !== 2 ||
    context.backups[0].directory === context.backups[1].directory ||
    context.backups[0].backupInstanceId === context.backups[1].backupInstanceId ||
    context.backups[0].executionReceiptSha256 === context.backups[1].executionReceiptSha256
  ) {
    throw new Error(
      'Protected V2 authorization requires two independently executed pre-application backups.',
    )
  }
  for (const [index, backup] of context.backups.entries()) {
    if (
      !backup.directory ||
      !backup.backupRoot ||
      !backup.executedAt ||
      Number.isNaN(Date.parse(backup.executedAt))
    ) {
      throw new Error(`Protected V2 backup ${index + 1} has malformed identity fields.`)
    }
    assertSha256(backup.backupInstanceId, `backup ${index + 1} instance`)
    assertSha256(backup.canonicalManifestSha256, `backup ${index + 1} manifest`)
    assertSha256(backup.executionReceiptSha256, `backup ${index + 1} receipt`)
  }
}

function authorizationContent(input: Omit<ProtectedV2OperatorAuthorization, 'contentSha256'>) {
  return input
}

export function buildProtectedV2Authorization(input: {
  confirmation: string
  context: ProtectedV2AuthorizationContext
  operator: string
  requestedAt: string
}): ProtectedV2OperatorAuthorization {
  assertAuthorizationContext(input.context)
  if (input.confirmation !== PROTECTED_V2_CONFIRMATION) {
    throw new Error(`Protected V2 confirmation must exactly equal: ${PROTECTED_V2_CONFIRMATION}`)
  }
  if (!input.operator.trim() || input.operator.trim() !== input.operator) {
    throw new Error('Protected V2 operator identity must be a trimmed nonempty string.')
  }
  if (Number.isNaN(Date.parse(input.requestedAt))) {
    throw new Error('Protected V2 authorization timestamp is invalid.')
  }
  const content = {
    authorizedCapability: PROTECTED_V2_AUTHORIZED_CAPABILITY,
    confirmation: PROTECTED_V2_CONFIRMATION,
    context: input.context,
    forbiddenCapabilities: PROTECTED_V2_FORBIDDEN_CAPABILITIES,
    operator: input.operator,
    requestedAt: input.requestedAt,
    schemaVersion: PROTECTED_V2_AUTHORIZATION_SCHEMA_VERSION,
  } as const
  return { ...content, contentSha256: sha256(canonicalJson(content)) }
}

export function validateProtectedV2Authorization(
  authorization: ProtectedV2OperatorAuthorization,
  currentContext: ProtectedV2AuthorizationContext,
) {
  assertAuthorizationContext(currentContext)
  if (
    authorization.schemaVersion !== PROTECTED_V2_AUTHORIZATION_SCHEMA_VERSION ||
    authorization.authorizedCapability !== PROTECTED_V2_AUTHORIZED_CAPABILITY ||
    authorization.confirmation !== PROTECTED_V2_CONFIRMATION ||
    canonicalJson(authorization.forbiddenCapabilities) !==
      canonicalJson(PROTECTED_V2_FORBIDDEN_CAPABILITIES)
  ) {
    throw new Error('Protected V2 authorization scope is malformed or overbroad.')
  }
  if (canonicalJson(authorization.context) !== canonicalJson(currentContext)) {
    throw new Error('Protected V2 authorization is stale after repository, state, or backup drift.')
  }
  const { contentSha256, ...content } = authorization
  assertSha256(contentSha256, 'authorization.contentSha256')
  if (sha256(canonicalJson(authorizationContent(content))) !== contentSha256) {
    throw new Error('Protected V2 authorization checksum is invalid.')
  }
  return authorization
}

export function buildProtectedV2LedgerSql() {
  return `
begin transaction isolation level repeatable read read only;
select '${LEDGER_MARKER}' || jsonb_build_object(
  'databaseName', current_database(),
  'readOnlyTransaction', current_setting('transaction_read_only')::boolean,
  'entries', coalesce(jsonb_agg(jsonb_build_object(
    'version', to_jsonb(migration) ->> 'version',
    'name', to_jsonb(migration) ->> 'name'
  ) order by to_jsonb(migration) ->> 'version', to_jsonb(migration) ->> 'name'), '[]'::jsonb)
)::text
from supabase_migrations.schema_migrations migration
where to_jsonb(migration) ->> 'version' = '${PROTECTED_GOLD_IMPORT_CONTRACT_V2.version}'
   or to_jsonb(migration) ->> 'name' = '${PROTECTED_GOLD_IMPORT_CONTRACT_V2.migrationName}';
rollback;
`.trim()
}

export function parseProtectedV2LedgerOutput(output: string): ProtectedMigrationLedgerEntry[] {
  const lines = output.split(/\r?\n/u).filter((line) => line.startsWith(LEDGER_MARKER))
  if (lines.length !== 1) throw new Error('Protected V2 ledger marker was absent or duplicated.')
  const parsed = JSON.parse(lines[0]!.slice(LEDGER_MARKER.length)) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Protected V2 ledger evidence must be an object.')
  }
  const evidence = parsed as Record<string, unknown>
  if (
    evidence.databaseName !== 'postgres' ||
    evidence.readOnlyTransaction !== true ||
    !Array.isArray(evidence.entries)
  ) {
    throw new Error('Protected V2 ledger evidence is not pinned read-only local evidence.')
  }
  return evidence.entries.map(normalizedLedgerEntry)
}

function targetEnvironment(target: LocalDockerTarget) {
  const environment = { ...target.environment }
  if (target.context) environment.DOCKER_CONTEXT = target.context
  else environment.DOCKER_HOST = target.endpoint
  return environment
}

export async function collectProtectedV2LedgerEntries(
  input: {
    dockerTarget?: LocalDockerTarget
    runCommand?: CommandRunner
  } = {},
) {
  const runCommand = input.runCommand ?? defaultCommandRunner
  const target = input.dockerTarget ?? (await resolveLocalDockerTarget({ runCommand }))
  await assertLocalDatabaseHealthy(DEFAULT_LOCAL_DATABASE_CONTAINER, runCommand, target)
  const result = await runCommand(
    'docker',
    [
      ...target.dockerArguments,
      'exec',
      '--interactive',
      DEFAULT_LOCAL_DATABASE_CONTAINER,
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
    { env: targetEnvironment(target), stdin: buildProtectedV2LedgerSql() },
  )
  return parseProtectedV2LedgerOutput(result.stdout)
}

export function defaultLocalLifecycleState(
  ledgerEntries: readonly ProtectedMigrationLedgerEntry[],
): ProtectedV2State {
  return classifyProtectedV2State({ ledgerEntries })
}

export function buildDefaultLocalStartPlan(
  ledgerEntries: readonly ProtectedMigrationLedgerEntry[],
) {
  const state = defaultLocalLifecycleState(ledgerEntries)
  if (state.kind === 'v2_drifted_or_ambiguous') throw new Error(state.ledger.reason)
  return {
    firstStartProtectedV2Visible: false,
    migrationUpProtectedV2Visible: state.kind === 'v2_applied_exactly_once',
    protectedMigrationApplicationPlanned: false,
    protectedMigrationState: state.kind,
    protectedV2AuthorizationPresent: false,
  } as const
}
