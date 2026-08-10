import {
  COMPATIBILITY_RULE_SET_DEFINITION_ID,
  MODIFIER_SET_DEFINITION_ID,
  RESCUE_MODULE_SET_DEFINITION_ID,
  ROLE_TAXONOMY_DEFINITION_ID,
  compatibilityRuleSetDefinitionHash,
  modifierSetDefinitionHash,
  rescueModuleSetDefinitionHash,
  roleTaxonomyDefinitionHash,
  type RoleTaxonomySnapshot,
} from './release-bundle'
import type { ModifierDefinition, RescueModule, TypedCompatibilityRule } from './types'

export {
  COMPATIBILITY_RULE_SET_DEFINITION_ID,
  MODIFIER_SET_DEFINITION_ID,
  RESCUE_MODULE_SET_DEFINITION_ID,
  ROLE_TAXONOMY_DEFINITION_ID,
}

/**
 * The frozen record of every whole definition set a published release pins.
 *
 * The fourth retention ledger, one level up from `module-ledger.ts` and
 * `composition-ledger.ts`. Those two retain content addressed by a *version id* — a name
 * someone assigned. The four whole-set pins on a release bundle have no version ids at all:
 * a release pins `definition-set-modifiers` at an exact content hash, and until this ledger
 * existed the hash had no retained content behind it. `getReleaseDefinitionSources` supplied
 * the live module constants to every bundle regardless of what the bundle pinned, so the pin
 * could veto — any edit to `seed/operational.ts` made every published release refuse to
 * reconstruct — but never supply. Editing a definition set was therefore impossible without
 * either breaking every saved card or rewriting published hashes, which is the F-09 blocker
 * (`docs/ip-device-intelligence/d1-data-corrections/f09-blocker.md`).
 *
 * So an entry here is addressed by **(set id, content hash)** — the exact pair a release
 * pin names. Content addressing is what the other ledgers approximate with version ids, done
 * literally: two entries for `definition-set-modifiers` under two hashes are two different
 * frozen sets, both resolvable, in the same process, at the same time. Nothing selects an
 * entry by array order, recency, or "latest"; the pin selects it, and a pin present in
 * neither the matching live set nor the ledger is a typed failure, never a fallback to
 * whatever is current.
 *
 * Append-only, like its siblings: entries are added when a release publishes them and
 * removed never. `withPublishedDefinitionSets` returns an existing entry untouched even when
 * the live set now says something different, so it can never be the thing that rewrites
 * history. Integrity is checked in the same tree by `validateDefinitionSetLedger` (an entry
 * must re-hash to its own key) and against the protected base by
 * `check-publication-baseline` (a retained entry must not be removed or rewritten). A
 * consistent rewrite — content and hash together — changes the content-addressed key, which
 * the baseline reads as removing a published entry.
 */

/** The four retained set kinds, keyed by the pin ids the release bundle already uses. */
export type DefinitionSetContent =
  | { definitionSetId: typeof MODIFIER_SET_DEFINITION_ID; definition: ModifierDefinition[] }
  | { definitionSetId: typeof RESCUE_MODULE_SET_DEFINITION_ID; definition: RescueModule[] }
  | {
      definitionSetId: typeof COMPATIBILITY_RULE_SET_DEFINITION_ID
      definition: TypedCompatibilityRule[]
    }
  | { definitionSetId: typeof ROLE_TAXONOMY_DEFINITION_ID; definition: RoleTaxonomySnapshot }

export type DefinitionSetId = DefinitionSetContent['definitionSetId']

export const DEFINITION_SET_IDS = [
  MODIFIER_SET_DEFINITION_ID,
  RESCUE_MODULE_SET_DEFINITION_ID,
  COMPATIBILITY_RULE_SET_DEFINITION_ID,
  ROLE_TAXONOMY_DEFINITION_ID,
] as const

export type DefinitionSetLedgerEntry = DefinitionSetContent & {
  /** The hash a release pinned. Recomputed from `definition` on every validation pass. */
  definitionHash: string
  /** The release that first pinned it, for provenance when reading the file. */
  firstPublishedByReleaseBundleId: string
}

export interface DefinitionSetLedger {
  formatVersion: string
  entries: DefinitionSetLedgerEntry[]
}

export function emptyDefinitionSetLedger(): DefinitionSetLedger {
  return { formatVersion: '1.0', entries: [] }
}

/**
 * The one hash dispatch. An unknown set id throws rather than returning a sentinel, because
 * every caller is about to either freeze or verify a hash — proceeding with an unhashable
 * kind would freeze nothing while appearing to freeze something.
 */
export function definitionSetContentHash(content: DefinitionSetContent): string {
  switch (content.definitionSetId) {
    case MODIFIER_SET_DEFINITION_ID:
      return modifierSetDefinitionHash(content.definition)
    case RESCUE_MODULE_SET_DEFINITION_ID:
      return rescueModuleSetDefinitionHash(content.definition)
    case COMPATIBILITY_RULE_SET_DEFINITION_ID:
      return compatibilityRuleSetDefinitionHash(content.definition)
    case ROLE_TAXONOMY_DEFINITION_ID:
      return roleTaxonomyDefinitionHash(content.definition)
    default: {
      const exhaustive: never = content
      throw new Error(
        `Unknown definition-set id ${(exhaustive as { definitionSetId: string }).definitionSetId}. The retained set kinds are: ${DEFINITION_SET_IDS.join(', ')}.`,
      )
    }
  }
}

function isKnownDefinitionSetId(value: string): value is DefinitionSetId {
  return (DEFINITION_SET_IDS as readonly string[]).includes(value)
}

/** The live sets, in the same shape the ledger retains, for validation and resolution. */
export interface LiveDefinitionSets {
  modifiers: ModifierDefinition[]
  rescueModules: RescueModule[]
  compatibilityRules: TypedCompatibilityRule[]
  roleTaxonomy: RoleTaxonomySnapshot
}

export function liveDefinitionSetContents(live: LiveDefinitionSets): DefinitionSetContent[] {
  return [
    { definitionSetId: MODIFIER_SET_DEFINITION_ID, definition: live.modifiers },
    { definitionSetId: RESCUE_MODULE_SET_DEFINITION_ID, definition: live.rescueModules },
    {
      definitionSetId: COMPATIBILITY_RULE_SET_DEFINITION_ID,
      definition: live.compatibilityRules,
    },
    { definitionSetId: ROLE_TAXONOMY_DEFINITION_ID, definition: live.roleTaxonomy },
  ]
}

export type DefinitionSetLedgerValidationCode =
  | 'definition_set_ledger_entry_mutated'
  | 'definition_set_ledger_duplicate_entry'
  | 'definition_set_ledger_unknown_set'
  | 'definition_set_ledger_entry_missing'
  | 'definition_set_ledger_unknown_format'

export const DEFINITION_SET_LEDGER_FORMAT_VERSION = '1.0'

export interface DefinitionSetLedgerValidationMessage {
  code: DefinitionSetLedgerValidationCode
  definitionSetId: string
  definitionHash: string | null
  message: string
}

/**
 * Every way the retained set store can be wrong.
 *
 * Unlike the module and composition ledgers there is no "diverged from live" code here, and
 * the absence is structural rather than an omission: those ledgers key by version id, so the
 * live data can produce *different content under the same key*. This ledger keys by content
 * hash — the same key naming different content is exactly `definition_set_ledger_entry_mutated`
 * (the entry no longer re-hashes to its key), and a changed live set simply produces a *new*
 * key, which is the ordinary forward path rather than a conflict.
 */
export function validateDefinitionSetLedger(input: {
  ledger: DefinitionSetLedger
  /**
   * Every (set id, hash) pair a frozen release pins. Each must resolve — from the matching
   * live set or from the ledger — or the release it belongs to is unreconstructable.
   */
  pinnedSetHashes: ReadonlyMap<string, ReadonlySet<string>>
  live: LiveDefinitionSets
}): DefinitionSetLedgerValidationMessage[] {
  const messages: DefinitionSetLedgerValidationMessage[] = []
  const byKey = new Map<string, DefinitionSetLedgerEntry>()

  // The version field is a real gate, not decoration: content written under a future format
  // must be rejected rather than silently reinterpreted under this one's semantics.
  if (input.ledger.formatVersion !== DEFINITION_SET_LEDGER_FORMAT_VERSION) {
    messages.push({
      code: 'definition_set_ledger_unknown_format',
      definitionSetId: '(ledger)',
      definitionHash: null,
      message: `The definition-set ledger declares format "${input.ledger.formatVersion}"; this code understands "${DEFINITION_SET_LEDGER_FORMAT_VERSION}". Reading it anyway could reinterpret retained content under the wrong semantics.`,
    })
  }

  for (const entry of input.ledger.entries) {
    if (!isKnownDefinitionSetId(entry.definitionSetId)) {
      messages.push({
        code: 'definition_set_ledger_unknown_set',
        definitionSetId: entry.definitionSetId,
        definitionHash: entry.definitionHash,
        message: `Ledger entry claims unknown definition-set id "${entry.definitionSetId}". The retained set kinds are: ${DEFINITION_SET_IDS.join(', ')}. An unknown kind cannot be hashed, so it cannot be verified, so it is not retained.`,
      })
      continue
    }

    const key = `${entry.definitionSetId}@${entry.definitionHash}`
    if (byKey.has(key)) {
      messages.push({
        code: 'definition_set_ledger_duplicate_entry',
        definitionSetId: entry.definitionSetId,
        definitionHash: entry.definitionHash,
        message: `Definition set ${entry.definitionSetId} at ${entry.definitionHash} is recorded more than once. A (set, hash) pair must identify exactly one frozen definition set.`,
      })
      continue
    }
    byKey.set(key, entry)

    const recomputed = definitionSetContentHash(entry)
    if (recomputed !== entry.definitionHash) {
      messages.push({
        code: 'definition_set_ledger_entry_mutated',
        definitionSetId: entry.definitionSetId,
        definitionHash: entry.definitionHash,
        message: `Ledger entry ${entry.definitionSetId}@${entry.definitionHash} no longer hashes to its key (recomputed ${recomputed}). A retained definition set is immutable: new content gets a new hash through a new release, never an edit to a retained entry.`,
      })
    }
  }

  const liveHashBySetId = new Map<string, string>(
    liveDefinitionSetContents(input.live).map((content) => [
      content.definitionSetId,
      definitionSetContentHash(content),
    ]),
  )

  for (const [definitionSetId, hashes] of input.pinnedSetHashes) {
    for (const definitionHash of hashes) {
      if (liveHashBySetId.get(definitionSetId) === definitionHash) continue
      if (byKey.has(`${definitionSetId}@${definitionHash}`)) continue
      messages.push({
        code: 'definition_set_ledger_entry_missing',
        definitionSetId,
        definitionHash,
        message: `A published release pins ${definitionSetId} at ${definitionHash}, which is neither the current live set nor a retained ledger entry. A retained release must stay reconstructable, and a pin never falls back to current content.`,
      })
    }
  }

  return messages
}

/**
 * Fold newly published definition sets into the ledger without disturbing what is already
 * there.
 *
 * Append-only by construction: an existing (set, hash) entry is returned untouched, so this
 * function can never be the thing that rewrites history. Entries are sorted by (set id,
 * hash) so a second generation over the same inputs is byte-identical.
 */
export function withPublishedDefinitionSets(
  ledger: DefinitionSetLedger,
  published: Array<{ content: DefinitionSetContent; releaseBundleId: string }>,
): DefinitionSetLedger {
  const entries = new Map(
    ledger.entries.map((entry) => [`${entry.definitionSetId}@${entry.definitionHash}`, entry]),
  )
  for (const { content, releaseBundleId } of published) {
    const definitionHash = definitionSetContentHash(content)
    const key = `${content.definitionSetId}@${definitionHash}`
    if (entries.has(key)) continue
    entries.set(key, {
      ...content,
      definitionHash,
      firstPublishedByReleaseBundleId: releaseBundleId,
    } as DefinitionSetLedgerEntry)
  }
  return {
    formatVersion: ledger.formatVersion,
    entries: [...entries.values()].sort(
      (left, right) =>
        left.definitionSetId.localeCompare(right.definitionSetId) ||
        left.definitionHash.localeCompare(right.definitionHash),
    ),
  }
}

/**
 * The retained content for exact pins, or null — never a different set.
 *
 * The live set wins when its hash equals the pin, so an ordinary current release reads
 * exactly what it always did and the ledger contributes only the sets nothing current
 * produces any more. Preferring live where the hashes are equal is not a policy choice the
 * way it is in the other ledgers — equal content hashes mean equal content, so the two
 * copies are interchangeable by construction and the live one avoids holding a second copy
 * of everything current.
 *
 * There is deliberately no whole-process state here: the resolver is a pure lookup built
 * once over immutable inputs, keyed by the pinned hash, so two bundles pinning two
 * different modifier sets resolve concurrently, in any order, with nothing to contaminate.
 */
export interface DefinitionSetResolver {
  modifiers(pinnedHash: string): ModifierDefinition[] | null
  rescueModules(pinnedHash: string): RescueModule[] | null
  compatibilityRules(pinnedHash: string): TypedCompatibilityRule[] | null
  roleTaxonomy(pinnedHash: string): RoleTaxonomySnapshot | null
}

export function createDefinitionSetResolver(
  live: LiveDefinitionSets,
  ledger: DefinitionSetLedger,
): DefinitionSetResolver {
  // First entry wins on a duplicate key, matching the validator's indexing exactly — the
  // validator examines the entry the resolver would serve, never a different one. (Duplicate
  // keys are a hard validation failure anyway; this only keeps the two readers aligned while
  // the failure is being reported.)
  const retainedByKey = new Map<string, DefinitionSetLedgerEntry>()
  for (const entry of ledger.entries) {
    const key = `${entry.definitionSetId}@${entry.definitionHash}`
    if (!retainedByKey.has(key)) retainedByKey.set(key, entry)
  }
  const liveHashBySetId = new Map<string, string>(
    liveDefinitionSetContents(live).map((content) => [
      content.definitionSetId,
      definitionSetContentHash(content),
    ]),
  )

  function retained(definitionSetId: DefinitionSetId, pinnedHash: string) {
    const entry = retainedByKey.get(`${definitionSetId}@${pinnedHash}`)
    return entry && entry.definitionSetId === definitionSetId ? entry : null
  }

  return {
    modifiers: (pinnedHash) => {
      if (liveHashBySetId.get(MODIFIER_SET_DEFINITION_ID) === pinnedHash) return live.modifiers
      const entry = retained(MODIFIER_SET_DEFINITION_ID, pinnedHash)
      return entry ? (entry.definition as ModifierDefinition[]) : null
    },
    rescueModules: (pinnedHash) => {
      if (liveHashBySetId.get(RESCUE_MODULE_SET_DEFINITION_ID) === pinnedHash) {
        return live.rescueModules
      }
      const entry = retained(RESCUE_MODULE_SET_DEFINITION_ID, pinnedHash)
      return entry ? (entry.definition as RescueModule[]) : null
    },
    compatibilityRules: (pinnedHash) => {
      if (liveHashBySetId.get(COMPATIBILITY_RULE_SET_DEFINITION_ID) === pinnedHash) {
        return live.compatibilityRules
      }
      const entry = retained(COMPATIBILITY_RULE_SET_DEFINITION_ID, pinnedHash)
      return entry ? (entry.definition as TypedCompatibilityRule[]) : null
    },
    roleTaxonomy: (pinnedHash) => {
      if (liveHashBySetId.get(ROLE_TAXONOMY_DEFINITION_ID) === pinnedHash) {
        return live.roleTaxonomy
      }
      const entry = retained(ROLE_TAXONOMY_DEFINITION_ID, pinnedHash)
      return entry ? (entry.definition as RoleTaxonomySnapshot) : null
    },
  }
}

/**
 * Whether the live role taxonomy is a conservative extension of a retained snapshot.
 *
 * Alias *application* deliberately stays on the live table even for release-pinned cards:
 * permanent role aliases are a forward-acting contract — a card stored under a role code
 * that is renamed later must still resolve, which is the entire point of the alias table
 * being permanent and append-only. Pinning application would break exactly the historical
 * cards retention exists to protect. See `definition-set-retention.md` §3.6.
 *
 * What keeps that from being a silent fallback is this check: the live table may only
 * *extend* what the pinned snapshot retained. Every retained alias must map to the same
 * target, every retained category must still exist, every retained legacy mapping and
 * override must be unchanged. A live table that contradicts the retained one fails the
 * bundle's resolution typed rather than applying either table.
 */
export function liveTaxonomyExtendsRetained(
  live: RoleTaxonomySnapshot,
  retained: RoleTaxonomySnapshot,
): boolean {
  const liveCategories = new Set(live.categories)
  if (!retained.categories.every((category) => liveCategories.has(category))) return false
  const tables: Array<[Readonly<Record<string, string>>, Readonly<Record<string, string>>]> = [
    [live.legacyCategoryMap, retained.legacyCategoryMap],
    [live.categoryOverrides, retained.categoryOverrides],
    [live.roleCodeAliases, retained.roleCodeAliases],
  ]
  return tables.every(([liveTable, retainedTable]) =>
    Object.entries(retainedTable).every(([key, value]) => liveTable[key] === value),
  )
}
