import {
  literatureGoldExportSamplingContext,
  parseLiteratureGoldSetCsv,
  serializeLiteratureGoldSetCsv,
  type LiteratureGoldExport,
} from '@/features/literature/gold-set/export'

describe('gold-set CSV backup', () => {
  it('round-trips notes containing commas, quotes, and newlines', () => {
    const fixture: LiteratureGoldExport = {
      exportVersion: '1.0.0',
      exportedAt: '2026-07-27T00:00:00.000Z',
      batch: {
        id: 'batch-id',
        name: 'pilot-v1',
        kind: 'pilot',
        status: 'active',
        taxonomyVersion: '1',
        labelSchemaVersion: '1',
        relevanceDefinitionVersion: '1',
        samplingAlgorithmVersion: '1',
        samplingSeed: 20_260_727,
        requestedSize: 1,
        frozenAt: null,
      },
      split: 'all',
      includesHistory: false,
      records: [
        {
          itemId: 'item-id',
          pmid: '123',
          title: 'A title',
          abstract: 'Abstract',
          authors: [],
          journalTitle: null,
          journalAbbreviation: null,
          publicationYear: 2026,
          publicationTypes: [],
          sampleStratum: 'ambiguous_boundary',
          samplingReason: 'test',
          datasetSplit: 'development',
          displayOrder: 1,
          reviewStatus: 'completed',
          reviewSource: 'completed',
          review: {
            id: 'review-id',
            revision: 1,
            relevanceLabel: 'exclude',
            metadataSufficiency: 'adequate_abstract',
            reviewerConfidence: 'high',
            topicIds: [],
            technologyTags: [],
            clinicalPurposes: [],
            diseaseTags: [],
            studyDesign: null,
            publicationStatus: null,
            notes: '=HYPERLINK("https://example.invalid"), comma, and\nnew line',
            usedSupplementalMetadata: false,
            reviewSeconds: 30,
            isBlinded: true,
            reviewerEmail: null,
            completedAt: '2026-07-27T00:00:00.000Z',
          },
        },
      ],
    }

    const csv = serializeLiteratureGoldSetCsv(fixture)
    const rows = parseLiteratureGoldSetCsv(csv)

    expect(csv).toContain(`"'=HYPERLINK`)
    expect(rows).toHaveLength(1)
    expect(rows[0].itemId).toBe('item-id')
    expect(rows[0].review.notes).toBe('=HYPERLINK("https://example.invalid"), comma, and\nnew line')
    expect(rows[0].review.relevanceLabel).toBe('exclude')
  })

  it('redacts sampling signals until the first completed decision', () => {
    expect(
      literatureGoldExportSamplingContext(
        false,
        'strong_likely_ip',
        'deterministic score and source-query rationale',
      ),
    ).toEqual({ sampleStratum: null, samplingReason: null })

    expect(
      literatureGoldExportSamplingContext(
        true,
        'strong_likely_ip',
        'deterministic score and source-query rationale',
      ),
    ).toEqual({
      sampleStratum: 'strong_likely_ip',
      samplingReason: 'deterministic score and source-query rationale',
    })
  })
})
