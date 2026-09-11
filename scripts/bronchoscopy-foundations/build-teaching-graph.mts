/**
 * Build the course's teaching airway graph from the reviewed case-001 centerline graph.
 *
 *   npx tsx scripts/bronchoscopy-foundations/build-teaching-graph.mts [--check]
 *
 * Input (read only): `public/airway-anatomy/case-001/{case_manifest.json, metadata/airway_graph.json,
 * metadata/centerline_labels.json}` — the same de-identified CT-derived case the admin synchronized
 * bronchoscopy module uses. Output: one public JSON the course's scope engine loads, pruned to the
 * teaching depth (every airway down to each segmental origin plus one generation inside the
 * segment, so a learner can enter a segment and see its first subsegmental carina), with the label
 * carried on each edge, the left upper division labelled as its own airway, and the reviewed
 * orientation and ostial landmarks. Node and edge ids are the source ids, so the landmarks and any
 * future lumen built from the same case keep referring to the same places.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const CASE_DIR = path.resolve('public/airway-anatomy/case-001')
const OUT = path.resolve(
  'public/bronchoscopy-foundations/anatomy/adult-teaching-combined-left-basal-v1/graph.json',
)
const check = process.argv.includes('--check')

const read = (relative: string) => readFileSync(path.join(CASE_DIR, relative))
const sha = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex')
const graphRaw = read('metadata/airway_graph.json')
const labelsRaw = read('metadata/centerline_labels.json')
const manifestRaw = read('case_manifest.json')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const graph: any = JSON.parse(graphRaw.toString('utf8'))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const labels: any = JSON.parse(labelsRaw.toString('utf8'))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const manifest: any = JSON.parse(manifestRaw.toString('utf8'))

/** The source labels the edge as "LUL"; the teaching profile names the upper division itself. */
const UPPER_DIVISION_EDGE_ID = 21
const UPPER_DIVISION = { abbreviatedLabel: 'LUL-UD', fullLabel: 'Left Upper Lobe Upper Division' }
const SEGMENTAL = /^(RB([1-9]|10)|LB(1\+2|3|4|5|6|7\+8|9|10))$/
const DEPTH_INSIDE_SEGMENT = 1

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const edges = new Map<number, any>(graph.edges.map((e: any) => [e.id, e]))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodes = new Map<number, any>(graph.nodes.map((n: any) => [n.id, n]))
function labelOf(edgeId: number): { abbreviatedLabel: string; fullLabel: string } | null {
  if (edgeId === UPPER_DIVISION_EDGE_ID) return UPPER_DIVISION
  const entry = labels.edgeLabels[String(edgeId)]
  return entry ? { abbreviatedLabel: entry.abbreviatedLabel, fullLabel: entry.fullLabel } : null
}

const kept = new Set<number>()
function walk(edgeId: number, depthInsideSegment: number | null) {
  const label = labelOf(edgeId)?.abbreviatedLabel ?? null
  const depth =
    depthInsideSegment === null
      ? label && SEGMENTAL.test(label)
        ? 0
        : null
      : depthInsideSegment + 1
  if (depth !== null && depth > DEPTH_INSIDE_SEGMENT) return
  kept.add(edgeId)
  const edge = edges.get(edgeId)
  for (const child of nodes.get(edge.endNodeId)?.childEdgeIds ?? []) walk(child, depth)
}
for (const edgeId of nodes.get(graph.rootNodeId).childEdgeIds) walk(edgeId, null)

const round = (value: number) => Math.round(value * 100) / 100
const keptNodeIds = new Set<number>([graph.rootNodeId])
for (const edgeId of kept) {
  const edge = edges.get(edgeId)
  keptNodeIds.add(edge.startNodeId)
  keptNodeIds.add(edge.endNodeId)
}
const outNodes = [...keptNodeIds]
  .sort((a, b) => a - b)
  .map((id) => {
    const node = nodes.get(id)
    const childEdgeIds = node.childEdgeIds.filter((edgeId: number) => kept.has(edgeId))
    const degree = childEdgeIds.length + (node.parentEdgeId != null ? 1 : 0)
    return {
      id,
      lps: node.lps.map(round),
      kind:
        id === graph.rootNodeId
          ? 'root'
          : id === graph.carinaNodeId
            ? 'carina'
            : childEdgeIds.length === 0
              ? 'terminal'
              : childEdgeIds.length > 1
                ? 'bifurcation'
                : 'internal',
      degree,
      rootDistanceMm: round(node.rootDistanceMm),
      parentNodeId: node.parentNodeId,
      parentEdgeId: node.parentEdgeId,
      childEdgeIds,
    }
  })
const outEdges = [...kept]
  .sort((a, b) => a - b)
  .map((id) => {
    const edge = edges.get(id)
    return {
      id,
      sourceCurve: edge.sourceCurve,
      sourceCellId: edge.sourceCellId,
      startNodeId: edge.startNodeId,
      endNodeId: edge.endNodeId,
      lengthMm: round(edge.lengthMm),
      radiusMm: edge.radiusMm == null ? null : round(edge.radiusMm),
      pointsLps: edge.pointsLps.map((point: number[]) => point.map(round)),
    }
  })
const edgeLabels = Object.fromEntries(
  outEdges.flatMap((edge) => {
    const label = labelOf(edge.id)
    return label ? [[String(edge.id), label]] : []
  }),
)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ostialLandmarks = (manifest.ostialLandmarks ?? []).map((landmark: any) =>
  landmark.edgeId === UPPER_DIVISION_EDGE_ID
    ? { ...landmark, label: UPPER_DIVISION.abbreviatedLabel, description: UPPER_DIVISION.fullLabel }
    : landmark,
)

const output = {
  schema: 'bronchoscopy_foundations_teaching_graph/v1',
  profileId: 'adult-teaching-combined-left-basal-v1',
  units: 'mm',
  coordinateSystem: 'LPS',
  provenance: {
    caseId: manifest.id,
    caseVersion: manifest.version,
    sourceGraphSha256: sha(graphRaw),
    sourceLabelsSha256: sha(labelsRaw),
    sourceCaseManifestSha256: sha(manifestRaw),
    pruning: `Every airway to each segmental origin plus ${DEPTH_INSIDE_SEGMENT} generation inside the segment; edge 21 relabelled as the left upper division.`,
    generatedBy: 'scripts/bronchoscopy-foundations/build-teaching-graph.mts',
    safetyLabel: manifest.safetyLabel,
    clinicalReviewStatus: 'pending',
  },
  graph: {
    schema: graph.schema,
    units: graph.units,
    coordinateSystem: graph.coordinateSystem,
    source: graph.source,
    rootNodeId: graph.rootNodeId,
    carinaNodeId: graph.carinaNodeId,
    carinaLpsMm: graph.carinaLpsMm.map(round),
    terminalNodeIds: outNodes.filter((node) => node.kind === 'terminal').map((node) => node.id),
    nodes: outNodes,
    edges: outEdges,
  },
  edgeLabels,
  interaction: manifest.interaction,
  orientationLandmarks: manifest.orientationLandmarks ?? [],
  ostialLandmarks,
}
const text = `${JSON.stringify(output)}\n`
if (check) {
  // The commit hook formats JSON with prettier, so compare the content, not the bytes.
  const current = existsSync(OUT) ? JSON.stringify(JSON.parse(readFileSync(OUT, 'utf8'))) : null
  if (current !== JSON.stringify(output)) {
    console.error(`${path.relative(process.cwd(), OUT)} is out of date. Re-run without --check.`)
    process.exit(1)
  }
  console.log('Teaching graph matches its source.')
} else {
  mkdirSync(path.dirname(OUT), { recursive: true })
  writeFileSync(OUT, text)
  console.log(`wrote ${path.relative(process.cwd(), OUT)}`)
}
const labelCounts = new Map<string, number>()
for (const label of Object.values(edgeLabels) as { abbreviatedLabel: string }[])
  labelCounts.set(label.abbreviatedLabel, (labelCounts.get(label.abbreviatedLabel) ?? 0) + 1)
console.log(
  `edges ${outEdges.length}/${graph.edges.length} · nodes ${outNodes.length} · bytes ${Buffer.byteLength(text)} · labels ${[...labelCounts.keys()].length}`,
)
console.log([...labelCounts.entries()].map(([k, v]) => `${k}:${v}`).join(' '))
