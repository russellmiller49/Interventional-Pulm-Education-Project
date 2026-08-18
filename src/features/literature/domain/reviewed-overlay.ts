export const literatureReviewedRelevanceValues = [
  'include_core',
  'include_adjacent',
  'exclude',
] as const

export const literatureReviewedEnrichmentProvenanceValues = [
  'physician_confirmed',
  'physician_modified',
  'qc_accepted',
] as const

export const literatureCuratedRelevanceValues = ['include_core', 'include_adjacent'] as const

export type LiteratureReviewedRelevance = (typeof literatureReviewedRelevanceValues)[number]
export type LiteratureReviewedEnrichmentProvenance =
  (typeof literatureReviewedEnrichmentProvenanceValues)[number]

/**
 * The database shape used to decide whether a row carries the physician-reviewed overlay.
 *
 * The five fields are intentionally modeled together. A row is reviewed only when every field is
 * populated; `relevance_state = included` is a separate, coarser workflow value and is never part
 * of this decision.
 */
export interface LiteratureReviewedOverlayCandidate {
  reviewed_relevance: unknown
  reviewed_enrichment_provenance: unknown
  reviewed_source_identity: unknown
  reviewed_at: unknown
  reviewed_operation_id: unknown
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T)
}

function isPopulatedString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function hasCompleteReviewedOverlay(
  candidate: LiteratureReviewedOverlayCandidate,
): candidate is LiteratureReviewedOverlayCandidate & {
  reviewed_relevance: LiteratureReviewedRelevance
  reviewed_enrichment_provenance: LiteratureReviewedEnrichmentProvenance
  reviewed_source_identity: string
  reviewed_at: string
  reviewed_operation_id: string
} {
  return (
    isOneOf(candidate.reviewed_relevance, literatureReviewedRelevanceValues) &&
    isOneOf(
      candidate.reviewed_enrichment_provenance,
      literatureReviewedEnrichmentProvenanceValues,
    ) &&
    isPopulatedString(candidate.reviewed_source_identity) &&
    isPopulatedString(candidate.reviewed_at) &&
    isPopulatedString(candidate.reviewed_operation_id)
  )
}

export function hasNoReviewedOverlay(candidate: LiteratureReviewedOverlayCandidate): boolean {
  return (
    candidate.reviewed_relevance === null &&
    candidate.reviewed_enrichment_provenance === null &&
    candidate.reviewed_source_identity === null &&
    candidate.reviewed_at === null &&
    candidate.reviewed_operation_id === null
  )
}

export function isCuratedReviewedOverlay(candidate: LiteratureReviewedOverlayCandidate): boolean {
  return (
    hasCompleteReviewedOverlay(candidate) &&
    literatureCuratedRelevanceValues.includes(
      candidate.reviewed_relevance as (typeof literatureCuratedRelevanceValues)[number],
    )
  )
}
