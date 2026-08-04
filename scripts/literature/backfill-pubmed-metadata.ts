import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { link, lstat, mkdir, open, unlink, type FileHandle } from 'node:fs/promises'
import path from 'node:path'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  planPubmedMetadataUpdate,
  pubmedMetadataFields,
  validateLiteratureLanguage,
  type ExistingPubmedMetadataRow,
  type PubmedMetadataDatabasePatch,
  type PubmedMetadataField,
  type PubmedMetadataUpdatePlan,
} from '@/features/literature/domain/pubmed-metadata'

import {
  assertKnownArguments,
  hasFlag,
  numberArgument,
  parseCliArguments,
  stringArgument,
  type ParsedCliArguments,
} from './lib/cli'
import {
  GOLD_SET_V1_BATCH_NAME,
  loadGoldSetV1DevelopmentScope,
  type GoldSetV1DevelopmentScope,
} from './lib/data-quality-scope'
import { createLiteratureReadClient, executeDatabaseCall } from './lib/database'
import {
  PubmedEfetchClient,
  type PubmedEfetchBatchResult,
  type PubmedEfetchResult,
} from './lib/pubmed-efetch-client'

const ARTICLE_SELECT = 'pmid,mesh_terms,author_keywords,publication_types,languages,updated_at'
const ARTICLE_PAGE_SIZE = 200
const DEFAULT_CACHE_DIRECTORY = 'local-data/literature/pubmed-efetch-cache'
const DEFAULT_REPORT_DIRECTORY = 'local-data/literature/data-quality/pubmed-metadata'
const DEFAULT_NCBI_TOOL = 'interventional-pulm-literature-data-quality'
const ALLOWED_PATCH_FIELDS = new Set([
  'mesh_terms',
  'author_keywords',
  'publication_types',
  'languages',
])

const HELP = `
Backfill PubMed metadata for the fixed gold-set-v1 development scope.

Usage:
  npm run literature:backfill-pubmed-metadata
  npm run literature:backfill-pubmed-metadata -- --refresh
  npm run literature:backfill-pubmed-metadata -- --commit --target local

Safety:
  Dry-run is the default. Commit mode is local-only and must run from the primary checkout.
  This command reads only gold-set-v1 development membership; it never reads reviews or test rows.

Options:
  --dry-run             Explicitly select dry-run mode.
  --commit              Apply sparse, optimistic-guarded local updates.
  --target local        Only local is accepted (default local).
  --refresh             Bypass valid EFetch cache reads.
  --batch-size <n>      EFetch batch size, 1-200 (default 200).
  --cache-dir <path>    Default local-data/literature/pubmed-efetch-cache.
  --report <path>       Explicit report path; otherwise a timestamped ignored local report.
  --help                Show this help.
`.trim()

export interface PubmedBackfillCliOptions {
  batchSize: number
  cacheDirectory: string
  commit: boolean
  explicitDryRun: boolean
  refresh: boolean
  reportPath: string | null
  target: string
}

export interface PubmedBackfillSafetyInput {
  commit: boolean
  explicitDryRun: boolean
  gitCommonDirectory?: string
  gitDirectory?: string
  target: string
}

export interface PubmedBackfillInvalidLanguageRow {
  invalidValues: string[]
  pmid: string
  validValues: string[]
}

export interface PubmedBackfillInvalidSourceLanguageRow {
  invalidValues: string[]
  pmid: string
}

export interface PubmedBackfillRowReport {
  conflicts: PubmedMetadataField[]
  decisions: PubmedMetadataUpdatePlan['decisions']
  patch: PubmedMetadataDatabasePatch
  pmid: string
  updatedAt: string
}

export interface PubmedBackfillReport {
  formatVersion: '1.0.0'
  generatedAt: string
  mode: 'commit' | 'dry-run'
  scope: GoldSetV1DevelopmentScope
  counts: {
    appliedRows: number
    conflicts: number
    fetchedRecords: number
    invalidLanguageRows: number
    invalidSourceLanguageRows: number
    missingArticleRows: number
    optimisticGuardConflicts: number
    proposedFieldUpdates: Record<PubmedMetadataField, number>
    proposedRows: number
    scopePmids: number
    unavailablePmids: number
    blankBefore: Record<PubmedMetadataField, number>
  }
  invalidLanguageRows: PubmedBackfillInvalidLanguageRow[]
  invalidSourceLanguageRows: PubmedBackfillInvalidSourceLanguageRow[]
  hashes: {
    aggregateCacheSourceSha256: string
    candidateMetadataSha256: string
    currentMetadataSha256: string
    fetchedSourceMetadataSha256: string
  }
  commitJournalReference?: string
  missingArticlePmids: string[]
  optimisticGuardConflictPmids: string[]
  rows: PubmedBackfillRowReport[]
  sourceBatches: Array<{
    fromCache: boolean
    rawCacheReference: string
    requestedPmids: string[]
    retrievedAt: string
    sourceSha256: string
    unavailablePmids: string[]
  }>
  unavailablePmids: string[]
}

export type PubmedCommitJournalEntry =
  | {
      event: 'commit_started'
      generatedAt: string
      plannedRows: number
      recordedAt: string
      reportSha256: string
    }
  | {
      event: 'row_attempt'
      expectedUpdatedAt: string
      patch: PubmedMetadataDatabasePatch
      pmid: string
      recordedAt: string
      sequence: number
    }
  | {
      event: 'row_applied' | 'row_optimistic_conflict'
      pmid: string
      recordedAt: string
      sequence: number
    }
  | {
      error: string
      event: 'row_error'
      outcome: 'indeterminate'
      pmid: string
      recordedAt: string
      sequence: number
    }
  | {
      appliedRows: number
      event: 'commit_completed' | 'commit_failed'
      error?: string
      optimisticGuardConflictPmids: string[]
      recordedAt: string
    }

export interface PubmedCommitJournal {
  append(entry: PubmedCommitJournalEntry): Promise<void>
  close(): Promise<void>
}

export interface PubmedBackfillCommitOutcome {
  appliedRows: number
  journalPath: string
  optimisticGuardConflictPmids: string[]
  status: 'completed'
}

export interface PubmedBackfillDependencies {
  client: SupabaseClient
  createCommitJournal?: (journalPath: string) => Promise<PubmedCommitJournal>
  efetchClient: Pick<PubmedEfetchClient, 'fetchPmids'>
  loadScope?: (client: SupabaseClient) => Promise<GoldSetV1DevelopmentScope>
  now?: () => number
  writeReport?: (report: PubmedBackfillReport, reportPath: string) => Promise<void>
}

export function parsePubmedBackfillArguments(
  arguments_: ParsedCliArguments,
): PubmedBackfillCliOptions {
  assertKnownArguments(arguments_, [
    'dry-run',
    'commit',
    'target',
    'refresh',
    'batch-size',
    'cache-dir',
    'report',
    'help',
  ])
  const batchSize = numberArgument(arguments_, 'batch-size', 200)
  if (!batchSize || batchSize > 200) throw new Error('--batch-size must be between 1 and 200.')
  return {
    batchSize,
    cacheDirectory: stringArgument(arguments_, 'cache-dir', DEFAULT_CACHE_DIRECTORY),
    commit: hasFlag(arguments_, 'commit'),
    explicitDryRun: hasFlag(arguments_, 'dry-run'),
    refresh: hasFlag(arguments_, 'refresh'),
    reportPath: stringArgument(arguments_, 'report') ?? null,
    target: stringArgument(arguments_, 'target', 'local'),
  }
}

export function validatePubmedBackfillInvocation({
  commit,
  explicitDryRun,
  gitCommonDirectory,
  gitDirectory,
  target,
}: PubmedBackfillSafetyInput): void {
  if (target !== 'local') {
    throw new Error('PubMed metadata backfill is local-only; --target must be local.')
  }
  if (commit && explicitDryRun) throw new Error('Choose either --dry-run or --commit, not both.')
  if (!commit) return
  if (!gitDirectory || !gitCommonDirectory) {
    throw new Error('Commit mode requires primary-checkout verification.')
  }
  if (path.resolve(gitDirectory) !== path.resolve(gitCommonDirectory)) {
    throw new Error(
      'PubMed metadata commit mode is blocked in an agent worktree; run it from the primary checkout.',
    )
  }
}

function currentGitDirectories() {
  return {
    gitDirectory: execFileSync('git', ['rev-parse', '--absolute-git-dir'], {
      encoding: 'utf8',
    }).trim(),
    gitCommonDirectory: execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { encoding: 'utf8' },
    ).trim(),
  }
}

export function assertSparsePubmedMetadataPatch(patch: object): void {
  for (const key of Object.keys(patch)) {
    if (!ALLOWED_PATCH_FIELDS.has(key)) {
      throw new Error(`Refusing non-PubMed-metadata update field "${key}".`)
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error
}

function isWithinDirectory(directory: string, candidate: string): boolean {
  const relative = path.relative(directory, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export async function resolveSafeLocalDataOutputPath(
  requestedPath: string,
  repositoryRoot = process.cwd(),
): Promise<string> {
  const root = path.resolve(repositoryRoot)
  const localDataRoot = path.resolve(root, 'local-data')
  const candidate = path.resolve(root, requestedPath)
  if (candidate === localDataRoot || !isWithinDirectory(localDataRoot, candidate)) {
    throw new Error(
      'PubMed cache/report paths must remain below the repository local-data directory.',
    )
  }
  const relativeParts = path.relative(localDataRoot, candidate).split(path.sep).filter(Boolean)
  if (relativeParts[0]?.toLocaleLowerCase('en-US') === 'inputs') {
    throw new Error(
      'PubMed cache/report paths must never use the read-only local-data/inputs tree.',
    )
  }

  let current = localDataRoot
  for (const part of ['', ...relativeParts]) {
    if (part) current = path.join(current, part)
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new Error(`Refusing PubMed output path through symlink ${current}.`)
      }
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') break
      throw error
    }
  }
  return candidate
}

function deterministicSha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

async function loadScopedArticleRows(client: SupabaseClient, pmids: string[]) {
  const rows: ExistingPubmedMetadataRow[] = []
  for (let start = 0; start < pmids.length; start += ARTICLE_PAGE_SIZE) {
    const page = await executeDatabaseCall<ExistingPubmedMetadataRow[]>(
      `PubMed metadata article page ${start / ARTICLE_PAGE_SIZE + 1}`,
      () =>
        client
          .from('literature_articles')
          .select(ARTICLE_SELECT)
          .in('pmid', pmids.slice(start, start + ARTICLE_PAGE_SIZE))
          .order('pmid', { ascending: true }),
    )
    rows.push(...(page ?? []))
  }
  const byPmid = new Map<string, ExistingPubmedMetadataRow>()
  for (const row of rows) {
    if (byPmid.has(row.pmid)) throw new Error(`Duplicate literature article PMID ${row.pmid}.`)
    byPmid.set(row.pmid, row)
  }
  return byPmid
}

function hasNonblankArrayValue(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => typeof item === 'string' && item.trim())
}

function invalidLanguageRows(
  articles: Map<string, ExistingPubmedMetadataRow>,
): PubmedBackfillInvalidLanguageRow[] {
  const result: PubmedBackfillInvalidLanguageRow[] = []
  for (const row of articles.values()) {
    if (!Array.isArray(row.languages)) continue
    const invalidValues: string[] = []
    const validValues: string[] = []
    for (const value of row.languages) {
      const validation = validateLiteratureLanguage(value)
      if (validation.valid && validation.normalized) validValues.push(validation.normalized)
      else if (typeof value === 'string' && value.trim()) invalidValues.push(value.trim())
    }
    if (invalidValues.length > 0) result.push({ pmid: row.pmid, invalidValues, validValues })
  }
  return result.sort((left, right) => Number(left.pmid) - Number(right.pmid))
}

function blankCounts(articles: Map<string, ExistingPubmedMetadataRow>) {
  const counts: Record<PubmedMetadataField, number> = {
    meshTerms: 0,
    authorKeywords: 0,
    publicationTypes: 0,
    languages: 0,
  }
  for (const row of articles.values()) {
    if (!hasNonblankArrayValue(row.mesh_terms)) counts.meshTerms += 1
    if (!hasNonblankArrayValue(row.author_keywords)) counts.authorKeywords += 1
    if (!hasNonblankArrayValue(row.publication_types)) counts.publicationTypes += 1
    if (!hasNonblankArrayValue(row.languages)) counts.languages += 1
  }
  return counts
}

function reportSourceBatch(batch: PubmedEfetchBatchResult) {
  return {
    fromCache: batch.fromCache,
    rawCacheReference: batch.rawCacheReference,
    requestedPmids: batch.requestedPmids,
    retrievedAt: batch.retrievedAt,
    sourceSha256: batch.sourceSha256,
    unavailablePmids: batch.unavailablePmids,
  }
}

function reportPathForRun(generatedAt: string, explicitPath: string | null): string {
  if (explicitPath) return path.resolve(explicitPath)
  return path.resolve(
    DEFAULT_REPORT_DIRECTORY,
    `pubmed-metadata-backfill-${generatedAt.replaceAll(':', '-')}.json`,
  )
}

async function syncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

function serializePubmedBackfillReport(report: PubmedBackfillReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}

function pubmedBackfillReportSha256(report: PubmedBackfillReport): string {
  return createHash('sha256').update(serializePubmedBackfillReport(report)).digest('hex')
}

export async function writePubmedBackfillReportAtomic(
  report: PubmedBackfillReport,
  reportPath: string,
  repositoryRoot = process.cwd(),
) {
  const safeReportPath = await resolveSafeLocalDataOutputPath(reportPath, repositoryRoot)
  const reportDirectory = path.dirname(safeReportPath)
  await mkdir(reportDirectory, { recursive: true })
  const temporaryPath = `${safeReportPath}.${process.pid}.tmp`
  let temporaryHandle: FileHandle | null = null
  try {
    temporaryHandle = await open(temporaryPath, 'wx', 0o600)
    await temporaryHandle.writeFile(serializePubmedBackfillReport(report), 'utf8')
    await temporaryHandle.sync()
    await temporaryHandle.close()
    temporaryHandle = null
    await link(temporaryPath, safeReportPath)
    await syncDirectory(reportDirectory)
  } catch (error) {
    if (isNodeError(error) && error.code === 'EEXIST') {
      throw new Error(`Refusing to overwrite existing PubMed metadata report ${safeReportPath}.`)
    }
    throw error
  } finally {
    await temporaryHandle?.close().catch(() => undefined)
    await unlink(temporaryPath).catch((error: unknown) => {
      if (!isNodeError(error) || error.code !== 'ENOENT') throw error
    })
  }
}

export async function createPubmedCommitJournal(
  journalPath: string,
  repositoryRoot = process.cwd(),
): Promise<PubmedCommitJournal> {
  const safeJournalPath = await resolveSafeLocalDataOutputPath(journalPath, repositoryRoot)
  const journalDirectory = path.dirname(safeJournalPath)
  await mkdir(journalDirectory, { recursive: true })
  let handle: FileHandle
  try {
    handle = await open(safeJournalPath, 'ax', 0o600)
  } catch (error) {
    if (isNodeError(error) && error.code === 'EEXIST') {
      throw new Error(`Refusing to overwrite existing PubMed commit journal ${safeJournalPath}.`)
    }
    throw error
  }
  try {
    await syncDirectory(journalDirectory)
  } catch (error) {
    await handle.close().catch(() => undefined)
    throw error
  }
  let closed = false
  return {
    async append(entry) {
      if (closed) throw new Error('Cannot append to a closed PubMed commit journal.')
      await handle.appendFile(`${JSON.stringify(entry)}\n`, 'utf8')
      await handle.sync()
    },
    async close() {
      if (closed) return
      closed = true
      await handle.close()
    },
  }
}

async function optimisticSparseUpdate(
  client: SupabaseClient,
  plan: PubmedMetadataUpdatePlan,
): Promise<boolean> {
  assertSparsePubmedMetadataPatch(plan.patch)
  const rows = await executeDatabaseCall<Array<{ pmid: string }>>(
    `Optimistic PubMed metadata update for PMID ${plan.pmid}`,
    () =>
      client
        .from('literature_articles')
        .update(plan.patch)
        .eq('pmid', plan.pmid)
        .eq('updated_at', plan.updatedAt)
        .select('pmid'),
  )
  return rows?.length === 1 && rows[0]?.pmid === plan.pmid
}

function buildPlans(
  scope: GoldSetV1DevelopmentScope,
  articles: Map<string, ExistingPubmedMetadataRow>,
  fetched: PubmedEfetchResult,
) {
  const fetchedByPmid = new Map(fetched.records.map((record) => [record.pmid, record]))
  const plans: PubmedMetadataUpdatePlan[] = []
  for (const pmid of scope.pmids) {
    const current = articles.get(pmid)
    const record = fetchedByPmid.get(pmid)
    if (current && record) plans.push(planPubmedMetadataUpdate(current, record))
  }
  return plans
}

function metadataDatabaseState(
  scope: GoldSetV1DevelopmentScope,
  articles: Map<string, ExistingPubmedMetadataRow>,
  plans: PubmedMetadataUpdatePlan[] = [],
) {
  const plansByPmid = new Map(plans.map((plan) => [plan.pmid, plan]))
  return scope.pmids.map((pmid) => {
    const row = articles.get(pmid)
    if (!row) return { pmid, missing: true }
    const patch = plansByPmid.get(pmid)?.patch ?? {}
    return {
      pmid,
      mesh_terms: patch.mesh_terms ?? row.mesh_terms,
      author_keywords: patch.author_keywords ?? row.author_keywords,
      publication_types: patch.publication_types ?? row.publication_types,
      languages: patch.languages ?? row.languages,
      updated_at: row.updated_at,
    }
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function runPubmedMetadataBackfill(
  options: PubmedBackfillCliOptions,
  dependencies: PubmedBackfillDependencies,
): Promise<{
  commitOutcome: PubmedBackfillCommitOutcome | null
  report: PubmedBackfillReport
  reportPath: string
}> {
  const now = dependencies.now ?? Date.now
  const generatedAt = new Date(now()).toISOString()
  const loadScope = dependencies.loadScope ?? loadGoldSetV1DevelopmentScope
  const scope = await loadScope(dependencies.client)
  if (
    scope.batchName !== GOLD_SET_V1_BATCH_NAME ||
    scope.datasetSplit !== 'development' ||
    scope.pmids.length === 0
  ) {
    throw new Error('Refusing PubMed backfill outside the fixed gold-set-v1 development scope.')
  }

  const articles = await loadScopedArticleRows(dependencies.client, scope.pmids)
  const missingArticlePmids = scope.pmids.filter((pmid) => !articles.has(pmid))
  const invalidLanguages = invalidLanguageRows(articles)
  const fetched = await dependencies.efetchClient.fetchPmids(scope.pmids, {
    refresh: options.refresh,
  })
  const plans = buildPlans(scope, articles, fetched)
  const invalidSourceLanguageRows = fetched.records
    .filter((record) => record.invalidLanguages.length > 0)
    .map((record) => ({ pmid: record.pmid, invalidValues: record.invalidLanguages }))
    .sort((left, right) => Number(left.pmid) - Number(right.pmid))
  const rows = plans.map((plan) => ({
    pmid: plan.pmid,
    updatedAt: plan.updatedAt,
    patch: plan.patch,
    conflicts: plan.conflicts,
    decisions: plan.decisions,
  }))
  const proposedPlans = plans.filter((plan) => Object.keys(plan.patch).length > 0)
  const proposedFieldUpdates = Object.fromEntries(
    pubmedMetadataFields.map((field) => [
      field,
      plans.filter((plan) =>
        ['fill_empty', 'replace_invalid'].includes(plan.decisions[field].status),
      ).length,
    ]),
  ) as Record<PubmedMetadataField, number>
  const report: PubmedBackfillReport = {
    formatVersion: '1.0.0',
    generatedAt,
    mode: options.commit ? 'commit' : 'dry-run',
    scope,
    counts: {
      scopePmids: scope.pmids.length,
      fetchedRecords: fetched.records.length,
      unavailablePmids: fetched.unavailablePmids.length,
      missingArticleRows: missingArticlePmids.length,
      invalidLanguageRows: invalidLanguages.length,
      invalidSourceLanguageRows: invalidSourceLanguageRows.length,
      blankBefore: blankCounts(articles),
      proposedRows: proposedPlans.length,
      proposedFieldUpdates,
      conflicts: plans.reduce((count, plan) => count + plan.conflicts.length, 0),
      appliedRows: 0,
      optimisticGuardConflicts: 0,
    },
    invalidLanguageRows: invalidLanguages,
    invalidSourceLanguageRows,
    hashes: {
      currentMetadataSha256: deterministicSha256(metadataDatabaseState(scope, articles)),
      candidateMetadataSha256: deterministicSha256(metadataDatabaseState(scope, articles, plans)),
      fetchedSourceMetadataSha256: deterministicSha256(
        [...fetched.records]
          .sort((left, right) => Number(left.pmid) - Number(right.pmid))
          .map((record) => ({
            pmid: record.pmid,
            mesh_terms: record.meshTerms,
            author_keywords: record.authorKeywords,
            publication_types: record.publicationTypes,
            languages: record.languages,
            invalid_languages: record.invalidLanguages,
          })),
      ),
      aggregateCacheSourceSha256: deterministicSha256(
        fetched.batches.map((batch) => ({
          requested_pmids: batch.requestedPmids,
          source_sha256: batch.sourceSha256,
        })),
      ),
    },
    missingArticlePmids,
    unavailablePmids: fetched.unavailablePmids,
    optimisticGuardConflictPmids: [],
    sourceBatches: fetched.batches.map(reportSourceBatch),
    rows,
  }
  const reportPath = reportPathForRun(generatedAt, options.reportPath)
  const commitJournalPath = `${reportPath}.commit-journal.jsonl`
  if (options.commit) report.commitJournalReference = path.basename(commitJournalPath)
  await (dependencies.writeReport ?? writePubmedBackfillReportAtomic)(report, reportPath)
  if (!options.commit) return { report, reportPath, commitOutcome: null }

  const createCommitJournal = dependencies.createCommitJournal ?? createPubmedCommitJournal
  const journal = await createCommitJournal(commitJournalPath)
  const optimisticGuardConflictPmids: string[] = []
  let appliedRows = 0
  const recordedAt = () => new Date(now()).toISOString()
  const appendBestEffort = async (entry: PubmedCommitJournalEntry) => {
    await journal.append(entry).catch(() => undefined)
  }

  try {
    await journal.append({
      event: 'commit_started',
      generatedAt,
      plannedRows: proposedPlans.length,
      recordedAt: recordedAt(),
      reportSha256: pubmedBackfillReportSha256(report),
    })
    for (const [index, plan] of proposedPlans.entries()) {
      const sequence = index + 1
      await journal.append({
        event: 'row_attempt',
        sequence,
        pmid: plan.pmid,
        expectedUpdatedAt: plan.updatedAt,
        patch: plan.patch,
        recordedAt: recordedAt(),
      })
      let applied: boolean
      try {
        applied = await optimisticSparseUpdate(dependencies.client, plan)
      } catch (error) {
        await appendBestEffort({
          event: 'row_error',
          sequence,
          pmid: plan.pmid,
          outcome: 'indeterminate',
          error: errorMessage(error),
          recordedAt: recordedAt(),
        })
        throw error
      }
      if (applied) {
        appliedRows += 1
        await journal.append({
          event: 'row_applied',
          sequence,
          pmid: plan.pmid,
          recordedAt: recordedAt(),
        })
      } else {
        optimisticGuardConflictPmids.push(plan.pmid)
        await journal.append({
          event: 'row_optimistic_conflict',
          sequence,
          pmid: plan.pmid,
          recordedAt: recordedAt(),
        })
      }
    }
    await journal.append({
      event: 'commit_completed',
      appliedRows,
      optimisticGuardConflictPmids,
      recordedAt: recordedAt(),
    })
    return {
      report,
      reportPath,
      commitOutcome: {
        status: 'completed',
        journalPath: commitJournalPath,
        appliedRows,
        optimisticGuardConflictPmids,
      },
    }
  } catch (error) {
    await appendBestEffort({
      event: 'commit_failed',
      appliedRows,
      optimisticGuardConflictPmids,
      error: errorMessage(error),
      recordedAt: recordedAt(),
    })
    throw error
  } finally {
    await journal.close()
  }
}

function positiveEnvironmentNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be positive.`)
  return parsed
}

async function main() {
  const arguments_ = parseCliArguments(process.argv.slice(2))
  const options = parsePubmedBackfillArguments(arguments_)
  if (hasFlag(arguments_, 'help')) {
    console.log(HELP)
    return
  }
  const gitDirectories = options.commit ? currentGitDirectories() : {}
  validatePubmedBackfillInvocation({
    commit: options.commit,
    explicitDryRun: options.explicitDryRun,
    target: options.target,
    ...gitDirectories,
  })
  options.cacheDirectory = await resolveSafeLocalDataOutputPath(options.cacheDirectory)
  await resolveSafeLocalDataOutputPath(options.reportPath ?? DEFAULT_REPORT_DIRECTORY)
  if (options.reportPath) {
    options.reportPath = await resolveSafeLocalDataOutputPath(options.reportPath)
  }

  const email = process.env.NCBI_EMAIL?.trim()
  if (!email) throw new Error('NCBI_EMAIL is required for PubMed EFetch contact identification.')
  const client = createLiteratureReadClient(arguments_)
  const efetchClient = new PubmedEfetchClient({
    apiKey: process.env.NCBI_API_KEY,
    batchSize: options.batchSize,
    cacheDir: options.cacheDirectory,
    email,
    tool: process.env.NCBI_TOOL?.trim() || DEFAULT_NCBI_TOOL,
    requestsPerSecond: positiveEnvironmentNumber('NCBI_REQUESTS_PER_SECOND', 3),
    maxAttempts: Math.trunc(positiveEnvironmentNumber('NCBI_MAX_ATTEMPTS', 5)),
    timeoutMs: Math.trunc(positiveEnvironmentNumber('NCBI_TIMEOUT_MS', 30_000)),
  })
  const { commitOutcome, report, reportPath } = await runPubmedMetadataBackfill(options, {
    client,
    efetchClient,
  })
  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        report: reportPath,
        scope_pmids: report.counts.scopePmids,
        proposed_rows: report.counts.proposedRows,
        conflicts: report.counts.conflicts,
        unavailable_pmids: report.counts.unavailablePmids,
        applied_rows: commitOutcome?.appliedRows ?? 0,
        optimistic_guard_conflicts: commitOutcome?.optimisticGuardConflictPmids.length ?? 0,
        commit_journal: commitOutcome?.journalPath ?? null,
      },
      null,
      2,
    ),
  )
}

if (process.argv[1]?.endsWith('backfill-pubmed-metadata.ts')) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
