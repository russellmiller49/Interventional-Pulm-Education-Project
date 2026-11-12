/**
 * The named bronchial tree of the course CT, as centrelines in the course's frame.
 *
 * Two existing sources describe the same patient as the course CT:
 *  - the committed FluoroView airway graph (centrelines and radii of every branch, unnamed), and
 *  - the owner's segment model, `Full_airway_segments.glb` (one named surface per segmental
 *    bronchus with everything distal to it), which stays in the local source directory.
 *
 * A branch takes the name of the segment surface its centreline runs inside. The bronchi above
 * the segments are named from what they lead to: an unnamed branch whose whole subtree lies in one
 * lobe is that lobe's bronchus. Nothing here invents anatomy; a branch no surface claims and no
 * rule covers is written out as unnamed and counted in the report.
 *
 *   IMAGING_SOURCE_DIR=/path/to/fluoro_2/New_patient npx tsx scripts/peripheral-imaging/build-airway-tree.ts
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import anatomy from '../../public/peripheral-imaging/anatomy/manifest.json'
import fluoroCase from '../../public/fluoroview/cases/patient-new/case_manifest.json'
import graph from '../../public/fluoroview/cases/patient-new/metadata/airway_graph.json'
import {
  AIRWAY_BRANCHES,
  lobeOfSegments,
  type AirwayBranchKey,
} from '../../src/features/peripheral-imaging/content/airwayNames'

type Vec3 = [number, number, number]

const SOURCE_DIR = process.env.IMAGING_SOURCE_DIR
if (!SOURCE_DIR) throw new Error('Set IMAGING_SOURCE_DIR to the local New_patient source folder.')
const MODEL = join(SOURCE_DIR, 'Full_airway_segments.glb')
const OUT = 'public/peripheral-imaging/anatomy/airway-tree.json'

/** The owner's surface names, as exported, to the course's branch keys. */
const SURFACE_KEYS: Readonly<Record<string, AirwayBranchKey>> = {
  'Right Mainstem': 'RMB',
  'Left Mainstem': 'LMB',
  'Bronchus Intermedius': 'BI',
  'RUL Apical Segment (RB1)': 'RB1',
  'RUL Posterior Segment (RB2)': 'RB2',
  'RUL Anterior Segment (RB3)': 'RB3',
  'RML Lateral Segment (RB4)': 'RB4',
  'RML Medial Segment (RB5)': 'RB5',
  'RLL Superior Segment (RB6)': 'RB6',
  'RLL Medial Basal Segment (RB7)': 'RB7',
  'RLL Anterior Basal Segment (RB8)': 'RB8',
  'RLL Lateral Basal Segment (RB9)': 'RB9',
  'RLL Posterior Basal Segment (RB10)': 'RB10',
  'LUL Apicalposterior Segment (LB1+2)': 'LB1+2',
  'LUL Anterior Segment (LB3)': 'LB3',
  'Lingula Superior Segment (LB4)': 'LB4',
  'Lingula Inferior Segment (LB5)': 'LB5',
  'LLL Superior Segment (LB6)': 'LB6',
  'LLL Anterior Mediasl Basal Segment (LB7+8)': 'LB7+8',
  'LLL Lateral Basal Segment (LB9)': 'LB9',
  'LLL Posterior Basal Segment (LB10)': 'LB10',
}

// --- frames -------------------------------------------------------------------------------------

/**
 * The course frame is LAS centred on the source CT (`build-slicer-anatomy.py`). The centre is
 * recomputed here from the published FluoroView volume description and held to the course
 * manifest, so the two builds cannot drift apart silently.
 */
function courseCentreLas(): Vec3 {
  const { originLps, originalSizeXyz, sizeXyz, spacingXyzMm } = fluoroCase.ctVolume
  const centreLps = originLps.map((origin, axis) => {
    const spacing = (spacingXyzMm[axis] * sizeXyz[axis]) / originalSizeXyz[axis]
    return origin + (spacing * (originalSizeXyz[axis] - 1)) / 2
  })
  const centre: Vec3 = [centreLps[0], -centreLps[1], centreLps[2]]
  // The first voxel of the course volume: left-most, most posterior, most inferior.
  const spacingY = (spacingXyzMm[1] * sizeXyz[1]) / originalSizeXyz[1]
  const first: Vec3 = [
    originLps[0] - centre[0],
    -(originLps[1] + spacingY * (originalSizeXyz[1] - 1)) - centre[1],
    originLps[2] - centre[2],
  ]
  first.forEach((value, axis) => {
    if (Math.abs(value - anatomy.originMm[axis]) > 0.01)
      throw new Error(
        `Course frame mismatch on axis ${axis}: ${value} vs ${anatomy.originMm[axis]}`,
      )
  })
  return centre
}
const CENTRE = courseCentreLas()
const lpsToCourse = ([x, y, z]: readonly number[]): Vec3 => [
  x - CENTRE[0],
  -y - CENTRE[1],
  z - CENTRE[2],
]
/** The segment model is the LPS scene exported Y-up: glTF (x, y, z) is (left, superior, anterior). */
const modelToLps = (x: number, y: number, z: number): Vec3 => [x, -z, y]

// --- the segment surfaces -----------------------------------------------------------------------

interface Surface {
  /** Null for the airway wall no named surface covers: the trachea and the bronchi between them. */
  key: AirwayBranchKey | null
  points: Float32Array
}

function readSurfaces(): Surface[] {
  const file = readFileSync(MODEL)
  if (file.toString('latin1', 0, 4) !== 'glTF') throw new Error('Not a binary glTF file.')
  const jsonLength = file.readUInt32LE(12)
  const doc = JSON.parse(file.toString('utf8', 20, 20 + jsonLength))
  if (doc.extensionsUsed?.length) throw new Error('Compressed glTF is not supported here.')
  const binStart = 20 + jsonLength + 8
  const surfaces: Surface[] = []
  let whole: Float32Array | null = null
  for (const node of doc.nodes as { name: string; mesh?: number }[]) {
    const name = node.name.replace(/\.\d+$/, '')
    const key = SURFACE_KEYS[name]
    if (node.mesh === undefined || (!key && name !== 'Complete_airway')) continue
    const chunks: Float32Array[] = []
    for (const primitive of doc.meshes[node.mesh].primitives) {
      const accessor = doc.accessors[primitive.attributes.POSITION]
      const view = doc.bufferViews[accessor.bufferView]
      const stride = view.byteStride ?? 12
      const start = binStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
      const points = new Float32Array(accessor.count * 3)
      for (let i = 0; i < accessor.count; i++) {
        const at = start + i * stride
        const lps = modelToLps(
          file.readFloatLE(at),
          file.readFloatLE(at + 4),
          file.readFloatLE(at + 8),
        )
        points.set(lpsToCourse(lps), i * 3)
      }
      chunks.push(points)
    }
    const all = new Float32Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0))
    let offset = 0
    for (const chunk of chunks) {
      all.set(chunk, offset)
      offset += chunk.length
    }
    if (key) surfaces.push({ key, points: all })
    else whole = all
  }
  if (!whole) throw new Error('The segment model lacks the complete airway surface.')
  const missing = Object.values(SURFACE_KEYS).filter(
    (key) => !surfaces.some((surface) => surface.key === key),
  )
  if (missing.length) throw new Error(`The segment model lacks: ${missing.join(', ')}`)
  // The named surfaces are pieces of the complete one. What is left over is the wall of the
  // trachea and of the bronchi above the segments, which keeps a lobar bronchus from being claimed
  // by the first segment that opens off it.
  const claimed = new Set<string>()
  const cell = (x: number, y: number, z: number) =>
    `${Math.round(x * 4)},${Math.round(y * 4)},${Math.round(z * 4)}`
  for (const surface of surfaces)
    for (let at = 0; at < surface.points.length; at += 3)
      claimed.add(cell(surface.points[at], surface.points[at + 1], surface.points[at + 2]))
  const rest: number[] = []
  for (let at = 0; at < whole.length; at += 3) {
    let taken = false
    for (let dx = -0.25; dx <= 0.25 && !taken; dx += 0.25)
      for (let dy = -0.25; dy <= 0.25 && !taken; dy += 0.25)
        for (let dz = -0.25; dz <= 0.25 && !taken; dz += 0.25)
          taken = claimed.has(cell(whole[at] + dx, whole[at + 1] + dy, whole[at + 2] + dz))
    if (!taken) rest.push(whole[at], whole[at + 1], whole[at + 2])
  }
  console.log(
    'unclaimed airway wall',
    ((rest.length / whole.length) * 100).toFixed(1) + '% of the complete surface',
  )
  surfaces.push({ key: null, points: Float32Array.from(rest) })
  return surfaces
}

/** Every surface vertex in 4 mm cells, so "which surface is this point inside" is a few lookups. */
const CELL = 4
const cellOf = (x: number, y: number, z: number) =>
  `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`

function indexSurfaces(surfaces: readonly Surface[]) {
  const cells = new Map<string, { surface: number; at: number }[]>()
  surfaces.forEach((surface, surfaceIndex) => {
    for (let at = 0; at < surface.points.length; at += 3) {
      const key = cellOf(surface.points[at], surface.points[at + 1], surface.points[at + 2])
      let cell = cells.get(key)
      if (!cell) cells.set(key, (cell = []))
      cell.push({ surface: surfaceIndex, at })
    }
  })
  /** The distance from `point` to each surface that comes within `reach` of it. */
  return (point: Vec3, reach: number): Map<number, number> => {
    const found = new Map<number, number>()
    const span = Math.ceil(reach / CELL)
    const base = point.map((value) => Math.floor(value / CELL))
    for (let dx = -span; dx <= span; dx++)
      for (let dy = -span; dy <= span; dy++)
        for (let dz = -span; dz <= span; dz++) {
          const cell = cells.get(`${base[0] + dx},${base[1] + dy},${base[2] + dz}`)
          if (!cell) continue
          for (const entry of cell) {
            const points = surfaces[entry.surface].points
            const distance = Math.hypot(
              points[entry.at] - point[0],
              points[entry.at + 1] - point[1],
              points[entry.at + 2] - point[2],
            )
            if (distance <= reach && distance < (found.get(entry.surface) ?? Infinity))
              found.set(entry.surface, distance)
          }
        }
    return found
  }
}

// --- naming the graph ---------------------------------------------------------------------------

interface Edge {
  id: number
  startNodeId: number
  endNodeId: number
  radiusMm: number
  lengthMm: number
  points: Vec3[]
  parent: number | null
  children: number[]
  key: AirwayBranchKey | null
}

function readEdges(): Edge[] {
  const byStart = new Map<number, number[]>()
  for (const edge of graph.edges) {
    const list = byStart.get(edge.startNodeId) ?? []
    list.push(edge.id)
    byStart.set(edge.startNodeId, list)
  }
  const intoNode = new Map<number, number>(graph.edges.map((edge) => [edge.endNodeId, edge.id]))
  return graph.edges.map((edge) => ({
    id: edge.id,
    startNodeId: edge.startNodeId,
    endNodeId: edge.endNodeId,
    radiusMm: edge.radiusMm,
    lengthMm: edge.lengthMm,
    points: edge.pointsLps.map(lpsToCourse),
    parent: intoNode.get(edge.startNodeId) ?? null,
    children: byStart.get(edge.endNodeId) ?? [],
    key: null,
  }))
}

function nameEdges(edges: Edge[], surfaces: readonly Surface[]) {
  const near = indexSurfaces(surfaces)
  const byId = new Map(edges.map((edge) => [edge.id, edge]))
  // 1. A branch belongs to the surface most of its centreline runs inside.
  for (const edge of edges) {
    const votes = new Map<number, number>()
    for (const point of edge.points) {
      const hits = near(point, edge.radiusMm + 4)
      let best = -1,
        bestDistance = Infinity
      for (const [surface, distance] of hits)
        if (distance < bestDistance) {
          best = surface
          bestDistance = distance
        }
      if (best >= 0) votes.set(best, (votes.get(best) ?? 0) + 1)
    }
    let winner = -1,
      count = 0
    for (const [surface, n] of votes)
      if (n > count) {
        winner = surface
        count = n
      }
    if (winner >= 0 && count > edge.points.length * 0.5) edge.key = surfaces[winner].key
  }
  // 2. Everything distal to a segmental bronchus is that segment.
  const isSegment = (key: AirwayBranchKey | null) =>
    !!key && AIRWAY_BRANCHES[key].level === 'segment'
  const order = [...edges].sort((a, b) => depth(a) - depth(b))
  function depth(edge: Edge): number {
    let d = 0
    for (let at = edge.parent; at !== null; at = byId.get(at)!.parent) d++
    return d
  }
  for (const edge of order) {
    const parent = edge.parent === null ? null : byId.get(edge.parent)!
    if (parent && isSegment(parent.key)) edge.key = parent.key
  }
  // 3. The bronchi above the segments, from what they lead to.
  const segmentsBelow = new Map<number, Set<AirwayBranchKey>>()
  for (const edge of [...order].reverse()) {
    const below = new Set<AirwayBranchKey>()
    if (isSegment(edge.key)) below.add(edge.key!)
    for (const child of edge.children) for (const key of segmentsBelow.get(child)!) below.add(key)
    segmentsBelow.set(edge.id, below)
  }
  for (const edge of order) {
    if (isSegment(edge.key)) continue
    const below = [...segmentsBelow.get(edge.id)!]
    if (edge.parent === null) edge.key = 'trachea'
    else if (below.length === 0) {
      // A twig off a central airway with no named segment beyond it stays with its parent.
      edge.key = byId.get(edge.parent)!.key
    } else {
      // One segment below: the bronchus is that segment's own stem. One lobe: its lobar bronchus.
      const lobar = below.length === 1 ? below[0] : lobeOfSegments(below)
      if (lobar) edge.key = lobar
      else if (!edge.key) edge.key = byId.get(edge.parent)!.key
    }
  }
}

// --- output -------------------------------------------------------------------------------------

/** Ramer–Douglas–Peucker: the centreline within `tolerance` mm, in far fewer points. */
function simplify(points: readonly Vec3[], tolerance: number): Vec3[] {
  if (points.length < 3) return [...points]
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const ab = points[b].map((value, i) => value - points[a][i])
    const length = Math.hypot(...ab) || 1
    let worst = -1,
      worstDistance = tolerance
    for (let i = a + 1; i < b; i++) {
      const ap = points[i].map((value, axis) => value - points[a][axis])
      const cross = [
        ap[1] * ab[2] - ap[2] * ab[1],
        ap[2] * ab[0] - ap[0] * ab[2],
        ap[0] * ab[1] - ap[1] * ab[0],
      ]
      const distance = Math.hypot(...cross) / length
      if (distance > worstDistance) {
        worst = i
        worstDistance = distance
      }
    }
    if (worst > 0) {
      keep[worst] = 1
      stack.push([a, worst], [worst, b])
    }
  }
  return points.filter((_, i) => keep[i])
}

const round = (value: number) => Math.round(value * 10) / 10

function main() {
  const surfaces = readSurfaces()
  const edges = readEdges()
  nameEdges(edges, surfaces)
  const unnamed = edges.filter((edge) => !edge.key)
  const lengthByKey = new Map<string, number>()
  for (const edge of edges)
    lengthByKey.set(
      edge.key ?? 'unnamed',
      (lengthByKey.get(edge.key ?? 'unnamed') ?? 0) + edge.lengthMm,
    )
  const absent = (Object.keys(AIRWAY_BRANCHES) as AirwayBranchKey[]).filter(
    (key) => !lengthByKey.has(key),
  )
  console.log('branches', edges.length, 'unnamed', unnamed.length, 'absent keys', absent)
  console.log(
    [...lengthByKey].map(([key, length]) => `${key} ${Math.round(length)} mm`).join(' | '),
  )
  const branches = edges.map((edge) => ({
    id: edge.id,
    parent: edge.parent,
    key: edge.key,
    radiusMm: Math.round(edge.radiusMm * 100) / 100,
    points: simplify(edge.points, 0.3).map((point) => point.map(round)),
  }))
  writeFileSync(
    OUT,
    JSON.stringify({
      schema: 'peripheral-imaging-airway-tree/v1',
      coordinateSystem: 'LAS',
      units: 'mm',
      source:
        'FluoroView airway graph of the course CT (centrelines, radii); branch names from the segment surfaces of the same patient',
      graphSha256: createHash('sha256')
        .update(readFileSync('public/fluoroview/cases/patient-new/metadata/airway_graph.json'))
        .digest('hex'),
      segmentModelSha256: createHash('sha256').update(readFileSync(MODEL)).digest('hex'),
      carinaMm: lpsToCourse(graph.carinaLpsMm).map(round),
      limitations:
        'Centrelines of a segmented airway lumen with names assigned from segment surfaces; not a diagnostic airway map. Subsegmental branches carry their segment name.',
      branches,
    }) + '\n',
  )
  // The repository formats every committed JSON file; do it here so a rebuild is byte-stable.
  execFileSync('npx', ['prettier', '--write', OUT], { stdio: 'ignore' })
  console.log(
    'wrote',
    OUT,
    branches.reduce((sum, branch) => sum + branch.points.length, 0),
    'points',
  )
}

main()
