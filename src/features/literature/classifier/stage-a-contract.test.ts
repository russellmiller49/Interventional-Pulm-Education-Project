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

  it('routes the one clean case into deprioritization_candidate', () => {
    const decision = routeStageARecord({
      terminalState: 'valid_prediction',
      output: validNegative(),
      coordinatorRiskFlags: [],
    })
    expect(decision.route).toBe('deprioritization_candidate')
  })

  it('advances every non-valid terminal state by default', () => {
    const states: StageATerminalState[] = STAGE_A_TERMINAL_STATES.filter(
      (state) => state !== 'valid_prediction',
    )
    for (const state of states) {
      const decision = routeStageARecord({
        terminalState: state,
        output: null,
        coordinatorRiskFlags: [],
      })
      expect(decision.route).toBe('advance_to_full_relevance_classification')
    }
  })

  it('advances non-negative decisions and sub-high confidence', () => {
    expect(
      routeStageARecord({
        terminalState: 'valid_prediction',
        output: { ...validNegative(), triage_decision: 'potentially_relevant' },
        coordinatorRiskFlags: [],
      }).route,
    ).toBe('advance_to_full_relevance_classification')
    for (const band of ['medium', 'low'] as const) {
      expect(
        routeStageARecord({
          terminalState: 'valid_prediction',
          output: { ...validNegative(), confidence_band: band },
          coordinatorRiskFlags: [],
        }).route,
      ).toBe('advance_to_full_relevance_classification')
    }
  })

  it('advances when any coordinator risk flag is present', () => {
    const decision = routeStageARecord({
      terminalState: 'valid_prediction',
      output: validNegative(),
      coordinatorRiskFlags: ['signal_pulmonary'],
    })
    expect(decision.route).toBe('advance_to_full_relevance_classification')
    expect(decision.routeReasons).toContain('coordinator_risk_flag_present')
  })

  it('advances when a protective reason somehow reaches routing', () => {
    const decision = routeStageARecord({
      terminalState: 'valid_prediction',
      output: {
        ...validNegative(),
        reason_codes: ['possible_airway_relevance'] as never,
      },
      coordinatorRiskFlags: [],
    })
    expect(decision.route).toBe('advance_to_full_relevance_classification')
  })
})
