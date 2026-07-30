import { literatureTaxonomy } from '@/features/literature/config'
import {
  analyzeLiteratureGoldPilot,
  serializeLiteratureGoldPilotAnalysisMarkdown,
} from '@/features/literature/gold-set/analysis'
import {
  serializeLiteratureGoldSetCsv,
  type LiteratureGoldExport,
} from '@/features/literature/gold-set/export'
import { parseLiteratureGoldReviewImportCsv } from '@/features/literature/gold-set/import'

const batchId = '00000000-0000-4000-8000-000000000001'

function record(
  index: number,
  options: {
    label: 'include_core' | 'include_adjacent' | 'exclude'
    score: number
    originalBand: 'high' | 'low'
    revision?: number
    confidence?: 'high' | 'moderate' | 'low'
    topicIds?: string[]
  },
): LiteratureGoldExport['records'][number] {
  const isIncluded = options.label !== 'exclude'
  return {
    itemId: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    pmid: String(1000 + index),
    title: `Article ${index}`,
    abstract: 'Abstract',
    authors: [],
    journalTitle: 'Journal',
    journalAbbreviation: 'J',
    publicationYear: 2026,
    publicationTypes: ['Journal Article'],
    sampleStratum: options.originalBand === 'high' ? 'strong_likely_ip' : 'likely_non_ip',
    samplingReason: [
      `stratum=${options.originalBand === 'high' ? 'strong_likely_ip' : 'likely_non_ip'}`,
      'source=multiple',
      'year=2020_present',
      'abstract=available',
      `rule_band=${options.originalBand}`,
      `score=${options.score.toFixed(4)}`,
      'source_files=2',
    ].join('; '),
    datasetSplit: 'development',
    displayOrder: index,
    reviewStatus: 'completed',
    reviewSource: 'completed',
    review: {
      id: `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      revision: options.revision ?? 1,
      relevanceLabel: options.label,
      metadataSufficiency: 'adequate_abstract',
      reviewerConfidence: options.confidence ?? 'high',
      topicIds: isIncluded ? (options.topicIds ?? ['central-airway-obstruction']) : [],
      technologyTags: isIncluded ? ['rigid-bronchoscopy'] : [],
      clinicalPurposes: isIncluded ? ['diagnosis'] : [],
      diseaseTags: [],
      studyDesign: isIncluded ? 'case-report' : null,
      publicationStatus: isIncluded ? 'full-article' : null,
      categorizationFromFullText: false,
      notes: '',
      usedSupplementalMetadata: false,
      reviewSeconds: index * 10,
      isBlinded: true,
      reviewerEmail: 'reviewer@example.com',
      completedAt: '2026-07-30T12:00:00.000Z',
    },
  }
}

function fixture(): LiteratureGoldExport {
  return {
    exportVersion: '1.0.0',
    exportedAt: '2026-07-30T12:00:00.000Z',
    batch: {
      id: batchId,
      name: 'pilot-v1',
      kind: 'pilot',
      status: 'active',
      taxonomyVersion: '1.1.0',
      labelSchemaVersion: '1.1.0',
      relevanceDefinitionVersion: '1.0.0',
      samplingAlgorithmVersion: 'stratified-v1',
      samplingSeed: 20_260_727,
      requestedSize: 4,
      frozenAt: null,
    },
    split: 'all',
    includesHistory: false,
    records: [
      record(1, {
        label: 'include_core',
        score: 0.8,
        originalBand: 'high',
        topicIds: literatureTaxonomy.topics.map((topic) => topic.id),
      }),
      record(2, {
        label: 'include_core',
        score: 0.1,
        originalBand: 'low',
      }),
      record(3, {
        label: 'exclude',
        score: 0.7,
        originalBand: 'high',
      }),
      record(4, {
        label: 'include_adjacent',
        score: 0,
        originalBand: 'low',
        revision: 2,
        confidence: 'low',
      }),
    ],
  }
}

describe('gold-set pilot analysis', () => {
  it('re-bands completed pilot decisions and identifies regression candidates', () => {
    const parsed = parseLiteratureGoldReviewImportCsv(serializeLiteratureGoldSetCsv(fixture()), {
      completedOnly: true,
      expectedRowCount: 4,
    })
    const report = analyzeLiteratureGoldPilot(parsed.rows, {
      generatedAt: '2026-07-30T13:00:00.000Z',
      sourceSha256: 'abc123',
    })

    expect(report.readiness.status).toBe('ready_with_follow_up')
    expect(report.contracts).toEqual({
      taxonomyVersion: '1.1.0',
      labelSchemaVersion: '1.1.0',
      relevanceDefinitionVersion: '1.0.0',
      samplingAlgorithmVersion: 'stratified-v2',
      lowScoreThreshold: 0.1,
      highScoreThreshold: 0.75,
    })
    expect(report.counts.calibratedRuleBand).toEqual({
      high: 1,
      intermediate: 2,
      low: 1,
    })
    expect(report.outcomes.byCalibratedRuleBand.high).toMatchObject({
      total: 1,
      included: 1,
      excluded: 0,
    })
    expect(report.outcomes.byCalibratedRuleBand.intermediate).toMatchObject({
      total: 2,
      included: 1,
      excluded: 1,
    })
    expect(report.followUp.originalHighBandExcludedPmids).toEqual(['1003'])
    expect(report.followUp.calibratedLowBandIncludedPmids).toEqual(['1004'])
    expect(report.followUp.calibratedHighBandExcludedPmids).toEqual([])
    expect(report.coverage.broadTopics.missing).toEqual([])
    expect(report.reviewTiming).toEqual({
      totalSeconds: 100,
      meanSeconds: 25,
      medianSeconds: 25,
      maximumSeconds: 40,
    })
  })

  it('renders a concise auditable Markdown report', () => {
    const parsed = parseLiteratureGoldReviewImportCsv(serializeLiteratureGoldSetCsv(fixture()), {
      completedOnly: true,
    })
    const markdown = serializeLiteratureGoldPilotAnalysisMarkdown(
      analyzeLiteratureGoldPilot(parsed.rows, {
        generatedAt: '2026-07-30T13:00:00.000Z',
      }),
    )

    expect(markdown).toContain('# pilot-v1 readiness analysis')
    expect(markdown).toContain('Source SHA-256: Not recorded')
    expect(markdown).toContain('sampling stratified-v2')
    expect(markdown).toContain('low below 0.10')
    expect(markdown).toContain('Stratified-v2 band outcomes')
    expect(markdown).toContain('Original high-band exclusions: 1003')
    expect(markdown).toContain('Stratified-v2 low-band inclusions: 1004')
    expect(markdown).toContain('not a population performance estimate')
  })
})
