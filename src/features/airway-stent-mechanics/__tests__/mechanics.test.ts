import { stentArchitecturePresets } from '../content/stentProfiles'
import {
  calculateMechanicsProfile,
  calculateOversizingPercent,
  createRelativeForceCurve,
  defaultMechanicsInputs,
  wireBendingScale,
} from '../engine/mechanics'

describe('airway stent mechanics engine', () => {
  it('calculates diameter oversizing from the free stent and airway diameters', () => {
    expect(calculateOversizingPercent(14, 12)).toBeCloseTo(16.667, 3)
    expect(calculateOversizingPercent(12, 12)).toBe(0)
    expect(calculateOversizingPercent(11, 12)).toBeCloseTo(-8.333, 3)
  })

  it('rejects non-physical diameter inputs', () => {
    expect(() => calculateOversizingPercent(0, 12)).toThrow('greater than zero')
    expect(() => calculateOversizingPercent(12, -1)).toThrow('greater than zero')
    expect(() => calculateOversizingPercent(Number.NaN, 12)).toThrow('finite numbers')
  })

  it('preserves the fourth-power circular-wire teaching relationship', () => {
    expect(wireBendingScale(1)).toBe(1)
    expect(wireBendingScale(1.1)).toBeCloseTo(1.4641, 4)
    expect(wireBendingScale(0.9)).toBeCloseTo(0.6561, 4)
  })

  it('creates separate monotonic loading and unloading curves', () => {
    const preset = stentArchitecturePresets.find((item) => item.id === 'multiwire-braid')
    expect(preset).toBeDefined()
    const curve = createRelativeForceCurve(preset!, 1)

    expect(curve).toHaveLength(11)
    expect(curve[0]).toMatchObject({
      diameterPercent: 100,
      compressionPercent: 0,
      compressionResistance: 0,
      chronicOutwardForce: 0,
    })
    expect(curve.at(-1)?.diameterPercent).toBe(50)

    for (let index = 1; index < curve.length; index += 1) {
      expect(curve[index].compressionResistance).toBeGreaterThan(
        curve[index - 1].compressionResistance,
      )
      expect(curve[index].chronicOutwardForce).toBeGreaterThan(curve[index - 1].chronicOutwardForce)
      expect(curve[index].compressionResistance).toBeGreaterThan(curve[index].chronicOutwardForce)
    }
  })

  it('keeps every modeled output finite and within its documented normalized range', () => {
    for (const preset of stentArchitecturePresets) {
      const profile = calculateMechanicsProfile({
        ...defaultMechanicsInputs,
        architectureId: preset.id,
      })

      for (const value of [
        profile.radialSupportIndex,
        profile.chronicContactIndex,
        profile.migrationResistanceIndex,
        profile.straighteningIndex,
        profile.areaRetentionPercent,
        profile.fatigueDemandIndex,
        profile.secretionBurdenIndex,
      ]) {
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(100)
      }
      expect(profile.interpretation).toHaveLength(3)
    }
  })

  it('raises support and contact when the same device is more oversized', () => {
    const lower = calculateMechanicsProfile({
      ...defaultMechanicsInputs,
      airwayDiameterMm: 13,
      freeStentDiameterMm: 13,
    })
    const higher = calculateMechanicsProfile({
      ...defaultMechanicsInputs,
      airwayDiameterMm: 11,
      freeStentDiameterMm: 15,
    })

    expect(higher.radialSupportIndex).toBeGreaterThan(lower.radialSupportIndex)
    expect(higher.chronicContactIndex).toBeGreaterThan(lower.chronicContactIndex)
  })

  it('separates wet-interface friction from geometric anchoring', () => {
    const wet = calculateMechanicsProfile({ ...defaultMechanicsInputs, wetInterface: true })
    const dry = calculateMechanicsProfile({ ...defaultMechanicsInputs, wetInterface: false })

    expect(wet.migrationResistanceIndex).toBeLessThan(dry.migrationResistanceIndex)
    expect(wet.radialSupportIndex).toBe(dry.radialSupportIndex)
  })

  it('adds bend demand without changing the catalog material label', () => {
    const straight = calculateMechanicsProfile({
      ...defaultMechanicsInputs,
      airwayGeometry: 'straight',
      curvaturePercent: 0,
    })
    const curved = calculateMechanicsProfile({
      ...defaultMechanicsInputs,
      airwayGeometry: 'curved',
      curvaturePercent: 90,
    })

    expect(curved.straighteningIndex).toBeGreaterThan(straight.straighteningIndex)
    expect(curved.fatigueDemandIndex).toBeGreaterThan(straight.fatigueDemandIndex)
  })
})
