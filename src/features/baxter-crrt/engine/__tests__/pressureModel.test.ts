import {
  calculatePrismaxFilterPressureDropMmHg,
  calculatePrismaxTmpMmHg,
  calculateSyntheticBloodCircuitPressures,
  type SyntheticBloodCircuitPressureParameters,
} from '../pressureModel'

describe('source-backed PrisMax pressure displays', () => {
  it('calculates TMP with the exact -18 mmHg device correction', () => {
    expect(
      calculatePrismaxTmpMmHg({
        rawFilterPressureMmHg: 150,
        rawReturnPressureMmHg: 90,
        rawEffluentPressureMmHg: -20,
      }),
    ).toBe(122)
  })

  it('returns raw and displayed filter drop without double-applying -25 mmHg', () => {
    expect(calculatePrismaxFilterPressureDropMmHg(150, 90)).toEqual({
      rawPressureDropMmHg: 60,
      displayedPressureDropMmHg: 35,
    })
  })

  it('rejects nonfinite monitored pressures', () => {
    expect(() =>
      calculatePrismaxTmpMmHg({
        rawFilterPressureMmHg: Number.NaN,
        rawReturnPressureMmHg: 90,
        rawEffluentPressureMmHg: -20,
      }),
    ).toThrow(/finite/i)
    expect(() => calculatePrismaxFilterPressureDropMmHg(150, Number.NEGATIVE_INFINITY)).toThrow(
      /finite/i,
    )
  })
})

describe('parametric synthetic blood-circuit pressure directionality', () => {
  const baseline: SyntheticBloodCircuitPressureParameters = {
    bloodFlowMlPerMinute: 100,
    accessReferencePressureMmHg: 5,
    returnReferencePressureMmHg: 10,
    accessResistanceMmHgPerMlPerMinute: 0.2,
    filterResistanceMmHgPerMlPerMinute: 0.3,
    returnResistanceMmHgPerMlPerMinute: 0.1,
  }

  it('derives pressures only from caller-supplied references and resistances', () => {
    expect(calculateSyntheticBloodCircuitPressures(baseline)).toEqual({
      accessPressureMmHg: -15,
      filterPressureMmHg: 50,
      returnPressureMmHg: 20,
    })
  })

  it('makes access pressure more negative as access resistance or blood flow rises', () => {
    const initial = calculateSyntheticBloodCircuitPressures(baseline)
    const moreAccessResistance = calculateSyntheticBloodCircuitPressures({
      ...baseline,
      accessResistanceMmHgPerMlPerMinute: 0.3,
    })
    const moreBloodFlow = calculateSyntheticBloodCircuitPressures({
      ...baseline,
      bloodFlowMlPerMinute: 120,
    })

    expect(moreAccessResistance.accessPressureMmHg).toBeLessThan(initial.accessPressureMmHg)
    expect(moreBloodFlow.accessPressureMmHg).toBeLessThan(initial.accessPressureMmHg)
  })

  it('raises return and filter pressure with more return resistance', () => {
    const initial = calculateSyntheticBloodCircuitPressures(baseline)
    const obstructedReturn = calculateSyntheticBloodCircuitPressures({
      ...baseline,
      returnResistanceMmHgPerMlPerMinute: 0.2,
    })

    expect(obstructedReturn.returnPressureMmHg).toBeGreaterThan(initial.returnPressureMmHg)
    expect(obstructedReturn.filterPressureMmHg).toBeGreaterThan(initial.filterPressureMmHg)
  })

  it('raises filter pressure without changing return pressure when filter resistance rises', () => {
    const initial = calculateSyntheticBloodCircuitPressures(baseline)
    const moreFilterResistance = calculateSyntheticBloodCircuitPressures({
      ...baseline,
      filterResistanceMmHgPerMlPerMinute: 0.4,
    })

    expect(moreFilterResistance.filterPressureMmHg).toBeGreaterThan(initial.filterPressureMmHg)
    expect(moreFilterResistance.returnPressureMmHg).toBe(initial.returnPressureMmHg)
  })

  it('rejects nonfinite references and negative synthetic resistance', () => {
    expect(() =>
      calculateSyntheticBloodCircuitPressures({
        ...baseline,
        accessReferencePressureMmHg: Number.NaN,
      }),
    ).toThrow(/finite/i)

    expect(() =>
      calculateSyntheticBloodCircuitPressures({
        ...baseline,
        filterResistanceMmHgPerMlPerMinute: -0.1,
      }),
    ).toThrow(/zero or greater/i)
  })
})
