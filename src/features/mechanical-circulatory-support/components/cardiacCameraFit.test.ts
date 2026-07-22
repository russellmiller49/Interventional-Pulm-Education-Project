import { CARDIAC_RIG } from '@/features/cardiac-anatomy/content/paths'

import {
  fitCardiacCameraToViewport,
  MCS_HEART_CAMERA_FIT,
  MCS_LVAD_CAMERA_FIT,
} from './cardiacCameraFit'

function cameraDistance(position: readonly number[], target: readonly number[]) {
  return Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2])
}

describe('MCS cardiac camera fitting', () => {
  const preset = CARDIAC_RIG.cameras.heart

  it('moves farther away as the anatomy viewport becomes more portrait-shaped', () => {
    const portrait = fitCardiacCameraToViewport(
      preset,
      { width: 360, height: 610 },
      MCS_HEART_CAMERA_FIT,
    )
    const square = fitCardiacCameraToViewport(
      preset,
      { width: 610, height: 610 },
      MCS_HEART_CAMERA_FIT,
    )
    const landscape = fitCardiacCameraToViewport(
      preset,
      { width: 1000, height: 520 },
      MCS_HEART_CAMERA_FIT,
    )

    const portraitDistance = cameraDistance(portrait.position, portrait.target)
    const squareDistance = cameraDistance(square.position, square.target)
    const landscapeDistance = cameraDistance(landscape.position, landscape.target)

    expect(portraitDistance).toBeGreaterThan(squareDistance)
    expect(squareDistance).toBeCloseTo(landscapeDistance, 5)
    expect(portraitDistance).toBeGreaterThan(cameraDistance(preset.position, preset.target) * 1.3)
    expect(portrait.maxDistance).toBeGreaterThan(portraitDistance)
  })

  it('preserves the authored viewing direction and never moves inside the authored preset', () => {
    const fitted = fitCardiacCameraToViewport(
      preset,
      { width: 430, height: 610 },
      MCS_HEART_CAMERA_FIT,
    )
    const presetDistance = cameraDistance(preset.position, preset.target)
    const fittedDistance = cameraDistance(fitted.position, fitted.target)

    expect(fitted.target).toEqual(preset.target)
    expect(fittedDistance).toBeGreaterThanOrEqual(presetDistance)
    expect((fitted.position[0] - fitted.target[0]) / fittedDistance).toBeCloseTo(
      (preset.position[0] - preset.target[0]) / presetDistance,
      8,
    )
    expect((fitted.position[1] - fitted.target[1]) / fittedDistance).toBeCloseTo(
      (preset.position[1] - preset.target[1]) / presetDistance,
      8,
    )
    expect((fitted.position[2] - fitted.target[2]) / fittedDistance).toBeCloseTo(
      (preset.position[2] - preset.target[2]) / presetDistance,
      8,
    )
  })

  it('reserves additional inferior framing for the extracardiac LVAD pump', () => {
    const viewport = { width: 610, height: 610 }
    const heart = fitCardiacCameraToViewport(preset, viewport, MCS_HEART_CAMERA_FIT)
    const lvad = fitCardiacCameraToViewport(preset, viewport, MCS_LVAD_CAMERA_FIT)

    expect(cameraDistance(lvad.position, lvad.target)).toBeGreaterThan(
      cameraDistance(heart.position, heart.target),
    )
  })
})
