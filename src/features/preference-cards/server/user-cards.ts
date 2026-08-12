import { supabaseServer } from '@/lib/supabase/server'

import { getCurrentReleaseBundleForScenario } from '../data/release-bundles.server'
import { resolveCard } from '../domain/resolve-card'
import type { ResolvedCard } from '../domain/types'
import {
  storedRebuildProvenanceSchema,
  type StoredRebuildProvenance,
} from '../schemas/card-rebuild'
import { parsePersistedSnapshot } from '../schemas/persisted-snapshot'
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
  /**
   * How this card came to exist — three states, never two.
   *
   * A failed parse used to collapse to `null`, which is the *same* value an ordinary card carries.
   * A row whose database column holds a non-null provenance object would then have been presented
   * as a card that was never rebuilt: the strongest claim in the schema, silently downgraded to no
   * claim at all by a validation failure. Evidence that cannot be read is not the absence of
   * evidence, and the two must not share a representation.
   */
  rebuildProvenance: CardRebuildProvenanceState
}

/**
 * `none` — the column is null and this card was not rebuilt.
 * `valid` — a complete version-1 document.
 * `invalid` — the column is non-null and does not satisfy the version-1 schema. The card is shown
 *   with an integrity notice rather than as an ordinary card, and never with a decoded claim.
 */
export type CardRebuildProvenanceState =
  | { state: 'none' }
  | { state: 'valid'; provenance: StoredRebuildProvenance }
  | { state: 'invalid'; issues: string[] }

/**
 * Why a write against an existing card did not happen.
 *
 * `stale_edit` and `not_found` are deliberately different answers to what is, at the database, the
 * same event: a conditional update that matched no row. Distinguishing them is worth a second
 * query because the remedies are opposite — reload and reapply your change, versus the card is
 * gone. Getting there without disclosing anything is the constraint: the follow-up existence check
 * is owner-scoped through the same RLS the update ran under, so a card belonging to somebody else
 * is indistinguishable from one that never existed, exactly as it is everywhere else here.
 */
export type UserCardWriteErrorCode = 'stale_edit' | 'not_found'

export interface UserCardResult<T> {
  ok: boolean
  data?: T
  error?: string
  code?: UserCardWriteErrorCode
}

const STALE_EDIT_MESSAGE =
  'This card was saved from somewhere else after you opened it. Reload to see the current version, then reapply your change — nothing you are looking at has been overwritten.'

const CARD_GONE_MESSAGE = 'That preference card no longer exists.'

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
  rebuild_provenance: unknown
  created_at: string
  updated_at: string
}

// `builder_inputs` is read for the summary too, because whether a card can be reopened is
// something the dashboard has to know before it offers the control.
const SUMMARY_COLUMNS =
  'id, title, physician_name, procedure_code, scenario_id, status, snapshot_hash, share_enabled, share_token, created_at, updated_at, card_snapshot, builder_inputs'

/** The card page needs one column the dashboard listing does not: how the card came to exist. */
const RECORD_COLUMNS = `${SUMMARY_COLUMNS}, rebuild_provenance`

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

/**
 * Apply a patch to a card only if it is still at the content version the caller edited from.
 *
 * One statement does the deciding. The predicate is `id = ? and updated_at = ?`, both inside the
 * same `update`, so there is no interval between checking and writing for a concurrent save to
 * land in. `updated_at` moves only when revision-bearing content changes — the card table's own
 * content-timestamp trigger sees to that — so this token tracks what the card *says* rather than
 * when its row was last touched, and an unrelated share toggle does not invalidate an open editor.
 *
 * A miss then needs a name. The update alone cannot tell "somebody saved first" from "the card is
 * gone" from "it was never yours", because all three match zero rows. The follow-up select runs
 * under the same row-level security, so it separates the first from the other two and cannot
 * separate the other two from each other — which is the point. A foreign card id and an unknown
 * card id give the identical answer, here as everywhere else in this module.
 */
async function updateCardAtContentVersion(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  cardId: string,
  expectedUpdatedAt: string,
  patch: Record<string, unknown>,
): Promise<UserCardResult<string>> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', cardId)
    .eq('updated_at', expectedUpdatedAt)
    .select('id')
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (data) return { ok: true, data: data.id as string }

  const { data: existing } = await supabase.from(TABLE).select('id').eq('id', cardId).maybeSingle()
  if (existing) return { ok: false, code: 'stale_edit', error: STALE_EDIT_MESSAGE }
  return { ok: false, code: 'not_found', error: CARD_GONE_MESSAGE }
}

export async function saveUserCard(request: SaveCardRequest): Promise<UserCardResult<string>> {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to save a preference card.' }

  // A NEW card originates only on the release the pointer currently names. The id arrives
  // from the client, and `buildReleaseContext` deliberately resolves retired and superseded
  // releases — a card already pinned to one must keep reopening — so currency is this path's
  // check, not the resolver's. Before definition-set retention the gap was latent: a
  // superseded release only resolved while its set pins still equaled the live sets. Now a
  // superseded release resolves its retained sets by design, which would let a crafted
  // create request originate a card on clinical semantics a published correction replaced.
  if (!request.cardId) {
    const currentRelease = getCurrentReleaseBundleForScenario(request.scenarioId)
    if (!currentRelease || currentRelease.id !== request.releaseBundleId) {
      return {
        ok: false,
        error: currentRelease
          ? `A new card is built on the current release for its procedure (${currentRelease.id}), not on ${request.releaseBundleId ?? 'an unpinned request'}. Reload the builder and try again.`
          : `No current release is published for "${request.scenarioId}", so a new card cannot be created for it.`,
      }
    }
  }

  // An EDIT keeps the card's own pin — as a server-checked fact, not a client convention.
  // The wizard always echoes the stored pin back, so a differing pin is a crafted request:
  // without this check, create-then-edit would originate a card on the current release and
  // immediately re-pin it to any retained one, reaching exactly the superseded semantics the
  // create guard refuses (and a sideways re-pin between historical releases is no better).
  // Changing a card's release is the rebuild flow's job, which writes a NEW card through a
  // governed plan. Absent-vs-absent is equality here: a schema-v2 card has no pin and an
  // edit must not introduce one ("re-saving a version-2 card must not stamp today's release
  // onto it", below). A missing row falls through — the atomic update reports not_found.
  if (request.cardId) {
    const { data: storedRow, error: storedError } = await supabase
      .from(TABLE)
      .select('builder_inputs')
      .eq('id', request.cardId)
      .maybeSingle()
    if (storedError) return { ok: false, error: storedError.message }
    if (storedRow) {
      const storedPin =
        (storedRow.builder_inputs as { releaseBundleId?: string } | null)?.releaseBundleId ?? null
      const requestedPin = request.releaseBundleId ?? null
      if (storedPin !== requestedPin) {
        return {
          ok: false,
          error: `This card is pinned to ${storedPin ?? 'no release'} and an edit cannot move it to ${requestedPin ?? 'no release'}. To move a card onto another release, use the rebuild flow.`,
        }
      }
    }
  }

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
    //
    // `expectedUpdatedAt` is in the same `where` clause as the id, and that is the whole
    // mechanism: the database decides, in one statement, whether this save is being applied to
    // the state it was built from. Reading the row and comparing before updating would leave a
    // window between the two in which the answer stops being true.
    return await updateCardAtContentVersion(
      supabase,
      request.cardId,
      // Non-null by schema: `saveCardRequestSchema` requires the token whenever `cardId` is
      // present, so an unguarded overwrite cannot be constructed.
      request.expectedUpdatedAt as string,
      payload,
    )
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
    const card = parsePersistedSnapshot(row.card_snapshot, row.snapshot_hash)
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
    .select(RECORD_COLUMNS)
    .eq('id', cardId)
    .maybeSingle()
  if (error || !data) return null

  const row = data as unknown as CardRow
  const card = parsePersistedSnapshot(row.card_snapshot, row.snapshot_hash)
  if (!card) return null
  const inputs = builderInputsSchema.safeParse(row.builder_inputs)
  // Validated rather than cast. The column is authentic — unwritable by any API role and write-once
  // — which is not the same as well-typed.
  const provenance = readRebuildProvenance(row.rebuild_provenance)

  return {
    // `editable` is the narrower question: a version-2 card's inputs parse and are still
    // returned below — they are what the view needs to explain itself — but they may not
    // back an edit.
    ...toSummary(row, card.readinessState, inputsCanBackAnEdit(row.builder_inputs)),
    card,
    builderInputs: inputs.success ? inputs.data : null,
    rebuildProvenance: provenance,
  }
}

function readRebuildProvenance(value: unknown): CardRebuildProvenanceState {
  if (value == null) return { state: 'none' }
  const parsed = storedRebuildProvenanceSchema.safeParse(value)
  if (parsed.success) return { state: 'valid', provenance: parsed.data }
  return {
    state: 'invalid',
    issues: parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.code}`)
      .sort()
      .slice(0, 20),
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
  const card = parsePersistedSnapshot(row.card_snapshot, row.snapshot_hash)
  if (!card) return null
  return {
    title: row.title,
    physicianName: row.physician_name,
    updatedAt: row.updated_at,
    card,
  }
}

/**
 * Rename a card, at a stated content version.
 *
 * A rename is revision-bearing — the title and the physician are printed and are covered by
 * `printDocumentHash` — so it takes exactly the same concurrency protection a save does. Two
 * writers renaming from the same starting state is the ordinary case for a shared clinical card,
 * and letting the second win by default would silently discard the first.
 */
export async function renameUserCard(
  cardId: string,
  title: string,
  expectedUpdatedAt: string,
  physicianName?: string | null,
): Promise<UserCardResult<null>> {
  const supabase = await supabaseServer()
  // A rename must not re-resolve the card: the snapshot is what was printed, and touching
  // it would churn the hash for a change that is only a label.
  const patch: Record<string, string | null> = { title }
  if (physicianName !== undefined) {
    patch.physician_name = physicianName?.trim() ? physicianName.trim() : null
  }
  const result = await updateCardAtContentVersion(supabase, cardId, expectedUpdatedAt, patch)
  if (!result.ok) return { ok: false, error: result.error, code: result.code }
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
  if (error || !data) return { ok: false, error: CARD_GONE_MESSAGE }

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
  if (!data) return { ok: false, error: CARD_GONE_MESSAGE }
  return { ok: true, data: data.share_token as string }
}
