import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildCuratedCollectionAuditReport,
  EXPERT_CURATED_IP_V1_COLLECTION_ID,
  explicitIdentifierFromExternalUrl,
  isLockedHeldOutTestItem,
  serializeCuratedCollectionExternalCsv,
  serializeCuratedCollectionJson,
  serializeCuratedCollectionPmidCsv,
  validateCuratedCollectionInputs,
  type CuratedCollectionArticleSnapshot,
  type CuratedCollectionBatchItemSnapshot,
  type CuratedCollectionBatchSnapshot,
  type CuratedCollectionDatabaseSnapshot,
  type CuratedCollectionDatabaseTarget,
  type CuratedCollectionImportBatchSnapshot,
  type CuratedCollectionPhysicianLabel,
  type CuratedCollectionReviewSnapshot,
  type CuratedCollectionSourceSnapshot,
  type CuratedCollectionTopicDefinitionSnapshot,
  type CuratedCollectionTopicSnapshot,
} from '@/features/literature/curated-collection/audit'

import { assertKnownArguments, hasFlag, parseCliArguments, stringArgument } from './lib/cli'
import { createLiteratureReadClient, executeDatabaseCall } from './lib/database'
import { portablePath } from './lib/files'

const DEFAULT_COLLECTION_DIRECTORY = `local-data/literature/${EXPERT_CURATED_IP_V1_COLLECTION_ID}`
const DATABASE_PAGE_SIZE = 1_000
const FILTER_CHUNK_SIZE = 100

const HELP = `
Audit the frozen expert-curated IP collection against literature tables without database writes.

Usage:
  npm run literature:audit-curated-collection
  npm run literature:audit-curated-collection -- --target local

Options:
  --collection-id <id>          Must be expert-curated-ip-v1.
  --pmids <path>                Canonical PMID text file.
  --external-resources <path>   Canonical external-resource text file.
  --source-audit <path>         Frozen extraction audit JSON.
  --output-directory <path>     Report directory under the repository's ignored local-data tree.
  --target <value>              local (default) or remote read target.
  --help                        Show this help.

The command contains no commit/write mode and issues only table SELECT requests. It does not fetch
external URLs. Locked gold-standard test review rows are excluded before the review query.
Output paths that escape local-data, traverse symlinks, or collide with an input are rejected.
`.trim()

interface ArticleRow {
  pmid: string
  doi: string | null
  title: string
  abstract: string | null
  journal_id: string | null
  journal_title: string | null
  journal_abbreviation: string | null
  publication_year: number | null
  relevance_state: string
  visibility_state: string
  is_landmark: boolean
}

interface ExactArticleRow {
  pmid: string
  doi: string | null
}

interface SourceRow {
  pmid: string
  batch_id: string
  source_kind: string
  source_id: string | null
  query_id: string | null
  source_filename: string
  first_seen_at: string
}

interface ImportBatchRow {
  id: string
  source_filename: string
  source_file_sha256: string
  manifest_version: string
  query_registry_version: string | null
  source_kind: string
  source_id: string | null
  query_id: string | null
  date_from: string | null
  date_to: string | null
  status: string
  records_read: number
  unique_pmids: number
  inserted_count: number
  updated_count: number
  duplicate_count: number
  error_count: number
  record_limit: number | null
  started_at: string
  completed_at: string | null
  report: Record<string, unknown> | null
  created_by: string | null
}

interface TopicAssignmentRow {
  pmid: string
  topic_id: string
  confidence: number | string | null
  assignment_source: string
  assignment_state: string
  model_or_rule_version: string
  evidence: Record<string, unknown> | null
}

interface TopicDefinitionRow {
  id: string
  label_en: string
}

interface BatchRow {
  id: string
  name: string
  kind: string
  status: string
  test_unlocked_at: string | null
}

interface BatchItemRow {
  id: string
  batch_id: string
  pmid: string
  dataset_split: string
  review_status: string
  current_review_id: string | null
}

interface ReviewRow {
  id: string
  item_id: string
  revision: number
  lifecycle_state?: 'effective' | 'withdrawn'
  relevance_label: CuratedCollectionPhysicianLabel
  reviewer_confidence: string
  is_blinded: boolean
  completed_at: string
}

interface DatabaseResult<T> {
  data: T | null
  error: { code?: string; message: string } | null
}

function chunks<T>(values: readonly T[], size = FILTER_CHUNK_SIZE) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function sha256Bytes(value: Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

async function lstatIfPresent(path: string) {
  try {
    return await lstat(path)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function statIfPresent(path: string) {
  try {
    return await stat(path)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

function isWithinDirectory(root: string, candidate: string) {
  const fromRoot = relative(root, candidate)
  return (
    fromRoot === '' ||
    (!isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`))
  )
}

export interface CuratedCollectionAuditArtifactPaths {
  outputDirectory: string
  json: string
  pmidCsv: string
  externalCsv: string
}

export async function resolveCuratedCollectionAuditArtifactPaths(options: {
  outputDirectory: string
  inputPaths: readonly string[]
  workspaceRoot?: string
}): Promise<CuratedCollectionAuditArtifactPaths> {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd())
  const localDataRoot = resolve(workspaceRoot, 'local-data')
  const outputDirectory = resolve(options.outputDirectory)
  if (!isWithinDirectory(localDataRoot, outputDirectory)) {
    throw new Error(
      'The audit output directory must remain under the repository local-data directory.',
    )
  }

  const localDataMetadata = await lstatIfPresent(localDataRoot)
  if (!localDataMetadata?.isDirectory() || localDataMetadata.isSymbolicLink()) {
    throw new Error('The repository local-data directory must exist as a non-symlink directory.')
  }
  const relativeOutput = relative(localDataRoot, outputDirectory)
  let current = localDataRoot
  for (const segment of relativeOutput.split(sep).filter(Boolean)) {
    current = resolve(current, segment)
    const metadata = await lstatIfPresent(current)
    if (!metadata) break
    if (metadata.isSymbolicLink()) {
      throw new Error(`The audit output path must not traverse a symbolic link: ${current}`)
    }
    if (!metadata.isDirectory()) {
      throw new Error(`The audit output path contains a non-directory component: ${current}`)
    }
  }

  const artifacts: CuratedCollectionAuditArtifactPaths = {
    outputDirectory,
    json: resolve(
      outputDirectory,
      `${EXPERT_CURATED_IP_V1_COLLECTION_ID}-curated-collection-audit.json`,
    ),
    pmidCsv: resolve(outputDirectory, `${EXPERT_CURATED_IP_V1_COLLECTION_ID}-pmid-audit.csv`),
    externalCsv: resolve(
      outputDirectory,
      `${EXPERT_CURATED_IP_V1_COLLECTION_ID}-external-resources-audit.csv`,
    ),
  }
  const inputPaths = options.inputPaths.map((path) => resolve(path))
  for (const artifactPath of [artifacts.json, artifacts.pmidCsv, artifacts.externalCsv]) {
    if (inputPaths.includes(artifactPath)) {
      throw new Error(`An audit output path collides with an input path: ${artifactPath}`)
    }
    const artifactMetadata = await lstatIfPresent(artifactPath)
    if (artifactMetadata?.isSymbolicLink()) {
      throw new Error(`An audit output file must not be a symbolic link: ${artifactPath}`)
    }
    if (artifactMetadata && !artifactMetadata.isFile()) {
      throw new Error(`An audit output path must be a regular file: ${artifactPath}`)
    }
    if (artifactMetadata) {
      for (const inputPath of inputPaths) {
        const inputMetadata = await statIfPresent(inputPath)
        if (
          inputMetadata &&
          inputMetadata.dev === artifactMetadata.dev &&
          inputMetadata.ino === artifactMetadata.ino
        ) {
          throw new Error(`An audit output file aliases an input file: ${artifactPath}`)
        }
      }
    }
  }
  return artifacts
}

async function collectPaged<T, Filter>(
  label: string,
  filters: readonly Filter[],
  operation: (filter: Filter, start: number, end: number) => PromiseLike<DatabaseResult<T[]>>,
) {
  const rows: T[] = []
  for (const filter of filters) {
    for (let start = 0; ; start += DATABASE_PAGE_SIZE) {
      const page =
        (await executeDatabaseCall<T[]>(label, () =>
          operation(filter, start, start + DATABASE_PAGE_SIZE - 1),
        )) ?? []
      rows.push(...page)
      if (page.length < DATABASE_PAGE_SIZE) break
    }
  }
  return rows
}

function articleSnapshot(row: ArticleRow): CuratedCollectionArticleSnapshot {
  return {
    pmid: row.pmid,
    doi: row.doi,
    title: row.title,
    abstract: row.abstract,
    journalId: row.journal_id,
    journalTitle: row.journal_title,
    journalAbbreviation: row.journal_abbreviation,
    publicationYear: row.publication_year,
    relevanceState: row.relevance_state,
    visibilityState: row.visibility_state,
    isLandmark: row.is_landmark,
  }
}

async function fetchArticles(
  client: ReturnType<typeof createLiteratureReadClient>,
  pmids: readonly string[],
) {
  const rows = await collectPaged<ArticleRow, string[]>(
    'Curated article page',
    chunks(pmids),
    (pmidChunk, start, end) =>
      client
        .from('literature_articles')
        .select(
          'pmid,doi,title,abstract,journal_id,journal_title,journal_abbreviation,publication_year,relevance_state,visibility_state,is_landmark',
        )
        .in('pmid', pmidChunk)
        .order('pmid', { ascending: true })
        .range(start, end),
  )
  return rows.map(articleSnapshot)
}

async function fetchSources(
  client: ReturnType<typeof createLiteratureReadClient>,
  pmids: readonly string[],
) {
  const rows = await collectPaged<SourceRow, string[]>(
    'Curated source-provenance page',
    chunks(pmids),
    (pmidChunk, start, end) =>
      client
        .from('literature_article_sources')
        .select('pmid,batch_id,source_kind,source_id,query_id,source_filename,first_seen_at')
        .in('pmid', pmidChunk)
        .order('pmid', { ascending: true })
        .order('batch_id', { ascending: true })
        .range(start, end),
  )
  return rows.map<CuratedCollectionSourceSnapshot>((row) => ({
    pmid: row.pmid,
    batchId: row.batch_id,
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    queryId: row.query_id,
    sourceFilename: row.source_filename,
    firstSeenAt: row.first_seen_at,
  }))
}

async function fetchImportBatches(
  client: ReturnType<typeof createLiteratureReadClient>,
  batchIds: readonly string[],
) {
  const rows = await collectPaged<ImportBatchRow, string[]>(
    'Curated import-batch page',
    chunks(batchIds),
    (batchIdChunk, start, end) =>
      client
        .from('literature_import_batches')
        .select(
          'id,source_filename,source_file_sha256,manifest_version,query_registry_version,source_kind,source_id,query_id,date_from,date_to,status,records_read,unique_pmids,inserted_count,updated_count,duplicate_count,error_count,record_limit,started_at,completed_at,report,created_by',
        )
        .in('id', batchIdChunk)
        .order('id', { ascending: true })
        .range(start, end),
  )
  return rows.map<CuratedCollectionImportBatchSnapshot>((row) => ({
    id: row.id,
    sourceFilename: row.source_filename,
    sourceFileSha256: row.source_file_sha256,
    manifestVersion: row.manifest_version,
    queryRegistryVersion: row.query_registry_version,
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    queryId: row.query_id,
    dateFrom: row.date_from,
    dateTo: row.date_to,
    status: row.status,
    recordsRead: row.records_read,
    uniquePmids: row.unique_pmids,
    insertedCount: row.inserted_count,
    updatedCount: row.updated_count,
    duplicateCount: row.duplicate_count,
    errorCount: row.error_count,
    recordLimit: row.record_limit,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    report: row.report,
    createdBy: row.created_by,
  }))
}

async function fetchTopicAssignments(
  client: ReturnType<typeof createLiteratureReadClient>,
  pmids: readonly string[],
) {
  const rows = await collectPaged<TopicAssignmentRow, string[]>(
    'Curated topic-assignment page',
    chunks(pmids),
    (pmidChunk, start, end) =>
      client
        .from('literature_article_topics')
        .select(
          'pmid,topic_id,confidence,assignment_source,assignment_state,model_or_rule_version,evidence',
        )
        .in('pmid', pmidChunk)
        .order('pmid', { ascending: true })
        .order('topic_id', { ascending: true })
        .order('assignment_source', { ascending: true })
        .order('model_or_rule_version', { ascending: true })
        .range(start, end),
  )
  return rows.map<CuratedCollectionTopicSnapshot>((row) => ({
    pmid: row.pmid,
    topicId: row.topic_id,
    confidence: row.confidence === null ? null : Number(row.confidence),
    assignmentSource: row.assignment_source,
    assignmentState: row.assignment_state,
    modelOrRuleVersion: row.model_or_rule_version,
    evidence: row.evidence,
  }))
}

async function fetchTopicDefinitions(
  client: ReturnType<typeof createLiteratureReadClient>,
  topicIds: readonly string[],
) {
  const rows = await collectPaged<TopicDefinitionRow, string[]>(
    'Curated topic-definition page',
    chunks(topicIds),
    (topicIdChunk, start, end) =>
      client
        .from('literature_topics')
        .select('id,label_en')
        .in('id', topicIdChunk)
        .order('id', { ascending: true })
        .range(start, end),
  )
  return rows.map<CuratedCollectionTopicDefinitionSnapshot>((row) => ({
    id: row.id,
    labelEn: row.label_en,
  }))
}

async function fetchBatchItems(
  client: ReturnType<typeof createLiteratureReadClient>,
  pmids: readonly string[],
) {
  const rows = await collectPaged<BatchItemRow, string[]>(
    'Curated gold-set item page',
    chunks(pmids),
    (pmidChunk, start, end) =>
      client
        .from('literature_gold_set_items')
        .select('id,batch_id,pmid,dataset_split,review_status,current_review_id')
        .in('pmid', pmidChunk)
        .order('pmid', { ascending: true })
        .order('batch_id', { ascending: true })
        .range(start, end),
  )
  return rows.map<CuratedCollectionBatchItemSnapshot>((row) => ({
    id: row.id,
    batchId: row.batch_id,
    pmid: row.pmid,
    datasetSplit: row.dataset_split,
    reviewStatus: row.review_status,
    currentReviewId: row.current_review_id,
  }))
}

async function fetchBatches(
  client: ReturnType<typeof createLiteratureReadClient>,
  batchIds: readonly string[],
) {
  const rows = await collectPaged<BatchRow, string[]>(
    'Curated gold-set batch page',
    chunks(batchIds),
    (batchIdChunk, start, end) =>
      client
        .from('literature_gold_set_batches')
        .select('id,name,kind,status,test_unlocked_at')
        .in('id', batchIdChunk)
        .order('id', { ascending: true })
        .range(start, end),
  )
  return rows.map<CuratedCollectionBatchSnapshot>((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    status: row.status,
    testUnlockedAt: row.test_unlocked_at,
  }))
}

async function fetchAccessibleReviews(
  client: ReturnType<typeof createLiteratureReadClient>,
  accessibleItemIds: readonly string[],
) {
  const fetch = (columns: string) =>
    collectPaged<ReviewRow, string[]>(
      'Curated accessible review page',
      chunks(accessibleItemIds),
      (itemIdChunk, start, end) =>
        client
          .from('literature_gold_set_reviews')
          .select(columns)
          .in('item_id', itemIdChunk)
          .order('item_id', { ascending: true })
          .order('revision', { ascending: true })
          .range(start, end) as unknown as PromiseLike<DatabaseResult<ReviewRow[]>>,
    )
  let rows: ReviewRow[]
  try {
    rows = await fetch(
      'id,item_id,revision,lifecycle_state,relevance_label,reviewer_confidence,is_blinded,completed_at',
    )
  } catch (error) {
    if (!String(error).includes('lifecycle_state')) throw error
    rows = await fetch(
      'id,item_id,revision,relevance_label,reviewer_confidence,is_blinded,completed_at',
    )
  }
  return rows.map<CuratedCollectionReviewSnapshot>((row) => ({
    id: row.id,
    itemId: row.item_id,
    revision: row.revision,
    lifecycleState: row.lifecycle_state ?? 'effective',
    relevanceLabel: row.relevance_label,
    reviewerConfidence: row.reviewer_confidence,
    isBlinded: row.is_blinded,
    completedAt: row.completed_at,
  }))
}

async function fetchExactIdentifierArticles(
  client: ReturnType<typeof createLiteratureReadClient>,
  externalResources: readonly string[],
  curatedArticles: readonly CuratedCollectionArticleSnapshot[],
) {
  const identifiers = externalResources
    .map(explicitIdentifierFromExternalUrl)
    .filter((value) => value !== null)
  const pmids = [
    ...new Set(identifiers.filter((value) => value.kind === 'pmid').map((value) => value.value)),
  ]
  const dois = [
    ...new Set(identifiers.filter((value) => value.kind === 'doi').map((value) => value.value)),
  ]
  const [pmidRows, doiRows] = await Promise.all([
    collectPaged<ExactArticleRow, string[]>(
      'External exact-PMID page',
      chunks(pmids),
      (pmidChunk, start, end) =>
        client
          .from('literature_articles')
          .select('pmid,doi')
          .in('pmid', pmidChunk)
          .order('pmid', { ascending: true })
          .range(start, end),
    ),
    collectPaged<ExactArticleRow, string[]>(
      'External exact-DOI page',
      chunks(dois),
      (doiChunk, start, end) =>
        client
          .from('literature_articles')
          .select('pmid,doi')
          .in('doi', doiChunk)
          .order('pmid', { ascending: true })
          .range(start, end),
    ),
  ])
  const byPmid = new Map<string, ExactArticleRow>()
  for (const article of [...curatedArticles, ...pmidRows, ...doiRows]) {
    byPmid.set(article.pmid, { pmid: article.pmid, doi: article.doi })
  }
  return [...byPmid.values()].sort((left, right) => {
    if (left.pmid < right.pmid) return -1
    if (left.pmid > right.pmid) return 1
    return 0
  })
}

async function fetchDatabaseSnapshot(
  client: ReturnType<typeof createLiteratureReadClient>,
  pmids: readonly string[],
  externalResources: readonly string[],
): Promise<CuratedCollectionDatabaseSnapshot> {
  const [articles, sources, topicAssignments, batchItems] = await Promise.all([
    fetchArticles(client, pmids),
    fetchSources(client, pmids),
    fetchTopicAssignments(client, pmids),
    fetchBatchItems(client, pmids),
  ])
  const [importBatches, topicDefinitions, batches, exactIdentifierArticles] = await Promise.all([
    fetchImportBatches(client, [...new Set(sources.map((source) => source.batchId))]),
    fetchTopicDefinitions(client, [
      ...new Set(topicAssignments.map((assignment) => assignment.topicId)),
    ]),
    fetchBatches(client, [...new Set(batchItems.map((item) => item.batchId))]),
    fetchExactIdentifierArticles(client, externalResources, articles),
  ])
  const batchById = new Map(batches.map((batch) => [batch.id, batch]))
  for (const item of batchItems) {
    if (!batchById.has(item.batchId)) {
      throw new Error(`Gold-set item ${item.id} references an unavailable batch.`)
    }
  }
  const accessibleItemIds = batchItems
    .filter((item) => !isLockedHeldOutTestItem(item, batchById.get(item.batchId)!))
    .map((item) => item.id)
  const reviews = await fetchAccessibleReviews(client, accessibleItemIds)
  return {
    articles,
    exactIdentifierArticles,
    sources,
    importBatches,
    topicAssignments,
    topicDefinitions,
    batches,
    batchItems,
    reviews,
  }
}

async function main() {
  const arguments_ = parseCliArguments(process.argv.slice(2))
  assertKnownArguments(arguments_, [
    'collection-id',
    'pmids',
    'external-resources',
    'source-audit',
    'output-directory',
    'target',
    'help',
  ])
  if (hasFlag(arguments_, 'help')) {
    console.log(HELP)
    return
  }

  const collectionId = stringArgument(
    arguments_,
    'collection-id',
    EXPERT_CURATED_IP_V1_COLLECTION_ID,
  )
  if (collectionId !== EXPERT_CURATED_IP_V1_COLLECTION_ID) {
    throw new Error(`--collection-id must be ${EXPERT_CURATED_IP_V1_COLLECTION_ID}.`)
  }
  const pmidsPath = resolve(
    stringArgument(
      arguments_,
      'pmids',
      `${DEFAULT_COLLECTION_DIRECTORY}/${EXPERT_CURATED_IP_V1_COLLECTION_ID}-pmids.txt`,
    ),
  )
  const externalResourcesPath = resolve(
    stringArgument(
      arguments_,
      'external-resources',
      `${DEFAULT_COLLECTION_DIRECTORY}/${EXPERT_CURATED_IP_V1_COLLECTION_ID}-external-resources.txt`,
    ),
  )
  const sourceAuditPath = resolve(
    stringArgument(
      arguments_,
      'source-audit',
      `${DEFAULT_COLLECTION_DIRECTORY}/${EXPERT_CURATED_IP_V1_COLLECTION_ID}-audit.json`,
    ),
  )
  const outputDirectory = resolve(
    stringArgument(arguments_, 'output-directory', DEFAULT_COLLECTION_DIRECTORY),
  )
  const databaseTarget = stringArgument(arguments_, 'target', 'local')
  if (databaseTarget !== 'local' && databaseTarget !== 'remote') {
    throw new Error('--target must be either local or remote.')
  }
  const inputPaths = [pmidsPath, externalResourcesPath, sourceAuditPath]
  let artifactPaths = await resolveCuratedCollectionAuditArtifactPaths({
    outputDirectory,
    inputPaths,
  })

  const [pmidsBytes, externalResourcesBytes, sourceAuditBytes] = await Promise.all([
    readFile(pmidsPath),
    readFile(externalResourcesPath),
    readFile(sourceAuditPath),
  ])
  const pmidsText = pmidsBytes.toString('utf8')
  const externalResourcesText = externalResourcesBytes.toString('utf8')
  const sourceAuditText = sourceAuditBytes.toString('utf8')
  const pmidsSha = sha256Bytes(pmidsBytes)
  const externalSha = sha256Bytes(externalResourcesBytes)
  const auditSha = sha256Bytes(sourceAuditBytes)
  let sourceAudit: unknown
  try {
    sourceAudit = JSON.parse(sourceAuditText) as unknown
  } catch {
    throw new Error('The source audit is not valid JSON.')
  }
  const inputs = validateCuratedCollectionInputs({
    pmidsText,
    externalResourcesText,
    sourceAudit,
    files: {
      pmids: { path: portablePath(pmidsPath), sha256: pmidsSha },
      externalResources: { path: portablePath(externalResourcesPath), sha256: externalSha },
      sourceAudit: { path: portablePath(sourceAuditPath), sha256: auditSha },
    },
  })

  console.log(`Collection: ${inputs.collectionId}`)
  console.log(`PMIDs: ${inputs.pmids.length} (${inputs.files.pmids.sha256})`)
  console.log(
    `External resources: ${inputs.externalResources.length} (${inputs.files.externalResources.sha256})`,
  )
  console.log(`Source audit: ${inputs.files.sourceAudit.sha256}`)
  const client = createLiteratureReadClient(arguments_)
  const snapshot = await fetchDatabaseSnapshot(client, inputs.pmids, inputs.externalResources)
  const report = buildCuratedCollectionAuditReport(inputs, snapshot, {
    databaseTarget: databaseTarget as CuratedCollectionDatabaseTarget,
  })

  await mkdir(outputDirectory, { recursive: true })
  artifactPaths = await resolveCuratedCollectionAuditArtifactPaths({
    outputDirectory,
    inputPaths,
  })
  await Promise.all([
    writeFile(artifactPaths.json, serializeCuratedCollectionJson(report), 'utf8'),
    writeFile(artifactPaths.pmidCsv, serializeCuratedCollectionPmidCsv(report), 'utf8'),
    writeFile(artifactPaths.externalCsv, serializeCuratedCollectionExternalCsv(report), 'utf8'),
  ])

  console.log(`Present in corpus: ${report.summary.presentInCorpus}`)
  console.log(`Missing from corpus: ${report.summary.missingFromCorpus}`)
  console.log(
    `Conflicting existing physician decision: ${report.summary.conflictingExistingPhysicianDecision}`,
  )
  console.log(`Held-out labels withheld: ${report.summary.heldOutLabelsWithheld}`)
  console.log(`JSON report: ${portablePath(artifactPaths.json)}`)
  console.log(`PMID CSV: ${portablePath(artifactPaths.pmidCsv)}`)
  console.log(`External-resource CSV: ${portablePath(artifactPaths.externalCsv)}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
