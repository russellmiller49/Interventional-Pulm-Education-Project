import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

import {
  prepareFutureUltraAttempt,
  projectUltraAttemptRuntimeState,
  recordFutureUltraAttemptTerminal,
  runUltraAttemptRuntimeCli,
  validateOperationalUltraRunDefinition,
  type OperationalUltraRunDefinition,
  type PrepareFutureAttemptOptions,
} from '../../../../scripts/literature/ultra-attempt-runtime'
import {
  appendUltraStorageEvent,
  initializeUltraStorageV2,
  readUltraEventLog,
} from '../../../../scripts/literature/ultra-storage-v2'
import {
  validateUltraWorkerOutput,
  type UltraScreeningArticle,
  type UltraScreeningResult,
} from '../ultra-screening/core'

const execFileAsync = promisify(execFile)
const PREPARED_AT = '2026-08-03T04:00:00.000Z'
const STARTED_AT = '2026-08-03T04:01:00.000Z'
const COMPLETED_AT = '2026-08-03T04:02:00.000Z'

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

function article(pmid: string): UltraScreeningArticle {
  return {
    pmid,
    title: `Bronchoscopy study ${pmid}`,
    abstract: 'Bronchoscopy was the central procedure.',
    mesh: ['Bronchoscopy'],
    author_keyword: [],
    publication_type: ['Journal Article'],
    journal: 'Test Journal',
    year: 2026,
    language: ['eng'],
  }
}

function validResult(pmid: string): UltraScreeningResult {
  return {
    pmid,
    relevanceLabel: 'include_core',
    decisionConfidence: 'high',
    requiresHumanReview: false,
    reasonCodes: ['core_procedure_central'],
    evidence: [{ field: 'title', text: `Bronchoscopy study ${pmid}` }],
    conciseRationale: 'Bronchoscopy is the central procedure.',
  }
}

async function writeValidationArtifacts(options: {
  packetPath: string
  outputPath: string
  validationPath: string
  output: string
}) {
  await writeFile(options.outputPath, options.output)
  const packet = JSON.parse(await readFile(options.packetPath, 'utf8')) as unknown[]
  const report = validateUltraWorkerOutput(options.output, packet)
  await mkdir(resolve(options.validationPath, '..'), { recursive: true })
  await writeFile(options.validationPath, `${JSON.stringify(report, null, 2)}\n`)
  return report
}

describe('future Ultra attempt runtime bridge', () => {
  let root: string
  let repositoryRoot: string
  let runRoot: string
  let policyPath: string
  let templatePath: string
  let bootstrapPath: string
  let packetPath: string
  let secondPacketPath: string
  let failedPacketPath: string
  let legacyRetryPacketPath: string
  let outputPath: string
  let repositoryCommit: string
  let trackedSentinelPath: string
  let definition: OperationalUltraRunDefinition
  let startOptions: PrepareFutureAttemptOptions

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ip-ultra-attempt-runtime-'))
    repositoryRoot = join(root, 'repository')
    runRoot = join(root, 'run')
    policyPath = join(repositoryRoot, 'policy.md')
    templatePath = join(repositoryRoot, 'worker-template.md')
    bootstrapPath = join(repositoryRoot, 'bootstrap.md')
    packetPath = join(runRoot, 'packets', 'corpus-a-00001.json')
    secondPacketPath = join(runRoot, 'packets', 'corpus-a-00002.json')
    failedPacketPath = join(runRoot, 'packets', 'corpus-a-00003.json')
    legacyRetryPacketPath = join(runRoot, 'packets', 'corpus-a-00004.json')
    outputPath = join(runRoot, 'worker-outputs', 'corpus-a', 'corpus-a-00001.attempt-1.jsonl')
    trackedSentinelPath = join(repositoryRoot, 'tracked.txt')
    await mkdir(repositoryRoot, { recursive: true })
    await mkdir(resolve(runRoot, 'packets'), { recursive: true })
    await mkdir(resolve(outputPath, '..'), { recursive: true })
    await writeFile(policyPath, 'Classify only the supplied packet under policy v2.\n')
    await writeFile(
      templatePath,
      [
        '# Assignment {{ASSIGNMENT_ID}} / {{ASSIGNMENT_ORDINAL}}',
        'Chunk {{CHUNK_ID}}, attempt {{ATTEMPT_NUMBER}}',
        'Read {{PACKET_PATH}} ({{PACKET_SHA256}}).',
        'Write {{OUTPUT_PATH}}.',
        'Policy {{SCREENING_POLICY_VERSION}} / {{SCREENING_POLICY_SHA256}}:',
        '{{SCREENING_POLICY_TEXT}}',
        '',
      ].join('\n'),
    )
    await writeFile(bootstrapPath, 'Process one isolated packet at a time.\n')
    await writeFile(trackedSentinelPath, 'tracked clean state\n')
    await execFileAsync('git', ['init', '--quiet'], { cwd: repositoryRoot })
    await execFileAsync('git', ['config', 'user.email', 'test@example.invalid'], {
      cwd: repositoryRoot,
    })
    await execFileAsync('git', ['config', 'user.name', 'Ultra Runtime Test'], {
      cwd: repositoryRoot,
    })
    await execFileAsync('git', ['add', 'tracked.txt'], { cwd: repositoryRoot })
    await execFileAsync('git', ['commit', '--quiet', '-m', 'test repository state'], {
      cwd: repositoryRoot,
    })
    repositoryCommit = (
      await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot })
    ).stdout.trim()
    await writeFile(packetPath, `${JSON.stringify([article('1')])}\n`)
    await writeFile(secondPacketPath, `${JSON.stringify([article('2')])}\n`)
    await writeFile(failedPacketPath, `${JSON.stringify([article('3')])}\n`)
    await writeFile(legacyRetryPacketPath, `${JSON.stringify([article('4')])}\n`)

    definition = {
      runId: 'ip-literature-ultra-v2-test',
      createdAt: PREPARED_AT,
      corpusSnapshot: { articleCount: 3, sha256: 'b'.repeat(64) },
      phaseConfiguration: [{ phaseId: 'corpus-a', chunkSize: 25 }],
      packetInventory: [
        {
          chunkId: 'corpus-a-00001',
          phaseId: 'corpus-a',
          packetPath,
          packetSha256: sha256(await readFile(packetPath)),
        },
        {
          chunkId: 'corpus-a-00002',
          phaseId: 'corpus-a',
          packetPath: secondPacketPath,
          packetSha256: sha256(await readFile(secondPacketPath)),
          initialStatus: 'completed',
        },
        {
          chunkId: 'corpus-a-00003',
          phaseId: 'corpus-a',
          packetPath: failedPacketPath,
          packetSha256: sha256(await readFile(failedPacketPath)),
        },
        {
          chunkId: 'corpus-a-00004',
          phaseId: 'corpus-a',
          packetPath: legacyRetryPacketPath,
          packetSha256: sha256(await readFile(legacyRetryPacketPath)),
          legacyAttemptCount: 1,
        },
      ],
      screeningPolicyVersion: 'policy-v2',
      maxRetries: 2,
      repositoryCommit,
      screeningPolicy: {
        version: 'policy-v2',
        path: policyPath,
        sha256: sha256(await readFile(policyPath)),
      },
      workerPromptTemplate: {
        version: 'worker-template-v2',
        path: templatePath,
        sha256: sha256(await readFile(templatePath)),
      },
      workerBootstrapPrompt: {
        version: 'worker-bootstrap-v2',
        path: bootstrapPath,
        sha256: sha256(await readFile(bootstrapPath)),
      },
      workerOutputRoot: join(runRoot, 'worker-outputs'),
      dispatchAuthorization: {
        version: 'dispatch-authorization-v1',
        id: 'synthetic-test-authorization',
        authorizedBy: 'test-coordinator',
        authorizedAt: '2026-08-03T03:59:00.000Z',
        enabled: true,
      },
    }
    await initializeUltraStorageV2({ runRoot, runDefinition: definition })
    startOptions = {
      runRoot,
      repositoryRoot,
      ownerId: 'coordinator-01',
      chunkId: 'corpus-a-00001',
      attemptNumber: 1,
      workerId: 'worker-01',
      workerSessionId: 'session-01',
      assignmentId: 'assignment-01',
      assignmentOrdinal: 1,
      actualModel: 'gpt-5.6-terra',
      reasoningLevel: 'ultra',
      outputPath,
      reusableWorker: true,
      preparedAt: PREPARED_AT,
      startedAt: STARTED_AT,
    }
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('requires an explicit enabled dispatch authorization in the immutable definition', () => {
    const withoutAuthorization = { ...definition }
    Reflect.deleteProperty(withoutAuthorization, 'dispatchAuthorization')
    expect(() => validateOperationalUltraRunDefinition(withoutAuthorization)).toThrow(
      expect.objectContaining({ code: 'dispatch_not_authorized' }),
    )
    expect(() =>
      validateOperationalUltraRunDefinition({
        ...definition,
        dispatchAuthorization: { ...definition.dispatchAuthorization, enabled: false },
      }),
    ).toThrow(expect.objectContaining({ code: 'dispatch_not_authorized' }))

    const migratedDisabled = {
      ...definition,
      dispatchAuthorization: { enabled: false },
    }
    Reflect.deleteProperty(migratedDisabled, 'repositoryCommit')
    Reflect.deleteProperty(migratedDisabled, 'screeningPolicy')
    Reflect.deleteProperty(migratedDisabled, 'workerPromptTemplate')
    expect(() => validateOperationalUltraRunDefinition(migratedDisabled)).toThrow(
      expect.objectContaining({ code: 'dispatch_not_authorized' }),
    )
  })

  it('requires sequential attempts and enforces the immutable retry ceiling', async () => {
    await expect(
      prepareFutureUltraAttempt({ ...startOptions, attemptNumber: 99 }),
    ).rejects.toMatchObject({ code: 'attempt_number_out_of_sequence' })

    for (const attemptNumber of [1, 2, 3]) {
      const attemptOutputPath = join(
        runRoot,
        'worker-outputs',
        'corpus-a',
        `corpus-a-00001.attempt-${attemptNumber}.jsonl`,
      )
      await prepareFutureUltraAttempt({
        ...startOptions,
        attemptNumber,
        assignmentOrdinal: attemptNumber,
        outputPath: attemptOutputPath,
        preparedAt: `2026-08-03T04:${String(attemptNumber * 3).padStart(2, '0')}:00.000Z`,
        startedAt: `2026-08-03T04:${String(attemptNumber * 3 + 1).padStart(2, '0')}:00.000Z`,
      })
      const validationPath = join(
        runRoot,
        'validation',
        'corpus-a',
        `corpus-a-00001.attempt-${attemptNumber}.json`,
      )
      const report = await writeValidationArtifacts({
        packetPath,
        outputPath: attemptOutputPath,
        validationPath,
        output: '{"invalid":true}\n',
      })
      await recordFutureUltraAttemptTerminal({
        runRoot,
        ownerId: 'coordinator-01',
        chunkId: 'corpus-a-00001',
        attemptNumber,
        status: 'invalid',
        validationReportPath: validationPath,
        validationErrors: report.errors.map((error) => error.message),
        completedAt: `2026-08-03T04:${String(attemptNumber * 3 + 2).padStart(2, '0')}:00.000Z`,
      })
    }

    await expect(
      prepareFutureUltraAttempt({
        ...startOptions,
        attemptNumber: 4,
        outputPath: join(runRoot, 'worker-outputs', 'corpus-a', 'corpus-a-00001.attempt-4.jsonl'),
      }),
    ).rejects.toMatchObject({ code: 'retry_limit_exceeded' })
  })

  it('continues attempt numbering after an immutable legacy attempt count', async () => {
    const legacyOptions = {
      ...startOptions,
      chunkId: 'corpus-a-00004',
      packetPath: legacyRetryPacketPath,
      outputPath: join(runRoot, 'worker-outputs', 'corpus-a', 'corpus-a-00004.attempt-2.jsonl'),
    }
    await expect(
      prepareFutureUltraAttempt({ ...legacyOptions, attemptNumber: 1 }),
    ).rejects.toMatchObject({ code: 'attempt_number_out_of_sequence' })
    await expect(
      prepareFutureUltraAttempt({ ...legacyOptions, attemptNumber: 2 }),
    ).resolves.toMatchObject({ payload: { attemptNumber: 2 } })
  })

  it('refuses output paths outside the deterministic run/phase/attempt location', async () => {
    await expect(
      prepareFutureUltraAttempt({
        ...startOptions,
        outputPath: join(root, 'outside-output.jsonl'),
      }),
    ).rejects.toMatchObject({ code: 'artifact_path_mismatch' })
    expect(await readUltraEventLog(runRoot)).toEqual([])
  })

  it('refuses a deterministic output path whose parent escapes through a symlink', async () => {
    const workerOutputRoot = join(runRoot, 'worker-outputs')
    const outsideRoot = join(root, 'outside-worker-outputs')
    await rm(workerOutputRoot, { recursive: true })
    await mkdir(outsideRoot, { recursive: true })
    await symlink(outsideRoot, workerOutputRoot, 'dir')

    await expect(prepareFutureUltraAttempt(startOptions)).rejects.toThrow(/symbolic link/u)
    expect(await readUltraEventLog(runRoot)).toEqual([])
  })

  it('publishes and verifies the immutable prompt before recording complete start provenance', async () => {
    const result = await prepareFutureUltraAttempt(startOptions)
    const events = await readUltraEventLog(runRoot)
    const promptBytes = await readFile(result.payload.provenance.renderedPromptPath)

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'attempt_started', recordedAt: STARTED_AT })
    expect(result.payload).toMatchObject({
      attemptRuntimeVersion: '2.0.0',
      attemptId: 'corpus-a-00001.attempt-1',
      status: 'running',
      startedAt: STARTED_AT,
      provenance: {
        repositoryCommit,
        workingTreeClean: true,
        screeningPolicyVersion: 'policy-v2',
        workerPromptTemplateVersion: 'worker-template-v2',
        workerBootstrapPromptSha256: definition.workerBootstrapPrompt?.sha256,
        workerSessionId: 'session-01',
        assignmentId: 'assignment-01',
        assignmentOrdinal: 1,
        actualModel: 'gpt-5.6-terra',
        reasoningLevel: 'ultra',
        packetSha256: definition.packetInventory[0].packetSha256,
        outputPath,
        startedAt: STARTED_AT,
      },
    })
    expect(sha256(promptBytes)).toBe(result.payload.provenance.renderedPromptSha256)
    expect(result.renderedPrompt).toContain('Chunk corpus-a-00001, attempt 1')
  })

  it('refuses an invalid start timestamp before appending an attempt event', async () => {
    await expect(
      prepareFutureUltraAttempt({ ...startOptions, startedAt: 'not-a-timestamp' }),
    ).rejects.toMatchObject({ code: 'invalid_attempt_timestamp' })
    expect(await readUltraEventLog(runRoot)).toEqual([])
  })

  it('records no start event for dirty repositories, checksum mismatches, or existing output', async () => {
    await writeFile(trackedSentinelPath, 'dirty tracked state\n')
    await expect(prepareFutureUltraAttempt(startOptions)).rejects.toThrow(/dirty tracked worktree/u)
    await writeFile(trackedSentinelPath, 'tracked clean state\n')
    expect(await readUltraEventLog(runRoot)).toEqual([])

    await writeFile(policyPath, 'tampered policy\n')
    await expect(prepareFutureUltraAttempt(startOptions)).rejects.toThrow(
      /Screening policy checksum mismatch/u,
    )
    await writeFile(policyPath, 'Classify only the supplied packet under policy v2.\n')

    await writeFile(templatePath, 'tampered template\n')
    await expect(prepareFutureUltraAttempt(startOptions)).rejects.toThrow(
      /Worker prompt template checksum mismatch/u,
    )
    await writeFile(
      templatePath,
      [
        '# Assignment {{ASSIGNMENT_ID}} / {{ASSIGNMENT_ORDINAL}}',
        'Chunk {{CHUNK_ID}}, attempt {{ATTEMPT_NUMBER}}',
        'Read {{PACKET_PATH}} ({{PACKET_SHA256}}).',
        'Write {{OUTPUT_PATH}}.',
        'Policy {{SCREENING_POLICY_VERSION}} / {{SCREENING_POLICY_SHA256}}:',
        '{{SCREENING_POLICY_TEXT}}',
        '',
      ].join('\n'),
    )

    await writeFile(packetPath, 'tampered packet\n')
    await expect(prepareFutureUltraAttempt(startOptions)).rejects.toThrow(
      /Packet checksum mismatch/u,
    )
    await writeFile(packetPath, `${JSON.stringify([article('1')])}\n`)

    await writeFile(outputPath, 'preexisting\n')
    await expect(prepareFutureUltraAttempt(startOptions)).rejects.toThrow(
      /Future attempt output already exists/u,
    )
    expect(await readUltraEventLog(runRoot)).toEqual([])
  })

  it('does not append when an existing rendered prompt differs from the exact rendering', async () => {
    const renderedPromptPath = join(
      runRoot,
      'state-v2',
      'rendered-prompts',
      'assignment-01',
      'corpus-a-00001.attempt-1.md',
    )
    await mkdir(resolve(renderedPromptPath, '..'), { recursive: true })
    await writeFile(renderedPromptPath, 'tampered prompt\n')

    await expect(
      prepareFutureUltraAttempt({ ...startOptions, renderedPromptPath }),
    ).rejects.toThrow(/Refusing to overwrite nonmatching rendered prompt/u)
    expect(await readUltraEventLog(runRoot)).toEqual([])
  })

  it('refuses duplicate, concurrently running, terminal, and completed chunk attempts', async () => {
    await prepareFutureUltraAttempt(startOptions)
    await expect(prepareFutureUltraAttempt(startOptions)).rejects.toMatchObject({
      code: 'attempt_already_running',
    })
    await expect(
      prepareFutureUltraAttempt({
        ...startOptions,
        attemptNumber: 2,
        outputPath: join(runRoot, 'worker-outputs', 'corpus-a', 'corpus-a-00001.attempt-2.jsonl'),
      }),
    ).rejects.toMatchObject({ code: 'chunk_not_pending' })

    const validationPath = join(runRoot, 'validation', 'corpus-a', 'corpus-a-00001.attempt-1.json')
    await writeValidationArtifacts({
      packetPath,
      outputPath,
      validationPath,
      output: `${JSON.stringify(validResult('1'))}\n`,
    })
    await recordFutureUltraAttemptTerminal({
      runRoot,
      ownerId: 'coordinator-01',
      chunkId: 'corpus-a-00001',
      attemptNumber: 1,
      status: 'validated',
      validationReportPath: validationPath,
      completedAt: COMPLETED_AT,
    })
    await expect(
      recordFutureUltraAttemptTerminal({
        runRoot,
        ownerId: 'coordinator-01',
        chunkId: 'corpus-a-00001',
        attemptNumber: 1,
        status: 'validated',
        validationReportPath: validationPath,
        completedAt: COMPLETED_AT,
      }),
    ).rejects.toMatchObject({ code: 'attempt_already_terminal' })
    await expect(
      prepareFutureUltraAttempt({
        ...startOptions,
        attemptNumber: 2,
        outputPath: join(runRoot, 'worker-outputs', 'corpus-a', 'corpus-a-00001.attempt-2.jsonl'),
      }),
    ).rejects.toMatchObject({ code: 'chunk_completed' })
    await expect(
      prepareFutureUltraAttempt({
        ...startOptions,
        chunkId: 'corpus-a-00002',
        packetPath: secondPacketPath,
        outputPath: join(runRoot, 'worker-outputs', 'corpus-a', 'corpus-a-00002.attempt-1.jsonl'),
      }),
    ).rejects.toMatchObject({ code: 'chunk_completed' })
  })

  it('refuses a failed nonpending chunk', async () => {
    await appendUltraStorageEvent({
      runRoot,
      ownerId: 'coordinator-01',
      event: {
        type: 'chunk_failed',
        recordedAt: PREPARED_AT,
        payload: { chunkId: 'corpus-a-00003' },
      },
    })
    await expect(
      prepareFutureUltraAttempt({
        ...startOptions,
        chunkId: 'corpus-a-00003',
        packetPath: failedPacketPath,
        outputPath: join(runRoot, 'worker-outputs', 'corpus-a', 'corpus-a-00003.attempt-1.jsonl'),
      }),
    ).rejects.toMatchObject({ code: 'chunk_not_pending' })
  })

  it('records validated output and validation hashes with terminal timestamps', async () => {
    const started = await prepareFutureUltraAttempt(startOptions)
    const validationPath = join(runRoot, 'validation', 'corpus-a', 'corpus-a-00001.attempt-1.json')
    await writeValidationArtifacts({
      packetPath,
      outputPath,
      validationPath,
      output: `${JSON.stringify(validResult('1'))}\n`,
    })
    const outputSha256 = sha256(await readFile(outputPath))
    const validationSha256 = sha256(await readFile(validationPath))

    const terminal = await recordFutureUltraAttemptTerminal({
      runRoot,
      ownerId: 'coordinator-01',
      chunkId: 'corpus-a-00001',
      attemptNumber: 1,
      status: 'validated',
      validationReportPath: validationPath,
      expectedOutputSha256: outputSha256,
      expectedValidationReportSha256: validationSha256,
      completedAt: COMPLETED_AT,
    })

    expect(terminal.payload).toMatchObject({
      status: 'validated',
      startedAt: STARTED_AT,
      completedAt: COMPLETED_AT,
      validationOutcome: { result: 'valid', errors: [] },
      provenance: {
        status: 'completed',
        renderedPromptSha256: started.payload.provenance.renderedPromptSha256,
        packetSha256: started.payload.provenance.packetSha256,
        outputSha256,
        validationReportPath: validationPath,
        validationReportSha256: validationSha256,
      },
    })
    expect((await readUltraEventLog(runRoot)).map((event) => event.type)).toEqual([
      'attempt_started',
      'attempt_validated',
    ])
  })

  it('refuses malformed output or a nonmatching report from being recorded as validated', async () => {
    await prepareFutureUltraAttempt(startOptions)
    const validationPath = join(runRoot, 'validation', 'corpus-a', 'corpus-a-00001.attempt-1.json')
    const report = await writeValidationArtifacts({
      packetPath,
      outputPath,
      validationPath,
      output: '{"pmid":"1"}\n',
    })
    expect(report.valid).toBe(false)

    await expect(
      recordFutureUltraAttemptTerminal({
        runRoot,
        ownerId: 'coordinator-01',
        chunkId: 'corpus-a-00001',
        attemptNumber: 1,
        status: 'validated',
        validationReportPath: validationPath,
        completedAt: COMPLETED_AT,
      }),
    ).rejects.toMatchObject({ code: 'validation_status_mismatch' })

    await writeFile(validationPath, '{"valid":true,"errors":[]}\n')
    await expect(
      recordFutureUltraAttemptTerminal({
        runRoot,
        ownerId: 'coordinator-01',
        chunkId: 'corpus-a-00001',
        attemptNumber: 1,
        status: 'validated',
        validationReportPath: validationPath,
        completedAt: COMPLETED_AT,
      }),
    ).rejects.toMatchObject({ code: 'validation_report_mismatch' })
    expect(await readUltraEventLog(runRoot)).toHaveLength(1)
  })

  it('can preserve terminal evidence after the repository changes post-start', async () => {
    await prepareFutureUltraAttempt(startOptions)
    const validationPath = join(runRoot, 'validation', 'corpus-a', 'corpus-a-00001.attempt-1.json')
    await writeValidationArtifacts({
      packetPath,
      outputPath,
      validationPath,
      output: `${JSON.stringify(validResult('1'))}\n`,
    })
    await writeFile(trackedSentinelPath, 'repository changed after worker start\n')

    await expect(
      recordFutureUltraAttemptTerminal({
        runRoot,
        ownerId: 'coordinator-01',
        chunkId: 'corpus-a-00001',
        attemptNumber: 1,
        status: 'validated',
        validationReportPath: validationPath,
        completedAt: COMPLETED_AT,
      }),
    ).resolves.toMatchObject({ payload: { status: 'validated' } })
  })

  it.each([
    ['rendered prompt', 'prompt'],
    ['packet', 'packet'],
  ] as const)('refuses terminal recording after %s integrity changes', async (_label, target) => {
    const started = await prepareFutureUltraAttempt(startOptions)
    const validationPath = join(runRoot, 'validation', 'corpus-a', 'corpus-a-00001.attempt-1.json')
    await mkdir(resolve(validationPath, '..'), { recursive: true })
    await writeFile(outputPath, '{"pmid":"1"}\n')
    await writeFile(validationPath, '{"valid":true}\n')
    await writeFile(
      target === 'prompt' ? started.payload.provenance.renderedPromptPath : packetPath,
      'tampered after start\n',
    )

    await expect(
      recordFutureUltraAttemptTerminal({
        runRoot,
        ownerId: 'coordinator-01',
        chunkId: 'corpus-a-00001',
        attemptNumber: 1,
        status: 'validated',
        validationReportPath: validationPath,
        completedAt: COMPLETED_AT,
      }),
    ).rejects.toThrow(/checksum mismatch before dispatch/u)
    expect(await readUltraEventLog(runRoot)).toHaveLength(1)
  })

  it('refuses expected output or validation hash mismatches before appending terminal state', async () => {
    await prepareFutureUltraAttempt(startOptions)
    const validationPath = join(runRoot, 'validation', 'corpus-a', 'corpus-a-00001.attempt-1.json')
    await writeValidationArtifacts({
      packetPath,
      outputPath,
      validationPath,
      output: `${JSON.stringify(validResult('1'))}\n`,
    })

    await expect(
      recordFutureUltraAttemptTerminal({
        runRoot,
        ownerId: 'coordinator-01',
        chunkId: 'corpus-a-00001',
        attemptNumber: 1,
        status: 'validated',
        validationReportPath: validationPath,
        expectedOutputSha256: 'f'.repeat(64),
        completedAt: COMPLETED_AT,
      }),
    ).rejects.toMatchObject({ code: 'terminal_hash_mismatch' })
    expect(await readUltraEventLog(runRoot)).toHaveLength(1)
  })

  it('returns an invalid attempt to pending while preserving its terminal identity for retry', async () => {
    await prepareFutureUltraAttempt(startOptions)
    const validationPath = join(runRoot, 'validation', 'corpus-a', 'corpus-a-00001.attempt-1.json')
    const report = await writeValidationArtifacts({
      packetPath,
      outputPath,
      validationPath,
      output: '{"malformed":true}\n',
    })
    await recordFutureUltraAttemptTerminal({
      runRoot,
      ownerId: 'coordinator-01',
      chunkId: 'corpus-a-00001',
      attemptNumber: 1,
      status: 'invalid',
      validationReportPath: validationPath,
      validationErrors: report.errors.map((error) => error.message),
      completedAt: COMPLETED_AT,
    })

    await prepareFutureUltraAttempt({
      ...startOptions,
      attemptNumber: 2,
      assignmentOrdinal: 2,
      outputPath: join(runRoot, 'worker-outputs', 'corpus-a', 'corpus-a-00001.attempt-2.jsonl'),
      preparedAt: '2026-08-03T04:03:00.000Z',
      startedAt: '2026-08-03T04:04:00.000Z',
    })
    const events = await readUltraEventLog(runRoot)
    const projection = projectUltraAttemptRuntimeState(definition, events)
    expect(projection.attempts['corpus-a-00001.attempt-1'].status).toBe('invalid')
    expect(projection.attempts['corpus-a-00001.attempt-2'].status).toBe('running')
    expect(projection.chunks['corpus-a-00001']).toMatchObject({
      status: 'running',
      currentAttemptId: 'corpus-a-00001.attempt-2',
    })
  })

  it('records worker failure with a missing output but a hashed validation report', async () => {
    await prepareFutureUltraAttempt(startOptions)
    const validationPath = join(runRoot, 'validation', 'corpus-a', 'corpus-a-00001.attempt-1.json')
    await mkdir(resolve(validationPath, '..'), { recursive: true })
    await writeFile(validationPath, '{"valid":false,"workerError":"session lost"}\n')

    const result = await recordFutureUltraAttemptTerminal({
      runRoot,
      ownerId: 'coordinator-01',
      chunkId: 'corpus-a-00001',
      attemptNumber: 1,
      status: 'worker_failed',
      validationReportPath: validationPath,
      validationErrors: ['session lost'],
      completedAt: COMPLETED_AT,
    })
    expect(result.payload).toMatchObject({
      status: 'worker_failed',
      validationOutcome: { result: 'worker_failed', errors: ['session lost'] },
      provenance: {
        status: 'failed',
        outputSha256: null,
        validationReportSha256: sha256(await readFile(validationPath)),
      },
    })
  })

  it('exposes a guarded CLI that explicitly states it never dispatches a worker', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    try {
      await runUltraAttemptRuntimeCli(['help'])
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/never dispatches a worker/u))
    } finally {
      log.mockRestore()
    }
  })
})
