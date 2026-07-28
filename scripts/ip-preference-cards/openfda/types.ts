export const OPENFDA_ENDPOINT = 'https://api.fda.gov/device/udi.json'
export const OPENFDA_MANIFEST_ENDPOINT = 'https://api.fda.gov/download.json'
export const OPENFDA_API_SCHEMA_VERSION = 'device-udi-v1'

export const OPENFDA_CLASSIFICATIONS = [
  'high_confidence_candidate',
  'review_required',
  'unmatched',
  'insufficient_identifiers',
  'query_error',
] as const

export type OpenFdaClassification = (typeof OPENFDA_CLASSIFICATIONS)[number]

export const OPENFDA_QUERY_KINDS = [
  'primary_di',
  'catalog_number',
  'catalog_number_company',
  'model_number',
  'alternate_identifier',
  'brand_fallback',
] as const

export type OpenFdaQueryKind = (typeof OPENFDA_QUERY_KINDS)[number]

export interface CatalogProductInput {
  product_id: string
  manufacturer_id: string
  manufacturer: string | null
  product_name: string
  catalog_number: string | null
  alternate_ids: string | null
  gtin: string | null
  global_part_number: string | null
  reference_part_number: string | null
  brand_family?: string | null
  verification_status: string | null
  visibility_state: string
}

export interface VerificationBacklogInput {
  product_id: string
  priority?: string | null
  procedures?: string | null
  roles?: string | null
  existing_gtin?: string | null
  suggested_primary_di?: string | null
  gudid_result?: string | null
  match_confidence?: string | null
  distribution_status?: string | null
  evidence_url?: string | null
}

export interface ManufacturerAliasGroup {
  canonicalManufacturerId: string
  canonicalName: string
  aliases: string[]
}

export interface OpenFdaIdentifier {
  id: string
  type?: string
  issuing_agency?: string
  unit_of_use_id?: string
  quantity_per_package?: string
  package_status?: string
  package_type?: string
  [key: string]: unknown
}

export interface OpenFdaRecord {
  record_key?: string | null
  public_device_record_key?: string | null
  brand_name?: string | null
  company_name?: string | null
  catalog_number?: string | null
  version_or_model_number?: string | null
  device_description?: string | null
  device_count_in_base_package?: number | null
  device_sizes?: unknown[]
  identifiers?: OpenFdaIdentifier[]
  commercial_distribution_status?: string | null
  commercial_distribution_end_date?: string | null
  is_kit?: boolean | null
  is_single_use?: boolean | null
  sterilization?: unknown | null
  storage?: unknown[]
  has_expiration_date?: boolean | null
  has_lot_or_batch_number?: boolean | null
  has_manufacturing_date?: boolean | null
  has_serial_number?: boolean | null
  mri_safety?: string | null
  product_codes?: unknown[]
  premarket_submissions?: unknown[]
  gmdn_terms?: unknown[]
  publish_date?: string | null
  public_version_date?: string | null
  public_version_number?: string | null
  public_version_status?: string | null
  record_status?: string | null
  [key: string]: unknown
}

export interface OpenFdaQuery {
  kind: OpenFdaQueryKind
  phase: 1 | 2 | 3 | 4 | 5
  search: string
  limit: number
  sourceValue: string
  reviewOnly: boolean
}

export interface OpenFdaQueryAttemptSummary {
  kind: OpenFdaQueryKind
  search: string
  limit: number
  result_count: number
  raw_result_count?: number
  cache_hit: boolean
  http_status: number | null
  attempt_count: number
  error: string | null
}

export interface OpenFdaMatchedCandidate {
  record: OpenFdaRecord
  queryKinds: OpenFdaQueryKind[]
  querySearches: string[]
  retrievedAt: string[]
  rawCacheReferences: string[]
}

export interface OpenFdaCandidateSummary {
  record_key: string | null
  public_device_record_key: string | null
  primary_di: string | null
  brand_name: string | null
  company_name: string | null
  catalog_number: string | null
  version_or_model_number: string | null
  commercial_distribution_status: string | null
  public_version_date: string | null
  record_status: string | null
  query_kinds: OpenFdaQueryKind[]
}

export interface OpenFdaIdentifierProposal {
  id: string
  type: string | null
  issuing_agency: string | null
  unit_of_use_id: string | null
  package_status: string | null
  package_type: string | null
}

export interface OpenFdaProposedFields {
  primary_di: string | null
  additional_identifiers: OpenFdaIdentifierProposal[]
  brand_name: string | null
  company_name: string | null
  version_or_model_number: string | null
  device_description: string | null
  device_count_in_base_package: number | null
  device_sizes: unknown[]
  commercial_distribution_status: string | null
  commercial_distribution_end_date: string | null
  is_kit: boolean | null
  is_single_use: boolean | null
  sterilization: unknown | null
  storage: unknown[]
  product_codes: unknown[]
  premarket_submissions: unknown[]
  public_version_date: string | null
  record_status: string | null
}

export const BACKLOG_COMPARISONS = [
  'agrees_with_existing_backlog',
  'adds_missing_candidate',
  'conflicts_with_existing_di',
  'conflicts_with_distribution_status',
  'existing_backlog_has_more_specific_match',
  'not_previously_evaluated',
] as const

export type BacklogComparison = (typeof BACKLOG_COMPARISONS)[number]

export interface OpenFdaEnrichmentProposal {
  format_version: 1
  product_id: string
  manufacturer: string | null
  product_name: string
  catalog_number: string | null
  classification: OpenFdaClassification
  reason_codes: string[]
  query_attempts: OpenFdaQueryAttemptSummary[]
  candidate_count: number
  selected_candidate: OpenFdaCandidateSummary | null
  proposed_fields: OpenFdaProposedFields
  backlog_comparison: BacklogComparison
  retrieved_at: string | null
  raw_cache_reference: string | null
  decision: 'pending_review'
}

export interface OpenFdaRunSummary {
  format_version: 1
  catalog_input_sha256: string
  catalog_product_count: number
  products_requested: number
  products_processed: number
  products_served_from_cache: number
  api_requests_made: number
  retry_count: number
  high_confidence_count: number
  review_required_count: number
  unmatched_count: number
  insufficient_identifier_count: number
  query_error_count: number
  existing_backlog_conflicts: number
  started_at: string
  completed_at: string
  openfda_endpoint: string
  api_key_used: boolean
}

export interface OpenFdaManifestPartition {
  display_name: string
  file: string
  size_mb?: string | number
  records?: number
}

export interface OpenFdaManifestDataset {
  export_date: string
  partitions: OpenFdaManifestPartition[]
  total_records?: number
}

export interface OpenFdaManifestSnapshot {
  format_version: 1
  retrieved_at: string
  export_date: string
  total_records: number | null
  partition_count: number
  total_size_mb: number | null
  partitions: Array<{
    index: number
    display_name: string
    file: string
    size_mb: number | null
    records: number | null
  }>
}
