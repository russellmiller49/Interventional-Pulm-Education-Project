import {
  buildDemoContext,
  defaultBuildInput,
  getComposedRecipeSlots,
  resolveDemoScenario,
} from '../data/demo-context.server'
import { catalogPickItemId, withCatalogPicks } from '../domain/catalog-pick'
import { customItemId, withCustomItems } from '../domain/custom-item'
import { defaultSelectedModuleVersionIds } from '../domain/expand-recipe-composition'
import { resolveCard } from '../domain/resolve-card'
import type { ResolvedCard } from '../domain/types'
import { resolveCatalogPick } from '../server/catalog'

/**
 * Clinical proof fixtures for the three worked compositions.
 *
 * These assert against the real reviewed seed data, not synthetic modules: that EBUS-TBNA
 * really is assembled from a shared flexible-bronchoscopy core plus an EBUS-specific
 * module, that the core's requirements are on the card exactly once, and that the existing
 * modifier, catalog-pick, and custom-line behaviour all survive composition.
 */

const FLEX_CORE = 'module-flex-bronch-core-v1-1'
const THERAPEUTIC_CORE = 'module-therapeutic-bronch-core-v1-0'
const PLEURAL_CORE = 'module-pleural-procedure-core-v1-0'
const EBUS_SPECIFIC = 'module-ebus-tbna-specific-v1-0'
const THERAPEUTIC_SPECIFIC = 'module-therapeutic-bronch-specific-v1-1'
const CHEST_TUBE_SPECIFIC = 'module-chest-tube-specific-v1-1'
const FLUOROSCOPY = 'module-procedural-fluoroscopy-v1-0'

function moduleIds(card: ResolvedCard): string[] {
  return (card.includedModules ?? []).map((module) => module.moduleVersionId)
}

function countByRequirementKey(card: ResolvedCard, requirementKey: string): number {
  return card.items.filter((item) => item.requirementKey === requirementKey).length
}

describe('EBUS-TBNA = Flexible Bronchoscopy Core + EBUS-TBNA specific + optional imaging', () => {
  const card = resolveDemoScenario('ebus-rose-molecular')

  it('is assembled from the reviewed modules, with the shared core first', () => {
    expect(moduleIds(card)).toEqual([FLEX_CORE, EBUS_SPECIFIC, FLUOROSCOPY])
    expect(card.includedModules?.map((module) => module.selectionSource)).toEqual([
      'required',
      'required',
      'default',
    ])
    expect(card.includedModules?.[0].kind).toBe('core')
  })

  it('carries each flexible-bronchoscopy core requirement exactly once', () => {
    expect(countByRequirementKey(card, 'FLEX_BRONCH_VIDEO_PROCESSOR')).toBe(1)
    expect(countByRequirementKey(card, 'FLEX_BRONCH_SUCTION_SETUP')).toBe(1)
    // Role-code equality is not identity: nothing else on the card claims to be the core's
    // video processor even though the EBUS module also asks for ultrasound hardware.
    expect(card.items.filter((item) => item.roleCode === 'VIDEO_PROCESSOR')).toHaveLength(1)
  })

  it('carries each EBUS-specific requirement exactly once and does not duplicate the core', () => {
    const ebusItems = card.items.filter((item) =>
      (item.sourceModuleVersionIds ?? []).includes(EBUS_SPECIFIC),
    )
    expect(ebusItems.map((item) => item.roleCode)).toContain('EBUS_SCOPE')
    expect(ebusItems.map((item) => item.roleCode)).not.toContain('VIDEO_PROCESSOR')
    expect(ebusItems.map((item) => item.roleCode)).not.toContain('GENERIC_SUCTION')
    expect(ebusItems.map((item) => item.roleCode)).not.toContain('BITE_BLOCK')
    expect(ebusItems.map((item) => item.roleCode)).not.toContain('GENERIC_AIRWAY_ADAPTER')
    expect(new Set(ebusItems.map((item) => item.requirementKey)).size).toBe(ebusItems.length)
  })

  it('names the source module on every line and in the trace', () => {
    const videoProcessor = card.items.find(
      (item) => item.requirementKey === 'FLEX_BRONCH_VIDEO_PROCESSOR',
    )
    expect(videoProcessor?.whyIncluded[0]).toBe('Included by Flexible Bronchoscopy Core v1.1')
    expect(videoProcessor?.sourceModuleVersionIds).toEqual([FLEX_CORE])

    const scope = card.items.find((item) => item.roleCode === 'EBUS_SCOPE')
    expect(scope?.whyIncluded[0]).toBe('Included by EBUS-TBNA specific requirements v1.0')

    expect(
      card.ruleTrace.some((event) => event.kind === 'composition' && event.sourceId === FLEX_CORE),
    ).toBe(true)
  })

  it('keeps the aspiration-syringe wording the imported EBUS row carried', () => {
    const suction = card.items.find((item) => item.requirementKey === 'FLEX_BRONCH_SUCTION_SETUP')
    expect(suction?.notes).toContain('aspiration syringes')
    expect(suction?.whyIncluded[0]).toContain('Modified by EBUS-TBNA / EBUS-FNB composition')
  })

  it('still adds ROSE and molecular-testing requirements through the existing modifiers', () => {
    expect(card.items.map((item) => item.roleCode)).toEqual(
      expect.arrayContaining(['LOCAL_ROSE_STATION', 'LOCAL_MOLECULAR_SPECIMEN_BUNDLE']),
    )
    const rose = card.items.find((item) => item.roleCode === 'LOCAL_ROSE_STATION')
    expect(rose?.whyIncluded[0]).toBe('Added by modifier ROSE')
    // Modifier-added lines sort after everything the composition produced.
    const composedMax = Math.max(
      ...card.items
        .filter((item) => (item.sourceModuleVersionIds ?? []).length > 0)
        .map((item) => item.setupSequence),
    )
    expect(rose!.setupSequence).toBeGreaterThan(composedMax)
  })

  it('removes only the optional imaging module when it is deselected', () => {
    const withoutImaging = resolveDemoScenario('ebus-rose-molecular', {
      selectedModuleVersionIds: [FLEX_CORE, EBUS_SPECIFIC],
    })
    expect(moduleIds(withoutImaging)).toEqual([FLEX_CORE, EBUS_SPECIFIC])
    expect(withoutImaging.items).toHaveLength(card.items.length - 2)
    expect(withoutImaging.items.some((item) => item.roleCode === 'FLUOROSCOPY_C_ARM')).toBe(false)
    // Everything the other modules contributed is untouched.
    expect(countByRequirementKey(withoutImaging, 'FLEX_BRONCH_VIDEO_PROCESSOR')).toBe(1)
    expect(withoutImaging.items.some((item) => item.roleCode === 'EBUS_SCOPE')).toBe(true)
  })

  it('cannot have its required core removed by a crafted selection', () => {
    const crafted = resolveDemoScenario('ebus-rose-molecular', {
      selectedModuleVersionIds: [],
    })
    expect(moduleIds(crafted)).toEqual([FLEX_CORE, EBUS_SPECIFIC])
    expect(countByRequirementKey(crafted, 'FLEX_BRONCH_VIDEO_PROCESSOR')).toBe(1)
  })

  it('still accepts a catalog product pick and a custom line on composed requirements', () => {
    const context = buildDemoContext('ebus-rose-molecular')
    const scope = getComposedRecipeSlots('ebus-rose-molecular').find(
      (slot) => slot.roleCode === 'EBUS_SCOPE',
    )
    const suction = getComposedRecipeSlots('ebus-rose-molecular').find(
      (slot) => slot.requirementKey === 'FLEX_BRONCH_SUCTION_SETUP',
    )
    if (!scope || !suction) throw new Error('Expected the composed EBUS requirements')

    const pick = resolveCatalogPick('PRD-2FFEEB98B2', 'EBUS_SCOPE')
    expect(pick.ok).toBe(true)
    if (!pick.ok) return

    const custom = {
      id: 'composition-custom',
      roleCode: suction.roleCode,
      description: 'Locally assembled suction setup',
      itemNumber: null,
      notes: null,
    }
    const resolved = resolveCard(
      {
        ...defaultBuildInput('ebus-rose-molecular'),
        selectedHospitalItemIds: {
          [scope.id]: catalogPickItemId(pick.pick.productId),
          [suction.id]: customItemId(custom.id),
        },
      },
      withCustomItems(withCatalogPicks(context, [pick.pick]), [custom]),
    )

    expect(resolved.items.find((item) => item.id === scope.id)?.selectedCatalogProductId).toBe(
      'PRD-2FFEEB98B2',
    )
    expect(
      resolved.items.find((item) => item.id === suction.id)?.selectedItemSnapshot?.localDescription,
    ).toBe('Locally assembled suction setup')
  })
})

describe('therapeutic flexible bronchoscopy = two shared cores + its own module', () => {
  const card = resolveDemoScenario('central-airway-obstruction')

  it('reuses both the flexible and the therapeutic core', () => {
    expect(moduleIds(card)).toEqual([
      FLEX_CORE,
      THERAPEUTIC_CORE,
      THERAPEUTIC_SPECIFIC,
      FLUOROSCOPY,
    ])
  })

  it('carries every shared requirement exactly once', () => {
    for (const requirementKey of [
      'FLEX_BRONCH_VIDEO_PROCESSOR',
      'FLEX_BRONCH_SUCTION_SETUP',
      'FLEX_BRONCH_BITE_BLOCK',
      'FLEX_BRONCH_AIRWAY_ADAPTER',
      'THERAPEUTIC_BRONCHOSCOPE_PLATFORM',
      'AIRWAY_RETRIEVAL_FORCEPS',
      'PROCEDURAL_FLUOROSCOPY_C_ARM',
    ]) {
      expect(countByRequirementKey(card, requirementKey)).toBe(1)
    }
  })

  it('restores the high-flow suction expectation the imported row carried', () => {
    const suction = card.items.find((item) => item.requirementKey === 'FLEX_BRONCH_SUCTION_SETUP')
    expect(suction?.notes).toContain('High-flow suction')
  })

  it('still answers to the existing modality modifiers', () => {
    expect(card.items.some((item) => item.roleCode === 'RIGID_BRONCHOSCOPE_BARREL')).toBe(true)
    expect(card.items.some((item) => item.id.startsWith('RESCUE-'))).toBe(true)
  })

  it('keeps a modifier whose target moved into a shared module working', () => {
    // Modifier targeting resolves through the expanded id, the imported id, and any
    // provenance alias, so a modifier authored before composition still lands.
    const context = buildDemoContext('central-airway-obstruction')
    const shared = getComposedRecipeSlots('central-airway-obstruction').find(
      (slot) => slot.requirementKey === 'FLEX_BRONCH_VIDEO_PROCESSOR',
    )
    if (!shared) throw new Error('Expected the shared video-processor requirement')
    // SLOT-6BCA0B7A49 is the therapeutic template's own video-processor row, absorbed into
    // the core as an alias.
    expect(shared.sourceSlotAliases).toContain('SLOT-6BCA0B7A49')

    const withAliasModifier = {
      ...context,
      modifiers: [
        {
          code: 'ALIAS_TEST',
          name: 'Alias test',
          groupCode: 'therapeutic' as const,
          description: 'Targets the pre-composition slot id.',
          releaseState: 'mvp' as const,
          active: true,
          appliesTo: 'test',
          preview: [],
          conflictsWith: [],
          actions: [
            {
              id: 'alias-test-1',
              modifierCode: 'ALIAS_TEST',
              sequence: 1,
              actionType: 'append_note' as const,
              targetSlotId: 'SLOT-6BCA0B7A49',
              payload: { note: 'Targeted through the provenance alias.' },
            },
          ],
        },
      ],
    }
    const resolved = resolveCard(
      { ...defaultBuildInput('central-airway-obstruction'), modifierCodes: ['ALIAS_TEST'] },
      withAliasModifier,
    )
    expect(
      resolved.items.find((item) => item.requirementKey === 'FLEX_BRONCH_VIDEO_PROCESSOR')?.notes,
    ).toContain('Targeted through the provenance alias.')
  })
})

describe('chest tube insertion = pleural core + its own module', () => {
  const card = resolveDemoScenario('chest-tube', {
    modifierCodes: ['TECH_CHEST_TUBE_SMALL_BORE'],
  })

  it('reuses the pleural core', () => {
    expect(moduleIds(card)).toEqual([PLEURAL_CORE, CHEST_TUBE_SPECIFIC])
  })

  it('restores the chest-tube template’s optional, image-guided ultrasound line', () => {
    const ultrasound = card.items.find(
      (item) => item.requirementKey === 'PLEURAL_ULTRASOUND_MACHINE',
    )
    expect(ultrasound).toMatchObject({
      requiredness: 'optional',
      dependencyRule: 'Image-guided insertion',
      roleCode: 'GENERIC_ULTRASOUND',
    })
    expect(ultrasound?.whyIncluded[0]).toContain('Included by Pleural Procedure Core v1.0')
  })

  it('leaves the other three pleural procedures on the required ultrasound line', () => {
    for (const scenarioId of ['thoracentesis', 'ipc-placement', 'med-thoracoscopy']) {
      const other = resolveDemoScenario(scenarioId)
      expect(moduleIds(other)[0]).toBe(PLEURAL_CORE)
      expect(
        other.items.find((item) => item.requirementKey === 'PLEURAL_ULTRASOUND_MACHINE')
          ?.requiredness,
      ).toBe('required')
    }
  })

  it('still suppresses the kit duplicate it always did', () => {
    expect(card.suppressedItems.map((item) => item.roleCode)).toEqual([
      'LOCAL_CHEST_TUBE_SECUREMENT',
    ])
  })
})

describe('every imported procedure remains buildable', () => {
  const scenarioIds = [
    'bronch-ablation',
    'chest-tube',
    'ebus-rose-molecular',
    'ebv',
    'flex-diagnostic',
    'icu-bronch',
    'ipc-placement',
    'med-thoracoscopy',
    'perc-trach',
    'photodynamic-therapy',
    'rigid-bronch',
    'tb-ruleout',
    'central-airway-obstruction',
    'thoracentesis',
    'wll',
  ]

  it.each(scenarioIds)('%s composes at least one module and produces requirements', (id) => {
    const context = buildDemoContext(id)
    expect(defaultSelectedModuleVersionIds(context.recipe).length).toBeGreaterThan(0)
    const card = resolveDemoScenario(id)
    expect(card.items.length).toBeGreaterThan(0)
    expect(card.warnings.some((warning) => warning.code.startsWith('recipe_composition'))).toBe(
      false,
    )
    // Nothing on a composed card is missing its stable identity.
    expect(card.items.every((item) => Boolean(item.requirementKey))).toBe(true)
  })
})
