import type { CtTrace } from '../content/ct-types'
import type { Vec3 } from './coordinates'
import { pairedScope } from './paired-scope'

const unit = (v: number[]) => {
  const n = Math.hypot(...v)
  return v.map((x) => x / (n || 1)) as Vec3
}
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const dot = (a: number[], b: number[]) => a.reduce((n, v, i) => n + v * b[i], 0)

/** Orthographic direction schematic, using the same parent-camera basis as the paired view.
 * It is neither an ostium segmentation nor a perspective endoscopic projection. */
export function parentMap(trace: CtTrace, active = 0) {
  const checkpoint = trace.checkpoints[active],
    decision = checkpoint.decision
  if (!decision) return null
  const pose = pairedScope(trace, checkpoint.slice, active, false)
  const forward = unit(pose.direction),
    right = unit(cross(forward, pose.up)),
    up = unit(cross(right, forward))
  const project = (v: Vec3) => [dot(v, right), -dot(v, up)] as [number, number]
  const projected = decision.options.map((option, sourceIndex) => {
    const delta = unit(option.lps.map((x, axis) => x - decision.junctionLps[axis]))
    return {
      edgeId: option.sourceEdgeId,
      label: option.label,
      sourceIndex,
      point: project(delta),
    }
  })
  // Number the schematic spatially, independently of the CT daughter/answer order.
  const points = projected
    .sort((a, b) => a.point[1] - b.point[1] || a.point[0] - b.point[0])
    .map((point, i) => ({ ...point, number: i + 1 }))
  const scale = Math.max(0.1, ...points.map((p) => Math.hypot(...p.point)))
  return {
    parent: decision.parent.airway.code,
    points: points.map((p) => ({
      ...p,
      x: 100 + (p.point[0] / scale) * 62,
      y: 100 + (p.point[1] / scale) * 62,
    })),
    axes: (
      [
        ['R', [-1, 0, 0]],
        ['A', [0, -1, 0]],
        ['S', [0, 0, 1]],
      ] as [string, Vec3][]
    )
      .map(([label, vector]) => ({ label, point: project(vector) }))
      .filter((a) => Math.hypot(...a.point) > 0.3),
  }
}
