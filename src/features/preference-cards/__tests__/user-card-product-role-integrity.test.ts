import {
  buildDemoContext,
  defaultBuildInput,
  getComposedRecipeSlots,
  getScenarioDefinition,
} from '../data/demo-context.server'
import { catalogPickItemId } from '../domain/catalog-pick'
import { customItemId } from '../domain/custom-item'
import { equipmentSetItemId } from '../domain/equipment-set'
import { familyPickId } from '../domain/size-at-procedure'
import type { BuilderInputs, SaveCardRequest } from '../schemas/saved-card'
import { BUILDER_INPUTS_SCHEMA_VERSION, saveCardRequestSchema } from '../schemas/saved-card'
import { getCatalogStore, searchProductsForRole } from '../server/catalog'
import { resolveForSave } from '../server/user-cards'

const GENERATED_AT = '2026-07-28T12:00:00.000Z'
const SCENARIO_ID = 'chest-tube'
const VALID_ROLE = 'GENERIC_DRAINAGE_UNIT'

function baseInputs(): BuilderInputs {
  return {
    schemaVersion: BUILDER_INPUTS_SCHEMA_VERSION,
    scenarioId: SCENARIO_ID,
    input: defaultBuildInput(SCENARIO_ID),
    catalogPicks: [],
    familyPicks: [],
    customItems: [],
    equipmentSets: [],
  }
}

function validProductId(): string {
  const option = searchProductsForRole({ roleCode: VALID_ROLE, limit: 1 })[0]
  expect(option).toBeDefined()
  return option.productId
}

function unrelatedKnownRole(productId: string): string {
  const store = getCatalogStore()
  const mappedRoles = new Set(
    (store.rolesByProduct.get(productId) ?? []).map((relationship) => relationship.role_code),
  )
  const role = store.roles.find((candidate) => !mappedRoles.has(candidate.role_code))
  expect(role).toBeDefined()
  return role!.role_code
}

function saveRequest(overrides: Partial<SaveCardRequest> = {}): SaveCardRequest {
  const scenario = getScenarioDefinition(SCENARIO_ID)
  expect(scenario).not.toBeNull()
  return saveCardRequestSchema.parse({
    ...baseInputs(),
    title: 'Server integrity test',
    physicianName: null,
    status: 'draft',
    input: {
      ...defaultBuildInput(SCENARIO_ID),
      recipeVersionId: scenario!.recipeVersionId,
    },
    ...overrides,
  })
}

describe('save-time catalog product-role integrity', () => {
  it('preserves valid existing saved-card reconstruction', () => {
    const productId = validProductId()
    const context = buildDemoContext(SCENARIO_ID)
    const slot = getComposedRecipeSlots(SCENARIO_ID).find(
      (candidate) => candidate.roleCode === VALID_ROLE,
    )
    expect(slot).toBeDefined()
    const input = defaultBuildInput(SCENARIO_ID)
    input.modifierCodes = []
    input.selectedHospitalItemIds = { [slot!.id]: catalogPickItemId(productId) }
    const request = saveRequest({
      input: { ...input, recipeVersionId: context.recipe.id },
      catalogPicks: [{ productId, roleCode: VALID_ROLE }],
    })

    const result = resolveForSave(request, GENERATED_AT)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.card.generatedAt).toBe(GENERATED_AT)
      expect(result.card.snapshotHash).toMatch(/^[a-f0-9]{64}$/)
      expect(
        result.card.items.find((item) => item.roleCode === VALID_ROLE)?.selectedCatalogProductId,
      ).toBe(productId)
    }
  })

  it('rejects a tampered overwrite request that pairs a known product with an unrelated role', () => {
    const productId = validProductId()
    const wrongRole = unrelatedKnownRole(productId)
    const request = saveRequest({
      cardId: '00000000-0000-4000-8000-000000000999',
      catalogPicks: [{ productId, roleCode: wrongRole }],
    })

    expect(resolveForSave(request, GENERATED_AT)).toEqual({
      ok: false,
      code: 'catalog_pick_unavailable',
      error: `Catalog product ${productId} is not mapped to role ${wrongRole}.`,
    })
  })

  it('rejects an unknown product with a distinct error', () => {
    const request = saveRequest({
      catalogPicks: [{ productId: 'PRD-DOESNOTEXIST', roleCode: VALID_ROLE }],
    })

    expect(resolveForSave(request, GENERATED_AT)).toEqual({
      ok: false,
      code: 'catalog_pick_unavailable',
      error: 'Unknown catalog product PRD-DOESNOTEXIST.',
    })
  })

  it('rejects an unknown role with a distinct error', () => {
    const productId = validProductId()
    const request = saveRequest({
      catalogPicks: [{ productId, roleCode: 'NOT_A_REAL_ROLE' }],
    })

    expect(resolveForSave(request, GENERATED_AT)).toEqual({
      ok: false,
      code: 'catalog_pick_unavailable',
      error: 'Unknown catalog role NOT_A_REAL_ROLE.',
    })
  })

  it('rejects an equipment-set member whose product does not carry the submitted role', () => {
    const productId = validProductId()
    const wrongRole = unrelatedKnownRole(productId)
    const request = saveRequest({
      equipmentSets: [
        {
          id: 'set-integrity-test',
          name: 'Tampered set',
          description: null,
          selectedRoleCode: VALID_ROLE,
          additionalCoveredRoles: [],
          members: [{ productId, roleCode: wrongRole }],
        },
      ],
    })

    expect(resolveForSave(request, GENERATED_AT)).toEqual({
      ok: false,
      code: 'equipment_set_unavailable',
      error: `Catalog product ${productId} is not mapped to role ${wrongRole} in set "Tampered set".`,
    })
  })

  it('rebuilds and selects a valid equipment-set member at save time', () => {
    const productId = validProductId()
    const context = buildDemoContext(SCENARIO_ID)
    const slot = getComposedRecipeSlots(SCENARIO_ID).find(
      (candidate) => candidate.roleCode === VALID_ROLE,
    )
    expect(slot).toBeDefined()
    const setId = 'set-valid-integrity-test'
    const input = defaultBuildInput(SCENARIO_ID)
    input.modifierCodes = []
    input.selectedHospitalItemIds = { [slot!.id]: equipmentSetItemId(setId) }
    const request = saveRequest({
      input: { ...input, recipeVersionId: context.recipe.id },
      equipmentSets: [
        {
          id: setId,
          name: 'Validated set',
          description: null,
          selectedRoleCode: VALID_ROLE,
          additionalCoveredRoles: [],
          members: [{ productId, roleCode: VALID_ROLE }],
        },
      ],
    })

    const result = resolveForSave(request, GENERATED_AT)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(
        result.card.items.find((item) => item.roleCode === VALID_ROLE)?.selectedHospitalItemId,
      ).toBe(equipmentSetItemId(setId))
    }
  })

  it('preserves custom-item reconstruction at save time', () => {
    const roleCode = 'PLEURAL_DRAINAGE_ACCESSORY'
    const context = buildDemoContext(SCENARIO_ID)
    const slot = getComposedRecipeSlots(SCENARIO_ID).find(
      (candidate) => candidate.roleCode === roleCode,
    )
    expect(slot).toBeDefined()
    const input = defaultBuildInput(SCENARIO_ID)
    input.selectedHospitalItemIds = { [slot!.id]: customItemId('custom-integrity-test') }
    const request = saveRequest({
      input: { ...input, recipeVersionId: context.recipe.id },
      customItems: [
        {
          id: 'custom-integrity-test',
          roleCode,
          description: 'Locally stocked drainage accessory',
          itemNumber: null,
          notes: null,
        },
      ],
    })

    const result = resolveForSave(request, GENERATED_AT)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(
        result.card.items.find((item) => item.roleCode === roleCode)?.selectedItemSnapshot
          ?.localDescription,
      ).toBe('Locally stocked drainage accessory')
    }
  })

  it('preserves two valid roles carried by the same catalog product', () => {
    const scenarioId = 'ebv'
    const productId = 'PRD-4CC32EE889'
    const roleCodes = ['EBV_VALVE', 'EBV_DELIVERY_CATHETER'] as const
    const definition = getScenarioDefinition(scenarioId)
    const composedSlots = getComposedRecipeSlots(scenarioId)
    expect(definition).not.toBeNull()

    const selectedHospitalItemIds = Object.fromEntries(
      roleCodes.map((roleCode) => {
        const slot = composedSlots.find((candidate) => candidate.roleCode === roleCode)
        expect(slot).toBeDefined()
        return [slot!.id, catalogPickItemId(productId)]
      }),
    )
    const input = defaultBuildInput(scenarioId)
    input.selectedHospitalItemIds = selectedHospitalItemIds
    const request = saveCardRequestSchema.parse({
      scenarioId,
      title: 'Multi-role product integrity test',
      physicianName: null,
      status: 'draft',
      input: { ...input, recipeVersionId: definition!.recipeVersionId },
      catalogPicks: roleCodes.map((roleCode) => ({ productId, roleCode })),
      familyPicks: [],
      customItems: [],
      equipmentSets: [],
    })

    const result = resolveForSave(request, GENERATED_AT)

    expect(result.ok).toBe(true)
    if (result.ok) {
      for (const roleCode of roleCodes) {
        const item = result.card.items.find((candidate) => candidate.roleCode === roleCode)
        expect(item?.selectedCatalogProductId).toBe(productId)
        expect(item?.selectedItemSnapshot?.roleCode).toBe(roleCode)
      }
    }
  })

  it('preserves two role-scoped selections from the same product family', () => {
    const scenarioId = 'rigid-bronch'
    const familyKey = 'MFR-6208838930|gss|implant'
    const roleCodes = ['AIRWAY_STENT_SILICONE_STRAIGHT', 'AIRWAY_STENT_SILICONE_Y'] as const
    const definition = getScenarioDefinition(scenarioId)
    const composedSlots = getComposedRecipeSlots(scenarioId)
    expect(definition).not.toBeNull()

    const selectedHospitalItemIds = Object.fromEntries(
      roleCodes.map((roleCode) => {
        const slot = composedSlots.find((candidate) => candidate.roleCode === roleCode)
        expect(slot).toBeDefined()
        return [slot!.id, familyPickId(familyKey, roleCode)]
      }),
    )
    const input = defaultBuildInput(scenarioId)
    input.selectedHospitalItemIds = selectedHospitalItemIds
    const request = saveCardRequestSchema.parse({
      scenarioId,
      title: 'Multi-role family integrity test',
      physicianName: null,
      status: 'draft',
      input: { ...input, recipeVersionId: definition!.recipeVersionId },
      catalogPicks: [],
      familyPicks: roleCodes.map((roleCode) => ({ familyKey, roleCode })),
      customItems: [],
      equipmentSets: [],
    })

    const result = resolveForSave(request, GENERATED_AT)

    expect(result.ok).toBe(true)
    if (result.ok) {
      for (const roleCode of roleCodes) {
        const item = result.card.items.find((candidate) => candidate.roleCode === roleCode)
        expect(item?.selectedHospitalItemId).toBe(familyPickId(familyKey, roleCode))
        expect(item?.selectedItemSnapshot?.roleCode).toBe(roleCode)
      }
    }
  })
})
