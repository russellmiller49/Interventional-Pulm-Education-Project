import { createHash, randomUUID } from 'node:crypto'
import { link, lstat, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  GOLD_ENRICHMENT_BATCH_NAME,
  buildFidelityAudit,
  buildGoldEnrichmentReceipt,
  buildGoldEnrichmentSource,
  canonicalDatabaseStateSha256,
  loadCanonicalDevelopmentSnapshot,
  parsePhysicianRelevanceCsv,
  serializeGoldEnrichmentReceipt,
  type GoldEnrichmentReceipt,
} from './enrichment-source'
import {
  assertKnownArguments,
  hasFlag,
  parseCliArguments,
  stringArgument,
  type ParsedCliArguments,
} from './lib/cli'
import { createLiteratureReadClient } from './lib/database'

const HELP = `
Build a deterministic, database-backed development enrichment source.

Usage:
  npm run literature:build-gold-enrichment-source -- \\
    --batch gold-set-v1 \\
    --reviews /absolute/path/gold-set-v1_physician_relevance_final_630.csv \\
    --output local-data/literature/gold-sets/gold-set-v1/enrichment-source-v2.csv \\
    --prior-source /absolute/path/gold-set-v1_enrichment_results_full-text-reconciled-v2_quality-cleaned_630.csv

Safety:
  This command selects only the checksum-bound gold-set-v1 development membership and canonical
  literature_articles metadata. It has no database mutation path and rejects held-out/test/all
  options. The supplied physician and prior-export files are checksum-bound.

Options:
  --batch <id>          Required; must be exactly gold-set-v1.
  --reviews <path>      Required absolute definitive 630-row physician relevance CSV.
  --output <path>       Required .csv path under this checkout's ignored local-data tree.
  --receipt <path>      Optional .json path; defaults beside the output CSV.
  --prior-source <path> Required absolute prior quality-cleaned export for the fidelity audit.
  --target local        Optional; only local is accepted.
  --help                Show this help.
`.trim()

const FORBIDDEN_OPTIONS = new Set([
  'all',
  'dataset-split',
  'held-out',
  'heldout',
  'include-held-out',
  'include-test',
  'split',
  'test',
])
const FORBIDDEN_INPUT_PATH_TOKEN = /(?:^|[\/_. -])(?:test|all|held[ _-]?out)(?=$|[\/_. -])/iu

export interface BuildGoldEnrichmentCliOptions {
  batch: typeof GOLD_ENRICHMENT_BATCH_NAME
  outputPath: string
  priorSourcePath: string
  receiptPath: string
  reviewsPath: string
  target: 'local'
}

interface BoundUtf8Source {
  bytes: Uint8Array
  sha256: string
  text: string
}

function rejectForbiddenOptions(arguments_: ParsedCliArguments) {
  const supplied = [...arguments_.flags, ...arguments_.values.keys()]
  const forbidden = supplied.filter((key) => FORBIDDEN_OPTIONS.has(key.toLocaleLowerCase('en-US')))
  if (forbidden.length > 0) {
    throw new Error(
      `Held-out/test/all split options are forbidden: ${forbidden.map((key) => `--${key}`).join(', ')}.`,
    )
  }
}

function requireAbsoluteDevelopmentCsv(inputPath: string, optionName: string) {
  if (!path.isAbsolute(inputPath)) throw new Error(`${optionName} must be an absolute path.`)
  if (path.extname(inputPath).toLocaleLowerCase('en-US') !== '.csv') {
    throw new Error(`${optionName} must reference a .csv file.`)
  }
  if (FORBIDDEN_INPUT_PATH_TOKEN.test(inputPath)) {
    throw new Error(`${optionName} path has held-out/test/all semantics and is forbidden.`)
  }
  return path.resolve(inputPath)
}

export function parseBuildGoldEnrichmentArguments(
  argv: string[],
  workspaceRoot = process.cwd(),
): BuildGoldEnrichmentCliOptions | null {
  const arguments_ = parseCliArguments(argv)
  rejectForbiddenOptions(arguments_)
  assertKnownArguments(arguments_, [
    'batch',
    'help',
    'output',
    'prior-source',
    'receipt',
    'reviews',
    'target',
  ])
  if (hasFlag(arguments_, 'help')) return null

  const batch = stringArgument(arguments_, 'batch')
  if (batch !== GOLD_ENRICHMENT_BATCH_NAME) {
    throw new Error(`--batch must be exactly ${GOLD_ENRICHMENT_BATCH_NAME}.`)
  }
  const reviews = stringArgument(arguments_, 'reviews')
  if (!reviews) throw new Error('--reviews is required.')
  const output = stringArgument(arguments_, 'output')
  if (!output) throw new Error('--output is required.')
  const target = stringArgument(arguments_, 'target', 'local')
  if (target !== 'local') throw new Error('--target must be local; remote access is forbidden.')

  const outputPath = path.resolve(workspaceRoot, output)
  if (path.extname(outputPath).toLocaleLowerCase('en-US') !== '.csv') {
    throw new Error('--output must use the .csv extension.')
  }
  const receiptPath = path.resolve(
    workspaceRoot,
    stringArgument(arguments_, 'receipt') ?? outputPath.replace(/\.csv$/iu, '.receipt.json'),
  )
  if (path.extname(receiptPath).toLocaleLowerCase('en-US') !== '.json') {
    throw new Error('--receipt must use the .json extension.')
  }
  if (outputPath === receiptPath) throw new Error('Output CSV and receipt paths must be distinct.')

  const priorSource = stringArgument(arguments_, 'prior-source')
  if (!priorSource) throw new Error('--prior-source is required for the export-fidelity audit.')
  return {
    batch,
    outputPath,
    priorSourcePath: requireAbsoluteDevelopmentCsv(priorSource, '--prior-source'),
    receiptPath,
    reviewsPath: requireAbsoluteDevelopmentCsv(reviews, '--reviews'),
    target,
  }
}

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function requireRegularSource(sourcePath: string, label: string) {
  const metadata = await lstat(sourcePath)
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`${label} must be a non-symlink regular file.`)
  }
}

export async function readBoundUtf8Source(
  sourcePath: string,
  label: string,
): Promise<BoundUtf8Source> {
  await requireRegularSource(sourcePath, label)
  const bytes = await readFile(sourcePath)
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error(`${label} is not valid UTF-8.`)
  }
  if (Buffer.compare(Buffer.from(text, 'utf8'), bytes) !== 0) {
    throw new Error(`${label} cannot be decoded and re-encoded as byte-identical UTF-8.`)
  }
  return { bytes, sha256: sha256(bytes), text }
}

async function assertSourceUnchanged(sourcePath: string, label: string, original: BoundUtf8Source) {
  const current = await readBoundUtf8Source(sourcePath, label)
  if (current.sha256 !== original.sha256 || Buffer.compare(current.bytes, original.bytes) !== 0) {
    throw new Error(`${label} changed while the export was running.`)
  }
}

function isWithin(root: string, candidate: string) {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

async function lstatIfPresent(candidate: string) {
  try {
    return await lstat(candidate)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function assertSafeArtifactPath(candidate: string, workspaceRoot: string) {
  const localDataRoot = path.resolve(workspaceRoot, 'local-data')
  if (candidate === localDataRoot || !isWithin(localDataRoot, candidate)) {
    throw new Error('Enrichment-source artifacts must remain below repository local-data.')
  }
  const relativeParts = path.relative(localDataRoot, candidate).split(path.sep).filter(Boolean)
  if (relativeParts[0]?.toLocaleLowerCase('en-US') === 'inputs') {
    throw new Error('Enrichment-source artifacts must not use read-only local-data/inputs.')
  }
  const localDataMetadata = await lstatIfPresent(localDataRoot)
  if (!localDataMetadata?.isDirectory() || localDataMetadata.isSymbolicLink()) {
    throw new Error('Repository local-data must be a non-symlink directory.')
  }
  let current = localDataRoot
  for (const part of relativeParts.slice(0, -1)) {
    current = path.join(current, part)
    const metadata = await lstatIfPresent(current)
    if (!metadata) break
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error(`Refusing artifact path through non-directory or symlink ${current}.`)
    }
  }
  if (await lstatIfPresent(candidate)) throw new Error(`Refusing to overwrite ${candidate}.`)
}

async function unlinkIfPresent(candidate: string) {
  try {
    await unlink(candidate)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

export async function writeGoldEnrichmentArtifacts(
  outputPath: string,
  csv: string,
  receiptPath: string,
  receipt: GoldEnrichmentReceipt,
  workspaceRoot: string,
) {
  await assertSafeArtifactPath(outputPath, workspaceRoot)
  await assertSafeArtifactPath(receiptPath, workspaceRoot)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await mkdir(path.dirname(receiptPath), { recursive: true })
  const token = `${process.pid}-${randomUUID()}`
  const temporaryOutputPath = path.join(
    path.dirname(outputPath),
    `.${path.basename(outputPath)}.${token}.tmp`,
  )
  const temporaryReceiptPath = path.join(
    path.dirname(receiptPath),
    `.${path.basename(receiptPath)}.${token}.tmp`,
  )
  const outputBytes = Buffer.from(csv, 'utf8')
  const receiptBytes = Buffer.from(serializeGoldEnrichmentReceipt(receipt), 'utf8')
  let outputPublished = false
  let receiptPublished = false
  try {
    await writeFile(temporaryOutputPath, outputBytes, { flag: 'wx', mode: 0o600 })
    await writeFile(temporaryReceiptPath, receiptBytes, { flag: 'wx', mode: 0o600 })
    if (Buffer.compare(await readFile(temporaryOutputPath), outputBytes) !== 0) {
      throw new Error('Temporary enrichment-source CSV failed post-write byte validation.')
    }
    if (Buffer.compare(await readFile(temporaryReceiptPath), receiptBytes) !== 0) {
      throw new Error('Temporary enrichment-source receipt failed post-write byte validation.')
    }

    await link(temporaryOutputPath, outputPath)
    outputPublished = true
    await link(temporaryReceiptPath, receiptPath)
    receiptPublished = true
    if (Buffer.compare(await readFile(outputPath), outputBytes) !== 0) {
      throw new Error('Published enrichment-source CSV failed post-write byte validation.')
    }
    if (Buffer.compare(await readFile(receiptPath), receiptBytes) !== 0) {
      throw new Error('Published enrichment-source receipt failed post-write byte validation.')
    }
  } catch (error) {
    if (receiptPublished) await unlinkIfPresent(receiptPath)
    if (outputPublished) await unlinkIfPresent(outputPath)
    throw error
  } finally {
    await unlinkIfPresent(temporaryReceiptPath)
    await unlinkIfPresent(temporaryOutputPath)
  }
}

export async function runBuildGoldEnrichmentSource(
  options: BuildGoldEnrichmentCliOptions,
  workspaceRoot = process.cwd(),
) {
  const reviewsSource = await readBoundUtf8Source(options.reviewsPath, 'Physician relevance source')
  const reviews = parsePhysicianRelevanceCsv(reviewsSource.text)
  if (reviews.sourceSha256 !== reviewsSource.sha256) {
    throw new Error('Physician relevance text and byte checksums disagree.')
  }

  const priorSource = await readBoundUtf8Source(
    options.priorSourcePath,
    'Previous enrichment source',
  )
  const client = createLiteratureReadClient(parseCliArguments(['--target', options.target]))
  const snapshotBefore = await loadCanonicalDevelopmentSnapshot(client)
  const databaseStateSha256Before = canonicalDatabaseStateSha256(snapshotBefore)
  const build = buildGoldEnrichmentSource(snapshotBefore, reviews)
  const fidelityAudit = buildFidelityAudit(snapshotBefore, reviews, priorSource.text)

  await assertSourceUnchanged(options.reviewsPath, 'Physician relevance source', reviewsSource)
  await assertSourceUnchanged(options.priorSourcePath, 'Previous enrichment source', priorSource)

  const snapshotAfter = await loadCanonicalDevelopmentSnapshot(client)
  const databaseStateSha256After = canonicalDatabaseStateSha256(snapshotAfter)
  const receipt = buildGoldEnrichmentReceipt({
    build,
    databaseStateSha256After,
    databaseStateSha256Before,
    fidelityAudit,
    physicianReviews: reviews,
    snapshot: snapshotBefore,
  })
  await writeGoldEnrichmentArtifacts(
    options.outputPath,
    build.csv,
    options.receiptPath,
    receipt,
    workspaceRoot,
  )
  return { build, receipt }
}

async function main() {
  const options = parseBuildGoldEnrichmentArguments(process.argv.slice(2))
  if (!options) {
    console.log(HELP)
    return
  }
  const { build, receipt } = await runBuildGoldEnrichmentSource(options)
  console.log(`Exported ${build.rows.length} development rows to ${options.outputPath}`)
  console.log(`Receipt: ${options.receiptPath}`)
  console.log(`Output SHA-256: ${build.outputSha256}`)
  console.log(`Database-state SHA-256: ${receipt.sources.canonicalDatabase.stateSha256Before}`)
  console.log(`Physician-field SHA-256: ${receipt.physicianFieldIntegrity.inputSha256} (unchanged)`)
  for (const [field, coverage] of Object.entries(receipt.fieldCoverage)) {
    console.log(`${field}: ${coverage.populated}/${build.rows.length} populated`)
  }
  if (receipt.fidelityAudit) {
    console.log(`Prior title differences: ${receipt.fidelityAudit.titleDifferences.count}`)
    console.log(`Prior abstract differences: ${receipt.fidelityAudit.abstractDifferences.count}`)
    console.log(
      `Prior PMID order mismatches: ${receipt.fidelityAudit.pmidAndOrder.orderMismatches.length}`,
    )
    console.log(
      `Prior physician-field mismatches: ${receipt.fidelityAudit.physicianFieldMismatches.length}`,
    )
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
