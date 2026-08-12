import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'

import { z } from 'zod'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import {
  GOLD_IMPORT_V2_FINALIZED_RECEIPT_AUTHORITY_IDENTITY_SHA256,
  GOLD_IMPORT_V2_PACKAGE_READINESS_SCHEMA_VERSION,
  GOLD_IMPORT_V2_PRIMARY_CHECKOUT,
  GOLD_IMPORT_V2_REPOSITORY_EVIDENCE_SCHEMA_VERSION,
  goldImportV2PackageReadinessStateSchema,
  goldImportV2RepositoryEvidenceSchema,
  packageReadinessStateIdentitySha256,
  sha256Bytes,
  validateGoldImportV2PackageReadinessState,
  validateGoldImportV2RepositoryEvidence,
  type GoldImportV2PackageReadinessState,
  type GoldImportV2RepositoryEvidence,
} from './gold-import-v2-package-readiness'

export const GOLD_IMPORT_V2_PREIMPORT_CAPTURE_SCHEMA_VERSION =
  'literature-gold-v2-preimport-capture/1.0.0' as const
export const GOLD_IMPORT_V2_PREIMPORT_EXECUTION_RECEIPT_SCHEMA_VERSION =
  'literature-gold-v2-preimport-capture-execution-receipt/1.0.0' as const
export const GOLD_IMPORT_V2_PREIMPORT_DUPLICATE_MARKER_SCHEMA_VERSION =
  'literature-gold-v2-preimport-capture-duplicate-marker/1.0.0' as const
export const GOLD_IMPORT_V2_PREIMPORT_RUNTIME_BUNDLE_SCHEMA_VERSION =
  'literature-gold-v2-preimport-capture-runtime-bundle/1.0.0' as const
export const GOLD_IMPORT_V2_PREIMPORT_PAIR_SCHEMA_VERSION =
  'literature-gold-v2-preimport-capture-pair/1.0.0' as const
export const GOLD_IMPORT_V2_PREIMPORT_DATABASE_CONTENT_SCHEMA_VERSION =
  'literature-gold-v2-preimport-database-content/1.0.0' as const
export const GOLD_IMPORT_V2_PREIMPORT_CAPTURE_PURPOSE =
  'post_v2_pre_import_package_readiness' as const
export const GOLD_IMPORT_V2_PREIMPORT_CAPTURE_TRUST_MODEL =
  'trusted-local-operator-redundant-captures/1.0.0' as const
export const GOLD_IMPORT_V2_PREIMPORT_CAPTURE_FRESHNESS_MS = 2 * 60 * 60 * 1_000
export const GOLD_IMPORT_V2_PREIMPORT_DUPLICATE_MARKER_DIRECTORY =
  '.literature-gold-v2-preimport-capture-instances' as const
export const GOLD_IMPORT_V2_PREIMPORT_CAPTURE_ROOT =
  `${GOLD_IMPORT_V2_PRIMARY_CHECKOUT}/local-data/literature/gold-v2-preimport-captures` as const

export const GOLD_IMPORT_V2_PREIMPORT_CAPTURE_FILES = [
  'checksum-manifest.sha256',
  'execution-receipt.json',
  'preimport-state.json',
] as const

export const GOLD_IMPORT_V2_PREIMPORT_CAPTURE_MANIFEST_FILES = ['preimport-state.json'] as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u
const ABSOLUTE_PATH_PATTERN = /^\//u
const sha256Schema = z.string().regex(SHA256_PATTERN)
const commitSchema = z.string().regex(COMMIT_PATTERN)
const absolutePathSchema = z.string().regex(ABSOLUTE_PATH_PATTERN)
const isoTimestampSchema = z.string().datetime({ offset: true })
const execFileAsync = promisify(execFile)

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalBytes(value: unknown): string {
  return canonicalJson(value)
}

function sameCanonical(left: unknown, right: unknown): boolean {
  return canonicalBytes(left) === canonicalBytes(right)
}

function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate)
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`))
}

const runtimeFileSchema = z
  .object({
    path: z.string().regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+$/u),
    sha256: sha256Schema,
  })
  .strict()

const runtimeBundleBodySchema = z
  .object({
    files: z.array(runtimeFileSchema).min(1),
    schemaVersion: z.literal(GOLD_IMPORT_V2_PREIMPORT_RUNTIME_BUNDLE_SCHEMA_VERSION),
  })
  .strict()

export const goldImportV2PreimportRuntimeBundleSchema = runtimeBundleBodySchema
  .extend({ aggregateSha256: sha256Schema })
  .strict()

export type GoldImportV2PreimportRuntimeBundle = z.infer<
  typeof goldImportV2PreimportRuntimeBundleSchema
>

export function buildGoldImportV2PreimportRuntimeBundle(
  files: readonly { bytes: string | Uint8Array; path: string }[],
): GoldImportV2PreimportRuntimeBundle {
  const normalized = files
    .map(({ bytes, path }) => runtimeFileSchema.parse({ path, sha256: sha256(bytes) }))
    .sort((left, right) => left.path.localeCompare(right.path, 'en'))
  if (new Set(normalized.map(({ path }) => path)).size !== normalized.length) {
    throw new Error('Capture runtime bundle contains duplicate file paths.')
  }
  const body = runtimeBundleBodySchema.parse({
    files: normalized,
    schemaVersion: GOLD_IMPORT_V2_PREIMPORT_RUNTIME_BUNDLE_SCHEMA_VERSION,
  })
  return goldImportV2PreimportRuntimeBundleSchema.parse({
    ...body,
    aggregateSha256: sha256(canonicalBytes(body)),
  })
}

export function validateGoldImportV2PreimportRuntimeBundle(
  input: unknown,
): GoldImportV2PreimportRuntimeBundle {
  const bundle = goldImportV2PreimportRuntimeBundleSchema.parse(input)
  const normalized = [...bundle.files].sort((left, right) =>
    left.path.localeCompare(right.path, 'en'),
  )
  if (
    new Set(normalized.map(({ path }) => path)).size !== normalized.length ||
    !sameCanonical(normalized, bundle.files)
  ) {
    throw new Error('Capture runtime bundle files are duplicated or noncanonical.')
  }
  const { aggregateSha256, ...body } = bundle
  if (sha256(canonicalBytes(body)) !== aggregateSha256) {
    throw new Error('Capture runtime bundle identity is invalid.')
  }
  return Object.freeze(bundle)
}

const databaseContentSchema = z
  .object({
    authorities: goldImportV2PackageReadinessStateSchema.shape.authorities,
    batch: goldImportV2PackageReadinessStateSchema.shape.batch,
    database: goldImportV2PackageReadinessStateSchema.shape.database,
    migrationLedger: goldImportV2PackageReadinessStateSchema.shape.migrationLedger,
    mutationAssertions: goldImportV2PackageReadinessStateSchema.shape.mutationAssertions,
    operationCounts: goldImportV2PackageReadinessStateSchema.shape.operationCounts,
    receipt: goldImportV2PackageReadinessStateSchema.shape.receipt.omit({
      finalizedLatestMtimeMs: true,
    }),
    safety: goldImportV2PackageReadinessStateSchema.shape.safety,
    schemaVersion: z.literal(GOLD_IMPORT_V2_PREIMPORT_DATABASE_CONTENT_SCHEMA_VERSION),
    stateIdentities: goldImportV2PackageReadinessStateSchema.shape.stateIdentities,
  })
  .strict()

export type GoldImportV2PreimportDatabaseContent = z.infer<typeof databaseContentSchema>

export function buildGoldImportV2PreimportDatabaseContent(
  readinessInput: GoldImportV2PackageReadinessState,
): GoldImportV2PreimportDatabaseContent {
  const readiness = validateGoldImportV2PackageReadinessState(readinessInput)
  const { finalizedLatestMtimeMs: _observationTime, ...receipt } = readiness.receipt
  void _observationTime
  return databaseContentSchema.parse({
    authorities: readiness.authorities,
    batch: readiness.batch,
    database: readiness.database,
    migrationLedger: readiness.migrationLedger,
    mutationAssertions: readiness.mutationAssertions,
    operationCounts: readiness.operationCounts,
    receipt,
    safety: readiness.safety,
    schemaVersion: GOLD_IMPORT_V2_PREIMPORT_DATABASE_CONTENT_SCHEMA_VERSION,
    stateIdentities: readiness.stateIdentities,
  })
}

const captureBodySchema = z
  .object({
    artifactClass: z.literal('operator_only'),
    canonicalDatabaseState: databaseContentSchema,
    canonicalDatabaseStateSha256: sha256Schema,
    captureId: z.string().uuid(),
    captureRuntimeBundle: goldImportV2PreimportRuntimeBundleSchema,
    capturedAt: isoTimestampSchema,
    executionNonce: sha256Schema,
    outputDirectory: absolutePathSchema,
    packageReadiness: goldImportV2PackageReadinessStateSchema,
    packageReadinessIdentitySha256: sha256Schema,
    purpose: z.literal(GOLD_IMPORT_V2_PREIMPORT_CAPTURE_PURPOSE),
    repository: goldImportV2RepositoryEvidenceSchema,
    safetyBoundary: z
      .object({
        compensationAuthorized: z.literal(false),
        heldOutIdentitiesAccessed: z.literal(false),
        importAuthorized: z.literal(false),
        packageExecutionAuthorized: z.literal(false),
        remoteDatabaseAccessed: z.literal(false),
        writeCapableDatabaseClientConstructed: z.literal(false),
      })
      .strict(),
    schemaVersion: z.literal(GOLD_IMPORT_V2_PREIMPORT_CAPTURE_SCHEMA_VERSION),
  })
  .strict()

export const goldImportV2PreimportCaptureSchema = captureBodySchema
  .extend({ captureIdentitySha256: sha256Schema })
  .strict()

export type GoldImportV2PreimportCapture = z.infer<typeof goldImportV2PreimportCaptureSchema>

function validateCaptureTime(input: {
  capturedAt: string
  finalizedLatestMtimeMs: number
  nowMs?: number
}): void {
  const capturedAtMs = Date.parse(input.capturedAt)
  if (!Number.isFinite(capturedAtMs)) throw new Error('Capture timestamp is invalid.')
  if (capturedAtMs < input.finalizedLatestMtimeMs) {
    throw new Error('Post-V2 pre-import capture predates finalized migration receipt evidence.')
  }
  if (input.nowMs !== undefined) {
    if (capturedAtMs > input.nowMs + 5_000) {
      throw new Error('Post-V2 pre-import capture timestamp is in the future.')
    }
    if (input.nowMs - capturedAtMs > GOLD_IMPORT_V2_PREIMPORT_CAPTURE_FRESHNESS_MS) {
      throw new Error('Post-V2 pre-import capture is stale.')
    }
  }
}

export function buildGoldImportV2PreimportCapture(input: {
  captureId: string
  captureRuntimeBundle: GoldImportV2PreimportRuntimeBundle
  capturedAt: string
  executionNonce: string
  outputDirectory: string
  packageReadiness: GoldImportV2PackageReadinessState
  repository: GoldImportV2RepositoryEvidence
}): GoldImportV2PreimportCapture {
  const packageReadiness = validateGoldImportV2PackageReadinessState(input.packageReadiness)
  const repository = validateGoldImportV2RepositoryEvidence(input.repository)
  const captureRuntimeBundle = validateGoldImportV2PreimportRuntimeBundle(
    input.captureRuntimeBundle,
  )
  validateCaptureTime({
    capturedAt: input.capturedAt,
    finalizedLatestMtimeMs: packageReadiness.receipt.finalizedLatestMtimeMs,
  })
  const canonicalDatabaseState = buildGoldImportV2PreimportDatabaseContent(packageReadiness)
  const body = captureBodySchema.parse({
    artifactClass: 'operator_only',
    canonicalDatabaseState,
    canonicalDatabaseStateSha256: sha256(canonicalBytes(canonicalDatabaseState)),
    captureId: input.captureId,
    captureRuntimeBundle,
    capturedAt: input.capturedAt,
    executionNonce: input.executionNonce,
    outputDirectory: input.outputDirectory,
    packageReadiness,
    packageReadinessIdentitySha256: packageReadinessStateIdentitySha256(packageReadiness),
    purpose: GOLD_IMPORT_V2_PREIMPORT_CAPTURE_PURPOSE,
    repository,
    safetyBoundary: {
      compensationAuthorized: false,
      heldOutIdentitiesAccessed: false,
      importAuthorized: false,
      packageExecutionAuthorized: false,
      remoteDatabaseAccessed: false,
      writeCapableDatabaseClientConstructed: false,
    },
    schemaVersion: GOLD_IMPORT_V2_PREIMPORT_CAPTURE_SCHEMA_VERSION,
  })
  return goldImportV2PreimportCaptureSchema.parse({
    ...body,
    captureIdentitySha256: sha256(canonicalBytes(body)),
  })
}

export function validateGoldImportV2PreimportCapture(input: unknown): GoldImportV2PreimportCapture {
  const capture = goldImportV2PreimportCaptureSchema.parse(input)
  const rebuilt = buildGoldImportV2PreimportCapture(capture)
  if (!sameCanonical(rebuilt, capture)) {
    throw new Error('Post-V2 pre-import capture content or identity is invalid.')
  }
  return Object.freeze(rebuilt)
}

const executionReceiptBodySchema = z
  .object({
    canonicalManifestSha256: sha256Schema,
    captureFileSha256: sha256Schema,
    captureId: z.string().uuid(),
    captureIdentitySha256: sha256Schema,
    captureRuntimeBundleSha256: sha256Schema,
    capturedAt: isoTimestampSchema,
    executionNonce: sha256Schema,
    outputDirectory: absolutePathSchema,
    repositoryHeadSha: commitSchema,
    schemaVersion: z.literal(GOLD_IMPORT_V2_PREIMPORT_EXECUTION_RECEIPT_SCHEMA_VERSION),
  })
  .strict()

export const goldImportV2PreimportExecutionReceiptSchema = executionReceiptBodySchema
  .extend({ executionReceiptIdentitySha256: sha256Schema })
  .strict()

export type GoldImportV2PreimportExecutionReceipt = z.infer<
  typeof goldImportV2PreimportExecutionReceiptSchema
>

export function buildGoldImportV2PreimportExecutionReceipt(input: {
  canonicalManifestSha256: string
  capture: GoldImportV2PreimportCapture
  captureFileSha256: string
}): GoldImportV2PreimportExecutionReceipt {
  const capture = validateGoldImportV2PreimportCapture(input.capture)
  const body = executionReceiptBodySchema.parse({
    canonicalManifestSha256: input.canonicalManifestSha256,
    captureFileSha256: input.captureFileSha256,
    captureId: capture.captureId,
    captureIdentitySha256: capture.captureIdentitySha256,
    captureRuntimeBundleSha256: capture.captureRuntimeBundle.aggregateSha256,
    capturedAt: capture.capturedAt,
    executionNonce: capture.executionNonce,
    outputDirectory: capture.outputDirectory,
    repositoryHeadSha: capture.repository.headSha,
    schemaVersion: GOLD_IMPORT_V2_PREIMPORT_EXECUTION_RECEIPT_SCHEMA_VERSION,
  })
  return goldImportV2PreimportExecutionReceiptSchema.parse({
    ...body,
    executionReceiptIdentitySha256: sha256(canonicalBytes(body)),
  })
}

export function validateGoldImportV2PreimportExecutionReceipt(
  input: unknown,
): GoldImportV2PreimportExecutionReceipt {
  const receipt = goldImportV2PreimportExecutionReceiptSchema.parse(input)
  const { executionReceiptIdentitySha256, ...body } = receipt
  if (sha256(canonicalBytes(body)) !== executionReceiptIdentitySha256) {
    throw new Error('Post-V2 pre-import execution-receipt identity is invalid.')
  }
  return Object.freeze({ ...receipt })
}

const duplicateMarkerBodySchema = z
  .object({
    captureId: z.string().uuid(),
    captureIdentitySha256: sha256Schema,
    capturedAt: isoTimestampSchema,
    executionReceiptSha256: sha256Schema,
    outputDirectory: absolutePathSchema,
    schemaVersion: z.literal(GOLD_IMPORT_V2_PREIMPORT_DUPLICATE_MARKER_SCHEMA_VERSION),
  })
  .strict()

export const goldImportV2PreimportDuplicateMarkerSchema = duplicateMarkerBodySchema
  .extend({ markerIdentitySha256: sha256Schema })
  .strict()

export type GoldImportV2PreimportDuplicateMarker = z.infer<
  typeof goldImportV2PreimportDuplicateMarkerSchema
>

export function buildGoldImportV2PreimportDuplicateMarker(input: {
  capture: GoldImportV2PreimportCapture
  executionReceiptSha256: string
}): GoldImportV2PreimportDuplicateMarker {
  const capture = validateGoldImportV2PreimportCapture(input.capture)
  const body = duplicateMarkerBodySchema.parse({
    captureId: capture.captureId,
    captureIdentitySha256: capture.captureIdentitySha256,
    capturedAt: capture.capturedAt,
    executionReceiptSha256: input.executionReceiptSha256,
    outputDirectory: capture.outputDirectory,
    schemaVersion: GOLD_IMPORT_V2_PREIMPORT_DUPLICATE_MARKER_SCHEMA_VERSION,
  })
  return goldImportV2PreimportDuplicateMarkerSchema.parse({
    ...body,
    markerIdentitySha256: sha256(canonicalBytes(body)),
  })
}

export function validateGoldImportV2PreimportDuplicateMarker(
  input: unknown,
): GoldImportV2PreimportDuplicateMarker {
  const marker = goldImportV2PreimportDuplicateMarkerSchema.parse(input)
  const { markerIdentitySha256, ...body } = marker
  if (sha256(canonicalBytes(body)) !== markerIdentitySha256) {
    throw new Error('Post-V2 pre-import duplicate marker identity is invalid.')
  }
  return Object.freeze({ ...marker })
}

export interface GoldImportV2VerifiedPreimportCapture {
  readonly capture: GoldImportV2PreimportCapture
  readonly directoryRealpath: string
  readonly executionReceipt: GoldImportV2PreimportExecutionReceipt
  readonly executionReceiptSha256: string
}

function parseCanonicalJson(bytes: string, label: string): unknown {
  let parsed: unknown
  try {
    parsed = JSON.parse(bytes) as unknown
  } catch {
    throw new Error(`${label} is invalid JSON.`)
  }
  if (canonicalBytes(parsed) !== bytes) throw new Error(`${label} is noncanonical.`)
  return parsed
}

async function assertRegularNonSymlink(path: string, label: string): Promise<void> {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink() || (await realpath(path)) !== path) {
    throw new Error(`${label} must be a canonical regular file.`)
  }
}

async function assertTrackedRuntimeRegularFile(runtimePath: string, label: string): Promise<void> {
  const stat = await lstat(runtimePath)
  if (!stat.isFile() || stat.isSymbolicLink() || (await realpath(runtimePath)) !== runtimePath) {
    throw new Error(`${label} must be a tracked canonical regular file.`)
  }
}

export async function verifyGoldImportV2PreimportCaptureDirectory(input: {
  backupRoot: string
  directory: string
}): Promise<GoldImportV2VerifiedPreimportCapture> {
  const requestedBackupRoot = resolve(input.backupRoot)
  const requestedDirectory = resolve(input.directory)
  const [backupRoot, directory, requestedBackupRootStat, requestedDirectoryStat] =
    await Promise.all([
      realpath(requestedBackupRoot),
      realpath(requestedDirectory),
      lstat(requestedBackupRoot),
      lstat(requestedDirectory),
    ])
  if (
    backupRoot !== requestedBackupRoot ||
    directory !== requestedDirectory ||
    requestedBackupRootStat.isSymbolicLink() ||
    requestedDirectoryStat.isSymbolicLink()
  ) {
    throw new Error('Post-V2 pre-import capture path aliases and symlinks are forbidden.')
  }
  const [backupRootStat, directoryStat] = await Promise.all([lstat(backupRoot), lstat(directory)])
  if (
    !backupRootStat.isDirectory() ||
    backupRootStat.isSymbolicLink() ||
    !directoryStat.isDirectory() ||
    directoryStat.isSymbolicLink() ||
    !isWithin(backupRoot, directory) ||
    backupRoot === directory
  ) {
    throw new Error('Post-V2 pre-import capture path is unsafe or outside its backup root.')
  }
  const names = (await readdir(directory)).sort()
  if (!sameCanonical(names, [...GOLD_IMPORT_V2_PREIMPORT_CAPTURE_FILES].sort())) {
    throw new Error('Post-V2 pre-import capture inventory is incomplete or unexpected.')
  }
  for (const name of names) {
    await assertRegularNonSymlink(resolve(directory, name), `Capture file ${name}`)
  }
  const [captureBytes, manifestBytes, executionBytes] = await Promise.all([
    readFile(resolve(directory, 'preimport-state.json'), 'utf8'),
    readFile(resolve(directory, 'checksum-manifest.sha256'), 'utf8'),
    readFile(resolve(directory, 'execution-receipt.json'), 'utf8'),
  ])
  const captureFileSha256 = sha256Bytes(captureBytes)
  const expectedManifestBytes = `${captureFileSha256}  preimport-state.json\n`
  if (manifestBytes !== expectedManifestBytes) {
    throw new Error('Post-V2 pre-import capture manifest is invalid.')
  }
  const capture = validateGoldImportV2PreimportCapture(
    parseCanonicalJson(captureBytes, 'Post-V2 pre-import capture'),
  )
  const executionReceipt = validateGoldImportV2PreimportExecutionReceipt(
    parseCanonicalJson(executionBytes, 'Post-V2 pre-import execution receipt'),
  )
  const executionReceiptSha256 = sha256Bytes(executionBytes)
  const expectedReceipt = buildGoldImportV2PreimportExecutionReceipt({
    canonicalManifestSha256: sha256Bytes(manifestBytes),
    capture,
    captureFileSha256,
  })
  if (capture.outputDirectory !== directory || !sameCanonical(executionReceipt, expectedReceipt)) {
    throw new Error(
      'Post-V2 pre-import capture receipt does not bind its exact realpath and bytes.',
    )
  }
  const markerPath = resolve(
    backupRoot,
    GOLD_IMPORT_V2_PREIMPORT_DUPLICATE_MARKER_DIRECTORY,
    `${capture.captureId}.json`,
  )
  if (!isWithin(backupRoot, markerPath)) {
    throw new Error('Post-V2 pre-import duplicate marker escaped its backup root.')
  }
  await assertRegularNonSymlink(markerPath, 'Post-V2 pre-import duplicate marker')
  const marker = validateGoldImportV2PreimportDuplicateMarker(
    parseCanonicalJson(await readFile(markerPath, 'utf8'), 'Post-V2 pre-import duplicate marker'),
  )
  const expectedMarker = buildGoldImportV2PreimportDuplicateMarker({
    capture,
    executionReceiptSha256,
  })
  if (!sameCanonical(marker, expectedMarker)) {
    throw new Error('Post-V2 pre-import duplicate marker does not bind this capture instance.')
  }
  return Object.freeze({
    capture,
    directoryRealpath: directory,
    executionReceipt,
    executionReceiptSha256,
  })
}

const pairBindingSchema = z
  .object({
    canonicalDatabaseStateSha256: sha256Schema,
    captureId: z.string().uuid(),
    captureIdentitySha256: sha256Schema,
    capturedAt: isoTimestampSchema,
    directoryRealpath: absolutePathSchema,
    executionNonce: sha256Schema,
    executionReceiptIdentitySha256: sha256Schema,
    executionReceiptSha256: sha256Schema,
  })
  .strict()

const pairBodySchema = z
  .object({
    canonicalDatabaseStateSha256: sha256Schema,
    captures: z.tuple([pairBindingSchema, pairBindingSchema]),
    currentRepositoryHeadSha: commitSchema,
    currentRuntimeBundleSha256: sha256Schema,
    finalizedReceiptAuthorityIdentitySha256: z.literal(
      GOLD_IMPORT_V2_FINALIZED_RECEIPT_AUTHORITY_IDENTITY_SHA256,
    ),
    packageReadinessIdentitySha256: sha256Schema,
    safetyBoundary: z
      .object({
        compensationAuthorized: z.literal(false),
        heldOutIdentitiesAccessed: z.literal(false),
        importAuthorized: z.literal(false),
        packageExecutionAuthorized: z.literal(false),
        remoteDatabaseAccessed: z.literal(false),
      })
      .strict(),
    schemaVersion: z.literal(GOLD_IMPORT_V2_PREIMPORT_PAIR_SCHEMA_VERSION),
    trustModel: z.literal(GOLD_IMPORT_V2_PREIMPORT_CAPTURE_TRUST_MODEL),
  })
  .strict()

export const goldImportV2PreimportCapturePairSchema = pairBodySchema
  .extend({ pairIdentitySha256: sha256Schema })
  .strict()

export type GoldImportV2PreimportCapturePair = z.infer<
  typeof goldImportV2PreimportCapturePairSchema
>

function pairBinding(capture: GoldImportV2VerifiedPreimportCapture) {
  return pairBindingSchema.parse({
    canonicalDatabaseStateSha256: capture.capture.canonicalDatabaseStateSha256,
    captureId: capture.capture.captureId,
    captureIdentitySha256: capture.capture.captureIdentitySha256,
    capturedAt: capture.capture.capturedAt,
    directoryRealpath: capture.directoryRealpath,
    executionNonce: capture.capture.executionNonce,
    executionReceiptIdentitySha256: capture.executionReceipt.executionReceiptIdentitySha256,
    executionReceiptSha256: capture.executionReceiptSha256,
  })
}

export function buildGoldImportV2PreimportCapturePair(input: {
  captures: readonly GoldImportV2VerifiedPreimportCapture[]
  currentRepository: GoldImportV2RepositoryEvidence
  currentRuntimeBundle: GoldImportV2PreimportRuntimeBundle
  now: Date
}): GoldImportV2PreimportCapturePair {
  if (input.captures.length !== 2) {
    throw new Error('Package readiness requires exactly two post-V2 pre-import captures.')
  }
  const currentRepository = validateGoldImportV2RepositoryEvidence(input.currentRepository)
  const currentRuntimeBundle = validateGoldImportV2PreimportRuntimeBundle(
    input.currentRuntimeBundle,
  )
  const captures = input.captures.map((capture) => ({
    ...capture,
    capture: validateGoldImportV2PreimportCapture(capture.capture),
    executionReceipt: validateGoldImportV2PreimportExecutionReceipt(capture.executionReceipt),
  }))
  const first = captures[0]!
  const second = captures[1]!
  const distinctValues = [
    [first.directoryRealpath, second.directoryRealpath],
    [first.capture.captureId, second.capture.captureId],
    [first.capture.executionNonce, second.capture.executionNonce],
    [first.capture.captureIdentitySha256, second.capture.captureIdentitySha256],
    [
      first.executionReceipt.executionReceiptIdentitySha256,
      second.executionReceipt.executionReceiptIdentitySha256,
    ],
    [first.executionReceiptSha256, second.executionReceiptSha256],
  ] as const
  if (distinctValues.some(([left, right]) => left === right)) {
    throw new Error('Capture pair must contain two distinct trusted-operator capture instances.')
  }
  const nowMs = input.now.getTime()
  if (!Number.isFinite(nowMs)) throw new Error('Capture-pair verification time is invalid.')
  for (const [index, verified] of captures.entries()) {
    const capture = verified.capture
    validateCaptureTime({
      capturedAt: capture.capturedAt,
      finalizedLatestMtimeMs: capture.packageReadiness.receipt.finalizedLatestMtimeMs,
      nowMs,
    })
    if (
      capture.repository.headSha !== currentRepository.headSha ||
      capture.captureRuntimeBundle.aggregateSha256 !== currentRuntimeBundle.aggregateSha256 ||
      capture.packageReadiness.schemaVersion !== GOLD_IMPORT_V2_PACKAGE_READINESS_SCHEMA_VERSION ||
      capture.packageReadiness.receipt.authorityIdentitySha256 !==
        GOLD_IMPORT_V2_FINALIZED_RECEIPT_AUTHORITY_IDENTITY_SHA256 ||
      verified.executionReceiptSha256 !== sha256(canonicalBytes(verified.executionReceipt)) ||
      verified.executionReceipt.outputDirectory !== verified.directoryRealpath ||
      verified.executionReceipt.captureId !== capture.captureId ||
      verified.executionReceipt.captureIdentitySha256 !== capture.captureIdentitySha256 ||
      verified.executionReceipt.captureRuntimeBundleSha256 !==
        capture.captureRuntimeBundle.aggregateSha256 ||
      verified.executionReceipt.capturedAt !== capture.capturedAt ||
      verified.executionReceipt.executionNonce !== capture.executionNonce ||
      verified.executionReceipt.repositoryHeadSha !== capture.repository.headSha
    ) {
      throw new Error(`Post-V2 pre-import capture ${index + 1} is stale or incompletely bound.`)
    }
  }
  if (
    first.capture.canonicalDatabaseStateSha256 !== second.capture.canonicalDatabaseStateSha256 ||
    !sameCanonical(first.capture.canonicalDatabaseState, second.capture.canonicalDatabaseState) ||
    first.capture.packageReadinessIdentitySha256 !==
      second.capture.packageReadinessIdentitySha256 ||
    !sameCanonical(first.capture.packageReadiness, second.capture.packageReadiness)
  ) {
    throw new Error('Post-V2 pre-import captures disagree about canonical package-readiness state.')
  }
  const bindings = captures
    .map(pairBinding)
    .sort((left, right) => left.captureId.localeCompare(right.captureId, 'en')) as [
    z.infer<typeof pairBindingSchema>,
    z.infer<typeof pairBindingSchema>,
  ]
  const body = pairBodySchema.parse({
    canonicalDatabaseStateSha256: first.capture.canonicalDatabaseStateSha256,
    captures: bindings,
    currentRepositoryHeadSha: currentRepository.headSha,
    currentRuntimeBundleSha256: currentRuntimeBundle.aggregateSha256,
    finalizedReceiptAuthorityIdentitySha256:
      GOLD_IMPORT_V2_FINALIZED_RECEIPT_AUTHORITY_IDENTITY_SHA256,
    packageReadinessIdentitySha256: first.capture.packageReadinessIdentitySha256,
    safetyBoundary: {
      compensationAuthorized: false,
      heldOutIdentitiesAccessed: false,
      importAuthorized: false,
      packageExecutionAuthorized: false,
      remoteDatabaseAccessed: false,
    },
    schemaVersion: GOLD_IMPORT_V2_PREIMPORT_PAIR_SCHEMA_VERSION,
    trustModel: GOLD_IMPORT_V2_PREIMPORT_CAPTURE_TRUST_MODEL,
  })
  return goldImportV2PreimportCapturePairSchema.parse({
    ...body,
    pairIdentitySha256: sha256(canonicalBytes(body)),
  })
}

export function validateGoldImportV2PreimportCapturePair(
  input: unknown,
): GoldImportV2PreimportCapturePair {
  const pair = goldImportV2PreimportCapturePairSchema.parse(input)
  const { pairIdentitySha256, ...body } = pair
  if (sha256(canonicalBytes(body)) !== pairIdentitySha256) {
    throw new Error('Post-V2 pre-import capture-pair identity is invalid.')
  }
  return Object.freeze(pair)
}

export const GOLD_IMPORT_V2_PREIMPORT_RUNTIME_REQUIRED_FILES = Object.freeze([
  'package-lock.json',
  'package.json',
  'scripts/literature/capture-gold-import-v2-preimport-state.ts',
  'scripts/literature/generate-gold-import-compensation-package-v2.ts',
  'scripts/literature/gold-import-v2-package-readiness.ts',
  'scripts/literature/gold-import-v2-preimport-capture.ts',
  'scripts/require-primary-checkout.mjs',
  'tsconfig.json',
])

const LOCAL_RUNTIME_IMPORT_PATTERN =
  /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s*)?['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/gu

async function resolveRuntimeLocalImport(input: {
  repositoryRoot: string
  sourcePath: string
  specifier: string
}): Promise<string> {
  const base = resolve(dirname(resolve(input.repositoryRoot, input.sourcePath)), input.specifier)
  const candidates = extname(base)
    ? [base]
    : [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.mjs`,
        `${base}.js`,
        `${base}.json`,
        resolve(base, 'index.ts'),
        resolve(base, 'index.tsx'),
        resolve(base, 'index.mjs'),
        resolve(base, 'index.js'),
      ]
  for (const candidate of candidates) {
    if (!isWithin(input.repositoryRoot, candidate)) {
      throw new Error(`Capture runtime import escaped repository: ${input.specifier}`)
    }
    try {
      const candidateStat = await lstat(candidate)
      if (candidateStat.isFile() && !candidateStat.isSymbolicLink()) {
        return relative(input.repositoryRoot, candidate).split(sep).join('/')
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  throw new Error(
    `Capture runtime local import does not resolve to one regular file: ${input.specifier}`,
  )
}

async function discoverGoldImportV2PreimportRuntimeClosure(
  repositoryRoot: string,
): Promise<string[]> {
  const pending = [...GOLD_IMPORT_V2_PREIMPORT_RUNTIME_REQUIRED_FILES]
  const visited = new Set<string>()
  while (pending.length > 0) {
    const path = pending.pop()!
    if (visited.has(path)) continue
    const absolutePath = resolve(repositoryRoot, path)
    if (!isWithin(repositoryRoot, absolutePath)) {
      throw new Error('Capture runtime file escaped repository.')
    }
    await assertTrackedRuntimeRegularFile(absolutePath, `Capture runtime file ${path}`)
    visited.add(path)
    if (!['.ts', '.tsx', '.js', '.mjs'].includes(extname(path))) continue
    const source = await readFile(absolutePath, 'utf8')
    for (const match of source.matchAll(LOCAL_RUNTIME_IMPORT_PATTERN)) {
      const specifier = match[1] ?? match[2]
      if (!specifier) continue
      const dependency = await resolveRuntimeLocalImport({
        repositoryRoot,
        sourcePath: path,
        specifier,
      })
      if (!visited.has(dependency)) pending.push(dependency)
    }
  }
  return [...visited].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
}

export async function loadGoldImportV2PreimportRuntimeBundle(
  repositoryRoot: string,
): Promise<GoldImportV2PreimportRuntimeBundle> {
  const root = await realpath(resolve(repositoryRoot))
  const paths = await discoverGoldImportV2PreimportRuntimeClosure(root)
  const trackedOutput = await execFileAsync('git', ['ls-files', '-z', '--', ...paths], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  const trackedPaths = new Set(trackedOutput.stdout.split('\0').filter(Boolean))
  if (trackedPaths.size !== paths.length || paths.some((path) => !trackedPaths.has(path))) {
    throw new Error('Capture runtime closure contains an untracked or ignored executable input.')
  }
  const files = await Promise.all(
    paths.map(async (path) => {
      const absolutePath = resolve(root, path)
      await assertTrackedRuntimeRegularFile(absolutePath, `Capture runtime file ${path}`)
      return { bytes: await readFile(absolutePath), path }
    }),
  )
  return buildGoldImportV2PreimportRuntimeBundle(files)
}

export const GOLD_IMPORT_V2_PREIMPORT_CONTRACT_SUMMARY = Object.freeze({
  captureSchemaVersion: GOLD_IMPORT_V2_PREIMPORT_CAPTURE_SCHEMA_VERSION,
  repositorySchemaVersion: GOLD_IMPORT_V2_REPOSITORY_EVIDENCE_SCHEMA_VERSION,
  trustModel: GOLD_IMPORT_V2_PREIMPORT_CAPTURE_TRUST_MODEL,
})
