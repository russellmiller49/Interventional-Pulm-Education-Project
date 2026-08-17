/** @jest-environment node */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import { readOverlayCheckpoint, type OverlayCheckpoint } from './checkpoint'
import {
  OVERLAY_ARTIFACT_SHA256,
  OVERLAY_ARTIFACT_SHA256_ENV_NAME,
  OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
  OVERLAY_OWNER_AUTHORIZATION_ENV_NAME,
  OVERLAY_OWNER_AUTHORIZATION_SENTENCE,
  OVERLAY_PROJECTION_SHA256_ENV_NAME,
  type OverlayReadTable,
} from './constants'
import {
  applyReconciliationToCheckpoint,
  runApply,
  runDryRun,
  runValidate,
  type OverlayEngineDependencies,
} from './engine'
import { collectCohort } from './projection'
import { buildFixtureTruth } from './rehearsal-fixtures'
import { buildReviewedSet, type ReviewedSet } from './reviewed-set'
import {
  OverlayMutationAmbiguousError,
  OverlayMutationConfirmedFailureError,
  type OverlayReadQuery,
  type OverlayTransport,
} from './transport'

const truth = buildFixtureTruth()
const fixtureSet: ReviewedSet = buildReviewedSet(
  collectCohort(truth.cohortPayloads),
  truth.artifact,
)

/**
 * A scripted destination: exactly enough behavior for the precondition reads and staged
 * failures. The full RPC semantics are proven against real SQL by the disposable rehearsal.
 */
class ScriptedTransport implements OverlayTransport {
  corpus = new Set(truth.cohortPayloads.map((payload) => payload.pmid as string))
  corpusTotal = OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT
  foreignReviewed = 0
  schemaPresent = true
  operationRow: Record<string, unknown> | null = null
  applyCalls = 0
  failCall: { index: number; error: Error } | null = null
  mangleAckAtCall: number | null = null

  async applyBatch(requestBody: string): Promise<unknown> {
    const call = this.applyCalls
    this.applyCalls += 1
    if (this.failCall && this.failCall.index === call) throw this.failCall.error
    const request = JSON.parse(requestBody) as {
      p_operation: { operationId: string; finalBatch: boolean }
      p_records: Array<{ pmid: string }>
    }
    if (this.mangleAckAtCall === call) {
      return { operationId: request.p_operation.operationId, recordCount: -1 }
    }
    return {
      operationId: request.p_operation.operationId,
      recordCount: request.p_records.length,
      applied: request.p_records.length,
      alreadyApplied: 0,
      dispositions: request.p_records.map(() => 'applied'),
      operationStatus: request.p_operation.finalBatch ? 'completed' : 'started',
    }
  }

  async readRows(table: OverlayReadTable, query: OverlayReadQuery): Promise<unknown[]> {
    if (table === 'literature_reviewed_overlay_operations') {
      return this.operationRow ? [this.operationRow] : []
    }
    if (table === 'literature_articles' && query.query.includes('pmid=in.(')) {
      const list = query.query.slice(query.query.indexOf('pmid=in.(') + 9, -1).split(',')
      return list.filter((pmid) => this.corpus.has(pmid)).map((pmid) => ({ pmid }))
    }
    return []
  }

  async countRows(table: OverlayReadTable, filterQuery: string): Promise<number> {
    if (table === 'literature_reviewed_overlay_operations') {
      if (!this.schemaPresent) throw new Error('relation does not exist')
      return this.operationRow ? 1 : 0
    }
    if (filterQuery === 'select=pmid') return this.corpusTotal
    if (filterQuery.includes('reviewed_operation_id=not.is.null')) return this.foreignReviewed
    return 0
  }
}

function dependencies(
  transport: OverlayTransport,
  environmentOverrides: Record<string, string | undefined> = {},
  onCreateTransport?: () => void,
): OverlayEngineDependencies {
  return {
    environment: {
      [OVERLAY_ARTIFACT_SHA256_ENV_NAME]: OVERLAY_ARTIFACT_SHA256,
      [OVERLAY_PROJECTION_SHA256_ENV_NAME]: fixtureSet.projectionDigest,
      [OVERLAY_OWNER_AUTHORIZATION_ENV_NAME]: OVERLAY_OWNER_AUTHORIZATION_SENTENCE,
      ...environmentOverrides,
    },
    readCohortPayloads: () => Promise.resolve(buildFixtureTruth().cohortPayloads),
    loadArtifact: () => buildFixtureTruth().artifact,
    createTransport: () => {
      onCreateTransport?.()
      return transport
    },
    now: () => new Date('2026-08-17T00:00:00.000Z'),
  }
}

describe('validate and dry-run', () => {
  let directory: string
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'overlay-engine-test-'))
  })
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  it('validates without ever constructing a transport', async () => {
    let constructed = 0
    const result = await runValidate(
      dependencies(new ScriptedTransport(), {}, () => {
        constructed += 1
      }),
    )
    expect(result.status).toBe('validated')
    expect(result.environmentPins.projectionPinMatches).toBe(true)
    expect(constructed).toBe(0)
  })

  it('stops when the owner projection pin disagrees', async () => {
    await expect(
      runValidate(
        dependencies(new ScriptedTransport(), {
          [OVERLAY_PROJECTION_SHA256_ENV_NAME]: sha256('something else'),
        }),
      ),
    ).rejects.toThrow(/projection pin does not match/u)
  })

  it('writes an immutable dry-run receipt without destination requests', async () => {
    let constructed = 0
    const result = await runDryRun(
      dependencies(new ScriptedTransport(), {}, () => {
        constructed += 1
      }),
      { stateDirectory: directory, recordBatchLimit: 90 },
    )
    expect(result.plan.batchCount).toBe(7)
    expect(constructed).toBe(0)
    await expect(
      runDryRun(dependencies(new ScriptedTransport()), {
        stateDirectory: directory,
        recordBatchLimit: 90,
      }),
    ).rejects.toThrow(/already exists/u)
  })
})

describe('apply gates and preconditions', () => {
  let directory: string
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'overlay-apply-test-'))
  })
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  const baseOptions = () => ({
    stateDirectory: directory,
    recordBatchLimit: 90,
    resume: false,
    confirmProductionWrite: true,
  })

  it('refuses without the confirmation flag before any transport exists', async () => {
    let constructed = 0
    await expect(
      runApply(
        dependencies(new ScriptedTransport(), {}, () => {
          constructed += 1
        }),
        { ...baseOptions(), confirmProductionWrite: false },
      ),
    ).rejects.toThrow(/--confirm-production-write/u)
    expect(constructed).toBe(0)
  })

  it.each([
    [OVERLAY_ARTIFACT_SHA256_ENV_NAME, 'artifact pin'],
    [OVERLAY_PROJECTION_SHA256_ENV_NAME, 'projection pin'],
    [OVERLAY_OWNER_AUTHORIZATION_ENV_NAME, 'authorization sentence'],
  ])('refuses when %s is absent', async (name, description) => {
    let constructed = 0
    await expect(
      runApply(
        dependencies(new ScriptedTransport(), { [name]: undefined }, () => {
          constructed += 1
        }),
        baseOptions(),
      ),
    ).rejects.toThrow(new RegExp(`${description.replaceAll(' ', ' ')}.*required`, 'u'))
    expect(constructed).toBe(0)
  })

  it('refuses a near-miss owner authorization sentence', async () => {
    await expect(
      runApply(
        dependencies(new ScriptedTransport(), {
          [OVERLAY_OWNER_AUTHORIZATION_ENV_NAME]:
            OVERLAY_OWNER_AUTHORIZATION_SENTENCE.toLowerCase(),
        }),
        baseOptions(),
      ),
    ).rejects.toThrow(/does not match/u)
  })

  it('fails closed when the overlay schema is absent', async () => {
    const transport = new ScriptedTransport()
    transport.schemaPresent = false
    await expect(runApply(dependencies(transport), baseOptions())).rejects.toThrow(
      /reviewed-overlay schema is not present/u,
    )
  })

  it('refuses a corpus whose total is not exactly the fixed corpus', async () => {
    const transport = new ScriptedTransport()
    transport.corpusTotal = OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT - 1
    await expect(runApply(dependencies(transport), baseOptions())).rejects.toThrow(
      /exactly 132350 are expected/u,
    )
  })

  it('refuses when any reviewed PMID is absent from the corpus', async () => {
    const transport = new ScriptedTransport()
    transport.corpus.delete([...transport.corpus][0] as string)
    await expect(runApply(dependencies(transport), baseOptions())).rejects.toThrow(
      /absent from the destination corpus/u,
    )
  })

  it('refuses when a foreign operation already reviewed any article', async () => {
    const transport = new ScriptedTransport()
    transport.foreignReviewed = 3
    await expect(runApply(dependencies(transport), baseOptions())).rejects.toThrow(
      /reviewed state from a different operation/u,
    )
  })

  it('refuses a registered operation with different identity content', async () => {
    const transport = new ScriptedTransport()
    transport.operationRow = {
      id: fixtureSet.operationId,
      writer_identity: 'someone-else',
      artifact_sha256: fixtureSet.artifactSha256,
      source_identity: 'other',
      reviewed_at: '2026-08-16T00:00:00.000Z',
      record_count: 630,
    }
    await expect(runApply(dependencies(transport), baseOptions())).rejects.toThrow(
      /different identity content/u,
    )
  })

  it('records an ambiguous stage and stops on a mangled acknowledgement', async () => {
    const transport = new ScriptedTransport()
    transport.mangleAckAtCall = 1
    await expect(runApply(dependencies(transport), baseOptions())).rejects.toThrow(
      OverlayMutationAmbiguousError,
    )
    const checkpoint = await readOverlayCheckpoint(
      join(directory, `overlay-${fixtureSet.operationId}.checkpoint.json`),
    )
    expect(checkpoint.phase).toBe('needs_reconciliation')
    expect(checkpoint.batches[0]?.stage.state).toBe('acknowledged')
    expect(checkpoint.batches[1]?.stage.state).toBe('ambiguous')
    expect(checkpoint.batches[1]?.stage.submittedAt).not.toBeNull()
    expect(checkpoint.batches[2]?.stage.state).toBe('prepared')
  })

  it('records a confirmed failure distinctly and leaves later batches untouched', async () => {
    const transport = new ScriptedTransport()
    transport.failCall = {
      index: 2,
      error: new OverlayMutationConfirmedFailureError('destination rejected'),
    }
    await expect(runApply(dependencies(transport), baseOptions())).rejects.toThrow(
      /destination rejected/u,
    )
    const checkpoint = await readOverlayCheckpoint(
      join(directory, `overlay-${fixtureSet.operationId}.checkpoint.json`),
    )
    expect(checkpoint.phase).toBe('confirmed_failure')
    expect(checkpoint.batches[2]?.stage.state).toBe('confirmed_failure')
    expect(checkpoint.batches[2]?.stage.failureCode).toBe('postgrest_rejected')
    expect(checkpoint.batches[3]?.stage.state).toBe('prepared')
  })

  it('completes a clean apply with an immutable receipt and exact counters', async () => {
    const transport = new ScriptedTransport()
    const result = await runApply(dependencies(transport), baseOptions())
    expect(result.status).toBe('applied')
    expect(result.counters).toEqual({ applied: 630, alreadyApplied: 0 })
    expect(result.batchCount).toBe(7)
    const checkpoint = await readOverlayCheckpoint(result.checkpointPath)
    expect(checkpoint.phase).toBe('completed')
  })
})

describe('applyReconciliationToCheckpoint', () => {
  function ambiguousCheckpoint(): OverlayCheckpoint {
    const checkpoint = {
      schemaVersion: 'literature-reviewed-overlay-checkpoint/1.0.0',
      engineVersion: 'literature-reviewed-overlay/1.0.0',
      operationId: fixtureSet.operationId,
      targetProjectRef: 'itcttmkxdxvwmwcmzmey',
      createdAt: '2026-08-17T00:00:00.000Z',
      updatedAt: '2026-08-17T00:00:00.000Z',
      artifactSha256: fixtureSet.artifactSha256,
      projectionDigest: fixtureSet.projectionDigest,
      reviewedAt: '2026-08-17T00:00:00.000Z',
      counts: fixtureSet.counts,
      limits: { recordBatchLimit: 630 },
      batches: [
        {
          index: 0,
          startOrdinal: 1,
          endOrdinal: 630,
          recordCount: 630,
          finalBatch: true,
          requestChecksum: sha256('request'),
          stage: {
            state: 'ambiguous' as const,
            submittedAt: '2026-08-17T00:00:00.000Z',
            acknowledgedAt: null,
            failureCode: 'request_timeout',
          },
          acknowledgementChecksum: null,
          effects: null,
        },
      ],
      phase: 'needs_reconciliation' as const,
      counters: { applied: 0, alreadyApplied: 0 },
    }
    return checkpoint
  }

  function receiptFor(
    checkpoint: OverlayCheckpoint,
    classification: string,
  ): Record<string, unknown> {
    const body = {
      schemaVersion: 'literature-reviewed-overlay-reconciliation/1.0.0',
      operationId: checkpoint.operationId,
      checkpointChecksum: sha256(canonicalJson(checkpoint)),
      observedAt: '2026-08-17T00:01:00.000Z',
      batches: [
        {
          index: 0,
          classification,
          observed: {
            eventsPresent: 630,
            articlesReviewed: 630,
            articlesUntouched: 0,
            mismatches: 0,
          },
        },
      ],
    }
    return { ...body, receiptChecksum: sha256(canonicalJson(body)) }
  }

  it('acknowledges an exactly-applied batch', () => {
    const checkpoint = ambiguousCheckpoint()
    applyReconciliationToCheckpoint(checkpoint, receiptFor(checkpoint, 'applied_exact'))
    expect(checkpoint.batches[0]?.stage.state).toBe('acknowledged')
    expect(checkpoint.phase).toBe('running')
  })

  it('re-prepares an exactly-absent batch', () => {
    const checkpoint = ambiguousCheckpoint()
    applyReconciliationToCheckpoint(checkpoint, receiptFor(checkpoint, 'absent_exact'))
    expect(checkpoint.batches[0]?.stage.state).toBe('prepared')
  })

  it('stops on drift and on incomplete observations with distinct messages', () => {
    const drift = ambiguousCheckpoint()
    expect(() =>
      applyReconciliationToCheckpoint(drift, receiptFor(drift, 'partial_or_conflicting')),
    ).toThrow(/conflicts with the overlay expectation/u)

    const incomplete = ambiguousCheckpoint()
    expect(() =>
      applyReconciliationToCheckpoint(incomplete, receiptFor(incomplete, 'observation_incomplete')),
    ).toThrow(/observation is incomplete/u)
  })

  it('refuses a receipt bound to a different checkpoint state or operation', () => {
    const checkpoint = ambiguousCheckpoint()
    const receipt = receiptFor(checkpoint, 'applied_exact')
    checkpoint.counters.applied = 1
    expect(() => applyReconciliationToCheckpoint(checkpoint, receipt)).toThrow(
      /different checkpoint state/u,
    )

    const foreign = ambiguousCheckpoint()
    const foreignReceipt = receiptFor(foreign, 'applied_exact') as { operationId: string }
    foreignReceipt.operationId = '00000000-0000-8000-8000-000000000000'
    expect(() => applyReconciliationToCheckpoint(foreign, foreignReceipt)).toThrow(
      /different operation|checksum does not match/u,
    )
  })
})
