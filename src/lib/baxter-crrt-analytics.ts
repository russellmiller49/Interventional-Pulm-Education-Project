import { z } from 'zod'

export const BAXTER_CRRT_ANALYTICS_MODULE_ID = 'baxter-crrt' as const

export const baxterCrrtAnalyticsInteractions = [
  'pathway_selected',
  'device_selected',
  'role_selected',
  'lesson_opened',
  'lesson_completed',
  'case_opened',
  'prediction_committed',
  'hint_requested',
  'first_safe_action',
  'reassessment_completed',
  'case_completed',
  'station_completed',
  'mastery_completed',
] as const

const stableIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9]+(?:[-_.:][A-Za-z0-9]+)*$/)

const caseIdSchema = z.string().regex(/^CRRT-(0[1-9]|1[0-8])$/)
const pathwaySchema = z.enum(['orientation', 'learn', 'practice', 'mastery'])
const deviceSchema = z.enum(['prismax-aw8035-2xx', 'prismaflex-g5036003-6xx'])
const roleSchema = z.enum(['prescriber', 'operator', 'integrated'])
const boundedScoreSchema = z.number().int().min(0).max(100)
const boundedCountSchema = z.number().int().min(0).max(100)
const boundedSecondsSchema = z.number().int().min(0).max(86_400)

export const baxterCrrtAnalyticsEventPayloadSchema = z
  .object({
    interaction: z.enum(baxterCrrtAnalyticsInteractions),
    caseId: caseIdSchema.optional(),
    lessonId: stableIdSchema.optional(),
    pathway: pathwaySchema,
    device: deviceSchema,
    role: roleSchema,
    score: boundedScoreSchema.optional(),
    criticalErrorCount: boundedCountSchema.optional(),
    hintCount: boundedCountSchema.optional(),
    elapsedSeconds: boundedSecondsSchema.optional(),
    timeToFirstSafeActionSeconds: boundedSecondsSchema.optional(),
    completed: z.boolean().optional(),
    reassessmentCompleted: z.boolean().optional(),
  })
  .strict()
  .superRefine((payload, context) => {
    const hasCaseId = payload.caseId !== undefined
    const hasLessonId = payload.lessonId !== undefined
    const addIssue = (path: string, message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })

    if (hasCaseId && hasLessonId) {
      addIssue('caseId', 'CRRT analytics events cannot identify both a case and a lesson.')
    }

    const lessonInteraction =
      payload.interaction === 'lesson_opened' || payload.interaction === 'lesson_completed'
    const caseInteraction =
      payload.interaction === 'case_opened' ||
      payload.interaction === 'case_completed' ||
      payload.interaction === 'first_safe_action'
    const attemptInteraction =
      payload.interaction === 'prediction_committed' ||
      payload.interaction === 'hint_requested' ||
      payload.interaction === 'reassessment_completed'

    if (lessonInteraction && (!hasLessonId || hasCaseId)) {
      addIssue('lessonId', 'Lesson events require one lesson ID and no case ID.')
    }
    if (lessonInteraction && payload.pathway !== 'learn') {
      addIssue('pathway', 'Lesson events are limited to the Learn pathway.')
    }
    if (caseInteraction && (!hasCaseId || hasLessonId)) {
      addIssue('caseId', 'Case events require one CRRT case ID and no lesson ID.')
    }
    if (caseInteraction && payload.pathway !== 'practice' && payload.pathway !== 'mastery') {
      addIssue('pathway', 'Case events are limited to Practice or Mastery.')
    }
    if (attemptInteraction && hasCaseId === hasLessonId) {
      addIssue('caseId', 'Attempt events require exactly one case or lesson ID.')
    }
    if (attemptInteraction && payload.pathway === 'orientation') {
      addIssue('pathway', 'Orientation cannot emit prediction, hint, or reassessment events.')
    }

    const completionInteraction =
      payload.interaction === 'lesson_completed' ||
      payload.interaction === 'case_completed' ||
      payload.interaction === 'station_completed' ||
      payload.interaction === 'mastery_completed'
    if (completionInteraction && payload.completed !== true) {
      addIssue('completed', 'Completion events must set completed to true.')
    }
    if (!completionInteraction && payload.completed !== undefined) {
      addIssue('completed', 'Only completion events may include completed.')
    }

    if (payload.interaction === 'reassessment_completed') {
      if (payload.reassessmentCompleted !== true) {
        addIssue(
          'reassessmentCompleted',
          'Reassessment completion events must set reassessmentCompleted to true.',
        )
      }
    } else if (
      payload.interaction !== 'case_completed' &&
      payload.reassessmentCompleted !== undefined
    ) {
      addIssue(
        'reassessmentCompleted',
        'Only reassessment or case completion events may include reassessmentCompleted.',
      )
    }

    const caseOutcomeFields = [payload.score, payload.criticalErrorCount, payload.hintCount]
    if (payload.interaction === 'case_completed') {
      if (caseOutcomeFields.some((value) => value === undefined)) {
        addIssue('score', 'Case completion requires score, critical-error count, and hint count.')
      }
      if (payload.reassessmentCompleted === undefined) {
        addIssue(
          'reassessmentCompleted',
          'Case completion must report whether reassessment was completed.',
        )
      }
    } else if (caseOutcomeFields.some((value) => value !== undefined)) {
      addIssue('score', 'Only case completion events may include outcome scores or counts.')
    }

    if (
      payload.timeToFirstSafeActionSeconds !== undefined &&
      payload.interaction !== 'first_safe_action' &&
      payload.interaction !== 'case_completed'
    ) {
      addIssue(
        'timeToFirstSafeActionSeconds',
        'Only first-safe-action or case-completion events may include this metric.',
      )
    }
    if (
      payload.interaction === 'first_safe_action' &&
      payload.timeToFirstSafeActionSeconds === undefined
    ) {
      addIssue(
        'timeToFirstSafeActionSeconds',
        'First-safe-action events require a bounded elapsed-time metric.',
      )
    }

    if (payload.interaction === 'mastery_completed' && payload.pathway !== 'mastery') {
      addIssue('pathway', 'Mastery completion requires the Mastery pathway.')
    }
  })

export type BaxterCrrtAnalyticsEventPayload = z.infer<typeof baxterCrrtAnalyticsEventPayloadSchema>

export function validateBaxterCrrtAnalyticsEventPayload(value: unknown) {
  return baxterCrrtAnalyticsEventPayloadSchema.safeParse(value)
}
