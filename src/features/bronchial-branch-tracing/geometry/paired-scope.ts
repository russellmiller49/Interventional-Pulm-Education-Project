import routes from './paired-routes.json'
import type { CtTrace } from '../content/ct-types'
import type { Vec3 } from './coordinates'

const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(...a.map((v, i) => v - b[i]))
const edges = new Map(routes.edges.map((e) => [e.id, e.points]))
const cache = new Map<string, { points: Vec3[]; arcs: number[]; segmentEdges: number[] }>()
/** One route as a single polyline from the top of the trachea, with arc lengths. */
export function pairedPath(trace: CtTrace) {
  const known = cache.get(trace.id)
  if (known) return known
  const points: Vec3[] = []
  const segmentEdges: number[] = []
  for (const id of trace.sourceEdgeIds) {
    const edge = edges.get(id)
    if (!edge) throw new Error(`Missing paired airway edge ${id}`)
    for (const point of edge) {
      if (!points.length || distance(points[points.length - 1], point) > 0.0001) {
        points.push(point as Vec3)
        segmentEdges.push(id)
      }
    }
  }
  const arcs = [0]
  for (let i = 1; i < points.length; i++)
    arcs.push(arcs[i - 1] + distance(points[i - 1], points[i]))
  const path = { points, arcs, segmentEdges }
  cache.set(trace.id, path)
  return path
}
