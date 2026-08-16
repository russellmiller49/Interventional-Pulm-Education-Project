export type IngestMode = 'canary' | 'full'
export type OperatorCommand = 'validate' | 'dry-run' | 'canary' | 'full' | 'reconcile' | 'verify'

export type PublicationDatePrecision = 'day' | 'month' | 'year' | 'season' | 'unknown'

export interface SourceJournalRow {
  id: string
  canonical_name: string
  pubmed_abbreviation: string | null
  nlm_id: string | null
  issn_print: string | null
  issn_electronic: string | null
  aliases: string[]
  source_tier: string
  active_from: number | null
  active_to: number | null
  notes: string | null
  registry_version: string
}

export interface SourceArticleRow {
  pmid: string
  doi: string | null
  pmcid: string | null
  title: string
  abstract: string | null
  abstract_display_policy: 'hidden' | 'snippet_only' | 'full_allowed'
  journal_id: string | null
  journal_title: string | null
  journal_abbreviation: string | null
  nlm_journal_id: string | null
  issn_values: string[]
  publication_date_raw: string | null
  publication_year: number | null
  publication_month: number | null
  publication_day: number | null
  publication_date_precision: PublicationDatePrecision
  publication_types: string[]
  mesh_terms: string[]
  author_keywords: string[]
  languages: string[]
  authors: unknown[]
  collective_authors: string[]
  affiliations: string[]
  volume: string | null
  issue: string | null
  pages: string | null
  article_number: string | null
  place_of_publication: string | null
  citation_source: string | null
  conflict_of_interest: string | null
  pubmed_status: string | null
  pubmed_last_revised_at: string | null
  pubmed_created_at: string | null
  raw_nbib_tags: Record<string, string[]>
  metadata_hash: string
  normalized_title: string
  normalized_title_hash: string
  is_retracted: boolean
  is_correction: boolean
  is_conference_abstract: boolean
}

export interface SourceEnvelope {
  article: SourceArticleRow
  journal: SourceJournalRow | null
}

export interface DestinationArticleRow extends SourceArticleRow {
  relevance_state: 'unreviewed'
  visibility_state: 'draft'
  manual_override: false
  is_landmark: false
  curation_reason: null
  classifier_version: null
  classifier_payload: null
}

export interface ArticleSourceRow {
  pmid: string
  batch_id: string
  source_kind: 'unmapped'
  source_id: 'fixed-local-bibliographic-corpus'
  query_id: 'production-canary' | 'production-full'
  source_filename: string
}

export interface PreparedRecord {
  article: DestinationArticleRow
  journal: SourceJournalRow | null
  provenance: ArticleSourceRow
  canonicalChecksumInput: string
}

export interface PreparedBatch {
  index: number
  startOrdinal: number
  endOrdinal: number
  recordCount: number
  articleBodyBytes: number
  journalBodyBytes: number
  provenanceBodyBytes: number
  checksum: string
  records: PreparedRecord[]
  journals: SourceJournalRow[]
}

export type MutationStageState =
  | 'not_required'
  | 'prepared'
  | 'submitted'
  | 'acknowledged'
  | 'confirmed_failure'
  | 'ambiguous'

export interface CheckpointMutationStage {
  state: MutationStageState
  requestChecksum: string | null
  submittedAt: string | null
  acknowledgedAt: string | null
  failureCode: string | null
}

export interface CheckpointBatch {
  index: number
  startOrdinal: number
  endOrdinal: number
  recordCount: number
  articleBodyBytes: number
  journalBodyBytes: number
  provenanceBodyBytes: number
  checksum: string
  effects: {
    inserted: number
    updated: number
    unchanged: number
  } | null
  stages: {
    journals: CheckpointMutationStage
    articles: CheckpointMutationStage
    provenance: CheckpointMutationStage
  }
}

export interface IngestCounters {
  recordsRead: number
  uniquePmids: number
  duplicateOccurrences: number
  inserted: number
  updated: number
  unchanged: number
}

export interface Checkpoint {
  schemaVersion: string
  engineVersion: string
  mappingVersion: string
  operationId: string
  mode: IngestMode
  targetProjectRef: string
  createdAt: string
  updatedAt: string
  sourceProjectionChecksum: string
  sourceRecordCount: number
  canaryManifestChecksum: string | null
  limits: {
    recordBatchLimit: number
    byteBatchLimit: number
    concurrency: number
  }
  batchIdentity: {
    sourceFilename: string
    sourceFileSha256: string
    manifestVersion: string
    queryRegistryVersion: string
    sourceKind: 'unmapped'
    sourceId: 'fixed-local-bibliographic-corpus'
    queryId: 'production-canary' | 'production-full'
    recordLimit: number | null
  }
  importBatchCreate: CheckpointMutationStage
  finalization: CheckpointMutationStage
  phase: 'prepared' | 'running' | 'confirmed_failure' | 'needs_reconciliation' | 'completed'
  beforeArticleCount: number | null
  afterArticleCount: number | null
  counters: IngestCounters
  batches: CheckpointBatch[]
}

export interface CanaryManifestBody {
  schemaVersion: string
  selectorVersion: string
  selectorSeed: string
  sourceAuthority: 'owner-authorized-development-cohort-630'
  size: 25
  pmids: string[]
}

export interface CanaryManifest extends CanaryManifestBody {
  manifestChecksum: string
}

export interface CanaryCandidate {
  pmid: string
  abstractPresent: boolean
  publicationYear: number | null
  journal: string | null
  publicationTypes: string[]
}

export interface IngestReceiptBody {
  schemaVersion: string
  engineVersion: string
  mappingVersion: string
  operationId: string
  mode: IngestMode
  outcome: 'completed' | 'dry-run' | 'idempotent-replay'
  targetProjectRef: string | null
  completedAt: string
  sourceProjectionChecksum: string
  sourceRecordCount: number
  canaryManifestChecksum: string | null
  canaryPmids?: string[]
  beforeArticleCount: number | null
  afterArticleCount: number | null
  counters: IngestCounters
  batchChecksums: string[]
  importBatchId: string | null
}

export interface IngestReceipt extends IngestReceiptBody {
  receiptChecksum: string
}

export type ReconciliationClassification =
  | 'applied_exact'
  | 'absent_exact'
  | 'partial_or_conflicting'
  | 'observation_incomplete'

export interface ReconciliationObservation {
  subject: string
  classification: ReconciliationClassification
}

export interface ReconciliationReceiptBody {
  schemaVersion: string
  engineVersion: string
  operationId: string
  mode: IngestMode
  targetProjectRef: string
  checkpointChecksum: string
  observedAt: string
  observations: ReconciliationObservation[]
}

export interface ReconciliationReceipt extends ReconciliationReceiptBody {
  receiptChecksum: string
}

export interface SourceProjection {
  recordCount: number
  duplicateOccurrences: number
  checksum: string
}

export interface BatchLimits {
  recordBatchLimit: number
  byteBatchLimit: number
  concurrency: number
}

export interface DestinationBinding {
  url: string
  projectRef: string
  secret: string
}
