import {
  buildRepeatedStratifiedDevelopmentFolds,
  crossFitShadowTemperatureCalibration,
  developmentFoldPmids,
  evaluateShadowProbabilityCalibration,
  verifyCrossFittedShadowTemperatureCalibration,
  verifyRepeatedStratifiedDevelopmentFolds,
  type ShadowCalibrationCohortRow,
  type ShadowDevelopmentFoldRow,
  type ShadowRelevanceLabel,
} from '../shadow-classifier'

import { syntheticDevelopmentScope } from './shadow-classifier-fixtures'

function foldsRows(): ShadowDevelopmentFoldRow[] {
  const labels = ['include_core', 'include_adjacent', 'exclude'] as const
  return Array.from({ length: 630 }, (_, index) => ({
    pmid: String(10_000_000 + index),
    relevanceLabel: labels[index % labels.length]!,
    metadataSufficiency: 'adequate_abstract' as const,
  }))
}

function probabilities(label: ShadowRelevanceLabel) {
  const values = {
    include_core: 0.05,
    include_adjacent: 0.05,
    exclude: 0.05,
    uncertain: 0.05,
  }
  values[label] = 0.85
  return {
    vocabulary: ['include_core', 'include_adjacent', 'exclude', 'uncertain'],
    values,
    source: 'model_supplied' as const,
    calibrated: false as const,
    calibrationArtifactSha256: null,
  }
}

describe('development folds and calibration', () => {
  it('builds deterministic complete disjoint folds and rejects tampering/629 rows', () => {
    const scope = syntheticDevelopmentScope()
    const rows = foldsRows()
    const manifest = buildRepeatedStratifiedDevelopmentFolds({
      scope,
      rows,
      seed: 'fold-test-v1',
      folds: 5,
      repeats: 2,
    })
    expect(manifest.authorityClass).toBe('synthetic_fixture')
    expect(manifest.assignments).toHaveLength(1260)
    expect(() => verifyRepeatedStratifiedDevelopmentFolds({ scope, rows, manifest })).not.toThrow()
    const split = developmentFoldPmids({
      scope,
      rows,
      manifest,
      repeatIndex: 0,
      validationFoldIndex: 0,
    })
    expect(new Set([...split.trainingPmids, ...split.validationPmids]).size).toBe(630)
    expect(split.trainingPmids.some((pmid) => split.validationPmids.includes(pmid))).toBe(false)
    expect(() =>
      buildRepeatedStratifiedDevelopmentFolds({
        scope,
        rows: rows.slice(1),
        seed: 'fold-test-v1',
        folds: 5,
        repeats: 2,
      }),
    ).toThrow(/complete authorized cohort/u)
    const tampered = JSON.parse(JSON.stringify(manifest)) as typeof manifest
    ;(tampered.assignments[0] as { validationFoldIndex: number }).validationFoldIndex = 4
    expect(() =>
      verifyRepeatedStratifiedDevelopmentFolds({ scope, rows, manifest: tampered }),
    ).toThrow(/does not recompute/u)
  })

  it('computes Brier/ECE only from strict valid unique model probability rows', () => {
    const metrics = evaluateShadowProbabilityCalibration({
      rows: [
        {
          pmid: '1',
          truthLabel: 'include_core',
          predictedLabel: 'include_core',
          probabilities: probabilities('include_core'),
        },
        {
          pmid: '2',
          truthLabel: 'exclude',
          predictedLabel: 'exclude',
          probabilities: null,
        },
      ],
      bins: 10,
    })
    expect(metrics).toMatchObject({
      scope: 'caller_supplied_rows',
      attemptedRowCount: 2,
      validProbabilityRowCount: 1,
      missingProbabilityRowCount: 1,
      status: 'available_partial_for_supplied_rows',
      probabilityCoverageCompleteForSuppliedRows: false,
    })
    expect(metrics.multiclassBrierScore).toBeCloseTo(0.03)
    expect(() =>
      evaluateShadowProbabilityCalibration({
        rows: [
          {
            pmid: '1',
            truthLabel: 'include_core',
            predictedLabel: 'include_core',
            probabilities: probabilities('include_core'),
          },
          {
            pmid: '1',
            truthLabel: 'exclude',
            predictedLabel: 'exclude',
            probabilities: probabilities('exclude'),
          },
        ],
      }),
    ).toThrow(/duplicate/u)
  })

  it('cross-fits synthetic fixtures but permanently denies experiment/full-630 claims', () => {
    const scope = syntheticDevelopmentScope()
    const foldRows = foldsRows()
    const foldManifest = buildRepeatedStratifiedDevelopmentFolds({
      scope,
      rows: foldRows,
      seed: 'crossfit-v1',
      folds: 3,
      repeats: 1,
    })
    const rows: ShadowCalibrationCohortRow[] = foldRows.map((row) => ({
      pmid: row.pmid,
      truthLabel: row.relevanceLabel,
      outcomeStatus: 'prediction',
      predictedLabel: row.relevanceLabel,
      probabilities: probabilities(row.relevanceLabel),
    }))
    const artifact = crossFitShadowTemperatureCalibration({
      scope,
      rows,
      foldRows,
      foldManifest,
      candidateTemperatures: [0.5, 1, 2],
    })
    expect(artifact).toMatchObject({
      authorityClass: 'synthetic_fixture',
      experimentEligible: false,
      selectedRowCount: 630,
      validRawProbabilityRowCount: 630,
      crossFittedRowCount: 630,
      unavailableFoldCount: 0,
      full630CalibrationClaim: { authorized: false },
    })
    expect(artifact.full630CalibrationClaim.reasons).toContain(
      'synthetic_fixture_not_experiment_eligible',
    )
    expect(() =>
      verifyCrossFittedShadowTemperatureCalibration({
        scope,
        rows,
        foldRows,
        foldManifest,
        artifact,
      }),
    ).not.toThrow()
    const changed = rows.map((row) => ({ ...row }))
    changed[0]!.truthLabel = 'exclude'
    expect(() =>
      crossFitShadowTemperatureCalibration({ scope, rows: changed, foldRows, foldManifest }),
    ).toThrow(/truth labels/u)
    expect(artifact.artifactSha256).toMatch(/^[a-f0-9]{64}$/u)
  })
})
