import { randomBytes, randomUUID } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildGoldImportV2PackageReadinessState,
  collectGoldImportV2PreimportFixedLocalState,
  GOLD_IMPORT_V2_PRIMARY_CHECKOUT,
  inspectGoldImportV2PrimaryMainRepository,
  loadGoldImportV2FinalizedReceiptEvidence,
  sha256Bytes,
  type GoldImportV2FixedLocalState,
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
import { assertKnownArguments, parseCliArguments } from './lib/cli'
import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import {
  buildGoldImportV2DatabasePublicationObservationBinding,
  runGoldImportV2DatabasePublicationProtocol,
} from './gold-import-v2-database-publication'
import {
  assertExclusiveOutputDirectoryIdentity,
  createStagedExclusiveOutputDirectory,
  discardStagedExclusiveOutputDirectory,
  publishStagedExclusiveOutputDirectory,
  writeExclusiveOutputFiles,
  type StagedExclusiveOutputDirectory,
} from './lib/exclusive-output'

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
  collectDatabaseEvidence: () => Promise<GoldImportV2FixedLocalState>
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
    collectFinalDatabaseEvidence: () => Promise<GoldImportV2FixedLocalState>
    executionNonce: string
    initialDatabaseEvidence: GoldImportV2FixedLocalState
    now: () => Date
    receipt: GoldImportV2FinalizedReceiptEvidence
    revalidateNonDatabaseEvidence: () => Promise<{
      receipt: GoldImportV2FinalizedReceiptEvidence
      repository: GoldImportV2RepositoryEvidence
      runtimeBundle: GoldImportV2PreimportRuntimeBundle
    }>
    repository: GoldImportV2RepositoryEvidence
    runtimeBundle: GoldImportV2PreimportRuntimeBundle
    stagingNonce: string
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
  collectFinalDatabaseEvidence: () => Promise<GoldImportV2FixedLocalState>
  executionNonce: string
  initialDatabaseEvidence: GoldImportV2FixedLocalState
  now: () => Date
  receipt: GoldImportV2FinalizedReceiptEvidence
  revalidateNonDatabaseEvidence: () => Promise<{
    receipt: GoldImportV2FinalizedReceiptEvidence
    repository: GoldImportV2RepositoryEvidence
    runtimeBundle: GoldImportV2PreimportRuntimeBundle
  }>
  repository: GoldImportV2RepositoryEvidence
  runtimeBundle: GoldImportV2PreimportRuntimeBundle
  stagingNonce: string
}): Promise<GoldImportV2VerifiedPreimportCapture> {
  const backupRoot = await assertSafeCaptureRoot(input.backupRoot)
  const compactTimestamp = input.capturedAt.replace(/[^0-9]/gu, '')
  const outputDirectory = resolve(backupRoot, `capture-${compactTimestamp}-${input.captureId}`)
  const packageReadiness = buildGoldImportV2PackageReadinessState({
    fixedLocalState: input.initialDatabaseEvidence,
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
    targetObservation: input.initialDatabaseEvidence.targetObservation,
  })
  const captureBytes = canonicalArtifactBytes(capture)
  const captureFileSha256 = sha256Bytes(captureBytes)
  const initialBinding = buildGoldImportV2DatabasePublicationObservationBinding({
    packageReadiness,
    targetObservation: input.initialDatabaseEvidence.targetObservation,
  })
  const result = await runGoldImportV2DatabasePublicationProtocol<
    StagedExclusiveOutputDirectory,
    GoldImportV2VerifiedPreimportCapture
  >({
    discard: discardStagedExclusiveOutputDirectory,
    finalize: async (staged, bracket) => {
      const bracketBytes = canonicalArtifactBytes(bracket)
      const bracketFileSha256 = sha256Bytes(bracketBytes)
      const manifestBytes = `${bracketFileSha256}  database-publication-bracket.json\n${captureFileSha256}  preimport-state.json\n`
      const executionReceipt = buildGoldImportV2PreimportExecutionReceipt({
        canonicalManifestSha256: sha256Bytes(manifestBytes),
        capture,
        captureFileSha256,
        publicationBracket: bracket,
        publicationBracketFileSha256: bracketFileSha256,
      })
      writeExclusiveOutputFiles(staged.identity, [
        { bytes: Buffer.from(bracketBytes, 'utf8'), name: 'database-publication-bracket.json' },
        { bytes: Buffer.from(manifestBytes, 'utf8'), name: 'checksum-manifest.sha256' },
        {
          bytes: Buffer.from(canonicalArtifactBytes(executionReceipt), 'utf8'),
          name: 'execution-receipt.json',
        },
      ])
      await assertExclusiveOutputDirectoryIdentity(staged.identity)
    },
    initial: initialBinding,
    now: input.now,
    observeFinal: async () => {
      const finalFixedLocalState = await input.collectFinalDatabaseEvidence()
      const current = await input.revalidateNonDatabaseEvidence()
      if (
        canonicalJson(current.repository) !== canonicalJson(input.repository) ||
        canonicalJson(current.receipt) !== canonicalJson(input.receipt) ||
        canonicalJson(current.runtimeBundle) !== canonicalJson(input.runtimeBundle)
      ) {
        throw new Error(
          'Repository, finalized receipt, or capture runtime changed during staged publication.',
        )
      }
      const finalReadiness = buildGoldImportV2PackageReadinessState({
        fixedLocalState: finalFixedLocalState,
        receipt: current.receipt,
        repository: current.repository,
      })
      if (canonicalJson(finalReadiness) !== canonicalJson(packageReadiness)) {
        throw new Error('Fixed-local database state changed after initial capture collection.')
      }
      return buildGoldImportV2DatabasePublicationObservationBinding({
        packageReadiness: finalReadiness,
        targetObservation: finalFixedLocalState.targetObservation,
      })
    },
    publish: async (staged) => {
      await publishStagedExclusiveOutputDirectory(staged)
      const executionReceiptBytes = await readFile(
        resolve(outputDirectory, 'execution-receipt.json'),
      )
      const marker = buildGoldImportV2PreimportDuplicateMarker({
        capture,
        executionReceiptSha256: sha256Bytes(executionReceiptBytes),
      })
      const markerDirectory = resolve(
        backupRoot,
        GOLD_IMPORT_V2_PREIMPORT_DUPLICATE_MARKER_DIRECTORY,
      )
      await mkdir(markerDirectory, { mode: 0o700, recursive: true })
      if ((await realpath(markerDirectory)) !== markerDirectory) {
        throw new Error('Post-V2 pre-import duplicate-marker directory is unsafe.')
      }
      await writeFile(
        resolve(markerDirectory, `${input.captureId}.json`),
        canonicalArtifactBytes(marker),
        { encoding: 'utf8', flag: 'wx', mode: 0o400 },
      )
      return verifyGoldImportV2PreimportCaptureDirectory({
        backupRoot,
        directory: outputDirectory,
      })
    },
    stage: async () => {
      const staged = await createStagedExclusiveOutputDirectory({
        outputDirectory,
        outputRoot: backupRoot,
        stagingNonce: input.stagingNonce,
      })
      writeExclusiveOutputFiles(staged.identity, [
        { bytes: Buffer.from(captureBytes, 'utf8'), name: 'preimport-state.json' },
      ])
      await assertExclusiveOutputDirectoryIdentity(staged.identity)
      return {
        staged,
        stagedAt: input.now().toISOString(),
        stagedPayloadSha256: captureFileSha256,
      }
    },
    subject: 'capture',
  })
  return result.published
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
  const capturedAt = runtime.now().toISOString()
  const capture = await runtime.writeCapture({
    backupRoot: GOLD_IMPORT_V2_PREIMPORT_CAPTURE_ROOT,
    captureId: runtime.randomCaptureId(),
    capturedAt,
    collectFinalDatabaseEvidence: runtime.collectDatabaseEvidence,
    executionNonce: runtime.randomNonce(),
    initialDatabaseEvidence: databaseEvidence,
    now: runtime.now,
    receipt,
    revalidateNonDatabaseEvidence: async () => {
      const [currentRepository, currentReceipt, currentRuntimeBundle] = await Promise.all([
        runtime.inspectRepository(),
        runtime.loadFinalizedReceipt(),
        runtime.loadRuntimeBundle(),
      ])
      return {
        receipt: currentReceipt,
        repository: currentRepository,
        runtimeBundle: currentRuntimeBundle,
      }
    },
    repository,
    runtimeBundle,
    stagingNonce: runtime.randomNonce(),
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
