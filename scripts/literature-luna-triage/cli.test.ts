/** @jest-environment node */
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { LUNA_CLI_COMMANDS, WITHHELD_COMMANDS, WithheldCommandError, runLunaTriageCli } from './cli'
import {
  LUNA_DEVELOPMENT_COHORT_SIZE,
  LUNA_LOCKED_SANITY_COHORT_SIZE,
  LUNA_SPLIT_SEED,
  LUNA_SPLIT_VERSION,
} from './constants'
import {
  syntheticCorpusRecord,
  syntheticPmid,
  syntheticResponseBody,
  syntheticStageAOutput,
} from './fixtures'
import { appendJsonlRows, createOperation, operationPaths } from './operation'
import { buildPacket, type OperationSalt } from './packet'
import { buildSplitManifest } from './split'
import { ensureStateDirectory, exclusiveWriteFile, resolveStateRoot, type StateRoot } from './state'

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

/**
 * The locked-sanity 200 and development 430 this state directory will answer membership from.
 * Preparation is only permitted against a valid, canonical, exact-200 authority, so every
 * pathway test that expects to *get through* has to seed one.
 */
const LOCKED_PMIDS = Array.from({ length: LUNA_LOCKED_SANITY_COHORT_SIZE }, (_unused, index) =>
  syntheticPmid(index + 1),
).sort()
const DEVELOPMENT_PMIDS = Array.from({ length: LUNA_DEVELOPMENT_COHORT_SIZE }, (_unused, index) =>
  syntheticPmid(index + 1_000),
).sort()

async function seedValidSplitAuthority(state: StateRoot): Promise<void> {
  await ensureStateDirectory(state, 'split')
  await exclusiveWriteFile(
    join(state.root, 'split', 'locked-sanity-pmids.json'),
    `${JSON.stringify(LOCKED_PMIDS)}\n`,
  )
  await exclusiveWriteFile(
    join(state.root, 'split', 'development-pmids.json'),
    `${JSON.stringify(DEVELOPMENT_PMIDS)}\n`,
  )
  await exclusiveWriteFile(
    join(state.root, 'split', 'split-manifest.json'),
    `${JSON.stringify(
      buildSplitManifest({
        version: LUNA_SPLIT_VERSION,
        seed: LUNA_SPLIT_SEED,
        developmentPmids: DEVELOPMENT_PMIDS,
        lockedSanityPmids: LOCKED_PMIDS,
        strata: [],
      }),
    )}\n`,
  )
}

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
    // Genuine prepared material: ingest reads prepared requests through the same validator
    // every other consumer uses, so a hand-written stand-in would (correctly) be refused.
    await seedValidSplitAuthority(state)
    await runLunaTriageCli(['prepare-requests', '--state-dir', stateDir, '--operation', 'op-pilot'])
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
describe('every preparation command refuses the locked cohort', () => {
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
    return { state, paths }
  }

  it.each([['prepare-requests'], ['estimate'], ['batch-prepare']])(
    'refuses a locked-sanity operation on %s',
    async (command) => {
      await lockedOperation(`op-locked-${command}`)
      await expect(
        runLunaTriageCli([command, '--state-dir', stateDir, '--operation', `op-locked-${command}`]),
      ).rejects.toThrow(/locked-sanity-200 cohort/u)
    },
  )

  it('refuses to build packets for the locked cohort at all', async () => {
    await expect(
      runLunaTriageCli([
        'packets',
        '--state-dir',
        stateDir,
        '--cohort',
        'locked-sanity-200',
        '--operation',
        'op-packets-locked',
      ]),
    ).rejects.toThrow(/locked-sanity-200 cohort/u)
    // The refusal fires before any operation directory exists.
    const state = await resolveStateRoot(stateDir)
    await expect(readdir(operationPaths(state, 'op-packets-locked').root)).rejects.toThrow()
  })

  it('still runs a non-locked cohort through the same command, against a valid authority', async () => {
    const state = await resolveStateRoot(stateDir)
    await seedValidSplitAuthority(state)
    const paths = await createOperation(state, 'op-dev', 'development-430', 'test', 'now')
    const built = buildPacket(SALT, syntheticCorpusRecord('900000305'))
    await appendJsonlRows(paths.packetsJsonl, [built.packet])
    await appendJsonlRows(paths.mappingJsonl, [built.mapping])
    await runLunaTriageCli(['estimate', '--state-dir', stateDir, '--operation', 'op-dev'])
    const report = JSON.parse(printed.join('')) as {
      command: string
      estimate: { records: number }
    }
    expect(report.command).toBe('estimate')
    expect(report.estimate.records).toBe(1)
  })
})

/**
 * The withheld commands are the whole point of this release's narrowing. Each must refuse by
 * name, with its reason, before anything at all happens — no flag parsing, no state
 * directory, no file read, and certainly no transport.
 */
describe('withheld remote-execution and qualification commands', () => {
  const WITHHELD = [
    'run-sync',
    'run-locked',
    'batch-submit',
    'batch-status',
    'batch-fetch',
    'qualify',
    'freeze',
  ]

  it.each(WITHHELD)('refuses %s as withheld', async (command) => {
    await expect(runLunaTriageCli([command])).rejects.toThrow(WithheldCommandError)
    await expect(runLunaTriageCli([command])).rejects.toThrow(/withheld in this release/u)
  })

  it('refuses a withheld command before it can touch the state directory', async () => {
    const state = await resolveStateRoot(stateDir)
    await createOperation(state, 'op-withheld', 'pilot-1000', 'test', 'now')
    for (const command of WITHHELD) {
      await expect(
        runLunaTriageCli([
          command,
          '--state-dir',
          stateDir,
          '--operation',
          'op-withheld',
          '--max-records',
          '1',
          '--max-estimated-cost-usd',
          '1',
        ]),
      ).rejects.toThrow(WithheldCommandError)
    }
    // Nothing was written anywhere in the operation as a side effect of the refusals.
    const paths = operationPaths(state, 'op-withheld')
    expect(await readdir(paths.batchRawDir)).toHaveLength(0)
    expect(await readdir(paths.batchShardsDir)).toHaveLength(0)
    expect(await readdir(paths.rawResponsesDir)).toHaveLength(0)
  })

  it('names every withheld command in the usage help for an unknown command', async () => {
    await expect(runLunaTriageCli(['no-such-command'])).rejects.toThrow(/Withheld in this release/u)
  })

  it('exposes exactly the offline command inventory', () => {
    expect(LUNA_CLI_COMMANDS).toEqual([
      'audit-sample',
      'batch-prepare',
      'estimate',
      'evaluate',
      'ingest',
      'inventory',
      'packets',
      'prepare-requests',
      'review-app',
      'review-queue',
      'route',
      'split',
    ])
    for (const command of Object.keys(WITHHELD_COMMANDS)) {
      expect(LUNA_CLI_COMMANDS).not.toContain(command)
    }
  })
})

describe('operation paths guardrail', () => {
  it('never resolves an operation outside the state root', async () => {
    const state = await resolveStateRoot(stateDir)
    expect(() => operationPaths(state, '..')).toThrow()
  })
})

/**
 * Label versus fact.
 *
 * A cohort label is a claim the operation makes about itself. The membership refusal is the
 * one that matters: an operation calling itself `development-430` while carrying a locked
 * identity must be refused by every preparation command, and the refusal must land before any
 * request bytes, shard, or estimate exists for it.
 */
describe('preparation refuses actual locked membership, not merely the label', () => {
  async function seedSplit(state: StateRoot) {
    await seedValidSplitAuthority(state)
    return { lockedSanity: LOCKED_PMIDS, development: DEVELOPMENT_PMIDS }
  }

  async function relabelledOperation(operationId: string, pmids: readonly string[]) {
    const state = await resolveStateRoot(stateDir)
    const paths = await createOperation(state, operationId, 'development-430', 'test', 'now')
    const built = pmids.map((pmid) => buildPacket(SALT, syntheticCorpusRecord(pmid)))
    await appendJsonlRows(
      paths.packetsJsonl,
      built.map((item) => item.packet),
    )
    await appendJsonlRows(
      paths.mappingJsonl,
      built.map((item) => item.mapping),
    )
    return { state, paths }
  }

  it.each([['prepare-requests'], ['estimate'], ['batch-prepare']])(
    '%s refuses a relabelled operation holding one locked identity',
    async (command) => {
      const state = await resolveStateRoot(stateDir)
      const { lockedSanity, development } = await seedSplit(state)
      const operationId = `op-smuggled-${command}`
      await relabelledOperation(operationId, [development[0], lockedSanity[7]])
      await expect(
        runLunaTriageCli([command, '--state-dir', stateDir, '--operation', operationId]),
      ).rejects.toThrow(/locked-sanity\s+members/u)
      // Nothing was prepared: no requests journal, no shard, no manifest.
      const paths = operationPaths(state, operationId)
      await expect(readFile(paths.requestManifestJson, 'utf8')).rejects.toThrow()
      expect(await readdir(paths.batchShardsDir)).toHaveLength(0)
    },
  )

  it('refuses to answer membership from a truncated locked set rather than passing everything', async () => {
    const state = await resolveStateRoot(stateDir)
    await ensureStateDirectory(state, 'split')
    await exclusiveWriteFile(
      join(state.root, 'split', 'locked-sanity-pmids.json'),
      `${JSON.stringify([syntheticPmid(1)])}\n`,
    )
    await exclusiveWriteFile(join(state.root, 'split', 'development-pmids.json'), '[]\n')
    await exclusiveWriteFile(join(state.root, 'split', 'split-manifest.json'), '{}\n')
    await relabelledOperation('op-truncated', [syntheticPmid(5000)])
    await expect(
      runLunaTriageCli([
        'prepare-requests',
        '--state-dir',
        stateDir,
        '--operation',
        'op-truncated',
      ]),
    ).rejects.toThrow(/not 200/u)
    // The refusal is not a rubber stamp in the other direction either: nothing was prepared.
    await expect(
      readFile(operationPaths(state, 'op-truncated').requestManifestJson, 'utf8'),
    ).rejects.toThrow()
  })

  it('lets the same command through once no locked identity is present', async () => {
    const state = await resolveStateRoot(stateDir)
    await seedSplit(state)
    await relabelledOperation('op-clean', [syntheticPmid(5001), syntheticPmid(5002)])
    await runLunaTriageCli(['prepare-requests', '--state-dir', stateDir, '--operation', 'op-clean'])
    const manifest = JSON.parse(
      await readFile(operationPaths(state, 'op-clean').requestManifestJson, 'utf8'),
    ) as { requestCount: number }
    expect(manifest.requestCount).toBe(2)
  })
})

/**
 * Preparation must be reproducible end to end, not merely inside a unit test: two independent
 * state directories, the same packets, the same prepared bytes and the same plan digest.
 */
describe('offline preparation is deterministic through the CLI', () => {
  async function prepareIn(directory: string, operationId: string) {
    const state = await resolveStateRoot(directory)
    await seedValidSplitAuthority(state)
    const paths = await createOperation(state, operationId, 'pilot-1000', 'test', 'now')
    const built = [5101, 5102, 5103].map((index) =>
      buildPacket(SALT, syntheticCorpusRecord(syntheticPmid(index), { title: `Article ${index}` })),
    )
    await appendJsonlRows(
      paths.packetsJsonl,
      built.map((item) => item.packet),
    )
    await appendJsonlRows(
      paths.mappingJsonl,
      built.map((item) => item.mapping),
    )
    await runLunaTriageCli([
      'prepare-requests',
      '--state-dir',
      directory,
      '--operation',
      operationId,
    ])
    await runLunaTriageCli(['batch-prepare', '--state-dir', directory, '--operation', operationId])
    const manifest = JSON.parse(await readFile(paths.requestManifestJson, 'utf8')) as Record<
      string,
      unknown
    >
    const plan = JSON.parse(
      await readFile(join(paths.batchShardsDir, 'shard-plan.json'), 'utf8'),
    ) as Record<string, unknown>
    return { manifest, plan, paths }
  }

  it('produces identical request and shard digests in two independent state directories', async () => {
    const first = await prepareIn(join(root, 'lane-a'), 'op-det-a')
    const second = await prepareIn(join(root, 'lane-b'), 'op-det-b')
    expect(second.manifest.requestSetSha256).toBe(first.manifest.requestSetSha256)
    expect(second.plan.planSha256).toBe(first.plan.planSha256)
    expect(
      (second.plan.shards as readonly { contentSha256: string }[]).map(
        (shard) => shard.contentSha256,
      ),
    ).toEqual(
      (first.plan.shards as readonly { contentSha256: string }[]).map(
        (shard) => shard.contentSha256,
      ),
    )
  })

  it('reconciles the recorded estimate back to the prepared bytes', async () => {
    const { manifest, plan } = await prepareIn(join(root, 'lane-c'), 'op-det-c')
    expect(manifest.reconciledInputTokens).toBe(manifest.totalEstimatedInputTokens)
    expect(manifest.reconciledOutputTokenAllowance).toBe(
      manifest.totalEstimatedOutputTokenAllowance,
    )
    const reconciled = plan.reconciledFromShardBytes as Record<string, number>
    const estimate = plan.estimate as Record<string, number>
    expect(reconciled.records).toBe(estimate.records)
    expect(reconciled.estimatedInputTokens).toBe(estimate.inputTokens)
    expect(reconciled.estimatedOutputTokenAllowance).toBe(estimate.outputTokenAllowance)
    expect(plan.submission).toMatch(/withheld/u)
  })
})

/**
 * Evaluation reports numbers. It may not report a verdict — no aggregate pass, no release
 * flag, nothing a caller could treat as "the model qualified".
 */
describe('the evaluation report carries no release verdict', () => {
  it('emits no qualification-shaped key anywhere in the report', async () => {
    const state = await resolveStateRoot(stateDir)
    const paths = await createOperation(state, 'op-verdict', 'pilot-1000', 'test', 'now')
    const built = buildPacket(SALT, syntheticCorpusRecord(syntheticPmid(5200)))
    await appendJsonlRows(paths.packetsJsonl, [built.packet])
    await appendJsonlRows(paths.mappingJsonl, [built.mapping])
    await appendJsonlRows(paths.riskFlagsJsonl, [
      { recordId: built.mapping.recordId, riskFlags: built.riskFlags },
    ])
    await exclusiveWriteFile(
      join(paths.rawResponsesDir, `${built.mapping.recordId}.json`),
      syntheticResponseBody(
        syntheticStageAOutput(built.mapping.recordId, 'obvious_irrelevant', 'high', [
          'clearly_nonpulmonary_domain',
        ]),
      ),
    )
    await runLunaTriageCli(['ingest', '--state-dir', stateDir, '--operation', 'op-verdict'])
    await runLunaTriageCli(['route', '--state-dir', stateDir, '--operation', 'op-verdict'])
    await runLunaTriageCli(['evaluate', '--state-dir', stateDir, '--operation', 'op-verdict'])

    const keys: string[] = []
    const walk = (value: unknown): void => {
      if (!value || typeof value !== 'object') return
      if (Array.isArray(value)) {
        value.forEach(walk)
        return
      }
      for (const [key, child] of Object.entries(value)) {
        keys.push(key)
        walk(child)
      }
    }
    walk(JSON.parse(await readFile(paths.evaluationReportJson, 'utf8')))
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) {
      expect(key).not.toMatch(/qualif|verdict|approv|released?$/iu)
    }
  })
})
