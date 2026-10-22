/** @jest-environment node */
import type { OverlayRelevance } from '../literature-reviewed-overlay/constants'
import { buildEvaluationReport, ratio } from './evaluation'
import type { TerminalAssignment } from './results'
import { buildRoutedRecords } from './routing'
import type { StageAOutput } from '../../src/features/literature/classifier/stage-a-contract'

/**
 * One hand-computed 30-record scenario exercising every terminal state, both evidence
 * profiles, subgroup suppression, the abstention-is-not-false-exclusion rule, and the
 * negative bucket before and after the risk gate.
 */

function id(index: number): string {
  return index.toString(16).padStart(64, '0')
}

function output(
  recordId: string,
  decision: StageAOutput['triage_decision'],
  band: StageAOutput['confidence_band'],
  codes: readonly string[],
): StageAOutput {
  return {
    record_id: recordId,
    triage_decision: decision,
    confidence_band: band,
    reason_codes: codes as StageAOutput['reason_codes'],
  }
}

interface Row {
  readonly recordId: string
  readonly truth: OverlayRelevance
  readonly state: TerminalAssignment['state']
  readonly output: StageAOutput | null
  readonly risk: readonly string[]
  readonly profile: 'metadata_with_abstract' | 'metadata_without_abstract'
}

function scenario(): Row[] {
  const rows: Row[] = []
  const NEG = ['clearly_nonpulmonary_domain']
  const PROT = ['pulmonary_relevance_unclear']
  const INSUF = ['metadata_insufficient']
  // E1..E10: clean high-confidence negatives on excludes (deprioritized).
  for (let index = 0; index < 10; index += 1) {
    rows.push({
      recordId: id(index),
      truth: 'exclude',
      state: 'valid_prediction',
      output: output(id(index), 'obvious_irrelevant', 'high', NEG),
      risk: [],
      profile: 'metadata_with_abstract',
    })
  }
  // E11: identical but risk-flagged (mandatory review, advances).
  rows.push({
    recordId: id(10),
    truth: 'exclude',
    state: 'valid_prediction',
    output: output(id(10), 'obvious_irrelevant', 'high', NEG),
    risk: ['signal_pulmonary'],
    profile: 'metadata_with_abstract',
  })
  // E12: medium-confidence negative (advances; still a correct classification).
  rows.push({
    recordId: id(11),
    truth: 'exclude',
    state: 'valid_prediction',
    output: output(id(11), 'obvious_irrelevant', 'medium', NEG),
    risk: [],
    profile: 'metadata_with_abstract',
  })
  // E13: wrongly-protective prediction on an exclude.
  rows.push({
    recordId: id(12),
    truth: 'exclude',
    state: 'valid_prediction',
    output: output(id(12), 'potentially_relevant', 'high', PROT),
    risk: [],
    profile: 'metadata_with_abstract',
  })
  // E14: abstention on an exclude.
  rows.push({
    recordId: id(13),
    truth: 'exclude',
    state: 'valid_abstention',
    output: output(id(13), 'insufficient_evidence', 'low', INSUF),
    risk: [],
    profile: 'metadata_with_abstract',
  })
  // E15..E19: refusal, invalid, missing, duplicate, no_attempt.
  const terminalStates: TerminalAssignment['state'][] = [
    'refusal',
    'invalid_quarantined',
    'missing',
    'duplicate',
    'no_attempt',
  ]
  terminalStates.forEach((state, offset) => {
    rows.push({
      recordId: id(14 + offset),
      truth: 'exclude',
      state,
      output: null,
      risk: [],
      profile: 'metadata_with_abstract',
    })
  })
  // E20: one more clean deprioritized exclude.
  rows.push({
    recordId: id(19),
    truth: 'exclude',
    state: 'valid_prediction',
    output: output(id(19), 'obvious_irrelevant', 'high', NEG),
    risk: [],
    profile: 'metadata_with_abstract',
  })
  // C1..C4 (with abstract) and C5..C6 (without): correct core predictions.
  for (let index = 0; index < 6; index += 1) {
    rows.push({
      recordId: id(20 + index),
      truth: 'include_core',
      state: 'valid_prediction',
      output: output(id(20 + index), 'potentially_relevant', 'high', PROT),
      risk: ['signal_pulmonary'],
      profile: index < 4 ? 'metadata_with_abstract' : 'metadata_without_abstract',
    })
  }
  // C7: abstention on a core record — an abstention, never a false exclusion.
  rows.push({
    recordId: id(26),
    truth: 'include_core',
    state: 'valid_abstention',
    output: output(id(26), 'insufficient_evidence', 'low', INSUF),
    risk: [],
    profile: 'metadata_without_abstract',
  })
  // C8: the dangerous case — a (medium-band) negative prediction on a core record.
  rows.push({
    recordId: id(27),
    truth: 'include_core',
    state: 'valid_prediction',
    output: output(id(27), 'obvious_irrelevant', 'medium', NEG),
    risk: [],
    profile: 'metadata_without_abstract',
  })
  // A1: correct adjacent; A2: missing adjacent.
  rows.push({
    recordId: id(28),
    truth: 'include_adjacent',
    state: 'valid_prediction',
    output: output(id(28), 'potentially_relevant', 'high', PROT),
    risk: [],
    profile: 'metadata_without_abstract',
  })
  rows.push({
    recordId: id(29),
    truth: 'include_adjacent',
    state: 'missing',
    output: null,
    risk: [],
    profile: 'metadata_without_abstract',
  })
  return rows
}

function buildInputs(rows: readonly Row[]) {
  const assignments: TerminalAssignment[] = rows.map((row) => ({
    recordId: row.recordId,
    state: row.state,
    output: row.output,
    responseSha256: null,
    detail: null,
  }))
  const routed = buildRoutedRecords({
    assignments,
    evidenceProfiles: new Map(rows.map((row) => [row.recordId, row.profile])),
    riskAnalysisResults: rows.map((row) => ({ recordId: row.recordId, riskFlags: row.risk })),
  })
  const truthByRecordId = new Map(rows.map((row) => [row.recordId, row.truth]))
  const selectedRecordIds = rows.map((row) => row.recordId)
  return { assignments, routed, truthByRecordId, selectedRecordIds }
}

describe('ratio discipline', () => {
  it('returns null, never NaN, on zero denominators', () => {
    expect(ratio(1, 0)).toBeNull()
    expect(ratio(0, 4)).toBe(0)
  })
})

describe('evaluation report over the hand-computed scenario', () => {
  const { assignments, routed, truthByRecordId, selectedRecordIds } = buildInputs(scenario())
  const report = buildEvaluationReport({
    cohortLabel: 'synthetic-30',
    selectedRecordIds,
    routed,
    assignments,
    truthByRecordId,
  })

  it('accounts every denominator and reconciles exactly', () => {
    expect(report.denominators).toEqual({
      selected: 30,
      attempted: 29,
      validPredictions: 22,
      validAbstentions: 2,
      refusals: 1,
      invalidQuarantined: 1,
      missing: 2,
      duplicate: 1,
      noAttempt: 1,
    })
    expect(report.reconciliation).toEqual({
      attemptedPlusNoAttemptEqualsSelected: true,
      terminalStatesSumToSelected: true,
      attemptedStatesSumToAttempted: true,
    })
    expect(report.classifiedCoverageAllSelected).toBeCloseTo(22 / 30, 10)
    expect(report.abstentionCoverageAllSelected).toBeCloseTo(2 / 30, 10)
  })

  it('computes the classified metrics with stated denominators', () => {
    expect(report.classified?.accuracyClassified).toBeCloseTo(20 / 22, 10)
    expect(report.classified?.includeSensitivityClassifiedIncludes).toBeCloseTo(7 / 8, 10)
    expect(report.classified?.excludePrecisionPredictedNegative).toBeCloseTo(13 / 14, 10)
    expect(report.classified?.excludeSpecificityClassifiedExcludes).toBeCloseTo(13 / 14, 10)
    expect(report.classified?.coreRecallClassifiedCore).toBeCloseTo(6 / 7, 10)
    expect(report.classified?.adjacentRecallClassifiedAdjacent).toBe(1)
  })

  it('separates false exclusions from abstentions', () => {
    // C8 is the only prediction-level false exclusion; C7 abstained and must not count.
    expect(report.falseExclusions?.predictionFalseExclusions).toBe(1)
    expect(report.falseExclusions?.predictionFalseExclusionRateAllRelevantSelected).toBeCloseTo(
      1 / 10,
      10,
    )
    expect(report.falseExclusions?.routingFalseExclusions).toBe(0)
    expect(report.falseExclusions?.routingFalseExclusionsByEvidenceProfile).toEqual({
      metadata_with_abstract: 0,
      metadata_without_abstract: 0,
    })
  })

  it('measures the negative bucket before and after the risk gate', () => {
    expect(report.negativeBucket?.count).toBe(12)
    expect(report.negativeBucket?.includeCoreCount).toBe(0)
    expect(report.negativeBucket?.includeAdjacentCount).toBe(0)
    expect(report.negativeBucket?.observedPrecisionBucket).toBe(1)
    expect(report.negativeBucket?.lowRiskCount).toBe(11)
    expect(report.negativeBucket?.lowRiskObservedPrecisionBucket).toBe(1)
    expect(report.routedExcludeYieldAllExcludes).toBeCloseTo(11 / 20, 10)
  })

  it('builds the full confusion matrix including non-valid outcomes', () => {
    expect(report.confusionMatrix?.exclude).toEqual({
      obvious_irrelevant: 13,
      potentially_relevant: 1,
      insufficient_evidence: 1,
      refusal: 1,
      invalid_quarantined: 1,
      missing: 1,
      duplicate: 1,
      no_attempt: 1,
    })
    expect(report.confusionMatrix?.include_core).toEqual({
      potentially_relevant: 6,
      insufficient_evidence: 1,
      obvious_irrelevant: 1,
    })
    expect(report.confusionMatrix?.include_adjacent).toEqual({
      potentially_relevant: 1,
      missing: 1,
    })
  })

  it('suppresses subgroup rates below the minimum support and keeps support visible', () => {
    const withAbstract = report.byEvidenceProfile?.metadata_with_abstract
    const withoutAbstract = report.byEvidenceProfile?.metadata_without_abstract
    expect(withAbstract?.support).toBe(24)
    expect(withAbstract?.suppressed).toBe(false)
    expect(withAbstract?.deprioritizedExcludeYieldAllExcludes).toBeCloseTo(11 / 20, 10)
    expect(withoutAbstract?.support).toBe(6)
    expect(withoutAbstract?.suppressed).toBe(true)
    expect(withoutAbstract?.accuracyClassified).toBeNull()
    expect(report.byConfidenceBand?.high.suppressed).toBe(false)
    expect(report.byConfidenceBand?.medium.suppressed).toBe(true)
  })

  it('reports reason-code and risk-flag distributions', () => {
    expect(report.reasonCodeDistribution.clearly_nonpulmonary_domain).toBe(14)
    expect(report.riskFlagDistribution.signal_pulmonary).toBe(7)
  })
})

describe('evaluation guardrails', () => {
  it('runs truth-free for non-calibration cohorts with metrics nulled', () => {
    const { assignments, routed, selectedRecordIds } = buildInputs(scenario())
    const report = buildEvaluationReport({
      cohortLabel: 'pilot-1000',
      selectedRecordIds,
      routed,
      assignments,
      truthByRecordId: new Map(),
    })
    expect(report.truthAvailable).toBe(false)
    expect(report.classified).toBeNull()
    expect(report.negativeBucket).toBeNull()
    expect(report.denominators.selected).toBe(30)
  })

  it('stops when a calibration record lacks truth', () => {
    const rows = scenario()
    const { assignments, routed, truthByRecordId, selectedRecordIds } = buildInputs(rows)
    truthByRecordId.delete(rows[0].recordId)
    expect(() =>
      buildEvaluationReport({
        cohortLabel: 'locked-sanity-200',
        selectedRecordIds,
        routed,
        assignments,
        truthByRecordId,
      }),
    ).toThrow(/no .*truth row|no physician truth/u)
  })
})

/**
 * Exact set equality between the authoritative selection and every table the report reads.
 *
 * The failure this replaces was quiet in the worst way: two terminal assignments, one routed
 * record, `selected = 1`, and every reconciliation flag true. Iterating the routed table made
 * the extra assignment invisible, so a run whose accounting was broken reported itself clean.
 * Denominators now derive from the selection, and each of assignments, routing, and truth must
 * equal it member for member.
 */
describe('exact evaluation set equality', () => {
  const A = id(1)
  const B = id(2)

  const assignmentFor = (recordId: string): TerminalAssignment => ({
    recordId,
    state: 'valid_prediction',
    output: output(recordId, 'potentially_relevant', 'high', ['pulmonary_relevance_unclear']),
    responseSha256: null,
    detail: null,
  })
  const routeFor = (recordId: string) => ({
    recordId,
    route: 'advance_to_full_relevance_classification' as const,
    routeReasons: [],
    terminalState: 'valid_prediction' as const,
    evidenceProfile: 'metadata_with_abstract' as const,
    riskFlags: [],
    mandatoryPhysicianReview: false,
  })

  const evaluate = (inputs: {
    selectedRecordIds: string[]
    assignments: TerminalAssignment[]
    routed: ReturnType<typeof routeFor>[]
  }) =>
    buildEvaluationReport({
      cohortLabel: 'synthetic',
      selectedRecordIds: inputs.selectedRecordIds,
      routed: inputs.routed,
      assignments: inputs.assignments,
      truthByRecordId: new Map(),
    })

  it('accepts one exact valid equality', () => {
    const report = evaluate({
      selectedRecordIds: [A, B],
      assignments: [assignmentFor(A), assignmentFor(B)],
      routed: [routeFor(A), routeFor(B)],
    })
    expect(report.denominators.selected).toBe(2)
    expect(report.reconciliation.terminalStatesSumToSelected).toBe(true)
  })

  it('refuses two assignments for one routed record', () => {
    expect(() =>
      evaluate({
        selectedRecordIds: [A],
        assignments: [assignmentFor(A), assignmentFor(B)],
        routed: [routeFor(A)],
      }),
    ).toThrow(/outside the selected cohort/u)
  })

  it('refuses one assignment with two routed records', () => {
    expect(() =>
      evaluate({
        selectedRecordIds: [A],
        assignments: [assignmentFor(A)],
        routed: [routeFor(A), routeFor(B)],
      }),
    ).toThrow(/outside the selected cohort/u)
  })

  it('refuses a missing assignment and a missing route', () => {
    expect(() =>
      evaluate({
        selectedRecordIds: [A, B],
        assignments: [assignmentFor(A)],
        routed: [routeFor(A), routeFor(B)],
      }),
    ).toThrow(/no terminal assignment row/u)
    expect(() =>
      evaluate({
        selectedRecordIds: [A, B],
        assignments: [assignmentFor(A), assignmentFor(B)],
        routed: [routeFor(A)],
      }),
    ).toThrow(/no routing row/u)
  })

  it('refuses duplicated assignments and duplicated routes', () => {
    expect(() =>
      evaluate({
        selectedRecordIds: [A],
        assignments: [assignmentFor(A), assignmentFor(A)],
        routed: [routeFor(A)],
      }),
    ).toThrow(/more than one terminal assignment row/u)
    expect(() =>
      evaluate({
        selectedRecordIds: [A],
        assignments: [assignmentFor(A)],
        routed: [routeFor(A), routeFor(A)],
      }),
    ).toThrow(/more than one routing row/u)
  })

  it('refuses a wrong record id and a duplicated selection', () => {
    expect(() =>
      evaluate({
        selectedRecordIds: [A],
        assignments: [assignmentFor(B)],
        routed: [routeFor(B)],
      }),
    ).toThrow(/no terminal assignment row|outside the selected cohort/u)
    expect(() =>
      evaluate({
        selectedRecordIds: [A, A],
        assignments: [assignmentFor(A)],
        routed: [routeFor(A)],
      }),
    ).toThrow(/duplicate record id/u)
  })

  it('refuses a truth table that disagrees with the selection', () => {
    expect(() =>
      buildEvaluationReport({
        cohortLabel: 'locked-sanity-200',
        selectedRecordIds: [A, B],
        routed: [routeFor(A), routeFor(B)],
        assignments: [assignmentFor(A), assignmentFor(B)],
        truthByRecordId: new Map([[A, 'exclude']]),
      }),
    ).toThrow(/no physician truth row/u)
  })

  it('keeps zero-denominator and subgroup behaviour correct at the smallest size', () => {
    const report = evaluate({
      selectedRecordIds: [A],
      assignments: [assignmentFor(A)],
      routed: [routeFor(A)],
    })
    // Support of one is well below the suppression minimum; rates stay null, never NaN.
    expect(report.byEvidenceProfile).toBeNull()
    expect(report.classifiedCoverageAllSelected).toBe(1)
    expect(ratio(0, 0)).toBeNull()
  })
})
