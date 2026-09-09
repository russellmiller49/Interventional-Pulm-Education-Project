import { LESION_CENTER, SLICE_THICKNESS, windowRelationship, type Point3 } from '../../lib/physics'
import type { SuiteInputs } from './types'
import { add } from './suiteModel'
export function samplingPlanes(inputs: SuiteInputs) {
  const localTip: Point3 = [inputs.tipX, inputs.tipY, inputs.tipZ]
  const tip = add(LESION_CENTER, localTip)
  const localPoint = (plane: string, u: number, v: number, depth: number): Point3 =>
    plane === 'Axial' ? [u, v, depth] : plane === 'Coronal' ? [u, depth, v] : [depth, -u, v]
  return {
    localTip,
    tip,
    relationship: windowRelationship(localTip),
    shaftStart: add(tip, [-45, 0, 0]),
    windowStart: add(tip, [-14, 0, 0]),
    windowEnd: add(tip, [-6, 0, 0]),
    planes: (['Axial', 'Coronal', 'Sagittal'] as const).map((plane, i) => {
      const position = inputs.slab ? -9 : [inputs.axial, inputs.coronal, inputs.sagittal][i]
      return {
        plane,
        position,
        thickness: inputs.slab ? 102 : SLICE_THICKNESS,
        points: [
          [-27, -27],
          [27, -27],
          [27, 27],
          [-27, 27],
        ].map(([u, v]) => add(LESION_CENTER, localPoint(plane, u, v, position))),
      }
    }),
  }
}
