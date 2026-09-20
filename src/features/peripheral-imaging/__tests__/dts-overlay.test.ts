/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { DTS_PLANE, DTS_TOOL_MM, dtsOverlayObjects } from '../components/suite/dtsModel'
import { DTS } from '../lib/tomosynthesis'

/*
 * Report 4.2 (fellow walkthrough, PDF p.33/p.38): the reconstructed plane had no mark for the tool
 * or the target. The optional overlay draws where the MODEL put them, so these tests hold it to the
 * model's own sources and to the rule that an object the plane misses is never drawn as found.
 */
describe('the DTS teaching overlay', () => {
  it('takes the tool from the literal the generator drew it with', () => {
    const generator = readFileSync(
      path.join(process.cwd(), 'scripts/peripheral-imaging/build-dts-projections.py'),
      'utf8',
    )
    // tool = clip(1.8 - sqrt((y+18)^2 + z^2)) * ((x >= -60) & (x <= 0)), relative to the target.
    expect(generator).toContain('np.clip(1.8-np.sqrt((y+18)**2+z*z), 0, 1) * ((x>=-60)&(x<=0))')
    expect(generator).toContain("'toolPlaneRelativeMm': -18")
    expect(DTS_TOOL_MM).toEqual({ start: -60, end: 0, radius: 1.8 })
    expect(DTS.toolPlaneRelativeMm).toBe(-18)
    expect(DTS.authoredNodule.centerMm).toEqual(DTS.targetCenterMm)
  })

  it('uses the same plane geometry as the reconstruction it annotates', () => {
    const reconstruction = readFileSync(
      path.join(process.cwd(), 'src/features/peripheral-imaging/lib/tomosynthesis.ts'),
      'utf8',
    )
    expect(reconstruction).toContain('DTS.targetCenterMm[0] - 20 + ((col - size / 2) * 140) / size')
    expect(reconstruction).toContain('DTS.targetCenterMm[2] + ((size / 2 - row) * 140) / size')
    expect(DTS_PLANE).toEqual({ spanMm: 140, centreOffsetMm: -20, sizePx: 256 })
  })

  it('places the target on its own centre and the tool ending at it', () => {
    const [tool, target] = dtsOverlayObjects(0)
    const pxPerMm = 256 / 140
    const centreCol = 128 + 20 * pxPerMm
    expect(target.box.x + target.box.w / 2).toBeCloseTo(centreCol, 5)
    expect(target.box.y + target.box.h / 2).toBeCloseTo(128, 5)
    expect(target.box.w).toBeCloseTo(18 * pxPerMm, 5)
    expect(tool.box.x + tool.box.w).toBeCloseTo(centreCol, 5)
    expect(tool.box.w).toBeCloseTo(60 * pxPerMm, 5)
    expect(tool.box.y + tool.box.h / 2).toBeCloseTo(128, 5)
  })

  it('draws an object as in the plane only where the plane passes through it', () => {
    const at = (plane: number) =>
      Object.fromEntries(dtsOverlayObjects(plane).map((object) => [object.id, object]))
    expect(at(-18).tool.inPlane).toBe(true)
    expect(at(-18).target.inPlane).toBe(false)
    expect(at(-18).target.fromPlaneMm).toBe(18)
    expect(at(0).target.inPlane).toBe(true)
    expect(at(0).tool.inPlane).toBe(false)
    expect(at(0).tool.fromPlaneMm).toBe(-18)
    // The 9 mm sphere: the plane 8 mm away still cuts it, the plane 9 mm away does not.
    expect(at(8).target.inPlane).toBe(true)
    expect(at(9).target.inPlane).toBe(false)
    // The 1.8 mm tool: one slider step away is already out of plane.
    expect(at(-17).tool.inPlane).toBe(true)
    expect(at(-16).tool.inPlane).toBe(false)
    expect(at(20).tool.inPlane).toBe(false)
    expect(at(20).target.inPlane).toBe(false)
  })
})
