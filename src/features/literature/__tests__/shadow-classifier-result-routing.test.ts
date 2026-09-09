import {
  abstentionRequiredForEvidence,
  NO_ADDITIONAL_SHADOW_ROUTING_RISK,
  SHADOW_ROUTING_ASSESSMENT_SCHEMA_VERSION,
  routeShadowComponentResult,
  validateShadowComponentResult,
  type RawShadowModelResponse,
} from '../shadow-classifier'

import { rawShadowPrediction, shadowPacket } from './shadow-classifier-fixtures'

function validate(result: unknown) {
  const { registry, envelope } = shadowPacket()
  return validateShadowComponentResult({ rawResult: result, packetEnvelope: envelope, registry })
}

function route(report: ReturnType<typeof validate>) {
  return routeShadowComponentResult({
    packetEnvelope: shadowPacket().envelope,
    validation: report,
    assessment: NO_ADDITIONAL_SHADOW_ROUTING_RISK,
  })
}

describe('shadow classifier result validation and routing', () => {
  it('accepts an exact prediction and preserves uncalibrated confidence semantics', () => {
    const report = validate(rawShadowPrediction())
    expect(report).toMatchObject({
      valid: true,
      status: 'accepted_prediction',
      result: {
        response: {
          state: 'prediction',
          selfReportedConfidence: 0.84,
          probabilities: null,
        },
      },
    })
    expect(route(report)).toEqual({
      policyVersion: 'literature-shadow-routing/1.0.0',
      route: 'shadow_observation',
      reasons: [],
      scientificWarnings: ['uncalibrated_model_confidence'],
      assignmentIds: ['assignment:ip_relevance:fixture'],
      evidenceSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      productionStateChanged: false,
      automaticAction: null,
      confidenceThresholdSelected: false,
    })
  })

  it.each([
    ['unknown output', { outputValues: ['not_in_registry'] }],
    ['missing evidence', { evidenceUsed: [] }],
    ['invented evidence', { evidenceUsed: [{ field: 'title', text: 'not in supplied title' }] }],
  ])('rejects %s without producing a prediction', (_name, overrides) => {
    const report = validate(rawShadowPrediction(overrides as Partial<RawShadowModelResponse>))
    expect(report.valid).toBe(false)
    expect(report.status).toBe('rejected_invalid')
    expect(report.result).toBeNull()
    expect(route(report)).toMatchObject({
      route: 'human_review',
      reasons: ['invalid_output'],
      automaticAction: null,
      productionStateChanged: false,
    })
  })

  it('accepts exact model-supplied probabilities but rejects model claims of calibration', () => {
    const prediction = rawShadowPrediction({
      probabilities: {
        vocabulary: ['include_core', 'include_adjacent', 'exclude', 'uncertain'],
        values: {
          include_core: 0.7,
          include_adjacent: 0.15,
          exclude: 0.1,
          uncertain: 0.05,
        },
        source: 'model_supplied',
        calibrated: false,
        calibrationArtifactSha256: null,
      },
    })
    expect(validate(prediction).status).toBe('accepted_prediction')

    const claimedCalibrated = {
      ...prediction,
      response: {
        ...prediction.response,
        probabilities: {
          ...prediction.response.probabilities,
          source: 'calibrator',
          calibrated: true,
          calibrationArtifactSha256: 'b'.repeat(64),
        },
      },
    }
    expect(validate(claimedCalibrated)).toMatchObject({
      valid: false,
      status: 'rejected_invalid',
      result: null,
    })
  })

  it.each([
    [
      'probabilities do not sum to one',
      { include_core: 0.6, include_adjacent: 0.1, exclude: 0.1, uncertain: 0.1 },
    ],
    [
      'prediction is not unique argmax',
      { include_core: 0.4, include_adjacent: 0.4, exclude: 0.1, uncertain: 0.1 },
    ],
  ])('rejects when %s', (_name, values) => {
    const result = rawShadowPrediction({
      probabilities: {
        vocabulary: ['include_core', 'include_adjacent', 'exclude', 'uncertain'],
        values,
        source: 'model_supplied',
        calibrated: false,
        calibrationArtifactSha256: null,
      },
    })
    expect(validate(result)).toMatchObject({ valid: false, result: null })
  })

  it('represents absent evidence as abstention, never as evidence used', () => {
    const abstention = rawShadowPrediction({
      state: 'abstention',
      outputValues: [],
      evidenceUsed: [],
      selfReportedConfidence: 0.99,
      probabilities: null,
      abstentionReasons: ['missing_full_text_when_required'],
      refusalCode: null,
    })
    const report = validate(abstention)
    expect(report.status).toBe('accepted_abstention')
    expect(route(report)).toMatchObject({
      route: 'human_review',
      reasons: ['missing_full_text_when_required'],
      automaticAction: null,
    })
  })

  it('routes every mandatory B7 condition to abstention even at high confidence', () => {
    const reasons = abstentionRequiredForEvidence({
      abstractAvailable: false,
      fullTextRequired: true,
      fullTextAvailable: false,
      conflictingEvidence: true,
      ambiguousProceduralScope: true,
      surgicalBronchoscopicBoundary: true,
      unfamiliarTechnology: true,
      taxonomyMismatch: true,
      classifierDisagreement: true,
      confidenceBelowCandidateThreshold: false,
    })
    expect(reasons).toEqual([
      'ambiguous_procedural_scope',
      'classifier_disagreement',
      'conflicting_evidence',
      'insufficient_abstract',
      'missing_full_text_when_required',
      'surgical_bronchoscopic_boundary',
      'taxonomy_mismatch',
      'unfamiliar_technology',
    ])
  })

  it('executes every coordinator-assessed B7 route regardless of a high-confidence prediction', () => {
    const report = validate(rawShadowPrediction({ selfReportedConfidence: 1 }))
    const decision = routeShadowComponentResult({
      packetEnvelope: shadowPacket().envelope,
      validation: report,
      assessment: {
        schemaVersion: SHADOW_ROUTING_ASSESSMENT_SCHEMA_VERSION,
        assessedBy: 'coordinator_policy',
        fullTextRequired: true,
        conflictingEvidence: true,
        ambiguousProceduralScope: true,
        surgicalBronchoscopicBoundary: true,
        unfamiliarTechnology: true,
        taxonomyMismatch: true,
        classifierDisagreement: true,
        confidenceBelowCandidateThreshold: true,
        candidateThresholdSelected: false,
      },
    })
    expect(decision).toMatchObject({
      route: 'human_review',
      reasons: [
        'ambiguous_procedural_scope',
        'classifier_disagreement',
        'confidence_below_unselected_candidate_threshold',
        'conflicting_evidence',
        'missing_full_text_when_required',
        'surgical_bronchoscopic_boundary',
        'taxonomy_mismatch',
        'unfamiliar_technology',
      ],
      automaticAction: null,
    })
  })

  it('does not let self-reported confidence bypass an abstention state', () => {
    const report = validate(
      rawShadowPrediction({
        state: 'abstention',
        outputValues: [],
        evidenceUsed: [],
        selfReportedConfidence: 1,
        abstentionReasons: ['taxonomy_mismatch'],
      }),
    )
    expect(route(report)).toMatchObject({
      route: 'human_review',
      reasons: ['taxonomy_mismatch'],
      confidenceThresholdSelected: false,
    })
  })
})
