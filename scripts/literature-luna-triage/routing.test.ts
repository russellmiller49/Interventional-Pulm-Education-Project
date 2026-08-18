/** @jest-environment node */
import type { StageAOutput } from '../../src/features/literature/classifier/stage-a-contract'
import type { TerminalAssignment } from './results'
import { buildRoutedRecords, buildRoutingManifest } from './routing'

const ID_A = 'a'.repeat(64)
const ID_B = 'b'.repeat(64)
const ID_C = 'c'.repeat(64)
const ID_D = 'd'.repeat(64)

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

describe('routing construction', () => {
  it('routes a clean low-risk negative to the candidate pool and everything else forward', () => {
    const routed = buildRoutedRecords({
      assignments: [
        assignment(ID_A, 'valid_prediction', { ...NEGATIVE_OUTPUT }),
        assignment(ID_B, 'valid_prediction', {
          ...NEGATIVE_OUTPUT,
          record_id: ID_B,
        }),
        assignment(ID_C, 'invalid_quarantined'),
        assignment(ID_D, 'no_attempt'),
      ],
      evidenceProfiles: new Map([
        [ID_A, 'metadata_with_abstract'],
        [ID_B, 'metadata_with_abstract'],
        [ID_C, 'metadata_without_abstract'],
        [ID_D, 'metadata_without_abstract'],
      ]),
      riskFlags: new Map([
        [ID_A, []],
        [ID_B, ['signal_pulmonary']],
        [ID_C, []],
        [ID_D, []],
      ]),
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
        riskFlags: new Map(),
      }),
    ).toThrow(/no evidence profile/u)
  })
})

describe('routing manifest aggregates', () => {
  it('counts routes, terminal states, mandatory review, and the stage-b queue', () => {
    const routed = buildRoutedRecords({
      assignments: [
        assignment(ID_A, 'valid_prediction', { ...NEGATIVE_OUTPUT }),
        assignment(ID_B, 'valid_prediction', {
          ...NEGATIVE_OUTPUT,
          record_id: ID_B,
        }),
        assignment(ID_C, 'duplicate'),
        assignment(ID_D, 'no_attempt'),
      ],
      evidenceProfiles: new Map([
        [ID_A, 'metadata_with_abstract'],
        [ID_B, 'metadata_without_abstract'],
        [ID_C, 'metadata_with_abstract'],
        [ID_D, 'metadata_without_abstract'],
      ]),
      riskFlags: new Map([
        [ID_A, []],
        [ID_B, ['signal_pleural', 'signal_thoracic']],
        [ID_C, []],
        [ID_D, []],
      ]),
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
