import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'

import {
  UNAVAILABLE_LEGACY,
  auditUltraV1MigrationEquivalence,
  buildUltraV1MigrationPlan,
  commitUltraV1Migration,
  defaultUltraV1MigrationDestination,
  inventoryLegacyArtifacts,
  replayUltraV1Migration,
  type LegacyScreeningChunk,
  type LegacyScreeningManifest,
  type LegacyScreeningPhase,
  type LegacyWorkerAttempt,
  type UltraV1MigrationError,
} from '../../../../scripts/literature/ultra-v1-migration'
import { runUltraV1MigrationCli } from '../../../../scripts/literature/ultra-v1-migration-cli'
import {
  initializeUltraStorageV2,
  readUltraEventLog,
  withUltraCoordinatorWriter,
} from '../../../../scripts/literature/ultra-storage-v2'

const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const MIGRATION_COMMIT = 'c'.repeat(40)

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

async function write(path: string, value: string) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, value, 'utf8')
}

function timestamp(index: number) {
  return `2026-07-31T00:${String(index).padStart(2, '0')}:00.000Z`
}

function phase(options: {
  id: string
  status: LegacyScreeningPhase['status']
  expectedModelFamily: string
  chunkIds: string[]
  selectedCount: number
  createdAt: string
  completedAt?: string | null
  aggregateOutputPath: string
  aggregateOutputSha256?: string | null
}): LegacyScreeningPhase {
  return {
    id: options.id,
    kind: options.id === 'pilot-a' ? 'pilot' : 'smoke',
    expectedModelFamily: options.expectedModelFamily,
    status: options.status,
    createdAt: options.createdAt,
    completedAt: options.completedAt ?? null,
    seed: `${options.id}-seed`,
    selectedCount: options.selectedCount,
    chunkSize: options.selectedCount,
    requestedWorkerCount: 1,
    chunkIds: options.chunkIds,
    sourcePhaseIds: [],
    sourceSnapshotSha256: HASH_A,
    aggregateOutputPath: options.aggregateOutputPath,
    aggregateOutputSha256: options.aggregateOutputSha256 ?? null,
    selectionAuditPath: null,
  }
}

function chunk(options: {
  id: string
  phaseId: string
  status: LegacyScreeningChunk['status']
  inputPath: string
  validatedOutputPath: string
  attempts?: LegacyWorkerAttempt[]
  validatedOutputSha256?: string | null
}): LegacyScreeningChunk {
  return {
    id: options.id,
    phaseId: options.phaseId,
    index: 1,
    status: options.status,
    assignedPmids: [options.phaseId === 'pilot-a' ? '2' : '1'],
    inputPath: options.inputPath,
    packetSha256: HASH_B,
    validatedOutputPath: options.validatedOutputPath,
    validatedOutputSha256: options.validatedOutputSha256 ?? null,
    attempts: options.attempts ?? [],
  }
}

function attempt(options: {
  number: number
  status: LegacyWorkerAttempt['status']
  outputPath: string
  validationPath: string | null
  validationResult: LegacyWorkerAttempt['validationResult']
  completedAt?: string | null
  outputSha256?: string | null
  errors?: string[]
}): LegacyWorkerAttempt {
  return {
    attemptNumber: options.number,
    agentId: `/root/worker-${options.number}`,
    model: 'gpt-5.6-terra',
    reasoningLevel: 'ultra',
    assignedPmids: ['1'],
    status: options.status,
    outputPath: options.outputPath,
    startedAt: timestamp(options.number + 1),
    completedAt: options.completedAt ?? null,
    outputSha256: options.outputSha256 ?? null,
    validationPath: options.validationPath,
    validationResult: options.validationResult,
    validationErrors: options.errors ?? [],
  }
}

function manifest(options: {
  root: string
  updatedAt: string
  phases: Record<string, LegacyScreeningPhase>
  chunks: Record<string, LegacyScreeningChunk>
  blockers?: LegacyScreeningManifest['dispatchBlockers']
  allocations?: LegacyScreeningManifest['allocationChanges']
}): LegacyScreeningManifest {
  return {
    manifestVersion: '1.0.0',
    schemaVersion: '1.0.0',
    runId: 'synthetic-ultra-v1',
    rootPath: options.root,
    createdAt: timestamp(0),
    updatedAt: options.updatedAt,
    maxRetries: 2,
    databaseSnapshot: {
      availableArticleCount: 2,
      withAbstractCount: 2,
      noAbstractCount: 0,
      capturedAt: timestamp(0),
    },
    phases: options.phases,
    chunks: options.chunks,
    dispatchBlockers: options.blockers ?? [],
    allocationChanges: options.allocations ?? [],
  }
}

async function writeSnapshot(root: string, state: LegacyScreeningManifest) {
  const raw = `${JSON.stringify(state, null, 2)}\n`
  const hash = digest(raw)
  const safeTime = state.updatedAt.replaceAll(':', '-').replaceAll('.', '-')
  await write(resolve(root, 'manifest-history', `${safeTime}-${hash.slice(0, 12)}.json`), raw)
}

async function syntheticV1Fixture() {
  const root = await mkdtemp(resolve(tmpdir(), 'ultra-v1-migration-'))
  const smokePacketPath = resolve(root, 'packets/smoke-a/smoke-a-00001.json')
  const pilotPacketPath = resolve(root, 'packets/pilot-a/pilot-a-00001.json')
  const output1 = resolve(root, 'worker-outputs/smoke-a/smoke-a-00001.attempt-1.jsonl')
  const output2 = resolve(root, 'worker-outputs/smoke-a/smoke-a-00001.attempt-2.jsonl')
  const validation1 = resolve(root, 'validation/smoke-a/smoke-a-00001.attempt-1.json')
  const validation2 = resolve(root, 'validation/smoke-a/smoke-a-00001.attempt-2.json')
  const validated = resolve(root, 'validated/smoke-a/smoke-a-00001.jsonl')
  const aggregate = resolve(root, 'validated/smoke-a/all.jsonl')
  const pilotAggregate = resolve(root, 'validated/pilot-a/all.jsonl')

  await write(smokePacketPath, `${JSON.stringify([{ pmid: '1', title: 'Smoke' }], null, 2)}\n`)
  await write(pilotPacketPath, `${JSON.stringify([{ pmid: '2', title: 'Pilot' }], null, 2)}\n`)
  await write(output1, '{"pmid":"1","invalid":true}\n')
  await write(output2, '{"pmid":"1","relevanceLabel":"exclude"}\n')
  await write(validation1, '{"valid":false}\n')
  await write(validation2, '{"valid":true}\n')
  await write(validated, '{"pmid":"1","relevanceLabel":"exclude"}\n')
  await write(aggregate, '{"pmid":"1","relevanceLabel":"exclude"}\n')
  await write(
    resolve(root, 'quarantine/smoke-a/smoke-a-00001.attempt-1/validation.json'),
    '{"valid":false}\n',
  )

  const runningAttempt1 = attempt({
    number: 1,
    status: 'running',
    outputPath: output1,
    validationPath: null,
    validationResult: null,
  })
  const invalidAttempt1 = attempt({
    number: 1,
    status: 'invalid',
    outputPath: output1,
    validationPath: validation1,
    validationResult: 'invalid',
    completedAt: timestamp(3),
    outputSha256: digest(await readFile(output1, 'utf8')),
    errors: ['synthetic invalid output'],
  })
  const runningAttempt2 = attempt({
    number: 2,
    status: 'running',
    outputPath: output2,
    validationPath: null,
    validationResult: null,
  })
  const validAttempt2 = attempt({
    number: 2,
    status: 'completed',
    outputPath: output2,
    validationPath: validation2,
    validationResult: 'valid',
    completedAt: timestamp(5),
    outputSha256: digest(await readFile(output2, 'utf8')),
  })

  const smokePending = chunk({
    id: 'smoke-a-00001',
    phaseId: 'smoke-a',
    status: 'pending',
    inputPath: smokePacketPath,
    validatedOutputPath: validated,
  })
  const allocation = {
    recordedAt: timestamp(1),
    phaseId: 'smoke-a',
    fromModelFamily: 'luna',
    toModelFamily: 'terra',
    authorizedBy: 'user',
    authorization: 'synthetic authorization',
    rationale: 'synthetic model substitution',
  }
  const states: LegacyScreeningManifest[] = []
  states.push(
    manifest({
      root,
      updatedAt: timestamp(0),
      phases: {
        'smoke-a': phase({
          id: 'smoke-a',
          status: 'pending',
          expectedModelFamily: 'luna',
          chunkIds: ['smoke-a-00001'],
          selectedCount: 1,
          createdAt: timestamp(0),
          aggregateOutputPath: aggregate,
        }),
      },
      chunks: { 'smoke-a-00001': smokePending },
    }),
  )
  states.push(
    manifest({
      ...states[0],
      root,
      updatedAt: timestamp(1),
      phases: {
        'smoke-a': { ...states[0].phases['smoke-a'], expectedModelFamily: 'terra' },
      },
      chunks: cloneChunks(states[0].chunks),
      allocations: [allocation],
    }),
  )
  states.push(
    manifest({
      ...states[1],
      root,
      updatedAt: timestamp(2),
      phases: { 'smoke-a': { ...states[1].phases['smoke-a'], status: 'running' } },
      chunks: {
        'smoke-a-00001': {
          ...smokePending,
          status: 'running',
          attempts: [runningAttempt1],
        },
      },
      allocations: [allocation],
    }),
  )
  states.push(
    manifest({
      ...states[2],
      root,
      updatedAt: timestamp(3),
      phases: clonePhases(states[2].phases),
      chunks: {
        'smoke-a-00001': {
          ...smokePending,
          status: 'retry_pending',
          attempts: [invalidAttempt1],
        },
      },
      allocations: [allocation],
    }),
  )
  states.push(
    manifest({
      ...states[3],
      root,
      updatedAt: timestamp(4),
      phases: clonePhases(states[3].phases),
      chunks: {
        'smoke-a-00001': {
          ...smokePending,
          status: 'running',
          attempts: [invalidAttempt1, runningAttempt2],
        },
      },
      allocations: [allocation],
    }),
  )
  states.push(
    manifest({
      ...states[4],
      root,
      updatedAt: timestamp(5),
      phases: {
        'smoke-a': {
          ...states[4].phases['smoke-a'],
          status: 'completed',
          completedAt: timestamp(5),
          aggregateOutputSha256: digest(await readFile(aggregate, 'utf8')),
        },
      },
      chunks: {
        'smoke-a-00001': {
          ...smokePending,
          status: 'completed',
          validatedOutputSha256: digest(await readFile(validated, 'utf8')),
          attempts: [invalidAttempt1, validAttempt2],
        },
      },
      allocations: [allocation],
    }),
  )
  const pilotChunk = chunk({
    id: 'pilot-a-00001',
    phaseId: 'pilot-a',
    status: 'pending',
    inputPath: pilotPacketPath,
    validatedOutputPath: resolve(root, 'validated/pilot-a/pilot-a-00001.jsonl'),
  })
  states.push(
    manifest({
      ...states[5],
      root,
      updatedAt: timestamp(6),
      phases: {
        ...clonePhases(states[5].phases),
        'pilot-a': phase({
          id: 'pilot-a',
          status: 'pending',
          expectedModelFamily: 'terra',
          chunkIds: ['pilot-a-00001'],
          selectedCount: 1,
          createdAt: timestamp(6),
          aggregateOutputPath: pilotAggregate,
        }),
      },
      chunks: { ...cloneChunks(states[5].chunks), 'pilot-a-00001': pilotChunk },
      allocations: [allocation],
    }),
  )
  states.push(
    manifest({
      ...states[6],
      root,
      updatedAt: timestamp(7),
      phases: clonePhases(states[6].phases),
      chunks: cloneChunks(states[6].chunks),
      blockers: [
        {
          recordedAt: timestamp(7),
          chunkId: 'pilot-a-00001',
          requestedModel: 'gpt-5.6-terra',
          reasoningLevel: 'ultra',
          error: 'synthetic dispatch blocker',
        },
      ],
      allocations: [allocation],
    }),
  )

  for (const state of states.slice(0, -1)) await writeSnapshot(root, state)
  await write(
    resolve(root, 'progress-manifest.json'),
    `${JSON.stringify(states.at(-1), null, 2)}\n`,
  )
  return { root, finalState: states.at(-1) as LegacyScreeningManifest }
}

function clonePhases(value: Record<string, LegacyScreeningPhase>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, LegacyScreeningPhase>
}

function cloneChunks(value: Record<string, LegacyScreeningChunk>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, LegacyScreeningChunk>
}

describe('Ultra v1 additive migration', () => {
  const temporaryRoots: string[] = []

  afterEach(async () => {
    for (const root of temporaryRoots.splice(0)) {
      await rm(root, { recursive: true, force: true })
      await rm(`${root}-v2`, { recursive: true, force: true })
    }
  })

  it('requires the committed destination to be a distinct sibling of v1', async () => {
    await expect(
      buildUltraV1MigrationPlan({
        v1Root: '/tmp/synthetic-ultra-v1',
        destinationRoot: '/tmp/synthetic-ultra-v1/state-v2',
        migrationGitCommit: MIGRATION_COMMIT,
      }),
    ).rejects.toMatchObject<Partial<UltraV1MigrationError>>({
      code: 'invalid_migration_destination',
    })
  })

  it('dry-runs a complete transition reconstruction without writing v2 state', async () => {
    const fixture = await syntheticV1Fixture()
    temporaryRoots.push(fixture.root)
    const before = await inventoryLegacyArtifacts(fixture.root)
    const plan = await buildUltraV1MigrationPlan({
      v1Root: fixture.root,
      migrationGitCommit: MIGRATION_COMMIT,
    })

    expect(plan.destinationRoot).toBe(defaultUltraV1MigrationDestination(fixture.root))
    await expect(
      readFile(resolve(plan.destinationRoot, 'state-v2/run-definition.json')),
    ).rejects.toMatchObject({ code: 'ENOENT' })
    expect(plan.events.map((event) => event.type)).toEqual([
      'allocation_changed',
      'attempt_started',
      'attempt_invalid',
      'attempt_started',
      'attempt_validated',
      'phase_registered',
      'dispatch_blocked',
    ])
    expect(replayUltraV1Migration(plan.runDefinition, plan.events)).toEqual(fixture.finalState)
    expect(plan.counts).toMatchObject({
      phaseCount: 2,
      chunkCount: 2,
      attemptCount: 2,
      invalidAttemptCount: 1,
      completedOutputCount: 1,
      dispatchBlockerCount: 1,
      allocationChangeCount: 1,
      nextPendingChunk: 'pilot-a-00001',
    })
    expect(plan.runDefinition.dispatchAuthorization.status).toBe(
      'disabled_requires_versioned_authorization',
    )
    expect(plan.runDefinition.legacyUnavailableProvenance.repositoryCommit).toBe(UNAVAILABLE_LEGACY)
    const started = plan.events.find((event) => event.type === 'attempt_started')
    expect(started?.payload).toMatchObject({
      provenance: {
        repositoryCommit: UNAVAILABLE_LEGACY,
        workingTreeClean: UNAVAILABLE_LEGACY,
        renderedPromptSha256: UNAVAILABLE_LEGACY,
        workerSessionId: UNAVAILABLE_LEGACY,
        assignmentId: UNAVAILABLE_LEGACY,
      },
    })
    expect(plan.runDefinition.packetInventory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          chunkId: 'smoke-a-00001',
          finalLegacyStatus: 'completed',
          legacyAttemptCount: 2,
        }),
        expect.objectContaining({
          chunkId: 'pilot-a-00001',
          finalLegacyStatus: 'pending',
          legacyAttemptCount: 0,
        }),
      ]),
    )
    expect(await inventoryLegacyArtifacts(fixture.root)).toEqual(before)
  })

  it('commits additively, verifies exact equivalence, and is idempotent', async () => {
    const fixture = await syntheticV1Fixture()
    temporaryRoots.push(fixture.root)
    const before = await inventoryLegacyArtifacts(fixture.root)
    const plan = await buildUltraV1MigrationPlan({
      v1Root: fixture.root,
      migrationGitCommit: MIGRATION_COMMIT,
    })

    const first = await commitUltraV1Migration(plan, { ownerId: 'migration-test' })
    expect(first.result).toBe('created')
    expect(first).toMatchObject({
      writesPerformed: true,
      initializedStorage: true,
      appendedEventCount: 7,
      checkpointWritten: true,
      progressSummaryWritten: true,
    })
    expect(first.equivalence.equivalent).toBe(true)
    expect(first.equivalence.counts).toEqual(plan.counts)
    const eventCount = (await readUltraEventLog(plan.destinationRoot)).length

    const second = await commitUltraV1Migration(plan, { ownerId: 'migration-test' })
    expect(second.result).toBe('verified_existing')
    expect(second).toMatchObject({
      writesPerformed: false,
      initializedStorage: false,
      appendedEventCount: 0,
      checkpointWritten: false,
      progressSummaryWritten: false,
    })
    expect((await readUltraEventLog(plan.destinationRoot)).length).toBe(eventCount)
    await expect(auditUltraV1MigrationEquivalence(plan)).resolves.toMatchObject({
      equivalent: true,
      eventCount: 7,
      counts: { nextPendingChunk: 'pilot-a-00001' },
    })
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    try {
      await expect(
        runUltraV1MigrationCli([
          'commit',
          '--v1-root',
          fixture.root,
          '--expected-source-sha256',
          plan.sourceManifestSha256,
          '--migration-git-commit',
          MIGRATION_COMMIT,
        ]),
      ).resolves.toMatchObject({
        mode: 'commit',
        writesPerformed: false,
        commitResult: 'verified_existing',
        mutation: {
          initializedStorage: false,
          appendedEventCount: 0,
          checkpointWritten: false,
          progressSummaryWritten: false,
        },
      })
    } finally {
      consoleLog.mockRestore()
    }
    expect(await inventoryLegacyArtifacts(fixture.root)).toEqual(before)
  })

  it('resumes a partial commit and reports every write through the CLI', async () => {
    const fixture = await syntheticV1Fixture()
    temporaryRoots.push(fixture.root)
    const plan = await buildUltraV1MigrationPlan({
      v1Root: fixture.root,
      migrationGitCommit: MIGRATION_COMMIT,
    })
    await initializeUltraStorageV2({
      runRoot: plan.destinationRoot,
      runDefinition: plan.runDefinition,
    })
    await withUltraCoordinatorWriter({
      runRoot: plan.destinationRoot,
      ownerId: 'partial-migration-test',
      action: (writer) => writer.appendMany(plan.events.slice(0, 2)),
    })

    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    try {
      const result = await runUltraV1MigrationCli([
        'commit',
        '--v1-root',
        fixture.root,
        '--expected-source-sha256',
        plan.sourceManifestSha256,
        '--migration-git-commit',
        MIGRATION_COMMIT,
        '--owner-id',
        'migration-cli-test',
      ])
      expect(result).toMatchObject({
        mode: 'commit',
        writesPerformed: true,
        commitResult: 'resumed',
        mutation: {
          initializedStorage: false,
          appendedEventCount: 5,
          checkpointWritten: true,
          progressSummaryWritten: true,
        },
        equivalence: { equivalent: true, eventCount: 7 },
      })
    } finally {
      consoleLog.mockRestore()
    }
  })

  it('rejects an incorrect expected source checksum before migration', async () => {
    const fixture = await syntheticV1Fixture()
    temporaryRoots.push(fixture.root)

    await expect(
      buildUltraV1MigrationPlan({
        v1Root: fixture.root,
        migrationGitCommit: MIGRATION_COMMIT,
        expectedSourceManifestSha256: '0'.repeat(64),
      }),
    ).rejects.toMatchObject<Partial<UltraV1MigrationError>>({
      code: 'source_manifest_checksum_mismatch',
    })
  })

  it('refuses commit when the source manifest changes after dry-run', async () => {
    const fixture = await syntheticV1Fixture()
    temporaryRoots.push(fixture.root)
    const plan = await buildUltraV1MigrationPlan({
      v1Root: fixture.root,
      migrationGitCommit: MIGRATION_COMMIT,
    })
    const manifestPath = resolve(fixture.root, 'progress-manifest.json')
    await writeFile(manifestPath, `${await readFile(manifestPath, 'utf8')} `, 'utf8')

    await expect(commitUltraV1Migration(plan)).rejects.toMatchObject<
      Partial<UltraV1MigrationError>
    >({ code: 'source_manifest_checksum_mismatch' })
  })

  it('re-inventories every source artifact before writing a fresh destination', async () => {
    const fixture = await syntheticV1Fixture()
    temporaryRoots.push(fixture.root)
    const plan = await buildUltraV1MigrationPlan({
      v1Root: fixture.root,
      migrationGitCommit: MIGRATION_COMMIT,
    })
    const packetPath = plan.runDefinition.packetInventory[0].packetPath
    await writeFile(packetPath, `${await readFile(packetPath, 'utf8')} `, 'utf8')

    await expect(commitUltraV1Migration(plan)).rejects.toMatchObject<
      Partial<UltraV1MigrationError>
    >({ code: 'legacy_artifact_checksum_mismatch' })
    await expect(
      readFile(resolve(plan.destinationRoot, 'state-v2/run-definition.json')),
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
