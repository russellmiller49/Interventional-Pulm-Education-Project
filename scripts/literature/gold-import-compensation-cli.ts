import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { open, readFile, type FileHandle } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

import { validateGoldImportSourceArtifact } from '../../src/features/literature/gold-set/import-artifact-validation'
import {
  GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
  assertCompensationAuthorizationMatchesPlan,
  assertImportAuthorizationMatchesPlan,
  canonicalJson,
  parseCompensationReceipt,
  parseImportReceipt,
  parseRecoveryAuthorization,
  sha256Canonical,
  type CompensationAuthorization,
  type CompensationPlan,
  type CompensationReceipt,
  type ImportAuthorization,
  type ImportPlan,
  type ImportReceipt,
} from '../../src/features/literature/gold-set/import-compensation'
import { validateGoldImportSourceAuthorizationSetForImport } from './gold-import-compensation-compatibility'
import {
  assertKnownArguments,
  hasFlag,
  parseCliArguments,
  stringArgument,
  type ParsedCliArguments,
} from './lib/cli'

const APPLY_IMPORT_RPC = 'apply_literature_gold_import_v1' as const
const APPLY_COMPENSATION_RPC = 'compensate_literature_gold_import_v1' as const
const RECONCILE_OPERATION_RPC = 'reconcile_literature_gold_review_operation_v1' as const
const CLI_REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const execFileAsync = promisify(execFile)
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
// Only the contract's own exception namespace proves that PostgreSQL rejected the
// transaction. Connection and completion-unknown SQLSTATEs must be reconciled.
const DEFINITIVE_CONTRACT_SQLSTATE_PATTERN = /^P7[56][0-9]{2}$/u

const HELP = `
Checksum-bound gold review import and append-only compensation executor.

Commands:
  validate-import
    --plan <json> --authorization <json> --artifact <file>
    --source-authorization-set <file>
  execute-import
    --plan <json> --authorization <json> --artifact <file> --source-authorization-set <file>
    --receipt <json>
    [--target local] [--actor-user-id <uuid>] [--actor-email <email>]
  validate-compensation
    --plan <json> --authorization <json> --artifact <file>
  execute-compensation
    --plan <json> --authorization <json> --artifact <file> --receipt <json>
    [--target local] [--actor-user-id <uuid>] [--actor-email <email>]
  reconcile
    --operation-id <uuid> --recovery-authorization <json> [--target local]

Safety:
  Validation is file-only. Execution accepts loopback Supabase URLs only, makes one RPC call,
  never retries or auto-compensates, and exclusively creates the requested receipt path before
  the call. Reconciliation performs one read-only reconciliation RPC and never mutates state.
`.trim()

interface DatabaseError {
  code?: string
  details?: string
  hint?: string
  message: string
}

interface DatabaseResult<T> {
  data: T | null
  error: DatabaseError | null
}

export interface GoldImportCompensationDatabaseClient {
  rpc(
    functionName: string,
    arguments_: Record<string, unknown>,
  ): PromiseLike<DatabaseResult<unknown>>
}

export interface GoldImportCompensationEnvironment {
  [key: string]: string | undefined
  LITERATURE_SUPABASE_SERVICE_ROLE_KEY?: string
  LITERATURE_SUPABASE_URL?: string
  NEXT_PUBLIC_SUPABASE_URL?: string
  SUPABASE_SECRET_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  SUPABASE_URL?: string
}

export interface GoldImportCompensationCliDependencies {
  createClient?: (url: string, serviceRoleKey: string) => GoldImportCompensationDatabaseClient
  env?: GoldImportCompensationEnvironment
  log?: (message: string) => void
  now?: () => string
  primaryCheckout?: () => Promise<boolean>
  repositoryCommitSha?: () => Promise<string>
}

interface LocalDatabaseConfiguration {
  serviceRoleKey: string
  url: string
}

interface ArtifactValidation {
  artifactBytes: number
  sourceArtifactSha256: string
}

interface ImportBundle extends ArtifactValidation {
  authorization: ImportAuthorization
  plan: ImportPlan
  sourceAuthorizationSetBytes: number
  sourceAuthorizationSetSha256: string
}

interface CompensationBundle extends ArtifactValidation {
  authorization: CompensationAuthorization
  plan: CompensationPlan
}

export interface ContractValidationResult {
  artifactBytes: number
  authorizationSha256: string
  batchId: string
  command: 'validate-import' | 'validate-compensation'
  contractVersion: typeof GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION
  datasetSplit: 'development'
  heldOutIdentitiesAccessed: false
  idempotencyKey: string
  operationId: string
  planSha256: string
  repositoryCommitMatches: true
  repositoryCommitSha: string
  sourceArtifactSha256: string
  sourceAuthorizationSetBytes: number | null
  sourceAuthorizationSetSha256: string | null
  valid: true
}

interface NormalizedDatabaseError {
  code: string | null
  details: string | null
  hint: string | null
  message: string
}

type ExecutionEnvelopeState =
  | 'prepared'
  | 'rpc_in_flight_or_outcome_unknown'
  | 'rpc_response_received'
  | 'rpc_rejected'
  | 'rpc_outcome_ambiguous'

interface ExecutionEnvelopeContent {
  artifactSha256: string
  attemptedAt: string | null
  authorizationSha256: string
  batchId: string
  command: 'execute-import' | 'execute-compensation'
  completedAt: string | null
  contractVersion: typeof GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION
  error: NormalizedDatabaseError | null
  idempotencyKey: string
  kind: 'gold_review_import_execution_envelope' | 'gold_review_compensation_execution_envelope'
  operationId: string
  planSha256: string
  result: ImportReceipt | CompensationReceipt | null
  rpcName: typeof APPLY_IMPORT_RPC | typeof APPLY_COMPENSATION_RPC
  state: ExecutionEnvelopeState
  target: 'local'
  targetImportOperationId: string | null
}

export interface ExecutionEnvelope extends ExecutionEnvelopeContent {
  binding: { contentSha256: string }
}

export interface ReconciliationResult {
  authorization: {
    bindingSha256: string
    permitsMutation: false
    recoveryAction: 'resolve_ambiguous_import' | 'resolve_ambiguous_compensation'
  }
  command: 'reconcile'
  contractVersion: typeof GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION
  response: Record<string, unknown> | ImportReceipt | CompensationReceipt
  responseKind: 'absent' | 'recovery_required' | 'terminal_receipt'
  target: 'local'
}

export type GoldImportCompensationCliResult =
  | ContractValidationResult
  | ExecutionEnvelope
  | ReconciliationResult
  | undefined

function productionClientFactory(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as GoldImportCompensationDatabaseClient
}

function required(arguments_: ParsedCliArguments, key: string): string {
  const value = stringArgument(arguments_, key)
  if (!value) throw new Error(`--${key} is required.`)
  return value
}

function absolute(workspaceRoot: string, value: string): string {
  return resolve(workspaceRoot, value)
}

function sha256Bytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

async function liveRepositoryCommitSha(): Promise<string> {
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
    cwd: CLI_REPOSITORY_ROOT,
    encoding: 'utf8',
  })
  const commitSha = stdout.trim()
  if (!/^[a-f0-9]{40}$/u.test(commitSha)) {
    throw new Error(`git rev-parse HEAD returned an invalid commit SHA: ${commitSha || '<empty>'}.`)
  }
  return commitSha
}

async function livePrimaryCheckout(): Promise<boolean> {
  const [{ stdout: gitDirectory }, { stdout: commonDirectory }] = await Promise.all([
    execFileAsync('git', ['rev-parse', '--absolute-git-dir'], {
      cwd: CLI_REPOSITORY_ROOT,
      encoding: 'utf8',
    }),
    execFileAsync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      cwd: CLI_REPOSITORY_ROOT,
      encoding: 'utf8',
    }),
  ])
  return gitDirectory.trim() === commonDirectory.trim()
}

async function assertPrimaryCheckout(
  dependencies: Required<GoldImportCompensationCliDependencies>,
): Promise<void> {
  if (!(await dependencies.primaryCheckout())) {
    throw new Error(
      'Blocked: import/compensation execution mutates shared local state and must run from the primary checkout.',
    )
  }
}

async function assertRepositoryCommit(
  expectedCommitSha: string,
  dependencies: Required<GoldImportCompensationCliDependencies>,
): Promise<string> {
  const commitSha = await dependencies.repositoryCommitSha()
  if (commitSha !== expectedCommitSha) {
    throw new Error(
      `Repository commit attestation mismatch: plan/authorization requires ${expectedCommitSha}, live checkout is ${commitSha}.`,
    )
  }
  return commitSha
}

async function readJson(path: string): Promise<unknown> {
  const bytes = await readFile(path)
  try {
    return JSON.parse(bytes.toString('utf8')) as unknown
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${path}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function validateFileChecksum(
  bytes: Buffer,
  expectedSha256: string,
  label: string,
): { bytes: number; sha256: string } {
  const sha256 = sha256Bytes(bytes)
  if (sha256 !== expectedSha256) {
    throw new Error(`${label} checksum mismatch: expected ${expectedSha256}, got ${sha256}.`)
  }
  return { bytes: bytes.length, sha256 }
}

async function loadImportBundle(
  arguments_: ParsedCliArguments,
  workspaceRoot: string,
): Promise<ImportBundle> {
  const [planInput, authorizationInput, artifactBytes, sourceAuthorizationSetBytes] =
    await Promise.all([
      readJson(absolute(workspaceRoot, required(arguments_, 'plan'))),
      readJson(absolute(workspaceRoot, required(arguments_, 'authorization'))),
      readFile(absolute(workspaceRoot, required(arguments_, 'artifact'))),
      readFile(absolute(workspaceRoot, required(arguments_, 'source-authorization-set'))),
    ])
  const { plan, authorization } = assertImportAuthorizationMatchesPlan(
    planInput,
    authorizationInput,
  )
  const artifact = validateFileChecksum(artifactBytes, plan.sourceArtifactSha256, 'Source artifact')
  const sourceAuthorizationSet = validateFileChecksum(
    sourceAuthorizationSetBytes,
    plan.sourceAuthorizationSetSha256,
    'Source authorization set',
  )
  let sourceAuthorizationInput: unknown
  try {
    sourceAuthorizationInput = JSON.parse(sourceAuthorizationSetBytes.toString('utf8')) as unknown
  } catch (error) {
    throw new Error(
      `Source authorization set must be strict JSON: ${error instanceof Error ? error.message : String(error)}.`,
    )
  }
  const parsedSourceAuthorization = validateGoldImportSourceAuthorizationSetForImport({
    finalizedArtifact: artifactBytes,
    plan,
    sourceAuthorizationSet: sourceAuthorizationInput,
  })
  let csvText: string
  try {
    csvText = new TextDecoder('utf-8', { fatal: true }).decode(artifactBytes)
  } catch {
    throw new Error('Source artifact must be valid UTF-8 CSV.')
  }
  validateGoldImportSourceArtifact({
    compatibility:
      parsedSourceAuthorization.version === 2
        ? {
            listNormalizationLedger:
              parsedSourceAuthorization.compatibility.listNormalizationLedger,
            optionalTagStatusResolutions:
              parsedSourceAuthorization.compatibility.optionalTagStatusResolutions,
          }
        : undefined,
    csvText,
    plan,
  })
  return {
    plan,
    authorization,
    artifactBytes: artifact.bytes,
    sourceArtifactSha256: artifact.sha256,
    sourceAuthorizationSetBytes: sourceAuthorizationSet.bytes,
    sourceAuthorizationSetSha256: sourceAuthorizationSet.sha256,
  }
}

async function loadCompensationBundle(
  arguments_: ParsedCliArguments,
  workspaceRoot: string,
): Promise<CompensationBundle> {
  const [planInput, authorizationInput, artifactBytes] = await Promise.all([
    readJson(absolute(workspaceRoot, required(arguments_, 'plan'))),
    readJson(absolute(workspaceRoot, required(arguments_, 'authorization'))),
    readFile(absolute(workspaceRoot, required(arguments_, 'artifact'))),
  ])
  const { plan, authorization } = assertCompensationAuthorizationMatchesPlan(
    planInput,
    authorizationInput,
  )
  const artifact = validateFileChecksum(artifactBytes, plan.sourceArtifactSha256, 'Source artifact')
  return {
    plan,
    authorization,
    artifactBytes: artifact.bytes,
    sourceArtifactSha256: artifact.sha256,
  }
}

function validationResult(
  command: ContractValidationResult['command'],
  bundle: ImportBundle | CompensationBundle,
  repositoryCommitSha: string,
): ContractValidationResult {
  return {
    artifactBytes: bundle.artifactBytes,
    authorizationSha256: bundle.authorization.binding.contentSha256,
    batchId: bundle.plan.batchId,
    command,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    datasetSplit: bundle.plan.scope.datasetSplit,
    heldOutIdentitiesAccessed: bundle.plan.scope.heldOutIdentitiesAccessed,
    idempotencyKey: bundle.plan.binding.idempotencyKey,
    operationId: bundle.plan.operationId,
    planSha256: bundle.plan.binding.contentSha256,
    repositoryCommitMatches: true,
    repositoryCommitSha,
    sourceArtifactSha256: bundle.sourceArtifactSha256,
    sourceAuthorizationSetBytes:
      'sourceAuthorizationSetBytes' in bundle ? bundle.sourceAuthorizationSetBytes : null,
    sourceAuthorizationSetSha256:
      'sourceAuthorizationSetSha256' in bundle ? bundle.sourceAuthorizationSetSha256 : null,
    valid: true,
  }
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  )
}

function assertLocalTarget(arguments_: ParsedCliArguments): void {
  const target = stringArgument(arguments_, 'target', 'local')
  if (target !== 'local') {
    throw new Error('Remote targets are unsupported; --target must be local.')
  }
}

function localDatabaseConfiguration(
  env: GoldImportCompensationEnvironment,
): LocalDatabaseConfiguration {
  const url =
    env.LITERATURE_SUPABASE_URL?.trim() ??
    env.SUPABASE_URL?.trim() ??
    env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey =
    env.LITERATURE_SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    env.SUPABASE_SECRET_KEY?.trim()
  if (!url || !serviceRoleKey) {
    throw new Error('Local Supabase URL and service-role/secret credentials are required.')
  }
  const parsedUrl = new URL(url)
  if (!isLocalHostname(parsedUrl.hostname)) {
    throw new Error(
      `Refusing gold import-compensation access to non-loopback hostname ${parsedUrl.hostname}.`,
    )
  }
  return { url: parsedUrl.toString(), serviceRoleKey }
}

function parseActor(arguments_: ParsedCliArguments) {
  const actorUserId = stringArgument(arguments_, 'actor-user-id')?.trim() || null
  const actorEmail = stringArgument(arguments_, 'actor-email')?.trim() || null
  if (actorUserId && !UUID_PATTERN.test(actorUserId)) {
    throw new Error('--actor-user-id must be a UUID.')
  }
  if (!actorUserId && !actorEmail) {
    throw new Error('Execution requires --actor-user-id or --actor-email.')
  }
  return { actorUserId, actorEmail }
}

function normalizeError(error: unknown): NormalizedDatabaseError {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    return {
      code: typeof record.code === 'string' && record.code ? record.code : null,
      details: typeof record.details === 'string' && record.details ? record.details : null,
      hint: typeof record.hint === 'string' && record.hint ? record.hint : null,
      message:
        typeof record.message === 'string' && record.message ? record.message : String(error),
    }
  }
  return { code: null, details: null, hint: null, message: String(error) }
}

function bindEnvelope(content: ExecutionEnvelopeContent): ExecutionEnvelope {
  return { ...content, binding: { contentSha256: sha256Canonical(content) } }
}

async function writeEnvelope(handle: FileHandle, envelope: ExecutionEnvelope): Promise<void> {
  const bytes = Buffer.from(`${JSON.stringify(envelope, null, 2)}\n`, 'utf8')
  await handle.truncate(0)
  let offset = 0
  while (offset < bytes.length) {
    const { bytesWritten } = await handle.write(bytes, offset, bytes.length - offset, offset)
    if (bytesWritten < 1) throw new Error('Could not persist the execution envelope.')
    offset += bytesWritten
  }
  await handle.sync()
}

async function createExclusiveEnvelope(
  path: string,
  envelope: ExecutionEnvelope,
): Promise<FileHandle> {
  let handle: FileHandle
  try {
    handle = await open(path, 'wx', 0o600)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`Refusing to overwrite existing receipt path: ${path}`)
    }
    throw error
  }
  try {
    await writeEnvelope(handle, envelope)
    return handle
  } catch (error) {
    await handle.close().catch(() => undefined)
    throw error
  }
}

function rpcReceipt(
  input: unknown,
  bundle: ImportBundle | CompensationBundle,
): ImportReceipt | CompensationReceipt {
  const receipt =
    bundle.plan.kind === 'import' ? parseImportReceipt(input) : parseCompensationReceipt(input)
  if (
    receipt.operationId !== bundle.plan.operationId ||
    receipt.batchId !== bundle.plan.batchId ||
    receipt.planSha256 !== bundle.plan.binding.contentSha256 ||
    receipt.idempotencyKey !== bundle.plan.binding.idempotencyKey ||
    (bundle.plan.kind === 'compensation' &&
      receipt.kind === 'compensation_receipt' &&
      receipt.targetImportOperationId !== bundle.plan.targetImportOperationId)
  ) {
    throw new Error('RPC receipt does not match the exact plan identity and binding.')
  }
  if (
    receipt.beforePhysicalStateSha256 !== bundle.plan.expectedPhysicalStateSha256 ||
    receipt.beforeEffectiveStateSha256 !== bundle.plan.expectedEffectiveStateSha256
  ) {
    throw new Error('RPC receipt does not match the authorized physical/effective pre-state.')
  }
  const expectedApplied =
    bundle.plan.kind === 'import'
      ? bundle.plan.counts.inserts
      : bundle.plan.counts.restored + bundle.plan.counts.voided
  if (
    receipt.counts.planned !== expectedApplied ||
    (receipt.outcome === 'committed' &&
      (receipt.counts.applied !== expectedApplied ||
        receipt.counts.noops !== bundle.plan.counts.noops ||
        receipt.error !== null))
  ) {
    throw new Error('RPC receipt action counts or terminal error state are inconsistent.')
  }
  if (
    receipt.outcome === 'committed' &&
    receipt.afterEffectiveStateSha256 !== bundle.plan.expectedPostEffectiveStateSha256
  ) {
    throw new Error('Committed RPC receipt does not match the authorized effective post-state.')
  }
  if (
    receipt.outcome === 'failed' &&
    (receipt.afterEffectiveStateSha256 !== receipt.beforeEffectiveStateSha256 ||
      receipt.afterPhysicalStateSha256 === receipt.beforePhysicalStateSha256 ||
      receipt.counts.applied !== 0 ||
      receipt.counts.noops !== 0 ||
      receipt.error === null)
  ) {
    throw new Error('Failed RPC receipt does not prove atomic effective-state rollback and audit.')
  }
  const started = bundle.plan.kind === 'import' ? 'import_started' : 'import_compensation_started'
  const terminal =
    receipt.outcome === 'failed'
      ? bundle.plan.kind === 'import'
        ? 'import_failed'
        : 'import_compensation_failed'
      : bundle.plan.kind === 'import'
        ? 'import_completed'
        : 'import_compensation_completed'
  const expectedEventSequence =
    receipt.outcome === 'failed'
      ? [started, terminal]
      : [
          started,
          ...bundle.plan.actions.flatMap((action) => [...action.expectedEventSequence]),
          terminal,
        ]
  if (canonicalJson(receipt.eventSequence) !== canonicalJson(expectedEventSequence)) {
    throw new Error('RPC receipt event sequence does not match the exact authorized action plan.')
  }
  return receipt
}

function preparedEnvelope(
  command: 'execute-import' | 'execute-compensation',
  bundle: ImportBundle | CompensationBundle,
): ExecutionEnvelope {
  const compensation = bundle.plan.kind === 'compensation'
  return bindEnvelope({
    artifactSha256: bundle.sourceArtifactSha256,
    attemptedAt: null,
    authorizationSha256: bundle.authorization.binding.contentSha256,
    batchId: bundle.plan.batchId,
    command,
    completedAt: null,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    error: null,
    idempotencyKey: bundle.plan.binding.idempotencyKey,
    kind: compensation
      ? 'gold_review_compensation_execution_envelope'
      : 'gold_review_import_execution_envelope',
    operationId: bundle.plan.operationId,
    planSha256: bundle.plan.binding.contentSha256,
    result: null,
    rpcName: compensation ? APPLY_COMPENSATION_RPC : APPLY_IMPORT_RPC,
    state: 'prepared',
    target: 'local',
    targetImportOperationId:
      'targetImportOperationId' in bundle.plan ? bundle.plan.targetImportOperationId : null,
  })
}

function replaceEnvelope(
  envelope: ExecutionEnvelope,
  changes: Partial<ExecutionEnvelopeContent>,
): ExecutionEnvelope {
  const content = Object.fromEntries(
    Object.entries(envelope).filter(([key]) => key !== 'binding'),
  ) as unknown as ExecutionEnvelopeContent
  return bindEnvelope({ ...content, ...changes })
}

function importRpcArguments(bundle: ImportBundle, actor: ReturnType<typeof parseActor>) {
  return {
    p_operation_id: bundle.plan.operationId,
    p_idempotency_key: bundle.plan.binding.idempotencyKey,
    p_batch_id: bundle.plan.batchId,
    p_artifact_sha256: bundle.sourceArtifactSha256,
    p_plan_sha256: bundle.plan.binding.contentSha256,
    p_plan: bundle.plan,
    p_authorization_sha256: bundle.authorization.binding.contentSha256,
    p_authorization: bundle.authorization,
    p_actor_user_id: actor.actorUserId,
    p_actor_email: actor.actorEmail,
  }
}

function compensationRpcArguments(
  bundle: CompensationBundle,
  actor: ReturnType<typeof parseActor>,
) {
  return {
    p_operation_id: bundle.plan.operationId,
    p_target_import_operation_id: bundle.plan.targetImportOperationId,
    p_idempotency_key: bundle.plan.binding.idempotencyKey,
    p_batch_id: bundle.plan.batchId,
    p_artifact_sha256: bundle.sourceArtifactSha256,
    p_plan_sha256: bundle.plan.binding.contentSha256,
    p_plan: bundle.plan,
    p_authorization_sha256: bundle.authorization.binding.contentSha256,
    p_authorization: bundle.authorization,
    p_actor_user_id: actor.actorUserId,
    p_actor_email: actor.actorEmail,
  }
}

async function execute(
  command: 'execute-import' | 'execute-compensation',
  arguments_: ParsedCliArguments,
  workspaceRoot: string,
  dependencies: Required<GoldImportCompensationCliDependencies>,
): Promise<ExecutionEnvelope> {
  assertLocalTarget(arguments_)
  await assertPrimaryCheckout(dependencies)
  const bundle =
    command === 'execute-import'
      ? await loadImportBundle(arguments_, workspaceRoot)
      : await loadCompensationBundle(arguments_, workspaceRoot)
  if (bundle.plan.faultAfterAction !== undefined) {
    throw new Error('faultAfterAction is rehearsal-only and cannot be used by the executor.')
  }
  await assertRepositoryCommit(bundle.plan.executionContext.repositoryCommitSha, dependencies)
  const actor = parseActor(arguments_)
  const configuration = localDatabaseConfiguration(dependencies.env)
  const client = dependencies.createClient(configuration.url, configuration.serviceRoleKey)
  const receiptPath = absolute(workspaceRoot, required(arguments_, 'receipt'))
  let envelope = preparedEnvelope(command, bundle)
  const handle = await createExclusiveEnvelope(receiptPath, envelope)

  try {
    envelope = replaceEnvelope(envelope, {
      attemptedAt: dependencies.now(),
      state: 'rpc_in_flight_or_outcome_unknown',
    })
    await writeEnvelope(handle, envelope)

    let response: DatabaseResult<unknown>
    try {
      response = await client.rpc(
        command === 'execute-import' ? APPLY_IMPORT_RPC : APPLY_COMPENSATION_RPC,
        command === 'execute-import'
          ? importRpcArguments(bundle as ImportBundle, actor)
          : compensationRpcArguments(bundle as CompensationBundle, actor),
      )
    } catch (error) {
      const normalized = normalizeError(error)
      envelope = replaceEnvelope(envelope, {
        completedAt: dependencies.now(),
        error: normalized,
        state: 'rpc_outcome_ambiguous',
      })
      await writeEnvelope(handle, envelope)
      throw new Error(
        `RPC outcome is ambiguous; do not retry automatically. Reconcile operation ${bundle.plan.operationId}.`,
      )
    }

    if (response.error) {
      const normalized = normalizeError(response.error)
      envelope = replaceEnvelope(envelope, {
        completedAt: dependencies.now(),
        error: normalized,
        state:
          normalized.code && DEFINITIVE_CONTRACT_SQLSTATE_PATTERN.test(normalized.code)
            ? 'rpc_rejected'
            : 'rpc_outcome_ambiguous',
      })
      await writeEnvelope(handle, envelope)
      const guidance =
        envelope.state === 'rpc_outcome_ambiguous'
          ? 'Do not retry automatically; reconcile the operation.'
          : 'The database rejected the call.'
      throw new Error(`${normalized.message} ${guidance}`)
    }

    let parsedReceipt: ImportReceipt | CompensationReceipt
    try {
      parsedReceipt = rpcReceipt(response.data, bundle)
    } catch (error) {
      envelope = replaceEnvelope(envelope, {
        completedAt: dependencies.now(),
        error: normalizeError(error),
        state: 'rpc_outcome_ambiguous',
      })
      await writeEnvelope(handle, envelope)
      throw new Error(
        `RPC result is ambiguous; do not retry automatically. Reconcile operation ${bundle.plan.operationId}.`,
      )
    }

    envelope = replaceEnvelope(envelope, {
      completedAt: dependencies.now(),
      result: parsedReceipt,
      state: 'rpc_response_received',
    })
    await writeEnvelope(handle, envelope)
    if (parsedReceipt.outcome === 'failed') {
      throw new Error(`Operation ${bundle.plan.operationId} failed; see ${receiptPath}.`)
    }
    dependencies.log(canonicalJson(envelope))
    return envelope
  } finally {
    await handle.close()
  }
}

function parseOperationId(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new Error('--operation-id must be a UUID.')
  return value.toLowerCase()
}

function reconciliationResponse(
  input: unknown,
  authorization: ReturnType<typeof parseRecoveryAuthorization>,
): Pick<ReconciliationResult, 'response' | 'responseKind'> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Reconciliation RPC returned no result object.')
  }
  const response = input as Record<string, unknown>
  if (response.kind === 'import_receipt' || response.kind === 'compensation_receipt') {
    const receipt =
      response.kind === 'import_receipt'
        ? parseImportReceipt(response)
        : parseCompensationReceipt(response)
    const expectedKind = authorization.recoveryAction.endsWith('_import')
      ? 'import_receipt'
      : 'compensation_receipt'
    if (
      receipt.kind !== expectedKind ||
      receipt.operationId !== authorization.targetOperationId ||
      receipt.batchId !== authorization.batchId ||
      receipt.planSha256 !== authorization.targetPlanSha256 ||
      receipt.idempotencyKey !== authorization.targetIdempotencyKey
    ) {
      throw new Error('Reconciliation receipt is not bound to the recovery authorization.')
    }
    return { response: receipt, responseKind: 'terminal_receipt' }
  }
  if (response.operationId !== authorization.targetOperationId) {
    throw new Error('Reconciliation result is not bound to the recovery operation identity.')
  }
  if (response.status === 'absent') {
    if (
      response.permitsMutation !== false ||
      response.requiresFreshPlanAndAuthorization !== true ||
      response.physicalStateSha256 !== authorization.observedPhysicalStateSha256 ||
      response.effectiveStateSha256 !== authorization.observedEffectiveStateSha256
    ) {
      throw new Error('Absent-operation reconciliation evidence is invalid or stale.')
    }
    return { response, responseKind: 'absent' }
  }
  if (
    response.status !== 'started' ||
    response.operationKind !==
      (authorization.recoveryAction.endsWith('_import') ? 'import' : 'compensation') ||
    response.recoveryRequired !== true ||
    response.permitsMutation !== false
  ) {
    throw new Error('Reconciliation RPC returned an unsupported non-terminal result.')
  }
  return { response, responseKind: 'recovery_required' }
}

async function reconcile(
  arguments_: ParsedCliArguments,
  workspaceRoot: string,
  dependencies: Required<GoldImportCompensationCliDependencies>,
): Promise<ReconciliationResult> {
  assertLocalTarget(arguments_)
  const operationId = parseOperationId(required(arguments_, 'operation-id'))
  const authorization = parseRecoveryAuthorization(
    await readJson(absolute(workspaceRoot, required(arguments_, 'recovery-authorization'))),
  )
  if (authorization.targetOperationId !== operationId) {
    throw new Error('Recovery authorization is not bound to --operation-id.')
  }
  await assertRepositoryCommit(authorization.repositoryCommitSha, dependencies)
  const configuration = localDatabaseConfiguration(dependencies.env)
  const client = dependencies.createClient(configuration.url, configuration.serviceRoleKey)

  const response = await client.rpc(RECONCILE_OPERATION_RPC, {
    p_operation_id: operationId,
    p_recovery_authorization_sha256: authorization.binding.contentSha256,
    p_recovery_authorization: authorization,
  })
  if (response.error) {
    throw new Error(`Operation reconciliation RPC failed: ${response.error.message}`)
  }
  const parsedResponse = reconciliationResponse(response.data, authorization)
  const result: ReconciliationResult = {
    authorization: {
      bindingSha256: authorization.binding.contentSha256,
      permitsMutation: authorization.permitsMutation,
      recoveryAction: authorization.recoveryAction,
    },
    command: 'reconcile',
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    ...parsedResponse,
    target: 'local',
  }
  dependencies.log(canonicalJson(result))
  return result
}

function dependenciesWithDefaults(
  dependencies: GoldImportCompensationCliDependencies,
): Required<GoldImportCompensationCliDependencies> {
  return {
    createClient: dependencies.createClient ?? productionClientFactory,
    env: dependencies.env ?? process.env,
    log: dependencies.log ?? console.log,
    now: dependencies.now ?? (() => new Date().toISOString()),
    primaryCheckout: dependencies.primaryCheckout ?? livePrimaryCheckout,
    repositoryCommitSha: dependencies.repositoryCommitSha ?? liveRepositoryCommitSha,
  }
}

function assertValidationArguments(
  arguments_: ParsedCliArguments,
  kind: 'import' | 'compensation',
): void {
  assertKnownArguments(arguments_, [
    'artifact',
    'authorization',
    'help',
    'plan',
    ...(kind === 'import' ? ['source-authorization-set'] : []),
  ])
}

function assertExecutionArguments(
  arguments_: ParsedCliArguments,
  kind: 'import' | 'compensation',
): void {
  assertKnownArguments(arguments_, [
    'actor-email',
    'actor-user-id',
    'artifact',
    'authorization',
    'help',
    'plan',
    'receipt',
    ...(kind === 'import' ? ['source-authorization-set'] : []),
    'target',
  ])
}

export async function runGoldImportCompensationCli(
  argv: string[],
  workspaceRoot = process.cwd(),
  suppliedDependencies: GoldImportCompensationCliDependencies = {},
): Promise<GoldImportCompensationCliResult> {
  const [command, ...rest] = argv
  const dependencies = dependenciesWithDefaults(suppliedDependencies)
  if (!command || command === '--help' || command === 'help') {
    dependencies.log(HELP)
    return undefined
  }
  const arguments_ = parseCliArguments(rest)
  if (hasFlag(arguments_, 'help')) {
    dependencies.log(HELP)
    return undefined
  }

  switch (command) {
    case 'validate-import': {
      assertValidationArguments(arguments_, 'import')
      const bundle = await loadImportBundle(arguments_, workspaceRoot)
      const repositoryCommitSha = await assertRepositoryCommit(
        bundle.plan.executionContext.repositoryCommitSha,
        dependencies,
      )
      const result = validationResult('validate-import', bundle, repositoryCommitSha)
      dependencies.log(canonicalJson(result))
      return result
    }
    case 'execute-import':
      assertExecutionArguments(arguments_, 'import')
      return execute('execute-import', arguments_, workspaceRoot, dependencies)
    case 'validate-compensation': {
      assertValidationArguments(arguments_, 'compensation')
      const bundle = await loadCompensationBundle(arguments_, workspaceRoot)
      const repositoryCommitSha = await assertRepositoryCommit(
        bundle.plan.executionContext.repositoryCommitSha,
        dependencies,
      )
      const result = validationResult('validate-compensation', bundle, repositoryCommitSha)
      dependencies.log(canonicalJson(result))
      return result
    }
    case 'execute-compensation':
      assertExecutionArguments(arguments_, 'compensation')
      return execute('execute-compensation', arguments_, workspaceRoot, dependencies)
    case 'reconcile':
      assertKnownArguments(arguments_, ['help', 'operation-id', 'recovery-authorization', 'target'])
      return reconcile(arguments_, workspaceRoot, dependencies)
    default:
      throw new Error(`Unknown gold import-compensation command: ${command}`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadEnvConfig(process.cwd())
  void runGoldImportCompensationCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
