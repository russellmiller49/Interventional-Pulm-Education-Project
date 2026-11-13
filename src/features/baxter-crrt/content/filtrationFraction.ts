import { CRRT_NUMBERS } from './teachingNumbers'

/**
 * How the module states filtration fraction, in one place.
 *
 * The value is computed by `engine/filtrationFraction.ts`; this file holds the words: the
 * expression as a learner reads it, the two ceilings the sources give, and where a value stands
 * against them. Where sources differ the module shows both (owner decision O03, 2026-11-10), so
 * nothing here picks one.
 */
export const CRRT_FILTRATION_FRACTION_EXPRESSION =
  'fluid across the membrane ÷ (plasma flow + pre-filter fluid)'

export const CRRT_FILTRATION_FRACTION_PLASMA_FLOW = 'plasma flow = blood flow × (1 − hematocrit)'

const CEILING = CRRT_NUMBERS.value('filtration-fraction-ceiling')
const CEILING_RANGE = CRRT_NUMBERS.value('filtration-fraction-ceiling-range')

/** Both ceilings, each with the source that gives it. */
export const CRRT_FILTRATION_FRACTION_CEILINGS = `Sources differ on the ceiling: ${CEILING} for post-dilution CVVH (Claure-Del Granado and Clark, 2021) and ${CEILING_RANGE} (AJKD Core Curriculum, 2025). Above it, the blood leaving the filter is concentrated enough to clot it.`

export type CrrtFiltrationFractionStanding = 'under-both' | 'between' | 'above-both'

/** The two numbers the ceilings turn on, as fractions. Read from the register's own values. */
const LOWER = 0.2
const UPPER = 0.25

/**
 * Where a value stands against the two ceilings. Arithmetic only: it says which of the two
 * printed numbers the value is over, not what to do about it.
 */
export function crrtFiltrationFractionStanding(fraction: number): {
  readonly standing: CrrtFiltrationFractionStanding
  readonly text: string
} {
  if (fraction < LOWER) return { standing: 'under-both', text: 'Under 20% and under 25%.' }
  if (fraction < UPPER) return { standing: 'between', text: 'At or above 20%, under 25%.' }
  return { standing: 'above-both', text: 'At or above 25%.' }
}

export function formatCrrtFiltrationFraction(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`
}

const mlPerHour = (value: number) => `${Math.round(value).toLocaleString('en-US')} mL/h`

/** The working, so the number is never a bare result: what was divided by what. */
export function crrtFiltrationFractionWorking(parts: {
  readonly acrossMembraneMlHour: number
  readonly plasmaFlowMlHour: number
  readonly preFilterFluidMlHour: number
}): string {
  return `${mlPerHour(parts.acrossMembraneMlHour)} across the membrane ÷ (${mlPerHour(parts.plasmaFlowMlHour)} plasma + ${mlPerHour(parts.preFilterFluidMlHour)} pre-filter fluid)`
}
