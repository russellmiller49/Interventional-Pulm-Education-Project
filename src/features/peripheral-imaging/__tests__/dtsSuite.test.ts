import { DTS } from '../lib/tomosynthesis'
import { LESION_CENTER } from '../lib/physics'
import {
  dtsArc,
  dtsPlaneQuad,
  missingWedge,
  smearWidth,
  toolTipDepth,
} from '../components/suite/dtsModel'
import { focusReading } from '../components/suite/views/TomosynthesisView'

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

describe('the DTS panel says which object is in focus', () => {
  it('names the nodule at its plane, the tool at its plane, and neither between', () => {
    expect(focusReading(0, 30)).toMatch(/^the nodule is in focus/)
    expect(focusReading(-18, 30)).toMatch(/^the tool is in focus/)
    expect(focusReading(-9, 30)).toMatch(/^neither/)
  })
})

describe('an arc centred off the frontal view', () => {
  it('centres the arc, its missing wedge and its plane on the chosen obliquity', () => {
    expect(dtsArc(30, undefined, -20).map((s) => s.angle)[0]).toBeCloseTo(-35, 9)
    expect(dtsArc(30, undefined, -20).map((s) => s.angle)[12]).toBeCloseTo(-5, 9)
    expect(missingWedge(30, -20)).toEqual([
      [-5, 145],
      [175, 325],
    ])
    expect(missingWedge(30)).toEqual([
      [15, 165],
      [195, 345],
    ])
    // A frontal plane is unchanged; a centred one is turned about the long axis through the lesion.
    expect(dtsPlaneQuad(10)).toEqual(dtsPlaneQuad(10, 0))
    const [corner] = dtsPlaneQuad(0, -20)
    expect(corner[2]).toBeCloseTo(LESION_CENTER[2] - 70, 9)
    expect(Math.hypot(corner[0] - LESION_CENTER[0], corner[1] - LESION_CENTER[1])).toBeCloseTo(
      90,
      9,
    )
  })

  it('puts the tool tip at its depth along the beam at the arc’s centre', () => {
    expect(toolTipDepth(0)).toBe(DTS.toolPlaneRelativeMm)
    expect(toolTipDepth(-20)).toBeCloseTo(DTS.toolPlaneRelativeMm * Math.cos(Math.PI / 9), 9)
    expect(focusReading(Math.round(toolTipDepth(-20)), 30, -20)).toMatch(/^the tool is in focus/)
  })
})
