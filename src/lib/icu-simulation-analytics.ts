import { z } from 'zod'

export const ICU_SIMULATION_ANALYTICS_MODULE_ID = 'icu-simulation' as const

export const icuSimulationAnalyticsSections = [
  'overview',
  'learn',
  'practice',
  'assess',
  'sandbox',
] as const

export const icuSimulationAnalyticsScenarioIds = [
  'septic-ards-aki',
  'lv-cardiogenic',
  'massive-pe-rv',
  'hemorrhagic',
  'tamponade',
  'mixed-cardiogenic-vasodilatory',
] as const

export const icuSimulationAnalyticsInteractions = [
  'section_opened',
  'scenario_opened',
  'prediction_committed',
  'reassessment_completed',
  'scenario_completed',
  'module_completed',
] as const

export const icuSimulationScoreBands = [
  'not-scored',
  'needs-review',
  'approaching-mastery',
  'mastery',
] as const

export const icuSimulationElapsedBands = [
  'under-15-minutes',
  '15-to-30-minutes',
  '31-to-60-minutes',
  'over-60-minutes',
] as const

const boundedCountSchema = z.number().int().min(0).max(100)

export const icuSimulationAnalyticsEventPayloadSchema = z
  .object({
    interaction: z.enum(icuSimulationAnalyticsInteractions),
    section: z.enum(icuSimulationAnalyticsSections),
    scenarioId: z.enum(icuSimulationAnalyticsScenarioIds).optional(),
    scoreBand: z.enum(icuSimulationScoreBands).optional(),
    elapsedBand: z.enum(icuSimulationElapsedBands).optional(),
    criticalErrorCount: boundedCountSchema.optional(),
    completed: z.boolean().optional(),
    mastered: z.boolean().optional(),
  })
  .strict()
  .superRefine((payload, context) => {
    const addIssue = (path: keyof typeof payload, message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })
    const scenarioInteractions = new Set([
      'scenario_opened',
      'prediction_committed',
      'reassessment_completed',
      'scenario_completed',
    ])

    if (scenarioInteractions.has(payload.interaction) && !payload.scenarioId) {
      addIssue('scenarioId', `${payload.interaction} requires scenarioId.`)
    }

    if (payload.scenarioId && payload.section === 'overview') {
      addIssue('section', 'Scenario events cannot use the overview section.')
    }

    const completion =
      payload.interaction === 'scenario_completed' || payload.interaction === 'module_completed'
    if (completion && payload.completed !== true) {
      addIssue('completed', 'Completion events must set completed to true.')
    }
    if (!completion && payload.completed !== undefined) {
      addIssue('completed', 'Only completion events may include completed.')
    }

    const outcomeFields = [
      payload.scoreBand,
      payload.elapsedBand,
      payload.criticalErrorCount,
      payload.mastered,
    ]
    if (
      payload.interaction === 'scenario_completed' &&
      outcomeFields.some((value) => value == null)
    ) {
      addIssue(
        'scoreBand',
        'Scenario completion requires score band, elapsed band, critical errors, and mastery.',
      )
    }
    if (
      payload.interaction !== 'scenario_completed' &&
      outcomeFields.some((value) => value !== undefined)
    ) {
      addIssue('scoreBand', 'Outcome summaries are limited to scenario completion.')
    }

    if (payload.interaction === 'module_completed' && payload.section !== 'assess') {
      addIssue('section', 'Module completion is emitted from the Assess section only.')
    }
  })

export type IcuSimulationAnalyticsEventPayload = z.infer<
  typeof icuSimulationAnalyticsEventPayloadSchema
>

export function expectedIcuSimulationAnalyticsEventType(
  interaction: IcuSimulationAnalyticsEventPayload['interaction'],
) {
  if (interaction === 'scenario_completed') return 'quiz_submitted' as const
  if (interaction === 'module_completed') return 'module_completed' as const
  return 'module_interaction' as const
}

export function validateIcuSimulationAnalyticsEventPayload(value: unknown) {
  return icuSimulationAnalyticsEventPayloadSchema.safeParse(value)
}

export function icuSimulationScoreBand(score: number | null, sandbox = false) {
  if (sandbox || score === null) return 'not-scored' as const
  if (score >= 80) return 'mastery' as const
  if (score >= 60) return 'approaching-mastery' as const
  return 'needs-review' as const
}

export function icuSimulationElapsedBand(elapsedSeconds: number) {
  if (elapsedSeconds < 15 * 60) return 'under-15-minutes' as const
  if (elapsedSeconds <= 30 * 60) return '15-to-30-minutes' as const
  if (elapsedSeconds <= 60 * 60) return '31-to-60-minutes' as const
  return 'over-60-minutes' as const
}
