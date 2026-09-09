import { DTS } from '../lib/tomosynthesis'
import { LESION_CENTER } from '../lib/physics'
import { dtsArc, dtsPlaneQuad, missingWedge, smearWidth } from '../components/suite/dtsModel'

test('every authored DTS sweep has the atlas count, symmetric endpoints and a central projection', () => {
  for (const sweep of DTS.sweeps) {
    const arc = dtsArc(sweep)
    expect(arc).toHaveLength(DTS.viewsPerSweep)
    expect(arc[0].angle).toBe(-sweep / 2)
    expect(arc[12].angle).toBe(sweep / 2)
    expect(arc[6].angle).toBe(0)
    const gaps = missingWedge(sweep)
    expect(gaps.reduce((sum, [a, b]) => sum + b - a, 0)).toBe(360 - 2 * sweep)
  }
})
test('the focal quad uses the reconstruction image centre and moves only in depth', () => {
  const points = dtsPlaneQuad(-18)
  expect(points.map((p) => p[1])).toEqual(Array(4).fill(LESION_CENTER[1] - 18))
  expect(points.reduce((sum, p) => sum + p[0], 0) / 4).toBe(LESION_CENTER[0] - 20)
  expect(points.reduce((sum, p) => sum + p[2], 0) / 4).toBe(LESION_CENTER[2])
})
test('a matched plane has zero spread while greater mismatch and a wider sweep increase spreading', () => {
  expect(smearWidth(-18, -18, 40)).toBe(0)
  expect(smearWidth(-18, 0, 20)).toBeLessThan(smearWidth(-18, 0, 40))
  expect(smearWidth(-18, 0, 40)).toBeLessThan(smearWidth(-18, 18, 40))
})
