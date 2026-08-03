import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

import {
  assertPreparedAttemptIntegrity,
  completeAttemptProvenance,
  prepareAttemptProvenance,
  readTrackedRepositoryState,
  type ApprovedAttemptRunDefinition,
  type PrepareAttemptProvenanceOptions,
} from '@/features/literature/ultra-screening/attempt-provenance'

const execFileAsync = promisify(execFile)

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

describe('future Ultra attempt provenance', () => {
  let root: string
  let repositoryRoot: string
  let stateRoot: string
  let packetPath: string
  let policyPath: string
  let templatePath: string
  let bootstrapPath: string
  let trackedMarkerPath: string
  let workerOutputRoot: string
  let runDefinition: ApprovedAttemptRunDefinition
  let options: PrepareAttemptProvenanceOptions

  beforeEach(async () => {
    root = await mkdtemp(resolve(tmpdir(), 'ultra-attempt-provenance-'))
    repositoryRoot = resolve(root, 'repository')
    stateRoot = resolve(root, 'state-v2')
    packetPath = resolve(root, 'packet.json')
    policyPath = resolve(repositoryRoot, 'policy.md')
    templatePath = resolve(repositoryRoot, 'template.md')
    bootstrapPath = resolve(repositoryRoot, 'bootstrap.md')
    trackedMarkerPath = resolve(repositoryRoot, 'tracked.txt')
    workerOutputRoot = resolve(root, 'worker-outputs')
    await mkdir(repositoryRoot, { recursive: true })
    await mkdir(workerOutputRoot, { recursive: true })
    await writeFile(policyPath, 'Classify only the supplied packet.\n')
    await writeFile(
      templatePath,
      [
        '{{ASSIGNMENT_ID}} {{ASSIGNMENT_ORDINAL}} {{CHUNK_ID}} {{ATTEMPT_NUMBER}}',
        '{{PACKET_PATH}} {{PACKET_SHA256}} {{OUTPUT_PATH}}',
        '{{SCREENING_POLICY_VERSION}} {{SCREENING_POLICY_SHA256}}',
        '{{SCREENING_POLICY_TEXT}}',
        '',
      ].join('\n'),
    )
    await writeFile(bootstrapPath, 'Process one isolated assignment at a time.\n')
    await writeFile(trackedMarkerPath, 'clean\n')
    await writeFile(packetPath, '[{"pmid":"1"}]\n')
    await execFileAsync('git', ['init', '--quiet'], { cwd: repositoryRoot })
    await execFileAsync('git', ['config', 'user.email', 'tests@example.test'], {
      cwd: repositoryRoot,
    })
    await execFileAsync('git', ['config', 'user.name', 'Ultra Tests'], { cwd: repositoryRoot })
    await execFileAsync('git', ['add', 'policy.md', 'template.md', 'bootstrap.md', 'tracked.txt'], {
      cwd: repositoryRoot,
    })
    await execFileAsync('git', ['commit', '--quiet', '-m', 'test fixture'], {
      cwd: repositoryRoot,
    })
    const repositoryState = await readTrackedRepositoryState(repositoryRoot)
    runDefinition = {
      repositoryCommit: repositoryState.repositoryCommit,
      screeningPolicy: {
        version: '1.0.0',
        path: policyPath,
        sha256: sha256(await readFile(policyPath)),
      },
      workerPromptTemplate: {
        version: '1.0.0',
        path: templatePath,
        sha256: sha256(await readFile(templatePath)),
      },
      workerBootstrapPrompt: {
        version: '1.0.0',
        path: bootstrapPath,
        sha256: sha256(await readFile(bootstrapPath)),
      },
      packetInventory: [
        {
          chunkId: 'corpus-a-00001',
          phaseId: 'corpus-a',
          packetPath,
          packetSha256: sha256(await readFile(packetPath)),
        },
      ],
      workerOutputRoot,
    }
    options = {
      repositoryRoot,
      stateRoot,
      runDefinition,
      chunkId: 'corpus-a-00001',
      attemptNumber: 1,
      workerId: 'worker-01',
      workerSessionId: 'session-01',
      assignmentId: 'assignment-01',
      assignmentOrdinal: 1,
      actualModel: 'gpt-5.6-terra',
      reasoningLevel: 'ultra',
      packetPath,
      packetSha256: sha256(await readFile(packetPath)),
      outputPath: resolve(workerOutputRoot, 'output.jsonl'),
      reusableWorker: true,
      timestamp: '2026-08-03T04:00:00.000Z',
    }
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('renders and checksums the exact immutable prompt before dispatch', async () => {
    const prepared = await prepareAttemptProvenance(options)

    expect(prepared.renderedPrompt).toContain('assignment-01 1 corpus-a-00001 1')
    expect(prepared.provenance).toMatchObject({
      status: 'prepared',
      repositoryRoot,
      repositoryCommit: runDefinition.repositoryCommit,
      workingTreeClean: true,
      packetSha256: options.packetSha256,
      workerBootstrapPromptSha256: runDefinition.workerBootstrapPrompt?.sha256,
      outputSha256: null,
      validationReportSha256: null,
    })
    expect(sha256(await readFile(prepared.provenance.renderedPromptPath))).toBe(
      prepared.provenance.renderedPromptSha256,
    )
    await expect(assertPreparedAttemptIntegrity(prepared.provenance)).resolves.toBeUndefined()
  })

  it('refuses a dirty tracked worktree', async () => {
    await writeFile(trackedMarkerPath, 'dirty\n')
    await expect(prepareAttemptProvenance(options)).rejects.toThrow('dirty tracked worktree')
  })

  it('refuses policy and prompt-template checksum changes', async () => {
    await expect(
      prepareAttemptProvenance({
        ...options,
        runDefinition: {
          ...runDefinition,
          screeningPolicy: { ...runDefinition.screeningPolicy, sha256: 'f'.repeat(64) },
        },
      }),
    ).rejects.toThrow('Screening policy checksum mismatch')

    await expect(
      prepareAttemptProvenance({
        ...options,
        renderedPromptPath: resolve(stateRoot, 'rendered-prompts', 'template-mismatch.md'),
        runDefinition: {
          ...runDefinition,
          workerPromptTemplate: {
            ...runDefinition.workerPromptTemplate,
            sha256: 'e'.repeat(64),
          },
        },
      }),
    ).rejects.toThrow('Worker prompt template checksum mismatch')
  })

  it('refuses to overwrite a changed rendered prompt', async () => {
    const prepared = await prepareAttemptProvenance(options)
    await writeFile(prepared.provenance.renderedPromptPath, 'tampered\n')

    await expect(prepareAttemptProvenance(options)).rejects.toThrow(
      'Refusing to overwrite nonmatching rendered prompt',
    )
  })

  it('requires a versioned repository amendment for a new commit', async () => {
    await writeFile(resolve(repositoryRoot, 'amendment.txt'), 'versioned change\n')
    await execFileAsync('git', ['add', 'amendment.txt'], { cwd: repositoryRoot })
    await execFileAsync('git', ['commit', '--quiet', '-m', 'versioned amendment'], {
      cwd: repositoryRoot,
    })
    const changedCommit = (await readTrackedRepositoryState(repositoryRoot)).repositoryCommit
    await expect(prepareAttemptProvenance(options)).rejects.toThrow(
      'explicit versioned amendment is required',
    )

    const amended = await prepareAttemptProvenance({
      ...options,
      renderedPromptPath: resolve(stateRoot, 'rendered-prompts', 'amended.md'),
      runDefinition: {
        ...runDefinition,
        repositoryAmendments: [
          {
            amendmentVersion: 'amendment-001',
            repositoryCommit: changedCommit,
            approvedAt: '2026-08-03T03:59:00.000Z',
            approvedBy: 'coordinator',
            rationale: 'Audited implementation-only change.',
          },
        ],
      },
    })
    expect(amended.provenance.repositoryAmendmentVersion).toBe('amendment-001')
  })

  it('rechecks Git state immediately before dispatch', async () => {
    const prepared = await prepareAttemptProvenance(options)
    await writeFile(trackedMarkerPath, 'became dirty after preparation\n')

    await expect(assertPreparedAttemptIntegrity(prepared.provenance)).rejects.toThrow(
      'Repository state changed before dispatch',
    )
  })

  it('binds the chunk to its immutable packet and confines the output path', async () => {
    const otherPacket = resolve(root, 'other-packet.json')
    await writeFile(otherPacket, '[{"pmid":"2"}]\n')
    await expect(
      prepareAttemptProvenance({
        ...options,
        packetPath: otherPacket,
        packetSha256: sha256(await readFile(otherPacket)),
      }),
    ).rejects.toThrow('Packet assignment mismatch')

    await expect(
      prepareAttemptProvenance({
        ...options,
        outputPath: resolve(root, 'outside-output.jsonl'),
      }),
    ).rejects.toThrow('outputPath must be inside')
  })

  it('records output and validation hashes on terminal completion', async () => {
    const prepared = await prepareAttemptProvenance(options)
    const validationPath = resolve(root, 'validation.json')
    await writeFile(options.outputPath, '{"pmid":"1"}\n')
    await writeFile(validationPath, '{"valid":true}\n')

    const completed = await completeAttemptProvenance({
      prepared: prepared.provenance,
      status: 'completed',
      startedAt: '2026-08-03T04:01:00.000Z',
      completedAt: '2026-08-03T04:02:00.000Z',
      validationReportPath: validationPath,
    })

    expect(completed.outputSha256).toBe(sha256(await readFile(options.outputPath)))
    expect(completed.validationReportSha256).toBe(sha256(await readFile(validationPath)))
  })

  it('never permits a completed or invalid attempt without an output hash', async () => {
    const prepared = await prepareAttemptProvenance(options)
    const validationPath = resolve(root, 'missing-output-validation.json')
    await writeFile(validationPath, '{"valid":false}\n')

    await expect(
      completeAttemptProvenance({
        prepared: prepared.provenance,
        status: 'completed',
        startedAt: '2026-08-03T04:01:00.000Z',
        completedAt: '2026-08-03T04:02:00.000Z',
        validationReportPath: validationPath,
        outputMayBeMissing: true,
      }),
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
