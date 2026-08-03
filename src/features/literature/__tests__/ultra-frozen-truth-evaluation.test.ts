import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  buildUltraFrozenTruthEvaluation,
  ULTRA_ENRICHED_DEVELOPMENT_WARNING,
  ULTRA_FROZEN_TRUTH_EVALUATION_SCHEMA_VERSION,
  ultraFrozenTruthEvaluationPaths,
  writeUltraFrozenTruthEvaluationArtifacts,
  type UltraFrozenTruthEvaluationInput,
} from '@/features/literature/ultra-screening/frozen-truth-evaluation'
import type {
  UltraRelevanceLabel,
  UltraScreeningResult,
} from '@/features/literature/ultra-screening/core'

const hash = (character: string) => character.repeat(64)

function prediction(
  pmid: string,
  relevanceLabel: UltraRelevanceLabel,
  decisionConfidence: UltraScreeningResult['decisionConfidence'] = 'high',
): UltraScreeningResult {
  return {
    pmid,
    relevanceLabel,
    decisionConfidence,
    requiresHumanReview: decisionConfidence === 'low' || relevanceLabel === 'uncertain',
    reasonCodes: [
      relevanceLabel === 'exclude' ? 'incidental_specimen_collection' : 'scope_boundary',
    ],
    evidence: [{ field: 'title', text: `Supplied title for ${pmid}` }],
    conciseRationale: `Deterministic rationale for ${pmid}.`,
  }
}

function evaluationInput(): UltraFrozenTruthEvaluationInput {
  return {
    evaluationId: 'pilot-v1-first-pass-frozen-20260802',
    evaluationTimestamp: '2026-08-02T21:00:00.000Z',
    provenance: {
      predictionRunId: 'ip-literature-ultra-v1',
      predictionPhase: 'pilot-first-pass',
      predictionAggregateSha256: hash('a'),
      predictionAttemptProvenanceStatus: 'unavailable_legacy',
      screeningPolicyRecordPath: '/immutable/provenance/screening-policy-v1.md',
      screeningPolicyVersion: '1.0.0',
      screeningPolicySha256: hash('b'),
      workerPromptTemplateRecordPath: '/immutable/provenance/worker-prompt-v1.md',
      workerPromptTemplateVersion: '1.0.0',
      workerPromptTemplateSha256: hash('c'),
      repositoryCommit: 'd'.repeat(40),
      truthBatchName: 'pilot-v1',
      truthBatchStatus: 'frozen',
      truthBatchFrozenAt: '2026-08-02T20:07:00.000Z',
      truthFullHistoryJsonSha256: hash('e'),
      truthExportedAt: '2026-08-02T20:30:00.000Z',
      selectionAudits: [
        { path: '/immutable/coordinator/pilot-c-selection.json', sha256: hash('7') },
      ],
    },
    truth: [
      { pmid: '1', relevanceLabel: 'include_core' },
      { pmid: '2', relevanceLabel: 'include_adjacent' },
      { pmid: '3', relevanceLabel: 'exclude' },
      { pmid: '4', relevanceLabel: 'uncertain' },
      { pmid: '5', relevanceLabel: 'include_core' },
    ],
    predictions: [
      prediction('1', 'include_core'),
      prediction('2', 'exclude'),
      prediction('3', 'include_core'),
      prediction('4', 'exclude', 'moderate'),
      prediction('5', 'exclude', 'moderate'),
    ],
    subsets: {
      noAbstractPmids: ['2', '4'],
      animalPreclinicalPmids: ['3'],
    },
    comparisons: [
      {
        comparisonId: 'exclusion-challenge',
        predictionRunId: 'ip-literature-ultra-v1',
        predictionPhase: 'pilot-exclusion-challenge',
        predictionAggregateSha256: hash('f'),
        predictions: [
          prediction('2', 'include_adjacent'),
          prediction('5', 'include_adjacent', 'moderate'),
        ],
      },
    ],
  }
}

describe('versioned Ultra evaluation against frozen truth', () => {
  it('binds exact provenance and reports four-class, binary, and per-label metrics', () => {
    const report = buildUltraFrozenTruthEvaluation(evaluationInput())

    expect(report).toMatchObject({
      evaluationSchemaVersion: ULTRA_FROZEN_TRUTH_EVALUATION_SCHEMA_VERSION,
      evaluationId: 'pilot-v1-first-pass-frozen-20260802',
      warning: ULTRA_ENRICHED_DEVELOPMENT_WARNING,
      provenance: {
        predictionAggregateSha256: hash('a'),
        screeningPolicySha256: hash('b'),
        workerPromptTemplateSha256: hash('c'),
        truthBatchStatus: 'frozen',
        truthFullHistoryJsonSha256: hash('e'),
        selectionAudits: [
          { path: '/immutable/coordinator/pilot-c-selection.json', sha256: hash('7') },
        ],
      },
      unavailableAnalyses: {
        directProcedureFalseExclusions: { status: 'unavailable' },
        publicationTypeBreakdown: { status: 'unavailable' },
        majorTopicBreakdown: { status: 'unavailable' },
      },
    })
    expect(report.performance.metrics).toMatchObject({
      articleCount: 5,
      exactMatches: 1,
      exactAccuracy: 0.2,
      binaryInclude: {
        truePositive: 1,
        trueNegative: 1,
        falsePositive: 1,
        falseNegative: 2,
        sensitivity: 1 / 3,
        specificity: 0.5,
      },
    })
    expect(report.performance.metrics.confusionMatrix).toMatchObject({
      rows: 'truth',
      columns: 'prediction',
      counts: {
        include_core: { include_core: 1, exclude: 1 },
        include_adjacent: { exclude: 1 },
        exclude: { include_core: 1 },
        uncertain: { exclude: 1 },
      },
    })
    expect(report.performance.metrics.perLabel.include_core).toMatchObject({
      support: 2,
      predictedCount: 2,
      truePositive: 1,
      precision: 0.5,
      recall: 0.5,
      f1: 0.5,
    })
  })

  it('reports every false exclusion, the high-confidence subset, and row disagreements', () => {
    const report = buildUltraFrozenTruthEvaluation(evaluationInput())

    expect(report.performance.falseExclusions.all.map((row) => row.pmid)).toEqual(['2', '5'])
    expect(report.performance.falseExclusions.highConfidence.map((row) => row.pmid)).toEqual(['2'])
    expect(report.performance.disagreements.map((row) => [row.pmid, row.disagreementKind])).toEqual(
      [
        ['2', 'false_exclusion'],
        ['3', 'false_inclusion'],
        ['4', 'exact_class_mismatch'],
        ['5', 'false_exclusion'],
      ],
    )
  })

  it('calculates supplied no-abstract and animal/preclinical subsets and pass comparisons', () => {
    const report = buildUltraFrozenTruthEvaluation(evaluationInput())

    expect(report.subsets.noAbstract?.metrics).toMatchObject({
      articleCount: 2,
      binaryInclude: {
        truePositive: 0,
        trueNegative: 1,
        falseNegative: 1,
        sensitivity: 0,
        specificity: 1,
      },
    })
    expect(report.subsets.animalPreclinical?.metrics).toMatchObject({
      articleCount: 1,
      binaryInclude: { falsePositive: 1, specificity: 0 },
    })
    expect(report.comparisons).toHaveLength(1)
    expect(report.comparisons[0]).toMatchObject({
      comparisonId: 'exclusion-challenge',
      overlapCount: 2,
      agreementCount: 0,
      agreementRate: 0,
      performanceAgainstFrozenTruth: {
        metrics: {
          articleCount: 2,
          binaryInclude: { truePositive: 2, falseNegative: 0, sensitivity: 1 },
        },
      },
    })
    expect(report.comparisons[0]?.disagreements.map((row) => row.pmid)).toEqual(['2', '5'])
  })

  it('refuses unfrozen truth, malformed hashes, and prediction/truth PMID mismatch', () => {
    const unfrozen = evaluationInput()
    unfrozen.provenance = { ...unfrozen.provenance, truthBatchStatus: 'active' as never }
    expect(() => buildUltraFrozenTruthEvaluation(unfrozen)).toThrow('truthBatchStatus=frozen')

    const malformedHash = evaluationInput()
    malformedHash.provenance = {
      ...malformedHash.provenance,
      predictionAggregateSha256: 'not-a-hash',
    }
    expect(() => buildUltraFrozenTruthEvaluation(malformedHash)).toThrow(
      'predictionAggregateSha256',
    )

    const missing = evaluationInput()
    missing.predictions = missing.predictions.slice(1)
    expect(() => buildUltraFrozenTruthEvaluation(missing)).toThrow('Prediction/truth PMID mismatch')

    const malformedSelectionAudit = evaluationInput()
    malformedSelectionAudit.provenance = {
      ...malformedSelectionAudit.provenance,
      selectionAudits: [{ path: '/immutable/selection.json', sha256: 'not-a-hash' }],
    }
    expect(() => buildUltraFrozenTruthEvaluation(malformedSelectionAudit)).toThrow(
      'selectionAudits[0].sha256',
    )
  })

  it('uses immutable versioned paths and exact-or-verify writes', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'ultra-evaluation-'))
    const report = buildUltraFrozenTruthEvaluation(evaluationInput())
    const paths = ultraFrozenTruthEvaluationPaths(rootPath, report.evaluationId)

    expect(paths.reportPath).toContain(
      '/evaluations/frozen-truth-v2/pilot-v1-first-pass-frozen-20260802/evaluation.json',
    )
    const first = await writeUltraFrozenTruthEvaluationArtifacts(rootPath, report)
    expect(first).toMatchObject({
      reportStatus: 'written',
      disagreementsStatus: 'written',
      disagreementsCsvStatus: 'written',
      bundleReceiptStatus: 'written',
      bundleComplete: true,
    })
    const second = await writeUltraFrozenTruthEvaluationArtifacts(rootPath, report)
    expect(second).toMatchObject({
      reportStatus: 'verified_existing',
      disagreementsStatus: 'verified_existing',
      disagreementsCsvStatus: 'verified_existing',
      bundleReceiptStatus: 'verified_existing',
      bundleComplete: true,
    })
    const disagreementLines = (await readFile(paths.disagreementsPath, 'utf8')).trim().split('\n')
    expect(disagreementLines).toHaveLength(4)
    const disagreementCsv = await readFile(paths.disagreementsCsvPath, 'utf8')
    expect(disagreementCsv).toContain('"pmid","truth_label","predicted_label"')
    expect(disagreementCsv.trim().split('\n')).toHaveLength(5)
    const receipt = JSON.parse(await readFile(paths.bundleReceiptPath, 'utf8'))
    expect(receipt).toMatchObject({
      receiptVersion: '1.0.0',
      evaluationId: report.evaluationId,
      complete: true,
      artifacts: [
        { filename: 'evaluation.json', sha256: expect.stringMatching(/^[a-f0-9]{64}$/u) },
        { filename: 'disagreements.jsonl', sha256: expect.stringMatching(/^[a-f0-9]{64}$/u) },
        { filename: 'disagreements.csv', sha256: expect.stringMatching(/^[a-f0-9]{64}$/u) },
      ],
    })

    const nonmatching = {
      ...report,
      performance: {
        ...report.performance,
        metrics: { ...report.performance.metrics, exactMatches: 999 },
      },
    }
    await expect(writeUltraFrozenTruthEvaluationArtifacts(rootPath, nonmatching)).rejects.toThrow(
      'Refusing to overwrite nonmatching evaluation artifact',
    )
  })

  it('neutralizes spreadsheet-formula prefixes in physician disagreement CSV', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'ultra-evaluation-csv-'))
    const input = evaluationInput()
    input.predictions = input.predictions.map((row) =>
      row.pmid === '2' ? { ...row, conciseRationale: '=1+1' } : row,
    )
    const report = buildUltraFrozenTruthEvaluation(input)
    const written = await writeUltraFrozenTruthEvaluationArtifacts(rootPath, report)

    expect(await readFile(written.disagreementsCsvPath, 'utf8')).toContain(`"'=1+1"`)
  })

  it('recovers an incomplete pre-receipt bundle and fails closed after a completion receipt', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'ultra-evaluation-recovery-'))
    const report = buildUltraFrozenTruthEvaluation(evaluationInput())
    const first = await writeUltraFrozenTruthEvaluationArtifacts(rootPath, report)
    await rm(first.bundleReceiptPath)
    await rm(first.disagreementsCsvPath)

    const recovered = await writeUltraFrozenTruthEvaluationArtifacts(rootPath, report)
    expect(recovered).toMatchObject({
      reportStatus: 'verified_existing',
      disagreementsStatus: 'verified_existing',
      disagreementsCsvStatus: 'written',
      bundleReceiptStatus: 'written',
      bundleComplete: true,
    })

    await rm(recovered.disagreementsPath)
    await expect(writeUltraFrozenTruthEvaluationArtifacts(rootPath, report)).rejects.toThrow(
      'bundle receipt exists but member is missing or changed',
    )
  })
})
