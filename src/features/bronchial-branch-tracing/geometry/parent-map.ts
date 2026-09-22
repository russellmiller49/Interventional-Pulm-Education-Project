import type { CtTrace } from '../content/ct-types'
import type { Vec3 } from './coordinates'
import { pairedScope } from './paired-scope'
import {
  cameraBasis,
  patientAxesInView,
  projectDirection,
  type AlongViewAxis,
  type CameraBasis,
  type ProjectedAxis,
} from './reference-frames'

const unit = (v: number[]) => {
  const n = Math.hypot(...v)
  return v.map((x) => x / (n || 1)) as Vec3
}

export interface ParentMapPoint {
  edgeId: number
  /** The source option label, e.g. "LB6 · more caudal daughter". */
  label: string
  /** Index of this daughter in the source decision, the same order as the CT answer labels. */
  sourceIndex: number
  /** The CT letter for this daughter (A, B, …), derived from `sourceIndex`, never from position. */
  letter: string
  /** Spatial numbering of the openings in this view, independent of the CT letter order. */
  number: number
  point: [number, number]
  x: number
  y: number
}
export interface ParentMap {
  parent: string
  points: ParentMapPoint[]
  /** Projected R, A and S where each lies usefully in the view plane (historical fields). */
  axes: { label: string; point: [number, number] }[]
  /** Every patient direction that lies in the view plane, both ends of each axis. */
  inPlane: ProjectedAxis[]
  /** Axes that run along the line of sight and therefore have no honest screen arrow. */
  alongView: AlongViewAxis[]
  /** The rendered camera basis this schematic and the paired view share. */
  basis: CameraBasis
  /** The declared reference up and forward vectors of the pose, for captions. */
  referenceUp: Vec3
  direction: Vec3
}

/** Orthographic direction schematic, using the same parent-camera basis as the paired view.
 * It is neither an ostium segmentation nor a perspective endoscopic projection. */
export function parentMap(trace: CtTrace, active = 0): ParentMap | null {
  const checkpoint = trace.checkpoints[active],
    decision = checkpoint.decision
  if (!decision) return null
  const pose = pairedScope(trace, checkpoint.slice, active, false)
  const basis = cameraBasis(pose.direction, pose.up)
  const project = (v: Vec3) => projectDirection(basis, v)
  const projected = decision.options.map((option, sourceIndex) => {
    const delta = unit(option.lps.map((x, axis) => x - decision.junctionLps[axis]))
    return {
      edgeId: option.sourceEdgeId,
      label: option.label,
      sourceIndex,
      letter: String.fromCharCode(65 + sourceIndex),
      point: project(delta),
    }
  })
  // Number the schematic spatially, independently of the CT daughter/answer order.
  const points = projected
    .sort((a, b) => a.point[1] - b.point[1] || a.point[0] - b.point[0])
    .map((point, i) => ({ ...point, number: i + 1 }))
  const scale = Math.max(0.1, ...points.map((p) => Math.hypot(...p.point)))
  const directions = patientAxesInView(basis)
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
    inPlane: directions.inPlane,
    alongView: directions.alongView,
    basis,
    referenceUp: pose.up,
    direction: pose.direction,
  }
}
