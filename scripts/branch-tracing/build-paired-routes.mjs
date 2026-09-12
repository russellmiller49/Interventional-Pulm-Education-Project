import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { format } from 'prettier'

const source = readFileSync('public/fluoroview/cases/patient-new/metadata/airway_graph.json')
const graph = JSON.parse(source)
const manifest = JSON.parse(readFileSync('public/branch-tracing/targets-v1/manifest.json'))
const sha = createHash('sha256').update(source).digest('hex')
if (sha !== manifest.sourceGraphSha256)
  throw new Error('Source graph differs from the CT target source')
const ids = new Set(manifest.traces.flatMap((t) => t.sourceEdgeIds))
const edges = graph.edges
  .filter((e) => ids.has(e.id))
  .map((e) => ({ id: e.id, points: e.pointsLps }))
writeFileSync(
  'src/features/bronchial-branch-tracing/geometry/paired-routes.json',
  await format(JSON.stringify({ sourceSha256: sha, edges }), { parser: 'json' }),
)
console.log(`Wrote ${edges.length} unchanged source polylines for paired CT/bronchoscopy`)
