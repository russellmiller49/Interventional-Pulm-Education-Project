/**
 * The one binding contract between an ingestion receipt and the database it claims to describe.
 *
 * ## Why this module exists at all
 *
 * Both packages had a notion of "the receipt agrees with the row", and they were not the same
 * notion. The verifier's version could return `verified` while every one of the following was true:
 *
 *   - the project observed was `IP_Literature` and the checksum-valid receipt named Endoreels;
 *   - the matched batch carried a `created_by` nobody reviewed;
 *   - every claimed PMID existed, but its provenance belonged to a different operation;
 *   - the receipt claimed the same PMID twice, and the duplicate vanished into a `Set`;
 *   - the replay counters had drifted from the operation they claimed to replay;
 *   - the receipt's mode, engine version, or mapping version disagreed with the stored row.
 *
 * None of those are exotic. Each is what a stale, copied, or hand-edited receipt looks like, and
 * each was survivable because the two packages checked overlapping-but-different subsets and
 * neither checked the whole thing.
 *
 * So the semantics live here, once, and both packages call the same function. The ingestion
 * package's `verify` command and the verification package's V55–V59 cannot drift apart by
 * construction, because there is nothing to drift from.
 *
 * ## What is deliberately *not* shared
 *
 * The receipt's own checksum is still recomputed independently by each package, against its own
 * copy of the canonicalizer. That duplication is the point: if the engine changes how it
 * canonicalizes, the verifier must notice by failing the checksum rather than by silently agreeing.
 * This module takes an already-parsed receipt and never recomputes or re-blesses that checksum.
 *
 * ## Evidence, not authority
 *
 * Nothing here treats a receipt claim as true. Every field is compared against something read
 * independently from the database, and a receipt that cannot be compared produces an
 * `unobserved` entry — "no verdict" — rather than a pass. A receipt is a file an operator holds;
 * this module is what makes holding it mean something.
 *
 * ## PMIDs never appear in a finding
 *
 * The canary selection is drawn from a review cohort, so the list of identifiers is more sensitive
 * than the records. Every finding below reports counts and never an identifier; the identifiers are
 * in the receipt the operator already has.
 */

import { canonicalJson, sha256 } from './canonical'
import {
  APPROVED_PROJECT_REF,
  APPROVED_PROJECT_URL,
  CANARY_SOURCE_AUTHORITY,
  DEFAULT_CANARY_SIZE,
  ENGINE_VERSION,
  INGEST_WRITER_IDENTITY,
  MAPPING_VERSION,
} from './constants'

/**
 * The summary of a durable batch-checksum sequence, in one place.
 *
 * The engine wrote this into `report.batch_checksums_sha256`, and the verification package had its
 * own transcription of the same algorithm. Two copies of a hash construction is one copy too many:
 * the point of the stored value is that it was computed by the reviewed algorithm, so both sides
 * now call this. `engine.ts` delegates to it, which keeps the engine's checkpoint-shaped helper
 * without giving it a second definition of the hash.
 */
export function batchChecksumSequenceSummary(checksums: readonly string[]): string {
  return sha256(canonicalJson([...checksums]))
}

/** The article states an import is allowed to leave behind. Anything else means something curated. */
export const REQUIRED_ARTICLE_RELEVANCE_STATE = 'unreviewed' as const
export const REQUIRED_ARTICLE_VISIBILITY_STATE = 'draft' as const

/**
 * The receipt as this contract reads it.
 *
 * Structural rather than nominal so both packages can pass their own `IngestReceipt` type without
 * one importing the other's. Everything here is required to already have passed that package's own
 * shape and checksum guard.
 */
export interface BindableReceipt {
  readonly engineVersion: string
  readonly mappingVersion: string
  readonly operationId: string
  readonly mode: 'canary' | 'full'
  readonly outcome: 'completed' | 'dry-run' | 'idempotent-replay'
  readonly targetProjectRef: string | null
  readonly targetUrl: string | null
  readonly writerIdentity: string
  readonly sourceAuthority: string | null
  readonly sourceProjectionChecksum: string
  readonly sourceRecordCount: number
  readonly canaryManifestChecksum: string | null
  readonly canaryPmids?: readonly string[]
  readonly beforeArticleCount: number | null
  readonly afterArticleCount: number | null
  readonly counters: {
    readonly recordsRead: number
    readonly uniquePmids: number
    readonly duplicateOccurrences: number
    readonly inserted: number
    readonly updated: number
    readonly unchanged: number
    readonly errors: number
  }
  readonly batchChecksums: readonly string[]
  readonly importBatchId: string | null
}

/** The stored batch row, as both packages read it. */
export interface ObservedBatchRow {
  readonly id: string
  readonly status: string
  readonly completed_at?: string | null
  readonly created_by?: string | null
  readonly source_file_sha256?: string | null
  readonly records_read: number
  readonly unique_pmids: number
  readonly inserted_count: number
  readonly updated_count: number
  readonly duplicate_count: number
  readonly error_count: number
  readonly report?: unknown
}

/** One provenance edge. The primary key is (pmid, batch_id), so `batch_id` is what scopes it. */
export interface ObservedProvenanceRow {
  readonly pmid: string
  readonly batch_id: string
}

/** The live state of one article, read independently of anything the receipt says. */
export interface ObservedArticleState {
  readonly pmid: string
  readonly relevance_state: string
  readonly visibility_state: string
}

/**
 * Everything read independently from the target, and `null` wherever a read did not happen.
 *
 * `null` is never treated as zero, empty, or absent — it produces an `unobserved` entry and the
 * dependent conclusion is withheld.
 */
export interface ReceiptBindingObservation {
  /** The project ref the transport actually resolved, not the one the receipt names. */
  readonly observedProjectRef: string | null
  /** The project URL the transport actually used, byte for byte. */
  readonly observedUrl: string | null
  /** The batch the receipt names, if it exists in this project. */
  readonly batch: ObservedBatchRow | null
  /** Whether the batch lookup itself happened. Distinguishes "absent" from "not read". */
  readonly batchesObserved: boolean
  /** Every provenance row read. Scoping to the receipt's batch happens here, not at the call site. */
  readonly provenance: readonly ObservedProvenanceRow[] | null
  /** Live article state for (at least) every claimed PMID. */
  readonly articleStates: readonly ObservedArticleState[] | null
  readonly totalArticles: number | null
}

/** The reviewed identity a production receipt must bind to. */
export interface ReceiptBindingExpectation {
  readonly targetProjectRef: string
  readonly targetUrl: string
  readonly writerIdentity: string
  readonly engineVersion: string
  readonly mappingVersion: string
  readonly canarySourceAuthority: string
  readonly canaryRecordCount: number
}

export const PRODUCTION_RECEIPT_BINDING: ReceiptBindingExpectation = {
  targetProjectRef: APPROVED_PROJECT_REF,
  targetUrl: APPROVED_PROJECT_URL,
  writerIdentity: INGEST_WRITER_IDENTITY,
  engineVersion: ENGINE_VERSION,
  mappingVersion: MAPPING_VERSION,
  canarySourceAuthority: CANARY_SOURCE_AUTHORITY,
  canaryRecordCount: DEFAULT_CANARY_SIZE,
}

export type BindingFindingCode =
  | 'receipt_target_project_not_approved'
  | 'receipt_target_project_not_observed'
  | 'receipt_target_url_not_canonical'
  | 'receipt_target_url_not_observed'
  | 'receipt_engine_version_unreviewed'
  | 'receipt_mapping_version_unreviewed'
  | 'receipt_writer_identity_unreviewed'
  | 'receipt_source_authority_unreviewed'
  | 'receipt_outcome_not_bindable'
  | 'receipt_batch_id_absent'
  | 'receipt_batch_id_not_operation_id'
  | 'batch_absent_from_project'
  | 'batch_created_by_unreviewed'
  | 'batch_not_completed'
  | 'batch_completed_at_missing'
  | 'batch_completed_at_malformed'
  | 'batch_report_absent'
  | 'batch_report_operation_id_drift'
  | 'batch_report_mode_drift'
  | 'batch_report_engine_version_drift'
  | 'batch_report_mapping_version_drift'
  | 'batch_report_source_checksum_drift'
  | 'batch_report_manifest_checksum_drift'
  | 'batch_report_unchanged_count_drift'
  | 'batch_report_before_count_drift'
  | 'batch_report_after_count_drift'
  | 'batch_report_batch_count_drift'
  | 'batch_report_batch_checksums_drift'
  | 'batch_report_field_malformed'
  | 'batch_report_unexpected_shape'
  | 'batch_report_arithmetic_impossible'
  | 'batch_identity_source_checksum_drift'
  | 'counter_drift'
  | 'replay_reported_effects'
  | 'error_count_nonzero'
  | 'claimed_pmids_duplicated'
  | 'claimed_pmids_wrong_cardinality'
  | 'claimed_pmids_malformed'
  | 'provenance_missing_for_claim'
  | 'provenance_extra_in_batch'
  | 'provenance_claim_under_other_batch'
  | 'article_missing_for_claim'
  | 'article_not_draft_unreviewed'
  | 'corpus_total_moved'

export interface BindingFinding {
  readonly code: BindingFindingCode
  /** Which bound value failed, in operator language. Never contains a PMID. */
  readonly subject: string
  /** Why it failed, in counts. Never contains a PMID. */
  readonly detail: string
}

export interface ReceiptBindingResult {
  /** Every disagreement. Empty means every *observed* bound value agreed. */
  readonly findings: readonly BindingFinding[]
  /** Values that could not be judged because they were not read. Never a pass, never a failure. */
  readonly unobserved: readonly string[]
  /** How many distinct PMIDs carry provenance under exactly the receipt's batch. */
  readonly batchScopedProvenanceCount: number | null
  /** The claim count as written, before any deduplication. */
  readonly claimedPmidCount: number | null
}

function finding(code: BindingFindingCode, subject: string, detail: string): BindingFinding {
  return { code, subject, detail }
}

function reportRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/* ============================================================================================= *
 * The stable final report
 * ============================================================================================= */

/**
 * Every key the engine's finalization persists into `literature_import_batches.report`.
 *
 * One explicit definition, in the shared contract, because there had been three implicit ones: the
 * engine wrote eleven fields, the engine's own verifier compared all eleven by canonical-JSON
 * equality, and this contract compared six. The six were the identity fields, which is why the gap
 * was easy to miss — every mutation of the *other five* left a receipt that still bound cleanly:
 * `before_article_count: 777`, `after_article_count: 999`, `unchanged_count: 999`,
 * `batch_count: 999`, and an omitted `batch_checksums_sha256` each independently produced
 * `verified`, `pass=26`, `fail=0`.
 */
export const STABLE_FINAL_REPORT_KEYS = [
  'engine_version',
  'mapping_version',
  'operation_id',
  'mode',
  'source_projection_checksum',
  'canary_manifest_checksum',
  'unchanged_count',
  'before_article_count',
  'after_article_count',
  'batch_count',
  'batch_checksums_sha256',
] as const

export type StableFinalReportKey = (typeof STABLE_FINAL_REPORT_KEYS)[number]

export interface StableFinalReportReconstruction {
  /**
   * Every field that could be reconstructed, and only those.
   *
   * Partial rather than all-or-nothing: `before_article_count` and `after_article_count` are the
   * only two that need the corpus total, so an unobserved total must not also suspend judgement on
   * `unchanged_count`, `batch_count`, and the checksum summary — those follow from the receipt and
   * the batch row alone. A field absent here is withheld, never assumed to agree.
   */
  readonly report: Readonly<Partial<Record<StableFinalReportKey, unknown>>>
  /** What could not be reconstructed, and why. Reported as no verdict, never as agreement. */
  readonly unresolved: readonly string[]
  /** Arithmetic that cannot describe any real operation, whatever the stored report says. */
  readonly impossible: readonly string[]
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/**
 * Rebuild the complete report a healthy operation must have persisted.
 *
 * Nothing here is copied out of the stored report — that would make the comparison vacuous. Every
 * value is derived from the receipt (already checksum-verified and identity-bound above) or from
 * rows read independently from the database:
 *
 *   - `after_article_count` is the **observed corpus total**. The contract has already required the
 *     receipt's own after-count to equal it, and required this batch to account for every
 *     provenance row it carries, so the operation being bound is the one that left the corpus at
 *     this size.
 *   - `before_article_count` follows from the engine's own finalization invariant,
 *     `after - before = inserted`, using the **observed batch row's** `inserted_count`. For the
 *     first-run canary that yields `before = 0`, `after = 25` without either being assumed.
 *   - `unchanged_count` is `unique_pmids - inserted_count - updated_count`, again from the observed
 *     row.
 *   - `batch_count` and `batch_checksums_sha256` come from the receipt's durable batch-checksum
 *     sequence, summarized by the engine's own algorithm.
 *
 * ## Why the replay receipt is not consulted for these
 *
 * The stored report describes the **original completed operation**; a replay receipt describes the
 * later no-write replay. Their effect counters disagree by design — a replay reports
 * `inserted: 0`, `updated: 0`, `unchanged: 25` while the original reported `inserted: 25`,
 * `unchanged: 0`. Reconstructing from the *observed batch row* rather than from the receipt's
 * counters is what lets one contract bind both without weakening either: the row still records the
 * original operation in both cases, and the durable batch-checksum sequence is carried identically
 * by both receipts.
 */
export function reconstructStableFinalReport(
  receipt: BindableReceipt,
  batch: ObservedBatchRow,
  totalArticles: number | null,
): StableFinalReportReconstruction {
  const unresolved: string[] = []
  const impossible: string[] = []

  // Always available: these follow from the receipt alone, which is already checksum-verified and
  // identity-bound by the checks above.
  const report: Partial<Record<StableFinalReportKey, unknown>> = {
    engine_version: receipt.engineVersion,
    mapping_version: receipt.mappingVersion,
    operation_id: receipt.operationId,
    mode: receipt.mode,
    source_projection_checksum: receipt.sourceProjectionChecksum,
    canary_manifest_checksum: receipt.canaryManifestChecksum,
    batch_count: receipt.batchChecksums.length,
    batch_checksums_sha256: batchChecksumSequenceSummary(receipt.batchChecksums),
  }

  const countable = (['inserted_count', 'updated_count', 'unique_pmids'] as const).filter(
    (key) => !isNonNegativeInteger(batch[key]),
  )
  for (const key of countable) unresolved.push(`the batch row's ${key}`)

  if (countable.length === 0) {
    const unchangedCount = batch.unique_pmids - batch.inserted_count - batch.updated_count
    if (unchangedCount < 0) {
      impossible.push(
        `the batch reports ${batch.inserted_count} insert(s) and ${batch.updated_count} update(s) ` +
          `across only ${batch.unique_pmids} unique PMID(s)`,
      )
    } else {
      report.unchanged_count = unchangedCount
    }

    if (totalArticles === null) {
      unresolved.push('the corpus total')
    } else {
      const beforeArticleCount = totalArticles - batch.inserted_count
      if (beforeArticleCount < 0) {
        impossible.push(
          `the batch reports ${batch.inserted_count} insert(s) into a corpus that now holds ` +
            `${totalArticles}, so the operation would have started from a negative count`,
        )
      } else {
        report.before_article_count = beforeArticleCount
        report.after_article_count = totalArticles
      }
    }
  } else if (totalArticles === null) {
    unresolved.push('the corpus total')
  }

  return { report, unresolved, impossible }
}

/**
 * Duplicate detection that runs *before* anything becomes a `Set`.
 *
 * The previous code compared `new Set(claimed)` against the observed PMIDs, so a receipt claiming
 * the same identifier twice compared 24 distinct claims against 24 rows and agreed. The duplicate
 * was the evidence, and converting to a set was what destroyed it. The original order and count are
 * preserved here for exactly that reason.
 */
function duplicateClaimCount(claimed: readonly string[]): number {
  const seen = new Set<string>()
  let duplicates = 0
  for (const pmid of claimed) {
    if (seen.has(pmid)) duplicates += 1
    else seen.add(pmid)
  }
  return duplicates
}

/**
 * Compare a receipt against what was independently observed.
 *
 * Pure, total, and side-effect free: it reads two values and returns a verdict about them. The
 * caller decides what a finding *means* — the ingestion package throws, the verification package
 * renders check results — but neither decides what counts as bound.
 */
export function evaluateReceiptBinding(
  receipt: BindableReceipt,
  observation: ReceiptBindingObservation,
  expectation: ReceiptBindingExpectation = PRODUCTION_RECEIPT_BINDING,
): ReceiptBindingResult {
  const findings: BindingFinding[] = []
  const unobserved: string[] = []

  /* --------------------------------------------------------------------------------------- *
   * Target. A checksum-valid receipt for another project is the failure this ordering exists
   * for: it is checked first and it is checked against the live transport, not against itself.
   * --------------------------------------------------------------------------------------- */

  if (receipt.outcome === 'dry-run') {
    findings.push(
      finding(
        'receipt_outcome_not_bindable',
        'receipt outcome',
        'The receipt records a dry run, which writes nothing and names no batch. There is no ' +
          'operation to bind to a database row.',
      ),
    )
    return { findings, unobserved, batchScopedProvenanceCount: null, claimedPmidCount: null }
  }

  if (receipt.targetProjectRef !== expectation.targetProjectRef) {
    findings.push(
      finding(
        'receipt_target_project_not_approved',
        'receipt target project',
        `The receipt names project ${receipt.targetProjectRef ?? '(none)'}; the only approved ` +
          `Literature production project is ${expectation.targetProjectRef}. A valid checksum ` +
          'proves the file was not edited, not that it describes this project.',
      ),
    )
  }
  if (receipt.targetUrl !== expectation.targetUrl) {
    findings.push(
      finding(
        'receipt_target_url_not_canonical',
        'receipt target URL',
        'The receipt does not name the canonical production URL byte for byte. The scheme case, ' +
          'the trailing slash, and any port or path are all part of the comparison.',
      ),
    )
  }
  if (observation.observedProjectRef === null) {
    unobserved.push('the project ref the transport resolved')
  } else if (observation.observedProjectRef !== receipt.targetProjectRef) {
    findings.push(
      finding(
        'receipt_target_project_not_observed',
        'observed project versus receipt',
        `The transport is reading ${observation.observedProjectRef}; the receipt describes ` +
          `${receipt.targetProjectRef ?? '(none)'}. These observations are about different ` +
          'databases, so nothing the receipt claims can be confirmed here.',
      ),
    )
  }
  if (observation.observedUrl === null) {
    unobserved.push('the project URL the transport used')
  } else if (observation.observedUrl !== receipt.targetUrl) {
    findings.push(
      finding(
        'receipt_target_url_not_observed',
        'observed URL versus receipt',
        'The URL being read is not the URL the receipt names.',
      ),
    )
  }

  /* --------------------------------------------------------------------------------------- *
   * Reviewed identity. Not "some nonempty string" — the exact values that were reviewed.
   * --------------------------------------------------------------------------------------- */

  if (receipt.engineVersion !== expectation.engineVersion) {
    findings.push(
      finding(
        'receipt_engine_version_unreviewed',
        'engine version',
        `The receipt was written by ${receipt.engineVersion}; the reviewed engine is ` +
          `${expectation.engineVersion}.`,
      ),
    )
  }
  if (receipt.mappingVersion !== expectation.mappingVersion) {
    findings.push(
      finding(
        'receipt_mapping_version_unreviewed',
        'mapping version',
        `The receipt used mapping ${receipt.mappingVersion}; the reviewed mapping is ` +
          `${expectation.mappingVersion}.`,
      ),
    )
  }
  if (receipt.writerIdentity !== expectation.writerIdentity) {
    findings.push(
      finding(
        'receipt_writer_identity_unreviewed',
        'writer identity',
        `The receipt names writer ${receipt.writerIdentity}; the reviewed ingestion writer is ` +
          `${expectation.writerIdentity}.`,
      ),
    )
  }
  const expectedAuthority = receipt.mode === 'canary' ? expectation.canarySourceAuthority : null
  if (receipt.sourceAuthority !== expectedAuthority) {
    findings.push(
      finding(
        'receipt_source_authority_unreviewed',
        'source authority',
        receipt.mode === 'canary'
          ? `A canary receipt must name ${expectation.canarySourceAuthority} as its source ` +
              'authority; this one does not.'
          : 'A full-corpus receipt must not claim a canary source authority.',
      ),
    )
  }

  /* --------------------------------------------------------------------------------------- *
   * The batch the receipt names.
   * --------------------------------------------------------------------------------------- */

  if (receipt.importBatchId === null) {
    findings.push(
      finding(
        'receipt_batch_id_absent',
        'receipt batch id',
        'A completed or replayed operation records the batch it wrote. This receipt records none.',
      ),
    )
  } else if (receipt.importBatchId !== receipt.operationId) {
    findings.push(
      finding(
        'receipt_batch_id_not_operation_id',
        'receipt batch id',
        'The engine writes one batch row per operation, keyed by the operation id. This receipt ' +
          'names a batch that is not its own operation.',
      ),
    )
  }

  const batch = observation.batch
  if (!observation.batchesObserved) {
    unobserved.push('the import batch rows')
  } else if (!batch) {
    findings.push(
      finding(
        'batch_absent_from_project',
        'import batch',
        'The batch this receipt names does not exist in this project. The corpus being read was ' +
          'not written by the operation the receipt describes.',
      ),
    )
  } else {
    if (batch.created_by === undefined) {
      unobserved.push('the batch writer (`created_by`)')
    } else if (batch.created_by !== expectation.writerIdentity) {
      findings.push(
        finding(
          'batch_created_by_unreviewed',
          'batch writer',
          `The batch row was written by ${batch.created_by ?? '(null)'}; the reviewed ingestion ` +
            `writer is ${expectation.writerIdentity}. A row written by something else is not ` +
            'this operation, whatever the receipt says.',
        ),
      )
    }

    if (batch.status !== 'completed') {
      findings.push(
        finding(
          'batch_not_completed',
          'batch status',
          `The batch row records status "${batch.status}". A receipt describing a completed or ` +
            'replayed operation cannot bind to a row that never completed.',
        ),
      )
    } else if (batch.completed_at === undefined) {
      unobserved.push('the batch completion timestamp')
    } else if (batch.completed_at === null) {
      findings.push(
        finding(
          'batch_completed_at_missing',
          'batch completion timestamp',
          'The batch row is marked completed and carries no completion timestamp. That state is ' +
            'internally inconsistent: it is not evidence of completion, and it is not evidence ' +
            'of failure either.',
        ),
      )
    } else if (!Number.isFinite(Date.parse(batch.completed_at))) {
      findings.push(
        finding(
          'batch_completed_at_malformed',
          'batch completion timestamp',
          'The batch row is marked completed and its completion timestamp is not a parseable ' +
            'instant.',
        ),
      )
    }

    if (
      batch.source_file_sha256 !== undefined &&
      batch.source_file_sha256 !== receipt.sourceProjectionChecksum
    ) {
      findings.push(
        finding(
          'batch_identity_source_checksum_drift',
          'batch source checksum',
          'The batch row records a different source projection checksum than the receipt.',
        ),
      )
    }

    const report = reportRecord(batch.report)
    if (report === null) {
      findings.push(
        finding(
          'batch_report_absent',
          'stored operation identity',
          'The batch row carries no report object, so it was written by something other than the ' +
            'production ingestion engine and holds no stored identity to compare against.',
        ),
      )
    } else {
      const drift = (
        code: BindingFindingCode,
        subject: string,
        stored: unknown,
        claimed: unknown,
      ) => {
        if (stored !== claimed) {
          findings.push(
            finding(
              code,
              subject,
              `The batch row stores ${JSON.stringify(stored) ?? 'undefined'} and the receipt ` +
                `claims ${JSON.stringify(claimed) ?? 'undefined'}. These are written at ` +
                'different times by the same operation, so a disagreement means the receipt does ' +
                'not describe this row.',
            ),
          )
        }
      }
      drift(
        'batch_report_operation_id_drift',
        'stored operation id',
        report.operation_id,
        receipt.operationId,
      )
      drift('batch_report_mode_drift', 'stored mode', report.mode, receipt.mode)
      drift(
        'batch_report_engine_version_drift',
        'stored engine version',
        report.engine_version,
        receipt.engineVersion,
      )
      drift(
        'batch_report_mapping_version_drift',
        'stored mapping version',
        report.mapping_version,
        receipt.mappingVersion,
      )
      drift(
        'batch_report_source_checksum_drift',
        'stored source projection checksum',
        report.source_projection_checksum,
        receipt.sourceProjectionChecksum,
      )
      drift(
        'batch_report_manifest_checksum_drift',
        'stored canary manifest checksum',
        report.canary_manifest_checksum,
        receipt.canaryManifestChecksum,
      )

      /*
       * The five fields that were not bound at all.
       *
       * Each is compared against a value reconstructed from the receipt and from rows read
       * independently — never against the stored report itself. A missing key is a failure exactly
       * like a wrong one: `undefined` is not a value the engine writes, and the previous
       * `typeof stored === 'string'` guard on the checksum summary turned an omitted field into a
       * skipped comparison, which is how deleting it produced a pass.
       */
      const expected = reconstructStableFinalReport(receipt, batch, observation.totalArticles)

      const shape = STABLE_FINAL_REPORT_KEYS.filter((key) => !(key in report))
      const extra = Object.keys(report).filter(
        (key) => !(STABLE_FINAL_REPORT_KEYS as readonly string[]).includes(key),
      )
      if (shape.length > 0 || extra.length > 0) {
        findings.push(
          finding(
            'batch_report_unexpected_shape',
            'stored report shape',
            `The stored report is not the report this engine writes: ` +
              `${shape.length > 0 ? `missing ${shape.join(', ')}. ` : ''}` +
              `${extra.length > 0 ? `unexpected ${extra.join(', ')}. ` : ''}` +
              'The engine persists exactly these eleven fields at finalization, and its own ' +
              'verifier compares the whole object, so a different shape is drift rather than a ' +
              'field this contract may skip.',
          ),
        )
      }

      for (const reason of expected.impossible) {
        findings.push(
          finding(
            'batch_report_arithmetic_impossible',
            'stored operation arithmetic',
            `No real operation matches what was observed: ${reason}. The stored report cannot be ` +
              'reconstructed, so it cannot be confirmed.',
          ),
        )
      }

      const numericFields: readonly [StableFinalReportKey, BindingFindingCode, string][] = [
        ['unchanged_count', 'batch_report_unchanged_count_drift', 'stored unchanged count'],
        ['before_article_count', 'batch_report_before_count_drift', 'stored before-article count'],
        ['after_article_count', 'batch_report_after_count_drift', 'stored after-article count'],
        ['batch_count', 'batch_report_batch_count_drift', 'stored batch count'],
      ]
      for (const [key, code, subject] of numericFields) {
        if (key in report && !isNonNegativeInteger(report[key])) {
          findings.push(
            finding(
              'batch_report_field_malformed',
              subject,
              `The stored ${key} is ${JSON.stringify(report[key]) ?? 'undefined'}, which is not a ` +
                'non-negative integer.',
            ),
          )
          continue
        }
        // Only compared when the expected value could be reconstructed; a withheld field is
        // reported as no verdict below rather than silently passing.
        if (key in expected.report && report[key] !== expected.report[key]) {
          drift(code, subject, report[key], expected.report[key])
        }
      }

      const storedSummary = report.batch_checksums_sha256
      if (typeof storedSummary !== 'string' || !/^[a-f0-9]{64}$/u.test(storedSummary)) {
        findings.push(
          finding(
            'batch_report_field_malformed',
            'stored batch checksum summary',
            'The stored batch_checksums_sha256 is absent or is not a lowercase SHA-256 digest. It ' +
              'is required: it is the only stored value that summarizes the durable batch sequence.',
          ),
        )
      } else if (storedSummary !== expected.report.batch_checksums_sha256) {
        drift(
          'batch_report_batch_checksums_drift',
          'stored batch checksum summary',
          storedSummary,
          expected.report.batch_checksums_sha256,
        )
      }

      if (expected.unresolved.length > 0) {
        unobserved.push(...expected.unresolved.map((entry) => `${entry} (stored report binding)`))
      }
    }

    /*
     * Counters.
     *
     * A completion receipt describes the row directly. A replay receipt describes what the *replay*
     * did — nothing — while the row still records the original operation, so the two disagree by
     * design on the effect columns and must agree exactly on everything else. Checking only that a
     * replay reported zero inserts let `records_read`, `unique_pmids`, and `duplicate_count` drift
     * arbitrarily from the operation the replay claimed to be repeating.
     */
    const counterDrift: string[] = []
    const compare = (label: string, claimed: number, stored: number) => {
      if (claimed !== stored) counterDrift.push(`${label} ${claimed} vs ${stored}`)
    }
    compare('records read', receipt.counters.recordsRead, batch.records_read)
    compare('unique PMIDs', receipt.counters.uniquePmids, batch.unique_pmids)
    compare('duplicates', receipt.counters.duplicateOccurrences, batch.duplicate_count)

    if (receipt.outcome === 'idempotent-replay') {
      if (receipt.counters.inserted !== 0 || receipt.counters.updated !== 0) {
        findings.push(
          finding(
            'replay_reported_effects',
            'replay effects',
            `A replay must write nothing; this receipt reports ${receipt.counters.inserted} ` +
              `insert(s) and ${receipt.counters.updated} update(s).`,
          ),
        )
      }
      if (receipt.counters.unchanged !== receipt.counters.uniquePmids) {
        counterDrift.push(
          `unchanged ${receipt.counters.unchanged} vs unique PMIDs ${receipt.counters.uniquePmids}`,
        )
      }
    } else {
      compare('inserted', receipt.counters.inserted, batch.inserted_count)
      compare('updated', receipt.counters.updated, batch.updated_count)
    }

    if (counterDrift.length > 0) {
      findings.push(
        finding(
          'counter_drift',
          'receipt counters',
          `The receipt and its batch row disagree: ${counterDrift.join('; ')}. One of the two was ` +
            'written or edited outside the engine.',
        ),
      )
    }
    if (receipt.counters.errors !== 0 || batch.error_count !== 0) {
      findings.push(
        finding(
          'error_count_nonzero',
          'error count',
          `The operation records ${receipt.counters.errors} receipt error(s) and ` +
            `${batch.error_count} stored error(s). A bound operation records none.`,
        ),
      )
    }
  }

  /* --------------------------------------------------------------------------------------- *
   * The claimed PMIDs, and the live rows that are supposed to correspond to them.
   * --------------------------------------------------------------------------------------- */

  const claimed = receipt.canaryPmids
  let batchScopedProvenanceCount: number | null = null
  let claimedPmidCount: number | null = null

  if (receipt.mode === 'canary') {
    if (claimed === undefined) {
      findings.push(
        finding(
          'claimed_pmids_wrong_cardinality',
          'claimed PMIDs',
          'A canary receipt names the exact records it wrote. This one names none.',
        ),
      )
    } else {
      claimedPmidCount = claimed.length
      const duplicates = duplicateClaimCount(claimed)
      if (duplicates > 0) {
        findings.push(
          finding(
            'claimed_pmids_duplicated',
            'claimed PMIDs',
            `The receipt claims ${claimed.length} PMID(s) of which ${duplicates} are repeats. A ` +
              'repeated claim is evidence of an edited or assembled receipt, and deduplicating it ' +
              'before comparison is what previously let it pass.',
          ),
        )
      }
      if (claimed.length !== expectation.canaryRecordCount) {
        findings.push(
          finding(
            'claimed_pmids_wrong_cardinality',
            'claimed PMIDs',
            `The receipt claims ${claimed.length} PMID(s); an authorized canary is exactly ` +
              `${expectation.canaryRecordCount}.`,
          ),
        )
      }
      if (claimed.some((pmid) => typeof pmid !== 'string' || !/^[1-9]\d{0,11}$/u.test(pmid))) {
        findings.push(
          finding(
            'claimed_pmids_malformed',
            'claimed PMIDs',
            'At least one claimed identifier is not a PMID. The values are deliberately not ' +
              'echoed here.',
          ),
        )
      }
    }
  }

  if (claimed !== undefined && claimed.length > 0) {
    if (observation.provenance === null) {
      unobserved.push('the provenance rows')
    } else if (receipt.importBatchId === null) {
      unobserved.push('provenance scoped to the receipt batch (the receipt names no batch)')
    } else {
      /*
       * Strictly scoped. The previous collector gathered every provenance row in the project and
       * compared the union against the claim, so provenance written by a *different* operation for
       * the same PMIDs satisfied the receipt completely.
       */
      const batchId = receipt.importBatchId
      const inBatch = new Set<string>()
      const elsewhere = new Set<string>()
      for (const row of observation.provenance) {
        if (row.batch_id === batchId) inBatch.add(row.pmid)
        else elsewhere.add(row.pmid)
      }
      batchScopedProvenanceCount = inBatch.size

      const claimedSet = new Set(claimed)
      const missing = [...claimedSet].filter((pmid) => !inBatch.has(pmid))
      const extra = [...inBatch].filter((pmid) => !claimedSet.has(pmid))
      const onlyElsewhere = missing.filter((pmid) => elsewhere.has(pmid))

      if (onlyElsewhere.length > 0) {
        findings.push(
          finding(
            'provenance_claim_under_other_batch',
            'provenance scope',
            `${onlyElsewhere.length} claimed PMID(s) carry provenance, but under a different ` +
              'batch than the one this receipt names. Provenance belonging to another operation ' +
              'does not satisfy this receipt.',
          ),
        )
      }
      const trulyMissing = missing.length - onlyElsewhere.length
      if (trulyMissing > 0) {
        findings.push(
          finding(
            'provenance_missing_for_claim',
            'provenance coverage',
            `${trulyMissing} of the ${claimedSet.size} distinct claimed PMID(s) have no ` +
              'provenance under this batch at all.',
          ),
        )
      }
      if (extra.length > 0) {
        findings.push(
          finding(
            'provenance_extra_in_batch',
            'provenance coverage',
            `This batch carries provenance for ${extra.length} further PMID(s) the receipt does ` +
              'not account for.',
          ),
        )
      }
    }

    if (observation.articleStates === null) {
      unobserved.push('the live article states')
    } else {
      const byPmid = new Map(observation.articleStates.map((row) => [row.pmid, row]))
      const claimedSet = new Set(claimed)
      let absent = 0
      let wrongState = 0
      for (const pmid of claimedSet) {
        const row = byPmid.get(pmid)
        if (!row) {
          absent += 1
        } else if (
          row.relevance_state !== REQUIRED_ARTICLE_RELEVANCE_STATE ||
          row.visibility_state !== REQUIRED_ARTICLE_VISIBILITY_STATE
        ) {
          wrongState += 1
        }
      }
      if (absent > 0) {
        findings.push(
          finding(
            'article_missing_for_claim',
            'claimed articles',
            `${absent} of the ${claimedSet.size} distinct claimed PMID(s) have no article row.`,
          ),
        )
      }
      if (wrongState > 0) {
        findings.push(
          finding(
            'article_not_draft_unreviewed',
            'claimed article state',
            `${wrongState} claimed article(s) are not ` +
              `${REQUIRED_ARTICLE_RELEVANCE_STATE}/${REQUIRED_ARTICLE_VISIBILITY_STATE}. An ` +
              'import writes the foundation defaults; anything else means something curated rows.',
          ),
        )
      }
    }
  }

  /* --------------------------------------------------------------------------------------- *
   * The corpus total the operator reads off the administration page.
   * --------------------------------------------------------------------------------------- */

  if (observation.totalArticles === null) {
    unobserved.push('the corpus total')
  } else if (receipt.afterArticleCount === null) {
    unobserved.push('the receipt after-count')
  } else if (receipt.afterArticleCount !== observation.totalArticles) {
    findings.push(
      finding(
        'corpus_total_moved',
        'corpus total',
        `The receipt recorded ${receipt.afterArticleCount} article(s) after the operation; the ` +
          `database now holds ${observation.totalArticles}. Something other than this operation ` +
          'has written to the corpus.',
      ),
    )
  }

  return { findings, unobserved, batchScopedProvenanceCount, claimedPmidCount }
}

/* ============================================================================================= *
 * Stored batch state
 * ============================================================================================= */

export type StoredBatchStateKind = 'completed' | 'in_progress' | 'failed' | 'ambiguous'

export type AmbiguousBatchReason =
  | 'completed_without_completion_timestamp'
  | 'completed_with_malformed_completion_timestamp'
  | 'incomplete_with_completion_timestamp'

/**
 * A stored batch row, resolved into a state that cannot lie about itself.
 *
 * The defect this replaces: a remote row with `status = 'completed'` and `completed_at = null` was
 * classified `applied_exact`, which let a resume make no finalization request and emit a completed
 * receipt for an operation nothing had confirmed. `completed` is now a state that *carries* its
 * timestamp, so there is no way to hold a completed batch without one, and the inconsistent row
 * resolves to `ambiguous` — a stop, not a conclusion.
 *
 * Counters are deliberately not consulted. A row whose counters look finished is not finished; the
 * status and its timestamp are the only completion evidence there is.
 */
export type StoredBatchState =
  | { readonly kind: 'completed'; readonly completedAt: string }
  | { readonly kind: 'in_progress' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'ambiguous'; readonly reason: AmbiguousBatchReason }

export function classifyStoredBatchState(row: {
  readonly status: string
  readonly completed_at?: string | null
}): StoredBatchState {
  const completedAt = row.completed_at ?? null
  if (row.status === 'completed') {
    if (completedAt === null) {
      return { kind: 'ambiguous', reason: 'completed_without_completion_timestamp' }
    }
    if (!Number.isFinite(Date.parse(completedAt))) {
      return { kind: 'ambiguous', reason: 'completed_with_malformed_completion_timestamp' }
    }
    return { kind: 'completed', completedAt }
  }
  if (completedAt !== null) {
    return { kind: 'ambiguous', reason: 'incomplete_with_completion_timestamp' }
  }
  return row.status === 'failed' ? { kind: 'failed' } : { kind: 'in_progress' }
}

export function describeAmbiguousBatch(reason: AmbiguousBatchReason): string {
  switch (reason) {
    case 'completed_without_completion_timestamp':
      return (
        'The batch is marked completed and carries no completion timestamp. That is not evidence ' +
        'of completion and not evidence of failure; it is an inconsistent row that must be ' +
        'reobserved read-only and resolved by hand before any further write.'
      )
    case 'completed_with_malformed_completion_timestamp':
      return (
        'The batch is marked completed and its completion timestamp is not a parseable instant, ' +
        'so what the row records cannot be established.'
      )
    case 'incomplete_with_completion_timestamp':
      return (
        'The batch carries a completion timestamp without a completed status, so the row ' +
        'contradicts itself about whether the operation finished.'
      )
  }
}
