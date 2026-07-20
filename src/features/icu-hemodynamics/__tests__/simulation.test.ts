import { hemodynamicCases } from '../content'
import {
  advanceHemodynamicSimulation,
  createInitialHemodynamicState,
  deriveHemodynamicMeasurements,
  generateThermodilutionCurve,
  icuHemodynamicsReducer,
  timeVaryingVentricularElastance,
  totalCirculatingVolumeMl,
  thermodilutionAcceptedAverage,
} from '../engine'

describe('50 Hz circulation, waveforms, and measurement system', () => {
  const definition = hemodynamicCases[0]

  it('is deterministic by seed and keeps fixed-step equivalence', () => {
    const initialA = createInitialHemodynamicState(definition, 'learn', 1234)
    const initialB = createInitialHemodynamicState(definition, 'learn', 1234)
    expect(initialA.waveforms).toEqual(initialB.waveforms)

    const once = advanceHemodynamicSimulation(initialA, 1)
    const split = advanceHemodynamicSimulation(advanceHemodynamicSimulation(initialB, 0.5), 0.5)
    expect(once.timeSeconds).toBe(split.timeSeconds)
    expect(once.measurements).toEqual(split.measurements)
    expect(once.waveforms.at(-1)).toEqual(split.waveforms.at(-1))
  })

  it('uses time-varying ventricular elastance and volume-conserving Windkessel compartments', () => {
    const initial = createInitialHemodynamicState(definition, 'learn', 22)
    const cycle = 60 / initial.parameters.heartRateBpm
    const diastolicElastance = timeVaryingVentricularElastance(
      0,
      initial.parameters.heartRateBpm,
      initial.parameters.leftVentricularContractility,
      'left',
    )
    const systolicElastance = timeVaryingVentricularElastance(
      cycle * 0.21,
      initial.parameters.heartRateBpm,
      initial.parameters.leftVentricularContractility,
      'left',
    )
    expect(systolicElastance).toBeGreaterThan(diastolicElastance * 10)

    const beforeVolume = totalCirculatingVolumeMl(initial.compartments)
    const advanced = advanceHemodynamicSimulation(initial, 1)
    const afterVolume = totalCirculatingVolumeMl(advanced.compartments)
    expect(afterVolume).toBeCloseTo(beforeVolume, 5)
    expect(advanced.compartments.systemicArterialPressureMmHg).toBeGreaterThan(15)
    expect(advanced.compartments.pulmonaryArterialPressureMmHg).toBeGreaterThan(4)
    expect(advanced.compartments.leftVentricularVolumeMl).toBeGreaterThanOrEqual(25)
    expect(advanced.compartments.rightVentricularVolumeMl).toBeLessThanOrEqual(300)
  })

  it('models hydrostatic leveling and damping while preserving bounded mean physiology', () => {
    const zeroed = { ...definition.initialParameters }
    const normal = deriveHemodynamicMeasurements(zeroed, {
      zeroed: true,
      transducerLevelCm: 0,
      dampingRatio: 0.65,
      naturalFrequencyHz: 18,
      noiseAmplitudeMmHg: 0,
      artifact: 'none',
      fastFlushActiveUntil: null,
      lastFastFlushFinding: null,
    })
    const elevated = deriveHemodynamicMeasurements(zeroed, {
      zeroed: true,
      transducerLevelCm: 10,
      dampingRatio: 0.65,
      naturalFrequencyHz: 18,
      noiseAmplitudeMmHg: 0,
      artifact: 'none',
      fastFlushActiveUntil: null,
      lastFastFlushFinding: null,
    })
    expect(normal.mapMmHg - elevated.mapMmHg).toBeGreaterThanOrEqual(7)
    expect(normal.mapMmHg - elevated.mapMmHg).toBeLessThanOrEqual(8)

    const overdamped = deriveHemodynamicMeasurements(zeroed, {
      zeroed: true,
      transducerLevelCm: 0,
      dampingRatio: 1.2,
      naturalFrequencyHz: 18,
      noiseAmplitudeMmHg: 0,
      artifact: 'overdamped',
      fastFlushActiveUntil: null,
      lastFastFlushFinding: null,
    })
    expect(overdamped.artSystolicMmHg - overdamped.artDiastolicMmHg).toBeLessThan(
      normal.artSystolicMmHg - normal.artDiastolicMmHg,
    )
    expect(Math.abs(overdamped.mapMmHg - normal.mapMmHg)).toBeLessThanOrEqual(1)
  })

  it('captures a 12-second wedge and forces recovery after prolonged inflation', () => {
    let state = createInitialHemodynamicState(definition, 'learn', 2)
    state = icuHemodynamicsReducer(state, { type: 'ZERO_TRANSDUCER' })
    state = icuHemodynamicsReducer(state, { type: 'START_WEDGE' })
    expect(state.catheter.balloonInflated).toBe(true)
    state = advanceHemodynamicSimulation(state, 12)
    expect(state.catheter.wedgeCaptureReady).toBe(true)
    state = icuHemodynamicsReducer(state, { type: 'PLACE_WEDGE_CURSOR' })
    state = icuHemodynamicsReducer(state, { type: 'STORE_WEDGE' })
    expect(state.catheter.storedWedgeMmHg).not.toBeNull()
    state = advanceHemodynamicSimulation(state, 3)
    expect(state.catheter.balloonInflated).toBe(false)
    expect(state.catheter.position).toBe('pa')
    expect(state.criticalErrors).toContain('wedge-prolonged-inflation')
  })
})

describe('thermodilution generator', () => {
  const configuration = {
    injectateVolumeMl: 10,
    injectateTemperatureC: 5,
    maximumTrials: 6,
    minimumAcceptedTrials: 3,
  }
  const technique = {
    injectateVolumeMl: 10,
    injectateTemperatureC: 5,
    injectionDurationSeconds: 2.5,
    respiratoryPhase: 'end-expiration' as const,
    smoothness: 0.95,
  }

  it('uses an inverse area-flow relation and deterministic seeded noise', () => {
    const low = generateThermodilutionCurve({
      trueCardiacOutputLMin: 2,
      technique,
      configuration,
      modifiers: { catheterPosition: 'pa' },
      seed: 8,
    })
    const high = generateThermodilutionCurve({
      trueCardiacOutputLMin: 8,
      technique,
      configuration,
      modifiers: { catheterPosition: 'pa' },
      seed: 8,
    })
    expect(low.curveArea).toBeGreaterThan(high.curveArea)
    expect(
      generateThermodilutionCurve({
        trueCardiacOutputLMin: 2,
        technique,
        configuration,
        modifiers: { catheterPosition: 'pa' },
        seed: 8,
      }),
    ).toEqual(low)
  })

  it('flags poor technique and excludes rejected or invalid trials from the three-curve average', () => {
    const bad = generateThermodilutionCurve({
      trueCardiacOutputLMin: 5,
      technique: { ...technique, injectionDurationSeconds: 7, smoothness: 0.3 },
      configuration,
      modifiers: { catheterPosition: 'wedge' },
      seed: 4,
    })
    expect(bad.quality).toBe('invalid')
    expect(bad.alerts.length).toBeGreaterThan(1)

    const valid = [1, 2, 3].map((sequence) => ({
      ...generateThermodilutionCurve({
        trueCardiacOutputLMin: 5,
        technique,
        configuration,
        modifiers: { catheterPosition: 'pa' },
        seed: 4,
        sequence,
      }),
      accepted: true as const,
    }))
    expect(
      thermodilutionAcceptedAverage([...valid.slice(0, 2), { ...valid[2], accepted: false }]),
    ).toBeNull()
    expect(thermodilutionAcceptedAverage(valid)).not.toBeNull()
    expect(thermodilutionAcceptedAverage([...valid, { ...bad, accepted: true }])).toBe(
      thermodilutionAcceptedAverage(valid),
    )
  })
})
