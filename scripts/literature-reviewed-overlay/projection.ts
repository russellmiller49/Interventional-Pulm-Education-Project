/**
 * Positive-selection cohort projection from the protected local gold database.
 *
 * This is the overlay's counterpart of the ingest's `canary-candidates.ts`, and it crosses the
 * same guarded boundary (`streamGuardedReadOnlyQuery`): the same Docker/context/container/image
 * guards, the same repeatable-read read-only transaction, the same attestation frames, the same
 * terminal `rollback`. What differs is the projection — this module is authorized to read the
 * development cohort's membership and its persisted review heads, and nothing else.
 *
 * ## The observed division of authority
 *
 * The local database persists review heads for only part of the cohort (the pre-artifact
 * workspace reviews, including the two known append-only note corrections at revision 2); the
 * remaining items are `pending` with no review row, and their physician relevance truth lives
 * exclusively in the finalized V3 artifact. This module therefore yields, per item, the
 * persisted head where one exists and an explicit absence where none does; `reviewed-set.ts`
 * requires every persisted head to agree with the artifact and takes the artifact as the
 * authoritative source of the imported values, exactly as the field-lineage contract assigns
 * the two authorities.
 *
 * ## What it must never read
 *
 * It contains no SQL that could read:
 *
 *   - the held-out split, in any form — not to count it, not to exclude by anti-join, not to
 *     infer its size by subtraction;
 *   - physician notes, confidences, metadata sufficiency, taxonomy arrays, sampling fields, or
 *     any coordinator-only column;
 *   - `dataset_split` as an emitted value — it appears once, as a literal in a WHERE clause,
 *     and never in a SELECT list.
 */

import {
  SOURCE_ATTESTATION_SQL,
  SOURCE_COMPLETE_PREFIX,
  SOURCE_IDENTITY_PREFIX,
  SOURCE_RECORD_PREFIX,
} from '../literature-production-ingest/source'
import {
  OVERLAY_BATCH_KIND,
  OVERLAY_BATCH_NAME,
  OVERLAY_DEVELOPMENT_SPLIT,
  OVERLAY_EXPECTED_RECORD_COUNT,
  OVERLAY_NOTE_CORRECTIONS,
  OVERLAY_RELEVANCE_VALUES,
  type OverlayRelevance,
} from './constants'

/**
 * Columns that may never appear in this module's SELECT list. Asserted against the generated
 * SQL by `projection.test.ts`, so a future edit that adds one fails a test rather than quietly
 * widening what the overlay reads.
 */
export const OVERLAY_FORBIDDEN_PROJECTION_COLUMNS: readonly string[] = [
  'dataset_split',
  // Batch sampling parameters: each is a way to describe the cohort by arithmetic rather than
  // identity, and `requested_size`/`test_percent` together give the held-out size.
  'requested_size',
  'test_percent',
  'sampling_seed',
  'sampling_report',
  'sampling_algorithm_version',
  'sampling_metadata',
  'sampling_reason',
  'sample_stratum',
  // Coordinator-only review content. The overlay imports relevance truth, not review content.
  'notes',
  'physician_notes',
  'reviewer_confidence',
  'metadata_sufficiency',
  'reviewer_email',
  'reviewer_user_id',
  'topic_ids',
  'technology_tags',
  'clinical_purposes',
  'disease_tags',
  'study_design',
  'publication_status',
  'categorization_from_full_text',
  'used_supplemental_metadata',
  'review_seconds',
  'is_blinded',
  'full_text_used',
  'payload',
  'review_payload',
  'automated_signals',
]

/** A single-quoted SQL literal for reviewed module constants that cannot contain a quote. */
function sqlText(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

/** The cohort-membership and persisted-head fields, and nothing else. */
const PROJECTION_FIELDS = [
  ['pmid', 'item.pmid'],
  ['reviewStatus', 'item.review_status'],
  ['hasHead', '(review.id is not null)'],
  ['relevanceLabel', 'review.relevance_label'],
  ['headRevision', 'review.revision'],
  ['revisionKind', "coalesce(review.revision_kind, 'standard')"],
  ['lifecycleState', "coalesce(review.lifecycle_state, 'effective')"],
] as const

/**
 * The read-only cohort query.
 *
 * The batch join authenticates the one authoritative batch by its unique name and its kind; it
 * projects no batch column and constrains no lifecycle state. The scoping is positive and
 * exact, so the held-out split is never selected, counted, or inferred by difference, and a
 * batch added later cannot silently widen the cohort. The persisted head is reached only
 * through `item.current_review_id`, so a superseded revision can never masquerade as the head.
 */
export function buildCohortSql(): string {
  const projection = PROJECTION_FIELDS.map(([key, expression]) => `'${key}', ${expression}`).join(
    ',\n      ',
  )

  return `begin transaction isolation level repeatable read read only;
set local statement_timeout = '0';
select '${SOURCE_IDENTITY_PREFIX}' || ${SOURCE_ATTESTATION_SQL}::text;
select '${SOURCE_RECORD_PREFIX}' || jsonb_build_object(
      ${projection}
)::text
from public.literature_gold_set_items as item
join public.literature_gold_set_batches as batch on batch.id = item.batch_id
left join public.literature_gold_set_reviews as review on review.id = item.current_review_id
where batch.name = ${sqlText(OVERLAY_BATCH_NAME)}
  and batch.kind = ${sqlText(OVERLAY_BATCH_KIND)}
  and item.dataset_split = ${sqlText(OVERLAY_DEVELOPMENT_SPLIT)}
order by item.pmid collate "C" asc;
select '${SOURCE_COMPLETE_PREFIX}' || ${SOURCE_ATTESTATION_SQL}::text;
rollback;`
}

/** One development-cohort item: membership plus its persisted head, if any. */
export interface CohortItem {
  pmid: string
  /** The persisted head's relevance label, or null when the item has no persisted review. */
  persistedLabel: OverlayRelevance | null
  /** The persisted head's revision, or null when the item has no persisted review. */
  persistedHeadRevision: number | null
}

function assertPmid(value: unknown): string {
  // The value is never echoed on failure: an error message carrying a rejected PMID would be a
  // disclosure from the very cohort this module exists to handle carefully.
  if (typeof value !== 'string' || !/^[0-9]{1,12}$/u.test(value)) {
    throw new Error('A cohort row PMID was not a 1-12 digit numeric string.')
  }
  return value
}

function normalizeRow(value: unknown, ordinal: number): CohortItem {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Cohort row ${ordinal} was not an object.`)
  }
  const row = value as Record<string, unknown>

  for (const forbidden of OVERLAY_FORBIDDEN_PROJECTION_COLUMNS) {
    if (forbidden in row) {
      throw new Error(
        `Cohort row ${ordinal} carried the forbidden field "${forbidden}". The overlay ` +
          'projection must remain membership-and-head-only.',
      )
    }
  }

  const pmid = assertPmid(row.pmid)

  if (row.reviewStatus === 'completed') {
    if (row.hasHead !== true) {
      throw new Error(`Cohort row ${ordinal} is completed but has no persisted head.`)
    }
    if (row.lifecycleState !== 'effective') {
      throw new Error(`Cohort row ${ordinal} persisted head is not effective.`)
    }
    if (row.revisionKind !== 'standard') {
      throw new Error(
        `Cohort row ${ordinal} persisted head is not a standard physician revision. The ` +
          'local import or compensation workflow has changed the heads; the overlay refuses ' +
          'to proceed until its head-lineage assumptions are re-reviewed.',
      )
    }
    const label = row.relevanceLabel
    if (
      typeof label !== 'string' ||
      !(OVERLAY_RELEVANCE_VALUES as readonly string[]).includes(label)
    ) {
      // `uncertain` and anything unknown both land here: the finalized cohort contains neither.
      throw new Error(`Cohort row ${ordinal} persisted head has an unknown relevance label.`)
    }
    const revision = row.headRevision
    if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1) {
      throw new Error(`Cohort row ${ordinal} persisted head has an invalid revision.`)
    }
    return {
      pmid,
      persistedLabel: label as OverlayRelevance,
      persistedHeadRevision: revision,
    }
  }

  if (row.reviewStatus === 'pending') {
    if (row.hasHead !== false || row.relevanceLabel !== null || row.headRevision !== null) {
      throw new Error(`Cohort row ${ordinal} is pending but carries persisted head fields.`)
    }
    return { pmid, persistedLabel: null, persistedHeadRevision: null }
  }

  // `in_progress` and `return_later` mean the local workspace is mid-change; the cohort is not
  // stable enough to project.
  throw new Error(`Cohort row ${ordinal} has an unstable review status.`)
}

/**
 * Turn the record frames the guarded boundary yielded into the exact cohort projection.
 *
 * Framing, attestation, and fail-closed exit are the boundary's job; what is enforced here is
 * what is genuinely about the cohort: the membership-and-head-only projection, stable item
 * states, effective standard heads, no duplicates, the exact expected size, and the two known
 * corrections persisted at exactly their checksum-bound revisions.
 */
export function collectCohort(payloads: readonly unknown[]): CohortItem[] {
  const rows = payloads.map((payload, index) => normalizeRow(payload, index + 1))

  const unique = new Set(rows.map((row) => row.pmid))
  if (unique.size !== rows.length) {
    throw new Error('The cohort projection contained duplicate PMIDs.')
  }
  if (rows.length !== OVERLAY_EXPECTED_RECORD_COUNT) {
    throw new Error(
      `The cohort projection held ${rows.length} records; exactly ` +
        `${OVERLAY_EXPECTED_RECORD_COUNT} are expected. Refusing to build an overlay from a ` +
        'partial cohort.',
    )
  }

  const rowsByPmid = new Map(rows.map((row) => [row.pmid, row]))
  for (const correction of OVERLAY_NOTE_CORRECTIONS) {
    const row = rowsByPmid.get(correction.pmid)
    if (!row) {
      throw new Error('A recorded correction PMID is missing from the cohort projection.')
    }
    if (row.persistedHeadRevision !== correction.expectedHeadRevision) {
      throw new Error(
        'A recorded correction head is not at its checksum-bound revision. The two known ' +
          'append-only corrections must remain preserved exactly as recorded.',
      )
    }
  }

  return rows
}

export interface CohortAggregates {
  count: number
  persistedHeadCount: number
  pendingCount: number
  persistedLabelCounts: Record<OverlayRelevance, number>
  /** Persisted-head revision histogram, keyed by revision number rendered as a string. */
  persistedRevisionCounts: Record<string, number>
  correctionHeadRevisions: number[]
}

/**
 * Aggregate characteristics of the cohort projection. Deliberately counts only — everything
 * here is safe to print, and no function in this module returns PMIDs in a printable form.
 */
export function summarizeCohort(rows: readonly CohortItem[]): CohortAggregates {
  const persistedLabelCounts: Record<OverlayRelevance, number> = {
    include_core: 0,
    include_adjacent: 0,
    exclude: 0,
  }
  const persistedRevisionCounts: Record<string, number> = {}
  let persistedHeadCount = 0
  for (const row of rows) {
    if (row.persistedLabel !== null && row.persistedHeadRevision !== null) {
      persistedHeadCount += 1
      persistedLabelCounts[row.persistedLabel] += 1
      const key = String(row.persistedHeadRevision)
      persistedRevisionCounts[key] = (persistedRevisionCounts[key] ?? 0) + 1
    }
  }
  const rowsByPmid = new Map(rows.map((row) => [row.pmid, row]))
  return {
    count: rows.length,
    persistedHeadCount,
    pendingCount: rows.length - persistedHeadCount,
    persistedLabelCounts,
    persistedRevisionCounts,
    correctionHeadRevisions: OVERLAY_NOTE_CORRECTIONS.map(
      (correction) => rowsByPmid.get(correction.pmid)?.persistedHeadRevision ?? -1,
    ),
  }
}
