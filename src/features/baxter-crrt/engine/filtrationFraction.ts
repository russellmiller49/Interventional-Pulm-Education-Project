import { assertFiniteNumber, assertNonNegativeNumber } from './units'

/**
 * Filtration fraction, computed from the flows.
 *
 * The share of the plasma water reaching the filter that is taken across the membrane. It is the
 * expression this module has taught by hand since the teaching-first revision
 * (`content/workedCaseExamples.ts`, CRRT-13 and CRRT-16):
 *
 *   filtration fraction = fluid across the membrane ÷ (plasma flow + pre-filter fluid)
 *   plasma flow         = blood flow × (1 − hematocrit)
 *
 * - "Fluid across the membrane" is every millilitre pulled from the blood side to the fluid side:
 *   pre-blood-pump fluid, both replacement streams, the syringe and the net patient fluid removal.
 *   Dialysate is not in it; it never crosses.
 * - "Pre-filter fluid" is what joins the blood before the filter and dilutes it there:
 *   pre-blood-pump fluid and pre-filter replacement. Post-filter replacement joins after the
 *   filter, so it is in the numerator and not in the denominator. That is the whole of the
 *   pre/post difference: the same replacement volume gives a higher fraction after the filter
 *   than before it.
 *
 * Sources, each read from its PDF (2026-11-13).
 * - The whole expression, with pre-filter replacement in the denominator: AJKD Core Curriculum
 *   2025 (Teixeira et al, Am J Kidney Dis 2025;85:767–786), Table 5, p. 778
 *   (`REVIEW-CKRT-CORE-2025`). Its total ultrafiltration is pre-filter replacement + post-filter
 *   replacement + net ultrafiltration, and its plasma flow is blood flow × (1 − hematocrit).
 * - The ratio of ultrafiltration rate to plasma flow rate: Claure-Del Granado and Clark, Semin
 *   Dial 2021;34:398–405, section 3.4.2, equation 7 (`REVIEW-CRRT-PRINCIPLES-2021`).
 * - Pre-blood-pump fluid joining the plasma before the filter, and the syringe counted with what
 *   must be removed: PrisMax operator's manual AW8035 Rev B, p. 218 (`MATH-PM-003`, `MATH-PM-005`).
 *   These two are the module's additions to the table's expression.
 *
 * What this is not. It is neither of the two values the PrisMax Information screen shows (same
 * page of the manual):
 * - `FF Blood % = 100 × (Qrep_post + Qpfr + Qsyr) / (Qplasma + Qpre)` leaves the pre-filter fluid
 *   out of the numerator. For the same flows it is lower than this value by exactly
 *   pre-filter fluid ÷ (plasma flow + pre-filter fluid): 8.3% against 15.8% for CRRT-16.
 * - `FF Plasma % = 100 × Qeff / (Qplasma × 0.95 + Qpre)` multiplies the plasma term by a plasma
 *   water fraction of 0.95 and has the effluent flow as its numerator. With no dialysate that is
 *   16.5% for CRRT-16. The manual does not say whether dialysate is in that numerator.
 * Neither is computed here: the manual's line for pre-infusion flow is not readable as printed
 * (`PRISMAX_PRE_INFUSION_FLOW_GATE`). No plasma-water factor is applied.
 *
 * Limits of the model that uses it. Hematocrit is the case's fixed value, so the fraction does
 * not creep up as fluid is removed (the 2021 review's first caveat). The solute model holds the
 * concentration reaching the filter constant, so the pre/post split changes this fraction and the
 * filter's burden but not clearance.
 */
export interface CrrtFiltrationFractionInput {
  readonly bloodFlowMlMin: number
  /** 0 to 1, exclusive of 1. */
  readonly hematocritFraction: number
  readonly preBloodPumpMlHour: number
  readonly preFilterReplacementMlHour: number
  readonly postFilterReplacementMlHour: number
  readonly patientFluidRemovalMlHour: number
  readonly syringeMlHour?: number
}

export interface CrrtFiltrationFraction {
  /** 0 to 1 in ordinary prescriptions; not clamped, so an impossible prescription shows as one. */
  readonly fraction: number
  readonly plasmaFlowMlHour: number
  readonly acrossMembraneMlHour: number
  readonly preFilterFluidMlHour: number
}

/**
 * Null when there is nothing to divide by: no blood flow, so no plasma reaches the filter and the
 * fraction has no meaning. A stopped circuit has no filtration fraction; it is not zero.
 */
export function calculateCrrtFiltrationFraction(
  input: CrrtFiltrationFractionInput,
): CrrtFiltrationFraction | null {
  const bloodFlow = assertNonNegativeNumber(input.bloodFlowMlMin, 'bloodFlowMlMin')
  const hematocrit = assertFiniteNumber(input.hematocritFraction, 'hematocritFraction')
  if (hematocrit < 0 || hematocrit >= 1) {
    throw new RangeError('hematocritFraction must be at least zero and less than one')
  }
  const preBloodPump = assertNonNegativeNumber(input.preBloodPumpMlHour, 'preBloodPumpMlHour')
  const preReplacement = assertNonNegativeNumber(
    input.preFilterReplacementMlHour,
    'preFilterReplacementMlHour',
  )
  const postReplacement = assertNonNegativeNumber(
    input.postFilterReplacementMlHour,
    'postFilterReplacementMlHour',
  )
  const removal = assertNonNegativeNumber(
    input.patientFluidRemovalMlHour,
    'patientFluidRemovalMlHour',
  )
  const syringe = assertNonNegativeNumber(input.syringeMlHour ?? 0, 'syringeMlHour')

  const plasmaFlowMlHour = bloodFlow * 60 * (1 - hematocrit)
  if (plasmaFlowMlHour <= 0) return null
  const preFilterFluidMlHour = preBloodPump + preReplacement
  const acrossMembraneMlHour = preFilterFluidMlHour + postReplacement + removal + syringe
  return Object.freeze({
    fraction: assertFiniteNumber(
      acrossMembraneMlHour / (plasmaFlowMlHour + preFilterFluidMlHour),
      'filtrationFraction',
    ),
    plasmaFlowMlHour,
    acrossMembraneMlHour,
    preFilterFluidMlHour,
  })
}
