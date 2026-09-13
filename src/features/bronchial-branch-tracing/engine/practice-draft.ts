import { z } from 'zod'
import { markSchema, orientationSchema, viewerSchema } from './ct-draft'
import { responseSchema } from './route-draft'
import { traceById } from '../geometry/native-ct'
import { traceComplete, validBranch, validCtMark } from './ct-session'

const workSchema = responseSchema
  .omit({ marks: true, course: true, targetRelation: true, orientation: true })
  .extend({
    marks: z.array(markSchema.nullable()),
    recorded: z.array(z.boolean()),
    course: z.union([responseSchema.shape.course, z.literal('')]),
    targetRelation: z.union([responseSchema.shape.targetRelation, z.literal('')]),
    orientation: orientationSchema,
    alignment: responseSchema.shape.orientation.nullable(),
  })
const schema = z.object({
  attempts: z.record(
    z.array(
      z.object({
        mark: markSchema,
        branch: responseSchema.shape.branches.element,
        hints: z.number().int().nonnegative(),
      }),
    ),
  ),
  index: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  furthest: z.number().int().nonnegative(),
  work: workSchema,
  drafts: z.record(workSchema),
  responses: z.array(responseSchema.nullable()),
  firstOrientations: z.array(orientationSchema.nullable()),
  submitted: z.boolean(),
  views: z.record(viewerSchema),
})
export type PracticeDraft = z.infer<typeof schema>
export function parsePracticeDraft(value: unknown, ids: string[]): PracticeDraft | null {
  const parsed = schema.safeParse(value)
  if (!parsed.success) return null
  const s = parsed.data
  if (
    s.index >= ids.length ||
    s.furthest >= ids.length ||
    s.index > s.furthest ||
    s.responses.length !== ids.length ||
    s.firstOrientations.length !== ids.length ||
    s.active >= traceById(ids[s.index]).checkpoints.length
  )
    return null
  for (const [id, work] of Object.entries({ ...s.drafts, [ids[s.index]]: s.work })) {
    if (!ids.includes(id)) return null
    const trace = traceById(id)
    if (
      work.marks.length !== trace.checkpoints.length ||
      work.branches.length !== work.marks.length ||
      work.recorded.length !== work.marks.length ||
      work.marks.some((m, i) => m && !validCtMark(m, trace, i)) ||
      work.branches.some((b, i) => b !== null && !validBranch(trace, i, b)) ||
      work.recorded.some(
        (v, i) => v && (!work.marks[i] || !validBranch(trace, i, work.branches[i])),
      )
    )
      return null
  }
  if (
    s.responses.some(
      (r, i) => r && !traceComplete(traceById(ids[i]), { ...r, recorded: r.marks.map(() => true) }),
    ) ||
    (s.submitted && !s.responses.every(Boolean))
  )
    return null
  for (const [id, view] of Object.entries(s.views)) {
    if (!ids.includes(id)) return null
    const trace = traceById(id)
    if (view.slice < trace.range[0] || view.slice > trace.range[1]) return null
  }
  return s
}
