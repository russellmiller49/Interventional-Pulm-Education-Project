import { z } from 'zod'

import type { SiteAnalyticsEventType } from '@/lib/analytics'
import {
  BAXTER_CRRT_ANALYTICS_MODULE_ID,
  baxterCrrtAnalyticsEventPayloadSchema,
  type BaxterCrrtAnalyticsEventPayload,
} from '@/lib/baxter-crrt-analytics'

const eventInputSchema = z
  .object({
    eventPayload: baxterCrrtAnalyticsEventPayloadSchema,
    percentComplete: z.number().int().min(0).max(100).optional(),
    section: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[A-Za-z0-9]+(?:[-_.:][A-Za-z0-9]+)*$/)
      .optional(),
  })
  .strict()

export interface BaxterCrrtAnalyticsEvent {
  readonly eventType: SiteAnalyticsEventType
  readonly moduleId: typeof BAXTER_CRRT_ANALYTICS_MODULE_ID
  readonly eventPayload: BaxterCrrtAnalyticsEventPayload
  readonly percentComplete?: number
  readonly section?: string
}

function eventTypeForInteraction(
  interaction: BaxterCrrtAnalyticsEventPayload['interaction'],
): SiteAnalyticsEventType {
  if (interaction === 'case_completed') return 'quiz_submitted'
  if (interaction === 'station_completed') return 'section_completed'
  if (interaction === 'mastery_completed') return 'module_completed'
  return 'module_interaction'
}

export function buildBaxterCrrtAnalyticsPayload(
  input: BaxterCrrtAnalyticsEventPayload,
): BaxterCrrtAnalyticsEventPayload {
  return baxterCrrtAnalyticsEventPayloadSchema.parse(input)
}

export function buildBaxterCrrtAnalyticsEvent(input: {
  readonly eventPayload: BaxterCrrtAnalyticsEventPayload
  readonly percentComplete?: number
  readonly section?: string
}): BaxterCrrtAnalyticsEvent {
  const parsed = eventInputSchema.parse(input)
  return {
    eventType: eventTypeForInteraction(parsed.eventPayload.interaction),
    moduleId: BAXTER_CRRT_ANALYTICS_MODULE_ID,
    eventPayload: parsed.eventPayload,
    ...(parsed.percentComplete === undefined ? {} : { percentComplete: parsed.percentComplete }),
    ...(parsed.section === undefined ? {} : { section: parsed.section }),
  }
}
