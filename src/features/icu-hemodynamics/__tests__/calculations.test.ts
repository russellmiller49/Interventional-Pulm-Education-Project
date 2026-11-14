import {
  calculateDerivedHemodynamics,
  checkPassiveLegRaiseValidity,
  checkPpvValidity,
  defaultMeasurementSystem,
  faultsWithStoredWedge,
  pressureSignalFaults,
  wedgeReadingFaults,
  type DerivedHemodynamics,
  type DerivedSignalFault,
  type MeasurementSystemState,
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

const completeMeasurements = {
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
}

/** Stated by hand here, so a dependency dropped from the code cannot pass by agreeing with itself. */
const requiredMeasurements: Readonly<Record<keyof DerivedHemodynamics, readonly string[]>> = {
  cardiacIndexLMinM2: ['cardiacOutputLMin', 'bodySurfaceAreaM2'],
  strokeVolumeMl: ['cardiacOutputLMin', 'heartRateBpm'],
  strokeVolumeIndexMlM2: ['cardiacOutputLMin', 'heartRateBpm', 'bodySurfaceAreaM2'],
  systemicVascularResistance: ['mapMmHg', 'rapMmHg', 'cardiacOutputLMin'],
  systemicVascularResistanceIndex: ['mapMmHg', 'rapMmHg', 'cardiacOutputLMin', 'bodySurfaceAreaM2'],
  pulmonaryVascularResistance: ['meanPapMmHg', 'pawpMeanMmHg', 'cardiacOutputLMin'],
  pulmonaryVascularResistanceIndex: [
    'meanPapMmHg',
    'pawpMeanMmHg',
    'cardiacOutputLMin',
    'bodySurfaceAreaM2',
  ],
  cardiacPowerOutputW: ['mapMmHg', 'cardiacOutputLMin'],
  pulmonaryArteryPulsatilityIndex: ['papSystolicMmHg', 'papDiastolicMmHg', 'rapMmHg'],
  pulmonaryArteryCompliance: [
    'cardiacOutputLMin',
    'heartRateBpm',
    'papSystolicMmHg',
    'papDiastolicMmHg',
  ],
  pulsePressureVariationPercent: ['pulsePressureMaxMmHg', 'pulsePressureMinMmHg'],
}

const faultOn = (...inputIds: string[]): DerivedSignalFault => ({
  id: 'test-fault',
  label: 'test fault',
  reason: 'A test fault.',
  inputIds,
})

const calculate = (signalFaults?: readonly DerivedSignalFault[]) =>
  calculateDerivedHemodynamics({
    measurements: completeMeasurements,
    bodySurfaceAreaM2: 2,
    ppvContext: validPpvContext,
    signalFaults,
  })

const cleanSystem: MeasurementSystemState = { ...defaultMeasurementSystem, zeroed: true }

function reachedInputs(system: MeasurementSystemState): readonly string[] {
  return [...new Set(pressureSignalFaults(system).flatMap((fault) => fault.inputIds))].sort()
}

describe('validity propagation', () => {
  const metricIds = Object.keys(requiredMeasurements) as (keyof DerivedHemodynamics)[]
  const inputIds = [...new Set(Object.values(requiredMeasurements).flat())]

  it.each(inputIds)('a fault on %s withholds exactly the results that need it', (inputId) => {
    const clean = calculate()
    const faulted = calculate([faultOn(inputId)])
    for (const metricId of metricIds) {
      if (requiredMeasurements[metricId].includes(inputId)) {
        expect(faulted[metricId].status).toBe('not-interpretable')
        expect(faulted[metricId].value).toBeNull()
        expect(faulted[metricId].reason).toMatch(/\(test fault\)/)
      } else {
        expect(faulted[metricId]).toEqual(clean[metricId])
        expect(faulted[metricId].status).toBe('interpretable')
      }
    }
  })

  it('collects an unreliable input and a missing one instead of hiding the second', () => {
    const { systemicVascularResistance } = calculateDerivedHemodynamics({
      measurements: { mapMmHg: 75, rapMmHg: 5 },
      signalFaults: [faultOn('mapMmHg')],
    })
    expect(systemicVascularResistance.reason).toBe(
      'Unreliable input: Mean arterial pressure (test fault). Current MAP, RAP, and positive cardiac output are required.',
    )
  })

  it('names only the required measurements a fault reaches', () => {
    const { cardiacPowerOutputW } = calculate([faultOn('mapMmHg', 'rapMmHg', 'meanPapMmHg')])
    expect(cardiacPowerOutputW.reason).toBe(
      'Unreliable input: Mean arterial pressure (test fault).',
    )
  })

  it('treats a non-positive pulse pressure as invalid, as the metric record requires', () => {
    const { pulsePressureVariationPercent } = calculateDerivedHemodynamics({
      measurements: { pulsePressureMaxMmHg: 10, pulsePressureMinMmHg: -2 },
      ppvContext: validPpvContext,
    })
    expect(pulsePressureVariationPercent.status).toBe('not-interpretable')
  })
})

describe('which fault reaches which measurement', () => {
  const absolutePressures = [
    'mapMmHg',
    'meanPapMmHg',
    'papDiastolicMmHg',
    'papSystolicMmHg',
    'pawpMeanMmHg',
    'rapMmHg',
  ]

  it('finds nothing wrong with a zeroed, levelled, well-damped system', () => {
    expect(pressureSignalFaults(cleanSystem)).toEqual([])
  })

  it('a zero or level error reaches every absolute pressure and no pulse pressure', () => {
    expect(reachedInputs({ ...cleanSystem, zeroed: false })).toEqual(absolutePressures)
    expect(reachedInputs({ ...cleanSystem, transducerLevelCm: -2 })).toEqual(absolutePressures)
    expect(reachedInputs({ ...cleanSystem, transducerLevelCm: 1 })).toEqual([])
  })

  it('poor dynamic response reaches systolic, diastolic and pulse pressure, not the means', () => {
    const reached = [
      'papDiastolicMmHg',
      'papSystolicMmHg',
      'pulsePressureMaxMmHg',
      'pulsePressureMinMmHg',
    ]
    expect(reachedInputs({ ...cleanSystem, artifact: 'overdamped' })).toEqual(reached)
    expect(reachedInputs({ ...cleanSystem, artifact: 'underdamped' })).toEqual(reached)
    expect(reachedInputs({ ...cleanSystem, dampingRatio: 1.2 })).toEqual(reached)
    expect(reachedInputs({ ...cleanSystem, dampingRatio: 0.2 })).toEqual(reached)
  })

  it('each line answers to its own dynamic response', () => {
    const response = { dampingRatio: 0.65, naturalFrequencyHz: 18 }
    expect(
      reachedInputs({
        ...cleanSystem,
        arterialLine: { ...response, dampingRatio: 1.2, artifact: 'overdamped' },
      }),
    ).toEqual(['pulsePressureMaxMmHg', 'pulsePressureMinMmHg'])
    expect(
      reachedInputs({
        ...cleanSystem,
        artifact: 'overdamped',
        arterialLine: { ...response, artifact: 'none' },
      }),
    ).toEqual(['papDiastolicMmHg', 'papSystolicMmHg'])
  })

  it.each(['catheter-whip', 'wall-contact'] as const)(
    '%s stays on the catheter tip',
    (artifact) => {
      expect(reachedInputs({ ...cleanSystem, artifact })).toEqual([
        'meanPapMmHg',
        'papDiastolicMmHg',
        'papSystolicMmHg',
        'pawpMeanMmHg',
      ])
    },
  )

  it('a false wedge reaches PAWP and nothing else', () => {
    expect(reachedInputs({ ...cleanSystem, artifact: 'false-wedge' })).toEqual(['pawpMeanMmHg'])
  })

  it('a stored wedge keeps only the faults that reach a wedge', () => {
    expect(wedgeReadingFaults({ ...cleanSystem, artifact: 'overdamped' })).toEqual([])
    expect(wedgeReadingFaults({ ...cleanSystem, artifact: 'false-wedge' })).toHaveLength(1)
    expect(wedgeReadingFaults({ ...cleanSystem, zeroed: false })).toHaveLength(1)
  })

  it('a stored wedge answers to its own faults and not to the line as it stands', () => {
    const live = pressureSignalFaults({ ...cleanSystem, zeroed: false, artifact: 'false-wedge' })
    const stored = wedgeReadingFaults({ ...cleanSystem, artifact: 'wall-contact' })
    const combined = faultsWithStoredWedge(live, stored)
    expect(combined.map((fault) => fault.id)).toEqual(['not-zeroed', 'stored-wall-contact'])
    expect(combined[0].inputIds).not.toContain('pawpMeanMmHg')
    expect(combined[1].inputIds).toEqual(['pawpMeanMmHg'])
  })
})

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
