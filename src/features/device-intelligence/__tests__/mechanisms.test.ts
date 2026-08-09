import {
  buildDemoContext,
  defaultBuildInput,
  resolveDemoScenario,
} from '@/features/preference-cards/data/demo-context.server'
import { resolveCard } from '@/features/preference-cards/domain/resolve-card'
import { intentionallyFailingApcRule } from '@/features/preference-cards/__fixtures__/test-compatibility-rules'
import {
  getCoverageLadderForProcedure,
  getProcedureWorkspace,
} from '@/features/device-intelligence/server/procedures.server'

/**
 * The Phase D1 mechanism proofs (decision D-05): everything below is derived through the
 * existing composition/resolution engine, never hardcoded requirement lists.
 */

describe('EBUS_TBNA mechanisms', () => {
  it('reaches MAJOR_AIRWAY_BLEEDING through HIGH_BLEED_RISK, shown by the canonical expansion', () => {
    const workspace = getProcedureWorkspace('EBUS_TBNA')!
    const highBleed = workspace.modifiers.find((modifier) => modifier.code === 'HIGH_BLEED_RISK')
    expect(highBleed).toBeDefined()
    expect(highBleed!.effects.rescueModulesAdded).toEqual(['MAJOR_AIRWAY_BLEEDING'])
    expect(workspace.rescueModules.map((rescueModule) => rescueModule.code)).toEqual([
      'MAJOR_AIRWAY_BLEEDING',
    ])
    expect(workspace.rescueModules[0].reachableViaModifierCodes).toContain('HIGH_BLEED_RISK')
  })

  it('resolves the rescue requirements when HIGH_BLEED_RISK is selected', () => {
    const withRescue = resolveDemoScenario('ebus-rose-molecular', {
      modifierCodes: ['ROSE', 'SPEC_MOLECULAR', 'HIGH_BLEED_RISK'],
    })
    const rescueItems = withRescue.items.filter((item) =>
      item.whyIncluded.some((reason) => reason.includes('rescue module MAJOR_AIRWAY_BLEEDING')),
    )
    expect(rescueItems.map((item) => item.roleCode).sort()).toEqual([
      'AIRWAY_TAMPONADE_BALLOON_CAPABILITY',
      'FLEX_SCOPE_THERAPEUTIC',
      'HIGH_CAPACITY_SUCTION_BACKUP',
      'MANUAL_VENTILATION_BACKUP',
      'RIGID_BRONCHOSCOPY_BACKUP',
    ])
    const without = resolveDemoScenario('ebus-rose-molecular', {
      modifierCodes: ['ROSE', 'SPEC_MOLECULAR'],
    })
    expect(
      without.items.some((item) =>
        item.whyIncluded.some((reason) => reason.includes('rescue module')),
      ),
    ).toBe(false)
  })

  it('shows the ROSE/specimen-pathway modifiers with their canonical effects', () => {
    const workspace = getProcedureWorkspace('EBUS_TBNA')!
    const rose = workspace.modifiers.find((modifier) => modifier.code === 'ROSE')!
    expect(
      rose.effects.addedRequirements.map((requirement) => requirement.roleCode).sort(),
    ).toEqual(['LOCAL_CYTOLOGY_SUPPLIES', 'LOCAL_ROSE_STATION'])
    const molecular = workspace.modifiers.find((modifier) => modifier.code === 'SPEC_MOLECULAR')!
    expect(
      molecular.effects.addedRequirements.map((requirement) => requirement.roleCode).sort(),
    ).toEqual(['LOCAL_MOLECULAR_READINESS', 'LOCAL_MOLECULAR_SPECIMEN_BUNDLE'])
  })
})

describe('THERAPEUTIC_BRONCH mechanisms', () => {
  it('reaches the rescue module and surfaces the balloon compatibility rule as a condition', () => {
    const workspace = getProcedureWorkspace('THERAPEUTIC_BRONCH')!
    expect(workspace.rescueModules.map((rescueModule) => rescueModule.code)).toEqual([
      'MAJOR_AIRWAY_BLEEDING',
    ])
    expect(workspace.typedRuleConditions.map((rule) => rule.id)).toEqual([
      'RULE-BALLOON-WORKING-CHANNEL',
    ])
    expect(workspace.typedRuleConditions[0].severity).toBe('blocking')
  })

  it('makes an APC platform/probe blocking compatibility failure visible through the existing engine', () => {
    // The deliberately-failing APC rule lives in the documented test fixture, injected into a
    // copied context exactly as its docstring prescribes — never a second evaluation engine.
    const scenarioId = 'central-airway-obstruction'
    const context = buildDemoContext(scenarioId)
    const contextWithApcRule = {
      ...context,
      compatibilityRules: [...context.compatibilityRules, intentionallyFailingApcRule],
    }
    const input = defaultBuildInput(scenarioId, {
      modifierCodes: [
        'RIGID_AIRWAY',
        'APC',
        'BALLOON_DILATION',
        'STENT_PLACE',
        'JET_VENT',
        'FLUOROSCOPY',
        'HIGH_BLEED_RISK',
      ],
    })
    const resolved = resolveCard(input, contextWithApcRule)
    const failure = resolved.warnings.find(
      (warning) =>
        warning.code === 'compatibility_failed' && warning.sourceId === 'RULE-APC-PLATFORM-FAMILY',
    )
    expect(failure).toBeDefined()
    expect(failure!.severity).toBe('blocking')
    expect(resolved.readinessState).toBe('blocked')
    // And without the modifier that arms the rule, the same context does not fail it.
    const withoutApc = resolveCard(
      defaultBuildInput(scenarioId, {
        modifierCodes: ['RIGID_AIRWAY', 'BALLOON_DILATION', 'JET_VENT', 'FLUOROSCOPY'],
      }),
      contextWithApcRule,
    )
    expect(
      withoutApc.warnings.some((warning) => warning.sourceId === 'RULE-APC-PLATFORM-FAMILY'),
    ).toBe(false)
  })

  it('evaluates the balloon rule to unknown in the live demo context — a limitation, never a pass', () => {
    const resolved = resolveDemoScenario('central-airway-obstruction')
    const unknown = resolved.warnings.find(
      (warning) =>
        warning.code === 'compatibility_unknown' &&
        warning.sourceId === 'RULE-BALLOON-WORKING-CHANNEL',
    )
    expect(unknown).toBeDefined()
  })

  it('keeps the laser and imaging roles proposals-only or unmapped, as the audit records', () => {
    const ladder = getCoverageLadderForProcedure('THERAPEUTIC_BRONCH')
    const byRole = ladder.byRoleCode
    for (const role of [
      'LASER_CONSOLE',
      'LASER_FIBER',
      'LASER_SAFETY_EQUIPMENT',
      'TOMOSYNTHESIS_NAVIGATION_SYSTEM',
      'FLUOROSCOPY_C_ARM',
    ]) {
      expect({ role, coverage: byRole.get(role)?.coverage }).toEqual({
        role,
        coverage: 'proposals_only',
      })
    }
    for (const role of ['LASER_RESISTANT_ETT', 'RADIATION_PROTECTION', 'GENERIC_SPECIMEN']) {
      expect({ role, coverage: byRole.get(role)?.coverage }).toEqual({
        role,
        coverage: 'no_option_no_proposal_unmapped',
      })
    }
  })
})

describe('CHEST_TUBE mechanisms', () => {
  it('replaces GENERIC_DRAINAGE_UNIT with DIGITAL_DRAINAGE_SYSTEM via the DIGITAL_DRAINAGE modifier', () => {
    const workspace = getProcedureWorkspace('CHEST_TUBE')!
    const digital = workspace.modifiers.find((modifier) => modifier.code === 'DIGITAL_DRAINAGE')!
    expect(digital.effects.roleReplacements).toEqual([
      expect.objectContaining({
        fromRole: 'GENERIC_DRAINAGE_UNIT',
        toRole: 'DIGITAL_DRAINAGE_SYSTEM',
      }),
    ])
    const resolved = resolveDemoScenario('chest-tube', {
      modifierCodes: ['TECH_CHEST_TUBE_SMALL_BORE', 'DIGITAL_DRAINAGE'],
    })
    expect(resolved.items.some((item) => item.roleCode === 'DIGITAL_DRAINAGE_SYSTEM')).toBe(true)
    expect(resolved.items.some((item) => item.roleCode === 'GENERIC_DRAINAGE_UNIT')).toBe(false)
  })

  it('blocks the mutually exclusive small-bore and large-bore techniques', () => {
    const workspace = getProcedureWorkspace('CHEST_TUBE')!
    const smallBore = workspace.modifiers.find(
      (modifier) => modifier.code === 'TECH_CHEST_TUBE_SMALL_BORE',
    )!
    expect(smallBore.conflictsWith).toContain('TECH_CHEST_TUBE_LARGE_BORE')
    const both = resolveDemoScenario('chest-tube', {
      modifierCodes: ['TECH_CHEST_TUBE_SMALL_BORE', 'TECH_CHEST_TUBE_LARGE_BORE'],
    })
    expect(both.readinessState).toBe('blocked')
    expect(both.warnings.some((warning) => warning.code === 'mutually_exclusive_modifiers')).toBe(
      true,
    )
  })

  it('suppresses the securement requirement through the small-bore kit BOM', () => {
    const resolved = resolveDemoScenario('chest-tube', {
      modifierCodes: ['TECH_CHEST_TUBE_SMALL_BORE', 'DIGITAL_DRAINAGE'],
    })
    expect(resolved.suppressedItems).toEqual([
      expect.objectContaining({
        roleCode: 'LOCAL_CHEST_TUBE_SECUREMENT',
        resolutionState: 'suppressed_by_kit',
      }),
    ])
    // The large-bore branch has no kit BOM, so nothing is suppressed there.
    const largeBore = resolveDemoScenario('chest-tube', {
      modifierCodes: ['TECH_CHEST_TUBE_LARGE_BORE'],
    })
    expect(largeBore.suppressedItems).toEqual([])
  })

  it('states the no-rescue fact: no modifier reaches any rescue module and no Rescue-section slots exist', () => {
    const workspace = getProcedureWorkspace('CHEST_TUBE')!
    expect(workspace.noRescueModuleReachable).toBe(true)
    expect(workspace.rescueModules).toEqual([])
    expect(workspace.rescueSectionSlotCount).toBe(0)
    for (const modifier of workspace.modifiers) {
      expect(modifier.effects.rescueModulesAdded).toEqual([])
    }
  })
})
