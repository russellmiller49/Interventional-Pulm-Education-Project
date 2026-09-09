import { kapGyCm2, type Point3 } from '../../lib/physics'
import type { SuiteInputs } from './types'
import type { RayProfile } from '../../lib/rayProfile'
import { add, scale, suiteFrame } from './suiteModel'

/** Free-air inverse-square transport between two defined planes, without tissue-dose inference. */
export function dosePlanes(inputs: SuiteInputs, profile?: RayProfile | null) {
  const frame = suiteFrame(inputs.orbit, inputs.tilt, inputs.geometry)
  const chosenDistance = inputs.geometry.sod
  const afterBladesDistance = inputs.geometry.sod * 0.1 + 16
  const plane = (distance: number, label: string) => {
    const ratio = distance / chosenDistance
    const areaCm2 = inputs.areaCm2 * ratio ** 2
    const kermaMgy = inputs.kermaMgy / ratio ** 2
    const center = add(frame.source, scale(frame.normal, distance))
    const halfSideMm = Math.sqrt(areaCm2 * 100) / 2
    const points = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([u, v]) =>
      add(center, add(scale(frame.u, u * halfSideMm), scale(frame.v, v * halfSideMm))),
    )
    return {
      label,
      distance,
      center,
      points,
      areaCm2,
      kermaMgy,
      kapGyCm2: kapGyCm2(kermaMgy, areaCm2),
    }
  }
  // First non-air sample on the central beam ray: quantized CT envelope, not measured skin.
  const skinEntry = profile?.segments.find((segment) => segment.tissue !== 'air')?.start ?? null
  const aperture = plane(inputs.geometry.sod * 0.1, 'Blade aperture')
  const half = Math.sqrt(aperture.areaCm2 * 100) / 2,
    outer = inputs.geometry.field * 0.06
  const apertureBlades = [
    [-outer, -outer, -half, outer],
    [half, -outer, outer, outer],
    [-half, -outer, half, -half],
    [-half, half, half, outer],
  ].map(([left, bottom, right, top]) =>
    [
      [left, bottom],
      [right, bottom],
      [right, top],
      [left, top],
    ].map(([u, v]) => add(aperture.center, add(scale(frame.u, u), scale(frame.v, v)))),
  )
  return {
    frame,
    apertureBlades,
    planes: [
      plane(afterBladesDistance, 'After the blades'),
      plane(chosenDistance, 'Chosen input plane'),
    ],
    reference: add(frame.iso, scale(frame.normal, -150)),
    referenceOffsetMm: 150,
    skinEntry: skinEntry as Point3 | null,
    fieldPercent:
      (Math.sqrt(inputs.areaCm2 * 100) /
        ((inputs.geometry.field * inputs.geometry.sod) / inputs.geometry.sid)) *
      100,
  }
}
