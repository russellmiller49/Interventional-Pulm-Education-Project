import {
  reconcileUltraFinalVerdict,
  reconcileUltraFinalVerdictBatch,
  ULTRA_FINAL_VERDICT_POLICY_VERSION,
  ULTRA_FINAL_VERDICT_SCHEMA_VERSION,
  type UltraFinalVerdictInput,
} from '@/features/literature/ultra-screening/final-verdict'
import type {
  UltraRelevanceLabel,
  UltraScreeningResult,
} from '@/features/literature/ultra-screening/core'

function result(
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

describe('deterministic Ultra final-verdict reconciliation', () => {
  it('accepts a clean first-pass inclusion but never a first-pass exclusion alone', () => {
    expect(
      reconcileUltraFinalVerdict({ pmid: '1', firstPass: result('1', 'include_core') }),
    ).toMatchObject({
      schemaVersion: ULTRA_FINAL_VERDICT_SCHEMA_VERSION,
      policyVersion: ULTRA_FINAL_VERDICT_POLICY_VERSION,
      status: 'final',
      relevanceLabel: 'include_core',
      resolvedBy: 'first_pass',
      auditReasons: ['first_pass_only'],
    })
    expect(
      reconcileUltraFinalVerdict({ pmid: '2', firstPass: result('2', 'exclude') }),
    ).toMatchObject({
      status: 'awaiting_exclusion_challenge',
      relevanceLabel: null,
      resolvedBy: null,
      auditReasons: ['exclusion_challenge_missing'],
    })
  })

  it('accepts clean challenge consensus and requires escalation for disagreement', () => {
    const consensus = reconcileUltraFinalVerdict({
      pmid: '3',
      firstPass: result('3', 'exclude'),
      exclusionChallenge: result('3', 'exclude', 'moderate'),
    })
    expect(consensus).toMatchObject({
      status: 'final',
      relevanceLabel: 'exclude',
      resolvedBy: 'exclusion_challenge_consensus',
      auditReasons: ['exclusion_challenge_consensus'],
    })

    const disagreement = reconcileUltraFinalVerdict({
      pmid: '4',
      firstPass: result('4', 'exclude'),
      exclusionChallenge: result('4', 'include_adjacent'),
    })
    expect(disagreement).toMatchObject({
      status: 'awaiting_escalation',
      relevanceLabel: null,
      auditReasons: ['screening_pass_disagreement', 'escalation_missing'],
    })
  })

  it('uses a clean escalation deterministically for disagreement and completed QC', () => {
    const input: UltraFinalVerdictInput = {
      pmid: '5',
      firstPass: result('5', 'exclude'),
      exclusionChallenge: result('5', 'include_adjacent', 'moderate'),
      escalation: result('5', 'include_core', 'moderate'),
      qcSelection: { selected: true, reasons: ['deterministic_qc', 'protected_cue'] },
    }
    expect(reconcileUltraFinalVerdict(input)).toMatchObject({
      status: 'final',
      relevanceLabel: 'include_core',
      resolvedBy: 'escalation',
      qcSelected: true,
      qcReasons: ['deterministic_qc', 'protected_cue'],
      auditReasons: ['screening_pass_disagreement', 'qc_selected', 'escalation_applied'],
    })

    expect(
      reconcileUltraFinalVerdict({
        pmid: '6',
        firstPass: result('6', 'include_core'),
        qcSelection: { selected: true, reasons: ['deterministic_qc'] },
      }),
    ).toMatchObject({
      status: 'awaiting_escalation',
      relevanceLabel: null,
      auditReasons: ['qc_selected', 'escalation_missing'],
    })
  })

  it.each(['include_core', 'exclude'] as const)(
    'rejects an out-of-flow escalation before the required exclusion challenge when it says %s',
    (escalationLabel) => {
      expect(() =>
        reconcileUltraFinalVerdict({
          pmid: '21',
          firstPass: result('21', 'exclude'),
          escalation: result('21', escalationLabel),
        }),
      ).toThrow('escalation requires')
    },
  )

  it('rejects challenges after inclusion and escalations without an authorized route', () => {
    expect(() =>
      reconcileUltraFinalVerdict({
        pmid: '23',
        firstPass: result('23', 'include_core'),
        exclusionChallenge: result('23', 'include_core'),
      }),
    ).toThrow('only after a first-pass exclusion')

    expect(() =>
      reconcileUltraFinalVerdict({
        pmid: '24',
        firstPass: result('24', 'include_core'),
        escalation: result('24', 'include_adjacent'),
      }),
    ).toThrow('escalation requires')
  })

  it('requires human review when escalation creates a new exclusion', () => {
    const verdict = reconcileUltraFinalVerdict({
      pmid: '22',
      firstPass: result('22', 'include_adjacent'),
      escalation: result('22', 'exclude'),
      qcSelection: { selected: true, reasons: ['deterministic_qc'] },
    })

    expect(verdict).toMatchObject({
      status: 'requires_human_review',
      relevanceLabel: null,
      resolvedBy: null,
      humanReviewRequired: true,
      auditReasons: ['qc_selected', 'escalation_applied', 'escalation_created_exclusion'],
    })
  })

  it('keeps result-level and explicit human-review requirements sticky', () => {
    const resultFlagged = reconcileUltraFinalVerdict({
      pmid: '7',
      firstPass: result('7', 'exclude', 'low'),
      exclusionChallenge: result('7', 'exclude'),
      escalation: result('7', 'exclude'),
    })
    expect(resultFlagged).toMatchObject({
      status: 'requires_human_review',
      relevanceLabel: null,
      humanReviewRequired: true,
      auditReasons: ['human_review_required_by_result', 'low_confidence_result'],
    })

    const explicitlyFlagged = reconcileUltraFinalVerdict({
      pmid: '8',
      firstPass: result('8', 'include_core'),
      humanReviewRequirement: {
        required: true,
        reasons: ['physician_boundary_review', 'protected_procedure_cue'],
      },
    })
    expect(explicitlyFlagged).toMatchObject({
      status: 'requires_human_review',
      humanReviewReasons: ['physician_boundary_review', 'protected_procedure_cue'],
      auditReasons: ['human_review_explicit'],
    })
  })

  it('produces order-independent batches with complete status counts', () => {
    const inputs: UltraFinalVerdictInput[] = [
      { pmid: '20', firstPass: result('20', 'include_adjacent') },
      { pmid: '3', firstPass: result('3', 'exclude') },
      {
        pmid: '11',
        firstPass: result('11', 'exclude'),
        exclusionChallenge: result('11', 'exclude'),
      },
    ]
    const forward = reconcileUltraFinalVerdictBatch(inputs)
    const reverse = reconcileUltraFinalVerdictBatch([...inputs].reverse())

    expect(reverse).toEqual(forward)
    expect(forward.verdicts.map((verdict) => verdict.pmid)).toEqual(['3', '11', '20'])
    expect(forward.countsByStatus).toEqual({
      final: 2,
      awaiting_exclusion_challenge: 1,
      awaiting_escalation: 0,
      requires_human_review: 0,
    })
  })

  it('rejects cross-PMID stage data, duplicate batches, and ambiguous reason lists', () => {
    expect(() =>
      reconcileUltraFinalVerdict({
        pmid: '9',
        firstPass: result('10', 'include_core'),
      }),
    ).toThrow('does not match')
    expect(() =>
      reconcileUltraFinalVerdictBatch([
        { pmid: '9', firstPass: result('9', 'include_core') },
        { pmid: '9', firstPass: result('9', 'exclude') },
      ]),
    ).toThrow('duplicate PMIDs')
    expect(() =>
      reconcileUltraFinalVerdict({
        pmid: '9',
        firstPass: result('9', 'include_core'),
        qcSelection: { selected: true, reasons: ['same', 'same'] },
      }),
    ).toThrow('duplicate reasons')
  })
})
