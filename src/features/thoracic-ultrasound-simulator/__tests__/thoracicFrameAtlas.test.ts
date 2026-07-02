import {
  defaultFrameAtlasTolerance,
  hasProbeState,
  normalizeFrameAtlas,
  poseDistanceWithinTolerance,
  selectNearestReviewedFrame,
} from '../engine/frameAtlas'
import { makeAtlasEntry, testProbe } from '../testSupport/fixtures'

describe('generic frame atlas selection', () => {
  it('validates probe states', () => {
    expect(hasProbeState(testProbe)).toBe(true)
    expect(hasProbeState({ ...testProbe, depthCm: undefined })).toBe(false)
    expect(hasProbeState(null)).toBe(false)
  })

  it('normalizes tolerance with defaults and filters malformed entries', () => {
    const normalized = normalizeFrameAtlas({
      selectionTolerance: { lateralMm: 10 },
      entries: [makeAtlasEntry(), { id: 'broken' } as never],
    })

    expect(normalized?.selectionTolerance.lateralMm).toBe(10)
    expect(normalized?.selectionTolerance.depthCm).toBe(defaultFrameAtlasTolerance.depthCm)
    expect(normalized?.entries).toHaveLength(1)
  })

  it('returns null for empty or missing atlases', () => {
    expect(normalizeFrameAtlas(undefined)).toBeNull()
    expect(normalizeFrameAtlas({ selectionTolerance: {}, entries: [] })).toBeNull()
  })

  it('measures normalized pose distance against per-axis tolerance', () => {
    const inside = poseDistanceWithinTolerance(
      { ...testProbe, lateralMm: testProbe.lateralMm + 4 },
      testProbe,
      defaultFrameAtlasTolerance,
    )
    expect(inside.withinTolerance).toBe(true)
    expect(inside.normalizedDistance).toBeCloseTo(0.5)

    const outside = poseDistanceWithinTolerance(
      { ...testProbe, tiltDeg: testProbe.tiltDeg + 20 },
      testProbe,
      defaultFrameAtlasTolerance,
    )
    expect(outside.withinTolerance).toBe(false)
  })

  it('selects the nearest reviewed entry within tolerance', () => {
    const selection = selectNearestReviewedFrame(
      {
        selectionTolerance: { lateralMm: 10 },
        entries: [
          makeAtlasEntry({
            id: 'far',
            probe: { ...testProbe, lateralMm: testProbe.lateralMm - 8 },
          }),
          makeAtlasEntry({ id: 'near' }),
        ],
      },
      { ...testProbe, lateralMm: testProbe.lateralMm + 1 },
    )

    expect(selection?.entry.id).toBe('near')
  })

  it('never selects needs-review entries or out-of-tolerance poses', () => {
    const selection = selectNearestReviewedFrame(
      {
        selectionTolerance: { lateralMm: 4, craniocaudalMm: 4 },
        entries: [
          makeAtlasEntry({ id: 'unreviewed', reviewStatus: 'needs-review' }),
          makeAtlasEntry({
            id: 'too-far',
            probe: { ...testProbe, lateralMm: testProbe.lateralMm - 40 },
          }),
        ],
      },
      testProbe,
    )

    expect(selection).toBeNull()
  })
})
