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

// One generation past every daughter of every fork: where the scope looks when the learner turns
// into a daughter the route does not take and drives to its next division, and what the model map
// draws inside that daughter's arc. A daughter one route skips may be another route's own, so all
// of them are listed. Kept apart from paired-routes.json: the lumen verdict reads every edge in
// that file as a named airway, and these are not named.
const CHILD_REACH_MM = 15
const offRoute = [
  ...new Set(
    manifest.traces.flatMap((t) =>
      t.checkpoints.flatMap((c) =>
        c.decision ? c.decision.options.map((o) => o.sourceEdgeId) : [],
      ),
    ),
  ),
]
const byId = new Map(graph.edges.map((e) => [e.id, e]))
const trim = (points) => {
  const out = [points[0]]
  let travelled = 0
  for (let i = 1; i < points.length && travelled < CHILD_REACH_MM; i++) {
    travelled += Math.hypot(...points[i].map((v, axis) => v - points[i - 1][axis]))
    out.push(points[i])
  }
  return out
}
const children = offRoute
  .sort((a, b) => a - b)
  .map((parentEdgeId) => ({
    parentEdgeId,
    edges: graph.edges
      .filter((e) => e.startNodeId === byId.get(parentEdgeId).endNodeId)
      .map((e) => ({ id: e.id, radiusMm: e.radiusMm, points: trim(e.pointsLps) })),
  }))
const radii = Object.fromEntries(
  [...ids, ...children.flatMap((c) => c.edges.map((e) => e.id))]
    .sort((a, b) => a - b)
    .map((id) => [id, byId.get(id).radiusMm]),
)
writeFileSync(
  'src/features/bronchial-branch-tracing/geometry/off-route-children.json',
  await format(JSON.stringify({ sourceSha256: sha, reachMm: CHILD_REACH_MM, children, radii }), {
    parser: 'json',
  }),
)
console.log(
  `Wrote the next division of ${children.length} fork daughters (${children.filter((c) => !c.edges.length).length} end in the model) and ${Object.keys(radii).length} airway radii`,
)
