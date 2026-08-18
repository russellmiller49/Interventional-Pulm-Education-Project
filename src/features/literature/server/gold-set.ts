import type { SupabaseClient, User } from '@supabase/supabase-js'

import type {
  LiteratureGoldReviewItem,
  LiteratureGoldReviewPayload,
  LiteratureGoldReviewRecord,
  LiteratureGoldSetBatchSummary,
  LiteratureGoldSetItemAction,
} from '@/features/literature/gold-set/types'
import type {
  LiteratureGoldExport,
  LiteratureGoldExportReview,
} from '@/features/literature/gold-set/export'
import {
  literatureGoldExportSamplingContext,
  resolveEffectiveLiteratureGoldExportReview,
} from '@/features/literature/gold-set/export'

import { literatureClientForOperation } from './database-client'
import { capabilityFromArticleCount, capabilityFromFailure } from './runtime-capability'
import type { LiteratureCapabilityResult, LiteratureServerResult } from './types'

/**
 * Acquire a client for a gold-set operation, or the reason there is none.
 *
 * Every function in this module needs one, and under the dedicated project none of them can have
 * one: the gold-set migrations are deliberately deferred, so `literature_gold_set_*` and the
 * `*_gold_*` RPCs do not exist there. Routing the acquisition through the activation contract
 * means these call sites report "the workflow is not installed" instead of attempting an RPC that
 * would surface a raw PostgREST schema-cache error, and it keeps the refusal in one place rather
 * than seven.
 */
function goldSetClient(operation: 'gold_set_read' | 'gold_set_mutation') {
  const acquired = literatureClientForOperation(operation)
  if (acquired.client) {
    return { client: acquired.client, unavailable: null, capability: null }
  }
  return {
    client: null,
    unavailable: { data: null, error: acquired.capability.message } as const,
    capability: acquired.capability,
  }
}

interface GoldBatchRow {
  id: string
  name: string
  kind: LiteratureGoldSetBatchSummary['kind']
  status: LiteratureGoldSetBatchSummary['status']
  requested_size: number
  total_count: number | string
  completed_count: number | string
  remaining_count: number | string
  return_later_count: number | string
  development_count: number | string
  development_completed_count: number | string
  test_count: number | string
  test_completed_count: number | string
  test_unlocked_at: string | null
  test_unlocked_by_email: string | null
  sampling_seed: number | string
  sampling_report: LiteratureGoldSetBatchSummary['samplingReport']
  created_at: string
  frozen_at: string | null
}

function text(value: unknown) {
  return typeof value === 'string' ? value : null
}

function textArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function enrichmentTagStatus(value: unknown) {
  return value === 'tagged' || value === 'not_applicable' || value === 'not_assessable'
    ? value
    : null
}

function reviewPayload(value: unknown): LiteratureGoldReviewPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  return {
    relevanceLabel:
      row.relevanceLabel === 'include_core' ||
      row.relevanceLabel === 'include_adjacent' ||
      row.relevanceLabel === 'exclude' ||
      row.relevanceLabel === 'uncertain'
        ? row.relevanceLabel
        : null,
    metadataSufficiency:
      row.metadataSufficiency === 'adequate_abstract' ||
      row.metadataSufficiency === 'limited_abstract' ||
      row.metadataSufficiency === 'no_abstract' ||
      row.metadataSufficiency === 'conflicting_metadata'
        ? row.metadataSufficiency
        : null,
    reviewerConfidence:
      row.reviewerConfidence === 'high' ||
      row.reviewerConfidence === 'moderate' ||
      row.reviewerConfidence === 'low'
        ? row.reviewerConfidence
        : null,
    topicIds: textArray(row.topicIds),
    technologyTags: textArray(row.technologyTags),
    clinicalPurposes: textArray(row.clinicalPurposes),
    diseaseTags: textArray(row.diseaseTags),
    studyDesign: text(row.studyDesign),
    publicationStatus: text(row.publicationStatus),
    categorizationFromFullText: row.categorizationFromFullText === true,
    notes: text(row.notes) ?? '',
    usedSupplementalMetadata: row.usedSupplementalMetadata === true,
    reviewSeconds:
      typeof row.reviewSeconds === 'number' && Number.isFinite(row.reviewSeconds)
        ? row.reviewSeconds
        : 0,
  }
}

function reviewRecord(value: unknown): LiteratureGoldReviewRecord | null {
  const payload = reviewPayload(value)
  if (!payload || !value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const id = text(row.id)
  const completedAt = text(row.completedAt)
  const revision = Number(row.revision)
  if (!id || !completedAt || !Number.isInteger(revision) || revision < 1) return null
  const revisionKind =
    row.revisionKind === 'import' || row.revisionKind === 'compensation'
      ? row.revisionKind
      : 'standard'
  const lifecycleState = row.lifecycleState === 'withdrawn' ? 'withdrawn' : 'effective'
  return {
    ...payload,
    id,
    revision,
    revisionKind,
    lifecycleState,
    supersedesReviewId: text(row.supersedesReviewId),
    compensatesReviewId: text(row.compensatesReviewId),
    effectiveSourceReviewId: text(row.effectiveSourceReviewId),
    operationActionId: text(row.operationActionId),
    technologyTagStatus: enrichmentTagStatus(row.technologyTagStatus),
    diseaseTagStatus: enrichmentTagStatus(row.diseaseTagStatus),
    taxonomyVersion: text(row.taxonomyVersion),
    labelSchemaVersion: text(row.labelSchemaVersion),
    enrichmentSchemaVersion: text(row.enrichmentSchemaVersion),
    enrichmentProvenance: text(row.enrichmentProvenance),
    reviewerEmail: text(row.reviewerEmail),
    isBlinded: row.isBlinded === true,
    completedAt,
  }
}

function normalizeGoldReviewItem(value: unknown): LiteratureGoldReviewItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const article =
    row.article && typeof row.article === 'object' && !Array.isArray(row.article)
      ? (row.article as Record<string, unknown>)
      : null
  const automated =
    row.automatedSignals &&
    typeof row.automatedSignals === 'object' &&
    !Array.isArray(row.automatedSignals)
      ? (row.automatedSignals as Record<string, unknown>)
      : null
  const authors = Array.isArray(article?.authors)
    ? article.authors.flatMap((author) => {
        if (!author || typeof author !== 'object' || Array.isArray(author)) return []
        const candidate = author as Record<string, unknown>
        const fullName = text(candidate.fullName)
        return fullName ? [{ fullName, abbreviatedName: text(candidate.abbreviatedName) }] : []
      })
    : []
  const history = Array.isArray(row.reviewHistory)
    ? row.reviewHistory
        .map(reviewRecord)
        .filter((review): review is LiteratureGoldReviewRecord => Boolean(review))
    : []
  const pointerReview = reviewRecord(row.currentReview)
  const currentReview = pointerReview?.lifecycleState === 'withdrawn' ? null : pointerReview
  const id = text(row.id)
  const batchId = text(row.batchId)
  const batchName = text(row.batchName)
  const pmid = text(article?.pmid)
  const title = text(article?.title)
  if (!id || !batchId || !batchName || !pmid || !title) return null

  return {
    id,
    batchId,
    batchName,
    batchStatus:
      row.batchStatus === 'frozen' || row.batchStatus === 'archived' ? row.batchStatus : 'active',
    displayOrder: Number(row.displayOrder) || 0,
    totalCount: Number(row.totalCount) || 0,
    completedCount: Number(row.completedCount) || 0,
    remainingCount: Number(row.remainingCount) || 0,
    reviewStatus:
      row.reviewStatus === 'in_progress' ||
      row.reviewStatus === 'return_later' ||
      row.reviewStatus === 'completed'
        ? row.reviewStatus
        : 'pending',
    article: {
      pmid,
      title,
      abstract: text(article?.abstract),
      authors,
      journalTitle: text(article?.journalTitle),
      journalAbbreviation: text(article?.journalAbbreviation),
      publicationYear:
        typeof article?.publicationYear === 'number' ? article.publicationYear : null,
      publicationTypes: textArray(article?.publicationTypes),
      ...(Array.isArray(article?.meshTerms) ? { meshTerms: textArray(article.meshTerms) } : {}),
      ...(Array.isArray(article?.authorKeywords)
        ? { authorKeywords: textArray(article.authorKeywords) }
        : {}),
    },
    draft: reviewPayload(row.draft),
    chainHeadReviewId:
      text(row.chainHeadReviewId) ??
      pointerReview?.id ??
      history.reduce<LiteratureGoldReviewRecord | null>(
        (latest, review) => (!latest || review.revision > latest.revision ? review : latest),
        null,
      )?.id ??
      null,
    currentReview,
    reviewHistory: history,
    supplementalMetadataRevealed: row.supplementalMetadataRevealed === true,
    automatedSignalsRevealed: row.automatedSignalsRevealed === true,
    automatedSignals: automated
      ? {
          sampleStratum:
            automated.sampleStratum === 'strong_likely_ip' ||
            automated.sampleStratum === 'likely_non_ip' ||
            automated.sampleStratum === 'ambiguous_boundary' ||
            automated.sampleStratum === 'discovery_only' ||
            automated.sampleStratum === 'landmark_regression' ||
            automated.sampleStratum === 'hard_negative_regression'
              ? automated.sampleStratum
              : 'challenging_metadata',
          samplingReason: text(automated.samplingReason) ?? '',
          samplingMetadata:
            automated.samplingMetadata &&
            typeof automated.samplingMetadata === 'object' &&
            !Array.isArray(automated.samplingMetadata)
              ? (automated.samplingMetadata as Record<string, unknown>)
              : {},
          sources: Array.isArray(automated.sources)
            ? automated.sources.flatMap((source) => {
                if (!source || typeof source !== 'object' || Array.isArray(source)) return []
                const candidate = source as Record<string, unknown>
                const sourceKind = text(candidate.sourceKind)
                const sourceFilename = text(candidate.sourceFilename)
                return sourceKind && sourceFilename
                  ? [
                      {
                        sourceKind,
                        sourceId: text(candidate.sourceId),
                        queryId: text(candidate.queryId),
                        sourceFilename,
                      },
                    ]
                  : []
              })
            : [],
          suggestions: Array.isArray(automated.suggestions)
            ? automated.suggestions.flatMap((suggestion) => {
                if (!suggestion || typeof suggestion !== 'object' || Array.isArray(suggestion)) {
                  return []
                }
                const candidate = suggestion as Record<string, unknown>
                const topicId = text(candidate.topicId)
                const assignmentSource = text(candidate.assignmentSource)
                return topicId && assignmentSource
                  ? [
                      {
                        topicId,
                        confidence:
                          typeof candidate.confidence === 'number'
                            ? candidate.confidence
                            : candidate.confidence === null
                              ? null
                              : Number(candidate.confidence) || null,
                        assignmentSource,
                        evidence:
                          candidate.evidence &&
                          typeof candidate.evidence === 'object' &&
                          !Array.isArray(candidate.evidence)
                            ? (candidate.evidence as Record<string, unknown>)
                            : null,
                      },
                    ]
                  : []
              })
            : [],
        }
      : null,
    previousItemId: text(row.previousItemId),
    nextItemId: text(row.nextItemId),
    nextUnresolvedItemId: text(row.nextUnresolvedItemId),
  }
}

/**
 * The batch list is the gold-set page's first call, so it is the one that carries the capability:
 * the page needs to tell "the workflow is not installed here" from "the workflow is installed and
 * has no batches" before it renders a review workspace around an empty array.
 */
export async function listLiteratureGoldSetBatches(): Promise<
  LiteratureCapabilityResult<LiteratureGoldSetBatchSummary[]>
> {
  const { client, unavailable, capability } = goldSetClient('gold_set_read')
  if (!client) return { ...unavailable, capability }

  const { data, error } = await client.rpc('list_literature_gold_batches_v2')
  if (error) {
    const failure = capabilityFromFailure(error, { projectRef: null, surface: 'gold_workflow' })
    return { data: null, error: failure.message, capability: failure }
  }

  return {
    data: ((data ?? []) as GoldBatchRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      status: row.status,
      requestedSize: row.requested_size,
      totalCount: Number(row.total_count) || 0,
      completedCount: Number(row.completed_count) || 0,
      remainingCount: Number(row.remaining_count) || 0,
      returnLaterCount: Number(row.return_later_count) || 0,
      developmentCount: Number(row.development_count) || 0,
      developmentCompletedCount: Number(row.development_completed_count) || 0,
      testCount: Number(row.test_count) || 0,
      testCompletedCount: Number(row.test_completed_count) || 0,
      testUnlockedAt: row.test_unlocked_at,
      testUnlockedByEmail: row.test_unlocked_by_email,
      samplingSeed: Number(row.sampling_seed),
      samplingReport: row.sampling_report,
      createdAt: row.created_at,
      frozenAt: row.frozen_at,
    })),
    error: null,
    capability: capabilityFromArticleCount(Array.isArray(data) ? data.length : 0, null),
  }
}

export async function loadLiteratureGoldReviewItem(
  batchId?: string,
  itemId?: string,
  status: 'all' | 'unresolved' | 'return_later' | 'completed' = 'unresolved',
  split: 'development' | 'test' | 'all' = 'development',
): Promise<LiteratureServerResult<LiteratureGoldReviewItem | null>> {
  const { client, unavailable } = goldSetClient('gold_set_read')
  if (!client) return unavailable

  const { data, error } = await client.rpc('get_literature_gold_review_item_v2', {
    p_batch_id: batchId ?? null,
    p_item_id: itemId ?? null,
    p_status: status,
    p_split: split,
  })
  if (error) return { data: null, error: error.message }
  if (
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    (data as Record<string, unknown>).item === null
  ) {
    return { data: null, error: null }
  }
  const normalized = normalizeGoldReviewItem(data)
  if (!normalized && data !== null) {
    return { data: null, error: 'The gold-set item response was malformed.' }
  }
  return { data: normalized, error: null }
}

export async function saveLiteratureGoldReview(
  itemId: string,
  review: LiteratureGoldReviewPayload,
  complete: boolean,
  user: User,
): Promise<LiteratureServerResult<Record<string, unknown>>> {
  const { client, unavailable } = goldSetClient('gold_set_mutation')
  if (!client) return unavailable
  const { data, error } = await client.rpc('save_literature_gold_review_v1', {
    p_item_id: itemId,
    p_actor_user_id: user.id,
    p_actor_email: user.email ?? null,
    p_review: review,
    p_complete: complete,
  })
  return error
    ? { data: null, error: error.message }
    : { data: (data ?? {}) as Record<string, unknown>, error: null }
}

export async function updateLiteratureGoldReviewItem(
  itemId: string,
  action: LiteratureGoldSetItemAction,
  user: User,
): Promise<LiteratureServerResult<Record<string, unknown>>> {
  const { client, unavailable } = goldSetClient('gold_set_mutation')
  if (!client) return unavailable
  const { data, error } = await client.rpc('update_literature_gold_item_v1', {
    p_item_id: itemId,
    p_actor_user_id: user.id,
    p_actor_email: user.email ?? null,
    p_action: action,
  })
  return error
    ? { data: null, error: error.message }
    : { data: (data ?? {}) as Record<string, unknown>, error: null }
}

export async function freezeLiteratureGoldSetBatch(
  batchId: string,
  user: User,
): Promise<LiteratureServerResult<Record<string, unknown>>> {
  const { client, unavailable } = goldSetClient('gold_set_mutation')
  if (!client) return unavailable
  const { data, error } = await client.rpc('freeze_literature_gold_batch_v1', {
    p_batch_id: batchId,
    p_actor_user_id: user.id,
    p_actor_email: user.email ?? null,
  })
  return error
    ? { data: null, error: error.message }
    : { data: (data ?? {}) as Record<string, unknown>, error: null }
}

export async function unlockLiteratureGoldTestSplit(
  batchId: string,
  reason: string,
  user: User,
): Promise<LiteratureServerResult<Record<string, unknown>>> {
  const { client, unavailable } = goldSetClient('gold_set_mutation')
  if (!client) return unavailable
  const { data, error } = await client.rpc('unlock_literature_gold_test_split_v1', {
    p_batch_id: batchId,
    p_actor_user_id: user.id,
    p_actor_email: user.email ?? null,
    p_reason: reason,
  })
  return error
    ? { data: null, error: error.message }
    : { data: (data ?? {}) as Record<string, unknown>, error: null }
}

function chunks<T>(values: T[], size: number) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size),
  )
}

function exportReview(
  row: Record<string, unknown> | undefined,
  draft: boolean,
): LiteratureGoldExportReview | null {
  if (!row) return null
  return {
    id: draft ? null : text(row.id),
    revision: draft ? null : Number(row.revision) || null,
    revisionKind: draft
      ? null
      : row.revision_kind === 'import' || row.revision_kind === 'compensation'
        ? row.revision_kind
        : 'standard',
    lifecycleState: draft ? null : row.lifecycle_state === 'withdrawn' ? 'withdrawn' : 'effective',
    supersedesReviewId: draft ? null : text(row.supersedes_review_id),
    compensatesReviewId: draft ? null : text(row.compensates_review_id),
    effectiveSourceReviewId: draft ? null : text(row.effective_source_review_id),
    operationActionId: draft ? null : text(row.operation_action_id),
    technologyTagStatus: draft ? null : enrichmentTagStatus(row.technology_tag_status),
    diseaseTagStatus: draft ? null : enrichmentTagStatus(row.disease_tag_status),
    taxonomyVersion: draft ? null : text(row.taxonomy_version),
    labelSchemaVersion: draft ? null : text(row.label_schema_version),
    enrichmentSchemaVersion: draft ? null : text(row.enrichment_schema_version),
    enrichmentProvenance: draft ? null : text(row.enrichment_provenance),
    relevanceLabel: text(row.relevance_label),
    metadataSufficiency: text(row.metadata_sufficiency),
    reviewerConfidence: text(row.reviewer_confidence),
    topicIds: textArray(row.topic_ids),
    technologyTags: textArray(row.technology_tags),
    clinicalPurposes: textArray(row.clinical_purposes),
    diseaseTags: textArray(row.disease_tags),
    studyDesign: text(row.study_design),
    publicationStatus: text(row.publication_status),
    categorizationFromFullText: row.categorization_from_full_text === true,
    notes: text(row.notes) ?? '',
    usedSupplementalMetadata: row.used_supplemental_metadata === true,
    reviewSeconds: Number(row.review_seconds) || 0,
    isBlinded: draft ? null : row.is_blinded === true,
    reviewerEmail: text(row.reviewer_email),
    completedAt: draft ? null : text(row.completed_at),
  }
}

export async function exportLiteratureGoldSet(
  batchId: string,
  split: 'development' | 'test' | 'all',
  includeHistory: boolean,
  clientOverride?: SupabaseClient,
): Promise<LiteratureServerResult<LiteratureGoldExport>> {
  // The override is the seam the export CLI and its tests use against a local corpus; without
  // one, the same activation contract as every other gold-set call applies.
  const acquired = clientOverride ? null : goldSetClient('gold_set_read')
  const client = clientOverride ?? acquired?.client
  if (!client)
    return (
      acquired?.unavailable ?? { data: null, error: 'The literature database is not configured.' }
    )

  const { data: batchData, error: batchError } = await client
    .from('literature_gold_set_batches')
    .select(
      'id,name,kind,status,taxonomy_version,label_schema_version,relevance_definition_version,sampling_algorithm_version,sampling_seed,requested_size,test_unlocked_at,frozen_at',
    )
    .eq('id', batchId)
    .maybeSingle()
  if (batchError) return { data: null, error: batchError.message }
  if (!batchData) return { data: null, error: 'Gold-set batch not found.' }
  if (
    batchData.kind === 'gold_standard' &&
    !batchData.test_unlocked_at &&
    (split === 'test' || split === 'all')
  ) {
    const { count: testCount, error: testCountError } = await client
      .from('literature_gold_set_items')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', batchId)
      .eq('dataset_split', 'test')
    if (testCountError) return { data: null, error: testCountError.message }
    if ((testCount ?? 0) > 0) {
      return {
        data: null,
        error: 'The gold-set test split is locked until development review is complete.',
      }
    }
  }

  const itemRows: Array<Record<string, unknown>> = []
  for (let start = 0; ; start += 1000) {
    let query = client
      .from('literature_gold_set_items')
      .select(
        'id,pmid,sample_stratum,sampling_reason,dataset_split,display_order,review_status,current_review_id',
      )
      .eq('batch_id', batchId)
    if (split !== 'all') query = query.eq('dataset_split', split)
    const { data, error } = await query
      .order('display_order', { ascending: true })
      .range(start, start + 999)
    if (error) return { data: null, error: error.message }
    itemRows.push(...((data ?? []) as Array<Record<string, unknown>>))
    if ((data?.length ?? 0) < 1000) break
  }

  const pmids = itemRows.map((row) => String(row.pmid))
  const itemIds = itemRows.map((row) => String(row.id))
  const currentReviewIds = itemRows
    .map((row) => text(row.current_review_id))
    .filter((id): id is string => Boolean(id))
  const articleRows: Array<Record<string, unknown>> = []
  const draftRows: Array<Record<string, unknown>> = []
  const reviewRows: Array<Record<string, unknown>> = []
  const historyRows: Array<Record<string, unknown>> = []

  for (const pmidChunk of chunks(pmids, 200)) {
    const { data, error } = await client
      .from('literature_articles')
      .select(
        'pmid,title,abstract,authors,journal_title,journal_abbreviation,publication_year,publication_types',
      )
      .in('pmid', pmidChunk)
    if (error) return { data: null, error: error.message }
    articleRows.push(...((data ?? []) as Array<Record<string, unknown>>))
  }
  for (const itemChunk of chunks(itemIds, 200)) {
    const { data, error } = await client
      .from('literature_gold_set_review_drafts')
      .select('*')
      .in('item_id', itemChunk)
    if (error) return { data: null, error: error.message }
    draftRows.push(...((data ?? []) as Array<Record<string, unknown>>))
    if (includeHistory) {
      for (let start = 0; ; start += 1000) {
        const { data: history, error: historyError } = await client
          .from('literature_gold_set_reviews')
          .select('*')
          .in('item_id', itemChunk)
          .order('item_id', { ascending: true })
          .order('revision', { ascending: true })
          .range(start, start + 999)
        if (historyError) return { data: null, error: historyError.message }
        historyRows.push(...((history ?? []) as Array<Record<string, unknown>>))
        if ((history?.length ?? 0) < 1000) break
      }
    }
  }
  for (const reviewChunk of chunks(currentReviewIds, 200)) {
    const { data, error } = await client
      .from('literature_gold_set_reviews')
      .select('*')
      .in('id', reviewChunk)
    if (error) return { data: null, error: error.message }
    reviewRows.push(...((data ?? []) as Array<Record<string, unknown>>))
  }

  const articleByPmid = new Map(articleRows.map((row) => [String(row.pmid), row]))
  const draftByItem = new Map(draftRows.map((row) => [String(row.item_id), row]))
  const reviewById = new Map(reviewRows.map((row) => [String(row.id), row]))
  const historyByItem = new Map<string, LiteratureGoldExportReview[]>()
  for (const row of historyRows) {
    const review = exportReview(row, false)
    if (!review) continue
    const key = String(row.item_id)
    historyByItem.set(key, [...(historyByItem.get(key) ?? []), review])
  }

  const batch = batchData as Record<string, unknown>
  return {
    data: {
      exportVersion: '1.1.0',
      exportedAt: new Date().toISOString(),
      batch: {
        id: String(batch.id),
        name: String(batch.name),
        kind: String(batch.kind),
        status: String(batch.status),
        taxonomyVersion: String(batch.taxonomy_version),
        labelSchemaVersion: String(batch.label_schema_version),
        relevanceDefinitionVersion: String(batch.relevance_definition_version),
        samplingAlgorithmVersion: String(batch.sampling_algorithm_version),
        samplingSeed: Number(batch.sampling_seed),
        requestedSize: Number(batch.requested_size),
        frozenAt: text(batch.frozen_at),
      },
      split,
      includesHistory: includeHistory,
      records: itemRows.map((item) => {
        const itemId = String(item.id)
        const pmid = String(item.pmid)
        const article = articleByPmid.get(pmid) ?? {}
        const chainHead = reviewById.get(String(item.current_review_id))
        const current = resolveEffectiveLiteratureGoldExportReview(exportReview(chainHead, false))
        const draft = draftByItem.get(itemId)
        const samplingContext = literatureGoldExportSamplingContext(
          Boolean(current),
          String(item.sample_stratum),
          String(item.sampling_reason),
        )
        return {
          itemId,
          pmid,
          title: String(article.title ?? ''),
          abstract: text(article.abstract),
          authors: article.authors ?? [],
          journalTitle: text(article.journal_title),
          journalAbbreviation: text(article.journal_abbreviation),
          publicationYear:
            typeof article.publication_year === 'number' ? article.publication_year : null,
          publicationTypes: textArray(article.publication_types),
          ...samplingContext,
          datasetSplit: String(item.dataset_split),
          displayOrder: Number(item.display_order),
          reviewStatus: String(item.review_status),
          reviewSource: current
            ? ('completed' as const)
            : draft
              ? ('draft' as const)
              : ('empty' as const),
          review: current ?? exportReview(draft, true),
          chainHeadReviewId: text(item.current_review_id),
          ...(includeHistory ? { reviewHistory: historyByItem.get(itemId) ?? [] } : {}),
        }
      }),
    },
    error: null,
  }
}
