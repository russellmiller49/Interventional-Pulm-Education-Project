import definitionSetLedgerJson from '../../../../data/ip-preference-cards/generated/definition-set-ledger.json'
import releaseBundlesJson from '../../../../data/ip-preference-cards/generated/release-bundles.json'

import {
  COMPATIBILITY_RULE_SET_DEFINITION_ID,
  MODIFIER_SET_DEFINITION_ID,
  RESCUE_MODULE_SET_DEFINITION_ID,
  ROLE_TAXONOMY_DEFINITION_ID,
  type PreferenceCardReleaseBundle,
  type RoleTaxonomySnapshot,
} from '../domain/release-bundle'
import {
  createDefinitionSetResolver,
  definitionSetContentHash,
  emptyDefinitionSetLedger,
  liveTaxonomyExtendsRetained,
  validateDefinitionSetLedger,
  withPublishedDefinitionSets,
  type DefinitionSetLedger,
  type DefinitionSetLedgerEntry,
  type LiveDefinitionSets,
} from '../domain/definition-set-ledger'
import {
  buildPublicationBaselineSnapshot,
  comparePublicationBaseline,
  type PublicationArtifacts,
} from '../domain/publication-baseline'
import { getLiveDefinitionSets } from '../data/demo-context.server'
import { stableStringify } from '../domain/stable-hash'
import type { ModifierDefinition, RescueModule, TypedCompatibilityRule } from '../domain/types'

/**
 * The definition-set retention ledger — the mechanism that lets a published release outlive
 * the live definition sets it pinned, exactly as `module-ledger.ts` does for module versions
 * and `composition-ledger.ts` does for recipe versions, one level up: these four sets have no
 * version ids at all, so entries are addressed by (set id, content hash) — the exact pair a
 * release pin names.
 *
 * The synthetic fixtures below deliberately exercise all four retained kinds with two
 * generations of content each, because the first real divergence (F-09) moves only the
 * modifier set — and a ledger proven for one kind and assumed for three would be exactly the
 * kind of untested retention this feature refuses elsewhere.
 */

function modifier(code: string, description: string): ModifierDefinition {
  return {
    code,
    name: `Fixture modifier ${code}`,
    groupCode: 'technique' as ModifierDefinition['groupCode'],
    description,
    releaseState: 'mvp',
    active: true,
    appliesTo: 'fixture',
    preview: [`${code} preview`],
    conflictsWith: [],
    actions: [],
  }
}

function rescueModule(code: string, description: string): RescueModule {
  return { code, name: `Fixture rescue ${code}`, description, slots: [] }
}

function compatibilityRule(id: string, message: string): TypedCompatibilityRule {
  return {
    id,
    sourceRoleCode: 'FIXTURE_SOURCE',
    targetRoleCode: 'FIXTURE_TARGET',
    sourceAttribute: 'fixture_attribute',
    targetAttribute: 'fixture_attribute',
    operator: 'equals' as TypedCompatibilityRule['operator'],
    expectedValue: true,
    unit: null,
    severity: 'warning',
    message,
    missingValueMessage: `${message} (missing value)`,
    active: true,
    modifierCodes: [],
    evidenceSourceId: null,
  }
}

const taxonomyV1: RoleTaxonomySnapshot = {
  categories: ['Fixture category A'],
  legacyCategoryMap: { 'Old heading': 'Fixture category A' },
  categoryOverrides: {},
  roleCodeAliases: { OLD_ROLE: 'NEW_ROLE' },
}

const taxonomyV2: RoleTaxonomySnapshot = {
  categories: ['Fixture category A', 'Fixture category B'],
  legacyCategoryMap: { 'Old heading': 'Fixture category A' },
  categoryOverrides: { SOME_ROLE: 'Fixture category B' },
  roleCodeAliases: { OLD_ROLE: 'NEW_ROLE', OLDER_ROLE: 'NEW_ROLE' },
}

/** Two complete generations of the four live sets. V2 is "live"; V1 is only retained. */
const setsV1: LiveDefinitionSets = {
  modifiers: [modifier('FIXTURE_MOD', 'first generation')],
  rescueModules: [rescueModule('FIXTURE_RESCUE', 'first generation')],
  compatibilityRules: [compatibilityRule('FIXTURE-RULE', 'first generation')],
  roleTaxonomy: taxonomyV1,
}
const setsV2: LiveDefinitionSets = {
  modifiers: [modifier('FIXTURE_MOD', 'second generation')],
  rescueModules: [rescueModule('FIXTURE_RESCUE', 'second generation')],
  compatibilityRules: [compatibilityRule('FIXTURE-RULE', 'second generation')],
  roleTaxonomy: taxonomyV2,
}

function hashesOf(sets: LiveDefinitionSets) {
  return {
    modifiers: definitionSetContentHash({
      definitionSetId: MODIFIER_SET_DEFINITION_ID,
      definition: sets.modifiers,
    }),
    rescueModules: definitionSetContentHash({
      definitionSetId: RESCUE_MODULE_SET_DEFINITION_ID,
      definition: sets.rescueModules,
    }),
    compatibilityRules: definitionSetContentHash({
      definitionSetId: COMPATIBILITY_RULE_SET_DEFINITION_ID,
      definition: sets.compatibilityRules,
    }),
    roleTaxonomy: definitionSetContentHash({
      definitionSetId: ROLE_TAXONOMY_DEFINITION_ID,
      definition: sets.roleTaxonomy,
    }),
  }
}

const v1 = hashesOf(setsV1)
const v2 = hashesOf(setsV2)

/** The ledger after release A published the V1 sets. */
function ledgerWithV1(): DefinitionSetLedger {
  return withPublishedDefinitionSets(emptyDefinitionSetLedger(), [
    {
      content: { definitionSetId: MODIFIER_SET_DEFINITION_ID, definition: setsV1.modifiers },
      releaseBundleId: 'release-fixture-v1-0',
    },
    {
      content: {
        definitionSetId: RESCUE_MODULE_SET_DEFINITION_ID,
        definition: setsV1.rescueModules,
      },
      releaseBundleId: 'release-fixture-v1-0',
    },
    {
      content: {
        definitionSetId: COMPATIBILITY_RULE_SET_DEFINITION_ID,
        definition: setsV1.compatibilityRules,
      },
      releaseBundleId: 'release-fixture-v1-0',
    },
    {
      content: { definitionSetId: ROLE_TAXONOMY_DEFINITION_ID, definition: setsV1.roleTaxonomy },
      releaseBundleId: 'release-fixture-v1-0',
    },
  ])
}

describe('withPublishedDefinitionSets', () => {
  it('appends a newly published set verbatim with its hash and provenance', () => {
    const ledger = ledgerWithV1()
    expect(ledger.entries).toHaveLength(4)
    const modifierEntry = ledger.entries.find(
      (entry) => entry.definitionSetId === MODIFIER_SET_DEFINITION_ID,
    ) as DefinitionSetLedgerEntry
    expect(modifierEntry.definitionHash).toBe(v1.modifiers)
    expect(stableStringify(modifierEntry.definition)).toBe(stableStringify(setsV1.modifiers))
    expect(modifierEntry.firstPublishedByReleaseBundleId).toBe('release-fixture-v1-0')
  })

  it('retains two generations of one set kind side by side, addressed by exact hash', () => {
    const ledger = withPublishedDefinitionSets(ledgerWithV1(), [
      {
        content: { definitionSetId: MODIFIER_SET_DEFINITION_ID, definition: setsV2.modifiers },
        releaseBundleId: 'release-fixture-v1-1',
      },
    ])
    const modifierEntries = ledger.entries.filter(
      (entry) => entry.definitionSetId === MODIFIER_SET_DEFINITION_ID,
    )
    expect(modifierEntries.map((entry) => entry.definitionHash).sort()).toEqual(
      [v1.modifiers, v2.modifiers].sort(),
    )
  })

  it('never rewrites an existing entry, even when the published content now differs', () => {
    const before = ledgerWithV1()
    // Republishing the same hash from a different release must change nothing at all —
    // including the recorded first publisher.
    const after = withPublishedDefinitionSets(before, [
      {
        content: { definitionSetId: MODIFIER_SET_DEFINITION_ID, definition: setsV1.modifiers },
        releaseBundleId: 'release-fixture-v9-9',
      },
    ])
    expect(JSON.stringify(after)).toBe(JSON.stringify(before))
  })

  it('is deterministic: a second generation over the same inputs is byte-identical', () => {
    expect(JSON.stringify(ledgerWithV1())).toBe(JSON.stringify(ledgerWithV1()))
  })
})

describe('validateDefinitionSetLedger', () => {
  const pinsForV1 = new Map<string, ReadonlySet<string>>([
    [MODIFIER_SET_DEFINITION_ID, new Set([v1.modifiers])],
    [RESCUE_MODULE_SET_DEFINITION_ID, new Set([v1.rescueModules])],
    [COMPATIBILITY_RULE_SET_DEFINITION_ID, new Set([v1.compatibilityRules])],
    [ROLE_TAXONOMY_DEFINITION_ID, new Set([v1.roleTaxonomy])],
  ])

  it('accepts a coherent ledger serving historical pins after every live set moved on', () => {
    expect(
      validateDefinitionSetLedger({
        ledger: ledgerWithV1(),
        pinnedSetHashes: pinsForV1,
        live: setsV2,
      }),
    ).toEqual([])
  })

  it('detects an entry edited in place', () => {
    const ledger = ledgerWithV1()
    const entry = ledger.entries.find(
      (candidate) => candidate.definitionSetId === MODIFIER_SET_DEFINITION_ID,
    ) as Extract<DefinitionSetLedgerEntry, { definitionSetId: typeof MODIFIER_SET_DEFINITION_ID }>
    entry.definition = setsV2.modifiers
    const messages = validateDefinitionSetLedger({
      ledger,
      pinnedSetHashes: pinsForV1,
      live: setsV2,
    })
    expect(messages.map((message) => message.code)).toContain('definition_set_ledger_entry_mutated')
  })

  it('rejects two entries claiming one (set, hash) key', () => {
    const ledger = ledgerWithV1()
    ledger.entries.push({ ...ledger.entries[0] })
    const messages = validateDefinitionSetLedger({
      ledger,
      pinnedSetHashes: pinsForV1,
      live: setsV2,
    })
    expect(messages.map((message) => message.code)).toContain(
      'definition_set_ledger_duplicate_entry',
    )
  })

  it('rejects an unknown set kind rather than skipping it', () => {
    const ledger = ledgerWithV1()
    ledger.entries.push({
      ...ledger.entries[0],
      definitionSetId: 'definition-set-imaginary',
    } as unknown as DefinitionSetLedgerEntry)
    const messages = validateDefinitionSetLedger({
      ledger,
      pinnedSetHashes: pinsForV1,
      live: setsV2,
    })
    expect(messages.map((message) => message.code)).toContain('definition_set_ledger_unknown_set')
  })

  it('reports a published pin that is neither the live set nor a retained entry', () => {
    const messages = validateDefinitionSetLedger({
      ledger: emptyDefinitionSetLedger(),
      pinnedSetHashes: pinsForV1,
      live: setsV2,
    })
    expect(
      messages.filter((message) => message.code === 'definition_set_ledger_entry_missing'),
    ).toHaveLength(4)
  })

  it('does not demand a ledger entry for a pin the live set still satisfies', () => {
    const pinsForV2 = new Map<string, ReadonlySet<string>>([
      [MODIFIER_SET_DEFINITION_ID, new Set([v2.modifiers])],
    ])
    expect(
      validateDefinitionSetLedger({
        ledger: emptyDefinitionSetLedger(),
        pinnedSetHashes: pinsForV2,
        live: setsV2,
      }),
    ).toEqual([])
  })
})

describe('createDefinitionSetResolver', () => {
  const resolver = createDefinitionSetResolver(setsV2, ledgerWithV1())

  it('resolves a live pin to the live content and a retained pin to the retained content', () => {
    expect(resolver.modifiers(v2.modifiers)).toBe(setsV2.modifiers)
    expect(stableStringify(resolver.modifiers(v1.modifiers))).toBe(
      stableStringify(setsV1.modifiers),
    )
  })

  it('resolves both generations of all four kinds in one process, in any call order', () => {
    // Interleave old and new across every kind, twice, in both directions. Resolution is a
    // pure lookup keyed by the pinned hash, so no call may affect any other.
    for (const pass of [0, 1]) {
      expect(resolver.modifiers(v1.modifiers)?.[0].description).toBe('first generation')
      expect(resolver.modifiers(v2.modifiers)?.[0].description).toBe('second generation')
      expect(resolver.rescueModules(v2.rescueModules)?.[0].description).toBe('second generation')
      expect(resolver.rescueModules(v1.rescueModules)?.[0].description).toBe('first generation')
      expect(resolver.compatibilityRules(v1.compatibilityRules)?.[0].message).toBe(
        'first generation',
      )
      expect(resolver.compatibilityRules(v2.compatibilityRules)?.[0].message).toBe(
        'second generation',
      )
      expect(resolver.roleTaxonomy(v2.roleTaxonomy)?.categories).toHaveLength(2)
      expect(resolver.roleTaxonomy(v1.roleTaxonomy)?.categories).toHaveLength(1)
      expect(resolver.modifiers(v1.modifiers)?.[0].description).toBe('first generation')
      void pass
    }
  })

  it('returns null for a pin that matches neither live content nor a retained entry', () => {
    expect(resolver.modifiers('0'.repeat(64))).toBeNull()
    expect(resolver.rescueModules(v1.modifiers)).toBeNull()
    expect(resolver.roleTaxonomy(v1.compatibilityRules)).toBeNull()
  })
})

describe('liveTaxonomyExtendsRetained', () => {
  it('accepts a live table that only extends what the retained snapshot holds', () => {
    expect(liveTaxonomyExtendsRetained(taxonomyV2, taxonomyV1)).toBe(true)
    expect(liveTaxonomyExtendsRetained(taxonomyV1, taxonomyV1)).toBe(true)
  })

  it('rejects a retargeted alias, a dropped category, and a changed override', () => {
    expect(
      liveTaxonomyExtendsRetained(
        { ...taxonomyV1, roleCodeAliases: { OLD_ROLE: 'DIFFERENT_ROLE' } },
        taxonomyV1,
      ),
    ).toBe(false)
    expect(liveTaxonomyExtendsRetained({ ...taxonomyV1, categories: [] }, taxonomyV1)).toBe(false)
    expect(
      liveTaxonomyExtendsRetained(taxonomyV1, {
        ...taxonomyV1,
        categoryOverrides: { SOME_ROLE: 'Fixture category A' },
      }),
    ).toBe(false)
  })
})

describe('the committed definition-set ledger', () => {
  const committed = definitionSetLedgerJson as unknown as DefinitionSetLedger
  const bundles = (releaseBundlesJson as { bundles: PreferenceCardReleaseBundle[] }).bundles
  const live = getLiveDefinitionSets()

  it('re-hashes every retained entry to its recorded key', () => {
    for (const entry of committed.entries) {
      expect(definitionSetContentHash(entry)).toBe(entry.definitionHash)
    }
  })

  it('retains every set pin of every frozen release, or the live set still matches it', () => {
    const messages = validateDefinitionSetLedger({
      ledger: committed,
      pinnedSetHashes: bundles
        .filter((bundle) => bundle.releaseState !== 'draft')
        .reduce((index, bundle) => {
          for (const pin of [
            bundle.modifierSetPin,
            bundle.rescueModuleSetPin,
            bundle.compatibilityRuleSetPin,
            bundle.roleTaxonomyPin,
          ]) {
            const existing = index.get(pin.id) ?? new Set<string>()
            existing.add(pin.definitionHash)
            index.set(pin.id, existing)
          }
          return index
        }, new Map<string, Set<string>>()),
      live,
    })
    expect(messages).toEqual([])
  })

  it('holds content-identical copies of every set whose hash the live sources still produce', () => {
    // The verbatim-capture proof: an entry that claims the live hash must BE the live
    // content. At the retention foundation commit this covers every entry; after a live set
    // moves on, it keeps covering the entries that claim to be current.
    const liveByKey = new Map<string, unknown>([
      [`${MODIFIER_SET_DEFINITION_ID}@${hashesOf(live).modifiers}`, live.modifiers],
      [`${RESCUE_MODULE_SET_DEFINITION_ID}@${hashesOf(live).rescueModules}`, live.rescueModules],
      [
        `${COMPATIBILITY_RULE_SET_DEFINITION_ID}@${hashesOf(live).compatibilityRules}`,
        live.compatibilityRules,
      ],
      [`${ROLE_TAXONOMY_DEFINITION_ID}@${hashesOf(live).roleTaxonomy}`, live.roleTaxonomy],
    ])
    let covered = 0
    for (const entry of committed.entries) {
      const liveContent = liveByKey.get(`${entry.definitionSetId}@${entry.definitionHash}`)
      if (liveContent === undefined) continue
      expect(stableStringify(entry.definition)).toBe(stableStringify(liveContent))
      covered += 1
    }
    expect(covered).toBeGreaterThan(0)
  })

  it('retains every retained role taxonomy the live table still agrees with', () => {
    for (const entry of committed.entries) {
      if (entry.definitionSetId !== ROLE_TAXONOMY_DEFINITION_ID) continue
      expect(liveTaxonomyExtendsRetained(live.roleTaxonomy, entry.definition)).toBe(true)
    }
  })
})

describe('publication-baseline protection for the definition-set ledger', () => {
  function artifacts(ledger: DefinitionSetLedger | null): PublicationArtifacts {
    return {
      releaseBundles: null,
      moduleLedger: null,
      compositionLedger: null,
      definitionSetLedger: ledger,
      catalogReleases: null,
      productFamilies: null,
    }
  }

  function compare(base: DefinitionSetLedger | null, head: DefinitionSetLedger | null) {
    return comparePublicationBaseline({
      base: buildPublicationBaselineSnapshot(artifacts(base)),
      head: buildPublicationBaselineSnapshot(artifacts(head)),
    })
  }

  it('reports a new retained set as an addition, never a violation', () => {
    const comparison = compare(emptyDefinitionSetLedger(), ledgerWithV1())
    expect(comparison.violations).toEqual([])
    expect(comparison.added.map((entry) => entry.kind)).toEqual([
      'definition-set',
      'definition-set',
      'definition-set',
      'definition-set',
    ])
  })

  it('rejects removing a retained entry the protected base publishes', () => {
    const head = ledgerWithV1()
    head.entries = head.entries.filter(
      (entry) => entry.definitionSetId !== MODIFIER_SET_DEFINITION_ID,
    )
    const comparison = compare(ledgerWithV1(), head)
    expect(comparison.violations.map((violation) => violation.code)).toEqual([
      'publication_entry_removed',
    ])
  })

  it('rejects the consistent rewrite: new content under a matching new hash reads as removal', () => {
    const head = withPublishedDefinitionSets(
      {
        formatVersion: '1.0',
        entries: ledgerWithV1().entries.filter(
          (entry) => entry.definitionSetId !== MODIFIER_SET_DEFINITION_ID,
        ),
      },
      [
        {
          content: { definitionSetId: MODIFIER_SET_DEFINITION_ID, definition: setsV2.modifiers },
          releaseBundleId: 'release-fixture-v1-0',
        },
      ],
    )
    const comparison = compare(ledgerWithV1(), head)
    expect(comparison.violations.map((violation) => violation.code)).toEqual([
      'publication_entry_removed',
    ])
  })

  it('accepts appending a second generation beside a retained first', () => {
    const head = withPublishedDefinitionSets(ledgerWithV1(), [
      {
        content: { definitionSetId: MODIFIER_SET_DEFINITION_ID, definition: setsV2.modifiers },
        releaseBundleId: 'release-fixture-v1-1',
      },
    ])
    const comparison = compare(ledgerWithV1(), head)
    expect(comparison.violations).toEqual([])
    expect(comparison.added).toHaveLength(1)
  })
})
