import { access, copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  balancedChunks,
  compareNumericPmids,
  compareUltraScreeningPasses,
  deterministicPmidSample,
  evaluateUltraScreening,
  fixedSizeChunks,
  NO_ABSTRACT_MARKER,
  selectUltraTerraCandidates,
  serializeUltraResults,
  sha256Json,
  sha256Text,
  stableJson,
  ULTRA_DECISION_CONFIDENCE,
  ULTRA_EVIDENCE_FIELDS,
  ULTRA_REASON_CODES,
  ULTRA_RELEVANCE_LABELS,
  ULTRA_SCREENING_SCHEMA_VERSION,
  ultraScreeningArticleSchema,
  ultraScreeningResultSchema,
  validateUltraWorkerOutput,
  type UltraRelevanceLabel,
  type UltraScreeningArticle,
  type UltraScreeningResult,
} from '@/features/literature/ultra-screening/core'

import {
  assertKnownArguments,
  hasFlag,
  numberArgument,
  parseCliArguments,
  stringArgument,
  type ParsedCliArguments,
} from './lib/cli'
import { createLiteratureReadClient, executeDatabaseCall } from './lib/database'

const MANIFEST_VERSION = '1.0.0'
const DEFAULT_ROOT_PARENT = 'local-data/literature/ultra-screening'
const DEFAULT_SMOKE_SEED = 'ip-literature-ultra-smoke-v1:20260730'
const DEFAULT_QC_SEED = 'ip-literature-ultra-qc-v1:20260730'
const MAX_RETRIES = 2
const MAX_ATTEMPTS = MAX_RETRIES + 1
const ARTICLE_SELECT =
  'pmid,title,abstract,mesh_terms,author_keywords,publication_types,journal_title,journal_abbreviation,publication_year,languages'

type PhaseKind = 'smoke' | 'pilot' | 'corpus' | 'sensitivity' | 'terra_review'
type ExpectedModelFamily = 'luna' | 'terra'
type PhaseStatus = 'pending' | 'running' | 'completed' | 'failed'
type ChunkStatus = 'pending' | 'running' | 'retry_pending' | 'completed' | 'failed'
type AttemptStatus = 'running' | 'invalid' | 'completed' | 'failed'

interface WorkerAttempt {
  attemptNumber: number
  agentId: string
  model: string
  reasoningLevel: string
  assignedPmids: string[]
  status: AttemptStatus
  outputPath: string
  startedAt: string
  completedAt: string | null
  outputSha256: string | null
  validationPath: string | null
  validationResult: 'valid' | 'invalid' | 'worker_failed' | null
  validationErrors: string[]
}

interface ScreeningChunk {
  id: string
  phaseId: string
  index: number
  status: ChunkStatus
  assignedPmids: string[]
  inputPath: string
  packetSha256: string
  validatedOutputPath: string
  validatedOutputSha256: string | null
  attempts: WorkerAttempt[]
}

interface ScreeningPhase {
  id: string
  kind: PhaseKind
  expectedModelFamily: ExpectedModelFamily
  status: PhaseStatus
  createdAt: string
  completedAt: string | null
  seed: string
  selectedCount: number
  chunkSize: number
  requestedWorkerCount: number
  chunkIds: string[]
  sourcePhaseIds: string[]
  sourceSnapshotSha256: string
  aggregateOutputPath: string
  aggregateOutputSha256: string | null
  selectionAuditPath: string | null
}

interface ScreeningManifest {
  manifestVersion: typeof MANIFEST_VERSION
  schemaVersion: typeof ULTRA_SCREENING_SCHEMA_VERSION
  runId: string
  rootPath: string
  createdAt: string
  updatedAt: string
  maxRetries: typeof MAX_RETRIES
  databaseSnapshot: {
    availableArticleCount: number
    withAbstractCount: number
    noAbstractCount: number
    capturedAt: string
  }
  phases: Record<string, ScreeningPhase>
  chunks: Record<string, ScreeningChunk>
  dispatchBlockers: Array<{
    recordedAt: string
    chunkId: string
    requestedModel: string
    reasoningLevel: string
    error: string
  }>
}

interface ArticleRow {
  pmid: unknown
  title: unknown
  abstract: unknown
  mesh_terms: unknown
  author_keywords: unknown
  publication_types: unknown
  journal_title: unknown
  journal_abbreviation: unknown
  publication_year: unknown
  languages: unknown
}

const HELP = `
Prepare, validate, resume, and evaluate local IP-literature subagent screening.

Usage:
  npm run literature:ultra-screen -- prepare --run-id <id> --mode smoke
  npm run literature:ultra-screen -- start --run-root <path> --chunk <id> --agent-id <id> --model <model> --reasoning ultra
  npm run literature:ultra-screen -- validate --run-root <path> --chunk <id>
  npm run literature:ultra-screen -- worker-failed --run-root <path> --chunk <id> --error <text>
  npm run literature:ultra-screen -- dispatch-blocked --run-root <path> --chunk <id> --model <model> --reasoning ultra --error <text>
  npm run literature:ultra-screen -- derive --run-root <path> --kind sensitivity --source-phase <id> --phase <neutral-id>
  npm run literature:ultra-screen -- derive --run-root <path> --kind terra --source-phase <id> --challenge-phase <id> --phase <neutral-id>
  npm run literature:ultra-screen -- evaluate --run-root <path> --phase <id> --batch pilot-v1
  npm run literature:ultra-screen -- status --run-root <path>

Prepare options:
  --run-id <id>           Required stable run identifier.
  --run-root <path>       Defaults to local-data/literature/ultra-screening/<run-id>.
  --mode <value>          smoke, pilot, or corpus.
  --phase <id>            Defaults to smoke-a, pilot-a, or corpus-a.
  --seed <value>          Versioned selection seed.
  --sample-count <n>      Smoke only; default 20.
  --worker-count <n>      Smoke/pilot logical assignments; default 8.
  --chunk-size <n>        Corpus fixed chunk size; default 25.
  --batch <name>          Pilot batch; default pilot-v1.

The script is read-only with respect to Supabase and writes ignored local artifacts only.
`.trim()

function now() {
  return new Date().toISOString()
}

async function pathExists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function requireValue(arguments_: ParsedCliArguments, key: string) {
  const value = stringArgument(arguments_, key)
  if (!value) throw new Error(`--${key} is required.`)
  return value
}

function validateIdentifier(value: string, label: string) {
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/u.test(value)) {
    throw new Error(
      `${label} must contain 3-80 lowercase letters, numbers, dots, underscores, or hyphens.`,
    )
  }
  return value
}

function parseRate(raw: string | undefined, fallback: number) {
  if (raw === undefined) return fallback
  if (!/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/u.test(raw)) {
    throw new Error('--qc-rate must be a number between 0 and 1.')
  }
  return Number(raw)
}

function textArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function nullableText(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function normalizeArticleRow(row: ArticleRow): UltraScreeningArticle {
  const journal = nullableText(row.journal_title) ?? nullableText(row.journal_abbreviation)
  return ultraScreeningArticleSchema.parse({
    pmid: String(row.pmid),
    title: String(row.title),
    abstract: nullableText(row.abstract) ?? NO_ABSTRACT_MARKER,
    mesh: textArray(row.mesh_terms),
    author_keyword: textArray(row.author_keywords),
    publication_type: textArray(row.publication_types),
    journal,
    year:
      typeof row.publication_year === 'number' && Number.isInteger(row.publication_year)
        ? row.publication_year
        : row.publication_year === null
          ? null
          : Number(row.publication_year) || null,
    language: textArray(row.languages),
  })
}

function chunks<T>(values: readonly T[], chunkSize: number) {
  return fixedSizeChunks(values, chunkSize)
}

async function loadArticlesByPmids(client: SupabaseClient, pmids: readonly string[]) {
  const rows: ArticleRow[] = []
  for (const pmidChunk of chunks(pmids, 200)) {
    const data = await executeDatabaseCall<ArticleRow[]>(
      `Article metadata lookup (${pmidChunk[0]}...)`,
      () => client.from('literature_articles').select(ARTICLE_SELECT).in('pmid', pmidChunk),
    )
    rows.push(...(data ?? []))
  }
  const articleByPmid = new Map(rows.map((row) => [String(row.pmid), normalizeArticleRow(row)]))
  const missing = pmids.filter((pmid) => !articleByPmid.has(pmid))
  if (missing.length > 0) {
    throw new Error(`Article metadata is missing for PMIDs: ${missing.join(', ')}`)
  }
  return pmids.map((pmid) => articleByPmid.get(pmid) as UltraScreeningArticle)
}

async function loadAllArticles(client: SupabaseClient) {
  const rows: ArticleRow[] = []
  for (let start = 0; ; start += 1000) {
    const data = await executeDatabaseCall<ArticleRow[]>(
      `Corpus article page ${start / 1000 + 1}`,
      () =>
        client
          .from('literature_articles')
          .select(ARTICLE_SELECT)
          .order('pmid', { ascending: true })
          .range(start, start + 999),
    )
    rows.push(...(data ?? []))
    if ((data?.length ?? 0) < 1000) break
  }
  const articles = rows.map(normalizeArticleRow)
  articles.sort((left, right) => compareNumericPmids(left.pmid, right.pmid))
  return articles
}

async function databaseSnapshot(client: SupabaseClient) {
  const count = async (
    query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
  ) => {
    const result = await query
    if (result.error) throw new Error(result.error.message)
    return result.count ?? 0
  }
  const availableArticleCount = await count(
    client.from('literature_articles').select('pmid', { count: 'exact', head: true }),
  )
  const noAbstractCount = await count(
    client
      .from('literature_articles')
      .select('pmid', { count: 'exact', head: true })
      .is('abstract', null),
  )
  return {
    availableArticleCount,
    withAbstractCount: availableArticleCount - noAbstractCount,
    noAbstractCount,
    capturedAt: now(),
  }
}

async function pilotPmids(client: SupabaseClient, batchName: string) {
  const batches = await executeDatabaseCall<Array<{ id: string }>>('Pilot batch lookup', () =>
    client
      .from('literature_gold_set_batches')
      .select('id')
      .eq('name', batchName)
      .eq('kind', 'pilot')
      .limit(2),
  )
  if (!batches?.[0]) throw new Error(`Pilot batch not found: ${batchName}`)
  if (batches.length !== 1) throw new Error(`Pilot batch name is not unique: ${batchName}`)

  const rows: Array<{ pmid: string }> = []
  for (let start = 0; ; start += 1000) {
    const data = await executeDatabaseCall<Array<{ pmid: string }>>(
      `Completed pilot PMID page ${start / 1000 + 1}`,
      () =>
        client
          .from('literature_gold_set_items')
          .select('pmid')
          .eq('batch_id', batches[0].id)
          .eq('dataset_split', 'development')
          .eq('review_status', 'completed')
          .order('pmid', { ascending: true })
          .range(start, start + 999),
    )
    rows.push(...(data ?? []))
    if ((data?.length ?? 0) < 1000) break
  }
  return rows.map((row) => String(row.pmid))
}

function manifestPath(rootPath: string) {
  return resolve(rootPath, 'progress-manifest.json')
}

async function readManifest(rootPath: string) {
  const raw = await readFile(manifestPath(rootPath), 'utf8')
  const manifest = JSON.parse(raw) as ScreeningManifest
  if (
    manifest.manifestVersion !== MANIFEST_VERSION ||
    manifest.schemaVersion !== ULTRA_SCREENING_SCHEMA_VERSION ||
    resolve(manifest.rootPath) !== resolve(rootPath)
  ) {
    throw new Error('The screening manifest has an unsupported version or root path.')
  }
  manifest.dispatchBlockers ??= []
  return manifest
}

async function writeExactOrVerify(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true })
  try {
    await writeFile(path, content, { encoding: 'utf8', flag: 'wx' })
    return 'created' as const
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) {
      throw error
    }
    const existing = await readFile(path, 'utf8')
    if (existing !== content) {
      throw new Error(`Refusing to overwrite nonmatching artifact: ${path}`)
    }
    return 'verified' as const
  }
}

async function writeJsonExactOrVerify(path: string, value: unknown) {
  return writeExactOrVerify(path, `${JSON.stringify(value, null, 2)}\n`)
}

async function saveManifest(rootPath: string, manifest: ScreeningManifest, initial = false) {
  await mkdir(rootPath, { recursive: true })
  const path = manifestPath(rootPath)
  if (!initial && (await pathExists(path))) {
    const prior = await readFile(path, 'utf8')
    const priorHash = sha256Text(prior)
    const historyPath = resolve(
      rootPath,
      'manifest-history',
      `${manifest.updatedAt.replaceAll(':', '-').replaceAll('.', '-')}-${priorHash.slice(0, 12)}.json`,
    )
    await writeExactOrVerify(historyPath, prior)
  }
  manifest.updatedAt = now()
  const temporaryPath = resolve(rootPath, `.progress-manifest.${process.pid}.${Date.now()}.tmp`)
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  })
  await rename(temporaryPath, path)
}

function classificationContract() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'pmid',
      'relevanceLabel',
      'decisionConfidence',
      'requiresHumanReview',
      'reasonCodes',
      'evidence',
      'conciseRationale',
    ],
    properties: {
      pmid: { type: 'string', pattern: '^[0-9]{1,12}$' },
      relevanceLabel: { enum: ULTRA_RELEVANCE_LABELS },
      decisionConfidence: { enum: ULTRA_DECISION_CONFIDENCE },
      requiresHumanReview: { type: 'boolean' },
      reasonCodes: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: { enum: ULTRA_REASON_CODES },
      },
      evidence: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['field', 'text'],
          properties: {
            field: { enum: ULTRA_EVIDENCE_FIELDS },
            text: { type: 'string', minLength: 1 },
          },
        },
      },
      conciseRationale: { type: 'string', minLength: 1, maxLength: 1000 },
    },
  }
}

function refreshPhase(manifest: ScreeningManifest, phaseId: string) {
  const phase = manifest.phases[phaseId]
  const phaseChunks = phase.chunkIds.map((chunkId) => manifest.chunks[chunkId])
  if (phaseChunks.every((chunk) => chunk.status === 'completed')) {
    phase.status = 'completed'
    phase.completedAt ??= now()
  } else if (
    phaseChunks.every((chunk) => chunk.status === 'completed' || chunk.status === 'failed')
  ) {
    phase.status = 'failed'
    phase.completedAt ??= now()
  } else if (
    phaseChunks.some(
      (chunk) =>
        chunk.status === 'running' || chunk.status === 'retry_pending' || chunk.attempts.length > 0,
    )
  ) {
    phase.status = 'running'
  } else {
    phase.status = 'pending'
  }
}

async function aggregateCompletedPhase(
  rootPath: string,
  manifest: ScreeningManifest,
  phaseId: string,
) {
  const phase = manifest.phases[phaseId]
  if (phase.status !== 'completed') return
  const results: UltraScreeningResult[] = []
  for (const chunkId of phase.chunkIds) {
    const chunk = manifest.chunks[chunkId]
    const raw = await readFile(chunk.validatedOutputPath, 'utf8')
    for (const line of raw.split(/\r?\n/u).filter((candidate) => candidate.trim())) {
      results.push(ultraScreeningResultSchema.parse(JSON.parse(line) as unknown))
    }
  }
  const serialized = serializeUltraResults(results)
  await writeExactOrVerify(phase.aggregateOutputPath, serialized)
  phase.aggregateOutputSha256 = sha256Text(serialized)
}

async function phaseResults(manifest: ScreeningManifest, phaseId: string) {
  const phase = manifest.phases[phaseId]
  if (!phase) throw new Error(`Unknown phase: ${phaseId}`)
  if (phase.status !== 'completed') {
    throw new Error(`Phase ${phaseId} is ${phase.status}, not completed.`)
  }
  const raw = await readFile(phase.aggregateOutputPath, 'utf8')
  const results = raw
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => ultraScreeningResultSchema.parse(JSON.parse(line) as unknown))
  if (results.length !== phase.selectedCount) {
    throw new Error(
      `Phase aggregate count ${results.length} does not match selected count ${phase.selectedCount}.`,
    )
  }
  return results
}

function phaseChunking(
  articles: readonly UltraScreeningArticle[],
  kind: PhaseKind,
  workerCount: number,
  chunkSize: number,
) {
  if ((kind === 'smoke' || kind === 'pilot') && articles.length >= workerCount) {
    return balancedChunks(articles, workerCount)
  }
  return fixedSizeChunks(articles, chunkSize)
}

async function appendPhase(options: {
  rootPath: string
  manifest: ScreeningManifest
  phaseId: string
  kind: PhaseKind
  expectedModelFamily: ExpectedModelFamily
  seed: string
  articles: readonly UltraScreeningArticle[]
  workerCount: number
  chunkSize: number
  sourcePhaseIds?: string[]
  selectionAuditPath?: string | null
}) {
  const {
    rootPath,
    manifest,
    phaseId,
    kind,
    expectedModelFamily,
    seed,
    articles,
    workerCount,
    chunkSize,
    sourcePhaseIds = [],
    selectionAuditPath = null,
  } = options
  if (manifest.phases[phaseId]) {
    throw new Error(`Phase already exists in the manifest: ${phaseId}`)
  }
  if (articles.length === 0) throw new Error(`Phase ${phaseId} selected no articles.`)

  const articleChunks = phaseChunking(articles, kind, workerCount, chunkSize)
  const chunkIds: string[] = []
  for (const [index, packet] of articleChunks.entries()) {
    const chunkId = `${phaseId}-${String(index + 1).padStart(5, '0')}`
    const inputPath = resolve(rootPath, 'packets', phaseId, `${chunkId}.json`)
    const validatedOutputPath = resolve(rootPath, 'validated', phaseId, `${chunkId}.jsonl`)
    await writeJsonExactOrVerify(inputPath, packet)
    const parsedPacket = JSON.parse(await readFile(inputPath, 'utf8')) as unknown[]
    const packetValidation = parsedPacket.map((article) =>
      ultraScreeningArticleSchema.safeParse(article),
    )
    if (packetValidation.some((result) => !result.success)) {
      throw new Error(`Internal packet validation failed for ${chunkId}.`)
    }
    const packetSha256 = sha256Json(packet)
    manifest.chunks[chunkId] = {
      id: chunkId,
      phaseId,
      index: index + 1,
      status: 'pending',
      assignedPmids: packet.map((article) => article.pmid),
      inputPath,
      packetSha256,
      validatedOutputPath,
      validatedOutputSha256: null,
      attempts: [],
    }
    chunkIds.push(chunkId)
  }

  manifest.phases[phaseId] = {
    id: phaseId,
    kind,
    expectedModelFamily,
    status: 'pending',
    createdAt: now(),
    completedAt: null,
    seed,
    selectedCount: articles.length,
    chunkSize: Math.max(...articleChunks.map((packet) => packet.length)),
    requestedWorkerCount: workerCount,
    chunkIds,
    sourcePhaseIds,
    sourceSnapshotSha256: sha256Json(articles),
    aggregateOutputPath: resolve(rootPath, 'validated', phaseId, 'all.jsonl'),
    aggregateOutputSha256: null,
    selectionAuditPath,
  }
}

async function verifyPreparedPhase(manifest: ScreeningManifest, phaseId: string) {
  const phase = manifest.phases[phaseId]
  const errors: string[] = []
  for (const chunkId of phase.chunkIds) {
    const chunk = manifest.chunks[chunkId]
    if (!chunk) {
      errors.push(`Manifest is missing chunk ${chunkId}.`)
      continue
    }
    if (!(await pathExists(chunk.inputPath))) {
      errors.push(`Packet is missing: ${chunk.inputPath}`)
      continue
    }
    const packet = JSON.parse(await readFile(chunk.inputPath, 'utf8')) as unknown
    if (!Array.isArray(packet)) {
      errors.push(`Packet is not a JSON array: ${chunk.inputPath}`)
      continue
    }
    const packetPmids = packet.flatMap((article) => {
      const parsed = ultraScreeningArticleSchema.safeParse(article)
      return parsed.success ? [parsed.data.pmid] : []
    })
    if (
      sha256Json(packet) !== chunk.packetSha256 ||
      stableJson(packetPmids) !== stableJson(chunk.assignedPmids)
    ) {
      errors.push(`Packet content does not match the manifest: ${chunk.inputPath}`)
    }
  }
  if (errors.length > 0) {
    throw new Error(`Existing phase ${phaseId} failed resume verification:\n${errors.join('\n')}`)
  }
}

async function prepare(arguments_: ParsedCliArguments) {
  assertKnownArguments(arguments_, [
    'run-id',
    'run-root',
    'mode',
    'phase',
    'seed',
    'sample-count',
    'worker-count',
    'chunk-size',
    'batch',
  ])
  const runId = validateIdentifier(requireValue(arguments_, 'run-id'), '--run-id')
  const mode = requireValue(arguments_, 'mode')
  if (mode !== 'smoke' && mode !== 'pilot' && mode !== 'corpus') {
    throw new Error('--mode must be smoke, pilot, or corpus.')
  }
  const phaseId = validateIdentifier(
    stringArgument(
      arguments_,
      'phase',
      mode === 'smoke' ? 'smoke-a' : mode === 'pilot' ? 'pilot-a' : 'corpus-a',
    ),
    '--phase',
  )
  const rootPath = resolve(
    stringArgument(arguments_, 'run-root', resolve(DEFAULT_ROOT_PARENT, runId)),
  )
  const seed = stringArgument(
    arguments_,
    'seed',
    mode === 'smoke' ? DEFAULT_SMOKE_SEED : `ip-literature-ultra-${mode}-v1:20260730`,
  )
  const sampleCount = numberArgument(arguments_, 'sample-count', 20) as number
  const workerCount = numberArgument(arguments_, 'worker-count', 8) as number
  const requestedChunkSize = numberArgument(arguments_, 'chunk-size', 25) as number
  const batchName = stringArgument(arguments_, 'batch', 'pilot-v1')

  const client = createLiteratureReadClient({ flags: new Set(), values: new Map() })
  let manifest: ScreeningManifest
  if (await pathExists(manifestPath(rootPath))) {
    manifest = await readManifest(rootPath)
    if (manifest.runId !== runId) {
      throw new Error(`Run root belongs to ${manifest.runId}, not ${runId}.`)
    }
    if (manifest.phases[phaseId]) {
      await verifyPreparedPhase(manifest, phaseId)
      console.log(
        `Phase ${phaseId} already exists with status ${manifest.phases[phaseId].status}; all packet checksums and PMID assignments match.`,
      )
      return
    }
  } else {
    const snapshot = await databaseSnapshot(client)
    const createdAt = now()
    manifest = {
      manifestVersion: MANIFEST_VERSION,
      schemaVersion: ULTRA_SCREENING_SCHEMA_VERSION,
      runId,
      rootPath,
      createdAt,
      updatedAt: createdAt,
      maxRetries: MAX_RETRIES,
      databaseSnapshot: snapshot,
      phases: {},
      chunks: {},
      dispatchBlockers: [],
    }
  }

  let articles: UltraScreeningArticle[]
  if (mode === 'corpus') {
    articles = await loadAllArticles(client)
    if (articles.length !== manifest.databaseSnapshot.availableArticleCount) {
      throw new Error(
        `Corpus count changed from ${manifest.databaseSnapshot.availableArticleCount} to ${articles.length}. Start a new run.`,
      )
    }
  } else {
    const candidates = await pilotPmids(client, batchName)
    const selectedPmids =
      mode === 'smoke'
        ? deterministicPmidSample(candidates, sampleCount, seed).sort(compareNumericPmids)
        : [...candidates].sort(compareNumericPmids)
    articles = await loadArticlesByPmids(client, selectedPmids)
  }

  await appendPhase({
    rootPath,
    manifest,
    phaseId,
    kind: mode,
    expectedModelFamily: 'luna',
    seed,
    articles,
    workerCount,
    chunkSize: requestedChunkSize,
  })
  await saveManifest(rootPath, manifest, !(await pathExists(manifestPath(rootPath))))

  const phase = manifest.phases[phaseId]
  const preflight = {
    runId,
    phaseId,
    mode,
    availableArticleCount: manifest.databaseSnapshot.availableArticleCount,
    selectedArticleCount: phase.selectedCount,
    proposedChunkSize: phase.chunkSize,
    requestedSubagents: phase.requestedWorkerCount,
    effectiveConcurrentSubagents: 3,
    outputLocation: resolve(rootPath, 'worker-outputs', phaseId),
    progressManifestLocation: manifestPath(rootPath),
    exactClassificationSchema: classificationContract(),
    packetValidationStatus: 'valid',
    packetCount: phase.chunkIds.length,
    modelRequirement: phase.expectedModelFamily,
  }
  await writeJsonExactOrVerify(resolve(rootPath, 'preflight', `${phaseId}.json`), preflight)
  console.log(JSON.stringify(preflight, null, 2))
}

function modelMatchesFamily(model: string, family: ExpectedModelFamily) {
  return model.toLocaleLowerCase('en-US').includes(family)
}

async function startWorker(arguments_: ParsedCliArguments) {
  assertKnownArguments(arguments_, [
    'run-root',
    'chunk',
    'agent-id',
    'model',
    'reasoning',
    'output',
  ])
  const rootPath = resolve(requireValue(arguments_, 'run-root'))
  const chunkId = requireValue(arguments_, 'chunk')
  const agentId = requireValue(arguments_, 'agent-id')
  const model = requireValue(arguments_, 'model')
  const reasoningLevel = requireValue(arguments_, 'reasoning')
  const manifest = await readManifest(rootPath)
  const chunk = manifest.chunks[chunkId]
  if (!chunk) throw new Error(`Unknown chunk: ${chunkId}`)
  const phase = manifest.phases[chunk.phaseId]
  if (!modelMatchesFamily(model, phase.expectedModelFamily)) {
    throw new Error(
      `Phase ${phase.id} requires ${phase.expectedModelFamily}; refusing recorded model ${model}.`,
    )
  }
  if (chunk.status === 'completed' || chunk.status === 'failed' || chunk.status === 'running') {
    throw new Error(`Chunk ${chunkId} cannot start from status ${chunk.status}.`)
  }
  const attemptNumber = chunk.attempts.length + 1
  if (attemptNumber > MAX_ATTEMPTS) {
    throw new Error(`Chunk ${chunkId} has exhausted its initial attempt and two retries.`)
  }
  const outputPath = resolve(
    stringArgument(
      arguments_,
      'output',
      resolve(
        rootPath,
        'worker-outputs',
        chunk.phaseId,
        `${chunk.id}.attempt-${attemptNumber}.jsonl`,
      ),
    ),
  )
  if (await pathExists(outputPath)) {
    throw new Error(`Worker output already exists: ${outputPath}`)
  }
  await mkdir(dirname(outputPath), { recursive: true })
  chunk.attempts.push({
    attemptNumber,
    agentId,
    model,
    reasoningLevel,
    assignedPmids: [...chunk.assignedPmids],
    status: 'running',
    outputPath,
    startedAt: now(),
    completedAt: null,
    outputSha256: null,
    validationPath: null,
    validationResult: null,
    validationErrors: [],
  })
  chunk.status = 'running'
  refreshPhase(manifest, chunk.phaseId)
  await saveManifest(rootPath, manifest)
  console.log(
    JSON.stringify(
      {
        chunkId,
        agentId,
        model,
        reasoningLevel,
        inputPath: chunk.inputPath,
        outputPath,
        assignedPmids: chunk.assignedPmids,
        attemptNumber,
      },
      null,
      2,
    ),
  )
}

function currentAttempt(chunk: ScreeningChunk) {
  const attempt = chunk.attempts.at(-1)
  if (!attempt) throw new Error(`Chunk ${chunk.id} has no worker attempt.`)
  return attempt
}

async function validateWorker(arguments_: ParsedCliArguments) {
  assertKnownArguments(arguments_, ['run-root', 'chunk'])
  const rootPath = resolve(requireValue(arguments_, 'run-root'))
  const chunkId = requireValue(arguments_, 'chunk')
  const manifest = await readManifest(rootPath)
  const chunk = manifest.chunks[chunkId]
  if (!chunk) throw new Error(`Unknown chunk: ${chunkId}`)
  if (chunk.status !== 'running') {
    throw new Error(`Chunk ${chunkId} cannot validate from status ${chunk.status}.`)
  }
  const attempt = currentAttempt(chunk)
  const packet = JSON.parse(await readFile(chunk.inputPath, 'utf8')) as unknown[]
  const outputExists = await pathExists(attempt.outputPath)
  const rawOutput = outputExists ? await readFile(attempt.outputPath, 'utf8') : ''
  const report = validateUltraWorkerOutput(rawOutput, packet)
  if (!outputExists) {
    report.valid = false
    report.errors.unshift({
      code: 'invalid_json',
      message: `Worker output file does not exist: ${attempt.outputPath}`,
    })
  }

  attempt.completedAt = now()
  attempt.outputSha256 = outputExists ? sha256Text(rawOutput) : null
  const validationPath = resolve(
    rootPath,
    'validation',
    chunk.phaseId,
    `${chunk.id}.attempt-${attempt.attemptNumber}.json`,
  )
  attempt.validationPath = validationPath
  attempt.validationErrors = report.errors.map((error) => error.message)

  if (report.valid) {
    const serialized = serializeUltraResults(report.records)
    await writeExactOrVerify(chunk.validatedOutputPath, serialized)
    chunk.validatedOutputSha256 = sha256Text(serialized)
    chunk.status = 'completed'
    attempt.status = 'completed'
    attempt.validationResult = 'valid'
  } else {
    const quarantineRoot = resolve(
      rootPath,
      'quarantine',
      chunk.phaseId,
      `${chunk.id}.attempt-${attempt.attemptNumber}`,
    )
    await mkdir(quarantineRoot, { recursive: true })
    if (outputExists) {
      await copyFile(attempt.outputPath, resolve(quarantineRoot, basename(attempt.outputPath)))
    }
    await writeJsonExactOrVerify(resolve(quarantineRoot, 'validation.json'), report)
    attempt.status = 'invalid'
    attempt.validationResult = 'invalid'
    chunk.status = attempt.attemptNumber < MAX_ATTEMPTS ? 'retry_pending' : 'failed'
  }
  await writeJsonExactOrVerify(validationPath, report)
  refreshPhase(manifest, chunk.phaseId)
  await aggregateCompletedPhase(rootPath, manifest, chunk.phaseId)
  await saveManifest(rootPath, manifest)
  console.log(
    JSON.stringify(
      {
        chunkId,
        attemptNumber: attempt.attemptNumber,
        validationResult: attempt.validationResult,
        chunkStatus: chunk.status,
        validRecordCount: report.validRecordCount,
        errors: report.errors,
      },
      null,
      2,
    ),
  )
  if (!report.valid) process.exitCode = 2
}

async function markWorkerFailed(arguments_: ParsedCliArguments) {
  assertKnownArguments(arguments_, ['run-root', 'chunk', 'error'])
  const rootPath = resolve(requireValue(arguments_, 'run-root'))
  const chunkId = requireValue(arguments_, 'chunk')
  const error = requireValue(arguments_, 'error')
  const manifest = await readManifest(rootPath)
  const chunk = manifest.chunks[chunkId]
  if (!chunk) throw new Error(`Unknown chunk: ${chunkId}`)
  if (chunk.status !== 'running') {
    throw new Error(`Chunk ${chunkId} cannot fail from status ${chunk.status}.`)
  }
  const attempt = currentAttempt(chunk)
  attempt.status = 'failed'
  attempt.completedAt = now()
  attempt.validationResult = 'worker_failed'
  attempt.validationErrors = [error]
  chunk.status = attempt.attemptNumber < MAX_ATTEMPTS ? 'retry_pending' : 'failed'
  refreshPhase(manifest, chunk.phaseId)
  await saveManifest(rootPath, manifest)
  console.log(`Recorded worker failure for ${chunkId}; next status: ${chunk.status}`)
}

async function recordDispatchBlocker(arguments_: ParsedCliArguments) {
  assertKnownArguments(arguments_, ['run-root', 'chunk', 'model', 'reasoning', 'error'])
  const rootPath = resolve(requireValue(arguments_, 'run-root'))
  const chunkId = requireValue(arguments_, 'chunk')
  const requestedModel = requireValue(arguments_, 'model')
  const reasoningLevel = requireValue(arguments_, 'reasoning')
  const error = requireValue(arguments_, 'error')
  const manifest = await readManifest(rootPath)
  const chunk = manifest.chunks[chunkId]
  if (!chunk) throw new Error(`Unknown chunk: ${chunkId}`)
  if (chunk.status !== 'pending' && chunk.status !== 'retry_pending') {
    throw new Error(`Cannot record a dispatch blocker for chunk status ${chunk.status}.`)
  }
  const duplicate = manifest.dispatchBlockers.some(
    (blocker) =>
      blocker.chunkId === chunkId &&
      blocker.requestedModel === requestedModel &&
      blocker.reasoningLevel === reasoningLevel &&
      blocker.error === error,
  )
  if (!duplicate) {
    manifest.dispatchBlockers.push({
      recordedAt: now(),
      chunkId,
      requestedModel,
      reasoningLevel,
      error,
    })
    await saveManifest(rootPath, manifest)
  }
  console.log(
    JSON.stringify(
      {
        recorded: !duplicate,
        chunkId,
        requestedModel,
        reasoningLevel,
        error,
        chunkStatus: chunk.status,
      },
      null,
      2,
    ),
  )
}

async function derivePhase(arguments_: ParsedCliArguments) {
  assertKnownArguments(arguments_, [
    'run-root',
    'kind',
    'source-phase',
    'challenge-phase',
    'phase',
    'seed',
    'worker-count',
    'chunk-size',
    'qc-rate',
  ])
  const rootPath = resolve(requireValue(arguments_, 'run-root'))
  const kind = requireValue(arguments_, 'kind')
  if (kind !== 'sensitivity' && kind !== 'terra') {
    throw new Error('--kind must be sensitivity or terra.')
  }
  const sourcePhaseId = requireValue(arguments_, 'source-phase')
  const phaseId = validateIdentifier(requireValue(arguments_, 'phase'), '--phase')
  const challengePhaseId = stringArgument(arguments_, 'challenge-phase')
  const seed = stringArgument(
    arguments_,
    'seed',
    kind === 'terra' ? DEFAULT_QC_SEED : `ip-literature-ultra-${phaseId}-v1:20260730`,
  )
  const workerCount = numberArgument(arguments_, 'worker-count', 8) as number
  const chunkSize = numberArgument(arguments_, 'chunk-size', kind === 'terra' ? 10 : 25) as number
  const qcRate = parseRate(stringArgument(arguments_, 'qc-rate'), 0.05)
  const manifest = await readManifest(rootPath)
  if (manifest.phases[phaseId]) throw new Error(`Phase already exists: ${phaseId}`)
  const sourceResults = await phaseResults(manifest, sourcePhaseId)
  const client = createLiteratureReadClient({ flags: new Set(), values: new Map() })

  let selectedPmids: string[]
  let selectionAudit: unknown
  let expectedModelFamily: ExpectedModelFamily
  let phaseKind: PhaseKind
  const sourcePhaseIds = [sourcePhaseId]
  if (kind === 'sensitivity') {
    selectedPmids = sourceResults
      .filter((result) => result.relevanceLabel === 'exclude')
      .map((result) => result.pmid)
      .sort(compareNumericPmids)
    selectionAudit = {
      kind: 'independent_sensitivity_selection',
      sourcePhaseId,
      selectedPmids,
      selectionRule: 'Every first-pass exclusion; prior labels are not copied into worker packets.',
    }
    expectedModelFamily = 'luna'
    phaseKind = 'sensitivity'
  } else {
    const challengeResults = challengePhaseId ? await phaseResults(manifest, challengePhaseId) : []
    if (challengePhaseId) sourcePhaseIds.push(challengePhaseId)
    const allPmids = [...new Set(sourceResults.map((result) => result.pmid))]
    const sourceArticles = await loadArticlesByPmids(client, allPmids)
    const selections = selectUltraTerraCandidates({
      articles: sourceArticles,
      firstPass: sourceResults,
      challengePass: challengeResults,
      qcRate,
      qcSeed: seed,
    })
    selectedPmids = selections.map((selection) => selection.pmid)
    selectionAudit = {
      kind: 'terra_escalation_selection',
      sourcePhaseId,
      challengePhaseId: challengePhaseId ?? null,
      qcRate,
      qcSeed: seed,
      selections,
    }
    expectedModelFamily = 'terra'
    phaseKind = 'terra_review'
  }

  if (selectedPmids.length === 0) {
    throw new Error(`Derived ${kind} phase selected no PMIDs.`)
  }
  const selectionAuditPath = resolve(rootPath, 'coordinator-only', `${phaseId}-selection.json`)
  await writeJsonExactOrVerify(selectionAuditPath, selectionAudit)
  const articles = await loadArticlesByPmids(client, selectedPmids)
  await appendPhase({
    rootPath,
    manifest,
    phaseId,
    kind: phaseKind,
    expectedModelFamily,
    seed,
    articles,
    workerCount,
    chunkSize,
    sourcePhaseIds,
    selectionAuditPath,
  })
  await saveManifest(rootPath, manifest)
  console.log(
    JSON.stringify(
      {
        phaseId,
        kind: phaseKind,
        expectedModelFamily,
        selectedArticleCount: selectedPmids.length,
        packetCount: Object.values(manifest.chunks).filter((chunk) => chunk.phaseId === phaseId)
          .length,
        workerPacketDirectory: resolve(rootPath, 'packets', phaseId),
        coordinatorOnlySelectionAudit: selectionAuditPath,
      },
      null,
      2,
    ),
  )
}

async function loadPilotTruth(client: SupabaseClient, batchName: string, pmids: readonly string[]) {
  const batches = await executeDatabaseCall<Array<{ id: string }>>('Evaluation batch lookup', () =>
    client
      .from('literature_gold_set_batches')
      .select('id')
      .eq('name', batchName)
      .eq('kind', 'pilot')
      .limit(2),
  )
  if (!batches?.[0] || batches.length !== 1) {
    throw new Error(`Expected exactly one pilot batch named ${batchName}.`)
  }

  const itemRows: Array<{ pmid: string; current_review_id: string | null }> = []
  for (const pmidChunk of chunks(pmids, 200)) {
    const rows = await executeDatabaseCall<
      Array<{ pmid: string; current_review_id: string | null }>
    >('Pilot evaluation item lookup', () =>
      client
        .from('literature_gold_set_items')
        .select('pmid,current_review_id')
        .eq('batch_id', batches[0].id)
        .eq('dataset_split', 'development')
        .eq('review_status', 'completed')
        .in('pmid', pmidChunk),
    )
    itemRows.push(...(rows ?? []))
  }
  const reviewIds = itemRows.flatMap((row) =>
    row.current_review_id ? [row.current_review_id] : [],
  )
  const reviewRows: Array<{ id: string; relevance_label: string }> = []
  for (const reviewChunk of chunks(reviewIds, 200)) {
    const rows = await executeDatabaseCall<Array<{ id: string; relevance_label: string }>>(
      'Hidden pilot review lookup',
      () =>
        client
          .from('literature_gold_set_reviews')
          .select('id,relevance_label')
          .in('id', reviewChunk),
    )
    reviewRows.push(...(rows ?? []))
  }
  const labelByReviewId = new Map(
    reviewRows.map((row) => [row.id, row.relevance_label as UltraRelevanceLabel]),
  )
  const truthByPmid = new Map(
    itemRows.flatMap((row) => {
      const label = row.current_review_id ? labelByReviewId.get(row.current_review_id) : undefined
      return label ? [[row.pmid, label] as const] : []
    }),
  )
  const missing = pmids.filter((pmid) => !truthByPmid.has(pmid))
  if (missing.length > 0) {
    throw new Error(`Hidden pilot truth is missing for PMIDs: ${missing.join(', ')}`)
  }
  return pmids.map((pmid) => ({
    pmid,
    relevanceLabel: truthByPmid.get(pmid) as UltraRelevanceLabel,
  }))
}

async function evaluatePhase(arguments_: ParsedCliArguments) {
  assertKnownArguments(arguments_, ['run-root', 'phase', 'batch', 'compare-phase'])
  const rootPath = resolve(requireValue(arguments_, 'run-root'))
  const phaseId = requireValue(arguments_, 'phase')
  const batchName = stringArgument(arguments_, 'batch', 'pilot-v1')
  const comparePhaseId = stringArgument(arguments_, 'compare-phase')
  const manifest = await readManifest(rootPath)
  const predictions = await phaseResults(manifest, phaseId)
  const client = createLiteratureReadClient({ flags: new Set(), values: new Map() })

  // This is the only command that reads physician relevance labels. It is intentionally invoked
  // only after a prediction phase is complete and validated.
  const truth = await loadPilotTruth(
    client,
    batchName,
    predictions.map((prediction) => prediction.pmid),
  )
  const metrics = evaluateUltraScreening(truth, predictions)
  const comparison = comparePhaseId
    ? compareUltraScreeningPasses(predictions, await phaseResults(manifest, comparePhaseId))
    : null
  const report = {
    reportVersion: '1.0.0',
    runId: manifest.runId,
    predictionPhase: phaseId,
    comparisonPhase: comparePhaseId ?? null,
    batch: batchName,
    evaluatedAt: manifest.phases[phaseId].completedAt,
    warning:
      'The pilot is enriched development data; these are workflow diagnostics, not corpus prevalence or final classifier performance.',
    metrics,
    comparison,
  }
  const outputPath = resolve(
    rootPath,
    'evaluations',
    `${phaseId}-vs-${batchName}${comparePhaseId ? `-compare-${comparePhaseId}` : ''}.json`,
  )
  await writeJsonExactOrVerify(outputPath, report)
  console.log(JSON.stringify({ outputPath, ...report }, null, 2))
}

function manifestSummary(manifest: ScreeningManifest) {
  return {
    runId: manifest.runId,
    rootPath: manifest.rootPath,
    databaseSnapshot: manifest.databaseSnapshot,
    phases: Object.values(manifest.phases).map((phase) => {
      const phaseChunks = phase.chunkIds.map((chunkId) => manifest.chunks[chunkId])
      return {
        id: phase.id,
        kind: phase.kind,
        expectedModelFamily: phase.expectedModelFamily,
        status: phase.status,
        selectedCount: phase.selectedCount,
        chunkCount: phaseChunks.length,
        completedChunks: phaseChunks.filter((chunk) => chunk.status === 'completed').length,
        pendingChunks: phaseChunks.filter((chunk) => chunk.status === 'pending').length,
        runningChunks: phaseChunks.filter((chunk) => chunk.status === 'running').length,
        retryPendingChunks: phaseChunks.filter((chunk) => chunk.status === 'retry_pending').length,
        failedChunks: phaseChunks.filter((chunk) => chunk.status === 'failed').length,
        retriedChunks: phaseChunks.filter((chunk) => chunk.attempts.length > 1).length,
        invalidAttempts: phaseChunks.reduce(
          (count, chunk) =>
            count + chunk.attempts.filter((attempt) => attempt.status === 'invalid').length,
          0,
        ),
        aggregateOutputPath: phase.aggregateOutputPath,
      }
    }),
    dispatchBlockers: manifest.dispatchBlockers,
  }
}

async function showStatus(arguments_: ParsedCliArguments) {
  assertKnownArguments(arguments_, ['run-root', 'json'])
  const rootPath = resolve(requireValue(arguments_, 'run-root'))
  const manifest = await readManifest(rootPath)
  const summary = manifestSummary(manifest)
  if (hasFlag(arguments_, 'json')) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }
  console.log(`Run: ${summary.runId}`)
  console.log(`Root: ${summary.rootPath}`)
  console.log(
    `Corpus: ${summary.databaseSnapshot.availableArticleCount} articles (${summary.databaseSnapshot.noAbstractCount} without abstracts)`,
  )
  for (const phase of summary.phases) {
    console.log(
      `${phase.id}: ${phase.status}; ${phase.completedChunks}/${phase.chunkCount} chunks complete; ${phase.retryPendingChunks} retry-pending; ${phase.failedChunks} failed`,
    )
  }
  if (summary.dispatchBlockers.length > 0) {
    console.log(`Dispatch blockers: ${summary.dispatchBlockers.length}`)
  }
}

async function auditRuntimeArtifacts(arguments_: ParsedCliArguments) {
  assertKnownArguments(arguments_, ['run-root'])
  const rootPath = resolve(requireValue(arguments_, 'run-root'))
  const manifest = await readManifest(rootPath)
  const errors: string[] = []
  for (const chunk of Object.values(manifest.chunks)) {
    if (!(await pathExists(chunk.inputPath))) {
      errors.push(`Missing packet: ${chunk.inputPath}`)
      continue
    }
    const packet = JSON.parse(await readFile(chunk.inputPath, 'utf8')) as unknown
    if (!Array.isArray(packet)) {
      errors.push(`Packet is not an array: ${chunk.inputPath}`)
      continue
    }
    if (sha256Json(packet) !== chunk.packetSha256) {
      errors.push(`Packet checksum mismatch: ${chunk.inputPath}`)
    }
    const packetPmids = packet.flatMap((article) => {
      const result = ultraScreeningArticleSchema.safeParse(article)
      return result.success ? [result.data.pmid] : []
    })
    if (stableJson(packetPmids) !== stableJson(chunk.assignedPmids)) {
      errors.push(`Packet PMID assignment mismatch: ${chunk.inputPath}`)
    }
    if (chunk.status === 'completed') {
      if (!(await pathExists(chunk.validatedOutputPath))) {
        errors.push(`Missing validated output: ${chunk.validatedOutputPath}`)
      } else {
        const output = await readFile(chunk.validatedOutputPath, 'utf8')
        if (sha256Text(output) !== chunk.validatedOutputSha256) {
          errors.push(`Validated output checksum mismatch: ${chunk.validatedOutputPath}`)
        }
      }
    }
  }
  const result = {
    runId: manifest.runId,
    checkedChunks: Object.keys(manifest.chunks).length,
    valid: errors.length === 0,
    errors,
  }
  console.log(JSON.stringify(result, null, 2))
  if (errors.length > 0) process.exitCode = 2
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  if (!command || command === '--help' || command === 'help') {
    console.log(HELP)
    return
  }
  const arguments_ = parseCliArguments(rest)
  switch (command) {
    case 'prepare':
      await prepare(arguments_)
      break
    case 'start':
      await startWorker(arguments_)
      break
    case 'validate':
      await validateWorker(arguments_)
      break
    case 'worker-failed':
      await markWorkerFailed(arguments_)
      break
    case 'dispatch-blocked':
      await recordDispatchBlocker(arguments_)
      break
    case 'derive':
      await derivePhase(arguments_)
      break
    case 'evaluate':
      await evaluatePhase(arguments_)
      break
    case 'status':
      await showStatus(arguments_)
      break
    case 'audit':
      await auditRuntimeArtifacts(arguments_)
      break
    default:
      throw new Error(`Unknown command: ${command}\n\n${HELP}`)
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
