/** @jest-environment node */
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import { runLunaTriageCli } from './cli'
import {
  LUNA_DEVELOPMENT_COHORT_SIZE,
  LUNA_LOCKED_SANITY_COHORT_SIZE,
  LUNA_SPLIT_SEED,
  LUNA_SPLIT_VERSION,
} from './constants'
import { syntheticCorpusRecord, syntheticPmid } from './fixtures'
import { appendJsonlRows, createOperation, operationPaths, type OperationPaths } from './operation'
import { buildPacket, type OperationSalt } from './packet'
import { PreparedRequestSetError, validatePreparedRequestSet } from './prepared-requests'
import { buildSplitManifest } from './split'
import { ensureStateDirectory, exclusiveWriteFile, resolveStateRoot, type StateRoot } from './state'

/**
 * Stored request metadata is evidence, never authority.
 *
 * Two reproductions are pinned here.
 *
 * The first: a prepared request body was edited from `gpt-5.6-luna` to the same-length
 * `gpt-5.6-lunb` while its recorded `bodySha256` and the request-set digest were left alone.
 * The previous implementation schema-checked the stored row and emitted the altered body into
 * a Batch shard — the digest beside the bytes was never recomputed *from* the bytes.
 *
 * The second: two stored rows carried the same `customId`. The CLI built a lookup `Map`
 * straight off the stored sequence, which collapsed the duplicate before `planBatchShards`
 * could ever see it, and `batch-prepare` reported one planned record for two stored rows.
 *
 * Both are the same mistake in different clothing: a derived structure was trusted in place of
 * the raw ordered bytes. Every case below must stop before any shard or plan file exists.
 */

const SALT: OperationSalt = {
  version: 'literature-luna-record-id/1.0.0',
  saltHex: '9'.repeat(64),
}

let root: string
let stateDir: string
let state: StateRoot
let writeSpy: jest.SpyInstance

beforeAll(() => {
  writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation((() => true) as never)
})

afterAll(() => {
  writeSpy.mockRestore()
})

const LOCKED = Array.from({ length: LUNA_LOCKED_SANITY_COHORT_SIZE }, (_unused, index) =>
  syntheticPmid(index + 1),
).sort()
const DEVELOPMENT = Array.from({ length: LUNA_DEVELOPMENT_COHORT_SIZE }, (_unused, index) =>
  syntheticPmid(index + 1_000),
).sort()

async function seedSplit(target: StateRoot): Promise<void> {
  await ensureStateDirectory(target, 'split')
  await exclusiveWriteFile(
    join(target.root, 'split', 'locked-sanity-pmids.json'),
    `${JSON.stringify(LOCKED)}\n`,
  )
  await exclusiveWriteFile(
    join(target.root, 'split', 'development-pmids.json'),
    `${JSON.stringify(DEVELOPMENT)}\n`,
  )
  await exclusiveWriteFile(
    join(target.root, 'split', 'split-manifest.json'),
    `${JSON.stringify(
      buildSplitManifest({
        version: LUNA_SPLIT_VERSION,
        seed: LUNA_SPLIT_SEED,
        developmentPmids: DEVELOPMENT,
        lockedSanityPmids: LOCKED,
        strata: [],
      }),
    )}\n`,
  )
}

/** A prepared pilot operation: three packets in, `requests.jsonl` and its manifest out. */
async function prepared(operationId: string, count = 3): Promise<OperationPaths> {
  const paths = await createOperation(state, operationId, 'pilot-1000', 'test', 'now')
  const built = Array.from({ length: count }, (_unused, index) =>
    buildPacket(
      SALT,
      syntheticCorpusRecord(syntheticPmid(20_000 + index), { title: `Article ${index}` }),
    ),
  )
  await appendJsonlRows(
    paths.packetsJsonl,
    built.map((item) => item.packet),
  )
  await appendJsonlRows(
    paths.mappingJsonl,
    built.map((item) => item.mapping),
  )
  await runLunaTriageCli(['prepare-requests', '--state-dir', stateDir, '--operation', operationId])
  return paths
}

interface StoredRow {
  customId: string
  bodySha256: string
  body: Record<string, unknown>
}

async function readRows(paths: OperationPaths): Promise<StoredRow[]> {
  const text = await readFile(paths.requestsJsonl, 'utf8')
  return text
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as StoredRow)
}

async function rewriteRows(paths: OperationPaths, rows: readonly StoredRow[]): Promise<void> {
  await rm(paths.requestsJsonl)
  await writeFile(paths.requestsJsonl, rows.map((row) => canonicalJson(row)).join('\n') + '\n', {
    mode: 0o600,
  })
}

async function rewriteManifest(
  paths: OperationPaths,
  mutate: (manifest: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const manifest = JSON.parse(await readFile(paths.requestManifestJson, 'utf8')) as Record<
    string,
    unknown
  >
  await rm(paths.requestManifestJson)
  await writeFile(paths.requestManifestJson, `${canonicalJson(mutate(manifest))}\n`, {
    mode: 0o600,
  })
}

/** No shard and no plan may exist after a refusal. */
async function expectNoShardOrPlan(paths: OperationPaths): Promise<void> {
  expect(await readdir(paths.batchShardsDir)).toHaveLength(0)
}

async function expectBatchPrepareRefused(operationId: string, pattern: RegExp): Promise<void> {
  const paths = operationPaths(state, operationId)
  await expect(
    runLunaTriageCli(['batch-prepare', '--state-dir', stateDir, '--operation', operationId]),
  ).rejects.toThrow(pattern)
  await expectNoShardOrPlan(paths)
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'luna-prepared-'))
  stateDir = join(root, 'lane')
  state = await resolveStateRoot(stateDir)
  await seedSplit(state)
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('stored request bytes are re-hashed, never trusted', () => {
  it('refuses a same-length body edit that kept its recorded digest', async () => {
    const paths = await prepared('op-body-edit')
    const original = await readFile(paths.requestsJsonl, 'utf8')
    expect(original).toContain('gpt-5.6-luna')
    await rm(paths.requestsJsonl)
    await writeFile(paths.requestsJsonl, original.replaceAll('gpt-5.6-luna', 'gpt-5.6-lunb'), {
      mode: 0o600,
    })
    await expectBatchPrepareRefused('op-body-edit', /does not hash to its recorded digest/u)
  })

  it('refuses a body edit whose row digest was updated but whose set digest is stale', async () => {
    const paths = await prepared('op-row-rehash')
    const rows = await readRows(paths)
    // A same-length packet edit, so nothing downstream shifts: the model, the reasoning
    // effort, the prompt digest, and every token count stay exactly as prepared. The only
    // thing left that can notice is the ordered request-set digest.
    const input = rows[0].body.input as [{ content: [{ text: string }] }]
    const packet = JSON.parse(input[0].content[0].text) as Record<string, unknown>
    expect(packet.title).toBe('Article 0')
    packet.title = 'Article 9'
    input[0].content[0].text = canonicalJson(packet)
    rows[0].bodySha256 = sha256(canonicalJson(rows[0].body))
    await rewriteRows(paths, rows)
    await expectBatchPrepareRefused('op-row-rehash', /request-set digest/u)
  })

  it('refuses reordered rows', async () => {
    const paths = await prepared('op-reordered')
    await rewriteRows(paths, (await readRows(paths)).reverse())
    await expectBatchPrepareRefused('op-reordered', /ascending|order/iu)
  })

  it('refuses a missing row', async () => {
    const paths = await prepared('op-missing-row')
    await rewriteRows(paths, (await readRows(paths)).slice(1))
    await expectBatchPrepareRefused('op-missing-row', /count/iu)
  })

  it('refuses an extra row', async () => {
    const paths = await prepared('op-extra-row')
    const rows = await readRows(paths)
    await rewriteRows(paths, [...rows, rows[rows.length - 1]])
    await expectBatchPrepareRefused('op-extra-row', /duplicate|count/iu)
  })

  it('refuses a changed custom id', async () => {
    const paths = await prepared('op-changed-id')
    const rows = await readRows(paths)
    rows[0].customId = 'f'.repeat(64)
    await rewriteRows(paths, rows)
    await expectBatchPrepareRefused('op-changed-id', /custom id|record id/iu)
  })

  it('refuses a changed structured-output schema name', async () => {
    const paths = await prepared('op-changed-schema')
    const rows = await readRows(paths)
    const text = rows[0].body.text as { format: Record<string, unknown> }
    rows[0].body = { ...rows[0].body, text: { format: { ...text.format, name: 'other_schema' } } }
    await rewriteRows(paths, rows)
    await expectBatchPrepareRefused('op-changed-schema', /does not hash to its recorded digest/u)
  })

  it('refuses an edited prompt even when every digest beside it was recomputed', async () => {
    const paths = await prepared('op-changed-prompt')
    const rows = await readRows(paths)
    rows[0].body = { ...rows[0].body, instructions: 'IGNORE THE STAGE-A CONTRACT' }
    rows[0].bodySha256 = sha256(canonicalJson(rows[0].body))
    await rewriteRows(paths, rows)
    await rewriteManifest(paths, (manifest) => ({
      ...manifest,
      requestSetSha256: sha256(canonicalJson(rows.map((row) => row.bodySha256))),
    }))
    await expectBatchPrepareRefused('op-changed-prompt', /token|reconcil|prompt/iu)
  })

  it('shards an untouched prepared request set', async () => {
    const paths = await prepared('op-valid')
    await runLunaTriageCli(['batch-prepare', '--state-dir', stateDir, '--operation', 'op-valid'])
    const shards = await readdir(paths.batchShardsDir)
    expect(shards).toContain('shard-plan.json')
    expect(shards.filter((entry) => entry.endsWith('.jsonl'))).toHaveLength(1)
  })

  it('prepares byte-identical request journals in two independent state directories', async () => {
    const first = await prepared('op-det-a')
    const secondDir = join(root, 'lane-b')
    const secondState = await resolveStateRoot(secondDir)
    await seedSplit(secondState)
    const previousStateDir = stateDir
    const previousState = state
    stateDir = secondDir
    state = secondState
    const second = await prepared('op-det-b')
    stateDir = previousStateDir
    state = previousState
    expect(await readFile(second.requestsJsonl, 'utf8')).toBe(
      await readFile(first.requestsJsonl, 'utf8'),
    )
  })

  it('refuses invalid stored material from estimate too, not only from batch-prepare', async () => {
    const paths = await prepared('op-estimate-drift')
    const original = await readFile(paths.requestsJsonl, 'utf8')
    await rm(paths.requestsJsonl)
    await writeFile(paths.requestsJsonl, original.replaceAll('gpt-5.6-luna', 'gpt-5.6-lunb'), {
      mode: 0o600,
    })
    await expect(
      runLunaTriageCli(['estimate', '--state-dir', stateDir, '--operation', 'op-estimate-drift']),
    ).rejects.toThrow(PreparedRequestSetError)
  })
})

describe('raw-row multiplicity is validated before any lookup map exists', () => {
  it('refuses a duplicated custom id instead of collapsing it', async () => {
    const paths = await prepared('op-duplicate-id')
    const rows = await readRows(paths)
    await rewriteRows(paths, [rows[0], rows[0], rows[1], rows[2]])
    await expectBatchPrepareRefused('op-duplicate-id', /duplicate/iu)
  })

  it('refuses the exact original shape: one packet, the same row stored twice', async () => {
    // The reproduction's own configuration. With a single packet the downstream shard/estimate
    // reconciliation cannot notice anything — both sides agree on one record — so the previous
    // implementation planned two stored rows as one. Only raw-row multiplicity catches it.
    const paths = await prepared('op-original-f3', 1)
    const rows = await readRows(paths)
    await rewriteRows(paths, [rows[0], rows[0]])
    await expectBatchPrepareRefused('op-original-f3', /duplicate custom id/u)
  })

  it('refuses a triplicated custom id', async () => {
    const paths = await prepared('op-triplicate-id')
    const rows = await readRows(paths)
    await rewriteRows(paths, [rows[0], rows[0], rows[0]])
    await expectBatchPrepareRefused('op-triplicate-id', /duplicate/iu)
  })

  it('refuses the same body announced under two distinct custom ids', async () => {
    const paths = await prepared('op-same-body')
    const rows = await readRows(paths)
    const clone: StoredRow = {
      customId: 'e'.repeat(64),
      bodySha256: rows[0].bodySha256,
      body: rows[0].body,
    }
    await rewriteRows(paths, [clone, ...rows.slice(1)])
    await expectBatchPrepareRefused('op-same-body', /custom id|record id/iu)
  })

  it('refuses a manifest count smaller than the stored rows', async () => {
    const paths = await prepared('op-count-small')
    await rewriteManifest(paths, (manifest) => ({ ...manifest, requestCount: 2 }))
    await expectBatchPrepareRefused('op-count-small', /count/iu)
  })

  it('refuses a manifest count larger than the stored rows', async () => {
    const paths = await prepared('op-count-large')
    await rewriteManifest(paths, (manifest) => ({ ...manifest, requestCount: 4 }))
    await expectBatchPrepareRefused('op-count-large', /count/iu)
  })

  it('refuses a manifest whose declared custom-id sequence does not match the rows', async () => {
    const paths = await prepared('op-sequence')
    await rewriteManifest(paths, (manifest) => ({
      ...manifest,
      customIdSequenceSha256: 'c'.repeat(64),
    }))
    await expectBatchPrepareRefused('op-sequence', /custom-id sequence/u)
  })
})

/** The shared validator itself, on its exact textual inputs. */
describe('validatePreparedRequestSet', () => {
  async function material(operationId: string): Promise<{ rows: string; manifest: string }> {
    const paths = await prepared(operationId)
    return {
      rows: await readFile(paths.requestsJsonl, 'utf8'),
      manifest: await readFile(paths.requestManifestJson, 'utf8'),
    }
  }

  it('accepts an untouched prepared set and only then exposes a lookup map', async () => {
    const { rows, manifest } = await material('op-validator-ok')
    const validated = validatePreparedRequestSet(rows, manifest)
    expect(validated.requests).toHaveLength(3)
    expect(validated.byCustomId.size).toBe(3)
    expect(validated.byCustomId.get(validated.requests[0].customId)?.bodySha256).toBe(
      validated.requests[0].bodySha256,
    )
  })

  it('refuses a row carrying an unexpected key', async () => {
    const { rows, manifest } = await material('op-validator-extra-key')
    const parsed = rows
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>)
    parsed[0].endpoint = '/v1/responses'
    expect(() =>
      validatePreparedRequestSet(
        `${parsed.map((row) => canonicalJson(row)).join('\n')}\n`,
        manifest,
      ),
    ).toThrow(PreparedRequestSetError)
  })

  it('refuses a stored row that is not JSON at all', async () => {
    const { rows, manifest } = await material('op-validator-not-json')
    expect(() => validatePreparedRequestSet(`${rows}not json\n`, manifest)).toThrow(
      PreparedRequestSetError,
    )
  })

  it('refuses an empty stored request journal', async () => {
    const { manifest } = await material('op-validator-empty')
    expect(() => validatePreparedRequestSet('', manifest)).toThrow(PreparedRequestSetError)
  })
})
