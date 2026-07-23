import { z } from 'zod'

import { criticalCareAccountSyncModuleIds } from './critical-care-progress-sync'

export const CRITICAL_CARE_ANALYTICS_MODULE_ID = 'critical-care' as const

export const criticalCareAnalyticsInteractions = [
  'critical_care_dashboard_viewed',
  'critical_care_resume_selected',
  'critical_care_recommendation_selected',
  'critical_care_activity_opened',
  'critical_care_qualified_start',
  'critical_care_phase_completed',
  'critical_care_prediction_submitted',
  'critical_care_hint_used',
  'critical_care_safety_event',
  'critical_care_goal_met',
  'critical_care_debrief_viewed',
  'critical_care_transfer_completed',
  'critical_care_activity_completed',
  'critical_care_activity_mastered',
  'critical_care_pathway_selected',
  'critical_care_quick_practice_selected',
  'critical_care_lab_selected',
  'critical_care_reference_searched',
  'critical_care_reference_no_results',
  'critical_care_notebook_saved',
] as const

export const criticalCareAnalyticsPhases = [
  'recognize',
  'predict',
  'act',
  'observe',
  'explain',
  'transfer',
] as const

export const criticalCareAnalyticsSearchCategories = [
  'all',
  'definitions',
  'waveform-patterns',
  'formulas',
  'normal-and-abnormal-states',
  'alarm-differentials',
  'troubleshooting-sequences',
  'device-controls',
  'safety-considerations',
  'references-and-model-limits',
  'asset',
] as const

export type CriticalCareAnalyticsSearchCategory =
  (typeof criticalCareAnalyticsSearchCategories)[number]

const stableIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9:._-]*$/)

export const criticalCareAnalyticsEventPayloadSchema = z
  .object({
    interaction: z.enum(criticalCareAnalyticsInteractions),
    moduleId: z.enum(criticalCareAccountSyncModuleIds).optional(),
    activityId: stableIdSchema.optional(),
    phase: z.enum(criticalCareAnalyticsPhases).optional(),
    mode: z.enum(['guided', 'practice', 'challenge']).optional(),
    targetId: stableIdSchema.optional(),
    targetType: z.enum(['activity', 'lab', 'pathway', 'reference']).optional(),
    qualification: z.enum(['30-visible-seconds', 'meaningful-interaction']).optional(),
    searchCategory: z.enum(criticalCareAnalyticsSearchCategories).optional(),
    resultCount: z.number().int().min(0).max(500).optional(),
    schemaVersion: z.literal(1),
  })
  .strict()
  .superRefine((payload, context) => {
    const issue = (path: keyof typeof payload, message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })
    const selectionInteractions = new Set([
      'critical_care_resume_selected',
      'critical_care_recommendation_selected',
      'critical_care_pathway_selected',
      'critical_care_quick_practice_selected',
      'critical_care_lab_selected',
    ])
    const activityInteractions = new Set([
      'critical_care_activity_opened',
      'critical_care_phase_completed',
      'critical_care_prediction_submitted',
      'critical_care_hint_used',
      'critical_care_safety_event',
      'critical_care_goal_met',
      'critical_care_debrief_viewed',
      'critical_care_transfer_completed',
      'critical_care_activity_completed',
      'critical_care_activity_mastered',
    ])
    const referenceInteractions = new Set([
      'critical_care_reference_searched',
      'critical_care_reference_no_results',
    ])

    if (
      selectionInteractions.has(payload.interaction) &&
      (!payload.targetId || !payload.targetType)
    ) {
      issue('targetId', 'Selection events require a stable target ID and type.')
    }
    if (payload.interaction === 'critical_care_qualified_start' && !payload.qualification) {
      issue('qualification', 'Qualified starts require a bounded qualification reason.')
    }
    if (
      payload.interaction === 'critical_care_qualified_start' &&
      Boolean(payload.activityId) !== Boolean(payload.moduleId)
    ) {
      issue(
        'activityId',
        'Activity-qualified starts require stable activity and module IDs together.',
      )
    }
    if (
      activityInteractions.has(payload.interaction) &&
      (!payload.activityId || !payload.moduleId)
    ) {
      issue('activityId', 'Activity events require stable activity and module IDs.')
    }
    if (payload.interaction === 'critical_care_phase_completed' && !payload.phase) {
      issue('phase', 'Phase completion requires a phase enum.')
    }
    if (referenceInteractions.has(payload.interaction) && !payload.searchCategory) {
      issue('searchCategory', 'Reference events require a category, never query text.')
    }
    if (payload.interaction === 'critical_care_reference_no_results' && payload.resultCount !== 0) {
      issue('resultCount', 'No-result events require a zero result count.')
    }
    if (
      payload.interaction === 'critical_care_notebook_saved' &&
      (!payload.targetId || payload.targetType !== 'reference')
    ) {
      issue('targetId', 'Notebook saves require a stable reference ID.')
    }
  })

export type CriticalCareAnalyticsEventPayload = z.infer<
  typeof criticalCareAnalyticsEventPayloadSchema
>

export function validateCriticalCareAnalyticsEventPayload(value: unknown) {
  return criticalCareAnalyticsEventPayloadSchema.safeParse(value)
}

export function expectedCriticalCareAnalyticsEventType(
  interaction: CriticalCareAnalyticsEventPayload['interaction'],
) {
  if (
    interaction === 'critical_care_activity_completed' ||
    interaction === 'critical_care_activity_mastered'
  ) {
    return 'module_completed' as const
  }
  if (
    interaction === 'critical_care_phase_completed' ||
    interaction === 'critical_care_debrief_viewed' ||
    interaction === 'critical_care_transfer_completed' ||
    interaction === 'critical_care_notebook_saved'
  ) {
    return 'section_completed' as const
  }
  if (
    interaction === 'critical_care_prediction_submitted' ||
    interaction === 'critical_care_hint_used' ||
    interaction === 'critical_care_safety_event' ||
    interaction === 'critical_care_goal_met'
  ) {
    return 'quiz_submitted' as const
  }
  return 'module_opened' as const
}
