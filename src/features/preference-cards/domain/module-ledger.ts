import { moduleDefinitionHash } from './release-bundle'
import type { RecipeModuleVersion } from './types'

/**
 * The frozen record of every module version a published release pins.
 *
 * The composition build regenerates `recipe-modules.json` from the current module map on every
 * run, which is correct for the versions that are current and useless for the ones that are
 * not: once the last composition moves from `FLEX_BRONCH_CORE` v1.0 to v1.1, nothing in the
 * seed produces v1.0 any more, and a card pinned to it has nothing to resolve against. Fixing
 * that by re-deriving v1.0 from the current mapping would be worse than leaving it broken — it
 * would produce something *plausible* under the old id, which is precisely the substitution
 * every pin in this module exists to prevent.
 *
 * So a published module version is copied here once, verbatim, and never rewritten. The ledger
 * is append-only: entries are added when a release publishes them and removed never. What
 * makes that safe rather than merely stated is that both halves are checked —
 * `validateModuleLedger` fails when a ledger entry disagrees with the live module map, and
 * fails when an entry a release still pins has gone missing.
 */

export interface ModuleLedgerEntry {
  moduleVersionId: string
  moduleCode: string
  moduleVersion: string
  /** The hash a release pinned. Recomputed from `definition` on every validation pass. */
  definitionHash: string
  /** The module exactly as it was when first published. Never regenerated. */
  definition: RecipeModuleVersion
  /** The release that first pinned it, for provenance when reading the file. */
  firstPublishedByReleaseBundleId: string
}

export interface ModuleLedger {
  formatVersion: string
  entries: ModuleLedgerEntry[]
}

export type ModuleLedgerValidationCode =
  | 'module_ledger_entry_mutated'
  | 'module_ledger_entry_missing'
  | 'module_ledger_diverged_from_live'
  | 'module_ledger_duplicate_entry'

export interface ModuleLedgerValidationMessage {
  code: ModuleLedgerValidationCode
  moduleVersionId: string
  message: string
}

/**
 * Every way the retained module set can be wrong.
 *
 * Deliberately checks the ledger against *two* things. Against itself, because an entry whose
 * recorded hash no longer matches its own definition has been edited in place. And against the
 * live module map, because the same module version existing in both with different content
 * means someone changed a published definition upstream in the seed — which the release build
 * would also catch, but catching it here names the module rather than the release.
 */
export function validateModuleLedger(input: {
  ledger: ModuleLedger
  /** Module versions the current composition build produced, by id. */
  liveModules: ReadonlyMap<string, RecipeModuleVersion>
  /** Module versions published releases pin. Every one of these must be resolvable. */
  pinnedModuleVersionIds: ReadonlySet<string>
}): ModuleLedgerValidationMessage[] {
  const messages: ModuleLedgerValidationMessage[] = []
  const byId = new Map<string, ModuleLedgerEntry>()

  for (const entry of input.ledger.entries) {
    if (byId.has(entry.moduleVersionId)) {
      messages.push({
        code: 'module_ledger_duplicate_entry',
        moduleVersionId: entry.moduleVersionId,
        message: `Module version ${entry.moduleVersionId} is recorded in the ledger more than once. A module version id must identify exactly one frozen definition.`,
      })
      continue
    }
    byId.set(entry.moduleVersionId, entry)

    const recomputed = moduleDefinitionHash(entry.definition)
    if (recomputed !== entry.definitionHash) {
      messages.push({
        code: 'module_ledger_entry_mutated',
        moduleVersionId: entry.moduleVersionId,
        message: `Ledger entry ${entry.moduleVersionId} no longer hashes to what was published (${entry.definitionHash} → ${recomputed}). A published module version is immutable: publish a new version instead of editing this one.`,
      })
    }

    const live = input.liveModules.get(entry.moduleVersionId)
    if (live && moduleDefinitionHash(live) !== entry.definitionHash) {
      messages.push({
        code: 'module_ledger_diverged_from_live',
        moduleVersionId: entry.moduleVersionId,
        message: `Module version ${entry.moduleVersionId} was published with one definition and the current module map now produces another. Author a new module version rather than changing a published one.`,
      })
    }
  }

  for (const moduleVersionId of input.pinnedModuleVersionIds) {
    if (byId.has(moduleVersionId) || input.liveModules.has(moduleVersionId)) continue
    messages.push({
      code: 'module_ledger_entry_missing',
      moduleVersionId,
      message: `Module version ${moduleVersionId} is pinned by a published release but is neither in the retention ledger nor in the current module map. A retained release must stay reconstructable.`,
    })
  }

  return messages
}

/**
 * The module versions available to resolve a pin: everything current, plus everything retained.
 *
 * The live map wins for ids it holds, so an ordinary build reads exactly what it always did
 * and the ledger contributes only the versions nothing current produces any more. That
 * ordering is safe *because* `validateModuleLedger` fails when the two disagree — otherwise
 * preferring the live copy would be a route for an edited definition to reach a card that
 * pinned the frozen one.
 */
export function resolveRetainedModules(
  liveModules: ReadonlyMap<string, RecipeModuleVersion>,
  ledger: ModuleLedger,
): Map<string, RecipeModuleVersion> {
  const merged = new Map<string, RecipeModuleVersion>()
  for (const entry of ledger.entries) merged.set(entry.moduleVersionId, entry.definition)
  for (const [id, moduleVersion] of liveModules) merged.set(id, moduleVersion)
  return merged
}

/**
 * Fold newly published module versions into the ledger without disturbing what is already there.
 *
 * Append-only by construction: an existing entry is returned untouched even when the live map
 * now says something different, so this function can never be the thing that rewrites history.
 * Divergence is reported by `validateModuleLedger`, not silently absorbed here.
 */
export function withPublishedModules(
  ledger: ModuleLedger,
  published: Array<{ moduleVersion: RecipeModuleVersion; releaseBundleId: string }>,
): ModuleLedger {
  const entries = new Map(ledger.entries.map((entry) => [entry.moduleVersionId, entry]))
  for (const { moduleVersion, releaseBundleId } of published) {
    if (entries.has(moduleVersion.id)) continue
    entries.set(moduleVersion.id, {
      moduleVersionId: moduleVersion.id,
      moduleCode: moduleVersion.code,
      moduleVersion: moduleVersion.version,
      definitionHash: moduleDefinitionHash(moduleVersion),
      definition: moduleVersion,
      firstPublishedByReleaseBundleId: releaseBundleId,
    })
  }
  return {
    formatVersion: ledger.formatVersion,
    entries: [...entries.values()].sort((left, right) =>
      left.moduleVersionId.localeCompare(right.moduleVersionId),
    ),
  }
}
