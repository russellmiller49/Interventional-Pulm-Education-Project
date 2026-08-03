/**
 * Scenario identifiers the client needs by name.
 *
 * Kept out of `demo-context.server.ts` so a client component can reference the custom
 * composition without pulling the statically-imported catalog JSON into the browser bundle.
 */
export const CUSTOM_COMPOSITION_SCENARIO_ID = 'custom-composition'
export const CUSTOM_COMPOSITION_RECIPE_ID = 'recipe-custom-composition-v1-0'
export const CUSTOM_COMPOSITION_PROCEDURE_CODE = 'CUSTOM_COMPOSITION'
