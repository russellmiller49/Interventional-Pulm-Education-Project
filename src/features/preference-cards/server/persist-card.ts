'use server'

import { buildCardInputSchema } from '../domain/schemas'
import type { ResolvedCard } from '../domain/types'
import { getPreferenceCardSession } from './access'

interface PersistCardResult {
  ok: boolean
  cardId?: string
  error?: string
}

export async function persistResolvedCard(
  input: unknown,
  card: ResolvedCard,
): Promise<PersistCardResult> {
  const parsedInput = buildCardInputSchema.safeParse(input)
  if (!parsedInput.success) {
    return {
      ok: false,
      error: parsedInput.error.issues[0]?.message ?? 'The preference-card input is invalid.',
    }
  }

  const session = await getPreferenceCardSession()
  if (!session.user || !session.canBuild) {
    return {
      ok: false,
      error: 'Preference-card builder access is required.',
    }
  }

  const membership = session.memberships.find(
    (candidate) => candidate.organization_id === parsedInput.data.organizationId,
  )
  if (!membership && !session.canAdmin) {
    return {
      ok: false,
      error: 'Organization membership is required.',
    }
  }
  if (Object.keys(parsedInput.data.waivers ?? {}).length > 0 && !session.canAdmin) {
    return {
      ok: false,
      error: 'Administrator permission is required to record a waiver.',
    }
  }

  const payload = {
    organization_id: parsedInput.data.organizationId,
    site_id: parsedInput.data.siteId,
    location_id: parsedInput.data.locationId,
    created_by: session.user.id,
    recipe_version_id: card.recipeVersionId,
    governance_state_snapshot: card.governanceState,
    readiness_state: card.readinessState,
    selected_modifier_codes: card.selectedModifiers,
    input_variables: {
      ...parsedInput.data.variables,
      selected_hospital_item_ids: parsedInput.data.selectedHospitalItemIds ?? {},
    },
    conditional_states: parsedInput.data.conditionalStates ?? {},
    engine_version: card.engineVersion,
    catalog_import_id: card.catalogImportId,
    snapshot_hash: card.snapshotHash,
    generated_at: card.generatedAt,
    snapshot: card,
    items: card.items,
    warnings: card.warnings,
  }

  const { data, error } = await session.supabase.rpc('ip_create_case_card_snapshot', { payload })
  if (error) return { ok: false, error: error.message }
  if (typeof data !== 'string') {
    return { ok: false, error: 'The database did not return a card identifier.' }
  }
  return { ok: true, cardId: data }
}
