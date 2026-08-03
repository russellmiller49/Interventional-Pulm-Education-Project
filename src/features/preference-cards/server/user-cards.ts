import { z } from 'zod'

import { supabaseServer } from '@/lib/supabase/server'

import { verifySnapshotIntegrity } from '../domain/card-hashes'
import { resolveCard } from '../domain/resolve-card'
import type { ResolvedCard } from '../domain/types'
import {
  builderInputsSchema,
  carriesUnreconcilableFamilyIdentity,
  isSupersededBuilderInputsVersion,
  type BuilderInputs,
  type SaveCardRequest,
} from '../schemas/saved-card'
import {
  rebuildBuilderContext,
  type RehydratedBuilderContext,
  type RehydratedBuilderErrorCode,
} from './rebuild-builder-context'

/**
 * Per-user preference cards.
 *
 * Ownership is enforced by row-level security, not by these queries — every statement runs
 * as the signed-in user, so a card that is not theirs simply is not there. The one exception
 * is the share path, which goes through a security-definer RPC that returns only what the
 * owner switched on.
 */

const TABLE = 'ip_user_preference_cards'

export interface UserCardSummary {
  id: string
  title: string
  physicianName: string | null
  procedureCode: string
  scenarioId: string
  status: 'draft' | 'final'
  readinessState: ResolvedCard['readinessState']
  shareEnabled: boolean
  shareToken: string
  updatedAt: string
  createdAt: string
  /**
   * Whether this card can be reopened in the builder — the stored inputs parse *and* are at a
   * version still entitled to back an edit session.
   *
   * Two kinds of card are `false`, neither of them broken: one created before module selection
   * existed, and one written at a superseded version whose whole-set dependencies were never
   * pinned. Both stay fully viewable, printable, shareable, and duplicable; the edit control is
   * simply not offered rather than offered and then failing.
   */
  editable: boolean
}

export interface UserCardRecord extends UserCardSummary {
  card: ResolvedCard
  /**
   * Null when the stored inputs no longer satisfy the schema — after a breaking change to
   * what the wizard records, say. The card still views and prints from its snapshot; only
   * reopening it in the builder is unavailable, which is better than reopening it wrong.
   */
  builderInputs: BuilderInputs | null
}

export interface UserCardResult<T> {
  ok: boolean
  data?: T
  error?: string
}

/**
 * The stored snapshot, re-validated on the way out. `passthrough` keeps fields the schema
 * does not enumerate; the hash check below is what actually guarantees the payload is the
 * one that was written.
 */
const persistedSnapshotSchema = z
  .object({
    recipeVersionId: z.string().min(1),
    recipeName: z.string().min(1),
    recipeVersion: z.string().min(1),
    sourceProcedureCode: z.string().min(1),
    selectedModifiers: z.array(z.string()),
    /**
     * Absent on snapshots written before composition. Those cards stay viewable and
     * printable from what they recorded; only the builder needs the manifest.
     */
    includedModules: z.array(z.unknown()).optional(),
    items: z.array(z.unknown()),
    suppressedItems: z.array(z.unknown()),
    warnings: z.array(z.unknown()),
    readinessState: z.enum(['blocked', 'complete_with_warnings', 'complete']),
    governanceState: z.enum(['draft', 'in_review', 'approved', 'retired']),
    ruleTrace: z.array(z.unknown()),
    engineVersion: z.string().min(1),
    catalogImportId: z.string().min(1),
    snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
    /**
     * Absent on snapshots written before the hashes were split. Those rows stay viewable and
     * printable and keep verifying against the storage identity they were written with; nothing is
     * rewritten on read. Present, they are checked — see `parseSnapshot`.
     */
    snapshotIntegrityHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    resolvedContentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    generatedAt: z.string().datetime(),
  })
  .passthrough()

interface CardRow {
  id: string
  title: string
  physician_name: string | null
  procedure_code: string
  scenario_id: string
  status: 'draft' | 'final'
  builder_inputs: unknown
  card_snapshot: unknown
  snapshot_hash: string
  share_enabled: boolean
  share_token: string
  created_at: string
  updated_at: string
}

// `builder_inputs` is read for the summary too, because whether a card can be reopened is
// something the dashboard has to know before it offers the control.
const SUMMARY_COLUMNS =
  'id, title, physician_name, procedure_code, scenario_id, status, snapshot_hash, share_enabled, share_token, created_at, updated_at, card_snapshot, builder_inputs'

function toSummary(
  row: CardRow,
  readinessState: ResolvedCard['readinessState'],
  editable: boolean,
): UserCardSummary {
  return {
    id: row.id,
    title: row.title,
    physicianName: row.physician_name,
    procedureCode: row.procedure_code,
    scenarioId: row.scenario_id,
    status: row.status,
    readinessState,
    shareEnabled: row.share_enabled,
    shareToken: row.share_token,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    editable,
  }
}

/**
 * Whether stored inputs may back an edit session.
 *
 * One helper, used by both the dashboard listing and the card loader, so the control the
 * dashboard offers and the answer the edit route gives cannot disagree — a card whose Edit
 * button appears and then explains why it cannot be edited is worse than no button.
 */
function inputsCanBackAnEdit(builderInputs: unknown): boolean {
  const parsed = builderInputsSchema.safeParse(builderInputs)
  if (!parsed.success) return false
  if (isSupersededBuilderInputsVersion(parsed.data.schemaVersion)) return false
  // A card that recorded a product line by a discovery grouping key cannot be re-resolved without
  // guessing which products that key stands for now. It stays viewable, printable, shareable, and
  // duplicable; the edit control is simply not offered rather than offered and then failing.
  return !carriesUnreconcilableFamilyIdentity(parsed.data)
}

/**
 * A stored snapshot is only usable if it still verifies.
 *
 * Two checks, because rows exist in two shapes and neither may be rewritten on read. Every row
 * carries the storage identity hash the `snapshot_hash` column holds, and that is compared as it
 * always was. Rows written from the split onward *also* carry an integrity hash over the complete
 * snapshot — including `generatedAt` and the warning acknowledgements, the fields the storage hash
 * deliberately excludes — and where one is present it is recomputed and must match. Its absence on
 * an older row is not a failure: an unverifiable-by-that-means row is not a tampered row, and
 * treating it as one would make every pre-existing card unopenable.
 */
function parseSnapshot(snapshot: unknown, expectedHash: string): ResolvedCard | null {
  const parsed = persistedSnapshotSchema.safeParse(snapshot)
  if (!parsed.success || parsed.data.snapshotHash !== expectedHash) return null
  if (verifySnapshotIntegrity(snapshot) === false) return null
  return parsed.data as unknown as ResolvedCard
}

/**
 * Re-resolve a card from its builder inputs, rebuilding every product from the catalog.
 *
 * The client's own resolution is never trusted: this is what gets stored. `generatedAt` is
 * stamped here rather than accepted from the caller — it is metadata about the save, and the
 * snapshot hash deliberately excludes it so re-saving an unchanged card keeps the same hash.
 */
export function resolveForSave(
  inputs: BuilderInputs,
  generatedAt: string,
):
  | { ok: true; card: ResolvedCard; rebuilt: RehydratedBuilderContext }
  | { ok: false; error: string; code: RehydratedBuilderErrorCode } {
  const rebuilt = rebuildBuilderContext(inputs, generatedAt)
  if (!rebuilt.ok) return { ok: false, error: rebuilt.message, code: rebuilt.code }

  const card = resolveCard(
    {
      ...inputs.input,
      variables: { ...inputs.input.variables, generated_at: generatedAt },
    },
    rebuilt.resolveContext,
  )
  return { ok: true, card, rebuilt }
}

export async function saveUserCard(request: SaveCardRequest): Promise<UserCardResult<string>> {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to save a preference card.' }

  const generatedAt = new Date().toISOString()
  const resolved = resolveForSave(request, generatedAt)
  if (!resolved.ok) return { ok: false, error: resolved.error }
  const { card, rebuilt } = resolved

  const payload = {
    title: request.title,
    physician_name: request.physicianName?.trim() ? request.physicianName.trim() : null,
    // From the pinned scenario the card actually rebuilt against, not a second lookup.
    procedure_code: rebuilt.scenario.sourceProcedureCode,
    scenario_id: request.scenarioId,
    status: request.status,
    builder_inputs: {
      // The version the request came in at, not the current one. Re-saving a version-2 card
      // must not stamp today's release onto it: that would move a saved card to a release its
      // author never chose, and would do it silently, with nothing on the card to say the pin
      // was the system's decision rather than the physician's.
      schemaVersion: request.schemaVersion,
      ...(request.releaseBundleId ? { releaseBundleId: request.releaseBundleId } : {}),
      scenarioId: request.scenarioId,
      input: request.input,
      catalogPicks: request.catalogPicks,
      familyPicks: request.familyPicks,
      customItems: request.customItems,
      equipmentSets: request.equipmentSets,
    },
    card_snapshot: card,
    snapshot_hash: card.snapshotHash,
    engine_version: card.engineVersion,
    catalog_import_id: card.catalogImportId,
  }

  if (request.cardId) {
    // Editing a card changes what the card *says*, not who it belongs to or who can see
    // it. `user_id`, `share_token`, `share_enabled`, and `created_at` are deliberately
    // absent from the patch: a share link handed to a colleague must keep working across
    // an edit, and must not start working because of one. RLS scopes the update to the
    // caller's own rows, so a foreign id matches nothing.
    const { data, error } = await supabase
      .from(TABLE)
      .update(payload)
      .eq('id', request.cardId)
      .select('id')
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: 'That preference card no longer exists.' }
    return { ok: true, data: data.id }
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...payload, user_id: user.id })
    .select('id')
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'The database did not return a card identifier.' }
  return { ok: true, data: data.id }
}

export async function listUserCards(limit = 25): Promise<UserCardSummary[]> {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from(TABLE)
    .select(SUMMARY_COLUMNS)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []

  return (data as unknown as CardRow[]).map((row) => {
    const card = parseSnapshot(row.card_snapshot, row.snapshot_hash)
    // A row whose snapshot no longer verifies still lists, so it can be opened or deleted;
    // the readiness badge just cannot claim anything about it.
    // Editable needs both halves: reopening also loads the card, and a snapshot that no
    // longer verifies makes `loadUserCard` return null. Offering Edit on the strength of the
    // inputs alone would put a link on the dashboard that 404s.
    return toSummary(
      row,
      card?.readinessState ?? 'blocked',
      card !== null && inputsCanBackAnEdit(row.builder_inputs),
    )
  })
}

export async function loadUserCard(cardId: string): Promise<UserCardRecord | null> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from(TABLE)
    .select(SUMMARY_COLUMNS)
    .eq('id', cardId)
    .maybeSingle()
  if (error || !data) return null

  const row = data as unknown as CardRow
  const card = parseSnapshot(row.card_snapshot, row.snapshot_hash)
  if (!card) return null
  const inputs = builderInputsSchema.safeParse(row.builder_inputs)

  return {
    // `editable` is the narrower question: a version-2 card's inputs parse and are still
    // returned below — they are what the view needs to explain itself — but they may not
    // back an edit.
    ...toSummary(row, card.readinessState, inputsCanBackAnEdit(row.builder_inputs)),
    card,
    builderInputs: inputs.success ? inputs.data : null,
  }
}

/**
 * Why a saved card cannot be reopened in the builder.
 *
 * `not_found` covers "no such card" and "not yours" with one answer on purpose — RLS makes
 * a foreign card invisible, and distinguishing the two would confirm that a card id exists.
 * `legacy_builder_inputs` is not a fault: those cards predate module selection and are
 * complete as snapshots, they simply record nothing a builder could reopen.
 */
export type EditableCardErrorCode =
  | 'not_found'
  | 'legacy_builder_inputs'
  | 'superseded_builder_inputs'
  | RehydratedBuilderErrorCode

export interface EditableUserCard {
  ok: true
  record: UserCardRecord
  builderInputs: BuilderInputs
  rebuilt: RehydratedBuilderContext
}

export type EditableUserCardResult =
  | EditableUserCard
  | { ok: false; code: EditableCardErrorCode; message?: string }

/**
 * A saved card, reconstructed far enough to reopen it in the builder.
 *
 * Everything the builder needs comes from `builder_inputs` re-checked against authoritative
 * data — never from `card_snapshot`. The snapshot is an immutable record of what was
 * printed; treating it as editable state would let a stored blob decide what the catalog
 * says, and would quietly re-derive selections the physician never made.
 */
export async function loadEditableUserCard(cardId: string): Promise<EditableUserCardResult> {
  const record = await loadUserCard(cardId)
  if (!record) return { ok: false, code: 'not_found' }
  if (!record.builderInputs) return { ok: false, code: 'legacy_builder_inputs' }
  // Parseable but not editable. A version-2 card pins its recipe and modules exactly and
  // nothing underneath them, so re-resolving it would quietly substitute the current modifier
  // set, rescue modules, compatibility rules, and role table for the ones it was built
  // against. Refusing to open the builder is the only answer that neither loses the card nor
  // rewrites it into something its author never approved.
  if (isSupersededBuilderInputsVersion(record.builderInputs.schemaVersion)) {
    return { ok: false, code: 'superseded_builder_inputs' }
  }
  // Reopening a card whose product line is named by a discovery key would mean deciding which
  // products that key stands for today. `rebuildBuilderContext` refuses it too; the check is
  // repeated here so the dashboard's `editable` flag and this route give the same answer.
  if (carriesUnreconcilableFamilyIdentity(record.builderInputs)) {
    return { ok: false, code: 'legacy_family_identity' }
  }

  // The same reconstruction the save path runs, so what opens is what would be stored.
  // The timestamp only stamps rebuilt equipment sets and is outside the hashed payload.
  const rebuilt = rebuildBuilderContext(record.builderInputs, record.updatedAt)
  if (!rebuilt.ok) return { ok: false, code: rebuilt.code, message: rebuilt.message }

  return { ok: true, record, builderInputs: record.builderInputs, rebuilt }
}

/** The read-only view a colleague gets from a share link. Requires a signed-in account. */
export async function loadSharedCard(token: string): Promise<{
  title: string
  physicianName: string | null
  updatedAt: string
  card: ResolvedCard
} | null> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc('ip_get_shared_preference_card', { token })
  if (error || !Array.isArray(data) || data.length === 0) return null

  const row = data[0] as {
    title: string
    physician_name: string | null
    card_snapshot: unknown
    snapshot_hash: string
    updated_at: string
  }
  const card = parseSnapshot(row.card_snapshot, row.snapshot_hash)
  if (!card) return null
  return {
    title: row.title,
    physicianName: row.physician_name,
    updatedAt: row.updated_at,
    card,
  }
}

export async function renameUserCard(
  cardId: string,
  title: string,
  physicianName?: string | null,
): Promise<UserCardResult<null>> {
  const supabase = await supabaseServer()
  // A rename must not re-resolve the card: the snapshot is what was printed, and touching
  // it would churn the hash for a change that is only a label.
  const patch: Record<string, string | null> = { title }
  if (physicianName !== undefined) {
    patch.physician_name = physicianName?.trim() ? physicianName.trim() : null
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', cardId)
    .select('id')
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'That preference card no longer exists.' }
  return { ok: true, data: null }
}

export async function deleteUserCard(cardId: string): Promise<UserCardResult<null>> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from(TABLE).delete().eq('id', cardId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: null }
}

export async function duplicateUserCard(
  cardId: string,
  title: string,
): Promise<UserCardResult<string>> {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to duplicate a preference card.' }

  const { data, error } = await supabase
    .from(TABLE)
    .select(
      'title, physician_name, procedure_code, scenario_id, status, builder_inputs, card_snapshot, snapshot_hash, engine_version, catalog_import_id',
    )
    .eq('id', cardId)
    .maybeSingle()
  if (error || !data) return { ok: false, error: 'That preference card no longer exists.' }

  // A copy starts fresh: its own share token (the default) and sharing switched off, so
  // duplicating never hands out access the original had.
  const { data: inserted, error: insertError } = await supabase
    .from(TABLE)
    .insert({ ...data, user_id: user.id, title, share_enabled: false })
    .select('id')
    .maybeSingle()
  if (insertError) return { ok: false, error: insertError.message }
  if (!inserted) return { ok: false, error: 'The database did not return a card identifier.' }
  return { ok: true, data: inserted.id }
}

export async function setShareEnabled(
  cardId: string,
  enabled: boolean,
): Promise<UserCardResult<string>> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from(TABLE)
    .update({ share_enabled: enabled })
    .eq('id', cardId)
    .select('share_token')
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'That preference card no longer exists.' }
  return { ok: true, data: data.share_token as string }
}
