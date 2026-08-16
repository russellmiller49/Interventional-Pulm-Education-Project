import { canonicalJson } from './canonical'
import { ARTICLE_SELECT_COLUMNS, MAPPING_VERSION } from './constants'
import type {
  DestinationArticleRow,
  IngestMode,
  PreparedRecord,
  SourceArticleRow,
  SourceEnvelope,
  SourceJournalRow,
} from './types'

export const SOURCE_PROVENANCE_FILENAME =
  'supabase_db_ip-literature-local/postgres/public.literature_articles' as const

const APPROVED_ARTICLE_KEYS: ReadonlySet<string> = new Set(ARTICLE_SELECT_COLUMNS)
const FORBIDDEN_SOURCE_ARTICLE_KEYS = new Set([
  'relevance_state',
  'visibility_state',
  'manual_override',
  'is_landmark',
  'curation_reason',
  'classifier_version',
  'classifier_payload',
  'search_vector',
  'created_at',
  'updated_at',
])

const ABSTRACT_DISPLAY_POLICIES = new Set(['hidden', 'snippet_only', 'full_allowed'])
const PUBLICATION_DATE_PRECISIONS = new Set(['day', 'month', 'year', 'season', 'unknown'])
const JOURNAL_SOURCE_TIERS = new Set([
  'core',
  'optional_core_continuity',
  'expanded',
  'core_historical_gap',
  'core_non_pubmed',
  'other',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be a JSON object.`)
}

function assertNullableString(value: unknown, label: string): asserts value is string | null {
  if (value !== null && typeof value !== 'string') {
    throw new Error(`${label} must be a string or null.`)
  }
}

function assertStringArray(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${label} must be an array of strings.`)
  }
}

function assertIntegerOrNull(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): asserts value is number | null {
  if (
    value !== null &&
    (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum)
  ) {
    throw new Error(`${label} must be null or an integer from ${minimum} through ${maximum}.`)
  }
}

function assertBoolean(value: unknown, label: string): asserts value is boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean.`)
}

function assertRawNbibTags(value: unknown): asserts value is Record<string, string[]> {
  assertRecord(value, 'article.raw_nbib_tags')
  for (const [tag, entries] of Object.entries(value)) {
    if (!tag || !Array.isArray(entries) || entries.some((entry) => typeof entry !== 'string')) {
      throw new Error('article.raw_nbib_tags must map nonempty tags to string arrays.')
    }
  }
}

function validateArticle(article: unknown): asserts article is SourceArticleRow {
  assertRecord(article, 'article')

  for (const key of Object.keys(article)) {
    if (FORBIDDEN_SOURCE_ARTICLE_KEYS.has(key)) {
      throw new Error(`Source projection included forbidden article field ${key}.`)
    }
    if (!APPROVED_ARTICLE_KEYS.has(key)) {
      throw new Error(`Source projection included unapproved article field ${key}.`)
    }
  }
  for (const key of ARTICLE_SELECT_COLUMNS) {
    if (!Object.hasOwn(article, key)) {
      throw new Error(`Source projection omitted required article field ${key}.`)
    }
  }

  if (typeof article.pmid !== 'string' || !/^[0-9]{1,12}$/u.test(article.pmid)) {
    throw new Error('article.pmid must be a numeric PMID of 1 through 12 digits.')
  }
  if (
    typeof article.title !== 'string' ||
    article.title.trim().length === 0 ||
    article.title.length > 50_000
  ) {
    throw new Error('article.title must be nonblank and no longer than 50000 characters.')
  }
  if (
    article.abstract !== null &&
    (typeof article.abstract !== 'string' || article.abstract.length > 2_000_000)
  ) {
    throw new Error('article.abstract must be null or no longer than 2000000 characters.')
  }

  for (const [key, value] of Object.entries(article)) {
    if (
      [
        'doi',
        'pmcid',
        'journal_id',
        'journal_title',
        'journal_abbreviation',
        'nlm_journal_id',
        'publication_date_raw',
        'volume',
        'issue',
        'pages',
        'article_number',
        'place_of_publication',
        'citation_source',
        'conflict_of_interest',
        'pubmed_status',
        'pubmed_last_revised_at',
        'pubmed_created_at',
      ].includes(key)
    ) {
      assertNullableString(value, `article.${key}`)
    }
  }

  if (
    typeof article.abstract_display_policy !== 'string' ||
    !ABSTRACT_DISPLAY_POLICIES.has(article.abstract_display_policy)
  ) {
    throw new Error('article.abstract_display_policy is invalid.')
  }
  if (
    typeof article.publication_date_precision !== 'string' ||
    !PUBLICATION_DATE_PRECISIONS.has(article.publication_date_precision)
  ) {
    throw new Error('article.publication_date_precision is invalid.')
  }

  assertIntegerOrNull(article.publication_year, 'article.publication_year', 1800, 3000)
  assertIntegerOrNull(article.publication_month, 'article.publication_month', 1, 12)
  assertIntegerOrNull(article.publication_day, 'article.publication_day', 1, 31)

  for (const key of [
    'issn_values',
    'publication_types',
    'mesh_terms',
    'author_keywords',
    'languages',
    'collective_authors',
    'affiliations',
  ] as const) {
    assertStringArray(article[key], `article.${key}`)
  }
  if (!Array.isArray(article.authors)) throw new Error('article.authors must be a JSON array.')
  assertRawNbibTags(article.raw_nbib_tags)

  for (const key of ['metadata_hash', 'normalized_title_hash'] as const) {
    if (typeof article[key] !== 'string' || !/^[a-f0-9]{64}$/u.test(article[key])) {
      throw new Error(`article.${key} must be a lowercase SHA-256 digest.`)
    }
  }
  if (typeof article.normalized_title !== 'string') {
    throw new Error('article.normalized_title must be a string.')
  }
  assertBoolean(article.is_retracted, 'article.is_retracted')
  assertBoolean(article.is_correction, 'article.is_correction')
  assertBoolean(article.is_conference_abstract, 'article.is_conference_abstract')
}

function validateJournal(journal: unknown): asserts journal is SourceJournalRow | null {
  if (journal === null) return
  assertRecord(journal, 'journal')
  const expectedKeys = new Set([
    'id',
    'canonical_name',
    'pubmed_abbreviation',
    'nlm_id',
    'issn_print',
    'issn_electronic',
    'aliases',
    'source_tier',
    'active_from',
    'active_to',
    'notes',
    'registry_version',
  ])
  for (const key of Object.keys(journal)) {
    if (!expectedKeys.has(key))
      throw new Error(`Source projection included unapproved journal field ${key}.`)
  }
  for (const key of expectedKeys) {
    if (!Object.hasOwn(journal, key))
      throw new Error(`Source projection omitted journal field ${key}.`)
  }
  if (typeof journal.id !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/u.test(journal.id)) {
    throw new Error('journal.id is invalid.')
  }
  for (const key of ['canonical_name', 'registry_version'] as const) {
    if (typeof journal[key] !== 'string') {
      throw new Error(`journal.${key} must be a string.`)
    }
  }
  if (typeof journal.source_tier !== 'string' || !JOURNAL_SOURCE_TIERS.has(journal.source_tier)) {
    throw new Error('journal.source_tier is invalid.')
  }
  for (const key of [
    'pubmed_abbreviation',
    'nlm_id',
    'issn_print',
    'issn_electronic',
    'notes',
  ] as const) {
    assertNullableString(journal[key], `journal.${key}`)
  }
  assertStringArray(journal.aliases, 'journal.aliases')
  assertIntegerOrNull(journal.active_from, 'journal.active_from', -2_147_483_648, 2_147_483_647)
  assertIntegerOrNull(journal.active_to, 'journal.active_to', -2_147_483_648, 2_147_483_647)
  if (
    journal.active_from !== null &&
    journal.active_to !== null &&
    journal.active_from > journal.active_to
  ) {
    throw new Error('journal.active_from must not be later than journal.active_to.')
  }
}

export function validateSourceEnvelope(envelope: SourceEnvelope): void {
  assertRecord(envelope, 'source envelope')
  const keys = Object.keys(envelope)
  if (keys.length !== 2 || !keys.includes('article') || !keys.includes('journal')) {
    throw new Error('Source envelope must contain exactly article and journal.')
  }
  validateArticle(envelope.article)
  validateJournal(envelope.journal)

  if (envelope.article.journal_id === null && envelope.journal !== null) {
    throw new Error('A journal row was returned for an article without journal_id.')
  }
  if (envelope.article.journal_id !== null) {
    if (envelope.journal === null) {
      throw new Error('An article journal_id has no matching journal row.')
    }
    if (envelope.journal.id !== envelope.article.journal_id) {
      throw new Error('Article and journal identifiers disagree.')
    }
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function mapArticle(source: SourceArticleRow): DestinationArticleRow {
  return {
    pmid: source.pmid,
    doi: source.doi,
    pmcid: source.pmcid,
    title: source.title,
    abstract: source.abstract,
    abstract_display_policy: source.abstract_display_policy,
    journal_id: source.journal_id,
    journal_title: source.journal_title,
    journal_abbreviation: source.journal_abbreviation,
    nlm_journal_id: source.nlm_journal_id,
    issn_values: [...source.issn_values],
    publication_date_raw: source.publication_date_raw,
    publication_year: source.publication_year,
    publication_month: source.publication_month,
    publication_day: source.publication_day,
    publication_date_precision: source.publication_date_precision,
    publication_types: [...source.publication_types],
    mesh_terms: [...source.mesh_terms],
    author_keywords: [...source.author_keywords],
    languages: [...source.languages],
    authors: cloneJson(source.authors),
    collective_authors: [...source.collective_authors],
    affiliations: [...source.affiliations],
    volume: source.volume,
    issue: source.issue,
    pages: source.pages,
    article_number: source.article_number,
    place_of_publication: source.place_of_publication,
    citation_source: source.citation_source,
    conflict_of_interest: source.conflict_of_interest,
    pubmed_status: source.pubmed_status,
    pubmed_last_revised_at: source.pubmed_last_revised_at,
    pubmed_created_at: source.pubmed_created_at,
    raw_nbib_tags: cloneJson(source.raw_nbib_tags),
    metadata_hash: source.metadata_hash,
    normalized_title: source.normalized_title,
    normalized_title_hash: source.normalized_title_hash,
    is_retracted: source.is_retracted,
    is_correction: source.is_correction,
    is_conference_abstract: source.is_conference_abstract,
    relevance_state: 'unreviewed',
    visibility_state: 'draft',
    manual_override: false,
    is_landmark: false,
    curation_reason: null,
    classifier_version: null,
    classifier_payload: null,
  }
}

function mapJournal(source: SourceJournalRow | null): SourceJournalRow | null {
  if (source === null) return null
  return {
    id: source.id,
    canonical_name: source.canonical_name,
    pubmed_abbreviation: source.pubmed_abbreviation,
    nlm_id: source.nlm_id,
    issn_print: source.issn_print,
    issn_electronic: source.issn_electronic,
    aliases: [...source.aliases],
    source_tier: source.source_tier,
    active_from: source.active_from,
    active_to: source.active_to,
    notes: source.notes,
    registry_version: source.registry_version,
  }
}

export function mapSourceEnvelope(
  envelope: SourceEnvelope,
  batchId: string,
  mode: IngestMode,
): PreparedRecord {
  validateSourceEnvelope(envelope)
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(batchId)) {
    throw new Error('Destination import batch ID must be a UUID.')
  }
  if (mode !== 'canary' && mode !== 'full') throw new Error('Ingest mode is invalid.')

  const article = mapArticle(envelope.article)
  const journal = mapJournal(envelope.journal)
  const provenance = {
    pmid: article.pmid,
    batch_id: batchId,
    source_kind: 'unmapped' as const,
    source_id: 'fixed-local-bibliographic-corpus' as const,
    query_id: mode === 'canary' ? ('production-canary' as const) : ('production-full' as const),
    source_filename: SOURCE_PROVENANCE_FILENAME,
  }
  const { batch_id: _batchId, ...stableProvenance } = provenance
  void _batchId

  return {
    article,
    journal,
    provenance,
    canonicalChecksumInput: canonicalJson({
      mappingVersion: MAPPING_VERSION,
      article,
      journal,
      provenance: stableProvenance,
    }),
  }
}
