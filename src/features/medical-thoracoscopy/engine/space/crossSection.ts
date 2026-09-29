import type { CrossSection, PlanePoint, ScopePose } from '../../components/space/types'
import type { PleuralZoneId } from '../../content/pleuralZones'
import { scopeGeometry } from './fulcrum'
import type { LoadedSpace } from './loadSpace'
import type { TriangleMesh } from './spatial/proxyGlb'
import { CROSS_SECTION_SEEN_FROM } from './spaceWords'
import { add, cross, dot, length, normalize, radians, rotate, scale, sub, type Vec3 } from './vec'

/**
 * The cut the pane without WebGL draws (slice 9): the plane through the pivot that holds the
 * telescope's axis and the direction toward the head, drawn as the Chest view is seen, from the
 * patient's front with the head to the right, the patient's right side up. The wall is the space
 * proxy cut by the plane, run by run in the zone of each triangle; the lung is the lung proxy of the
 * current step cut the same way. Computed from the geometry the engine uses for everything else.
 */
interface Plane {
  readonly origin: Vec3
  readonly normal: Vec3
  /** On the screen: to the right (toward the head) and up (toward the patient's right). */
  readonly right: Vec3
  readonly up: Vec3
}

function planeFor(space: LoadedSpace, pose: ScopePose): Plane {
  const { port } = space
  const axis = scopeGeometry(pose, port, space.device).axis
  let normal = cross(axis, port.acrossRibs)
  if (length(normal) < 1e-6) normal = cross(axis, port.alongRibs)
  normal = normalize(normal)
  const right = normalize(sub(port.acrossRibs, scale(normal, dot(port.acrossRibs, normal))))
  let up = cross(normal, right)
  if (dot(up, port.inward) > 0) {
    up = scale(up, -1)
    normal = scale(normal, -1)
  }
  return { origin: port.pivot, normal, right, up }
}

const project = (plane: Plane, p: Vec3): PlanePoint => {
  const d = sub(p, plane.origin)
  return [Math.round(dot(d, plane.right) * 100) / 100, Math.round(dot(d, plane.up) * 100) / 100]
}

/** The segments where a mesh meets the plane, each with the triangle it came from. */
function cut(
  mesh: TriangleMesh,
  plane: Plane,
): { readonly a: Vec3; readonly b: Vec3; readonly triangle: number }[] {
  const { positions, indices } = mesh
  const out: { a: Vec3; b: Vec3; triangle: number }[] = []
  const vertex = (i: number): Vec3 => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]
  for (let f = 0; f < indices.length; f += 3) {
    const v = [vertex(indices[f]), vertex(indices[f + 1]), vertex(indices[f + 2])]
    const s = v
      .map((p) => dot(sub(p, plane.origin), plane.normal))
      .map((x) => (x === 0 ? 1e-12 : x))
    const points: Vec3[] = []
    for (let k = 0; k < 3; k += 1) {
      const j = (k + 1) % 3
      if (s[k] > 0 !== s[j] > 0)
        points.push(add(v[k], scale(sub(v[j], v[k]), s[k] / (s[k] - s[j]))))
    }
    if (points.length === 2) out.push({ a: points[0], b: points[1], triangle: f / 3 })
  }
  return out
}

/** Join segments that share ends into runs, open or closed. */
function chain(segments: readonly (readonly [PlanePoint, PlanePoint])[]): PlanePoint[][] {
  const key = (p: PlanePoint) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`
  const byEnd = new Map<string, number[]>()
  segments.forEach(([a, b], index) => {
    for (const p of [a, b]) byEnd.set(key(p), [...(byEnd.get(key(p)) ?? []), index])
  })
  const used = new Set<number>()
  const runs: PlanePoint[][] = []
  for (let start = 0; start < segments.length; start += 1) {
    if (used.has(start)) continue
    used.add(start)
    const run: PlanePoint[] = [segments[start][0], segments[start][1]]
    for (const forward of [true, false]) {
      for (;;) {
        const end = forward ? run[run.length - 1] : run[0]
        const next = (byEnd.get(key(end)) ?? []).find((index) => !used.has(index))
        if (next === undefined) break
        used.add(next)
        const [a, b] = segments[next]
        const other = key(a) === key(end) ? b : a
        if (forward) run.push(other)
        else run.unshift(other)
      }
    }
    runs.push(run)
  }
  return runs
}

export function crossSectionOf(
  space: LoadedSpace,
  pose: ScopePose,
  lungStep: number,
): CrossSection {
  const plane = planeFor(space, pose)
  const geometry = scopeGeometry(pose, space.port, space.device)
  const byZone = new Map<PleuralZoneId, [PlanePoint, PlanePoint][]>()
  for (const segment of cut(space.world.space, plane)) {
    const zone = space.triangleZones[segment.triangle]
    byZone.set(zone, [
      ...(byZone.get(zone) ?? []),
      [project(plane, segment.a), project(plane, segment.b)],
    ])
  }
  const wall = [...byZone.entries()].flatMap(([zone, segments]) =>
    chain(segments).map((points) => ({ zone, points })),
  )
  const lung = chain(
    cut(space.world.lung(lungStep), plane).map(
      (s) => [project(plane, s.a), project(plane, s.b)] as [PlanePoint, PlanePoint],
    ),
  )
  const half = radians(space.device.fieldOfViewDeg / 2)
  const edge = (sign: number) =>
    project(
      plane,
      add(
        geometry.camera.origin,
        scale(rotate(geometry.axis, plane.normal, sign * half), space.device.viewRangeMm),
      ),
    )
  return {
    wall,
    lung,
    port: project(plane, space.port.pivot),
    tip: project(plane, geometry.tip),
    field: [edge(-1), edge(1)],
    seenFrom: CROSS_SECTION_SEEN_FROM,
  }
}
