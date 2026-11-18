import { ctIndexToLps, lpsToCtIndex } from './geometry'
import type { CtPreviewAsset, Vec3 } from './types'

/** At or below this opacity the CT plane is not drawn (the desktop slider's zero). */
export const CT_OVERLAY_HIDDEN_AT = 0.01
/**
 * What "CT overlay: on" shows in the headset when the desktop slider sits at zero: the module's
 * default, so switching the overlay on in VR always shows a plane.
 */
export const XR_CT_OVERLAY_DEFAULT_OPACITY = 0.28

/** The VR toggle starts where the desktop slider left the overlay. */
export function xrCtOverlayStartsOn(desktopOpacity: number): boolean {
  return desktopOpacity > CT_OVERLAY_HIDDEN_AT
}

/** The CT plane's opacity in the headset: hidden when off, the desktop setting when on. */
export function xrCtOverlayOpacity(on: boolean, desktopOpacity: number): number {
  if (!on) return 0
  return desktopOpacity > CT_OVERLAY_HIDDEN_AT ? desktopOpacity : XR_CT_OVERLAY_DEFAULT_OPACITY
}

export interface CtTipPlanePlacement {
  /** The axial slice the scope tip sits in. */
  sliceIndex: number
  /** The slice's centre in patient LPS mm, the same frame the airway surface is drawn in. */
  centerLps: Vec3
  widthMm: number
  heightMm: number
}

/**
 * The axial CT slice through the scope tip, placed in patient LPS millimetres. The VR scene draws it
 * inside the same group as the airway surface and the scope, so the slice stays registered to the
 * anatomy however the model is moved or grabbed.
 */
export function ctTipPlanePlacement(ct: CtPreviewAsset, tipLps: Vec3): CtTipPlanePlacement {
  const sliceIndex = Math.round(lpsToCtIndex(tipLps, ct)[2])
  return {
    sliceIndex,
    centerLps: ctIndexToLps([(ct.sizeXyz[0] - 1) / 2, (ct.sizeXyz[1] - 1) / 2, sliceIndex], ct),
    widthMm: (ct.sizeXyz[0] - 1) * ct.spacingXyzMm[0],
    heightMm: (ct.sizeXyz[1] - 1) * ct.spacingXyzMm[1],
  }
}
