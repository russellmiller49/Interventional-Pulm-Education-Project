import type { User } from '@supabase/supabase-js'

import { flattenLiteratureTaxonomy, literatureQueryRegistry } from '@/features/literature/config'
import type {
  LiteratureAdminArticleUpdate,
  LiteratureReviewQueueQuery,
  LiteratureSearchQuery,
} from '@/features/literature/schemas/search'

import { literatureClientForOperation } from './database-client'
import {
  capabilityFromArticleCount,
  capabilityFromFailure,
  capabilityNotObserved,
} from './runtime-capability'
import type {
  LiteratureAdminStats,
  LiteratureArticleDetail,
  LiteratureCapabilityResult,
  LiteratureCurationEventDisplay,
  LiteratureDisplayTopic,
  LiteratureReviewQueueItem,
  LiteratureSearchResponse,
  LiteratureSearchResult,
  LiteratureServerResult,
  LiteratureSourceDisplay,
  LiteratureTopicAssignmentDisplay,
} from './types'

interface SearchRow {
  pmid: string
  doi: string | null
  title: string
  authors: unknown
  journal_id: string | null
  journal_title: string | null
  journal_abbreviation: string | null
  publication_year: number | null
  volume: string | null
  issue: string | null
  pages: string | null
  abstract_snippet: string | null
  publication_types: string[] | null
  is_landmark: boolean
  is_retracted: boolean
  is_correction: boolean
  is_conference_abstract: boolean
  relevance_state: LiteratureSearchResult['relevanceState']
  visibility_state: LiteratureSearchResult['visibilityState']
  confirmed_topics: unknown
  suggested_topics: unknown
  matched_by: string[] | null
  rank_score: number | null
  total_count: number | string
}

interface ArticleRow {
  pmid: string
  doi: string | null
  pmcid: string | null
  title: string
  abstract: string | null
  abstract_display_policy: LiteratureArticleDetail['abstractDisplayPolicy']
  journal_id: string | null
  journal_title: string | null
  journal_abbreviation: string | null
  publication_date_raw: string | null
  publication_year: number | null
  publication_types: string[] | null
  mesh_terms: string[] | null
  author_keywords: string[] | null
  languages: string[] | null
  authors: unknown
  collective_authors: string[] | null
  volume: string | null
  issue: string | null
  pages: string | null
  article_number: string | null
  citation_source: string | null
  relevance_state: LiteratureArticleDetail['relevanceState']
  visibility_state: LiteratureArticleDetail['visibilityState']
  curation_reason: string | null
  is_landmark: boolean
  is_retracted: boolean
  is_correction: boolean
  is_conference_abstract: boolean
}

interface SourceRow {
  pmid: string
  batch_id: string
  source_kind: LiteratureSourceDisplay['sourceKind']
  source_id: string | null
  query_id: string | null
  source_filename: string
  first_seen_at: string
}

interface TopicAssignmentRow {
  pmid: string
  topic_id: string
  confidence: number | string | null
  assignment_source: LiteratureTopicAssignmentDisplay['assignmentSource']
  assignment_state: LiteratureTopicAssignmentDisplay['assignmentState']
  model_or_rule_version: string
  evidence: unknown
}

interface CurationEventRow {
  id: string
  event_type: string
  actor_email: string | null
  before_value: unknown
  after_value: unknown
  reason: string | null
  created_at: string
}

const topicById = new Map(
  flattenLiteratureTaxonomy().map((topic) => [
    topic.id,
    {
      id: topic.id,
      labelEn: topic.labelEn,
      labelEs: topic.labelEs,
      labelZhCn: topic.labelZhCn,
    } satisfies LiteratureDisplayTopic,
  ]),
)
const knownJournalIds = new Set(
  [
    ...literatureQueryRegistry.core_journals,
    ...literatureQueryRegistry.optional_continuity_journals,
    ...literatureQueryRegistry.expanded_journals,
    ...literatureQueryRegistry.non_pubmed_sources,
  ].map((journal) => journal.id),
)

function normalizeAuthors(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((author) => {
    if (!author || typeof author !== 'object') {
      return []
    }
    const candidate = author as Record<string, unknown>
    if (typeof candidate.fullName !== 'string') {
      return []
    }
    return [
      {
        fullName: candidate.fullName,
        abbreviatedName:
          typeof candidate.abbreviatedName === 'string' ? candidate.abbreviatedName : null,
      },
    ]
  })
}

function normalizeDisplayTopics(value: unknown): LiteratureDisplayTopic[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((topic) => {
    if (!topic || typeof topic !== 'object') {
      return []
    }
    const candidate = topic as Record<string, unknown>
    if (typeof candidate.id !== 'string' || typeof candidate.label_en !== 'string') {
      return []
    }
    return [
      {
        id: candidate.id,
        labelEn: candidate.label_en,
        labelEs: typeof candidate.label_es === 'string' ? candidate.label_es : null,
        labelZhCn: typeof candidate.label_zh_cn === 'string' ? candidate.label_zh_cn : null,
      },
    ]
  })
}

function sourceDisplay(row: SourceRow): LiteratureSourceDisplay {
  return {
    batchId: row.batch_id,
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    queryId: row.query_id,
    sourceFilename: row.source_filename,
    firstSeenAt: row.first_seen_at,
  }
}

function topicAssignmentDisplay(row: TopicAssignmentRow): LiteratureTopicAssignmentDisplay {
  const topic = topicById.get(row.topic_id)
  return {
    id: row.topic_id,
    labelEn: topic?.labelEn ?? row.topic_id,
    labelEs: topic?.labelEs ?? null,
    labelZhCn: topic?.labelZhCn ?? null,
    confidence: row.confidence === null ? null : Number.parseFloat(String(row.confidence)),
    assignmentSource: row.assignment_source,
    assignmentState: row.assignment_state,
    modelOrRuleVersion: row.model_or_rule_version,
    evidence:
      row.evidence && typeof row.evidence === 'object'
        ? (row.evidence as Record<string, unknown>)
        : null,
  }
}

function curationEventDisplay(row: CurationEventRow): LiteratureCurationEventDisplay {
  return {
    id: row.id,
    eventType: row.event_type,
    actorEmail: row.actor_email,
    beforeValue: row.before_value,
    afterValue: row.after_value,
    reason: row.reason,
    createdAt: row.created_at,
  }
}

function numberRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, count]) => [
      key,
      Number(count) || 0,
    ]),
  )
}

export function validateKnownLiteratureFilters(query: LiteratureSearchQuery) {
  const topicIds = new Set(topicById.keys())

  const unknownTopics = query.topicIds.filter((id) => !topicIds.has(id))
  const unknownJournals = query.journalIds.filter((id) => !knownJournalIds.has(id))
  if (unknownTopics.length > 0 || unknownJournals.length > 0) {
    throw new Error('One or more literature filters are not recognized.')
  }
}

export async function searchLiterature(
  query: LiteratureSearchQuery,
): Promise<LiteratureCapabilityResult<LiteratureSearchResponse>> {
  const acquired = literatureClientForOperation('article_search')
  if (!acquired.client) {
    return { data: null, error: acquired.capability.message, capability: acquired.capability }
  }
  const { client, projectRef } = acquired

  try {
    validateKnownLiteratureFilters(query)
  } catch {
    // A rejected filter is a fact about the request, not about the corpus, so the capability says
    // the database was never asked rather than inventing an empty result or an outage.
    return {
      data: null,
      error: 'One or more search filters are invalid.',
      capability: capabilityNotObserved(
        projectRef,
        'The search was rejected before it reached the Literature database.',
      ),
    }
  }

  const { data, error } = await client.rpc('search_literature_v1', {
    p_query: query.q,
    p_journal_ids: query.journalIds,
    p_topic_ids: query.topicIds,
    p_year_from: query.yearFrom ?? null,
    p_year_to: query.yearTo ?? null,
    p_publication_types: query.publicationTypes,
    p_landmark_only: query.landmarkOnly,
    p_sort: query.sort,
    p_page: query.page,
    p_page_size: query.pageSize,
    p_admin_preview: query.adminPreview,
  })

  if (error) {
    console.error('Literature search failed', { code: error.code })
    const capability = capabilityFromFailure(error, { projectRef, surface: 'foundation' })
    return { data: null, error: capability.message, capability }
  }

  const rows = (data ?? []) as SearchRow[]
  const items = rows.map(
    (row): LiteratureSearchResult => ({
      pmid: row.pmid,
      doi: row.doi,
      title: row.title,
      authors: normalizeAuthors(row.authors),
      journalId: row.journal_id,
      journalTitle: row.journal_title,
      journalAbbreviation: row.journal_abbreviation,
      publicationYear: row.publication_year,
      volume: row.volume,
      issue: row.issue,
      pages: row.pages,
      abstractSnippet: row.abstract_snippet,
      publicationTypes: row.publication_types ?? [],
      isLandmark: row.is_landmark,
      isRetracted: row.is_retracted,
      isCorrection: row.is_correction,
      isConferenceAbstract: row.is_conference_abstract,
      relevanceState: row.relevance_state,
      visibilityState: row.visibility_state,
      confirmedTopics: normalizeDisplayTopics(row.confirmed_topics),
      suggestedTopics: normalizeDisplayTopics(row.suggested_topics),
      matchedBy: row.matched_by ?? [],
      rankScore: row.rank_score ?? 0,
    }),
  )
  const total = rows[0] ? Number(rows[0].total_count) : 0

  return {
    data: {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      adminPreview: query.adminPreview,
    },
    error: null,
    // A page of results proves the foundation is present; `total` decides empty from populated.
    capability: capabilityFromArticleCount(total, projectRef),
  }
}

async function loadAssociations(pmids: string[]) {
  const acquired = literatureClientForOperation('article_detail')
  const client = acquired.client
  if (!client || pmids.length === 0) {
    return { sources: [] as SourceRow[], topics: [] as TopicAssignmentRow[] }
  }

  const [sourcesResult, topicsResult] = await Promise.all([
    client
      .from('literature_article_sources')
      .select('pmid,batch_id,source_kind,source_id,query_id,source_filename,first_seen_at')
      .in('pmid', pmids)
      .order('first_seen_at', { ascending: true }),
    client
      .from('literature_article_topics')
      .select(
        'pmid,topic_id,confidence,assignment_source,assignment_state,model_or_rule_version,evidence',
      )
      .in('pmid', pmids)
      .order('topic_id', { ascending: true }),
  ])

  if (sourcesResult.error || topicsResult.error) {
    throw new Error('Unable to load literature associations.')
  }

  return {
    sources: (sourcesResult.data ?? []) as SourceRow[],
    topics: (topicsResult.data ?? []) as TopicAssignmentRow[],
  }
}

export async function getLiteratureArticle(
  pmid: string,
): Promise<LiteratureCapabilityResult<LiteratureArticleDetail | null>> {
  const acquired = literatureClientForOperation('article_detail')
  if (!acquired.client) {
    return { data: null, error: acquired.capability.message, capability: acquired.capability }
  }
  const { client, projectRef } = acquired

  const [articleResult, associations, eventsResult] = await Promise.all([
    client
      .from('literature_articles')
      .select(
        'pmid,doi,pmcid,title,abstract,abstract_display_policy,journal_id,journal_title,journal_abbreviation,publication_date_raw,publication_year,publication_types,mesh_terms,author_keywords,languages,authors,collective_authors,volume,issue,pages,article_number,citation_source,relevance_state,visibility_state,curation_reason,is_landmark,is_retracted,is_correction,is_conference_abstract',
      )
      .eq('pmid', pmid)
      .maybeSingle(),
    loadAssociations([pmid]),
    client
      .from('literature_curation_events')
      .select('id,event_type,actor_email,before_value,after_value,reason,created_at')
      .eq('pmid', pmid)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  if (articleResult.error || eventsResult.error) {
    console.error('Literature article lookup failed', {
      articleCode: articleResult.error?.code,
      eventCode: eventsResult.error?.code,
    })
    const capability = capabilityFromFailure(articleResult.error ?? eventsResult.error, {
      projectRef,
      surface: 'foundation',
    })
    return { data: null, error: capability.message, capability }
  }
  if (!articleResult.data) {
    // A successful lookup that matched nothing. The foundation answered, so this is a real
    // "no such article", not an outage — the detail page renders its not-found state.
    return { data: null, error: null, capability: capabilityFromArticleCount(0, projectRef) }
  }

  const row = articleResult.data as ArticleRow
  return {
    data: {
      pmid: row.pmid,
      doi: row.doi,
      pmcid: row.pmcid,
      title: row.title,
      abstract: row.abstract,
      abstractDisplayPolicy: row.abstract_display_policy,
      journalId: row.journal_id,
      journalTitle: row.journal_title,
      journalAbbreviation: row.journal_abbreviation,
      publicationDateRaw: row.publication_date_raw,
      publicationYear: row.publication_year,
      publicationTypes: row.publication_types ?? [],
      meshTerms: row.mesh_terms ?? [],
      authorKeywords: row.author_keywords ?? [],
      languages: row.languages ?? [],
      authors: normalizeAuthors(row.authors),
      collectiveAuthors: row.collective_authors ?? [],
      volume: row.volume,
      issue: row.issue,
      pages: row.pages,
      articleNumber: row.article_number,
      citationSource: row.citation_source,
      relevanceState: row.relevance_state,
      visibilityState: row.visibility_state,
      curationReason: row.curation_reason,
      isLandmark: row.is_landmark,
      isRetracted: row.is_retracted,
      isCorrection: row.is_correction,
      isConferenceAbstract: row.is_conference_abstract,
      sources: associations.sources.map(sourceDisplay),
      topics: associations.topics.map(topicAssignmentDisplay),
      curationEvents: ((eventsResult.data ?? []) as CurationEventRow[]).map(curationEventDisplay),
    },
    error: null,
    capability: capabilityFromArticleCount(1, projectRef),
  }
}

export async function loadLiteratureAdminStats(): Promise<
  LiteratureCapabilityResult<LiteratureAdminStats>
> {
  const acquired = literatureClientForOperation('admin_stats')
  if (!acquired.client) {
    return { data: null, error: acquired.capability.message, capability: acquired.capability }
  }
  const { client, projectRef } = acquired

  const { data, error } = await client.rpc('literature_admin_stats_v1')
  if (error || !data || typeof data !== 'object') {
    console.error('Literature statistics failed', { code: error?.code })
    // An RPC that answered with a non-object is not a zero either; it is an unusable answer, and
    // `classifyLiteratureQueryFailure` reports the null-error case as unclassified rather than
    // guessing that the migration is missing.
    const capability = capabilityFromFailure(error, { projectRef, surface: 'foundation' })
    return { data: null, error: capability.message, capability }
  }

  const value = data as Record<string, unknown>
  const totalArticles = Number(value.total_articles) || 0
  return {
    data: {
      totalArticles,
      withAbstract: Number(value.with_abstract) || 0,
      withoutAbstract: Number(value.without_abstract) || 0,
      relevanceCounts: numberRecord(value.relevance_counts),
      visibilityCounts: numberRecord(value.visibility_counts),
      sourceKindCounts: numberRecord(value.source_kind_counts),
      journalCounts: numberRecord(value.journal_counts),
      topicSuggestionCount: Number(value.topic_suggestion_count) || 0,
      importErrorCount: Number(value.import_error_count) || 0,
      unmappedFileCount: Number(value.unmapped_file_count) || 0,
      lastImport:
        value.last_import && typeof value.last_import === 'object'
          ? (value.last_import as LiteratureAdminStats['lastImport'])
          : null,
      lastSuccessfulImport:
        value.last_successful_import && typeof value.last_successful_import === 'object'
          ? (value.last_successful_import as LiteratureAdminStats['lastSuccessfulImport'])
          : null,
    },
    error: null,
    capability: capabilityFromArticleCount(totalArticles, projectRef),
  }
}

export async function loadLiteratureReviewQueue(filters: LiteratureReviewQueueQuery): Promise<
  LiteratureCapabilityResult<{
    items: LiteratureReviewQueueItem[]
    total: number
    page: number
    pageSize: number
    pageCount: number
  }>
> {
  const acquired = literatureClientForOperation('review_queue_read')
  if (!acquired.client) {
    return { data: null, error: acquired.capability.message, capability: acquired.capability }
  }
  const { client, projectRef } = acquired

  if (
    (filters.topicId && !topicById.has(filters.topicId)) ||
    (filters.journalId && !knownJournalIds.has(filters.journalId))
  ) {
    return {
      data: null,
      error: 'One or more review filters are invalid.',
      capability: capabilityNotObserved(
        projectRef,
        'The review-queue request was rejected before it reached the Literature database.',
      ),
    }
  }

  const relationFields = [
    filters.sourceKind ? 'literature_article_sources!inner(source_kind)' : null,
    filters.topicId ? 'literature_article_topics!inner(topic_id,assignment_state)' : null,
  ].filter((value): value is string => Boolean(value))
  const selection = [
    'pmid',
    'doi',
    'title',
    'abstract',
    'authors',
    'journal_id',
    'journal_title',
    'journal_abbreviation',
    'publication_year',
    'publication_types',
    'relevance_state',
    'visibility_state',
    'is_landmark',
    ...relationFields,
  ].join(',')

  let query = client.from('literature_articles').select(selection, { count: 'exact' })

  if (filters.q) {
    query = query.textSearch('search_vector', filters.q, {
      config: 'english',
      type: 'websearch',
    })
  }
  if (filters.sourceKind) {
    query = query.eq('literature_article_sources.source_kind', filters.sourceKind)
  }
  if (filters.topicId) {
    query = query
      .eq('literature_article_topics.topic_id', filters.topicId)
      .in('literature_article_topics.assignment_state', ['suggested', 'confirmed'])
  }
  if (filters.journalId) {
    query = query.eq('journal_id', filters.journalId)
  }
  if (filters.year) {
    query = query.eq('publication_year', filters.year)
  }
  if (filters.abstractAvailability === 'with') {
    query = query.not('abstract', 'is', null)
  } else if (filters.abstractAvailability === 'without') {
    query = query.is('abstract', null)
  }
  if (filters.relevanceState) {
    query = query.eq('relevance_state', filters.relevanceState)
  }
  if (filters.visibilityState) {
    query = query.eq('visibility_state', filters.visibilityState)
  }

  const start = (filters.page - 1) * filters.pageSize
  const result = await query
    .order('updated_at', { ascending: false })
    .order('pmid', { ascending: false })
    .range(start, start + filters.pageSize - 1)

  if (result.error) {
    console.error('Literature review queue failed', { code: result.error.code })
    const capability = capabilityFromFailure(result.error, { projectRef, surface: 'foundation' })
    return { data: null, error: capability.message, capability }
  }

  const rows = (result.data ?? []) as unknown as ArticleRow[]
  const associations = await loadAssociations(rows.map((row) => row.pmid))
  const sourcesByPmid = new Map<string, LiteratureSourceDisplay[]>()
  const topicsByPmid = new Map<string, LiteratureTopicAssignmentDisplay[]>()
  for (const source of associations.sources) {
    sourcesByPmid.set(source.pmid, [
      ...(sourcesByPmid.get(source.pmid) ?? []),
      sourceDisplay(source),
    ])
  }
  for (const topic of associations.topics) {
    topicsByPmid.set(topic.pmid, [
      ...(topicsByPmid.get(topic.pmid) ?? []),
      topicAssignmentDisplay(topic),
    ])
  }

  const total = result.count ?? 0
  return {
    data: {
      items: rows.map((row) => ({
        pmid: row.pmid,
        doi: row.doi,
        title: row.title,
        abstractSnippet: row.abstract?.slice(0, 500) ?? null,
        authors: normalizeAuthors(row.authors),
        journalId: row.journal_id,
        journalTitle: row.journal_title,
        journalAbbreviation: row.journal_abbreviation,
        publicationYear: row.publication_year,
        publicationTypes: row.publication_types ?? [],
        relevanceState: row.relevance_state,
        visibilityState: row.visibility_state,
        isLandmark: row.is_landmark,
        sources: sourcesByPmid.get(row.pmid) ?? [],
        topics: topicsByPmid.get(row.pmid) ?? [],
      })),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
    },
    error: null,
    // The queue counts rows matching the active filters, which can legitimately be zero while the
    // corpus is populated, so the capability is reported from the unfiltered corpus signal the
    // administration page already loads separately rather than from `total`.
    capability: capabilityFromArticleCount(total, projectRef),
  }
}

export async function curateLiteratureArticle(
  pmid: string,
  update: LiteratureAdminArticleUpdate,
  actor: User,
): Promise<LiteratureCapabilityResult<Record<string, unknown>>> {
  // Withheld by the activation contract, so this returns before any argument is inspected: the
  // build carries no Literature write path, and saying so is more useful than validating a payload
  // that can never be sent.
  const acquired = literatureClientForOperation('article_curation')
  if (!acquired.client) {
    return { data: null, error: acquired.capability.message, capability: acquired.capability }
  }
  const { client, projectRef } = acquired

  if (update.topicDecisions?.some((decision) => !topicById.has(decision.topicId))) {
    return {
      data: null,
      error: 'One or more topic decisions are invalid.',
      capability: capabilityNotObserved(
        projectRef,
        'The curation request was rejected before it reached the Literature database.',
      ),
    }
  }

  const { data, error } = await client.rpc('curate_literature_article_v1', {
    p_pmid: pmid,
    p_actor_user_id: actor.id,
    p_actor_email: actor.email ?? null,
    p_relevance_state: update.relevanceState ?? null,
    p_visibility_state: update.visibilityState ?? null,
    p_is_landmark: update.isLandmark ?? null,
    p_topic_decisions: update.topicDecisions ?? [],
    p_reason: update.reason ?? null,
  })

  if (error) {
    console.error('Literature curation failed', { code: error.code })
    const capability = capabilityFromFailure(error, { projectRef, surface: 'foundation' })
    return { data: null, error: capability.message, capability }
  }

  return {
    data: data && typeof data === 'object' ? (data as Record<string, unknown>) : { pmid },
    error: null,
    capability: capabilityFromArticleCount(1, projectRef),
  }
}
