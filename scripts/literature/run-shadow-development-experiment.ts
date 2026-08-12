import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  canonicalShadowJson,
  sha256ShadowValue,
} from '../../src/features/literature/shadow-classifier/canonical'
import { loadConfiguredShadowComponentRegistry } from '../../src/features/literature/shadow-classifier/configured-registry'
import {
  buildRepeatedStratifiedDevelopmentFolds,
  crossFitShadowTemperatureCalibration,
  evaluateExactShadowDevelopmentRun,
  type ShadowCalibrationCohortRow,
  type ShadowRunArtifact,
} from '../../src/features/literature/shadow-classifier'
import { assertKnownArguments, numberArgument, parseCliArguments, stringArgument } from './lib/cli'
import {
  ingestExactShadowDevelopmentWorkerResults,
  loadExactShadowDevelopmentCoordinatorTruth,
  prepareExactShadowDevelopmentExperiment,
  verifyExactShadowDevelopmentRunBinding,
  verifyExactShadowDevelopmentRunReconstitution,
  type ShadowDevelopmentWorkerFileEvidence,
  type ShadowDevelopmentPreparedExperimentArtifact,
} from './shadow-development-experiment-contract'

export const SHADOW_DEVELOPMENT_EXPERIMENT_OUTPUT_ROOT =
  'local-data/literature/shadow-development-experiments' as const
export const SHADOW_DEVELOPMENT_SOURCE_FILE =
  '/Users/russellmiller/Projects/Interventional-Pulm-Education-Project/local-data/literature/gold-sets/gold-set-v1/enrichment-source-v2.csv' as const
export const SHADOW_DEVELOPMENT_TRUTH_FILE =
  '/Users/russellmiller/Projects/Interventional-Pulm-Education-Project/local-data/literature/gold-sets/gold-set-v1/enrichment-v3-execution-1/operator-package/conflict-quarantine-v1-post-merge/post-review-v1/post-adjudication-v1/protocol-authorization-decision-audit-v1/post-targeted-review-v1/final-authorization-and-import-package-v1/final/gold-set-v1-enrichment-v3-final-development-630.csv' as const

export const SHADOW_DEVELOPMENT_EXPERIMENT_USAGE = `Usage:
  npm run literature:shadow-rd:experiment -- prepare --created-at <ISO> --model-id <concrete-model> --reasoning-level <level> [--chunk-size 30]
  npm run literature:shadow-rd:experiment -- ingest --prepared-directory <directory> --created-at <ISO> --run-id <id>
  npm run literature:shadow-rd:experiment -- finalize --prepared-directory <directory>

This file-only development command dispatches no model, opens no database, accepts no PMID/split/
queue/candidate list, and writes no production state. Preparation emits only modelInput JSON in
model-facing chunk directories; coordinator packet provenance is stored separately.
` as const

function git(cwd: string, args: readonly string[]): string {
  return execFileSync('git', [...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function authenticatedRepositoryCommit(cwd: string, expected?: string): string {
  if (realpathSync(git(cwd, ['rev-parse', '--show-toplevel'])) !== realpathSync(cwd)) {
    throw new Error('Experiment runner must execute at the repository root.')
  }
  const status = git(cwd, ['status', '--porcelain=v1', '--untracked-files=all'])
  const head = git(cwd, ['rev-parse', 'HEAD'])
  if (status !== '' || !/^[a-f0-9]{40}$/u.test(head)) {
    throw new Error('Experiment runner requires an exact clean committed repository state.')
  }
  if (expected !== undefined && head !== expected) {
    throw new Error('Current repository commit does not match the prepared experiment.')
  }
  return head
}

function within(parent: string, child: string): boolean {
  const path = relative(parent, child)
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`)
}

function ensureOutputRoot(cwd: string): string {
  const root = resolve(cwd, SHADOW_DEVELOPMENT_EXPERIMENT_OUTPUT_ROOT)
  mkdirSync(root, { mode: 0o700, recursive: true })
  if (realpathSync(root) !== root) throw new Error('Experiment output root must be canonical.')
  return root
}

function required(args: ReturnType<typeof parseCliArguments>, key: string): string {
  const value = stringArgument(args, key)
  if (!value) throw new Error(`--${key} is required.`)
  return value
}

function assertNoForbiddenSelectionText(argv: readonly string[]): void {
  const suspicious =
    /(?:^|[^a-z])(?:test|all|held[-_ ]?out|queue|split|complement|pmid)(?:[^a-z]|$)/iu
  if (argv.some((value) => suspicious.test(value))) {
    throw new Error(
      'Experiment runner forbids test/all/held-out/queue/split/complement/PMID selection text.',
    )
  }
}

function readExactRegularFile(path: string, maximumBytes: number): Buffer {
  const stat = lstatSync(path)
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size > maximumBytes ||
    realpathSync(path) !== path
  ) {
    throw new Error('Input must be the expected canonical bounded regular file.')
  }
  return readFileSync(path)
}

function strictFileInventory(root: string): string[] {
  const rootStat = lstatSync(root)
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || realpathSync(root) !== root) {
    throw new Error('Model-facing root must be a canonical non-symlink directory.')
  }
  const files: string[] = []
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name)
      const stat = lstatSync(path)
      if (stat.isSymbolicLink() || !within(root, path) || !within(root, realpathSync(path))) {
        throw new Error('Model-facing tree contains a symlink or escaped path.')
      }
      if (stat.isDirectory()) visit(path)
      else if (stat.isFile()) files.push(relative(root, path))
      else throw new Error('Model-facing tree contains a non-regular filesystem entry.')
    }
  }
  visit(root)
  return files.sort()
}

function readAuthenticatedModelFacingWorkerFiles(
  directory: string,
  prepared: ShadowDevelopmentPreparedExperimentArtifact,
): ShadowDevelopmentWorkerFileEvidence[] {
  const modelFacingRoot = resolve(directory, 'model-facing')
  const actualFiles = strictFileInventory(modelFacingRoot)
  const expectedRequired = new Set<string>()
  const expectedResponses = new Set<string>()
  for (const record of prepared.packets) {
    expectedRequired.add(
      relative(
        modelFacingRoot,
        resolve(directory, record.chunkDirectory, record.modelInputFilename),
      ),
    )
    expectedResponses.add(
      relative(modelFacingRoot, resolve(directory, record.chunkDirectory, record.responseFilename)),
    )
  }
  for (const path of actualFiles) {
    if (!expectedRequired.has(path) && !expectedResponses.has(path)) {
      throw new Error(`Unexpected model-facing file: ${path}`)
    }
  }
  for (const path of expectedRequired) {
    if (!actualFiles.includes(path)) throw new Error(`Missing required model-facing file: ${path}`)
  }
  for (const record of prepared.packets) {
    const inputPath = resolve(directory, record.chunkDirectory, record.modelInputFilename)
    const actual = readExactRegularFile(inputPath, 25_000_000).toString('utf8')
    const expected = `${canonicalShadowJson(record.packetEnvelope.packet.modelInput)}\n`
    if (
      actual !== expected ||
      createHash('sha256').update(actual.trimEnd()).digest('hex') !==
        record.packetEnvelope.packet.modelInputSha256
    ) {
      throw new Error('Model-facing input file differs from its exact prepared packet.')
    }
  }
  return prepared.packets.flatMap((record) => {
    const path = resolve(directory, record.chunkDirectory, record.responseFilename)
    if (!within(modelFacingRoot, path)) throw new Error('Response path escaped model-facing root.')
    try {
      const bytes = readExactRegularFile(path, 1_000_000)
      return [
        {
          modelInputSha256: record.packetEnvelope.packet.modelInputSha256,
          rawBase64: bytes.toString('base64'),
          rawBytesSha256: createHash('sha256').update(bytes).digest('hex'),
        },
      ]
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
      throw error
    }
  })
}

function prepare(cwd: string, argv: string[]): void {
  assertNoForbiddenSelectionText(argv)
  const args = parseCliArguments(argv)
  assertKnownArguments(args, ['created-at', 'model-id', 'reasoning-level', 'chunk-size'])
  if (args.flags.size > 0) throw new Error('Preparation options require values.')
  const repositoryCommit = authenticatedRepositoryCommit(cwd)
  const createdAt = required(args, 'created-at')
  const result = prepareExactShadowDevelopmentExperiment({
    sourceBytes: readExactRegularFile(SHADOW_DEVELOPMENT_SOURCE_FILE, 100_000_000),
    registry: loadConfiguredShadowComponentRegistry(),
    createdAt,
    repositoryCommit,
    executionModel: {
      adapterId: 'development_model_adapter',
      adapterVersion: '1.0.0',
      modelId: required(args, 'model-id'),
      reasoningLevel: required(args, 'reasoning-level'),
    },
    chunkSize: numberArgument(args, 'chunk-size', 30),
  })
  const root = ensureOutputRoot(cwd)
  const directory = resolve(
    root,
    `prepared-${createdAt.replaceAll(/[^0-9]/gu, '')}-${repositoryCommit.slice(0, 12)}`,
  )
  mkdirSync(directory, { mode: 0o700, recursive: false })
  mkdirSync(resolve(directory, 'coordinator'), { mode: 0o700 })
  mkdirSync(resolve(directory, 'model-facing'), { mode: 0o700 })
  for (const file of result.modelFacingFiles) {
    const path = resolve(directory, file.path)
    if (!within(directory, path)) throw new Error('Generated model-input path escaped output.')
    mkdirSync(dirname(path), { mode: 0o700, recursive: true })
    writeFileSync(path, `${canonicalShadowJson(file.content)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })
  }
  writeFileSync(
    resolve(directory, 'coordinator/prepared-experiment.json'),
    `${JSON.stringify(result.artifact, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx', mode: 0o600 },
  )
  console.log(directory)
}

function ingest(cwd: string, argv: string[]): void {
  assertNoForbiddenSelectionText(argv)
  const args = parseCliArguments(argv)
  assertKnownArguments(args, ['prepared-directory', 'created-at', 'run-id'])
  if (args.flags.size > 0) throw new Error('Ingestion options require values.')
  const requestedDirectory = resolve(required(args, 'prepared-directory'))
  const expectedRoot = resolve(cwd, SHADOW_DEVELOPMENT_EXPERIMENT_OUTPUT_ROOT)
  if (!within(expectedRoot, requestedDirectory)) {
    throw new Error('Prepared directory is outside the fixed experiment root.')
  }
  const directory = realpathSync(requestedDirectory)
  const root = realpathSync(expectedRoot)
  if (!within(root, directory) || !basename(directory).startsWith('prepared-')) {
    throw new Error('Prepared directory is outside the fixed experiment root.')
  }
  const preparedPath = resolve(directory, 'coordinator/prepared-experiment.json')
  let prepared = JSON.parse(
    readExactRegularFile(preparedPath, 100_000_000).toString('utf8'),
  ) as ShadowDevelopmentPreparedExperimentArtifact
  const repositoryCommit = authenticatedRepositoryCommit(cwd, prepared.repositoryCommit)
  if (prepared.packets.length !== 630)
    throw new Error('Prepared manifest must list exact 630 packets.')
  const sourceBytes = readExactRegularFile(SHADOW_DEVELOPMENT_SOURCE_FILE, 100_000_000)
  const registry = loadConfiguredShadowComponentRegistry()
  const rebuilt = prepareExactShadowDevelopmentExperiment({
    sourceBytes,
    registry,
    createdAt: prepared.createdAt,
    repositoryCommit: prepared.repositoryCommit,
    executionModel: prepared.executionModel,
    chunkSize: prepared.chunkSize,
    orderingSeed: prepared.orderingSeed,
  })
  if (sha256ShadowValue(rebuilt.artifact) !== sha256ShadowValue(prepared)) {
    throw new Error('Prepared manifest does not recompute before file access.')
  }
  prepared = rebuilt.artifact
  const workerFiles = readAuthenticatedModelFacingWorkerFiles(directory, prepared)
  const { run } = ingestExactShadowDevelopmentWorkerResults({
    sourceBytes,
    prepared,
    registry,
    workerFiles,
    repositoryCommit,
    runId: required(args, 'run-id'),
    createdAt: required(args, 'created-at'),
  })
  const output = resolve(directory, `coordinator/run-${run.artifactSha256}.json`)
  writeFileSync(output, `${JSON.stringify(run, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  })
  console.log(output)
}

function preparedDirectory(cwd: string, raw: string): string {
  const requestedDirectory = resolve(raw)
  const expectedRoot = resolve(cwd, SHADOW_DEVELOPMENT_EXPERIMENT_OUTPUT_ROOT)
  if (!within(expectedRoot, requestedDirectory))
    throw new Error('Prepared directory is outside the fixed experiment root.')
  const directoryStat = lstatSync(requestedDirectory)
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink())
    throw new Error('Prepared directory must be a real directory.')
  const directory = realpathSync(requestedDirectory)
  const root = realpathSync(expectedRoot)
  if (!within(root, directory) || !basename(directory).startsWith('prepared-'))
    throw new Error('Prepared directory is outside the fixed experiment root.')
  return directory
}

function finalize(cwd: string, argv: string[]): void {
  assertNoForbiddenSelectionText(argv)
  const args = parseCliArguments(argv)
  assertKnownArguments(args, ['prepared-directory'])
  if (args.flags.size > 0) throw new Error('Finalize options require values.')
  const directory = preparedDirectory(cwd, required(args, 'prepared-directory'))
  const preparedPath = resolve(directory, 'coordinator/prepared-experiment.json')
  const serializedPrepared = JSON.parse(
    readExactRegularFile(preparedPath, 100_000_000).toString('utf8'),
  ) as ShadowDevelopmentPreparedExperimentArtifact
  authenticatedRepositoryCommit(cwd, serializedPrepared.repositoryCommit)
  const sourceBytes = readExactRegularFile(SHADOW_DEVELOPMENT_SOURCE_FILE, 100_000_000)
  const registry = loadConfiguredShadowComponentRegistry()
  const rebuilt = prepareExactShadowDevelopmentExperiment({
    sourceBytes,
    registry,
    createdAt: serializedPrepared.createdAt,
    repositoryCommit: serializedPrepared.repositoryCommit,
    executionModel: serializedPrepared.executionModel,
    chunkSize: serializedPrepared.chunkSize,
    orderingSeed: serializedPrepared.orderingSeed,
  })
  if (sha256ShadowValue(rebuilt.artifact) !== sha256ShadowValue(serializedPrepared)) {
    throw new Error('Prepared experiment does not recompute for finalization.')
  }
  const runNames = readdirSync(resolve(directory, 'coordinator'))
    .filter((name) => /^run-[a-f0-9]{64}\.json$/u.test(name))
    .sort()
  if (runNames.length !== 1)
    throw new Error('Finalize requires exactly one checksum-named run artifact.')
  const run = JSON.parse(
    readExactRegularFile(resolve(directory, 'coordinator', runNames[0]!), 500_000_000).toString(
      'utf8',
    ),
  ) as ShadowRunArtifact
  if (runNames[0] !== `run-${run.artifactSha256}.json`) {
    throw new Error('Run filename does not equal its exact artifact checksum.')
  }
  verifyExactShadowDevelopmentRunBinding({
    prepared: rebuilt.artifact,
    run,
    scope: rebuilt.scope,
  })
  const workerFiles = readAuthenticatedModelFacingWorkerFiles(directory, rebuilt.artifact)
  const reconstituted = ingestExactShadowDevelopmentWorkerResults({
    sourceBytes,
    prepared: rebuilt.artifact,
    registry,
    workerFiles,
    repositoryCommit: rebuilt.artifact.repositoryCommit,
    runId: run.runId,
    createdAt: run.definition.createdAt,
  })
  verifyExactShadowDevelopmentRunReconstitution({
    persistedRun: run,
    reconstitutedRun: reconstituted.run,
  })
  const truthBytes = readExactRegularFile(SHADOW_DEVELOPMENT_TRUTH_FILE, 100_000_000)
  const truth = loadExactShadowDevelopmentCoordinatorTruth({ sourceBytes, truthBytes })
  const evaluation = evaluateExactShadowDevelopmentRun({ scope: rebuilt.scope, truth, run })
  const foldRows = truth.rows.map((row) => ({
    pmid: row.pmid,
    relevanceLabel: row.relevanceLabel,
    metadataSufficiency: row.metadataSufficiency,
  }))
  const folds = buildRepeatedStratifiedDevelopmentFolds({
    scope: rebuilt.scope,
    truth,
    rows: foldRows,
    seed: 'shadow-development-crossfit-v1',
    folds: 5,
    repeats: 2,
    stratification: 'relevance_label',
  })
  const attemptByPmid = new Map(
    run.attempts
      .filter((attempt) => attempt.componentId === 'ip_relevance')
      .map((attempt) => [attempt.packetEnvelope.packet.modelInput.article.pmid, attempt] as const),
  )
  const calibrationRows: ShadowCalibrationCohortRow[] = truth.rows.map((truthRow) => {
    const attempt = attemptByPmid.get(truthRow.pmid)
    if (!attempt || !attempt.validation.valid) {
      return {
        pmid: truthRow.pmid,
        truthLabel: truthRow.relevanceLabel,
        outcomeStatus: attempt?.validation.status === 'rejected_invalid' ? 'invalid' : 'missing',
        predictedLabel: null,
        probabilities: null,
      }
    }
    const response = attempt.validation.result.response
    if (response.state !== 'prediction') {
      return {
        pmid: truthRow.pmid,
        truthLabel: truthRow.relevanceLabel,
        outcomeStatus: response.state,
        predictedLabel: null,
        probabilities: null,
      }
    }
    return {
      pmid: truthRow.pmid,
      truthLabel: truthRow.relevanceLabel,
      outcomeStatus: 'prediction',
      predictedLabel: response.outputValues[0] as ShadowCalibrationCohortRow['predictedLabel'],
      probabilities: response.probabilities,
    }
  })
  const calibration = crossFitShadowTemperatureCalibration({
    scope: rebuilt.scope,
    truth,
    rows: calibrationRows,
    foldRows,
    foldManifest: folds,
  })
  const receiptWithoutHash = {
    schemaVersion: 'literature-shadow-development-finalization-receipt/1.0.0',
    developmentOnly: true,
    heldOutValidation: false,
    operationalThresholdSelected: false,
    repositoryCommit: rebuilt.artifact.repositoryCommit,
    sourceSha256: rebuilt.artifact.sourceSha256,
    truthSourceSha256: truth.truthSourceSha256,
    preparedArtifactSha256: rebuilt.artifact.artifactSha256,
    runArtifactSha256: run.artifactSha256,
    truthArtifactSha256: truth.truthArtifactSha256,
    evaluationArtifactSha256: evaluation.artifactSha256,
    foldManifestSha256: folds.manifestSha256,
    calibrationArtifactSha256: calibration.artifactSha256,
  }
  const receipt = {
    ...receiptWithoutHash,
    receiptSha256: sha256ShadowValue(receiptWithoutHash),
  }
  for (const [name, value] of [
    ['evaluation.json', evaluation],
    ['development-folds.json', folds],
    ['cross-fitted-calibration.json', calibration],
    ['finalization-receipt.json', receipt],
  ] as const) {
    writeFileSync(resolve(directory, 'coordinator', name), `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })
  }
  console.log(resolve(directory, 'coordinator/finalization-receipt.json'))
}

export function validateShadowDevelopmentExperimentCli(argv: readonly string[]): void {
  assertNoForbiddenSelectionText(argv)
  const [command, ...rest] = argv
  if (!['prepare', 'ingest', 'finalize', '--help'].includes(command ?? '')) {
    throw new Error('Expected prepare, ingest, finalize, or --help.')
  }
  if (command === '--help') {
    if (rest.length > 0) throw new Error('--help must be standalone.')
    return
  }
  const args = parseCliArguments(rest)
  const known =
    command === 'prepare'
      ? ['created-at', 'model-id', 'reasoning-level', 'chunk-size']
      : command === 'ingest'
        ? ['prepared-directory', 'created-at', 'run-id']
        : ['prepared-directory']
  assertKnownArguments(args, known)
}

function main(): void {
  const [command, ...argv] = process.argv.slice(2)
  validateShadowDevelopmentExperimentCli(process.argv.slice(2))
  if (command === '--help') {
    console.log(SHADOW_DEVELOPMENT_EXPERIMENT_USAGE)
    return
  }
  const cwd = realpathSync(process.cwd())
  if (resolve(process.argv[1] ?? '') !== fileURLToPath(import.meta.url))
    throw new Error('Canonical entrypoint required.')
  if (command === 'prepare') prepare(cwd, argv)
  else if (command === 'ingest') ingest(cwd, argv)
  else finalize(cwd, argv)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
