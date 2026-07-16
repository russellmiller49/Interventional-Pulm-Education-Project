import { clampProgress, getStentExamplePose } from '../engine/exampleAnimations'

describe('specific stent example animations', () => {
  it('clamps invalid progress and produces deterministic endpoints', () => {
    expect(clampProgress(-2)).toBe(0)
    expect(clampProgress(3)).toBe(1)
    expect(clampProgress(Number.NaN)).toBe(0)
    expect(getStentExamplePose('bend', 1)).toEqual(getStentExamplePose('bend', 4))
  })

  it('moves deployment from constrained insertion to airway apposition', () => {
    const start = getStentExamplePose('deployment', 0)
    const end = getStentExamplePose('deployment', 1)

    expect(start.radialCompression).toBe(1)
    expect(end.radialCompression).toBe(0)
    expect(end.stenosisRelief).toBeGreaterThan(start.stenosisRelief)
    expect(end.stentOffsetY).toBeLessThan(start.stentOffsetY)
    expect(end.annotationIntensity).toBe(1)
  })

  it('crossfades pairs without pretending their meshes are registered morphs', () => {
    const start = getStentExamplePose('cover', 0)
    const middle = getStentExamplePose('cover', 0.5)
    const end = getStentExamplePose('cover', 1)

    expect(start.uncoveredOpacity).toBe(1)
    expect(start.coveredOpacity).toBe(0)
    expect(middle.uncoveredOpacity).toBeCloseTo(middle.coveredOpacity)
    expect(end.uncoveredOpacity).toBe(0)
    expect(end.coveredOpacity).toBe(1)
  })

  it('combines bend and ovalization for curved-airway teaching', () => {
    const end = getStentExamplePose('bend', 1)
    expect(end.bend).toBe(1)
    expect(end.ovalization).toBeGreaterThan(0.5)
    expect(end.radialCompression).toBeGreaterThan(0)
  })

  it('settles fatigue and Y-stent sequences into annotated static end poses', () => {
    const fatigue = getStentExamplePose('fatigue', 1)
    const yStent = getStentExamplePose('y-anchoring', 1)

    expect(fatigue.annotationIntensity).toBe(1)
    expect(fatigue.bend).toBeGreaterThan(0)
    expect(yStent.stentOffsetY).toBe(0)
    expect(yStent.stentRotationZ).toBe(0)
    expect(yStent.annotationIntensity).toBe(1)
  })
})
