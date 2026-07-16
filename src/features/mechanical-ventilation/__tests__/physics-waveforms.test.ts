import {
  mechanicalVentilationCaseById,
  mechanicalVentilationCases,
  ventilatorDeviceProfiles,
} from '../content'
import {
  advanceSimulation,
  createInitialSimulationState,
  deriveMechanicalInspiratoryTime,
  equationOfMotionPressure,
  MAX_WAVEFORM_SAMPLES,
  passiveExpiratoryFlowLps,
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
    const lowTarget = ventilationSimulationReducer(vcPlus, {
      type: 'SET_CONTROL',
      control: 'targetVtMl',
      value: 300,
    })
    const highTarget = ventilationSimulationReducer(vcPlus, {
      type: 'SET_CONTROL',
      control: 'targetVtMl',
      value: 700,
    })
    expect(lowTarget.measurements.exhaledVtMl).toBeCloseTo(300, 0)
    expect(highTarget.measurements.exhaledVtMl).toBeCloseTo(700, 0)

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
    expect(aprv.measurements.peakPressureCmH2O).toBeCloseTo(28, 0)

    let pav = createInitialSimulationState('MV-11', 'learn', 1, 'puritan-bennett-980')
    pav = ventilationSimulationReducer(pav, { type: 'SELECT_MODE', mode: 'proportional-assist' })
    pav = ventilationSimulationReducer(pav, { type: 'CONFIRM_MODE' })
    const lowPav = ventilationSimulationReducer(pav, {
      type: 'SET_CONTROL',
      control: 'proportionalSupportPercent',
      value: 20,
    })
    const highPav = ventilationSimulationReducer(pav, {
      type: 'SET_CONTROL',
      control: 'proportionalSupportPercent',
      value: 80,
    })
    expect(highPav.measurements.exhaledVtMl).toBeGreaterThan(lowPav.measurements.exhaledVtMl)

    let asv = createInitialSimulationState('MV-01', 'learn', 1, 'hamilton-c6')
    asv = ventilationSimulationReducer(asv, { type: 'SELECT_MODE', mode: 'asv' })
    asv = ventilationSimulationReducer(asv, { type: 'CONFIRM_MODE' })
    const lowMinVol = ventilationSimulationReducer(asv, {
      type: 'SET_CONTROL',
      control: 'minuteVolumePercent',
      value: 50,
    })
    const highMinVol = ventilationSimulationReducer(asv, {
      type: 'SET_CONTROL',
      control: 'minuteVolumePercent',
      value: 150,
    })
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
})
