import type { SupabaseClient } from '@supabase/supabase-js'

import {
  literatureGoldExportSamplingContext,
  parseLiteratureGoldSetCsv,
  serializeLiteratureGoldSetCsv,
  type LiteratureGoldExport,
} from '@/features/literature/gold-set/export'
import { exportLiteratureGoldSet } from '@/features/literature/server/gold-set'

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
            relevanceLabel: 'include_core',
            metadataSufficiency: 'adequate_abstract',
            reviewerConfidence: 'high',
            topicIds: ['ebus-mediastinal-staging'],
            technologyTags: [],
            clinicalPurposes: ['diagnosis'],
            diseaseTags: [],
            studyDesign: 'diagnostic-accuracy',
            publicationStatus: 'full-article',
            categorizationFromFullText: true,
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
    expect(rows[0].review.relevanceLabel).toBe('include_core')
    expect(rows[0].review.categorizationFromFullText).toBe(true)
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

  it('blocks test and all-record exports before the audited test unlock', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'gold-set-v1',
        kind: 'gold_standard',
        test_unlocked_at: null,
      },
      error: null,
    })
    const countSecondEq = jest.fn().mockResolvedValue({ count: 30, error: null })
    const countFirstEq = jest.fn(() => ({ eq: countSecondEq }))
    const from = jest.fn((table: string) =>
      table === 'literature_gold_set_batches'
        ? { select: () => ({ eq: () => ({ maybeSingle }) }) }
        : { select: () => ({ eq: countFirstEq }) },
    )
    const client = { from } as unknown as SupabaseClient

    const result = await exportLiteratureGoldSet(
      '00000000-0000-4000-8000-000000000001',
      'all',
      false,
      client,
    )

    expect(result.data).toBeNull()
    expect(result.error).toMatch(/test split is locked/u)
    expect(from).toHaveBeenCalledTimes(2)
    expect(countSecondEq).toHaveBeenCalledWith('dataset_split', 'test')
  })

  it('allows all-record export when a legacy gold-standard batch has no test rows', async () => {
    const itemRange = jest.fn().mockResolvedValue({ data: [], error: null })
    const itemOrder = jest.fn(() => ({ range: itemRange }))
    const itemEq = jest
      .fn()
      .mockReturnValueOnce({
        eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
      })
      .mockReturnValueOnce({ order: itemOrder })
    const from = jest.fn((table: string) => {
      if (table === 'literature_gold_set_batches') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  id: '00000000-0000-4000-8000-000000000001',
                  name: 'legacy-gold-set',
                  kind: 'gold_standard',
                  status: 'active',
                  taxonomy_version: '1.0.0',
                  label_schema_version: '1.0.0',
                  relevance_definition_version: '1.0.0',
                  sampling_algorithm_version: 'stratified-v1',
                  sampling_seed: 1,
                  requested_size: 1,
                  test_unlocked_at: null,
                  frozen_at: null,
                },
                error: null,
              }),
            }),
          }),
        }
      }
      return { select: () => ({ eq: itemEq }) }
    })
    const client = { from } as unknown as SupabaseClient

    const result = await exportLiteratureGoldSet(
      '00000000-0000-4000-8000-000000000001',
      'all',
      false,
      client,
    )

    expect(result.error).toBeNull()
    expect(result.data?.records).toEqual([])
  })
})
