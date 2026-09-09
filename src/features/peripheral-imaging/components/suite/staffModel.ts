import { radians, type Point3 } from '../../lib/physics'
import type { SuiteInputs } from './types'
import { add, scale, suiteFrame } from './suiteModel'

/** Drawn floor contours: normalized distance trend, with an explicitly authored angular bias. */
export function staff(inputs: SuiteInputs) {
  const frame = suiteFrame(inputs.orbit, inputs.tilt, inputs.geometry)
  const floorY = -inputs.geometry.sod - inputs.geometry.field * 0.25
  const bearing = radians(35)
  const direction: Point3 = [Math.cos(bearing), 0, Math.sin(bearing)]
  const floorPoint = (radius: number, angle: number): Point3 => [
    radius * Math.cos(angle),
    floorY + 2,
    radius * Math.sin(angle),
  ]
  const barrierDistance = 1000
  const barrierHalfWidth = 350
  const shadowHalfAngle = Math.atan2(barrierHalfWidth, barrierDistance)
  const tubeWeight = (angle: number) =>
    1 + 0.5 * Math.max(0, -frame.normal[0] * Math.cos(angle) - frame.normal[2] * Math.sin(angle))
  const inShadow = (angle: number) => {
    const difference = Math.atan2(Math.sin(angle - bearing), Math.cos(angle - bearing))
    return inputs.barrier && Math.abs(difference) <= shadowHalfAngle
  }
  return {
    floorY,
    direction,
    bearing,
    position: add(scale(direction, inputs.staffDistanceM * 1000), [0, floorY, 0]),
    inverseSquareRatio: 1 / inputs.staffDistanceM ** 2,
    barrierCenter: add(scale(direction, barrierDistance), [0, floorY + 650, 0]),
    barrierWidth: barrierHalfWidth * 2,
    tubeWeight,
    rings: [1, 1.5, 2, 3].map((radiusM) => ({
      radiusM,
      relative: 1 / radiusM ** 2,
      segments: Array.from({ length: 120 }, (_, i) => {
        const a = (i / 120) * Math.PI * 2,
          b = ((i + 1) / 120) * Math.PI * 2
        const point = (angle: number) =>
          floorPoint(radiusM * 1000 * Math.sqrt(tubeWeight(angle)), angle)
        return { points: [point(a), point(b)] as [Point3, Point3], shadow: inShadow((a + b) / 2) }
      }),
    })),
    shadow: [
      floorPoint(barrierDistance, bearing - shadowHalfAngle),
      floorPoint(3800, bearing - shadowHalfAngle),
      floorPoint(3800, bearing + shadowHalfAngle),
      floorPoint(barrierDistance, bearing + shadowHalfAngle),
    ],
  }
}
