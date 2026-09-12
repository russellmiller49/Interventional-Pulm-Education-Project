import { z } from 'zod'
import { add, normalize, scale, subtract, type Vec3 } from './coordinates'

const point = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])
export const previewGraphSchema = z
  .object({
    frame: z.literal('LPS-mm'),
    rootNodeId: z.number().int(),
    edges: z
      .array(
        z.object({
          id: z.number().int(),
          startNodeId: z.number().int(),
          endNodeId: z.number().int(),
          pointsLps: z.array(point).min(2).max(2000),
        }),
      )
      .min(1)
      .max(3000),
  })
  .superRefine((graph, ctx) => {
    const parents = new Map<number, number>(),
      ids = new Set<number>()
    for (const edge of graph.edges) {
      if (ids.has(edge.id) || parents.has(edge.endNodeId))
        ctx.addIssue({ code: 'custom', message: 'Ambiguous topology' })
      ids.add(edge.id)
      parents.set(edge.endNodeId, edge.startNodeId)
    }
    if (parents.has(graph.rootNodeId))
      ctx.addIssue({ code: 'custom', message: 'Root has a parent' })
    for (const e of graph.edges) {
      let node = e.endNodeId
      const visited = new Set<number>()
      while (node !== graph.rootNodeId) {
        if (visited.has(node) || !parents.has(node)) {
          ctx.addIssue({ code: 'custom', message: 'Cycle or disconnected component' })
          break
        }
        visited.add(node)
        node = parents.get(node)!
      }
    }
  })
export type PreviewGraph = z.infer<typeof previewGraphSchema>
export type PreviewEdge = PreviewGraph['edges'][number]
export const PREVIEW_BASE = '/branch-tracing/preview-v1'
export const PREVIEW_CT = {
  origin: [-182.1552734375, -374.1552734375, -368.5] as Vec3,
  spacing: [1.37890625, 1.37890625, 1.2421875] as Vec3,
  count: 256,
}

/** Traverse actual arc length, independently of CT slice number. */
export function atArcLength(points: Vec3[], fraction: number) {
  const lengths = points.slice(1).map((p, i) => Math.hypot(...subtract(p, points[i])))
  const total = lengths.reduce((a, b) => a + b, 0)
  let remaining = Math.max(0, Math.min(1, fraction)) * total
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const direction = normalize(subtract(points[i + 1], points[i]))
      return { position: add(points[i], scale(direction, remaining)), direction, total }
    }
    remaining -= lengths[i]
  }
  return { position: points[0], direction: [0, 0, -1] as Vec3, total }
}
