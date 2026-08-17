/**
 * The reviewed-overlay engine: validate, dry-run, apply, reconcile, and verify.
 *
 * The engine never touches process.env, argv, or the network directly — everything arrives
 * through `OverlayEngineDependencies`, so the production CLI and the disposable rehearsal drive
 * the identical orchestration. Destination requests happen only inside `apply` (bounded RPC
 * calls behind the full gate set), `reconcile`, and `verify` (observation RPC only, POST with
 * a body, reads only).
 *
 * Two review-hardened rules govern completion:
 *
 *   1. An acknowledgement — even an exact, context-bound one — is never proof of remote
 *      application. Before the checkpoint or receipt may say `completed`, the engine performs
 *      a complete read-only post-observation (registry identity and status, every class and
 *      provenance total, the deterministic event count, the untouched complement, and every
 *      record's exact state) and binds its checksum into both artifacts.
 *   2. A reconciliation receipt is evidence, not authority. On resume the engine re-observes
 *      every batch the receipt names and requires the fresh classification to agree before a
 *      single stage advances.
 */

import { stat } from 'node:fs/promises'

import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import type { ArtifactTruth } from './artifact'
import {
  acquireOverlayLease,
  overlayCheckpointChecksum,
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
    curationReason: OVERLAY_CURATION_REASON,
    artifactSha256: set.artifactSha256,
    projectionDigest: set.projectionDigest,
    reviewedAt,
    completedAt: deps.now().toISOString(),
    counts: set.counts,
    counters: { applied: 0, alreadyApplied: 0 },
    batchRequestChecksums: checksums,
    checkpointChecksum: sha256(canonicalJson({ dryRun: set.projectionDigest, reviewedAt })),
    postObservationChecksum: null,
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
    is_landmark: false,
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

function timestampsEqual(left: unknown, right: unknown): boolean {
  if (typeof left !== 'string' || typeof right !== 'string') return false
  const leftEpoch = Date.parse(left)
  const rightEpoch = Date.parse(right)
  return Number.isFinite(leftEpoch) && leftEpoch === rightEpoch
}

function chunked<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let start = 0; start < values.length; start += size) {
    chunks.push(values.slice(start, start + size))
  }
  return chunks
}

function observationRequestBody(
  operationId: string,
  pmids: readonly string[],
  eventIds: readonly string[],
): string {
  return JSON.stringify({ operationId, pmids, eventIds })
}

interface OverlayObservationView {
  operation: Record<string, unknown> | null
  totals: Record<string, unknown>
  articles: Map<string, Record<string, unknown>>
  events: Map<string, Record<string, unknown>>
}

function parseObservation(value: unknown): OverlayObservationView {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The overlay observation was not a JSON object.')
  }
  const record = value as Record<string, unknown>
  const operation = record.operation
  if (operation !== null && (typeof operation !== 'object' || Array.isArray(operation))) {
    throw new Error('The overlay observation operation section is malformed.')
  }
  const totals = record.totals
  if (totals === null || typeof totals !== 'object' || Array.isArray(totals)) {
    throw new Error('The overlay observation totals section is malformed.')
  }
  const articles = new Map<string, Record<string, unknown>>()
  if (!Array.isArray(record.articles)) {
    throw new Error('The overlay observation articles section is malformed.')
  }
  for (const article of record.articles) {
    if (article === null || typeof article !== 'object' || Array.isArray(article)) {
      throw new Error('The overlay observation articles section is malformed.')
    }
    articles.set(
      String((article as Record<string, unknown>).pmid),
      article as Record<string, unknown>,
    )
  }
  const events = new Map<string, Record<string, unknown>>()
  if (!Array.isArray(record.events)) {
    throw new Error('The overlay observation events section is malformed.')
  }
  for (const event of record.events) {
    if (event === null || typeof event !== 'object' || Array.isArray(event)) {
      throw new Error('The overlay observation events section is malformed.')
    }
    events.set(String((event as Record<string, unknown>).id), event as Record<string, unknown>)
  }
  return { operation, totals, articles, events } as OverlayObservationView
}

async function observeBase(
  transport: OverlayTransport,
  operationId: string,
): Promise<OverlayObservationView> {
  return parseObservation(await transport.observe(observationRequestBody(operationId, [], [])))
}

function totalsNumber(view: OverlayObservationView, key: string): number {
  const value = view.totals[key]
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error('The overlay observation totals are malformed.')
  }
  return value
}

/**
 * The full identity comparison for a registered operation row. Every field participates —
 * registry metadata is bound, never sampled.
 */
function assertRegisteredOperationIdentity(
  operation: Record<string, unknown>,
  set: ReviewedSet,
  options: { reviewedAt?: string },
): void {
  const mismatch =
    operation.id !== set.operationId ||
    operation.writer_identity !== OVERLAY_WRITER_IDENTITY ||
    operation.artifact_sha256 !== set.artifactSha256 ||
    operation.source_identity !== OVERLAY_SOURCE_IDENTITY ||
    operation.curation_reason !== OVERLAY_CURATION_REASON ||
    operation.record_count !== set.counts.recordCount ||
    operation.include_core_count !== set.counts.classCounts.include_core ||
    operation.include_adjacent_count !== set.counts.classCounts.include_adjacent ||
    operation.exclude_count !== set.counts.classCounts.exclude ||
    operation.physician_confirmed_count !== set.counts.provenanceCounts.physician_confirmed ||
    operation.physician_modified_count !== set.counts.provenanceCounts.physician_modified ||
    operation.qc_accepted_count !== set.counts.provenanceCounts.qc_accepted
  if (mismatch) {
    throw new Error(
      'A registered operation carries this deterministic id with different identity content. ' +
        'Stopping; the registered row is never overwritten.',
    )
  }
  if (
    options.reviewedAt !== undefined &&
    !timestampsEqual(operation.reviewed_at, options.reviewedAt)
  ) {
    throw new Error('The registered operation reviewed-at timestamp does not match. Stopping.')
  }
  if (operation.status !== 'started' && operation.status !== 'completed') {
    throw new Error('The registered operation status is unreadable. Stopping.')
  }
}

async function assertDestinationPreconditions(
  transport: OverlayTransport,
  set: ReviewedSet,
): Promise<{ registered: Record<string, unknown> | null }> {
  // 1. The overlay schema must exist. Against today's foundation-only production project the
  //    observation RPC does not exist, so a production apply fails closed before any mutation.
  let base: OverlayObservationView
  try {
    base = await observeBase(transport, set.operationId)
  } catch {
    throw new Error(
      'The reviewed-overlay schema is not present on the destination. The additive proposal ' +
        'must be independently reviewed and applied through the approved mechanism first.',
    )
  }

  // 2. Corpus binding: the total is exactly the fixed corpus, every reviewed PMID exists, and
  //    the overlay can therefore create no article.
  const corpusTotal = totalsNumber(base, 'corpusArticles')
  if (corpusTotal !== OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT) {
    throw new Error(
      `The destination corpus holds ${corpusTotal} articles; exactly ` +
        `${OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT} are expected.`,
    )
  }
  let present = 0
  for (const chunk of chunked(set.records, 250)) {
    const view = parseObservation(
      await transport.observe(
        observationRequestBody(
          set.operationId,
          chunk.map((record) => record.pmid),
          [],
        ),
      ),
    )
    present += view.articles.size
  }
  if (present !== set.records.length) {
    throw new Error(
      `${set.records.length - present} reviewed record(s) are absent from the destination ` +
        'corpus. The overlay creates no article; stopping.',
    )
  }

  // 3. No foreign reviewed state: every already-reviewed article must belong to this
  //    operation (idempotent replay); any other reviewed article is drift.
  const foreign = totalsNumber(base, 'foreignReviewed')
  if (foreign !== 0) {
    throw new Error(
      `${foreign} article(s) carry a reviewed state from a different operation. Stopping.`,
    )
  }

  if (base.operation !== null) {
    assertRegisteredOperationIdentity(base.operation, set, {})
  }
  return { registered: base.operation }
}

export type OverlayBatchClassification =
  | 'applied_exact'
  | 'absent_exact'
  | 'partial'
  | 'mixed'
  | 'drifted'
  | 'ambiguous'
  | 'observation_incomplete'

export interface OverlayBatchObservation {
  index: number
  classification: OverlayBatchClassification
  observed: {
    recordCount: number
    exactRecords: number
    absentRecords: number
    driftedRecords: number
    inconsistentRecords: number
    eventsPresent: number
  }
}

/**
 * Observe one batch read-only and classify it against the strict vocabulary.
 *
 * Per record there are exactly four dispositions: exact (article in the exact target state and
 * the deterministic event exact), absent (article in the complete untouched state and no
 * event), drifted (present but content-mismatched anywhere), and inconsistent (a reviewed
 * article without its event, or an event without its reviewed article — a state the
 * transactional RPC can never produce, so it can only mean interference). The batch
 * classification follows: all exact → applied_exact; all absent → absent_exact; any
 * inconsistency → ambiguous; any drift beside exact/absent records → mixed; drift alone →
 * drifted; exact and absent together without drift → partial. Failed reads are
 * observation_incomplete — never a verdict.
 */
async function observeBatch(
  transport: OverlayTransport,
  set: ReviewedSet,
  reviewedAt: string,
  batch: { index: number; startOrdinal: number; endOrdinal: number },
): Promise<OverlayBatchObservation> {
  const records = set.records.slice(batch.startOrdinal - 1, batch.endOrdinal)
  let exactRecords = 0
  let absentRecords = 0
  let driftedRecords = 0
  let inconsistentRecords = 0
  let eventsPresent = 0

  try {
    const view = parseObservation(
      await transport.observe(
        observationRequestBody(
          set.operationId,
          records.map((record) => record.pmid),
          records.map((record) => reviewedRecordEventId(set, record)),
        ),
      ),
    )

    for (const record of records) {
      const eventId = reviewedRecordEventId(set, record)
      const article = view.articles.get(record.pmid)
      const event = view.events.get(eventId)
      if (event) eventsPresent += 1

      if (!article) {
        driftedRecords += 1
        continue
      }

      const expected = expectedArticleState(set, record, reviewedAt)
      const payloads = expectedEventPayloads(set, record)

      const articleReviewed = article.reviewed_operation_id !== null
      const articleExact =
        article.relevance_state === expected.relevance_state &&
        article.visibility_state === 'draft' &&
        article.manual_override === true &&
        article.is_landmark === false &&
        article.curation_reason === OVERLAY_CURATION_REASON &&
        article.classifier_version_is_null === true &&
        article.classifier_payload_is_null === true &&
        article.reviewed_relevance === expected.reviewed_relevance &&
        article.reviewed_enrichment_provenance === expected.reviewed_enrichment_provenance &&
        article.reviewed_source_identity === expected.reviewed_source_identity &&
        timestampsEqual(article.reviewed_at, reviewedAt) &&
        article.reviewed_operation_id === set.operationId

      const articleUntouched =
        !articleReviewed &&
        article.relevance_state === 'unreviewed' &&
        article.visibility_state === 'draft' &&
        article.manual_override === false &&
        article.is_landmark === false &&
        article.curation_reason === null &&
        article.classifier_version_is_null === true &&
        article.classifier_payload_is_null === true &&
        article.reviewed_relevance === null &&
        article.reviewed_enrichment_provenance === null &&
        article.reviewed_source_identity === null &&
        article.reviewed_at === null

      const eventExact =
        event !== undefined &&
        event.pmid === record.pmid &&
        event.event_type === 'relevance_changed' &&
        event.actor_user_id === null &&
        event.actor_email === OVERLAY_WRITER_IDENTITY &&
        event.reason === OVERLAY_CURATION_REASON &&
        canonicalJson(event.before_value) === canonicalJson(payloads.before) &&
        canonicalJson(event.after_value) === canonicalJson(payloads.after)

      if (articleExact && eventExact) exactRecords += 1
      else if (articleUntouched && event === undefined) absentRecords += 1
      else if ((articleReviewed || articleExact) !== (event !== undefined)) {
        inconsistentRecords += 1
      } else {
        driftedRecords += 1
      }
    }
  } catch {
    return {
      index: batch.index,
      classification: 'observation_incomplete',
      observed: {
        recordCount: records.length,
        exactRecords,
        absentRecords,
        driftedRecords,
        inconsistentRecords,
        eventsPresent,
      },
    }
  }

  const recordCount = records.length
  let classification: OverlayBatchClassification
  if (inconsistentRecords > 0) classification = 'ambiguous'
  else if (exactRecords === recordCount) classification = 'applied_exact'
  else if (absentRecords === recordCount) classification = 'absent_exact'
  else if (driftedRecords > 0 && exactRecords === 0 && absentRecords === 0) {
    classification = 'drifted'
  } else if (driftedRecords > 0) classification = 'mixed'
  else classification = 'partial'

  return {
    index: batch.index,
    classification,
    observed: {
      recordCount,
      exactRecords,
      absentRecords,
      driftedRecords,
      inconsistentRecords,
      eventsPresent,
    },
  }
}

export interface OverlayPostObservation {
  checksum: string
  summary: Record<string, unknown>
}

/**
 * The complete read-only post-observation that licenses whole-operation completion: the full
 * registry row, every class and provenance total, the deterministic event count, the untouched
 * complement, and every record's exact state. Timestamps are normalized to epoch milliseconds
 * so the checksum does not depend on a server's text rendering.
 */
async function performPostObservation(
  transport: OverlayTransport,
  set: ReviewedSet,
  reviewedAt: string,
  batches: readonly { index: number; startOrdinal: number; endOrdinal: number }[],
): Promise<OverlayPostObservation> {
  const base = await observeBase(transport, set.operationId)
  if (base.operation === null) {
    throw new Error('The overlay operation row is absent from the destination.')
  }
  assertRegisteredOperationIdentity(base.operation, set, { reviewedAt })
  if (base.operation.status !== 'completed') {
    throw new Error('The overlay operation row is not completed on the destination.')
  }
  const startedAtEpoch = Date.parse(String(base.operation.started_at))
  const completedAtEpoch = Date.parse(String(base.operation.completed_at))
  if (
    !Number.isFinite(startedAtEpoch) ||
    !Number.isFinite(completedAtEpoch) ||
    completedAtEpoch < startedAtEpoch
  ) {
    throw new Error('The overlay operation timestamps are unreadable or out of order.')
  }

  const totals = {
    corpusArticles: totalsNumber(base, 'corpusArticles'),
    reviewedForOperation: totalsNumber(base, 'reviewedForOperation'),
    includeCore: totalsNumber(base, 'includeCore'),
    includeAdjacent: totalsNumber(base, 'includeAdjacent'),
    exclude: totalsNumber(base, 'exclude'),
    physicianConfirmed: totalsNumber(base, 'physicianConfirmed'),
    physicianModified: totalsNumber(base, 'physicianModified'),
    qcAccepted: totalsNumber(base, 'qcAccepted'),
    eventsForOperation: totalsNumber(base, 'eventsForOperation'),
    foreignReviewed: totalsNumber(base, 'foreignReviewed'),
  }
  if (totals.corpusArticles !== OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT) {
    throw new Error('The destination corpus total changed. The overlay must create no article.')
  }
  if (
    totals.reviewedForOperation !== set.counts.recordCount ||
    totals.includeCore !== set.counts.classCounts.include_core ||
    totals.includeAdjacent !== set.counts.classCounts.include_adjacent ||
    totals.exclude !== set.counts.classCounts.exclude ||
    totals.physicianConfirmed !== set.counts.provenanceCounts.physician_confirmed ||
    totals.physicianModified !== set.counts.provenanceCounts.physician_modified ||
    totals.qcAccepted !== set.counts.provenanceCounts.qc_accepted
  ) {
    throw new Error(
      'The actual destination totals do not match the reviewed set exactly. Completion is ' +
        'not licensed.',
    )
  }
  if (totals.eventsForOperation !== set.counts.recordCount) {
    throw new Error('The destination event count does not match the reviewed set exactly.')
  }
  if (totals.foreignReviewed !== 0) {
    throw new Error('The destination carries reviewed articles outside this operation.')
  }

  const batchObservations: OverlayBatchObservation[] = []
  for (const batch of batches) {
    const observation = await observeBatch(transport, set, reviewedAt, batch)
    if (observation.classification !== 'applied_exact') {
      throw new Error('A destination batch is not exactly applied. Completion is not licensed.')
    }
    batchObservations.push(observation)
  }

  const summary = {
    schemaVersion: 'literature-reviewed-overlay-post-observation/1.0.0',
    operationId: set.operationId,
    projectionDigest: set.projectionDigest,
    artifactSha256: set.artifactSha256,
    registry: {
      writerIdentity: base.operation.writer_identity,
      sourceIdentity: base.operation.source_identity,
      curationReason: base.operation.curation_reason,
      reviewedAtEpochMs: Date.parse(String(base.operation.reviewed_at)),
      recordCount: base.operation.record_count,
      includeCoreCount: base.operation.include_core_count,
      includeAdjacentCount: base.operation.include_adjacent_count,
      excludeCount: base.operation.exclude_count,
      physicianConfirmedCount: base.operation.physician_confirmed_count,
      physicianModifiedCount: base.operation.physician_modified_count,
      qcAcceptedCount: base.operation.qc_accepted_count,
      status: base.operation.status,
      startedAtEpochMs: startedAtEpoch,
      completedAtEpochMs: completedAtEpoch,
    },
    totals,
    batches: batchObservations.map((observation) => ({
      index: observation.index,
      classification: observation.classification,
      observed: observation.observed,
    })),
  }
  return { checksum: sha256(canonicalJson(summary)), summary }
}

/** Recompute checkpoint counters as the sum of acknowledged batch effects. */
function syncCounters(checkpoint: OverlayCheckpoint): void {
  let applied = 0
  let alreadyApplied = 0
  for (const batch of checkpoint.batches) {
    if (batch.stage.state === 'acknowledged' && batch.effects) {
      applied += batch.effects.applied
      alreadyApplied += batch.effects.alreadyApplied
    }
  }
  checkpoint.counters = { applied, alreadyApplied }
}

export interface OverlayApplyResult {
  status: 'applied' | 'idempotent-replay'
  checkpointPath: string
  receiptPath: string
  counters: { applied: number; alreadyApplied: number }
  batchCount: number
  postObservationChecksum: string
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
    let pendingReconciliation: unknown = null
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
        pendingReconciliation = await options.readReconciliation(options.reconciliationPath)
        // Binding and internal consistency are judged now; the authoritative re-observation
        // happens after the transport exists, below.
        assertReconciliationReceiptConsistent(loaded, pendingReconciliation)
      }
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
    const { registered } = await assertDestinationPreconditions(transport, set)
    const replayMode = registered !== null && registered.status === 'completed'

    let checkpoint: OverlayCheckpoint
    if (resumedCheckpoint) {
      checkpoint = resumedCheckpoint
      if (pendingReconciliation !== null) {
        await applyReconciliationWithReobservation(
          transport,
          set,
          checkpoint,
          pendingReconciliation,
          replayMode,
          deps.now,
        )
      }
      for (const batch of checkpoint.batches) {
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
      syncCounters(checkpoint)
      checkpoint.phase = 'running'
    } else {
      // The registered operation row is the authority for its own timestamp: a fresh run of an
      // operation that already exists remotely (a from-scratch replay after lost local state)
      // must adopt the registered reviewed_at, or its deterministic per-record payloads could
      // never match the recorded history.
      let reviewedAt: string
      if (registered !== null) {
        const registeredReviewedAt = registered.reviewed_at
        if (
          typeof registeredReviewedAt !== 'string' ||
          !Number.isFinite(Date.parse(registeredReviewedAt))
        ) {
          throw new Error('The registered operation reviewed_at is unreadable. Stopping.')
        }
        reviewedAt = new Date(Date.parse(registeredReviewedAt)).toISOString()
      } else {
        reviewedAt = deps.now().toISOString()
      }
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
        curationReason: OVERLAY_CURATION_REASON,
        counts: set.counts,
        limits: { recordBatchLimit: plan.recordBatchLimit },
        batches: checkpointBatchesForPlan(set, plan),
        phase: 'prepared',
        counters: { applied: 0, alreadyApplied: 0 },
        postObservationChecksum: null,
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
        {
          operationId: set.operationId,
          recordCount: batch.recordCount,
          finalBatch: batch.finalBatch,
          mode: replayMode ? 'replay_completed' : 'in_progress',
        },
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
      batch.reconciliationChecksum = null
      batch.effects = { applied: verdict.applied, alreadyApplied: verdict.alreadyApplied }
      syncCounters(checkpoint)
      checkpoint.updatedAt = deps.now().toISOString()
      await writeOverlayCheckpoint(checkpointPath, checkpoint)
    }

    // An acknowledgement is not proof of remote application. Only the complete read-only
    // post-observation licenses whole-operation completion.
    const postObservation = await performPostObservation(
      transport,
      set,
      checkpoint.reviewedAt,
      checkpoint.batches,
    )

    checkpoint.postObservationChecksum = postObservation.checksum
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
      curationReason: OVERLAY_CURATION_REASON,
      artifactSha256: set.artifactSha256,
      projectionDigest: set.projectionDigest,
      reviewedAt: checkpoint.reviewedAt,
      completedAt: deps.now().toISOString(),
      counts: set.counts,
      counters: { ...checkpoint.counters },
      batchRequestChecksums: checkpoint.batches.map((batch) => batch.requestChecksum),
      checkpointChecksum: overlayCheckpointChecksum(checkpoint),
      postObservationChecksum: postObservation.checksum,
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
      postObservationChecksum: postObservation.checksum,
    }
  } finally {
    await lease.release()
  }
}

export interface OverlayReconciliationReceipt {
  schemaVersion: string
  operationId: string
  checkpointChecksum: string
  observedAt: string
  registryConsistent: boolean
  batches: OverlayBatchObservation[]
  receiptChecksum: string
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

  // The operation registry is observed alongside the batches: a drifted registry means no
  // classification below can be trusted to describe this operation.
  let registryConsistent = false
  try {
    const base = await observeBase(transport, set.operationId)
    if (base.operation === null) {
      registryConsistent = true // exact nonapplication of the registry row itself
    } else {
      assertRegisteredOperationIdentity(base.operation, set, {
        reviewedAt: checkpoint.reviewedAt,
      })
      registryConsistent = true
    }
  } catch {
    registryConsistent = false
  }

  const observations: OverlayBatchObservation[] = []
  for (const batch of unresolved) {
    observations.push(await observeBatch(transport, set, checkpoint.reviewedAt, batch))
  }

  const body = {
    schemaVersion: OVERLAY_RECONCILIATION_SCHEMA_VERSION,
    operationId: checkpoint.operationId,
    checkpointChecksum: sha256(canonicalJson(checkpoint)),
    observedAt: deps.now().toISOString(),
    registryConsistent,
    batches: observations,
  }
  const receipt: OverlayReconciliationReceipt = {
    ...body,
    receiptChecksum: sha256(canonicalJson(body)),
  }
  return { status: 'reconciled', receipt, unresolvedBatchCount: unresolved.length }
}

/**
 * Judge a reconciliation receipt's binding and internal consistency. This is a precondition,
 * not authority: a receipt that passes here still only nominates batches, and the engine
 * re-observes each one freshly before any stage advances.
 */
export function assertReconciliationReceiptConsistent(
  checkpoint: OverlayCheckpoint,
  receiptValue: unknown,
): asserts receiptValue is OverlayReconciliationReceipt {
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
  if (receipt.registryConsistent !== true) {
    throw new Error(
      'The reconciliation observation found the operation registry inconsistent. No further ' +
        'mutation may be attempted; investigate the drift read-only.',
    )
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
    const observed = entry.observed as Record<string, unknown> | undefined
    if (!observed || typeof observed !== 'object') {
      throw new Error('The reconciliation receipt observations are invalid.')
    }
    // Internal consistency: a classification must agree with its own observed counts. A
    // receipt claiming applied_exact over zero events is semantically false and is refused
    // before any re-observation is even attempted.
    if (
      classification === 'applied_exact' &&
      (observed.exactRecords !== batch.recordCount ||
        observed.eventsPresent !== batch.recordCount ||
        observed.driftedRecords !== 0 ||
        observed.inconsistentRecords !== 0 ||
        observed.absentRecords !== 0)
    ) {
      throw new Error('The reconciliation receipt is internally inconsistent.')
    }
    if (
      classification === 'absent_exact' &&
      (observed.absentRecords !== batch.recordCount ||
        observed.eventsPresent !== 0 ||
        observed.exactRecords !== 0 ||
        observed.driftedRecords !== 0 ||
        observed.inconsistentRecords !== 0)
    ) {
      throw new Error('The reconciliation receipt is internally inconsistent.')
    }
    if (classification === 'observation_incomplete') {
      throw new Error(
        'The reconciliation observation is incomplete. No further mutation may be attempted ' +
          'until a complete read-only observation succeeds.',
      )
    }
    if (classification !== 'applied_exact' && classification !== 'absent_exact') {
      throw new Error(
        'The destination state conflicts with the overlay expectation. No further mutation ' +
          'may be attempted; investigate the drift read-only.',
      )
    }
  }
}

/**
 * Fold a reconciliation receipt into a checkpoint — but only after re-observing every batch it
 * names and requiring the fresh classification to agree. The receipt nominates; the fresh
 * observation decides.
 */
export async function applyReconciliationWithReobservation(
  transport: OverlayTransport,
  set: ReviewedSet,
  checkpoint: OverlayCheckpoint,
  receiptValue: unknown,
  replayMode: boolean,
  now: () => Date,
): Promise<void> {
  assertReconciliationReceiptConsistent(checkpoint, receiptValue)
  const receipt = receiptValue as OverlayReconciliationReceipt

  for (const entry of receipt.batches) {
    const batch = checkpoint.batches[entry.index] as OverlayCheckpointBatch
    const fresh = await observeBatch(transport, set, checkpoint.reviewedAt, batch)
    if (fresh.classification !== entry.classification) {
      throw new Error(
        'A fresh observation disagrees with the reconciliation receipt. The receipt is stale; ' +
          'reconcile again read-only.',
      )
    }
    if (fresh.classification === 'applied_exact') {
      batch.stage = {
        state: 'acknowledged',
        submittedAt: batch.stage.submittedAt,
        acknowledgedAt: now().toISOString(),
        failureCode: null,
      }
      batch.acknowledgementChecksum = null
      batch.reconciliationChecksum = sha256(canonicalJson(fresh))
      // The lost acknowledgement's fresh/replay split is decided by the operation's status at
      // observation time: a completed operation can only have been replayed; a started one can
      // only have applied.
      batch.effects = replayMode
        ? { applied: 0, alreadyApplied: batch.recordCount }
        : { applied: batch.recordCount, alreadyApplied: 0 }
    } else {
      batch.stage = {
        state: 'prepared',
        submittedAt: null,
        acknowledgedAt: null,
        failureCode: null,
      }
      batch.acknowledgementChecksum = null
      batch.reconciliationChecksum = null
      batch.effects = null
    }
  }
  syncCounters(checkpoint)
  checkpoint.phase = 'running'
}

export interface OverlayVerifyResult {
  status: 'verified'
  operationId: string
  postObservationChecksum: string
  remote: {
    registry: Record<string, unknown>
    totals: Record<string, unknown>
    batchesExact: number
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

  const postObservation = await performPostObservation(
    transport,
    set,
    checkpoint.reviewedAt,
    checkpoint.batches,
  )
  if (postObservation.checksum !== checkpoint.postObservationChecksum) {
    throw new Error(
      'The fresh post-observation does not match the completion binding. The destination ' +
        'state moved after completion; investigate read-only.',
    )
  }

  const summary = postObservation.summary as {
    registry: Record<string, unknown>
    totals: Record<string, unknown>
    batches: unknown[]
  }
  return {
    status: 'verified',
    operationId: set.operationId,
    postObservationChecksum: postObservation.checksum,
    remote: {
      registry: summary.registry,
      totals: summary.totals,
      batchesExact: summary.batches.length,
    },
  }
}
