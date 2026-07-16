import {
  PRISMAX_POST_FILTER_ULTRAFILTRATION_GATE,
  PRISMAX_PRE_INFUSION_FLOW_GATE,
  calculateEffluentDoseMlPerKgHour,
  calculatePlasmaFlowMlPerHour,
  calculatePrismaxEffluentPumpTargetMlPerHour,
  calculatePrismaxFiltrationFractionBloodPercent,
  calculatePrismaxFiltrationFractionPlasmaPercent,
  calculatePrismaxPatientFluidRemovedMl,
  calculatePrismaxTotalPredilutionFraction,
} from '../clinicalMath'
import {
  integrateMillilitersPerHourForHours,
  litersToMilliliters,
  millilitersPerHourToMillilitersPerMinute,
  millilitersPerMinuteToMillilitersPerHour,
  millilitersToLiters,
} from '../units'

describe('CRRT unit helpers', () => {
  it('converts blood flow without silently mixing mL/min and mL/h', () => {
    const millilitersPerHour = millilitersPerMinuteToMillilitersPerHour(100)

    expect(millilitersPerHour).toBe(6_000)
    expect(millilitersPerHourToMillilitersPerMinute(millilitersPerHour)).toBe(100)
  })

  it('converts volume and integrates a rate over hours', () => {
    expect(litersToMilliliters(5)).toBe(5_000)
    expect(millilitersToLiters(5_000)).toBe(5)
    expect(integrateMillilitersPerHourForHours(1_200, 1.5)).toBe(1_800)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'rejects invalid unit inputs (%p)',
    (invalid) => {
      expect(() => millilitersPerMinuteToMillilitersPerHour(invalid)).toThrow()
      expect(() => integrateMillilitersPerHourForHours(100, invalid)).toThrow()
    },
  )
})

describe('source-backed PrisMax clinical math', () => {
  it('calculates the exact MATH-PM-001 effluent-pump target', () => {
    expect(
      calculatePrismaxEffluentPumpTargetMlPerHour({
        patientFluidRemovalMlPerHour: 100,
        preBloodPumpMlPerHour: 200,
        totalReplacementMlPerHour: 800,
        dialysateMlPerHour: 1_000,
        syringeMlPerHour: 10,
        makeupMlPerHour: 20,
      }),
    ).toBe(2_130)
  })

  it('rejects nonfinite and negative flow terms', () => {
    expect(() =>
      calculatePrismaxEffluentPumpTargetMlPerHour({
        patientFluidRemovalMlPerHour: 0,
        preBloodPumpMlPerHour: 0,
        totalReplacementMlPerHour: 0,
        dialysateMlPerHour: Number.NaN,
        syringeMlPerHour: 0,
        makeupMlPerHour: 0,
      }),
    ).toThrow(/finite/i)

    expect(() =>
      calculatePrismaxEffluentPumpTargetMlPerHour({
        patientFluidRemovalMlPerHour: -1,
        preBloodPumpMlPerHour: 0,
        totalReplacementMlPerHour: 0,
        dialysateMlPerHour: 0,
        syringeMlPerHour: 0,
        makeupMlPerHour: 0,
      }),
    ).toThrow(/zero or greater/i)
  })

  it('calculates effluent dose without imposing a target range', () => {
    expect(calculateEffluentDoseMlPerKgHour(2_100, 70)).toBe(30)
    expect(calculateEffluentDoseMlPerKgHour(0, 70)).toBe(0)
    expect(() => calculateEffluentDoseMlPerKgHour(2_100, 0)).toThrow(/greater than zero/i)
  })

  it('keeps machine PFR volume separate and preserves a net gain result', () => {
    expect(
      calculatePrismaxPatientFluidRemovedMl({
        effluentVolumeMl: 5_000,
        preBloodPumpVolumeMl: 500,
        dialysateVolumeMl: 1_000,
        replacementVolumeMl: 2_000,
        syringeVolumeMl: 100,
      }),
    ).toBe(1_400)

    expect(
      calculatePrismaxPatientFluidRemovedMl({
        effluentVolumeMl: 100,
        preBloodPumpVolumeMl: 200,
        dialysateVolumeMl: 0,
        replacementVolumeMl: 0,
        syringeVolumeMl: 0,
      }),
    ).toBe(-100)
  })

  it('calculates plasma flow only after explicit conversion to mL/h', () => {
    const bloodFlowMlPerHour = millilitersPerMinuteToMillilitersPerHour(100)

    expect(calculatePlasmaFlowMlPerHour(bloodFlowMlPerHour, 30)).toBe(4_200)
    expect(() => calculatePlasmaFlowMlPerHour(bloodFlowMlPerHour, 100)).toThrow(/less than 100/i)
  })

  it('calculates total predilution as the printed dimensionless ratio', () => {
    expect(
      calculatePrismaxTotalPredilutionFraction({
        preBloodPumpMlPerHour: 200,
        preFilterReplacementMlPerHour: 300,
        totalReplacementMlPerHour: 800,
      }),
    ).toBe(0.5)

    expect(() =>
      calculatePrismaxTotalPredilutionFraction({
        preBloodPumpMlPerHour: 0,
        preFilterReplacementMlPerHour: 0,
        totalReplacementMlPerHour: 0,
      }),
    ).toThrow(/greater than zero/i)

    expect(() =>
      calculatePrismaxTotalPredilutionFraction({
        preBloodPumpMlPerHour: 100,
        preFilterReplacementMlPerHour: 500,
        totalReplacementMlPerHour: 400,
      }),
    ).toThrow(/must not exceed/i)
  })

  it('calculates FF Blood from explicit Qpre without using Qufpost', () => {
    const percent = calculatePrismaxFiltrationFractionBloodPercent({
      postFilterReplacementMlPerHour: 500,
      patientFluidRemovalMlPerHour: 100,
      syringeMlPerHour: 0,
      plasmaFlowMlPerHour: 4_200,
      preInfusionFlowMlPerHour: 1_000,
    })

    expect(percent).toBeCloseTo((100 * 600) / 5_200, 10)
  })

  it('calculates FF Plasma from explicit Qpre and the source-backed water fraction', () => {
    const percent = calculatePrismaxFiltrationFractionPlasmaPercent({
      effluentFlowMlPerHour: 2_500,
      plasmaFlowMlPerHour: 4_200,
      preInfusionFlowMlPerHour: 1_000,
      plasmaWaterFraction: 0.95,
    })

    expect(percent).toBeCloseTo((100 * 2_500) / (4_200 * 0.95 + 1_000), 10)
  })

  it('rejects zero and nonfinite filtration-fraction denominators', () => {
    expect(() =>
      calculatePrismaxFiltrationFractionBloodPercent({
        postFilterReplacementMlPerHour: 0,
        patientFluidRemovalMlPerHour: 0,
        syringeMlPerHour: 0,
        plasmaFlowMlPerHour: 0,
        preInfusionFlowMlPerHour: 0,
      }),
    ).toThrow(/greater than zero/i)

    expect(() =>
      calculatePrismaxFiltrationFractionPlasmaPercent({
        effluentFlowMlPerHour: 0,
        plasmaFlowMlPerHour: Number.POSITIVE_INFINITY,
        preInfusionFlowMlPerHour: 0,
        plasmaWaterFraction: 0.95,
      }),
    ).toThrow(/finite/i)
    expect(() =>
      calculatePrismaxFiltrationFractionPlasmaPercent({
        effluentFlowMlPerHour: 1,
        plasmaFlowMlPerHour: 1,
        preInfusionFlowMlPerHour: 0,
        plasmaWaterFraction: 0,
      }),
    ).toThrow(/greater than zero/i)
  })

  it('exports both disputed PrisMax expressions as disabled gates', () => {
    expect(PRISMAX_POST_FILTER_ULTRAFILTRATION_GATE).toMatchObject({
      conflictId: 'CONFLICT-001',
      sourceRecordId: 'MATH-PM-004',
      symbol: 'Qufpost',
      enabled: false,
    })
    expect(PRISMAX_PRE_INFUSION_FLOW_GATE).toMatchObject({
      conflictId: 'CONFLICT-002',
      sourceRecordId: 'MATH-PM-006',
      symbol: 'Qpre',
      enabled: false,
    })
  })
})
