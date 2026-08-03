import { mkdtemp, readFile, readdir, rm, truncate, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

import {
  GENESIS_EVENT_HASH,
  MAX_EVENT_BYTES,
  ULTRA_STORAGE_V2_VERSION,
  UltraCheckpointCadenceController,
  appendUltraStorageEvent,
  canonicalJson,
  initializeUltraStorageV2,
  inspectCoordinatorWriterLock,
  loadLatestUltraCheckpoint,
  readUltraEventHead,
  readUltraEventLog,
  readUltraRunDefinition,
  reconstructUltraState,
  recoverStaleCoordinatorWriterLock,
  ultraStorageFootprint,
  withUltraCoordinatorWriter,
  writeUltraCheckpointIfDue,
  type CoordinatorWriterLockMetadata,
  type UltraRunDefinitionV2,
  type UltraStorageEvent,
} from '../../../../scripts/literature/ultra-storage-v2'

const FIXED_TIME = '2026-08-02T12:00:00.000Z'
const PACKET_SHA = 'a'.repeat(64)
const RUN_DEFINITION_FILENAME = 'run-definition.json'

function runDefinition(packetCount = 2): UltraRunDefinitionV2 {
  return {
    runId: 'ip-literature-ultra-storage-test',
    createdAt: FIXED_TIME,
    corpusSnapshot: {
      articleCount: 50,
      sha256: 'b'.repeat(64),
    },
    phaseConfiguration: [
      {
        phaseId: 'corpus-a',
        chunkSize: 25,
      },
    ],
    packetInventory: Array.from({ length: packetCount }, (_, index) => ({
      chunkId: `corpus-a-${String(index).padStart(5, '0')}`,
      phaseId: 'corpus-a',
      packetPath: `packets/corpus-a-${String(index).padStart(5, '0')}.json`,
      packetSha256: index === 0 ? PACKET_SHA : index.toString(16).padStart(64, '0'),
    })),
    screeningPolicyVersion: 'ip-screening-policy-v2',
  }
}

function incrementReducer(
  state: { count: number; eventTypes: string[] },
  event: UltraStorageEvent,
) {
  return {
    count: state.count + Number((event.payload as { amount?: number }).amount ?? 0),
    eventTypes: [...state.eventTypes, event.type],
  }
}

describe('Ultra screening storage v2', () => {
  jest.setTimeout(60_000)

  let runRoot: string

  beforeEach(async () => {
    runRoot = await mkdtemp(join(tmpdir(), 'ip-ultra-storage-v2-'))
  })

  afterEach(async () => {
    await rm(runRoot, { recursive: true, force: true })
  })

  it('publishes one immutable run definition and refuses reinitialization', async () => {
    const definition = runDefinition()
    const initialized = await initializeUltraStorageV2({ runRoot, runDefinition: definition })
    const loaded = await readUltraRunDefinition(runRoot)

    expect(loaded.definition).toEqual(definition)
    expect(loaded.definitionSha256).toBe(initialized.definitionSha256)
    expect(loaded.definitionSha256).toMatch(/^[a-f0-9]{64}$/u)
    expect(await readUltraEventHead(runRoot)).toMatchObject({
      sequence: 0,
      eventHash: GENESIS_EVENT_HASH,
      eventLogBytes: 0,
      headSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    })
    await expect(
      initializeUltraStorageV2({ runRoot, runDefinition: definition }),
    ).rejects.toMatchObject({ code: 'storage_already_exists' })

    const definitionBytesBefore = await readFile(initialized.layout.runDefinitionPath)
    await appendUltraStorageEvent({
      runRoot,
      ownerId: 'coordinator-a',
      event: { type: 'phase_started', recordedAt: FIXED_TIME, payload: { phaseId: 'corpus-a' } },
    })
    expect(await readFile(initialized.layout.runDefinitionPath)).toEqual(definitionBytesBefore)
  })

  it('appends explicit events with monotonic sequence and a verified hash chain', async () => {
    await initializeUltraStorageV2({ runRoot, runDefinition: runDefinition() })
    const receipts = await withUltraCoordinatorWriter({
      runRoot,
      ownerId: 'coordinator-a',
      action: (writer) =>
        writer.appendMany([
          {
            type: 'phase_started',
            recordedAt: FIXED_TIME,
            payload: { phaseId: 'corpus-a' },
          },
          {
            type: 'attempt_started',
            recordedAt: '2026-08-02T12:00:01.000Z',
            payload: { chunkId: 'corpus-a-00000', amount: 1 },
          },
          {
            type: 'attempt_validated',
            recordedAt: '2026-08-02T12:00:02.000Z',
            payload: { chunkId: 'corpus-a-00000', amount: 2 },
          },
        ]),
    })
    const events = await readUltraEventLog(runRoot)

    expect(events).toEqual(receipts.map((receipt) => receipt.event))
    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3])
    expect(events[0].previousEventHash).toBe(GENESIS_EVENT_HASH)
    expect(events[1].previousEventHash).toBe(events[0].eventHash)
    expect(events[2].previousEventHash).toBe(events[1].eventHash)
    expect(events.every((event) => /^[a-f0-9]{64}$/u.test(event.eventHash))).toBe(true)
    expect(receipts.every((receipt) => receipt.bytesWritten <= MAX_EVENT_BYTES)).toBe(true)
    expect(await readUltraEventHead(runRoot)).toMatchObject({
      sequence: 3,
      eventHash: events[2].eventHash,
      eventLogBytes: receipts.reduce((total, receipt) => total + receipt.bytesWritten, 0),
    })

    const firstReplay = await reconstructUltraState({
      runRoot,
      initialState: { count: 0, eventTypes: [] as string[] },
      reducer: incrementReducer,
    })
    const secondReplay = await reconstructUltraState({
      runRoot,
      initialState: { count: 0, eventTypes: [] as string[] },
      reducer: incrementReducer,
    })
    expect(firstReplay).toEqual(secondReplay)
    expect(firstReplay.state).toEqual({
      count: 3,
      eventTypes: ['phase_started', 'attempt_started', 'attempt_validated'],
    })
  })

  it('rejects a truncated final event without changing the log', async () => {
    const { layout } = await initializeUltraStorageV2({
      runRoot,
      runDefinition: runDefinition(),
    })
    await appendUltraStorageEvent({
      runRoot,
      ownerId: 'coordinator-a',
      event: { type: 'phase_started', recordedAt: FIXED_TIME, payload: { phaseId: 'corpus-a' } },
    })
    const original = await readFile(layout.eventLogPath)
    await truncate(layout.eventLogPath, original.length - 7)
    const truncated = await readFile(layout.eventLogPath)

    await expect(readUltraEventLog(runRoot)).rejects.toMatchObject({
      code: 'truncated_final_event',
    })
    expect(await readFile(layout.eventLogPath)).toEqual(truncated)
    await expect(
      appendUltraStorageEvent({
        runRoot,
        ownerId: 'coordinator-a',
        event: { type: 'phase_completed', payload: { phaseId: 'corpus-a' } },
      }),
    ).rejects.toMatchObject({ code: 'truncated_final_event' })
    expect(await readFile(layout.eventLogPath)).toEqual(truncated)
  })

  it.each([
    {
      name: 'removing a complete final JSONL event',
      tamper: (raw: string) => `${raw.trimEnd().split('\n').slice(0, -1).join('\n')}\n`,
    },
    {
      name: 'clearing a nonempty event log',
      tamper: () => '',
    },
  ])('detects $name against the durable event head without repair', async ({ tamper }) => {
    const { layout } = await initializeUltraStorageV2({
      runRoot,
      runDefinition: runDefinition(),
    })
    await withUltraCoordinatorWriter({
      runRoot,
      ownerId: 'coordinator-a',
      action: (writer) =>
        writer.appendMany([
          { type: 'phase_started', recordedAt: FIXED_TIME, payload: {} },
          { type: 'attempt_started', recordedAt: FIXED_TIME, payload: {} },
        ]),
    })
    const anchorBefore = await readUltraEventHead(runRoot)
    const tampered = tamper(await readFile(layout.eventLogPath, 'utf8'))
    await writeFile(layout.eventLogPath, tampered)

    await expect(readUltraEventLog(runRoot)).rejects.toMatchObject({ code: 'event_head_mismatch' })
    await expect(
      appendUltraStorageEvent({
        runRoot,
        ownerId: 'coordinator-a',
        event: { type: 'phase_completed', recordedAt: FIXED_TIME, payload: {} },
      }),
    ).rejects.toMatchObject({ code: 'event_head_mismatch' })
    expect(await readFile(layout.eventLogPath, 'utf8')).toBe(tampered)
    expect(await readUltraEventHead(runRoot)).toEqual(anchorBefore)
  })

  it('distinguishes malformed middle events from final-tail truncation', async () => {
    const { layout } = await initializeUltraStorageV2({
      runRoot,
      runDefinition: runDefinition(),
    })
    await withUltraCoordinatorWriter({
      runRoot,
      ownerId: 'coordinator-a',
      action: (writer) =>
        writer.appendMany([
          { type: 'phase_started', recordedAt: FIXED_TIME, payload: {} },
          { type: 'attempt_started', recordedAt: FIXED_TIME, payload: {} },
          { type: 'attempt_validated', recordedAt: FIXED_TIME, payload: {} },
        ]),
    })
    const lines = (await readFile(layout.eventLogPath, 'utf8')).trimEnd().split('\n')
    lines[1] = '{"not":"a complete event"}'
    await writeFile(layout.eventLogPath, `${lines.join('\n')}\n`)

    await expect(readUltraEventLog(runRoot)).rejects.toMatchObject({
      code: 'malformed_middle_event',
    })
  })

  it.each([
    {
      name: 'missing sequence',
      mutate: (events: Array<Record<string, unknown>>) => {
        events[1].sequence = 3
      },
      code: 'missing_sequence',
    },
    {
      name: 'duplicate sequence',
      mutate: (events: Array<Record<string, unknown>>) => {
        events[1].sequence = 1
      },
      code: 'duplicate_sequence',
    },
    {
      name: 'prior hash corruption',
      mutate: (events: Array<Record<string, unknown>>) => {
        events[1].previousEventHash = 'c'.repeat(64)
      },
      code: 'previous_hash_mismatch',
    },
    {
      name: 'event hash corruption',
      mutate: (events: Array<Record<string, unknown>>) => {
        events[1].eventHash = 'd'.repeat(64)
      },
      code: 'event_hash_mismatch',
    },
  ])('fails closed on $name', async ({ mutate, code }) => {
    const { layout } = await initializeUltraStorageV2({
      runRoot,
      runDefinition: runDefinition(),
    })
    await withUltraCoordinatorWriter({
      runRoot,
      ownerId: 'coordinator-a',
      action: (writer) =>
        writer.appendMany([
          { type: 'phase_started', recordedAt: FIXED_TIME, payload: {} },
          { type: 'attempt_started', recordedAt: FIXED_TIME, payload: {} },
        ]),
    })
    const events = (await readFile(layout.eventLogPath, 'utf8'))
      .trimEnd()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>)
    mutate(events)
    await writeFile(layout.eventLogPath, `${events.map(canonicalJson).join('\n')}\n`)

    await expect(readUltraEventLog(runRoot)).rejects.toMatchObject({ code })
  })

  it('protects appends with one exclusive coordinator writer lock', async () => {
    await initializeUltraStorageV2({ runRoot, runDefinition: runDefinition() })
    let signalStarted: () => void = () => undefined
    let releaseWriter: () => void = () => undefined
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve
    })
    const gate = new Promise<void>((resolve) => {
      releaseWriter = resolve
    })
    const firstWriter = withUltraCoordinatorWriter({
      runRoot,
      ownerId: 'coordinator-a',
      action: async (writer) => {
        signalStarted()
        await gate
        return writer.append({
          type: 'phase_started',
          recordedAt: FIXED_TIME,
          payload: { coordinator: 'a' },
        })
      },
    })

    await started
    expect(await inspectCoordinatorWriterLock(runRoot)).toMatchObject({ ownerId: 'coordinator-a' })
    await expect(
      appendUltraStorageEvent({
        runRoot,
        ownerId: 'coordinator-b',
        event: { type: 'phase_started', payload: { coordinator: 'b' } },
      }),
    ).rejects.toMatchObject({ code: 'writer_lock_held' })
    releaseWriter()
    await firstWriter
    expect(await inspectCoordinatorWriterLock(runRoot)).toBeNull()
    expect(await readUltraEventLog(runRoot)).toHaveLength(1)
  })

  it('serializes concurrent operations issued through the same writer instance', async () => {
    await initializeUltraStorageV2({ runRoot, runDefinition: runDefinition() })
    const result = await withUltraCoordinatorWriter({
      runRoot,
      ownerId: 'coordinator-a',
      action: async (writer) => {
        const [first, second, checkpoint, summary] = await Promise.all([
          writer.append({
            type: 'attempt_started',
            recordedAt: FIXED_TIME,
            payload: { amount: 1 },
          }),
          writer.append({
            type: 'attempt_validated',
            recordedAt: FIXED_TIME,
            payload: { amount: 2 },
          }),
          writer.writeCheckpoint(
            { count: 3, eventTypes: ['attempt_started', 'attempt_validated'] },
            FIXED_TIME,
          ),
          writer.writeProgressSummary({ expectedHead: 2 }, FIXED_TIME),
        ])
        return { first, second, checkpoint, summary }
      },
    })
    const events = await readUltraEventLog(runRoot)

    expect(events.map((event) => event.sequence)).toEqual([1, 2])
    expect(result.first.event.previousEventHash).toBe(GENESIS_EVENT_HASH)
    expect(result.second.event.previousEventHash).toBe(result.first.event.eventHash)
    expect(result.checkpoint.checkpoint.sequence).toBe(2)
    expect(result.summary.basedOnEventSequence).toBe(2)
  })

  it('does not remove a replacement lock pathname when the original writer releases', async () => {
    const { layout } = await initializeUltraStorageV2({
      runRoot,
      runDefinition: runDefinition(),
    })
    let replacement: CoordinatorWriterLockMetadata | null = null
    await expect(
      withUltraCoordinatorWriter({
        runRoot,
        ownerId: 'coordinator-a',
        action: async (writer) => {
          replacement = {
            ...writer.lock,
            token: 'replacement-lock-token',
            ownerId: 'replacement-coordinator',
          }
          await unlink(layout.writerLockPath)
          await writeFile(layout.writerLockPath, `${canonicalJson(replacement)}\n`, { flag: 'wx' })
        },
      }),
    ).rejects.toMatchObject({ code: 'writer_lock_replaced' })

    expect(await inspectCoordinatorWriterLock(runRoot)).toEqual(replacement)
    await unlink(layout.writerLockPath)
  })

  it('requires explicit, token-bound, audited recovery of a stale writer lock', async () => {
    const { layout } = await initializeUltraStorageV2({
      runRoot,
      runDefinition: runDefinition(),
    })
    const staleLock: CoordinatorWriterLockMetadata = {
      storageVersion: ULTRA_STORAGE_V2_VERSION,
      lockVersion: '1.0.0',
      token: 'stale-lock-token',
      ownerId: 'abandoned-coordinator',
      processId: 2_147_483_000,
      host: 'abandoned-host',
      acquiredAt: '2026-08-02T10:00:00.000Z',
    }
    await writeFile(layout.writerLockPath, `${canonicalJson(staleLock)}\n`, { flag: 'wx' })

    await expect(
      recoverStaleCoordinatorWriterLock({
        runRoot,
        expectedToken: staleLock.token,
        recoveredBy: 'operator',
        reason: 'Threshold check',
        staleAfterMs: 3 * 60 * 60 * 1_000,
        recoveredAt: FIXED_TIME,
      }),
    ).rejects.toMatchObject({ code: 'writer_lock_not_stale' })
    await expect(
      recoverStaleCoordinatorWriterLock({
        runRoot,
        expectedToken: 'wrong-token',
        recoveredBy: 'operator',
        reason: 'Test recovery',
        staleAfterMs: 60_000,
        recoveredAt: FIXED_TIME,
      }),
    ).rejects.toMatchObject({ code: 'writer_lock_token_mismatch' })
    const recovered = await recoverStaleCoordinatorWriterLock({
      runRoot,
      expectedToken: staleLock.token,
      recoveredBy: 'operator',
      reason: 'Confirmed abandoned coordinator process',
      staleAfterMs: 60_000,
      recoveredAt: FIXED_TIME,
    })

    expect(await inspectCoordinatorWriterLock(runRoot)).toBeNull()
    expect(JSON.parse(await readFile(recovered.archivedLockPath, 'utf8'))).toEqual(staleLock)
    expect(JSON.parse(await readFile(recovered.recoveryRecordPath, 'utf8'))).toMatchObject({
      recoveredBy: 'operator',
      reason: 'Confirmed abandoned coordinator process',
      lock: staleLock,
    })
    await expect(
      appendUltraStorageEvent({
        runRoot,
        ownerId: 'replacement-coordinator',
        event: { type: 'phase_started', recordedAt: FIXED_TIME, payload: {} },
      }),
    ).resolves.toMatchObject({ event: { sequence: 1 } })
  })

  it('does not archive a replacement lock under stale recovery authority for an older token', async () => {
    const { layout } = await initializeUltraStorageV2({
      runRoot,
      runDefinition: runDefinition(),
    })
    const staleLock: CoordinatorWriterLockMetadata = {
      storageVersion: ULTRA_STORAGE_V2_VERSION,
      lockVersion: '1.0.0',
      token: 'old-stale-token',
      ownerId: 'old-owner',
      processId: 2_147_483_000,
      host: 'abandoned-host',
      acquiredAt: '2026-08-02T10:00:00.000Z',
    }
    await writeFile(layout.writerLockPath, `${canonicalJson(staleLock)}\n`, { flag: 'wx' })
    const authorized = await inspectCoordinatorWriterLock(runRoot)
    await unlink(layout.writerLockPath)
    const replacement = { ...staleLock, token: 'new-lock-token', ownerId: 'new-owner' }
    await writeFile(layout.writerLockPath, `${canonicalJson(replacement)}\n`, { flag: 'wx' })

    await expect(
      recoverStaleCoordinatorWriterLock({
        runRoot,
        expectedToken: authorized?.token ?? '',
        recoveredBy: 'operator',
        reason: 'Attempted recovery of old lock',
        staleAfterMs: 60_000,
        recoveredAt: FIXED_TIME,
      }),
    ).rejects.toMatchObject({ code: 'writer_lock_token_mismatch' })
    expect(await inspectCoordinatorWriterLock(runRoot)).toEqual(replacement)
    expect(await readdir(layout.recoveredLockDirectory)).toEqual([])
    await unlink(layout.writerLockPath)
  })

  it('publishes a gzip checkpoint atomically and replays only later events', async () => {
    const { layout } = await initializeUltraStorageV2({
      runRoot,
      runDefinition: runDefinition(),
    })
    const checkpointResult = await withUltraCoordinatorWriter({
      runRoot,
      ownerId: 'coordinator-a',
      action: async (writer) => {
        const first = await writer.appendMany([
          { type: 'attempt_started', recordedAt: FIXED_TIME, payload: { amount: 2 } },
          { type: 'attempt_validated', recordedAt: FIXED_TIME, payload: { amount: 3 } },
        ])
        const stateAtCheckpoint = first
          .map((receipt) => receipt.event)
          .reduce(incrementReducer, { count: 0, eventTypes: [] as string[] })
        const checkpoint = await writer.writeCheckpoint(
          stateAtCheckpoint,
          '2026-08-02T12:01:00.000Z',
        )
        await writer.append({
          type: 'chunk_completed',
          recordedAt: '2026-08-02T12:02:00.000Z',
          payload: { amount: 5 },
        })
        return checkpoint
      },
    })
    const gzipBytes = await readFile(checkpointResult.path)
    expect([...gzipBytes.subarray(0, 2)]).toEqual([0x1f, 0x8b])
    expect(await readdir(layout.checkpointDirectory)).toEqual([
      expect.stringMatching(/^checkpoint-000000000002-/u),
    ])

    let reducerCalls = 0
    const reconstructed = await reconstructUltraState({
      runRoot,
      initialState: { count: 0, eventTypes: [] as string[] },
      reducer: (state, event) => {
        reducerCalls += 1
        return incrementReducer(state, event)
      },
    })
    expect(reconstructed.checkpointSequence).toBe(2)
    expect(reconstructed.checkpointPath).toBe(checkpointResult.path)
    expect(reducerCalls).toBe(3)
    expect(reconstructed.state).toEqual({
      count: 10,
      eventTypes: ['attempt_started', 'attempt_validated', 'chunk_completed'],
    })
  })

  it('ignores an unpublished checkpoint dot-temp while using valid checkpoints', async () => {
    const { layout } = await initializeUltraStorageV2({
      runRoot,
      runDefinition: runDefinition(),
    })
    const checkpointResult = await withUltraCoordinatorWriter({
      runRoot,
      ownerId: 'coordinator-a',
      action: async (writer) => {
        await writer.append({
          type: 'attempt_started',
          recordedAt: FIXED_TIME,
          payload: { amount: 4 },
        })
        return writer.writeCheckpoint(
          { count: 4, eventTypes: ['attempt_started'] },
          '2026-08-02T12:01:00.000Z',
        )
      },
    })
    const temporaryPath = join(
      layout.checkpointDirectory,
      `.${basename(checkpointResult.path)}.00000000-0000-4000-8000-000000000000.tmp`,
    )
    const partialBytes = Buffer.from('interrupted unpublished checkpoint')
    await writeFile(temporaryPath, partialBytes)

    await expect(loadLatestUltraCheckpoint(runRoot)).resolves.toMatchObject({
      path: checkpointResult.path,
      checkpoint: { sequence: 1 },
    })
    await expect(
      reconstructUltraState({
        runRoot,
        initialState: { count: 0, eventTypes: [] as string[] },
        reducer: incrementReducer,
      }),
    ).resolves.toMatchObject({
      state: { count: 4, eventTypes: ['attempt_started'] },
      checkpointSequence: 1,
    })
    expect(await readFile(temporaryPath)).toEqual(partialBytes)
  })

  it('writes interval and optional clean-shutdown checkpoints through explicit cadence', async () => {
    await initializeUltraStorageV2({ runRoot, runDefinition: runDefinition() })
    const cadence = new UltraCheckpointCadenceController({
      eventInterval: 2,
      checkpointOnCleanShutdown: true,
    })
    const results = await withUltraCoordinatorWriter({
      runRoot,
      ownerId: 'coordinator-a',
      action: async (writer) => {
        let state = { count: 0, eventTypes: [] as string[] }
        const first = await writer.append({
          type: 'attempt_started',
          recordedAt: FIXED_TIME,
          payload: { amount: 1 },
        })
        state = incrementReducer(state, first.event)
        const notDue = await writeUltraCheckpointIfDue({ writer, cadence, state })

        const second = await writer.append({
          type: 'attempt_validated',
          recordedAt: FIXED_TIME,
          payload: { amount: 2 },
        })
        state = incrementReducer(state, second.event)
        const interval = await writeUltraCheckpointIfDue({
          writer,
          cadence,
          state,
          createdAt: '2026-08-02T12:01:00.000Z',
        })

        const third = await writer.append({
          type: 'chunk_completed',
          recordedAt: FIXED_TIME,
          payload: { amount: 3 },
        })
        state = incrementReducer(state, third.event)
        const shutdown = await writeUltraCheckpointIfDue({
          writer,
          cadence,
          state,
          cleanShutdown: true,
          createdAt: '2026-08-02T12:02:00.000Z',
        })
        const duplicateShutdown = await writeUltraCheckpointIfDue({
          writer,
          cadence,
          state,
          cleanShutdown: true,
        })
        return { notDue, interval, shutdown, duplicateShutdown }
      },
    })

    expect(results.notDue).toBeNull()
    expect(results.interval).toMatchObject({
      reason: 'event_interval',
      checkpoint: { sequence: 2 },
    })
    expect(results.shutdown).toMatchObject({
      reason: 'clean_shutdown',
      checkpoint: { sequence: 3 },
    })
    expect(results.duplicateShutdown).toBeNull()
    expect(cadence.checkpointSequence).toBe(3)
    await expect(
      reconstructUltraState({
        runRoot,
        initialState: { count: 0, eventTypes: [] as string[] },
        reducer: incrementReducer,
      }),
    ).resolves.toMatchObject({
      state: {
        count: 6,
        eventTypes: ['attempt_started', 'attempt_validated', 'chunk_completed'],
      },
      checkpointSequence: 3,
    })

    const cadenceWithoutShutdown = new UltraCheckpointCadenceController({ eventInterval: 10 })
    expect(
      cadenceWithoutShutdown.reasonDue(
        { sequence: 1, eventHash: 'a'.repeat(64), eventLogBytes: 1 },
        { cleanShutdown: true },
      ),
    ).toBeNull()
  })

  it('rejects a checkpoint whose caller-supplied state differs from deterministic replay', async () => {
    await initializeUltraStorageV2({ runRoot, runDefinition: runDefinition() })
    await withUltraCoordinatorWriter({
      runRoot,
      ownerId: 'coordinator-a',
      action: async (writer) => {
        await writer.append({
          type: 'attempt_started',
          recordedAt: FIXED_TIME,
          payload: { amount: 1 },
        })
        await writer.writeCheckpoint({ count: 999, eventTypes: [] }, FIXED_TIME)
      },
    })

    await expect(
      reconstructUltraState({
        runRoot,
        initialState: { count: 0, eventTypes: [] as string[] },
        reducer: incrementReducer,
      }),
    ).rejects.toMatchObject({ code: 'checkpoint_state_replay_mismatch' })
  })

  it('writes a clearly noncanonical progress projection at the current event head', async () => {
    const { layout } = await initializeUltraStorageV2({
      runRoot,
      runDefinition: runDefinition(),
    })
    const summary = await withUltraCoordinatorWriter({
      runRoot,
      ownerId: 'coordinator-a',
      action: async (writer) => {
        await writer.append({
          type: 'phase_started',
          recordedAt: FIXED_TIME,
          payload: { phaseId: 'corpus-a' },
        })
        return writer.writeProgressSummary(
          { completedChunks: 0, nextChunk: 'corpus-a-00000' },
          FIXED_TIME,
        )
      },
    })

    expect(summary).toMatchObject({
      canonical: false,
      basedOnEventSequence: 1,
      projection: { completedChunks: 0, nextChunk: 'corpus-a-00000' },
    })
    expect(JSON.parse(await readFile(layout.progressSummaryPath, 'utf8'))).toEqual(summary)
    expect(summary.notice).toMatch(/projection only/u)
  })

  it('stores 5,294 chunks once and 10,000 transitions as bounded events without manifest copies', async () => {
    const definition = runDefinition(5_294)
    const { layout, definitionSha256 } = await initializeUltraStorageV2({
      runRoot,
      runDefinition: definition,
    })
    const definitionBytesBefore = await readFile(layout.runDefinitionPath)
    const transitions = Array.from({ length: 10_000 }, (_, index) => ({
      type: 'attempt_started' as const,
      recordedAt: FIXED_TIME,
      payload: {
        chunkId: definition.packetInventory[index % definition.packetInventory.length].chunkId,
        attemptOrdinal: index + 1,
      },
    }))
    const receipts = await withUltraCoordinatorWriter({
      runRoot,
      ownerId: 'scaling-test-coordinator',
      action: (writer) => writer.appendMany(transitions),
    })
    const eventLogBytes = await readFile(layout.eventLogPath)
    const footprint = await ultraStorageFootprint(runRoot)

    expect(receipts).toHaveLength(10_000)
    expect(Math.max(...receipts.map((receipt) => receipt.bytesWritten))).toBeLessThan(512)
    expect(receipts.every((receipt) => receipt.bytesWritten <= MAX_EVENT_BYTES)).toBe(true)
    expect(eventLogBytes.length).toBe(
      receipts.reduce((total, receipt) => total + receipt.bytesWritten, 0),
    )
    expect(eventLogBytes.length).toBeLessThan(8 * 1024 * 1024)
    expect(eventLogBytes.toString('utf8')).not.toContain('packetInventory')
    expect(await readFile(layout.runDefinitionPath)).toEqual(definitionBytesBefore)
    expect((await readUltraRunDefinition(runRoot)).definitionSha256).toBe(definitionSha256)
    expect(footprint.filter((file) => file.path.endsWith(RUN_DEFINITION_FILENAME))).toHaveLength(1)
    expect(footprint.some((file) => /manifest-history|snapshot/u.test(file.path))).toBe(false)
    expect(footprint.filter((file) => file.path.endsWith('.json.gz'))).toHaveLength(0)
    expect((await readUltraEventLog(runRoot)).at(-1)).toMatchObject({ sequence: 10_000 })
  })
})
