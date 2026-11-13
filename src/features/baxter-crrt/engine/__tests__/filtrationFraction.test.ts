import {
  baxterCrrtCases as crrtCompleteCases,
  getBaxterCrrtCase,
} from '../../content/completeCases'
import {
  CRRT_FILTRATION_FRACTION_CEILINGS,
  CRRT_FILTRATION_FRACTION_DEVICE_NOTE,
  CRRT_FILTRATION_FRACTION_ESTIMATE_NOTE,
  CRRT_FILTRATION_FRACTION_LIMITS,
  CRRT_FILTRATION_FRACTION_NAME,
  CRRT_FILTRATION_FRACTION_SHORT_NAME,
  crrtFiltrationFractionStanding,
  crrtFiltrationFractionWorking,
  formatCrrtFiltrationFraction,
} from '../../content/filtrationFraction'
import { crrtFoundationTasks as crrtFoundationLessons } from '../../content/foundationLessons'
import { crrtWorkedCaseExamples } from '../../content/workedCaseExamples'
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

/*
 * Clinical review, 2026-11-13: the expression checked against the source it comes from, and
 * against the two values the PrisMax prints, so the module never treats them as the same number.
 *
 * AJKD Core Curriculum 2025, Table 5 (p. 778):
 *   plasma flow         = blood flow × (1 − hematocrit)
 *   total ultrafiltration = pre-filter replacement + post-filter replacement + net ultrafiltration
 *   filtration fraction = total ultrafiltration ÷ (plasma flow + pre-filter replacement)
 * PrisMax operator's manual AW8035 Rev B, p. 218:
 *   FF Blood %  = 100 × (Qrep_post + Qpfr + Qsyr) / (Qplasma + Qpre)
 *   FF Plasma % = 100 × Qeff / (Qplasma × 0.95 + Qpre)
 */
describe('against its sources', () => {
  const table5 = (qb: number, hct: number, pre: number, post: number, net: number) =>
    (pre + post + net) / (qb * 60 * (1 - hct) + pre)
  const grid = [50, 100, 130, 150, 200, 300].flatMap((qb) =>
    [0, 0.25, 0.36, 0.45, 0.6].flatMap((hct) =>
      [0, 400, 900, 2_000].flatMap((pre) =>
        [0, 400, 1_200].flatMap((post) =>
          [0, 50, 300].map((net) => [qb, hct, pre, post, net] as const),
        ),
      ),
    ),
  )

  it('is the AJKD table’s expression for every combination of settings', () => {
    expect(grid).toHaveLength(1_080)
    for (const [qb, hct, pre, post, net] of grid) {
      const result = calculateCrrtFiltrationFraction({
        bloodFlowMlMin: qb,
        hematocritFraction: hct,
        preBloodPumpMlHour: 0,
        preFilterReplacementMlHour: pre,
        postFilterReplacementMlHour: post,
        patientFluidRemovalMlHour: net,
      })!
      expect(result.fraction).toBeCloseTo(table5(qb, hct, pre, post, net), 12)
    }
  })

  it('moves the right way with each setting, across the grid', () => {
    const at = (qb: number, hct: number, pre: number, post: number, net: number) =>
      calculateCrrtFiltrationFraction({
        bloodFlowMlMin: qb,
        hematocritFraction: hct,
        preBloodPumpMlHour: 0,
        preFilterReplacementMlHour: pre,
        postFilterReplacementMlHour: post,
        patientFluidRemovalMlHour: net,
      })!.fraction
    for (const [qb, hct, pre, post, net] of grid) {
      if (pre + post + net === 0) continue
      // More blood flow: lower. More hematocrit, post-filter fluid or net removal: higher.
      expect(at(qb + 50, hct, pre, post, net)).toBeLessThan(at(qb, hct, pre, post, net))
      expect(at(qb, hct + 0.1, pre, post, net)).toBeGreaterThan(at(qb, hct, pre, post, net))
      expect(at(qb, hct, pre, post + 200, net)).toBeGreaterThan(at(qb, hct, pre, post, net))
      expect(at(qb, hct, pre, post, net + 100)).toBeGreaterThan(at(qb, hct, pre, post, net))
      // The same volume moved from after the filter to before it: lower.
      if (post >= 400)
        expect(at(qb, hct, pre + 400, post - 400, net)).toBeLessThan(at(qb, hct, pre, post, net))
    }
  })

  it('is not the PrisMax FF Blood %: that leaves the pre-filter fluid out of the numerator', () => {
    for (const [qb, hct, pre, post, net] of grid) {
      const result = calculateCrrtFiltrationFraction({
        bloodFlowMlMin: qb,
        hematocritFraction: hct,
        preBloodPumpMlHour: 0,
        preFilterReplacementMlHour: pre,
        postFilterReplacementMlHour: post,
        patientFluidRemovalMlHour: net,
      })!
      const plasma = qb * 60 * (1 - hct)
      const ffBlood = (post + net) / (plasma + pre)
      // Lower than the estimate by exactly pre-filter fluid ÷ (plasma + pre-filter fluid).
      expect(result.fraction - ffBlood).toBeCloseTo(pre / (plasma + pre), 12)
      if (pre > 0) expect(ffBlood).toBeLessThan(result.fraction)
    }
    // CRRT-16's flows, the worked example: 15.8% here, 8.3% by the manual's FF Blood %.
    const plasma = 130 * 60 * (1 - 0.36)
    expect(((400 + 400 + 50) / (plasma + 400)) * 100).toBeCloseTo(15.8, 1)
    expect(((400 + 50) / (plasma + 400)) * 100).toBeCloseTo(8.3, 1)
  })

  it('is not the PrisMax FF Plasma %: that multiplies the plasma term by 0.95', () => {
    // With no dialysate the manual's effluent term is the total ultrafiltration.
    const plasma = 130 * 60 * (1 - 0.36)
    const estimate = (400 + 400 + 50) / (plasma + 400)
    const ffPlasma = (400 + 400 + 50) / (plasma * 0.95 + 400)
    expect(ffPlasma * 100).toBeCloseTo(16.5, 1)
    expect(ffPlasma).toBeGreaterThan(estimate)
    // The module applies no plasma-water factor.
    expect(
      calculateCrrtFiltrationFraction({
        bloodFlowMlMin: 130,
        hematocritFraction: 0.36,
        preBloodPumpMlHour: 0,
        preFilterReplacementMlHour: 400,
        postFilterReplacementMlHour: 400,
        patientFluidRemovalMlHour: 50,
      })!.fraction,
    ).toBeCloseTo(estimate, 12)
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

  it('follows the settings in force, and is not stated when nothing is filtered', () => {
    const { simulation } = start('CRRT-05')
    if (simulation.prescription.status !== 'configured') throw new Error('not configured')
    const flows = simulation.prescription.flows
    const withFlows = (change: Partial<typeof flows>) =>
      selectCrrtFiltrationFraction({
        ...simulation,
        prescription: { ...simulation.prescription, flows: { ...flows, ...change } },
      })
    const now = withFlows({}).fraction!
    expect(withFlows({ bloodFlowMlMin: flows.bloodFlowMlMin + 50 }).fraction!).toBeLessThan(now)
    expect(
      withFlows({ patientFluidRemovalMlHour: flows.patientFluidRemovalMlHour + 100 }).fraction!,
    ).toBeGreaterThan(now)
    expect(
      withFlows({
        preReplacementFlowMlHour: flows.preReplacementFlowMlHour + 900,
        postReplacementFlowMlHour: flows.postReplacementFlowMlHour - 900,
      }).fraction!,
    ).toBeLessThan(now)
    // Zero blood flow: no plasma reaches the filter, so there is no fraction, not a zero or NaN.
    const noFlow = withFlows({ bloodFlowMlMin: 0 })
    expect(noFlow.fraction).toBeNull()
    expect(noFlow.status).toBe('not-delivering')
    // A makeup flow: its volume cannot be attributed, so nothing is stated.
    const makeup = withFlows({ makeupFlowMlHour: 50 })
    expect(makeup.fraction).toBeNull()
    expect(makeup.status).toBe('makeup-running')
    // Blood pump off: nothing is being filtered.
    const stopped = selectCrrtFiltrationFraction({
      ...simulation,
      device: { ...simulation.device, bloodPumpRunning: false },
    })
    expect(stopped.fraction).toBeNull()
    expect(stopped.reason).toBe('Nothing is being filtered while the circuit is not running.')
  })

  it('CRRT-16 starts at the 16% its teaching states', () => {
    const now = selectCrrtFiltrationFraction(start('CRRT-16').simulation)
    expect(Math.round((now.fraction ?? Number.NaN) * 100)).toBe(16)
  })
})

describe('the words', () => {
  /*
   * Clinical review, 2026-11-13. The ceiling was printed as two numbers that "differ", with a
   * standing line that treated 20% as a ceiling of its own, and six older passages still taught
   * "under 25%". It is now one statement in which each number carries what its source gives it for.
   */
  it('state one ceiling, each number with its source and its scope', () => {
    expect(CRRT_NUMBERS.value('filtration-fraction-ceiling')).toBe('25%')
    expect(CRRT_NUMBERS.value('filtration-fraction-ceiling-range')).toBe('20%–25%')
    expect(CRRT_FILTRATION_FRACTION_CEILINGS).toBe(
      'Keep it at or below 20%–25% to lower the risk of the filter clotting (AJKD Core Curriculum, 2025); with regional citrate a higher fraction is reported, anecdotally, to be tolerated. For post-dilution CVVH, 25% is the usual maximum (Claure-Del Granado and Clark, 2021).',
    )
    expect(CRRT_FILTRATION_FRACTION_CEILINGS).not.toMatch(/sources differ/i)
  })

  it('say where a value stands against the ceiling range, and nothing more', () => {
    expect(crrtFiltrationFractionStanding(0.183).text).toBe('Below the 20%–25% ceiling.')
    expect(crrtFiltrationFractionStanding(0.2).text).toBe('Within the 20%–25% ceiling range.')
    expect(crrtFiltrationFractionStanding(0.21).text).toBe('Within the 20%–25% ceiling range.')
    expect(crrtFiltrationFractionStanding(0.25).text).toBe(
      'At or above 25%, the top of the ceiling range.',
    )
    // 20% is the bottom of the range, never a ceiling of its own.
    for (const value of [0.1, 0.2, 0.22, 0.3])
      expect(crrtFiltrationFractionStanding(value).text).not.toMatch(/under 20%|above 20%/i)
  })

  it('teach the same ceiling in every case and lesson line that names one', () => {
    const text = JSON.stringify([crrtFoundationLessons, crrtWorkedCaseExamples, crrtCompleteCases])
    // No passage is left teaching 25% alone as the ceiling.
    expect(text).not.toMatch(/under 25%|below 25%|the 25% ceiling/)
    expect(text.match(/20%–25%/g)!.length).toBeGreaterThanOrEqual(6)
  })

  it('name the value an estimate, and say it is not either PrisMax display', () => {
    expect(CRRT_FILTRATION_FRACTION_NAME).toBe('Filtration fraction (calculated estimate)')
    expect(CRRT_FILTRATION_FRACTION_SHORT_NAME).toBe('Filtration fraction (estimate)')
    expect(CRRT_FILTRATION_FRACTION_ESTIMATE_NOTE).toMatch(
      /^This is a calculated estimate: total ultrafiltration over plasma flow plus pre-filter fluid, the expression in the AJKD Core Curriculum 2025 \(Table 5\)\./,
    )
    expect(CRRT_FILTRATION_FRACTION_DEVICE_NOTE).toMatch(/^It is not the PrisMax display\./)
    expect(CRRT_FILTRATION_FRACTION_DEVICE_NOTE).toContain('FF Blood % and FF Plasma %')
    expect(CRRT_FILTRATION_FRACTION_DEVICE_NOTE).toContain('operator’s manual, p. 218')
    // No machine value is printed: the manual's pre-infusion line is not readable as printed.
    expect(
      `${CRRT_FILTRATION_FRACTION_ESTIMATE_NOTE} ${CRRT_FILTRATION_FRACTION_DEVICE_NOTE}`.replace(
        /2025|p\. 218|0\.95|Table 5/g,
        '',
      ),
    ).not.toMatch(/\d/)
  })

  it('say what the estimate leaves out', () => {
    expect(CRRT_FILTRATION_FRACTION_LIMITS).toMatch(/hematocrit is the one entered and stays fixed/)
    expect(CRRT_FILTRATION_FRACTION_LIMITS).toMatch(
      /does not change solute clearance when fluid is moved before the filter/,
    )
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
