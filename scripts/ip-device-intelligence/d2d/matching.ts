import {
  exactIdentifierComparison,
  normalizeManufacturerName,
} from '../../ip-preference-cards/openfda/normalize'

import type { RegulatoryMatchProposal } from '../../../src/features/device-intelligence/domain/product-regulatory'
import type { AcquisitionManifest, PilotCohortArtifact } from './schemas'

interface CanonicalIdentity {
  manufacturer_id: string
  manufacturer: string
  catalog_number: string | null
  gtin: string | null
}

type Candidate = AcquisitionManifest['results'][number]['candidates'][number]
type Result = AcquisitionManifest['results'][number]

function normalizedAliasSet(
  identity: CanonicalIdentity,
  aliases: PilotCohortArtifact['manufacturer_aliases'],
): Set<string> {
  const configured = aliases.find((entry) => entry.manufacturer_id === identity.manufacturer_id)
  return new Set(
    [identity.manufacturer, configured?.canonical_name, ...(configured?.aliases ?? [])]
      .map(normalizeManufacturerName)
      .filter((value): value is string => Boolean(value)),
  )
}

function manufacturerDisposition(
  candidate: Candidate,
  aliases: Set<string>,
): 'match' | 'mismatch' | 'unknown' {
  const normalized = normalizeManufacturerName(candidate.company_name)
  if (!normalized) return 'unknown'
  return aliases.has(normalized) ? 'match' : 'mismatch'
}

function exactCatalogMatch(candidate: Candidate, catalogNumber: string | null): boolean {
  const expected = exactIdentifierComparison(catalogNumber)
  if (!expected) return false
  return [candidate.catalog_number, candidate.model_number].some(
    (value) => exactIdentifierComparison(value) === expected,
  )
}

function exactDiMatch(candidate: Candidate, gtin: string | null): boolean {
  const expected = exactIdentifierComparison(gtin)
  if (!expected) return false
  return [candidate.primary_di, ...candidate.package_dis].some(
    (value) => exactIdentifierComparison(value) === expected,
  )
}

function isPremarketCandidate(candidate: Candidate): boolean {
  return Boolean(candidate.k_number || candidate.pma_number)
}

function isCompleteNoExactSearch(results: Result[]): boolean {
  const completePurposes = new Set(
    results.filter((result) => result.complete).map((result) => result.purpose),
  )
  return ['exact_identity', 'premarket', 'classification', 'registration_listing'].every(
    (purpose) => completePurposes.has(purpose as Result['purpose']),
  )
}

/**
 * Produce a conservative regulatory identity proposal. This is never a final decision: the
 * proposal is copied to the physician-owner review packet and cannot enter the runtime overlay
 * until a distinct reviewed artifact records the disposition.
 */
export function proposeRegulatoryMatch(options: {
  identity: CanonicalIdentity
  results: Result[]
  aliases: PilotCohortArtifact['manufacturer_aliases']
}): RegulatoryMatchProposal & {
  conflict_state:
    | 'none'
    | 'conflicting_exact_records'
    | 'manufacturer_mismatch'
    | 'model_mismatch'
    | 'insufficient_identifiers'
  candidate_count: number
} {
  const { identity, results } = options
  const aliases = normalizedAliasSet(identity, options.aliases)
  const candidates = results.flatMap((result) => result.candidates)
  const candidateCount = candidates.length

  const diCandidates = candidates.filter((candidate) => exactDiMatch(candidate, identity.gtin))
  const catalogCandidates = candidates.filter((candidate) =>
    exactCatalogMatch(candidate, identity.catalog_number),
  )
  const exactIdentityCandidates = [...new Set([...diCandidates, ...catalogCandidates])]
  const manufacturerMismatch = exactIdentityCandidates.some(
    (candidate) => manufacturerDisposition(candidate, aliases) === 'mismatch',
  )
  if (manufacturerMismatch) {
    return {
      match_level: 'ambiguous',
      confidence: 'unresolved',
      conflict_state: 'manufacturer_mismatch',
      reason_codes: ['exact_identifier_manufacturer_mismatch'],
      candidate_count: candidateCount,
    }
  }

  const exactDiAndCatalog = candidates.filter(
    (candidate) =>
      exactDiMatch(candidate, identity.gtin) &&
      exactCatalogMatch(candidate, identity.catalog_number) &&
      manufacturerDisposition(candidate, aliases) !== 'mismatch',
  )
  if (exactDiAndCatalog.length > 1) {
    const recordIdentities = new Set(
      exactDiAndCatalog.map((candidate) =>
        [
          candidate.record_key,
          candidate.primary_di,
          candidate.catalog_number,
          candidate.company_name,
        ].join('|'),
      ),
    )
    if (recordIdentities.size > 1) {
      return {
        match_level: 'ambiguous',
        confidence: 'unresolved',
        conflict_state: 'conflicting_exact_records',
        reason_codes: ['multiple_distinct_exact_udi_catalog_records'],
        candidate_count: candidateCount,
      }
    }
  }
  if (exactDiAndCatalog.length > 0) {
    return {
      match_level: 'exact_udi_catalog_match',
      confidence: 'high',
      conflict_state: 'none',
      reason_codes: ['exact_di', 'exact_catalog_or_model', 'manufacturer_not_conflicted'],
      candidate_count: candidateCount,
    }
  }

  const exactCatalogManufacturer = catalogCandidates.filter(
    (candidate) => manufacturerDisposition(candidate, aliases) === 'match',
  )
  if (exactCatalogManufacturer.some(isPremarketCandidate)) {
    return {
      match_level: 'exact_premarket_submission_match',
      confidence: 'high',
      conflict_state: 'none',
      reason_codes: ['exact_model_in_premarket_record', 'governed_manufacturer_alias_match'],
      candidate_count: candidateCount,
    }
  }
  if (exactCatalogManufacturer.length > 0) {
    return {
      match_level: 'exact_model_manufacturer_match',
      confidence: 'high',
      conflict_state: 'none',
      reason_codes: ['exact_catalog_or_model', 'governed_manufacturer_alias_match'],
      candidate_count: candidateCount,
    }
  }

  const exactDiManufacturer = diCandidates.filter(
    (candidate) => manufacturerDisposition(candidate, aliases) === 'match',
  )
  if (exactDiManufacturer.length > 0) {
    return {
      match_level: 'strong_exact_identity_match',
      confidence: 'moderate',
      conflict_state: 'none',
      reason_codes: ['exact_di', 'governed_manufacturer_alias_match', 'catalog_not_confirmed'],
      candidate_count: candidateCount,
    }
  }

  const familyCandidates = candidates.filter(
    (candidate) =>
      isPremarketCandidate(candidate) && manufacturerDisposition(candidate, aliases) !== 'mismatch',
  )
  if (familyCandidates.length > 0) {
    return {
      match_level: 'family_level_match',
      confidence: 'moderate',
      conflict_state: 'none',
      reason_codes: ['premarket_family_candidate', 'exact_catalog_not_established'],
      candidate_count: candidateCount,
    }
  }

  if (candidates.some((candidate) => Boolean(candidate.product_code))) {
    return {
      match_level: 'product_code_only',
      confidence: 'low',
      conflict_state: 'none',
      reason_codes: ['product_code_without_exact_identity'],
      candidate_count: candidateCount,
    }
  }

  if (candidateCount === 0 && isCompleteNoExactSearch(results)) {
    return {
      match_level: 'no_exact_record_found',
      confidence: 'unresolved',
      conflict_state: 'insufficient_identifiers',
      reason_codes: ['complete_documented_search_no_exact_record'],
      candidate_count: 0,
    }
  }

  if (results.length === 0) {
    return {
      match_level: 'not_searched',
      confidence: 'unresolved',
      conflict_state: 'insufficient_identifiers',
      reason_codes: ['no_regulatory_queries_executed'],
      candidate_count: 0,
    }
  }

  return {
    match_level: 'ambiguous',
    confidence: 'unresolved',
    conflict_state: 'insufficient_identifiers',
    reason_codes: ['documented_search_incomplete_for_negative_conclusion'],
    candidate_count: candidateCount,
  }
}
