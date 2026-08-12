import { randomBytes, randomUUID } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { mkdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildGoldImportV2PackageReadinessState,
  collectGoldImportV2PreimportFixedLocalState,
  GOLD_IMPORT_V2_PRIMARY_CHECKOUT,
  inspectGoldImportV2PrimaryMainRepository,
  loadGoldImportV2FinalizedReceiptEvidence,
  sha256Bytes,
  type GoldImportV2FinalizedReceiptEvidence,
  type GoldImportV2RepositoryEvidence,
} from './gold-import-v2-package-readiness'
import {
  GOLD_IMPORT_V2_PREIMPORT_DUPLICATE_MARKER_DIRECTORY,
  GOLD_IMPORT_V2_PREIMPORT_CAPTURE_ROOT,
  buildGoldImportV2PreimportCapture,
  buildGoldImportV2PreimportDuplicateMarker,
  buildGoldImportV2PreimportExecutionReceipt,
  loadGoldImportV2PreimportRuntimeBundle,
  verifyGoldImportV2PreimportCaptureDirectory,
  type GoldImportV2PreimportRuntimeBundle,
  type GoldImportV2VerifiedPreimportCapture,
} from './gold-import-v2-preimport-capture'
import type { ProtectedV2DatabaseEvidence } from './protected-gold-import-contract-v2-transition-evidence'
import { assertKnownArguments, parseCliArguments } from './lib/cli'
import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'

export { GOLD_IMPORT_V2_PREIMPORT_CAPTURE_ROOT } from './gold-import-v2-preimport-capture'

const EXECUTING_REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const EXECUTING_MODULE_PATH = realpathSync(fileURLToPath(import.meta.url))
const EXPECTED_PRODUCTION_MODULE_PATH = resolve(
  GOLD_IMPORT_V2_PRIMARY_CHECKOUT,
  'scripts/literature/capture-gold-import-v2-preimport-state.ts',
)

const HELP = `Capture the exact real-local post-V2, pre-import package-readiness state.

Usage:
  npm run literature:capture-gold-import-v2-preimport-state

This production command has no target, branch, database, split, or output-path override. It runs
only from clean primary main at exact origin/main, queries only the fixed local Docker PostgreSQL
target through repeatable-read/read-only SQL, and creates one non-authorizing capture under:
  ${GOLD_IMPORT_V2_PREIMPORT_CAPTURE_ROOT}

Run it twice after this workflow is merged to obtain the required redundant capture pair.`

interface GoldImportV2PreimportCaptureDependencies {
  collectDatabaseEvidence: () => Promise<ProtectedV2DatabaseEvidence>
  inspectRepository: () => Promise<GoldImportV2RepositoryEvidence>
  loadFinalizedReceipt: () => Promise<GoldImportV2FinalizedReceiptEvidence>
  loadRuntimeBundle: () => Promise<GoldImportV2PreimportRuntimeBundle>
  now: () => Date
  randomCaptureId: () => string
  randomNonce: () => string
  writeCapture: (input: {
    backupRoot: string
    captureId: string
    capturedAt: string
    databaseEvidence: ProtectedV2DatabaseEvidence
    executionNonce: string
    receipt: GoldImportV2FinalizedReceiptEvidence
    repository: GoldImportV2RepositoryEvidence
    runtimeBundle: GoldImportV2PreimportRuntimeBundle
  }) => Promise<GoldImportV2VerifiedPreimportCapture>
}

function canonicalArtifactBytes(value: unknown): string {
  return canonicalJson(value)
}

async function assertSafeCaptureRoot(backupRoot: string): Promise<string> {
  await mkdir(backupRoot, { mode: 0o700, recursive: true })
  const root = await realpath(backupRoot)
  const rootStat = await stat(root)
  if (root !== backupRoot || !rootStat.isDirectory()) {
    throw new Error('Post-V2 pre-import capture root is unsafe.')
  }
  return root
}

/** Writes only a new capture artifact directory and its additive duplicate marker. */
async function writeGoldImportV2PreimportCapture(input: {
  backupRoot: string
  captureId: string
  capturedAt: string
  databaseEvidence: ProtectedV2DatabaseEvidence
  executionNonce: string
  receipt: GoldImportV2FinalizedReceiptEvidence
  repository: GoldImportV2RepositoryEvidence
  runtimeBundle: GoldImportV2PreimportRuntimeBundle
}): Promise<GoldImportV2VerifiedPreimportCapture> {
  const backupRoot = await assertSafeCaptureRoot(input.backupRoot)
  const compactTimestamp = input.capturedAt.replace(/[^0-9]/gu, '')
  const outputDirectory = resolve(backupRoot, `capture-${compactTimestamp}-${input.captureId}`)
  const packageReadiness = buildGoldImportV2PackageReadinessState({
    databaseEvidence: input.databaseEvidence,
    receipt: input.receipt,
    repository: input.repository,
  })
  const capture = buildGoldImportV2PreimportCapture({
    captureId: input.captureId,
    captureRuntimeBundle: input.runtimeBundle,
    capturedAt: input.capturedAt,
    executionNonce: input.executionNonce,
    outputDirectory,
    packageReadiness,
    repository: input.repository,
  })
  const captureBytes = canonicalArtifactBytes(capture)
  const captureFileSha256 = sha256Bytes(captureBytes)
  const manifestBytes = `${captureFileSha256}  preimport-state.json\n`
  const executionReceipt = buildGoldImportV2PreimportExecutionReceipt({
    canonicalManifestSha256: sha256Bytes(manifestBytes),
    capture,
    captureFileSha256,
  })
  const executionReceiptBytes = canonicalArtifactBytes(executionReceipt)
  const marker = buildGoldImportV2PreimportDuplicateMarker({
    capture,
    executionReceiptSha256: sha256Bytes(executionReceiptBytes),
  })
  const markerDirectory = resolve(backupRoot, GOLD_IMPORT_V2_PREIMPORT_DUPLICATE_MARKER_DIRECTORY)
  await mkdir(markerDirectory, { mode: 0o700, recursive: true })
  if ((await realpath(markerDirectory)) !== markerDirectory) {
    throw new Error('Post-V2 pre-import duplicate-marker directory is unsafe.')
  }
  let outputCreated = false
  try {
    await mkdir(outputDirectory, { mode: 0o700 })
    outputCreated = true
    await Promise.all([
      writeFile(resolve(outputDirectory, 'preimport-state.json'), captureBytes, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o400,
      }),
      writeFile(resolve(outputDirectory, 'checksum-manifest.sha256'), manifestBytes, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o400,
      }),
      writeFile(resolve(outputDirectory, 'execution-receipt.json'), executionReceiptBytes, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o400,
      }),
    ])
    await writeFile(
      resolve(markerDirectory, `${input.captureId}.json`),
      canonicalArtifactBytes(marker),
      {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o400,
      },
    )
  } catch (error) {
    if (outputCreated) await rm(outputDirectory, { force: true, recursive: true })
    throw error
  }
  return verifyGoldImportV2PreimportCaptureDirectory({ backupRoot, directory: outputDirectory })
}

function defaultDependencies(): GoldImportV2PreimportCaptureDependencies {
  if (
    EXECUTING_REPOSITORY_ROOT !== GOLD_IMPORT_V2_PRIMARY_CHECKOUT ||
    EXECUTING_MODULE_PATH !== EXPECTED_PRODUCTION_MODULE_PATH ||
    realpathSync(process.cwd()) !== EXECUTING_REPOSITORY_ROOT ||
    !process.argv[1] ||
    realpathSync(resolve(process.argv[1])) !== EXECUTING_MODULE_PATH
  ) {
    throw new Error(
      'Post-V2 pre-import capture must execute directly from its exact primary-checkout entrypoint.',
    )
  }
  return {
    collectDatabaseEvidence: collectGoldImportV2PreimportFixedLocalState,
    inspectRepository: () =>
      inspectGoldImportV2PrimaryMainRepository({ cwd: EXECUTING_REPOSITORY_ROOT }),
    loadFinalizedReceipt: () => loadGoldImportV2FinalizedReceiptEvidence(),
    loadRuntimeBundle: () =>
      loadGoldImportV2PreimportRuntimeBundle(GOLD_IMPORT_V2_PRIMARY_CHECKOUT),
    now: () => new Date(),
    randomCaptureId: randomUUID,
    randomNonce: () => randomBytes(32).toString('hex'),
    writeCapture: writeGoldImportV2PreimportCapture,
  }
}

async function runGoldImportV2PreimportCaptureWithDependencies(
  argv: string[],
  runtime: GoldImportV2PreimportCaptureDependencies,
): Promise<{ capture: GoldImportV2VerifiedPreimportCapture } | { help: string }> {
  if (validateGoldImportV2PreimportCaptureCliArguments(argv).help) return { help: HELP }

  // Repository and immutable receipt authentication precede every database or output action.
  const repository = await runtime.inspectRepository()
  const [receipt, runtimeBundle] = await Promise.all([
    runtime.loadFinalizedReceipt(),
    runtime.loadRuntimeBundle(),
  ])
  const databaseEvidence = await runtime.collectDatabaseEvidence()
  const [currentRepository, currentReceipt, currentRuntimeBundle] = await Promise.all([
    runtime.inspectRepository(),
    runtime.loadFinalizedReceipt(),
    runtime.loadRuntimeBundle(),
  ])
  if (
    canonicalJson(currentRepository) !== canonicalJson(repository) ||
    canonicalJson(currentReceipt) !== canonicalJson(receipt) ||
    canonicalJson(currentRuntimeBundle) !== canonicalJson(runtimeBundle)
  ) {
    throw new Error(
      'Repository, finalized receipt, or capture runtime changed during read-only collection.',
    )
  }
  const capturedAt = runtime.now().toISOString()
  const capture = await runtime.writeCapture({
    backupRoot: GOLD_IMPORT_V2_PREIMPORT_CAPTURE_ROOT,
    captureId: runtime.randomCaptureId(),
    capturedAt,
    databaseEvidence,
    executionNonce: runtime.randomNonce(),
    receipt,
    repository,
    runtimeBundle,
  })
  return { capture }
}

/** Pure argument boundary exposed for feature-branch and negative CLI tests. */
export function validateGoldImportV2PreimportCaptureCliArguments(argv: string[]): {
  help: boolean
} {
  const arguments_ = parseCliArguments(argv)
  assertKnownArguments(arguments_, ['help'])
  if (arguments_.values.has('help')) throw new Error('--help does not accept a value.')
  return { help: arguments_.flags.has('help') }
}

/** Private production wrapper with module-owned capabilities only. */
async function runGoldImportV2PreimportCapture(
  argv: string[],
): Promise<{ capture: GoldImportV2VerifiedPreimportCapture } | { help: string }> {
  return runGoldImportV2PreimportCaptureWithDependencies(argv, defaultDependencies())
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  void runGoldImportV2PreimportCapture(process.argv.slice(2))
    .then((result) => {
      if ('help' in result) console.log(result.help)
      else {
        console.log(
          `${JSON.stringify(
            {
              canonicalDatabaseStateSha256: result.capture.capture.canonicalDatabaseStateSha256,
              captureDirectory: result.capture.directoryRealpath,
              captureIdentitySha256: result.capture.capture.captureIdentitySha256,
              executionReceiptSha256: result.capture.executionReceiptSha256,
              importAuthorized: false,
              compensationAuthorized: false,
            },
            null,
            2,
          )}\n`,
        )
      }
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
