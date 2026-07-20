import { z } from 'zod'

export const BAXTER_CRRT_ANALYTICS_MODULE_ID = 'baxter-crrt' as const

export const baxterCrrtAnalyticsSections = ['overview', 'learn', 'practice', 'assess'] as const

export const baxterCrrtAnalyticsPracticeCaseIds = [
  'CRRT-01',
  'CRRT-02',
  'CRRT-03',
  'CRRT-04',
  'CRRT-05',
  'CRRT-06',
  'CRRT-07',
  'CRRT-08',
  'CRRT-09',
  'CRRT-10',
  'CRRT-11',
  'CRRT-12',
  'CRRT-13',
  'CRRT-14',
  'CRRT-15',
  'CRRT-17',
  'CRRT-18',
] as const

export const baxterCrrtAnalyticsLearnerLessonIds = [
  'crrt-indications-modality',
  'crrt-solute-transport',
  'crrt-prescription-dosing',
  'crrt-circuit-pressures',
  'crrt-anticoagulation',
  'crrt-alarms-troubleshooting',
  'crrt-fluid-liberation',
] as const

export const baxterCrrtAnalyticsInteractions = [
  'section_opened',
  'role_selected',
  'lesson_opened',
  'lesson_completed',
  'case_opened',
  'prediction_committed',
  'hint_requested',
  'first_safe_action',
  'reassessment_completed',
  'case_completed',
  'capstone_completed',
  'station_completed',
] as const

const boundedScoreSchema = z.number().int().min(0).max(100)
const boundedCountSchema = z.number().int().min(0).max(100)
const boundedSecondsSchema = z.number().int().min(0).max(86_400)

export const baxterCrrtAnalyticsEventPayloadSchema = z
  .object({
    interaction: z.enum(baxterCrrtAnalyticsInteractions),
    section: z.enum(baxterCrrtAnalyticsSections),
    caseId: z.enum(baxterCrrtAnalyticsPracticeCaseIds).optional(),
    lessonId: z.enum(baxterCrrtAnalyticsLearnerLessonIds).optional(),
    masteryId: z.literal('MASTERY-PRISMAX-01').optional(),
    role: z.enum(['prescriber', 'operator', 'integrated']).optional(),
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
    const addIssue = (path: string, message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })
    const identityCount = [payload.caseId, payload.lessonId, payload.masteryId].filter(
      (value) => value !== undefined,
    ).length
    if (identityCount > 1) addIssue('caseId', 'CRRT events accept at most one artifact identity.')

    if (['lesson_opened', 'lesson_completed'].includes(payload.interaction) && !payload.lessonId) {
      addIssue('lessonId', `${payload.interaction} requires lessonId.`)
    }
    if (
      [
        'case_opened',
        'prediction_committed',
        'hint_requested',
        'first_safe_action',
        'reassessment_completed',
        'case_completed',
      ].includes(payload.interaction) &&
      !payload.caseId
    ) {
      addIssue('caseId', `${payload.interaction} requires caseId.`)
    }
    if (payload.interaction === 'capstone_completed' && !payload.masteryId) {
      addIssue('masteryId', 'capstone_completed requires masteryId.')
    }
    if (payload.interaction === 'role_selected' && !payload.role) {
      addIssue('role', 'role_selected requires role.')
    }

    if (payload.lessonId && payload.section !== 'learn') {
      addIssue('section', 'Lesson events use the Learn section.')
    }
    if (payload.caseId && payload.section !== 'practice') {
      addIssue('section', 'Case events use the Practice section.')
    }
    if (payload.masteryId && payload.section !== 'assess') {
      addIssue('section', 'Capstone events use the Assess section.')
    }

    const completion = [
      'lesson_completed',
      'case_completed',
      'capstone_completed',
      'station_completed',
    ].includes(payload.interaction)
    if (completion && payload.completed !== true) {
      addIssue('completed', 'Completion events must set completed to true.')
    }
    if (!completion && payload.completed !== undefined) {
      addIssue('completed', 'Only completion events may include completed.')
    }

    if (
      payload.interaction === 'reassessment_completed' &&
      payload.reassessmentCompleted !== true
    ) {
      addIssue('reassessmentCompleted', 'Reassessment completion must be true.')
    }

    const outcomeEvent =
      payload.interaction === 'case_completed' || payload.interaction === 'capstone_completed'
    const outcomeFields = [payload.score, payload.criticalErrorCount, payload.hintCount]
    if (outcomeEvent && outcomeFields.some((value) => value === undefined)) {
      addIssue('score', 'Case and capstone completion require score, critical errors, and hints.')
    }
    if (!outcomeEvent && outcomeFields.some((value) => value !== undefined)) {
      addIssue('score', 'Outcome fields are limited to case or capstone completion.')
    }
    if (
      payload.timeToFirstSafeActionSeconds !== undefined &&
      payload.interaction !== 'first_safe_action' &&
      payload.interaction !== 'case_completed'
    ) {
      addIssue('timeToFirstSafeActionSeconds', 'This metric is limited to case safety events.')
    }
  })

export type BaxterCrrtAnalyticsEventPayload = z.infer<typeof baxterCrrtAnalyticsEventPayloadSchema>

export function expectedBaxterCrrtAnalyticsEventType(
  interaction: BaxterCrrtAnalyticsEventPayload['interaction'],
) {
  if (interaction === 'case_completed' || interaction === 'capstone_completed') {
    return 'quiz_submitted' as const
  }
  if (interaction === 'station_completed') return 'section_completed' as const
  return 'module_interaction' as const
}

export function validateBaxterCrrtAnalyticsEventPayload(value: unknown) {
  return baxterCrrtAnalyticsEventPayloadSchema.safeParse(value)
}
