import { mkdir, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { formatJson } from '../format-json'
import { openFdaDownloadManifestSchema, openFdaManifestSnapshotSchema } from './schemas'
import {
  OPENFDA_MANIFEST_ENDPOINT,
  type OpenFdaManifestDataset,
  type OpenFdaManifestPartition,
  type OpenFdaManifestSnapshot,
} from './types'

const DEFAULT_OUTPUT_DIRECTORY = 'data/ip-preference-cards/generated/openfda'
const DEFAULT_BULK_DIRECTORY = 'local-data/ip-preference-cards/openfda/bulk'

export interface OpenFdaDownloadCliOptions {
  all: boolean
  partition: number | null
  from: number | null
  to: number | null
  force: boolean
  concurrency: number
}

function positiveInteger(value: string | undefined, option: string): number {
  if (!value || !/^\d+$/.test(value)) {
    throw new Error(`${option} requires a positive integer.`)
  }
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${option} requires a positive integer.`)
  }
  return parsed
}

export function parseOpenFdaDownloadArgs(args: string[]): OpenFdaDownloadCliOptions {
  const options: OpenFdaDownloadCliOptions = {
    all: false,
    partition: null,
    from: null,
    to: null,
    force: false,
    concurrency: 2,
  }
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    switch (argument) {
      case '--all':
        options.all = true
        break
      case '--partition':
        options.partition = positiveInteger(args[index + 1], argument)
        index += 1
        break
      case '--from':
        options.from = positiveInteger(args[index + 1], argument)
        index += 1
        break
      case '--to':
        options.to = positiveInteger(args[index + 1], argument)
        index += 1
        break
      case '--force':
        options.force = true
        break
      case '--concurrency':
        options.concurrency = Math.min(4, positiveInteger(args[index + 1], argument))
        index += 1
        break
      default:
        throw new Error(`Unknown option: ${argument}`)
    }
  }
  const modes =
    Number(options.all) + Number(options.partition !== null) + Number(options.from !== null)
  if (modes > 1) {
    throw new Error('Choose only one of --all, --partition, or --from/--to.')
  }
  if ((options.from === null) !== (options.to === null)) {
    throw new Error('--from and --to must be supplied together.')
  }
  if (options.from !== null && options.to !== null && options.from > options.to) {
    throw new Error('--from cannot be greater than --to.')
  }
  return options
}

export function bulkDownloadRequested(options: OpenFdaDownloadCliOptions): boolean {
  return options.all || options.partition !== null || options.from !== null
}

function numberOrNull(value: string | number | undefined): number | null {
  if (value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function buildManifestSnapshot(
  dataset: OpenFdaManifestDataset,
  retrievedAt: string,
): OpenFdaManifestSnapshot {
  const partitions = dataset.partitions.map((partition, index) => ({
    index: index + 1,
    display_name: partition.display_name,
    file: partition.file,
    size_mb: numberOrNull(partition.size_mb),
    records: partition.records ?? null,
  }))
  const knownSizes = partitions
    .map((partition) => partition.size_mb)
    .filter((size): size is number => size !== null)
  return openFdaManifestSnapshotSchema.parse({
    format_version: 1,
    retrieved_at: retrievedAt,
    export_date: dataset.export_date,
    total_records: dataset.total_records ?? null,
    partition_count: partitions.length,
    total_size_mb:
      knownSizes.length === partitions.length
        ? Number(knownSizes.reduce((total, size) => total + size, 0).toFixed(2))
        : null,
    partitions,
  })
}

export function selectManifestPartitions(
  dataset: OpenFdaManifestDataset,
  options: OpenFdaDownloadCliOptions,
): Array<{ index: number; partition: OpenFdaManifestPartition }> {
  if (!bulkDownloadRequested(options)) return []
  const indexed = dataset.partitions.map((partition, index) => ({
    index: index + 1,
    partition,
  }))
  let selected = indexed
  if (options.partition !== null) {
    selected = indexed.filter(({ index }) => index === options.partition)
  } else if (options.from !== null && options.to !== null) {
    selected = indexed.filter(({ index }) => index >= options.from! && index <= options.to!)
  }
  if (selected.length === 0) {
    throw new Error(
      `Requested partition selection is outside the manifest's 1-${dataset.partitions.length} range.`,
    )
  }
  if (
    options.partition !== null &&
    (options.partition < 1 || options.partition > dataset.partitions.length)
  ) {
    throw new Error(
      `--partition must be between 1 and ${dataset.partitions.length} for this export.`,
    )
  }
  if (
    options.from !== null &&
    options.to !== null &&
    (options.from < 1 || options.to > dataset.partitions.length)
  ) {
    throw new Error(`--from/--to must stay within 1-${dataset.partitions.length} for this export.`)
  }
  return selected
}

async function existingFileLooksComplete(
  filePath: string,
  expectedSizeMb: number | null,
): Promise<boolean> {
  try {
    const details = await stat(filePath)
    if (details.size <= 0) return false
    if (expectedSizeMb === null) return true
    return details.size >= expectedSizeMb * 1024 * 1024 * 0.8
  } catch {
    return false
  }
}

function safePartitionFilename(fileUrl: string): string {
  const url = new URL(fileUrl)
  if (url.protocol !== 'https:') {
    throw new Error(`Refusing non-HTTPS partition URL: ${url.origin}`)
  }
  if (url.hostname !== 'download.open.fda.gov') {
    throw new Error(`Refusing non-openFDA partition host: ${url.hostname}`)
  }
  const filename = path.posix.basename(url.pathname)
  if (!/^[a-zA-Z0-9._-]+\.json\.zip$/.test(filename)) {
    throw new Error(`Manifest contains an unsafe partition filename: ${filename}`)
  }
  return filename
}

async function downloadPartition({
  partition,
  index,
  bulkDirectory,
  force,
  fetchImpl,
}: {
  partition: OpenFdaManifestPartition
  index: number
  bulkDirectory: string
  force: boolean
  fetchImpl: typeof fetch
}): Promise<'downloaded' | 'skipped'> {
  const filename = safePartitionFilename(partition.file)
  const targetPath = path.join(bulkDirectory, filename)
  const partialPath = `${targetPath}.part`
  const expectedSizeMb = numberOrNull(partition.size_mb)
  if (!force && (await existingFileLooksComplete(targetPath, expectedSizeMb))) {
    return 'skipped'
  }

  const response = await fetchImpl(partition.file, {
    method: 'GET',
    headers: { Accept: 'application/zip' },
  })
  if (!response.ok) {
    throw new Error(`Partition ${index} download failed with HTTP ${response.status}.`)
  }
  const body = Buffer.from(await response.arrayBuffer())
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > 0 && body.byteLength !== contentLength) {
    throw new Error(
      `Partition ${index} was truncated: received ${body.byteLength} of ${contentLength} bytes.`,
    )
  }
  if (expectedSizeMb !== null && body.byteLength < expectedSizeMb * 1024 * 1024 * 0.5) {
    throw new Error(
      `Partition ${index} is clearly smaller than the manifest estimate; leaving no completed file.`,
    )
  }
  if (body.byteLength === 0) {
    throw new Error(`Partition ${index} returned an empty response.`)
  }
  await writeFile(partialPath, body, { mode: 0o600 })
  await rename(partialPath, targetPath)
  return 'downloaded'
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let nextIndex = 0
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(values[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()))
  return results
}

export async function runOpenFdaPartitionDownloader(
  options: OpenFdaDownloadCliOptions,
  {
    fetchImpl = fetch,
    outputDirectory = DEFAULT_OUTPUT_DIRECTORY,
    bulkDirectory = process.env.OPENFDA_BULK_DIR ?? DEFAULT_BULK_DIRECTORY,
    now = () => new Date(),
    log = console.log,
  }: {
    fetchImpl?: typeof fetch
    outputDirectory?: string
    bulkDirectory?: string
    now?: () => Date
    log?: (message: string) => void
  } = {},
): Promise<{ snapshot: OpenFdaManifestSnapshot; downloaded: number; skipped: number }> {
  const response = await fetchImpl(OPENFDA_MANIFEST_ENDPOINT, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`openFDA download manifest failed with HTTP ${response.status}.`)
  }
  const manifest = openFdaDownloadManifestSchema.parse(await response.json())
  const dataset = manifest.results.device.udi
  const snapshot = buildManifestSnapshot(dataset, now().toISOString())
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(
    path.join(outputDirectory, 'manifest-snapshot.json'),
    await formatJson(snapshot),
    'utf8',
  )

  log(
    `openFDA UDI export ${snapshot.export_date}: ${snapshot.partition_count} partitions, ${
      snapshot.total_records?.toLocaleString('en-US') ?? 'unknown'
    } records, ${
      snapshot.total_size_mb === null ? 'unknown size' : `${snapshot.total_size_mb.toFixed(2)} MB`
    }.`,
  )
  log(
    'A new openFDA export replaces the dataset: refresh every partition before building a complete local index.',
  )
  const selected = selectManifestPartitions(dataset, options)
  if (selected.length === 0) {
    log('Manifest snapshot written. No partitions downloaded; use an explicit selection flag.')
    return { snapshot, downloaded: 0, skipped: 0 }
  }

  await mkdir(bulkDirectory, { recursive: true })
  const outcomes = await mapWithConcurrency(selected, options.concurrency, ({ partition, index }) =>
    downloadPartition({
      partition,
      index,
      bulkDirectory,
      force: options.force,
      fetchImpl,
    }),
  )
  const downloaded = outcomes.filter((outcome) => outcome === 'downloaded').length
  const skipped = outcomes.filter((outcome) => outcome === 'skipped').length
  log(`Partition transfer complete: ${downloaded} downloaded, ${skipped} skipped.`)
  return { snapshot, downloaded, skipped }
}

async function main() {
  await runOpenFdaPartitionDownloader(parseOpenFdaDownloadArgs(process.argv.slice(2)))
}

if (process.argv[1]?.endsWith('download-udi-partitions.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
