import { z } from 'zod'

export const BAXTER_CRRT_ANALYTICS_MODULE_ID = 'baxter-crrt' as const

export const baxterCrrtAnalyticsLearnerCaseIds = [
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
  'CRRT-16',
  'CRRT-17',
  'CRRT-18',
] as const
export const baxterCrrtAnalyticsLearnerLessonIds = [
  'crrt-01.learn',
  'crrt-02.learn',
  'crrt-03.learn',
  'crrt-04.learn',
  'crrt-05.learn',
  'crrt-06.learn',
  'crrt-07.learn',
  'crrt-08.learn',
  'crrt-09.learn',
  'crrt-10.learn',
  'crrt-11.learn',
  'crrt-12.learn',
  'crrt-13.learn',
  'crrt-14.learn',
  'crrt-15.learn',
  'crrt-16.learn',
  'crrt-17.learn',
  'crrt-18.learn',
] as const
export const baxterCrrtAnalyticsDrillIds = [
  'DRILL-AIR',
  'DRILL-BLOOD-LEAK',
  'DRILL-GAIN-LOSS',
  'DRILL-BAG-SCALE',
  'DRILL-POWER',
  'DRILL-WRONG-SOLUTION',
  'DRILL-BLOOD-RETURN',
] as const
export const baxterCrrtAnalyticsToolIds = [
  'LAB-TRANSPORT',
  'LAB-PRESCRIPTION',
  'LAB-PREPOST-DILUTION',
  'LAB-PRESSURE-LOCALIZATION',
  'LAB-FLUID-LEDGER',
  'LAB-CITRATE-DASHBOARD',
] as const

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
  'drill_opened',
  'drill_completed',
  'tool_opened',
  'tool_completed',
  'mastery_completed',
  'station_completed',
] as const

const boundedScoreSchema = z.number().int().min(0).max(100)
const boundedCountSchema = z.number().int().min(0).max(100)
const boundedSecondsSchema = z.number().int().min(0).max(86_400)

export const baxterCrrtAnalyticsEventPayloadSchema = z
  .object({
    interaction: z.enum(baxterCrrtAnalyticsInteractions),
    caseId: z.enum(baxterCrrtAnalyticsLearnerCaseIds).optional(),
    lessonId: z.enum(baxterCrrtAnalyticsLearnerLessonIds).optional(),
    drillId: z.enum(baxterCrrtAnalyticsDrillIds).optional(),
    toolId: z.enum(baxterCrrtAnalyticsToolIds).optional(),
    masteryId: z.literal('MASTERY-PRISMAX-01').optional(),
    pathway: z.enum(['orientation', 'learn', 'practice', 'mastery']),
    device: z.enum(['prismax-aw8035-2xx', 'prismaflex-g5036003-6xx']),
    role: z.enum(['prescriber', 'operator', 'integrated']),
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
    const identityCount = [
      payload.caseId,
      payload.lessonId,
      payload.drillId,
      payload.toolId,
      payload.masteryId,
    ].filter((value) => value !== undefined).length
    if (identityCount > 1) addIssue('caseId', 'CRRT events accept at most one artifact identity.')

    const requires = (
      interactions: readonly (typeof baxterCrrtAnalyticsInteractions)[number][],
      key: 'caseId' | 'lessonId' | 'drillId' | 'toolId' | 'masteryId',
    ) => {
      if (interactions.includes(payload.interaction) && !payload[key]) {
        addIssue(key, `${payload.interaction} requires ${key}.`)
      }
    }
    requires(['lesson_opened', 'lesson_completed'], 'lessonId')
    requires(
      [
        'case_opened',
        'prediction_committed',
        'hint_requested',
        'first_safe_action',
        'reassessment_completed',
        'case_completed',
      ],
      'caseId',
    )
    requires(['drill_opened', 'drill_completed'], 'drillId')
    requires(['tool_opened', 'tool_completed'], 'toolId')
    requires(['mastery_completed'], 'masteryId')

    if (payload.lessonId && payload.pathway !== 'learn') {
      addIssue('pathway', 'Lesson events use the Learn pathway.')
    }
    if (payload.caseId && !['learn', 'practice', 'mastery'].includes(payload.pathway)) {
      addIssue('pathway', 'Case events require Learn, Practice, or Mastery.')
    }
    if (payload.masteryId && payload.pathway !== 'mastery') {
      addIssue('pathway', 'Mastery events use the Mastery pathway.')
    }

    const completion = [
      'lesson_completed',
      'case_completed',
      'drill_completed',
      'tool_completed',
      'mastery_completed',
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
      payload.interaction === 'case_completed' || payload.interaction === 'mastery_completed'
    const outcomeFields = [payload.score, payload.criticalErrorCount, payload.hintCount]
    if (outcomeEvent && outcomeFields.some((value) => value === undefined)) {
      addIssue('score', 'Case and Mastery completion require score, critical errors, and hints.')
    }
    if (!outcomeEvent && outcomeFields.some((value) => value !== undefined)) {
      addIssue('score', 'Outcome fields are limited to case or Mastery completion.')
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
  if (interaction === 'case_completed' || interaction === 'mastery_completed') {
    return 'quiz_submitted' as const
  }
  if (interaction === 'station_completed') return 'section_completed' as const
  return 'module_interaction' as const
}

export function validateBaxterCrrtAnalyticsEventPayload(value: unknown) {
  return baxterCrrtAnalyticsEventPayloadSchema.safeParse(value)
}
