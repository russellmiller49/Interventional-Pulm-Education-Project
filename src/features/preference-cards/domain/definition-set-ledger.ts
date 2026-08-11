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
  | 'definition_set_attribution_unknown_release'
  | 'definition_set_attribution_unpublished_release'
  | 'definition_set_attribution_release_does_not_pin'
  | 'definition_set_attribution_not_first_publisher'
  | 'definition_set_attribution_unorderable_release'

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
 * A frozen release's lifecycle facts and whole-set pins, as the attribution validator and
 * the deterministic first-publisher derivation consume them.
 */
export interface PublishedSetPinRecord {
  releaseBundleId: string
  /** `published` or `retired` — a retired release stays published history. Never `draft`. */
  releaseState: string
  publishedAt: string | null
  pins: ReadonlyArray<{ definitionSetId: string; definitionHash: string }>
}

/**
 * The repository's canonical publication ordering, in one place.
 *
 * `publishedAt` ascending — ISO-8601 strings, so lexicographic comparison is chronological —
 * with the release id as the deterministic tiebreak for the same instant (the foundation
 * freeze published fifteen releases at one timestamp). Nothing here reads ledger entry
 * order, seed array order, or supersession chains: the ordering is a pure function of the
 * lifecycle facts every frozen release is already required to record.
 */
export function comparePublicationOrder(
  left: { releaseBundleId: string; publishedAt: string | null },
  right: { releaseBundleId: string; publishedAt: string | null },
): number {
  return (
    (left.publishedAt ?? '').localeCompare(right.publishedAt ?? '') ||
    left.releaseBundleId.localeCompare(right.releaseBundleId)
  )
}

/**
 * Every ledger entry's `firstPublishedByReleaseBundleId`, validated against the complete
 * published release universe (P92-C2).
 *
 * The ledger's own attribution field is a *claim*; this derives the fact. For each entry the
 * expected publisher is the publication-order-first frozen release whose pins name the exact
 * (set id, definition hash) pair, and the recorded attribution must be that release — not
 * merely a release that exists, not merely one that pins the pair, and never one derived
 * from the ledger's own entry ordering. Each failure names the set, the hash, the recorded
 * publisher, and the expected publisher or the reason the recorded one is invalid.
 *
 * Runs inside the release generator's phase A, before any target is written, so the real
 * `ip-cards:releases` command certifies attribution itself. `check-publication-baseline`
 * remains the independent second layer comparing against the protected base.
 */
export function validateDefinitionSetAttribution(input: {
  ledger: DefinitionSetLedger
  /** Every frozen (published or retired) release with its four whole-set pins. */
  frozenReleases: ReadonlyArray<PublishedSetPinRecord>
  /** Ids of releases that exist but are drafts, to tell "unpublished" from "unknown". */
  draftReleaseIds?: ReadonlySet<string>
}): DefinitionSetLedgerValidationMessage[] {
  const messages: DefinitionSetLedgerValidationMessage[] = []

  const frozenById = new Map(input.frozenReleases.map((record) => [record.releaseBundleId, record]))
  for (const record of input.frozenReleases) {
    if (!record.publishedAt) {
      messages.push({
        code: 'definition_set_attribution_unorderable_release',
        definitionSetId: '(release)',
        definitionHash: null,
        message: `Release ${record.releaseBundleId} is ${record.releaseState} but records no publishedAt, so its position in the publication order — and every first-publisher derivation involving it — is undefined. Attribution fails closed rather than guessing.`,
      })
    }
  }

  // Publication-order-first frozen release per exact (set id, hash) pair.
  const firstPublisherByKey = new Map<string, PublishedSetPinRecord>()
  for (const record of input.frozenReleases) {
    for (const pin of record.pins) {
      const key = `${pin.definitionSetId}@${pin.definitionHash}`
      const incumbent = firstPublisherByKey.get(key)
      if (!incumbent || comparePublicationOrder(record, incumbent) < 0) {
        firstPublisherByKey.set(key, record)
      }
    }
  }

  const seenEntryKeys = new Set<string>()
  for (const entry of input.ledger.entries) {
    const key = `${entry.definitionSetId}@${entry.definitionHash}`
    // Duplicate keys are already a hard failure in `validateDefinitionSetLedger`; attribution
    // is checked on the first entry only — the one the resolver would serve.
    if (seenEntryKeys.has(key)) continue
    seenEntryKeys.add(key)

    const recorded = entry.firstPublishedByReleaseBundleId
    const expected = firstPublisherByKey.get(key) ?? null
    const attributed = recorded ? (frozenById.get(recorded) ?? null) : null

    if (!recorded || (!attributed && !(input.draftReleaseIds?.has(recorded) ?? false))) {
      messages.push({
        code: 'definition_set_attribution_unknown_release',
        definitionSetId: entry.definitionSetId,
        definitionHash: entry.definitionHash,
        message: `Ledger entry ${key} records firstPublishedByReleaseBundleId "${recorded}", which is not a retained release. Expected publisher: ${expected ? expected.releaseBundleId : 'none — no published release pins this pair, so the entry itself has no publication to stand on'}.`,
      })
      continue
    }
    if (!attributed) {
      messages.push({
        code: 'definition_set_attribution_unpublished_release',
        definitionSetId: entry.definitionSetId,
        definitionHash: entry.definitionHash,
        message: `Ledger entry ${key} records firstPublishedByReleaseBundleId "${recorded}", which is a draft. A draft has published nothing, so it cannot be the publication that carried this set into the ledger. Expected publisher: ${expected ? expected.releaseBundleId : 'none — no published release pins this pair'}.`,
      })
      continue
    }
    const attributedPinsPair = attributed.pins.some(
      (pin) =>
        pin.definitionSetId === entry.definitionSetId &&
        pin.definitionHash === entry.definitionHash,
    )
    if (!attributedPinsPair) {
      messages.push({
        code: 'definition_set_attribution_release_does_not_pin',
        definitionSetId: entry.definitionSetId,
        definitionHash: entry.definitionHash,
        message: `Ledger entry ${key} records firstPublishedByReleaseBundleId "${recorded}", but that release does not pin ${entry.definitionSetId} at ${entry.definitionHash}. Expected publisher: ${expected ? expected.releaseBundleId : 'none — no published release pins this pair'}.`,
      })
      continue
    }
    if (expected && expected.releaseBundleId !== recorded) {
      messages.push({
        code: 'definition_set_attribution_not_first_publisher',
        definitionSetId: entry.definitionSetId,
        definitionHash: entry.definitionHash,
        message: `Ledger entry ${key} records firstPublishedByReleaseBundleId "${recorded}" (published ${attributed.publishedAt ?? 'undated'}), but the publication-order-first release pinning this pair is ${expected.releaseBundleId} (published ${expected.publishedAt ?? 'undated'}). Attribution names the first publisher, never a later one.`,
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
 *
 * Callers supply `published` in canonical publication order (`comparePublicationOrder`):
 * the first release naming a new (set, hash) pair in that order becomes the entry's
 * `firstPublishedByReleaseBundleId`, which is exactly what `validateDefinitionSetAttribution`
 * later requires of it. Feeding this an id-ordered list would record an attribution the
 * validator refuses — the generator sorts before folding.
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
 * This is the governance tripwire for the permanent-table contract, not an application
 * guard: since P92-C1, alias *application* inside release-pinned paths uses the release's
 * own resolved snapshot (`BuildContext.roleCodeAliases`), so nothing here decides which
 * table canonicalizes a historical card. What this check refuses is a live table that
 * *rewrites* what a published release retained — a retargeted or removed alias, a dropped
 * category, a changed legacy mapping or override. Aliases are permanent and append-only;
 * a contradiction is a rewrite of published history, and every release that retained the
 * contradicted content fails resolution typed rather than resolving as if nothing
 * happened. Pure extensions pass, and in neither case does the live table reach a
 * historical card's semantics. See `definition-set-retention.md` §3.6.
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
