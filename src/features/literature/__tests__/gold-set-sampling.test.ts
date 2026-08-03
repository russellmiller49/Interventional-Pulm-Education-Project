import type { LiteratureGoldSamplingCandidate } from '@/features/literature/gold-set/types'
import {
  assertLiteratureGoldPriorAutomaticSamplesUnchanged,
  classifyLiteratureGoldDeterministicBand,
  sampleLiteratureGoldSet,
} from '@/features/literature/gold-set/sampling'
import { literatureGoldCreateOptionsSchema } from '@/features/literature/schemas/gold-set'

function candidate(
  pmid: number,
  overrides: Partial<LiteratureGoldSamplingCandidate> = {},
): LiteratureGoldSamplingCandidate {
  return {
    pmid: String(pmid),
    journalId: `journal-${pmid % 12}`,
    journalLabel: `Journal ${pmid % 12}`,
    publicationYear: 1990 + (pmid % 36),
    hasAbstract: pmid % 10 !== 0,
    isConferenceAbstract: pmid % 17 === 0,
    isLandmark: false,
    sourceKinds:
      pmid % 7 === 0
        ? ['all_pubmed_discovery']
        : pmid % 5 === 0
          ? ['core_journal', 'all_pubmed_discovery']
          : ['core_journal'],
    sourceCount: pmid % 5 === 0 ? 2 : 1,
    sourceFileCount: pmid % 5 === 0 ? 2 : 1,
    queryIds: pmid % 4 === 0 ? ['query-a', 'query-b'] : ['query-a'],
    suggestedTopicIds: pmid % 3 === 0 ? ['central-airway-obstruction'] : ['pleural-interventions'],
    suggestionCount: pmid % 6,
    maxSuggestionConfidence: (pmid % 10) / 10,
    ...overrides,
  }
}

const candidates = Array.from({ length: 1_200 }, (_, index) => candidate(index + 1))

describe('gold-set sampling', () => {
  const options = {
    name: 'gold-v1',
    kind: 'gold_standard' as const,
    size: 900,
    seed: 20_260_727,
    testPercent: 30,
    generatedAt: '2026-07-27T00:00:00.000Z',
  }

  it('is reproducible for the same seed', () => {
    const first = sampleLiteratureGoldSet(candidates, options)
    const second = sampleLiteratureGoldSet(candidates, options)

    expect(second).toEqual(first)
  })

  it('changes the selection order for a different seed', () => {
    const first = sampleLiteratureGoldSet(candidates, options)
    const second = sampleLiteratureGoldSet(candidates, { ...options, seed: options.seed + 1 })

    expect(second.items.map((item) => item.pmid)).not.toEqual(first.items.map((item) => item.pmid))
  })

  it('uses pilot-calibrated thresholds that preserve a genuine intermediate band', () => {
    expect(classifyLiteratureGoldDeterministicBand(0)).toBe('low')
    expect(classifyLiteratureGoldDeterministicBand(0.0999)).toBe('low')
    expect(classifyLiteratureGoldDeterministicBand(0.1)).toBe('intermediate')
    expect(classifyLiteratureGoldDeterministicBand(0.7499)).toBe('intermediate')
    expect(classifyLiteratureGoldDeterministicBand(0.75)).toBe('high')
  })

  it('samples unique PMIDs and produces a 70/30 split', () => {
    const report = sampleLiteratureGoldSet(candidates, options)
    const pmids = report.items.map((item) => item.pmid)

    expect(report.selectedCount).toBe(900)
    expect(report.reportVersion).toBe('1.2.0')
    expect(new Set(pmids).size).toBe(900)
    expect(report.developmentCount).toBe(630)
    expect(report.testCount).toBe(270)
    expect(report.items.map((item) => item.displayOrder)).toEqual(
      Array.from({ length: 900 }, (_, index) => index + 1),
    )
  })

  it('rejects gold-standard configurations that cannot produce both splits', () => {
    expect(
      literatureGoldCreateOptionsSchema.safeParse({
        ...options,
        size: 1,
      }).success,
    ).toBe(false)
    expect(
      literatureGoldCreateOptionsSchema.safeParse({
        ...options,
        testPercent: 0,
      }).success,
    ).toBe(false)
    expect(() =>
      sampleLiteratureGoldSet(candidates, {
        ...options,
        size: 2,
        testPercent: 1,
      }),
    ).toThrow('at least one development and one test item')
  })

  it('keeps a single journal from filling the sample when alternatives exist', () => {
    const report = sampleLiteratureGoldSet(candidates, { ...options, size: 120 })

    expect(Math.max(...Object.values(report.countsByJournal))).toBeLessThan(30)
  })

  it('excludes PMIDs already used in a prior automatic batch', () => {
    const excludedPmids = candidates.slice(0, 100).map((value) => value.pmid)
    const report = sampleLiteratureGoldSet(candidates, {
      ...options,
      size: 100,
      exclusionSources: [
        {
          sourceType: 'prior_automatic_batches',
          pmids: excludedPmids,
          batchNames: ['pilot-v1'],
        },
      ],
    })

    expect(report.originalCandidateCount).toBe(1200)
    expect(report.excludedCandidateCount).toBe(100)
    expect(report.candidateCount).toBe(1100)
    expect(report.items).toHaveLength(100)
    expect(report.items.some((item) => excludedPmids.includes(item.pmid))).toBe(false)
    expect(report.exclusionSources).toEqual([
      {
        sourceType: 'prior_automatic_batches',
        path: null,
        sha256: null,
        batchNames: ['pilot-v1'],
        suppliedCount: 100,
        corpusPresentCount: 100,
        eligibleCount: 100,
        excludedCount: 100,
      },
    ])
    expect(report.warnings).toContain(
      '100 previously sampled candidate PMIDs were excluded from selection.',
    )
  })

  it('excludes a manifest from both gold-standard splits with per-source provenance', () => {
    const baseline = sampleLiteratureGoldSet(candidates, { ...options, size: 300 })
    const developmentPmids = baseline.items
      .filter((item) => item.datasetSplit === 'development')
      .map((item) => item.pmid)
    const testPmid = baseline.items.find((item) => item.datasetSplit === 'test')!.pmid
    const priorAndManifestPmid = developmentPmids[0]
    const priorOnlyPmid = developmentPmids[1]
    const manifestPmids = [priorAndManifestPmid, testPmid, '999999999999']
    const samplingOptions = {
      ...options,
      size: 300,
      exclusionSources: [
        {
          sourceType: 'pmid_manifest' as const,
          pmids: manifestPmids,
          path: '/fixtures/excluded-pmids.txt',
          sha256: 'a'.repeat(64),
        },
        {
          sourceType: 'prior_automatic_batches' as const,
          pmids: [priorAndManifestPmid, priorOnlyPmid],
          batchNames: ['pilot-v1'],
        },
      ],
    }

    const report = sampleLiteratureGoldSet(candidates, samplingOptions)
    const repeat = sampleLiteratureGoldSet(candidates, samplingOptions)
    const excludedPmids = new Set([...manifestPmids, priorOnlyPmid])

    expect(repeat).toEqual(report)
    expect(report.excludedCandidateCount).toBe(3)
    expect(report.candidateCount).toBe(1197)
    expect(report.exclusionSources).toEqual([
      {
        sourceType: 'prior_automatic_batches',
        path: null,
        sha256: null,
        batchNames: ['pilot-v1'],
        suppliedCount: 2,
        corpusPresentCount: 2,
        eligibleCount: 2,
        excludedCount: 2,
      },
      {
        sourceType: 'pmid_manifest',
        path: '/fixtures/excluded-pmids.txt',
        sha256: 'a'.repeat(64),
        batchNames: [],
        suppliedCount: 3,
        corpusPresentCount: 2,
        eligibleCount: 1,
        excludedCount: 1,
      },
    ])
    for (const split of ['development', 'test'] as const) {
      expect(
        report.items
          .filter((item) => item.datasetSplit === split)
          .some((item) => excludedPmids.has(item.pmid)),
      ).toBe(false)
    }
  })

  it('applies a manifest to automatic pilot sampling before development assignment', () => {
    const manifestPmids = candidates.slice(0, 25).map((value) => value.pmid)
    const report = sampleLiteratureGoldSet(candidates, {
      ...options,
      kind: 'pilot',
      size: 100,
      exclusionSources: [
        {
          sourceType: 'pmid_manifest',
          pmids: manifestPmids,
          path: '/fixtures/excluded-pilot-pmids.txt',
          sha256: 'b'.repeat(64),
        },
      ],
    })

    expect(report.testCount).toBe(0)
    expect(report.items.every((item) => item.datasetSplit === 'development')).toBe(true)
    expect(report.items.some((item) => manifestPmids.includes(item.pmid))).toBe(false)
  })

  it('fails closed on invalid exclusion-source PMIDs and provenance', () => {
    const exclusionSource = {
      sourceType: 'pmid_manifest' as const,
      pmids: ['1'],
      path: '/fixtures/excluded-pmids.txt',
      sha256: 'a'.repeat(64),
    }

    expect(() =>
      sampleLiteratureGoldSet(candidates, {
        ...options,
        exclusionSources: [{ ...exclusionSource, pmids: ['1', '1'] }],
      }),
    ).toThrow('duplicate PMID 1')
    expect(() =>
      sampleLiteratureGoldSet(candidates, {
        ...options,
        exclusionSources: [{ ...exclusionSource, pmids: ['not-a-pmid'] }],
      }),
    ).toThrow('contains invalid PMID')
    expect(() =>
      sampleLiteratureGoldSet(candidates, {
        ...options,
        exclusionSources: [{ ...exclusionSource, sha256: 'not-a-sha256' }],
      }),
    ).toThrow('SHA-256')
    expect(() =>
      sampleLiteratureGoldSet(candidates, {
        ...options,
        exclusionSources: [{ ...exclusionSource, pmids: [] }],
      }),
    ).toThrow('at least one PMID')
  })

  it('fails closed if prior automatic exclusions change before commit', () => {
    const expected = {
      batchNames: ['gold-v1', 'pilot-v1'],
      pmids: ['100', '200'],
    }

    expect(() =>
      assertLiteratureGoldPriorAutomaticSamplesUnchanged(expected, {
        batchNames: ['pilot-v1', 'gold-v1'],
        pmids: ['200', '100'],
      }),
    ).not.toThrow()
    expect(() =>
      assertLiteratureGoldPriorAutomaticSamplesUnchanged(expected, {
        batchNames: [...expected.batchNames, 'pilot-v2'],
        pmids: expected.pmids,
      }),
    ).toThrow('changed during sampling')
    expect(() =>
      assertLiteratureGoldPriorAutomaticSamplesUnchanged(expected, {
        batchNames: expected.batchNames,
        pmids: [...expected.pmids, '300'],
      }),
    ).toThrow('changed during sampling')
  })

  it('reports stratum shortages before redistributing their target slots', () => {
    const onlyStrongCandidates = Array.from({ length: 30 }, (_, index) =>
      candidate(index + 1, {
        publicationYear: 2025,
        hasAbstract: true,
        isConferenceAbstract: false,
        sourceKinds: ['core_journal'],
        sourceCount: 1,
        sourceFileCount: 1,
        queryIds: [],
        suggestedTopicIds: ['central-airway-obstruction'],
        suggestionCount: 3,
        maxSuggestionConfidence: 1,
      }),
    )
    const report = sampleLiteratureGoldSet(onlyStrongCandidates, {
      ...options,
      size: 20,
    })

    expect(report.selectedCount).toBe(20)
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ambiguous_boundary supplied 0/'),
        expect.stringContaining('likely_non_ip supplied 0/'),
      ]),
    )
  })

  it('keeps pilot and explicit regression sets in development only', () => {
    const pilot = sampleLiteratureGoldSet(candidates, {
      ...options,
      kind: 'pilot',
      size: 100,
    })
    const regression = sampleLiteratureGoldSet(candidates, {
      ...options,
      kind: 'hard_negative_regression',
      size: 3,
      explicitPmids: ['11', '22', '33'],
    })

    expect(pilot.testCount).toBe(0)
    expect(regression.testCount).toBe(0)
    expect(regression.items).toHaveLength(3)
    expect(new Set(regression.items.map((item) => item.sampleStratum))).toEqual(
      new Set(['hard_negative_regression']),
    )
  })

  it('requires explicit PMIDs for regression sets', () => {
    expect(() =>
      sampleLiteratureGoldSet(candidates, {
        ...options,
        kind: 'landmark_regression',
        size: 10,
      }),
    ).toThrow('explicit PMID list')
  })
})
