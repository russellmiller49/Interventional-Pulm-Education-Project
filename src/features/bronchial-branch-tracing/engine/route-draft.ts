import { z } from 'zod'
import type { CtTrace, CtJunctionAttempt } from '../content/ct-types'
import { validBranch, validCtMark, traceComplete } from './ct-session'
import { markSchema, orientationSchema, viewerSchema } from './ct-draft'

const branch = z.union([z.number().int().nonnegative(), z.literal('unresolved')]).nullable()
const course = z.enum(['cranial', 'caudal', 'horizontal', 'returning', 'uncertain'])
const targetRelation = z.enum(['approaches', 'unresolved', 'different-structure'])
export const responseSchema = z.object({
  marks: z.array(markSchema),
  branches: z.array(branch),
  course,
  targetRelation,
  hints: z.number().int().nonnegative(),
  orientation: z.object({ first: orientationSchema, used: orientationSchema }),
})
const sessionSchema = z.object({
  targetViewed: z.record(z.boolean()).default({}),
  junctionHistory: z
    .record(
      z.array(
        z.object({
          mark: markSchema,
          branch,
          hints: z.number().int().nonnegative(),
          orientation: orientationSchema.optional(),
          support: z.enum(['coached', 'after-comparison']),
        }),
      ),
    )
    .default({}),
  step: z.number().int().min(0).max(5),
  active: z.number().int().nonnegative(),
  marks: z.array(markSchema.nullable()),
  branches: z.array(branch),
  recorded: z.array(z.boolean()),
  course: z.union([course, z.literal('')]),
  targetRelation: z.union([targetRelation, z.literal('')]),
  hints: z.number().int().nonnegative(),
  prediction: responseSchema.nullable(),
  transfer: responseSchema.nullable(),
  complete: z.boolean(),
  orientation: orientationSchema,
  orientationAttempts: z.array(orientationSchema),
  alignment: orientationSchema.nullable(),
})
const draftSchema = z.object({ session: sessionSchema, views: z.record(viewerSchema) })
export type RouteDraft = z.infer<typeof draftSchema>

export function validJunctionHistory(
  history: Record<string, Pick<CtJunctionAttempt, 'mark' | 'branch'>[]>,
  traces: CtTrace[],
) {
  return Object.entries(history).every(([key, attempts]) => {
    for (const trace of traces) {
      const index = trace.checkpoints.findIndex((point) => key === `${trace.id}.${point.id}`)
      if (index >= 0)
        return attempts.every(
          (a) => validCtMark(a.mark, trace, index) && validBranch(trace, index, a.branch),
        )
    }
    return false
  })
}

export function parseRouteDraft(
  value: unknown,
  prediction: CtTrace,
  transfer: CtTrace,
  example: CtTrace,
): RouteDraft | null {
  const parsed = draftSchema.safeParse(value)
  if (!parsed.success) return null
  const { session: s, views } = parsed.data
  if (
    !validJunctionHistory(s.junctionHistory, [prediction, transfer]) ||
    Object.keys(s.targetViewed).some(
      (id) => ![prediction, transfer, example].some((t) => t.id === id),
    )
  )
    return null
  const trace = s.step === 5 ? transfer : prediction
  if (
    s.active >= (s.step === 0 ? example : trace).checkpoints.length ||
    s.marks.length !== trace.checkpoints.length ||
    s.branches.length !== s.marks.length ||
    s.recorded.length !== s.marks.length
  )
    return null
  if (
    s.marks.some((m, i) => m && !validCtMark(m, trace, i)) ||
    s.branches.some((b, i) => b !== null && !validBranch(trace, i, b))
  )
    return null
  if (
    s.recorded.some((v, i) => v && (!s.marks[i] || !validBranch(trace, i, s.branches[i]))) ||
    (s.alignment && !s.orientationAttempts.length)
  )
    return null
  if ((s.step >= 3 && !s.prediction) || (s.complete && !s.transfer)) return null
  for (const [response, source] of [
    [s.prediction, prediction],
    [s.transfer, transfer],
  ] as const) {
    if (
      response &&
      !traceComplete(source, { ...response, recorded: response.marks.map(() => true) })
    )
      return null
  }
  if (Object.values(views).some((v) => v.slice < 239 || v.slice > 478)) return null
  return parsed.data
}
