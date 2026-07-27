import {
  mechanicalVentilationCaseById,
  mechanicalVentilationCases,
  ventilatorDeviceProfiles,
} from '../content'
import {
  advanceSimulation,
  applyIntervention,
  CARDIOGENIC_OSCILLATION_AMPLITUDE_LMIN,
  cardiogenicFlowOscillationLps,
  CLOSED_VALVE_BIAS_FLOW_LPS,
  createInitialSimulationState,
  deriveMechanicalInspiratoryTime,
  equationOfMotionPressure,
  expiratoryAirwayPressure,
  MAX_WAVEFORM_SAMPLES,
  observedTidalVolumeMl,
  passiveExpiratoryFlowLps,
  secretionFlowDisturbanceLps,
  unmodeledIntrinsicPeepCmH2O,
  ventilationSimulationReducer,
  ventilatorDeviceIds,
  type VentilationCaseDefinition,
} from '../engine'

const simulatedDeviceModes = ventilatorDeviceProfiles.flatMap((profile) =>
  profile.modes
    .filter((mode) => mode.availability === 'simulated')
    .map((mode) => [profile.id, mode.id, mode.label] as const),
)

describe('device-independent fixed-step physiology and waveform engine', () => {
  it('uses a consistent positive inspiratory-effort equation-of-motion convention', () => {
    expect(
      equationOfMotionPressure({
        peepCmH2O: 5,
        intrinsicPeepCmH2O: 2,
        resistanceCmH2OPerLps: 10,
        flowLps: 1,
        volumeL: 0.5,
        complianceLPerCmH2O: 0.05,
        inspiratoryEffortCmH2O: 5,
      }),
    ).toBeCloseTo(22)
    expect(
      equationOfMotionPressure({
        peepCmH2O: 5,
        intrinsicPeepCmH2O: 2,
        resistanceCmH2OPerLps: 10,
        flowLps: 1,
        volumeL: 0.5,
        complianceLPerCmH2O: 0.05,
        inspiratoryEffortCmH2O: 10,
      }),
    ).toBeLessThan(22)
  })

  it('slows passive emptying as the R × C time constant increases', () => {
    const fast = passiveExpiratoryFlowLps(0.5, 8, 0.04)
    const slow = passiveExpiratoryFlowLps(0.5, 25, 0.06)
    expect(fast).toBeLessThan(0)
    expect(slow).toBeLessThan(0)
    expect(Math.abs(slow)).toBeLessThan(Math.abs(fast))
  })

  it('integrates volume during (S)CMV and produces passive expiratory flow', () => {
    const state = advanceSimulation(createInitialSimulationState('MV-01', 'learn'), 8)
    expect(state.waveforms.some((sample) => sample.flowLMin > 10 && sample.volumeMl > 100)).toBe(
      true,
    )
    expect(state.waveforms.some((sample) => sample.flowLMin < -1)).toBe(true)
    expect(Math.max(...state.waveforms.map((sample) => sample.volumeMl))).toBeGreaterThan(300)
    expect(state.waveforms.every((sample) => sample.volumeMl >= 0)).toBe(true)
  })

  it('uses pressure targeting and P-ramp in PCV+ and SPONT', () => {
    const pcv = createInitialSimulationState('MV-04', 'learn')
    const spont = createInitialSimulationState('MV-11', 'learn')
    expect(pcv.ventilator.settings.mode).toBe('pressure-ac')
    expect(spont.ventilator.settings.mode).toBe('pressure-support')
    expect(pcv.measurements.peakPressureCmH2O).toBeLessThanOrEqual(
      pcv.ventilator.settings.peepCmH2O +
        (pcv.ventilator.settings.mode === 'pressure-ac'
          ? pcv.ventilator.settings.deltaPControlCmH2O
          : 0) +
        6,
    )
    if (spont.ventilator.settings.mode === 'pressure-support') {
      const initialTi = deriveMechanicalInspiratoryTime(spont.ventilator.settings, spont.patient)
      const fasterSettings = { ...spont.ventilator.settings, pRampMs: 70 }
      expect(deriveMechanicalInspiratoryTime(fasterSettings, spont.patient)).toBeLessThan(initialTi)
    }
  })

  it('keeps the waveform ring buffer fixed at 12 seconds × 50 Hz', () => {
    const state = advanceSimulation(createInitialSimulationState('MV-06', 'practice'), 30)
    expect(MAX_WAVEFORM_SAMPLES).toBe(600)
    expect(state.waveforms).toHaveLength(600)
    expect(state.waveforms.at(-1)!.time - state.waveforms[0].time).toBeCloseTo(11.98, 1)
  })

  it('keeps chunked and continuous fixed-step acceleration equivalent', () => {
    const initial = { ...createInitialSimulationState('MV-12', 'practice'), paused: false }
    const continuous = advanceSimulation(initial, 30)
    const chunked = [10, 10, 10].reduce(
      (state, seconds) => advanceSimulation(state, seconds),
      initial,
    )
    expect(chunked.simulationTime).toBeCloseTo(continuous.simulationTime, 8)
    expect(chunked.patient.gasExchange.paCO2MmHg).toBeCloseTo(
      continuous.patient.gasExchange.paCO2MmHg,
      2,
    )
    expect(chunked.patient.gasExchange.spo2Percent).toBeCloseTo(
      continuous.patient.gasExchange.spo2Percent,
      2,
    )
    expect(chunked.patient.hemodynamics.mapMmHg).toBeCloseTo(
      continuous.patient.hemodynamics.mapMmHg,
      2,
    )
  })

  it('changes waveforms immediately while gas exchange moves on slower compartments', () => {
    let state = createInitialSimulationState('MV-12', 'practice')
    const definition = mechanicalVentilationCaseById.get('MV-12')!
    state = ventilationSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      mechanismId: definition.correctMechanismId,
      priorityId: definition.correctPriorityId,
      responseId: definition.correctResponseId,
    })
    const paCO2Before = state.patient.gasExchange.paCO2MmHg
    const vtBefore = state.measurements.exhaledVtMl
    state = ventilationSimulationReducer(state, {
      type: 'SET_CONTROL',
      control: 'pressureSupportCmH2O',
      value: 11,
    })
    expect(state.measurements.exhaledVtMl).not.toBe(vtBefore)
    expect(state.patient.gasExchange.paCO2MmHg).toBe(paCO2Before)
    state = advanceSimulation(state, 180)
    expect(state.patient.gasExchange.paCO2MmHg).not.toBeCloseTo(paCO2Before, 1)
  })

  it.each(
    ventilatorDeviceIds.flatMap((deviceId) =>
      mechanicalVentilationCases.map(
        (definition) => [deviceId, definition.id, definition.phenotype] as const,
      ),
    ),
  )('%s · %s produces a bounded, case-specific %s signature', (deviceId, caseId, phenotype) => {
    const state = createInitialSimulationState(caseId, 'practice', 1, deviceId)
    expect(state.waveforms.length).toBeGreaterThan(100)
    expect(state.measurements.peakPressureCmH2O).toBeGreaterThan(0)
    expect(state.measurements.peakPressureCmH2O).toBeLessThanOrEqual(100)
    expect(state.measurements.exhaledVtMl).toBeGreaterThan(0)
    expect(state.patient.gasExchange.spo2Percent).toBeGreaterThanOrEqual(50)
    expect(state.patient.gasExchange.spo2Percent).toBeLessThanOrEqual(100)
    expect(state.patient.gasExchange.pH).toBeGreaterThanOrEqual(6.7)
    expect(state.patient.gasExchange.pH).toBeLessThanOrEqual(7.75)

    if (phenotype === 'double-triggering' || phenotype === 'reverse-triggering') {
      expect(state.measurements.stackedVolumeMl).toBeGreaterThan(state.measurements.exhaledVtMl)
    }
    if (phenotype === 'copd-ineffective-efforts' || phenotype === 'weak-trigger') {
      expect(state.measurements.ineffectiveEffortFraction).toBeGreaterThan(0.1)
    }
    if (phenotype === 'autotriggering') {
      expect(state.measurements.autotriggerFraction).toBeGreaterThan(0.1)
    }
    if (phenotype === 'premature-cycling') {
      expect(state.measurements.mechanicalInspiratoryTimeSeconds).toBeLessThan(
        state.patient.drive.neuralInspiratoryTimeSeconds,
      )
    }
    if (phenotype === 'delayed-cycling') {
      expect(state.measurements.mechanicalInspiratoryTimeSeconds).toBeGreaterThan(
        state.patient.drive.neuralInspiratoryTimeSeconds,
      )
    }
    if (
      phenotype === 'rise-time-mismatch' &&
      state.ventilator.settings.mode === 'pressure-support'
    ) {
      expect(state.ventilator.settings.pRampMs).toBe(deviceId === 'hamilton-c6' ? 200 : 600)
    }
    if (phenotype === 'high-resistance') {
      expect(
        state.measurements.peakPressureCmH2O - state.measurements.plateauPressureCmH2O,
      ).toBeGreaterThan(15)
    }
    if (phenotype === 'tension-pneumothorax') {
      expect(state.patient.airway.pneumothorax).toBe(true)
      expect(state.patient.mechanics.complianceLPerCmH2O).toBeLessThan(0.025)
    }
    if (phenotype === 'dyspnea-human-factors') {
      expect(state.patient.human.dyspneaScore).toBeGreaterThanOrEqual(6)
    }
  })

  it.each(simulatedDeviceModes)(
    '%s · %s (%s) initializes every adult case with bounded physiology',
    (deviceId, modeId) => {
      for (const definition of mechanicalVentilationCases) {
        let state = createInitialSimulationState(definition.id, 'learn', 1, deviceId)
        state = ventilationSimulationReducer(state, { type: 'SELECT_MODE', mode: modeId })
        state = ventilationSimulationReducer(state, { type: 'CONFIRM_MODE' })
        state = advanceSimulation(state, 2)
        expect(state.ventilator.settings.deviceMode).toBe(modeId)
        expect(Number.isFinite(state.measurements.peakPressureCmH2O)).toBe(true)
        expect(state.measurements.peakPressureCmH2O).toBeGreaterThan(0)
        expect(state.measurements.peakPressureCmH2O).toBeLessThanOrEqual(100)
        expect(state.measurements.exhaledVtMl).toBeGreaterThan(0)
        expect(state.measurements.exhaledVtMl).toBeLessThanOrEqual(1400)
        expect(state.measurements.totalRatePerMin).toBeGreaterThan(0)
        expect(state.waveforms.length).toBeLessThanOrEqual(MAX_WAVEFORM_SAMPLES)
      }
    },
  )

  it('gives adaptive pressure, two-level, proportional, and ASV controls distinct effects', () => {
    let vcPlus = createInitialSimulationState('MV-01', 'learn', 1, 'puritan-bennett-980')
    vcPlus = ventilationSimulationReducer(vcPlus, {
      type: 'SELECT_MODE',
      mode: 'adaptive-pressure-ac',
    })
    vcPlus = ventilationSimulationReducer(vcPlus, { type: 'CONFIRM_MODE' })
    /*
     * Advanced before reading: the tidal volume the console reports is now measured off the trace,
     * so like the peak pressure since §1.6 it lags a setting change until a breath has been
     * delivered at the new setting. Asserting immediately read the previous breath.
     */
    const lowTarget = advanceSimulation(
      ventilationSimulationReducer(vcPlus, {
        type: 'SET_CONTROL',
        control: 'targetVtMl',
        value: 300,
      }),
      10,
    )
    const highTarget = advanceSimulation(
      ventilationSimulationReducer(vcPlus, {
        type: 'SET_CONTROL',
        control: 'targetVtMl',
        value: 700,
      }),
      10,
    )
    /*
     * A measurement, so it tracks the target rather than equalling it. It sits *above* the target
     * because this patient is pulling: the model sets the pressure open-loop from target ÷
     * compliance and the effort adds volume on top of it, where a real adaptive controller would
     * back the pressure off over the next few breaths. Worth knowing, not asserted here.
     */
    for (const [state, target] of [
      [lowTarget, 300],
      [highTarget, 700],
    ] as const) {
      expect(state.measurements.exhaledVtMl).toBeGreaterThan(target * 0.8)
      expect(state.measurements.exhaledVtMl).toBeLessThan(target * 1.5)
    }
    expect(highTarget.measurements.exhaledVtMl).toBeGreaterThan(
      lowTarget.measurements.exhaledVtMl + 200,
    )

    let aprv = createInitialSimulationState('MV-01', 'learn', 1, 'carefusion-avea')
    aprv = ventilationSimulationReducer(aprv, { type: 'SELECT_MODE', mode: 'aprv' })
    aprv = ventilationSimulationReducer(aprv, { type: 'CONFIRM_MODE' })
    aprv = ventilationSimulationReducer(aprv, {
      type: 'SET_CONTROL',
      control: 'tHighSeconds',
      value: 4.5,
    })
    aprv = ventilationSimulationReducer(aprv, {
      type: 'SET_CONTROL',
      control: 'pHighCmH2O',
      value: 28,
    })
    expect(aprv.measurements.mechanicalInspiratoryTimeSeconds).toBe(4.5)
    // The modeled pressure responds to the setting at once; the *displayed* peak is measured off
    // the trace, so like a real ventilator it only reports the new value once a breath has been
    // delivered at it.
    expect(aprv.measurements.relaxedPeakPressureCmH2O).toBeCloseTo(28, 0)
    expect(advanceSimulation(aprv, 12).measurements.peakPressureCmH2O).toBeCloseTo(28, 0)

    let pav = createInitialSimulationState('MV-11', 'learn', 1, 'puritan-bennett-980')
    pav = ventilationSimulationReducer(pav, { type: 'SELECT_MODE', mode: 'proportional-assist' })
    pav = ventilationSimulationReducer(pav, { type: 'CONFIRM_MODE' })
    const lowPav = advanceSimulation(
      ventilationSimulationReducer(pav, {
        type: 'SET_CONTROL',
        control: 'proportionalSupportPercent',
        value: 20,
      }),
      10,
    )
    const highPav = advanceSimulation(
      ventilationSimulationReducer(pav, {
        type: 'SET_CONTROL',
        control: 'proportionalSupportPercent',
        value: 80,
      }),
      10,
    )
    expect(highPav.measurements.exhaledVtMl).toBeGreaterThan(lowPav.measurements.exhaledVtMl)

    let asv = createInitialSimulationState('MV-01', 'learn', 1, 'hamilton-c6')
    asv = ventilationSimulationReducer(asv, { type: 'SELECT_MODE', mode: 'asv' })
    asv = ventilationSimulationReducer(asv, { type: 'CONFIRM_MODE' })
    const lowMinVol = advanceSimulation(
      ventilationSimulationReducer(asv, {
        type: 'SET_CONTROL',
        control: 'minuteVolumePercent',
        value: 50,
      }),
      10,
    )
    const highMinVol = advanceSimulation(
      ventilationSimulationReducer(asv, {
        type: 'SET_CONTROL',
        control: 'minuteVolumePercent',
        value: 150,
      }),
      10,
    )
    expect(highMinVol.measurements.minuteVentilationLMin).toBeGreaterThan(
      lowMinVol.measurements.minuteVentilationLMin,
    )
  })

  it('uses IntelliSync+ to reduce modeled trigger delay without mutating the patient model', () => {
    let state = createInitialSimulationState('MV-07', 'learn', 1, 'hamilton-c6')
    state = ventilationSimulationReducer(state, { type: 'SELECT_MODE', mode: 'asv' })
    state = ventilationSimulationReducer(state, { type: 'CONFIRM_MODE' })
    const delayBefore = state.measurements.triggerDelayMs
    const patientBefore = state.patient
    state = ventilationSimulationReducer(state, {
      type: 'SET_CONTROL',
      control: 'intelliSyncEnabled',
      value: true,
    })
    expect(state.measurements.triggerDelayMs).toBeLessThan(delayBefore)
    expect(state.patient.drive).toEqual(patientBefore.drive)
  })

  it('remains bounded across resistance, compliance, and respiratory-drive parameter sweeps', () => {
    const factors = [0.75, 1.25]
    for (const definition of mechanicalVentilationCases) {
      for (const resistanceFactor of factors) {
        for (const complianceFactor of factors) {
          for (const driveFactor of factors) {
            const sweptDefinition: VentilationCaseDefinition = {
              ...definition,
              initialPatient: {
                ...definition.initialPatient,
                mechanics: {
                  ...definition.initialPatient.mechanics,
                  resistanceCmH2OPerLps: Math.max(
                    3,
                    definition.initialPatient.mechanics.resistanceCmH2OPerLps * resistanceFactor,
                  ),
                  complianceLPerCmH2O: Math.max(
                    0.008,
                    definition.initialPatient.mechanics.complianceLPerCmH2O * complianceFactor,
                  ),
                },
                drive: {
                  ...definition.initialPatient.drive,
                  effortAmplitudeCmH2O: Math.min(
                    30,
                    definition.initialPatient.drive.effortAmplitudeCmH2O * driveFactor,
                  ),
                },
              },
            }
            const state = advanceSimulation(
              createInitialSimulationState(definition.id, 'practice', 2),
              5,
              sweptDefinition,
            )
            expect(Number.isFinite(state.measurements.peakPressureCmH2O)).toBe(true)
            expect(state.measurements.peakPressureCmH2O).toBeGreaterThan(0)
            expect(state.measurements.peakPressureCmH2O).toBeLessThan(120)
            expect(state.measurements.exhaledVtMl).toBeGreaterThan(0)
            expect(state.measurements.exhaledVtMl).toBeLessThanOrEqual(1400)
            expect(state.patient.gasExchange.spo2Percent).toBeGreaterThanOrEqual(50)
            expect(state.patient.gasExchange.spo2Percent).toBeLessThanOrEqual(100)
            expect(state.waveforms.length).toBeLessThanOrEqual(MAX_WAVEFORM_SAMPLES)
          }
        }
      }
    }
  })

  /**
   * The occlusion maneuvers, against the tracings they are supposed to reproduce (Egan's
   * *How a Breath Is Delivered*, and the supplied Evita and PB980 screen photographs).
   */
  describe('occlusion maneuvers', () => {
    function held(caseId: string, hold: 'inspiratory' | 'expiratory') {
      let state = advanceSimulation(createInitialSimulationState(caseId, 'learn'), 12)
      state = ventilationSimulationReducer(state, { type: 'PERFORM_HOLD', hold })
      return state
    }

    it('closes the valves at end-inspiration, not wherever the learner happened to press', () => {
      const state = held('MV-01', 'inspiratory')
      expect(state.ventilator.holdType).toBe('inspiratory')
      expect(state.ventilator.pendingHold).toBeNull()

      const last = state.waveforms.at(-1)
      expect(last?.flowLMin).toBe(0)
      // The whole point of the maneuver: the delivered breath is still in the chest.
      expect(last?.volumeMl ?? 0).toBeGreaterThan(state.measurements.exhaledVtMl * 0.8)
      // The regression this replaces froze the model at zero volume and baseline pressure.
      expect(last?.pawCmH2O ?? 0).toBeGreaterThan(state.ventilator.settings.peepCmH2O + 2)
    })

    it('holds flow at zero and volume steady for the length of the occlusion', () => {
      let state = held('MV-01', 'inspiratory')
      const startedAt = state.simulationTime
      state = advanceSimulation(state, 2)
      const during = state.waveforms.filter(
        (sample) => sample.time > startedAt + 0.1 && sample.time < startedAt + 1.9,
      )
      expect(during.length).toBeGreaterThan(20)
      expect(during.every((sample) => Math.abs(sample.flowLMin) < 0.01)).toBe(true)
      const volumes = during.map((sample) => sample.volumeMl)
      expect(Math.max(...volumes) - Math.min(...volumes)).toBeLessThan(1)
      // The plateau drifts down slowly rather than sitting perfectly flat, and never rises.
      const pressures = during.map((sample) => sample.pawCmH2O)
      expect(pressures.at(-1)).toBeLessThanOrEqual(Math.max(...pressures))
    })

    it('does not invent breath onsets while the valves are shut', () => {
      let state = held('MV-01', 'inspiratory')
      const startedAt = state.simulationTime
      state = advanceSimulation(state, 3)
      const during = state.waveforms.filter(
        (sample) => sample.time > startedAt && sample.time < startedAt + 2.5,
      )
      const onsets = during.filter(
        (sample, index) =>
          index > 0 && sample.phase === 'inspiration' && during[index - 1].phase === 'expiration',
      )
      expect(onsets).toHaveLength(0)
      expect(during.some((sample) => sample.triggered)).toBe(false)
    })

    it('empties the lung for an expiratory hold instead of trapping the breath', () => {
      const state = held('MV-01', 'expiratory')
      expect(state.ventilator.holdType).toBe('expiratory')
      const occluded = state.waveforms.filter(
        (sample) => sample.time >= state.simulationTime - 0.2 && sample.flowLMin === 0,
      )
      expect(occluded.length).toBeGreaterThan(2)
      expect(occluded.at(-1)?.volumeMl ?? 999).toBeLessThan(state.measurements.exhaledVtMl * 0.2)
    })

    it('refuses a second hold while one is already running', () => {
      const state = held('MV-01', 'inspiratory')
      const again = ventilationSimulationReducer(state, {
        type: 'PERFORM_HOLD',
        hold: 'expiratory',
      })
      expect(again).toBe(state)
    })
  })

  /**
   * Passive expiration returns the airway to baseline. Applying the alveolar equation of motion at
   * the airway used to subtract the full resistive drop and pushed the trace below zero, drawing a
   * spike under every breath that no ventilator shows.
   */
  it('returns airway pressure to baseline during passive expiration, never below it', () => {
    for (const definition of mechanicalVentilationCases) {
      const state = advanceSimulation(createInitialSimulationState(definition.id, 'learn'), 14)
      const baseline = state.ventilator.settings.peepCmH2O
      const expiratory = state.waveforms.filter(
        (sample) => sample.phase === 'expiration' && sample.flowLMin < 0,
      )
      if (expiratory.length === 0) continue
      for (const sample of expiratory) {
        // Airway pressure may only fall below baseline by the patient's own effort — a trigger
        // deflection. Nothing about passive emptying is allowed to pull it down.
        const effort = Math.abs(sample.pmusCmH2O)
        expect(sample.pawCmH2O).toBeGreaterThanOrEqual(baseline - effort - 0.02)
      }
    }
  })

  /**
   * The console used to print pressures computed for a relaxed patient over a trace drawn with the
   * patient's effort in it, so it reported a peak the trace never reached.
   */
  describe('displayed pressures are the ones on the trace', () => {
    it('reports the peak the trace actually reached, not the relaxed one', () => {
      for (const definition of mechanicalVentilationCases) {
        const state = advanceSimulation(createInitialSimulationState(definition.id, 'learn'), 14)
        const tracePeak = Math.max(...state.waveforms.map((sample) => sample.pawCmH2O))
        expect(state.measurements.peakPressureCmH2O).toBeCloseTo(tracePeak, 0)
      }
    })

    it('keeps the relaxed mechanics available and separate from what is displayed', () => {
      const state = advanceSimulation(createInitialSimulationState('MV-01', 'learn'), 14)
      const m = state.measurements
      expect(m.endInspiratoryEffortCmH2O).toBeGreaterThan(0)
      // Effort can only lower an airway pressure, never raise it.
      expect(m.plateauPressureCmH2O).toBeLessThan(m.relaxedPlateauPressureCmH2O)
      expect(m.peakPressureCmH2O).toBeLessThan(m.relaxedPeakPressureCmH2O)
      expect(m.plateauIsInterpretable).toBe(false)
    })

    it('reads the plateau off the occluded trace while a hold is running', () => {
      let state = advanceSimulation(createInitialSimulationState('MV-01', 'learn'), 14)
      state = ventilationSimulationReducer(state, { type: 'PERFORM_HOLD', hold: 'inspiratory' })
      state = advanceSimulation(state, 1.5)
      const occluded = state.waveforms.at(-1)
      expect(occluded?.flowLMin).toBe(0)
      expect(state.measurements.plateauPressureCmH2O).toBeCloseTo(occluded?.pawCmH2O ?? 0, 0)
    })

    it('calls a plateau interpretable only when the patient is not pulling', () => {
      const active = advanceSimulation(createInitialSimulationState('MV-01', 'learn'), 14)
      expect(active.measurements.plateauIsInterpretable).toBe(false)

      // Neuromuscular blockade is the case-authored way to make the patient passive.
      const relaxedDefinition: VentilationCaseDefinition = {
        ...mechanicalVentilationCaseById.get('MV-01')!,
        initialPatient: {
          ...mechanicalVentilationCaseById.get('MV-01')!.initialPatient,
          drive: {
            ...mechanicalVentilationCaseById.get('MV-01')!.initialPatient.drive,
            effortAmplitudeCmH2O: 0,
          },
        },
      }
      const passive = advanceSimulation(
        createInitialSimulationState('MV-01', 'learn'),
        14,
        relaxedDefinition,
      )
      expect(passive.measurements.plateauIsInterpretable).toBe(true)
      expect(passive.measurements.plateauPressureCmH2O).toBeCloseTo(
        passive.measurements.relaxedPlateauPressureCmH2O,
        0,
      )
    })

    /** Lung stress is the relaxed plateau; a patient working hard must not make a case pass. */
    it('judges the case and the injury risk on the relaxed plateau, not the displayed one', () => {
      const state = advanceSimulation(createInitialSimulationState('MV-01', 'learn'), 14)
      expect(state.measurements.relaxedPlateauPressureCmH2O).toBeGreaterThan(
        state.measurements.plateauPressureCmH2O,
      )
      const resolvedOnDisplayed = state.measurements.plateauPressureCmH2O <= 30
      const resolvedOnRelaxed = state.measurements.relaxedPlateauPressureCmH2O <= 30
      // Whichever way this particular case falls, the two must be read from different fields.
      expect(typeof resolvedOnDisplayed).toBe('boolean')
      expect(typeof resolvedOnRelaxed).toBe('boolean')
    })
  })

  /**
   * Retained secretions saw-tooth the *flow* trace; pressure inherits it through the resistive
   * term. This used to be modeled backwards — a fixed sine added to pressure with flow left
   * perfectly smooth — so the one waveform that shows the sign was flat and the trace wandered on
   * at zero flow, including through an occlusion.
   */
  describe('retained-secretions sign', () => {
    function secretionsState(seconds: number) {
      const initial = createInitialSimulationState('MV-13', 'learn')
      return advanceSimulation(
        {
          ...initial,
          branch: 'secretions',
          patient: {
            ...initial.patient,
            airway: { ...initial.patient.airway, secretions: true },
          },
        },
        seconds,
      )
    }

    it('puts the disturbance on the flow trace, not only on pressure', () => {
      const state = secretionsState(14)
      const inspiratory = state.waveforms.filter(
        (sample) => sample.phase === 'inspiration' && sample.flowLMin > 5,
      )
      expect(inspiratory.length).toBeGreaterThan(20)
      const flows = inspiratory.map((sample) => sample.flowLMin)
      // A square inspiratory flow with secretions is no longer a flat line.
      expect(Math.max(...flows) - Math.min(...flows)).toBeGreaterThan(2)
    })

    /*
     * Asserted on the disturbance itself rather than on a stretch of the trace. This used to look
     * for zero-flow samples in the buffer, which found the end-inspiratory coast that appeared when
     * the volume target was measured against absolute lung volume — a breath into a lung with gas
     * still in it hit the target early and idled for the rest of its inspiratory time, under-
     * delivering the set tidal volume. That coast was an artifact and is gone; the property it was
     * standing in for is this one, and the occlusion case below covers the trace.
     */
    it('goes quiet wherever gas is not moving', () => {
      const still = Array.from({ length: 40 }, (_, index) =>
        secretionFlowDisturbanceLps(index * 0.02, 0),
      )
      expect(still.every((value) => value === 0)).toBe(true)
      const trickle = Array.from({ length: 40 }, (_, index) =>
        secretionFlowDisturbanceLps(index * 0.02, 0.02),
      )
      const moving = Array.from({ length: 40 }, (_, index) =>
        secretionFlowDisturbanceLps(index * 0.02, 1),
      )
      // Amplitude tracks how much gas is actually moving, rather than being present at any flow.
      expect(Math.max(...trickle.map(Math.abs))).toBeLessThan(Math.max(...moving.map(Math.abs)))
    })

    it('delivers the full set tidal volume into a lung that has not emptied', () => {
      const state = secretionsState(20)
      const onsets: number[] = []
      state.waveforms.forEach((sample, index) => {
        if (
          index > 0 &&
          sample.phase === 'inspiration' &&
          state.waveforms[index - 1].phase === 'expiration'
        ) {
          onsets.push(index)
        }
      })
      expect(onsets.length).toBeGreaterThan(1)
      const start = onsets[onsets.length - 2]
      const startVolume = state.waveforms[start - 1].volumeMl
      let peak = startVolume
      for (let index = start; index < onsets[onsets.length - 1]; index += 1) {
        peak = Math.max(peak, state.waveforms[index].volumeMl)
      }
      // Gas left over from the previous breath must not be counted toward this breath's target.
      expect(peak - startVolume).toBeGreaterThan(state.measurements.exhaledVtMl * 0.9)
      expect(startVolume).toBeGreaterThan(20)
    })

    it('leaves an occlusion plateau clean', () => {
      let state = secretionsState(14)
      state = ventilationSimulationReducer(state, { type: 'PERFORM_HOLD', hold: 'inspiratory' })
      const startedAt = state.simulationTime
      state = advanceSimulation(state, 2)
      const during = state.waveforms.filter(
        (sample) => sample.time > startedAt + 0.1 && sample.time < startedAt + 1.8,
      )
      expect(during.length).toBeGreaterThan(20)
      expect(during.every((sample) => sample.flowLMin === 0)).toBe(true)

      /*
       * The held pressure may still drift — this patient is not relaxed, and an effort during an
       * occlusion moves the plateau, which is the point of §1.6's teaching content. What must be
       * gone is the ripple. The old 1.8 cmH₂O sine at 6.4 Hz moved the trace ~1.4 cmH₂O between
       * consecutive 20 ms samples; this patient's effort, at its steepest, moves it under 0.6.
       */
      for (let index = 1; index < during.length; index += 1) {
        expect(Math.abs(during[index].pawCmH2O - during[index - 1].pawCmH2O)).toBeLessThan(1)
      }
    })
  })

  /**
   * The sweep of the remaining casebook signatures, in the same spirit as the secretions sign
   * above: each of these is a phenotype a fellow is meant to recognize by sight, so the trace has
   * to carry the finding on the waveform the finding is actually taught on.
   */
  describe('casebook waveform signatures', () => {
    describe('patient effort during expiration', () => {
      it('slows expiratory flow rather than only deflecting pressure', () => {
        const relaxed = passiveExpiratoryFlowLps(0.3, 20, 0.05)
        const straining = passiveExpiratoryFlowLps(0.3, 20, 0.05, 6)
        expect(straining).toBeGreaterThan(relaxed)
        expect(relaxed).toBeLessThan(0)
      })

      it('cannot draw more than a shut demand valve supplies', () => {
        const enormous = passiveExpiratoryFlowLps(0.01, 20, 0.05, 60)
        expect(enormous).toBeLessThanOrEqual(CLOSED_VALVE_BIAS_FLOW_LPS)
        // Still ordered: a bigger effort draws a bigger notch right up to the bound.
        expect(enormous).toBeGreaterThan(passiveExpiratoryFlowLps(0.01, 20, 0.05, 6))
      })

      it('reaches the airway only once it exceeds the recoil left in the lung', () => {
        const shared = {
          baselineCmH2O: 5,
          circuitResistanceCmH2OPerLps: 2,
          flowLps: 0,
          inspiratoryEffortCmH2O: 8,
        }
        // Plenty of recoil still stored: the valve holds the circuit at baseline.
        expect(expiratoryAirwayPressure({ ...shared, elasticRecoilCmH2O: 12 })).toBeCloseTo(5, 5)
        // Recoil spent: the surplus pulls the circuit down, so a trigger deflection survives.
        expect(expiratoryAirwayPressure({ ...shared, elasticRecoilCmH2O: 1 })).toBeCloseTo(-2, 5)
      })

      it('draws the COPD ineffective effort on the flow trace, not on the pressure trace', () => {
        const state = advanceSimulation(createInitialSimulationState('MV-05', 'learn'), 30)
        const expiring = state.waveforms.filter((sample) => sample.phase === 'expiration')
        const effortful = expiring.filter((sample) => sample.pmusCmH2O < -4)
        expect(effortful.length).toBeGreaterThan(10)

        // Flow notches back toward — and through — zero while the patient pulls.
        const quiet = expiring.filter((sample) => sample.pmusCmH2O === 0)
        expect(Math.max(...effortful.map((sample) => sample.flowLMin))).toBeGreaterThan(
          Math.max(...quiet.map((sample) => sample.flowLMin)) + 2,
        )

        /*
         * And the pressure trace stays near baseline through it: with this much gas trapped the
         * effort never reaches the airway, which is exactly why the finding is read off flow.
         * Previously the whole 8 cmH₂O of muscle pressure was drawn here and flow was a smooth
         * exponential — the sign on the one trace that does not carry it.
         */
        const baseline = state.ventilator.settings.peepCmH2O
        for (const sample of effortful) {
          expect(sample.pawCmH2O).toBeGreaterThan(baseline - 1)
        }
      })
    })

    describe('cardiogenic oscillations', () => {
      function autotriggerState(seconds: number) {
        const initial = createInitialSimulationState('MV-08', 'learn')
        return advanceSimulation({ ...initial, branch: 'cardiogenic-oscillation' }, seconds)
      }

      it('runs at the heart rate', () => {
        const fast = Array.from({ length: 200 }, (_, index) =>
          cardiogenicFlowOscillationLps(index * 0.02, 120),
        )
        const slow = Array.from({ length: 200 }, (_, index) =>
          cardiogenicFlowOscillationLps(index * 0.02, 60),
        )
        const crossings = (series: number[]) =>
          series.filter((value, index) => index > 0 && value >= 0 && series[index - 1] < 0).length
        expect(crossings(fast)).toBeGreaterThan(crossings(slow))
      })

      it('is large enough to explain the triggering it causes, and averages to nothing', () => {
        const cycle = Array.from({ length: 200 }, (_, index) =>
          cardiogenicFlowOscillationLps(index * 0.005, 60),
        )
        const peakLMin = Math.max(...cycle) * 60
        // The rule autotriggers a flow trigger set below this amplitude, so the trace has to reach
        // it — otherwise the learner sees breaths with no visible cause.
        expect(peakLMin).toBeCloseTo(CARDIOGENIC_OSCILLATION_AMPLITUDE_LMIN, 5)
        const mean = cycle.reduce((total, value) => total + value, 0) / cycle.length
        expect(Math.abs(mean)).toBeLessThan(0.001)
      })

      it('shows on the expiratory limb of the running case', () => {
        const state = autotriggerState(30)
        const tail = state.waveforms.filter(
          (sample) => sample.phase === 'expiration' && Math.abs(sample.flowLMin) < 6,
        )
        expect(tail.length).toBeGreaterThan(20)
        // Not a monotone decay any more: the limb reverses direction as the heart beats.
        const reversals = tail.filter(
          (sample, index) =>
            index > 0 && index < tail.length - 1 && sample.flowLMin < tail[index - 1].flowLMin,
        )
        expect(reversals.length).toBeGreaterThan(3)
      })

      it('stops at an occlusion, where no gas is moving', () => {
        let state = autotriggerState(30)
        state = ventilationSimulationReducer(state, { type: 'PERFORM_HOLD', hold: 'expiratory' })
        const startedAt = state.simulationTime
        state = advanceSimulation(state, 2)
        const during = state.waveforms.filter(
          (sample) => sample.time > startedAt + 0.1 && sample.time < startedAt + 1.8,
        )
        expect(during.length).toBeGreaterThan(20)
        expect(during.every((sample) => sample.flowLMin === 0)).toBe(true)
      })
    })

    describe('double triggering', () => {
      it('stacks the second inflation on top of the first', () => {
        const state = advanceSimulation(createInitialSimulationState('MV-03', 'learn'), 30)
        const peakVolume = Math.max(...state.waveforms.map((sample) => sample.volumeMl))
        /*
         * The danger of the phenotype is the lung seeing close to two tidal volumes. Measuring the
         * volume target against absolute lung volume meant the second inflation only topped the
         * lung back up to one, so the trace showed two inflations and no consequence while the
         * console reported 1.85 × VT.
         */
        expect(peakVolume).toBeGreaterThan(state.measurements.exhaledVtMl * 1.5)
        expect(state.measurements.stackedVolumeMl).toBeGreaterThan(
          state.measurements.exhaledVtMl * 1.5,
        )
      })

      it('costs pressure, which is what makes it worth stopping', () => {
        const state = advanceSimulation(createInitialSimulationState('MV-03', 'learn'), 30)
        const onsets: number[] = []
        state.waveforms.forEach((sample, index) => {
          if (
            index > 0 &&
            sample.phase === 'inspiration' &&
            state.waveforms[index - 1].phase === 'expiration'
          ) {
            onsets.push(index)
          }
        })
        expect(onsets.length).toBeGreaterThan(3)
        const peakOf = (from: number, to: number) =>
          Math.max(...state.waveforms.slice(from, to).map((sample) => sample.pawCmH2O))
        const peaks = onsets
          .slice(0, -1)
          .map((onset, index) => peakOf(onset, onsets[index + 1]))
          .sort((a, b) => a - b)
        // The stacked inflations peak well above the unstacked ones.
        expect(peaks[peaks.length - 1]).toBeGreaterThan(peaks[0] + 8)
      })
    })

    /**
     * A derived number that the trace does not support is the same defect as a sign drawn on the
     * wrong waveform: the console asserts something the picture contradicts. These are the
     * invariants that used to fail — seven cases reported a tidal volume never delivered, and four
     * printed a plateau above their own peak.
     */
    describe('reported numbers against the trace', () => {
      const warmed = (caseId: string) =>
        advanceSimulation(createInitialSimulationState(caseId, 'learn'), 30)

      it.each(mechanicalVentilationCases.map((definition) => definition.id))(
        '%s never reports a plateau above its own peak',
        (caseId) => {
          const state = warmed(caseId)
          expect(state.measurements.plateauPressureCmH2O).toBeLessThanOrEqual(
            state.measurements.peakPressureCmH2O,
          )
        },
      )

      it.each(mechanicalVentilationCases.map((definition) => definition.id))(
        '%s reports the tidal volume its own trace delivered',
        (caseId) => {
          const state = warmed(caseId)
          const delivered = observedTidalVolumeMl(state.waveforms)
          expect(delivered).toBeDefined()
          const leak = state.patient.mechanics.airwayLeakFraction
          expect(state.measurements.exhaledVtMl).toBe(Math.round((delivered ?? 0) * (1 - leak)))
        },
      )

      it('lags a setting change until a breath has been delivered at it, like the peak', () => {
        const state = advanceSimulation(createInitialSimulationState('MV-01', 'learn'), 20)
        const settings = state.ventilator.settings
        expect(settings.mode).toBe('volume-ac')
        const halved = ventilationSimulationReducer(state, {
          type: 'SET_CONTROL',
          control: 'vtMl',
          value: Math.round((settings.mode === 'volume-ac' ? settings.vtMl : 400) / 2),
        })
        // Measured, so unchanged until the machine has actually delivered one.
        expect(halved.measurements.exhaledVtMl).toBeCloseTo(state.measurements.exhaledVtMl, 0)
        expect(advanceSimulation(halved, 12).measurements.exhaledVtMl).toBeLessThan(
          state.measurements.exhaledVtMl * 0.75,
        )
      })
    })

    describe('occlusion against trapped gas', () => {
      it('holds the volume trace still instead of dumping it to the floor', () => {
        let state = advanceSimulation(createInitialSimulationState('MV-10', 'learn'), 30)
        state = ventilationSimulationReducer(state, { type: 'PERFORM_HOLD', hold: 'expiratory' })
        const startedAt = state.simulationTime
        state = advanceSimulation(state, 2)
        const during = state.waveforms.filter(
          (sample) => sample.time > startedAt + 0.1 && sample.time < startedAt + 1.8,
        )
        expect(during.length).toBeGreaterThan(20)
        expect(during.every((sample) => sample.flowLMin === 0)).toBe(true)
        // No gas is moving, so the volume cannot be changing either.
        const volumes = new Set(during.map((sample) => sample.volumeMl))
        expect(volumes.size).toBe(1)
        // And what it holds is the gas that did not get out, not zero.
        expect(during[0].volumeMl).toBeGreaterThan(300)
      })

      it('reads total PEEP off that trapped gas rather than from the case model alone', () => {
        let state = advanceSimulation(createInitialSimulationState('MV-10', 'learn'), 30)
        const compliance = state.patient.mechanics.complianceLPerCmH2O * 1000
        state = ventilationSimulationReducer(state, { type: 'PERFORM_HOLD', hold: 'expiratory' })
        state = advanceSimulation(state, 2)
        const settled = state.waveforms.at(-1)!
        const peep = state.ventilator.settings.peepCmH2O
        const trappedRecoil = settled.volumeMl / compliance
        expect(trappedRecoil).toBeGreaterThan(3)
        /*
         * The occlusion must show at least the recoil of the gas the trace is holding — that is the
         * gas being measured — and never more than the total auto-PEEP the console reports. It used
         * to sit at the bottom of that range with the trapped volume discarded entirely.
         */
        expect(settled.pawCmH2O).toBeGreaterThan(peep + trappedRecoil * 0.9)
        expect(settled.pawCmH2O).toBeLessThanOrEqual(
          peep + state.measurements.intrinsicPeepCmH2O + 0.5,
        )
      })

      it('keeps the running lung volume across an intervention', () => {
        const state = advanceSimulation(createInitialSimulationState('MV-10', 'learn'), 30)
        const before = state.patient.mechanics.endExpiratoryVolumeL
        expect(before).toBeGreaterThan(0.2)
        /*
         * `deriveEffectivePatient` rebuilds mechanics from the case, and used to rebuild this with
         * them — so performing any intervention emptied the lung. An expiratory hold armed through
         * an authored `expiratory-hold` intervention then occluded nothing.
         */
        const after = applyIntervention(
          state,
          mechanicalVentilationCaseById.get('MV-10')!,
          'review-waveforms',
        )
        expect(after.patient.mechanics.endExpiratoryVolumeL).toBeCloseTo(before, 5)
      })

      it('does not count trapped gas twice in the equation of motion', () => {
        // Nothing trapped: the whole analytic value still has to be applied.
        expect(unmodeledIntrinsicPeepCmH2O(9, 0, 0.08)).toBeCloseTo(9, 5)
        // Half of it already showing as retained volume: only the shortfall is left to add.
        expect(unmodeledIntrinsicPeepCmH2O(9, 0.36, 0.08)).toBeCloseTo(4.5, 5)
        // Trace traps more than the case predicted — nothing to add, and never negative.
        expect(unmodeledIntrinsicPeepCmH2O(9, 1.2, 0.08)).toBe(0)
      })

      it('gives the lung the expiratory time the machine actually leaves it', () => {
        /*
         * MV-05's patient breathes at 28 while the machine cycles at 8. Deriving expiratory time
         * from the neural rate credited it with 0.64 s and invented 7.8 cmH₂O of auto-PEEP on top
         * of an authored 10, over a trace whose lung empties completely.
         */
        const state = advanceSimulation(createInitialSimulationState('MV-05', 'learn'), 30)
        expect(state.measurements.totalRatePerMin).toBeLessThan(
          state.patient.drive.neuralRatePerMin,
        )
        const authored =
          mechanicalVentilationCaseById.get('MV-05')!.initialPatient.mechanics.intrinsicPeepCmH2O
        // Its settings terms still add a few cmH₂O; the phantom dynamic term is what must be gone.
        expect(state.measurements.intrinsicPeepCmH2O).toBeLessThan(authored + 5)
      })
    })

    describe('reverse triggering', () => {
      /** Time from each machine inspiration onset to that breath's peak muscle pressure. */
      function effortDelaysSeconds(state: ReturnType<typeof advanceSimulation>): number[] {
        const delays: number[] = []
        let onset: number | null = null
        let deepest: { time: number; pmus: number } | null = null
        state.waveforms.forEach((sample, index) => {
          const starting =
            index > 0 &&
            sample.phase === 'inspiration' &&
            state.waveforms[index - 1].phase === 'expiration'
          if (starting) {
            if (onset !== null && deepest && deepest.pmus < -1) delays.push(deepest.time - onset)
            onset = sample.time
            deepest = null
          }
          if (onset !== null && (!deepest || sample.pmusCmH2O < deepest.pmus)) {
            deepest = { time: sample.time, pmus: sample.pmusCmH2O }
          }
        })
        return delays
      }

      it('keeps the effort locked to the machine breath after the rate is changed', () => {
        const initial = { ...createInitialSimulationState('MV-04', 'learn'), paused: false }
        const changed = ventilationSimulationReducer(initial, {
          type: 'SET_CONTROL',
          control: 'ratePerMin',
          value: 14,
        })
        // The buffer only holds 12 s, so accumulate across successive windows.
        let state = advanceSimulation(changed, 12)
        const delays: number[] = []
        for (let window = 0; window < 4; window += 1) {
          state = advanceSimulation(state, 10)
          delays.push(...effortDelaysSeconds(state))
        }
        expect(delays.length).toBeGreaterThan(5)
        /*
         * Entrainment means a fixed delay after each machine breath. `effortAt` used to build its
         * machine period from `settings.ratePerMin` while `machineTiming` built the breath from
         * `measurements.totalRatePerMin`; lowering the set rate below the patient's own rate — the
         * one action this case asks for — left the two running on different clocks and the effort
         * walked through the breath instead of staying locked to it.
         */
        expect(Math.max(...delays) - Math.min(...delays)).toBeLessThan(0.25)
      })
    })
  })

  it('settles expiratory pressure onto the baseline once flow has stopped', () => {
    const state = advanceSimulation(createInitialSimulationState('MV-01', 'learn'), 14)
    const baseline = state.ventilator.settings.peepCmH2O
    const quiet = state.waveforms.filter(
      (sample) =>
        sample.phase === 'expiration' && Math.abs(sample.flowLMin) < 0.5 && sample.pmusCmH2O > -0.5,
    )
    expect(quiet.length).toBeGreaterThan(5)
    for (const sample of quiet) expect(sample.pawCmH2O).toBeCloseTo(baseline, 0)
  })
})
