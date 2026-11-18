import { lpsToCtIndex } from './geometry'
import type { CtPreviewAsset, Vec3 } from './types'
import {
  ctTipPlanePlacement,
  XR_CT_OVERLAY_DEFAULT_OPACITY,
  xrCtOverlayOpacity,
  xrCtOverlayStartsOn,
} from './xr-ct-overlay'

/** The case-001 CT preview grid (256 × 256 × 212, 1.38 × 1.38 × 1.5 mm, identity direction). */
const CT: CtPreviewAsset = {
  sourceNrrd: 'target_clean_ct.nrrd',
  previewRaw: 'ct/target_clean_ct_preview_i16.raw',
  previewRawUrl: '/airway-anatomy/case-001/ct/target_clean_ct_preview_i16.raw',
  format: 'int16-raw',
  sizeXyz: [256, 256, 212],
  originalSizeXyz: [512, 512, 636],
  strideXyz: [2, 2, 3],
  spacingXyzMm: [1.37890625, 1.37890625, 1.5],
  originalSpacingXyzMm: [0.689453125, 0.689453125, 0.5],
  originLps: [-182.15527343749997, -374.1552734374999, -368.5],
  directionLps: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  space: 'left-posterior-superior',
  windowPresets: [{ id: 'lung', label: 'Lung', low: -1000, high: -300 }],
}

describe('VR CT overlay switch', () => {
  it('starts where the desktop slider left the plane', () => {
    expect(xrCtOverlayStartsOn(0.28)).toBe(true)
    expect(xrCtOverlayStartsOn(0)).toBe(false)
  })

  it('hides the plane when off and uses the desktop opacity when on', () => {
    expect(xrCtOverlayOpacity(false, 0.4)).toBe(0)
    expect(xrCtOverlayOpacity(true, 0.4)).toBe(0.4)
  })

  it('shows a plane when switched on in VR even if the desktop slider is at zero', () => {
    expect(xrCtOverlayOpacity(true, 0)).toBe(XR_CT_OVERLAY_DEFAULT_OPACITY)
    expect(xrCtOverlayOpacity(true, 0)).toBeGreaterThan(0.01)
  })

  it('toggles off and back on to the same opacity', () => {
    let on = xrCtOverlayStartsOn(0.35)
    const before = xrCtOverlayOpacity(on, 0.35)
    on = !on
    expect(xrCtOverlayOpacity(on, 0.35)).toBe(0)
    on = !on
    expect(xrCtOverlayOpacity(on, 0.35)).toBe(before)
  })
})

describe('ctTipPlanePlacement', () => {
  const tips: Vec3[] = [
    [-2.4, -160.2, -120.7], // mid trachea
    [14.9, -150.3, -190.0], // left mainstem
    [-30.1, -140.8, -230.25], // right lower lobe
  ]

  it.each(tips)('puts the axial slice through the scope tip at %p', (...tip) => {
    const placement = ctTipPlanePlacement(CT, tip as Vec3)
    // The slice lies within half a slice of the tip, in the same LPS frame as the airway surface.
    expect(Math.abs(placement.centerLps[2] - tip[2])).toBeLessThanOrEqual(
      CT.spacingXyzMm[2] / 2 + 1e-9,
    )
    expect(placement.sliceIndex).toBe(Math.round(lpsToCtIndex(tip as Vec3, CT)[2]))
  })

  it('centres the slice on the CT volume and spans it', () => {
    const placement = ctTipPlanePlacement(CT, tips[0])
    const centreX = CT.originLps[0] + ((CT.sizeXyz[0] - 1) / 2) * CT.spacingXyzMm[0]
    const centreY = CT.originLps[1] + ((CT.sizeXyz[1] - 1) / 2) * CT.spacingXyzMm[1]
    expect(placement.centerLps[0]).toBeCloseTo(centreX, 6)
    expect(placement.centerLps[1]).toBeCloseTo(centreY, 6)
    expect(placement.widthMm).toBeCloseTo(255 * CT.spacingXyzMm[0], 6)
    expect(placement.heightMm).toBeCloseTo(255 * CT.spacingXyzMm[1], 6)
  })

  it('moves the slice with the tip when the scope advances caudally', () => {
    const upper = ctTipPlanePlacement(CT, [0, -160, -120])
    const lower = ctTipPlanePlacement(CT, [0, -160, -150])
    // 30 mm caudal at 1.5 mm per slice is 20 slices down (slice indices run superior from the
    // inferior origin), and the slice is still the one the tip sits in.
    expect(lower.sliceIndex).toBe(upper.sliceIndex - 20)
    expect(Math.abs(lower.centerLps[2] - -150)).toBeLessThanOrEqual(CT.spacingXyzMm[2] / 2)
  })
})
