import {
  buildDemoContext,
  defaultBuildInput,
  resolveDemoScenario,
} from '../data/demo-context.server'
import { evaluateCompatibilityRule } from '../domain/evaluate-compatibility'
import { resolveCard } from '../domain/resolve-card'
import type { ResolvedCardItem, TypedCompatibilityRule } from '../domain/types'
import { goldenScenarioExpectations } from '../__fixtures__/golden-scenario-expectations'
import { intentionallyFailingApcRule } from '../__fixtures__/test-compatibility-rules'

/**
 * The deliberately-failing APC rule is a test fixture, not production seed data, so it is
 * injected here instead of permanently blocking the central-airway scenario for users.
 */
function contextWithFailingApcRule() {
  const context = buildDemoContext('central-airway-obstruction')
  return {
    ...context,
    compatibilityRules: [...context.compatibilityRules, intentionallyFailingApcRule],
  }
}

describe('preference-card deterministic resolver', () => {
  it('produces identical output and snapshot hash for the same inputs', () => {
    const context = buildDemoContext('ebus-rose-molecular')
    const input = defaultBuildInput('ebus-rose-molecular')
    const first = resolveCard(input, context)
    const second = resolveCard(input, context)
    expect(second).toEqual(first)
    expect(second.snapshotHash).toBe(first.snapshotHash)
  })

  it('adds ROSE requirements and trace entries', () => {
    const card = resolveDemoScenario('ebus-rose-molecular', {
      modifierCodes: ['ROSE'],
    })
    expect(card.items.map((item) => item.roleCode)).toEqual(
      expect.arrayContaining(['LOCAL_ROSE_STATION', 'LOCAL_CYTOLOGY_SUPPLIES']),
    )
    expect(
      card.ruleTrace.some((event) => event.kind === 'modifier' && event.sourceId === 'ROSE'),
    ).toBe(true)
  })

  it('removing a modifier removes only that modifier’s effects', () => {
    const both = resolveDemoScenario('ebus-rose-molecular')
    const molecularOnly = resolveDemoScenario('ebus-rose-molecular', {
      modifierCodes: ['SPEC_MOLECULAR'],
    })
    expect(both.items.some((item) => item.roleCode === 'LOCAL_ROSE_STATION')).toBe(true)
    expect(molecularOnly.items.some((item) => item.roleCode === 'LOCAL_ROSE_STATION')).toBe(false)
    expect(
      molecularOnly.items.some((item) => item.roleCode === 'LOCAL_MOLECULAR_SPECIMEN_BUNDLE'),
    ).toBe(true)
  })

  it('appends the major-airway-bleeding rescue module', () => {
    const card = resolveDemoScenario('central-airway-obstruction', {
      modifierCodes: ['HIGH_BLEED_RISK'],
    })
    expect(card.items.some((item) => item.id === 'RESCUE-BLEED-SUCTION')).toBe(true)
    expect(
      card.ruleTrace.some(
        (event) => event.kind === 'rescue_module' && event.sourceId === 'MAJOR_AIRWAY_BLEEDING',
      ),
    ).toBe(true)
  })

  it('keeps rescue items held or on the emergency pull list', () => {
    const card = resolveDemoScenario('central-airway-obstruction', {
      modifierCodes: ['HIGH_BLEED_RISK'],
    })
    const rescueItems = card.items.filter((item) => item.id.startsWith('RESCUE-'))
    expect(rescueItems.length).toBeGreaterThan(0)
    expect(
      rescueItems.every((item) =>
        ['hold_unopened', 'emergency_pull'].includes(item.openHoldStatus),
      ),
    ).toBe(true)
  })

  it('warns without blocking when a required role has no local resolution', () => {
    // An unfinished card is not a conflict: many required roles have no catalogued product
    // and are covered by a custom line item instead.
    const context = buildDemoContext('ebus-rose-molecular')
    context.hospitalRoleOptions = context.hospitalRoleOptions.filter(
      (option) => option.roleCode !== 'GENERIC_SUCTION',
    )
    const card = resolveCard(defaultBuildInput('ebus-rose-molecular'), context)
    expect(card.readinessState).toBe('complete_with_warnings')
    const unresolved = card.warnings.find((warning) => warning.code === 'required_role_unresolved')
    expect(unresolved?.severity).toBe('warning')
  })

  it('honors an explicit builder selection without changing other roles', () => {
    const context = buildDemoContext('ebus-rose-molecular')
    const target = context.recipe.slots.find((slot) => slot.requiredness === 'required')
    if (!target) throw new Error('Expected a required EBUS slot')
    const baseline = resolveCard(defaultBuildInput('ebus-rose-molecular'), context)
    const input = defaultBuildInput('ebus-rose-molecular')
    input.selectedHospitalItemIds = { [target.id]: null }
    const changed = resolveCard(input, context)

    expect(changed.items.find((item) => item.id === target.id)).toMatchObject({
      selectedHospitalItemId: null,
      resolutionState: 'warning',
    })
    expect(
      changed.items
        .filter((item) => item.id !== target.id)
        .map((item) => item.selectedHospitalItemId),
    ).toEqual(
      baseline.items
        .filter((item) => item.id !== target.id)
        .map((item) => item.selectedHospitalItemId),
    )
  })

  it('uses complete_with_warnings for warnings without blockers', () => {
    const card = resolveDemoScenario('ebus-rose-molecular')
    expect(card.readinessState).toBe('complete_with_warnings')
    expect(card.warnings.some((warning) => warning.severity === 'blocking')).toBe(false)
  })

  it('blocks on the intentionally incompatible APC fixture', () => {
    const card = resolveCard(
      defaultBuildInput('central-airway-obstruction'),
      contextWithFailingApcRule(),
    )
    expect(card.readinessState).toBe('blocked')
    expect(
      card.warnings.some(
        (warning) =>
          warning.code === 'compatibility_failed' &&
          warning.sourceId === 'RULE-APC-PLATFORM-FAMILY',
      ),
    ).toBe(true)
  })

  it('records an authorized waiver reason without clearing a blocker', () => {
    const context = contextWithFailingApcRule()
    const baselineInput = defaultBuildInput('central-airway-obstruction')
    const baseline = resolveCard(baselineInput, context)
    const blocker = baseline.warnings.find((warning) => warning.code === 'compatibility_failed')
    if (!blocker) throw new Error('Expected the APC compatibility blocker')
    const input = defaultBuildInput('central-airway-obstruction')
    input.waivers = {
      [blocker.id]: 'Reviewed by an administrator for prototype workflow testing.',
    }
    const waived = resolveCard(input, context)
    const waivedBlocker = waived.warnings.find((warning) => warning.id === blocker.id)

    expect(waivedBlocker).toMatchObject({
      acknowledged: true,
      waiverReason: 'Reviewed by an administrator for prototype workflow testing.',
    })
    expect(waived.readinessState).toBe('blocked')
    expect(waived.snapshotHash).not.toBe(baseline.snapshotHash)
    expect(waived.ruleTrace.some((event) => event.kind === 'waiver')).toBe(true)
  })

  it('blocks mutually exclusive chest-tube technique modifiers', () => {
    const card = resolveDemoScenario('chest-tube', {
      modifierCodes: ['TECH_CHEST_TUBE_SMALL_BORE', 'TECH_CHEST_TUBE_LARGE_BORE'],
    })
    expect(card.readinessState).toBe('blocked')
    expect(card.warnings.some((warning) => warning.code === 'mutually_exclusive_modifiers')).toBe(
      true,
    )
  })

  it('suppresses only a true kit/BOM duplicate', () => {
    const card = resolveDemoScenario('chest-tube')
    expect(card.suppressedItems).toHaveLength(1)
    expect(card.suppressedItems[0]).toMatchObject({
      roleCode: 'LOCAL_CHEST_TUBE_SECUREMENT',
      resolutionState: 'suppressed_by_kit',
    })
    expect(card.items.some((item) => item.roleCode === 'GENERIC_SPECIMEN')).toBe(true)
  })

  it('applies a preference overlay only to the targeted slot field', () => {
    const context = buildDemoContext('ebus-rose-molecular')
    const target = context.recipe.slots[0]
    const untouched = context.recipe.slots[1]
    context.preferenceOverlays = [
      {
        id: 'test-overlay',
        slotId: target.id,
        roleCode: null,
        override: { openHoldStatus: 'hold_unopened' },
      },
    ]
    const card = resolveCard(defaultBuildInput('ebus-rose-molecular'), context)
    expect(card.items.find((item) => item.id === target.id)?.openHoldStatus).toBe('hold_unopened')
    expect(card.items.find((item) => item.id === untouched.id)?.openHoldStatus).toBe(
      untouched.openHoldStatus,
    )
  })

  it('does not mutate an existing snapshot after later mapping changes', () => {
    const context = buildDemoContext('ebus-rose-molecular')
    const input = defaultBuildInput('ebus-rose-molecular')
    const saved = resolveCard(input, context)
    const savedJson = JSON.stringify(saved)
    const suction = context.hospitalItems.find((item) => item.id === 'demo-suction')
    if (!suction) throw new Error('Expected demo suction fixture')
    suction.localDescription = 'Later mapping change'
    const regenerated = resolveCard(input, context)
    expect(JSON.stringify(saved)).toBe(savedJson)
    expect(regenerated.snapshotHash).not.toBe(saved.snapshotHash)
  })

  it('blocks hidden products in normal builder resolution', () => {
    const context = buildDemoContext('ebus-rose-molecular')
    const scope = context.hospitalItems.find((item) => item.id === 'catalog-ebus-scope')
    if (!scope) throw new Error('Expected EBUS scope fixture')
    scope.verificationState = 'hidden'
    const card = resolveCard(defaultBuildInput('ebus-rose-molecular'), context)
    expect(card.readinessState).toBe('blocked')
    expect(card.warnings.some((warning) => warning.code === 'hidden_product_selected')).toBe(true)
  })

  it('marks prototype-visible products for reverification', () => {
    const card = resolveDemoScenario('ebus-rose-molecular')
    expect(
      card.warnings.some((warning) => warning.code === 'prototype_product_requires_verification'),
    ).toBe(true)
  })

  it('never presents a draft recipe as production approved', () => {
    const card = resolveDemoScenario('ebus-rose-molecular')
    expect(card.governanceState).toBe('draft')
    expect(card.prototype).toBe(true)
  })

  it('does not block an undecided conditional slot', () => {
    const context = buildDemoContext('ebus-rose-molecular')
    const conditional = context.recipe.slots.find((slot) => slot.requiredness === 'conditional')
    if (!conditional) throw new Error('Expected a conditional EBUS slot')
    context.hospitalRoleOptions = context.hospitalRoleOptions.filter(
      (option) => option.roleCode !== conditional.roleCode,
    )
    const card = resolveCard(defaultBuildInput('ebus-rose-molecular'), context)
    expect(
      card.warnings.some(
        (warning) =>
          warning.code === 'required_role_unresolved' && warning.sourceId === conditional.id,
      ),
    ).toBe(false)
  })

  it('warns on the same unresolved conditional slot once it is included', () => {
    const context = buildDemoContext('ebus-rose-molecular')
    const conditional = context.recipe.slots.find((slot) => slot.requiredness === 'conditional')
    if (!conditional) throw new Error('Expected a conditional EBUS slot')
    context.hospitalRoleOptions = context.hospitalRoleOptions.filter(
      (option) => option.roleCode !== conditional.roleCode,
    )
    const input = defaultBuildInput('ebus-rose-molecular')
    input.conditionalStates = { [conditional.id]: 'include' }
    const card = resolveCard(input, context)
    expect(card.readinessState).toBe('complete_with_warnings')
    expect(
      card.warnings.some(
        (warning) =>
          warning.code === 'required_role_unresolved' && warning.sourceId === conditional.id,
      ),
    ).toBe(true)
  })

  it('returns unknown plus a warning when a compatibility operand is null', () => {
    const rule: TypedCompatibilityRule = {
      id: 'null-operand',
      sourceRoleCode: 'DEVICE',
      targetRoleCode: 'SCOPE',
      sourceAttribute: 'delivery_system_od_mm',
      targetAttribute: 'min_working_channel_mm',
      operator: 'lte',
      expectedValue: null,
      unit: 'mm',
      severity: 'blocking',
      message: 'Should not be emitted as a failure.',
      missingValueMessage: 'Compatibility is unknown.',
      active: true,
      modifierCodes: [],
      evidenceSourceId: null,
    }
    const item = (
      id: string,
      roleCode: string,
      attributes: Record<string, number | null>,
    ): ResolvedCardItem => ({
      id,
      sourceSlotId: null,
      roleCode,
      label: roleCode,
      genericRequirement: roleCode,
      requiredness: 'required',
      effectiveRequiredness: 'required',
      dependencyRule: null,
      conditionalState: null,
      quantityDisplay: '1',
      setupZone: 'back_table',
      proceduralPhase: 'therapeutic',
      setupSequence: 1,
      openHoldStatus: 'have_in_room',
      selectedHospitalItemId: id,
      selectedCatalogProductId: null,
      selectedItemSnapshot: {
        id,
        organizationId: 'org',
        siteId: 'site',
        locationId: 'location',
        itemType: 'commercial_product',
        roleCode,
        catalogProduct: null,
        localItemNumber: null,
        localDescription: roleCode,
        localUom: null,
        storageLocation: null,
        verificationState: 'locally_approved',
        active: true,
        notes: null,
        attributes,
        kitComponents: [],
      },
      resolutionState: 'resolved',
      verificationState: 'locally_approved',
      compatibilityState: 'not_evaluated',
      rationale: null,
      whyIncluded: [],
      notes: null,
    })
    const result = evaluateCompatibilityRule(
      rule,
      [
        item('device', 'DEVICE', { delivery_system_od_mm: null }),
        item('scope', 'SCOPE', { min_working_channel_mm: 2.8 }),
      ],
      1,
    )
    expect(result.state).toBe('unknown')
    expect(result.message).toMatchObject({
      severity: 'warning',
      code: 'compatibility_unknown',
    })
  })

  it('retains unmapped section assignments in the explicit unassigned group', () => {
    const context = buildDemoContext('ebus-rose-molecular')
    context.recipe.slots[0].setupZone = 'unassigned'
    context.recipe.slots[0].proceduralPhase = 'unassigned'
    const card = resolveCard(defaultBuildInput('ebus-rose-molecular'), context)
    expect(
      card.items.some(
        (item) =>
          item.id === context.recipe.slots[0].id &&
          item.setupZone === 'unassigned' &&
          item.proceduralPhase === 'unassigned',
      ),
    ).toBe(true)
  })

  it.each(Object.values(goldenScenarioExpectations))(
    'matches the reviewed golden fixture for $scenarioId',
    (expectation) => {
      const card = resolveDemoScenario(expectation.scenarioId, {
        modifierCodes: [...expectation.modifierCodes],
      })
      expect({
        readinessState: card.readinessState,
        itemCount: card.items.length,
        suppressedItemCount: card.suppressedItems.length,
        snapshotHash: card.snapshotHash,
      }).toEqual({
        readinessState: expectation.readinessState,
        itemCount: expectation.itemCount,
        suppressedItemCount: expectation.suppressedItemCount,
        snapshotHash: expectation.snapshotHash,
      })
    },
  )
})
