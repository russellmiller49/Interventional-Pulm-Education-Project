import {
  hasCompleteReviewedOverlay,
  hasNoReviewedOverlay,
  isCuratedReviewedOverlay,
  type LiteratureReviewedOverlayCandidate,
} from '@/features/literature/domain/reviewed-overlay'

const completeOverlay: LiteratureReviewedOverlayCandidate = {
  reviewed_relevance: 'include_core',
  reviewed_enrichment_provenance: 'physician_confirmed',
  reviewed_source_identity: 'synthetic-reviewed-source',
  reviewed_at: '2026-08-16T12:00:00.000Z',
  reviewed_operation_id: '00000000-0000-4000-8000-000000000001',
}

describe('physician-reviewed overlay membership', () => {
  it('requires all five reviewed fields', () => {
    expect(hasCompleteReviewedOverlay(completeOverlay)).toBe(true)

    for (const field of Object.keys(completeOverlay) as Array<keyof typeof completeOverlay>) {
      expect(
        hasCompleteReviewedOverlay({
          ...completeOverlay,
          [field]: null,
        }),
      ).toBe(false)
    }
  })

  it('includes both fine reviewed-relevant classes in Curated', () => {
    expect(isCuratedReviewedOverlay(completeOverlay)).toBe(true)
    expect(
      isCuratedReviewedOverlay({
        ...completeOverlay,
        reviewed_relevance: 'include_adjacent',
      }),
    ).toBe(true)
  })

  it('keeps reviewed exclusions and unreviewed rows out of Curated', () => {
    expect(
      isCuratedReviewedOverlay({
        ...completeOverlay,
        reviewed_relevance: 'exclude',
      }),
    ).toBe(false)

    const unreviewed: LiteratureReviewedOverlayCandidate = {
      reviewed_relevance: null,
      reviewed_enrichment_provenance: null,
      reviewed_source_identity: null,
      reviewed_at: null,
      reviewed_operation_id: null,
    }
    expect(hasNoReviewedOverlay(unreviewed)).toBe(true)
    expect(isCuratedReviewedOverlay(unreviewed)).toBe(false)
  })

  it('never substitutes the coarse workflow relevance state for reviewed truth', () => {
    expect(
      isCuratedReviewedOverlay({
        ...completeOverlay,
        reviewed_relevance: null,
        // A coarse inclusion value may exist on the article, but it is deliberately irrelevant to
        // this five-field candidate and cannot confer Curated membership.
        relevance_state: 'included',
      } as LiteratureReviewedOverlayCandidate),
    ).toBe(false)
  })
})
