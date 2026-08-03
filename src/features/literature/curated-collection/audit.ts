export const EXPERT_CURATED_IP_V1_COLLECTION_ID = 'expert-curated-ip-v1' as const
export const EXPERT_CURATED_IP_V1_PMID_COUNT = 281
export const EXPERT_CURATED_IP_V1_EXTERNAL_RESOURCE_COUNT = 7

export type CuratedCollectionExternalClassification =
  | 'resolved_pubmed_duplicate'
  | 'distinct_non_pubmed_resource'
  | 'unresolved'

export type CuratedCollectionPhysicianLabel =
  | 'include_core'
  | 'include_adjacent'
  | 'exclude'
  | 'uncertain'

export type CuratedCollectionDatabaseTarget = 'local' | 'remote'

export interface CuratedCollectionInputFile {
  path: string
  sha256: string
}

export interface CuratedCollectionInputs {
  collectionId: typeof EXPERT_CURATED_IP_V1_COLLECTION_ID
  pmids: string[]
  externalResources: string[]
  files: {
    pmids: CuratedCollectionInputFile
    externalResources: CuratedCollectionInputFile
    sourceAudit: CuratedCollectionInputFile
  }
}

export interface CuratedCollectionArticleSnapshot {
  pmid: string
  doi: string | null
  title: string
  abstract: string | null
  journalId: string | null
  journalTitle: string | null
  journalAbbreviation: string | null
  publicationYear: number | null
  relevanceState: string
  visibilityState: string
  isLandmark: boolean
}

export interface CuratedCollectionSourceSnapshot {
  pmid: string
  batchId: string
  sourceKind: string
  sourceId: string | null
  queryId: string | null
  sourceFilename: string
  firstSeenAt: string
}

export interface CuratedCollectionImportBatchSnapshot {
  id: string
  sourceFilename: string
  sourceFileSha256: string
  manifestVersion: string
  queryRegistryVersion: string | null
  sourceKind: string
  sourceId: string | null
  queryId: string | null
  dateFrom: string | null
  dateTo: string | null
  status: string
  recordsRead: number
  uniquePmids: number
  insertedCount: number
  updatedCount: number
  duplicateCount: number
  errorCount: number
  recordLimit: number | null
  startedAt: string
  completedAt: string | null
  report: Record<string, unknown> | null
  createdBy: string | null
}

export interface CuratedCollectionTopicSnapshot {
  pmid: string
  topicId: string
  confidence: number | null
  assignmentSource: string
  assignmentState: string
  modelOrRuleVersion: string
  evidence: Record<string, unknown> | null
}

export interface CuratedCollectionTopicDefinitionSnapshot {
  id: string
  labelEn: string
}

export interface CuratedCollectionBatchSnapshot {
  id: string
  name: string
  kind: string
  status: string
  testUnlockedAt: string | null
}

export interface CuratedCollectionBatchItemSnapshot {
  id: string
  batchId: string
  pmid: string
  datasetSplit: string
  reviewStatus: string
  currentReviewId: string | null
}

export interface CuratedCollectionReviewSnapshot {
  id: string
  itemId: string
  revision: number
  relevanceLabel: CuratedCollectionPhysicianLabel
  reviewerConfidence: string
  isBlinded: boolean
  completedAt: string
}

export interface CuratedCollectionDatabaseSnapshot {
  articles: CuratedCollectionArticleSnapshot[]
  exactIdentifierArticles: Array<Pick<CuratedCollectionArticleSnapshot, 'pmid' | 'doi'>>
  sources: CuratedCollectionSourceSnapshot[]
  importBatches: CuratedCollectionImportBatchSnapshot[]
  topicAssignments: CuratedCollectionTopicSnapshot[]
  topicDefinitions: CuratedCollectionTopicDefinitionSnapshot[]
  batches: CuratedCollectionBatchSnapshot[]
  batchItems: CuratedCollectionBatchItemSnapshot[]
  reviews: CuratedCollectionReviewSnapshot[]
}

export interface CuratedCollectionBatchMembershipAudit {
  batchId: string
  batchName: string
  batchKind: string
  batchStatus: string
  datasetSplit: string
  reviewStatus: string
  labelAccess: 'accessible' | 'withheld_locked_test'
  currentPhysicianDecision: {
    relevanceLabel: CuratedCollectionPhysicianLabel
    reviewerConfidence: string
    revision: number
    isBlinded: boolean
    completedAt: string
  } | null
  revisionCount: number | null
}

export interface CuratedCollectionPmidAudit {
  pmid: string
  presentInCorpus: boolean
  title: string | null
  doi: string | null
  journal: {
    id: string | null
    title: string | null
    abbreviation: string | null
  } | null
  publicationYear: number | null
  abstractAvailable: boolean | null
  sourceProvenance: Array<{
    batchId: string
    sourceKind: string
    sourceId: string | null
    queryId: string | null
    sourceFilename: string
    firstSeenAt: string
    importBatch: Omit<CuratedCollectionImportBatchSnapshot, 'id'>
  }>
  generalCurationDecision: string | null
  visibility: string | null
  isLandmark: boolean | null
  topicAssignments: Array<{
    topicId: string
    topicLabel: string | null
    confidence: number | null
    assignmentSource: string
    assignmentState: string
    modelOrRuleVersion: string
    evidence: Record<string, unknown> | null
  }>
  batchMemberships: CuratedCollectionBatchMembershipAudit[]
  accessiblePhysicianLabels: CuratedCollectionPhysicianLabel[]
  conflict: {
    status: 'no_conflict_detected' | 'manual_review_required' | 'not_fully_assessable_locked_test'
    assessmentComplete: boolean
    requiresManualReview: boolean
    conflictingExistingPhysicianDecision: boolean
    heldOutLabelWithheld: boolean
    reasons: string[]
  }
}

export interface CuratedCollectionExternalResourceAudit {
  url: string
  classification: CuratedCollectionExternalClassification
  resolvedPmid: string | null
  resolvedDoi: string | null
  exactIdentifier: {
    kind: 'pmid' | 'doi'
    value: string
    evidence: string
  } | null
  resolutionEvidence:
    | 'exact_identifier_unique_corpus_match'
    | 'no_explicit_pmid_or_doi'
    | 'explicit_identifier_not_in_corpus'
    | 'ambiguous_exact_identifier_match'
  note: string
}

export interface CuratedCollectionAuditReport {
  reportVersion: '1.0.0'
  collectionId: typeof EXPERT_CURATED_IP_V1_COLLECTION_ID
  determinism: {
    wallClockFieldsOmitted: true
    recordOrder: 'canonical_input_order'
    inputPathContract: 'normalized_repo_relative_paths_are_part_of_report'
  }
  database: {
    target: CuratedCollectionDatabaseTarget
  }
  inputs: CuratedCollectionInputs['files']
  collectionSemantics: {
    expertCuratedMembershipIsFinalRelevanceLabel: false
    recommendedLaterHandling: {
      unreviewedArticles: 'candidate_draft'
      existingPhysicianDecisions: 'unchanged'
      existingExclusions: 'manual_conflict_queue'
      confirmedPositiveArticles: 'development_only_positive_regression'
      externalResources: 'separate_resource_collection'
    }
  }
  summary: {
    requestedPmids: number
    presentInCorpus: number
    missingFromCorpus: number
    alreadyIncludeCore: number
    alreadyIncludeAdjacent: number
    alreadyExcluded: number
    candidate: number
    unreviewed: number
    alreadyLandmark: number
    alreadyInPilotOrAnotherBatch: number
    missingAbstract: number
    conflictingExistingPhysicianDecision: number
    manualConflictQueue: number
    heldOutLabelsWithheld: number
    presentPmids: string[]
    missingPmids: string[]
    conflictingExistingPhysicianDecisionPmids: string[]
    manualConflictQueuePmids: string[]
  }
  pmids: CuratedCollectionPmidAudit[]
  externalResources: CuratedCollectionExternalResourceAudit[]
}

interface SourceAuditInput {
  collectionId?: unknown
  counts?: {
    uniquePmids?: unknown
    uniqueExternalResources?: unknown
    totalUniqueResources?: unknown
  }
  uniquePmidsInFirstOccurrenceOrder?: unknown
  uniqueExternalResourcesInFirstOccurrenceOrder?: unknown
}

function parseCanonicalLines(raw: string, label: string) {
  const lines = raw.replace(/\r\n/gu, '\n').split('\n')
  if (lines.at(-1) === '') lines.pop()
  if (lines.length === 0 || lines.some((line) => line.length === 0)) {
    throw new Error(`${label} must contain one non-empty entry per line.`)
  }
  if (lines.some((line) => line.trim() !== line)) {
    throw new Error(`${label} entries must not contain leading or trailing whitespace.`)
  }
  return lines
}

function assertUnique(values: readonly string[], label: string) {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) throw new Error(`${label} contains a duplicate entry: ${value}`)
    seen.add(value)
  }
}

function assertStringArrayEqual(actual: unknown, expected: readonly string[], label: string) {
  if (!Array.isArray(actual) || actual.some((value) => typeof value !== 'string')) {
    throw new Error(`${label} must be a string array.`)
  }
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    throw new Error(`${label} does not exactly match the canonical input order.`)
  }
}

export function validateCuratedCollectionInputs(options: {
  pmidsText: string
  externalResourcesText: string
  sourceAudit: unknown
  files: CuratedCollectionInputs['files']
}): CuratedCollectionInputs {
  const pmids = parseCanonicalLines(options.pmidsText, 'The canonical PMID file')
  if (pmids.some((pmid) => !/^[0-9]{1,12}$/u.test(pmid))) {
    throw new Error('The canonical PMID file must contain only numeric PMID strings.')
  }
  assertUnique(pmids, 'The canonical PMID file')
  if (pmids.length !== EXPERT_CURATED_IP_V1_PMID_COUNT) {
    throw new Error(
      `The canonical PMID file must contain exactly ${EXPERT_CURATED_IP_V1_PMID_COUNT} unique PMIDs; received ${pmids.length}.`,
    )
  }

  const externalResources = parseCanonicalLines(
    options.externalResourcesText,
    'The external-resource file',
  )
  assertUnique(externalResources, 'The external-resource file')
  if (externalResources.length !== EXPERT_CURATED_IP_V1_EXTERNAL_RESOURCE_COUNT) {
    throw new Error(
      `The external-resource file must contain exactly ${EXPERT_CURATED_IP_V1_EXTERNAL_RESOURCE_COUNT} unique entries; received ${externalResources.length}.`,
    )
  }
  for (const resource of externalResources) {
    let url: URL
    try {
      url = new URL(resource)
    } catch {
      throw new Error(`The external-resource file contains an invalid URL: ${resource}`)
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`The external-resource URL must use HTTP or HTTPS: ${resource}`)
    }
  }

  if (!options.sourceAudit || typeof options.sourceAudit !== 'object') {
    throw new Error('The source audit must be a JSON object.')
  }
  const sourceAudit = options.sourceAudit as SourceAuditInput
  if (sourceAudit.collectionId !== EXPERT_CURATED_IP_V1_COLLECTION_ID) {
    throw new Error(`The source audit collectionId must be ${EXPERT_CURATED_IP_V1_COLLECTION_ID}.`)
  }
  if (
    sourceAudit.counts?.uniquePmids !== EXPERT_CURATED_IP_V1_PMID_COUNT ||
    sourceAudit.counts.uniqueExternalResources !== EXPERT_CURATED_IP_V1_EXTERNAL_RESOURCE_COUNT ||
    sourceAudit.counts.totalUniqueResources !==
      EXPERT_CURATED_IP_V1_PMID_COUNT + EXPERT_CURATED_IP_V1_EXTERNAL_RESOURCE_COUNT
  ) {
    throw new Error('The source audit unique-resource counts do not match the frozen collection.')
  }
  assertStringArrayEqual(
    sourceAudit.uniquePmidsInFirstOccurrenceOrder,
    pmids,
    'The source audit PMID list',
  )
  assertStringArrayEqual(
    sourceAudit.uniqueExternalResourcesInFirstOccurrenceOrder,
    externalResources,
    'The source audit external-resource list',
  )

  return {
    collectionId: EXPERT_CURATED_IP_V1_COLLECTION_ID,
    pmids,
    externalResources,
    files: options.files,
  }
}

function compareText(left: string, right: string) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function compareNullable(left: string | null, right: string | null) {
  return compareText(left ?? '', right ?? '')
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, child]) => [key, stableJsonValue(child)]),
    )
  }
  return value
}

function uniqueMap<T>(values: readonly T[], key: (value: T) => string, label: string) {
  const result = new Map<string, T>()
  for (const value of values) {
    const identity = key(value)
    if (result.has(identity)) throw new Error(`${label} contains duplicate key ${identity}.`)
    result.set(identity, value)
  }
  return result
}

export function isLockedHeldOutTestItem(
  item: CuratedCollectionBatchItemSnapshot,
  batch: CuratedCollectionBatchSnapshot,
) {
  return (
    batch.kind === 'gold_standard' && item.datasetSplit === 'test' && batch.testUnlockedAt === null
  )
}

function normalizeDoi(value: string) {
  const decoded = decodeURIComponent(value).trim().toLocaleLowerCase('en-US')
  const withoutPrefix = decoded
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//u, '')
    .replace(/^doi:\s*/u, '')
  return /^10\.\d{4,9}\/\S+$/u.test(withoutPrefix) ? withoutPrefix : null
}

export function explicitIdentifierFromExternalUrl(urlValue: string) {
  const url = new URL(urlValue)
  const hostname = url.hostname.toLocaleLowerCase('en-US').replace(/^www\./u, '')
  const decodedPath = decodeURIComponent(url.pathname)

  if (hostname === 'pubmed.ncbi.nlm.nih.gov') {
    const pmid = decodedPath.match(/^\/([0-9]{1,12})(?:\/|$)/u)?.[1]
    if (pmid) {
      return { kind: 'pmid' as const, value: pmid, evidence: 'explicit_pubmed_url_path' }
    }
  }
  if (hostname === 'ncbi.nlm.nih.gov') {
    const pmid = decodedPath.match(/^\/(?:m\/)?pubmed\/([0-9]{1,12})(?:\/|$)/u)?.[1]
    if (pmid) {
      return { kind: 'pmid' as const, value: pmid, evidence: 'explicit_pubmed_url_path' }
    }
  }

  if (hostname === 'doi.org' || hostname === 'dx.doi.org') {
    const doi = normalizeDoi(decodedPath.replace(/^\//u, ''))
    if (doi) return { kind: 'doi' as const, value: doi, evidence: 'explicit_doi_url_path' }
  }

  for (const key of ['doi', 'article_doi']) {
    const rawDoi = url.searchParams.get(key)
    const doi = rawDoi ? normalizeDoi(rawDoi) : null
    if (doi) return { kind: 'doi' as const, value: doi, evidence: `explicit_${key}_query` }
  }

  const embeddedDoi = decodedPath.match(/(?:^|\/)(10\.\d{4,9}\/[^/?#]+)/u)?.[1]
  const doi = embeddedDoi ? normalizeDoi(embeddedDoi) : null
  return doi ? { kind: 'doi' as const, value: doi, evidence: 'explicit_doi_url_path' } : null
}

export function auditExternalResources(
  resources: readonly string[],
  articles: ReadonlyArray<Pick<CuratedCollectionArticleSnapshot, 'pmid' | 'doi'>>,
): CuratedCollectionExternalResourceAudit[] {
  return resources.map((url) => {
    const exactIdentifier = explicitIdentifierFromExternalUrl(url)
    if (!exactIdentifier) {
      return {
        url,
        classification: 'unresolved',
        resolvedPmid: null,
        resolvedDoi: null,
        exactIdentifier: null,
        resolutionEvidence: 'no_explicit_pmid_or_doi',
        note: 'No literal PMID or DOI is present; title, URL adjacency, and live-network inference are not used.',
      }
    }

    const matches = articles.filter((article) => {
      if (exactIdentifier.kind === 'pmid') return article.pmid === exactIdentifier.value
      return article.doi !== null && normalizeDoi(article.doi) === exactIdentifier.value
    })
    if (matches.length === 1) {
      return {
        url,
        classification: 'resolved_pubmed_duplicate',
        resolvedPmid: matches[0].pmid,
        resolvedDoi: matches[0].doi ? normalizeDoi(matches[0].doi) : null,
        exactIdentifier,
        resolutionEvidence: 'exact_identifier_unique_corpus_match',
        note: 'The explicit identifier matches exactly one literature_articles row.',
      }
    }
    return {
      url,
      classification: 'unresolved',
      resolvedPmid: null,
      resolvedDoi: exactIdentifier.kind === 'doi' ? exactIdentifier.value : null,
      exactIdentifier,
      resolutionEvidence:
        matches.length === 0
          ? 'explicit_identifier_not_in_corpus'
          : 'ambiguous_exact_identifier_match',
      note:
        matches.length === 0
          ? 'The explicit identifier does not match a literature_articles row; non-PubMed status is not inferred.'
          : 'The explicit identifier matches multiple corpus rows, so the resource is not resolved.',
    }
  })
}

function buildMembershipAudit(
  item: CuratedCollectionBatchItemSnapshot,
  batch: CuratedCollectionBatchSnapshot,
  reviews: readonly CuratedCollectionReviewSnapshot[],
): CuratedCollectionBatchMembershipAudit {
  const locked = isLockedHeldOutTestItem(item, batch)
  if (locked && reviews.length > 0) {
    throw new Error(`Locked held-out test review rows must not be loaded (item ${item.id}).`)
  }
  if (locked) {
    return {
      batchId: batch.id,
      batchName: batch.name,
      batchKind: batch.kind,
      batchStatus: batch.status,
      datasetSplit: item.datasetSplit,
      reviewStatus: item.reviewStatus,
      labelAccess: 'withheld_locked_test',
      currentPhysicianDecision: null,
      revisionCount: null,
    }
  }

  const orderedReviews = [...reviews].sort((left, right) => left.revision - right.revision)
  const revisions = new Set(orderedReviews.map((review) => review.revision))
  if (revisions.size !== orderedReviews.length) {
    throw new Error(`Review revisions are not unique for item ${item.id}.`)
  }
  if (item.currentReviewId === null && orderedReviews.length > 0) {
    throw new Error(`Item ${item.id} has completed reviews but no authoritative current review.`)
  }
  const current = item.currentReviewId
    ? orderedReviews.find((review) => review.id === item.currentReviewId)
    : undefined
  if (item.currentReviewId && !current) {
    throw new Error(`The authoritative review for item ${item.id} was not loaded.`)
  }
  if (current && current.revision !== orderedReviews.at(-1)?.revision) {
    throw new Error(`The authoritative review for item ${item.id} is not the latest revision.`)
  }

  return {
    batchId: batch.id,
    batchName: batch.name,
    batchKind: batch.kind,
    batchStatus: batch.status,
    datasetSplit: item.datasetSplit,
    reviewStatus: item.reviewStatus,
    labelAccess: 'accessible',
    currentPhysicianDecision: current
      ? {
          relevanceLabel: current.relevanceLabel,
          reviewerConfidence: current.reviewerConfidence,
          revision: current.revision,
          isBlinded: current.isBlinded,
          completedAt: current.completedAt,
        }
      : null,
    revisionCount: orderedReviews.length,
  }
}

function groupBy<T>(values: readonly T[], key: (value: T) => string) {
  const grouped = new Map<string, T[]>()
  for (const value of values) {
    const identity = key(value)
    grouped.set(identity, [...(grouped.get(identity) ?? []), value])
  }
  return grouped
}

export function buildCuratedCollectionAuditReport(
  inputs: CuratedCollectionInputs,
  snapshot: CuratedCollectionDatabaseSnapshot,
  options: { databaseTarget: CuratedCollectionDatabaseTarget },
): CuratedCollectionAuditReport {
  const articleByPmid = uniqueMap(snapshot.articles, (article) => article.pmid, 'Articles')
  const importBatchById = uniqueMap(snapshot.importBatches, (batch) => batch.id, 'Import batches')
  const topicById = uniqueMap(snapshot.topicDefinitions, (topic) => topic.id, 'Topic definitions')
  const batchById = uniqueMap(snapshot.batches, (batch) => batch.id, 'Gold-set batches')
  const sourcesByPmid = groupBy(snapshot.sources, (source) => source.pmid)
  const topicsByPmid = groupBy(snapshot.topicAssignments, (topic) => topic.pmid)
  const itemsByPmid = groupBy(snapshot.batchItems, (item) => item.pmid)
  const reviewsByItem = groupBy(snapshot.reviews, (review) => review.itemId)

  for (const item of snapshot.batchItems) {
    const batch = batchById.get(item.batchId)
    if (!batch) throw new Error(`Gold-set item ${item.id} references an unloaded batch.`)
    if (isLockedHeldOutTestItem(item, batch) && reviewsByItem.has(item.id)) {
      throw new Error(`Locked held-out test review rows must not be loaded (item ${item.id}).`)
    }
  }

  const pmids = inputs.pmids.map<CuratedCollectionPmidAudit>((pmid) => {
    const article = articleByPmid.get(pmid)
    const sourceProvenance = [...(sourcesByPmid.get(pmid) ?? [])]
      .sort(
        (left, right) =>
          compareText(left.sourceKind, right.sourceKind) ||
          compareNullable(left.sourceId, right.sourceId) ||
          compareNullable(left.queryId, right.queryId) ||
          compareText(left.sourceFilename, right.sourceFilename) ||
          compareText(left.batchId, right.batchId),
      )
      .map((source) => {
        const importBatch = importBatchById.get(source.batchId)
        if (!importBatch) {
          throw new Error(`Source provenance references unloaded import batch ${source.batchId}.`)
        }
        return {
          ...source,
          importBatch: {
            sourceFilename: importBatch.sourceFilename,
            sourceFileSha256: importBatch.sourceFileSha256,
            manifestVersion: importBatch.manifestVersion,
            queryRegistryVersion: importBatch.queryRegistryVersion,
            sourceKind: importBatch.sourceKind,
            sourceId: importBatch.sourceId,
            queryId: importBatch.queryId,
            dateFrom: importBatch.dateFrom,
            dateTo: importBatch.dateTo,
            status: importBatch.status,
            recordsRead: importBatch.recordsRead,
            uniquePmids: importBatch.uniquePmids,
            insertedCount: importBatch.insertedCount,
            updatedCount: importBatch.updatedCount,
            duplicateCount: importBatch.duplicateCount,
            errorCount: importBatch.errorCount,
            recordLimit: importBatch.recordLimit,
            startedAt: importBatch.startedAt,
            completedAt: importBatch.completedAt,
            report: stableJsonValue(importBatch.report) as Record<string, unknown> | null,
            createdBy: importBatch.createdBy,
          },
        }
      })
    const topicAssignments = [...(topicsByPmid.get(pmid) ?? [])]
      .sort(
        (left, right) =>
          compareText(left.topicId, right.topicId) ||
          compareText(left.assignmentSource, right.assignmentSource) ||
          compareText(left.modelOrRuleVersion, right.modelOrRuleVersion) ||
          compareText(left.assignmentState, right.assignmentState),
      )
      .map((topic) => ({
        topicId: topic.topicId,
        topicLabel: topicById.get(topic.topicId)?.labelEn ?? null,
        confidence: topic.confidence,
        assignmentSource: topic.assignmentSource,
        assignmentState: topic.assignmentState,
        modelOrRuleVersion: topic.modelOrRuleVersion,
        evidence: stableJsonValue(topic.evidence) as Record<string, unknown> | null,
      }))
    const batchMemberships = [...(itemsByPmid.get(pmid) ?? [])]
      .map((item) => {
        const batch = batchById.get(item.batchId)
        if (!batch) throw new Error(`Gold-set item ${item.id} references an unloaded batch.`)
        return buildMembershipAudit(item, batch, reviewsByItem.get(item.id) ?? [])
      })
      .sort(
        (left, right) =>
          compareText(left.batchKind, right.batchKind) ||
          compareText(left.batchName, right.batchName) ||
          compareText(left.datasetSplit, right.datasetSplit) ||
          compareText(left.batchId, right.batchId),
      )

    const accessiblePhysicianLabels = [
      ...new Set(
        batchMemberships.flatMap((membership) =>
          membership.currentPhysicianDecision
            ? [membership.currentPhysicianDecision.relevanceLabel]
            : [],
        ),
      ),
    ].sort()
    const heldOutLabelWithheld = batchMemberships.some(
      (membership) => membership.labelAccess === 'withheld_locked_test',
    )
    const physicianExcluded = accessiblePhysicianLabels.includes('exclude')
    const physicianDisagreement = accessiblePhysicianLabels.length > 1
    const conflictingExistingPhysicianDecision = physicianExcluded || physicianDisagreement
    const reasons = [
      ...(article?.relevanceState === 'excluded' ? ['general_curation_excluded'] : []),
      ...(physicianExcluded ? ['physician_decision_excluded'] : []),
      ...(physicianDisagreement ? ['physician_decision_disagreement'] : []),
    ]
    const requiresManualReview = reasons.length > 0
    const assessmentComplete = !heldOutLabelWithheld

    return {
      pmid,
      presentInCorpus: article !== undefined,
      title: article?.title ?? null,
      doi: article?.doi ?? null,
      journal: article
        ? {
            id: article.journalId,
            title: article.journalTitle,
            abbreviation: article.journalAbbreviation,
          }
        : null,
      publicationYear: article?.publicationYear ?? null,
      abstractAvailable: article ? Boolean(article.abstract?.trim()) : null,
      sourceProvenance,
      generalCurationDecision: article?.relevanceState ?? null,
      visibility: article?.visibilityState ?? null,
      isLandmark: article?.isLandmark ?? null,
      topicAssignments,
      batchMemberships,
      accessiblePhysicianLabels,
      conflict: {
        status: requiresManualReview
          ? 'manual_review_required'
          : assessmentComplete
            ? 'no_conflict_detected'
            : 'not_fully_assessable_locked_test',
        assessmentComplete,
        requiresManualReview,
        conflictingExistingPhysicianDecision,
        heldOutLabelWithheld,
        reasons,
      },
    }
  })

  const present = pmids.filter((record) => record.presentInCorpus)
  const missing = pmids.filter((record) => !record.presentInCorpus)
  const physicianConflict = pmids.filter(
    (record) => record.conflict.conflictingExistingPhysicianDecision,
  )
  const manualConflictQueue = pmids.filter((record) => record.conflict.requiresManualReview)
  const hasPhysicianLabel = (
    record: CuratedCollectionPmidAudit,
    label: CuratedCollectionPhysicianLabel,
  ) => record.accessiblePhysicianLabels.includes(label)

  return {
    reportVersion: '1.0.0',
    collectionId: inputs.collectionId,
    determinism: {
      wallClockFieldsOmitted: true,
      recordOrder: 'canonical_input_order',
      inputPathContract: 'normalized_repo_relative_paths_are_part_of_report',
    },
    database: {
      target: options.databaseTarget,
    },
    inputs: inputs.files,
    collectionSemantics: {
      expertCuratedMembershipIsFinalRelevanceLabel: false,
      recommendedLaterHandling: {
        unreviewedArticles: 'candidate_draft',
        existingPhysicianDecisions: 'unchanged',
        existingExclusions: 'manual_conflict_queue',
        confirmedPositiveArticles: 'development_only_positive_regression',
        externalResources: 'separate_resource_collection',
      },
    },
    summary: {
      requestedPmids: pmids.length,
      presentInCorpus: present.length,
      missingFromCorpus: missing.length,
      alreadyIncludeCore: pmids.filter((record) => hasPhysicianLabel(record, 'include_core'))
        .length,
      alreadyIncludeAdjacent: pmids.filter((record) =>
        hasPhysicianLabel(record, 'include_adjacent'),
      ).length,
      alreadyExcluded: pmids.filter(
        (record) =>
          record.generalCurationDecision === 'excluded' || hasPhysicianLabel(record, 'exclude'),
      ).length,
      candidate: pmids.filter((record) => record.generalCurationDecision === 'candidate').length,
      unreviewed: pmids.filter((record) => record.generalCurationDecision === 'unreviewed').length,
      alreadyLandmark: pmids.filter((record) => record.isLandmark === true).length,
      alreadyInPilotOrAnotherBatch: pmids.filter((record) => record.batchMemberships.length > 0)
        .length,
      missingAbstract: present.filter((record) => record.abstractAvailable === false).length,
      conflictingExistingPhysicianDecision: physicianConflict.length,
      manualConflictQueue: manualConflictQueue.length,
      heldOutLabelsWithheld: pmids.filter((record) => record.conflict.heldOutLabelWithheld).length,
      presentPmids: present.map((record) => record.pmid),
      missingPmids: missing.map((record) => record.pmid),
      conflictingExistingPhysicianDecisionPmids: physicianConflict.map((record) => record.pmid),
      manualConflictQueuePmids: manualConflictQueue.map((record) => record.pmid),
    },
    pmids,
    externalResources: auditExternalResources(
      inputs.externalResources,
      snapshot.exactIdentifierArticles,
    ),
  }
}

function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? '' : String(value)
  const safe = /^[=+\-@]/u.test(raw) ? `'${raw}` : raw
  return `"${safe.replaceAll('"', '""')}"`
}

function csvJson(value: unknown) {
  return JSON.stringify(stableJsonValue(value))
}

export const CURATED_COLLECTION_PMID_CSV_COLUMNS = [
  'pmid',
  'present_in_corpus',
  'title',
  'doi',
  'journal_id',
  'journal_title',
  'journal_abbreviation',
  'publication_year',
  'abstract_available',
  'source_provenance_json',
  'general_curation_decision',
  'visibility',
  'is_landmark',
  'topic_assignments_json',
  'batch_memberships_json',
  'accessible_physician_labels_json',
  'conflict_status',
  'conflict_assessment_complete',
  'requires_manual_review',
  'conflicting_existing_physician_decision',
  'held_out_label_withheld',
  'conflict_reasons_json',
] as const

export function serializeCuratedCollectionPmidCsv(report: CuratedCollectionAuditReport) {
  const lines = [CURATED_COLLECTION_PMID_CSV_COLUMNS.map(csvCell).join(',')]
  for (const record of report.pmids) {
    const values: Record<(typeof CURATED_COLLECTION_PMID_CSV_COLUMNS)[number], unknown> = {
      pmid: record.pmid,
      present_in_corpus: record.presentInCorpus,
      title: record.title,
      doi: record.doi,
      journal_id: record.journal?.id,
      journal_title: record.journal?.title,
      journal_abbreviation: record.journal?.abbreviation,
      publication_year: record.publicationYear,
      abstract_available: record.abstractAvailable,
      source_provenance_json: csvJson(record.sourceProvenance),
      general_curation_decision: record.generalCurationDecision,
      visibility: record.visibility,
      is_landmark: record.isLandmark,
      topic_assignments_json: csvJson(record.topicAssignments),
      batch_memberships_json: csvJson(record.batchMemberships),
      accessible_physician_labels_json: csvJson(record.accessiblePhysicianLabels),
      conflict_status: record.conflict.status,
      conflict_assessment_complete: record.conflict.assessmentComplete,
      requires_manual_review: record.conflict.requiresManualReview,
      conflicting_existing_physician_decision: record.conflict.conflictingExistingPhysicianDecision,
      held_out_label_withheld: record.conflict.heldOutLabelWithheld,
      conflict_reasons_json: csvJson(record.conflict.reasons),
    }
    lines.push(
      CURATED_COLLECTION_PMID_CSV_COLUMNS.map((column) => csvCell(values[column])).join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

export const CURATED_COLLECTION_EXTERNAL_CSV_COLUMNS = [
  'url',
  'classification',
  'resolved_pmid',
  'resolved_doi',
  'exact_identifier_kind',
  'exact_identifier_value',
  'exact_identifier_evidence',
  'resolution_evidence',
  'note',
] as const

export function serializeCuratedCollectionExternalCsv(report: CuratedCollectionAuditReport) {
  const lines = [CURATED_COLLECTION_EXTERNAL_CSV_COLUMNS.map(csvCell).join(',')]
  for (const resource of report.externalResources) {
    const values: Record<(typeof CURATED_COLLECTION_EXTERNAL_CSV_COLUMNS)[number], unknown> = {
      url: resource.url,
      classification: resource.classification,
      resolved_pmid: resource.resolvedPmid,
      resolved_doi: resource.resolvedDoi,
      exact_identifier_kind: resource.exactIdentifier?.kind,
      exact_identifier_value: resource.exactIdentifier?.value,
      exact_identifier_evidence: resource.exactIdentifier?.evidence,
      resolution_evidence: resource.resolutionEvidence,
      note: resource.note,
    }
    lines.push(
      CURATED_COLLECTION_EXTERNAL_CSV_COLUMNS.map((column) => csvCell(values[column])).join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

export function serializeCuratedCollectionJson(report: CuratedCollectionAuditReport) {
  return `${JSON.stringify(stableJsonValue(report), null, 2)}\n`
}
