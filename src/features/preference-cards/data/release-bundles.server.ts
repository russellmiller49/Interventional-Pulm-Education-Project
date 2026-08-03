import releaseBundlesJson from '../../../../data/ip-preference-cards/generated/release-bundles.json'
import releaseImpactJson from '../../../../data/ip-preference-cards/generated/release-impact-report.json'
import resolverReleaseJson from '../../../../data/ip-preference-cards/generated/resolver-release.json'

import {
  resolveCurrentRelease,
  resolvePinnedRelease,
  validateReleaseBundles,
  assertSelectableForNewCard,
  type PreferenceCardReleaseBundle,
  type ReleaseDefinitionSources,
  type ReleaseImpactReport,
  type ReleasePointerMap,
  type ReleaseResolutionErrorCode,
  type ReleaseValidationMessage,
} from '../domain/release-bundle'
import { PREFERENCE_CARD_RESOLVER_CONTRACT_VERSION } from '../domain/resolve-card'
import type { BuildContext, ScenarioDefinition } from '../domain/types'

import {
  buildContextForRecipe,
  getReleaseDefinitionSources,
  getScenarioDefinition,
} from './demo-context.server'

/**
 * The retained release bundles, and the only path by which a card resolves through one.
 *
 * Two things happen here that do not happen anywhere else in this module:
 *
 * - **Pins are verified before a context is handed out.** A card pinned to a release whose
 *   definitions have been edited does not resolve against the edited content and does not
 *   resolve against a newer release; it does not resolve at all, and the caller renders it
 *   view-only from its snapshot. Silently substituting content the author never reviewed is
 *   the failure the pin exists to prevent, and a card that will not reopen is the safe
 *   direction to fail because it is visible.
 * - **"Current" comes from the pointer.** There is no expression here that sorts versions,
 *   takes the last entry, or compares timestamps.
 */

interface GeneratedReleaseFile {
  pointers: Record<string, string>
  bundles: PreferenceCardReleaseBundle[]
}

const releaseFile = releaseBundlesJson as unknown as GeneratedReleaseFile
const impactReports = releaseImpactJson as unknown as ReleaseImpactReport[]

const bundleById = (() => {
  const index = new Map<string, PreferenceCardReleaseBundle>()
  for (const bundle of releaseFile.bundles) {
    if (index.has(bundle.id)) {
      throw new Error(
        `Release ${bundle.id} is retained more than once. A release id must identify exactly one immutable definition set.`,
      )
    }
    index.set(bundle.id, bundle)
  }
  return index
})()

const pointers: ReleasePointerMap = releaseFile.pointers

/**
 * Which release backs a scenario, for the builder, which works in scenario terms.
 *
 * Asserted unique rather than assumed: two *current* releases claiming one scenario would
 * make "which release does a new card for this procedure use" a question with two answers,
 * and answering it by picking one would be exactly the inference this module refuses. A
 * superseded release naming the same scenario is fine and expected — only pointed-to
 * releases are indexed here.
 */
const currentBundleByScenarioId = (() => {
  const index = new Map<string, PreferenceCardReleaseBundle>()
  for (const [procedureCode, releaseBundleId] of Object.entries(pointers)) {
    const bundle = bundleById.get(releaseBundleId)
    if (!bundle || bundle.sourceProcedureCode !== procedureCode) continue
    const existing = index.get(bundle.scenarioId)
    if (existing) {
      throw new Error(
        `Scenario "${bundle.scenarioId}" is the current release target of both ${existing.id} and ${bundle.id}.`,
      )
    }
    index.set(bundle.scenarioId, bundle)
  }
  return index
})()

/**
 * The contract the running code implements, and the build that implements it.
 *
 * The version comes from the constant so a bump takes effect immediately; the implementation
 * digest comes from the generated artifact because runtime code cannot hash its own sources.
 */
export const RUNTIME_RESOLVER_CONTRACT = {
  version: PREFERENCE_CARD_RESOLVER_CONTRACT_VERSION,
  implementationHash: (resolverReleaseJson as { resolverImplementationHash: string })
    .resolverImplementationHash,
}

function loadSources(bundle: PreferenceCardReleaseBundle): ReleaseDefinitionSources | null {
  return getReleaseDefinitionSources(bundle.recipeVersionId, RUNTIME_RESOLVER_CONTRACT)
}

export function getReleaseBundle(releaseBundleId: string): PreferenceCardReleaseBundle | null {
  return bundleById.get(releaseBundleId) ?? null
}

export function getRetainedReleaseBundles(): PreferenceCardReleaseBundle[] {
  return [...bundleById.values()]
}

export function getReleasePointers(): ReleasePointerMap {
  return { ...pointers }
}

export function getReleaseImpactReports(): ReleaseImpactReport[] {
  return impactReports.map((report) => ({ ...report }))
}

/** The release a *new* card for this procedure is built on. Null when nothing points at one. */
export function getCurrentReleaseBundle(
  sourceProcedureCode: string,
): PreferenceCardReleaseBundle | null {
  return resolveCurrentRelease(sourceProcedureCode, pointers, bundleById)
}

/** The same, addressed the way the builder addresses a procedure. */
export function getCurrentReleaseBundleForScenario(
  scenarioId: string,
): PreferenceCardReleaseBundle | null {
  const bundle = currentBundleByScenarioId.get(scenarioId)
  if (!bundle) return null
  return assertSelectableForNewCard(bundle).ok ? bundle : null
}

export type ReleaseContextErrorCode =
  | ReleaseResolutionErrorCode
  | 'release_scenario_unavailable'
  | 'release_scenario_mismatch'
  | 'release_recipe_mismatch'

export type ReleaseContextResult =
  | {
      ok: true
      bundle: PreferenceCardReleaseBundle
      scenario: ScenarioDefinition
      context: BuildContext
    }
  | {
      ok: false
      code: ReleaseContextErrorCode
      message: string
      changedPins?: string[]
    }

/**
 * The build context for a pinned release, or a typed reason it cannot be reconstructed.
 *
 * Retired releases resolve. Retirement decides what a *new* card may be built on — checked by
 * the create path, not here — because a card already pinned to a retired release must still
 * reconstruct or "retired but retained" would mean nothing.
 */
export function buildReleaseContext(
  releaseBundleId: string,
  expected?: { scenarioId?: string; recipeVersionId?: string },
): ReleaseContextResult {
  const resolved = resolvePinnedRelease(releaseBundleId, bundleById, loadSources)
  if (!resolved.ok) return resolved
  const { bundle, sources } = resolved

  if (expected?.scenarioId && expected.scenarioId !== bundle.scenarioId) {
    return {
      ok: false,
      code: 'release_scenario_mismatch',
      message: `This card records procedure "${expected.scenarioId}" but its pinned release ${bundle.id} publishes "${bundle.scenarioId}".`,
    }
  }
  if (expected?.recipeVersionId && expected.recipeVersionId !== bundle.recipeVersionId) {
    return {
      ok: false,
      code: 'release_recipe_mismatch',
      message: `This card pins recipe version ${expected.recipeVersionId}, which release ${bundle.id} does not publish.`,
    }
  }

  const scenario = getScenarioDefinition(bundle.scenarioId)
  if (!scenario) {
    return {
      ok: false,
      code: 'release_scenario_unavailable',
      message: `Release ${bundle.id} publishes procedure "${bundle.scenarioId}", which is no longer available.`,
    }
  }

  // Every pin verified above, so the current definitions *are* the published ones and the
  // ordinary context builder reconstructs them. If any had moved, we would not be here.
  return {
    ok: true,
    bundle,
    scenario,
    context: buildContextForRecipe(sources.recipe, {
      releaseBundleId: bundle.id,
      releaseDefinitionHash: bundle.definitionHash,
      // The bundle's `catalogImportId` is the catalog *release* digest — the one the retained
      // catalog manifests are addressed by — not the source workbook digest a card prints.
      catalogReleaseId: bundle.catalogImportId,
    }),
  }
}

/**
 * The standing check that the retained release set is intact.
 *
 * Exported so `release-bundle-integrity.test.ts` runs it against the real committed data on
 * every CI run: a commit that edits a pinned definition, deletes a retained release, or points
 * at a retired one fails the suite rather than shipping and being discovered by a card that
 * will not reopen.
 */
export function validateRetainedReleases(): ReleaseValidationMessage[] {
  const sourcesByBundleId = new Map<string, ReleaseDefinitionSources | null>(
    [...bundleById.values()].map((bundle) => [bundle.id, loadSources(bundle)]),
  )
  return validateReleaseBundles({
    bundles: [...bundleById.values()],
    pointers,
    sourcesByBundleId,
  })
}
