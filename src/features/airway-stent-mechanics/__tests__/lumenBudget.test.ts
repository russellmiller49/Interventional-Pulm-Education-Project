import { circleAreaMm2, deriveInnerDiameterMm, lumenAreaFraction } from '../engine/lumenBudget'

describe('airway-stent lumen budget geometry', () => {
  it('derives inner diameter from a uniform wall without rounding', () => {
    expect(deriveInnerDiameterMm(14, 1.5)).toBe(11)
    expect(deriveInnerDiameterMm(14, 0.5)).toBe(13)
    expect(deriveInnerDiameterMm(12.5, 0.75)).toBe(11)
  })

  it('calculates circular lumen area and the open-area fraction', () => {
    expect(circleAreaMm2(10)).toBeCloseTo(25 * Math.PI, 10)
    expect(lumenAreaFraction(10, 12)).toBeCloseTo(100 / 144, 10)
    expect(lumenAreaFraction(12, 12)).toBe(1)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite dimensions (%s)',
    (invalid) => {
      expect(() => circleAreaMm2(invalid)).toThrow(/finite/i)
      expect(() => deriveInnerDiameterMm(invalid, 1)).toThrow(/finite/i)
      expect(() => deriveInnerDiameterMm(12, invalid)).toThrow(/finite/i)
      expect(() => lumenAreaFraction(invalid, 12)).toThrow(/finite/i)
      expect(() => lumenAreaFraction(10, invalid)).toThrow(/finite/i)
    },
  )

  it.each([0, -0.1, -10])('rejects non-positive dimensions (%s)', (invalid) => {
    expect(() => circleAreaMm2(invalid)).toThrow(/greater than 0/i)
    expect(() => deriveInnerDiameterMm(invalid, 1)).toThrow(/greater than 0/i)
    expect(() => deriveInnerDiameterMm(12, invalid)).toThrow(/greater than 0/i)
    expect(() => lumenAreaFraction(invalid, 12)).toThrow(/greater than 0/i)
    expect(() => lumenAreaFraction(10, invalid)).toThrow(/greater than 0/i)
  })

  it('rejects impossible tube and lumen geometry', () => {
    expect(() => deriveInnerDiameterMm(12, 6)).toThrow(/less than half/i)
    expect(() => deriveInnerDiameterMm(12, 7)).toThrow(/less than half/i)
    expect(() => lumenAreaFraction(13, 12)).toThrow(/must not exceed/i)
  })
})
