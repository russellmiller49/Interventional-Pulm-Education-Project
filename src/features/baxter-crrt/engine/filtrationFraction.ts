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
 * Sources. The ratio of ultrafiltration rate to plasma flow rate is Claure-Del Granado and Clark,
 * Semin Dial 2021;34:398–405, section 3.4.2, equation 7 (`REVIEW-CRRT-PRINCIPLES-2021`). Plasma
 * flow from blood flow and hematocrit, and the pre-infusion flow added to the plasma flow in the
 * denominator, are the PrisMax operator's manual AW8035 Rev B, page 218 (`MATH-PM-003`,
 * `MATH-PM-005`).
 *
 * What this is not. It is not the PrisMax "FF Blood %" display, whose numerator on that page is
 * post-filter replacement + patient fluid removal + syringe (it leaves the pre-filter fluid out of
 * the numerator), and it does not use that page's pre-infusion expression, which is ambiguous in
 * print (`PRISMAX_PRE_INFUSION_FLOW_GATE`). The pre-filter fluid here is read straight off the
 * two flow settings. No plasma-water factor is applied.
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
