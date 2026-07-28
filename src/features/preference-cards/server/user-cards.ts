import { z } from 'zod'

import { supabaseServer } from '@/lib/supabase/server'

import { buildDemoContext, getScenarioDefinition } from '../data/demo-context.server'
import { resolveCard } from '../domain/resolve-card'
import { withCatalogPicks, type CatalogPick } from '../domain/catalog-pick'
import { withFamilyPicks, type FamilyPick } from '../domain/family-pick'
import { withCustomItems } from '../domain/custom-item'
import { withEquipmentSets, type EquipmentSet } from '../domain/equipment-set'
import type { ResolvedCard } from '../domain/types'
import {
  builderInputsSchema,
  type BuilderInputs,
  type SaveCardRequest,
} from '../schemas/saved-card'
import { getFamilyPick, resolveCatalogPick, type CatalogPickLookupResult } from './catalog'

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
    items: z.array(z.unknown()),
    suppressedItems: z.array(z.unknown()),
    warnings: z.array(z.unknown()),
    readinessState: z.enum(['blocked', 'complete_with_warnings', 'complete']),
    governanceState: z.enum(['draft', 'in_review', 'approved', 'retired']),
    ruleTrace: z.array(z.unknown()),
    engineVersion: z.string().min(1),
    catalogImportId: z.string().min(1),
    snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
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

const SUMMARY_COLUMNS =
  'id, title, physician_name, procedure_code, scenario_id, status, snapshot_hash, share_enabled, share_token, created_at, updated_at, card_snapshot'

function toSummary(row: CardRow, readinessState: ResolvedCard['readinessState']): UserCardSummary {
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
  }
}

/** A stored snapshot is only usable if it still hashes to what was written. */
function parseSnapshot(snapshot: unknown, expectedHash: string): ResolvedCard | null {
  const parsed = persistedSnapshotSchema.safeParse(snapshot)
  if (!parsed.success || parsed.data.snapshotHash !== expectedHash) return null
  return parsed.data as unknown as ResolvedCard
}

function catalogPickLookupError(
  result: Exclude<CatalogPickLookupResult, { ok: true }>,
  location?: string,
): string {
  const suffix = location ? ` ${location}` : ''
  switch (result.code) {
    case 'unknown_product':
      return `Unknown catalog product ${result.productId}${suffix}.`
    case 'unknown_role':
      return `Unknown catalog role ${result.roleCode}${suffix}.`
    case 'product_role_mismatch':
      return `Catalog product ${result.productId} is not mapped to role ${result.roleCode}${suffix}.`
  }
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
): { ok: true; card: ResolvedCard } | { ok: false; error: string } {
  const scenario = getScenarioDefinition(inputs.scenarioId)
  if (!scenario || scenario.recipeVersionId !== inputs.input.recipeVersionId) {
    return { ok: false, error: 'The scenario and recipe do not match.' }
  }

  const picks: CatalogPick[] = []
  for (const requested of inputs.catalogPicks) {
    const result = resolveCatalogPick(requested.productId, requested.roleCode)
    if (!result.ok) return { ok: false, error: catalogPickLookupError(result) }
    picks.push(result.pick)
  }

  const familyPicks: FamilyPick[] = []
  for (const requested of inputs.familyPicks) {
    const pick = getFamilyPick(requested.familyKey, requested.roleCode)
    if (!pick) return { ok: false, error: `Unknown product line ${requested.familyKey}.` }
    familyPicks.push(pick)
  }

  const sets: EquipmentSet[] = []
  const selectedRoleBySetId: Record<string, string> = {}
  for (const requested of inputs.equipmentSets) {
    const members: CatalogPick[] = []
    for (const member of requested.members) {
      const result = resolveCatalogPick(member.productId, member.roleCode)
      if (!result.ok) {
        return {
          ok: false,
          error: catalogPickLookupError(result, `in set "${requested.name}"`),
        }
      }
      members.push(result.pick)
    }
    sets.push({
      id: requested.id,
      name: requested.name,
      description: requested.description ?? null,
      members,
      additionalCoveredRoles: requested.additionalCoveredRoles,
      createdAt: generatedAt,
      updatedAt: generatedAt,
    })
    selectedRoleBySetId[requested.id] = requested.selectedRoleCode
  }

  const context = withEquipmentSets(
    withCustomItems(
      withFamilyPicks(withCatalogPicks(buildDemoContext(scenario.id), picks), familyPicks),
      inputs.customItems,
    ),
    sets,
    selectedRoleBySetId,
  )
  const card = resolveCard(
    {
      ...inputs.input,
      variables: { ...inputs.input.variables, generated_at: generatedAt },
    },
    context,
  )
  return { ok: true, card }
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
  const { card } = resolved

  const scenario = getScenarioDefinition(request.scenarioId)!
  const payload = {
    user_id: user.id,
    title: request.title,
    physician_name: request.physicianName?.trim() ? request.physicianName.trim() : null,
    procedure_code: scenario.sourceProcedureCode,
    scenario_id: request.scenarioId,
    status: request.status,
    builder_inputs: {
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
    // RLS scopes the update to the caller's own rows, so a foreign id matches nothing.
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

  const { data, error } = await supabase.from(TABLE).insert(payload).select('id').maybeSingle()
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
    return toSummary(row, card?.readinessState ?? 'blocked')
  })
}

export async function loadUserCard(cardId: string): Promise<UserCardRecord | null> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from(TABLE)
    .select(`${SUMMARY_COLUMNS}, builder_inputs`)
    .eq('id', cardId)
    .maybeSingle()
  if (error || !data) return null

  const row = data as unknown as CardRow
  const card = parseSnapshot(row.card_snapshot, row.snapshot_hash)
  if (!card) return null
  const inputs = builderInputsSchema.safeParse(row.builder_inputs)

  return {
    ...toSummary(row, card.readinessState),
    card,
    builderInputs: inputs.success ? inputs.data : null,
  }
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
