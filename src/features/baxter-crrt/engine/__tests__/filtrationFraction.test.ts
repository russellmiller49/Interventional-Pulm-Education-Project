import { getBaxterCrrtCase } from '../../content/completeCases'
import {
  CRRT_FILTRATION_FRACTION_CEILINGS,
  crrtFiltrationFractionStanding,
  crrtFiltrationFractionWorking,
  formatCrrtFiltrationFraction,
} from '../../content/filtrationFraction'
import { createCrrtLearningSession, crrtLearningSessionReducer } from '../learningSession'
import { CRRT_NUMBERS } from '../../content/teachingNumbers'
import { selectCrrtFiltrationFraction } from '../circuitDelivery'
import { calculateCrrtFiltrationFraction } from '../filtrationFraction'

/**
 * Filtration fraction computed from the flows (owner decision O03, 2026-11-10).
 *
 *   filtration fraction = fluid across the membrane ÷ (plasma flow + pre-filter fluid)
 *   plasma flow         = blood flow × (1 − hematocrit)
 *
 * The expected values below are arithmetic on the inputs, written out so each can be checked by
 * hand; none is a recorded model output.
 */
const base = {
  bloodFlowMlMin: 150,
  hematocritFraction: 0.34,
  preBloodPumpMlHour: 0,
  preFilterReplacementMlHour: 0,
  postFilterReplacementMlHour: 1_200,
  patientFluidRemovalMlHour: 50,
}

describe('the expression', () => {
  it('divides what crosses the membrane by plasma flow plus pre-filter fluid', () => {
    const result = calculateCrrtFiltrationFraction(base)!
    // 150 mL/min × 60 × (1 − 0.34) = 5,940 mL/h of plasma; 1,200 + 50 = 1,250 mL/h crosses.
    expect(result.plasmaFlowMlHour).toBeCloseTo(5_940, 9)
    expect(result.acrossMembraneMlHour).toBe(1_250)
    expect(result.preFilterFluidMlHour).toBe(0)
    expect(result.fraction).toBeCloseTo(1_250 / 5_940, 12)
  })

  it('pre and post differ: the same replacement volume gives a lower fraction before the filter', () => {
    const post = calculateCrrtFiltrationFraction(base)!
    const pre = calculateCrrtFiltrationFraction({
      ...base,
      preFilterReplacementMlHour: 900,
      postFilterReplacementMlHour: 300,
    })!
    // The same 1,250 mL/h crosses either way; 900 mL/h now adds to what reaches the filter.
    expect(pre.acrossMembraneMlHour).toBe(post.acrossMembraneMlHour)
    expect(pre.fraction).toBeCloseTo(1_250 / (5_940 + 900), 12)
    expect(pre.fraction).toBeLessThan(post.fraction)
    expect([
      formatCrrtFiltrationFraction(post.fraction),
      formatCrrtFiltrationFraction(pre.fraction),
    ]).toEqual(['21.0%', '18.3%'])
  })

  it('pre-blood-pump fluid counts as pre-filter fluid, in both terms', () => {
    const result = calculateCrrtFiltrationFraction({ ...base, preBloodPumpMlHour: 500 })!
    expect(result.preFilterFluidMlHour).toBe(500)
    expect(result.acrossMembraneMlHour).toBe(1_750)
    expect(result.fraction).toBeCloseTo(1_750 / (5_940 + 500), 12)
  })

  it('follows blood flow and hematocrit', () => {
    const fraction = (change: Partial<typeof base>) =>
      calculateCrrtFiltrationFraction({ ...base, ...change })!.fraction
    expect(fraction({ bloodFlowMlMin: 200 })).toBeLessThan(fraction({}))
    expect(fraction({ hematocritFraction: 0.45 })).toBeGreaterThan(fraction({}))
  })

  it('reproduces the worked example the module teaches (CRRT-16): 850 over about 5,400 is 16%', () => {
    const result = calculateCrrtFiltrationFraction({
      bloodFlowMlMin: 130,
      hematocritFraction: 0.36,
      preBloodPumpMlHour: 0,
      preFilterReplacementMlHour: 400,
      postFilterReplacementMlHour: 400,
      patientFluidRemovalMlHour: 50,
    })!
    expect(result.acrossMembraneMlHour).toBe(850)
    expect(result.plasmaFlowMlHour + result.preFilterFluidMlHour).toBeCloseTo(5_392, 9)
    expect(Math.round(result.fraction * 100)).toBe(16)
  })

  it('has no value without blood flow, and refuses an impossible hematocrit', () => {
    expect(calculateCrrtFiltrationFraction({ ...base, bloodFlowMlMin: 0 })).toBeNull()
    expect(() => calculateCrrtFiltrationFraction({ ...base, hematocritFraction: 1 })).toThrow(
      /hematocritFraction/,
    )
    expect(() => calculateCrrtFiltrationFraction({ ...base, hematocritFraction: -0.1 })).toThrow(
      /hematocritFraction/,
    )
    expect(() =>
      calculateCrrtFiltrationFraction({ ...base, postFilterReplacementMlHour: -1 }),
    ).toThrow(/postFilterReplacementMlHour/)
  })

  it('is not clamped: a prescription that asks for more than the plasma shows as one', () => {
    const result = calculateCrrtFiltrationFraction({ ...base, bloodFlowMlMin: 20 })!
    expect(result.fraction).toBeGreaterThan(1)
  })
})

describe('in a run', () => {
  const start = (caseId: 'CRRT-05' | 'CRRT-16') =>
    createCrrtLearningSession({
      caseDefinition: getBaxterCrrtCase(caseId),
      experience: caseId === 'CRRT-16' ? 'mastery' : 'practice',
      roleLens: 'integrated',
      attempt: 1,
      deviceId: 'prismax-aw8035-2xx',
    })

  it('is read off the flows being delivered, and is the value the step reports', () => {
    const session = start('CRRT-05')
    const now = selectCrrtFiltrationFraction(session.simulation)
    expect(now.status).toBe('stated')
    expect(now.fraction).toBeCloseTo(1_250 / 5_940, 12)
    const advanced = crrtLearningSessionReducer(session, { type: 'ADVANCE_TIME', seconds: 60 })
    expect(advanced.simulation.deliveredTherapy.filtrationFraction).toBeCloseTo(now.fraction!, 12)
  })

  it('CRRT-16 starts at the 16% its teaching states', () => {
    const now = selectCrrtFiltrationFraction(start('CRRT-16').simulation)
    expect(Math.round((now.fraction ?? Number.NaN) * 100)).toBe(16)
  })
})

describe('the words', () => {
  it('show both ceilings, each with the source that gives it, and pick neither', () => {
    expect(CRRT_FILTRATION_FRACTION_CEILINGS).toContain(
      `${CRRT_NUMBERS.value('filtration-fraction-ceiling')} for post-dilution CVVH (Claure-Del Granado and Clark, 2021)`,
    )
    expect(CRRT_FILTRATION_FRACTION_CEILINGS).toContain(
      `${CRRT_NUMBERS.value('filtration-fraction-ceiling-range')} (AJKD Core Curriculum, 2025)`,
    )
    expect(CRRT_NUMBERS.value('filtration-fraction-ceiling')).toBe('25%')
    expect(CRRT_NUMBERS.value('filtration-fraction-ceiling-range')).toBe('20%–25%')
  })

  it('say where a value stands against the two printed numbers, and nothing more', () => {
    expect(crrtFiltrationFractionStanding(0.183).text).toBe('Under 20% and under 25%.')
    expect(crrtFiltrationFractionStanding(0.21).text).toBe('At or above 20%, under 25%.')
    expect(crrtFiltrationFractionStanding(0.25).text).toBe('At or above 25%.')
  })

  it('print the working beside the value', () => {
    expect(
      crrtFiltrationFractionWorking({
        acrossMembraneMlHour: 1_250,
        plasmaFlowMlHour: 5_940,
        preFilterFluidMlHour: 900,
      }),
    ).toBe('1,250 mL/h across the membrane ÷ (5,940 mL/h plasma + 900 mL/h pre-filter fluid)')
  })
})
