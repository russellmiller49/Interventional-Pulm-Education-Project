import { z } from 'zod'

/** Original private cells, distinct from the current teaching text and release decisions. */
export const curriculumSourceSchema = z
  .object({
    workbookSha256: z.string().regex(/^[a-f0-9]{64}$/),
    sourceSheet: z.literal('Curriculum Sequence'),
    sourceRow: z.number().int().min(2).max(1000),
    sourceValues: z
      .object({
        'Overall Order': z.number().int().positive(),
        Module: z.string().min(1).max(200),
        'Order in Module': z.number().int().positive(),
        'Full Case Name': z.string().min(1).max(1000),
        'Curriculum Role': z.string().max(8000).nullable(),
        'Teaching Objective / Why Here': z.string().max(8000).nullable(),
        'Full Learner-Facing Text': z.string().min(1).max(32000),
        'Internal Note · Not Learner-Facing': z.string().max(8000).nullable(),
      })
      .strict(),
  })
  .strict()

export type CurriculumSource = z.infer<typeof curriculumSourceSchema>
