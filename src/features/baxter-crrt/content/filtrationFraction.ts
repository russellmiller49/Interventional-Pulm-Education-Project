import { CRRT_NUMBERS } from './teachingNumbers'

/**
 * How the module states filtration fraction, in one place.
 *
 * The value is computed by `engine/filtrationFraction.ts`; this file holds the words.
 *
 * Clinical review, 2026-11-13. Three things are said wherever the value is shown:
 *
 * 1. **It is a calculated estimate, by a stated expression.** Total ultrafiltration ÷ (plasma
 *    flow + pre-filter fluid) is the expression in the AJKD Core Curriculum 2025, Table 5 (p. 778,
 *    read from the paper on 2026-11-13), with plasma flow as blood flow × (1 − hematocrit).
 * 2. **It is not the PrisMax display.** The operator's manual (AW8035 Rev B, p. 218) prints two
 *    values for the Information screen. `FF Blood %` has post-filter replacement, patient fluid
 *    removal and the syringe in its numerator and leaves the pre-filter fluid out, so with any
 *    pre-filter fluid it is lower than this estimate by pre-filter fluid ÷ (plasma + pre-filter
 *    fluid). `FF Plasma %` has the effluent flow over plasma × 0.95 plus pre-infusion flow. The
 *    module computes neither: the manual's own line for pre-infusion flow is not readable as
 *    printed (`PRISMAX_PRE_INFUSION_FLOW_GATE`), and it does not say whether the effluent term
 *    includes dialysate. So the difference is stated in words and no machine value is shown.
 * 3. **One ceiling statement, each number with its scope.** At or below 20%–25% to lower the risk
 *    of filter clotting, any modality, with regional citrate a possible exception (AJKD 2025,
 *    p. 778). 25% as the usual maximum for post-dilution CVVH (Claure-Del Granado and Clark 2021,
 *    section 3.4.2). No flat 20% is taught: no source in this module's register gives one for
 *    this expression.
 */
export const CRRT_FILTRATION_FRACTION_NAME = 'Filtration fraction (calculated estimate)'
/** Where there is room for two words only: a table row, a tile. */
export const CRRT_FILTRATION_FRACTION_SHORT_NAME = 'Filtration fraction (estimate)'

export const CRRT_FILTRATION_FRACTION_EXPRESSION =
  'fluid across the membrane ÷ (plasma flow + pre-filter fluid)'

export const CRRT_FILTRATION_FRACTION_PLASMA_FLOW = 'plasma flow = blood flow × (1 − hematocrit)'

/** What the number is: an estimate by a named expression, not a reading. */
export const CRRT_FILTRATION_FRACTION_ESTIMATE_NOTE =
  'This is a calculated estimate: total ultrafiltration over plasma flow plus pre-filter fluid, the expression in the AJKD Core Curriculum 2025 (Table 5). Pre-blood-pump fluid counts as pre-filter fluid.'

/** What it is not, and how the machine's own two values differ. No machine value is computed. */
export const CRRT_FILTRATION_FRACTION_DEVICE_NOTE =
  'It is not the PrisMax display. The PrisMax Information screen shows two values of its own, FF Blood % and FF Plasma % (operator’s manual, p. 218). FF Blood % leaves the pre-filter fluid out of the numerator, so with any pre-filter fluid it reads lower than this estimate. FF Plasma % puts the effluent flow over plasma water, taken as plasma flow × 0.95, plus pre-filter fluid. Read a machine’s value against the machine’s own definition.'

/** What the estimate leaves out. Both are limits of this simulator, said where the value is. */
export const CRRT_FILTRATION_FRACTION_LIMITS =
  'Two limits. The hematocrit is the one entered and stays fixed; in a patient it rises as fluid is removed, and the fraction rises with it. And this simulator does not change solute clearance when fluid is moved before the filter.'

const CEILING = CRRT_NUMBERS.value('filtration-fraction-ceiling')
const CEILING_RANGE = CRRT_NUMBERS.value('filtration-fraction-ceiling-range')

/** The ceiling, each number with the source that gives it and what that source gives it for. */
export const CRRT_FILTRATION_FRACTION_CEILINGS = `Keep it at or below ${CEILING_RANGE} to lower the risk of the filter clotting (AJKD Core Curriculum, 2025); with regional citrate a higher fraction is reported, anecdotally, to be tolerated. For post-dilution CVVH, ${CEILING} is the usual maximum (Claure-Del Granado and Clark, 2021).`

export type CrrtFiltrationFractionStanding = 'under-both' | 'between' | 'above-both'

/** The two ends of the ceiling range, as fractions. Read from the register's own values. */
const LOWER = 0.2
const UPPER = 0.25

/**
 * Where a value stands against the ceiling range. Arithmetic only: it says where the value sits
 * against the printed range, not what to do about it, and it does not treat 20% as a ceiling of
 * its own.
 */
export function crrtFiltrationFractionStanding(fraction: number): {
  readonly standing: CrrtFiltrationFractionStanding
  readonly text: string
} {
  if (fraction < LOWER)
    return { standing: 'under-both', text: `Below the ${CEILING_RANGE} ceiling.` }
  if (fraction < UPPER)
    return { standing: 'between', text: `Within the ${CEILING_RANGE} ceiling range.` }
  return { standing: 'above-both', text: `At or above ${CEILING}, the top of the ceiling range.` }
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
