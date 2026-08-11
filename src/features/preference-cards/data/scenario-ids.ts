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
 * The id therefore versions forward exactly like an authored composition: v1-0 and v1-1 were
 * frozen by their releases and are retained in the composition ledger; v1-2 offers the
 * current modules and carries the authored per-slot composition actions from
 * `seed/custom-composition.json` (the 2026-08-10 Codex corrections P91-C1/P91-C2, which
 * apply the owner's F-04 sampling-instrument placement and the two MED_THORACOSCOPY
 * insertable-device placements to custom cards). These constants must agree with that seed
 * file; `demo-context.server.ts` refuses to load when they do not.
 */
export const CUSTOM_COMPOSITION_RECIPE_ID = 'recipe-custom-composition-v1-2'
export const CUSTOM_COMPOSITION_RECIPE_VERSION = '1.2'
export const CUSTOM_COMPOSITION_PROCEDURE_CODE = 'CUSTOM_COMPOSITION'
