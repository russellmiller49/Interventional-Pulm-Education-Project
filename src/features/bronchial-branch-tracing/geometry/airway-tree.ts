import type { CtTrace } from '../content/ct-types'
import type { Vec3 } from './coordinates'
import offRoute from './off-route-children.json'
import routes from './paired-routes.json'
import { pairedPath } from './paired-scope'
import { arcNearest, sampleRoute } from './route-stations'

/**
 * The airway tree as a small frontal picture, for "where is the scope": every airway the routes
 * name, drawn from its centreline, with the stretch of route the scope has covered and the scope's
 * tip. It is a locator, not an anatomy figure: it names nothing and never draws the route ahead.
 *
 * Seen from the front: the patient's right is on the left of the picture and the head is at the
 * top, as a chest film or a coronal CT is shown. Patient space is LPS millimetres, so the picture's
 * x is the L coordinate and its y is the S coordinate turned over.
 */
export const treePoint = (point: readonly number[]): [number, number] => [point[0], -point[2]]

const fmt = (value: number) => Number(value.toFixed(1))
const pathOf = (points: readonly (readonly number[])[]) =>
  points
    .map((point, i) => {
      const [x, y] = treePoint(point)
      return `${i ? 'L' : 'M'}${fmt(x)} ${fmt(y)}`
    })
    .join(' ')

const radii = offRoute.radii as Record<string, number>

export interface TreeBranch {
  id: number
  /** SVG path of the centreline, in picture millimetres. */
  d: string
  /** The airway's radius in millimetres, where the source graph gives one. */
  radiusMm: number
}
export const TREE_BRANCHES: readonly TreeBranch[] = routes.edges.map((edge) => ({
  id: edge.id,
  d: pathOf(edge.points),
  radiusMm: radii[String(edge.id)] ?? 1.5,
}))

/** The picture's frame: every airway, with a margin for the widest line and the tip. */
export const TREE_BOX = (() => {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity
  for (const edge of routes.edges)
    for (const point of edge.points) {
      const [x, y] = treePoint(point)
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  const margin = 14
  return {
    x: fmt(minX - margin),
    y: fmt(minY - margin),
    width: fmt(maxX - minX + 2 * margin),
    height: fmt(maxY - minY + 2 * margin),
  }
})()

/**
 * The route from the top of the trachea to the point on it nearest the scope, as a path. A scope
 * that has turned into a branch that leads away is nearest the fork it left, so the path stops
 * there and the tip is drawn where the scope is.
 */
export function routeSoFar(trace: CtTrace, position: Vec3): { d: string; arc: number } {
  const { points, arcs } = pairedPath(trace)
  const arc = arcNearest(trace, position)
  const covered = points.filter((_, i) => arcs[i] <= arc)
  return { d: pathOf([...covered, sampleRoute(trace, arc)]), arc }
}
