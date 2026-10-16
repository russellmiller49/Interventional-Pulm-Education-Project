import {
  buildShadowModelPacket,
  createShadowComponentAttemptEnvelope,
  createShadowRunArtifact,
  NO_ADDITIONAL_SHADOW_ROUTING_RISK,
  replayShadowComponentEvidence,
  replaceShadowClassifierComponent,
  rollBackShadowRunToHumanOnly,
  sha256ShadowValue,
  verifyShadowRunArtifact,
  verifyShadowRunEventHistory,
  type RawShadowComponentResult,
  type ShadowModelPacketEnvelope,
  type ShadowRunArtifact,
} from '../shadow-classifier'

import {
  SHADOW_TEST_COMPLETED_TIME,
  SHADOW_TEST_TIME,
  rawShadowPrediction,
  shadowLevelOnePolicy,
  shadowPacket,
  shadowTestArticle,
  syntheticDevelopmentScope,
} from './shadow-classifier-fixtures'

function fixtureArtifact() {
  const { registry, envelope } = shadowPacket()
  return createShadowRunArtifact({
    runId: 'shadow-run:fixture',
    repositoryCommit: 'a'.repeat(40),
    createdAt: SHADOW_TEST_TIME,
    scope: syntheticDevelopmentScope(),
    registry,
    autonomyPolicy: shadowLevelOnePolicy(),
    assignments: [
      {
        packetEnvelope: envelope,
        rawResult: rawShadowPrediction(),
        routingAssessment: NO_ADDITIONAL_SHADOW_ROUTING_RISK,
      },
    ],
    exactInputArtifactSha256s: [envelope.packetSha256],
  })
}

function resultForPacket(
  packetEnvelope: ReturnType<typeof shadowPacket>['envelope'],
): RawShadowComponentResult {
  return createShadowComponentAttemptEnvelope({
    packetEnvelope,
    startedAt: SHADOW_TEST_TIME,
    completedAt: SHADOW_TEST_COMPLETED_TIME,
    modelResponse: rawShadowPrediction().response,
  })
}

describe('immutable shadow run evidence contract', () => {
  it('seals every assignment into a checksummed, effect-free artifact', () => {
    const artifact = fixtureArtifact()
    expect(() => verifyShadowRunArtifact(artifact, syntheticDevelopmentScope())).not.toThrow()
    expect(artifact).toMatchObject({
      state: 'immutable_shadow_evidence',
      developmentOnly: true,
      heldOutValidated: false,
      productionAuthorized: false,
      productionEffects: {
        publish: false,
        hide: false,
        exclude: false,
        changeRelevance: false,
        changeVisibility: false,
        changeGoldLabel: false,
        moveCurrentReviewPointer: false,
        unlockTestData: false,
        writeDatabase: false,
      },
    })
    expect(artifact.attempts).toHaveLength(1)
    expect(artifact.events.map((event) => event.eventType)).toEqual([
      'run_created',
      'assignment_created',
      'component_result_recorded',
      'routing_recorded',
    ])
    expect(artifact.artifactSha256).toMatch(/^[a-f0-9]{64}$/u)
    expect(Object.isFrozen(artifact)).toBe(true)
    expect(Object.isFrozen(artifact.attempts)).toBe(true)
  })

  it('persists missing and invalid assigned outputs instead of silently omitting them', () => {
    const { registry, envelope } = shadowPacket()
    const secondPacket = buildShadowModelPacket({
      scope: syntheticDevelopmentScope(),
      registry,
      componentId: 'metadata_sufficiency',
      assignmentId: 'assignment:metadata_sufficiency:missing',
      createdAt: SHADOW_TEST_TIME,
      executionModel: {
        adapterId: 'development_model_adapter',
        adapterVersion: '1.0.0',
        modelId: 'fixture_frontier_model',
        reasoningLevel: 'high',
      },
      article: shadowTestArticle(),
    })
    const artifact = createShadowRunArtifact({
      runId: 'shadow-run:complete-attempt-inventory',
      repositoryCommit: 'a'.repeat(40),
      createdAt: SHADOW_TEST_TIME,
      scope: syntheticDevelopmentScope(),
      registry,
      autonomyPolicy: shadowLevelOnePolicy(),
      assignments: [
        {
          packetEnvelope: envelope,
          rawResult: { malformed: true },
          routingAssessment: NO_ADDITIONAL_SHADOW_ROUTING_RISK,
        },
        {
          packetEnvelope: secondPacket,
          rawResult: null,
          routingAssessment: NO_ADDITIONAL_SHADOW_ROUTING_RISK,
        },
      ],
      exactInputArtifactSha256s: [envelope.packetSha256, secondPacket.packetSha256],
    })
    expect(artifact.definition.assignmentIds).toEqual([
      'assignment:ip_relevance:fixture',
      'assignment:metadata_sufficiency:missing',
    ])
    expect(artifact.attempts.map((attempt) => attempt.validation.status)).toEqual([
      'rejected_invalid',
      'rejected_missing',
    ])
    expect(artifact.attempts.every((attempt) => attempt.routing.route === 'human_review')).toBe(
      true,
    )
    expect(() => verifyShadowRunArtifact(artifact, syntheticDevelopmentScope())).not.toThrow()
  })

  it('detects event deletion, reordering, content tampering, and added fields', () => {
    const artifact = fixtureArtifact()
    expect(() => verifyShadowRunEventHistory(artifact.events.slice(1))).toThrow(/hash chain/u)
    expect(() => verifyShadowRunEventHistory([...artifact.events].reverse())).toThrow(/hash chain/u)

    const tampered = JSON.parse(JSON.stringify(artifact)) as ShadowRunArtifact
    ;(tampered.attempts[0].rawResult as { rationale: string }).rationale = 'tampered rationale'
    expect(() => verifyShadowRunArtifact(tampered, syntheticDevelopmentScope())).toThrow(
      /does not recompute exactly/u,
    )

    const addedField = JSON.parse(JSON.stringify(artifact)) as ShadowRunArtifact & {
      productionRoute?: string
    }
    addedField.productionRoute = '/api/autonomous'
    expect(() => verifyShadowRunArtifact(addedField, syntheticDevelopmentScope())).toThrow(
      /unexpected or missing fields/u,
    )
  })

  it('reauthenticates rehashed packet membership and exact registry-bound model input', () => {
    const { registry, envelope } = shadowPacket()
    const outsideMembership = JSON.parse(JSON.stringify(envelope)) as ShadowModelPacketEnvelope
    outsideMembership.packet.modelInput.article.pmid = '99999999'
    outsideMembership.packet.articleInputSha256 = sha256ShadowValue(
      outsideMembership.packet.modelInput.article,
    )
    outsideMembership.packet.modelInputSha256 = sha256ShadowValue(
      outsideMembership.packet.modelInput,
    )
    outsideMembership.packetSha256 = sha256ShadowValue(outsideMembership.packet)
    expect(() =>
      createShadowRunArtifact({
        runId: 'shadow-run:outside-membership',
        repositoryCommit: 'a'.repeat(40),
        createdAt: SHADOW_TEST_TIME,
        scope: syntheticDevelopmentScope(),
        registry,
        autonomyPolicy: shadowLevelOnePolicy(),
        assignments: [
          {
            packetEnvelope: outsideMembership,
            rawResult: null,
            routingAssessment: NO_ADDITIONAL_SHADOW_ROUTING_RISK,
          },
        ],
        exactInputArtifactSha256s: [outsideMembership.packetSha256],
      }),
    ).toThrow(/not an exact member/u)

    for (const mutate of [
      (candidate: ShadowModelPacketEnvelope) => {
        candidate.packet.modelInput.instruction += ' Coordinator-injected instruction.'
      },
      (candidate: ShadowModelPacketEnvelope) => {
        candidate.packet.modelInput.outputContract.outputVocabulary = ['exclude', 'uncertain']
      },
    ]) {
      const drifted = JSON.parse(JSON.stringify(envelope)) as ShadowModelPacketEnvelope
      mutate(drifted)
      drifted.packet.modelInputSha256 = sha256ShadowValue(drifted.packet.modelInput)
      drifted.packetSha256 = sha256ShadowValue(drifted.packet)
      expect(() =>
        createShadowRunArtifact({
          runId: 'shadow-run:registry-drift',
          repositoryCommit: 'a'.repeat(40),
          createdAt: SHADOW_TEST_TIME,
          scope: syntheticDevelopmentScope(),
          registry,
          autonomyPolicy: shadowLevelOnePolicy(),
          assignments: [
            {
              packetEnvelope: drifted,
              rawResult: null,
              routingAssessment: NO_ADDITIONAL_SHADOW_ROUTING_RISK,
            },
          ],
          exactInputArtifactSha256s: [drifted.packetSha256],
        }),
      ).toThrow(/exactly bind registry/u)
    }
  })

  it('replays with new provenance while preserving the complete prior artifact', () => {
    const artifact = fixtureArtifact()
    const currentRegistry = artifact.registry
    const current = currentRegistry.components.ip_relevance
    const replacementRegistry = replaceShadowClassifierComponent(currentRegistry, {
      ...current,
      componentVersion: '1.1.0',
      prompt: {
        promptId: current.prompt.promptId,
        promptVersion: '1.1.0',
        instruction: `${current.prompt.instruction} Record boundary uncertainty explicitly.`,
      },
    })
    const replacementPacket = buildShadowModelPacket({
      scope: syntheticDevelopmentScope(),
      registry: replacementRegistry,
      componentId: 'ip_relevance',
      assignmentId: 'assignment:ip_relevance:replay',
      createdAt: SHADOW_TEST_COMPLETED_TIME,
      executionModel: {
        adapterId: 'development_model_adapter',
        adapterVersion: '1.0.0',
        modelId: 'fixture_frontier_model_v2',
        reasoningLevel: 'high',
      },
      article: shadowTestArticle(),
    })
    const replay = replayShadowComponentEvidence({
      artifact,
      scope: syntheticDevelopmentScope(),
      replacementRegistry,
      supersededAttemptSha256: artifact.attempts[0].attemptSha256,
      replacement: {
        packetEnvelope: replacementPacket,
        rawResult: resultForPacket(replacementPacket),
        routingAssessment: NO_ADDITIONAL_SHADOW_ROUTING_RISK,
      },
      recordedAt: '2026-08-11T12:01:00.000Z',
    })
    expect(replay.priorArtifact).toEqual(artifact)
    expect(replay.priorArtifactSha256).toBe(artifact.artifactSha256)
    expect(replay.replacementAttempt.assignmentId).toBe('assignment:ip_relevance:replay')
    expect(replay.events.at(-1)).toMatchObject({
      eventType: 'component_replay_recorded',
      sequence: artifact.events.length + 1,
    })
  })

  it('rolls back to human-only operation without deleting evidence', () => {
    const artifact = fixtureArtifact()
    const rollback = rollBackShadowRunToHumanOnly({
      artifact,
      scope: syntheticDevelopmentScope(),
      recordedAt: '2026-08-11T12:02:00.000Z',
      reason: 'Operator chose reversible human-only mode.',
    })
    expect(rollback.policy.configuredLevel).toBe(0)
    expect(rollback.priorArtifactSha256).toBe(artifact.artifactSha256)
    expect(rollback.priorArtifact).toEqual(artifact)
    expect(rollback.events.at(-1)?.eventType).toBe('autonomy_rolled_back_to_human_only')
  })

  it('rejects duplicate assignment coverage', () => {
    const { registry, envelope } = shadowPacket()
    expect(() =>
      createShadowRunArtifact({
        runId: 'shadow-run:duplicates',
        repositoryCommit: 'a'.repeat(40),
        createdAt: SHADOW_TEST_TIME,
        scope: syntheticDevelopmentScope(),
        registry,
        autonomyPolicy: shadowLevelOnePolicy(),
        assignments: [
          {
            packetEnvelope: envelope,
            rawResult: rawShadowPrediction(),
            routingAssessment: NO_ADDITIONAL_SHADOW_ROUTING_RISK,
          },
          {
            packetEnvelope: envelope,
            rawResult: rawShadowPrediction(),
            routingAssessment: NO_ADDITIONAL_SHADOW_ROUTING_RISK,
          },
        ],
        exactInputArtifactSha256s: [envelope.packetSha256],
      }),
    ).toThrow(/duplicate assignment/u)
  })
})
