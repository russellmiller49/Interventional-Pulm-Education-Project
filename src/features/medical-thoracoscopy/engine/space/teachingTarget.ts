import type { PivotHandDirection, ScopePose } from '../../components/space/types'
import { toolContact, type ToolContact } from '../../content/anatomy'
import type { PleuralZoneId } from '../../content/pleuralZones'
import type { TriangleMesh } from './spatial/proxyGlb'
import { add, normalize, scale, type Vec3 } from './vec'
import { reachIdentity } from './zoneReach'

/**
 * The contact spike's one teaching target (plan, section 4.7): an illustrative nodule on the costal
 * pleura, a sphere given by its centre and radius and made here as a closed, outward mesh, so that
 * the collider and the view meet it as they meet any proxy. It is a target for the contact table,
 * not a finding: nothing about its size, its look or where it sits is a clinical statement.
 *
 * The plan puts it on the costal pleura. With the lung the model has now, the lung lies in front of
 * every line the port allows, so nothing on the chest wall can be reached along the telescope, and
 * the script sets it on the lung's surface instead; the record says which.
 *
 * Where it sits, and the two places the spike starts from, were computed offline by
 * `scripts/medical-thoracoscopy/build-tool-contact.ts` from the proxies and recorded with the
 * snapshot they were computed for. As with reach, the record is used only while that snapshot is the
 * one the engine would compute it for now; otherwise the spike has nothing to show.
 */
export interface TeachingTarget {
  readonly centre: Vec3
  readonly radiusMm: number
  readonly mesh: TriangleMesh
}

/** How finely the nodule's sphere is made: an icosahedron split twice, 320 triangles. */
export const NODULE_SUBDIVISIONS = 2

/** A sphere as a closed, outward triangle mesh: an icosahedron, each face split in four, `levels` times. */
export function icosphereMesh(
  centre: Vec3,
  radiusMm: number,
  levels = NODULE_SUBDIVISIONS,
): TriangleMesh {
  const t = (1 + Math.sqrt(5)) / 2
  const points: Vec3[] = (
    [
      [-1, t, 0],
      [1, t, 0],
      [-1, -t, 0],
      [1, -t, 0],
      [0, -1, t],
      [0, 1, t],
      [0, -1, -t],
      [0, 1, -t],
      [t, 0, -1],
      [t, 0, 1],
      [-t, 0, -1],
      [-t, 0, 1],
    ] as const
  ).map((p) => normalize(p))
  let faces: [number, number, number][] = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ]
  for (let level = 0; level < levels; level += 1) {
    const middles = new Map<string, number>()
    const middle = (a: number, b: number) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`
      const found = middles.get(key)
      if (found !== undefined) return found
      points.push(normalize(scale(add(points[a], points[b]), 0.5)))
      middles.set(key, points.length - 1)
      return points.length - 1
    }
    faces = faces.flatMap(([a, b, c]): [number, number, number][] => {
      const ab = middle(a, b)
      const bc = middle(b, c)
      const ca = middle(c, a)
      return [
        [a, ab, ca],
        [b, bc, ab],
        [c, ca, bc],
        [ab, bc, ca],
      ]
    })
  }
  return {
    positions: Float32Array.from(points.flatMap((p) => add(centre, scale(p, radiusMm)))),
    indices: Uint32Array.from(faces.flat()),
  }
}

export function teachingTarget(centre: Vec3, radiusMm: number): TeachingTarget {
  return { centre, radiusMm, mesh: icosphereMesh(centre, radiusMm) }
}

/** A place the spike starts from: the telescope's pose, with the forceps in the channel. */
export interface ToolContactPlace {
  readonly id: 'facing-the-nodule' | 'beside-the-lung'
  readonly pose: ScopePose
  readonly lungStep: number
}

export interface CurrentToolContact {
  readonly nodule: {
    /**
     * The costal pleura, as the plan has it; or the lung's surface, where the lung lies in front of
     * every line the port allows, as it does with the lung the model has now (MT-C-0002).
     */
    readonly on: 'costal-pleura' | 'lung-surface'
    readonly zone: PleuralZoneId | null
    readonly centre: Vec3
    readonly radiusMm: number
  }
  readonly places: readonly ToolContactPlace[]
  /** Beside the lung, the way of the hand that sweeps the forceps into it. */
  readonly towardTheLung: PivotHandDirection
  /** The scenario's name for the target, for the snapshot's geometry. */
  readonly geometry: string
}

/** The spike's record, if it was computed for the snapshot the engine would compute it for now. */
export function currentToolContact(record: ToolContact = toolContact): CurrentToolContact | null {
  const now = reachIdentity(record.lungStep)
  const parts = Object.keys(now) as (keyof typeof now)[]
  if (!parts.every((part) => now[part] === record.computedFor[part])) return null
  const { centre, radiusMm, zone, on } = record.nodule
  return {
    nodule: { on, zone, centre: [centre[0], centre[1], centre[2]], radiusMm },
    places: record.places.map((place) => ({
      id: place.id,
      pose: place.pose,
      lungStep: record.lungStep,
    })),
    towardTheLung: record.towardTheLung,
    geometry: `nodule ${centre.map((value) => value.toFixed(2)).join(' ')} r ${radiusMm}`,
  }
}
