import { supabaseServer } from '@/lib/supabase/server'

import { printDocumentHash } from '../domain/print-document'
import type { ResolvedCard } from '../domain/types'
import { parsePersistedSnapshot } from '../schemas/persisted-snapshot'
import { builderInputsSchema, type BuilderInputs } from '../schemas/saved-card'

/**
 * Reading a saved card's immutable revisions.
 *
 * There is no writer here, and that is the design. Revisions are appended by a database trigger
 * on the cards table, so every path that writes a card — saving a new one, saving an edit,
 * renaming, duplicating — produces one atomically and without knowing this module exists. A
 * writer in application code would be a second place the history could be forgotten, and a
 * window in which a card had been saved and its revision had not.
 *
 * Ownership is row-level security, as everywhere else in this feature: a revision belonging to
 * someone else simply is not there.
 */

const TABLE = 'ip_user_preference_card_revisions'

/**
 * One revision, without the payload.
 *
 * Enough to list the history and see what moved between two states — the three hashes answer
 * three different questions and a list that shows them is a list a reviewer can read — without
 * loading a stored snapshot per row.
 */
export interface PreferenceCardRevisionSummary {
  id: string
  cardId: string
  revisionNumber: number

  title: string
  physicianName: string | null
  status: 'draft' | 'final'
  /**
   * The card's full identity at this revision, not just its editable metadata.
   *
   * Edit mode cannot change the procedure today — the picker is a read-only panel — so on every
   * revision written so far these match the card. They are recorded anyway because the revision
   * is meant to be the complete row state: a reader reconstructing what a revision *was* should
   * not have to assume a rule that held when it was written still holds now.
   */
  procedureCode: string
  scenarioId: string

  snapshotHash: string
  /**
   * Null on a revision of a snapshot written before the hashes were split. Not `false` and not a
   * fabricated value: those rows were never hashed this way, and a placeholder would be a claim.
   */
  snapshotIntegrityHash: string | null
  resolvedContentHash: string | null
  /**
   * Derived here rather than stored, from the integrity hash and the four printed fields beside
   * it. Storing it would create a value that could disagree with its own inputs; deriving it
   * means the revision list and the card header run the same function over the same facts.
   *
   * Null exactly when `snapshotIntegrityHash` is — there is nothing to build a document hash
   * over, and building one from the storage identity instead would give a different meaning
   * under the same label.
   */
  printDocumentHash: string | null

  engineVersion: string
  releaseBundleId: string | null
  catalogReleaseId: string | null

  createdAt: string
  createdBy: string
}

export interface PreferenceCardRevision extends PreferenceCardRevisionSummary {
  /** The stored snapshot, re-verified on the way out exactly as the card loader verifies one. */
  cardSnapshot: ResolvedCard
  /**
   * Null when the stored inputs no longer satisfy the schema. The revision is still a complete
   * record of what the card said; only re-deriving a builder session from it is unavailable.
   */
  builderInputs: BuilderInputs | null
}

interface RevisionRow {
  id: string
  card_id: string
  revision_number: number
  title: string
  physician_name: string | null
  status: 'draft' | 'final'
  procedure_code: string
  scenario_id: string
  builder_inputs: unknown
  card_snapshot: unknown
  snapshot_hash: string
  snapshot_integrity_hash: string | null
  resolved_content_hash: string | null
  engine_version: string
  release_bundle_id: string | null
  catalog_release_id: string | null
  created_at: string
  created_by: string
}

const SUMMARY_COLUMNS =
  'id, card_id, revision_number, title, physician_name, status, procedure_code, scenario_id, snapshot_hash, snapshot_integrity_hash, resolved_content_hash, engine_version, release_bundle_id, catalog_release_id, created_at, created_by'

const FULL_COLUMNS = `${SUMMARY_COLUMNS}, builder_inputs, card_snapshot`

function toSummary(row: RevisionRow): PreferenceCardRevisionSummary {
  return {
    id: row.id,
    cardId: row.card_id,
    revisionNumber: row.revision_number,
    title: row.title,
    physicianName: row.physician_name,
    status: row.status,
    procedureCode: row.procedure_code,
    scenarioId: row.scenario_id,
    snapshotHash: row.snapshot_hash,
    snapshotIntegrityHash: row.snapshot_integrity_hash,
    resolvedContentHash: row.resolved_content_hash,
    printDocumentHash: row.snapshot_integrity_hash
      ? printDocumentHash({
          snapshotIntegrityHash: row.snapshot_integrity_hash,
          metadata: {
            cardId: row.card_id,
            title: row.title,
            physicianName: row.physician_name,
            status: row.status,
            // The revision's own timestamp *is* the "updated" value the page printed while the
            // card was in this state — one fact, stored once, so the two cannot drift.
            updatedAt: row.created_at,
          },
        })
      : null,
    engineVersion: row.engine_version,
    releaseBundleId: row.release_bundle_id,
    catalogReleaseId: row.catalog_release_id,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }
}

/**
 * Every retained state of one card, newest first.
 *
 * Ordered by `revision_number` rather than by `created_at`: the number is the authority on
 * sequence — assigned in one place, unique per card — and two revisions written inside the same
 * transaction clock tick would order arbitrarily by timestamp.
 */
export async function listCardRevisions(
  cardId: string,
  limit = 50,
): Promise<PreferenceCardRevisionSummary[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from(TABLE)
    .select(SUMMARY_COLUMNS)
    .eq('card_id', cardId)
    .order('revision_number', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return (data as unknown as RevisionRow[]).map(toSummary)
}

export type CardRevisionErrorCode = 'not_found' | 'snapshot_unverifiable'

export type CardRevisionResult =
  | { ok: true; revision: PreferenceCardRevision }
  | { ok: false; code: CardRevisionErrorCode }

/**
 * One revision, addressed by its own id and by the card it belongs to.
 *
 * Both, because a revision id alone would let one card's history be read through another card's
 * route if the ids were ever guessable — row-level security already prevents reading someone
 * else's, and this prevents the owner's own two cards being confused for each other.
 *
 * `snapshot_unverifiable` is what a stored snapshot that no longer hashes to what it was written
 * with gets. It is reported rather than rendered: an append-only row that fails its own integrity
 * check is the one case where showing the content anyway would be showing something nobody wrote.
 */
export async function loadCardRevision(
  cardId: string,
  revisionId: string,
): Promise<CardRevisionResult> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from(TABLE)
    .select(FULL_COLUMNS)
    .eq('id', revisionId)
    .maybeSingle()
  if (error || !data) return { ok: false, code: 'not_found' }

  const row = data as unknown as RevisionRow
  if (row.card_id !== cardId) return { ok: false, code: 'not_found' }

  const cardSnapshot = parsePersistedSnapshot(row.card_snapshot, row.snapshot_hash)
  if (!cardSnapshot) return { ok: false, code: 'snapshot_unverifiable' }

  const inputs = builderInputsSchema.safeParse(row.builder_inputs)
  return {
    ok: true,
    revision: {
      ...toSummary(row),
      cardSnapshot,
      builderInputs: inputs.success ? inputs.data : null,
    },
  }
}

/**
 * The revision recording the card's current state.
 *
 * Used to give reconciliation an addressable source: a review is of a particular state, and the
 * only durable way to say which one is the revision id. A card always has at least one — the
 * trigger appends on insert — so a null here means the card is gone or is not the caller's.
 */
export async function loadCurrentCardRevision(
  cardId: string,
): Promise<PreferenceCardRevisionSummary | null> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from(TABLE)
    .select(SUMMARY_COLUMNS)
    .eq('card_id', cardId)
    .order('revision_number', { ascending: false })
    .limit(1)
  if (error || !data) return null
  const rows = data as unknown as RevisionRow[]
  return rows.length > 0 ? toSummary(rows[0]) : null
}
