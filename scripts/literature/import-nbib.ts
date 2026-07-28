import { basename } from 'node:path'

import { literatureQueryRegistry } from '@/features/literature/config'
import {
  DEFAULT_LITERATURE_IMPORT_BATCH_SIZE,
  MAX_LITERATURE_IMPORT_BATCH_SIZE,
} from '@/features/literature/constants'
import { normalizeNbibRecord } from '@/features/literature/domain/normalize'
import { parseNbibFile } from '@/features/literature/domain/nbib-parser'
import type { LiteratureManifestFile } from '@/features/literature/schemas/config'
import { literatureArticleDatabaseRow } from '@/features/literature/server/database-mappers'
import type { NbibIssue, NormalizedLiteratureArticle } from '@/features/literature/types'

import {
  assertKnownArguments,
  hasFlag,
  numberArgument,
  parseCliArguments,
  stringArgument,
} from './lib/cli'
import { executeDatabaseCall, resolveLiteratureWriteMode } from './lib/database'
import { resolveManifestPath } from './lib/files'
import { resolveInputContext } from './lib/input'
import { formatValidationSummary, writeValidationReport } from './lib/report'
import { validateLiteratureFiles } from './lib/validation'

const HELP = `
Validate and idempotently import NBIB metadata.

Usage:
  npm run literature:import -- --manifest <path> [--dry-run]
  npm run literature:import -- --manifest <path> --commit --target local
  npm run literature:import -- --manifest <path> --commit --target remote --confirm-remote

Input:
  --manifest <path>   Provenance manifest (default local-data/literature/import-manifest.json)
  --file <path>       One ad-hoc file, imported with unmapped provenance
  --directory <path>  Ad-hoc directory, imported with unmapped provenance

Safety and limits:
  --dry-run           Validate only; this is the default when --commit is absent
  --commit            Write to the selected Supabase target
  --target <value>    local (default) or remote
  --confirm-remote    Additional required acknowledgement for a remote commit
  --force             Reprocess an identical completed batch without duplicating provenance
  --limit <n>         Bound total record occurrences
  --batch-size <n>    1-500 (default 300)
  --report-dir <path> Default local-data/literature/reports
`.trim()

interface ImportCounters {
  recordsRead: number
  uniquePmids: number
  inserted: number
  updated: number
  unchanged: number
  duplicates: number
  errors: number
}

interface ExistingArticleRow {
  metadata_hash: string
  pmid: string
}

interface ImportBatchRow {
  id: string
  status: string
}

function databaseErrorRows(
  batchId: string,
  sourceFilename: string,
  issues: NbibIssue[],
  article: NormalizedLiteratureArticle | null,
  rawTags: Record<string, string[]>,
) {
  const excerpt = JSON.stringify(rawTags).slice(0, 4_000)
  return issues
    .filter((issue) => issue.code !== 'UNMATCHED_JOURNAL')
    .map((issue) => ({
      batch_id: batchId,
      source_filename: sourceFilename,
      record_number: issue.recordNumber,
      pmid: article?.pmid ?? rawTags.PMID?.[0]?.trim() ?? null,
      error_code: issue.code,
      error_message: issue.message,
      raw_excerpt: excerpt,
    }))
}

async function findCompletedBatch(
  client: NonNullable<ReturnType<typeof resolveLiteratureWriteMode>['client']>,
  entry: LiteratureManifestFile,
  checksum: string,
  manifestVersion: string,
  queryRegistryVersion: string,
  recordLimit: number | undefined,
) {
  let query = client
    .from('literature_import_batches')
    .select('id,status')
    .eq('source_file_sha256', checksum)
    .eq('manifest_version', manifestVersion)
    .eq('query_registry_version', queryRegistryVersion)
    .eq('source_kind', entry.source_kind)
    .eq('status', 'completed')
    .limit(1)

  query = entry.source_id ? query.eq('source_id', entry.source_id) : query.is('source_id', null)
  query = entry.query_id ? query.eq('query_id', entry.query_id) : query.is('query_id', null)
  query =
    recordLimit === undefined
      ? query.is('record_limit', null)
      : query.eq('record_limit', recordLimit)

  const data = await executeDatabaseCall<ImportBatchRow[]>(
    'Completed import-batch lookup',
    () => query,
  )
  return data?.[0] ?? null
}

async function createOrRestartBatch(
  client: NonNullable<ReturnType<typeof resolveLiteratureWriteMode>['client']>,
  entry: LiteratureManifestFile,
  checksum: string,
  manifestVersion: string,
  queryRegistryVersion: string,
  existing: ImportBatchRow | null,
  recordLimit: number | undefined,
) {
  const sourceFilename = basename(resolveManifestPath(entry.path))
  const resetValues = {
    source_filename: sourceFilename,
    source_file_sha256: checksum,
    manifest_version: manifestVersion,
    query_registry_version: queryRegistryVersion,
    source_kind: entry.source_kind,
    source_id: entry.source_id,
    query_id: entry.query_id,
    date_from: entry.date_from,
    date_to: entry.date_to,
    status: 'started',
    records_read: 0,
    unique_pmids: 0,
    inserted_count: 0,
    updated_count: 0,
    duplicate_count: 0,
    error_count: 0,
    record_limit: recordLimit ?? null,
    started_at: new Date().toISOString(),
    completed_at: null,
    report: null,
    created_by: process.env.LITERATURE_IMPORT_ACTOR ?? 'literature-import-cli',
  }

  if (existing) {
    await executeDatabaseCall('Clear restarted import errors', () =>
      client.from('literature_import_errors').delete().eq('batch_id', existing.id),
    )
    const data = await executeDatabaseCall<ImportBatchRow[]>('Restart import batch', () =>
      client
        .from('literature_import_batches')
        .update(resetValues)
        .eq('id', existing.id)
        .select('id,status'),
    )
    const batch = data?.[0]
    if (!batch) {
      throw new Error('Restarted import batch was not returned.')
    }
    return batch
  }

  const data = await executeDatabaseCall<ImportBatchRow>('Create import batch', () =>
    client.from('literature_import_batches').insert(resetValues).select('id,status').single(),
  )
  if (!data) {
    throw new Error('Created import batch was not returned.')
  }
  return data
}

async function flushArticleBatch(
  client: NonNullable<ReturnType<typeof resolveLiteratureWriteMode>['client']>,
  articles: NormalizedLiteratureArticle[],
  batchId: string,
  entry: LiteratureManifestFile,
) {
  const pmids = articles.map((article) => article.pmid)
  const existing = await executeDatabaseCall<ExistingArticleRow[]>('Existing article lookup', () =>
    client.from('literature_articles').select('pmid,metadata_hash').in('pmid', pmids),
  )
  const hashes = new Map((existing ?? []).map((article) => [article.pmid, article.metadata_hash]))
  const changed = articles.filter((article) => hashes.get(article.pmid) !== article.metadataHash)

  if (changed.length > 0) {
    await executeDatabaseCall('Article metadata upsert', () =>
      client
        .from('literature_articles')
        .upsert(changed.map(literatureArticleDatabaseRow), { onConflict: 'pmid' }),
    )
  }

  await executeDatabaseCall('Article provenance upsert', () =>
    client.from('literature_article_sources').upsert(
      pmids.map((pmid) => ({
        pmid,
        batch_id: batchId,
        source_kind: entry.source_kind,
        source_id: entry.source_id,
        query_id: entry.query_id,
        source_filename: basename(resolveManifestPath(entry.path)),
      })),
      {
        onConflict: 'pmid,batch_id',
        ignoreDuplicates: true,
      },
    ),
  )

  return {
    inserted: articles.filter((article) => !hashes.has(article.pmid)).length,
    updated: articles.filter(
      (article) => hashes.has(article.pmid) && hashes.get(article.pmid) !== article.metadataHash,
    ).length,
    unchanged: articles.filter((article) => hashes.get(article.pmid) === article.metadataHash)
      .length,
  }
}

async function importFile(
  client: NonNullable<ReturnType<typeof resolveLiteratureWriteMode>['client']>,
  entry: LiteratureManifestFile,
  checksum: string,
  manifestVersion: string,
  queryRegistryVersion: string,
  batchSize: number,
  limit: number | undefined,
  force: boolean,
) {
  const existing = await findCompletedBatch(
    client,
    entry,
    checksum,
    manifestVersion,
    queryRegistryVersion,
    limit,
  )
  if (existing && !force) {
    console.log(`Skipped identical completed batch: ${entry.path}`)
    return {
      skipped: true,
      counters: {
        recordsRead: 0,
        uniquePmids: 0,
        inserted: 0,
        updated: 0,
        unchanged: 0,
        duplicates: 0,
        errors: 0,
      } satisfies ImportCounters,
    }
  }

  const batch = await createOrRestartBatch(
    client,
    entry,
    checksum,
    manifestVersion,
    queryRegistryVersion,
    existing,
    limit,
  )
  const counters: ImportCounters = {
    recordsRead: 0,
    uniquePmids: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    duplicates: 0,
    errors: 0,
  }
  const seenPmids = new Set<string>()
  const articleBuffer = new Map<string, NormalizedLiteratureArticle>()
  const errorBuffer: ReturnType<typeof databaseErrorRows> = []
  const sourceFilename = basename(resolveManifestPath(entry.path))

  async function flush() {
    const articles = [...articleBuffer.values()]
    if (articles.length > 0) {
      const result = await flushArticleBatch(client, articles, batch.id, entry)
      counters.inserted += result.inserted
      counters.updated += result.updated
      counters.unchanged += result.unchanged
      articleBuffer.clear()
    }

    if (errorBuffer.length > 0) {
      await executeDatabaseCall('Import error insert', () =>
        client.from('literature_import_errors').insert(errorBuffer.splice(0)),
      )
    }
  }

  try {
    for await (const parsed of parseNbibFile(resolveManifestPath(entry.path))) {
      if (limit && counters.recordsRead >= limit) {
        break
      }

      counters.recordsRead += 1
      const normalized = normalizeNbibRecord(parsed.record, literatureQueryRegistry, parsed.issues)
      const databaseErrors = databaseErrorRows(
        batch.id,
        sourceFilename,
        normalized.issues,
        normalized.article,
        parsed.record.tags,
      )
      counters.errors += databaseErrors.length
      errorBuffer.push(...databaseErrors)

      if (normalized.article) {
        if (seenPmids.has(normalized.article.pmid)) {
          counters.duplicates += 1
        } else {
          seenPmids.add(normalized.article.pmid)
        }
        articleBuffer.set(normalized.article.pmid, normalized.article)
      }

      if (articleBuffer.size >= batchSize || errorBuffer.length >= batchSize) {
        await flush()
      }
    }

    await flush()
    counters.uniquePmids = seenPmids.size
    const completedAt = new Date().toISOString()
    await executeDatabaseCall('Complete import batch', () =>
      client
        .from('literature_import_batches')
        .update({
          status: 'completed',
          records_read: counters.recordsRead,
          unique_pmids: counters.uniquePmids,
          inserted_count: counters.inserted,
          updated_count: counters.updated,
          duplicate_count: counters.duplicates,
          error_count: counters.errors,
          completed_at: completedAt,
          report: {
            unchanged_count: counters.unchanged,
            manifest_status: entry.status,
          },
        })
        .eq('id', batch.id),
    )
  } catch (error) {
    await executeDatabaseCall('Fail import batch', () =>
      client
        .from('literature_import_batches')
        .update({
          status: 'failed',
          records_read: counters.recordsRead,
          unique_pmids: seenPmids.size,
          inserted_count: counters.inserted,
          updated_count: counters.updated,
          duplicate_count: counters.duplicates,
          error_count: counters.errors + 1,
          completed_at: new Date().toISOString(),
          report: {
            failure: error instanceof Error ? error.message.slice(0, 1_000) : 'Unknown failure',
          },
        })
        .eq('id', batch.id),
    )
    throw error
  }

  console.log(
    `Imported ${entry.path}: ${counters.inserted} inserted, ${counters.updated} updated, ${counters.unchanged} unchanged`,
  )
  return { skipped: false, counters }
}

async function main() {
  const commandStartedAt = Date.now()
  const arguments_ = parseCliArguments(process.argv.slice(2))
  assertKnownArguments(arguments_, [
    'manifest',
    'file',
    'directory',
    'dry-run',
    'commit',
    'force',
    'limit',
    'batch-size',
    'target',
    'confirm-remote',
    'report-dir',
    'help',
  ])
  if (hasFlag(arguments_, 'help')) {
    console.log(HELP)
    return
  }

  const input = await resolveInputContext(arguments_)
  const limit = numberArgument(arguments_, 'limit')
  const batchSize = numberArgument(arguments_, 'batch-size', DEFAULT_LITERATURE_IMPORT_BATCH_SIZE)
  if (!batchSize || batchSize > MAX_LITERATURE_IMPORT_BATCH_SIZE) {
    throw new Error(`--batch-size must be between 1 and ${MAX_LITERATURE_IMPORT_BATCH_SIZE}.`)
  }

  const validationReport = await validateLiteratureFiles({
    entries: input.entries,
    limit,
  })
  console.log(formatValidationSummary(validationReport))
  const writeMode = resolveLiteratureWriteMode(arguments_, validationReport.recordsParsed)
  const reportDirectory = stringArgument(arguments_, 'report-dir', 'local-data/literature/reports')

  if (!writeMode.commit || !writeMode.client) {
    validationReport.elapsedMs = Date.now() - commandStartedAt
    const path = await writeValidationReport(validationReport, reportDirectory, 'import-dry-run')
    console.log(`Dry-run report: ${path}`)
    return
  }

  let remaining = limit
  let totalInserted = 0
  let totalUpdated = 0
  let totalUnchanged = 0

  for (const entry of input.entries) {
    if (remaining !== undefined && remaining <= 0) {
      break
    }
    const fileReport = validationReport.files.find((candidate) => candidate.path === entry.path)
    if (!fileReport) {
      continue
    }

    const result = await importFile(
      writeMode.client,
      entry,
      fileReport.sha256,
      input.manifestVersion,
      input.queryRegistryVersion,
      batchSize,
      remaining,
      hasFlag(arguments_, 'force'),
    )
    totalInserted += result.counters.inserted
    totalUpdated += result.counters.updated
    totalUnchanged += result.counters.unchanged
    if (remaining !== undefined) {
      remaining -= result.counters.recordsRead
    }
  }

  validationReport.insertCandidates = totalInserted
  validationReport.updateCandidates = totalUpdated
  validationReport.unchangedRecords = totalUnchanged
  validationReport.elapsedMs = Date.now() - commandStartedAt
  const reportPath = await writeValidationReport(validationReport, reportDirectory, 'import')
  console.log(`Import report: ${reportPath}`)
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
