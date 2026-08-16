/** @jest-environment node */

/**
 * Ingestion → verification, end to end, with artifacts the real engine produced.
 *
 * A contract audit found these two packages had no code references to each other in either
 * direction: each agreed with its own fixtures and with nothing else. Hand-authoring a receipt in
 * this file would rebuild exactly that problem one layer up — a fixture that matches what I believe
 * the engine emits rather than what it emits.
 *
 * So every receipt here comes from the engine's own `createCompletedReceiptFromCheckpoint` and
 * `createIdempotentReplayReceipt`, and every batch row is built from the same checkpoint the engine
 * builds it from. Writing this test immediately caught one such drift: the batch row's
 * `source_kind` is `unmapped`, not the `all_pubmed_discovery` a hand-written fixture had assumed.
 *
 * ## The semantics these cases pin
 *
 *   - a missing receipt is **indeterminate**, never a failure — absent evidence withholds a
 *     verdict, it does not manufacture one;
 *   - a wrong or stale receipt is **not verified**;
 *   - a deterministic replay of a completed operation is **verified idempotent**, with no new batch
 *     row and no moved timestamp, because that is what the engine actually does;
 *   - full-corpus reconciliation compares distinct destination PMIDs against the owner-pinned
 *     source count, and does not sum the canary batch into the total;
 *   - the source digest is the engine's canonical mapped-projection value, not a file checksum;
 *   - the receipt is evidence, never authority: every claim it makes is cross-checked against a
 *     live database observation, and the owner-approved manifest SHA — not the receipt — is what
 *     authorizes a canary.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  createCompletedReceiptFromCheckpoint,
  createIdempotentReplayReceipt,
} from '../literature-production-ingest/engine'
import type {
  Checkpoint,
  IngestReceipt as EngineReceipt,
} from '../literature-production-ingest/types'
import { checkCanaryIdempotency, checkFullCorpus, checkIngestReceiptBinding } from './lib/checks'
import {
  LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
  LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
} from './lib/identity'
import { MAPPING_VERSION } from '../literature-production-ingest/constants'
import { batchChecksumSequenceSummary } from '../literature-production-ingest/receipt-binding'
import type { BatchReceipt, SourceRow } from './lib/collect'
import {
  isIngestReceipt,
  ingestReceiptChecksumMatches,
  type IngestReceipt,
} from './lib/ingest-receipt'
import { observed, skipped, type Observation } from './lib/observation'

const OPERATION_ID = '9f1d2b34-5c6e-4a7b-8c9d-0e1f2a3b4c5d'
const PROJECTION_CHECKSUM = 'a1b2c3d4'.repeat(8)
const MANIFEST_CHECKSUM = 'f0e1d2c3'.repeat(8)
const TARGET = 'itcttmkxdxvwmwcmzmey'
const CREATED_AT = '2026-08-15T00:00:00.000Z'

const CANARY_PMIDS = Array.from({ length: 25 }, (_, index) => String(41_000_000 + index))

function stage(state: Checkpoint['finalization']['state']): Checkpoint['finalization'] {
  return {
    state,
    requestChecksum: 'd'.repeat(64),
    submittedAt: CREATED_AT,
    acknowledgedAt: state === 'acknowledged' ? CREATED_AT : null,
    failureCode: state === 'confirmed_failure' ? 'PGRST301' : null,
  }
}

/** A checkpoint in the shape the engine writes one. */
function checkpoint(overrides: Partial<Checkpoint> = {}): Checkpoint {
  const mode = overrides.mode ?? 'canary'
  const recordCount = overrides.sourceRecordCount ?? CANARY_PMIDS.length
  return {
    schemaVersion: 'literature-production-ingest-checkpoint/1.0.0',
    engineVersion: 'literature-production-ingest/1.0.0',
    // The engine's real mapping version. The fixture previously invented one, which nothing caught
    // because V57 did not compare `mapping_version` — so the stored identity and the receipt were
    // free to disagree about it in production too.
    mappingVersion: MAPPING_VERSION,
    operationId: OPERATION_ID,
    mode,
    targetProjectRef: TARGET,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    sourceProjectionChecksum: PROJECTION_CHECKSUM,
    sourceRecordCount: recordCount,
    canaryManifestChecksum: mode === 'canary' ? MANIFEST_CHECKSUM : null,
    limits: { recordBatchLimit: 500, byteBatchLimit: 1_000_000, concurrency: 1 },
    batchIdentity: {
      sourceFilename: `literature-production-ingest/${mode}`,
      sourceFileSha256: PROJECTION_CHECKSUM,
      manifestVersion: 'literature-production-ingest/1.0.0',
      queryRegistryVersion: 'literature-production-ingest/1.0.0',
      sourceKind: 'unmapped',
      sourceId: 'fixed-local-bibliographic-corpus',
      queryId: mode === 'canary' ? 'production-canary' : 'production-full',
      recordLimit: null,
    },
    importBatchCreate: stage('acknowledged'),
    finalization: stage('acknowledged'),
    finalizationEnvelope: {
      completedAt: CREATED_AT,
      body: JSON.stringify({ completed_at: CREATED_AT, status: 'completed' }),
      checksum: 'd'.repeat(64),
    },
    phase: 'completed',
    beforeArticleCount: 0,
    afterArticleCount: recordCount,
    counters: {
      recordsRead: recordCount,
      uniquePmids: recordCount,
      duplicateOccurrences: 0,
      inserted: recordCount,
      updated: 0,
      unchanged: 0,
      errors: 0,
    },
    batches: [
      {
        index: 0,
        startOrdinal: 0,
        endOrdinal: recordCount,
        recordCount,
        articleBodyBytes: 1_024,
        journalBodyBytes: 256,
        provenanceBodyBytes: 512,
        checksum: 'e'.repeat(64),
        effects: { inserted: recordCount, updated: 0, unchanged: 0 },
        stages: {
          journals: stage('acknowledged'),
          articles: stage('acknowledged'),
          provenance: stage('acknowledged'),
        },
      },
    ],
    ...overrides,
  }
}

/** The receipt the engine writes for a completed operation. Genuine engine output. */
function completedReceipt(source: Checkpoint = checkpoint()): IngestReceipt {
  const built: EngineReceipt = createCompletedReceiptFromCheckpoint({
    checkpoint: source,
    ...(source.mode === 'canary' ? { canaryPmids: [...CANARY_PMIDS] } : {}),
    now: CREATED_AT,
  } as Parameters<typeof createCompletedReceiptFromCheckpoint>[0])
  return built as unknown as IngestReceipt
}

/** The receipt the engine writes when it recognises a repeat operation. Genuine engine output. */
function replayReceipt(source: Checkpoint = checkpoint()): IngestReceipt {
  const built: EngineReceipt = createIdempotentReplayReceipt({
    checkpoint: source,
    articleCount: source.sourceRecordCount,
    ...(source.mode === 'canary' ? { canaryPmids: [...CANARY_PMIDS] } : {}),
    now: CREATED_AT,
  })
  return built as unknown as IngestReceipt
}

/** The `literature_import_batches` row the engine leaves for that checkpoint. */
function batchRow(
  source: Checkpoint,
  receipt: IngestReceipt,
  overrides: Partial<BatchReceipt> = {},
) {
  return {
    id: source.operationId,
    status: 'completed',
    source_filename: source.batchIdentity.sourceFilename,
    source_file_sha256: source.batchIdentity.sourceFileSha256,
    source_kind: source.batchIdentity.sourceKind,
    // From the checkpoint, not the receipt: the durable row records the ORIGINAL operation, and a
    // replay never rewrites it. Reading these off a replay receipt produced a row claiming zero
    // inserts, which is not a row the engine can leave behind.
    records_read: source.counters.recordsRead,
    unique_pmids: source.counters.uniquePmids,
    inserted_count: source.counters.inserted,
    updated_count: source.counters.updated,
    duplicate_count: source.counters.duplicateOccurrences,
    error_count: 0,
    started_at: source.createdAt,
    completed_at: source.updatedAt,
    // All eleven fields the engine's finalization persists.
    report: {
      engine_version: source.engineVersion,
      mapping_version: source.mappingVersion,
      operation_id: source.operationId,
      mode: source.mode,
      source_projection_checksum: source.sourceProjectionChecksum,
      canary_manifest_checksum: source.canaryManifestChecksum,
      unchanged_count: source.counters.unchanged,
      before_article_count: source.beforeArticleCount,
      after_article_count: source.afterArticleCount,
      batch_count: source.batches.length,
      batch_checksums_sha256: batchChecksumSequenceSummary(
        source.batches.map((batch) => batch.checksum),
      ),
    },
    created_by: 'literature-production-ingest',
    ...overrides,
  } satisfies BatchReceipt
}

function provenance(pmids: readonly string[], batchId: string, source: Checkpoint): SourceRow[] {
  return pmids.map((pmid) => ({
    pmid,
    batch_id: batchId,
    source_kind: source.batchIdentity.sourceKind,
    source_filename: source.batchIdentity.sourceFilename,
  }))
}

const outcomes = (results: readonly { id: string; outcome: string }[]) =>
  Object.fromEntries(results.map((result) => [result.id, result.outcome]))

function bind(
  receipt: Observation<IngestReceipt> | undefined,
  batches: BatchReceipt[],
  total: number,
  sources: SourceRow[],
  options: {
    target?: { projectRef: string; url: string; canonicalUrl: string }
    articleStates?: { pmid: string; relevance_state: string; visibility_state: string }[]
  } = {},
) {
  const claimed = receipt && receipt.status === 'observed' ? (receipt.value.canaryPmids ?? []) : []
  return checkIngestReceiptBinding(
    receipt,
    observed(batches),
    observed(total),
    observed(sources),
    options.target ?? {
      projectRef: LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
      url: LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
      canonicalUrl: LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
    },
    observed(
      options.articleStates ??
        [...claimed].map((pmid) => ({
          pmid,
          relevance_state: 'unreviewed',
          visibility_state: 'draft',
        })),
    ),
  )
}

/* --------------------------------------------------------------------------------------------- *
 * The receipt the engine writes is the receipt the verifier reads
 * --------------------------------------------------------------------------------------------- */

describe('the two packages agree on the receipt format', () => {
  it("accepts genuine engine output under the verifier's strict guard", () => {
    // The single assertion the whole reconciliation rests on. If the engine changes its receipt
    // shape or its canonicalization, this fails rather than the two packages drifting silently.
    for (const receipt of [completedReceipt(), replayReceipt()]) {
      expect(isIngestReceipt(receipt)).toBe(true)
      expect(ingestReceiptChecksumMatches(receipt)).toBe(true)
    }
  })
})

/* --------------------------------------------------------------------------------------------- *
 * 1-3: the healthy paths
 * --------------------------------------------------------------------------------------------- */

describe('1. a successful 25-record canary', () => {
  it('binds the corpus to the operation that wrote it', () => {
    const source = checkpoint()
    const receipt = completedReceipt(source)
    const results = bind(
      observed(receipt),
      [batchRow(source, receipt)],
      25,
      provenance(CANARY_PMIDS, source.operationId, source),
    )
    expect(outcomes(results)).toMatchObject({
      'V55-receipt-binds-operation': 'pass',
      'V56-receipt-counters-agree': 'pass',
      'V57-receipt-matches-batch-report': 'pass',
      'V58-receipt-matches-corpus': 'pass',
      'V59-receipt-pmids-present': 'pass',
    })
  })
})

describe('2. a second-run idempotent replay', () => {
  it('is verified from the replay receipt, with no new batch and no moved timestamp', () => {
    const source = checkpoint()
    const replay = replayReceipt(source)
    // The engine's replay writes nothing, so both snapshots are identical and the batch row is
    // byte-for-byte the one the first run left.
    const snapshot = {
      totalArticles: 25,
      batchCount: 1,
      insertedTotal: 25,
      updatedTotal: 0,
      duplicateTotal: 0,
      latestBatchStartedAt: CREATED_AT,
    }
    const result = checkCanaryIdempotency(observed(snapshot), observed(snapshot), observed(replay))
    expect(result.outcome).toBe('pass')
    expect(result.detail).toMatch(/recognised the re-run as an identical operation/u)

    // And the remedy vocabulary is gone for good: `--force` is not a flag the engine has.
    expect(result.detail).not.toMatch(/--force/u)
  })

  it('reports the replay receipt as an unchanged corpus rather than new inserts', () => {
    const replay = replayReceipt()
    expect(replay.counters.inserted).toBe(0)
    expect(replay.counters.updated).toBe(0)
    expect(replay.beforeArticleCount).toBe(replay.afterArticleCount)
  })
})

describe('3. a completed full batch', () => {
  it('reconciles distinct destination PMIDs against the owner-pinned source count', () => {
    const full = checkpoint({ mode: 'full', sourceRecordCount: 132_350 })
    const receipt = completedReceipt(full)
    const results = checkFullCorpus(
      observed({
        sourceRecordCount: 132_350,
        sourceDistinctPmidCount: 132_350,
        sourceFiles: [
          // The engine reads a table, so the only value that can appear here is its canonical
          // mapped-projection digest — not a checksum of any file on disk.
          {
            filename: full.batchIdentity.sourceFilename,
            sha256: PROJECTION_CHECKSUM,
            recordCount: 132_350,
          },
        ],
      }),
      observed([batchRow(full, receipt)]),
      observed(132_350),
      observed(receipt),
    )
    expect(outcomes(results)).toMatchObject({
      'V70-corpus-counts': 'pass',
      'V71-corpus-files': 'pass',
    })
  })

  it('does not sum the canary batch into the full-corpus total', () => {
    /*
     * The runbook's own order runs the canary first, and the engine leaves that batch `completed`
     * forever. Summing `records_read` across every completed batch therefore overshoots the
     * declared source by exactly the canary size — a deterministic failure on a corpus that is
     * exactly right. Scoping to the operation the receipt names is what fixes it.
     */
    const canary = checkpoint()
    const full = checkpoint({ mode: 'full', sourceRecordCount: 132_350, operationId: 'full-op' })
    const canaryReceipt = completedReceipt(canary)
    const fullReceipt = completedReceipt(full)

    const results = checkFullCorpus(
      observed({
        sourceRecordCount: 132_350,
        sourceDistinctPmidCount: 132_350,
        sourceFiles: [],
      }),
      observed([batchRow(canary, canaryReceipt), batchRow(full, fullReceipt)]),
      observed(132_350),
      observed(fullReceipt),
    )
    expect(outcomes(results)['V70-corpus-counts']).toBe('pass')
  })
})

/* --------------------------------------------------------------------------------------------- *
 * 4-5: failure and ambiguity
 * --------------------------------------------------------------------------------------------- */

describe('4. a confirmed failed batch', () => {
  it('is not bound to a corpus, because the operation never completed', () => {
    const failed = checkpoint({
      phase: 'confirmed_failure',
      finalization: stage('confirmed_failure'),
    })
    // No receipt exists for a confirmed failure; the engine writes one only on completion.
    const results = bind(skipped('a failed operation writes no receipt'), [], 0, [])
    expect(outcomes(results)['V55-receipt-binds-operation']).toBe('indeterminate')
    expect(failed.phase).toBe('confirmed_failure')
  })
})

describe('5. an ambiguous acknowledgement', () => {
  it('leaves a started batch that no receipt claims', () => {
    const ambiguous = checkpoint({
      phase: 'needs_reconciliation',
      finalization: stage('submitted'),
    })
    const receipt = completedReceipt()
    const started = batchRow(ambiguous, receipt, { status: 'started', completed_at: null })
    const results = bind(skipped('acknowledgement was lost'), [started], 25, [])
    // Indeterminate, not failed: an unacknowledged write is exactly the state where a confident
    // verdict would be the dangerous answer.
    expect(outcomes(results)['V55-receipt-binds-operation']).toBe('indeterminate')
  })
})

/* --------------------------------------------------------------------------------------------- *
 * 6-7: bad evidence
 * --------------------------------------------------------------------------------------------- */

describe('6. a missing or altered receipt', () => {
  it('reports indeterminate when the receipt is absent', () => {
    const source = checkpoint()
    const results = bind(
      undefined,
      [batchRow(source, completedReceipt(source))],
      25,
      provenance(CANARY_PMIDS, source.operationId, source),
    )
    expect(outcomes(results)['V55-receipt-binds-operation']).toBe('indeterminate')
  })

  it('fails when a field was edited after the engine wrote it', () => {
    const source = checkpoint()
    const receipt = completedReceipt(source)
    // The realistic tampering: a count nudged to make a check agree.
    const altered = { ...receipt, afterArticleCount: 999 } as IngestReceipt
    expect(ingestReceiptChecksumMatches(altered)).toBe(false)
    const results = bind(observed(altered), [batchRow(source, receipt)], 25, [])
    expect(outcomes(results)['V55-receipt-binds-operation']).toBe('fail')
  })
})

describe('7. a checkpoint/receipt mismatch', () => {
  it('fails when the receipt names a batch this project does not have', () => {
    const source = checkpoint()
    const other = checkpoint({ operationId: 'a-different-operation' })
    const results = bind(
      observed(completedReceipt(source)),
      [batchRow(other, completedReceipt(other))],
      25,
      [],
    )
    expect(outcomes(results)['V55-receipt-binds-operation']).toBe('fail')
  })

  it('fails when the stored operation identity disagrees with the receipt', () => {
    const source = checkpoint()
    const receipt = completedReceipt(source)
    const drifted = batchRow(source, receipt, {
      report: {
        operation_id: source.operationId,
        // A projection digest from a different mapping version: same operation id, different data.
        source_projection_checksum: 'b'.repeat(64),
        canary_manifest_checksum: source.canaryManifestChecksum,
      },
    })
    const results = bind(observed(receipt), [drifted], 25, [])
    expect(outcomes(results)['V57-receipt-matches-batch-report']).toBe('fail')
  })

  it('fails when the receipt counters disagree with the batch row', () => {
    const source = checkpoint()
    const receipt = completedReceipt(source)
    const results = bind(
      observed(receipt),
      [batchRow(source, receipt, { inserted_count: 24 })],
      25,
      [],
    )
    expect(outcomes(results)['V56-receipt-counters-agree']).toBe('fail')
  })
})

/* --------------------------------------------------------------------------------------------- *
 * 8-12: corpus-level evidence
 * --------------------------------------------------------------------------------------------- */

describe('8. duplicate PMID evidence', () => {
  it('fails when provenance covers more articles than the receipt claims', () => {
    const source = checkpoint()
    const receipt = completedReceipt(source)
    const results = bind(
      observed(receipt),
      [batchRow(source, receipt)],
      26,
      provenance([...CANARY_PMIDS, '49999999'], source.operationId, source),
    )
    expect(outcomes(results)['V59-receipt-pmids-present']).toBe('fail')
  })
})

describe('9. an incorrect visibility or relevance state', () => {
  it('is caught by the corpus total disagreeing with the receipt', () => {
    // The state checks live in the canary scenario; what the binding adds is that a corpus which
    // moved after the receipt was written cannot pass as the operation's own result.
    const source = checkpoint()
    const receipt = completedReceipt(source)
    const results = bind(observed(receipt), [batchRow(source, receipt)], 30, [])
    expect(outcomes(results)['V58-receipt-matches-corpus']).toBe('fail')
  })
})

describe('10. incomplete provenance', () => {
  it('fails when a claimed PMID has no provenance row', () => {
    const source = checkpoint()
    const receipt = completedReceipt(source)
    const results = bind(
      observed(receipt),
      [batchRow(source, receipt)],
      25,
      provenance(CANARY_PMIDS.slice(0, 24), source.operationId, source),
    )
    expect(outcomes(results)['V59-receipt-pmids-present']).toBe('fail')
  })

  it('names no PMID in the failure detail', () => {
    const source = checkpoint()
    const receipt = completedReceipt(source)
    const results = bind(
      observed(receipt),
      [batchRow(source, receipt)],
      25,
      provenance(CANARY_PMIDS.slice(0, 24), source.operationId, source),
    )
    const detail = results.find((r) => r.id === 'V59-receipt-pmids-present')?.detail ?? ''
    for (const pmid of CANARY_PMIDS) expect(detail).not.toContain(pmid)
  })
})

describe('11. a wrong target', () => {
  it('is visible in the receipt the operation wrote', () => {
    const wrong = checkpoint({ targetProjectRef: 'tqnhxlwvkkswuckszlee' })
    const receipt = completedReceipt(wrong)
    // The engine records the project it wrote to. A receipt naming the main application project is
    // evidence of the one thing this whole bring-up forbids.
    expect(receipt.targetProjectRef).toBe('tqnhxlwvkkswuckszlee')
    expect(receipt.targetProjectRef).not.toBe(TARGET)
  })

  it('still verifies its own checksum, because a checksum proves no target', () => {
    // Worth pinning: the checksum guard detects editing, not wrongness. Target identity is
    // established by the verifier's own project-identity checks against the live connection.
    expect(
      ingestReceiptChecksumMatches(completedReceipt(checkpoint({ targetProjectRef: 'x' }))),
    ).toBe(true)
  })
})

describe('12. public draft exposure', () => {
  it('is not something a receipt can attest, and the binding does not pretend otherwise', () => {
    /*
     * The receipt says what was written; it cannot say what an anonymous caller can reach. That is
     * measured against the live database by the public-exclusion checks, with a publishable key.
     * This case exists to pin the boundary: no binding check reports on exposure, so a receipt can
     * never be mistaken for evidence that drafts are unreachable.
     */
    const source = checkpoint()
    const receipt = completedReceipt(source)
    const results = bind(
      observed(receipt),
      [batchRow(source, receipt)],
      25,
      provenance(CANARY_PMIDS, source.operationId, source),
    )
    for (const result of results) {
      expect(result.id).not.toMatch(/public|exposure|anonymous/iu)
    }
  })
})

/* --------------------------------------------------------------------------------------------- *
 * The vocabulary an operator can actually act on
 * --------------------------------------------------------------------------------------------- */

describe('no operator-facing string offers a flag the engine does not have', () => {
  const ROOT = process.cwd()
  const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

  it('names no --force in any bring-up document', () => {
    // The previous importer had one; the engine aborts with `Unknown option`. A remedy an operator
    // cannot run is worse than no remedy, because it costs them the time to discover that.
    for (const document of [
      'docs/ip-literature/production-bringup-runbook.md',
      'docs/ip-literature/production-bringup-monday-smoke.md',
      'docs/ip-literature/production-bringup-railway-cutover.md',
    ]) {
      expect(`${document}: ${read(document).includes('--force')}`).toBe(`${document}: false`)
    }
  })

  it('names no --force in any check detail the tool prints', () => {
    /*
     * Source comments may still narrate the previous importer's behaviour — that history is why
     * these checks look the way they do. What must never carry it is a string the tool prints,
     * because that is the one an operator reads as an instruction. The distinction is enforced by
     * scanning only the quoted strings that reach a `fail`, `pass`, or `indeterminate` call.
     */
    const source = read('scripts/literature-production-verify/lib/checks.ts')
    const withoutComments = source
      .replaceAll(/\/\*[\s\S]*?\*\//gu, '')
      .replaceAll(/(^|[^:])\/\/.*$/gmu, '$1')
    expect(withoutComments).not.toMatch(/--force/u)
  })

  it('tells the operator to pass the receipt instead', () => {
    const source = read('scripts/literature-production-verify/lib/checks.ts')
    expect(source).toContain('--ingest-receipt')
  })

  it('keeps the Monday canary command passing the generated receipt through', () => {
    const smoke = read('docs/ip-literature/production-bringup-monday-smoke.md')
    // Every verify command in the document, not just the second run: the binding checks are what
    // make run 1 meaningful too. Counted over fenced commands rather than the whole file, so a
    // sentence of prose mentioning the flag neither satisfies nor breaks this.
    const commands = [...smoke.matchAll(/```bash\n([\s\S]*?)```/gu)]
      .map((match) => match[1])
      .filter((command) => command.includes('literature-production-verify'))
    expect(commands.length).toBeGreaterThanOrEqual(2)
    for (const command of commands) {
      if (!command.includes('--scenario canary')) continue
      expect(command).toContain('--ingest-receipt')
    }
    expect(smoke).toMatch(/Keep the receipt the import writes/u)
  })
})
