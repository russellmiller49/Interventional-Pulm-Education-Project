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
  overlayCheckpointMode,
  readOverlayCheckpoint,
  validateOverlayReceiptAgainstCheckpoint,
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
  OVERLAY_MAX_RECORD_BATCH_LIMIT,
  OVERLAY_OWNER_AUTHORIZATION_ENV_NAME,
  OVERLAY_OWNER_AUTHORIZATION_SENTENCE,
  OVERLAY_PROJECTION_SHA256_ENV_NAME,
  OVERLAY_RECEIPT_SCHEMA_VERSION,
  OVERLAY_RECONCILIATION_SCHEMA_VERSION,
  OVERLAY_REQUEST_MODES,
  OVERLAY_SOURCE_IDENTITY,
  OVERLAY_WRITER_IDENTITY,
  type OverlayRequestMode,
} from './constants'
import { assertDeterministicUuid } from './identity'
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
  // A dry run plans the fresh application: it contacts no destination, so it has no registry
  // status to consult, and the operation it describes is the one that would freshly apply.
  const plan = buildOverlayPlan(set, reviewedAt, options.recordBatchLimit, 'fresh')
  const checksums = plan.batches.map(
    (descriptor) => buildBatchRequest(set, reviewedAt, descriptor).checksum,
  )
  const body: OverlayReceiptBody = {
    schemaVersion: OVERLAY_RECEIPT_SCHEMA_VERSION,
    engineVersion: OVERLAY_ENGINE_VERSION,
    operationId: set.operationId,
    outcome: 'dry-run',
    causalMode: 'fresh',
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
      // Every durable request body must be reproducible byte-for-byte before any request —
      // including its causal mode, which the request body carries and the checksum binds.
      for (const batch of loaded.batches) {
        const descriptor: OverlayBatchDescriptor = {
          index: batch.index,
          startOrdinal: batch.startOrdinal,
          endOrdinal: batch.endOrdinal,
          recordCount: batch.recordCount,
          finalBatch: batch.finalBatch,
          requestMode: batch.requestMode,
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
    // The causal mode of a NEW plan, decided once at checkpoint-creation time: an operation
    // already completed remotely can only be replayed; anything else is a fresh application.
    // A resumed checkpoint never consults this — its batches carry their durable modes, and
    // the registry's later status must not rewrite them.
    const plannedMode: OverlayRequestMode =
      registered !== null && registered.status === 'completed' ? 'replay' : 'fresh'

    let checkpoint: OverlayCheckpoint
    if (resumedCheckpoint) {
      checkpoint = resumedCheckpoint
      if (pendingReconciliation !== null) {
        await applyReconciliationWithReobservation(
          transport,
          set,
          checkpoint,
          pendingReconciliation,
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
      const plan = buildOverlayPlan(set, reviewedAt, options.recordBatchLimit, plannedMode)
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
        requestMode: batch.requestMode,
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

      // The acknowledgement is judged in the batch's own durable causal context — never in a
      // context re-derived from the registry's current status.
      const verdict = acknowledgementMatches(
        {
          operationId: set.operationId,
          recordCount: batch.recordCount,
          finalBatch: batch.finalBatch,
          requestMode: batch.requestMode,
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

    // The outcome is the causal mode's completion vocabulary, read from the durable batch
    // modes — never inferred from counters or from the registry's final status.
    const causalMode = overlayCheckpointMode(checkpoint)
    const outcome = causalMode === 'replay' ? 'idempotent-replay' : 'completed'
    const body: OverlayReceiptBody = {
      schemaVersion: OVERLAY_RECEIPT_SCHEMA_VERSION,
      engineVersion: OVERLAY_ENGINE_VERSION,
      operationId: set.operationId,
      outcome,
      causalMode,
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
    const receipt = receiptWithChecksum(body)
    // The receipt must bind to the completed checkpoint exactly before it may exist at all —
    // the same total comparison every later consumer applies.
    validateOverlayReceiptAgainstCheckpoint(receipt, checkpoint)
    const finalReceiptPath =
      outcome === 'idempotent-replay'
        ? `${options.stateDirectory}/overlay-${set.operationId}.replay-${Date.now()}.receipt.json`
        : receiptPath
    await writeOverlayReceiptImmutable(finalReceiptPath, receipt)

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

/**
 * The operation-scope totals every reconciliation observes beside the per-batch state. These
 * are what make an extra event or an extra article under the operation visible: per-batch
 * reads can only see the records they name, so exactness over the operation requires the
 * destination's own aggregate view.
 */
export interface OverlayOperationScope {
  corpusArticles: number
  reviewedForOperation: number
  eventsForOperation: number
  foreignReviewed: number
}

export interface OverlayReconciliationBatchEvidence {
  index: number
  /** The checkpointed request identity this evidence describes. */
  requestChecksum: string
  /** The request's durable causal mode — recorded, never re-derived from the registry. */
  requestMode: OverlayRequestMode
  expectedRecordCount: number
  classification: OverlayBatchClassification
  observed: OverlayBatchObservation['observed']
  /** Canonical checksum of the exact observation record this evidence was written from. */
  observationChecksum: string
}

export interface OverlayReconciliationReceipt {
  schemaVersion: string
  operationId: string
  checkpointChecksum: string
  observedAt: string
  registryConsistent: boolean
  /** Null exactly when the registry observation itself failed (registryConsistent false). */
  operationScope: OverlayOperationScope | null
  batches: OverlayReconciliationBatchEvidence[]
  receiptChecksum: string
}

export interface OverlayReconcileResult {
  status: 'reconciled'
  receipt: OverlayReconciliationReceipt
  unresolvedBatchCount: number
}

function scopeOf(view: OverlayObservationView): OverlayOperationScope {
  return {
    corpusArticles: totalsNumber(view, 'corpusArticles'),
    reviewedForOperation: totalsNumber(view, 'reviewedForOperation'),
    eventsForOperation: totalsNumber(view, 'eventsForOperation'),
    foreignReviewed: totalsNumber(view, 'foreignReviewed'),
  }
}

/**
 * Whether the operation-scope totals account for every article and event exactly, given the
 * checkpoint's acknowledged batches and the classifications of the unresolved ones.
 *
 * Fresh-mode operations: every reviewed article under the operation must belong to an
 * acknowledged batch or to an unresolved batch observed exactly applied — an extra article is
 * unaccountable drift. Replay-mode operations: the completed operation's full record set must
 * be present, no more and no less. In both modes every reviewed article carries exactly one
 * deterministic event, so an event total differing from the reviewed total (the 631st event)
 * is unaccountable in itself.
 */
function operationScopeConsistent(
  checkpoint: OverlayCheckpoint,
  scope: OverlayOperationScope,
  classificationByIndex: ReadonlyMap<number, OverlayBatchClassification>,
): boolean {
  if (scope.corpusArticles !== OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT) return false
  if (scope.foreignReviewed !== 0) return false
  if (scope.eventsForOperation !== scope.reviewedForOperation) return false
  let expectedReviewed: number
  if (overlayCheckpointMode(checkpoint) === 'replay') {
    expectedReviewed = checkpoint.counts.recordCount
  } else {
    expectedReviewed = 0
    for (const batch of checkpoint.batches) {
      if (batch.stage.state === 'acknowledged') {
        expectedReviewed += batch.recordCount
      } else if (classificationByIndex.get(batch.index) === 'applied_exact') {
        expectedReviewed += batch.recordCount
      }
    }
  }
  return scope.reviewedForOperation === expectedReviewed
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

  // The operation registry and the operation-scope totals are observed alongside the batches:
  // a drifted registry means no classification below can be trusted to describe this
  // operation, and inconsistent totals mean no batch can honestly claim exactness.
  let registryConsistent = false
  let operationScope: OverlayOperationScope | null = null
  try {
    const base = await observeBase(transport, set.operationId)
    operationScope = scopeOf(base)
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
    operationScope = null
  }

  const observations: OverlayBatchObservation[] = []
  for (const batch of unresolved) {
    observations.push(await observeBatch(transport, set, checkpoint.reviewedAt, batch))
  }

  // Exactness is an operation property, not only a batch property: a batch whose own records
  // read exactly applied still is not `applied_exact` while the operation carries an extra
  // event, an extra article, a foreign review, or a changed corpus. Such a batch is drifted
  // at the operation scope — never silently exact.
  const classificationByIndex = new Map(
    observations.map((observation) => [observation.index, observation.classification]),
  )
  const scopeConsistent =
    registryConsistent &&
    operationScope !== null &&
    operationScopeConsistent(checkpoint, operationScope, classificationByIndex)
  const finalObservations = observations.map((observation) => {
    if (
      !scopeConsistent &&
      (observation.classification === 'applied_exact' ||
        observation.classification === 'absent_exact')
    ) {
      return { ...observation, classification: 'drifted' as const }
    }
    return observation
  })

  const body = {
    schemaVersion: OVERLAY_RECONCILIATION_SCHEMA_VERSION,
    operationId: checkpoint.operationId,
    checkpointChecksum: overlayCheckpointChecksum(checkpoint),
    observedAt: deps.now().toISOString(),
    registryConsistent,
    operationScope,
    batches: finalObservations.map((observation): OverlayReconciliationBatchEvidence => {
      const batch = checkpoint.batches[observation.index] as OverlayCheckpointBatch
      return {
        index: observation.index,
        requestChecksum: batch.requestChecksum,
        requestMode: batch.requestMode,
        expectedRecordCount: batch.recordCount,
        classification: observation.classification,
        observed: observation.observed,
        observationChecksum: sha256(canonicalJson(observation)),
      }
    }),
  }
  const receipt: OverlayReconciliationReceipt = {
    ...body,
    receiptChecksum: sha256(canonicalJson(body)),
  }
  return { status: 'reconciled', receipt, unresolvedBatchCount: unresolved.length }
}

const BATCH_CLASSIFICATIONS = new Set<OverlayBatchClassification>([
  'applied_exact',
  'absent_exact',
  'partial',
  'mixed',
  'drifted',
  'ambiguous',
  'observation_incomplete',
])

function requireReceiptRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`The reconciliation receipt ${label} must be a JSON object.`)
  }
  return value as Record<string, unknown>
}

function requireExactReceiptKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...expected].sort())) {
    throw new Error(`The reconciliation receipt ${label} carries missing or unexpected fields.`)
  }
}

function requireReceiptInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`The reconciliation receipt ${label} must be a non-negative safe integer.`)
  }
  return value
}

function requireReceiptSha256(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`The reconciliation receipt ${label} must be a lowercase SHA-256 digest.`)
  }
  return value
}

/**
 * The strict standalone reconciliation-receipt schema: exact keys, exact primitive types, and
 * full count arithmetic at every level. Binding to a checkpoint and actionability are judged
 * separately — this validator refuses malformed evidence before any of that is considered.
 */
export function validateOverlayReconciliationReceipt(
  value: unknown,
): asserts value is OverlayReconciliationReceipt {
  const receipt = requireReceiptRecord(value, 'envelope')
  requireExactReceiptKeys(
    receipt,
    [
      'schemaVersion',
      'operationId',
      'checkpointChecksum',
      'observedAt',
      'registryConsistent',
      'operationScope',
      'batches',
      'receiptChecksum',
    ],
    'envelope',
  )
  if (receipt.schemaVersion !== OVERLAY_RECONCILIATION_SCHEMA_VERSION) {
    throw new Error('The reconciliation receipt schema is not supported.')
  }
  assertDeterministicUuid(receipt.operationId, 'The reconciliation receipt operation id')
  requireReceiptSha256(receipt.checkpointChecksum, 'checkpointChecksum')
  requireReceiptSha256(receipt.receiptChecksum, 'receiptChecksum')
  if (typeof receipt.observedAt !== 'string' || !Number.isFinite(Date.parse(receipt.observedAt))) {
    throw new Error('The reconciliation receipt observedAt must be an ISO-compatible timestamp.')
  }
  if (typeof receipt.registryConsistent !== 'boolean') {
    throw new Error('The reconciliation receipt registryConsistent must be a boolean.')
  }
  if (receipt.operationScope === null) {
    if (receipt.registryConsistent !== false) {
      throw new Error(
        'The reconciliation receipt omits the operation scope while claiming a consistent ' +
          'registry observation.',
      )
    }
  } else {
    const scope = requireReceiptRecord(receipt.operationScope, 'operationScope')
    requireExactReceiptKeys(
      scope,
      ['corpusArticles', 'reviewedForOperation', 'eventsForOperation', 'foreignReviewed'],
      'operationScope',
    )
    requireReceiptInteger(scope.corpusArticles, 'operationScope.corpusArticles')
    requireReceiptInteger(scope.reviewedForOperation, 'operationScope.reviewedForOperation')
    requireReceiptInteger(scope.eventsForOperation, 'operationScope.eventsForOperation')
    requireReceiptInteger(scope.foreignReviewed, 'operationScope.foreignReviewed')
  }
  if (!Array.isArray(receipt.batches)) {
    throw new Error('The reconciliation receipt batches must be an array.')
  }
  const seenIndexes = new Set<number>()
  receipt.batches.forEach((value_, position) => {
    const entry = requireReceiptRecord(value_, `batches[${position}]`)
    requireExactReceiptKeys(
      entry,
      [
        'index',
        'requestChecksum',
        'requestMode',
        'expectedRecordCount',
        'classification',
        'observed',
        'observationChecksum',
      ],
      `batches[${position}]`,
    )
    const index = requireReceiptInteger(entry.index, `batches[${position}].index`)
    if (seenIndexes.has(index)) {
      throw new Error('The reconciliation receipt repeats a batch index.')
    }
    seenIndexes.add(index)
    requireReceiptSha256(entry.requestChecksum, `batches[${position}].requestChecksum`)
    if (
      typeof entry.requestMode !== 'string' ||
      !OVERLAY_REQUEST_MODES.includes(entry.requestMode as OverlayRequestMode)
    ) {
      throw new Error('The reconciliation receipt names an unknown request causal mode.')
    }
    const expectedRecordCount = requireReceiptInteger(
      entry.expectedRecordCount,
      `batches[${position}].expectedRecordCount`,
    )
    if (expectedRecordCount < 1 || expectedRecordCount > OVERLAY_MAX_RECORD_BATCH_LIMIT) {
      throw new Error('The reconciliation receipt expected record count is out of bounds.')
    }
    if (
      typeof entry.classification !== 'string' ||
      !BATCH_CLASSIFICATIONS.has(entry.classification as OverlayBatchClassification)
    ) {
      throw new Error('The reconciliation receipt names an unknown classification.')
    }
    const observed = requireReceiptRecord(entry.observed, `batches[${position}].observed`)
    requireExactReceiptKeys(
      observed,
      [
        'recordCount',
        'exactRecords',
        'absentRecords',
        'driftedRecords',
        'inconsistentRecords',
        'eventsPresent',
      ],
      `batches[${position}].observed`,
    )
    const recordCount = requireReceiptInteger(
      observed.recordCount,
      `batches[${position}].observed.recordCount`,
    )
    const exactRecords = requireReceiptInteger(
      observed.exactRecords,
      `batches[${position}].observed.exactRecords`,
    )
    const absentRecords = requireReceiptInteger(
      observed.absentRecords,
      `batches[${position}].observed.absentRecords`,
    )
    const driftedRecords = requireReceiptInteger(
      observed.driftedRecords,
      `batches[${position}].observed.driftedRecords`,
    )
    const inconsistentRecords = requireReceiptInteger(
      observed.inconsistentRecords,
      `batches[${position}].observed.inconsistentRecords`,
    )
    const eventsPresent = requireReceiptInteger(
      observed.eventsPresent,
      `batches[${position}].observed.eventsPresent`,
    )
    requireReceiptSha256(entry.observationChecksum, `batches[${position}].observationChecksum`)

    // Count arithmetic: the observation must account for every record of the batch exactly
    // once, and can never see more events than records or fewer events than exact records.
    if (recordCount !== expectedRecordCount) {
      throw new Error(
        'The reconciliation receipt observed record count does not equal the expected ' +
          'record count.',
      )
    }
    if (exactRecords + absentRecords + driftedRecords + inconsistentRecords !== recordCount) {
      throw new Error(
        'The reconciliation receipt observed counts do not account for every record ' +
          'exactly once.',
      )
    }
    if (eventsPresent > recordCount || eventsPresent < exactRecords) {
      throw new Error('The reconciliation receipt event count is impossible.')
    }

    // Classification-versus-observation semantics. `applied_exact` and `absent_exact` are
    // total claims; the mixed/partial/ambiguous vocabulary must at least exhibit what it
    // names. (`drifted` may also describe operation-scope drift over record-exact batches,
    // and `observation_incomplete` carries whatever was gathered before the failure.)
    const classification = entry.classification as OverlayBatchClassification
    if (
      classification === 'applied_exact' &&
      (exactRecords !== recordCount ||
        eventsPresent !== recordCount ||
        absentRecords !== 0 ||
        driftedRecords !== 0 ||
        inconsistentRecords !== 0)
    ) {
      throw new Error('The reconciliation receipt is internally inconsistent.')
    }
    if (
      classification === 'absent_exact' &&
      (absentRecords !== recordCount ||
        eventsPresent !== 0 ||
        exactRecords !== 0 ||
        driftedRecords !== 0 ||
        inconsistentRecords !== 0)
    ) {
      throw new Error('The reconciliation receipt is internally inconsistent.')
    }
    if (classification === 'ambiguous' && inconsistentRecords === 0) {
      throw new Error('The reconciliation receipt is internally inconsistent.')
    }
    if (
      classification === 'partial' &&
      (exactRecords === 0 ||
        absentRecords === 0 ||
        driftedRecords !== 0 ||
        inconsistentRecords !== 0)
    ) {
      throw new Error('The reconciliation receipt is internally inconsistent.')
    }
    if (
      classification === 'mixed' &&
      (driftedRecords === 0 ||
        (exactRecords === 0 && absentRecords === 0) ||
        inconsistentRecords !== 0)
    ) {
      throw new Error('The reconciliation receipt is internally inconsistent.')
    }
  })
}

/**
 * Judge a reconciliation receipt's schema, binding, and internal consistency against its
 * checkpoint. This is a precondition, not authority: a receipt that passes here still only
 * nominates batches, and the engine re-observes each one freshly before any stage advances.
 */
export function assertReconciliationReceiptConsistent(
  checkpoint: OverlayCheckpoint,
  receiptValue: unknown,
): asserts receiptValue is OverlayReconciliationReceipt {
  validateOverlayReconciliationReceipt(receiptValue)
  const receipt = receiptValue as OverlayReconciliationReceipt
  if (receipt.operationId !== checkpoint.operationId) {
    throw new Error('The reconciliation receipt belongs to a different operation.')
  }
  const { receiptChecksum, ...body } = receipt
  if (receiptChecksum !== sha256(canonicalJson(body))) {
    throw new Error('The reconciliation receipt checksum does not match.')
  }
  if (receipt.checkpointChecksum !== overlayCheckpointChecksum(checkpoint)) {
    throw new Error('The reconciliation receipt was produced against a different checkpoint state.')
  }
  if (receipt.registryConsistent !== true) {
    throw new Error(
      'The reconciliation observation found the operation registry inconsistent. No further ' +
        'mutation may be attempted; investigate the drift read-only.',
    )
  }
  if (receipt.operationScope === null) {
    throw new Error(
      'The reconciliation receipt carries no operation-scope observation. No further ' +
        'mutation may be attempted.',
    )
  }
  for (const entry of receipt.batches) {
    const batch = checkpoint.batches[entry.index]
    if (!batch || (batch.stage.state !== 'submitted' && batch.stage.state !== 'ambiguous')) {
      throw new Error('The reconciliation receipt names a batch that is not unresolved.')
    }
    // The evidence must describe the exact checkpointed request: its checksum, its durable
    // causal mode, and its record count. A receipt claiming the opposite causal mode is a
    // rewritten history, not a variant reading.
    if (entry.requestChecksum !== batch.requestChecksum) {
      throw new Error('The reconciliation receipt does not name the checkpointed request identity.')
    }
    if (entry.requestMode !== batch.requestMode) {
      throw new Error(
        'The reconciliation receipt contradicts the request causal mode the checkpoint ' +
          'durably recorded.',
      )
    }
    if (entry.expectedRecordCount !== batch.recordCount) {
      throw new Error('The reconciliation receipt does not name the checkpointed record count.')
    }
    if (entry.classification === 'observation_incomplete') {
      throw new Error(
        'The reconciliation observation is incomplete. No further mutation may be attempted ' +
          'until a complete read-only observation succeeds.',
      )
    }
    if (entry.classification !== 'applied_exact' && entry.classification !== 'absent_exact') {
      throw new Error(
        'The destination state conflicts with the overlay expectation. No further mutation ' +
          'may be attempted; investigate the drift read-only.',
      )
    }
    if (entry.classification === 'absent_exact' && batch.requestMode === 'replay') {
      throw new Error(
        "A completed operation's records cannot be exactly absent. No further mutation may " +
          'be attempted; investigate the drift read-only.',
      )
    }
  }
  // The recorded operation scope must account for every article and event exactly, under the
  // recorded classifications. An extra event or article under the operation is unaccountable
  // and refuses every nomination.
  const classificationByIndex = new Map(
    receipt.batches.map((entry) => [entry.index, entry.classification]),
  )
  if (!operationScopeConsistent(checkpoint, receipt.operationScope, classificationByIndex)) {
    throw new Error(
      'The reconciliation receipt operation scope does not account for every article and ' +
        'event exactly. No further mutation may be attempted; investigate the drift read-only.',
    )
  }
}

/**
 * Fold a reconciliation receipt into a checkpoint — but only after freshly re-observing the
 * operation scope and every batch the receipt names, and requiring the fresh evidence to agree
 * with the receipt exactly. The receipt nominates; the fresh observation decides. Effects are
 * recorded under each batch's durable causal mode: a fresh request observed exactly applied
 * was applied by this operation, whatever the registry's status has since become, and a replay
 * request observed exactly applied applied nothing.
 */
export async function applyReconciliationWithReobservation(
  transport: OverlayTransport,
  set: ReviewedSet,
  checkpoint: OverlayCheckpoint,
  receiptValue: unknown,
  now: () => Date,
): Promise<void> {
  assertReconciliationReceiptConsistent(checkpoint, receiptValue)
  const receipt = receiptValue as OverlayReconciliationReceipt

  // Fresh operation-scope observation: the registry identity and the aggregate totals must be
  // consistent NOW, not merely at reconcile time.
  const base = await observeBase(transport, set.operationId)
  if (base.operation !== null) {
    assertRegisteredOperationIdentity(base.operation, set, { reviewedAt: checkpoint.reviewedAt })
  }
  const freshScope = scopeOf(base)

  const freshObservations: OverlayBatchObservation[] = []
  for (const entry of receipt.batches) {
    const batch = checkpoint.batches[entry.index] as OverlayCheckpointBatch
    freshObservations.push(await observeBatch(transport, set, checkpoint.reviewedAt, batch))
  }
  const freshClassifications = new Map(
    freshObservations.map((observation) => [observation.index, observation.classification]),
  )
  if (!operationScopeConsistent(checkpoint, freshScope, freshClassifications)) {
    throw new Error(
      'The fresh operation-scope observation does not account for every article and event ' +
        'exactly. The receipt is stale; reconcile again read-only.',
    )
  }

  receipt.batches.forEach((entry, position) => {
    const fresh = freshObservations[position] as OverlayBatchObservation
    if (
      fresh.classification !== entry.classification ||
      sha256(canonicalJson(fresh)) !== entry.observationChecksum
    ) {
      throw new Error(
        'A fresh observation disagrees with the reconciliation receipt. The receipt is stale; ' +
          'reconcile again read-only.',
      )
    }
  })

  for (const entry of receipt.batches) {
    const batch = checkpoint.batches[entry.index] as OverlayCheckpointBatch
    if (entry.classification === 'applied_exact') {
      const fresh = freshObservations.find(
        (observation) => observation.index === entry.index,
      ) as OverlayBatchObservation
      batch.stage = {
        state: 'acknowledged',
        submittedAt: batch.stage.submittedAt,
        acknowledgedAt: now().toISOString(),
        failureCode: null,
      }
      batch.acknowledgementChecksum = null
      batch.reconciliationChecksum = sha256(canonicalJson(fresh))
      // Effects follow the durable causal mode, never the registry's current status.
      batch.effects =
        batch.requestMode === 'replay'
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
  /** The operation's durable causal mode, read from the completed checkpoint's batches. */
  causalMode: OverlayRequestMode
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
    causalMode: overlayCheckpointMode(checkpoint),
    postObservationChecksum: postObservation.checksum,
    remote: {
      registry: summary.registry,
      totals: summary.totals,
      batchesExact: summary.batches.length,
    },
  }
}
