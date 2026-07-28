import { hemodynamicCases } from '../content'
import { createInitialHemodynamicState } from '../engine'
import {
  CARDIAC_PHASE,
  NORMAL_RIGHT_ATRIAL_AMPLITUDES,
  NORMAL_WEDGE_AMPLITUDES,
  PULMONARY_ARTERY_MEAN_FRACTION,
  PULMONARY_ARTERY_SHAPE,
  SYSTEMIC_ARTERIAL_MEAN_FRACTION,
  SYSTEMIC_ARTERIAL_SHAPE,
  ecgShapeMv,
  pulsatilePressureShape,
  rightAtrialAmplitudesFor,
  rightAtrialDeviationMmHg,
  ventricularPressureShape,
  wedgeAmplitudesFor,
  wedgeDeviationMmHg,
} from '../engine/waveformMorphology'

const SAMPLES = 2000

function sample(shape: (phase: number) => number): { phase: number; value: number }[] {
  return Array.from({ length: SAMPLES }, (_, index) => {
    const phase = index / SAMPLES
    return { phase, value: shape(phase) }
  })
}

function phaseOfMaximum(shape: (phase: number) => number, from: number, to: number): number {
  return sample(shape)
    .filter((point) => point.phase >= from && point.phase <= to)
    .reduce((best, point) => (point.value > best.value ? point : best)).phase
}

function phaseOfMinimum(shape: (phase: number) => number, from: number, to: number): number {
  return sample(shape)
    .filter((point) => point.phase >= from && point.phase <= to)
    .reduce((best, point) => (point.value < best.value ? point : best)).phase
}

function meanOfShape(shape: (phase: number) => number): number {
  const samples = sample(shape)
  return samples.reduce((total, point) => total + point.value, 0) / samples.length
}

describe('right atrial waveform morphology', () => {
  const trace = (phase: number) => rightAtrialDeviationMmHg(phase)

  it('inscribes a, c, and v waves above the mean with x and y descents below it', () => {
    expect(trace(CARDIAC_PHASE.atrialAWave)).toBeGreaterThan(0)
    expect(trace(CARDIAC_PHASE.atrialCWave)).toBeGreaterThan(0)
    expect(trace(CARDIAC_PHASE.atrialVWave)).toBeGreaterThan(0)
    expect(trace(CARDIAC_PHASE.atrialXDescent)).toBeLessThan(0)
    expect(trace(CARDIAC_PHASE.atrialYDescent)).toBeLessThan(0)
  })

  it('places the a wave after the P wave and the c wave after the QRS', () => {
    expect(CARDIAC_PHASE.atrialAWave).toBeGreaterThan(CARDIAC_PHASE.pWave)
    expect(CARDIAC_PHASE.atrialCWave).toBeGreaterThan(CARDIAC_PHASE.rWave)
    // The a wave is the local maximum of late diastole, not a descent.
    expect(phaseOfMaximum(trace, 0.85, 0.999)).toBeCloseTo(CARDIAC_PHASE.atrialAWave, 1)
  })

  it('peaks the v wave at the end of the T wave and follows it with the y descent', () => {
    expect(CARDIAC_PHASE.atrialVWave).toBeGreaterThan(CARDIAC_PHASE.tWavePeak)
    expect(phaseOfMaximum(trace, 0.35, 0.55)).toBeCloseTo(CARDIAC_PHASE.atrialVWave, 1)
    expect(phaseOfMinimum(trace, 0.5, 0.75)).toBeCloseTo(CARDIAC_PHASE.atrialYDescent, 1)
  })

  it('keeps the a wave taller than the v wave in a normal right atrium', () => {
    expect(NORMAL_RIGHT_ATRIAL_AMPLITUDES.aWaveMmHg).toBeGreaterThan(
      NORMAL_RIGHT_ATRIAL_AMPLITUDES.vWaveMmHg,
    )
    expect(trace(CARDIAC_PHASE.atrialAWave)).toBeGreaterThan(trace(CARDIAC_PHASE.atrialVWave))
  })

  it('centers the phasic waves on the displayed right atrial mean', () => {
    expect(meanOfShape(trace)).toBeCloseTo(0, 2)
  })
})

describe('wedge waveform morphology', () => {
  const trace = (phase: number) => wedgeDeviationMmHg(phase)

  it('has no c wave, because the transmitted wave is too damped to preserve it', () => {
    expect(NORMAL_WEDGE_AMPLITUDES.cWaveMmHg).toBe(0)
  })

  it('makes the v wave taller than the a wave, the reverse of the right atrium', () => {
    expect(NORMAL_WEDGE_AMPLITUDES.vWaveMmHg).toBeGreaterThan(NORMAL_WEDGE_AMPLITUDES.aWaveMmHg)
    expect(trace(CARDIAC_PHASE.wedgeVWave)).toBeGreaterThan(trace(CARDIAC_PHASE.wedgeAWave))
  })

  it('delays every wave relative to the directly measured right atrial tracing', () => {
    // Transmission back through the pulmonary bed delays the a wave from ~80 ms after the P
    // wave to ~240 ms, so it lands after the R wave rather than before it.
    expect(CARDIAC_PHASE.wedgeAWave).toBeGreaterThan(CARDIAC_PHASE.rWave)
    expect(CARDIAC_PHASE.wedgeVWave).toBeGreaterThan(CARDIAC_PHASE.atrialVWave)
    expect(CARDIAC_PHASE.wedgeYDescent).toBeGreaterThan(CARDIAC_PHASE.atrialYDescent)
  })

  it('peaks the v wave only after the T wave has been inscribed', () => {
    expect(CARDIAC_PHASE.wedgeVWave).toBeGreaterThan(CARDIAC_PHASE.tWaveEnd)
  })

  it('centers the transmitted waves on the displayed wedge mean', () => {
    expect(meanOfShape(trace)).toBeCloseTo(0, 2)
  })
})

describe('ventricular versus pulmonary artery diastolic contour', () => {
  it('rounds the right ventricular ejection contour instead of drawing a square plateau', () => {
    const peakSystole = ventricularPressureShape(0.16)
    const midEjection = ventricularPressureShape(0.3)
    const lateEjection = ventricularPressureShape(0.39)
    expect(peakSystole).toBeGreaterThan(midEjection)
    expect(midEjection).toBeGreaterThan(lateEjection)
    expect(peakSystole - lateEjection).toBeGreaterThan(0.35)
  })

  it('slopes right ventricular diastole upward as the ventricle fills', () => {
    const earlyDiastole = ventricularPressureShape(0.6)
    const midDiastole = ventricularPressureShape(0.78)
    const endDiastole = ventricularPressureShape(0.99)
    expect(midDiastole).toBeGreaterThan(earlyDiastole)
    expect(endDiastole).toBeGreaterThan(midDiastole)
  })

  it('slopes pulmonary artery diastole downward through runoff', () => {
    const earlyDiastole = pulsatilePressureShape(0.6, PULMONARY_ARTERY_SHAPE)
    const midDiastole = pulsatilePressureShape(0.78, PULMONARY_ARTERY_SHAPE)
    const endDiastole = pulsatilePressureShape(0.99, PULMONARY_ARTERY_SHAPE)
    expect(midDiastole).toBeLessThan(earlyDiastole)
    expect(endDiastole).toBeLessThan(midDiastole)
  })

  it('omits an end-diastolic a wave from a normally compliant ventricle', () => {
    const withoutAWave = ventricularPressureShape(CARDIAC_PHASE.atrialAWave)
    const withAWave = ventricularPressureShape(CARDIAC_PHASE.atrialAWave, {
      aWaveFraction: 0.14,
      endDiastolicFraction: 0.16,
    })
    expect(withAWave).toBeGreaterThan(withoutAWave)
  })
})

describe('dicrotic notch timing', () => {
  it('inscribes an aortic dicrotic notch followed by a dicrotic wave', () => {
    const notch = CARDIAC_PHASE.aorticDicroticNotch
    const atNotch = pulsatilePressureShape(notch + 0.014, SYSTEMIC_ARTERIAL_SHAPE)
    const afterNotch = pulsatilePressureShape(notch + 0.055, SYSTEMIC_ARTERIAL_SHAPE)
    expect(afterNotch).toBeGreaterThan(atNotch)
  })

  it('closes the pulmonic valve after the aortic valve', () => {
    expect(CARDIAC_PHASE.pulmonicDicroticNotch).toBeGreaterThan(CARDIAC_PHASE.aorticDicroticNotch)
  })

  it('peaks pulmonary artery pressure later than systemic arterial pressure', () => {
    expect(CARDIAC_PHASE.pulmonaryArteryPeak).toBeGreaterThan(CARDIAC_PHASE.arterialPeak)
    expect(
      phaseOfMaximum((phase) => pulsatilePressureShape(phase, PULMONARY_ARTERY_SHAPE), 0, 0.4),
    ).toBeCloseTo(CARDIAC_PHASE.pulmonaryArteryPeak, 1)
  })

  it('keeps temporal mean pressure near one-third of pulse pressure above diastole', () => {
    expect(SYSTEMIC_ARTERIAL_MEAN_FRACTION).toBeGreaterThan(0.3)
    expect(SYSTEMIC_ARTERIAL_MEAN_FRACTION).toBeLessThan(0.36)
    expect(PULMONARY_ARTERY_MEAN_FRACTION).toBeGreaterThan(0.3)
    expect(PULMONARY_ARTERY_MEAN_FRACTION).toBeLessThan(0.38)
  })
})

describe('pathologic wave amplitudes', () => {
  it('blunts the y descent under pericardial constraint while preserving the x descent', () => {
    const normal = rightAtrialAmplitudesFor({
      ventricularCompliance: 1,
      pericardialPressureMmHg: 0,
    })
    const tamponade = rightAtrialAmplitudesFor({
      ventricularCompliance: 1,
      pericardialPressureMmHg: 16,
    })
    expect(tamponade.yDescentMmHg).toBeLessThan(normal.yDescentMmHg * 0.4)
    expect(tamponade.xDescentMmHg).toBeGreaterThan(normal.xDescentMmHg)
  })

  it('obliterates the x descent and raises a tall cv wave in tricuspid regurgitation', () => {
    const severe = rightAtrialAmplitudesFor({
      ventricularCompliance: 1,
      pericardialPressureMmHg: 0,
      tricuspidRegurgitationSeverity: 1,
    })
    expect(severe.xDescentMmHg).toBeLessThan(NORMAL_RIGHT_ATRIAL_AMPLITUDES.xDescentMmHg * 0.1)
    expect(severe.vWaveMmHg).toBeGreaterThan(NORMAL_RIGHT_ATRIAL_AMPLITUDES.vWaveMmHg * 2)
  })

  it('enlarges the a wave when the right ventricle is poorly compliant', () => {
    const stiff = rightAtrialAmplitudesFor({
      ventricularCompliance: 0.5,
      pericardialPressureMmHg: 0,
    })
    expect(stiff.aWaveMmHg).toBeGreaterThan(NORMAL_RIGHT_ATRIAL_AMPLITUDES.aWaveMmHg)
  })

  it('produces a large wedge v wave when the left ventricle is poorly compliant', () => {
    const stiff = wedgeAmplitudesFor({
      leftVentricularCompliance: 0.5,
      pericardialPressureMmHg: 0,
    })
    expect(stiff.vWaveMmHg).toBeGreaterThan(NORMAL_WEDGE_AMPLITUDES.vWaveMmHg * 2)
    expect(stiff.vWaveMmHg).toBeGreaterThan(stiff.aWaveMmHg)
  })
})

describe('live engine waveforms carry the taught morphology', () => {
  const state = createInitialHemodynamicState(hemodynamicCases[0], 'learn', 417)
  const heartRate = state.measurements.heartRateBpm
  const cycleSeconds = 60 / heartRate

  /** Samples one steady-state beat from the live waveform buffer, keyed by cardiac phase. */
  function beatSamples(field: 'cvpMmHg' | 'rvMmHg' | 'papMmHg' | 'pcwpMmHg') {
    const lastBeatStart = Math.floor(state.timeSeconds / cycleSeconds - 1) * cycleSeconds
    return state.waveforms
      .filter(
        (sample) => sample.time >= lastBeatStart && sample.time < lastBeatStart + cycleSeconds,
      )
      .map((sample) => ({
        phase: (((sample.time % cycleSeconds) + cycleSeconds) % cycleSeconds) / cycleSeconds,
        value: sample[field],
      }))
  }

  function valueNearPhase(samples: { phase: number; value: number }[], phase: number): number {
    return samples.reduce((best, candidate) =>
      Math.abs(candidate.phase - phase) < Math.abs(best.phase - phase) ? candidate : best,
    ).value
  }

  it('produces a central venous trace with an a wave, not a descent, after the P wave', () => {
    const samples = beatSamples('cvpMmHg')
    expect(samples.length).toBeGreaterThan(10)
    const aWave = valueNearPhase(samples, CARDIAC_PHASE.atrialAWave)
    const xDescent = valueNearPhase(samples, CARDIAC_PHASE.atrialXDescent)
    const yDescent = valueNearPhase(samples, CARDIAC_PHASE.atrialYDescent)
    expect(aWave).toBeGreaterThan(xDescent)
    expect(aWave).toBeGreaterThan(yDescent)
  })

  it('slopes the live right ventricular diastole up and the pulmonary artery diastole down', () => {
    const rv = beatSamples('rvMmHg')
    expect(valueNearPhase(rv, 0.95)).toBeGreaterThan(valueNearPhase(rv, 0.6))

    const pa = beatSamples('papMmHg')
    expect(valueNearPhase(pa, 0.95)).toBeLessThan(valueNearPhase(pa, 0.6))
  })

  it('reports no systolic gradient between the right ventricle and pulmonary artery', () => {
    expect(state.measurements.rvSystolicMmHg).toBe(state.measurements.papSystolicMmHg)
  })

  it('steps pulmonary artery diastolic pressure up above right ventricular end-diastolic pressure', () => {
    expect(state.measurements.papDiastolicMmHg).toBeGreaterThan(state.measurements.rvDiastolicMmHg)
  })

  it('aligns clean trace means with the numerical MAP, RAP, mPAP, and PAWP values', () => {
    const cleanDefinition = {
      ...hemodynamicCases[0],
      initialParameters: {
        ...hemodynamicCases[0].initialParameters,
        pleuralPressureSwingMmHg: 0,
      },
      initialMeasurementSystem: {
        zeroed: true,
        transducerLevelCm: 0,
        dampingRatio: 0.65,
        naturalFrequencyHz: 18,
        noiseAmplitudeMmHg: 0,
        artifact: 'none' as const,
        fastFlushActiveUntil: null,
        lastFastFlushFinding: null,
      },
    }
    const cleanState = createInitialHemodynamicState(cleanDefinition, 'learn', 417)
    const cleanCycle = 60 / cleanState.measurements.heartRateBpm
    const lastBeat = cleanState.waveforms.filter(
      (sample) => sample.time >= cleanState.timeSeconds - cleanCycle,
    )
    const mean = (field: 'artMmHg' | 'cvpMmHg' | 'papMmHg' | 'pcwpMmHg') =>
      lastBeat.reduce((total, sample) => total + sample[field], 0) / lastBeat.length

    expect(mean('artMmHg')).toBeCloseTo(cleanState.measurements.mapMmHg, 0)
    expect(mean('cvpMmHg')).toBeCloseTo(cleanState.measurements.rapMmHg, 0)
    expect(mean('papMmHg')).toBeCloseTo(cleanState.measurements.meanPapMmHg, 0)
    expect(mean('pcwpMmHg')).toBeCloseTo(cleanState.measurements.pawpMmHg ?? 0, 0)
  })
})

describe('ECG landmark timing', () => {
  it('orders the P wave, QRS complex, and T wave across the cycle', () => {
    expect(phaseOfMaximum(ecgShapeMv, 0, 0.15)).toBeCloseTo(CARDIAC_PHASE.rWave, 1)
    expect(phaseOfMaximum(ecgShapeMv, 0.2, 0.45)).toBeCloseTo(CARDIAC_PHASE.tWavePeak, 1)
    expect(phaseOfMaximum(ecgShapeMv, 0.7, 0.95)).toBeCloseTo(CARDIAC_PHASE.pWave, 1)
  })

  it('inscribes Q and S deflections below the isoelectric line', () => {
    expect(ecgShapeMv(CARDIAC_PHASE.qWave)).toBeLessThan(0)
    expect(ecgShapeMv(CARDIAC_PHASE.sWave)).toBeLessThan(0)
  })
})
