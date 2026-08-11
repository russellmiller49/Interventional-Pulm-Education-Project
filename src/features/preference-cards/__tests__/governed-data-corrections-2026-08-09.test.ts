import slotProductOptions from '../../../../data/ip-preference-cards/generated/slot-product-options.json'
import procedureSlots from '../../../../data/ip-preference-cards/generated/procedure-slots.json'

import { getReleaseDefinitionSources } from '../data/demo-context.server'
import { expandDefaultRecipeComposition } from '../domain/expand-recipe-composition'
import type { RecipeSlot } from '../domain/types'

/**
 * Regressions for the 2026-08-09 owner-review governed-data corrections (findings F-04,
 * F-05, F-06, F-10 of `docs/ip-device-intelligence/d1-review/owner-review-findings.md`),
 * plus the historical guarantee that makes them safe: every superseded v1-0 release still
 * reconstructs its ORIGINAL semantics through the module and composition ledgers, while the
 * v1-1 releases carry the corrections.
 *
 * Everything here is derived through the real composition expansion — the same path the D1
 * workspace, room/nursing/training previews, and the resolver consume — so a correction that
 * only reached one projection would fail here.
 */

const CONTRACT = { version: 'test', implementationHash: 'test' }

function expandedSlots(recipeVersionId: string): RecipeSlot[] {
  const sources = getReleaseDefinitionSources(recipeVersionId, CONTRACT)
  if (!sources) throw new Error(`Recipe version ${recipeVersionId} did not resolve.`)
  const result = expandDefaultRecipeComposition({
    recipe: sources.recipe,
    recipeModules: sources.modules,
  })
  const blocking = result.messages.filter((message) => message.severity === 'blocking')
  expect(blocking).toEqual([])
  return result.slots
}

function bySourceSlotId(slots: RecipeSlot[], sourceSlotId: string): RecipeSlot {
  const hit = slots.find((slot) => slot.sourceSlotId === sourceSlotId)
  if (!hit) throw new Error(`Expected slot ${sourceSlotId} in the expansion.`)
  return hit
}

describe('F-04 — sampling instruments sit at the procedural field, specimen handling stays at the bench', () => {
  it('places every owner-named EBUS sampling instrument at back_table / diagnostic', () => {
    const slots = expandedSlots('recipe-ebus-tbna-v0-2')
    // FNA needle, FNB needle, intranodal mini-forceps, vacuum-locking syringe.
    for (const sourceSlotId of [
      'SLOT-1AF4BEFE3B',
      'SLOT-B83EBD2FBB',
      'SLOT-D08C74941A',
      'SLOT-E8F0B48B49',
    ]) {
      const slot = bySourceSlotId(slots, sourceSlotId)
      expect({ id: sourceSlotId, zone: slot.setupZone, phase: slot.proceduralPhase }).toEqual({
        id: sourceSlotId,
        zone: 'back_table',
        phase: 'diagnostic',
      })
    }
  })

  it('keeps the EBUS specimen-handling supplies at specimen_station / specimen_handling', () => {
    const slots = expandedSlots('recipe-ebus-tbna-v0-2')
    // Slides/cell-block/formalin/labels, and the airway wash/BAL trap the owner explicitly
    // kept at the bench.
    for (const sourceSlotId of ['SLOT-12ACA27E54', 'SLOT-76F4405D68']) {
      const slot = bySourceSlotId(slots, sourceSlotId)
      expect({ id: sourceSlotId, zone: slot.setupZone, phase: slot.proceduralPhase }).toEqual({
        id: sourceSlotId,
        zone: 'specimen_station',
        phase: 'specimen_handling',
      })
    }
  })

  it('leaves the scope accessories where they already were correct (negative control)', () => {
    const slots = expandedSlots('recipe-ebus-tbna-v0-2')
    // EBUS_BALLOON and EBUS_NEEDLE_ADAPTER were already back_table / diagnostic; the
    // correction must not touch them.
    for (const sourceSlotId of ['SLOT-93655BF7C4', 'SLOT-CD12842559']) {
      const slot = bySourceSlotId(slots, sourceSlotId)
      expect({ id: sourceSlotId, zone: slot.setupZone, phase: slot.proceduralPhase }).toEqual({
        id: sourceSlotId,
        zone: 'back_table',
        phase: 'diagnostic',
      })
    }
  })

  it('corrects the therapeutic sampling instruments and keeps its specimen containers', () => {
    const slots = expandedSlots('recipe-therapeutic-bronch-v0-2')
    for (const sourceSlotId of ['SLOT-D2974FC11B', 'SLOT-FDF73730B0']) {
      const slot = bySourceSlotId(slots, sourceSlotId)
      expect({ id: sourceSlotId, zone: slot.setupZone, phase: slot.proceduralPhase }).toEqual({
        id: sourceSlotId,
        zone: 'back_table',
        phase: 'diagnostic',
      })
    }
    const containers = bySourceSlotId(slots, 'SLOT-0F8FA96C28')
    expect(containers.setupZone).toBe('specimen_station')
    expect(containers.proceduralPhase).toBe('specimen_handling')
  })
})

describe('F-05 — drainage preparation is set up before induction, dressing stays post-procedure', () => {
  /**
   * Deliberately NOT "every Drainage-section row shares one phase". That sweep was the test
   * defect that encoded the over-broad v1-1 behaviour: the MED_THORACOSCOPY `Drainage`
   * section also holds two *insertable devices* (the post-thoracoscopy chest tube and the
   * optional IPC insertion kit), and asserting the section-uniform phase pinned them to
   * pre-induction alongside the actual drainage-preparation hardware. The correction pass
   * (P91-C2, `governed-data-corrections-2026-08-10.test.ts`) places those two at
   * sterile_field / therapeutic per their governed home-procedure precedents; this suite now
   * asserts the drainage-preparation class by exact slot.
   */
  const drainagePreparationBySlot: Record<string, string[]> = {
    'recipe-chest-tube-v0-2': ['SLOT-3631C94D7A', 'SLOT-CE48C1B108', 'SLOT-AECDA16326'],
    'recipe-ipc-placement-v0-2': ['SLOT-3FBC244FAF', 'SLOT-27D1A61598'],
    'recipe-med-thoracoscopy-v0-3': ['SLOT-AA3C2EAA6D'],
    'recipe-thoracentesis-v0-2': ['SLOT-CA34F60BE9', 'SLOT-C174DA0A4E'],
  }

  it.each(Object.entries(drainagePreparationBySlot))(
    'phases the drainage-preparation requirements of %s to pre_induction_or_sedation',
    (recipeVersionId, sourceSlotIds) => {
      const slots = expandedSlots(recipeVersionId)
      for (const sourceSlotId of sourceSlotIds) {
        const slot = bySourceSlotId(slots, sourceSlotId)
        expect({ id: sourceSlotId, zone: slot.setupZone, phase: slot.proceduralPhase }).toEqual({
          id: sourceSlotId,
          zone: 'equipment_tower',
          phase: 'pre_induction_or_sedation',
        })
      }
    },
  )

  it('keeps dressing and securement post-procedure (negative control)', () => {
    const chestTube = bySourceSlotId(expandedSlots('recipe-chest-tube-v0-2'), 'SLOT-4BE1D79D6C')
    expect(chestTube.proceduralPhase).toBe('post_procedure')
    const ipc = bySourceSlotId(expandedSlots('recipe-ipc-placement-v0-2'), 'SLOT-01010CB364')
    expect(ipc.proceduralPhase).toBe('post_procedure')
  })

  it('phases every current Drainage-section row by its semantic class, none post_procedure', () => {
    // The two MED_THORACOSCOPY insertable devices carry per-slot overrides (P91-C2); every
    // other Drainage row is drainage preparation and stays on the F-05 section re-phase.
    const insertableDeviceOverrides: Record<string, 'therapeutic'> = {
      'SLOT-57CA4B1298': 'therapeutic',
      'SLOT-9A1C0491F9': 'therapeutic',
    }
    const drainageRows = (procedureSlots as Array<{ slot_id: string; section: string }>).filter(
      (row) => row.section === 'Drainage',
    )
    expect(drainageRows.length).toBeGreaterThan(0)
    for (const row of drainageRows) {
      const procedure = (procedureSlots as Array<{ slot_id: string; procedure_code: string }>).find(
        (candidate) => candidate.slot_id === row.slot_id,
      )!
      const recipeVersionId = {
        CHEST_TUBE: 'recipe-chest-tube-v0-2',
        IPC_PLACEMENT: 'recipe-ipc-placement-v0-2',
        MED_THORACOSCOPY: 'recipe-med-thoracoscopy-v0-3',
        THORACENTESIS: 'recipe-thoracentesis-v0-2',
      }[procedure.procedure_code]
      expect(recipeVersionId).toBeDefined()
      const slot = bySourceSlotId(expandedSlots(recipeVersionId as string), row.slot_id)
      expect(slot.proceduralPhase).toBe(
        insertableDeviceOverrides[row.slot_id] ?? 'pre_induction_or_sedation',
      )
      expect(slot.proceduralPhase).not.toBe('post_procedure')
    }
  })
})

describe('F-06 — the IPC requirements moved to IPC_PLACEMENT without losing anything', () => {
  const ipcRoles = [
    'IPC_INSERTION_KIT',
    'IPC_DRAINAGE_KIT',
    'IPC_DRESSING_KIT',
    'IPC_MANAGEMENT_ACCESSORY',
  ]

  it('removes all four IPC roles from the current chest-tube expansion', () => {
    const slots = expandedSlots('recipe-chest-tube-v0-2')
    expect(slots).toHaveLength(9)
    expect(slots.map((slot) => slot.roleCode)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^IPC_/)]),
    )
  })

  it('keeps each IPC role exactly once in the IPC_PLACEMENT expansion', () => {
    const slots = expandedSlots('recipe-ipc-placement-v0-2')
    for (const role of ipcRoles) {
      expect(slots.filter((slot) => slot.roleCode === role)).toHaveLength(1)
    }
  })

  it('preserves the authored option sets on the IPC_PLACEMENT slots', () => {
    // The removed CHEST_TUBE rows carried 13/12/2/11 authored options; the same product sets
    // already existed verbatim on the IPC_PLACEMENT slots, so the move loses no authored
    // option knowledge. Pinned here so a later option edit is a deliberate change.
    const optionCounts = Object.fromEntries(
      (
        [
          ['SLOT-1BCF3D0702', 'IPC_INSERTION_KIT'],
          ['SLOT-3FBC244FAF', 'IPC_DRAINAGE_KIT'],
          ['SLOT-6693BCAEE1', 'IPC_DRESSING_KIT'],
          ['SLOT-1E91C231E5', 'IPC_MANAGEMENT_ACCESSORY'],
        ] as const
      ).map(([slotId, role]) => [
        role,
        (slotProductOptions as Array<{ slot_id: string }>).filter(
          (option) => option.slot_id === slotId,
        ).length,
      ]),
    )
    expect(optionCounts).toEqual({
      IPC_INSERTION_KIT: 13,
      IPC_DRAINAGE_KIT: 12,
      IPC_DRESSING_KIT: 2,
      IPC_MANAGEMENT_ACCESSORY: 11,
    })
  })

  it('leaves no orphaned option rows behind for the removed slots', () => {
    const removed = ['SLOT-D02F71E583', 'SLOT-B4E5C6A7A9', 'SLOT-702914B1CF', 'SLOT-67171A33D4']
    for (const slotId of removed) {
      expect(
        (slotProductOptions as Array<{ slot_id: string }>).some(
          (option) => option.slot_id === slotId,
        ),
      ).toBe(false)
      expect(
        (procedureSlots as Array<{ slot_id: string }>).some((row) => row.slot_id === slotId),
      ).toBe(false)
    }
  })
})

describe('F-10 — the flexible core carries the bite block and airway adapter for every consumer', () => {
  const consumers = ['recipe-ebus-tbna-v0-2', 'recipe-therapeutic-bronch-v0-2']

  it.each(consumers)(
    '%s expands with exactly one of each, dependency rules intact',
    (recipeVersionId) => {
      const slots = expandedSlots(recipeVersionId)
      const biteBlocks = slots.filter((slot) => slot.requirementKey === 'FLEX_BRONCH_BITE_BLOCK')
      const adapters = slots.filter((slot) => slot.requirementKey === 'FLEX_BRONCH_AIRWAY_ADAPTER')
      expect(biteBlocks).toHaveLength(1)
      expect(adapters).toHaveLength(1)
      expect(slots.filter((slot) => slot.roleCode === 'BITE_BLOCK')).toHaveLength(1)
      expect(slots.filter((slot) => slot.roleCode === 'GENERIC_AIRWAY_ADAPTER')).toHaveLength(1)
      // The existing governed dependency semantics travelled with the requirements.
      expect(biteBlocks[0].requiredness).toBe('conditional')
      expect(biteBlocks[0].dependencyRule).toBe('Oral insertion without protected airway')
      expect(adapters[0].requiredness).toBe('conditional')
      expect(adapters[0].dependencyRule).toBe('Mechanically ventilated patient')
    },
  )

  it('produces no duplicate requirement key in any current expansion', () => {
    for (const recipeVersionId of [
      'recipe-ebus-tbna-v0-2',
      'recipe-therapeutic-bronch-v0-2',
      'recipe-chest-tube-v0-2',
      'recipe-thoracentesis-v0-2',
      'recipe-ipc-placement-v0-2',
      'recipe-med-thoracoscopy-v0-3',
    ]) {
      const slots = expandedSlots(recipeVersionId)
      const keys = slots.map((slot) => slot.requirementKey)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
})

describe('historical reconstruction — the superseded v1-0 releases keep their original semantics', () => {
  it('resolves the old EBUS recipe with the needles still at the specimen station and no flex-core additions', () => {
    const slots = expandedSlots('recipe-ebus-tbna-v0-1')
    expect(slots).toHaveLength(15)
    const fnaNeedle = bySourceSlotId(slots, 'SLOT-1AF4BEFE3B')
    // The historical release must NOT inherit the correction: it reconstructs what was
    // published, wrong zone and all.
    expect(fnaNeedle.setupZone).toBe('specimen_station')
    expect(fnaNeedle.proceduralPhase).toBe('specimen_handling')
    expect(slots.some((slot) => slot.requirementKey === 'FLEX_BRONCH_BITE_BLOCK')).toBe(false)
    expect(slots.some((slot) => slot.requirementKey === 'FLEX_BRONCH_AIRWAY_ADAPTER')).toBe(false)
  })

  it('resolves the old chest-tube recipe with its four IPC lines and post-procedure drainage', () => {
    const slots = expandedSlots('recipe-chest-tube-v0-1')
    expect(slots).toHaveLength(13)
    for (const role of [
      'IPC_INSERTION_KIT',
      'IPC_DRAINAGE_KIT',
      'IPC_DRESSING_KIT',
      'IPC_MANAGEMENT_ACCESSORY',
    ]) {
      expect(slots.filter((slot) => slot.roleCode === role)).toHaveLength(1)
    }
    const drainageUnit = bySourceSlotId(slots, 'SLOT-3631C94D7A')
    expect(drainageUnit.proceduralPhase).toBe('post_procedure')
  })

  it('resolves the old flexible core at exactly its published two requirements', () => {
    const sources = getReleaseDefinitionSources('recipe-ebus-tbna-v0-1', CONTRACT)!
    const oldCore = sources.modules.find((module) => module.id === 'module-flex-bronch-core-v1-0')!
    expect(oldCore.slots.map((slot) => slot.requirementKey).sort()).toEqual([
      'FLEX_BRONCH_SUCTION_SETUP',
      'FLEX_BRONCH_VIDEO_PROCESSOR',
    ])
  })

  it('resolves the old therapeutic recipe with the bite block under its original identity', () => {
    const slots = expandedSlots('recipe-therapeutic-bronch-v0-1')
    expect(slots).toHaveLength(29)
    const biteBlock = bySourceSlotId(slots, 'SLOT-D6B291DC80')
    expect(biteBlock.requirementKey).toBe('SLOT-D6B291DC80')
    expect(slots.some((slot) => slot.roleCode === 'GENERIC_AIRWAY_ADAPTER')).toBe(false)
  })

  it('resolves the old custom composition against the nineteen v1-0 module versions', () => {
    const sources = getReleaseDefinitionSources('recipe-custom-composition-v1-0', CONTRACT)!
    expect(sources.recipe.moduleReferences).toHaveLength(19)
    for (const reference of sources.recipe.moduleReferences) {
      expect(reference.moduleVersionId).toMatch(/-v1-0$/)
    }
  })
})
