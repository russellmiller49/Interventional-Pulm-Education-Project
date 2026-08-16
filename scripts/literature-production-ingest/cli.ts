import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { redact, sha256 } from './canonical'
import { CheckpointStore, acquireCheckpointLease, writeReceiptImmutable } from './checkpoint'
import { assertNoCredentialArguments, resolveDestinationBinding } from './config'
import {
  DEFAULT_BYTE_BATCH_LIMIT,
  CANARY_MANIFEST_CHECKSUM_ENV_NAME,
  DEFAULT_CONCURRENCY,
  DEFAULT_RECORD_BATCH_LIMIT,
  DESTINATION_ENV_NAMES,
  FULL_EXPECTED_RECORD_COUNT_ENV_NAME,
  FULL_EXPECTED_SOURCE_SHA256_ENV_NAME,
  ENGINE_VERSION,
  MAPPING_VERSION,
  MAX_CONCURRENCY,
  MIN_PRODUCTION_BYTE_BATCH_LIMIT,
  SOURCE_CONTAINER_ID,
} from './constants'
import {
  createCompletedReceiptFromCheckpoint,
  createIdempotentReplayReceipt,
  executeIngestion,
  planIngestion,
  type SourceFactory as BoundSourceFactory,
} from './engine'
import { createCanaryManifest, readCanaryManifest, validateCanaryMixture } from './manifest'
import { mapSourceEnvelope } from './mapping'
import { applyReconciliationReceipt, reconcileCheckpoint } from './reconcile'
import { createSourceFactory } from './source'
import { PostgrestTransport } from './transport'
import { scanSourceProjection } from './batching'
import type {
  BatchLimits,
  CanaryCandidate,
  CanaryManifest,
  Checkpoint,
  IngestReceipt,
  IngestMode,
  ReconciliationReceipt,
  SourceEnvelope,
  SourceProjection,
} from './types'
import { readIngestReceipt, verifyCompletedIngestion } from './verify'

const HELP = `
Accelerated Literature bibliographic ingestion operator.

Usage:
  tsx scripts/literature-production-ingest/cli.ts validate --mode canary --manifest <path>
  tsx scripts/literature-production-ingest/cli.ts validate --mode full
  tsx scripts/literature-production-ingest/cli.ts validate --candidate-file <path> --manifest-out <path> --seed <seed>
  tsx scripts/literature-production-ingest/cli.ts dry-run --mode canary --manifest <path> [limits]
  tsx scripts/literature-production-ingest/cli.ts dry-run --mode full [limits]
  tsx scripts/literature-production-ingest/cli.ts canary --manifest <path> --confirm-production-write [limits]
  tsx scripts/literature-production-ingest/cli.ts full --confirm-production-write [limits]
  tsx scripts/literature-production-ingest/cli.ts canary|full --resume --checkpoint <path> --confirm-production-write [--reconciliation <path>]
  tsx scripts/literature-production-ingest/cli.ts reconcile --checkpoint <path> [--manifest <path>]
  tsx scripts/literature-production-ingest/cli.ts verify --checkpoint <path> --receipt <path> [--manifest <path>]

Limits:
  --record-batch-limit <n>  Default ${DEFAULT_RECORD_BATCH_LIMIT}; maximum 500.
  --byte-batch-limit <n>    Default ${DEFAULT_BYTE_BATCH_LIMIT} UTF-8 request bytes.
  --concurrency <n>         Default ${DEFAULT_CONCURRENCY}; maximum ${MAX_CONCURRENCY}.
  --state-dir <path>        Default LITERATURE_INGEST_STATE_DIR or local-data/literature-production-ingest.

Destination credentials and target values are accepted only through the dedicated environment.

Environment:
  LITERATURE_SUPABASE_URL=https://itcttmkxdxvwmwcmzmey.supabase.co/
  LITERATURE_SUPABASE_EXPECTED_PROJECT_REF=itcttmkxdxvwmwcmzmey
  LITERATURE_SUPABASE_SECRET_KEY=sb_secret_... (mutation/reconcile/verify only)
  LITERATURE_CANARY_MANIFEST_SHA256=<owner-approved SHA-256> (all canary manifest reads)
  LITERATURE_FULL_EXPECTED_RECORD_COUNT=<owner-approved count> (full mutation/recovery)
  LITERATURE_FULL_EXPECTED_SOURCE_SHA256=<owner-approved SHA-256> (full mutation/recovery)
  LITERATURE_CANARY_MANIFEST_PATH=<optional default manifest path>
  LITERATURE_INGEST_STATE_DIR=<optional default artifact directory>
`.trim()

interface ParsedArguments {
  command: string
  flags: Set<string>
  values: Map<string, string>
}

const VALUE_OPTIONS = new Set([
  'mode',
  'manifest',
  'candidate-file',
  'manifest-out',
  'seed',
  'record-batch-limit',
  'byte-batch-limit',
  'concurrency',
  'state-dir',
  'checkpoint',
  'reconciliation',
  'receipt',
])
const FLAG_OPTIONS = new Set(['help', 'resume', 'confirm-production-write'])

function parseArguments(argv: readonly string[]): ParsedArguments {
  assertNoCredentialArguments(argv)
  const command = argv[0]
  if (!command || command.startsWith('--')) {
    throw new Error('Exactly one operator command is required. Use --help for usage.')
  }
  const flags = new Set<string>()
  const values = new Map<string, string>()
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith('--')) {
      throw new Error('Unexpected positional argument. Use --help for usage.')
    }
    const equals = argument.indexOf('=')
    const name = argument.slice(2, equals < 0 ? undefined : equals)
    if (FLAG_OPTIONS.has(name)) {
      if (equals >= 0) throw new Error(`--${name} does not take a value.`)
      flags.add(name)
      continue
    }
    if (!VALUE_OPTIONS.has(name)) throw new Error(`Unknown option --${name}.`)
    const value = equals >= 0 ? argument.slice(equals + 1) : argv[index + 1]
    if (!value || (equals < 0 && value.startsWith('--'))) {
      throw new Error(`--${name} requires a value.`)
    }
    if (values.has(name)) throw new Error(`--${name} may be supplied only once.`)
    values.set(name, value)
    if (equals < 0) index += 1
  }
  return { command, flags, values }
}

function option(arguments_: ParsedArguments, name: string): string | undefined {
  return arguments_.values.get(name)
}

function assertAllowedOptions(
  arguments_: ParsedArguments,
  valueOptions: readonly string[],
  flagOptions: readonly string[],
): void {
  const allowedValues = new Set(valueOptions)
  const allowedFlags = new Set(flagOptions)
  const unexpectedValue = [...arguments_.values.keys()].find((name) => !allowedValues.has(name))
  const unexpectedFlag = [...arguments_.flags].find((name) => !allowedFlags.has(name))
  if (unexpectedValue) {
    throw new Error(`--${unexpectedValue} is not valid for ${arguments_.command}.`)
  }
  if (unexpectedFlag) {
    throw new Error(`--${unexpectedFlag} is not valid for ${arguments_.command}.`)
  }
}

function requiredOption(arguments_: ParsedArguments, name: string): string {
  const value = option(arguments_, name)
  if (!value) throw new Error(`--${name} is required.`)
  return value
}

function positiveInteger(raw: string | undefined, fallback: number, label: string): number {
  if (raw === undefined) return fallback
  if (!/^\d+$/u.test(raw)) throw new Error(`${label} must be a positive integer.`)
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer.`)
  }
  return value
}

function limits(arguments_: ParsedArguments): BatchLimits {
  const result = {
    recordBatchLimit: positiveInteger(
      option(arguments_, 'record-batch-limit'),
      DEFAULT_RECORD_BATCH_LIMIT,
      '--record-batch-limit',
    ),
    byteBatchLimit: positiveInteger(
      option(arguments_, 'byte-batch-limit'),
      DEFAULT_BYTE_BATCH_LIMIT,
      '--byte-batch-limit',
    ),
    concurrency: positiveInteger(
      option(arguments_, 'concurrency'),
      DEFAULT_CONCURRENCY,
      '--concurrency',
    ),
  }
  if (result.recordBatchLimit > 500) {
    throw new Error('--record-batch-limit must not exceed 500.')
  }
  if (result.byteBatchLimit < MIN_PRODUCTION_BYTE_BATCH_LIMIT) {
    throw new Error(`--byte-batch-limit must be at least ${MIN_PRODUCTION_BYTE_BATCH_LIMIT}.`)
  }
  if (result.concurrency > MAX_CONCURRENCY) {
    throw new Error(`--concurrency must not exceed ${MAX_CONCURRENCY}.`)
  }
  return result
}

function modeOption(arguments_: ParsedArguments): IngestMode {
  const mode = requiredOption(arguments_, 'mode')
  if (mode !== 'canary' && mode !== 'full') throw new Error('--mode must be canary or full.')
  return mode
}

function stateDirectory(arguments_: ParsedArguments): string {
  return resolve(
    option(arguments_, 'state-dir') ??
      process.env.LITERATURE_INGEST_STATE_DIR ??
      'local-data/literature-production-ingest',
  )
}

interface FullProjectionPin {
  recordCount: number
  checksum: string
}

function fullProjectionPin(required: boolean): FullProjectionPin | null {
  const countValue = process.env[FULL_EXPECTED_RECORD_COUNT_ENV_NAME]
  const checksumValue = process.env[FULL_EXPECTED_SOURCE_SHA256_ENV_NAME]
  if (countValue === undefined && checksumValue === undefined && !required) return null
  if (
    !countValue ||
    !/^[1-9]\d*$/u.test(countValue) ||
    !Number.isSafeInteger(Number(countValue)) ||
    !checksumValue ||
    !/^[a-f0-9]{64}$/u.test(checksumValue)
  ) {
    throw new Error(
      `${FULL_EXPECTED_RECORD_COUNT_ENV_NAME} and ${FULL_EXPECTED_SOURCE_SHA256_ENV_NAME} must both pin the owner-approved full projection.`,
    )
  }
  return { recordCount: Number(countValue), checksum: checksumValue }
}

function assertFullProjectionPin(projection: SourceProjection, required: boolean): void {
  const pin = fullProjectionPin(required)
  if (!pin) return
  if (projection.recordCount !== pin.recordCount || projection.checksum !== pin.checksum) {
    throw new Error('Full source projection does not match the owner-approved count and checksum.')
  }
}

function deterministicOperationId(mode: IngestMode, authorityChecksum: string): string {
  const digest = sha256(
    `${ENGINE_VERSION}\n${MAPPING_VERSION}\n${SOURCE_CONTAINER_ID}\n${mode}\n${authorityChecksum}`,
  ).split('')
  digest[12] = '8'
  digest[16] = ['8', '9', 'a', 'b'][Number.parseInt(digest[16], 16) % 4]
  const value = digest.join('').slice(0, 32)
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

function assertCheckpointManifest(checkpoint: Checkpoint, manifest: CanaryManifest | null): void {
  if (
    (checkpoint.mode === 'canary' &&
      (!manifest || checkpoint.canaryManifestChecksum !== manifest.manifestChecksum)) ||
    (checkpoint.mode === 'full' &&
      (manifest !== null || checkpoint.canaryManifestChecksum !== null))
  ) {
    throw new Error('Checkpoint is not bound to the currently authorized canary manifest.')
  }
}

async function canaryManifestFor(
  mode: IngestMode,
  arguments_: ParsedArguments,
): Promise<CanaryManifest | null> {
  const path = option(arguments_, 'manifest') ?? process.env.LITERATURE_CANARY_MANIFEST_PATH
  if (mode === 'full') {
    if (path) throw new Error('Full mode must not receive a canary manifest.')
    return null
  }
  if (!path) {
    throw new Error('Canary mode requires --manifest or LITERATURE_CANARY_MANIFEST_PATH.')
  }
  const authorizedChecksum = process.env[CANARY_MANIFEST_CHECKSUM_ENV_NAME]
  if (!authorizedChecksum || !/^[a-f0-9]{64}$/u.test(authorizedChecksum)) {
    throw new Error(
      `${CANARY_MANIFEST_CHECKSUM_ENV_NAME} must pin the owner-authorized canary manifest checksum.`,
    )
  }
  const manifest = await readCanaryManifest(resolve(path))
  if (manifest.manifestChecksum !== authorizedChecksum) {
    throw new Error('Canary manifest does not match the owner-authorized checksum pin.')
  }
  return manifest
}

function boundSource(mode: IngestMode, manifest: CanaryManifest | null): BoundSourceFactory {
  const factory = createSourceFactory()
  return { open: () => factory(mode, manifest?.pmids) }
}

function canaryCandidate(envelope: SourceEnvelope): CanaryCandidate {
  return {
    pmid: envelope.article.pmid,
    abstractPresent: Boolean(envelope.article.abstract?.trim()),
    publicationYear: envelope.article.publication_year,
    journal: envelope.article.journal_title ?? envelope.article.journal_abbreviation,
    publicationTypes: envelope.article.publication_types,
  }
}

async function writeManifestFromCandidates(arguments_: ParsedArguments): Promise<void> {
  const inputPath = resolve(requiredOption(arguments_, 'candidate-file'))
  const outputPath = resolve(requiredOption(arguments_, 'manifest-out'))
  const seed = requiredOption(arguments_, 'seed')
  const raw = await readFile(inputPath, 'utf8')
  if (Buffer.byteLength(raw) > 4 * 1024 * 1024) {
    throw new Error('Canary candidate file exceeds the maximum allowed size.')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    throw new Error('Canary candidate file is not valid JSON.')
  }
  if (!Array.isArray(parsed)) throw new Error('Canary candidate file must contain a JSON array.')
  const manifest = createCanaryManifest(parsed as CanaryCandidate[], seed)
  await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 })
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  })
  console.log(
    JSON.stringify({
      outcome: 'canary-manifest-created',
      path: outputPath,
      checksum: manifest.manifestChecksum,
    }),
  )
}

async function planMode(
  mode: IngestMode,
  manifest: CanaryManifest | null,
  batchLimits: BatchLimits,
  operationId: string,
) {
  const sourceFactory = boundSource(mode, manifest)
  const canaryCandidates: CanaryCandidate[] = []
  const planningSource: BoundSourceFactory =
    mode === 'canary'
      ? {
          open: async function* () {
            for await (const envelope of sourceFactory.open()) {
              canaryCandidates.push(canaryCandidate(envelope))
              yield envelope
            }
          },
        }
      : sourceFactory
  const mapRecord = (envelope: SourceEnvelope) => mapSourceEnvelope(envelope, operationId, mode)
  const planned = await planIngestion({
    mode,
    sourceFactory: planningSource,
    mapRecord,
    limits: batchLimits,
    canaryManifestChecksum: manifest?.manifestChecksum ?? null,
    operationId,
  })
  if (mode === 'canary' && planned.projection.recordCount !== 25) {
    throw new Error('Canary projection is not exactly 25 unique records.')
  }
  if (mode === 'canary') validateCanaryMixture(canaryCandidates)
  if (mode === 'full' && planned.projection.recordCount === 0) {
    throw new Error('Full source projection is unexpectedly empty.')
  }
  return { sourceFactory, mapRecord, planned }
}

async function validateOrDryRun(
  arguments_: ParsedArguments,
  persistReceipt: boolean,
): Promise<void> {
  resolveDestinationBinding(process.env, false)
  const mode = modeOption(arguments_)
  const manifest = await canaryManifestFor(mode, arguments_)
  const batchLimits = limits(arguments_)
  const operationId = randomUUID()
  const { sourceFactory, mapRecord, planned } = await planMode(
    mode,
    manifest,
    batchLimits,
    operationId,
  )
  if (mode === 'full') assertFullProjectionPin(planned.projection, false)
  const receipt = await executeIngestion({
    mode,
    sourceFactory,
    mapRecord,
    projection: planned.projection,
    limits: batchLimits,
    canaryManifestChecksum: manifest?.manifestChecksum ?? null,
    canaryPmids: manifest?.pmids,
    dryRun: true,
    operationId,
  })
  let receiptPath: string | null = null
  if (persistReceipt) {
    receiptPath = resolve(stateDirectory(arguments_), `${mode}-${operationId}.dry-run.receipt.json`)
    await writeReceiptImmutable(receiptPath, receipt)
  }
  console.log(
    JSON.stringify({
      outcome: persistReceipt ? 'dry-run' : 'validated',
      mode,
      records: receipt.sourceRecordCount,
      sourceProjectionChecksum: receipt.sourceProjectionChecksum,
      canaryManifestChecksum: receipt.canaryManifestChecksum,
      batchCount: receipt.batchChecksums.length,
      receiptPath,
    }),
  )
}

async function readReconciliationReceipt(path: string): Promise<ReconciliationReceipt> {
  const raw = await readFile(resolve(path), 'utf8')
  if (Buffer.byteLength(raw) > 2 * 1024 * 1024) {
    throw new Error('Reconciliation receipt exceeds the maximum allowed size.')
  }
  try {
    return JSON.parse(raw) as ReconciliationReceipt
  } catch {
    throw new Error('Reconciliation receipt is not valid JSON.')
  }
}

function isNodeError(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === code)
}

async function loadOrRecoverCompletedReceipt(input: {
  path: string
  checkpoint: Checkpoint
  manifest: CanaryManifest | null
  transport: PostgrestTransport
}): Promise<{ receipt: IngestReceipt; recovered: boolean }> {
  let receipt: IngestReceipt
  let recovered = false
  try {
    receipt = await readIngestReceipt(input.path)
  } catch (error) {
    if (!isNodeError(error, 'ENOENT')) throw error
    receipt = createCompletedReceiptFromCheckpoint({
      checkpoint: input.checkpoint,
      canaryPmids: input.manifest?.pmids,
    })
    recovered = true
  }
  await verifyCompletedIngestion({
    checkpoint: input.checkpoint,
    receipt,
    sourceFactory: boundSource(input.checkpoint.mode, input.manifest),
    mapRecord: (envelope) =>
      mapSourceEnvelope(envelope, input.checkpoint.operationId, input.checkpoint.mode),
    transport: input.transport,
    canaryPmids: input.manifest?.pmids,
  })
  if (recovered) await writeReceiptImmutable(input.path, receipt)
  return { receipt, recovered }
}

async function runMutation(arguments_: ParsedArguments, mode: IngestMode): Promise<void> {
  if (!arguments_.flags.has('confirm-production-write')) {
    throw new Error('Mutating canary/full execution requires --confirm-production-write.')
  }
  const binding = resolveDestinationBinding(process.env, true)
  if (!binding) throw new Error('Destination binding is required.')
  const transport = new PostgrestTransport(binding)
  const manifest = await canaryManifestFor(mode, arguments_)
  const isResume = arguments_.flags.has('resume')
  const checkpointOption = option(arguments_, 'checkpoint')
  if (isResume !== Boolean(checkpointOption)) {
    throw new Error('--resume and --checkpoint must be supplied together.')
  }
  if (!isResume && option(arguments_, 'reconciliation')) {
    throw new Error('--reconciliation is accepted only with --resume.')
  }

  if (isResume && checkpointOption) {
    const store = new CheckpointStore(resolve(checkpointOption))
    const lease = await acquireCheckpointLease(store.path)
    try {
      let checkpoint = await store.load()
      if (checkpoint.mode !== mode) throw new Error('Checkpoint mode does not match the command.')
      assertCheckpointManifest(checkpoint, manifest)
      if (checkpoint.phase === 'completed') {
        if (option(arguments_, 'reconciliation')) {
          throw new Error('A completed checkpoint must not receive a reconciliation receipt.')
        }
        if (mode === 'full') {
          assertFullProjectionPin(
            {
              recordCount: checkpoint.sourceRecordCount,
              duplicateOccurrences: checkpoint.counters.duplicateOccurrences,
              checksum: checkpoint.sourceProjectionChecksum,
            },
            true,
          )
        }
        const receiptPath = resolve(
          dirname(store.path),
          `${mode}-${checkpoint.operationId}.receipt.json`,
        )
        const result = await loadOrRecoverCompletedReceipt({
          path: receiptPath,
          checkpoint,
          manifest,
          transport,
        })
        console.log(
          JSON.stringify({
            outcome: result.recovered ? 'completed-receipt-recovered' : 'completed-verified',
            mode,
            checkpoint: store.path,
            receipt: receiptPath,
          }),
        )
        return
      }
      const sourceFactory = boundSource(mode, manifest)
      const mapRecord = (envelope: SourceEnvelope) =>
        mapSourceEnvelope(envelope, checkpoint.operationId, mode)
      const resumedProjection = await scanSourceProjection(sourceFactory.open(), mapRecord)
      if (
        resumedProjection.checksum !== checkpoint.sourceProjectionChecksum ||
        resumedProjection.recordCount !== checkpoint.sourceRecordCount ||
        resumedProjection.duplicateOccurrences !== checkpoint.counters.duplicateOccurrences
      ) {
        throw new Error('Resume source projection drifted from the durable checkpoint.')
      }
      if (mode === 'full') assertFullProjectionPin(resumedProjection, true)
      const reconciliationPath = option(arguments_, 'reconciliation')
      if (reconciliationPath) {
        checkpoint = await applyReconciliationReceipt(
          store,
          await readReconciliationReceipt(reconciliationPath),
        )
      }
      if (checkpoint.phase === 'needs_reconciliation') {
        throw new Error('Checkpoint requires a read-only reconciliation receipt before resume.')
      }
      const receipt = await executeIngestion({
        mode,
        sourceFactory,
        mapRecord,
        projection: resumedProjection,
        limits: checkpoint.limits,
        canaryManifestChecksum: manifest?.manifestChecksum ?? null,
        canaryPmids: manifest?.pmids,
        dryRun: false,
        destination: transport,
        ledger: store,
      })
      const receiptPath = resolve(
        dirname(store.path),
        `${mode}-${checkpoint.operationId}.receipt.json`,
      )
      await writeReceiptImmutable(receiptPath, receipt)
      console.log(
        JSON.stringify({
          outcome: receipt.outcome,
          mode,
          checkpoint: store.path,
          receipt: receiptPath,
        }),
      )
      return
    } finally {
      await lease.release()
    }
  }

  const authorityChecksum =
    mode === 'canary'
      ? (manifest as CanaryManifest).manifestChecksum
      : (fullProjectionPin(true) as FullProjectionPin).checksum
  const operationId = deterministicOperationId(mode, authorityChecksum)
  const batchLimits = limits(arguments_)
  const { sourceFactory, mapRecord, planned } = await planMode(
    mode,
    manifest,
    batchLimits,
    operationId,
  )
  if (mode === 'full') assertFullProjectionPin(planned.projection, true)
  const completed = await transport.findCompletedImportBatch(planned.identity)
  const directory = stateDirectory(arguments_)
  if (completed) {
    const checkpointPath = resolve(directory, `${mode}-${completed.id}.checkpoint.json`)
    const originalReceiptPath = resolve(directory, `${mode}-${completed.id}.receipt.json`)
    const store = new CheckpointStore(checkpointPath)
    const checkpoint = await store.load()
    assertCheckpointManifest(checkpoint, manifest)
    await loadOrRecoverCompletedReceipt({
      path: originalReceiptPath,
      checkpoint,
      manifest,
      transport,
    })
    const replay = createIdempotentReplayReceipt({
      checkpoint,
      articleCount: await transport.countArticles(),
      canaryPmids: manifest?.pmids,
    })
    const replayPath = resolve(
      directory,
      `${mode}-${completed.id}.replay-${Date.now()}.receipt.json`,
    )
    await writeReceiptImmutable(replayPath, replay)
    console.log(
      JSON.stringify({
        outcome: replay.outcome,
        mode,
        checkpoint: checkpointPath,
        receipt: replayPath,
      }),
    )
    return
  }

  const unfinished = await transport.getImportBatch(operationId)
  if (unfinished) {
    throw new Error(
      'A deterministic unfinished operation already exists; resume its durable checkpoint or reconcile it read-only.',
    )
  }

  const checkpointPath = resolve(directory, `${mode}-${operationId}.checkpoint.json`)
  const store = new CheckpointStore(checkpointPath)
  const lease = await acquireCheckpointLease(store.path)
  try {
    await store.create(planned.checkpoint)
    const receipt = await executeIngestion({
      mode,
      sourceFactory,
      mapRecord,
      projection: planned.projection,
      limits: batchLimits,
      canaryManifestChecksum: manifest?.manifestChecksum ?? null,
      canaryPmids: manifest?.pmids,
      dryRun: false,
      destination: transport,
      ledger: store,
    })
    const receiptPath = resolve(directory, `${mode}-${operationId}.receipt.json`)
    await writeReceiptImmutable(receiptPath, receipt)
    console.log(
      JSON.stringify({
        outcome: receipt.outcome,
        mode,
        checkpoint: checkpointPath,
        receipt: receiptPath,
      }),
    )
  } finally {
    await lease.release()
  }
}

async function reconcileCommand(arguments_: ParsedArguments): Promise<void> {
  const binding = resolveDestinationBinding(process.env, true)
  if (!binding) throw new Error('Destination binding is required.')
  const store = new CheckpointStore(resolve(requiredOption(arguments_, 'checkpoint')))
  const checkpoint = await store.load()
  const manifest = await canaryManifestFor(checkpoint.mode, arguments_)
  assertCheckpointManifest(checkpoint, manifest)
  if (checkpoint.mode === 'full') {
    assertFullProjectionPin(
      {
        recordCount: checkpoint.sourceRecordCount,
        duplicateOccurrences: checkpoint.counters.duplicateOccurrences,
        checksum: checkpoint.sourceProjectionChecksum,
      },
      true,
    )
  }
  const sourceFactory = boundSource(checkpoint.mode, manifest)
  const receipt = await reconcileCheckpoint({
    checkpoint,
    sourceFactory,
    mapRecord: (envelope) => mapSourceEnvelope(envelope, checkpoint.operationId, checkpoint.mode),
    transport: new PostgrestTransport(binding),
  })
  const receiptPath = resolve(
    stateDirectory(arguments_),
    `${checkpoint.mode}-${checkpoint.operationId}.reconciliation-${receipt.receiptChecksum.slice(0, 12)}.json`,
  )
  await writeReceiptImmutable(receiptPath, receipt)
  console.log(
    JSON.stringify({
      outcome: 'reconciled-read-only',
      operationId: checkpoint.operationId,
      observations: receipt.observations.map((observation) => observation.classification),
      receipt: receiptPath,
    }),
  )
}

async function verifyCommand(arguments_: ParsedArguments): Promise<void> {
  const binding = resolveDestinationBinding(process.env, true)
  if (!binding) throw new Error('Destination binding is required.')
  const store = new CheckpointStore(resolve(requiredOption(arguments_, 'checkpoint')))
  const checkpoint = await store.load()
  const receipt = await readIngestReceipt(resolve(requiredOption(arguments_, 'receipt')))
  const manifest = await canaryManifestFor(checkpoint.mode, arguments_)
  assertCheckpointManifest(checkpoint, manifest)
  if (checkpoint.mode === 'full') {
    assertFullProjectionPin(
      {
        recordCount: checkpoint.sourceRecordCount,
        duplicateOccurrences: checkpoint.counters.duplicateOccurrences,
        checksum: checkpoint.sourceProjectionChecksum,
      },
      true,
    )
  }
  const report = await verifyCompletedIngestion({
    checkpoint,
    receipt,
    sourceFactory: boundSource(checkpoint.mode, manifest),
    mapRecord: (envelope) => mapSourceEnvelope(envelope, checkpoint.operationId, checkpoint.mode),
    transport: new PostgrestTransport(binding),
    canaryPmids: manifest?.pmids,
  })
  console.log(JSON.stringify({ outcome: 'verified-read-only', ...report }))
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  if (argv.length === 1 && argv[0] === '--help') {
    console.log(HELP)
    return
  }
  const arguments_ = parseArguments(argv)
  if (arguments_.flags.has('help')) {
    console.log(HELP)
    return
  }
  switch (arguments_.command) {
    case 'validate':
      if (option(arguments_, 'candidate-file')) {
        assertAllowedOptions(arguments_, ['candidate-file', 'manifest-out', 'seed'], [])
        resolveDestinationBinding(process.env, false)
        await writeManifestFromCandidates(arguments_)
      } else {
        assertAllowedOptions(
          arguments_,
          ['mode', 'manifest', 'record-batch-limit', 'byte-batch-limit', 'concurrency'],
          [],
        )
        await validateOrDryRun(arguments_, false)
      }
      return
    case 'dry-run':
      assertAllowedOptions(
        arguments_,
        ['mode', 'manifest', 'record-batch-limit', 'byte-batch-limit', 'concurrency', 'state-dir'],
        [],
      )
      await validateOrDryRun(arguments_, true)
      return
    case 'canary':
    case 'full':
      assertAllowedOptions(
        arguments_,
        arguments_.flags.has('resume')
          ? ['manifest', 'checkpoint', 'reconciliation']
          : ['manifest', 'state-dir', 'record-batch-limit', 'byte-batch-limit', 'concurrency'],
        ['resume', 'confirm-production-write'],
      )
      await runMutation(arguments_, arguments_.command)
      return
    case 'reconcile':
      assertAllowedOptions(arguments_, ['checkpoint', 'manifest', 'state-dir'], [])
      await reconcileCommand(arguments_)
      return
    case 'verify':
      assertAllowedOptions(arguments_, ['checkpoint', 'receipt', 'manifest'], [])
      await verifyCommand(arguments_)
      return
    default:
      throw new Error('Unknown operator command. Use --help for usage.')
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null
if (invokedPath === import.meta.url) {
  void main().catch((error: unknown) => {
    const secret = process.env[DESTINATION_ENV_NAMES.secret]
    console.error(redact(error, secret ? [secret] : []))
    process.exitCode = 1
  })
}
