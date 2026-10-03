/** @jest-environment node */
import type { StageAOutput } from '../../src/features/literature/classifier/stage-a-contract'
import type { TerminalAssignment } from './results'
import {
  assertExactRiskAnalysisCoverage,
  buildRoutedRecords,
  buildRoutingManifest,
  RiskEvidenceCoverageError,
} from './routing'

const ID_A = 'a'.repeat(64)
const ID_B = 'b'.repeat(64)
const ID_C = 'c'.repeat(64)
const ID_D = 'd'.repeat(64)
const ID_FOREIGN = 'f'.repeat(64)

function assignment(
  recordId: string,
  state: TerminalAssignment['state'],
  output: TerminalAssignment['output'] = null,
): TerminalAssignment {
  return { recordId, state, output, responseSha256: null, detail: null }
}

const NEGATIVE_OUTPUT: StageAOutput = {
  record_id: ID_A,
  triage_decision: 'obvious_irrelevant',
  confidence_band: 'high',
  reason_codes: ['clearly_nonpulmonary_domain'],
}

function scan(recordId: string, riskFlags: readonly string[] = []) {
  return { recordId, riskFlags }
}

const PROFILES = new Map([
  [ID_A, 'metadata_with_abstract' as const],
  [ID_B, 'metadata_with_abstract' as const],
  [ID_C, 'metadata_without_abstract' as const],
  [ID_D, 'metadata_without_abstract' as const],
])

describe('routing construction', () => {
  it('routes a clean low-risk negative to the candidate pool and everything else forward', () => {
    const routed = buildRoutedRecords({
      assignments: [
        assignment(ID_A, 'valid_prediction', { ...NEGATIVE_OUTPUT }),
        assignment(ID_B, 'valid_prediction', { ...NEGATIVE_OUTPUT, record_id: ID_B }),
        assignment(ID_C, 'invalid_quarantined'),
        assignment(ID_D, 'no_attempt'),
      ],
      evidenceProfiles: PROFILES,
      riskAnalysisResults: [scan(ID_A), scan(ID_B, ['signal_pulmonary']), scan(ID_C), scan(ID_D)],
    })
    const byId = new Map(routed.map((record) => [record.recordId, record]))
    expect(byId.get(ID_A)?.route).toBe('deprioritization_candidate')
    expect(byId.get(ID_B)?.route).toBe('advance_to_full_relevance_classification')
    expect(byId.get(ID_B)?.mandatoryPhysicianReview).toBe(true)
    expect(byId.get(ID_C)?.route).toBe('advance_to_full_relevance_classification')
    expect(byId.get(ID_D)?.route).toBe('advance_to_full_relevance_classification')
  })

  it('refuses a record without an evidence profile', () => {
    expect(() =>
      buildRoutedRecords({
        assignments: [assignment(ID_A, 'missing')],
        evidenceProfiles: new Map(),
        riskAnalysisResults: [scan(ID_A)],
      }),
    ).toThrow(/no evidence profile/u)
  })
})

/**
 * LUNA-ROUTE-001. Independent risk analysis is mandatory evidence: exactly one schema-valid
 * result per selected record, bound to that record, with no missing, duplicate, or foreign row.
 * The original reproduction — a selected record with no risk result reaching
 * `deprioritization_candidate` with `riskFlags: []` — must be impossible at both levels.
 */
describe('exact independent-risk coverage (LUNA-ROUTE-001)', () => {
  function route(riskAnalysisResults: readonly unknown[]) {
    return buildRoutedRecords({
      assignments: [
        assignment(ID_A, 'valid_prediction', { ...NEGATIVE_OUTPUT }),
        assignment(ID_B, 'valid_prediction', { ...NEGATIVE_OUTPUT, record_id: ID_B }),
      ],
      evidenceProfiles: PROFILES,
      riskAnalysisResults,
    })
  }

  it('refuses a missing risk row and never deprioritizes the original reproduction', () => {
    expect(() =>
      buildRoutedRecords({
        assignments: [assignment(ID_A, 'valid_prediction', { ...NEGATIVE_OUTPUT })],
        evidenceProfiles: PROFILES,
        riskAnalysisResults: [],
      }),
    ).toThrow(RiskEvidenceCoverageError)
    expect(() => route([scan(ID_A)])).toThrow(/coverage is incomplete/u)
  })

  it('refuses a duplicate risk row', () => {
    expect(() => route([scan(ID_A), scan(ID_A), scan(ID_B)])).toThrow(
      /more than one risk-analysis result/u,
    )
  })

  it('refuses an extra, foreign risk row', () => {
    expect(() => route([scan(ID_A), scan(ID_B), scan(ID_FOREIGN)])).toThrow(
      /outside the selection/u,
    )
  })

  it('refuses a risk row bound to the wrong record id', () => {
    expect(() => route([scan(ID_A), scan(ID_FOREIGN)])).toThrow(/outside the selection/u)
  })

  it('refuses a malformed risk row', () => {
    for (const malformed of [
      null,
      { recordId: ID_B },
      { recordId: ID_B, riskFlags: 'none' },
      { recordId: 'not-opaque', riskFlags: [] },
      { recordId: ID_B, riskFlags: ['signal_not_in_lexicon'] },
      { recordId: ID_B, riskFlags: ['signal_pleural', 'signal_pleural'] },
      { recordId: ID_B, riskFlags: [], extra: 1 },
    ]) {
      expect(() => route([scan(ID_A), malformed])).toThrow(RiskEvidenceCoverageError)
    }
  })

  it('refuses a duplicated record id in the selection itself', () => {
    expect(() =>
      buildRoutedRecords({
        assignments: [
          assignment(ID_A, 'valid_prediction', { ...NEGATIVE_OUTPUT }),
          assignment(ID_A, 'valid_prediction', { ...NEGATIVE_OUTPUT }),
        ],
        evidenceProfiles: PROFILES,
        riskAnalysisResults: [scan(ID_A)],
      }),
    ).toThrow(/appears twice/u)
  })

  it('accepts an empty valid risk array from a completed scan', () => {
    const routed = route([scan(ID_A), scan(ID_B)])
    expect(routed.map((record) => record.route)).toEqual([
      'deprioritization_candidate',
      'deprioritization_candidate',
    ])
    expect(routed.every((record) => record.riskFlags.length === 0)).toBe(true)
  })

  it('bars deprioritization on one real risk flag', () => {
    const routed = route([scan(ID_A, ['signal_bronchoscopy']), scan(ID_B)])
    const byId = new Map(routed.map((record) => [record.recordId, record]))
    expect(byId.get(ID_A)?.route).toBe('advance_to_full_relevance_classification')
    expect(byId.get(ID_A)?.routeReasons).toContain('coordinator_risk_flag_present')
    expect(byId.get(ID_A)?.mandatoryPhysicianReview).toBe(true)
    expect(byId.get(ID_B)?.route).toBe('deprioritization_candidate')
  })

  it('returns an exact one-to-one map when every record has one valid zero-risk result', () => {
    const coverage = assertExactRiskAnalysisCoverage(
      [ID_A, ID_B, ID_C, ID_D],
      [scan(ID_D), scan(ID_B), scan(ID_A), scan(ID_C)],
    )
    expect(coverage.size).toBe(4)
    expect(coverage.get(ID_C)?.riskFlags).toEqual([])
  })
})

describe('routing manifest aggregates', () => {
  it('counts routes, terminal states, mandatory review, and the stage-b queue', () => {
    const routed = buildRoutedRecords({
      assignments: [
        assignment(ID_A, 'valid_prediction', { ...NEGATIVE_OUTPUT }),
        assignment(ID_B, 'valid_prediction', { ...NEGATIVE_OUTPUT, record_id: ID_B }),
        assignment(ID_C, 'duplicate'),
        assignment(ID_D, 'no_attempt'),
      ],
      evidenceProfiles: new Map([
        [ID_A, 'metadata_with_abstract'],
        [ID_B, 'metadata_without_abstract'],
        [ID_C, 'metadata_with_abstract'],
        [ID_D, 'metadata_without_abstract'],
      ]),
      riskAnalysisResults: [
        scan(ID_A),
        scan(ID_B, ['signal_pleural', 'signal_thoracic']),
        scan(ID_C),
        scan(ID_D),
      ],
    })
    const manifest = buildRoutingManifest(routed)
    expect(manifest.total).toBe(4)
    expect(manifest.byRoute.deprioritization_candidate).toBe(1)
    expect(manifest.byRoute.advance_to_full_relevance_classification).toBe(3)
    expect(manifest.mandatoryPhysicianReviewCount).toBe(1)
    expect(manifest.riskFlaggedCount).toBe(1)
    expect(manifest.stageBQueue.total).toBe(3)
    expect(manifest.stageBQueue.byEntrySource.coordinator_risk_flag).toBe(1)
    expect(manifest.stageBQueue.byEntrySource.stage_a_output_unusable).toBe(1)
    expect(manifest.stageBQueue.byEntrySource.stage_a_not_attempted).toBe(1)
    expect(manifest.recordsSha256).toMatch(/^[0-9a-f]{64}$/u)
  })
})
