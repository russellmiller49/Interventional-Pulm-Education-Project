/**
 * Scenario identifiers the client needs by name.
 *
 * Kept out of `demo-context.server.ts` so a client component can reference the custom
 * composition without pulling the statically-imported catalog JSON into the browser bundle.
 */
export const CUSTOM_COMPOSITION_SCENARIO_ID = 'custom-composition'
/**
 * The custom composition's recipe is derived from the *current* module set, so its content
 * moves whenever a module version is republished — and a published release pins it by hash.
 * The id therefore versions forward exactly like an authored composition: v1-0 was frozen by
 * `release-custom-composition-v1-0` and is retained in the composition ledger; v1-1 offers
 * the current modules, including the 2026-08-09 owner-review data corrections.
 */
export const CUSTOM_COMPOSITION_RECIPE_ID = 'recipe-custom-composition-v1-1'
export const CUSTOM_COMPOSITION_RECIPE_VERSION = '1.1'
export const CUSTOM_COMPOSITION_PROCEDURE_CODE = 'CUSTOM_COMPOSITION'
