import { LESION_CENTER, toolTipForDepth, type Point3 } from '../../lib/physics'
import type { SuiteInputs } from './types'
import { add, rayThrough, suiteFrame } from './suiteModel'

/** Same rigid-translation convention as the existing registration projection. */
export function registration(inputs: SuiteInputs) {
  const currentOffset: Point3 = [0, 0, -inputs.displacement]
  const storedOffset: Point3 = [0, 0, -inputs.storedDisplacement]
  const currentTarget = add(LESION_CENTER, currentOffset)
  const storedTarget = add(LESION_CENTER, storedOffset)
  const frame = suiteFrame(inputs.orbit, inputs.tilt, inputs.geometry)
  return {
    currentOffset,
    storedOffset,
    currentTarget,
    storedTarget,
    currentProjection: rayThrough(frame, currentTarget),
    storedProjection: rayThrough(frame, storedTarget),
    toolTip: toolTipForDepth(inputs.toolDepth),
    stale: inputs.displacement !== inputs.storedDisplacement,
  }
}
