import { recipeDefinitionHash } from './release-bundle'
import type { RecipeVersion } from './types'

/**
 * The frozen record of every recipe version a published release pins.
 *
 * The composition build regenerates `procedure-compositions.json` from the current seed on
 * every run, which is correct for the versions that are current and useless for the ones that
 * are not: once a procedure's seed entry moves from `recipe-chest-tube-v0-1` to
 * `recipe-chest-tube-v0-2`, nothing in the seed produces v0-1 any more — and the seed *cannot*
 * keep producing it, because the superseded composition is validated against the current
 * imported template and the current module map, both of which the new version exists to
 * change. A release pinned to the old version had nothing to resolve against. Re-deriving
 * v0-1 from the current inputs would be worse than leaving it broken — it would produce
 * something *plausible* under the old id, which is precisely the substitution every pin in
 * this module exists to prevent.
 *
 * So a published recipe version is copied here once, verbatim, and never rewritten — the
 * exact mechanism `module-ledger.ts` established one level down. The ledger is append-only:
 * entries are added when a release publishes them and removed never. What makes that safe
 * rather than merely stated is that both halves are checked — `validateCompositionLedger`
 * fails when a ledger entry disagrees with what the current build produces under the same id,
 * and fails when an entry a release still pins has gone missing.
 *
 * The stored `definition` is the `RecipeVersion` exactly as the release build hashed it into
 * `recipePin`, so `recipeDefinitionHash(entry.definition)` reproduces the pinned hash without
 * re-deriving anything. `recipeDefinitionHash` already strips `catalogImportId`, so a catalog
 * refresh does not read as a retained recipe mutating.
 */

export interface CompositionLedgerEntry {
  recipeVersionId: string
  sourceProcedureCode: string
  /** The hash a release pinned. Recomputed from `definition` on every validation pass. */
  definitionHash: string
  /** The recipe exactly as it was when first published. Never regenerated. */
  definition: RecipeVersion
  /** The release that first pinned it, for provenance when reading the file. */
  firstPublishedByReleaseBundleId: string
}

export interface CompositionLedger {
  formatVersion: string
  entries: CompositionLedgerEntry[]
}

export function emptyCompositionLedger(): CompositionLedger {
  return { formatVersion: '1.0', entries: [] }
}

export type CompositionLedgerValidationCode =
  | 'composition_ledger_entry_mutated'
  | 'composition_ledger_entry_missing'
  | 'composition_ledger_diverged_from_live'
  | 'composition_ledger_duplicate_entry'

export interface CompositionLedgerValidationMessage {
  code: CompositionLedgerValidationCode
  recipeVersionId: string
  message: string
}

/**
 * Every way the retained recipe set can be wrong.
 *
 * Deliberately checks the ledger against *two* things. Against itself, because an entry whose
 * recorded hash no longer matches its own definition has been edited in place. And against the
 * live recipes, because the same recipe version existing in both with different content means
 * someone changed a published composition upstream in the seed — which the release build would
 * also catch, but catching it here names the recipe rather than the release.
 */
export function validateCompositionLedger(input: {
  ledger: CompositionLedger
  /** Recipe versions the current generated data produces, by recipe version id. */
  liveRecipes: ReadonlyMap<string, RecipeVersion>
  /** Recipe versions published releases pin. Every one of these must be resolvable. */
  pinnedRecipeVersionIds: ReadonlySet<string>
}): CompositionLedgerValidationMessage[] {
  const messages: CompositionLedgerValidationMessage[] = []
  const byId = new Map<string, CompositionLedgerEntry>()

  for (const entry of input.ledger.entries) {
    if (byId.has(entry.recipeVersionId)) {
      messages.push({
        code: 'composition_ledger_duplicate_entry',
        recipeVersionId: entry.recipeVersionId,
        message: `Recipe version ${entry.recipeVersionId} is recorded in the ledger more than once. A recipe version id must identify exactly one frozen definition.`,
      })
      continue
    }
    byId.set(entry.recipeVersionId, entry)

    const recomputed = recipeDefinitionHash(entry.definition)
    if (recomputed !== entry.definitionHash) {
      messages.push({
        code: 'composition_ledger_entry_mutated',
        recipeVersionId: entry.recipeVersionId,
        message: `Ledger entry ${entry.recipeVersionId} no longer hashes to what was published (${entry.definitionHash} → ${recomputed}). A published recipe version is immutable: publish a new version instead of editing this one.`,
      })
    }

    const live = input.liveRecipes.get(entry.recipeVersionId)
    if (live && recipeDefinitionHash(live) !== entry.definitionHash) {
      messages.push({
        code: 'composition_ledger_diverged_from_live',
        recipeVersionId: entry.recipeVersionId,
        message: `Recipe version ${entry.recipeVersionId} was published with one definition and the current build now produces another. Author a new recipe version rather than changing a published one.`,
      })
    }
  }

  for (const recipeVersionId of input.pinnedRecipeVersionIds) {
    if (byId.has(recipeVersionId) || input.liveRecipes.has(recipeVersionId)) continue
    messages.push({
      code: 'composition_ledger_entry_missing',
      recipeVersionId,
      message: `Recipe version ${recipeVersionId} is pinned by a published release but is neither in the retention ledger nor in the current generated data. A retained release must stay reconstructable.`,
    })
  }

  return messages
}

/**
 * The recipe a retained id resolves to, when nothing current produces it.
 *
 * Callers check their live data first and reach for the ledger only on a miss, so an ordinary
 * build reads exactly what it always did and the ledger contributes only the versions nothing
 * current produces any more. That ordering is safe *because* `validateCompositionLedger`
 * fails when the two disagree — otherwise preferring the live copy would be a route for an
 * edited definition to reach a card that pinned the frozen one.
 */
export function retainedRecipeById(ledger: CompositionLedger): Map<string, RecipeVersion> {
  return new Map(ledger.entries.map((entry) => [entry.recipeVersionId, entry.definition]))
}

/**
 * Fold newly published recipe versions into the ledger without disturbing what is already
 * there.
 *
 * Append-only by construction: an existing entry is returned untouched even when the current
 * build now says something different, so this function can never be the thing that rewrites
 * history. Divergence is reported by `validateCompositionLedger`, not silently absorbed here.
 */
export function withPublishedRecipes(
  ledger: CompositionLedger,
  published: Array<{ recipe: RecipeVersion; releaseBundleId: string }>,
): CompositionLedger {
  const entries = new Map(ledger.entries.map((entry) => [entry.recipeVersionId, entry]))
  for (const { recipe, releaseBundleId } of published) {
    if (entries.has(recipe.id)) continue
    entries.set(recipe.id, {
      recipeVersionId: recipe.id,
      sourceProcedureCode: recipe.sourceProcedureCode,
      definitionHash: recipeDefinitionHash(recipe),
      definition: recipe,
      firstPublishedByReleaseBundleId: releaseBundleId,
    })
  }
  return {
    formatVersion: ledger.formatVersion,
    entries: [...entries.values()].sort((left, right) =>
      left.recipeVersionId.localeCompare(right.recipeVersionId),
    ),
  }
}
