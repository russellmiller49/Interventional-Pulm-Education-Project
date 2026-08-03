import {
  buildContextForRecipe,
  buildDemoContext,
  defaultBuildInput,
  getScenarioDefinition,
} from '../data/demo-context.server'
import { getRetainedReleaseBundles } from '../data/release-bundles.server'
import { resolvedContentHash } from '../domain/card-hashes'
import { evaluateCompatibilityRules } from '../domain/evaluate-compatibility'
import { expandRecipeComposition } from '../domain/expand-recipe-composition'
import { suppressKitDuplicates } from '../domain/kit-suppression'
import { PREFERENCE_CARD_RESOLVER_CONTRACT_VERSION, resolveCard } from '../domain/resolve-card'
import { validateReleaseBundles } from '../domain/release-bundle'
import { OPERATIONAL_SLOT_SEQUENCE_BASE } from '../seed/operational'
import type {
  BuildContext,
  HospitalItem,
  ModifierDefinition,
  RecipeModuleVersion,
  RecipeSlot,
  RecipeVersion,
  ResolvedCardItem,
  TypedCompatibilityRule,
} from '../domain/types'
import {
  BRAVO_RELEASE_ID,
  FIXTURE_PROCEDURE_CODE,
  createFixtureReleaseWorld,
} from '../__fixtures__/release-bundle-fixtures'

/**
 * The resolver contract, `ip-cards-resolver-contract/1`, as one readable index.
 *
 * A release bundle records the contract version it was published against, and a card pinned to that
 * release is only reconstructable while the contract holds. That makes the string a promise, and a
 * promise needs somewhere it is written down in a form a reviewer can read end to end. The
 * behaviours are also covered by the suites that own each mechanism — composition, kit suppression,
 * compatibility, retention — and those remain the detailed tests. This is the contract itself: one
 * clause per `it`, each named as the guarantee rather than as the implementation detail that
 * happens to deliver it.
 *
 * What a change here means: if a clause below has to be edited to make the suite pass, the contract
 * moved and `PREFERENCE_CARD_RESOLVER_CONTRACT_VERSION` must move with it. A refactor that leaves
 * every clause standing is a refactor, whatever it did to the source digest.
 */

const CONTRACT = 'ip-cards-resolver-contract/1'
const SCENARIO_ID = 'ebus-rose-molecular'

// ---------------------------------------------------------------------------------------------
// A synthetic world, so each clause can be shown in isolation rather than inferred from a card
// with fifty-seven lines on it.
// ---------------------------------------------------------------------------------------------

function slot(
  overrides: Partial<RecipeSlot> & Pick<RecipeSlot, 'id' | 'requirementKey'>,
): RecipeSlot {
  return {
    sourceSlotId: overrides.id,
    roleCode: 'CONTRACT_ROLE',
    label: 'Contract requirement',
    genericRequirement: 'A requirement that exists only in this suite.',
    requiredness: 'required',
    dependencyRule: null,
    quantityExpression: { op: 'literal', value: 1 },
    selectionMode: 'single',
    setupZone: 'back_table',
    proceduralPhase: 'airway_access',
    setupSequence: 1,
    openHoldStatus: 'open_or_set_up_now',
    responsibleRole: null,
    sterileStatus: null,
    allowCustom: false,
    notes: null,
    includedBy: 'Included by contract fixture',
    ...overrides,
  }
}

function moduleVersion(id: string, slots: RecipeSlot[]): RecipeModuleVersion {
  return {
    id,
    code: id.toUpperCase(),
    name: id,
    description: 'Synthetic.',
    version: '1.0',
    kind: 'core',
    governanceState: 'draft',
    clinicalOwner: null,
    operationalOwner: null,
    catalogImportId: 'contract-fixture',
    slots,
  }
}

function recipe(
  moduleReferences: RecipeVersion['moduleReferences'],
  overrides: Partial<RecipeVersion> = {},
): RecipeVersion {
  return {
    id: 'recipe-contract-v1',
    sourceProcedureCode: 'CONTRACT',
    sourceTemplateVersion: '1.0',
    name: 'Contract fixture',
    version: '1.0',
    governanceState: 'draft',
    clinicalOwner: null,
    operationalOwner: null,
    allowedModifierCodes: [],
    catalogImportId: 'contract-fixture',
    slots: [],
    moduleReferences,
    compositionActions: [],
    requirementSequences: {},
    ...overrides,
  }
}

function context(overrides: Partial<BuildContext> & Pick<BuildContext, 'recipe'>): BuildContext {
  return {
    organizationName: 'Contract',
    siteName: 'Contract',
    locationName: 'Contract',
    locationCapabilities: [],
    releaseIdentity: null,
    recipeModules: [],
    modifiers: [],
    rescueModules: [],
    hospitalItems: [],
    hospitalRoleOptions: [],
    compatibilityRules: [],
    preferenceOverlays: [],
    ...overrides,
  }
}

function item(id: string, overrides: Partial<HospitalItem> = {}): HospitalItem {
  return {
    id,
    organizationId: 'org',
    siteId: 'site',
    locationId: 'loc',
    itemType: 'commercial_product',
    roleCode: 'CONTRACT_ROLE',
    catalogProduct: null,
    localItemNumber: null,
    localDescription: id,
    localUom: null,
    storageLocation: null,
    verificationState: 'locally_approved',
    active: true,
    notes: null,
    attributes: {},
    kitComponents: [],
    ...overrides,
  }
}

function resolvedItem(overrides: Partial<ResolvedCardItem> & Pick<ResolvedCardItem, 'id'>) {
  return {
    sourceSlotId: overrides.id,
    requirementKey: overrides.id,
    roleCode: 'CONTRACT_ROLE',
    label: overrides.id,
    genericRequirement: '',
    requiredness: 'required' as const,
    effectiveRequiredness: 'required' as const,
    dependencyRule: null,
    conditionalState: null,
    quantityDisplay: '1',
    setupZone: 'back_table' as const,
    proceduralPhase: 'airway_access' as const,
    setupSequence: 1,
    openHoldStatus: 'open_or_set_up_now' as const,
    selectedHospitalItemId: null,
    selectedCatalogProductId: null,
    selectedItemSnapshot: null,
    resolutionState: 'resolved' as const,
    verificationState: 'locally_approved' as const,
    compatibilityState: 'not_evaluated' as const,
    rationale: null,
    whyIncluded: [],
    notes: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------------------------

describe(`resolver contract ${CONTRACT} — composition`, () => {
  it('declares the contract version the running code implements', () => {
    expect(PREFERENCE_CARD_RESOLVER_CONTRACT_VERSION).toBe(CONTRACT)
  })

  it('CLAUSE: a required module cannot be omitted from a card', () => {
    const core = moduleVersion('core', [slot({ id: 'S-CORE', requirementKey: 'K_CORE' })])
    const composed = recipe([
      { moduleVersionId: 'core', selectionBehavior: 'required', sequence: 10 },
    ])

    // The caller asks for nothing at all; the required module is included regardless.
    const expansion = expandRecipeComposition({
      recipe: composed,
      modules: [core],
      selectedModuleVersionIds: [],
      startSequence: 1,
    })
    expect(expansion.slots.map((entry) => entry.requirementKey)).toEqual(['K_CORE'])
    expect(expansion.includedModules[0].selectionSource).toBe('required')
  })

  it('CLAUSE: a module the composition does not offer is rejected, not honoured', () => {
    const core = moduleVersion('core', [slot({ id: 'S-CORE', requirementKey: 'K_CORE' })])
    const stranger = moduleVersion('stranger', [slot({ id: 'S-X', requirementKey: 'K_X' })])
    const composed = recipe([
      { moduleVersionId: 'core', selectionBehavior: 'required', sequence: 10 },
    ])

    const expansion = expandRecipeComposition({
      recipe: composed,
      modules: [core, stranger],
      selectedModuleVersionIds: ['stranger'],
      startSequence: 1,
    })
    expect(expansion.slots.map((entry) => entry.requirementKey)).toEqual(['K_CORE'])
    expect(expansion.messages.map((message) => message.code)).toContain(
      'recipe_composition_unknown_module',
    )
  })

  it('CLAUSE: duplicate requirements collapse only when semantically equivalent', () => {
    const shared = slot({ id: 'S-A', requirementKey: 'K_SHARED' })
    const one = moduleVersion('one', [shared])
    const two = moduleVersion('two', [{ ...shared, id: 'S-B', sourceSlotId: 'S-B' }])
    const composed = recipe([
      { moduleVersionId: 'one', selectionBehavior: 'required', sequence: 10 },
      { moduleVersionId: 'two', selectionBehavior: 'required', sequence: 20 },
    ])

    const expansion = expandRecipeComposition({
      recipe: composed,
      modules: [one, two],
      selectedModuleVersionIds: [],
      startSequence: 1,
    })
    expect(expansion.slots).toHaveLength(1)
    // Collapsed, and carrying provenance from both rather than pretending one module authored it.
    expect(expansion.slots[0].sourceModuleVersionIds).toEqual(['one', 'two'])
    expect(expansion.messages.filter((message) => message.severity === 'blocking')).toEqual([])
  })

  it('CLAUSE: conflicting duplicate requirements block rather than last-write-wins', () => {
    const one = moduleVersion('one', [slot({ id: 'S-A', requirementKey: 'K_SHARED' })])
    const two = moduleVersion('two', [
      slot({ id: 'S-B', requirementKey: 'K_SHARED', requiredness: 'backup' }),
    ])
    const composed = recipe([
      { moduleVersionId: 'one', selectionBehavior: 'required', sequence: 10 },
      { moduleVersionId: 'two', selectionBehavior: 'required', sequence: 20 },
    ])

    const expansion = expandRecipeComposition({
      recipe: composed,
      modules: [one, two],
      selectedModuleVersionIds: [],
      startSequence: 1,
    })
    const blocking = expansion.messages.filter((message) => message.severity === 'blocking')
    expect(blocking.map((message) => message.code)).toContain('recipe_composition_conflict')
  })

  it('CLAUSE: role equality alone never deduplicates two requirements', () => {
    // Same role, different reviewed requirement keys: two lines, because the same role legitimately
    // appears twice on a card and two procedures can want it in materially different ways.
    const one = moduleVersion('one', [slot({ id: 'S-A', requirementKey: 'K_ONE' })])
    const two = moduleVersion('two', [slot({ id: 'S-B', requirementKey: 'K_TWO' })])
    const composed = recipe([
      { moduleVersionId: 'one', selectionBehavior: 'required', sequence: 10 },
      { moduleVersionId: 'two', selectionBehavior: 'required', sequence: 20 },
    ])

    const expansion = expandRecipeComposition({
      recipe: composed,
      modules: [one, two],
      selectedModuleVersionIds: [],
      startSequence: 1,
    })
    expect(expansion.slots).toHaveLength(2)
    expect(new Set(expansion.slots.map((entry) => entry.roleCode)).size).toBe(1)
  })
})

describe(`resolver contract ${CONTRACT} — selection`, () => {
  const core = moduleVersion('core', [slot({ id: 'S-CORE', requirementKey: 'K_CORE' })])
  const composed = recipe([
    { moduleVersionId: 'core', selectionBehavior: 'required', sequence: 10 },
  ])
  const baseContext = context({
    recipe: composed,
    recipeModules: [core],
    hospitalItems: [item('item-preferred'), item('item-other')],
    hospitalRoleOptions: [
      {
        id: 'option-preferred',
        roleCode: 'CONTRACT_ROLE',
        hospitalItemId: 'item-preferred',
        preferenceRank: 1,
        substitutionClass: 'preferred',
        noSubstitute: false,
        active: true,
        rationale: null,
      },
      {
        id: 'option-other',
        roleCode: 'CONTRACT_ROLE',
        hospitalItemId: 'item-other',
        preferenceRank: 5,
        substitutionClass: 'acceptable',
        noSubstitute: false,
        active: true,
        rationale: null,
      },
    ],
  })

  const baseInput = {
    organizationId: 'org',
    siteId: 'site',
    locationId: 'loc',
    recipeVersionId: composed.id,
    selectedModuleVersionIds: ['core'],
    modifierCodes: [],
    variables: {},
  }

  it('CLAUSE: an exact item selection overrides local preference ranking', () => {
    const card = resolveCard(
      {
        ...baseInput,
        selectionsAreExplicit: true,
        selectedHospitalItemIds: { 'S-CORE': 'item-other' },
      },
      baseContext,
    )
    expect(card.items[0].selectedHospitalItemId).toBe('item-other')
  })

  it('CLAUSE: an explicit null stays null and is not re-defaulted', () => {
    const card = resolveCard(
      {
        ...baseInput,
        selectionsAreExplicit: true,
        selectedHospitalItemIds: { 'S-CORE': null },
      },
      baseContext,
    )
    expect(card.items[0].selectedHospitalItemId).toBeNull()
  })

  it('CLAUSE: with explicit selections, an absent key means "not chosen" rather than "rank first"', () => {
    const card = resolveCard(
      { ...baseInput, selectionsAreExplicit: true, selectedHospitalItemIds: {} },
      baseContext,
    )
    expect(card.items[0].selectedHospitalItemId).toBeNull()
  })

  it('CLAUSE: a required requirement with nothing selected warns rather than blocking', () => {
    // A blocking answer would make most procedures unbuildable, since many roles have no
    // catalogued product and are covered by a custom line instead. The card is unfinished, not
    // conflicted, and the readiness state says so.
    const card = resolveCard(
      { ...baseInput, selectionsAreExplicit: true, selectedHospitalItemIds: {} },
      baseContext,
    )
    const message = card.warnings.find((warning) => warning.code === 'required_role_unresolved')
    expect(message?.severity).toBe('warning')
    expect(card.items[0].resolutionState).toBe('warning')
    expect(card.readinessState).toBe('complete_with_warnings')
  })
})

describe(`resolver contract ${CONTRACT} — modifiers and rescue`, () => {
  const core = moduleVersion('core', [
    slot({ id: 'S-CORE', requirementKey: 'K_CORE', notes: null }),
  ])

  function modifier(code: string, sequence: number, note: string): ModifierDefinition {
    return {
      code,
      name: code,
      groupCode: 'imaging_navigation',
      description: 'Synthetic.',
      releaseState: 'mvp',
      active: true,
      appliesTo: 'CONTRACT',
      preview: [],
      conflictsWith: [],
      actions: [
        {
          id: `${code}-note`,
          modifierCode: code,
          sequence,
          actionType: 'append_note',
          targetRequirementKey: 'K_CORE',
          payload: { note },
        },
      ],
    }
  }

  it('CLAUSE: modifier actions apply in a deterministic order, whatever order they were selected in', () => {
    const composed = recipe(
      [{ moduleVersionId: 'core', selectionBehavior: 'required', sequence: 10 }],
      { allowedModifierCodes: ['ZULU', 'ALFA'] },
    )
    const modifiers = [modifier('ZULU', 10, 'zulu'), modifier('ALFA', 20, 'alfa')]
    const build = (modifierCodes: string[]) =>
      resolveCard(
        {
          organizationId: 'org',
          siteId: 'site',
          locationId: 'loc',
          recipeVersionId: composed.id,
          selectedModuleVersionIds: ['core'],
          modifierCodes,
          variables: {},
        },
        context({ recipe: composed, recipeModules: [core], modifiers }),
      )

    // Sequence decides, not selection order — so the lower `sequence` note lands first both times.
    expect(build(['ZULU', 'ALFA']).items[0].notes).toBe('zulu alfa')
    expect(build(['ALFA', 'ZULU']).items[0].notes).toBe('zulu alfa')
  })

  it('CLAUSE: an unauthorized modifier never enters the context in the first place', () => {
    // The picker hiding a control has never been a security boundary. The release pins which
    // modifiers a procedure offers, and the context is built from that permission.
    const scenario = getScenarioDefinition(SCENARIO_ID)!
    const built = buildDemoContext(SCENARIO_ID)
    expect(built.recipe.allowedModifierCodes).toEqual([...scenario.availableModifierCodes].sort())
    for (const available of built.modifiers) {
      expect(built.recipe.allowedModifierCodes).toContain(available.code)
    }
    // A composition that authored no modifier targets offers none at all.
    expect(buildDemoContext('custom-composition').modifiers).toEqual([])
  })

  it('CLAUSE: an unknown or inactive modifier code blocks rather than being ignored', () => {
    const composed = recipe(
      [{ moduleVersionId: 'core', selectionBehavior: 'required', sequence: 10 }],
      { allowedModifierCodes: ['GHOST'] },
    )
    const card = resolveCard(
      {
        organizationId: 'org',
        siteId: 'site',
        locationId: 'loc',
        recipeVersionId: composed.id,
        selectedModuleVersionIds: ['core'],
        modifierCodes: ['GHOST'],
        variables: {},
      },
      context({ recipe: composed, recipeModules: [core], modifiers: [] }),
    )
    expect(card.warnings.map((warning) => warning.code)).toContain('unknown_modifier')
    expect(card.readinessState).toBe('blocked')
  })

  it('CLAUSE: rescue sequencing lands after every recipe requirement, never among them', () => {
    // Contingency content belongs at the end of a card. Operational slots start above every
    // composition band, so a rescue line cannot sort into the middle of the reviewed sequence.
    const card = resolveCard(defaultBuildInput(SCENARIO_ID), buildDemoContext(SCENARIO_ID))
    const composedSequences = card.items
      .filter((entry) => entry.setupSequence < OPERATIONAL_SLOT_SEQUENCE_BASE)
      .map((entry) => entry.setupSequence)
    expect(composedSequences.length).toBeGreaterThan(0)
    expect(Math.max(...composedSequences)).toBeLessThan(OPERATIONAL_SLOT_SEQUENCE_BASE)
    // And the card is emitted in setup order.
    const sequences = card.items.map((entry) => entry.setupSequence)
    expect([...sequences].sort((left, right) => left - right)).toEqual(sequences)
  })
})

describe(`resolver contract ${CONTRACT} — suppression and compatibility`, () => {
  it('CLAUSE: kit suppression is deterministic and never suppresses the kit itself', () => {
    const kit = item('kit', {
      itemType: 'procedure_kit',
      localDescription: 'Chest tube kit',
      kitComponents: [{ roleCode: 'CONTRACT_ROLE', inclusion: 'included', quantity: 1 }],
    })
    const items = [
      resolvedItem({ id: 'A', selectedItemSnapshot: kit, selectedHospitalItemId: 'kit' }),
      resolvedItem({ id: 'B', selectedItemSnapshot: item('component') }),
      resolvedItem({ id: 'C', selectedItemSnapshot: item('component-2') }),
    ]

    const first = suppressKitDuplicates(items, 1)
    const second = suppressKitDuplicates(items, 1)
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(first.items.map((entry) => entry.id)).toEqual(['A'])
    expect(first.suppressedItems.map((entry) => entry.id)).toEqual(['B', 'C'])
    expect(
      first.suppressedItems.every((entry) => entry.resolutionState === 'suppressed_by_kit'),
    ).toBe(true)
  })

  it('CLAUSE: an unevaluable compatibility rule reports unknown and never silently passes', () => {
    const rule: TypedCompatibilityRule = {
      id: 'RULE-CONTRACT',
      sourceRoleCode: 'CONTRACT_ROLE',
      targetRoleCode: null,
      sourceAttribute: 'min_working_channel_mm',
      targetAttribute: null,
      operator: 'gte',
      expectedValue: 2,
      unit: 'mm',
      severity: 'warning',
      message: 'Fails.',
      missingValueMessage: 'Cannot be established from the available structured data.',
      active: true,
      modifierCodes: [],
      evidenceSourceId: null,
    }
    // The selected item carries no dimension at all — exactly the whole-product-line case.
    const evaluated = evaluateCompatibilityRules(
      [rule],
      [resolvedItem({ id: 'A', selectedHospitalItemId: 'x', selectedItemSnapshot: item('x') })],
      [],
      1,
    )
    expect(evaluated).toHaveLength(1)
    expect(evaluated[0].state).toBe('unknown')
    expect(evaluated[0].state).not.toBe('pass')
    // And it names the attribute it could not read, so "unknown" is actionable rather than opaque.
    expect(evaluated[0].message?.message).toContain(rule.missingValueMessage)
    expect(evaluated[0].message?.message).toContain('min_working_channel_mm')
  })
})

describe(`resolver contract ${CONTRACT} — output`, () => {
  it('CLAUSE: resolution is deterministic for identical inputs', () => {
    const input = defaultBuildInput(SCENARIO_ID)
    const built = buildDemoContext(SCENARIO_ID)
    expect(JSON.stringify(resolveCard(input, built))).toBe(
      JSON.stringify(resolveCard(input, built)),
    )
  })

  it('CLAUSE: the semantic projection is deterministic and independent of key order', () => {
    const input = defaultBuildInput(SCENARIO_ID)
    const first = resolveCard(input, buildDemoContext(SCENARIO_ID))
    const second = resolveCard(input, buildDemoContext(SCENARIO_ID))
    expect(first.resolvedContentHash).toBe(second.resolvedContentHash)

    const reordered = Object.fromEntries(
      Object.entries(first).filter(
        ([key]) =>
          key !== 'snapshotHash' &&
          key !== 'snapshotIntegrityHash' &&
          key !== 'resolvedContentHash',
      ),
    ) as Parameters<typeof resolvedContentHash>[0]
    expect(resolvedContentHash(reordered)).toBe(first.resolvedContentHash)
  })

  it('CLAUSE: every card records the contract it was resolved under', () => {
    const card = resolveCard(defaultBuildInput(SCENARIO_ID), buildDemoContext(SCENARIO_ID))
    expect(card.resolutionProvenance.resolverContractVersion).toBe(CONTRACT)
  })
})

describe(`resolver contract ${CONTRACT} — versioning`, () => {
  const world = createFixtureReleaseWorld()

  it('CLAUSE: a moved implementation digest alone does not invalidate the contract', () => {
    // A refactor moves the source digest and changes nothing a card resolves to. Reporting that as
    // a broken release would mark every historical card unsupported for a rename, and a signal that
    // fires on refactors is one everyone learns to ignore.
    const bundles = world.bundles.map((bundle) => ({
      ...bundle,
      resolverImplementationHash: 'a-completely-different-build-digest',
    }))
    const messages = validateReleaseBundles({
      bundles,
      pointers: { [FIXTURE_PROCEDURE_CODE]: BRAVO_RELEASE_ID },
      sourcesByBundleId: world.sourcesByBundleId(),
    })
    const drift = messages.filter(
      (message) => message.code === 'release_resolver_implementation_advanced',
    )
    expect(drift.length).toBeGreaterThan(0)
    expect(drift.every((message) => message.severity === 'info')).toBe(true)
    expect(messages.filter((message) => message.severity === 'blocking')).toEqual([])
  })

  it('CLAUSE: a true contract-version mismatch is reported explicitly, not silently tolerated', () => {
    const bundles = world.bundles.map((bundle) => ({
      ...bundle,
      resolverContractVersion: 'ip-cards-resolver-contract/0',
    }))
    const messages = validateReleaseBundles({
      bundles,
      pointers: { [FIXTURE_PROCEDURE_CODE]: BRAVO_RELEASE_ID },
      sourcesByBundleId: world.sourcesByBundleId(),
    })
    const advanced = messages.filter(
      (message) => message.code === 'release_resolver_contract_advanced',
    )
    expect(advanced.length).toBe(bundles.length)
    expect(advanced.every((message) => message.severity === 'warning')).toBe(true)
    for (const message of advanced) {
      expect(message.message).toContain('ip-cards-resolver-contract/0')
      expect(message.message).toContain(CONTRACT)
    }
  })

  it('CLAUSE: every retained release declares the contract at its semantic version', () => {
    for (const bundle of getRetainedReleaseBundles()) {
      expect(bundle.resolverContractVersion).toBe(CONTRACT)
    }
  })

  it('CLAUSE: a release identity reaches the card only from the server-built context', () => {
    // The client cannot name its own release: provenance is read from the context, and a context
    // assembled without one carries nulls rather than borrowing whatever is current.
    const scenario = getScenarioDefinition(SCENARIO_ID)!
    const withoutRelease = buildContextForRecipe(buildDemoContext(SCENARIO_ID).recipe)
    const card = resolveCard(defaultBuildInput(scenario.id), withoutRelease)
    expect(card.resolutionProvenance.releaseBundleId).toBeNull()
    expect(card.resolutionProvenance.releaseDefinitionHash).toBeNull()
  })
})
