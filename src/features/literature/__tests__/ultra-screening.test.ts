import {
  balancedChunks,
  deterministicPmidSample,
  evaluateUltraScreening,
  NO_ABSTRACT_MARKER,
  selectUltraTerraCandidates,
  serializeUltraResults,
  validateUltraWorkerOutput,
  type UltraScreeningArticle,
  type UltraScreeningResult,
} from '@/features/literature/ultra-screening/core'

const article: UltraScreeningArticle = {
  pmid: '12345',
  title: 'Bronchoscopic lavage technique and safety',
  abstract: 'We compared suction methods during bronchoalveolar lavage.',
  mesh: ['Bronchoscopy', 'Bronchoalveolar Lavage'],
  author_keyword: ['suction pressure'],
  publication_type: ['Comparative Study'],
  journal: 'Journal of Bronchology',
  year: 2025,
  language: ['eng'],
}

const validResult: UltraScreeningResult = {
  pmid: '12345',
  relevanceLabel: 'include_core',
  decisionConfidence: 'high',
  requiresHumanReview: false,
  reasonCodes: ['bal_procedural'],
  evidence: [
    {
      field: 'abstract',
      text: 'suction methods during bronchoalveolar lavage',
    },
  ],
  conciseRationale: 'The study directly compares a BAL technique.',
}

describe('ultra literature screening contracts', () => {
  it('accepts one strict, evidence-grounded result per assigned PMID', () => {
    const report = validateUltraWorkerOutput(serializeUltraResults([validResult]), [article])

    expect(report.valid).toBe(true)
    expect(report.errors).toEqual([])
    expect(report.records).toEqual([validResult])
  })

  it('rejects invented evidence, duplicate PMIDs, and missing assignments', () => {
    const duplicate = {
      ...validResult,
      evidence: [{ field: 'title' as const, text: 'not in the supplied title' }],
    }
    const report = validateUltraWorkerOutput(
      `${JSON.stringify(duplicate)}\n${JSON.stringify(validResult)}\n`,
      [article],
    )

    expect(report.valid).toBe(false)
    expect(report.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(['invalid_evidence', 'duplicate_pmid']),
    )
  })

  it('rejects additional result properties and low confidence without review', () => {
    const invalid = {
      ...validResult,
      decisionConfidence: 'low',
      requiresHumanReview: false,
      leakedSamplingStratum: 'strong_likely_ip',
    }
    const report = validateUltraWorkerOutput(`${JSON.stringify(invalid)}\n`, [article])

    expect(report.valid).toBe(false)
    expect(report.errors.map((error) => error.code)).toContain('invalid_schema')
    expect(report.errors.map((error) => error.code)).toContain('missing_pmid')
  })

  it('validates year evidence as the supplied year string', () => {
    const result: UltraScreeningResult = {
      ...validResult,
      evidence: [{ field: 'year', text: '2025' }],
    }
    expect(validateUltraWorkerOutput(serializeUltraResults([result]), [article]).valid).toBe(true)
    expect(
      validateUltraWorkerOutput(
        serializeUltraResults([{ ...result, evidence: [{ field: 'year', text: '202' }] }]),
        [article],
      ).valid,
    ).toBe(false)
  })

  it('creates deterministic smoke selections and balanced eight-way chunks', () => {
    const pmids = Array.from({ length: 100 }, (_, index) => String(index + 1))
    const selected = deterministicPmidSample(pmids, 20, 'fixed-seed')

    expect(deterministicPmidSample([...pmids].reverse(), 20, 'fixed-seed')).toEqual(selected)
    expect(new Set(selected).size).toBe(20)
    expect(balancedChunks(selected, 8).map((chunk) => chunk.length)).toEqual([
      3, 3, 3, 3, 2, 2, 2, 2,
    ])
  })

  it('reports dangerous high-confidence false negatives and binary metrics', () => {
    const predictions: UltraScreeningResult[] = [
      validResult,
      {
        ...validResult,
        pmid: '999',
        relevanceLabel: 'exclude',
        reasonCodes: ['incidental_specimen_collection'],
      },
    ]
    const metrics = evaluateUltraScreening(
      [
        { pmid: '12345', relevanceLabel: 'include_core' },
        { pmid: '999', relevanceLabel: 'include_adjacent' },
      ],
      predictions,
    )

    expect(metrics.exactAccuracy).toBe(0.5)
    expect(metrics.binaryInclude).toMatchObject({
      truePositive: 1,
      falseNegative: 1,
      sensitivity: 0.5,
    })
    expect(metrics.dangerousFalseNegatives.map((item) => item.pmid)).toEqual(['999'])
  })

  it('selects Terra boundary, disagreement, no-abstract, and deterministic QC cases', () => {
    const articles: UltraScreeningArticle[] = [
      article,
      { ...article, pmid: '2', abstract: NO_ABSTRACT_MARKER },
      { ...article, pmid: '3' },
      { ...article, pmid: '4' },
    ]
    const firstPass: UltraScreeningResult[] = [
      validResult,
      {
        ...validResult,
        pmid: '2',
        relevanceLabel: 'exclude',
        reasonCodes: ['animal_nonprocedural'],
      },
      {
        ...validResult,
        pmid: '3',
        relevanceLabel: 'exclude',
        reasonCodes: ['incidental_specimen_collection'],
      },
      {
        ...validResult,
        pmid: '4',
        relevanceLabel: 'uncertain',
        decisionConfidence: 'low',
        requiresHumanReview: true,
        reasonCodes: ['scope_boundary'],
      },
    ]
    const challengePass: UltraScreeningResult[] = [
      {
        ...validResult,
        pmid: '2',
        relevanceLabel: 'include_adjacent',
        reasonCodes: ['adjacent_preclinical_procedural'],
      },
      {
        ...validResult,
        pmid: '3',
        relevanceLabel: 'exclude',
        reasonCodes: ['incidental_specimen_collection'],
      },
    ]

    const selected = selectUltraTerraCandidates({
      articles,
      firstPass,
      challengePass,
      qcRate: 1,
      qcSeed: 'fixed-qc',
    })

    expect(selected.map((item) => item.pmid)).toEqual(['2', '3', '4'])
    expect(selected.find((item) => item.pmid === '2')?.reasons).toEqual(
      expect.arrayContaining([
        'animal_preclinical_boundary',
        'confident_exclusion_qc',
        'luna_disagreement',
        'no_abstract_boundary',
      ]),
    )
    expect(selected.find((item) => item.pmid === '4')?.reasons).toEqual(
      expect.arrayContaining(['first_pass_low_confidence', 'first_pass_uncertain']),
    )
  })
})
