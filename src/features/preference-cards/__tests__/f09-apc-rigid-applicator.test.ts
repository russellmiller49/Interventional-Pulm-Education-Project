import {
  buildDemoContext,
  defaultBuildInput,
  getLiveDefinitionSets,
  getScenarioDefinitions,
  resolveDemoScenario,
} from '../data/demo-context.server'
import {
  buildReleaseContext,
  getCurrentReleaseBundle,
  getReleaseBundle,
  resolveReleaseDefinitions,
} from '../data/release-bundles.server'
import definitionSetLedgerJson from '../../../../data/ip-preference-cards/generated/definition-set-ledger.json'
import { MODIFIER_SET_DEFINITION_ID, diffReleaseBundles } from '../domain/release-bundle'
import type { DefinitionSetLedger } from '../domain/definition-set-ledger'
import { expandEffectiveSlots } from '../domain/effective-slots'
import { resolveCard } from '../domain/resolve-card'
import { stableStringify } from '../domain/stable-hash'
import type { ModifierDefinition, ResolvedCard } from '../domain/types'

/**
 * Owner-review finding F-09 (2026-08-09): the rigid APC applicator the APC modifier adds
 * (`OPS-APC-RIGID`, role `APC_APPLICATOR_RIGID`) was authored `required` with no dependency
 * rule, so selecting APC on a flexible-only case demanded rigid hardware the case cannot use.
 * The owner-authorized correction: `conditional` with dependency rule "Rigid system in use" —
 * the same model the governed data already uses for this role on the rigid-specific module
 * ("Rigid APC planned").
 *
 * The correction is the first real divergence between a live definition set and a published
 * pin, so this suite pins both halves: the corrected semantics on the new releases, and the
 * original semantics on every superseded release, resolving side by side in one process
 * through the definition-set ledger.
 */

const OLD_MODIFIER_SET_HASH = 'e333509636d4564b0216037d0115fd0bb7718a2527267833ad365d1dd279f165'
const NEW_MODIFIER_SET_HASH = 'a9758b0b0ace11f1fd65c2695b55acf1f512c23c560cb1dfa54514e782f9c3bf'

const OLD_THERAPEUTIC_RELEASE = 'release-therapeutic-bronch-v1-1'
const NEW_THERAPEUTIC_RELEASE = 'release-therapeutic-bronch-v1-2'
const OLD_RIGID_RELEASE = 'release-rigid-bronch-v1-0'
const NEW_RIGID_RELEASE = 'release-rigid-bronch-v1-1'

const THERAPEUTIC_SCENARIO = 'central-airway-obstruction'

const APC_ADDED_SLOTS = [
  'OPS-APC-PLATFORM',
  'OPS-APC-PROBE',
  'OPS-APC-RIGID',
  'OPS-APC-GAS',
  'OPS-APC-CABLE',
  'OPS-APC-FIRE',
]

function itemById(card: ResolvedCard, id: string) {
  return card.items.find((item) => item.id === id)
}

function resolveUnderRelease(releaseBundleId: string, modifierCodes?: string[]): ResolvedCard {
  const release = buildReleaseContext(releaseBundleId)
  if (!release.ok) throw new Error(`release ${releaseBundleId} did not resolve: ${release.code}`)
  const input = defaultBuildInput(release.scenario.id, modifierCodes ? { modifierCodes } : {})
  return resolveCard(input, release.context)
}

describe('flexible-only APC (the corrected behaviour)', () => {
  const card = resolveDemoScenario(THERAPEUTIC_SCENARIO, { modifierCodes: ['APC'] })
  const rigidApplicator = itemById(card, 'OPS-APC-RIGID')!

  it('carries the rigid applicator as conditional on "Rigid system in use", not required', () => {
    expect(rigidApplicator).toBeDefined()
    expect(rigidApplicator.requiredness).toBe('conditional')
    expect(rigidApplicator.effectiveRequiredness).toBe('conditional')
    expect(rigidApplicator.dependencyRule).toBe('Rigid system in use')
    expect(rigidApplicator.conditionalState).toBe('undecided')
  })

  it('raises no unresolved-required warning for the rigid applicator', () => {
    // Deselect the applicator to prove absence alone is no longer a complaint. The demo
    // formulary maps the role, so the default selection has to be cleared explicitly.
    const withoutSelection = resolveDemoScenario(THERAPEUTIC_SCENARIO, {
      modifierCodes: ['APC'],
      selectedHospitalItemIds: { 'OPS-APC-RIGID': null },
    })
    expect(itemById(withoutSelection, 'OPS-APC-RIGID')!.selectedHospitalItemId).toBeNull()
    expect(
      withoutSelection.warnings.filter(
        (warning) =>
          warning.code === 'required_role_unresolved' && warning.sourceId === 'OPS-APC-RIGID',
      ),
    ).toEqual([])
  })

  it('keeps the other five APC additions exactly as authored, including fire readiness', () => {
    for (const id of APC_ADDED_SLOTS.filter((slotId) => slotId !== 'OPS-APC-RIGID')) {
      const item = itemById(card, id)!
      expect(item).toBeDefined()
      expect(item.requiredness).toBe('required')
      expect(item.dependencyRule).toBeNull()
    }
    expect(itemById(card, 'OPS-APC-FIRE')!.roleCode).toBe('LOCAL_AIRWAY_FIRE_READINESS')
  })
})

describe('APC with the rigid airway modifier', () => {
  it('presents the applicator through the canonical conditional model, with include honoured', () => {
    // No automatic promotion is invented: co-selecting RIGID_AIRWAY leaves the conditional
    // undecided until the physician answers it, exactly as the resolver treats every other
    // dependency-ruled slot ("Rigid APC planned" on RIGID_BRONCH included).
    const undecided = resolveDemoScenario(THERAPEUTIC_SCENARIO, {
      modifierCodes: ['RIGID_AIRWAY', 'APC'],
    })
    const row = itemById(undecided, 'OPS-APC-RIGID')!
    expect(row.requiredness).toBe('conditional')
    expect(row.effectiveRequiredness).toBe('conditional')
    expect(row.dependencyRule).toBe('Rigid system in use')

    const included = resolveDemoScenario(THERAPEUTIC_SCENARIO, {
      modifierCodes: ['RIGID_AIRWAY', 'APC'],
      conditionalStates: { 'OPS-APC-RIGID': 'include' },
    })
    expect(itemById(included, 'OPS-APC-RIGID')!.effectiveRequiredness).toBe('required')
  })
})

describe('the superseded releases keep the original semantics', () => {
  it('pins the old modifier set and the old definition hashes, unchanged', () => {
    const oldTherapeutic = getReleaseBundle(OLD_THERAPEUTIC_RELEASE)!
    expect(oldTherapeutic.modifierSetPin.definitionHash).toBe(OLD_MODIFIER_SET_HASH)
    expect(oldTherapeutic.definitionHash).toBe(
      '2105ccd346777f6f48e1de94a0a913c1b9f10f152b44f409fa64826e1f91d5cb',
    )
    const oldRigid = getReleaseBundle(OLD_RIGID_RELEASE)!
    expect(oldRigid.modifierSetPin.definitionHash).toBe(OLD_MODIFIER_SET_HASH)
    expect(oldRigid.definitionHash).toBe(
      '4a9676ea84ecc2eb74fea7e55c7bfc600b398c9638a4feeb10cd67939f736885',
    )
  })

  it('reconstructs an old card with the rigid applicator still hard-required', () => {
    const card = resolveUnderRelease(OLD_THERAPEUTIC_RELEASE)
    const row = itemById(card, 'OPS-APC-RIGID')!
    expect(row.requiredness).toBe('required')
    expect(row.effectiveRequiredness).toBe('required')
    expect(row.dependencyRule).toBeNull()
    expect(row.conditionalState).toBeNull()
  })
})

describe('the new current releases carry the correction', () => {
  it('are the pointer targets and pin the new modifier set', () => {
    expect(getCurrentReleaseBundle('THERAPEUTIC_BRONCH')!.id).toBe(NEW_THERAPEUTIC_RELEASE)
    expect(getCurrentReleaseBundle('RIGID_BRONCH')!.id).toBe(NEW_RIGID_RELEASE)
    for (const id of [NEW_THERAPEUTIC_RELEASE, NEW_RIGID_RELEASE]) {
      expect(getReleaseBundle(id)!.modifierSetPin.definitionHash).toBe(NEW_MODIFIER_SET_HASH)
    }
  })

  it('resolve the applicator as conditional with the exact owner-authorized dependency', () => {
    const card = resolveUnderRelease(NEW_THERAPEUTIC_RELEASE)
    const row = itemById(card, 'OPS-APC-RIGID')!
    expect(row.requiredness).toBe('conditional')
    expect(row.dependencyRule).toBe('Rigid system in use')
  })

  it('did not advance any procedure that cannot reach APC', () => {
    // Mixed current set pins are the intended end state: only the two procedures whose
    // allowed modifiers include APC consume the corrected set.
    const advanced: string[] = []
    for (const scenario of getScenarioDefinitions()) {
      const current = getCurrentReleaseBundle(scenario.sourceProcedureCode)
      if (!current) continue
      if (current.modifierSetPin.definitionHash === NEW_MODIFIER_SET_HASH) {
        advanced.push(current.sourceProcedureCode)
      } else {
        expect(current.modifierSetPin.definitionHash).toBe(OLD_MODIFIER_SET_HASH)
      }
    }
    expect(advanced.sort()).toEqual(['RIGID_BRONCH', 'THERAPEUTIC_BRONCH'])
  })
})

describe('old and new releases resolve simultaneously in one process', () => {
  it('is independent of call order in both directions', () => {
    const firstPassOld = resolveUnderRelease(OLD_THERAPEUTIC_RELEASE)
    const firstPassNew = resolveUnderRelease(NEW_THERAPEUTIC_RELEASE)

    // old → new → old and new → old → new: every re-resolution must be byte-identical to the
    // first, so no lookup can have been contaminated by the one before it.
    const sequences = [
      [OLD_THERAPEUTIC_RELEASE, NEW_THERAPEUTIC_RELEASE, OLD_THERAPEUTIC_RELEASE],
      [NEW_THERAPEUTIC_RELEASE, OLD_THERAPEUTIC_RELEASE, NEW_THERAPEUTIC_RELEASE],
    ]
    for (const sequence of sequences) {
      for (const releaseId of sequence) {
        const expected = releaseId === OLD_THERAPEUTIC_RELEASE ? firstPassOld : firstPassNew
        const card = resolveUnderRelease(releaseId)
        expect(card.resolvedContentHash).toBe(expected.resolvedContentHash)
        expect(itemById(card, 'OPS-APC-RIGID')!.requiredness).toBe(
          releaseId === OLD_THERAPEUTIC_RELEASE ? 'required' : 'conditional',
        )
      }
    }
  })
})

describe('the release comparison surfaces the change instead of normalizing it', () => {
  it('reports exactly one pin change — the modifier set — between v1-1 and v1-2', () => {
    const previous = resolveReleaseDefinitions(OLD_THERAPEUTIC_RELEASE)
    const next = resolveReleaseDefinitions(NEW_THERAPEUTIC_RELEASE)
    if (!previous.ok || !next.ok) throw new Error('both releases must resolve')
    const impact = diffReleaseBundles(previous, next)
    expect(impact.identical).toBe(false)
    expect(impact.pinChanges).toEqual([
      {
        pin: MODIFIER_SET_DEFINITION_ID,
        kind: 'changed',
        previousHash: OLD_MODIFIER_SET_HASH,
        nextHash: NEW_MODIFIER_SET_HASH,
      },
    ])
    // The requirement-level diff covers recipe and module slots; a requirement living inside
    // a modifier's add_slot payload is outside it — the known reporting gap recorded for
    // D1.1. The semantic delta is proven at expansion level below instead.
    expect(impact.requirementChanges).toEqual([])
    expect(impact.catalogImportChanged).toBe(false)
    expect(impact.resolverContractChanged).toBe(false)
  })

  it('shows the requiredness change at expansion level, attributable to OPS-APC-RIGID alone', () => {
    const previous = resolveReleaseDefinitions(OLD_THERAPEUTIC_RELEASE)
    const next = resolveReleaseDefinitions(NEW_THERAPEUTIC_RELEASE)
    if (!previous.ok || !next.ok) throw new Error('both releases must resolve')
    const oldContext = buildReleaseContext(OLD_THERAPEUTIC_RELEASE)
    const newContext = buildReleaseContext(NEW_THERAPEUTIC_RELEASE)
    if (!oldContext.ok || !newContext.ok) throw new Error('both contexts must build')

    const input = defaultBuildInput(THERAPEUTIC_SCENARIO)
    const expansion = (context: typeof oldContext.context) =>
      expandEffectiveSlots(
        {
          selectedModuleVersionIds: input.selectedModuleVersionIds,
          modifierCodes: input.modifierCodes,
        },
        context,
      ).slots

    const before = new Map(expansion(oldContext.context).map((slot) => [slot.id, slot]))
    const after = new Map(expansion(newContext.context).map((slot) => [slot.id, slot]))
    expect([...before.keys()].sort()).toEqual([...after.keys()].sort())
    for (const [id, slot] of before) {
      const nextSlot = after.get(id)!
      if (id === 'OPS-APC-RIGID') {
        expect(slot.requiredness).toBe('required')
        expect(nextSlot.requiredness).toBe('conditional')
        expect(slot.dependencyRule).toBeNull()
        expect(nextSlot.dependencyRule).toBe('Rigid system in use')
        continue
      }
      expect(stableStringify(nextSlot)).toBe(stableStringify(slot))
    }
  })
})

describe('the modifier-set delta is exactly the owner-authorized correction', () => {
  it('differs from the retained set in one modifier, one action, two slot fields', () => {
    const ledger = definitionSetLedgerJson as unknown as DefinitionSetLedger
    const retained = ledger.entries.find(
      (entry) =>
        entry.definitionSetId === MODIFIER_SET_DEFINITION_ID &&
        entry.definitionHash === OLD_MODIFIER_SET_HASH,
    )!
    expect(retained).toBeDefined()
    const oldSet = retained.definition as ModifierDefinition[]
    const newSet = getLiveDefinitionSets().modifiers

    expect(newSet.map((modifier) => modifier.code)).toEqual(oldSet.map((modifier) => modifier.code))
    for (const oldModifier of oldSet) {
      const newModifier = newSet.find((candidate) => candidate.code === oldModifier.code)!
      if (oldModifier.code !== 'APC') {
        expect(stableStringify(newModifier)).toBe(stableStringify(oldModifier))
        continue
      }
      expect(newModifier.actions.map((action) => action.id)).toEqual(
        oldModifier.actions.map((action) => action.id),
      )
      for (const oldAction of oldModifier.actions) {
        const newAction = newModifier.actions.find((candidate) => candidate.id === oldAction.id)!
        const oldSlot = oldAction.payload.slot as Record<string, unknown> | undefined
        const newSlot = newAction.payload.slot as Record<string, unknown> | undefined
        if (!oldSlot || oldSlot.id !== 'OPS-APC-RIGID') {
          expect(stableStringify(newAction)).toBe(stableStringify(oldAction))
          continue
        }
        expect(oldSlot.requiredness).toBe('required')
        expect(newSlot!.requiredness).toBe('conditional')
        expect(oldSlot.dependencyRule).toBeNull()
        expect(newSlot!.dependencyRule).toBe('Rigid system in use')
        for (const key of Object.keys(oldSlot)) {
          if (key === 'requiredness' || key === 'dependencyRule') continue
          expect(stableStringify(newSlot![key])).toBe(stableStringify(oldSlot[key]))
        }
      }
    }
  })

  it('leaves rescue-module reachability untouched on both sides of the correction', () => {
    for (const releaseId of [OLD_THERAPEUTIC_RELEASE, NEW_THERAPEUTIC_RELEASE]) {
      const card = resolveUnderRelease(releaseId, ['APC', 'HIGH_BLEED_RISK'])
      const rescueLines = card.items.filter((item) => item.id.startsWith('RESCUE-BLEED-'))
      expect(rescueLines.length).toBeGreaterThan(0)
    }
  })
})

describe('unpinned surfaces stay coherent with what a new card would pin', () => {
  it('resolves every scenario identically through the demo context and the current release', () => {
    // The D1 workspace, the dashboard, and the new-card preview resolve through the live demo
    // context; a saved card resolves through the pointed-at release. With mixed current set
    // pins this invariant is what keeps the two stories the same: a procedure left on the old
    // modifier set must be unaffected by the correction (APC is outside its allowed
    // modifiers), and an advanced procedure's current release must equal the live sets.
    for (const scenario of getScenarioDefinitions()) {
      const current = getCurrentReleaseBundle(scenario.sourceProcedureCode)
      if (!current) continue
      const release = buildReleaseContext(current.id)
      if (!release.ok) throw new Error(`current release ${current.id} must build`)
      const input = defaultBuildInput(scenario.id)
      const viaDemo = resolveCard(input, buildDemoContext(scenario.id))
      const viaRelease = resolveCard(input, {
        ...release.context,
        // The demo context carries null release identity; provenance is the one legitimate
        // difference between the two resolutions and is excluded from the comparison.
        releaseIdentity: null,
      })
      expect(viaRelease.resolvedContentHash).toBe(viaDemo.resolvedContentHash)
    }
  })
})
