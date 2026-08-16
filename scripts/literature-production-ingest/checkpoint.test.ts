/** @jest-environment node */

import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  CheckpointIntegrityError,
  CheckpointLeaseExistsError,
  CheckpointStore,
  ImmutableArtifactExistsError,
  acquireCheckpointLease,
  checkpointChecksum,
  receiptChecksum,
  writeReceiptImmutable,
} from './checkpoint'
import { createCheckpoint } from './engine'
import type { Checkpoint } from './types'

const DIGEST = 'a'.repeat(64)
const MANIFEST_DIGEST = 'b'.repeat(64)
const CREATED_AT = '2026-08-15T12:00:00.000Z'
const UPDATED_AT = '2026-08-15T12:01:00.000Z'

function fixtureCheckpoint(): Checkpoint {
  return createCheckpoint({
    mode: 'canary',
    projection: { recordCount: 25, duplicateOccurrences: 0, checksum: DIGEST },
    limits: { recordBatchLimit: 10, byteBatchLimit: 4096, concurrency: 1 },
    canaryManifestChecksum: MANIFEST_DIGEST,
    operationId: 'operation-fixture',
    now: CREATED_AT,
  })
}

async function workspace() {
  const directory = await mkdtemp(join(tmpdir(), 'literature-checkpoint-test-'))
  directories.push(directory)
  return directory
}

const directories: string[] = []

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

describe('CheckpointStore', () => {
  it('creates, caches, loads, and durably updates a checksummed checkpoint', async () => {
    const directory = await workspace()
    const path = join(directory, 'checkpoint.json')
    const store = new CheckpointStore(path, { clock: () => UPDATED_AT })
    const initial = fixtureCheckpoint()

    await store.create(initial)
    expect(store.current()).toEqual(initial)
    const updated = await store.update((draft) => {
      draft.phase = 'running'
      draft.counters.inserted = 2
    })

    expect(updated.phase).toBe('running')
    expect(updated.updatedAt).toBe(UPDATED_AT)
    expect(updated.counters.inserted).toBe(2)
    expect((await stat(path)).mode & 0o777).toBe(0o600)

    const loaded = await new CheckpointStore(path).load()
    expect(loaded).toEqual(updated)
    const envelope = JSON.parse(await readFile(path, 'utf8')) as {
      checkpoint: Checkpoint
      checkpointChecksum: string
    }
    expect(envelope.checkpointChecksum).toBe(checkpointChecksum(envelope.checkpoint))
    expect(await readdir(directory)).toEqual(['checkpoint.json'])
  })

  it('serializes concurrent updates, including across store instances for the same path', async () => {
    const directory = await workspace()
    const path = join(directory, 'checkpoint.json')
    const first = new CheckpointStore(path, { clock: () => UPDATED_AT })
    const second = new CheckpointStore(path, { clock: () => UPDATED_AT })
    await first.create(fixtureCheckpoint())

    let releaseFirst!: () => void
    let announceFirst!: () => void
    const firstStarted = new Promise<void>((resolvePromise) => {
      announceFirst = resolvePromise
    })
    const firstMayFinish = new Promise<void>((resolvePromise) => {
      releaseFirst = resolvePromise
    })
    const updateOne = first.update(async (draft) => {
      announceFirst()
      await firstMayFinish
      draft.counters.inserted += 1
    })
    await firstStarted
    const updateTwo = second.update((draft) => {
      draft.counters.inserted += 1
    })
    releaseFirst()
    await Promise.all([updateOne, updateTwo])

    expect((await first.load()).counters.inserted).toBe(2)
  })

  it('detects content tampering and refuses immutable identity changes', async () => {
    const directory = await workspace()
    const path = join(directory, 'checkpoint.json')
    const store = new CheckpointStore(path, { clock: () => UPDATED_AT })
    await store.create(fixtureCheckpoint())

    const envelope = JSON.parse(await readFile(path, 'utf8')) as {
      checkpoint: Checkpoint
      checkpointChecksum: string
    }
    envelope.checkpoint.phase = 'completed'
    await writeFile(path, JSON.stringify(envelope), 'utf8')
    await expect(new CheckpointStore(path).load()).rejects.toBeInstanceOf(CheckpointIntegrityError)

    await writeFile(
      path,
      `${JSON.stringify({
        checkpoint: fixtureCheckpoint(),
        checkpointChecksum: checkpointChecksum(fixtureCheckpoint()),
      })}\n`,
      'utf8',
    )
    await expect(
      store.update((draft) => ({ ...draft, operationId: 'different-operation' })),
    ).rejects.toThrow(/immutable identity/iu)
  })

  it('rejects checkpoint PMID fields, request bodies, and credential-shaped values', async () => {
    const directory = await workspace()
    const cases: Checkpoint[] = []

    const withPmids = fixtureCheckpoint() as Checkpoint & { canaryPmids: string[] }
    withPmids.canaryPmids = ['synthetic-identifier']
    cases.push(withPmids)

    const withBody = fixtureCheckpoint() as Checkpoint & { requestBody: object }
    withBody.requestBody = { value: 'not-persistable' }
    cases.push(withBody)

    const withSecret = fixtureCheckpoint()
    withSecret.batchIdentity.sourceFilename = 'sb_secret_EXAMPLE_SHOULD_BE_REDACTED'
    cases.push(withSecret)

    for (const [index, checkpoint] of cases.entries()) {
      const store = new CheckpointStore(join(directory, `unsafe-${index}.json`))
      await expect(store.create(checkpoint)).rejects.toBeInstanceOf(CheckpointIntegrityError)
    }
  })

  it('does not overwrite an existing checkpoint on create', async () => {
    const directory = await workspace()
    const store = new CheckpointStore(join(directory, 'checkpoint.json'))
    await store.create(fixtureCheckpoint())
    await expect(store.create(fixtureCheckpoint())).rejects.toBeInstanceOf(
      ImmutableArtifactExistsError,
    )
  })
})

describe('immutable receipts', () => {
  it('writes a checksum-verified receipt once with private file permissions', async () => {
    const directory = await workspace()
    const path = join(directory, 'receipt.json')
    const body = {
      schemaVersion: 'fixture-receipt/1.0.0',
      operationId: 'operation-fixture',
      outcome: 'completed',
    }
    const receipt = { ...body, receiptChecksum: receiptChecksum(body) }

    await writeReceiptImmutable(path, receipt)
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(receipt)
    await expect(writeReceiptImmutable(path, receipt)).rejects.toBeInstanceOf(
      ImmutableArtifactExistsError,
    )
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(receipt)
  })

  it('rejects a mismatched checksum and credential-shaped receipt content', async () => {
    const directory = await workspace()
    const path = join(directory, 'receipt.json')
    await expect(
      writeReceiptImmutable(path, {
        operationId: 'operation-fixture',
        receiptChecksum: DIGEST,
      }),
    ).rejects.toThrow(/does not match/iu)

    const unsafeBody = {
      operationId: 'operation-fixture',
      note: 'sb_secret_EXAMPLE_SHOULD_NOT_PERSIST',
    }
    await expect(
      writeReceiptImmutable(path, {
        ...unsafeBody,
        receiptChecksum: receiptChecksum(unsafeBody),
      }),
    ).rejects.toThrow(/credential-shaped/iu)

    const requestBody = { operationId: 'operation-fixture', requestBody: { row: 'unsafe' } }
    await expect(
      writeReceiptImmutable(path, {
        ...requestBody,
        receiptChecksum: receiptChecksum(requestBody),
      }),
    ).rejects.toThrow(/request bodies/iu)
  })
})

describe('exclusive checkpoint operator lease', () => {
  it('fails closed for a concurrent holder and permits a new holder only after release', async () => {
    const directory = await workspace()
    const checkpointPath = join(directory, 'operation.checkpoint.json')
    const first = await acquireCheckpointLease(checkpointPath)

    await expect(acquireCheckpointLease(checkpointPath)).rejects.toBeInstanceOf(
      CheckpointLeaseExistsError,
    )
    expect(await readFile(first.path, 'utf8')).not.toMatch(/pmid|secret|credential/iu)

    await first.release()
    const second = await acquireCheckpointLease(checkpointPath)
    await second.release()
  })
})
