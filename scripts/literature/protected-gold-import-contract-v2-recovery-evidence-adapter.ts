import { spawn } from 'node:child_process'

import { buildContractDiagnosticsSql } from './gold-import-compensation-contract-diagnostics-core'
import {
  PROTECTED_V2_COMPLETE_CATALOG_DETAIL_SQL,
  collectProtectedV2CompleteCatalogAudit,
  v2SecurityIntrospectionSql,
} from './gold-import-contract-v2-catalog-audit'
import {
  buildProtectedV2TransitionSnapshotSql,
  collectProtectedV2PostTransitionEvidence,
  type ProtectedV2CollectedPostTransitionEvidence,
  type ProtectedV2DatabaseEvidence,
} from './protected-gold-import-contract-v2-transition-evidence'
import {
  GOLD_IMPORT_V2_FIXED_LOCAL_TARGET,
  GOLD_IMPORT_V2_FIXED_LOCAL_TARGET_SQL,
  type GoldImportV2RawDockerTargetSnapshot,
} from './gold-import-v2-fixed-local-target'

export const PROTECTED_V2_RECOVERY_LOCAL_CONTAINER = 'supabase_db_ip-literature-local' as const
export const PROTECTED_V2_RECOVERY_DOCKER_COMMAND = 'docker' as const
export const PROTECTED_V2_RECOVERY_DOCKER_ARGUMENTS = [
  '--context',
  'default',
  'exec',
  '--interactive',
  PROTECTED_V2_RECOVERY_LOCAL_CONTAINER,
  'psql',
  '--no-psqlrc',
  '--set',
  'ON_ERROR_STOP=1',
  '--username',
  'postgres',
  '--dbname',
  'postgres',
  '--host',
  GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.socketDirectory,
  '--port',
  String(GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.internalPort),
  '--tuples-only',
  '--no-align',
  '--quiet',
] as const

export const PROTECTED_V2_RECOVERY_EVIDENCE_SQL = Object.freeze({
  catalogDetails: `begin transaction isolation level repeatable read read only;\nset local statement_timeout = '120s';\n${PROTECTED_V2_COMPLETE_CATALOG_DETAIL_SQL}\nrollback;`,
  catalogDiagnostics: buildContractDiagnosticsSql(),
  catalogSecurity: `begin transaction isolation level repeatable read read only;\nset local statement_timeout = '120s';\n${v2SecurityIntrospectionSql()}\nrollback;`,
  transitionAfterV2: buildProtectedV2TransitionSnapshotSql('after_v2'),
})

export const PROTECTED_V2_RECOVERY_EVIDENCE_TRANSACTION_BATCHES = Object.freeze([
  PROTECTED_V2_RECOVERY_EVIDENCE_SQL.transitionAfterV2,
  PROTECTED_V2_RECOVERY_EVIDENCE_SQL.catalogDiagnostics,
  PROTECTED_V2_RECOVERY_EVIDENCE_SQL.catalogSecurity,
  PROTECTED_V2_RECOVERY_EVIDENCE_SQL.catalogDetails,
  PROTECTED_V2_RECOVERY_EVIDENCE_SQL.transitionAfterV2,
] as const)

export const PROTECTED_V2_RECOVERY_READ_ONLY_QUERY_AUDIT = Object.freeze({
  databaseMutationCount: 0 as const,
  heldOutIdentitiesAccessed: false as const,
  localDockerEndpoint: true as const,
  remoteDatabaseAccessed: false as const,
  transactionBatches: PROTECTED_V2_RECOVERY_EVIDENCE_TRANSACTION_BATCHES,
})

// Keep the historical receipt-recovery query inventory byte-for-byte stable.
// The new target probe shares only the hardened fixed-psql executor.
const PROTECTED_V2_RECOVERY_ALLOWED_SQL = new Set([
  ...Object.values(PROTECTED_V2_RECOVERY_EVIDENCE_SQL),
  GOLD_IMPORT_V2_FIXED_LOCAL_TARGET_SQL,
])

const FIXED_LOCAL_DOCKER_CONTEXT_INSPECT_ARGUMENTS = [
  'context',
  'inspect',
  GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.dockerContext,
  '--format',
  '{{json .}}',
] as const

const FIXED_LOCAL_DOCKER_CONTAINER_TEMPLATE =
  '{"Id":{{json .Id}},"Name":{{json .Name}},"Image":{{json .Image}},"RestartCount":{{json .RestartCount}},"State":{"Running":{{json .State.Running}},"StartedAt":{{json .State.StartedAt}},"Health":{"Status":{{json .State.Health.Status}}}},"Config":{"Hostname":{{json .Config.Hostname}},"Image":{{json .Config.Image}},"Labels":{{json .Config.Labels}}},"HostConfig":{"NetworkMode":{{json .HostConfig.NetworkMode}},"PortBindings":{{json .HostConfig.PortBindings}}},"NetworkSettings":{"Ports":{{json .NetworkSettings.Ports}},"Networks":{{json .NetworkSettings.Networks}}},"ImageManifestDescriptor":{{json .ImageManifestDescriptor}}}'

const FIXED_LOCAL_DOCKER_CONTAINER_INSPECT_ARGUMENTS = [
  '--context',
  GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.dockerContext,
  'inspect',
  '--type',
  'container',
  GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.containerName,
  '--format',
  FIXED_LOCAL_DOCKER_CONTAINER_TEMPLATE,
] as const

const FIXED_LOCAL_DOCKER_HOSTNAME_ARGUMENTS = [
  '--context',
  GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.dockerContext,
  'exec',
  GOLD_IMPORT_V2_FIXED_LOCAL_TARGET.containerName,
  'hostname',
] as const

export interface ProtectedV2FixedLocalPsqlRequest {
  arguments: typeof PROTECTED_V2_RECOVERY_DOCKER_ARGUMENTS
  command: typeof PROTECTED_V2_RECOVERY_DOCKER_COMMAND
  sql: string
}

export type ProtectedV2FixedLocalPsqlExecutor = (
  request: ProtectedV2FixedLocalPsqlRequest,
) => Promise<{ stderr?: string; stdout: string }>

function stripSqlCommentsAndLiterals(sql: string): string {
  return sql
    .replace(/--[^\n]*/gu, ' ')
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/'(?:''|[^'])*'/gu, "''")
}

export function assertProtectedV2RecoveryEvidenceSqlReadOnly(sql: string): void {
  const inspected = stripSqlCommentsAndLiterals(sql)
  if (
    !/^\s*begin transaction isolation level repeatable read read only;/iu.test(inspected) ||
    !/rollback;\s*$/iu.test(inspected) ||
    (inspected.match(/\brollback\s*;/giu) ?? []).length !== 1
  ) {
    throw new Error('Protected V2 recovery evidence SQL requires one exact read-only bracket.')
  }
  if (
    /\b(insert|update|delete|truncate|alter|create|drop|grant|revoke|call|do|copy|commit|vacuum|reindex|cluster|refresh|discard|lock)\b/iu.test(
      inspected,
    ) ||
    /^\s*\\/mu.test(inspected)
  ) {
    throw new Error('Protected V2 recovery evidence SQL contains a mutation capability.')
  }
}

function assertProtectedV2RecoveryEvidenceSqlAllowed(sql: string): void {
  assertProtectedV2RecoveryEvidenceSqlReadOnly(sql)
  if (!PROTECTED_V2_RECOVERY_ALLOWED_SQL.has(sql)) {
    throw new Error('Protected V2 recovery evidence SQL is not one of the four fixed queries.')
  }
}

export function fixedLocalDockerEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env }
  for (const key of [
    'DOCKER_API_VERSION',
    'DOCKER_CERT_PATH',
    'DOCKER_CONTEXT',
    'DOCKER_HOST',
    'DOCKER_TLS',
    'DOCKER_TLS_VERIFY',
  ]) {
    delete environment[key]
  }
  return environment
}

function executeFixedLocalDockerObservation(
  arguments_: readonly string[],
): Promise<{ stderr: string; stdout: string }> {
  const accepted =
    arguments_ === FIXED_LOCAL_DOCKER_CONTEXT_INSPECT_ARGUMENTS ||
    arguments_ === FIXED_LOCAL_DOCKER_CONTAINER_INSPECT_ARGUMENTS ||
    arguments_ === FIXED_LOCAL_DOCKER_HOSTNAME_ARGUMENTS
  if (!accepted) {
    throw new Error('Fixed-local Docker observation rejected caller-supplied arguments.')
  }
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(PROTECTED_V2_RECOVERY_DOCKER_COMMAND, [...arguments_], {
      env: fixedLocalDockerEnvironment(),
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
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
      if (code !== 0) {
        rejectPromise(
          new Error(`Fixed-local Docker observation failed (${String(code)}): ${stderr.trim()}`),
        )
        return
      }
      resolvePromise({ stderr, stdout })
    })
  })
}

/**
 * Module-owned, argument-free target observation. Callers cannot substitute a
 * context, endpoint, container, image, or hostname command.
 */
export async function collectProtectedV2FixedLocalDockerTargetSnapshot(): Promise<GoldImportV2RawDockerTargetSnapshot> {
  const [context, container, hostname] = await Promise.all([
    executeFixedLocalDockerObservation(FIXED_LOCAL_DOCKER_CONTEXT_INSPECT_ARGUMENTS),
    executeFixedLocalDockerObservation(FIXED_LOCAL_DOCKER_CONTAINER_INSPECT_ARGUMENTS),
    executeFixedLocalDockerObservation(FIXED_LOCAL_DOCKER_HOSTNAME_ARGUMENTS),
  ])
  return Object.freeze({
    containerInspect: container.stdout.trim(),
    contextInspect: context.stdout.trim(),
    hostnameStdout: hostname.stdout,
    inspectedAt: new Date().toISOString(),
  })
}

export const executeProtectedV2FixedLocalReadOnlyPsql: ProtectedV2FixedLocalPsqlExecutor = async (
  request,
) => {
  if (
    request.command !== PROTECTED_V2_RECOVERY_DOCKER_COMMAND ||
    request.arguments !== PROTECTED_V2_RECOVERY_DOCKER_ARGUMENTS
  ) {
    throw new Error('Protected V2 recovery evidence command target is not the fixed local psql.')
  }
  assertProtectedV2RecoveryEvidenceSqlAllowed(request.sql)
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(request.command, [...request.arguments], {
      env: fixedLocalDockerEnvironment(),
      shell: false,
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
      if (code !== 0) {
        rejectPromise(
          new Error(
            `Protected V2 fixed local read-only psql failed (${String(code)}): ${stderr.trim()}`,
          ),
        )
        return
      }
      resolvePromise({ stderr, stdout })
    })
    child.stdin.end(request.sql)
  })
}

function parseSinglePsqlJson(stdout: string): unknown {
  const candidates = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{') || line.startsWith('['))
  if (candidates.length !== 1) {
    throw new Error('Protected V2 fixed local read-only psql JSON was absent or duplicated.')
  }
  try {
    return JSON.parse(candidates[0]!) as unknown
  } catch (error) {
    throw new Error(
      `Protected V2 fixed local read-only psql JSON was invalid: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

export async function collectProtectedV2FixedLocalRecoveryEvidence(input: {
  beforeCaptures: readonly [ProtectedV2DatabaseEvidence, ProtectedV2DatabaseEvidence]
  executor?: ProtectedV2FixedLocalPsqlExecutor
  expectedCatalogBindingSha256: string
  sourceAuthorizationSha256: string
}): Promise<ProtectedV2CollectedPostTransitionEvidence> {
  const executor = input.executor ?? executeProtectedV2FixedLocalReadOnlyPsql
  const psql = async (sql: string) => {
    assertProtectedV2RecoveryEvidenceSqlAllowed(sql)
    return executor({
      arguments: PROTECTED_V2_RECOVERY_DOCKER_ARGUMENTS,
      command: PROTECTED_V2_RECOVERY_DOCKER_COMMAND,
      sql,
    })
  }
  const queryJson = async (sql: string) => parseSinglePsqlJson((await psql(sql)).stdout)
  return collectProtectedV2PostTransitionEvidence({
    beforeCaptures: input.beforeCaptures,
    dependencies: {
      collectCompleteCatalogAudit: () =>
        collectProtectedV2CompleteCatalogAudit({
          context: { psql, queryJson },
          profile: 'local',
        }),
      queryJson,
    },
    expectedCatalogBindingSha256: input.expectedCatalogBindingSha256,
    sourceAuthorizationSha256: input.sourceAuthorizationSha256,
  })
}
