import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import { validateLiteratureLanguage } from '@/features/literature/domain/pubmed-metadata'
import { parseCsvRows } from '@/features/literature/gold-set/export'

import {
  CANONICAL_V2_SOURCE_SHA256,
  parseV2SourceCsv,
  type V2SourceRow,
} from './data-quality/external-qa'
import { executeDatabaseCall } from './lib/database'

export const GOLD_ENRICHMENT_BATCH_NAME = 'gold-set-v1' as const
export const GOLD_ENRICHMENT_BATCH_ID = 'fff41ba3-811d-4d28-ba73-9302db3a942a' as const
export const GOLD_ENRICHMENT_DATASET_SPLIT = 'development' as const
export const GOLD_ENRICHMENT_DEVELOPMENT_ROWS = 630
export const CANONICAL_PHYSICIAN_RELEVANCE_SHA256 =
  '7542878664c44ce1bf34d355c0ac795c3fc46fe2e3ae4632210be3197ebc1f98'
export const CANONICAL_PHYSICIAN_FIELD_SHA256 =
  '90b4b198da5803158685a9dd89d3f59578b91bad9bbd14e1cc55ebf5fdc9a01e'

export const PHYSICIAN_RELEVANCE_COLUMNS = [
  'master_row_id',
  'screening_batch',
  'source_row_id',
  'pmid',
  'title',
  'abstract',
  'mesh',
  'author_keywords',
  'publication_types',
  'journal',
  'year',
  'language',
  'no_abstract',
  'protected_procedural_cue',
  'first_pass_label',
  'first_pass_confidence',
  'first_pass_requires_human_review',
  'first_pass_rationale',
  'second_pass_label',
  'second_pass_confidence',
  'second_pass_requires_human_review',
  'second_pass_rationale',
  'two_pass_status',
  'provisional_label',
  'triage_lane',
  'triage_reason',
  'physician_final_label',
  'physician_final_confidence',
  'physician_accept_or_modify',
  'physician_notes',
  'physician_reviewed',
  'decision_provenance',
  'is_blinded',
  'relevance_review_complete',
  'enrichment_status',
  'database_import_ready',
] as const

export const PHYSICIAN_FIELD_COLUMNS = [
  'physician_final_label',
  'physician_final_confidence',
  'physician_accept_or_modify',
  'physician_notes',
  'physician_reviewed',
  'decision_provenance',
  'is_blinded',
  'relevance_review_complete',
] as const

export const PHYSICIAN_HASH_COLUMNS = ['master_row_id', 'pmid', ...PHYSICIAN_FIELD_COLUMNS] as const

export const SCREENING_PROVENANCE_COLUMNS = [
  'screening_batch',
  'source_row_id',
  'protected_procedural_cue',
  'first_pass_label',
  'first_pass_confidence',
  'first_pass_requires_human_review',
  'first_pass_rationale',
  'second_pass_label',
  'second_pass_confidence',
  'second_pass_requires_human_review',
  'second_pass_rationale',
  'two_pass_status',
  'provisional_label',
  'triage_lane',
  'triage_reason',
] as const

export const GOLD_ENRICHMENT_SOURCE_COLUMNS = [
  'batch_id',
  'batch_name',
  'dataset_split',
  'gold_set_item_id',
  'display_order',
  'master_row_id',
  'screening_batch',
  'source_row_id',
  'pmid',
  'title',
  'abstract',
  'authors_json',
  'journal',
  'journal_abbreviation',
  'publication_year',
  'publication_types_json',
  'mesh_terms_json',
  'author_keywords_json',
  'languages_json',
  'no_abstract',
  'protected_procedural_cue',
  'first_pass_label',
  'first_pass_confidence',
  'first_pass_requires_human_review',
  'first_pass_rationale',
  'second_pass_label',
  'second_pass_confidence',
  'second_pass_requires_human_review',
  'second_pass_rationale',
  'two_pass_status',
  'provisional_label',
  'triage_lane',
  'triage_reason',
  'physician_final_label',
  'physician_final_confidence',
  'physician_accept_or_modify',
  'physician_notes',
  'physician_reviewed',
  'decision_provenance',
  'is_blinded',
  'relevance_review_complete',
  'enrichment_status',
  'database_import_ready',
] as const

export const GOLD_ENRICHMENT_ARTICLE_SELECT = [
  'pmid',
  'title',
  'abstract',
  'authors',
  'journal_title',
  'journal_abbreviation',
  'publication_year',
  'publication_types',
  'mesh_terms',
  'author_keywords',
  'languages',
].join(',')

export const PR69_PUBLICATION_TYPE_CONFLICT = Object.freeze({
  pmid: '41347323',
  canonicalAtPr69: ['Journal Article', 'Review', 'Systematic Review'] as const,
  pubmedAtPr69: ['Journal Article', 'Systematic Review'] as const,
  canonicalOnly: ['Review'] as const,
  reference: 'PR #69 PubMed EFetch merge-readiness audit',
})

export type PhysicianRelevanceColumn = (typeof PHYSICIAN_RELEVANCE_COLUMNS)[number]
type GoldEnrichmentSourceColumn = (typeof GOLD_ENRICHMENT_SOURCE_COLUMNS)[number]
type PhysicianFieldColumn = (typeof PHYSICIAN_FIELD_COLUMNS)[number]
type PhysicianHashColumn = (typeof PHYSICIAN_HASH_COLUMNS)[number]

export type PhysicianRelevanceRow = Record<PhysicianRelevanceColumn, string> & {
  csvRecordNumber: number
}

export type GoldEnrichmentSourceRow = Record<GoldEnrichmentSourceColumn, string>

export interface PhysicianRelevanceContract {
  confidenceCounts: Record<'high' | 'low' | 'moderate', number>
  decisionProvenance: 'human_ai_assisted'
  expectedRows: number
  labelCounts: Record<'exclude' | 'include_adjacent' | 'include_core' | 'uncertain', number>
  physicianFieldSha256: string
  sourceSha256: string
}

export const CANONICAL_PHYSICIAN_RELEVANCE_CONTRACT: PhysicianRelevanceContract = Object.freeze({
  confidenceCounts: { high: 598, low: 1, moderate: 31 },
  decisionProvenance: 'human_ai_assisted',
  expectedRows: GOLD_ENRICHMENT_DEVELOPMENT_ROWS,
  labelCounts: { exclude: 272, include_adjacent: 75, include_core: 283, uncertain: 0 },
  physicianFieldSha256: CANONICAL_PHYSICIAN_FIELD_SHA256,
  sourceSha256: CANONICAL_PHYSICIAN_RELEVANCE_SHA256,
})

export interface ParsedPhysicianRelevance {
  byPmid: Map<string, PhysicianRelevanceRow>
  expectedPhysicianFieldSha256: string
  expectedSourceSha256: string
  physicianFieldSha256: string
  rows: PhysicianRelevanceRow[]
  sourceSha256: string
  summaries: {
    confidenceCounts: Record<string, number>
    labelCounts: Record<string, number>
    provenanceCounts: Record<string, number>
  }
}

export interface GoldEnrichmentBatchRow {
  id: string
  name: string
}

export interface GoldEnrichmentDevelopmentItem {
  datasetSplit: typeof GOLD_ENRICHMENT_DATASET_SPLIT
  displayOrder: number
  id: string
  pmid: string
}

export interface GoldEnrichmentArticle {
  abstract: string | null
  authorKeywords: string[]
  authors: unknown[]
  journalAbbreviation: string | null
  journalTitle: string | null
  languages: string[]
  meshTerms: string[]
  pmid: string
  publicationTypes: string[]
  publicationYear: number | null
  title: string
}

export interface CanonicalDevelopmentSnapshot {
  articles: GoldEnrichmentArticle[]
  batch: GoldEnrichmentBatchRow
  datasetSplit: typeof GOLD_ENRICHMENT_DATASET_SPLIT
  items: GoldEnrichmentDevelopmentItem[]
}

interface RawGoldSetItem {
  dataset_split: unknown
  display_order: unknown
  id: unknown
  pmid: unknown
}

interface RawArticle {
  abstract: unknown
  author_keywords: unknown
  authors: unknown
  journal_abbreviation: unknown
  journal_title: unknown
  languages: unknown
  mesh_terms: unknown
  pmid: unknown
  publication_types: unknown
  publication_year: unknown
  title: unknown
}

export interface MetadataCoverage {
  authorKeywords: { blank: number; populated: number }
  languages: { blank: number; populated: number }
  meshTerms: { blank: number; populated: number }
  publicationTypes: { blank: number; populated: number }
}

export interface TextDifference {
  canonicalLength: number
  canonicalSha256: string
  pmid: string
  previousLength: number
  previousSha256: string
}

export interface TitleDifference extends TextDifference {
  canonical: string
  previous: string
}

export interface MetadataConflict {
  canonical: string[]
  field: 'authorKeywords' | 'languages' | 'meshTerms' | 'publicationTypes'
  pmid: string
  previousRaw: string
}

export interface FidelityAudit {
  abstractDifferences: { count: number; rows: TextDifference[] }
  canonicalCoverage: MetadataCoverage
  invalidLanguages: {
    canonical: Array<{ pmid: string; value: string }>
    previous: Array<{ pmid: string; value: string }>
  }
  nonblankMetadataConflicts: MetadataConflict[]
  physicianFieldMismatches: Array<{
    actual: string
    expected: string
    field: 'master_row_id' | 'physician_final_confidence' | 'physician_final_label'
    pmid: string
  }>
  pmidAndOrder: {
    exactMembership: boolean
    exactOrder: boolean
    missingFromPrevious: string[]
    orderMismatches: Array<{ canonicalPmid: string; index: number; previousPmid: string }>
    unexpectedInPrevious: string[]
  }
  previousCoverage: MetadataCoverage
  previousSource: { expectedSha256: string; rows: number; sha256: string }
  publicationTypeConflict41347323: {
    canonical: string[]
    canonicalAtPr69: readonly string[]
    canonicalMatchesPr69: boolean
    canonicalOnlyAtPr69: readonly string[]
    pmid: string
    previousRaw: string | null
    pubmedAtPr69: readonly string[]
    reference: string
  } | null
  titleDifferences: { count: number; rows: TitleDifference[] }
}

export interface GoldEnrichmentBuild {
  csv: string
  outputSha256: string
  physicianFieldSha256: string
  rows: GoldEnrichmentSourceRow[]
}

export interface GoldEnrichmentReceipt {
  formatVersion: '1.0.0'
  operation: 'development_only_canonical_enrichment_source_export'
  batch: {
    id: string
    name: string
    datasetSplit: 'development'
    rows: number
  }
  sources: {
    canonicalDatabase: {
      stateSha256After: string
      stateSha256Before: string
      unchangedDuringExport: true
    }
    physicianReviews: {
      expectedSha256: string
      rows: number
      sha256: string
      unchangedDuringExport: true
    }
    previousEnrichmentExport: null | {
      expectedSha256: string
      rows: number
      sha256: string
      unchangedDuringExport: true
    }
  }
  output: {
    bytes: number
    columns: readonly GoldEnrichmentSourceColumn[]
    rows: number
    sha256: string
  }
  physicianFieldIntegrity: {
    columns: readonly PhysicianHashColumn[]
    expectedSha256: string
    inputSha256: string
    outputSha256: string
    unchanged: true
  }
  fieldCoverage: MetadataCoverage
  fidelityAudit: FidelityAudit | null
  conflicts: {
    knownPublicationTypeConflict: FidelityAudit['publicationTypeConflict41347323']
    nonblankPriorMetadataDifferences: MetadataConflict[]
  }
  safety: {
    databaseMutationOperations: readonly []
    developmentOnly: true
    externalQaSuggestionsApplied: false
    heldOutTestAccessed: false
    metadataRepairApplied: false
    mutationPlan: null
    physicianDecisionsChanged: false
    taxonomyChanged: false
  }
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right, 'en-US'))
        .map(([key, child]) => [key, stableJsonValue(child)]),
    )
  }
  return value
}

export function stableEnrichmentJson(value: unknown) {
  return JSON.stringify(stableJsonValue(value))
}

function countValues(values: Iterable<string>) {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return Object.fromEntries(
    [...counts].sort(([left], [right]) => left.localeCompare(right, 'en-US')),
  )
}

function validateSha256(value: string, label: string) {
  if (!/^[a-f0-9]{64}$/u.test(value)) throw new Error(`${label} must be a lowercase SHA-256.`)
}

function exactCsvRecords<Column extends string>(
  input: string,
  label: string,
  expectedColumns: readonly Column[],
): Record<Column, string>[] {
  const parsed = parseCsvRows(input.startsWith('\uFEFF') ? input.slice(1) : input)
  if (parsed.length === 0) throw new Error(`${label} is empty.`)
  const actualColumns = parsed[0]
  if (
    actualColumns.length !== expectedColumns.length ||
    actualColumns.some((column, index) => column !== expectedColumns[index])
  ) {
    throw new Error(
      `${label} header must exactly match the required ${expectedColumns.length}-column schema.`,
    )
  }
  return parsed.slice(1).map((values, index) => {
    if (values.length !== expectedColumns.length) {
      throw new Error(
        `${label} CSV record ${index + 2} has ${values.length} columns; expected ${expectedColumns.length}.`,
      )
    }
    return Object.fromEntries(
      expectedColumns.map((column, columnIndex) => [column, values[columnIndex]]),
    ) as Record<Column, string>
  })
}

function positiveDecimal(value: string, label: string, recordNumber: number) {
  if (!/^[1-9]\d*$/u.test(value)) {
    throw new Error(`${label} at CSV record ${recordNumber} must be a positive decimal.`)
  }
}

function assertExactCounts(
  actual: Record<string, number>,
  expected: Record<string, number>,
  label: string,
) {
  if (stableEnrichmentJson(actual) !== stableEnrichmentJson(expected)) {
    throw new Error(
      `${label} counts do not match the checksum-bound contract. Expected ${stableEnrichmentJson(
        expected,
      )}; received ${stableEnrichmentJson(actual)}.`,
    )
  }
}

export function physicianFieldSha256(
  rows: readonly Record<'master_row_id' | 'pmid' | PhysicianFieldColumn, string>[],
) {
  const ordered = [...rows].sort(
    (left, right) => Number(left.master_row_id) - Number(right.master_row_id),
  )
  return sha256(
    `${JSON.stringify({
      columns: PHYSICIAN_HASH_COLUMNS,
      rows: ordered.map((row) => PHYSICIAN_HASH_COLUMNS.map((column) => row[column])),
    })}\n`,
  )
}

export function parsePhysicianRelevanceCsv(
  input: string,
  contract: PhysicianRelevanceContract = CANONICAL_PHYSICIAN_RELEVANCE_CONTRACT,
): ParsedPhysicianRelevance {
  validateSha256(contract.sourceSha256, 'Physician source contract SHA-256')
  validateSha256(contract.physicianFieldSha256, 'Physician-field contract SHA-256')
  const sourceSha256 = sha256(input)
  if (sourceSha256 !== contract.sourceSha256) {
    throw new Error(
      `Physician relevance source checksum mismatch: expected ${contract.sourceSha256}, received ${sourceSha256}.`,
    )
  }

  const records = exactCsvRecords(input, 'Physician relevance source', PHYSICIAN_RELEVANCE_COLUMNS)
  if (records.length !== contract.expectedRows) {
    throw new Error(
      `Physician relevance source must contain exactly ${contract.expectedRows} rows; received ${records.length}.`,
    )
  }

  const rows = records.map((record, index): PhysicianRelevanceRow => {
    const csvRecordNumber = index + 2
    positiveDecimal(record.master_row_id, 'master_row_id', csvRecordNumber)
    positiveDecimal(record.source_row_id, 'source_row_id', csvRecordNumber)
    positiveDecimal(record.pmid, 'PMID', csvRecordNumber)
    if (!record.screening_batch.trim()) {
      throw new Error(`screening_batch at CSV record ${csvRecordNumber} must not be blank.`)
    }
    if (
      !['include_core', 'include_adjacent', 'exclude', 'uncertain'].includes(
        record.physician_final_label,
      )
    ) {
      throw new Error(`Invalid physician relevance label at CSV record ${csvRecordNumber}.`)
    }
    if (!['high', 'moderate', 'low'].includes(record.physician_final_confidence)) {
      throw new Error(`Invalid physician confidence at CSV record ${csvRecordNumber}.`)
    }
    if (!['accept', 'modify'].includes(record.physician_accept_or_modify)) {
      throw new Error(`Invalid physician accept/modify value at CSV record ${csvRecordNumber}.`)
    }
    if (record.physician_reviewed !== 'True' || record.relevance_review_complete !== 'True') {
      throw new Error(`Physician relevance is incomplete at CSV record ${csvRecordNumber}.`)
    }
    if (record.decision_provenance !== contract.decisionProvenance) {
      throw new Error(`Invalid decision provenance at CSV record ${csvRecordNumber}.`)
    }
    if (record.is_blinded !== 'False') {
      throw new Error(
        `Final physician relevance must be unblinded at CSV record ${csvRecordNumber}.`,
      )
    }
    return { ...record, csvRecordNumber }
  })

  const byPmid = new Map<string, PhysicianRelevanceRow>()
  const masterRowIds = new Map<string, number>()
  for (const row of rows) {
    const duplicate = byPmid.get(row.pmid)
    if (duplicate) {
      throw new Error(
        `Physician relevance PMID ${row.pmid} at CSV record ${row.csvRecordNumber} duplicates record ${duplicate.csvRecordNumber}.`,
      )
    }
    const duplicateMaster = masterRowIds.get(row.master_row_id)
    if (duplicateMaster) {
      throw new Error(
        `Physician relevance master_row_id ${row.master_row_id} at CSV record ${row.csvRecordNumber} duplicates record ${duplicateMaster}.`,
      )
    }
    byPmid.set(row.pmid, row)
    masterRowIds.set(row.master_row_id, row.csvRecordNumber)
  }

  const observedLabelCounts = countValues(rows.map((row) => row.physician_final_label))
  const labelCounts = Object.fromEntries(
    ['exclude', 'include_adjacent', 'include_core', 'uncertain'].map((label) => [
      label,
      observedLabelCounts[label] ?? 0,
    ]),
  )
  const observedConfidenceCounts = countValues(rows.map((row) => row.physician_final_confidence))
  const confidenceCounts = Object.fromEntries(
    ['high', 'low', 'moderate'].map((confidence) => [
      confidence,
      observedConfidenceCounts[confidence] ?? 0,
    ]),
  )
  const provenanceCounts = countValues(rows.map((row) => row.decision_provenance))
  assertExactCounts(labelCounts, contract.labelCounts, 'Physician relevance label')
  assertExactCounts(confidenceCounts, contract.confidenceCounts, 'Physician confidence')
  assertExactCounts(
    provenanceCounts,
    { [contract.decisionProvenance]: contract.expectedRows },
    'Physician provenance',
  )

  const actualPhysicianFieldSha256 = physicianFieldSha256(rows)
  if (actualPhysicianFieldSha256 !== contract.physicianFieldSha256) {
    throw new Error(
      `Physician-field checksum mismatch: expected ${contract.physicianFieldSha256}, received ${actualPhysicianFieldSha256}.`,
    )
  }

  return {
    byPmid,
    expectedPhysicianFieldSha256: contract.physicianFieldSha256,
    expectedSourceSha256: contract.sourceSha256,
    physicianFieldSha256: actualPhysicianFieldSha256,
    rows,
    sourceSha256,
    summaries: { confidenceCounts, labelCounts, provenanceCounts },
  }
}

function requiredText(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must not be blank.`)
  return value
}

function nullableText(value: unknown, label: string) {
  if (value === null) return null
  if (typeof value !== 'string') throw new Error(`${label} must be text or null.`)
  return value
}

function stringArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} must be a text array.`)
  }
  return [...value] as string[]
}

function normalizedItem(row: RawGoldSetItem): GoldEnrichmentDevelopmentItem {
  const id = requiredText(row.id, 'Gold-set item id')
  const pmid = requiredText(row.pmid, `Gold-set item ${id} PMID`)
  if (!/^\d{1,12}$/u.test(pmid)) throw new Error(`Gold-set item ${id} has invalid PMID ${pmid}.`)
  if (row.dataset_split !== GOLD_ENRICHMENT_DATASET_SPLIT) {
    throw new Error(
      `Held-out/test/all access is forbidden; item ${id} used dataset split ${String(row.dataset_split)}.`,
    )
  }
  const displayOrder = Number(row.display_order)
  if (!Number.isSafeInteger(displayOrder) || displayOrder < 1) {
    throw new Error(`Gold-set item ${id} has invalid display order.`)
  }
  return { datasetSplit: GOLD_ENRICHMENT_DATASET_SPLIT, displayOrder, id, pmid }
}

function normalizedArticle(row: RawArticle): GoldEnrichmentArticle {
  const pmid = requiredText(row.pmid, 'Article PMID')
  const publicationYear = row.publication_year === null ? null : Number(row.publication_year)
  if (
    publicationYear !== null &&
    (!Number.isSafeInteger(publicationYear) || publicationYear < 1800 || publicationYear > 3000)
  ) {
    throw new Error(`Article ${pmid} has invalid publication year.`)
  }
  if (!Array.isArray(row.authors)) throw new Error(`Article ${pmid} authors must be a JSON array.`)
  return {
    abstract: nullableText(row.abstract, `Article ${pmid} abstract`),
    authorKeywords: stringArray(row.author_keywords, `Article ${pmid} author keywords`),
    authors: [...row.authors],
    journalAbbreviation: nullableText(
      row.journal_abbreviation,
      `Article ${pmid} journal abbreviation`,
    ),
    journalTitle: nullableText(row.journal_title, `Article ${pmid} journal title`),
    languages: stringArray(row.languages, `Article ${pmid} languages`),
    meshTerms: stringArray(row.mesh_terms, `Article ${pmid} MeSH terms`),
    pmid,
    publicationTypes: stringArray(row.publication_types, `Article ${pmid} publication types`),
    publicationYear,
    title: requiredText(row.title, `Article ${pmid} title`),
  }
}

function chunks<T>(values: readonly T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

export async function loadCanonicalDevelopmentSnapshot(
  client: SupabaseClient,
): Promise<CanonicalDevelopmentSnapshot> {
  const batches = await executeDatabaseCall<Array<{ id: string; name: string }>>(
    'gold-set-v1 exact batch lookup',
    () =>
      client
        .from('literature_gold_set_batches')
        .select('id,name')
        .eq('id', GOLD_ENRICHMENT_BATCH_ID)
        .eq('name', GOLD_ENRICHMENT_BATCH_NAME)
        .limit(2),
  )
  if (!batches || batches.length !== 1) {
    throw new Error(
      `Expected exactly one ${GOLD_ENRICHMENT_BATCH_NAME} batch with id ${GOLD_ENRICHMENT_BATCH_ID}.`,
    )
  }

  const rawItems: RawGoldSetItem[] = []
  for (let start = 0; start < GOLD_ENRICHMENT_DEVELOPMENT_ROWS; start += 1_000) {
    const page = await executeDatabaseCall<RawGoldSetItem[]>(
      `gold-set-v1 development membership page ${start / 1_000 + 1}`,
      () =>
        client
          .from('literature_gold_set_items')
          .select('id,pmid,dataset_split,display_order')
          .eq('batch_id', GOLD_ENRICHMENT_BATCH_ID)
          .eq('dataset_split', GOLD_ENRICHMENT_DATASET_SPLIT)
          .order('display_order', { ascending: true })
          .range(start, start + 999),
    )
    rawItems.push(...(page ?? []))
    if ((page?.length ?? 0) < 1_000) break
  }
  if (rawItems.length !== GOLD_ENRICHMENT_DEVELOPMENT_ROWS) {
    throw new Error(
      `Expected exactly ${GOLD_ENRICHMENT_DEVELOPMENT_ROWS} development items; received ${rawItems.length}.`,
    )
  }
  const items = rawItems.map(normalizedItem)
  const itemPmids = new Set(items.map((item) => item.pmid))
  if (itemPmids.size !== items.length)
    throw new Error('Development membership contains duplicate PMIDs.')
  for (let index = 1; index < items.length; index += 1) {
    if (items[index].displayOrder <= items[index - 1].displayOrder) {
      throw new Error('Development display order must be strictly increasing and unique.')
    }
  }

  const rawArticles: RawArticle[] = []
  for (const pmidChunk of chunks(
    items.map((item) => item.pmid),
    200,
  )) {
    const articlePage = await executeDatabaseCall<RawArticle[]>(
      'canonical development article metadata',
      () =>
        client
          .from('literature_articles')
          .select(GOLD_ENRICHMENT_ARTICLE_SELECT)
          .in('pmid', pmidChunk) as unknown as PromiseLike<{
          data: RawArticle[] | null
          error: { code?: string; message: string } | null
        }>,
    )
    rawArticles.push(...(articlePage ?? []))
  }
  const articleByPmid = new Map<string, GoldEnrichmentArticle>()
  for (const rawArticle of rawArticles) {
    const article = normalizedArticle(rawArticle)
    if (articleByPmid.has(article.pmid)) {
      throw new Error(`Canonical article query returned duplicate PMID ${article.pmid}.`)
    }
    if (!itemPmids.has(article.pmid)) {
      throw new Error(`Canonical article query returned out-of-scope PMID ${article.pmid}.`)
    }
    articleByPmid.set(article.pmid, article)
  }
  const missing = items.filter((item) => !articleByPmid.has(item.pmid)).map((item) => item.pmid)
  if (missing.length > 0) {
    throw new Error(`Canonical metadata is missing ${missing.length} development PMIDs.`)
  }

  return {
    articles: items.map((item) => articleByPmid.get(item.pmid)!),
    batch: { id: batches[0].id, name: batches[0].name },
    datasetSplit: GOLD_ENRICHMENT_DATASET_SPLIT,
    items,
  }
}

export function canonicalDatabaseStateSha256(snapshot: CanonicalDevelopmentSnapshot) {
  return sha256(
    `${stableEnrichmentJson({
      articles: snapshot.articles,
      batch: snapshot.batch,
      datasetSplit: snapshot.datasetSplit,
      items: snapshot.items,
    })}\n`,
  )
}

export function assertPhysicianMembershipAndOrder(
  snapshot: CanonicalDevelopmentSnapshot,
  reviews: ParsedPhysicianRelevance,
) {
  if (snapshot.datasetSplit !== GOLD_ENRICHMENT_DATASET_SPLIT) {
    throw new Error('Only the development split may be exported.')
  }
  if (
    snapshot.batch.id !== GOLD_ENRICHMENT_BATCH_ID ||
    snapshot.batch.name !== GOLD_ENRICHMENT_BATCH_NAME
  ) {
    throw new Error('Canonical snapshot does not use the checksum-bound gold-set-v1 batch.')
  }
  if (snapshot.items.length !== reviews.rows.length) {
    throw new Error(
      `Physician membership mismatch: database has ${snapshot.items.length} rows and source has ${reviews.rows.length}.`,
    )
  }

  const databasePmids = new Set(snapshot.items.map((item) => item.pmid))
  const sourcePmids = new Set(reviews.rows.map((row) => row.pmid))
  const missing = snapshot.items
    .filter((item) => !sourcePmids.has(item.pmid))
    .map((item) => item.pmid)
  const unexpected = reviews.rows
    .filter((row) => !databasePmids.has(row.pmid))
    .map((row) => row.pmid)
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `Physician source must exactly match development membership (missing ${missing.length}, unexpected ${unexpected.length}).`,
    )
  }

  const orderMismatch = snapshot.items.findIndex(
    (item, index) => item.pmid !== reviews.rows[index]?.pmid,
  )
  if (orderMismatch >= 0) {
    throw new Error(
      `Physician source PMID order mismatch at row ${orderMismatch + 1}: expected ${snapshot.items[orderMismatch].pmid}, received ${reviews.rows[orderMismatch]?.pmid}.`,
    )
  }
}

function assertWellFormedUnicode(value: string, label: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new Error(`${label} contains an unpaired high surrogate.`)
      }
      index += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error(`${label} contains an unpaired low surrogate.`)
    }
  }
}

function csvCell(value: string) {
  assertWellFormedUnicode(value, 'Enrichment-source CSV value')
  return `"${value.replaceAll('"', '""')}"`
}

export function serializeGoldEnrichmentSource(rows: readonly GoldEnrichmentSourceRow[]) {
  const lines = [GOLD_ENRICHMENT_SOURCE_COLUMNS.map(csvCell).join(',')]
  for (const row of rows) {
    lines.push(GOLD_ENRICHMENT_SOURCE_COLUMNS.map((column) => csvCell(row[column])).join(','))
  }
  const serialized = `${lines.join('\r\n')}\r\n`
  assertWellFormedUnicode(serialized, 'Enrichment-source CSV')
  const encoded = Buffer.from(serialized, 'utf8')
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(encoded)
  if (decoded !== serialized) throw new Error('UTF-8 export round trip changed canonical text.')
  return serialized
}

export function buildGoldEnrichmentSource(
  snapshot: CanonicalDevelopmentSnapshot,
  reviews: ParsedPhysicianRelevance,
): GoldEnrichmentBuild {
  assertPhysicianMembershipAndOrder(snapshot, reviews)
  const articleByPmid = new Map(snapshot.articles.map((article) => [article.pmid, article]))
  const rows = snapshot.items.map((item, index): GoldEnrichmentSourceRow => {
    const article = articleByPmid.get(item.pmid)
    const review = reviews.rows[index]
    if (!article) throw new Error(`Missing canonical article ${item.pmid}.`)
    if (!review || review.pmid !== item.pmid) throw new Error(`Missing physician row ${item.pmid}.`)
    if (!populated(article.publicationTypes)) {
      throw new Error(`Canonical article ${item.pmid} has no publication type.`)
    }
    if (!populated(article.languages)) {
      throw new Error(`Canonical article ${item.pmid} has no language.`)
    }
    return {
      batch_id: snapshot.batch.id,
      batch_name: snapshot.batch.name,
      dataset_split: snapshot.datasetSplit,
      gold_set_item_id: item.id,
      display_order: String(item.displayOrder),
      master_row_id: review.master_row_id,
      screening_batch: review.screening_batch,
      source_row_id: review.source_row_id,
      pmid: item.pmid,
      title: article.title,
      abstract: article.abstract ?? '',
      authors_json: stableEnrichmentJson(article.authors),
      journal: article.journalTitle ?? article.journalAbbreviation ?? '',
      journal_abbreviation: article.journalAbbreviation ?? '',
      publication_year: article.publicationYear === null ? '' : String(article.publicationYear),
      publication_types_json: stableEnrichmentJson(article.publicationTypes),
      mesh_terms_json: stableEnrichmentJson(article.meshTerms),
      author_keywords_json: stableEnrichmentJson(article.authorKeywords),
      languages_json: stableEnrichmentJson(article.languages),
      no_abstract: article.abstract?.trim() ? 'False' : 'True',
      protected_procedural_cue: review.protected_procedural_cue,
      first_pass_label: review.first_pass_label,
      first_pass_confidence: review.first_pass_confidence,
      first_pass_requires_human_review: review.first_pass_requires_human_review,
      first_pass_rationale: review.first_pass_rationale,
      second_pass_label: review.second_pass_label,
      second_pass_confidence: review.second_pass_confidence,
      second_pass_requires_human_review: review.second_pass_requires_human_review,
      second_pass_rationale: review.second_pass_rationale,
      two_pass_status: review.two_pass_status,
      provisional_label: review.provisional_label,
      triage_lane: review.triage_lane,
      triage_reason: review.triage_reason,
      physician_final_label: review.physician_final_label,
      physician_final_confidence: review.physician_final_confidence,
      physician_accept_or_modify: review.physician_accept_or_modify,
      physician_notes: review.physician_notes,
      physician_reviewed: review.physician_reviewed,
      decision_provenance: review.decision_provenance,
      is_blinded: review.is_blinded,
      relevance_review_complete: review.relevance_review_complete,
      enrichment_status: review.enrichment_status,
      database_import_ready: review.database_import_ready,
    }
  })
  const outputPhysicianFieldSha256 = physicianFieldSha256(rows)
  if (outputPhysicianFieldSha256 !== reviews.physicianFieldSha256) {
    throw new Error('Physician-field checksum changed during the canonical metadata join.')
  }
  const csv = serializeGoldEnrichmentSource(rows)
  return {
    csv,
    outputSha256: sha256(csv),
    physicianFieldSha256: outputPhysicianFieldSha256,
    rows,
  }
}

function populated(values: readonly string[]) {
  return values.some((value) => value.trim())
}

function coverageFromArticles(articles: readonly GoldEnrichmentArticle[]): MetadataCoverage {
  const field = (select: (article: GoldEnrichmentArticle) => string[]) => {
    const populatedCount = articles.filter((article) => populated(select(article))).length
    return { blank: articles.length - populatedCount, populated: populatedCount }
  }
  return {
    authorKeywords: field((article) => article.authorKeywords),
    languages: field((article) => article.languages),
    meshTerms: field((article) => article.meshTerms),
    publicationTypes: field((article) => article.publicationTypes),
  }
}

function coverageFromPrevious(rows: readonly V2SourceRow[]): MetadataCoverage {
  const field = (select: (row: V2SourceRow) => string) => {
    const populatedCount = rows.filter((row) => select(row).trim()).length
    return { blank: rows.length - populatedCount, populated: populatedCount }
  }
  return {
    authorKeywords: field((row) => row.author_keywords),
    languages: field((row) => row.language),
    meshTerms: field((row) => row.mesh),
    publicationTypes: field((row) => row.publication_types),
  }
}

function textDifference(pmid: string, previous: string, canonical: string): TextDifference {
  return {
    canonicalLength: canonical.length,
    canonicalSha256: sha256(canonical),
    pmid,
    previousLength: previous.length,
    previousSha256: sha256(previous),
  }
}

function parseLegacyList(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) return parsed
    } catch {
      // The raw value is still preserved in the conflict report below.
    }
  }
  return trimmed
    .split(/\s*(?:\||;)\s*/u)
    .map((item) => item.trim())
    .filter(Boolean)
}

function unorderedStringArraysEqual(left: readonly string[], right: readonly string[]) {
  const ordered = (values: readonly string[]) =>
    [...values].sort((a, b) => a.localeCompare(b, 'en-US'))
  return JSON.stringify(ordered(left)) === JSON.stringify(ordered(right))
}

export function buildFidelityAudit(
  snapshot: CanonicalDevelopmentSnapshot,
  reviews: ParsedPhysicianRelevance,
  previousCsv: string,
  expectedPreviousSha256 = CANONICAL_V2_SOURCE_SHA256,
): FidelityAudit {
  validateSha256(expectedPreviousSha256, 'Previous enrichment source expected SHA-256')
  const previousSha256 = sha256(previousCsv)
  if (previousSha256 !== expectedPreviousSha256) {
    throw new Error(
      `Previous enrichment source checksum mismatch: expected ${expectedPreviousSha256}, received ${previousSha256}.`,
    )
  }
  const previous = parseV2SourceCsv(previousCsv)
  const canonicalPmids = snapshot.items.map((item) => item.pmid)
  const previousPmids = previous.rows.map((row) => row.pmid)
  const canonicalPmidSet = new Set(canonicalPmids)
  const previousPmidSet = new Set(previousPmids)
  const missingFromPrevious = canonicalPmids.filter((pmid) => !previousPmidSet.has(pmid))
  const unexpectedInPrevious = previousPmids.filter((pmid) => !canonicalPmidSet.has(pmid))
  const orderMismatches = canonicalPmids.flatMap((pmid, index) =>
    previousPmids[index] === pmid
      ? []
      : [{ canonicalPmid: pmid, index: index + 1, previousPmid: previousPmids[index] ?? '' }],
  )

  const articleByPmid = new Map(snapshot.articles.map((article) => [article.pmid, article]))
  const previousByPmid = new Map(previous.rows.map((row) => [row.pmid, row]))
  const titleDifferences: TitleDifference[] = []
  const abstractDifferences: TextDifference[] = []
  const physicianFieldMismatches: FidelityAudit['physicianFieldMismatches'] = []
  const nonblankMetadataConflicts: MetadataConflict[] = []

  for (const pmid of canonicalPmids) {
    const article = articleByPmid.get(pmid)!
    const prior = previousByPmid.get(pmid)
    const review = reviews.byPmid.get(pmid)!
    if (!prior) continue
    if (prior.title !== article.title) {
      titleDifferences.push({
        ...textDifference(pmid, prior.title, article.title),
        canonical: article.title,
        previous: prior.title,
      })
    }
    const canonicalAbstract = article.abstract ?? ''
    if (prior.abstract !== canonicalAbstract) {
      abstractDifferences.push(textDifference(pmid, prior.abstract, canonicalAbstract))
    }
    for (const field of [
      'master_row_id',
      'physician_final_label',
      'physician_final_confidence',
    ] as const) {
      const expected = review[field]
      const actual = prior[field]
      if (expected !== actual) physicianFieldMismatches.push({ actual, expected, field, pmid })
    }

    const metadata: Array<{
      canonical: string[]
      field: MetadataConflict['field']
      previousRaw: string
    }> = [
      { canonical: article.meshTerms, field: 'meshTerms', previousRaw: prior.mesh },
      {
        canonical: article.authorKeywords,
        field: 'authorKeywords',
        previousRaw: prior.author_keywords,
      },
      {
        canonical: article.publicationTypes,
        field: 'publicationTypes',
        previousRaw: prior.publication_types,
      },
      { canonical: article.languages, field: 'languages', previousRaw: prior.language },
    ]
    for (const candidate of metadata) {
      if (
        candidate.previousRaw.trim() &&
        !unorderedStringArraysEqual(parseLegacyList(candidate.previousRaw), candidate.canonical)
      ) {
        nonblankMetadataConflicts.push({ pmid, ...candidate })
      }
    }
  }

  const canonicalInvalidLanguages = snapshot.articles.flatMap((article) =>
    article.languages.flatMap((value) =>
      validateLiteratureLanguage(value).valid ? [] : [{ pmid: article.pmid, value }],
    ),
  )
  const previousInvalidLanguages = previous.rows.flatMap((row) =>
    parseLegacyList(row.language).flatMap((value) =>
      validateLiteratureLanguage(value).valid ? [] : [{ pmid: row.pmid, value }],
    ),
  )

  const conflictArticle = articleByPmid.get(PR69_PUBLICATION_TYPE_CONFLICT.pmid)
  const conflictPrevious = previousByPmid.get(PR69_PUBLICATION_TYPE_CONFLICT.pmid)
  const publicationTypeConflict41347323 = conflictArticle
    ? {
        canonical: [...conflictArticle.publicationTypes],
        canonicalAtPr69: PR69_PUBLICATION_TYPE_CONFLICT.canonicalAtPr69,
        canonicalMatchesPr69: unorderedStringArraysEqual(
          conflictArticle.publicationTypes,
          PR69_PUBLICATION_TYPE_CONFLICT.canonicalAtPr69,
        ),
        canonicalOnlyAtPr69: PR69_PUBLICATION_TYPE_CONFLICT.canonicalOnly,
        pmid: PR69_PUBLICATION_TYPE_CONFLICT.pmid,
        previousRaw: conflictPrevious?.publication_types ?? null,
        pubmedAtPr69: PR69_PUBLICATION_TYPE_CONFLICT.pubmedAtPr69,
        reference: PR69_PUBLICATION_TYPE_CONFLICT.reference,
      }
    : null

  return {
    abstractDifferences: { count: abstractDifferences.length, rows: abstractDifferences },
    canonicalCoverage: coverageFromArticles(snapshot.articles),
    invalidLanguages: {
      canonical: canonicalInvalidLanguages,
      previous: previousInvalidLanguages,
    },
    nonblankMetadataConflicts,
    physicianFieldMismatches,
    pmidAndOrder: {
      exactMembership: missingFromPrevious.length === 0 && unexpectedInPrevious.length === 0,
      exactOrder: orderMismatches.length === 0,
      missingFromPrevious,
      orderMismatches,
      unexpectedInPrevious,
    },
    previousCoverage: coverageFromPrevious(previous.rows),
    previousSource: {
      expectedSha256: expectedPreviousSha256,
      rows: previous.rows.length,
      sha256: previousSha256,
    },
    publicationTypeConflict41347323,
    titleDifferences: { count: titleDifferences.length, rows: titleDifferences },
  }
}

export function buildGoldEnrichmentReceipt(options: {
  build: GoldEnrichmentBuild
  databaseStateSha256After: string
  databaseStateSha256Before: string
  fidelityAudit: FidelityAudit | null
  physicianReviews: ParsedPhysicianRelevance
  snapshot: CanonicalDevelopmentSnapshot
}): GoldEnrichmentReceipt {
  const {
    build,
    databaseStateSha256After,
    databaseStateSha256Before,
    fidelityAudit,
    physicianReviews,
    snapshot,
  } = options
  validateSha256(databaseStateSha256Before, 'Database-state SHA-256 before export')
  validateSha256(databaseStateSha256After, 'Database-state SHA-256 after export')
  if (databaseStateSha256Before !== databaseStateSha256After) {
    throw new Error('Canonical database state changed during export; refusing to write artifacts.')
  }
  if (build.physicianFieldSha256 !== physicianReviews.physicianFieldSha256) {
    throw new Error('Physician fields changed while building the receipt.')
  }

  return {
    formatVersion: '1.0.0',
    operation: 'development_only_canonical_enrichment_source_export',
    batch: {
      id: snapshot.batch.id,
      name: snapshot.batch.name,
      datasetSplit: GOLD_ENRICHMENT_DATASET_SPLIT,
      rows: snapshot.items.length,
    },
    sources: {
      canonicalDatabase: {
        stateSha256After: databaseStateSha256After,
        stateSha256Before: databaseStateSha256Before,
        unchangedDuringExport: true,
      },
      physicianReviews: {
        expectedSha256: physicianReviews.expectedSourceSha256,
        rows: physicianReviews.rows.length,
        sha256: physicianReviews.sourceSha256,
        unchangedDuringExport: true,
      },
      previousEnrichmentExport: fidelityAudit
        ? {
            expectedSha256: fidelityAudit.previousSource.expectedSha256,
            rows: fidelityAudit.previousSource.rows,
            sha256: fidelityAudit.previousSource.sha256,
            unchangedDuringExport: true,
          }
        : null,
    },
    output: {
      bytes: Buffer.byteLength(build.csv, 'utf8'),
      columns: GOLD_ENRICHMENT_SOURCE_COLUMNS,
      rows: build.rows.length,
      sha256: build.outputSha256,
    },
    physicianFieldIntegrity: {
      columns: PHYSICIAN_HASH_COLUMNS,
      expectedSha256: physicianReviews.expectedPhysicianFieldSha256,
      inputSha256: physicianReviews.physicianFieldSha256,
      outputSha256: build.physicianFieldSha256,
      unchanged: true,
    },
    fieldCoverage: coverageFromArticles(snapshot.articles),
    fidelityAudit,
    conflicts: {
      knownPublicationTypeConflict: fidelityAudit?.publicationTypeConflict41347323 ?? null,
      nonblankPriorMetadataDifferences: fidelityAudit?.nonblankMetadataConflicts ?? [],
    },
    safety: {
      databaseMutationOperations: [],
      developmentOnly: true,
      externalQaSuggestionsApplied: false,
      heldOutTestAccessed: false,
      metadataRepairApplied: false,
      mutationPlan: null,
      physicianDecisionsChanged: false,
      taxonomyChanged: false,
    },
  }
}

export function serializeGoldEnrichmentReceipt(receipt: GoldEnrichmentReceipt) {
  const serialized = `${JSON.stringify(receipt, null, 2)}\n`
  assertWellFormedUnicode(serialized, 'Enrichment-source receipt')
  return serialized
}
