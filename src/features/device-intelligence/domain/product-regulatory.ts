import type { D2dConfidence } from './product-profile'

/**
 * Phase D2D regulatory-evidence vocabulary.
 *
 * This deliberately contains no single `fda_status` and no generic `approved` boolean.
 * Identity, UDI, classification, premarket review, registration/listing, commercial
 * distribution, D2B market status, and D2B safety status remain independent axes.
 */

export const REGULATORY_MATCH_LEVELS = [
  'exact_udi_catalog_match',
  'exact_model_manufacturer_match',
  'exact_premarket_submission_match',
  'strong_exact_identity_match',
  'family_level_match',
  'product_code_only',
  'ambiguous',
  'no_exact_record_found',
  'not_searched',
] as const
export type RegulatoryMatchLevel = (typeof REGULATORY_MATCH_LEVELS)[number]

export const REGULATORY_EVIDENCE_SCOPES = ['exact', 'family', 'product_code'] as const
export type RegulatoryEvidenceScope = (typeof REGULATORY_EVIDENCE_SCOPES)[number]

export const REGULATORY_RESEARCH_STATES = ['reviewed', 'unresolved'] as const
export type RegulatoryResearchState = (typeof REGULATORY_RESEARCH_STATES)[number]

export const REGULATORY_REVIEW_DECISIONS = [
  'pending_owner_review',
  'approved',
  'unresolved',
  'rejected',
  'needs_revision',
] as const
export type RegulatoryReviewDecision = (typeof REGULATORY_REVIEW_DECISIONS)[number]

export const REGULATORY_CONCLUSION_CODES = [
  'cleared_510k',
  'approved_pma',
  'granted_de_novo',
  'approved_hde',
  'premarket_exempt_classification',
  'fda_listed_device',
  'exact_identity_unresolved',
  'not_yet_researched',
] as const
export type RegulatoryConclusionCode = (typeof REGULATORY_CONCLUSION_CODES)[number]

export const COMMERCIAL_DISTRIBUTION_STATES = [
  'in_distribution',
  'not_in_distribution',
  'conflicted',
  'not_reported',
] as const
export type CommercialDistributionState = (typeof COMMERCIAL_DISTRIBUTION_STATES)[number]

export const DEVICE_CLASSES = ['I', 'II', 'III', 'unclassified', 'unknown'] as const
export type DeviceClass = (typeof DEVICE_CLASSES)[number]

export type RegulatoryPathwayRecord =
  | {
      pathway: '510k'
      submission_number: string
      decision:
        | 'substantially_equivalent'
        | 'not_substantially_equivalent'
        | 'withdrawn'
        | 'unknown'
      decision_date: string | null
      evidence_scope: RegulatoryEvidenceScope
    }
  | {
      pathway: 'pma'
      submission_number: string
      decision: 'approved' | 'denied' | 'withdrawn' | 'unknown'
      decision_date: string | null
      evidence_scope: RegulatoryEvidenceScope
    }
  | {
      pathway: 'de_novo'
      submission_number: string
      decision: 'granted' | 'declined' | 'withdrawn' | 'unknown'
      decision_date: string | null
      evidence_scope: RegulatoryEvidenceScope
    }
  | {
      pathway: 'hde'
      submission_number: string
      decision: 'approved' | 'denied' | 'withdrawn' | 'unknown'
      decision_date: string | null
      evidence_scope: RegulatoryEvidenceScope
    }
  | {
      pathway: 'premarket_exempt'
      submission_number: null
      decision: 'exempt'
      decision_date: null
      evidence_scope: RegulatoryEvidenceScope
    }

export interface RegulatoryConclusionInput {
  researchState: RegulatoryResearchState
  matchLevel: RegulatoryMatchLevel
  pathways: RegulatoryPathwayRecord[]
  exactListingFound: boolean
}

const EXACT_MATCH_LEVELS = new Set<RegulatoryMatchLevel>([
  'exact_udi_catalog_match',
  'exact_model_manufacturer_match',
  'exact_premarket_submission_match',
  'strong_exact_identity_match',
])

/**
 * Derive public conclusion codes from independently reviewed axes.
 *
 * Family- and product-code-only evidence can never emit an exact authorization statement.
 * Registration/listing can emit only its own listing code, and only when the match is exact.
 */
export function deriveRegulatoryConclusionCodes(
  input: RegulatoryConclusionInput,
): RegulatoryConclusionCode[] {
  if (
    input.researchState === 'unresolved' ||
    input.matchLevel === 'ambiguous' ||
    input.matchLevel === 'no_exact_record_found'
  ) {
    return ['exact_identity_unresolved']
  }
  if (input.matchLevel === 'not_searched') return ['not_yet_researched']

  const exactIdentity = EXACT_MATCH_LEVELS.has(input.matchLevel)
  const conclusions = new Set<RegulatoryConclusionCode>()
  if (exactIdentity) {
    for (const record of input.pathways) {
      if (record.evidence_scope !== 'exact') continue
      if (record.pathway === '510k' && record.decision === 'substantially_equivalent') {
        conclusions.add('cleared_510k')
      } else if (record.pathway === 'pma' && record.decision === 'approved') {
        conclusions.add('approved_pma')
      } else if (record.pathway === 'de_novo' && record.decision === 'granted') {
        conclusions.add('granted_de_novo')
      } else if (record.pathway === 'hde' && record.decision === 'approved') {
        conclusions.add('approved_hde')
      } else if (record.pathway === 'premarket_exempt' && record.decision === 'exempt') {
        conclusions.add('premarket_exempt_classification')
      }
    }
    if (input.exactListingFound) conclusions.add('fda_listed_device')
  }
  return [...conclusions].sort()
}

export interface RegulatoryMatchProposal {
  match_level: RegulatoryMatchLevel
  confidence: D2dConfidence
  reason_codes: string[]
}
