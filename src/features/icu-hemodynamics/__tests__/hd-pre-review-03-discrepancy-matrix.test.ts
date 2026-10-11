import {
  fastFlushDisplayedPressures,
  fastFlushLineDefinitions,
} from '../content/pressureSystemVisuals'
import {
  waveformAtlasById,
  waveformValueAt,
  type WaveformTraceSpec,
} from '../content/waveformAtlas'
import { ventricleArteryModelNotes } from '../content/waveformModelLimits'
import { threeTrialState } from '../engine/stageRuntime'
import {
  injectionTechniqueNotDrawnInCurve,
  thermodilutionCurveFeatures,
} from '../engine/thermodilution'
import {
  createNormalPulmonaryArteryWaveform,
  derivePressureMetrics,
  generateArtifactWaveform,
} from '../engine/troubleshootingWaveforms'
import { CARDIAC_PHASE, rightAtrialAmplitudesFor } from '../engine/waveformMorphology'

/**
 * HD-PRE-REVIEW-03 — the waveform discrepancy matrix, as numbers.
 *
 * For each finding that said a picture and its words disagreed (L2-08, L3-03, L3-07, L4-02, L4-04,
 * L7-02), this records what the generator actually produces, sampled, so the disposition of each is
 * a measurement and not an impression of a screenshot. Three kinds of row follow:
 *
 * - **repaired** — an implementation difference against the module's own source or canonical model;
 *   the test asserts the repaired behaviour.
 * - **held** — a property of the model that no registered source or stated model intent settles.
 *   Nothing here asserts that the held behaviour is right. The test measures it and holds the
 *   *statement the learner is given* to that measurement: the limitation is on the page exactly
 *   while it is true of the generator. Correct the generator and the test fails until the
 *   statement, now false, is removed with it.
 * - **not modeled** — the feature does not exist in the generator; the same rule: the surfaces say
 *   so exactly while it is absent.
 */

const SAMPLES = 2000
const sample = (spec: WaveformTraceSpec) =>
  Array.from({ length: SAMPLES }, (_, index) => waveformValueAt(spec, index / SAMPLES))
const at = (values: readonly number[], phase: number) => values[Math.round(phase * SAMPLES)]
const span = (values: readonly number[], from: number, until: number) =>
  values.slice(Math.round(from * SAMPLES), Math.round(until * SAMPLES) + 1)

/** Interior local minima that are followed by a rise of at least `rebound` mmHg. */
function dipsWithRebound(values: readonly number[], rebound: number): number[] {
  const found: number[] = []
  for (let index = 1; index < values.length - 1; index += 1) {
    if (values[index] <= values[index - 1] && values[index] < values[index + 1]) {
      const later = Math.max(...values.slice(index))
      if (later - values[index] >= rebound) found.push(index)
    }
  }
  return found
}

describe('L3-03 · right ventricle versus pulmonary artery, after the peak', () => {
  const ventricle = sample(waveformAtlasById.get('rv-normal')!.trace)
  const artery = sample(waveformAtlasById.get('pa-normal')!.trace)

  it('the right ventricle has no notch: its fall never turns back up', () => {
    const fall = span(ventricle, 0.16, 0.5)
    // Monotone: no sample on the way down is higher than the one before it.
    for (let index = 1; index < fall.length; index += 1) {
      expect(fall[index]).toBeLessThanOrEqual(fall[index - 1] + 1e-9)
    }
    expect(dipsWithRebound(fall, 0.05)).toHaveLength(0)
  })

  it('held: the learner is told of the change of slope exactly while the model draws one', () => {
    // The shoulder the report saw: almost flat just before phase 0.39, steep just after it, at
    // about half the systolic excursion (14 mmHg) — which is why it reads as a feature.
    const before = at(ventricle, 0.385) - at(ventricle, 0.39)
    const after = at(ventricle, 0.39) - at(ventricle, 0.395)
    const drawsSlopeChange = before < 0.05 && after > 1
    expect(Boolean(ventricleArteryModelNotes.ventricularSlopeChange)).toBe(drawsSlopeChange)
  })

  it('the arterial notch is a dip followed by a rise; the ventricle has none', () => {
    const afterPeak = span(artery, 0.18, 0.7)
    const dips = dipsWithRebound(afterPeak, 0.2)
    expect(dips.length).toBeGreaterThanOrEqual(1)
    const notchPhase = 0.18 + dips[0] / SAMPLES
    expect(notchPhase).toBeGreaterThan(CARDIAC_PHASE.pulmonicDicroticNotch)
    expect(notchPhase).toBeLessThan(CARDIAC_PHASE.pulmonicDicroticNotch + 0.03)
  })

  it('drawn without a respiratory swing, every beat is the same beat', () => {
    // The report's "notch at 11 on the labelled beat, 14 on the others" was the reference figure's
    // respiratory envelope. The side-by-side comparison draws none, so the notch sits at one height.
    const spec = waveformAtlasById.get('pa-normal')!.trace
    for (const phase of [0.1, 0.3, 0.465, 0.8]) {
      expect(waveformValueAt(spec, phase)).toBeCloseTo(waveformValueAt(spec, phase + 1), 12)
      expect(waveformValueAt(spec, phase)).toBeCloseTo(waveformValueAt(spec, phase + 2), 12)
    }
  })
})

describe('L3-07 · upstroke and peak timing against the ECG', () => {
  const ventricle = sample(waveformAtlasById.get('rv-normal')!.trace)
  const artery = sample(waveformAtlasById.get('pa-normal')!.trace)

  it('held: the learner is told the ECG timing is schematic exactly while it is', () => {
    // Pulmonary artery: already rising by the Q wave. Right ventricle: still on its end-diastolic
    // pressure at the R wave and rising just after it. So the artery's upstroke leads the
    // ventricle's by the R wave's phase — 36 ms at 75 beats a minute.
    const arteryRisesBeforeQrs = at(artery, CARDIAC_PHASE.qWave) - at(artery, 0) > 1
    const ventricleWaitsForR =
      Math.abs(at(ventricle, CARDIAC_PHASE.rWave - 0.005) - at(ventricle, 0.02)) < 0.05 &&
      at(ventricle, CARDIAC_PHASE.rWave + 0.03) - at(ventricle, CARDIAC_PHASE.rWave) > 2
    // The arterial peak is drawn 0.12 of a cycle before the T wave's peak, where the registered
    // source puts it at about the T wave.
    const peakPhase = artery.indexOf(Math.max(...artery)) / SAMPLES
    const peakAheadOfT = CARDIAC_PHASE.tWavePeak - peakPhase > 0.05
    expect(Boolean(ventricleArteryModelNotes.ecgTimingSchematic)).toBe(
      (arteryRisesBeforeQrs && ventricleWaitsForR) || peakAheadOfT,
    )
  })
})

describe('L4-04 · tricuspid regurgitation', () => {
  const entry = waveformAtlasById.get('ra-tricuspid-regurgitation')!
  const fused = sample(entry.trace)
  const separate = sample({
    ...entry.trace,
    amplitudes: { ...(entry.trace as { amplitudes: object }).amplitudes, systolicFusion: false },
  } as WaveformTraceSpec)

  it('before: the separate components fell 3.5 mmHg between the c wave and the v wave', () => {
    const between = span(separate, CARDIAC_PHASE.atrialCWave, CARDIAC_PHASE.atrialVWave)
    expect(at(separate, CARDIAC_PHASE.atrialCWave) - Math.min(...between)).toBeGreaterThan(3)
    // …and the "x lost" label was anchored inside that fall.
    expect(at(separate, CARDIAC_PHASE.atrialXDescent)).toBeLessThan(
      at(separate, CARDIAC_PHASE.atrialCWave) - 3,
    )
  })

  it('repaired: one systolic wave rises from the c wave to the v wave and never falls back', () => {
    const between = span(fused, CARDIAC_PHASE.atrialCWave, CARDIAC_PHASE.atrialVWave)
    // To within a thousandth of a mmHg: the v wave's own summit sits a hair before its nominal
    // phase, because the y descent's leading edge already pulls on it there.
    for (let index = 1; index < between.length; index += 1) {
      expect(between[index]).toBeGreaterThanOrEqual(between[index - 1] - 1e-3)
    }
    expect(Math.max(...between) - between.at(-1)!).toBeLessThan(1e-3)
    // Where the x descent would be, the pressure is above the c wave, not below it.
    expect(at(fused, CARDIAC_PHASE.atrialXDescent)).toBeGreaterThan(
      at(fused, CARDIAC_PHASE.atrialCWave),
    )
  })

  it('leaves the rest of the authored example where it was', () => {
    // Still centred on the authored mean.
    expect(fused.reduce((total, value) => total + value, 0) / SAMPLES).toBeCloseTo(14, 2)
    // The y descent is still the lowest point and still follows the v wave.
    const lowest = fused.indexOf(Math.min(...fused)) / SAMPLES
    expect(lowest).toBeGreaterThan(CARDIAC_PHASE.atrialVWave)
    expect(lowest).toBeLessThan(0.7)
    // The v wave's fall and the a wave are the separate components' own, up to the mean shift.
    const shift = at(fused, 0.8) - at(separate, 0.8)
    for (const phase of [0.5, 0.6, 0.7, 0.9, 0.94, 0.99, 0.05]) {
      expect(at(fused, phase) - at(separate, phase)).toBeCloseTo(shift, 9)
    }
  })

  it('does not reach the live model: its amplitudes never ask for the fusion', () => {
    for (const severity of [0, 0.45, 1]) {
      const amplitudes = rightAtrialAmplitudesFor({
        ventricularCompliance: 1,
        pericardialPressureMmHg: 0,
        tricuspidRegurgitationSeverity: severity,
      })
      expect(amplitudes.systolicFusion).toBeUndefined()
    }
  })
})

describe('L4-02 · rhythm-defined patterns', () => {
  it.each(['ra-cannon-a-wave', 'ra-atrial-fibrillation'])(
    'not modeled: %s says it has no rhythm exactly while it is one beat repeated evenly',
    (id) => {
      const entry = waveformAtlasById.get(id)!
      let everyBeatTheSame = true
      for (let step = 0; step < 50; step += 1) {
        const phase = step / 50
        if (
          Math.abs(waveformValueAt(entry.trace, phase + 1) - waveformValueAt(entry.trace, phase)) >
          1e-9
        ) {
          everyBeatTheSame = false
        }
      }
      expect(Boolean(entry.renderingLimit)).toBe(everyBeatTheSame)
    },
  )

  it('the atrial-fibrillation schematic does draw the feature it names: no a wave', () => {
    const fibrillation = sample(waveformAtlasById.get('ra-atrial-fibrillation')!.trace)
    const normal = sample(waveformAtlasById.get('ra-normal')!.trace)
    const rise = (values: readonly number[]) =>
      at(values, CARDIAC_PHASE.atrialAWave) - at(values, CARDIAC_PHASE.atrialAWave - 0.12)
    expect(rise(normal)).toBeGreaterThan(2)
    expect(Math.abs(rise(fibrillation))).toBeLessThan(0.6)
  })
})

describe('L2-08 · the dynamic-response examples', () => {
  it('repaired: the Learn examples draw the troubleshooting atlas’ own distortion', () => {
    const source = derivePressureMetrics(createNormalPulmonaryArteryWaveform())
    for (const response of ['overdamped', 'underdamped'] as const) {
      const atlas = generateArtifactWaveform(response).metrics
      const learn = fastFlushDisplayedPressures('pulmonary-artery', response)
      expect(learn.systolicMmHg).toBeCloseTo(atlas.systolicMmHg, 1)
      expect(learn.diastolicMmHg).toBeCloseTo(atlas.diastolicMmHg, 1)
      expect(learn.meanMmHg).toBeCloseTo(atlas.meanMmHg, 1)
      // "Relatively preserved" is the atlas' own threshold for the mean.
      expect(Math.abs(learn.meanMmHg - source.meanMmHg)).toBeLessThan(1.5)
    }
    const clean = fastFlushDisplayedPressures('pulmonary-artery', 'acceptable')
    expect(clean.systolicMmHg).toBeCloseTo(25, 1)
    expect(clean.diastolicMmHg).toBeCloseTo(10, 1)
  })

  it('reads high and low in the direction the caption says, on both lines', () => {
    for (const lineType of ['pulmonary-artery', 'systemic-arterial'] as const) {
      const line = fastFlushLineDefinitions[lineType]
      const pulse = line.systolicMmHg - line.diastolicMmHg
      const under = fastFlushDisplayedPressures(lineType, 'underdamped')
      const over = fastFlushDisplayedPressures(lineType, 'overdamped')
      // More than a fifteenth of the pulse pressure: visible on the figure, not a rounding.
      expect(under.systolicMmHg - line.systolicMmHg).toBeGreaterThan(pulse / 15)
      expect(line.diastolicMmHg - under.diastolicMmHg).toBeGreaterThan(pulse / 15)
      expect(line.systolicMmHg - over.systolicMmHg).toBeGreaterThan(pulse / 15)
      expect(over.diastolicMmHg - line.diastolicMmHg).toBeGreaterThan(pulse / 15)
    }
  })
})

describe('L7-02 · a prolonged, interrupted injection', () => {
  const [first, second, third] = threeTrialState(510).thermodilutionTrials

  it('not modeled: the note is on the prolonged trial exactly while its contour is not redrawn', () => {
    // The authored trial: a prolonged, uneven injection.
    expect(second.technique.injectionDurationSeconds).toBeGreaterThan(4)
    expect(second.technique.smoothness).toBeLessThan(0.7)
    const clean = thermodilutionCurveFeatures(first)
    const slow = thermodilutionCurveFeatures(second)
    // Same onset and the same time to peak, within one 50 ms sample, and no second peak by the
    // module's own detector: the technique changed the curve's height and noise, not its shape.
    const contourNotRedrawn =
      Math.abs((slow.onsetSeconds ?? 0) - (clean.onsetSeconds ?? 0)) <= 0.1 &&
      Math.abs(slow.peakTimeSeconds - clean.peakTimeSeconds) <= 0.1 &&
      slow.secondaryDisturbance === false
    expect(injectionTechniqueNotDrawnInCurve(second)).toBe(contourNotRedrawn)
  })

  it('and on no trial whose technique was within the window', () => {
    expect(injectionTechniqueNotDrawnInCurve(first)).toBe(false)
    expect(injectionTechniqueNotDrawnInCurve(third)).toBe(false)
  })
})
