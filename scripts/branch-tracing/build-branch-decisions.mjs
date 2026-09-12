// Read-only source derivation. Run with BRANCH_TRACING_CT_SOURCE pointing to the matching NRRD.
// Preserve the native CT, nodule patches and their manifests; add a topology-complete teaching route.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { format } from 'prettier'

const read = (path) => JSON.parse(readFileSync(path))
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const manifest = read('public/branch-tracing/targets-v1/manifest.json')
const names = read('scripts/branch-tracing/authoring/airway-nomenclature.json')
const graphBytes = readFileSync('public/fluoroview/cases/patient-new/metadata/airway_graph.json')
const labelsBytes = readFileSync(names.labelsPath)
if (hash(graphBytes) !== manifest.sourceGraphSha256 || hash(labelsBytes) !== names.labelsSha256)
  throw new Error('Source graph or labels changed')
const sourceBytes = readFileSync(process.env.BRANCH_TRACING_CT_SOURCE)
if (hash(sourceBytes) !== manifest.sourceSha256) throw new Error('Unexpected source CT')
const ct = gunzipSync(sourceBytes.subarray(sourceBytes.indexOf('\n\n') + 2))
if (ct.length !== 512 * 512 * 636 * 2) throw new Error('Unexpected CT buffer length')
const edges = new Map(JSON.parse(graphBytes).edges.map((e) => [e.id, e]))
const labels = JSON.parse(labelsBytes).edgeLabels
const incoming = new Map([...edges.values()].map((e) => [e.endNodeId, e.id]))
const children = new Map()
for (const e of edges.values())
  children.set(e.startNodeId, [...(children.get(e.startNodeId) ?? []), e.id])
const spacing = [0.689453125, 0.689453125, 0.5]
const origin = [-182.1552734375, -374.1552734375, -368.5]
const pixel = (p) => p.map((v, i) => (v - origin[i]) / spacing[i])
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]))
const round = (p) => p.map((v) => Number(v.toFixed(4)))
function pathTo(id) {
  const path = [id]
  while (incoming.has(edges.get(path[0]).startNodeId))
    path.unshift(incoming.get(edges.get(path[0]).startNodeId))
  return path
}
function length(id) {
  const points = edges.get(id).pointsLps
  return points.slice(1).reduce((n, p, i) => n + distance(p, points[i]), 0)
}
function sample(id, mm) {
  const points = edges.get(id).pointsLps
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      d = distance(a, b)
    if (mm <= d) return a.map((v, j) => v + ((b[j] - v) * mm) / d)
    mm -= d
  }
  return points.at(-1)
}
function position(id, mm) {
  const p = sample(id, mm),
    ijk = pixel(p),
    [x, y, z] = ijk.map(Math.round)
  return {
    lps: round(p),
    pixel: round(ijk.slice(0, 2)),
    slice: z,
    sourceHu: ct.readInt16LE(((z * 512 + y) * 512 + x) * 2),
    sourceEdgeId: id,
  }
}
const labelCache = new Map()
function airway(id) {
  if (labelCache.has(id)) return labelCache.get(id)
  const authored = names.edges[id]?.airway
  const raw = labels[id]
  const parentId = incoming.get(edges.get(id).startNodeId)
  const parent = parentId === undefined ? null : airway(parentId)
  let label = authored ? names.airways[authored] : null
  // A descendant's coarse territory label must not erase an already authored subsegment.
  if (
    !label &&
    parent &&
    (!raw ||
      parent.code === raw.abbreviatedLabel ||
      ['a', 'b', 'c'].some((suffix) => parent.code === raw.abbreviatedLabel + suffix) ||
      ['RLL', 'LLL', 'LUL'].includes(raw.abbreviatedLabel))
  )
    label = parent
  if (!label && raw)
    label = Object.values(names.airways).find((a) => a.code === raw.abbreviatedLabel) ?? {
      code: raw.abbreviatedLabel,
      name: raw.fullLabel
        .replace(/ Segment$/, ' segmental bronchus')
        .replace(/ Bronchus$/, ' bronchus'),
      shortName: raw.abbreviatedLabel,
    }
  if (!label) throw new Error(`No source-based airway label for edge ${id}`)
  labelCache.set(id, label)
  return label
}
function distanceAlong(id, point) {
  const pts = edges.get(id).pointsLps
  let arc = 0,
    bestArc = 0,
    gap = Infinity
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i],
      len = distance(a, b)
    const f = Math.max(
      0,
      Math.min(1, a.reduce((n, v, j) => n + (point[j] - v) * (b[j] - v), 0) / len ** 2),
    )
    const d = distance(
      point,
      a.map((v, j) => v + f * (b[j] - v)),
    )
    if (d < gap) {
      gap = d
      bestArc = arc + f * len
    }
    arc += len
  }
  return bestArc
}
function daughterPoint(id, limit = Infinity) {
  const len = length(id),
    nominal = Math.min(5, len * 0.55, limit)
  // Stay on the actual child polyline, before its next junction. Prefer native air pixels.
  const candidates = [
    nominal,
    ...[0.25, 0.4, 0.65, 0.8].map((f) => Math.min(8, len * f, limit)),
  ].map((mm) => position(id, mm))
  return (
    candidates.find((p) => p.sourceHu < -850) ??
    candidates.sort((a, b) => a.sourceHu - b.sourceHu)[0]
  )
}
function optionsAt(ids, limit, parentAirway) {
  const options = ids.map((id) => ({ ...daughterPoint(id, limit), airway: airway(id) }))
  const spread = [0, 1, 2].map(
    (axis) =>
      Math.max(...options.map((o) => o.lps[axis])) - Math.min(...options.map((o) => o.lps[axis])),
  )
  const axis = spread.indexOf(Math.max(...spread))
  const order = [...options].sort((a, b) => a.lps[axis] - b.lps[axis])
  const directions = [
    ['right', 'left'],
    ['anterior', 'posterior'],
    ['caudal', 'cranial'],
  ][axis]
  return options.map((o) => {
    const rank = order.indexOf(o)
    const direction =
      rank === 0
        ? `More ${directions[0]}`
        : rank === order.length - 1
          ? `More ${directions[1]}`
          : `Between the ${directions[0]} and ${directions[1]} daughters`
    const duplicate =
      o.airway.code === parentAirway.code ||
      options.filter((v) => v.airway.code === o.airway.code).length > 1
    return {
      ...o,
      direction,
      label: duplicate
        ? `${o.airway.code} · ${direction.toLowerCase()} daughter`
        : `${o.airway.code} · ${o.airway.name}`,
    }
  })
}
const traces = manifest.traces.map((base) => {
  const sourceEdgeIds = pathTo(base.sourceEdgeIds.at(-1))
  const previousDistal = base.checkpoints.at(-1)
  const terminalId = sourceEdgeIds.at(-1)
  // The old posterior apical sample was proximal to one last fork. Preserve the target,
  // but place its final inspection on the terminal daughter, explicitly noting the nodule overlap.
  const distal =
    previousDistal.sourceEdgeId === terminalId
      ? previousDistal
      : {
          ...previousDistal,
          ...daughterPoint(terminalId),
          visibilityNote:
            'The simulated nodule overlaps this distal division. Record unresolved continuity if no air column can be followed; the source centerline does not establish a visible connection.',
        }
  const checkpoints = []
  for (let i = 0; i < sourceEdgeIds.length - 1; i++) {
    const parentId = sourceEdgeIds[i],
      chosenId = sourceEdgeIds[i + 1]
    const parentEdge = edges.get(parentId)
    const childIds = children.get(parentEdge.endNodeId) ?? []
    if (!childIds.includes(chosenId)) throw new Error(`Disconnected route ${base.id}`)
    if (childIds.length < 2) continue // A unary edge is continuity, not a branch decision.
    const options = optionsAt(
      childIds,
      chosenId === distal.sourceEdgeId ? distanceAlong(chosenId, distal.lps) : Infinity,
      airway(parentId),
    )
    const chosen = options.find((o) => o.sourceEdgeId === chosenId)
    const parent = {
      ...position(parentId, Math.max(0, length(parentId) - Math.min(8, length(parentId) * 0.65))),
      airway: airway(parentId),
    }
    const pixels = [parent.pixel, ...options.map((o) => o.pixel)]
    const min = [0, 1].map((a) => Math.min(...pixels.map((p) => p[a])))
    const max = [0, 1].map((a) => Math.max(...pixels.map((p) => p[a])))
    checkpoints.push({
      id: `junction-${parentEdge.endNodeId}`,
      slice: chosen.slice,
      pixel: chosen.pixel,
      lps: chosen.lps,
      sourceHu: chosen.sourceHu,
      sourceEdgeId: chosenId,
      airway: chosen.airway,
      landmark: 'Daughter lumen',
      ...(chosenId === terminalId && distal.visibilityNote
        ? { visibilityNote: distal.visibilityNote }
        : {}),
      cropCenter: round(min.map((v, a) => (v + max[a]) / 2)),
      cropSize: Math.max(90, ...max.map((v, a) => v - min[a] + 65)),
      decision: {
        nodeId: parentEdge.endNodeId,
        junctionLps: parentEdge.pointsLps.at(-1),
        parent,
        options,
      },
    })
  }
  checkpoints.push({
    ...distal,
    id: 'target-approach',
    landmark: 'Distal nodule approach',
    cropCenter: base.cropCenter,
    cropSize: base.cropSize,
  })
  const first = checkpoints[0].decision.parent
  const anchor = {
    slice: first.slice,
    pixel: first.pixel,
    sourceEdgeId: first.sourceEdgeId,
    airway: first.airway,
  }
  const allSlices = [
    anchor.slice,
    ...checkpoints.flatMap((p) => [
      p.slice,
      ...(p.decision ? [p.decision.parent.slice, ...p.decision.options.map((o) => o.slice)] : []),
    ]),
  ]
  const range = [
    Math.min(base.range[0], ...allSlices.map((s) => s - 2)),
    Math.max(base.range[1], ...allSlices.map((s) => s + 2)),
  ]
  // All continuous browsing planes already exist. Fail rather than silently generating substitutes.
  if (range[0] < 239 || range[1] > 478)
    throw new Error(`Missing native planes for ${base.id}: ${range}`)
  const airwayPath = []
  for (const id of sourceEdgeIds) {
    const label = airway(id)
    if (label.code !== airwayPath.at(-1)?.code) airwayPath.push(label)
  }
  return { id: base.id, sourceEdgeIds, airwayPath, anchor, checkpoints, range }
})
const output = {
  schema: 'branch-tracing-decisions/v1',
  sourceSha256: manifest.sourceSha256,
  sourceGraphSha256: manifest.sourceGraphSha256,
  sourceLabelsSha256: names.labelsSha256,
  labeling:
    'Existing named bronchi; relative patient-space daughter positions within unnamed distal divisions. No new segment suffixes.',
  traces,
}
writeFileSync(
  'src/features/bronchial-branch-tracing/geometry/branch-decisions.json',
  await format(JSON.stringify(output), { parser: 'json' }),
)
for (const t of traces)
  console.log(`${t.id}: ${t.checkpoints.length - 1} junctions + distal nodule approach`)
