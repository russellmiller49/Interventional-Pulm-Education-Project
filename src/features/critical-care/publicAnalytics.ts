import { recordSiteModuleEvent } from '@/lib/analytics'
import { z } from 'zod'

export const publicCriticalCareSearchCategories = [
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

export type PublicCriticalCareSearchCategory = (typeof publicCriticalCareSearchCategories)[number]

export const criticalCareDashboardInteractions = [
  'critical_care_dashboard_viewed',
  'critical_care_resume_selected',
  'critical_care_recommendation_selected',
  'critical_care_qualified_start',
  'critical_care_pathway_selected',
  'critical_care_quick_practice_selected',
  'critical_care_lab_selected',
] as const

export type CriticalCareDashboardInteraction = (typeof criticalCareDashboardInteractions)[number]
export type CriticalCareDashboardTargetType = 'activity' | 'lab' | 'pathway'
export type CriticalCareDashboardQualification = '30-visible-seconds' | 'meaningful-interaction'

export interface CriticalCareDashboardAnalyticsInput {
  readonly interaction: CriticalCareDashboardInteraction
  readonly targetId?: string
  readonly targetType?: CriticalCareDashboardTargetType
  readonly qualification?: CriticalCareDashboardQualification
}

const stableIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9:._-]*$/)

const dashboardPayloadSchema = z
  .object({
    interaction: z.enum(criticalCareDashboardInteractions),
    targetId: stableIdSchema.optional(),
    targetType: z.enum(['activity', 'lab', 'pathway']).optional(),
    qualification: z.enum(['30-visible-seconds', 'meaningful-interaction']).optional(),
    schemaVersion: z.literal(1),
  })
  .strict()
  .superRefine((payload, context) => {
    const selection = payload.interaction.endsWith('_selected')
    if (selection && (!payload.targetId || !payload.targetType)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetId'],
        message: 'Selection events require a stable target ID and type.',
      })
    }
    if (payload.interaction === 'critical_care_qualified_start' && !payload.qualification) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['qualification'],
        message: 'Qualified starts require a bounded reason.',
      })
    }
  })

const referencePayloadSchema = z.discriminatedUnion('interaction', [
  z
    .object({
      interaction: z.literal('critical_care_reference_no_results'),
      searchCategory: z.enum(publicCriticalCareSearchCategories),
      resultCount: z.literal(0),
      schemaVersion: z.literal(1),
    })
    .strict(),
  z
    .object({
      interaction: z.literal('critical_care_notebook_saved'),
      targetId: stableIdSchema,
      targetType: z.literal('reference'),
      schemaVersion: z.literal(1),
    })
    .strict(),
])

export type PublicCriticalCareReferenceAnalyticsInput =
  | {
      readonly interaction: 'critical_care_reference_no_results'
      readonly searchCategory: PublicCriticalCareSearchCategory
      readonly resultCount: 0
    }
  | {
      readonly interaction: 'critical_care_notebook_saved'
      readonly targetId: string
      readonly targetType: 'reference'
    }

export function recordCriticalCareDashboardEvent(input: CriticalCareDashboardAnalyticsInput) {
  const payload = dashboardPayloadSchema.parse({ ...input, schemaVersion: 1 })
  recordSiteModuleEvent({
    eventType: 'module_opened',
    moduleId: 'critical-care',
    eventPayload: payload,
  })
}

export function recordPublicCriticalCareReferenceEvent(
  input: PublicCriticalCareReferenceAnalyticsInput,
) {
  const payload = referencePayloadSchema.parse({ ...input, schemaVersion: 1 })
  recordSiteModuleEvent({
    eventType:
      payload.interaction === 'critical_care_notebook_saved'
        ? 'section_completed'
        : 'module_opened',
    moduleId: 'critical-care',
    eventPayload: payload,
  })
}
