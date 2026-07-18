import { z } from 'zod'

import type { SiteAnalyticsEventType } from '@/lib/analytics'
import {
  BAXTER_CRRT_ANALYTICS_MODULE_ID,
  baxterCrrtAnalyticsEventPayloadSchema,
  expectedBaxterCrrtAnalyticsEventType,
  type BaxterCrrtAnalyticsEventPayload,
} from '@/lib/baxter-crrt-analytics'

const eventInputSchema = z
  .object({
    eventPayload: baxterCrrtAnalyticsEventPayloadSchema,
  })
  .strict()

export interface BaxterCrrtAnalyticsEvent {
  readonly eventType: SiteAnalyticsEventType
  readonly moduleId: typeof BAXTER_CRRT_ANALYTICS_MODULE_ID
  readonly eventPayload: BaxterCrrtAnalyticsEventPayload
}

export function buildBaxterCrrtAnalyticsPayload(
  input: BaxterCrrtAnalyticsEventPayload,
): BaxterCrrtAnalyticsEventPayload {
  return baxterCrrtAnalyticsEventPayloadSchema.parse(input)
}

export function buildBaxterCrrtAnalyticsEvent(input: {
  readonly eventPayload: BaxterCrrtAnalyticsEventPayload
}): BaxterCrrtAnalyticsEvent {
  const parsed = eventInputSchema.parse(input)
  return {
    eventType: expectedBaxterCrrtAnalyticsEventType(parsed.eventPayload.interaction),
    moduleId: BAXTER_CRRT_ANALYTICS_MODULE_ID,
    eventPayload: parsed.eventPayload,
  }
}

export function buildBaxterCrrtAnalyticsEventForSession(
  sessionMode: 'learner' | 'review-preview',
  input: { readonly eventPayload: BaxterCrrtAnalyticsEventPayload },
): BaxterCrrtAnalyticsEvent | null {
  if (sessionMode === 'review-preview') return null
  return buildBaxterCrrtAnalyticsEvent(input)
}
