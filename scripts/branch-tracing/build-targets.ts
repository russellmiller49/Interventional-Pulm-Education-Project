/** Native CT target derivatives. Reuses the trainer's HU compositor; source assets are read-only. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync, deflateSync } from 'node:zlib'
import { resolve } from 'node:path'
import { residualHuAt, type CtResidualOverlay } from '../../src/lib/bronchoscopy-core/ct-overlay'
import type { Point3 } from '../../src/lib/bronchoscopy-core/frame'
import type { CtTrace } from '../../src/features/bronchial-branch-tracing/content/ct-types'

const root = process.cwd()
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex')
const json = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'))
const native = json('public/branch-tracing/native-v1/manifest.json')
const spec = json('scripts/branch-tracing/authoring/nodule-targets.json')
const traceSpecs = json('scripts/branch-tracing/authoring/ct-traces.json')
const names = json('scripts/branch-tracing/authoring/airway-nomenclature.json')
const graphBytes = readFileSync(
  resolve(root, 'public/fluoroview/cases/patient-new/metadata/airway_graph.json'),
)
if (hash(graphBytes) !== native.sourceGraphSha256) throw new Error('Source graph changed')
const labelsBytes = readFileSync(resolve(root, names.labelsPath))
if (hash(labelsBytes) !== names.labelsSha256) throw new Error('Source labels changed')
const labels = JSON.parse(labelsBytes.toString()).edgeLabels
const labeledGraphBytes = readFileSync(resolve(root, names.graphPath))
if (hash(labeledGraphBytes) !== names.graphSha256) throw new Error('Labeled graph changed')
interface Edge {
  id: number
  startNodeId: number
  endNodeId: number
  pointsLps: Point3[]
}
const edges = new Map<number, Edge>(
  JSON.parse(graphBytes.toString()).edges.map((e: Edge) => [e.id, e]),
)
const incoming = new Map([...edges.values()].map((e) => [e.endNodeId, e.id]))
const labeledEdges = new Map<number, Edge>(
  JSON.parse(labeledGraphBytes.toString()).edges.map((e: Edge) => [e.id, e]),
)
const source = process.env.BRANCH_TRACING_CT_SOURCE
if (!source) throw new Error('Set BRANCH_TRACING_CT_SOURCE to the original matching NRRD')
const sourceBytes = readFileSync(source)
if (hash(sourceBytes) !== native.sourceSha256) throw new Error('Unexpected source CT')
const split = sourceBytes.indexOf('\n\n')
const header = sourceBytes.subarray(0, split).toString()
for (const field of [
  'type: short',
  'sizes: 512 512 636',
  'endian: little',
  'encoding: gzip',
  'space: left-posterior-superior',
])
  if (!header.includes(field)) throw new Error(`Unexpected NRRD geometry: ${field}`)
const ct = gunzipSync(sourceBytes.subarray(split + 2))
if (ct.length !== 512 * 512 * 636 * 2) throw new Error('Unexpected CT buffer length')
const spacing = native.spacingXyzMm as Point3
const origin = native.ijkToLps.slice(0, 3).map((row: number[]) => row[3]) as Point3
const pixel = (p: Point3) => p.map((v, i) => (v - origin[i]) / spacing[i]) as Point3
const lps = (i: number, j: number, k: number): Point3 => [
  origin[0] + i * spacing[0],
  origin[1] + j * spacing[1],
  origin[2] + k * spacing[2],
]
const hu = (i: number, j: number, k: number) => ct.readInt16LE(((k * 512 + j) * 512 + i) * 2)
const gray = (v: number) => Math.round(Math.max(0, Math.min(1, (v + 1000) / 1400)) * 255)
const round = (p: number[]) => p.map((v) => Number(v.toFixed(4)))
const distance = (a: Point3, b: Point3) => Math.hypot(...a.map((v, i) => v - b[i]))
function pathTo(id: number): number[] {
  const path = [id]
  while (incoming.has(edges.get(path[0])!.startNodeId))
    path.unshift(incoming.get(edges.get(path[0])!.startNodeId)!)
  return path
}
function sample(path: number[], fromEnd: number) {
  for (const id of [...path].reverse()) {
    const points = edges.get(id)!.pointsLps
    for (let i = points.length - 1; i > 0; i--) {
      const length = distance(points[i], points[i - 1])
      if (fromEnd <= length)
        return {
          point: points[i].map(
            (v, j) => v + ((points[i - 1][j] - v) * fromEnd) / Math.max(length, 1e-9),
          ) as Point3,
          edge: id,
        }
      fromEnd -= length
    }
  }
  throw new Error('Route too short')
}
function crc32(data: Buffer) {
  let c = 0xffffffff
  for (const v of data) {
    c ^= v
    for (let b = 0; b < 8; b++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0)
  }
  return (c ^ 0xffffffff) >>> 0
}
function png(width: number, height: number, channels: 1 | 4, pixels: Buffer) {
  const chunk = (name: string, data: Buffer) => {
    const b = Buffer.alloc(data.length + 12)
    b.writeUInt32BE(data.length)
    b.write(name, 4)
    data.copy(b, 8)
    b.writeUInt32BE(crc32(b.subarray(4, -4)), b.length - 4)
    return b
  }
  const info = Buffer.alloc(13)
  info.writeUInt32BE(width)
  info.writeUInt32BE(height, 4)
  info[8] = 8
  info[9] = channels === 1 ? 0 : 6
  const rows = Buffer.alloc((width * channels + 1) * height)
  for (let y = 0; y < height; y++)
    pixels.copy(
      rows,
      y * (width * channels + 1) + 1,
      y * width * channels,
      (y + 1) * width * channels,
    )
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', info),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
const output = resolve(root, 'public/branch-tracing/targets-v1')
const priorAssets: { path: string }[] = existsSync(resolve(output, 'manifest.json'))
  ? json('public/branch-tracing/targets-v1/manifest.json').assets
  : []
const writeAsset = (path: string, data: Buffer) => {
  mkdirSync(resolve(output, path, '..'), { recursive: true })
  writeFileSync(resolve(output, path), data)
  return { path, bytes: data.length, sha256: hash(data) }
}
const donorFolder = 'navigation_module/web/public/cases/default/'
const donor = json(donorFolder + 'case.json').noduleAsset
const residualBytes = readFileSync(resolve(root, donorFolder + donor.residualRaw))
const alphaBytes = readFileSync(resolve(root, donorFolder + donor.alphaRaw))
const residual = new Int16Array(residualBytes.length / 2)
for (let i = 0; i < residual.length; i++) residual[i] = residualBytes.readInt16LE(i * 2)
const overlay: CtResidualOverlay = {
  geometry: {
    sizeXyz: donor.sizeXyz,
    spacingXyzMm: donor.spacingXyzMm.map((v: number) => v * spec.scale),
    originLps: [0, 0, 0],
    directionLps: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  },
  residual,
  alpha: new Uint8Array(alphaBytes),
}
const assets: ReturnType<typeof writeAsset>[] = []
const geometryDifferences: { edgeId: number; pointIndex: number; offsetMm: number }[] = []
interface TargetSpec {
  id: string
  terminalEdgeId: number
  segment: { code: string; name: string; bronchusCode: string }
  approachCode: string
}
const targets = (spec.targets as TargetSpec[]).map(
  (t: {
    id: string
    terminalEdgeId: number
    segment: { code: string; name: string; bronchusCode: string }
    approachCode: string
  }) => {
    const path = pathTo(t.terminalEdgeId)
    for (const id of path) {
      const edge = edges.get(id)!,
        labeled = labeledEdges.get(id)
      if (
        !labeled ||
        edge.startNodeId !== labeled.startNodeId ||
        edge.endNodeId !== labeled.endNodeId ||
        edge.pointsLps.length !== labeled.pointsLps.length
      )
        throw new Error(`Source and labeled route geometry differ at edge ${id}`)
      edge.pointsLps.forEach((point, index) => {
        const delta = distance(point, labeled.pointsLps[index])
        if (!delta) return
        // The hash-pinned graphs share one slightly adjusted LB6 junction (node 186).
        // Both incident edges and every other vertex match; keep the original CT graph unchanged.
        const knownJunction =
          (id === 184 && index === edge.pointsLps.length - 1) || (id === 281 && index === 0)
        if (!knownJunction || delta > 0.135)
          throw new Error(`Unreviewed graph difference: ${id}:${index}`)
        if (!geometryDifferences.some((d) => d.edgeId === id && d.pointIndex === index))
          geometryDifferences.push({ edgeId: id, pointIndex: index, offsetMm: delta })
      })
    }
    const terminal = edges.get(t.terminalEdgeId)!.pointsLps.at(-1)!
    if (labels[String(t.terminalEdgeId)]?.abbreviatedLabel !== t.segment.bronchusCode)
      throw new Error(`Segment mismatch: ${t.id}`)
    let center = terminal // Authored placement in distal air-containing tissue, not a native lesion.
    for (let back = 0; back <= 6; back += 0.5) {
      const candidate = sample(path, back).point,
        ijk = pixel(candidate).map(Math.round)
      if (hu(ijk[0], ijk[1], ijk[2]) < -700) {
        center = candidate
        break
      }
    }
    const centerPixel = pixel(center)
    const overlayOrigin = center.map(
      (v, i) => v - donor.centroidIndexXyz[i] * overlay.geometry.spacingXyzMm[i],
    ) as Point3
    let approach: ReturnType<typeof sample> | undefined
    for (let back = 6; back <= 40; back += 0.5) {
      const candidate = sample(path, back),
        ijk = pixel(candidate.point).map(Math.round)
      if (
        hu(ijk[0], ijk[1], ijk[2]) < -850 &&
        Math.abs(residualHuAt(overlay, candidate.point, overlayOrigin)) < 1
      ) {
        approach = candidate
        break
      }
    }
    if (!approach) throw new Error(`No visible approach point: ${t.id}`)
    const first = pixel(overlayOrigin).map(Math.floor)
    const last = pixel(
      overlayOrigin.map(
        (v, i) => v + (overlay.geometry.sizeXyz[i] - 1) * overlay.geometry.spacingXyzMm[i],
      ) as Point3,
    ).map(Math.ceil)
    const width = last[0] - first[0] + 1,
      height = last[1] - first[1] + 1
    const frames = []
    for (let k = first[2]; k <= last[2]; k++) {
      const rgba = Buffer.alloc(width * height * 4)
      let changed = 0
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const i = x + first[0],
            j = y + first[1],
            r = residualHuAt(overlay, lps(i, j, k), overlayOrigin)
          if (Math.abs(r) < 0.1) continue
          const offset = (y * width + x) * 4,
            value = gray(hu(i, j, k) + r)
          rgba[offset] = value
          rgba[offset + 1] = value
          rgba[offset + 2] = value
          rgba[offset + 3] = 255
          changed++
        }
      if (changed) {
        const asset = writeAsset(`patches/${t.id}/${k}.png`, png(width, height, 4, rgba))
        assets.push(asset)
        frames.push({ slice: k, path: asset.path, changedPixels: changed })
      }
    }
    const ijk = pixel(approach.point),
      x = Math.round(ijk[0]),
      y = Math.round(ijk[1]),
      k = Math.round(ijk[2])
    console.log(
      t.id,
      'target HU',
      hu(...(centerPixel.map(Math.round) as Point3)),
      'approach edge',
      approach.edge,
      'HU',
      hu(x, y, k),
      'gap mm',
      distance(center, approach.point).toFixed(1),
    )
    return {
      ...t,
      sourceEdgeIds: path,
      centerLps: round(center),
      pixel: round(centerPixel.slice(0, 2)),
      slice: Math.round(centerPixel[2]),
      patch: { originPixel: first.slice(0, 2), size: [width, height], frames },
      approach: {
        slice: k,
        pixel: round(ijk.slice(0, 2)),
        lps: round(approach.point),
        sourceHu: hu(x, y, k),
        sourceEdgeId: approach.edge,
      },
      centerSourceHu: hu(...(centerPixel.map(Math.round) as Point3)),
    }
  },
)
const airways = Object.values(names.airways) as { code: string; name: string; shortName: string }[]
const traces = (native.traces as Omit<CtTrace, 'targetId' | 'sourceEdgeIds'>[]).map((base) => {
  const target = targets.find((t) => t.id === spec.traceTargets[base.id])!
  const original = (traceSpecs.traces as { id: string; edges: number[] }[]).find(
    (t) => t.id === base.id,
  )!
  const begin = target.sourceEdgeIds.indexOf(original.edges[0])
  const path = target.sourceEdgeIds.slice(begin)
  if (begin < 0 || !original.edges.every((e: number, i: number) => e === path[i]))
    throw new Error(`Route disconnected: ${base.id}`)
  const airwayPath: typeof airways = []
  for (const id of path) {
    const code = names.edges[String(id)]?.airway
    let label = code ? names.airways[code] : undefined
    const inherited = labels[String(id)]?.abbreviatedLabel
    if (!label && inherited && !airwayPath.at(-1)?.code.startsWith(inherited))
      label =
        airways.find((a) => a.code === inherited) ??
        (inherited === 'RB3'
          ? { code: 'RB3', name: 'Right anterior segmental bronchus', shortName: 'Anterior' }
          : undefined)
    if (label && label.code !== airwayPath.at(-1)?.code) airwayPath.push(label)
  }
  const lastLabel = airways.find((a) => a.code === target.approachCode)!
  const checkpoints = [
    ...base.checkpoints.slice(0, 2).map((p) => ({ ...p, landmark: '' })),
    { id: 'point-3', ...target.approach, airway: lastLabel, landmark: '' },
  ]
  for (const p of checkpoints) {
    const same = checkpoints.filter((q) => q.airway.code === p.airway.code)
    if (same.length > 1)
      p.landmark = (
        same.length === 2 ? ['Proximal', 'Distal'] : ['Proximal', 'Midportion', 'Distal']
      )[same.indexOf(p)]
  }
  const pixels = [base.anchor.pixel, ...checkpoints.map((p) => p.pixel), target.pixel]
  const min = [0, 1].map((i) => Math.min(...pixels.map((p) => p[i]))),
    max = [0, 1].map((i) => Math.max(...pixels.map((p) => p[i])))
  const cropSize = Math.max(190, ...max.map((v, i) => v - min[i] + 65))
  const range = [
    Math.min(
      base.range[0],
      ...target.patch.frames.map((f) => f.slice),
      ...checkpoints.map((p) => p.slice),
    ) - 3,
    Math.max(
      base.range[1],
      ...target.patch.frames.map((f) => f.slice),
      ...checkpoints.map((p) => p.slice),
    ) + 3,
  ]
  return {
    ...base,
    targetId: target.id,
    sourceEdgeIds: path,
    airwayPath,
    checkpoints,
    cropSize: Number(cropSize.toFixed(4)),
    cropCenter: round(min.map((v, i) => (v + max[i]) / 2)),
    range,
  }
})
const required = new Set<number>()
for (const t of traces)
  for (let k = t.range[0]; k <= t.range[1]; k++)
    if (k < native.exportedSliceRange[0] || k > native.exportedSliceRange[1]) required.add(k)
for (const k of [...required].sort((a, b) => a - b)) {
  if (k < 0 || k > 635) throw new Error('Slice outside source CT')
  const pixels = Buffer.alloc(512 * 512)
  for (let j = 0; j < 512; j++)
    for (let i = 0; i < 512; i++) pixels[j * 512 + i] = gray(hu(i, j, k))
  assets.push(writeAsset(`axial/${k}.png`, png(512, 512, 1, pixels)))
}
const result = {
  schema: 'branch-tracing-nodule-targets/v1',
  sourceSha256: native.sourceSha256,
  sourceGraphSha256: native.sourceGraphSha256,
  sourceLabelsSha256: names.labelsSha256,
  sourceLabeledGraphSha256: names.graphSha256,
  geometryDifferences,
  donor: {
    assetId: donor.assetId,
    residualSha256: hash(residualBytes),
    alphaSha256: hash(alphaBytes),
    scale: spec.scale,
    compositor: 'src/lib/bronchoscopy-core/ct-overlay.ts:residualHuAt',
    compositorSha256: hash(readFileSync(resolve(root, 'src/lib/bronchoscopy-core/ct-overlay.ts'))),
  },
  targets,
  traces,
  assets,
  extraSlices: [...required].sort((a, b) => a - b),
}
mkdirSync(output, { recursive: true })
// Prune only files listed by this exporter's previous manifest, never untracked source assets.
const currentPaths = new Set(assets.map((asset) => asset.path))
for (const { path } of priorAssets) {
  if (
    !currentPaths.has(path) &&
    /^(?:patches\/[a-z-]+|axial)\/\d+\.png$/.test(path) &&
    existsSync(resolve(output, path))
  )
    unlinkSync(resolve(output, path))
}
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify(result, null, 2) + '\n')
console.log(
  `Built ${targets.length} targets, ${traces.length} traces, ${assets.length} assets; ${assets.reduce((s, a) => s + a.bytes, 0)} bytes`,
)
