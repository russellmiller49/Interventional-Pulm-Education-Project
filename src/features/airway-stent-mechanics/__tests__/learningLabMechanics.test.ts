import { architectureRegistry } from '../content/architectureRegistry'
import {
  applyLoadAmplitude,
  calculateBraidKinematics,
  clampLoadProgress,
  getLoadFrame,
  getRepresentativeLoadProgress,
  resolveAnimationProgress,
  resolvePingPongProgress,
} from '../engine/learningLabMechanics'
import { STENT_LOAD_MODES } from '../engine/learningLabTypes'

describe('airway stent learning-lab mechanics engine', () => {
  it('returns finite bounded qualitative load frames for every mode', () => {
    for (const mode of STENT_LOAD_MODES) {
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        const frame = getLoadFrame(mode, progress)
        expect(frame.mode).toBe(mode)
        expect(frame.progress).toBe(progress)
        expect(frame.radialScaleX).toBeGreaterThanOrEqual(0.55)
        expect(frame.radialScaleX).toBeLessThanOrEqual(1.15)
        expect(frame.radialScaleZ).toBeGreaterThanOrEqual(0.55)
        expect(frame.radialScaleZ).toBeLessThanOrEqual(1.15)
        expect(frame.axialScale).toBeGreaterThanOrEqual(0.75)
        expect(frame.axialScale).toBeLessThanOrEqual(1.35)
        expect(frame.bendRadians).toBeGreaterThanOrEqual(-1.2)
        expect(frame.bendRadians).toBeLessThanOrEqual(1.2)
        expect(frame.twistRadians).toBeGreaterThanOrEqual(-0.8)
        expect(frame.twistRadians).toBeLessThanOrEqual(0.8)
        expect(frame.axialOffset).toBeGreaterThanOrEqual(-1)
        expect(frame.axialOffset).toBeLessThanOrEqual(1)
        expect(frame.caption.length).toBeGreaterThan(30)
      }
    }
  })

  it('applies the same radial boundary displacement without inventing force fields', () => {
    const frames = architectureRegistry.map((profile) => getLoadFrame('radial', 0.8, profile))
    expect(new Set(frames.map((frame) => frame.radialScaleX)).size).toBe(1)
    expect(new Set(frames.map((frame) => frame.radialScaleZ)).size).toBe(1)
    for (const frame of frames) {
      expect(Object.keys(frame)).not.toEqual(
        expect.arrayContaining(['force', 'pressureKpa', 'stiffnessScore']),
      )
    }
  })

  it('applies a bounded visible-displacement multiplier without adding force fields', () => {
    const frame = getLoadFrame('radial', 1, 'free-crossing-braid')
    const halfAmplitude = applyLoadAmplitude(frame, 0.5)
    const clampedAmplitude = applyLoadAmplitude(frame, 12)

    expect(halfAmplitude.radialScaleX).toBeCloseTo(0.85, 5)
    expect(halfAmplitude.normalizedDiameterRetention).toBeCloseTo(0.85, 5)
    expect(halfAmplitude.normalizedLengthChange).toBeCloseTo(
      (frame.normalizedLengthChange ?? 0) * 0.5,
      5,
    )
    expect(clampedAmplitude).toEqual(frame)
    expect(Object.keys(halfAmplitude)).not.toEqual(
      expect.arrayContaining(['force', 'pressureKpa', 'stiffnessScore']),
    )
    expect(() => applyLoadAmplitude(frame, Number.NaN)).toThrow('finite')
  })

  it('reports normalized metrics only where the topology supports them', () => {
    const freeBraid = getLoadFrame('ovalization', 1, 'free-crossing-braid')
    expect(freeBraid.normalizedDiameterRetention).toBeGreaterThan(0)
    expect(freeBraid.normalizedDiameterRetention).toBeLessThan(1)
    expect(freeBraid.normalizedLengthChange).not.toBeNull()

    const y = getLoadFrame('bend', 1, 'silicone-y')
    expect(y.normalizedDiameterRetention).toBeNull()
    expect(y.normalizedLengthChange).toBeNull()
    expect(() => getLoadFrame('ovalization', 1, 'silicone-y')).toThrow('does not support')
  })

  it('shows bounded release coupling from constrained to unloaded deployment pose', () => {
    const constrained = getLoadFrame('deployment', 0, 'free-crossing-braid')
    const released = getLoadFrame('deployment', 1, 'free-crossing-braid')

    expect(constrained.normalizedDiameterRetention).toBeCloseTo(0.58, 5)
    expect(constrained.normalizedLengthChange).toBeGreaterThan(0)
    expect(released.normalizedDiameterRetention).toBe(1)
    expect(released.normalizedLengthChange).toBe(0)
  })

  it('makes deployment length coupling visibly stronger for braid, captured, and knit paths than for a laser-cut lattice', () => {
    const freeBraid = getLoadFrame('deployment', 0, 'free-crossing-braid')
    const capturedHookAndCross = getLoadFrame('deployment', 0, 'hook-cross-covered')
    const singleWireKnit = getLoadFrame('deployment', 0, 'single-wire-knit-partial-cover')
    const laserCut = getLoadFrame('deployment', 0, 'laser-cut-covered')

    expect(freeBraid.normalizedLengthChange).toBeGreaterThan(0.2)
    expect(capturedHookAndCross.normalizedLengthChange).toBeGreaterThan(0.13)
    expect(singleWireKnit.normalizedLengthChange).toBeGreaterThan(0.16)
    expect(laserCut.normalizedLengthChange).toBeGreaterThan(0)
    expect(laserCut.normalizedLengthChange).toBeLessThan(0.05)

    for (const coupled of [freeBraid, capturedHookAndCross, singleWireKnit]) {
      expect(coupled.normalizedLengthChange).toBeGreaterThan(
        (laserCut.normalizedLengthChange ?? 0) + 0.08,
      )
      expect(coupled.normalizedDiameterRetention).toBe(laserCut.normalizedDiameterRetention)
    }
  })

  it('selects a clear representative paused pose for every load mode', () => {
    expect(
      Object.fromEntries(
        STENT_LOAD_MODES.map((mode) => [mode, getRepresentativeLoadProgress(mode)]),
      ),
    ).toEqual({
      rest: 0,
      radial: 0.88,
      bend: 0.82,
      ovalization: 0.88,
      breathing: 0.5,
      cough: 0.5,
      deployment: 0,
    })

    expect(getLoadFrame('breathing', getRepresentativeLoadProgress('breathing')).radialScaleX).toBe(
      0.87,
    )
    expect(getLoadFrame('cough', getRepresentativeLoadProgress('cough')).radialScaleX).toBe(0.7)
    expect(
      getLoadFrame('deployment', getRepresentativeLoadProgress('deployment')).radialScaleX,
    ).toBe(0.58)
  })

  it('preserves the exact pose when paused or reduced motion is active', () => {
    expect(
      resolveAnimationProgress({
        currentProgress: 0.437,
        deltaSeconds: 12,
        isPlaying: false,
      }),
    ).toBe(0.437)
    expect(
      resolveAnimationProgress({
        currentProgress: 0.437,
        deltaSeconds: 12,
        isPlaying: true,
        reducedMotion: true,
      }),
    ).toBe(0.437)
    expect(
      resolveAnimationProgress({
        currentProgress: 0.95,
        deltaSeconds: 1,
        isPlaying: true,
        speed: 0.1,
      }),
    ).toBeCloseTo(0.05, 6)
  })

  it('reflects ping-pong progress at either endpoint without a wraparound snap', () => {
    expect(
      resolvePingPongProgress({
        currentProgress: 0.92,
        deltaSeconds: 1,
        direction: 1,
        isPlaying: true,
        speed: 0.3,
      }),
    ).toEqual({ direction: -1, progress: 0.78 })

    expect(
      resolvePingPongProgress({
        currentProgress: 0.08,
        deltaSeconds: 1,
        direction: -1,
        isPlaying: true,
        speed: 0.3,
      }),
    ).toEqual({ direction: 1, progress: 0.22 })
  })

  it('preserves ping-pong progress and direction while paused or reduced motion is active', () => {
    expect(
      resolvePingPongProgress({
        currentProgress: 0.437,
        deltaSeconds: 12,
        direction: -1,
        isPlaying: false,
      }),
    ).toEqual({ direction: -1, progress: 0.437 })

    expect(
      resolvePingPongProgress({
        currentProgress: 0.437,
        deltaSeconds: 12,
        direction: 1,
        isPlaying: true,
        reducedMotion: true,
      }),
    ).toEqual({ direction: 1, progress: 0.437 })
  })

  it('calculates an idealized inextensible-wire braid relation', () => {
    const result = calculateBraidKinematics({
      initialDiameter: 20,
      initialLength: 60,
      initialBraidAngleDeg: 55,
      targetDiameter: 14,
    })

    expect(result.normalizedDiameterRetention).toBe(0.7)
    expect(result.targetBraidAngleDeg).toBeLessThan(55)
    expect(result.targetLength).toBeGreaterThan(60)
    expect(result.normalizedLengthChange).toBeGreaterThan(0)
    expect(result.wirePathLength).toBeGreaterThan(result.targetLength)
    expect(result.turnCount).toBeGreaterThan(0)
  })

  it('validates mechanics and animation inputs', () => {
    expect(clampLoadProgress(-2)).toBe(0)
    expect(clampLoadProgress(2)).toBe(1)
    expect(() => clampLoadProgress(Number.NaN)).toThrow('finite')
    expect(() =>
      calculateBraidKinematics({
        initialDiameter: 0,
        initialLength: 60,
        initialBraidAngleDeg: 55,
        targetDiameter: 14,
      }),
    ).toThrow('greater than zero')
    expect(() =>
      calculateBraidKinematics({
        initialDiameter: 20,
        initialLength: 60,
        initialBraidAngleDeg: 90,
        targetDiameter: 14,
      }),
    ).toThrow('between 0 and 90')
    expect(() =>
      calculateBraidKinematics({
        initialDiameter: 20,
        initialLength: 60,
        initialBraidAngleDeg: 55,
        targetDiameter: 40,
      }),
    ).toThrow('incompatible')
    expect(() =>
      resolveAnimationProgress({
        currentProgress: 0.4,
        deltaSeconds: -1,
        isPlaying: true,
      }),
    ).toThrow('zero or greater')
    expect(() =>
      resolveAnimationProgress({
        currentProgress: 0.4,
        deltaSeconds: 1,
        isPlaying: true,
        speed: 0,
      }),
    ).toThrow('greater than zero')
    expect(() =>
      resolvePingPongProgress({
        currentProgress: Number.NaN,
        deltaSeconds: 1,
        direction: 1,
        isPlaying: true,
      }),
    ).toThrow('finite')
    expect(() =>
      resolvePingPongProgress({
        currentProgress: 1.1,
        deltaSeconds: 1,
        direction: 1,
        isPlaying: true,
      }),
    ).toThrow('between 0 and 1')
    expect(() =>
      resolvePingPongProgress({
        currentProgress: 0.4,
        deltaSeconds: -1,
        direction: 1,
        isPlaying: true,
      }),
    ).toThrow('zero or greater')
    expect(() =>
      resolvePingPongProgress({
        currentProgress: 0.4,
        deltaSeconds: 1,
        direction: 1,
        isPlaying: true,
        speed: 0,
      }),
    ).toThrow('greater than zero')
    expect(() =>
      resolvePingPongProgress({
        currentProgress: 0.4,
        deltaSeconds: 1,
        direction: 0 as -1 | 1,
        isPlaying: true,
      }),
    ).toThrow('must be -1 or 1')
  })
})
