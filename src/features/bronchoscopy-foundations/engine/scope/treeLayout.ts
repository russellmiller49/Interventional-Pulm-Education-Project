import { sampleEdgePose } from '@/lib/airway-anatomy/scope-state'
import type { AirwayGraph, Vec3 } from '@/lib/airway-anatomy/types'

import type { AirwayLabel, AirwayMapGeometry } from '../../components/scope/types'

/**
 * The airway map: the teaching graph's centerlines in coronal projection, drawn once per case as
 * SVG and lit per step. The projection reads like a coronal CT — the patient's right on the
 * viewer's left, superior at the top — so the map and the CT slices in the course agree.
 */

const MAX_POINTS_PER_EDGE = 40
const PADDING_MM = 12
/** Where along an airway's first segment its pin sits. */
const PIN_FRACTION = 0.45

export function projectCoronal(point: Vec3): readonly [number, number] {
  // LPS: +x is the patient's left, which a coronal image shows on the viewer's right; +z is superior.
  return [point[0], -point[2]]
}

function simplify(points: readonly Vec3[]): readonly Vec3[] {
  if (points.length <= MAX_POINTS_PER_EDGE) return points
  const stride = (points.length - 1) / (MAX_POINTS_PER_EDGE - 1)
  return Array.from({ length: MAX_POINTS_PER_EDGE }, (_, i) => points[Math.round(i * stride)])
}

const fixed = (value: number) => (Math.round(value * 10) / 10).toString()

export function buildAirwayMap(
  graph: AirwayGraph,
  labelAt: (edgeId: number) => AirwayLabel | null,
  originEdge: ReadonlyMap<AirwayLabel, number>,
): AirwayMapGeometry {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  const paths = graph.edges.map((edge) => {
    const points = simplify(edge.pointsLps).map(projectCoronal)
    for (const [x, y] of points) {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
    return {
      label: labelAt(edge.id),
      d: points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${fixed(x)} ${fixed(y)}`).join(' '),
      widthMm: Math.max(1.2, (edge.radiusMm ?? 1.5) * 2),
    }
  })
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]))
  const pins: Partial<Record<AirwayLabel, readonly [number, number]>> = {}
  for (const [label, edgeId] of originEdge) {
    const edge = edges.get(edgeId)
    if (!edge) continue
    pins[label] = projectCoronal(sampleEdgePose(edge, edge.lengthMm * PIN_FRACTION).point)
  }
  if (!Number.isFinite(minX)) return { viewBox: [0, 0, 1, 1], paths, pins, project: projectCoronal }
  return {
    viewBox: [
      minX - PADDING_MM,
      minY - PADDING_MM,
      maxX - minX + 2 * PADDING_MM,
      maxY - minY + 2 * PADDING_MM,
    ],
    paths,
    pins,
    project: projectCoronal,
  }
}
