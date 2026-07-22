import type { CardiacCameraPreset, CardiacPoint3 } from '@/features/cardiac-anatomy/content/paths'

export interface CameraFitExtent {
  width: number
  height: number
  padding: number
}

export interface CameraFitViewport {
  width: number
  height: number
}

export interface FittedCardiacCameraPreset extends CardiacCameraPreset {
  position: CardiacPoint3
  maxDistance: number
}

/**
 * Animated CT-heart bounds in the normalized shared web frame, with enough room for the
 * transvalvular and right-sided support-device facsimiles. The fit is deliberately conservative:
 * the full anatomy should remain visible before a learner chooses to zoom in.
 */
export const MCS_HEART_CAMERA_FIT: CameraFitExtent = {
  width: 3.48,
  height: 4.29,
  padding: 1.08,
}

/** Includes the CT-registered extracardiac pump and inferior outflow-graft sweep. */
export const MCS_LVAD_CAMERA_FIT: CameraFitExtent = {
  width: 3.65,
  height: 5.4,
  padding: 1.12,
}

/** Re-centers the view on the union of the CT heart and the inferior extracardiac pump. */
export const MCS_LVAD_CAMERA_Y_SHIFT = -0.95

export function fitCardiacCameraToViewport(
  preset: CardiacCameraPreset,
  viewport: CameraFitViewport,
  extent: CameraFitExtent,
): FittedCardiacCameraPreset {
  const safeWidth = Math.max(1, viewport.width)
  const safeHeight = Math.max(1, viewport.height)
  const aspect = safeWidth / safeHeight
  const halfVerticalFovRadians = (preset.fov * Math.PI) / 360
  const verticalTangent = Math.tan(halfVerticalFovRadians)

  const distanceForHeight = (extent.height * extent.padding) / (2 * verticalTangent)
  const distanceForWidth = (extent.width * extent.padding) / (2 * verticalTangent * aspect)

  const [targetX, targetY, targetZ] = preset.target
  const offsetX = preset.position[0] - targetX
  const offsetY = preset.position[1] - targetY
  const offsetZ = preset.position[2] - targetZ
  const presetDistance = Math.hypot(offsetX, offsetY, offsetZ)
  const fittedDistance = Math.max(presetDistance, distanceForHeight, distanceForWidth)
  const distanceScale = fittedDistance / presetDistance

  return {
    ...preset,
    position: [
      targetX + offsetX * distanceScale,
      targetY + offsetY * distanceScale,
      targetZ + offsetZ * distanceScale,
    ],
    maxDistance: Math.max(preset.maxDistance, fittedDistance * 1.45),
  }
}
