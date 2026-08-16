/** @jest-environment node */

/**
 * The receipt-binding contract, exercised against artifacts the engine itself produced.
 *
 * Every case below is a state in which the previous implementation returned `verified`. They are
 * grouped by what the receipt was lying about, and each one asserts a *specific* finding code
 * rather than merely "something failed" — a check that fails for the wrong reason is a check that
 * will pass for the wrong reason after the next edit.
 *
 * The receipts are built by `createCompletedReceiptFromCheckpoint` and
 * `createIdempotentReplayReceipt`, not hand-authored, so a change to the receipt format fails here
 * rather than silently diverging.
 */

import {
  APPROVED_PROJECT_REF,
  APPROVED_PROJECT_URL,
  CANARY_SOURCE_AUTHORITY,
  ENGINE_VERSION,
  INGEST_WRITER_IDENTITY,
  MAPPING_VERSION,
  PROHIBITED_ENDOREELS_REF,
} from './constants'
import { createCompletedReceiptFromCheckpoint, createIdempotentReplayReceipt } from './engine'
import {
  STABLE_FINAL_REPORT_KEYS,
  batchChecksumSequenceSummary,
  classifyStoredBatchState,
  evaluateReceiptBinding,
  reconstructStableFinalReport,
  type BindableReceipt,
  type BindingFindingCode,
  type ObservedArticleState,
  type ObservedBatchRow,
  type ObservedProvenanceRow,
  type ReceiptBindingObservation,
} from './receipt-binding'
import type { Checkpoint, IngestReceipt } from './types'

const OPERATION_ID = '11111111-2222-3333-4444-555555555555'
const OTHER_OPERATION_ID = '99999999-8888-7777-6666-555555555555'
const PROJECTION = 'a'.repeat(64)
const MANIFEST = 'b'.repeat(64)
const AT = '2026-08-15T00:00:00.000Z'
const PMIDS = Array.from({ length: 25 }, (_, index) => String(40_000_000 + index))

function stage(): Checkpoint['finalization'] {
  return {
    state: 'acknowledged',
    requestChecksum: 'd'.repeat(64),
    submittedAt: AT,
    acknowledgedAt: AT,
    failureCode: null,
  }
}

function checkpoint(overrides: Partial<Checkpoint> = {}): Checkpoint {
  return {
    schemaVersion: 'literature-production-ingest-checkpoint/1.1.0',
    engineVersion: ENGINE_VERSION,
    mappingVersion: MAPPING_VERSION,
    operationId: OPERATION_ID,
    mode: 'canary',
    targetProjectRef: APPROVED_PROJECT_REF,
    createdAt: AT,
    updatedAt: AT,
    sourceProjectionChecksum: PROJECTION,
    sourceRecordCount: 25,
    canaryManifestChecksum: MANIFEST,
    limits: { recordBatchLimit: 500, byteBatchLimit: 1_000_000, concurrency: 1 },
    batchIdentity: {
      sourceFilename: 'authorized-canary-manifest.json',
      sourceFileSha256: PROJECTION,
      manifestVersion: `${ENGINE_VERSION}/canary/${MANIFEST}`,
      queryRegistryVersion: MAPPING_VERSION,
      sourceKind: 'unmapped',
      sourceId: 'fixed-local-bibliographic-corpus',
      queryId: 'production-canary',
      recordLimit: 25,
    },
    importBatchCreate: stage(),
    finalization: stage(),
    finalizationEnvelope: {
      completedAt: AT,
      body: JSON.stringify({ completed_at: AT, status: 'completed' }),
      checksum: 'd'.repeat(64),
    },
    phase: 'completed',
    beforeArticleCount: 0,
    afterArticleCount: 25,
    counters: {
      recordsRead: 25,
      uniquePmids: 25,
      duplicateOccurrences: 0,
      inserted: 25,
      updated: 0,
      unchanged: 0,
      errors: 0,
    },
    batches: [
      {
        index: 0,
        startOrdinal: 0,
        endOrdinal: 25,
        recordCount: 25,
        articleBodyBytes: 1_024,
        journalBodyBytes: 256,
        provenanceBodyBytes: 512,
        checksum: 'e'.repeat(64),
        effects: { inserted: 25, updated: 0, unchanged: 0 },
        stages: { journals: stage(), articles: stage(), provenance: stage() },
      },
    ],
    ...overrides,
  }
}

function completedReceipt(source: Checkpoint = checkpoint()): IngestReceipt {
  return createCompletedReceiptFromCheckpoint({
    checkpoint: source,
    canaryPmids: [...PMIDS],
    now: AT,
  })
}

function replayReceipt(source: Checkpoint = checkpoint()): IngestReceipt {
  return createIdempotentReplayReceipt({
    checkpoint: source,
    articleCount: 25,
    canaryPmids: [...PMIDS],
    now: AT,
  })
}

function batchRow(
  receipt: IngestReceipt,
  overrides: Partial<ObservedBatchRow> = {},
  reportOverrides: Readonly<Record<string, unknown>> = {},
): ObservedBatchRow {
  return {
    id: receipt.importBatchId ?? receipt.operationId,
    status: 'completed',
    completed_at: AT,
    created_by: INGEST_WRITER_IDENTITY,
    source_file_sha256: receipt.sourceProjectionChecksum,
    // A replay does not rewrite the row, so the stored counters are always the original
    // operation's — which is exactly why a replay receipt must still agree with them.
    records_read: 25,
    unique_pmids: 25,
    inserted_count: 25,
    updated_count: 0,
    duplicate_count: 0,
    error_count: 0,
    // The complete eleven-field report the engine's finalization persists, transcribed from
    // `buildFinalPatch` rather than reconstructed by the contract that checks it. It describes the
    // ORIGINAL operation: 25 inserted into an empty corpus, nothing unchanged, one durable batch.
    report: {
      engine_version: receipt.engineVersion,
      mapping_version: receipt.mappingVersion,
      operation_id: receipt.operationId,
      mode: receipt.mode,
      source_projection_checksum: receipt.sourceProjectionChecksum,
      canary_manifest_checksum: receipt.canaryManifestChecksum,
      unchanged_count: 0,
      before_article_count: 0,
      after_article_count: 25,
      batch_count: receipt.batchChecksums.length,
      batch_checksums_sha256: batchChecksumSequenceSummary(receipt.batchChecksums),
      ...reportOverrides,
    },
    ...overrides,
  }
}

/** A batch row whose stored report has one field mutated, removed, or added. */
function batchRowWithReport(
  receipt: IngestReceipt,
  patch: Readonly<Record<string, unknown>>,
  remove: readonly string[] = [],
): ObservedBatchRow {
  const row = batchRow(receipt)
  const report = { ...(row.report as Record<string, unknown>), ...patch }
  for (const key of remove) delete report[key]
  return { ...row, report }
}

function provenance(pmids: readonly string[], batchId: string): ObservedProvenanceRow[] {
  return pmids.map((pmid) => ({ pmid, batch_id: batchId }))
}

function articles(pmids: readonly string[], state?: Partial<ObservedArticleState>) {
  return pmids.map((pmid) => ({
    pmid,
    relevance_state: state?.relevance_state ?? 'unreviewed',
    visibility_state: state?.visibility_state ?? 'draft',
  }))
}

function observation(
  receipt: IngestReceipt,
  overrides: Partial<ReceiptBindingObservation> = {},
): ReceiptBindingObservation {
  const batchId = receipt.importBatchId ?? receipt.operationId
  return {
    observedProjectRef: APPROVED_PROJECT_REF,
    observedUrl: APPROVED_PROJECT_URL,
    batch: batchRow(receipt),
    batchesObserved: true,
    provenance: provenance(receipt.canaryPmids ?? [], batchId),
    articleStates: articles(receipt.canaryPmids ?? []),
    totalArticles: 25,
    ...overrides,
  }
}

function codes(
  receipt: BindableReceipt,
  observed: ReceiptBindingObservation,
): BindingFindingCode[] {
  return evaluateReceiptBinding(receipt, observed).findings.map((finding) => finding.code)
}

/* --------------------------------------------------------------------------------------------- *
 * The two states that must verify
 * --------------------------------------------------------------------------------------------- */

describe('a legitimate canary binds', () => {
  it('binds a valid initial 25-record completed operation', () => {
    const receipt = completedReceipt()
    const result = evaluateReceiptBinding(receipt, observation(receipt))
    expect(result.findings).toEqual([])
    expect(result.unobserved).toEqual([])
    expect(result.batchScopedProvenanceCount).toBe(25)
    expect(result.claimedPmidCount).toBe(25)
  })

  it('binds a deterministic replay of that same operation', () => {
    // The replay wrote nothing, so its effect counters are zero while the row still records the
    // original operation. Everything else must still agree exactly.
    const receipt = replayReceipt()
    const result = evaluateReceiptBinding(receipt, observation(receipt))
    expect(result.findings).toEqual([])
  })
})

/* --------------------------------------------------------------------------------------------- *
 * Target
 * --------------------------------------------------------------------------------------------- */

describe('a receipt for another project cannot bind, however valid its checksum', () => {
  it('refuses a receipt naming Endoreels while IP_Literature is being read', () => {
    // The exact confirmed false-verification case: the checksum is genuine, the file was never
    // edited, and it describes an operation against the main application project.
    const receipt = completedReceipt(checkpoint({ targetProjectRef: PROHIBITED_ENDOREELS_REF }))
    expect(codes(receipt, observation(receipt))).toEqual(
      expect.arrayContaining([
        'receipt_target_project_not_approved',
        'receipt_target_project_not_observed',
      ]),
    )
  })

  it('refuses a receipt naming an arbitrary third project', () => {
    const receipt = completedReceipt(checkpoint({ targetProjectRef: 'zzzzzzzzzzzzzzzzzzzz' }))
    expect(codes(receipt, observation(receipt))).toContain('receipt_target_project_not_approved')
  })

  it('refuses a receipt whose URL is not the canonical byte sequence', () => {
    const receipt = { ...completedReceipt(), targetUrl: 'https://itcttmkxdxvwmwcmzmey.supabase.co' }
    expect(codes(receipt, observation(receipt as IngestReceipt))).toContain(
      'receipt_target_url_not_canonical',
    )
  })
})

/* --------------------------------------------------------------------------------------------- *
 * Writer and stored identity
 * --------------------------------------------------------------------------------------------- */

describe('the stored row must be the reviewed operation', () => {
  it('refuses a rogue created_by', () => {
    const receipt = completedReceipt()
    expect(
      codes(receipt, observation(receipt, { batch: batchRow(receipt, { created_by: 'psql' }) })),
    ).toContain('batch_created_by_unreviewed')
  })

  it('refuses a null created_by rather than accepting any nonempty string', () => {
    const receipt = completedReceipt()
    expect(
      codes(receipt, observation(receipt, { batch: batchRow(receipt, { created_by: null }) })),
    ).toContain('batch_created_by_unreviewed')
  })

  it.each([
    ['operation id', { operation_id: OTHER_OPERATION_ID }, 'batch_report_operation_id_drift'],
    ['mode', { mode: 'full' }, 'batch_report_mode_drift'],
    ['engine version', { engine_version: 'other/9.9.9' }, 'batch_report_engine_version_drift'],
    ['mapping version', { mapping_version: 'other/9.9.9' }, 'batch_report_mapping_version_drift'],
    [
      'source checksum',
      { source_projection_checksum: 'c'.repeat(64) },
      'batch_report_source_checksum_drift',
    ],
    [
      'manifest checksum',
      { canary_manifest_checksum: 'c'.repeat(64) },
      'batch_report_manifest_checksum_drift',
    ],
  ])('refuses a stored %s that is not the receipt value', (_label, patch, expected) => {
    const receipt = completedReceipt()
    const row = batchRow(receipt)
    expect(
      codes(
        receipt,
        observation(receipt, {
          batch: { ...row, report: { ...(row.report as object), ...patch } },
        }),
      ),
    ).toContain(expected)
  })

  it('refuses a batch that is completed with no completion timestamp', () => {
    const receipt = completedReceipt()
    expect(
      codes(receipt, observation(receipt, { batch: batchRow(receipt, { completed_at: null }) })),
    ).toContain('batch_completed_at_missing')
  })

  it('refuses a batch whose completion timestamp is malformed', () => {
    const receipt = completedReceipt()
    expect(
      codes(receipt, observation(receipt, { batch: batchRow(receipt, { completed_at: 'soon' }) })),
    ).toContain('batch_completed_at_malformed')
  })
})

/* --------------------------------------------------------------------------------------------- *
 * Counters
 * --------------------------------------------------------------------------------------------- */

describe('counters must agree, including on the replay path', () => {
  it('refuses a completed receipt whose counters drifted from the row', () => {
    const receipt = completedReceipt()
    expect(
      codes(receipt, observation(receipt, { batch: batchRow(receipt, { inserted_count: 24 }) })),
    ).toContain('counter_drift')
  })

  it('refuses a replay whose records-read drifted from the operation it replayed', () => {
    // Previously unreachable: a replay was checked only for zero inserts and zero updates, so
    // `records_read`, `unique_pmids`, and `duplicate_count` could be anything at all.
    const receipt = replayReceipt()
    expect(
      codes(receipt, observation(receipt, { batch: batchRow(receipt, { records_read: 9_999 }) })),
    ).toContain('counter_drift')
  })

  it('refuses a replay that claims to have inserted rows', () => {
    const receipt = { ...replayReceipt(), counters: { ...replayReceipt().counters, inserted: 3 } }
    expect(codes(receipt, observation(receipt as IngestReceipt))).toContain(
      'replay_reported_effects',
    )
  })

  it('refuses a nonzero stored error count', () => {
    const receipt = completedReceipt()
    expect(
      codes(receipt, observation(receipt, { batch: batchRow(receipt, { error_count: 1 }) })),
    ).toContain('error_count_nonzero')
  })
})

/* --------------------------------------------------------------------------------------------- *
 * PMID claims and provenance scope
 * --------------------------------------------------------------------------------------------- */

describe('claims are compared before anything becomes a Set', () => {
  it('refuses a receipt that claims the same PMID twice', () => {
    /*
     * The duplicate is the evidence, and `new Set(claimed)` destroyed it: 25 claims with one repeat
     * became 24 distinct claims, compared against 24 rows, and agreed.
     */
    const duplicated = [...PMIDS.slice(0, 24), PMIDS[0]]
    const receipt = { ...completedReceipt(), canaryPmids: duplicated }
    const observed = observation(receipt as IngestReceipt, {
      provenance: provenance(PMIDS.slice(0, 24), OPERATION_ID),
      articleStates: articles(PMIDS.slice(0, 24)),
    })
    const result = evaluateReceiptBinding(receipt, observed)
    expect(result.findings.map((finding) => finding.code)).toContain('claimed_pmids_duplicated')
    // The claim count is preserved as written, not silently reduced to the distinct count.
    expect(result.claimedPmidCount).toBe(25)
  })

  it('refuses provenance that belongs to another batch', () => {
    // Every claimed PMID exists and carries provenance — for a different operation.
    const receipt = completedReceipt()
    expect(
      codes(receipt, observation(receipt, { provenance: provenance(PMIDS, OTHER_OPERATION_ID) })),
    ).toContain('provenance_claim_under_other_batch')
  })

  it('refuses partial provenance under the receipt batch', () => {
    const receipt = completedReceipt()
    expect(
      codes(
        receipt,
        observation(receipt, { provenance: provenance(PMIDS.slice(0, 20), OPERATION_ID) }),
      ),
    ).toContain('provenance_missing_for_claim')
  })

  it('refuses extra provenance in the receipt batch', () => {
    const receipt = completedReceipt()
    expect(
      codes(
        receipt,
        observation(receipt, {
          provenance: [...provenance(PMIDS, OPERATION_ID), { pmid: '7', batch_id: OPERATION_ID }],
        }),
      ),
    ).toContain('provenance_extra_in_batch')
  })

  it('refuses a claimed article that does not exist', () => {
    const receipt = completedReceipt()
    expect(
      codes(receipt, observation(receipt, { articleStates: articles(PMIDS.slice(0, 24)) })),
    ).toContain('article_missing_for_claim')
  })

  it('refuses a claimed article that is not an unreviewed draft', () => {
    const receipt = completedReceipt()
    expect(
      codes(
        receipt,
        observation(receipt, {
          articleStates: [
            ...articles(PMIDS.slice(1)),
            { pmid: PMIDS[0], relevance_state: 'relevant', visibility_state: 'published' },
          ],
        }),
      ),
    ).toContain('article_not_draft_unreviewed')
  })

  it('never echoes a PMID in any finding', () => {
    // The selection is drawn from a review cohort, so an identifier in an error message is a
    // disclosure from exactly the set this package handles most carefully.
    const receipt = completedReceipt()
    const result = evaluateReceiptBinding(
      receipt,
      observation(receipt, {
        provenance: provenance(PMIDS.slice(0, 10), OTHER_OPERATION_ID),
        articleStates: articles(PMIDS.slice(0, 5)),
      }),
    )
    const serialized = JSON.stringify(result.findings)
    for (const pmid of PMIDS) expect(serialized).not.toContain(pmid)
  })
})

/* --------------------------------------------------------------------------------------------- *
 * Observability
 * --------------------------------------------------------------------------------------------- */

describe('an unobserved value is never agreement', () => {
  it('reports unobserved provenance rather than passing', () => {
    const receipt = completedReceipt()
    const result = evaluateReceiptBinding(receipt, observation(receipt, { provenance: null }))
    expect(result.findings).toEqual([])
    expect(result.unobserved).toContain('the provenance rows')
  })

  it('refuses to bind a dry-run receipt to anything', () => {
    const receipt = { ...completedReceipt(), outcome: 'dry-run' as const }
    expect(codes(receipt, observation(receipt as IngestReceipt))).toEqual([
      'receipt_outcome_not_bindable',
    ])
  })

  it('reports a corpus that moved after the receipt was written', () => {
    const receipt = completedReceipt()
    expect(codes(receipt, observation(receipt, { totalArticles: 30 }))).toContain(
      'corpus_total_moved',
    )
  })
})

/* --------------------------------------------------------------------------------------------- *
 * Stored batch state
 * --------------------------------------------------------------------------------------------- */

describe('completion is a state that carries its timestamp', () => {
  it.each([
    [{ status: 'completed', completed_at: AT }, 'completed'],
    [{ status: 'completed', completed_at: null }, 'ambiguous'],
    [{ status: 'completed', completed_at: 'not-a-time' }, 'ambiguous'],
    [{ status: 'started', completed_at: AT }, 'ambiguous'],
    [{ status: 'started', completed_at: null }, 'in_progress'],
    [{ status: 'failed', completed_at: null }, 'failed'],
  ])('classifies %j as %s', (row, expected) => {
    expect(classifyStoredBatchState(row).kind).toBe(expected)
  })

  it('never reads a completed-looking counter set as completion', () => {
    // Counters are deliberately not consulted: only the status and its timestamp are evidence.
    expect(classifyStoredBatchState({ status: 'started', completed_at: null }).kind).toBe(
      'in_progress',
    )
  })

  it('carries the completion timestamp in the completed state itself', () => {
    const state = classifyStoredBatchState({ status: 'completed', completed_at: AT })
    expect(state).toEqual({ kind: 'completed', completedAt: AT })
  })
})

/* --------------------------------------------------------------------------------------------- *
 * Source authority and mode
 * --------------------------------------------------------------------------------------------- */

describe('the receipt names the cohort that authorized it', () => {
  it('accepts the authorized development cohort on a canary', () => {
    expect(completedReceipt().sourceAuthority).toBe(CANARY_SOURCE_AUTHORITY)
  })

  it('refuses a canary receipt naming another authority', () => {
    const receipt = { ...completedReceipt(), sourceAuthority: 'somewhere-else' }
    expect(codes(receipt, observation(receipt as IngestReceipt))).toContain(
      'receipt_source_authority_unreviewed',
    )
  })

  it('refuses a full receipt that claims a canary authority', () => {
    const receipt = {
      ...completedReceipt(),
      mode: 'full' as const,
      canaryPmids: undefined,
      sourceAuthority: CANARY_SOURCE_AUTHORITY,
    }
    expect(codes(receipt, observation(receipt as IngestReceipt))).toContain(
      'receipt_source_authority_unreviewed',
    )
  })
})

/* --------------------------------------------------------------------------------------------- *
 * The complete stored final report
 *
 * Every mutation below independently produced `verdict=verified, pass=26, fail=0, V57=pass` before
 * this correction, because the contract bound only the six identity fields and the verifier's one
 * extra comparison was skipped whenever the stored value was not already a string.
 * --------------------------------------------------------------------------------------------- */

describe('every stable field of the stored report is bound', () => {
  it('reconstructs the complete eleven-field report from receipt and observation alone', () => {
    const receipt = completedReceipt()
    const rebuilt = reconstructStableFinalReport(receipt, batchRow(receipt), 25)

    expect(rebuilt.impossible).toEqual([])
    expect(rebuilt.unresolved).toEqual([])
    expect(Object.keys(rebuilt.report ?? {}).sort()).toEqual([...STABLE_FINAL_REPORT_KEYS].sort())
    // The first-run canary values fall out of the invariants rather than being assumed.
    expect(rebuilt.report).toMatchObject({
      before_article_count: 0,
      after_article_count: 25,
      unchanged_count: 0,
      batch_count: 1,
    })
  })

  it.each([
    [
      'before_article_count wrong',
      { before_article_count: 777 },
      [],
      'batch_report_before_count_drift',
    ],
    ['before_article_count missing', {}, ['before_article_count'], 'batch_report_unexpected_shape'],
    [
      'after_article_count wrong',
      { after_article_count: 999 },
      [],
      'batch_report_after_count_drift',
    ],
    ['after_article_count missing', {}, ['after_article_count'], 'batch_report_unexpected_shape'],
    ['unchanged_count wrong', { unchanged_count: 999 }, [], 'batch_report_unchanged_count_drift'],
    ['unchanged_count missing', {}, ['unchanged_count'], 'batch_report_unexpected_shape'],
    ['batch_count wrong', { batch_count: 999 }, [], 'batch_report_batch_count_drift'],
    ['batch_count missing', {}, ['batch_count'], 'batch_report_unexpected_shape'],
    [
      'batch_checksums_sha256 wrong',
      { batch_checksums_sha256: 'c'.repeat(64) },
      [],
      'batch_report_batch_checksums_drift',
    ],
    [
      'batch_checksums_sha256 missing',
      {},
      ['batch_checksums_sha256'],
      'batch_report_field_malformed',
    ],
    [
      'batch_checksums_sha256 malformed',
      { batch_checksums_sha256: 'not-a-digest' },
      [],
      'batch_report_field_malformed',
    ],
  ])('refuses a report whose %s', (_label, patch, remove, expected) => {
    const receipt = completedReceipt()
    const row = batchRowWithReport(receipt, patch as Record<string, unknown>, remove as string[])
    expect(codes(receipt, observation(receipt, { batch: row }))).toContain(expected)
  })

  it('refuses a null batch_checksums_sha256 rather than skipping the comparison', () => {
    const receipt = completedReceipt()
    const row = batchRowWithReport(receipt, { batch_checksums_sha256: null })
    expect(codes(receipt, observation(receipt, { batch: row }))).toContain(
      'batch_report_field_malformed',
    )
  })

  it('refuses an impossible before/after/insert delta', () => {
    // 30 inserts into a corpus that now holds 25 would mean the operation started from -5.
    const receipt = completedReceipt()
    const row = batchRow(receipt, { inserted_count: 30 })
    expect(codes(receipt, observation(receipt, { batch: row }))).toContain(
      'batch_report_arithmetic_impossible',
    )
  })

  it('refuses a stored before/after pair that contradicts the observed inserts', () => {
    const receipt = completedReceipt()
    const row = batchRowWithReport(receipt, { before_article_count: 10 })
    expect(codes(receipt, observation(receipt, { batch: row }))).toContain(
      'batch_report_before_count_drift',
    )
  })

  it('refuses impossible unchanged arithmetic', () => {
    // 25 inserts plus 5 updates across only 25 unique PMIDs leaves -5 unchanged.
    const receipt = completedReceipt()
    const row = batchRow(receipt, { updated_count: 5 })
    expect(codes(receipt, observation(receipt, { batch: row }))).toContain(
      'batch_report_arithmetic_impossible',
    )
  })

  it('refuses a report carrying a field the engine does not persist', () => {
    const receipt = completedReceipt()
    const row = batchRowWithReport(receipt, { smuggled_total: 999 })
    expect(codes(receipt, observation(receipt, { batch: row }))).toContain(
      'batch_report_unexpected_shape',
    )
  })

  it('gives no verdict on the reconstructed fields when the corpus total was not observed', () => {
    // Unobserved is never agreement, and it is never a failure either.
    const receipt = completedReceipt()
    const result = evaluateReceiptBinding(receipt, observation(receipt, { totalArticles: null }))
    expect(result.findings.map((entry) => entry.code)).not.toContain(
      'batch_report_after_count_drift',
    )
    expect(result.unobserved.join(' ')).toMatch(/corpus total \(stored report binding\)/u)
  })

  it('still binds the receipt-derived fields when the corpus total was not observed', () => {
    // Only before/after need the corpus total. Suspending judgement on `batch_count`,
    // `unchanged_count`, and the checksum summary as well would let an unread total buy a pass on
    // three fields that follow from the receipt and the batch row alone.
    const receipt = completedReceipt()
    const row = batchRowWithReport(receipt, { batch_count: 999 })
    expect(codes(receipt, observation(receipt, { batch: row, totalArticles: null }))).toContain(
      'batch_report_batch_count_drift',
    )
  })

  it('binds the ORIGINAL operation report through a replay receipt', () => {
    /*
     * The regression that matters most: do not close the false positives by breaking replay.
     *
     * The replay receipt reports inserted=0, updated=0, unchanged=25, while the stored report still
     * describes the original operation — inserted 25, unchanged 0, before 0, after 25. Because the
     * expected report is reconstructed from the observed batch row rather than from the receipt's
     * transient counters, both bind against the identical stored report.
     */
    const replay = replayReceipt()
    expect(replay.counters).toMatchObject({ inserted: 0, updated: 0, unchanged: 25 })

    const storedReport = batchRow(completedReceipt()).report
    const result = evaluateReceiptBinding(
      replay,
      observation(replay, { batch: batchRow(replay, { report: storedReport }) }),
    )
    expect(result.findings).toEqual([])

    // And the same stored report, mutated, still fails through the replay path.
    const mutated = batchRow(replay, {
      report: { ...(storedReport as Record<string, unknown>), unchanged_count: 999 },
    })
    expect(codes(replay, observation(replay, { batch: mutated }))).toContain(
      'batch_report_unchanged_count_drift',
    )
  })
})
