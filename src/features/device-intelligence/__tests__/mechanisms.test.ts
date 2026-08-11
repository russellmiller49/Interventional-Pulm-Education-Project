import {
  buildDemoContext,
  defaultBuildInput,
  resolveDemoScenario,
} from '@/features/preference-cards/data/demo-context.server'
import { resolveCard } from '@/features/preference-cards/domain/resolve-card'
import { getCatalogStore } from '@/features/preference-cards/server/catalog'
import { intentionallyFailingApcRule } from '@/features/preference-cards/__fixtures__/test-compatibility-rules'
import { requiresLaserPathwayDisclosure } from '@/features/device-intelligence/domain/laser-pathway'
import procedureSlots from '../../../../data/ip-preference-cards/generated/procedure-slots.json'
import {
  CANONICAL_PROCEDURAL_PHASE_ORDER,
  getCoverageLadderForProcedure,
  getProcedureWorkspace,
  getRoleSlotUsage,
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
    // Owner-review F-11: the no-rescue statement now names what rescue authoring exists at
    // all, so the absence reads as an authoring gap, not reassurance.
    expect(workspace.authoredRescueModuleNames.length).toBeGreaterThan(0)
  })
})

describe('owner-review regressions (2026-08-09 findings)', () => {
  const EXEMPLARS = ['EBUS_TBNA', 'THERAPEUTIC_BRONCH', 'CHEST_TUBE'] as const

  it('F-01: separates acting from inert modifiers and carries each release state', () => {
    // Counts computed by the owner from the pinned modifier definitions; a data regeneration
    // that changes them must be a conscious re-pin.
    const counts = Object.fromEntries(
      EXEMPLARS.map((code) => {
        const workspace = getProcedureWorkspace(code)!
        return [
          code,
          {
            total: workspace.modifiers.length,
            inert: workspace.modifiers.filter((modifier) => !modifier.hasStructuralEffect).length,
          },
        ]
      }),
    )
    expect(counts).toEqual({
      EBUS_TBNA: { total: 13, inert: 10 },
      THERAPEUTIC_BRONCH: { total: 26, inert: 17 },
      CHEST_TUBE: { total: 11, inert: 7 },
    })

    const therapeutic = getProcedureWorkspace('THERAPEUTIC_BRONCH')!
    const laser = therapeutic.modifiers.find((modifier) => modifier.code === 'LASER')!
    expect(laser.hasStructuralEffect).toBe(false)
    expect(laser.releaseState).toBe('phase_1_1')
    const apc = therapeutic.modifiers.find((modifier) => modifier.code === 'APC')!
    expect(apc.hasStructuralEffect).toBe(true)
    for (const code of EXEMPLARS) {
      for (const modifier of getProcedureWorkspace(code)!.modifiers) {
        expect(['mvp', 'phase_1_1', 'phase_2']).toContain(modifier.releaseState)
        // hasStructuralEffect is exactly "some effect list is non-empty".
        const effectCount =
          modifier.effects.addedRequirements.length +
          modifier.effects.removedRequirements.length +
          modifier.effects.requirednessChanges.length +
          modifier.effects.roleReplacements.length +
          modifier.effects.rescueModulesAdded.length +
          modifier.effects.requiredCapabilities.length
        expect(modifier.hasStructuralEffect).toBe(effectCount > 0)
      }
    }
  })

  it('F-03: the workspace phase view follows the canonical clinical sequence', () => {
    for (const code of EXEMPLARS) {
      const workspace = getProcedureWorkspace(code)!
      const ranks = workspace.proceduralPhaseOrder.map((phase) =>
        CANONICAL_PROCEDURAL_PHASE_ORDER.indexOf(phase),
      )
      expect(ranks).not.toContain(-1)
      expect(ranks).toEqual([...ranks].sort((left, right) => left - right))
    }
    // The specific inversions the owner reported: airway access rendered after therapeutic
    // intervention, and pre-induction rendered last on EBUS.
    const therapeuticOrder = getProcedureWorkspace('THERAPEUTIC_BRONCH')!.proceduralPhaseOrder
    expect(therapeuticOrder.indexOf('airway_access')).toBeLessThan(
      therapeuticOrder.indexOf('therapeutic'),
    )
    const ebusOrder = getProcedureWorkspace('EBUS_TBNA')!.proceduralPhaseOrder
    expect(ebusOrder.indexOf('pre_induction_or_sedation')).toBeLessThan(
      ebusOrder.indexOf('diagnostic'),
    )
  })

  it('F-07: the authored laser-pathway note stays true release-wide — no LASER* role is selectable in ANY procedure slot', () => {
    // The rendered sentence says "in this release", so the pin must span every procedure's
    // slots (laser roles also appear on RIGID_BRONCH and BRONCH_ABLATION), not just the
    // THERAPEUTIC_BRONCH ladder — the adversarial pass caught the narrower pin as a hole.
    const store = getCatalogStore()
    const laserRoles = [...store.roleByCode.keys()].filter((role) => role.startsWith('LASER'))
    expect(laserRoles).toEqual(
      expect.arrayContaining([
        'LASER_CONSOLE',
        'LASER_FIBER',
        'LASER_SAFETY_EQUIPMENT',
        'LASER_RESISTANT_ETT',
      ]),
    )
    for (const role of laserRoles) {
      for (const slot of getRoleSlotUsage(role)) {
        expect({ role, slotId: slot.slotId, optionStatus: slot.optionStatus }).not.toEqual({
          role,
          slotId: slot.slotId,
          optionStatus: 'selectable_authored',
        })
      }
    }
    // And the exemplar page's own ladder agrees.
    const ladder = getCoverageLadderForProcedure('THERAPEUTIC_BRONCH')
    const pageLaserRoles = [...ladder.byRoleCode.keys()].filter((role) => role.startsWith('LASER'))
    expect(pageLaserRoles.length).toBeGreaterThan(0)
    for (const role of pageLaserRoles) {
      expect(ladder.byRoleCode.get(role)!.coverage).not.toBe('selectable_authored')
    }
  })

  it('C-07: the laser disclosure is a derived workspace fact, pinned present AND absent', () => {
    // Presence: THERAPEUTIC_BRONCH composes LASER* requirements and none has an authored
    // selectable option, so the derived flag is on — with no procedure-code gate anywhere.
    expect(getProcedureWorkspace('THERAPEUTIC_BRONCH')!.laserPathwayDisclosureRequired).toBe(true)
    // Absence: workspaces without the governed laser condition never raise it.
    expect(getProcedureWorkspace('EBUS_TBNA')!.laserPathwayDisclosureRequired).toBe(false)
    expect(getProcedureWorkspace('CHEST_TUBE')!.laserPathwayDisclosureRequired).toBe(false)
  })

  it('C-07: the pure derivation rule — present + none selectable, and nothing else', () => {
    // No laser requirements → no disclosure.
    expect(
      requiresLaserPathwayDisclosure([
        { roleCode: 'EBUS_SCOPE', hasAuthoredSelectableOption: true },
      ]),
    ).toBe(false)
    expect(requiresLaserPathwayDisclosure([])).toBe(false)
    // Laser requirements, none selectable → disclosure.
    expect(
      requiresLaserPathwayDisclosure([
        { roleCode: 'LASER_CONSOLE', hasAuthoredSelectableOption: false },
        { roleCode: 'LASER_FIBER', hasAuthoredSelectableOption: false },
        { roleCode: 'EBUS_SCOPE', hasAuthoredSelectableOption: true },
      ]),
    ).toBe(true)
    // Any laser requirement with an authored selectable option retires the disclosure.
    expect(
      requiresLaserPathwayDisclosure([
        { roleCode: 'LASER_CONSOLE', hasAuthoredSelectableOption: false },
        { roleCode: 'LASER_FIBER', hasAuthoredSelectableOption: true },
      ]),
    ).toBe(false)
    // PHOTODYNAMIC_LASER deliberately does not match the LASER* scope (same as F-07's pin).
    expect(
      requiresLaserPathwayDisclosure([
        { roleCode: 'PHOTODYNAMIC_LASER', hasAuthoredSelectableOption: false },
      ]),
    ).toBe(false)
  })

  it('F-06: the IPC requirements have left the chest-tube template, and the divergent-pathway presentation is inactive', () => {
    // The owner's data pass (option (a), 2026-08-09) moved the four IPC roles out of
    // CHEST_TUBE into IPC_PLACEMENT, which already carried each of them exactly once. The
    // earlier interim pin — every Long-term drainage requirement selectable while the
    // chest-tube pathway is not — is superseded: the section no longer exists here, so the
    // divergent-pathway disclosure and the imbalance note (both gated on the section's
    // presence, not on the procedure code) deactivate without any presentation change.
    const workspace = getProcedureWorkspace('CHEST_TUBE')!
    expect(workspace.requirements).toHaveLength(9)
    const ipcRoles = [
      'IPC_INSERTION_KIT',
      'IPC_DRAINAGE_KIT',
      'IPC_DRESSING_KIT',
      'IPC_MANAGEMENT_ACCESSORY',
    ]
    for (const requirement of workspace.requirements) {
      expect(ipcRoles).not.toContain(requirement.roleCode)
      expect(requirement.section).not.toBe('Long-term drainage')
    }
    expect(workspace.sectionOrder).not.toContain('Long-term drainage')

    // The move, not a deletion: IPC_PLACEMENT's own template carries each role exactly once,
    // with the identical authored option sets the chest-tube rows had.
    const ipcSlots = procedureSlots.filter((slot) => slot.procedure_code === 'IPC_PLACEMENT')
    for (const role of ipcRoles) {
      expect(ipcSlots.filter((slot) => slot.role_code === role)).toHaveLength(1)
    }
  })
})
