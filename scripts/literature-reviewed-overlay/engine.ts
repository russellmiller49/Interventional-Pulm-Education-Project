/**
 * The reviewed-overlay engine: validate, dry-run, apply, reconcile, and verify.
 *
 * The engine never touches process.env, argv, or the network directly — everything arrives
 * through `OverlayEngineDependencies`, so the production CLI and the disposable rehearsal drive
 * the identical orchestration. Destination requests happen only inside `apply` (bounded RPC
 * calls behind the full gate set), `reconcile` (GET/HEAD only), and `verify` (GET/HEAD only).
 */

import { stat } from 'node:fs/promises'

import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import type { ArtifactTruth } from './artifact'
import {
  acquireOverlayLease,
  readOverlayCheckpoint,
  writeOverlayCheckpoint,
  writeOverlayReceiptImmutable,
  type OverlayCheckpoint,
  type OverlayCheckpointBatch,
  type OverlayReceipt,
  type OverlayReceiptBody,
} from './checkpoint'
import {
  APPROVED_PROJECT_REF,
  APPROVED_PROJECT_URL,
  OVERLAY_ARTIFACT_SHA256,
  OVERLAY_ARTIFACT_SHA256_ENV_NAME,
  OVERLAY_CHECKPOINT_SCHEMA_VERSION,
  OVERLAY_COARSE_RELEVANCE,
  OVERLAY_CURATION_REASON,
  OVERLAY_ENGINE_VERSION,
  OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
  OVERLAY_OWNER_AUTHORIZATION_ENV_NAME,
  OVERLAY_OWNER_AUTHORIZATION_SENTENCE,
  OVERLAY_PROJECTION_SHA256_ENV_NAME,
  OVERLAY_RECEIPT_SCHEMA_VERSION,
  OVERLAY_RECONCILIATION_SCHEMA_VERSION,
  OVERLAY_SOURCE_IDENTITY,
  OVERLAY_WRITER_IDENTITY,
} from './constants'
import {
  acknowledgementMatches,
  buildBatchRequest,
  buildOverlayPlan,
  checkpointBatchesForPlan,
  type OverlayBatchDescriptor,
} from './plan'
import { collectCohort, summarizeCohort, type CohortAggregates } from './projection'
import {
  buildReviewedSet,
  reviewedRecordEventId,
  summarizeReviewedSet,
  type ReviewedRecord,
  type ReviewedSet,
} from './reviewed-set'
import {
  OverlayMutationAmbiguousError,
  OverlayMutationConfirmedFailureError,
  type OverlayTransport,
} from './transport'

export interface OverlayEngineDependencies {
  environment: Readonly<Record<string, string | undefined>>
  /** Collect the guarded positive-selection cohort payloads (rollback-terminated read). */
  readCohortPayloads(): Promise<unknown[]>
  /** Load the SHA-pinned finalized artifact reduced to per-PMID truth. */
  loadArtifact(): ArtifactTruth
  /** Construct the destination transport. Called only by apply/reconcile/verify. */
  createTransport(): OverlayTransport
  now(): Date
}

export interface OverlayValidateResult {
  status: 'validated'
  cohort: CohortAggregates
  reviewedSet: ReturnType<typeof summarizeReviewedSet>
  environmentPins: {
    artifactPinPresent: boolean
    projectionPinPresent: boolean
    projectionPinMatches: boolean | null
  }
}

async function deriveReviewedSet(deps: OverlayEngineDependencies): Promise<{
  set: ReviewedSet
  cohortAggregates: CohortAggregates
}> {
  const payloads = await deps.readCohortPayloads()
  const cohort = collectCohort(payloads)
  const artifact = deps.loadArtifact()
  const set = buildReviewedSet(cohort, artifact)
  return { set, cohortAggregates: summarizeCohort(cohort) }
}

function environmentPinReport(
  deps: OverlayEngineDependencies,
  set: ReviewedSet,
): OverlayValidateResult['environmentPins'] {
  const artifactPin = deps.environment[OVERLAY_ARTIFACT_SHA256_ENV_NAME]
  const projectionPin = deps.environment[OVERLAY_PROJECTION_SHA256_ENV_NAME]
  return {
    artifactPinPresent: artifactPin !== undefined,
    projectionPinPresent: projectionPin !== undefined,
    projectionPinMatches:
      projectionPin === undefined ? null : projectionPin === set.projectionDigest,
  }
}

export async function runValidate(deps: OverlayEngineDependencies): Promise<OverlayValidateResult> {
  const { set, cohortAggregates } = await deriveReviewedSet(deps)
  const pins = environmentPinReport(deps, set)
  if (pins.projectionPinPresent && pins.projectionPinMatches === false) {
    throw new Error(
      'The owner projection pin does not match the derived projection digest. Stopping.',
    )
  }
  return {
    status: 'validated',
    cohort: cohortAggregates,
    reviewedSet: summarizeReviewedSet(set),
    environmentPins: pins,
  }
}

export interface OverlayDryRunResult {
  status: 'dry-run'
  receiptPath: string
  reviewedSet: ReturnType<typeof summarizeReviewedSet>
  plan: { batchCount: number; recordBatchLimit: number; batchRequestChecksums: string[] }
}

function receiptWithChecksum(body: OverlayReceiptBody): OverlayReceipt {
  return { ...body, receiptChecksum: sha256(canonicalJson(body)) }
}

export async function runDryRun(
  deps: OverlayEngineDependencies,
  options: { stateDirectory: string; recordBatchLimit: number },
): Promise<OverlayDryRunResult> {
  const { set } = await deriveReviewedSet(deps)
  const pins = environmentPinReport(deps, set)
  if (pins.projectionPinPresent && pins.projectionPinMatches === false) {
    throw new Error(
      'The owner projection pin does not match the derived projection digest. Stopping.',
    )
  }
  const reviewedAt = deps.now().toISOString()
  const plan = buildOverlayPlan(set, reviewedAt, options.recordBatchLimit)
  const checksums = plan.batches.map(
    (descriptor) => buildBatchRequest(set, reviewedAt, descriptor).checksum,
  )
  const body: OverlayReceiptBody = {
    schemaVersion: OVERLAY_RECEIPT_SCHEMA_VERSION,
    engineVersion: OVERLAY_ENGINE_VERSION,
    operationId: set.operationId,
    outcome: 'dry-run',
    targetProjectRef: null,
    targetUrl: null,
    writerIdentity: OVERLAY_WRITER_IDENTITY,
    sourceIdentity: OVERLAY_SOURCE_IDENTITY,
    artifactSha256: set.artifactSha256,
    projectionDigest: set.projectionDigest,
    reviewedAt,
    completedAt: deps.now().toISOString(),
    counts: set.counts,
    counters: { applied: 0, alreadyApplied: 0 },
    batchRequestChecksums: checksums,
  }
  const receiptPath = `${options.stateDirectory}/overlay-${set.operationId}.dry-run.receipt.json`
  await writeOverlayReceiptImmutable(receiptPath, receiptWithChecksum(body))
  return {
    status: 'dry-run',
    receiptPath,
    reviewedSet: summarizeReviewedSet(set),
    plan: {
      batchCount: plan.batches.length,
      recordBatchLimit: plan.recordBatchLimit,
      batchRequestChecksums: checksums,
    },
  }
}

/** The exact target state one applied record must show on the destination. */
export function expectedArticleState(
  set: ReviewedSet,
  record: ReviewedRecord,
  reviewedAt: string,
): Record<string, unknown> {
  return {
    relevance_state: OVERLAY_COARSE_RELEVANCE[record.reviewedRelevance],
    visibility_state: 'draft',
    manual_override: true,
    curation_reason: OVERLAY_CURATION_REASON,
    reviewed_relevance: record.reviewedRelevance,
    reviewed_enrichment_provenance: record.enrichmentProvenance,
    reviewed_source_identity: OVERLAY_SOURCE_IDENTITY,
    reviewed_at: reviewedAt,
    reviewed_operation_id: set.operationId,
  }
}

/** The exact event payloads one applied record must show on the destination. */
export function expectedEventPayloads(
  set: ReviewedSet,
  record: ReviewedRecord,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  return {
    before: { relevance_state: 'unreviewed', reviewed_relevance: null },
    after: {
      relevance_state: OVERLAY_COARSE_RELEVANCE[record.reviewedRelevance],
      reviewed_relevance: record.reviewedRelevance,
      reviewed_enrichment_provenance: record.enrichmentProvenance,
      reviewed_source_identity: OVERLAY_SOURCE_IDENTITY,
      reviewed_operation_id: set.operationId,
      persisted_head_revision: record.persistedHeadRevision,
      note_correction: record.noteCorrection
        ? {
            authorizationSha256: record.noteCorrection.authorizationSha256,
            rationaleSha256: record.noteCorrection.rationaleSha256,
            ruleVersion: record.noteCorrection.ruleVersion,
          }
        : null,
    },
  }
}

function requireEnvironmentPin(
  deps: OverlayEngineDependencies,
  name: string,
  expected: string,
  description: string,
): void {
  const value = deps.environment[name]
  if (value === undefined) {
    throw new Error(`${description} (${name}) is required for a production apply.`)
  }
  if (value !== expected) {
    throw new Error(`${description} (${name}) does not match the derived value. Stopping.`)
  }
}

async function assertDestinationPreconditions(
  transport: OverlayTransport,
  set: ReviewedSet,
): Promise<void> {
  // 1. The overlay schema must exist. Against today's foundation-only production project this
  //    probe is rejected, so a production apply fails closed before any mutation.
  try {
    await transport.countRows('literature_reviewed_overlay_operations', 'select=id')
  } catch {
    throw new Error(
      'The reviewed-overlay schema is not present on the destination. The additive proposal ' +
        'must be independently reviewed and applied through the approved mechanism first.',
    )
  }

  // 2. Corpus binding: the total is exactly the fixed corpus, every reviewed PMID exists, and
  //    the overlay can therefore create no article.
  const total = await transport.countRows('literature_articles', 'select=pmid')
  if (total !== OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT) {
    throw new Error(
      `The destination corpus holds ${total} articles; exactly ` +
        `${OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT} are expected.`,
    )
  }
  const pmids = set.records.map((record) => record.pmid)
  let present = 0
  for (let start = 0; start < pmids.length; start += 100) {
    const chunk = pmids.slice(start, start + 100)
    const rows = await transport.readRows('literature_articles', {
      query: `select=pmid&pmid=in.(${chunk.join(',')})`,
    })
    present += rows.length
  }
  if (present !== set.records.length) {
    throw new Error(
      `${set.records.length - present} reviewed record(s) are absent from the destination ` +
        'corpus. The overlay creates no article; stopping.',
    )
  }

  // 3. No foreign reviewed state: every already-reviewed article must belong to this
  //    operation (idempotent replay); any other reviewed article is drift.
  const foreign = await transport.countRows(
    'literature_articles',
    `select=pmid&reviewed_operation_id=not.is.null&reviewed_operation_id=neq.${set.operationId}`,
  )
  if (foreign !== 0) {
    throw new Error(
      `${foreign} article(s) carry a reviewed state from a different operation. Stopping.`,
    )
  }
}

/**
 * Adopt the registered operation's reviewed_at, or mint one for a genuinely new operation.
 *
 * When the deterministic operation row already exists remotely, its identity fields must match
 * this reviewed set exactly (anything else is a foreign row wearing our id — a hard stop), and
 * its stored timestamp becomes the plan's timestamp so that replayed per-record payloads can
 * match the recorded history byte for byte.
 */
async function adoptRegisteredReviewedAt(
  transport: OverlayTransport,
  set: ReviewedSet,
  fallbackNow: Date,
): Promise<string> {
  const rows = await transport.readRows('literature_reviewed_overlay_operations', {
    query:
      'select=id,writer_identity,artifact_sha256,source_identity,reviewed_at,record_count' +
      `&id=eq.${set.operationId}`,
  })
  if (rows.length === 0) return fallbackNow.toISOString()
  if (rows.length > 1) {
    throw new Error('The overlay operation id is duplicated on the destination. Stopping.')
  }
  const row = rows[0] as Record<string, unknown>
  if (
    row.writer_identity !== OVERLAY_WRITER_IDENTITY ||
    row.artifact_sha256 !== set.artifactSha256 ||
    row.source_identity !== OVERLAY_SOURCE_IDENTITY ||
    row.record_count !== set.counts.recordCount
  ) {
    throw new Error(
      'A registered operation carries this deterministic id with different identity content. ' +
        'Stopping; the registered row is never overwritten.',
    )
  }
  const reviewedAt = row.reviewed_at
  if (typeof reviewedAt !== 'string' || !Number.isFinite(Date.parse(reviewedAt))) {
    throw new Error('The registered operation reviewed_at is unreadable. Stopping.')
  }
  return new Date(Date.parse(reviewedAt)).toISOString()
}

export interface OverlayApplyResult {
  status: 'applied' | 'idempotent-replay'
  checkpointPath: string
  receiptPath: string
  counters: { applied: number; alreadyApplied: number }
  batchCount: number
}

export interface OverlayApplyOptions {
  stateDirectory: string
  recordBatchLimit: number
  resume: boolean
  checkpointPath?: string
  reconciliationPath?: string
  readReconciliation?: (path: string) => Promise<unknown>
  confirmProductionWrite: boolean
}

export async function runApply(
  deps: OverlayEngineDependencies,
  options: OverlayApplyOptions,
): Promise<OverlayApplyResult> {
  if (!options.confirmProductionWrite) {
    throw new Error('A mutating overlay apply requires --confirm-production-write.')
  }

  const { set } = await deriveReviewedSet(deps)

  requireEnvironmentPin(
    deps,
    OVERLAY_ARTIFACT_SHA256_ENV_NAME,
    OVERLAY_ARTIFACT_SHA256,
    'The owner artifact pin',
  )
  requireEnvironmentPin(
    deps,
    OVERLAY_PROJECTION_SHA256_ENV_NAME,
    set.projectionDigest,
    'The owner projection pin',
  )
  requireEnvironmentPin(
    deps,
    OVERLAY_OWNER_AUTHORIZATION_ENV_NAME,
    OVERLAY_OWNER_AUTHORIZATION_SENTENCE,
    'The owner authorization sentence',
  )

  const checkpointPath =
    options.checkpointPath ?? `${options.stateDirectory}/overlay-${set.operationId}.checkpoint.json`
  const receiptPath = `${options.stateDirectory}/overlay-${set.operationId}.receipt.json`

  const lease = await acquireOverlayLease(checkpointPath)
  try {
    let resumedCheckpoint: OverlayCheckpoint | null = null
    if (options.resume) {
      if (!options.checkpointPath) {
        throw new Error('A resume requires the explicit checkpoint path.')
      }
      const loaded = await readOverlayCheckpoint(options.checkpointPath)
      if (loaded.operationId !== set.operationId) {
        throw new Error('The checkpoint does not belong to this reviewed set. Stopping.')
      }
      if (loaded.phase === 'completed') {
        throw new Error(
          'The checkpointed operation is already completed. Use verify; a fresh state ' +
            'directory replays idempotently if the remote state must be re-proven by request.',
        )
      }
      if (
        loaded.artifactSha256 !== set.artifactSha256 ||
        loaded.projectionDigest !== set.projectionDigest
      ) {
        throw new Error('The checkpoint source identity does not match the reviewed set.')
      }
      // Every durable request body must be reproducible byte-for-byte before any request.
      for (const batch of loaded.batches) {
        const descriptor: OverlayBatchDescriptor = {
          index: batch.index,
          startOrdinal: batch.startOrdinal,
          endOrdinal: batch.endOrdinal,
          recordCount: batch.recordCount,
          finalBatch: batch.finalBatch,
        }
        const rebuilt = buildBatchRequest(set, loaded.reviewedAt, descriptor)
        if (rebuilt.checksum !== batch.requestChecksum) {
          throw new Error(
            'A checkpointed batch request cannot be reproduced from the source. Stopping.',
          )
        }
      }
      if (options.reconciliationPath) {
        if (!options.readReconciliation) {
          throw new Error('The engine was not given a reconciliation reader.')
        }
        const receipt = await options.readReconciliation(options.reconciliationPath)
        applyReconciliationToCheckpoint(loaded, receipt)
      }
      for (const batch of loaded.batches) {
        if (batch.stage.state === 'submitted' || batch.stage.state === 'ambiguous') {
          throw new Error('A batch stage requires read-only reconciliation before continuation.')
        }
        if (batch.stage.state === 'confirmed_failure') {
          batch.stage = {
            state: 'prepared',
            submittedAt: null,
            acknowledgedAt: null,
            failureCode: null,
          }
        }
      }
      loaded.phase = 'running'
      resumedCheckpoint = loaded
    } else {
      if (options.checkpointPath) {
        throw new Error('A fresh apply derives its own checkpoint path; use --resume.')
      }
      const existing = await stat(checkpointPath).catch(() => null)
      if (existing !== null) {
        throw new Error(
          'A checkpoint for this operation already exists. Reconcile and resume it ' +
            'explicitly; a fresh apply never overwrites durable operation state.',
        )
      }
    }

    const transport = deps.createTransport()
    await assertDestinationPreconditions(transport, set)

    let checkpoint: OverlayCheckpoint
    if (resumedCheckpoint) {
      checkpoint = resumedCheckpoint
    } else {
      // The registered operation row is the authority for its own timestamp: a fresh run of an
      // operation that already exists remotely (a from-scratch replay after lost local state)
      // must adopt the registered reviewed_at, or its deterministic per-record payloads could
      // never match the recorded history.
      const reviewedAt = await adoptRegisteredReviewedAt(transport, set, deps.now())
      const plan = buildOverlayPlan(set, reviewedAt, options.recordBatchLimit)
      const timestamp = deps.now().toISOString()
      checkpoint = {
        schemaVersion: OVERLAY_CHECKPOINT_SCHEMA_VERSION,
        engineVersion: OVERLAY_ENGINE_VERSION,
        operationId: set.operationId,
        targetProjectRef: APPROVED_PROJECT_REF,
        createdAt: timestamp,
        updatedAt: timestamp,
        artifactSha256: set.artifactSha256,
        projectionDigest: set.projectionDigest,
        reviewedAt,
        counts: set.counts,
        limits: { recordBatchLimit: plan.recordBatchLimit },
        batches: checkpointBatchesForPlan(set, plan),
        phase: 'prepared',
        counters: { applied: 0, alreadyApplied: 0 },
      }
    }

    checkpoint.phase = 'running'
    checkpoint.updatedAt = deps.now().toISOString()
    await writeOverlayCheckpoint(checkpointPath, checkpoint)

    for (const batch of checkpoint.batches) {
      if (batch.stage.state === 'acknowledged') continue

      const descriptor: OverlayBatchDescriptor = {
        index: batch.index,
        startOrdinal: batch.startOrdinal,
        endOrdinal: batch.endOrdinal,
        recordCount: batch.recordCount,
        finalBatch: batch.finalBatch,
      }
      const request = buildBatchRequest(set, checkpoint.reviewedAt, descriptor)
      if (request.checksum !== batch.requestChecksum) {
        throw new Error('A batch request drifted between planning and submission. Stopping.')
      }

      // Write-ahead: the durable record says `submitted` before the request exists.
      batch.stage = {
        state: 'submitted',
        submittedAt: deps.now().toISOString(),
        acknowledgedAt: null,
        failureCode: null,
      }
      checkpoint.updatedAt = deps.now().toISOString()
      await writeOverlayCheckpoint(checkpointPath, checkpoint)

      let acknowledgement: unknown
      try {
        acknowledgement = await transport.applyBatch(request.body)
      } catch (error) {
        if (error instanceof OverlayMutationConfirmedFailureError) {
          batch.stage = {
            state: 'confirmed_failure',
            submittedAt: batch.stage.submittedAt,
            acknowledgedAt: null,
            failureCode: 'postgrest_rejected',
          }
          checkpoint.phase = 'confirmed_failure'
          checkpoint.updatedAt = deps.now().toISOString()
          await writeOverlayCheckpoint(checkpointPath, checkpoint)
          throw error
        }
        const code =
          error instanceof OverlayMutationAmbiguousError ? error.code : 'transport_exception'
        batch.stage = {
          state: 'ambiguous',
          submittedAt: batch.stage.submittedAt,
          acknowledgedAt: null,
          failureCode: code,
        }
        checkpoint.phase = 'needs_reconciliation'
        checkpoint.updatedAt = deps.now().toISOString()
        await writeOverlayCheckpoint(checkpointPath, checkpoint)
        throw error
      }

      const verdict = acknowledgementMatches(
        { operationId: set.operationId, recordCount: batch.recordCount },
        acknowledgement,
      )
      if (!verdict.matches) {
        batch.stage = {
          state: 'ambiguous',
          submittedAt: batch.stage.submittedAt,
          acknowledgedAt: null,
          failureCode: verdict.reason,
        }
        checkpoint.phase = 'needs_reconciliation'
        checkpoint.updatedAt = deps.now().toISOString()
        await writeOverlayCheckpoint(checkpointPath, checkpoint)
        throw new OverlayMutationAmbiguousError(
          'malformed_acknowledgement',
          'The overlay acknowledgement did not match the submitted batch exactly.',
        )
      }

      batch.stage = {
        state: 'acknowledged',
        submittedAt: batch.stage.submittedAt,
        acknowledgedAt: deps.now().toISOString(),
        failureCode: null,
      }
      batch.acknowledgementChecksum = sha256(canonicalJson(acknowledgement))
      batch.effects = { applied: verdict.applied, alreadyApplied: verdict.alreadyApplied }
      checkpoint.counters.applied += verdict.applied
      checkpoint.counters.alreadyApplied += verdict.alreadyApplied
      checkpoint.updatedAt = deps.now().toISOString()
      await writeOverlayCheckpoint(checkpointPath, checkpoint)
    }

    checkpoint.phase = 'completed'
    checkpoint.updatedAt = deps.now().toISOString()
    await writeOverlayCheckpoint(checkpointPath, checkpoint)

    const outcome =
      checkpoint.counters.applied === 0 && checkpoint.counters.alreadyApplied > 0
        ? 'idempotent-replay'
        : 'completed'
    const body: OverlayReceiptBody = {
      schemaVersion: OVERLAY_RECEIPT_SCHEMA_VERSION,
      engineVersion: OVERLAY_ENGINE_VERSION,
      operationId: set.operationId,
      outcome,
      targetProjectRef: APPROVED_PROJECT_REF,
      targetUrl: APPROVED_PROJECT_URL,
      writerIdentity: OVERLAY_WRITER_IDENTITY,
      sourceIdentity: OVERLAY_SOURCE_IDENTITY,
      artifactSha256: set.artifactSha256,
      projectionDigest: set.projectionDigest,
      reviewedAt: checkpoint.reviewedAt,
      completedAt: deps.now().toISOString(),
      counts: set.counts,
      counters: { ...checkpoint.counters },
      batchRequestChecksums: checkpoint.batches.map((batch) => batch.requestChecksum),
    }
    const finalReceiptPath =
      outcome === 'idempotent-replay'
        ? `${options.stateDirectory}/overlay-${set.operationId}.replay-${Date.now()}.receipt.json`
        : receiptPath
    await writeOverlayReceiptImmutable(finalReceiptPath, receiptWithChecksum(body))

    return {
      status: outcome === 'idempotent-replay' ? 'idempotent-replay' : 'applied',
      checkpointPath,
      receiptPath: finalReceiptPath,
      counters: { ...checkpoint.counters },
      batchCount: checkpoint.batches.length,
    }
  } finally {
    await lease.release()
  }
}

export type OverlayBatchClassification =
  | 'applied_exact'
  | 'absent_exact'
  | 'partial_or_conflicting'
  | 'observation_incomplete'

export interface OverlayReconciliationBatch {
  index: number
  classification: OverlayBatchClassification
  observed: {
    eventsPresent: number
    articlesReviewed: number
    articlesUntouched: number
    mismatches: number
  }
}

export interface OverlayReconciliationReceipt {
  schemaVersion: string
  operationId: string
  checkpointChecksum: string
  observedAt: string
  batches: OverlayReconciliationBatch[]
  receiptChecksum: string
}

function chunked<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let start = 0; start < values.length; start += size) {
    chunks.push(values.slice(start, start + size))
  }
  return chunks
}

const UNTOUCHED_ARTICLE_STATE = {
  relevance_state: 'unreviewed',
  visibility_state: 'draft',
  manual_override: false,
  reviewed_relevance: null,
  reviewed_enrichment_provenance: null,
  reviewed_source_identity: null,
  reviewed_at: null,
  reviewed_operation_id: null,
} as const

const ARTICLE_OBSERVATION_SELECT =
  'select=pmid,relevance_state,visibility_state,manual_override,curation_reason,' +
  'reviewed_relevance,reviewed_enrichment_provenance,reviewed_source_identity,reviewed_at,' +
  'reviewed_operation_id'

function timestampsEqual(left: unknown, right: unknown): boolean {
  if (typeof left !== 'string' || typeof right !== 'string') return false
  const leftEpoch = Date.parse(left)
  const rightEpoch = Date.parse(right)
  return Number.isFinite(leftEpoch) && leftEpoch === rightEpoch
}

/**
 * Observe one batch read-only and classify it.
 *
 * A batch is transactional on the destination, so the expected observations are exactly "all
 * applied" or "none applied"; anything mixed, foreign, or content-mismatched is drift, and any
 * failed read is an incomplete observation — never a verdict.
 */
async function observeBatch(
  transport: OverlayTransport,
  set: ReviewedSet,
  reviewedAt: string,
  batch: OverlayCheckpointBatch,
): Promise<OverlayReconciliationBatch> {
  const records = set.records.slice(batch.startOrdinal - 1, batch.endOrdinal)
  let eventsPresent = 0
  let articlesReviewed = 0
  let articlesUntouched = 0
  let mismatches = 0

  try {
    for (const chunk of chunked(records, 50)) {
      const eventIds = chunk.map((record) => reviewedRecordEventId(set, record))
      const eventRows = await transport.readRows('literature_curation_events', {
        query:
          'select=id,pmid,event_type,actor_email,before_value,after_value,reason' +
          `&id=in.(${eventIds.join(',')})`,
      })
      const eventsById = new Map(
        eventRows.map((row) => [(row as Record<string, unknown>).id as string, row]),
      )

      const articleRows = await transport.readRows('literature_articles', {
        query: `${ARTICLE_OBSERVATION_SELECT}&pmid=in.(${chunk.map((r) => r.pmid).join(',')})`,
      })
      const articlesByPmid = new Map(
        articleRows.map((row) => [(row as Record<string, unknown>).pmid as string, row]),
      )

      for (const record of chunk) {
        const eventId = reviewedRecordEventId(set, record)
        const event = eventsById.get(eventId) as Record<string, unknown> | undefined
        const article = articlesByPmid.get(record.pmid) as Record<string, unknown> | undefined
        if (!article) {
          mismatches += 1
          continue
        }

        const expected = expectedArticleState(set, record, reviewedAt)
        const payloads = expectedEventPayloads(set, record)

        const articleReviewed = article.reviewed_operation_id !== null
        if (articleReviewed) articlesReviewed += 1

        const articleExact =
          articleReviewed &&
          article.relevance_state === expected.relevance_state &&
          article.visibility_state === expected.visibility_state &&
          article.manual_override === true &&
          article.curation_reason === OVERLAY_CURATION_REASON &&
          article.reviewed_relevance === expected.reviewed_relevance &&
          article.reviewed_enrichment_provenance === expected.reviewed_enrichment_provenance &&
          article.reviewed_source_identity === expected.reviewed_source_identity &&
          timestampsEqual(article.reviewed_at, reviewedAt) &&
          article.reviewed_operation_id === set.operationId

        const articleUntouched =
          !articleReviewed &&
          Object.entries(UNTOUCHED_ARTICLE_STATE).every(([key, value]) => article[key] === value)
        if (articleUntouched) articlesUntouched += 1

        if (event) {
          eventsPresent += 1
          const eventExact =
            event.pmid === record.pmid &&
            event.event_type === 'relevance_changed' &&
            event.actor_email === OVERLAY_WRITER_IDENTITY &&
            event.reason === OVERLAY_CURATION_REASON &&
            canonicalJson(event.before_value) === canonicalJson(payloads.before) &&
            canonicalJson(event.after_value) === canonicalJson(payloads.after)
          if (!eventExact || !articleExact) mismatches += 1
        } else if (articleReviewed) {
          // A reviewed article with no history row can never be this operation's work.
          mismatches += 1
        } else if (!articleUntouched) {
          mismatches += 1
        }
      }
    }
  } catch {
    return {
      index: batch.index,
      classification: 'observation_incomplete',
      observed: { eventsPresent, articlesReviewed, articlesUntouched, mismatches },
    }
  }

  const recordCount = records.length
  let classification: OverlayBatchClassification
  if (mismatches > 0) classification = 'partial_or_conflicting'
  else if (eventsPresent === recordCount && articlesReviewed === recordCount) {
    classification = 'applied_exact'
  } else if (eventsPresent === 0 && articlesUntouched === recordCount) {
    classification = 'absent_exact'
  } else {
    classification = 'partial_or_conflicting'
  }
  return {
    index: batch.index,
    classification,
    observed: { eventsPresent, articlesReviewed, articlesUntouched, mismatches },
  }
}

export interface OverlayReconcileResult {
  status: 'reconciled'
  receipt: OverlayReconciliationReceipt
  unresolvedBatchCount: number
}

export async function runReconcile(
  deps: OverlayEngineDependencies,
  options: { checkpointPath: string },
): Promise<OverlayReconcileResult> {
  const checkpoint = await readOverlayCheckpoint(options.checkpointPath)
  const { set } = await deriveReviewedSet(deps)
  if (checkpoint.operationId !== set.operationId) {
    throw new Error('The checkpoint does not belong to this reviewed set. Stopping.')
  }

  const unresolved = checkpoint.batches.filter(
    (batch) => batch.stage.state === 'submitted' || batch.stage.state === 'ambiguous',
  )
  const transport = deps.createTransport()
  const observations: OverlayReconciliationBatch[] = []
  for (const batch of unresolved) {
    observations.push(await observeBatch(transport, set, checkpoint.reviewedAt, batch))
  }

  const body = {
    schemaVersion: OVERLAY_RECONCILIATION_SCHEMA_VERSION,
    operationId: checkpoint.operationId,
    checkpointChecksum: sha256(canonicalJson(checkpoint)),
    observedAt: deps.now().toISOString(),
    batches: observations,
  }
  const receipt: OverlayReconciliationReceipt = {
    ...body,
    receiptChecksum: sha256(canonicalJson(body)),
  }
  return { status: 'reconciled', receipt, unresolvedBatchCount: unresolved.length }
}

/**
 * Fold an exact reconciliation receipt into a checkpoint before resume. Ambiguity and drift
 * stop with distinct messages; only exact application and exact absence continue.
 */
export function applyReconciliationToCheckpoint(
  checkpoint: OverlayCheckpoint,
  receiptValue: unknown,
): void {
  if (!receiptValue || typeof receiptValue !== 'object' || Array.isArray(receiptValue)) {
    throw new Error('The reconciliation receipt is not an object.')
  }
  const receipt = receiptValue as Record<string, unknown>
  if (receipt.schemaVersion !== OVERLAY_RECONCILIATION_SCHEMA_VERSION) {
    throw new Error('The reconciliation receipt schema is not supported.')
  }
  if (receipt.operationId !== checkpoint.operationId) {
    throw new Error('The reconciliation receipt belongs to a different operation.')
  }
  const { receiptChecksum, ...body } = receipt
  if (receiptChecksum !== sha256(canonicalJson(body))) {
    throw new Error('The reconciliation receipt checksum does not match.')
  }
  if (receipt.checkpointChecksum !== sha256(canonicalJson(checkpoint))) {
    throw new Error('The reconciliation receipt was produced against a different checkpoint state.')
  }
  if (!Array.isArray(receipt.batches)) {
    throw new Error('The reconciliation receipt batches are invalid.')
  }
  for (const entry of receipt.batches as Array<Record<string, unknown>>) {
    const batch = checkpoint.batches[entry.index as number]
    if (!batch || (batch.stage.state !== 'submitted' && batch.stage.state !== 'ambiguous')) {
      throw new Error('The reconciliation receipt names a batch that is not unresolved.')
    }
    const classification = entry.classification
    if (classification === 'observation_incomplete') {
      throw new Error(
        'The reconciliation observation is incomplete. No further mutation may be attempted ' +
          'until a complete read-only observation succeeds.',
      )
    }
    if (classification === 'partial_or_conflicting') {
      throw new Error(
        'The destination state conflicts with the overlay expectation. No further mutation ' +
          'may be attempted; investigate the drift read-only.',
      )
    }
    if (classification === 'applied_exact') {
      batch.stage = {
        state: 'acknowledged',
        submittedAt: batch.stage.submittedAt,
        acknowledgedAt: new Date().toISOString(),
        failureCode: null,
      }
      // The fresh/replay split of a reconciled batch is unknowable after the fact; effects
      // stay null and the verify command proves the exact remote totals instead.
      batch.effects = null
      batch.acknowledgementChecksum = null
    } else if (classification === 'absent_exact') {
      batch.stage = {
        state: 'prepared',
        submittedAt: null,
        acknowledgedAt: null,
        failureCode: null,
      }
    } else {
      throw new Error('The reconciliation receipt carries an unknown classification.')
    }
  }
  checkpoint.phase = 'running'
}

export interface OverlayVerifyResult {
  status: 'verified'
  operationId: string
  remote: {
    operationRowStatus: string
    reviewedTotal: number
    classCounts: Record<string, number>
    provenanceCounts: Record<string, number>
    corpusTotal: number
    foreignReviewed: number
    recordsExact: number
    eventsExact: number
  }
}

export async function runVerify(
  deps: OverlayEngineDependencies,
  options: { checkpointPath: string },
): Promise<OverlayVerifyResult> {
  const checkpoint = await readOverlayCheckpoint(options.checkpointPath)
  const { set } = await deriveReviewedSet(deps)
  if (checkpoint.operationId !== set.operationId) {
    throw new Error('The checkpoint does not belong to this reviewed set. Stopping.')
  }
  if (checkpoint.phase !== 'completed') {
    throw new Error('Verification requires a completed checkpoint.')
  }
  const transport = deps.createTransport()

  const operationRows = await transport.readRows('literature_reviewed_overlay_operations', {
    query:
      'select=id,writer_identity,artifact_sha256,source_identity,record_count,status' +
      `&id=eq.${set.operationId}`,
  })
  if (operationRows.length !== 1) {
    throw new Error('The overlay operation row is absent or duplicated on the destination.')
  }
  const operationRow = operationRows[0] as Record<string, unknown>
  if (
    operationRow.writer_identity !== OVERLAY_WRITER_IDENTITY ||
    operationRow.artifact_sha256 !== set.artifactSha256 ||
    operationRow.source_identity !== OVERLAY_SOURCE_IDENTITY ||
    operationRow.record_count !== set.counts.recordCount ||
    operationRow.status !== 'completed'
  ) {
    throw new Error('The overlay operation row does not match the reviewed set exactly.')
  }

  const reviewedTotal = await transport.countRows(
    'literature_articles',
    `select=pmid&reviewed_operation_id=eq.${set.operationId}`,
  )
  const classCounts: Record<string, number> = {}
  for (const relevance of ['include_core', 'include_adjacent', 'exclude'] as const) {
    classCounts[relevance] = await transport.countRows(
      'literature_articles',
      `select=pmid&reviewed_operation_id=eq.${set.operationId}` +
        `&reviewed_relevance=eq.${relevance}`,
    )
  }
  const provenanceCounts: Record<string, number> = {}
  for (const provenance of ['physician_confirmed', 'physician_modified', 'qc_accepted'] as const) {
    provenanceCounts[provenance] = await transport.countRows(
      'literature_articles',
      `select=pmid&reviewed_operation_id=eq.${set.operationId}` +
        `&reviewed_enrichment_provenance=eq.${provenance}`,
    )
  }
  const corpusTotal = await transport.countRows('literature_articles', 'select=pmid')
  const foreignReviewed = await transport.countRows(
    'literature_articles',
    `select=pmid&reviewed_operation_id=not.is.null&reviewed_operation_id=neq.${set.operationId}`,
  )

  if (reviewedTotal !== set.counts.recordCount) {
    throw new Error('The destination reviewed total does not match the reviewed set.')
  }
  for (const [key, expected] of Object.entries(set.counts.classCounts)) {
    if (classCounts[key] !== expected) {
      throw new Error('A destination class count does not match the reviewed set.')
    }
  }
  for (const [key, expected] of Object.entries(set.counts.provenanceCounts)) {
    if (provenanceCounts[key] !== expected) {
      throw new Error('A destination provenance count does not match the reviewed set.')
    }
  }
  if (corpusTotal !== OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT) {
    throw new Error('The destination corpus total changed. The overlay must create no article.')
  }
  if (foreignReviewed !== 0) {
    throw new Error('The destination carries reviewed articles outside this operation.')
  }

  let recordsExact = 0
  let eventsExact = 0
  for (const batch of checkpoint.batches) {
    const observation = await observeBatch(transport, set, checkpoint.reviewedAt, batch)
    if (observation.classification !== 'applied_exact') {
      throw new Error('A destination batch is not exactly applied.')
    }
    recordsExact += batch.recordCount
    eventsExact += observation.observed.eventsPresent
  }

  return {
    status: 'verified',
    operationId: set.operationId,
    remote: {
      operationRowStatus: String(operationRow.status),
      reviewedTotal,
      classCounts,
      provenanceCounts,
      corpusTotal,
      foreignReviewed,
      recordsExact,
      eventsExact,
    },
  }
}
