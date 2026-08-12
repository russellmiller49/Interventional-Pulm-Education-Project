import 'server-only'

import {
  buildOperationalOutputRegistry,
  type GapOutputInput,
  type OperationalOutputRegistry,
} from '@/features/device-intelligence/domain/operational-outputs'
import { isExemplarProcedureCode } from '@/features/device-intelligence/domain/exemplars'
import {
  CANONICAL_PROCEDURAL_PHASE_ORDER,
  buildReadinessProjection,
  getCoverageLadderForProcedure,
  type RealFormularySummary,
} from './procedures.server'

import {
  buildReleaseContext,
  getCurrentReleaseBundle,
} from '@/features/preference-cards/data/release-bundles.server'
import { expandEffectiveSlots } from '@/features/preference-cards/domain/effective-slots'
import { defaultSelectedModuleVersionIds } from '@/features/preference-cards/domain/expand-recipe-composition'
import { resolveCard } from '@/features/preference-cards/domain/resolve-card'
import type { BuildCardInput } from '@/features/preference-cards/domain/types'
import {
  DEMO_LOCATION_ID,
  DEMO_ORGANIZATION_ID,
  DEMO_SITE_ID,
} from '@/features/preference-cards/seed/operational'
import { getCatalogStore } from '@/features/preference-cards/server/catalog'
import { getAtlasCatalogStore } from './atlas-store.server'

/**
 * The read-only operational-output adapter.
 *
 * This is the only layer allowed to obtain the resolved card. It verifies the procedure's exact
 * current release, resolves that pinned definition set exactly once, enriches its already-resolved
 * lines with non-resolution slot display fields, and passes the frozen result into the pure output
 * registry. Registry projectors cannot call a resolver or persistence surface.
 */

const OUTPUT_GENERATED_AT = '2026-07-25T12:00:00.000Z'

const DIMENSION_FIELDS = [
  'diameter_mm',
  'french_size',
  'gauge',
  'length_mm',
  'working_length_cm',
  'min_working_channel_mm',
  'delivery_system_od_mm',
  'size_display',
] as const

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

export function getProcedureOutputPreviews(
  procedureCode: string,
  scenarioId: string,
  formularySummary: RealFormularySummary,
): OperationalOutputRegistry | null {
  if (!isExemplarProcedureCode(procedureCode)) return null

  const store = getCatalogStore()
  const atlasStore = getAtlasCatalogStore()
  const procedure = store.procedureByCode.get(procedureCode)
  const release = getCurrentReleaseBundle(procedureCode)
  if (!procedure || !release || release.scenarioId !== scenarioId) return null

  const released = buildReleaseContext(release.id, { scenarioId })
  if (!released.ok || released.bundle.sourceProcedureCode !== procedureCode) return null

  const selectedModuleVersionIds = defaultSelectedModuleVersionIds(released.context.recipe)
  const input: BuildCardInput = {
    organizationId: DEMO_ORGANIZATION_ID,
    siteId: DEMO_SITE_ID,
    locationId: DEMO_LOCATION_ID,
    recipeVersionId: released.context.recipe.id,
    selectedModuleVersionIds,
    modifierCodes: [...released.scenario.defaultModifierCodes],
    variables: { generated_at: OUTPUT_GENERATED_AT },
    conditionalStates: {},
  }

  // Exactly one resolution. Everything below is a projection of this immutable result.
  const resolved = resolveCard(input, released.context)

  // `ResolvedCardItem` intentionally omits two operational display fields. Re-run the canonical
  // expansion (not card resolution) against the SAME verified release context and exact selected
  // modules/modifiers, then join by immutable requirement id. No ranking or selection occurs.
  const effective = expandEffectiveSlots(
    {
      selectedModuleVersionIds,
      modifierCodes: resolved.selectedModifiers,
    },
    released.context,
  )
  const slotById = new Map(effective.slots.map((slot) => [slot.id, slot]))

  // Only fields absent from `ResolvedCardItem` are joined from the exact pinned slot expansion.
  // Live role metadata is deliberately not consulted: selection guidance and IFU flags are not
  // release artifacts, so they cannot affect these outputs or their deterministic digests.
  const slotAnnotations = [...resolved.items, ...resolved.suppressedItems].map((item) => {
    const slot = slotById.get(item.id)
    return {
      itemId: item.id,
      sterileStatus: slot?.sterileStatus ?? null,
      responsibleRole: slot?.responsibleRole ?? null,
    }
  })

  const ladder = getCoverageLadderForProcedure(procedureCode)
  const projection = buildReadinessProjection(procedureCode, resolved, ladder)

  // Dimension gaps remain explicitly current audit data, not a claim that these counts were
  // frozen into the release. The registry definition carries that mixed-source provenance.
  const procedureSlotIds = new Set(
    store.procedureSlots
      .filter((slot) => slot.procedure_code === procedureCode)
      .map((slot) => slot.slot_id),
  )
  const optionProductIds = new Set<string>()
  for (const [productId, options] of store.slotOptionsByProduct) {
    if (options.some((option) => procedureSlotIds.has(option.slot_id))) {
      optionProductIds.add(productId)
    }
  }
  let dimensionGapCount = 0
  for (const productId of optionProductIds) {
    const product = store.productById.get(productId)
    if (product && DIMENSION_FIELDS.every((field) => isBlank(product[field]))) {
      dimensionGapCount += 1
    }
  }

  const gaps: GapOutputInput = {
    projection,
    proposalsOnlyRoles: ladder.roles
      .filter((role) => role.coverage === 'proposals_only')
      .map((role) => role.roleCode),
    unmappedRoles: ladder.roles
      .filter(
        (role) =>
          role.coverage === 'no_option_no_proposal_role_mapped' ||
          role.coverage === 'no_option_no_proposal_unmapped',
      )
      .map((role) => role.roleCode),
    nonSelectableOnlyRoles: ladder.roles
      .filter((role) => role.coverage === 'non_selectable_authored_only')
      .map((role) => role.roleCode),
    demoStandInRoles: ladder.roles.filter((role) => role.demoStandIn).map((role) => role.roleCode),
    dimensionGapCount,
    formularySummary,
  }

  return buildOperationalOutputRegistry({
    scenarioId,
    procedureStatus: procedure.status ?? 'unknown',
    card: resolved,
    slotAnnotations,
    canonicalPhaseOrder: CANONICAL_PROCEDURAL_PHASE_ORDER,
    identifiableCatalogProductIds: new Set(atlasStore.productById.keys()),
    gaps,
  })
}
