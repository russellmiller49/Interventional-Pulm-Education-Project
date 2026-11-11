import * as THREE from 'three'
import type { Vec3 } from '@/lib/airway-anatomy/types'
import { MUCOSA_ANATOMY_ATTRIBUTE } from '@/lib/bronchoscopy-core/mucosa'
import type { ScopeCase } from '../../engine/scope/scopeCase'
import type { AirwayLabel } from './types'

/**
 * Where each vertex of the teaching lumen sits on its airway, so the mucosa shader can draw the
 * wall's anatomy: the cartilage rings on the anterior arc and the membranous wall behind.
 *
 * The lumen is one CT-derived surface with positions and normals only, and its file is pinned by
 * checksum, so nothing is baked into it. This is worked out once when the scene loads, from the
 * teaching centerlines: every vertex is given to the airway whose centerline it is nearest to (in
 * units of that airway's radius, so a small branch does not claim its parent's wall), and four
 * numbers are written for it. See `MUCOSA_ANATOMY_ATTRIBUTE` for their order.
 *
 * The search runs over a coarse grid, not every vertex against every centerline: about 100,000
 * vertices take 50 to 90 ms in a browser (measured in headless Chromium, 2026-11-10).
 *
 * Coordinates are patient LPS millimetres, so anatomical posterior is +Y.
 */

export interface LumenWallAirway {
  readonly edgeId: number
  readonly parentEdgeId: number | null
  readonly pointsLps: readonly Vec3[]
  readonly radiusMm: number
  /** How far apart the cartilage rings are drawn along this airway. */
  readonly ringPitchMm: number
  /** The wall cue at the airway's two ends, 0 to 1; it runs evenly between them. */
  readonly cueStart: number
  readonly cueEnd: number
  /**
   * A first stretch of the airway with no rings and no membranous strip: none up to this distance
   * from its start, rising to full over the next `PLAIN_START_RISE_MM`. The trachea has one, for
   * the subglottis: the cricoid is a complete ring, with no open back. The wall there keeps its
   * vessels and its sheen, so a tip bent at it still has something to read.
   */
  readonly plainStartMm?: number
}

/** How far the rings take to come in after an airway's plain first stretch. */
const PLAIN_START_RISE_MM = 10

export interface LumenWallOptions {
  /** Anatomical posterior in the lumen's coordinates. LPS: +Y. */
  readonly posterior?: Vec3
}

const POSTERIOR_LPS: Vec3 = [0, 1, 0]
/** Grid cell for the nearest-centerline search; about one tracheal radius. */
const CELL_MM = 8
/** The centerline is resampled this finely before it is smoothed. */
const RESAMPLE_MM = 1.5
/** A point past an airway's end counts this much farther from it than a point beside it. */
const PAST_END_WEIGHT = 2
/** One vertex in this many is used to measure how far each airway's wall is from its centerline. */
const RADIUS_SAMPLE_STRIDE = 7

const smoothstep = (low: number, high: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)))
  return t * t * (3 - 2 * t)
}

/**
 * The centerline the wall is measured against: the reviewed one, resampled evenly and averaged
 * over about the airway's own radius, its two ends held where they are.
 *
 * The reviewed centerline follows the CT voxel by voxel and turns by tens of degrees at single
 * points. Rings are drawn square to the centerline, so drawn against the raw line they would fan
 * and fold at each of those points; a real ring sits square to the airway as a whole.
 */
export function smoothCenterline(points: readonly Vec3[], radiusMm: number): Vec3[] {
  if (points.length < 3) return points.map((point) => [...point] as Vec3)
  const arc = [0]
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    arc.push(arc[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]))
  }
  const total = arc[arc.length - 1]
  const count = Math.max(2, Math.round(total / RESAMPLE_MM) + 1)
  let line: Vec3[] = []
  let segment = 1
  for (let i = 0; i < count; i += 1) {
    const at = (total * i) / (count - 1)
    while (segment < points.length - 1 && arc[segment] < at) segment += 1
    const span = arc[segment] - arc[segment - 1]
    const f = span > 1e-9 ? (at - arc[segment - 1]) / span : 0
    const a = points[segment - 1]
    const b = points[segment]
    line.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f])
  }
  const reach = Math.max(1, Math.round((1.2 * radiusMm * (count - 1)) / Math.max(total, 1e-6)))
  for (let pass = 0; pass < 2; pass += 1) {
    const source = line
    line = source.map((_, i) => {
      // The window narrows toward each end, so the ends themselves do not move.
      const half = Math.min(reach, i, source.length - 1 - i)
      const sum: Vec3 = [0, 0, 0]
      for (let j = i - half; j <= i + half; j += 1)
        for (let k = 0; k < 3; k += 1) sum[k] += source[j][k]
      return [sum[0] / (2 * half + 1), sum[1] / (2 * half + 1), sum[2] / (2 * half + 1)]
    })
  }
  return line
}

/**
 * The four numbers per vertex, in the order the shader reads them:
 * `cos * cue`, `sin * cue`, ring strength, ring count.
 *
 * - The angle is measured around the airway from anatomical posterior, in the plane across the
 *   centerline; positive sine is the patient's left in the trachea. Both parts are kept so there
 *   is no seam where the angle wraps, and they are scaled by the airway's cue (1 in the central
 *   airways, falling to 0 through the lobar airways), which the shader reads back as their length.
 * - Ring strength is that cue again, faded where two airways would each count this piece of wall
 *   differently (the spur of a division, the rim of an opening) and where the airway runs so
 *   nearly front-to-back that "posterior" has no direction across it.
 * - Ring count is the distance along the airway from the top of the trachea, counted in rings.
 */
export function computeLumenWallAttribute(
  positions: ArrayLike<number>,
  airways: readonly LumenWallAirway[],
  options: LumenWallOptions = {},
): Float32Array {
  const vertexCount = Math.floor(positions.length / 3)
  const out = new Float32Array(vertexCount * 4)
  const posterior = options.posterior ?? POSTERIOR_LPS
  const airwayCount = airways.length
  const lines = airways.map((airway) => smoothCenterline(airway.pointsLps, airway.radiusMm))

  // Every centerline segment, flat: start point, direction, length, distance along its airway,
  // and the tangent at each end (the mean of the two segments that meet there) so the direction
  // "across the airway" turns smoothly along a curved centerline.
  let segmentCount = 0
  for (const line of lines) segmentCount += Math.max(0, line.length - 1)
  const start = new Float32Array(segmentCount * 3)
  const along = new Float32Array(segmentCount * 3)
  const segmentLength = new Float32Array(segmentCount)
  const segmentArc = new Float32Array(segmentCount)
  const tangentA = new Float32Array(segmentCount * 3)
  const tangentB = new Float32Array(segmentCount * 3)
  const owner = new Int32Array(segmentCount)
  /** 1: the airway's first segment; 2: its last; 3: both. */
  const atEnd = new Uint8Array(segmentCount)
  const airwayLength = new Float32Array(airwayCount)
  let cursor = 0
  lines.forEach((points, airwayIndex) => {
    const first = cursor
    let arc = 0
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1]
      const b = points[i]
      const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
      const inverse = length > 1e-6 ? 1 / length : 0
      start.set(a, cursor * 3)
      along[cursor * 3] = (b[0] - a[0]) * inverse
      along[cursor * 3 + 1] = (b[1] - a[1]) * inverse
      along[cursor * 3 + 2] = (b[2] - a[2]) * inverse
      segmentLength[cursor] = length
      segmentArc[cursor] = arc
      owner[cursor] = airwayIndex
      arc += length
      cursor += 1
    }
    airwayLength[airwayIndex] = arc
    if (cursor === first) return
    atEnd[first] |= 1
    atEnd[cursor - 1] |= 2
    for (let s = first; s < cursor; s += 1) {
      const before = s > first ? s - 1 : s
      const after = s < cursor - 1 ? s + 1 : s
      for (let k = 0; k < 3; k += 1) {
        tangentA[s * 3 + k] = along[s * 3 + k] + along[before * 3 + k]
        tangentB[s * 3 + k] = along[s * 3 + k] + along[after * 3 + k]
      }
    }
  })
  if (segmentCount === 0 || vertexCount === 0) return out

  // Ring count at the start of each airway: its parent's count where the parent ends.
  const indexOf = new Map(airways.map((airway, index) => [airway.edgeId, index]))
  const ringStart = new Float32Array(airwayCount).fill(-1)
  const ringStartOf = (index: number, guard = 0): number => {
    if (ringStart[index] >= 0) return ringStart[index]
    const parentId = airways[index].parentEdgeId
    const parent = parentId == null ? undefined : indexOf.get(parentId)
    ringStart[index] =
      parent !== undefined && guard < airwayCount
        ? ringStartOf(parent, guard + 1) + airwayLength[parent] / airways[parent].ringPitchMm
        : 0
    return ringStart[index]
  }

  // A coarse grid over the surface. Each segment is entered in every cell it could be the
  // nearest centerline for: its own box, widened by how far a wall can be from it.
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < vertexCount * 3; i += 1) {
    const value = positions[i]
    const axis = i % 3
    if (value < min[axis]) min[axis] = value
    if (value > max[axis]) max[axis] = value
  }
  const cells = [0, 1, 2].map((axis) =>
    Math.max(1, Math.ceil((max[axis] - min[axis]) / CELL_MM + 1e-6)),
  )
  const cellOf = (value: number, axis: number) =>
    Math.min(cells[axis] - 1, Math.max(0, Math.floor((value - min[axis]) / CELL_MM)))
  const cellCount = cells[0] * cells[1] * cells[2]
  const cellStart = new Int32Array(cellCount + 1)
  const eachCell = (segment: number, visit: (cell: number) => void) => {
    const reach = 2.5 * airways[owner[segment]].radiusMm + 3
    const low = [0, 0, 0]
    const high = [0, 0, 0]
    for (let axis = 0; axis < 3; axis += 1) {
      const a = start[segment * 3 + axis]
      const b = a + along[segment * 3 + axis] * segmentLength[segment]
      low[axis] = cellOf(Math.min(a, b) - reach, axis)
      high[axis] = cellOf(Math.max(a, b) + reach, axis)
    }
    for (let z = low[2]; z <= high[2]; z += 1)
      for (let y = low[1]; y <= high[1]; y += 1)
        for (let x = low[0]; x <= high[0]; x += 1) visit((z * cells[1] + y) * cells[0] + x)
  }
  for (let s = 0; s < segmentCount; s += 1) eachCell(s, (cell) => (cellStart[cell + 1] += 1))
  for (let cell = 0; cell < cellCount; cell += 1) cellStart[cell + 1] += cellStart[cell]
  const cellItems = new Int32Array(cellStart[cellCount])
  const filled = cellStart.slice(0, cellCount)
  for (let s = 0; s < segmentCount; s += 1)
    eachCell(s, (cell) => {
      cellItems[filled[cell]] = s
      filled[cell] += 1
    })

  // For one vertex: each nearby airway's nearest point, and how far off it is. Distance is
  // counted in the airway's own radii, so a small branch does not claim its parent's wall. Along
  // an airway's first and last segment the line runs on past its end, and a point out there is
  // that much farther again, so a wall belongs to the airway it lies beside.
  const radius = Float64Array.from(airways, (airway) => airway.radiusMm)
  const seenAt = new Int32Array(airwayCount)
  const seen = new Int32Array(airwayCount)
  const score = new Float64Array(airwayCount)
  const nearestSegment = new Int32Array(airwayCount)
  const nearestT = new Float64Array(airwayCount)
  const beside = new Float64Array(airwayCount)
  let seenCount = 0
  let best = -1
  let searches = 0
  const search = (v: number): void => {
    searches += 1
    const px = positions[v * 3]
    const py = positions[v * 3 + 1]
    const pz = positions[v * 3 + 2]
    const cell = (cellOf(pz, 2) * cells[1] + cellOf(py, 1)) * cells[0] + cellOf(px, 0)
    let from = cellStart[cell]
    let to = cellStart[cell + 1]
    // A vertex farther from every centerline than the grid allows for: look at them all.
    const everything = from === to
    if (everything) {
      from = 0
      to = segmentCount
    }
    seenCount = 0
    best = -1
    for (let i = from; i < to; i += 1) {
      const s = everything ? i : cellItems[i]
      const s3 = s * 3
      const rx = px - start[s3]
      const ry = py - start[s3 + 1]
      const rz = pz - start[s3 + 2]
      const length = segmentLength[s]
      const raw = rx * along[s3] + ry * along[s3 + 1] + rz * along[s3 + 2]
      let t = raw < 0 ? 0 : raw > length ? length : raw
      let past = 0
      if (raw < 0 && atEnd[s] & 1) {
        t = raw
        past = -raw
      } else if (raw > length && atEnd[s] & 2) {
        t = raw
        past = raw - length
      }
      const dx = rx - along[s3] * t
      const dy = ry - along[s3 + 1] * t
      const dz = rz - along[s3 + 2] * t
      const index = owner[s]
      const across = dx * dx + dy * dy + dz * dz
      const value = (across + PAST_END_WEIGHT * past * past) / (radius[index] * radius[index])
      if (seenAt[index] !== searches) {
        seenAt[index] = searches
        seen[seenCount] = index
        seenCount += 1
        score[index] = Infinity
      }
      if (value < score[index]) {
        score[index] = value
        nearestSegment[index] = s
        nearestT[index] = t
        beside[index] = past > 0 ? -1 : Math.sqrt(across)
      }
    }
    for (let i = 0; i < seenCount; i += 1)
      if (best < 0 || score[seen[i]] < score[best]) best = seen[i]
  }

  // The reviewed radius is the largest sphere that fits, which in the trachea and at a division
  // is well short of the wall. Measure each airway's wall from a sample of its own vertices
  // first, so "how many radii away" means the same thing in a wide airway and a narrow one.
  const wallSum = new Float64Array(airwayCount)
  const wallSamples = new Int32Array(airwayCount)
  for (let v = 0; v < vertexCount; v += RADIUS_SAMPLE_STRIDE) {
    search(v)
    if (best < 0 || beside[best] < 0) continue
    wallSum[best] += beside[best]
    wallSamples[best] += 1
  }
  for (let index = 0; index < airwayCount; index += 1) {
    if (wallSamples[index] < 12) continue
    const measured = wallSum[index] / wallSamples[index]
    radius[index] = Math.min(2.2, Math.max(0.6, measured / radius[index])) * radius[index]
  }

  // Where a point sits around one centerline segment: the cosine and sine of its angle from
  // posterior, both taken across the airway, and how much of posterior lies across the airway.
  const reading = new Float64Array(3)
  const around = (segment: number, t: number, v: number): boolean => {
    const s3 = segment * 3
    const length = segmentLength[segment]
    const f = length > 1e-6 ? Math.min(1, Math.max(0, t / length)) : 0
    let tx = tangentA[s3] * (1 - f) + tangentB[s3] * f
    let ty = tangentA[s3 + 1] * (1 - f) + tangentB[s3 + 1] * f
    let tz = tangentA[s3 + 2] * (1 - f) + tangentB[s3 + 2] * f
    const tangentLength = Math.hypot(tx, ty, tz) || 1
    tx /= tangentLength
    ty /= tangentLength
    tz /= tangentLength
    let wx = positions[v * 3] - (start[s3] + along[s3] * t)
    let wy = positions[v * 3 + 1] - (start[s3 + 1] + along[s3 + 1] * t)
    let wz = positions[v * 3 + 2] - (start[s3 + 2] + along[s3 + 2] * t)
    const wAlong = wx * tx + wy * ty + wz * tz
    wx -= tx * wAlong
    wy -= ty * wAlong
    wz -= tz * wAlong
    const wLength = Math.hypot(wx, wy, wz)
    const pAlong = posterior[0] * tx + posterior[1] * ty + posterior[2] * tz
    let bx = posterior[0] - tx * pAlong
    let by = posterior[1] - ty * pAlong
    let bz = posterior[2] - tz * pAlong
    const bLength = Math.hypot(bx, by, bz)
    if (wLength < 1e-6 || bLength < 1e-6) return false
    wx /= wLength
    wy /= wLength
    wz /= wLength
    bx /= bLength
    by /= bLength
    bz /= bLength
    reading[0] = wx * bx + wy * by + wz * bz
    // tangent × posterior: the patient's left where the airway runs foot-ward.
    reading[1] = wx * (ty * bz - tz * by) + wy * (tz * bx - tx * bz) + wz * (tx * by - ty * bx)
    reading[2] = bLength
    return true
  }

  for (let v = 0; v < vertexCount; v += 1) {
    search(v)
    if (best < 0) continue
    const ownCount =
      ringStartOf(best) +
      (segmentArc[nearestSegment[best]] + nearestT[best]) / airways[best].ringPitchMm
    // Every airway this wall is nearly as close to has a say, in proportion: on the line where
    // two are equally near, each side reads half of either, so nothing steps across that line.
    // The rings fade by how differently those airways count this piece of wall; where one airway
    // simply carries on as the next they agree, and the rings run through.
    let weightSum = 0
    let cosine = 0
    let sine = 0
    let cue = 0
    let rings = 0
    let ringCount = 0
    let posteriorAcross = 0
    let disagreement = 0
    for (let i = 0; i < seenCount; i += 1) {
      const index = seen[i]
      const weight =
        index === best
          ? 1
          : 1 - smoothstep(1.02, 1.45, Math.sqrt(score[index] / Math.max(score[best], 1e-9)))
      if (weight <= 0) continue
      const segment = nearestSegment[index]
      const t = nearestT[index]
      if (!around(segment, t, v)) continue
      const airway = airways[index]
      const total = airwayLength[index]
      const distance = Math.min(total, Math.max(0, segmentArc[segment] + t))
      const count = ringStartOf(index) + (segmentArc[segment] + t) / airway.ringPitchMm
      weightSum += weight
      cosine += weight * reading[0]
      sine += weight * reading[1]
      posteriorAcross += weight * reading[2]
      cue +=
        weight *
        (airway.cueStart +
          (airway.cueEnd - airway.cueStart) * (total > 1e-6 ? distance / total : 0))
      rings +=
        weight *
        (airway.plainStartMm === undefined
          ? 1
          : smoothstep(
              airway.plainStartMm,
              airway.plainStartMm + PLAIN_START_RISE_MM,
              segmentArc[segment] + t,
            ))
      ringCount += weight * count
      if (index !== best) disagreement += weight * smoothstep(0.2, 0.8, Math.abs(count - ownCount))
    }
    const length = Math.hypot(cosine, sine)
    if (weightSum <= 0 || length < 1e-6) continue
    cue /= weightSum
    out[v * 4] = (cosine / length) * cue
    out[v * 4 + 1] = (sine / length) * cue
    out[v * 4 + 2] =
      cue *
      (rings / weightSum) *
      smoothstep(0.25, 0.55, posteriorAcross / weightSum) *
      Math.max(0, 1 - disagreement)
    out[v * 4 + 3] = ringCount / weightSum
  }
  return out
}

/** The airways that carry complete cartilage rings and a membranous posterior wall. */
const CENTRAL_AIRWAYS: readonly AirwayLabel[] = ['TR', 'RMSB', 'LMSB', 'BI']
/** About two rings to the centimetre in the trachea; closer together in the bronchi. */
const TRACHEAL_RING_PITCH_MM = 5
const BRONCHIAL_RING_PITCH_MM = 3.4
/** Past the central airways the rings break into plates: the cue is gone this far along. */
const LOBAR_FADE_MM = 18
/**
 * The top of the model's trachea is the subglottis, inside the cricoid. The C-shaped rings and the
 * membranous strip start below it. A presentation value for this model, not a measurement.
 */
const SUBGLOTTIS_PLAIN_MM = 12

/** The teaching case's airways, with where the wall cue is full and where it fades out. */
export function teachingLumenAirways(scopeCase: ScopeCase): LumenWallAirway[] {
  const { index } = scopeCase
  const cueAtEnd = new Map<number, number>()
  const airways: LumenWallAirway[] = []
  const visit = (edgeId: number, cueStart: number) => {
    const edge = index.edgesById.get(edgeId)
    if (!edge || cueAtEnd.has(edgeId)) return
    const label = scopeCase.ownLabel.get(edgeId)
    const central = label !== undefined && CENTRAL_AIRWAYS.includes(label)
    const cueEnd = central ? 1 : Math.max(0, cueStart - edge.lengthMm / LOBAR_FADE_MM)
    cueAtEnd.set(edgeId, cueEnd)
    const children = index.nodesById.get(edge.endNodeId)?.childEdgeIds ?? []
    airways.push({
      edgeId,
      parentEdgeId: index.nodesById.get(edge.startNodeId)?.parentEdgeId ?? null,
      pointsLps: edge.pointsLps,
      radiusMm: edge.radiusMm ?? 2,
      ringPitchMm: label === 'TR' ? TRACHEAL_RING_PITCH_MM : BRONCHIAL_RING_PITCH_MM,
      cueStart: central ? 1 : cueStart,
      cueEnd,
      ...(label === 'TR' ? { plainStartMm: SUBGLOTTIS_PLAIN_MM } : {}),
    })
    for (const child of children) visit(child, cueEnd)
  }
  const root = index.nodesById.get(scopeCase.interaction.rootNodeId)
  for (const edgeId of root?.childEdgeIds ?? []) visit(edgeId, 1)
  return airways
}

/**
 * Writes the wall attribute onto the teaching lumen, once. The geometry is the cached one the
 * surface and the collider share, so a second scene finds the attribute already there.
 */
export function applyLumenWallAttribute(
  geometry: THREE.BufferGeometry,
  scopeCase: ScopeCase,
): void {
  if (geometry.getAttribute(MUCOSA_ANATOMY_ATTRIBUTE)) return
  const position = geometry.getAttribute('position')
  if (!position) return
  const plain =
    position instanceof THREE.BufferAttribute &&
    position.itemSize === 3 &&
    position.array instanceof Float32Array
  const positions = plain
    ? (position.array as Float32Array)
    : Float32Array.from({ length: position.count * 3 }, (_, i) =>
        position.getComponent(Math.floor(i / 3), i % 3),
      )
  geometry.setAttribute(
    MUCOSA_ANATOMY_ATTRIBUTE,
    new THREE.BufferAttribute(
      computeLumenWallAttribute(positions, teachingLumenAirways(scopeCase)),
      4,
    ),
  )
}
