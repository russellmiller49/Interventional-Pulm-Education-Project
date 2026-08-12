import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { loadConfiguredShadowComponentRegistry } from '../../src/features/literature/shadow-classifier/configured-registry'
import {
  buildShadowModelPacket,
  createShadowComponentAttemptEnvelope,
  createShadowRunArtifact,
  replayShadowComponentEvidence,
  replaceShadowClassifierComponent,
  sha256ShadowValue,
  verifyShadowRunArtifact,
  verifyShadowRunReplayArtifact,
  type ShadowRunAttempt,
  type ShadowRunArtifact,
  type ShadowRunEvent,
  type ShadowRunReplayArtifact,
} from '../../src/features/literature/shadow-classifier'
import {
  ingestExactShadowDevelopmentWorkerResults,
  prepareExactShadowDevelopmentExperiment,
  verifyExactShadowDevelopmentRunBinding,
  verifyExactShadowDevelopmentRunReconstitution,
  type ShadowDevelopmentWorkerFileEvidence,
} from './shadow-development-experiment-contract'
import {
  SHADOW_DEVELOPMENT_EXPERIMENT_OUTPUT_ROOT,
  SHADOW_DEVELOPMENT_SOURCE_FILE,
  validateShadowDevelopmentExperimentCli,
} from './run-shadow-development-experiment'

const sourceBytes = readFileSync(SHADOW_DEVELOPMENT_SOURCE_FILE)
const createdAt = '2026-08-12T12:00:00.000Z'
type PreparedExperiment = ReturnType<typeof prepareExactShadowDevelopmentExperiment>
let cachedPreparedExperiment: PreparedExperiment | undefined

function prepared(): PreparedExperiment {
  cachedPreparedExperiment ??= prepareExactShadowDevelopmentExperiment({
    sourceBytes,
    registry: loadConfiguredShadowComponentRegistry(),
    createdAt,
    repositoryCommit: 'a'.repeat(40),
    executionModel: {
      adapterId: 'development_model_adapter',
      adapterVersion: '1.0.0',
      modelId: 'gpt-5.6-sol',
      reasoningLevel: 'ultra',
    },
    chunkSize: 30,
  })
  return cachedPreparedExperiment
}

function evidence(modelInputSha256: string, bytes: Buffer): ShadowDevelopmentWorkerFileEvidence {
  return {
    modelInputSha256,
    rawBase64: bytes.toString('base64'),
    rawBytesSha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

function validWorkerBytes(
  record: ReturnType<typeof prepared>['artifact']['packets'][number],
  executionId: string,
): Buffer {
  const title = record.packetEnvelope.packet.modelInput.article.title
  return Buffer.from(
    JSON.stringify({
      schemaVersion: 'literature-shadow-development-worker-result/1.0.0',
      modelInputSha256: record.packetEnvelope.packet.modelInputSha256,
      startedAt: '2026-08-12T12:00:01.000Z',
      completedAt: '2026-08-12T12:00:02.000Z',
      execution: {
        adapterId: 'development_model_adapter',
        adapterVersion: '1.0.0',
        modelId: 'gpt-5.6-sol',
        reasoningLevel: 'ultra',
        agentId: 'frontier-agent-1',
        executionId,
        attestation: 'operator_attested_not_cryptographically_verified',
      },
      response: {
        schemaVersion: 'literature-shadow-model-response/1.0.0',
        state: 'prediction',
        outputValues: ['include_core'],
        evidenceUsed: [{ field: 'title', text: title.slice(0, Math.min(40, title.length)) }],
        rationale: 'The supplied title describes an interventional-pulmonology subject.',
        selfReportedConfidence: 0.8,
        probabilities: null,
        abstentionReasons: [],
        refusalCode: null,
      },
    }),
  )
}

function forgeFullyChecksummedReceiptlessRun(
  run: ShadowRunArtifact,
  assignmentId: string,
): ShadowRunArtifact {
  const forged = JSON.parse(JSON.stringify(run)) as ShadowRunArtifact
  const attempts = forged.attempts as ShadowRunAttempt[]
  const target = attempts.find((attempt) => attempt.assignmentId === assignmentId)!
  target.executionReceipt = null
  target.executionReceiptSha256 = null
  const attemptWithoutHash = { ...target } as Partial<ShadowRunAttempt>
  delete attemptWithoutHash.attemptSha256
  target.attemptSha256 = sha256ShadowValue(attemptWithoutHash)

  let priorHash = '0'.repeat(64)
  let sequence = 0
  const events: ShadowRunEvent[] = []
  const addEvent = (
    eventType: ShadowRunEvent['eventType'],
    recordedAt: string,
    payload: ShadowRunEvent['payload'],
  ): void => {
    sequence += 1
    const withoutEventHash = {
      schemaVersion: 'literature-shadow-run-event/1.0.0' as const,
      sequence,
      eventType,
      recordedAt,
      previousEventHash: priorHash,
      payload,
      payloadSha256: sha256ShadowValue(payload),
    }
    const event = {
      ...withoutEventHash,
      eventHash: sha256ShadowValue(withoutEventHash),
    }
    events.push(event)
    priorHash = event.eventHash
  }
  addEvent('run_created', forged.definition.createdAt, {
    runId: forged.runId,
    definitionSha256: sha256ShadowValue(forged.definition),
  })
  for (const [index, attempt] of attempts.entries()) {
    const recordedAt = new Date(Date.parse(forged.definition.createdAt) + index + 1).toISOString()
    addEvent('assignment_created', recordedAt, {
      assignmentId: attempt.assignmentId,
      packetSha256: attempt.packetEnvelope.packetSha256,
      rawResultSha256: attempt.rawResultSha256,
      executionReceiptSha256: attempt.executionReceiptSha256,
      attemptSha256: attempt.attemptSha256,
    })
    addEvent('component_result_recorded', recordedAt, {
      assignmentId: attempt.assignmentId,
      validationStatus: attempt.validation.status,
      validationSha256: attempt.validationSha256,
      resultSha256: attempt.validation.valid ? attempt.validation.result.resultSha256 : null,
    })
    addEvent('routing_recorded', recordedAt, {
      assignmentId: attempt.assignmentId,
      routingSha256: attempt.routingSha256,
    })
  }
  ;(forged as unknown as { events: ShadowRunEvent[] }).events = events
  const manifest = Object.fromEntries(
    [
      ['definition.json', sha256ShadowValue(forged.definition)],
      ['scope.json', sha256ShadowValue(forged.scope)],
      ['registry.json', sha256ShadowValue(forged.registry)],
      ...attempts.map((attempt) => [
        `attempts/${attempt.assignmentId}.json`,
        attempt.attemptSha256,
      ]),
      ['article-routing.json', sha256ShadowValue(forged.articleRouting)],
      ['events.json', sha256ShadowValue(events)],
    ].sort(([left], [right]) => left.localeCompare(right)),
  )
  ;(forged as { checksumManifest: Record<string, string> }).checksumManifest = manifest
  ;(forged as { checksumManifestSha256: string }).checksumManifestSha256 =
    sha256ShadowValue(manifest)
  const artifactWithoutHash = { ...forged } as Partial<ShadowRunArtifact>
  delete artifactWithoutHash.artifactSha256
  ;(forged as { artifactSha256: string }).artifactSha256 = sha256ShadowValue(artifactWithoutHash)
  return forged
}

describe('exact file-only shadow development experiment', () => {
  it('prepares exactly 21 hash-ordered modelInput-only chunks with truth excluded', () => {
    const result = prepared()
    expect(result.artifact).toMatchObject({ cohortSize: 630, chunkCount: 21, chunkSize: 30 })
    expect(result.modelFacingFiles).toHaveLength(630)
    const serialized = result.modelFacingFiles
      .map((file) => JSON.stringify(file.content))
      .join('\n')
    expect(serialized).not.toMatch(
      /physician_final|gold_label|coordinator_only|first_pass_label|second_pass_label|truth_label/iu,
    )
    expect(new Set(result.modelFacingFiles.map((file) => file.path)).size).toBe(630)
    expect(result.modelFacingFiles.every((file) => file.path.endsWith(`${file.sha256}.json`))).toBe(
      true,
    )
  })

  it('retains invalid UTF-8 and invalid chronology as rejected-invalid attempts', () => {
    const result = prepared()
    const first = result.artifact.packets[0]!
    const second = result.artifact.packets[1]!
    const chronology = Buffer.from(
      JSON.stringify({
        schemaVersion: 'literature-shadow-development-worker-result/1.0.0',
        modelInputSha256: second.packetEnvelope.packet.modelInputSha256,
        startedAt: '2026-08-12T12:01:00.000Z',
        completedAt: '2026-08-12T11:59:00.000Z',
        execution: {
          adapterId: 'development_model_adapter',
          adapterVersion: '1.0.0',
          modelId: 'gpt-5.6-sol',
          reasoningLevel: 'ultra',
          agentId: 'agent-1',
          executionId: 'execution-1',
          attestation: 'operator_attested_not_cryptographically_verified',
        },
        response: {},
      }),
    )
    const { run } = ingestExactShadowDevelopmentWorkerResults({
      sourceBytes,
      prepared: result.artifact,
      registry: loadConfiguredShadowComponentRegistry(),
      workerFiles: [
        evidence(first.packetEnvelope.packet.modelInputSha256, Buffer.from([0xff])),
        evidence(second.packetEnvelope.packet.modelInputSha256, chronology),
      ],
      repositoryCommit: 'a'.repeat(40),
      runId: 'shadow-run:invalid-file-test',
      createdAt: '2026-08-12T12:02:00.000Z',
    })
    expect(run.attempts).toHaveLength(630)
    expect(run.attempts[0]!.validation.status).toBe('rejected_invalid')
    expect(run.attempts[1]!.validation.status).toBe('rejected_invalid')
    expect(
      run.attempts.filter((attempt) => attempt.validation.status === 'rejected_missing'),
    ).toHaveLength(628)
    expect(JSON.stringify(run.attempts[0]!.rawResult)).toContain(
      createHash('sha256')
        .update(Buffer.from([0xff]))
        .digest('hex'),
    )
  })

  it('has no caller-controlled source/split/PMID surface', () => {
    expect(SHADOW_DEVELOPMENT_SOURCE_FILE).toMatch(/enrichment-source-v2\.csv$/u)
    expect(SHADOW_DEVELOPMENT_EXPERIMENT_OUTPUT_ROOT).toBe(
      'local-data/literature/shadow-development-experiments',
    )
    for (const argv of [
      ['prepare', '--source-file', '/tmp/dev.csv'],
      ['prepare', '--pmid', '123'],
      ['ingest', '--split', 'all'],
      ['ingest', '--prepared-directory', '/tmp/heldout'],
    ]) {
      expect(() => validateShadowDevelopmentExperimentCli(argv)).toThrow()
    }
    const runner = readFileSync(
      resolve(process.cwd(), 'scripts/literature/run-shadow-development-experiment.ts'),
      'utf8',
    )
    expect(runner).not.toContain("'source-file'")
    expect(runner).not.toContain('@supabase/')
    expect(runner).not.toMatch(/fetch\s*\(/u)
  })

  it('retains and verifies exact valid worker execution receipts and invalid-accounts duplicates', () => {
    const result = prepared()
    const first = result.artifact.packets[0]!
    const second = result.artifact.packets[1]!
    const firstBytes = validWorkerBytes(first, 'execution-receipt-1')
    const secondBytes = validWorkerBytes(second, 'execution-receipt-1')
    const ingested = ingestExactShadowDevelopmentWorkerResults({
      sourceBytes,
      prepared: result.artifact,
      registry: loadConfiguredShadowComponentRegistry(),
      workerFiles: [
        evidence(first.packetEnvelope.packet.modelInputSha256, firstBytes),
        evidence(second.packetEnvelope.packet.modelInputSha256, secondBytes),
      ],
      repositoryCommit: 'a'.repeat(40),
      runId: 'shadow-run:receipt-test',
      createdAt: '2026-08-12T12:00:03.000Z',
    })
    const receiptAttempt = ingested.run.attempts.find(
      (attempt) =>
        attempt.packetEnvelope.packet.modelInputSha256 ===
        first.packetEnvelope.packet.modelInputSha256,
    )!
    const duplicateAttempt = ingested.run.attempts.find(
      (attempt) =>
        attempt.packetEnvelope.packet.modelInputSha256 ===
        second.packetEnvelope.packet.modelInputSha256,
    )!
    const receipt = receiptAttempt.executionReceipt
    expect(receipt).toEqual({
      adapterId: 'development_model_adapter',
      adapterVersion: '1.0.0',
      modelId: 'gpt-5.6-sol',
      reasoningLevel: 'ultra',
      agentId: 'frontier-agent-1',
      executionId: 'execution-receipt-1',
      attestation: 'operator_attested_not_cryptographically_verified',
      modelInputSha256: first.packetEnvelope.packet.modelInputSha256,
      startedAt: '2026-08-12T12:00:01.000Z',
      completedAt: '2026-08-12T12:00:02.000Z',
      workerFileSha256: createHash('sha256').update(firstBytes).digest('hex'),
    })
    const receiptEvent = ingested.run.events.find(
      (event) =>
        event.eventType === 'assignment_created' &&
        'assignmentId' in event.payload &&
        event.payload.assignmentId === receiptAttempt.assignmentId,
    )!
    expect(receiptEvent.payload).toMatchObject({
      executionReceiptSha256: receiptAttempt.executionReceiptSha256,
    })
    expect(duplicateAttempt.validation.status).toBe('rejected_invalid')
    expect(() => verifyShadowRunArtifact(ingested.run, ingested.scope)).not.toThrow()
    const tampered = JSON.parse(JSON.stringify(ingested.run)) as ShadowRunArtifact
    const tamperedAttempt = tampered.attempts.find(
      (attempt) =>
        attempt.packetEnvelope.packet.modelInputSha256 ===
        first.packetEnvelope.packet.modelInputSha256,
    )!
    ;(tamperedAttempt.executionReceipt as { agentId: string }).agentId = 'tampered-agent'
    expect(() => verifyShadowRunArtifact(tampered, ingested.scope)).toThrow()

    expect(() =>
      createShadowRunArtifact({
        runId: 'shadow-run:receiptless-constructor',
        repositoryCommit: 'a'.repeat(40),
        createdAt: '2026-08-12T12:00:03.000Z',
        scope: ingested.scope,
        registry: ingested.run.registry,
        autonomyPolicy: ingested.run.autonomyPolicy,
        assignments: [
          {
            packetEnvelope: receiptAttempt.packetEnvelope,
            rawResult: receiptAttempt.rawResult,
            executionReceipt: null,
            routingAssessment: receiptAttempt.routingAssessment,
          },
        ],
        exactInputArtifactSha256s: [receiptAttempt.packetEnvelope.packetSha256],
      }),
    ).toThrow(/requires an exact worker execution receipt/u)
    const forgedReceiptless = forgeFullyChecksummedReceiptlessRun(
      ingested.run,
      receiptAttempt.assignmentId,
    )
    expect(() => verifyShadowRunArtifact(forgedReceiptless, ingested.scope)).toThrow(
      /requires an exact worker execution receipt/u,
    )

    expect(() =>
      verifyExactShadowDevelopmentRunBinding({
        prepared: result.artifact,
        run: ingested.run,
        scope: ingested.scope,
      }),
    ).not.toThrow()
    const otherPreparation = prepareExactShadowDevelopmentExperiment({
      sourceBytes,
      registry: loadConfiguredShadowComponentRegistry(),
      createdAt,
      repositoryCommit: 'a'.repeat(40),
      executionModel: {
        adapterId: 'development_model_adapter',
        adapterVersion: '1.0.0',
        modelId: 'different-frontier-model',
        reasoningLevel: 'ultra',
      },
      chunkSize: 30,
    })
    expect(() =>
      verifyExactShadowDevelopmentRunBinding({
        prepared: otherPreparation.artifact,
        run: ingested.run,
        scope: otherPreparation.scope,
      }),
    ).toThrow(/packet and model-input set/u)

    const withoutResponseFiles = ingestExactShadowDevelopmentWorkerResults({
      sourceBytes,
      prepared: result.artifact,
      registry: loadConfiguredShadowComponentRegistry(),
      workerFiles: [],
      repositoryCommit: 'a'.repeat(40),
      runId: ingested.run.runId,
      createdAt: ingested.run.definition.createdAt,
    })
    expect(() =>
      verifyExactShadowDevelopmentRunReconstitution({
        persistedRun: ingested.run,
        reconstitutedRun: withoutResponseFiles.run,
      }),
    ).toThrow(/does not exactly reconstitute/u)

    if (!receiptAttempt.validation.valid) throw new Error('Expected fixture result to be valid.')
    const currentComponent = ingested.run.registry.components.ip_relevance
    const replacementRegistry = replaceShadowClassifierComponent(ingested.run.registry, {
      ...currentComponent,
      componentVersion: '1.1.0',
      prompt: {
        promptId: currentComponent.prompt.promptId,
        promptVersion: '1.1.0',
        instruction: `${currentComponent.prompt.instruction} Replayed for receipt-bound verification.`,
      },
    })
    const replacementPacket = buildShadowModelPacket({
      scope: ingested.scope,
      registry: replacementRegistry,
      componentId: 'ip_relevance',
      assignmentId: 'ip-relevance-replay-receipt-test',
      createdAt: '2026-08-12T12:00:03.100Z',
      executionModel: result.artifact.executionModel,
      article: receiptAttempt.packetEnvelope.packet.modelInput.article,
    })
    const replacementResult = createShadowComponentAttemptEnvelope({
      packetEnvelope: replacementPacket,
      startedAt: '2026-08-12T12:00:04.000Z',
      completedAt: '2026-08-12T12:00:05.000Z',
      modelResponse: receiptAttempt.validation.result.response,
    })
    const replacement = {
      packetEnvelope: replacementPacket,
      rawResult: replacementResult,
      routingAssessment: receiptAttempt.routingAssessment,
    }
    expect(() =>
      replayShadowComponentEvidence({
        artifact: ingested.run,
        scope: ingested.scope,
        replacementRegistry,
        supersededAttemptSha256: receiptAttempt.attemptSha256,
        replacement,
        recordedAt: '2026-08-12T12:00:06.000Z',
      }),
    ).toThrow(/requires an exact worker execution receipt/u)
    expect(() =>
      replayShadowComponentEvidence({
        artifact: ingested.run,
        scope: ingested.scope,
        replacementRegistry,
        supersededAttemptSha256: receiptAttempt.attemptSha256,
        replacement: {
          ...replacement,
          executionReceipt: {
            ...receipt!,
            modelInputSha256: replacementPacket.packet.modelInputSha256,
            startedAt: '2026-08-12T12:00:04.000Z',
            completedAt: '2026-08-12T12:00:05.000Z',
            workerFileSha256: 'b'.repeat(64),
          },
        },
        recordedAt: '2026-08-12T12:00:06.000Z',
      }),
    ).toThrow(/duplicate execution receipt IDs/u)
    expect(() =>
      replayShadowComponentEvidence({
        artifact: ingested.run,
        scope: ingested.scope,
        replacementRegistry,
        supersededAttemptSha256: receiptAttempt.attemptSha256,
        replacement: {
          ...replacement,
          executionReceipt: {
            ...receipt!,
            executionId: 'execution-receipt-replay-future',
            modelInputSha256: replacementPacket.packet.modelInputSha256,
            startedAt: '2026-08-12T12:00:04.000Z',
            completedAt: '2026-08-12T12:00:07.000Z',
            workerFileSha256: 'c'.repeat(64),
          },
        },
        recordedAt: '2026-08-12T12:00:06.000Z',
      }),
    ).toThrow(/cannot precede a completed model attempt/u)

    const validReplay = replayShadowComponentEvidence({
      artifact: ingested.run,
      scope: ingested.scope,
      replacementRegistry,
      supersededAttemptSha256: receiptAttempt.attemptSha256,
      replacement: {
        ...replacement,
        executionReceipt: {
          ...receipt!,
          executionId: 'execution-receipt-replay-valid',
          modelInputSha256: replacementPacket.packet.modelInputSha256,
          startedAt: '2026-08-12T12:00:04.000Z',
          completedAt: '2026-08-12T12:00:05.000Z',
          workerFileSha256: 'd'.repeat(64),
        },
      },
      recordedAt: '2026-08-12T12:00:06.000Z',
    })
    expect(() =>
      verifyShadowRunReplayArtifact({
        replay: validReplay,
        scope: ingested.scope,
        replacementRegistry,
      }),
    ).not.toThrow()
    const forgedReplay = JSON.parse(JSON.stringify(validReplay)) as ShadowRunReplayArtifact
    const forgedReplacement = forgedReplay.replacementAttempt as ShadowRunAttempt
    forgedReplacement.executionReceipt = null
    forgedReplacement.executionReceiptSha256 = null
    const forgedReplacementWithoutHash = { ...forgedReplacement } as Partial<ShadowRunAttempt>
    delete forgedReplacementWithoutHash.attemptSha256
    forgedReplacement.attemptSha256 = sha256ShadowValue(forgedReplacementWithoutHash)
    const forgedReplayEvent = forgedReplay.events.at(-1) as ShadowRunEvent
    forgedReplayEvent.payload = {
      ...(forgedReplayEvent.payload as {
        supersededAttemptSha256: string
        replacementAttemptSha256: string
        priorArtifactSha256: string
      }),
      replacementAttemptSha256: forgedReplacement.attemptSha256,
    }
    forgedReplayEvent.payloadSha256 = sha256ShadowValue(forgedReplayEvent.payload)
    const forgedReplayEventWithoutHash = { ...forgedReplayEvent } as Partial<ShadowRunEvent>
    delete forgedReplayEventWithoutHash.eventHash
    forgedReplayEvent.eventHash = sha256ShadowValue(forgedReplayEventWithoutHash)
    const forgedReplayWithoutHash = { ...forgedReplay } as Partial<ShadowRunReplayArtifact>
    delete forgedReplayWithoutHash.artifactSha256
    forgedReplay.artifactSha256 = sha256ShadowValue(forgedReplayWithoutHash)
    expect(() =>
      verifyShadowRunReplayArtifact({
        replay: forgedReplay,
        scope: ingested.scope,
        replacementRegistry,
      }),
    ).toThrow(/requires an exact worker execution receipt/u)
  })

  it('rejects even a missing-only run recorded before packet creation', () => {
    const result = prepared()
    expect(() =>
      ingestExactShadowDevelopmentWorkerResults({
        sourceBytes,
        prepared: result.artifact,
        registry: loadConfiguredShadowComponentRegistry(),
        workerFiles: [],
        repositoryCommit: 'a'.repeat(40),
        runId: 'shadow-run:backdated',
        createdAt: '2026-08-12T11:59:59.000Z',
      }),
    ).toThrow(/cannot precede prepared packet/u)
  })
})
