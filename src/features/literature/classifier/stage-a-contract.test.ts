/** @jest-environment node */
import {
  STAGE_A_CONFIDENCE_BANDS,
  STAGE_A_NEGATIVE_ONLY_REASON_CODES,
  STAGE_A_PROTECTIVE_REASON_CODES,
  STAGE_A_REASON_CODES,
  STAGE_A_TERMINAL_STATES,
  isNegativeOnlyReasonCode,
  isProtectiveReasonCode,
  routeStageARecord,
  validateStageAOutput,
  validateStageARiskAnalysisResult,
  type StageAOutput,
  type StageATerminalState,
} from './stage-a-contract'

const RECORD_ID = 'a'.repeat(64)

function output(overrides: Partial<StageAOutput> = {}): Record<string, unknown> {
  return {
    record_id: RECORD_ID,
    triage_decision: 'obvious_irrelevant',
    confidence_band: 'high',
    reason_codes: ['clearly_nonpulmonary_domain'],
    ...overrides,
  }
}

describe('stage-a output contract', () => {
  it('pins the closed vocabularies', () => {
    expect(STAGE_A_NEGATIVE_ONLY_REASON_CODES).toHaveLength(5)
    expect(STAGE_A_PROTECTIVE_REASON_CODES).toHaveLength(13)
    expect(STAGE_A_REASON_CODES).toHaveLength(18)
    expect(new Set(STAGE_A_REASON_CODES).size).toBe(18)
    expect(STAGE_A_CONFIDENCE_BANDS).toEqual(['high', 'medium', 'low'])
    for (const code of STAGE_A_NEGATIVE_ONLY_REASON_CODES) {
      expect(isNegativeOnlyReasonCode(code)).toBe(true)
      expect(isProtectiveReasonCode(code)).toBe(false)
    }
    for (const code of STAGE_A_PROTECTIVE_REASON_CODES) {
      expect(isProtectiveReasonCode(code)).toBe(true)
      expect(isNegativeOnlyReasonCode(code)).toBe(false)
    }
  })

  it('accepts a clean negative output', () => {
    const validated = validateStageAOutput(output())
    expect(validated.ok).toBe(true)
  })

  it('rejects unknown fields, unknown codes, and malformed record ids', () => {
    expect(validateStageAOutput({ ...output(), rationale: 'because' } as never).ok).toBe(false)
    expect(validateStageAOutput(output({ reason_codes: ['made_up_code'] as never })).ok).toBe(false)
    expect(validateStageAOutput({ ...output(), record_id: 'short' }).ok).toBe(false)
    expect(validateStageAOutput({ ...output(), record_id: RECORD_ID.toUpperCase() }).ok).toBe(false)
  })

  it('rejects empty and duplicated reason codes', () => {
    expect(validateStageAOutput(output({ reason_codes: [] as never })).ok).toBe(false)
    expect(
      validateStageAOutput(
        output({
          reason_codes: ['clearly_nonpulmonary_domain', 'clearly_nonpulmonary_domain'] as never,
        }),
      ).ok,
    ).toBe(false)
  })

  it('makes obvious_irrelevant invalid whenever any protective reason is present', () => {
    for (const protective of STAGE_A_PROTECTIVE_REASON_CODES) {
      const validated = validateStageAOutput(
        output({
          reason_codes: ['clearly_nonpulmonary_domain', protective] as never,
        }),
      )
      expect(validated.ok).toBe(false)
    }
  })

  it('rejects negative-only reasons on non-negative decisions', () => {
    expect(
      validateStageAOutput(
        output({
          triage_decision: 'potentially_relevant' as never,
          reason_codes: ['clearly_nonpulmonary_domain'] as never,
        }),
      ).ok,
    ).toBe(false)
    expect(
      validateStageAOutput(
        output({
          triage_decision: 'insufficient_evidence' as never,
          reason_codes: ['metadata_insufficient', 'unrelated_condition_or_population'] as never,
        }),
      ).ok,
    ).toBe(false)
  })

  it('accepts protective reasons on the two non-negative decisions', () => {
    expect(
      validateStageAOutput(
        output({
          triage_decision: 'potentially_relevant' as never,
          reason_codes: ['possible_airway_relevance'] as never,
        }),
      ).ok,
    ).toBe(true)
    expect(
      validateStageAOutput(
        output({
          triage_decision: 'insufficient_evidence' as never,
          confidence_band: 'low' as never,
          reason_codes: ['metadata_insufficient'] as never,
        }),
      ).ok,
    ).toBe(true)
  })
})

describe('stage-a routing contract', () => {
  const validNegative = (): StageAOutput => ({
    record_id: RECORD_ID,
    triage_decision: 'obvious_irrelevant',
    confidence_band: 'high',
    reason_codes: ['clearly_nonpulmonary_domain'],
  })

  const cleanScan = (recordId = RECORD_ID) => ({ recordId, riskFlags: [] })

  it('routes the one clean case into deprioritization_candidate', () => {
    const decision = routeStageARecord({
      recordId: RECORD_ID,
      terminalState: 'valid_prediction',
      output: validNegative(),
      riskAnalysisResult: cleanScan(),
    })
    expect(decision.route).toBe('deprioritization_candidate')
  })

  it('advances every non-valid terminal state by default', () => {
    const states: StageATerminalState[] = STAGE_A_TERMINAL_STATES.filter(
      (state) => state !== 'valid_prediction',
    )
    for (const state of states) {
      const decision = routeStageARecord({
        recordId: RECORD_ID,
        terminalState: state,
        output: null,
        riskAnalysisResult: cleanScan(),
      })
      expect(decision.route).toBe('advance_to_full_relevance_classification')
    }
  })

  it('advances non-negative decisions and sub-high confidence', () => {
    expect(
      routeStageARecord({
        recordId: RECORD_ID,
        terminalState: 'valid_prediction',
        output: { ...validNegative(), triage_decision: 'potentially_relevant' },
        riskAnalysisResult: cleanScan(),
      }).route,
    ).toBe('advance_to_full_relevance_classification')
    for (const band of ['medium', 'low'] as const) {
      expect(
        routeStageARecord({
          recordId: RECORD_ID,
          terminalState: 'valid_prediction',
          output: { ...validNegative(), confidence_band: band },
          riskAnalysisResult: cleanScan(),
        }).route,
      ).toBe('advance_to_full_relevance_classification')
    }
  })

  it('advances when any coordinator risk flag is present', () => {
    const decision = routeStageARecord({
      recordId: RECORD_ID,
      terminalState: 'valid_prediction',
      output: validNegative(),
      riskAnalysisResult: { recordId: RECORD_ID, riskFlags: ['signal_pulmonary'] },
    })
    expect(decision.route).toBe('advance_to_full_relevance_classification')
    expect(decision.routeReasons).toContain('coordinator_risk_flag_present')
  })

  it('advances when a protective reason somehow reaches routing', () => {
    const decision = routeStageARecord({
      recordId: RECORD_ID,
      terminalState: 'valid_prediction',
      output: {
        ...validNegative(),
        reason_codes: ['possible_airway_relevance'] as never,
      },
      riskAnalysisResult: cleanScan(),
    })
    expect(decision.route).toBe('advance_to_full_relevance_classification')
  })
})

describe('mandatory independent risk evidence (LUNA-ROUTE-001)', () => {
  const validNegative = (): StageAOutput => ({
    record_id: RECORD_ID,
    triage_decision: 'obvious_irrelevant',
    confidence_band: 'high',
    reason_codes: ['clearly_nonpulmonary_domain'],
  })

  const unusable: readonly [string, unknown][] = [
    ['missing evidence', undefined],
    ['null evidence', null],
    ['an empty object', {}],
    ['a bare array', []],
    ['a non-array riskFlags', { recordId: RECORD_ID, riskFlags: 'none' }],
    ['a foreign record id', { recordId: 'b'.repeat(64), riskFlags: [] }],
    ['a non-hex record id', { recordId: 'not-an-opaque-id', riskFlags: [] }],
    ['a flag outside the closed lexicon', { recordId: RECORD_ID, riskFlags: ['signal_unknown'] }],
    ['duplicate flags', { recordId: RECORD_ID, riskFlags: ['signal_pleural', 'signal_pleural'] }],
    ['an extra key', { recordId: RECORD_ID, riskFlags: [], scanned: true }],
  ]

  it.each(unusable)(
    'never deprioritizes a high-confidence negative with %s',
    (_label, riskAnalysisResult) => {
      const decision = routeStageARecord({
        recordId: RECORD_ID,
        terminalState: 'valid_prediction',
        output: validNegative(),
        riskAnalysisResult,
      })
      expect(decision.route).toBe('advance_to_full_relevance_classification')
      expect(decision.routeReasons).toEqual([
        'risk_evidence_missing_or_unusable_advances_by_default',
      ])
    },
  )

  it('accepts an empty flag list only when the scan for that exact record completed', () => {
    expect(validateStageARiskAnalysisResult({ recordId: RECORD_ID, riskFlags: [] }).ok).toBe(true)
    expect(validateStageARiskAnalysisResult(undefined).ok).toBe(false)
    expect(
      routeStageARecord({
        recordId: RECORD_ID,
        terminalState: 'valid_prediction',
        output: validNegative(),
        riskAnalysisResult: { recordId: RECORD_ID, riskFlags: [] },
      }).route,
    ).toBe('deprioritization_candidate')
  })
})
