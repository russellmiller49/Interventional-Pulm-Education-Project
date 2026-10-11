import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { format } from 'prettier'

const source = readFileSync('public/fluoroview/cases/patient-new/metadata/airway_graph.json')
const graph = JSON.parse(source)
const manifest = JSON.parse(
  readFileSync('src/features/bronchial-branch-tracing/geometry/branch-decisions.json'),
)
const sha = createHash('sha256').update(source).digest('hex')
if (sha !== manifest.sourceGraphSha256)
  throw new Error('Source graph differs from the CT target source')
// Every edge a route runs along, and every parent and daughter of every fork on a route. A
// daughter the route does not take still has to be found on the CT: the lumen verdict needs to
// know where it crosses the slice the learner is on.
const ids = new Set(manifest.traces.flatMap((t) => t.sourceEdgeIds))
const routeEdges = ids.size
for (const trace of manifest.traces)
  for (const checkpoint of trace.checkpoints) {
    if (!checkpoint.decision) continue
    ids.add(checkpoint.decision.parent.sourceEdgeId)
    for (const option of checkpoint.decision.options) ids.add(option.sourceEdgeId)
  }
const edges = graph.edges
  .filter((e) => ids.has(e.id))
  .map((e) => ({ id: e.id, points: e.pointsLps }))
if (edges.length !== ids.size)
  throw new Error('A fork names an edge the source graph does not have')
writeFileSync(
  'src/features/bronchial-branch-tracing/geometry/paired-routes.json',
  await format(JSON.stringify({ sourceSha256: sha, edges }), { parser: 'json' }),
)
console.log(
  `Wrote ${edges.length} unchanged source polylines: ${routeEdges} along routes, ${edges.length - routeEdges} daughters the routes do not take`,
)
