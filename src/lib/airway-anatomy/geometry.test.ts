import { ctIndexToLps, lpsToCtIndex, parseNrrdHeaderText, projectLpsToCanvas } from './geometry'
import type { CtPreviewAsset } from './types'

const ct: CtPreviewAsset = {
  sourceNrrd: 'target_clean_ct.nrrd',
  previewRaw: 'ct/target_clean_ct_preview_i16.raw',
  previewRawUrl: '/airway-anatomy/case-001/ct/target_clean_ct_preview_i16.raw',
  format: 'int16-raw',
  sizeXyz: [100, 80, 60],
  originalSizeXyz: [200, 160, 180],
  strideXyz: [2, 2, 3],
  spacingXyzMm: [2, 3, 4],
  originalSpacingXyzMm: [1, 1.5, 4 / 3],
  originLps: [10, 20, 30],
  directionLps: [0, 1, 0, 1, 0, 0, 0, 0, 1],
  space: 'left-posterior-superior',
  windowPresets: [],
}

describe('airway anatomy CT geometry', () => {
  it('parses NRRD header fields from target_clean_ct style metadata', () => {
    const header = parseNrrdHeaderText(`NRRD0004
type: short
dimension: 3
space: left-posterior-superior
sizes: 512 512 636
space directions: (0.689453125,0,0) (0,0.689453125,0) (0,0,0.5)
encoding: gzip
space origin: (-182.15527343749997,-374.15527343749989,-368.5)
`)

    expect(header.type).toBe('short')
    expect(header.sizes).toBe('512 512 636')
    expect(header['space origin']).toContain('-182.15527343749997')
  })

  it('converts LPS world points to IJK with spacing, origin, and direction', () => {
    const world = ctIndexToLps([4, 5, 6], ct)

    expect(world).toEqual([25, 28, 54])
    expect(lpsToCtIndex(world, ct)).toEqual([4, 5, 6])
  })

  it('projects a world point into the active CT canvas', () => {
    const projected = projectLpsToCanvas(ctIndexToLps([50, 20, 10], ct), 'axial', 10, ct, 100, 80)

    expect(projected.inFrame).toBe(true)
    expect(projected.x).toBeCloseTo(50.51, 2)
    expect(projected.y).toBeCloseTo(20.25, 2)
    expect(projected.distanceFromSlice).toBeCloseTo(0)
  })
})
