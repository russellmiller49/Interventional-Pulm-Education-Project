import { access, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
import {
  resolveLiteratureGoldPilotReadinessOutput,
  runLiteratureGoldPilotAnalysis,
} from '../../../../scripts/literature/analyze-gold-set'

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
  const exported: LiteratureGoldExport = {
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
    includesHistory: true,
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
  exported.records.forEach((exportedRecord, index) => {
    const currentReview = exportedRecord.review
    if (!currentReview) throw new Error('Test fixture requires a current review.')
    exportedRecord.reviewHistory =
      currentReview.revision === 1
        ? [
            {
              ...currentReview,
              topicIds: [...currentReview.topicIds],
              technologyTags: [...currentReview.technologyTags],
              clinicalPurposes: [...currentReview.clinicalPurposes],
              diseaseTags: [...currentReview.diseaseTags],
            },
          ]
        : [
            {
              ...currentReview,
              id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
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
              categorizationFromFullText: false,
              usedSupplementalMetadata: false,
              isBlinded: true,
              completedAt: '2026-07-30T11:00:00.000Z',
            },
            currentReview,
          ]
  })
  return exported
}

describe('gold-set pilot analysis', () => {
  it('re-bands completed pilot decisions and identifies regression candidates', () => {
    const exported = fixture()
    const parsed = parseLiteratureGoldReviewImportCsv(serializeLiteratureGoldSetCsv(exported), {
      completedOnly: true,
      expectedRowCount: 4,
    })
    const report = analyzeLiteratureGoldPilot(parsed.rows, exported, {
      generatedAt: '2026-07-30T13:00:00.000Z',
      currentStateCsvSha256: 'csv123',
      fullHistoryJsonSha256: 'history123',
    })

    expect(report.reportVersion).toBe('2.0.0')
    expect(report.readiness.status).toBe('ready_with_follow_up')
    expect(report.source).toMatchObject({
      currentStateCsvSha256: 'csv123',
      fullHistoryJsonSha256: 'history123',
      fullHistoryExportedAt: '2026-07-30T12:00:00.000Z',
      batchContract: {
        kind: 'pilot',
        status: 'active',
        samplingAlgorithmVersion: 'stratified-v1',
        requestedSize: 4,
      },
    })
    expect(report.reviewSemantics).toEqual({
      firstPassBlinding: 'immutable_revision_1',
      finalDecision: 'current_revision',
    })
    expect(report.analysisContracts).toEqual({
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
    expect(report.counts.relevance).toEqual({
      include_core: 2,
      exclude: 1,
      include_adjacent: 1,
    })
    expect(report.counts.reviewerConfidence).toEqual({ high: 3, low: 1 })
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

  it('preserves PMID 24142789 first-pass blinding while using its nonblinded current revision', () => {
    const exported = fixture()
    const target = exported.records[3]
    if (!target?.review) throw new Error('Test fixture requires the preserved review.')
    target.itemId = '5600b19e-03a2-4099-898d-bd0f58b051ff'
    target.pmid = '24142789'
    target.review = {
      ...target.review,
      id: 'c14a37ce-7991-4954-8411-1d7970f6b06a',
      relevanceLabel: 'include_core',
      metadataSufficiency: 'no_abstract',
      reviewerConfidence: 'moderate',
      topicIds: ['other-advanced-bronchoscopy'],
      technologyTags: [],
      clinicalPurposes: ['multiple-general-overview'],
      diseaseTags: [],
      studyDesign: 'review-article',
      publicationStatus: 'full-article',
      usedSupplementalMetadata: true,
      reviewSeconds: 362,
      isBlinded: false,
      reviewerEmail: 'literature-gold-review-import-cli',
      completedAt: '2026-08-01T01:24:35.943883+00:00',
    }
    target.reviewHistory = [
      {
        ...target.review,
        id: 'd94b8a7e-444a-4342-96ef-02df5cdbd1c7',
        revision: 1,
        relevanceLabel: 'include_adjacent',
        reviewerConfidence: 'high',
        studyDesign: 'not-assessable-from-available-metadata',
        publicationStatus: 'not-assessable-from-available-metadata',
        isBlinded: true,
        reviewerEmail: 'admin@interventionalpulm.com',
        completedAt: '2026-07-27T20:57:59.996855+00:00',
      },
      target.review,
    ]
    const parsed = parseLiteratureGoldReviewImportCsv(serializeLiteratureGoldSetCsv(exported), {
      completedOnly: true,
    })

    const report = analyzeLiteratureGoldPilot(parsed.rows, exported)
    const blindingGate = report.readiness.gates.find((gate) => gate.id === 'blinded-first-pass')

    expect(blindingGate).toMatchObject({
      passed: true,
      detail: '4/4 immutable first review revisions are marked blinded.',
    })
    expect(report.totals.blindedFirstPass).toBe(4)
    expect(report.totals.blindedCurrentRevision).toBe(3)
    expect(report.counts.relevance).toEqual({ include_core: 3, exclude: 1 })
    expect(report.counts.reviewerConfidence).toEqual({ high: 3, moderate: 1 })
    expect(report.readiness.status).toBe('ready_with_follow_up')
  })

  it('fails closed on non-pilot, archived, incomplete-size, or non-development input', () => {
    const variants: Array<[(exported: LiteratureGoldExport) => void, string]> = [
      [
        (exported) => {
          exported.batch.kind = 'gold_standard'
        },
        'batch kind must be pilot',
      ],
      [
        (exported) => {
          exported.batch.status = 'archived'
        },
        'status must be active or frozen',
      ],
      [
        (exported) => {
          exported.batch.requestedSize = 3
        },
        'requestedSize 3 must equal the 4 current-state rows and 4 history records',
      ],
      [
        (exported) => {
          const target = exported.records[0]
          if (!target) throw new Error('Test fixture requires a record.')
          target.datasetSplit = 'test'
        },
        'is development-only',
      ],
    ]

    for (const [mutate, message] of variants) {
      const exported = fixture()
      mutate(exported)
      const parsed = parseLiteratureGoldReviewImportCsv(serializeLiteratureGoldSetCsv(exported), {
        completedOnly: true,
      })
      expect(() => analyzeLiteratureGoldPilot(parsed.rows, exported)).toThrow(message)
    }
  })

  it('cross-checks each full-history dataset split against the current-state CSV', () => {
    const exported = fixture()
    const parsed = parseLiteratureGoldReviewImportCsv(serializeLiteratureGoldSetCsv(exported), {
      completedOnly: true,
    })
    const target = exported.records[0]
    if (!target) throw new Error('Test fixture requires a record.')
    target.datasetSplit = 'test'

    expect(() => analyzeLiteratureGoldPilot(parsed.rows, exported)).toThrow(
      'datasetSplit test does not match current-state CSV development',
    )
  })

  it('requires every history field without schema defaults and enforces ISO timestamps', () => {
    const missingRootField = fixture()
    const missingRootRows = parseLiteratureGoldReviewImportCsv(
      serializeLiteratureGoldSetCsv(missingRootField),
      { completedOnly: true },
    ).rows
    delete (missingRootField as unknown as Record<string, unknown>).exportedAt
    expect(() => analyzeLiteratureGoldPilot(missingRootRows, missingRootField)).toThrow(
      'Full-history export is missing required field(s): exportedAt',
    )

    const missingReviewField = fixture()
    const missingReviewRows = parseLiteratureGoldReviewImportCsv(
      serializeLiteratureGoldSetCsv(missingReviewField),
      { completedOnly: true },
    ).rows
    const firstReview = missingReviewField.records[0]?.reviewHistory?.[0]
    if (!firstReview) throw new Error('Test fixture requires a history review.')
    delete (firstReview as unknown as Record<string, unknown>).notes
    expect(() => analyzeLiteratureGoldPilot(missingReviewRows, missingReviewField)).toThrow(
      'reviewHistory[0] is missing required field(s): notes',
    )

    const invalidTimestamp = fixture()
    const invalidTimestampRows = parseLiteratureGoldReviewImportCsv(
      serializeLiteratureGoldSetCsv(invalidTimestamp),
      { completedOnly: true },
    ).rows
    invalidTimestamp.exportedAt = '2026-07-30'
    expect(() => analyzeLiteratureGoldPilot(invalidTimestampRows, invalidTimestamp)).toThrow(
      'exportedAt must be an ISO 8601 timestamp with an offset',
    )
  })

  it('fails closed when current state and immutable history disagree', () => {
    const exported = fixture()
    const parsed = parseLiteratureGoldReviewImportCsv(serializeLiteratureGoldSetCsv(exported), {
      completedOnly: true,
    })
    const current = exported.records[0]?.review
    if (!current) throw new Error('Test fixture requires a current review.')
    current.reviewerConfidence = 'moderate'

    expect(() => analyzeLiteratureGoldPilot(parsed.rows, exported)).toThrow(
      'current review does not match its latest immutable revision',
    )
  })

  it('renders a concise auditable Markdown report', () => {
    const exported = fixture()
    const parsed = parseLiteratureGoldReviewImportCsv(serializeLiteratureGoldSetCsv(exported), {
      completedOnly: true,
    })
    const markdown = serializeLiteratureGoldPilotAnalysisMarkdown(
      analyzeLiteratureGoldPilot(parsed.rows, exported, {
        generatedAt: '2026-07-30T13:00:00.000Z',
      }),
    )

    expect(markdown).toContain('# pilot-v1 readiness analysis')
    expect(markdown).toContain('Current-state CSV SHA-256: Not recorded')
    expect(markdown).toContain('Full-history JSON SHA-256: Not recorded')
    expect(markdown).toContain('Source batch contract: pilot; status active')
    expect(markdown).toContain('sampling stratified-v1')
    expect(markdown).toContain('Analysis contracts: taxonomy 1.1.0')
    expect(markdown).toContain('first-pass blinding comes from immutable revision 1')
    expect(markdown).toContain('sampling stratified-v2')
    expect(markdown).toContain('low below 0.10')
    expect(markdown).toContain('Stratified-v2 band outcomes')
    expect(markdown).toContain('Original high-band exclusions: 1003')
    expect(markdown).toContain('Stratified-v2 low-band inclusions: 1004')
    expect(markdown).toContain('not a population performance estimate')
  })

  it('uses a new v2 artifact path and rejects the original unversioned readiness path', () => {
    expect(resolveLiteratureGoldPilotReadinessOutput('pilot-v1').json).toMatch(
      /pilot-v1-readiness-v2\.json$/u,
    )
    expect(() =>
      resolveLiteratureGoldPilotReadinessOutput('pilot-v1', 'pilot-v1-readiness.json'),
    ).toThrow('versioned filename ending in -v2.json')
  })

  it('creates no artifact when strict pilot validation rejects an input', async () => {
    const exported = fixture()
    exported.batch.kind = 'gold_standard'
    const root = await mkdtemp(join(tmpdir(), 'gold-pilot-readiness-rejected-'))
    const inputPath = join(root, 'pilot-v1-all.csv')
    const historyPath = join(root, 'pilot-v1-all-history.json')
    const outputPath = join(root, 'pilot-v1-readiness-v2.json')
    await Promise.all([
      writeFile(inputPath, serializeLiteratureGoldSetCsv(exported)),
      writeFile(historyPath, JSON.stringify(exported)),
    ])

    await expect(
      runLiteratureGoldPilotAnalysis({ inputPath, historyPath, outputPath }),
    ).rejects.toThrow('batch kind must be pilot')
    await expect(access(outputPath)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(access(outputPath.replace(/\.json$/u, '.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })
})
