/** @jest-environment node */
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { canonicalJson } from '../literature-production-ingest/canonical'
import { runLunaTriageCli } from './cli'
import { syntheticCorpusRecord, syntheticResponseBody, syntheticStageAOutput } from './fixtures'
import { appendJsonlRows, createOperation, operationPaths } from './operation'
import { buildPacket, type OperationSalt } from './packet'
import { exclusiveWriteFile, resolveStateRoot } from './state'

/**
 * An end-to-end pass over the offline pipeline: a synthetic pilot operation goes through
 * ingest → route → evaluate → review-queue → audit-sample entirely through the CLI, with no
 * Docker, no network, and no artifact reads outside the temporary state directory.
 */

const SALT: OperationSalt = {
  version: 'literature-luna-record-id/1.0.0',
  saltHex: '5'.repeat(64),
}

let root: string
let stateDir: string
const printed: string[] = []
let writeSpy: jest.SpyInstance

beforeAll(() => {
  writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
    printed.push(String(chunk))
    return true
  }) as never)
})

afterAll(() => {
  writeSpy.mockRestore()
})

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'luna-cli-'))
  stateDir = join(root, 'lane')
  printed.length = 0
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('cli dispatch', () => {
  it('rejects unknown commands with usage help', async () => {
    await expect(runLunaTriageCli(['no-such-command'])).rejects.toThrow(/Usage:/u)
  })

  it('requires flag values to be present', async () => {
    await expect(runLunaTriageCli(['ingest', '--state-dir', stateDir])).rejects.toThrow(
      /--operation is required/u,
    )
  })
})

describe('offline pipeline end to end', () => {
  it('ingests, routes, evaluates, queues, and samples a synthetic pilot operation', async () => {
    const state = await resolveStateRoot(stateDir)
    const paths = await createOperation(state, 'op-pilot', 'pilot-1000', 'test', 'now')

    const clean = buildPacket(SALT, syntheticCorpusRecord('900000201', { title: 'Dental caries' }))
    const risky = buildPacket(
      SALT,
      syntheticCorpusRecord('900000202', { title: 'Pleural catheter outcomes' }),
    )
    const silent = buildPacket(SALT, syntheticCorpusRecord('900000203', { title: 'Crop yields' }))
    const broken = buildPacket(SALT, syntheticCorpusRecord('900000204', { title: 'Ore smelting' }))

    const built = [clean, risky, silent, broken]
    await appendJsonlRows(
      paths.packetsJsonl,
      built.map((item) => item.packet),
    )
    await appendJsonlRows(
      paths.mappingJsonl,
      built.map((item) => item.mapping),
    )
    await appendJsonlRows(
      paths.riskFlagsJsonl,
      built.map((item) => ({ recordId: item.mapping.recordId, riskFlags: item.riskFlags })),
    )
    await appendJsonlRows(
      paths.requestsJsonl,
      built.map((item) => ({
        customId: item.mapping.recordId,
        bodySha256: 'a'.repeat(64),
        body: { model: 'gpt-5.6-luna' },
      })),
    )
    // Ledger: three requests were actually attempted; `silent` never was.
    await appendJsonlRows(
      paths.ledgerJsonl,
      [clean, risky, broken].map((item) => ({
        customId: item.mapping.recordId,
        requestSha256: 'a'.repeat(64),
        responseSha256: null,
        httpStatus: 200,
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        estimatedCostUsd: 0,
        error: null,
        at: 'now',
      })),
    )
    await exclusiveWriteFile(
      join(paths.rawResponsesDir, `${clean.mapping.recordId}.json`),
      syntheticResponseBody(
        syntheticStageAOutput(clean.mapping.recordId, 'obvious_irrelevant', 'high', [
          'clearly_nonpulmonary_domain',
        ]),
      ),
    )
    await exclusiveWriteFile(
      join(paths.rawResponsesDir, `${risky.mapping.recordId}.json`),
      syntheticResponseBody(
        syntheticStageAOutput(risky.mapping.recordId, 'obvious_irrelevant', 'high', [
          'clearly_nonpulmonary_domain',
        ]),
      ),
    )
    await exclusiveWriteFile(
      join(paths.rawResponsesDir, `${broken.mapping.recordId}.json`),
      'not even json',
    )

    await runLunaTriageCli(['ingest', '--state-dir', stateDir, '--operation', 'op-pilot'])
    const ingestReport = JSON.parse(await readFile(paths.ingestionReportJson, 'utf8')) as Record<
      string,
      unknown
    >
    expect(ingestReport.selected).toBe(4)
    expect(ingestReport.attempted).toBe(3)
    expect((ingestReport.stateCounts as Record<string, number>).valid_prediction).toBe(2)
    expect((ingestReport.stateCounts as Record<string, number>).invalid_quarantined).toBe(1)
    expect((ingestReport.stateCounts as Record<string, number>).no_attempt).toBe(1)
    const quarantined = await readdir(paths.quarantineDir)
    expect(quarantined.length).toBe(1)

    await runLunaTriageCli(['route', '--state-dir', stateDir, '--operation', 'op-pilot'])
    const routingManifest = JSON.parse(await readFile(paths.routingManifestJson, 'utf8')) as Record<
      string,
      Record<string, number>
    >
    expect(routingManifest.byRoute.deprioritization_candidate).toBe(1)
    expect(routingManifest.byRoute.advance_to_full_relevance_classification).toBe(3)

    await runLunaTriageCli(['evaluate', '--state-dir', stateDir, '--operation', 'op-pilot'])
    const evaluation = JSON.parse(await readFile(paths.evaluationReportJson, 'utf8')) as Record<
      string,
      unknown
    >
    expect(evaluation.truthAvailable).toBe(false)
    expect((evaluation.denominators as Record<string, number>).selected).toBe(4)

    await runLunaTriageCli(['review-queue', '--state-dir', stateDir, '--operation', 'op-pilot'])
    const queue = JSON.parse(await readFile(paths.reviewQueueJson, 'utf8')) as Record<
      string,
      string[]
    >
    expect(queue.highConfidenceNegativeRecordIds).toHaveLength(2)
    expect(queue.mandatoryReviewRecordIds).toEqual([risky.mapping.recordId])
    expect(queue.deprioritizationCandidateRecordIds).toEqual([clean.mapping.recordId])

    await runLunaTriageCli([
      'audit-sample',
      '--state-dir',
      stateDir,
      '--operation',
      'op-pilot',
      '--sample-size',
      '5',
    ])
    const sample = JSON.parse(await readFile(paths.auditSampleJson, 'utf8')) as {
      entries: readonly { recordId: string }[]
      poolSize: number
    }
    expect(sample.poolSize).toBe(1)
    expect(sample.entries.map((entry) => entry.recordId)).toEqual([clean.mapping.recordId])

    // The synthetic PMIDs must never appear on stdout: aggregates only.
    const allOutput = printed.join('')
    for (const item of built) {
      expect(allOutput).not.toContain(item.mapping.pmid)
    }
  })

  it('refuses to double-ingest an operation: artifacts are create-once', async () => {
    const state = await resolveStateRoot(stateDir)
    const paths = await createOperation(state, 'op-once', 'pilot-1000', 'test', 'now')
    const built = buildPacket(SALT, syntheticCorpusRecord('900000210'))
    await appendJsonlRows(paths.packetsJsonl, [built.packet])
    await appendJsonlRows(paths.mappingJsonl, [built.mapping])
    await appendJsonlRows(paths.riskFlagsJsonl, [
      { recordId: built.mapping.recordId, riskFlags: built.riskFlags },
    ])
    await appendJsonlRows(paths.requestsJsonl, [
      { customId: built.mapping.recordId, bodySha256: 'a'.repeat(64), body: {} },
    ])
    await runLunaTriageCli(['ingest', '--state-dir', stateDir, '--operation', 'op-once'])
    await expect(
      runLunaTriageCli(['ingest', '--state-dir', stateDir, '--operation', 'op-once']),
    ).rejects.toThrow(/not overwritten/u)
  })
})

/**
 * The generic inference commands must refuse the locked cohort by its declared label, before
 * they get anywhere near a spend gate. The reproduction at the previous head reached the
 * `--confirm-api-spend` check with a locked-sanity operation, i.e. nothing about the cohort
 * had been consulted at all.
 */
describe('generic commands refuse the locked cohort', () => {
  async function lockedOperation(operationId: string) {
    const state = await resolveStateRoot(stateDir)
    const paths = await createOperation(state, operationId, 'locked-sanity-200', 'test', 'now')
    const built = [
      buildPacket(SALT, syntheticCorpusRecord('900000301', { title: 'Dental caries' })),
      buildPacket(SALT, syntheticCorpusRecord('900000302', { title: 'Crop yields' })),
    ]
    await appendJsonlRows(
      paths.packetsJsonl,
      built.map((item) => item.packet),
    )
    await appendJsonlRows(
      paths.mappingJsonl,
      built.map((item) => item.mapping),
    )
    await appendJsonlRows(
      paths.requestsJsonl,
      built.map((item) => ({
        customId: item.mapping.recordId,
        bodySha256: 'a'.repeat(64),
        body: { model: 'gpt-5.6-luna' },
      })),
    )
    return { state, paths }
  }

  it.each([
    ['run-sync', ['run-sync', '--max-records', '10', '--max-estimated-cost-usd', '10']],
    ['batch-prepare', ['batch-prepare']],
    ['batch-submit', ['batch-submit', '--shard', 'shard-0000-000000000000.jsonl']],
  ])('refuses a locked-sanity operation on %s', async (label, command) => {
    await lockedOperation(`op-locked-${label}`)
    await expect(
      runLunaTriageCli([...command, '--state-dir', stateDir, '--operation', `op-locked-${label}`]),
    ).rejects.toThrow(/locked-sanity-200 cohort/u)
  })

  it('still runs a non-locked cohort through the same command up to the spend gate', async () => {
    const state = await resolveStateRoot(stateDir)
    const paths = await createOperation(state, 'op-dev', 'development-430', 'test', 'now')
    const built = buildPacket(SALT, syntheticCorpusRecord('900000305'))
    await appendJsonlRows(paths.packetsJsonl, [built.packet])
    await appendJsonlRows(paths.mappingJsonl, [built.mapping])
    await appendJsonlRows(paths.requestsJsonl, [
      { customId: built.mapping.recordId, bodySha256: 'a'.repeat(64), body: {} },
    ])
    // Not a locked refusal: the command proceeds past the cohort gate and stops later, on
    // this fixture's deliberately stale stored request digest.
    await expect(
      runLunaTriageCli(['run-sync', '--state-dir', stateDir, '--operation', 'op-dev']),
    ).rejects.toThrow(/prepared surface drifted/u)
  })
})

/**
 * Batch status and fetch derive their Batch id from a validated local submission receipt. An
 * arbitrary id supplied on the command line has no receipt, and therefore no authority.
 */
describe('receipt-bound Batch identifiers', () => {
  it('refuses a status or fetch for a Batch this operation never submitted', async () => {
    const state = await resolveStateRoot(stateDir)
    await createOperation(state, 'op-batch', 'pilot-1000', 'test', 'now')
    for (const command of ['batch-status', 'batch-fetch']) {
      await expect(
        runLunaTriageCli([
          command,
          '--state-dir',
          stateDir,
          '--operation',
          'op-batch',
          '--batch-id',
          'batch_never_submitted',
          '--max-records',
          '1',
          '--max-estimated-cost-usd',
          '1',
        ]),
      ).rejects.toThrow(/no validated submission receipt/u)
    }
  })

  it('refuses a traversal or otherwise unsafe Batch id before any lookup', async () => {
    const state = await resolveStateRoot(stateDir)
    await createOperation(state, 'op-batch2', 'pilot-1000', 'test', 'now')
    for (const batchId of ['../../escape', '/etc/passwd', 'batch%2Fescape', 'batch id']) {
      await expect(
        runLunaTriageCli([
          'batch-fetch',
          '--state-dir',
          stateDir,
          '--operation',
          'op-batch2',
          '--batch-id',
          batchId,
          '--max-records',
          '1',
          '--max-estimated-cost-usd',
          '1',
        ]),
      ).rejects.toThrow()
    }
    // No artifact was created for any refused id.
    const paths = operationPaths(state, 'op-batch2')
    expect(await readdir(paths.batchRawDir)).toHaveLength(0)
    expect(await readdir(paths.batchReceiptsDir)).toHaveLength(0)
  })
})

describe('locked-run marker discipline', () => {
  it('refuses a second locked run at the same canonical identity', async () => {
    const state = await resolveStateRoot(stateDir)
    const markerDir = join(state.root, 'freeze', 'locked-runs')
    await expect(readdir(markerDir)).rejects.toThrow()
    await exclusiveWriteFile(join(state.root, 'corpus-identity.json'), canonicalJson({}))
    // The marker path is create-once, and its name is the locked-run identity digest, so a
    // relocated receipt cannot land anywhere else.
    const { mkdir } = await import('node:fs/promises')
    await mkdir(markerDir, { recursive: true, mode: 0o700 })
    const marker = join(markerDir, `${'a'.repeat(64)}.marker.json`)
    await exclusiveWriteFile(marker, '{}\n')
    await expect(exclusiveWriteFile(marker, '{}\n')).rejects.toThrow(/not overwritten/u)
  })
})

describe('operation paths guardrail', () => {
  it('never resolves an operation outside the state root', async () => {
    const state = await resolveStateRoot(stateDir)
    expect(() => operationPaths(state, '..')).toThrow()
  })
})
