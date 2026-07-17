import {
  deviceArchitectureProfiles,
  getDeviceArchitectureProfile,
  getDeviceLoadFrame,
} from '../deviceArchitectureProfiles'

describe('device architecture kinematics', () => {
  it('defines one unique profile for each named scaffold', () => {
    const ids = deviceArchitectureProfiles.map((profile) => profile.id)

    expect(ids).toEqual(['aero', 'bonastent', 'ultraflex'])
    expect(new Set(ids).size).toBe(ids.length)
    expect(deviceArchitectureProfiles.every((profile) => profile.sourceRefs.length > 0)).toBe(true)
  })

  it('uses substantially less diameter-length coupling for the cut lattice', () => {
    const aero = getDeviceArchitectureProfile('aero')
    const bonastent = getDeviceArchitectureProfile('bonastent')
    const ultraflex = getDeviceArchitectureProfile('ultraflex')

    expect(aero.visualCalibration.axialCoupling).toBeLessThan(
      bonastent.visualCalibration.axialCoupling,
    )
    expect(aero.visualCalibration.axialCoupling).toBeLessThan(
      ultraflex.visualCalibration.axialCoupling,
    )
  })

  it('returns an undeformed frame for the unloaded state', () => {
    const frame = getDeviceLoadFrame({
      elapsedSeconds: 4,
      loadAmplitude: 1,
      mode: 'rest',
      playing: true,
    })

    expect(frame).toMatchObject({
      bend: 0,
      compression: 0,
      eccentricity: 0,
      focality: 0,
      ovalization: 0,
    })
  })

  it('makes a cough more focal and eccentric than symmetric radial compression', () => {
    const cough = getDeviceLoadFrame({
      elapsedSeconds: 0,
      loadAmplitude: 0.8,
      mode: 'cough',
      playing: false,
    })
    const radial = getDeviceLoadFrame({
      elapsedSeconds: 0,
      loadAmplitude: 0.8,
      mode: 'radial',
      playing: false,
    })

    expect(cough.focality).toBeGreaterThan(radial.focality)
    expect(cough.focusWidth).toBeLessThan(radial.focusWidth)
    expect(cough.bend).toBeGreaterThan(radial.bend)
    expect(cough.eccentricity).toBeGreaterThan(radial.eccentricity)
    expect(cough.ovalization).toBeGreaterThan(radial.ovalization)
  })

  it('clamps visible displacement amplitude to the supported range', () => {
    const clampedHigh = getDeviceLoadFrame({
      elapsedSeconds: 0,
      loadAmplitude: 5,
      mode: 'radial',
      playing: false,
    })
    const nominalHigh = getDeviceLoadFrame({
      elapsedSeconds: 0,
      loadAmplitude: 1,
      mode: 'radial',
      playing: false,
    })
    const clampedLow = getDeviceLoadFrame({
      elapsedSeconds: 0,
      loadAmplitude: -2,
      mode: 'radial',
      playing: false,
    })

    expect(clampedHigh).toEqual(nominalHigh)
    expect(clampedLow.compression).toBe(0)
  })
})
