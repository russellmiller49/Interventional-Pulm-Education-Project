import {
  ARTIFACT_IDS,
  artifactDefinitions,
  getArtifactDefinition,
  troubleshootingEntries,
} from '../content/troubleshootingAtlas'
import {
  artifactTransforms,
  createNormalPulmonaryArteryWaveform,
  deriveBeatPressureMetrics,
  derivePressureMetrics,
  generateArtifactWaveform,
  getArtifactWaveformTransform,
  TROUBLESHOOTING_BEAT_SECONDS,
} from '../engine/troubleshootingWaveforms'
import { MMHG_PER_CM_H2O } from '../engine/waveformMorphology'

function signature(id: (typeof ARTIFACT_IDS)[number]): string {
  return generateArtifactWaveform(id)
    .samples.filter((_, index) => index % 19 === 0)
    .map((sample) => sample.pressureMmHg.toFixed(2))
    .join('|')
}

describe('typed PA-catheter artifact registry', () => {
  it('gives every tab exactly one complete definition and one transform', () => {
    expect(troubleshootingEntries.map((entry) => entry.id)).toEqual(ARTIFACT_IDS)
    expect(Object.keys(artifactDefinitions).sort()).toEqual([...ARTIFACT_IDS].sort())
    expect(Object.keys(artifactTransforms).sort()).toEqual([...ARTIFACT_IDS].sort())

    for (const id of ARTIFACT_IDS) {
      const definition = getArtifactDefinition(id)
      expect(definition.appearance.length).toBeGreaterThan(0)
      expect(definition.causes.length).toBeGreaterThan(0)
      expect(definition.actions.length).toBeGreaterThan(0)
      expect(definition.doNot.length).toBeGreaterThan(0)
      expect(definition.sourceIds.length).toBeGreaterThan(0)
      expect(getArtifactWaveformTransform(id)).toBe(artifactTransforms[id])
    }
  })

  it('throws for unknown or mismatched IDs instead of silently showing a normal trace', () => {
    expect(() => getArtifactDefinition('under-damped')).toThrow(
      /Unknown PA-catheter troubleshooting definition/,
    )
    expect(() => getArtifactWaveformTransform('underDamped')).toThrow(
      /Unknown PA-catheter troubleshooting artifact/,
    )
    expect(() => generateArtifactWaveform('valve-strike')).toThrow(
      /Unknown PA-catheter troubleshooting artifact/,
    )
  })

  it('produces a distinct deterministic waveform signature for every tab', () => {
    const signatures = ARTIFACT_IDS.map((id) => signature(id))
    expect(new Set(signatures).size).toBe(ARTIFACT_IDS.length)
    expect(ARTIFACT_IDS.map((id) => signature(id))).toEqual(signatures)
  })
})

describe('artifact waveform physiology and derived numbers', () => {
  const normalSamples = createNormalPulmonaryArteryWaveform()
  const normal = derivePressureMetrics(normalSamples)

  it('uses an illustrative normal PA source near 25/10 with a mean near 15-17 mmHg', () => {
    expect(normal.systolicMmHg).toBeCloseTo(25, 0)
    expect(normal.diastolicMmHg).toBeCloseTo(10, 0)
    expect(normal.meanMmHg).toBeGreaterThanOrEqual(15)
    expect(normal.meanMmHg).toBeLessThanOrEqual(17)
    expect(deriveBeatPressureMetrics(normalSamples)).toHaveLength(4)
  })

  it('makes overdamping lower systolic, raise diastolic, narrow pulse pressure, and preserve mean', () => {
    const overdamped = generateArtifactWaveform('overdamped')
    expect(overdamped.metrics.systolicMmHg).toBeLessThan(normal.systolicMmHg)
    expect(overdamped.metrics.diastolicMmHg).toBeGreaterThan(normal.diastolicMmHg)
    expect(overdamped.metrics.pulsePressureMmHg).toBeLessThan(normal.pulsePressureMmHg)
    expect(Math.abs(overdamped.metrics.meanMmHg - normal.meanMmHg)).toBeLessThan(1)
    expect(overdamped.effects).toEqual(
      expect.objectContaining({
        systolic: 'falsely low',
        diastolic: 'falsely high',
        mean: 'relatively preserved',
      }),
    )
  })

  it('makes underdamping raise systolic, lower diastolic, and widen pulse pressure', () => {
    const underdamped = generateArtifactWaveform('underdamped')
    expect(underdamped.metrics.systolicMmHg).toBeGreaterThan(normal.systolicMmHg)
    expect(underdamped.metrics.diastolicMmHg).toBeLessThan(normal.diastolicMmHg)
    expect(underdamped.metrics.pulsePressureMmHg).toBeGreaterThan(normal.pulsePressureMmHg)
    expect(Math.abs(underdamped.metrics.meanMmHg - normal.meanMmHg)).toBeLessThan(1.5)
    expect(underdamped.effects).toEqual(
      expect.objectContaining({
        systolic: 'falsely high',
        diastolic: 'falsely low',
        mean: 'relatively preserved',
      }),
    )
  })

  it('keeps the catheter-whip transient narrow, early-systolic, and variable by beat', () => {
    const whip = generateArtifactWaveform('catheter-whip')
    const beatPeaks = deriveBeatPressureMetrics(whip.samples).map((beat) => beat.systolicMmHg)
    expect(new Set(beatPeaks.map((peak) => peak.toFixed(1))).size).toBeGreaterThan(2)

    const peak = whip.samples.reduce((highest, sample) =>
      sample.pressureMmHg > highest.pressureMmHg ? sample : highest,
    )
    expect(peak.cardiacPhase).toBeGreaterThan(0.05)
    expect(peak.cardiacPhase).toBeLessThan(0.13)

    const sourceByTime = new Map(
      normalSamples.map((sample) => [sample.timeSeconds.toFixed(4), sample.pressureMmHg]),
    )
    const contaminated = whip.samples.filter(
      (sample) => sample.pressureMmHg - (sourceByTime.get(sample.timeSeconds.toFixed(4)) ?? 0) > 5,
    )
    expect(Math.max(...contaminated.map((sample) => sample.cardiacPhase))).toBeLessThan(0.14)
  })

  it('makes wall contact begin and resolve abruptly while marking all values unreliable', () => {
    const contact = generateArtifactWaveform('wall-contact')
    const affectedBeat = contact.samples.filter((sample) => sample.beatIndex === 1)
    const before = affectedBeat.find((sample) => sample.cardiacPhase >= 0.2)!
    const during = affectedBeat.find((sample) => sample.cardiacPhase >= 0.25)!
    const after = affectedBeat.find((sample) => sample.cardiacPhase >= 0.86)!
    expect(Math.abs(during.pressureMmHg - 15.5)).toBeLessThan(1)
    expect(Math.abs(before.pressureMmHg - during.pressureMmHg)).toBeGreaterThan(1)
    expect(Math.abs(after.pressureMmHg - during.pressureMmHg)).toBeGreaterThan(1)
    expect(contact.metricDisplay).toBe('unreliable')
    expect(new Set(Object.values(contact.effects))).toEqual(new Set(['unreliable']))
  })

  it('transitions spontaneous wedge from PA to lower-amplitude atrial-type morphology', () => {
    const wedge = generateArtifactWaveform('spontaneous-wedge')
    const beats = deriveBeatPressureMetrics(wedge.samples)
    expect(beats[0].pulsePressureMmHg).toBeCloseTo(normal.pulsePressureMmHg, 1)
    expect(beats[3].pulsePressureMmHg).toBeLessThan(beats[0].pulsePressureMmHg * 0.55)
    expect(wedge.metricDisplay).toBe('different-compartment')

    const lateSamples = wedge.samples.filter((sample) => sample.beatIndex === 3)
    const aWave = lateSamples.reduce((nearest, sample) =>
      Math.abs(sample.cardiacPhase - 0.14) < Math.abs(nearest.cardiacPhase - 0.14)
        ? sample
        : nearest,
    )
    const xDescent = lateSamples.reduce((nearest, sample) =>
      Math.abs(sample.cardiacPhase - 0.34) < Math.abs(nearest.cardiacPhase - 0.34)
        ? sample
        : nearest,
    )
    expect(aWave.pressureMmHg).toBeGreaterThan(xDescent.pressureMmHg)
  })

  it('makes overwedging progressively rise and never resemble a normal final PA beat', () => {
    const overwedged = generateArtifactWaveform('overwedging')
    const finalBeat = overwedged.samples.filter((sample) => sample.beatIndex === 3)
    expect(finalBeat.at(-1)!.pressureMmHg - finalBeat[0].pressureMmHg).toBeGreaterThan(8)
    expect(derivePressureMetrics(finalBeat).meanMmHg).toBeGreaterThan(normal.meanMmHg + 8)
    expect(overwedged.metricDisplay).toBe('unreliable')
  })

  it('applies zero or level error as one constant offset without changing pulse pressure or shape', () => {
    const low = generateArtifactWaveform('zero-level', {
      zeroLevelMode: 'transducer-too-low',
    })
    const high = generateArtifactWaveform('zero-level', {
      zeroLevelMode: 'transducer-too-high',
    })
    const correct = generateArtifactWaveform('zero-level', {
      zeroLevelMode: 'correctly-leveled',
    })

    expect(low.metrics.systolicMmHg - normal.systolicMmHg).toBeCloseTo(10 * MMHG_PER_CM_H2O, 5)
    expect(low.metrics.diastolicMmHg - normal.diastolicMmHg).toBeCloseTo(10 * MMHG_PER_CM_H2O, 5)
    expect(low.metrics.meanMmHg - normal.meanMmHg).toBeCloseTo(10 * MMHG_PER_CM_H2O, 5)
    expect(high.metrics.meanMmHg - normal.meanMmHg).toBeCloseTo(-10 * MMHG_PER_CM_H2O, 5)
    expect(low.metrics.pulsePressureMmHg).toBeCloseTo(normal.pulsePressureMmHg, 8)
    expect(high.metrics.pulsePressureMmHg).toBeCloseTo(normal.pulsePressureMmHg, 8)
    expect(correct.metrics).toEqual(normal)

    const offsets = low.samples.map(
      (sample, index) => sample.pressureMmHg - normalSamples[index].pressureMmHg,
    )
    expect(Math.max(...offsets) - Math.min(...offsets)).toBeLessThan(1e-9)
  })

  it('renders false wedge as a contaminated mixture rather than a normal wedge trace', () => {
    const falseWedge = generateArtifactWaveform('false-wedge')
    const wedge = generateArtifactWaveform('spontaneous-wedge')
    const finalWedgeBeat = derivePressureMetrics(
      wedge.samples.filter((sample) => sample.beatIndex === 3),
    )

    expect(falseWedge.metricDisplay).toBe('different-compartment')
    expect(falseWedge.metrics.pulsePressureMmHg).toBeGreaterThan(finalWedgeBeat.pulsePressureMmHg)
    expect(signature('false-wedge')).not.toBe(signature('spontaneous-wedge'))
  })

  it('contains at least three complete beats on a shared time base', () => {
    for (const id of ARTIFACT_IDS) {
      const result = generateArtifactWaveform(id)
      expect(result.samples.at(-1)!.timeSeconds).toBeGreaterThan(TROUBLESHOOTING_BEAT_SECONDS * 3)
      expect(new Set(result.samples.map((sample) => sample.beatIndex)).size).toBe(4)
    }
  })
})
