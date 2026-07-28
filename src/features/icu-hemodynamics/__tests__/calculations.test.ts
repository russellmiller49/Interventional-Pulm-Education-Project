import {
  calculateDerivedHemodynamics,
  checkPassiveLegRaiseValidity,
  checkPpvValidity,
} from '../engine'

const validPpvContext = {
  controlledMechanicalVentilation: true,
  regularRhythm: true,
  noSpontaneousEffort: true,
  tidalVolumeMlKg: 8,
  closedChest: true,
  validArterialWaveform: true,
  rightVentricularFailure: false,
  intraAbdominalPressureElevated: false,
}

describe('derived hemodynamic calculations', () => {
  it('calculates flow, resistance, power, RV, pulmonary compliance, and PPV equations', () => {
    const result = calculateDerivedHemodynamics({
      measurements: {
        heartRateBpm: 100,
        cardiacOutputLMin: 5,
        mapMmHg: 75,
        rapMmHg: 5,
        meanPapMmHg: 25,
        pawpMmHg: 10,
        papSystolicMmHg: 35,
        papDiastolicMmHg: 20,
        pulsePressureMaxMmHg: 50,
        pulsePressureMinMmHg: 40,
      },
      bodySurfaceAreaM2: 2,
      ppvContext: validPpvContext,
    })

    expect(result.cardiacIndexLMinM2.value).toBe(2.5)
    expect(result.strokeVolumeMl.value).toBe(50)
    expect(result.strokeVolumeIndexMlM2.value).toBe(25)
    expect(result.systemicVascularResistance.value).toBe(1120)
    expect(result.systemicVascularResistanceIndex.value).toBe(2240)
    expect(result.pulmonaryVascularResistance.value).toBe(3)
    expect(result.pulmonaryVascularResistanceIndex.value).toBe(6)
    expect(result.cardiacPowerOutputW.value).toBeCloseTo(0.83, 2)
    expect(result.pulmonaryArteryPulsatilityIndex.value).toBe(3)
    expect(result.pulmonaryArteryCompliance.value).toBeCloseTo(3.3, 1)
    expect(result.pulsePressureVariationPercent.value).toBe(22)
  })

  it('returns explanatory uninterpretable states for stale, missing, or invalid inputs', () => {
    const result = calculateDerivedHemodynamics({
      measurements: { heartRateBpm: 0, cardiacOutputLMin: 0 },
      inputsStale: true,
      ppvContext: { ...validPpvContext, regularRhythm: false },
    })
    for (const value of Object.values(result)) {
      expect(value.status).toBe('not-interpretable')
      expect(value.reason).toBeTruthy()
    }
  })

  it('screens PPV and passive-leg-raise validity instead of applying a threshold blindly', () => {
    expect(checkPpvValidity(validPpvContext)).toEqual({ valid: true, reasons: [] })
    const invalid = checkPpvValidity({
      ...validPpvContext,
      regularRhythm: false,
      noSpontaneousEffort: false,
      rightVentricularFailure: true,
    })
    expect(invalid.valid).toBe(false)
    expect(invalid.reasons.join(' ')).toMatch(/Irregular rhythm|Spontaneous|Right-ventricular/i)

    expect(
      checkPassiveLegRaiseValidity({
        canChangePosition: true,
        abdominalCompartmentSyndrome: false,
        intracranialPressureConcern: false,
        realTimeStrokeVolumeAvailable: true,
      }).valid,
    ).toBe(true)
  })
})
