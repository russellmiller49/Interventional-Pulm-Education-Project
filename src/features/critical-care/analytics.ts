import { recordSiteModuleEvent } from '@/lib/analytics'
import {
  CRITICAL_CARE_ANALYTICS_MODULE_ID,
  criticalCareAnalyticsEventPayloadSchema,
  expectedCriticalCareAnalyticsEventType,
  type CriticalCareAnalyticsEventPayload,
} from '@/lib/critical-care-analytics'

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

export interface CriticalCareDashboardAnalyticsEventPayload {
  readonly interaction: CriticalCareDashboardInteraction
  readonly targetId?: string
  readonly targetType?: CriticalCareDashboardTargetType
  readonly qualification?: CriticalCareDashboardQualification
  readonly schemaVersion: 1
}

const catalogIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$/

export function buildCriticalCareDashboardAnalyticsPayload(
  input: CriticalCareDashboardAnalyticsInput,
): CriticalCareDashboardAnalyticsEventPayload {
  const targetId = input.targetId?.slice(0, 160)
  return criticalCareAnalyticsEventPayloadSchema.parse({
    interaction: input.interaction,
    ...(targetId && catalogIdentifierPattern.test(targetId) ? { targetId } : {}),
    ...(input.targetType ? { targetType: input.targetType } : {}),
    ...(input.qualification ? { qualification: input.qualification } : {}),
    schemaVersion: 1,
  }) as CriticalCareDashboardAnalyticsEventPayload
}

export function recordCriticalCareDashboardEvent(input: CriticalCareDashboardAnalyticsInput) {
  const eventPayload = buildCriticalCareDashboardAnalyticsPayload(input)
  recordSiteModuleEvent({
    eventType: expectedCriticalCareAnalyticsEventType(eventPayload.interaction),
    moduleId: CRITICAL_CARE_ANALYTICS_MODULE_ID,
    eventPayload: { ...eventPayload },
  })
}

export function recordCriticalCareEvent(
  input: Omit<CriticalCareAnalyticsEventPayload, 'schemaVersion'>,
) {
  const eventPayload = criticalCareAnalyticsEventPayloadSchema.parse({
    ...input,
    schemaVersion: 1,
  })
  recordSiteModuleEvent({
    eventType: expectedCriticalCareAnalyticsEventType(eventPayload.interaction),
    moduleId: CRITICAL_CARE_ANALYTICS_MODULE_ID,
    eventPayload,
  })
}
