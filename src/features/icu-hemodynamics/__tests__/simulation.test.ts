import { hemodynamicCases, hemodynamicsSourceById } from '../content'
import {
  advanceHemodynamicSimulation,
  catheterTransitionDurationSeconds,
  catheterPositionDepth,
  createInitialHemodynamicState,
  deriveHemodynamicMeasurements,
  generateThermodilutionCurve,
  icuHemodynamicsReducer,
  timeVaryingVentricularElastance,
  totalCirculatingVolumeMl,
  thermodilutionAcceptedAverage,
  WEDGE_AUTO_DEFLATION_SECONDS,
  wedgeCaptureDelaySeconds,
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

  it('enables end-expiratory capture after one respiratory cycle and auto-deflates at 10 seconds', () => {
    let state = createInitialHemodynamicState(definition, 'learn', 2)
    state = icuHemodynamicsReducer(state, { type: 'ZERO_TRANSDUCER' })
    state = icuHemodynamicsReducer(state, { type: 'START_WEDGE' })
    expect(state.catheter.balloonInflated).toBe(true)
    expect(state.catheter.insertionDepthCm).toBe(catheterPositionDepth('pa'))
    expect(catheterPositionDepth('wedge')).toBe(catheterPositionDepth('pa'))

    const captureDelay = wedgeCaptureDelaySeconds(state.parameters.respiratoryRateBpm)
    state = advanceHemodynamicSimulation(state, captureDelay - 0.2)
    expect(state.catheter.wedgeCaptureReady).toBe(false)
    state = advanceHemodynamicSimulation(state, 0.4)
    expect(state.catheter.wedgeCaptureReady).toBe(true)
    state = icuHemodynamicsReducer(state, { type: 'PLACE_WEDGE_CURSOR' })
    state = icuHemodynamicsReducer(state, { type: 'STORE_WEDGE' })
    expect(state.catheter.storedWedgeMmHg).not.toBeNull()
    const elapsed = state.timeSeconds - (state.catheter.wedgeStartedAt ?? 0)
    state = advanceHemodynamicSimulation(state, WEDGE_AUTO_DEFLATION_SECONDS - elapsed + 0.1)
    expect(state.catheter.balloonInflated).toBe(false)
    expect(state.catheter.position).toBe('pa')
    expect(state.criticalErrors).toContain('wedge-prolonged-inflation')
    expect(state.responseMessage).toMatch(/10-second inflation limit.*auto-deflated/i)
  })

  it('holds the confirmed waveform position until each animated PAC transition arrives', () => {
    let state = icuHemodynamicsReducer(createInitialHemodynamicState(definition, 'learn', 14), {
      type: 'SET_CATHETER_POSITION',
      position: 'introducer',
    })

    state = icuHemodynamicsReducer(state, { type: 'ADVANCE_CATHETER' })
    expect(state.catheter.position).toBe('introducer')
    expect(state.catheter.targetPosition).toBe('ra')
    expect(state.catheter.floatBalloonInflated).toBe(false)

    const introToRa = catheterTransitionDurationSeconds('introducer', 'ra')
    state = advanceHemodynamicSimulation(state, introToRa - 0.1)
    expect(state.catheter.position).toBe('introducer')
    expect(state.catheter.targetPosition).toBe('ra')
    state = advanceHemodynamicSimulation(state, 0.2)
    expect(state.catheter.position).toBe('ra')
    expect(state.catheter.targetPosition).toBeNull()

    state = icuHemodynamicsReducer(state, { type: 'ADVANCE_CATHETER' })
    expect(state.catheter.position).toBe('ra')
    expect(state.catheter.targetPosition).toBe('rv')
    expect(state.catheter.floatBalloonInflated).toBe(true)
    state = advanceHemodynamicSimulation(state, catheterTransitionDurationSeconds('ra', 'rv') + 0.1)
    expect(state.catheter.position).toBe('rv')
    expect(state.catheter.floatBalloonInflated).toBe(true)

    state = icuHemodynamicsReducer(state, { type: 'ADVANCE_CATHETER' })
    expect(state.catheter.position).toBe('rv')
    expect(state.catheter.targetPosition).toBe('pa')
    expect(state.catheter.floatBalloonInflated).toBe(true)
    state = advanceHemodynamicSimulation(state, catheterTransitionDurationSeconds('rv', 'pa') + 0.1)
    expect(state.catheter.position).toBe('pa')
    expect(state.catheter.targetPosition).toBeNull()
    expect(state.catheter.floatBalloonInflated).toBe(false)

    state = icuHemodynamicsReducer(state, { type: 'RETRACT_CATHETER' })
    expect(state.catheter.position).toBe('pa')
    expect(state.catheter.targetPosition).toBe('rv')
    expect(state.catheter.floatBalloonInflated).toBe(false)
    state = advanceHemodynamicSimulation(state, catheterTransitionDurationSeconds('pa', 'rv') + 0.1)
    expect(state.catheter.position).toBe('rv')
    expect(state.catheter.targetPosition).toBeNull()
    expect(state.catheter.floatBalloonInflated).toBe(false)
  })

  it('clears an unstored wedge cursor when the balloon is deflated', () => {
    let state = createInitialHemodynamicState(definition, 'learn', 15)
    state = icuHemodynamicsReducer(state, { type: 'START_WEDGE' })
    state = advanceHemodynamicSimulation(
      state,
      wedgeCaptureDelaySeconds(state.parameters.respiratoryRateBpm) + 0.1,
    )
    state = icuHemodynamicsReducer(state, { type: 'PLACE_WEDGE_CURSOR' })
    expect(state.catheter.wedgeCursorTime).not.toBeNull()

    state = icuHemodynamicsReducer(state, { type: 'DEFLATE_WEDGE' })
    expect(state.catheter.position).toBe('pa')
    expect(state.catheter.wedgeCursorTime).toBeNull()
    expect(state.catheter.wedgeCaptureReady).toBe(false)
    const afterIgnoredStore = icuHemodynamicsReducer(state, { type: 'STORE_WEDGE' })
    expect(afterIgnoredStore.catheter.storedWedgeMmHg).toBeNull()
  })

  it('cancels pending movement when a case intervention restores PA position', () => {
    const catheterCase = hemodynamicCases.find((candidate) =>
      candidate.interventions.some((intervention) => intervention.id === 'reposition-catheter'),
    )
    expect(catheterCase).toBeDefined()
    const reposition = catheterCase!.interventions.find(
      (intervention) => intervention.id === 'reposition-catheter',
    )!
    let state = createInitialHemodynamicState(catheterCase!, 'learn', 16)
    state = icuHemodynamicsReducer(state, { type: 'SET_CATHETER_POSITION', position: 'pa' })
    state = icuHemodynamicsReducer(state, { type: 'RETRACT_CATHETER' })
    expect(state.catheter.targetPosition).toBe('rv')

    state = icuHemodynamicsReducer(state, {
      type: 'APPLY_INTERVENTION',
      intervention: reposition,
    })
    expect(state.catheter.position).toBe('pa')
    expect(state.catheter.targetPosition).toBeNull()
    expect(state.catheter.movementCompletesAt).toBeNull()
    expect(state.catheter.floatBalloonInflated).toBe(false)

    state = advanceHemodynamicSimulation(state, 3)
    expect(state.catheter.position).toBe('pa')
    expect(state.catheter.targetPosition).toBeNull()
  })

  it('uses the 2023 Edwards labeling for transient balloon occlusion', () => {
    const source = hemodynamicsSourceById.get('edwards-swan-ganz-ifu-2023')
    expect(source?.year).toBe(2023)
    expect(source?.intendedUse).toMatch(/transient balloon occlusion/i)
    expect(source?.intendedUse).not.toMatch(/distal (wedge|target|position)/i)
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
