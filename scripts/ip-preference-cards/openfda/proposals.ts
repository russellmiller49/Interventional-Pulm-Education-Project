import { openFdaEnrichmentProposalSchema } from './schemas'
import { classifyOpenFdaMatch, primaryIdentifier } from './classify-match'
import type {
  BacklogComparison,
  CatalogProductInput,
  ManufacturerAliasGroup,
  OpenFdaClassification,
  OpenFdaEnrichmentProposal,
  OpenFdaMatchedCandidate,
  OpenFdaProposedFields,
  OpenFdaQueryAttemptSummary,
  VerificationBacklogInput,
} from './types'

export function emptyOpenFdaProposedFields(): OpenFdaProposedFields {
  return {
    primary_di: null,
    additional_identifiers: [],
    brand_name: null,
    company_name: null,
    version_or_model_number: null,
    device_description: null,
    device_count_in_base_package: null,
    device_sizes: [],
    commercial_distribution_status: null,
    commercial_distribution_end_date: null,
    is_kit: null,
    is_single_use: null,
    sterilization: null,
    storage: [],
    product_codes: [],
    premarket_submissions: [],
    public_version_date: null,
    record_status: null,
  }
}

function proposedFields(candidate: OpenFdaMatchedCandidate | null): OpenFdaProposedFields {
  if (!candidate) return emptyOpenFdaProposedFields()
  const record = candidate.record
  const primaryDi = primaryIdentifier(record)
  return {
    primary_di: primaryDi,
    additional_identifiers: [...(record.identifiers ?? [])]
      .filter((identifier) => identifier.id !== primaryDi)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((identifier) => ({
        id: identifier.id,
        type: identifier.type ?? null,
        issuing_agency: identifier.issuing_agency ?? null,
        unit_of_use_id: identifier.unit_of_use_id ?? null,
        package_status: identifier.package_status ?? null,
        package_type: identifier.package_type ?? null,
      })),
    brand_name: record.brand_name ?? null,
    company_name: record.company_name ?? null,
    version_or_model_number: record.version_or_model_number ?? null,
    device_description: record.device_description ?? null,
    device_count_in_base_package: record.device_count_in_base_package ?? null,
    device_sizes: [...(record.device_sizes ?? [])],
    commercial_distribution_status: record.commercial_distribution_status ?? null,
    commercial_distribution_end_date: record.commercial_distribution_end_date ?? null,
    is_kit: record.is_kit ?? null,
    is_single_use: record.is_single_use ?? null,
    sterilization: record.sterilization ?? null,
    storage: [...(record.storage ?? [])],
    product_codes: [...(record.product_codes ?? [])],
    premarket_submissions: [...(record.premarket_submissions ?? [])],
    public_version_date: record.public_version_date ?? null,
    record_status: record.record_status ?? null,
  }
}

function latest(values: string[]): string | null {
  return [...new Set(values)].sort().at(-1) ?? null
}

export function buildOpenFdaEnrichmentProposal({
  product,
  aliasGroup,
  backlog = null,
  candidates,
  queryAttempts,
  forcedClassification,
  forcedReasonCodes = [],
  retrievedAt = [],
  rawCacheReferences = [],
}: {
  product: CatalogProductInput
  aliasGroup: ManufacturerAliasGroup
  backlog?: VerificationBacklogInput | null
  candidates: OpenFdaMatchedCandidate[]
  queryAttempts: OpenFdaQueryAttemptSummary[]
  forcedClassification?: Extract<OpenFdaClassification, 'query_error' | 'insufficient_identifiers'>
  forcedReasonCodes?: string[]
  retrievedAt?: string[]
  rawCacheReferences?: string[]
}): OpenFdaEnrichmentProposal {
  const result = forcedClassification
    ? {
        classification: forcedClassification,
        reasonCodes: [...forcedReasonCodes].sort(),
        selectedCandidate: null,
        selectedCandidateSummary: null,
        backlogComparison: (backlog
          ? 'existing_backlog_has_more_specific_match'
          : 'not_previously_evaluated') as BacklogComparison,
      }
    : classifyOpenFdaMatch({ product, aliasGroup, backlog, candidates })
  const selectedRetrievedAt = result.selectedCandidate?.retrievedAt ?? retrievedAt
  const selectedReferences = result.selectedCandidate?.rawCacheReferences ?? rawCacheReferences
  const proposal: OpenFdaEnrichmentProposal = {
    format_version: 1,
    product_id: product.product_id,
    manufacturer: product.manufacturer,
    product_name: product.product_name,
    catalog_number: product.catalog_number,
    classification: result.classification,
    reason_codes: result.reasonCodes,
    query_attempts: [...queryAttempts],
    candidate_count: candidates.length,
    selected_candidate: result.selectedCandidateSummary,
    proposed_fields: proposedFields(result.selectedCandidate),
    backlog_comparison: result.backlogComparison,
    retrieved_at: latest(selectedRetrievedAt),
    raw_cache_reference: [...new Set(selectedReferences)].sort()[0] ?? null,
    decision: 'pending_review',
  }
  return openFdaEnrichmentProposalSchema.parse(proposal)
}

export function stableSortOpenFdaProposals(
  proposals: OpenFdaEnrichmentProposal[],
): OpenFdaEnrichmentProposal[] {
  return [...proposals].sort((left, right) => left.product_id.localeCompare(right.product_id))
}
