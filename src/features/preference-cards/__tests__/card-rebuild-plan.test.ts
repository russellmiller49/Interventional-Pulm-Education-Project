import {
  allowedAcknowledgements,
  applyRebuildAcknowledgements,
  expectedFinalState,
  planCardRebuild,
  proposeRebuildSelection,
  rebuildPlanHash,
  reviewRebuildAcknowledgements,
  unanswerableBlockingDecisions,
  unauthorizedFinalState,
  type CardRebuildPlan,
  type RebuildAcknowledgement,
  type RebuildPlanInput,
  type RebuildProbe,
} from '../domain/card-rebuild-plan'
import { catalogPickItemId } from '../domain/catalog-pick'
import { customItemId } from '../domain/custom-item'
import { equipmentSetItemId } from '../domain/equipment-set'
import { expandRecipeComposition } from '../domain/expand-recipe-composition'
import { modifierSetDefinitionHash } from '../domain/release-bundle'
import { familyPickId } from '../domain/size-at-procedure'
import { stableStringify } from '../domain/stable-hash'
import type { ResolvedCard, ResolvedCardItem } from '../domain/types'
import type { ReleasePinnedBuilderInputs } from '../schemas/saved-card'
import {
  ALPHA_RELEASE_ID,
  BRAVO_RELEASE_ID,
  FIXTURE_MODULE_V1_0,
  FIXTURE_MODULE_V1_1,
  FIXTURE_RECIPE_V1_0,
  FIXTURE_RECIPE_V1_1,
  FIXTURE_SCENARIO_ID,
  REVISED_REQUIREMENT_KEY,
  createFixtureDefinitionStore,
  createFixtureReleaseWorld,
} from '../__fixtures__/release-bundle-fixtures'

/**
 * The rebuild plan, proved on the synthetic three-release world.
 *
 * Production has one release per procedure and no supersession, so nothing real exercises a card
 * crossing from one release to another — which is the whole of this module. The fixture world is
 * the only ground truth for it, and its one deliberate difference between ALPHA and BRAVO
 * (`FIXTURE_BACKUP_SCOPE` moving from `optional` to `required`) is what every "the definition
 * changed" assertion below turns on.
 *
 * The planner is pure, so every test here is a function call. What it cannot see — whether a
 * product is still in the catalogue, whether the room still stocks an item — arrives through the
 * probe, which is supplied directly rather than through a catalogue, so a test can state the
 * availability it wants to reason about instead of arranging for it.
 */

const PRIMARY_KEY = 'FIXTURE_PRIMARY_SCOPE'
const PRIMARY_SLOT = 'SLOT-FIXTURE-PRIMARY'
const BACKUP_SLOT = 'SLOT-FIXTURE-BACKUP'
const ROLE = 'FIXTURE_ROLE'

const world = createFixtureReleaseWorld()
const alpha = world.bundleById.get(ALPHA_RELEASE_ID)!
const bravo = world.bundleById.get(BRAVO_RELEASE_ID)!

function composedSlots(recipeVersionId: string, moduleVersionId: string) {
  const store = createFixtureDefinitionStore()
  return expandRecipeComposition({
    recipe: store.recipes.get(recipeVersionId)!,
    modules: [store.modules.get(moduleVersionId)!],
    selectedModuleVersionIds: [moduleVersionId],
    startSequence: 1,
  }).slots
}

const sourceSlots = composedSlots(FIXTURE_RECIPE_V1_0, FIXTURE_MODULE_V1_0)
const targetSlots = composedSlots(FIXTURE_RECIPE_V1_1, FIXTURE_MODULE_V1_1)

function item(
  overrides: Partial<ResolvedCardItem> & Pick<ResolvedCardItem, 'id'>,
): ResolvedCardItem {
  return {
    sourceSlotId: overrides.id,
    requirementKey: PRIMARY_KEY,
    sourceModuleVersionIds: [FIXTURE_MODULE_V1_0],
    roleCode: ROLE,
    label: 'Fixture requirement',
    genericRequirement: 'A requirement that exists only in this fixture.',
    requiredness: 'required',
    effectiveRequiredness: 'required',
    dependencyRule: null,
    conditionalState: null,
    quantityDisplay: '1',
    setupZone: 'back_table',
    proceduralPhase: 'airway_access',
    setupSequence: 1,
    openHoldStatus: 'open_or_set_up_now',
    selectedHospitalItemId: null,
    selectedCatalogProductId: null,
    selectedItemSnapshot: null,
    resolutionState: 'resolved',
    verificationState: 'prototype_visible',
    compatibilityState: 'not_evaluated',
    rationale: null,
    whyIncluded: [],
    notes: null,
    ...overrides,
  }
}

function snapshot(overrides: Partial<ResolvedCard> = {}): ResolvedCard {
  return {
    recipeVersionId: FIXTURE_RECIPE_V1_0,
    recipeName: 'Fixture procedure',
    recipeVersion: '1.0',
    sourceProcedureCode: 'FIXTURE_PROCEDURE',
    organizationName: 'Org',
    siteName: 'Site',
    locationName: 'Location',
    scope: { organizationId: 'org', siteId: 'site', locationId: 'location' },
    resolutionProvenance: {
      releaseBundleId: ALPHA_RELEASE_ID,
      releaseDefinitionHash: alpha.definitionHash,
      catalogReleaseId: alpha.catalogImportId,
      resolverContractVersion: alpha.resolverContractVersion,
    },
    selectedModifiers: [],
    includedModules: [],
    items: [
      item({ id: PRIMARY_SLOT, requirementKey: PRIMARY_KEY }),
      item({
        id: BACKUP_SLOT,
        requirementKey: REVISED_REQUIREMENT_KEY,
        label: 'Backup scope',
        requiredness: 'optional',
        effectiveRequiredness: 'optional',
        setupSequence: 2,
      }),
    ],
    suppressedItems: [],
    warnings: [],
    readinessState: 'complete',
    governanceState: 'draft',
    ruleTrace: [],
    engineVersion: 'fixture',
    catalogImportId: 'fixture-workbook',
    snapshotHash: 'a'.repeat(64),
    snapshotIntegrityHash: 'b'.repeat(64),
    resolvedContentHash: 'c'.repeat(64),
    generatedAt: '2026-01-01T00:00:00.000Z',
    prototype: true,
    ...overrides,
  }
}

function inputs(overrides: Partial<ReleasePinnedBuilderInputs> = {}): ReleasePinnedBuilderInputs {
  return {
    schemaVersion: 4,
    releaseBundleId: ALPHA_RELEASE_ID,
    scenarioId: FIXTURE_SCENARIO_ID,
    input: {
      organizationId: 'org',
      siteId: 'site',
      locationId: 'location',
      recipeVersionId: FIXTURE_RECIPE_V1_0,
      selectedModuleVersionIds: [FIXTURE_MODULE_V1_0],
      modifierCodes: [],
      variables: {},
      selectionsAreExplicit: true,
      ...overrides.input,
    },
    catalogPicks: [],
    familyPicks: [],
    customItems: [],
    equipmentSets: [],
    ...overrides,
  } as ReleasePinnedBuilderInputs
}

/** Everything available, so a test only has to say what it wants to be missing. */
function permissiveProbe(overrides: Partial<RebuildProbe> = {}): RebuildProbe {
  return {
    // The pure planner is exercised without a resolver by default: `null` projects to
    // `ok: false`, which the annotation step deliberately treats as "nothing extra is known"
    // rather than as a finding. Tests that care supply one.
    resolveTarget: () => null,
    equipmentSetMembersAvailable: () => true,
    hospitalItemOffered: () => true,
    catalogProductAvailable: () => true,
    reviewedFamilyAvailable: (ref) => ({
      ok: true,
      definitionHashChanged: false,
      definitionHash: ref.definitionHash,
      catalogReleaseId: ref.catalogReleaseId,
    }),
    ...overrides,
  }
}

const fixtureModifierHash = modifierSetDefinitionHash([createFixtureDefinitionStore().modifiers[0]])

function plan(
  overrides: {
    inputs?: ReleasePinnedBuilderInputs
    card?: ResolvedCard
    probe?: RebuildProbe
    selection?: { moduleVersionIds: string[]; modifierCodes: string[] }
    targetModifierHashes?: Record<string, string>
    comparisons?: { operationalHash: string; releaseDiffHash: string }
  } = {},
): CardRebuildPlan {
  const sourceInputs = overrides.inputs ?? inputs()
  const input: RebuildPlanInput = {
    source: {
      cardId: '00000000-0000-4000-8000-000000000001',
      revisionId: '00000000-0000-4000-9000-000000000001',
      revisionNumber: 1,
      inputs: sourceInputs,
      card: overrides.card ?? snapshot(),
      slots: sourceSlots,
      releaseBundle: alpha,
      modifierDefinitionHashes: { FIXTURE_MODIFIER: fixtureModifierHash },
    },
    target: {
      slots: targetSlots,
      releaseBundle: bravo,
      offeredModules: [
        {
          moduleVersionId: FIXTURE_MODULE_V1_1,
          moduleCode: 'FIXTURE_CORE',
          moduleVersion: '1.1',
          selectionBehavior: 'required',
          definitionHash: bravo.modulePins[0].definitionHash,
        },
      ],
      allowedModifierCodes: ['FIXTURE_MODIFIER'],
      modifierDefinitionHashes: overrides.targetModifierHashes ?? {
        FIXTURE_MODIFIER: fixtureModifierHash,
      },
    },
    selection: overrides.selection ?? {
      moduleVersionIds: [FIXTURE_MODULE_V1_1],
      modifierCodes: sourceInputs.input.modifierCodes,
    },
    comparisons: overrides.comparisons ?? {
      operationalHash: '7'.repeat(64),
      releaseDiffHash: '8'.repeat(64),
    },
    probe: overrides.probe ?? permissiveProbe(),
  }
  return planCardRebuild(input)
}

function decision(result: CardRebuildPlan, key: string) {
  const found = result.decisions.find((entry) => entry.key === key)
  expect(found).toBeDefined()
  return found!
}

describe('matching is by reviewed requirement identity and nothing else', () => {
  it('carries an unchanged requirement without asking anything', () => {
    const result = plan({
      card: snapshot({
        items: [
          item({ id: PRIMARY_SLOT, selectedHospitalItemId: 'local-scope-1' }),
          item({
            id: BACKUP_SLOT,
            requirementKey: REVISED_REQUIREMENT_KEY,
            requiredness: 'optional',
            effectiveRequiredness: 'optional',
          }),
        ],
      }),
    })

    const primary = decision(result, `requirement:${PRIMARY_KEY}`)
    expect(primary.state).toBe('carried_unchanged')
    expect(primary.requiresExplicitConfirmation).toBe(false)
    expect(primary.reasonCodes).toContain('requirement_unchanged')
    // Re-keyed onto the target's slot id, which is what the new card will be resolved against.
    expect(result.proposedInputs.input.selectedHospitalItemIds).toEqual(
      expect.objectContaining({ [PRIMARY_SLOT]: 'local-scope-1' }),
    )
  })

  it('makes a requirement whose released definition moved require confirmation', () => {
    const result = plan()
    const backup = decision(result, `requirement:${REVISED_REQUIREMENT_KEY}`)

    expect(backup.state).toBe('carried_requires_review')
    expect(backup.requiresExplicitConfirmation).toBe(true)
    expect(backup.reasonCodes).toContain('requirement_definition_changed')
    // The one authored difference between the two fixture releases.
    expect(backup.kind === 'requirement' && backup.changedDefinitionFields).toEqual([
      'requiredness',
    ])
  })

  it('never matches a requirement by role code', () => {
    // Both fixture requirements carry the same role. If role code were ever a fallback, a card
    // whose requirement key vanished would silently adopt the other line's identity.
    const result = plan({
      card: snapshot({
        items: [
          item({
            id: PRIMARY_SLOT,
            requirementKey: 'FIXTURE_KEY_THAT_NO_RELEASE_EXPRESSES',
            selectedHospitalItemId: 'local-scope-1',
          }),
        ],
      }),
    })

    expect(decision(result, 'requirement:FIXTURE_KEY_THAT_NO_RELEASE_EXPRESSES').state).toBe(
      'removed_requirement',
    )
    // And the target's own two requirements are both reported as added rather than matched to it.
    expect(decision(result, `requirement:${PRIMARY_KEY}`).state).toBe('new_requirement')
    expect(decision(result, `requirement:${REVISED_REQUIREMENT_KEY}`).state).toBe('new_requirement')
  })

  it('reports an added required requirement as blocking and chooses nothing for it', () => {
    const result = plan({
      card: snapshot({ items: [item({ id: PRIMARY_SLOT })] }),
    })
    const added = decision(result, `requirement:${REVISED_REQUIREMENT_KEY}`)

    expect(added.state).toBe('new_requirement')
    // `requiredness: required` in BRAVO, so a card that cannot ask for it is not a usable card.
    expect(added.blocking).toBe(true)
    expect(result.proposedInputs.input.selectedHospitalItemIds).not.toHaveProperty(BACKUP_SLOT)
  })

  it('reads a requirement that only moved between modules as unchanged', () => {
    const movedSlots = targetSlots.map((slot) =>
      slot.requirementKey === PRIMARY_KEY
        ? { ...slot, sourceModuleVersionIds: ['module-somewhere-else-v2-0'] }
        : slot,
    )
    const result = planCardRebuild({
      source: {
        cardId: 'c',
        revisionId: 'r',
        revisionNumber: 1,
        inputs: inputs(),
        card: snapshot(),
        slots: sourceSlots,
        releaseBundle: alpha,
        modifierDefinitionHashes: {},
      },
      target: {
        slots: movedSlots,
        releaseBundle: bravo,
        offeredModules: [],
        allowedModifierCodes: [],
        modifierDefinitionHashes: {},
      },
      selection: { moduleVersionIds: [], modifierCodes: [] },
      comparisons: { operationalHash: '7'.repeat(64), releaseDiffHash: '8'.repeat(64) },
      probe: permissiveProbe(),
    })

    const primary = decision(result, `requirement:${PRIMARY_KEY}`)
    expect(primary.state).toBe('carried_unchanged')
    expect(primary.reasonCodes).toContain('provenance_only_module_move')
    expect(primary.requiresExplicitConfirmation).toBe(false)
  })
})

describe('a selection crosses only by exact stable identity', () => {
  it('drops a hospital item the room no longer offers for the requirement', () => {
    const result = plan({
      card: snapshot({
        items: [item({ id: PRIMARY_SLOT, selectedHospitalItemId: 'local-scope-1' })],
      }),
      probe: permissiveProbe({ hospitalItemOffered: () => false }),
    })

    const primary = decision(result, `requirement:${PRIMARY_KEY}`)
    expect(primary.state).toBe('not_carried')
    expect(primary.reasonCodes).toContain('hospital_item_not_offered')
    expect(result.proposedInputs.input.selectedHospitalItemIds).not.toHaveProperty(PRIMARY_SLOT)
  })

  it('never substitutes a different catalogue product for one that is gone', () => {
    const result = plan({
      inputs: inputs({ catalogPicks: [{ productId: 'PRD-ABC123', roleCode: ROLE }] }),
      card: snapshot({
        items: [
          item({ id: PRIMARY_SLOT, selectedHospitalItemId: catalogPickItemId('PRD-ABC123') }),
        ],
      }),
      probe: permissiveProbe({ catalogProductAvailable: () => false }),
    })

    expect(decision(result, `requirement:${PRIMARY_KEY}`).reasonCodes).toContain(
      'catalog_product_unavailable',
    )
    expect(result.proposedInputs.catalogPicks).toEqual([])
  })

  it('re-pins a reviewed family whose membership moved, and requires review of it', () => {
    const pin = {
      productFamilyVersionId: 'family-fixture-v1',
      catalogReleaseId: 'd'.repeat(64),
      definitionHash: 'e'.repeat(64),
      roleCode: ROLE,
    }
    const result = plan({
      inputs: inputs({ familyPicks: [pin] }),
      card: snapshot({
        items: [
          item({
            id: PRIMARY_SLOT,
            selectedHospitalItemId: familyPickId(pin.productFamilyVersionId),
          }),
        ],
      }),
      probe: permissiveProbe({
        reviewedFamilyAvailable: () => ({
          ok: true,
          definitionHashChanged: true,
          definitionHash: 'f'.repeat(64),
          catalogReleaseId: '9'.repeat(64),
        }),
      }),
    })

    const primary = decision(result, `requirement:${PRIMARY_KEY}`)
    expect(primary.state).toBe('carried_requires_review')
    expect(primary.reasonCodes).toContain('family_version_changed')
    // Re-pinned to the membership that is true now. Writing the old hash would produce a card that
    // refuses to reopen, because every reconstruction verifies the pin exactly.
    expect(result.proposedInputs.familyPicks).toEqual([
      {
        productFamilyVersionId: 'family-fixture-v1',
        catalogReleaseId: '9'.repeat(64),
        definitionHash: 'f'.repeat(64),
        roleCode: ROLE,
      },
    ])
  })

  it('does not carry a family whose pin no longer resolves', () => {
    const pin = {
      productFamilyVersionId: 'family-fixture-v1',
      catalogReleaseId: 'd'.repeat(64),
      definitionHash: 'e'.repeat(64),
      roleCode: ROLE,
    }
    const result = plan({
      inputs: inputs({ familyPicks: [pin] }),
      card: snapshot({
        items: [
          item({
            id: PRIMARY_SLOT,
            selectedHospitalItemId: familyPickId(pin.productFamilyVersionId),
          }),
        ],
      }),
      probe: permissiveProbe({
        reviewedFamilyAvailable: () => ({ ok: false, reason: 'family_version_unavailable' }),
      }),
    })

    expect(decision(result, `requirement:${PRIMARY_KEY}`).state).toBe('not_carried')
    expect(result.proposedInputs.familyPicks).toEqual([])
  })

  it('always requires review of a line the physician wrote themselves', () => {
    // The fixture requirements forbid custom entry, so the target has to allow it for the
    // interesting branch to be reachable at all.
    const customAllowed = targetSlots.map((slot) => ({ ...slot, allowCustom: true }))
    const result = planCardRebuild({
      source: {
        cardId: 'c',
        revisionId: 'r',
        revisionNumber: 1,
        inputs: inputs({
          customItems: [
            {
              id: 'custom-1',
              roleCode: ROLE,
              description: 'Wall suction',
              itemNumber: null,
              notes: null,
            },
          ],
        }),
        card: snapshot({
          items: [item({ id: PRIMARY_SLOT, selectedHospitalItemId: customItemId('custom-1') })],
        }),
        slots: sourceSlots.map((slot) => ({ ...slot, allowCustom: true })),
        releaseBundle: alpha,
        modifierDefinitionHashes: {},
      },
      target: {
        slots: customAllowed,
        releaseBundle: bravo,
        offeredModules: [],
        allowedModifierCodes: [],
        modifierDefinitionHashes: {},
      },
      selection: { moduleVersionIds: [], modifierCodes: [] },
      comparisons: { operationalHash: '7'.repeat(64), releaseDiffHash: '8'.repeat(64) },
      probe: permissiveProbe(),
    })

    const primary = decision(result, `requirement:${PRIMARY_KEY}`)
    expect(primary.state).toBe('carried_requires_review')
    expect(primary.reasonCodes).toContain('custom_item_requires_review')
    expect(result.proposedInputs.customItems).toHaveLength(1)
  })

  it('does not carry a written line onto a requirement that no longer allows one', () => {
    const noCustomSlots = targetSlots.map((slot) => ({ ...slot, allowCustom: false }))
    const result = planCardRebuild({
      source: {
        cardId: 'c',
        revisionId: 'r',
        revisionNumber: 1,
        inputs: inputs({
          customItems: [
            {
              id: 'custom-1',
              roleCode: ROLE,
              description: 'Wall suction',
              itemNumber: null,
              notes: null,
            },
          ],
        }),
        card: snapshot({
          items: [item({ id: PRIMARY_SLOT, selectedHospitalItemId: customItemId('custom-1') })],
        }),
        slots: sourceSlots,
        releaseBundle: alpha,
        modifierDefinitionHashes: {},
      },
      target: {
        slots: noCustomSlots,
        releaseBundle: bravo,
        offeredModules: [],
        allowedModifierCodes: [],
        modifierDefinitionHashes: {},
      },
      selection: { moduleVersionIds: [], modifierCodes: [] },
      comparisons: { operationalHash: '7'.repeat(64), releaseDiffHash: '8'.repeat(64) },
      probe: permissiveProbe(),
    })

    expect(decision(result, `requirement:${PRIMARY_KEY}`).reasonCodes).toContain(
      'custom_not_allowed_by_target',
    )
    expect(result.proposedInputs.customItems).toEqual([])
  })

  it('carries a whole equipment set, and refuses one that no longer covers the role', () => {
    const set = {
      id: 'set-1',
      name: 'Fixture tray',
      description: null,
      selectedRoleCode: ROLE,
      additionalCoveredRoles: [],
      members: [{ productId: 'PRD-ABC123', roleCode: ROLE }],
    }
    const carried = plan({
      inputs: inputs({ equipmentSets: [set] }),
      card: snapshot({
        items: [item({ id: PRIMARY_SLOT, selectedHospitalItemId: equipmentSetItemId('set-1') })],
      }),
    })
    expect(decision(carried, `requirement:${PRIMARY_KEY}`).state).toBe('carried_unchanged')
    expect(carried.proposedInputs.equipmentSets).toHaveLength(1)

    const uncovered = plan({
      inputs: inputs({
        equipmentSets: [
          {
            ...set,
            selectedRoleCode: 'OTHER_ROLE',
            members: [{ productId: 'PRD-ABC123', roleCode: 'OTHER_ROLE' }],
          },
        ],
      }),
      card: snapshot({
        items: [item({ id: PRIMARY_SLOT, selectedHospitalItemId: equipmentSetItemId('set-1') })],
      }),
    })
    expect(decision(uncovered, `requirement:${PRIMARY_KEY}`).reasonCodes).toContain(
      'equipment_set_role_not_covered',
    )
    expect(uncovered.proposedInputs.equipmentSets).toEqual([])
  })

  it('does not carry a set when one of its members is gone from the target catalogue', () => {
    const set = {
      id: 'set-1',
      name: 'Fixture tray',
      description: null,
      selectedRoleCode: ROLE,
      additionalCoveredRoles: [],
      members: [
        { productId: 'PRD-ABC123', roleCode: ROLE },
        { productId: 'PRD-GONE99', roleCode: ROLE },
      ],
    }
    const result = plan({
      inputs: inputs({ equipmentSets: [set] }),
      card: snapshot({
        items: [item({ id: PRIMARY_SLOT, selectedHospitalItemId: equipmentSetItemId('set-1') })],
      }),
      // Coverage is intact; one member is not. The old planner checked only the first of those.
      probe: permissiveProbe({ equipmentSetMembersAvailable: () => false }),
    })

    const primary = decision(result, `requirement:${PRIMARY_KEY}`)
    expect(primary.state).toBe('not_carried')
    expect(primary.reasonCodes).toContain('equipment_set_member_unavailable')
    // Atomic: no partial tray reaches the new card.
    expect(result.proposedInputs.equipmentSets).toEqual([])
    expect(result.proposedInputs.input.selectedHospitalItemIds).not.toHaveProperty(PRIMARY_SLOT)
    // And it is a decision the physician sees before finishing the review, not a late failure.
    expect(primary.requiresExplicitConfirmation).toBe(true)
  })

  it('keeps a deliberate blank as a deliberate blank', () => {
    const result = plan({
      card: snapshot({ items: [item({ id: PRIMARY_SLOT, selectedHospitalItemId: null })] }),
    })
    expect(decision(result, `requirement:${PRIMARY_KEY}`).reasonCodes).toContain(
      'selection_deliberately_empty',
    )
    // Explicit null, not an absent key: "nobody looked" and "left empty on purpose" are different.
    expect(result.proposedInputs.input.selectedHospitalItemIds?.[PRIMARY_SLOT]).toBeNull()
  })
})

describe('conditional state survives only an unchanged rule', () => {
  it('carries an include-or-exclude answer when the dependency rule held', () => {
    const result = plan({
      card: snapshot({
        items: [item({ id: PRIMARY_SLOT, conditionalState: 'exclude' })],
      }),
    })
    expect(result.proposedInputs.input.conditionalStates?.[PRIMARY_SLOT]).toBe('exclude')
  })

  it('resets it to undecided when the rule it was answered against moved', () => {
    const changedRule = targetSlots.map((slot) =>
      slot.requirementKey === PRIMARY_KEY ? { ...slot, dependencyRule: 'a_different_rule' } : slot,
    )
    const result = planCardRebuild({
      source: {
        cardId: 'c',
        revisionId: 'r',
        revisionNumber: 1,
        inputs: inputs(),
        card: snapshot({ items: [item({ id: PRIMARY_SLOT, conditionalState: 'exclude' })] }),
        slots: sourceSlots,
        releaseBundle: alpha,
        modifierDefinitionHashes: {},
      },
      target: {
        slots: changedRule,
        releaseBundle: bravo,
        offeredModules: [],
        allowedModifierCodes: [],
        modifierDefinitionHashes: {},
      },
      selection: { moduleVersionIds: [], modifierCodes: [] },
      comparisons: { operationalHash: '7'.repeat(64), releaseDiffHash: '8'.repeat(64) },
      probe: permissiveProbe(),
    })

    const primary = decision(result, `requirement:${PRIMARY_KEY}`)
    expect(primary.reasonCodes).toContain('conditional_rule_changed')
    expect(primary.state).toBe('carried_requires_review')
    expect(result.proposedInputs.input.conditionalStates).not.toHaveProperty(PRIMARY_SLOT)
  })
})

describe('modifiers carry on an exact definition hash', () => {
  it('carries a modifier whose definition is byte-identical', () => {
    const result = plan({
      inputs: inputs({
        input: { ...inputs().input, modifierCodes: ['FIXTURE_MODIFIER'] },
      }),
      selection: { moduleVersionIds: [FIXTURE_MODULE_V1_1], modifierCodes: ['FIXTURE_MODIFIER'] },
    })
    const modifier = decision(result, 'modifier:FIXTURE_MODIFIER')
    expect(modifier.state).toBe('carried_unchanged')
    expect(result.proposedInputs.input.modifierCodes).toEqual(['FIXTURE_MODIFIER'])
  })

  it('requires confirmation when the modifier definition moved', () => {
    const result = plan({
      inputs: inputs({ input: { ...inputs().input, modifierCodes: ['FIXTURE_MODIFIER'] } }),
      selection: { moduleVersionIds: [FIXTURE_MODULE_V1_1], modifierCodes: ['FIXTURE_MODIFIER'] },
      targetModifierHashes: { FIXTURE_MODIFIER: '0'.repeat(64) },
    })
    const modifier = decision(result, 'modifier:FIXTURE_MODIFIER')
    expect(modifier.state).toBe('carried_requires_review')
    expect(modifier.requiresExplicitConfirmation).toBe(true)
    expect(modifier.reasonCodes).toContain('modifier_definition_changed')
  })

  it('does not apply a modifier the target release no longer offers', () => {
    const result = planCardRebuild({
      source: {
        cardId: 'c',
        revisionId: 'r',
        revisionNumber: 1,
        inputs: inputs({ input: { ...inputs().input, modifierCodes: ['FIXTURE_MODIFIER'] } }),
        card: snapshot(),
        slots: sourceSlots,
        releaseBundle: alpha,
        modifierDefinitionHashes: { FIXTURE_MODIFIER: fixtureModifierHash },
      },
      target: {
        slots: targetSlots,
        releaseBundle: bravo,
        offeredModules: [],
        allowedModifierCodes: [],
        modifierDefinitionHashes: {},
      },
      selection: { moduleVersionIds: [], modifierCodes: [] },
      comparisons: { operationalHash: '7'.repeat(64), releaseDiffHash: '8'.repeat(64) },
      probe: permissiveProbe(),
    })
    const modifier = decision(result, 'modifier:FIXTURE_MODIFIER')
    expect(modifier.state).toBe('removed_requirement')
    expect(modifier.reasonCodes).toContain('modifier_not_offered')
    expect(result.proposedInputs.input.modifierCodes).toEqual([])
  })
})

describe('waivers are never carried', () => {
  const waived = () =>
    plan({
      inputs: inputs({
        input: {
          ...inputs().input,
          waivers: { [`unresolved-required-${PRIMARY_SLOT}`]: 'Accepted for this case only.' },
        },
      }),
      card: snapshot({
        warnings: [
          {
            id: `unresolved-required-${PRIMARY_SLOT}`,
            severity: 'blocking',
            code: 'unresolved_required',
            message: 'No product is selected.',
            sourceType: 'slot',
            sourceId: PRIMARY_SLOT,
            acknowledged: true,
            waiverReason: 'Accepted for this case only.',
          },
        ],
      }),
    })

  it('produces a not_carried decision carrying only the prior rationale', () => {
    const entry = decision(waived(), `waiver:unresolved-required-${PRIMARY_SLOT}`)
    expect(entry.state).toBe('not_carried')
    expect(entry.reasonCodes).toContain('waiver_never_carries')
    expect(entry.kind === 'waiver' && entry.priorRationale).toBe('Accepted for this case only.')
  })

  it('writes no waiver into the new card under any circumstances', () => {
    expect(waived().proposedInputs.input.waivers).toEqual({})
  })

  it('asks for a new decision against the target warning identity', () => {
    const entry = decision(waived(), `waiver:unresolved-required-${PRIMARY_SLOT}`)
    expect(entry.requiresExplicitConfirmation).toBe(true)
    expect(entry.kind === 'waiver' && entry.targetWarningId).toBe(
      `unresolved-required-${PRIMARY_SLOT}`,
    )
  })
})

describe('the proposed composition', () => {
  it('keeps a default-on module the source deliberately removed', () => {
    const proposal = proposeRebuildSelection({
      sourceInputs: inputs({
        input: { ...inputs().input, selectedModuleVersionIds: [] },
      }),
      sourceBundle: alpha,
      target: {
        slots: targetSlots,
        releaseBundle: bravo,
        offeredModules: [
          {
            moduleVersionId: FIXTURE_MODULE_V1_1,
            moduleCode: 'FIXTURE_CORE',
            moduleVersion: '1.1',
            selectionBehavior: 'default_on',
            definitionHash: bravo.modulePins[0].definitionHash,
          },
        ],
        allowedModifierCodes: [],
        modifierDefinitionHashes: {},
      },
    })
    // The source offered FIXTURE_CORE and the card did not select it. A target default must not
    // overturn a removal the physician made.
    expect(proposal.moduleVersionIds).toEqual([])
  })

  it('turns on a module the target introduces and defaults on', () => {
    const proposal = proposeRebuildSelection({
      sourceInputs: inputs({ input: { ...inputs().input, selectedModuleVersionIds: [] } }),
      sourceBundle: { ...alpha, modulePins: [] },
      target: {
        slots: targetSlots,
        releaseBundle: bravo,
        offeredModules: [
          {
            moduleVersionId: 'module-new-v1-0',
            moduleCode: 'NEW_MODULE',
            moduleVersion: '1.0',
            selectionBehavior: 'default_on',
            definitionHash: 'z'.repeat(64),
          },
        ],
        allowedModifierCodes: [],
        modifierDefinitionHashes: {},
      },
    })
    expect(proposal.moduleVersionIds).toEqual(['module-new-v1-0'])
  })

  it('reports a module whose pinned version moved as needing review', () => {
    const result = plan()
    const coreModule = decision(result, 'module:FIXTURE_CORE')
    expect(coreModule.state).toBe('carried_requires_review')
    expect(coreModule.reasonCodes).toContain('module_version_changed')
    // Required by the target composition, so it is reported and not asked about.
    expect(coreModule.requiresExplicitConfirmation).toBe(false)
  })
})

describe('the plan is deterministic and addressable', () => {
  it('produces byte-identical output for identical inputs', () => {
    expect(stableStringify(plan())).toBe(stableStringify(plan()))
    expect(rebuildPlanHash(plan())).toBe(rebuildPlanHash(plan()))
  })

  it('moves the hash when any decision moves', () => {
    // The card has to hold a selection for the probe answer to reach a decision at all — a plan
    // over a card that chose nothing is unaffected by what the room stocks.
    const withSelection = snapshot({
      items: [item({ id: PRIMARY_SLOT, selectedHospitalItemId: 'local-scope-1' })],
    })
    const before = rebuildPlanHash(plan({ card: withSelection }))
    const after = rebuildPlanHash(
      plan({ card: withSelection, probe: permissiveProbe({ hospitalItemOffered: () => false }) }),
    )
    expect(after).not.toBe(before)
  })

  it('covers the comparisons the review was taken against', () => {
    // These two are written into write-once provenance as *what was compared*. Outside the hash
    // they could move between the page rendering and the form posting, and the card would record a
    // comparison nobody was shown — the operational half reads current hospital-local data, which
    // is exactly the thing that moves underneath a card.
    const before = rebuildPlanHash(plan())
    const after = rebuildPlanHash(
      plan({ comparisons: { operationalHash: '9'.repeat(64), releaseDiffHash: '8'.repeat(64) } }),
    )
    expect(after).not.toBe(before)
  })

  it('covers the inputs it would write, not only the decisions', () => {
    const original = plan()
    const tampered: CardRebuildPlan = {
      ...original,
      proposedInputs: {
        ...original.proposedInputs,
        input: {
          ...original.proposedInputs.input,
          selectedHospitalItemIds: { [PRIMARY_SLOT]: 'an-item-nobody-chose' },
        },
      },
    }
    expect(rebuildPlanHash(tampered)).not.toBe(rebuildPlanHash(original))
  })

  it('always writes version-4 inputs pinned to the target release', () => {
    const result = plan()
    expect(result.proposedInputs.schemaVersion).toBe(4)
    expect(result.proposedInputs.releaseBundleId).toBe(BRAVO_RELEASE_ID)
    expect(result.proposedInputs.input.recipeVersionId).toBe(FIXTURE_RECIPE_V1_1)
    // Every carried selection is written down, so a re-ranked formulary cannot fill a gap later.
    expect(result.proposedInputs.input.selectionsAreExplicit).toBe(true)
  })
})

describe('the review gate', () => {
  it('refuses until every decision needing an answer has one', () => {
    const result = plan()
    const review = reviewRebuildAcknowledgements(result, {})
    expect(review.ok).toBe(false)
    expect(review.ok === false && review.missing).toContain(
      `requirement:${REVISED_REQUIREMENT_KEY}`,
    )
  })

  /** The same changed requirement, but carrying a real product rather than a deliberate blank. */
  function planWithCarriedProduct() {
    return plan({
      card: snapshot({
        items: [
          item({ id: PRIMARY_SLOT }),
          item({
            id: BACKUP_SLOT,
            requirementKey: REVISED_REQUIREMENT_KEY,
            requiredness: 'optional',
            effectiveRequiredness: 'optional',
            selectedHospitalItemId: 'local-backup-1',
          }),
        ],
      }),
    })
  }

  it('rejects an answer a decision does not allow', () => {
    const result = planWithCarriedProduct()
    const review = reviewRebuildAcknowledgements(result, {
      [`requirement:${REVISED_REQUIREMENT_KEY}`]: 'acknowledged_unresolved',
    })
    expect(review.ok).toBe(false)
    expect(review.ok === false && review.invalid).toContain(
      `requirement:${REVISED_REQUIREMENT_KEY}`,
    )
  })

  it('offers acknowledge-unresolved, not confirm or drop, for a carried deliberate blank', () => {
    // The source left this requirement blank on purpose and the target changed it, so an answer is
    // required — but there is no product to confirm and none to drop. Offering those two asked the
    // physician to affirm or discard something that does not exist, and whichever they chose was
    // written verbatim into immutable provenance as the answer they gave.
    const result = plan()
    const blank = decision(result, `requirement:${REVISED_REQUIREMENT_KEY}`)
    expect(blank.kind === 'requirement' && blank.carriedSelection).toEqual({ kind: 'none' })
    expect(blank.requiresExplicitConfirmation).toBe(true)
    expect(allowedAcknowledgements(blank)).toEqual(['acknowledged_unresolved'])

    expect(
      reviewRebuildAcknowledgements(result, {
        [`requirement:${REVISED_REQUIREMENT_KEY}`]: 'confirmed',
      }).ok,
    ).toBe(false)
    const accepted = reviewRebuildAcknowledgements(result, {
      [`requirement:${REVISED_REQUIREMENT_KEY}`]: 'acknowledged_unresolved',
    })
    expect(accepted.ok).toBe(true)
    // And acknowledging it manufactures no selection: the line stays an explicit nothing.
    const applied = applyRebuildAcknowledgements(result, {
      [`requirement:${REVISED_REQUIREMENT_KEY}`]: 'acknowledged_unresolved',
    })
    expect(applied.input.selectedHospitalItemIds?.[BACKUP_SLOT]).toBeNull()
  })

  it('rejects an answer naming a decision this plan does not contain', () => {
    const result = plan()
    const review = reviewRebuildAcknowledgements(result, {
      [`requirement:${REVISED_REQUIREMENT_KEY}`]: 'confirmed',
      'requirement:SOMETHING_FROM_YESTERDAYS_PLAN': 'confirmed',
    })
    expect(review.ok).toBe(false)
    expect(review.ok === false && review.unknown).toEqual([
      'requirement:SOMETHING_FROM_YESTERDAYS_PLAN',
    ])
  })

  it('offers no answer that would dispose of everything at once', () => {
    for (const entry of plan().decisions) {
      expect(allowedAcknowledgements(entry)).not.toContain('accept_all')
    }
  })

  it('only lets a requirement be dropped — never a module or a modifier', () => {
    const result = plan({
      inputs: inputs({ input: { ...inputs().input, modifierCodes: ['FIXTURE_MODIFIER'] } }),
      selection: { moduleVersionIds: [FIXTURE_MODULE_V1_1], modifierCodes: ['FIXTURE_MODIFIER'] },
      targetModifierHashes: { FIXTURE_MODIFIER: '0'.repeat(64) },
    })
    expect(allowedAcknowledgements(decision(result, 'modifier:FIXTURE_MODIFIER'))).toEqual([
      'confirmed',
    ])
    expect(
      allowedAcknowledgements(
        decision(planWithCarriedProduct(), `requirement:${REVISED_REQUIREMENT_KEY}`),
      ),
    ).toEqual(['confirmed', 'dropped'])
  })
})

describe('answers become the inputs the new card is built from', () => {
  it('clears a dropped requirement to an explicit nothing', () => {
    const result = plan({
      card: snapshot({
        items: [
          item({ id: PRIMARY_SLOT }),
          item({
            id: BACKUP_SLOT,
            requirementKey: REVISED_REQUIREMENT_KEY,
            requiredness: 'optional',
            effectiveRequiredness: 'optional',
            selectedHospitalItemId: 'local-backup-1',
          }),
        ],
      }),
    })
    const applied = applyRebuildAcknowledgements(result, {
      [`requirement:${REVISED_REQUIREMENT_KEY}`]: 'dropped',
    })
    expect(applied.input.selectedHospitalItemIds?.[BACKUP_SLOT]).toBeNull()
  })

  it('keeps a confirmed requirement exactly as the plan proposed it', () => {
    const result = plan({
      card: snapshot({
        items: [
          item({ id: PRIMARY_SLOT }),
          item({
            id: BACKUP_SLOT,
            requirementKey: REVISED_REQUIREMENT_KEY,
            requiredness: 'optional',
            effectiveRequiredness: 'optional',
            selectedHospitalItemId: 'local-backup-1',
          }),
        ],
      }),
    })
    const applied = applyRebuildAcknowledgements(result, {
      [`requirement:${REVISED_REQUIREMENT_KEY}`]: 'confirmed',
    })
    expect(applied.input.selectedHospitalItemIds?.[BACKUP_SLOT]).toBe('local-backup-1')
  })

  it('keeps a shared product when only one of the requirements using it is dropped', () => {
    // One physical product legitimately serves two requirements. Dropping one of them must not
    // take the record the other still points at with it.
    const sharedProduct = catalogPickItemId('PRD-ABC123')
    const result = plan({
      inputs: inputs({ catalogPicks: [{ productId: 'PRD-ABC123', roleCode: ROLE }] }),
      card: snapshot({
        items: [
          item({ id: PRIMARY_SLOT, selectedHospitalItemId: sharedProduct }),
          item({
            id: BACKUP_SLOT,
            requirementKey: REVISED_REQUIREMENT_KEY,
            requiredness: 'optional',
            effectiveRequiredness: 'optional',
            selectedHospitalItemId: sharedProduct,
          }),
        ],
      }),
    })
    const applied = applyRebuildAcknowledgements(result, {
      [`requirement:${REVISED_REQUIREMENT_KEY}`]: 'dropped',
    })
    expect(applied.catalogPicks).toHaveLength(1)
    expect(applied.input.selectedHospitalItemIds?.[PRIMARY_SLOT]).toBe(sharedProduct)
    expect(applied.input.selectedHospitalItemIds?.[BACKUP_SLOT]).toBeNull()
  })
})

describe('an ambiguous requirement key blocks rather than choosing', () => {
  /** Two target slots claiming one key, disagreeing about what the requirement is. */
  function ambiguousTargetSlots() {
    const conflicting = {
      ...targetSlots.find((slot) => slot.requirementKey === PRIMARY_KEY)!,
      id: 'SLOT-FIXTURE-PRIMARY-DUPLICATE',
      requiredness: 'optional' as const,
      label: 'Primary scope, expressed a second way',
    }
    return [...targetSlots, conflicting]
  }

  function ambiguousPlan() {
    return planCardRebuild({
      source: {
        cardId: 'c',
        revisionId: 'r',
        revisionNumber: 1,
        inputs: inputs(),
        card: snapshot({
          items: [item({ id: PRIMARY_SLOT, selectedHospitalItemId: 'local-scope-1' })],
        }),
        slots: sourceSlots,
        releaseBundle: alpha,
        modifierDefinitionHashes: {},
      },
      target: {
        slots: ambiguousTargetSlots(),
        releaseBundle: bravo,
        offeredModules: [],
        allowedModifierCodes: [],
        modifierDefinitionHashes: {},
      },
      selection: { moduleVersionIds: [], modifierCodes: [] },
      comparisons: { operationalHash: '7'.repeat(64), releaseDiffHash: '8'.repeat(64) },
      probe: permissiveProbe(),
    })
  }

  it('refuses to pick one of two slots claiming the same requirement', () => {
    const primary = decision(ambiguousPlan(), `requirement:${PRIMARY_KEY}`)
    expect(primary.state).toBe('incompatible')
    expect(primary.reasonCodes).toContain('requirement_key_ambiguous')
    expect(primary.blocking).toBe(true)
  })

  it('carries nothing for it, rather than carrying onto whichever sorted first', () => {
    const result = ambiguousPlan()
    expect(result.proposedInputs.input.selectedHospitalItemIds).not.toHaveProperty(PRIMARY_SLOT)
    expect(result.proposedInputs.input.selectedHospitalItemIds).not.toHaveProperty(
      'SLOT-FIXTURE-PRIMARY-DUPLICATE',
    )
  })

  it('is unanswerable, so no acknowledgement can dispose of it', () => {
    const result = ambiguousPlan()
    const primary = decision(result, `requirement:${PRIMARY_KEY}`)
    expect(primary.requiresExplicitConfirmation).toBe(false)
    expect(unanswerableBlockingDecisions(result).map((entry) => entry.key)).toContain(
      `requirement:${PRIMARY_KEY}`,
    )
    // The review gate never asks about it, which is exactly why the server checks both: answering
    // every question the gate does ask would otherwise be enough to create the card.
    const review = reviewRebuildAcknowledgements(result, {})
    expect(review.ok === false && review.missing).not.toContain(`requirement:${PRIMARY_KEY}`)
    expect(review.ok === false && review.invalid).not.toContain(`requirement:${PRIMARY_KEY}`)
  })

  it('blocks even when the second expression agrees on every compared field', () => {
    const duplicated = [
      ...targetSlots,
      {
        ...targetSlots.find((slot) => slot.requirementKey === PRIMARY_KEY)!,
        id: 'SLOT-FIXTURE-PRIMARY-COPY',
      },
    ]
    const result = planCardRebuild({
      source: {
        cardId: 'c',
        revisionId: 'r',
        revisionNumber: 1,
        inputs: inputs(),
        card: snapshot({
          items: [item({ id: PRIMARY_SLOT, selectedHospitalItemId: 'local-scope-1' })],
        }),
        slots: sourceSlots,
        releaseBundle: alpha,
        modifierDefinitionHashes: {},
      },
      target: {
        slots: duplicated,
        releaseBundle: bravo,
        offeredModules: [],
        allowedModifierCodes: [],
        modifierDefinitionHashes: {},
      },
      selection: { moduleVersionIds: [], modifierCodes: [] },
      comparisons: { operationalHash: '7'.repeat(64), releaseDiffHash: '8'.repeat(64) },
      probe: permissiveProbe(),
    })
    // The resolver emits both slots because their ids differ, so collapsing here would mean one
    // decision, one re-keyed selection, and a second permanently empty line nobody reviewed.
    expect(decision(result, `requirement:${PRIMARY_KEY}`).state).toBe('incompatible')
    expect(decision(result, `requirement:${PRIMARY_KEY}`).reasonCodes).toContain(
      'requirement_key_ambiguous',
    )
  })
})

describe('the plan describes the card the target actually resolves to', () => {
  /** A resolved target in which the carried selection is rejected by a compatibility rule. */
  function incompatibleTarget(): ResolvedCard {
    return snapshot({
      items: [
        item({
          id: PRIMARY_SLOT,
          requirementKey: PRIMARY_KEY,
          selectedHospitalItemId: 'local-scope-1',
          compatibilityState: 'fail',
        }),
      ],
      warnings: [
        {
          id: 'compatibility-1',
          severity: 'blocking',
          code: 'compatibility_failed',
          message: 'The chosen scope is too large for the chosen sheath.',
          sourceType: 'compatibility_rule',
          sourceId: 'rule-1',
          acknowledged: false,
          waiverReason: null,
        },
      ],
      readinessState: 'blocked',
    })
  }

  const carriedCard = () =>
    snapshot({ items: [item({ id: PRIMARY_SLOT, selectedHospitalItemId: 'local-scope-1' })] })

  it('does not call a selection carried unchanged when the target rejects it', () => {
    const result = plan({
      card: carriedCard(),
      probe: permissiveProbe({ resolveTarget: () => incompatibleTarget() }),
    })
    const primary = decision(result, `requirement:${PRIMARY_KEY}`)

    // Identity and availability both held, so the old planner said carried_unchanged and asked
    // nothing — and the card was inserted blocked with provenance claiming it was unchanged.
    expect(primary.state).toBe('incompatible')
    expect(primary.reasonCodes).toContain('compatibility_rejected')
    expect(primary.requiresExplicitConfirmation).toBe(true)
  })

  it('records the final resolution in the plan, and hashes it', () => {
    const clean = plan({ card: carriedCard() })
    const rejected = plan({
      card: carriedCard(),
      probe: permissiveProbe({ resolveTarget: () => incompatibleTarget() }),
    })

    expect(rejected.targetResolution.ok).toBe(true)
    expect(rejected.targetResolution.readinessState).toBe('blocked')
    expect(rejected.targetResolution.warnings.map((warning) => warning.code)).toContain(
      'compatibility_failed',
    )
    expect(rebuildPlanHash(rejected)).not.toBe(rebuildPlanHash(clean))
  })

  it('surfaces a missing room capability against the modifier that requires it', () => {
    const capabilityMissing = snapshot({
      warnings: [
        {
          id: 'capability-1',
          severity: 'blocking',
          code: 'room_capability_missing',
          message: 'Required room capability is not mapped at this location.',
          sourceType: 'room_capability',
          sourceId: 'fluoroscopy',
          acknowledged: false,
          waiverReason: null,
        },
      ],
      readinessState: 'blocked',
    })
    const result = plan({
      inputs: inputs({ input: { ...inputs().input, modifierCodes: ['FIXTURE_MODIFIER'] } }),
      selection: { moduleVersionIds: [FIXTURE_MODULE_V1_1], modifierCodes: ['FIXTURE_MODIFIER'] },
      probe: permissiveProbe({ resolveTarget: () => capabilityMissing }),
    })

    const modifier = decision(result, 'modifier:FIXTURE_MODIFIER')
    expect(modifier.reasonCodes).toContain('room_capability_missing')
    expect(modifier.requiresExplicitConfirmation).toBe(true)
  })

  it('reports a requirement the target suppresses behind a kit', () => {
    const suppressed = snapshot({
      items: [],
      suppressedItems: [
        item({
          id: PRIMARY_SLOT,
          requirementKey: PRIMARY_KEY,
          selectedHospitalItemId: 'local-scope-1',
        }),
      ],
    })
    const result = plan({
      card: carriedCard(),
      probe: permissiveProbe({ resolveTarget: () => suppressed }),
    })
    expect(decision(result, `requirement:${PRIMARY_KEY}`).reasonCodes).toContain(
      'target_presence_changed',
    )
  })

  it('reports a requirement the source suppressed and the target pulls', () => {
    // The reverse direction, which passed in silence: source equipment set A suppresses source
    // requirement B; the target cannot carry A because a member is gone; B therefore resolves
    // active and carries B's product. The new draft would then contain an active, selected
    // requirement the reviewed source had suppressed, with nothing said about it.
    const sourceSuppressed = snapshot({
      items: [],
      suppressedItems: [
        item({
          id: PRIMARY_SLOT,
          requirementKey: PRIMARY_KEY,
          selectedHospitalItemId: 'local-scope-1',
        }),
      ],
    })
    const targetActive = snapshot({
      items: [
        item({
          id: PRIMARY_SLOT,
          requirementKey: PRIMARY_KEY,
          selectedHospitalItemId: 'local-scope-1',
        }),
      ],
      suppressedItems: [],
    })
    const result = plan({
      card: sourceSuppressed,
      probe: permissiveProbe({ resolveTarget: () => targetActive }),
    })
    const primary = decision(result, `requirement:${PRIMARY_KEY}`)
    expect(primary.kind === 'requirement' && primary.source?.presence).toBe('suppressed')
    expect(primary.reasonCodes).toContain('target_presence_changed')
    expect(primary.requiresExplicitConfirmation).toBe(true)
  })

  it('leaves a requirement suppressed on both sides quiet', () => {
    // The control for the two directions above: unchanged presence is not a change, and reporting
    // it would put every kit-covered line of every card on the review list.
    const suppressed = snapshot({
      items: [],
      suppressedItems: [
        item({
          id: PRIMARY_SLOT,
          requirementKey: PRIMARY_KEY,
          selectedHospitalItemId: 'local-scope-1',
        }),
      ],
    })
    const result = plan({
      card: suppressed,
      probe: permissiveProbe({ resolveTarget: () => suppressed }),
    })
    expect(decision(result, `requirement:${PRIMARY_KEY}`).reasonCodes).not.toContain(
      'target_presence_changed',
    )
  })

  /** The card the plan projected, resolved again with nothing moved. The authorized outcome. */
  function carriedTarget(): ResolvedCard {
    return snapshot({
      items: [
        item({
          id: PRIMARY_SLOT,
          requirementKey: PRIMARY_KEY,
          selectedHospitalItemId: 'local-scope-1',
        }),
      ],
    })
  }

  /** Confirm every asked decision, so `expectedFinalState` allows exactly the projection. */
  function confirmAll(result: ReturnType<typeof plan>): Record<string, RebuildAcknowledgement> {
    const answers: Record<string, RebuildAcknowledgement> = {}
    for (const entry of result.decisions) {
      if (!entry.requiresExplicitConfirmation) continue
      answers[entry.key] = allowedAcknowledgements(entry)[0]
    }
    return answers
  }

  function reviewedPlan() {
    return plan({ card: carriedCard(), probe: permissiveProbe({ resolveTarget: carriedTarget }) })
  }

  it('accepts the card the review authorized', () => {
    const reviewed = reviewedPlan()
    const expected = expectedFinalState(reviewed, confirmAll(reviewed))
    expect(unauthorizedFinalState(expected, carriedTarget())).toEqual([])
  })

  it('refuses a finished card carrying a blocking condition the review never showed', () => {
    const reviewed = reviewedPlan()
    const expected = expectedFinalState(reviewed, confirmAll(reviewed))
    expect(unauthorizedFinalState(expected, incompatibleTarget())).toContain(
      'unreviewed_blocking_warning:compatibility_failed',
    )
  })

  it('accepts a blocking condition that was in the projection the physician read', () => {
    const reviewed = plan({
      card: carriedCard(),
      probe: permissiveProbe({ resolveTarget: () => incompatibleTarget() }),
    })
    const expected = expectedFinalState(reviewed, confirmAll(reviewed))
    // Same condition, and it was reviewed — so it is not a reason to refuse the write.
    expect(unauthorizedFinalState(expected, incompatibleTarget())).toEqual([])
  })

  /**
   * The mutation matrix the previous invariant accepted in full.
   *
   * It compared blocking warning signatures only, so every one of these — a different product on
   * the line, a different slot id, a different role, a requirement that vanished, one that
   * appeared, a newly suppressed line, a newly failing compatibility state, a moved readiness, a
   * new nonblocking warning — passed as though it had been reviewed.
   */
  it.each([
    [
      'selection_changed',
      () =>
        snapshot({ items: [item({ id: PRIMARY_SLOT, selectedHospitalItemId: 'local-other' })] }),
    ],
    [
      'slot_changed',
      () =>
        snapshot({
          items: [
            item({
              id: 'slot-renamed',
              requirementKey: PRIMARY_KEY,
              selectedHospitalItemId: 'local-scope-1',
            }),
          ],
        }),
    ],
    [
      'role_changed',
      () =>
        snapshot({
          items: [
            item({
              id: PRIMARY_SLOT,
              roleCode: 'OTHER_ROLE',
              selectedHospitalItemId: 'local-scope-1',
            }),
          ],
        }),
    ],
    ['requirement_missing', () => snapshot({ items: [] })],
    [
      'requirement_outside_plan',
      () =>
        snapshot({
          items: [
            item({ id: PRIMARY_SLOT, selectedHospitalItemId: 'local-scope-1' }),
            item({ id: 'slot-extra', requirementKey: 'INVENTED_KEY' }),
          ],
        }),
    ],
    [
      'presence_changed',
      () =>
        snapshot({
          items: [],
          suppressedItems: [
            item({
              id: PRIMARY_SLOT,
              requirementKey: PRIMARY_KEY,
              selectedHospitalItemId: 'local-scope-1',
            }),
          ],
        }),
    ],
    [
      'compatibility_changed',
      () =>
        snapshot({
          items: [
            item({
              id: PRIMARY_SLOT,
              selectedHospitalItemId: 'local-scope-1',
              compatibilityState: 'fail',
            }),
          ],
        }),
    ],
    [
      'resolution_changed',
      () =>
        snapshot({
          items: [
            item({
              id: PRIMARY_SLOT,
              selectedHospitalItemId: 'local-scope-1',
              resolutionState: 'unresolved',
            }),
          ],
        }),
    ],
    ['readiness_changed', () => snapshot({ ...carriedTarget(), readinessState: 'blocked' })],
    [
      'unreviewed_warning',
      () =>
        snapshot({
          ...carriedTarget(),
          warnings: [
            {
              id: 'note-1',
              severity: 'warning',
              code: 'required_role_unresolved',
              message: 'No product is selected yet.',
              sourceType: 'slot',
              sourceId: PRIMARY_SLOT,
              acknowledged: false,
              waiverReason: null,
            },
          ],
        }),
    ],
  ])('refuses a card whose %s was never authorized', (axis, mutate) => {
    const reviewed = reviewedPlan()
    const expected = expectedFinalState(reviewed, confirmAll(reviewed))
    const violations = unauthorizedFinalState(expected, mutate())
    expect(violations.some((violation) => violation.startsWith(axis))).toBe(true)
  })

  /**
   * A plan with a droppable decision: the backup requirement's definition moved between the two
   * releases, so it is asked about, and it carries a real product — which is what makes `dropped`
   * one of its legal answers.
   */
  function droppablePlan() {
    const both = (selection: string | null, overrides: Partial<ResolvedCardItem> = {}) =>
      snapshot({
        items: [
          item({ id: PRIMARY_SLOT, selectedHospitalItemId: 'local-scope-1' }),
          item({
            id: BACKUP_SLOT,
            requirementKey: REVISED_REQUIREMENT_KEY,
            requiredness: 'optional',
            effectiveRequiredness: 'optional',
            selectedHospitalItemId: selection,
            ...overrides,
          }),
        ],
      })
    const result = plan({
      card: both('local-backup-1'),
      probe: permissiveProbe({ resolveTarget: () => both('local-backup-1') }),
    })
    const backup = decision(result, `requirement:${REVISED_REQUIREMENT_KEY}`)
    const answers: Record<string, RebuildAcknowledgement> = {
      ...confirmAll(result),
      [backup.key]: 'dropped',
    }
    return { result, answers, backup, both }
  }

  it('does not treat a warning introduced by the physician answering as unauthorized', () => {
    // Dropping a selection is a reviewed decision and raises a warning by design. An invariant that
    // refused this would have made the drop control unusable.
    const { result, answers, backup, both } = droppablePlan()
    expect(backup.requiresExplicitConfirmation).toBe(true)
    expect(allowedAcknowledgements(backup)).toContain('dropped')

    const droppedResult = snapshot({
      ...both(null, { resolutionState: 'warning' }),
      warnings: [
        {
          id: 'unresolved-1',
          severity: 'warning',
          code: 'required_role_unresolved',
          message: 'No product is selected yet.',
          sourceType: 'slot',
          sourceId: BACKUP_SLOT,
          acknowledged: false,
          waiverReason: null,
        },
      ],
      readinessState: 'complete_with_warnings',
    })
    expect(unauthorizedFinalState(expectedFinalState(result, answers), droppedResult)).toEqual([])
  })

  it('still refuses a dropped selection that survived into the finished card', () => {
    const { result, answers, both } = droppablePlan()
    // A mapping or application defect that left the product in place would otherwise write a card
    // carrying the very selection the physician discarded.
    expect(
      unauthorizedFinalState(expectedFinalState(result, answers), both('local-backup-1')),
    ).toEqual([`selection_not_cleared:${REVISED_REQUIREMENT_KEY}`])
  })

  it('will not let a drop justify a newly suppressed line or a new compatibility failure', () => {
    const { result, answers } = droppablePlan()
    const expected = expectedFinalState(result, answers)

    // Clearing a selection removes a kit, so it can only *lift* suppression; and it removes one
    // half of a compatibility pair, so it can only stop a rule matching. Neither of these follows.
    const nowSuppressed = snapshot({
      items: [item({ id: PRIMARY_SLOT, selectedHospitalItemId: 'local-scope-1' })],
      suppressedItems: [
        item({
          id: BACKUP_SLOT,
          requirementKey: REVISED_REQUIREMENT_KEY,
          requiredness: 'optional',
          effectiveRequiredness: 'optional',
          selectedHospitalItemId: null,
        }),
      ],
    })
    expect(unauthorizedFinalState(expected, nowSuppressed)).toContain(
      `presence_changed:${REVISED_REQUIREMENT_KEY}`,
    )

    const nowIncompatible = snapshot({
      items: [
        item({
          id: PRIMARY_SLOT,
          selectedHospitalItemId: 'local-scope-1',
          compatibilityState: 'fail',
        }),
        item({
          id: BACKUP_SLOT,
          requirementKey: REVISED_REQUIREMENT_KEY,
          requiredness: 'optional',
          effectiveRequiredness: 'optional',
          selectedHospitalItemId: null,
        }),
      ],
    })
    expect(unauthorizedFinalState(expected, nowIncompatible)).toContain(
      `compatibility_changed:${PRIMARY_KEY}`,
    )
  })
})

describe('planning writes nothing', () => {
  it('leaves the source revision, its snapshot, and its inputs untouched', () => {
    const sourceInputs = inputs({
      catalogPicks: [{ productId: 'PRD-ABC123', roleCode: ROLE }],
    })
    const sourceCard = snapshot({
      items: [item({ id: PRIMARY_SLOT, selectedHospitalItemId: catalogPickItemId('PRD-ABC123') })],
    })
    const inputsBefore = stableStringify(sourceInputs)
    const cardBefore = stableStringify(sourceCard)
    const slotsBefore = stableStringify(sourceSlots)

    plan({ inputs: sourceInputs, card: sourceCard })

    expect(stableStringify(sourceInputs)).toBe(inputsBefore)
    expect(stableStringify(sourceCard)).toBe(cardBefore)
    expect(stableStringify(sourceSlots)).toBe(slotsBefore)
  })
})
