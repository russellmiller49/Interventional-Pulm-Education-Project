export const COHORT_PARTITIONS = [
  'us_status_pending',
  'identity_or_specification_pending_candidate',
  'identity_or_specification_pending_unknown',
] as const

export type CohortPartition = (typeof COHORT_PARTITIONS)[number]

export const IDENTIFIER_COMPLETENESS_VALUES = [
  'exact_di',
  'catalog_number',
  'model_only',
  'insufficient',
] as const

export type IdentifierCompleteness = (typeof IDENTIFIER_COMPLETENESS_VALUES)[number]

export const ARTIFACT_FRESHNESS_VALUES = ['current', 'stale', 'unverifiable'] as const

export type ArtifactFreshness = (typeof ARTIFACT_FRESHNESS_VALUES)[number]

export const GUDID_IDENTITY_EVIDENCE_VALUES = [
  'strong_candidate',
  'weak_candidate_only',
  'unmatched',
] as const

export type GudidIdentityEvidence = (typeof GUDID_IDENTITY_EVIDENCE_VALUES)[number]

export const GUDID_DISTRIBUTION_EVIDENCE_VALUES = [
  'in_distribution',
  'not_in_distribution',
  'conflicting',
  'unknown',
] as const

export type GudidDistributionEvidence = (typeof GUDID_DISTRIBUTION_EVIDENCE_VALUES)[number]

export const DEVICE_INTELLIGENCE_EXEMPLARS = [
  'CHEST_TUBE',
  'EBUS_TBNA',
  'THERAPEUTIC_BRONCH',
] as const

export type DeviceIntelligenceExemplar = (typeof DEVICE_INTELLIGENCE_EXEMPLARS)[number]

export interface CohortCatalogProductInput {
  product_id: string
  manufacturer_id: string
  manufacturer: string | null
  product_name: string
  catalog_number: string | null
  alternate_ids: string | null
  gtin: string | null
  global_part_number: string | null
  reference_part_number: string | null
  spec_json?: Record<string, unknown> | null
  verification_grade: 'verified_source' | 'candidate' | 'unknown'
  visibility_state: 'prototype_visible' | 'hidden'
}

export interface CohortProductRoleInput {
  product_id: string
  role_code: string
  role_fit: string | null
}

export interface CohortProcedureSlotInput {
  slot_id: string
  procedure_code: string
  role_code: string
}

export interface CohortSlotProductOptionInput {
  slot_id: string
  product_id: string
  role_code: string
  selectable: boolean
}

export interface CohortProductSourceInput {
  product_id: string
  source_id: string
}

export interface CohortGudidConfirmationInput {
  product_id: string
  match_strength: 'manufacturer_and_catalog_number' | 'catalog_number_only'
  gudid_primary_di: string
  gudid_distribution_status: string
}

export interface CohortGudidReportInput {
  catalog_products: number
  confirmations: CohortGudidConfirmationInput[]
}

export interface CohortOpenFdaProposalInput {
  product_id: string
  classification:
    | 'high_confidence_candidate'
    | 'review_required'
    | 'unmatched'
    | 'insufficient_identifiers'
    | 'query_error'
  reason_codes: string[]
  selected_candidate: {
    primary_di: string | null
    catalog_number: string | null
    version_or_model_number: string | null
    commercial_distribution_status: string | null
  } | null
  backlog_comparison: string
}

export interface CohortOpenFdaRunSummaryInput {
  catalog_input_sha256: string
  catalog_product_count: number
  products_processed: number
}

export interface CohortInputHashes {
  catalog_products_sha256: string
  product_roles_sha256: string
  procedure_slots_sha256: string
  slot_product_options_sha256: string
  product_sources_sha256: string
  gudid_confirmations_sha256: string
  openfda_proposals_sha256: string
  openfda_run_summary_sha256: string
}

export interface BuildCohortManifestInput {
  catalogProducts: CohortCatalogProductInput[]
  productRoles: CohortProductRoleInput[]
  procedureSlots: CohortProcedureSlotInput[]
  slotProductOptions: CohortSlotProductOptionInput[]
  productSources: CohortProductSourceInput[]
  gudidReport: CohortGudidReportInput
  openFdaProposals: CohortOpenFdaProposalInput[]
  openFdaRunSummary: CohortOpenFdaRunSummaryInput
  inputHashes: CohortInputHashes
  gitSha: string
}

export interface CohortMappedRole {
  role_code: string
  role_fit: string | null
}

export interface CohortGudidContext {
  artifact_freshness: ArtifactFreshness
  confirmation_count: number
  strong_match_count: number
  weak_match_count: number
  identity_evidence: GudidIdentityEvidence
  distribution_evidence: GudidDistributionEvidence
  primary_dis: string[]
  distribution_statuses: string[]
}

export interface CohortOpenFdaContext {
  artifact_freshness: ArtifactFreshness
  proposal_present: boolean
  classification: CohortOpenFdaProposalInput['classification'] | null
  reason_codes: string[]
  candidate_primary_di: string | null
  candidate_catalog_number: string | null
  candidate_model_number: string | null
  commercial_distribution_status: string | null
  backlog_comparison: string | null
}

export interface HiddenProductCohortRow {
  product_id: string
  manufacturer_id: string
  manufacturer: string | null
  product_name: string
  catalog_number: string | null
  model_number: string | null
  model_number_source: 'spec_json.manufacturer_model_number' | null
  gtin_di: string | null
  global_part_number: string | null
  reference_part_number: string | null
  alternate_ids: string[]
  verification_grade: CohortCatalogProductInput['verification_grade']
  visibility_state: 'hidden'
  cohort_partition: CohortPartition
  identifier_completeness: IdentifierCompleteness
  mapped_roles: CohortMappedRole[]
  authored_slot_use_count: number
  selectable_slot_use_count: number
  authored_slot_ids: string[]
  authored_procedure_codes: string[]
  role_mapped_procedure_codes: string[]
  device_intelligence_exemplar_flags: Record<DeviceIntelligenceExemplar, boolean>
  source_ids: string[]
  source_count: number
  existing_gudid: CohortGudidContext
  existing_openfda: CohortOpenFdaContext
  canonical_change_applied: false
}

export interface HiddenProductCohortManifest {
  format_version: 1
  generated_by: 'scripts/ip-preference-cards/us-status/build-cohort-manifest.ts'
  git_sha: string
  canonical_change_applied: false
  cohort_definition: {
    included_visibility_state: 'hidden'
    us_status_pending_predicate: 'visibility_state === "hidden" && verification_grade === "verified_source"'
  }
  input_hashes: CohortInputHashes
  evidence_artifacts: {
    gudid: {
      artifact_freshness: ArtifactFreshness
      artifact_catalog_product_count: number
      current_catalog_product_count: number
    }
    openfda: {
      artifact_freshness: ArtifactFreshness
      artifact_catalog_product_count: number
      artifact_catalog_input_sha256: string
      current_catalog_product_count: number
      current_catalog_input_sha256: string
      products_processed: number
    }
  }
  counts: {
    catalog_products_total: number
    prototype_visible_products: number
    hidden_products: number
    hidden_verified_source: number
    hidden_candidate: number
    hidden_unknown: number
    identifier_completeness: Record<IdentifierCompleteness, number>
    mapped_role_rows: number
    authored_slot_uses: number
    selectable_slot_uses: number
    products_with_authored_slot_use: number
    products_with_selectable_slot_use: number
  }
  products: HiddenProductCohortRow[]
}
