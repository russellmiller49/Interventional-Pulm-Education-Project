import { z } from 'zod'

export const surveyItemSchema = z
  .object({
    id: z.enum(['adequacy', 'cancer', 'preliminaryDiagnosis', 'confidence', 'freeText']),
    prompt: z.string().trim().min(1).max(500),
    required: z.boolean(),
    // Study authors supply the actual response labels, including the confidence scale.
    options: z.array(z.string().trim().min(1).max(300)).max(30),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.id !== 'freeText' && item.options.length < 2)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Configure at least two response options.',
      })
    if (new Set(item.options).size !== item.options.length)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Response options must be unique.' })
  })
export const studyConfigSchema = z
  .object({
    id: z.string().uuid().optional(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().trim().min(1).max(160),
    version: z.string().trim().min(1).max(80),
    active: z.boolean(),
    rounds: z
      .array(
        z
          .object({
            key: z.string().regex(/^[a-z0-9-]{1,40}$/),
            title: z.string().trim().min(1).max(160),
            showLegend: z.boolean(),
            showColorImage: z.boolean(),
            feedbackAfterSubmission: z.boolean(),
            survey: z.array(surveyItemSchema).min(3).max(5),
            cases: z
              .array(
                z
                  .object({ caseId: z.string().uuid(), revision: z.number().int().positive() })
                  .strict(),
              )
              .min(1)
              .max(200),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .superRefine((config, ctx) => {
    if (new Set(config.rounds.map((r) => r.key)).size !== config.rounds.length)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Round keys must be unique.' })
    for (const round of config.rounds) {
      const ids = round.survey.map((item) => item.id)
      if (
        new Set(ids).size !== ids.length ||
        !['adequacy', 'cancer', 'confidence'].every((id) =>
          ids.includes(id as (typeof ids)[number]),
        )
      )
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Each round requires unique adequacy, cancer and confidence items.',
        })
      if (new Set(round.cases.map((c) => c.caseId)).size !== round.cases.length)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A case may occur only once per round.',
        })
    }
  })
export type StudyConfig = z.infer<typeof studyConfigSchema>
export type SurveyItem = z.infer<typeof surveyItemSchema>
export type Responses = Record<string, string>
export type TrainingStage = 'opened' | 'revealed' | 'completed'
export interface TrainingProgress {
  case_id: string
  case_revision: number
  opened_at: string
  revealed_at: string | null
  completed_at: string | null
}
export interface StudyAttempt {
  id: string
  user_id: string
  study_id: string
  study_version: string
  round_key: string
  case_id: string
  case_revision: number
  case_order: number
  started_at: string
  submitted_at: string | null
  elapsed_ms: number | null
  responses: Responses
  confidence: string | null
  response_complete: boolean
  missing_items: string[]
}
export function validateResponses(survey: SurveyItem[], responses: unknown) {
  const parsed = z.record(z.string().max(4000)).parse(responses)
  const known = new Set(survey.map((item) => item.id))
  if (Object.keys(parsed).some((key) => !known.has(key as SurveyItem['id'])))
    throw new Error('Unknown survey item.')
  for (const item of survey) {
    const value = parsed[item.id]?.trim()
    if (item.required && !value) throw new Error(`Complete: ${item.prompt}`)
    if (value && item.id !== 'freeText' && !item.options.includes(value))
      throw new Error('Choose a configured response.')
  }
  return Object.fromEntries(
    survey
      .filter((item) => parsed[item.id]?.trim())
      .map((item) => [item.id, parsed[item.id].trim()]),
  )
}
