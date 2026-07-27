import type { LiteratureGoldSamplingCandidate } from '@/features/literature/gold-set/types'
import { sampleLiteratureGoldSet } from '@/features/literature/gold-set/sampling'

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

  it('samples unique PMIDs and produces a 70/30 split', () => {
    const report = sampleLiteratureGoldSet(candidates, options)
    const pmids = report.items.map((item) => item.pmid)

    expect(report.selectedCount).toBe(900)
    expect(new Set(pmids).size).toBe(900)
    expect(report.developmentCount).toBe(630)
    expect(report.testCount).toBe(270)
    expect(report.items.map((item) => item.displayOrder)).toEqual(
      Array.from({ length: 900 }, (_, index) => index + 1),
    )
  })

  it('keeps a single journal from filling the sample when alternatives exist', () => {
    const report = sampleLiteratureGoldSet(candidates, { ...options, size: 120 })

    expect(Math.max(...Object.values(report.countsByJournal))).toBeLessThan(30)
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
